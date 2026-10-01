/* Elegy of the Night — rooms_archives.js
 * Rooms of the Belmont Archives (map 'archives'). See docs/WORLD.md.
 *
 * The Archives are a pocket realm inside the Belmont Chronicle: a labyrinthine
 * library of the vampire-hunter clan. Five quarters:
 *   Reading Hall (arc_*)   — arrival, reading tables, the crossroads tower
 *   The Stacks (stk_*)     — towering shelves, the Ink Doppelganger, mist relic
 *   Scriptorium (scr_*)    — copyists' desks, scroll archive, the grate column
 *   Hall of Hunters (hun_*)— portraits of the clan, the Echo of the Belmont, Richter
 *   Forbidden Vault (vault_*) — sealed by the Crest, flooded with ink, the Bibliophage
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const R = G.R;
  // every room here lives on the Archives map
  const A = (meta, fn) => R(Object.assign({ map: 'archives' }, meta), fn);

  // ============================== READING HALL ==============================

  // A1 — arrival hall. The portal book back to the Long Library stands in a
  // vaulted alcove; a raised reading gallery spans the middle of the hall.
  A({ id: 'arc_entry', area: 'arc_hall', x: 10, y: 8, w: 3, h: 1, lvl: 1, entry: 'R0', darkness: 0.32,
      decor: ['crest', 'candelabra', 'portrait', 'lectern', 'rift', 'candelabra', 'scrollrack'] }, (b) => {
    b.shell();
    b.door('R', 0);
    // vaulted alcove around the portal book (stepped arch)
    b.fill(1, 2, 15, 2);
    b.fill(1, 3, 2, 3);
    b.fill(13, 3, 15, 3);
    b.fill(15, 4, 15, 6);
    b.fill(14, 4, 14, 4);
    b.portal(4, 11, 'lib_portal', 20, 25);
    b.trigger(8, 11, 'archives_enter', 2, 3);
    b.candle(2, 7);
    b.candle(10, 7);
    // raised reading gallery with stairs on both sides (walkable underneath)
    b.stairs(22, 10, 4, 'r'); // (22,10) → (25,7)
    b.fill(26, 7, 37, 8);
    b.stairs(41, 10, 4, 'l'); // (41,10) → (38,7)
    b.candle(28, 4);
    b.candle(35, 4, 'heart_big');
    // hanging bookcases over the far hall
    b.fill(46, 2, 49, 4);
    b.fill(60, 2, 63, 4);
    // a low bookcase block to hop over near the exit
    b.fill(54, 10, 56, 11);
    b.candle(19, 8);
    b.candle(51, 7);
    b.candle(66, 7);
    b.enemy(64, 7, 'page_swarm');
  });

  // A2 — the Reading Hall: two storeys of shelves around a tall atrium with a
  // grand staircase. Ground floor L1 → R1 is the main road.
  A({ id: 'arc_hall1', area: 'arc_hall', x: 13, y: 7, w: 4, h: 2, lvl: 1, entry: 'L1',
      decor: ['candelabra', 'portrait', 'lectern', 'scrollrack', 'crest', 'candelabra', 'rift', 'chain'] }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('R', 1);
    b.door('T', 1);
    // west upper gallery and the grand staircase down into the atrium
    b.fill(1, 12, 24, 13);
    b.stairs(37, 24, 13, 'l'); // (37,24) → (25,12)
    // balconies up to the hidden study (T1)
    b.plat(27, 31, 8);
    b.plat(33, 38, 5);
    // reading tables climbing to the east gallery
    b.plat(44, 51, 22);
    b.plat(54, 60, 18);
    b.fill(64, 14, 94, 15);
    // east gallery: hunter's knife at the far end, a cracked panel hides food
    b.item(90, 13, 'hunter_knife');
    b.fill(91, 9, 94, 13);
    b.clear(91, 11, 94, 13);
    b.fill(91, 11, 94, 11);
    b.fill(91, 12, 94, 13);
    // ground floor: oath lectern by the entrance
    b.lore(8, 25, 'arc_oath');
    b.candle(4, 21);
    b.candle(14, 20);
    b.candle(22, 21, 'sub:quill');
    b.candle(10, 8);
    b.candle(20, 8);
    b.candle(30, 3);
    b.candle(46, 17);
    b.candle(58, 13);
    b.candle(70, 10);
    b.candle(82, 10);
    b.candle(74, 21);
    b.candle(88, 21);
    b.enemy(52, 9, 'living_grimoire');
    b.enemy(18, 20, 'page_swarm');
    b.enemy(80, 21, 'page_swarm');
    b.enemy(68, 7, 'flying_tome');
  });

  // A3 — hidden study above the Reading Hall. The Belmont Ward lies on a high
  // shelf, reachable only along walkways written in invisible ink.
  A({ id: 'arc_ink', area: 'arc_hall', x: 13, y: 5, w: 4, h: 2, lvl: 1, entry: 'B1', darkness: 0.5,
      gates: { tome: 6, 'item:heart_up': 6 },
      decor: ['scrollrack', 'rift', 'lectern', 'chain', 'candelabra', 'rift'] }, (b) => {
    b.shell();
    b.door('B', 1);
    // raised study on the west side
    b.fill(1, 20, 12, 25);
    b.stairs(15, 25, 3, 'l'); // corner stairs up onto it: (15,25) → (13,23)
    b.fill(13, 24, 15, 25);
    b.clear(13, 23, 13, 23);
    b.plat(4, 10, 15);
    // desks around the arrival hole
    b.plat(20, 26, 22);
    b.plat(44, 50, 22);
    // middle shelf ledge: where the ink road starts
    b.fill(46, 16, 54, 17);
    // the ink road (Lantern of Revelation)
    b.fill(57, 13, 60, 13, 'I');
    b.fill(63, 10, 66, 10, 'I');
    b.fill(69, 7, 73, 7, 'I');
    // the high shelf, on top of a tower of shelves
    b.fill(78, 6, 94, 25);
    b.tome(91, 5, 'belmont_ward');
    b.item(84, 5, 'heart_up');
    b.candle(88, 3);
    // a cracked shelf hides wine
    b.hidden(1, 19, 'red_wine');
    b.fill(2, 17, 3, 19);
    b.candle(6, 12);
    b.candle(24, 18);
    b.candle(40, 20);
    b.candle(50, 13, 'heart_big');
    b.candle(68, 22);
    b.enemy(30, 14, 'page_swarm');
    b.enemy(62, 20, 'flying_tome');
  });

  // A4 — save room
  A({ id: 'arc_save', area: 'arc_hall', x: 17, y: 8, w: 1, h: 1, lvl: 1, darkness: 0.15, decor: ['crest', 'candelabra'] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    b.fill(1, 2, 22, 2);
    b.save(12, 11);
  });

  // A5 — crossroads tower: down to the Stacks, up to the Scriptorium, east to
  // the teleporter. Alternating balconies climb its full height.
  A({ id: 'arc_cross', area: 'arc_hall', x: 18, y: 6, w: 2, h: 4, lvl: 1, entry: 'L2',
      decor: ['portrait', 'chain', 'crest', 'rift', 'chain', 'portrait'] }, (b) => {
    b.shell();
    b.door('L', 2);
    b.door('B', 0);
    b.door('T', 1);
    b.door('R', 3);
    // landing in front of the save room door; the shaft down to the Stacks
    // opens right below its edge
    b.fill(1, 40, 8, 41);
    // way back up from the bottom
    b.plat(19, 24, 50);
    b.plat(14, 18, 46);
    // the climb to the Scriptorium
    b.plat(13, 20, 35);
    b.fill(28, 30, 46, 31);
    b.plat(17, 24, 25);
    b.fill(1, 20, 10, 21);
    b.plat(14, 21, 15);
    b.plat(26, 31, 10);
    b.plat(32, 39, 5);
    // side ledge with the mana prism
    b.fill(40, 17, 46, 18);
    b.item(44, 16, 'mp_up');
    b.candle(4, 36);
    b.candle(30, 47);
    b.candle(40, 27);
    b.candle(6, 16);
    b.candle(20, 11);
    b.candle(36, 2);
    b.enemy(30, 20, 'flying_tome');
    b.enemy(18, 41, 'flying_tome');
  });

  // A6 — teleporter
  A({ id: 'arc_tp', area: 'arc_hall', x: 20, y: 9, w: 1, h: 1, lvl: 1, darkness: 0.2, decor: ['rift', 'crest'] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.tp(12, 11);
  });

  // ================================ THE STACKS ================================

  // S1 — the Stacks shaft, from the crossroads down to the boss corridor. A
  // band of Belmont seals plugs the way to the Forbidden Vault.
  A({ id: 'stk_shaft', area: 'arc_stacks', x: 18, y: 10, w: 2, h: 4, lvl: 1, entry: 'T0', gates: { B0: 4 },
      decor: ['chain', 'portrait', 'rift', 'crest', 'chain'] }, (b) => {
    b.shell();
    b.door('T', 0);
    b.door('L', 1);
    b.door('R', 3);
    b.door('B', 0);
    // the seal band (Belmont Crest)
    b.fill(10, 54, 13, 54, 'X');
    // top ledge under the hole
    b.fill(1, 5, 14, 6);
    b.plat(17, 23, 11);
    b.fill(27, 16, 46, 17);
    b.plat(16, 22, 21);
    // landing of the west door
    b.fill(1, 26, 11, 27);
    b.plat(13, 18, 30);
    b.plat(18, 24, 34);
    b.plat(27, 33, 39);
    b.fill(38, 44, 46, 45);
    b.plat(28, 35, 49);
    b.candle(6, 2);
    b.candle(30, 13);
    b.candle(8, 22);
    b.candle(22, 36);
    b.candle(42, 40);
    b.candle(16, 50);
    b.candle(36, 51);
    b.enemy(41, 15, 'shelf_mimic');
    b.enemy(24, 28, 'page_swarm');
    b.enemy(20, 45, 'page_swarm');
  });

  // S2 — west stacks: aisles of shelves, a raised reading floor, and a low
  // gap under the last shelf that only a wolf can squeeze through.
  A({ id: 'stk_west', area: 'arc_stacks', x: 13, y: 11, w: 5, h: 1, lvl: 1, entry: 'R0', gates: { L0: 2 },
      decor: ['scrollrack', 'candelabra', 'chain', 'lectern', 'rift'] }, (b) => {
    b.shell();
    b.door('R', 0);
    b.door('L', 0);
    // wolf tunnel at row 11 under a solid wall of shelves
    b.fill(0, 2, 12, 10);
    b.hidden(12, 9, 'blood_orange');
    // raised reading floor
    b.stairs(67, 11, 3, 'r');
    b.fill(70, 9, 95, 11);
    b.stairs(98, 11, 3, 'l');
    b.fill(76, 2, 80, 4);
    b.fill(88, 2, 91, 3);
    // hanging shelves
    b.fill(36, 2, 39, 5);
    b.fill(52, 2, 55, 4);
    // a reading shelf with the quill rapier
    b.plat(20, 27, 8);
    b.item(24, 7, 'quill_rapier');
    b.candle(16, 7);
    b.candle(30, 6);
    b.candle(46, 7);
    b.candle(60, 7);
    b.candle(74, 5);
    b.candle(86, 5);
    b.candle(104, 7);
    b.candle(114, 7);
    b.enemy(30, 11, 'ink_slime');
    b.enemy(56, 11, 'ink_slime');
    b.enemy(84, 5, 'living_grimoire');
  });

  // S3 — tiny study reached through the wolf tunnel: the Ink Lance tome
  A({ id: 'stk_tome', area: 'arc_stacks', x: 12, y: 11, w: 1, h: 1, lvl: 2, entry: 'R0', darkness: 0.55,
      decor: ['lectern', 'scrollrack', 'rift'] }, (b) => {
    b.shell();
    b.door('R', 0);
    b.fill(13, 2, 23, 10);
    b.fill(4, 11, 8, 11);
    b.tome(6, 10, 'ink_lance');
    b.candle(3, 6);
    b.candle(10, 6);
  });

  // S4 — corridor to the Doppelganger
  A({ id: 'stk_corridor', area: 'arc_stacks', x: 20, y: 13, w: 4, h: 1, lvl: 1,
      decor: ['candelabra', 'chain', 'scrollrack', 'portrait', 'rift'] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    b.fill(14, 2, 17, 5);
    b.fill(66, 2, 69, 5);
    b.fill(80, 2, 83, 4);
    // raised dais with a high shelf above it (life vessel)
    b.stairs(39, 11, 3, 'r');
    b.fill(42, 9, 53, 11);
    b.stairs(56, 11, 3, 'l');
    b.plat(45, 50, 4);
    b.item(47, 3, 'hp_up');
    b.candle(8, 7);
    b.candle(24, 6, 'sub:inkwell');
    b.candle(36, 7);
    b.candle(60, 7);
    b.candle(74, 7);
    b.candle(90, 7);
    b.enemy(28, 11, 'ink_slime');
    b.enemy(70, 11, 'archive_sentinel');
  });

  // S5 — arena of the Ink Doppelganger
  A({ id: 'stk_doppel', area: 'arc_stacks', x: 24, y: 12, w: 2, h: 2, lvl: 1, darkness: 0.45,
      decor: ['candelabra', 'crest', 'chain', 'portrait', 'rift'] }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('R', 1);
    b.plat(2, 8, 20);
    b.plat(39, 45, 20);
    b.fill(1, 2, 6, 4);
    b.fill(41, 2, 46, 4);
    b.candle(5, 16);
    b.candle(42, 16);
    b.candle(16, 21);
    b.candle(31, 21);
    b.boss(32, 25, 'doppel');
  });

  // S6 — after the boss: the shelves close into a wolf-sized crawlspace
  A({ id: 'stk_after', area: 'arc_stacks', x: 26, y: 13, w: 2, h: 1, lvl: 2, gates: { R0: 2 },
      decor: ['scrollrack', 'chain', 'candelabra'] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    b.fill(34, 2, 47, 10);
    b.plat(16, 22, 8);
    b.item(19, 7, 'ink_dagger');
    b.candle(8, 7);
    b.candle(28, 7);
    b.enemy(26, 11, 'ink_slime');
  });

  // S7 — relic shrine: the Form of Mist
  A({ id: 'stk_mist', area: 'arc_stacks', x: 28, y: 12, w: 2, h: 2, lvl: 2, darkness: 0.5,
      decor: ['crest', 'candelabra', 'rift', 'chain', 'candelabra'] }, (b) => {
    b.shell();
    b.door('L', 1);
    b.fill(0, 14, 11, 24);
    b.fill(24, 23, 35, 25);
    b.stairs(21, 25, 3, 'r');
    b.stairs(38, 25, 3, 'l');
    b.relic(30, 22, 'form_mist');
    b.candle(18, 18);
    b.candle(42, 18);
    b.candle(26, 12);
    b.candle(34, 12);
  });

  // =============================== SCRIPTORIUM ===============================

  // C1 — entrance shaft of the Scriptorium
  A({ id: 'scr_entry', area: 'arc_scriptorium', x: 19, y: 3, w: 2, h: 3, lvl: 1, entry: 'B0',
      decor: ['chain', 'portrait', 'rift', 'crest'] }, (b) => {
    b.shell();
    b.door('B', 0);
    b.door('L', 1);
    b.door('R', 1);
    b.fill(1, 26, 9, 27);
    b.plat(14, 37, 26);
    b.fill(38, 26, 46, 27);
    b.plat(18, 24, 36);
    b.plat(26, 32, 31);
    // upper loft
    b.plat(20, 26, 21);
    b.plat(30, 36, 16);
    b.fill(1, 10, 10, 11);
    b.hidden(1, 9, 'roast_fowl');
    b.candle(4, 6);
    b.candle(24, 12);
    b.candle(42, 21);
    b.candle(6, 34);
    b.candle(30, 37);
    b.enemy(26, 18, 'quill_wraith');
  });

  // C2 — scroll archive (dead end)
  A({ id: 'scr_west', area: 'arc_scriptorium', x: 15, y: 3, w: 4, h: 2, lvl: 1, entry: 'R1',
      decor: ['scrollrack', 'chain', 'scrollrack', 'lectern', 'candelabra', 'rift'] }, (b) => {
    b.shell();
    b.door('R', 1);
    b.fill(1, 12, 60, 13);
    b.stairs(73, 24, 13, 'l');
    b.item(4, 11, 'chain_whip');
    b.item(4, 25, 'inkpot_amulet');
    b.lore(52, 25, 'arc_scrivener');
    b.fill(20, 23, 23, 25);
    b.fill(36, 22, 38, 25);
    b.plat(30, 44, 19);
    b.fill(24, 8, 28, 11);
    b.fill(44, 2, 47, 5);
    b.candle(10, 8);
    b.candle(34, 6);
    b.candle(54, 8);
    b.candle(12, 21);
    b.candle(30, 16);
    b.candle(46, 21);
    b.candle(66, 18);
    b.candle(84, 20);
    b.enemy(16, 10, 'quill_wraith');
    b.enemy(40, 18, 'quill_wraith');
    b.enemy(80, 12, 'page_swarm');
  });

  // C3 — copyists' desks
  A({ id: 'scr_desks', area: 'arc_scriptorium', x: 21, y: 4, w: 4, h: 1, lvl: 1,
      decor: ['desk', 'candelabra', 'scrollrack', 'desk', 'lectern'] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    b.plat(10, 15, 9);
    b.plat(22, 27, 9);
    b.fill(34, 10, 37, 11);
    b.plat(44, 49, 9);
    b.plat(47, 53, 5);
    b.item(50, 4, 'archivist_robe');
    b.fill(58, 10, 61, 11);
    b.plat(68, 73, 9);
    b.lore(82, 11, 'arc_spells');
    b.candle(6, 6);
    b.candle(18, 6);
    b.candle(30, 6, 'sub:grimoire');
    b.candle(40, 6);
    b.candle(56, 6);
    b.candle(64, 6);
    b.candle(78, 6);
    b.candle(90, 7);
    b.enemy(30, 7, 'quill_wraith');
    b.enemy(54, 6, 'living_grimoire');
    b.enemy(76, 6, 'living_grimoire');
  });

  // C4 — the grate column: iron grates that only mist can pass
  A({ id: 'scr_grate', area: 'arc_scriptorium', x: 25, y: 3, w: 1, h: 2, lvl: 1, gates: { T0: 3 },
      decor: ['chain', 'crest', 'chain'] }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('T', 0);
    b.fill(1, 20, 22, 20, 'G');
    b.fill(1, 12, 22, 12, 'G');
    b.fill(1, 5, 22, 5, 'G');
    b.candle(12, 22);
    b.candle(6, 15);
    b.candle(18, 9);
  });

  // ============================= HALL OF HUNTERS =============================

  // H1 — Hall of Hunters: two floors of portraits. Arrive from the grate shaft.
  A({ id: 'hun_gallery', area: 'arc_hunters', x: 24, y: 1, w: 5, h: 2, lvl: 3, entry: 'B1',
      decor: ['portrait', 'crest', 'candelabra', 'portrait'] }, (b) => {
    b.shell();
    b.door('B', 1);
    b.door('R', 0);
    // upper floor and the stairwell at the west end
    b.fill(22, 12, 118, 13);
    b.stairs(9, 24, 13, 'r'); // (9,24) → (21,12)
    b.lore(42, 25, 'arc_portraits');
    b.item(114, 25, 'hunter_bandana');
    b.item(60, 11, 'falchion');
    b.candle(4, 20);
    b.candle(16, 6);
    b.candle(30, 21);
    b.candle(50, 21);
    b.candle(70, 21);
    b.candle(90, 21);
    b.candle(108, 21);
    b.candle(30, 7);
    b.candle(46, 7);
    b.candle(76, 7);
    b.candle(100, 7);
    b.enemy(62, 25, 'hunter_shade');
    b.enemy(96, 25, 'hunter_shade');
    b.enemy(86, 11, 'archive_sentinel');
  });

  // H2 — arena of the Echo of the Belmont
  A({ id: 'hun_echo', area: 'arc_hunters', x: 29, y: 0, w: 3, h: 2, lvl: 3, darkness: 0.4,
      decor: ['portrait', 'crest', 'candelabra', 'rift'] }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('R', 1);
    b.fill(32, 23, 39, 25);
    b.plat(10, 18, 18);
    b.plat(53, 61, 18);
    b.candle(8, 14);
    b.candle(63, 14);
    b.candle(24, 21);
    b.candle(47, 21);
    b.boss(36, 22, 'echo');
  });

  // H3 — Richter, bound in written chains
  A({ id: 'hun_richter', area: 'arc_hunters', x: 32, y: 1, w: 2, h: 1, lvl: 3, darkness: 0.45,
      decor: ['chain', 'rift', 'chain', 'crest'] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.fill(28, 11, 37, 11);
    b.npc(32, 10, 'richter', { scene: 'richter_freed', hideFlag: 'richter_free' });
    b.candle(10, 7);
    b.candle(22, 7);
    b.candle(42, 7);
  });

  // ============================= FORBIDDEN VAULT =============================

  // V1 — the vault gate, under the seal band of the Stacks
  A({ id: 'vault_gate', area: 'arc_vault', x: 17, y: 14, w: 2, h: 2, lvl: 4, entry: 'T1',
      decor: ['chain', 'crest', 'rift', 'chain'] }, (b) => {
    b.shell();
    b.door('T', 1);
    b.door('L', 1);
    b.plat(33, 40, 5);
    b.plat(27, 33, 10);
    b.plat(38, 44, 14);
    b.plat(28, 34, 18);
    b.plat(18, 24, 22);
    b.candle(42, 6);
    b.candle(22, 13);
    b.candle(10, 21);
    b.enemy(30, 25, 'ink_slime');
  });

  // V2 — vault stairs: up and over the inner wall, down to the drowned vault
  A({ id: 'vault_stairs', area: 'arc_vault', x: 13, y: 14, w: 4, h: 2, lvl: 4, entry: 'R1',
      decor: ['chain', 'candelabra', 'crest', 'rift', 'scrollrack'] }, (b) => {
    b.shell();
    b.door('R', 1);
    b.door('B', 0);
    b.fill(30, 12, 67, 13);
    b.fill(44, 14, 59, 25);
    b.stairs(80, 24, 13, 'l'); // (80,24) → (68,12)
    b.stairs(17, 24, 13, 'r'); // (17,24) → (29,12)
    b.plat(47, 55, 7);
    b.item(51, 6, 'scholar_foil');
    b.lore(36, 11, 'arc_bibliophage');
    b.fill(22, 26, 40, 26, '~');
    b.candle(88, 20);
    b.candle(74, 18);
    b.candle(62, 8);
    b.candle(40, 8);
    b.candle(22, 16);
    b.candle(6, 20);
    b.enemy(56, 11, 'archive_sentinel');
    b.enemy(72, 25, 'ink_slime');
    b.enemy(32, 25, 'ink_slime');
  });

  // V3 — the drowned vault: ink-black water, the Lantern of Revelation
  A({ id: 'vault_deep', area: 'arc_vault', x: 13, y: 16, w: 4, h: 3, lvl: 4, entry: 'T0', darkness: 0.6,
      decor: ['chain', 'rift', 'crest', 'chain', 'rift'] }, (b) => {
    b.shell();
    b.door('T', 0);
    b.door('R', 2);
    // landing under the hole, then stairs down to the first shelf
    b.fill(1, 5, 18, 6);
    b.lore(5, 4, 'arc_ink');
    b.stairs(26, 12, 8, 'l'); // (26,12) → (19,5)
    b.fill(27, 13, 41, 14);
    b.plat(43, 47, 17);
    b.fill(49, 21, 62, 22);
    b.plat(64, 69, 25);
    b.plat(70, 75, 30);
    b.plat(77, 82, 35);
    // the ink lake with the lantern's island
    b.fill(19, 35, 72, 39, '~');
    b.fill(40, 33, 47, 39);
    b.relic(44, 32, 'lantern');
    // the drowned crypt on the west shore
    b.fill(1, 35, 18, 39);
    b.item(6, 34, 'requiem_edge');
    b.candle(8, 2);
    b.candle(34, 10);
    b.candle(56, 18);
    b.candle(44, 28);
    b.candle(12, 31);
    b.candle(86, 36);
    b.enemy(60, 20, 'vault_horror');
    b.enemy(14, 34, 'vault_horror');
  });

  // V4 — save room
  A({ id: 'vault_save', area: 'arc_vault', x: 17, y: 18, w: 1, h: 1, lvl: 4, darkness: 0.2, decor: ['crest', 'candelabra'] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    b.fill(1, 2, 22, 2);
    b.save(12, 11);
  });

  // V5 — arena of the Bibliophage
  A({ id: 'vault_worm', area: 'arc_vault', x: 18, y: 16, w: 4, h: 3, lvl: 4, darkness: 0.5,
      decor: ['chain', 'rift', 'crest', 'chain'] }, (b) => {
    b.shell();
    b.door('L', 2);
    b.door('R', 2);
    b.plat(4, 13, 30);
    b.plat(82, 91, 30);
    b.plat(14, 22, 22);
    b.plat(73, 81, 22);
    b.candle(8, 26);
    b.candle(87, 26);
    b.candle(18, 18);
    b.candle(77, 18);
    b.candle(40, 35);
    b.candle(56, 35);
    b.boss(52, 39, 'biblio');
  });

  // V6 — the treasure of the Vault
  A({ id: 'vault_treasure', area: 'arc_vault', x: 22, y: 18, w: 2, h: 1, lvl: 4, darkness: 0.35,
      decor: ['crest', 'candelabra', 'chain', 'candelabra'] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.fill(12, 11, 14, 11);
    b.item(13, 10, 'nightfall_cloak');
    b.fill(20, 11, 22, 11);
    b.item(21, 10, 'ink_shield');
    b.fill(28, 11, 30, 11);
    b.item(29, 10, 'hp_up');
    b.fill(36, 9, 44, 11);
    b.tome(40, 8, 'crimson_requiem');
    b.candle(8, 7);
    b.candle(25, 6);
    b.candle(33, 6);
  });
})();
