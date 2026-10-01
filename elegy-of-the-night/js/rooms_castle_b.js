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

  // ======================== UNDERGROUND CAVERNS ========================
  // ent_cellar (rooms_castle.js) reaches the Caverns through a 1-tile wolf
  // tunnel: its R0 door needs the wolf (lvl 2) — tell the validator.
  const cellar = G.world.rooms.ent_cellar;
  if (cellar) cellar.gates = Object.assign({ R0: 2 }, cellar.gates || {});

  // C1 — the descent: the cellar's wolf tunnel opens high in a cave shaft that
  // winds down to a drop into the lake (B0) and a passage to the falls (R2).
  R({ id: 'cav_entry', area: 'caverns', x: 14, y: 20, w: 2, h: 3, lvl: 2, darkness: 0.5 }, (b) => {
    b.shell();
    // the tunnel from the cellar: only row 11 open at the left edge
    b.fill(0, 2, 6, 10);
    b.set(0, 11, '.');
    b.clear(1, 11, 6, 11);
    // irregular ceiling of the upper chamber
    hang(b, 7, 2, '3322111112223344432211122333221112234455566');
    // top shelf (T) where the wolf comes out
    b.fill(0, 12, 15, 15);
    hang(b, 1, 16, '22333221110');
    // right wall bulge with a high niche
    b.fill(40, 2, 46, 13);
    b.clear(41, 8, 45, 11);
    b.fill(40, 8, 40, 11, 'B'); // cracked rock hides the niche
    hang(b, 34, 14, '1122233444455');
    // shelf A (middle)
    b.fill(18, 19, 29, 20);
    hang(b, 19, 21, '1221100121');
    // shelf B (right)
    b.fill(32, 25, 46, 27);
    hang(b, 34, 28, '01122333444');
    // shelf C (left)
    b.fill(1, 30, 22, 32);
    hang(b, 4, 33, '0112210001221');
    // low mound D on the right of the ground
    rise(b, 26, 39, '1234444444321');
    // ground with the drop to the lake
    b.door('B', 0);
    well(b, 0);
    b.door('R', 2);
    // ---- entities
    b.candle(10, 8);
    b.candle(24, 15);
    b.candle(38, 21);
    b.candle(8, 27);
    b.candle(30, 32);
    b.candle(42, 36, 'heart_big');
    b.item(43, 11, 'hp_up');
    b.enemy(24, 9, 'crystal_crawler');
    b.enemy(16, 36, 'crystal_crawler');
  });
})();
