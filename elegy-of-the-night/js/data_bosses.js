/* Elegy of the Night — data_bosses.js
 * The six bosses (AI + procedural pixel art). See enemy_base.js for the API.
 *
 *   colossus   Bone Colossus        gal_boss      → Leap Stone
 *   doppel     Ink Doppelganger     stk_doppel    → Soul of Wolf
 *   echo       Echo of the Belmont  hun_echo      → scene echo_post (Crest + Page I)
 *   biblio     Bibliophage          vault_worm    → Page II + Blood Ink
 *   seraph     Clockwork Seraph     clk_top       → Page III + Hourglass Pin
 *   scrivener  The Scrivener        keep_throne   → scene ending
 *
 * Every boss is a state machine (e.state / e.stT) with telegraphed attacks,
 * a phase change around half HP and a long death sequence: the killing blow
 * puts the boss in a 'dying' state (kept alive and invulnerable while it
 * explodes), and only then e.die() runs the engine's reward logic.
 * Art: large sprites are composed from cached parts (gfx.sprite), rotating
 * parts are pre-rendered at quantised angles so they stay crisp pixel art.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, P = G.phys, gfx = G.gfx;
  const N = (en, es) => ({ en, es });
  const OUT = '#07050b';
  const TAU = Math.PI * 2;

  // =====================================================================================
  //  Shared boss kit
  // =====================================================================================
  const sfx = (n, o) => G.audio && G.audio.sfx(n, o);
  function spr(key, w, h, pal, fn, thr) {
    return gfx.sprite('boss_' + key, w, h, fn, { palette: pal, outline: OUT, threshold: thr || 100 });
  }
  // angle-quantised sprite: fn draws the part pointing along +x around (0,0)
  function rspr(key, n, ang, w, h, pal, fn) {
    const i = ((Math.round((ang / TAU) * n) % n) + n) % n;
    return spr(key + '@' + i, w, h, pal, (c) => {
      c.translate(w / 2, h / 2);
      c.rotate((i / n) * TAU);
      fn(c);
    });
  }
  // draw a sprite (honours the boss hit flash); anchor defaults to the centre
  function put(e, ctx, img, x, y, ax, ay, flip) {
    if (!img) return;
    if (e && e._flashDraw) img = gfx.whiteOf(img);
    gfx.drawAnchored(img, x, y, ax == null ? img.width / 2 : ax, ay == null ? img.height / 2 : ay, flip, null, ctx);
  }
  function lit(e, ctx, x, y, r, col, i) {
    if (!(e && e.preview) && ctx === gfx.ctx) gfx.addLight(x, y, r, col, i);
  }
  const ease = (t) => U.ease.inOut(U.clamp(t, 0, 1));
  const eout = (t) => U.ease.out(U.clamp(t, 0, 1));
  const ein = (t) => U.ease.in(U.clamp(t, 0, 1));
  const seg = (t, a, b) => U.clamp((t - a) / (b - a), 0, 1);

  // ---- damage to the player from boss parts -------------------------------------------
  function pHit(e, x, y, w, h, dmg, el, o) {
    const p = e.player;
    if (p.dead) return false;
    const b = p.hurtbox();
    if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) {
      p.hurt(dmg == null ? e.atk : dmg, el || e.def.el || 'hit', x + w / 2, o);
      return true;
    }
    return false;
  }
  function pHitCircle(e, cx, cy, r, dmg, el, o) {
    const p = e.player;
    if (p.dead) return false;
    const b = p.hurtbox();
    const nx = U.clamp(cx, b.x, b.x + b.w), ny = U.clamp(cy, b.y, b.y + b.h);
    if ((nx - cx) * (nx - cx) + (ny - cy) * (ny - cy) <= r * r) {
      p.hurt(dmg == null ? e.atk : dmg, el || e.def.el || 'hit', cx, o);
      return true;
    }
    return false;
  }
  function pHitLine(e, x1, y1, x2, y2, th, dmg, el, o) {
    const p = e.player;
    if (p.dead) return false;
    const b = p.hurtbox();
    const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 4));
    for (let i = 0; i <= n; i++) {
      const x = x1 + ((x2 - x1) * i) / n, y = y1 + ((y2 - y1) * i) / n;
      if (x > b.x - th && x < b.x + b.w + th && y > b.y - th && y < b.y + b.h + th) {
        p.hurt(dmg == null ? e.atk : dmg, el || e.def.el || 'hit', x, o);
        return true;
      }
    }
    return false;
  }
  const rectsHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ---- non-damaging effect entity (telegraphs, decals, lingering visuals) -------------
  class BossFx extends G.Ent {
    constructor(o) {
      super(Object.assign({ z: 2, life: 60 }, o));
      this.max = this.life;
      if (!this.free) this.team = 'enemy'; // freezes with the Stopwatch like enemy shots
    }
    update(g) {
      this.t++;
      if (this.upd) this.upd(this, g);
      if (--this.life <= 0 && !this.dead) {
        this.dead = true;
        if (this.done) this.done(this, g);
      }
    }
    draw(ctx, camx, camy) {
      if (this.drawFn) this.drawFn(this, ctx, Math.round(this.x - camx), Math.round(this.y - camy));
    }
  }
  function fxEnt(g, o) {
    return g.add(new BossFx(o));
  }
  // remove every shot / telegraph that belongs to the boss
  function clearShots(e, g, burst) {
    for (const o of g.ents)
      if (!o.dead && o !== e && o.owner === e && !o.keep) {
        o.dead = true;
        if (burst !== false) G.fx.burst(o.cx, o.cy, o.color || '#e0d8ff', 4, 1);
      }
  }

  // ---- arena geometry (rooms are built by other files: never assume sizes) ------------
  function scanArena(e, g) {
    const room = g.room, T = G.T;
    const tx = U.clamp(Math.floor(e.cx / 16), 1, room.tw - 2);
    let ty = Math.floor((e.spawnY + e.h - 4) / 16);
    // floor: first standable tile at/below the spawn feet
    let fy = ty + 1;
    for (let y = ty; y < room.th; y++) {
      const t = room.get(tx, y);
      if (t === T.SOLID || t === T.ONEWAY || t === T.BREAK || t === T.SEAL || t === T.SPIKES) {
        fy = y;
        break;
      }
    }
    const floor = fy * 16;
    const row = Math.floor((floor - 24) / 16);
    let l = tx, r = tx;
    while (l > 0 && !P.solidFor(room.get(l - 1, row))) l--;
    while (r < room.tw - 1 && !P.solidFor(room.get(r + 1, row))) r++;
    let top = fy - 1;
    while (top > 0 && !P.solidFor(room.get(tx, top - 1))) top--;
    return { floor, left: l * 16, right: (r + 1) * 16, top: top * 16, mid: (l * 16 + (r + 1) * 16) / 2 };
  }
  // standable surfaces (platforms, ledges, daises) as {x0, x1, y, cx}
  function perches(room, minW) {
    const T = G.T, out = [];
    const isTop = (t) => t === T.SOLID || t === T.ONEWAY || t === T.BREAK || t === T.SEAL;
    for (let ty = 3; ty < room.th; ty++) {
      let run = null;
      for (let tx = 0; tx <= room.tw; tx++) {
        let ok = tx < room.tw && isTop(room.get(tx, ty));
        if (ok) for (let k = 1; k <= 3; k++) if (room.get(tx, ty - k) !== T.EMPTY) ok = false;
        if (ok) {
          if (!run) run = { a: tx, b: tx };
          else run.b = tx;
        } else if (run) {
          if (run.b - run.a + 1 >= (minW || 2)) out.push({ x0: run.a * 16, x1: (run.b + 1) * 16, y: ty * 16, cx: (run.a + run.b + 1) * 8 });
          run = null;
        }
      }
    }
    return out;
  }

  // ---- death sequence ---------------------------------------------------------------------
  function startDying(e, g) {
    if (e.dying) return;
    e.dying = true;
    e.hp = 1;
    e.invuln = 1e9;
    e.contact = false;
    e.setState('dying');
    clearShots(e, g);
    g.hitstop = Math.max(g.hitstop, 18);
    gfx.flash('#ffffff', 14);
    gfx.shake(6, 34);
    sfx('explosion', { vol: 0.9, pitch: 0.7 });
  }
  // keep the bar empty and blow up random points of `area` every few frames
  function dyingBlasts(e, g, area, every, cols) {
    e.hp = 0;
    if (e.stT % (every || 7) === 0) {
      const x = area.x + Math.random() * area.w, y = area.y + Math.random() * area.h;
      if (cols) {
        for (let i = 0; i < 14; i++) G.fx.particle(x, y, U.rnd(-2.4, 2.4), U.rnd(-2.6, 1.6), U.pick(cols), 18 + Math.random() * 16, { glow: i % 2 === 0, size: 2, drag: 0.92 });
      } else G.fx.explode(x, y, 0.8 + Math.random() * 0.5);
      sfx('explosion', { vol: 0.45, pitch: U.rnd(0.8, 1.25) });
      gfx.shake(3, 8);
    }
  }
  // finally hand over to the engine (reward, flags, music, doors)
  function finishDying(e, g, x, y) {
    const A = e.A;
    if (A) x = U.clamp(x, A.left + 40, A.right - 40);
    e.w = 24;
    e.h = 40;
    e.x = x - 12;
    e.y = y - 40;
    e.hp = 0;
    e.invuln = 0;
    sfx('boss_die');
    e.die(g);
  }
  // common onHit: intercept the killing blow
  function bossOnHit(e, hit, g) {
    if (e.hp <= 0 && !e.dying) startDying(e, g);
  }
  // phase change helper
  function phaseShift(e, g, col) {
    e.phase = 2;
    clearShots(e, g);
    gfx.flash(col || '#ffffff', 12);
    gfx.shake(5, 30);
    e.invuln = Math.max(e.invuln, 50);
  }
  const wants2 = (e, f) => e.phase === 1 && !e.dying && e.hp <= e.maxHp * (f || 0.5);

  // ---- small drawing helpers ----------------------------------------------------------------
  function glow(ctx, x, y, r, col, a) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, U.rgba(col, a == null ? 0.8 : a));
    gr.addColorStop(1, U.rgba(col, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  // blinking hazard marker (telegraph)
  function warnRect(ctx, x, y, w, h, t, col, strong) {
    const a = (strong ? 0.28 : 0.16) + 0.12 * Math.sin(t * 0.45);
    ctx.fillStyle = U.rgba(col, a);
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    if (t % 8 < 5) {
      ctx.fillStyle = U.rgba(col, 0.75);
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 1);
      ctx.fillRect(Math.round(x), Math.round(y + h - 1), Math.round(w), 1);
    }
  }
  function warnLine(ctx, x1, y1, x2, y2, t, col, w) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 0.5);
    ctx.strokeStyle = col;
    ctx.lineWidth = w || 1;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -t * 0.6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }
  // a 2-bone IK solve: shoulder S, target W, lengths a, b, preferred bend side
  function ik(sx, sy, wx, wy, a, b, prefer) {
    let dx = wx - sx, dy = wy - sy;
    let d = Math.hypot(dx, dy) || 0.001;
    const maxD = a + b - 0.5, minD = Math.abs(a - b) + 2;
    if (d > maxD) {
      wx = sx + (dx / d) * maxD;
      wy = sy + (dy / d) * maxD;
      dx = wx - sx;
      dy = wy - sy;
      d = maxD;
    } else if (d < minD) {
      wx = sx + (dx / d) * minD;
      wy = sy + (dy / d) * minD;
      dx = wx - sx;
      dy = wy - sy;
      d = minD;
    }
    const base = Math.atan2(dy, dx);
    const k = U.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const off = Math.acos(k);
    const e1 = { x: sx + Math.cos(base + off) * a, y: sy + Math.sin(base + off) * a };
    const e2 = { x: sx + Math.cos(base - off) * a, y: sy + Math.sin(base - off) * a };
    const el = prefer(e1) >= prefer(e2) ? e1 : e2;
    return { ex: el.x, ey: el.y, wx, wy };
  }

  // =====================================================================================
  //  1. BONE COLOSSUS  (gal_boss)
  // =====================================================================================
  // A giant front-facing skeleton torso rising out of the marble floor; two huge
  // arms (cached bone parts at 48 angles, solved with IK every frame).
  const CB = { L: '#f2e8cf', M: '#d2c39f', S: '#a8987a', D: '#7a6c55', DD: '#4c4234', K: '#261d16', X: '#120b08', R: '#7c3c22', RL: '#b0603a' };
  const CB_EMBER = ['#ff8a2a', '#ffd25a'], CB_SPECT = ['#9a6aff', '#e4d2ff'];
  const CB_PAL = [CB.L, CB.M, CB.S, CB.D, CB.DD, CB.K, CB.X, CB.R, CB.RL];
  const colPal = (p2) => CB_PAL.concat(p2 ? CB_SPECT : CB_EMBER);
  const COL_L1 = 62, COL_L2 = 58; // humerus, forearm
  const COL_SHX = 42, COL_SHY = -62; // shoulder sockets relative to the floor point

  function boneShape(c, len, w, knob, col, hi, sh) {
    // a long bone along x, centred at 0: shaft + knobby epiphyses
    const h = len / 2;
    gfx.limb(c, -h + knob * 0.6, 0, h - knob * 0.6, 0, w, col);
    gfx.limb(c, -h + knob * 0.6, -w * 0.22, h - knob * 0.6, -w * 0.22, Math.max(1, w * 0.3), hi);
    for (const s of [-1, 1]) {
      gfx.circle(c, s * (h - knob * 0.55), -knob * 0.35, knob * 0.62, col);
      gfx.circle(c, s * (h - knob * 0.55), knob * 0.38, knob * 0.62, col);
      gfx.circle(c, s * (h - knob * 0.5), -knob * 0.45, knob * 0.28, hi);
    }
    c.fillStyle = sh;
    c.fillRect(-h * 0.45, w * 0.18, h * 0.9, Math.max(1, w * 0.22));
  }
  function colHumerus(ang, p2) {
    return rspr('colhum' + (p2 ? 'b' : 'a'), 48, ang, 84, 84, colPal(p2), (c) => {
      boneShape(c, COL_L1 + 6, 11, 15, CB.M, CB.L, CB.S);
      // cracks and a rusted iron band
      gfx.limb(c, -6, -3, 2, 2, 1, CB.DD);
      gfx.limb(c, 2, 2, 6, -1, 1, CB.DD);
      c.fillStyle = CB.R;
      c.fillRect(10, -6, 6, 12);
      c.fillStyle = CB.RL;
      c.fillRect(10, -6, 6, 2);
    });
  }
  function colForearm(ang, p2) {
    return rspr('colfore' + (p2 ? 'b' : 'a'), 48, ang, 80, 80, colPal(p2), (c) => {
      const h = (COL_L2 + 4) / 2;
      // ulna + radius side by side, meeting at the knobs
      gfx.limb(c, -h + 6, -3.2, h - 5, -2.4, 5.2, CB.M);
      gfx.limb(c, -h + 6, 3.4, h - 5, 2.6, 4.4, CB.S);
      gfx.limb(c, -h + 7, -4.6, h - 6, -3.8, 1.3, CB.L);
      gfx.circle(c, -h + 5, 0, 8, CB.M);
      gfx.circle(c, -h + 4, -2.5, 3, CB.L);
      gfx.circle(c, h - 4, 0, 6.2, CB.M);
      gfx.circle(c, h - 5, -2, 2.4, CB.L);
      // gap between the two bones
      gfx.limb(c, -h + 13, 0.4, h - 12, 0.2, 1.4, CB.K);
    });
  }
  // hand: wrist at (0,0), pointing +x. pose: 0 open claw, 1 grip, 2 fist
  function colHand(ang, pose, mirror, p2) {
    return rspr('colhand' + pose + (mirror ? 'm' : '') + (p2 ? 'b' : 'a'), 48, ang, 76, 76, colPal(p2), (c) => {
      if (mirror) c.scale(1, -1);
      // palm (carpals + metacarpals)
      gfx.poly(c, [-2, -8, 12, -11, 16, -2, 15, 9, 4, 10, -3, 6], CB.M);
      gfx.poly(c, [0, -6, 11, -8, 13, -2, 2, 0], CB.L);
      gfx.circle(c, 0, 0, 6.5, CB.S);
      gfx.circle(c, -1, -2, 3, CB.M);
      const fingers = [-8.5, -3, 2.5, 7.5];
      fingers.forEach((fy, i) => {
        const len = [15, 18, 17, 13][i];
        let x = 14, y = fy * 1.05, a = (fy / 30) * (pose === 0 ? 1.4 : 0.5);
        const bend = pose === 0 ? 0.32 : pose === 1 ? 0.95 : 1.55;
        for (let k = 0; k < 3; k++) {
          const l = (len / 3) * (k === 0 ? 1.15 : k === 2 ? 0.85 : 1);
          const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l;
          gfx.limb(c, x, y, nx, ny, k === 2 ? 2.6 : 3.4, k === 1 ? CB.S : CB.M);
          gfx.circle(c, x, y, 2.2, CB.L);
          x = nx;
          y = ny;
          a += bend;
        }
        // talon
        gfx.limb(c, x, y, x + Math.cos(a) * 4, y + Math.sin(a) * 4, 1.6, CB.L);
      });
      // thumb
      let x = 6, y = -9, a = -1.2 + (pose === 2 ? 1.2 : pose === 1 ? 0.6 : 0);
      for (let k = 0; k < 2; k++) {
        const nx = x + Math.cos(a) * 8, ny = y + Math.sin(a) * 8;
        gfx.limb(c, x, y, nx, ny, 3.4, CB.M);
        gfx.circle(c, x, y, 2.2, CB.L);
        x = nx;
        y = ny;
        a += 0.7;
      }
    });
  }
  function colTorso(p2, cracked) {
    return spr('coltorso' + (p2 ? 'b' : 'a') + (cracked ? 'c' : ''), 140, 128, colPal(p2), (c) => {
      c.translate(70, 106); // floor point
      const EM = p2 ? CB_SPECT[0] : CB_EMBER[0], EL = p2 ? CB_SPECT[1] : CB_EMBER[1];
      // broken spears of the soldiers who fell to it, still stuck in its back
      [[-20, -30, -60, -92], [14, -36, 52, -96], [26, -20, 64, -60]].forEach(([x1, y1, x2, y2], i) => {
        gfx.limb(c, x1, y1, x2, y2, 2.2, i === 1 ? CB.R : CB.DD);
        const a = Math.atan2(y2 - y1, x2 - x1);
        if (i !== 2) gfx.poly(c, [x2 + Math.cos(a) * 7, y2 + Math.sin(a) * 7, x2 + Math.cos(a + 1.9) * 3, y2 + Math.sin(a + 1.9) * 3, x2 + Math.cos(a - 1.9) * 3, y2 + Math.sin(a - 1.9) * 3], CB.S);
        else {
          gfx.poly(c, [x2 - 4, y2 - 2, x2 + 10, y2 - 12, x2 + 6, y2 + 4], CB.R);
          gfx.poly(c, [x2 - 2, y2 - 1, x2 + 8, y2 - 9, x2 + 6, y2], CB.RL);
        }
      });
      // spine down into the floor
      for (let i = 0; i < 9; i++) {
        const y = 18 - i * 8.5;
        c.fillStyle = CB.S;
        c.fillRect(-6, y - 6, 12, 7);
        c.fillStyle = CB.M;
        c.fillRect(-5, y - 6, 10, 3);
        c.fillStyle = CB.DD;
        c.fillRect(-7, y, 14, 1.6);
      }
      // pelvis crest peeking out of the floor
      gfx.ellipse(c, -16, 6, 14, 7, -0.25, CB.S);
      gfx.ellipse(c, 16, 6, 14, 7, 0.25, CB.S);
      gfx.ellipse(c, -16, 4, 11, 4, -0.25, CB.M);
      gfx.ellipse(c, 16, 4, 11, 4, 0.25, CB.M);
      // ribcage cavity
      gfx.ellipse(c, 0, -36, 30, 25, 0, CB.X);
      gfx.ellipse(c, 0, -30, 22, 16, 0, CB.K);
      // soul ember inside the ribs
      gfx.circle(c, 0, -38, 9, EM);
      gfx.circle(c, -1, -39, 4.5, EL);
      // ribs
      for (let i = 0; i < 6; i++) {
        const y0 = -58 + i * 7.6;
        const w = 22 + Math.sin(((i + 1) / 7) * Math.PI) * 11;
        for (const s of [-1, 1]) {
          c.lineCap = 'round';
          c.strokeStyle = i % 2 ? CB.M : CB.L;
          c.lineWidth = 4.2;
          c.beginPath();
          c.moveTo(s * 5, y0);
          c.quadraticCurveTo(s * (w + 8), y0 - 3, s * (w - 1), y0 + 11);
          c.stroke();
          c.strokeStyle = CB.S;
          c.lineWidth = 1.3;
          c.beginPath();
          c.moveTo(s * 6, y0 + 2);
          c.quadraticCurveTo(s * (w + 6), y0 - 0.5, s * (w - 2), y0 + 12);
          c.stroke();
        }
      }
      // sternum
      gfx.poly(c, [-5, -62, 5, -62, 4, -28, 0, -22, -4, -28], CB.M);
      gfx.poly(c, [-3, -60, 1, -60, 0, -30, -2, -30], CB.L);
      // clavicles
      for (const s of [-1, 1]) {
        gfx.limb(c, s * 4, -63, s * (COL_SHX - 4), COL_SHY - 2, 6.5, CB.M);
        gfx.limb(c, s * 6, -65, s * (COL_SHX - 6), COL_SHY - 4, 2, CB.L);
        // shoulder blades behind
        gfx.poly(c, [s * 22, -66, s * 46, -72, s * 50, -54, s * 30, -46], CB.S);
        gfx.poly(c, [s * 26, -66, s * 44, -70, s * 46, -60, s * 32, -56], CB.M);
        // shoulder ball
        gfx.circle(c, s * COL_SHX, COL_SHY, 10, CB.M);
        gfx.circle(c, s * (COL_SHX - 2), COL_SHY - 3, 4.5, CB.L);
      }
      // neck
      for (let i = 0; i < 2; i++) {
        c.fillStyle = CB.S;
        c.fillRect(-5, -72 - i * 6, 10, 5);
        c.fillStyle = CB.M;
        c.fillRect(-4, -72 - i * 6, 8, 2);
      }
      if (cracked) {
        // broken left elbow socket glow handled in draw; scars on the ribs
        gfx.limb(c, -14, -50, -8, -40, 1.2, CB.X);
        gfx.limb(c, 10, -46, 18, -36, 1.2, CB.X);
      }
    });
  }
  function colSkull(p2, flare) {
    return spr('colskull' + (p2 ? 'b' : 'a') + (flare ? 'f' : ''), 64, 60, colPal(p2), (c) => {
      c.translate(32, 32);
      const EM = p2 ? CB_SPECT[0] : CB_EMBER[0], EL = p2 ? CB_SPECT[1] : CB_EMBER[1];
      // crown of bone spikes
      [[-14, -10], [-8, -17], [0, -21], [8, -17], [14, -10]].forEach(([x, y], i) => {
        gfx.poly(c, [x - 3.5, y + 6, x, y - (i === 2 ? 7 : 4), x + 3.5, y + 6], i % 2 ? CB.S : CB.M);
      });
      // cranium
      gfx.ellipse(c, 0, -2, 19, 17, 0, CB.M);
      gfx.ellipse(c, -3, -7, 13, 9, -0.2, CB.L);
      // temples / cheekbones
      gfx.poly(c, [-19, 0, -14, 12, -8, 14, -10, 4], CB.S);
      gfx.poly(c, [19, 0, 14, 12, 8, 14, 10, 4], CB.S);
      gfx.poly(c, [-12, 8, 12, 8, 10, 16, -10, 16], CB.M);
      // brow ridge
      gfx.limb(c, -14, -3, -3, -1, 3, CB.L);
      gfx.limb(c, 14, -3, 3, -1, 3, CB.L);
      // eye sockets
      gfx.ellipse(c, -7.5, 3, 6, 5.2, 0.15, CB.X);
      gfx.ellipse(c, 7.5, 3, 6, 5.2, -0.15, CB.X);
      gfx.circle(c, -7, 3.5, flare ? 3.4 : 2.2, EM);
      gfx.circle(c, 7, 3.5, flare ? 3.4 : 2.2, EM);
      gfx.circle(c, -7, 3, flare ? 1.6 : 1, EL);
      gfx.circle(c, 7, 3, flare ? 1.6 : 1, EL);
      // nasal cavity
      gfx.poly(c, [0, 7, -3, 12, 3, 12], CB.X);
      // upper teeth
      c.fillStyle = CB.X;
      c.fillRect(-10, 15, 20, 3);
      for (let i = 0; i < 7; i++) {
        c.fillStyle = i % 2 ? CB.L : CB.M;
        c.fillRect(-9.5 + i * 2.8, 14, 2.2, 4);
      }
      // cracks
      gfx.limb(c, 5, -16, 9, -9, 1.1, CB.DD);
      gfx.limb(c, 9, -9, 7, -4, 1.1, CB.DD);
      gfx.limb(c, -12, -12, -16, -6, 1.1, CB.DD);
    });
  }
  function colJaw(p2) {
    return spr('coljaw' + (p2 ? 'b' : 'a'), 40, 24, colPal(p2), (c) => {
      c.translate(20, 4);
      gfx.poly(c, [-14, -2, -10, 10, 0, 13, 10, 10, 14, -2, 9, 1, 0, 3, -9, 1], CB.M);
      gfx.poly(c, [-12, 0, -9, 7, 0, 9, 9, 7, 12, 0], CB.S);
      for (let i = 0; i < 6; i++) {
        c.fillStyle = i % 2 ? CB.L : CB.M;
        c.fillRect(-8 + i * 2.8, -1.5, 2.2, 3.5);
      }
    });
  }
  // the folded forearm used as a boomerang (pivot = its centre)
  function colClub(ang, p2) {
    return rspr('colclub' + (p2 ? 'b' : 'a'), 48, ang, 96, 96, colPal(p2), (c) => {
      const h = (COL_L2 + 4) / 2;
      c.translate(-8, 0);
      gfx.limb(c, -h + 6, -3.2, h - 5, -2.4, 5.2, CB.M);
      gfx.limb(c, -h + 6, 3.4, h - 5, 2.6, 4.4, CB.S);
      gfx.limb(c, -h + 7, -4.6, h - 6, -3.8, 1.3, CB.L);
      gfx.circle(c, -h + 5, 0, 7, CB.S);
      gfx.circle(c, -h + 4, -1, 4, CB_SPECT[0]);
      gfx.circle(c, h - 4, 0, 6.2, CB.M);
      // fist
      gfx.ellipse(c, h + 8, 0, 10, 9, 0, CB.M);
      for (let i = 0; i < 4; i++) {
        gfx.circle(c, h + 14, -6 + i * 4, 2.6, i % 2 ? CB.L : CB.M);
      }
      gfx.circle(c, h + 6, -7, 3, CB.L);
    });
  }
  function boneSpike(h, v) {
    return spr('colspike' + h + '_' + v, 16, 40, CB_PAL, (c) => {
      c.translate(8, 39);
      const lean = (v - 1) * 1.5;
      gfx.poly(c, [-5, 0, -1 + lean, -h, 1 + lean, -h + 2, 5, 0], CB.M);
      gfx.poly(c, [-3, 0, lean, -h + 3, 1, 0], CB.L);
      gfx.ellipse(c, 0, -1, 6, 2, 0, CB.S);
    });
  }
  function flameSkull(f) {
    return spr('colfskull' + f, 28, 28, ['#f2e8cf', '#d2c39f', '#a8987a', '#120b08', '#ff8a2a', '#ffd25a', '#c03a10'], (c) => {
      c.translate(14, 14);
      c.rotate((f / 8) * TAU);
      // flame tongues behind
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * 0.75 + (i - 2) * 0.35;
        gfx.poly(c, [Math.cos(a - 0.5) * 6, Math.sin(a - 0.5) * 6, Math.cos(a) * (12 + (i % 2) * 2), Math.sin(a) * (12 + (i % 2) * 2), Math.cos(a + 0.5) * 6, Math.sin(a + 0.5) * 6], i % 2 ? '#ff8a2a' : '#c03a10');
      }
      gfx.ellipse(c, 0, -1, 8, 7.5, 0, '#d2c39f');
      gfx.ellipse(c, -2, -3.5, 5, 3.5, 0, '#f2e8cf');
      gfx.poly(c, [-5, 4, 5, 4, 4, 9, -4, 9], '#a8987a');
      c.fillStyle = '#120b08';
      c.fillRect(-5, -1, 4, 4);
      c.fillRect(1, -1, 4, 4);
      c.fillRect(-1, 4, 2, 2);
      c.fillStyle = '#ffd25a';
      c.fillRect(-4, 0, 2, 2);
      c.fillRect(2, 0, 2, 2);
      c.fillStyle = '#120b08';
      for (let i = 0; i < 4; i++) c.fillRect(-4 + i * 2.4, 7, 1, 2);
    });
  }

  // colossus helpers ------------------------------------------------------------------------
  function colShoulder(e, side) {
    return { x: e.ox + side * COL_SHX + e.lean * 0.6, y: e.floor + COL_SHY + e.bob + e.sink };
  }
  // guard pose: claws raised beside the skull, slowly flexing
  function colRest(e, side) {
    const A = e.A;
    const x = e.ox + side * (side < 0 ? 104 : 98) + Math.sin(e.t * 0.03 + side) * 3;
    return { x: U.clamp(x, A.left + 20, A.right - 20), y: e.floor - 84 + Math.sin(e.t * 0.045 + side * 2) * 4 + e.sink };
  }
  // solve an arm (used by both ai and draw)
  function colSolve(e, arm) {
    const S = colShoulder(e, arm.side);
    const side = arm.side;
    const r = ik(S.x, S.y, arm.x, arm.y, COL_L1, COL_L2, (p) => side * (p.x - S.x) - 0.3 * (p.y - S.y));
    arm.S = S;
    arm.E = { x: r.ex, y: r.ey };
    arm.W = { x: r.wx, y: r.wy };
    return arm;
  }
  // move an arm towards a target (lerp factor k, or exact when k == null)
  function armTo(arm, x, y, k) {
    if (k == null) {
      arm.x = x;
      arm.y = y;
    } else {
      arm.x += (x - arm.x) * k;
      arm.y += (y - arm.y) * k;
    }
  }
  function colReach(e, side) {
    const S = colShoulder(e, side);
    const dy = e.floor - 16 - S.y;
    const r = Math.sqrt(Math.max(0, (COL_L1 + COL_L2 - 4) ** 2 - dy * dy));
    return { min: S.x - r, max: S.x + r };
  }
  // the bone shockwave travelling along the floor
  function colWave(e, g, x, dir) {
    const floor = e.floor;
    const p = e.shoot({
      x, y: floor - 13, vx: dir * 3.1, vy: 0, w: 14, h: 26, el: 'hit', life: 420, wall: true, pierce: true, color: '#e8dcc0',
      upd(p) {
        if (p.t % 3 === 0) G.fx.dust(p.cx, floor, 1);
        if (p.t % 9 === 0) sfx('bone_rattle', { vol: 0.18, pitch: U.rnd(0.8, 1.2) });
        if (!P.floorAt(g.room, p.cx + dir * 8, floor + 2)) p.dead = true;
      },
      drawFn(p, ctx, sx, sy) {
        const base = sy + 13;
        for (let k = 3; k >= 0; k--) {
          const hx = sx - dir * k * 9;
          const h = [26, 18, 11, 6][k] + Math.sin(p.t * 0.6 + k) * 2;
          const img = boneSpike(Math.round(h / 2) * 2, (k + p.t) % 3);
          ctx.drawImage(img, Math.round(hx - 8), Math.round(base - 39));
        }
      },
    });
    p.owner = e;
    return p;
  }
  function colSkullShot(e, g, tx, delay) {
    const mx = e.ox + e.headX, my = e.floor - 70 + e.bob + e.sink;
    const T = 54;
    const ty = e.floor - 8;
    const grav = 0.18;
    const vx = (tx - mx) / T, vy = (ty - my - 0.5 * grav * T * T) / T;
    const p = e.shoot({
      x: mx, y: my, vx, vy, grav, w: 12, h: 12, el: 'fire', color: '#ff8a2a', life: 200, wall: true,
      upd(p) {
        if (p.t % 2 === 0) G.fx.particle(p.cx + U.rnd(-3, 3), p.cy + U.rnd(-3, 3), -p.vx * 0.2, -0.6, U.pick(['#ffd25a', '#ff8a2a', '#c03a10']), 18, { glow: true, size: 1 });
      },
      onWall(p, g) {
        sfx('fireball', { vol: 0.5, pitch: 0.8 });
        G.fx.burst(p.cx, p.cy, '#ff8a2a', 10, 2, { glow: true });
        const fl = e.shoot({
          x: p.cx, y: e.floor - 9, vx: 0, vy: 0, w: 18, h: 16, el: 'fire', life: 46, wall: false, pierce: true, color: '#ff8a2a',
          drawFn(q, ctx, sx, sy) {
            const a = Math.min(1, q.life / 14);
            for (let i = 0; i < 4; i++) {
              const h = 6 + ((q.t * 3 + i * 7) % 11);
              ctx.globalAlpha = a;
              ctx.fillStyle = i % 2 ? '#ff8a2a' : '#ffd25a';
              ctx.fillRect(sx - 8 + i * 4, sy + 8 - h, 3, h);
            }
            ctx.globalAlpha = 1;
            lit(null, ctx, sx, sy, 34, '#ff8a2a', 0.7 * a);
          },
        });
        fl.owner = e;
      },
      drawFn(p, ctx, sx, sy) {
        glow(ctx, sx, sy, 16, '#ff6020', 0.6);
        ctx.drawImage(flameSkull(Math.floor(p.t / 3) % 8), sx - 14, sy - 14);
        lit(null, ctx, sx, sy, 40, '#ff8a2a', 0.8);
      },
    });
    p.owner = e;
  }

  G.defEnemy('colossus', {
    name: N('Bone Colossus', 'Coloso de hueso'),
    desc: N('A giant knit from every soldier who ever died defending the gallery. It cannot leave the floor it was buried in, so it reaches for you instead.', 'Un gigante tejido con cada soldado que murió defendiendo la galería. No puede abandonar el suelo donde lo enterraron, así que te alcanza con los brazos.'),
    area: 'gallery', boss: true, hp: 600, atk: 22, def: 2, exp: 400, w: 56, h: 104,
    weak: ['hit', 'holy'], bony: true, noBlood: true, heavy: true, noDeathFx: true, el: 'hit',
    wakeDist: 150, previewState: 'idle',
    reward: { relic: 'leap_stone' },
    init(e) {
      e.z = -1; // drawn behind the floor tiles: the buried part stays hidden
      e.phase = 1;
      e.ox = e.cx;
      e.floor = e.spawnY + e.h;
      e.A = { floor: e.floor, left: e.ox - 380, right: e.ox + 170, top: e.floor - 220 };
      e.bob = 0;
      e.sink = 0;
      e.lean = 0;
      e.headX = 0;
      e.jaw = 0;
      e.flare = 0;
      e.armL = { side: -1, x: e.ox - 104, y: e.floor - 7, ang: Math.PI, pose: 0, on: true };
      e.armR = { side: 1, x: e.ox + 96, y: e.floor - 7, ang: 0, pose: 0, on: true };
      e.club = null;
      e.contact = false;
      e.last = '';
      e.setState('dormant');
      e.rise = 0;
      // vulnerable: skull + ribcage only (the arms are handled as separate hitboxes)
      e.hurtbox = () => ({ x: e.ox - 28, y: e.floor - 106 + e.sink, w: 56, h: 96 });
    },
    onStart(e, g) {
      e.A = scanArena(e, g);
      e.floor = e.A.floor;
      e.setState('rise');
      sfx('stomp', { vol: 0.8, pitch: 0.6 });
    },
    onHit: bossOnHit,
    ai(e, g) {
      const A = e.A, pl = e.player;
      e.bob = Math.sin(e.t * 0.045) * 1.6;
      // the skull follows the player a little
      e.headX = U.approach(e.headX, U.clamp((pl.cx - e.ox) / 40, -3, 3), 0.15);
      e.flare = Math.max(0, e.flare - 0.03);
      if (e.hp <= 0 && !e.dying) startDying(e, g);
      const L = e.armL, R = e.armR;
      const st = e.state, t = e.stT;
      const restL = colRest(e, -1), restR = colRest(e, 1);
      // ------------------------------------------------------------------ rise
      if (st === 'rise') {
        e.invuln = 2;
        if (t < 60) {
          e.sink = 120;
          if (t % 6 === 0) {
            G.fx.dust(e.ox + U.rnd(-70, 70), e.floor, 2);
            gfx.shake(2, 8);
          }
          if (t % 20 === 0) sfx('stomp', { vol: 0.6, pitch: 0.5 + t / 200 });
          // claws burst out of the floor first
          L.y = R.y = e.floor + 30 - seg(t, 30, 60) * 37;
          L.x = e.ox - 112;
          R.x = e.ox + 104;
          L.ang = Math.PI * 1.5;
          R.ang = Math.PI * 1.5;
          if (t === 34) {
            G.fx.debris(restL.x, e.floor - 4, '#c8c0bc', 10);
            G.fx.debris(restR.x, e.floor - 4, '#c8c0bc', 10);
            sfx('bone_rattle', { vol: 0.8 });
          }
        } else {
          e.sink = 120 * (1 - eout((t - 60) / 90));
          if (t % 4 === 0) G.fx.debris(e.ox + U.rnd(-40, 40), e.floor - 2, '#c8c0bc', 2);
          if (t % 5 === 0) gfx.shake(3, 6);
          const k = seg(t, 100, 150);
          armTo(L, U.lerp(e.ox - 112, restL.x, k), U.lerp(e.floor - 7, restL.y, k));
          armTo(R, U.lerp(e.ox + 104, restR.x, k), U.lerp(e.floor - 7, restR.y, k));
          if (t === 150) {
            e.sink = 0;
            e.flare = 1;
            e.jaw = 1;
            sfx('roar', { vol: 1 });
            gfx.shake(6, 40);
            gfx.flash('#ffb060', 8);
          }
          if (t > 150) e.jaw = Math.max(0, 1 - (t - 150) / 40);
          if (t >= 196) {
            e.contact = true;
            e.setState('idle');
            e.wait = 50;
          }
        }
        return;
      }
      // ------------------------------------------------------------------ dying
      if (st === 'dying') {
        e.jaw = 0.6 + Math.sin(t * 0.7) * 0.4;
        e.flare = 1;
        e.sink = t > 70 ? Math.min(140, (t - 70) * (t - 70) * 0.012) : 0;
        e.lean = Math.sin(t * 0.9) * 3;
        for (const a of [L, R]) if (a.on) armTo(a, a.x + U.rnd(-2, 2), Math.min(e.floor + 40, a.y + 0.6 + t * 0.01), null);
        dyingBlasts(e, g, { x: e.ox - 60, y: e.floor - 110 + e.sink, w: 120, h: 100 }, 6);
        if (t % 9 === 0) G.fx.debris(e.ox + U.rnd(-50, 50), e.floor - U.rnd(20, 90) + e.sink, CB.M, 4);
        if (t === 150) {
          G.fx.explode(e.ox, e.floor - 60, 2.5);
          gfx.flash('#fff4d0', 16);
          gfx.shake(8, 40);
        }
        if (t >= 160) finishDying(e, g, e.ox - 70, e.floor);
        return;
      }
      // ------------------------------------------------------------------ phase change: rip the arm off
      if (st === 'rip') {
        e.invuln = 4;
        if (t < 30) {
          e.lean = Math.sin(t * 1.3) * 4;
          if (t === 1) {
            sfx('roar', { vol: 1, pitch: 0.8 });
            phaseShift(e, g, '#c0a0ff');
            e.flare = 1;
          }
          e.jaw = 1;
          armTo(L, restL.x, restL.y - 20, 0.2);
          armTo(R, restR.x, restR.y, 0.2);
        } else if (t < 64) {
          e.jaw = Math.max(0, e.jaw - 0.05);
          e.lean = U.approach(e.lean, -10, 0.6);
          // right hand reaches across for the left forearm
          armTo(L, e.ox - 92, e.floor - 76, 0.15);
          const El = L.E || { x: e.ox - 80, y: e.floor - 90 };
          armTo(R, U.lerp(El.x, L.x, 0.5), U.lerp(El.y, L.y, 0.5) + 2, 0.12);
          R.pose = 1;
        } else if (t === 64) {
          // crack!
          L.on = false;
          e.club = { x: R.x, y: R.y, rot: 0, held: true };
          sfx('hit_bone', { vol: 1, pitch: 0.6 });
          sfx('bone_rattle', { vol: 1 });
          gfx.shake(7, 24);
          G.fx.debris(L.E ? L.E.x : e.ox - 80, L.E ? L.E.y : e.floor - 80, CB.M, 16);
          G.fx.burst(L.E ? L.E.x : e.ox - 80, L.E ? L.E.y : e.floor - 80, CB_SPECT[0], 20, 2.5, { glow: true });
        } else {
          armTo(R, e.ox + 70, e.floor - 120, 0.1);
          e.lean = U.approach(e.lean, 0, 0.4);
          if (t >= 96) {
            e.setState('boom');
            e.wait = 0;
          }
        }
        if (e.club && e.club.held) {
          e.club.x = R.W ? R.W.x : R.x;
          e.club.y = R.W ? R.W.y : R.y;
          e.club.rot += 0.08;
        }
        colSolve(e, L);
        colSolve(e, R);
        return;
      }
      const p2 = e.phase === 2;
      const sp = p2 ? 0.78 : 1; // timing multiplier
      // ------------------------------------------------------------------ idle / choose
      if (st === 'idle') {
        e.lean = U.approach(e.lean, 0, 0.5);
        e.jaw = Math.max(0, e.jaw - 0.05);
        if (L.on) armTo(L, restL.x, restL.y + Math.sin(e.t * 0.05) * 1, 0.12);
        armTo(R, restR.x, restR.y + Math.sin(e.t * 0.05 + 1) * 1, 0.12);
        L.pose = R.pose = Math.sin(e.t * 0.05) > 0.6 ? 1 : 0;
        L.ang = U.lerp(L.ang, Math.PI * 1.32, 0.1);
        R.ang = U.lerp(R.ang, Math.PI * 1.68, 0.1);
        if (wants2(e)) {
          e.setState('rip');
          return;
        }
        if (--e.wait <= 0) {
          const dx = pl.cx - e.ox;
          const right = dx > 30; // player behind the colossus, near the wall
          const near = Math.abs(dx) < 150;
          const opts = [];
          const add = (s, w) => {
            if (s !== e.last) for (let i = 0; i < w; i++) opts.push(s);
          };
          add('slam', near ? 4 : 3);
          add('skulls', near ? 2 : 4);
          add('sweep', near ? 4 : 1);
          if (p2) add('boom', near ? 3 : 4);
          if (p2) add('slam2', near ? 2 : 1);
          let s = U.pick(opts) || 'slam';
          if (s === 'boom' && right) s = 'sweep';
          e.side = right ? 1 : -1;
          if (!L.on && e.side < 0 && (s === 'slam' || s === 'sweep')) e.side = 1; // only the right arm left
          e.last = s;
          e.setState(s);
          e.tx = pl.cx;
          sfx('bone_rattle', { vol: 0.35, pitch: 0.6 });
        }
      }
      // ------------------------------------------------------------------ slam (+ shockwave)
      else if (st === 'slam' || st === 'slam2') {
        const arm = e.side < 0 ? L : R;
        const other = arm === L ? R : L;
        if (other.on) armTo(other, (other === L ? restL : restR).x, (other === L ? restL : restR).y, 0.1);
        const reach = colReach(e, arm.side);
        const W1 = Math.round(40 * sp), W2 = W1 + Math.round(12 * sp), W3 = W2 + 7;
        if (t <= W1) {
          e.tx = U.approach(e.tx, pl.cx, 3.2);
          arm.pose = 2;
        }
        const tx = U.clamp(e.tx, reach.min + 10, reach.max - 10);
        e.slamX = tx;
        if (t <= W1) {
          armTo(arm, tx, e.floor - 150, 0.13);
          e.lean = U.approach(e.lean, arm.side * 5, 0.3);
          arm.ang = U.lerp(arm.ang, Math.PI / 2, 0.2);
        } else if (t <= W2) {
          armTo(arm, tx + U.rnd(-1.2, 1.2), e.floor - 152 + U.rnd(-1, 1));
        } else if (t <= W3) {
          const k = ein((t - W2) / (W3 - W2));
          armTo(arm, tx, U.lerp(e.floor - 150, e.floor - 15, k));
          e.lean = U.approach(e.lean, -arm.side * 6, 2);
        }
        if (t === W3) {
          // impact
          gfx.shake(6, 20);
          sfx('stomp', { vol: 1 });
          sfx('explosion', { vol: 0.5, pitch: 0.6 });
          G.fx.dust(tx, e.floor, 10);
          G.fx.debris(tx, e.floor - 4, '#c8c0bc', 10);
          pHit(e, tx - 24, e.floor - 34, 48, 34, e.atk + 6, 'hit');
          const away = tx <= e.ox ? -1 : 1;
          colWave(e, g, tx + away * 24, away);
          if (p2 || st === 'slam2') colWave(e, g, tx - away * 24, -away);
        }
        if (t > W3 && t < W3 + 4) pHit(e, tx - 24, e.floor - 34, 48, 34, e.atk + 6, 'hit');
        if (t > W3 + Math.round(30 * sp)) {
          armTo(arm, (arm === L ? restL : restR).x, (arm === L ? restL : restR).y, 0.12);
          arm.ang = U.lerp(arm.ang, arm === L ? Math.PI : 0, 0.15);
          e.lean = U.approach(e.lean, 0, 0.4);
        }
        // a second slam with the other arm in phase 2
        if (t > W3 + Math.round(52 * sp)) {
          if (st === 'slam2' && other.on && !e.did2) {
            e.did2 = true;
            e.side = -e.side;
            e.tx = pl.cx;
            e.setState('slam');
            return;
          }
          e.did2 = false;
          arm.pose = 0;
          e.setState('idle');
          e.wait = Math.round((p2 ? 34 : 56) + e.rnd.int(0, 24));
        }
      }
      // ------------------------------------------------------------------ flaming skulls
      else if (st === 'skulls') {
        if (L.on) armTo(L, restL.x, restL.y, 0.1);
        armTo(R, restR.x, restR.y, 0.1);
        const W = Math.round(38 * sp);
        if (t < W) {
          e.jaw = Math.min(1, t / (W * 0.7));
          e.flare = Math.min(1, e.flare + 0.05);
          e.lean = U.approach(e.lean, 0, 0.5);
          if (t % 2 === 0) {
            const a = Math.random() * TAU, r = 30;
            const mx = e.ox + e.headX, my = e.floor - 68 + e.bob;
            G.fx.particle(mx + Math.cos(a) * r, my + Math.sin(a) * r, -Math.cos(a) * 1.3, -Math.sin(a) * 1.3, p2 ? CB_SPECT[1] : '#ffb040', 22, { glow: true });
          }
          if (t === 4) sfx('roar', { vol: 0.6, pitch: 1.3 });
        }
        const n = p2 ? 5 : 3;
        const k = t - W;
        if (k >= 0 && k % 7 === 0 && k / 7 < n) {
          const i = k / 7;
          const spread = p2 ? 46 : 58;
          const tx = U.clamp(pl.cx + (i - (n - 1) / 2) * spread + U.rnd(-6, 6), e.A.left + 12, e.A.right - 12);
          colSkullShot(e, g, tx);
          sfx('fireball', { vol: 0.6 });
          e.flare = 1;
        }
        if (t > W + n * 7 + 6) e.jaw = Math.max(0, e.jaw - 0.06);
        if (t > W + n * 7 + 40) {
          e.setState('idle');
          e.wait = Math.round((p2 ? 30 : 50) + e.rnd.int(0, 20));
        }
      }
      // ------------------------------------------------------------------ horizontal sweep
      else if (st === 'sweep') {
        const arm = e.side < 0 && L.on ? L : R;
        const dir = arm === L ? -1 : 1;
        const other = arm === L ? R : L;
        if (other.on) armTo(other, (other === L ? restL : restR).x, (other === L ? restL : restR).y, 0.1);
        const W1 = Math.round(46 * sp), W2 = W1 + 14;
        // phase 2: sometimes a low sweep (jump) instead of the chest-high one (crouch)
        if (t === 1) e.low = p2 && e.rnd.chance(0.45);
        const hy = e.floor - (e.low ? 14 : 44);
        e.sweepY = hy;
        const backX = e.ox - dir * 22;
        const far = U.clamp(e.ox + dir * 196, e.A.left + 16, e.A.right - 16);
        if (t <= W1) {
          armTo(arm, backX, hy - (e.low ? 6 : 10), 0.12);
          arm.pose = 0;
          arm.ang = U.lerp(arm.ang, dir < 0 ? Math.PI : 0, 0.2);
          e.lean = U.approach(e.lean, -dir * 6, 0.4);
        } else if (t <= W2) {
          const k = ease((t - W1) / (W2 - W1));
          const px0 = arm.x;
          armTo(arm, U.lerp(backX, far, k), hy);
          e.lean = U.approach(e.lean, dir * 8, 2);
          if (t === W1 + 1) sfx('swing_heavy', { vol: 1, pitch: 0.6 });
          colSolve(e, arm);
          const x0 = Math.min(px0, arm.W.x) - 16, x1 = Math.max(px0, arm.W.x) + 16;
          pHit(e, x0, hy - 13, x1 - x0, 26, e.atk + 4, 'cut');
          pHitLine(e, arm.E.x, arm.E.y, arm.W.x, arm.W.y, 4, e.atk, 'hit');
          if (t % 2 === 0) G.fx.dust(arm.W.x, e.floor, 1);
        } else if (t > W2 + 22) {
          armTo(arm, (arm === L ? restL : restR).x, (arm === L ? restL : restR).y, 0.12);
          e.lean = U.approach(e.lean, 0, 0.4);
        }
        if (t > W2 + 50) {
          e.setState('idle');
          e.wait = Math.round((p2 ? 34 : 56) + e.rnd.int(0, 24));
        }
      }
      // ------------------------------------------------------------------ boomerang forearm (phase 2)
      else if (st === 'boom') {
        if (t === 1) {
          e.high = e.rnd.chance(0.5);
          e.b0 = L.on ? 28 : 0; // the forearm has to be torn off first
        }
        if (t < e.b0) {
          armTo(L, e.ox - 92, e.floor - 76, 0.18);
          const El = L.E || { x: e.ox - 80, y: e.floor - 90 };
          armTo(R, U.lerp(El.x, L.x, 0.5), U.lerp(El.y, L.y, 0.5) + 2, 0.2);
          R.pose = 1;
          e.lean = U.approach(e.lean, -8, 0.8);
          if (t === e.b0 - 1) {
            L.on = false;
            e.club = { x: R.x, y: R.y, rot: 0, held: true };
            sfx('hit_bone', { vol: 0.9, pitch: 0.65 });
            sfx('bone_rattle', { vol: 0.7 });
            gfx.shake(4, 12);
            G.fx.burst(El.x, El.y, CB_SPECT[0], 14, 2.2, { glow: true });
            G.fx.debris(El.x, El.y, CB.M, 8);
          }
          colSolve(e, L);
          colSolve(e, R);
          return;
        }
        const c = e.club;
        if (!c) {
          e.setState('idle');
          e.wait = 20;
          return;
        }
        const tt = t - e.b0;
        const W = Math.round(44 * sp);
        const throwY = e.floor - (e.high ? 66 : 12);
        e.throwY = throwY;
        if (tt < W) {
          // wind up: hold the forearm high (crouch under it) or low (jump over it)
          c.held = true;
          e.bdir = pl.cx < e.ox ? -1 : 1;
          armTo(R, e.ox + 40, e.high ? e.floor - 132 : e.floor - 40, 0.12);
          e.lean = U.approach(e.lean, e.high ? 4 : -4, 0.3);
          c.rot += 0.12 + (tt / W) * 0.2;
          R.pose = 1;
          c.x = R.W ? R.W.x : R.x;
          c.y = R.W ? R.W.y : R.y;
        } else {
          if (tt === W) {
            c.held = false;
            c.dir = e.bdir;
            c.x0 = c.x;
            c.D = Math.max(60, Math.min(Math.abs((c.dir < 0 ? e.A.left + 40 : e.A.right - 40) - c.x0), 330));
            c.T = Math.round(120 * sp);
            c.k = 0;
            c.y0 = c.y;
            sfx('swing_heavy', { vol: 1, pitch: 0.5 });
            G.fx.burst(c.x, c.y, CB_SPECT[0], 12, 2, { glow: true });
          }
          c.k++;
          const ph = Math.min(1, c.k / c.T);
          c.x = c.x0 + c.dir * c.D * Math.sin(Math.PI * ph);
          c.y = c.k < 14 ? U.lerp(c.y0, throwY, c.k / 14) : ph > 0.85 ? U.lerp(throwY, c.y0, (ph - 0.85) / 0.15) : throwY;
          c.rot += 0.3;
          if (c.k % 10 === 0) sfx('swing_light', { vol: 0.5, pitch: 0.6 });
          if (c.k % 2 === 0) G.fx.particle(c.x, c.y, 0, -0.4, CB_SPECT[0], 18, { glow: true });
          armTo(R, e.ox + 40, e.floor - 70, 0.08);
          // damage: the spinning forearm is a rotating segment
          const h = 34;
          const ca = Math.cos(c.rot), sa = Math.sin(c.rot);
          pHitLine(e, c.x - ca * h, c.y - sa * h, c.x + ca * h, c.y + sa * h, 5, e.atk + 4, 'hit');
          if (ph >= 1) {
            // caught: spectral fire snaps it back onto the elbow
            sfx('hit_bone', { vol: 0.8, pitch: 0.8 });
            G.fx.burst(c.x, c.y, CB_SPECT[1], 18, 2.5, { glow: true });
            L.on = true;
            L.x = c.x;
            L.y = c.y;
            e.club = null;
            e.reattach = 30;
            e.setState('idle');
            e.wait = Math.round(40 + e.rnd.int(0, 20));
          }
        }
      }
      if (e.reattach > 0) e.reattach--;
      colSolve(e, L);
      colSolve(e, R);
      // hands resting on the floor do not hurt; only moving parts do (above)
    },
    draw(e, ctx, sx, sy) {
      const pre = e.preview;
      if (pre) {
        // bestiary portrait: scale the whole colossus into the frame
        ctx.save();
        const sc0 = Math.min(1, 60 / e.h, 90 / e.w);
        const k = Math.min(86 / 290, 62 / 130) / sc0;
        ctx.scale(k, k);
        e.floor = 0;
        e.ox = 0;
        e.A = { left: -400, right: 400, floor: 0 };
        e.sink = 0;
        e.bob = 0;
        e.lean = 0;
        e.headX = 0;
        e.jaw = 0;
        e.flare = 0;
        armTo(e.armL, -104, -7);
        armTo(e.armR, 96, -7);
        colSolve(e, e.armL);
        colSolve(e, e.armR);
        drawColossus(e, ctx, 0, 0, 0, 0);
        ctx.restore();
        return;
      }
      const g = G.game;
      const ox = Math.round(e.ox - g.camx), fl = Math.round(e.floor - g.camy);
      drawColossus(e, ctx, ox, fl, g.camx, g.camy);
    },
  });

  function drawColossus(e, ctx, ox, fl, camx, camy) {
    const p2 = e.phase === 2;
    if (e.state === 'dormant') {
      // a heap of old bones and a rusted pauldron on the marble
      const img = spr('colheap', 120, 40, CB_PAL, (c) => {
        c.translate(60, 38);
        for (let i = 0; i < 22; i++) {
          const x = Math.sin(i * 2.7) * 44 * (1 - i / 30), y = -2 - (i % 5) * 3 * (1 - Math.abs(x) / 50);
          gfx.limb(c, x - 6, y, x + 6, y - Math.cos(i) * 3, 3, i % 3 ? CB.M : CB.S);
          gfx.circle(c, x - 6, y, 2.2, CB.L);
        }
        gfx.ellipse(c, 6, -12, 9, 8, 0, CB.M);
        c.fillStyle = CB.X;
        c.fillRect(2, -13, 3, 3);
        c.fillRect(8, -13, 3, 3);
        gfx.poly(c, [-30, -4, -16, -14, -8, -6, -18, 0], CB.R);
      });
      put(null, ctx, img, ox, fl, 60, 38);
      return;
    }
    const sink = Math.round(e.sink), bob = Math.round(e.bob);
    const base = fl + sink + bob;
    const lean = Math.round(e.lean);
    // soul light
    lit(e, ctx, ox, base - 40, 110, p2 ? '#8a5aff' : '#ff8a2a', 0.9);
    lit(e, ctx, ox + e.headX, base - 86, 60, p2 ? '#b080ff' : '#ffb050', 0.7 + e.flare * 0.4);
    // torso
    const cracked = !e.armL.on || p2;
    put(e, ctx, colTorso(p2, cracked), ox + Math.round(lean * 0.6), base, 70, 106);
    // the soul ember throbbing inside the ribs
    const pulse = 0.55 + Math.sin(e.t * 0.12) * 0.2 + e.flare * 0.2;
    glow(ctx, ox + Math.round(lean * 0.6), base - 38, 22, p2 ? CB_SPECT[0] : CB_EMBER[0], pulse);
    // skull + jaw
    const hx = ox + Math.round(e.headX + lean), hy = base - 86;
    const jo = e.jaw * 7;
    put(e, ctx, colJaw(p2), hx, hy + 13 + jo, 20, 4);
    put(e, ctx, colSkull(p2, e.flare > 0.5), hx, hy, 32, 32);
    if (e.jaw > 0.3) {
      const fc = p2 ? CB_SPECT : CB_EMBER;
      glow(ctx, hx, hy + 16 + jo * 0.5, 10 + e.jaw * 6, fc[0], 0.6);
    }
    // arms
    const off = (pt) => ({ x: pt.x - camx, y: pt.y - camy });
    for (const arm of [e.armL, e.armR]) {
      if (!arm.S) colSolve(e, arm);
      const S = off(arm.S), E = off(arm.E), W = off(arm.W);
      const a1 = Math.atan2(E.y - S.y, E.x - S.x), a2 = Math.atan2(W.y - E.y, W.x - E.x);
      if (arm.on) {
        put(e, ctx, colHumerus(a1, p2), (S.x + E.x) / 2, (S.y + E.y) / 2);
        put(e, ctx, colForearm(a2, p2), (E.x + W.x) / 2, (E.y + W.y) / 2);
        const ha = arm.pose === 2 ? a2 : arm.ang != null ? U.lerp(a2, arm.ang, 0.55) : a2;
        put(e, ctx, colHand(ha, arm.pose, arm.side < 0, p2), W.x, W.y);
        if (e.reattach > 0 && arm.side < 0) glow(ctx, E.x, E.y, 14, CB_SPECT[0], e.reattach / 30);
      } else {
        // only the upper arm remains: it hangs, the broken elbow burns violet
        const hang = { x: S.x - 22, y: S.y + 56 };
        const ah = Math.atan2(hang.y - S.y, hang.x - S.x);
        const Eh = { x: S.x + Math.cos(ah) * COL_L1, y: S.y + Math.sin(ah) * COL_L1 };
        put(e, ctx, colHumerus(ah, p2), (S.x + Eh.x) / 2, (S.y + Eh.y) / 2);
        glow(ctx, Eh.x, Eh.y, 12, CB_SPECT[0], 0.8);
        if (e.t % 3 === 0) G.fx.particle(Eh.x + camx + U.rnd(-3, 3), Eh.y + camy, U.rnd(-0.3, 0.3), -0.8, CB_SPECT[U.irnd(0, 1)], 20, { glow: true });
      }
    }
    // the thrown / held forearm
    if (e.club) {
      const c = e.club;
      put(e, ctx, colClub(c.rot, p2), c.x - camx, c.y - camy);
      lit(e, ctx, c.x - camx, c.y - camy, 40, CB_SPECT[0], 0.6);
    }
    // telegraphs
    if (e.state === 'slam' || e.state === 'slam2') {
      const t = e.stT, W1 = Math.round(40 * (p2 ? 0.78 : 1));
      if (t > 8 && t < W1 + 20) {
        const x = e.slamX - camx;
        const a = Math.min(1, (t - 8) / 24);
        ctx.globalAlpha = 0.25 + a * 0.35;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(x, fl - 1, 14 + a * 12, 3 + a, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (t > W1) warnRect(ctx, x - 24, fl - 34, 48, 34, t, '#ff5030');
      }
    }
    if (e.state === 'sweep') {
      const t = e.stT, W1 = Math.round(46 * (p2 ? 0.78 : 1));
      if (t > 18 && t <= W1) {
        const dir = e.side < 0 && e.armL.on ? -1 : 1;
        const y = e.sweepY - camy;
        warnLine(ctx, ox - dir * 10, y, ox + dir * 196, y, t, e.low ? '#ffd060' : '#ff6040', 2);
      }
    }
    if (e.state === 'boom' && e.club && e.club.held && e.stT > 16) {
      const y = e.throwY - camy;
      warnLine(ctx, ox - 30, y, ox - 330, y, e.stT, CB_SPECT[1], 2);
      warnLine(ctx, ox + 30, y, ox + 330, y, e.stT, CB_SPECT[1], 2);
    }
  }
})();
