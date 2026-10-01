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
  const T = G.T;
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
  function rise(b, x0, y1, prof, slopes) {
    const fl = [];
    for (let i = 0; i < prof.length; i++) {
      const d = depth(prof[i]);
      if (d > 0) b.fill(x0 + i, y1 - d + 1, x0 + i, y1);
      fl.push(y1 - d + 1);
    }
    if (slopes !== false) slopeFloor(b, x0, fl);
  }
  // rock growing in from a side wall: one character per row, thickness in tiles
  function side(b, s, y0, prof) {
    for (let i = 0; i < prof.length; i++) {
      const d = depth(prof[i]);
      if (d <= 0) continue;
      if (s === 'L') b.fill(0, y0 + i, d - 1, y0 + i);
      else b.fill(b.tw - d, y0 + i, b.tw - 1, y0 + i);
    }
  }
  // smooth 1-D value noise: n integers in [0, amp], one random knot every `per` columns
  function noise(seed, n, per, amp) {
    const r = U.RNG(seed);
    const k = [];
    for (let i = 0; i <= Math.ceil(n / per) + 1; i++) k.push(r.next());
    const out = [];
    for (let i = 0; i < n; i++) {
      const j = Math.floor(i / per), f = (i % per) / per, s = f * f * (3 - 2 * f);
      out.push(Math.round((k[j] * (1 - s) + k[j + 1] * s) * amp));
    }
    return out;
  }
  function lerpPts(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], c = pts[i + 1];
      if (x <= c[0]) return a[1] + ((c[1] - a[1]) * (x - a[0])) / Math.max(1, c[0] - a[0]);
    }
    return pts[pts.length - 1][1];
  }
  const isRock = (ch) => ch === '#' || ch === 'B';
  // slope tiles on the one-tile steps of a floor (fl[i] = top solid row of column x0+i)
  function slopeFloor(b, x0, fl) {
    for (let i = 0; i + 1 < fl.length; i++) {
      const a = fl[i], c = fl[i + 1];
      if (c === a - 1) {
        if (b.get(x0 + i, c) === '.' && isRock(b.get(x0 + i, a)) && isRock(b.get(x0 + i + 1, c))) b.set(x0 + i, c, '/');
      } else if (c === a + 1) {
        if (b.get(x0 + i + 1, a) === '.' && isRock(b.get(x0 + i + 1, c)) && isRock(b.get(x0 + i, a))) b.set(x0 + i + 1, a, '\\');
      }
    }
  }
  /* carve(b, x0, x1, top, bot, o): open the space between two piecewise-linear
   * profiles ([[x, row], ...], inclusive rows). o.jag / o.per roughen the
   * ceiling, o.fjag / o.fper the floor; one-tile floor steps become slopes. */
  function carve(b, x0, x1, top, bot, o) {
    o = o || {};
    const n = x1 - x0 + 1;
    const seed = o.seed || x0 * 7919 + x1 * 104729 + top[0][1] * 31 + 17;
    const nt = o.jag ? noise(seed, n, o.per || 3, o.jag) : null;
    const nb = o.fjag ? noise(seed + 1, n, o.fper || 4, o.fjag) : null;
    const fl = [];
    for (let i = 0; i < n; i++) {
      const x = x0 + i;
      const t = Math.round(lerpPts(top, x)) + (nt ? nt[i] : 0);
      const bt = Math.round(lerpPts(bot, x)) - (nb ? nb[i] : 0);
      fl.push(bt + 1);
      if (bt >= t) b.clear(x, t, x, bt);
    }
    if (o.slopes !== false) slopeFloor(b, x0, fl);
  }
  // natural rock shelf: flat top at row y, a rough underside up to `thick` tiles,
  // thinning towards its free ends (o.l / o.r = false when an end meets a wall)
  function shelf(b, x0, x1, y, thick, o) {
    o = o || {};
    const n = x1 - x0 + 1;
    const nz = noise(o.seed || x0 * 31 + y * 977 + x1, n, 3, Math.max(0, thick - 1));
    for (let i = 0; i < n; i++) {
      const e = Math.min(o.l === false ? 99 : i, o.r === false ? 99 : n - 1 - i);
      const d = Math.max(1, Math.min(1 + nz[i], 1 + e));
      b.fill(x0 + i, y, x0 + i, y + d - 1, o.ch);
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

  // fill the open tiles below row ySurf with water (stops at the first non-empty tile)
  function flood(b, x0, x1, ySurf) {
    for (let x = x0; x <= x1; x++)
      for (let y = ySurf; y < b.th && b.get(x, y) === '.'; y++) b.set(x, y, '~');
  }

  // ---------------------------------------------------------- painting
  // onEnter hook that paints extra scenery on the room's background canvas
  // (after the theme back wall/decor) and may add static lights.
  function paint(fn) {
    return function (g, room) {
      const cv = room.bgCanvas, c = cv && G.gfx && G.gfx.ctxOf(cv);
      if (!c) return;
      const th = room.theme || G.themes[room.area.theme];
      const rng = U.RNG(room.id + ':paint');
      c.save();
      try {
        fn(c, room, th, rng, room.lightsStatic);
      } catch (e) {
        if (root.console) console.warn('[rooms_castle_b] ' + room.id + ': ' + e.message);
      }
      c.restore();
    };
  }
  const solidT = (t) => t === T.SOLID || t === T.BREAK || t === T.SEAL || t === T.SPIKES;
  const openT = (t) => t === T.EMPTY || t === T.WATER;
  function rect(c, x, y, w, h, col) {
    c.fillStyle = col;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function tri(c, pts, col) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
    c.fill();
  }
  // stalactites under rock ceilings, stalagmites and crystals on floors
  function caveDetail(c, room, th, rng, L, o) {
    o = Object.assign({ stal: 0.3, mite: 0.12, crys: 0.06, crysCol: ['#4ac0d0', '#9af0ff'] }, o || {});
    const base = th.c.wall, lit = U.shade(th.c.base, -0.25), hi = U.shade(th.c.base, 0.05);
    let lastLight = -99;
    for (let ty = 1; ty < room.th - 1; ty++)
      for (let tx = 1; tx < room.tw - 1; tx++) {
        const t = room.get(tx, ty);
        if (!solidT(t)) continue;
        if (openT(room.get(tx, ty + 1)) && rng.chance(o.stal)) {
          let room2 = 0;
          while (room2 < 3 && openT(room.get(tx, ty + 1 + room2))) room2++;
          const len = rng.int(6, 10 + room2 * 7), w = rng.int(4, 9), x = tx * 16 + rng.int(1, 15 - w), y = (ty + 1) * 16;
          tri(c, [x, y, x + w, y, x + w * 0.55, y + len], lit);
          tri(c, [x + 1, y, x + w * 0.4, y, x + w * 0.5, y + len * 0.8], hi);
          if (rng.chance(0.3)) rect(c, x + w * 0.5, y + len + 3, 1, 2, '#6ab8d8');
        }
        if (openT(room.get(tx, ty - 1)) && openT(room.get(tx, ty - 2))) {
          const x = tx * 16, y = ty * 16;
          if (rng.chance(o.crys) && tx - lastLight > 6) {
            lastLight = tx;
            const c1 = o.crysCol[0], c2 = o.crysCol[1];
            tri(c, [x + 2, y, x + 5, y - 13, x + 8, y], c1);
            tri(c, [x + 6, y, x + 10, y - 19, x + 13, y], c2);
            tri(c, [x + 11, y, x + 14, y - 9, x + 16, y], c1);
            rect(c, x + 9, y - 15, 1, 8, '#ffffff');
            L.push({ x: x + 9, y: y - 8, r: 46, color: c2, i: 0.55 });
          } else if (rng.chance(o.mite)) {
            const w = rng.int(5, 10), h = rng.int(5, 16), xx = x + rng.int(0, 16 - w);
            tri(c, [xx, y, xx + w, y, xx + w * 0.45, y - h], lit);
            tri(c, [xx + 1, y, xx + w * 0.35, y, xx + w * 0.42, y - h * 0.8], hi);
          }
        }
      }
  }

  // ---------------------------------------------------------- scenery props
  // Animated waterfall column (pure decoration, drawn behind the tiles).
  // b.spawn(x, y, {t:'cb_fall', w:2, h:10}) — (x, y) = top-left tile.
  class Cascade extends G.Ent {
    constructor(sp) {
      super({ x: sp.tx * 16, y: sp.ty * 16, w: (sp.w || 2) * 16, h: (sp.h || 8) * 16, sp });
      this.z = -1;
    }
    update(g) {
      this.t++;
      if (this.t % 7 === 0 && this.sp.foam !== false) {
        const cam = g.camx, cy = g.camy;
        if (this.x + this.w > cam && this.x < cam + G.W && this.fy > cy && this.fy - 40 < cy + G.H)
          G.fx.particle(this.x + Math.random() * this.w, this.fy - 4, (Math.random() - 0.5) * 0.8, -0.6 - Math.random() * 0.6, '#cfefff', 26, { grav: 0.04 });
      }
    }
    draw(ctx, camx, camy) {
      const x0 = Math.round(this.x - camx), y0 = Math.round(this.y - camy);
      if (x0 > G.W || x0 + this.w < 0 || y0 > G.H || y0 + this.h < 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, this.w, this.h);
      ctx.clip();
      ctx.fillStyle = 'rgba(46,118,160,0.55)';
      ctx.fillRect(x0, y0, this.w, this.h);
      for (let i = 0; i < this.w; i += 2) {
        const sp = 2.2 + ((i * 7) % 5) * 0.35;
        const off = (this.t * sp + i * 29) % 22;
        ctx.fillStyle = i % 4 ? 'rgba(150,215,245,0.55)' : 'rgba(220,245,255,0.7)';
        for (let y = off - 22; y < this.h; y += 22) ctx.fillRect(x0 + i, y0 + y, 1, 9 + (i % 3) * 2);
      }
      ctx.fillStyle = 'rgba(200,240,255,0.35)';
      ctx.fillRect(x0, y0, 1, this.h);
      ctx.fillRect(x0 + this.w - 1, y0, 1, this.h);
      ctx.restore();
      G.gfx.addLight(x0 + this.w / 2, y0 + this.h - 8, 40, '#7ac8f0', 0.35);
    }
  }
  G.ENT.cb_fall = (sp) => new Cascade(sp);

  // ======================== UNDERGROUND CAVERNS ========================
  // ent_cellar (rooms_castle.js) reaches the Caverns through a 1-tile wolf
  // tunnel: its R0 door needs the wolf (lvl 2) — tell the validator.
  const cellar = G.world.rooms.ent_cellar;
  if (cellar) cellar.gates = Object.assign({ R0: 2 }, cellar.gates || {});

  // C1 — the descent: the cellar's wolf tunnel opens high in a cave shaft that
  // winds down to a drop into the lake (B0) and a passage to the falls (R2).
  R({
    id: 'cav_entry', area: 'caverns', x: 14, y: 20, w: 2, h: 3, lvl: 2, darkness: 0.5,
    decor: ['crystal', 'stalactite'],
    onEnter: paint((c, room, th, rng, L) => caveDetail(c, room, th, rng, L)),
  }, (b) => {
    b.fill(0, 0, b.tw - 1, b.th - 1);
    // the shaft
    carve(b, 7, 46, [[7, 5], [12, 3], [20, 4], [27, 3], [33, 4], [39, 6], [40, 14], [46, 15]], [[7, 39], [46, 39]], { jag: 2, per: 3 });
    carve(b, 1, 6, [[1, 14], [6, 12]], [[1, 39], [6, 39]], { jag: 1 });
    // the cellar tunnel: only row 11 is open at the left edge (wolf)
    b.clear(0, 11, 6, 11);
    // T: the shelf the wolf comes out on, sloping down to the right
    b.fill(0, 12, 15, 14);
    rise(b, 15, 16, '54321');
    b.fill(15, 12, 15, 16);
    shelf(b, 16, 21, 16, 2, { l: false });
    hang(b, 1, 15, '1122332211');
    // A, middle shelf
    shelf(b, 18, 28, 21, 3);
    // E and the lip under the high niche
    shelf(b, 31, 37, 17, 2);
    shelf(b, 36, 40, 13, 2, { r: false });
    b.clear(41, 8, 45, 11);
    b.fill(40, 8, 40, 11, 'B'); // cracked rock hides the niche
    // B, right shelf on the wall
    shelf(b, 29, 46, 26, 3, { r: false });
    // C, left shelf on the wall
    shelf(b, 1, 26, 31, 3, { l: false });
    // rough side walls, a stalactite column under T
    side(b, 'L', 16, '112233322111112222333221');
    side(b, 'R', 14, '22334443322111122233');
    hang(b, 6, 15, '2356886532');
    // the cave floor: a mound on the right, the drop into the lake on the left
    rise(b, 27, 39, '1234444444321');
    rise(b, 1, 39, '21100');
    b.door('B', 0);
    well(b, 0);
    b.door('R', 2);
    // ---- entities
    b.candle(10, 8);
    b.candle(22, 17);
    b.candle(43, 22);
    b.candle(6, 27);
    b.candle(33, 32);
    b.candle(42, 36, 'heart_big');
    b.item(43, 11, 'hp_up');
    b.enemy(26, 8, 'crystal_crawler');
    b.enemy(22, 25, 'crystal_crawler');
  });
  // C2 — the underground lake: a long cavern of black water, rock islands and a
  // moonlit grotto at its western end. Arrival from the descent above (T4).
  R({
    id: 'cav_lake', area: 'caverns', x: 10, y: 23, w: 6, h: 2, lvl: 2, entry: 'T4', darkness: 0.52,
    decor: ['stalactite', 'crystal', 'stalactite'],
    onEnter: paint((c, room, th, rng, L) => {
      caveDetail(c, room, th, rng, L, { crys: 0.05 });
      // moonlight falling through a crack onto the grotto
      const g = c.createLinearGradient(0, 32, 0, 18 * 16);
      g.addColorStop(0, 'rgba(190,210,255,0.28)');
      g.addColorStop(1, 'rgba(190,210,255,0.04)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(9 * 16, 32);
      c.lineTo(11 * 16, 32);
      c.lineTo(14 * 16, 18 * 16);
      c.lineTo(7 * 16, 18 * 16);
      c.closePath();
      c.fill();
      L.push({ x: 10 * 16, y: 16 * 16, r: 80, color: '#b8c8ff', i: 0.8 });
      // pale reflections on the lake
      for (let i = 0; i < 40; i++) rect(c, rng.int(24 * 16, 92 * 16), 21 * 16 + rng.int(2, 60), rng.int(6, 22), 1, 'rgba(150,200,230,0.18)');
    }),
  }, (b) => {
    b.fill(0, 0, b.tw - 1, b.th - 1);
    // the cavern
    carve(b, 1, 142, [[1, 9], [8, 6], [14, 4], [24, 3], [40, 5], [52, 3], [64, 2], [78, 4], [92, 3], [102, 5], [114, 4], [122, 9], [132, 12], [142, 15]], [[1, 25], [142, 25]], { jag: 2, per: 3 });
    // crack above the grotto (moonlight) and the shaft under the T4 hole
    b.clear(9, 2, 10, 6);
    b.door('T', 4);
    b.clear(104, 2, 113, 7);
    // lake bed, islands and shores (heights above the bottom row)
    rise(b, 1, 25, '8888888888888888888' + '87654321' + '1122111' + '24688742' + '111211111112' + '369aaa963' + '11122111' + '257752' + '11212112');
    rise(b, 86, 25, '23456777777777777777' + '7654321');
    // arrival ledge under the hole and the rocky steps down to the east exit
    shelf(b, 99, 114, 8, 4);
    shelf(b, 111, 113, 5, 1, { r: false });
    shelf(b, 114, 120, 12, 3);
    shelf(b, 121, 128, 16, 3);
    shelf(b, 130, 138, 21, 2);
    // a ledge above the great island
    b.plat(55, 61, 10);
    hang(b, 54, 3, '1233443210');
    // stalactite pillars over the water
    hang(b, 44, 3, '2468642');
    hang(b, 80, 4, '136631');
    // the water
    flood(b, 20, 94, 21);
    b.door('R', 1);
    // ---- entities
    b.spawn(66, 4, { t: 'cb_fall', w: 2, h: 17 });
    b.item(11, 17, 'moonlit_blade');
    b.item(58, 9, 'blood_signet');
    b.candle(5, 13);
    b.candle(17, 13);
    b.candle(39, 14);
    b.candle(74, 15);
    b.candle(97, 14);
    b.candle(103, 4, 'heart_big');
    b.candle(124, 12);
    b.candle(136, 22);
    b.enemy(49, 24, 'drowned_one');
    b.enemy(84, 24, 'drowned_one');
    b.enemy(96, 18, 'cave_toad');
  });
})();
