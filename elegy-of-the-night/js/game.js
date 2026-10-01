/* Elegy of the Night — game.js
 * The gameplay scene: room loading & transitions, camera, entity updates,
 * combat resolution, breakable walls, boss fights, time stop, hitstop,
 * interactions, saving, consumables and level ups.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, P = G.phys, T = G.T, I = G.input, gfx = G.gfx;

  const g = (G.game = {
    room: null,
    player: null,
    ents: [],
    camx: 0,
    camy: 0,
    lookX: 0,
    frame: 0,
    hitstop: 0,
    timeStop: 0,
    queue: [],
    boss: null,
    areaId: null,
    fadeIn: 0,
    transT: 0,
    interactEnt: null,
    lastHitEnemy: null,
    lastHitT: 0,
    running: false,
  });

  g.add = function (e) {
    g.ents.push(e);
    return e;
  };
  g.later = function (n, fn) {
    g.queue.push({ f: g.frame + Math.max(0, n | 0), fn });
  };

  g.start = function (state, opts) {
    G.state = state;
    opts = opts || {};
    g.ents = [];
    g.queue = [];
    g.boss = null;
    g.timeStop = 0;
    g.hitstop = 0;
    g.areaId = null;
    G.fx.clear();
    const roomId = state.room && G.world.rooms[state.room] ? state.room : 'ent_gate';
    g.loadRoom(roomId, state.px, state.py, { fromSave: true });
    g.running = true;
    G.scene = 'game';
    if (opts.onStart) opts.onStart();
  };

  function spawnPoint(room) {
    const s = room.spawns.find((sp) => sp.t === 'start') || room.spawns.find((sp) => sp.t === 'save');
    if (s) return { x: s.x, y: s.y };
    return { x: 40, y: G.CELL_PX_H - 32 };
  }

  g.loadRoom = function (id, px, py, opts) {
    opts = opts || {};
    const s = G.state;
    const room = G.world.load(id);
    const seals = [];
    // persistent tile changes
    for (let ty = 0; ty < room.th; ty++)
      for (let tx = 0; tx < room.tw; tx++) {
        const t = room.tiles[ty * room.tw + tx];
        if (t === T.BREAK && s.flags['wall:' + id + ':' + tx + ',' + ty]) room.tiles[ty * room.tw + tx] = T.EMPTY;
        else if (t === T.SEAL && G.hasRelic(s, 'belmont_crest')) {
          room.tiles[ty * room.tw + tx] = T.EMPTY;
          if (!s.flags['seal:' + id]) seals.push([tx, ty]);
        }
        else if (t === T.INK) room.tiles[ty * room.tw + tx] = G.hasRelic(s, 'lantern') ? T.ONEWAY : T.EMPTY;
        if (t === T.WATER) room.hasWater = true;
        if (t === T.INK) room.hasInk = true;
      }
    G.renderRoom(room);
    g.room = room;
    // entities
    const keep = opts.keepEnts || [];
    g.ents = keep.slice();
    for (const sp of room.spawns) {
      const f = G.ENT[sp.t];
      if (!f) continue;
      const e = f(sp, g);
      if (e) g.add(e);
    }
    // seals that the Belmont Crest is about to dissolve: shatter when the player comes close
    if (seals.length) g.add(new SealShatter(room.id, seals));
    // player
    let pos;
    if (px != null && py != null) pos = { x: px, y: py };
    else pos = spawnPoint(room);
    if (!g.player || opts.fromSave) {
      g.player = new G.Player(g, pos.x, pos.y);
    } else {
      const p = g.player;
      p.x = pos.x - p.w / 2;
      p.y = pos.y - p.h;
      p.g = g;
    }
    g.player.resetCape();
    g.refreshFamiliar();
    // camera
    g.snapCamera();
    // area & music
    const area = room.area;
    if (area && area.id !== g.areaId) {
      g.areaId = area.id;
      if (!opts.fromSave || true) G.ui.areaBanner(G.tr(area.name));
      s.flags['visited_area_' + area.id] = 1;
    }
    if (!g.boss) G.audio.playMusic(room.def.music || (area && area.music) || 'entrance', { fade: 1.2 });
    g.markVisited();
    g.fadeIn = opts.fade || 10;
    G.emit('room', room);
    if (room.def.onEnter) room.def.onEnter(g, room);
    if (G.story && room.def.scene && !s.flags['scene_' + room.def.scene]) g.later(10, () => G.story.play(room.def.scene));
  };

  class SealShatter extends G.Ent {
    constructor(roomId, tiles) {
      super({ z: -1 });
      this.roomId = roomId;
      this.tiles = tiles;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [tx, ty] of tiles) {
        x0 = Math.min(x0, tx * 16);
        y0 = Math.min(y0, ty * 16);
        x1 = Math.max(x1, tx * 16 + 16);
        y1 = Math.max(y1, ty * 16 + 16);
      }
      this.x = x0;
      this.y = y0;
      this.w = x1 - x0;
      this.h = y1 - y0;
    }
    update(g) {
      this.t++;
      const p = g.player;
      const dx = Math.max(this.x - p.cx, 0, p.cx - (this.x + this.w));
      const dy = Math.max(this.y - p.cy, 0, p.cy - (this.y + this.h));
      if (Math.hypot(dx, dy) < 110 && !this.broken) {
        this.broken = true;
        G.state.flags['seal:' + this.roomId] = 1;
        G.audio.sfx('seal_break');
        gfx.flash('#fff0b0', 8);
        gfx.shake(2, 12);
        for (const [tx, ty] of this.tiles) {
          G.fx.burst(tx * 16 + 8, ty * 16 + 8, '#ffe08a', 6, 2.2, { glow: true });
          G.fx.debris(tx * 16 + 8, ty * 16 + 8, '#f0d070', 2);
        }
        this.dead = true;
      }
    }
    draw(ctx, camx, camy) {
      for (const [tx, ty] of this.tiles) {
        const x = tx * 16 - camx, y = ty * 16 - camy;
        if (x < -16 || x > G.W || y < -16 || y > G.H) continue;
        ctx.fillStyle = 'rgba(230,190,90,' + (0.3 + Math.sin(this.t * 0.1) * 0.08) + ')';
        ctx.fillRect(x, y, 16, 16);
        ctx.fillStyle = 'rgba(255,230,150,0.75)';
        ctx.fillRect(x + 7, y + 2, 2, 12);
        ctx.fillRect(x + 3, y + 6, 10, 2);
      }
    }
  }

  g.refreshFamiliar = function () {
    U.removeIf(g.ents, (e) => e.familiar);
    const s = G.state;
    for (const id in s.relics) {
      const r = G.RELICS[id];
      if (r && r.familiar && s.relics[id]) g.add(new G.Familiar(r.familiar, g.player));
    }
  };

  g.markVisited = function () {
    const p = g.player, room = g.room;
    const c = room.cellOf(U.clamp(p.cx, 0, room.pw - 1), U.clamp(p.cy, 0, room.ph - 1));
    const v = (G.state.visited[room.map] = G.state.visited[room.map] || {});
    const k = c.cx + ',' + c.cy;
    if (!v[k]) v[k] = 1;
  };

  g.snapCamera = function () {
    const p = g.player, room = g.room;
    g.lookX = p.facing * 18;
    g.camx = U.clamp(p.cx - G.W / 2 + g.lookX, 0, room.pw - G.W);
    g.camy = U.clamp(p.cy - G.H / 2 - 8, 0, room.ph - G.H);
  };

  g.updateCamera = function () {
    const p = g.player, room = g.room;
    g.lookX = U.approach(g.lookX, p.facing * 18, 0.8);
    const tx = U.clamp(p.cx - G.W / 2 + g.lookX, 0, room.pw - G.W);
    const ty = U.clamp(p.cy - G.H / 2 - 8, 0, room.ph - G.H);
    g.camx += (tx - g.camx) * 0.16;
    g.camy += (ty - g.camy) * (Math.abs(ty - g.camy) > 60 ? 0.25 : 0.14);
    if (Math.abs(tx - g.camx) < 0.2) g.camx = tx;
    if (Math.abs(ty - g.camy) < 0.2) g.camy = ty;
  };

  // ---- transitions -----------------------------------------------------------------------------
  g.goRoom = function (id, tx, ty, opts) {
    opts = opts || {};
    const doIt = () => {
      const keepP = g.player;
      const x = tx != null ? tx * 16 + 8 : null, y = ty != null ? (ty + 1) * 16 : null;
      g.boss = null;
      g.loadRoom(id, x, y, { fade: opts.fade || 20 });
      keepP.vx = 0;
      keepP.vy = 0;
      if (opts.flash) gfx.flash(opts.flash, 12);
      if (opts.after) opts.after();
    };
    if (opts.instant) doIt();
    else {
      g.transT = 14;
      g.pendingTrans = doIt;
    }
  };

  function checkExit() {
    const p = g.player, room = g.room, def = room.def;
    const cx = p.cx, cy = p.cy;
    if (cx >= 0 && cx < room.pw && cy >= 0 && cy < room.ph) return;
    const gx = def.x * G.CELL_PX_W + cx, gy = def.y * G.CELL_PX_H + cy;
    const ncx = Math.floor(gx / G.CELL_PX_W), ncy = Math.floor(gy / G.CELL_PX_H);
    const nid = G.world.roomAtCell(def.map, ncx, ncy);
    if (!nid || nid === room.id) {
      // blocked: clamp inside
      p.x = U.clamp(p.x, 0, room.pw - p.w);
      if (p.y + p.h > room.ph) {
        p.y = room.ph - p.h;
        p.vy = 0;
        p.onGround = true;
      }
      if (p.y < 0) {
        p.y = 0;
        p.vy = 0;
      }
      return;
    }
    const nd = G.world.rooms[nid];
    const lx = gx - nd.x * G.CELL_PX_W, ly = gy - nd.y * G.CELL_PX_H;
    const vx = p.vx, vy = p.vy;
    const upward = cy < 0;
    const keepEnts = g.ents.filter((e) => e.familiar);
    g.boss = null;
    g.loadRoom(nid, lx, ly + p.h / 2, { fade: 8, keepEnts });
    const np = g.player;
    np.vx = vx;
    np.vy = vy;
    if (upward) {
      np.vy = Math.min(vy, -4.2);
      np.y = Math.min(np.y, g.room.ph - np.h - 2);
    }
    // nudge out of walls if room edges disagree slightly
    for (let i = 0; i < 24 && P.rectSolid(g.room, np.x, np.y, np.w, np.h, np); i++) np.y -= 2;
    g.snapCamera();
  }

  // ---- combat ------------------------------------------------------------------------------------
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function breakTilesIn(box) {
    const room = g.room;
    const tx0 = Math.floor(box.x / 16), tx1 = Math.floor((box.x + box.w - 1) / 16);
    const ty0 = Math.floor(box.y / 16), ty1 = Math.floor((box.y + box.h - 1) / 16);
    let broke = false;
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        if (room.get(tx, ty) === T.BREAK) {
          room.set(tx, ty, T.EMPTY);
          G.state.flags['wall:' + room.id + ':' + tx + ',' + ty] = 1;
          G.fx.debris(tx * 16 + 8, ty * 16 + 8, room.theme.c.base, 12);
          broke = true;
        }
      }
    if (broke) {
      G.audio.sfx('break_wall');
      gfx.shake(2, 8);
      G.redrawTiles(room);
      if (!G.state.flags['secret_found_' + room.id]) {
        G.state.flags['secret_found_' + room.id] = 1;
        G.audio.sfx('secret', { vol: 0.7 });
      }
    }
  }

  function resolveCombat() {
    const pl = g.player;
    const boxes = pl.boxes;
    const projs = [];
    for (const e of g.ents) if (e instanceof G.PlayerProj && !e.dead) projs.push(e);
    for (const e of g.ents) {
      if (e.dead) continue;
      if (e instanceof G.Enemy) {
        if (!e.active) continue;
        const hb = e.hurtbox();
        for (const b of boxes) {
          if (overlap(b, hb)) {
            const ok = e.takeHit(Object.assign({ x: U.clamp(hb.x + hb.w / 2, b.x, b.x + b.w), y: b.y + b.h / 2 }, b), g);
            if (ok && b.dive) {
              pl.vy = -5;
              pl.diveT = 0;
              pl.flipT = 18;
            }
          }
        }
        for (const p of projs) {
          if (p.dead) continue;
          if (overlap(p, hb) && e.takeHit(p.box(), g)) {
            p.onHitEnemy(e, g);
            if (p.slow) e.vx *= 0.5;
          }
        }
      } else if (e.hit && !e.dead) {
        // candles and other breakables
        for (const b of boxes) if (overlap(b, e)) e.hit(g);
        for (const p of projs) if (!p.dead && overlap(p, e)) e.hit(g);
      }
    }
    for (const b of boxes) breakTilesIn(b);
    for (const p of projs) if (!p.dead && p.subKind && p.subKind !== 'grimoire') breakTilesIn(p);
  }

  // ---- bosses --------------------------------------------------------------------------------------
  g.startBoss = function (boss) {
    if (g.boss === boss) return;
    g.boss = boss;
    boss.active = true;
    // close the exits
    const room = g.room;
    g.shutters = [];
    for (const d of room.def._doors || []) {
      if (d.side === 'L' || d.side === 'R') {
        const tx = d.side === 'L' ? 0 : room.tw - 1;
        for (let ty = d.cell * G.CELL_H; ty < (d.cell + 1) * G.CELL_H; ty++) {
          if (room.get(tx, ty) === T.EMPTY) {
            g.shutters.push([tx, ty, room.get(tx, ty)]);
            room.set(tx, ty, T.SOLID);
          }
        }
      } else {
        const ty = d.side === 'T' ? 0 : room.th - 1;
        for (let tx = d.cell * G.CELL_W; tx < (d.cell + 1) * G.CELL_W; tx++) {
          const t = room.get(tx, ty);
          if (t === T.EMPTY || t === T.ONEWAY) {
            g.shutters.push([tx, ty, t]);
            room.set(tx, ty, T.SOLID);
          }
        }
      }
    }
    G.redrawTiles(room);
    G.audio.sfx('door');
    G.audio.playMusic(boss.def.music || 'boss', { fade: 0.4 });
  };
  g.endBoss = function (boss) {
    const room = g.room;
    G.state.flags['boss_' + boss.def.id] = 1;
    g.later(90, () => {
      for (const [tx, ty, t] of g.shutters || []) room.set(tx, ty, t);
      g.shutters = [];
      G.redrawTiles(room);
      G.audio.sfx('door');
      g.boss = null;
      G.audio.playMusic(room.def.music || room.area.music, { fade: 2 });
    });
    G.audio.stopMusic(0.5);
    g.later(30, () => G.audio.sfx('fanfare'));
  };

  // ---- consumables -------------------------------------------------------------------------------------
  G.useItem = function (id, fromFamiliar) {
    const s = G.state, it = G.ITEMS[id], pl = g.player;
    if (!it || it.kind !== 'use' || !G.invCount(s, id)) return false;
    if (it.warp) {
      if (g.boss) return false;
      G.invRemove(s, id);
      G.audio.sfx('teleport');
      g.goRoom(it.warp, null, null, { fade: 30, flash: '#ffffff' });
      return true;
    }
    if (it.revive) return false;
    let used = false;
    if (it.heal && s.hp < pl.st.hpMax) {
      pl.heal(it.heal);
      used = true;
    }
    if (it.mana && s.mp < pl.st.mpMax) {
      s.mp = Math.min(pl.st.mpMax, s.mp + it.mana);
      used = true;
    }
    if (it.hearts && s.hearts < pl.st.heartsMax) {
      s.hearts = Math.min(pl.st.heartsMax, s.hearts + it.hearts);
      used = true;
    }
    if (it.cure && s.status[it.cure] > 0) {
      s.status[it.cure] = 0;
      pl.refreshStats();
      used = true;
    }
    if (!used) return false;
    G.invRemove(s, id);
    G.audio.sfx(it.mana && !it.heal ? 'mp_restore' : 'heal');
    G.fx.burst(pl.cx, pl.cy, it.mana && !it.heal ? '#6080ff' : '#60ff90', 16, 1.6, { glow: true });
    return true;
  };

  g.onLevelUp = function (n) {
    const pl = g.player, s = G.state;
    const before = pl.st.hpMax;
    pl.refreshStats();
    s.hp = Math.min(pl.st.hpMax, s.hp + (pl.st.hpMax - before) + 10);
    s.mp = pl.st.mpMax;
    G.audio.sfx('level_up');
    G.ui.levelUp();
    G.fx.burst(pl.cx, pl.cy, '#ffe080', 30, 2.5, { glow: true });
  };

  g.doSave = function (sp) {
    const pl = g.player, s = G.state;
    pl.refreshStats();
    s.hp = pl.st.hpMax;
    s.mp = pl.st.mpMax;
    s.status.poison = 0;
    s.status.curse = 0;
    G.audio.sfx('save');
    gfx.flash('#ff3050', 20);
    G.ui.openSave({ room: g.room.id, x: sp.cx, y: sp.fy });
  };

  // ---- update -------------------------------------------------------------------------------------------
  g.update = function () {
    g.frame++;
    G.state.time++;
    // queued callbacks
    if (g.queue.length) {
      const due = g.queue.filter((q) => q.f <= g.frame);
      if (due.length) {
        g.queue = g.queue.filter((q) => q.f > g.frame);
        due.forEach((q) => q.fn());
      }
    }
    if (g.fadeIn > 0) g.fadeIn--;
    if (g.transT > 0) {
      g.transT--;
      if (g.transT === 7 && g.pendingTrans) {
        const f = g.pendingTrans;
        g.pendingTrans = null;
        f();
      }
      return;
    }
    if (g.lastHitT > 0) g.lastHitT--;
    if (g.hitstop > 0) {
      g.hitstop--;
      G.fx.update();
      return;
    }
    const pl = g.player;
    pl.update();
    if (!pl.dead && !pl.locked) {
      checkExit();
      g.markVisited();
    }
    if (g.timeStop > 0) g.timeStop--;
    const list = g.ents;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      if (g.timeStop > 0 && (e instanceof G.Enemy || e.team === 'enemy')) {
        if (!(e.boss && g.frame % 3 === 0)) continue;
      }
      e.update(g);
      if (e.poison > 0) {
        e.poison--;
        if (e.poison % 40 === 0 && e.hp > 1) {
          e.hp -= 2;
          G.fx.number(e.cx, e.y, 2, '#80ff80');
        }
      }
    }
    // moving platforms carry the player
    for (const e of list) {
      if (!e.solidTop || e.dead) continue;
      const p = pl;
      if (p.form === 'bat' || p.form === 'mist') continue;
      const onTop = p.x + p.w > e.x && p.x < e.x + e.w && Math.abs(p.fy - (e.y - (e.dy || 0))) <= 4 && p.vy >= 0;
      if (onTop && !(p.dropT > 0)) {
        p.y = e.y - p.h;
        p.x += e.dx || 0;
        p.vy = 0;
        p.onGround = true;
      }
    }
    resolveCombat();
    U.removeIf(list, (e) => e.dead);
    G.fx.update();
    g.updateCamera();
    // interactions
    g.interactEnt = null;
    if (pl.form === 'human' && pl.onGround && !pl.dead && !pl.locked && !pl.atk) {
      for (const e of list)
        if (e.interact && !e.hidden && e.overlapsPlayer(g)) {
          g.interactEnt = e;
          break;
        }
      if (g.interactEnt && I.pressed.up && !(G.story && G.story.active)) {
        I.consume('up');
        g.interactEnt.onInteract(g);
      }
    }
    // low health warning
    if (G.state.hp > 0 && G.state.hp < pl.st.hpMax * 0.2 && g.frame % 90 === 0) G.audio.sfx('low_health', { vol: 0.4 });
    if (pl.dead && pl.deadT === 150) G.ui.gameOver();
  };

  // ---- draw --------------------------------------------------------------------------------------------------
  g.draw = function () {
    const ctx = gfx.ctx, room = g.room, th = room.theme;
    const cx = Math.round(g.camx), cy = Math.round(g.camy);
    if (room.renderedVersion !== room.version) G.redrawTiles(room);
    if (room.needsFar) G.drawFar(ctx, room.def.far || th.far, cx, cy, g.frame);
    else {
      ctx.fillStyle = th.c.wall2 || '#000';
      ctx.fillRect(0, 0, G.W, G.H);
    }
    ctx.drawImage(room.bgCanvas, cx, cy, G.W, G.H, 0, 0, G.W, G.H);
    // static lights
    const ls = room.lightsStatic;
    for (let i = 0; i < ls.length; i++) {
      const L = ls[i];
      const sx = L.x - cx, sy = L.y - cy;
      if (sx < -100 || sx > G.W + 100 || sy < -100 || sy > G.H + 100) continue;
      const fl = L.flicker ? 0.9 + Math.sin(g.frame * 0.21 + i * 1.7) * 0.07 + Math.sin(g.frame * 0.53 + i) * 0.04 : 1;
      gfx.addLight(sx, sy, L.r * (L.flicker ? fl : 1), L.color, L.i * fl);
    }
    // entities behind tiles
    for (const e of g.ents) if (e.z < 0) e.draw(ctx, cx, cy);
    ctx.drawImage(room.fgCanvas, cx, cy, G.W, G.H, 0, 0, G.W, G.H);
    if (room.hasInk) drawInkGlow(ctx, room, cx, cy);
    // owl brooch: reveal breakable walls
    if (g.player.st.flags.seeWalls) drawSecretHints(ctx, room, cx, cy);
    const sorted = g.ents.filter((e) => e.z >= 0).sort((a, b) => a.z - b.z);
    for (const e of sorted) if (e.z < 3) e.draw(ctx, cx, cy);
    g.player.draw(ctx, cx, cy);
    for (const e of sorted) if (e.z >= 3) e.draw(ctx, cx, cy);
    G.fx.draw(ctx, cx, cy);
    G.drawWater(ctx, room, cx, cy, g.frame);
    if (room.def.weather === 'rain') drawRain(ctx, cx, cy);
    if (g.timeStop > 0) {
      ctx.fillStyle = 'rgba(120,130,255,0.12)';
      ctx.fillRect(0, 0, G.W, G.H);
    }
    // player light
    const p = g.player;
    gfx.addLight(p.cx - cx, p.cy - cy, p.form === 'mist' ? 50 : 72, null, 0.75);
    gfx.applyLighting(room.def.darkness != null ? room.def.darkness : th.darkness, th.tint);
    G.fx.drawNumbers(ctx, cx, cy);
    if (g.transT > 0) gfx.fade = g.transT > 7 ? (14 - g.transT) / 7 : g.transT / 7;
    else gfx.fade = g.fadeIn > 0 ? g.fadeIn / 10 : 0;
  };

  function drawRain(ctx, cx, cy) {
    const t = g.frame;
    ctx.fillStyle = 'rgba(170,190,255,0.35)';
    for (let i = 0; i < 70; i++) {
      const x = ((i * 53 + t * 3 - cx * 0.9) % (G.W + 40) + G.W + 40) % (G.W + 40) - 20;
      const y = ((i * 97 + t * 9 - cy) % (G.H + 30) + G.H + 30) % (G.H + 30) - 15;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 6);
    }
    if (t % 600 === 0) {
      gfx.flash('#c8d0ff', 6);
      G.audio.sfx('thunder', { vol: 0.5 });
    }
  }
  function drawInkGlow(ctx, room, cx, cy) {
    const owned = G.hasRelic(G.state, 'lantern');
    const x0 = Math.max(0, Math.floor(cx / 16)), x1 = Math.min(room.tw - 1, Math.floor((cx + G.W) / 16));
    const y0 = Math.max(0, Math.floor(cy / 16)), y1 = Math.min(room.th - 1, Math.floor((cy + G.H) / 16));
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (room.def._rows[ty][tx] !== 'I') continue;
        const sx = tx * 16 - cx, sy = ty * 16 - cy;
        if (owned) {
          ctx.fillStyle = '#2a1a4a';
          ctx.fillRect(sx, sy, 16, 4);
          ctx.fillStyle = '#b48cff';
          ctx.fillRect(sx, sy, 16, 1);
          gfx.addLight(sx + 8, sy, 20, '#b48cff', 0.3);
        } else if ((g.frame + tx * 13) % 120 < 6) {
          ctx.fillStyle = 'rgba(180,140,255,0.25)';
          ctx.fillRect(sx, sy, 16, 2);
        }
      }
  }
  function drawSecretHints(ctx, room, cx, cy) {
    if (g.frame % 50 > 30) return;
    const x0 = Math.max(0, Math.floor(cx / 16)), x1 = Math.min(room.tw - 1, Math.floor((cx + G.W) / 16));
    const y0 = Math.max(0, Math.floor(cy / 16)), y1 = Math.min(room.th - 1, Math.floor((cy + G.H) / 16));
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (room.get(tx, ty) === T.BREAK) {
          ctx.fillStyle = 'rgba(255,230,140,0.25)';
          ctx.fillRect(tx * 16 - cx, ty * 16 - cy, 16, 16);
        }
  }
})();
