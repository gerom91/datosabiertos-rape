/* Elegy of the Night — world.js
 * Areas, maps, room registry (ASCII room format), runtime Room objects and
 * map-cell indexing used for transitions and the map screen.
 *
 * ROOM FORMAT (see docs/ROOMS.md):
 *   G.world.room({ id, map:'castle'|'archives', area, x, y, w, h, rows:[...], legend:{} })
 *   rows: h*14 strings of w*24 chars.
 *   Tiles:  '.' empty  '#' solid  '=' one-way platform  '/' slope rising right
 *           '\\' slope rising left  '^' spikes  'G' grate (mist passes)
 *           'B' breakable wall  'X' Belmont seal (opens with the Belmont Crest)
 *           '~' water  'I' invisible-ink walkway (one-way, needs the Lantern)
 *   Entities (lowercase / symbols, placed standing on the tile below):
 *           'c' candle   's' save point   't' teleporter   '@' start position
 *           any other letter → room legend entry {t:'enemy', id:'ghoul', ...}
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const TS = G.TILE, CW = G.CELL_W, CH = G.CELL_H;

  const T = (G.T = {
    EMPTY: 0, SOLID: 1, ONEWAY: 2, SLOPE_R: 3, SLOPE_L: 4, SPIKES: 5, GRATE: 6, BREAK: 7, SEAL: 8, WATER: 9, INK: 10,
  });
  const CHAR_TILE = { '.': 0, ' ': 0, '#': 1, '=': 2, '/': 3, '\\': 4, '^': 5, G: 6, B: 7, X: 8, '~': 9, I: 10 };
  G.CHAR_TILE = CHAR_TILE;

  const DEFAULT_LEGEND = {
    c: { t: 'candle' },
    s: { t: 'save' },
    t: { t: 'teleport' },
    '@': { t: 'start' },
  };

  const W = (G.world = {
    areas: {},
    rooms: {},
    order: [],
    maps: {
      castle: { id: 'castle', name: { en: 'Dracula’s Castle', es: 'Castillo de Drácula' }, cells: new Map(), total: 0 },
      archives: { id: 'archives', name: { en: 'Belmont Archives', es: 'Archivos Belmont' }, cells: new Map(), total: 0 },
    },
    built: false,
    errors: [],
  });

  W.area = function (id, def) {
    def.id = id;
    W.areas[id] = def;
  };

  W.room = function (def) {
    if (W.rooms[def.id]) W.errors.push('Duplicate room id ' + def.id);
    def.map = def.map || 'castle';
    def.w = def.w || 1;
    def.h = def.h || 1;
    W.rooms[def.id] = def;
    W.order.push(def.id);
    W.built = false;
  };

  function normRows(def) {
    const tw = def.w * CW, th = def.h * CH;
    const rows = (def.rows || []).slice();
    if (rows.length !== th) W.errors.push(def.id + ': has ' + rows.length + ' rows, expected ' + th);
    while (rows.length < th) rows.push('#'.repeat(tw));
    rows.length = th;
    for (let i = 0; i < th; i++) {
      if (rows[i].length !== tw) {
        W.errors.push(def.id + ': row ' + i + ' has ' + rows[i].length + ' chars, expected ' + tw);
        rows[i] = (rows[i] + '#'.repeat(tw)).slice(0, tw);
      }
    }
    return rows;
  }

  // Index all rooms into their map's cell grid. Called once after data files load.
  W.build = function () {
    for (const m of Object.values(W.maps)) {
      m.cells.clear();
      m.total = 0;
      m.minX = m.minY = 1e9;
      m.maxX = m.maxY = -1e9;
    }
    for (const id of W.order) {
      const def = W.rooms[id];
      def._rows = normRows(def);
      const m = W.maps[def.map];
      if (!m) {
        W.errors.push(id + ': unknown map ' + def.map);
        continue;
      }
      for (let cy = 0; cy < def.h; cy++)
        for (let cx = 0; cx < def.w; cx++) {
          const key = def.x + cx + ',' + (def.y + cy);
          if (m.cells.has(key)) W.errors.push(id + ': overlaps ' + m.cells.get(key) + ' at ' + key);
          m.cells.set(key, id);
          m.total++;
        }
      m.minX = Math.min(m.minX, def.x);
      m.minY = Math.min(m.minY, def.y);
      m.maxX = Math.max(m.maxX, def.x + def.w - 1);
      m.maxY = Math.max(m.maxY, def.y + def.h - 1);
    }
    // exits / doors for the map screen, features for map colouring
    for (const id of W.order) {
      const def = W.rooms[id];
      computeDoors(def);
      const legend = Object.assign({}, DEFAULT_LEGEND, def.legend || {});
      def._feat = {};
      for (const r of def._rows)
        for (const ch of r) {
          const L = CHAR_TILE[ch] === undefined ? legend[ch] : null;
          if (L) def._feat[L.t] = L.id || true;
        }
    }
    W.built = true;
    if (W.errors.length && root.console) console.warn('[world] ' + W.errors.length + ' issue(s):\n' + W.errors.join('\n'));
  };

  W.roomAtCell = function (mapId, cx, cy) {
    const m = W.maps[mapId];
    return m ? m.cells.get(cx + ',' + cy) || null : null;
  };

  function tileCharAt(def, tx, ty) {
    const r = def._rows[ty];
    return r ? r[tx] : '#';
  }
  function charOpen(ch) {
    const t = CHAR_TILE[ch];
    if (t === undefined) return true; // entity letter → empty
    return t === T.EMPTY || t === T.WATER || t === T.ONEWAY || t === T.SLOPE_L || t === T.SLOPE_R || t === T.INK;
  }
  W.charOpen = charOpen;

  // Doors: openings on the room border that lead into a neighbouring room.
  function computeDoors(def) {
    const tw = def.w * CW, th = def.h * CH;
    def._doors = []; // {side, cell, to}
    const seen = new Set();
    // left/right sides
    for (const side of ['L', 'R']) {
      const tx = side === 'L' ? 0 : tw - 1;
      for (let ty = 0; ty < th; ty++) {
        if (!charOpen(tileCharAt(def, tx, ty))) continue;
        const cy = Math.floor(ty / CH);
        const ncx = side === 'L' ? def.x - 1 : def.x + def.w;
        const to = W.roomAtCell(def.map, ncx, def.y + cy);
        const key = side + cy;
        if (seen.has(key)) continue;
        seen.add(key);
        def._doors.push({ side, cell: cy, to, ty });
      }
    }
    for (const side of ['T', 'B']) {
      const ty = side === 'T' ? 0 : th - 1;
      for (let tx = 0; tx < tw; tx++) {
        if (!charOpen(tileCharAt(def, tx, ty))) continue;
        const cx = Math.floor(tx / CW);
        const ncy = side === 'T' ? def.y - 1 : def.y + def.h;
        const to = W.roomAtCell(def.map, def.x + cx, ncy);
        const key = side + cx;
        if (seen.has(key)) continue;
        seen.add(key);
        def._doors.push({ side, cell: cx, to, tx });
      }
    }
  }

  // ---- Runtime room ----------------------------------------------------------
  function Room(def) {
    this.def = def;
    this.id = def.id;
    this.map = def.map;
    this.area = W.areas[def.area] || { id: def.area, theme: 'entrance' };
    this.tw = def.w * CW;
    this.th = def.h * CH;
    this.pw = this.tw * TS;
    this.ph = this.th * TS;
    this.tiles = new Uint8Array(this.tw * this.th);
    this.spawns = [];
    this.version = 0; // bumps when tiles change (re-render)
    const legend = Object.assign({}, DEFAULT_LEGEND, def.legend || {});
    const rows = def._rows;
    for (let ty = 0; ty < this.th; ty++) {
      const r = rows[ty];
      for (let tx = 0; tx < this.tw; tx++) {
        const ch = r[tx];
        let t = CHAR_TILE[ch];
        if (t === undefined) {
          t = T.EMPTY;
          const L = legend[ch];
          if (L) {
            const sp = Object.assign({}, L);
            sp.tx = tx;
            sp.ty = ty;
            sp.x = tx * TS + TS / 2;
            sp.y = ty * TS + TS; // bottom of the tile
            sp.key = def.id + ':' + tx + ',' + ty;
            this.spawns.push(sp);
            if (L.tile) t = CHAR_TILE[L.tile] || 0;
          } else if (ch !== '.' && root.console) W.errors.push(def.id + ': unknown char "' + ch + '" at ' + tx + ',' + ty);
        }
        this.tiles[ty * this.tw + tx] = t;
      }
    }
  }
  Room.prototype.get = function (tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) {
      // outside: open only where the border tile is an opening
      const cx = tx < 0 ? 0 : tx >= this.tw ? this.tw - 1 : tx;
      const cy = ty < 0 ? 0 : ty >= this.th ? this.th - 1 : ty;
      const t = this.tiles[cy * this.tw + cx];
      return t === T.EMPTY || t === T.WATER || t === T.ONEWAY || t === T.SLOPE_L || t === T.SLOPE_R ? T.EMPTY : T.SOLID;
    }
    return this.tiles[ty * this.tw + tx];
  };
  Room.prototype.set = function (tx, ty, t) {
    if (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) return;
    this.tiles[ty * this.tw + tx] = t;
    this.version++;
  };
  Room.prototype.cellOf = function (px, py) {
    return { cx: this.def.x + Math.floor(px / G.CELL_PX_W), cy: this.def.y + Math.floor(py / G.CELL_PX_H) };
  };
  W.Room = Room;

  W.load = function (id) {
    if (!W.built) W.build();
    const def = W.rooms[id];
    if (!def) throw new Error('Unknown room ' + id);
    return new Room(def);
  };

  W.areaName = function (areaId) {
    const a = W.areas[areaId];
    return a ? G.tr(a.name) : areaId;
  };
})();
