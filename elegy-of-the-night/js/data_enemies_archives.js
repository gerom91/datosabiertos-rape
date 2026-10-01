/* Elegy of the Night — data_enemies_archives.js
 * Enemies of the Belmont Archives (AI + procedural pixel art). See enemy_base.js.
 *
 *   page_swarm        loose pages orbiting a cursed word: drifts after you, gathers, rushes
 *   living_grimoire   floating spellbook with an eye: keeps away, opens, casts homing glyphs
 *   ink_slime         quill-bristled ink blob: oozes, leaps; splits into two ink_droplet
 *   ink_droplet       (hidden) small hopping blob born from slimes and the vault horror
 *   quill_wraith      ghost scribe: fades and reappears, quill fans, ink-stab dash
 *   shelf_mimic       a bookcase until you come close: maw, hops, leaping bite, flying books
 *   archive_sentinel  tower shield with the Belmont crest (frontal hits ¼), bash, overhead mace
 *   hunter_shade      ghost of a past Belmont: whip lash, thrown daggers, back-jumps
 *   vault_horror      ink mass with many eyes: crawls on floors and walls, tentacle slam,
 *                     spawns ink droplets
 *
 * Every sprite is drawn procedurally once per frame key and cached through G.gfx.sprite
 * (palette snap + dark outline). Long, moving parts (whip, slam tentacle, sigils) are
 * rasterised directly with crisp pixel primitives. Nothing here touches the DOM at load time.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, P = G.phys, gfx = G.gfx;
  const N = (en, es) => ({ en, es });
  const OUT = '#07050b';
  const TAU = Math.PI * 2;

  // ======================================================================== helpers
  function spr(key, w, h, pal, fn) {
    return gfx.sprite('arc:' + key, w, h, fn, { palette: pal, outline: OUT, threshold: 100 });
  }
  function sfx(name, vol, pitch) {
    if (G.audio) G.audio.sfx(name, { vol: vol == null ? 1 : vol, pitch: pitch || 1 });
  }
  // crisp filled disc rasterised with rectangles (runtime-drawn parts)
  function pdisc(ctx, x, y, r, col) {
    ctx.fillStyle = col;
    x = Math.round(x);
    y = Math.round(y);
    const R = Math.max(0, r), n = Math.floor(R);
    for (let dy = -n; dy <= n; dy++) {
      const dx = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)) + 0.3);
      ctx.fillRect(x - dx, y + dy, dx * 2 + 1, 1);
    }
  }
  // additive soft glow
  function glow(ctx, x, y, r, col, a) {
    if (r <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, U.rgba(col, a));
    gr.addColorStop(1, U.rgba(col, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  // a sprite pre-rotated in `steps` increments (projectiles that fly in any direction)
  function rotImg(key, size, pal, steps, step, fn) {
    step = ((step % steps) + steps) % steps;
    return spr(key + '@' + step, size, size, pal, (c) => {
      c.translate(size / 2, size / 2);
      c.rotate((step / steps) * TAU);
      fn(c);
    });
  }
  const angStep = (a, steps) => Math.round((a / TAU) * steps);
  function drawCentered(ctx, img, x, y) {
    ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
  }
  function overlapsPlayer(e, box) {
    return U.overlap(box, e.player.hurtbox());
  }
  function keepInRoom(e, g, m) {
    const r = g.room;
    let hit = 0;
    if (e.x < m) (e.x = m), (hit |= 1);
    if (e.x > r.pw - e.w - m) (e.x = r.pw - e.w - m), (hit |= 1);
    if (e.y < m) (e.y = m), (hit |= 2);
    if (e.y > r.ph - e.h - m) (e.y = r.ph - e.h - m), (hit |= 2);
    return hit;
  }

  // ---- particles ----
  const PAPER = ['#f4ecd4', '#e2d3ae', '#bba57c'];
  function paperScrap(x, y, spd) {
    spd = spd || 1.4;
    G.fx.particle(x, y, U.rnd(-spd, spd), U.rnd(-spd * 1.2, spd * 0.3), U.pick(PAPER), 50 + Math.random() * 40, { grav: 0.035, drag: 0.94, size: Math.random() < 0.5 ? 2 : 1 });
  }
  const INKP = ['#2a1c42', '#3f2c63', '#3f2c63', '#1a1129'];
  function inkDrop(x, y, vx, vy, life) {
    G.fx.particle(x, y, vx, vy, Math.random() < 0.2 ? '#634a9a' : U.pick(INKP), life || 30 + Math.random() * 20, { grav: 0.16, drag: 0.98, size: Math.random() < 0.45 ? 2 : 1 });
  }
  function inkSplash(x, y, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * Math.random(), s = (0.4 + Math.random()) * (spd || 2);
      inkDrop(x + U.rnd(-3, 3), y, Math.cos(a) * s, Math.sin(a) * s - 0.6, 26 + Math.random() * 22);
    }
  }
  function embers(x, y, n) {
    for (let i = 0; i < n; i++)
      G.fx.particle(x + U.rnd(-6, 6), y + U.rnd(-6, 6), U.rnd(-0.6, 0.6), U.rnd(-1.6, -0.4), Math.random() < 0.5 ? '#ffb040' : '#ff6020', 20 + Math.random() * 16, { glow: true });
  }
  function wisp(x, y, col, up) {
    G.fx.particle(x, y, U.rnd(-0.3, 0.3), U.rnd(-0.7, -0.2) * (up == null ? 1 : up), col, 24 + Math.random() * 16, { glow: true, drag: 0.96 });
  }

  // ---- shared colours ----
  const INK = { k0: '#0d0816', k1: '#1a1129', k2: '#2a1c42', k3: '#3f2c63', k4: '#634a9a', k5: '#a88cf0', eye: '#e8dcff' };
  const FEATHER = ['#f6f2e8', '#d2cabb', '#968d7f', '#d4a84a'];
  const BOOK_COLS = ['#7a1a1a', '#1a4a2a', '#1a2a5a', '#5a3a1a', '#6a5a1a', '#3a1a4a', '#8a6a2a', '#2a2a2a', '#5a1a3a', '#1a4a4a'];

  // A quill feather from the nib (x0,y0) to the tip (x1,y1); w = half width of the vane.
  // cols: [vane, vane shade, shaft, nib]
  function feather(c, x0, y0, x1, y1, w, cols) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const A = [], B = [];
    for (let i = 0; i <= 10; i++) {
      const s = 0.3 + (0.7 * i) / 10;
      const k = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, ((s - 0.3) / 0.7) * 0.92 + 0.04))), 0.6);
      A.push([x0 + dx * s + nx * w * k, y0 + dy * s + ny * w * k]);
      B.push([x0 + dx * s - nx * w * 0.62 * k, y0 + dy * s - ny * w * 0.62 * k]);
    }
    const pts = [];
    A.forEach((p) => pts.push(p[0], p[1]));
    for (let i = B.length - 1; i >= 0; i--) pts.push(B[i][0], B[i][1]);
    gfx.poly(c, pts, cols[0]);
    const pts2 = [];
    B.forEach((p) => pts2.push(p[0], p[1]));
    for (let i = 10; i >= 0; i--) {
      const s = 0.3 + (0.7 * i) / 10;
      pts2.push(x0 + dx * s, y0 + dy * s);
    }
    gfx.poly(c, pts2, cols[1]);
    // barb splits
    for (const s of [0.52, 0.7, 0.86]) {
      const kx = x0 + dx * s, ky = y0 + dy * s;
      gfx.limb(c, kx, ky, kx + dx * 0.07 + nx * w * 0.95, ky + dy * 0.07 + ny * w * 0.95, 0.9, cols[1]);
    }
    gfx.limb(c, x0 + dx * 0.1, y0 + dy * 0.1, x0 + dx * 0.98, y0 + dy * 0.98, 1, cols[2]);
    if (cols[3]) gfx.limb(c, x0, y0, x0 + dx * 0.14, y0 + dy * 0.14, 1.5, cols[3]);
  }

  // spawn one ink droplet (used by the slime split and the vault horror)
  function spawnDroplet(g, x, y, vx, vy, extra) {
    const room = g.room;
    if (room && P.rectSolid(room, x - 5, y - 9, 10, 9)) x = U.clamp(x, 24, room.pw - 24);
    const d = G.ENT.enemy(Object.assign({ t: 'enemy', id: 'ink_droplet', x, y, noExp: false }, extra || {}), g);
    if (!d) return null;
    d.vx = vx;
    d.vy = vy;
    d.facing = vx < 0 ? -1 : 1;
    d.invuln = 14;
    d.contact = false;
    d.setState('pop');
    g.add(d);
    return d;
  }

  // ===================================================================== PAGE SWARM
  const PAGE_PAL = ['#f4ecd4', '#e2d3ae', '#bba57c', '#86704e', '#4c3a28', '#e8c070'];
  // f: flutter frame (0 flat, 1 bent, 2 edge-on, 3 back), r: rotation step 0..7 (22.5°)
  function pageImg(f, r, glyph) {
    return spr('page' + f + '_' + r + (glyph ? 'g' : ''), 17, 17, PAGE_PAL, (c) => {
      c.translate(8.5, 8.5);
      c.rotate((r / 8) * Math.PI);
      c.scale([1, 0.66, 0.26, 0.66][f], 1);
      const back = f === 3;
      c.fillStyle = back ? '#bba57c' : '#e2d3ae';
      c.fillRect(-4.5, -5.5, 9, 11);
      c.fillStyle = back ? '#86704e' : '#f4ecd4';
      c.fillRect(-4.5, -5.5, 9, 1.6);
      c.fillStyle = back ? '#86704e' : '#bba57c';
      c.fillRect(3, -4, 1.6, 9.5);
      if (f !== 2) {
        c.fillStyle = back ? '#86704e' : '#4c3a28';
        c.fillRect(-3, -3, 5, 1);
        c.fillRect(-3, -1, 6, 1);
        c.fillRect(-3, 1, 4, 1);
        c.fillRect(-3, 3, 5, 1);
        if (glyph && !back) {
          c.fillStyle = '#e8c070';
          c.fillRect(0, 0, 3, 3);
        }
      }
      c.fillStyle = back ? '#e2d3ae' : '#bba57c';
      c.beginPath();
      c.moveTo(4.5, -5.5);
      c.lineTo(1.6, -5.5);
      c.lineTo(4.5, -2.6);
      c.fill();
    });
  }
  // the cursed word at the heart of the swarm
  function wordImg(f) {
    return spr('pword' + f, 11, 11, ['#e8c070', '#fff4c8', '#a07830'], (c) => {
      c.translate(5.5, 5.5);
      c.rotate((f / 4) * (Math.PI / 2));
      c.fillStyle = '#e8c070';
      c.fillRect(-0.5, -3.5, 1, 7);
      c.fillRect(-3, -0.5, 6, 1);
      c.fillRect(-3, -3, 2, 1);
      c.fillRect(1, 2, 2, 1);
      c.fillStyle = '#fff4c8';
      c.fillRect(-0.5, -0.5, 1, 1);
    });
  }
  const swarmPages = (e) => 4 + Math.ceil((4 * Math.max(0, e.hp)) / e.maxHp);

  G.defEnemy('page_swarm', {
    name: N('Page Swarm', 'Enjambre de páginas'),
    desc: N(
      'Pages torn from forbidden chronicles, still stirred by the ink that wrote them. They whirl around a single cursed word.',
      'Páginas arrancadas de crónicas prohibidas, aún agitadas por la tinta que las escribió. Giran en torno a una única palabra maldita.'
    ),
    area: 'arc_hall', hp: 26, atk: 28, def: 0, exp: 18, w: 22, h: 22, flying: true,
    gold: [5, 30], weak: ['fire'], noBlood: true, blood: '#e8c070', stunTime: 4, noDeathFx: true,
    drops: [{ id: 'bookmark_charm', p: 0.012 }, { id: 'mana_tonic', p: 0.05 }],
    init(e) {
      e.setState('drift');
      e.orbA = e.rnd.range(0, TAU);
      e.orbR = 13;
      e.spin = 0.05;
      e.cool = 80 + e.rnd.int(0, 60);
      e.homeX = e.cx;
      e.homeY = e.cy;
      e.seed = e.rnd.range(0, 50);
      e.facing = 1;
    },
    ai(e, g) {
      const pl = e.player;
      e.orbA += e.spin;
      const near = e.dist() < 250 || e.onScreen(16);
      if (e.state === 'drift') {
        let tx, ty, top = 0.78;
        if (near) {
          tx = pl.cx + Math.sin(e.t * 0.021 + e.seed) * 28;
          ty = pl.cy - 10 + Math.sin(e.t * 0.047 + e.seed) * 14;
        } else {
          tx = e.homeX + Math.sin(e.t * 0.015 + e.seed) * 30;
          ty = e.homeY + Math.sin(e.t * 0.03) * 10;
          top = 0.4;
        }
        const a = Math.atan2(ty - e.cy, tx - e.cx), d = Math.hypot(tx - e.cx, ty - e.cy);
        const s = Math.min(top, d * 0.03);
        e.vx = U.lerp(e.vx, Math.cos(a) * s, 0.04);
        e.vy = U.lerp(e.vy, Math.sin(a) * s, 0.04);
        e.spin = U.lerp(e.spin, 0.05, 0.05);
        e.orbR = U.lerp(e.orbR, 13 + Math.sin(e.t * 0.05) * 1.5, 0.06);
        if (near) e.cool--;
        const dd = e.dist();
        if (e.cool <= 0 && dd < 135 && dd > 26 && e.onScreen()) {
          e.setState('gather');
          sfx('page_flutter', 0.6, 1.25);
        }
      } else if (e.state === 'gather') {
        // telegraph: the pages tighten into a fast vortex around the word
        e.vx *= 0.88;
        e.vy *= 0.88;
        e.spin = U.lerp(e.spin, 0.26, 0.08);
        e.orbR = U.lerp(e.orbR, 6.5, 0.1);
        if (e.stT % 3 === 0) {
          const a = Math.random() * TAU;
          G.fx.particle(e.cx + Math.cos(a) * 18, e.cy + Math.sin(a) * 18, -Math.cos(a) * 1.1, -Math.sin(a) * 1.1, '#e8c070', 14, { glow: true, drag: 1 });
        }
        if (e.stT >= 32) {
          const a = Math.atan2(pl.cy - 4 - e.cy, pl.cx - e.cx);
          e.rvx = Math.cos(a) * 2.8;
          e.rvy = Math.sin(a) * 2.8;
          e.setState('rush');
          sfx('page_flutter', 0.85, 0.8);
        }
      } else if (e.state === 'rush') {
        e.vx = e.rvx;
        e.vy = e.rvy;
        e.spin = U.lerp(e.spin, 0.12, 0.05);
        e.orbR = U.lerp(e.orbR, 10, 0.08);
        if (e.stT % 2 === 0) paperScrap(e.cx, e.cy, 0.5);
        if (e.stT > 36) {
          e.setState('drift');
          e.cool = 110 + e.rnd.int(0, 80);
        }
      }
      if (Math.abs(e.vx) > 0.05) e.facing = e.vx < 0 ? -1 : 1;
      e.drift();
      const hit = keepInRoom(e, g, 10);
      if (hit && e.state === 'rush') {
        if (hit & 1) e.rvx *= -0.4;
        if (hit & 2) e.rvy *= -0.4;
      }
      if (near && e.t % 46 === 0) sfx('page_flutter', 0.22, U.rnd(0.9, 1.25));
      if (e.t % 10 === 0 && near) G.fx.particle(e.cx + U.rnd(-5, 5), e.cy + U.rnd(-5, 5), U.rnd(-0.3, 0.3), -0.35, '#e8c070', 18, { glow: true });
    },
    draw(e, ctx, sx, sy) {
      const cy = sy - e.h / 2, t = e.t, n = swarmPages(e);
      const pages = [];
      for (let i = 0; i < n; i++) {
        const a = e.orbA + (i / n) * TAU + Math.sin(t * 0.03 + i * 2.1) * 0.25;
        const r = e.orbR * (0.78 + 0.22 * Math.sin(t * 0.07 + i * 1.7)) + (i % 3) * 1.5;
        const lag = 3 + (i % 4) * 2.5;
        pages.push({
          x: sx + Math.cos(a) * r - e.vx * lag,
          y: cy + Math.sin(a) * r * 0.72 + Math.sin(t * 0.11 + i * 1.3) * 2 - e.vy * lag,
          z: Math.sin(a),
          a,
          i,
        });
      }
      pages.sort((p, q) => p.z - q.z);
      const charge = e.state === 'gather' ? Math.min(1, e.stT / 30) : e.state === 'rush' ? 0.6 : 0;
      glow(ctx, sx, cy, 9 + charge * 6, '#e8c070', 0.25 + charge * 0.35);
      let k = 0;
      for (const p of pages) {
        if (k++ === Math.floor(n / 2)) e.blit(ctx, wordImg(Math.floor(t / 6) % 4), sx, cy, 5, 5, false);
        const f = Math.floor(t / 4 + p.i * 1.7) % 4;
        const rot = (((Math.floor((p.a / Math.PI) * 4 + p.i * 3) % 8) + 8) % 8);
        e.blit(ctx, pageImg(p.z < -0.4 && f === 0 ? 3 : f, rot, p.i % 3 === 0), p.x, p.y, 8, 8, false);
      }
      gfx.addLight(sx, cy, 36 + charge * 20, '#e8c070', 0.3 + charge * 0.4);
    },
    onHit(e, hit) {
      e.orbR = 22;
      e.spin += 0.06;
      for (let i = 0; i < 4; i++) paperScrap(e.cx, e.cy, 1.6);
      if (hit.el === 'fire') embers(e.cx, e.cy, 10);
      sfx('page_flutter', 0.5, U.rnd(1.1, 1.4));
    },
    onDeath(e) {
      for (let i = 0; i < 30; i++) paperScrap(e.cx + U.rnd(-12, 12), e.cy + U.rnd(-10, 10), 2.2);
      G.fx.burst(e.cx, e.cy, '#e8c070', 12, 1.6, { glow: true });
      sfx('page_flutter', 0.9, 0.9);
      sfx('enemy_die', 0.6);
    },
  });

  // ================================================================ LIVING GRIMOIRE
  const GRIM_PAL = ['#2a0812', '#4a1020', '#6e1a2c', '#94303e', '#8a6a2a', '#d4a84a', '#f0d890', '#f2ead8', '#e2d3ae', '#bba57c', '#86704e',
    '#c0303a', '#e8a830', '#a86a18', '#ffe6a0', '#07050b', '#634a9a', '#a88cf0'];
  function grimEye(c, x, y, look, blink) {
    gfx.ellipse(c, x, y + 0.5, 8.6, 6, 0, '#4a1020');
    gfx.ellipse(c, x, y - 1.5, 8, 4, 0, '#94303e');
    if (blink) {
      gfx.ellipse(c, x, y, 7, 4, 0, '#6e1a2c');
      c.fillStyle = '#2a0812';
      c.fillRect(x - 6, y, 13, 1);
      c.fillStyle = '#94303e';
      c.fillRect(x - 5, y - 2, 11, 1);
      return;
    }
    gfx.ellipse(c, x, y, 6.6, 3.9, 0, '#f2ead8');
    c.fillStyle = '#c0303a';
    c.fillRect(x - 6, y, 2, 1);
    c.fillRect(x - 5, y - 2, 1, 1);
    c.fillRect(x + 5, y + 1, 2, 1);
    c.fillRect(x - 4, y + 2, 1, 1);
    const lx = Math.round(x + [1.5, 1.5, 1][look]), ly = Math.round(y + [0, 1, -1][look]);
    gfx.circle(c, lx + 0.5, ly + 0.5, 3.3, '#a86a18');
    gfx.circle(c, lx + 0.5, ly + 0.5, 2.4, '#e8a830');
    c.fillStyle = '#07050b';
    c.fillRect(lx, ly - 2, 1, 5);
    c.fillStyle = '#ffe6a0';
    c.fillRect(lx - 2, ly - 2, 1, 1);
    // lid crease over the eye
    c.fillStyle = '#4a1020';
    c.fillRect(x - 6, y - 4, 13, 1);
  }
  function grimCover(c, look, blink) {
    c.fillStyle = '#6e1a2c';
    c.fillRect(-13, -16, 26, 32);
    c.fillStyle = '#94303e';
    c.fillRect(-13, -16, 26, 1);
    c.fillRect(-13, -16, 1, 32);
    c.fillStyle = '#4a1020';
    c.fillRect(-13, 15, 26, 1);
    c.fillRect(12, -16, 1, 32);
    c.strokeStyle = '#8a6a2a';
    c.lineWidth = 1;
    c.strokeRect(-9.5, -12.5, 19, 25);
    c.fillStyle = '#8a6a2a';
    [[-9, -12], [9, -12], [-9, 12], [9, 12]].forEach(([x, y]) => c.fillRect(x - 1, y - 1, 2, 2));
    const corner = (x, y, sx, sy) => {
      gfx.poly(c, [x, y, x + 6 * sx, y, x, y + 6 * sy], '#d4a84a');
      c.fillStyle = '#f0d890';
      c.fillRect(sx > 0 ? x : x - 1, sy > 0 ? y : y - 1, 1, 1);
    };
    corner(-13, -16, 1, 1);
    corner(13, -16, -1, 1);
    corner(-13, 16, 1, -1);
    corner(13, 16, -1, -1);
    grimEye(c, -1, 0, look, blink);
  }
  // st: 'closed' (f = restless page frame 0..2) | 'half' | 'open' (f = riffle 0..2)
  function grimImg(st, f, look, blink) {
    return spr('grim_' + st + f + look + (blink ? 'b' : ''), 60, 50, GRIM_PAL, (c) => {
      c.translate(30, 25);
      if (st === 'closed' || st === 'half') {
        c.rotate(-0.07);
        // back cover + page block (3/4 view: fore-edge on the right, head on top)
        c.fillStyle = '#4a1020';
        c.fillRect(-14, -18, 32, 36);
        c.fillStyle = '#e2d3ae';
        c.fillRect(13, -16, 3, 32);
        c.fillRect(-12, -18, 27, 2);
        c.fillStyle = '#bba57c';
        for (let y = -15; y < 16; y += 2) c.fillRect(13, y, 3, 1);
        if (st === 'closed' && f) {
          // a restless page sticks out of the fore-edge
          gfx.poly(c, f === 1 ? [15, -12, 20, -14, 19, -6, 15, -6] : [15, 3, 21, 4, 19, 10, 15, 9], '#f2ead8');
          c.fillStyle = '#86704e';
          c.fillRect(17, f === 1 ? -11 : 6, 2, 1);
        }
        // spine with raised bands
        c.fillStyle = '#4a1020';
        c.fillRect(-17, -17, 5, 35);
        c.fillStyle = '#2a0812';
        c.fillRect(-17, -17, 1, 35);
        c.fillStyle = '#d4a84a';
        [-12, -2, 8].forEach((y) => c.fillRect(-17, y, 5, 2));
        c.fillStyle = '#f0d890';
        [-12, -2, 8].forEach((y) => c.fillRect(-16, y, 3, 1));
        if (st === 'closed') {
          grimCover(c, look, blink);
          // clasp strap and buckle
          c.fillStyle = '#2a0812';
          c.fillRect(9, -3, 9, 5);
          c.fillStyle = '#d4a84a';
          c.fillRect(8, -4, 3, 7);
          c.fillStyle = '#f0d890';
          c.fillRect(8, -4, 1, 7);
        } else {
          // the cover swings open: first page with glowing script behind it
          c.fillStyle = '#f2ead8';
          c.fillRect(-12, -16, 25, 32);
          c.fillStyle = '#d4a84a';
          for (let i = 0; i < 6; i++) c.fillRect(-2 + (i % 2), -11 + i * 4, 10 - ((i * 3) % 4), 1);
          c.save();
          c.translate(-13, 0);
          c.scale(0.42, 1);
          c.translate(13, 0);
          grimCover(c, look, true);
          c.restore();
          c.fillStyle = '#2a0812';
          c.fillRect(-2, -3, 3, 5);
        }
        return;
      }
      // open spread
      gfx.poly(c, [-26, -15, -1, -13, 1, -13, 26, -15, 26, 18, 1, 20, -1, 20, -26, 18], '#4a1020');
      gfx.poly(c, [-26, -15, -24, -15, -24, 18, -26, 18], '#2a0812');
      gfx.poly(c, [-23, -14, -12, -17, -1, -14, -1, 17, -12, 15, -23, 16], '#e2d3ae');
      gfx.poly(c, [23, -14, 12, -17, 1, -14, 1, 17, 12, 15, 23, 16], '#f2ead8');
      // page stack edges
      c.fillStyle = '#bba57c';
      c.fillRect(-23, 16, 22, 1);
      c.fillRect(1, 16, 22, 1);
      c.fillStyle = '#86704e';
      c.fillRect(-2, -14, 1, 31);
      c.fillStyle = '#bba57c';
      c.fillRect(1, -14, 2, 31);
      c.fillRect(-4, -14, 2, 31);
      // glowing script on the left page
      for (let i = 0; i < 7; i++) {
        const y = -11 + i * 4;
        c.fillStyle = i % 3 === 1 ? '#f0d890' : '#d4a84a';
        c.fillRect(-20 + (i % 2), y, 6 + ((i * 3) % 5), 1);
        c.fillRect(-11 + ((i * 2) % 3), y, 6 - (i % 3), 1);
      }
      // the eye sigil on the right page
      c.strokeStyle = '#d4a84a';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(12, 0, 7.5, 4.5, 0, 0, TAU);
      c.stroke();
      gfx.circle(c, 12, 0, 2.6, '#f0d890');
      c.fillStyle = '#ffe6a0';
      c.fillRect(11, -1, 2, 2);
      c.fillStyle = '#d4a84a';
      c.fillRect(5, -11, 14, 1);
      c.fillRect(6, 10, 12, 1);
      c.fillRect(8, 13, 8, 1);
      // a riffling page
      if (f === 0) gfx.poly(c, [1, -14, 9, -22, 10, 8, 1, 17], '#f2ead8');
      else if (f === 1) gfx.poly(c, [0, -14, 1, -25, 3, 5, 1, 17], '#e2d3ae');
      else gfx.poly(c, [-1, -14, -9, -22, -10, 8, -1, 17], '#e2d3ae');
      // gold corner caps of the covers
      c.fillStyle = '#d4a84a';
      c.fillRect(-26, -15, 3, 3);
      c.fillRect(23, -15, 3, 3);
      c.fillRect(-26, 15, 3, 3);
      c.fillRect(23, 15, 3, 3);
    });
  }
  // rotating rune that the grimoire hurls
  function glyphImg(f) {
    return spr('glyph' + f, 15, 15, ['#a88cf0', '#634a9a', '#f0d890', '#ffffff', '#d4a84a'], (c) => {
      c.translate(7.5, 7.5);
      c.strokeStyle = '#a88cf0';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(0, 0, 5, 0, TAU);
      c.stroke();
      c.rotate((f / 4) * (Math.PI / 2));
      c.fillStyle = '#a88cf0';
      for (let i = 0; i < 4; i++) {
        c.rotate(Math.PI / 2);
        c.fillRect(-0.5, -7, 1, 2.5);
      }
      c.fillStyle = '#f0d890';
      c.fillRect(-0.5, -3, 1, 6);
      c.fillRect(-2.5, -1.5, 5, 1);
      c.fillRect(-2.5, 1.5, 2, 1);
      c.fillStyle = '#ffffff';
      c.fillRect(-0.5, -0.5, 1, 1);
    });
  }
  function glyphHome(p, g) {
    const pl = g.player;
    if (p.t > 14) {
      const want = Math.atan2(pl.cy - 4 - p.cy, pl.cx - p.cx);
      const cur = Math.atan2(p.vy, p.vx);
      const na = cur + U.clamp(U.wrapAngle(want - cur), -0.03, 0.03);
      const sp = Math.min(1.5, Math.hypot(p.vx, p.vy) + 0.012);
      p.vx = Math.cos(na) * sp;
      p.vy = Math.sin(na) * sp;
    } else {
      p.vx *= 0.97;
      p.vy *= 0.97;
    }
    if (p.t % 4 === 0) G.fx.particle(p.cx, p.cy, U.rnd(-0.25, 0.25), U.rnd(-0.25, 0.25), Math.random() < 0.5 ? '#a88cf0' : '#f0d890', 16, { glow: true });
    if (p.life <= 1) G.fx.burst(p.cx, p.cy, '#a88cf0', 7, 0.9, { glow: true });
  }
  function glyphDraw(p, ctx, sx, sy) {
    const a = p.life < 30 ? p.life / 30 : 1;
    glow(ctx, sx, sy, 12, '#a88cf0', 0.45 * a);
    ctx.globalAlpha = a;
    drawCentered(ctx, glyphImg(Math.floor(p.t / 5) % 4), sx, sy);
    ctx.globalAlpha = 1;
    gfx.addLight(sx, sy, 34, '#a88cf0', 0.65 * a);
  }
  // magic circle drawn in front of the open book
  function sigil(ctx, x, y, r, t, col, flash) {
    glow(ctx, x, y, r + 7, col, 0.35);
    ctx.fillStyle = flash ? '#ffffff' : col;
    for (let i = 0; i < 12; i++) {
      const a = t * 0.07 + (i / 12) * TAU;
      ctx.fillRect(Math.round(x + Math.cos(a) * r * 0.45), Math.round(y + Math.sin(a) * r), i % 2 ? 1 : 2, i % 2 ? 2 : 1);
    }
    ctx.fillStyle = '#fff4c8';
    ctx.fillRect(Math.round(x), Math.round(y) - 2, 1, 5);
    ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
  }
  function castGlyph(e, k) {
    const f = e.facing;
    const a0 = k < 0 ? -0.95 : 0.55;
    e.shoot({
      x: e.cx + f * 18, y: e.cy + k * 5, vx: Math.cos(a0) * 1.7 * f, vy: Math.sin(a0) * 1.7,
      w: 8, h: 8, life: 240, dmg: e.atk, el: 'dark', magic: true, wall: true, color: '#a88cf0', upd: glyphHome, drawFn: glyphDraw,
    });
    sfx('magic_cast', 0.6, k < 0 ? 1 : 1.18);
  }

  G.defEnemy('living_grimoire', {
    name: N('Living Grimoire', 'Grimorio viviente'),
    desc: N(
      'A spellbook that grew an eye from reading itself for three hundred years. It recites curses that hunt down their listener.',
      'Un libro de hechizos al que le creció un ojo de tanto leerse durante trescientos años. Recita maldiciones que persiguen a quien las escucha.'
    ),
    area: 'arc_hall', hp: 60, atk: 32, def: 3, exp: 30, w: 26, h: 28, flying: true,
    gold: [10, 50], weak: ['fire'], blood: '#c0303a', stunTime: 8, noDeathFx: true,
    drops: [{ id: 'blood_ink', p: 0.02 }, { id: 'mana_tonic', p: 0.07 }],
    init(e) {
      e.setState('hover');
      e.cool = 70 + e.rnd.int(0, 70);
      e.blinkT = 0;
      e.open = 0;
      e.homeX = e.cx;
      e.homeY = e.cy;
      e.ph = e.rnd.range(0, TAU);
    },
    ai(e, g) {
      const pl = e.player, dx = e.dxp();
      const aware = e.dist() < 280 && e.onScreen(24);
      if (e.blinkT > 0) e.blinkT--;
      else if (e.state === 'hover' && e.rnd.chance(0.007)) e.blinkT = 9;
      if (e.state === 'hover') {
        e.open = Math.max(0, e.open - 0.1);
        let tx, ty;
        if (aware) {
          e.face();
          const side = Math.abs(dx) < 24 ? -e.facing : -U.sign(dx);
          tx = pl.cx + side * 118;
          ty = pl.cy - 46 + Math.sin(e.t * 0.025 + e.ph) * 16;
        } else {
          tx = e.homeX + Math.sin(e.t * 0.012 + e.ph) * 24;
          ty = e.homeY;
        }
        e.vx = U.lerp(e.vx, U.clamp((tx - e.cx) * 0.02, -1.1, 1.1), 0.05);
        e.vy = U.lerp(e.vy, U.clamp((ty - e.cy) * 0.02, -0.9, 0.9), 0.05);
        if (aware) e.cool--;
        if (e.cool <= 0 && aware && e.seesPlayer(270)) {
          e.setState('open');
          sfx('page_flutter', 0.7, 0.9);
        }
      } else if (e.state === 'open') {
        // telegraph: the book swings open, script ignites, a sigil forms
        e.vx *= 0.9;
        e.vy *= 0.9;
        e.face();
        e.open = Math.min(1, e.stT / 14);
        if (e.stT % 3 === 0) G.fx.particle(e.cx + U.rnd(-12, 12), e.cy + U.rnd(-6, 8), U.rnd(-0.2, 0.2), U.rnd(-1, -0.4), Math.random() < 0.6 ? '#f0d890' : '#a88cf0', 22, { glow: true });
        if (e.stT >= 36) e.setState('cast');
      } else if (e.state === 'cast') {
        e.vx *= 0.9;
        e.vy *= 0.9;
        if (e.stT === 1) castGlyph(e, -1);
        if (e.stT === 18) castGlyph(e, 1);
        if (e.stT >= 46) {
          e.setState('close');
          sfx('page_flutter', 0.5, 1.15);
        }
      } else if (e.state === 'close') {
        e.open = Math.max(0, 1 - e.stT / 12);
        if (e.stT >= 14) {
          e.setState('hover');
          e.cool = 150 + e.rnd.int(0, 90);
        }
      }
      e.move();
      keepInRoom(e, g, 8);
    },
    draw(e, ctx, sx, sy) {
      const bob = Math.round(Math.sin(e.t * 0.07 + (e.ph || 0)) * 2);
      const cy = sy - e.h / 2 + bob;
      const dy = e.preview || !e.player ? 0 : e.dyp();
      const look = dy > 20 ? 1 : dy < -20 ? 2 : 0;
      const open = e.preview ? 0 : e.open;
      let img;
      if (open <= 0.05) img = grimImg('closed', [0, 0, 1, 0, 0, 2][Math.floor(e.t / 10) % 6], look, e.blinkT > 0);
      else if (open < 0.6) img = grimImg('half', 0, 0, false);
      else img = grimImg('open', Math.floor(e.t / 5) % 3, 0, false);
      e.blit(ctx, img, sx, cy, 30, 25, e.facing < 0);
      if (open > 0.5) {
        const f = e.facing;
        sigil(ctx, sx + f * 31, cy, 4 + open * 8 + (e.state === 'cast' ? Math.sin(e.t * 0.5) : 0), e.t, '#f0d890', e._flashDraw);
        gfx.addLight(sx, cy, 76, '#f0c060', 0.9 * open);
      } else gfx.addLight(sx, cy, 26, '#e8a830', 0.35);
    },
    onHit(e, hit) {
      if (hit.el === 'fire') embers(e.cx, e.cy, 8);
      paperScrap(e.cx, e.cy, 1.2);
    },
    onDeath(e) {
      for (let i = 0; i < 18; i++) paperScrap(e.cx + U.rnd(-10, 10), e.cy + U.rnd(-10, 10), 2);
      G.fx.burst(e.cx, e.cy, '#c0303a', 14, 1.8);
      G.fx.burst(e.cx, e.cy, '#f0d890', 10, 2, { glow: true });
      G.fx.debris(e.cx, e.cy, '#6e1a2c', 8);
      sfx('page_flutter', 0.9, 0.7);
      sfx('enemy_die', 0.8);
    },
  });

  // ====================================================================== INK SLIME
  const INK_PAL = ['#0d0816', '#1a1129', '#2a1c42', '#3f2c63', '#634a9a', '#a88cf0', '#e8dcff', '#f6f2e8', '#d2cabb', '#968d7f', '#d4a84a', '#07050b'];
  // [width scale, height scale, lean]
  const SLIME_SHAPES = {
    o0: [1, 1, 0], o1: [1.08, 0.92, 0], o2: [1.02, 0.98, 0], o3: [0.94, 1.07, 0],
    crouch: [1.2, 0.7, 0], crouch2: [1.24, 0.66, 0], up: [0.8, 1.3, 0.22], down: [0.9, 1.14, -0.08], land: [1.32, 0.56, 0],
  };
  function slimeImg(k) {
    const sh = SLIME_SHAPES[k];
    return spr('slime_' + k, 52, 44, INK_PAL, (c) => {
      c.translate(24, 41);
      c.transform(1, 0, -sh[2], 1, 0, 0);
      const w = 13 * sh[0], h = 16 * sh[1];
      // quills stuck in the blob (drawn first: their nibs sink into the ink)
      feather(c, -w * 0.35, -h * 0.5, -w * 0.35 - 10, -h * 0.5 - 13, 2.8, FEATHER);
      feather(c, w * 0.02, -h * 0.72, w * 0.02 + 2, -h - 12, 2.3, FEATHER);
      feather(c, w * 0.5, -h * 0.55, w * 0.5 + 9, -h * 0.55 - 7, 2, ['#d2cabb', '#968d7f', '#968d7f']);
      // body
      gfx.ellipse(c, 0, -2, w + 4, 2.6, 0, INK.k1);
      gfx.ellipse(c, 0, -h * 0.5, w, h * 0.52, 0, INK.k1);
      gfx.ellipse(c, -1, -h * 0.58, w * 0.84, h * 0.4, 0, INK.k2);
      gfx.ellipse(c, -2.5, -h * 0.7, w * 0.58, h * 0.24, 0, INK.k3);
      gfx.ellipse(c, -w * 0.42, -h * 0.74, 2.8, 1.5, -0.5, INK.k4);
      c.fillStyle = INK.k5;
      c.fillRect(Math.round(-w * 0.5), Math.round(-h * 0.84), 2, 1);
      c.fillRect(Math.round(-w * 0.62), Math.round(-h * 0.72), 1, 1);
      // drips hanging off the rim
      gfx.ellipse(c, -w * 0.7, -1.5, 2, 2.6, 0, INK.k0);
      gfx.ellipse(c, w * 0.45, -1, 1.6, 2.2, 0, INK.k0);
      c.fillStyle = INK.k0;
      c.fillRect(Math.round(-w * 0.2), -3, 6, 2);
      // eyes
      const ex = Math.round(w * 0.42), ey = Math.round(-h * 0.56);
      c.fillStyle = INK.eye;
      c.fillRect(ex, ey, 2, 2);
      c.fillRect(ex + 4, ey + 1, 2, 2);
      c.fillStyle = '#07050b';
      c.fillRect(ex + 1, ey + 1, 1, 1);
      c.fillRect(ex + 5, ey + 2, 1, 1);
    });
  }
  function slimeDeath(e, g, big) {
    inkSplash(e.cx, e.fy - 4, big ? 26 : 16, big ? 2.8 : 2.2);
    G.fx.burst(e.cx, e.cy, INK.k4, 8, 1.4);
    sfx('ink_splash', 0.8, big ? 0.8 : 1);
    sfx('enemy_die', 0.6, 1.1);
  }

  G.defEnemy('ink_slime', {
    name: N('Ink Slime', 'Limo de tinta'),
    desc: N(
      'Spilled ink that learned to crawl, still bristling with the quills that wrote it. Cut it apart and it simply writes itself twice.',
      'Tinta derramada que aprendió a reptar, aún erizada de las plumas que la escribieron. Si la partes, simplemente se escribe dos veces.'
    ),
    area: 'arc_stacks', hp: 44, atk: 30, def: 2, exp: 22, w: 22, h: 15,
    gold: [5, 30], resist: ['cut'], weak: ['fire'], absorb: ['dark'], blood: '#3f2c63', hitSfx: 'slime', noDeathFx: true,
    drops: [{ id: 'ink_mantle', p: 0.012 }, { id: 'antidote', p: 0.06 }],
    previewState: 'ooze',
    init(e) {
      e.setState('ooze');
      e.cool = 50 + e.rnd.int(0, 50);
      e.ph = e.rnd.int(0, 39);
    },
    ai(e, g) {
      const dx = e.dxp(), adx = Math.abs(dx), dy = e.dyp();
      const aware = adx < 230 && Math.abs(dy) < 90;
      if (e.state === 'ooze') {
        if (aware) {
          if (e.stT % 30 === 0) e.face();
        } else if (e.stT > 200 && e.rnd.chance(0.01)) {
          e.facing *= -1;
          e.stT = 0;
        }
        const ph = ((e.t + e.ph) % 40) / 40;
        e.vx = e.facing * (ph < 0.45 ? 0.75 : 0.12);
        const bl = P.blockedAhead(g.room, e, e.facing);
        if (bl.wall || bl.ledge) {
          e.vx = 0;
          if (!aware) e.facing *= -1;
        }
        if (aware) e.cool--;
        if (e.cool <= 0 && e.onGround && adx < 120 && adx > 10 && dy > -72 && dy < 40) {
          e.face();
          e.setState('crouch');
          sfx('slime', 0.5, 0.8);
        }
        if (e.onGround && Math.abs(e.vx) > 0.3 && e.t % 14 === 0) inkDrop(e.cx - e.facing * 8, e.fy - 2, 0, 0, 40);
      } else if (e.state === 'crouch') {
        // telegraph: flattens and bubbles
        e.vx = 0;
        if (e.stT % 5 === 0) inkDrop(e.cx + U.rnd(-8, 8), e.y + 3, U.rnd(-0.4, 0.4), -1.3);
        if (e.stT >= 20) {
          e.face();
          e.vx = U.clamp(e.dxp() / 34, -2.8, 2.8);
          e.vy = -5.4;
          e.onGround = false;
          e.setState('leap');
          sfx('slime', 0.6, 1.3);
        }
      } else if (e.state === 'leap') {
        if (e.stT % 3 === 0) inkDrop(e.cx, e.fy, -e.vx * 0.2, 0.5);
        if (e.onGround && e.stT > 3) {
          e.setState('land');
          e.vx = 0;
          sfx('ink_splash', 0.6);
          inkSplash(e.cx, e.fy - 1, 12, 2.2);
          gfx.shake(1, 6);
        }
      } else if (e.state === 'land') {
        e.vx = 0;
        if (e.stT >= 16) {
          e.setState('ooze');
          e.cool = 70 + e.rnd.int(0, 60);
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      let k;
      if (e.state === 'crouch') k = e.stT > 10 && e.stT % 4 < 2 ? 'crouch2' : 'crouch';
      else if (e.state === 'leap') k = e.vy < 0 ? 'up' : 'down';
      else if (e.state === 'land') k = e.stT < 8 ? 'land' : 'o1';
      else k = 'o' + (Math.floor(((e.t + (e.ph || 0)) % 40) / 10) % 4);
      e.blit(ctx, slimeImg(k), sx, sy, 24, 41, e.facing < 0);
      gfx.addLight(sx, sy - 8, 24, '#8a6ae0', 0.25);
    },
    onHit(e, hit) {
      inkSplash(e.cx, e.cy, 5, 1.6);
      if (hit.el === 'fire') embers(e.cx, e.cy, 8);
    },
    onDeath(e, g) {
      slimeDeath(e, g, true);
      // the slime splits: two droplets pop out
      spawnDroplet(g, e.cx - 5, e.fy, -1.6, -3.8);
      spawnDroplet(g, e.cx + 5, e.fy, 1.6, -3.8);
    },
  });

  // ==================================================================== INK DROPLET
  function dropImg(k) {
    const sh = [[1, 1], [1.12, 0.88], [1.28, 0.68], [0.82, 1.26]][k];
    return spr('drop_' + k, 24, 22, INK_PAL, (c) => {
      c.translate(12, 19);
      const w = 5.5 * sh[0], h = 8.5 * sh[1];
      gfx.limb(c, -1, -h * 0.8, -3.5, -h - 3, 1, '#d2cabb');
      gfx.ellipse(c, 0, -1.2, w + 1.4, 1.5, 0, INK.k1);
      gfx.ellipse(c, 0, -h * 0.5, w, h * 0.52, 0, INK.k1);
      gfx.ellipse(c, -0.6, -h * 0.6, w * 0.74, h * 0.34, 0, INK.k2);
      gfx.ellipse(c, -1.4, -h * 0.72, w * 0.4, h * 0.14, 0, INK.k3);
      c.fillStyle = INK.k5;
      c.fillRect(Math.round(-w * 0.55), Math.round(-h * 0.82), 1, 1);
      const ex = Math.round(w * 0.25), ey = Math.round(-h * 0.62);
      c.fillStyle = INK.eye;
      c.fillRect(ex, ey, 2, 2);
      c.fillStyle = '#07050b';
      c.fillRect(ex + 1, ey + 1, 1, 1);
    });
  }
  G.defEnemy('ink_droplet', {
    name: N('Ink Droplet', 'Gota de tinta'),
    desc: N('A stray drop of living ink, hopping about in search of the page it fell from.', 'Una gota extraviada de tinta viva que da saltitos buscando la página de la que cayó.'),
    area: 'arc_stacks', hp: 12, atk: 24, def: 0, exp: 4, w: 10, h: 9, hidden: true,
    gold: [1, 8], resist: ['cut'], weak: ['fire'], absorb: ['dark'], blood: '#3f2c63', hitSfx: 'slime', stunTime: 6, noDeathFx: true,
    previewState: 'idle',
    init(e) {
      e.setState('idle');
      e.cool = 20 + e.rnd.int(0, 30);
    },
    ai(e, g) {
      const dx = e.dxp();
      if (e.state === 'pop') {
        // thrown out of a slime or a horror
        if (e.stT > 8) e.contact = true;
        if (e.onGround && e.stT > 3) {
          e.vx = 0;
          e.contact = true;
          e.setState('idle');
          inkSplash(e.cx, e.fy - 1, 4, 1);
        }
      } else if (e.state === 'idle') {
        e.vx *= 0.7;
        e.cool--;
        if (e.cool <= 0 && e.onGround) {
          e.setState('crouch');
          if (Math.abs(dx) < 260) e.face();
        }
      } else if (e.state === 'crouch') {
        e.vx = 0;
        if (e.stT >= 8) {
          const bl = P.blockedAhead(g.room, e, e.facing);
          if (bl.wall) e.facing *= -1;
          e.vx = e.facing * U.rnd(1.1, 1.6);
          e.vy = -U.rnd(3.2, 4.2);
          e.onGround = false;
          e.setState('hop');
          if (e.onScreen()) sfx('slime', 0.25, 1.6);
        }
      } else if (e.state === 'hop') {
        if (e.onGround && e.stT > 3) {
          e.vx = 0;
          e.setState('idle');
          e.cool = 18 + e.rnd.int(0, 34);
          if (e.rnd.chance(0.5)) inkDrop(e.cx, e.fy - 1, 0, -0.5);
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      let k = Math.floor(e.t / 12) % 2;
      if (e.state === 'crouch') k = 2;
      else if (e.state === 'hop' || e.state === 'pop') k = e.vy < 0 ? 3 : 0;
      e.blit(ctx, dropImg(k), sx, sy, 12, 19, e.facing < 0);
      gfx.addLight(sx, sy - 4, 14, '#8a6ae0', 0.2);
    },
    onDeath(e, g) {
      slimeDeath(e, g, false);
    },
  });
})();
