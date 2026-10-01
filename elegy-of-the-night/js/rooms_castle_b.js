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
  // like hang(), but each column also grows upward until it meets rock, so the
  // formation is always attached to the ceiling / shelf above it
  function drip(b, x0, y0, prof) {
    for (let i = 0; i < prof.length; i++) {
      const d = depth(prof[i]);
      if (d <= 0) continue;
      b.fill(x0 + i, y0, x0 + i, y0 + d - 1);
      for (let y = y0 - 1; y > 0 && b.get(x0 + i, y) === '.'; y--) b.set(x0 + i, y, '#');
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

  // an enemy that starts under water (its own tile stays water)
  function swimmer(b, x, y, id) {
    return b.spawn(x, y, { t: 'enemy', id, swim: 1 }, '~');
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
    // push the back wall into the distance so the rock masses read as solid
    c.fillStyle = 'rgba(2,6,12,' + (o.dim == null ? 0.38 : o.dim) + ')';
    c.fillRect(0, 0, room.pw, room.ph);
    const lit = U.shade(th.c.base, -0.25), hi = U.shade(th.c.base, 0.05);
    const glows = []; // crystal clusters placed so far (kept apart: one light each)
    const farFromGlows = (tx, ty) => glows.every(([gx, gy]) => Math.abs(gx - tx) + Math.abs(gy - ty) > 8);
    for (let ty = 1; ty < room.th - 1; ty++)
      for (let tx = 1; tx < room.tw - 1; tx++) {
        const t = room.get(tx, ty);
        if (!solidT(t)) continue;
        if (openT(room.get(tx, ty + 1)) && rng.chance(o.stal)) {
          let gap = 0;
          while (gap < 3 && openT(room.get(tx, ty + 1 + gap))) gap++;
          const len = rng.int(6, 10 + gap * 7), w = rng.int(4, 9), x = tx * 16 + rng.int(1, 15 - w), y = (ty + 1) * 16;
          tri(c, [x, y, x + w, y, x + w * 0.55, y + len], lit);
          tri(c, [x + 1, y, x + w * 0.4, y, x + w * 0.5, y + len * 0.8], hi);
          if (rng.chance(0.3)) rect(c, x + w * 0.5, y + len + 3, 1, 2, '#6ab8d8');
        }
        if (openT(room.get(tx, ty - 1)) && openT(room.get(tx, ty - 2))) {
          const x = tx * 16, y = ty * 16;
          if (rng.chance(o.crys) && farFromGlows(tx, ty)) {
            glows.push([tx, ty]);
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

  // a big crystal cluster growing up (s = 1) from a floor or down (s = -1) from a ceiling
  function crystals(c, x, y, s, rng, cols) {
    for (let i = 0; i < 6; i++) {
      const w = rng.int(4, 8), h = rng.int(10, 30) * (i === 2 || i === 3 ? 1.3 : 1), dx = (i - 2.5) * 5 + rng.int(-2, 2);
      const lean = (i - 2.5) * 1.6;
      const col = cols[i % cols.length];
      tri(c, [x + dx, y, x + dx + w, y, x + dx + w / 2 + lean, y - h * s], col);
      tri(c, [x + dx + 1, y, x + dx + w / 2, y, x + dx + w / 2 + lean, y - h * s * 0.9], U.shade(col, 0.35));
    }
  }

  // a small roosting bat silhouette (hanging upside down) or flying
  function bat(c, x, y, rng) {
    const col = 'rgba(10,6,14,0.85)';
    if (rng.chance(0.5)) {
      rect(c, x + 2, y, 1, 2, col);
      tri(c, [x, y + 2, x + 5, y + 2, x + 2.5, y + 9], col);
    } else {
      tri(c, [x - 6, y, x, y + 2, x - 3, y + 4], col);
      tri(c, [x + 6, y, x, y + 2, x + 3, y + 4], col);
      rect(c, x - 1, y + 1, 2, 3, col);
    }
  }

  function skullArt(c, x, y, col, dark) {
    rect(c, x + 1, y, 4, 1, col);
    rect(c, x, y + 1, 6, 3, col);
    rect(c, x + 1, y + 4, 4, 1, col);
    rect(c, x + 1, y + 2, 1, 1, dark);
    rect(c, x + 4, y + 2, 1, 1, dark);
    rect(c, x + 2, y + 5, 2, 1, col);
  }
  // a burial niche cut in the wall: arched recess with a skull, bones or an urn
  function niche(c, x, y, w, h, rng, th) {
    const bone = th.c.accent, dark = '#080605';
    rect(c, x - 1, y - 1, w + 2, h + 2, U.shade(th.c.wall, 0.18));
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(x, y + h);
    c.lineTo(x, y + w / 2);
    c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    c.lineTo(x + w, y + h);
    c.closePath();
    c.fill();
    const k = rng.int(0, 3);
    if (k === 0) skullArt(c, x + w / 2 - 3, y + h - 7, U.shade(bone, -0.15), dark);
    else if (k === 1) {
      skullArt(c, x + 2, y + h - 7, U.shade(bone, -0.25), dark);
      skullArt(c, x + w - 8, y + h - 7, U.shade(bone, -0.3), dark);
    } else if (k === 2) {
      rect(c, x + 2, y + h - 3, w - 4, 2, U.shade(bone, -0.3));
      rect(c, x + 3, y + h - 5, w - 7, 2, U.shade(bone, -0.2));
    } else {
      rect(c, x + w / 2 - 3, y + h - 9, 6, 9, '#5a4a3a');
      rect(c, x + w / 2 - 2, y + h - 10, 4, 1, '#7a6a52');
    }
  }
  function cobweb(c, x, y, sx, sy) {
    c.strokeStyle = 'rgba(210,205,190,0.32)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 3) * (Math.PI / 2);
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * 22 * sx, y + Math.sin(a) * 22 * sy);
    }
    for (let r = 7; r <= 21; r += 7) {
      c.moveTo(x + r * sx, y);
      for (let i = 1; i <= 3; i++) {
        const a = (i / 3) * (Math.PI / 2);
        c.lineTo(x + Math.cos(a) * r * 0.92 * sx, y + Math.sin(a) * r * 0.92 * sy);
      }
    }
    c.stroke();
  }
  // carved lid and effigy painted over a tile sarcophagus (x = left, y = top of its 2-row block)
  function sarcophagus(c, x, y, th) {
    rect(c, x - 2, y - 3, 84, 3, U.shade(th.c.base, 0.25));
    rect(c, x + 14, y - 7, 52, 4, U.shade(th.c.accent, -0.35));
    rect(c, x + 12, y - 6, 6, 3, U.shade(th.c.accent, -0.2));
    rect(c, x + 36, y - 9, 10, 2, U.shade(th.c.accent, -0.3));
  }
  // catacomb dressing: wall niches above floors, cobwebs in corners, bone litter
  function cryptDetail(c, room, th, rng, L, o) {
    o = Object.assign({ niche: 0.5, web: 0.5, litter: 0.15 }, o || {});
    const op = (x, y) => openT(room.get(x, y));
    let lastN = -9;
    for (let tx = 1; tx < room.tw - 2; tx++)
      for (let ty = 3; ty < room.th - 1; ty++) {
        const t = room.get(tx, ty);
        // floor surface
        if (solidT(t) && op(tx, ty - 1)) {
          if (tx - lastN > 4 && op(tx + 1, ty - 1) && op(tx, ty - 4) && op(tx + 1, ty - 4) && op(tx, ty - 5) && op(tx + 1, ty - 5) && rng.chance(o.niche)) {
            lastN = tx;
            niche(c, tx * 16 + 2, (ty - 5) * 16 + 2, 26, 34, rng, th);
          } else if (rng.chance(o.litter)) {
            if (rng.chance(0.5)) skullArt(c, tx * 16 + rng.int(2, 9), ty * 16 - 6, U.shade(th.c.accent, -0.35), '#120c08');
            else rect(c, tx * 16 + rng.int(1, 6), ty * 16 - 2, rng.int(6, 10), 2, U.shade(th.c.accent, -0.4));
          }
        }
        // corners under a ceiling
        if (op(tx, ty) && solidT(room.get(tx, ty - 1)) && rng.chance(o.web)) {
          if (solidT(room.get(tx - 1, ty))) cobweb(c, tx * 16, ty * 16, 1, 1);
          else if (solidT(room.get(tx + 1, ty))) cobweb(c, tx * 16 + 16, ty * 16, -1, 1);
        }
      }
  }

  // ---------------------------------------------------------- chapel art
  const GLASS = ['#b82838', '#2848b8', '#d8b030', '#2a9850', '#8838b0', '#d86020', '#3070d0'];
  function archPath(c, x, y, w, h) {
    c.beginPath();
    c.moveTo(x, y + h);
    c.lineTo(x, y + w * 0.55);
    c.quadraticCurveTo(x, y + w * 0.05, x + w / 2, y - w * 0.18);
    c.quadraticCurveTo(x + w, y + w * 0.05, x + w, y + w * 0.55);
    c.lineTo(x + w, y + h);
    c.closePath();
  }
  // tall stained-glass lancet: leaded panes around a haloed figure
  function lancet(c, x, y, w, h, rng, L, o) {
    o = o || {};
    const frame = o.frame || '#5a564e';
    c.save();
    archPath(c, x - 3, y - 2, w + 6, h + 5);
    c.fillStyle = frame;
    c.fill();
    archPath(c, x, y, w, h);
    c.clip();
    const bg = o.bg || '#1c2c6a';
    for (let yy = y - w; yy < y + h; yy += 6)
      for (let xx = x; xx < x + w; xx += 5) {
        let col = rng.chance(0.75) ? U.shade(bg, (rng.next() - 0.5) * 0.3) : rng.pick(GLASS);
        const cx = xx - (x + w / 2), cy = yy - (y + h * 0.42);
        if (Math.abs(cx) < w * 0.16 && cy > -h * 0.12 && cy < h * 0.3) col = rng.pick(['#e8d8a8', '#d8b860', '#f0e8c8']);
        if (cx * cx + (cy + h * 0.2) * (cy + h * 0.2) < (w * 0.22) * (w * 0.22)) col = rng.pick(['#f0c840', '#ffe070']);
        if (yy > y + h * 0.78) col = rng.pick(['#b82838', '#8a1a28', '#d84030']);
        rect(c, xx, yy, 5, 6, col);
      }
    c.fillStyle = 'rgba(10,8,14,0.85)';
    for (let yy = y - w; yy < y + h; yy += 6) c.fillRect(x, yy, w, 1);
    for (let xx = x; xx < x + w; xx += 5) c.fillRect(xx, y - w, 1, h + w);
    c.fillRect(x + Math.floor(w / 2), y - w, 2, h + w);
    c.restore();
    c.strokeStyle = U.shade(frame, 0.25);
    c.lineWidth = 1;
    archPath(c, x - 1, y - 1, w + 2, h + 2);
    c.stroke();
    rect(c, x - 5, y + h + 2, w + 10, 4, U.shade(frame, 0.15));
    L.push({ x: x + w / 2, y: y + h * 0.45, r: Math.max(60, h * 0.9), color: o.glow || '#ffd0a0', i: 0.55 });
  }
  // a slanted shaft of coloured light falling from a window down to the floor line fy
  function godRay(c, x, y, w, fy, slant, col) {
    const g = c.createLinearGradient(0, y, 0, fy);
    g.addColorStop(0, U.rgba(col || '#ffd8a8', 0.16));
    g.addColorStop(1, U.rgba(col || '#ffd8a8', 0.02));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w + slant, fy);
    c.lineTo(x + slant, fy);
    c.closePath();
    c.fill();
  }
  // round rose window with radial petals
  function rose(c, cx, cy, r, rng, L) {
    c.save();
    c.fillStyle = '#5a564e';
    c.beginPath();
    c.arc(cx, cy, r + 4, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.clip();
    for (let yy = cy - r; yy < cy + r; yy += 4)
      for (let xx = cx - r; xx < cx + r; xx += 4) {
        const d = Math.hypot(xx + 2 - cx, yy + 2 - cy) / r, a = Math.atan2(yy + 2 - cy, xx + 2 - cx);
        const petal = Math.cos(a * 8) > 0.2;
        let col = d < 0.22 ? '#f0c840' : d < 0.55 ? (petal ? '#b82838' : '#2848b8') : petal ? '#3070d0' : rng.pick(['#2a9850', '#d8b030', '#1c2c6a']);
        rect(c, xx, yy, 4, 4, U.shade(col, (rng.next() - 0.5) * 0.25));
      }
    c.strokeStyle = 'rgba(10,8,14,0.9)';
    c.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r * 0.22, cy + Math.sin(a) * r * 0.22);
      c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      c.stroke();
    }
    for (const k of [0.22, 0.55, 0.8]) {
      c.beginPath();
      c.arc(cx, cy, r * k, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
    L.push({ x: cx, y: cy, r: r * 2.2, color: '#ffc8a0', i: 0.6 });
  }
  // a row of wooden pews standing on the floor line fy
  function pews(c, x0, x1, fy, step) {
    for (let x = x0; x + 34 <= x1; x += step || 48) {
      rect(c, x, fy - 24, 3, 24, '#4a2a18');
      rect(c, x + 1, fy - 24, 1, 24, '#6a4028');
      rect(c, x, fy - 14, 36, 3, '#5a3420');
      rect(c, x, fy - 14, 36, 1, '#7a4a2a');
      rect(c, x + 33, fy - 14, 3, 14, '#3a2012');
      rect(c, x + 4, fy - 9, 30, 2, '#3a2012');
      rect(c, x - 1, fy - 26, 5, 2, '#6a4028');
    }
  }
  // an altar with a cloth, candlesticks and a cross; (x = centre, fy = floor line)
  function altar(c, x, fy, L, o) {
    o = o || {};
    rect(c, x - 30, fy - 22, 60, 22, '#8a8478');
    rect(c, x - 30, fy - 22, 60, 2, '#c8c2b4');
    rect(c, x - 32, fy - 24, 64, 4, '#e8e0d0');
    rect(c, x - 10, fy - 24, 20, 20, '#8a1424');
    rect(c, x - 8, fy - 22, 16, 1, '#d8b030');
    rect(c, x - 1, fy - 20, 2, 12, '#d8b030');
    rect(c, x - 5, fy - 16, 10, 2, '#d8b030');
    for (const dx of [-24, 24]) {
      rect(c, x + dx - 1, fy - 40, 2, 16, '#c9a24a');
      rect(c, x + dx - 3, fy - 26, 6, 2, '#c9a24a');
      rect(c, x + dx - 1, fy - 46, 2, 6, '#f0e8d0');
      rect(c, x + dx - 1, fy - 49, 2, 3, '#ffcc55');
      L.push({ x: x + dx, y: fy - 48, r: 50, color: '#ffb850', i: 0.8, flicker: true });
    }
    if (o.cross !== false) {
      const ch = o.crossH || 64, cy = fy - 50 - ch;
      rect(c, x - 3, cy, 6, ch, '#c9a24a');
      rect(c, x - 16, cy + 14, 32, 6, '#c9a24a');
      rect(c, x - 2, cy + 1, 2, ch - 2, '#f0d878');
      rect(c, x - 15, cy + 15, 30, 2, '#f0d878');
      L.push({ x, y: cy + 20, r: 70, color: '#ffe0a0', i: 0.5 });
    }
  }
  // stone column from y0 down to the floor line fy
  function column(c, x, y0, fy, th) {
    const base = th.c.base;
    rect(c, x, y0 + 8, 14, fy - y0 - 14, U.shade(base, -0.28));
    rect(c, x + 2, y0 + 8, 3, fy - y0 - 14, U.shade(base, -0.12));
    rect(c, x + 10, y0 + 8, 2, fy - y0 - 14, U.shade(base, -0.45));
    rect(c, x - 3, y0, 20, 8, U.shade(base, -0.18));
    rect(c, x - 3, y0, 20, 2, U.shade(base, 0.05));
    rect(c, x - 4, fy - 6, 22, 6, U.shade(base, -0.2));
  }
  // golden pipe organ standing on fy
  function organ(c, x, fy, w, h) {
    rect(c, x, fy - 30, w, 30, '#4a2a18');
    rect(c, x + 2, fy - 28, w - 4, 2, '#7a4a2a');
    const n = Math.floor(w / 7);
    for (let i = 0; i < n; i++) {
      const ph = h * (0.55 + 0.45 * Math.sin((i / (n - 1)) * Math.PI)) - 30;
      rect(c, x + 2 + i * 7, fy - 30 - ph, 5, ph, i % 2 ? '#b8a060' : '#d8c080');
      rect(c, x + 3 + i * 7, fy - 30 - ph, 1, ph, '#f0e0a8');
      rect(c, x + 2 + i * 7, fy - 30 - ph * 0.3, 5, 2, '#2a2010');
    }
  }
  function chandelier(c, x, y, top, L) {
    rect(c, x - 1, top, 2, y - top, '#3a3a3a');
    rect(c, x - 18, y, 36, 3, '#c9a24a');
    rect(c, x - 12, y + 3, 24, 2, '#8a6a2a');
    for (let i = 0; i < 5; i++) {
      rect(c, x - 17 + i * 8, y - 5, 2, 5, '#f0e8d0');
      rect(c, x - 17 + i * 8, y - 8, 2, 3, '#ffd060');
    }
    L.push({ x, y: y - 6, r: 90, color: '#ffc860', i: 0.85, flicker: true });
  }
  function banner(c, x, y, h) {
    rect(c, x - 2, y, 24, 3, '#c9a24a');
    rect(c, x, y + 3, 20, h, '#6a0e18');
    rect(c, x + 2, y + 3, 2, h, '#8a1a26');
    tri(c, [x, y + 3 + h, x + 10, y + 11 + h, x + 20, y + 3 + h], '#6a0e18');
    rect(c, x + 9, y + 12, 2, 18, '#d8b030');
    rect(c, x + 4, y + 17, 12, 2, '#d8b030');
  }
  // timber posts and braces under a plank platform, down to whatever is below
  function scaffold(c, room, x0, x1, y) {
    for (const [px, dir] of [[x0 * 16 + 2, 1], [(x1 + 1) * 16 - 6, -1]]) {
      let ty = y + 1;
      while (ty < room.th && openT(room.get(Math.floor((px + 2) / 16), ty)) && ty - y < 12) ty++;
      const bottom = ty * 16;
      rect(c, px, (y + 1) * 16 - 2, 4, bottom - (y + 1) * 16 + 2, '#4a2a18');
      rect(c, px, (y + 1) * 16 - 2, 1, bottom - (y + 1) * 16 + 2, '#6a4028');
      c.strokeStyle = '#3a2012';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(px + 2, (y + 1) * 16 + 30);
      c.lineTo(px + 2 + dir * 28, (y + 1) * 16);
      c.stroke();
    }
  }
  // stone brackets under a ledge
  function corbels(c, x0, x1, y, th) {
    const col = U.shade(th.c.base, -0.3), hi = U.shade(th.c.base, -0.1);
    for (let x = x0 * 16 + 12; x < (x1 + 1) * 16 - 12; x += 64) {
      tri(c, [x, (y + 2) * 16, x + 12, (y + 2) * 16, x + 6, (y + 2) * 16 + 14], col);
      rect(c, x + 1, (y + 2) * 16, 10, 2, hi);
    }
  }
  // cut an arched opening in the back wall (shows the far night sky)
  function skyArch(c, x, y, w, h, th) {
    c.save();
    c.globalCompositeOperation = 'destination-out';
    archPath(c, x, y, w, h);
    c.fill();
    c.restore();
    c.strokeStyle = th.c.dark;
    c.lineWidth = 3;
    archPath(c, x, y, w, h);
    c.stroke();
    rect(c, x - 4, y + h, w + 8, 5, th.c.light);
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

  // A swinging church bell (decoration behind the tiles).
  // b.spawn(x, y, {t:'cb_bell', s:1}) — (x, y) = the tile the bell hangs from.
  class Bell extends G.Ent {
    constructor(sp) {
      super({ x: sp.tx * 16 + 8, y: sp.ty * 16, w: 2, h: 2, sp });
      this.z = -1;
      this.s = sp.s || 1;
      this.ph = sp.ph || 0;
    }
    draw(ctx, camx, camy) {
      const s = this.s, W = Math.round(40 * s), H = Math.round(44 * s);
      const x = Math.round(this.x - camx), y = Math.round(this.y - camy);
      if (x + W < 0 || x - W > G.W || y > G.H || y + H + 20 < 0) return;
      const img = G.gfx.sprite('cb_bell' + s, W + 8, H + 10, (c) => {
        const cx = (W + 8) / 2;
        rect(c, cx - 3, 0, 6, 6, '#3a2a1a');
        c.fillStyle = '#8a5a24';
        c.beginPath();
        c.moveTo(cx - W * 0.22, 6);
        c.quadraticCurveTo(cx - W * 0.3, H * 0.55, cx - W / 2, H);
        c.lineTo(cx + W / 2, H);
        c.quadraticCurveTo(cx + W * 0.3, H * 0.55, cx + W * 0.22, 6);
        c.closePath();
        c.fill();
        c.fillStyle = '#b07a34';
        c.beginPath();
        c.moveTo(cx - W * 0.14, 8);
        c.quadraticCurveTo(cx - W * 0.2, H * 0.55, cx - W * 0.34, H - 2);
        c.lineTo(cx - W * 0.2, H - 2);
        c.quadraticCurveTo(cx - W * 0.08, H * 0.5, cx - W * 0.04, 8);
        c.closePath();
        c.fill();
        rect(c, cx - W / 2 - 1, H - 3, W + 2, 4, '#6a4418');
        rect(c, cx - W * 0.3, H * 0.4, W * 0.6, 2, '#d8a050');
        rect(c, cx - 2, H, 4, 6, '#4a3418');
        rect(c, cx - 3, H + 5, 6, 4, '#4a3418');
      }, { outline: '#120a06', threshold: 90 });
      const a = Math.sin((G.game ? G.game.frame : this.t) * 0.02 + this.ph) * 0.1;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.drawImage(img, -Math.round((W + 8) / 2), 0);
      ctx.restore();
    }
  }
  G.ENT.cb_bell = (sp) => new Bell(sp);

  // =========================== ROYAL CHAPEL ===========================
  // R1 — the narthex: a tall stairwell climbing from the Marble Gallery's seal
  // (B0) past switchback stairs to the nave (L0) and the bell tower (T0).
  R({
    id: 'cha_entry', area: 'chapel', x: 14, y: 12, w: 2, h: 3, lvl: 4, entry: 'B0', noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      rose(c, 26 * 16, 6 * 16, 52, rng, L);
      lancet(c, 4 * 16, 18 * 16, 56, 150, rng, L);
      godRay(c, 4 * 16 + 6, 18 * 16 + 90, 44, 40 * 16, 90);
      lancet(c, 38 * 16, 9 * 16, 56, 120, rng, L, { bg: '#5a1830' });
      godRay(c, 38 * 16 + 6, 9 * 16 + 80, 44, 34 * 16, -80, '#ffc0c8');
      column(c, 23 * 16, 2 * 16, 22 * 16, th);
      column(c, 32 * 16, 2 * 16, 22 * 16, th);
      banner(c, 27 * 16, 13 * 16, 70);
      chandelier(c, 27 * 16, 30 * 16, 22 * 16 + 32, L);
      altar(c, 41 * 16, 34 * 16, L, { crossH: 40 });
    }),
  }, (b) => {
    b.shell();
    b.door('B', 0);
    well(b, 0);
    b.door('L', 0);
    b.door('T', 0);
    // balcony to the nave and the step under the trapdoor to the tower
    b.fill(1, 12, 11, 13);
    b.plat(9, 14, 8);
    // switchback stairs: ground -> east landing -> middle landing -> balcony
    b.stairs(30, 39, 6, 'r');
    for (let i = 1; i < 6; i++) b.fill(30 + i, 40 - i, 30 + i, 39);
    b.fill(36, 34, 46, 39);
    b.stairs(45, 33, 12, 'l');
    b.fill(22, 22, 33, 23);
    b.stairs(21, 21, 10, 'l');
    // a cracked stone by the well hides an offering
    b.fill(1, 36, 2, 39, 'B');
    b.hidden(1, 38, 'blood_orange');
    // ---- entities
    b.candle(5, 9);
    b.candle(16, 5);
    b.candle(25, 18);
    b.candle(30, 18);
    b.candle(44, 22);
    b.candle(38, 30);
    b.candle(22, 36, 'heart_big');
    b.candle(8, 33);
    b.enemy(40, 16, 'choir_ghost');
    b.enemy(14, 28, 'choir_ghost');
  });

  // R2 — the nave: pews under tall windows, an organ loft to the west and a
  // triforium gallery to the east, joined to the floor by a long stair.
  R({
    id: 'cha_nave', area: 'chapel', x: 10, y: 12, w: 4, h: 2, lvl: 4, entry: 'R0', noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      for (const x of [18, 30, 42, 54]) {
        lancet(c, x * 16, 3 * 16, 48, 104, rng, L, { bg: x % 24 ? '#1c2c6a' : '#5a1830' });
        godRay(c, x * 16 + 4, 3 * 16 + 60, 40, 26 * 16, 70);
      }
      for (const x of [26, 38, 50]) column(c, x * 16, 2 * 16, 26 * 16, th);
      organ(c, 2 * 16, 12 * 16, 11 * 16, 130);
      pews(c, 16 * 16, 56 * 16, 26 * 16);
      altar(c, 86 * 16, 26 * 16, L, { crossH: 50 });
      lancet(c, 80 * 16, 3 * 16, 40, 96, rng, L, { bg: '#2a1c5a' });
      for (const x of [62, 74, 92]) banner(c, x * 16, 15 * 16, 50);
      chandelier(c, 36 * 16, 8 * 16, 32, L);
      chandelier(c, 48 * 16, 9 * 16, 32, L);
    }),
  }, (b) => {
    b.shell();
    b.door('R', 0);
    b.door('L', 1);
    // triforium gallery and the long stair down to the nave floor
    b.fill(70, 12, 94, 13);
    b.stairs(57, 24, 13, 'r');
    // the organ loft and the hanging steps up to it
    b.fill(1, 12, 13, 13);
    b.plat(15, 19, 16);
    b.plat(21, 25, 21);
    // a loose panel behind the organ
    b.fill(1, 9, 2, 11, 'B');
    b.hidden(1, 10, 'hp_up');
    // ---- entities
    b.item(7, 11, 'silver_plate');
    b.candle(10, 8);
    b.candle(24, 17);
    b.candle(28, 22);
    b.candle(44, 22);
    b.candle(64, 15);
    b.candle(76, 8);
    b.candle(88, 8);
    b.candle(76, 22, 'heart_big');
    b.candle(92, 22);
    b.enemy(40, 25, 'templar');
    b.enemy(32, 9, 'choir_ghost');
    b.enemy(78, 19, 'choir_ghost');
  });

  // R3 — the confessional, where the hunters' crimson shield was left in penance.
  R({
    id: 'cha_confess', area: 'chapel', x: 9, y: 13, w: 1, h: 1, lvl: 4, darkness: 0.25, noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      // the booth
      const x = 2 * 16, fy = 12 * 16;
      rect(c, x, fy - 112, 108, 112, '#3a2012');
      rect(c, x + 4, fy - 106, 100, 102, '#5a3420');
      rect(c, x - 4, fy - 118, 116, 8, '#6a4028');
      for (const dx of [8, 40, 72]) {
        rect(c, x + dx, fy - 98, 28, 90, '#2a160c');
        rect(c, x + dx + 2, fy - 96, 24, 2, '#7a4a2a');
      }
      rect(c, x + 48, fy - 86, 12, 14, '#1a0e08');
      for (let i = 0; i < 4; i++) rect(c, x + 49 + i * 3, fy - 86, 1, 14, '#c9a24a');
      rect(c, x + 8, fy - 98, 28, 70, '#6a0e18');
      rect(c, x + 72, fy - 98, 28, 70, '#6a0e18');
      rect(c, x + 50, fy - 128, 8, 10, '#c9a24a');
      lancet(c, 17 * 16, 3 * 16, 32, 64, rng, L, { bg: '#3a1c4a' });
    }),
  }, (b) => {
    b.shell();
    b.door('R', 0);
    b.item(5, 11, 'crimson_shield');
    b.lore(14, 11, 'cas_chapel');
    b.candle(11, 7);
    b.candle(20, 8);
  });

  // R4 — the bell tower: a six-storey climb of stone landings and timber
  // scaffolds, doors to the altar (L1) and the save chapel (R3), the belfry above.
  const TOWER_STONE = [[26, 46, 77], [24, 46, 67], [30, 46, 54], [1, 27, 49], [1, 22, 39], [26, 46, 34], [1, 14, 26], [1, 18, 16]];
  const TOWER_WOOD = [[6, 22, 72], [4, 20, 62], [22, 28, 58], [26, 42, 44], [17, 24, 30], [17, 30, 21], [20, 30, 12], [6, 17, 7]];
  R({
    id: 'cha_tower', area: 'chapel', x: 14, y: 6, w: 2, h: 6, lvl: 4, entry: 'B0', noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      for (const [x, y, w, h] of [[20, 63, 44, 120], [6, 42, 48, 140], [36, 20, 44, 100], [24, 2, 40, 64], [32, 58, 40, 72]]) lancet(c, x * 16, y * 16, w, h, rng, L, { bg: rng.pick(['#1c2c6a', '#5a1830', '#2a1c5a']) });
      // bell ropes falling from the belfry
      for (const x of [23 * 16 + 4, 25 * 16 + 10]) {
        rect(c, x, 0, 2, 60 * 16, '#6a5030');
        rect(c, x, 0, 1, 60 * 16, '#8a6a40');
      }
      for (const [x0, x1, y] of TOWER_WOOD) scaffold(c, room, x0, x1, y);
      for (const [x0, x1, y] of TOWER_STONE) corbels(c, x0, x1, y, th);
      chandelier(c, 24 * 16, 46 * 16, 39 * 16 + 34, L);
      altar(c, 39 * 16, 54 * 16, L, { crossH: 36 });
    }),
  }, (b) => {
    b.shell();
    b.door('B', 0);
    well(b, 0);
    b.door('L', 1);
    b.door('R', 3);
    b.door('T', 0);
    for (const [x0, x1, y] of TOWER_STONE) b.fill(x0, y, x1, y + 1);
    for (const [x0, x1, y] of TOWER_WOOD) b.plat(x0, x1, y);
    // a reliquary niche high on the east wall
    b.fill(34, 4, 46, 12);
    b.clear(34, 7, 46, 9);
    // ---- entities
    b.item(43, 9, 'mp_up');
    b.candle(10, 78);
    b.candle(36, 73);
    b.candle(12, 67);
    b.candle(33, 62);
    b.candle(24, 55);
    b.candle(42, 50, 'heart_big');
    b.candle(14, 45);
    b.candle(36, 40);
    b.candle(12, 35);
    b.candle(8, 22);
    b.candle(26, 17);
    b.candle(12, 12);
    b.candle(28, 8);
    b.enemy(24, 50, 'choir_ghost');
    b.enemy(32, 26, 'choir_ghost');
    b.enemy(28, 14, 'harpy');
  });

  // R5 — the altar of the Royal Chapel: a raised sanctuary beneath a great rose.
  R({
    id: 'cha_altar', area: 'chapel', x: 10, y: 6, w: 4, h: 2, lvl: 4, noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      rose(c, 10 * 16, 8 * 16, 70, rng, L);
      godRay(c, 10 * 16 - 50, 8 * 16 + 20, 100, 22 * 16, 40, '#ffc8b0');
      for (const x of [26, 40, 54, 68, 82]) {
        lancet(c, x * 16, 3 * 16, 44, 100, rng, L, { bg: x % 28 ? '#1c2c6a' : '#5a1830' });
        godRay(c, x * 16 + 4, 3 * 16 + 60, 36, 12 * 16, 30);
      }
      for (const x of [34, 48, 62, 76]) column(c, x * 16, 14 * 16, 26 * 16, th);
      altar(c, 10 * 16, 22 * 16, L, { cross: false });
      for (const x of [22, 88]) banner(c, x * 16, 15 * 16, 56);
      chandelier(c, 40 * 16, 18 * 16, 14 * 16, L);
      chandelier(c, 70 * 16, 18 * 16, 14 * 16, L);
      pews(c, 30 * 16, 80 * 16, 26 * 16, 56);
    }),
  }, (b) => {
    b.shell();
    b.door('R', 1);
    // the sanctuary dais and its steps
    b.fill(1, 22, 18, 25);
    b.stairs(22, 25, 4, 'l');
    for (let i = 1; i < 4; i++) b.fill(22 - i, 26 - i, 22 - i, 25);
    // a hollow stone behind the altar
    b.fill(1, 17, 2, 21, 'B');
    b.hidden(1, 19, 'roast_fowl');
    // the triforium balcony and its steps
    b.fill(28, 12, 76, 13);
    b.plat(78, 83, 16);
    b.plat(84, 89, 21);
    // ---- entities
    b.relic(10, 21, 'gravity_boots');
    b.item(31, 11, 'chapel_halberd');
    b.candle(5, 18);
    b.candle(16, 18);
    b.candle(28, 21);
    b.candle(46, 21);
    b.candle(62, 21);
    b.candle(80, 22);
    b.candle(40, 8);
    b.candle(56, 8);
    b.candle(72, 8, 'heart_big');
    b.enemy(44, 25, 'templar');
    b.enemy(66, 25, 'templar');
  });

  // R6 — a small side chapel with a save point.
  R({
    id: 'cha_save', area: 'chapel', x: 16, y: 9, w: 1, h: 1, lvl: 4, darkness: 0.05, noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      lancet(c, 9 * 16, 3 * 16, 40, 80, rng, L, { bg: '#5a1830', glow: '#ffb0c0' });
      for (const x of [3, 18]) column(c, x * 16, 2 * 16, 12 * 16, th);
    }),
  }, (b) => {
    b.shell();
    b.door('L', 0);
    b.save(12, 11);
    b.candle(6, 8);
    b.candle(17, 8);
  });

  // R7 — the belfry: great bells swing above open arches. The way on to the
  // Keep is far above, beyond any leap (bat, or the Gravity Boots).
  R({
    id: 'cha_belfry', area: 'chapel', x: 14, y: 3, w: 2, h: 3, lvl: 4, entry: 'B0', gates: { T0: 5 }, darkness: 0.2, noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      room.needsFar = true;
      for (const [x, y] of [[4, 6], [20, 22], [40, 9], [8, 26], [38, 26]]) skyArch(c, x * 16, y * 16, 56, 110, th);
      // timber frame of the bells
      rect(c, 16, 4 * 16, 46 * 16, 10, '#4a2a18');
      rect(c, 16, 4 * 16, 46 * 16, 2, '#6a4028');
      for (const x of [17, 27, 37]) rect(c, x * 16, 4 * 16, 8, 9 * 16, '#3a2012');
    }),
  }, (b) => {
    b.shell();
    b.door('B', 0);
    well(b, 0);
    b.door('T', 0);
    b.plat(20, 32, 35);
    b.plat(5, 17, 30);
    b.plat(21, 35, 25);
    b.plat(7, 19, 20);
    b.fill(38, 30, 46, 31);
    b.fill(45, 27, 46, 29, 'B');
    b.hidden(46, 28, 'mp_up');
    // ---- entities
    b.spawn(32, 4, { t: 'cb_bell', s: 1.6 });
    b.spawn(22, 4, { t: 'cb_bell', s: 1, ph: 1.7 });
    b.spawn(42, 4, { t: 'cb_bell', s: 1.1, ph: 3.1 });
    b.item(12, 19, 'heart_up');
    b.candle(10, 36);
    b.candle(26, 31);
    b.candle(42, 26);
    b.candle(12, 26);
    b.candle(28, 21);
    b.enemy(30, 14, 'night_bat');
    b.enemy(14, 10, 'night_bat');
  });

  // ======================== UNDERGROUND CAVERNS ========================
  // C1 — the descent: the cellar's wolf tunnel opens high in a cave shaft that
  // winds down to a drop into the lake (B0) and a passage to the falls (R2).
  R({
    id: 'cav_entry', area: 'caverns', x: 14, y: 20, w: 2, h: 3, lvl: 2, darkness: 0.5, noDecor: true,
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
    drip(b, 6, 15, '2356886532');
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
    b.enemy(22, 27, 'crystal_crawler');
  });

  // C2 — the underground lake: a long cavern of black water, rock islands and a
  // moonlit grotto at its western end. Arrival from the descent above (T4).
  R({
    id: 'cav_lake', area: 'caverns', x: 10, y: 23, w: 6, h: 2, lvl: 2, entry: 'T4', darkness: 0.52, noDecor: true,
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
    // the grotto's west wall hides a cache
    side(b, 'L', 9, '43322222');
    b.fill(1, 15, 2, 17, 'B');
    b.hidden(1, 17, 'red_wine');
    // crack above the grotto (moonlight) and the shaft under the T4 hole
    b.clear(9, 2, 10, 6);
    b.door('T', 4);
    b.clear(102, 2, 122, 7);
    drip(b, 115, 2, '11211');
    // lake bed, islands and shores (heights above the bottom row)
    rise(b, 1, 25, '8888888888888888888' + '87654321' + '1166111' + '24688742' + '111166111112' + '369aaa963' + '11122111' + '257752' + '11166112');
    rise(b, 86, 25, '23456777777777777777' + '7654321');
    // arrival ledge under the hole and the rocky steps down to the east exit
    shelf(b, 99, 114, 8, 4);
    shelf(b, 111, 113, 5, 1, { r: false });
    shelf(b, 114, 120, 12, 3);
    shelf(b, 121, 128, 16, 3);
    shelf(b, 130, 138, 21, 2);
    // a ledge above the great island
    b.plat(55, 61, 10);
    drip(b, 54, 3, '1233443210');
    // stalactite masses over the water
    drip(b, 27, 3, '0123455554321');
    drip(b, 44, 3, '2468642');
    drip(b, 80, 4, '136631');
    // a moonlit ledge in the grotto
    b.plat(7, 12, 12);
    // the water
    flood(b, 20, 94, 21);
    b.door('R', 1);
    // ---- entities
    b.spawn(66, 4, { t: 'cb_fall', w: 2, h: 17 });
    b.item(11, 17, 'moonlit_blade');
    b.item(10, 11, 'mp_up');
    b.item(58, 9, 'blood_signet');
    b.candle(5, 13);
    b.candle(17, 13);
    b.candle(39, 14);
    b.candle(74, 15);
    b.candle(97, 14);
    b.candle(103, 4, 'heart_big');
    b.candle(124, 12);
    b.candle(136, 22);
    swimmer(b, 51, 24, 'drowned_one');
    swimmer(b, 84, 24, 'drowned_one');
    b.enemy(96, 18, 'cave_toad');
  });

  // C3 — the waterfall chamber: a torrent pours from a crack in the vault into
  // a deep pool; a rock arch crosses in front of it high above.
  R({
    id: 'cav_falls', area: 'caverns', x: 16, y: 22, w: 3, h: 2, lvl: 2, darkness: 0.48, noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      caveDetail(c, room, th, rng, L);
      // wet sheen on the rock behind the falls
      const g = c.createLinearGradient(30 * 16, 0, 40 * 16, 0);
      g.addColorStop(0, 'rgba(90,170,210,0)');
      g.addColorStop(0.5, 'rgba(90,170,210,0.14)');
      g.addColorStop(1, 'rgba(90,170,210,0)');
      c.fillStyle = g;
      c.fillRect(30 * 16, 32, 10 * 16, 21 * 16);
    }),
  }, (b) => {
    b.fill(0, 0, b.tw - 1, b.th - 1);
    carve(b, 1, 70, [[1, 6], [10, 4], [20, 3], [30, 4], [36, 2], [44, 4], [56, 3], [64, 5], [70, 7]], [[1, 25], [70, 25]], { jag: 2 });
    b.clear(33, 1, 36, 3); // the crack the torrent pours from
    b.fill(33, 0, 36, 0);
    // upper level: the door ledge, the arch in front of the falls, the east shelf
    b.door('L', 0);
    shelf(b, 0, 13, 12, 4, { l: false });
    shelf(b, 27, 43, 12, 3);
    drip(b, 28, 4, '1223321000000123321');
    shelf(b, 46, 54, 14, 2);
    shelf(b, 56, 71, 11, 3, { r: false });
    b.clear(64, 6, 69, 10); // alcove
    drip(b, 63, 4, '2111112');
    // climbing ledges on the west side
    shelf(b, 5, 11, 18, 2);
    shelf(b, 15, 22, 15, 2);
    // the pool and its shores
    rise(b, 1, 25, '444444444444444444' + '4321' + '1' + '0000000000000000000000' + '1' + '1234' + '44444444');
    rise(b, 59, 25, '444432100000');
    // a rock under the falls, worn smooth by the torrent
    rise(b, 31, 25, '01233210');
    flood(b, 17, 58, 22);
    // east ledge above the exit
    shelf(b, 60, 71, 17, 2, { r: false });
    b.door('R', 1);
    // a loose rock pile against the west wall
    b.fill(1, 19, 2, 21, 'B');
    b.hidden(1, 20, 'hp_up');
    // ---- entities
    b.spawn(34, 2, { t: 'cb_fall', w: 2, h: 20 });
    b.item(67, 10, 'mana_tonic');
    b.candle(7, 8);
    b.candle(22, 10);
    b.candle(50, 10);
    b.candle(10, 19);
    b.candle(55, 18);
    b.candle(67, 22, 'heart_big');
    b.enemy(40, 6, 'crystal_crawler');
    b.enemy(52, 21, 'cave_toad');
  });

  // C4 — crystal grotto: a low corridor bristling with glowing crystals and a
  // still pool where something waits under the surface.
  R({
    id: 'cav_crystal', area: 'caverns', x: 19, y: 23, w: 3, h: 1, lvl: 2, darkness: 0.5, noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      caveDetail(c, room, th, rng, L, { crys: 0.3, mite: 0.05, crysCol: ['#8a5ad8', '#d0a8ff'] });
      for (const [x, y, s] of [[14, 9, 1], [26, 3, -1], [47, 3, -1], [58, 9, 1], [66, 9, 1]]) {
        crystals(c, x * 16, y * 16, s, rng, ['#5a3a9a', '#8a5ad8', '#d0a8ff']);
        L.push({ x: x * 16 + 8, y: y * 16 + (s > 0 ? -10 : 10), r: 60, color: '#b48cff', i: 0.6 });
      }
    }),
  }, (b) => {
    b.fill(0, 0, b.tw - 1, b.th - 1);
    carve(b, 1, 70, [[1, 4], [20, 2], [36, 3], [52, 2], [70, 4]], [[1, 11], [70, 11]], { jag: 2, per: 2 });
    b.door('L', 0);
    b.door('R', 0);
    // floor: up from the doors onto the grotto, a still pool in the middle
    rise(b, 1, 11, '0000000000012' + '2222222222222' + '0000000000000000000' + '2222222222222' + '222100000000');
    b.clear(27, 12, 45, 12);
    rise(b, 24, 12, '33321' + '00000000000000' + '12333'); // the pool's shelving banks
    flood(b, 27, 45, 10);
    // a crystal-crusted mound under the vessel's alcove
    rise(b, 49, 9, '012210');
    // the vessel's alcove in the vault
    b.clear(53, 1, 57, 3);
    b.fill(53, 0, 57, 0);
    b.plat(53, 57, 4);
    // ---- entities
    b.item(55, 3, 'heart_up');
    b.candle(8, 8);
    b.candle(22, 6);
    b.candle(36, 5);
    b.candle(62, 6);
    swimmer(b, 36, 12, 'drowned_one');
    b.enemy(60, 9, 'cave_toad');
  });

  // C5 — save point and teleporter in a sheltered hollow by a spring.
  R({
    id: 'cav_save', area: 'caverns', x: 22, y: 23, w: 2, h: 1, lvl: 2, darkness: 0.32, noDecor: true,
    onEnter: paint((c, room, th, rng, L) => caveDetail(c, room, th, rng, L, { crys: 0.2, mite: 0.08 })),
  }, (b) => {
    b.fill(0, 0, b.tw - 1, b.th - 1);
    carve(b, 1, 46, [[1, 5], [14, 3], [30, 2], [46, 4]], [[1, 11], [46, 11]], { jag: 1 });
    b.door('L', 0);
    rise(b, 34, 11, '00011100000');
    flood(b, 34, 36, 11);
    flood(b, 40, 45, 11);
    b.save(15, 11);
    b.tp(29, 11);
    b.candle(8, 8);
    b.candle(22, 7);
    b.candle(42, 7);
  });

  // C6 — the deep caves: a great chasm above an underground river. The way on
  // to the relic shrine (R2) is barred by an iron grate only mist can pass.
  R({
    id: 'cav_deep', area: 'caverns', x: 16, y: 24, w: 4, h: 3, lvl: 2, gates: { R2: 3 }, darkness: 0.55, noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      caveDetail(c, room, th, rng, L, { crys: 0.08 });
      crystals(c, 60 * 16, 21 * 16, 1, rng, ['#2a8aa8', '#4ac0d0', '#9af0ff']);
      L.push({ x: 60 * 16, y: 20 * 16, r: 70, color: '#60e0ff', i: 0.7 });
    }),
  }, (b) => {
    b.fill(0, 0, b.tw - 1, b.th - 1);
    carve(b, 1, 94, [[1, 8], [10, 5], [24, 3], [40, 4], [56, 3], [70, 5], [84, 4], [94, 7]], [[1, 39], [94, 39]], { jag: 2 });
    b.door('L', 0);
    b.clear(1, 7, 12, 11);
    shelf(b, 0, 7, 12, 3, { l: false });
    // the west climb (L2 <-> L0)
    shelf(b, 9, 17, 17, 2);
    shelf(b, 21, 25, 15, 2);
    shelf(b, 14, 24, 22, 2);
    shelf(b, 1, 11, 27, 3, { l: false });
    shelf(b, 14, 24, 32, 2);
    b.fill(1, 24, 2, 26, 'B');
    b.hidden(1, 26, 'pheasant');
    // the high bridge and the eastern descent
    shelf(b, 28, 50, 14, 3);
    drip(b, 30, 4, '0122333221000001233210');
    shelf(b, 54, 64, 18, 2);
    shelf(b, 57, 63, 21, 4); // crystal outcrop under it
    shelf(b, 68, 80, 22, 3);
    shelf(b, 84, 94, 27, 3, { r: false });
    shelf(b, 70, 79, 31, 2);
    // ledges up to the crystal alcove
    shelf(b, 66, 71, 13, 2);
    shelf(b, 74, 80, 9, 2);
    // rock hanging under the bridge, broken walls, stalactite clusters
    drip(b, 31, 15, '0123456654321');
    drip(b, 52, 4, '0123321');
    drip(b, 84, 4, '0124421');
    side(b, 'R', 6, '1122333221112233');
    side(b, 'L', 31, '1112222');
    // a crystal alcove high in the vault
    b.clear(72, 2, 77, 4);
    b.fill(72, 0, 77, 1);
    b.plat(72, 77, 5);
    drip(b, 66, 3, '123321');
    // the river bed: banks, channel, the tunnel to the shrine
    rise(b, 1, 39, '0000000' + '123' + '33333333333333333333333' + '321' + '0000000000000000000000000000000000' + '123' + '333333333' + '321' + '000000000');
    flood(b, 34, 72, 37);
    b.fill(86, 26, 94, 35);
    b.door('L', 2);
    b.door('R', 2);
    b.fill(89, 36, 90, 39, 'G');
    // ---- entities
    b.item(74, 4, 'mp_up');
    b.candle(6, 8);
    b.candle(19, 28);
    b.candle(7, 23);
    b.candle(19, 18);
    b.candle(12, 13);
    b.candle(38, 10);
    b.candle(58, 14);
    b.candle(74, 18);
    b.candle(90, 23);
    b.candle(76, 27, 'heart_big');
    b.candle(24, 33);
    b.candle(80, 34);
    b.enemy(40, 8, 'crystal_crawler');
    b.enemy(62, 9, 'crystal_crawler');
    b.enemy(78, 36, 'cave_toad');
    swimmer(b, 52, 39, 'drowned_one');
  });

  // C7 — the shrine of the bat: a quiet hollow, a pedestal under a shaft of moonlight.
  R({
    id: 'cav_bat', area: 'caverns', x: 20, y: 26, w: 2, h: 1, lvl: 3, darkness: 0.45, noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      caveDetail(c, room, th, rng, L, { crys: 0.0, stal: 0.4 });
      const g = c.createLinearGradient(0, 16, 0, 11 * 16);
      g.addColorStop(0, 'rgba(255,190,200,0.3)');
      g.addColorStop(1, 'rgba(255,120,140,0.05)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(30 * 16, 32);
      c.lineTo(33 * 16, 32);
      c.lineTo(36 * 16, 10 * 16);
      c.lineTo(27 * 16, 10 * 16);
      c.closePath();
      c.fill();
      // roosting bats painted on the vault
      for (let i = 0; i < 14; i++) bat(c, rng.int(6, 44) * 16, rng.int(3, 5) * 16 + rng.int(0, 10), rng);
      L.push({ x: 31.5 * 16, y: 8 * 16, r: 90, color: '#ff8090', i: 0.85 });
    }),
  }, (b) => {
    b.fill(0, 0, b.tw - 1, b.th - 1);
    carve(b, 1, 46, [[1, 5], [12, 3], [26, 2], [38, 3], [46, 5]], [[1, 11], [46, 11]], { jag: 1 });
    b.clear(30, 1, 32, 2);
    b.door('L', 0);
    rise(b, 24, 11, '0123333333321');
    b.relic(31, 8, 'soul_bat');
    b.candle(8, 7);
    b.candle(20, 6);
    b.candle(42, 6);
  });

  // C8 — the bottom of the caves: a frozen grotto to the west, and in the floor
  // an iron grate over a shaft that breathes the cold of the catacombs.
  R({
    id: 'cav_bottom', area: 'caverns', x: 12, y: 26, w: 4, h: 2, lvl: 2, gates: { B1: 3 }, darkness: 0.55, noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      caveDetail(c, room, th, rng, L, { crys: 0.05 });
      for (const [x, y, s] of [[3, 23, 1], [12, 23, 1], [8, 4, -1], [16, 5, -1]]) crystals(c, x * 16, y * 16, s, rng, ['#9ad8f0', '#d8f4ff', '#ffffff']);
      L.push({ x: 8 * 16, y: 16 * 16, r: 90, color: '#a8e8ff', i: 0.7 });
      // cold air rising from the grate
      for (let i = 0; i < 12; i++) rect(c, 34 * 16 + rng.int(0, 60), 24 * 16 - rng.int(6, 60), 1, rng.int(4, 12), 'rgba(200,230,255,0.22)');
    }),
  }, (b) => {
    b.fill(0, 0, b.tw - 1, b.th - 1);
    carve(b, 1, 94, [[1, 6], [12, 4], [26, 3], [44, 4], [60, 3], [74, 5], [86, 4], [94, 6]], [[1, 25], [94, 25]], { jag: 2 });
    b.door('R', 0);
    b.clear(83, 7, 94, 11);
    shelf(b, 80, 95, 12, 3, { r: false });
    shelf(b, 66, 76, 16, 2);
    shelf(b, 52, 62, 19, 2);
    drip(b, 58, 3, '0123444321');
    // the frozen grotto and the codex on its ledge
    shelf(b, 4, 12, 17, 2);
    // floor: west grotto, the grate floor, the rough east
    rise(b, 1, 25, '33333333333333333332' + '2222222222222222222222222222222' + '2110000111122211100001222111110000000000000');
    b.door('B', 1);
    b.clear(34, 24, 37, 25);
    b.fill(34, 24, 37, 24, 'G');
    // ice-bound rubble in the grotto
    b.fill(1, 20, 2, 22, 'B');
    b.hidden(1, 21, 'heart_up');
    // ---- entities
    b.item(8, 16, 'frost_codex');
    b.candle(88, 8);
    b.candle(70, 12);
    b.candle(56, 15);
    b.candle(40, 18);
    b.candle(22, 18);
    b.candle(6, 12);
    b.enemy(58, 23, 'cave_toad');
    b.enemy(30, 8, 'crystal_crawler');
  });

  // ============================== CATACOMBS ==============================
  // K1 — the descent: under the grate a shaft of stacked bones drops into the dark.
  R({
    id: 'cat_entry', area: 'catacombs', x: 13, y: 28, w: 2, h: 3, lvl: 3, entry: 'T0', darkness: 0.66,
    decor: ['torch', 'chain'],
    onEnter: paint((c, room, th, rng, L) => cryptDetail(c, room, th, rng, L)),
  }, (b) => {
    b.shell();
    b.door('T', 0);
    // narrow the shaft: thick bone walls
    side(b, 'L', 2, '333333333333333332222222222222222222222');
    side(b, 'R', 2, '8888888777777666666666666666666666');
    // landing under the hole, then alternating bone slabs
    b.fill(4, 8, 19, 9);
    b.fill(22, 13, 38, 14);
    b.fill(3, 18, 18, 19);
    b.fill(21, 23, 38, 24);
    b.fill(2, 28, 17, 29);
    b.fill(2, 25, 2, 27, 'B');
    b.hidden(2, 26, 'heart_up');
    b.fill(19, 33, 30, 34);
    rise(b, 12, 39, '2222', false);
    // corridor to the ossuary
    b.fill(33, 30, 46, 35);
    b.door('R', 2);
    // ---- entities
    b.candle(6, 5);
    b.candle(17, 5);
    b.candle(35, 9);
    b.candle(6, 15);
    b.candle(33, 20);
    b.candle(9, 25);
    b.candle(25, 30, 'heart_big');
    b.candle(12, 36);
    b.candle(40, 37);
    b.enemy(30, 22, 'bone_pillar');
    b.enemy(12, 12, 'corpse_spider');
    b.enemy(26, 27, 'corpse_spider');
  });

  // K2 — the ossuary: a long hall walled with bones, low passages between
  // vaulted chambers. The cleaver rests on the gallery of the great chamber.
  R({
    id: 'cat_ossuary', area: 'catacombs', x: 15, y: 30, w: 5, h: 1, lvl: 3, darkness: 0.66,
    decor: ['torch', 'chain', 'torch'],
    onEnter: paint((c, room, th, rng, L) => cryptDetail(c, room, th, rng, L, { niche: 0.6 })),
  }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    // 1: low entry passage
    b.fill(1, 2, 16, 6);
    hang(b, 17, 2, '43221');
    // 2: first vault, a bone dais
    rise(b, 25, 11, '012222222222210');
    b.plat(36, 42, 6);
    hang(b, 28, 2, '0000011000');
    // 3: the narrow crawl
    b.fill(45, 2, 58, 6);
    rise(b, 45, 11, '11111111111111', false);
    b.set(44, 11, '/');
    b.set(59, 11, '\\');
    // 4: the great chamber and its gallery
    b.plat(60, 64, 8);
    b.fill(66, 6, 86, 7);
    b.fill(87, 2, 92, 7);
    b.fill(87, 3, 88, 5, 'B');
    // 5: exit vault
    hang(b, 93, 2, '3333322100000000000122333');
    rise(b, 100, 11, '0111110');
    // ---- entities
    b.item(76, 5, 'bone_cleaver');
    b.hidden(88, 4, 'heart_up');
    b.candle(8, 9);
    b.candle(22, 7);
    b.candle(39, 4);
    b.candle(52, 8);
    b.candle(64, 7);
    b.candle(71, 4);
    b.candle(82, 4);
    b.candle(80, 9);
    b.candle(97, 8, 'heart_big');
    b.candle(110, 7);
    b.enemy(32, 9, 'bone_pillar');
    b.enemy(76, 11, 'plague_doctor');
    b.enemy(70, 3, 'corpse_spider');
    b.enemy(105, 10, 'bone_pillar');
  });

  // K3 — the crypt: sarcophagi on the floor, a gallery of tombs above. The
  // hunter's mail was laid to rest in the last tomb of the gallery.
  R({
    id: 'cat_crypt', area: 'catacombs', x: 20, y: 29, w: 3, h: 2, lvl: 3, darkness: 0.64,
    decor: ['torch', 'chain'],
    onEnter: paint((c, room, th, rng, L) => {
      cryptDetail(c, room, th, rng, L, { niche: 0.65 });
      for (const x of [14, 30, 46]) sarcophagus(c, x * 16, 24 * 16, th);
    }),
  }, (b) => {
    b.shell();
    b.door('L', 1);
    b.door('R', 1);
    // sarcophagi
    b.fill(14, 24, 18, 25);
    b.fill(30, 24, 34, 25);
    b.fill(31, 24, 33, 24, 'B'); // a cracked lid
    b.hidden(32, 24, 'hp_up');
    b.fill(46, 24, 50, 25);
    // the gallery of tombs
    b.fill(10, 12, 66, 13);
    b.fill(67, 2, 70, 13);
    b.clear(67, 8, 69, 11);
    b.fill(1, 2, 3, 13);
    // climbing planks on the west side
    b.plat(9, 13, 20);
    b.plat(4, 8, 16);
    b.plat(56, 61, 18);
    b.plat(24, 28, 7);
    b.plat(44, 48, 7);
    // ---- entities
    b.item(68, 11, 'twilight_mail');
    b.candle(7, 22);
    b.candle(24, 21);
    b.candle(40, 21);
    b.candle(58, 21);
    b.candle(16, 8);
    b.candle(36, 8);
    b.candle(56, 8);
    b.candle(26, 4, 'heart_big');
    b.enemy(40, 25, 'plague_doctor');
    b.enemy(24, 16, 'corpse_spider');
    b.enemy(52, 15, 'corpse_spider');
  });

  // K4 — save room: a chapel of bones with a reliquary altar.
  R({
    id: 'cat_save', area: 'catacombs', x: 23, y: 30, w: 1, h: 1, lvl: 3, darkness: 0.4, noDecor: true,
    onEnter: paint((c, room, th, rng, L) => {
      cryptDetail(c, room, th, rng, L, { niche: 0.9, litter: 0.05 });
    }),
  }, (b) => {
    b.shell();
    b.door('L', 0);
    b.door('R', 0);
    hang(b, 1, 2, '3211000000000000001123');
    b.save(12, 11);
    b.candle(7, 7);
    b.candle(17, 7);
  });

  // K5 — the deepest crypt: a tall well of tombs. High under the vault, behind
  // a sealed wall no hand can reach, sleeps the blade called Elegy.
  R({
    id: 'cat_deep', area: 'catacombs', x: 24, y: 30, w: 3, h: 3, lvl: 3, gates: { 'item:elegy': 5 }, darkness: 0.68,
    decor: ['chain', 'torch'],
    onEnter: paint((c, room, th, rng, L) => {
      cryptDetail(c, room, th, rng, L, { niche: 0.55 });
      sarcophagus(c, 54 * 16, 40 * 16, th);
      // a faint glow leaks from the sealed niche
      L.push({ x: 60 * 16, y: 4 * 16, r: 60, color: '#ffd890', i: 0.55 });
      for (let i = 0; i < 6; i++) rect(c, 57 * 16 + rng.int(0, 40), 3 * 16 + rng.int(0, 28), 1, 1, '#ffe8a0');
    }),
  }, (b) => {
    b.shell();
    b.door('L', 0);
    // entry passage
    b.fill(1, 2, 14, 6);
    b.fill(0, 12, 14, 14);
    // the sealed niche high in the east wall
    b.fill(60, 2, 70, 22);
    b.clear(62, 3, 68, 4);
    b.fill(60, 3, 61, 4, 'B');
    // ledges down the well
    b.fill(17, 16, 27, 17);
    b.fill(31, 21, 45, 22);
    b.fill(17, 26, 29, 27);
    b.fill(33, 31, 49, 32);
    b.fill(52, 26, 59, 27);
    b.fill(18, 35, 27, 36);
    // a burial alcove on the west wall (the vessel)
    b.fill(1, 15, 14, 29);
    b.clear(8, 20, 14, 23);
    // the crypt floor: a raised bier in the east
    rise(b, 50, 39, '012333333333333333333');
    // ---- entities
    b.item(10, 23, 'hp_up');
    b.item(57, 35, 'thorn_scourge');
    b.item(66, 4, 'elegy');
    b.candle(8, 9);
    b.candle(22, 13);
    b.candle(38, 18);
    b.candle(22, 23);
    b.candle(41, 28);
    b.candle(55, 23);
    b.candle(22, 32);
    b.candle(30, 37, 'heart_big');
    b.candle(46, 37);
    b.candle(64, 32);
    b.enemy(38, 20, 'plague_doctor');
    b.enemy(36, 39, 'plague_doctor');
    b.enemy(24, 25, 'bone_pillar');
    b.enemy(62, 35, 'blood_skeleton');
  });
})();
