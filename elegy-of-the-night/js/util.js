/* Elegy of the Night — util.js
 * Global namespace, constants and small helpers shared by every module.
 * Classic script (no modules) so the game also runs from file://.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});

  // ---- Core constants -------------------------------------------------------
  G.W = 384; // internal resolution (pixels)
  G.H = 224;
  G.TILE = 16;
  G.CELL_W = 24; // tiles per map cell (one screen)
  G.CELL_H = 14;
  G.CELL_PX_W = G.CELL_W * G.TILE; // 384
  G.CELL_PX_H = G.CELL_H * G.TILE; // 224
  G.FPS = 60;
  G.VERSION = '1.0.0';
  G.DEBUG = false;

  const U = (G.util = {});

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
  U.sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
  U.rnd = (a, b) => a + Math.random() * (b - a);
  U.irnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  U.angle = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
  U.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  U.pointIn = (px, py, r) => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
  U.wrapAngle = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  // FNV-1a string hash → uint32
  U.hash = function (str) {
    let h = 2166136261 >>> 0;
    str = String(str);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };

  // Seeded RNG (mulberry32)
  U.RNG = function (seed) {
    let s = (typeof seed === 'string' ? U.hash(seed) : seed >>> 0) || 1;
    const next = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      range: (a, b) => a + next() * (b - a),
      int: (a, b) => Math.floor(a + next() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
    };
  };

  U.ease = {
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: (t) => 1 - (1 - t) * (1 - t),
    in: (t) => t * t,
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
  };

  // ---- Colors ---------------------------------------------------------------
  U.hex2rgb = function (hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgb2hex = function (r, g, b) {
    const c = (v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  };
  U.mix = function (c1, c2, t) {
    const a = U.hex2rgb(c1), b = U.hex2rgb(c2);
    return U.rgb2hex(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t));
  };
  // amt > 0 lightens towards white, < 0 darkens towards black
  U.shade = function (c, amt) {
    return amt >= 0 ? U.mix(c, '#ffffff', amt) : U.mix(c, '#000000', -amt);
  };
  U.rgba = function (hex, a) {
    const c = U.hex2rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };

  // ---- Misc -----------------------------------------------------------------
  U.clone = (o) => JSON.parse(JSON.stringify(o));
  U.fmtTime = function (frames) {
    const s = Math.floor(frames / 60);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  };
  U.uid = (function () {
    let n = 0;
    return () => ++n;
  })();
  U.removeIf = function (arr, fn) {
    let j = 0;
    for (let i = 0; i < arr.length; i++) if (!fn(arr[i])) arr[j++] = arr[i];
    arr.length = j;
    return arr;
  };

  // Simple event bus
  const listeners = {};
  G.on = function (ev, fn) {
    (listeners[ev] = listeners[ev] || []).push(fn);
  };
  G.emit = function (ev, a, b, c) {
    const l = listeners[ev];
    if (l) for (let i = 0; i < l.length; i++) l[i](a, b, c);
  };

  // Safe storage helpers (localStorage can throw in sandboxes)
  G.store = {
    get(key) {
      try {
        const v = root.localStorage && root.localStorage.getItem(key);
        return v == null ? null : JSON.parse(v);
      } catch (e) {
        return null;
      }
    },
    set(key, val) {
      try {
        if (!root.localStorage) return false;
        root.localStorage.setItem(key, JSON.stringify(val));
        return true;
      } catch (e) {
        return false;
      }
    },
    del(key) {
      try {
        root.localStorage && root.localStorage.removeItem(key);
      } catch (e) {}
    },
  };
})();
