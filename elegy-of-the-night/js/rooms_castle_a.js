/* Elegy of the Night — rooms_castle_a.js
 * Castle rooms (see docs/WORLD.md). Uses the G.R room builder.
 *   Marble Gallery (gal_*), Long Library (lib_*), Clock Tower (clk_*), Castle Keep (keep_*).
 *
 * Conventions used here (see docs/ENGINE.md):
 *  - grounded entities stand in the row just above a floor (floor top row R → entity at R-1)
 *  - wall candles hang 2–3 rows above the floor they light
 *  - every T door has a jump-off ledge ~5 rows below the ceiling under the hole, so a single
 *    jump carries Alucard through with the double jump still in reserve
 *  - rooms entered through a B door keep the floor beside the hole one tile thick, so the
 *    small upward boost of the transition is enough to step onto it
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const R = G.R;

  // the Long Library lights its shelves with little lanterns instead of wall sconces
  if (G.world && G.world.areas.library && !G.world.areas.library.candle) G.world.areas.library.candle = 'lantern';

  // staircase with masonry under every step, down to row `base` (inclusive)
  function solidStairs(b, x, y, n, dir, base) {
    b.stairs(x, y, n, dir);
    for (let i = 0; i < n; i++) {
      const sx = dir === 'l' ? x - i : x + i, sy = y - i;
      if (sy + 1 <= base) b.fill(sx, sy + 1, sx, base);
    }
  }
  // a B-door arrival: the floor beside the hole is one tile thick (top at the last row)
  function thinFloor(b, x0, x1) {
    b.clear(x0, b.th - 2, x1, b.th - 2);
  }

  // =============================== MARBLE GALLERY ===============================

  // G1 — marble antechamber between the Entrance and the great hall
  R({ id: 'gal_entry', area: 'gallery', x: 14, y: 18, w: 2, h: 1, lvl: 0, entry: 'L0' }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    // vaulted ceiling: keystones of two arches
    b.stamp(9, 2, ['#####', ' ### ']);
    b.stamp(34, 2, ['#####', ' ### ']);
    // central marble dais with three steps on each side
    b.fill(20, 9, 27, 11);
    solidStairs(b, 17, 11, 3, 'r', 11); // (17,11) (18,10) (19,9)
    solidStairs(b, 30, 11, 3, 'l', 11); // (30,11) (29,10) (28,9)
    // a small balcony over the far door
    b.plat(38, 44, 8);
    b.candle(7, 10, 'heart_big');
    b.candle(41, 6, 'sub:holy_water');
    b.enemy(11, 11, 'marionette');
    b.enemy(24, 8, 'bone_scribe');
  });

  // G2 — the great hall: three tiers of marble around an open atrium
  R({ id: 'gal_hall', area: 'gallery', x: 16, y: 16, w: 4, h: 3, lvl: 0, entry: 'L2', gates: { L0: 1, R0: 1, 'item:hp_up': 1 } }, (b) => {
    b.shell();
    b.door('L', 2);
    b.door('R', 2);
    b.door('L', 0);
    b.door('R', 0);
    // ---- middle tier balconies (floor rows 26-27) and the grand double staircase
    b.fill(1, 26, 30, 27);
    b.fill(65, 26, 94, 27);
    b.stairs(43, 38, 13, 'l'); // (43,38) → (31,26): low end floats one tile above the floor
    b.stairs(52, 38, 13, 'r'); // (52,38) → (64,26)
    // ---- ledges up from the balconies (single jumps), then one double-jump rise to the top tier
    b.plat(25, 29, 22);
    b.plat(28, 32, 18);
    b.plat(66, 70, 22);
    b.plat(63, 67, 18);
    // ---- top tier galleries (floor rows 12-13) joined by floating marble walkways
    b.fill(1, 12, 24, 13);
    b.fill(71, 12, 94, 13);
    b.plat(30, 35, 10);
    b.plat(42, 53, 8);
    b.plat(60, 65, 10);
    // ceiling arches over the galleries
    b.stamp(8, 2, ['######', ' #### ']);
    b.stamp(82, 2, ['######', ' #### ']);
    // a cracked pilaster on the west balcony hides a meal
    b.fill(1, 15, 2, 25);
    b.fill(3, 22, 3, 25, 'B');
    b.hidden(3, 25, 'pheasant');
    // ---- ground tier
    b.npc(10, 39, 'maria', { scene: 'maria_gallery', scene2: 'maria_again' });
    b.candle(16, 37);
    b.candle(30, 37);
    b.candle(47, 36, 'heart_big');
    b.candle(64, 37);
    b.candle(80, 37);
    b.enemy(24, 39, 'marionette');
    b.enemy(74, 39, 'marionette');
    b.enemy(47, 30, 'mirror_wraith');
    // ---- middle tier
    b.candle(12, 23);
    b.candle(84, 23);
    b.enemy(78, 25, 'gargoyle');
    b.item(91, 25, 'velvet_hat');
    // ---- top tier
    b.candle(12, 9);
    b.candle(84, 9);
    b.candle(33, 7);
    b.candle(62, 7);
    b.item(47, 7, 'hp_up');
  });

  // G3 — small west hall under the Royal Chapel, sealed by Belmont gold
  R({ id: 'gal_west', area: 'gallery', x: 14, y: 15, w: 2, h: 2, lvl: 1, entry: 'R1', gates: { T0: 4 } }, (b) => {
    b.shell();
    b.door('R', 1);
    b.door('T', 0);
    // the seal plugs the stairwell to the Chapel
    b.fill(10, 1, 13, 1, 'X');
    // upper landing reached by a marble staircase
    b.fill(1, 12, 22, 13);
    b.stairs(35, 24, 13, 'l'); // (35,24) → (23,12)
    // landing under the seal (double jump from the upper floor)
    b.plat(8, 15, 5);
    // a balcony on the east side
    b.plat(38, 46, 15);
    b.plat(40, 44, 9);
    b.candle(42, 7);
    b.item(42, 8, 'garnet_ring');
    b.candle(6, 9);
    b.candle(18, 9);
    b.candle(12, 23);
    b.candle(28, 23);
    b.enemy(14, 25, 'spear_guard');
    // cracked marble at the foot of the west wall
    b.fill(1, 20, 2, 25);
    b.fill(2, 24, 2, 25, 'B');
    b.hidden(2, 25, 'blood_orange');
  });

  // G4 — upper gallery corridor: paintings and chandeliers
  R({ id: 'gal_upper', area: 'gallery', x: 20, y: 16, w: 4, h: 1, lvl: 1, entry: 'L0', decor: ['painting', 'chandelier', 'painting', 'window', 'curtain', 'painting', 'statue'] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    // raised marble walkway with steps
    b.fill(20, 10, 33, 11);
    solidStairs(b, 18, 11, 2, 'r', 11);
    solidStairs(b, 35, 11, 2, 'l', 11);
    // display ledges
    b.plat(41, 46, 8);
    b.plat(50, 55, 5);
    b.item(52, 4, 'mp_up');
    // iron helm on a plinth
    b.fill(73, 10, 74, 11);
    b.item(73, 9, 'iron_helm');
    b.plat(83, 88, 8);
    // ceiling arches
    b.stamp(9, 2, ['#####', ' ### ']);
    b.stamp(59, 2, ['#####', ' ### ']);
    b.candle(10, 10);
    b.candle(27, 7);
    b.candle(44, 6);
    b.candle(64, 10);
    b.candle(80, 10);
    b.enemy(27, 9, 'gargoyle');
    b.enemy(86, 7, 'gargoyle');
    b.enemy(66, 11, 'spear_guard');
  });

  // G5 — the sealed stair to the Clock Tower
  R({ id: 'gal_tower_seal', area: 'gallery', x: 24, y: 15, w: 1, h: 2, lvl: 1, entry: 'L1', gates: { T0: 4 } }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('T', 0);
    // climbing ledges below the seal
    b.plat(13, 21, 22);
    b.plat(3, 11, 18);
    // the Belmont seal across the whole shaft
    b.fill(1, 14, 22, 14, 'X');
    // above the seal: ledges to the tower door
    b.plat(5, 12, 12);
    b.plat(14, 20, 9);
    b.plat(8, 15, 5);
    b.candle(17, 19);
    b.candle(6, 15);
    b.candle(18, 6);
  });

  // G6 — corridor to the Bone Colossus, a longsword on display
  R({ id: 'gal_corridor', area: 'gallery', x: 20, y: 18, w: 3, h: 1, lvl: 0, entry: 'L0' }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    // display dais
    b.fill(30, 10, 41, 11);
    solidStairs(b, 28, 11, 2, 'r', 11);
    solidStairs(b, 43, 11, 2, 'l', 11);
    b.fill(35, 9, 36, 9);
    b.item(35, 8, 'longsword');
    // arches
    b.stamp(14, 2, ['#####', ' ### ']);
    b.stamp(54, 2, ['#####', ' ### ']);
    b.candle(8, 10);
    b.candle(22, 10);
    b.candle(35, 5, 'heart_big');
    b.candle(50, 10);
    b.candle(64, 10);
    b.enemy(16, 11, 'marionette');
    b.enemy(52, 11, 'marionette');
    b.enemy(62, 11, 'spear_guard');
  });

  // G7 — Bone Colossus arena
  R({ id: 'gal_boss', area: 'gallery', x: 23, y: 17, w: 2, h: 2, lvl: 0, entry: 'L1', decor: ['window', 'statue', 'pillar', 'window', 'chandelier'] }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('R', 1);
    // vaulted ceiling
    b.fill(1, 2, 46, 5);
    b.stamp(1, 6, ['#######', '####', '##']);
    b.stamp(40, 6, ['#######', '   ####', '     ##']);
    // two small ledges near the walls
    b.plat(2, 5, 20);
    b.plat(42, 45, 20);
    b.candle(10, 23);
    b.candle(24, 18);
    b.candle(38, 23);
    b.boss(36, 25, 'colossus');
  });

  // G8 — save room
  R({ id: 'gal_save', area: 'gallery', x: 25, y: 18, w: 1, h: 1, lvl: 1, darkness: 0.05 }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    b.save(12, 11);
  });

  // G9 — east wing: tall windows, a balcony and the upper door to the Library
  R({ id: 'gal_east', area: 'gallery', x: 26, y: 17, w: 4, h: 2, lvl: 1, entry: 'L1', decor: ['window', 'window', 'statue', 'chandelier', 'window', 'curtain'] }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('R', 0);
    // balcony reached by a short staircase
    b.fill(36, 18, 52, 19);
    b.stairs(29, 24, 7, 'r'); // (29,24) → (35,18)
    // upper floor to the Library (double jump from the balcony)
    b.fill(58, 12, 94, 13);
    // floating platforms between the west windows (heart vessel)
    b.plat(12, 16, 21);
    b.plat(4, 8, 16);
    b.plat(13, 18, 11);
    b.plat(4, 8, 6);
    b.item(6, 5, 'heart_up');
    // storage nook under the upper floor, walled with cracked marble
    b.fill(88, 20, 94, 25);
    b.clear(90, 22, 94, 25);
    b.fill(88, 22, 89, 25, 'B');
    b.item(92, 25, 'potion');
    b.candle(20, 23, 'sub:cross');
    b.candle(44, 15);
    b.candle(64, 23);
    b.candle(76, 23);
    b.candle(70, 9);
    b.candle(86, 9);
    b.enemy(44, 10, 'mirror_wraith');
    b.enemy(70, 11, 'gargoyle');
  });
})();
