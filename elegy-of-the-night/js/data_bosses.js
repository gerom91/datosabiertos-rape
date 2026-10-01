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
    const room = g.room;
    // main floor: the lowest surface that spans a good part of the room (not a dais)
    const byY = {};
    for (const r of perches(room, 1)) byY[r.y] = (byY[r.y] || 0) + (r.x1 - r.x0);
    let floor = null;
    for (const y of Object.keys(byY).map(Number).sort((a, b) => b - a)) {
      if (byY[y] >= room.pw * 0.3) {
        floor = y;
        break;
      }
    }
    if (floor == null) floor = Math.round((e.spawnY + e.h) / 16) * 16;
    // side walls & ceiling, measured a few tiles above the floor
    const row = Math.max(1, floor / 16 - 5);
    let sx = U.clamp(Math.floor(e.cx / 16), 1, room.tw - 2);
    if (P.solidFor(room.get(sx, row))) sx = Math.floor(room.tw / 2);
    let l = sx, r = sx;
    while (l > 0 && !P.solidFor(room.get(l - 1, row))) l--;
    while (r < room.tw - 1 && !P.solidFor(room.get(r + 1, row))) r++;
    let top = row;
    while (top > 0 && !P.solidFor(room.get(sx, top - 1))) top--;
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
  // a sleeping boss (or one whose intro is still playing) cannot be hurt
  const awake = (e) => e.started && G.game.boss === e;
  // wake up only once the player is close AND the boss is well inside the camera view,
  // so the intro scene is always staged with the boss on screen
  const wakeSeen = (dist) => (e, g) => {
    const sx = e.cx - g.camx;
    return Math.abs(e.dxp()) < dist && Math.abs(e.dyp()) < 260 && sx > 70 && sx < G.W - 70 && e.onScreen(0);
  };

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
    wake: wakeSeen(160), previewState: 'idle',
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
    onHitCheck: (e) => awake(e),
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
        // the claws flail, then collapse with the body
        for (const a of [L, R]) {
          if (!a.on) continue;
          const r = a === L ? restL : restR;
          const fl = Math.sin(t * 0.5 + a.side) * Math.max(0, 14 - t * 0.1);
          armTo(a, r.x + fl, Math.min(e.floor + 30, r.y + fl * 0.6 + seg(t, 40, 140) * 90), 0.25);
          a.pose = t % 20 < 10 ? 0 : 1;
        }
        if (e.club) e.club.rot += 0.1;
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
            c.D = Math.max(60, Math.min(Math.abs((c.dir < 0 ? e.A.left + 40 : e.A.right - 40) - c.x0), 300));
            c.T = Math.round(132 * sp);
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
        armTo(e.armL, -104, -84);
        armTo(e.armR, 98, -84);
        e.armL.ang = Math.PI * 1.32;
        e.armR.ang = Math.PI * 1.68;
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

  // =====================================================================================
  //  2. INK DOPPELGANGER  (stk_doppel)
  // =====================================================================================
  // Alucard rewritten in violet-black ink: the real puppet renderer (G.drawAlucard) with
  // an ink palette, its own cape/hair verlet chains and a bag of Alucard's own tricks.
  const INK = {
    skin: '#6c5a9c', skinS: '#4a3c74', hair: '#9a84d6', hairS: '#6a56a8', hairD: '#433578',
    coat: '#1a1228', coatH: '#3c2c62', coatD: '#0d0916', gold: '#8c5cdc', goldD: '#5a3a9c',
    white: '#b4a0ee', pants: '#150f22', boot: '#110b1b', bootH: '#2c2046',
    capeO: '#0e0a16', capeOH: '#261c3e', capeI: '#5c2c9c', capeIH: '#8a4ad0', eye: '#ff4aa8',
    steel: '#6a56b4', steelD: '#3a2c72', steelL: '#dccdff', hilt: '#3a2a5c', outline: '#07050b',
  };
  const INK_SWORD = { wtype: 'sword', len: 22, col: '#7c5cd8', id: 'ink_blade' };
  const INK_PAL = Object.values(INK).filter((c) => c !== INK.outline).concat([INK_SWORD.col, U.shade(INK_SWORD.col, 0.5)]);
  const INK_FX = ['#1a0c2a', '#3a1a5a', '#7a4ad0', '#c8a0ff'];

  function chainSim(pts, ax, ay, segL, grav, windX, windY, floorY, damp) {
    pts[0].x = ax;
    pts[0].y = ay;
    pts[0].px = ax;
    pts[0].py = ay;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
      p.px = p.x;
      p.py = p.y;
      p.x += vx + windX * (i / pts.length);
      p.y += vy + grav + windY * (i / pts.length);
    }
    for (let k = 0; k < 4; k++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const diff = (d - segL) / d;
        if (i === 1) {
          b.x -= dx * diff;
          b.y -= dy * diff;
        } else {
          a.x += dx * diff * 0.5;
          a.y += dy * diff * 0.5;
          b.x -= dx * diff * 0.5;
          b.y -= dy * diff * 0.5;
        }
      }
      pts[0].x = ax;
      pts[0].y = ay;
      for (let i = 1; i < pts.length; i++) if (pts[i].y > floorY) pts[i].y = floorY;
    }
  }
  function dopResetCape(e) {
    const fx = e.cx, fy = e.fy;
    e.cape = [];
    for (let i = 0; i < 8; i++) {
      const x = fx - e.facing * (4 + i * 0.5), y = fy - 33 + i * 5;
      e.cape.push({ x, y, px: x, py: y });
    }
    e.hair = [];
    for (let i = 0; i < 5; i++) {
      const x = fx - e.facing * (3 + i * 2), y = fy - 41 + i * 3;
      e.hair.push({ x, y, px: x, py: y });
    }
  }
  function dopSimCape(e) {
    const pose = e.pose;
    const f = e.facing, fx = e.cx, fy = e.fy;
    const crouch = pose && pose.hipY > -16;
    const ln = pose ? pose.lean : 0;
    const shY = (pose ? pose.hipY : -21) - Math.cos(ln) * 12.5;
    const shX = (pose ? pose.hipX : 0) + Math.sin(ln) * 12.5 - 3;
    const windX = -f * 0.2 - e.vx * 0.24;
    const windY = e.vy > 0 ? -e.vy * 0.16 : -e.vy * 0.05;
    chainSim(e.cape, fx + shX * f, fy + shY, crouch ? 3.8 : 5.2, 0.26, windX, windY, fy - 1, 0.88);
    for (let i = 1; i < e.cape.length; i++) {
      const p = e.cape[i];
      if ((p.x - fx) * f > 2 - i * 0.2) p.x = fx + (2 - i * 0.2) * f;
    }
    const hx = fx + ((pose ? pose.hipX + Math.sin(ln) * 18.5 : 0) - 3) * f;
    const hy = fy + (pose ? pose.hipY - Math.cos(ln) * 18.5 : -39.5) - 1;
    chainSim(e.hair, hx, hy, 3.6, 0.16, -f * 0.14 - e.vx * 0.12, e.vy > 0 ? -e.vy * 0.1 : 0, fy - 4, 0.8);
  }
  // pose for the current state
  function dopPose(e) {
    const st = e.state, t = e.stT;
    const W = e.W || 20;
    const atk = (ph, w, crouch) => G.alucardPose('attack', e.t, { phase: ph, wtype: w || 'sword', crouch });
    switch (st) {
      case 'walk':
      case 'toLedge':
        return e.onGround ? G.alucardPose('walk', e.walkT) : G.alucardPose(e.vy < 0 ? 'jump' : 'fall', e.t);
      case 'backdash':
        return G.alucardPose('backdash', e.t);
      case 'thrust':
        if (t < W) return atk(t / W);
        if (t < W + 10) return atk(1 + (t - W) / 10);
        return atk(2 + Math.min(1, (t - W - 10) / 16));
      case 'slash':
        if (t < W) return atk(t / W, 'sword', e.low);
        if (t < W + 7) return atk(1 + (t - W) / 7, 'sword', e.low);
        return atk(2 + Math.min(1, (t - W - 7) / 12), 'sword', e.low);
      case 'daggers':
      case 'snipe':
        return atk(e.throwPh || 0, 'fist');
      case 'hellfire':
      case 'rewrite':
        if (st === 'rewrite' && t < 50) return G.alucardPose('kneel', e.t);
        return G.alucardPose('cast', e.t);
      case 'jumpAtk':
      case 'jumpOver':
        if (e.dive) return G.alucardPose('dive', e.t);
        if (e.flipT > 0) return G.alucardPose('flip', e.t, { rot: (1 - e.flipT / 22) * TAU });
        if (!e.onGround) return G.alucardPose(e.vy < 0 ? 'jump' : 'fall', e.t);
        return G.alucardPose(t < 8 ? 'crouch' : 'land', e.t);
      case 'land':
        return G.alucardPose('land', e.t);
      case 'appear':
        return t < 40 ? G.alucardPose('kneel', e.t) : G.alucardPose('idle', e.t);
      case 'dying':
        return t < 30 ? G.alucardPose('hurt', e.t) : G.alucardPose('kneel', e.t);
      default:
        if (!e.onGround) return G.alucardPose(e.vy < 0 ? 'jump' : 'fall', e.t);
        return G.alucardPose('idle', e.t);
    }
  }
  function dopCanvas(e) {
    if (!e.cv) {
      e.cv = gfx.makeCanvas(128, 84);
      e.cvw = gfx.makeCanvas(128, 84);
    }
    return e.cv;
  }
  function dopBat(f) {
    return spr('dopbat' + f, 44, 30, ['#0e0a16', '#1a1228', '#3c2c62', '#5c2c9c', '#8a4ad0', '#ff4aa8'], (c) => {
      c.translate(22, 15);
      const wy = [-11, -4, 5, -4][f];
      for (const s of [-1, 1]) {
        gfx.poly(c, [s * 2, -2, s * 9, wy - 2, s * 20, wy + 1, s * 16, wy + 4, s * 12, wy + 3, s * 8, wy + 7, s * 4, wy + 5, s * 1, 4], '#1a1228');
        gfx.limb(c, s * 3, -1, s * 19, wy + 1, 1.2, '#5c2c9c');
        gfx.limb(c, s * 9, wy - 1, s * 12, wy + 3, 1, '#3c2c62');
      }
      gfx.ellipse(c, 0, 1, 4.2, 5.4, 0, '#0e0a16');
      gfx.poly(c, [-4, -3, -3, -8, -1, -4], '#1a1228');
      gfx.poly(c, [4, -3, 3, -8, 1, -4], '#1a1228');
      c.fillStyle = '#ff4aa8';
      c.fillRect(-2.5, -1, 1.6, 1.4);
      c.fillRect(1, -1, 1.6, 1.4);
      c.fillStyle = '#8a4ad0';
      c.fillRect(-1, 3, 2, 1);
    });
  }
  function inkDaggerShot(e, g, x, y, vx, vy) {
    const ang = Math.atan2(vy, vx);
    const p = e.shoot({
      x, y, vx, vy, w: 12, h: 6, el: 'dark', color: '#7a4ad0', life: 160, wall: true,
      upd(p) {
        if (p.t % 3 === 0) G.fx.particle(p.cx, p.cy, 0, 0.3, INK_FX[1], 22, { size: 1, grav: 0.05 });
      },
      drawFn(p, ctx, sx, sy) {
        const img = rspr('inkdagger', 16, ang, 22, 22, ['#0d0916', '#1a1228', '#5c2c9c', '#b48cff', '#dccdff'], (c) => {
          gfx.poly(c, [-8, -1.6, 4, -2, 9, 0, 4, 2, -8, 1.6], '#1a1228');
          gfx.limb(c, -6, -0.6, 7, -0.4, 1, '#b48cff');
          gfx.limb(c, -9, -3.5, -9, 3.5, 2, '#5c2c9c');
          gfx.limb(c, -13, 0, -9, 0, 2, '#0d0916');
        });
        ctx.drawImage(img, sx - 11, sy - 11);
        lit(null, ctx, sx, sy, 22, '#8a4ad0', 0.4);
      },
    });
    p.owner = e;
    return p;
  }
  function inkFireball(e, g, x, y, vx, vy) {
    const p = e.shoot({
      x, y, vx, vy, w: 12, h: 12, el: 'dark', color: '#8a4ad0', life: 150, wall: true,
      upd(p) {
        if (p.t % 2 === 0) G.fx.particle(p.cx + U.rnd(-3, 3), p.cy + U.rnd(-3, 3), -p.vx * 0.25, U.rnd(-0.6, 0.2), U.pick(INK_FX), 20, { glow: Math.random() < 0.5, size: 2 });
      },
      drawFn(p, ctx, sx, sy) {
        glow(ctx, sx, sy, 15, '#7a3ad0', 0.75);
        ctx.fillStyle = '#0d0916';
        ctx.beginPath();
        ctx.arc(sx, sy, 5 + Math.sin(p.t * 0.6), 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#c8a0ff';
        ctx.fillRect(sx - 1, sy - 3, 2, 2);
        lit(null, ctx, sx, sy, 46, '#8a4ad0', 0.8);
      },
    });
    p.owner = e;
    return p;
  }

  G.defEnemy('doppel', {
    name: N('Ink Doppelganger', 'Doble de tinta'),
    desc: N('The Scrivener’s rough draft of Alucard: every move copied, nothing understood. It forgets to guard itself right after it strikes.', 'El borrador que el Escriba hizo de Alucard: cada movimiento copiado, nada comprendido. Olvida protegerse justo después de atacar.'),
    area: 'arc_stacks', boss: true, hp: 900, atk: 30, def: 4, exp: 900, w: 14, h: 40,
    weak: ['holy', 'fire'], absorb: ['dark'], noDeathFx: true, blood: '#3a1a5a', el: 'cut',
    introScene: 'doppel_pre', wake: wakeSeen(160), previewState: 'idle',
    reward: { relic: 'soul_wolf' },
    init(e) {
      e.phase = 1;
      e.facing = -1;
      e.setState('lurk');
      e.contact = false;
      e.walkT = 0;
      e.flipT = 0;
      e.trail = [];
      e.puddles = [];
      e.evadeCD = 0;
      e.last = '';
      e.bat = false;
      e.pose = G.alucardPose ? G.alucardPose('idle', 0) : null;
      dopResetCape(e);
      installDopTrail(e);
      e.hurtbox = () => (e.bat ? { x: e.cx - 9, y: e.cy - 7, w: 18, h: 14 } : { x: e.x, y: e.y, w: e.w, h: e.h });
    },
    onStart(e, g) {
      e.A = scanArena(e, g);
      e.perch = perches(g.room, 3).filter((p) => p.y < e.A.floor - 40 && p.x0 >= e.A.left - 8 && p.x1 <= e.A.right + 8);
      e.setState('appear');
      sfx('ink_splash', { vol: 0.8 });
    },
    onHitCheck: (e) => awake(e),
    onHit(e, hit, g) {
      bossOnHit(e, hit, g);
      if (e.dying) return;
      // ink spatters from the wound
      for (let i = 0; i < 6; i++) G.fx.particle(e.cx, e.cy, U.rnd(-2, 2), U.rnd(-2.5, 0), U.pick(INK_FX), 26, { grav: 0.15, size: 2 });
    },
    ai(e, g) {
      const pl = e.player, A = e.A;
      const st = e.state, t = e.stT;
      const p2 = e.phase === 2;
      const k = p2 ? 0.74 : 1;
      if (e.hp <= 0 && !e.dying) startDying(e, g);
      if (e.evadeCD > 0) e.evadeCD--;
      if (e.flipT > 0) e.flipT--;
      if (e.dropT > 0) e.dropT--; // one-way ledges become solid again after a drop
      const dx = pl.cx - e.cx, adx = Math.abs(dx);
      const face = () => (e.facing = dx < 0 ? -1 : 1);
      const go = (s, W) => {
        e.setState(s);
        e.W = W;
        e.dive = false;
        e.throwPh = 0;
      };
      const idle = (w) => {
        e.setState('idle');
        e.wait = Math.round(w * k);
        e.dive = false;
        e.bat = false;
        e.flying = false;
      };
      // --------------------------------------------------------------- appear (rises from the ink pool)
      if (st === 'appear') {
        e.vx = 0;
        if (t % 4 === 0) G.fx.particle(e.cx + U.rnd(-10, 10), e.fy, U.rnd(-0.4, 0.4), -U.rnd(1, 2.4), U.pick(INK_FX), 30, { size: 2, grav: 0.05 });
        if (t === 40) {
          sfx('transform', { vol: 0.8, pitch: 0.7 });
          G.fx.burst(e.cx, e.cy, '#8a4ad0', 20, 2.4, { glow: true });
        }
        if (t >= 64) {
          e.contact = true;
          idle(20);
        }
        e.move();
        e.pose = dopPose(e);
        dopSimCape(e);
        return;
      }
      // --------------------------------------------------------------- dying: melts into a pool of ink
      if (st === 'dying') {
        e.vx *= 0.85;
        e.bat = false;
        e.flying = false;
        e.move();
        e.melt = seg(t, 40, 150);
        if (t % 5 === 0) {
          for (let i = 0; i < 4; i++) G.fx.particle(e.cx + U.rnd(-8, 8), e.fy - 40 * (1 - e.melt) + U.rnd(0, 30), U.rnd(-1.2, 1.2), U.rnd(-1, 0.5), U.pick(INK_FX), 30, { grav: 0.12, size: 2 });
        }
        dyingBlasts(e, g, { x: e.cx - 14, y: e.fy - 44 + e.melt * 30, w: 28, h: 44 - e.melt * 30 }, 9, ['#c8a0ff', '#7a4ad0', '#3a1a5a', '#ffffff']);
        if (t === 150) {
          gfx.flash('#c8a0ff', 14);
          G.fx.burst(e.cx, e.fy - 8, '#b48cff', 40, 3, { glow: true });
          sfx('ink_splash', { vol: 1 });
        }
        e.pose = dopPose(e);
        dopSimCape(e);
        if (t >= 160) finishDying(e, g, e.cx, e.A ? e.A.floor : e.fy);
        return;
      }
      // --------------------------------------------------------------- phase change: the draft is rewritten
      if (st === 'rewrite') {
        e.vx *= 0.8;
        e.invuln = 4;
        if (t === 1) {
          phaseShift(e, g, '#7a4ad0');
          sfx('ghost_wail', { vol: 0.9, pitch: 0.8 });
        }
        if (t % 3 === 0) {
          const a = Math.random() * TAU;
          G.fx.particle(e.cx + Math.cos(a) * 40, e.cy + Math.sin(a) * 30, -Math.cos(a) * 1.6, -Math.sin(a) * 1.2, U.pick(INK_FX), 24, { glow: true, size: 2 });
        }
        if (t === 50) {
          sfx('spell_dark', { vol: 0.9 });
          G.fx.burst(e.cx, e.cy, '#8a4ad0', 36, 3.4, { glow: true });
          gfx.shake(4, 20);
        }
        e.move();
        e.pose = dopPose(e);
        dopSimCape(e);
        if (t >= 80) idle(10);
        return;
      }
      // --------------------------------------------------------------- reactive dodge (it watches your sword)
      if ((st === 'idle' || st === 'walk') && e.evadeCD <= 0 && pl.atk && pl.atk.t <= 2 && adx < 60 && e.onGround) {
        if (e.rnd.chance(p2 ? 0.45 : 0.3)) {
          face();
          go('backdash');
          e.vx = -e.facing * 5.4;
          e.invuln = 8;
          e.evadeCD = 80;
          sfx('backdash', { vol: 0.7 });
          G.fx.dust(e.cx, e.fy, 4);
        } else e.evadeCD = 30;
      }
      // --------------------------------------------------------------- states
      if (st === 'idle') {
        e.vx *= 0.7;
        if (e.onGround) face();
        if (wants2(e)) {
          go('rewrite');
          return;
        }
        if (--e.wait <= 0 && e.onGround) {
          const opts = [];
          const add = (s, w) => {
            if (s !== e.last || s === 'walk') for (let i = 0; i < w; i++) opts.push(s);
          };
          if (adx > 150) {
            add('walk', 4);
            add('daggers', 3);
            add('bat', 2);
            add('jumpAtk', 1);
            if (e.perch.some((q) => Math.abs(q.cx - pl.cx) < 190)) add('toLedge', 2);
            if (p2) add('hellfire', 3);
          } else if (adx > 60) {
            add('thrust', 4);
            add('daggers', 2);
            add('jumpAtk', 2);
            add('walk', 1);
            add('backdash', 1);
            if (p2) add('hellfire', 2);
            if (p2) add('bat', 1);
          } else {
            add('slash', 4);
            add('backdash', 3);
            add('jumpOver', 2);
            add('thrust', 1);
          }
          const s = U.pick(opts) || 'walk';
          e.last = s;
          face();
          if (s === 'thrust') go(s, Math.round(24 * k));
          else if (s === 'slash') {
            go(s, Math.round(22 * k));
            e.low = e.rnd.chance(0.4);
          } else if (s === 'backdash') {
            go(s);
            e.vx = -e.facing * 5.4;
            sfx('backdash', { vol: 0.7 });
          } else if (s === 'toLedge') {
            // the ledge closest to the player, so the sniping stays on screen
            e.ledge = e.perch.slice().sort((a, b) => Math.abs(a.cx - pl.cx) - Math.abs(b.cx - pl.cx))[0];
            go(s);
          } else go(s, Math.round(22 * k));
        }
      } else if (st === 'walk') {
        face();
        e.vx = e.facing * (p2 ? 2.1 : 1.7);
        e.walkT += Math.abs(e.vx) / 2;
        if (adx < 64 || t > 70 || P.blockedAhead(g.room, e, e.facing).wall) idle(6);
      } else if (st === 'backdash') {
        if (t > 7) e.vx *= 0.86;
        if (t % 3 === 0) e.trailPush = true;
        if (t >= 18) {
          // after a dodge it often counters
          if (e.rnd.chance(p2 ? 0.6 : 0.35)) {
            face();
            e.last = 'daggers';
            go('daggers', Math.round(18 * k));
          } else idle(14);
        }
      } else if (st === 'thrust') {
        const W = e.W;
        if (t < W) {
          e.vx *= 0.7;
          if (t === W - 9) {
            sfx('swing_light', { vol: 0.4, pitch: 1.6 });
            e.glint = 10;
          }
        } else if (t === W) {
          e.vx = e.facing * 6.4;
          sfx('swing_heavy', { vol: 0.8, pitch: 1.3 });
        } else if (t < W + 10) {
          e.vx *= 0.92;
          e.trailPush = t % 2 === 0;
          pHit(e, e.facing > 0 ? e.cx : e.cx - 48, e.fy - 36, 48, 13, e.atk + 4, 'cut');
        } else {
          e.vx *= 0.75;
        }
        if (t >= W + 10 + Math.round(30 * k)) idle(16);
      } else if (st === 'slash') {
        const W = e.W;
        e.vx *= 0.7;
        if (t === W) sfx('swing_light', { vol: 0.7, pitch: 1.1 });
        if (t >= W && t < W + 7) {
          const y = e.low ? e.fy - 22 : e.fy - 40;
          pHit(e, e.facing > 0 ? e.cx : e.cx - 40, y, 40, 20, e.atk, 'cut');
        }
        if (t >= W + 7 + Math.round(24 * k)) idle(14);
      } else if (st === 'daggers' || st === 'snipe') {
        e.vx *= 0.7;
        const W = e.W || 20;
        const n = p2 ? 3 : st === 'snipe' ? 2 : 1;
        e.throwPh = t < W ? t / W : Math.min(2.9, 1 + (t - W) / 6);
        for (let i = 0; i < n; i++) {
          if (t === W + i * 9) {
            const hy = e.fy - 30;
            if (st === 'snipe') {
              const a = Math.atan2(pl.cy - hy, pl.cx - e.cx);
              inkDaggerShot(e, g, e.cx + e.facing * 6, hy, Math.cos(a) * 4.2, Math.sin(a) * 4.2);
            } else inkDaggerShot(e, g, e.cx + e.facing * 8, hy + (i === 1 ? -10 : i === 2 ? 8 : 0), e.facing * 4.6, 0);
            sfx('dagger_throw', { vol: 0.7 });
            face();
          }
        }
        if (t >= W + n * 9 + Math.round(20 * k)) {
          if (st === 'snipe' && e.onLedge && e.snipes > 0) {
            e.snipes--;
            go('snipe', Math.round(16 * k));
          } else if (st === 'snipe') {
            // leap down from the ledge with a dive kick
            e.onLedge = false;
            face();
            go('jumpAtk', 0);
            e.vy = -3.5;
            e.vx = U.clamp(dx / 40, -2.5, 2.5);
            e.dropT = 14;
            e.onGround = false;
            e.dived = false;
          } else idle(18);
        }
      } else if (st === 'jumpAtk' || st === 'jumpOver') {
        // crouch → jump → (flip) → dive kick / land behind
        if (t === 1 && e.onGround) {
          e.vx = 0;
          e.dived = false;
        }
        if (t === 8 && e.onGround) {
          if (st === 'jumpOver') {
            e.vy = -6.6;
            e.vx = e.facing * 3.1;
            e.flipT = 22;
          } else {
            e.vy = -6.7;
            e.vx = U.clamp(dx / 55, -2.6, 2.6);
          }
          e.onGround = false;
          sfx('jump', { vol: 0.6, pitch: 0.9 });
        }
        if (t > 8 && !e.onGround) {
          if (st === 'jumpAtk' && !e.dived && e.vy > -0.6) {
            // hang for an instant at the apex (telegraph), then dive
            if (!e.hang) {
              e.hang = 1;
              e.flipT = 14;
              e.vy = -2.2;
              sfx('double_jump', { vol: 0.6, pitch: 0.8 });
              G.fx.ring(e.cx, e.fy, '#8a4ad0');
            } else if (e.flipT <= 0) {
              face();
              e.dived = true;
              e.dive = true;
              e.vx = e.facing * 4.6;
              e.vy = 5.6;
              sfx('wolf_dash', { vol: 0.6, pitch: 0.8 });
            }
          }
          if (e.dive && t % 2 === 0) e.trailPush = true;
        }
        if (t > 10 && e.onGround) {
          if (e.dive) {
            gfx.shake(3, 10);
            G.fx.dust(e.cx, e.fy, 6);
            sfx('ink_splash', { vol: 0.7 });
            if (p2) {
              for (const d of [-1, 1]) {
                const w = e.shoot({
                  x: e.cx + d * 10, y: e.fy - 7, vx: d * 3, w: 12, h: 14, el: 'dark', color: '#7a4ad0', life: 40, wall: true,
                  drawFn(p, ctx, sx, sy) {
                    ctx.fillStyle = '#1a1228';
                    ctx.fillRect(sx - 6, sy - 2 - Math.abs(Math.sin(p.t * 0.5)) * 6, 12, 9);
                    ctx.fillStyle = '#8a4ad0';
                    ctx.fillRect(sx - 5, sy - 3 - Math.abs(Math.sin(p.t * 0.5)) * 6, 10, 2);
                  },
                });
                w.owner = e;
              }
            }
          }
          e.hang = 0;
          e.dive = false;
          e.vx = 0;
          face();
          go('land');
          e.wait2 = Math.round((e.dived ? 30 : 14) * k);
        }
        if (t > 200) idle(10);
      } else if (st === 'land') {
        e.vx *= 0.6;
        if (t >= (e.wait2 || 14)) idle(10);
      } else if (st === 'toLedge') {
        const L = e.ledge;
        if (!L) {
          idle(10);
        } else {
          const tx = U.clamp(e.cx, L.x0 + 14, L.x1 - 14) === e.cx && e.fy <= L.y + 2 ? e.cx : (L.x0 + L.x1) / 2;
          if (e.onGround && e.fy > L.y + 4) {
            // run under the ledge, then jump
            const want = U.clamp(tx, L.x0 - 10, L.x1 + 10);
            const d = want - e.cx;
            if (Math.abs(d) > 26) {
              e.facing = d < 0 ? -1 : 1;
              e.vx = e.facing * 2.6;
              e.walkT += 1.3;
            } else if (!e.jumped) {
              e.jumped = true;
              e.vy = -6.75;
              e.vx = U.clamp(((L.x0 + L.x1) / 2 - e.cx) / 40, -1.6, 1.6);
              e.onGround = false;
              sfx('jump', { vol: 0.6, pitch: 0.9 });
            } else {
              e.jumped = false;
              idle(10);
            }
          } else if (!e.onGround) {
            if (e.jumped && !e.dj && e.vy > -1) {
              e.dj = true;
              e.vy = -5.8;
              e.flipT = 22;
              sfx('double_jump', { vol: 0.6 });
              G.fx.ring(e.cx, e.fy, '#8a4ad0');
            }
          } else {
            // landed on the ledge: snipe from above
            e.jumped = e.dj = false;
            e.vx = 0;
            e.onLedge = true;
            e.snipes = p2 ? 2 : 1;
            face();
            go('snipe', Math.round(16 * k));
          }
          if (t > 240) {
            e.jumped = e.dj = false;
            idle(10);
          }
        }
      } else if (st === 'bat') {
        // transform, swoop through the player (twice in phase 2), turn back
        if (t === 1) {
          e.bat = true;
          e.flying = true;
          e.vx = e.vy = 0;
          e.swoops = p2 ? 2 : 1;
          e.bt = 0;
          sfx('transform', { vol: 0.8 });
          G.fx.burst(e.cx, e.cy, '#5c2c9c', 18, 2.2);
          e.y -= 12;
        }
        e.bt++;
        if (e.bt === 1) {
          e.from = { x: e.cx, y: e.cy };
          // first fly up, above and beside the player
          e.goal = { x: U.clamp(pl.cx + (e.cx < pl.cx ? -90 : 90), A.left + 30, A.right - 30), y: Math.max(A.top + 30, pl.cy - 80) };
        }
        const T1 = Math.round(40 * k), T2 = T1 + Math.round(22 * k), T3 = T2 + Math.round(46 * k);
        if (e.bt <= T1) {
          const q = ease(e.bt / T1);
          e.x = U.lerp(e.from.x, e.goal.x, q) - e.w / 2;
          e.y = U.lerp(e.from.y, e.goal.y, q) - Math.sin(q * Math.PI) * 20 - e.h / 2;
          e.facing = e.goal.x > e.from.x ? 1 : -1;
        } else if (e.bt <= T2) {
          // hover: shriek (telegraph)
          if (e.bt === T1 + 1) {
            sfx('bat_screech', { vol: 0.8 });
            e.aim = { x: pl.cx, y: pl.cy };
            e.facing = pl.cx < e.cx ? -1 : 1;
          }
          e.y += Math.sin(e.t * 0.5) * 0.6;
        } else if (e.bt <= T3) {
          // swoop in a U-curve through the aimed point
          if (e.bt === T2 + 1) {
            e.s0 = { x: e.cx, y: e.cy };
            e.s2 = { x: U.clamp(e.aim.x + (e.aim.x - e.cx) * 1.1, A.left + 24, A.right - 24), y: e.cy };
          }
          const q = (e.bt - T2) / (T3 - T2);
          const bx = U.lerp(e.s0.x, e.s2.x, q);
          const by = U.lerp(e.s0.y, e.s2.y, q) + Math.sin(q * Math.PI) * (e.aim.y - e.s0.y + 6);
          e.facing = e.s2.x > e.s0.x ? 1 : -1;
          e.x = bx - e.w / 2;
          e.y = by - e.h / 2;
          if (e.bt % 2 === 0) e.trailPush = true;
        } else if (--e.swoops > 0) {
          e.bt = T1;
          e.aim = { x: pl.cx, y: pl.cy };
          sfx('bat_screech', { vol: 0.8, pitch: 1.2 });
        } else {
          // turn back into the dhampir and drop down
          e.bat = false;
          e.flying = false;
          e.vy = -2;
          e.vx = 0;
          sfx('transform', { vol: 0.7, pitch: 0.8 });
          G.fx.burst(e.cx, e.cy, '#5c2c9c', 18, 2.2);
          go('jumpOver');
          e.setState('fallIn');
        }
        // stay inside the arena
        e.x = U.clamp(e.x, A.left + 2, A.right - e.w - 2);
        e.y = U.clamp(e.y, A.top + 2, A.floor - e.h);
        e.pose = dopPose(e);
        dopSimCape(e);
        e.trailTick(g);
        return;
      } else if (st === 'fallIn') {
        e.vx *= 0.9;
        if (e.onGround && t > 2) {
          go('land');
          e.wait2 = Math.round(18 * k);
        }
        if (t > 160) idle(4);
      } else if (st === 'hellfire') {
        e.vx *= 0.6;
        const W = Math.round(30 * k);
        if (t < W && t % 2 === 0) {
          const a = Math.random() * TAU;
          G.fx.particle(e.cx + Math.cos(a) * 22, e.fy - 44 + Math.sin(a) * 16, -Math.cos(a) * 1.1, -Math.sin(a) * 0.8, U.pick(INK_FX), 20, { glow: true, size: 2 });
        }
        if (t === 2) sfx('magic_cast', { vol: 0.8, pitch: 0.7 });
        [-0.24, 0, 0.24].forEach((a, i) => {
          if (t === W + i * 7) {
            face();
            inkFireball(e, g, e.cx + e.facing * 10, e.fy - 30, Math.cos(a) * 3.3 * e.facing, Math.sin(a) * 3.3);
            sfx('fireball', { vol: 0.7, pitch: 0.7 });
          }
        });
        if (t >= W + 14 + Math.round(30 * k)) idle(16);
      }
      e.move();
      if (e.onGround && Math.abs(e.vx) > 0.3) e.walkT += Math.abs(e.vx) / 2;
      e.pose = dopPose(e);
      dopSimCape(e);
      e.trailTick(g);
    },
    draw(e, ctx, sx, sy) {
      if (!e.trailTick) installDopTrail(e);
      const g = G.game;
      const pre = e.preview;
      // ink pool and drips on the floor
      if (!pre) {
        for (const pd of e.puddles) {
          const a = Math.min(1, pd.life / 40);
          ctx.globalAlpha = 0.75 * a;
          ctx.fillStyle = '#120a1e';
          ctx.fillRect(Math.round(pd.x - g.camx - pd.w / 2), Math.round(pd.y - g.camy - 1), Math.round(pd.w), 2);
          ctx.fillStyle = '#3a1a5a';
          ctx.fillRect(Math.round(pd.x - g.camx - pd.w / 4), Math.round(pd.y - g.camy - 2), Math.round(pd.w / 2), 1);
        }
        ctx.globalAlpha = 1;
        // afterimages
        for (const a of e.trail) {
          ctx.globalAlpha = (a.life / 16) * 0.5;
          gfx.drawAnchored(a.cv, a.x - g.camx, a.y - g.camy, a.ax, a.ay, a.flip, null, ctx);
        }
        ctx.globalAlpha = 1;
      }
      if (e.state === 'lurk' || (e.state === 'appear' && e.stT < 24)) {
        // a pool of ink that bubbles; once awake (during the intro) a figure rises from it
        const t = e.t;
        if (e.started && e.wakeT == null) e.wakeT = t;
        const rise = e.wakeT != null ? Math.min(1, (t - e.wakeT) / 70) : 0;
        ctx.fillStyle = '#0d0916';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1, 22 + rise * 4, 3.5, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#3a1a5a';
        for (let i = 0; i < 4; i++) {
          const bx = sx - 14 + ((i * 9 + Math.floor(t / 7) * 5) % 28), by = sy - 2 - (Math.sin(t * 0.2 + i) > 0.7 ? 2 : 0);
          ctx.fillRect(bx, by, 2, 1);
        }
        lit(e, ctx, sx, sy - 6, 40, '#7a4ad0', 0.5);
        if (pre || rise <= 0) {
          if (!pre) return;
        } else {
          // a silhouette pulled up out of the pool
          e.facing = e.player.cx < e.cx ? -1 : 1;
          e.pose = G.alucardPose(rise < 0.6 ? 'kneel' : 'idle', t);
          const cv = dopRender(e);
          ctx.save();
          ctx.beginPath();
          ctx.rect(sx - 64, sy - 90, 128, 90);
          ctx.clip();
          gfx.drawAnchored(cv, sx, sy + Math.round((1 - rise) * 44), 64, 76, e.facing < 0, null, ctx);
          ctx.restore();
          if (t % 3 === 0) G.fx.particle(e.cx + U.rnd(-10, 10), e.fy - U.rnd(0, 30) * rise, 0, U.rnd(0.2, 0.8), U.pick(INK_FX), 26, { size: 2, grav: 0.08 });
          return;
        }
      }
      if (pre && !e.pose) return;
      if (pre) e.pose = G.alucardPose('idle', e.t);
      if (e.bat) {
        let img = dopBat(Math.floor(e.t / 3) % 4);
        put(e, ctx, img, sx, sy - e.h / 2, 22, 15, e.facing < 0);
        lit(e, ctx, sx, sy - e.h / 2, 50, '#8a4ad0', 0.6);
        return;
      }
      const cv = dopRender(e);
      let img = cv;
      if (e._flashDraw) {
        const w = gfx.ctxOf(e.cvw);
        w.globalCompositeOperation = 'source-over';
        w.clearRect(0, 0, 128, 84);
        w.drawImage(cv, 0, 0);
        w.globalCompositeOperation = 'source-in';
        w.fillStyle = '#ffffff';
        w.fillRect(0, 0, 128, 84);
        w.globalCompositeOperation = 'source-over';
        img = e.cvw;
      }
      let dy = 0;
      if (e.state === 'dying' && e.melt > 0) {
        // melting: squash into the floor
        const m = e.melt;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(1 + m * 0.6, 1 - m * 0.92);
        gfx.drawAnchored(img, 0, 0, 64, 76, e.facing < 0, null, ctx);
        ctx.restore();
      } else gfx.drawAnchored(img, sx, sy + dy, 64, 76, e.facing < 0, null, ctx);
      // sword glint before a lunge
      if (e.glint > 0 && !pre) {
        e.glint--;
        const gx = sx + e.facing * 14, gy = sy - 34;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#ffffff';
        const r = 6 - Math.abs(e.glint - 5);
        ctx.fillRect(gx - r, gy, r * 2 + 1, 1);
        ctx.fillRect(gx, gy - r, 1, r * 2 + 1);
        ctx.restore();
      }
      lit(e, ctx, sx, sy - 24, e.phase === 2 ? 64 : 50, '#7a4ad0', 0.65);
      lit(e, ctx, sx + e.facing * 2, sy - 38, 16, '#ff4aa8', 0.6);
    },
  });
  // renders the doppel's current pose into its private canvas
  function dopRender(e) {
    const cv = dopCanvas(e);
    const f = e.facing;
    const pose = e.pose || G.alucardPose('idle', e.t);
    const capeL = e.cape.map((p) => ({ x: (p.x - e.cx) * f, y: p.y - e.fy }));
    const hairL = e.hair.map((p) => ({ x: (p.x - e.cx) * f, y: p.y - e.fy }));
    const armed = ['thrust', 'slash'].includes(e.state);
    const opts = { col: INK, capeCol: INK.capeO, liningCol: INK.capeI, extraPal: INK_PAL, eyeCol: e.phase === 2 ? '#ffffff' : INK.eye };
    if (armed) opts.weapon = { item: INK_SWORD };
    const res = G.drawAlucard(pose, capeL, hairL, opts);
    const c = gfx.ctxOf(cv);
    c.clearRect(0, 0, 128, 84);
    c.drawImage(res.canvas, 0, 0);
    return cv;
  }
  function installDopTrail(e) {
    const pool = [];
    e.trailTick = function (g) {
      // ink drips and floor puddles
      if (e.onGround && Math.abs(e.vx) > 0.8 && e.t % 6 === 0) e.puddles.push({ x: e.cx - e.facing * 4, y: e.fy, w: 8 + Math.random() * 8, life: 90 });
      if (e.t % (e.phase === 2 ? 4 : 7) === 0) G.fx.particle(e.cx - e.facing * 6 + U.rnd(-4, 4), e.fy - U.rnd(8, 30), 0, 0.4, U.pick(INK_FX), 26, { size: 1, grav: 0.08 });
      for (const p of e.puddles) p.life--;
      U.removeIf(e.puddles, (p) => p.life <= 0);
      if (e.puddles.length > 40) e.puddles.shift();
      for (const a of e.trail) a.life--;
      U.removeIf(e.trail, (a) => {
        if (a.life <= 0) a.slot.busy = false;
        return a.life <= 0;
      });
      if (e.trailPush && e.cv) {
        e.trailPush = false;
        let slot = pool.find((s) => !s.busy);
        if (!slot && pool.length < 8) pool.push((slot = { cv: gfx.makeCanvas(128, 84), busy: false }));
        if (slot) {
          const c = gfx.ctxOf(slot.cv);
          c.globalCompositeOperation = 'source-over';
          c.clearRect(0, 0, 128, 84);
          c.drawImage(e.bat ? dopBat(Math.floor(e.t / 3) % 4) : e.cv, e.bat ? 42 : 0, e.bat ? 40 : 0);
          c.globalCompositeOperation = 'source-in';
          c.fillStyle = '#6a3ab8';
          c.fillRect(0, 0, 128, 84);
          c.globalCompositeOperation = 'source-over';
          slot.busy = true;
          e.trail.push({ cv: slot.cv, slot, x: e.cx, y: e.bat ? e.cy + 21 : e.fy, ax: 64, ay: 76, flip: e.facing < 0, life: 16 });
        }
      }
    };
  }


  // =====================================================================================
  //  3. ECHO OF THE BELMONT  (hun_echo)
  // =====================================================================================
  // A spectral hunter painted over Alucard's pose kinematics (G.alucardPose), with a
  // verlet whip, the classic sub-weapons, mist teleports and the Grand Cross.
  const EC = { deep: '#10243c', dark: '#1e4266', mid: '#346a9c', coat: '#4a86bc', light: '#7cbce4', pale: '#b4e6fa', white: '#eefcff', skin: '#c4e8f6', skinS: '#86b8d8' };
  const EC_PAL = Object.values(EC);
  const EC_W = 96, EC_H = 80, EC_AX = 48, EC_AY = 72;

  // paint the hunter for a pose into canvas cv; tails: headband tail points (local)
  function paintHunter(cv, pose, tails, o) {
    const c = gfx.ctxOf(cv);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, EC_W, EC_H);
    c.translate(EC_AX, EC_AY);
    c.scale(1.1, 1.1);
    if (pose.rot) {
      c.translate(0, -20);
      c.rotate(pose.rot);
      c.translate(0, 20);
    }
    const hx = pose.hipX, hy = pose.hipY, ln = pose.lean;
    const sl = Math.sin(ln), cl = Math.cos(ln);
    const shX = hx + sl * 12.5, shY = hy - cl * 12.5;
    const neckX = hx + sl * 14.5, neckY = hy - cl * 14.5;
    const headX = hx + sl * 19 + Math.sin(pose.head) * 1, headY = hy - cl * 19;
    const legPts = (l, off) => {
      const kx = hx + off + Math.sin(l[0]) * 11, ky = hy + Math.cos(l[0]) * 11;
      const a2 = l[0] - l[1];
      return [hx + off, hy, kx, ky, kx + Math.sin(a2) * 11, ky + Math.cos(a2) * 11];
    };
    const armPts = (a, off) => {
      const sx = shX + off, sy = shY;
      const ex = sx + Math.sin(a[0]) * 8, ey = sy + Math.cos(a[0]) * 8;
      const a2 = a[0] + a[1];
      return [sx, sy, ex, ey, ex + Math.sin(a2) * 7.5, ey + Math.cos(a2) * 7.5, a2];
    };
    const LB = legPts(pose.legB, -1), LF = legPts(pose.legF, 1);
    const AB = armPts(pose.armB, -2), AF = armPts(pose.armF, 1);
    const L = (x1, y1, x2, y2, w, col) => gfx.limb(c, x1, y1, x2, y2, w, col);
    // headband tails (behind)
    if (tails && tails.length > 1) {
      for (let i = 0; i < tails.length - 1; i++) L(tails[i].x, tails[i].y, tails[i + 1].x, tails[i + 1].y, i < 2 ? 2.2 : 1.6, i % 2 ? EC.pale : EC.white);
    }
    // back arm, back leg
    L(AB[0], AB[1], AB[2], AB[3], 3.6, EC.dark);
    L(AB[2], AB[3], AB[4], AB[5], 3.2, EC.dark);
    gfx.circle(c, AB[4], AB[5], 1.8, EC.mid);
    L(LB[0], LB[1], LB[2], LB[3], 4.4, EC.deep);
    L(LB[2], LB[3], LB[4], LB[5], 4, EC.dark);
    c.fillStyle = EC.dark;
    c.fillRect(LB[4] - 2, LB[5] - 2.4, 6, 2.8);
    // long coat tails
    const fl = pose.coatFlare || 0;
    gfx.poly(c, [hx - 4, hy - 4, hx + 4, hy - 4, hx + 6 + fl * 2, hy + 11, hx + 1, hy + 13, hx - 4 - fl * 5, hy + 14 - fl * 2, hx - 8 - fl * 4, hy + 10], EC.mid);
    gfx.poly(c, [hx - 3, hy - 2, hx - 6 - fl * 4, hy + 10, hx - 4 - fl * 5, hy + 14 - fl * 2, hx - 1, hy + 4], EC.dark);
    // front leg + boot
    L(LF[0], LF[1], LF[2], LF[3], 4.6, EC.dark);
    L(LF[2], LF[3], LF[4], LF[5], 4.2, EC.mid);
    L(LF[2] + 0.6, LF[3] + 1.5, LF[4] + 0.6, LF[5] - 3, 1, EC.light);
    c.fillStyle = EC.mid;
    c.fillRect(LF[4] - 2, LF[5] - 2.6, 6.5, 3);
    // torso: tunic + open coat
    gfx.poly(c, [hx - 4.2, hy + 1, hx + 4.4, hy + 1, shX + 5.2, shY + 1, neckX + 2, neckY, neckX - 3, neckY, shX - 5.2, shY + 1], EC.coat);
    gfx.poly(c, [hx - 1, hy, hx + 4, hy, shX + 4.4, shY + 2, neckX + 1.5, neckY + 1], EC.light);
    // bandolier + belt with the cross buckle
    L(shX - 3, shY + 1, hx + 3.5, hy - 1, 1.4, EC.deep);
    L(hx - 4, hy - 0.5, hx + 4.4, hy - 0.5, 2, EC.deep);
    c.fillStyle = EC.white;
    c.fillRect(hx - 0.5, hy - 2, 1.4, 3);
    c.fillRect(hx - 1.3, hy - 1.2, 3, 1.2);
    // coiled whip on the hip
    if (o && o.coiled) {
      c.strokeStyle = EC.pale;
      c.lineWidth = 1.2;
      c.beginPath();
      c.ellipse(hx - 4, hy + 2, 3, 2.4, 0, 0, TAU);
      c.stroke();
    }
    // shoulder mantle
    gfx.poly(c, [neckX - 5, neckY - 1, neckX + 3, neckY - 1, shX + 6, shY + 4, shX - 7, shY + 5], EC.mid);
    gfx.poly(c, [neckX - 4, neckY, neckX + 2, neckY, shX + 4, shY + 3, shX - 2, shY + 3], EC.light);
    // head: jaw, hair, headband
    gfx.ellipse(c, headX + 0.4, headY + 0.3, 3.9, 4.6, 0, EC.skin);
    c.fillStyle = EC.skinS;
    c.fillRect(headX - 2.5, headY + 2.4, 5.6, 1.6);
    gfx.poly(c, [headX - 4.6, headY - 1, headX - 3.4, headY - 5.4, headX - 0.4, headY - 6.6, headX + 3, headY - 6.2, headX + 4.4, headY - 3.6, headX + 2, headY - 3.8, headX - 1, headY - 2.4, headX - 3.6, headY + 1.6], EC.mid);
    gfx.poly(c, [headX - 3.4, headY - 5.4, headX - 5.6, headY - 7.4, headX - 1.6, headY - 6.4], EC.mid);
    gfx.poly(c, [headX + 0.6, headY - 6.4, headX + 1, headY - 9, headX + 2.6, headY - 6.2], EC.mid);
    L(headX - 4.2, headY - 3.4, headX + 4.2, headY - 4.2, 1.6, EC.white);
    c.fillStyle = EC.white;
    c.fillRect(headX + 1.8, headY - 1, 1.6, 1);
    // front arm (glove)
    L(AF[0], AF[1], AF[2], AF[3], 3.8, EC.coat);
    L(AF[2], AF[3], AF[4], AF[5], 3.4, EC.coat);
    L(AF[0] + 0.6, AF[1], AF[2] + 0.6, AF[3], 1, EC.light);
    gfx.circle(c, AF[4], AF[5], 2, EC.mid);
    // whip handle / held sub-weapon
    const ha = AF[6];
    if (o && o.handle) L(AF[4], AF[5], AF[4] + Math.sin(ha) * 5, AF[5] + Math.cos(ha) * 5, 2, EC.deep);
    if (o && o.held === 'axe') {
      L(AF[4], AF[5], AF[4] + Math.sin(ha) * 9, AF[5] + Math.cos(ha) * 9, 1.6, EC.dark);
      gfx.poly(c, [AF[4] + Math.sin(ha) * 9, AF[5] + Math.cos(ha) * 9, AF[4] + Math.sin(ha + 0.6) * 12, AF[5] + Math.cos(ha + 0.6) * 12, AF[4] + Math.sin(ha + 0.25) * 6, AF[5] + Math.cos(ha + 0.25) * 6], EC.white);
    } else if (o && o.held === 'cross') {
      const x = AF[4] + Math.sin(ha) * 3, y = AF[5] + Math.cos(ha) * 3;
      c.fillStyle = EC.white;
      c.fillRect(x - 1, y - 5, 2.4, 10);
      c.fillRect(x - 4, y - 2, 8.4, 2.4);
    } else if (o && o.held === 'vial') {
      c.fillStyle = EC.white;
      c.fillRect(AF[4] - 1.5, AF[5] - 4, 3, 5);
      c.fillStyle = EC.light;
      c.fillRect(AF[4] - 1.5, AF[5] - 2, 3, 3);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    gfx.pixelize(cv, { palette: EC_PAL, outline: OUT, threshold: 96 });
    const s = 1.1;
    return { hand: { x: AF[4] * s, y: AF[5] * s, a: ha }, head: { x: headX * s, y: headY * s } };
  }
  function echoPose(e) {
    const st = e.state, t = e.stT, W = e.W || 24;
    const whip = (ph, crouch) => G.alucardPose('attack', e.t, { phase: ph, wtype: 'whip', crouch });
    switch (st) {
      case 'lash':
      case 'lowlash':
        if (t < W) return whip((t / W) * 0.999, st === 'lowlash');
        if (t < W + 8) return whip(1 + (t - W) / 8, st === 'lowlash');
        return whip(2 + Math.min(0.99, (t - W - 8) / 16), st === 'lowlash');
      case 'airlash': {
        if (e.onGround && !e.lashT) return G.alucardPose(t < 8 ? 'crouch' : 'land', e.t);
        if (e.lashT > 0) {
          const p = whip(1.5);
          p.armF = [2.0, 0.1];
          p.lean = 0.25;
          return p;
        }
        return G.alucardPose(e.vy < 0 ? 'jump' : 'fall', e.t);
      }
      case 'axe':
      case 'cross':
      case 'holy': {
        const p = G.alucardPose('attack', e.t, { phase: t < W ? (t / W) * 0.99 : 1.5, wtype: 'great' });
        return p;
      }
      case 'walk':
        return G.alucardPose('walk', e.walkT);
      case 'grand':
      case 'kneel':
        return G.alucardPose('kneel', e.t);
      case 'dying':
        return t < 24 ? G.alucardPose('hurt', e.t) : G.alucardPose('kneel', e.t);
      default:
        if (!e.onGround) return G.alucardPose(e.vy < 0 ? 'jump' : 'fall', e.t);
        return G.alucardPose('idle', e.t);
    }
  }
  function echoCanvas(e) {
    if (!e.cv) e.cv = gfx.makeCanvas(EC_W, EC_H, true);
    return e.cv;
  }
  function echoSim(e) {
    const f = e.facing, pose = e.pose;
    const ln = pose ? pose.lean : 0;
    const hx = e.cx + ((pose ? pose.hipX + Math.sin(ln) * 19 : 0) * 1.1 - 4) * f;
    const hy = e.fy + (pose ? pose.hipY - Math.cos(ln) * 19 : -40) * 1.1 - 4;
    chainSim(e.tails, hx, hy, 3.4, 0.12, -f * 0.25 - e.vx * 0.14 + Math.sin(e.t * 0.13) * 0.05, -0.02, e.fy - 2, 0.86);
    // the whip hangs from the hand when not lashing
    if (e.hand) {
      const ax = e.cx + e.hand.x * f, ay = e.fy + e.hand.y;
      e.whipA = { x: ax, y: ay };
      if (!e.lashing) chainSim(e.whip, ax, ay, 6.6, 0.32, -f * 0.1 - e.vx * 0.1, 0, e.fy - 1, 0.9);
    }
  }
  function echoWhipLash(e, ang, k) {
    // straighten the whip along ang (k: 0..1 extension), with a travelling wave
    const A = e.whipA;
    if (!A) return;
    const n = e.whip.length;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const r = f * 6.6 * (n - 1) * k;
      const wave = Math.sin(f * 7 - e.stT * 1.4) * (1 - k) * 6 * f;
      const p = e.whip[i];
      p.px = p.x;
      p.py = p.y;
      p.x = A.x + Math.cos(ang) * r - Math.sin(ang) * wave;
      p.y = A.y + Math.sin(ang) * r + Math.cos(ang) * wave;
    }
  }
  function echoAxe(e, g, vx, vy) {
    const p = e.shoot({
      x: e.cx + e.facing * 8, y: e.fy - 40, vx, vy, grav: 0.2, w: 16, h: 16, el: 'cut', color: '#b4e6fa', life: 220, wall: false,
      upd(p) {
        if (p.t % 12 === 0) sfx('axe_throw', { vol: 0.25, pitch: 1.2 });
        if (p.y > e.A.floor + 40) p.dead = true;
      },
      drawFn(p, ctx, sx, sy) {
        const img = rspr('echoaxe', 16, p.t * 0.35 * (vx < 0 ? -1 : 1), 26, 26, EC_PAL, (c) => {
          gfx.limb(c, -8, 0, 8, 0, 2.2, EC.dark);
          gfx.poly(c, [3, -2, 10, -8, 12, 0, 10, 8, 3, 2], EC.white);
          gfx.poly(c, [4, -1, 9, -5, 10, 0, 6, 1], EC.pale);
        });
        ctx.globalAlpha = 0.9;
        ctx.drawImage(img, sx - 13, sy - 13);
        ctx.globalAlpha = 1;
        glow(ctx, sx, sy, 12, '#7cbce4', 0.35);
      },
    });
    p.owner = e;
  }
  function echoCross(e, g) {
    const f = e.facing;
    const y0 = e.fy - 36;
    const p = e.shoot({
      x: e.cx + f * 10, y: y0, vx: f * 5.6, vy: 0, w: 16, h: 16, el: 'holy', color: '#eefcff', life: 190, wall: false, pierce: true,
      upd(p) {
        p.vx -= f * 0.12;
        if (p.t % 14 === 0) sfx('cross_throw', { vol: 0.3 });
        // returns to its thrower
        if (p.t > 50 && Math.abs(p.cx - e.cx) < 14) p.dead = true;
        if (p.t > 46) p.vy = U.clamp((e.fy - 36 - p.cy) * 0.05, -1, 1);
      },
      drawFn(p, ctx, sx, sy) {
        const img = rspr('echocross', 12, p.t * 0.3, 24, 24, EC_PAL, (c) => {
          c.fillStyle = EC.white;
          c.fillRect(-1.6, -7, 3.2, 14);
          c.fillRect(-7, -1.6, 14, 3.2);
          c.fillStyle = EC.light;
          c.fillRect(-0.6, -6, 1.2, 12);
        });
        glow(ctx, sx, sy, 14, '#b4e6fa', 0.5);
        ctx.drawImage(img, sx - 12, sy - 12);
        lit(null, ctx, sx, sy, 40, '#b4e6fa', 0.6);
      },
    });
    p.owner = e;
  }
  function echoHoly(e, g, vx) {
    const p = e.shoot({
      x: e.cx + e.facing * 8, y: e.fy - 34, vx, vy: -2.6, grav: 0.26, w: 6, h: 8, el: 'holy', color: '#b4e6fa', life: 200, wall: true,
      drawFn(p, ctx, sx, sy) {
        ctx.fillStyle = '#eefcff';
        ctx.fillRect(sx - 2, sy - 4, 4, 7);
        ctx.fillStyle = '#4a86bc';
        ctx.fillRect(sx - 2, sy - 1, 4, 4);
      },
      onWall(p, g) {
        sfx('holy_water', { vol: 0.8 });
        const fy = Math.floor(p.cy / 16) * 16;
        for (let i = -2; i <= 2; i++) {
          g.later(Math.abs(i) * 5, () => {
            const fl = e.shoot({
              x: p.cx + i * 15, y: fy - 14, vx: 0, w: 12, h: 26, el: 'holy', color: '#b4e6fa', life: 70, wall: false, pierce: true,
              upd(q) {
                if (!P.floorAt(g.room, q.cx, q.fy + 2) && q.t < 30) q.y += 2;
              },
              drawFn(q, ctx, sx, sy) {
                const a = Math.min(1, q.life / 16, q.t / 6);
                const h = 18 + Math.sin(q.t * 0.6 + i) * 6;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = U.rgba('#4a86bc', 0.7 * a);
                ctx.fillRect(sx - 5, sy + 13 - h, 10, h);
                ctx.fillStyle = U.rgba('#eefcff', 0.85 * a);
                ctx.fillRect(sx - 2, sy + 13 - h + 4, 4, h - 6);
                ctx.restore();
                lit(null, ctx, sx, sy, 30, '#7cbce4', 0.6 * a);
              },
            });
            fl.owner = e;
          });
        }
      },
    });
    p.owner = e;
  }
  // Grand Cross: columns of light rain on the arena except two safe gaps
  function echoGrand(e, g) {
    const A = e.A, pl = e.player;
    const colW = 32;
    const x0 = A.left, x1 = A.right;
    // two gaps near the player (one on each side when possible), away from the Echo
    const side = pl.cx < e.cx ? -1 : 1;
    let g1 = U.clamp(pl.cx + side * U.rnd(50, 90), x0 + 40, x1 - 40);
    let g2 = U.clamp(pl.cx - side * U.rnd(70, 120), x0 + 40, x1 - 40);
    if (Math.abs(g1 - e.cx) < 50) g1 = U.clamp(e.cx + side * 80, x0 + 40, x1 - 40);
    if (Math.abs(g2 - e.cx) < 50) g2 = U.clamp(e.cx - side * 80, x0 + 40, x1 - 40);
    if (Math.abs(g1 - g2) < 70) g2 = U.clamp(g1 + (g2 < g1 ? -90 : 90), x0 + 40, x1 - 40);
    e.gaps = [g1, g2];
    const safe = (x) => Math.abs(x - g1) < 30 || Math.abs(x - g2) < 30;
    const cols = [];
    for (let x = x0; x < x1; x += colW) {
      const cx = x + colW / 2;
      if (!safe(cx)) cols.push(cx);
    }
    const top = A.top, floor = A.floor;
    const T = 64; // telegraph
    for (const cx of cols) {
      fxEnt(g, {
        owner: e, x: cx, y: floor, life: T, z: 2,
        drawFn(q, ctx, sx, sy) {
          const k = q.t / T;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = U.rgba('#b4e6fa', 0.08 + 0.16 * k + (q.t % 10 < 5 ? 0.06 : 0));
          ctx.fillRect(sx - 11, Math.round(top - G.game.camy), 22, Math.round(floor - top));
          ctx.fillStyle = U.rgba('#eefcff', 0.12 + 0.2 * k);
          ctx.fillRect(sx - 1, Math.round(top - G.game.camy), 2, Math.round(floor - top));
          ctx.fillStyle = U.rgba('#eefcff', 0.4 + 0.4 * k);
          ctx.fillRect(sx - 1, sy - 9, 2, 8);
          ctx.fillRect(sx - 4, sy - 7, 8, 2);
          ctx.restore();
        },
        done(q, g) {
          const pillar = e.shoot({
            x: cx, y: (top + floor) / 2, vx: 0, w: 24, h: floor - top, el: 'holy', dmg: Math.round(e.atk * 1.15), magic: true, unblockable: true,
            life: 26, wall: false, pierce: true, color: '#eefcff',
            drawFn(p, ctx, sx, sy) {
              const a = Math.min(1, p.life / 8);
              const h = floor - top;
              const fall = Math.min(1, p.t / 4);
              const y0 = sy - h / 2;
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              ctx.fillStyle = U.rgba('#4a86bc', 0.55 * a);
              ctx.fillRect(sx - 13, y0, 26, h * fall);
              ctx.fillStyle = U.rgba('#eefcff', 0.9 * a);
              ctx.fillRect(sx - 6, y0, 12, h * fall);
              ctx.restore();
              lit(null, ctx, sx, sy + h / 2 - 20, 60, '#b4e6fa', 0.8 * a);
            },
          });
          pillar.owner = e;
          if (p_once(e, 'grandHit')) {
            sfx('spell_holy', { vol: 1 });
            sfx('thunder', { vol: 0.6, pitch: 1.3 });
            gfx.flash('#eefcff', 8);
            gfx.shake(4, 16);
          }
        },
      });
    }
    // warm golden light marks the two safe gaps
    for (const gx of e.gaps)
      fxEnt(g, {
        owner: e, x: gx, y: floor, life: T + 26,
        drawFn(q, ctx, sx, sy) {
          if (q.t % 3 === 0) G.fx.particle(gx + U.rnd(-16, 16), floor - 2, 0, -U.rnd(0.5, 1.4), U.pick(['#ffe8a0', '#ffd060']), 34, { glow: true });
          const a = Math.min(1, q.t / 10) * (q.life < 10 ? q.life / 10 : 1);
          const h = Math.round(floor - top);
          const gr = ctx.createLinearGradient(0, sy - h, 0, sy);
          gr.addColorStop(0, U.rgba('#ffd060', 0));
          gr.addColorStop(0.5, U.rgba('#ffd060', 0.12 * a));
          gr.addColorStop(1, U.rgba('#ffd060', 0.55 * a));
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = gr;
          ctx.fillRect(sx - 20, sy - h, 40, h);
          ctx.restore();
          ctx.fillStyle = U.rgba('#ffe8a0', (0.7 + 0.3 * Math.sin(q.t * 0.4)) * a);
          ctx.fillRect(sx - 22, sy - 3, 44, 3);
          ctx.fillStyle = U.rgba('#ffd060', 0.8 * a);
          ctx.fillRect(sx - 22, sy - 3, 2, 3);
          ctx.fillRect(sx + 20, sy - 3, 2, 3);
          lit(null, ctx, sx, sy - 10, 44, '#ffd060', 0.7 * a);
        },
      });
  }
  function p_once(e, k) {
    if (e[k] === G.game.frame) return false;
    e[k] = G.game.frame;
    return true;
  }

  G.defEnemy('echo', {
    name: N('Echo of the Belmont', 'Eco del Belmont'),
    desc: N('The memory of a hunter, written so many times into the Chronicle that it learned to stand up on its own. It still guards the hall with its whip and its vows.', 'El recuerdo de un cazador, escrito tantas veces en la Crónica que aprendió a ponerse en pie por sí solo. Aún guarda el salón con su látigo y sus votos.'),
    area: 'arc_hunters', boss: true, hp: 1600, atk: 40, def: 8, exp: 1600, w: 16, h: 44,
    weak: ['dark'], absorb: ['holy'], noBlood: true, noDeathFx: true, blood: '#b4e6fa', el: 'hit', immune: ['poison'],
    introScene: 'echo_pre', wake: wakeSeen(200), previewState: 'idle',
    reward: { scene: 'echo_post' },
    init(e) {
      e.phase = 1;
      e.facing = -1;
      e.setState('dormant');
      e.contact = false;
      e.walkT = 0;
      e.alpha = 1;
      e.vis = 0;
      e.last = '';
      e.grandCD = 0;
      e.tails = [];
      e.whip = [];
      for (let i = 0; i < 6; i++) e.tails.push({ x: e.cx + i * 3, y: e.fy - 42 + i, px: e.cx + i * 3, py: e.fy - 42 + i });
      for (let i = 0; i < 15; i++) e.whip.push({ x: e.cx, y: e.fy - 30 + i * 2, px: e.cx, py: e.fy - 30 + i * 2 });
      e.pose = G.alucardPose ? G.alucardPose('idle', 0) : null;
      e.hurtbox = () => ({ x: e.x, y: e.y + (e.pose && e.pose.hipY > -16 ? 14 : 0), w: e.w, h: e.h - (e.pose && e.pose.hipY > -16 ? 14 : 0) });
    },
    onStart(e, g) {
      e.A = scanArena(e, g);
      e.spots = perches(g.room, 4).filter((q) => q.y < e.A.floor - 8 && q.x0 >= e.A.left - 8 && q.x1 <= e.A.right + 8);
      e.dais = e.spots.slice().sort((a, b) => Math.abs(a.cx - e.A.mid) - Math.abs(b.cx - e.A.mid))[0] || null;
      e.vis = 1;
      e.contact = true;
      e.setState('idle');
      e.wait = 30;
      sfx('whip', { vol: 0.8 });
    },
    onHitCheck(e) {
      return awake(e) && e.vis > 0.5; // as mist it cannot be touched
    },
    onHit(e, hit, g) {
      bossOnHit(e, hit, g);
      if (!e.dying) for (let i = 0; i < 5; i++) G.fx.particle(e.cx, e.cy, U.rnd(-1.6, 1.6), U.rnd(-2, 0), U.pick(['#eefcff', '#7cbce4']), 20, { glow: true });
    },
    ai(e, g) {
      const pl = e.player, A = e.A;
      const st = e.state, t = e.stT;
      const p2 = e.phase === 2;
      const k = p2 ? 0.8 : 1;
      if (e.hp <= 0 && !e.dying) startDying(e, g);
      if (e.grandCD > 0) e.grandCD--;
      const dx = pl.cx - e.cx, adx = Math.abs(dx);
      const face = () => (e.facing = dx < 0 ? -1 : 1);
      const go = (s, W) => {
        e.setState(s);
        e.W = W;
        e.lashing = false;
        e.lashT = 0;
        e.held = null;
      };
      const idle = (w) => {
        go('idle');
        e.wait = Math.round(w * k);
      };
      if (st === 'dying') {
        e.vx *= 0.8;
        e.lashing = false;
        e.move();
        if (t % 4 === 0) G.fx.particle(e.cx + U.rnd(-10, 10), e.fy - U.rnd(0, 44), 0, -U.rnd(0.5, 1.2), U.pick(['#eefcff', '#b4e6fa', '#ffe8a0']), 40, { glow: true });
        dyingBlasts(e, g, { x: e.cx - 14, y: e.fy - 46, w: 28, h: 46 }, 10, ['#eefcff', '#b4e6fa', '#7cbce4', '#ffe8a0']);
        if (t === 100) {
          gfx.flash('#eefcff', 16);
          sfx('spell_holy', { vol: 0.9 });
        }
        e.pose = echoPose(e);
        echoSim(e);
        if (t >= 130) finishDying(e, g, e.cx, e.fy);
        return;
      }
      // ---------------------------------------------------------------- idle / decide
      if (st === 'idle') {
        e.vx *= 0.7;
        if (e.onGround) face();
        if (wants2(e, 0.4)) {
          e.phase = 2;
          phaseShift(e, g, '#eefcff');
          sfx('spell_holy', { vol: 0.8, pitch: 0.8 });
          go('mistOut');
          e.next = 'grand';
          return;
        }
        if (--e.wait <= 0 && e.onGround) {
          const opts = [];
          const add = (s, w) => {
            if (s !== e.last) for (let i = 0; i < w; i++) opts.push(s);
          };
          if (adx < 120) {
            add('lash', 4);
            add('lowlash', 3);
            add('airlash', 2);
            add('mist', 2);
          } else if (adx < 230) {
            add('airlash', 3);
            add('axe', 3);
            add('holy', 2);
            add('cross', 3);
            add('walk', 2);
            add('mist', 1);
          } else {
            add('mist', 4);
            add('axe', 2);
            add('cross', 2);
          }
          if (p2 && e.grandCD <= 0) add('grand', 4);
          let s = U.pick(opts) || 'lash';
          e.last = s;
          face();
          if (s === 'grand') {
            go('mistOut');
            e.next = 'grand';
          } else if (s === 'mist') {
            go('mistOut');
            e.next = null;
          } else if (s === 'lash' || s === 'lowlash') go(s, Math.round(26 * k));
          else if (s === 'airlash') go(s, 8);
          else if (s === 'walk') go(s);
          else go(s, Math.round((s === 'holy' ? 20 : 22) * k));
          if (s === 'axe') e.held = 'axe';
          if (s === 'cross') e.held = 'cross';
          if (s === 'holy') e.held = 'vial';
        }
      }
      // ---------------------------------------------------------------- walk
      else if (st === 'walk') {
        face();
        e.vx = e.facing * 1.5;
        e.walkT += 0.75;
        if (adx < 100 || t > 60 || P.blockedAhead(g.room, e, e.facing).wall || P.blockedAhead(g.room, e, e.facing).ledge) idle(4);
      }
      // ---------------------------------------------------------------- whip lashes
      else if (st === 'lash' || st === 'lowlash') {
        e.vx *= 0.6;
        const W = e.W;
        if (t === W - 10) {
          sfx('swing_light', { vol: 0.3, pitch: 1.8 });
          e.glint = 10;
        }
        if (t >= W && t < W + 8) {
          if (t === W) sfx('whip', { vol: 1 });
          e.lashing = true;
          const ang = e.facing > 0 ? 0 : Math.PI;
          echoWhipLash(e, ang, Math.min(1, (t - W + 1) / 3));
          const w = e.whip, tip = w[w.length - 1];
          const y = st === 'lowlash' ? e.fy - 14 : e.fy - 31;
          const xa = Math.min(e.whipA.x, tip.x), xb = Math.max(e.whipA.x, tip.x);
          pHit(e, xa, y - 5, xb - xa, 10, e.atk + 4, 'hit');
          if (t === W + 2) G.fx.spark(tip.x, tip.y, '#eefcff', 6);
        } else e.lashing = false;
        if (t >= W + 8 + Math.round(22 * k)) {
          // phase 2: a stand lash is chained into a low lash
          if (p2 && st === 'lash' && !e.chained) {
            e.chained = true;
            go('lowlash', Math.round(18 * k));
          } else {
            e.chained = false;
            idle(22);
          }
        }
      }
      // ---------------------------------------------------------------- jumping diagonal lash
      else if (st === 'airlash') {
        if (t === 8 && e.onGround) {
          face();
          e.vy = -6.3;
          e.vx = U.clamp(dx / 50, -2.2, 2.2);
          e.onGround = false;
          sfx('jump', { vol: 0.5, pitch: 0.8 });
        }
        if (t > 8 && !e.onGround && !e.lashT && e.vy > -1.2) {
          e.lashT = 1;
          sfx('whip', { vol: 1, pitch: 0.9 });
        }
        if (e.lashT > 0) {
          e.lashT++;
          if (e.lashT < 12) {
            e.lashing = true;
            const ang = e.facing > 0 ? 0.62 : Math.PI - 0.62;
            echoWhipLash(e, ang, Math.min(1, e.lashT / 4));
            const w = e.whip, tip = w[w.length - 1];
            pHitLine(e, e.whipA.x, e.whipA.y, tip.x, tip.y, 4, e.atk + 4, 'hit');
            e.vy = Math.min(e.vy, 0.6);
          } else e.lashing = false;
        }
        if (t > 12 && e.onGround) {
          e.lashing = false;
          go('land');
          e.W = Math.round(24 * k);
        }
        if (t > 160) idle(10);
      } else if (st === 'land') {
        e.vx *= 0.6;
        if (t >= e.W) idle(14);
      }
      // ---------------------------------------------------------------- sub-weapons
      else if (st === 'axe' || st === 'cross' || st === 'holy') {
        e.vx *= 0.6;
        const W = e.W;
        if (t === 2) sfx('swing_light', { vol: 0.3, pitch: 0.7 });
        if (t === W) {
          face();
          e.held = null;
          if (st === 'axe') {
            echoAxe(e, g, U.clamp(dx / 58, -3.2, 3.2) || e.facing, -6.4);
            if (p2) echoAxe(e, g, U.clamp(dx / 90, -2.2, 2.2) || e.facing * 0.6, -7.2);
            sfx('axe_throw', { vol: 0.8 });
          } else if (st === 'cross') {
            echoCross(e, g);
            sfx('cross_throw', { vol: 0.8 });
          } else {
            echoHoly(e, g, U.clamp(dx / 34, -3.4, 3.4));
            if (p2) echoHoly(e, g, U.clamp(dx / 22, -4.6, 4.6));
          }
        }
        if (t >= W + Math.round((st === 'cross' ? 60 : 30) * k)) idle(18);
      }
      // ---------------------------------------------------------------- mist teleport
      else if (st === 'mistOut') {
        e.vx *= 0.5;
        e.vis = Math.max(0, 1 - t / 18);
        e.contact = false;
        if (t === 1) sfx('mist', { vol: 0.7 });
        if (t % 2 === 0) G.fx.particle(e.cx + U.rnd(-8, 8), e.fy - U.rnd(4, 44), U.rnd(-0.4, 0.4), -U.rnd(0.3, 0.9), U.pick(['#b4e6fa', '#7cbce4']), 30, { glow: true, size: 2 });
        if (t >= 18) {
          // choose where to reappear
          let tx, ty;
          if (e.next === 'grand') {
            const d = e.dais;
            tx = d ? d.cx : A.mid;
            ty = d ? d.y : A.floor;
          } else {
            const cands = [];
            for (const q of e.spots) cands.push({ x: U.clamp(pl.cx + (q.cx < pl.cx ? -1 : 1) * 110, q.x0 + 10, q.x1 - 10), y: q.y });
            for (const off of [-150, -110, 110, 150]) cands.push({ x: U.clamp(pl.cx + off, A.left + 20, A.right - 20), y: A.floor });
            const ok = cands.filter((c) => Math.abs(c.x - pl.cx) > 70 && Math.abs(c.x - pl.cx) < 190 && Math.abs(c.x - e.cx) > 40);
            const c = U.pick(ok.length ? ok : cands);
            tx = c.x;
            ty = c.y;
          }
          e.x = tx - e.w / 2;
          e.y = ty - e.h;
          e.vy = 0;
          go('mistIn');
          e.vis = 0;
        }
      } else if (st === 'mistIn') {
        e.vis = Math.min(1, t / 16);
        if (t % 2 === 0) G.fx.particle(e.cx + U.rnd(-12, 12), e.fy - U.rnd(4, 44), (e.cx - (e.cx + U.rnd(-12, 12))) * 0.05, 0, U.pick(['#b4e6fa', '#eefcff']), 20, { glow: true, size: 2 });
        face();
        if (t >= 16) {
          e.contact = true;
          e.vis = 1;
          if (e.next === 'grand') {
            go('grand');
            e.contact = false;
          } else idle(10);
          e.next = null;
        }
      }
      // ---------------------------------------------------------------- Grand Cross
      else if (st === 'grand') {
        e.vx = 0;
        e.invuln = Math.max(e.invuln, 2);
        if (t === 1) {
          sfx('spell_holy', { vol: 1, pitch: 0.7 });
          e.crossT = 0;
        }
        e.crossT = t;
        if (t === 30) echoGrand(e, g);
        if (t > 30 && t < 94 && t % 16 === 0) sfx('magic_cast', { vol: 0.4, pitch: 1.5 });
        if (t >= 150) {
          e.contact = true;
          e.grandCD = 660;
          idle(30);
        }
      }
      e.move();
      if (e.onGround && Math.abs(e.vx) > 0.3 && st !== 'walk') e.walkT += Math.abs(e.vx) / 2;
      e.pose = echoPose(e);
      echoSim(e);
    },
    draw(e, ctx, sx, sy) {
      const pre = e.preview;
      const g = G.game;
      if (pre) {
        e.pose = G.alucardPose('idle', e.t);
        e.vis = 1;
      }
      // dormant: a column of pale light with drifting motes; it takes shape during the intro
      if (e.state === 'dormant' && !pre) {
        if (e.started && e.wakeT == null) e.wakeT = e.t;
        const k = e.wakeT != null ? Math.min(1, (e.t - e.wakeT) / 80) : 0;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = U.rgba('#7cbce4', 0.08 + k * 0.08);
        ctx.fillRect(sx - 10, sy - 70, 20, 70);
        ctx.restore();
        if (e.t % 8 === 0) G.fx.particle(e.cx + U.rnd(-8, 8), e.fy - U.rnd(0, 20), 0, -U.rnd(0.4, 0.9), '#b4e6fa', 50, { glow: true });
        lit(e, ctx, sx, sy - 30, 60, '#7cbce4', 0.6);
        if (k <= 0) return;
        e.facing = e.player.cx < e.cx ? -1 : 1;
        e.pose = G.alucardPose('idle', e.t);
        e.vis = k;
        echoSim(e);
      }
      if (!e.pose) return;
      const cv = echoCanvas(e);
      const r = paintHunter(cv, e.pose, e.tails.map((p) => ({ x: ((p.x - e.cx) * e.facing) / 1.1, y: (p.y - e.fy) / 1.1 })), {
        coiled: !['lash', 'lowlash', 'airlash'].includes(e.state),
        handle: ['lash', 'lowlash', 'airlash'].includes(e.state),
        held: e.held,
      });
      e.hand = r.hand;
      const vis = e.vis;
      if (vis <= 0.02) return;
      let img = cv;
      if (e._flashDraw) img = flashCopy(e, cv);
      const flick = 0.86 + Math.sin(e.t * 0.31) * 0.05 + Math.sin(e.t * 1.7) * 0.03;
      ctx.globalAlpha = Math.min(1, vis * flick);
      gfx.drawAnchored(img, sx, sy, EC_AX, EC_AY, e.facing < 0, null, ctx);
      // spectral glow pass
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16 * vis;
      gfx.drawAnchored(img, sx, sy - 1, EC_AX, EC_AY, e.facing < 0, null, ctx);
      ctx.restore();
      ctx.globalAlpha = 1;
      // whip
      if (['lash', 'lowlash', 'airlash'].includes(e.state) && e.whipA) {
        const w = e.whip;
        ctx.save();
        ctx.globalAlpha = vis;
        for (let i = 0; i < w.length - 1; i++) {
          const a = w[i], b = w[i + 1];
          gfx.limb(ctx, a.x - g.camx, a.y - g.camy, b.x - g.camx, b.y - g.camy, i < 3 ? 2 : 1.4, i % 2 ? '#7cbce4' : '#eefcff');
        }
        const tip = w[w.length - 1];
        if (e.lashing) glow(ctx, tip.x - g.camx, tip.y - g.camy, 10, '#eefcff', 0.8);
        ctx.restore();
        if (e.lashing) lit(e, ctx, tip.x - g.camx, tip.y - g.camy, 36, '#b4e6fa', 0.7);
      }
      if (e.glint > 0 && !pre) {
        e.glint--;
        const gx = sx - e.facing * 8, gy = sy - 50;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#ffffff';
        const rr = 6 - Math.abs(e.glint - 5);
        ctx.fillRect(gx - rr, gy, rr * 2 + 1, 1);
        ctx.fillRect(gx, gy - rr, 1, rr * 2 + 1);
        ctx.restore();
      }
      // the Grand Cross behind the kneeling hunter
      if (e.state === 'grand' && !pre) {
        const k = Math.min(1, e.stT / 40) * (e.stT > 120 ? Math.max(0, (150 - e.stT) / 30) : 1);
        const cx = sx, cy = sy - 40;
        const L = 20 + 60 * k, Wd = 4 + 8 * k;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 * k + (e.stT % 8 < 4 ? 0.1 : 0);
        ctx.fillStyle = '#eefcff';
        ctx.fillRect(cx - Wd / 2, cy - L, Wd, L * 1.6);
        ctx.fillRect(cx - L * 0.7, cy - L * 0.45 - Wd / 2, L * 1.4, Wd);
        ctx.globalAlpha = 0.25 * k;
        ctx.fillStyle = '#7cbce4';
        ctx.fillRect(cx - Wd, cy - L - 4, Wd * 2, L * 1.6 + 8);
        ctx.fillRect(cx - L * 0.7 - 4, cy - L * 0.45 - Wd, L * 1.4 + 8, Wd * 2);
        ctx.restore();
        lit(e, ctx, cx, cy, 120, '#eefcff', 1 * k);
      }
      lit(e, ctx, sx, sy - 24, 56, '#7cbce4', 0.7 * vis);
    },
    onDeath(e, g) {
      // the hunter's ghost stays kneeling while it speaks, then fades away
      const img = gfx.makeCanvas(EC_W, EC_H);
      gfx.ctxOf(img).drawImage(e.cv, 0, 0);
      const flip = e.facing < 0;
      const x = e.cx, y = e.fy;
      fxEnt(g, {
        free: true, keep: true, x, y, life: 1200, z: 1,
        upd(q) {
          const talking = G.story && G.story.active;
          if (q.t > 100 && !talking && !q.fade) q.fade = 1;
          if (q.fade) {
            q.fade++;
            if (q.fade % 3 === 0) G.fx.particle(x + U.rnd(-10, 10), y - U.rnd(0, 40), 0, -U.rnd(0.6, 1.4), U.pick(['#eefcff', '#ffe8a0']), 50, { glow: true });
            if (q.fade > 90) q.dead = true;
          }
        },
        drawFn(q, ctx, sx, sy) {
          const a = q.fade ? Math.max(0, 1 - q.fade / 90) : Math.min(1, q.t / 30);
          ctx.globalAlpha = 0.6 * a + Math.sin(q.t * 0.2) * 0.05;
          gfx.drawAnchored(img, sx, sy, EC_AX, EC_AY, flip, null, ctx);
          ctx.globalAlpha = 1;
          lit(null, ctx, sx, sy - 24, 70, '#b4e6fa', 0.8 * a);
        },
      });
    },
  });
  // white silhouette of a per-frame canvas (whiteOf caches by canvas, which goes stale)
  function flashCopy(e, cv) {
    if (!e.cvw || e.cvw.width !== cv.width) e.cvw = gfx.makeCanvas(cv.width, cv.height);
    const w = gfx.ctxOf(e.cvw);
    w.globalCompositeOperation = 'source-over';
    w.clearRect(0, 0, cv.width, cv.height);
    w.drawImage(cv, 0, 0);
    w.globalCompositeOperation = 'source-in';
    w.fillStyle = '#ffffff';
    w.fillRect(0, 0, cv.width, cv.height);
    w.globalCompositeOperation = 'source-over';
    return e.cvw;
  }


  // =====================================================================================
  //  4. BIBLIOPHAGE  (vault_worm)
  // =====================================================================================
  // A colossal bookworm. The head follows arc-length paths (floor leaps, wall surges,
  // pop-ups); the 10 body segments sit on the same path behind it, so they burrow in
  // and out of the floor exactly where the head did (z < 0 hides them behind tiles).
  const BW = { cover: '#5a1a22', coverD: '#36101a', coverL: '#8a3036', green: '#24402c', greenL: '#3e6a46', navy: '#1e2846', navyL: '#34467a', page: '#e8dcb8', pageS: '#b8a882', pageD: '#7a6a4e', brass: '#b08d3c', brassD: '#6e5420', ink: '#140a14', eye: '#ff5a2a', eyeL: '#ffd060', tongue: '#a01828', gold: '#ffd25a', goldL: '#fff4c0' };
  const BW_PAL = Object.values(BW);
  const BW_SEGS = 10, BW_SPACE = 23, BW_HEAD = 26;
  const BW_WEAK = 3; // the segment that swallowed the Chronicle page

  // path helpers: resample a polyline into 2-px steps with cumulative length
  function mkPath(pts) {
    const xs = [], ys = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.ceil(d / 2));
      for (let k = 0; k < n; k++) {
        xs.push(a.x + ((b.x - a.x) * k) / n);
        ys.push(a.y + ((b.y - a.y) * k) / n);
      }
    }
    const last = pts[pts.length - 1];
    xs.push(last.x);
    ys.push(last.y);
    const len = [0];
    for (let i = 1; i < xs.length; i++) len.push(len[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
    return { xs, ys, len, L: len[len.length - 1] };
  }
  function pathAt(P_, s) {
    const { xs, ys, len } = P_;
    if (s <= 0) {
      const a = Math.atan2(ys[1] - ys[0], xs[1] - xs[0]);
      return { x: xs[0] + Math.cos(a) * s, y: ys[0] + Math.sin(a) * s, a };
    }
    if (s >= P_.L) {
      const n = xs.length - 1;
      const a = Math.atan2(ys[n] - ys[n - 1], xs[n] - xs[n - 1]);
      return { x: xs[n] + Math.cos(a) * (s - P_.L), y: ys[n] + Math.sin(a) * (s - P_.L), a };
    }
    let lo = 0, hi = len.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (len[m] < s) lo = m;
      else hi = m;
    }
    const k = (s - len[lo]) / Math.max(0.0001, len[hi] - len[lo]);
    return { x: xs[lo] + (xs[hi] - xs[lo]) * k, y: ys[lo] + (ys[hi] - ys[lo]) * k, a: Math.atan2(ys[hi] - ys[lo], xs[hi] - xs[lo]) };
  }
  function bwHead(ang, jaw, mirror) {
    return rspr('bwhead' + jaw + (mirror ? 'm' : ''), 32, ang, 84, 84, BW_PAL, (c) => {
      if (mirror) c.scale(1, -1);
      const open = jaw === 2 ? 0.75 : jaw === 1 ? 0.42 : 0.08;
      // the throat (spine of the tome)
      gfx.ellipse(c, -10, 0, 16, 15, 0, BW.coverD);
      gfx.ellipse(c, -12, -2, 12, 10, 0, BW.cover);
      // inner maw
      gfx.poly(c, [-6, -4, 26, -6 - open * 18, 30, 0, 26, 6 + open * 18, -6, 4], BW.ink);
      // paper teeth
      for (let i = 0; i < 6; i++) {
        const x = 0 + i * 4.6;
        const yt = -5 - open * 15 * (x / 28);
        gfx.poly(c, [x, yt, x + 2.4, yt + 6 + (i % 2) * 2, x + 4.4, yt], i % 2 ? BW.page : BW.pageS);
        const yb = 5 + open * 15 * (x / 28);
        gfx.poly(c, [x + 1, yb, x + 3.2, yb - 6 - (i % 2) * 2, x + 5, yb], i % 2 ? BW.pageS : BW.page);
      }
      // ribbon tongue
      gfx.limb(c, 0, 1, 14 + open * 6, 2 + open * 6, 2.4, BW.tongue);
      // upper cover (jaw)
      c.save();
      c.rotate(-open * 0.55);
      gfx.poly(c, [-14, -14, 30, -12, 34, -6, -8, -4], BW.cover);
      gfx.poly(c, [-12, -13, 28, -11, 30, -9, -10, -9], BW.coverL);
      gfx.poly(c, [-2, -6, 30, -6, 32, -4, -2, -3], BW.page); // page edges
      gfx.limb(c, 0, -5, 30, -5, 0.8, BW.pageD);
      c.fillStyle = BW.brass;
      c.fillRect(26, -13, 6, 3);
      c.fillRect(-12, -15, 4, 3);
      // eyes on the spine
      gfx.circle(c, 6, -13, 3.2, BW.ink);
      gfx.circle(c, 6.5, -13.2, 2, BW.eye);
      gfx.circle(c, 7, -13.6, 0.9, BW.eyeL);
      gfx.circle(c, 15, -12, 2.4, BW.ink);
      gfx.circle(c, 15.4, -12.2, 1.4, BW.eye);
      // quills stuck in the head like horns
      gfx.limb(c, -4, -14, -14, -27, 1.6, BW.page);
      gfx.limb(c, -9, -24, -16, -25, 1.2, BW.pageS);
      gfx.limb(c, 2, -14, -2, -26, 1.4, BW.pageS);
      c.restore();
      // lower cover (jaw)
      c.save();
      c.rotate(open * 0.55);
      gfx.poly(c, [-14, 14, 30, 12, 34, 6, -8, 4], BW.coverD);
      gfx.poly(c, [-2, 6, 30, 6, 32, 4, -2, 3], BW.pageS);
      c.fillStyle = BW.brass;
      c.fillRect(26, 10, 6, 3);
      c.restore();
    });
  }
  function bwSeg(ang, v, weak, mirror) {
    return rspr('bwseg' + v + (weak ? 'w' : '') + (mirror ? 'm' : ''), 32, ang, 48, 48, BW_PAL, (c) => {
      if (mirror) c.scale(1, -1);
      const cov = [BW.cover, BW.green, BW.navy][v], covL = [BW.coverL, BW.greenL, BW.navyL][v];
      // a fat, rotten tome seen from its spine: covers top & bottom, pages between
      gfx.ellipse(c, 0, 0, 13, 13, 0, BW.coverD);
      gfx.poly(c, [-11, -12, 11, -12, 13, -7, -13, -7], cov);
      gfx.poly(c, [-10, -12, 8, -12, 9, -10, -10, -10], covL);
      gfx.poly(c, [-11, 12, 11, 12, 13, 7, -13, 7], cov);
      if (weak) {
        // torn open: the swallowed Chronicle page glows inside
        gfx.poly(c, [-12, -7, 12, -7, 12, 7, -12, 7], BW.ink);
        gfx.poly(c, [-8, -5, 7, -6, 9, 5, -6, 6], BW.gold);
        gfx.poly(c, [-5, -3, 4, -4, 5, 3, -3, 3], BW.goldL);
        gfx.limb(c, -4, -1, 3, -1.5, 0.8, BW.brassD);
        gfx.limb(c, -4, 1.5, 2, 1, 0.8, BW.brassD);
      } else {
        gfx.poly(c, [-12, -7, 12, -7, 12, 7, -12, 7], BW.page);
        for (let i = 0; i < 4; i++) gfx.limb(c, -11, -4.5 + i * 3, 11, -4.5 + i * 3, 0.8, i % 2 ? BW.pageS : BW.pageD);
        // a torn page sticking out
        gfx.poly(c, [4, -7, 9, -14, 11, -12, 8, -7], BW.page);
      }
      // brass corners and a clasp
      c.fillStyle = BW.brass;
      c.fillRect(-13, -12, 3, 3);
      c.fillRect(10, -12, 3, 3);
      c.fillRect(-13, 9, 3, 3);
      c.fillRect(10, 9, 3, 3);
      c.fillStyle = BW.brassD;
      c.fillRect(-1, 8, 3, 5);
      // little legs: bookmark ribbons
      gfx.limb(c, -6, 12, -8, 17, 1.4, BW.tongue);
      gfx.limb(c, 5, 12, 6, 17, 1.4, BW.tongue);
    });
  }
  function bwTail(ang, mirror) {
    return rspr('bwtail' + (mirror ? 'm' : ''), 32, ang, 44, 44, BW_PAL, (c) => {
      if (mirror) c.scale(1, -1);
      gfx.poly(c, [-14, -6, 6, -9, 14, 0, 6, 9, -14, 6], BW.coverD);
      gfx.poly(c, [-14, -4, 6, -6, 10, 0, 6, 6, -14, 4], BW.page);
      for (let i = 0; i < 3; i++) gfx.poly(c, [-14 - i * 3, -5 + i * 4, -22 - i * 2, -8 + i * 6, -16 - i * 3, -1 + i * 4], i % 2 ? BW.pageS : BW.page);
    });
  }
  function pageBlade(e, g, x, y, ang, sp) {
    const p = e.shoot({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, w: 10, h: 10, el: 'cut', color: '#e8dcb8', life: 200, wall: true,
      drawFn(p, ctx, sx, sy) {
        const img = rspr('bwpage', 16, p.t * 0.4, 18, 18, ['#e8dcb8', '#b8a882', '#7a6a4e', '#140a14'], (c) => {
          gfx.poly(c, [-6, -4, 6, -5, 7, 4, -5, 5], '#e8dcb8');
          gfx.limb(c, -4, -2, 4, -2.5, 0.8, '#7a6a4e');
          gfx.limb(c, -4, 0.5, 4, 0, 0.8, '#7a6a4e');
          gfx.limb(c, -4, 3, 2, 2.6, 0.8, '#7a6a4e');
          gfx.poly(c, [6, -5, 9, -1, 7, 4], '#b8a882');
        });
        ctx.drawImage(img, sx - 9, sy - 9);
      },
    });
    p.owner = e;
  }
  function inkGlob(e, g, x, y, tx) {
    const T = 46, grav = 0.2;
    const ty = e.A.floor - 6;
    const vx = (tx - x) / T, vy = (ty - y - 0.5 * grav * T * T) / T;
    const p = e.shoot({
      x, y, vx, vy, grav, w: 10, h: 10, el: 'dark', color: '#3a1a5a', life: 200, wall: true,
      upd(p) {
        if (p.t % 3 === 0) G.fx.particle(p.cx, p.cy, 0, 0.2, '#1a0c2a', 18, { size: 2 });
      },
      drawFn(p, ctx, sx, sy) {
        ctx.fillStyle = '#140a14';
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#5a3a9a';
        ctx.fillRect(sx - 2, sy - 3, 2, 2);
      },
      onWall(p, g) {
        sfx('ink_splash', { vol: 0.6 });
        G.fx.burst(p.cx, p.cy, '#3a1a5a', 10, 1.6);
        const fy = Math.floor((p.cy + 4) / 16) * 16;
        const pd = e.shoot({
          x: p.cx, y: fy - 4, vx: 0, w: 34, h: 8, el: 'dark', dmg: Math.round(e.atk * 0.7), status: 'poison', chance: 0.25, life: 200, wall: false, pierce: true, color: '#3a1a5a',
          drawFn(q, ctx, sx, sy) {
            const a = Math.min(1, q.life / 30, q.t / 6);
            ctx.globalAlpha = a;
            ctx.fillStyle = '#140a14';
            ctx.fillRect(sx - 17, sy + 1, 34, 3);
            // a violet sheen and bubbles so the puddle reads on a dark floor
            ctx.fillStyle = '#8a5ad0';
            ctx.fillRect(sx - 15, sy, 30, 1);
            ctx.fillStyle = '#c8a0ff';
            ctx.fillRect(sx - 6, sy, 6, 1);
            for (let i = -14; i < 14; i += 6) {
              ctx.fillStyle = '#7a4ad0';
              ctx.fillRect(sx + i, sy - Math.abs(Math.sin(q.t * 0.12 + i)) * 3, 2, 2);
            }
            ctx.globalAlpha = 1;
            glow(ctx, sx, sy + 1, 14, '#7a4ad0', 0.35 * a);
            lit(null, ctx, sx, sy, 30, '#8a4ad0', 0.5 * a);
          },
        });
        pd.owner = e;
      },
    });
    p.owner = e;
  }
  function bwFire(e, g, x, y, ang) {
    const p = e.shoot({
      x, y, vx: Math.cos(ang) * 3.8, vy: Math.sin(ang) * 3.8, w: 12, h: 12, el: 'fire', color: '#ff8a2a', life: 52, wall: true,
      upd(p) {
        p.vx *= 0.985;
        p.vy *= 0.985;
        if (p.t % 2 === 0) G.fx.particle(p.cx + U.rnd(-4, 4), p.cy + U.rnd(-4, 4), p.vx * 0.2, -0.5, U.pick(['#ffd25a', '#ff8a2a', '#c03a10']), 16, { glow: true, size: 2 });
      },
      drawFn(p, ctx, sx, sy) {
        const r = 4 + Math.min(6, p.t * 0.25);
        glow(ctx, sx, sy, r * 2.2, '#ff6020', 0.7);
        ctx.fillStyle = '#ffd25a';
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
        lit(null, ctx, sx, sy, 40, '#ff8a2a', 0.8);
      },
    });
    p.owner = e;
  }
  // visible parts of the worm in world space
  function bwParts(e) {
    const out = [];
    if (!e.path) return out;
    const h = pathAt(e.path, e.s);
    const bob = e.bob || 0;
    out.push({ i: -1, x: h.x, y: h.y + bob, a: h.a, r: 17 });
    for (let i = 0; i < BW_SEGS; i++) {
      const q = pathAt(e.path, e.s - BW_HEAD - i * BW_SPACE);
      out.push({ i, x: q.x, y: q.y + bob * (1 - (i + 1) / (BW_SEGS + 2)), a: q.a, r: i === BW_SEGS - 1 ? 9 : 12, gone: e.lost && e.lost > BW_SEGS - 1 - i });
    }
    return out;
  }
  const bwAbove = (e, p) => p.y < e.A.floor - 3 && p.x > e.A.left - 4 && p.x < e.A.right + 4 && !p.gone;

  G.defEnemy('biblio', {
    name: N('Bibliophage', 'Bibliófago'),
    desc: N('A bookworm that ate its way through three centuries of hunters’ vows and grew vast on them. It swallowed a page of the Chronicle, and the page still shines through its ribs.', 'Una polilla de libros que devoró tres siglos de juramentos de cazadores y creció desmesurada con ellos. Se tragó una página de la Crónica, y la página aún brilla entre sus costillas.'),
    area: 'arc_vault', boss: true, hp: 2600, atk: 50, def: 10, exp: 3000, w: 40, h: 40,
    weak: ['fire'], noBlood: true, noDeathFx: true, blood: '#e8dcb8', el: 'hit', heavy: true,
    introScene: 'biblio_pre', wake: wakeSeen(230), previewState: 'idle',
    reward: { items: ['page2', 'blood_ink'] },
    init(e) {
      e.z = -1;
      e.phase = 1;
      e.setState('dormant');
      e.contact = false;
      e.s = 0;
      e.path = null;
      e.bob = 0;
      e.jaw = 0;
      e.lost = 0;
      e.queue = 0;
      e.hasCandle = true;
      e.home = { x: e.cx, y: e.spawnY + e.h };
      e.candle = { x: e.cx + 92, y: e.spawnY + e.h };
      e.hurtbox = () => {
        const ps = bwParts(e).filter((p) => (p.i === -1 || p.i === BW_WEAK) && e.A && bwAbove(e, p));
        if (!ps.length) return { x: -9999, y: -9999, w: 1, h: 1 };
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const p of ps) {
          x0 = Math.min(x0, p.x - p.r);
          y0 = Math.min(y0, p.y - p.r);
          x1 = Math.max(x1, p.x + p.r);
          y1 = Math.max(y1, p.y + p.r);
        }
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      };
    },
    onStart(e, g) {
      e.A = scanArena(e, g);
      e.home.y = e.A.floor;
      e.candle.y = e.A.floor;
      if (e.candle.x > e.A.right - 40) e.candle.x = e.home.x - 92;
      // burst out of the mound
      const dir = e.player.cx < e.home.x ? -1 : 1;
      bwLeap(e, e.home.x, e.home.x + dir * 300, 150);
      e.setState('pass');
      e.passKind = 'intro';
      sfx('roar', { vol: 1, pitch: 0.8 });
      gfx.shake(6, 40);
      G.fx.debris(e.home.x, e.A.floor - 6, '#4a2418', 24);
      for (let i = 0; i < 30; i++) G.fx.particle(e.home.x + U.rnd(-30, 30), e.A.floor - 8, U.rnd(-2, 2), U.rnd(-4, -1), U.pick(['#e8dcb8', '#b8a882']), 60, { grav: 0.08, size: 2, drag: 0.97 });
    },
    onHitCheck(e, hit) {
      if (!awake(e)) return false;
      const box = { x: hit.x, y: hit.y, w: hit.w || 8, h: hit.h || 8 };
      let weakHit = false, headHit = false, armor = false;
      for (const p of bwParts(e)) {
        if (!bwAbove(e, p)) continue;
        const pb = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 };
        if (!rectsHit(box, pb)) continue;
        if (p.i === -1) headHit = true;
        else if (p.i === BW_WEAK) weakHit = true;
        else armor = true;
      }
      if (headHit || weakHit) {
        if (weakHit && !headHit) hit.dmg = Math.round(hit.dmg * 1.3);
        return true;
      }
      // armoured covers: clink, and let the same swing try again on the next frame
      e.hitIds.delete(hit.id);
      if (armor && !(e.clinkT > 0)) {
        e.clinkT = 10;
        sfx('hit_metal', { vol: 0.5, pitch: 1.3 });
        G.fx.spark(hit.x + (hit.w || 0) / 2, hit.y + (hit.h || 0) / 2, '#b8a882', 4);
      }
      return false;
    },
    onHit(e, hit, g) {
      bossOnHit(e, hit, g);
      for (let i = 0; i < 4; i++) G.fx.particle(hit.x + (hit.w || 0) / 2, hit.y + (hit.h || 0) / 2, U.rnd(-2, 2), U.rnd(-2.5, 0), U.pick(['#e8dcb8', '#b8a882', '#7a6a4e']), 40, { grav: 0.06, size: 2, drag: 0.96 });
    },
    ai(e, g) {
      const pl = e.player, A = e.A;
      const st = e.state, t = e.stT;
      const p2 = e.phase === 2;
      if (e.clinkT > 0) e.clinkT--;
      if (e.hp <= 0 && !e.dying) startDying(e, g);
      e.jaw = Math.max(0, e.jaw - 0.04);
      // ------------------------------------------------------------- dying: segments burst one by one
      if (st === 'dying') {
        e.hp = 0;
        if (t === 1 && e.path) {
          // recoil back along its path until the head is out of the floor
          for (let i = 0; i < 200 && pathAt(e.path, e.s).y > A.floor - 30 && e.s > 0; i++) e.s -= 3;
        }
        e.bob = Math.sin(t * 0.8) * 3;
        e.jaw = 1;
        if (t % 10 === 0 && e.lost < BW_SEGS) {
          const ps = bwParts(e);
          const seg = ps[BW_SEGS - e.lost];
          e.lost++;
          if (seg) {
            G.fx.explode(seg.x, seg.y, 0.8);
            for (let i = 0; i < 16; i++) G.fx.particle(seg.x, seg.y, U.rnd(-2.5, 2.5), U.rnd(-3.5, 0.5), U.pick(['#e8dcb8', '#b8a882', '#ffd25a']), 60, { grav: 0.07, size: 2, drag: 0.97 });
            sfx('page_flutter', { vol: 0.7 });
            sfx('explosion', { vol: 0.4, pitch: U.rnd(0.9, 1.3) });
            gfx.shake(3, 8);
          }
        }
        if (t === 118) {
          const h = bwParts(e)[0];
          G.fx.explode(h.x, h.y, 2.4);
          gfx.flash('#ffe8b0', 14);
          gfx.shake(8, 30);
          e.headGone = true;
          for (let i = 0; i < 50; i++) G.fx.particle(h.x, h.y, U.rnd(-3.5, 3.5), U.rnd(-5, 1), U.pick(['#e8dcb8', '#b8a882', '#fff4c0']), 90, { grav: 0.06, size: 2, drag: 0.97 });
        }
        if (t >= 130) {
          const h = bwParts(e)[0];
          finishDying(e, g, h.x, Math.min(h.y + 20, A.floor));
        }
        return;
      }
      // ------------------------------------------------------------- underground: plan the next move
      if (st === 'under') {
        e.path = null;
        if (wants2(e) && e.hasCandle) {
          // phase 2: surface beside the candelabra and swallow it
          e.phase = 2;
          phaseShift(e, g, '#ff8a2a');
          const dir = pl.cx < e.candle.x ? 1 : -1;
          e.plan = { kind: 'swallow', x: e.candle.x - dir * 200, x2: e.candle.x, H: 120 };
          e.setState('warn');
          e.warnT = 50;
          bwWarn(e, g, e.plan.x, A.floor, e.warnT, false);
          return;
        }
        if (t >= (e.queue > 0 ? 6 : Math.round((p2 ? 34 : 56) + e.rnd.int(0, 24)))) {
          const onPlat = pl.fy < A.floor - 24;
          const r = e.rnd.next();
          let kind;
          if (onPlat) kind = r < 0.5 ? 'surge' : 'leap';
          else kind = r < 0.4 ? 'leap' : r < 0.6 ? 'surge' : 'pop';
          if (e.queue > 0) kind = 'leap';
          const dir = e.rnd.chance(0.5) ? -1 : 1;
          if (kind === 'leap') {
            const xa = U.clamp(pl.cx - dir * U.rnd(150, 190), A.left + 30, A.right - 30);
            const xb = U.clamp(pl.cx + dir * U.rnd(170, 210), A.left + 30, A.right - 30);
            const H = U.clamp(A.floor - pl.cy + 70, 110, 300);
            e.plan = { kind, x: xa, x2: xb, H };
            e.setState('warn');
            e.warnT = e.queue > 0 ? 30 : p2 ? 40 : 54;
            bwWarn(e, g, xa, A.floor, e.warnT, false);
          } else if (kind === 'surge') {
            // above a floor-bound player (jump to strike it), level with a player on a ledge
            const y = onPlat ? U.clamp(pl.cy - 6, A.top + 40, A.floor - 70) : A.floor - 100;
            let sdir = pl.cx - A.left < A.right - pl.cx ? 1 : -1;
            if (e.rnd.chance(0.3)) sdir = -sdir;
            e.plan = { kind, dir: sdir, y };
            e.setState('warn');
            e.warnT = p2 ? 44 : 56;
            const x0 = pl.cx - sdir * 250;
            const wall = sdir > 0 ? x0 < A.left + 30 : x0 > A.right - 30;
            bwWarn(e, g, wall ? (sdir > 0 ? A.left : A.right) : U.clamp(x0 - sdir * 6, A.left + 10, A.right - 10), wall ? y : A.floor, e.warnT, wall);
          } else {
            const x = U.clamp(pl.cx + (e.rnd.chance(0.5) ? -1 : 1) * U.rnd(80, 120), A.left + 40, A.right - 40);
            e.plan = { kind, x, act: p2 && !e.hasCandle && e.rnd.chance(0.5) ? 'fire' : e.rnd.chance(0.5) ? 'pages' : 'ink' };
            e.setState('warn');
            e.warnT = p2 ? 40 : 52;
            bwWarn(e, g, x, A.floor, e.warnT, false);
          }
          if (e.queue > 0) e.queue--;
        }
        return;
      }
      if (st === 'warn') {
        if (t % 12 === 0) sfx('stomp', { vol: 0.35, pitch: 0.5 });
        if (t >= e.warnT) {
          const pn = e.plan;
          if (pn.kind === 'leap' || pn.kind === 'swallow') bwLeap(e, pn.x, pn.x2, pn.H);
          else if (pn.kind === 'surge') bwSurge(e, pn.dir, pn.y);
          else bwPop(e, pn.x);
          e.passKind = pn.kind;
          e.act = pn.act;
          e.spat = 0;
          sfx('roar', { vol: 0.6, pitch: 1.2 });
          gfx.shake(4, 14);
          e.setState(pn.kind === 'pop' ? 'pop' : 'pass');
        }
        return;
      }
      // ------------------------------------------------------------- travelling along a path
      if (st === 'pass') {
        const speed = (e.passKind === 'surge' ? 4.4 : 4.6) * (p2 ? 1.25 : 1);
        e.s += speed;
        const h = pathAt(e.path, e.s);
        // emerging spray
        bwSpray(e, g);
        // actions along the way
        const u = e.s / e.path.L;
        if (e.passKind === 'leap' || e.passKind === 'intro') {
          if (!e.spat && u > 0.42 && h.y < A.floor - 40) {
            e.spat = 1;
            e.jaw = 1;
            const a0 = Math.atan2(pl.cy - h.y, pl.cx - h.x);
            const n = p2 ? 7 : 5;
            for (let i = 0; i < n; i++) pageBlade(e, g, h.x, h.y, a0 + (i - (n - 1) / 2) * 0.17, 3.1);
            sfx('page_flutter', { vol: 0.9 });
          }
        } else if (e.passKind === 'surge') {
          if (h.y < A.floor - 20 && e.spat < 3 && Math.abs(h.x - pl.cx) < 120 && t - (e.lastSpit || 0) > 18) {
            e.spat++;
            e.lastSpit = t;
            e.jaw = 1;
            inkGlob(e, g, h.x, h.y, U.clamp(pl.cx + U.rnd(-40, 40), A.left + 20, A.right - 20));
            sfx('slime', { vol: 0.7 });
          }
        } else if (e.passKind === 'swallow') {
          if (e.hasCandle && Math.abs(h.x - e.candle.x) < 14 && h.y > A.floor - 70) {
            e.hasCandle = false;
            e.jaw = 1;
            sfx('fireball', { vol: 1, pitch: 0.6 });
            sfx('roar', { vol: 1, pitch: 0.7 });
            gfx.flash('#ff8a2a', 12);
            G.fx.burst(e.candle.x, A.floor - 40, '#ffb040', 30, 3, { glow: true });
          }
        }
        // the tail has gone back under the floor: done
        const tail = pathAt(e.path, e.s - BW_HEAD - (BW_SEGS - 1) * BW_SPACE);
        if (e.s > e.path.L * 0.5 && tail.y > A.floor + 24 && pathAt(e.path, e.s).y > A.floor + 24) {
          if (p2 && e.passKind === 'leap' && e.queue === 0 && !e.chain) {
            e.queue = 1;
            e.chain = true;
          } else e.chain = false;
          e.setState('under');
        }
        bwContact(e);
        return;
      }
      // ------------------------------------------------------------- pop-up: rise, attack, retract
      if (st === 'pop') {
        const topS = e.popTop;
        const k = p2 ? 0.8 : 1;
        const R = Math.round(36 * k), HOLD = e.act === 'fire' ? 120 : 96;
        if (t <= R) e.s = topS * eout(t / R);
        else if (t <= R + HOLD) {
          e.s = topS;
          e.bob = Math.sin(t * 0.12) * 4;
          const tt = t - R;
          // face the player: the head path's last leg bends toward them
          if (e.act === 'pages') {
            if (tt === 10 || tt === 50) {
              e.jaw = 1;
              const h = bwParts(e)[0];
              const a0 = Math.atan2(pl.cy - h.y, pl.cx - h.x);
              const n = p2 ? 7 : 5;
              for (let i = 0; i < n; i++) pageBlade(e, g, h.x, h.y, a0 + (i - (n - 1) / 2) * 0.2, 2.9);
              sfx('page_flutter', { vol: 0.9 });
            }
            if (tt < 10 || (tt > 34 && tt < 50)) e.jaw = Math.max(e.jaw, 0.5);
          } else if (e.act === 'ink') {
            if (tt === 16 || tt === 30 || tt === 44) {
              e.jaw = 1;
              const h = bwParts(e)[0];
              inkGlob(e, g, h.x, h.y, U.clamp(pl.cx + (tt === 30 ? 0 : tt === 16 ? -48 : 48), A.left + 20, A.right - 20));
              sfx('slime', { vol: 0.8 });
            }
          } else if (e.act === 'fire') {
            // inhale (telegraph: glowing maw), then a sweeping stream of fire
            const h = bwParts(e)[0];
            if (tt < 40) {
              e.jaw = Math.min(1, tt / 30);
              e.inhale = tt / 40;
              if (tt % 2 === 0) {
                const a = Math.random() * TAU;
                G.fx.particle(h.x + Math.cos(a) * 36, h.y + Math.sin(a) * 30, -Math.cos(a) * 1.6, -Math.sin(a) * 1.4, '#ffb040', 22, { glow: true });
              }
              if (tt === 2) sfx('magic_cast', { vol: 0.8, pitch: 0.5 });
            } else if (tt < 92) {
              // the stream rakes from overhead down to the floor in front of it;
              // right under its chin (and beyond its reach) stays safe
              e.jaw = 1;
              e.inhale = 0;
              const dir = e.popDir || 1;
              const u = (tt - 40) / 52;
              const a = (dir > 0 ? 0 : Math.PI) + dir * (0.1 + 0.75 * u);
              if (tt % 2 === 0) bwFire(e, g, h.x + Math.cos(a) * 18, h.y + Math.sin(a) * 18, a);
              if (tt % 8 === 0) sfx('fireball', { vol: 0.5, pitch: U.rnd(0.7, 0.9) });
            }
            e.fireZone = tt < 92 ? { x: h.x + (e.popDir || 1) * 58, x2: h.x + (e.popDir || 1) * 190, t: tt } : null;
          }
        } else {
          e.fireZone = null;
          e.bob *= 0.8;
          e.s = topS * (1 - ein((t - R - HOLD) / 28));
          if (t >= R + HOLD + 28) {
            e.s = 0;
            e.setState('under');
          }
        }
        bwSpray(e, g);
        bwContact(e);
        return;
      }
    },
    draw(e, ctx, sx, sy) {
      const g = G.game;
      const pre = e.preview;
      if (pre) {
        // bestiary portrait: a coiled pose
        ctx.save();
        const sc0 = Math.min(1, 60 / e.h, 90 / e.w);
        ctx.scale(0.4 / sc0, 0.4 / sc0);
        for (let i = BW_SEGS - 1; i >= 0; i--) {
          const x = -58 + i * 17, y = -34 + Math.sin(i * 0.8 + 0.6) * 22;
          const a = Math.atan2(Math.cos(i * 0.8 + 0.6) * 22 * 0.8, 17) + Math.PI;
          put(null, ctx, i === BW_SEGS - 1 ? bwTail(a, true) : bwSeg(a, i % 3, i === BW_WEAK, true), x, y);
        }
        put(null, ctx, bwHead(Math.PI + 0.5, 1, true), -78, -44);
        ctx.restore();
        return;
      }
      const cx = g.camx, cy = g.camy;
      // the lair: a mound of rotten books and the iron candelabra
      if (e.state === 'dormant' || e.state === 'under' || e.state === 'warn' || e.state === 'pass' || e.state === 'pop' || e.state === 'dying') {
        if (e.state === 'dormant') {
          const img = spr('bwmound', 120, 44, BW_PAL, (c) => {
            c.translate(60, 42);
            for (let i = 0; i < 26; i++) {
              const x = Math.sin(i * 2.3) * 46 * (1 - i / 34), y = -3 - (i % 6) * 3.4 * (1 - Math.abs(x) / 56);
              const cols = [BW.cover, BW.green, BW.navy, BW.coverD];
              c.save();
              c.translate(x, y);
              c.rotate(Math.sin(i * 1.7) * 0.6);
              gfx.poly(c, [-7, -3, 7, -3, 7, 3, -7, 3], cols[i % 4]);
              gfx.poly(c, [-6, -2, 6, -2, 6, 1, -6, 1], BW.page);
              c.restore();
            }
            // a glimpse of the worm's back
            for (let i = 0; i < 3; i++) gfx.ellipse(c, -16 + i * 16, -10 - Math.sin(i) * 2, 9, 7, 0, BW.cover);
          });
          put(null, ctx, img, Math.round(e.home.x - cx), Math.round(e.home.y - cy), 60, 42);
          if (e.t % 20 === 0) G.fx.particle(e.home.x + U.rnd(-30, 30), e.home.y - 10, 0, -0.3, '#e8dcb8', 50, { size: 1 });
        }
        if (e.hasCandle) bwCandelabra(e, ctx, Math.round(e.candle.x - cx), Math.round(e.candle.y - cy));
      }
      if (e.state === 'pop' && e.fireZone && e.fireZone.t < 60) {
        const z = e.fireZone;
        const x0 = Math.min(z.x, z.x2) - cx, w = Math.abs(z.x2 - z.x);
        warnRect(ctx, x0, e.A.floor - cy - 6, w, 6, e.t, '#ff6a20', true);
      }
      if (!e.path || e.headGone && e.lost >= BW_SEGS) return;
      const ps = bwParts(e);
      // draw tail → head so the head is on top
      for (let k = ps.length - 1; k >= 0; k--) {
        const p = ps[k];
        if (p.gone) continue;
        if (p.y > (e.A ? e.A.floor : 1e9) + 40) continue;
        const x = Math.round(p.x - cx), y = Math.round(p.y - cy);
        const mir = Math.cos(p.a) < 0;
        if (p.i === -1) {
          if (e.headGone) continue;
          const jaw = e.jaw > 0.66 ? 2 : e.jaw > 0.25 ? 1 : 0;
          put(e, ctx, bwHead(p.a, jaw, mir), x, y);
          lit(e, ctx, x, y, 60, '#ff5a2a', 0.6);
          if (e.inhale > 0) glow(ctx, x + Math.cos(p.a) * 14, y + Math.sin(p.a) * 14, 10 + e.inhale * 14, '#ff8a2a', 0.8);
        } else if (p.i === BW_SEGS - 1) put(e, ctx, bwTail(p.a, mir), x, y);
        else {
          put(e, ctx, bwSeg(p.a, p.i % 3, p.i === BW_WEAK, mir), x, y);
          if (p.i === BW_WEAK) {
            glow(ctx, x, y, 16, '#ffd25a', 0.55 + Math.sin(e.t * 0.15) * 0.15);
            lit(e, ctx, x, y, 54, '#ffd25a', 0.8);
          } else if (e.phase === 2 && !e.hasCandle) {
            glow(ctx, x, y, 12, '#ff6a20', 0.3 + Math.sin(e.t * 0.2 + p.i) * 0.12);
            if (p.i % 3 === 0) lit(e, ctx, x, y, 40, '#ff8a2a', 0.5);
          }
        }
      }
    },
  });
  function bwCandelabra(e, ctx, x, y) {
    const img = spr('bwcandle', 44, 70, ['#2a2230', '#4a4050', '#6a6070', '#efe6d0', '#c9a24a', '#ff9a30', '#fff0a0'], (c) => {
      c.translate(22, 69);
      gfx.poly(c, [-10, 0, 10, 0, 6, -4, -6, -4], '#2a2230');
      gfx.limb(c, 0, -4, 0, -46, 3, '#4a4050');
      gfx.limb(c, -1, -10, -1, -44, 1, '#6a6070');
      for (const s2 of [-1, 1]) {
        gfx.limb(c, 0, -34, s2 * 14, -40, 2.2, '#4a4050');
        gfx.limb(c, s2 * 14, -40, s2 * 14, -46, 2.2, '#4a4050');
        c.fillStyle = '#efe6d0';
        c.fillRect(s2 * 14 - 2, -54, 4, 8);
      }
      c.fillStyle = '#efe6d0';
      c.fillRect(-2, -58, 4, 12);
      c.fillStyle = '#c9a24a';
      c.fillRect(-4, -47, 8, 2);
      c.fillRect(-16, -47, 6, 2);
      c.fillRect(10, -47, 6, 2);
    });
    put(null, ctx, img, x, y, 22, 69);
    const f = e.t % 12 < 6;
    for (const [fx2, fy2] of [[-14, -58], [0, -62], [14, -58]]) {
      ctx.fillStyle = '#ff9a30';
      ctx.fillRect(x + fx2 - 1, y + fy2 - (f ? 4 : 3), 2, f ? 4 : 3);
      ctx.fillStyle = '#fff0a0';
      ctx.fillRect(x + fx2, y + fy2 - 2, 1, 2);
      lit(e, ctx, x + fx2, y + fy2, 40, '#ffa040', 0.8);
    }
  }
  // paths ---------------------------------------------------------------------------------------
  function bwLeap(e, xa, xb, H) {
    const F = e.A.floor, dir = xb > xa ? 1 : -1;
    const pts = [{ x: xa - dir * 30, y: F + 330 }, { x: xa - dir * 12, y: F + 40 }];
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push({ x: U.lerp(xa, xb, u), y: F - H * Math.sin(Math.PI * u) });
    }
    pts.push({ x: xb + dir * 12, y: F + 40 }, { x: xb + dir * 30, y: F + 400 });
    e.path = mkPath(pts);
    e.s = 300;
    e.bob = 0;
    e.emerge = { x: xa, y: F };
    e.dive = { x: xb, y: F };
  }
  // horizontal sine surge past the player: out of the wall when the player is near one,
  // otherwise up out of the floor ~250 px away
  function bwSurge(e, dir, y) {
    const A = e.A, F = A.floor, pl = e.player;
    let x0 = pl.cx - dir * 250;
    const fromWall = dir > 0 ? x0 < A.left + 30 : x0 > A.right - 30;
    const pts = [];
    if (fromWall) {
      x0 = dir > 0 ? A.left : A.right;
      pts.push({ x: x0 - dir * 300, y }, { x: x0 - dir * 10, y });
    } else {
      pts.push({ x: x0 - dir * 20, y: F + 330 }, { x: x0 - dir * 6, y: F + 30 }, { x: x0 + dir * 30, y: (F + y) / 2 }, { x: x0 + dir * 80, y });
      x0 += dir * 80;
    }
    const L = U.clamp(Math.abs((dir > 0 ? A.right - 90 : A.left + 90) - x0), 160, 460);
    const n = 40;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      pts.push({ x: x0 + dir * u * L, y: y + Math.sin((u * L) / 46) * 16 });
    }
    const xe = x0 + dir * L;
    pts.push({ x: xe + dir * 50, y: (y + F) / 2 + 10 }, { x: xe + dir * 70, y: F + 30 }, { x: xe + dir * 80, y: F + 420 });
    e.path = mkPath(pts);
    e.s = 290;
    e.bob = 0;
    e.emerge = { x: x0, y };
  }
  function bwPop(e, x) {
    const F = e.A.floor, pl = e.player;
    const dir = pl.cx < x ? -1 : 1;
    const pts = [{ x, y: F + 330 }, { x, y: F - 40 }, { x: x + dir * 14, y: F - 72 }, { x: x + dir * 34, y: F - 86 }];
    e.popDir = dir;
    e.path = mkPath(pts);
    e.popTop = e.path.L;
    e.s = 0;
    e.bob = 0;
    e.emerge = { x, y: F };
  }
  // telegraph: cracks and flying debris where it will burst out
  function bwWarn(e, g, x, y, T, wall) {
    fxEnt(g, {
      owner: e, x, y, life: T + 10, z: 2,
      upd(q) {
        if (q.t % 4 === 0) {
          if (wall) G.fx.particle(x + (x < e.A.mid ? 4 : -4), y + U.rnd(-16, 16), (x < e.A.mid ? 1 : -1) * U.rnd(0.5, 1.6), U.rnd(-1, 0.5), U.pick(['#4a2418', '#7a4028', '#e8dcb8']), 30, { grav: 0.1, size: 2 });
          else G.fx.particle(x + U.rnd(-18, 18), y - 2, U.rnd(-0.6, 0.6), -U.rnd(1, 3), U.pick(['#4a2418', '#7a4028', '#e8dcb8']), 30, { grav: 0.12, size: 2 });
        }
        if (q.t % 10 === 0) gfx.shake(1.5, 6);
      },
      drawFn(q, ctx, sx, sy) {
        const k = Math.min(1, q.t / T);
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.4 * k;
        ctx.strokeStyle = '#0a0406';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (wall ? Math.PI / 2 : 0) + (i - 2) * 0.55;
          const r = 6 + k * 16;
          ctx.moveTo(sx, sy - (wall ? 0 : 1));
          ctx.lineTo(sx + Math.cos(a) * r * (wall ? 0.4 : 1) * (wall ? 1 : 1), sy + (wall ? Math.sin(a) * r : -Math.abs(Math.sin(a)) * 3));
        }
        ctx.stroke();
        ctx.restore();
        glow(ctx, sx, sy - 4, 10 + k * 16, '#ff5a2a', 0.25 + 0.3 * k);
        if (q.t % 8 < 4) warnRect(ctx, sx - (wall ? 6 : 24), sy - (wall ? 24 : 4), wall ? 12 : 48, wall ? 48 : 4, q.t, '#ff5a2a', true);
      },
    });
  }
  // debris spray while it bursts through the floor or walls
  function bwSpray(e, g) {
    if (!e.path) return;
    const A = e.A;
    for (const p of bwParts(e)) {
      const nearFloor = Math.abs(p.y - A.floor) < 10 && p.x > A.left && p.x < A.right;
      const nearWall = (Math.abs(p.x - A.left) < 10 || Math.abs(p.x - A.right) < 10) && p.y < A.floor;
      if ((nearFloor || nearWall) && e.t % 3 === 0) {
        G.fx.particle(p.x + U.rnd(-8, 8), p.y - 2, U.rnd(-1.5, 1.5), -U.rnd(1, 3), U.pick(['#4a2418', '#7a4028', '#e8dcb8']), 28, { grav: 0.14, size: 2 });
        if (e.t % 12 === 0) sfx('break_wall', { vol: 0.25, pitch: 0.7 });
      }
    }
  }
  function bwContact(e) {
    for (const p of bwParts(e)) {
      if (!bwAbove(e, p)) continue;
      if (pHitCircle(e, p.x, p.y, p.r - 2, e.atk, p.i === -1 ? 'cut' : 'hit')) return;
    }
  }


  // =====================================================================================
  //  5. CLOCKWORK SERAPH  (clk_top)
  // =====================================================================================
  // A brass angel: porcelain mask, glass chest with a beating gear, six bladed wings,
  // a clock-face halo whose hands become giant blades. Flies in figure-eights.
  const SR = { b: '#c8a050', bl: '#f0d890', bd: '#8a6a2a', bdd: '#4a3818', st: '#c8d0e0', stl: '#eef4ff', std: '#7a86a0', mask: '#f0ece0', maskS: '#b8b0a0', eye: '#60e0ff', cu: '#a86a3a', cuD: '#5a3418', glass: '#2a4a5a', red: '#ff5030' };
  const SR_PAL = Object.values(SR);
  function srBody(hot) {
    return spr('srbody' + (hot ? 'h' : ''), 64, 100, SR_PAL, (c) => {
      c.translate(32, 50);
      // pendulum skirt of brass plates down to a bob
      for (let i = 0; i < 5; i++) {
        const x = -10 + i * 5;
        gfx.poly(c, [x - 3, 4, x + 3, 4, x + 1.5, 26 - Math.abs(i - 2) * 3, x - 1.5, 26 - Math.abs(i - 2) * 3], i % 2 ? SR.bd : SR.b);
      }
      gfx.limb(c, 0, 4, 0, 34, 2, SR.bdd);
      for (let i = 0; i < 3; i++) {
        gfx.circle(c, 0, 10 + i * 8, 3.2, SR.cu);
        gfx.circle(c, 0, 10 + i * 8, 1.2, SR.cuD);
      }
      gfx.circle(c, 0, 38, 6, SR.b);
      gfx.circle(c, 0, 38, 3.6, SR.bl);
      gfx.poly(c, [0, 34, 1.2, 37, 4, 38, 1.2, 39, 0, 42, -1.2, 39, -4, 38, -1.2, 37], hot ? SR.red : SR.bd);
      // cuirass
      gfx.poly(c, [-13, -20, 13, -20, 10, -2, 7, 6, -7, 6, -10, -2], SR.b);
      gfx.poly(c, [-11, -19, -2, -19, -4, 4, -7, 5, -8, -2], SR.bl);
      gfx.poly(c, [6, -19, 12, -19, 9, -2, 6, 5], SR.bd);
      // glass chest with the heart-gear
      gfx.circle(c, 0, -9, 6.4, SR.bdd);
      gfx.circle(c, 0, -9, 5.2, SR.glass);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        gfx.limb(c, Math.cos(a) * 2, -9 + Math.sin(a) * 2, Math.cos(a) * 4.4, -9 + Math.sin(a) * 4.4, 1.4, SR.cu);
      }
      gfx.circle(c, 0, -9, 2.4, hot ? SR.red : SR.eye);
      // rivets
      c.fillStyle = SR.bdd;
      for (const [x, y] of [[-10, -17], [10, -17], [-8, 0], [8, 0]]) c.fillRect(x, y, 1.5, 1.5);
      // shoulders + arms with blade fingers
      for (const sd of [-1, 1]) {
        gfx.circle(c, sd * 13, -17, 5.4, SR.b);
        gfx.circle(c, sd * 12.4, -18, 2.4, SR.bl);
        gfx.limb(c, sd * 14, -14, sd * 17, -2, 2.4, SR.bd);
        gfx.limb(c, sd * 17, -2, sd * 16, 8, 2.2, SR.b);
        for (let k = 0; k < 3; k++) gfx.limb(c, sd * 16, 8, sd * (14 + k * 2), 16 + k, 1, SR.st);
      }
      // neck + porcelain mask with a brass crown band
      c.fillStyle = SR.bd;
      c.fillRect(-3, -25, 6, 6);
      gfx.ellipse(c, 0, -32, 7, 9, 0, SR.mask);
      gfx.ellipse(c, -2, -34, 3.5, 5, 0, '#ffffff');
      gfx.ellipse(c, 2.5, -30, 3, 5, 0, SR.maskS);
      c.fillStyle = SR.b;
      c.fillRect(-7, -39, 14, 2.4);
      for (let k = -2; k <= 2; k++) gfx.poly(c, [k * 3 - 1, -39, k * 3, -43 + Math.abs(k), k * 3 + 1, -39], SR.bl);
      c.fillStyle = hot ? SR.red : SR.eye;
      c.fillRect(-5, -33, 3.6, 1.4);
      c.fillRect(1.4, -33, 3.6, 1.4);
      gfx.limb(c, 1.5, -38, 0.5, -28, 0.7, SR.maskS);
      c.fillStyle = SR.maskS;
      c.fillRect(-1.5, -27, 3, 1);
    });
  }
  // the three wings of one side, anchored at the shoulder (24, 64) of a 120x120 canvas
  function srWings(f, spread, hot) {
    return spr('srwing' + f + (spread ? 's' : '') + (hot ? 'h' : ''), 120, 120, SR_PAL, (c) => {
      c.translate(24, 64);
      const flap = Math.sin((f / 8) * TAU) * 0.16;
      const base = spread ? [-1.15, -0.45, 0.25] : [-0.95, -0.35, 0.3];
      base.forEach((a0, w) => {
        const a = a0 + flap * (1 - w * 0.25);
        const L = [66, 74, 54][w];
        const ex = Math.cos(a) * L, ey = Math.sin(a) * L;
        // the feathers: long steel blades hanging from the brass bone
        for (let k = 0; k < 6; k++) {
          const u = 0.25 + k * 0.15;
          const bx = ex * u, by = ey * u;
          const fa = a + 0.95 + k * 0.05 + (spread ? -0.2 : 0);
          const fl = 18 + k * 3 - w * 2;
          gfx.poly(c, [bx - 2, by - 1, bx + Math.cos(fa) * fl, by + Math.sin(fa) * fl, bx + 2.5, by + 1.5], k % 2 ? SR.st : SR.stl);
          gfx.limb(c, bx, by, bx + Math.cos(fa) * fl * 0.8, by + Math.sin(fa) * fl * 0.8, 0.8, SR.std);
        }
        gfx.limb(c, 0, 0, ex, ey, 3.2, SR.bd);
        gfx.limb(c, 0, -1, ex * 0.96, ey * 0.96 - 1, 1.2, hot ? SR.red : SR.bl);
        gfx.circle(c, ex, ey, 2.6, SR.b);
      });
      gfx.circle(c, 0, 0, 5, SR.b);
      gfx.circle(c, 0, 0, 2, SR.cu);
    });
  }
  function srHalo(hot) {
    return spr('srhalo' + (hot ? 'h' : ''), 60, 60, SR_PAL, (c) => {
      c.translate(30, 30);
      c.strokeStyle = SR.b;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(0, 0, 23, 0, TAU);
      c.stroke();
      c.strokeStyle = SR.bl;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(0, 0, 24.5, -2.4, -0.6);
      c.stroke();
      c.strokeStyle = SR.bdd;
      c.beginPath();
      c.arc(0, 0, 20.5, 0, TAU);
      c.stroke();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        gfx.limb(c, Math.cos(a) * 17, Math.sin(a) * 17, Math.cos(a) * (k % 3 === 0 ? 13 : 15), Math.sin(a) * (k % 3 === 0 ? 13 : 15), k % 3 === 0 ? 2 : 1.2, hot ? SR.red : SR.bl);
      }
    });
  }
  function srGear(f, r) {
    return spr('srgear' + r + '_' + f, r * 2 + 8, r * 2 + 8, SR_PAL, (c) => {
      c.translate(r + 4, r + 4);
      c.rotate((f / 6) * (TAU / 8));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        c.save();
        c.rotate(a);
        c.fillStyle = SR.bd;
        c.fillRect(r - 2, -2.5, 4, 5);
        c.restore();
      }
      gfx.circle(c, 0, 0, r - 1, SR.b);
      gfx.circle(c, -1, -1, r - 4, SR.bl);
      gfx.circle(c, 0, 0, r * 0.35, SR.bdd);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + 0.4;
        gfx.circle(c, Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 1.6, SR.bd);
      }
    });
  }
  function bladeFeather(e, g, x, y, ang, sp, wait) {
    const p = e.shoot({
      x, y, vx: wait ? 0 : Math.cos(ang) * sp, vy: wait ? 0 : Math.sin(ang) * sp, w: 8, h: 8, el: 'cut', color: '#eef4ff', life: 260, wall: !wait,
      upd(p) {
        if (p.waiting) {
          p.vx = p.vy = 0;
          p.life = 260;
          if (!(e.stopT > 0)) {
            // time resumes: fly to where the player was frozen
            p.waiting = false;
            p.wall = true;
            const a = Math.atan2(p.ty - p.cy, p.tx - p.cx);
            p.ang = a;
            p.vx = Math.cos(a) * p.sp;
            p.vy = Math.sin(a) * p.sp;
          }
        }
      },
      drawFn(p, ctx, sx, sy) {
        const img = rspr('srfeather', 32, p.ang, 30, 30, SR_PAL, (c) => {
          gfx.poly(c, [-10, -2, 6, -2.4, 12, 0, 6, 2.4, -10, 2], SR.st);
          gfx.limb(c, -8, -0.6, 9, -0.4, 0.9, SR.stl);
          gfx.limb(c, -13, 0, -9, 0, 2.4, SR.b);
        });
        if (p.waiting) {
          warnLine(ctx, sx, sy, sx + Math.cos(p.ang) * 46, sy + Math.sin(p.ang) * 46, G.game.frame, '#eef4ff', 1);
        }
        ctx.drawImage(img, sx - 15, sy - 15);
      },
    });
    p.ang = ang;
    p.sp = sp;
    p.owner = e;
    if (wait) {
      p.waiting = true;
      p.tx = e.player.cx;
      p.ty = e.player.cy;
      p.ignoreTime = true;
    }
    return p;
  }
  function srGearDrop(e, g, x, delay, r) {
    const A = e.A;
    // telegraph: a shadow on the floor and a gear trembling at the ceiling
    fxEnt(g, {
      owner: e, x, y: A.floor, life: delay, z: 2,
      drawFn(q, ctx, sx, sy) {
        const k = q.t / delay;
        ctx.globalAlpha = 0.2 + 0.4 * k;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1, 6 + k * 8, 2 + k, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        // sparks raining from above mark the spot
        if (q.t % 5 === 0) G.fx.particle(x + U.rnd(-6, 6), Math.max(A.top, G.game.camy) + 4, 0, 2.5, '#f0d890', 26, { glow: true });
      },
      done() {
        const y0 = Math.max(A.top + r + 4, G.game.camy - 24);
        const p = e.shoot({
          x, y: y0, vx: 0, vy: 1.5, grav: 0.2, w: r * 2 - 2, h: r * 2 - 2, el: 'hit', color: '#c8a050', life: 260, wall: false, pierce: true,
          upd(p) {
            if (!p.bounced && p.cy + r >= A.floor) {
              p.bounced = true;
              p.y = A.floor - r - p.h / 2;
              p.vy = -3.2;
              p.vx = (p.cx < e.player.cx ? -1 : 1) * 1.6 * (Math.random() < 0.5 ? 1 : -1);
              sfx('gear', { vol: 0.6 });
              gfx.shake(2, 6);
              G.fx.spark(p.cx, A.floor - 2, '#f0d890', 6);
            } else if (p.bounced && p.cy + r >= A.floor && p.vy > 0) {
              p.y = A.floor - r - p.h / 2;
              p.vy = 0;
              p.grav = 0;
            }
            if (p.bounced && (p.cx < A.left + r || p.cx > A.right - r)) p.vx = -p.vx;
            if (p.life < 20) p.h = 0;
          },
          drawFn(p, ctx, sx, sy) {
            if (!p.bounced) {
              ctx.globalAlpha = 0.55;
              ctx.fillStyle = '#000000';
              ctx.beginPath();
              ctx.ellipse(sx, Math.round(A.floor - G.game.camy) - 1, 12, 3, 0, 0, TAU);
              ctx.fill();
            }
            ctx.globalAlpha = Math.min(1, p.life / 20);
            ctx.drawImage(srGear(Math.floor(p.t / 2) % 6, r), sx - r - 4, sy - r - 4);
            ctx.globalAlpha = 1;
          },
        });
        p.owner = e;
      },
    });
  }

  G.defEnemy('seraph', {
    name: N('Clockwork Seraph', 'Serafín de relojería'),
    desc: N('Built to ring the castle’s hours, re-wound by the Scrivener to keep his. When it is angry, the seconds themselves hold their breath.', 'Construido para tocar las horas del castillo, el Escriba le dio cuerda para que marcara las suyas. Cuando se enfada, hasta los segundos contienen el aliento.'),
    area: 'clocktower', boss: true, hp: 3200, atk: 56, def: 12, exp: 4200, w: 30, h: 56,
    weak: ['thunder', 'hit'], resist: ['cut'], armored: true, noBlood: true, noDeathFx: true, flying: true, el: 'cut', immune: ['poison'],
    introScene: 'seraph_pre', wake: wakeSeen(240), previewState: 'idle',
    reward: { items: ['page3', 'hourglass_pin'] },
    init(e) {
      e.phase = 1;
      e.flying = true;
      e.setState('dormant');
      e.contact = false;
      e.wing = 0;
      e.spread = 0;
      e.handLen = 0;
      e.stopT = 0;
      e.home = { x: e.cx, y: e.cy };
      e.last = '';
    },
    onStart(e, g) {
      e.A = scanArena(e, g);
      e.setState('awaken');
      sfx('gear', { vol: 1, pitch: 0.6 });
    },
    onHitCheck: (e) => awake(e),
    onHit(e, hit, g) {
      bossOnHit(e, hit, g);
      if (!e.dying) G.fx.spark(e.cx, e.cy, '#f0d890', 4);
    },
    ai(e, g) {
      const pl = e.player, A = e.A;
      const st = e.state, t = e.stT;
      const p2 = e.phase === 2;
      const k = p2 ? 0.78 : 1;
      if (e.hp <= 0 && !e.dying) startDying(e, g);
      e.wing = (e.wing + (p2 ? 0.34 : 0.22) + e.spread * 0.2) % 8;
      if (p2 && e.t % 3 === 0) G.fx.particle(e.cx + U.rnd(-14, 14), e.cy + U.rnd(-10, 20), U.rnd(-0.3, 0.3), -U.rnd(0.5, 1.2), U.pick(['#e8e8e8', '#b8b8b8', '#ffffff']), 36, { size: 2, drag: 0.96 });
      // keep the player frozen during Stop Time
      if (e.stopT > 0) {
        e.stopT--;
        pl.locked = true;
        pl.atk = null;
        pl.x = e.frozen.x;
        pl.y = e.frozen.y;
        pl.vx = pl.vy = 0;
        if (e.stopT === 0) {
          pl.locked = false;
          sfx('stopwatch', { vol: 0.8, pitch: 1.3 });
          gfx.flash('#ffffff', 6);
        }
      }
      const moveTo = (x, y, sp) => {
        const dx = x - e.cx, dy = y - e.cy;
        e.x += dx * sp;
        e.y += dy * sp;
      };
      const hoverY = () => U.clamp(Math.min(pl.cy, A.floor - 20) - 100, A.top + 50, A.floor - 110);
      // ---------------------------------------------------------------- dormant → awaken
      if (st === 'awaken') {
        e.spread = Math.min(1, t / 60);
        if (t === 30) {
          sfx('gear', { vol: 1 });
          gfx.flash('#f0d890', 8);
        }
        if (t > 60) moveTo(U.clamp(pl.cx + 100, A.left + 80, A.right - 80), hoverY(), 0.04);
        if (t >= 110) {
          e.contact = true;
          e.spread = 0;
          e.setState('fly');
          e.wait = 40;
          e.c0 = { x: e.cx, y: e.cy };
          e.ph = 0;
        }
        return;
      }
      // ---------------------------------------------------------------- dying: falls apart
      if (st === 'dying') {
        if (e.stopT > 0) {
          e.stopT = 0;
          pl.locked = false;
        }
        e.handLen = Math.max(0, e.handLen - 4);
        e.spin = (e.spin || 0) + 0.3;
        if (t < 90) {
          e.x += Math.sin(t * 0.9) * 2;
          e.y += Math.sin(t * 0.5) * 0.5;
          if (t % 5 === 0) {
            for (let i = 0; i < 3; i++) G.fx.particle(e.cx, e.cy, U.rnd(-3, 3), U.rnd(-4, 0), U.pick(['#c8a050', '#f0d890', '#8a6a2a', '#c8d0e0']), 50, { grav: 0.2, size: 2 });
          }
          dyingBlasts(e, g, { x: e.cx - 30, y: e.cy - 40, w: 60, h: 70 }, 8);
        } else {
          // the springs give: it falls and crashes
          e.vy = Math.min(7, (e.vy || 0) + 0.35);
          e.y += e.vy;
          if (e.y + e.h >= A.floor) {
            e.y = A.floor - e.h;
            if (!e.crashed) {
              e.crashed = true;
              G.fx.explode(e.cx, e.cy, 2.6);
              G.fx.debris(e.cx, A.floor - 6, '#c8a050', 24);
              gfx.flash('#fff4d0', 14);
              gfx.shake(9, 36);
              sfx('explosion', { vol: 1, pitch: 0.7 });
              sfx('gear', { vol: 1, pitch: 0.5 });
              e.crashT = t;
            }
          }
          if (e.crashed && t - e.crashT >= 24) finishDying(e, g, e.cx, A.floor);
          if (t > 400) finishDying(e, g, e.cx, A.floor);
        }
        return;
      }
      // ---------------------------------------------------------------- overdrive (phase 2)
      if (st === 'overdrive') {
        e.invuln = 4;
        moveTo(U.clamp(pl.cx, A.left + 80, A.right - 80), hoverY(), 0.05);
        e.spread = Math.min(1, t / 20);
        if (t === 1) {
          phaseShift(e, g, '#ff5030');
          sfx('gear', { vol: 1, pitch: 1.6 });
          sfx('thunder', { vol: 0.5 });
        }
        if (t % 4 === 0) G.fx.particle(e.cx + U.rnd(-20, 20), e.cy, U.rnd(-1.5, 1.5), -U.rnd(1, 2.5), '#ffffff', 40, { size: 3, drag: 0.95 });
        if (t >= 70) {
          e.spread = 0;
          e.setState('fly');
          e.wait = 20;
          e.c0 = { x: e.cx, y: e.cy };
          e.ph = 0;
        }
        return;
      }
      // ---------------------------------------------------------------- figure-eight flight
      if (st === 'fly') {
        e.spread = Math.max(0, e.spread - 0.05);
        e.handLen = Math.max(0, e.handLen - 3);
        e.ph += (p2 ? 1.35 : 1) * (TAU / 260);
        e.c0.x = U.lerp(e.c0.x, U.clamp(pl.cx, A.left + 140, A.right - 140), 0.012);
        e.c0.y = U.lerp(e.c0.y, hoverY(), 0.03);
        const tx = e.c0.x + Math.sin(e.ph) * 120, ty = e.c0.y + Math.sin(e.ph * 2) * 34;
        moveTo(tx, ty, 0.08);
        if (wants2(e)) {
          e.setState('overdrive');
          return;
        }
        if (--e.wait <= 0) {
          const opts = [];
          const add = (s2, w) => {
            if (s2 !== e.last) for (let i = 0; i < w; i++) opts.push(s2);
          };
          add('fan', 4);
          add('hands', 3);
          add('gears', 3);
          add('stop', e.stopCD > 0 ? 0 : 2);
          if (p2) add('dive', 3);
          const s2 = U.pick(opts) || 'fan';
          e.last = s2;
          e.setState(s2);
          if (e.stopCD > 0) e.stopCD--;
        }
        return;
      }
      // ---------------------------------------------------------------- blade-feather fan
      if (st === 'fan') {
        const W = Math.round(32 * k);
        moveTo(e.cx + (pl.cx > e.cx ? 0.4 : -0.4), e.cy, 1);
        e.spread = Math.min(1, t / (W * 0.6));
        if (t === 2) sfx('magic_cast', { vol: 0.7, pitch: 1.4 });
        if (t < W && t % 3 === 0) G.fx.spark(e.cx + U.rnd(-50, 50), e.cy + U.rnd(-30, 10), '#eef4ff', 1);
        const n = p2 ? 7 : 5;
        const volleys = p2 ? 2 : 1;
        for (let v = 0; v < volleys; v++) {
          if (t === W + v * 22) {
            const a0 = Math.atan2(pl.cy - e.cy, pl.cx - e.cx);
            for (let i = 0; i < n; i++) {
              const off = (i - (n - 1) / 2) * 0.2 + (v ? 0.1 : 0);
              const side = i < n / 2 ? -1 : 1;
              bladeFeather(e, g, e.cx + side * 26, e.cy - 10 + Math.abs(i - (n - 1) / 2) * 4, a0 + off, 3.5);
            }
            sfx('swing_light', { vol: 0.8, pitch: 1.5 });
          }
        }
        if (t >= W + volleys * 22 + 24) {
          e.setState('fly');
          e.wait = Math.round((p2 ? 40 : 60) + e.rnd.int(0, 20));
        }
        return;
      }
      // ---------------------------------------------------------------- clock-hand sweep
      if (st === 'hands') {
        const W = Math.round(46 * k);
        if (t === 1) {
          e.hx = U.clamp(pl.cx + (pl.cx < e.cx ? 60 : -60), A.left + 130, A.right - 130);
          e.hy = Math.min(A.floor - 104, pl.cy - 64);
          e.handA = -Math.PI / 2;
          e.handB = -Math.PI / 2 + 0.6;
          sfx('gear', { vol: 0.8 });
        }
        if (t < W) {
          moveTo(e.hx, e.hy, 0.12);
          e.handLen = Math.min(1, t / W);
          if (t % 10 === 0) sfx('gear', { vol: 0.35, pitch: 1.8 });
        } else {
          const T2 = Math.round(170 * k);
          const tt = t - W;
          if (p2) moveTo(U.clamp(pl.cx, A.left + 130, A.right - 130), e.hy, 0.006);
          e.handLen = tt < T2 ? 1 : Math.max(0, 1 - (tt - T2) / 20);
          const spd = (p2 ? 0.05 : 0.04) * Math.min(1, tt / 20);
          e.handA += spd;
          e.handB -= spd * 0.55;
          if (tt % 18 === 0) sfx('gear', { vol: 0.5, pitch: 1.2 });
          if (tt < T2) {
            const cx = e.cx, cy = e.cy - 30;
            pHitLine(e, cx, cy, cx + Math.cos(e.handA) * 118, cy + Math.sin(e.handA) * 118, 3, e.atk, 'cut');
            pHitLine(e, cx, cy, cx + Math.cos(e.handB) * 84, cy + Math.sin(e.handB) * 84, 3, e.atk, 'cut');
          }
          if (tt >= T2 + 20) {
            e.setState('fly');
            e.wait = Math.round((p2 ? 30 : 50) + e.rnd.int(0, 20));
            e.c0 = { x: e.cx, y: e.cy };
          }
        }
        return;
      }
      // ---------------------------------------------------------------- gear rain
      if (st === 'gears') {
        e.spread = Math.min(0.6, t / 30);
        moveTo(e.cx, e.cy - 0.3, 1);
        if (t === 2) sfx('gear', { vol: 1, pitch: 0.8 });
        const n = p2 ? 9 : 6;
        if (t === 8) {
          const xs = [];
          for (let i = 0; i < n; i++) xs.push(U.clamp(pl.cx + (i - (n - 1) / 2) * 44 + U.rnd(-8, 8), A.left + 16, A.right - 16));
          // make sure there is a gap the player can stand in
          xs.sort(() => e.rnd.next() - 0.5);
          xs.forEach((x, i) => srGearDrop(e, g, x, Math.round(40 * k) + i * Math.round(9 * k), i % 3 === 0 ? 12 : 9));
        }
        if (t >= 8 + Math.round(40 * k) + n * 9 + 30) {
          e.setState('fly');
          e.wait = Math.round((p2 ? 30 : 50) + e.rnd.int(0, 20));
        }
        return;
      }
      // ---------------------------------------------------------------- Stop Time
      if (st === 'stop') {
        if (t === 1) {
          sfx('stopwatch', { vol: 1, pitch: 0.7 });
          e.spread = 1;
        }
        // halo flares (telegraph)
        if (t === 34) {
          clearShots(e, g);
          e.stopT = 66;
          e.frozen = { x: pl.x, y: pl.y };
          gfx.flash('#c0c8ff', 8);
          sfx('thunder', { vol: 0.5, pitch: 1.4 });
          // grey world overlay
          fxEnt(g, {
            owner: e, x: 0, y: 0, life: 66, z: 50, free: true, keep: true,
            drawFn(q, ctx) {
              ctx.save();
              ctx.globalCompositeOperation = 'saturation';
              ctx.fillStyle = '#808080';
              ctx.fillRect(0, 0, G.W, G.H);
              ctx.globalCompositeOperation = 'source-over';
              ctx.fillStyle = 'rgba(150,160,200,0.08)';
              ctx.fillRect(0, 0, G.W, G.H);
              ctx.restore();
            },
          });
        }
        if (t >= 34 && t < 100) {
          // reposition in a flash, then plant blade feathers around the frozen dhampir
          const tt = t - 34;
          if (tt === 6) {
            G.fx.burst(e.cx, e.cy, '#f0d890', 14, 2);
            const side = pl.cx < A.mid ? 1 : -1;
            e.x = U.clamp(pl.cx + side * 110, A.left + 60, A.right - 60) - e.w / 2;
            e.y = U.clamp(pl.cy - 100, A.top + 40, A.floor - 120) - e.h / 2;
            G.fx.burst(e.cx, e.cy, '#f0d890', 14, 2);
            sfx('teleport', { vol: 0.5 });
          }
          const n = p2 ? 6 : 4;
          for (let i = 0; i < n; i++) {
            if (tt === 14 + i * 8) {
              // a fan from above (within ±54° of vertical): a decisive sidestep clears them all
              const a = -Math.PI / 2 + ((i - (n - 1) / 2) / ((n - 1) / 2)) * 0.94;
              const r = 78;
              const fx0 = pl.cx + Math.cos(a) * r, fy0 = pl.cy + Math.sin(a) * r;
              const p = bladeFeather(e, g, fx0, fy0, Math.atan2(pl.cy - fy0, pl.cx - fx0), p2 ? 2.8 : 2.2, true);
              G.fx.spark(fx0, fy0, '#eef4ff', 4);
              sfx('swing_light', { vol: 0.4, pitch: 1.8 });
            }
          }
        }
        if (t >= 120) {
          e.spread = 0;
          e.stopCD = 3;
          e.setState('fly');
          e.wait = Math.round(50 * k);
          e.c0 = { x: e.cx, y: e.cy };
        }
        return;
      }
      // ---------------------------------------------------------------- pendulum dive (phase 2)
      if (st === 'dive') {
        if (t === 1) {
          e.side = pl.cx < A.mid ? 1 : -1;
          e.dx0 = U.clamp(pl.cx + e.side * 150, A.left + 60, A.right - 60);
          e.dx1 = U.clamp(pl.cx - e.side * 150, A.left + 60, A.right - 60);
          e.dy0 = Math.max(A.top + 50, A.floor - 150);
          sfx('gear', { vol: 0.8, pitch: 1.5 });
        }
        const W = 46;
        if (t < W) {
          moveTo(e.dx0, e.dy0, 0.1);
          e.spread = 1;
          e.diving = false;
          if (t % 8 === 0) sfx('gear', { vol: 0.4, pitch: 2 });
        } else {
          const T = 62;
          const u = Math.min(1, (t - W) / T);
          e.diving = true;
          const x = U.lerp(e.dx0, e.dx1, ease(u));
          const y = e.dy0 + Math.sin(Math.PI * ease(u)) * (A.floor - 34 - e.dy0);
          e.x = x - e.w / 2;
          e.y = y - e.h / 2;
          if (t === W) sfx('swing_heavy', { vol: 1, pitch: 0.8 });
          if (t % 3 === 0) G.fx.particle(e.cx, e.cy, 0, 0, '#f0d890', 20, { glow: true, size: 2 });
          if (u >= 1) {
            e.diving = false;
            e.setState('fly');
            e.wait = 40;
            e.c0 = { x: e.cx, y: e.cy };
          }
        }
        return;
      }
    },
    draw(e, ctx, sx, sy) {
      const pre = e.preview;
      const hot = e.phase === 2;
      const bx = sx, by = sy - e.h / 2; // body centre
      if (pre) {
        ctx.save();
        const sc0 = Math.min(1, 60 / e.h, 90 / e.w);
        const k = 0.5 / sc0;
        ctx.translate(0, -28);
        ctx.scale(k, k);
        drawSeraph(e, ctx, 0, 0, false, 0.3);
        ctx.restore();
        return;
      }
      if (e.state === 'dormant') {
        // folded wings, cold halo
        drawSeraph(e, ctx, bx, by, false, -0.2, true);
        return;
      }
      drawSeraph(e, ctx, bx, by, hot, e.spread);
      // clock hands
      const L = e.handLen || 0;
      const hcx = bx, hcy = by - 30;
      if (e.state === 'hands' && e.stT < Math.round(46 * (hot ? 0.78 : 1))) {
        // telegraph: the reach of the long hand
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(e.t * 0.5);
        ctx.strokeStyle = '#f0d890';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(hcx, hcy, 118, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      const hand = (a, len, w, col) => {
        if (len < 8) return;
        const tx = hcx + Math.cos(a) * len, ty = hcy + Math.sin(a) * len;
        const nx = -Math.sin(a), ny = Math.cos(a);
        ctx.fillStyle = OUT;
        ctx.beginPath();
        ctx.moveTo(hcx + nx * (w + 1), hcy + ny * (w + 1));
        ctx.lineTo(tx + Math.cos(a) * 2, ty + Math.sin(a) * 2);
        ctx.lineTo(hcx - nx * (w + 1), hcy - ny * (w + 1));
        ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(hcx + nx * w, hcy + ny * w);
        ctx.lineTo(tx, ty);
        ctx.lineTo(hcx - nx * w, hcy - ny * w);
        ctx.fill();
        ctx.fillStyle = '#fff4c0';
        ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2);
      };
      if (L > 0) {
        hand(e.handA, 14 + 104 * L, 4, hot ? '#ff8050' : '#f0d890');
        hand(e.handB, 12 + 72 * L, 3.4, hot ? '#ff5030' : '#c8a050');
        glow(ctx, hcx, hcy, 20, '#f0d890', 0.5 * L);
      } else {
        // the regular clock hands on the halo
        const tm = e.t * 0.02;
        hand(tm, 16, 1.4, '#4a3818');
        hand(tm / 12 + 1, 11, 1.6, '#4a3818');
      }
      if (e.diving) {
        glow(ctx, bx, by + 30, 18, '#ff8050', 0.6);
      }
      if (e.state === 'dive' && !e.diving && e.stT > 10 && e.dx0 != null) {
        // telegraph: the pendulum's swing path
        const g = G.game;
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.25 * Math.sin(e.t * 0.5);
        ctx.fillStyle = '#ff8050';
        for (let i = 0; i <= 24; i++) {
          const u = i / 24;
          const x = U.lerp(e.dx0, e.dx1, ease(u)) - g.camx;
          const y = e.dy0 + Math.sin(Math.PI * ease(u)) * (e.A.floor - 34 - e.dy0) - g.camy;
          ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        }
        ctx.restore();
        glow(ctx, bx, by + 38, 12 + (e.stT % 10), '#ff5030', 0.7);
      }
      lit(e, ctx, bx, by - 20, 90, hot ? '#ff7040' : '#f0d890', 0.8);
      lit(e, ctx, bx, by - 9, 30, hot ? '#ff5030' : '#60e0ff', 0.7);
    },
  });
  function drawSeraph(e, ctx, bx, by, hot, spread, folded) {
    const f = Math.floor(e.wing) % 8;
    const sp = spread > 0.5;
    const wings = srWings(folded ? 0 : f, sp, hot);
    const wy = by - 14;
    if (folded) {
      // dormant: wings folded down along the body like a closed shroud of blades
      for (const s2 of [-1, 1]) {
        ctx.save();
        ctx.translate(bx + s2 * 6, wy);
        ctx.scale(s2, 1);
        ctx.rotate(1.25);
        put(e, ctx, wings, 0, 0, 24, 64);
        ctx.restore();
      }
    } else {
      put(e, ctx, wings, bx + 8, wy, 24, 64);
      put(e, ctx, wings, bx - 8, wy, 24, 64, true);
    }
    ctx.globalAlpha = folded ? 0.6 : 1;
    put(e, ctx, srHalo(hot), bx, by - 30);
    ctx.globalAlpha = 1;
    put(e, ctx, srBody(hot), bx, by);
  }



  // =====================================================================================
  //  6. THE SCRIVENER  (keep_throne) — phase 1: the hooded scribe; phase 2: the Living Chronicle
  // =====================================================================================
  const SC = { robe: '#1a1020', robeM: '#2e2040', robeL: '#4a3a66', inkD: '#0c0614', mask: '#c8c0cc', maskS: '#8a8296', eye: '#c890ff', eyeL: '#f0e0ff', tear: '#3a2a5a', quill: '#e8dcc0', quillS: '#b8aa88', gold: '#c9a24a', blood: '#a01020', bloodL: '#ff3a4a', page: '#efe4c8', pageS: '#c8b896', pageD: '#8a7a5a', cover: '#3a0c18', coverL: '#6a1a2a' };
  const SC_PAL = Object.values(SC);
  // a tiny 5x7 font for the glyph words he writes in the air
  const GLYPH = {
    A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', D: '11110100011000110001100011000111110',
    E: '11111100001000011110100001000011111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
    L: '10000100001000010000100001000011111', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110',
    S: '01111100001000001110000010000111110', V: '10001100011000110001100010101000100', T: '11111001000010000100001000010000100',
    R: '11110100011000111110101001001010001',
  };
  const WORDS = ['ERASE', 'NIHIL', 'DELETE', 'OBLIVIO', 'SILENT'];
  function glyphImg(ch) {
    return spr('glyph' + ch, 16, 20, ['#c890ff', '#f0e0ff', '#5a3a8a'], (c) => {
      const bits = GLYPH[ch] || GLYPH.O;
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 5; x++)
          if (bits[y * 5 + x] === '1') {
            c.fillStyle = y < 2 ? '#f0e0ff' : '#c890ff';
            c.fillRect(3 + x * 2, 3 + y * 2, 2, 2);
          }
    }, 60);
  }
  // phase 1 body: pose 'idle' | 'write' | 'raise' | 'hurt'; f animation frame
  function scribeImg(pose, f) {
    return spr('scribe_' + pose + f, 64, 88, SC_PAL, (c) => {
      c.translate(32, 84);
      const sway = [0, 1, 0, -1][f % 4];
      // tattered hem dripping ink
      for (let i = 0; i < 6; i++) {
        const x = -14 + i * 5.6;
        const len = 6 + ((i * 7 + f * 3) % 5);
        gfx.poly(c, [x - 2.6, -10, x + 2.6, -10, x + 0.6 + sway * 0.5, -10 + len, x - 0.6 + sway * 0.5, -10 + len - 2], i % 2 ? SC.robe : SC.inkD);
      }
      // robe
      gfx.poly(c, [-16, -8, 16, -8, 12, -42, 8, -54, -8, -54, -12, -42], SC.robe);
      gfx.poly(c, [-6, -8, 6, -8, 5, -48, -5, -48], SC.robeM);
      gfx.limb(c, 0, -10, 0, -46, 1, SC.robeL);
      // belt of quills and a chain of tiny books
      gfx.limb(c, -11, -30, 11, -30, 2, SC.inkD);
      for (let i = 0; i < 3; i++) {
        c.fillStyle = [SC.cover, SC.robeL, SC.gold][i];
        c.fillRect(-9 + i * 6, -29, 4, 5);
      }
      // the back arm (book hand)
      const ba = pose === 'raise' ? -2.3 : -0.5;
      gfx.limb(c, -9, -48, -9 + Math.sin(ba + Math.PI) * -8, -48 + Math.cos(ba) * 12, 6, SC.robe);
      // hood and mask
      gfx.poly(c, [-11, -50, -8, -66, 0, -74, 8, -66, 11, -50, 0, -46], SC.robe);
      gfx.poly(c, [-8, -52, -6, -64, 0, -69, 6, -64, 8, -52, 0, -49], SC.inkD);
      gfx.ellipse(c, 1, -58, 4.4, 5.6, 0, SC.mask);
      gfx.ellipse(c, -1, -59, 2, 4, 0, SC.maskS);
      c.fillStyle = SC.eye;
      c.fillRect(-1, -60, 2.4, 1.2);
      c.fillRect(2.6, -60, 2.4, 1.2);
      c.fillStyle = SC.eyeL;
      c.fillRect(-0.4, -60, 1, 1);
      c.fillRect(3.2, -60, 1, 1);
      c.fillStyle = SC.tear;
      c.fillRect(-0.6, -58.6, 1.2, 5);
      c.fillRect(3.4, -58.6, 1.2, 4);
      // the quill arm
      let ax, ay, qa;
      if (pose === 'write') {
        const wv = [0, 0.4, -0.2, 0.3][f % 4];
        ax = 15;
        ay = -60 + wv * 4;
        qa = -1.1 + wv;
      } else if (pose === 'raise') {
        ax = 12;
        ay = -76;
        qa = -1.5;
      } else if (pose === 'hurt') {
        ax = 14;
        ay = -42;
        qa = -0.4;
      } else {
        ax = 14;
        ay = -44 + sway;
        qa = -1.2;
      }
      gfx.limb(c, 8, -48, ax, ay, 6, SC.robe);
      gfx.limb(c, 8, -48, ax, ay, 2, SC.robeM);
      gfx.circle(c, ax, ay, 2, SC.mask);
      // the quill
      const qx = ax + Math.cos(qa) * 22, qy = ay + Math.sin(qa) * 22;
      gfx.poly(c, [ax - Math.cos(qa) * 3, ay - Math.sin(qa) * 3, qx + Math.cos(qa + 1.4) * 4, qy + Math.sin(qa + 1.4) * 4, qx, qy, qx + Math.cos(qa - 1.4) * 2, qy + Math.sin(qa - 1.4) * 2], SC.quill);
      gfx.limb(c, ax, ay, qx, qy, 0.9, SC.quillS);
      gfx.limb(c, ax - Math.cos(qa) * 3, ay - Math.sin(qa) * 3, ax - Math.cos(qa) * 7, ay - Math.sin(qa) * 7, 1.4, SC.tear);
    });
  }
  // phase 2: the Living Chronicle (a huge open book with a blood-ink eye)
  function chronicleImg(f, eye) {
    return spr('chron' + f + '_' + eye, 168, 112, SC_PAL, (c) => {
      c.translate(84, 58);
      // covers behind
      gfx.poly(c, [-80, -36, -4, -46, 4, -46, 80, -36, 76, 40, 4, 34, -4, 34, -76, 40], SC.cover);
      gfx.poly(c, [-78, -34, -6, -43, -6, -38, -74, -30], SC.coverL);
      c.fillStyle = SC.gold;
      for (const [x, y] of [[-80, -36], [72, -36], [-76, 34], [70, 34]]) c.fillRect(x, y, 8, 6);
      // page stacks
      gfx.poly(c, [-74, -32, -4, -40, -4, 30, -72, 36], SC.pageS);
      gfx.poly(c, [74, -32, 4, -40, 4, 30, 72, 36], SC.pageS);
      // the open pages, curved
      const fl = [0, 2, 4, 2][f % 4];
      c.fillStyle = SC.page;
      c.beginPath();
      c.moveTo(-2, -38);
      c.quadraticCurveTo(-38, -46 - fl, -70, -34);
      c.lineTo(-68, 32);
      c.quadraticCurveTo(-36, 24, -2, 30);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(2, -38);
      c.quadraticCurveTo(38, -46 + fl * 0.5, 70, -34);
      c.lineTo(68, 32);
      c.quadraticCurveTo(36, 24, 2, 30);
      c.closePath();
      c.fill();
      // lines of ink text
      for (let i = 0; i < 9; i++) {
        const y = -28 + i * 6.4;
        gfx.limb(c, -64, y + 2, -12, y - 2, 0.9, i % 3 === 0 ? SC.blood : SC.pageD);
        gfx.limb(c, 12, y - 2, 64, y + 2, 0.9, i % 4 === 1 ? SC.blood : SC.pageD);
      }
      // a page flapping loose
      gfx.poly(c, [70, -34, 86, -46 + fl * 2, 84, -20 + fl, 68, -10], SC.page);
      // ink veins spreading from the eye
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + 0.3;
        gfx.limb(c, Math.cos(a) * 12, Math.sin(a) * 8, Math.cos(a) * (26 + (k % 3) * 8), Math.sin(a) * (16 + (k % 2) * 6), 1.2, SC.blood);
      }
      // the blood-ink eye in the gutter
      const open = eye === 2 ? 1 : eye === 1 ? 0.55 : 0.85;
      gfx.ellipse(c, 0, -4, 16, 11 * open + 1, 0, SC.inkD);
      gfx.ellipse(c, 0, -4, 13, 9 * open, 0, '#f4ecdc');
      gfx.circle(c, 0, -4, 7 * Math.max(0.6, open), SC.blood);
      gfx.circle(c, 0, -4, 5 * Math.max(0.6, open), SC.bloodL);
      gfx.ellipse(c, 0, -4, 1.6, 6 * open, 0, SC.inkD);
      c.fillStyle = '#ffffff';
      c.fillRect(-4, -8, 2, 2);
      // spine
      gfx.limb(c, 0, -44, 0, -16, 2, SC.cover);
      gfx.limb(c, 0, 8, 0, 33, 2, SC.cover);
    });
  }
  function quillImg(ang) {
    return rspr('bigquill', 32, ang, 96, 96, SC_PAL, (c) => {
      // pointing +x: nib at +44, feather towards -x
      gfx.poly(c, [44, 0, 30, -3, 30, 3], SC.inkD);
      gfx.poly(c, [32, -2.4, 36, 0, 32, 2.4], SC.gold);
      gfx.limb(c, -40, 0, 32, 0, 2, SC.quillS);
      for (let k = 0; k < 9; k++) {
        const x = -36 + k * 7;
        const w = 10 - Math.abs(k - 3) * 1.5;
        gfx.poly(c, [x, 0, x - 8, -w, x + 4, -1], k % 2 ? SC.quill : SC.page);
        gfx.poly(c, [x, 0, x - 7, w * 0.8, x + 4, 1], k % 2 ? SC.quillS : SC.quill);
      }
      gfx.circle(c, 40, 0, 1.6, SC.blood);
    });
  }
  // an ink copy of an earlier boss' sprite
  function inkCopy(key, src) {
    const map = {};
    const ink = ['#6a4a9a', '#4a3470', '#33244e', '#241838', '#160e24', '#0c0614', '#05020a'];
    [CB.L, CB.M, CB.S, CB.D, CB.DD, CB.K, CB.X].forEach((c, i) => (map[c] = ink[i]));
    map[CB_EMBER[0]] = '#c890ff';
    map[CB_EMBER[1]] = '#f0e0ff';
    map[CB.R] = '#3a1a5a';
    map[CB.RL] = '#5a3a8a';
    map['#c03a10'] = '#3a1a5a';
    return gfx.recolor('boss_ink_' + key, src, map);
  }
  function scGlyphShot(e, g, x, y, ch, delay) {
    // the letter glows in place while the word is written (harmless), then flies at the player
    fxEnt(g, {
      owner: e, x, y, life: delay, z: 3,
      drawFn(q, ctx, sx, sy) {
        const a = Math.min(1, q.t / 8);
        glow(ctx, sx, sy, 12, '#9a6aff', 0.5 * a);
        ctx.globalAlpha = a;
        ctx.drawImage(glyphImg(ch), sx - 8, sy - 10 + Math.round(Math.sin(q.t * 0.2 + x) * 1.5));
        ctx.globalAlpha = 1;
        lit(null, ctx, sx, sy, 30, '#c890ff', 0.5);
      },
      done() {
        const a = Math.atan2(e.player.cy - y, e.player.cx - x);
        const p = e.shoot({
          x, y, vx: Math.cos(a) * 3.3, vy: Math.sin(a) * 3.3, w: 12, h: 14, el: 'dark', color: '#c890ff', life: 200, wall: true,
          upd(p) {
            if (p.t % 3 === 0) G.fx.particle(p.cx, p.cy, 0, 0, '#5a3a8a', 16, { size: 1 });
          },
          drawFn(p, ctx, sx, sy) {
            glow(ctx, sx, sy, 12, '#9a6aff', 0.5);
            ctx.drawImage(glyphImg(ch), sx - 8, sy - 10);
            lit(null, ctx, sx, sy, 30, '#c890ff', 0.5);
          },
        });
        p.owner = e;
        sfx('magic_cast', { vol: 0.35, pitch: 1.8 });
      },
    });
  }
  // ink rain: stains spread on the ceiling, then drops fall from them
  function scInkRain(e, g, x0, x1, n, k) {
    const A = e.A;
    for (let i = 0; i < n; i++) {
      const x = U.lerp(x0, x1, (i + 0.5) / n) + U.rnd(-6, 6);
      const T = Math.round((44 + (i % 2) * 10 + Math.floor(i / 2) * 4) * k);
      fxEnt(g, {
        owner: e, x, y: A.top, life: T, z: 2,
        drawFn(q, ctx, sx, sy) {
          const r = 2 + (q.t / T) * 6;
          ctx.fillStyle = '#0c0614';
          ctx.beginPath();
          ctx.ellipse(sx, sy + 1, r, r * 0.6, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#5a3a8a';
          ctx.fillRect(sx - 1, sy + Math.round(r * 0.6), 2, Math.round((q.t / T) * 4));
        },
        done() {
          const p = e.shoot({
            x, y: A.top + 6, vx: 0, vy: 1, grav: 0.32, w: 6, h: 10, el: 'dark', color: '#3a2a5a', life: 120, wall: true,
            drawFn(p, ctx, sx, sy) {
              ctx.fillStyle = '#0c0614';
              ctx.fillRect(sx - 2, sy - 5, 4, 9);
              ctx.fillStyle = '#5a3a8a';
              ctx.fillRect(sx - 1, sy - 4, 1, 4);
            },
            onWall(p) {
              G.fx.burst(p.cx, p.cy - 2, '#3a2a5a', 6, 1.4);
              if (Math.random() < 0.3) sfx('ink_splash', { vol: 0.25, pitch: 1.4 });
            },
          });
          p.owner = e;
        },
      });
    }
  }
  // ink echo of the Bone Colossus: a skull rises from the floor and spits three ink skulls
  function scSkullEcho(e, g, x) {
    const A = e.A;
    const skull = inkCopy('skull', colSkull(false, true)), jaw = inkCopy('jaw', colJaw(false));
    fxEnt(g, {
      owner: e, x, y: A.floor, life: 130, z: 1,
      upd(q) {
        if (q.t === 1) sfx('stomp', { vol: 0.5, pitch: 0.6 });
        if (q.t < 30 && q.t % 4 === 0) G.fx.dust(x, A.floor, 2);
        if (q.t >= 58 && q.t <= 72 && (q.t - 58) % 7 === 0) {
          const i = (q.t - 58) / 7;
          const tx = U.clamp(e.player.cx + (i - 1) * 54, A.left + 10, A.right - 10);
          const mx = x, my = A.floor - 40;
          const T = 50, grav = 0.18;
          const vx = (tx - mx) / T, vy = (A.floor - 8 - my - 0.5 * grav * T * T) / T;
          const p = e.shoot({
            x: mx, y: my, vx, vy, grav, w: 12, h: 12, el: 'dark', color: '#9a6aff', life: 160, wall: true,
            upd(p) {
              if (p.t % 2 === 0) G.fx.particle(p.cx, p.cy, 0, -0.4, U.pick(['#5a3a8a', '#9a6aff']), 16, { glow: true });
            },
            drawFn(p, ctx, sx, sy) {
              glow(ctx, sx, sy, 14, '#7a4ad0', 0.6);
              ctx.drawImage(inkCopy('fskull' + (Math.floor(p.t / 3) % 8), flameSkull(Math.floor(p.t / 3) % 8)), sx - 14, sy - 14);
            },
          });
          p.owner = e;
          sfx('fireball', { vol: 0.5, pitch: 0.6 });
        }
      },
      drawFn(q, ctx, sx, sy) {
        const rise = q.t < 30 ? q.t / 30 : q.t > 100 ? Math.max(0, 1 - (q.t - 100) / 30) : 1;
        const jo = q.t > 40 && q.t < 90 ? 7 : 0;
        ctx.save();
        ctx.beginPath();
        ctx.rect(sx - 40, sy - 90, 80, 90);
        ctx.clip();
        const y = sy - 44 * rise + 10;
        ctx.globalAlpha = 0.9;
        gfx.drawAnchored(jaw, sx, y + 13 + jo, 20, 4, false, null, ctx);
        gfx.drawAnchored(skull, sx, y, 32, 32, false, null, ctx);
        ctx.restore();
        ctx.globalAlpha = 1;
        if (jo) glow(ctx, sx, y + 18, 12, '#9a6aff', 0.6);
        lit(null, ctx, sx, sy - 30, 50, '#9a6aff', 0.6 * rise);
      },
    });
  }
  // ink echo of the Belmont: a silhouette lashes its whip (high: crouch, low: jump)
  function scWhipEcho(e, g, x, dir, low) {
    const A = e.A;
    const cv = gfx.makeCanvas(EC_W, EC_H, true);
    const sil = gfx.makeCanvas(EC_W, EC_H);
    const W = 34;
    fxEnt(g, {
      owner: e, x, y: A.floor, life: W + 40, z: 1,
      upd(q) {
        if (q.t === 1) {
          sfx('ghost_wail', { vol: 0.4, pitch: 1.3 });
          G.fx.burst(x, A.floor - 20, '#5a3a8a', 14, 1.6);
        }
        if (q.t === W) sfx('whip', { vol: 1, pitch: 0.8 });
        if (q.t >= W && q.t < W + 8) {
          const y = low ? A.floor - 14 : A.floor - 31;
          const x0 = dir > 0 ? x + 6 : x - 6 - 112;
          pHit(e, x0, y - 5, 112, 10, e.atk, 'dark', { status: 'curse', chance: 0.15 });
        }
      },
      drawFn(q, ctx, sx, sy) {
        const ph = q.t < W ? q.t / W : q.t < W + 8 ? 1 + (q.t - W) / 8 : 2 + Math.min(0.99, (q.t - W - 8) / 16);
        const pose = G.alucardPose('attack', q.t, { phase: ph, wtype: 'whip', crouch: low });
        const r = paintHunter(cv, pose, null, { handle: true });
        const s2 = gfx.ctxOf(sil);
        s2.globalCompositeOperation = 'source-over';
        s2.clearRect(0, 0, EC_W, EC_H);
        s2.drawImage(cv, 0, 0);
        s2.globalCompositeOperation = 'source-in';
        s2.fillStyle = '#140a22';
        s2.fillRect(0, 0, EC_W, EC_H);
        s2.globalCompositeOperation = 'source-over';
        const a = q.t < 10 ? q.t / 10 : q.life < 14 ? q.life / 14 : 1;
        ctx.globalAlpha = 0.9 * a;
        gfx.drawAnchored(sil, sx, sy, EC_AX, EC_AY, dir < 0, null, ctx);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 * a;
        gfx.drawAnchored(cv, sx, sy, EC_AX, EC_AY, dir < 0, null, ctx);
        ctx.restore();
        ctx.globalAlpha = 1;
        // the lash
        if (q.t >= W - 1 && q.t < W + 12) {
          const k = Math.min(1, (q.t - W + 2) / 3);
          const hx = sx + r.hand.x * dir, hy = sy + r.hand.y;
          G.drawWhip(ctx, hx, hy, dir, 112 * k, q.t, '#5a3a8a', '#c890ff');
        }
        if (q.t > 6 && q.t < W) warnLine(ctx, sx + dir * 8, sy - (low ? 14 : 31), sx + dir * 118, sy - (low ? 14 : 31), q.t, '#c890ff', 1);
      },
    });
  }
  // the erasure: a beam from the eye down to a height, then two fronts racing outwards
  function scErasure(e, g, low) {
    const A = e.A;
    const y = low ? A.floor - 9 : A.floor - 35;
    const h = low ? 18 : 18;
    const x = e.cx;
    sfx('spell_dark', { vol: 0.9, pitch: 0.7 });
    gfx.flash('#ff3a4a', 6);
    gfx.shake(4, 14);
    // the column
    const col = e.shoot({
      x, y: (e.cy + 20 + y) / 2, vx: 0, w: 22, h: Math.max(10, y - e.cy - 20), el: 'dark', life: 26, wall: false, pierce: true, magic: true, unblockable: true, color: '#ff3a4a', status: 'curse', chance: 0.3,
      drawFn(p, ctx, sx, sy) {
        const a = Math.min(1, p.life / 8);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = U.rgba('#ff3a4a', 0.6 * a);
        ctx.fillRect(sx - 11, sy - p.h / 2, 22, p.h);
        ctx.fillStyle = U.rgba('#ffffff', 0.8 * a);
        ctx.fillRect(sx - 4, sy - p.h / 2, 8, p.h);
        ctx.restore();
      },
    });
    col.owner = e;
    for (const d of [-1, 1]) {
      const p = e.shoot({
        x: x + d * 20, y, vx: d * 5.2, w: 40, h, el: 'dark', life: 150, wall: true, pierce: true, magic: true, unblockable: true, color: '#ff3a4a', status: 'curse', chance: 0.35,
        upd(p) {
          if (p.t % 2 === 0) G.fx.particle(p.cx - d * 16, p.cy + U.rnd(-6, 6), -d * 0.5, U.rnd(-0.6, 0.6), U.pick(['#ff3a4a', '#ffffff', '#efe4c8']), 18, { glow: true });
          if (p.cx < A.left + 8 || p.cx > A.right - 8) p.dead = true;
        },
        drawFn(p, ctx, sx, sy) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const gr = ctx.createLinearGradient(sx - d * 60, 0, sx + d * 20, 0);
          gr.addColorStop(0, U.rgba('#ff3a4a', 0));
          gr.addColorStop(0.7, U.rgba('#ff3a4a', 0.55));
          gr.addColorStop(1, U.rgba('#ffffff', 0.95));
          ctx.fillStyle = gr;
          ctx.fillRect(Math.min(sx - d * 60, sx + d * 20), sy - h / 2, 80, h);
          ctx.restore();
          lit(null, ctx, sx, sy, 50, '#ff3a4a', 0.8);
        },
      });
      p.owner = e;
    }
  }
  function scPageStorm(e, g, t, k) {
    // two spiralling arms of page blades
    if (t % 5 !== 0) return;
    const base = t * 0.055;
    for (let arm = 0; arm < 2; arm++) {
      const a = base + arm * Math.PI;
      if (Math.sin(a) < -0.35) continue; // nothing aimed straight at the ceiling
      pageBlade(e, g, e.cx + Math.cos(a) * 30, e.cy + Math.sin(a) * 20, a, 2.1 / k);
    }
    if (t % 15 === 0) sfx('page_flutter', { vol: 0.5, pitch: 1.2 });
  }

  G.defEnemy('scrivener', {
    name: N('The Scrivener', 'El Escriba'),
    desc: N('Brother Ambrose Vellum, once chronicler of the Belmonts. He mixed his blood into the ink of their Chronicle to make the past forget itself, and became the hand that holds the quill.', 'El hermano Ambrose Vellum, antaño cronista de los Belmont. Mezcló su sangre con la tinta de su Crónica para que el pasado se olvidara de sí mismo, y se convirtió en la mano que sostiene la pluma.'),
    area: 'keep', boss: true, hp: 5000, atk: 66, def: 12, exp: 0, w: 24, h: 64,
    weak: ['holy'], resist: ['dark'], immune: ['poison'], noBlood: true, noDeathFx: true, flying: true, el: 'dark',
    introScene: 'final_pre', music: 'boss_final', wake: wakeSeen(240), previewState: 'idle',
    reward: { scene: 'ending' },
    init(e) {
      e.phase = 1;
      e.flying = true;
      e.setState('dormant');
      e.contact = false;
      e.vis = 1;
      e.home = { x: e.cx, y: e.spawnY + e.h };
      e.last = '';
      e.qa = -1.2;
      e.hurtbox = () => {
        if (e.phase === 2 || e.state === 'transform') return { x: e.cx - 32, y: e.cy - 24, w: 64, h: 44 };
        return { x: e.x, y: e.y, w: e.w, h: e.h };
      };
    },
    onStart(e, g) {
      e.A = scanArena(e, g);
      e.setState('idle');
      e.wait = 40;
      e.contact = true;
      sfx('page_flutter', { vol: 1 });
      G.fx.burst(e.cx, e.cy, '#c890ff', 30, 2.5, { glow: true });
    },
    onHitCheck(e) {
      return awake(e) && e.vis > 0.5;
    },
    onHit(e, hit, g) {
      bossOnHit(e, hit, g);
      if (!e.dying) {
        for (let i = 0; i < 4; i++) G.fx.particle(e.cx, e.cy, U.rnd(-2, 2), U.rnd(-2, 0.5), U.pick(['#0c0614', '#3a2a5a', '#efe4c8']), 30, { grav: 0.08, size: 2 });
        if (e.phase === 1 && e.state === 'idle' && e.player && Math.abs(e.dxp()) < 60) e.annoy = (e.annoy || 0) + 1;
      }
    },
    ai(e, g) {
      const pl = e.player, A = e.A;
      const st = e.state, t = e.stT;
      const p2 = e.phase === 2;
      if (e.hp <= 0 && !e.dying) startDying(e, g);
      const dx = pl.cx - e.cx;
      const face = () => (e.facing = dx < 0 ? -1 : 1);
      const floatTo = (x, y, k) => {
        e.x += (x - e.cx) * k;
        e.y += (y - e.cy) * k;
      };
      const idle = (w) => {
        e.setState('idle');
        e.wait = Math.round(w * (p2 ? 0.85 : 1));
        e.quill = null;
        e.eyeCharge = 0;
      };
      // ================================================================ dying: the long white-out
      if (st === 'dying') {
        e.vis = 1;
        e.x += Math.sin(t * 1.1) * 1.5;
        if (t % 4 === 0) for (let i = 0; i < 3; i++) G.fx.particle(e.cx + U.rnd(-40, 40), e.cy + U.rnd(-30, 30), U.rnd(-2.5, 2.5), U.rnd(-3, 1), U.pick(['#efe4c8', '#c8b896', '#ff3a4a', '#ffffff']), 70, { grav: 0.05, size: 2, drag: 0.97 });
        if (t < 170) dyingBlasts(e, g, { x: e.cx - 60, y: e.cy - 40, w: 120, h: 70 }, 7, ['#ffffff', '#ff3a4a', '#efe4c8', '#c890ff']);
        if (t === 120) sfx('spell_holy', { vol: 1, pitch: 0.6 });
        if (t === 150) {
          // the light swallows everything
          fxEnt(g, {
            free: true, keep: true, x: 0, y: 0, life: 260, z: 60,
            drawFn(q, ctx) {
              const a = q.t < 60 ? q.t / 60 : q.t < 100 ? 1 : Math.max(0, 1 - (q.t - 100) / 160);
              ctx.fillStyle = U.rgba('#ffffff', a);
              ctx.fillRect(0, 0, G.W, G.H);
            },
          });
          sfx('thunder', { vol: 0.8, pitch: 0.7 });
        }
        if (t === 210) {
          sfx('explosion', { vol: 1, pitch: 0.5 });
          gfx.shake(10, 50);
        }
        if (t >= 214) finishDying(e, g, e.cx, A.floor);
        return;
      }
      // ================================================================ phase change → the Living Chronicle
      if (st === 'transform') {
        e.invuln = 4;
        e.contact = false;
        floatTo(U.clamp(pl.cx + (e.cx < pl.cx ? -40 : 40), A.left + 100, A.right - 100), A.top + 62, 0.04);
        if (t === 1) {
          phaseShift(e, g, '#c890ff');
          sfx('ghost_wail', { vol: 1, pitch: 0.6 });
        }
        if (t % 3 === 0) {
          const a = Math.random() * TAU;
          G.fx.particle(e.cx + Math.cos(a) * 70, e.cy + Math.sin(a) * 50, -Math.cos(a) * 2, -Math.sin(a) * 1.5, U.pick(['#efe4c8', '#0c0614', '#ff3a4a']), 34, { size: 2 });
        }
        if (t === 70) {
          sfx('explosion', { vol: 0.9, pitch: 0.6 });
          sfx('page_flutter', { vol: 1, pitch: 0.7 });
          gfx.flash('#ffffff', 16);
          gfx.shake(8, 40);
          G.fx.burst(e.cx, e.cy, '#efe4c8', 60, 3.5);
        }
        e.morph = seg(t, 60, 110);
        if (t >= 150) {
          e.contact = true;
          e.morph = 1;
          idle(30);
        }
        return;
      }
      // ================================================================ idle / decide
      if (st === 'idle') {
        e.vis = Math.min(1, e.vis + 0.1);
        if (!p2) {
          // keep a writing distance, bobbing in the air
          const want = U.clamp(pl.cx + (e.cx < pl.cx ? -130 : 130), A.left + 40, A.right - 40);
          floatTo(want, A.floor - 44 + Math.sin(e.t * 0.05) * 6, 0.03);
          face();
        } else {
          const want = U.clamp(pl.cx + Math.sin(e.t * 0.012) * 70, A.left + 90, A.right - 90);
          floatTo(want, A.top + 62 + Math.sin(e.t * 0.04) * 8, 0.025);
        }
        if (wants2(e)) {
          e.setState('transform');
          return;
        }
        if (--e.wait <= 0) {
          const opts = [];
          const add = (s2, w) => {
            if (s2 !== e.last) for (let i = 0; i < w; i++) opts.push(s2);
          };
          if (!p2) {
            add('glyphs', 4);
            add('rain', 3);
            add('skull', 2);
            add('whip', 2);
            add('teleport', (e.annoy || 0) > 2 ? 6 : 1);
          } else {
            add('erase', 4);
            add('storm', 3);
            add('quill', 4);
            add('glyphs', 1);
            add('rain', 2);
          }
          const s2 = U.pick(opts) || 'glyphs';
          e.last = s2;
          e.setState(s2);
          if (s2 === 'teleport') e.annoy = 0;
        }
        return;
      }
      // ================================================================ phase 1 moves
      if (st === 'glyphs') {
        const word = e.word || (e.word = U.pick(WORDS));
        const n = word.length;
        const W = 12 + n * 9;
        floatTo(e.cx, e.cy, 1);
        face();
        if (t === 2) sfx('magic_cast', { vol: 0.6, pitch: 0.8 });
        // write the letters one by one in an arc above, they launch in order
        for (let i = 0; i < n; i++) {
          if (t === 12 + i * 9) {
            // written left to right; the letter nearest the dhampir flies first
            const gx = e.cx + (-(n - 1) / 2 + i) * 13 * (p2 ? 1.5 : 1);
            const gy = (p2 ? e.cy + 30 : e.cy - 42) - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 10;
            const order = e.facing < 0 ? i : n - 1 - i;
            scGlyphShot(e, g, gx, gy, word[i], W - (12 + i * 9) + 20 + order * 7);
            G.fx.spark(gx, gy, '#c890ff', 4);
            sfx('page_flutter', { vol: 0.25, pitch: 1.6 });
          }
        }
        if (t >= W + 20 + n * 7 + 30) {
          e.word = null;
          idle(p2 ? 30 : 46);
        }
        return;
      }
      if (st === 'rain') {
        if (t === 1) {
          sfx('spell_ink', { vol: 0.8 });
          const span = p2 ? 300 : 230;
          const c0 = U.clamp(pl.cx, A.left + span / 2, A.right - span / 2);
          scInkRain(e, g, c0 - span / 2, c0 + span / 2, p2 ? 14 : 10, p2 ? 0.85 : 1);
        }
        if (t >= 120) idle(40);
        return;
      }
      if (st === 'skull') {
        if (t === 1) {
          const side = e.rnd.chance(0.5) ? -1 : 1;
          scSkullEcho(e, g, U.clamp(pl.cx + side * 120, A.left + 40, A.right - 40));
          sfx('magic_cast', { vol: 0.6, pitch: 0.5 });
        }
        if (t >= 100) idle(30);
        return;
      }
      if (st === 'whip') {
        if (t === 1) {
          const side = pl.cx < e.cx ? 1 : -1;
          const x = U.clamp(pl.cx + side * 70, A.left + 30, A.right - 30);
          scWhipEcho(e, g, x, x < pl.cx ? 1 : -1, e.rnd.chance(0.5));
          sfx('magic_cast', { vol: 0.6, pitch: 0.6 });
        }
        if (t >= 86) idle(36);
        return;
      }
      if (st === 'teleport') {
        if (t < 14) {
          e.vis = 1 - t / 14;
          if (t % 2 === 0) G.fx.particle(e.cx + U.rnd(-10, 10), e.cy + U.rnd(-30, 30), U.rnd(-1, 1), U.rnd(-1.5, 0), '#efe4c8', 30, { size: 2 });
        } else if (t === 14) {
          sfx('page_flutter', { vol: 0.8 });
          const side = pl.cx < A.mid ? 1 : -1;
          const x = U.clamp(pl.cx + side * U.rnd(130, 170), A.left + 40, A.right - 40);
          e.x = x - e.w / 2;
          e.y = A.floor - 44 - e.h / 2;
        } else {
          e.vis = Math.min(1, (t - 14) / 12);
          if (t >= 26) idle(10);
        }
        return;
      }
      // ================================================================ phase 2 moves
      if (st === 'erase') {
        const W = 54;
        if (t === 1) {
          e.low = e.rnd.chance(0.5);
          sfx('magic_cast', { vol: 0.8, pitch: 0.4 });
        }
        e.eyeCharge = Math.min(1, t / W);
        if (t === W) scErasure(e, g, e.low);
        if (t >= W + 70) {
          e.eyeCharge = 0;
          idle(30);
        }
        return;
      }
      if (st === 'storm') {
        const W = 30;
        if (t === 2) sfx('page_flutter', { vol: 1, pitch: 0.8 });
        if (t > W && t < W + 96) scPageStorm(e, g, t - W, 1);
        if (t >= W + 120) idle(36);
        return;
      }
      if (st === 'quill') {
        // the quill arm rises, marks the floor, stabs down; the book sags (open to attack)
        const W = 44;
        if (t === 1) {
          e.qx = pl.cx;
          sfx('swing_light', { vol: 0.5, pitch: 0.6 });
        }
        if (t < W) {
          if (t < W - 12) e.qx = U.approach(e.qx, pl.cx, 2.2); // locks just before the stab
          e.quill = { x: U.lerp(e.cx + 70, e.qx, t / W), y: A.top + 24, a: Math.PI / 2, k: t / W };
        } else if (t < W + 6) {
          const u = (t - W) / 6;
          e.quill = { x: e.qx, y: U.lerp(A.top + 24, A.floor - 44, u * u), a: Math.PI / 2, k: 1 };
          if (t === W + 5) {
            sfx('ink_splash', { vol: 1, pitch: 0.7 });
            gfx.shake(6, 18);
            G.fx.burst(e.qx, A.floor - 4, '#0c0614', 24, 3);
            G.fx.burst(e.qx, A.floor - 4, '#ff3a4a', 10, 2, { glow: true });
          }
        } else if (t < W + 50) {
          e.quill = { x: e.qx, y: A.floor - 44, a: Math.PI / 2, k: 1 };
          floatTo(e.cx, A.top + 96, 0.06); // the book sags towards the floor
        } else {
          e.quill = null;
          floatTo(e.cx, A.top + 62, 0.05);
        }
        if (e.quill && t >= W && t < W + 50) {
          // the nib (and its ink splash) hurts
          pHit(e, e.qx - 8, A.floor - 44, 16, 44, e.atk + 6, 'dark', { status: 'curse', chance: 0.2 });
        }
        if (t >= W + 70) {
          e.quill = null;
          idle(26);
        }
        return;
      }
    },
    draw(e, ctx, sx, sy) {
      const pre = e.preview;
      const cx = sx, cy = sy - e.h / 2;
      if (pre) {
        ctx.save();
        const sc0 = Math.min(1, 60 / e.h, 90 / e.w);
        ctx.scale(0.85 / sc0, 0.85 / sc0);
        put(null, ctx, scribeImg('idle', 0), 0, 0, 32, 84);
        ctx.restore();
        return;
      }
      const vis = e.vis;
      if (vis <= 0.02) return;
      const morph = e.phase === 2 ? 1 : e.state === 'transform' ? e.morph || 0 : 0;
      if (morph < 1) {
        // the hooded scribe
        let pose = 'idle', f = Math.floor(e.t / 10) % 4;
        if (e.state === 'glyphs' || e.state === 'dormant') pose = 'write';
        else if (e.state === 'rain' || e.state === 'skull' || e.state === 'whip' || e.state === 'transform') pose = 'raise';
        if (e.state === 'dormant') f = Math.floor(e.t / 14) % 4;
        ctx.globalAlpha = vis * (1 - morph);
        const bob = Math.round(Math.sin(e.t * 0.06) * 2);
        put(e, ctx, scribeImg(pose, f), sx, sy + bob + 6, 32, 84, e.facing < 0);
        ctx.globalAlpha = 1;
        // the Chronicle floating at his side
        const bx = sx - e.facing * 18, by = cy - 2 + Math.sin(e.t * 0.08) * 3;
        ctx.fillStyle = SC.cover;
        ctx.fillRect(bx - 8, by - 1, 16, 7);
        ctx.fillStyle = SC.page;
        ctx.fillRect(bx - 7, by - 3, 6, 5);
        ctx.fillRect(bx + 1, by - 3, 6, 5);
        glow(ctx, bx, by, 10, '#ff3a4a', 0.4);
        if (e.t % 6 === 0 && !e.dying) G.fx.particle(e.cx + U.rnd(-8, 8), e.fy - 2, 0, 0.6, '#0c0614', 30, { size: 2 });
        lit(e, ctx, sx, cy - 20, 60, '#a070ff', 0.8);
      }
      if (morph > 0) {
        // the Living Chronicle
        const f = Math.floor(e.t / 6) % 4;
        const eye = e.eyeCharge > 0.5 ? 2 : e.state === 'storm' ? 1 : 0;
        ctx.save();
        ctx.translate(cx, cy);
        const sc = 0.3 + 0.7 * morph;
        ctx.scale(sc, sc);
        ctx.globalAlpha = Math.min(1, morph * 1.5);
        put(e, ctx, chronicleImg(f, eye), 0, 0, 84, 58);
        ctx.restore();
        ctx.globalAlpha = 1;
        if (e.eyeCharge > 0) {
          glow(ctx, cx, cy - 4, 10 + e.eyeCharge * 26, '#ff3a4a', 0.4 + 0.5 * e.eyeCharge);
          // telegraph: the height the erasure will sweep
          const A = e.A;
          const y = (e.low ? A.floor - 9 : A.floor - 35) - G.game.camy;
          warnLine(ctx, 0, y, G.W, y, e.t, '#ff3a4a', 2);
          if (e.t % 10 < 5) warnRect(ctx, cx - 11, cy + 20, 22, y - cy - 20, e.t, '#ff3a4a');
        }
        // the quill arm
        if (e.quill) {
          const q = e.quill;
          const qx = q.x - G.game.camx, qy = q.y - G.game.camy;
          // ink arm from the book's corner
          const ax = cx + 60, ay = cy - 30;
          ctx.strokeStyle = '#0c0614';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.quadraticCurveTo((ax + qx) / 2 + 20, Math.min(ay, qy) - 30, qx, qy - 40);
          ctx.stroke();
          ctx.strokeStyle = '#3a2a5a';
          ctx.lineWidth = 2;
          ctx.stroke();
          put(e, ctx, quillImg(q.a), qx, qy - 8);
          if (e.stT < 44) {
            // target: a line from the nib to a mark on the floor
            const fy = e.A.floor - G.game.camy, mx = Math.round(e.qx - G.game.camx);
            warnLine(ctx, mx, qy + 36, mx, fy - 4, e.t, '#ff3a4a', 1);
            warnRect(ctx, mx - 16, fy - 6, 32, 6, e.t, '#ff3a4a', true);
            glow(ctx, qx, qy + 36, 8, '#ff3a4a', 0.7);
          }
        }
        lit(e, ctx, cx, cy, 120, '#ff3a4a', 0.7 * morph);
        lit(e, ctx, cx, cy - 4, 40, '#ffffff', 0.5 * morph);
      }
    },
  });

})();
