/*
 * Elegy of the Night — The Belmont Archives
 * audio.js — Web Audio engine: synthesized music, sound effects and English TTS voices (G.audio).
 * No audio files: everything is generated at runtime. Reads G.musicData lazily (load order free).
 * Every public function is a safe no-op when Web Audio / speechSynthesis are unavailable.
 */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var G = root.G = root.G || {};
  if (G.audio && G.audio.__elegy) return;

  var LOOKAHEAD = 0.12, LOOKAHEAD_HIDDEN = 1.0, TICK_MS = 25, CATCHUP = 0.3;
  var MAX_SFX = 24, SFX_GAP = 0.035, MAX_MUSIC_VOICES = 110, DUCK = 0.35;

  // ------------------------------------------------------------------ utils
  function nowMs() { try { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); } catch (e) { return Date.now(); } }
  function clamp(v, a, b) { v = +v; if (v !== v) v = a; return v < a ? a : (v > b ? b : v); }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var warned = {};
  function warnOnce(key, msg) { if (warned[key]) return; warned[key] = 1; try { console.warn('[audio] ' + msg); } catch (e) { /* ignore */ } }
  function safeCall(fn) { if (typeof fn !== 'function') return; try { fn(); } catch (e) { try { console.error(e); } catch (e2) { /* ignore */ } } }
  function mkRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function ACclass() { try { return root.AudioContext || root.webkitAudioContext || null; } catch (e) { return null; } }
  function OACclass() { try { return root.OfflineAudioContext || root.webkitOfflineAudioContext || null; } catch (e) { return null; } }
  function md() { return G.musicData || null; }
  function disc(list) { for (var i = 0; i < list.length; i++) { try { list[i].disconnect(); } catch (e) { /* ignore */ } } }
  function onEnd(src, fn) {
    try { if (src.addEventListener) { src.addEventListener('ended', fn); return; } } catch (e) { /* ignore */ }
    var prev = src.onended; src.onended = function (ev) { if (prev) prev(ev); fn(ev); };
  }

  // ------------------------------------------------------------------ state
  var vol = { master: 0.8, music: 0.7, sfx: 0.8, voice: 0.9 };
  var ctx = null, g = null, unlocked = false, timer = null;
  var ducked = false, cur = null, curId = null, pending = null, fading = [];
  var lastSfx = {};
  function musicLevel() { return vol.music * (ducked ? DUCK : 1); }

  // ------------------------------------------------------------------ graph
  function gainNode(c, v) { var n = c.createGain(); n.gain.value = v; return n; }
  function softClipCurve() {
    var n = 4096, cv = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = i / (n - 1) * 2 - 1, ax = Math.abs(x);
      var y = ax <= 0.85 ? ax : 0.85 + 0.14 * Math.tanh((ax - 0.85) / 0.14);
      cv[i] = x < 0 ? -y : y;
    }
    return cv;
  }
  function driveCurve(k) {
    var n = 2048, cv = new Float32Array(n), d = Math.tanh(k);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(k * x) / d; }
    return cv;
  }
  function makeNoise(c) {
    var len = Math.floor(c.sampleRate * 2), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0), r = mkRng(777);
    for (var i = 0; i < len; i++) d[i] = r() * 2 - 1;
    return b;
  }
  // generated hall impulse response: ~2.6 s, darkening tail, decorrelated L/R, a few early reflections
  function makeIR(c, dur) {
    var sr = c.sampleRate, len = Math.floor(sr * dur), b = c.createBuffer(2, len, sr), pre = Math.floor(sr * 0.012);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch), r = mkRng(1234 + ch * 999), lp = 0;
      for (var i = pre; i < len; i++) {
        var t = (i - pre) / sr, k = i / len;
        var env = Math.exp(-t * 2.3) * Math.pow(1 - k, 1.2) * Math.min(1, t / 0.006);
        var coef = 0.9 - 0.75 * Math.min(1, t / (dur * 0.7));
        lp += ((r() * 2 - 1) - lp) * coef;
        d[i] = lp * env;
      }
      var er = [0.017, 0.029, 0.041, 0.057, 0.073];
      for (var j = 0; j < er.length; j++) {
        var idx = Math.floor((er[j] + ch * 0.0031 * (j + 1)) * sr);
        if (idx < len) d[idx] += (j % 2 ? -0.5 : 0.6) * (1 - j * 0.15);
      }
    }
    return b;
  }
  function buildGraph(c, live, raw) {
    var o = { ctx: c, live: live, waves: {}, voices: 0, sfxVoices: 0 };
    o.master = gainNode(c, vol.master);
    var node = o.master;
    try {
      var comp = c.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 9; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.22;
      node.connect(comp); node = comp;
    } catch (e) { /* no compressor */ }
    if (!raw) {
      try { var ws = c.createWaveShaper(); ws.curve = softClipCurve(); ws.oversample = 'none'; node.connect(ws); node = ws; } catch (e) { /* none */ }
    }
    node.connect(c.destination);
    // shared reverb (send/return)
    o.rvIn = gainNode(c, 1);
    try {
      var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 190; hp.Q.value = 0.6;
      var conv = c.createConvolver(); conv.buffer = makeIR(c, 2.6);
      var ret = gainNode(c, 0.55);
      o.rvIn.connect(hp); hp.connect(conv); conv.connect(ret); ret.connect(o.master);
    } catch (e) { /* no reverb */ }
    o.musicDry = gainNode(c, live ? musicLevel() : vol.music); o.musicDry.connect(o.master);
    o.musicWet = gainNode(c, live ? musicLevel() : vol.music); o.musicWet.connect(o.rvIn);
    o.sfxDry = gainNode(c, vol.sfx); o.sfxDry.connect(o.master);
    o.sfxWet = gainNode(c, vol.sfx); o.sfxWet.connect(o.rvIn);
    o.noise = makeNoise(c);
    return o;
  }
  var BASIC = { sine: 1, square: 1, sawtooth: 1, triangle: 1 };
  function setWave(o, osc, w) {
    if (!w || BASIC[w]) { osc.type = w || 'sine'; return; }
    var pw = o.waves[w];
    if (!pw) {
      var m = md(), tab = m && m.waves && m.waves[w];
      if (!tab) { osc.type = 'sine'; return; }
      var re = new Float32Array(tab.length), im = new Float32Array(tab.length);
      for (var i = 1; i < tab.length; i++) im[i] = tab[i];
      try { pw = o.ctx.createPeriodicWave(re, im); } catch (e) { pw = null; }
      o.waves[w] = pw;
      if (!pw) { osc.type = 'sine'; return; }
    }
    osc.setPeriodicWave(pw);
  }
  function ramp(param, v, tc) {
    if (!param || !ctx) return;
    var t = ctx.currentTime;
    try { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.setTargetAtTime(v, t, tc || 0.05); }
    catch (e) { try { param.value = v; } catch (e2) { /* ignore */ } }
  }

  // ------------------------------------------------------------- synth voice
  // P: instrument preset (see music.js). Returns nothing; nodes clean themselves up.
  function playNote(o, dest, P, midi, t, dur, vel, rng) {
    if (o.voices >= MAX_MUSIC_VOICES) return;
    var c = o.ctx, f = mtof(midi), nodes = [], srcs = [];
    var amp = c.createGain(); amp.gain.value = 0; nodes.push(amp);
    var head = amp;
    if (P.lp) {
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = P.lp.q || 0.7;
      var base = clamp(P.lp.f * Math.pow(f / 261.63, P.lp.kt || 0) * (1 + (vel - 0.75) * (P.lp.vel || 0)), 40, 16000);
      if (P.lp.env) {
        lp.frequency.setValueAtTime(clamp(base + P.lp.env * (0.45 + vel * 0.65), 40, 16000), t);
        lp.frequency.setTargetAtTime(base, t + 0.003, (P.lp.ed || 0.1) / 2.5);
      } else lp.frequency.setValueAtTime(base, t);
      lp.connect(head); head = lp; nodes.push(lp);
    }
    if (P.hp) { var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = P.hp; hp.Q.value = 0.7; hp.connect(head); head = hp; nodes.push(hp); }

    var A = P.a || 0.005, peak = (P.gain || 0.2) * vel, S = P.s == null ? 1 : P.s, R = P.r || 0.1;
    var off = t + Math.max(dur, A + 0.01), end, gp = amp.gain;
    gp.setValueAtTime(0, t);
    gp.linearRampToValueAtTime(peak, t + A);
    if (S > 0) {
      if (S < 1) gp.setTargetAtTime(peak * S, t + A, (P.d || 0.2) / 3);
      gp.setTargetAtTime(0, off, R / 6);
      end = off + R * 1.15 + 0.02;
    } else {
      var D = P.d || 1, nat = t + A + D;
      gp.setTargetAtTime(0, t + A, D / 6);
      if (off < nat) { gp.setTargetAtTime(0, off, R / 6); end = Math.min(nat, off + R * 1.15) + 0.02; } else end = nat + 0.02;
    }

    var fmG = null;
    if (P.fm) {
      var mod = c.createOscillator(); mod.frequency.value = f * P.fm.r;
      fmG = c.createGain(); var idx = f * P.fm.i * (0.55 + 0.55 * vel);
      fmG.gain.setValueAtTime(idx, t); fmG.gain.setTargetAtTime(idx * 0.06, t, (P.fm.d || 0.5) / 3);
      mod.connect(fmG); srcs.push(mod); nodes.push(fmG);
    }
    var vib = null;
    if (P.vib && P.vib.d && dur > (P.vib.dl || 0) + 0.05) {
      var lfo = c.createOscillator(); lfo.frequency.value = P.vib.r * (0.93 + rng() * 0.14);
      vib = c.createGain(); var dl = t + (P.vib.dl || 0);
      vib.gain.setValueAtTime(0, t); vib.gain.setValueAtTime(0, dl); vib.gain.linearRampToValueAtTime(P.vib.d, dl + 0.3);
      lfo.connect(vib); srcs.push(lfo); nodes.push(vib);
    }
    var oscs = P.osc || [{ w: 'sine' }];
    for (var i = 0; i < oscs.length; i++) {
      var od = oscs[i], osc = c.createOscillator();
      setWave(o, osc, od.w);
      osc.frequency.value = f * (od.r || Math.pow(2, od.o || 0));
      var det = (od.d || 0) + (rng() - 0.5) * 3;
      if (P.pe) { osc.detune.setValueAtTime(det + P.pe.c, t); osc.detune.linearRampToValueAtTime(det, t + P.pe.t); }
      else osc.detune.value = det;
      if (vib) vib.connect(osc.detune);
      if (fmG && i === 0) fmG.connect(osc.frequency);
      var og = od.g == null ? 1 : od.g;
      if (og !== 1) { var gn = gainNode(c, og); osc.connect(gn); gn.connect(head); nodes.push(gn); } else osc.connect(head);
      srcs.push(osc);
    }
    amp.connect(dest);
    if (P.ch) { // noise chiff / mallet transient (bypasses the amp envelope)
      var ns = c.createBufferSource(); ns.buffer = o.noise; ns.loop = true;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = P.ch.f; bp.Q.value = P.ch.q || 1;
      var ng = c.createGain(), cd = P.ch.d || 0.05, cp = peak * (P.ch.g || 0.1) * 3;
      ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(cp, t + 0.004); ng.gain.setTargetAtTime(0, t + 0.004, cd / 4);
      ns.connect(bp); bp.connect(ng); ng.connect(dest); nodes.push(bp, ng);
      ns.start(t, rng() * 1.5); ns.stop(Math.min(end, t + cd * 2 + 0.03));
      onEnd(ns, function () { try { ns.disconnect(); bp.disconnect(); ng.disconnect(); } catch (e) { /* ignore */ } });
    }
    for (var j = 0; j < srcs.length; j++) { srcs[j].start(t); srcs[j].stop(end); }
    o.voices++;
    onEnd(srcs[srcs.length - 1], function () { o.voices--; disc(srcs); disc(nodes); });
  }

  // --------------------------------------------------- layer renderer (sfx & drums)
  // layer: n noise | w wave, f Hz or [f0,f1,..] (scaled by pitch), fs sweep time, t offset, d duration, a attack,
  // v volume, e 'exp'|'lin'|'flat'|'swell', ft noise filter type, q, lp/hp/bp extra filter, fm [ratio,index,decay],
  // vib [rate,cents], tr [rate,depth] tremolo, rep [count,interval], ar [semitones..] + st step, rnd cents, dt detune
  function sweep(p, f, pm, t, dur, maxF) {
    if (typeof f === 'number') { p.setValueAtTime(clamp(f * pm, 1, maxF), t); return; }
    p.setValueAtTime(clamp(f[0] * pm, 1, maxF), t);
    var n = f.length - 1;
    for (var i = 1; i <= n; i++) p.exponentialRampToValueAtTime(clamp(f[i] * pm, 1, maxF), t + Math.max(0.005, dur) * i / n);
  }
  function layerVoice(o, dest, ly, t, vel, pm, rng) {
    var c = o.ctx, d = ly.d || 0.2, a = Math.min(ly.a || 0.002, d * 0.95), v = (ly.v == null ? 0.5 : ly.v) * vel;
    if (!(v > 0)) return null;
    var nyq = c.sampleRate * 0.45, nodes = [], srcs = [];
    var amp = c.createGain(); amp.gain.value = 0; nodes.push(amp);
    var outN = amp;
    if (ly.tr) {
      var trem = c.createGain(); trem.gain.value = 1 - ly.tr[1] / 2;
      var tl = c.createOscillator(); tl.frequency.value = ly.tr[0];
      var tg = gainNode(c, ly.tr[1] / 2); tl.connect(tg); tg.connect(trem.gain); amp.connect(trem); outN = trem;
      srcs.push(tl); nodes.push(trem, tg);
    }
    outN.connect(dest);
    var head = amp, fArr = ly.f == null ? (ly.n ? 1200 : 440) : ly.f, fs = ly.fs || d;
    function filt(type, val, q) {
      var b = c.createBiquadFilter(); b.type = type; b.Q.value = q || 0.7;
      sweep(b.frequency, val, type === 'bandpass' ? pm : Math.sqrt(pm), t, fs, nyq);
      b.connect(head); head = b; nodes.push(b);
    }
    if (ly.lp) filt('lowpass', ly.lp, ly.n ? 0.7 : ly.q);
    if (ly.hp) filt('highpass', ly.hp);
    if (ly.bp && !ly.n) filt('bandpass', ly.bp, ly.q || 2);
    var src;
    if (ly.n) {
      src = c.createBufferSource(); src.buffer = o.noise; src.loop = true;
      var nf = c.createBiquadFilter(); nf.type = ly.ft || 'bandpass';
      nf.Q.value = ly.q || (nf.type === 'bandpass' ? 1.2 : 0.7);
      sweep(nf.frequency, fArr, pm, t, fs, nyq);
      src.connect(nf); nf.connect(head); nodes.push(nf);
    } else {
      src = c.createOscillator(); setWave(o, src, ly.w || 'sine');
      sweep(src.frequency, fArr, pm, t, fs, nyq);
      if (ly.dt) src.detune.value = ly.dt;
      if (ly.fm) {
        var f0 = (typeof fArr === 'number' ? fArr : fArr[0]) * pm;
        var mo = c.createOscillator(); mo.frequency.value = f0 * ly.fm[0];
        var mg = c.createGain(), mi = f0 * ly.fm[1];
        mg.gain.setValueAtTime(mi, t); mg.gain.setTargetAtTime(mi * 0.05, t, (ly.fm[2] || d) / 3);
        mo.connect(mg); mg.connect(src.frequency); srcs.push(mo); nodes.push(mg);
      }
      if (ly.vib) {
        var vl = c.createOscillator(); vl.frequency.value = ly.vib[0];
        var vg = gainNode(c, ly.vib[1]); vl.connect(vg); vg.connect(src.detune); srcs.push(vl); nodes.push(vg);
      }
      src.connect(head);
    }
    var gp = amp.gain, e = ly.e || 'exp', end = t + d + 0.02;
    gp.setValueAtTime(0, t);
    gp.linearRampToValueAtTime(v, t + a);
    if (e === 'swell' || e === 'lin') gp.linearRampToValueAtTime(0, t + d);
    else if (e === 'flat') { gp.setValueAtTime(v, Math.max(t + a, t + d - 0.04)); gp.linearRampToValueAtTime(0, t + d); }
    else gp.setTargetAtTime(0, t + a, Math.max(0.004, (d - a) / 6));
    if (ly.n) src.start(t, rng() * 1.5); else src.start(t);
    src.stop(end);
    for (var i = 0; i < srcs.length; i++) { srcs[i].start(t); srcs[i].stop(end); }
    srcs.push(src);
    onEnd(src, function () { disc(srcs); disc(nodes); });
    return { end: end, src: src };
  }
  function renderLayers(o, dest, L, t0, vel, pm, rng) {
    var last = { end: t0, src: null };
    for (var i = 0; i < L.length; i++) {
      var ly = L[i], arp = ly.ar, n = arp ? arp.length : (ly.rep ? ly.rep[0] : 1);
      for (var r = 0; r < n; r++) {
        var tt = t0 + (ly.t || 0) + r * (arp ? (ly.st || 0.08) : (ly.rep ? ly.rep[1] : 0));
        var cents = (ly.rnd ? (rng() * 2 - 1) * ly.rnd : 0) + (arp ? arp[r] * 100 : 0);
        var res = layerVoice(o, dest, ly, tt, vel, pm * Math.pow(2, cents / 1200), rng);
        if (res && res.end >= last.end) last = res;
      }
    }
    return last;
  }

  // ------------------------------------------------------------- music player
  function Player(o, comp, id, t0) {
    var c = o.ctx;
    this.o = o; this.c = comp; this.id = id; this.spb = comp.spb; this.t0 = t0;
    this.out = gainNode(c, 0); this.out.connect(o.musicDry);
    this.wet = gainNode(c, 0); this.wet.connect(o.musicWet);
    this.buses = {}; this.lanes = {}; this.all = [this.out, this.wet];
    this.seg = comp.intro ? 'intro' : 'main'; this.segStart = 0; this.idx = 0; this.cursor = 0;
    this.done = false; this.stopAt = Infinity; this.endTime = Infinity;
    this.rng = mkRng(hashStr(id) ^ ((Date.now() & 0xffff) << 3));
  }
  Player.prototype.level = function (v, t, dur) {
    var L = v * this.c.vol, ps = [this.out.gain, this.wet.gain];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      try {
        p.cancelScheduledValues(t); p.setValueAtTime(p.value, t);
        if (dur > 0.01) p.linearRampToValueAtTime(L, t + dur); else p.setValueAtTime(L, t);
      } catch (e) { /* ignore */ }
    }
  };
  Player.prototype.stop = function (t, fade) {
    this.level(0, t, fade);
    this.stopAt = t + Math.max(0.01, fade);
  };
  Player.prototype.bus = function (pk) {
    var b = this.buses[pk];
    if (b) return b;
    var o = this.o, c = o.ctx, cfg = this.c.parts[pk] || {}, m = md();
    var P = (!cfg.kit && m && m.instruments[cfg.i]) || null;
    var fx = {}, k;
    if (P && P.fx) for (k in P.fx) fx[k] = P.fx[k];
    if (cfg.fx) for (k in cfg.fx) fx[k] = cfg.fx[k];
    var input = gainNode(c, 1), node = input, nodes = [input];
    if (fx.formants) {
      var sum = gainNode(c, fx.gain || 1); nodes.push(sum);
      for (var i = 0; i < fx.formants.length; i++) {
        var fm = fx.formants[i], bpf = c.createBiquadFilter(); bpf.type = 'bandpass'; bpf.frequency.value = fm[0]; bpf.Q.value = fm[1];
        var fg = gainNode(c, fm[2]); node.connect(bpf); bpf.connect(fg); fg.connect(sum); nodes.push(bpf, fg);
      }
      if (fx.body) {
        var bl = c.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = fx.body[0];
        var bg = gainNode(c, fx.body[1]); node.connect(bl); bl.connect(bg); bg.connect(sum); nodes.push(bl, bg);
      }
      node = sum;
    }
    if (fx.drive) {
      var ws = c.createWaveShaper(); ws.curve = driveCurve(fx.drive); ws.oversample = '2x';
      node.connect(ws); node = ws; nodes.push(ws);
      if (fx.gain && !fx.formants) { var dg = gainNode(c, fx.gain); node.connect(dg); node = dg; nodes.push(dg); }
    }
    if (fx.hp) { var h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = fx.hp; node.connect(h); node = h; nodes.push(h); }
    if (fx.lp) { var l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = fx.lp; node.connect(l); node = l; nodes.push(l); }
    var pv = gainNode(c, cfg.v == null ? 1 : cfg.v); node.connect(pv); nodes.push(pv);
    var outN = pv;
    if (c.createStereoPanner && cfg.p) { var sp = c.createStereoPanner(); sp.pan.value = clamp(cfg.p, -1, 1); pv.connect(sp); outN = sp; nodes.push(sp); }
    outN.connect(this.out);
    var sendAmt = cfg.s != null ? cfg.s : (P && P.send != null ? P.send : 0.3);
    var send = gainNode(c, sendAmt); outN.connect(send); send.connect(this.wet); nodes.push(send);
    if (fx.echo) {
      var dl = c.createDelay(4); dl.delayTime.value = Math.min(3.9, fx.echo[0] * this.spb);
      var dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
      var fb = gainNode(c, fx.echo[1]), ew = gainNode(c, fx.echo[2]);
      outN.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(ew); ew.connect(this.out); ew.connect(send);
      nodes.push(dl, dlp, fb, ew);
    }
    b = { input: input, nodes: nodes, P: P, cfg: cfg };
    this.buses[pk] = b; this.all = this.all.concat(nodes);
    return b;
  };
  Player.prototype.lane = function (pk, k, K) {
    var key = pk + ':' + k, l = this.lanes[key];
    if (l) return l;
    var c = this.o.ctx, b = this.bus(pk), lg = gainNode(c, K.v == null ? 1 : K.v), outN = lg;
    if (c.createStereoPanner && K.p) { var sp = c.createStereoPanner(); sp.pan.value = K.p; lg.connect(sp); outN = sp; this.all.push(sp); }
    outN.connect(b.input); this.all.push(lg);
    this.lanes[key] = lg;
    return lg;
  };
  Player.prototype.play = function (ev, when) {
    var o = this.o, c = o.ctx, rng = this.rng, h = this.c.hum, m = md();
    var t = Math.max(c.currentTime + 0.002, when + (rng() - 0.5) * 2 * h[0]);
    var vj = 1 + (rng() - 0.5) * 2 * h[1];
    if (ev.k) {
      var K = m && m.kit[ev.k];
      if (!K) return;
      var dest = this.lane(ev.p, ev.k, K);
      if (K.rp && c.createStereoPanner) {
        var sp = c.createStereoPanner(); sp.pan.value = (rng() * 2 - 1) * K.rp; sp.connect(dest); dest = sp;
        setTimeout(function () { try { sp.disconnect(); } catch (e) { /* ignore */ } }, 4000);
      }
      renderLayers(o, dest, K.L, Math.max(c.currentTime + 0.002, when + (rng() - 0.5) * h[0]), clamp(ev.v * vj, 0.05, 1.3), 1, rng);
      return;
    }
    var b = this.bus(ev.p);
    if (!b.P) return;
    var gate = ev.g || b.cfg.gate || b.P.gate || 0.92;
    var vel = clamp((b.cfg.vel || 0.8) * ev.v * vj, 0.05, 1.3);
    var dur = ev.d * this.spb * gate;
    for (var i = 0; i < ev.n.length; i++) playNote(o, b.input, b.P, ev.n[i], t, dur, vel, rng);
  };
  Player.prototype.skipTo = function (beat) {
    var cp = this.c, guard = 0;
    while (guard++ < 1000) {
      var sq = this.seg === 'intro' ? cp.intro : cp.main, segEnd = this.segStart + sq.len;
      if (segEnd <= beat) {
        if (this.seg === 'intro') { this.seg = 'main'; this.segStart = segEnd; }
        else if (cp.loop) this.segStart += Math.max(1, Math.floor((beat - this.segStart) / sq.len)) * sq.len;
        else { this.done = true; this.endTime = this.t0 + segEnd * this.spb; return; }
        this.idx = 0; continue;
      }
      var rel = beat - this.segStart, i = 0;
      while (i < sq.ev.length && sq.ev[i].t < rel) i++;
      this.idx = i; this.cursor = beat; return;
    }
  };
  Player.prototype.schedule = function (until) {
    var cp = this.c, spb = this.spb, ub = (until - this.t0) / spb, guard = 0;
    while (!this.done && guard++ < 20000) {
      var sq = this.seg === 'intro' ? cp.intro : cp.main;
      if (this.idx < sq.ev.length) {
        var ev = sq.ev[this.idx], b = this.segStart + ev.t;
        if (b >= ub) break;
        this.idx++;
        var when = this.t0 + b * spb;
        if (when < this.stopAt) this.play(ev, when);
      } else {
        var segEnd = this.segStart + sq.len;
        if (segEnd > ub) break;
        if (this.seg === 'intro') { this.seg = 'main'; this.segStart = segEnd; this.idx = 0; }
        else if (cp.loop) { this.segStart = segEnd; this.idx = 0; }
        else { this.done = true; this.endTime = this.t0 + segEnd * spb; }
      }
    }
    if (ub > this.cursor) this.cursor = ub;
  };
  Player.prototype.tick = function (t, ahead) {
    if (this.t0 + this.cursor * this.spb < t - CATCHUP) this.skipTo((t - this.t0) / this.spb);
    if (t + 0.05 < this.stopAt) this.schedule(Math.min(ahead, this.stopAt));
  };
  Player.prototype.dispose = function () { disc(this.all); this.all = []; this.buses = {}; this.lanes = {}; };

  // ------------------------------------------------------------------ SFX
  var NPC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function nf(s) { // note name -> Hz
    var m = /^([A-Ga-g])(#|b)?(-?\d)$/.exec(s);
    if (!m) return 440;
    return mtof(NPC[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * (parseInt(m[3], 10) + 1));
  }
  function metal(f, d, v, t) {
    var r = [1, 2.76, 5.4, 8.93], am = [1, 0.6, 0.38, 0.22], o = [];
    for (var i = 0; i < 4; i++) o.push({ f: f * r[i], d: d * (1 - i * 0.18), v: v * am[i], t: t || 0 });
    return o;
  }
  function boomAt(t, v, pf) {
    return [{ n: 1, ft: 'lowpass', f: [3800 * pf, 200], t: t, d: 0.7, v: 0.6 * v }, { f: [120 * pf, 30], fs: 0.35, t: t, d: 0.6, v: 0.5 * v },
            { n: 1, ft: 'bandpass', f: [1100 * pf, 300], q: 1, t: t, d: 0.45, v: 0.25 * v }];
  }
  function brass(t, n, d, v) {
    return [{ w: 'sawtooth', f: nf(n), t: t, a: 0.03, d: d, v: v, lp: [900, 2800, 1700], e: 'flat', vib: [5.5, 8] },
            { w: 'sawtooth', f: nf(n), dt: 8, t: t, a: 0.035, d: d, v: v * 0.7, lp: [900, 2600, 1600], e: 'flat' }];
  }
  function choirTone(t, n, d, v) {
    return [{ w: 'sawtooth', f: nf(n), t: t, a: 0.35, d: d, v: v, bp: 800, q: 1.6, vib: [5, 12], e: 'swell' },
            { w: 'triangle', f: nf(n), dt: -6, t: t, a: 0.4, d: d, v: v * 0.6, e: 'swell' }];
  }
  function cat() { var o = []; for (var i = 0; i < arguments.length; i++) o = o.concat(arguments[i]); return o; }

  var SFX = {
    // ---- UI
    menu_move:   { rv: 0.05, L: [{ w: 'square', f: [1320, 1250], d: 0.045, v: 0.16, lp: 4500 }, { f: 2640, d: 0.03, v: 0.07 }] },
    menu_select: { rv: 0.15, L: [{ w: 'triangle', f: nf('A5'), d: 0.12, v: 0.35 }, { w: 'triangle', f: nf('E6'), t: 0.055, d: 0.22, v: 0.35 }, { f: nf('E7'), t: 0.055, d: 0.18, v: 0.08, fm: [2, 0.5] }] },
    menu_cancel: { rv: 0.08, L: [{ w: 'triangle', f: [660, 440], d: 0.13, v: 0.32 }, { w: 'square', f: [330, 220], d: 0.1, v: 0.07, lp: 1800 }] },
    menu_open:   { rv: 0.25, L: [{ n: 1, f: [700, 2800], q: 1.1, a: 0.07, d: 0.2, v: 0.22, e: 'swell' }, { f: nf('D6'), t: 0.07, d: 0.35, v: 0.16, fm: [3, 0.8] }, { f: nf('A6'), t: 0.12, d: 0.3, v: 0.08 }] },
    menu_error:  { rv: 0.05, L: [{ w: 'square', f: 98, d: 0.085, v: 0.16, lp: 1200, e: 'flat', rep: [2, 0.11] }, { w: 'sawtooth', f: 104, d: 0.085, v: 0.11, lp: 900, e: 'flat', rep: [2, 0.11] }] },
    text_blip:   { v: 0.8, L: [{ w: 'square', f: [880, 860], d: 0.028, v: 0.07, lp: 3000 }, { w: 'triangle', f: 1760, d: 0.02, v: 0.03 }] },
    pause:       { rv: 0.3, L: [{ f: nf('E6'), d: 0.25, v: 0.22, fm: [3, 0.7] }, { f: nf('B5'), t: 0.09, d: 0.4, v: 0.22, fm: [3, 0.6] }] },
    // ---- movement
    jump:        { rv: 0.05, L: [{ n: 1, f: [500, 1600], q: 0.9, a: 0.015, d: 0.14, v: 0.22 }, { w: 'triangle', f: [170, 330], d: 0.1, v: 0.16 }] },
    double_jump: { rv: 0.3, L: [{ n: 1, f: [900, 3600], q: 0.8, a: 0.04, d: 0.24, v: 0.26, e: 'swell' }, { f: nf('A6'), t: 0.05, d: 0.4, v: 0.1, fm: [3.5, 1.2, 0.25] }, { f: nf('E7'), t: 0.09, d: 0.32, v: 0.05 }] },
    land:        { rv: 0.03, L: [{ f: [115, 48], fs: 0.08, d: 0.13, v: 0.45 }, { n: 1, ft: 'lowpass', f: [900, 250], d: 0.08, v: 0.25 }] },
    backdash:    { rv: 0.06, L: [{ n: 1, f: [2600, 650], q: 1.4, a: 0.012, d: 0.21, v: 0.35 }, { n: 1, ft: 'highpass', f: 4500, d: 0.07, v: 0.07 }] },
    step:        { v: 0.7, L: [{ n: 1, ft: 'lowpass', f: 520, d: 0.045, v: 0.11 }, { f: [95, 62], d: 0.04, v: 0.07 }] },
    super_jump:  { rv: 0.2, L: [{ w: 'sawtooth', f: [140, 880], d: 0.38, v: 0.11, lp: [700, 4200] }, { n: 1, f: [450, 4200], q: 1, a: 0.06, d: 0.42, v: 0.3, e: 'swell' }, { f: [280, 1200], d: 0.32, v: 0.13 }] },
    // ---- player combat
    swing_light: { rv: 0.05, L: [{ n: 1, f: [1500, 5200], q: 2.4, a: 0.025, d: 0.12, v: 0.42, e: 'swell' }, { n: 1, ft: 'highpass', f: 6500, t: 0.03, d: 0.06, v: 0.08 }] },
    swing_heavy: { rv: 0.08, L: [{ n: 1, f: [380, 1900], q: 1.4, a: 0.06, d: 0.26, v: 0.55, e: 'swell' }, { w: 'sawtooth', f: [95, 62], d: 0.22, v: 0.09, lp: 420 }] },
    whip:        { rv: 0.12, L: [{ n: 1, f: [700, 2800], q: 1.8, a: 0.05, d: 0.11, v: 0.25, e: 'swell' }, { n: 1, ft: 'highpass', f: 2200, t: 0.1, d: 0.05, v: 0.65 }, { w: 'square', f: [2600, 700], t: 0.1, d: 0.03, v: 0.16 }] },
    punch:       { rv: 0.04, L: [{ f: [190, 58], fs: 0.06, d: 0.13, v: 0.6 }, { n: 1, ft: 'lowpass', f: [2600, 500], d: 0.06, v: 0.4 }] },
    hit_flesh:   { rv: 0.05, L: [{ f: [170, 52], fs: 0.07, d: 0.15, v: 0.55 }, { n: 1, f: [1300, 380], q: 1, d: 0.1, v: 0.5 }, { n: 1, ft: 'lowpass', f: 3200, d: 0.025, v: 0.3 }] },
    hit_metal:   { rv: 0.25, L: cat(metal(560, 0.42, 0.16), [{ n: 1, ft: 'highpass', f: 3200, d: 0.04, v: 0.35 }, { w: 'square', f: [620, 560], d: 0.05, v: 0.06, lp: 4000 }]) },
    hit_bone:    { rv: 0.06, L: [{ n: 1, f: [2600, 1300], q: 3, d: 0.06, v: 0.45, rep: [3, 0.017], rnd: 200 }, { w: 'square', f: [420, 210], d: 0.05, v: 0.1, lp: 2400 }, { f: [160, 80], d: 0.06, v: 0.25 }] },
    crit:        { rv: 0.3, L: [{ f: [210, 55], fs: 0.06, d: 0.16, v: 0.6 }, { n: 1, ft: 'highpass', f: 4200, d: 0.05, v: 0.4 }, { n: 1, f: [1800, 600], q: 1.2, d: 0.1, v: 0.4 }, { f: nf('C7'), t: 0.015, d: 0.55, v: 0.14, fm: [2.7, 1.6, 0.2] }, { f: nf('G7'), t: 0.02, d: 0.35, v: 0.06 }] },
    block:       { rv: 0.2, L: cat(metal(880, 0.3, 0.15), [{ n: 1, f: 2400, q: 2, d: 0.05, v: 0.4 }, { f: [300, 180], d: 0.06, v: 0.25 }]) },
    player_hurt: { rv: 0.06, L: [{ f: [125, 42], fs: 0.12, d: 0.26, v: 0.65 }, { n: 1, ft: 'lowpass', f: [1900, 220], d: 0.18, v: 0.45 }, { w: 'sawtooth', f: [230, 115], d: 0.16, v: 0.1, lp: 900 }] },
    player_die:  { rv: 0.45, L: [{ w: 'sawtooth', f: [440, 55], d: 1.6, v: 0.2, lp: [3000, 300], e: 'lin' }, { w: 'square', f: [466, 58], d: 1.6, v: 0.09, lp: 1400, e: 'lin' }, { f: [110, 30], d: 1.3, v: 0.4 }, { n: 1, ft: 'lowpass', f: [1300, 100], d: 1.2, v: 0.2 }, { f: nf('D5'), t: 0.35, d: 1.6, v: 0.1, fm: [1.41, 2, 1] }] },
    heal:        { rv: 0.4, L: [{ f: nf('C6'), ar: [0, 4, 7, 12, 16, 19], st: 0.055, d: 0.4, v: 0.14, fm: [2, 0.6, 0.3] }, { n: 1, ft: 'highpass', f: [3000, 7000], a: 0.15, d: 0.6, v: 0.08, e: 'swell' }, { w: 'triangle', f: [523, 1046], d: 0.5, v: 0.08, vib: [7, 25] }] },
    mp_restore:  { rv: 0.35, L: [{ f: [440, 880], d: 0.55, v: 0.16, vib: [8, 30] }, { w: 'triangle', f: [660, 1320], t: 0.05, d: 0.5, v: 0.08 }, { f: nf('G5'), ar: [0, 5, 12, 17], st: 0.07, t: 0.05, d: 0.35, v: 0.1, fm: [3, 0.5] }] },
    level_up:    { rv: 0.35, L: cat([{ w: 'square', f: nf('C5'), ar: [0, 4, 7, 12], st: 0.09, d: 0.18, v: 0.1, lp: 3500 }, { w: 'sawtooth', f: nf('C5'), ar: [0, 4, 7, 12], st: 0.09, d: 0.18, v: 0.06, lp: 2500 }],
                   brass(0.38, 'C5', 0.8, 0.06), brass(0.38, 'E5', 0.8, 0.05), brass(0.38, 'G5', 0.8, 0.05), brass(0.38, 'C6', 0.8, 0.045),
                   [{ f: nf('C7'), t: 0.38, ar: [0, 7, 12, 16, 19, 24], st: 0.05, d: 0.3, v: 0.06 }, { n: 1, ft: 'highpass', f: 6000, t: 0.38, a: 0.1, d: 0.8, v: 0.06, e: 'swell' }]) },
    status_poison: { rv: 0.15, L: [{ f: [420, 260], d: 0.12, v: 0.22, rep: [4, 0.1], rnd: 180 }, { w: 'sawtooth', f: [210, 150], d: 0.55, v: 0.07, lp: 600, vib: [6, 60] }] },
    status_curse:  { rv: 0.4, L: [{ w: 'sawtooth', f: [220, 207], d: 0.85, v: 0.1, lp: 900, vib: [5, 40] }, { w: 'sawtooth', f: [311, 293], d: 0.85, v: 0.08, lp: 900 }, { n: 1, f: [300, 150], q: 4, a: 0.2, d: 0.75, v: 0.22, e: 'swell' }, { f: [90, 70], d: 0.8, v: 0.2 }] },
    petrify:     { rv: 0.2, L: [{ n: 1, f: [1600, 500], q: 2, d: 0.12, v: 0.3, rep: [6, 0.075], rnd: 300 }, { w: 'sawtooth', f: [190, 85], d: 0.7, v: 0.13, lp: 500 }, { f: [120, 60], d: 0.6, v: 0.2 }] },
    // ---- enemies
    enemy_die:     { rv: 0.15, L: [{ n: 1, ft: 'lowpass', f: [3200, 300], d: 0.38, v: 0.45 }, { w: 'square', f: [620, 80], d: 0.3, v: 0.12, lp: 2000 }, { f: [210, 50], d: 0.22, v: 0.3 }] },
    enemy_die_big: { rv: 0.3, L: [{ n: 1, ft: 'lowpass', f: [4000, 200], d: 0.8, v: 0.6 }, { f: [150, 32], fs: 0.5, d: 0.7, v: 0.55 }, { w: 'square', f: [500, 60], d: 0.6, v: 0.1, lp: 1500 }, { n: 1, f: [1200, 300], q: 1, t: 0.12, d: 0.5, v: 0.3 }] },
    explosion:   { rv: 0.35, L: [{ n: 1, ft: 'lowpass', f: [4200, 180], d: 0.95, v: 0.75 }, { f: [120, 30], fs: 0.4, d: 0.7, v: 0.6 }, { n: 1, f: [1100, 300], q: 1, d: 0.55, v: 0.3 }, { n: 1, ft: 'highpass', f: 3000, d: 0.08, v: 0.25 }] },
    fireball:    { rv: 0.15, L: [{ n: 1, f: [600, 1500], q: 1.1, a: 0.04, d: 0.38, v: 0.4, e: 'swell' }, { n: 1, ft: 'lowpass', f: [2500, 800], d: 0.3, v: 0.2, tr: [22, 0.8] }, { w: 'sawtooth', f: [300, 150], d: 0.25, v: 0.06, lp: 800 }] },
    projectile:  { rv: 0.08, L: [{ w: 'square', f: [1200, 480], d: 0.13, v: 0.1, lp: 3000 }, { n: 1, f: [3200, 1500], q: 3, d: 0.11, v: 0.16 }] },
    magic_cast:  { rv: 0.4, L: [{ f: [400, 1250], d: 0.5, v: 0.16, fm: [1.5, 2, 0.4] }, { n: 1, ft: 'highpass', f: [2000, 6500], a: 0.12, d: 0.5, v: 0.1, e: 'swell' }, { w: 'triangle', f: [800, 2400], t: 0.05, d: 0.4, v: 0.06, vib: [9, 40] }] },
    bone_rattle: { rv: 0.12, L: [{ n: 1, f: 2300, q: 6, d: 0.03, v: 0.35, rep: [7, 0.034], rnd: 450 }, { w: 'square', f: 900, d: 0.02, v: 0.05, rep: [5, 0.047], rnd: 300, lp: 3000 }] },
    ghost_wail:  { rv: 0.6, L: [{ f: [480, 720, 560], a: 0.3, d: 1.1, v: 0.18, vib: [5, 60], e: 'swell' }, { w: 'triangle', f: [720, 1080, 840], a: 0.35, d: 1.1, v: 0.07, vib: [5.5, 80], e: 'swell' }, { n: 1, f: [800, 600], q: 5, a: 0.3, d: 1, v: 0.12, e: 'swell' }] },
    bat_screech: { rv: 0.15, L: [{ w: 'square', f: [3000, 4300], d: 0.075, v: 0.06, lp: 7000, rep: [3, 0.07] }, { w: 'sawtooth', f: [2600, 3900], d: 0.075, v: 0.04, rep: [3, 0.07], lp: 8000 }] },
    slime:       { rv: 0.06, L: [{ f: [320, 110], d: 0.17, v: 0.4, vib: [28, 300] }, { n: 1, ft: 'lowpass', f: [1500, 300], d: 0.15, v: 0.2 }, { f: [180, 260], t: 0.1, d: 0.08, v: 0.15 }] },
    page_flutter:{ rv: 0.15, L: [{ n: 1, f: 3600, q: 1.4, d: 0.03, v: 0.24, rep: [9, 0.028], rnd: 700 }, { n: 1, ft: 'highpass', f: 6000, a: 0.05, d: 0.27, v: 0.05, e: 'swell' }] },
    ink_splash:  { rv: 0.12, L: [{ n: 1, ft: 'lowpass', f: [2600, 400], d: 0.26, v: 0.42 }, { f: [720, 190], d: 0.13, v: 0.24 }, { n: 1, f: 1900, q: 4, t: 0.05, d: 0.06, v: 0.18, rep: [3, 0.05], rnd: 600 }] },
    roar:        { rv: 0.4, L: [{ w: 'sawtooth', f: [105, 82, 70], a: 0.12, d: 1.5, v: 0.26, lp: [500, 1500, 700], vib: [17, 90] }, { w: 'sawtooth', f: [111, 86, 74], a: 0.12, d: 1.5, v: 0.2, lp: 900, vib: [13, 70] }, { n: 1, f: [480, 300], q: 1, a: 0.12, d: 1.5, v: 0.5, e: 'swell' }, { f: [58, 40], d: 1.4, v: 0.45 }] },
    boss_die:    { rv: 0.45, L: cat(boomAt(0, 1, 1), boomAt(0.28, 0.8, 1.2), boomAt(0.55, 0.85, 0.9), boomAt(0.82, 0.75, 1.3), boomAt(1.1, 0.9, 1), boomAt(1.45, 1.1, 0.8),
                   [{ n: 1, ft: 'lowpass', f: [600, 80], a: 0.3, d: 2.4, v: 0.4, e: 'swell' }, { f: [70, 28], t: 1.45, d: 1, v: 0.5 }]) },
    gear:        { rv: 0.2, L: cat([{ w: 'square', f: 180, d: 0.06, v: 0.16, lp: 2000 }], metal(950, 0.12, 0.08), [{ n: 1, f: 2600, q: 5, t: 0.07, d: 0.035, v: 0.25, rep: [3, 0.05] }]) },
    water_splash:{ rv: 0.25, L: [{ n: 1, ft: 'lowpass', f: [5200, 800], d: 0.55, v: 0.4 }, { n: 1, f: [1300, 400], q: 2, d: 0.32, v: 0.25 }, { f: [1500, 2600], t: 0.1, d: 0.05, v: 0.1, rep: [4, 0.07], rnd: 700 }] },
    thunder:     { rv: 0.5, L: [{ n: 1, ft: 'highpass', f: 2500, d: 0.12, v: 0.35 }, { n: 1, ft: 'lowpass', f: [2200, 150], d: 2.6, v: 0.7 }, { n: 1, ft: 'lowpass', f: [500, 80], t: 0.15, a: 0.25, d: 3.2, v: 0.6, e: 'swell' }, { f: [52, 30], t: 0.05, d: 2.2, v: 0.3 }] },
    stomp:       { rv: 0.15, L: [{ f: [95, 34], fs: 0.12, d: 0.32, v: 0.8 }, { n: 1, ft: 'lowpass', f: [800, 100], d: 0.25, v: 0.5 }] },
    // ---- world / pickups
    heart:       { rv: 0.15, L: [{ w: 'square', f: nf('E6'), d: 0.06, v: 0.1, lp: 6000 }, { w: 'square', f: nf('B6'), t: 0.06, d: 0.14, v: 0.1, lp: 6000 }, { f: nf('B6'), t: 0.06, d: 0.2, v: 0.08 }] },
    heart_big:   { rv: 0.25, L: [{ w: 'square', f: nf('E6'), ar: [0, 4, 7, 12], st: 0.055, d: 0.12, v: 0.09, lp: 6000 }, { f: nf('E7'), t: 0.22, d: 0.4, v: 0.1, fm: [2, 0.8, 0.3] }, { n: 1, ft: 'highpass', f: 6000, t: 0.15, d: 0.3, v: 0.05 }] },
    gold:        { rv: 0.2, L: [{ w: 'square', f: nf('B6'), d: 0.05, v: 0.08, lp: 7000 }, { w: 'square', f: nf('E7'), t: 0.05, d: 0.28, v: 0.08, lp: 7000 }, { f: nf('E7'), t: 0.05, d: 0.3, v: 0.06, fm: [1.41, 1.2, 0.2] }] },
    item_get:    { rv: 0.35, L: [{ f: nf('G5'), ar: [0, 4, 7, 12], st: 0.07, d: 0.6, v: 0.16, fm: [3.5, 1.4, 0.4] }, { w: 'triangle', f: nf('G4'), t: 0.21, d: 0.6, v: 0.1, vib: [5, 10], e: 'flat' }, { w: 'triangle', f: nf('D5'), t: 0.21, d: 0.6, v: 0.08, e: 'flat' }] },
    relic_get:   { rv: 0.45, L: cat([{ w: 'sawtooth', f: nf('D4'), ar: [0, 7, 12], st: 0.16, d: 0.25, v: 0.08, lp: 2500 }],
                   brass(0.5, 'D5', 1.4, 0.05), brass(0.5, 'F#5', 1.4, 0.045), brass(0.5, 'A5', 1.4, 0.045), brass(0.5, 'D6', 1.4, 0.035),
                   [{ f: nf('D6'), t: 0.5, d: 1.6, v: 0.12, fm: [3.5, 2, 0.8] }, { n: 1, ft: 'highpass', f: [4000, 8000], t: 0.4, a: 0.4, d: 1.6, v: 0.07, e: 'swell' }, { f: [110, 73], t: 0.5, d: 0.8, v: 0.35 }]) },
    door:        { rv: 0.35, L: [{ w: 'sawtooth', f: [95, 80, 110], d: 0.7, v: 0.09, bp: 600, q: 3, vib: [11, 40] }, { n: 1, f: [400, 900], q: 4, a: 0.1, d: 0.7, v: 0.12 }, { f: [90, 40], t: 0.72, d: 0.35, v: 0.6 }, { n: 1, ft: 'lowpass', f: [1200, 150], t: 0.72, d: 0.3, v: 0.4 }] },
    break_wall:  { rv: 0.3, L: [{ f: [110, 40], d: 0.4, v: 0.55 }, { n: 1, ft: 'lowpass', f: [2500, 300], d: 0.5, v: 0.45 }, { n: 1, f: 1200, q: 2, t: 0.08, d: 0.07, v: 0.3, rep: [8, 0.06], rnd: 700 }, { f: [200, 90], t: 0.1, d: 0.08, v: 0.2, rep: [5, 0.09], rnd: 500 }] },
    candle_break:{ rv: 0.15, L: [{ n: 1, ft: 'highpass', f: 5000, d: 0.05, v: 0.3 }, { f: nf('E7'), d: 0.18, v: 0.05, rep: [3, 0.03], rnd: 500 }, { n: 1, f: [900, 2600], q: 0.8, a: 0.02, d: 0.22, v: 0.3, e: 'swell' }] },
    save:        { rv: 0.6, L: cat(choirTone(0, 'D4', 2.1, 0.07), choirTone(0.05, 'F#4', 2.05, 0.06), choirTone(0.1, 'A4', 2.0, 0.06), choirTone(0.15, 'D5', 1.95, 0.05),
                   [{ f: nf('A5'), d: 2, v: 0.12, fm: [3.5, 2, 0.8] }, { f: nf('D6'), t: 0.15, d: 1.8, v: 0.08, fm: [3.5, 2, 0.8] }, { n: 1, ft: 'highpass', f: 6000, a: 0.6, d: 2, v: 0.05, e: 'swell' }]) },
    teleport:    { rv: 0.45, L: [{ f: [200, 2200], d: 0.65, v: 0.18, vib: [12, 90] }, { w: 'sawtooth', f: [100, 1100], d: 0.65, v: 0.05, lp: 3000 }, { n: 1, f: [300, 5000], q: 2, a: 0.2, d: 0.65, v: 0.2, e: 'swell' }, { f: nf('A6'), t: 0.55, d: 0.5, v: 0.08, fm: [2, 1] }] },
    portal:      { rv: 0.55, L: [{ f: [60, 140, 50], a: 0.3, d: 1.4, v: 0.35, e: 'swell' }, { n: 1, f: [200, 1800, 300], q: 1.5, a: 0.4, d: 1.3, v: 0.35, e: 'swell' }, { w: 'sawtooth', f: [110, 220], a: 0.4, d: 1.2, v: 0.05, lp: 800, vib: [4, 30], e: 'swell' },
                   { f: nf('F5'), t: 0.3, ar: [0, 3, 7, 12, 15], st: 0.12, d: 0.8, v: 0.08, fm: [3.5, 1.5, 0.5] }, { n: 1, f: 3400, q: 1.4, t: 1.0, d: 0.03, v: 0.22, rep: [7, 0.03], rnd: 600 }, { n: 1, ft: 'highpass', f: 5000, t: 1.05, a: 0.05, d: 0.25, v: 0.08, e: 'swell' }] },
    secret:      { rv: 0.45, L: [{ w: 'triangle', f: nf('C5'), ar: [0, 3, 7, 11, 14], st: 0.09, d: 0.5, v: 0.14 }, { f: nf('C6'), ar: [0, 3, 7, 11, 14], st: 0.09, d: 0.45, v: 0.06, fm: [3, 1, 0.3] }, { n: 1, ft: 'highpass', f: 7000, t: 0.35, a: 0.1, d: 0.5, v: 0.05, e: 'swell' }] },
    chest:       { rv: 0.25, L: [{ w: 'sawtooth', f: [180, 240], d: 0.25, v: 0.06, bp: 900, q: 4, vib: [15, 40] }, { w: 'square', f: [300, 200], t: 0.26, d: 0.05, v: 0.12, lp: 1800 }, { n: 1, ft: 'lowpass', f: 900, t: 0.26, d: 0.08, v: 0.3 }, { f: nf('E6'), t: 0.32, ar: [0, 7, 12], st: 0.06, d: 0.3, v: 0.08, fm: [3, 1] }] },
    seal_break:  { rv: 0.55, L: [{ n: 1, ft: 'highpass', f: 4000, d: 0.35, v: 0.35 }, { f: 3000, d: 0.15, v: 0.06, rep: [8, 0.025], rnd: 1200 }, { f: nf('A5'), t: 0.05, d: 1.6, v: 0.12, fm: [3.5, 1.8, 0.6] }, { f: nf('E6'), t: 0.12, d: 1.4, v: 0.1, fm: [3.5, 1.5, 0.5] }, { f: nf('C#6'), t: 0.2, d: 1.3, v: 0.08 }] },
    lever:       { rv: 0.15, L: [{ w: 'square', f: [400, 250], d: 0.04, v: 0.14, lp: 2500 }, { n: 1, f: 1800, q: 3, d: 0.03, v: 0.3 }, { f: [140, 70], t: 0.08, d: 0.15, v: 0.45 }, { n: 1, ft: 'lowpass', f: 700, t: 0.08, d: 0.1, v: 0.25 }] },
    // ---- subweapons / spells
    dagger_throw:{ rv: 0.05, L: [{ n: 1, f: [3200, 6400], q: 3, a: 0.012, d: 0.11, v: 0.35, e: 'swell' }, { f: [2600, 1800], d: 0.06, v: 0.06 }] },
    axe_throw:   { rv: 0.08, L: [{ n: 1, f: 1300, q: 2, a: 0.03, d: 0.07, v: 0.3, e: 'swell', rep: [6, 0.075] }, { w: 'sawtooth', f: [200, 150], d: 0.45, v: 0.04, lp: 700, tr: [13, 0.9] }] },
    holy_water:  { rv: 0.25, L: [{ f: 2800, d: 0.12, v: 0.07, rep: [3, 0.04], rnd: 600 }, { n: 1, ft: 'highpass', f: 4000, d: 0.06, v: 0.25 }, { n: 1, f: [500, 1300], q: 0.9, t: 0.08, a: 0.08, d: 0.6, v: 0.4, e: 'swell' }, { n: 1, ft: 'lowpass', f: 2000, t: 0.1, d: 0.5, v: 0.15, tr: [25, 0.9] }] },
    cross_throw: { rv: 0.25, L: [{ w: 'sawtooth', f: 230, d: 0.7, v: 0.06, lp: 1200, tr: [11, 0.9] }, { f: 460, d: 0.7, v: 0.12, tr: [11, 0.9], vib: [11, 30] }, { n: 1, f: [2500, 1500], q: 3, d: 0.12, v: 0.2 }] },
    stopwatch:   { rv: 0.7, L: [{ n: 1, ft: 'highpass', f: 5000, d: 0.015, v: 0.5 }, { n: 1, ft: 'highpass', f: 4200, t: 0.12, d: 0.015, v: 0.45 }, { f: nf('E6'), t: 0.2, a: 0.4, d: 1.4, v: 0.08, e: 'swell', vib: [3, 20] }, { f: nf('A6'), t: 0.2, a: 0.4, d: 1.4, v: 0.06, e: 'swell' }, { f: [880, 440], t: 0.2, d: 1.2, v: 0.06, fm: [1.5, 3, 1] }] },
    quill_throw: { rv: 0.05, L: [{ n: 1, f: [4500, 8000], q: 4, a: 0.01, d: 0.08, v: 0.35, e: 'swell' }, { f: [3000, 2200], d: 0.05, v: 0.05 }] },
    ink_bottle:  { rv: 0.15, L: [{ f: 2600, d: 0.1, v: 0.07, rep: [2, 0.035], rnd: 500 }, { n: 1, ft: 'highpass', f: 3500, d: 0.05, v: 0.25 }, { n: 1, ft: 'lowpass', f: [2400, 400], t: 0.06, d: 0.3, v: 0.4 }, { f: [600, 180], t: 0.06, d: 0.12, v: 0.2 }] },
    page_orbit:  { rv: 0.4, L: [{ n: 1, f: 3200, q: 1.5, d: 0.03, v: 0.18, rep: [10, 0.04], rnd: 600 }, { f: nf('E6'), a: 0.1, d: 0.6, v: 0.06, vib: [7, 40], e: 'swell' }, { f: nf('B6'), t: 0.1, a: 0.1, d: 0.5, v: 0.04, vib: [6, 40], e: 'swell' }] },
    spell_fire:  { rv: 0.3, L: [{ n: 1, ft: 'lowpass', f: [800, 3000, 600], a: 0.08, d: 0.8, v: 0.55, e: 'swell' }, { n: 1, f: 2000, q: 1, d: 0.7, v: 0.2, tr: [28, 0.9] }, { w: 'sawtooth', f: [90, 60], d: 0.7, v: 0.1, lp: 500 }] },
    spell_dark:  { rv: 0.45, L: [{ w: 'sawtooth', f: [220, 110], d: 0.9, v: 0.1, lp: [1500, 400] }, { w: 'sawtooth', f: [233, 116], d: 0.9, v: 0.08, lp: 1200 }, { f: [110, 50], d: 0.9, v: 0.3 }, { n: 1, f: [1200, 200], q: 2, a: 0.1, d: 0.8, v: 0.25, e: 'swell' }] },
    spell_spirit:{ rv: 0.6, L: [{ f: [300, 900], a: 0.15, d: 0.9, v: 0.16, vib: [6, 50], e: 'swell' }, { w: 'triangle', f: [450, 1350], a: 0.2, d: 0.9, v: 0.06, vib: [7, 60], e: 'swell' }, { n: 1, f: [600, 2400], q: 3, a: 0.2, d: 0.9, v: 0.14, e: 'swell' }] },
    spell_soul_steal: { rv: 0.5, L: [{ w: 'sawtooth', f: [900, 60], d: 1.5, v: 0.12, lp: [4000, 200], e: 'lin' }, { f: [300, 40], d: 1.5, v: 0.3, e: 'lin' }, { n: 1, f: [3000, 150], q: 2, a: 0.4, d: 1.5, v: 0.3, e: 'swell' }, { f: nf('D5'), a: 0.5, d: 1.4, v: 0.06, vib: [5, 80], e: 'swell' }] },
    spell_holy:  { rv: 0.6, L: [{ f: nf('D6'), ar: [0, 4, 7, 12, 16, 19, 24], st: 0.045, d: 0.7, v: 0.1, fm: [3.5, 1.5, 0.4] }, { w: 'triangle', f: nf('D5'), a: 0.1, d: 0.9, v: 0.08, e: 'swell' }, { w: 'triangle', f: nf('A5'), a: 0.1, d: 0.9, v: 0.06, e: 'swell' }, { n: 1, ft: 'highpass', f: 6000, a: 0.1, d: 0.8, v: 0.07, e: 'swell' }] },
    spell_ink:   { rv: 0.3, L: [{ w: 'sawtooth', f: [210, 185], d: 0.75, v: 0.13, lp: [500, 3200], vib: [30, 40], e: 'flat' }, { n: 1, f: [600, 2200], q: 3, d: 0.75, v: 0.2, e: 'flat' }, { w: 'square', f: [105, 92], d: 0.75, v: 0.05, lp: 600, e: 'flat' }] },
    // ---- forms
    transform:   { rv: 0.4, L: [{ n: 1, ft: 'lowpass', f: [3000, 500], d: 0.45, v: 0.45 }, { f: [200, 1600], d: 0.35, v: 0.14 }, { f: nf('A6'), t: 0.12, ar: [0, 7, 12], st: 0.05, d: 0.3, v: 0.07 }, { n: 1, ft: 'highpass', f: 6000, t: 0.05, d: 0.35, v: 0.08 }] },
    bat_flap:    { v: 0.8, rv: 0.05, L: [{ n: 1, ft: 'lowpass', f: 900, a: 0.01, d: 0.06, v: 0.18, rep: [2, 0.08] }] },
    mist:        { rv: 0.4, L: [{ n: 1, ft: 'highpass', f: [3000, 6000], a: 0.25, d: 0.85, v: 0.25, e: 'swell' }, { n: 1, f: [1500, 800], q: 2, a: 0.3, d: 0.85, v: 0.1, e: 'swell' }] },
    wolf_howl:   { rv: 0.5, L: [{ w: 'sawtooth', f: [330, 620, 520, 420], a: 0.15, d: 1.1, v: 0.12, bp: [900, 1300, 1000], q: 3, vib: [5.5, 30], e: 'swell' }, { f: [330, 620, 520, 420], a: 0.15, d: 1.1, v: 0.15, vib: [5.5, 30], e: 'swell' }, { n: 1, f: [1000, 1600, 1200], q: 6, a: 0.15, d: 1.1, v: 0.06, e: 'swell' }] },
    wolf_dash:   { rv: 0.08, L: [{ n: 1, f: [600, 2500], q: 1.2, a: 0.03, d: 0.22, v: 0.4, e: 'swell' }, { w: 'sawtooth', f: [120, 90], d: 0.25, v: 0.08, lp: 500, vib: [25, 80] }] },
    // ---- misc
    fanfare:     { rv: 0.4, L: cat(brass(0, 'G4', 0.14, 0.07), brass(0.15, 'C5', 0.14, 0.07), brass(0.3, 'E5', 0.14, 0.07), brass(0.45, 'G5', 0.5, 0.07),
                   brass(1.0, 'F5', 0.16, 0.07), brass(1.17, 'A5', 0.16, 0.07), brass(1.34, 'C6', 1.6, 0.06), brass(1.34, 'G5', 1.6, 0.045), brass(1.34, 'E5', 1.6, 0.045), brass(1.34, 'C5', 1.6, 0.045),
                   [{ f: [110, 73], d: 0.6, v: 0.35 }, { f: [110, 73], t: 0.45, d: 0.6, v: 0.3 }, { f: [131, 87], t: 1.34, d: 1.2, v: 0.4 }, { n: 1, ft: 'highpass', f: 4500, t: 1.34, d: 1.6, v: 0.07 }]) },
    low_health:  { v: 0.8, L: [{ f: [75, 45], d: 0.13, v: 0.32 }, { f: [68, 42], t: 0.2, d: 0.15, v: 0.26 }] }
  };
  var SFX_NAMES = Object.keys(SFX);

  function playSfx(o, def, t, opts, rng) {
    opts = opts || {};
    var c = o.ctx;
    var out = gainNode(c, clamp(opts.vol == null ? 1 : opts.vol, 0, 2) * (def.v || 1)), nodes = [out], node = out;
    var pan = clamp(opts.pan || 0, -1, 1);
    if (pan && c.createStereoPanner) { var sp = c.createStereoPanner(); sp.pan.value = pan; out.connect(sp); node = sp; nodes.push(sp); }
    node.connect(o.sfxDry);
    if (def.rv) { var snd = gainNode(c, def.rv); node.connect(snd); snd.connect(o.sfxWet); nodes.push(snd); }
    var last = renderLayers(o, out, def.L, t, 1, clamp(opts.pitch == null ? 1 : opts.pitch, 0.25, 4), rng || Math.random);
    o.sfxVoices++;
    var fin = false;
    function done() { if (fin) return; fin = true; o.sfxVoices--; disc(nodes); }
    if (last.src) onEnd(last.src, done);
    if (o.live) setTimeout(done, Math.max(0, last.end - c.currentTime) * 1000 + 1500);
    return last.end;
  }

  // ------------------------------------------------------------- scheduler
  function isHidden() { try { return !!(root.document && root.document.hidden); } catch (e) { return false; } }
  function tick() {
    if (!ctx || !g) return;
    try {
      if (ctx.state !== 'running') return;
      if (pending && unlocked && md()) { var pd = pending; pending = null; curId = null; playMusic(pd.id, pd.opts); }
      var t = ctx.currentTime, ahead = t + (isHidden() ? LOOKAHEAD_HIDDEN : LOOKAHEAD);
      if (cur) {
        cur.tick(t, ahead);
        if (cur.done && t > cur.endTime + 4 && cur.all.length) cur.dispose(); // finished one-shot track
      }
      for (var i = fading.length - 1; i >= 0; i--) {
        var p = fading[i];
        if (t >= p.stopAt + 3.5) { p.dispose(); fading.splice(i, 1); }
        else p.tick(t, ahead);
      }
    } catch (e) { warnOnce('tick', 'scheduler error: ' + (e && e.message)); }
  }
  function startTimer() {
    if (timer) return;
    try { timer = setInterval(tick, TICK_MS); } catch (e) { timer = null; }
  }

  // ------------------------------------------------------------- music API
  function startTrack(id, opts) {
    var m = md(), comp = m.compile(id);
    if (!comp) return false;
    var t = ctx.currentTime, fade = opts.fade == null ? 1.0 : Math.max(0, +opts.fade || 0), prev = cur;
    if (prev) { prev.stop(t, fade); fading.push(prev); }
    var p = new Player(g, comp, id, t + 0.06);
    p.level(1, t, prev ? fade : (opts.fade != null ? fade : 0.02));
    cur = p;
    p.tick(t, t + LOOKAHEAD);
    return true;
  }
  function playMusic(id, opts) {
    opts = opts || {};
    var m = md();
    if (!m || !m.tracks || !Object.prototype.hasOwnProperty.call(m.tracks, id)) {
      if (!m) { pending = { id: id, opts: opts }; curId = id; return false; } // data not loaded yet: remember
      warnOnce('music:' + id, 'unknown music id "' + id + '"');
      stopMusic(opts.fade);
      return false;
    }
    if (curId === id && !opts.restart) return true;
    curId = id;
    if (!ctx || !g || !unlocked) { pending = { id: id, opts: opts }; return true; }
    pending = null;
    return startTrack(id, opts);
  }
  function stopMusic(fade) {
    fade = fade == null ? 1.0 : Math.max(0, +fade || 0);
    pending = null; curId = null;
    if (cur && ctx) { cur.stop(ctx.currentTime, fade); fading.push(cur); }
    cur = null;
  }
  function duck(on) {
    ducked = !!on;
    if (g) { ramp(g.musicDry.gain, musicLevel(), 0.12); ramp(g.musicWet.gain, musicLevel(), 0.12); }
  }

  // ------------------------------------------------------------- volumes
  var KINDS = { master: 1, music: 1, sfx: 1, voice: 1 };
  function setVolume(kind, v) {
    if (!KINDS[kind]) { warnOnce('vol:' + kind, 'unknown volume kind "' + kind + '"'); return; }
    vol[kind] = clamp(v, 0, 1);
    if (g) {
      if (kind === 'master') ramp(g.master.gain, vol.master, 0.05);
      else if (kind === 'music') { ramp(g.musicDry.gain, musicLevel(), 0.05); ramp(g.musicWet.gain, musicLevel(), 0.05); }
      else if (kind === 'sfx') { ramp(g.sfxDry.gain, vol.sfx, 0.05); ramp(g.sfxWet.gain, vol.sfx, 0.05); }
    }
    if ((kind === 'voice' || kind === 'master') && !(vol.voice > 0 && vol.master > 0) && curSpeech) curSpeech.toTimer();
  }
  function getVolume(kind) { return KINDS[kind] ? vol[kind] : 0; }

  // ------------------------------------------------------------- SFX API
  var sfxRng = mkRng(4242);
  function sfx(name, opts) {
    if (!Object.prototype.hasOwnProperty.call(SFX, name)) { warnOnce('sfx:' + name, 'unknown sfx "' + name + '"'); return false; }
    if (!ctx || !g || !unlocked || ctx.state !== 'running') return false;
    var t = ctx.currentTime, last = lastSfx[name];
    if (last != null && t >= last && t - last < SFX_GAP) return false;
    if (g.sfxVoices >= MAX_SFX) return false;
    lastSfx[name] = t;
    playSfx(g, SFX[name], t + 0.004, opts, sfxRng);
    return true;
  }

  // ------------------------------------------------------------- unlock
  function unlock() {
    var AC = ACclass();
    if (!AC) return false;
    try {
      if (!ctx) {
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
        g = buildGraph(ctx, true, false);
        startTimer();
      }
      if (ctx.state !== 'running' && ctx.resume) {
        var pr = ctx.resume();
        if (pr && pr.catch) pr.catch(function () { /* needs another gesture */ });
      }
      try { // iOS: play one silent sample inside the gesture
        var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination); s.start(0);
      } catch (e) { /* ignore */ }
      unlocked = true;
      if (pending) { var p = pending; pending = null; curId = null; playMusic(p.id, p.opts); }
    } catch (e) {
      warnOnce('unlock', 'Web Audio unavailable: ' + (e && e.message));
      return false;
    }
    return true;
  }

  // ------------------------------------------------------------- speech (TTS)
  var synth = null;
  try { synth = root.speechSynthesis || null; } catch (e) { synth = null; }
  var voiceEnabled = true, voicesCache = null, speakerVoice = {}, curSpeech = null, lastCancel = 0;
  function resetVoices() { voicesCache = null; speakerVoice = {}; }
  if (synth) {
    try {
      if (synth.addEventListener) synth.addEventListener('voiceschanged', resetVoices);
      else synth.onvoiceschanged = resetVoices;
    } catch (e) { /* ignore */ }
  }
  function enVoices() {
    if (!synth) return [];
    if (voicesCache && voicesCache.length) return voicesCache;
    var vs = [];
    try { vs = synth.getVoices() || []; } catch (e) { vs = []; }
    var out = [];
    for (var i = 0; i < vs.length; i++) if (/^en([-_]|$)/i.test(vs[i].lang || '')) out.push(vs[i]);
    voicesCache = out;
    return out;
  }
  var SPEAKERS = {
    alucard:   { g: 'm', pitch: 0.75, rate: 0.9 },
    maria:     { g: 'f', pitch: 1.15, rate: 1.0 },
    richter:   { g: 'm', pitch: 0.95, rate: 1.0 },
    librarian: { g: 'm', pitch: 0.55, rate: 0.82 },
    scrivener: { g: 'm', pitch: 0.4, rate: 0.78 },
    echo:      { g: 'm', pitch: 0.6, rate: 0.85 },
    narrator:  { g: 'm', pitch: 0.85, rate: 0.9, gb: 1 },
    shout:     { g: 'm', pitch: 0.7, rate: 1.1 }
  };
  var FEMALE = /female|woman|samantha|serena|kate|hazel|susan|zira|libby|sonia|karen|moira|tessa|fiona|victoria|allison|\bava\b|emma|amy|joanna|kendra|kimberly|salli|ivy|olivia|jenny|aria|natasha|catherine|martha|stephanie|nicky|zoe|veena|linda|michelle|sara\b|maisie|abbi|bella|hollie/i;
  var MALE = /\bmale\b|\bman\b|daniel|arthur|george|david|mark|guy|ryan|james|thomas|oliver|fred\b|alex\b|\btom\b|brian|eric|aaron|rishi|gordon|\blee\b|matthew|joey|justin|russell|william|liam|christopher|andrew|roger|jamie|alfie|elliot|ethan|noah|thomas/i;
  function pickVoice(key) {
    if (Object.prototype.hasOwnProperty.call(speakerVoice, key)) return speakerVoice[key];
    var spk = SPEAKERS[key] || SPEAKERS.narrator, vs = enVoices(), best = null, bs = -1e9;
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i], lang = String(v.lang || '').toLowerCase().replace('_', '-'), name = String(v.name || '');
      var sc = lang === 'en-gb' ? 30 : (lang === 'en-us' ? 20 : 10);
      if (spk.gb && lang === 'en-gb') sc += 15;
      var isF = FEMALE.test(name), isM = !isF && MALE.test(name);
      if (spk.g === 'm') sc += isM ? 40 : (isF ? -40 : 0); else sc += isF ? 40 : (isM ? -40 : 0);
      if (v.localService) sc += 3;
      if (v['default']) sc += 1;
      if (sc > bs) { bs = sc; best = v; }
    }
    if (vs.length) speakerVoice[key] = best;
    return best;
  }
  function ttsUsable() {
    try { return !!(synth && root.SpeechSynthesisUtterance) && voiceEnabled && vol.voice > 0 && vol.master > 0 && enVoices().length > 0; }
    catch (e) { return false; }
  }
  function splitText(str) {
    if (str.length <= 180) return [str];
    var parts = str.match(/[^.!?;:]+[.!?;:]*["')\]]*\s*/g) || [str], out = [], buf = '';
    for (var i = 0; i < parts.length; i++) {
      var pt = parts[i];
      while (pt.length > 180) { // very long sentence: split at a space
        var k = pt.lastIndexOf(' ', 180); if (k < 40) k = 180;
        if (buf) { out.push(buf.trim()); buf = ''; }
        out.push(pt.slice(0, k).trim()); pt = pt.slice(k);
      }
      if ((buf + pt).length > 180 && buf) { out.push(buf.trim()); buf = ''; }
      buf += pt;
    }
    if (buf.trim()) out.push(buf.trim());
    return out.length ? out : [str];
  }
  function say(text, opts) {
    opts = opts || {};
    stopSpeech();
    var str = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    var key = SPEAKERS[opts.speaker] ? opts.speaker : 'narrator', spk = SPEAKERS[key];
    var est = Math.max(1200, 55 * str.length);
    var h = { done: false, started: false, speaking: false, ignore: false, timers: [], utts: [], t0: nowMs(), est: est };
    function clearT() { for (var i = 0; i < h.timers.length; i++) clearTimeout(h.timers[i]); h.timers = []; }
    function fireStart() { if (h.started || h.done) return; h.started = true; safeCall(opts.onstart); }
    function finish() {
      if (h.done) return;
      fireStart();
      h.done = true; clearT();
      if (curSpeech === h) curSpeech = null;
      safeCall(opts.onend);
    }
    function silenceTts() {
      h.ignore = true;
      if (h.speaking) { h.speaking = false; try { synth.cancel(); } catch (e) { /* ignore */ } lastCancel = nowMs(); }
    }
    h.cancel = function () {
      if (h.done) return;
      h.done = true; clearT(); silenceTts();
      if (curSpeech === h) curSpeech = null;
    };
    h.toTimer = function () { // switch to timer mode for the remaining estimated time
      if (h.done) return;
      silenceTts(); clearT();
      h.timers.push(setTimeout(fireStart, 0));
      h.timers.push(setTimeout(finish, Math.max(0, h.est - (nowMs() - h.t0))));
    };
    curSpeech = h;
    var handle = { cancel: function () { h.cancel(); } };
    if (!ttsUsable()) { h.toTimer(); return handle; }
    var voice = pickVoice(key);
    if (!voice) { h.toTimer(); return handle; }
    var chunks = splitText(str || ' '), idx = 0, volume = clamp(vol.voice * vol.master, 0, 1);
    h.speaking = true;
    function next() {
      if (h.done || h.ignore) return;
      if (idx >= chunks.length) { h.speaking = false; finish(); return; }
      var u;
      try { u = new root.SpeechSynthesisUtterance(chunks[idx++]); } catch (e) { h.toTimer(); return; }
      try { u.voice = voice; u.lang = voice.lang; } catch (e) { /* ignore */ }
      u.rate = spk.rate; u.pitch = spk.pitch; u.volume = volume;
      u.onstart = function () { if (!h.ignore) fireStart(); };
      u.onend = function () { if (!h.ignore && !h.done) next(); };
      u.onerror = function (ev) {
        if (h.ignore || h.done) return;
        var err = ev && ev.error;
        if ((err === 'interrupted' || err === 'canceled') && !h.speaking) return;
        h.toTimer();
      };
      h.utts.push(u); // keep references (Chrome may GC utterances and drop their events)
      try { synth.speak(u); } catch (e) { h.toTimer(); }
    }
    var safety = Math.max(1200, 55 * str.length / spk.rate) * 2 + 2000;
    h.timers.push(setTimeout(function () { if (!h.done) { silenceTts(); finish(); } }, safety));
    try { if (synth.paused) synth.resume(); } catch (e) { /* ignore */ }
    if (nowMs() - lastCancel < 100) h.timers.push(setTimeout(next, 60)); // Chrome drops speak() right after cancel()
    else next();
    return handle;
  }
  function stopSpeech() {
    if (curSpeech) { curSpeech.cancel(); curSpeech = null; }
  }
  function speechAvailable() {
    try { return !!(synth && root.SpeechSynthesisUtterance) && enVoices().length > 0; } catch (e) { return false; }
  }
  function setVoiceEnabled(on) {
    voiceEnabled = !!on;
    if (!voiceEnabled && curSpeech) curSpeech.toTimer();
  }

  // ------------------------------------------------------------- offline render (dev helper)
  function stats(buf) {
    var peak = 0, sum = 0, n = 0;
    for (var ch = 0; ch < buf.numberOfChannels; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < d.length; i++) { var x = d[i], a = x < 0 ? -x : x; if (a > peak) peak = a; sum += x * x; }
      n += d.length;
    }
    return { peak: peak, rms: n ? Math.sqrt(sum / n) : 0, seconds: buf.duration };
  }
  function renderOffline(kind, id, seconds, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var OAC = OACclass();
      if (!OAC) { resolve({ peak: 0, rms: 0, seconds: 0, error: 'OfflineAudioContext unavailable' }); return; }
      var sr = opts.sampleRate || 44100;
      seconds = Math.max(0.1, +seconds || (kind === 'music' ? 12 : 3));
      var oc;
      try { oc = new OAC(2, Math.ceil(sr * seconds), sr); } catch (e) { reject(e); return; }
      var og = buildGraph(oc, false, !!opts.raw);
      try {
        if (kind === 'music') {
          var m = md();
          if (!m || !m.tracks[id]) { reject(new Error('unknown music id ' + id)); return; }
          var p = new Player(og, m.compile(id), id, 0.05);
          p.level(1, 0, 0);
          p.schedule(seconds);
        } else if (kind === 'sfx') {
          if (!SFX[id]) { reject(new Error('unknown sfx ' + id)); return; }
          playSfx(og, SFX[id], 0.05, opts, mkRng(99));
        } else { reject(new Error('kind must be music or sfx')); return; }
      } catch (e) { reject(e); return; }
      var settled = false;
      function ok(b) { if (settled || !b) return; settled = true; resolve(stats(b)); }
      oc.oncomplete = function (ev) { ok(ev.renderedBuffer); };
      try {
        var pr = oc.startRendering();
        if (pr && pr.then) pr.then(ok, function (e) { if (!settled) { settled = true; reject(e); } });
      } catch (e) { reject(e); }
    });
  }

  // ------------------------------------------------------------- public API
  function guard(fn, fallback) {
    return function () {
      try { return fn.apply(null, arguments); }
      catch (e) { warnOnce('api:' + (fn.name || '?'), 'audio error: ' + (e && e.message)); return typeof fallback === 'function' ? fallback.apply(null, arguments) : fallback; }
    };
  }
  G.audio = {
    __elegy: true,
    unlock: guard(unlock, false),
    isUnlocked: guard(function () { return !!(ctx && unlocked); }, false),
    setVolume: guard(setVolume),
    getVolume: guard(getVolume, 0),
    playMusic: guard(playMusic, false),
    stopMusic: guard(stopMusic),
    currentMusic: guard(function () { return curId; }, null),
    duck: guard(duck),
    sfx: guard(sfx, false),
    say: guard(say, function (text, opts) { // never leave a cutscene hanging
      var o = opts || {}, done = false, ms = Math.max(1200, 55 * String(text || '').length);
      var tm = setTimeout(function () { if (!done) { done = true; safeCall(o.onstart); safeCall(o.onend); } }, ms);
      return { cancel: function () { done = true; clearTimeout(tm); } };
    }),
    stopSpeech: guard(stopSpeech),
    speechAvailable: guard(speechAvailable, false),
    setVoiceEnabled: guard(setVoiceEnabled),
    isVoiceEnabled: function () { return voiceEnabled; },
    listMusic: guard(function () { var m = md(); return m && m.order ? m.order.slice() : []; }, []),
    listSfx: guard(function () { return SFX_NAMES.slice(); }, []),
    trackName: guard(function (id) { var m = md(); return (m && m.tracks[id] && m.tracks[id].name) || id; }, ''),
    speakers: function () { return Object.keys(SPEAKERS); },
    _renderOffline: function (kind, id, seconds, opts) {
      try { return renderOffline(kind, id, seconds, opts); } catch (e) { return Promise.reject(e); }
    },
    _debug: function () {
      return { state: ctx ? ctx.state : 'none', time: ctx ? ctx.currentTime : 0, voices: g ? g.voices : 0, sfxVoices: g ? g.sfxVoices : 0,
        current: curId, fading: fading.length, ducked: ducked, pending: pending ? pending.id : null };
    }
  };
})();
