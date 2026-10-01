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
    return spr('page' + f + '_' + r + (glyph ? 'g' : ''), 19, 19, PAGE_PAL, (c) => {
      c.translate(9.5, 9.5);
      c.rotate((r / 8) * Math.PI);
      c.scale([1, 0.66, 0.26, 0.66][f], 1);
      const back = f === 3;
      c.fillStyle = back ? '#bba57c' : '#e2d3ae';
      c.fillRect(-5, -6.5, 10, 13);
      c.fillStyle = back ? '#86704e' : '#f4ecd4';
      c.fillRect(-5, -6.5, 10, 1.6);
      c.fillRect(-5, -6.5, 1.4, 13);
      c.fillStyle = back ? '#86704e' : '#bba57c';
      c.fillRect(3.4, -5, 1.6, 11.5);
      c.fillRect(-5, 5, 10, 1.5);
      if (f !== 2) {
        c.fillStyle = back ? '#86704e' : '#4c3a28';
        c.fillRect(-3, -4, 5, 1);
        c.fillRect(-3, -2, 6, 1);
        c.fillRect(-3, 0, 4, 1);
        c.fillRect(-3, 2, 6, 1);
        if (glyph && !back) {
          c.fillStyle = '#e8c070';
          c.fillRect(0, 1, 3, 3);
        }
      }
      c.fillStyle = back ? '#e2d3ae' : '#bba57c';
      c.beginPath();
      c.moveTo(5, -6.5);
      c.lineTo(1.8, -6.5);
      c.lineTo(5, -3.3);
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
    area: 'arc_hall', hp: 26, atk: 28, def: 0, exp: 18, w: 30, h: 30, flying: true,
    gold: [5, 30], weak: ['fire'], noBlood: true, blood: '#e8c070', stunTime: 4, noDeathFx: true, hitSfx: 'page_flutter',
    drops: [{ id: 'bookmark_charm', p: 0.012 }, { id: 'mana_tonic', p: 0.05 }],
    init(e) {
      e.setState('drift');
      e.orbA = e.rnd.range(0, TAU);
      e.orbR = 17;
      e.spin = 0.05;
      e.cool = 80 + e.rnd.int(0, 60);
      e.homeX = e.cx;
      e.homeY = e.cy;
      e.seed = e.rnd.range(0, 50);
      e.facing = 1;
      e.noOneWay = true;
      e.noSnap = true;
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
        e.orbR = U.lerp(e.orbR, 17 + Math.sin(e.t * 0.05) * 2, 0.06);
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
        e.orbR = U.lerp(e.orbR, 7, 0.1);
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
        e.orbR = U.lerp(e.orbR, 12, 0.08);
        if (e.stT % 2 === 0) paperScrap(e.cx, e.cy, 0.5);
        if (e.stT > 36) {
          e.setState('drift');
          e.cool = 110 + e.rnd.int(0, 80);
        }
      }
      if (Math.abs(e.vx) > 0.05) e.facing = e.vx < 0 ? -1 : 1;
      // loose paper still cannot pass through stone: tile collision, but no one-way platforms
      const vx0 = e.vx, vy0 = e.vy;
      e.move();
      if (e.state === 'rush' && ((vx0 && !e.vx) || (vy0 && !e.vy) || e.onGround)) {
        // slapped into a wall: the pages scatter and regroup
        for (let i = 0; i < 5; i++) paperScrap(e.cx, e.cy, 1.6);
        e.setState('drift');
        e.cool = 100 + e.rnd.int(0, 60);
        e.orbR = 22;
      }
      e.onGround = false;
      keepInRoom(e, g, 10);
      if (near && e.t % 46 === 0) sfx('page_flutter', 0.22, U.rnd(0.9, 1.25));
      if (e.t % 10 === 0 && near) G.fx.particle(e.cx + U.rnd(-5, 5), e.cy + U.rnd(-5, 5), U.rnd(-0.3, 0.3), -0.35, '#e8c070', 18, { glow: true });
    },
    draw(e, ctx, sx, sy) {
      const cy = sy - e.h / 2, t = e.t, n = swarmPages(e);
      const pages = [];
      for (let i = 0; i < n; i++) {
        // two evenly spaced, counter-rotating rings of pages: a small vortex around the word
        const outer = i % 2 === 0, j = i >> 1;
        const k = outer ? Math.ceil(n / 2) : Math.floor(n / 2);
        const a = (outer ? e.orbA : 0.5 - e.orbA * 1.25) + (j / k) * TAU + Math.sin(t * 0.03 + i * 2.1) * 0.12;
        const r = e.orbR * (outer ? 1.18 : 0.5) * (0.9 + 0.1 * Math.sin(t * 0.07 + i * 1.7));
        const lag = 3 + (i % 4) * 2.5;
        pages.push({
          x: sx + Math.cos(a) * r - e.vx * lag,
          y: cy + Math.sin(a) * r * 0.82 + Math.sin(t * 0.11 + i * 1.3) * 2 - e.vy * lag,
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
        e.blit(ctx, pageImg(p.z < -0.4 && f === 0 ? 3 : f, rot, p.i % 3 === 0), p.x, p.y, 9, 9, false);
      }
      gfx.addLight(sx, cy, 36 + charge * 20, '#e8c070', 0.3 + charge * 0.4);
    },
    onHit(e, hit) {
      e.orbR = 24;
      e.spin += 0.06;
      for (let i = 0; i < 4; i++) paperScrap(e.cx, e.cy, 1.6);
      if (hit.el === 'fire') embers(e.cx, e.cy, 10);
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
    gfx.ellipse(c, x, y + 0.5, 10, 7, 0, '#4a1020');
    gfx.ellipse(c, x, y - 2, 9.4, 4.6, 0, '#94303e');
    if (blink) {
      gfx.ellipse(c, x, y, 8.4, 4.8, 0, '#6e1a2c');
      c.fillStyle = '#2a0812';
      c.fillRect(x - 7, y + 1, 15, 1);
      c.fillStyle = '#94303e';
      c.fillRect(x - 6, y - 2, 13, 1);
      return;
    }
    gfx.ellipse(c, x, y + 0.5, 8, 4.7, 0, '#f2ead8');
    c.fillStyle = '#c0303a';
    c.fillRect(x - 7, y + 1, 2, 1);
    c.fillRect(x - 6, y - 2, 1, 1);
    c.fillRect(x - 5, y + 3, 1, 1);
    c.fillRect(x + 6, y + 2, 2, 1);
    c.fillRect(x + 6, y - 1, 1, 1);
    const lx = Math.round(x + [1.5, 1.5, 1][look]), ly = Math.round(y + [0, 1, -1][look]);
    gfx.circle(c, lx + 0.5, ly + 1, 4, '#a86a18');
    gfx.circle(c, lx + 0.5, ly + 1, 3, '#e8a830');
    c.fillStyle = '#07050b';
    c.fillRect(lx, ly - 2, 1, 6);
    c.fillStyle = '#ffe6a0';
    c.fillRect(lx - 2, ly - 1, 1, 1);
    c.fillRect(lx - 1, ly - 2, 1, 1);
    // heavy upper lid
    c.fillStyle = '#4a1020';
    c.fillRect(x - 7, y - 4, 15, 1);
    c.fillRect(x - 5, y - 5, 11, 1);
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
    c.strokeRect(-10.5, -13.5, 21, 27);
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
          // the cover swings open to the left: first page with glowing script, inner endpaper
          c.fillStyle = '#f2ead8';
          c.fillRect(-12, -16, 25, 32);
          c.fillStyle = '#bba57c';
          c.fillRect(-12, -16, 2, 32);
          for (let i = 0; i < 7; i++) {
            c.fillStyle = i % 3 === 1 ? '#f0d890' : '#d4a84a';
            c.fillRect(-7 + (i % 2), -12 + i * 4, 15 - ((i * 3) % 5), 1);
          }
          gfx.poly(c, [-13, -16, -24, -20, -24, 12, -13, 16], '#4a1020');
          gfx.poly(c, [-14, -14, -22, -17, -22, 10, -14, 13], '#86704e');
          c.fillStyle = '#bba57c';
          c.fillRect(-20, -12, 1, 18);
          c.fillRect(-17, -9, 1, 16);
          c.fillStyle = '#d4a84a';
          c.fillRect(-24, -20, 2, 3);
          c.fillRect(-24, 10, 2, 3);
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
      e.noOneWay = true;
      e.noSnap = true;
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
      e.onGround = false;
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
        gfx.addLight(sx, cy, 64, '#f0c060', 0.6 * open);
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
    gold: [5, 30], resist: ['cut'], weak: ['fire'], absorb: ['dark'], el: 'dark', blood: '#3f2c63', hitSfx: 'slime', noDeathFx: true,
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
    gold: [1, 8], resist: ['cut'], weak: ['fire'], absorb: ['dark'], el: 'dark', blood: '#3f2c63', hitSfx: 'slime', stunTime: 6, noDeathFx: true,
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

  // =================================================================== QUILL WRAITH
  const WRAITH_PAL = ['#c4cce4', '#8e98bc', '#5c648c', '#363c62', '#1e2240', '#0c0a14', '#d8c4ff', '#ffffff', '#e0e8f8', '#2a1c42', '#1a1129',
    '#f6f2e8', '#d2cabb', '#968d7f', '#d4a84a', '#8a6a2a'];
  const WR = { hi: '#c4cce4', mid: '#8e98bc', dk: '#5c648c', deep: '#363c62', vd: '#1e2240', void: '#0c0a14', eye: '#d8c4ff', hand: '#e0e8f8', ink: '#2a1c42', ink2: '#1a1129' };
  const WRAITH_POSE = {
    float: { lean: 0, hand: [10, -17], nib: [15, -8], tip: [-13, -50] },
    raise: { lean: -0.06, hand: [12, -38], nib: [22, -45], tip: [-4, -63] },
    throw: { lean: 0.1, hand: [17, -29], nib: [21, -17], tip: [7, -53] },
    lance: { lean: -0.14, hand: [0, -22], nib: [17, -20], tip: [-25, -26] },
    stab: { lean: 0.22, hand: [15, -22], nib: [34, -19], tip: [-7, -26] },
  };
  function wraithImg(pose, f) {
    const Q = WRAITH_POSE[pose];
    return spr('wraith_' + pose + f, 72, 74, WRAITH_PAL, (c) => {
      c.translate(33, 68);
      const sw = Math.sin((f / 4) * TAU), sw2 = Math.cos((f / 4) * TAU);
      const L = Q.lean;
      c.save();
      c.transform(1, 0, -L, 1, 0, 0);
      const tx = -7 + sw * 2.5;
      // far sleeve
      gfx.limb(c, -6, -25, -10 + sw2, -15, 3.4, WR.deep);
      gfx.circle(c, -10 + sw2, -14.5, 1.6, WR.dk);
      // robe tapering into a curling spectral tail
      gfx.poly(c, [-8, -28, 6, -28, 9, -20, 10, -12, 7, -5, 2 + sw, 0, tx, 4, tx - 2, -1, -8, -6, -12, -13, -11, -22], WR.mid);
      gfx.poly(c, [-8, -28, -3, -28, -4, -16, -1, -5, tx, 4, tx - 2, -1, -8, -6, -12, -13, -11, -22], WR.dk);
      gfx.poly(c, [-6, -26, -5, -14, -3, -7, -7, -8, -10, -14, -9, -22], WR.deep);
      gfx.poly(c, [4, -27, 7, -22, 9, -14, 6, -8, 3, -14], WR.hi);
      // ink soaking up from the hem and dripping off
      gfx.poly(c, [-9, -7, -6, -10, -3, -8, 1, -11, 5, -7, 8, -9, 7, -5, 2 + sw, 0, tx, 4, tx - 2, -1, -8, -6], WR.ink);
      gfx.limb(c, -3, -9, -3, -4, 1, WR.ink2);
      gfx.limb(c, 3, -9, 3, -5, 1, WR.ink2);
      gfx.ellipse(c, tx + 1, 1, 2, 1.4, 0, WR.ink2);
      // cord belt with an inkpot
      c.fillStyle = WR.deep;
      c.fillRect(-9, -19, 18, 2);
      gfx.ellipse(c, -6, -14, 2.3, 2.6, 0, WR.ink2);
      c.fillStyle = '#d4a84a';
      c.fillRect(-7, -17, 3, 1);
      // hood with a void for a face
      gfx.poly(c, [-9, -27, -11, -33, -8, -39, -2, -43, 4, -41, 8, -35, 9, -28], WR.mid);
      gfx.poly(c, [-9, -27, -11, -33, -8, -39, -2, -43, -3, -36, -4, -28], WR.dk);
      gfx.ellipse(c, 4.6, -32.5, 3.8, 4.8, 0.15, WR.void);
      c.fillStyle = WR.eye;
      c.fillRect(4, -34, 2, 1);
      c.fillRect(7, -34, 1, 1);
      c.fillStyle = '#ffffff';
      c.fillRect(5, -34, 1, 1);
      gfx.limb(c, 8.5, -28.5, 7.5, -37, 1, WR.hi);
      c.restore();
      // the great quill
      feather(c, Q.nib[0], Q.nib[1], Q.tip[0], Q.tip[1], 4.2, FEATHER);
      c.fillStyle = WR.ink2;
      c.fillRect(Math.round(Q.nib[0]) - 1, Math.round(Q.nib[1]), 2, 2);
      // near sleeve and hand
      const shx = 4 + L * 26, shy = -26;
      gfx.limb(c, shx, shy, Q.hand[0] - 1, Q.hand[1] + 1, 3.8, WR.dk);
      gfx.limb(c, shx, shy, (shx + Q.hand[0]) / 2, (shy + Q.hand[1]) / 2, 3.8, WR.mid);
      gfx.circle(c, Q.hand[0], Q.hand[1], 1.9, WR.hand);
    });
  }
  const QPAL = ['#f6f2e8', '#d2cabb', '#968d7f', '#d4a84a', '#1a1129'];
  const quillProjImg = (step) => rotImg('qproj', 21, QPAL, 16, step, (c) => feather(c, 8, 0, -9, 0, 2.6, FEATHER));
  function quillDraw(p, ctx, sx, sy) {
    if (p.ghost) ctx.globalAlpha = 0.85;
    drawCentered(ctx, quillProjImg(angStep(Math.atan2(p.vy, p.vx), 16)), sx, sy);
    ctx.globalAlpha = 1;
  }
  function quillUpd(p) {
    if (p.t % 3 === 0) inkDrop(p.cx - p.vx * 2, p.cy - p.vy * 2, 0, 0.3, 22);
  }
  // where the three conjured quills hover during the telegraph (world coords)
  function quillFan(e) {
    const a = e.aimA || 0, out = [];
    const bx = e.cx + e.facing * 16, by = e.fy - 50;
    for (let i = -1; i <= 1; i++) {
      const ai = a + i * 0.3;
      out.push({ x: bx - Math.sin(a) * i * 11 + Math.cos(ai) * 4, y: by + Math.cos(a) * i * 11 + Math.sin(ai) * 4, a: ai });
    }
    return out;
  }
  function wraithBlink(e, g) {
    const pl = e.player, r = g.room;
    for (let i = 0; i < 12; i++) {
      // prefer appearing behind the player
      const side = e.rnd.chance(0.65) ? -pl.facing : pl.facing;
      const x = pl.cx + side * e.rnd.range(70, 118) - e.w / 2;
      const y = pl.fy - e.rnd.range(48, 82);
      if (x < 16 || y < 16 || x + e.w > r.pw - 16 || y + e.h > r.ph - 16) continue;
      if (P.rectSolid(r, x, y, e.w, e.h)) continue;
      e.x = x;
      e.y = y;
      return true;
    }
    return false;
  }

  G.defEnemy('quill_wraith', {
    name: N('Quill Wraith', 'Espectro de pluma'),
    desc: N(
      'A copyist who died at his desk mid-sentence. He still searches for a fitting last word, and tries it out on every living thing he meets.',
      'Un copista que murió en su escritorio a mitad de frase. Aún busca una última palabra adecuada, y la prueba con todo ser vivo que encuentra.'
    ),
    area: 'arc_scriptorium', hp: 58, atk: 34, def: 2, exp: 34, w: 16, h: 34, flying: true,
    gold: [10, 60], weak: ['holy'], noBlood: true, blood: '#c8b8ff', stunTime: 8, noDeathFx: true,
    drops: [{ id: 'blood_ink', p: 0.025 }, { id: 'holy_salt', p: 0.06 }],
    previewState: 'float',
    init(e) {
      e.setState('float');
      e.cool = 60 + e.rnd.int(0, 50);
      e.alpha = 0.9;
      e.ph = e.rnd.range(0, TAU);
      e.last = '';
      e.homeX = e.cx;
      e.homeY = e.cy;
    },
    ai(e, g) {
      const pl = e.player, d = e.dist();
      const aware = d < 300 && e.onScreen(30);
      switch (e.state) {
        case 'float': {
          e.face();
          let tx, ty;
          if (aware) {
            tx = pl.cx - e.facing * 96;
            ty = pl.cy - 30 + Math.sin(e.t * 0.04 + e.ph) * 10;
          } else {
            tx = e.homeX;
            ty = e.homeY + Math.sin(e.t * 0.03 + e.ph) * 6;
          }
          e.vx = U.lerp(e.vx, U.clamp((tx - e.cx) * 0.025, -0.9, 0.9), 0.05);
          e.vy = U.lerp(e.vy, U.clamp((ty - e.cy) * 0.025, -0.8, 0.8), 0.05);
          if (aware) e.cool--;
          if (e.cool <= 0 && aware) {
            if (d < 74) {
              e.setState('stab_wind');
              sfx('ghost_wail', 0.3, 1.5);
            } else if (e.last !== 'tp' && e.rnd.chance(0.35)) {
              e.setState('fade_out');
              sfx('ghost_wail', 0.35, 1.1);
            } else {
              e.setState('raise');
              sfx('magic_cast', 0.45, 1.4);
            }
          }
          break;
        }
        case 'raise': {
          // telegraph: three spectral quills gather over its head, aimed at the player
          e.vx *= 0.85;
          e.vy *= 0.85;
          e.face();
          if (e.stT < 20) e.aimA = Math.atan2(pl.cy - 4 - (e.fy - 50), pl.cx - (e.cx + e.facing * 16));
          if (e.stT % 4 === 0) for (const q of quillFan(e)) wisp(q.x, q.y, '#c8b8ff', 0.4);
          if (e.stT >= 28) {
            for (const q of quillFan(e))
              e.shoot({ x: q.x, y: q.y, vx: Math.cos(q.a) * 3.4, vy: Math.sin(q.a) * 3.4, w: 6, h: 6, life: 150, el: 'cut', color: '#f6f2e8', drawFn: quillDraw, upd: quillUpd });
            sfx('projectile', 0.7, 1.2);
            e.setState('throw');
            e.last = 'throw';
          }
          break;
        }
        case 'throw':
          e.vx *= 0.9;
          e.vy *= 0.9;
          if (e.stT >= 16) {
            e.setState('float');
            e.cool = 70 + e.rnd.int(0, 50);
          }
          break;
        case 'stab_wind': {
          // telegraph: pulls the quill back like a lance, ink gathering on the nib
          e.face();
          e.vx = U.lerp(e.vx, -e.facing * 0.5, 0.1);
          e.vy *= 0.85;
          if (e.stT % 3 === 0) inkDrop(e.cx + e.facing * 17, e.fy - 19, 0, 0.4, 20);
          if (e.stT >= 20) {
            const a = Math.atan2(U.clamp(pl.cy - (e.fy - 20), -50, 50), pl.cx - e.cx);
            e.vx = Math.cos(a) * 4.6;
            e.vy = Math.sin(a) * 3.2;
            e.facing = e.vx < 0 ? -1 : 1;
            e.setState('stab');
            sfx('ink_splash', 0.6, 1.4);
          }
          break;
        }
        case 'stab': {
          const f = e.facing;
          const box = { x: f > 0 ? e.cx + 8 : e.cx - 36, y: e.fy - 25, w: 28, h: 12 };
          if (overlapsPlayer(e, box)) e.hurtPlayer(e.atk, 'cut');
          if (e.stT % 2 === 0) {
            inkDrop(e.cx - f * 6, e.fy - 12, -e.vx * 0.15, 0, 26);
            wisp(e.cx, e.fy - 20, '#c8b8ff');
          }
          if (e.stT >= 16) e.setState('recover');
          break;
        }
        case 'recover':
          e.vx *= 0.88;
          e.vy *= 0.88;
          if (e.stT >= 24) {
            e.last = 'stab';
            if (e.rnd.chance(0.6)) {
              e.setState('fade_out');
              sfx('ghost_wail', 0.3, 1.2);
            } else {
              e.setState('float');
              e.cool = 50 + e.rnd.int(0, 40);
            }
          }
          break;
        case 'fade_out':
          e.vx *= 0.9;
          e.vy *= 0.9;
          e.alpha = Math.max(0, 0.9 * (1 - e.stT / 18));
          if (e.stT % 2 === 0) wisp(e.cx + U.rnd(-7, 7), e.cy + U.rnd(-14, 14), '#a8b8ff');
          if (e.alpha < 0.3) e.active = false;
          if (e.stT >= 18) {
            e.setState('hidden');
            e.alpha = 0;
          }
          break;
        case 'hidden':
          e.vx = e.vy = 0;
          e.active = false;
          if (e.stT === 1) wraithBlink(e, g);
          if (e.stT >= 26) e.setState('fade_in');
          break;
        case 'fade_in':
          e.face();
          e.alpha = Math.min(0.9, (0.9 * e.stT) / 16);
          if (e.alpha > 0.3) e.active = true;
          if (e.stT % 2 === 0) wisp(e.cx + U.rnd(-9, 9), e.cy + U.rnd(-16, 16), '#a8b8ff');
          if (e.stT >= 16) {
            e.setState('float');
            e.cool = 24 + e.rnd.int(0, 30);
            e.last = 'tp';
            e.active = true;
          }
          break;
      }
      if (e.state !== 'hidden' && e.state !== 'fade_out' && e.state !== 'fade_in') e.alpha = 0.84 + Math.sin(e.t * 0.1) * 0.06;
      if (e.state !== 'hidden' && e.t % 7 === 0) inkDrop(e.cx - e.facing * 6 + U.rnd(-2, 2), e.fy - 2, 0, 0.2, 30);
      e.drift();
      keepInRoom(e, g, 12);
    },
    draw(e, ctx, sx, sy) {
      let pose = 'float', f = Math.floor((e.t + 40) / 8) % 4;
      switch (e.state) {
        case 'raise': pose = 'raise'; break;
        case 'throw': pose = e.stT < 9 ? 'throw' : 'float'; break;
        case 'stab_wind': pose = 'lance'; break;
        case 'stab': pose = 'stab'; break;
        case 'recover': pose = e.stT < 9 ? 'stab' : 'float'; break;
      }
      const bob = Math.round(Math.sin(e.t * 0.08 + (e.ph || 0)) * 1.5);
      const y = sy + bob;
      e.blit(ctx, wraithImg(pose, pose === 'float' ? f : 0), sx, y, 33, 68, e.facing < 0);
      if (e.state === 'raise' && !e.preview) {
        const k = Math.min(1, e.stT / 14), a0 = ctx.globalAlpha;
        for (const q of quillFan(e)) {
          const qx = sx + (q.x - e.cx), qy = y + (q.y - e.fy);
          glow(ctx, qx, qy, 9, '#c8b8ff', 0.35 * k);
          ctx.globalAlpha = a0 * k * 0.9;
          drawCentered(ctx, quillProjImg(angStep(q.a, 16)), qx, qy);
          ctx.globalAlpha = a0;
        }
      }
      if (e.state === 'stab_wind' || e.state === 'stab') {
        const nx = sx + e.facing * (e.state === 'stab' ? 34 : 17), ny = y - (e.state === 'stab' ? 19 : 20);
        glow(ctx, nx, ny, 8, '#b48cff', e.state === 'stab' ? 0.6 : 0.3 + 0.2 * Math.sin(e.t * 0.6));
        gfx.addLight(nx, ny, 30, '#b48cff', 0.6);
      }
      gfx.addLight(sx, y - 30, 48, '#a8b8ff', 0.42 * e.alpha);
    },
    onDeath(e) {
      for (let i = 0; i < 16; i++) wisp(e.cx + U.rnd(-8, 8), e.cy + U.rnd(-16, 16), i % 3 ? '#a8b8ff' : '#d8c4ff', 1.5);
      inkSplash(e.cx, e.cy + 8, 14, 2);
      G.fx.burst(e.cx, e.cy, '#c4cce4', 12, 1.6);
      sfx('ghost_wail', 0.6, 0.8);
      sfx('enemy_die', 0.6, 1.2);
    },
  });

  // ==================================================================== SHELF MIMIC
  function themeKey(th) {
    if (G.themes) for (const k in G.themes) if (G.themes[k] === th) return k;
    return 'archives';
  }
  function mimicTheme(e) {
    const r = e.g && e.g.room;
    return (r && r.theme) || (G.themes && G.themes.archives);
  }
  const mimicPals = {};
  function mimicPal(th) {
    const key = themeKey(th);
    if (mimicPals[key]) return mimicPals[key];
    const c = th.c, dk = th === G.themes.vault ? -0.35 : -0.15;
    const pal = [c.base, c.dark, c.light, c.wall2, c.trim, c.glow || c.trim, U.shade(c.base, -0.3), U.shade(c.dark, -0.3)];
    BOOK_COLS.forEach((b) => {
      const col = U.shade(b, dk);
      pal.push(col, U.shade(col, 0.15));
    });
    pal.push('#2a060c', '#4a0c16', '#8a1a2a', '#b02838', '#e04050', '#efe6d8', '#c8bca0', '#8a7e64', '#ffd040', '#ff3048', '#fff4c0');
    return (mimicPals[key] = pal);
  }
  let mimicBooks = null;
  function mimicBookSpecs() {
    if (mimicBooks) return mimicBooks;
    const rng = U.RNG('shelf_mimic_books');
    mimicBooks = [];
    for (let s = 0; s < 3; s++) {
      const row = [];
      let x = -13;
      while (x < 12) {
        const w = rng.int(2, 4);
        if (x + w > 13) break;
        if (rng.next() < 0.08) {
          x += 2;
          continue;
        }
        row.push({ x, w, h: rng.int(7, s === 2 ? 9 : 11), col: rng.int(0, BOOK_COLS.length - 1), trim: rng.next() < 0.5 });
        x += w;
      }
      mimicBooks.push(row);
    }
    return mimicBooks;
  }
  // open: jaw step 0..4, eyes 0 none / 1 glint / 2 open, lean -1..1, squash 0/1, tongue 0..1 (ribbon sway)
  function mimicImg(th, open, eyes, lean, squash, tongue) {
    return spr('mimic_' + themeKey(th) + open + eyes + lean + squash + tongue, 56, 74, mimicPal(th), (c) => {
      const C = th.c, dk = th === G.themes.vault ? -0.35 : -0.15;
      const books = mimicBookSpecs();
      const bookCol = (i) => U.shade(BOOK_COLS[i], dk);
      c.translate(28, 71);
      if (lean) {
        c.translate(0, -24);
        c.rotate(lean * 0.07);
        c.translate(0, 24);
      }
      if (squash) c.scale(squash > 0 ? 1.07 : 0.95, squash > 0 ? 0.9 : 1.06);
      const jaw = [0, 0.16, 0.33, 0.5, 0.68][open];
      const shelfBooks = (row, floorY, skip) => {
        for (const b of row) {
          if (skip && b.x + b.w > skip[0] && b.x < skip[1]) continue;
          const col = bookCol(b.col);
          c.fillStyle = col;
          c.fillRect(b.x, floorY - b.h, b.w, b.h);
          c.fillStyle = U.shade(col, 0.15);
          c.fillRect(b.x, floorY - b.h, 1, b.h);
          if (b.trim) {
            c.fillStyle = C.trim;
            c.fillRect(b.x, floorY - b.h + 2, b.w, 1);
          }
        }
      };
      const board = (y, x0, x1) => {
        c.fillStyle = C.base;
        c.fillRect(x0, y, x1 - x0, 3);
        c.fillStyle = C.light;
        c.fillRect(x0, y, x1 - x0, 1);
      };
      // ---- lower body: plinth, two compartments, rim of the lower jaw
      c.fillStyle = C.wall2;
      c.fillRect(-13, -32, 26, 30);
      shelfBooks(books[0], -4);
      shelfBooks(books[1], -19);
      board(-4, -17, 17);
      board(-19, -13, 13);
      board(-32, -16, 16);
      c.fillStyle = C.dark;
      c.fillRect(-16, -32, 3, 32);
      c.fillRect(13, -32, 3, 32);
      c.fillStyle = C.base;
      c.fillRect(-14, -32, 1, 32);
      c.fillRect(13, -32, 1, 32);
      c.fillStyle = U.shade(C.base, -0.3);
      c.fillRect(-17, -2, 34, 2);
      // ---- the maw
      if (jaw > 0) {
        const fx = -16 + 32 * Math.cos(jaw), fy = -32 - 32 * Math.sin(jaw);
        gfx.poly(c, [-16, -32, 16, -32, fx, fy], '#4a0c16');
        gfx.poly(c, [-16, -32, 4, -32, -16 + 20 * Math.cos(jaw), -32 - 20 * Math.sin(jaw)], '#2a060c');
        // lower fangs
        for (let x = -12; x < 14; x += 4) gfx.poly(c, [x, -31.5, x + 1.5, -36 - (x % 8 === 0 ? 2 : 0), x + 3, -31.5], '#efe6d8');
        c.fillStyle = '#c8bca0';
        for (let x = -12; x < 14; x += 4) c.fillRect(x + 2, -33, 1, 1);
        // ribbon-bookmark tongue lolling over the lip
        if (open >= 2) {
          const sw = tongue ? 1 : 0;
          gfx.poly(c, [-4, -34, 6, -35, 15, -33, 17 + sw, -27, 18 + sw, -20, 16 + sw, -22, 14 + sw, -19, 14 + sw, -28, 10, -32, 0, -32], '#b02838');
          gfx.poly(c, [6, -35, 15, -33, 16 + sw, -29, 14, -31], '#e04050');
        }
      }
      // ---- upper jaw: crown + top compartment, hinged at the back
      c.save();
      c.translate(-16, -32);
      c.rotate(-jaw);
      c.translate(16, 32);
      c.fillStyle = C.wall2;
      c.fillRect(-13, -46, 26, 12);
      shelfBooks(books[2], -35, eyes ? [-1, 10] : null);
      if (eyes) {
        const gl = eyes === 1;
        c.fillStyle = gl ? '#8a1a2a' : '#ffd040';
        c.fillRect(1, -42, gl ? 1 : 3, gl ? 1 : 2);
        c.fillRect(6, -42, gl ? 1 : 3, gl ? 1 : 2);
        if (!gl) {
          c.fillStyle = '#ff3048';
          c.fillRect(2, -42, 1, 2);
          c.fillRect(7, -42, 1, 2);
        }
      }
      board(-35, -16, 16);
      if (jaw > 0) {
        // upper fangs hang from the underside of the jaw
        for (let x = -10; x < 15; x += 4) gfx.poly(c, [x, -32.5, x + 1.5, -28 + (x % 8 === 2 ? 2 : 0), x + 3, -32.5], '#efe6d8');
      }
      c.fillStyle = C.dark;
      c.fillRect(-16, -48, 3, 16);
      c.fillRect(13, -48, 3, 16);
      c.fillStyle = C.base;
      c.fillRect(-14, -46, 1, 14);
      c.fillRect(13, -46, 1, 14);
      // carved crown moulding
      c.fillStyle = C.base;
      c.fillRect(-18, -50, 36, 4);
      c.fillStyle = C.light;
      c.fillRect(-18, -50, 36, 1);
      c.fillStyle = C.trim;
      c.fillRect(-17, -47, 34, 1);
      c.fillRect(-2, -52, 4, 2);
      c.restore();
    });
  }
  const BOOKPAL = BOOK_COLS.concat(BOOK_COLS.map((b) => U.shade(b, 0.18)), ['#efe6d8', '#c8bca0', '#d4a84a']);
  function bookImg(col, step) {
    return rotImg('book' + col, 17, BOOKPAL, 8, step, (c) => {
      const b = BOOK_COLS[col];
      c.fillStyle = b;
      c.fillRect(-4, -5.5, 8, 11);
      c.fillStyle = U.shade(b, 0.18);
      c.fillRect(-4, -5.5, 2, 11);
      c.fillStyle = '#efe6d8';
      c.fillRect(3, -4.5, 2, 9);
      c.fillStyle = '#d4a84a';
      c.fillRect(-4, -3, 8, 1);
      c.fillRect(-4, 2, 8, 1);
    });
  }
  function bookDraw(p, ctx, sx, sy) {
    drawCentered(ctx, bookImg(p.col, Math.floor(p.t / 4) * (p.vx < 0 ? -1 : 1)), sx, sy);
  }
  function bookUpd(p) {
    if (p.t % 6 === 0) G.fx.particle(p.cx, p.cy, U.rnd(-0.4, 0.4), U.rnd(-0.5, 0), U.pick(PAPER), 26, { grav: 0.04 });
  }
  function spillBooks(e, n, aim) {
    for (let i = 0; i < n; i++) {
      const vx = aim ? U.clamp(e.dxp() / 55, -2.6, 2.6) + U.rnd(-0.5, 0.5) : e.facing * U.rnd(0.8, 2.4);
      e.shoot({
        x: e.cx + e.facing * 6, y: e.y + 12, vx, vy: U.rnd(-4.6, -3), grav: 0.2, w: 8, h: 8, life: 160, dmg: Math.round(e.atk * 0.8), el: 'hit',
        color: '#e2d3ae', col: e.rnd.pick([0, 1, 2, 5, 8, 9]), drawFn: bookDraw, upd: bookUpd,
      });
    }
    sfx('page_flutter', 0.7, 0.8);
  }
  function mimicWake(e) {
    if (e.state !== 'disguised' && e.state !== 'settle') return;
    e.setState('reveal');
    e.face();
  }

  G.defEnemy('shelf_mimic', {
    name: N('Shelf Mimic', 'Estante mimo'),
    desc: N(
      'Archivists swore one bookcase crept a little closer every night. It feeds on readers who linger, and keeps their books as teeth.',
      'Los archiveros juraban que un estante se acercaba un poco cada noche. Devora a los lectores que se demoran y guarda sus libros como dientes.'
    ),
    area: 'arc_stacks', hp: 95, atk: 38, def: 6, exp: 50, w: 30, h: 46, heavy: true,
    gold: [20, 120], weak: ['fire'], blood: '#8a1a2a', noDeathFx: true, hitSfx: 'hit_bone',
    drops: [{ id: 'library_card', p: 0.04 }, { id: 'high_potion', p: 0.06 }],
    previewState: 'rest',
    init(e) {
      e.setState('disguised');
      e.contact = false;
      e.tellT = 0;
      e.tellCool = 120 + e.rnd.int(0, 160);
      e.hops = 0;
      e.far = 0;
      e.hopPh = 'wait';
    },
    ai(e, g) {
      const dx = e.dxp(), adx = Math.abs(dx), dy = e.dyp();
      if (e.state !== 'disguised' && e.state !== 'settle') e.far = adx > 260 || Math.abs(dy) > 140 ? e.far + 1 : 0;
      switch (e.state) {
        case 'disguised':
          e.vx = 0;
          e.contact = false;
          if (e.tellT > 0) e.tellT--;
          else if (--e.tellCool <= 0) {
            e.tellT = 10;
            e.tellCool = 160 + e.rnd.int(0, 220);
          }
          if (adx - e.w / 2 - e.player.w / 2 < 60 && Math.abs(dy) < 56) mimicWake(e);
          break;
        case 'reveal':
          // telegraph: shudders, eyes open, the top of the case lifts into a jaw
          e.vx = 0;
          if (e.stT === 2) {
            sfx('roar', 0.55, 1.35);
            gfx.shake(2, 10);
            G.fx.dust(e.cx, e.fy, 6);
          }
          if (e.stT % 6 === 0) paperScrap(e.cx + U.rnd(-10, 10), e.y + 10, 1);
          if (e.stT === 18) spillBooks(e, 2, false);
          if (e.stT >= 34) {
            e.contact = true;
            e.hops = 0;
            e.hopPh = 'wait';
            e.setState('hop');
          }
          break;
        case 'hop':
          if (e.hopPh === 'wait') {
            e.vx = 0;
            if (e.stT >= 14 && e.onGround) {
              e.face();
              if (adx < 100 && Math.abs(dy) < 50 && e.hops >= 1) {
                e.setState('crouch');
                break;
              }
              const bl = P.blockedAhead(g.room, e, e.facing);
              if (bl.wall || bl.ledge) {
                if (adx < 150) e.setState('crouch');
                else e.stT = 0;
                break;
              }
              e.vx = e.facing * 1.5;
              e.vy = -3.3;
              e.onGround = false;
              e.hopPh = 'air';
              e.stT = 0;
            }
          } else if (e.onGround && e.stT > 3) {
            e.vx = 0;
            e.hopPh = 'wait';
            e.stT = 0;
            e.hops++;
            sfx('stomp', 0.4, 1.3);
            G.fx.dust(e.cx, e.fy, 4);
          }
          if (e.far > 240) e.setState('settle');
          break;
        case 'crouch':
          // telegraph: squats, jaw parts, ribbon tongue drips
          e.vx = 0;
          if (e.stT >= 18) {
            e.face();
            e.vx = U.clamp(e.dxp() / 40, -3, 3);
            e.vy = -5.4;
            e.onGround = false;
            e.setState('leap');
            sfx('roar', 0.4, 1.6);
          }
          break;
        case 'leap':
          if (e.stT === 12) spillBooks(e, 1, true);
          if (e.onGround && e.stT > 3) {
            e.vx = 0;
            e.setState('chomp');
            sfx('stomp', 0.7, 0.9);
            sfx('hit_bone', 0.7, 0.6);
            gfx.shake(2, 8);
            G.fx.dust(e.cx, e.fy, 8);
          }
          break;
        case 'chomp': {
          e.vx = 0;
          const f = e.facing;
          if (e.stT <= 7 && overlapsPlayer(e, { x: f > 0 ? e.cx : e.cx - 26, y: e.y + 4, w: 26, h: 26 })) e.hurtPlayer(Math.round(e.atk * 1.15), 'cut');
          if (e.stT >= 10) e.setState('rest');
          break;
        }
        case 'rest':
          // the opening: it pants with its maw open
          e.vx = 0;
          if (e.stT >= 46) {
            e.hops = 0;
            e.hopPh = 'wait';
            e.setState('hop');
          }
          if (e.far > 240) e.setState('settle');
          break;
        case 'settle':
          e.vx = 0;
          e.contact = false;
          if (e.stT >= 24) {
            e.setState('disguised');
            e.far = 0;
          }
          if (e.stT > 4 && adx - e.w / 2 - e.player.w / 2 < 60 && Math.abs(dy) < 56) mimicWake(e);
          break;
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const th = mimicTheme(e);
      if (!th) return;
      let open = 0, eyes = 0, lean = 0, squash = 0, tongue = Math.floor(e.t / 12) % 2, jx = 0;
      switch (e.state) {
        case 'disguised':
          eyes = e.tellT > 0 ? 1 : 0;
          tongue = 0;
          break;
        case 'reveal':
          eyes = e.stT > 4 ? 2 : 1;
          open = e.stT < 10 ? 0 : e.stT < 16 ? 1 : e.stT < 22 ? 2 : 3;
          jx = e.stT < 26 ? (e.stT % 4 < 2 ? 1 : -1) : 0;
          break;
        case 'hop':
          eyes = 2;
          open = e.hopPh === 'air' ? 2 : 1;
          squash = e.hopPh === 'wait' ? (e.stT > 8 ? 1 : 0) : -1;
          break;
        case 'crouch':
          eyes = 2;
          open = e.stT < 9 ? 2 : 3;
          squash = 1;
          jx = e.stT % 4 < 2 ? 1 : 0;
          break;
        case 'leap':
          eyes = 2;
          open = 4;
          lean = e.vy < 0 ? 1 : 0;
          break;
        case 'chomp':
          eyes = 2;
          open = e.stT < 3 ? 4 : e.stT < 6 ? 1 : 0;
          squash = e.stT < 5 ? 1 : 0;
          break;
        case 'rest':
          eyes = 2;
          open = 3;
          break;
        case 'settle':
          eyes = e.stT < 14 ? 2 : 1;
          open = e.stT < 8 ? 2 : e.stT < 14 ? 1 : 0;
          break;
        default:
          eyes = 2;
          open = 3;
      }
      if (e.preview) {
        open = 3;
        eyes = 2;
      }
      e.blit(ctx, mimicImg(th, open, eyes, lean, squash, tongue), sx + jx * e.facing, sy, 28, 71, e.facing < 0);
      if (eyes === 2) gfx.addLight(sx + e.facing * 4, sy - 42, 34, '#ffc040', 0.45);
      if (open >= 2) gfx.addLight(sx + e.facing * 6, sy - 34, 30, '#ff3048', 0.25);
    },
    onHit(e, hit) {
      if (e.state === 'disguised' || e.state === 'settle') mimicWake(e);
      if (hit.el === 'fire') embers(e.cx, e.cy, 10);
      paperScrap(e.cx, e.y + 14, 1.4);
    },
    onDeath(e) {
      G.fx.explode(e.cx, e.cy, 1.4);
      G.fx.debris(e.cx, e.cy, mimicTheme(e) ? mimicTheme(e).c.base : '#4a2418', 18);
      for (let i = 0; i < 24; i++) paperScrap(e.cx + U.rnd(-12, 12), e.cy + U.rnd(-20, 20), 2.4);
      for (let i = 0; i < 4; i++) {
        const col = U.irnd(0, BOOK_COLS.length - 1);
        G.fx.particle(e.cx + U.rnd(-8, 8), e.cy, U.rnd(-2, 2), U.rnd(-3.5, -1.5), BOOK_COLS[col], 50, { grav: 0.2, size: 3 });
      }
      sfx('enemy_die_big', 0.9);
      sfx('page_flutter', 0.9, 0.7);
    },
  });

  // =============================================================== ARCHIVE SENTINEL
  const SENT_PAL = ['#1a1c2a', '#2c3042', '#454b66', '#6c7494', '#a8b0c8', '#5a1420', '#7a1c2c', '#a83040', '#8a6a2a', '#d4a84a', '#f0d890',
    '#4a2e1c', '#6a4630', '#b48cff', '#e8dcff'];
  const SN = { k: '#1a1c2a', dk: '#2c3042', mid: '#454b66', lt: '#6c7494', hi: '#a8b0c8', red: '#5a1420', red2: '#7a1c2c', red3: '#a83040', gD: '#8a6a2a', g: '#d4a84a', gL: '#f0d890', wood: '#4a2e1c', wood2: '#6a4630', vis: '#b48cff', visH: '#e8dcff' };
  // hip height, lean, shield [x, y, rot], mace hand [x, y] + shaft angle, foot x (front/back) and lifts
  const SENT_POSES = {
    walk: { hip: -21, lean: 0.02, sh: [12, -23, 0], hand: [-3, -30], ma: -2.05, fl: 5, bl: -5 },
    bashW: { hip: -17, lean: 0.16, sh: [12, -19, 0], hand: [-7, -25], ma: -2.75, fl: 6, bl: -9 },
    bash: { hip: -19, lean: 0.26, sh: [17, -22, 0], hand: [-6, -28], ma: -2.6, fl: 10, bl: -11 },
    open: { hip: -20, lean: -0.06, sh: [7, -13, 0.42], hand: [-4, -28], ma: -2.3, fl: 5, bl: -6 },
    maceW: { hip: -21, lean: -0.08, sh: [6, -15, 0.3], hand: [-1, -45], ma: -2.65, fl: 6, bl: -6, swing: 1 },
    maceW2: { hip: -21, lean: -0.12, sh: [6, -15, 0.3], hand: [-3, -47], ma: -2.95, fl: 6, bl: -6, swing: 1 },
    maceS: { hip: -18, lean: 0.2, sh: [5, -13, 0.25], hand: [16, -27], ma: 0.95, fl: 9, bl: -9, swing: 1 },
    maceS2: { hip: -17, lean: 0.24, sh: [5, -13, 0.25], hand: [17, -24], ma: 1.32, fl: 9, bl: -9, swing: 1 },
  };
  function sentLeg(c, hx, hy, fx, lift, front) {
    const fy = -lift;
    const kx = (hx + fx) / 2 + 2, ky = (hy + fy) / 2 - 1;
    gfx.limb(c, hx, hy, kx, ky, 5, front ? SN.mid : SN.dk);
    gfx.limb(c, kx, ky, fx, fy - 2, 4.4, front ? SN.mid : SN.dk);
    gfx.circle(c, kx + 0.5, ky, 2.4, front ? SN.lt : SN.mid);
    gfx.poly(c, [fx - 3, fy, fx - 3, fy - 3, fx + 2, fy - 3, fx + 5, fy], front ? SN.dk : SN.k);
    if (front) gfx.limb(c, kx + 1.5, ky + 2.5, fx + 1, fy - 3, 1, SN.hi);
  }
  function sentHelm(c, x, y) {
    gfx.poly(c, [x - 5, y + 6, x - 6, y - 2, x - 4, y - 6, x + 1, y - 8, x + 5, y - 6, x + 7, y - 1, x + 7, y + 6], SN.mid);
    gfx.poly(c, [x - 5, y + 6, x - 6, y - 2, x - 4, y - 6, x - 1, y - 7.5, x - 1, y + 6], SN.dk);
    // plume flowing back
    gfx.poly(c, [x - 1, y - 8, x - 6, y - 10, x - 12, y - 8, x - 16, y - 1, x - 13, y - 2, x - 10, y - 5, x - 5, y - 6], SN.red2);
    gfx.poly(c, [x - 1, y - 8, x - 6, y - 10, x - 11, y - 8, x - 6, y - 8], SN.red3);
    const X = Math.round(x), Y = Math.round(y);
    c.fillStyle = SN.g;
    c.fillRect(X - 5, Y - 4, 12, 1);
    c.fillStyle = SN.k;
    c.fillRect(X + 1, Y - 1, 6, 2);
    c.fillRect(X + 4, Y + 3, 1, 1);
    c.fillRect(X + 6, Y + 3, 1, 1);
    c.fillStyle = SN.vis;
    c.fillRect(X + 4, Y - 1, 2, 1);
    c.fillStyle = SN.visH;
    c.fillRect(X + 5, Y - 1, 1, 1);
    gfx.limb(c, x + 1.5, y - 7, x + 6.5, y - 2.5, 1, SN.hi);
  }
  function rrect(c, x0, y0, w, h, r, col) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x0 + r, y0);
    c.lineTo(x0 + w - r, y0);
    c.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
    c.lineTo(x0 + w, y0 + h);
    c.lineTo(x0, y0 + h);
    c.lineTo(x0, y0 + r);
    c.quadraticCurveTo(x0, y0, x0 + r, y0);
    c.fill();
  }
  // tower shield bearing the Belmont crest: a cross wound by a coiled whip
  function towerShield(c, x, y, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot || 0);
    rrect(c, -9, -17, 18, 34, 5, SN.gD);
    rrect(c, -8, -16, 16, 32, 4, SN.g);
    rrect(c, -7, -15, 14, 29, 3, SN.red);
    c.fillStyle = SN.red2;
    c.fillRect(-7, -12, 6, 26);
    c.fillStyle = SN.gL;
    c.fillRect(-7, -15 + 3, 1, 26);
    c.fillStyle = SN.g;
    c.fillRect(-1, -12, 3, 22);
    c.fillRect(-6, -7, 13, 3);
    c.fillStyle = SN.gL;
    c.fillRect(-1, -12, 1, 22);
    c.fillRect(-6, -7, 13, 1);
    c.strokeStyle = SN.g;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0.5, -5.5, 5, 0.5, TAU - 0.2);
    c.stroke();
    c.beginPath();
    c.moveTo(5.3, -4);
    c.quadraticCurveTo(6, 4, 2, 8);
    c.stroke();
    c.fillStyle = SN.gD;
    c.fillRect(-7, 13, 14, 1);
    c.restore();
  }
  function sentMace(c, hx, hy, a) {
    const L = 19, ex = hx + Math.cos(a) * L, ey = hy + Math.sin(a) * L;
    gfx.limb(c, hx - Math.cos(a) * 3, hy - Math.sin(a) * 3, ex, ey, 2.2, SN.wood);
    gfx.limb(c, hx - Math.cos(a) * 3, hy - Math.sin(a) * 3, hx + Math.cos(a) * 6, hy + Math.sin(a) * 6, 1, SN.wood2);
    c.save();
    c.translate(ex, ey);
    c.rotate(a);
    gfx.ellipse(c, 0, 0, 5, 4, 0, SN.mid);
    c.fillStyle = SN.lt;
    c.fillRect(-4, -6, 7, 2);
    c.fillRect(-4, 4, 7, 2);
    c.fillRect(-1, -5.5, 2, 11);
    c.fillStyle = SN.hi;
    c.fillRect(-3, -6, 5, 1);
    gfx.poly(c, [4, -1.5, 8, 0, 4, 1.5], SN.lt);
    c.restore();
  }
  function sentinelImg(pose, f) {
    return spr('sent_' + pose + f, 76, 70, SENT_PAL, (c) => {
      c.translate(34, 66);
      const S = Object.assign({}, SENT_POSES[pose === 'walk' ? 'walk' : pose]);
      let fl = S.fl, bl = S.bl, flift = 0, blift = 0, bob = 0;
      if (pose === 'walk') {
        const ph = (f / 4) * TAU, s = Math.sin(ph);
        fl = 1 + s * 5;
        bl = -1 - s * 5;
        flift = Math.max(0, -Math.cos(ph)) * 3;
        blift = Math.max(0, Math.cos(ph)) * 3;
        bob = Math.abs(Math.cos(ph)) > 0.7 ? 0 : 1;
      }
      const hy = S.hip + bob, L = S.lean;
      const tx = L * 16, ty = hy - 15;
      // mace (resting / raised) behind the body
      if (!(pose === 'maceS' || pose === 'maceS2')) {
        sentMace(c, S.hand[0] + tx * 0.3, S.hand[1] + bob, S.ma);
        gfx.limb(c, tx - 3, ty + 3, S.hand[0] + tx * 0.3, S.hand[1] + bob, 3.6, SN.dk);
        gfx.circle(c, S.hand[0] + tx * 0.3, S.hand[1] + bob, 2.2, SN.mid);
      }
      sentLeg(c, -1, hy, bl, blift, false);
      // tabard
      gfx.poly(c, [-5, hy - 3, 6, hy - 3, 7, hy + 9, 4, hy + 12, 1, hy + 9, -2, hy + 12, -6, hy + 9], SN.red);
      gfx.poly(c, [2, hy - 3, 6, hy - 3, 7, hy + 9, 4, hy + 12, 2, hy + 10], SN.red2);
      c.fillStyle = SN.g;
      c.fillRect(0, hy + 1, 1, 6);
      c.fillRect(-2, hy + 3, 5, 1);
      sentLeg(c, 1, hy, fl, flift, true);
      // breastplate & pauldron
      gfx.poly(c, [tx - 7, ty + 1, tx + 7, ty + 1, 7, hy - 3, 4, hy + 1, -5, hy + 1, -7, hy - 4], SN.mid);
      gfx.poly(c, [tx - 7, ty + 1, tx - 2, ty + 1, -2, hy + 1, -5, hy + 1, -7, hy - 4], SN.dk);
      gfx.limb(c, tx + 3, ty + 3, 3, hy - 3, 1.4, SN.lt);
      c.fillStyle = SN.k;
      c.fillRect(-6, hy - 1, 13, 2);
      c.fillStyle = SN.g;
      c.fillRect(1, hy - 1, 2, 2);
      sentHelm(c, tx + 2, ty - 6);
      gfx.ellipse(c, tx - 1, ty + 2, 6.5, 3.8, 0.1, SN.lt);
      gfx.ellipse(c, tx - 1, ty + 3.4, 6.2, 2.2, 0.1, SN.mid);
      c.fillStyle = SN.hi;
      c.fillRect(Math.round(tx) - 4, Math.round(ty), 5, 1);
      towerShield(c, S.sh[0] + (pose === 'walk' ? 0 : 0), S.sh[1] + bob, S.sh[2]);
      if (pose === 'maceS' || pose === 'maceS2') {
        gfx.limb(c, tx + 1, ty + 3, S.hand[0], S.hand[1], 3.8, SN.mid);
        gfx.circle(c, S.hand[0], S.hand[1], 2.4, SN.lt);
        sentMace(c, S.hand[0], S.hand[1], S.ma);
      }
    });
  }
  const SENT_GUARD = { walk: 1, bash_wind: 1, bash: 1 };

  G.defEnemy('archive_sentinel', {
    name: N('Archive Sentinel', 'Centinela del archivo'),
    desc: N(
      'Armour the Belmonts left to guard their chronicles. The ink got inside it long ago, but it still raises the family shield against every intruder.',
      'Una armadura que los Belmont dejaron custodiando sus crónicas. La tinta se coló dentro hace mucho, pero aún alza el escudo familiar ante cualquier intruso.'
    ),
    area: 'arc_stacks', hp: 150, atk: 40, def: 12, exp: 70, w: 20, h: 44, heavy: true, armored: true,
    gold: [30, 150], weak: ['dark'], blood: '#b48cff', noBlood: true,
    drops: [{ id: 'iron_shield', p: 0.02 }, { id: 'high_potion', p: 0.05 }],
    previewState: 'walk',
    init(e) {
      e.setState('walk');
      e.cool = 50 + e.rnd.int(0, 40);
      e.blockT = 0;
    },
    ai(e, g) {
      const dx = e.dxp(), adx = Math.abs(dx), dy = e.dyp();
      const aware = adx < 260 && Math.abs(dy) < 100 && e.onScreen(40);
      if (e.blockT > 0) e.blockT--;
      switch (e.state) {
        case 'walk': {
          if (aware) e.face();
          const want = aware && adx > 44 ? e.facing * 0.45 : 0;
          const bl = P.blockedAhead(g.room, e, e.facing);
          e.vx = bl.wall || bl.ledge ? 0 : want;
          if (aware) e.cool--;
          if (e.cool <= 0 && aware && Math.abs(dy) < 40) {
            if (adx < 56) {
              e.setState('mace_wind');
              sfx('gear', 0.4, 0.7);
            } else if (adx < 175 && e.seesPlayer(200)) {
              e.setState('bash_wind');
              sfx('stomp', 0.4, 1.4);
            }
          }
          if (e.vx && e.t % 20 === 0) sfx('stomp', 0.15, 1.6);
          break;
        }
        case 'bash_wind':
          // telegraph: drops behind the shield, scraping its feet
          e.vx = 0;
          if (e.stT % 6 === 0) G.fx.dust(e.cx - e.facing * 8, e.fy, 2);
          if (e.stT >= 26) {
            e.setState('bash');
            sfx('roar', 0.35, 0.6);
          }
          break;
        case 'bash': {
          e.vx = e.facing * 4.2;
          const bl = P.blockedAhead(g.room, e, e.facing);
          const f = e.facing;
          if (overlapsPlayer(e, { x: f > 0 ? e.cx + 2 : e.cx - 22, y: e.y + 2, w: 20, h: e.h - 2 })) e.hurtPlayer(Math.round(e.atk * 1.1), 'hit');
          if (e.stT % 3 === 0) G.fx.dust(e.cx - f * 8, e.fy, 2);
          if (bl.wall || bl.ledge || e.stT >= 26) {
            if (bl.wall) {
              gfx.shake(3, 10);
              G.fx.spark(e.cx + f * 16, e.cy, '#ffe0a0', 8);
              sfx('hit_metal', 0.8, 0.7);
            }
            e.vx = 0;
            e.setState('bash_end');
          }
          break;
        }
        case 'bash_end':
          // the opening: shield lowered while it catches its breath
          e.vx *= 0.75;
          if (e.stT >= 40) {
            e.setState('walk');
            e.cool = 60 + e.rnd.int(0, 40);
          }
          break;
        case 'mace_wind':
          // telegraph: hefts the mace high, the shield swings aside
          e.vx = 0;
          if (e.stT >= 30) e.setState('mace_swing');
          break;
        case 'mace_swing': {
          e.vx = 0;
          const f = e.facing;
          if (e.stT === 3) {
            gfx.shake(3, 12);
            sfx('stomp', 0.9, 0.8);
            sfx('hit_metal', 0.6, 0.6);
            G.fx.dust(e.cx + f * 26, e.fy, 8);
            G.fx.spark(e.cx + f * 26, e.fy - 3, '#ffe0a0', 6);
            // the blow cracks along the floor
            for (let i = 0; i < 8; i++) G.fx.particle(e.cx + f * (24 + i * 4), e.fy - 1, f * U.rnd(0.8, 2.2), -U.rnd(0.4, 1.8), i % 2 ? '#ffe0a0' : '#8a8070', 18 + i * 2, { grav: 0.12, size: 2 });
          }
          if (e.stT >= 1 && e.stT <= 7 && overlapsPlayer(e, { x: f > 0 ? e.cx + 4 : e.cx - 40, y: e.fy - 52, w: 36, h: 52 })) e.hurtPlayer(Math.round(e.atk * 1.25), 'hit');
          if (e.stT >= 3 && e.stT <= 8 && overlapsPlayer(e, { x: f > 0 ? e.cx + 18 : e.cx - 60, y: e.fy - 14, w: 42, h: 14 })) e.hurtPlayer(e.atk, 'hit');
          if (e.stT >= 9) e.setState('mace_rec');
          break;
        }
        case 'mace_rec':
          e.vx = 0;
          if (e.stT >= 32) {
            e.setState('walk');
            e.cool = 50 + e.rnd.int(0, 40);
          }
          break;
      }
      e.move();
    },
    // the tower shield turns frontal blows: ¼ damage unless it is lowered
    onHitCheck(e, hit, g) {
      if (!SENT_GUARD[e.state]) return true;
      const srcX = hit.item ? g.player.cx : hit.x + (hit.w || 0) / 2;
      if ((srcX - e.cx) * e.facing <= 0) return true;
      const half = e.defn / 2;
      if (hit.dmg > half) hit.dmg = (hit.dmg - half) * 0.25 + half;
      e.blockT = 10;
      G.fx.spark(e.cx + e.facing * 13, hit.y != null ? U.clamp(hit.y + (hit.h || 0) / 2, e.y + 6, e.fy - 6) : e.cy, '#ffe8b0', 7);
      sfx('block', 0.8, 0.9);
      if (e.state === 'walk') e.cool = Math.min(e.cool, 24);
      return true;
    },
    draw(e, ctx, sx, sy) {
      let pose = 'walk', f = Math.abs(e.vx) > 0.05 ? Math.floor(e.t / 10) % 4 : 0;
      switch (e.state) {
        case 'bash_wind': pose = 'bashW'; break;
        case 'bash': pose = 'bash'; break;
        case 'bash_end': pose = e.stT < 32 ? 'open' : 'walk'; break;
        case 'mace_wind': pose = e.stT < 14 ? 'maceW' : 'maceW2'; break;
        case 'mace_swing': pose = e.stT < 2 ? 'maceS' : 'maceS2'; break;
        case 'mace_rec': pose = e.stT < 22 ? 'maceS2' : 'walk'; break;
      }
      const jx = e.state === 'bash_wind' && e.stT % 4 < 2 ? 1 : 0;
      e.blit(ctx, sentinelImg(pose, pose === 'walk' ? f : 0), sx + jx, sy, 34, 66, e.facing < 0);
      const f2 = e.facing;
      if (e.blockT > 0) glow(ctx, sx + f2 * 14, sy - 22, 14, '#ffe8b0', 0.35 * (e.blockT / 10));
      if (e.state === 'bash_wind' && e.stT > 14) glow(ctx, sx + f2 * 14, sy - 24, 12, '#d4a84a', 0.3);
      if (e.state === 'mace_wind' && e.stT > 16) {
        // the raised mace catches the light just before it falls
        const k = (e.stT - 16) / 14;
        glow(ctx, sx - f2 * 21, sy - 51, 8 + k * 4, '#ffe8b0', 0.25 + k * 0.35);
        if (e.stT % 6 < 3) {
          ctx.fillStyle = '#fff8e0';
          ctx.fillRect(Math.round(sx - f2 * 21), Math.round(sy - 56), 1, 3);
          ctx.fillRect(Math.round(sx - f2 * 21) - 1, Math.round(sy - 55), 3, 1);
        }
      }
      // visor glow
      gfx.addLight(sx + f2 * 5, sy - 42, 22, '#b48cff', 0.4);
    },
    onDeath(e) {
      G.fx.explode(e.cx, e.cy, 1.3);
      G.fx.debris(e.cx, e.cy, '#454b66', 16);
      G.fx.debris(e.cx, e.cy - 8, '#7a1c2c', 6);
      inkSplash(e.cx, e.cy, 16, 2.4);
      for (let i = 0; i < 10; i++) wisp(e.cx + U.rnd(-6, 6), e.cy + U.rnd(-16, 10), '#b48cff', 1.4);
      sfx('enemy_die_big', 0.9);
      sfx('hit_metal', 0.7, 0.5);
    },
  });

  // ================================================================== HUNTER'S SHADE
  const SHADE_PAL = ['#1a2e38', '#26444f', '#3e6a7a', '#6c9fae', '#b2dce2', '#eaf8f8', '#b4d4da', '#ffffff', '#d4a84a', '#8a6a2a', '#7ad8e8', '#d0f0f2'];
  const SH = { lth: '#1a2e38', dk: '#26444f', mid: '#3e6a7a', lt: '#6c9fae', hi: '#b2dce2', skin: '#eaf8f8', skinS: '#b4d4da', eye: '#ffffff', g: '#d4a84a', gD: '#8a6a2a', glow: '#7ad8e8', band: '#d0f0f2' };
  const SHADE_POSES = {
    stand: { hip: -21, lean: 0.03, fl: [4, 0], bl: [-4, 0], hand: [7, -21], hand2: [-5, -20], flare: 0 },
    wind: { hip: -21, lean: -0.12, fl: [6, 0], bl: [-6, 0], hand: [-8, -45], hand2: [6, -27], flare: 0 },
    lash: { hip: -19, lean: 0.16, fl: [10, 0], bl: [-8, 0], hand: [16, -30], hand2: [-7, -24], flare: 2 },
    rec: { hip: -20, lean: 0.1, fl: [9, 0], bl: [-7, 0], hand: [14, -24], hand2: [-6, -22], flare: 1 },
    throwW: { hip: -21, lean: -0.06, fl: [5, 0], bl: [-5, 0], hand: [-9, -27], hand2: [6, -26], flare: 0 },
    throw: { hip: -20, lean: 0.12, fl: [8, 0], bl: [-6, 0], hand: [17, -30], hand2: [-6, -23], flare: 1 },
    air: { hip: -25, lean: -0.05, fl: [5, 7], bl: [-4, 5], hand: [10, -31], hand2: [-10, -33], flare: 3 },
    land: { hip: -15, lean: 0.2, fl: [7, 0], bl: [-7, 0], hand: [10, -17], hand2: [-6, -16], flare: 1 },
  };
  function shadeLeg(c, hx, hy, fx, lift, front) {
    const fy = -lift;
    const kx = (hx + fx) / 2 + 2.5, ky = (hy + fy) / 2 - 1;
    if (front) {
      gfx.limb(c, hx, hy, kx, ky, 5.2, SH.lth);
      gfx.limb(c, kx, ky, fx, fy - 3, 4.6, SH.lth);
    }
    gfx.limb(c, hx, hy, kx, ky, 3.8, front ? SH.mid : SH.dk);
    gfx.limb(c, kx, ky, fx, fy - 3, 3.2, front ? SH.mid : SH.dk);
    // tall hunter's boots
    gfx.poly(c, [fx - 2, fy - 7, fx + 2, fy - 7, fx + 2, fy - 2, fx + 4.5, fy - 1, fx + 4.5, fy, fx - 2.5, fy], SH.lth);
    c.fillStyle = front ? SH.mid : SH.dk;
    c.fillRect(Math.round(fx - 2), Math.round(fy - 7), 4, 1);
    if (front) gfx.limb(c, kx + 0.5, ky - 0.5, kx + 1.5, ky + 2, 1, SH.lt);
  }
  function shadeImg(pose, f) {
    return spr('shade_' + pose + f, 66, 64, SHADE_PAL, (c) => {
      c.translate(31, 61);
      const S = Object.assign({}, SHADE_POSES[pose === 'walk' ? 'stand' : pose]);
      const ph = (f / 4) * TAU, s = Math.sin(ph);
      if (pose === 'walk') {
        S.fl = [s * 6, Math.max(0, -Math.cos(ph)) * 3];
        S.bl = [-s * 6, Math.max(0, Math.cos(ph)) * 3];
        S.hip = -21 + (Math.abs(Math.cos(ph)) > 0.7 ? 0 : 1);
        S.flare = 1;
        S.hand = [7 + s * 2, -21];
        S.hand2 = [-5 - s * 3, -20];
      }
      const hy = S.hip, L = S.lean, fl = S.flare;
      const nx = L * 18, ny = hy - 15;
      const wv = Math.sin(ph * 2 + 1);
      // long coat, back panel: flares and splits into two tails
      gfx.poly(c, [nx - 4, ny + 2, nx + 3, ny + 2, 4, hy, 3, hy + 13, -1, hy + 10, -5 - fl * 2, hy + 15 + fl, -8 - fl * 2.6, hy + 9 + fl * 0.5, -5, hy - 3], SH.dk);
      gfx.poly(c, [-1, hy + 10, -5 - fl * 2, hy + 15 + fl, -6 - fl * 2.2, hy + 12 + fl, -2, hy + 6], SH.lth);
      // far leg and arm
      shadeLeg(c, -1, hy, S.bl[0], S.bl[1], false);
      gfx.limb(c, nx - 2, ny + 3, S.hand2[0], S.hand2[1], 2.8, SH.dk);
      gfx.circle(c, S.hand2[0], S.hand2[1], 1.4, SH.skinS);
      // jerkin and belt
      gfx.poly(c, [nx - 4, ny + 1, nx + 4, ny + 1, 4.5, hy, -4, hy], SH.mid);
      gfx.poly(c, [nx + 1, ny + 2, nx + 4, ny + 1, 4.5, hy - 1, 2, hy - 1], SH.lt);
      c.fillStyle = SH.lth;
      c.fillRect(-4, Math.round(hy) - 1, 9, 2);
      c.fillStyle = SH.g;
      c.fillRect(1, Math.round(hy) - 1, 2, 2);
      // near leg
      shadeLeg(c, 1, hy, S.fl[0], S.fl[1], true);
      // coat front flap over the thigh
      gfx.poly(c, [nx + 2, ny + 2, nx + 5, ny + 2, 5.5, hy - 1, 6.5 + fl * 0.5, hy + 9, 3, hy + 10, 2.5, hy], SH.lt);
      gfx.limb(c, 5.5, hy, 6 + fl * 0.5, hy + 8, 1, SH.hi);
      // dagger hilt at the belt
      c.fillStyle = SH.hi;
      c.fillRect(4, Math.round(hy) - 4, 1, 3);
      // whip coiled at the back of the hip
      if (pose === 'walk' || pose === 'stand' || pose === 'land' || pose === 'air' || pose === 'throwW' || pose === 'throw') {
        c.strokeStyle = SH.gD;
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(-5, hy + 3, 3.2, 3.6, 0.2, 0, TAU);
        c.stroke();
        c.strokeStyle = SH.g;
        c.beginPath();
        c.ellipse(-5.5, hy + 2.6, 2.2, 2.6, 0.2, 0.6, TAU - 0.5);
        c.stroke();
        c.fillStyle = SH.g;
        c.fillRect(-3, Math.round(hy) - 1, 1, 3);
      }
      // short capelet over the shoulders, fluttering back
      gfx.poly(c, [nx + 3, ny - 0.5, nx - 2, ny - 1.5, nx - 7, ny + 1, nx - 10 - fl * 1.6, ny + 6 + wv, nx - 12 - fl * 2, ny + 10 + wv, nx - 8 - fl, ny + 8.5, nx - 6 - fl * 0.6, ny + 10.5, nx - 2, ny + 7, nx + 3, ny + 5], SH.lt);
      gfx.poly(c, [nx - 6, ny + 1.5, nx - 10 - fl * 1.6, ny + 6 + wv, nx - 12 - fl * 2, ny + 10 + wv, nx - 8 - fl, ny + 8.5, nx - 4, ny + 5], SH.mid);
      gfx.limb(c, nx - 1, ny, nx + 3, ny + 0.5, 1, SH.hi);
      // head in profile: pale face, hair swept back over the nape, headband with tails
      const hx = Math.round(nx + 2), hyy = Math.round(ny - 6);
      gfx.poly(c, [hx + 4, hyy - 3, hx + 2, hyy - 5.5, hx - 2, hyy - 6, hx - 5, hyy - 4, hx - 7, hyy, hx - 9 - fl, hyy + 3 + wv, hx - 6, hyy + 3, hx - 7, hyy + 6 + wv * 0.5, hx - 3, hyy + 4.5, hx - 1, hyy + 1], SH.hi);
      gfx.poly(c, [hx - 2, hyy - 4.5, hx - 5, hyy - 3, hx - 7, hyy, hx - 9 - fl, hyy + 3 + wv, hx - 6, hyy + 3, hx - 7, hyy + 6 + wv * 0.5, hx - 3, hyy + 4.5], SH.lt);
      c.fillStyle = SH.mid;
      c.fillRect(hx - 5, hyy - 1, 3, 1);
      c.fillRect(hx - 6, hyy + 2, 2, 1);
      gfx.poly(c, [hx - 1, hyy - 3, hx + 3, hyy - 3, hx + 4, hyy, hx + 5, hyy + 1, hx + 4, hyy + 2, hx + 3.5, hyy + 4, hx + 1, hyy + 5, hx - 1, hyy + 4], SH.skin);
      c.fillStyle = SH.skinS;
      c.fillRect(hx - 1, hyy + 2, 2, 3);
      c.fillRect(hx + 1, hyy + 4, 2, 1);
      gfx.poly(c, [hx - 1, hyy - 4.5, hx + 4.5, hyy - 4, hx + 3, hyy - 2, hx + 1, hyy - 1.5, hx, hyy - 2.5], SH.hi);
      c.fillStyle = SH.band;
      c.fillRect(hx - 2, hyy - 3, 7, 1);
      gfx.limb(c, hx - 3, hyy - 2.5, hx - 8 - fl, hyy - 4 + wv * 1.5, 1, SH.band);
      gfx.limb(c, hx - 3, hyy - 2, hx - 7 - fl, hyy + 0.5 + wv, 1, SH.band);
      c.fillStyle = SH.glow;
      c.fillRect(hx + 1, hyy, 3, 1);
      c.fillStyle = SH.eye;
      c.fillRect(hx + 2, hyy, 1, 1);
      // near arm: lit sleeve, bracer, pale hand
      const ex = (nx + 1 + S.hand[0]) / 2 + (S.hand[1] < ny ? -1 : 0), ey = (ny + 3 + S.hand[1]) / 2 + 1.5;
      gfx.limb(c, nx + 1, ny + 3, ex, ey, 4.6, SH.lth);
      gfx.limb(c, ex, ey, S.hand[0], S.hand[1], 4.2, SH.lth);
      gfx.limb(c, nx + 1, ny + 3, ex, ey, 3, SH.lt);
      gfx.limb(c, ex, ey, S.hand[0], S.hand[1], 2.6, SH.lt);
      gfx.limb(c, U.lerp(ex, S.hand[0], 0.55), U.lerp(ey, S.hand[1], 0.55), U.lerp(ex, S.hand[0], 0.75), U.lerp(ey, S.hand[1], 0.75), 3, SH.hi);
      gfx.circle(c, S.hand[0], S.hand[1], 1.7, SH.skin);
      if (pose === 'throwW' || pose === 'throw') {
        // a silver dagger between the fingers
        gfx.limb(c, S.hand[0], S.hand[1], S.hand[0] + (pose === 'throw' ? 5 : -2), S.hand[1] - (pose === 'throw' ? 0 : 5), 1, '#eaf8f8');
      } else {
        // whip handle
        const hd = pose === 'wind' ? [-2, -3] : pose === 'lash' || pose === 'rec' ? [3, 0] : [2, 2];
        gfx.limb(c, S.hand[0] - hd[0], S.hand[1] - hd[1], S.hand[0] + hd[0], S.hand[1] + hd[1], 1.6, SH.g);
      }
    });
  }
  const SHADE_HAND = (pose) => SHADE_POSES[pose] ? SHADE_POSES[pose].hand : SHADE_POSES.stand.hand;
  // the whip, relative to the hand (unflipped): list of [x, y]
  function whipPoints(e) {
    const st = e.state, k = e.stT, n = 16, pts = [];
    if (st === 'whip_wind') {
      for (let i = 0; i <= 10; i++) {
        const s = i / 10;
        pts.push([-s * 18 - Math.sin(s * 3 + k * 0.3) * 3, s * 20 + Math.sin(s * 5 + k * 0.2) * 3]);
      }
    } else if (st === 'whip_lash') {
      const ext = Math.min(1, (k + 1) / 4);
      const Lw = 70 * ext;
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        pts.push([s * Lw + (1 - ext) * -s * 22, (1 - ext) * -s * 26 + Math.sin(s * 9 - k * 1.3) * (k < 6 ? 1.4 : 0.7) * s]);
      }
    } else if (st === 'whip_rec') {
      const r = Math.min(1, k / 16);
      const Lw = 70 * (1 - r * 0.5);
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        pts.push([s * Lw * (1 - r * 0.25), s * s * 26 * r + Math.sin(s * 6) * r]);
      }
    }
    return pts;
  }
  function drawWhip(ctx, ox, oy, f, pts, flash) {
    if (pts.length < 2) return;
    const col = flash ? '#ffffff' : '#e8d090', mid = flash ? '#ffffff' : '#c8a050';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
        const th = i < pts.length * 0.3 ? 2 : 1;
        for (let j = 0; j <= n; j++) {
          const x = Math.round(ox + f * (a[0] + ((b[0] - a[0]) * j) / n)), y = Math.round(oy + a[1] + ((b[1] - a[1]) * j) / n);
          if (pass === 0) {
            ctx.fillStyle = OUT;
            ctx.fillRect(x - 1, y - 1, th + 2, th + 2);
          } else {
            ctx.fillStyle = (i + j) % 5 === 0 ? mid : col;
            ctx.fillRect(x, y, th, th);
          }
        }
      }
    }
  }
  const DAGPAL = ['#e8f4f8', '#a8c0cc', '#5a7684', '#d4a84a', '#8a6a2a'];
  const daggerImg = (step) =>
    rotImg('sdagger', 17, DAGPAL, 16, step, (c) => {
      c.fillStyle = '#a8c0cc';
      c.beginPath();
      c.moveTo(7, 0);
      c.lineTo(-1, -1.6);
      c.lineTo(-1, 1.6);
      c.fill();
      c.fillStyle = '#e8f4f8';
      c.fillRect(-1, -0.5, 7, 1);
      c.fillStyle = '#d4a84a';
      c.fillRect(-2, -2.5, 1.2, 5);
      c.fillStyle = '#8a6a2a';
      c.fillRect(-5, -0.8, 3, 1.6);
    });
  function daggerDraw(p, ctx, sx, sy) {
    glow(ctx, sx, sy, 7, '#7ad8e8', 0.3);
    drawCentered(ctx, daggerImg(angStep(Math.atan2(p.vy, p.vx), 16)), sx, sy);
  }
  function daggerUpd(p) {
    if (p.t % 2 === 0) G.fx.particle(p.cx - p.vx, p.cy - p.vy, 0, 0, '#7ad8e8', 10, { glow: true });
  }
  function shadeThrow(e, down) {
    const f = e.facing, pl = e.player;
    const hx = e.cx + f * 17, hy = e.fy - 30;
    let a = 0;
    if (down) a = Math.atan2(U.clamp(pl.cy - hy, 10, 120), Math.abs(pl.cx - hx) + 20);
    e.shoot({ x: hx, y: hy, vx: Math.cos(a) * 4.6 * f, vy: Math.sin(a) * 4.6, w: 10, h: 5, life: 110, dmg: Math.round(e.atk * 0.85), el: 'cut', color: '#a8c0cc', drawFn: daggerDraw, upd: daggerUpd });
    sfx('projectile', 0.6, 1.3);
  }

  G.defEnemy('hunter_shade', {
    name: N('Hunter’s Shade', 'Sombra del cazador'),
    desc: N(
      'The echo of a Belmont whose story was never finished. It still fights the night as it did in life, and cannot tell a dhampir from the monsters it hunted.',
      'El eco de un Belmont cuya historia nunca se terminó. Aún combate la noche como en vida, y no distingue a un dhampiro de los monstruos que cazaba.'
    ),
    area: 'arc_hunters', hp: 170, atk: 44, def: 6, exp: 95, w: 14, h: 42,
    gold: [40, 180], weak: ['dark'], resist: ['holy'], noBlood: true, blood: '#a8e8f0', stunTime: 5, noDeathFx: true,
    drops: [{ id: 'hunters_lash', p: 0.03 }, { id: 'holy_salt', p: 0.06 }],
    previewState: 'stalk',
    init(e) {
      e.setState('stalk');
      e.cool = 40 + e.rnd.int(0, 30);
      e.jumpCool = 0;
      e.alpha = 0.84;
      e.trail = [];
      e.woke = false;
    },
    ai(e, g) {
      const dx = e.dxp(), adx = Math.abs(dx), dy = e.dyp();
      const aware = adx < 280 && Math.abs(dy) < 110 && e.onScreen(30);
      if (e.jumpCool > 0) e.jumpCool--;
      if (aware && !e.woke) {
        e.woke = true;
        sfx('ghost_wail', 0.35, 0.9);
      }
      switch (e.state) {
        case 'stalk': {
          if (!aware) {
            e.vx *= 0.8;
            break;
          }
          e.face();
          e.cool--;
          if (adx < 42 && e.onGround && e.jumpCool <= 0 && Math.abs(dy) < 40) {
            e.setState('backjump');
            break;
          }
          if (e.cool <= 0 && adx < 84 && Math.abs(dy) < 36) {
            e.setState('whip_wind');
            sfx('whip', 0.25, 0.6);
            break;
          }
          if (e.cool <= 0 && adx > 110 && adx < 250 && Math.abs(dy) < 64 && e.rnd.chance(0.04)) {
            e.setState('throw_wind');
            break;
          }
          const want = adx > 72 ? e.facing * 0.8 : adx < 52 ? -e.facing * 0.5 : 0;
          const bl = P.blockedAhead(g.room, e, U.sign(want) || e.facing);
          e.vx = bl.wall || bl.ledge ? 0 : want;
          break;
        }
        case 'whip_wind':
          // telegraph (12 frames): arm raised back, the whip trailing over the shoulder
          e.vx = 0;
          if (e.stT >= 12) {
            e.setState('whip_lash');
          }
          break;
        case 'whip_lash': {
          e.vx = 0;
          const f = e.facing, hand = SHADE_HAND('lash');
          const hx = e.cx + f * hand[0], hy = e.fy + hand[1];
          if (e.stT === 3) {
            sfx('whip', 0.8);
            G.fx.spark(hx + f * 70, hy, '#fff0b0', 6);
          }
          if (e.stT >= 3 && e.stT <= 9 && overlapsPlayer(e, { x: f > 0 ? hx : hx - 70, y: hy - 5, w: 70, h: 10 })) e.hurtPlayer(e.atk, 'holy');
          if (e.stT >= 10) e.setState('whip_rec');
          break;
        }
        case 'whip_rec':
          e.vx = 0;
          if (e.stT >= 16) {
            e.cool = 40 + e.rnd.int(0, 40);
            if (adx < 56 && e.jumpCool <= 0) e.setState('backjump');
            else e.setState('stalk');
          }
          break;
        case 'throw_wind':
          e.vx = 0;
          e.face();
          if (e.stT >= 14) {
            shadeThrow(e, false);
            e.setState('throw');
          }
          break;
        case 'throw':
          e.vx = 0;
          if (e.stT >= 12) {
            e.setState('stalk');
            e.cool = 50 + e.rnd.int(0, 40);
          }
          break;
        case 'backjump':
          if (e.stT === 1) {
            e.face();
            const bl = P.blockedAhead(g.room, e, -e.facing);
            e.vx = bl.wall ? 0 : -e.facing * 2.5;
            e.vy = -4.6;
            e.onGround = false;
            e.jumpCool = 70;
            e.didThrow = false;
            sfx('whip', 0.2, 1.8);
          }
          if (e.stT === 12 && !e.didThrow && e.rnd.chance(0.65)) {
            e.didThrow = true;
            shadeThrow(e, true);
          }
          if (e.stT > 3 && e.onGround) {
            e.vx = 0;
            e.setState('land');
            G.fx.dust(e.cx, e.fy, 3);
          }
          break;
        case 'land':
          e.vx = 0;
          if (e.stT >= 10) {
            e.setState('stalk');
            e.cool = Math.min(e.cool, 30);
          }
          break;
      }
      // spectral flicker and afterimages
      e.alpha = 0.84 + Math.sin(e.t * 0.13) * 0.05 + (e.rnd.chance(0.04) ? -0.18 : 0);
      if (e.state === 'backjump' && e.t % 3 === 0) {
        e.trail.push({ x: e.cx, y: e.fy, f: e.facing });
        if (e.trail.length > 3) e.trail.shift();
      } else if (e.trail.length && e.t % 4 === 0) e.trail.shift();
      if (e.t % 6 === 0 && e.onScreen()) wisp(e.cx + U.rnd(-6, 6), e.fy - U.rnd(0, 12), '#7ad8e8');
      e.move();
    },
    draw(e, ctx, sx, sy) {
      let pose = 'stand', f = 0;
      switch (e.state) {
        case 'stalk':
          if (Math.abs(e.vx) > 0.1) {
            pose = 'walk';
            f = Math.floor(e.t / 8) % 4;
          }
          break;
        case 'whip_wind': pose = 'wind'; break;
        case 'whip_lash': pose = 'lash'; break;
        case 'whip_rec': pose = e.stT < 10 ? 'rec' : 'stand'; break;
        case 'throw_wind': pose = 'throwW'; break;
        case 'throw': pose = e.stT < 7 ? 'throw' : 'stand'; break;
        case 'backjump': pose = 'air'; break;
        case 'land': pose = 'land'; break;
      }
      const img = shadeImg(pose, f);
      // afterimages
      if (e.trail && e.trail.length && !e.preview) {
        const a0 = ctx.globalAlpha;
        e.trail.forEach((p, i) => {
          ctx.globalAlpha = a0 * 0.18 * (i + 1);
          gfx.drawAnchored(img, sx + (p.x - e.cx), sy + (p.y - e.fy), 31, 61, p.f < 0, null, ctx);
        });
        ctx.globalAlpha = a0;
      }
      glow(ctx, sx, sy - 22, 28, '#7ad8e8', 0.16);
      e.blit(ctx, img, sx, sy, 31, 61, e.facing < 0);
      if (e.state === 'whip_wind' || e.state === 'whip_lash' || e.state === 'whip_rec') {
        const pp = e.state === 'whip_wind' ? 'wind' : e.state === 'whip_lash' ? 'lash' : 'rec';
        const hand = SHADE_HAND(pp), fx = e.facing;
        const hx = sx + fx * hand[0], hy = sy + hand[1];
        drawWhip(ctx, hx, hy, fx, whipPoints(e), e._flashDraw);
        if (e.state === 'whip_wind') glow(ctx, hx, hy, 8, '#fff0b0', 0.3 + 0.25 * Math.sin(e.stT * 0.8));
        if (e.state === 'whip_lash' && e.stT >= 3 && e.stT <= 6) {
          glow(ctx, hx + fx * 70, hy, 12, '#fff0b0', 0.6);
          gfx.addLight(hx + fx * 70, hy, 40, '#fff0b0', 0.8);
        }
      }
      gfx.addLight(sx, sy - 24, 54, '#7ad8e8', 0.5);
    },
    onDeath(e) {
      for (let i = 0; i < 22; i++) wisp(e.cx + U.rnd(-8, 8), e.cy + U.rnd(-20, 18), i % 3 ? '#7ad8e8' : '#e4f4f4', 1.6);
      G.fx.burst(e.cx, e.cy, '#a6d0d8', 16, 1.8);
      G.fx.ring(e.cx, e.fy - 2, '#7ad8e8');
      sfx('ghost_wail', 0.7, 0.7);
      sfx('enemy_die_big', 0.7);
    },
  });

  // ==================================================================== VAULT HORROR
  const HOR_PAL = [INK.k0, INK.k1, INK.k2, INK.k3, INK.k4, INK.k5, '#f0e8d8', '#c9bfa8', '#e05030', '#e8c040', '#7a1a10', '#07050b', '#f6f2e8', '#d2cabb', '#8a7e64'];
  // [x, y, r, iris, blink phase]
  const HOR_EYES = [[-14, -20, 3.4, '#e05030', 0], [1, -26, 4.3, '#e8c040', 1], [15, -21, 2.8, '#e05030', 2], [-4, -15, 2.3, '#e8c040', 3],
    [20, -28, 2, '#e05030', 4], [-22, -12, 2.1, '#e8c040', 2], [-9, -28, 1.9, '#e8c040', 3], [9, -32, 1.7, '#e05030', 0]];
  function horEye(c, x, y, r, iris, open) {
    if (!open) {
      // a shut lid bulging out of the ink
      gfx.ellipse(c, x, y, r + 0.4, r * 0.72, 0, INK.k2);
      gfx.ellipse(c, x, y - r * 0.3, r * 0.75, r * 0.3, 0, INK.k3);
      c.fillStyle = INK.k0;
      c.fillRect(Math.round(x - r), Math.round(y + r * 0.25), Math.max(2, Math.round(r * 2)), 1);
      return;
    }
    gfx.circle(c, x, y, r + 0.9, INK.k0);
    gfx.circle(c, x, y, r, '#f0e8d8');
    gfx.circle(c, x, y + r * 0.35, r, '#c9bfa8');
    gfx.circle(c, x, y - 0.2, r * 0.92, '#f0e8d8');
    gfx.circle(c, x + r * 0.28, y + 0.1, r * 0.58, iris);
    c.fillStyle = '#07050b';
    c.fillRect(Math.round(x + r * 0.28), Math.round(y - r * 0.32), 1, Math.max(1, Math.round(r * 0.75)));
  }
  // a tentacle that curls harder towards its tip
  function horTent(c, x, y, a, len, curl, r0) {
    const pts = [];
    const n = Math.ceil(len / 1.6);
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      pts.push([x, y, r0 * (1 - s * 0.82) + 0.45]);
      x += Math.cos(a) * 1.6;
      y += Math.sin(a) * 1.6;
      a += curl * (0.4 + s * 2.4);
    }
    pts.forEach((p) => gfx.circle(c, p[0], p[1], p[2], INK.k1));
    pts.forEach((p, i) => {
      if (i % 2 === 0 && i < n - 2) gfx.circle(c, p[0] - p[2] * 0.3, p[1] - p[2] * 0.35, p[2] * 0.42, INK.k3);
    });
    c.fillStyle = INK.k4;
    pts.forEach((p, i) => {
      if (i % 3 === 1 && i > 2 && i < n - 1) c.fillRect(Math.round(p[0] + Math.sign(curl || 1) * p[2] * 0.55), Math.round(p[1] + p[2] * 0.3), 1, 1);
    });
  }
  // pose: crawl (f 0..3) | wind (f 0..1) | spawn (f 0..1) | drop
  function horrorImg(pose, f) {
    return spr('horror_' + pose + f, 90, 72, HOR_PAL, (c) => {
      c.translate(45, 68);
      const ph = (f / 4) * TAU, u = Math.sin(ph), v = Math.cos(ph);
      const rise = pose === 'wind' ? 3 + f * 2 : pose === 'spawn' ? 4 + f * 3 : pose === 'drop' ? 2 : 0;
      const mouth = pose === 'spawn' ? 1 : pose === 'wind' ? 0.6 : 0.3 + 0.12 * u;
      // tentacles behind the mass
      horTent(c, -19, -17 - rise, -2.35 + u * 0.12, 30, 0.055 + v * 0.02, 4.6);
      horTent(c, 3, -28 - rise, -1.72 + v * 0.12, 26, -0.065 + u * 0.02, 4);
      horTent(c, 17, -21 - rise, -1.0 - u * 0.1, 24, -0.08 - v * 0.02, 3.8);
      if (pose !== 'wind') horTent(c, -8, -26 - rise, -2.2 + v * 0.1, 20, 0.07 + u * 0.03, 3.2);
      // puddle and body
      gfx.ellipse(c, 0, -3, 33, 4.5, 0, INK.k1);
      gfx.ellipse(c, 0, -15 - rise * 0.5, 26, 13 + rise * 0.5, 0, INK.k1);
      gfx.ellipse(c, -13 + u, -19 - rise * 0.6, 12, 10, 0, INK.k2);
      gfx.ellipse(c, 10 - u, -22 - rise, 12, 10, 0, INK.k2);
      gfx.ellipse(c, -2 + v, -27 - rise, 10, 7, 0, INK.k2);
      gfx.ellipse(c, -4 + v, -31 - rise, 6, 2.4, -0.2, INK.k3);
      gfx.ellipse(c, -16 + u, -25 - rise * 0.6, 4, 1.8, -0.5, INK.k3);
      gfx.ellipse(c, 12 - u, -28 - rise, 4.5, 2, 0.3, INK.k3);
      c.fillStyle = INK.k5;
      c.fillRect(Math.round(-6 + v), Math.round(-32 - rise), 2, 1);
      c.fillRect(Math.round(-18 + u), Math.round(-26 - rise * 0.6), 1, 1);
      c.fillRect(Math.round(10 - u), Math.round(-29 - rise), 2, 1);
      // half-digested pages
      c.save();
      c.translate(-19, -8);
      c.rotate(-0.4);
      c.fillStyle = '#d2cabb';
      c.fillRect(-3, -4, 7, 8);
      c.fillStyle = '#8a7e64';
      c.fillRect(-2, -2, 4, 1);
      c.fillRect(-2, 0, 5, 1);
      c.restore();
      gfx.ellipse(c, -17, -5, 5, 2.5, 0, INK.k1);
      c.save();
      c.translate(6, -33 - rise);
      c.rotate(0.5);
      c.fillStyle = '#f6f2e8';
      c.fillRect(-2, -3, 5, 6);
      c.restore();
      gfx.ellipse(c, 7, -31 - rise, 4, 2, 0.3, INK.k2);
      // the maw, ringed with paper teeth
      const mx = 17, my = -11 - rise * 0.3, mw = 9, mh = 1.5 + mouth * 4;
      gfx.ellipse(c, mx, my, mw + 1, mh + 1, 0.08, INK.k0);
      gfx.ellipse(c, mx, my + 0.5, mw - 1, Math.max(0.6, mh - 1), 0.08, '#7a1a10');
      for (let i = 0; i < 5; i++) {
        const tx = mx - mw + 2 + i * 3.6;
        gfx.poly(c, [tx - 1.4, my - mh, tx, my - mh + 2.6 + (i % 2), tx + 1.4, my - mh], '#f6f2e8');
        gfx.poly(c, [tx + 0.4, my + mh, tx + 1.8, my + mh - 2.4 - (i % 2), tx + 3.2, my + mh], '#d2cabb');
      }
      // many eyes, each blinking on its own beat
      for (const [ex, ey, r, iris, bp] of HOR_EYES) {
        const open = pose === 'spawn' || pose === 'wind' || pose === 'drop' ? true : (f + bp) % 5 !== 0;
        horEye(c, ex + (ex < 0 ? u * 0.6 : -u * 0.6), ey - rise * (ey < -20 ? 1 : 0.5), r, iris, open);
      }
      // drips under the rim
      c.fillStyle = INK.k0;
      c.fillRect(-26, -3, 2, 3);
      c.fillRect(-9, -2, 2, 3);
      c.fillRect(23, -3, 2, 3);
    });
  }
  // the slam tentacle, rasterised every frame (body anchor → tip)
  function slamTentacle(ctx, bx, by, tx, ty, flash) {
    const cx = (bx + tx) / 2, cy = Math.min(by, ty) - 26;
    const n = 26, pts = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      pts.push([(1 - s) * (1 - s) * bx + 2 * (1 - s) * s * cx + s * s * tx, (1 - s) * (1 - s) * by + 2 * (1 - s) * s * cy + s * s * ty, 5.6 - s * 3.2]);
    }
    pts.forEach((p) => pdisc(ctx, p[0], p[1], p[2] + 1, OUT));
    pts.forEach((p) => pdisc(ctx, p[0], p[1], p[2], flash ? '#ffffff' : INK.k1));
    pts.forEach((p, i) => {
      if (i % 2 === 0) pdisc(ctx, p[0] - 1, p[1] - 1, p[2] * 0.45, flash ? '#ffffff' : INK.k3);
      if (i % 4 === 1 && i < n - 2) {
        ctx.fillStyle = flash ? '#ffffff' : INK.k4;
        ctx.fillRect(Math.round(p[0] + p[2] * 0.5), Math.round(p[1] + p[2] * 0.4), 1, 1);
      }
    });
    // a hooked claw of hardened ink at the tip
    const t = pts[n];
    ctx.fillStyle = flash ? '#ffffff' : '#d2cabb';
    ctx.fillRect(Math.round(t[0]) - 1, Math.round(t[1]) + 1, 3, 2);
    ctx.fillRect(Math.round(t[0]), Math.round(t[1]) + 3, 1, 2);
  }
  function horrorBox() {
    if (this.mode === 'wall' || this.mode === 'pull') return { x: this.ws > 0 ? this.x + this.w - 30 : this.x, y: this.cy - 25, w: 30, h: 50 };
    return { x: this.cx - 23, y: this.fy - 30, w: 46, h: 30 };
  }
  function horrorDroplets(e, g) {
    let mine = 0, all = 0;
    for (const x of g.ents) {
      if (x.id !== 'ink_droplet' || x.dead) continue;
      all++;
      if (x.owner === e) mine++;
    }
    return all >= 6 ? 99 : mine;
  }
  function horrorClimb(e, dir) {
    e.mode = 'wall';
    e.ws = dir;
    const wx = Math.floor((dir > 0 ? e.x + e.w + 2 : e.x - 2) / 16);
    e.x = dir > 0 ? wx * 16 - e.w : (wx + 1) * 16;
    e.vx = 0;
    e.vy = 0;
    e.ceilT = 0;
    e.setState('climb');
    inkSplash(e.cx + dir * 14, e.fy - 6, 5, 1);
    sfx('slime', 0.5, 0.8);
  }
  function horrorRelease(e) {
    e.mode = 'floor';
    e.vx = -e.ws * 0.6;
    e.vy = 0;
    e.onGround = false;
    e.setState('fall');
  }
  function horrorPullOver(e, g) {
    const r = g.room, ws = e.ws;
    const wallX = ws > 0 ? e.x + e.w + 1 : e.x - 1;
    let ty = Math.floor((e.y + 3) / 16);
    for (let i = 0; i < 4 && !P.solidAt(r, wallX, ty * 16 + 1); i++) ty++;
    const top = ty * 16;
    const tcol = Math.floor(wallX / 16) * 16;
    const nx = ws > 0 ? tcol + 2 : tcol + 14 - e.w;
    const ny = top - e.h;
    if (P.rectSolid(r, nx, ny, e.w, e.h)) return false;
    // heave itself over the edge along a short arc (see 'pull' in ai)
    e.pull = { x0: e.x, y0: e.y, x1: nx, y1: ny };
    e.mode = 'pull';
    e.vx = 0;
    e.vy = 0;
    e.facing = ws;
    e.setState('pull');
    inkSplash(e.cx + ws * 12, top, 6, 1.2);
    sfx('slime', 0.5, 0.9);
    return true;
  }
  function horrorSlam(e, g) {
    // pick the target (where the player stands now) and the floor under it
    const pl = e.player, r = g.room;
    const tx = U.clamp(pl.cx, e.cx - 92, e.cx + 92);
    let gy = null;
    for (let y = e.fy - 40; y < e.fy + 64; y += 2) {
      if (P.floorAt(r, tx, y) || P.solidAt(r, tx, y)) {
        gy = Math.floor(y / 16) * 16;
        if (P.isSlope && P.isSlope(r.get(Math.floor(tx / 16), Math.floor(y / 16)))) gy = y;
        break;
      }
    }
    if (gy == null || !P.los(r, e.cx, e.fy - 20, tx, gy - 30)) return false;
    e.slamX = tx;
    e.slamY = gy;
    e.facing = tx < e.cx ? -1 : 1;
    e.setState('slam_wind');
    sfx('slime', 0.8, 0.5);
    return true;
  }

  G.defEnemy('vault_horror', {
    name: N('Vault Horror', 'Horror de la cripta'),
    desc: N(
      'Every book the Belmonts sealed away bled into this. It watches through the eyes of all who tried to read them.',
      'Cada libro que los Belmont sellaron sangró hasta formar esto. Observa a través de los ojos de todos los que intentaron leerlos.'
    ),
    area: 'arc_vault', hp: 200, atk: 52, def: 8, exp: 120, w: 32, h: 30, heavy: true,
    gold: [40, 220], absorb: ['dark'], weak: ['holy', 'fire'], el: 'dark', blood: '#3f2c63', hitSfx: 'slime', noDeathFx: true,
    drops: [{ id: 'scrivener_eye', p: 0.01 }, { id: 'elixir', p: 0.03 }, { id: 'blood_ink', p: 0.06 }],
    previewState: 'crawl',
    init(e) {
      e.setState('crawl');
      e.mode = 'floor';
      e.ws = 1;
      e.cool = 80 + e.rnd.int(0, 40);
      e.spawnCool = 150 + e.rnd.int(0, 120);
      e.climbCool = 0;
      e.slamX = e.cx;
      e.slamY = e.fy;
      e.hurtbox = horrorBox;
    },
    ai(e, g) {
      const pl = e.player, dx = e.dxp(), dy = e.dyp();
      const aware = Math.abs(dx) < 300 && Math.abs(dy) < 180 && e.onScreen(48);
      if (e.climbCool > 0) e.climbCool--;
      if (aware && e.t % 110 === 0) sfx('slime', 0.3, 0.55);
      if (e.t % 8 === 0 && e.onScreen()) {
        const hb = e.hurtbox();
        inkDrop(hb.x + Math.random() * hb.w, hb.y + hb.h * (0.5 + Math.random() * 0.4), 0, 0.2, 30);
      }
      if (e.mode === 'pull') {
        const k = Math.min(1, e.stT / 14), q = e.pull;
        e.x = U.lerp(q.x0, q.x1, U.ease.inOut(k));
        e.y = U.lerp(q.y0, q.y1, k) - Math.sin(k * Math.PI) * 7;
        if (k >= 1) {
          e.x = q.x1;
          e.y = q.y1;
          e.mode = 'floor';
          e.onGround = true;
          e.climbCool = 120;
          e.setState('crawl');
          inkSplash(e.cx, e.fy, 6, 1.2);
        }
        return;
      }
      if (e.mode === 'wall') {
        // ---- clinging to a wall
        const r = g.room, ws = e.ws;
        const wallX = ws > 0 ? e.x + e.w + 1 : e.x - 1;
        e.vx = 0;
        if (e.state === 'climb') {
          const up = aware && pl.fy < e.fy - 6;
          e.vy = up ? -0.7 : 0.75;
          if (aware && Math.abs(dx) < 46 && pl.y > e.fy - 8) {
            e.setState('drop_wind');
            sfx('slime', 0.7, 0.7);
            e.vy = 0;
          }
        } else if (e.state === 'drop_wind') {
          e.vy = 0;
          if (e.stT % 3 === 0) inkDrop(e.cx + U.rnd(-8, 8), e.fy, 0, 1);
          if (e.stT >= 18) {
            horrorRelease(e);
            return;
          }
        }
        const ny = e.y + e.vy;
        if (e.vy < 0 && P.rectSolid(r, e.x, ny, e.w, 1)) {
          e.vy = 0;
          if (++e.ceilT > 50) horrorRelease(e);
        } else e.y = ny;
        if (e.mode !== 'wall') return;
        const topWall = P.solidAt(r, wallX, e.y + 3), botWall = P.solidAt(r, wallX, e.y + e.h - 3);
        if (!topWall && e.vy <= 0) {
          if (!horrorPullOver(e, g)) horrorRelease(e);
        } else if (!topWall && !botWall) horrorRelease(e);
        else if (e.vy > 0 && P.rectSolid(r, e.x, e.y + e.h, e.w, 1)) {
          e.mode = 'floor';
          e.onGround = true;
          e.climbCool = 150;
          e.setState('crawl');
        }
        return;
      }
      // ---- on the floor
      switch (e.state) {
        case 'crawl': {
          if (aware && Math.abs(dx) > 12 && e.stT % 20 === 0) e.face();
          e.vx = e.facing * (aware ? 0.68 : 0.32) * (0.75 + 0.25 * Math.sin(e.t * 0.12));
          const bl = P.blockedAhead(g.room, e, e.facing);
          if (bl.wall) {
            e.vx = 0;
            if (aware && dy < -28 && e.climbCool <= 0 && e.onGround) {
              horrorClimb(e, e.facing);
              break;
            }
            if (!aware && e.stT > 60) {
              e.facing *= -1;
              e.stT = 0;
            }
          } else if (bl.ledge && !(aware && dy > 40)) {
            e.vx = 0;
            if (!aware && e.stT > 60) {
              e.facing *= -1;
              e.stT = 0;
            }
          }
          if (aware) {
            e.cool--;
            e.spawnCool--;
          }
          if (e.onGround) {
            if (e.spawnCool <= 0 && horrorDroplets(e, g) < 4) {
              e.setState('spawn');
              sfx('slime', 0.8, 0.6);
            } else if (e.cool <= 0 && Math.abs(dx) < 100 && dy > -70 && dy < 40) {
              if (!horrorSlam(e, g)) e.cool = 30;
            }
          }
          break;
        }
        case 'slam_wind':
          // telegraph: one tentacle rears high over the target, ink boils under it
          e.vx = 0;
          if (e.stT % 3 === 0) inkDrop(e.slamX + U.rnd(-7, 7), e.slamY - 1, U.rnd(-0.3, 0.3), -U.rnd(0.6, 1.6), 24);
          if (e.stT >= 34) {
            e.setState('slam');
            sfx('whip', 0.6, 0.5);
          }
          break;
        case 'slam':
          e.vx = 0;
          if (e.stT === 4) {
            gfx.shake(3, 12);
            sfx('stomp', 0.9, 0.7);
            sfx('ink_splash', 0.9, 0.8);
            inkSplash(e.slamX, e.slamY - 1, 18, 2.6);
          }
          if (e.stT >= 3 && e.stT <= 11 && overlapsPlayer(e, { x: e.slamX - 9, y: e.slamY - 60, w: 18, h: 60 })) e.hurtPlayer(Math.round(e.atk * 1.15), 'hit');
          if (e.stT >= 12) e.setState('slam_rec');
          break;
        case 'slam_rec':
          e.vx = 0;
          if (e.stT >= 24) {
            e.setState('crawl');
            e.cool = 100 + e.rnd.int(0, 60);
          }
          break;
        case 'spawn':
          // the mass swells and spits out two droplets
          e.vx = 0;
          if (e.stT === 22) {
            // two droplets, never more than four of its own alive at once
            const room = 4 - horrorDroplets(e, g);
            for (const s of [-1, 1].slice(0, Math.max(0, Math.min(2, room)))) {
              const d = spawnDroplet(g, e.cx + s * 8, e.fy - 4, s * U.rnd(1.4, 2.2), -U.rnd(3.6, 4.6), { noExp: true, noDrops: true });
              if (d) d.owner = e;
            }
            sfx('ink_splash', 0.8, 1.1);
            inkSplash(e.cx, e.y + 6, 10, 1.8);
          }
          if (e.stT >= 32) {
            e.setState('crawl');
            e.spawnCool = 300 + e.rnd.int(0, 60);
          }
          break;
        case 'fall':
          if (e.onGround && e.stT > 2) {
            e.vx = 0;
            e.setState('land');
            gfx.shake(2, 10);
            sfx('ink_splash', 0.9, 0.7);
            inkSplash(e.cx, e.fy - 1, 16, 2.4);
            e.climbCool = 150;
          }
          break;
        case 'land':
          e.vx = 0;
          if (e.stT >= 18) e.setState('crawl');
          break;
        default:
          e.setState('crawl');
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      let pose = 'crawl', f = Math.floor(e.t / 9) % 4;
      switch (e.state) {
        case 'slam_wind': pose = 'wind'; f = e.stT > 18 ? 1 : 0; break;
        case 'slam':
        case 'slam_rec': pose = 'wind'; f = 1; break;
        case 'spawn': pose = 'spawn'; f = e.stT > 14 ? 1 : 0; break;
        case 'drop_wind':
        case 'fall':
        case 'land': pose = 'drop'; f = 0; break;
      }
      if (e.preview) pose = 'crawl';
      const img = horrorImg(pose, f);
      if (e.mode === 'pull' && !e.preview) {
        // rotate from the wall back onto the floor while heaving over the edge
        const k = Math.min(1, e.stT / 14);
        ctx.save();
        ctx.translate(Math.round(sx), Math.round(sy - e.h / 2));
        ctx.rotate((e.facing > 0 ? -Math.PI / 2 : Math.PI / 2) * (1 - U.ease.inOut(k)));
        e.blit(ctx, img, 0, 0, 45, 53, e.facing < 0);
        ctx.restore();
        gfx.addLight(sx, sy - e.h / 2, 46, '#b48cff', 0.35);
        return;
      }
      if (e.mode === 'wall' && !e.preview) {
        const ax = e.ws > 0 ? sx + e.w / 2 : sx - e.w / 2, ay = sy - e.h / 2;
        const up = e.vy <= 0;
        const jx = e.state === 'drop_wind' && e.stT % 4 < 2 ? 1 : 0;
        ctx.save();
        ctx.translate(Math.round(ax) - e.ws * jx, Math.round(ay));
        ctx.rotate(e.ws > 0 ? -Math.PI / 2 : Math.PI / 2);
        e.blit(ctx, img, 0, 0, 45, 68, e.ws > 0 ? !up : up);
        ctx.restore();
        gfx.addLight(sx, sy - e.h / 2, 46, '#b48cff', 0.35);
        return;
      }
      e.blit(ctx, img, sx, sy, 45, 68, e.facing < 0);
      // the slam tentacle
      if (!e.preview && (e.state === 'slam_wind' || e.state === 'slam' || e.state === 'slam_rec')) {
        const f2 = e.facing;
        const bx = sx + f2 * 4, by = sy - 30;
        const gx = sx + (e.slamX - e.cx), gyy = sy + (e.slamY - e.fy);
        let tx = gx, ty;
        if (e.state === 'slam_wind') {
          const k = Math.min(1, e.stT / 16);
          tx = U.lerp(bx, gx, k) + Math.sin(e.t * 0.4) * 2;
          ty = U.lerp(by - 10, gyy - 70, k) + Math.sin(e.t * 0.3) * 3;
          glow(ctx, gx, gyy - 2, 16, '#b48cff', 0.18 + 0.12 * Math.sin(e.t * 0.5));
        } else if (e.state === 'slam') {
          const k = Math.min(1, e.stT / 4);
          ty = U.lerp(gyy - 70, gyy - 4, k * k);
        } else {
          const k = Math.min(1, e.stT / 20);
          tx = U.lerp(gx, bx, k);
          ty = U.lerp(gyy - 4, by - 6, k);
        }
        slamTentacle(ctx, bx, by, tx, ty, e._flashDraw);
        if (e.state === 'slam' && e.stT >= 4 && e.stT < 9) gfx.addLight(gx, gyy - 4, 40, '#b48cff', 0.7);
      }
      gfx.addLight(sx, sy - 18, 52, '#b48cff', 0.35);
    },
    onHit(e, hit) {
      inkSplash(e.cx, e.cy, 6, 1.8);
      if (hit.el === 'fire') embers(e.cx, e.cy, 10);
      if (hit.el === 'holy') G.fx.burst(e.cx, e.cy, '#fff4c0', 8, 1.6, { glow: true });
    },
    onDeath(e, g) {
      inkSplash(e.cx, e.fy - 6, 40, 3.2);
      G.fx.burst(e.cx, e.cy, INK.k4, 18, 2.2);
      for (let i = 0; i < 8; i++) G.fx.particle(e.cx + U.rnd(-16, 16), e.cy + U.rnd(-10, 6), U.rnd(-1.5, 1.5), U.rnd(-3, -1), '#f0e8d8', 40, { grav: 0.15, size: 2 });
      gfx.shake(4, 16);
      sfx('ink_splash', 1, 0.6);
      sfx('enemy_die_big', 0.9, 0.8);
      // its droplets dissolve with it
      for (const x of g.ents) if (x.id === 'ink_droplet' && x.owner === e && !x.dead) g.later(10 + U.irnd(0, 20), () => x.dead || x.die(g));
    },
  });
})();
