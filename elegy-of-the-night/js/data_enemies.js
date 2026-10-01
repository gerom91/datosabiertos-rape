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
    const a0 = ctx.globalAlpha;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a0 * (a == null ? 0.5 : a);
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
    dizzy2: { hy: -15, ln: 0.4, hd: 0.5, aF: [0.3, 0.25], aB: [-0.3, 0.05], lF: [0.5, -0.85], lB: [-0.15, -0.4], hat: 2 },
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
      else if (st === 'dizzy') name = Math.floor(e.stT / 9) % 2 ? 'dizzy2' : 'dizzy';
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
    pv: { dy: -7 },
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
          e.active = false;
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
          e.active = true;
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
      if (st === 'lunge') img = wraithImg(Math.floor(e.t / 5) % 2, 'lunge');
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
  function gargWing(c, a, cols, kx, ky) {
    c.save();
    c.rotate(a);
    c.scale(kx, ky);
    // membrane between the arm bone and the finger bones, scalloped trailing edge
    gfx.poly(c, [0, 0, 2, -10, 5, -21, 1, -16.5, -2.5, -20, -3.5, -13.5, -8.5, -15, -6.5, -8, -10, -6, -4, 0.5], cols[0]);
    gfx.poly(c, [-0.5, -5, -3.5, -13.5, -8.5, -15, -6.5, -8, -10, -6, -4, 0.5], cols[1]);
    gfx.limb(c, 0, 0, 2, -10, 1.9, cols[2]);
    gfx.limb(c, 2, -10, 5, -21, 1.2, cols[2]);
    gfx.limb(c, 2, -10, -2.5, -20, 1.1, cols[2]);
    gfx.limb(c, 2, -10, -8.5, -15, 1.1, cols[2]);
    gfx.limb(c, 2, -10, -10, -6, 1, cols[2]);
    gfx.circle(c, 2, -10, 1.2, GA.horn);
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
    return spr('garg_' + mode + f + (awake ? 'a' : ''), 72, 64, GA_PAL, (c) => {
      c.translate(36, 62);
      if (mode === 'perch') {
        // folded wings rising behind the shoulders
        c.save();
        c.translate(-4, -20);
        gargWing(c, -0.18, [GA.d, GA.dd, GA.m], 0.55, 1.2);
        c.restore();
        c.save();
        c.translate(-2, -19);
        gargWing(c, -0.05, [GA.m, GA.d, GA.l], 0.6, 1.15);
        c.restore();
        // tail curled around the feet
        gfx.limb(c, -7, -5, -13, -3, 2.2, GA.d);
        gfx.limb(c, -13, -3, -11, 0, 1.8, GA.d);
        gfx.poly(c, [-11, 0, -9, -1.8, -8.5, 0.6], GA.dd);
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
          c.fillRect(2, -9, 2, 1);
        }
        gargHead(c, 8.5, -22, awake, awake);
        return;
      }
      // flying / diving: a hunched demon hanging under big wings
      const dive = mode === 'dive';
      const wingA = dive ? (f ? -2.0 : -2.22) : [-0.3, -1.0, -1.85, -1.0][f];
      c.translate(0, -20);
      c.rotate(dive ? 1.0 : 0.22);
      c.translate(0, 20);
      // far wing (darker, behind)
      c.save();
      c.translate(-3, -26);
      gargWing(c, wingA + 0.3, [GA.d, GA.dd, GA.m], 1.35, 1.35);
      c.restore();
      // tail
      const tw = dive ? 0 : Math.sin(f * 1.6) * 1.5;
      gfx.limb(c, -3, -14, -9, -9 + tw, 2.2, GA.d);
      gfx.limb(c, -9, -9 + tw, -12, -3, 1.6, GA.d);
      gfx.poly(c, [-12, -3, -15, -1, -11, 0.5, -10.5, -2.5], GA.dd);
      // far leg
      gfx.limb(c, -2, -14, 1, -8, 2.8, GA.d);
      gfx.limb(c, 1, -8, -3, -3, 2.2, GA.d);
      // torso
      gfx.ellipse(c, 0, -20.5, 5.8, 8.4, 0.15, GA.m);
      gfx.ellipse(c, 2.2, -20.5, 2.8, 5.4, 0.15, GA.l);
      gfx.limb(c, -4, -26, -4.5, -15, 1, GA.d);
      // near leg with talons
      gfx.limb(c, 0, -14, 4, -9, 3.2, GA.m);
      gfx.limb(c, 4, -9, 1, -3.5, 2.5, GA.m);
      gfx.limb(c, 1, -14, 4.6, -9.6, 1, GA.l);
      c.fillStyle = GA.horn;
      c.fillRect(0, -3, 2, 1.2);
      c.fillRect(2, -2.5, 1.2, 1.4);
      // arms reaching forward, claws spread
      const reach = dive ? 3 : 0;
      gfx.limb(c, 3, -25, 8 + reach, -21, 2.6, GA.m);
      gfx.limb(c, 8 + reach, -21, 12 + reach * 1.5, -23 + reach * 0.5, 2.1, GA.m);
      c.fillStyle = GA.horn;
      c.fillRect(12 + reach * 1.5, -24.5 + reach * 0.5, 2, 1);
      c.fillRect(12.5 + reach * 1.5, -22.5 + reach * 0.5, 2, 1);
      gargHead(c, 6, -31, true, dive);
      // near wing (in front)
      c.save();
      c.translate(-1, -25);
      gargWing(c, wingA, [GA.m, GA.d, GA.l], 1.45, 1.45);
      c.restore();
    });
  }
  def('gargoyle', {
    name: N('Gargoyle', 'Gárgola'),
    desc: N('Carved to frighten pilgrims, it learned to enjoy the work. It waits on its plinth for hours, then falls on its prey like a stone.', 'Tallada para asustar a los peregrinos, aprendió a disfrutar del oficio. Espera horas en su pedestal y luego cae sobre su presa como una piedra.'),
    area: 'gallery', hp: 55, atk: 24, def: 4, exp: 20, w: 20, h: 22, gold: [15, 60],
    pv: { dy: -9 },
    el: 'hit', resist: ['cut'], weak: ['hit'], armored: true, noBlood: true, blood: '#b8b4a8', hitSfx: 'hit_metal',
    drops: [{ id: 'holy_salt', p: 0.04 }, { id: 'garnet_ring', p: 0.01 }],
    previewState: 'fly',
    init(e) {
      e.setState('perch');
      e.flying = false;
      e.contact = false;
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
          e.contact = true;
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
        e.blit(ctx, gargImg('perch', 0, st === 'wake' && e.stT > 8), sx + shake, sy, 36, 62, e.facing < 0);
        if (st === 'wake' && e.stT > 8) G.gfx.addLight(sx + e.facing * 9, sy - 23, 22, '#ff6020', 0.6);
        return;
      }
      const mode = st === 'dive' ? 'dive' : 'fly';
      const f = st === 'aim' ? 0 : Math.floor(e.t / (st === 'pull' ? 3 : 5)) % 4;
      e.blit(ctx, gargImg(mode, mode === 'dive' ? Math.floor(e.t / 4) % 2 : f, true), sx, sy + 9, 36, 62, e.facing < 0);
      if (!e.preview) G.gfx.addLight(sx + e.facing * 8, sy - 24, 20, '#ff6020', 0.5);
      if (st === 'aim' && e.stT > 8) glow(ctx, sx + e.facing * 10, sy - 23, 2, '#ffd060', 0.9);
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
      // the spear (near arm holds it over the shield); it trembles as he draws it back
      const pull = pose === 'windup' && f ? -2 : 0;
      const sp = [SG_SPEAR[pose][0] + pull, SG_SPEAR[pose][1] + pull, SG_SPEAR[pose][2]];
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
      const hx = (pose === 'thrust' ? 16 : pose === 'windup' ? -6 : 6) + pull;
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
      if (st === 'windup') {
        pose = e.stT < 5 ? 'walk' : 'windup';
        f = pose === 'windup' ? Math.floor(e.stT / 4) % 2 : 0;
      }
      else if (st === 'thrust') pose = 'thrust';
      else if (st === 'recover') pose = e.stT < 14 ? 'thrust' : 'windup';
      else f = Math.abs(e.vx) > 0.05 ? Math.floor(e.t / 10) % 4 : 0;
      e.blit(ctx, spearGuardImg(pose, f), sx, sy, 40, 54, e.facing < 0);
      if (st === 'windup' && e.stT > 6) glow(ctx, sx + e.facing * 13, sy - 30, 1 + (e.stT % 3), '#ffffff', 0.8);
    },
  });

  // ================================================================== FLYING TOME (library)
  const FT = {
    c1: '#b03a46', c2: '#7c1c2c', c3: '#4a0c18', au: '#e8c058', auD: '#8a6420',
    p1: '#f4ead2', p2: '#d2c29c', p3: '#8c785a', glow: '#fff8d8', rune: '#c060ff', runeH: '#ecc8ff',
  };
  const FT_PAL = Object.values(FT);
  // an open book seen from the front, beating its covers like wings
  function tomeImg(f, mode) {
    return spr('ftome_' + mode + f, 40, 36, FT_PAL, (c) => {
      c.translate(20, 18);
      const open = mode === 'open';
      const up = open ? -3 : [-8, -3, 4, -3][f];
      const spread = open ? 16 : [12, 15, 12.5, 15][f];
      for (const d of [-1, 1]) {
        const ox = d * spread, px = d * (spread - 1.6);
        // cover board, then the page block on top of it
        gfx.poly(c, [0, -7.6, ox, -7.6 + up, ox, 7.6 + up * 0.55, 0, 7.6], d < 0 ? FT.c2 : FT.c1);
        if (up > 0) gfx.poly(c, [px, -6.4 + up, ox, -7.6 + up, ox, 7.6 + up * 0.55, px, 6.4 + up * 0.55], FT.c3);
        gfx.poly(c, [d * 0.8, -6.4, px, -6.4 + up, px, 6.4 + up * 0.55, d * 0.8, 6.4], open ? FT.glow : d < 0 ? FT.p2 : FT.p1);
        // lines of text following the page slant
        for (let i = 0; i < 4; i++) {
          const y0 = -3.8 + i * 2.6, k = 0.85 - i * 0.08;
          gfx.limb(c, d * 2.6, y0, d * (spread - 4.2), y0 + up * k, 0.85, open ? FT.au : FT.p3);
        }
        // gold corner fittings
        c.fillStyle = FT.au;
        const cx = d > 0 ? ox - 2 : ox;
        c.fillRect(Math.round(cx), Math.round(-8.2 + up), 2, 2);
        c.fillRect(Math.round(cx), Math.round(6.4 + up * 0.55), 2, 2);
      }
      // spine with gold bands
      gfx.poly(c, [-1.7, -8.4, 1.7, -8.4, 1.7, 8.4, -1.7, 8.4], FT.c3);
      c.fillStyle = FT.au;
      c.fillRect(-1.7, -6.5, 3.4, 1);
      c.fillRect(-1.7, 5.5, 3.4, 1);
      if (open) {
        // a rune burning in the gutter
        c.fillStyle = f ? FT.runeH : FT.rune;
        c.fillRect(-0.5, -3 - f, 1, 6 + f * 2);
        c.fillRect(-2 - f, -1, 4 + f * 2, 1);
      }
    });
  }
  function pageImg(k) {
    return spr('ftome_pg' + k, 10, 10, [FT.p1, FT.p2, FT.p3], (c) => {
      c.translate(5, 5);
      c.rotate(k * 0.8);
      c.scale(1, [1, 0.75, 0.45, 0.75][k]);
      c.fillStyle = FT.p1;
      c.fillRect(-3, -3.5, 6, 7);
      c.fillStyle = FT.p2;
      c.fillRect(-3, 2.5, 6, 1);
      c.fillStyle = FT.p3;
      c.fillRect(-2, -2, 4, 0.9);
      c.fillRect(-2, 0, 3, 0.9);
    });
  }
  function drawPage(p, ctx, sx, sy) {
    ctx.drawImage(pageImg(Math.floor(p.t / 4) % 4), sx - 5, sy - 5);
  }
  def('flying_tome', {
    name: N('Flying Tome', 'Tomo volador'),
    desc: N('A book that read itself too many times. It beats its covers through the stacks and spits razor-edged pages at intruders.', 'Un libro que se leyó a sí mismo demasiadas veces. Bate sus tapas entre las estanterías y escupe páginas afiladas a los intrusos.'),
    area: 'library', hp: 30, atk: 24, def: 1, exp: 15, w: 16, h: 14, flying: true, gold: [10, 40],
    el: 'cut', weak: ['fire'], noBlood: true, blood: '#f0e6cc', hitSfx: 'page_flutter', stunTime: 8,
    drops: [{ id: 'mana_tonic', p: 0.05 }, { id: 'ember_tome', p: 0.008 }],
    init(e) {
      e.setState('fly');
      e.cool = 70 + e.rnd.int(0, 50);
      e.baseY = e.y;
      e.ph = e.rnd.range(0, 6);
    },
    ai(e, g) {
      const st = e.state, p = e.player;
      const dx = e.dxp();
      if (st === 'fly') {
        const want = Math.abs(dx) > 96 ? U.sign(dx) * 0.8 : Math.abs(dx) < 54 ? -U.sign(dx) * 0.6 : 0;
        e.vx = U.approach(e.vx, want, 0.03);
        e.baseY = U.lerp(e.baseY, p.cy - 30, 0.012);
        const ty = e.baseY + Math.sin(e.t * 0.06 + e.ph) * 18;
        e.vy = U.clamp((ty - e.y) * 0.12, -1.6, 1.6);
        e.face();
        if (e.t % 22 === 0 && e.onScreen()) sfx('page_flutter', 0.18, 1.3);
        if (--e.cool <= 0 && e.dist() < 230) {
          e.setState('open');
          sfx('page_flutter', 0.5, 0.8);
        }
      } else if (st === 'open') {
        e.vx *= 0.9;
        e.vy *= 0.9;
        if (e.stT % 4 === 0) G.fx.particle(e.cx + U.rnd(-8, 8), e.cy + U.rnd(-4, 4), 0, -0.5, '#ffe8a0', 16, { glow: true });
        if (e.stT >= 22) {
          const a = Math.atan2(p.cy - 4 - e.cy, p.cx - e.cx);
          for (let i = -1; i <= 1; i++) {
            const b = a + i * 0.32;
            e.shoot({ x: e.cx, y: e.cy, vx: Math.cos(b) * 2.3, vy: Math.sin(b) * 2.3, w: 7, h: 7, life: 150, el: 'cut', drawFn: drawPage, upd: (q) => (q.vy += Math.sin(q.t * 0.25) * 0.04) });
          }
          sfx('page_flutter', 0.7, 1.5);
          e.setState('recoil');
        }
      } else if (st === 'recoil') {
        e.vx = U.approach(e.vx, -e.facing * 0.6, 0.1);
        if (e.stT >= 16) {
          e.setState('fly');
          e.cool = 72 + e.rnd.int(0, 30);
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      const img = st === 'open' ? tomeImg(Math.floor(e.stT / 4) % 2, 'open') : tomeImg(Math.floor(e.t / (st === 'recoil' ? 3 : 5)) % 4, 'fly');
      const cy = sy - 7;
      // ribbon bookmarks trailing behind the spine
      if (!e.preview) {
        const back = -U.sign(e.vx || e.facing);
        for (let r = 0; r < 2; r++) {
          ctx.fillStyle = r ? FT.au : '#d02838';
          for (let i = 0; i < 9; i++) ctx.fillRect(Math.round(sx + (r ? 1 : -1) + back * i * 0.7), Math.round(cy + 8 + i + Math.sin(e.t * 0.2 + i * 0.6 + r) * (i * 0.25)), 1, 1);
        }
      }
      e.blit(ctx, img, sx, cy, 20, 18, false);
      if (st === 'open') {
        glow(ctx, sx, cy, 6 + (e.stT % 6 < 3 ? 1 : 0), '#ffe6a0', 0.35);
        if (!e.preview) G.gfx.addLight(sx, cy, 40, '#ffd890', 0.7);
      }
    },
  });

  // ================================================================== SCHOLAR GHOUL (library)
  const SC = {
    g1: '#4e4462', g2: '#2e283c', g3: '#191522', s1: '#aab69c', s2: '#78866e', s3: '#4c5646',
    cap: '#151219', au: '#e2ba4c', auD: '#8a6420', bk1: '#7c4628', bk2: '#4a2814', pg: '#f0e6c8',
    beard: '#d6d2c4', lens: '#dff2fa', glyph: '#c070ff', glyphH: '#f0d8ff', hood: '#962838', hoodD: '#5c1420',
  };
  const SC_PAL = Object.values(SC);
  function scholarBook(c, x, y, rot, open, lit) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    if (open) {
      gfx.poly(c, [0, -1, -6, -3, -6, 2, 0, 3], SC.bk2);
      gfx.poly(c, [0, -1, 6, -3, 6, 2, 0, 3], SC.bk1);
      gfx.poly(c, [0, -0.2, -5.2, -2.2, -5.2, 1.2, 0, 2.2], lit ? SC.glyphH : SC.pg);
      gfx.poly(c, [0, -0.2, 5.2, -2.2, 5.2, 1.2, 0, 2.2], lit ? SC.glyphH : SC.pg);
      c.fillStyle = lit ? SC.glyph : SC.s3;
      c.fillRect(-4, -1, 3, 0.8);
      c.fillRect(1.2, -1, 3, 0.8);
    } else {
      c.fillStyle = SC.bk1;
      c.fillRect(-3, -3.5, 6, 7);
      c.fillStyle = SC.pg;
      c.fillRect(2, -3, 1.2, 6);
      c.fillStyle = SC.au;
      c.fillRect(-1.5, -1.5, 2, 2);
    }
    c.restore();
  }
  // pose: walk (f 0..3) | wind | toss | read (f 0..1)
  function scholarImg(pose, f) {
    return spr('scholar_' + pose + f, 44, 54, SC_PAL, (c) => {
      c.translate(20, 52);
      const s = pose === 'walk' ? Math.sin((f / 4) * Math.PI * 2) : 0;
      const bob = pose === 'walk' ? Math.abs(s) * 0.8 : 0;
      // shuffling feet
      c.fillStyle = SC.g3;
      c.fillRect(Math.round(-4 - s * 3), -2, 5, 2);
      c.fillRect(Math.round(1 + s * 3), -2, 5, 2);
      c.translate(0, bob);
      // the gown, hunched, torn hem
      gfx.poly(c, [-2, -35, 6, -34, 8, -23, 9, -5, 7, -1, 5, -3.5, 3, 0, 0.5, -2.5, -2, 0, -4.5, -3, -7, -0.5, -8.5, -4, -7, -19, -5, -30], SC.g2);
      gfx.poly(c, [-2, -35, 1, -34.5, -1.5, -22, -3, -3, -4.5, -3, -7, -0.5, -8.5, -4, -7, -19, -5, -30], SC.g3);
      gfx.limb(c, 4, -24, 6, -5, 1, SC.g1);
      gfx.limb(c, 1, -22, 1.5, -4, 0.9, SC.g1);
      // back arm in a bell sleeve
      gfx.poly(c, [-1, -31, -5, -22, -1.5, -20.5, 2, -29], SC.g3);
      // crimson academic hood draped over the back, stole down the front
      gfx.poly(c, [-4.5, -34.5, 1, -35.5, 0, -29, -3, -25.5, -6, -28], SC.hoodD);
      gfx.poly(c, [-3.5, -34.5, 0.5, -35.2, -0.5, -30, -3, -28], SC.hood);
      gfx.poly(c, [2, -35, 6, -34, 7.4, -24, 5.6, -23.6], SC.hood);
      gfx.limb(c, 6, -33.6, 7.2, -24.4, 0.9, SC.au);
      // head: gaunt, spectacles, scraggly beard
      const hx = pose === 'read' ? 9 : 8, hy = pose === 'read' ? -35 : -37;
      gfx.ellipse(c, hx, hy, 3.6, 4.2, 0.2, SC.s2);
      gfx.ellipse(c, hx + 0.8, hy - 0.4, 2.6, 3.4, 0.2, SC.s1);
      gfx.poly(c, [hx + 3, hy - 1, hx + 5.4, hy + 1.2, hx + 3, hy + 1.6], SC.s1);
      gfx.poly(c, [hx - 1, hy + 2.5, hx + 3.6, hy + 2.6, hx + 3, hy + 7, hx + 1.5, hy + 5.4, hx, hy + 7.5, hx - 1, hy + 4.5], SC.beard);
      c.fillStyle = SC.s3;
      c.fillRect(Math.round(hx + 1), Math.round(hy + 1.6), 2, 1);
      // round spectacles
      c.fillStyle = SC.cap;
      c.fillRect(Math.round(hx + 1), Math.round(hy - 1.6), 3, 3);
      c.fillStyle = SC.lens;
      c.fillRect(Math.round(hx + 2), Math.round(hy - 0.6), 1, 1);
      // mortarboard with a golden tassel
      gfx.ellipse(c, hx - 0.5, hy - 3.2, 3.8, 1.8, 0.2, SC.cap);
      gfx.poly(c, [hx - 6, hy - 5.2, hx + 4.5, hy - 6.4, hx + 6.5, hy - 5, hx - 4, hy - 3.8], SC.cap);
      gfx.limb(c, hx - 1, hy - 5.6, hx - 5, hy - 2, 0.9, SC.au);
      c.fillStyle = SC.au;
      c.fillRect(Math.round(hx - 6), Math.round(hy - 2), 2, 3);
      // front arm & book
      if (pose === 'walk') {
        gfx.poly(c, [3, -31, 9, -26, 7, -22, 2, -27], SC.g1);
        gfx.circle(c, 9.5, -24, 1.5, SC.s1);
        scholarBook(c, 11, -25, 0.25, false);
      } else if (pose === 'wind') {
        const r = f ? 1.5 : 0;
        gfx.poly(c, [3, -31, 0 - r * 0.5, -38 - r, -2.5 - r * 0.5, -36 - r, 1, -29], SC.g1);
        gfx.circle(c, -1 - r * 0.5, -40 - r, 1.5, SC.s1);
        scholarBook(c, -2.5 - r * 0.5, -42.5 - r, -0.6 - r * 0.1, false);
      } else if (pose === 'toss') {
        gfx.poly(c, [3, -31, 11, -33, 11, -30, 3, -28], SC.g1);
        gfx.circle(c, 13, -32, 1.5, SC.s1);
      } else {
        gfx.poly(c, [3, -31, 8, -27, 7, -24, 2, -27], SC.g1);
        gfx.circle(c, 9, -26, 1.5, SC.s1);
        scholarBook(c, 12, -28, -0.15, true, f === 1);
      }
    });
  }
  function bookImg(k) {
    return spr('scholar_bk' + k, 12, 12, SC_PAL, (c) => {
      c.translate(6, 6);
      c.rotate((k * Math.PI) / 4);
      scholarBook(c, 0, 0, 0, false);
    });
  }
  function glyphImg(k) {
    return gfx.sprite('scholar_gl' + k, 14, 14, (c) => {
      c.translate(7, 7);
      c.rotate((k * Math.PI) / 8);
      c.strokeStyle = SC.glyph;
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(0, 0, 5, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = SC.glyphH;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        c.fillRect(Math.round(Math.cos(a) * 5 - 1), Math.round(Math.sin(a) * 5 - 1), 2, 2);
      }
      c.fillRect(-1, -3, 2, 6);
      c.fillRect(-3, -1, 6, 2);
    }, { palette: [SC.glyph, SC.glyphH], threshold: 90 });
  }
  def('scholar_ghoul', {
    name: N('Scholar Ghoul', 'Necrófago erudito'),
    desc: N('A tutor of the castle who died with an unfinished thesis. It still lectures, and still throws books at those who interrupt.', 'Un preceptor del castillo que murió con su tesis sin terminar. Aún imparte lecciones y sigue lanzando libros a quien lo interrumpe.'),
    area: 'library', hp: 48, atk: 26, def: 2, exp: 18, w: 14, h: 38, gold: [15, 55],
    el: 'hit', weak: ['fire', 'holy'], blood: '#5a6a40',
    drops: [{ id: 'bread', p: 0.06 }, { id: 'spectacles', p: 0.012 }],
    init(e) {
      e.setState('walk');
      e.cool = 50 + e.rnd.int(0, 50);
    },
    ai(e, g) {
      const st = e.state, p = e.player;
      if (st === 'walk') {
        const d = e.dxp();
        const want = Math.abs(d) < 50 ? -U.sign(d) : Math.abs(d) > 104 ? U.sign(d) : 0;
        e.vx = want && canStep(e, g, want) ? want * 0.38 : 0;
        e.face();
        if (--e.cool <= 0 && Math.abs(d) < 220 && Math.abs(e.dyp()) < 90) {
          e.face();
          e.setState(e.rnd.chance(0.35) ? 'read' : 'wind');
          if (e.state === 'read') sfx('page_flutter', 0.5, 0.7);
        }
      } else if (st === 'wind') {
        e.vx = 0;
        if (e.stT >= 18) {
          const d = e.dxp();
          e.shoot({ x: e.cx + e.facing * 2, y: e.y - 2, vx: U.clamp(d / 58, -2.8, 2.8), vy: -3.7, grav: 0.13, w: 9, h: 9, life: 200, el: 'hit', drawFn: (q, ctx, sx, sy) => ctx.drawImage(bookImg(Math.floor(q.t / 3) % 8), sx - 6, sy - 6), onWall: (q) => G.fx.burst(q.cx, q.cy, '#f0e6c8', 6, 1.2) });
          sfx('swing_light', 0.5, 0.8);
          e.setState('toss');
        }
      } else if (st === 'toss') {
        if (e.stT >= 16) {
          e.setState('walk');
          e.cool = 55 + e.rnd.int(0, 45);
        }
      } else if (st === 'read') {
        e.vx = 0;
        if (e.stT === 10) sfx('magic_cast', 0.45, 0.7);
        if (e.stT > 10 && e.stT % 5 === 0) G.fx.particle(e.cx + e.facing * 12 + U.rnd(-3, 3), e.y + 12, U.rnd(-0.2, 0.2), -0.6, '#d0a0ff', 22, { glow: true });
        if (e.stT >= 44) {
          const a = Math.atan2(p.cy - 4 - (e.y + 12), p.cx - (e.cx + e.facing * 12));
          e.shoot({ x: e.cx + e.facing * 12, y: e.y + 12, vx: Math.cos(a) * 2.1, vy: Math.sin(a) * 2.1, w: 10, h: 10, life: 220, el: 'dark', magic: true, color: SC.glyph,
            drawFn: (q, ctx, sx, sy) => {
              glow(ctx, sx, sy, 7, SC.glyph, 0.35);
              ctx.drawImage(glyphImg(Math.floor(q.t / 3) % 8), sx - 7, sy - 7);
              G.gfx.addLight(sx, sy, 36, SC.glyph, 0.8);
            } });
          sfx('magic_cast', 0.6, 1.2);
          e.setState('toss');
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      let img;
      if (st === 'wind') img = scholarImg('wind', Math.floor(e.stT / 5) % 2);
      else if (st === 'toss') img = scholarImg('toss', 0);
      else if (st === 'read') img = scholarImg('read', e.stT > 10 && e.stT % 8 < 4 ? 1 : 0);
      else img = scholarImg('walk', Math.abs(e.vx) > 0.05 ? Math.floor(e.t / 10) % 4 : 0);
      e.blit(ctx, img, sx, sy, 20, 52, e.facing < 0);
      if (st === 'read' && e.stT > 10) {
        // the spell glyph forms in front of the open book
        const r = Math.min(1, (e.stT - 10) / 30);
        const gx = sx + e.facing * 13, gy = sy - 27;
        glow(ctx, gx, gy, 3 + r * 5, SC.glyph, 0.45);
        if (r > 0.3) ctx.drawImage(glyphImg(Math.floor(e.t / 3) % 8), Math.round(gx - 7), Math.round(gy - 7));
        if (!e.preview) G.gfx.addLight(gx, gy, 30 + r * 20, SC.glyph, 0.8);
      }
    },
  });

  // ================================================================== CANDLE IMP (library)
  const CI = { w1: '#f8f0da', w2: '#dccba2', w3: '#ac986c', w4: '#6c5838', eye: '#2a1206', ember: '#ff8a28', emberH: '#ffe070', br: '#d4a446', brD: '#7a5420' };
  const CI_PAL = Object.values(CI);
  const FLAME_PAL = ['#fffbe0', '#ffd848', '#ff8c20', '#d43a10'];
  // pose: idle (f 0..1) | crouch | air | land
  function impImg(pose, f) {
    return spr('cimp_' + pose + f, 28, 32, CI_PAL, (c) => {
      c.translate(14, 31);
      const sq = { idle: 1, crouch: 0.8, air: 1.12, land: 0.74 }[pose];
      c.scale(1 / Math.sqrt(sq), sq);
      const arm = pose === 'air' ? -3 : pose === 'idle' ? (f ? -1 : 1) : 2;
      // stubby legs
      gfx.limb(c, -2.6, -5, -3.2, -0.6, 3, CI.w3);
      gfx.limb(c, 2.6, -5, 3.2, -0.6, 3, CI.w2);
      // back arm
      gfx.limb(c, -4.5, -11, -7.5, -8 + arm, 2.4, CI.w3);
      // candle-stub body with a melted rim and drips
      gfx.poly(c, [-5, -4, 5, -4, 5.4, -14, 3, -16.5, -3, -16.5, -5.4, -14], CI.w2);
      gfx.poly(c, [0.5, -4, 5, -4, 5.4, -14, 3, -16.5, 0.5, -16.5], CI.w1);
      gfx.poly(c, [-5, -4, -3.2, -4, -3.6, -15, -5.4, -14], CI.w3);
      gfx.poly(c, [-6, -14.5, -3.5, -17, 3.5, -17, 6, -14.5, 5, -12.6, 3.6, -14, 2.4, -11.6, 1, -14, -1.2, -12.2, -2.6, -14, -4.2, -11.2, -5.2, -13.4], CI.w1);
      c.fillStyle = CI.w3;
      c.fillRect(-4.5, -11.5, 1, 3);
      c.fillRect(2.2, -11, 1, 4);
      c.fillRect(4.4, -12, 1, 2);
      // carved face: glowing eye holes and a jagged grin
      c.fillStyle = CI.eye;
      c.fillRect(-2.5, -12.5, 3, 3);
      c.fillRect(2, -12.5, 3, 3);
      c.fillRect(-2, -8, 6, 2);
      c.fillStyle = CI.ember;
      c.fillRect(-1.5, -11.5, 2, 2);
      c.fillRect(3, -11.5, 2, 2);
      c.fillRect(-1, -8, 1, 1);
      c.fillRect(1, -7, 1, 1);
      c.fillRect(3, -8, 1, 1);
      c.fillStyle = CI.emberH;
      c.fillRect(-1, -11, 1, 1);
      c.fillRect(3.5, -11, 1, 1);
      // brass drip-dish worn around the waist
      gfx.ellipse(c, 0, -4.2, 7, 2, 0, CI.brD);
      gfx.ellipse(c, 0, -4.9, 6.4, 1.3, 0, CI.br);
      c.fillStyle = CI.w1;
      c.fillRect(-3, -5.6, 2, 1);
      c.fillRect(2, -5.4, 1, 1);
      // front arm
      gfx.limb(c, 4.5, -11, 7.5, -8 + arm, 2.4, CI.w1);
      // wick
      gfx.limb(c, 0, -16.5, 0.5, -19.5, 1.2, CI.w4);
    });
  }
  function flameImg(k, size) {
    return gfx.sprite('cimp_fl' + size + k, 20, 24, (c) => {
      c.translate(10, 23);
      const s = size || 1;
      c.scale(s, s);
      const sw = [0, 1.2, -1, 0.6][k], h = [15, 17, 14, 16][k];
      const tear = (w, hh, col, dy) => {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(-w, -dy);
        c.quadraticCurveTo(-w, -hh * 0.55 - dy, sw, -hh - dy);
        c.quadraticCurveTo(w, -hh * 0.55 - dy, w, -dy);
        c.quadraticCurveTo(0, w * 0.9 - dy, -w, -dy);
        c.fill();
      };
      tear(5, h, FLAME_PAL[3], 1);
      tear(4, h * 0.82, FLAME_PAL[2], 1.5);
      tear(2.8, h * 0.58, FLAME_PAL[1], 2);
      tear(1.4, h * 0.32, FLAME_PAL[0], 2.4);
    }, { palette: FLAME_PAL, threshold: 110 });
  }
  def('candle_imp', {
    name: N('Candle Imp', 'Diablillo de vela'),
    desc: N('Born from the last candle of a vigil nobody came back to snuff out. It hops after warm blood, leaving little fires wherever it lands.', 'Nació de la última vela de un velatorio que nadie volvió a apagar. Persigue la sangre caliente a saltos y deja pequeños fuegos allí donde aterriza.'),
    area: 'library', hp: 24, atk: 24, def: 0, exp: 12, w: 12, h: 16, gold: [5, 30],
    el: 'fire', absorb: ['fire'], weak: ['ice'], noBlood: true, blood: '#f0e2b8', hitSfx: 'hit_flesh', stunTime: 8,
    drops: [{ id: 'heart_jar', p: 0.03 }],
    init(e) {
      e.setState('idle');
      e.wait = 20 + e.rnd.int(0, 30);
    },
    ai(e, g) {
      const st = e.state;
      if (st === 'idle') {
        e.vx = 0;
        if (e.stT >= e.wait && near(e, 210, 100)) {
          e.face();
          e.setState('crouch');
        }
      } else if (st === 'crouch') {
        e.vx = 0;
        if (e.stT >= 10) {
          const d = e.dxp();
          let vx = Math.abs(d) < 14 ? 0 : U.clamp(d / 34, -2.2, 2.2);
          if (vx && !safeHop(e, g, vx, -4.4)) vx = 0;
          e.vx = vx;
          e.vy = -4.4;
          e.setState('air');
          sfx('jump', 0.2, 1.8);
        }
      } else if (st === 'air') {
        if (e.onGround && e.stT > 3) {
          e.vx = 0;
          // a small fire is left where it lands
          e.shoot({ x: e.cx, y: e.fy - 7, vx: 0, vy: 0, w: 10, h: 12, life: 64, wall: false, pierce: true, el: 'fire', dmg: Math.round(e.atk * 0.8), color: '#ff8c20',
            drawFn: (q, ctx, sx, sy) => {
              const k = q.life < 16 ? 0.5 : 0.75;
              ctx.drawImage(flameImg(Math.floor(q.t / 4) % 4, k), Math.round(sx - 10), Math.round(sy + 6 - 23));
              G.gfx.addLight(sx, sy, 30, '#ff9030', 0.7);
            } });
          G.fx.burst(e.cx, e.fy - 2, '#ffb040', 6, 1.4, { glow: true });
          sfx('fireball', 0.3, 1.6);
          e.wait = 14 + e.rnd.int(0, 24);
          e.setState('land');
        }
      } else if (st === 'land') {
        e.vx = 0;
        if (e.stT >= 10) e.setState('idle');
      }
      if (e.t % 9 === 0) G.fx.particle(e.cx + U.rnd(-2, 2), e.y - 10, U.rnd(-0.2, 0.2), -0.7, U.pick(['#ffd060', '#ff8020']), 18, { glow: true });
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      let pose = 'idle', f = Math.floor(e.t / 14) % 2;
      if (st === 'crouch' || st === 'land') pose = st === 'land' ? 'land' : 'crouch';
      else if (st === 'air') pose = 'air';
      const img = impImg(pose, pose === 'idle' ? f : 0);
      e.blit(ctx, img, sx, sy, 14, 31, e.facing < 0);
      // the flame head sits on the wick (offset follows the squash)
      const top = { idle: 19.5, crouch: 15.6, air: 21.8, land: 14.4 }[pose];
      const fl = flameImg(Math.floor(e.t / 5) % 4, 1);
      e.blit(ctx, fl, sx + (e.facing < 0 ? -0.5 : 0.5), sy - top + 1, 10, 23, e.facing < 0);
      if (!e.preview) G.gfx.addLight(sx, sy - top - 6, 64, '#ffa040', 0.95);
    },
  });

  // ================================================================== DROWNED ONE (caverns)
  const DR = {
    t1: '#56c0ac', t2: '#2e8a7c', t3: '#1c5c56', t4: '#0e3434', b1: '#c4e0b8', b2: '#8cb48c',
    f1: '#ee8a68', f2: '#a8463a', eye: '#f2e44a', mouth: '#3a1018', tooth: '#f4f0e0', weed: '#4a7a30', rope: '#8a7a5a',
  };
  const DR_PAL = Object.values(DR);
  // pose: walk (f 0..3) | leap | wind | spit
  function drownedImg(pose, f) {
    return spr('drowned_' + pose + f, 48, 54, DR_PAL, (c) => {
      c.translate(22, 52);
      const s = pose === 'walk' ? Math.sin((f / 4) * Math.PI * 2) : 0;
      const bob = pose === 'walk' ? Math.abs(s) * 0.8 : 0;
      const leap = pose === 'leap';
      const rear = pose === 'wind' ? -0.25 : pose === 'spit' ? 0.2 : leap ? -0.1 : 0.12;
      // legs: short, bent, big webbed feet
      const legs = leap ? [[-6, -6], [3, -4]] : [[-3 - s * 3.5, 0], [2 + s * 3.5, 0]];
      legs.forEach(([fx, fy], i) => {
        const col = i ? DR.t2 : DR.t3;
        gfx.limb(c, i ? 1.5 : -1.5, -17 + bob, fx + (leap ? -1 : 2.5), -9 + bob + fy * 0.4, 3.4, col);
        gfx.limb(c, fx + (leap ? -1 : 2.5), -9 + bob + fy * 0.4, fx, -2 + fy, 3, col);
        gfx.poly(c, [fx - 2.5, -2.4 + fy, fx + 4.5, -1.6 + fy, fx + 5.5, 0.4 + fy, fx - 3, 0.4 + fy], i ? DR.t2 : DR.t3);
        c.fillStyle = DR.f2;
        c.fillRect(Math.round(fx + 1), Math.round(-1 + fy), 3, 1);
      });
      c.save();
      c.translate(0, -17 + bob);
      c.rotate(rear);
      // dorsal fin from the crown down the back
      gfx.poly(c, [3, -27, -1, -30, -4, -24, -7, -25, -7.5, -18, -10, -17, -8, -8, -5, -12, -3, -22], DR.f2);
      gfx.poly(c, [2, -26, -1, -29, -3.5, -23.5, -6.5, -24, -6.8, -18, -9, -16.5, -6.5, -10, -3.5, -21], DR.f1);
      gfx.limb(c, -1, -29, -3, -21, 0.8, DR.f2);
      gfx.limb(c, -6.5, -24.5, -5, -15, 0.8, DR.f2);
      // back arm
      const armB = leap ? [-8, -24] : pose === 'wind' ? [-9, -10] : [-3 + s * 2, -2];
      gfx.limb(c, -2, -14, (armB[0] - 2) * 0.6, (armB[1] - 14) * 0.6 - 3, 2.6, DR.t3);
      gfx.limb(c, (armB[0] - 2) * 0.6, (armB[1] - 14) * 0.6 - 3, armB[0], armB[1], 2.3, DR.t3);
      // torso: hunched, scaled back, pale belly
      gfx.poly(c, [-6, 0, 5, 0, 7.5, -12, 6, -21, -1, -24, -6.5, -16], DR.t2);
      gfx.poly(c, [1.5, 0, 5, 0, 7.5, -12, 6, -19, 2.5, -13], DR.b1);
      gfx.poly(c, [3.5, -1, 5, -1, 7, -11, 5.5, -11], DR.b2);
      gfx.poly(c, [-6, 0, -3, 0, -3.5, -15, -6.5, -16], DR.t3);
      for (let i = 0; i < 3; i++) {
        c.fillStyle = DR.t1;
        c.fillRect(-3 + (i % 2), -19 + i * 5, 2, 1);
        c.fillRect(0 + (i % 2), -17 + i * 5, 2, 1);
      }
      // rope belt with seaweed
      gfx.limb(c, -6, -2.5, 6, -2, 1.4, DR.rope);
      gfx.limb(c, -5, -2, -7, 4, 1.2, DR.weed);
      gfx.limb(c, -3, -2, -3.6, 3, 1, DR.weed);
      // fish head: no neck, wide lipped mouth, round eye, gills
      const open = pose === 'spit' ? 3.5 : pose === 'wind' ? 0 : 0.8;
      gfx.poly(c, [-2, -21, 4, -29, 10, -27, 13, -22, 12.5, -19.5 - open * 0.3, 5, -18.5, 1, -15], DR.t2);
      gfx.poly(c, [3, -28.5, 9.5, -27, 12, -23.5, 6, -24], DR.t1);
      gfx.poly(c, [4.5, -18.5, 12.5, -19.5, 12, -17 + open * 0.6, 5, -16 + open * 0.3], DR.b1);
      if (open > 1) {
        gfx.poly(c, [7, -19.6, 13, -19.6, 13, -17 + open * 0.5, 7, -17.5], DR.mouth);
        c.fillStyle = DR.tooth;
        c.fillRect(9, -19.6, 1, 1);
        c.fillRect(11, -19.6, 1, 1);
        c.fillRect(10, -17.2 + open * 0.4, 1, 1);
      } else gfx.limb(c, 6, -19.6, 13, -20, 0.9, DR.t4);
      if (pose === 'wind') gfx.ellipse(c, 8, -16.5 + f * 0.4, 4 + f * 0.8, 2.4 + f * 0.6, 0, DR.b1); // puffed throat
      gfx.circle(c, 7.5, -24.5, 2.3, DR.eye);
      c.fillStyle = DR.t4;
      c.fillRect(8, -25, 1.4, 1.4);
      gfx.limb(c, 2, -21, 3, -17.5, 0.8, DR.t4);
      gfx.limb(c, 0.5, -20.5, 1.5, -17, 0.8, DR.t4);
      // seaweed draped over the shoulder
      gfx.poly(c, [-1, -21, 2, -22, 1, -15, -0.5, -10, -1.5, -14], DR.weed);
      // front arm with a forearm fin and webbed claws
      const armF = leap ? [10, -27] : pose === 'wind' ? [-4, -9] : pose === 'spit' ? [12, -12] : [5 - s * 2, -1];
      const ex = (armF[0] + 3) * 0.55, ey = (armF[1] - 14) * 0.55 - 2;
      gfx.limb(c, 3, -14, ex, ey, 2.8, DR.t2);
      gfx.limb(c, ex, ey, armF[0], armF[1], 2.5, DR.t2);
      gfx.poly(c, [ex, ey, ex - 1.5, ey + 4, (ex + armF[0]) / 2 - 1, (ey + armF[1]) / 2 + 2], DR.f1);
      c.fillStyle = DR.tooth;
      c.fillRect(Math.round(armF[0]), Math.round(armF[1]), 1, 2);
      c.fillRect(Math.round(armF[0] + 1.5), Math.round(armF[1] + 0.5), 1, 2);
      c.restore();
    });
  }
  function waterOrb(q, ctx, sx, sy) {
    const r = 4 + (q.t % 10 < 5 ? 0 : 0.5);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#2a7ac8';
    ctx.beginPath();
    ctx.arc(sx, sy, r + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6ac0f4';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8f8ff';
    ctx.fillRect(Math.round(sx - 2), Math.round(sy - 2), 2, 2);
    ctx.restore();
    G.gfx.addLight(sx, sy, 24, '#60b0ff', 0.5);
  }
  // water surface (top of the water column) above a point, or null
  function waterSurface(room, x, y) {
    const T = G.T;
    let tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    if (room.get(tx, ty) !== T.WATER) return null;
    while (ty > 0 && room.get(tx, ty - 1) === T.WATER) ty--;
    return ty * TS;
  }
  function feetInWater(e, g) {
    return g.room.get(Math.floor(e.cx / TS), Math.floor((e.fy - 3) / TS)) === G.T.WATER;
  }
  def('drowned_one', {
    name: N('Drowned One', 'Ahogado'),
    desc: N('Sailors swallowed by the underground lake did not stay dead; the water changed them. They spring from the dark pools to drag the living down.', 'Los marineros que se tragó el lago subterráneo no siguieron muertos: el agua los transformó. Saltan de las pozas oscuras para arrastrar a los vivos al fondo.'),
    area: 'caverns', hp: 70, atk: 40, def: 4, exp: 40, w: 16, h: 38, gold: [30, 120],
    el: 'hit', weak: ['thunder'], resist: ['ice'], blood: '#3a8a70',
    drops: [{ id: 'high_potion', p: 0.03 }, { id: 'sapphire_ring', p: 0.01 }],
    previewState: 'walk',
    init(e, g) {
      e.water = null;
      e.cool = 30;
      e.walkT = 60;
      let sub = false;
      const room = g && g.room;
      if (room && room.hasWater) {
        const T = G.T, tx0 = Math.floor(e.cx / TS), ty0 = Math.floor((e.fy - 4) / TS);
        let bd = 1e9;
        for (let ty = ty0 - 6; ty <= ty0 + 6; ty++)
          for (let tx = tx0 - 16; tx <= tx0 + 16; tx++) {
            if (room.get(tx, ty) !== T.WATER || room.get(tx, ty - 1) === T.WATER) continue;
            const d = Math.abs(tx - tx0) + Math.abs(ty - ty0) * 1.5;
            if (d < bd) {
              bd = d;
              e.water = { x: tx * TS + 8, y: ty * TS };
            }
          }
        sub = room.get(tx0, ty0) === T.WATER;
      }
      if (sub) {
        e.setState('sub');
        e.alpha = 0.2;
        e.active = false;
      } else e.setState('walk');
    },
    ai(e, g) {
      const st = e.state, room = g.room;
      if (st === 'sub') {
        e.vx = 0;
        e.active = false;
        e.alpha = U.approach(e.alpha, 0.2, 0.05);
        const sy = waterSurface(room, e.cx, e.fy - 3);
        if (sy != null && e.t % 46 === 0) G.fx.particle(e.cx + U.rnd(-5, 5), sy + 2, 0, -0.4, '#bfe8ff', 26, { size: 2 });
        if (--e.cool <= 0 && Math.abs(e.dxp()) < 150 && e.dyp() < 40 && e.dyp() > -150) {
          // burst out of the water in an arc that comes down on the player
          const top = sy != null ? sy : e.fy;
          const pf = e.player.fy;
          const rise = Math.max(40, e.fy - (top - 58), e.fy - pf + 40);
          const vy = -Math.min(10, Math.sqrt(2 * 0.3 * rise));
          const air = (-vy + Math.sqrt(Math.max(0, vy * vy + 0.6 * (pf - e.fy)))) / 0.3;
          e.vy = vy;
          e.face();
          e.vx = U.clamp(e.dxp() / Math.max(12, air), -2.6, 2.6);
          e.alpha = 1;
          e.active = true;
          G.fx.burst(e.cx, top, '#a8dcff', 16, 2.4);
          for (let i = 0; i < 8; i++) G.fx.particle(e.cx + U.rnd(-6, 6), top, U.rnd(-1.4, 1.4), U.rnd(-3.5, -1.5), '#6ab8f0', 30, { grav: 0.18, size: 2 });
          sfx('water_splash', 0.7);
          e.setState('leap');
        }
      } else if (st === 'leap' || st === 'ret') {
        if (e.onGround && e.stT > 6) {
          if (feetInWater(e, g)) {
            const sy = waterSurface(room, e.cx, e.fy - 3);
            G.fx.burst(e.cx, sy != null ? sy : e.fy, '#a8dcff', 12, 2);
            sfx('water_splash', 0.5, 1.2);
            e.cool = 90 + e.rnd.int(0, 60);
            e.setState('sub');
          } else {
            G.fx.dust(e.cx, e.fy, 3);
            e.vx = 0;
            e.walkT = 40 + e.rnd.int(0, 40);
            e.setState('walk');
          }
        }
      } else if (st === 'walk') {
        e.face();
        e.vx = Math.abs(e.dxp()) > 26 && canStep(e, g, e.facing) ? e.facing * 0.55 : 0;
        if (feetInWater(e, g) && e.onGround) {
          e.cool = 60;
          e.setState('sub');
        } else if (e.stT >= e.walkT && e.onGround) e.setState('wind');
      } else if (st === 'wind') {
        e.vx = 0;
        e.face();
        if (e.stT === 1) sfx('slime', 0.45, 0.8);
        if (e.stT >= 20) {
          const ox = e.cx + e.facing * 12, oy = e.y + 6;
          const a = Math.atan2(e.player.cy - 4 - oy, e.player.cx - ox);
          e.shoot({ x: ox, y: oy, vx: Math.cos(a) * 2.7, vy: Math.sin(a) * 2.7, grav: 0.02, w: 9, h: 9, life: 160, el: 'hit', color: '#6ac0f4', drawFn: waterOrb,
            onWall: (q) => { G.fx.burst(q.cx, q.cy, '#9ad8ff', 8, 1.4); } });
          sfx('water_splash', 0.4, 1.6);
          e.setState('spit');
        }
      } else if (st === 'spit') {
        e.vx = 0;
        if (e.stT >= 18) {
          if (e.water && e.rnd.chance(0.65) && Math.abs(e.water.x - e.cx) < 150) {
            // ballistic hop that clears the rim and comes down on the water surface
            e.facing = e.water.x < e.cx ? -1 : 1;
            const h = Math.max(28, e.fy - e.water.y + 30);
            const vy = -Math.min(8.5, Math.sqrt(2 * 0.3 * h));
            const drop = e.water.y + 10 - e.fy;
            const air = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * 0.3 * drop))) / 0.3;
            e.vx = U.clamp((e.water.x - e.cx) / Math.max(10, air), -3, 3);
            e.vy = vy;
            e.setState('ret');
          } else {
            e.walkT = 50 + e.rnd.int(0, 40);
            e.setState('walk');
          }
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      let img;
      if (st === 'leap' || st === 'ret') img = drownedImg('leap', 0);
      else if (st === 'wind') img = drownedImg('wind', Math.floor(e.stT / 4) % 2);
      else if (st === 'spit') img = drownedImg('spit', 0);
      else img = drownedImg('walk', st === 'walk' && Math.abs(e.vx) > 0.05 ? Math.floor(e.t / 9) % 4 : 0);
      e.blit(ctx, img, sx, sy, 22, 52, e.facing < 0);
      if (st === 'wind' && e.stT > 8) glow(ctx, sx + e.facing * 10, sy - 33, 2 + (e.stT % 4 < 2 ? 1 : 0), '#9ad8ff', 0.7);
    },
  });

  // ================================================================== CAVE TOAD (caverns)
  const TD = {
    p1: '#a07890', p2: '#7a5068', p3: '#563648', p4: '#341e2c', y1: '#d8c290', y2: '#a88e62',
    eye: '#f2c234', eyeD: '#a87a10', tg1: '#ec7898', tg2: '#a83e5c', mouth: '#2a0e18', stone: '#8a8478',
  };
  const TD_PAL = Object.values(TD);
  // pose: sit (f 0..1) | crouch | air | open | puff
  function toadImg(pose, f) {
    return spr('toad_' + pose + f, 66, 46, TD_PAL, (c) => {
      c.translate(30, 44);
      const air = pose === 'air';
      const by = pose === 'crouch' ? 2.5 : air ? -2 : 0; // body offset (legs stay planted)
      // back leg: folded haunch, or kicked out in the air
      if (air) {
        gfx.limb(c, -10, -12, -19, -8, 6, TD.p3);
        gfx.limb(c, -19, -8, -24.5, -3.5, 4, TD.p3);
        gfx.poly(c, [-24.5, -5.5, -29, -3.5, -28.4, -1.4, -23.5, -2], TD.p4);
      } else {
        gfx.ellipse(c, -11, -8 + by * 0.6, 9.5 + by * 0.4, 7.5 - by * 0.4, 0.1, TD.p3);
        gfx.ellipse(c, -12, -10 + by * 0.6, 6, 4, 0.1, TD.p2);
        gfx.poly(c, [-8, -2.5, 2, -2.5, 4, 0.4, -9, 0.4], TD.p4);
        c.fillStyle = TD.y2;
        c.fillRect(2, -1, 2, 1);
      }
      c.save();
      c.translate(0, by);
      // body
      gfx.ellipse(c, -1, -13, 16, 10.5, -0.1, TD.p2);
      gfx.ellipse(c, -3, -17, 11, 5, -0.1, TD.p1);
      gfx.ellipse(c, 4, -6.5, 11, 4.5, -0.05, TD.y1);
      gfx.ellipse(c, 2, -5, 8, 2.4, -0.05, TD.y2);
      // warts
      [[-10, -18], [-5, -21], [-13, -13], [0, -20], [-7, -14], [4, -18], [-2, -15], [-15, -16]].forEach(([x, y], i) => {
        c.fillStyle = i % 2 ? TD.p1 : TD.p3;
        c.fillRect(x, y, 2, 2);
        if (i % 2) {
          c.fillStyle = TD.p4;
          c.fillRect(x + 1, y + 1, 1, 1);
        }
      });
      // head, wide lipped mouth
      gfx.ellipse(c, 10, -14, 9, 7, -0.15, TD.p2);
      gfx.ellipse(c, 11, -17, 6, 3, -0.15, TD.p1);
      c.fillStyle = TD.p4;
      c.fillRect(17, -16, 1, 1);
      if (pose === 'open') {
        gfx.poly(c, [6, -12, 19.5, -13.5, 20, -7.5, 7, -8], TD.mouth);
        gfx.poly(c, [8, -11, 18.5, -12.5, 18.5, -10.4, 9, -10], TD.tg2);
        gfx.limb(c, 7, -8, 19.5, -7.8, 1, TD.y2);
      } else {
        gfx.limb(c, 6, -11.6, 18.6, -13, 1.1, TD.p4);
        gfx.limb(c, 7, -10.6, 18, -11.8, 0.8, TD.y2);
      }
      c.restore();
      // front leg
      if (air) gfx.limb(c, 12, -8 + by, 18, -4 + by, 3.4, TD.p3);
      else {
        gfx.limb(c, 11, -9 + by, 13, -2, 3.6, TD.p3);
        gfx.poly(c, [10, -2.4, 17, -1.8, 17.5, 0.4, 10, 0.4], TD.p4);
      }
      c.save();
      c.translate(0, by);
      // throat sac under the jaw (swells before the tongue, bulges around a swallowed stone)
      const sac = pose === 'puff' ? (f ? [7.4, 5.4] : [6.6, 4.8]) : pose === 'open' ? [3, 1.8] : f ? [4.4, 2.7] : [3.6, 2.2];
      gfx.ellipse(c, 15, -8.5 + sac[1] * 0.45, sac[0], sac[1], 0, TD.y1);
      if (pose === 'puff') {
        gfx.ellipse(c, 14, -7.5, sac[0] * 0.6, sac[1] * 0.5, 0, TD.y2);
        c.fillStyle = TD.p1;
        c.fillRect(17, -9, 2, 1);
      }
      // bulging eye with a slit pupil
      gfx.circle(c, 10, -21, 4.2, TD.p3);
      gfx.circle(c, 10.6, -21.6, 3.1, TD.eye);
      c.fillStyle = TD.p4;
      c.fillRect(9, -21.5, 4, 1);
      c.fillStyle = TD.eyeD;
      c.fillRect(9, -20, 4, 1);
      c.fillStyle = TD.p2;
      c.fillRect(8, -24.5, 5, 1.4);
      c.fillStyle = '#ffffff';
      c.fillRect(12, -23, 1, 1);
      c.restore();
    });
  }
  function stoneImg(k) {
    return spr('toad_st' + k, 12, 12, [TD.stone, '#5a564e', '#b8b2a4'], (c) => {
      c.translate(6, 6);
      c.rotate(k * 0.8);
      gfx.poly(c, [-4, -2, -1, -4, 3, -3, 4.5, 1, 1, 4, -3, 3], '#5a564e');
      gfx.poly(c, [-3, -2, -1, -3.2, 2.5, -2.5, 3.5, 0.5, 0, 2, -2.5, 1.5], TD.stone);
      c.fillStyle = '#b8b2a4';
      c.fillRect(-1, -2, 2, 1);
    });
  }
  def('cave_toad', {
    name: N('Cave Toad', 'Sapo de caverna'),
    desc: N('Fat on blind fish and careless explorers. Its tongue lashes farther than any whip, and it spits back whatever it cannot digest.', 'Engordado a base de peces ciegos y exploradores descuidados. Su lengua azota más lejos que cualquier látigo y escupe lo que no puede digerir.'),
    area: 'caverns', hp: 95, atk: 42, def: 6, exp: 46, w: 36, h: 24, gold: [30, 140],
    el: 'hit', weak: ['cut'], blood: '#7a3a5a',
    drops: [{ id: 'antidote', p: 0.06 }, { id: 'topaz_ring', p: 0.01 }],
    init(e) {
      e.setState('sit');
      e.wait = 40;
      e.tongue = 0;
      e.stone = false;
    },
    ai(e, g) {
      const st = e.state;
      const d = e.dxp(), ahead = d * e.facing > 0;
      if (st === 'sit') {
        e.vx = 0;
        e.tongue = 0;
        if (e.stT >= e.wait) {
          e.face();
          const ad = Math.abs(d);
          if (ad < 92 && Math.abs(e.dyp()) < 34) e.setState('tw');
          else if (ad > 100 && ad < 240 && !e.stone && e.rnd.chance(0.5)) e.setState('scoop');
          else if (e.stone && ad < 240) e.setState('puff');
          else if (near(e, 260, 120)) e.setState('crouch');
          else e.wait = e.stT + 30;
        }
      } else if (st === 'crouch') {
        e.vx = 0;
        if (e.stT >= 10) {
          let vx = e.facing * 1.9;
          if (!safeHop(e, g, vx, -4.6)) vx = 0;
          e.vx = vx;
          e.vy = -4.6;
          e.setState('air');
        }
      } else if (st === 'air') {
        if (e.onGround && e.stT > 3) {
          e.vx = 0;
          G.fx.dust(e.cx, e.fy, 6);
          G.gfx.shake(2, 6);
          sfx('stomp', 0.5, 0.8);
          e.wait = 20 + e.rnd.int(0, 30);
          e.setState('sit');
        }
      } else if (st === 'tw') {
        e.vx = 0;
        if (e.stT === 1) sfx('slime', 0.6, 0.6);
        if (e.stT >= 24) {
          e.setState('lash');
          sfx('whip', 0.6, 0.7);
        }
      } else if (st === 'lash') {
        // tongue: out in 6 frames, hold 6, back in 14
        const t = e.stT;
        e.tongue = t <= 6 ? (t / 6) * 72 : t <= 12 ? 72 : Math.max(0, 72 * (1 - (t - 12) / 14));
        const mx = e.cx + e.facing * 16, my = e.fy - 12;
        if (e.tongue > 6) strike(e, e.facing > 0 ? mx : mx - e.tongue, my - 3, e.tongue, 6);
        if (t >= 26) {
          e.tongue = 0;
          e.wait = 40 + e.rnd.int(0, 30);
          e.setState('sit');
        }
      } else if (st === 'scoop') {
        e.vx = 0;
        if (e.stT === 14) {
          sfx('slime', 0.5, 0.4);
          G.fx.dust(e.cx + e.facing * 16, e.fy, 3);
        }
        if (e.stT >= 26) {
          e.stone = true;
          e.wait = 16;
          e.setState('sit');
        }
      } else if (st === 'puff') {
        e.vx = 0;
        e.face();
        if (e.stT >= 26) {
          const ox = e.cx + e.facing * 18, oy = e.fy - 12;
          e.shoot({ x: ox, y: oy, vx: U.clamp(d / 52, -3.4, 3.4), vy: -3.6, grav: 0.2, w: 9, h: 9, life: 200, el: 'hit', dmg: Math.round(e.atk * 1.1),
            drawFn: (q, ctx, sx, sy) => ctx.drawImage(stoneImg(Math.floor(q.t / 4) % 8), sx - 6, sy - 6),
            onWall: (q) => {
              G.fx.debris(q.cx, q.cy, '#8a8478', 6);
              sfx('stomp', 0.3, 1.6);
            } });
          sfx('swing_heavy', 0.5, 0.7);
          e.stone = false;
          e.wait = 40;
          e.setState('sit');
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      let img;
      if (st === 'crouch' || st === 'scoop') img = toadImg('crouch', 0);
      else if (st === 'air') img = toadImg('air', 0);
      else if (st === 'tw') img = e.stT > 8 ? toadImg('puff', Math.floor(e.stT / 4) % 2) : toadImg('sit', 1);
      else if (st === 'lash') img = toadImg('open', 0);
      else if (st === 'puff' || e.stone) img = toadImg('puff', Math.floor(e.t / (st === 'puff' ? 4 : 16)) % 2);
      else img = toadImg('sit', Math.floor(e.t / 24) % 2);
      e.blit(ctx, img, sx, sy, 30, 44, e.facing < 0);
      if (e.tongue > 1) {
        // the tongue: a fat pink lash with a sticky tip
        const f = e.facing, L = Math.round(e.tongue);
        const x0 = sx + f * 18, y0 = sy - 12;
        ctx.fillStyle = OUT;
        ctx.fillRect(f > 0 ? x0 : x0 - L, y0 - 2, L, 5);
        ctx.fillStyle = TD.tg2;
        ctx.fillRect(f > 0 ? x0 : x0 - L, y0 - 1, L, 3);
        ctx.fillStyle = TD.tg1;
        ctx.fillRect(f > 0 ? x0 : x0 - L, y0 - 1, L, 1);
        const tx = x0 + f * L;
        ctx.fillStyle = OUT;
        ctx.fillRect(tx - 4, y0 - 4, 8, 8);
        ctx.fillStyle = TD.tg2;
        ctx.fillRect(tx - 3, y0 - 3, 6, 6);
        ctx.fillStyle = TD.tg1;
        ctx.fillRect(tx - 2, y0 - 3, 3, 2);
      }
      if (st === 'tw' && e.stT > 10) glow(ctx, sx + e.facing * 10, sy - 21, 1.5, '#fff0a0', 0.8);
    },
  });

  // ================================================================== CRYSTAL CRAWLER (caverns)
  const CC = {
    k1: '#5e6a86', k2: '#3c465c', k3: '#272f40', k4: '#151b26', c1: '#eaffff', c2: '#8af0ff', c3: '#3ac8e8', c4: '#1a7a9a', eye: '#a0ffff',
  };
  const CC_PAL = Object.values(CC);
  function crawlerDraw(c, pose, f, lit) {
    const rear = pose === 'rear', walk = pose === 'walk', curl = pose === 'curl';
    const ph = (f / 4) * Math.PI * 2;
    // legs radiating from the cephalothorax: [knee x, knee y, foot x, phase]
    const LEGS = [[13, -19, 22, 0], [6, -21.5, 9, 2.4], [-1.5, -21, -5, 4.7], [-8.5, -18, -17, 1.2]];
    const FAR = [[10, -17.5, 16, 3.6], [2, -18, 2, 5.9]];
    const leg = (L, i, near) => {
      const sw = walk ? Math.sin(ph + L[3]) * 2.2 : 0;
      const lift = walk ? Math.max(0, Math.cos(ph + L[3])) * 1.8 : 0;
      const hx = 4, hy = -9;
      let kx = L[0] + sw * 0.4, ky = L[1] - lift, fx = L[2] + sw, fy = -lift;
      if (rear && near && i < 2) {
        kx = L[0] + 2;
        ky = L[1] - 7;
        fx = L[2] + 3;
        fy = -24 + i * 3;
      }
      if (curl) {
        kx = hx + (L[0] - hx) * 0.45;
        ky = -19;
        fx = hx + (L[2] - hx) * 0.25;
        fy = -13;
      }
      const col = near ? CC.k2 : CC.k4;
      gfx.limb(c, hx, hy, kx, ky, 1.25, col);
      gfx.limb(c, kx, ky, fx, fy, 1.1, col);
      if (near) {
        c.fillStyle = CC.k1;
        c.fillRect(Math.round(kx - 0.5), Math.round(ky - 0.5), 1, 1);
      }
    };
    FAR.forEach((L, i) => leg(L, i, false));
    c.save();
    if (rear) {
      c.translate(-6, -8);
      c.rotate(-0.28);
      c.translate(6, 8);
    }
    // abdomen with crystal shards, then the head
    gfx.ellipse(c, -5, -10, 8.5, 5.6, -0.12, CC.k2);
    gfx.ellipse(c, -6, -12, 5.6, 2.6, -0.12, CC.k1);
    gfx.ellipse(c, -6, -7.4, 6, 1.6, -0.12, CC.k3);
    const shards = [[-10, -13, -14, -26, 2.6], [-5, -15, -5, -30, 3.2], [0, -14, 4, -25, 2.4], [-7, -14, -10, -21, 1.8]];
    shards.forEach(([x0, y0, x1, y1, w]) => {
      const nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny);
      const ox = (nx / L) * w, oy = (ny / L) * w;
      const mx = x0 + (x1 - x0) * 0.35, my = y0 + (y1 - y0) * 0.35;
      gfx.poly(c, [x0, y0, mx + ox, my + oy, x1, y1, mx - ox, my - oy], lit ? CC.c2 : CC.c4);
      gfx.poly(c, [x0, y0, mx + ox, my + oy, x1, y1], lit ? CC.c1 : CC.c3);
      gfx.limb(c, mx, my, x1, y1, 0.8, lit ? '#ffffff' : CC.c2);
    });
    gfx.ellipse(c, 5.5, -9, 4.6, 3.6, 0.1, CC.k2);
    gfx.ellipse(c, 6, -10.4, 3, 1.5, 0.1, CC.k1);
    c.fillStyle = CC.eye;
    c.fillRect(8, -11, 1, 1);
    c.fillRect(9.5, -10, 1, 1);
    c.fillRect(8.5, -9, 1, 1);
    gfx.limb(c, 9, -7.5, 11.5, -4.5, 1.3, CC.c2);
    gfx.limb(c, 8, -7, 10, -4, 1, CC.c3);
    c.restore();
    LEGS.forEach((L, i) => leg(L, i, true));
  }
  function crawlerImg(pose, f, ceil, lit) {
    return spr('crawler_' + pose + f + (ceil ? 'c' : '') + (lit ? 'l' : ''), 56, 44, CC_PAL, (c) => {
      if (ceil) {
        c.translate(28, 2);
        c.scale(1, -1);
      } else c.translate(28, 40);
      if (pose === 'curl') {
        c.translate(0, -12);
        c.rotate((f * Math.PI) / 2);
        c.translate(0, 12);
      }
      crawlerDraw(c, pose, f, lit);
    });
  }
  function shardImg(k) {
    return spr('crawler_sh' + k, 14, 14, CC_PAL, (c) => {
      c.translate(7, 7);
      c.rotate((k / ANG) * Math.PI * 2);
      gfx.poly(c, [-5, 0, 0, -2.2, 5.5, 0, 0, 2.2], CC.c3);
      gfx.poly(c, [-5, 0, 0, -2.2, 5.5, 0], CC.c1);
      gfx.limb(c, -3, 0, 4.5, 0, 0.8, CC.c2);
    });
  }
  def('crystal_crawler', {
    name: N('Crystal Crawler', 'Rastrero de cristal'),
    desc: N('It feeds on the glowing veins of the caverns until shards sprout from its back. It hangs from the ceiling, waiting for a shadow to pass beneath.', 'Se alimenta de las vetas luminosas de las cavernas hasta que le brotan esquirlas del lomo. Cuelga del techo esperando que una sombra pase por debajo.'),
    area: 'caverns', hp: 60, atk: 40, def: 8, exp: 36, w: 24, h: 14, gold: [25, 100],
    el: 'cut', resist: ['cut'], weak: ['hit'], blood: '#40c8e0', hitSfx: 'hit_bone', stunTime: 8,
    drops: [{ id: 'mana_tonic', p: 0.05 }, { id: 'moon_ring', p: 0.008 }],
    previewState: 'skit',
    init(e, g) {
      e.setState('skit');
      e.runs = 0;
      e.dir = e.facing;
      e.runT = 30;
      e.ceil = false;
      const room = g && g.room;
      if (room) {
        // cling to the ceiling right above the spawn point when there is one
        let ty = Math.floor((e.fy - 1) / TS);
        for (let i = 0; i < 12; i++, ty--) {
          if (P.solidAt(room, e.cx, ty * TS + 8)) {
            const cy = (ty + 1) * TS;
            if (e.fy - cy >= e.h) {
              e.ceil = true;
              e.y = cy;
              e.flying = true;
              e.setState('ceil');
            }
            break;
          }
        }
      }
    },
    // struck while clinging to the ceiling: it lets go
    onHit(e) {
      if (e.state === 'ceil') {
        e.ceil = false;
        e.flying = false;
        e.setState('drop');
      }
    },
    ai(e, g) {
      const st = e.state, room = g.room, p = e.player;
      if (st === 'ceil' && !P.solidAt(room, e.cx, e.y - 4)) {
        // knocked off the edge of its ceiling
        e.ceil = false;
        e.flying = false;
        e.setState('drop');
      } else if (st === 'ceil') {
        const dx = e.dxp();
        if (Math.abs(dx) < 180 && Math.abs(dx) > 6) e.facing = U.sign(dx);
        const ahead = e.facing > 0 ? e.x + e.w + 2 : e.x - 2;
        if (!P.solidAt(room, ahead, e.y - 4) || P.solidAt(room, ahead, e.y + 6)) {
          e.facing *= -1;
          e.vx = 0;
        } else e.vx = e.facing * (Math.abs(dx) < 180 ? 0.7 : 0.35);
        e.vy = 0;
        if (Math.abs(dx) < 20 && p.y > e.fy && p.y - e.fy < 200 && P.los(room, e.cx, e.fy + 2, p.cx, p.y + 4)) {
          e.flying = false;
          e.ceil = false;
          e.vx = 0;
          e.vy = 0.5;
          sfx('magic_cast', 0.4, 2.2);
          e.setState('drop');
        }
      } else if (st === 'drop') {
        if (e.onGround) {
          G.fx.debris(e.cx, e.fy - 4, '#3ac8e8', 6);
          G.gfx.shake(2, 6);
          sfx('stomp', 0.5, 1.3);
          e.face();
          e.setState('land');
        }
      } else if (st === 'land') {
        e.vx = 0;
        if (e.stT >= 14) e.setState('skit');
      } else if (st === 'skit') {
        if (e.stT === 1) {
          const dx = e.dxp();
          e.dir = Math.abs(dx) < 50 ? -U.sign(dx) || 1 : U.sign(dx);
          e.runT = 22 + e.rnd.int(0, 16);
        }
        e.facing = e.dir;
        e.vx = canStep(e, g, e.dir) ? e.dir * 2.2 : 0;
        if (e.stT >= e.runT || !e.vx) {
          e.vx = 0;
          e.runs++;
          e.setState(e.runs >= 2 ? 'aim' : 'pause');
        }
      } else if (st === 'pause') {
        e.vx = 0;
        if (e.stT >= 12) e.setState('skit');
      } else if (st === 'aim') {
        e.vx = 0;
        e.face();
        if (e.stT === 1) sfx('magic_cast', 0.5, 1.9);
        if (e.stT >= 20) {
          const ox = e.cx + e.facing * 4, oy = e.y - 10;
          const a = Math.atan2(p.cy - oy, p.cx - ox);
          e.shoot({ x: ox, y: oy, vx: Math.cos(a) * 3.3, vy: Math.sin(a) * 3.3, w: 8, h: 8, life: 180, el: 'cut', color: CC.c2,
            drawFn: (q, ctx, sx, sy) => {
              glow(ctx, sx, sy, 4, CC.c3, 0.4);
              ctx.drawImage(shardImg(angIdx(Math.atan2(q.vy, q.vx))), sx - 7, sy - 7);
              G.gfx.addLight(sx, sy, 26, CC.c2, 0.6);
            },
            onWall: (q) => G.fx.burst(q.cx, q.cy, CC.c2, 8, 1.6, { glow: true }) });
          sfx('fireball', 0.35, 1.9);
          e.runs = 0;
          e.setState('rec');
        }
      } else if (st === 'rec') {
        e.vx = 0;
        if (e.stT >= 16) e.setState('skit');
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      const lit = st === 'aim' && e.stT > 6;
      if (st === 'ceil') {
        e.blit(ctx, crawlerImg('walk', Math.floor(e.t / 8) % 4, true, false), sx, sy - e.h, 28, 2, e.facing < 0);
      } else if (st === 'drop') {
        e.blit(ctx, crawlerImg('curl', Math.floor(e.stT / 5) % 4, false, false), sx, sy, 28, 40, e.facing < 0);
      } else {
        const pose = st === 'aim' ? 'rear' : 'walk';
        const f = pose === 'walk' && Math.abs(e.vx) > 0.1 ? Math.floor(e.t / 3) % 4 : 0;
        e.blit(ctx, crawlerImg(pose, f, false, lit), sx, sy, 28, 40, e.facing < 0);
      }
      const ly = e.state === 'ceil' ? sy - e.h + 14 : sy - 16;
      if (!e.preview) G.gfx.addLight(sx, ly, lit ? 70 : 46, CC.c2, lit ? 1 : 0.65);
      if (lit) glow(ctx, sx - e.facing * 4, sy - 22, 4 + (e.stT % 4), CC.c2, 0.35);
    },
  });

  // ================================================================== COG IMP (clock tower)
  const CG = {
    b1: '#f4cc66', b2: '#c8963a', b3: '#8a5e22', b4: '#4e3010', i1: '#a4a6b2', i2: '#62646f', i3: '#30313a',
    eye: '#ffd848', eyeR: '#ff7020', cu: '#c46a40', steam: '#e4e8f0',
  };
  const CG_PAL = Object.values(CG);
  // pose: stand | crouch | air | wind | throw
  function cogImpImg(pose, f) {
    f = f || 0;
    return spr('cogimp_' + pose + f, 34, 36, CG_PAL, (c) => {
      c.translate(16, 34);
      const by = pose === 'crouch' ? 2 : pose === 'air' ? -1 : 0;
      // legs: iron rods with big round brass feet
      const lf = pose === 'air' ? [[-5, -3], [4, -4]] : [[-4, 0], [4, 0]];
      lf.forEach(([fx, fy], i) => {
        gfx.limb(c, i ? 2.5 : -2.5, -7 + by, fx, fy - 1.5, 2, i ? CG.i1 : CG.i2);
        gfx.ellipse(c, fx + 1, fy - 1.2, 3, 1.6, 0, i ? CG.b2 : CG.b3);
      });
      c.save();
      c.translate(0, by);
      // back arm
      const ab = pose === 'wind' ? [-11, -20] : pose === 'throw' ? [-8, -8] : pose === 'air' ? [-10, -18] : [-9, -8];
      gfx.limb(c, -4, -13, ab[0], ab[1], 1.6, CG.i2);
      gfx.limb(c, ab[0], ab[1], ab[0] - 1.5, ab[1] + 1.5, 1.4, CG.i3);
      // boiler belly
      gfx.ellipse(c, 0, -11, 7.4, 6.8, 0, CG.b3);
      gfx.ellipse(c, 0.8, -11.8, 6.2, 5.6, 0, CG.b2);
      gfx.ellipse(c, 2, -13.6, 3.4, 2.4, 0, CG.b1);
      c.fillStyle = CG.b4;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        c.fillRect(Math.round(Math.cos(a) * 5.6), Math.round(-11 + Math.sin(a) * 5.2), 1, 1);
      }
      // little pressure gauge on the belly
      gfx.circle(c, 3.6, -9, 1.8, CG.i3);
      gfx.circle(c, 3.6, -9, 1.1, CG.steam);
      c.fillStyle = CG.eyeR;
      c.fillRect(3.6, -9.8, 1, 1);
      // head: goggle eyes, sheet-metal ears, riveted grin
      gfx.ellipse(c, 1, -20, 5, 4, 0, CG.b2);
      gfx.ellipse(c, 1.8, -21, 3.4, 2.4, 0, CG.b1);
      gfx.poly(c, [-3, -22, -8, -27, -2, -23.5], CG.b3);
      gfx.poly(c, [-1, -23, 0, -28, 2, -23.5], CG.cu);
      gfx.circle(c, 4, -21, 2.6, CG.i3);
      gfx.circle(c, 4.2, -21, 1.8, CG.eye);
      c.fillStyle = CG.eyeR;
      c.fillRect(4.5, -21, 1, 1);
      gfx.circle(c, 0, -21.2, 1.9, CG.i3);
      gfx.circle(c, 0.1, -21.2, 1.2, CG.eye);
      gfx.poly(c, [0.5, -17.6, 6.4, -18.4, 5.8, -16.4, 1, -16.2], CG.b4);
      c.fillStyle = CG.steam;
      c.fillRect(2, -17.6, 1, 1);
      c.fillRect(4, -17.8, 1, 1);
      // little chimney on the crown
      c.fillStyle = CG.i2;
      c.fillRect(-1, -26, 2, 3);
      c.fillStyle = CG.i3;
      c.fillRect(-1.5, -26.5, 3, 1);
      // front arm (holding a cog while winding up)
      const af = pose === 'wind' ? [-6 - f * 0.5, -24 - f * 1.5] : pose === 'throw' ? [10, -15] : pose === 'air' ? [9, -18] : [7, -7];
      gfx.limb(c, 4, -12, af[0], af[1], 1.8, CG.i1);
      gfx.limb(c, af[0], af[1], af[0] + 2, af[1] - 1, 1.5, CG.i2);
      gfx.limb(c, af[0], af[1], af[0] + 2, af[1] + 1.2, 1.5, CG.i2);
      if (pose === 'wind') {
        gfx.circle(c, af[0] - 1, af[1] - 3, 3.2, CG.b2);
        gfx.circle(c, af[0] - 1, af[1] - 3, 1.1, CG.b4);
      }
      c.restore();
    });
  }
  // the wind-up key turning on its back (drawn behind the body, same canvas)
  function cogKeyImg(k, by) {
    return spr('cogimp_key' + k + '_' + by, 34, 36, CG_PAL, (c) => {
      c.translate(16, 34 + by);
      // the bow spins around the shaft: its two lobes swing up and down
      gfx.limb(c, -6, -12, -9.5, -12, 1.6, CG.i2);
      const h = [1, 0.55, 0.12][k];
      [-1, 1].forEach((d) => {
        gfx.ellipse(c, -12, -12 + d * 3.4 * h, 2.8, Math.max(0.7, 2.6 * h), 0, CG.b3);
        gfx.ellipse(c, -12.3, -12.4 + d * 3.4 * h, 2, Math.max(0.5, 1.8 * h), 0, d < 0 ? CG.b1 : CG.b2);
        if (h > 0.5) gfx.ellipse(c, -12, -12 + d * 3.4 * h, 0.9, 0.9 * h, 0, CG.b4);
      });
      gfx.circle(c, -10, -12, 1.4, CG.b3);
    });
  }
  function cogImg(k) {
    return spr('cogimp_cog' + k, 14, 14, CG_PAL, (c) => {
      c.translate(7, 7);
      c.rotate((k * Math.PI) / 16);
      c.fillStyle = CG.b3;
      for (let i = 0; i < 8; i++) {
        c.save();
        c.rotate((i * Math.PI) / 4);
        c.fillRect(-1.2, -6.2, 2.4, 3);
        c.restore();
      }
      gfx.circle(c, 0, 0, 4.6, CG.b2);
      gfx.circle(c, -0.8, -0.8, 2.8, CG.b1);
      gfx.circle(c, 0, 0, 1.4, CG.b4);
    });
  }
  def('cog_imp', {
    name: N('Cog Imp', 'Diablillo de engranajes'),
    desc: N('A clockwork gremlin the tower keeper built to oil the gears. Nobody remembers who keeps winding its key.', 'Un duende de relojería que el guardián de la torre construyó para engrasar los engranajes. Nadie recuerda quién sigue dándole cuerda.'),
    area: 'clocktower', hp: 80, atk: 46, def: 6, exp: 50, w: 16, h: 22, gold: [40, 150],
    el: 'hit', weak: ['thunder'], armored: true, noBlood: true, blood: '#e8c060', stunTime: 8,
    drops: [{ id: 'high_potion', p: 0.03 }, { id: 'iron_knuckles', p: 0.02 }],
    init(e) {
      e.setState('stand');
      e.cool = 70 + e.rnd.int(0, 40);
      e.hops = 0;
      e.keyT = 0;
    },
    ai(e, g) {
      const st = e.state;
      e.keyT += st === 'air' ? 0.45 : 0.22;
      if (e.cool > 0) e.cool--;
      if (st === 'stand') {
        e.vx = 0;
        if (e.stT >= 8 && near(e, 230, 110)) {
          e.face();
          if (e.cool <= 0 && Math.abs(e.dxp()) < 200) e.setState('wind');
          else e.setState('crouch');
        }
      } else if (st === 'crouch') {
        e.vx = 0;
        if (e.stT >= 6) {
          const d = e.dxp();
          let vx = Math.abs(d) < 40 ? -e.facing * 1.6 : e.facing * 2;
          if (!safeHop(e, g, vx, -3.6)) vx = 0;
          e.vx = vx;
          e.vy = -3.6;
          sfx('gear', 0.25, 1.8);
          e.setState('air');
        }
      } else if (st === 'air') {
        if (e.onGround && e.stT > 3) {
          e.vx = 0;
          sfx('hit_metal', 0.2, 1.8);
          e.setState('stand');
        }
      } else if (st === 'wind') {
        e.vx = 0;
        if (e.stT === 1) sfx('gear', 0.5, 1.3);
        if (e.stT >= 16) {
          e.shoot({ x: e.cx + e.facing * 8, y: e.y + 6, vx: e.facing * 2.5, vy: -2.6, grav: 0.2, w: 10, h: 10, life: 260, wall: false, el: 'hit', color: CG.b2,
            bounces: 0,
            upd: (q, g2) => {
              const room = g2.room;
              // walls shatter it, floors bounce it twice
              if (P.solidAt(room, q.cx + U.sign(q.vx) * 6, q.cy)) {
                q.dead = true;
                G.fx.spark(q.cx, q.cy, CG.b1, 6);
                sfx('hit_metal', 0.3, 1.4);
                return;
              }
              if (q.vy > 0 && P.floorAt(room, q.cx, q.y + q.h + q.vy + 0.3)) {
                if (q.bounces >= 2) {
                  q.dead = true;
                  G.fx.debris(q.cx, q.cy, CG.b2, 5);
                  sfx('hit_metal', 0.35, 1.2);
                  return;
                }
                q.bounces++;
                q.vy = -Math.max(2.4, Math.abs(q.vy) * 0.72);
                G.fx.spark(q.cx, q.y + q.h, CG.b1, 4);
                sfx('gear', 0.3, 1.6);
              }
            },
            drawFn: (q, ctx, sx, sy) => ctx.drawImage(cogImg(Math.floor(q.t / 2) % 4), sx - 7, sy - 7) });
          sfx('swing_light', 0.5, 1.4);
          e.setState('throw');
        }
      } else if (st === 'throw') {
        e.vx = 0;
        if (e.stT >= 14) {
          e.cool = 90 + e.rnd.int(0, 40);
          e.setState('stand');
        }
      }
      if (e.t % 50 === 0) G.fx.particle(e.cx, e.y - 4, U.rnd(-0.2, 0.2), -0.5, '#d8dce6', 30, { size: 2, drag: 0.96 });
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      const pose = st === 'air' ? 'air' : st === 'crouch' ? 'crouch' : st === 'wind' ? 'wind' : st === 'throw' ? 'throw' : 'stand';
      const by = pose === 'crouch' ? 2 : pose === 'air' ? -1 : 0;
      e.blit(ctx, cogKeyImg(Math.floor(e.keyT) % 3, by), sx, sy, 16, 34, e.facing < 0);
      e.blit(ctx, cogImpImg(pose, pose === 'wind' ? Math.floor(e.stT / 4) % 2 : 0), sx, sy, 16, 34, e.facing < 0);
      if (st === 'wind' && e.stT > 6) glow(ctx, sx - e.facing * 7, sy - 27, 2, '#ffe080', 0.8);
      if (!e.preview) G.gfx.addLight(sx + e.facing * 3, sy - 21, 22, '#ffb040', 0.45);
    },
  });

  // ================================================================== HARPY (clock tower)
  const HP = {
    f1: '#cac6ca', f2: '#94909a', f3: '#625e6a', f4: '#38343e', sk1: '#e2d2ca', sk2: '#ac9a92', sk3: '#74625c',
    h1: '#5a4452', h2: '#2e2228', eye: '#ff3040', t1: '#dcc474', t2: '#8a7030',
  };
  const HP_PAL = Object.values(HP);
  // feathered wing pointing up from the shoulder, rotated by `a`
  function harpyWing(c, a, dark, k) {
    c.save();
    c.rotate(a);
    c.scale(k, k);
    const cA = dark ? HP.f3 : HP.f2, cB = dark ? HP.f4 : HP.f1, cC = dark ? HP.f4 : HP.f3;
    const feather = (bx, by, tx, ty, w, col, vein) => {
      const nx = -(ty - by), ny = tx - bx, L = Math.hypot(nx, ny);
      const ox = (nx / L) * w, oy = (ny / L) * w;
      gfx.poly(c, [bx + ox, by + oy, bx + (tx - bx) * 0.7 + ox * 0.8, by + (ty - by) * 0.7 + oy * 0.8, tx, ty, bx - ox * 0.6, by - oy * 0.6], col);
      gfx.limb(c, bx, by, bx + (tx - bx) * 0.85, by + (ty - by) * 0.85, 0.7, vein);
    };
    // secondaries along the arm, then the primaries fanning from the wrist
    [[0.5, -3, -9, -2], [1, -6, -10.5, -6.5], [1.5, -9, -11.5, -11]].forEach(([bx, by, tx, ty], i) => feather(bx, by, tx, ty, 2.2, i % 2 ? cA : cC, cC));
    [[-12, -16], [-9.5, -21.5], [-5.5, -25.5], [-0.5, -27.5], [4, -27], [8, -24.5]].forEach(([tx, ty], i) => feather(2, -11, tx, ty, 2.3, i % 2 ? cB : cA, cC));
    // coverts over the arm
    gfx.poly(c, [-0.5, 1, 3, -12, 0, -15, -5, -12.5, -6, -6, -3, -0.5], cA);
    gfx.poly(c, [0.5, -1, 3, -12, 0.5, -13.5, -2, -8], cB);
    gfx.limb(c, 0, 0, 2.5, -11.5, 1.8, cB);
    c.restore();
  }
  // pose: hover (f 0..3) | spread | swoop
  function harpyImg(pose, f) {
    return spr('harpy_' + pose + f, 76, 76, HP_PAL, (c) => {
      c.translate(38, 70);
      const wingA = pose === 'spread' ? (f ? [-0.32, -0.92] : [-0.12, -0.75]) : pose === 'swoop' ? [-2.05, -1.95] : [[-0.35, -0.2], [-1.05, -0.9], [-1.85, -1.7], [-1.05, -0.9]][f];
      const tilt = pose === 'swoop' ? 0.5 : pose === 'spread' ? -0.12 : 0.08;
      c.translate(0, -24);
      c.rotate(tilt);
      c.translate(0, 24);
      // far wing
      c.save();
      c.translate(-2, -34);
      harpyWing(c, wingA[1] + 0.25, true, 1.05);
      c.restore();
      // tail feathers
      gfx.poly(c, [-3, -20, -12, -14, -13, -10, -9, -11, -10, -7, -2, -15], HP.f3);
      gfx.poly(c, [-3, -20, -11, -14, -9, -12.5, -2, -16], HP.f2);
      // bird legs with talons (forward and open while swooping)
      const sw = pose === 'swoop';
      const legs = sw ? [[6, -9], [3, -7]] : [[1, -6], [-2, -5]];
      legs.forEach(([fx, fy], i) => {
        gfx.limb(c, i ? -1 : 1, -18, (fx + (i ? -1 : 1)) / 2 + 1, -12, 2.6, i ? HP.f3 : HP.f2);
        gfx.limb(c, (fx + (i ? -1 : 1)) / 2 + 1, -12, fx, fy, 1.6, HP.t2);
        c.fillStyle = HP.t1;
        c.fillRect(Math.round(fx - 1), Math.round(fy), 1, 2);
        c.fillRect(Math.round(fx + 1), Math.round(fy), 1, 2);
        c.fillStyle = HP.h2;
        c.fillRect(Math.round(fx - 1), Math.round(fy + 2), 1, 1);
        c.fillRect(Math.round(fx + 1), Math.round(fy + 2), 1, 1);
      });
      // feathered hips and the bare torso
      gfx.ellipse(c, 0, -19, 5, 4, 0, HP.f2);
      gfx.poly(c, [-3.5, -20, 3.5, -20, 4, -28, 2.5, -33, -2.5, -33, -3.8, -28], HP.sk2);
      gfx.poly(c, [0, -20, 3.5, -20, 4, -28, 2.5, -33, 0, -33], HP.sk1);
      gfx.ellipse(c, 0, -21, 4.6, 2.2, 0, HP.f1);
      c.fillStyle = HP.sk3;
      c.fillRect(1, -27, 2, 1);
      // feather ruff around the shoulders
      gfx.ellipse(c, -0.5, -32.6, 5, 2.2, 0.1, HP.f3);
      gfx.ellipse(c, 0, -33.2, 4, 1.4, 0.1, HP.f1);
      // head in profile with wild hair streaming back
      gfx.poly(c, [-1, -42, -7, -41.5, -12, -37, -10, -35, -14, -30, -8, -32, -11, -27, -4, -32, -2, -35], HP.h2);
      gfx.limb(c, -4, -40, -11, -33, 0.9, HP.h1);
      gfx.ellipse(c, 1.4, -37.6, 3.4, 4, 0.1, HP.sk1);
      gfx.poly(c, [4, -38.5, 6, -36.6, 4.2, -36.2], HP.sk1);
      gfx.poly(c, [-2.4, -41, 2, -42.4, 5, -40, 1.2, -39.4, -1.6, -36], HP.h1);
      gfx.poly(c, [-2.4, -41, 0, -41.8, -0.5, -37, -2, -35], HP.h2);
      c.fillStyle = HP.eye;
      c.fillRect(2.6, -38.6, 2, 1);
      c.fillStyle = HP.sk3;
      c.fillRect(3.4, -35.2, 1.6, 0.8);
      c.fillRect(0, -36, 1, 2);
      // near wing
      c.save();
      c.translate(0, -32);
      harpyWing(c, wingA[0], false, 1.12);
      c.restore();
    });
  }
  function featherImg(k) {
    return spr('harpy_fe' + k, 14, 14, HP_PAL, (c) => {
      c.translate(7, 7);
      c.rotate((k / ANG) * Math.PI * 2);
      gfx.poly(c, [-5.5, 0, -2, -2, 4, -1.2, 5.5, 0, 4, 1.2, -2, 2], HP.f2);
      gfx.poly(c, [-5.5, 0, -2, -2, 4, -1.2, 5.5, 0], HP.f1);
      gfx.limb(c, -6, 0, 5, 0, 0.8, HP.f4);
    });
  }
  def('harpy', {
    name: N('Harpy', 'Arpía'),
    desc: N('She nests among the bells and pendulums, shrieking at every hour. Ash-grey feathers fall from her like a cold rain.', 'Anida entre campanas y péndulos, chillando a cada hora. Sus plumas grises caen como una lluvia fría.'),
    area: 'clocktower', hp: 100, atk: 48, def: 4, exp: 58, w: 18, h: 28, flying: true, gold: [40, 170],
    pv: { dy: -13 },
    el: 'cut', weak: ['cut'], blood: '#a02030', stunTime: 8,
    drops: [{ id: 'high_potion', p: 0.04 }, { id: 'garnet_ring', p: 0.015 }],
    init(e) {
      e.setState('hover');
      e.cool = 90 + e.rnd.int(0, 40);
      e.side = e.facing < 0 ? 1 : -1;
      e.sw = null;
    },
    ai(e, g) {
      const st = e.state, p = e.player;
      if (st === 'hover') {
        // keep a perch in the air, at a distance, above the player
        if (Math.abs(e.dxp()) < 40) e.side = e.cx < p.cx ? -1 : 1;
        const tx = p.cx + e.side * 96, ty = p.cy - 66 + Math.sin(e.t * 0.05) * 6;
        e.vx = U.approach(e.vx, U.clamp((tx - e.cx) * 0.04, -1.6, 1.6), 0.08);
        e.vy = U.approach(e.vy, U.clamp((ty - e.cy) * 0.05, -1.4, 1.4), 0.08);
        e.face();
        if (e.t % 20 === 0 && e.onScreen()) sfx('bat_flap', 0.25, 0.6);
        if (--e.cool <= 0 && e.dist() < 240) e.setState(e.rnd.chance(0.55) ? 'spread' : 'sw0');
      } else if (st === 'spread') {
        e.vx *= 0.9;
        e.vy = U.approach(e.vy, -0.4, 0.05);
        if (e.stT === 1) sfx('bat_flap', 0.6, 0.8);
        if (e.stT >= 18 && e.stT <= 34 && (e.stT - 18) % 8 === 0) {
          const n = (e.stT - 18) / 8;
          const vx = U.clamp((e.dxp() * 1.7) / Math.max(30, e.dyp() + 6), -2.6, 2.6) + (n - 1) * 0.35;
          e.shoot({ x: e.cx + U.rnd(-6, 6), y: e.cy - 6, vx, vy: 1.7, w: 7, h: 7, life: 200, el: 'cut', ph: e.rnd.range(0, 6),
            upd: (q) => { q.vx += Math.sin(q.t * 0.12 + q.ph) * 0.03; },
            drawFn: (q, ctx, sx, sy) => ctx.drawImage(featherImg(angIdx(Math.atan2(q.vy, q.vx))), sx - 7, sy - 7) });
          sfx('swing_light', 0.3, 1.5);
        }
        if (e.stT >= 44) {
          e.cool = 70 + e.rnd.int(0, 40);
          e.setState(e.rnd.chance(0.5) ? 'sw0' : 'hover');
        }
      } else if (st === 'sw0') {
        // wind-up: pulls the wings in and screeches, then commits to a U-shaped swoop
        e.vx *= 0.85;
        e.vy = U.approach(e.vy, -0.6, 0.06);
        e.face();
        if (e.stT === 1) sfx('bat_screech', 0.55, 0.65);
        if (e.stT >= 22) {
          const dir = U.sign(e.dxp()) || e.facing;
          const span = U.clamp(Math.abs(e.dxp()) * 2, 150, 230);
          const depth = Math.max(30, p.cy - 6 - e.cy);
          e.sw = { x0: e.cx, y0: e.cy, dir, span, depth };
          e.facing = dir;
          e.setState('swoop');
          sfx('whip', 0.5, 0.7);
        }
      } else if (st === 'swoop') {
        const D = 64, k = Math.min(1, e.stT / D), s = e.sw;
        const tx = s.x0 + s.dir * s.span * k, ty = s.y0 + Math.sin(Math.PI * k) * s.depth;
        e.vx = tx - e.cx;
        e.vy = ty - e.cy;
        if (e.stT % 3 === 0) G.fx.particle(e.cx - s.dir * 6, e.cy, 0, 0.2, '#9a96a0', 18, { size: 1 });
        if (k >= 1 || e.hitWall) {
          e.side = s.dir;
          e.cool = 80 + e.rnd.int(0, 40);
          e.setState('hover');
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      let img;
      if (st === 'spread' || st === 'sw0') img = harpyImg(st === 'spread' ? 'spread' : 'hover', st === 'spread' ? Math.floor(e.stT / 4) % 2 : 2);
      else if (st === 'swoop') img = harpyImg('swoop', 0);
      else img = harpyImg('hover', Math.floor(e.t / 5) % 4);
      e.blit(ctx, img, sx, sy + 16, 38, 70, e.facing < 0);
      if (st === 'sw0' && e.stT > 8) glow(ctx, sx + e.facing * 3, sy - 21, 2, '#ff6070', 0.9);
    },
  });

  // ================================================================== GORGON HEAD (clock tower)
  const GO = { s1: '#aab69c', s2: '#7a886e', s3: '#525c4a', s4: '#2e3428', eye: '#e8ff80', mouth: '#1a1414', n1: '#7ab24a', n2: '#4a7a2c', n3: '#2c4a1a', ne: '#ff3030' };
  const GO_PAL = Object.values(GO);
  function gorgonImg(k) {
    return spr('gorgon_' + k, 40, 42, GO_PAL, (c) => {
      c.translate(20, 21);
      // snakes for hair, streaming back and writhing (tapered S-curves)
      const snakes = [[2, -8, -3, -17], [-1, -7, -10, -14], [-4, -4, -15, -7], [-5, 0, -16, 1], [-4, 4, -14, 9], [-1, 7, -7, 15]];
      snakes.forEach(([x0, y0, x1, y1], i) => {
        const w = Math.sin(k * 2.1 + i * 1.9) * 3.4;
        const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), px = -dy / L, py = dx / L;
        const c1x = x0 + dx * 0.33 + px * w, c1y = y0 + dy * 0.33 + py * w;
        const c2x = x0 + dx * 0.66 - px * w, c2y = y0 + dy * 0.66 - py * w;
        const col = i % 2 ? GO.n2 : GO.n1;
        c.strokeStyle = col;
        c.lineCap = 'round';
        c.lineWidth = 1.7;
        c.beginPath();
        c.moveTo(x0, y0);
        c.bezierCurveTo(c1x, c1y, c2x, c2y, x1, y1);
        c.stroke();
        c.lineWidth = 2.6;
        c.beginPath();
        c.moveTo(x0, y0);
        c.quadraticCurveTo(x0 + dx * 0.2 + px * w * 0.6, y0 + dy * 0.2 + py * w * 0.6, c1x, c1y);
        c.stroke();
        const ha = Math.atan2(y1 - c2y, x1 - c2x);
        gfx.ellipse(c, x1, y1, 2.2, 1.5, ha, GO.n3);
        c.fillStyle = GO.ne;
        c.fillRect(Math.round(x1 + Math.cos(ha) * 0.6), Math.round(y1 - 0.8), 1, 1);
      });
      // stone head in profile (facing right)
      gfx.ellipse(c, 1, 0, 7.4, 8.4, 0, GO.s3);
      gfx.ellipse(c, 2, -0.8, 6.2, 7.4, 0, GO.s2);
      gfx.ellipse(c, 3.6, -2.6, 3, 4, 0, GO.s1);
      // brow, nose, open mouth, chin
      gfx.poly(c, [3, -4.5, 8.6, -3.6, 8, -2.4, 3.4, -2.8], GO.s3);
      gfx.poly(c, [7, -2.4, 10, 1, 7.4, 1.4], GO.s2);
      gfx.poly(c, [4, 3, 8.6, 2.6, 8, 6, 4.4, 5.4], GO.mouth);
      c.fillStyle = GO.s1;
      c.fillRect(5, 3, 1, 1);
      c.fillRect(7, 2.8, 1, 1);
      // blank glowing eye
      c.fillStyle = GO.eye;
      c.fillRect(5, -2, 2.4, 1.6);
      // cracks
      gfx.limb(c, -3, -6, -0.5, -2.5, 0.8, GO.s4);
      gfx.limb(c, -0.5, -2.5, -2, 1.5, 0.8, GO.s4);
      gfx.limb(c, 1, 5, -1.5, 7.5, 0.8, GO.s4);
    });
  }
  def('gorgon_head', {
    name: N('Gorgon Head', 'Cabeza de gorgona'),
    desc: N('Stone heads severed from a statue that once watched the clock face. They drift through the tower in endless waves; their touch can turn the hands to stone.', 'Cabezas de piedra arrancadas de una estatua que vigilaba la esfera del reloj. Atraviesan la torre en oleadas sin fin; su roce puede petrificar las manos.'),
    area: 'clocktower', hp: 30, atk: 44, def: 0, exp: 22, w: 16, h: 16, flying: true, gold: [10, 50],
    el: 'hit', touchStatus: { status: 'curse', chance: 0.2 }, noBlood: true, blood: '#9aa890', hitSfx: 'hit_bone', stunTime: 4,
    drops: [{ id: 'holy_salt', p: 0.03 }],
    previewState: 'fly',
    init(e) {
      e.setState('wait');
      e.alpha = 0;
      e.active = false;
      e.wait = 30 + e.rnd.int(0, 60);
      e.baseY = e.y;
      e.ph = 0;
      e.dir = 1;
    },
    onHitCheck(e) {
      return e.state === 'fly';
    },
    // a fresh head takes this one's place: the wave never ends
    onDeath(e, g) {
      if (e.preview || !g || !g.add) return;
      const ne = G.ENT.enemy(Object.assign({}, e.sp), g);
      if (ne) {
        ne.wait = 120 + ne.rnd.int(0, 60);
        g.add(ne);
      }
      G.fx.debris(e.cx, e.cy, '#7a886e', 8);
    },
    ai(e, g) {
      const st = e.state, p = e.player;
      if (st === 'wait') {
        e.alpha = 0;
        e.active = false;
        e.vx = e.vy = 0;
        if (e.stT >= e.wait && !p.dead) {
          // enter from a screen edge, preferably the one the player faces
          const fromFront = e.rnd.chance(0.7);
          const side = fromFront ? p.facing || 1 : -(p.facing || 1);
          e.dir = -side;
          e.x = (side > 0 ? g.camx + G.W + 12 : g.camx - 12) - e.w / 2;
          // the wave grazes the floor at the player's feet and passes over his head
          e.baseY = U.clamp(p.cy - 18 + e.rnd.range(-6, 6), 40, g.room.ph - 40);
          e.ph = e.rnd.range(0, Math.PI * 2);
          e.y = e.baseY + Math.sin(e.ph) * 28 - e.h / 2;
          e.facing = e.dir;
          e.alpha = 1;
          e.active = true;
          e.setState('fly');
        }
      } else if (st === 'fly') {
        e.ph += 0.055;
        e.vx = e.dir * 1.55;
        e.vy = e.baseY + Math.sin(e.ph) * 28 - e.h / 2 - e.y;
        if (e.t % 40 === 0 && e.onScreen()) sfx('slime', 0.15, 1.9);
        const gone = e.dir > 0 ? e.x > g.camx + G.W + 24 : e.x + e.w < g.camx - 24;
        if (gone && e.stT > 30) {
          e.wait = 120 + e.rnd.int(0, 60);
          e.setState('wait');
        }
      }
      e.drift();
    },
    draw(e, ctx, sx, sy) {
      const img = gorgonImg(Math.floor(e.t / 7) % 3);
      e.blit(ctx, img, sx, sy - 8, 20, 21, e.facing < 0);
      if (!e.preview) G.gfx.addLight(sx + e.facing * 5, sy - 10, 18, '#d8ff80', 0.4);
    },
  });

  // ================================================================== CHOIR GHOST (chapel)
  const CH = {
    r1: '#f6f4ee', r2: '#d2ccc2', r3: '#9c968c', r4: '#686258', au: '#eac452', auD: '#a07a28',
    void: '#181220', eye: '#d8f0ff', song: '#ffe486', book: '#8a1a2a',
  };
  const CH_PAL = Object.values(CH);
  // pose: float (f 0..2) | sing (f 0..1)
  function choirImg(pose, f) {
    return spr('choir_' + pose + f, 44, 58, CH_PAL, (c) => {
      c.translate(22, 56);
      const sing = pose === 'sing';
      const w = (f / 3) * Math.PI * 2;
      const t1 = Math.sin(w) * 2, t2 = Math.sin(w + 2.1) * 2, t3 = Math.sin(w + 4.2) * 1.6;
      // robe: a surplice over a long cassock dissolving into wisps
      gfx.poly(c, [-6, -36, 6, -36, 8, -24, 9, -12, 6, -6 + t1, 3, -9, 1, -2 + t2, -2, -8, -5, -1 + t3, -7, -9, -9, -5 + t1, -9, -14, -8, -26], CH.r3);
      gfx.poly(c, [-5, -36, 6, -36, 8, -24, 8.4, -14, 5.5, -10 + t1 * 0.6, 3, -12, 0.5, -7 + t2, -2, -12, -5, -6 + t3, -6.5, -13, -7.5, -26], CH.r2);
      // surplice (white over-gown) with a gold hem
      gfx.poly(c, [-6, -36, 6.5, -36, 9, -22, 6, -19, 2, -21, -2, -18.5, -6, -21, -8.5, -24], CH.r1);
      gfx.poly(c, [-6, -36, -2, -36, -4, -23, -6, -21, -8.5, -24], CH.r2);
      c.strokeStyle = CH.au;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(9, -22);
      c.lineTo(6, -19);
      c.lineTo(2, -21);
      c.lineTo(-2, -18.5);
      c.lineTo(-6, -21);
      c.lineTo(-8.5, -24);
      c.stroke();
      // folds
      gfx.limb(c, 2, -18, 3, -9, 0.9, CH.r3);
      gfx.limb(c, -3, -17, -4, -8, 0.9, CH.r3);
      // gold stole hanging from the shoulders
      gfx.poly(c, [2, -36, 4.5, -36, 4, -18, 2, -17], CH.au);
      gfx.limb(c, 2.5, -35, 2.3, -18, 0.8, CH.auD);
      // hood with a dark void face
      const hy = sing ? -42 : -41;
      gfx.ellipse(c, 0.5, hy, 6.2, 6.4, 0, CH.r2);
      gfx.ellipse(c, 1.2, hy - 0.8, 5, 5.2, 0, CH.r1);
      gfx.poly(c, [-5.5, hy + 1, -8, hy + 6, -4, hy + 5.4], CH.r3);
      gfx.ellipse(c, 3, hy + 1, 3.3, 4, sing ? -0.25 : 0, CH.void);
      c.fillStyle = CH.eye;
      c.fillRect(2.5, hy - 0.5, 1, 1);
      c.fillRect(4.5, hy - 0.5, 1, 1);
      c.fillStyle = sing ? CH.song : CH.r3;
      if (sing) {
        gfx.ellipse(c, 4, hy + 3, 1.2, f ? 1.8 : 1.3, 0, CH.song);
      } else c.fillRect(3.5, hy + 2.5, 1, 1);
      // hands holding a hymnal (raised and open while singing)
      if (sing) {
        gfx.limb(c, 2, -33, 7, -30, 2, CH.r2);
        gfx.limb(c, -2, -33, 5, -29, 2, CH.r3);
        gfx.poly(c, [6, -31, 12, -33, 12, -28, 6, -27], CH.book);
        gfx.poly(c, [7, -30.5, 11.4, -32, 11.4, -29, 7, -28], CH.r1);
      } else {
        gfx.limb(c, 2, -33, 6, -27, 2, CH.r2);
        gfx.limb(c, -2, -33, 4, -26, 2, CH.r3);
        gfx.poly(c, [4.5, -29, 9, -29, 9, -24, 4.5, -24], CH.book);
        c.fillStyle = CH.au;
        c.fillRect(6, -27.5, 1.5, 2);
      }
    });
  }
  function drawRing(q, ctx, sx, sy) {
    const r = q.w / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, q.life / 30) * 0.9;
    ctx.strokeStyle = '#ffe486';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha *= 0.45;
    ctx.strokeStyle = '#fff8e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(1, r - 3), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    G.gfx.addLight(sx, sy, r + 20, '#ffe080', 0.5);
  }
  def('choir_ghost', {
    name: N('Choir Ghost', 'Fantasma del coro'),
    desc: N('The castle choir never stopped singing, not even after the last of them died. Their hymns now take shape as rings of golden sound.', 'El coro del castillo nunca dejó de cantar, ni siquiera cuando murió el último de sus miembros. Sus himnos toman forma de anillos de sonido dorado.'),
    area: 'chapel', hp: 110, atk: 54, def: 4, exp: 66, w: 18, h: 32, flying: true, gold: [50, 200],
    pv: { dy: -7 },
    el: 'holy', weak: ['dark'], immune: ['poison'], noBlood: true, blood: '#f4eedc', stunTime: 6,
    drops: [{ id: 'heart_jar', p: 0.04 }, { id: 'silver_circlet', p: 0.008 }],
    init(e) {
      e.setState('float');
      e.cool = 80 + e.rnd.int(0, 50);
      e.alpha = 0.88;
    },
    ai(e, g) {
      const st = e.state, p = e.player;
      if (st === 'float') {
        const side = e.cx < p.cx ? -1 : 1;
        const tx = p.cx + side * 104, ty = p.cy - 26 + Math.sin(e.t * 0.04) * 10;
        e.vx = U.approach(e.vx, U.clamp((tx - e.cx) * 0.025, -0.8, 0.8), 0.04);
        e.vy = U.approach(e.vy, U.clamp((ty - e.cy) * 0.03, -0.7, 0.7), 0.04);
        e.face();
        if (--e.cool <= 0 && e.dist() < 260) {
          e.setState('sing');
          sfx('ghost_wail', 0.5, 1.7);
        }
      } else if (st === 'sing') {
        e.vx *= 0.9;
        e.vy *= 0.9;
        e.face();
        if (e.stT % 7 === 0) G.fx.particle(e.cx + e.facing * 6 + U.rnd(-3, 3), e.y + 2, U.rnd(-0.3, 0.3), -0.6, '#ffe486', 26, { glow: true });
        if (e.stT >= 24 && e.stT <= 56 && (e.stT - 24) % 16 === 0) {
          const ox = e.cx + e.facing * 5, oy = e.y + 4;
          const a = Math.atan2(p.cy - 6 - oy, p.cx - ox);
          e.shoot({ x: ox, y: oy, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5, w: 8, h: 8, life: 150, wall: false, magic: true, el: 'holy', color: '#ffe486',
            upd: (q) => {
              const r = Math.min(16, 4 + q.t * 0.13), cx = q.x + q.w / 2, cy = q.y + q.h / 2;
              q.w = q.h = r * 2;
              q.x = cx - r;
              q.y = cy - r;
            },
            drawFn: drawRing });
          sfx('magic_cast', 0.35, 1.5 + (e.stT - 24) / 64);
        }
        if (e.stT >= 78) {
          e.cool = 120 + e.rnd.int(0, 40);
          e.setState('float');
        }
      }
      e.drift();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      const sing = st === 'sing' && e.stT > 6;
      const img = sing ? choirImg('sing', Math.floor(e.t / 8) % 2) : choirImg('float', Math.floor(e.t / 9) % 3);
      const bob = Math.round(Math.sin(e.t * 0.07) * 1.5);
      if (!e.preview) G.gfx.addLight(sx, sy - 20, sing ? 70 : 50, '#fff0c0', sing ? 0.9 : 0.6);
      e.blit(ctx, img, sx, sy + 8 + bob, 22, 56, e.facing < 0);
      if (sing) glow(ctx, sx + e.facing * 4, sy - 25 + bob, 3, '#ffe486', 0.6);
    },
  });

  // ================================================================== FALLEN TEMPLAR (chapel)
  const TP = {
    s1: '#d2d2c8', s2: '#9a9a90', s3: '#64645c', s4: '#363631', tar: '#6e7a5c', c1: '#ddd4c2', c2: '#a89e8a', c3: '#6e6656',
    red: '#a81c26', redD: '#640e16', wood: '#6a4a2a', iron: '#4a4a54', ironH: '#8e8e9a', eye: '#ff5030',
  };
  const TP_PAL = Object.values(TP);
  // hand (flail grip) position per pose, sprite-local
  const TP_HAND = { walk: [9, -30], raise: [9, -62], smash: [17, -30], spin: [11, -44] };
  // pose: walk (f 0..3) | raise | smash | spin
  function templarImg(pose, f) {
    return spr('templar_' + pose + f, 64, 72, TP_PAL, (c) => {
      c.translate(30, 70);
      const ph = (f / 4) * Math.PI * 2, s = pose === 'walk' ? Math.sin(ph) : 0;
      const bob = pose === 'walk' ? Math.abs(Math.cos(ph)) * 1 : pose === 'smash' ? 3 : 0;
      const lean = pose === 'smash' ? 4 : pose === 'raise' ? -2 : 0;
      // legs (armoured, long strides)
      const legs = pose === 'smash' ? [[8, 0], [-8, 0]] : pose === 'raise' ? [[3, 0], [-5, 0]] : [[s * 6, 0], [-s * 6, 0]];
      const leg = ([fx], i) => {
        const kx = fx * 0.55 + (i ? -1 : 1.5);
        gfx.limb(c, i ? -2.5 : 2.5, -24 + bob, kx, -12 + bob * 0.5, 5, i ? TP.s3 : TP.s2);
        gfx.limb(c, kx, -12 + bob * 0.5, fx, -2, 4.4, i ? TP.s3 : TP.s2);
        gfx.circle(c, kx, -12 + bob * 0.5, 2.4, i ? TP.s2 : TP.s1);
        gfx.poly(c, [fx - 3, -3, fx + 4, -2.4, fx + 5.4, 0.4, fx - 3.4, 0.4], TP.s4);
      };
      leg(legs[1], 1);
      // surcoat skirt down to the knees, split at the front
      gfx.poly(c, [-7 + lean * 0.4, -27 + bob, 7 + lean * 0.4, -27 + bob, 9, -15 + bob, 4, -16 + bob, 2, -19 + bob, 0, -15.5 + bob, -9, -15 + bob], TP.c2);
      gfx.poly(c, [-7 + lean * 0.4, -27 + bob, 7 + lean * 0.4, -27 + bob, 8, -17 + bob, 4, -17.5 + bob, 2, -20 + bob, 0, -17 + bob, -8.5, -17 + bob], TP.c1);
      c.fillStyle = TP.red;
      c.fillRect(-8, -18 + bob, 16, 1);
      leg(legs[0], 0);
      c.save();
      c.translate(lean, bob);
      // back arm (shield-less, mailed fist)
      gfx.limb(c, -5, -46, -9, -36, 4, TP.s3);
      gfx.limb(c, -9, -36, -8, -27, 3.6, TP.s3);
      // torso: plate under a white surcoat with a red cross
      gfx.poly(c, [-8, -27, 8, -27, 9.5, -46, 4, -50, -4, -50, -9, -46], TP.s3);
      gfx.poly(c, [-7, -27, 7.5, -27, 8.5, -45, -7.5, -45], TP.c1);
      gfx.poly(c, [-7, -27, -3, -27, -3.5, -45, -7.5, -45], TP.c2);
      c.fillStyle = TP.red;
      c.fillRect(-0.5, -43, 3, 15);
      c.fillRect(-4, -39, 10, 3);
      c.fillStyle = TP.redD;
      c.fillRect(-0.5, -36, 1, 8);
      // stains and tears on the surcoat
      c.fillStyle = TP.c3;
      c.fillRect(5, -31, 2, 2);
      c.fillRect(-6, -33, 1, 3);
      // belt
      gfx.limb(c, -7.5, -27.5, 8, -27.5, 2, TP.s4);
      c.fillStyle = TP.s1;
      c.fillRect(1, -28.5, 2, 2);
      // pauldrons with tarnish
      gfx.ellipse(c, -2, -46, 7, 4.5, -0.1, TP.s2);
      gfx.ellipse(c, -1, -47.4, 5, 2.6, -0.1, TP.s1);
      c.fillStyle = TP.tar;
      c.fillRect(-6, -45, 3, 1);
      c.fillRect(2, -44, 2, 1);
      // great helm: flat top, cross-shaped visor
      gfx.poly(c, [-5, -50, 6.5, -50, 7, -63, -5, -63], TP.s2);
      gfx.poly(c, [0, -50, 6.5, -50, 7, -63, 0.5, -63], TP.s1);
      gfx.poly(c, [-5.6, -63, 7.6, -63, 6.6, -65, -4.8, -65], TP.s3);
      c.fillStyle = TP.s4;
      c.fillRect(1, -58.5, 6.5, 1.6);
      c.fillRect(3.6, -61, 1.6, 8);
      c.fillStyle = TP.eye;
      c.fillRect(5, -58.5, 1, 1);
      c.fillStyle = TP.tar;
      c.fillRect(-4, -55, 2, 3);
      c.fillRect(-2, -61, 1, 2);
      c.fillStyle = TP.s3;
      for (let i = 0; i < 3; i++) c.fillRect(5, -54 + i * 1.5, 1, 1);
      // a torn red pennant on the helm crest
      gfx.poly(c, [-4.5, -64, -10, -63, -13, -59, -9, -60, -11, -56, -5, -60], TP.red);
      c.restore();
      // front arm gripping the flail handle
      const h = TP_HAND[pose];
      const hx = h[0] + lean, hy = h[1] + bob;
      const ex = (3 + lean + hx) / 2 + (pose === 'raise' ? -3 : 1), ey = (-46 + bob + hy) / 2 + (pose === 'raise' ? 0 : 4);
      gfx.limb(c, 3 + lean, -46 + bob, ex, ey, 4.4, TP.s2);
      gfx.limb(c, ex, ey, hx, hy, 4, TP.s2);
      gfx.limb(c, 3.5 + lean, -46.5 + bob, ex + 0.5, ey - 0.5, 1.2, TP.s1);
      gfx.circle(c, hx, hy, 2.6, TP.s3);
      // the handle
      const ha = pose === 'raise' ? -2.2 : pose === 'smash' ? 0.9 : pose === 'spin' ? -0.6 : 0.3;
      gfx.limb(c, hx, hy, hx + Math.cos(ha) * 7, hy + Math.sin(ha) * 7, 2.2, TP.wood);
    });
  }
  function flailBallImg() {
    return spr('templar_ball', 18, 18, TP_PAL, (c) => {
      c.translate(9, 9);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        gfx.poly(c, [Math.cos(a - 0.3) * 4, Math.sin(a - 0.3) * 4, Math.cos(a) * 7.6, Math.sin(a) * 7.6, Math.cos(a + 0.3) * 4, Math.sin(a + 0.3) * 4], TP.s3);
      }
      gfx.circle(c, 0, 0, 5, TP.iron);
      gfx.circle(c, -1.4, -1.4, 2.2, TP.ironH);
    });
  }
  // world position of the flail ball and the handle tip for the current state
  function flailPos(e) {
    const st = e.state, f = e.facing;
    let pose = 'walk';
    if (st === 'raise') pose = 'raise';
    else if (st === 'smash' || st === 'srec') pose = 'smash';
    else if (st === 'spin' || st === 'swind' || st === 'send') pose = 'spin';
    const h = TP_HAND[pose];
    const lean = pose === 'smash' ? 4 : pose === 'raise' ? -2 : 0, bob = pose === 'smash' ? 3 : 0;
    const ha = pose === 'raise' ? -2.2 : pose === 'smash' ? 0.9 : pose === 'spin' ? -0.6 : 0.3;
    const hx = h[0] + lean + Math.cos(ha) * 7, hy = h[1] + bob + Math.sin(ha) * 7;
    let bx, by;
    if (pose === 'walk') {
      bx = hx + Math.sin(e.t * 0.07) * 4;
      by = hy + 15;
    } else if (pose === 'raise') {
      const k = Math.min(1, e.stT / 26);
      const a = U.lerp(Math.PI / 2, Math.PI * 1.15, U.ease.inOut(k)) + Math.sin(e.t * 0.5) * (k > 0.9 ? 0.05 : 0);
      bx = hx + Math.cos(a) * 15;
      by = hy + Math.sin(a) * 15;
    } else if (pose === 'smash') {
      const k = st === 'smash' ? Math.min(1, e.stT / 8) : 1;
      const a0 = -Math.PI * 0.85, a1 = Math.PI * 0.32;
      const a = U.lerp(a0, a1, U.ease.in(k));
      const L = U.lerp(15, 30, k);
      bx = hx + Math.cos(a) * L;
      by = hy + Math.sin(a) * L;
      if (k >= 1) {
        bx = 38;
        by = -6;
      }
    } else {
      const a = e.spinA || 0, R = 30;
      bx = 11 + lean + Math.cos(a) * R;
      by = -44 + Math.sin(a) * R * 0.85;
    }
    return { hx: e.cx + f * hx, hy: e.fy + hy, bx: e.cx + f * bx, by: e.fy + by };
  }
  def('templar', {
    name: N('Fallen Templar', 'Templario caído'),
    desc: N('A knight of the chapel order who swore to guard the altar forever. He kept his oath; it was his soul that rusted.', 'Un caballero de la orden de la capilla que juró custodiar el altar para siempre. Cumplió su juramento; fue su alma la que se oxidó.'),
    area: 'chapel', hp: 220, atk: 60, def: 14, exp: 100, w: 20, h: 50, gold: [80, 300],
    el: 'hit', heavy: true, armored: true, weak: ['dark'], noBlood: true, blood: '#c8c8c0',
    drops: [{ id: 'high_potion', p: 0.05 }, { id: 'chainmail', p: 0.03 }, { id: 'claymore', p: 0.008 }],
    init(e) {
      e.setState('walk');
      e.cool = 50;
      e.turnT = 0;
      e.spinA = 0;
      e.spinV = 0;
    },
    ai(e, g) {
      const st = e.state;
      const d = e.dxp();
      if (st === 'walk') {
        if (d * e.facing < 0 && Math.abs(d) > 8) {
          if (++e.turnT > 24) {
            e.facing *= -1;
            e.turnT = 0;
          }
        } else e.turnT = 0;
        e.vx = Math.abs(d) > 40 && d * e.facing > 0 && canStep(e, g, e.facing) ? e.facing * 0.35 : 0;
        if (e.vx && e.t % 28 === 0) {
          sfx('stomp', 0.25, 0.7);
          G.fx.dust(e.cx, e.fy, 2);
        }
        if (e.cool > 0) e.cool--;
        else if (d * e.facing > 0 && Math.abs(e.dyp()) < 50) {
          if (Math.abs(d) < 70) e.setState('raise');
          else if (Math.abs(d) < 150 && e.rnd.chance(0.02)) e.setState('swind');
        }
      } else if (st === 'raise') {
        e.vx = 0;
        if (e.stT === 1) sfx('swing_heavy', 0.6, 0.6);
        if (e.stT === 18) sfx('hit_metal', 0.3, 0.6);
        if (e.stT >= 32) {
          e.setState('smash');
          sfx('swing_heavy', 0.8, 0.8);
        }
      } else if (st === 'smash') {
        e.vx = 0;
        const fp = flailPos(e);
        if (e.stT >= 3) strike(e, fp.bx - 8, fp.by - 8, 16, 16);
        if (e.stT === 8) {
          G.gfx.shake(4, 14);
          sfx('stomp', 0.9, 0.6);
          sfx('explosion', 0.4, 1.4);
          G.fx.debris(fp.bx, e.fy - 2, '#8a8070', 10);
          G.fx.dust(fp.bx, e.fy, 8);
          // shockwaves run along the floor both ways
          for (const dir of [e.facing, -e.facing]) {
            e.shoot({ x: fp.bx + dir * 6, y: e.fy - 7, vx: dir * (dir === e.facing ? 2.7 : 2.2), vy: 0, w: 10, h: 14, life: dir === e.facing ? 70 : 40, el: 'hit', dmg: Math.round(e.atk * 0.8), color: '#c8d8ff',
              upd: (q, g2) => {
                if (!P.floorAt(g2.room, q.cx + U.sign(q.vx) * 6, q.y + q.h + 4)) q.dead = true;
                if (q.t % 4 === 0) G.fx.particle(q.cx, q.y + q.h - 1, U.rnd(-0.3, 0.3), U.rnd(-1.2, -0.4), '#a89e8a', 16, { size: 2 });
              },
              drawFn: (q, ctx, sx, sy) => {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = Math.min(1, q.life / 20);
                for (let i = 0; i < 4; i++) {
                  const hgt = 6 + ((q.t * 3 + i * 5) % 9);
                  ctx.fillStyle = i % 2 ? '#c8d8ff' : '#ffffff';
                  ctx.fillRect(Math.round(sx - 5 + i * 3), Math.round(sy + 7 - hgt), 2, hgt);
                }
                ctx.restore();
                G.gfx.addLight(sx, sy, 28, '#c8d8ff', 0.6);
              } });
          }
        }
        if (e.stT >= 12) e.setState('srec');
      } else if (st === 'srec') {
        e.vx = 0;
        if (e.stT >= 34) {
          e.cool = 50 + e.rnd.int(0, 40);
          e.setState('walk');
        }
      } else if (st === 'swind') {
        // starts whirling the flail over his head, faster and faster
        e.vx = 0;
        e.spinV = Math.min(0.24, e.spinV + 0.012);
        e.spinA += e.spinV * e.facing;
        if (e.stT % 12 === 0) sfx('whip', 0.35, 0.6 + e.spinV * 2);
        if (e.stT >= 24) e.setState('spin');
      } else if (st === 'spin') {
        e.spinA += 0.24 * e.facing;
        e.face();
        e.vx = Math.abs(d) > 10 && canStep(e, g, e.facing) ? e.facing * 0.42 : 0;
        const fp = flailPos(e);
        strike(e, fp.bx - 7, fp.by - 7, 14, 14);
        if (e.stT % 12 === 0) sfx('swing_light', 0.45, 0.7);
        if (e.stT >= 110) e.setState('send');
      } else if (st === 'send') {
        e.vx = 0;
        e.spinV = Math.max(0, e.spinV - 0.012);
        e.spinA += e.spinV * e.facing;
        const fp = flailPos(e);
        if (e.spinV > 0.1) strike(e, fp.bx - 7, fp.by - 7, 14, 14);
        if (e.stT >= 24) {
          e.cool = 70 + e.rnd.int(0, 40);
          e.spinV = 0;
          e.setState('walk');
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      let pose = 'walk', f = 0;
      if (st === 'raise') pose = 'raise';
      else if (st === 'smash' || st === 'srec') pose = 'smash';
      else if (st === 'spin' || st === 'swind' || st === 'send') pose = 'spin';
      else f = Math.abs(e.vx) > 0.05 ? Math.floor(e.t / 12) % 4 : 0;
      const fp = flailPos(e);
      const cx = Math.round(G.game ? G.game.camx : 0), cy = Math.round(G.game ? G.game.camy : 0);
      // in the preview there is no camera: place the flail relative to the sprite
      const ox = e.preview ? sx - e.cx : -cx, oy = e.preview ? sy - e.fy : -cy;
      const bx = fp.bx + ox, by = fp.by + oy, hx = fp.hx + ox, hy = fp.hy + oy;
      const drawChain = () => {
        for (let i = 1; i < 7; i++) {
          const k = i / 7;
          const x = Math.round(U.lerp(hx, bx, k)), y = Math.round(U.lerp(hy, by, k) + Math.sin(k * Math.PI) * (pose === 'walk' ? 2 : 0));
          ctx.fillStyle = OUT;
          ctx.fillRect(x - 1, y - 1, 3, 3);
          ctx.fillStyle = i % 2 ? TP.ironH : TP.iron;
          ctx.fillRect(x, y, 1, 1);
        }
        e.blit(ctx, flailBallImg(), bx, by, 9, 9, false);
      };
      e.blit(ctx, templarImg(pose, f), sx, sy, 30, 70, e.facing < 0);
      drawChain();
      if (st === 'raise' && e.stT > 20) glow(ctx, bx, by, 4, '#ffffff', 0.5);
      if ((st === 'spin' || st === 'swind') && !e.preview) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#d8dcf0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(sx + e.facing * 11, sy - 44, 30, 25.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    },
  });

  // ================================================================== BONE PILLAR (catacombs)
  const BP = { b1: '#eee6ce', b2: '#c6ba9a', b3: '#8e8268', b4: '#4e4636', sock: '#1a1410', g1: '#ffe080', g2: '#ff9020', g3: '#c03a10' };
  const BP_PAL = Object.values(BP);
  const BP_SKULL_Y = [-47, -33, -19]; // skull centres (top → bottom), relative to the feet
  function pillarImg() {
    return spr('bpillar_col', 40, 56, BP_PAL, (c) => {
      c.translate(20, 54);
      // heap of bones at the base
      gfx.ellipse(c, 0, -2.5, 12, 3.5, 0, BP.b3);
      gfx.limb(c, -11, -2, -2, -4.5, 2.4, BP.b2);
      gfx.limb(c, 3, -1.5, 12, -3.5, 2.2, BP.b1);
      gfx.circle(c, -11, -2, 1.6, BP.b1);
      gfx.circle(c, 12, -3.5, 1.5, BP.b2);
      gfx.limb(c, -6, -1, 6, -1, 2, BP.b2);
      // pelvis
      gfx.poly(c, [-6, -6, 6, -6, 7, -10, 3, -12, -3, -12, -7, -10], BP.b2);
      gfx.ellipse(c, -2.5, -9, 1.6, 1.4, 0, BP.b4);
      gfx.ellipse(c, 2.5, -9, 1.6, 1.4, 0, BP.b4);
      // spine: vertebrae up to the top skull, with stubs of ribs between the skulls
      for (let y = -12; y > -44; y -= 3.2) {
        gfx.ellipse(c, 0, y, 2.8, 1.5, 0, BP.b2);
        c.fillStyle = BP.b1;
        c.fillRect(-1.5, Math.round(y - 1), 2, 1);
        c.fillStyle = BP.b4;
        c.fillRect(-2.5, Math.round(y + 1), 5, 0.8);
      }
      [-26, -40].forEach((y) => {
        gfx.limb(c, -1, y, -8, y + 4, 1.3, BP.b2);
        gfx.limb(c, 1, y, 8, y + 4, 1.3, BP.b1);
        gfx.limb(c, -1, y + 2.5, -6.5, y + 6, 1.2, BP.b3);
        gfx.limb(c, 1, y + 2.5, 6.5, y + 6, 1.2, BP.b2);
      });
    });
  }
  // m: 0 closed, 1 eyes lit, 2 jaw open breathing fire
  function pillarSkullImg(m) {
    return spr('bpillar_sk' + m, 24, 22, BP_PAL, (c) => {
      c.translate(11, 11);
      // cranium
      gfx.ellipse(c, -1, -1.8, 6.4, 5.6, 0, BP.b2);
      gfx.ellipse(c, -0.2, -3, 4.8, 3.6, 0, BP.b1);
      gfx.limb(c, -5, 0, -2, 2.5, 0.9, BP.b3);
      // face: brow ridge, big socket, nasal hole, cheekbone, upper teeth
      gfx.poly(c, [2, -3.4, 7.6, -2.2, 8, 1.5, 7, 3.4, 2.5, 3.4], BP.b2);
      gfx.poly(c, [2.5, -3.4, 7.4, -2.4, 6.8, -1.6, 2.6, -2], BP.b1);
      gfx.ellipse(c, 4, -0.4, 2.3, 2, 0, BP.sock);
      if (m) {
        c.fillStyle = m === 2 ? BP.g1 : BP.g2;
        c.fillRect(3.5, -1, 2, 1.6);
        c.fillStyle = BP.g1;
        c.fillRect(4, -1, 1, 1);
      }
      c.fillStyle = BP.sock;
      c.fillRect(7, 0.6, 1, 2);
      gfx.limb(c, 1.6, 2, 5, 1.8, 0.8, BP.b3);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? BP.b1 : BP.b3;
        c.fillRect(3.5 + i, 3.2, 1, 1.6);
      }
      // jaw (mandible), dropped open when breathing fire
      c.save();
      c.translate(0, 4.2);
      c.rotate(m === 2 ? 0.55 : 0);
      gfx.poly(c, [-1.5, -1, 7.6, 0.4, 7.4, 2.8, 2, 3.2, -1, 1.6], BP.b2);
      gfx.poly(c, [2, 0.6, 7.6, 0.4, 7.4, 1.4, 2, 1.6], BP.b1);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? BP.b3 : BP.b1;
        c.fillRect(3.5 + i, -0.4, 1, 1.2);
      }
      c.restore();
      if (m === 2) {
        gfx.poly(c, [3.5, 4.4, 9, 5, 8.4, 8, 3.5, 6.6], BP.g3);
        gfx.poly(c, [4.5, 5, 9, 5.4, 8.4, 6.8], BP.g1);
      }
    });
  }
  function fireballImg(k) {
    return gfx.sprite('bpillar_fb' + k, 16, 12, (c) => {
      c.translate(10, 6);
      const fl = [0, 1, -1][k];
      gfx.ellipse(c, -2, 0, 7 + fl, 3.8, 0, '#c03a10');
      gfx.ellipse(c, -0.5, 0, 5, 2.8, 0, '#ff8a20');
      gfx.ellipse(c, 1, 0, 3, 1.8, 0, '#ffd848');
      gfx.ellipse(c, 2, 0, 1.4, 1, 0, '#fffbe0');
      c.fillStyle = '#ff8a20';
      c.fillRect(-9, -3 + fl, 2, 1);
      c.fillRect(-8, 2 - fl, 2, 1);
    }, { palette: ['#c03a10', '#ff8a20', '#ffd848', '#fffbe0'], threshold: 100 });
  }
  function drawFireball(q, ctx, sx, sy) {
    glow(ctx, sx, sy, 6, '#ff7020', 0.35);
    G.gfx.drawAnchored(fireballImg(Math.floor(q.t / 3) % 3), sx, sy, 10, 6, q.vx < 0, null, ctx);
    G.gfx.addLight(sx, sy, 36, '#ff8030', 0.8);
  }
  def('bone_pillar', {
    name: N('Bone Pillar', 'Pilar de huesos'),
    desc: N('Three skulls of heretics, stacked and bound by a single spine. They argue for eternity, and agree only on burning intruders.', 'Tres cráneos de herejes apilados y unidos por una sola columna. Discuten por toda la eternidad y solo se ponen de acuerdo en quemar a los intrusos.'),
    area: 'catacombs', hp: 130, atk: 56, def: 10, exp: 75, w: 18, h: 48, gold: [60, 220],
    el: 'hit', resist: ['cut'], weak: ['hit', 'holy'], heavy: true, bony: true, noBlood: true, blood: '#e8e0cc',
    drops: [{ id: 'heart_jar', p: 0.04 }, { id: 'holy_salt', p: 0.03 }],
    init(e) {
      e.setState('idle');
      e.cool = 60;
      e.sf = [e.facing, e.facing, e.facing];
      e.mode = [0, 0, 0];
    },
    ai(e, g) {
      const st = e.state;
      e.vx = 0;
      const want = U.sign(e.dxp()) || e.facing;
      if (st === 'idle') {
        e.mode = [0, 0, 0];
        if (want !== e.facing && Math.abs(e.dxp()) > 6) {
          e.setState('turn');
          sfx('bone_rattle', 0.4, 0.8);
        } else if (--e.cool <= 0 && Math.abs(e.dxp()) < 250 && Math.abs(e.dyp()) < 110) e.setState('breathe');
      } else if (st === 'turn') {
        // the skulls turn one after another, top first
        for (let i = 0; i < 3; i++) if (e.stT === 1 + i * 6) e.sf[i] = want;
        if (e.stT >= 16) {
          e.facing = want;
          e.sf = [want, want, want];
          e.setState('idle');
          e.cool = Math.max(e.cool, 24);
        }
      } else if (st === 'breathe') {
        for (let i = 0; i < 3; i++) {
          const t0 = i * 14;
          if (e.stT === t0 + 1) sfx('fireball', 0.25, 0.6);
          if (e.stT >= t0 && e.stT < t0 + 16) e.mode[i] = 1;
          if (e.stT === t0 + 16) {
            e.mode[i] = 2;
            const y = e.fy + BP_SKULL_Y[i] + 4;
            e.shoot({ x: e.cx + e.sf[i] * 10, y, vx: e.sf[i] * 2.2, vy: 0, w: 8, h: 7, life: 220, el: 'fire', color: '#ff8020', drawFn: drawFireball,
              onWall: (q) => G.fx.burst(q.cx, q.cy, '#ff9030', 8, 1.4, { glow: true }) });
            sfx('fireball', 0.55, 1.1 - i * 0.1);
          }
          if (e.stT === t0 + 28) e.mode[i] = 0;
        }
        if (e.stT >= 60) {
          e.cool = 90 + e.rnd.int(0, 40);
          e.setState('idle');
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      e.blit(ctx, pillarImg(), sx, sy, 20, 54, e.facing < 0);
      for (let i = 0; i < 3; i++) {
        const m = e.mode[i];
        const y = sy + BP_SKULL_Y[i];
        const shake = e.state === 'turn' && e.stT >= 1 + i * 6 && e.stT < 6 + i * 6 ? 1 : 0;
        e.blit(ctx, pillarSkullImg(m), sx + shake, y, 11, 11, e.sf[i] < 0);
        if (m && !e.preview) G.gfx.addLight(sx + e.sf[i] * 4, y, m === 2 ? 34 : 18, '#ff8020', 0.8);
        if (m === 1) glow(ctx, sx + e.sf[i] * 4, y - 0.5, 1.5, '#ffb040', 0.7);
      }
    },
  });

  // ================================================================== PLAGUE DOCTOR (catacombs)
  const PD = {
    c1: '#5c4e46', c2: '#3c322e', c3: '#241e1c', c4: '#141012', m1: '#ece4d0', m2: '#bcb098', m3: '#80765e',
    lens: '#86d070', lensH: '#e0ffd0', glove: '#2a201c', cane: '#5a3420', knob: '#d4d8e0', vial: '#5ad860', vialD: '#2a8a38', band: '#7a1a22',
  };
  const PD_PAL = Object.values(PD);
  // pose: walk (f 0..3) | vialw | vial | canew | cane
  function doctorImg(pose, f) {
    return spr('plague_' + pose + f, 72, 72, PD_PAL, (c) => {
      c.translate(32, 68);
      const s = pose === 'walk' ? Math.sin((f / 4) * Math.PI * 2) : 0;
      const bob = pose === 'walk' ? Math.abs(s) * 0.8 : 0;
      const lean = pose === 'cane' ? 3 : pose === 'canew' ? -2 : 0;
      // legs and boots under the coat
      c.fillStyle = PD.c4;
      c.fillRect(Math.round(-4 - s * 3), -6, 3, 5);
      c.fillRect(Math.round(1 + s * 3), -6, 3, 5);
      c.fillRect(Math.round(-5 - s * 3), -2, 5, 2);
      c.fillRect(Math.round(1 + s * 3), -2, 5, 2);
      c.save();
      c.translate(lean * 0.5, bob);
      // back arm
      const ab = pose === 'vialw' ? [-11, -34] : pose === 'canew' ? [-6, -30] : [-6 - s, -20];
      gfx.limb(c, -3, -35, ab[0], ab[1], 3, PD.c3);
      gfx.circle(c, ab[0], ab[1] + 1, 1.6, PD.glove);
      // long waxed coat, flared skirt
      gfx.poly(c, [-5, -37, 5.5, -37, 7, -24, 9.5, -5, 4, -6.5, 0, -4.5, -4, -6, -9.5, -5, -7, -24], PD.c2);
      gfx.poly(c, [-5, -37, -1.5, -37, -2.5, -22, -4, -5.5, -9.5, -5, -7, -24], PD.c3);
      gfx.limb(c, 3.5, -34, 6, -7, 1, PD.c1);
      gfx.limb(c, 0.5, -24, 1, -6, 0.9, PD.c1);
      // belt with a satchel of vials
      gfx.limb(c, -6.5, -24, 7, -24, 1.6, PD.c4);
      gfx.poly(c, [-8, -23, -3, -23, -3, -17, -8, -17], PD.c1);
      c.fillStyle = PD.vial;
      c.fillRect(-7, -25, 1, 2);
      c.fillRect(-5, -25.5, 1, 2.5);
      // hat brim, crown and band
      gfx.ellipse(c, 0.5, -45, 9, 1.8, -0.05, PD.c4);
      gfx.poly(c, [-4.5, -45, 5, -45, 4.4, -52, -4, -52], PD.c4);
      gfx.limb(c, -4.4, -46.4, 4.8, -46.4, 1.3, PD.band);
      // hood/collar under the hat
      gfx.poly(c, [-5, -44, 4, -44, 5, -37, -5.5, -36], PD.c3);
      // beaked mask with round goggles
      gfx.ellipse(c, 2, -41, 3.6, 3.4, 0, PD.m2);
      gfx.poly(c, [3, -42.5, 9, -40, 14.5, -35.6, 13.4, -35, 8, -37, 3, -38], PD.m1);
      gfx.poly(c, [3, -38, 8, -37, 13.4, -35, 9, -35.6, 3.5, -36.5], PD.m3);
      gfx.circle(c, 4, -42, 1.8, PD.c4);
      gfx.circle(c, 4.2, -42, 1.2, PD.lens);
      c.fillStyle = PD.lensH;
      c.fillRect(4, -43, 1, 1);
      c.restore();
      // front arm: vial throw or cane
      let hand, caneTip;
      if (pose === 'vialw') hand = [-6, -48 - f];
      else if (pose === 'vial') hand = [12, -36];
      else if (pose === 'canew') hand = [2 - f, -50 - f];
      else if (pose === 'cane') hand = [14, -26];
      else hand = [7 + s, -22];
      const sx0 = 3 + lean * 0.5, sy0 = -35 + bob;
      const ex = (sx0 + hand[0]) / 2 + (pose === 'walk' ? 1 : 0), ey = (sy0 + hand[1]) / 2 + 2;
      gfx.limb(c, sx0, sy0, ex, ey, 3.2, PD.c2);
      gfx.limb(c, ex, ey, hand[0], hand[1], 2.8, PD.c2);
      gfx.circle(c, hand[0], hand[1], 1.7, PD.glove);
      if (pose === 'vialw' || pose === 'walk') {
        if (pose === 'vialw') {
          c.fillStyle = PD.vial;
          c.fillRect(hand[0] - 1, hand[1] - 5, 2.4, 4);
          c.fillStyle = PD.m1;
          c.fillRect(hand[0] - 1, hand[1] - 6, 2.4, 1);
        }
      }
      if (pose !== 'vial' && pose !== 'vialw') {
        // the cane: carried as a walking stick, raised, or swept down
        const a = pose === 'canew' ? -2.4 : pose === 'cane' ? 0.35 : 1.35;
        caneTip = [hand[0] + Math.cos(a) * 20, hand[1] + Math.sin(a) * 20];
        gfx.limb(c, hand[0] - Math.cos(a) * 2, hand[1] - Math.sin(a) * 2, caneTip[0], caneTip[1], 1.7, PD.cane);
        gfx.circle(c, hand[0] - Math.cos(a) * 2.5, hand[1] - Math.sin(a) * 2.5, 1.7, PD.knob);
      }
    });
  }
  function vialImg(k) {
    return spr('plague_vi' + k, 12, 12, PD_PAL, (c) => {
      c.translate(6, 6);
      c.rotate((k * Math.PI) / 4);
      c.fillStyle = PD.vialD;
      c.fillRect(-2, -1, 4, 5);
      c.fillStyle = PD.vial;
      c.fillRect(-1.5, -0.5, 3, 4);
      c.fillStyle = PD.m1;
      c.fillRect(-1, -3.5, 2, 2.5);
      c.fillStyle = PD.cane;
      c.fillRect(-1, -4.5, 2, 1);
      c.fillStyle = PD.lensH;
      c.fillRect(-1, 0, 1, 2);
    });
  }
  function drawPuddle(q, ctx, sx, sy) {
    const fade = Math.min(1, q.life / 24);
    ctx.save();
    ctx.globalAlpha = 0.85 * fade;
    ctx.fillStyle = '#1e5a26';
    ctx.fillRect(Math.round(sx - q.w / 2), Math.round(sy), q.w, 3);
    ctx.fillStyle = '#4ac050';
    ctx.fillRect(Math.round(sx - q.w / 2 + 2), Math.round(sy), q.w - 4, 2);
    ctx.fillStyle = '#9af08a';
    for (let i = 0; i < 4; i++) {
      const bx = sx - q.w / 2 + 3 + ((i * 7 + q.t * 0.3) % (q.w - 6));
      const by = sy - ((q.t * 0.4 + i * 5) % 8);
      ctx.fillRect(Math.round(bx), Math.round(by), 1 + (i % 2), 1 + (i % 2));
    }
    ctx.restore();
    G.gfx.addLight(sx, sy, 30, '#60e060', 0.5 * fade);
  }
  def('plague_doctor', {
    name: N('Plague Doctor', 'Médico de la peste'),
    desc: N('He came to cure the catacombs of their dead and found no cure for himself. Keep clear of his vials, and of his cane.', 'Vino a curar las catacumbas de sus muertos y no encontró cura para sí mismo. Mantente lejos de sus frascos, y de su bastón.'),
    area: 'catacombs', hp: 150, atk: 58, def: 6, exp: 85, w: 16, h: 42, gold: [70, 260],
    el: 'hit', weak: ['fire'], blood: '#5a7a3a',
    drops: [{ id: 'antidote', p: 0.08 }, { id: 'inkpot_amulet', p: 0.01 }, { id: 'elixir', p: 0.004 }],
    init(e) {
      e.setState('walk');
      e.cool = 50 + e.rnd.int(0, 40);
      e.caneCool = 0;
    },
    ai(e, g) {
      const st = e.state, d = e.dxp();
      if (e.caneCool > 0) e.caneCool--;
      if (st === 'walk') {
        e.face();
        const ad = Math.abs(d);
        let want = ad < 84 ? -U.sign(d) : ad > 150 ? U.sign(d) : 0;
        if (want && !canStep(e, g, want)) want = 0;
        e.vx = want * (want === -e.facing ? 0.7 : 0.5);
        if (e.cool > 0) e.cool--;
        if (ad < 38 && Math.abs(e.dyp()) < 34 && e.caneCool <= 0) e.setState('canew');
        else if (e.cool <= 0 && ad < 230 && Math.abs(e.dyp()) < 120) e.setState('vialw');
      } else if (st === 'vialw') {
        e.vx = 0;
        e.face();
        if (e.stT === 6) sfx('magic_cast', 0.3, 0.6);
        if (e.stT >= 20) {
          e.shoot({ x: e.cx - e.facing * 3, y: e.y - 6, vx: U.clamp(d / 52, -3, 3), vy: -4.2, grav: 0.18, w: 7, h: 7, life: 220, wall: false, el: 'poison', status: 'poison', chance: 0.5,
            upd: (q, g2) => {
              const room = g2.room;
              const floor = q.vy > 0 && P.floorAt(room, q.cx, q.y + q.h + q.vy + 0.5);
              if (floor || P.solidAt(room, q.cx + q.vx, q.cy)) {
                q.dead = true;
                sfx('holy_water', 0.5, 0.7);
                G.fx.burst(q.cx, q.cy, '#7ae070', 10, 1.6);
                if (floor) {
                  const fy = Math.floor((q.y + q.h + q.vy + 0.5) / TS) * TS;
                  q.owner.shoot({ x: q.cx, y: fy - 3, vx: 0, vy: 0, w: 26, h: 6, life: 120, wall: false, pierce: true, el: 'poison', status: 'poison', chance: 0.5, dmg: Math.round(q.dmg * 0.6), drawFn: drawPuddle });
                }
              }
            },
            drawFn: (q, ctx, sx, sy) => ctx.drawImage(vialImg(Math.floor(q.t / 3) % 8), sx - 6, sy - 6) });
          sfx('swing_light', 0.4, 1.2);
          e.setState('vial');
        }
      } else if (st === 'vial') {
        e.vx = 0;
        if (e.stT >= 14) {
          e.cool = 80 + e.rnd.int(0, 40);
          e.setState('walk');
        }
      } else if (st === 'canew') {
        e.vx = 0;
        if (e.stT === 1) sfx('swing_light', 0.3, 0.6);
        if (e.stT >= 14) {
          e.setState('cane');
          sfx('swing_heavy', 0.6, 1.2);
        }
      } else if (st === 'cane') {
        e.vx = e.stT < 4 && canStep(e, g, e.facing) ? e.facing * 1.2 : 0;
        if (e.stT <= 6) strike(e, e.facing > 0 ? e.cx + 2 : e.cx - 34, e.y + 6, 32, 28);
        if (e.stT >= 10) e.setState('caner');
      } else if (st === 'caner') {
        e.vx = 0;
        if (e.stT >= 18) {
          e.caneCool = 60;
          e.setState('walk');
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      let img;
      if (st === 'vialw') img = doctorImg('vialw', Math.floor(e.stT / 4) % 2);
      else if (st === 'vial') img = doctorImg('vial', 0);
      else if (st === 'canew') img = doctorImg('canew', Math.floor(e.stT / 4) % 2);
      else if (st === 'cane' || st === 'caner') img = doctorImg('cane', 0);
      else img = doctorImg('walk', Math.abs(e.vx) > 0.05 ? Math.floor(e.t / 10) % 4 : 0);
      e.blit(ctx, img, sx, sy, 32, 68, e.facing < 0);
      if (st === 'vialw' && e.stT > 8) glow(ctx, sx - e.facing * 6, sy - 52, 2, '#7ae070', 0.7);
      if (st === 'canew' && e.stT > 6) glow(ctx, sx + e.facing * 2, sy - 50, 2, '#ffffff', 0.7);
    },
  });

  // ================================================================== CORPSE SPIDER (catacombs)
  const CS = { b1: '#f0e8d0', b2: '#c4ba9e', b3: '#8c826a', b4: '#4a4234', w1: '#8a8276', w2: '#5e574e', w3: '#38332e', eye: '#ff2a2a', web: '#f2f2ee' };
  const CS_PAL = Object.values(CS);
  function corpseSpiderDraw(c, pose, f) {
    const walk = pose === 'walk', rear = pose === 'rear', curl = pose === 'curl';
    const ph = (f / 4) * Math.PI * 2;
    const LEGS = [[15, -20, 24, 0], [8, -23, 12, 2.4], [-2, -23, -6, 4.7], [-10, -20, -19, 1.2]];
    const FAR = [[12, -19, 18, 3.6], [3, -20, 3, 5.9]];
    const leg = (L, i, near) => {
      const sw = walk ? Math.sin(ph + L[3]) * 2.6 : 0;
      const lift = walk ? Math.max(0, Math.cos(ph + L[3])) * 2 : 0;
      const hx = 0, hy = -10;
      let kx = L[0] + sw * 0.4, ky = L[1] - lift, fx = L[2] + sw, fy = -lift;
      if (rear && near && i < 2) {
        const wv = f ? (i ? 1.5 : -2) : 0;
        kx = L[0] + 2;
        ky = L[1] - 8 + wv * 0.5;
        fx = L[2] + 2 + wv * 0.5;
        fy = -27 + i * 4 + wv;
      }
      if (curl) {
        kx = hx + (L[0] - hx) * 0.5;
        ky = -22;
        fx = hx + (L[2] - hx) * 0.3;
        fy = -14;
      }
      const col = near ? CS.b2 : CS.b4;
      gfx.limb(c, hx, hy, kx, ky, 1.5, col);
      gfx.limb(c, kx, ky, fx, fy, 1.2, col);
      if (near) {
        gfx.circle(c, kx, ky, 1.1, CS.b1);
        c.fillStyle = CS.b3;
        c.fillRect(Math.round(fx - 0.5), Math.round(fy - 1), 1, 1);
      }
    };
    FAR.forEach((L, i) => leg(L, i, false));
    c.save();
    if (rear) {
      c.translate(-6, -10);
      c.rotate(-0.3);
      c.translate(6, 10);
    }
    // abdomen: a ribcage wrapped in grave cloth
    gfx.ellipse(c, -7, -11, 10, 6.4, -0.08, CS.w2);
    gfx.ellipse(c, -7.5, -13, 7.5, 3.4, -0.08, CS.w1);
    for (let i = 0; i < 4; i++) gfx.limb(c, -13 + i * 3.6, -16, -14 + i * 3.6, -6, 1.2, i % 2 ? CS.b2 : CS.b1);
    gfx.poly(c, [-16, -9, -11, -14, -9, -12.5, -14, -7], CS.w3);
    gfx.poly(c, [-6, -16, -1, -13, -2, -11, -7, -14], CS.w2);
    gfx.limb(c, -17, -11, -21, -6, 1.2, CS.w1); // trailing strip of shroud
    c.restore();
    LEGS.forEach((L, i) => leg(L, i, true));
    c.save();
    if (rear) {
      c.translate(-6, -10);
      c.rotate(-0.3);
      c.translate(6, 10);
    }
    // a human skull for a head, pixel by pixel, with finger-bone fangs
    const map = { 1: CS.b1, 2: CS.b2, 3: CS.b3, D: CS.b4, E: CS.eye };
    ['.11111..', '1111111.', '1111DD12', '211DE112', '2211D1D.', '.2121212', '..3333..'].forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (!map[ch]) return;
        c.fillStyle = map[ch];
        c.fillRect(2 + i, -15 + j, 1, 1);
      }));
    gfx.limb(c, 8, -7, 11, -4, 1.1, CS.b1);
    gfx.limb(c, 6.5, -7, 8.5, -3.6, 1, CS.b2);
    c.restore();
  }
  function corpseSpiderImg(pose, f) {
    return spr('cspider_' + pose + f, 60, 44, CS_PAL, (c) => {
      c.translate(30, 40);
      corpseSpiderDraw(c, pose, f);
    });
  }
  function webImg(k) {
    return spr('cspider_web' + k, 14, 14, CS_PAL, (c) => {
      c.translate(7, 7);
      c.rotate(k * 0.8);
      gfx.circle(c, 0, 0, 3.4, CS.web);
      gfx.circle(c, -0.8, -0.8, 1.6, '#ffffff');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        gfx.limb(c, 0, 0, Math.cos(a) * 6, Math.sin(a) * 6, 0.8, CS.b1);
      }
    });
  }
  def('corpse_spider', {
    name: N('Corpse Spider', 'Araña cadáver'),
    desc: N('Stitched together from ribs, finger bones and burial shrouds by something that missed having children. It drops from the vaults on a silver thread.', 'Cosida con costillas, falanges y sudarios por algo que echaba de menos tener hijos. Desciende de las bóvedas colgada de un hilo de plata.'),
    area: 'catacombs', hp: 120, atk: 56, def: 8, exp: 70, w: 26, h: 16, gold: [60, 220],
    el: 'cut', weak: ['fire'], bony: true, noBlood: true, blood: '#d8d0b8', stunTime: 8,
    drops: [{ id: 'antidote', p: 0.06 }, { id: 'thorn_scourge', p: 0.008 }],
    previewState: 'scuttle',
    init(e, g) {
      e.setState('scuttle');
      e.cool = 70;
      e.runT = 50;
      e.anchorY = null;
      const room = g && g.room;
      if (room) {
        // hang from the vault right above the spawn point when there is one
        let ty = Math.floor((e.fy - 1) / TS);
        for (let i = 0; i < 12; i++, ty--) {
          if (P.solidAt(room, e.cx, ty * TS + 8)) {
            const cy = (ty + 1) * TS;
            if (e.fy - cy >= e.h + 6) {
              e.anchorY = cy;
              e.y = cy + 6;
              e.flying = true;
              e.setState('hang');
            }
            break;
          }
        }
      }
    },
    onHit(e) {
      if (e.state === 'hang' || e.state === 'descend') {
        e.flying = false;
        e.setState('drop');
      }
    },
    ai(e, g) {
      const st = e.state, p = e.player;
      if (st === 'hang') {
        e.vx = 0;
        e.vy = Math.sin(e.t * 0.05) * 0.15;
        if (Math.abs(e.dxp()) < 110 && p.y > e.fy - 8) {
          e.setState('descend');
          sfx('bone_rattle', 0.4, 1.4);
        }
      } else if (st === 'descend') {
        // lowers itself on the thread down to the player's height, then lets go
        e.vx = 0;
        e.vy = 2.2;
        if (e.onGround || e.cy > p.cy - 4 || e.stT > 120) {
          e.flying = false;
          e.setState('drop');
        }
      } else if (st === 'drop') {
        if (e.onGround) {
          G.fx.dust(e.cx, e.fy, 4);
          sfx('bone_rattle', 0.5, 1);
          e.face();
          e.setState('scuttle');
        }
      } else if (st === 'scuttle') {
        if (e.stT === 1) {
          e.face();
          e.runT = 40 + e.rnd.int(0, 30);
        }
        // scuttles past the player, then turns
        if (!canStep(e, g, e.facing)) e.facing *= -1;
        if (e.stT > 10 && e.dxp() * e.facing < -60) e.facing *= -1;
        e.vx = canStep(e, g, e.facing) ? e.facing * 2.6 : 0;
        if (e.stT % 10 === 0) sfx('bone_rattle', 0.12, 2);
        if (--e.cool <= 0 && e.stT >= e.runT && near(e, 220, 90)) {
          e.face();
          e.setState('rear');
        }
      } else if (st === 'rear') {
        e.vx = 0;
        if (e.stT === 1) sfx('slime', 0.45, 1.2);
        if (e.stT >= 16) {
          const ox = e.cx + e.facing * 10, oy = e.y - 4;
          const a = Math.atan2(p.cy - oy, p.cx - ox);
          e.shoot({ x: ox, y: oy, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 0.6, grav: 0.04, w: 8, h: 8, life: 160, el: 'hit', color: '#f2f2ee',
            drawFn: (q, ctx, sx, sy) => ctx.drawImage(webImg(Math.floor(q.t / 4) % 4), sx - 7, sy - 7),
            onWall: (q) => G.fx.burst(q.cx, q.cy, '#f2f2ee', 8, 1.2) });
          sfx('slime', 0.6, 1.6);
          e.setState('rrec');
        }
      } else if (st === 'rrec') {
        e.vx = 0;
        if (e.stT >= 14) {
          e.cool = 60 + e.rnd.int(0, 40);
          e.setState('scuttle');
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      if ((st === 'hang' || st === 'descend') && e.anchorY != null && !e.preview) {
        // the silk thread up to the vault
        const top = Math.round(e.anchorY - (G.game ? G.game.camy : 0));
        ctx.fillStyle = '#e8e8f0';
        ctx.globalAlpha *= 0.8;
        ctx.fillRect(Math.round(sx + e.facing * 3), top, 1, Math.max(0, sy - 20 - top));
        ctx.globalAlpha = e.alpha;
      }
      let img;
      if (st === 'hang' || st === 'descend') img = corpseSpiderImg('curl', 0);
      else if (st === 'rear') img = corpseSpiderImg('rear', Math.floor(e.stT / 4) % 2);
      else if (st === 'drop') img = corpseSpiderImg('walk', 0);
      else img = corpseSpiderImg('walk', Math.abs(e.vx) > 0.1 ? Math.floor(e.t / 3) % 4 : 0);
      e.blit(ctx, img, sx, sy, 30, 40, e.facing < 0);
      if (st === 'rear' && e.stT > 6) glow(ctx, sx + e.facing * 8, sy - 22, 1.5, '#ff4040', 0.9);
    },
  });

  // ================================================================== AXE LORD (keep)
  const AX = {
    a1: '#62627a', a2: '#3c3c4c', a3: '#24242e', a4: '#121218', au: '#ccaa4e', auD: '#7a5e22', red: '#a81c2a', redD: '#5c0c16',
    h1: '#e6dab6', h2: '#ac9c72', eye: '#ff3838', st1: '#e2e6f0', st2: '#9ca2b6', st3: '#5a6076', wood: '#5a3a22',
  };
  const AX_PAL = Object.values(AX);
  // hand position per pose (sprite-local, facing right)
  const AX_HAND = { walk: [12, -30], raise: [-7, -68], throw: [18, -46], low: [-14, -22], lowthrow: [18, -16] };
  // battle axe drawn around its grip (origin), pointing along +x before rotation
  function axeShape(c) {
    gfx.limb(c, -4, 0, 15, 0, 2.2, AX.wood);
    gfx.limb(c, 15, 0, 17, 0, 2.4, AX.a3);
    // double crescent blade at the head
    gfx.poly(c, [11, -1, 13, -9, 17, -11, 19, -6, 16.5, -1], AX.st2);
    gfx.poly(c, [11, 1, 13, 9, 17, 11, 19, 6, 16.5, 1], AX.st2);
    gfx.poly(c, [16, -9.5, 17, -11, 19, -6, 17.5, -4], AX.st1);
    gfx.poly(c, [16, 9.5, 17, 11, 19, 6, 17.5, 4], AX.st1);
    gfx.limb(c, 12, -1.5, 12.5, -7, 0.9, AX.st3);
    gfx.limb(c, 12, 1.5, 12.5, 7, 0.9, AX.st3);
    c.fillStyle = AX.au;
    c.fillRect(13, -1.5, 3, 3);
  }
  function axeImg(k) {
    return spr('axelord_axe' + k, 44, 44, AX_PAL, (c) => {
      c.translate(22, 22);
      c.rotate((k / ANG) * Math.PI * 2);
      c.translate(-8, 0);
      axeShape(c);
    });
  }
  // pose: walk (f 0..3) | raise | throw | low | lowthrow ; armed: axe in hand
  function axeLordImg(pose, f, armed) {
    return spr('axelord_' + pose + f + (armed ? 'a' : ''), 84, 94, AX_PAL, (c) => {
      c.translate(38, 88);
      const ph = (f / 4) * Math.PI * 2, s = pose === 'walk' ? Math.sin(ph) : 0;
      const crouch = pose === 'low' || pose === 'lowthrow' ? 5 : 0;
      const bob = (pose === 'walk' ? Math.abs(Math.cos(ph)) : 0) + crouch;
      const lean = pose === 'throw' || pose === 'lowthrow' ? 4 : pose === 'raise' ? -3 : pose === 'low' ? -2 : 0;
      // tattered cape behind
      gfx.poly(c, [-5 + lean * 0.5, -50 + bob, 4 + lean * 0.5, -50 + bob, -2, -30 + bob, -6, -10, -9, -14, -12, -8, -14, -15, -12, -34 + bob], AX.redD);
      gfx.poly(c, [-5 + lean * 0.5, -50 + bob, -1 + lean * 0.5, -50 + bob, -7, -30 + bob, -9, -14, -12, -8, -13, -22], AX.red);
      // legs
      const legs = pose === 'walk' ? [[s * 6, 0], [-s * 6, 0]] : crouch ? [[9, 0], [-9, 0]] : pose === 'throw' ? [[8, 0], [-7, 0]] : [[4, 0], [-6, 0]];
      const leg = ([fx], i) => {
        const kx = fx * 0.55 + (crouch ? (i ? -4 : 6) : i ? -1 : 2);
        const ky = -13 + bob * 0.5 - crouch * 0.4;
        gfx.limb(c, i ? -3 : 3, -26 + bob, kx, ky, 6, i ? AX.a3 : AX.a2);
        gfx.limb(c, kx, ky, fx, -2, 5.4, i ? AX.a3 : AX.a2);
        gfx.circle(c, kx, ky, 3, i ? AX.a2 : AX.a1);
        gfx.poly(c, [fx - 3.5, -3.5, fx + 5, -3, fx + 6.5, 0.4, fx - 4, 0.4], AX.a4);
      };
      leg(legs[1], 1);
      leg(legs[0], 0);
      c.save();
      c.translate(lean, bob);
      // back arm
      gfx.limb(c, -6, -50, -11, -38, 5, AX.a3);
      gfx.limb(c, -11, -38, -10, -28, 4.4, AX.a3);
      gfx.circle(c, -10, -27, 2.6, AX.a4);
      // massive breastplate with gold trim and a crimson fauld
      gfx.poly(c, [-9, -28, 10, -28, 12, -48, 6, -54, -6, -54, -11, -48], AX.a2);
      gfx.poly(c, [1, -28, 10, -28, 12, -48, 6, -54, 1, -54], AX.a1);
      gfx.poly(c, [-9, -28, 10, -28, 11, -22, 5, -20, 0, -23, -5, -20, -10, -22], AX.red);
      gfx.limb(c, -9, -28.5, 10, -28.5, 1.6, AX.au);
      gfx.limb(c, 1, -52, 1, -30, 1, AX.au);
      gfx.limb(c, -4, -46, 7, -46, 1, AX.a3);
      gfx.limb(c, -4, -40, 8, -40, 1, AX.a3);
      // spiked pauldron
      gfx.ellipse(c, -2, -51, 8.5, 5.5, -0.1, AX.a2);
      gfx.ellipse(c, -1, -52.6, 6, 3, -0.1, AX.a1);
      gfx.poly(c, [-6, -55, -8, -61, -3, -56], AX.h2);
      gfx.poly(c, [0, -56, 0, -62, 3, -56], AX.h1);
      gfx.limb(c, -9, -49, 6, -48, 1, AX.au);
      // horned helm with a burning visor
      gfx.ellipse(c, 1.5, -60, 6, 6.6, 0, AX.a2);
      gfx.ellipse(c, 3, -61, 4, 4.8, 0, AX.a1);
      gfx.poly(c, [-4.5, -60, 7.5, -60, 8, -54, -4, -54], AX.a3);
      c.fillStyle = AX.a4;
      c.fillRect(2, -61, 6.5, 2);
      c.fillStyle = AX.eye;
      c.fillRect(5, -61, 3, 1);
      // great curved horns: one sweeps back, the other forward, both hooking upward
      gfx.poly(c, [-1, -63, -6, -64.5, -11, -68, -14, -74, -13, -79, -11, -74, -8, -70, -4, -67.5, 0, -66.5], AX.h2);
      gfx.poly(c, [-6, -65.6, -11, -69, -13.4, -74.5, -13, -78.5, -11.4, -74.5, -8.4, -70.6], AX.h1);
      gfx.poly(c, [4, -64.5, 9, -64.5, 14, -67, 17, -72, 17, -78, 15, -73, 12, -69.5, 8, -67.6, 4, -67.4], AX.h1);
      gfx.poly(c, [9, -66.4, 14, -68.6, 16.4, -73, 16.6, -77, 15, -73.4, 12, -70], AX.h2);
      c.restore();
      // front arm (+ the axe while it holds one)
      const h = AX_HAND[pose];
      const tr = (pose === 'raise' || pose === 'low') && f ? 1 : 0;
      const hx = h[0] - tr, hy = h[1] + (pose === 'walk' ? bob : crouch) - tr;
      const shx = 4 + lean, shy = -50 + bob;
      const ex = (shx + hx) / 2 + (pose === 'raise' ? -4 : 2), ey = (shy + hy) / 2 + (pose === 'raise' ? -2 : 3);
      if (armed) {
        const ang = pose === 'raise' ? -2.3 - f * 0.14 : pose === 'low' ? 2.6 + f * 0.12 : pose === 'walk' ? 1.75 : 0;
        c.save();
        c.translate(hx, hy);
        c.rotate(ang);
        axeShape(c);
        c.restore();
      }
      gfx.limb(c, shx, shy, ex, ey, 5.6, AX.a2);
      gfx.limb(c, ex, ey, hx, hy, 5, AX.a2);
      gfx.limb(c, shx + 0.6, shy - 0.6, ex + 0.6, ey - 0.6, 1.2, AX.a1);
      gfx.circle(c, ex, ey, 2.6, AX.au);
      gfx.circle(c, hx, hy, 3, AX.a3);
    });
  }
  def('axe_lord', {
    name: N('Axe Lord', 'Señor del hacha'),
    desc: N('The keep’s executioner, still wearing the black armour of his office. He never runs out of axes, and he never misses twice.', 'El verdugo del torreón, aún vestido con la armadura negra de su oficio. Nunca se queda sin hachas, y nunca falla dos veces.'),
    area: 'keep', hp: 280, atk: 70, def: 16, exp: 150, w: 24, h: 52, gold: [120, 450],
    pv: { s: 0.76 },
    el: 'hit', heavy: true, armored: true, weak: ['holy'], noBlood: true, blood: '#9aa0b4',
    drops: [{ id: 'high_potion', p: 0.06 }, { id: 'elixir', p: 0.01 }],
    init(e) {
      e.setState('walk');
      e.cool = 60;
      e.turnT = 0;
      e.armed = true;
      e.boomer = null;
    },
    ai(e, g) {
      const st = e.state, d = e.dxp();
      if (st === 'walk') {
        if (d * e.facing < 0 && Math.abs(d) > 8) {
          if (++e.turnT > 30) {
            e.facing *= -1;
            e.turnT = 0;
          }
        } else e.turnT = 0;
        const want = Math.abs(d) > 112 && d * e.facing > 0;
        e.vx = want && canStep(e, g, e.facing) ? e.facing * 0.4 : 0;
        if (e.vx && e.t % 30 === 0) sfx('stomp', 0.3, 0.6);
        if (e.cool > 0) e.cool--;
        else if (d * e.facing > 0 && Math.abs(d) < 250) {
          const high = e.dyp() < -30 || Math.abs(d) > 150 || e.rnd.chance(0.5);
          e.setState(high ? 'raise' : 'low');
        }
      } else if (st === 'raise') {
        e.vx = 0;
        if (e.stT === 1) sfx('swing_heavy', 0.5, 0.7);
        if (e.stT === 16) G.fx.spark(e.cx - e.facing * 8, e.y - 18, '#ffffff', 4);
        if (e.stT >= 26) {
          // a heavy axe hurled in a high arc, spinning like the hunters' own
          e.shoot({ x: e.cx + e.facing * 10, y: e.y - 6, vx: U.clamp(d / 70, -3, 3), vy: -6.4, grav: 0.2, w: 16, h: 16, life: 220, wall: false, el: 'cut', color: AX.st1,
            drawFn: (q, ctx, sx, sy) => ctx.drawImage(axeImg(((Math.floor(q.t / 2) * (q.vx < 0 ? -1 : 1)) % ANG + ANG) % ANG), sx - 22, sy - 22) });
          sfx('axe_throw', 0.7, 0.8);
          e.armed = false;
          e.setState('throw');
        }
      } else if (st === 'throw') {
        e.vx = 0;
        if (e.stT === 20) {
          e.armed = true;
          sfx('hit_metal', 0.3, 0.8);
        }
        if (e.stT >= 26) {
          e.cool = 70 + e.rnd.int(0, 40);
          e.setState('walk');
        }
      } else if (st === 'low') {
        e.vx = 0;
        if (e.stT === 1) sfx('swing_heavy', 0.5, 0.6);
        if (e.stT === 12) G.fx.spark(e.cx - e.facing * 14, e.fy - 14, '#ffffff', 4);
        if (e.stT >= 22) {
          // skims along the floor and comes back to his hand
          const dir = e.facing, owner = e;
          e.boomer = e.shoot({ x: e.cx + dir * 14, y: e.fy - 11, vx: dir * 3.7, vy: 0, w: 16, h: 14, life: 240, wall: false, el: 'cut', dir, color: AX.st1,
            upd: (q, g2) => {
              q.vx -= q.dir * 0.075;
              if (P.solidAt(g2.room, q.cx + U.sign(q.vx) * 9, q.cy) && q.vx * q.dir > 0) {
                q.vx = -q.dir * 1;
                G.fx.spark(q.cx, q.cy, '#ffffff', 5);
                sfx('hit_metal', 0.4, 1.2);
              }
              if (q.t % 8 === 0) sfx('swing_light', 0.25, 1.3);
              if (q.vx * q.dir < 0 && Math.abs(q.cx - owner.cx) < 10) {
                q.dead = true;
                owner.armed = true;
                sfx('hit_metal', 0.45, 0.9);
              }
              if (owner.dead && q.vx * q.dir < 0) q.life = Math.min(q.life, 30);
            },
            drawFn: (q, ctx, sx, sy) => ctx.drawImage(axeImg(((Math.floor(q.t / 2) * q.dir) % ANG + ANG) % ANG), sx - 22, sy - 22) });
          sfx('axe_throw', 0.7, 0.7);
          e.armed = false;
          e.setState('lowthrow');
        }
      } else if (st === 'lowthrow') {
        e.vx = 0;
        if (e.armed || e.stT > 150) {
          e.armed = true;
          e.cool = 60 + e.rnd.int(0, 40);
          e.setState('walk');
        }
      }
      e.move();
    },
    onDeath(e) {
      if (e.boomer) e.boomer.life = Math.min(e.boomer.life, 20);
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      let pose = 'walk', f = 0;
      if (st === 'raise') {
        pose = 'raise';
        f = Math.floor(e.stT / 4) % 2;
      } else if (st === 'throw') pose = e.stT < 14 ? 'throw' : 'walk';
      else if (st === 'low') {
        pose = 'low';
        f = Math.floor(e.stT / 4) % 2;
      }
      else if (st === 'lowthrow') pose = e.stT < 14 ? 'lowthrow' : 'walk';
      else f = Math.abs(e.vx) > 0.05 ? Math.floor(e.t / 12) % 4 : 0;
      e.blit(ctx, axeLordImg(pose, f, e.armed), sx, sy, 38, 88, e.facing < 0);
      if (!e.preview) G.gfx.addLight(sx + e.facing * 6, sy - 60, 22, '#ff3030', 0.5);
      if ((st === 'raise' && e.stT > 12) || (st === 'low' && e.stT > 8)) {
        const h = AX_HAND[pose];
        glow(ctx, sx + e.facing * (h[0] + (st === 'raise' ? -8 : -10)), sy + h[1] + (st === 'raise' ? -10 : 8), 3, '#ffffff', 0.5);
      }
    },
  });

  // ================================================================== BLOOD SKELETON (keep)
  const BS = { r1: '#ee6a62', r2: '#b42c2c', r3: '#721418', r4: '#3a0a0e', eye: '#ffe040', i1: '#a29486', i2: '#6a5c4e', i3: '#3a3028' };
  const BS_PAL = Object.values(BS);
  // pose: walk (f 0..3) | swind | slash | pile | rise (f 0..1)
  const BS_SKULL = ['.1111...', '111111..', '1111111.', '211DD11.', '221DE122', '22222D22', '.221D1D1', '..33333.', '...333..'];
  function bloodSkelImg(pose, f) {
    return spr('bskel_' + pose + f, 60, 56, BS_PAL, (c) => {
      c.translate(26, 54);
      const R = (x, y, w, h, col) => {
        c.fillStyle = col;
        c.fillRect(Math.round(x), Math.round(y), w, h);
      };
      if (pose === 'pile') {
        // a heap of red bones with the skull on top
        [[-9, -2, 3, -4], [-2, -1, 9, -3], [-7, -4, 5, -6], [0, -5, 10, -1]].forEach(([x1, y1, x2, y2], i) => {
          gfx.limb(c, x1, y1, x2, y2, 1.8, i % 2 ? BS.r2 : BS.r3);
          gfx.circle(c, x2, y2, 1.3, BS.r1);
        });
        R(-7, -8, 7, 4, BS.r4);
        R(-7, -8, 7, 1, BS.r1);
        R(-7, -6, 6, 1, BS.r1);
        const map = { 1: BS.r1, 2: BS.r2, 3: BS.r3, D: BS.r4, E: f ? BS.eye : BS.r4 };
        BS_SKULL.forEach((row, j) => [...row].forEach((ch, i) => map[ch] && R(1 + i, -14 + j, 1, 1, map[ch])));
        gfx.limb(c, -14, -1, 2, 0, 2, BS.i2);
        gfx.limb(c, 2, 0, 6, 0, 1.8, BS.i3);
        return;
      }
      const walk = pose === 'walk';
      const ph = (f / 4) * Math.PI * 2, s = walk ? Math.sin(ph) : 0;
      const low = pose === 'rise' ? (f ? 6 : 13) : 0;
      const bob = walk ? Math.round(Math.abs(Math.cos(ph)) * 0.8) : 0;
      const hipY = -19 + low + bob;
      // legs: thin bones with knobby knees (bent while reassembling)
      [[-1.5, -s], [1.5, s]].forEach(([hx, k], i) => {
        const fx = hx + k * 4 + (pose === 'slash' ? (i ? 4 : -3) : 0);
        const kx = (hx + fx) / 2 + 1.5 + low * 0.45, ky = (hipY - 1.5) / 2;
        const col = i ? BS.r1 : BS.r2;
        gfx.limb(c, hx, hipY, kx, ky, 1.6, col);
        gfx.limb(c, kx, ky, fx, -1.5, 1.4, col);
        gfx.circle(c, kx, ky, 1.3, col);
        gfx.limb(c, fx - 1, -1, fx + 3, -1, 1.6, i ? BS.r2 : BS.r3);
      });
      c.save();
      c.translate(pose === 'slash' ? 2 : 0, hipY);
      // pelvis and lumbar spine
      R(-4, -1, 8, 2, BS.r2);
      R(-4, -1, 8, 1, BS.r1);
      R(-2, 0, 1, 1, BS.r4);
      R(1, 0, 1, 1, BS.r4);
      R(-1, -5, 2, 4, BS.r2);
      R(-1, -3, 2, 1, BS.r3);
      // ribcage: dark interior, light ribs, spine at the back
      R(-1, -14, 6, 9, BS.r4);
      R(-2, -15, 2, 10, BS.r2);
      [[-13, 5], [-11, 5], [-9, 4], [-7, 3]].forEach(([y, w]) => R(0, y, w, 1, BS.r1));
      R(5, -12, 1, 1, BS.r2);
      R(5, -10, 1, 1, BS.r2);
      R(4, -8, 1, 1, BS.r2);
      // collarbone and neck
      R(-3, -15, 8, 1, BS.r1);
      R(-1, -17, 2, 2, BS.r2);
      // back arm
      const ab = pose === 'swind' ? [-8, -23] : pose === 'slash' ? [-6, -7] : [-4 - s * 2, -3];
      const ae = [(ab[0] - 3) / 2 - 1, (ab[1] - 14) / 2 + 2];
      gfx.limb(c, -2, -14, ae[0], ae[1], 1.4, BS.r3);
      gfx.limb(c, ae[0], ae[1], ab[0], ab[1], 1.3, BS.r3);
      gfx.circle(c, ab[0], ab[1], 1.1, BS.r3);
      // skull, pixel by pixel
      const map = { 1: BS.r1, 2: BS.r2, 3: BS.r3, D: BS.r4, E: BS.eye };
      BS_SKULL.forEach((row, j) => [...row].forEach((ch, i) => map[ch] && R(-3 + i, -26 + j, 1, 1, map[ch])));
      c.restore();
      // sword arm
      let hand, ang;
      if (pose === 'swind') {
        hand = [-4, -44 - f];
        ang = -2.5 - f * 0.15;
      } else if (pose === 'slash') {
        hand = [12, -26];
        ang = 0.25;
      } else {
        hand = [7 + s, -24 + bob];
        ang = 1.15;
      }
      hand = [hand[0], hand[1] + low];
      const sh = [3 + (pose === 'slash' ? 2 : 0), hipY - 14];
      const el = [(sh[0] + hand[0]) / 2 + 1, (sh[1] + hand[1]) / 2 + 2];
      // notched, rusty sword
      const L = 19, tx = hand[0] + Math.cos(ang) * L, ty = hand[1] + Math.sin(ang) * L;
      gfx.limb(c, hand[0], hand[1], tx, ty, 2.4, BS.i1);
      gfx.limb(c, hand[0] + Math.cos(ang) * 3, hand[1] + Math.sin(ang) * 3, tx, ty, 0.9, BS.i2);
      c.fillStyle = BS.i3;
      c.fillRect(Math.round(hand[0] + Math.cos(ang) * 9), Math.round(hand[1] + Math.sin(ang) * 9 - 1), 1, 1);
      c.fillRect(Math.round(hand[0] + Math.cos(ang) * 14), Math.round(hand[1] + Math.sin(ang) * 14 - 1), 1, 1);
      gfx.limb(c, hand[0] - Math.sin(ang) * 3, hand[1] + Math.cos(ang) * 3, hand[0] + Math.sin(ang) * 3, hand[1] - Math.cos(ang) * 3, 1.6, BS.i3);
      gfx.limb(c, sh[0], sh[1], el[0], el[1], 1.6, BS.r2);
      gfx.limb(c, el[0], el[1], hand[0], hand[1], 1.4, BS.r1);
      gfx.circle(c, el[0], el[1], 1.1, BS.r1);
      gfx.circle(c, hand[0], hand[1], 1.3, BS.r1);
    });
  }
  def('blood_skeleton', {
    name: N('Blood Skeleton', 'Esqueleto de sangre'),
    desc: N('Bones steeped in the keep’s cursed blood. Cut them down and they pull themselves together again; only fire or holy light lays them to rest.', 'Huesos empapados en la sangre maldita del torreón. Derríbalos y vuelven a recomponerse; solo el fuego o la luz sagrada les dan descanso.'),
    area: 'keep', hp: 90, atk: 64, def: 4, exp: 35, w: 14, h: 40, gold: [40, 160],
    el: 'cut', bony: true, noBlood: true, blood: '#c03030',
    drops: [{ id: 'red_wine', p: 0.03 }, { id: 'garnet_ring', p: 0.01 }],
    init(e) {
      e.setState('walk');
      e.cool = 30;
    },
    // a killing blow that is neither holy nor fire only knocks it apart
    onHit(e, hit) {
      if (e.hp <= 0 && hit.el !== 'holy' && hit.el !== 'fire') {
        e.hp = 1;
        e.active = false;
        e.contact = false;
        e.setState('pile');
        G.fx.debris(e.cx, e.cy, BS.r2, 10);
        sfx('bone_rattle', 0.8, 0.8);
      }
    },
    ai(e, g) {
      const st = e.state;
      if (st === 'walk') {
        e.face();
        const d = e.dxp();
        e.vx = Math.abs(d) > 26 && canStep(e, g, e.facing) ? e.facing * 0.62 : 0;
        if (e.vx && e.t % 20 === 0) sfx('bone_rattle', 0.12, 1.2);
        if (e.cool > 0) e.cool--;
        else if (Math.abs(d) < 46 && Math.abs(e.dyp()) < 30) e.setState('swind');
      } else if (st === 'swind') {
        e.vx = 0;
        if (e.stT === 1) sfx('bone_rattle', 0.35, 1.5);
        if (e.stT === 8) G.fx.spark(e.cx - e.facing * 4, e.y - 6, '#ffffff', 4);
        if (e.stT >= 16) {
          e.setState('slash');
          sfx('swing_light', 0.7, 0.85);
        }
      } else if (st === 'slash') {
        e.vx = e.stT < 4 && canStep(e, g, e.facing) ? e.facing * 1.5 : 0;
        if (e.stT <= 6) strike(e, e.facing > 0 ? e.cx + 2 : e.cx - 34, e.y + 2, 32, 30);
        if (e.stT >= 9) e.setState('srec');
      } else if (st === 'srec') {
        e.vx = 0;
        if (e.stT >= 18) {
          e.cool = 40 + e.rnd.int(0, 30);
          e.setState('walk');
        }
      } else if (st === 'pile') {
        e.vx *= 0.8;
        e.active = false;
        e.contact = false;
        if (e.stT > 200 && e.stT % 6 === 0) sfx('bone_rattle', 0.25, 0.9 + (e.stT - 200) / 80);
        if (e.stT >= 240) {
          e.setState('rise');
          sfx('bone_rattle', 0.6, 1.2);
        }
      } else if (st === 'rise') {
        e.vx = 0;
        if (e.stT % 6 === 0) G.fx.particle(e.cx + U.rnd(-6, 6), e.fy - U.rnd(0, 20), 0, -0.5, '#ff4040', 20, { glow: true });
        if (e.stT >= 30) {
          e.hp = e.maxHp;
          e.active = true;
          e.contact = true;
          e.cool = 30;
          e.face();
          e.setState('walk');
        }
      }
      e.move();
    },
    draw(e, ctx, sx, sy) {
      const st = e.state;
      let img;
      if (st === 'pile') {
        const shake = e.stT > 200 && e.stT % 4 < 2 ? 1 : 0;
        e.blit(ctx, bloodSkelImg('pile', e.stT > 160 ? 1 : 0), sx + shake, sy, 26, 54, e.facing < 0);
        return;
      }
      if (st === 'rise') img = bloodSkelImg('rise', e.stT < 15 ? 0 : 1);
      else if (st === 'swind') img = bloodSkelImg('swind', Math.floor(e.stT / 4) % 2);
      else if (st === 'slash' || st === 'srec') img = bloodSkelImg(st === 'slash' || e.stT < 8 ? 'slash' : 'walk', 0);
      else img = bloodSkelImg('walk', Math.abs(e.vx) > 0.05 ? Math.floor(e.t / 9) % 4 : 0);
      e.blit(ctx, img, sx, sy, 26, 54, e.facing < 0);
      if (st === 'swind' && e.stT > 6) glow(ctx, sx - e.facing * 6, sy - 46, 2, '#ffffff', 0.7);
    },
  });

  // @@ENEMIES-END@@ (new enemies are inserted above this line)

  // Debug overlay (G.DEBUG_HITBOX = true): hurtbox in green, attack boxes in red.
  MY.forEach((id) => {
    const d = G.ENEMIES[id];
    // spawned embedded in a solid tile (e.g. placed on a step)? climb out on top of it
    const init = d.init;
    d.init = function (e, g) {
      if (init) init(e, g);
      const room = g && g.room;
      if (!room || e.flying) return;
      for (let i = 0; i < 4 && P.rectSolid(room, e.x + 1, e.y, e.w - 2, e.h - 1); i++) e.y = (Math.floor((e.y + e.h - 1) / TS) - 1) * TS + TS - e.h;
    };
    // anything that fell into a bottomless pit is gone for good (no reward)
    const ai = d.ai;
    d.ai = function (e, g) {
      ai(e, g);
      if (g.room && e.y > g.room.ph + 96) e.dead = true;
    };
    const draw = d.draw;
    d.draw = function (e, ctx, sx, sy) {
      if (e.preview && d.pv) {
        // fit tall or floating sprites inside the bestiary portrait
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(d.pv.s || 1, d.pv.s || 1);
        draw(e, ctx, 0, d.pv.dy || 0);
        ctx.restore();
        return;
      }
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
