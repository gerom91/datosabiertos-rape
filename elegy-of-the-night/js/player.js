/* Elegy of the Night — player.js
 * Alucard: movement (walk, crouch, variable jump, double jump, super jump,
 * dive kick, backdash), two-handed equipment attacks, shields, sub-weapons
 * (Up + Attack), command-input spells, bat / mist / wolf forms, damage,
 * status effects, cape & hair physics and drawing.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, P = G.phys, I = G.input;

  const WALK = 2.0, JUMP = 6.75, DJUMP = 5.8, GRAV = 0.3;
  const HUM_W = 12, HUM_H = 40, CROUCH_H = 26;
  const FORMS = {
    human: { w: HUM_W, h: HUM_H },
    bat: { w: 14, h: 12 },
    mist: { w: 16, h: 16 },
    wolf: { w: 24, h: 14 },
  };

  function Player(game, x, y) {
    this.g = game;
    this.x = x - HUM_W / 2;
    this.y = y - HUM_H;
    this.w = HUM_W;
    this.h = HUM_H;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.form = 'human';
    this.crouch = false;
    this.atk = null;
    this.inv = 0;
    this.hurtT = 0;
    this.dashT = 0;
    this.airJumps = 0;
    this.flipT = 0;
    this.superT = 0;
    this.diveT = 0;
    this.landT = 0;
    this.castT = 0;
    this.ramT = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.dropT = 0;
    this.dead = false;
    this.deadT = 0;
    this.locked = false; // cutscenes
    this.t = 0;
    this.walkT = 0;
    this.mpT = 0;
    this.poisonT = 0;
    this.buffs = { darkMeta: 0 };
    this.boxes = [];
    this.guarding = false;
    this.afterImgs = [];
    this.lastPose = null;
    this.mist = false;
    this.refreshStats();
    this.resetCape();
  }
  G.Player = Player;
  const PR = Player.prototype;

  Object.defineProperty(PR, 'cx', { get() { return this.x + this.w / 2; } });
  Object.defineProperty(PR, 'cy', { get() { return this.y + this.h / 2; } });
  Object.defineProperty(PR, 'fy', { get() { return this.y + this.h; } });

  PR.refreshStats = function () {
    const s = G.state;
    this.st = G.calcStats(s, this.buffs.darkMeta > 0 ? { atk: 0 } : null);
    s.hp = Math.min(s.hp, this.st.hpMax);
    s.mp = Math.min(s.mp, this.st.mpMax);
    s.hearts = Math.min(s.hearts, this.st.heartsMax);
  };

  PR.hurtbox = function () {
    return { x: this.x + 1, y: this.y + 2, w: this.w - 2, h: this.h - 3 };
  };

  // ---- cape & hair ----------------------------------------------------------------------
  PR.resetCape = function () {
    const fx = this.cx, fy = this.fy;
    this.cape = [];
    for (let i = 0; i < 7; i++) {
      const x = fx - this.facing * (4 + i * 0.5), y = fy - 33 + i * 5;
      this.cape.push({ x, y, px: x, py: y });
    }
    this.hair = [];
    for (let i = 0; i < 4; i++) {
      const x = fx - this.facing * (3 + i * 2), y = fy - 41 + i * 3;
      this.hair.push({ x, y, px: x, py: y });
    }
  };
  function simChain(pts, ax, ay, seg, grav, windX, windY, floorY, damp) {
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
        const diff = (d - seg) / d;
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
  PR.simCape = function () {
    const f = this.facing, fx = this.cx, fy = this.fy;
    const pose = this.lastPose;
    const crouch = this.crouch || (pose && pose.hipY > -16);
    const ln = pose ? pose.lean : 0;
    const shY = (pose ? pose.hipY : -21) - Math.cos(ln) * 12.5;
    const shX = (pose ? pose.hipX : 0) + Math.sin(ln) * 12.5 - 3;
    const ax = fx + shX * f, ay = fy + shY;
    // keep the cape behind: a gentle push backwards + motion wind
    const windX = -f * 0.07 - this.vx * 0.075;
    const windY = this.vy > 0 ? -Math.min(this.vy, 6) * 0.055 : -this.vy * 0.02;
    simChain(this.cape, ax, ay, crouch ? 3.6 : 5, 0.3, windX, windY, fy - 1, 0.86);
    // never in front of the body
    for (let i = 1; i < this.cape.length; i++) {
      const p = this.cape[i];
      const local = (p.x - fx) * f;
      if (local > 2 - i * 0.2) p.x = fx + (2 - i * 0.2) * f;
    }
    const hx = fx + ((pose ? pose.hipX + Math.sin(ln) * 18.5 : 0) - 3) * f;
    const hy = fy + (pose ? pose.hipY - Math.cos(ln) * 18.5 : -39.5) - 1;
    simChain(this.hair, hx, hy, 3.4, 0.2, -f * 0.06 - this.vx * 0.05, this.vy > 0 ? -Math.min(this.vy, 6) * 0.03 : 0, fy - 4, 0.78);
  };

  // ---- form changes --------------------------------------------------------------------
  PR.canFit = function (w, h, cx, fy, mist) {
    return !P.rectSolid(this.g.room, cx - w / 2, fy - h, w, h, { mist });
  };
  PR.setForm = function (f, silent) {
    const s = G.state;
    if (f === this.form) return true;
    const dim = FORMS[f];
    const cx = this.cx;
    let fy = this.fy;
    if (f === 'bat' || f === 'mist') fy = this.cy + dim.h / 2;
    if (!this.canFit(dim.w, dim.h, cx, fy, f === 'mist')) {
      // try aligning feet instead
      fy = this.fy;
      if (!this.canFit(dim.w, dim.h, cx, fy, f === 'mist')) return false;
    }
    if (f !== 'human' && !silent) {
      const cost = f === 'wolf' && this.st.flags.wolfBoost ? 0 : 3;
      if (s.mp < cost) {
        G.audio.sfx('menu_error');
        return false;
      }
      s.mp -= cost;
    }
    this.form = f;
    this.w = dim.w;
    this.h = dim.h;
    this.x = cx - dim.w / 2;
    this.y = fy - dim.h;
    this.crouch = false;
    this.atk = null;
    this.guarding = false;
    this.mist = f === 'mist';
    this.noOneWay = f === 'bat' || f === 'mist';
    this.vy = Math.min(this.vy, 0);
    this.ramT = 0;
    if (!silent) {
      G.audio.sfx('transform');
      G.fx.burst(this.cx, this.cy, f === 'mist' ? '#c8d0e8' : '#8a2030', 14, 2.2);
      if (f === 'wolf') G.audio.sfx('wolf_howl', { vol: 0.6 });
    }
    if (f === 'human') this.resetCape();
    return true;
  };

  // ---- damage ---------------------------------------------------------------------------
  /* hurt(raw, el, srcX, o) o: {status, chance, magic, unblockable, projectile}
   * returns 'blocked' | 'hit' | 'ignored' */
  PR.hurt = function (raw, el, srcX, o) {
    o = o || {};
    const s = G.state;
    if (this.dead || this.locked) return 'ignored';
    if (this.inv > 0 && !o.force) return 'ignored';
    if (this.form === 'mist' && !o.magic) return 'ignored';
    if (G.DEBUG_GOD) return 'ignored';
    const fromFront = srcX == null || (srcX - this.cx) * this.facing > 0;
    let dmg = raw;
    if (this.guarding && fromFront && !o.unblockable) {
      const sh = G.ITEMS[this.guardItem];
      dmg = Math.round(dmg * (1 - (sh ? sh.guard : 0.5)));
      G.audio.sfx('block');
      G.fx.spark(this.cx + this.facing * 8, this.cy - 4, '#ffffff', 6);
      this.vx = -this.facing * 1.5;
      if (dmg <= 0 || o.projectile) {
        this.inv = 12;
        return 'blocked';
      }
    }
    const res = this.st.res[el] || 0;
    dmg = Math.max(1, Math.round((dmg - this.st.def / 2) * (1 - res)));
    if (G.diffMul) dmg = Math.max(1, Math.round(dmg * G.diffMul));
    s.hp -= dmg;
    G.fx.number(this.cx, this.y - 4, dmg, '#ff5060');
    G.audio.sfx('player_hurt');
    G.gfx.shake(3, 10);
    if (o.status && !this.st.immune[o.status] && Math.random() < (o.chance == null ? 1 : o.chance)) {
      s.status[o.status] = o.status === 'poison' ? 1800 : 600;
      G.audio.sfx(o.status === 'poison' ? 'status_poison' : 'status_curse');
    }
    this.inv = 75;
    if (s.hp <= 0) {
      s.hp = 0;
      if (G.invCount(s, 'life_apple') > 0) {
        G.invRemove(s, 'life_apple');
        s.hp = Math.ceil(this.st.hpMax / 2);
        G.audio.sfx('heal');
        G.fx.burst(this.cx, this.cy, '#ffd040', 30, 3);
        G.ui.notify(G.tr(G.ITEMS.life_apple.name) + '!', '#ffd040');
        this.inv = 120;
        return 'hit';
      }
      this.die();
      return 'hit';
    }
    if (this.form === 'human') {
      this.atk = null;
      this.guarding = false;
      this.hurtT = 22;
      this.crouch = false;
      this.setHeight(HUM_H);
      this.vx = (srcX != null && srcX > this.cx ? -1 : 1) * 2.2;
      this.vy = -3.2;
      this.onGround = false;
      this.dashT = 0;
      this.superT = 0;
      this.diveT = 0;
    } else {
      this.vx = (srcX != null && srcX > this.cx ? -1 : 1) * 2.5;
      this.hurtT = 12;
    }
    return 'hit';
  };

  PR.die = function () {
    if (this.dead) return;
    if (this.form !== 'human') this.setForm('human', true);
    this.dead = true;
    this.deadT = 0;
    this.atk = null;
    this.vx = -this.facing * 1.5;
    this.vy = -3;
    G.audio.sfx('player_die');
    G.audio.stopMusic(2);
    G.state.deaths = (G.state.deaths || 0) + 1;
  };

  PR.heal = function (n, silent) {
    const s = G.state;
    const before = s.hp;
    s.hp = Math.min(this.st.hpMax, s.hp + n);
    if (!silent && s.hp > before) G.fx.number(this.cx, this.y - 4, s.hp - before, '#60ff90');
  };

  PR.setHeight = function (h) {
    if (this.h === h) return true;
    const fy = this.fy;
    if (h > this.h && P.rectSolid(this.g.room, this.x, fy - h, this.w, h - this.h + 1)) return false;
    this.y = fy - h;
    this.h = h;
    return true;
  };

  // ---- main update ------------------------------------------------------------------------
  PR.update = function () {
    const g = this.g, s = G.state;
    this.t++;
    this.boxes.length = 0;
    if (this.inv > 0) this.inv--;
    if (this.landT > 0) this.landT--;
    if (this.dropT > 0) this.dropT--;
    if (this.castT > 0) this.castT--;
    if (this.buffs.darkMeta > 0) {
      this.buffs.darkMeta--;
      if (this.t % 6 === 0) G.fx.particle(this.cx + U.rnd(-6, 6), this.cy + U.rnd(-10, 10), 0, -0.6, '#c02040', 30);
    }

    if (this.dead) {
      this.deadT++;
      this.vx *= 0.94;
      this.vy = Math.min(this.vy + GRAV, 7);
      P.move(this, g.room);
      this.simCape();
      return;
    }

    // MP regeneration & status
    this.mpT += 1 + this.st.mpRegen * 0.8 + this.st.int * 0.02;
    if (this.mpT >= 48) {
      this.mpT = 0;
      if (this.form === 'bat') s.mp = Math.max(0, s.mp - 1);
      else if (this.form !== 'mist') s.mp = Math.min(this.st.mpMax, s.mp + 1);
    }
    if (this.form === 'mist' && this.t % 10 === 0) s.mp = Math.max(0, s.mp - 1);
    if (s.status.poison > 0) {
      s.status.poison--;
      if (++this.poisonT >= 100) {
        this.poisonT = 0;
        if (s.hp > 1) s.hp--;
      }
      if (s.status.poison === 0) this.refreshStats();
    }
    if (s.status.curse > 0) s.status.curse--;

    if (this.locked) {
      this.vx = 0;
      this.atk = null;
      this.vy = Math.min(this.vy + GRAV, 7);
      if (this.form !== 'human') this.vy = 0;
      P.move(this, g.room);
      this.simCape();
      return;
    }

    // form toggles
    if (I.pressed.bat && G.hasRelic(s, 'soul_bat')) this.toggleForm('bat');
    else if (I.pressed.mist && G.hasRelic(s, 'form_mist')) this.toggleForm('mist');
    else if (I.pressed.wolf && G.hasRelic(s, 'soul_wolf')) this.toggleForm('wolf');
    if ((this.form === 'bat' || this.form === 'mist') && s.mp <= 0) {
      if (!this.setForm('human', true)) this.vy = 0;
      else G.audio.sfx('transform');
    }

    if (this.form === 'bat') this.updateBat();
    else if (this.form === 'mist') this.updateMist();
    else if (this.form === 'wolf') this.updateWolf();
    else this.updateHuman();

    // spikes
    if (this.touchSpikes && this.inv <= 0) this.hurt(Math.max(8, Math.round(this.st.hpMax * 0.08)), 'cut', this.cx - this.facing * 4, { force: false });

    this.simCape();
    // afterimages
    if ((this.dashT > 0 || this.superT > 0 || (this.form === 'wolf' && Math.abs(this.vx) > 3.2) || this.ramT > 0) && this.t % 3 === 0 && this.lastSprite) {
      this.pushAfterImage();
    }
    for (const a of this.afterImgs) a.life--;
    U.removeIf(this.afterImgs, (a) => a.life <= 0);
  };

  PR.toggleForm = function (f) {
    if (this.form === f) {
      if (!this.setForm('human')) G.audio.sfx('menu_error');
      return;
    }
    if (this.form !== 'human' && !this.setForm('human', true)) return;
    if (!this.setForm(f) && this.form === 'human') {
      /* stays human */
    }
  };

  PR.updateHuman = function () {
    const g = this.g, s = G.state, room = g.room;
    const dir = (I.held.right ? 1 : 0) - (I.held.left ? 1 : 0);
    const cursed = s.status.curse > 0;
    if (this.hurtT > 0) {
      this.hurtT--;
      this.vy = Math.min(this.vy + GRAV, 7);
      P.move(this, room);
      this.afterMove(false);
      return;
    }
    if (I.pressed.jump) this.jumpBuf = 7;
    else if (this.jumpBuf > 0) this.jumpBuf--;
    if (this.onGround) {
      this.coyote = 6;
      this.airJumps = 0;
    } else if (this.coyote > 0) this.coyote--;

    // ---- attacks / sub-weapons / spells ----
    const a1 = I.pressed.attack, a2 = I.pressed.attack2;
    const canStart = !this.atk || this.atk.t >= this.atk.wind + this.atk.act;
    if ((a1 || a2) && canStart && !cursed) {
      const sp = this.findSpell();
      if (sp && a1) this.castSpell(sp);
      else if (a1 && I.held.up && s.sub) this.useSub();
      else this.startAttack(a1 ? 'rhand' : 'lhand');
    } else if (I.pressed.sub && s.sub && !cursed && canStart) this.useSub();

    // shield guard (held)
    this.guarding = false;
    if (!this.atk && this.onGround) {
      for (const [hand, act] of [['lhand', 'attack2'], ['rhand', 'attack']]) {
        const it = s.equip[hand] && G.ITEMS[s.equip[hand]];
        if (it && it.kind === 'shield' && I.held[act]) {
          this.guarding = true;
          this.guardItem = it.id;
        }
      }
    }

    // ---- crouch ----
    const wantCrouch = this.onGround && I.held.down && !this.dashT && !this.diveT;
    if (wantCrouch && !this.crouch && !(this.atk && !this.atk.crouch)) {
      this.crouch = true;
      this.setHeight(CROUCH_H);
    } else if (!wantCrouch && this.crouch && !(this.atk && this.atk.crouch)) {
      if (this.setHeight(HUM_H)) this.crouch = false;
    }

    // ---- backdash ----
    if (I.pressed.backdash && this.onGround && !this.dashT && (!this.atk || this.atk.t >= this.atk.wind + this.atk.act) && !this.crouch) {
      this.atk = null;
      this.dashT = 18;
      this.vx = -this.facing * 5.2;
      this.inv = Math.max(this.inv, 6);
      G.audio.sfx('backdash');
      G.fx.dust(this.cx, this.fy, 4);
    }

    // ---- horizontal ----
    let spd = WALK * (this.inWater ? 0.6 : 1);
    if (this.dashT > 0) {
      this.dashT--;
      if (this.dashT < 10) this.vx *= 0.86;
      if (!this.onGround && this.dashT < 12) this.vx *= 0.9;
    } else if (this.diveT > 0) {
      // keep dive velocity
    } else if (this.atk && this.onGround) {
      this.vx = 0;
    } else if (this.crouch || this.guarding) {
      this.vx = 0;
      if (dir && !this.atk) this.facing = dir;
    } else {
      this.vx = dir * spd;
      if (dir && (!this.atk || !this.onGround) && !(this.atk && !this.onGround)) this.facing = dir;
    }
    if (this.vx !== 0 && this.onGround && !this.atk && !this.dashT) this.walkT += Math.abs(this.vx) / WALK;

    // ---- jumping ----
    const onPlatform = this.onGround && this.standingOnOneWay();
    if (this.jumpBuf > 0 && !this.atk) {
      if ((this.onGround || this.coyote > 0) && I.held.down && onPlatform) {
        this.dropT = 14;
        this.y += 2;
        this.onGround = false;
        this.jumpBuf = 0;
        this.crouch = false;
        this.setHeight(HUM_H);
      } else if (G.hasRelic(s, 'gravity_boots') && (this.onGround || this.coyote > 0 || this.airJumps < 2) && I.matchMotion(['d', 'u'], this.facing, 24) && I.held.up) {
        this.superT = 24;
        this.vy = -10;
        this.onGround = false;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.crouch = false;
        this.setHeight(HUM_H);
        G.audio.sfx('super_jump');
        G.fx.burst(this.cx, this.fy, '#ffd080', 10, 2);
        I.clearMotion();
      } else if (this.onGround || this.coyote > 0) {
        if (this.crouch) {
          this.crouch = false;
          this.setHeight(HUM_H);
        }
        this.vy = -JUMP * (this.inWater ? 0.8 : 1);
        this.onGround = false;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.dashT = Math.min(this.dashT, 4);
        G.audio.sfx('jump', { vol: 0.6 });
      } else if (I.held.down && !this.diveT) {
        // dive kick
        this.diveT = 1;
        this.vx = this.facing * 4.2;
        this.vy = 5.5;
        this.jumpBuf = 0;
        this.superT = 0;
        G.audio.sfx('wolf_dash', { vol: 0.5 });
      } else if (G.hasRelic(s, 'leap_stone') && this.airJumps < 1 && !this.superT) {
        this.airJumps++;
        this.vy = -DJUMP;
        this.flipT = 24;
        this.jumpBuf = 0;
        this.diveT = 0;
        G.audio.sfx('double_jump');
        G.fx.ring(this.cx, this.fy, '#9ad0ff');
      }
    }

    // ---- gravity ----
    if (this.superT > 0) {
      this.superT--;
      this.vy = Math.min(this.vy, -9.5 + (24 - this.superT) * 0.05);
      if (this.t % 2 === 0) G.fx.particle(this.cx + U.rnd(-3, 3), this.fy, 0, 1, '#ffd080', 14);
    } else {
      let gmul = 1;
      if (this.vy < 0 && !I.held.jump && !this.flipT) gmul = 2.3;
      if (this.inWater) gmul *= 0.55;
      this.vy = Math.min(this.vy + GRAV * gmul, this.inWater ? 3.5 : 7);
    }
    if (this.flipT > 0) this.flipT--;

    P.move(this, room);
    if (this.hitCeil) this.superT = 0;
    this.afterMove(true);
    this.updateAttack();
  };

  PR.standingOnOneWay = function () {
    const room = this.g.room;
    const ty = Math.floor((this.fy + 1) / 16);
    const t1 = room.get(Math.floor((this.x + 1) / 16), ty), t2 = room.get(Math.floor((this.x + this.w - 1) / 16), ty);
    const ok = (t) => t === G.T.ONEWAY || t === G.T.EMPTY;
    return (t1 === G.T.ONEWAY || t2 === G.T.ONEWAY) && ok(t1) && ok(t2);
  };

  PR.afterMove = function (control) {
    if (this.onGround) {
      if (this.landV > 3.2) {
        this.landT = 6;
        G.audio.sfx('land', { vol: 0.5 });
        G.fx.dust(this.cx, this.fy, this.landV > 6 ? 6 : 3);
      }
      this.landV = 0;
      this.flipT = 0;
      this.superT = 0;
      if (this.diveT) {
        this.diveT = 0;
        this.vx = 0;
        G.gfx.shake(2, 6);
        G.fx.dust(this.cx, this.fy, 6);
      }
      if (this.atk && this.atk.air && !this.atk.keepOnLand) this.atk = null;
    }
    if (this.diveT) this.boxes.push({ x: this.cx - 8 + this.facing * 4, y: this.fy - 10, w: 16, h: 12, dmg: this.st.atkR + 4, el: 'hit', id: 'dive' + Math.floor(this.t / 20), dive: true });
  };

  // ---- attacks -------------------------------------------------------------------------------
  PR.weaponFor = function (hand) {
    const s = G.state;
    let id = s.equip[hand];
    let it = id ? G.ITEMS[id] : null;
    if (!it) {
      // two-handed weapon held in the other hand?
      const o = s.equip[hand === 'rhand' ? 'lhand' : 'rhand'];
      const oi = o && G.ITEMS[o];
      if (oi && oi.hands === 2) return oi;
      return G.ITEMS.fist;
    }
    return it;
  };

  PR.startAttack = function (hand) {
    const it = this.weaponFor(hand);
    if (it.kind === 'shield') return; // guarding handled separately
    if (this.dashT > 6) this.dashT = 0;
    const air = !this.onGround;
    this.atk = {
      hand, item: it, wt: it.wtype, t: 0, wind: it.wind, act: it.act, rec: it.rec, id: 'a' + U.uid(),
      crouch: this.crouch, air, fired: false, slashed: false,
    };
    if (it.hpCost) {
      G.state.hp = Math.max(1, G.state.hp - it.hpCost);
    }
  };

  PR.updateAttack = function () {
    const a = this.atk;
    if (!a) return;
    a.t++;
    const it = a.item, f = this.facing;
    const fx = this.cx, fy = this.fy;
    const actStart = a.wind, actEnd = a.wind + a.act;
    if (a.t === actStart) {
      const w = a.wt;
      if (w === 'whip') G.audio.sfx('whip');
      else if (w === 'great' || w === 'mace' || w === 'spear') G.audio.sfx('swing_heavy');
      else if (w === 'fist') G.audio.sfx('punch', { vol: 0.7 });
      else if (w !== 'tome') G.audio.sfx('swing_light', { pitch: U.rnd(0.95, 1.08) });
      if (w === 'tome' && !a.fired) {
        a.fired = true;
        G.audio.sfx('magic_cast', { vol: 0.6 });
        G.spawnPlayerProj(it.proj, fx + f * 10, fy - (a.crouch ? 16 : 30), f, this.attackPower(a.hand), it.el);
      }
      if (w !== 'whip' && w !== 'tome') {
        const kind = w === 'great' || w === 'mace' ? 'big' : w === 'spear' || w === 'rapier' || w === 'short' || w === 'fist' ? 'thrust' : 'arc';
        G.fx.slash(this, kind, it.glow || '#cfe0ff', a.crouch ? 15 : 29);
      }
      if (it.echo) this.g.later(8, () => G.fx.slash(this, 'arc', '#c8b0ff', 29));
    }
    if (a.t >= actStart && a.t < actEnd) {
      const box = this.attackBox(a);
      if (box) this.boxes.push(box);
    }
    if (a.t >= actEnd + a.rec) {
      this.atk = null;
      if (this.crouch && !I.held.down) {
        if (this.setHeight(HUM_H)) this.crouch = false;
      }
    }
  };

  PR.attackPower = function (hand) {
    const st = this.st;
    return hand === 'lhand' ? st.atkL : st.atkR;
  };

  PR.attackBox = function (a) {
    const it = a.item, f = this.facing, fx = this.cx, fy = this.fy;
    const dmg = this.attackPower(a.hand);
    const base = { dmg, el: it.el || 'hit', id: a.id, status: it.status, drain: it.drain, item: it };
    const reach = it.reach || 20, hh = it.hh || 10;
    let b;
    switch (a.wt) {
      case 'tome':
        return null;
      case 'great':
      case 'mace':
        b = { x: f > 0 ? fx - 4 : fx + 4 - reach, y: fy - (a.crouch ? 34 : 52), w: reach, h: hh + 6 };
        break;
      case 'whip': {
        const prog = Math.min(1, (a.t - a.wind + 1) / 3);
        const L = reach * prog;
        b = { x: f > 0 ? fx + 6 : fx - 6 - L, y: fy - (a.crouch ? 18 : 31) - hh / 2, w: L, h: hh };
        break;
      }
      default: {
        const yc = fy - (a.crouch ? 15 : 29);
        b = { x: f > 0 ? fx + 2 : fx - 2 - reach, y: yc - hh / 2, w: reach, h: hh };
      }
    }
    return Object.assign(b, base);
  };

  // ---- sub-weapons & spells -------------------------------------------------------------------
  PR.useSub = function () {
    const s = G.state;
    const sw = G.SUBWEAPONS[s.sub];
    if (!sw) return;
    let cost = sw.cost;
    if (this.st.flags.subDiscount) cost = Math.max(1, cost - this.st.flags.subDiscount);
    if (s.sub === 'stopwatch' && this.st.flags.watchDiscount) cost = Math.ceil(cost / 2);
    if (s.hearts < cost) {
      G.audio.sfx('menu_error', { vol: 0.5 });
      return;
    }
    const ok = G.throwSub(s.sub, this);
    if (ok === false) return;
    s.hearts -= cost;
    this.atk = { hand: 'rhand', item: G.ITEMS.fist, wt: 'throw', t: 0, wind: 2, act: 4, rec: 10, id: 'sub' + U.uid(), crouch: this.crouch, air: !this.onGround, throwing: true };
  };

  PR.findSpell = function () {
    const s = G.state;
    // longest sequences first so short motions don't shadow long ones
    const list = Object.keys(G.SPELLS).sort((a, b) => G.SPELLS[b].seq.length - G.SPELLS[a].seq.length);
    for (const id of list) {
      const sp = G.SPELLS[id];
      if (!sp.known && !s.spells[id]) continue;
      if (I.matchMotion(sp.seq, this.facing, 24 + sp.seq.length * 9)) return id;
    }
    return null;
  };

  PR.castSpell = function (id) {
    const s = G.state, sp = G.SPELLS[id];
    I.clearMotion();
    if (s.mp < sp.mp) {
      G.audio.sfx('menu_error');
      G.ui.notify(G.t('mp') + ' ✕', '#8090ff');
      return;
    }
    s.mp -= sp.mp;
    s.spells[id] = true;
    s.flags['cast_' + id] = 1;
    this.castT = 30;
    this.atk = { hand: 'rhand', item: G.ITEMS.fist, wt: 'cast', t: 0, wind: 6, act: 6, rec: 18, id: 'sp' + U.uid(), air: !this.onGround, keepOnLand: true };
    G.audio.say(sp.shout, { speaker: 'shout' });
    G.castSpell(id, this);
  };

  // ---- other forms ---------------------------------------------------------------------------------
  PR.updateBat = function () {
    const room = this.g.room, s = G.state;
    const dx = (I.held.right ? 1 : 0) - (I.held.left ? 1 : 0);
    const dy = (I.held.down ? 1 : 0) - (I.held.up ? 1 : 0);
    if (this.hurtT > 0) this.hurtT--;
    if (this.ramT > 0) {
      this.ramT--;
      this.vx = this.facing * 5.5;
      this.vy = 0;
      this.boxes.push({ x: this.x - 2, y: this.y - 2, w: this.w + 4, h: this.h + 4, dmg: Math.round(this.st.atkR * 0.8 + this.st.int * 0.5), el: 'dark', id: 'ram' + this.ramId });
    } else if (this.hurtT <= 0) {
      const sp = 2.6;
      this.vx = U.approach(this.vx, dx * sp, 0.35);
      this.vy = U.approach(this.vy, dy * sp, 0.35);
      if (dx) this.facing = dx;
      if (!dy && Math.abs(this.vy) < 0.3) this.vy = Math.sin(this.t * 0.15) * 0.25;
    } else {
      this.vx *= 0.9;
      this.vy *= 0.9;
    }
    if (I.pressed.attack || I.pressed.attack2) {
      if (G.relicOn(s, 'echo_bat') && !I.held.down && s.mp >= 2 && I.pressed.attack2) {
        s.mp -= 2;
        G.spawnPlayerProj('sonic', this.cx + this.facing * 6, this.cy, this.facing, 10 + this.st.int, 'hit');
        G.audio.sfx('bat_screech', { vol: 0.6 });
      } else if (s.mp >= 4 && this.ramT <= 0) {
        s.mp -= 4;
        this.ramT = 20;
        this.ramId = U.uid();
        G.audio.sfx('wolf_dash');
      }
    }
    if (this.t % 14 === 0) G.audio.sfx('bat_flap', { vol: 0.25 });
    P.move(this, room);
  };

  PR.updateMist = function () {
    const room = this.g.room;
    const dx = (I.held.right ? 1 : 0) - (I.held.left ? 1 : 0);
    const dy = (I.held.down ? 1 : 0) - (I.held.up ? 1 : 0);
    this.vx = U.approach(this.vx, dx * 1.5, 0.12);
    this.vy = U.approach(this.vy, dy * 1.5, 0.12);
    if (dx) this.facing = dx;
    if (this.t % 30 === 0) G.audio.sfx('mist', { vol: 0.25 });
    P.move(this, room);
  };

  PR.updateWolf = function () {
    const room = this.g.room, s = G.state;
    const dir = (I.held.right ? 1 : 0) - (I.held.left ? 1 : 0);
    if (this.hurtT > 0) {
      this.hurtT--;
      this.vy = Math.min(this.vy + GRAV, 7);
      P.move(this, room);
      return;
    }
    if (I.pressed.jump) this.jumpBuf = 7;
    else if (this.jumpBuf > 0) this.jumpBuf--;
    if (this.onGround) this.coyote = 6;
    else if (this.coyote > 0) this.coyote--;
    const max = this.inWater ? 2 : 3.7;
    if (dir) {
      if (dir !== U.sign(this.vx) && Math.abs(this.vx) > 1) this.vx *= 0.7;
      this.vx = U.approach(this.vx, dir * max, this.onGround ? 0.18 : 0.12);
      this.facing = dir;
    } else this.vx = U.approach(this.vx, 0, 0.3);
    if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0)) {
      if (I.held.down && this.standingOnOneWay()) {
        this.dropT = 14;
        this.y += 2;
      } else {
        this.vy = -6.1;
        G.audio.sfx('jump', { vol: 0.5, pitch: 1.2 });
      }
      this.jumpBuf = 0;
      this.coyote = 0;
      this.onGround = false;
    }
    if (this.vy < 0 && !I.held.jump) this.vy += GRAV * 1.2;
    this.vy = Math.min(this.vy + GRAV, 7);
    if ((I.pressed.attack || I.pressed.attack2) && !this.atk) {
      this.atk = { hand: 'rhand', item: G.ITEMS.fist, wt: 'bite', t: 0, wind: 2, act: 10, rec: 8, id: 'wb' + U.uid() };
      this.vx = this.facing * Math.max(Math.abs(this.vx), 4.5);
      G.audio.sfx('wolf_dash');
    }
    if (this.atk) {
      const a = this.atk;
      a.t++;
      if (a.t >= a.wind && a.t < a.wind + a.act)
        this.boxes.push({ x: this.facing > 0 ? this.x + this.w - 4 : this.x - 12, y: this.y - 2, w: 16, h: this.h + 2, dmg: Math.round(this.st.atkR * (this.st.flags.wolfBoost ? 1.1 : 0.8)), el: 'cut', id: a.id });
      if (a.t >= a.wind + a.act + a.rec) this.atk = null;
    }
    if (Math.abs(this.vx) > 2.5 && this.onGround && this.t % 5 === 0) G.fx.dust(this.cx - this.facing * 8, this.fy, 1);
    P.move(this, room);
    this.walkT += Math.abs(this.vx) / 3;
    if (this.onGround && this.landV > 3) {
      G.audio.sfx('land', { vol: 0.4 });
      this.landV = 0;
    }
  };

  // ---- drawing ----------------------------------------------------------------------------------
  PR.poseName = function () {
    if (this.dead) return 'dead';
    if (this.hurtT > 0) return 'hurt';
    if (this.atk && (this.atk.wt === 'cast' || this.castT > 0)) return 'cast';
    if (this.atk && this.atk.wt === 'throw') return 'attack';
    if (this.atk) return 'attack';
    if (this.guarding) return 'guard';
    if (this.dashT > 0) return 'backdash';
    if (this.diveT) return 'dive';
    if (this.superT > 0) return 'superjump';
    if (this.flipT > 0) return 'flip';
    if (!this.onGround) return this.vy < 0 ? 'jump' : 'fall';
    if (this.crouch) return 'crouch';
    if (this.landT > 0) return 'land';
    if (Math.abs(this.vx) > 0.1) return 'walk';
    if (this.locked && this.kneel) return 'kneel';
    return 'idle';
  };

  PR.draw = function (ctx, camx, camy) {
    const fx = Math.round(this.cx - camx), fy = Math.round(this.fy - camy);
    // afterimages
    for (const a of this.afterImgs) {
      ctx.globalAlpha = (a.life / 12) * 0.45;
      G.gfx.drawAnchored(a.img, a.x - camx, a.y - camy, a.ax, a.ay, a.flip);
    }
    ctx.globalAlpha = 1;
    const blink = this.inv > 0 && !this.dead && this.inv % 6 < 3 && this.hurtT <= 0;
    if (this.form === 'bat') {
      const img = G.drawBat(this.t);
      if (!blink) G.gfx.drawAnchored(img, fx, fy - 6, 16, 12, this.facing < 0);
      this.lastSprite = { img, ax: 16, ay: 12, dy: -6 };
      return;
    }
    if (this.form === 'mist') {
      G.drawMist(ctx, this.cx - camx, this.fy - camy, this.t);
      return;
    }
    if (this.form === 'wolf') {
      const img = G.drawWolf(this.walkT, Math.abs(this.vx) > 0.3 || !this.onGround);
      if (!blink) G.gfx.drawAnchored(img, fx, fy + 2, 24, 28, this.facing < 0);
      this.lastSprite = { img, ax: 24, ay: 28, dy: 2 };
      return;
    }
    const name = this.poseName();
    const a = this.atk;
    let pose;
    if (name === 'attack') {
      const ph = a.t < a.wind ? a.t / Math.max(1, a.wind) : a.t < a.wind + a.act ? 1 + (a.t - a.wind) / a.act : 2 + Math.min(1, (a.t - a.wind - a.act) / Math.max(1, a.rec));
      pose = G.alucardPose('attack', this.t, { phase: ph, wtype: a.wt === 'throw' ? 'fist' : a.wt, crouch: a.crouch });
    } else if (name === 'flip') {
      pose = G.alucardPose('flip', this.t, { rot: (1 - this.flipT / 24) * Math.PI * 2 });
    } else if (name === 'walk') {
      pose = G.alucardPose('walk', this.walkT);
    } else pose = G.alucardPose(name, this.t);
    this.lastPose = pose;
    const f = this.facing;
    const capeL = this.cape.map((p) => ({ x: (p.x - this.cx) * f, y: p.y - this.fy }));
    const hairL = this.hair.map((p) => ({ x: (p.x - this.cx) * f, y: p.y - this.fy }));
    const opts = {};
    const s = G.state;
    const cloak = s.equip.cloak && G.ITEMS[s.equip.cloak];
    if (cloak) {
      opts.capeCol = cloak.col;
      opts.liningCol = cloak.lining;
      opts.extraPal = [cloak.col, cloak.lining];
    } else {
      opts.capeCol = '#2a2230';
      opts.liningCol = '#4a3a4a';
      opts.extraPal = ['#2a2230', '#4a3a4a'];
    }
    if (a && a.wt !== 'cast' && a.wt !== 'throw' && a.wt !== 'bite') {
      opts.weapon = { item: a.item };
      if (a.wt === 'great' || a.wt === 'mace') {
        // blade follows the arm in an arc
      }
      opts.extraPal = opts.extraPal.concat([a.item.col || '#cfd6e6', U.shade(a.item.col || '#cfd6e6', 0.5)]);
    }
    if (this.guarding && this.guardItem) {
      const sh = G.ITEMS[this.guardItem];
      opts.shield = sh;
      opts.extraPal = opts.extraPal.concat([sh.col, U.shade(sh.col, 0.35)]);
    }
    if (this.buffs.darkMeta > 0) opts.eyeCol = '#ffffff';
    const res = G.drawAlucard(pose, capeL, hairL, opts);
    this.handLocal = res.hand;
    let img = res.canvas;
    if (this.hurtT > 16) img = G.gfx.tintFresh(img, '#ffd0d0', 'hurt');
    // store a copy reference for afterimages (copied lazily)
    this.lastSprite = { img: res.canvas, ax: 64, ay: 76, dy: 0 };
    if (!blink) G.gfx.drawAnchored(img, fx, fy, 64, 76, f < 0);
    if (this.st.flags && G.state.status.poison > 0 && this.t % 20 < 10) {
      ctx.globalAlpha = 0.25;
      G.gfx.drawAnchored(G.gfx.tintFresh(res.canvas, '#40ff60', 'poison'), fx, fy, 64, 76, f < 0);
      ctx.globalAlpha = 1;
    }
    // whip lash
    if (a && a.wt === 'whip' && a.t >= a.wind - 1) {
      const prog = a.t < a.wind + a.act ? Math.min(1, (a.t - a.wind + 2) / 3) : Math.max(0, 1 - (a.t - a.wind - a.act) / 4);
      const hx = this.cx + res.hand.x * f - camx, hy = this.fy + res.hand.y - camy;
      G.drawWhip(ctx, hx, hy, f, (a.item.reach || 60) * prog, this.t, a.item.col, a.item.glow);
    }
  };

  PR.pushAfterImage = function () {
    const ls = this.lastSprite;
    if (!ls) return;
    let pool = this._pool || (this._pool = []);
    let c = pool.find((p) => !p.busy);
    if (!c) {
      if (pool.length >= 8) return;
      c = { cv: G.gfx.makeCanvas(128, 84), busy: false };
      pool.push(c);
    }
    const cx = G.gfx.ctxOf(c.cv);
    cx.clearRect(0, 0, 128, 84);
    cx.globalAlpha = 1;
    cx.drawImage(G.gfx.tintFresh(ls.img, this.form === 'wolf' ? '#8090c0' : '#6a50c8', 'after'), 0, 0);
    c.busy = true;
    const self = this;
    const item = { img: c.cv, x: this.cx, y: this.fy + (ls.dy || 0), ax: ls.ax, ay: ls.ay, flip: this.facing < 0, life: 12 };
    Object.defineProperty(item, 'done', { value: () => (c.busy = false) });
    this.afterImgs.push(item);
    // free the canvas when the image expires
    const origLife = item.life;
    setTimeoutFrames(this.g, origLife + 1, () => (c.busy = false));
  };
  function setTimeoutFrames(game, n, fn) {
    if (game && game.later) game.later(n, fn);
    else fn();
  }
})();
