/* Elegy of the Night — rooms_castle.js
 * Rooms of Dracula's castle (map 'castle'). See docs/WORLD.md for the plan.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const R = G.R;

  // =============================== CASTLE ENTRANCE ===============================
  // E1 — the approach: an outdoor bridge in the rain, start position.
  R({ id: 'ent_gate', area: 'entrance', x: 0, y: 20, w: 3, h: 1, outdoor: true, weather: 'rain', darkness: 0.1 }, (b) => {
    b.fill(0, 12, 71, 13); // bridge / ground
    // castle front wall with the gate passage (rows 8..11) at the right edge
    b.fill(62, 0, 71, 7);
    b.fill(60, 3, 61, 7);
    b.stamp(56, 5, ['    ', '  ##', ' ###']);
    b.start(3, 11);
    b.lore(9, 11, 'gate_plaque');
    b.candle(16, 9);
    b.candle(30, 9);
    b.candle(44, 9);
    b.enemy(26, 11, 'ghoul');
    b.enemy(40, 11, 'ghoul');
    b.enemy(50, 4, 'night_bat');
  });

  // E2 — grand entrance hall: ground floor, stairs rising to the left onto a
  // ledge, and a walkway over the hall to the upper door.
  R({ id: 'ent_hall', area: 'entrance', x: 3, y: 19, w: 3, h: 2, lvl: 0 }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('R', 1);
    b.door('R', 0);
    b.fill(1, 12, 31, 13); // left ledge (upper floor level)
    // freestanding stairs: the low end floats one tile above the floor so the
    // ground floor stays walkable in both directions (hop onto the first step)
    b.stairs(44, 24, 13, 'l'); // (44,24) → (32,12)
    b.plat(33, 69, 12); // walkway to the upper door
    b.plat(8, 13, 18);
    b.candle(6, 9);
    b.candle(20, 18);
    b.candle(52, 21);
    b.candle(64, 21);
    b.enemy(16, 25, 'ghoul');
    b.enemy(24, 25, 'ghoul');
    b.enemy(58, 7, 'night_bat');
    b.enemy(20, 11, 'bone_scribe');
    b.trigger(50, 25, 'scrivener_erase', 2, 4);
    b.item(60, 25, 'rusted_saber');
    b.item(4, 11, 'potion');
  });

  // E3 — balcony room: teleporter + the Traveler's Cloak
  R({ id: 'ent_balcony', area: 'entrance', x: 6, y: 19, w: 2, h: 1 }, (b) => {
    b.shell();
    b.door('L', 0);
    b.fill(30, 8, 46, 11);
    b.clear(32, 8, 45, 11);
    b.fill(31, 11, 46, 11);
    b.tp(14, 11);
    b.item(40, 10, 'traveler_cloak');
    b.candle(24, 8);
    b.candle(8, 8);
  });

  // E4 — long corridor
  R({ id: 'ent_corridor', area: 'entrance', x: 6, y: 20, w: 4, h: 1 }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    // a few steps and a raised walkway
    b.fill(20, 11, 27, 11);
    b.fill(24, 10, 27, 10);
    b.fill(40, 10, 52, 11);
    b.plat(56, 62, 8);
    b.fill(70, 9, 73, 11);
    b.stairs(66, 11, 3, 'r');
    b.stairs(77, 11, 3, 'l');
    b.candle(10, 8);
    b.candle(34, 7);
    b.candle(59, 5, 'heart_big');
    b.candle(84, 8);
    b.enemy(16, 11, 'ghoul');
    b.enemy(33, 11, 'bone_scribe');
    b.enemy(47, 9, 'ghoul');
    b.enemy(62, 4, 'night_bat');
    b.enemy(86, 11, 'warg');
    // a cracked block in the ceiling hides some food
    b.fill(80, 2, 84, 5);
    b.fill(81, 5, 83, 5, 'B');
    b.hidden(82, 5, 'blood_orange');
  });

  // E5 — vertical shaft linking the cellar, the save room and the upper corridor
  R({ id: 'ent_shaft', area: 'entrance', x: 10, y: 18, w: 1, h: 3 }, (b) => {
    b.shell(1, 2, 2);
    b.door('L', 2);
    b.door('R', 0);
    b.door('R', 1);
    b.door('R', 2);
    b.cellFloor(0, 18, 23);
    b.cellFloor(1, 18, 23);
    // climbing ledges (<= 4 tiles apart)
    b.plat(3, 8, 36);
    b.plat(12, 17, 32);
    b.plat(4, 9, 28);
    b.plat(12, 17, 24);
    b.plat(4, 9, 20);
    b.plat(12, 17, 16);
    b.plat(4, 10, 12);
    b.candle(6, 33);
    b.candle(15, 21);
    b.candle(7, 9);
    b.enemy(14, 13, 'night_bat');
    b.enemy(8, 25, 'night_bat');
  });

  // E6 — save room
  R({ id: 'ent_save', area: 'entrance', x: 11, y: 19, w: 1, h: 1, darkness: 0.05 }, (b) => {
    b.shell();
    b.door('L', 0);
    b.save(12, 11);
  });

  // E7 — upper corridor towards the Marble Gallery
  R({ id: 'ent_upper', area: 'entrance', x: 11, y: 18, w: 3, h: 1 }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    b.fill(14, 9, 20, 11);
    b.stairs(11, 11, 3, 'r');
    b.stairs(23, 11, 3, 'l');
    b.fill(36, 4, 38, 7);
    b.plat(44, 52, 7);
    b.candle(17, 6);
    b.candle(48, 4, 'sub:dagger');
    b.candle(60, 8);
    b.enemy(30, 11, 'warg');
    b.enemy(56, 11, 'bone_scribe');
    b.item(50, 6, 'heart_up');
  });

  // E8 — cellar with a low tunnel only a wolf can pass (to the Caverns)
  // R0 is the wolf tunnel into the Caverns (lvl 2)
  R({ id: 'ent_cellar', area: 'entrance', x: 11, y: 20, w: 3, h: 1, darkness: 0.35, gates: { R0: 2 } }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    // the right part of the room is a solid mass with a 1-tile-high tunnel
    b.fill(54, 2, 71, 10);
    b.fill(54, 11, 69, 11);
    b.clear(54, 11, 71, 11);
    b.fill(54, 10, 71, 10);
    b.candle(12, 8);
    b.candle(36, 8);
    b.enemy(24, 11, 'ghoul');
    b.enemy(40, 11, 'ghoul');
    b.fill(30, 2, 31, 6, 'B');
    b.hidden(30, 6, 'roast_fowl');
  });
})();
