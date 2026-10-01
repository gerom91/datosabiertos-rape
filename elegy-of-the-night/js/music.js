/*
 * Elegy of the Night — The Belmont Archives
 * music.js — original compositions + instrument presets (pure data + small helpers).
 * All melodies in this file are original works written for this fan project.
 *
 * NOTATION (melodic parts) — whitespace separated tokens, one token = one grid step:
 *   @0.5 / @1/3   set step length in beats (default: track.step or 0.5)
 *   C4 Eb3 F#5    note (octave required). Chord: D3+F3+A3
 *   X*3           token lasts 3 steps (fractions allowed: *1.5)
 *   .  /  .*4     rest      -   hold (extends previous note/rest by one step)
 *   suffix ! accent, ? soft, ' staccato, ~ full legato     e.g.  E5*2!'
 *   v0.7          velocity multiplier for following notes
 *   t-12          transpose following notes (semitones, within this pattern)
 *   |             bar line (checked against the meter by validate())
 * A pattern shorter than its section is looped to fill it.
 * DRUM parts (kit:1): {step:0.25, k:'X...x...', s:'....X...'} one char per step:
 *   X accent, x normal, o ghost, . rest  (lanes = keys of G.musicData.kit)
 */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var G = root.G = root.G || {};

  // ------------------------------------------------------------------ helpers
  function rep(s, n) { var o = []; for (var i = 0; i < n; i++) o.push(s); return o.join(' '); }
  function J() { return Array.prototype.slice.call(arguments).join(' '); }
  // drum lane: strip spaces/bars, pad with rests to n steps
  function pad(s, n) { s = String(s).replace(/[\s|]/g, ''); while (s.length < n) s += '.'; return s; }
  function lane(s) { return String(s).replace(/[\s|]/g, ''); }
  function lrep(s, n) { return rep(lane(s), n).replace(/\s/g, ''); }
  // broken-chord helpers (return token strings)
  function arp6(a, b, c, d) { return [a, b, c, d, c, b].join(' '); }           // 6 steps
  function alb(a, b, c) { return [a, c, b, c, b, c].join(' '); }                // 3/4 alberti, 6 steps
  function alb8(a, b, c) { return [a, c, b, c, a, c, b, c].join(' '); }         // 4/4 alberti, 8 steps
  function b8(lo, hi, last) { return [lo, lo, hi, lo, lo, lo, hi, last || lo].join(' '); }
  function stac(tok, n) { return rep(tok + "'", n); }

  var PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function noteNum(s) {
    var m = /^([A-Ga-g])(#|b)?(-?\d)$/.exec(s);
    if (!m) return null;
    return PC[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * (parseInt(m[3], 10) + 1);
  }
  function frac(s) {
    if (!s) return 1;
    var k = s.indexOf('/');
    return k >= 0 ? parseFloat(s.slice(0, k)) / parseFloat(s.slice(k + 1)) : parseFloat(s);
  }

  // parse a melodic pattern -> {ev:[{t,d,n:[midi],v,g}], len}
  function parsePattern(str, step, barLen, errs, where) {
    var ev = [], t = 0, vel = 1, tr = 0, last = null, bar = 0;
    var toks = String(str).split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (!tk) continue;
      if (tk === '|') {
        bar++;
        if (barLen && Math.abs(t / barLen - Math.round(t / barLen)) > 1e-6) {
          errs.push(where + ': bar line #' + bar + ' at beat ' + (+t.toFixed(3)) + ' not on a bar boundary');
        }
        continue;
      }
      var c0 = tk.charAt(0);
      if (c0 === '@') { step = frac(tk.slice(1)); continue; }
      if (c0 === 'v') { vel = parseFloat(tk.slice(1)); continue; }
      if (c0 === 't') { tr = parseInt(tk.slice(1), 10) || 0; continue; }
      var mods = /[!?'~]*$/.exec(tk)[0];
      var body = tk.slice(0, tk.length - mods.length);
      var mul = 1, k = body.indexOf('*');
      if (k >= 0) { mul = frac(body.slice(k + 1)); body = body.slice(0, k); }
      var len = step * mul;
      if (body === '.') { t += len; last = null; continue; }
      if (body === '-') { if (last) last.d += len; t += len; continue; }
      var names = body.split('+'), ns = [];
      for (var j = 0; j < names.length; j++) {
        var n = noteNum(names[j]);
        if (n == null) errs.push(where + ': bad token "' + tk + '"'); else ns.push(n + tr);
      }
      if (!ns.length) { t += len; continue; }
      var e = {
        t: t, d: len, n: ns,
        v: vel * (mods.indexOf('!') >= 0 ? 1.25 : (mods.indexOf('?') >= 0 ? 0.6 : 1)),
        g: mods.indexOf("'") >= 0 ? 0.42 : (mods.indexOf('~') >= 0 ? 1.0 : 0)
      };
      ev.push(e); last = e; t += len;
    }
    return { ev: ev, len: t };
  }

  function parseLane(str, step) {
    var ev = [], t = 0, s = String(str);
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === ' ' || ch === '|' || ch === '\n') continue;
      if (ch === 'X') ev.push({ t: t, v: 1 });
      else if (ch === 'x') ev.push({ t: t, v: 0.78 });
      else if (ch === 'o') ev.push({ t: t, v: 0.42 });
      t += step;
    }
    return { ev: ev, len: t };
  }

  // ------------------------------------------------------------ custom waves
  // harmonic amplitude tables (index 1 = fundamental) -> PeriodicWave in audio.js
  var waves = {
    organ:  [0, 1, 0.72, 0.42, 0.42, 0.1, 0.22, 0.04, 0.2, 0.03, 0.06, 0, 0.09, 0, 0, 0, 0.05],
    flute8: [0, 1, 0.32, 0.1, 0.12, 0.03, 0.04],
    reed:   [0, 1, 0.75, 0.62, 0.5, 0.42, 0.34, 0.26, 0.2, 0.15, 0.1, 0.07, 0.05],
    hollow: [0, 1, 0.05, 0.45, 0.04, 0.25, 0.02, 0.12, 0, 0.06]
  };

  // ------------------------------------------------------- instrument presets
  // osc:[{w:wave, d:detune cents, o:octave, r:ratio, g:gain}]  a/d/s/r: ADSR (s=0 -> percussive decay d)
  // lp:{f,kt:keytrack,env:Hz,ed:env decay,q,vel}  hp:Hz  vib:{r,d cents,dl delay}  pe:{c cents,t}
  // fm:{r ratio,i index,d decay}  ch: noise chiff {f,q,g,d}  fx: part-bus effects  gate: default gate
  var instruments = {
    organ:       { osc: [{ w: 'organ' }, { w: 'flute8', o: -1, g: 0.35 }], a: 0.035, s: 1, r: 0.25, lp: { f: 5200, kt: 0.15 }, ch: { f: 2800, q: 1.2, g: 0.08, d: 0.06 }, vib: { r: 6.2, d: 3 }, gain: 0.12, send: 0.35 },
    organ_full:  { osc: [{ w: 'organ' }, { w: 'organ', o: -1, g: 0.5 }, { w: 'flute8', o: 1, g: 0.3 }], a: 0.025, s: 1, r: 0.3, lp: { f: 6000, kt: 0.1 }, ch: { f: 3000, q: 1, g: 0.1, d: 0.05 }, gain: 0.09, send: 0.3 },
    organ_soft:  { osc: [{ w: 'flute8' }, { w: 'sine', o: 1, g: 0.16 }], a: 0.07, s: 1, r: 0.32, vib: { r: 5.6, d: 7 }, gain: 0.16, send: 0.45 },
    organ_pedal: { osc: [{ w: 'flute8' }, { w: 'sine', o: -1, g: 0.45 }], a: 0.06, s: 1, r: 0.3, lp: { f: 800 }, gain: 0.22, send: 0.2 },
    organ_lead:  { osc: [{ w: 'organ' }, { w: 'sine', o: 1, g: 0.25 }], a: 0.006, d: 0.5, s: 0.75, r: 0.09, ch: { f: 3200, q: 1, g: 0.14, d: 0.02 }, vib: { r: 6.8, d: 7 }, lp: { f: 4500, kt: 0.2 }, gain: 0.12, send: 0.25 },
    harpsichord: { osc: [{ w: 'sawtooth', g: 0.7 }, { w: 'square', o: 1, g: 0.2, d: 5 }], a: 0.002, d: 1.3, s: 0, r: 0.1, lp: { f: 2200, kt: 0.6, env: 4000, ed: 0.12, q: 1.2 }, hp: 200, gain: 0.19, gate: 1, send: 0.25 },
    piano:       { osc: [{ w: 'triangle' }, { w: 'sine', o: 1, g: 0.26 }, { w: 'sawtooth', g: 0.06 }], a: 0.004, d: 2.6, s: 0, r: 0.35, lp: { f: 1200, kt: 0.6, env: 2400, ed: 0.35, vel: 1 }, gain: 0.3, gate: 1, send: 0.3 },
    harp:        { osc: [{ w: 'triangle' }, { w: 'sine', o: 1, g: 0.3 }], a: 0.002, d: 1.8, s: 0, r: 0.6, lp: { f: 2200, kt: 0.5, env: 2000, ed: 0.08 }, gain: 0.28, gate: 1, send: 0.4 },
    celesta:     { osc: [{ w: 'sine' }], fm: { r: 4, i: 1.1, d: 0.3 }, a: 0.002, d: 1.5, s: 0, r: 0.4, gain: 0.18, gate: 1, send: 0.45 },
    bell:        { osc: [{ w: 'sine' }, { w: 'sine', r: 2, g: 0.22 }], fm: { r: 3.5, i: 2.2, d: 1.2 }, a: 0.002, d: 3.5, s: 0, r: 1.2, gain: 0.12, gate: 1, send: 0.55 },
    bell_deep:   { osc: [{ w: 'sine' }, { w: 'sine', r: 0.5, g: 0.4 }, { w: 'sine', r: 1.19, g: 0.18 }, { w: 'sine', r: 2, g: 0.16 }], fm: { r: 1.41, i: 2, d: 2 }, a: 0.003, d: 6, s: 0, r: 2, gain: 0.12, gate: 1, send: 0.6 },
    glass:       { osc: [{ w: 'sine' }, { w: 'sine', r: 3, g: 0.1 }], fm: { r: 5, i: 0.35, d: 0.15 }, a: 0.004, d: 3.2, s: 0, r: 1.2, gain: 0.15, gate: 1, send: 0.65 },
    strings:     { osc: [{ w: 'sawtooth', d: -9 }, { w: 'sawtooth', d: 9 }], a: 0.22, d: 0.4, s: 0.85, r: 0.5, lp: { f: 1700, kt: 0.45, q: 0.5 }, vib: { r: 5.2, d: 9, dl: 0.3 }, gain: 0.07, send: 0.4 },
    violins:     { osc: [{ w: 'sawtooth', d: -6 }, { w: 'sawtooth', d: 7 }], a: 0.09, d: 0.3, s: 0.9, r: 0.35, lp: { f: 2500, kt: 0.35, q: 0.6, vel: 0.6 }, vib: { r: 5.6, d: 16, dl: 0.22 }, gain: 0.085, send: 0.38 },
    strings_stac:{ osc: [{ w: 'sawtooth', d: -7 }, { w: 'sawtooth', d: 7 }], a: 0.006, d: 0.2, s: 0.2, r: 0.07, lp: { f: 1800, kt: 0.4, env: 2200, ed: 0.07 }, gain: 0.1, gate: 0.6, send: 0.25 },
    cello:       { osc: [{ w: 'sawtooth', d: -5 }, { w: 'sawtooth', d: 5 }], a: 0.12, d: 0.3, s: 0.9, r: 0.35, lp: { f: 950, kt: 0.5 }, vib: { r: 5, d: 10, dl: 0.3 }, gain: 0.12, send: 0.3 },
    contrabass:  { osc: [{ w: 'sawtooth' }, { w: 'sine', g: 0.7 }], a: 0.07, d: 0.3, s: 0.9, r: 0.3, lp: { f: 380, kt: 0.4 }, gain: 0.2, send: 0.15 },
    pizz:        { osc: [{ w: 'triangle' }, { w: 'sawtooth', g: 0.35 }], a: 0.003, d: 0.5, s: 0, r: 0.08, lp: { f: 700, kt: 0.6, env: 1800, ed: 0.05 }, gain: 0.3, gate: 1, send: 0.3 },
    choir:       { osc: [{ w: 'sawtooth', d: -12 }, { w: 'sawtooth', d: 10 }], a: 0.45, d: 0.3, s: 0.9, r: 0.8, vib: { r: 4.7, d: 13, dl: 0.35 }, gain: 0.15, send: 0.55,
                   fx: { formants: [[760, 4, 1], [1150, 6, 0.6], [2650, 9, 0.2]], body: [420, 0.35], gain: 2.2 } },
    choir_low:   { osc: [{ w: 'sawtooth', d: -10 }, { w: 'sawtooth', d: 9 }], a: 0.5, d: 0.3, s: 0.9, r: 0.9, vib: { r: 4.4, d: 11, dl: 0.4 }, gain: 0.16, send: 0.55,
                   fx: { formants: [[480, 4, 1], [850, 6, 0.55], [2500, 9, 0.12]], body: [350, 0.45], gain: 2.2 } },
    flute:       { osc: [{ w: 'sine' }, { w: 'sine', o: 1, g: 0.12 }, { w: 'triangle', g: 0.15 }], a: 0.05, d: 0.2, s: 0.85, r: 0.12, ch: { f: 2500, q: 0.7, g: 0.05, d: 0.09 }, vib: { r: 5.2, d: 14, dl: 0.18 }, gain: 0.2, send: 0.35 },
    brass:       { osc: [{ w: 'sawtooth', d: -6 }, { w: 'sawtooth', d: 6 }], a: 0.035, d: 0.25, s: 0.7, r: 0.14, lp: { f: 500, kt: 0.5, env: 2600, ed: 0.2, q: 1.2, vel: 1 }, pe: { c: -40, t: 0.06 }, vib: { r: 5.5, d: 6, dl: 0.3 }, gain: 0.1, send: 0.3 },
    bass:        { osc: [{ w: 'sawtooth', g: 0.55 }, { w: 'sine', g: 0.9 }], a: 0.004, d: 0.4, s: 0.55, r: 0.06, lp: { f: 420, kt: 0.4, env: 1300, ed: 0.07, q: 2 }, gain: 0.24, gate: 0.88, send: 0.04 },
    guitar:      { osc: [{ w: 'sawtooth', d: -9 }, { w: 'sawtooth', d: 9 }], a: 0.003, d: 0.5, s: 0.55, r: 0.06, lp: { f: 3500 }, gain: 0.08, gate: 0.9, send: 0.12, fx: { drive: 5, lp: 2800, hp: 100, gain: 0.5 } },
    timpani:     { osc: [{ w: 'sine' }, { w: 'sine', r: 1.5, g: 0.25 }, { w: 'sine', r: 2, g: 0.12 }], pe: { c: 60, t: 0.08 }, ch: { f: 180, q: 0.7, g: 0.6, d: 0.12 }, a: 0.003, d: 2, s: 0, r: 0.6, gain: 0.4, gate: 1, send: 0.35 },
    pad:         { osc: [{ w: 'sawtooth', d: -14 }, { w: 'sawtooth', d: 13 }, { w: 'triangle', o: -1, g: 0.5 }], a: 1.4, d: 1, s: 0.85, r: 1.8, lp: { f: 650, kt: 0.3 }, gain: 0.06, send: 0.5 },
    drone:       { osc: [{ w: 'sawtooth' }, { w: 'sine', o: -1, g: 0.8 }], a: 2.2, s: 1, r: 2.5, lp: { f: 260, kt: 0.2 }, gain: 0.12, send: 0.4 },
    lead:        { osc: [{ w: 'square', g: 0.55 }, { w: 'sawtooth', d: 8, g: 0.45 }], a: 0.01, d: 0.3, s: 0.8, r: 0.12, lp: { f: 3000, kt: 0.25 }, vib: { r: 5.6, d: 16, dl: 0.18 }, gain: 0.085, send: 0.25 },
    reed:        { osc: [{ w: 'reed' }], a: 0.03, d: 0.2, s: 0.85, r: 0.1, lp: { f: 1800, kt: 0.3 }, vib: { r: 5, d: 9, dl: 0.2 }, gain: 0.12, send: 0.3 }
  };

  // ------------------------------------------------------------- drum kit
  // L: layers (same format as sfx layers, see audio.js), v: lane gain, p: pan, rp: random pan
  var kit = {
    k: { L: [{ f: [150, 46], fs: 0.07, d: 0.38, v: 1 }, { n: 1, ft: 'lowpass', f: 3000, d: 0.018, v: 0.45 }], v: 0.75, p: 0 },
    s: { L: [{ w: 'triangle', f: [240, 170], fs: 0.05, d: 0.11, v: 0.55 }, { n: 1, ft: 'highpass', f: 1300, d: 0.2, v: 0.55 }, { n: 1, ft: 'bandpass', f: 3200, q: 0.9, d: 0.09, v: 0.3 }], v: 0.55, p: 0.05 },
    h: { L: [{ n: 1, ft: 'highpass', f: 7500, d: 0.045, v: 0.35 }], v: 0.4, p: 0.28 },
    o: { L: [{ n: 1, ft: 'highpass', f: 6800, d: 0.32, v: 0.3 }], v: 0.4, p: 0.28 },
    c: { L: [{ n: 1, ft: 'highpass', f: 4200, d: 2.2, v: 0.4 }, { n: 1, ft: 'bandpass', f: 6500, q: 0.6, d: 1.3, v: 0.25 }], v: 0.4, p: -0.25 },
    r: { L: [{ n: 1, ft: 'highpass', f: 8000, d: 0.45, v: 0.15 }, { f: 5100, d: 0.6, v: 0.04 }, { f: 7230, d: 0.4, v: 0.03 }], v: 0.5, p: -0.3 },
    t: { L: [{ f: [130, 78], fs: 0.12, d: 0.42, v: 0.85 }, { n: 1, ft: 'lowpass', f: 1400, d: 0.04, v: 0.25 }], v: 0.6, p: -0.2 },
    m: { L: [{ f: [190, 115], fs: 0.1, d: 0.34, v: 0.8 }, { n: 1, ft: 'lowpass', f: 1800, d: 0.035, v: 0.25 }], v: 0.6, p: 0.15 },
    f: { L: [{ f: [85, 42], fs: 0.18, d: 1.1, v: 0.95 }, { n: 1, ft: 'lowpass', f: 500, d: 0.25, v: 0.35 }], v: 0.6, p: 0 },
    w: { L: [{ f: [1350, 1250], d: 0.055, v: 0.5 }, { n: 1, ft: 'bandpass', f: 1600, q: 9, d: 0.025, v: 0.35 }], v: 0.32, p: 0.3 },
    u: { L: [{ f: [900, 840], d: 0.07, v: 0.5 }, { n: 1, ft: 'bandpass', f: 1100, q: 9, d: 0.03, v: 0.35 }], v: 0.32, p: -0.3 },
    l: { L: [{ n: 1, ft: 'highpass', f: 6000, d: 0.012, v: 0.6 }, { w: 'square', f: 3600, d: 0.008, v: 0.12 }], v: 0.22, p: 0.35 },
    x: { L: [{ n: 1, ft: 'bandpass', f: 1400, q: 1.2, d: 0.02, v: 0.5, rep: [3, 0.011] }, { n: 1, ft: 'bandpass', f: 1500, q: 1, t: 0.03, d: 0.15, v: 0.4 }], v: 0.45, p: -0.1 },
    i: { L: [{ f: 3520, d: 1.1, v: 0.12 }, { f: 5280, d: 0.8, v: 0.07 }, { f: 8150, d: 0.45, v: 0.04 }], v: 0.4, p: 0.4 },
    j: { L: [{ n: 1, ft: 'highpass', f: 6500, d: 0.09, v: 0.25 }, { n: 1, ft: 'bandpass', f: 9000, q: 2, d: 0.14, v: 0.12 }], v: 0.38, p: 0.3 },
    y: { L: [{ n: 1, ft: 'bandpass', f: 6000, q: 1.2, a: 0.012, d: 0.07, v: 0.2 }], v: 0.34, p: 0.25 },
    p: { L: [{ f: [1700, 2500], fs: 0.035, d: 0.2, v: 0.25, rnd: 500 }], v: 0.5, p: 0, rp: 0.6 },
    g: { L: [{ n: 1, ft: 'bandpass', f: [500, 280], q: 2.5, a: 0.08, d: 4.5, v: 0.4 }, { f: 97, d: 4, v: 0.2, fm: [2.76, 1.5, 3] }, { f: [180, 170], d: 3.5, v: 0.12 }], v: 0.45, p: 0 },
    a: { L: [{ w: 'square', f: 1150, d: 0.07, v: 0.07, lp: 5000 }, { f: 2980, d: 0.25, v: 0.1 }, { f: 4430, d: 0.18, v: 0.06 }, { n: 1, ft: 'highpass', f: 5000, d: 0.02, v: 0.3 }], v: 0.38, p: 0.2 },
    z: { L: [{ n: 1, ft: 'highpass', f: [2500, 6000], a: 1.6, d: 1.7, v: 0.3, e: 'swell' }], v: 0.4, p: 0 },
    b: { L: [{ f: [70, 30], fs: 0.5, d: 1.8, v: 0.9 }, { n: 1, ft: 'lowpass', f: [900, 100], d: 0.6, v: 0.4 }], v: 0.55, p: 0 },
    T: { L: [{ f: [110, 55], fs: 0.2, d: 0.7, v: 0.9 }, { n: 1, ft: 'lowpass', f: 900, d: 0.08, v: 0.45 }], v: 0.55, p: 0 }
  };

  var T = {}; // tracks (insertion order = sound-test order)

  /*__TRACKS__*/
  // drum section builder: bars of `base` with optional last-bar `fill` and crash on beat 1
  function dsec(bars, base, fill, step, crash) {
    var first = base[Object.keys(base)[0]], spb = lane(first).length;
    var out = { step: step || 0.25 }, keys = {}, k;
    for (k in base) keys[k] = 1;
    if (fill) for (k in fill) keys[k] = 1;
    for (k in keys) {
      var b = base[k] ? lane(base[k]) : pad('', spb);
      var f = fill ? (fill[k] ? lane(fill[k]) : pad('', spb)) : '';
      out[k] = (fill ? lrep(b, bars - 1) : lrep(b, bars)) + f;
    }
    if (crash) out.c = pad('X', bars * spb);
    return out;
  }

  // ======================================================================
  // 1. TITLE — "Elegy of the Night"  D minor, 70 BPM
  // ======================================================================
  (function () {
    var MEL = '@0.5 D5*4 E5*2 F5*2 | F5*6 D5*2 | G5*4 F5*2 E5*2 | E5*6 A4*2 | D5*3 C5 D5*2 F5*2 | Bb5*4 A5*2 G5*2 | F5*2 E5*2 C#5*2 E5*2 | D5*8 |';
    var ORG = '@4 A3+D4+F4 | Bb3+D4+F4 | Bb3+D4+G4 | A3+C#4+E4 | Bb3+D4+F4 | Bb3+D4+G4 | A3+C#4+E4 | A3+D4+F4 |';
    var PED = '@4 D2 | Bb1 | G1 | A1 | Bb1 | G1 | A1 | D2 |';
    var VC = '@1 F3*2 E3 D3 | D3*2 F3 Bb3 | Bb3*2 A3 G3 | A2*2 C#3 E3 | D3*2 F3 D3 | D3*2 G3 Bb3 | A3*2 G3 E3 | D3*2 A2*2 |';
    T.title = {
      name: 'Elegy of the Night', bpm: 70, meter: 4, vol: 1,
      parts: {
        org: { i: 'organ', v: 0.75, s: 0.4 },
        ped: { i: 'organ_pedal', v: 0.9 },
        cho: { i: 'choir', v: 0.8, p: 0.1 },
        bel: { i: 'bell_deep', v: 0.7, p: -0.15 },
        str: { i: 'violins', v: 0.9, p: -0.15 },
        vc:  { i: 'cello', v: 0.8, p: 0.25 },
        tim: { i: 'timpani', v: 0.8 },
        dr:  { kit: 1, v: 0.6 }
      },
      sections: {
        I: { bars: 2, bel: '@2 D4*2 | A3 D4 |', ped: '@4 D2*2 |', cho: '@4 . | D4+A4 |', org: '@4 . | D3+A3 |' },
        A: { bars: 4,
          org: '@2 A3+D4+F4 Bb3+D4+F4 | Bb3+D4+G4 A3+C#4+E4 | A3+D4+F4 A3+C4+F4 | Bb3+D4+F4 @1 A3+D4+E4 A3+C#4+E4 |',
          ped: '@2 D2 Bb1 | G1 A1 | D2 C2 | Bb1 A1 |',
          cho: '@2 F4+A4 F4+Bb4 | G4+Bb4 E4+A4 | F4+A4 F4+A4 | F4+Bb4 E4+A4 |',
          bel: '@1 D4*4 | . . A3*2 | D4*4 | . . A3*2 |' },
        B: { bars: 8, str: MEL, org: ORG, ped: PED, vc: VC, bel: '@4 D4 .*7 |',
          dr: { step: 1, z: pad('', 30) + 'x.' } },
        C: { bars: 8, str: MEL, cho: 't-12 ' + MEL, org: ORG, ped: PED, vc: VC,
          bel: '@4 D4 | . | . | A3 | . | . | . | D4 |',
          tim: '@1 D2*4 | .*4 | .*4 | . . @0.25 v.5 A1 A1 A1 A1 v.7 A1 A1 A1 A1 | @1 .*4 | .*4 | @0.25 v.5 A1 A1 A1 A1 v.65 A1 A1 A1 A1 v.8 A1 A1 A1 A1 v1 A1 A1 A1 A1 | @1 D2*4 |',
          dr: { step: 1, c: pad('x', 32) } }
      },
      intro: ['I'], order: ['A', 'B', 'C']
    };
  })();

  // ======================================================================
  // 2. PROLOGUE — narration underscore, A minor, 60 BPM (quiet)
  // ======================================================================
  T.prologue = {
    name: 'Chronicle of Ashes', bpm: 60, meter: 4, vol: 1,
    parts: {
      pno: { i: 'piano', v: 0.8, p: -0.1, vel: 0.62 },
      lo:  { i: 'cello', v: 0.75, p: 0.15, vel: 0.6 },
      hi:  { i: 'strings', v: 0.55, p: 0.25, vel: 0.55 },
      cel: { i: 'celesta', v: 0.4, p: 0.35, vel: 0.5 }
    },
    sections: {
      A: { bars: 8,
        pno: '@0.5 A3 E4 A4 C5*3 B4 A4 | F3 C4 F4 A4*3 G4 F4 | D3 A3 D4 F4*3 E4 D4 | E3 B3 E4 G#4*5 | A3 E4 A4 C5*3 D5 E5 | G3 E4 G4 C5*3 B4 C5 | F3 C4 A4 F5*3 E5 D5 | E3 B3 G#4 E5*4 . |',
        lo: '@4 A2 | F2 | D2 | E2 | A2 | G2 | F2 | E2 |',
        hi: '@4 . | . | . | . | C5+E5 | C5+E5 | A4+C5 | G#4+B4 |',
        cel: '@4 . | . | . | B5 | . | . | . | E6 |' },
      B: { bars: 4,
        pno: '@0.5 D3 A3 F4 A4*3 G4 F4 | C3 G3 E4 A4*3 G4 E4 | B2 F3 D4 F4*3 E4 D4 | E3 B3 E4 G#4*3 B4 . |',
        lo: '@4 D2 | C2 | B1 | E2 |',
        hi: '@4 A4+D5 | A4+C5 | A4+D5 | G#4+B4 |' }
    },
    order: ['A', 'B']
  };

  // ======================================================================
  // 3. ENTRANCE — "Gate of the Crimson Moon"  E minor, 132 BPM, gothic rock
  // ======================================================================
  (function () {
    var RB = { k: 'X.....x.X.....x.', s: '....X.......X...', h: 'X.x.X.x.X.x.X.x.' };
    var FILL = { k: 'X.....x.X.......', s: '....X...XX......', m: '..........XX....', t: '............XXXX', h: 'X.x.X.x.........' };
    var HT = { k: 'X.........X.....', s: '........X.......', r: 'x.x.x.x.x.x.x.x.' };
    var LEAD_A = '@0.5 E5*3 D5*3 B4*2 | C5*3 B4*3 G4*2 | A4*3 B4*3 D5*2 | B4*6 E4 F#4 | E5*3 D5*3 B4*2 | E5*3 F#5*3 G5*2 | A5*3 G5*3 E5*2 | F#5*4 D#5*2 B4*2 |';
    var LEAD_A2 = '@0.5 E5*3 D5*3 B4*2 | C5*3 B4*3 G4*2 | A4*3 B4*3 D5*2 | B4*6 E4 F#4 | G5*3 F#5*3 E5*2 | E5*3 D5*3 C5*2 | C5*3 B4*3 A4*2 | B4*8 |';
    var BASS_A = '@0.5 ' + [b8('E2', 'E3'), b8('C2', 'C3'), b8('D2', 'D3'), b8('E2', 'E3'), b8('E2', 'E3'), b8('C2', 'C3'), b8('A1', 'A2'), b8('B1', 'B2', 'D#2')].join(' | ') + ' |';
    var PAD_A = '@4 E4+G4+B4 | E4+G4+C5 | D4+F#4+A4 | E4+G4+B4 | E4+G4+B4 | E4+G4+C5 | E4+A4+C5 | D#4+F#4+B4 |';
    var GTR_A = '@0.5 ' + [stac('E3+B3', 8), stac('C3+G3', 8), stac('D3+A3', 8), stac('E3+B3', 8), stac('E3+B3', 8), stac('C3+G3', 8), stac('A2+E3', 8), stac('B2+F#3', 8)].join(' | ') + ' |';
    var TOC = '@0.25 E5 B4 G4 B4 E5 B4 G4 B4 G5 E5 B4 E5 G5 E5 B4 E5 | D5 A4 F#4 A4 D5 A4 F#4 A4 F#5 D5 A4 D5 F#5 D5 A4 D5 | C5 G4 E4 G4 C5 G4 E4 G4 E5 C5 G4 C5 E5 C5 G4 C5 | B4 F#4 D#4 F#4 B4 F#4 D#4 F#4 D#5 B4 F#4 B4 D#5 F#5 A5 F#5 |';
    var BASS_C = '@0.5 ' + [b8('E2', 'E3'), b8('D2', 'D3'), b8('C2', 'C3'), b8('B1', 'B2', 'D#2')].join(' | ') + ' |';
    T.entrance = {
      name: 'Gate of the Crimson Moon', bpm: 132, meter: 4, vol: 1, hum: [0.004, 0.06],
      parts: {
        lead: { i: 'organ_lead', v: 0.85, p: 0.05 },
        vln:  { i: 'violins', v: 0.85, p: -0.1 },
        hpsi: { i: 'harpsichord', v: 0.7, p: 0.3 },
        pad:  { i: 'strings', v: 0.6, p: -0.3, vel: 0.6 },
        org:  { i: 'organ', v: 0.5, p: 0.2, vel: 0.65 },
        bass: { i: 'bass', v: 0.9 },
        gtr:  { i: 'guitar', v: 0.55, p: -0.35, vel: 0.7 },
        dr:   { kit: 1, v: 0.85 }
      },
      sections: {
        I: { bars: 2, dr: dsec(2, { k: 'X...X...X...X...', h: 'x.x.x.x.x.x.x.x.' }, FILL),
          bass: '@0.5 .*8 | E2 E2 E2 E2 E2 E2 E2 D#2 |', gtr: '@0.5 .*8 | ' + stac('E3+B3', 8) + ' |' },
        A: { bars: 8, lead: LEAD_A, bass: BASS_A, pad: PAD_A, dr: dsec(8, RB, FILL, 0.25, true) },
        A2: { bars: 8, lead: LEAD_A2, hpsi: 't-12 ' + LEAD_A2, bass: BASS_A, pad: PAD_A, gtr: GTR_A, dr: dsec(8, RB, FILL, 0.25, true) },
        B: { bars: 8,
          vln: '@0.5 C5*4 B4*2 A4*2 | B4*6 G4*2 | A4*4 C5*4 | D#5*8 | E5*4 D5*2 C5*2 | B4*4 E5*4 | G5*4 F#5*2 E5*2 | F#5*8 |',
          org: '@4 E4+A4+C5 | E4+G4+B4 | F4+A4+C5 | D#4+F#4+B4 | E4+A4+C5 | E4+G4+B4 | E4+G4+C5 | D#4+F#4+B4 |',
          bass: '@1 A2*2 A2 E2 | E2*2 E2 B1 | F2*2 F2 C3 | B1*2 B1 F#2 | A2*2 A2 E2 | E2*2 E2 B1 | C2*2 C2 G2 | B1*2 B1 D#2 |',
          dr: dsec(8, HT, FILL, 0.25, true) },
        C: { bars: 8, hpsi: TOC,
          lead: '@0.5 .*8 | .*8 | .*8 | .*8 | E5*4 G5*4 | F#5*4 A5*4 | G5*4 E5*4 | F#5*6 D#5*2 |',
          bass: BASS_C, pad: '@4 E4+G4+B4 | D4+F#4+A4 | E4+G4+C5 | D#4+F#4+B4 |',
          gtr: '@0.5 .*8 | .*8 | .*8 | .*8 | ' + [stac('E3+B3', 8), stac('D3+A3', 8), stac('C3+G3', 8), stac('B2+F#3', 8)].join(' | ') + ' |',
          dr: dsec(8, RB, FILL, 0.25, true) }
      },
      intro: ['I'], order: ['A', 'A2', 'B', 'C']
    };
  })();

  function bars(prefix, arr) { return prefix + ' ' + arr.join(' | ') + ' |'; }
  function w3(arr) { return bars('@1', arr.map(function (c) { return ". " + c + "' " + c + "'"; })); }
  function sAlb(a, b, c) { return alb(a + "'", b + "'", c + "'"); }

  // ======================================================================
  // 4. GALLERY — "Waltz of Marble Saints"  G minor, 3/4, 150 BPM
  // ======================================================================
  (function () {
    var MEL_A = '@0.5 D5*2 G5*2 Bb5*2 | A5*3 G5 F#5*2 | G5*4 Eb5*2 | D5*4 . . | D5*2 G5*2 Bb5*2 | C6*3 Bb5 A5*2 | G5*2 Eb5*2 C5*2 | C5*2 Bb4*2 A4*2 | Bb4*2 D5*2 G5*2 | Bb5*3 A5 G5*2 | Eb5*2 G5*2 C6*2 | A5*4 F5*2 | D5*3 Eb5 F5*2 | G5*3 F5 Eb5*2 | F#5*2 A5*2 C6*2 | G5*4 . . |';
    var BASS_A = '@1 G2 . . | G2 . D3 | C3 . . | D2 . . | G2 . . | Eb2 . . | A2 . . | D2 . . | G2 . . | G2 . D3 | C3 . . | F2 . . | Bb2 . . | Eb2 . . | D2 . . | G2 . . |';
    var PZC_A = w3(['Bb3+D4', 'Bb3+D4', 'C4+Eb4', 'C4+F#4', 'Bb3+D4', 'Bb3+Eb4', 'C4+Eb4', 'C4+F#4', 'Bb3+D4', 'Bb3+D4', 'C4+Eb4', 'A3+C4', 'Bb3+D4', 'Bb3+Eb4', 'C4+F#4', 'Bb3+D4']);
    var STR_A = bars('@3', ['G3+Bb3+D4', 'G3+Bb3+D4', 'G3+C4+Eb4', 'F#3+A3+D4', 'G3+Bb3+D4', 'G3+Bb3+Eb4', 'A3+C4+Eb4', 'F#3+A3+C4', 'G3+Bb3+D4', 'G3+Bb3+D4', 'G3+C4+Eb4', 'A3+C4+F4', 'Bb3+D4+F4', 'G3+Bb3+Eb4', 'F#3+A3+C4', 'G3+Bb3+D4']);
    var MEL_B = '@0.5 F5*3 G5 F5*2 | Eb5*4 C5*2 | D5*3 Eb5 D5*2 | C5*4 A4*2 | Bb4*2 Eb5*2 G5*2 | F5*3 Eb5 D5*2 | Eb5*2 D5*2 C5*2 | A4*4 . . | F5*3 G5 F5*2 | A5*3 Bb5 C6*2 | Bb5*4 G5*2 | G5*2 F5*2 Eb5*2 | Eb5*3 D5 C5*2 | Bb4*4 D5*2 | A4*2 C5*2 F#5*2 | A5*4 . . |';
    var BASS_B = '@1 Bb2 . . | A2 . . | G2 . . | D2 . . | Eb2 . . | D2 . . | C2 . . | F2 . . | Bb2 . . | A2 . . | G2 . . | Eb2 . . | C2 . . | D2 . . | D2 . . | D2 . F#2 |';
    var CH_B = [['Bb3', 'D4', 'F4'], ['A3', 'C4', 'F4'], ['G3', 'Bb3', 'D4'], ['A3', 'D4', 'F4'], ['G3', 'Bb3', 'Eb4'], ['F3', 'Bb3', 'D4'], ['G3', 'C4', 'Eb4'], ['A3', 'C4', 'F4'],
                ['Bb3', 'D4', 'F4'], ['A3', 'C4', 'F4'], ['G3', 'Bb3', 'D4'], ['G3', 'Bb3', 'Eb4'], ['G3', 'C4', 'Eb4'], ['G3', 'Bb3', 'D4'], ['F#3', 'A3', 'D4'], ['F#3', 'A3', 'C4']];
    var ARP_B = bars('@0.5', CH_B.map(function (c) { return alb(c[0], c[1], c[2]); }));
    var STR_B = bars('@3', CH_B.map(function (c) { return c.join('+'); }));
    T.gallery = {
      name: 'Waltz of Marble Saints', bpm: 150, meter: 3, vol: 1, hum: [0.005, 0.07],
      parts: {
        hpsi: { i: 'harpsichord', v: 0.8, p: 0.1 },
        fl:   { i: 'flute', v: 0.65, p: -0.2 },
        pz:   { i: 'pizz', v: 0.9, p: -0.1 },
        pzc:  { i: 'pizz', v: 0.45, p: 0.25, vel: 0.6 },
        str:  { i: 'strings', v: 0.5, p: -0.3, vel: 0.55 },
        dr:   { kit: 1, v: 0.5 }
      },
      sections: {
        A:  { bars: 16, hpsi: MEL_A, pz: BASS_A, pzc: PZC_A, str: STR_A, dr: { step: 1, i: pad('o', 12) } },
        B:  { bars: 16, fl: MEL_B, hpsi: ARP_B, pz: BASS_B, str: STR_B, dr: { step: 1, i: pad('o', 24) } },
        A2: { bars: 16, hpsi: MEL_A, fl: MEL_A, pz: BASS_A, pzc: PZC_A, str: STR_A, dr: { step: 1, i: pad('o', 12) } }
      },
      order: ['A', 'B', 'A2']
    };
  })();

  // ======================================================================
  // 5. LIBRARY — "Minuet of the Silent Stacks"  C minor <-> Eb major, 3/4, 110 BPM
  // ======================================================================
  (function () {
    var MEL_A = "@0.5 C5' D5' Eb5' . G5' . | F5' Eb5' D5' . B4' . | Eb5' F5' G5' . Bb5' . | A5*2 G5' F5' Eb5' C5' | F5' Ab5' C6' Ab5' F5' Ab5' | G5*2 B4' C5' D5' F5' | Eb5' G5' Eb5' C5' G4' C5' | D5*4 . . |";
    var MEL_A2 = "@0.5 C5' D5' Eb5' . G5' . | F5' Eb5' D5' . B4' . | Eb5' F5' G5' . Bb5' . | A5*2 G5' F5' Eb5' C5' | F5' Ab5' C6' Ab5' F5' Ab5' | G5*2 F5' D5' B4' G4' | C5' Eb5' D5' F5' Eb5' D5' | C5*4 . . |";
    var BASS_A = '@1 C3 . . | B2 . . | Bb2 . . | A2 . . | Ab2 . . | G2 . . | C3 . . | G2 . . |';
    var HP2_A = w3(['Eb4+G4', 'D4+F4', 'Eb4+G4', 'C4+Eb4', 'C4+F4', 'B3+D4', 'Eb4+G4', 'B3+D4']);
    var ALB_A2 = bars('@0.5', [alb('C4', 'Eb4', 'G4'), alb('B3', 'D4', 'G4'), alb('Bb3', 'Eb4', 'G4'), alb('A3', 'C4', 'F4'), alb('Ab3', 'C4', 'F4'), alb('B3', 'D4', 'F4'), alb('C4', 'Eb4', 'G4'), alb('C4', 'Eb4', 'G4')]);
    var MEL_B = '@0.5 G5*3 F5 Eb5*2 | F5*4 D5*2 | Eb5*3 D5 C5*2 | C5*4 Ab4*2 | Bb4*2 Eb5*2 G5*2 | Bb5*3 Ab5 F5*2 | G5*2 F5 Eb5 D5 Eb5 | D5*2 B4*2 G4*2 |';
    var HP_B = bars('@0.5', [sAlb('Eb4', 'G4', 'Bb4'), sAlb('D4', 'F4', 'Bb4'), sAlb('C4', 'Eb4', 'G4'), sAlb('C4', 'Eb4', 'Ab4'), sAlb('Bb3', 'Eb4', 'G4'), sAlb('D4', 'F4', 'Bb4'), sAlb('Eb4', 'G4', 'Bb4'), sAlb('D4', 'G4', 'B4')]);
    var MEL_C = "@0.5 C6' . G5' . Eb5' . | C6' . Ab5' . Eb5' . | F5' Ab5' C6' Ab5' F5' Ab5' | G5*2 F5' Eb5' D5' B4' | C5' D5' Eb5' . G5' . | Ab5' G5' F5' . C5' . | B4' C5' D5' F5' Eb5' D5' | C5*2 . . G4' . |";
    var TICK = { step: 1, u: 'x..', w: '.oo' };
    T.library = {
      name: 'Minuet of the Silent Stacks', bpm: 110, meter: 3, vol: 1, hum: [0.006, 0.08],
      parts: {
        hpsi: { i: 'harpsichord', v: 0.8, p: 0.15 },
        fl:   { i: 'flute', v: 0.7, p: -0.2 },
        pz:   { i: 'pizz', v: 0.9, p: -0.05 },
        hp2:  { i: 'harpsichord', v: 0.42, p: -0.3, vel: 0.6 },
        cel:  { i: 'celesta', v: 0.45, p: 0.35 },
        dr:   { kit: 1, v: 0.6 }
      },
      sections: {
        A:  { bars: 8, hpsi: MEL_A, pz: BASS_A, hp2: HP2_A, dr: { step: 1, u: 'x..', w: '.oo', i: pad('o', 24) } },
        A2: { bars: 8, fl: MEL_A2, hp2: ALB_A2, pz: '@1 C3 . . | B2 . . | Bb2 . . | A2 . . | Ab2 . . | G2 . . | C3 . . | C3 . . |', dr: TICK },
        B:  { bars: 8, fl: MEL_B, hpsi: HP_B, pz: '@1 Eb3 . . | D3 . . | C3 . . | Ab2 . . | Bb2 . . | Bb2 . . | Eb3 . . | G2 . . |',
          cel: '@1 . . G6 | .*3 | .*3 | .*3 | . . Eb6 | .*3 | .*3 | .*3 |', dr: { step: 1, u: 'x..', w: '.oo', j: pad('o', 6) } },
        C:  { bars: 8, hpsi: MEL_C, fl: '@3 Eb5 | Eb5 | C5 | B4 | Eb5 | C5 | D5 | C5 |',
          pz: '@1 C3 . . | Ab2 . . | F2 . . | G2 . . | C3 . . | Ab2 . . | G2 . . | C3 . G2 |',
          hp2: w3(['Eb4+G4', 'Eb4+Ab4', 'F4+Ab4', 'B3+F4', 'Eb4+G4', 'C4+F4', 'B3+D4', 'Eb4+G4']), dr: TICK }
      },
      order: ['A', 'A2', 'B', 'C']
    };
  })();

  // ======================================================================
  // 6. ARCHIVES — "Hymn of the Belmont Archives"  F minor, 12/8, 96 BPM (dotted quarter)
  //    The featured theme of the game.
  // ======================================================================
  var ARCH = {
    A:  '@1/3 C5*3 F5*2 G5 Ab5*6 | Bb4*3 Eb5*2 F5 G5*6 | Ab4*3 Db5*2 Eb5 F5*2 Ab5 Db6*3 | C6*6 Bb5*2 G5 E5*3 | C5*3 F5*2 G5 Ab5*3 C6*2 Bb5 | G5*3 Eb5*2 F5 G5*3 Bb5*2 Ab5 | F5*3 Eb5*2 Db5 C5*3 E5*2 G5 | F5*6 . . . C5 Db5 Eb5 |',
    A2: '@1/3 C5*3 F5*2 G5 Ab5*6 | Bb4*3 Eb5*2 F5 G5*6 | Ab4*3 Db5*2 Eb5 F5*2 Ab5 Db6*3 | C6*6 Bb5*2 G5 E5*3 | C5*3 F5*2 G5 Ab5*3 C6*2 Bb5 | G5*3 Eb5*2 F5 G5*3 Bb5*2 Ab5 | F5*3 Eb5*2 Db5 C5*3 E5*2 G5 | F5*12 |',
    B:  '@1/3 Ab5*5 G5 F5*3 Db5*3 | Eb5*5 F5 Eb5*3 C5*3 | Db5*3 F5*2 Bb5 Ab5*3 F5*3 | G5*9 Eb5*3 | Ab5*5 G5 F5*3 Ab5*3 | C6*6 Bb5*3 Ab5*3 | Db6*3 C6*2 Bb5 Ab5*3 G5*3 | G5*9 . . . |'
  };
  (function () {
    var ORG_A = '@4 C4+F4+Ab4 | Bb3+Eb4+G4 | Ab3+Db4+F4 | G3+C4+E4 | Ab3+C4+F4 | G3+Bb3+Eb4 | @2 Ab3+Db4+F4 G3+C4+E4 | @4 Ab3+C4+F4 |';
    var ORG_B = '@4 Ab3+Db4+F4 | Ab3+C4+Eb4 | Bb3+Db4+F4 | Bb3+Eb4+G4 | Ab3+Db4+F4 | Ab3+C4+Eb4 | @2 Bb3+Db4+F4 G3+C4+E4 | @4 G3+Bb3+E4 |';
    var PED_A = '@4 F2 | Eb2 | Db2 | C2 | F2 | Eb2 | @2 Db2 C2 | @4 F2 |';
    var PED_B = '@4 Db2 | C2 | Bb1 | Eb2 | Db2 | C2 | @2 Bb1 C2 | @4 C2 |';
    var Fm = arp6('F3', 'C4', 'F4', 'Ab4'), Eb = arp6('Eb3', 'Bb3', 'Eb4', 'G4'), Db = arp6('Db3', 'Ab3', 'Db4', 'F4'),
        C = arp6('C3', 'G3', 'C4', 'E4'), C7 = arp6('C3', 'G3', 'Bb3', 'E4'), AbC = arp6('C3', 'Ab3', 'C4', 'Eb4'), Bbm = arp6('Bb2', 'F3', 'Bb3', 'Db4');
    var ARP_A = bars('@1/3', [Fm + ' ' + Fm, Eb + ' ' + Eb, Db + ' ' + Db, C + ' ' + C, Fm + ' ' + Fm, Eb + ' ' + Eb, Db + ' ' + C, Fm + ' ' + Fm]);
    var ARP_B = bars('@1/3', [Db + ' ' + Db, AbC + ' ' + AbC, Bbm + ' ' + Bbm, Eb + ' ' + Eb, Db + ' ' + Db, AbC + ' ' + AbC, Bbm + ' ' + C, C7 + ' ' + C7]);
    var BEL = '@1 . . Ab5 . | . . G5 . | . . F5 Db6 | C6 . . . | . . Ab5 . | . . G5 . | .*4 | F5 . . . |';
    T.archives = {
      name: 'Hymn of the Belmont Archives', bpm: 96, meter: 4, step: 1 / 3, vol: 1, hum: [0.006, 0.07],
      parts: {
        mel: { i: 'violins', v: 1.0, p: -0.05, vel: 0.85 },
        org: { i: 'organ', v: 0.6, p: 0.15, vel: 0.7 },
        ped: { i: 'organ_pedal', v: 0.85 },
        hp:  { i: 'harp', v: 0.55, p: 0.3, vel: 0.6 },
        cho: { i: 'choir', v: 0.75, p: -0.2 },
        vc:  { i: 'cello', v: 0.65, p: 0.25 },
        bel: { i: 'bell', v: 0.6, p: 0.2 },
        tim: { i: 'timpani', v: 0.7 },
        dr:  { kit: 1, v: 0.55 }
      },
      sections: {
        I:  { bars: 2, org: '@4 F3+Ab3+C4 | G3+C4+E4 |', ped: '@4 F2 | C2 |', bel: '@1 C5*2 Ab4*2 | G4*2 C4*2 |', cho: '@4 . | E4+G4 |',
          hp: '@1/3 .*12 | ' + C + ' ' + C + ' |' },
        A:  { bars: 8, mel: ARCH.A, org: ORG_A, ped: PED_A, hp: ARP_A, bel: BEL },
        B:  { bars: 8, mel: ARCH.B, org: ORG_B, ped: PED_B, hp: ARP_B,
          cho: '@4 F4+Ab4 | Eb4+Ab4 | F4+Bb4 | Eb4+G4 | F4+Ab4 | Eb4+Ab4 | @2 F4+Bb4 E4+G4 | @4 E4+G4 |',
          tim: '@4 . | C2 | . | . | . | C2 | . | @1/3 v.4 C2 C2 C2 v.6 C2 C2 C2 v.8 C2 C2 C2 v1 C2 C2 C2 |',
          dr: { step: 1, f: 'o...', z: pad('', 29) + 'x..' } },
        A2: { bars: 8, mel: ARCH.A2, cho: 't-12 ' + ARCH.A2, org: ORG_A, ped: PED_A, hp: ARP_A, bel: BEL,
          vc: '@1 F3*2 Ab3 C4 | Bb3*2 G3 Eb3 | F3*2 Ab3 Db4 | C4*2 Bb3 G3 | Ab3*2 C4 F4 | Eb4*2 Bb3 G3 | Ab3 F3 E3 G3 | F3*4 |',
          tim: '@4 F2 | . | . | C2 | F2 | . | . | F2 |', dr: { step: 1, f: 'x...', c: pad('x', 32) } }
      },
      intro: ['I'], order: ['A', 'B', 'A2']
    };
  })();

  // lane of n steps with hits at positions (ch: 'x' default)
  function hits(n, pos, ch) { var a = []; for (var i = 0; i < n; i++) a.push('.'); for (var j = 0; j < pos.length; j++) a[pos[j]] = ch || 'x'; return a.join(''); }
  function cell4(a, b, c, d) { return rep([a, b, c, d].join(' '), 4); }

  // ======================================================================
  // 7. ARCHIVES DEEP — "The Forbidden Vault"  F Phrygian/minor, 12/8, 72 BPM
  // ======================================================================
  T.archives_deep = {
    name: 'The Forbidden Vault', bpm: 72, meter: 4, step: 1 / 3, vol: 1, hum: [0.008, 0.08],
    parts: {
      vc:  { i: 'cello', v: 0.9, p: 0.15, vel: 0.75 },
      dn:  { i: 'drone', v: 0.9 },
      pad: { i: 'pad', v: 0.9, p: -0.1 },
      cho: { i: 'choir_low', v: 0.65, p: -0.25, vel: 0.65 },
      bel: { i: 'bell', v: 0.45, p: 0.4, s: 0.7, fx: { echo: [1.5, 0.45, 0.4], lp: 3000 } },
      org: { i: 'organ_soft', v: 0.35, p: 0.3, vel: 0.5 },
      dr:  { kit: 1, v: 0.5 }
    },
    sections: {
      A: { bars: 8,
        vc: '@1/3 C3*3 F3*2 Gb3 Ab3*6 | Gb3*6 F3*6 | Bb2*3 Eb3*2 E3 Gb3*6 | F3*6 E3*6 | C3*3 F3*2 Gb3 Ab3*3 B3*3 | C4*6 Bb3*3 Gb3*3 | F3*3 E3*3 Eb3*3 D3*3 | Db3*6 C3*6 |',
        dn: '@4 F2+C3*8 |',
        pad: '@4 F3+Ab3+C4 | Gb3+Bb3+Db4 | Eb3+Gb3+Bb3 | E3+G3+Bb3+Db4 | F3+Ab3+C4 | F3+B3+D4 | Gb3+Bb3+Db4 | E3+G3+C4 |',
        cho: '@4 Ab3+C4 | Bb3+Db4 | Bb3+Eb4 | G3+Db4 | Ab3+C4 | B3+D4 | Bb3+Db4 | G3+C4 |',
        dr: { step: 1, g: pad('x', 32), f: pad('o', 8) } },
      B: { bars: 8,
        bel: '@1/3 C5*3 F5*2 G5 Ab5*6 | .*12 | Bb4*3 Eb5*2 F5 G5*6 | .*12 | Ab4*3 Db5*2 Eb5 F5*6 | .*12 | E5*6 .*6 | .*12 |',
        vc: '@4 F2*2 | Eb2*2 | Db2*2 | C2*2 |',
        dn: '@4 F2+C3*8 |',
        pad: '@4 F3+Ab3+C4 | F3+Ab3+C4 | Eb3+G3+Bb3 | Eb3+Gb3+Bb3 | Db3+F3+Ab3 | Db3+F3+Bb3 | C3+E3+G3 | C3+E3+Bb3 |',
        cho: '@4 . | C4 | . | Bb3 | . | Ab3 | . | G3 |',
        org: '@4 . | . | Gb5 | . | . | . | Db5 | . |',
        dr: { step: 1, f: pad('o', 8) } }
    },
    order: ['A', 'B']
  };

  // ======================================================================
  // 8. CAVERNS — "Where the Dark Water Sleeps"  C# minor, 80 BPM
  // ======================================================================
  (function () {
    var Cm9 = 'C#4 G#4 D#5 E5 G#5 E5 D#5 G#4', Am7 = 'A3 E4 G#4 C#5 E5 C#5 G#4 E4', Fm9 = 'F#3 C#4 G#4 A4 E5 A4 G#4 C#4',
        Gs4 = 'G#3 D#4 C#5 D#5 G#5 D#5 C#5 D#4', Gs = 'G#3 D#4 B#4 D#5 G#5 D#5 B#4 D#4', Em7 = 'E3 B3 D#4 G#4 B4 G#4 D#4 B3',
        Am9 = 'A3 E4 B4 C#5 G#5 C#5 B4 E4', Gs7 = 'G#3 D#4 B#4 F#5 G#5 F#5 B#4 D#4';
    T.caverns = {
      name: 'Where the Dark Water Sleeps', bpm: 80, meter: 4, vol: 1, hum: [0.008, 0.1],
      parts: {
        gl:  { i: 'glass', v: 0.9, p: -0.25, vel: 0.7, fx: { echo: [0.75, 0.35, 0.3] } },
        pad: { i: 'strings', v: 0.45, p: 0.2, vel: 0.5 },
        dn:  { i: 'drone', v: 0.9 },
        fl:  { i: 'flute', v: 0.5, p: 0.3, vel: 0.6, s: 0.6, fx: { echo: [1, 0.3, 0.25] } },
        dr:  { kit: 1, v: 0.6 }
      },
      sections: {
        A: { bars: 8, gl: bars('@0.5', [Cm9, Cm9, Am7, Am7, Fm9, Fm9, Gs4, Gs]),
          dn: '@4 C#2*2 | A1*2 | F#1*2 | G#1*2 |',
          pad: '@4 E4+G#4*2 | C#4+E4*2 | C#4+A4*2 | C#4+D#4 B#3+D#4 |',
          dr: { step: 0.25, p: hits(64, [4, 30, 43, 58]), f: pad('o', 128) } },
        B: { bars: 8, gl: bars('@0.5', [Cm9, Cm9, Em7, Em7, Am9, Am9, Gs4, Gs7]),
          dn: '@4 C#2*2 | E2*2 | A1*2 | G#1*2 |',
          pad: '@4 E4+G#4*2 | D#4+G#4*2 | C#4+E4*2 | C#4+D#4 B#3+F#4 |',
          fl: '@1 . . G#5*2 | E5*2 D#5 C#5 | B4*4 | .*4 | . . G#5*2 | B5*2 A5 G#5 | F#5*4 | D#5*4 |',
          dr: { step: 0.25, p: hits(64, [10, 23, 47, 52]), f: pad('o', 128) } }
      },
      order: ['A', 'B']
    };
  })();

  // ======================================================================
  // 9. CLOCK TOWER — "Gears of the Midnight Hour"  B minor, 144 BPM
  // ======================================================================
  (function () {
    var Bm = cell4('B3', 'F#4', 'D4', 'F#4'), Gc = cell4('B3', 'G4', 'D4', 'G4'), Em = cell4('B3', 'G4', 'E4', 'G4'), Fs = cell4('A#3', 'F#4', 'C#4', 'F#4'),
        Cc = cell4('C4', 'G4', 'E4', 'G4'), Fc = cell4('C4', 'A4', 'F4', 'A4');
    var OST_A = bars('@0.25', [Bm, Bm, Gc, Gc, Em, Fs, Bm, Fs]);
    var OST_C = bars('@0.25', [Bm, Cc, Bm, Cc, Em, Fc, Fs, Fs]);
    function bq(r) { return r + "1' " + r + "2' " + r + "1' " + r + "2'"; }
    var BASS_A = bars('@1', [bq('B'), bq('B'), bq('G'), bq('G'), bq('E'), bq('F#'), bq('B'), bq('F#')]);
    var BASS_C = bars('@1', [bq('B'), bq('C'), bq('B'), bq('C'), bq('E'), bq('F'), bq('F#'), bq('F#')]);
    function stab(c) { return c + "'! . . " + c + "' . . . ."; }
    function stab4(c) { return c + "'! . " + c + "' . " + c + "'! . " + c + "' ."; }
    var BRS_B = bars('@0.5', [stab('B3+D4+F#4'), stab('B3+D4+F#4'), stab('B3+D4+G4'), stab('B3+D4+G4'), stab('B3+E4+G4'), stab('A#3+C#4+F#4'), stab('B3+D4+F#4'), stab('A#3+C#4+F#4')]);
    var BRS_C = bars('@0.5', [stab4('B3+D4+F#4'), stab4('C4+E4+G4'), stab4('B3+D4+F#4'), stab4('C4+E4+G4'), stab4('B3+E4+G4'), stab4('C4+F4+A4'), stab4('A#3+C#4+F#4'), stab4('A#3+C#4+F#4')]);
    var MEL = '@0.5 F#5*6 E5 D5 | C#5*4 D5*2 E5*2 | D5*6 B4*2 | G5*4 F#5*2 E5*2 | E5*4 G5*2 B5*2 | A#4*4 C#5*2 E5*2 | F#5*4 D5*2 B4*2 | C#5*8 |';
    var TT = { w: 'x...x...x...x...', u: '..o...o...o...o.' };
    T.clocktower = {
      name: 'Gears of the Midnight Hour', bpm: 144, meter: 4, vol: 1, hum: [0.002, 0.05],
      parts: {
        ost:  { i: 'strings_stac', v: 0.85, p: 0.2, vel: 0.7 },
        bass: { i: 'contrabass', v: 0.85, gate: 0.5 },
        brs:  { i: 'brass', v: 0.8, p: -0.15 },
        mel:  { i: 'violins', v: 0.85, p: -0.25 },
        hpsi: { i: 'harpsichord', v: 0.55, p: 0.35 },
        dr:   { kit: 1, v: 0.75 }
      },
      sections: {
        A: { bars: 8, ost: OST_A, bass: BASS_A, dr: { step: 0.25, w: TT.w, u: TT.u } },
        B: { bars: 8, ost: OST_A, bass: BASS_A, brs: BRS_B, mel: MEL, dr: { step: 0.25, w: TT.w, u: TT.u, a: pad('x', 32) } },
        C: { bars: 8, ost: OST_C, bass: BASS_C, brs: BRS_C, mel: '@4 B4 | C5 | B4 | C5 | E5 | F5 | F#5 | F#5 |',
          dr: { step: 0.25, w: TT.w, u: TT.u, l: 'oooooooooooooooo', k: 'x...x...x...x...', z: pad('', 116) + 'x...........' } },
        D: { bars: 8, ost: OST_A, bass: BASS_A, brs: BRS_B, mel: MEL, hpsi: MEL,
          dr: dsec(8, { w: TT.w, u: TT.u, k: 'X.....x.X.......', s: '....X.......X...', l: 'o.o.o.o.o.o.o.o.' },
            { w: TT.w, k: 'X.....x.X.......', s: '....X...X.XXXXXX' }, 0.25, true) }
      },
      order: ['A', 'B', 'C', 'D']
    };
  })();

  // ======================================================================
  // 10. CATACOMBS — "Lament Beneath the Bones"  Bb minor, 66 BPM
  // ======================================================================
  T.catacombs = {
    name: 'Lament Beneath the Bones', bpm: 66, meter: 4, vol: 1, hum: [0.01, 0.1],
    parts: {
      dn:  { i: 'drone', v: 1.0 },
      cho: { i: 'choir_low', v: 0.85, p: -0.15, vel: 0.7 },
      vc:  { i: 'cello', v: 0.8, p: 0.2, vel: 0.7 },
      hi:  { i: 'violins', v: 0.3, p: 0.4, vel: 0.5, s: 0.7 },
      bel: { i: 'bell_deep', v: 0.4, p: -0.35 },
      dr:  { kit: 1, v: 0.7 }
    },
    sections: {
      A: { bars: 8,
        dn: '@4 Bb2+F3*8 |',
        cho: '@4 Db3+F3 | Eb3+Gb3 | Db3+F3 | Db3+Gb3 | Db3+F3 | Eb3+Gb3 | E3+G3 | C3+F3+A3 |',
        vc: '@1 F3*3 Gb3 | Gb3*2 F3 Eb3 | Db3*4 | .*3 C3 | Db3*2 Eb3 F3 | Gb3*3 F3 | E3*3 F3 | F3*4 |',
        hi: '@4 . | . | . | . | . | . | . | A5 |',
        dr: { step: 0.5, t: hits(64, [0, 21, 23, 40, 52, 54]), f: hits(64, [0, 32]), g: hits(64, [0]) } },
      B: { bars: 8,
        dn: '@4 Bb2+F3*8 |',
        cho: '@1 Bb3*2 Cb4 Bb3 | A3*3 Bb3 | Db4*2 C4 Bb3 | A3*4 | Bb3*2 Db4 F4 | E4*3 Eb4 | Db4*2 C4 A3 | Bb3*4 |',
        vc: '@4 Bb2*2 | Gb2*2 | Bb2*2 | F2*2 |',
        bel: '@4 . | . | Bb3 | . | . | . | Bb3 | . |',
        hi: '@4 . | . | . | Cb5 | . | . | . | A4 |',
        dr: { step: 0.5, t: hits(64, [8, 27, 29, 44, 60, 62]), f: hits(64, [16, 48]) } }
    },
    order: ['A', 'B']
  };

