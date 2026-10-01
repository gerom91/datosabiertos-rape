/* Elegy of the Night — roombuilder.js
 * Small DSL used by the room data files. It produces the ASCII rows that
 * world.js understands, with doors carved at the standard positions so
 * neighbouring rooms always line up.
 *
 *   G.R({ id:'ent_hall', area:'entrance', x:3, y:19, w:3, h:2 }, (b) => {
 *     b.shell();                 // solid border (2 tiles on floors/ceilings)
 *     b.door('L', 1); b.door('R', 0);
 *     b.fill(10, 20, 15, 21);    // inclusive rectangle of '#'
 *     b.stairs(30, 25, 14, 'r'); // '/' going up-right from (30,25)
 *     b.plat(4, 9, 18);          // one-way platform row 18, cols 4..9
 *     b.enemy(40, 25, 'ghoul');  // feet on the floor tile below row 25
 *     b.candle(12, 22); b.item(60, 25, 'rusted_saber');
 *   });
 *
 * Coordinates are tile columns/rows inside the room (0-based).
 * Standard doors: side doors open rows (cell*14+8 .. cell*14+11) with floor
 * at rows cell*14+12..13; top/bottom doors open columns (cell*24+10 .. +13).
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const CW = G.CELL_W, CH = G.CELL_H;
  const LETTERS = 'abdefghijklmnopqruvwxyzACDEFHJKLMNOPQRSTUVWYZ0123456789!$&*+-:;<>?_|';

  G.R = function (meta, fn) {
    const w = meta.w || 1, h = meta.h || 1;
    const tw = w * CW, th = h * CH;
    const grid = [];
    for (let y = 0; y < th; y++) grid.push(new Array(tw).fill('.'));
    const legend = {};
    const keyToCh = {};
    let li = 0;
    const inb = (x, y) => x >= 0 && y >= 0 && x < tw && y < th;
    const b = {
      tw, th, w, h,
      set(x, y, ch) {
        if (inb(x, y)) grid[y][x] = ch;
        return b;
      },
      get(x, y) {
        return inb(x, y) ? grid[y][x] : '#';
      },
      fill(x0, y0, x1, y1, ch) {
        ch = ch || '#';
        const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
        for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) b.set(x, y, ch);
        return b;
      },
      clear(x0, y0, x1, y1) {
        return b.fill(x0, y0, x1, y1, '.');
      },
      // solid frame: side walls `side` thick, ceiling `top` thick, floor `bottom` thick
      shell(side, top, bottom) {
        side = side == null ? 1 : side;
        top = top == null ? 2 : top;
        bottom = bottom == null ? 2 : bottom;
        if (top) b.fill(0, 0, tw - 1, top - 1);
        if (bottom) b.fill(0, th - bottom, tw - 1, th - 1);
        if (side) {
          b.fill(0, 0, side - 1, th - 1);
          b.fill(tw - side, 0, tw - 1, th - 1);
        }
        return b;
      },
      // floor of a cell row: rows (cell*14+12, +13) across x0..x1
      cellFloor(cell, x0, x1) {
        return b.fill(x0 == null ? 0 : x0, cell * CH + 12, x1 == null ? tw - 1 : x1, cell * CH + 13);
      },
      /* door(side, cell, depth): carve the standard opening, `depth` tiles deep
       * into the room (default 2), and make sure the floor under it is solid. */
      door(side, cell, depth) {
        depth = depth == null ? 2 : depth;
        if (side === 'L' || side === 'R') {
          const r0 = cell * CH + 8;
          for (let d = 0; d < depth; d++) {
            const x = side === 'L' ? d : tw - 1 - d;
            for (let r = r0; r < r0 + 4; r++) b.set(x, r, '.');
            b.set(x, r0 + 4, '#');
            b.set(x, r0 + 5, '#');
            b.set(x, r0 - 1, '#');
          }
        } else {
          const c0 = cell * CW + 10;
          for (let d = 0; d < depth; d++) {
            const y = side === 'T' ? d : th - 1 - d;
            for (let c = c0; c < c0 + 4; c++) b.set(c, y, '.');
            b.set(c0 - 1, y, '#');
            b.set(c0 + 4, y, '#');
          }
        }
        return b;
      },
      // stairs: dir 'r' ('/', climbing to the right) or 'l' ('\\', climbing to the left)
      stairs(x, y, n, dir) {
        for (let i = 0; i < n; i++) {
          if (dir === 'l') b.set(x - i, y - i, '\\');
          else b.set(x + i, y - i, '/');
        }
        return b;
      },
      plat(x0, x1, y, ch) {
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) b.set(x, y, ch || '=');
        return b;
      },
      stamp(x, y, rows) {
        rows.forEach((r, j) => {
          for (let i = 0; i < r.length; i++) if (r[i] !== ' ') b.set(x + i, y + j, r[i]);
        });
        return b;
      },
      // generic entity: obj is a legend entry
      spawn(x, y, obj, tileCh) {
        const k = JSON.stringify(obj);
        let ch = keyToCh[k];
        if (!ch) {
          if (obj.t === 'candle' && !obj.drop && !obj.lift && !tileCh) ch = 'c';
          else if (obj.t === 'save' && Object.keys(obj).length === 1) ch = 's';
          else if (obj.t === 'teleport' && Object.keys(obj).length === 1) ch = 't';
          else if (obj.t === 'start') ch = '@';
          else {
            while (li < LETTERS.length && legend[LETTERS[li]]) li++;
            ch = LETTERS[li++];
            legend[ch] = tileCh ? Object.assign({ tile: tileCh }, obj) : obj;
          }
          keyToCh[k] = ch;
        }
        b.set(x, y, ch);
        return b;
      },
      enemy(x, y, id, extra) {
        return b.spawn(x, y, Object.assign({ t: 'enemy', id }, extra || {}));
      },
      boss(x, y, id, extra) {
        return b.spawn(x, y, Object.assign({ t: 'enemy', id }, extra || {}));
      },
      candle(x, y, drop, extra) {
        return b.spawn(x, y, Object.assign({ t: 'candle' }, drop ? { drop } : {}, extra || {}));
      },
      item(x, y, id, extra) {
        return b.spawn(x, y, Object.assign({ t: 'item', id }, extra || {}));
      },
      // item hidden inside a breakable wall tile
      hidden(x, y, id) {
        return b.spawn(x, y, { t: 'item', id, hidden: true }, 'B');
      },
      relic(x, y, id) {
        return b.spawn(x, y, { t: 'relic', id });
      },
      sub(x, y, id) {
        return b.spawn(x, y, { t: 'subweapon', id });
      },
      save(x, y) {
        return b.spawn(x, y, { t: 'save' });
      },
      tp(x, y) {
        return b.spawn(x, y, { t: 'teleport' });
      },
      start(x, y) {
        return b.spawn(x, y, { t: 'start' });
      },
      lore(x, y, id) {
        return b.spawn(x, y, { t: 'lore', id });
      },
      tome(x, y, spell) {
        return b.spawn(x, y, { t: 'tome', spell });
      },
      npc(x, y, id, extra) {
        return b.spawn(x, y, Object.assign({ t: 'npc', id }, extra || {}));
      },
      shop(x, y) {
        return b.spawn(x, y, { t: 'shop' });
      },
      portal(x, y, to, tx, ty, extra) {
        // the Room constructor overwrites every spawn's tx/ty with its own tile: keep the arrival in `dest`
        return b.spawn(x, y, Object.assign({ t: 'portal', to, tx, ty, dest: [tx, ty] }, extra || {}));
      },
      trigger(x, y, scene, tw2, th2, extra) {
        return b.spawn(x, y, Object.assign({ t: 'trigger', scene, tw: tw2 || 1, th: th2 || 3 }, extra || {}));
      },
      pagelock(x, y) {
        return b.spawn(x, y, { t: 'pagelock' });
      },
      mplat(x, y, extra) {
        return b.spawn(x, y, Object.assign({ t: 'mplat' }, extra || {}));
      },
      ascii() {
        return grid.map((r) => r.join(''));
      },
    };
    fn(b);
    meta.rows = grid.map((r) => r.join(''));
    meta.legend = Object.assign({}, meta.legend || {}, legend);
    G.world.room(meta);
    return meta;
  };
})();
