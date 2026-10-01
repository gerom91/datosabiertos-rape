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

  /*__SFX__*/
