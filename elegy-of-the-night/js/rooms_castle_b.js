/* Elegy of the Night — rooms_castle_b.js
 * Castle rooms (see docs/WORLD.md): Royal Chapel, Underground Caverns and
 * Catacombs. Uses the G.R room builder.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const R = G.R;
  const U = G.util;

  // ============================== helpers ==============================
  // Column profiles: each character is a rock thickness in tiles
  // ('0'-'9', 'a'-'z' = 10..35, ' ' or '.' = 0).
  const depth = (ch) => (ch === ' ' || ch === '.' ? 0 : parseInt(ch, 36) || 0);
  // rock hanging down from row y0 (ceilings, overhangs)
  function hang(b, x0, y0, prof, ch) {
    for (let i = 0; i < prof.length; i++) {
      const d = depth(prof[i]);
      if (d > 0) b.fill(x0 + i, y0, x0 + i, y0 + d - 1, ch);
    }
  }
  // rock rising up from row y1 (floors, mounds); one-tile steps get a slope
  // tile so the ground can be walked without hopping (slopes:false to skip)
  function rise(b, x0, y1, prof, slopes) {
    const hs = [];
    for (let i = 0; i < prof.length; i++) {
      hs.push(depth(prof[i]));
      if (hs[i] > 0) b.fill(x0 + i, y1 - hs[i] + 1, x0 + i, y1);
    }
    if (slopes === false) return;
    for (let i = 0; i + 1 < hs.length; i++) {
      const a = hs[i], c = hs[i + 1];
      if (c === a + 1 && a > 0) {
        if (b.get(x0 + i, y1 - a) === '.') b.set(x0 + i, y1 - a, '/');
      } else if (a === c + 1 && c > 0) {
        if (b.get(x0 + i + 1, y1 - c) === '.') b.set(x0 + i + 1, y1 - c, '\\');
      }
    }
  }
  // a sunken lip around a floor hole (B door): the floor next to the hole is one
  // tile lower so a player rising through it can land even with little speed
  function well(b, cell) {
    const c0 = cell * 24 + 10, y = b.th - 2;
    b.clear(c0 - 3, y, c0 - 1, y);
    b.clear(c0 + 4, y, c0 + 6, y);
    b.set(c0 - 4, y, '\\');
    b.set(c0 + 7, y, '/');
  }
})();
