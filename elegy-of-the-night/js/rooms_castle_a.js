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
 *    small upward boost of the transition is enough to step onto it (steer while rising);
 *    boss arenas that need a flat floor cover the hole with a one-way trapdoor instead
 *    (land on it with the double jump; ↓+jump drops back through)
 *  - the `decor` lists are chosen so that no floor-standing decoration (statue, candelabra,
 *    desk, globe...) is drawn at a cell bottom without a floor under it
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
  R({ id: 'gal_hall', area: 'gallery', x: 16, y: 16, w: 4, h: 3, lvl: 0, entry: 'L2', gates: { L0: 1, R0: 1, 'item:hp_up': 1 }, decor: ['window', 'chandelier', 'curtain', 'painting', 'statue'] }, (b) => {
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
    b.hidden(3, 25, 'roast_fowl');
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
    b.candle(12, 23, 'sub:axe');
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
  R({ id: 'gal_west', area: 'gallery', x: 14, y: 15, w: 2, h: 2, lvl: 1, entry: 'R1', gates: { T0: 4 }, decor: ['pillar', 'window', 'painting', 'chandelier', 'statue', 'curtain'] }, (b) => {
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
    // east side: a step, a balcony over the door, and a high ledge for the ring
    b.plat(37, 41, 22);
    b.plat(40, 46, 18);
    b.plat(41, 45, 12);
    b.candle(44, 9);
    b.item(43, 11, 'garnet_ring');
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
    b.relic(1, 6, 'lore_lens'); // optional relic on the high west ledge
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
  R({ id: 'gal_tower_seal', area: 'gallery', x: 24, y: 15, w: 1, h: 2, lvl: 1, entry: 'L1', gates: { T0: 4 }, decor: ['window', 'pillar', 'painting', 'statue', 'chandelier', 'curtain'] }, (b) => {
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
    b.candle(24, 22);
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
  R({ id: 'gal_east', area: 'gallery', x: 26, y: 17, w: 4, h: 2, lvl: 1, entry: 'L1', decor: ['window', 'window', 'chandelier', 'window', 'statue', 'curtain'] }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('R', 0);
    // balcony reached by a short staircase
    b.fill(36, 18, 55, 19);
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

  // =============================== LONG LIBRARY ===============================

  // L1 — vestibule
  R({ id: 'lib_entry', area: 'library', x: 30, y: 17, w: 3, h: 1, lvl: 1, entry: 'L0' }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    // bookcase arches hanging from the ceiling
    b.stamp(14, 2, ['######', '######', ' #### ']);
    b.stamp(46, 2, ['######', '######', ' #### ']);
    // reading gallery on wooden walkways
    b.plat(21, 30, 8);
    b.plat(36, 43, 5);
    b.plat(52, 61, 8);
    // a low step up to the reading desks
    b.fill(32, 11, 41, 11);
    b.stairs(31, 11, 1, 'r');
    b.stairs(42, 11, 1, 'l');
    b.candle(8, 10);
    b.candle(25, 6);
    b.candle(39, 3, 'heart_big');
    b.candle(56, 6);
    b.candle(66, 10);
    b.enemy(26, 5, 'flying_tome');
    b.enemy(50, 4, 'flying_tome');
  });

  // L2 — the great hall of the Long Library: tall bookcases, walkways and ladders
  R({ id: 'lib_hall', area: 'library', x: 33, y: 16, w: 5, h: 3, lvl: 1, entry: 'L1', decor: ['globe', 'lamp', 'window', 'lamp', 'window', 'lamp'] }, (b) => {
    b.relic(118, 6, 'familiar_faerie'); // optional relic on the top-east shelf ledge
    b.shell();
    b.door('L', 1);
    b.door('R', 2);
    b.door('R', 0);
    // ---- west: entry walkway and the great stair down to the reading floor
    b.fill(1, 26, 22, 27);
    b.stairs(35, 38, 13, 'l'); // (35,38) → (23,26)
    // reading nook under the walkway: a cracked bookcase hides a life vessel
    b.fill(1, 30, 3, 39);
    b.fill(4, 30, 4, 39, 'B');
    b.hidden(4, 37, 'hp_up');
    // ladder up from the walkway to the west stacks and the high shelf
    b.plat(15, 18, 22);
    b.plat(15, 18, 18);
    b.plat(15, 18, 14);
    b.fill(1, 12, 12, 13);
    b.plat(2, 7, 7);
    b.item(4, 6, 'ember_tome');
    // ---- centre: a freestanding bookcase tower, arched at its foot
    b.fill(44, 16, 51, 35);
    b.stamp(44, 36, ['#      #']);
    b.plat(53, 56, 36);
    b.plat(53, 56, 32);
    b.plat(53, 56, 28);
    b.plat(53, 56, 24);
    b.plat(53, 56, 20);
    // ---- east: walkways at several heights up to the upper stacks door
    b.fill(58, 26, 100, 27);
    b.plat(66, 86, 19);
    b.plat(90, 93, 22);
    b.plat(94, 97, 18);
    b.plat(94, 97, 15);
    b.fill(100, 12, 118, 13);
    b.plat(76, 84, 33);
    // ---- light and life
    b.candle(10, 37);
    b.candle(28, 37);
    b.candle(40, 37);
    b.candle(62, 37);
    b.candle(80, 30);
    b.candle(96, 37);
    b.candle(110, 37);
    b.candle(8, 23);
    b.candle(68, 23);
    b.candle(88, 23);
    b.candle(76, 16, 'heart_big');
    b.candle(6, 9);
    b.candle(47, 13);
    b.candle(108, 9);
    b.enemy(16, 39, 'candle_imp');
    b.enemy(76, 39, 'scholar_ghoul');
    b.enemy(70, 25, 'scholar_ghoul');
    b.enemy(30, 18, 'flying_tome');
    b.enemy(66, 12, 'flying_tome');
    b.enemy(104, 30, 'flying_tome');
  });

  // L3 — the Librarian's counter (shop) and a save point
  R({ id: 'lib_shop', area: 'library', x: 38, y: 18, w: 2, h: 1, lvl: 1, entry: 'L0', darkness: 0.15, decor: ['lamp', 'desk', 'globe', 'lamp'] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    b.stamp(22, 2, ['####', ' ## ']);
    b.shop(14, 11);
    b.save(34, 11);
    b.candle(6, 9);
    b.candle(24, 8);
    b.candle(42, 9);
  });

  // L4 — reading room with the portal book to the Belmont Archives
  R({ id: 'lib_portal', area: 'library', x: 40, y: 17, w: 2, h: 2, lvl: 1, entry: 'L1', decor: ['lamp', 'window', 'globe', 'lamp', 'desk'] }, (b) => {
    b.shell();
    b.door('L', 1);
    // mezzanine of stacks over the reading room
    b.fill(26, 12, 46, 13);
    b.plat(14, 19, 20);
    b.plat(20, 24, 16);
    b.fill(44, 2, 46, 11);
    b.fill(43, 8, 43, 11, 'B');
    b.hidden(43, 11, 'red_wine');
    b.portal(24, 25, 'arc_entry', 5, 11);
    b.candle(8, 23);
    b.candle(36, 23);
    b.candle(16, 17);
    b.candle(32, 9);
  });

  // L5 — upper stacks corridor
  R({ id: 'lib_upper', area: 'library', x: 38, y: 16, w: 4, h: 1, lvl: 1, entry: 'L0' }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    // bookcases hanging from the ceiling, walkways in between
    b.stamp(12, 2, ['#######', '#######', '#######', ' ##### ']);
    b.stamp(50, 2, ['#######', '#######', ' ##### ']);
    b.plat(22, 34, 8);
    b.plat(38, 44, 5);
    b.item(41, 4, 'sapphire_ring');
    b.fill(60, 10, 67, 11);
    solidStairs(b, 58, 11, 2, 'r', 11);
    solidStairs(b, 69, 11, 2, 'l', 11);
    b.plat(74, 82, 8);
    b.fill(88, 2, 94, 6);
    b.fill(88, 6, 90, 6, 'B');
    b.hidden(89, 6, 'bread');
    b.item(78, 7, 'mana_tonic');
    b.candle(8, 10);
    b.candle(28, 6);
    b.candle(48, 10);
    b.candle(63, 7);
    b.candle(84, 10);
    b.enemy(30, 11, 'candle_imp');
    b.enemy(70, 11, 'candle_imp');
    b.enemy(54, 5, 'flying_tome');
  });

  // L6 — teleporter
  R({ id: 'lib_tp', area: 'library', x: 42, y: 16, w: 1, h: 1, lvl: 1, darkness: 0.1 }, (b) => {
    b.shell();
    b.door('L', 0);
    b.tp(13, 11);
    b.candle(6, 9);
    b.candle(19, 9);
  });

  // =============================== CLOCK TOWER ===============================

  // C1 — base of the tower: a tall shaft of beams, ledges and gear lifts
  R({ id: 'clk_base', area: 'clocktower', x: 24, y: 11, w: 2, h: 4, lvl: 4, entry: 'B0' }, (b) => {
    b.shell();
    thinFloor(b, 1, 46);
    b.door('B', 0, 1);
    b.door('R', 1);
    b.door('T', 1);
    // ---- lower shaft: a zig-zag of wall ledges and hanging platforms (west)...
    b.plat(11, 18, 51);
    b.fill(1, 47, 7, 48);
    b.plat(11, 18, 43);
    b.fill(1, 39, 7, 40);
    b.plat(11, 18, 35);
    b.fill(1, 31, 7, 32);
    b.plat(11, 18, 27);
    // ...and a gear lift (east) up to the catwalk of the gear-room door
    b.mplat(41, 52, { dy: -22, len: 3, period: 420 });
    b.fill(45, 30, 46, 49, '^');
    b.fill(24, 36, 31, 37);
    b.fill(26, 44, 33, 44);
    // ---- catwalk to the gear room (R1); the section over the lift is jump-through
    b.fill(22, 26, 38, 26);
    b.plat(39, 43, 26);
    b.fill(44, 26, 46, 26);
    // ---- upper shaft
    b.plat(14, 21, 22);
    b.fill(1, 18, 10, 18);
    b.plat(14, 21, 14);
    b.fill(25, 10, 32, 10);
    b.plat(32, 39, 5); // jump-off under the T1 hole
    b.mplat(41, 22, { dy: -16, len: 3, period: 360, phase: 90 });
    // ceiling spikes over the west ledge
    b.fill(1, 2, 8, 2);
    b.fill(1, 3, 8, 3, '^');
    b.candle(4, 44);
    b.candle(4, 28);
    b.candle(15, 48);
    b.candle(15, 32);
    b.candle(28, 33);
    b.candle(30, 23);
    b.candle(4, 15);
    b.candle(28, 7);
    b.candle(42, 3);
    b.enemy(30, 25, 'cog_imp');
    b.enemy(4, 17, 'cog_imp');
    b.enemy(28, 40, 'gorgon_head');
  });

  // C2 — gear room: lifts shuttle over a floor of spikes
  R({ id: 'clk_gears', area: 'clocktower', x: 26, y: 12, w: 4, h: 2, lvl: 4, entry: 'L0', decor: ['gear', 'gear', 'clockface', 'gear', 'pendulum', 'window'] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    b.door('R', 1);
    // entry ledge
    b.fill(1, 12, 13, 13);
    // the spike pit
    b.fill(14, 25, 75, 25, '^');
    // gear pillars, each with maintenance steps to climb out of the pit
    const pillar = (x, top) => {
      b.fill(x, top, x + 3, 25);
      b.fill(x - 1, 21, x - 1, 25);
      b.fill(x + 4, 21, x + 4, 25);
    };
    pillar(21, 16);
    pillar(36, 14);
    pillar(51, 18);
    pillar(66, 14);
    // shuttles between the pillars
    b.mplat(15, 14, { dx: 4, len: 3, period: 200 });
    b.mplat(27, 15, { dx: 5, len: 3, period: 230, phase: 50 });
    b.mplat(42, 16, { dx: 5, len: 3, period: 210, phase: 120 });
    b.mplat(57, 15, { dx: 5, len: 3, period: 240, phase: 20 });
    b.item(52, 17, 'clock_hammer');
    // right side: safe landing, steps up to the teleporter door, the save door below
    b.plat(79, 83, 22);
    b.plat(79, 83, 18);
    b.plat(79, 83, 15);
    b.fill(86, 12, 94, 13);
    b.candle(6, 10);
    b.candle(37, 11, 'sub:stopwatch');
    b.candle(67, 11);
    b.candle(88, 23);
    b.candle(90, 10);
    b.enemy(46, 6, 'harpy');
    b.enemy(90, 25, 'cog_imp');
  });

  // C3 — teleporter
  R({ id: 'clk_tp', area: 'clocktower', x: 30, y: 12, w: 1, h: 1, lvl: 4, darkness: 0.08 }, (b) => {
    b.shell();
    b.door('L', 0);
    b.tp(13, 11);
    b.candle(19, 9);
  });

  // C4 — save room
  R({ id: 'clk_save', area: 'clocktower', x: 30, y: 13, w: 1, h: 1, lvl: 4, darkness: 0.05 }, (b) => {
    b.shell();
    b.door('L', 0);
    b.save(13, 11);
  });

  // C5 — the great clockwork shaft (pendulums, lifts, beams)
  R({ id: 'clk_upper', area: 'clocktower', x: 24, y: 6, w: 3, h: 5, lvl: 4, entry: 'B1', decor: ['pendulum', 'gear', 'clockface', 'pendulum', 'window', 'gear'] }, (b) => {
    b.shell();
    thinFloor(b, 1, 70);
    b.door('B', 1, 1);
    b.door('T', 1);
    // ---- bottom (floor row 69)
    b.plat(25, 31, 65);
    b.fill(12, 61, 21, 61);
    b.fill(1, 57, 8, 57);
    b.plat(12, 19, 53);
    b.fill(41, 65, 50, 65);
    b.fill(54, 61, 63, 61);
    b.fill(64, 57, 70, 57);
    b.plat(53, 60, 53);
    // central beam (cog imp patrol)
    b.fill(23, 49, 48, 50);
    // ---- middle
    b.plat(52, 59, 45);
    b.fill(62, 41, 70, 41);
    b.plat(51, 58, 37);
    b.plat(13, 20, 45);
    b.fill(1, 41, 9, 41);
    // second beam with the inscription
    b.fill(24, 33, 47, 34);
    b.plat(13, 20, 29);
    b.fill(1, 25, 8, 25);
    // a niche in the west wall (life vessel)
    b.fill(1, 17, 5, 20);
    b.item(2, 24, 'hp_up');
    b.plat(12, 19, 21);
    // cracked bricks in the east bay hide an elixir
    b.fill(67, 19, 70, 24);
    b.fill(67, 22, 67, 24, 'B');
    b.hidden(67, 24, 'elixir');
    // lift from the end of the second beam up beside the third
    b.mplat(50, 32, { dy: -16, len: 3, period: 400 });
    // ---- top
    b.fill(24, 17, 47, 18);
    b.plat(52, 59, 21);
    b.fill(62, 25, 70, 25);
    b.plat(53, 60, 13);
    b.plat(13, 20, 13);
    b.plat(41, 47, 9);
    b.plat(24, 30, 9);
    b.plat(31, 40, 5); // jump-off under the T1 hole
    // ceiling spikes in the side bays
    b.fill(1, 2, 10, 3);
    b.fill(1, 4, 10, 4, '^');
    b.fill(61, 2, 70, 3);
    b.fill(61, 4, 70, 4, '^');
    b.lore(35, 32, 'cas_clock');
    b.candle(28, 62);
    b.candle(16, 58);
    b.candle(57, 58);
    b.candle(5, 54);
    b.candle(30, 46);
    b.candle(44, 46);
    b.candle(66, 38);
    b.candle(5, 38);
    b.candle(28, 30);
    b.candle(44, 30, 'heart_big');
    b.candle(5, 22);
    b.candle(66, 22);
    b.candle(30, 14);
    b.candle(44, 14);
    b.candle(29, 6);
    b.enemy(36, 48, 'cog_imp');
    b.enemy(36, 55, 'gorgon_head');
    b.enemy(36, 24, 'gorgon_head');
    b.enemy(58, 30, 'harpy');
    b.enemy(15, 10, 'harpy');
  });

  // C6 — top of the tower: the Clockwork Seraph's arena
  R({ id: 'clk_top', area: 'clocktower', x: 24, y: 3, w: 3, h: 3, lvl: 4, entry: 'B1', gates: { T1: 5 }, decor: ['clockface', 'gear', 'window', 'gear', 'clockface', 'window'] }, (b) => {
    b.shell();
    b.door('B', 1);
    b.door('T', 1);
    b.plat(34, 37, 40); // trapdoor over the hole: the arena floor stays flat
    // floating platforms
    b.plat(6, 13, 30);
    b.plat(58, 65, 30);
    b.plat(20, 27, 22);
    b.plat(44, 51, 22);
    // gear housings in the upper corners
    b.fill(1, 2, 8, 9);
    b.stamp(1, 10, ['#######', '#####', '###']);
    b.fill(63, 2, 70, 9);
    b.stamp(64, 10, ['#######', '  #####', '    ###']);
    b.candle(10, 37);
    b.candle(61, 37);
    b.candle(24, 19);
    b.candle(47, 19);
    b.boss(54, 34, 'seraph');
  });

  // =============================== CASTLE KEEP ===============================

  // K1 — west tower of the Keep, above the chapel belfry
  R({ id: 'keep_west', area: 'keep', x: 14, y: 0, w: 3, h: 3, lvl: 5, entry: 'R2', far: 'redmoon', decor: ['window', 'banner', 'chain', 'curtain', 'candelabra'] }, (b) => {
    b.shell();
    thinFloor(b, 1, 25);
    b.door('B', 0, 1);
    b.door('R', 2);
    // the tower core splits the floor: climb the west side, cross over the top, descend east
    b.fill(26, 16, 45, 41);
    b.stamp(26, 14, ['  ################', '####################']);
    // west climb
    b.plat(16, 22, 37);
    b.fill(1, 33, 10, 33);
    b.plat(14, 21, 29);
    b.fill(1, 25, 9, 25);
    b.plat(14, 21, 21);
    b.fill(1, 17, 10, 17);
    b.plat(15, 23, 13);
    // over the core: the crown on a raised plinth
    b.fill(33, 11, 38, 13);
    b.item(35, 10, 'crown_ash');
    // east side: ledges for the way back up
    b.plat(48, 55, 36);
    b.plat(58, 65, 32);
    b.plat(48, 55, 28);
    b.plat(58, 65, 24);
    b.plat(48, 55, 20);
    b.plat(58, 66, 16);
    b.fill(66, 2, 70, 9);
    b.fill(66, 10, 70, 10, 'B');
    b.hidden(68, 10, 'pheasant');
    b.candle(6, 30);
    b.candle(6, 14);
    b.candle(18, 26);
    b.candle(30, 9);
    b.candle(42, 9);
    b.candle(52, 37);
    b.candle(62, 21);
    b.enemy(18, 40, 'blood_skeleton');
    b.enemy(40, 13, 'axe_lord');
    b.enemy(60, 39, 'blood_skeleton');
  });

  // K2 — throne antechamber: the page-locked door to the throne room
  R({
    id: 'keep_hall', area: 'keep', x: 17, y: 1, w: 6, h: 2, lvl: 5, entry: 'L1',
    decor: ['curtain', 'window', 'banner', 'curtain', 'window', 'chain'],
    onEnter(g, room) {
      G.setDoorLocked(room, 'T', 1, !G.state.flags.keep_open);
    },
  }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('R', 1);
    b.door('T', 1);
    // grand double staircase up to the sealed door
    b.fill(29, 12, 42, 13);
    b.stairs(16, 24, 13, 'r'); // (16,24) → (28,12)
    b.stairs(55, 24, 13, 'l'); // (55,24) → (43,12)
    b.plat(29, 31, 9);
    b.plat(32, 39, 5); // jump-off under the T1 door
    b.pagelock(35, 25);
    b.lore(28, 25, 'cas_keep');
    b.save(8, 25);
    // the long gallery: balconies between the curtains
    b.stairs(62, 24, 7, 'r'); // (62,24) → (68,18): low end floats over the floor
    b.fill(69, 18, 77, 19);
    b.fill(84, 14, 92, 15);
    b.item(88, 13, 'nightguard');
    // a cracked pilaster at the end of the high balcony hides the dhampir's blade
    b.fill(93, 4, 95, 15);
    b.fill(93, 11, 93, 13, 'B');
    b.hidden(93, 13, 'dhampir_blade');
    // east mezzanine under the arches; its far wall is cracked too
    b.stamp(100, 2, ['#####', ' ### ']);
    b.stamp(120, 2, ['#####', ' ### ']);
    b.stairs(98, 24, 9, 'r'); // (98,24) → (106,16)
    b.fill(107, 16, 135, 17);
    b.fill(136, 2, 142, 15);
    b.fill(136, 13, 136, 15, 'B');
    b.hidden(136, 15, 'life_apple');
    b.candle(118, 13, 'heart_big');
    b.candle(130, 13);
    b.candle(20, 22);
    b.candle(50, 22);
    b.candle(35, 9);
    b.candle(70, 22);
    b.candle(88, 22);
    b.candle(106, 22);
    b.candle(118, 22);
    b.candle(136, 22);
  });

  // K3 — east tower of the Keep, above the Clock Tower (reached by bat through B2)
  R({ id: 'keep_east', area: 'keep', x: 23, y: 0, w: 3, h: 3, lvl: 5, entry: 'B2', far: 'redmoon', decor: ['window', 'banner', 'curtain', 'candelabra', 'chain'] }, (b) => {
    b.relic(1, 34, 'echo_bat'); // optional relic on the west ledge above the stairs
    b.shell();
    b.door('B', 2);
    b.door('L', 2);
    // middle floor (west half) and top floor (east half), joined by stairs and ledges
    b.fill(1, 26, 44, 27);
    b.stairs(57, 38, 13, 'l'); // (57,38) → (45,26): low end floats over the ground floor
    b.fill(28, 12, 70, 13);
    b.plat(8, 14, 22);
    b.plat(16, 22, 18);
    b.plat(22, 26, 14);
    // the cloak on a plinth at the top of the tower
    b.fill(64, 10, 67, 11);
    b.item(65, 9, 'royal_cloak');
    // battlements of the inner wall
    b.stamp(1, 2, ['########', '######', '####']);
    b.candle(10, 37);
    b.candle(30, 37);
    b.candle(48, 33);
    b.candle(10, 23);
    b.candle(36, 23);
    b.candle(40, 9);
    b.candle(56, 9);
    b.enemy(20, 25, 'blood_skeleton');
    b.enemy(48, 11, 'axe_lord');
  });

  // K4 — the throne room: the Scrivener's sanctum
  R({ id: 'keep_throne', area: 'keep', x: 18, y: 0, w: 4, h: 1, lvl: 5, entry: 'B0', far: 'redmoon', decor: ['window', 'candelabra', 'window', 'curtain', 'throne'] }, (b) => {
    b.shell();
    b.door('B', 0);
    b.plat(10, 13, 12); // trapdoor over the hole: the floor stays flat
    b.candle(24, 9);
    b.candle(48, 9);
    b.candle(72, 9);
    b.boss(70, 11, 'scrivener');
  });
})();
