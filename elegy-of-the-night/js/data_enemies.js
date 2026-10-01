/* Elegy of the Night — data_enemies.js
 * Regular enemies (AI + procedural pixel art). See enemy_base.js for the API.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, P = G.phys, gfx = G.gfx;
  const N = (en, es) => ({ en, es });
  const OUT = '#07050b';

  function spr(key, w, h, pal, fn) {
    return gfx.sprite(key, w, h, fn, { palette: pal, outline: OUT, threshold: 100 });
  }

  // ------------------------------------------------------------------ GHOUL
  const GHOUL_PAL = ['#8a9a7a', '#5e6e52', '#3a4434', '#6a4a32', '#4a3222', '#2a1c14', '#d8d0a0', '#a02020'];
  function ghoulImg(f, rise) {
    return spr('ghoul' + f, 32, 40, GHOUL_PAL, (c) => {
      c.translate(16, 39);
      const ph = (f / 4) * Math.PI * 2;
      const s = Math.sin(ph);
      // legs
      gfx.limb(c, -2, -14, -3 + s * 3, 0, 3, '#4a3222');
      gfx.limb(c, 2, -14, 3 - s * 3, 0, 3, '#2a1c14');
      // tattered body, hunched forward
      gfx.poly(c, [-5, -14, 6, -14, 8, -27, -3, -30], '#6a4a32');
      gfx.poly(c, [-5, -14, -1, -14, -2, -10, -5, -12], '#4a3222');
      // arms reaching forward
      gfx.limb(c, 5, -26, 13, -22 + s, 2.4, '#5e6e52');
      gfx.limb(c, 3, -25, 12, -19 - s, 2.4, '#8a9a7a');
      // head
      gfx.ellipse(c, 6, -31, 4.5, 4, 0.3, '#8a9a7a');
      c.fillStyle = '#3a4434';
      c.fillRect(3, -35, 6, 2);
      c.fillStyle = '#d8d0a0';
      c.fillRect(8, -32, 1.5, 1.5);
      c.fillStyle = '#a02020';
      c.fillRect(7, -29, 3, 1);
    });
  }
  G.defEnemy('ghoul', {
    name: N('Ghoul', 'Necrófago'),
    desc: N('A corpse that claws its way out of the castle soil whenever living blood walks above it.', 'Un cadáver que se abre paso desde la tierra del castillo cuando sangre viva camina sobre él.'),
    area: 'entrance', hp: 14, atk: 8, def: 0, exp: 3, w: 12, h: 34, gold: [1, 10],
    weak: ['fire', 'holy'], drops: [{ id: 'bread', p: 0.06 }],
    init(e) {
      e.rise = 0;
      e.contact = false;
      e.setState('buried');
    },
    ai(e, g) {
      if (e.state === 'buried') {
        if (Math.abs(e.dxp()) < 150 && Math.abs(e.dyp()) < 60) {
          e.setState('rising');
          G.audio.sfx('slime', { vol: 0.4, pitch: 0.7 });
        }
        return;
      }
      if (e.state === 'rising') {
        e.rise = Math.min(1, e.stT / 40);
        if (e.stT % 8 === 0) G.fx.dust(e.cx, e.fy, 2);
        if (e.rise >= 1) {
          e.contact = true;
          e.face();
          e.setState('walk');
        }
        e.move();
        return;
      }
      e.vx = e.facing * 0.42;
      if (e.stT > 120 && Math.random() < 0.01) e.face();
      const bl = P.blockedAhead(g.room, e, e.facing);
      if (bl.wall || bl.ledge) e.facing *= -1;
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const f = e.state === 'walk' ? Math.floor(e.t / 9) % 4 : 0;
      const img = ghoulImg(f);
      if (e.state === 'buried') return;
      if (e.state === 'rising') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(sx - 24, sy - 60, 48, 60);
        ctx.clip();
        e.blit(ctx, img, sx, sy + (1 - e.rise) * 38, 16, 39, e.facing < 0);
        ctx.restore();
        return;
      }
      e.blit(ctx, img, sx, sy, 16, 39, e.facing < 0);
    },
  });

  // ------------------------------------------------------------------ NIGHT BAT
  const BAT_PAL = ['#2a1e30', '#4a3a58', '#ff4050', '#8a2a3a', '#120c16'];
  function batImg(f, hang) {
    return spr('nbat' + f + (hang ? 'h' : ''), 28, 20, BAT_PAL, (c) => {
      c.translate(14, 10);
      if (hang) {
        gfx.ellipse(c, 0, 1, 4, 6, 0, '#2a1e30');
        gfx.poly(c, [-4, -3, -6, 5, -2, 6], '#4a3a58');
        gfx.poly(c, [4, -3, 6, 5, 2, 6], '#4a3a58');
        c.fillStyle = '#ff4050';
        c.fillRect(-2, 3, 1, 1);
        c.fillRect(1, 3, 1, 1);
        return;
      }
      const wy = [-7, -2, 3, -2][f];
      gfx.poly(c, [-2, -1, -12, wy, -9, wy + 3, -6, wy + 1, -3, wy + 4, -1, 3], '#2a1e30');
      gfx.poly(c, [2, -1, 12, wy, 9, wy + 3, 6, wy + 1, 3, wy + 4, 1, 3], '#2a1e30');
      gfx.ellipse(c, 0, 1, 3, 3.8, 0, '#4a3a58');
      c.fillStyle = '#4a3a58';
      c.fillRect(-3, -4, 1.4, 2);
      c.fillRect(1.6, -4, 1.4, 2);
      c.fillStyle = '#ff4050';
      c.fillRect(-2, 0, 1.2, 1.2);
      c.fillRect(1, 0, 1.2, 1.2);
    });
  }
  G.defEnemy('night_bat', {
    name: N('Night Bat', 'Murciélago nocturno'),
    desc: N('Roosts in the rafters and dives at anything warm.', 'Anida en las vigas y se lanza contra cualquier cosa caliente.'),
    area: 'entrance', hp: 6, atk: 6, def: 0, exp: 2, w: 12, h: 10, flying: true, gold: [1, 5],
    drops: [], noBlood: true, stunTime: 6,
    init(e) {
      e.setState('hang');
      e.baseY = e.y;
    },
    ai(e, g) {
      if (e.state === 'hang') {
        if (Math.abs(e.dxp()) < 110 && e.dyp() > -20 && e.dyp() < 140) {
          e.setState('swoop');
          e.face();
          G.audio.sfx('bat_screech', { vol: 0.4 });
        }
        return;
      }
      // swoop toward the player with a sine wobble, then glide away
      const tx = e.player.cx, ty = e.player.cy - 6;
      const a = Math.atan2(ty - e.cy, tx - e.cx);
      const sp = e.state === 'swoop' ? 1.9 : 1.3;
      e.vx = U.lerp(e.vx, Math.cos(a) * sp, 0.06);
      e.vy = U.lerp(e.vy, Math.sin(a) * sp + Math.sin(e.t * 0.2) * 0.8, 0.08);
      e.facing = e.vx < 0 ? -1 : 1;
      if (e.state === 'swoop' && e.stT > 150) e.setState('glide');
      if (e.state === 'glide' && e.stT > 60) e.setState('swoop');
      e.x += e.vx;
      e.y += e.vy;
    },
    draw(e, ctx, sx, sy) {
      const img = e.state === 'hang' ? batImg(0, true) : batImg(Math.floor(e.t / 4) % 4);
      e.blit(ctx, img, sx, sy, 14, 15, e.facing < 0);
    },
  });

  // ------------------------------------------------------------------ BONE SCRIBE
  const BONE_PAL = ['#e8e0c8', '#b8ae94', '#7a7262', '#3a3428', '#5a2a6a', '#2a1a10', '#c84040'];
  function scribeImg(f, throwing) {
    return spr('bscribe' + f + (throwing ? 't' : ''), 32, 44, BONE_PAL, (c) => {
      c.translate(16, 43);
      const s = Math.sin((f / 4) * Math.PI * 2);
      gfx.limb(c, -2, -16, -3 + s * 3, 0, 2, '#b8ae94');
      gfx.limb(c, 2, -16, 3 - s * 3, 0, 2, '#e8e0c8');
      // ribcage and robe scraps
      gfx.poly(c, [-5, -16, 5, -16, 6, -30, -5, -30], '#5a2a6a');
      for (let i = 0; i < 4; i++) gfx.limb(c, -4, -27 + i * 3, 4, -27 + i * 3, 1, '#e8e0c8');
      gfx.limb(c, 0, -30, 0, -16, 1.4, '#b8ae94');
      // skull
      gfx.ellipse(c, 1, -34, 4.4, 4.6, 0, '#e8e0c8');
      c.fillStyle = '#3a3428';
      c.fillRect(2, -35, 2, 2);
      c.fillRect(-1, -35, 1.5, 2);
      c.fillRect(1, -31, 3, 1);
      // throwing arm
      if (throwing) gfx.limb(c, 4, -28, 9, -38, 1.8, '#e8e0c8');
      else gfx.limb(c, 4, -28, 8, -20, 1.8, '#e8e0c8');
      gfx.limb(c, -4, -28, -7, -19, 1.8, '#b8ae94');
      // quill tucked behind the skull
      gfx.limb(c, -3, -38, -8, -44, 1, '#f0e8d0');
    });
  }
  G.defEnemy('bone_scribe', {
    name: N('Bone Scribe', 'Escriba de hueso'),
    desc: N('Skeletal copyists who once served the Scrivener. They still hurl the bones of their quills.', 'Copistas esqueléticos que sirvieron al Escriba. Aún arrojan los huesos de sus plumas.'),
    area: 'entrance', hp: 18, atk: 10, def: 1, exp: 6, w: 12, h: 38, gold: [5, 25], bony: true,
    weak: ['hit', 'holy'], resist: ['cut'], drops: [{ id: 'potion', p: 0.05 }, { id: 'stiletto', p: 0.02 }],
    init(e) {
      e.setState('walk');
      e.cool = 60 + e.rnd.int(0, 60);
    },
    ai(e, g) {
      e.cool--;
      if (e.state === 'walk') {
        // keep a comfortable distance
        const d = e.dxp();
        const want = Math.abs(d) < 70 ? -U.sign(d) : Math.abs(d) > 130 ? U.sign(d) : 0;
        e.vx = want * 0.6;
        if (want) e.facing = U.sign(d) || e.facing;
        else e.face();
        const bl = P.blockedAhead(g.room, e, U.sign(e.vx) || e.facing);
        if (bl.wall || bl.ledge) e.vx = 0;
        if (e.cool <= 0 && Math.abs(d) < 200 && Math.abs(e.dyp()) < 90) {
          e.setState('throw');
          e.face();
        }
      } else if (e.state === 'throw') {
        e.vx = 0;
        if (e.stT === 14) {
          const d = e.dxp();
          e.shoot({ x: e.cx + e.facing * 6, y: e.y + 4, vx: U.clamp(d / 50, -3, 3), vy: -4.2, grav: 0.16, w: 8, h: 8, kind: 'bone', dmg: e.atk, wall: true, el: 'hit' });
          G.audio.sfx('bone_rattle', { vol: 0.5 });
        }
        if (e.stT > 30) {
          e.setState('walk');
          e.cool = 90 + e.rnd.int(0, 60);
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const f = Math.abs(e.vx) > 0.1 ? Math.floor(e.t / 8) % 4 : 0;
      e.blit(ctx, scribeImg(f, e.state === 'throw' && e.stT > 6 && e.stT < 20), sx, sy, 16, 43, e.facing < 0);
    },
  });

  // ------------------------------------------------------------------ WARG
  const WARG_PAL = ['#4a4250', '#2e2834', '#7a7080', '#c8c0b0', '#ff5030', '#1a141e'];
  function wargImg(f) {
    return spr('warg' + f, 44, 28, WARG_PAL, (c) => {
      c.translate(22, 27);
      const run = f < 4;
      const ph = (f / 4) * Math.PI * 2;
      const b = run ? Math.sin(ph) : 0;
      [[-8, ph], [-5, ph + 1], [7, ph + Math.PI], [10, ph + Math.PI + 1]].forEach(([x, p], i) => gfx.limb(c, x, -8 + b, x + (run ? Math.sin(p) * 5 : 0), 0, 2.8, i % 2 ? '#4a4250' : '#2e2834'));
      gfx.ellipse(c, 0, -11 + b, 12, 5.5, 0, '#4a4250');
      gfx.ellipse(c, 2, -13 + b, 8, 3.5, 0, '#7a7080');
      gfx.limb(c, -11, -12 + b, -18, -16 + b, 3, '#2e2834');
      gfx.poly(c, [10, -16 + b, 17, -15 + b, 22, -11 + b, 20, -8 + b, 12, -9 + b], '#4a4250');
      gfx.poly(c, [11, -16 + b, 13, -21 + b, 15, -16 + b], '#2e2834');
      c.fillStyle = '#ff5030';
      c.fillRect(16, -14 + b, 1.5, 1.2);
      c.fillStyle = '#c8c0b0';
      c.fillRect(19, -9 + b, 2, 1);
    });
  }
  G.defEnemy('warg', {
    name: N('Warg', 'Huargo'),
    desc: N('A wolf twisted by the eclipse. It charges in straight lines and is slow to turn.', 'Un lobo retorcido por el eclipse. Embiste en línea recta y le cuesta girar.'),
    area: 'entrance', hp: 22, atk: 12, def: 1, exp: 8, w: 26, h: 16, gold: [5, 30],
    weak: ['fire'], drops: [{ id: 'roast_fowl', p: 0.04 }],
    init(e) {
      e.setState('idle');
    },
    ai(e, g) {
      if (e.state === 'idle') {
        e.vx *= 0.8;
        if (e.seesPlayer(170) && Math.abs(e.dyp()) < 40 && e.stT > 30) {
          e.face();
          e.setState('growl');
          G.audio.sfx('wolf_howl', { vol: 0.25, pitch: 1.4 });
        }
      } else if (e.state === 'growl') {
        e.vx = 0;
        if (e.stT > 24) e.setState('charge');
      } else if (e.state === 'charge') {
        e.vx = U.approach(e.vx, e.facing * 3.6, 0.3);
        const bl = P.blockedAhead(g.room, e, e.facing);
        if (bl.wall || bl.ledge || (e.stT > 30 && e.dxp() * e.facing < -40)) {
          e.setState('skid');
        }
        if (e.stT % 6 === 0) G.fx.dust(e.cx - e.facing * 10, e.fy, 1);
      } else if (e.state === 'skid') {
        e.vx *= 0.88;
        if (e.stT > 26) {
          e.face();
          e.setState('idle');
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const f = e.state === 'charge' ? Math.floor(e.t / 4) % 4 : 4;
      e.blit(ctx, wargImg(f), sx, sy + 1, 22, 27, e.facing < 0);
    },
  });
})();

/* ==========================================================================================
 * Castle enemies (gallery, library, caverns, clock tower, chapel, catacombs, keep).
 * Each one: a small state machine with telegraphed attacks + cached procedural sprites.
 * ========================================================================================== */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, P = G.phys, gfx = G.gfx;
  const N = (en, es) => ({ en, es });
  const OUT = '#07050b';
  const TS = 16;
  const MY = []; // ids defined here (debug overlay)

  function spr(key, w, h, pal, fn) {
    return gfx.sprite(key, w, h, fn, { palette: pal, outline: OUT, threshold: 100 });
  }
  function sfx(name, vol, pitch) {
    G.audio.sfx(name, { vol: vol == null ? 0.6 : vol, pitch: pitch || 1 });
  }
  function def(id, d) {
    MY.push(id);
    G.defEnemy(id, d);
  }
  // Damage the player if a world-space rect overlaps his hurtbox (attack hitboxes).
  function strike(e, x, y, w, h, dmg, el, o) {
    if (G.DEBUG_HITBOX) (e._dbg = e._dbg || []).push({ x, y, w, h, t: e.t });
    const pb = e.player.hurtbox();
    if (x < pb.x + pb.w && x + w > pb.x && y < pb.y + pb.h && y + h > pb.y) return e.hurtPlayer(dmg == null ? e.atk : dmg, el || e.def.el, o);
    return null;
  }
  // can a grounded enemy take a step in that direction (no wall, no ledge)?
  function canStep(e, g, dir) {
    const b = P.blockedAhead(g.room, e, dir);
    return !b.wall && !b.ledge;
  }
  // is there something to stand on below (x, y) within `drop` px?
  function floorBelow(room, x, y, drop) {
    for (let d = 0; d <= drop; d += 8) if (P.floorAt(room, x, y + d)) return true;
    return false;
  }
  // a grounded hop of (vx, vy) would land on a floor (not into a pit)?
  function safeHop(e, g, vx, vy) {
    const air = (2 * -vy) / 0.3;
    const lx = e.cx + vx * air;
    if (P.solidAt(g.room, e.cx + U.sign(vx) * (e.w / 2 + 4), e.fy - 8)) return false;
    return floorBelow(g.room, lx, e.fy + 2, 40);
  }
  function near(e, rx, ry) {
    return Math.abs(e.dxp()) < rx && Math.abs(e.dyp()) < ry;
  }
  // additive glow blob in screen space (crisp squares, no blur)
  function glow(ctx, x, y, r, col, a) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a == null ? 0.5 : a;
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x - r), Math.round(y - r * 0.6), Math.round(r * 2), Math.round(r * 1.2));
    ctx.fillRect(Math.round(x - r * 0.6), Math.round(y - r), Math.round(r * 1.2), Math.round(r * 2));
    ctx.restore();
  }
  // generic two-segment limb: from (x,y) with angles measured from "straight down" (+ = forward)
  function seg(x, y, a, L) {
    return [x + Math.sin(a) * L, y + Math.cos(a) * L];
  }
  // sprite helper: draw a projectile sprite rotated by quantised angle
  const ANG = 16;
  function angIdx(a) {
    return ((Math.round((a / (Math.PI * 2)) * ANG) % ANG) + ANG) % ANG;
  }

  // ================================================================== MARIONETTE (gallery)
  const MC = {
    red: '#c0283a', redS: '#841426', redH: '#ec6470', redD: '#4a0a18', blk: '#1c1220', blkH: '#3e2c48',
    por: '#f4ece4', porS: '#d0c2c0', porD: '#8e7e8a', gold: '#e8b848', goldD: '#8a6420',
    wood: '#a06c3c', woodD: '#5a3a1a', steel: '#eef2fa', steelS: '#a4aec4', steelD: '#5a6278', lip: '#e02040',
  };
  const MAR_PAL = Object.values(MC);
  // hy: hip height, ln: torso lean, hd: head tilt, aF/aB: arm [shoulder, elbow], lF/lB: leg [hip, knee]
  const MAR_POSE = {
    idle0: { hy: -17, ln: 0.06, hd: 0.4, aF: [0.22, 0.12], aB: [-0.14, 0.1], lF: [0.12, -0.18], lB: [-0.1, -0.08], hat: 0 },
    idle1: { hy: -17, ln: -0.02, hd: 0.28, aF: [0.1, 0.24], aB: [-0.26, 0.06], lF: [0.04, -0.08], lB: [-0.06, -0.2], hat: 1 },
    crouch: { hy: -12, ln: 0.28, hd: 0.25, aF: [-0.5, 0.6], aB: [-0.8, 0.4], lF: [1.0, -1.7], lB: [0.35, -1.35], hat: 1 },
    air: { hy: -19, ln: -0.1, hd: -0.3, aF: [2.3, 0.5], aB: [-2.2, -0.4], lF: [1.0, -0.15], lB: [-0.85, -0.55], hat: 2 },
    windup: { hy: -14, ln: -0.2, hd: -0.15, aF: [2.75, 0.55], aB: [2.95, 0.35], lF: [0.65, -1.05], lB: [-0.45, -0.7], hat: 2 },
    dizzy: { hy: -15, ln: 0.5, hd: 0.75, aF: [0.05, 0.1], aB: [-0.1, 0.25], lF: [0.55, -0.95], lB: [-0.2, -0.3], hat: 0 },
  };
  function marPts(p) {
    const sl = Math.sin(p.ln), cl = Math.cos(p.ln);
    const hy = p.hy;
    const sh = [sl * 11, hy - cl * 11];
    const nk = [sl * 12.5, hy - cl * 12.5];
    const ha = p.ln + p.hd;
    const hd = [nk[0] + Math.sin(ha) * 4.6, nk[1] - Math.cos(ha) * 4.6];
    const arm = (a, off) => {
      const s = [sh[0] + off, sh[1] + 0.5];
      const el = seg(s[0], s[1], a[0], 6);
      const hn = seg(el[0], el[1], a[0] + a[1], 5.5);
      const tip = seg(hn[0], hn[1], a[0] + a[1], 10);
      return { s, el, hn, tip, ang: a[0] + a[1] };
    };
    const leg = (l, off) => {
      const h = [off, hy];
      const kn = seg(h[0], h[1], l[0], 8);
      const ft = seg(kn[0], kn[1], l[0] + l[1], 8);
      return { h, kn, ft };
    };
    return { sh, nk, hd, ha, aF: arm(p.aF, 1.2), aB: arm(p.aB, -1.6), lF: leg(p.lF, 1.3), lB: leg(p.lB, -1.3) };
  }
  function marBlade(c, A) {
    const a = A.ang, px = -Math.cos(a), py = Math.sin(a);
    const [hx, hy] = A.hn, [tx, ty] = A.tip;
    gfx.poly(c, [hx + px * 1.7, hy + py * 1.7, tx, ty, hx - px * 1.7, hy - py * 1.7], MC.steelS);
    gfx.poly(c, [hx + px * 0.3, hy + py * 0.3, tx, ty, hx + px * 1.7, hy + py * 1.7], MC.steel);
    gfx.limb(c, hx + px * 2.4, hy + py * 2.4, hx - px * 2.4, hy - py * 2.4, 1.4, MC.gold);
  }
  function marArm(c, A, col) {
    gfx.limb(c, A.s[0], A.s[1], A.el[0], A.el[1], 2.7, col);
    gfx.limb(c, A.el[0], A.el[1], A.hn[0], A.hn[1], 2.3, col);
    gfx.circle(c, A.el[0], A.el[1], 1.35, MC.wood);
    marBlade(c, A);
  }
  function marLeg(c, L, col, hi) {
    gfx.limb(c, L.h[0], L.h[1], L.kn[0], L.kn[1], 3, col);
    gfx.limb(c, L.kn[0], L.kn[1], L.ft[0], L.ft[1], 2.5, col);
    if (hi) gfx.limb(c, L.kn[0] + 0.8, L.kn[1] + 1, L.ft[0] + 0.6, L.ft[1] - 2, 0.9, hi);
    gfx.circle(c, L.kn[0], L.kn[1], 1.5, MC.wood);
    const [fx, fy] = L.ft;
    gfx.poly(c, [fx - 1.6, fy - 1.6, fx + 3.5, fy - 0.8, fx + 5.4, fy - 3.4, fx + 5, fy + 0.9, fx - 1.6, fy + 0.9], MC.blk);
    c.fillStyle = MC.gold;
    c.fillRect(Math.round(fx + 4.5), Math.round(fy - 4.5), 2, 2);
  }
  function marHat(c, sway) {
    const s = [0, 1, -1][sway || 0];
    // back point (crimson) drooping behind, front point (black) curling forward
    gfx.poly(c, [-1.5, -4.2, -4.5, -8 + s, -8, -7.6 + s, -9.6, -3.6 + s, -7.4, -5.2 + s, -5, -5, -2.5, -2.4], MC.red);
    gfx.poly(c, [-3, -5.2, -5.4, -7.4 + s, -7.8, -7 + s, -9, -4.6 + s, -7.2, -5.6 + s, -5, -5.6], MC.redS);
    gfx.poly(c, [0.5, -4.6, 3.2, -8.6 - s, 6.8, -8.8 - s, 8.8, -5.4 + s, 6.6, -6.6 - s, 3.4, -6.2, 2.6, -2.8], MC.blk);
    gfx.poly(c, [2.6, -6.4, 4, -8 - s, 6.6, -8.2 - s, 6, -7 - s, 3.8, -6.4], MC.blkH);
    // cap and band
    gfx.poly(c, [-4, -2.4, 4, -2.9, 3.2, -5.3, -2.8, -5.5], MC.red);
    gfx.limb(c, -3.9, -2.3, 4, -2.8, 1.5, MC.gold);
    gfx.circle(c, 9, -4.8 + s, 1.3, MC.gold);
    gfx.circle(c, -9.8, -3 + s, 1.3, MC.gold);
  }
  function marHead(c, P_, sway) {
    c.save();
    c.translate(P_.hd[0], P_.hd[1]);
    c.rotate(P_.ha);
    gfx.ellipse(c, 0, 0.6, 4.2, 5.2, 0, MC.porS);
    gfx.ellipse(c, 1, 0.4, 3.4, 4.7, 0, MC.por);
    c.fillStyle = MC.blk;
    c.fillRect(1.4, -0.6, 2, 2); // painted eye
    c.fillRect(2, 1.4, 1, 2); // painted tear
    c.fillStyle = MC.lip;
    c.fillRect(2.6, 3.8, 2, 1);
    c.fillRect(3.8, 1.2, 1, 1);
    gfx.limb(c, -2.8, -1.6, -1.2, 1.2, 0.9, MC.porD); // crack
    c.translate(0, -1.6);
    marHat(c, sway);
    c.restore();
  }
  function marTorso(c, p) {
    c.save();
    c.translate(0, p.hy);
    c.rotate(p.ln);
    c.beginPath();
    c.moveTo(-4.8, 1);
    c.lineTo(4.8, 1);
    c.lineTo(5.6, -11);
    c.lineTo(-5.2, -11);
    c.closePath();
    c.save();
    c.clip();
    c.fillStyle = MC.red;
    c.fillRect(-8, -14, 16, 18);
    // harlequin: a central column of big diamonds, half diamonds on the sides
    [[0.4, -2.4], [0.4, -9.6], [-5.4, -6], [6.2, -6]].forEach(([x, y]) => gfx.poly(c, [x, y - 3.6, x + 3, y, x, y + 3.6, x - 3, y], MC.blk));
    c.fillStyle = MC.redS;
    c.fillRect(-8, -14, 2.4, 18);
    c.fillStyle = MC.redH;
    c.fillRect(4.4, -10, 1, 4);
    c.restore();
    // gold belt and hem flaps with bells
    gfx.limb(c, -4.8, 0.2, 4.8, 0.2, 1.4, MC.goldD);
    [[-4.4, MC.blk], [-1.4, MC.red], [1.6, MC.blk], [4.5, MC.red]].forEach(([fx, col]) => {
      gfx.poly(c, [fx - 1.7, 0.8, fx + 1.7, 0.8, fx, 4.8], col);
      gfx.circle(c, fx, 5, 0.95, MC.gold);
    });
    // ruff collar (greyer than the porcelain face so the two read apart)
    gfx.ellipse(c, 0.3, -11.2, 5.8, 2.1, 0, MC.porD);
    gfx.ellipse(c, 0.5, -11.7, 5, 1.5, 0, MC.porS);
    c.fillStyle = MC.por;
    for (let i = -4; i <= 4; i += 2) c.fillRect(i + 0.5, -12.4, 1, 1);
    c.restore();
  }
  function marionetteImg(name) {
    return spr('mario_' + name, 44, 54, MAR_PAL, (c) => {
      c.translate(20, 52);
      const p = MAR_POSE[name];
      const P_ = marPts(p);
      marArm(c, P_.aB, MC.redS);
      marLeg(c, P_.lB, MC.blk, MC.blkH);
      marTorso(c, p);
      marLeg(c, P_.lF, MC.red, MC.redH);
      marHead(c, P_, p.hat);
      marArm(c, P_.aF, MC.red);
    });
  }
  // spinning: front view with blade-arms stretched out, k = quarter of the turn
  function marSpinImg(k) {
    return spr('mario_spin' + k, 52, 54, MAR_PAL, (c) => {
      c.translate(26, 52);
      const span = [1, 0.62, 0.22, 0.62][k];
      const back = k === 2;
      // legs
      gfx.limb(c, -2, -17, -3, -2, 3, back ? MC.red : MC.blk);
      gfx.limb(c, 2, -17, 3, -2, 3, back ? MC.blk : MC.red);
      gfx.circle(c, -2.5, -9, 1.5, MC.wood);
      gfx.circle(c, 2.5, -9, 1.5, MC.wood);
      gfx.poly(c, [-3, -2.5, -8, -3.5, -7, 0.8, -2, 0.8], MC.blk);
      gfx.poly(c, [3, -2.5, 8, -3.5, 7, 0.8, 2, 0.8], MC.blk);
      // arms out, slightly lifted, blades beyond
      const L = 7 + 7 * span, B = 4 + 9 * span;
      [-1, 1].forEach((d) => {
        const sx = d * 5, sy = -27, hx = sx + d * L, hy = sy + 1;
        gfx.limb(c, sx, sy, hx, hy, 2.6, d > 0 ? MC.red : MC.redS);
        gfx.circle(c, sx + d * L * 0.5, sy + 0.5, 1.3, MC.wood);
        gfx.poly(c, [hx, hy - 1.7, hx + d * B, hy + 0.3, hx, hy + 1.7], MC.steelS);
        gfx.poly(c, [hx, hy - 1.7, hx + d * B, hy + 0.3, hx, hy - 0.2], MC.steel);
        gfx.limb(c, hx, hy - 2.4, hx, hy + 2.4, 1.4, MC.gold);
      });
      // torso (front)
      c.beginPath();
      c.moveTo(-5.6, -16);
      c.lineTo(5.6, -16);
      c.lineTo(6.4, -28);
      c.lineTo(-6.4, -28);
      c.closePath();
      c.save();
      c.clip();
      c.fillStyle = MC.red;
      c.fillRect(-8, -30, 16, 16);
      for (let j = 1; j < 6; j += 2)
        for (let i = -2; i <= 2; i++) {
          const x = i * 5 + (k % 2 ? 0 : 2.5), y = -16 - j * 3;
          gfx.poly(c, [x, y - 3, x + 2.5, y, x, y + 3, x - 2.5, y], MC.blk);
        }
      c.restore();
      [-4.5, -1.5, 1.5, 4.5].forEach((fx, i) => {
        gfx.poly(c, [fx - 1.6, -16, fx + 1.6, -16, fx, -11.8], i % 2 ? MC.red : MC.blk);
        gfx.circle(c, fx, -11.6, 0.95, MC.gold);
      });
      gfx.ellipse(c, 0, -28.4, 6, 2, 0, MC.porS);
      gfx.ellipse(c, 0, -28.8, 5.2, 1.4, 0, MC.por);
      // head (front or back)
      c.save();
      c.translate(0, -34);
      gfx.ellipse(c, 0, 0, 4, 4.7, 0, MC.porS);
      gfx.ellipse(c, 0, -0.4, 3.3, 4.1, 0, MC.por);
      if (!back) {
        c.fillStyle = MC.blk;
        c.fillRect(-2.6, -1, 2, 1.2);
        c.fillRect(0.8, -1, 2, 1.2);
        c.fillRect(1.3, 0.2, 1, 1.8);
        c.fillStyle = MC.lip;
        c.fillRect(-1, 2.6, 2, 1);
      } else gfx.limb(c, -1.5, -3, 0.5, 0, 0.8, MC.porD);
      // hat seen from the front: two points out to the sides
      const s = k % 2;
      gfx.poly(c, [-2, -4, -6, -8 - s, -10, -6, -10.5, -2.5, -7.5, -5, -3, -2.5], back ? MC.blk : MC.red);
      gfx.poly(c, [2, -4, 6, -8 + s, 10, -6, 10.5, -2.5, 7.5, -5, 3, -2.5], back ? MC.red : MC.blk);
      gfx.poly(c, [-4, -2.4, 4, -2.4, 3.2, -5.4, -3.2, -5.4], MC.red);
      gfx.limb(c, -4, -2.3, 4, -2.3, 1.6, MC.gold);
      gfx.circle(c, -10.8, -2.2, 1.3, MC.gold);
      gfx.circle(c, 10.8, -2.2, 1.3, MC.gold);
      c.restore();
    });
  }
  // the puppet strings rise into the dark and fade out
  function marStrings(e, ctx, sx, sy, pts, flip) {
    if (e.preview) return;
    const f = flip ? -1 : 1;
    const sway = Math.sin(e.t * 0.05) * 6;
    ctx.save();
    ctx.fillStyle = '#e6dcd2';
    for (const [px, py] of pts) {
      const x0 = sx + px * f, y0 = sy + py;
      const x1 = sx + px * 0.4 * f + sway, len = 150;
      for (let i = 0; i < len; i += 1) {
        const k = i / len;
        ctx.globalAlpha = (1 - k) * (1 - k) * 0.55;
        ctx.fillRect(Math.round(U.lerp(x0, x1, k)), Math.round(y0 - i), 1, 1);
      }
    }
    ctx.restore();
  }
  def('marionette', {
    name: N('Marionette', 'Marioneta'),
    desc: N('A life-size jester puppet whose strings vanish into the dark above. Nobody has ever seen who holds them.', 'Un bufón de tamaño natural cuyos hilos se pierden en la oscuridad. Nadie ha visto jamás quién los sostiene.'),
    area: 'gallery', hp: 40, atk: 22, def: 2, exp: 14, w: 14, h: 38, gold: [10, 45],
    el: 'cut', weak: ['fire'], noBlood: true, blood: '#e8d8c8', hitSfx: 'hit_bone',
    drops: [{ id: 'potion', p: 0.05 }, { id: 'velvet_hat', p: 0.015 }],
    init(e) {
      e.setState('idle');
      e.hops = 0;
      e.cool = 20;
    },
    ai(e, g) {
      const st = e.state;
      if (st === 'idle') {
        e.vx *= 0.8;
        if (e.stT > 20 && near(e, 190, 90)) {
          e.face();
          e.hops = 0;
          e.setState('hop');
        }
      } else if (st === 'hop') {
        if (e.stT === 1) {
          e.face();
          const vx = e.facing * 1.5;
          e.vx = safeHop(e, g, vx, -3.4) ? vx : 0;
          e.vy = -3.4;
          sfx('bone_rattle', 0.25, 1.8);
        } else if (e.onGround && e.stT > 4) {
          e.hops++;
          G.fx.dust(e.cx, e.fy, 2);
          e.vx = 0;
          if (near(e, 72, 40) && e.cool <= 0) e.setState('windup');
          else e.setState(e.hops > 5 ? 'idle' : 'land');
        }
      } else if (st === 'land') {
        e.vx = 0;
        if (e.stT > 9) e.setState('hop');
      } else if (st === 'windup') {
        e.vx = 0;
        if (e.stT === 1) {
          e.face();
          sfx('swing_light', 0.5, 0.6);
        }
        if (e.stT === 14) G.fx.spark(e.cx + e.facing * 6, e.y - 4, '#ffffff', 4);
        if (e.stT >= 24) {
          e.setState('spin');
          sfx('whip', 0.5, 1.3);
        }
      } else if (st === 'spin') {
        const blocked = !canStep(e, g, e.facing);
        e.vx = blocked ? 0 : U.approach(e.vx, e.facing * 3.3, 0.5);
        if (e.stT % 8 === 0) sfx('swing_light', 0.4, 1.2 + (e.stT % 16 ? 0.1 : 0));
        strike(e, e.cx - 22, e.y + 9, 44, 12);
        if (e.stT > 36 || (blocked && e.stT > 6)) {
          e.setState('dizzy');
          e.cool = 50;
        }
      } else if (st === 'dizzy') {
        e.vx *= 0.82;
        if (e.stT > 34) {
          e.hops = 0;
          e.setState('hop');
        }
      }
      if (e.cool > 0) e.cool--;
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      const flip = e.facing < 0;
      if (st === 'spin') {
        const k = Math.floor(e.stT / 3) % 4;
        const img = marSpinImg(k);
        // the strings twist around the spinning body
        const tw = [10, 6, 2, -6][k];
        marStrings(e, ctx, sx, sy, [[-tw, -27], [tw, -27], [0, -42]], false);
        e.blit(ctx, img, sx, sy, 26, 52, false);
        if (!e.preview) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = '#dfe8ff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(sx, sy - 25, 22, 5, 0, (k * Math.PI) / 2, (k * Math.PI) / 2 + 2.2);
          ctx.stroke();
          ctx.restore();
        }
        return;
      }
      let name;
      if (st === 'hop') name = e.onGround ? 'crouch' : 'air';
      else if (st === 'land') name = 'crouch';
      else if (st === 'windup') name = e.stT < 6 ? 'crouch' : 'windup';
      else if (st === 'dizzy') name = 'dizzy';
      else name = Math.floor(e.t / 30) % 2 ? 'idle1' : 'idle0';
      const P_ = marPts(MAR_POSE[name]);
      const bob = st === 'idle' ? Math.round(Math.sin(e.t * 0.1)) : 0;
      marStrings(e, ctx, sx, sy + bob, [P_.aF.hn, P_.aB.hn, [P_.hd[0], P_.hd[1] - 5]].map(([x, y]) => [x, y + 0.5]), flip);
      e.blit(ctx, marionetteImg(name), sx, sy + bob, 20, 52, flip);
    },
  });

  // @@ENEMIES-END@@ (new enemies are inserted above this line)

  // Debug overlay (G.DEBUG_HITBOX = true): hurtbox in green, attack boxes in red.
  MY.forEach((id) => {
    const d = G.ENEMIES[id];
    const draw = d.draw;
    d.draw = function (e, ctx, sx, sy) {
      draw(e, ctx, sx, sy);
      if (!G.DEBUG_HITBOX || e.preview || !G.game) return;
      const cx = Math.round(G.game.camx), cy = Math.round(G.game.camy);
      const hb = e.hurtbox();
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#40ff60';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(hb.x - cx) + 0.5, Math.round(hb.y - cy) + 0.5, Math.round(hb.w) - 1, Math.round(hb.h) - 1);
      ctx.strokeStyle = '#ff3030';
      for (const b of e._dbg || []) if (e.t - b.t < 2) ctx.strokeRect(Math.round(b.x - cx) + 0.5, Math.round(b.y - cy) + 0.5, Math.max(1, Math.round(b.w) - 1), Math.max(1, Math.round(b.h) - 1));
      ctx.restore();
      if (e._dbg) e._dbg = e._dbg.filter((b) => e.t - b.t < 2);
    };
  });
})();
