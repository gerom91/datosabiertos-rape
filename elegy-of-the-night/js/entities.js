/* Elegy of the Night — entities.js
 * Base entity + world props: candles, pickups (hearts, gold, items, relics,
 * max-ups), save points, teleporters, archive portals, lore lecterns,
 * spell tomes, NPCs, moving platforms, triggers, the Librarian.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, P = G.phys, gfx = G.gfx;

  class Ent {
    constructor(o) {
      this.x = 0;
      this.y = 0;
      this.w = 8;
      this.h = 8;
      this.vx = 0;
      this.vy = 0;
      this.dead = false;
      this.z = 0;
      this.t = 0;
      this.uid = U.uid();
      if (o) Object.assign(this, o);
    }
    get cx() {
      return this.x + this.w / 2;
    }
    get cy() {
      return this.y + this.h / 2;
    }
    get fy() {
      return this.y + this.h;
    }
    update(g) {
      this.t++;
    }
    draw(ctx, camx, camy) {}
    overlapsPlayer(g, pad) {
      const p = g.player;
      pad = pad || 0;
      return this.x - pad < p.x + p.w && this.x + this.w + pad > p.x && this.y - pad < p.y + p.h && this.y + this.h + pad > p.y;
    }
  }
  G.Ent = Ent;
  G.ENT = {}; // spawn factories by legend type

  // ---- item icons (16x16) ---------------------------------------------------------------
  G.itemIcon = function (it) {
    const icon = it.icon || 'relic', col = it.col || '#c0c0c0';
    return gfx.sprite('icon_' + icon + col, 16, 16, (c) => drawIcon(c, icon, col), { outline: '#0a0810', threshold: 90 });
  };
  function drawIcon(c, icon, col) {
    const L = U.shade(col, 0.4), D = U.shade(col, -0.4);
    const line = (x1, y1, x2, y2, w, cc) => gfx.limb(c, x1, y1, x2, y2, w, cc);
    switch (icon) {
      case 'sword': line(3, 13, 12, 4, 2.4, col); line(4, 12, 12, 4, 1, L); line(2, 10, 6, 14, 2, '#c9a24a'); line(2, 14, 3, 13, 2, '#6a4a2a'); break;
      case 'dagger': line(4, 12, 11, 5, 2.2, col); line(3, 10, 6, 13, 2, '#c9a24a'); line(2, 14, 3, 13, 2, '#6a4a2a'); break;
      case 'great': line(2, 14, 13, 3, 3.6, col); line(3, 13, 13, 3, 1, L); line(2, 10, 6, 14, 2.4, '#c9a24a'); break;
      case 'rapier': line(2, 14, 14, 2, 1.4, col); gfx.circle(c, 4, 12, 2.4, '#c9a24a'); break;
      case 'mace': line(3, 14, 9, 7, 1.8, '#6a4a2a'); gfx.circle(c, 10.5, 5.5, 3.6, col); gfx.circle(c, 9.5, 4.5, 1.2, L); break;
      case 'spear': line(2, 14, 12, 4, 1.6, '#7a5a3a'); line(11, 5, 14, 2, 3, col); break;
      case 'whip': c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.arc(8, 8, 5, 0.3, Math.PI * 1.9); c.stroke(); line(10, 12, 13, 15, 2.2, '#5a3a1a'); break;
      case 'fist': gfx.ellipse(c, 8, 9, 5, 4, 0, col); line(4, 7, 12, 7, 1, D); break;
      case 'tome': c.fillStyle = col; c.fillRect(3, 3, 10, 11); c.fillStyle = '#efe6d0'; c.fillRect(4, 4, 8, 1); c.fillRect(12, 4, 1, 9); c.fillStyle = L; c.fillRect(6, 7, 4, 3); break;
      case 'shield': c.fillStyle = col; c.beginPath(); c.moveTo(3, 3); c.lineTo(13, 3); c.lineTo(13, 9); c.lineTo(8, 14); c.lineTo(3, 9); c.closePath(); c.fill(); line(8, 4, 8, 12, 1.2, L); line(4, 7, 12, 7, 1.2, L); break;
      case 'hat': gfx.ellipse(c, 8, 11, 7, 2, 0, col); c.fillStyle = col; c.fillRect(5, 4, 6, 7); c.fillStyle = '#c9a24a'; c.fillRect(5, 9, 6, 1); break;
      case 'glasses': c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); c.arc(5, 9, 3, 0, 7); c.stroke(); c.beginPath(); c.arc(11, 9, 3, 0, 7); c.stroke(); line(7, 9, 9, 9, 1, col); break;
      case 'helm': c.fillStyle = col; c.beginPath(); c.arc(8, 9, 6, Math.PI, 0); c.fill(); c.fillRect(2, 9, 12, 4); c.fillStyle = '#20202a'; c.fillRect(5, 9, 6, 2); break;
      case 'circlet': c.strokeStyle = col; c.lineWidth = 1.8; c.beginPath(); c.ellipse(8, 9, 6, 3, 0, 0, 7); c.stroke(); gfx.circle(c, 8, 6, 1.8, '#60c0ff'); break;
      case 'bandana': c.fillStyle = col; c.fillRect(2, 6, 12, 4); c.beginPath(); c.moveTo(12, 8); c.lineTo(15, 12); c.lineTo(13, 13); c.fill(); break;
      case 'crown': c.fillStyle = col; c.beginPath(); c.moveTo(2, 13); c.lineTo(2, 5); c.lineTo(5, 9); c.lineTo(8, 4); c.lineTo(11, 9); c.lineTo(14, 5); c.lineTo(14, 13); c.closePath(); c.fill(); break;
      case 'shirt': case 'armor': case 'robe':
        c.fillStyle = col; c.beginPath(); c.moveTo(3, 4); c.lineTo(6, 2); c.lineTo(10, 2); c.lineTo(13, 4); c.lineTo(12, 7); c.lineTo(11, 7); c.lineTo(11, icon === 'robe' ? 15 : 13); c.lineTo(5, icon === 'robe' ? 15 : 13); c.lineTo(5, 7); c.lineTo(4, 7); c.closePath(); c.fill();
        line(8, 3, 8, 12, 1, D); if (icon === 'armor') { line(6, 6, 10, 6, 1, L); line(6, 9, 10, 9, 1, L); } break;
      case 'cloak': c.fillStyle = col; c.beginPath(); c.moveTo(5, 2); c.lineTo(11, 2); c.lineTo(14, 15); c.lineTo(2, 15); c.closePath(); c.fill(); c.fillStyle = '#a01828'; c.fillRect(7, 3, 2, 11); break;
      case 'ring': c.strokeStyle = '#d4ac52'; c.lineWidth = 1.8; c.beginPath(); c.arc(8, 10, 4, 0, 7); c.stroke(); gfx.circle(c, 8, 5, 2.4, col); gfx.circle(c, 7.4, 4.4, 0.8, L); break;
      case 'coin': gfx.circle(c, 8, 8, 5.5, col); gfx.circle(c, 8, 8, 3.5, U.shade(col, -0.2)); c.fillStyle = L; c.fillRect(6, 5, 2, 1); break;
      case 'amulet': c.strokeStyle = '#c0c0c8'; c.lineWidth = 1; c.beginPath(); c.moveTo(4, 2); c.lineTo(8, 9); c.lineTo(12, 2); c.stroke(); gfx.circle(c, 8, 10.5, 3.5, col); gfx.circle(c, 7, 9.5, 1, L); break;
      case 'charm': c.fillStyle = col; c.fillRect(6, 2, 4, 9); c.beginPath(); c.moveTo(6, 11); c.lineTo(8, 15); c.lineTo(10, 11); c.fill(); break;
      case 'rosary': c.strokeStyle = col; c.lineWidth = 1.2; c.beginPath(); c.arc(8, 6, 4, 0, 7); c.stroke(); line(8, 10, 8, 15, 1.4, '#e0d0a0'); line(6, 12, 10, 12, 1.4, '#e0d0a0'); break;
      case 'pin': gfx.circle(c, 8, 8, 4.5, col); line(2, 14, 6, 10, 1, '#c0c0c8'); c.fillStyle = L; c.fillRect(7, 5, 2, 2); break;
      case 'eye': gfx.ellipse(c, 8, 8, 6, 3.6, 0, '#f0e8f0'); gfx.circle(c, 8, 8, 2.6, col); gfx.circle(c, 8, 8, 1, '#100010'); break;
      case 'potion': c.fillStyle = '#c8d8e8'; c.fillRect(6, 2, 4, 3); gfx.circle(c, 8, 10, 5, '#c8d8e8'); gfx.circle(c, 8, 10.5, 4, col); c.fillStyle = L; c.fillRect(6, 8, 1, 2); c.fillStyle = '#8a6a3a'; c.fillRect(6, 1, 4, 2); break;
      case 'ink': c.fillStyle = '#20202a'; c.fillRect(4, 6, 8, 8); c.fillStyle = col; c.fillRect(5, 9, 6, 4); line(9, 2, 12, 7, 1.2, '#e8e8f0'); break;
      case 'vial': c.fillStyle = '#c8d8e8'; c.fillRect(6, 2, 4, 3); c.fillStyle = col; c.fillRect(5, 5, 6, 9); c.fillStyle = L; c.fillRect(6, 6, 1, 6); break;
      case 'pouch': gfx.ellipse(c, 8, 10, 5, 4.5, 0, col); c.fillStyle = '#8a6a3a'; c.fillRect(6, 4, 4, 3); break;
      case 'jar': c.fillStyle = '#c0b090'; c.fillRect(4, 4, 8, 10); c.fillStyle = col; gfx.circle(c, 7, 9, 2, col); gfx.circle(c, 9, 9, 2, col); c.beginPath(); c.moveTo(5, 9.5); c.lineTo(8, 13); c.lineTo(11, 9.5); c.fill(); break;
      case 'bread': gfx.ellipse(c, 8, 9, 6, 4, 0, col); line(5, 7, 7, 9, 1, D); line(8, 6, 10, 8, 1, D); break;
      case 'fruit': gfx.circle(c, 8, 9, 5, col); line(8, 4, 9, 1, 1, '#4a2a10'); gfx.ellipse(c, 10.5, 3, 2, 1, -0.4, '#40a040'); c.fillStyle = L; c.fillRect(6, 7, 2, 1); break;
      case 'bottle': c.fillStyle = '#203018'; c.fillRect(6, 1, 4, 5); c.fillRect(4, 5, 8, 10); c.fillStyle = col; c.fillRect(5, 9, 6, 5); c.fillStyle = '#e8d8b0'; c.fillRect(5, 7, 6, 2); break;
      case 'meat': gfx.ellipse(c, 9, 8, 5, 4, -0.5, col); line(3, 13, 6, 10, 2, '#f0e8d8'); gfx.circle(c, 3, 13.5, 1.4, '#f0e8d8'); break;
      case 'card': c.fillStyle = col; c.fillRect(2, 4, 12, 8); c.fillStyle = '#5a1a22'; c.fillRect(3, 5, 4, 6); c.fillStyle = '#efe6d0'; c.fillRect(8, 6, 5, 1); c.fillRect(8, 8, 4, 1); break;
      case 'page': c.fillStyle = col; c.beginPath(); c.moveTo(3, 2); c.lineTo(11, 2); c.lineTo(13, 5); c.lineTo(13, 14); c.lineTo(3, 14); c.closePath(); c.fill(); c.fillStyle = '#8a6a4a'; c.fillRect(5, 5, 6, 1); c.fillRect(5, 7, 6, 1); c.fillRect(5, 9, 5, 1); c.fillStyle = '#a01828'; c.fillRect(5, 11, 3, 2); break;
      case 'axe': line(4, 14, 10, 4, 1.8, '#6a4a2a'); c.fillStyle = col; c.beginPath(); c.moveTo(8, 3); c.lineTo(14, 4); c.lineTo(13, 10); c.lineTo(10, 7); c.closePath(); c.fill(); break;
      case 'cross': c.fillStyle = col; c.fillRect(7, 2, 3, 12); c.fillRect(3, 6, 11, 3); c.fillStyle = L; c.fillRect(8, 3, 1, 10); break;
      case 'watch': gfx.circle(c, 8, 9, 5.5, col); gfx.circle(c, 8, 9, 4, '#f0ead8'); line(8, 9, 8, 6, 1, '#2a2420'); line(8, 9, 10, 10, 1, '#2a2420'); c.fillStyle = col; c.fillRect(7, 1, 3, 3); break;
      case 'quill': c.fillStyle = col; c.beginPath(); c.moveTo(13, 2); c.quadraticCurveTo(6, 4, 4, 12); c.lineTo(7, 11); c.quadraticCurveTo(10, 6, 13, 2); c.fill(); line(4, 12, 2, 15, 1, '#3a3a4a'); break;
      case 'relic': {
        const g = c.createRadialGradient(8, 8, 1, 8, 8, 7);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, col);
        g.addColorStop(1, D);
        c.fillStyle = g;
        c.beginPath();
        c.arc(8, 8, 6.5, 0, 7);
        c.fill();
        break;
      }
      case 'heart': c.fillStyle = col; c.beginPath(); c.arc(5.5, 6, 3, 0, 7); c.arc(10.5, 6, 3, 0, 7); c.fill(); c.beginPath(); c.moveTo(2.6, 7); c.lineTo(8, 13); c.lineTo(13.4, 7); c.fill(); c.fillStyle = L; c.fillRect(4, 4, 2, 1); break;
      default: gfx.circle(c, 8, 8, 5, col);
    }
  }

  // ---- candles -----------------------------------------------------------------------------------
  class Candle extends Ent {
    constructor(sp, g) {
      super({ x: sp.x - 4, y: sp.y - 16, w: 8, h: 16, sp });
      this.style = (g.room.theme && g.room.theme.candle) || g.room.area.candle || 'wall';
      // candles float on walls: lift them a little above the floor tile they mark
      this.y -= sp.lift == null ? 6 : sp.lift;
      this.drop = sp.drop;
    }
    update(g) {
      this.t++;
      if (this.t % 4 === 0) {
        const L = { x: this.cx - g.camx, y: this.y + 2 - g.camy };
        this.light = L;
      }
    }
    hit(g) {
      if (this.dead) return;
      this.dead = true;
      G.audio.sfx('candle_break', { vol: 0.7 });
      G.fx.burst(this.cx, this.y + 4, '#ffb040', 8, 1.5, { glow: true });
      let d = this.drop;
      if (!d) {
        const r = Math.random();
        d = r < 0.55 ? 'heart' : r < 0.67 ? 'heart_big' : r < 0.93 ? 'gold' : 'potion';
        if (r > 0.985 && !G.state.sub) d = 'sub:dagger';
      }
      G.dropPickup(g, d, this.cx, this.y + 8);
    }
    draw(ctx, camx, camy) {
      const x = Math.round(this.x - camx), y = Math.round(this.y - camy);
      const f = Math.floor(this.t / 6) % 3;
      const img = gfx.sprite('candle_' + this.style + f, 12, 22, (c) => {
        if (this.style === 'lantern') {
          c.fillStyle = '#3a2a1a';
          c.fillRect(4, 0, 4, 2);
          c.fillStyle = '#8a6a3a';
          c.fillRect(2, 2, 8, 12);
          c.fillStyle = '#ffd070';
          c.fillRect(3, 4, 6, 8);
          c.fillStyle = '#fff4c0';
          c.fillRect(5, 6 - (f % 2), 2, 4);
          c.fillStyle = '#3a2a1a';
          c.fillRect(2, 14, 8, 2);
        } else {
          // wall sconce candle
          c.fillStyle = '#c9a24a';
          c.fillRect(2, 16, 8, 2);
          c.fillRect(5, 18, 2, 3);
          c.fillStyle = '#efe6d0';
          c.fillRect(4, 8, 4, 8);
          c.fillStyle = '#ffffff';
          c.fillRect(4, 8, 1, 7);
          const fl = [[5, 3, 2, 5], [4, 2, 3, 6], [5, 2, 2, 6]][f];
          c.fillStyle = '#ff9a30';
          c.fillRect(fl[0], fl[1] + 1, fl[2], fl[3]);
          c.fillStyle = '#fff0a0';
          c.fillRect(5, 5, 1, 3);
        }
      }, { outline: '#0a0608', threshold: 80 });
      ctx.drawImage(img, x - 2, y - 4);
      G.gfx.addLight(x + 4, y + 2, 46, '#ffa040', 0.85 + Math.sin(this.t * 0.3) * 0.08);
    }
  }
  G.ENT.candle = (sp, g) => new Candle(sp, g);

  // ---- pickups ------------------------------------------------------------------------------------
  class Pickup extends Ent {
    constructor(o) {
      super(Object.assign({ w: 10, h: 10, life: -1, grav: 0.2, bounce: 0 }, o));
      this.z = 2;
    }
    buried(g) {
      // items hidden inside a breakable block stay invisible until the block breaks
      if (!this.hiddenInWall) return false;
      const t = g.room.get(Math.floor(this.cx / 16), Math.floor(this.cy / 16));
      if (t === G.T.BREAK) return true;
      this.hiddenInWall = false;
      return false;
    }
    update(g) {
      this.t++;
      if (this.buried(g)) return;
      if (!this.static) {
        if (this.float) {
          this.vy = U.approach(this.vy, 0.5, 0.03);
          this.x += Math.sin(this.t * 0.08) * 0.4;
          this.y += this.vy;
          if (P.solidAt(g.room, this.cx, this.fy) || P.floorAt(g.room, this.cx, this.fy)) {
            this.float = false;
            this.vy = 0;
          }
        } else {
          this.vy = Math.min(this.vy + this.grav, 5);
          this.vx *= 0.92;
          P.move(this, g.room);
        }
      }
      if (this.life > 0 && --this.life <= 0) this.dead = true;
      if (this.t > 10 && this.overlapsPlayer(g, 2) && g.player.form !== 'mist' && !g.player.dead) this.collect(g);
    }
    blink() {
      return this.life > 0 && this.life < 90 && this.t % 6 < 3;
    }
  }
  G.Pickup = Pickup;

  class HeartPickup extends Pickup {
    constructor(x, y, big) {
      super({ x: x - 5, y: y - 5, big, life: 600, float: !big, vy: big ? -2 : 0 });
    }
    collect(g) {
      const s = G.state, st = g.player.st;
      s.hearts = Math.min(st.heartsMax, s.hearts + (this.big ? 5 : 1));
      G.audio.sfx(this.big ? 'heart_big' : 'heart');
      this.dead = true;
    }
    draw(ctx, camx, camy) {
      if (this.blink()) return;
      const img = gfx.sprite('pk_heart' + (this.big ? 'B' : 'S'), 16, 16, (c) => {
        c.translate(8, 8);
        c.scale(this.big ? 1 : 0.62, this.big ? 1 : 0.62);
        c.translate(-8, -8);
        drawIcon(c, 'heart', '#e8304a');
      }, { outline: '#200008', threshold: 90 });
      ctx.drawImage(img, Math.round(this.cx - 8 - camx), Math.round(this.cy - 8 - camy));
    }
  }

  const GOLD_VALUES = [1, 10, 25, 50, 100, 250, 400, 1000, 2000];
  class GoldPickup extends Pickup {
    constructor(x, y, amount) {
      super({ x: x - 5, y: y - 6, amount, life: 900, vy: -2.2, vx: U.rnd(-0.6, 0.6) });
    }
    collect(g) {
      G.state.gold = Math.min(9999999, G.state.gold + this.amount);
      G.audio.sfx('gold');
      G.fx.text(this.cx, this.y - 2, '$' + this.amount, '#ffe060');
      this.dead = true;
    }
    draw(ctx, camx, camy) {
      if (this.blink()) return;
      const tier = this.amount >= 1000 ? 3 : this.amount >= 250 ? 2 : this.amount >= 50 ? 1 : 0;
      const img = gfx.sprite('pk_gold' + tier, 14, 14, (c) => {
        const col = ['#e0c040', '#e0c040', '#60c0ff', '#ff6080'][tier];
        if (tier === 0) {
          gfx.circle(c, 7, 8, 4, col);
          c.fillStyle = '#fff4a0';
          c.fillRect(5, 6, 2, 1);
        } else {
          gfx.ellipse(c, 7, 9, 5.5, 4.5, 0, '#a07840');
          c.fillStyle = '#7a5a2a';
          c.fillRect(5, 3, 4, 3);
          gfx.circle(c, 7, 9, 2.2, col);
        }
      }, { outline: '#1a1008', threshold: 90 });
      ctx.drawImage(img, Math.round(this.cx - 7 - camx), Math.round(this.cy - 7 - camy));
    }
  }

  class ItemPickup extends Pickup {
    constructor(x, y, id, o) {
      super(Object.assign({ x: x - 6, y: y - 12, w: 12, h: 12, id, life: o && o.key ? -1 : 1200, vy: -2.5 }, o));
    }
    collect(g) {
      const s = G.state;
      const it = G.ITEMS[this.id];
      this.dead = true;
      if (this.key) s.flags[this.key] = 1;
      if (this.id === 'hp_up') {
        s.base.hp += 12;
        g.player.refreshStats();
        s.hp = g.player.st.hpMax;
        G.audio.sfx('relic_get');
        G.ui.banner(G.tr({ en: 'Life Vessel', es: 'Vasija de vida' }), G.tr({ en: 'Max HP increased', es: 'PV máximos aumentados' }), '#ff6070');
        return;
      }
      if (this.id === 'heart_up') {
        s.base.hearts += 10;
        g.player.refreshStats();
        s.hearts = g.player.st.heartsMax;
        G.audio.sfx('relic_get');
        G.ui.banner(G.tr({ en: 'Heart Vessel', es: 'Vasija de corazones' }), G.tr({ en: 'Max hearts increased', es: 'Corazones máximos aumentados' }), '#ff80a0');
        return;
      }
      if (this.id === 'mp_up') {
        s.base.mp += 8;
        g.player.refreshStats();
        s.mp = g.player.st.mpMax;
        G.audio.sfx('relic_get');
        G.ui.banner(G.tr({ en: 'Mana Prism', es: 'Prisma de maná' }), G.tr({ en: 'Max MP increased', es: 'PM máximos aumentados' }), '#80a0ff');
        return;
      }
      if (!it) return;
      if (it.kind === 'relic') {
        s.relics[it.id] = true;
        G.audio.sfx('relic_get');
        G.ui.banner(G.tr(it.name), G.tr(it.desc), it.col, 260);
        G.emit('relic', it.id);
        if (it.familiar) g.refreshFamiliar();
        return;
      }
      G.invAdd(s, it.id, 1);
      G.audio.sfx('item_get');
      G.ui.notify(G.tr(it.name), '#f0e6c8', it);
      if (it.kind === 'key') G.ui.banner(G.tr(it.name), G.tr(it.desc), '#e8d8b0', 240);
    }
    draw(ctx, camx, camy) {
      if (this.blink() || this.hiddenInWall) return;
      const it = this.id === 'hp_up' ? { icon: 'heart', col: '#ff4050' } : this.id === 'heart_up' ? { icon: 'heart', col: '#ff80c0' } : this.id === 'mp_up' ? { icon: 'relic', col: '#6080ff' } : G.ITEMS[this.id];
      if (!it) return;
      const img = G.itemIcon(it);
      const bob = this.static ? Math.sin(this.t * 0.06) * 2 : 0;
      ctx.drawImage(img, Math.round(this.cx - 8 - camx), Math.round(this.cy - 8 - camy + bob));
      if (this.static || it.kind === 'relic') G.gfx.addLight(this.cx - camx, this.cy - camy, 40, it.col || '#ffffff', 0.7);
      if (this.t % 20 === 0) G.fx.particle(this.cx + U.rnd(-5, 5), this.cy + U.rnd(-5, 5), 0, -0.3, '#ffffff', 20, { glow: true });
    }
  }
  G.ItemPickup = ItemPickup;

  class SubPickup extends Pickup {
    constructor(x, y, id) {
      super({ x: x - 6, y: y - 12, w: 12, h: 12, id, life: 900, vy: -2 });
    }
    collect(g) {
      const s = G.state;
      const old = s.sub;
      if (old === this.id) {
        s.hearts = Math.min(g.player.st.heartsMax, s.hearts + 2);
        G.audio.sfx('heart');
        this.dead = true;
        return;
      }
      s.sub = this.id;
      G.audio.sfx('item_get');
      G.ui.notify(G.tr(G.SUBWEAPONS[this.id].name), '#ffd080', G.SUBWEAPONS[this.id]);
      this.dead = true;
      if (old) {
        const p = new SubPickup(this.cx - g.player.facing * 18, this.cy, old);
        p.t = -40;
        g.add(p);
      }
    }
    draw(ctx, camx, camy) {
      if (this.blink()) return;
      const sw = G.SUBWEAPONS[this.id];
      ctx.drawImage(G.itemIcon(sw), Math.round(this.cx - 8 - camx), Math.round(this.cy - 8 - camy));
    }
  }

  // drop helper: 'heart' | 'heart_big' | 'gold' | 'gold:250' | 'sub:axe' | 'item:potion' | item id
  G.dropPickup = function (g, d, x, y) {
    if (!d) return null;
    let e = null;
    if (d === 'heart') e = new HeartPickup(x, y, false);
    else if (d === 'heart_big') e = new HeartPickup(x, y, true);
    else if (d.startsWith('gold')) {
      let amt = d.includes(':') ? parseInt(d.split(':')[1], 10) : U.pick([1, 1, 10, 10, 25, 50]);
      e = new GoldPickup(x, y, amt);
    } else if (d.startsWith('sub:')) e = new SubPickup(x, y, d.slice(4));
    else {
      const id = d.startsWith('item:') ? d.slice(5) : d;
      if (G.ITEMS[id] || id === 'hp_up' || id === 'heart_up' || id === 'mp_up') e = new ItemPickup(x, y, id);
    }
    if (e) g.add(e);
    return e;
  };

  // placed unique item / relic / vessel
  G.ENT.item = function (sp, g) {
    if (G.state.flags[sp.key]) return null;
    const e = new ItemPickup(sp.x, sp.y - 8, sp.id, { key: sp.key, static: true, life: -1, vy: 0 });
    if (sp.hidden) e.hiddenInWall = true;
    return e;
  };
  G.ENT.relic = function (sp, g) {
    if (G.hasRelic(G.state, sp.id) || G.state.flags[sp.key]) return null;
    const e = new ItemPickup(sp.x, sp.y - 20, sp.id, { key: sp.key, static: true, life: -1, vy: 0 });
    e.pedestal = true;
    const draw = e.draw.bind(e);
    e.draw = function (ctx, camx, camy) {
      const x = Math.round(sp.x - camx), y = Math.round(sp.y - camy);
      const img = gfx.sprite('pedestal', 24, 18, (c) => {
        c.fillStyle = '#6a6070';
        c.fillRect(4, 4, 16, 14);
        c.fillStyle = '#9a90a0';
        c.fillRect(2, 0, 20, 5);
        c.fillStyle = '#c9a24a';
        c.fillRect(2, 4, 20, 1);
        c.fillStyle = '#4a4050';
        c.fillRect(8, 8, 8, 8);
      }, { outline: '#0a0810' });
      ctx.drawImage(img, x - 12, y - 18);
      draw(ctx, camx, camy);
    };
    return e;
  };
  G.ENT.subweapon = function (sp, g) {
    const e = new SubPickup(sp.x, sp.y - 6, sp.id);
    e.static = true;
    e.life = -1;
    return e;
  };

  // ---- save point -------------------------------------------------------------------------------
  class SavePoint extends Ent {
    constructor(sp) {
      super({ x: sp.x - 16, y: sp.y - 40, w: 32, h: 40, sp, interact: true, prompt: 'up_to_save' });
    }
    onInteract(g) {
      g.doSave(this);
    }
    draw(ctx, camx, camy) {
      const x = Math.round(this.cx - camx), y = Math.round(this.fy - camy);
      const img = gfx.sprite('savepoint', 36, 20, (c) => {
        c.fillStyle = '#3a2430';
        c.fillRect(2, 8, 32, 12);
        c.fillStyle = '#6a3a4a';
        c.fillRect(0, 4, 36, 6);
        c.fillStyle = '#c9a24a';
        c.fillRect(0, 4, 36, 1);
        c.fillRect(0, 9, 36, 1);
        c.fillStyle = '#20141a';
        c.fillRect(8, 12, 20, 6);
      }, { outline: '#0a0608' });
      ctx.drawImage(img, x - 18, y - 20);
      // floating crimson crystal
      const bob = Math.sin(this.t * 0.05) * 3;
      const cy = y - 38 + bob;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(x, cy, 1, x, cy, 26);
      gr.addColorStop(0, 'rgba(255,80,100,0.5)');
      gr.addColorStop(1, 'rgba(255,0,40,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - 26, cy - 26, 52, 52);
      ctx.restore();
      const cr = gfx.sprite('savecrystal', 12, 20, (c) => {
        c.fillStyle = '#c01830';
        c.beginPath();
        c.moveTo(6, 0);
        c.lineTo(12, 8);
        c.lineTo(6, 20);
        c.lineTo(0, 8);
        c.closePath();
        c.fill();
        c.fillStyle = '#ff6070';
        c.beginPath();
        c.moveTo(6, 1);
        c.lineTo(9, 8);
        c.lineTo(6, 14);
        c.closePath();
        c.fill();
      }, { outline: '#200008' });
      ctx.drawImage(cr, x - 6, Math.round(cy - 10));
      G.gfx.addLight(x, cy, 90, '#ff3050', 1);
      if (this.t % 8 === 0) G.fx.particle(this.cx + U.rnd(-12, 12), this.fy - 4, 0, -0.6, '#ff6080', 40, { glow: true });
    }
  }
  G.ENT.save = (sp) => new SavePoint(sp);

  // ---- teleporter ---------------------------------------------------------------------------------
  class Teleporter extends Ent {
    constructor(sp) {
      super({ x: sp.x - 16, y: sp.y - 40, w: 32, h: 40, sp, interact: true, prompt: 'up_to_use' });
    }
    update(g) {
      this.t++;
      if (!G.state.flags['tp_' + g.room.id]) G.state.flags['tp_' + g.room.id] = 1;
    }
    onInteract(g) {
      G.ui.openTeleport(g.room.id);
    }
    draw(ctx, camx, camy) {
      const x = Math.round(this.cx - camx), y = Math.round(this.fy - camy);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = U.rgba('#ffd060', 0.5 - i * 0.12);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y - 2, 16 - i * 3, 4 - i, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const h = 30 + Math.sin(this.t * 0.07) * 4;
      const gr = ctx.createLinearGradient(0, y - h, 0, y);
      gr.addColorStop(0, 'rgba(255,220,120,0)');
      gr.addColorStop(1, 'rgba(255,200,90,0.35)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - 13, y - h, 26, h);
      ctx.restore();
      G.gfx.addLight(x, y - 10, 70, '#ffc860', 0.9);
      if (this.t % 5 === 0) G.fx.particle(x + camx + U.rnd(-12, 12), y + camy - 2, 0, -0.9, '#ffe090', 30, { glow: true });
    }
  }
  G.ENT.teleport = (sp) => new Teleporter(sp);

  // ---- archive portal (book) -----------------------------------------------------------------------
  class Portal extends Ent {
    constructor(sp) {
      super({ x: sp.x - 18, y: sp.y - 48, w: 36, h: 48, sp, interact: true, prompt: 'up_to_enter' });
    }
    onInteract(g) {
      if (this.sp.need && !G.state.flags[this.sp.need]) {
        G.ui.notify(G.tr(this.sp.needText || { en: 'The book will not open.', es: 'El libro no se abre.' }), '#c0b0ff');
        return;
      }
      G.audio.sfx('portal');
      const dest = this.sp.dest || [this.sp.tx, this.sp.ty]; // arrival tile (see roombuilder portal())
      g.goRoom(this.sp.to, dest[0], dest[1], { fade: 40, flash: '#e8c070' });
    }
    draw(ctx, camx, camy) {
      const x = Math.round(this.cx - camx), y = Math.round(this.fy - camy);
      const t = this.t;
      // giant open book on a stand, pages fluttering, crimson light
      const img = gfx.sprite('portalbook', 48, 52, (c) => {
        c.fillStyle = '#4a2418';
        c.fillRect(20, 26, 8, 26);
        c.fillRect(12, 48, 24, 4);
        c.fillStyle = '#7a1424';
        c.beginPath();
        c.moveTo(2, 20);
        c.lineTo(24, 26);
        c.lineTo(46, 20);
        c.lineTo(46, 28);
        c.lineTo(24, 33);
        c.lineTo(2, 28);
        c.closePath();
        c.fill();
        c.fillStyle = '#efe2c0';
        c.beginPath();
        c.moveTo(4, 18);
        c.lineTo(24, 24);
        c.lineTo(44, 18);
        c.lineTo(44, 24);
        c.lineTo(24, 30);
        c.lineTo(4, 24);
        c.closePath();
        c.fill();
        c.fillStyle = '#8a6a4a';
        for (let i = 0; i < 4; i++) {
          c.fillRect(8, 21 + i * 1.5, 12, 0.8);
          c.fillRect(28, 21 + i * 1.5, 12, 0.8);
        }
        c.fillStyle = '#d4a84a';
        c.fillRect(23, 18, 2, 14);
      }, { outline: '#0a0406' });
      ctx.drawImage(img, x - 24, y - 52);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(x, y - 30, 2, x, y - 30, 40);
      gr.addColorStop(0, 'rgba(255,190,110,0.55)');
      gr.addColorStop(1, 'rgba(160,20,40,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - 40, y - 70, 80, 80);
      ctx.restore();
      for (let i = 0; i < 3; i++) {
        const a = t * 0.04 + i * 2.1;
        ctx.fillStyle = '#f4e8c8';
        ctx.fillRect(Math.round(x + Math.cos(a) * 14), Math.round(y - 38 + Math.sin(a * 1.3) * 8 - i * 3), 3, 4);
      }
      G.gfx.addLight(x, y - 30, 90, '#ffb070', 1);
    }
  }
  G.ENT.portal = (sp) => new Portal(sp);

  // ---- lore lectern / plaques --------------------------------------------------------------------------
  class Lore extends Ent {
    constructor(sp) {
      super({ x: sp.x - 10, y: sp.y - 26, w: 20, h: 26, sp, interact: true, prompt: 'up_to_read' });
    }
    onInteract(g) {
      const L = G.LORE && G.LORE[this.sp.id];
      if (!L) return;
      G.state.flags['read_' + this.sp.id] = 1;
      G.ui.openReader(L);
    }
    draw(ctx, camx, camy) {
      const x = Math.round(this.cx - camx), y = Math.round(this.fy - camy);
      const img = gfx.sprite('lectern', 20, 28, (c) => {
        c.fillStyle = '#5a3020';
        c.fillRect(8, 10, 4, 18);
        c.fillRect(3, 25, 14, 3);
        c.fillStyle = '#7a4028';
        c.beginPath();
        c.moveTo(0, 10);
        c.lineTo(20, 4);
        c.lineTo(20, 9);
        c.lineTo(0, 14);
        c.closePath();
        c.fill();
        c.fillStyle = '#f0e4c4';
        c.beginPath();
        c.moveTo(2, 9);
        c.lineTo(18, 4);
        c.lineTo(18, 6);
        c.lineTo(2, 11);
        c.closePath();
        c.fill();
      }, { outline: '#0a0406' });
      ctx.drawImage(img, x - 10, y - 28);
      if (!G.state.flags['read_' + this.sp.id] && this.t % 40 < 20) {
        ctx.fillStyle = '#ffe080';
        ctx.fillRect(x - 1, y - 36, 2, 4);
        ctx.fillRect(x - 1, y - 31, 2, 1);
      }
      G.gfx.addLight(x, y - 24, 36, '#ffd080', 0.6);
    }
  }
  G.ENT.lore = (sp) => new Lore(sp);

  // ---- spell tome on a pedestal -----------------------------------------------------------------------
  class Tome extends Ent {
    constructor(sp) {
      super({ x: sp.x - 8, y: sp.y - 30, w: 16, h: 30, sp });
    }
    update(g) {
      this.t++;
      if (this.overlapsPlayer(g) && g.player.form === 'human') {
        const s = G.state, sp = G.SPELLS[this.sp.spell];
        s.spells[this.sp.spell] = true;
        s.flags[this.sp.key] = 1;
        this.dead = true;
        G.audio.sfx('relic_get');
        const seq = sp.seq.map((d) => G.ui.arrowFor(d)).join(' ');
        G.ui.banner(G.tr({ en: 'Spell learned: ', es: 'Hechizo aprendido: ' }) + G.tr(sp.name), seq + ' + ' + G.t('atk') + ' (' + sp.mp + ' ' + G.t('mp') + ') — ' + G.tr(sp.desc), '#c8a0ff', 300);
      }
    }
    draw(ctx, camx, camy) {
      const x = Math.round(this.cx - camx), y = Math.round(this.fy - camy);
      const bob = Math.sin(this.t * 0.06) * 2;
      ctx.drawImage(G.itemIcon({ icon: 'tome', col: '#5a2a8a' }), x - 8, Math.round(y - 30 + bob));
      G.gfx.addLight(x, y - 22, 50, '#b080ff', 0.8);
      if (this.t % 10 === 0) G.fx.particle(x + camx + U.rnd(-6, 6), y + camy - 22, 0, -0.5, '#c8a0ff', 26, { glow: true });
    }
  }
  G.ENT.tome = (sp) => (G.state.flags[sp.key] || G.state.spells[sp.spell] ? null : new Tome(sp));

  // ---- moving platform ---------------------------------------------------------------------------------
  class MovingPlatform extends Ent {
    constructor(sp) {
      super({ x: sp.x - 24, y: sp.y - 16, w: (sp.len || 3) * 16, h: 8, sp });
      this.x0 = this.x;
      this.y0 = this.y;
      this.solidTop = true;
      this.period = sp.period || 240;
      this.phase = sp.phase || 0;
      // start exactly where the path puts it at t=0, so nothing standing on it is dragged on load
      this.place(0);
      this.dx = this.dy = 0;
    }
    place(t) {
      // eases from the spawn point (k=0) to spawn + (dx,dy) tiles (k=1) and back
      const k = (1 - Math.cos(((t + this.phase) / this.period) * Math.PI * 2)) / 2;
      const nx = this.x0 + (this.sp.dx || 0) * 16 * k;
      const ny = this.y0 + (this.sp.dy || 0) * 16 * k;
      this.dx = nx - this.x;
      this.dy = ny - this.y;
      this.x = nx;
      this.y = ny;
    }
    update(g) {
      this.t++;
      this.place(this.t);
    }
    draw(ctx, camx, camy) {
      const x = Math.round(this.x - camx), y = Math.round(this.y - camy);
      const th = G.game.room.theme;
      const col = th ? th.c.accent : '#b08d3c';
      ctx.fillStyle = U.shade(col, -0.35);
      ctx.fillRect(x, y, this.w, this.h);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, this.w, 2);
      ctx.fillStyle = U.shade(col, -0.6);
      for (let i = 4; i < this.w; i += 8) ctx.fillRect(x + i, y + 4, 3, 2);
    }
  }
  G.ENT.mplat = (sp) => new MovingPlatform(sp);

  // ---- trigger zone (starts a story scene) ------------------------------------------------------------
  class Trigger extends Ent {
    constructor(sp) {
      super({ x: sp.x - 8 - ((sp.tw || 1) - 1) * 8, y: sp.y - (sp.th || 3) * 16, w: (sp.tw || 1) * 16, h: (sp.th || 3) * 16, sp });
    }
    update(g) {
      const sp = this.sp;
      if (sp.once !== false && G.state.flags['scene_' + sp.scene]) {
        this.dead = true;
        return;
      }
      if (sp.need && !G.state.flags[sp.need]) return;
      if (this.overlapsPlayer(g) && !g.player.dead && G.story && !G.story.active) {
        this.dead = sp.once !== false;
        G.story.play(sp.scene);
      }
    }
  }
  G.ENT.trigger = (sp) => new Trigger(sp);

  // ---- NPCs -----------------------------------------------------------------------------------------------
  class NPC extends Ent {
    constructor(sp) {
      super({ x: sp.x - 8, y: sp.y - 40, w: 16, h: 40, sp, interact: true, prompt: 'up_to_talk' });
      this.facing = sp.facing || -1;
    }
    update(g) {
      this.t++;
      if (this.sp.hideFlag && G.state.flags[this.sp.hideFlag]) this.dead = true;
      if (this.sp.showFlag && !G.state.flags[this.sp.showFlag]) this.hidden = true;
      else this.hidden = false;
      this.facing = g.player.cx < this.cx ? -1 : 1;
    }
    onInteract(g) {
      if (this.hidden) return;
      const sc = G.state.flags['scene_' + this.sp.scene] && this.sp.scene2 ? this.sp.scene2 : this.sp.scene;
      G.story.play(sc, { npc: this });
    }
    draw(ctx, camx, camy) {
      if (this.hidden) return;
      const fn = G.NPC_ART && G.NPC_ART[this.sp.id];
      if (fn) fn(ctx, Math.round(this.cx - camx), Math.round(this.fy - camy), this.t, this.facing);
    }
  }
  G.ENT.npc = (sp) => {
    if (sp.hideFlag && G.state.flags[sp.hideFlag]) return null;
    return new NPC(sp);
  };

  // ---- shop (the Librarian at his desk) ---------------------------------------------------------------
  class Shop extends Ent {
    constructor(sp) {
      super({ x: sp.x - 24, y: sp.y - 40, w: 48, h: 40, sp, interact: true, prompt: 'up_to_talk' });
    }
    onInteract(g) {
      if (!G.state.flags.met_librarian) G.story.play('librarian_first', { after: () => G.ui.openShop() });
      else G.ui.openShop();
    }
    draw(ctx, camx, camy) {
      const fn = G.NPC_ART && G.NPC_ART.librarian;
      if (fn) fn(ctx, Math.round(this.cx - camx), Math.round(this.fy - camy), this.t, -1);
    }
  }
  G.ENT.shop = (sp) => new Shop(sp);

  // ---- the sealed door of the Keep (three Chronicle pages) -----------------------------------------
  class PageLock extends Ent {
    constructor(sp) {
      super({ x: sp.x - 24, y: sp.y - 48, w: 48, h: 48, sp, interact: true, prompt: 'up_to_use' });
    }
    update(g) {
      this.t++;
      this.hidden = !!G.state.flags.keep_open;
      this.interact = !this.hidden;
    }
    onInteract(g) {
      G.story.play('keep_door');
    }
    draw(ctx, camx, camy) {
      const x = Math.round(this.cx - camx), y = Math.round(this.fy - camy);
      const open = G.state.flags.keep_open;
      const img = gfx.sprite('pagelock' + (open ? 'o' : ''), 48, 52, (c) => {
        c.fillStyle = '#2a0a10';
        c.fillRect(4, 4, 40, 48);
        c.fillStyle = '#c9a24a';
        c.fillRect(2, 2, 44, 3);
        c.fillRect(2, 2, 3, 50);
        c.fillRect(43, 2, 3, 50);
        c.fillStyle = '#5a1420';
        c.fillRect(8, 8, 32, 42);
        for (let i = 0; i < 3; i++) {
          c.fillStyle = open ? '#f0e4c0' : '#160408';
          c.fillRect(11 + i * 10, 18, 7, 10);
          c.strokeStyle = '#c9a24a';
          c.lineWidth = 1;
          c.strokeRect(10.5 + i * 10, 17.5, 8, 11);
        }
        c.fillStyle = '#c9a24a';
        c.fillRect(22, 34, 4, 10);
        c.fillRect(18, 37, 12, 3);
      }, { outline: '#07050b', threshold: 80 });
      ctx.drawImage(img, x - 24, y - 52);
      G.gfx.addLight(x, y - 30, 60, open ? '#ffe8a0' : '#c03040', 0.7);
    }
  }
  G.ENT.pagelock = (sp) => new PageLock(sp);

  // Close or open a standard door opening of the current room (used by locked doors)
  G.setDoorLocked = function (room, side, cell, locked) {
    const T2 = G.T;
    if (!room._doorSaved) room._doorSaved = {};
    const key = side + cell;
    const cells = [];
    if (side === 'L' || side === 'R') {
      const x0 = side === 'L' ? 0 : room.tw - 2;
      for (let x = x0; x < x0 + 2; x++) for (let r = cell * 14 + 8; r < cell * 14 + 12; r++) cells.push([x, r]);
    } else {
      const y0 = side === 'T' ? 0 : room.th - 2;
      for (let y = y0; y < y0 + 2; y++) for (let c = cell * 24 + 10; c < cell * 24 + 14; c++) cells.push([c, y]);
    }
    for (const [x, y] of cells) room.set(x, y, locked ? T2.SOLID : T2.EMPTY);
    if (room.fgCanvas) G.redrawTiles(room);
  };

  // ---- start position marker ------------------------------------------------------------------------
  G.ENT.start = () => null;
})();
