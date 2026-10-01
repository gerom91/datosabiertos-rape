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

  // ---- set-piece art ---------------------------------------------------------------
  // Rooms may list `art: [[kind, tx, ty, opt], ...]`: background pieces painted at exact
  // tile positions when the room is entered (on top of the procedural decorations).
  // kind: any G.DECOR name (floor pieces such as candelabra/lectern/scrollrack/desk/ladder
  // stand on the top of row ty) or one of the painters below.
  const FLOOR_DECOR = ['statue', 'desk', 'globe', 'candelabra', 'scrollrack', 'lectern', 'crystal', 'bonepile', 'pew', 'throne', 'ladder'];
  function arcPath(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + w / 2);
    ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }
  const PAINT = {
    // tall gothic opening torn into the ink void (shows the drifting pages behind)
    arch(ctx, x, y, th, rng, out, o) {
      const w = (o && o.w) || 64, h = (o && o.h) || 128, c = th.c;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      arcPath(ctx, x, y, w, h);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = c.dark;
      ctx.lineWidth = 6;
      arcPath(ctx, x, y, w, h);
      ctx.stroke();
      ctx.strokeStyle = c.trim;
      ctx.lineWidth = 1;
      arcPath(ctx, x + 4, y + 4, w - 8, h - 4);
      ctx.stroke();
      // mullions
      ctx.fillStyle = c.dark;
      ctx.fillRect(x + w / 2 - 2, y + 6, 4, h - 6);
      for (let yy = y + w / 2 + 20; yy < y + h - 8; yy += 36) ctx.fillRect(x + 2, yy, w - 4, 3);
      ctx.fillStyle = c.trim;
      ctx.fillRect(x + w / 2 - 1, y + 6, 1, h - 6);
      // sill
      ctx.fillStyle = c.light;
      ctx.fillRect(x - 6, y + h, w + 12, 5);
      ctx.fillStyle = c.trim;
      ctx.fillRect(x - 6, y + h, w + 12, 1);
      out.push({ x: x + w / 2, y: y + h / 2, r: Math.max(w, 70), color: c.glow || '#e8c070', i: 0.45 });
    },
    // a great Belmont crest: a shield with the cross of the clan (o.s scale, o.col field,
    // o.halo ring of light)
    bigcrest(ctx, x, y, th, rng, out, o) {
      const s = (o && o.s) || 2, c = th.c;
      const W = 24 * s, H = 30 * s;
      ctx.fillStyle = c.trim;
      ctx.beginPath();
      ctx.moveTo(x - 2, y - 2);
      ctx.lineTo(x + W + 2, y - 2);
      ctx.lineTo(x + W + 2, y + 18 * s + 1);
      ctx.lineTo(x + W / 2, y + H + 3);
      ctx.lineTo(x - 2, y + 18 * s + 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = (o && o.col) || '#5a0c18';
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 2);
      ctx.lineTo(x + W - 2, y + 2);
      ctx.lineTo(x + W - 2, y + 18 * s - 1);
      ctx.lineTo(x + W / 2, y + H - 3);
      ctx.lineTo(x + 2, y + 18 * s - 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + W / 2, y + 2, W / 2 - 2, 18 * s - 3);
      // cross
      const g = c.glow || '#f0d080';
      ctx.fillStyle = g;
      ctx.fillRect(x + W / 2 - 2 * s, y + 4 * s, 4 * s, 20 * s);
      ctx.fillRect(x + 5 * s, y + 9 * s, W - 10 * s, 4 * s);
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(x + W / 2 - 2 * s, y + 4 * s, 1 * s, 20 * s);
      // optional halo of light around the shield
      if (o && o.halo) {
        ctx.strokeStyle = c.trim;
        ctx.lineWidth = Math.max(1, s);
        ctx.beginPath();
        ctx.arc(x + W / 2, y + H / 2, W / 2 + 5 * s, Math.PI * 0.85, Math.PI * 2.15);
        ctx.stroke();
      }
      out.push({ x: x + W / 2, y: y + H / 2, r: 40 + 14 * s, color: g, i: 0.55 });
    },
    // crimson hunters' banner with a gold cross
    pennant(ctx, x, y, th, rng, out, o) {
      const h = (o && o.h) || 64, c = th.c;
      ctx.fillStyle = c.trim;
      ctx.fillRect(x - 3, y, 26, 3);
      ctx.fillStyle = (o && o.col) || '#6a0e1c';
      ctx.fillRect(x, y + 3, 20, h);
      ctx.beginPath();
      ctx.moveTo(x, y + 3 + h);
      ctx.lineTo(x + 10, y + h + 12);
      ctx.lineTo(x + 20, y + 3 + h);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 2, y + 3, 3, h);
      ctx.fillStyle = c.glow || c.trim;
      ctx.fillRect(x + 9, y + 12, 3, 20);
      ctx.fillRect(x + 4, y + 18, 13, 3);
    },
    // ink running down the shelves
    drips(ctx, x, y, th, rng, out, o) {
      const w = (o && o.w) || 48, len = (o && o.len) || 60;
      const ink = th.c.ink || '#120a1a';
      ctx.fillStyle = ink;
      ctx.fillRect(x, y, w, 4);
      for (let i = 0; i < w; i += 2 + rng.int(0, 3)) {
        const L = rng.int(4, len);
        ctx.fillRect(x + i, y, 2, L);
        if (rng.next() < 0.5) ctx.fillRect(x + i - 1, y + L - 2, 4, 3);
      }
      ctx.fillStyle = th.c.accent2 || '#a070e0';
      for (let i = 0; i < w; i += 9) ctx.fillRect(x + i + rng.int(0, 5), y + 1, 1, 1);
    },
    // darken part of the back wall (alcoves, depth)
    shade(ctx, x, y, th, rng, out, o) {
      ctx.fillStyle = 'rgba(4,2,6,' + ((o && o.a) || 0.5) + ')';
      ctx.fillRect(x, y, (o && o.w) || 64, (o && o.h) || 64);
    },
    // a library ladder leaning on the shelves, from row ty down o.h tiles
    rungs(ctx, x, y, th, rng, out, o) {
      const h = ((o && o.h) || 4) * 16, c = th.c;
      ctx.fillStyle = c.light;
      ctx.fillRect(x, y, 2, h);
      ctx.fillRect(x + 12, y, 2, h);
      ctx.fillStyle = c.base;
      for (let i = 5; i < h; i += 9) ctx.fillRect(x, y + i, 14, 2);
      ctx.fillStyle = c.trim;
      ctx.fillRect(x - 1, y, 4, 2);
      ctx.fillRect(x + 11, y, 4, 2);
    },
    // hanging iron cage of candles
    lamp(ctx, x, y, th, rng, out, o) {
      const len = (o && o.len) || 40;
      ctx.fillStyle = '#3a3a42';
      ctx.fillRect(x + 7, y - len, 2, len);
      ctx.fillStyle = th.c.trim;
      ctx.fillRect(x, y, 16, 2);
      ctx.fillRect(x + 2, y + 10, 12, 2);
      ctx.fillRect(x, y, 2, 12);
      ctx.fillRect(x + 14, y, 2, 12);
      ctx.fillStyle = '#ffd070';
      ctx.fillRect(x + 6, y + 4, 4, 6);
      ctx.fillStyle = '#fff4c0';
      ctx.fillRect(x + 7, y + 5, 2, 3);
      out.push({ x: x + 8, y: y + 6, r: 60, color: '#ffc060', i: 0.8, flicker: true });
    },
  };
  function paintRoom(room, list) {
    const gfx = G.gfx;
    if (!list || !room.bgCanvas || !gfx || !gfx.ctxOf) return;
    const ctx = gfx.ctxOf(room.bgCanvas);
    if (!ctx) return;
    const th = room.theme;
    const rng = G.util.RNG(room.id + ':art');
    const flags = (G.state && G.state.flags) || {};
    for (const d of list) {
      const kind = d[0], x = d[1] * 16, y = d[2] * 16, o = d[3];
      // optional story conditions: {unless: 'flag'} / {when: 'flag'}
      if (o && ((o.unless && flags[o.unless]) || (o.when && !flags[o.when]))) continue;
      const out = [];
      try {
        ctx.save();
        if (PAINT[kind]) PAINT[kind](ctx, x, y, th, rng, out, o);
        else if (G.DECOR && G.DECOR[kind]) {
          if (FLOOR_DECOR.includes(kind)) {
            // floor pieces are drawn relative to a cell floor (CELL_PX_H - 32)
            const dy = y - (G.CELL_PX_H - 32);
            ctx.translate(0, dy);
            G.DECOR[kind](ctx, x, 0, th, rng, out, room);
            out.forEach((L) => (L.y += dy));
          } else G.DECOR[kind](ctx, x, y, th, rng, out, room);
        }
      } catch (e) {
        /* decoration only */
      }
      ctx.restore();
      out.forEach((L) => {
        L._fixed = true;
        room.lightsStatic.push(L);
      });
    }
  }

  // a breakable alcove: B tiles over [x0..x1, y0..y1] with an item hidden at (ix, iy)
  // (default: the bottom-left tile), so the player can step in once it crumbles
  function niche(b, x0, y0, x1, y1, item, ix, iy) {
    b.fill(x0, y0, x1, y1, 'B');
    b.hidden(ix == null ? x0 : ix, iy == null ? y1 : iy, item);
  }

  // a hatch in the floor (B door) for rooms entered from below. Climbing through a hole
  // only gives a small boost (game.js: vy -4.2, about 29 px), not quite enough to clear
  // a full floor, so the floor dips one tile around the hatch: the boost always carries
  // the player above the dip, and two stair tiles lead back up. Going down is unchanged.
  function hatch(b, cell) {
    const c0 = cell * G.CELL_W + 10, y = b.th - 2;
    b.door('B', cell);
    b.clear(c0 - 3, y, c0 - 1, y);
    b.clear(c0 + 4, y, c0 + 6, y);
    b.set(c0 - 4, y, '\\');
    b.set(c0 + 7, y, '/');
  }

  // every room here lives on the Archives map
  const A = (meta, fn) => {
    meta = Object.assign({ map: 'archives' }, meta);
    if (meta.art) {
      const art = meta.art, prev = meta.onEnter;
      meta.onEnter = function (g, room) {
        paintRoom(room, art);
        if (prev) prev(g, room);
      };
    }
    return R(meta, fn);
  };

  // ============================== READING HALL ==============================

  // A1 — arrival hall. The portal book back to the Long Library stands in a
  // vaulted alcove; a raised reading gallery spans the middle of the hall.
  A({ id: 'arc_entry', area: 'arc_hall', x: 10, y: 8, w: 3, h: 1, lvl: 1, entry: 'R0', darkness: 0.32, noDecor: true,
      art: [
        // the portal shrine: great crest, pennants and candelabras around the book
        ['pennant', 1.2, 3, { h: 70 }], ['pennant', 9.6, 3, { h: 70 }],
        ['bigcrest', 3, 3.2, { s: 2 }],
        ['candelabra', 1.4, 12], ['candelabra', 7.2, 12],
        // the hall: portraits of the clan, a reading lectern on the gallery
        ['portrait', 17, 3], ['lectern', 31, 7], ['scrollrack', 27.5, 7], ['portrait', 34.2, 2.6],
        ['candelabra', 19.5, 12], ['candelabra', 43, 12],
        // a tall window torn into the ink void
        ['arch', 46.5, 2.6, { w: 80, h: 136 }],
        ['portrait', 56.5, 3], ['crest', 61.2, 3.4], ['candelabra', 59.5, 12], ['portrait', 65, 3],
        ['chain', 53.6, 2], ['chain', 69.4, 2],
      ] }, (b) => {
    b.shell();
    b.door('R', 0);
    // the shrine of the portal book: a carved lintel on corbels
    b.fill(1, 2, 13, 2);
    b.fill(12, 3, 13, 3);
    b.fill(13, 4, 13, 4);
    b.fill(1, 3, 1, 3);
    b.portal(4, 11, 'lib_portal', 20, 25);
    b.trigger(8, 11, 'archives_enter', 2, 3);
    b.candle(11, 7);
    // raised reading gallery with stairs on both sides (walkable underneath)
    b.stairs(22, 10, 4, 'r'); // (22,10) → (25,7)
    b.fill(26, 7, 37, 8);
    b.stairs(41, 10, 4, 'l'); // (41,10) → (38,7)
    b.candle(29, 4);
    b.candle(35, 4, 'heart_big');
    b.candle(19, 8);
    // the far hall: hanging shelves frame the void window and the exit
    b.fill(44, 2, 45, 3);
    b.fill(53, 2, 54, 3);
    b.fill(66, 2, 69, 4);
    b.candle(51, 7);
    b.candle(63, 7);
    b.enemy(62, 7, 'page_swarm');
  });

  // A2 — the Reading Hall: two storeys of shelves around a tall atrium with a
  // grand staircase. Ground floor L1 → R1 is the main road.
  A({ id: 'arc_hall1', area: 'arc_hall', x: 13, y: 7, w: 4, h: 2, lvl: 1, entry: 'L1', noDecor: true,
      art: [
        // west wing, ground floor: the oath lectern
        ['portrait', 4, 16], ['crest', 11.5, 16.5], ['portrait', 17, 16], ['pennant', 21.5, 15, { h: 56 }],
        ['candelabra', 2.5, 26], ['scrollrack', 13, 26], ['candelabra', 20.5, 26],
        // west upper gallery
        ['portrait', 5, 3], ['portrait', 12, 2.6], ['crest', 18.6, 3.6],
        ['scrollrack', 7.5, 12], ['lectern', 14, 12], ['candelabra', 21, 12], ['candelabra', 2.4, 12],
        // the atrium: void window, chandeliers, reading desks
        ['arch', 41, 3, { w: 96, h: 160 }],
        ['chandelier', 30, 13], ['chandelier', 52, 10], ['chandelier', 61, 15],
        ['desk', 44, 26], ['candelabra', 39.5, 26], ['desk', 54, 26], ['globe', 60, 26], ['rungs', 51, 22, { h: 4 }],
        // east wing
        ['portrait', 67, 4], ['crest', 74.6, 5], ['portrait', 80, 4], ['portrait', 87.5, 3.4],
        ['scrollrack', 70, 14], ['candelabra', 78, 14], ['scrollrack', 84, 14],
        ['pennant', 66.5, 17, { h: 50 }], ['portrait', 74, 17.4], ['crest', 82.6, 18], ['pennant', 89.5, 17, { h: 50 }],
        ['candelabra', 67, 26], ['lectern', 77.5, 26], ['candelabra', 86, 26],
      ] }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('R', 1);
    b.door('T', 1);
    // west upper gallery and the grand staircase down into the atrium
    b.fill(1, 12, 24, 13);
    b.stairs(37, 24, 13, 'l'); // (37,24) → (25,12)
    // a cracked panel at the end of the west gallery hides a meal
    b.fill(1, 2, 2, 11);
    niche(b, 2, 9, 2, 11, 'roast_fowl');
    // balconies up to the hatch of the hidden study (T1)
    b.plat(27, 31, 8);
    b.plat(33, 38, 5);
    // reading tables climbing to the east gallery
    b.plat(42, 50, 22);
    b.plat(53, 59, 18);
    b.fill(63, 14, 94, 15);
    b.item(91, 13, 'hunter_knife');
    // ground floor: oath lectern by the entrance
    b.lore(8, 25, 'arc_oath');
    b.candle(5, 21);
    b.candle(15, 20);
    b.candle(23, 21, 'sub:quill');
    b.candle(10, 8);
    b.candle(20, 8);
    b.candle(31, 3);
    b.candle(47, 17);
    b.candle(57, 13);
    b.candle(72, 10);
    b.candle(84, 10);
    b.candle(72, 22);
    b.candle(90, 21);
    b.enemy(50, 10, 'living_grimoire');
    b.enemy(17, 20, 'page_swarm');
    b.enemy(82, 21, 'page_swarm');
    b.enemy(70, 7, 'flying_tome');
  });

  // A3 — hidden study above the Reading Hall. The Belmont Ward lies on a high
  // shelf, reachable only along walkways written in invisible ink.
  A({ id: 'arc_ink', area: 'arc_hall', x: 13, y: 5, w: 4, h: 2, lvl: 1, entry: 'B1', darkness: 0.5, noDecor: true,
      gates: { tome: 6, 'item:heart_up': 6 },
      art: [
        // the study
        ['portrait', 5, 6], ['crest', 9.6, 7.4], ['scrollrack', 4.5, 20], ['lectern', 9, 20],
        ['desk', 21.5, 26], ['scrollrack', 26, 26], ['candelabra', 29, 26], ['candelabra', 42.5, 26],
        ['desk', 45, 26], ['portrait', 22, 9], ['portrait', 30, 4], ['crest', 42.6, 6],
        ['scrollrack', 47, 16], ['chain', 26, 2], ['chain', 44, 2],
        // the collapsed wing: a great tear into the ink void
        ['arch', 56, 3, { w: 176, h: 300 }],
        ['drips', 57, 13.4, { w: 64, len: 40 }], ['drips', 63, 10.4, { w: 64, len: 54 }], ['drips', 69, 7.4, { w: 80, len: 70 }],
        ['candelabra', 80, 6], ['lectern', 88, 6], ['portrait', 82.5, 2.4],
        ['drips', 78, 6.6, { w: 272, len: 90 }],
      ] }, (b) => {
    b.shell();
    hatch(b, 1);
    // raised study on the west side, corner stairs up onto it
    b.fill(1, 20, 12, 25);
    b.stairs(18, 25, 6, 'l'); // (18,25) → (13,20)
    b.fill(1, 14, 3, 19);
    niche(b, 3, 17, 3, 19, 'red_wine');
    // reading desks around the hatch
    b.plat(22, 27, 22);
    b.plat(42, 48, 22);
    // a shelf ledge: where the ink road begins
    b.fill(46, 16, 54, 17);
    // the ink road (only solid in the light of the Lantern of Revelation)
    b.fill(57, 13, 60, 13, 'I');
    b.fill(63, 10, 66, 10, 'I');
    b.fill(69, 7, 73, 7, 'I');
    // the high shelf, on top of a tower of shelves
    b.fill(78, 6, 94, 25);
    b.tome(91, 5, 'belmont_ward');
    b.item(84, 5, 'heart_up');
    b.candle(87, 3);
    b.candle(7, 15);
    b.candle(25, 18);
    b.candle(38, 20);
    b.candle(50, 12, 'heart_big');
    b.candle(66, 21);
    b.enemy(30, 13, 'page_swarm');
    b.enemy(64, 20, 'flying_tome');
  });

  // A4 — save room
  A({ id: 'arc_save', area: 'arc_hall', x: 17, y: 8, w: 1, h: 1, lvl: 1, darkness: 0.15, noDecor: true,
      art: [['pennant', 3.5, 3.4, { h: 60 }], ['pennant', 19, 3.4, { h: 60 }], ['crest', 11.25, 3.2],
            ['candelabra', 7, 12], ['candelabra', 15.5, 12]] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    // a vaulted ceiling over the crystal
    b.fill(1, 2, 22, 2);
    b.fill(1, 3, 4, 3);
    b.fill(19, 3, 22, 3);
    b.save(12, 11);
  });

  // A5 — crossroads tower: down to the Stacks, up to the Scriptorium, east to
  // the teleporter. Alternating balconies climb its full height.
  A({ id: 'arc_cross', area: 'arc_hall', x: 18, y: 6, w: 2, h: 4, lvl: 1, entry: 'L2', noDecor: true,
      art: [
        // the hatch to the Scriptorium and the upper tower
        ['chain', 6, 2], ['chain', 24, 2], ['chandelier', 20, 6], ['portrait', 8, 6], ['crest', 26.6, 3],
        ['candelabra', 42.5, 17], ['portrait', 38.5, 9],
        // the void window in the heart of the tower
        ['arch', 29, 13, { w: 96, h: 176 }],
        ['candelabra', 3.5, 20], ['portrait', 6, 24.5], ['pennant', 17, 27, { h: 56 }],
        ['candelabra', 31, 30], ['candelabra', 41, 30], ['crest', 39, 34], ['portrait', 30.5, 36],
        // the save room landing
        ['candelabra', 4, 40], ['pennant', 12, 41, { h: 50 }], ['portrait', 22, 41], ['crest', 33, 42],
        // the bottom: the shaft down to the Stacks, the way to the teleporter
        ['candelabra', 19.5, 54], ['scrollrack', 26, 54], ['candelabra', 36, 54], ['portrait', 38, 45],
      ] }, (b) => {
    b.shell();
    b.door('L', 2);
    hatch(b, 0);
    b.door('T', 1);
    b.door('R', 3);
    // buttresses
    b.fill(44, 2, 46, 14);
    b.fill(45, 32, 46, 47);
    b.fill(1, 22, 2, 34);
    // landing in front of the save room door; the shaft down to the Stacks
    // opens right below its edge
    b.fill(1, 40, 9, 41);
    // under the landing: a cracked panel hides a snack
    b.fill(1, 42, 5, 53);
    niche(b, 5, 51, 5, 53, 'bread');
    // way back up from the bottom
    b.plat(19, 24, 50);
    b.plat(14, 18, 46);
    // the climb to the Scriptorium: balconies and hanging walkways
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
    b.candle(5, 36);
    b.candle(29, 47);
    b.candle(38, 26);
    b.candle(6, 16);
    b.candle(22, 11);
    b.candle(41, 7);
    b.candle(40, 51);
    b.enemy(30, 20, 'flying_tome');
    b.enemy(26, 42, 'flying_tome');
  });

  // A6 — teleporter
  A({ id: 'arc_tp', area: 'arc_hall', x: 20, y: 9, w: 1, h: 1, lvl: 1, darkness: 0.2, noDecor: true,
      art: [['arch', 9, 2.4, { w: 96, h: 124 }], ['candelabra', 4.5, 12], ['candelabra', 18.5, 12], ['chain', 3, 2], ['chain', 21, 2]] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.tp(12, 11);
  });

  // ================================ THE STACKS ================================

  // S1 — the Stacks shaft, from the crossroads down to the boss corridor. A band of
  // Belmont seals plugs the way down to the Forbidden Vault (Belmont Crest).
  A({ id: 'stk_shaft', area: 'arc_stacks', x: 18, y: 10, w: 2, h: 4, lvl: 1, entry: 'T0', gates: { B0: 4 }, noDecor: true,
      art: [
        ['chain', 18, 2], ['chain', 26, 2], ['portrait', 21, 3], ['arch', 31, 2.5, { w: 80, h: 196 }],
        ['pennant', 4, 8, { h: 60 }], ['crest', 9.5, 9], ['candelabra', 29.5, 16], ['candelabra', 41, 16],
        ['candelabra', 3, 26], ['scrollrack', 6.5, 26], ['portrait', 25, 21.5], ['crest', 36.5, 22], ['portrait', 40, 29],
        ['pennant', 21.5, 39.5, { h: 56 }], ['portrait', 6, 33], ['portrait', 11, 41], ['candelabra', 40.5, 44], ['crest', 31, 33],
        // the seal: the crest of the clan watches over the way down
        ['bigcrest', 9.6, 44.6, { s: 1.5 }],
        ['candelabra', 4.5, 54], ['candelabra', 17.5, 54], ['scrollrack', 24, 54], ['candelabra', 34, 54],
      ] }, (b) => {
    b.shell();
    b.door('T', 0);
    b.door('L', 1);
    b.door('R', 3);
    b.door('B', 0);
    // the seal band (Belmont Crest)
    b.fill(10, 54, 13, 54, 'X');
    // buttresses
    b.fill(45, 2, 46, 15);
    b.fill(45, 18, 46, 43);
    b.fill(1, 28, 2, 53);
    // top ledge under the hatch, then down the shelves
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
    b.candle(20, 8);
    b.candle(35, 12);
    b.candle(8, 22);
    b.candle(22, 37);
    b.candle(41, 40);
    b.candle(16, 50);
    b.candle(38, 51);
    b.enemy(41, 15, 'shelf_mimic');
    b.enemy(24, 28, 'page_swarm');
    b.enemy(20, 45, 'page_swarm');
  });

  // S2 — west stacks: aisles of shelves, a raised reading floor, and a low gap under
  // the last shelf that only a wolf can squeeze through.
  A({ id: 'stk_west', area: 'arc_stacks', x: 13, y: 11, w: 5, h: 1, lvl: 1, entry: 'R0', gates: { L0: 2 }, noDecor: true,
      art: [
        ['candelabra', 14.5, 12], ['portrait', 22.5, 4.4], ['scrollrack', 31.5, 12], ['chain', 33, 4],
        ['candelabra', 40.4, 12], ['rungs', 49.2, 8, { h: 4 }], ['portrait', 44.5, 2.6], ['lectern', 51.5, 12], ['scrollrack', 56.5, 12],
        ['arch', 58.5, 2.2, { w: 64, h: 112 }], ['candelabra', 64, 12],
        ['candelabra', 71.5, 9], ['portrait', 82, 4.6], ['scrollrack', 79, 9], ['lectern', 86, 9], ['candelabra', 93.5, 9],
        ['crest', 73, 4.2], ['chain', 96, 2],
        ['portrait', 100, 3], ['candelabra', 102.5, 12], ['scrollrack', 111, 12], ['pennant', 113, 2.6, { h: 56 }], ['candelabra', 116.5, 12],
      ] }, (b) => {
    b.shell();
    b.door('R', 0);
    b.door('L', 0);
    // the last shelves of the west stacks: a wolf can slip under them (row 11)
    b.fill(0, 2, 12, 10);
    niche(b, 12, 9, 12, 10, 'blood_orange');
    // low shelves over the west aisle and the reading shelf with the quill rapier
    b.fill(18, 2, 30, 3);
    b.plat(20, 27, 8);
    b.item(24, 7, 'quill_rapier');
    // hanging shelves and a walkway along the middle aisle
    b.fill(36, 2, 39, 5);
    b.plat(42, 49, 8);
    b.fill(52, 2, 55, 4);
    // raised reading floor
    b.stairs(67, 11, 3, 'r');
    b.fill(70, 9, 95, 11);
    b.stairs(98, 11, 3, 'l');
    b.fill(76, 2, 80, 4);
    b.fill(88, 2, 91, 3);
    b.fill(106, 2, 109, 4);
    b.candle(16, 7);
    b.candle(34, 8);
    b.candle(46, 5, 'heart_big');
    b.candle(61, 7);
    b.candle(74, 5);
    b.candle(85, 5);
    b.candle(104, 7);
    b.candle(114, 8);
    b.enemy(30, 11, 'ink_slime');
    b.enemy(58, 11, 'ink_slime');
    b.enemy(84, 5, 'living_grimoire');
  });

  // S3 — tiny study reached through the wolf crawlspace: the Ink Lance tome
  A({ id: 'stk_tome', area: 'arc_stacks', x: 12, y: 11, w: 1, h: 1, lvl: 2, entry: 'R0', darkness: 0.55, noDecor: true,
      art: [['scrollrack', 1.2, 12], ['crest', 5.25, 3], ['lectern', 9.6, 12], ['chain', 2.5, 2], ['chain', 11, 2], ['drips', 13, 11, { w: 176, len: 8 }]] }, (b) => {
    b.shell();
    b.door('R', 0);
    // the crawlspace from the stacks
    b.fill(13, 2, 23, 10);
    // the tome on a little dais
    b.fill(4, 11, 8, 11);
    b.set(3, 11, '/');
    b.set(9, 11, '\\');
    b.tome(6, 10, 'ink_lance');
    b.candle(3, 6);
    b.candle(10, 6);
  });

  // S4 — corridor to the Doppelganger
  A({ id: 'stk_corridor', area: 'arc_stacks', x: 20, y: 13, w: 4, h: 1, lvl: 1, noDecor: true,
      art: [
        ['candelabra', 3.5, 12], ['portrait', 6, 3], ['scrollrack', 9, 12], ['chain', 18, 2], ['crest', 21.5, 3.6],
        ['candelabra', 27, 12], ['scrollrack', 31, 12], ['lectern', 41, 9], ['candelabra', 50.5, 9],
        ['arch', 59.5, 2.4, { w: 64, h: 120 }], ['candelabra', 65.5, 12], ['portrait', 69.5, 3], ['scrollrack', 73, 12],
        // the door of the arena
        ['pennant', 82, 2.6, { h: 64 }], ['bigcrest', 85.8, 2.6, { s: 1.4 }], ['pennant', 91.5, 2.6, { h: 64 }],
        ['candelabra', 81, 12], ['candelabra', 92, 12], ['drips', 80, 2, { w: 224, len: 24 }],
      ] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    b.fill(12, 2, 15, 5);
    // raised dais; a high shelf above it holds a life vessel
    b.stairs(36, 11, 3, 'r');
    b.fill(39, 9, 52, 11);
    b.stairs(55, 11, 3, 'l');
    b.plat(43, 48, 5);
    b.item(45, 4, 'hp_up');
    b.fill(76, 2, 79, 4);
    b.candle(7, 7);
    b.candle(24, 6, 'sub:inkwell');
    b.candle(34, 7);
    b.candle(57, 7);
    b.candle(72, 7);
    b.candle(87, 8);
    b.enemy(26, 11, 'ink_slime');
    b.enemy(68, 11, 'archive_sentinel');
    b.enemy(84, 11, 'ink_slime');
  });

  // S5 — arena of the Ink Doppelganger: flat floor (row 26), two side ledges (row 20)
  A({ id: 'stk_doppel', area: 'arc_stacks', x: 24, y: 12, w: 2, h: 2, lvl: 1, darkness: 0.45, noDecor: true,
      art: [
        ['drips', 1, 2, { w: 736, len: 34 }],
        ['arch', 20, 4, { w: 128, h: 196 }],
        ['pennant', 6, 7, { h: 60 }], ['pennant', 40, 7, { h: 60 }], ['portrait', 12, 6], ['portrait', 33.5, 6],
        ['crest', 3.6, 14.5], ['crest', 42.4, 14.5], ['chain', 9, 2], ['chain', 38, 2],
        ['candelabra', 11, 26], ['candelabra', 16.5, 26], ['candelabra', 30.5, 26], ['candelabra', 36, 26],
      ] }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('R', 1);
    b.plat(2, 8, 20);
    b.plat(39, 45, 20);
    b.fill(1, 2, 5, 3);
    b.fill(42, 2, 46, 3);
    b.candle(5, 16);
    b.candle(42, 16);
    b.candle(14, 21);
    b.candle(33, 21);
    b.boss(32, 25, 'doppel');
  });

  // S6 — after the boss: the shelves close into a wolf-sized crawlspace
  A({ id: 'stk_after', area: 'arc_stacks', x: 26, y: 13, w: 2, h: 1, lvl: 2, gates: { R0: 2 }, noDecor: true,
      art: [['candelabra', 3, 12], ['scrollrack', 9, 12], ['portrait', 18, 2.4], ['candelabra', 25, 12], ['scrollrack', 28.5, 12],
            ['chain', 13, 2], ['drips', 34, 11, { w: 224, len: 10 }]] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    // the shelves close in: only a wolf fits under them (row 11)
    b.fill(34, 2, 47, 10);
    b.plat(15, 22, 8);
    b.item(19, 7, 'ink_dagger');
    b.candle(7, 7);
    b.candle(29, 7);
    b.enemy(26, 11, 'ink_slime');
  });

  // S7 — relic shrine: the Form of Mist
  A({ id: 'stk_mist', area: 'arc_stacks', x: 28, y: 12, w: 2, h: 2, lvl: 2, darkness: 0.5, noDecor: true,
      art: [
        ['arch', 27.5, 2.6, { w: 96, h: 210 }], ['bigcrest', 28.5, 5, { s: 1.6, halo: true }],
        ['pennant', 21, 4, { h: 80 }], ['pennant', 38, 4, { h: 80 }], ['chain', 14, 2], ['chain', 45, 2],
        ['portrait', 15, 8], ['portrait', 42, 8], ['crest', 16, 17], ['crest', 42, 17],
        ['candelabra', 25, 23], ['candelabra', 34, 23], ['candelabra', 14.5, 26], ['candelabra', 44.5, 26],
      ] }, (b) => {
    b.shell();
    b.door('L', 1);
    // the crawlspace from the stacks (row 25)
    b.fill(0, 14, 11, 24);
    // the relic dais
    b.fill(24, 23, 35, 25);
    b.stairs(21, 25, 3, 'r');
    b.stairs(38, 25, 3, 'l');
    b.relic(30, 22, 'form_mist');
    b.candle(18, 19);
    b.candle(42, 19);
    b.candle(24, 13);
    b.candle(36, 13);
  });

  // =============================== SCRIPTORIUM ===============================

  // C1 — entrance shaft of the Scriptorium, usually entered from below (B0, the hatch
  // from the crossroads tower)
  A({ id: 'scr_entry', area: 'arc_scriptorium', x: 19, y: 3, w: 2, h: 3, lvl: 1, entry: 'B0', noDecor: true,
      art: [
        // the loft and the void window above the bridge
        ['arch', 27, 3, { w: 96, h: 150 }], ['chain', 21, 2], ['chain', 41, 2],
        ['pennant', 37.5, 4, { h: 60 }], ['portrait', 13, 4], ['desk', 3.5, 12], ['candelabra', 8.5, 12],
        // door level
        ['portrait', 3.5, 16], ['crest', 42.6, 16.4], ['candelabra', 4.5, 26], ['candelabra', 42.5, 26],
        ['pennant', 15, 15, { h: 56 }], ['pennant', 31, 15, { h: 56 }],
        // around the hatch
        ['portrait', 4, 30], ['crest', 21.6, 30.4], ['portrait', 38, 30], ['portrait', 30, 34],
        ['candelabra', 2.5, 40], ['scrollrack', 19, 40], ['candelabra', 25, 40], ['scrollrack', 34, 40], ['candelabra', 43.5, 40],
      ] }, (b) => {
    b.shell();
    hatch(b, 0);
    b.door('L', 1);
    b.door('R', 1);
    // door landings and the bridge between them (open above the hatch)
    b.fill(1, 26, 9, 27);
    b.fill(38, 26, 46, 27);
    b.plat(14, 37, 26);
    // climbing from the hatch
    b.plat(18, 24, 36);
    b.plat(27, 33, 31);
    // the copyists' loft, with a cracked panel hiding a meal
    b.plat(21, 27, 21);
    b.plat(12, 17, 17);
    b.fill(1, 12, 10, 13);
    b.fill(1, 2, 2, 11);
    niche(b, 2, 9, 2, 11, 'roast_fowl');
    b.candle(6, 8);
    b.candle(24, 12, 'heart_big');
    b.candle(35, 18);
    b.candle(6, 21);
    b.candle(42, 21);
    b.candle(8, 34);
    b.candle(31, 29);
    b.candle(40, 34);
    b.enemy(30, 16, 'quill_wraith');
  });

  // C2 — the scroll archive (dead end): two storeys of scroll racks under hanging lamps
  A({ id: 'scr_west', area: 'arc_scriptorium', x: 15, y: 3, w: 4, h: 2, lvl: 1, entry: 'R1', noDecor: true,
      art: [
        // upper storey
        ['scrollrack', 5.5, 12], ['candelabra', 10.5, 12], ['scrollrack', 14, 12], ['scrollrack', 18, 12], ['portrait', 21.5, 3.5],
        ['candelabra', 31, 12], ['scrollrack', 34, 12], ['scrollrack', 38, 12], ['crest', 41.4, 4], ['scrollrack', 50, 12],
        ['candelabra', 55, 12], ['scrollrack', 57.2, 12], ['lamp', 14.5, 5, { len: 50 }], ['lamp', 36, 6, { len: 64 }], ['lamp', 52.5, 5, { len: 50 }],
        // lower storey
        ['scrollrack', 8.5, 26], ['candelabra', 13.5, 26], ['scrollrack', 25.5, 26], ['scrollrack', 29.5, 26], ['candelabra', 34, 26],
        ['scrollrack', 41, 26], ['scrollrack', 45, 26], ['candelabra', 57, 26],
        ['portrait', 11.5, 16], ['crest', 24.6, 16.5], ['portrait', 43.5, 15.6], ['pennant', 54, 15, { h: 56 }], ['lamp', 33, 16.4, { len: 40 }],
        ['rungs', 44.8, 19, { h: 7 }],
        // the stairwell
        ['arch', 76.5, 3, { w: 96, h: 176 }], ['chain', 66, 2], ['chain', 91, 2], ['lamp', 70, 8, { len: 100 }], ['lamp', 88.5, 9.6, { len: 120 }],
        ['candelabra', 80, 26], ['scrollrack', 85.5, 26], ['candelabra', 91.5, 26], ['portrait', 64, 16],
      ] }, (b) => {
    b.shell();
    b.door('R', 1);
    // upper storey, reached by the grand stair
    b.fill(1, 12, 60, 13);
    b.stairs(73, 24, 13, 'l'); // (73,24) → (61,12)
    b.fill(24, 8, 28, 11);
    b.fill(44, 2, 47, 5);
    b.item(4, 11, 'chain_whip');
    // lower storey: stacks of scroll cases under a plank walkway
    b.fill(20, 23, 23, 25);
    b.fill(36, 22, 38, 25);
    b.plat(30, 44, 19);
    b.lore(52, 25, 'arc_scrivener');
    // the far end: the amulet in a nook, and a cracked case hides a feast
    b.fill(1, 14, 2, 25);
    niche(b, 2, 23, 2, 25, 'pheasant');
    b.item(5, 25, 'inkpot_amulet');
    b.candle(8, 8);
    b.candle(20, 6);
    b.candle(33, 5);
    b.candle(50, 8);
    b.candle(7, 21);
    b.candle(17, 20);
    b.candle(28, 20);
    b.candle(47, 21);
    b.candle(58, 20);
    b.candle(68, 18);
    b.candle(84, 14);
    b.candle(92, 20);
    b.enemy(16, 10, 'quill_wraith');
    b.enemy(41, 17, 'quill_wraith');
    b.enemy(82, 12, 'page_swarm');
  });

  // C3 — the copyists' desks: writing desks below, a mezzanine of shelves above
  A({ id: 'scr_desks', area: 'arc_scriptorium', x: 21, y: 4, w: 4, h: 1, lvl: 1, noDecor: true,
      art: [
        ['desk', 3.5, 12], ['candelabra', 9, 12], ['desk', 18, 12], ['scrollrack', 24, 12], ['desk', 28.5, 12], ['desk', 36.5, 12],
        ['candelabra', 43.5, 12], ['desk', 55, 12], ['desk', 62.5, 12], ['scrollrack', 68, 12], ['candelabra', 72, 12],
        ['candelabra', 77, 10], ['scrollrack', 85, 10], ['candelabra', 93, 12],
        ['portrait', 4.5, 3], ['crest', 20.6, 2.2], ['portrait', 33, 2.2], ['lamp', 44, 4, { len: 30 }], ['portrait', 57, 3],
        ['arch', 63.5, 2.2, { w: 64, h: 116 }], ['crest', 82, 3.6], ['pennant', 79, 2.6, { h: 56 }], ['pennant', 87.5, 2.6, { h: 56 }],
        ['chain', 12, 2], ['chain', 41, 2], ['rungs', 38.6, 7, { h: 5 }],
      ] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    // a mezzanine of shelves above the desks
    b.stairs(12, 10, 4, 'r'); // (12,10) → (15,7)
    b.plat(16, 40, 7);
    // a tall copy-stand; the archivist's robe on a shelf above it
    b.fill(48, 10, 52, 11);
    b.plat(47, 53, 5);
    b.item(50, 4, 'archivist_robe');
    // the master copyist's dais: margins of a spellbook
    b.stairs(74, 11, 2, 'r');
    b.fill(76, 10, 88, 11);
    b.stairs(90, 11, 2, 'l');
    b.lore(82, 9, 'arc_spells');
    b.candle(6, 7);
    b.candle(21, 4);
    b.candle(30, 4, 'sub:grimoire');
    b.candle(44, 8);
    b.candle(58, 7);
    b.candle(68, 8);
    b.candle(80, 6);
    b.candle(92, 7);
    b.enemy(28, 6, 'quill_wraith');
    b.enemy(57, 6, 'living_grimoire');
    b.enemy(70, 5, 'living_grimoire');
  });

  // C4 — the grate column: three iron grates that only mist can pass. Each grate is also a
  // floor to rest on (and recover MP) on the way up; the top one is a single jump below the
  // hatch into the Hall of Hunters.
  A({ id: 'scr_grate', area: 'arc_scriptorium', x: 25, y: 3, w: 1, h: 2, lvl: 1, gates: { T0: 3 }, noDecor: true,
      art: [['chain', 4, 2], ['chain', 19, 2], ['crest', 10.75, 7.4], ['pennant', 3, 13.6, { h: 50 }], ['pennant', 18.5, 13.6, { h: 50 }],
            ['arch', 8.5, 13.4, { w: 64, h: 94 }], ['portrait', 13.5, 21.6], ['candelabra', 4, 26], ['candelabra', 19, 26]] }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('T', 0);
    b.fill(1, 20, 22, 20, 'G');
    b.fill(1, 12, 22, 12, 'G');
    b.fill(1, 5, 22, 5, 'G');
    b.candle(8, 22);
    b.candle(6, 15);
    b.candle(18, 9);
  });

  // ============================= HALL OF HUNTERS =============================

  // H1 — Hall of Hunters: two long floors of portraits. Arrive through the grate shaft.
  const hunterArt = [
    // the stairwell
    ['pennant', 3.5, 9.4, { h: 70 }], ['bigcrest', 11.2, 15.2, { s: 1.5 }], ['pennant', 18.5, 15.4, { h: 60 }],
    ['arch', 9, 2.4, { w: 48, h: 90 }], ['candelabra', 3, 26], ['portrait', 2.5, 15.5],
    ['candelabra', 2.4, 6], ['scrollrack', 5, 6],
  ];
  for (let k = 0; k < 13; k++) {
    const x = 24 + k * 7.3;
    hunterArt.push(['portrait', x, 3.4], ['portrait', x + 0.6, 16.6]);
    hunterArt.push(k % 3 === 1 ? ['crest', x + 4.1, 4.2] : ['candelabra', x + 4.6, 12]);
    // (no candelabra over the hatch and its dip, cols 30-41)
    hunterArt.push(k % 3 === 2 || (x + 5 > 29 && x + 5 < 42) ? ['crest', x + 4.7, 17.2] : ['candelabra', x + 5, 26]);
  }
  A({ id: 'hun_gallery', area: 'arc_hunters', x: 24, y: 1, w: 5, h: 2, lvl: 3, entry: 'B1', noDecor: true, art: hunterArt }, (b) => {
    b.relic(118, 6, 'familiar_bat'); // optional relic on the high east ledge
    b.shell();
    hatch(b, 1);
    b.door('R', 0);
    // upper floor, and the stairwell at the west end
    b.fill(22, 12, 118, 13);
    b.stairs(9, 24, 13, 'r'); // (9,24) → (21,12)
    // a perch above the stairwell, with a bandana left by some young hunter
    b.plat(11, 17, 9);
    b.fill(1, 6, 7, 7);
    b.item(4, 5, 'hunter_bandana');
    // the falchion on a pedestal of the upper hall
    b.fill(58, 11, 62, 11);
    b.item(60, 10, 'falchion');
    // the far end of the lower hall: a cracked panel
    b.fill(116, 14, 118, 25);
    niche(b, 116, 23, 116, 25, 'roast_fowl');
    b.lore(42, 25, 'arc_portraits');
    b.candle(30, 21);
    b.candle(50, 21);
    b.candle(70, 21);
    b.candle(90, 21);
    b.candle(108, 21);
    b.candle(16, 5);
    b.candle(30, 7);
    b.candle(46, 7);
    b.candle(76, 7);
    b.candle(100, 7);
    b.enemy(62, 25, 'hunter_shade');
    b.enemy(96, 25, 'hunter_shade');
    b.enemy(86, 11, 'archive_sentinel');
  });

  // H2 — arena of the Echo of the Belmont: flat floor (row 26), a central dais
  // (rows 23-25, cols 32-39) and two side platforms (row 18)
  A({ id: 'hun_echo', area: 'arc_hunters', x: 29, y: 0, w: 3, h: 2, lvl: 3, darkness: 0.4, noDecor: true,
      art: [
        ['bigcrest', 33.75, 5.5, { s: 3, halo: true }], ['pennant', 26, 3, { h: 96 }], ['pennant', 44.5, 3, { h: 96 }],
        ['portrait', 5, 4], ['portrait', 13, 4], ['portrait', 56, 4], ['portrait', 64, 4],
        ['crest', 9.6, 11], ['crest', 60.6, 11], ['chain', 20, 2], ['chain', 51, 2],
        ['candelabra', 32.5, 23], ['candelabra', 38, 23], ['candelabra', 4, 26], ['candelabra', 20, 26], ['candelabra', 51, 26], ['candelabra', 66.5, 26],
        ['portrait', 22, 17.5], ['portrait', 48.5, 17.5],
      ] }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('R', 1);
    b.fill(32, 23, 39, 25);
    b.plat(10, 18, 18);
    b.plat(53, 61, 18);
    b.candle(8, 14);
    b.candle(63, 14);
    b.candle(25, 21);
    b.candle(46, 21);
    b.boss(36, 22, 'echo');
  });

  // H3 — Richter, bound in chains that were written rather than forged
  A({ id: 'hun_richter', area: 'arc_hunters', x: 32, y: 1, w: 2, h: 1, lvl: 3, darkness: 0.45, noDecor: true,
      art: [
        // the written chains fade once Richter is free
        ['drips', 26, 2, { w: 208, len: 80, unless: 'richter_free' }], ['chain', 28.5, 2, { unless: 'richter_free' }],
        ['chain', 31, 2, { unless: 'richter_free' }], ['chain', 34, 2, { unless: 'richter_free' }], ['chain', 36.5, 2, { unless: 'richter_free' }],
        ['crest', 31.25, 3.4], ['candelabra', 23, 12], ['candelabra', 40.5, 12],
        ['portrait', 6, 3], ['portrait', 13, 3], ['pennant', 18.5, 2.6, { h: 56 }], ['arch', 42, 3, { w: 48, h: 100 }],
      ] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.npc(32, 11, 'richter', { scene: 'richter_freed', hideFlag: 'richter_free' });
    b.candle(10, 7);
    b.candle(21, 7);
    b.candle(43, 8);
  });

  // ============================= FORBIDDEN VAULT =============================

  // V1 — the vault gate, under the seal band of the Stacks: ink pours through the
  // hatch; hanging walkways lead down to the great door of the Vault (L1)
  A({ id: 'vault_gate', area: 'arc_vault', x: 17, y: 14, w: 2, h: 2, lvl: 4, entry: 'T1', noDecor: true,
      art: [
        ['shade', 28, 26, { w: 224, h: 16, a: 0.9 }],
        ['drips', 33, 2, { w: 80, len: 70 }], ['chain', 29, 2], ['chain', 38.5, 2], ['chain', 42, 6], ['chain', 23, 8],
        ['arch', 13, 3, { w: 80, h: 150 }], ['portrait', 4, 4], ['crest', 26.6, 5.5],
        // the great door
        ['bigcrest', 1.6, 12.2, { s: 1.2, col: '#2a0c3a' }], ['pennant', 9, 13, { h: 60, col: '#2c0e3e' }],
        ['candelabra', 10.5, 26], ['candelabra', 34, 26], ['candelabra', 43, 26], ['portrait', 38, 17.5],
      ] }, (b) => {
    b.shell();
    b.door('T', 1);
    b.door('L', 1);
    // the door frame: a heavy lintel over the passage to the Vault
    b.fill(1, 18, 6, 21);
    b.fill(7, 18, 7, 19);
    // hanging walkways down from the hatch
    b.plat(33, 40, 5);
    b.plat(27, 33, 10);
    b.plat(38, 44, 14);
    b.plat(28, 34, 18);
    b.plat(18, 24, 22);
    // a puddle of ink below the hatch
    b.fill(28, 26, 41, 26, '~');
    b.candle(42, 7);
    b.candle(22, 13);
    b.candle(12, 20);
    b.candle(36, 22);
    b.enemy(16, 25, 'ink_slime');
    b.enemy(30, 7, 'page_swarm');
  });

  // V2 — vault stairs: up and over the inner wall, then down to the drowned vault
  A({ id: 'vault_stairs', area: 'arc_vault', x: 13, y: 14, w: 4, h: 2, lvl: 4, entry: 'R1', noDecor: true,
      art: [
        // the entrance hall (east)
        ['candelabra', 84, 26], ['portrait', 86, 16], ['crest', 92, 17], ['pennant', 76, 15, { h: 56, col: '#2c0e3e' }],
        ['scrollrack', 89.5, 26], ['chain', 83, 2], ['chain', 91, 2],
        // the gallery over the inner wall
        ['arch', 47.5, 2.6, { w: 112, h: 140 }], ['drips', 44, 14, { w: 256, len: 60 }],
        ['candelabra', 32, 12], ['lectern', 39.5, 12], ['candelabra', 43, 12], ['candelabra', 62, 12], ['scrollrack', 64.5, 12],
        ['portrait', 34, 3.5], ['portrait', 63, 3.5], ['crest', 41.5, 4], ['crest', 59, 4],
        // the west hall and the hatch down
        ['shade', 22, 26, { w: 304, h: 16, a: 0.9 }],
        ['portrait', 4, 16], ['crest', 33, 16.4], ['candelabra', 3, 26], ['candelabra', 19.5, 26], ['candelabra', 42, 26],
        ['pennant', 8, 2.6, { h: 64, col: '#2c0e3e' }], ['chain', 16, 2], ['chain', 25, 2],
      ] }, (b) => {
    b.shell();
    b.door('R', 1);
    hatch(b, 0);
    // the gallery and the inner wall it crowns
    b.fill(30, 12, 67, 13);
    b.fill(44, 14, 59, 25);
    b.stairs(80, 24, 13, 'l'); // (80,24) → (68,12)
    b.stairs(17, 24, 13, 'r'); // (17,24) → (29,12)
    b.plat(47, 55, 7);
    b.item(51, 6, 'scholar_foil');
    b.lore(36, 11, 'arc_bibliophage');
    // ink pooled against the inner wall
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

  // V3 — the drowned vault: a lake of ink-black water and the Lantern of Revelation
  // on its island. Arrive from the hatch (T0); leave by the east shore (R2).
  A({ id: 'vault_deep', area: 'arc_vault', x: 13, y: 16, w: 4, h: 3, lvl: 4, entry: 'T0', darkness: 0.6, noDecor: true,
      art: [
        // landing under the hatch
        ['drips', 9, 2, { w: 80, len: 40 }], ['candelabra', 15.5, 5], ['pennant', 2, 1.6, { h: 40, col: '#2c0e3e' }],
        ['chain', 22, 2], ['chain', 34, 2], ['portrait', 30, 4], ['crest', 38.6, 6],
        ['arch', 50, 3, { w: 112, h: 230 }], ['chain', 66, 2], ['chain', 80, 2], ['portrait', 84, 6], ['crest', 89, 14],
        ['candelabra', 29, 13], ['candelabra', 39, 13], ['candelabra', 52, 21], ['candelabra', 60, 21],
        ['drips', 27, 15, { w: 240, len: 50 }], ['drips', 49, 23, { w: 224, len: 60 }],
        // the lake and its island (the lake bed is black: the water reads as ink)
        ['shade', 19, 35, { w: 864, h: 80, a: 0.9 }],
        ['bigcrest', 41.6, 23.5, { s: 1.4, col: '#2a0c3a', halo: true }], ['candelabra', 40.4, 33], ['candelabra', 46, 33],
        ['crest', 26, 28], ['portrait', 62, 28.5], ['chain', 55, 25],
        // the drowned crypt (west shore) and the east shore
        ['portrait', 4, 27.4], ['crest', 12, 28.4], ['candelabra', 2.5, 35], ['scrollrack', 13, 35],
        ['candelabra', 76, 40], ['scrollrack', 84, 40], ['candelabra', 90, 40], ['portrait', 86, 30],
      ] }, (b) => {
    b.shell();
    b.door('T', 0);
    b.door('R', 2);
    // landing under the hatch, then stairs down to the first shelf
    b.fill(1, 5, 18, 6);
    b.lore(5, 4, 'arc_ink');
    b.stairs(26, 12, 8, 'l'); // (26,12) → (19,5)
    b.fill(27, 13, 41, 14);
    b.plat(43, 47, 17);
    b.fill(49, 21, 62, 22);
    b.plat(64, 69, 25);
    b.plat(70, 75, 30);
    b.plat(77, 82, 35);
    // the ink lake with the lantern's island; two shelves drift just above the ink
    b.fill(19, 35, 72, 39, '~');
    b.fill(73, 35, 74, 39);
    b.fill(40, 33, 47, 39);
    b.relic(44, 32, 'lantern');
    b.mplat(21, 34, { dx: 15, len: 3, period: 420 });
    b.mplat(50, 34, { dx: 20, len: 3, period: 520, phase: 130 });
    // the drowned crypt on the west shore
    b.fill(1, 35, 18, 39);
    b.item(6, 34, 'requiem_edge');
    b.candle(8, 9);
    b.candle(34, 9);
    b.candle(56, 17);
    b.candle(44, 28);
    b.candle(10, 31);
    b.candle(30, 31);
    b.candle(60, 31);
    b.candle(86, 35);
    b.enemy(58, 20, 'vault_horror');
    b.enemy(14, 34, 'vault_horror');
  });

  // V4 — save room
  A({ id: 'vault_save', area: 'arc_vault', x: 17, y: 18, w: 1, h: 1, lvl: 4, darkness: 0.2, noDecor: true,
      art: [['pennant', 3.5, 3.4, { h: 60, col: '#2c0e3e' }], ['pennant', 19, 3.4, { h: 60, col: '#2c0e3e' }], ['crest', 11.25, 3.2],
            ['candelabra', 7, 12], ['candelabra', 15.5, 12]] }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    b.fill(1, 2, 22, 2);
    b.fill(1, 3, 4, 3);
    b.fill(19, 3, 22, 3);
    b.save(12, 11);
  });

  // V5 — arena of the Bibliophage: a great empty well of the Vault (floor row 40,
  // side platforms at rows 30 and 22)
  A({ id: 'vault_worm', area: 'arc_vault', x: 18, y: 16, w: 4, h: 3, lvl: 4, darkness: 0.5, noDecor: true,
      art: [
        ['drips', 1, 2, { w: 1504, len: 46 }], ['arch', 36, 6, { w: 128, h: 240 }], ['arch', 54, 8, { w: 96, h: 200 }],
        ['chain', 26, 2], ['chain', 32, 2], ['chain', 64, 2], ['chain', 70, 2],
        ['portrait', 6, 8], ['portrait', 86, 8], ['crest', 9.5, 17], ['crest', 84.5, 17],
        ['pennant', 26, 12, { h: 80, col: '#2c0e3e' }], ['pennant', 68, 12, { h: 80, col: '#2c0e3e' }],
        ['candelabra', 6, 30], ['candelabra', 89, 30], ['candelabra', 16, 22], ['candelabra', 78, 22],
        ['candelabra', 4, 40], ['candelabra', 24, 40], ['candelabra', 70, 40], ['candelabra', 91, 40],
        ['drips', 4, 30.4, { w: 160, len: 26 }], ['drips', 82, 30.4, { w: 160, len: 26 }],
      ] }, (b) => {
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
    b.candle(36, 34);
    b.candle(60, 34);
    b.boss(52, 39, 'biblio');
  });

  // V6 — the treasure of the Vault
  A({ id: 'vault_treasure', area: 'arc_vault', x: 22, y: 18, w: 2, h: 1, lvl: 4, darkness: 0.35, noDecor: true,
      art: [
        ['bigcrest', 37.6, 2.4, { s: 1.4, col: '#2a0c3a', halo: true }], ['pennant', 34, 2.6, { h: 64, col: '#2c0e3e' }],
        ['pennant', 44.5, 2.6, { h: 64, col: '#2c0e3e' }], ['chain', 17, 2], ['chain', 25, 2],
        ['portrait', 4, 3], ['portrait', 21, 3], ['candelabra', 9, 12], ['candelabra', 17, 12], ['candelabra', 25, 12],
        ['candelabra', 32, 12],
      ] }, (b) => {
    b.shell();
    b.door('L', 0);
    // three plinths and the altar of the Crimson Requiem
    b.fill(12, 11, 14, 11);
    b.item(13, 10, 'nightfall_cloak');
    b.fill(20, 11, 22, 11);
    b.item(21, 10, 'ink_shield');
    b.fill(28, 11, 30, 11);
    b.item(29, 10, 'hp_up');
    b.stairs(35, 11, 2, 'r');
    b.fill(37, 10, 45, 11);
    b.fill(39, 9, 43, 9);
    b.tome(41, 8, 'crimson_requiem');
    b.candle(8, 7);
    b.candle(17, 6);
    b.candle(25, 6);
    b.candle(33, 6);
  });
})();
