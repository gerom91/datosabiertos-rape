/* Elegy of the Night — enemy_base.js
 * Enemy framework used by data_enemies.js / data_bosses.js.
 *
 *   G.defEnemy('ghoul', {
 *     name:{en,es}, desc:{en,es}, area:'entrance',
 *     hp, atk, def, exp, w, h,              // stats & hitbox (px)
 *     el:'hit',                             // contact damage element
 *     weak:['fire'], resist:['dark'], absorb:[], immune:['poison'],
 *     drops:[{id:'potion', p:0.05}],        // item ids, 'gold', 'heart'...
 *     gold:[5,20], flying:false, heavy:false, touch:true,
 *     init(e, g){}, ai(e, g){}, draw(e, ctx, sx, sy){}, onHit(e,hit,g){}, onDeath(e,g){}
 *   });
 * In ai(): e.move() applies gravity (unless flying) and tile collision.
 * Useful helpers on e: face(), dxp(), dyp(), dist(), seesPlayer(), shoot(), state/stT, rnd.
 * Sprites: G.gfx.sprite(key, w, h, drawFn, {outline, palette}) then
 *          G.gfx.drawAnchored(img, sx, sy, ax, ay, e.facing < 0)
 * (sx, sy) passed to draw() is the screen position of the enemy's feet centre.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, P = G.phys, gfx = G.gfx;

  G.ENEMIES = G.ENEMIES || {};
  G.defEnemy = function (id, def) {
    def.id = id;
    def.weak = def.weak || [];
    def.resist = def.resist || [];
    def.absorb = def.absorb || [];
    def.immune = def.immune || [];
    def.drops = def.drops || [];
    if (def.touch === undefined) def.touch = true;
    G.ENEMIES[id] = def;
  };

  class Enemy extends G.Ent {
    constructor(def, sp, g) {
      super({ w: def.w || 16, h: def.h || 32 });
      this.def = def;
      this.id = def.id;
      this.sp = sp || {};
      this.g = g;
      this.x = (sp ? sp.x : 0) - this.w / 2;
      this.y = (sp ? sp.y : 0) - this.h;
      this.hp = this.maxHp = Math.round(def.hp * (sp && sp.hpMul ? sp.hpMul : 1));
      this.atk = def.atk;
      this.defn = def.def || 0;
      this.facing = sp && sp.facing ? sp.facing : -1;
      this.state = 'idle';
      this.stT = 0;
      this.flash = 0;
      this.hitIds = new Map();
      this.stun = 0;
      this.flying = !!def.flying;
      this.alpha = 1;
      this.z = 1;
      this.boss = !!def.boss;
      this.active = true;
      this.invuln = 0;
      this.contact = def.touch;
      this.rnd = U.RNG(U.uid() * 977);
      this.spawnX = this.x;
      this.spawnY = this.y;
      if (def.init) def.init(this, g);
    }
    get player() {
      return this.g.player;
    }
    setState(s) {
      this.state = s;
      this.stT = 0;
    }
    face() {
      this.facing = this.player.cx < this.cx ? -1 : 1;
      return this.facing;
    }
    dxp() {
      return this.player.cx - this.cx;
    }
    dyp() {
      return this.player.cy - this.cy;
    }
    dist() {
      return Math.hypot(this.dxp(), this.dyp());
    }
    seesPlayer(range) {
      return this.dist() < (range || 160) && P.los(this.g.room, this.cx, this.cy - 4, this.player.cx, this.player.cy);
    }
    onScreen(pad) {
      const g = this.g;
      pad = pad || 0;
      return this.x + this.w > g.camx - pad && this.x < g.camx + G.W + pad && this.y + this.h > g.camy - pad && this.y < g.camy + G.H + pad;
    }
    move() {
      if (!this.flying) this.vy = Math.min(this.vy + (this.grav == null ? 0.3 : this.grav), 7);
      P.move(this, this.g.room);
    }
    // move without tile collision (ghosts)
    drift() {
      this.x += this.vx;
      this.y += this.vy;
    }
    shoot(o) {
      const p = new EnemyProj(Object.assign({ owner: this, dmg: this.atk, el: 'hit' }, o));
      this.g.add(p);
      return p;
    }
    hurtPlayer(dmg, el, o) {
      return this.player.hurt(dmg == null ? this.atk : dmg, el || this.def.el || 'hit', this.cx, o);
    }
    hurtbox() {
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    }
    update(g) {
      this.t++;
      this.stT++;
      if (this.flash > 0) this.flash--;
      if (this.invuln > 0) this.invuln--;
      if (this.stun > 0) {
        this.stun--;
        this.vx *= 0.85;
        if (!this.flying) this.move();
        else this.drift();
        return;
      }
      // bosses sleep until the player comes close, then (optionally) play an
      // intro scene, lock the arena and start fighting
      if (this.boss && !this.started) {
        const d = this.def;
        const wake = d.wake ? d.wake(this, g) : Math.abs(this.dxp()) < (d.wakeDist || 150) && Math.abs(this.dyp()) < 120;
        if (!wake || (G.story && G.story.active)) {
          if (d.idle) d.idle(this, g);
          return;
        }
        this.started = true;
        const go = () => {
          g.startBoss(this);
          if (d.onStart) d.onStart(this, g);
        };
        if (d.introScene && !G.state.flags['scene_' + d.introScene]) G.story.play(d.introScene, { after: go });
        else go();
        return;
      }
      if (this.boss && g.boss !== this) return;
      if (this.def.ai) this.def.ai(this, g);
      // contact damage
      if (this.contact && this.active && !this.dead && this.alpha > 0.3) {
        const p = g.player;
        const hb = this.hurtbox();
        const pb = p.hurtbox();
        if (hb.x < pb.x + pb.w && hb.x + hb.w > pb.x && hb.y < pb.y + pb.h && hb.y + hb.h > pb.y) {
          if (p.diveT) return; // dive kick handled as an attack
          this.hurtPlayer(this.atk, this.def.el, this.def.touchStatus);
        }
      }
    }
    /* hit: {dmg, el, id, status, drain, crit?, kb} */
    takeHit(hit, g) {
      if (this.dead || this.invuln > 0 || !this.active) return false;
      const last = this.hitIds.get(hit.id);
      if (last !== undefined && this.t - last < (hit.rehit || 9999)) return false;
      this.hitIds.set(hit.id, this.t);
      const d = this.def;
      const s = G.state;
      if (d.onHitCheck && d.onHitCheck(this, hit, g) === false) return false;
      let dmg = hit.dmg;
      const el = hit.el || 'hit';
      let mult = 1, tag = null;
      if (d.immune.includes(el)) {
        mult = 0;
        tag = 'immune';
      } else if (d.absorb.includes(el)) {
        mult = -0.5;
        tag = 'absorb';
      } else if (d.weak.includes(el)) {
        mult = 1.5;
        tag = 'weak';
      } else if (d.resist.includes(el)) {
        mult = 0.5;
        tag = 'resist';
      }
      const lck = g.player.st.lck;
      const crit = !hit.noCrit && Math.random() < Math.min(0.3, 0.03 + lck / 220);
      dmg = Math.max(mult > 0 ? 1 : 0, Math.round((dmg - this.defn / 2) * Math.abs(mult) * U.rnd(0.92, 1.08) * (crit ? 1.5 : 1)));
      if (mult < 0) {
        this.hp = Math.min(this.maxHp, this.hp + dmg);
        G.fx.number(this.cx, this.y - 4, dmg, '#60ff90');
        return true;
      }
      this.hp -= dmg;
      this.flash = 8;
      this.lastHitT = this.t;
      g.lastHitEnemy = this;
      g.lastHitT = 180;
      G.fx.number(this.cx + U.rnd(-4, 4), this.y - 2, dmg, crit ? '#ffe040' : tag === 'weak' ? '#ff9a40' : '#ffffff', crit);
      if (crit) G.audio.sfx('crit');
      else G.audio.sfx(d.hitSfx || (d.armored ? 'hit_metal' : d.bony ? 'hit_bone' : 'hit_flesh'), { pitch: U.rnd(0.92, 1.08), vol: 0.8 });
      G.fx.spark(hit.x != null ? hit.x : this.cx, hit.y != null ? hit.y : this.cy, d.blood || '#ffe0a0', 5);
      if (!d.noBlood) G.fx.blood(this.cx, this.cy, g.player.cx < this.cx ? 1 : -1, 5, d.blood);
      // player on-hit effects
      const st = g.player.st;
      if (st.hpOnHit) g.player.heal(st.hpOnHit, true);
      if (hit.drain) g.player.heal(Math.max(1, Math.round(dmg * hit.drain)), true);
      if (g.player.buffs.darkMeta > 0) g.player.heal(Math.max(1, Math.round(dmg * 0.25)), true);
      if (hit.status && hit.status.poison && !d.immune.includes('poison') && Math.random() < hit.status.poison) this.poison = 300;
      if (d.onHit) d.onHit(this, hit, g);
      g.hitstop = Math.max(g.hitstop, this.hp <= 0 ? 5 : 2);
      if (!d.heavy && !this.boss && this.hp > 0) {
        this.vx = (g.player.cx < this.cx ? 1 : -1) * (hit.kb || 1.6);
        if (!this.flying && this.onGround) this.vy = -1;
        this.stun = d.stunTime == null ? 10 : d.stunTime;
      }
      if (this.hp <= 0) this.die(g);
      return true;
    }
    die(g) {
      if (this.dead) return;
      this.dead = true;
      const d = this.def, s = G.state;
      if (d.onDeath) d.onDeath(this, g);
      if (this.boss) {
        g.endBoss(this);
        const rw = d.reward || {};
        // rewards appear where the boss fell and drop to the floor (always reachable)
        const room = g.room;
        const cx = U.clamp(this.cx, 48, room.pw - 48), cy = U.clamp(Math.min(this.cy, this.fy - 24), 40, room.ph - 40);
        g.later(70, () => {
          const drop = (id, x) => {
            const e = G.dropPickup(g, 'item:' + id, x, cy);
            if (e) {
              e.life = -1;
              e.vy = -2;
              e.t = -30;
            }
          };
          (rw.items || []).forEach((id, i) => drop(id, cx + (i - (rw.items.length - 1) / 2) * 22));
          if (rw.relic && !G.hasRelic(s, rw.relic)) drop(rw.relic, cx);
          if (rw.scene) G.story.play(rw.scene);
        });
      }
      if (!d.noDeathFx) {
        G.fx.explode(this.cx, this.cy, this.boss ? 2 : Math.min(2, (this.w * this.h) / 600 + 0.6));
        G.audio.sfx(this.boss ? 'boss_die' : this.w * this.h > 900 ? 'enemy_die_big' : 'enemy_die');
      }
      // exp, bestiary
      if (!this.sp.noExp) {
        const ups = G.gainExp(s, d.exp || 0);
        if (ups > 0) g.onLevelUp(ups);
      }
      s.kills++;
      s.bestiary[d.id] = (s.bestiary[d.id] || 0) + 1;
      // drops (LCK raises chances)
      if (!this.sp.noDrops) {
        const luck = 1 + g.player.st.lck / 60 + (g.player.st.flags.rareBoost ? 0.5 : 0);
        let dropped = false;
        for (const dr of d.drops) {
          if (!dropped && Math.random() < dr.p * luck) {
            G.dropPickup(g, dr.id, this.cx, this.cy);
            dropped = true;
          }
        }
        if (!dropped) {
          const r = Math.random();
          if (d.gold && r < 0.3) G.dropPickup(g, 'gold:' + U.irnd(d.gold[0], d.gold[1]), this.cx, this.cy);
          else if (r < 0.42) G.dropPickup(g, 'heart', this.cx, this.cy);
        }
        if (g.player.st.flags.heartsOnKill && Math.random() < g.player.st.flags.heartsOnKill) G.dropPickup(g, 'heart_big', this.cx, this.y);
      }
    }
    draw(ctx, camx, camy) {
      if (this.alpha <= 0) return;
      const sx = Math.round(this.cx - camx), sy = Math.round(this.fy - camy);
      if (this.alpha < 1) ctx.globalAlpha = this.alpha;
      if (this.def.draw) {
        this._flashDraw = this.flash > 0 && this.flash % 4 < 2;
        this.def.draw(this, ctx, sx, sy);
      } else {
        ctx.fillStyle = this.flash ? '#fff' : '#a03030';
        ctx.fillRect(sx - this.w / 2, sy - this.h, this.w, this.h);
      }
      ctx.globalAlpha = 1;
      if (this.poison > 0 && this.t % 12 < 6) {
        ctx.fillStyle = '#60ff60';
        ctx.fillRect(sx - 1, sy - this.h - 4, 2, 2);
      }
    }
    // draw helper honouring hit flash
    blit(ctx, img, sx, sy, ax, ay, flip) {
      if (this._flashDraw) img = gfx.whiteOf(img);
      gfx.drawAnchored(img, sx, sy, ax, ay, flip, null, ctx);
    }
  }
  G.Enemy = Enemy;

  // poison tick for enemies is handled in game.update via e.poison

  G.ENT.enemy = function (sp, g) {
    const def = G.ENEMIES[sp.id];
    if (!def) {
      if (root.console && !G._warned) console.warn('Unknown enemy ' + sp.id);
      return null;
    }
    if (def.boss && G.state.flags['boss_' + sp.id]) {
      // the boss is gone; re-offer essential rewards the player never picked up
      const rw = def.reward || {};
      const need = [];
      if (rw.relic && !G.hasRelic(G.state, rw.relic)) need.push(rw.relic);
      (rw.items || []).forEach((id) => {
        const it = G.ITEMS[id];
        if (it && it.kind === 'key' && !G.invCount(G.state, id)) need.push(id);
      });
      need.forEach((id, i) => {
        const e = G.dropPickup(g, 'item:' + id, sp.x + i * 22, sp.y - 30);
        if (e) e.life = -1;
      });
      return null;
    }
    if (sp.flag && G.state.flags[sp.flag]) return null;
    const Cls = def.cls || Enemy;
    return new Cls(def, sp, g);
  };

  // ---- enemy projectiles ----------------------------------------------------------------------
  class EnemyProj extends G.Ent {
    /* o: {x,y,vx,vy,w,h,dmg,el,life,grav,wall:true (dies on walls), color, kind, draw(p,ctx,sx,sy),
     *     status, chance, magic, unblockable, update(p,g), spin} */
    constructor(o) {
      super(Object.assign({ w: 6, h: 6, life: 240, grav: 0, wall: true, kind: 'orb', color: '#ff6040', z: 3 }, o));
      this.x -= this.w / 2;
      this.y -= this.h / 2;
      this.team = 'enemy';
    }
    update(g) {
      this.t++;
      if (g.timeStop > 0 && !this.ignoreTime) return;
      if (this.upd) this.upd(this, g);
      this.vy += this.grav;
      this.x += this.vx;
      this.y += this.vy;
      if (--this.life <= 0) this.dead = true;
      if (this.wall && P.projHits(g.room, this.cx, this.cy)) {
        this.dead = true;
        G.fx.burst(this.cx, this.cy, this.color, 5, 1);
        if (this.onWall) this.onWall(this, g);
      }
      const p = g.player;
      const pb = p.hurtbox();
      if (this.x < pb.x + pb.w && this.x + this.w > pb.x && this.y < pb.y + pb.h && this.y + this.h > pb.y) {
        // mirror shield reflection
        if (p.guarding && (this.cx - p.cx) * p.facing > 0 && !this.unblockable) {
          const sh = G.ITEMS[p.guardItem];
          if (sh && sh.reflect) {
            this.vx = -this.vx * 1.2;
            this.vy = -this.vy * 0.5;
            this.team = 'player';
            this.reflected = true;
            G.audio.sfx('block');
            G.convertToPlayerProj(this, g);
            return;
          }
        }
        const r = p.hurt(this.dmg, this.el, this.cx, { projectile: true, status: this.status, chance: this.chance, magic: this.magic, unblockable: this.unblockable });
        if (r !== 'ignored' && !this.pierce) this.dead = true;
      }
    }
    draw(ctx, camx, camy) {
      const sx = Math.round(this.cx - camx), sy = Math.round(this.cy - camy);
      if (this.drawFn) return this.drawFn(this, ctx, sx, sy);
      const c = this.color;
      if (this.kind === 'bone') {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(this.t * 0.3);
        ctx.fillStyle = '#e8e0c8';
        ctx.fillRect(-4, -1, 8, 2);
        ctx.fillRect(-5, -2, 2, 4);
        ctx.fillRect(3, -2, 2, 4);
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = U.rgba(c, 0.35);
      ctx.fillRect(sx - this.w / 2 - 2, sy - this.h / 2 - 2, this.w + 4, this.h + 4);
      ctx.restore();
      ctx.fillStyle = c;
      ctx.fillRect(sx - this.w / 2, sy - this.h / 2, this.w, this.h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
      gfx.addLight(sx, sy, 28, c, 0.6);
    }
  }
  G.EnemyProj = EnemyProj;
})();
