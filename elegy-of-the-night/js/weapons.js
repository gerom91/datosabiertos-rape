/* Elegy of the Night — weapons.js
 * Player projectiles: tome spells, sub-weapons (hearts), command spells (MP),
 * reflected shots and familiars.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, P = G.phys, gfx = G.gfx;

  class PlayerProj extends G.Ent {
    constructor(o) {
      super(Object.assign({ w: 8, h: 8, life: 120, grav: 0, wall: true, pierce: 0, rehit: 9999, z: 3, color: '#ffffff' }, o));
      this.x -= this.w / 2;
      this.y -= this.h / 2;
      this.team = 'player';
      this.hitId = 'p' + U.uid();
      this.hits = 0;
    }
    update(g) {
      this.t++;
      if (this.upd && this.upd(this, g) === false) return;
      this.vy += this.grav;
      this.x += this.vx;
      this.y += this.vy;
      if (--this.life <= 0) this.kill(g);
      if (this.wall && P.projHits(g.room, this.cx, this.cy)) {
        if (this.onWall) this.onWall(this, g);
        else this.kill(g);
      }
      if (this.offscreenDie && !this.onScreen(g)) this.dead = true;
    }
    onScreen(g) {
      return this.x + this.w > g.camx - 40 && this.x < g.camx + G.W + 40 && this.y + this.h > g.camy - 80 && this.y < g.camy + G.H + 40;
    }
    box() {
      return { x: this.x, y: this.y, w: this.w, h: this.h, dmg: this.dmg, el: this.el, id: this.hitId, rehit: this.rehit, status: this.status, kb: this.kb };
    }
    onHitEnemy(e, g) {
      this.hits++;
      if (this.hits > this.pierce) this.kill(g);
    }
    kill(g) {
      if (this.dead) return;
      this.dead = true;
      if (this.onDie) this.onDie(this, g);
    }
    draw(ctx, camx, camy) {
      if (this.drawFn) this.drawFn(this, ctx, Math.round(this.cx - camx), Math.round(this.cy - camy));
    }
  }
  G.PlayerProj = PlayerProj;

  function glowDot(ctx, x, y, r, col) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, U.rgba('#ffffff', 0.9));
    g.addColorStop(0.35, U.rgba(col, 0.8));
    g.addColorStop(1, U.rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  // ---- tome / misc projectiles ------------------------------------------------------------------
  G.spawnPlayerProj = function (kind, x, y, f, dmg, el) {
    const g = G.game;
    let p;
    switch (kind) {
      case 'ember':
        p = new PlayerProj({ x, y, vx: f * 3.6, vy: 0, w: 10, h: 10, dmg, el: 'fire', life: 90, color: '#ff7030' });
        p.drawFn = (p, ctx, sx, sy) => {
          glowDot(ctx, sx, sy, 10, '#ff6020');
          if (p.t % 2 === 0) G.fx.particle(p.cx, p.cy, -f * 0.5, U.rnd(-0.4, 0.2), '#ffb040', 14, { glow: true });
          gfx.addLight(sx, sy, 40, '#ff8040', 0.8);
        };
        break;
      case 'frost':
        for (let i = -1; i <= 1; i++) {
          const q = new PlayerProj({ x, y, vx: f * 4.2, vy: i * 0.9, w: 6, h: 6, dmg, el: 'ice', life: 70, color: '#a0e0ff' });
          q.drawFn = (p, ctx, sx, sy) => {
            ctx.fillStyle = '#e0f6ff';
            ctx.fillRect(sx - 3, sy - 1, 6, 2);
            ctx.fillRect(sx - 1, sy - 3, 2, 6);
            glowDot(ctx, sx, sy, 6, '#80c8ff');
          };
          g.add(q);
        }
        return;
      case 'bolt': {
        // strike a column ahead of the player
        const tx = x + f * 60;
        p = new PlayerProj({ x: tx, y: y - 40, vx: 0, vy: 0, w: 14, h: 100, dmg, el: 'thunder', life: 16, wall: false, pierce: 99, color: '#fff080' });
        G.audio.sfx('thunder', { vol: 0.6 });
        G.gfx.flash('#fff8c0', 3);
        p.drawFn = (p, ctx, sx, sy) => {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = U.rgba('#fff4a0', 0.9 * (p.life / 16));
          ctx.lineWidth = 2;
          ctx.beginPath();
          let yy = sy - 50, xx = sx;
          ctx.moveTo(xx, yy);
          while (yy < sy + 50) {
            yy += 8;
            xx = sx + U.rnd(-5, 5);
            ctx.lineTo(xx, yy);
          }
          ctx.stroke();
          ctx.restore();
          gfx.addLight(sx, sy, 70, '#fff4a0', 1);
        };
        break;
      }
      case 'sonic':
        p = new PlayerProj({ x, y, vx: f * 4.5, vy: 0, w: 10, h: 14, dmg, el: 'hit', life: 50, pierce: 2, color: '#d0a0ff' });
        p.drawFn = (p, ctx, sx, sy) => {
          ctx.strokeStyle = U.rgba('#d0a0ff', 0.8);
          ctx.lineWidth = 1;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(sx - f * i * 4, sy, 4 + i * 2, f > 0 ? -1 : Math.PI - 1, f > 0 ? 1 : Math.PI + 1);
            ctx.stroke();
          }
        };
        break;
    }
    if (p) g.add(p);
    return p;
  };

  // ---- sub-weapons ----------------------------------------------------------------------------------
  function count(g, kind) {
    let n = 0;
    for (const e of g.ents) if (e.subKind === kind && !e.dead) n++;
    return n;
  }
  G.throwSub = function (id, pl) {
    const g = G.game, f = pl.facing;
    const st = pl.st;
    const sw = G.SUBWEAPONS[id];
    const x = pl.cx + f * 8, y = pl.fy - (pl.crouch ? 16 : 30);
    const dmg = sw.atk + Math.floor(st.int * 0.6 + G.state.level * 0.8);
    let p;
    switch (id) {
      case 'dagger':
        if (count(g, id) >= 3) return false;
        p = new PlayerProj({ x, y, vx: f * 6.5, w: 12, h: 4, dmg, el: 'cut', life: 80, subKind: id });
        p.drawFn = (p, ctx, sx, sy) => {
          ctx.fillStyle = '#e0e4f0';
          ctx.fillRect(sx - 6, sy - 1, 9, 2);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(f > 0 ? sx + 3 : sx - 7, sy - 0.5, 3, 1);
          ctx.fillStyle = '#c9a24a';
          ctx.fillRect(f > 0 ? sx - 7 : sx + 3, sy - 2, 2, 4);
        };
        G.audio.sfx('dagger_throw');
        break;
      case 'axe':
        if (count(g, id) >= 2) return false;
        p = new PlayerProj({ x, y: y - 4, vx: f * 2.4, vy: -6.4, grav: 0.24, w: 16, h: 16, dmg, el: 'cut', life: 140, wall: false, pierce: 99, rehit: 20, offscreenDie: true, subKind: id });
        p.drawFn = (p, ctx, sx, sy) => {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.t * 0.35 * f);
          ctx.fillStyle = '#6a4a2a';
          ctx.fillRect(-1, -7, 2, 14);
          ctx.fillStyle = '#b8bcc8';
          ctx.beginPath();
          ctx.moveTo(0, -7);
          ctx.lineTo(7, -6);
          ctx.lineTo(6, 1);
          ctx.lineTo(1, -2);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        };
        G.audio.sfx('axe_throw');
        break;
      case 'holy_water':
        if (count(g, id) >= 2) return false;
        p = new PlayerProj({ x, y, vx: f * 2.6, vy: -2.4, grav: 0.3, w: 6, h: 6, dmg, el: 'holy', life: 90, subKind: id });
        p.drawFn = (p, ctx, sx, sy) => {
          ctx.fillStyle = '#c8e0ff';
          ctx.fillRect(sx - 2, sy - 3, 4, 6);
          ctx.fillStyle = '#4080ff';
          ctx.fillRect(sx - 2, sy - 1, 4, 4);
        };
        p.onWall = p.onDie = (p, g) => {
          if (p._burst) return;
          p._burst = true;
          p.dead = true;
          G.audio.sfx('holy_water');
          for (let i = -1; i <= 1; i++) {
            const fl = new PlayerProj({ x: p.cx + i * 12 * f, y: p.cy - 8, w: 12, h: 24, dmg, el: 'holy', life: 56 + i * 4, wall: false, pierce: 99, rehit: 14 });
            fl.upd = (q, g) => {
              q.vy = 0;
              // settle on the floor
              if (!P.floorAt(g.room, q.cx, q.fy + 1) && q.t < 20) q.y += 2;
            };
            fl.drawFn = (q, ctx, sx, sy) => {
              const h = 14 + Math.sin(q.t * 0.6) * 4;
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              ctx.fillStyle = U.rgba('#6ab0ff', 0.7);
              ctx.fillRect(sx - 4, sy + 12 - h, 8, h);
              ctx.fillStyle = U.rgba('#ffffff', 0.8);
              ctx.fillRect(sx - 2, sy + 12 - h + 3, 4, h - 4);
              ctx.restore();
              gfx.addLight(sx, sy, 30, '#80c0ff', 0.6);
            };
            g.add(fl);
          }
        };
        break;
      case 'cross':
        if (count(g, id) >= 1) return false;
        p = new PlayerProj({ x, y, vx: f * 5.5, w: 14, h: 14, dmg, el: 'holy', life: 140, wall: false, pierce: 99, rehit: 16, subKind: id });
        p.upd = (p, g) => {
          p.vx -= f * 0.11;
          if (p.t > 40 && Math.abs(p.cx - pl.cx) < 12 && Math.abs(p.cy - pl.cy) < 24) p.dead = true;
          if (p.t > 50) p.y += U.clamp(pl.cy - p.cy, -1.2, 1.2);
          if (p.t % 12 === 0) G.audio.sfx('cross_throw', { vol: 0.3 });
        };
        p.drawFn = (p, ctx, sx, sy) => {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.t * 0.3);
          ctx.fillStyle = '#ffd860';
          ctx.fillRect(-1.5, -6, 3, 12);
          ctx.fillRect(-6, -1.5, 12, 3);
          ctx.restore();
          gfx.addLight(sx, sy, 34, '#ffe080', 0.7);
        };
        G.audio.sfx('cross_throw');
        break;
      case 'stopwatch':
        if (g.timeStop > 0) return false;
        g.timeStop = st.flags.watchDiscount ? 300 : 180;
        G.audio.sfx('stopwatch');
        G.gfx.flash('#c0c8ff', 6);
        return true;
      case 'quill':
        if (count(g, id) >= 3) return false;
        p = new PlayerProj({ x, y, vx: f * 9, w: 14, h: 4, dmg, el: 'cut', life: 60, pierce: 3, subKind: id });
        p.drawFn = (p, ctx, sx, sy) => {
          ctx.fillStyle = '#f4f4ff';
          ctx.fillRect(sx - 7, sy - 1, 12, 2);
          ctx.fillStyle = '#c0c8e0';
          ctx.fillRect(f > 0 ? sx - 7 : sx + 1, sy - 2, 6, 1);
          ctx.fillStyle = '#20182a';
          ctx.fillRect(f > 0 ? sx + 5 : sx - 7, sy - 0.5, 2, 1);
          if (p.t % 2 === 0) G.fx.particle(p.cx - f * 6, p.cy, 0, 0.2, '#30204a', 18, { size: 1 });
        };
        G.audio.sfx('quill_throw');
        break;
      case 'inkwell':
        if (count(g, id) >= 2) return false;
        p = new PlayerProj({ x, y, vx: f * 2.8, vy: -3, grav: 0.3, w: 6, h: 6, dmg, el: 'dark', life: 90, subKind: id });
        p.drawFn = (p, ctx, sx, sy) => {
          ctx.fillStyle = '#20202a';
          ctx.fillRect(sx - 3, sy - 3, 6, 6);
          ctx.fillStyle = '#5a3aa0';
          ctx.fillRect(sx - 2, sy - 1, 4, 3);
        };
        p.onWall = p.onDie = (p, g) => {
          if (p._burst) return;
          p._burst = true;
          p.dead = true;
          G.audio.sfx('ink_bottle');
          const pool = new PlayerProj({ x: p.cx, y: p.cy - 4, w: 44, h: 10, dmg: Math.ceil(dmg * 0.7), el: 'dark', life: 200, wall: false, pierce: 999, rehit: 24, status: { poison: 0.5 } });
          pool.upd = (q, g) => {
            q.vy = 0;
            if (!P.floorAt(g.room, q.cx, q.fy + 1) && q.t < 24) q.y += 2;
          };
          pool.drawFn = (q, ctx, sx, sy) => {
            ctx.globalAlpha = Math.min(1, q.life / 30);
            ctx.fillStyle = '#1a1028';
            ctx.fillRect(sx - 22, sy + 2, 44, 3);
            ctx.fillStyle = '#3a2a6a';
            for (let i = -20; i < 20; i += 5) ctx.fillRect(sx + i, sy + 1 - Math.abs(Math.sin(q.t * 0.1 + i)) * 2, 2, 2);
            ctx.globalAlpha = 1;
          };
          pool.slow = true;
          g.add(pool);
        };
        break;
      case 'grimoire':
        if (count(g, id) >= 1) return false;
        for (let i = 0; i < 4; i++) {
          const q = new PlayerProj({ x: pl.cx, y: pl.cy, w: 10, h: 10, dmg, el: 'holy', life: 220, wall: false, pierce: 999, rehit: 18, subKind: id });
          q.upd = (q, g) => {
            const a = q.t * 0.09 + (i * Math.PI) / 2;
            const r = 22 + Math.min(14, q.t * 0.4);
            q.x = pl.cx + Math.cos(a) * r - q.w / 2;
            q.y = pl.cy + Math.sin(a) * r * 0.8 - q.h / 2;
            return false;
          };
          q.drawFn = (q, ctx, sx, sy) => {
            ctx.fillStyle = '#efe2c0';
            ctx.fillRect(sx - 3, sy - 4, 6, 8);
            ctx.fillStyle = '#8a6a4a';
            ctx.fillRect(sx - 2, sy - 2, 4, 1);
            ctx.fillRect(sx - 2, sy, 4, 1);
            gfx.addLight(sx, sy, 22, '#ffe0a0', 0.5);
          };
          q.lifeTick = true;
          g.add(q);
          const origUpd = q.upd;
          q.upd = (q2, g2) => {
            origUpd(q2, g2);
            if (--q2.life <= 0) q2.dead = true;
            return false;
          };
        }
        G.audio.sfx('page_orbit');
        return true;
    }
    if (p) g.add(p);
    return true;
  };

  // ---- spells ------------------------------------------------------------------------------------------
  G.castSpell = function (id, pl) {
    const g = G.game, f = pl.facing, st = pl.st;
    const x = pl.cx + f * 8, y = pl.cy - 6;
    switch (id) {
      case 'spirit': {
        const p = new PlayerProj({ x: pl.cx, y: pl.y, w: 10, h: 10, dmg: 12 + Math.round(st.int * 1.5), el: 'dark', life: 200, wall: false, pierce: 0 });
        p.vx = -f * 0.5;
        p.vy = -1.5;
        p.upd = (p, g) => {
          let best = null, bd = 1e9;
          for (const e of g.ents) if (e instanceof G.Enemy && !e.dead && e.active) {
            const d = Math.hypot(e.cx - p.cx, e.cy - p.cy);
            if (d < bd) {
              bd = d;
              best = e;
            }
          }
          if (best && p.t > 15) {
            const a = Math.atan2(best.cy - p.cy, best.cx - p.cx);
            p.vx += Math.cos(a) * 0.35;
            p.vy += Math.sin(a) * 0.35;
            const sp = Math.hypot(p.vx, p.vy);
            if (sp > 3.4) {
              p.vx *= 3.4 / sp;
              p.vy *= 3.4 / sp;
            }
          } else p.vy *= 0.95;
        };
        p.drawFn = (p, ctx, sx, sy) => {
          glowDot(ctx, sx, sy, 9, '#a0c0ff');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx - 2, sy - 2, 4, 4);
          if (p.t % 3 === 0) G.fx.particle(p.cx, p.cy, 0, 0, '#8090ff', 14, { glow: true });
        };
        G.audio.sfx('spell_spirit');
        g.add(p);
        break;
      }
      case 'hellfire': {
        G.audio.sfx('spell_fire');
        G.gfx.flash('#ff8040', 4);
        [-0.22, 0, 0.22].forEach((a, i) => {
          const p = new PlayerProj({ x, y, vx: Math.cos(a) * 4.2 * f, vy: Math.sin(a) * 4.2, w: 12, h: 12, dmg: 26 + Math.round(st.int * 2), el: 'fire', life: 80, pierce: 1 });
          p.drawFn = (p, ctx, sx, sy) => {
            glowDot(ctx, sx, sy, 12, '#ff5010');
            if (p.t % 2 === 0) G.fx.particle(p.cx, p.cy, -f * 0.6, U.rnd(-0.5, 0.5), '#ffa030', 16, { glow: true });
            gfx.addLight(sx, sy, 50, '#ff7030', 0.9);
          };
          g.later(i * 6, () => g.add(p));
        });
        break;
      }
      case 'dark_meta':
        pl.buffs.darkMeta = 720;
        G.audio.sfx('spell_dark');
        G.fx.burst(pl.cx, pl.cy, '#c02040', 30, 2.5, { glow: true });
        G.gfx.flash('#600010', 6);
        break;
      case 'soul_steal': {
        G.audio.sfx('spell_soul_steal');
        G.gfx.flash('#ff2040', 10);
        G.gfx.shake(4, 30);
        let total = 0;
        for (const e of g.ents) {
          if (!(e instanceof G.Enemy) || e.dead || !e.active) continue;
          if (e.x + e.w < g.camx || e.x > g.camx + G.W || e.y + e.h < g.camy || e.y > g.camy + G.H) continue;
          const hp0 = e.hp;
          e.takeHit({ dmg: 40 + Math.round(st.int * 3), el: 'dark', id: 'ss' + U.uid(), noCrit: true }, g);
          total += Math.max(0, hp0 - Math.max(0, e.hp));
          for (let i = 0; i < 8; i++) g.later(i * 3, () => G.fx.soul(e.cx, e.cy, pl.cx, pl.cy, '#ff4060'));
        }
        g.later(30, () => pl.heal(Math.min(st.hpMax, Math.round(total * 0.5) + 10)));
        break;
      }
      case 'ink_lance': {
        G.audio.sfx('spell_ink');
        const len = 230;
        const p = new PlayerProj({ x: f > 0 ? pl.cx + 8 + len / 2 : pl.cx - 8 - len / 2, y: pl.fy - 30, w: len, h: 10, dmg: 22 + Math.round(st.int * 2.2), el: 'dark', life: 14, wall: false, pierce: 99 });
        p.drawFn = (p, ctx, sx, sy) => {
          const a = p.life / 14;
          ctx.fillStyle = U.rgba('#1a0c2a', a);
          ctx.fillRect(sx - len / 2, sy - 4 * a, len, 8 * a);
          ctx.fillStyle = U.rgba('#a070ff', a);
          ctx.fillRect(sx - len / 2, sy - 1, len, 2);
          gfx.addLight(sx, sy, 60, '#8050ff', 0.6);
        };
        g.add(p);
        G.gfx.shake(2, 8);
        break;
      }
      case 'belmont_ward': {
        G.audio.sfx('spell_holy');
        for (let i = 0; i < 4; i++) {
          const q = new PlayerProj({ x: pl.cx, y: pl.cy, w: 12, h: 12, dmg: 14 + Math.round(st.int * 1.2), el: 'holy', life: 320, wall: false, pierce: 999, rehit: 20 });
          q.upd = (q, g) => {
            const a = q.t * 0.07 + (i * Math.PI) / 2;
            q.x = pl.cx + Math.cos(a) * 30 - q.w / 2;
            q.y = pl.cy + Math.sin(a) * 26 - q.h / 2;
            if (--q.life <= 0) q.dead = true;
            return false;
          };
          q.drawFn = (q, ctx, sx, sy) => {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(q.t * 0.1);
            ctx.fillStyle = '#ffe070';
            ctx.fillRect(-1.5, -6, 3, 12);
            ctx.fillRect(-5, -2.5, 10, 3);
            ctx.restore();
            gfx.addLight(sx, sy, 30, '#ffe080', 0.7);
          };
          g.add(q);
        }
        break;
      }
      case 'crimson_requiem': {
        G.audio.sfx('spell_dark');
        G.gfx.flash('#a00020', 6);
        for (let i = 0; i < 12; i++) {
          g.later(i * 5, () => {
            const bx = pl.cx + U.rnd(-120, 120);
            const p = new PlayerProj({ x: bx, y: g.camy - 10, vx: 0, vy: 7, w: 8, h: 18, dmg: 30 + Math.round(st.int * 2.4), el: 'dark', life: 60, wall: false, pierce: 3 });
            p.drawFn = (p, ctx, sx, sy) => {
              ctx.fillStyle = '#c01030';
              ctx.fillRect(sx - 2, sy - 9, 4, 16);
              ctx.fillStyle = '#ff6070';
              ctx.fillRect(sx - 1, sy - 9, 1, 14);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(sx - 1, sy + 6, 2, 3);
            };
            g.add(p);
          });
        }
        break;
      }
    }
  };

  // reflected enemy projectile → becomes a player projectile
  G.convertToPlayerProj = function (ep, g) {
    ep.dead = true;
    const p = new PlayerProj({ x: ep.cx, y: ep.cy, vx: ep.vx, vy: ep.vy, w: ep.w, h: ep.h, dmg: ep.dmg * 2, el: ep.el, life: 90 });
    p.drawFn = (p, ctx, sx, sy) => glowDot(ctx, sx, sy, 8, '#e0e8ff');
    g.add(p);
  };

  // ---- familiars ----------------------------------------------------------------------------------------
  class Familiar extends G.Ent {
    constructor(kind, pl) {
      super({ x: pl.cx - 20, y: pl.y - 10, w: 10, h: 10, kind, z: 4 });
      this.pl = pl;
      this.cool = 0;
      this.target = null;
      this.familiar = true;
    }
    update(g) {
      this.t++;
      const pl = this.pl;
      if (this.cool > 0) this.cool--;
      let tx = pl.cx - pl.facing * 22, ty = pl.y - 6 + Math.sin(this.t * 0.08) * 4;
      if (this.kind === 'bat') {
        if (!this.target || this.target.dead) {
          this.target = null;
          let bd = 110;
          for (const e of g.ents) if (e instanceof G.Enemy && !e.dead && e.active && e.alpha > 0.5) {
            const d = Math.hypot(e.cx - this.cx, e.cy - this.cy);
            if (d < bd) {
              bd = d;
              this.target = e;
            }
          }
        }
        if (this.target && this.cool <= 0) {
          tx = this.target.cx;
          ty = this.target.cy;
          if (Math.abs(this.cx - tx) < 10 && Math.abs(this.cy - ty) < 12) {
            this.target.takeHit({ dmg: 6 + G.state.level * 2, el: 'cut', id: 'fam' + this.t, noCrit: true, kb: 0.5 }, g);
            this.cool = 40;
            this.target = null;
          }
        }
      } else if (this.kind === 'faerie') {
        const s = G.state;
        if (this.cool <= 0) {
          let used = null;
          if (s.hp < pl.st.hpMax * 0.3) used = ['high_potion', 'potion', 'roast_fowl', 'bread'].find((i) => G.invCount(s, i) > 0);
          else if (s.status.poison > 0 && G.invCount(s, 'antidote')) used = 'antidote';
          else if (s.status.curse > 0 && G.invCount(s, 'holy_salt')) used = 'holy_salt';
          if (used) {
            G.useItem(used, true);
            G.fx.text(this.cx, this.y - 6, G.tr(G.ITEMS[used].name), '#ffb0f0');
            this.cool = 480;
          }
        }
      }
      const sp = this.kind === 'bat' && this.target ? 0.12 : 0.06;
      this.vx += (tx - this.cx) * sp * 0.1;
      this.vy += (ty - this.cy) * sp * 0.1;
      this.vx *= 0.88;
      this.vy *= 0.88;
      this.x += this.vx;
      this.y += this.vy;
    }
    draw(ctx, camx, camy) {
      const sx = Math.round(this.cx - camx), sy = Math.round(this.cy - camy);
      if (this.kind === 'bat') {
        const img = G.drawBat(this.t + 7);
        ctx.drawImage(img, sx - 16, sy - 12);
      } else {
        glowDot(ctx, sx, sy, 10, '#ff90e0');
        ctx.fillStyle = '#ffe0f8';
        ctx.fillRect(sx - 1, sy - 2, 3, 4);
        const w = Math.sin(this.t * 0.5) * 3;
        ctx.fillStyle = 'rgba(255,220,250,0.8)';
        ctx.fillRect(sx - 4, sy - 3 + w * 0.3, 3, 2);
        ctx.fillRect(sx + 2, sy - 3 - w * 0.3, 3, 2);
        gfx.addLight(sx, sy, 34, '#ff90e0', 0.6);
      }
    }
  }
  G.Familiar = Familiar;
})();
