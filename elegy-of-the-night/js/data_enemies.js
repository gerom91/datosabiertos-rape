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
