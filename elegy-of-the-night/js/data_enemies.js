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

  // ================================================================== MIRROR WRAITH (gallery)
  const WR = {
    gl: '#e4f0fc', g: '#a6c0e6', gs: '#6e8ec4', gd: '#405c92', gdd: '#283a64',
    fr: '#d8b45a', frD: '#7e5a26', glass: '#bdeaf6', glassH: '#f6fcff', crack: '#1c2842', eye: '#ff3048',
  };
  const WR_PAL = Object.values(WR);
  const WR_ARMS = {
    float: [[[3, -29], [6, -24], [9.5, -27]], [[-2, -29], [-3.5, -23], [-1.5, -18.5]]],
    lunge: [[[3, -29], [9, -29.5], [15, -31]], [[-1, -29], [5.5, -27.5], [12, -26]]],
    shriek: [[[3, -29], [8, -33], [12.5, -38.5]], [[-2, -29], [-7, -33], [-11, -37.5]]],
  };
  function wraithImg(f, pose) {
    return spr('mwraith_' + pose + f, 46, 56, WR_PAL, (c) => {
      c.translate(23, 54);
      const w = (f / 4) * Math.PI * 2;
      const lean = pose === 'lunge' ? 0.5 : pose === 'shriek' ? -0.18 : 0.06;
      const stream = pose === 'lunge' ? 5 : 0;
      c.translate(0, -24);
      c.rotate(lean);
      c.translate(0, 24);
      // hair streaming back (behind everything)
      const hw = Math.sin(w) * 1.6, hw2 = Math.sin(w + 1.3) * 1.8, hw3 = Math.sin(w + 2.6) * 2;
      gfx.poly(c, [0, -43, -5, -42.5, -9 - stream, -37 + hw, -12 - stream * 1.4, -30 + hw2, -14 - stream * 1.6, -21 + hw3, -10 - stream, -24 + hw2, -8, -28, -4, -33], WR.gd);
      gfx.poly(c, [0, -43, -5, -42.5, -8.5 - stream, -37.5 + hw, -11 - stream * 1.3, -31 + hw2, -12.5 - stream * 1.5, -24 + hw3, -9, -29, -4.5, -34], WR.gs);
      gfx.poly(c, [-1, -43, -5, -42, -8 - stream, -38 + hw, -9.5 - stream, -33 + hw2, -6, -35], WR.g);
      gfx.limb(c, -3, -41.5, -8.5 - stream, -36 + hw, 0.9, WR.gl);
      gfx.limb(c, -7, -36, -11 - stream * 1.3, -27 + hw2, 0.8, WR.g);
      // back arm
      const arms = WR_ARMS[pose];
      const ab = arms[1];
      gfx.limb(c, ab[0][0], ab[0][1], ab[1][0], ab[1][1], 1.8, WR.gs);
      gfx.limb(c, ab[1][0], ab[1][1], ab[2][0], ab[2][1], 1.6, WR.gs);
      // gown flowing into a ghostly tail that streams backwards
      const t1 = Math.sin(w) * 2, t2 = Math.sin(w + 2) * 2, t3 = Math.sin(w + 4) * 1.5;
      gfx.poly(c, [-4, -30, 4.5, -30, 3.6, -24, 7.5, -13, 5, -7 + t1, 1.5, -3 + t2, -2 - stream, 0 + t1, -4 - stream, -5, -8 - stream, -2 + t3, -9 - stream, -8, -12 - stream, -6 + t2, -9.5, -13, -5, -22], WR.g);
      gfx.poly(c, [-4, -30, -1.5, -30, -2.5, -22, -6, -13, -8 - stream, -8, -12 - stream, -6 + t2, -9.5, -13, -5, -22], WR.gs);
      gfx.poly(c, [-6, -13, -8 - stream, -8, -12 - stream, -6 + t2, -9.5, -12], WR.gd);
      // folds and a high lace collar
      gfx.limb(c, 1.5, -22, 3.5, -10, 0.9, WR.gs);
      gfx.limb(c, -1, -22, -1.5, -8, 0.9, WR.gs);
      gfx.limb(c, 4, -22, 6, -14, 0.9, WR.gl);
      gfx.ellipse(c, 0.5, -30.5, 4.6, 1.5, 0, WR.gl);
      // mirror-handle neck
      gfx.limb(c, 1, -33, 0.7, -30, 1.6, WR.frD);
      // the face: an oval hand-mirror, cracked
      c.save();
      c.translate(2.2, -37.5);
      gfx.ellipse(c, 0, 0, 5.1, 6.1, 0, WR.frD);
      gfx.ellipse(c, 0.4, -0.3, 4.4, 5.4, 0, WR.fr);
      gfx.ellipse(c, 0.6, -0.2, 3.3, 4.3, 0, WR.glass);
      gfx.limb(c, -1.2, -1.2, 0.8, -3.4, 1.1, WR.glassH);
      const cx0 = 1.2, cy0 = 0.8;
      [[3.4, -2.4], [-2, 1.8], [1.8, 3.8], [-1, -3], [3.6, 2]].forEach(([x, y]) => gfx.limb(c, cx0, cy0, x, y, 0.8, WR.crack));
      c.fillStyle = WR.eye;
      c.fillRect(-1, 0, 1, 1);
      c.fillStyle = WR.fr;
      c.fillRect(-0.4, -7.6, 2, 2); // finial
      c.fillStyle = WR.frD;
      c.fillRect(0, -6.2, 1, 1);
      c.restore();
      // front arm with long fingers
      const af = arms[0];
      gfx.limb(c, af[0][0], af[0][1], af[1][0], af[1][1], 1.9, WR.gl);
      gfx.limb(c, af[1][0], af[1][1], af[2][0], af[2][1], 1.7, WR.gl);
      const [hx, hy] = af[2], ha = Math.atan2(af[2][1] - af[1][1], af[2][0] - af[1][0]);
      for (let i = -1; i <= 1; i++) gfx.limb(c, hx, hy, hx + Math.cos(ha + i * 0.5) * 2.6, hy + Math.sin(ha + i * 0.5) * 2.6, 0.9, WR.gl);
    });
  }
  def('mirror_wraith', {
    name: N('Mirror Wraith', 'Espectro del espejo'),
    desc: N('A lady who gazed into an enchanted looking-glass until it gazed back. The cracked mirror is all that remains of her face.', 'Una dama que miró un espejo encantado hasta que el espejo le devolvió la mirada. El cristal agrietado es todo lo que queda de su rostro.'),
    area: 'gallery', hp: 32, atk: 22, def: 0, exp: 14, w: 16, h: 30, flying: true, gold: [10, 40],
    el: 'ice', weak: ['holy'], immune: ['poison'], noBlood: true, blood: '#cfe8ff', stunTime: 8,
    drops: [{ id: 'mana_tonic', p: 0.05 }, { id: 'silver_locket', p: 0.01 }],
    init(e) {
      e.setState('float');
      e.cool = 80 + e.rnd.int(0, 60);
      e.alpha = 0.85;
      e.lv = [0, 0];
    },
    onHitCheck(e) {
      return e.alpha > 0.45;
    },
    ai(e, g) {
      const st = e.state, p = e.player;
      if (st === 'float') {
        const side = e.cx < p.cx ? -1 : 1;
        const tx = p.cx + side * 74, ty = p.cy - 16 + Math.sin(e.t * 0.045) * 12;
        e.vx = U.approach(e.vx, U.clamp((tx - e.cx) * 0.03, -0.9, 0.9), 0.05);
        e.vy = U.approach(e.vy, U.clamp((ty - e.cy) * 0.03, -0.8, 0.8), 0.05);
        e.face();
        e.alpha = U.approach(e.alpha, 0.85, 0.05);
        if (--e.cool <= 0 && e.dist() < 240) {
          e.setState('fade');
          sfx('ghost_wail', 0.35, 0.8);
        }
      } else if (st === 'fade') {
        e.vx *= 0.9;
        e.vy *= 0.9;
        e.alpha = Math.max(0, 0.85 * (1 - e.stT / 28));
        if (e.stT % 3 === 0) G.fx.particle(e.cx + U.rnd(-7, 7), e.cy + U.rnd(-12, 12), U.rnd(-0.4, 0.4), U.rnd(-1, -0.2), U.pick(['#cfe6ff', '#ffffff', '#8ab0e8']), 26, { glow: true });
        if (e.stT >= 28) {
          e.alpha = 0;
          e.setState('hidden');
        }
      } else if (st === 'hidden') {
        e.vx = e.vy = 0;
        if (e.stT >= 26) {
          // slip out of the glass right behind the player
          const behind = -(p.facing || 1);
          e.x = U.clamp(p.cx + behind * 64, 12, g.room.pw - 12) - e.w / 2;
          e.y = p.cy - 16 - e.h / 2;
          e.face();
          e.setState('appear');
          sfx('magic_cast', 0.45, 1.6);
        }
      } else if (st === 'appear') {
        e.alpha = Math.min(0.9, e.stT / 18);
        e.face();
        e.vy = Math.sin(e.stT * 0.3) * 0.2;
        if (e.stT === 10) G.fx.spark(e.cx + e.facing * 2, e.y - 3, '#e8f6ff', 6);
        if (e.stT >= 28) {
          const a = Math.atan2(p.cy - 6 - e.cy, p.cx - e.cx);
          e.lv = [Math.cos(a) * 4.2, Math.sin(a) * 4.2];
          e.facing = e.lv[0] < 0 ? -1 : 1;
          e.setState('lunge');
          sfx('ghost_wail', 0.5, 1.4);
        }
      } else if (st === 'lunge') {
        const k = e.stT < 22 ? 1 : Math.max(0, 1 - (e.stT - 22) / 16);
        e.vx = e.lv[0] * k;
        e.vy = e.lv[1] * k;
        if (e.stT % 5 === 0) G.fx.particle(e.cx + U.rnd(-5, 5), e.cy + U.rnd(-8, 8), -e.vx * 0.1, -e.vy * 0.1, '#bcd8ff', 14, { glow: true });
        if (e.stT >= 38) {
          e.setState('float');
          e.cool = 110 + e.rnd.int(0, 80);
        }
      }
      e.drift();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      let img;
      if (st === 'lunge') img = wraithImg(0, 'lunge');
      else if (st === 'appear') img = wraithImg(Math.floor(e.t / 6) % 4, 'shriek');
      else img = wraithImg(Math.floor(e.t / 8) % 4, 'float');
      const bob = st === 'float' || st === 'fade' ? Math.round(Math.sin(e.t * 0.08) * 1.5) : 0;
      if (!e.preview) G.gfx.addLight(sx, sy - 18, 56, '#8ab8ff', 0.7 * e.alpha);
      if (st === 'lunge' && !e.preview) {
        // fading afterimages along the lunge
        const a0 = ctx.globalAlpha;
        for (let i = 2; i >= 1; i--) {
          ctx.globalAlpha = a0 * 0.22 * (3 - i);
          gfx.drawAnchored(img, sx - e.vx * 5 * i, sy + 8 - e.vy * 5 * i, 23, 54, e.facing < 0, null, ctx);
        }
        ctx.globalAlpha = a0;
      }
      e.blit(ctx, img, sx, sy + 8 + bob, 23, 54, e.facing < 0);
      if (st === 'appear' && e.stT > 6 && e.stT < 16) glow(ctx, sx + e.facing * 2, sy - 31, 3 + (e.stT % 4), '#ffffff', 0.8);
    },
  });

  // ================================================================== GARGOYLE (gallery)
  const GA = { l: '#b4b0a4', m: '#87837b', d: '#5d5a54', dd: '#3a3835', horn: '#dcd6c4', eye: '#ff5a1e', eyeH: '#ffd468', moss: '#5a6a3c' };
  const GA_PAL = Object.values(GA);
  // a bat wing pointing "up" from the shoulder (origin), rotated by `a` (negative = swings back/down)
  function gargWing(c, a, cols, scale) {
    c.save();
    c.rotate(a);
    c.scale(scale || 1, scale || 1);
    gfx.poly(c, [0, 0, 1.5, -9, 4, -19, 0.5, -14.5, -3, -18, -3.5, -11.5, -8, -13, -6, -5, -2, 1], cols[0]);
    gfx.poly(c, [-2.5, -7, -3.5, -11.5, -8, -13, -6, -5, -2, 1], cols[1]);
    gfx.limb(c, 0, 0, 1.5, -9, 1.6, cols[2]);
    gfx.limb(c, 1.5, -9, 4, -19, 1.1, cols[2]);
    gfx.limb(c, 1.5, -9, -3, -18, 1, cols[2]);
    gfx.limb(c, 1.5, -9, -8, -13, 1, cols[2]);
    gfx.circle(c, 1.5, -9, 1, GA.horn);
    c.restore();
  }
  function gargHead(c, x, y, awake, snarl) {
    c.save();
    c.translate(x, y);
    // horns sweeping back
    gfx.poly(c, [-1, -3, -5, -6.5, -9, -6, -6, -4.8, -2.5, -1.5], GA.horn);
    gfx.poly(c, [-5, -6.5, -9, -6, -7.5, -5.4], GA.m);
    // skull + brow
    gfx.ellipse(c, 0, 0, 4.6, 3.8, 0.1, GA.m);
    gfx.poly(c, [-1, -3.6, 4.5, -2.6, 5.4, -1, 1, -1.6], GA.l);
    // muzzle and jaw
    gfx.poly(c, [2, -1.5, 8, -0.6, 8.4, 1.2, 3, 2], GA.m);
    gfx.poly(c, [2.5, 1.8, 7.5, snarl ? 3.6 : 2.2, 6.5, snarl ? 4.8 : 3.4, 2, 3.6], GA.d);
    c.fillStyle = GA.horn;
    c.fillRect(6, 1.2, 1, snarl ? 2 : 1.4);
    c.fillRect(4, 1.4, 1, 1.4);
    // pointed ear
    gfx.poly(c, [-2, -2, -4, -6.5, -1, -3.5], GA.d);
    // eye
    c.fillStyle = awake ? GA.eye : GA.dd;
    c.fillRect(2.4, -1.6, 2, 1.4);
    if (awake) {
      c.fillStyle = GA.eyeH;
      c.fillRect(3.4, -1.6, 1, 1);
    }
    c.restore();
  }
  function gargImg(mode, f, awake) {
    return spr('garg_' + mode + f + (awake ? 'a' : ''), 56, 48, GA_PAL, (c) => {
      c.translate(28, 46);
      if (mode === 'perch') {
        // tail curled around the feet
        gfx.limb(c, -7, -5, -13, -3, 2.2, GA.d);
        gfx.limb(c, -13, -3, -11, 0, 1.8, GA.d);
        gfx.poly(c, [-11, 0, -9, -1.8, -8.5, 0.6], GA.dd);
        // folded wings rising behind the shoulders
        gfx.poly(c, [-3, -19, -6, -33, -9, -27, -12, -30, -11, -16, -6, -8], GA.d);
        gfx.poly(c, [-5, -21, -6, -33, -8, -25, -9, -14], GA.m);
        gfx.limb(c, -4.5, -20, -6, -32.5, 1.1, GA.l);
        // haunch & back foot
        gfx.ellipse(c, -3, -8, 6.5, 5.5, 0, GA.m);
        gfx.ellipse(c, -4.5, -9.5, 3.8, 3, 0, GA.l);
        gfx.poly(c, [-6, -2.5, 3, -2.5, 4.5, 0.4, -7, 0.4], GA.d);
        c.fillStyle = GA.horn;
        c.fillRect(3.5, -1, 2, 1.2);
        // hunched torso
        gfx.ellipse(c, 1.5, -15, 6.2, 8.5, 0.45, GA.m);
        gfx.ellipse(c, 3.6, -14.5, 3, 5.5, 0.4, GA.l);
        gfx.limb(c, -3.5, -21, -4.5, -11, 1, GA.d);
        // front arm braced on the ground
        gfx.limb(c, 5, -18, 7.5, -9, 3, GA.m);
        gfx.limb(c, 7.5, -9, 9, -2, 2.6, GA.m);
        gfx.limb(c, 6, -17, 8.2, -9.5, 1, GA.l);
        gfx.poly(c, [7, -2, 12, -1.4, 12.6, 0.5, 7, 0.5], GA.d);
        c.fillStyle = GA.horn;
        c.fillRect(12, -1, 1.4, 1.2);
        c.fillRect(10, -0.6, 1.2, 1);
        // moss on the shoulders (it has been still for a long time)
        if (!awake) {
          c.fillStyle = GA.moss;
          c.fillRect(-2, -23, 3, 1);
          c.fillRect(-4, -22, 2, 1);
        }
        gargHead(c, 8.5, -22, awake, awake);
        return;
      }
      // flying / diving: body roughly horizontal
      const wingA = mode === 'dive' ? -1.75 : [-0.35, -1.05, -1.9, -1.05][f];
      if (mode === 'dive') {
        c.translate(0, -18);
        c.rotate(0.62);
        c.translate(0, 18);
      }
      // far wing (darker, behind)
      c.save();
      c.translate(-1, -21);
      gargWing(c, wingA + 0.25, [GA.d, GA.dd, GA.m], 0.92);
      c.restore();
      // tail
      gfx.limb(c, -8, -17, -15, -15 + (mode === 'dive' ? 0 : Math.sin(f * 1.6) * 1.5), 2, GA.d);
      gfx.limb(c, -15, -15, -20, -17, 1.4, GA.d);
      gfx.poly(c, [-20, -17, -23, -19, -22, -15.5], GA.dd);
      // legs tucked back with talons
      gfx.limb(c, -5, -14, -9, -9, 3, GA.d);
      gfx.limb(c, -9, -9, -6, -5, 2.2, GA.d);
      c.fillStyle = GA.horn;
      c.fillRect(-6, -5, 2, 1);
      c.fillRect(-7, -4, 1, 1.2);
      // torso
      gfx.ellipse(c, 0, -17.5, 8.5, 5.4, -0.15, GA.m);
      gfx.ellipse(c, 2, -15.5, 5.5, 2.8, -0.15, GA.l);
      gfx.limb(c, -6, -20, 3, -21.5, 1, GA.d);
      // arms reaching forward, claws spread
      const reach = mode === 'dive' ? 3 : 0;
      gfx.limb(c, 5, -16, 9 + reach, -11.5, 2.6, GA.m);
      gfx.limb(c, 9 + reach, -11.5, 13 + reach * 1.5, -10, 2.1, GA.m);
      c.fillStyle = GA.horn;
      c.fillRect(13 + reach * 1.5, -11.5, 2, 1);
      c.fillRect(13 + reach * 1.5, -9.5, 2, 1);
      gargHead(c, 10, -22.5, true, mode === 'dive');
      // near wing (in front)
      c.save();
      c.translate(1, -20);
      gargWing(c, wingA, [GA.m, GA.d, GA.l], 1);
      c.restore();
    });
  }
  def('gargoyle', {
    name: N('Gargoyle', 'Gárgola'),
    desc: N('Carved to frighten pilgrims, it learned to enjoy the work. It waits on its plinth for hours, then falls on its prey like a stone.', 'Tallada para asustar a los peregrinos, aprendió a disfrutar del oficio. Espera horas en su pedestal y luego cae sobre su presa como una piedra.'),
    area: 'gallery', hp: 55, atk: 24, def: 4, exp: 20, w: 20, h: 22, gold: [15, 60],
    el: 'hit', resist: ['cut'], weak: ['hit'], armored: true, noBlood: true, blood: '#b8b4a8', hitSfx: 'hit_metal',
    drops: [{ id: 'holy_salt', p: 0.04 }, { id: 'garnet_ring', p: 0.01 }],
    previewState: 'fly',
    init(e) {
      e.setState('perch');
      e.flying = false;
      e.dives = 0;
      e.tx = 0;
      e.ty = 0;
    },
    onHit(e) {
      if (e.state === 'perch') e.setState('wake');
    },
    ai(e, g) {
      const st = e.state, p = e.player;
      if (st === 'perch') {
        e.vx = 0;
        if (Math.abs(e.dxp()) < 112 && e.dyp() > -60 && e.dyp() < 170 && e.seesPlayer(220)) e.setState('wake');
      } else if (st === 'wake') {
        e.vx = 0;
        if (e.stT === 1) sfx('stomp', 0.4, 1.5);
        if (e.stT % 5 === 0) G.fx.debris(e.cx + U.rnd(-8, 8), e.y + U.rnd(0, 10), '#87837b', 2);
        if (e.stT === 14) sfx('roar', 0.35, 1.7);
        if (e.stT >= 30) {
          e.face();
          e.flying = true;
          e.vy = -2.4;
          e.setState('rise');
          sfx('bat_flap', 0.5, 0.6);
        }
      } else if (st === 'rise') {
        // climb above the player, offset to the side we came from
        const side = e.cx < p.cx ? -1 : 1;
        const tx = p.cx + side * 56, ty = p.cy - 82;
        e.vx = U.approach(e.vx, U.clamp((tx - e.cx) * 0.05, -1.8, 1.8), 0.12);
        e.vy = U.approach(e.vy, U.clamp((ty - e.cy) * 0.05, -1.8, 1.4), 0.12);
        e.face();
        if (e.stT % 16 === 0) sfx('bat_flap', 0.3, 0.7);
        if ((e.stT > 40 && Math.abs(ty - e.cy) < 14) || e.stT > 110 || (e.hitCeil && e.stT > 20)) e.setState('aim');
      } else if (st === 'aim') {
        e.vx *= 0.85;
        e.vy = Math.sin(e.stT * 0.4) * 0.3;
        e.face();
        if (e.stT === 1) sfx('bat_screech', 0.45, 0.55);
        if (e.stT >= 20) {
          const a = Math.atan2(p.cy - e.cy, p.cx - e.cx);
          const sp = 4.4;
          e.lv = [Math.cos(a) * sp, Math.sin(a) * sp];
          e.ty = p.cy;
          e.setState('dive');
        }
      } else if (st === 'dive') {
        e.vx = e.lv[0];
        e.vy = e.lv[1];
        if (e.stT % 3 === 0) G.fx.particle(e.cx, e.cy, 0, 0, '#8a867c', 14, { size: 2 });
        if (e.onGround || e.hitWall || e.hitCeil || e.stT > 60 || (e.lv[1] > 0 && e.cy > e.ty + 30)) {
          if (e.onGround) {
            G.fx.dust(e.cx, e.fy, 6);
            G.gfx.shake(2, 8);
            sfx('stomp', 0.5, 1.1);
          }
          e.dives++;
          e.setState('pull');
        }
      } else if (st === 'pull') {
        e.vx *= 0.88;
        e.vy = U.approach(e.vy, -1.2, 0.15);
        if (e.stT >= 18) e.setState('rise');
      }
      e.move();
      if (e.flying && e.onGround) e.vy = Math.min(e.vy, 0);
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      if (st === 'perch' || st === 'wake') {
        const shake = st === 'wake' && e.stT % 4 < 2 ? (e.stT % 8 < 4 ? 1 : -1) : 0;
        e.blit(ctx, gargImg('perch', 0, st === 'wake' && e.stT > 8), sx + shake, sy, 28, 46, e.facing < 0);
        if (st === 'wake' && e.stT > 8) G.gfx.addLight(sx + e.facing * 9, sy - 23, 22, '#ff6020', 0.6);
        return;
      }
      const mode = st === 'dive' ? 'dive' : 'fly';
      const f = st === 'aim' ? 0 : Math.floor(e.t / (st === 'pull' ? 3 : 5)) % 4;
      e.blit(ctx, gargImg(mode, mode === 'dive' ? 0 : f, true), sx, sy + 3, 28, 46, e.facing < 0);
      if (!e.preview) G.gfx.addLight(sx + e.facing * 10, sy - 20, 20, '#ff6020', 0.5);
      if (st === 'aim' && e.stT > 8) glow(ctx, sx + e.facing * 13, sy - 21, 2, '#ffd060', 0.9);
    },
  });

  // ================================================================== SPEAR GUARD (gallery)
  const SG = {
    s1: '#e6eaf2', s2: '#a9b1c2', s3: '#6c7488', s4: '#3a4052', b1: '#6c8ce2', b2: '#3a5ab2', b3: '#22367e',
    au: '#e4b84c', auD: '#8a6420', wood: '#8e5e30', woodD: '#5a3a1a', eye: '#ff4848',
  };
  const SG_PAL = Object.values(SG);
  // spear placement per pose: [butt x, tip x, y]
  const SG_SPEAR = { walk: [-22, 30, -31], windup: [-38, 13, -30], thrust: [-4, 52, -28] };
  function spearGuardImg(pose, f) {
    return spr('spguard_' + pose + f, 104, 56, SG_PAL, (c) => {
      c.translate(40, 54);
      const ph = (f / 4) * Math.PI * 2;
      const step = pose === 'walk' ? Math.sin(ph) : 0;
      const bob = pose === 'walk' ? Math.abs(Math.cos(ph)) * 0.8 : pose === 'thrust' ? 1 : 0;
      const lean = pose === 'thrust' ? 3 : pose === 'windup' ? -1.5 : 0;
      // legs (greaves + sabatons)
      const legs = pose === 'thrust' ? [[5, -3], [-6, 2]] : pose === 'windup' ? [[3, 0], [-4, 1]] : [[step * 4, 0], [-step * 4, 0]];
      const drawLeg = (dx, kx, cA, cB) => {
        gfx.limb(c, 0 + kx * 0.3, -18 + bob, dx * 0.6 + kx, -9 + bob, 3.6, cA);
        gfx.limb(c, dx * 0.6 + kx, -9 + bob, dx, -2, 3.2, cA);
        gfx.limb(c, dx * 0.6 + kx + 0.8, -9.5 + bob, dx + 0.6, -3, 1, cB);
        gfx.poly(c, [dx - 2, -3, dx + 3, -2.6, dx + 4.6, 0.4, dx - 2.2, 0.4], SG.s3);
      };
      drawLeg(legs[1][0], legs[1][1] * 0.4, SG.s3, SG.s2);
      // tabard skirt
      gfx.poly(c, [-5 + lean * 0.4, -19 + bob, 5 + lean * 0.4, -19 + bob, 6, -8 + bob, 0.5, -10 + bob, -5, -8 + bob], SG.b2);
      gfx.poly(c, [-5 + lean * 0.4, -19 + bob, -1.5 + lean * 0.4, -19 + bob, -2, -9 + bob, -5, -8 + bob], SG.b3);
      gfx.limb(c, -5, -8.4 + bob, 6, -8.4 + bob, 1.2, SG.au);
      drawLeg(legs[0][0], legs[0][1] * 0.4, SG.s2, SG.s1);
      // torso: breastplate under the tabard
      c.save();
      c.translate(lean * 0.6, bob);
      gfx.poly(c, [-5.5, -19, 5.5, -19, 6.5, -30, -5, -31], SG.s2);
      gfx.poly(c, [-4.5, -19, 4.8, -19, 5.4, -29, -3.8, -29.6], SG.b2);
      gfx.poly(c, [-4.5, -19, -1, -19, -1.2, -29.4, -3.8, -29.6], SG.b3);
      // gold tower emblem on the tabard
      c.fillStyle = SG.au;
      c.fillRect(1, -27, 3, 5);
      c.fillRect(0.5, -28, 1, 1);
      c.fillRect(2, -28, 1, 1);
      c.fillRect(3.5, -28, 1, 1);
      c.fillStyle = SG.auD;
      c.fillRect(2, -24, 1, 2);
      // belt
      gfx.limb(c, -5.2, -19.2, 5.6, -19.2, 1.6, SG.woodD);
      c.fillStyle = SG.au;
      c.fillRect(2, -20, 2, 1.6);
      // far arm + kite shield (lowered and pulled aside while thrusting)
      const sh = pose === 'thrust' ? [3, -12] : pose === 'windup' ? [8, -21] : [9, -22];
      gfx.limb(c, 2, -28, sh[0] - 2, sh[1] + 1, 2.6, SG.s3);
      c.save();
      c.translate(sh[0], sh[1]);
      if (pose === 'thrust') c.rotate(0.5);
      gfx.poly(c, [-3.5, -10, 3.5, -10.5, 4, 1, 0.2, 9, -3.6, 1], SG.s3);
      gfx.poly(c, [-2.6, -9, 2.6, -9.4, 3, 0.6, 0.2, 7.4, -2.7, 0.6], SG.b2);
      gfx.poly(c, [0.6, -9.2, 2.6, -9.4, 3, 0.6, 0.6, 6.5], SG.b1);
      c.fillStyle = SG.au;
      c.fillRect(-0.4, -7.5, 1.4, 11);
      c.fillRect(-2.4, -4.5, 5.2, 1.4);
      c.restore();
      // pauldron + helmet
      gfx.ellipse(c, -1, -30, 4.6, 3.2, -0.2, SG.s2);
      gfx.ellipse(c, -0.4, -31, 3.2, 1.8, -0.2, SG.s1);
      gfx.limb(c, -4.5, -29, 2.5, -27, 0.9, SG.s3);
      // plume
      gfx.poly(c, [-1, -41, -6, -42, -11, -38, -9, -37, -12, -34, -6, -37, -2, -38], SG.b2);
      gfx.poly(c, [-1, -41, -6, -42, -9, -39.5, -5, -40], SG.b1);
      // bascinet with a pointed visor
      gfx.ellipse(c, 0.4, -36, 4.6, 5, 0, SG.s2);
      gfx.poly(c, [0, -40.5, 3.5, -39, 7, -35.5, 3.5, -32.2, 0, -32], SG.s1);
      gfx.poly(c, [-4, -36, -1, -36, -1.5, -31.5, -4.4, -32.2], SG.s3);
      c.fillStyle = SG.s4;
      c.fillRect(1, -36.8, 5, 1.2);
      c.fillStyle = SG.eye;
      c.fillRect(4, -36.8, 1, 1);
      c.fillStyle = SG.s3;
      c.fillRect(3, -34, 1, 1);
      c.fillRect(5, -34.6, 1, 1);
      gfx.limb(c, -4, -31.4, 4, -31.4, 1.2, SG.s3);
      c.restore();
      // the spear (near arm holds it over the shield)
      const sp = SG_SPEAR[pose];
      const y = sp[2] + bob;
      gfx.limb(c, sp[0], y, sp[1] - 5, y, 1.8, SG.wood);
      gfx.limb(c, sp[0], y + 0.6, sp[1] - 5, y + 0.6, 0.8, SG.woodD);
      gfx.poly(c, [sp[1] - 6, y - 2, sp[1] - 2, y - 1.6, sp[1] + 2, y, sp[1] - 2, y + 1.6, sp[1] - 6, y + 2], SG.s2);
      gfx.poly(c, [sp[1] - 6, y - 2, sp[1] - 2, y - 1.6, sp[1] + 2, y, sp[1] - 6, y], SG.s1);
      gfx.limb(c, sp[1] - 7, y - 2.6, sp[1] - 7, y + 2.6, 1.2, SG.au);
      // blue pennant behind the spearhead
      if (pose !== 'thrust') gfx.poly(c, [sp[1] - 9, y - 1, sp[1] - 16, y - 1, sp[1] - 14, y + 2, sp[1] - 17, y + 4.5, sp[1] - 10, y + 2], SG.b2);
      gfx.limb(c, sp[0] - 0.5, y, sp[0] + 1.5, y, 2.4, SG.s3);
      // near arm gripping the shaft
      const hx = pose === 'thrust' ? 16 : pose === 'windup' ? -6 : 6;
      gfx.limb(c, -1 + lean * 0.6, -29 + bob, (hx - 1) * 0.5, y + 4, 3, SG.s2);
      gfx.limb(c, (hx - 1) * 0.5, y + 4, hx, y + 0.5, 2.6, SG.s2);
      gfx.circle(c, hx, y + 0.5, 1.8, SG.s3);
    });
  }
  def('spear_guard', {
    name: N('Spear Guard', 'Guardia lancero'),
    desc: N('An empty suit of the old castle guard, still walking its rounds. Its shield never wavers; strike its back, or when it lunges.', 'Una armadura vacía de la antigua guardia que aún hace su ronda. Su escudo nunca vacila: golpéala por la espalda o cuando embiste.'),
    area: 'gallery', hp: 70, atk: 26, def: 6, exp: 26, w: 16, h: 40, gold: [20, 80],
    el: 'cut', armored: true, noBlood: true, blood: '#cfd6e6', stunTime: 6,
    drops: [{ id: 'potion', p: 0.06 }, { id: 'iron_shield', p: 0.015 }],
    init(e) {
      e.setState('walk');
      e.cool = 50;
      e.turnT = 0;
    },
    // the kite shield turns frontal blows: ¼ damage, unless he is thrusting
    onHitCheck(e, hit, g) {
      const guarding = e.state === 'walk' || (e.state === 'windup' && e.stT < 12);
      if (!guarding) return true;
      const fromX = hit.item ? g.player.cx : hit.w != null ? hit.x + hit.w / 2 : g.player.cx;
      if ((fromX - e.cx) * e.facing <= 0) return true;
      hit.dmg = Math.max(1, (hit.dmg - e.defn / 2) * 0.25 + e.defn / 2);
      hit.noCrit = true;
      sfx('block', 0.7, 0.9);
      G.fx.spark(e.cx + e.facing * 10, e.y + 18, '#ffffff', 6);
      return true;
    },
    ai(e, g) {
      const st = e.state;
      if (st === 'walk') {
        const d = e.dxp();
        // slow to turn around: jump over him and strike his back
        if (d * e.facing < 0 && Math.abs(d) > 6) {
          if (++e.turnT > 30) {
            e.facing *= -1;
            e.turnT = 0;
            sfx('hit_metal', 0.25, 0.7);
          }
        } else e.turnT = 0;
        const want = Math.abs(d) > 44 && d * e.facing > 0;
        e.vx = want && canStep(e, g, e.facing) ? e.facing * 0.45 : 0;
        if (e.vx && e.t % 24 === 0) sfx('hit_metal', 0.12, 0.6);
        if (e.cool > 0) e.cool--;
        else if (Math.abs(d) < 74 && d * e.facing > 0 && Math.abs(e.dyp()) < 30) e.setState('windup');
      } else if (st === 'windup') {
        e.vx = 0;
        if (e.stT === 1) sfx('hit_metal', 0.4, 1.5);
        if (e.stT === 8) G.fx.spark(e.cx + e.facing * -2, e.y + 10, '#ffffff', 4);
        if (e.stT >= 20) {
          e.setState('thrust');
          sfx('swing_heavy', 0.7, 1.1);
        }
      } else if (st === 'thrust') {
        e.vx = e.stT < 6 && canStep(e, g, e.facing) ? e.facing * 1.4 : 0;
        if (e.stT <= 12) strike(e, e.facing > 0 ? e.cx + 6 : e.cx - 54, e.y + 9, 48, 7);
        if (e.stT >= 14) e.setState('recover');
      } else if (st === 'recover') {
        e.vx = 0;
        if (e.stT >= 26) {
          e.setState('walk');
          e.cool = 70 + e.rnd.int(0, 40);
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      let pose = 'walk', f = 0;
      if (st === 'windup') pose = e.stT < 5 ? 'walk' : 'windup';
      else if (st === 'thrust') pose = 'thrust';
      else if (st === 'recover') pose = e.stT < 14 ? 'thrust' : 'windup';
      else f = Math.abs(e.vx) > 0.05 ? Math.floor(e.t / 10) % 4 : 0;
      e.blit(ctx, spearGuardImg(pose, f), sx, sy, 40, 54, e.facing < 0);
      if (st === 'windup' && e.stT > 6) glow(ctx, sx + e.facing * 13, sy - 30, 1 + (e.stT % 3), '#ffffff', 0.8);
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
