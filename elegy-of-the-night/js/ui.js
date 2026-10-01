/* Elegy of the Night — ui.js
 * HUD, notifications, banners and every in-game panel: pause menu (status,
 * equipment, items, relics, spells, map, bestiary, system), shop, save slots,
 * teleporter list, lore reader, game over. Drawn on the high-res UI layer
 * in virtual 384x224 coordinates.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, I = G.input, gfx = G.gfx;

  const UI = (G.ui = { stack: [], notes: [], banners: [], area: null, lvlT: 0, t: 0 });
  const W = G.W, H = G.H;
  const COL = { text: '#ece6d6', dim: '#9a94a8', gold: '#e8c872', sel: '#ffffff', red: '#ff7080', green: '#80ff9a', blue: '#8ab0ff', hp: '#d8303c', mp: '#3c66e0' };

  UI.arrowFor = function (d) {
    return { f: '→', b: '←', u: '↑', d: '↓', uf: '↗', ub: '↖', df: '↘', db: '↙' }[d] || d;
  };
  function T(o) {
    return G.tr(o);
  }
  function txt(s, x, y, o) {
    gfx.text(s, x, y, o);
  }
  function icon(it, x, y, sz) {
    if (!it) return;
    const m = gfx.mctx;
    m.imageSmoothingEnabled = false;
    m.drawImage(G.itemIcon(it), x, y, sz || 12, sz || 12);
  }
  function bar(x, y, w, h, frac, c1, c2, bg) {
    const m = gfx.mctx;
    m.fillStyle = bg || 'rgba(0,0,0,0.65)';
    m.fillRect(x, y, w, h);
    const fw = Math.max(0, Math.min(1, frac)) * w;
    const gr = m.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, c2 || U.shade(c1, 0.35));
    gr.addColorStop(1, c1);
    m.fillStyle = gr;
    m.fillRect(x, y, fw, h);
    m.strokeStyle = 'rgba(220,210,180,0.6)';
    m.lineWidth = 0.4;
    m.strokeRect(x, y, w, h);
  }
  function selBar(x, y, w, h) {
    const m = gfx.mctx;
    const a = 0.35 + Math.sin(UI.t * 0.12) * 0.12;
    const gr = m.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(120,150,255,' + a + ')');
    gr.addColorStop(1, 'rgba(120,150,255,0)');
    m.fillStyle = gr;
    m.fillRect(x, y, w, h);
    m.fillStyle = COL.gold;
    m.beginPath();
    m.moveTo(x - 4, y + h / 2 - 2.5);
    m.lineTo(x - 0.5, y + h / 2);
    m.lineTo(x - 4, y + h / 2 + 2.5);
    m.fill();
  }

  UI.push = (p) => {
    UI.stack.push(p);
    if (p.onOpen) p.onOpen();
    return p;
  };
  UI.pop = () => {
    const p = UI.stack.pop();
    if (p && p.onClose) p.onClose();
    if (!UI.stack.length) G.audio.duck(false);
    return p;
  };
  UI.top = () => UI.stack[UI.stack.length - 1];
  UI.modal = () => UI.stack.length > 0;
  UI.closeAll = () => {
    while (UI.stack.length) UI.pop();
  };

  // ---- notifications & banners ----------------------------------------------------------------
  UI.notify = function (text, col, it) {
    UI.notes.push({ text, col: col || COL.text, it, t: 0 });
    if (UI.notes.length > 4) UI.notes.shift();
  };
  UI.banner = function (title, desc, col, dur) {
    UI.push(new Banner(title, desc, col, dur));
  };
  UI.areaBanner = function (name) {
    UI.area = { name, t: 0 };
  };
  UI.levelUp = function () {
    UI.lvlT = 120;
  };

  UI.tick = function () {
    UI.t++;
    for (const n of UI.notes) n.t++;
    U.removeIf(UI.notes, (n) => n.t > 170);
    if (UI.area) {
      UI.area.t++;
      if (UI.area.t > 200) UI.area = null;
    }
    if (UI.lvlT > 0) UI.lvlT--;
  };
  UI.update = function () {
    const p = UI.top();
    if (p) p.update();
  };

  // ---- HUD ---------------------------------------------------------------------------------------
  UI.drawHUD = function () {
    const g = G.game, s = G.state, pl = g.player;
    if (!pl) return;
    const st = pl.st;
    const m = gfx.mctx;
    // frame
    m.save();
    const gr = m.createLinearGradient(0, 4, 0, 34);
    gr.addColorStop(0, 'rgba(14,10,26,0.82)');
    gr.addColorStop(1, 'rgba(4,2,10,0.72)');
    m.fillStyle = gr;
    m.beginPath();
    m.moveTo(6, 4);
    m.lineTo(122, 4);
    m.lineTo(128, 10);
    m.lineTo(122, 32);
    m.lineTo(6, 32);
    m.closePath();
    m.fill();
    m.strokeStyle = 'rgba(214,180,110,0.75)';
    m.lineWidth = 0.6;
    m.stroke();
    // sub-weapon orb
    m.fillStyle = '#0a0612';
    m.beginPath();
    m.arc(17, 18, 11, 0, Math.PI * 2);
    m.fill();
    m.strokeStyle = '#c9a24a';
    m.lineWidth = 1.2;
    m.stroke();
    m.strokeStyle = 'rgba(255,240,200,0.4)';
    m.lineWidth = 0.4;
    m.beginPath();
    m.arc(17, 18, 9, 0, Math.PI * 2);
    m.stroke();
    if (s.sub) icon(G.SUBWEAPONS[s.sub], 9, 10, 16);
    m.restore();
    // HP
    txt(G.t('hp'), 32, 13.5, { size: 5.5, font: 'title', color: '#e0b0b0' });
    txt(String(s.hp), 43, 14, { size: 9, font: 'title', weight: 700, color: s.hp < st.hpMax * 0.25 ? (UI.t % 30 < 15 ? '#ff5060' : '#ffffff') : '#ffffff' });
    // hearts
    m.fillStyle = '#e8304a';
    m.beginPath();
    m.arc(89.5, 9.5, 1.8, 0, 7);
    m.arc(92.5, 9.5, 1.8, 0, 7);
    m.fill();
    m.beginPath();
    m.moveTo(87.8, 10.3);
    m.lineTo(91, 14);
    m.lineTo(94.2, 10.3);
    m.fill();
    txt(String(s.hearts), 97, 14, { size: 7.5, font: 'title', weight: 700, color: '#ffc0cc' });
    bar(32, 17, 86, 4, s.hp / st.hpMax, COL.hp, '#ff8080');
    bar(32, 23.5, 86, 3, s.mp / st.mpMax, COL.mp, '#90b0ff');
    // status
    let sx = 32;
    if (s.status.poison > 0) {
      txt(G.t('status_poison'), sx, 31, { size: 4.5, color: '#80ff80' });
      sx += 24;
    }
    if (s.status.curse > 0) txt(G.t('status_curse'), sx, 31, { size: 4.5, color: '#d080ff' });
    if (pl.buffs.darkMeta > 0) txt('✦', 120, 30, { size: 6, color: '#ff4060' });
    // minimap
    if (!G.settings || G.settings.minimap !== false) drawMinimap(W - 52, 5, 48, 26);
    // boss bar
    if (g.boss && !g.boss.dead) {
      const b = g.boss;
      const bw = 200, bx = (W - bw) / 2, by = H - 16;
      txt(T(b.def.name), W / 2, by - 2.5, { size: 7, font: 'title', align: 'center', color: '#f0d8a0' });
      bar(bx, by, bw, 5, b.hp / b.maxHp, '#a01020', '#ff5060');
    } else if (g.lastHitT > 0 && g.lastHitEnemy && (G.relicOn(s, 'lore_lens') || st.flags.showHp)) {
      const e = g.lastHitEnemy;
      txt(T(e.def.name), 8, H - 12, { size: 6, font: 'title', color: '#e0e0f0', alpha: Math.min(1, g.lastHitT / 30) });
      if (st.flags.showHp || G.relicOn(s, 'lore_lens')) bar(8, H - 9, 70, 3, Math.max(0, e.hp) / e.maxHp, '#c03040');
    }
    // interaction prompt
    if (g.interactEnt && !UI.modal() && !(G.story && G.story.active)) {
      const e = g.interactEnt;
      const x = e.cx - g.camx, y = e.y - g.camy - 6;
      txt(G.t(e.prompt || 'up_to_use'), x, y, { size: 6, font: 'title', align: 'center', color: COL.gold, alpha: 0.75 + Math.sin(UI.t * 0.15) * 0.25 });
    }
    // floating texts
    G.fx.drawTexts(Math.round(g.camx), Math.round(g.camy));
    // area banner (hidden while a menu or panel is open over the game)
    if (UI.area && !UI.modal()) {
      const t = UI.area.t, a = t < 30 ? t / 30 : t > 160 ? (200 - t) / 40 : 1;
      txt(UI.area.name, W / 2, 50, { size: 11, font: 'title', align: 'center', color: '#f0e0c0', alpha: a, gradient: ['#fff4dc', '#c8a060'] });
      const m2 = gfx.mctx;
      m2.globalAlpha = a * 0.7;
      m2.fillStyle = '#c9a24a';
      const lw = gfx.measure(UI.area.name, 11, 'title') / 2 + 10;
      m2.fillRect(W / 2 - lw - 30, 46, 26, 0.6);
      m2.fillRect(W / 2 + lw + 4, 46, 26, 0.6);
      m2.globalAlpha = 1;
    }
    if (UI.lvlT > 0) {
      const a = Math.min(1, UI.lvlT / 30);
      txt(G.t('level_up'), W / 2, 92 - (120 - UI.lvlT) * 0.15, { size: 12, font: 'title', weight: 700, align: 'center', alpha: a, gradient: ['#fff6c8', '#e0a030'], stroke: 'rgba(60,20,0,0.8)' });
      txt(G.t('level') + ' ' + s.level, W / 2, 104 - (120 - UI.lvlT) * 0.15, { size: 7, font: 'title', align: 'center', color: '#ffe8b0', alpha: a });
    }
    // notifications
    let ny = H - 22;
    for (let i = UI.notes.length - 1; i >= 0; i--) {
      const n = UI.notes[i];
      const a = n.t < 10 ? n.t / 10 : n.t > 140 ? (170 - n.t) / 30 : 1;
      const w = gfx.measure(n.text, 7) + (n.it ? 18 : 10);
      const x = W - w - 8;
      gfx.mctx.globalAlpha = a;
      gfx.panel(x, ny - 9, w, 13, { top: 'rgba(16,14,40,0.85)', bottom: 'rgba(6,6,20,0.9)' });
      if (n.it) icon(n.it, x + 3, ny - 7.5, 10);
      gfx.mctx.globalAlpha = 1;
      txt(n.text, x + (n.it ? 15 : 5), ny, { size: 7, color: n.col, alpha: a });
      ny -= 16;
    }
  };

  function drawMinimap(x, y, w, h) {
    const g = G.game, room = g.room, s = G.state;
    const m = gfx.mctx;
    const cw = 6, ch = 4;
    const pc = room.cellOf(U.clamp(g.player.cx, 0, room.pw - 1), U.clamp(g.player.cy, 0, room.ph - 1));
    const cols = Math.floor(w / cw), rows = Math.floor(h / ch);
    m.fillStyle = 'rgba(0,0,0,0.55)';
    m.fillRect(x, y, w, h);
    m.strokeStyle = 'rgba(200,180,120,0.6)';
    m.lineWidth = 0.4;
    m.strokeRect(x, y, w, h);
    const ox = pc.cx - Math.floor(cols / 2), oy = pc.cy - Math.floor(rows / 2);
    const vis = s.visited[room.map] || {};
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const cx = ox + i, cy = oy + j;
        if (!vis[cx + ',' + cy]) continue;
        const rid = G.world.roomAtCell(room.map, cx, cy);
        if (!rid) continue;
        drawCell(m, room.map, rid, cx, cy, x + i * cw, y + j * ch, cw, ch);
      }
    if (UI.t % 30 < 20) {
      m.fillStyle = '#ffffff';
      m.fillRect(x + (pc.cx - ox) * cw + 2, y + (pc.cy - oy) * ch + 1, 2, 2);
    }
  }

  // one map cell (used by the minimap and the map screen)
  function drawCell(m, mapId, rid, cx, cy, x, y, cw, ch) {
    const def = G.world.rooms[rid];
    const f = def._feat || {};
    let fill = '#2346b4';
    if (f.save) fill = '#c0283c';
    else if (f.teleport) fill = '#c8a028';
    else if (f.portal) fill = '#8a40c0';
    else if (def.map === 'archives') fill = '#5a2a8a';
    m.fillStyle = fill;
    m.fillRect(x, y, cw, ch);
    m.fillStyle = 'rgba(255,255,255,0.12)';
    m.fillRect(x, y, cw, 0.6);
    // walls
    const lx = cx - def.x, ly = cy - def.y;
    const wall = '#f0f0ff';
    const lw = Math.max(0.5, cw / 9);
    const door = (side, cell) => (def._doors || []).some((d) => d.side === side && d.cell === cell && d.to);
    m.fillStyle = wall;
    if (lx === 0 && !door('L', ly)) m.fillRect(x, y, lw, ch);
    if (lx === def.w - 1 && !door('R', ly)) m.fillRect(x + cw - lw, y, lw, ch);
    if (ly === 0 && !door('T', lx)) m.fillRect(x, y, cw, lw);
    if (ly === def.h - 1 && !door('B', lx)) m.fillRect(x, y + ch - lw, cw, lw);
    // door ticks
    if (lx === 0 && door('L', ly)) m.fillRect(x, y, lw, ch * 0.35);
    if (lx === def.w - 1 && door('R', ly)) m.fillRect(x + cw - lw, y, lw, ch * 0.35);
  }
  UI.drawCell = drawCell;

  // ---- base panel -------------------------------------------------------------------------------
  class Panel {
    update() {}
    draw() {}
  }

  class Banner extends Panel {
    constructor(title, desc, col, dur) {
      super();
      this.title = title;
      this.desc = desc;
      this.col = col || COL.gold;
      this.t = 0;
      this.dur = dur || 200;
    }
    update() {
      this.t++;
      if ((this.t > 30 && (I.pressed.confirm || I.pressed.attack || I.pressed.menu)) || this.t > this.dur) UI.pop();
    }
    draw() {
      const a = Math.min(1, this.t / 12);
      const lines = gfx.wrap(this.desc, 250, 7);
      const h = 26 + lines.length * 9;
      const y = 60;
      gfx.mctx.globalAlpha = a;
      gfx.panel(W / 2 - 140, y, 280, h);
      gfx.mctx.globalAlpha = 1;
      txt(this.title, W / 2, y + 14, { size: 10, font: 'title', weight: 700, align: 'center', color: this.col, alpha: a, stroke: 'rgba(0,0,0,0.6)' });
      lines.forEach((l, i) => txt(l, W / 2, y + 26 + i * 9, { size: 7, align: 'center', color: COL.text, alpha: a }));
    }
  }

  // ---- pause menu -------------------------------------------------------------------------------
  const TABS = ['status', 'equip', 'items', 'relics', 'spells', 'map', 'bestiary', 'system'];
  class PauseMenu extends Panel {
    constructor(tab) {
      super();
      this.tab = Math.max(0, TABS.indexOf(tab || 'status'));
      this.cur = {};
      this.sub = null; // equip item chooser etc.
      this.mapId = G.game.room.map;
      this.mapOff = null;
      this.confirm = null;
    }
    onOpen() {
      G.audio.sfx('menu_open');
      G.audio.duck(true);
    }
    get name() {
      return TABS[this.tab];
    }
    cursor(key, n, wrapV) {
      let c = this.cur[key] || 0;
      if (I.repeat('down')) {
        c = c + 1 >= n ? (wrapV === false ? n - 1 : 0) : c + 1;
        G.audio.sfx('menu_move');
      }
      if (I.repeat('up')) {
        c = c - 1 < 0 ? (wrapV === false ? 0 : n - 1) : c - 1;
        G.audio.sfx('menu_move');
      }
      c = U.clamp(c, 0, Math.max(0, n - 1));
      this.cur[key] = c;
      return c;
    }
    update() {
      if (this.confirm) return this.confirm.update();
      if (!this.sub) {
        if (I.pressed.tabR || (I.pressed.right && !['map', 'system', 'equip'].includes(this.name) && false)) {
          this.tab = (this.tab + 1) % TABS.length;
          G.audio.sfx('menu_move');
          return;
        }
        if (I.pressed.tabL) {
          this.tab = (this.tab + TABS.length - 1) % TABS.length;
          G.audio.sfx('menu_move');
          return;
        }
        if (I.pressed.cancel || I.pressed.menu || (this.name === 'map' && I.pressed.map)) {
          G.audio.sfx('menu_cancel');
          UI.pop();
          G.game.player.refreshStats();
          return;
        }
      }
      const fn = this['u_' + this.name];
      if (fn) fn.call(this);
    }
    draw() {
      const m = gfx.mctx;
      m.fillStyle = 'rgba(2,2,10,0.72)';
      m.fillRect(0, 0, W, H);
      // tabs
      const tw = (W - 16) / TABS.length;
      TABS.forEach((t, i) => {
        const x = 8 + i * tw;
        const on = i === this.tab;
        gfx.panel(x + 1, 5, tw - 2, 14, on ? { top: 'rgba(60,70,160,0.95)', bottom: 'rgba(20,20,70,0.95)', border: '#f0e0b0' } : { top: 'rgba(16,18,48,0.9)', bottom: 'rgba(6,6,20,0.9)' });
        txt(G.t('tab_' + t), x + tw / 2, 14.5, { size: 6, font: 'title', align: 'center', color: on ? '#ffffff' : COL.dim, maxWidth: tw - 6 });
      });
      txt('Q ◂', 4, 14.5, { size: 5, color: COL.dim });
      txt('▸ E', W - 4, 14.5, { size: 5, color: COL.dim, align: 'right' });
      const fn = this['d_' + this.name];
      if (fn) fn.call(this);
      if (this.confirm) this.confirm.draw();
    }

    // -- status --
    u_status() {}
    d_status() {
      const s = G.state, pl = G.game.player, st = pl.st;
      gfx.panel(8, 24, 120, 190);
      gfx.panel(132, 24, 122, 190);
      gfx.panel(258, 24, 118, 190);
      // portrait
      const por = G.portrait && G.portrait('alucard');
      if (por) {
        gfx.mctx.imageSmoothingEnabled = false;
        gfx.mctx.drawImage(por, 36, 32, 64, 74);
      }
      txt('ALUCARD', 68, 118, { size: 10, font: 'title', weight: 700, align: 'center', gradient: ['#ffffff', '#b8c0e0'] });
      txt(G.t('level') + '  ' + s.level, 18, 134, { size: 8, font: 'title', color: COL.gold });
      txt(G.t('exp') + '  ' + s.exp, 18, 146, { size: 7, color: COL.text });
      txt(G.t('next') + '  ' + Math.max(0, G.expFor(s.level) - s.exp), 18, 156, { size: 7, color: COL.text });
      txt(G.t('gold') + '  ' + s.gold, 18, 170, { size: 7, color: '#ffe070' });
      txt(G.t('kills') + '  ' + s.kills, 18, 180, { size: 7, color: COL.text });
      txt(G.t('time') + '  ' + U.fmtTime(s.time), 18, 190, { size: 7, color: COL.text });
      const st1 = s.status.poison > 0 ? G.t('status_poison') : s.status.curse > 0 ? G.t('status_curse') : G.t('status_good');
      txt(st1, 18, 204, { size: 7, color: s.status.poison > 0 ? '#80ff80' : s.status.curse > 0 ? '#d080ff' : COL.blue });
      // stats
      const rows = [
        [G.t('hp'), s.hp + ' / ' + st.hpMax, COL.red],
        [G.t('mp'), s.mp + ' / ' + st.mpMax, COL.blue],
        [G.t('hearts'), s.hearts + ' / ' + st.heartsMax, '#ffb0c0'],
        ['', ''],
        [G.t('str'), st.str], [G.t('con'), st.con], [G.t('int'), st.int], [G.t('lck'), st.lck],
        ['', ''],
        [G.t('atk') + ' (R)', st.atkR, COL.gold], [G.t('atk') + ' (L)', st.atkL, COL.gold], [G.t('def'), st.def, COL.gold],
      ];
      rows.forEach((r, i) => {
        if (!r[0]) return;
        txt(r[0], 142, 40 + i * 14, { size: 7.5, font: 'title', color: r[2] || COL.dim });
        txt(String(r[1]), 244, 40 + i * 14, { size: 8, align: 'right', color: '#ffffff' });
      });
      // equipment & maps
      txt(G.t('tab_equip'), 266, 38, { size: 7, font: 'title', color: COL.gold });
      G.SLOTS.forEach((sl, i) => {
        const id = s.equip[sl];
        const it = id && G.ITEMS[id];
        txt(G.t('slot_' + sl), 266, 50 + i * 12, { size: 5.5, color: COL.dim });
        if (it) icon(it, 300, 42.5 + i * 12, 9);
        txt(it ? T(it.name) : G.t('nothing'), 311, 50 + i * 12, { size: 6, color: it ? COL.text : COL.dim, maxWidth: 62 });
      });
      txt(G.t('rooms'), 266, 150, { size: 7, font: 'title', color: COL.gold });
      txt(G.t('map_castle') + '  ' + G.mapCompletion(s, 'castle').toFixed(1) + '%', 266, 162, { size: 6.5, color: COL.text });
      txt(G.t('map_archives') + '  ' + G.mapCompletion(s, 'archives').toFixed(1) + '%', 266, 173, { size: 6.5, color: '#d0b0ff' });
      const tot = G.mapCompletion(s, 'castle') + G.mapCompletion(s, 'archives');
      txt(G.t('completion') + '  ' + tot.toFixed(1) + '%', 266, 188, { size: 7, color: '#ffffff' });
    }

    // -- equipment --
    u_equip() {
      const s = G.state;
      if (!this.sub) {
        const c = this.cursor('eq', G.SLOTS.length);
        if (I.pressed.confirm) {
          G.audio.sfx('menu_select');
          this.sub = { slot: G.SLOTS[c], cur: 0 };
        }
        return;
      }
      const list = this.equipList(this.sub.slot);
      const n = list.length;
      if (I.repeat('down')) {
        this.sub.cur = (this.sub.cur + 1) % n;
        G.audio.sfx('menu_move');
      }
      if (I.repeat('up')) {
        this.sub.cur = (this.sub.cur + n - 1) % n;
        G.audio.sfx('menu_move');
      }
      if (I.pressed.cancel) {
        G.audio.sfx('menu_cancel');
        this.sub = null;
        return;
      }
      if (I.pressed.confirm) {
        const id = list[this.sub.cur];
        if (id === s.equip[this.sub.slot]) {
          this.sub = null;
          return;
        }
        G.equipItem(s, this.sub.slot, id === '__none' ? null : id);
        G.audio.sfx('menu_select');
        G.game.player.refreshStats();
        this.sub = null;
      }
    }
    equipList(slot) {
      const s = G.state;
      const ids = Object.keys(s.inv).filter((id) => {
        const it = G.ITEMS[id];
        return it && G.slotAccepts(slot, it);
      });
      ids.sort((a, b) => (G.ITEMS[b].atk || G.ITEMS[b].def || 0) - (G.ITEMS[a].atk || G.ITEMS[a].def || 0));
      return ['__none'].concat(ids);
    }
    d_equip() {
      const s = G.state, pl = G.game.player;
      gfx.panel(8, 24, 176, 120);
      gfx.panel(188, 24, 188, 120);
      gfx.panel(8, 148, 368, 66);
      const c = this.cur.eq || 0;
      G.SLOTS.forEach((sl, i) => {
        const y = 38 + i * 15;
        if (i === c) selBar(14, y - 9, 166, 13);
        const id = s.equip[sl];
        const it = id && G.ITEMS[id];
        txt(G.t('slot_' + sl), 18, y, { size: 6.5, font: 'title', color: COL.dim });
        if (it) icon(it, 72, y - 9, 11);
        txt(it ? T(it.name) : G.t('nothing'), 86, y, { size: 7, color: it ? COL.text : COL.dim, maxWidth: 94 });
      });
      // stats preview
      const st = pl.st;
      let pv = null, focusIt = null;
      if (this.sub) {
        const list = this.equipList(this.sub.slot);
        const id = list[this.sub.cur];
        focusIt = id !== '__none' ? G.ITEMS[id] : null;
        const tmp = JSON.parse(JSON.stringify({ base: s.base, equip: s.equip, inv: s.inv, status: s.status }));
        G.equipItem(tmp, this.sub.slot, id === '__none' ? null : id);
        pv = G.calcStats(tmp);
        // item list
        const start = Math.max(0, this.sub.cur - 6);
        list.slice(start, start + 8).forEach((lid, k) => {
          const i = start + k;
          const y = 38 + k * 13;
          if (i === this.sub.cur) selBar(194, y - 9, 176, 12);
          const it = lid === '__none' ? null : G.ITEMS[lid];
          if (it) icon(it, 198, y - 8.5, 10);
          txt(it ? T(it.name) : G.t('nothing'), 212, y, { size: 7, color: it ? COL.text : COL.dim, maxWidth: 130 });
          if (it) txt('×' + s.inv[lid], 366, y, { size: 6, align: 'right', color: COL.dim });
        });
      } else {
        focusIt = s.equip[G.SLOTS[c]] && G.ITEMS[s.equip[G.SLOTS[c]]];
        const rows = [[G.t('atk') + ' R', st.atkR], [G.t('atk') + ' L', st.atkL], [G.t('def'), st.def], [G.t('str'), st.str], [G.t('con'), st.con], [G.t('int'), st.int], [G.t('lck'), st.lck]];
        rows.forEach((r, i) => {
          txt(r[0], 200, 40 + i * 14, { size: 7, font: 'title', color: COL.dim });
          txt(String(r[1]), 300, 40 + i * 14, { size: 7.5, align: 'right', color: '#ffffff' });
        });
      }
      if (pv) {
        const rows = [['atkR', G.t('atk') + ' R'], ['atkL', G.t('atk') + ' L'], ['def', G.t('def')], ['str', G.t('str')], ['con', G.t('con')], ['int', G.t('int')], ['lck', G.t('lck')]];
        // compact diff line
        const parts = rows.map(([k, lab]) => [lab, pv[k] - st[k], pv[k]]).filter((r) => r[1]);
        parts.forEach((r, i) => txt(r[0] + ' ' + r[2] + (r[1] > 0 ? ' ▲' + r[1] : ' ▼' + -r[1]), 16 + (i % 4) * 90, 160 + Math.floor(i / 4) * 10, { size: 6.5, color: r[1] > 0 ? COL.green : COL.red }));
      }
      if (focusIt) {
        const y0 = pv ? 182 : 162;
        txt(T(focusIt.name), 16, y0, { size: 8, font: 'title', color: COL.gold });
        gfx.wrap(T(focusIt.desc), 350, 7).slice(0, 2).forEach((l, i) => txt(l, 16, y0 + 11 + i * 9, { size: 7, color: COL.text }));
        const extra = [];
        if (focusIt.atk) extra.push(G.t('atk') + ' ' + focusIt.atk);
        if (focusIt.def) extra.push(G.t('def') + ' ' + focusIt.def);
        if (focusIt.el && focusIt.el !== 'hit' && focusIt.el !== 'cut') extra.push(T(G.ELEMENTS[focusIt.el]));
        if (focusIt.hands === 2) extra.push(G.t('two_handed'));
        if (extra.length) txt(extra.join('  ·  '), 370, y0, { size: 6.5, align: 'right', color: COL.blue });
      }
    }

    // -- items --
    itemList() {
      const s = G.state;
      const ids = Object.keys(s.inv).filter((id) => G.ITEMS[id] && (G.ITEMS[id].kind === 'use' || G.ITEMS[id].kind === 'key'));
      const ord = Object.keys(G.ITEMS);
      ids.sort((a, b) => (G.ITEMS[a].kind === 'key') - (G.ITEMS[b].kind === 'key') || ord.indexOf(a) - ord.indexOf(b));
      // equipment is shown too (for reference), after consumables
      const eq = Object.keys(s.inv).filter((id) => G.ITEMS[id] && G.isEquippable(G.ITEMS[id]));
      eq.sort((a, b) => ord.indexOf(a) - ord.indexOf(b));
      return ids.concat(eq);
    }
    u_items() {
      const list = this.itemList();
      if (!list.length) return;
      const c = this.cursor('it', list.length);
      if (I.pressed.confirm) {
        const id = list[c];
        const it = G.ITEMS[id];
        if (it.kind === 'use') {
          if (G.useItem(id)) {
            if (it.warp) UI.pop();
          } else {
            G.audio.sfx('menu_error');
            UI.notify(G.t('cannot_use'), COL.dim);
          }
        }
      }
    }
    d_items() {
      const s = G.state;
      const list = this.itemList();
      gfx.panel(8, 24, 368, 150);
      gfx.panel(8, 178, 368, 36);
      if (!list.length) {
        txt(G.t('no_items'), W / 2, 100, { size: 8, align: 'center', color: COL.dim });
        return;
      }
      const c = this.cur.it || 0;
      const per = 22, start = Math.max(0, Math.min(c - 10, list.length - per));
      list.slice(Math.max(0, start), Math.max(0, start) + per).forEach((id, k) => {
        const i = Math.max(0, start) + k;
        const col = k % 2, row = Math.floor(k / 2);
        const x = 16 + col * 182, y = 38 + row * 12.5;
        if (i === c) selBar(x - 2, y - 9, 176, 12);
        const it = G.ITEMS[id];
        icon(it, x, y - 8.5, 10);
        const usable = it.kind === 'use';
        txt(T(it.name), x + 13, y, { size: 7, color: usable ? COL.text : it.kind === 'key' ? '#f0d8a0' : COL.dim, maxWidth: 140 });
        txt('×' + s.inv[id], x + 172, y, { size: 6.5, align: 'right', color: COL.dim });
      });
      const it = G.ITEMS[list[c]];
      if (it) {
        txt(T(it.name), 16, 190, { size: 8, font: 'title', color: COL.gold });
        txt(T(it.desc), 16, 203, { size: 7, color: COL.text, maxWidth: 352 });
      }
    }

    // -- relics --
    relicList() {
      return Object.keys(G.RELICS).filter((id) => G.hasRelic(G.state, id));
    }
    u_relics() {
      const list = this.relicList();
      if (!list.length) return;
      const c = this.cursor('rl', list.length);
      if (I.pressed.confirm) {
        const id = list[c];
        const r = G.RELICS[id];
        if (r.toggle) {
          G.state.relics[id] = !G.state.relics[id];
          G.audio.sfx('menu_select');
          if (r.familiar) {
            // only one familiar at a time
            if (G.state.relics[id]) for (const o in G.RELICS) if (o !== id && G.RELICS[o].familiar && G.state.relics[o]) G.state.relics[o] = false;
            G.game.refreshFamiliar();
          }
        } else G.audio.sfx('menu_error');
      }
    }
    d_relics() {
      const list = this.relicList();
      gfx.panel(8, 24, 368, 150);
      gfx.panel(8, 178, 368, 36);
      const all = Object.keys(G.RELICS);
      txt(list.length + ' / ' + all.length, 368, 34, { size: 6, align: 'right', color: COL.dim });
      if (!list.length) {
        txt(G.t('no_items'), W / 2, 100, { size: 8, align: 'center', color: COL.dim });
        return;
      }
      const c = this.cur.rl || 0;
      list.forEach((id, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = 16 + col * 182, y = 44 + row * 18;
        if (i === c) selBar(x - 2, y - 11, 176, 15);
        const r = G.RELICS[id];
        icon(r, x, y - 10, 12);
        txt(T(r.name), x + 16, y, { size: 7.5, font: 'title', color: COL.text, maxWidth: 120 });
        if (r.toggle) txt(G.state.relics[id] ? G.t('on') : G.t('off'), x + 172, y, { size: 7, align: 'right', color: G.state.relics[id] ? COL.green : COL.red });
      });
      const r = G.RELICS[list[c]];
      if (r) {
        txt(T(r.name), 16, 190, { size: 8, font: 'title', color: COL.gold });
        txt(T(r.desc), 16, 203, { size: 7, color: COL.text, maxWidth: 352 });
      }
    }

    // -- spells --
    u_spells() {
      this.cursor('sp', Object.keys(G.SPELLS).length);
    }
    d_spells() {
      const s = G.state;
      gfx.panel(8, 24, 368, 150);
      gfx.panel(8, 178, 368, 36);
      const ids = Object.keys(G.SPELLS);
      const c = this.cur.sp || 0;
      ids.forEach((id, i) => {
        const sp = G.SPELLS[id];
        const known = sp.known || s.spells[id];
        const y = 42 + i * 17;
        if (i === c) selBar(14, y - 10, 356, 14);
        txt(known ? T(sp.name) : G.t('spell_unknown'), 20, y, { size: 7.5, font: 'title', color: known ? (sp.isNew ? '#d8b0ff' : COL.text) : COL.dim });
        if (known) {
          txt(sp.seq.map(UI.arrowFor).join(' ') + '  + ' + G.t('atk'), 200, y, { size: 8, color: COL.gold });
          txt(sp.mp + ' ' + G.t('mp'), 364, y, { size: 7, align: 'right', color: COL.blue });
        }
      });
      const sp = G.SPELLS[ids[c]];
      if (sp && (sp.known || s.spells[ids[c]])) {
        txt(T(sp.desc), 16, 192, { size: 7, color: COL.text, maxWidth: 352 });
        txt(G.tr({ en: 'Directions are for facing right; they mirror when facing left.', es: 'Direcciones mirando a la derecha; se invierten al mirar a la izquierda.' }), 16, 205, { size: 6, color: COL.dim, maxWidth: 352 });
      } else txt(G.tr({ en: 'Hidden tomes in the Belmont Archives teach new spells.', es: 'Tomos ocultos en los Archivos Belmont enseñan hechizos nuevos.' }), 16, 196, { size: 7, color: COL.dim });
    }

    // -- map --
    u_map() {
      if (I.pressed.confirm) {
        this.mapId = this.mapId === 'castle' ? 'archives' : 'castle';
        this.mapOff = null;
        G.audio.sfx('menu_select');
      }
      if (!this.mapOff) this.mapOff = { x: 0, y: 0 };
      const sp = 3;
      if (I.held.left) this.mapOff.x += sp;
      if (I.held.right) this.mapOff.x -= sp;
      if (I.held.up) this.mapOff.y += sp;
      if (I.held.down) this.mapOff.y -= sp;
    }
    d_map() {
      UI.drawMap(this.mapId, 8, 24, 368, 190, this.mapOff || { x: 0, y: 0 });
    }

    // -- bestiary --
    bestList() {
      const s = G.state;
      return Object.keys(G.ENEMIES).filter((id) => s.bestiary[id]);
    }
    u_bestiary() {
      const l = this.bestList();
      if (l.length) this.cursor('bs', l.length);
    }
    d_bestiary() {
      UI.drawBestiary(this.bestList(), this.cur.bs || 0);
    }

    // -- system --
    sysItems() {
      const st = G.settings;
      const pct = (v) => Math.round(v * 100) + '%';
      return [
        { k: 'lang', label: G.t('language'), val: G.lang === 'es' ? 'Español' : 'English' },
        { k: 'music', label: G.t('music_vol'), val: pct(st.music) },
        { k: 'sfx', label: G.t('sfx_vol'), val: pct(st.sfx) },
        { k: 'voice', label: G.t('voice_vol'), val: pct(st.voice) },
        { k: 'voices', label: G.t('voices'), val: st.voices ? G.t('on') : G.t('off') },
        { k: 'shake', label: G.t('screen_shake'), val: st.shake ? G.t('on') : G.t('off') },
        { k: 'dmgNumbers', label: G.t('show_damage'), val: st.dmgNumbers ? G.t('on') : G.t('off') },
        { k: 'minimap', label: 'Minimap / Minimapa', val: st.minimap ? G.t('on') : G.t('off') },
        { k: 'touch', label: G.t('touch_controls'), val: st.touch === 'auto' ? G.t('auto') : st.touch ? G.t('on') : G.t('off') },
        { k: 'export', label: G.t('export_save') },
        { k: 'import', label: G.t('import_save') },
        { k: 'quit', label: G.t('to_title') },
      ];
    }
    u_system() {
      const items = this.sysItems();
      const c = this.cursor('sy', items.length);
      const it = items[c];
      const st = G.settings;
      const dir = I.repeat('right') ? 1 : I.repeat('left') ? -1 : 0;
      const step = (k) => {
        st[k] = Math.round(U.clamp(st[k] + dir * 0.1, 0, 1) * 10) / 10;
        G.applySettings();
        G.audio.sfx('menu_move');
      };
      if (['music', 'sfx', 'voice'].includes(it.k) && dir) step(it.k);
      if (I.pressed.confirm || (dir && ['lang', 'voices', 'shake', 'dmgNumbers', 'minimap', 'touch'].includes(it.k))) {
        switch (it.k) {
          case 'lang':
            G.lang = G.lang === 'es' ? 'en' : 'es';
            st.lang = G.lang;
            break;
          case 'voices':
            st.voices = !st.voices;
            break;
          case 'shake':
            st.shake = !st.shake;
            break;
          case 'dmgNumbers':
            st.dmgNumbers = !st.dmgNumbers;
            break;
          case 'minimap':
            st.minimap = !st.minimap;
            break;
          case 'touch':
            st.touch = st.touch === 'auto' ? true : st.touch === true ? false : 'auto';
            break;
          case 'export':
            G.save.exportCurrent();
            break;
          case 'import':
            G.save.importFile(() => {});
            break;
          case 'quit':
            this.confirm = new Confirm(G.t('quit_q'), (yes) => {
              this.confirm = null;
              if (yes) {
                UI.closeAll();
                G.toTitle();
              }
            });
            return;
        }
        G.applySettings();
        G.audio.sfx('menu_select');
      }
    }
    d_system() {
      gfx.panel(8, 24, 220, 190);
      gfx.panel(232, 24, 144, 190);
      const items = this.sysItems();
      const c = this.cur.sy || 0;
      items.forEach((it, i) => {
        const y = 40 + i * 14;
        if (i === c) selBar(14, y - 9.5, 208, 13);
        txt(it.label, 20, y, { size: 7, color: COL.text, maxWidth: 130 });
        if (it.val) txt('◂ ' + it.val + ' ▸', 216, y, { size: 7, align: 'right', color: COL.gold });
      });
      // controls cheat-sheet
      txt(G.t('controls'), 304, 38, { size: 8, font: 'title', align: 'center', color: COL.gold });
      const rows = G.controlsHelp();
      rows.forEach((r, i) => {
        txt(r[0], 240, 52 + i * 10.5, { size: 6, color: COL.dim, maxWidth: 62 });
        txt(r[1], 370, 52 + i * 10.5, { size: 6, align: 'right', color: COL.text, maxWidth: 70 });
      });
      txt(G.t(G.save.backend === 'cloud' ? 'storage_cloud' : G.save.backend === 'local' ? 'storage_local' : 'storage_none'), 304, 208, { size: 5.5, align: 'center', color: COL.dim, maxWidth: 136 });
    }
  }
  UI.openPause = function (tab) {
    UI.push(new PauseMenu(tab));
  };

  // ---- map drawing ---------------------------------------------------------------------------------
  UI.drawMap = function (mapId, x, y, w, h, off) {
    const s = G.state, m = gfx.mctx;
    const map = G.world.maps[mapId];
    gfx.panel(x, y, w, h, { top: 'rgba(4,6,24,0.96)', bottom: 'rgba(2,2,12,0.96)' });
    txt(T(map.name), x + 10, y + 13, { size: 8, font: 'title', color: mapId === 'archives' ? '#d8b0ff' : COL.gold });
    txt(G.mapCompletion(s, mapId).toFixed(1) + '% ' + G.t('explored'), x + w - 10, y + 13, { size: 7, align: 'right', color: COL.text });
    txt('[Z] ' + (mapId === 'castle' ? G.t('map_archives') : G.t('map_castle')) + '   ↑↓←→', x + w - 10, y + h - 6, { size: 5.5, align: 'right', color: COL.dim });
    if (!map.total) return;
    const cols = map.maxX - map.minX + 1, rows = map.maxY - map.minY + 1;
    const cw = Math.max(4, Math.min(9, Math.floor((w - 20) / cols))), ch = Math.max(3, Math.round(cw * 0.62));
    const mw = cols * cw, mh = rows * ch;
    let ox = x + (w - mw) / 2 + off.x, oy = y + 18 + (h - 30 - mh) / 2 + off.y;
    m.save();
    m.beginPath();
    m.rect(x + 3, y + 17, w - 6, h - 26);
    m.clip();
    const vis = s.visited[mapId] || {};
    for (const key in vis) {
      const [cx, cy] = key.split(',').map(Number);
      const rid = G.world.roomAtCell(mapId, cx, cy);
      if (!rid) continue;
      drawCell(m, mapId, rid, cx, cy, ox + (cx - map.minX) * cw, oy + (cy - map.minY) * ch, cw, ch);
    }
    // current position
    const g = G.game;
    if (g.room && g.room.map === mapId && UI.t % 40 < 26) {
      const pc = g.room.cellOf(U.clamp(g.player.cx, 0, g.room.pw - 1), U.clamp(g.player.cy, 0, g.room.ph - 1));
      m.fillStyle = '#ffffff';
      m.fillRect(ox + (pc.cx - map.minX) * cw + cw / 2 - 1.5, oy + (pc.cy - map.minY) * ch + ch / 2 - 1.5, 3, 3);
    }
    m.restore();
    // legend
    const lg = [['#c0283c', G.t('legend_save')], ['#c8a028', G.t('legend_warp')], ['#8a40c0', G.t('map_archives')]];
    lg.forEach((l, i) => {
      m.fillStyle = l[0];
      m.fillRect(x + 10 + i * 70, y + h - 11, 6, 4);
      txt(l[1], x + 19 + i * 70, y + h - 6.5, { size: 5.5, color: COL.dim });
    });
  };

  // ---- bestiary drawing (also used by the Librarian) ----------------------------------------------
  const prevCanvas = { c: null };
  UI.drawBestiary = function (list, c) {
    const s = G.state;
    gfx.panel(8, 24, 150, 190);
    gfx.panel(162, 24, 214, 190);
    const total = Object.keys(G.ENEMIES).filter((id) => !G.ENEMIES[id].hidden).length;
    txt(list.length + ' / ' + total, 150, 34, { size: 6, align: 'right', color: COL.dim });
    if (!list.length) {
      txt('—', 83, 100, { size: 8, align: 'center', color: COL.dim });
      return;
    }
    const per = 15, start = Math.max(0, Math.min(c - 7, list.length - per));
    list.slice(start, start + per).forEach((id, k) => {
      const i = start + k, y = 46 + k * 11.5;
      if (i === c) selBar(14, y - 8.5, 140, 11);
      txt(T(G.ENEMIES[id].name), 18, y, { size: 6.5, color: COL.text, maxWidth: 110 });
      txt(String(s.bestiary[id]), 152, y, { size: 6, align: 'right', color: COL.dim });
    });
    const d = G.ENEMIES[list[c]];
    if (!d) return;
    // preview sprite
    if (!prevCanvas.c) prevCanvas.c = gfx.makeCanvas(96, 72);
    const pc = gfx.ctxOf(prevCanvas.c);
    pc.clearRect(0, 0, 96, 72);
    try {
      if (!prevCanvas.e || prevCanvas.e.def !== d) {
        prevCanvas.e = new G.Enemy(d, { x: 48, y: 64 }, G.game);
        prevCanvas.e.facing = 1;
      }
      const e = prevCanvas.e;
      e.t = UI.t;
      e.stT = UI.t;
      e._flashDraw = false;
      e.preview = true;
      e.alpha = 1;
      e.rise = 1;
      if (d.previewState) e.state = d.previewState;
      else if (['buried', 'rising', 'hang', 'hidden', 'dormant', 'sleep', 'perch', 'disguised', 'asleep'].includes(e.state)) e.state = 'walk';
      const sc = Math.min(1, 60 / Math.max(e.h, 1), 90 / Math.max(e.w, 1));
      pc.save();
      pc.translate(48, 66);
      pc.scale(sc, sc);
      if (d.draw) d.draw(e, pc, 0, 0);
      pc.restore();
    } catch (err) {
      /* preview is best-effort */
    }
    gfx.mctx.imageSmoothingEnabled = false;
    gfx.mctx.drawImage(prevCanvas.c, 172, 30, 96, 72);
    txt(T(d.name), 274, 44, { size: 8.5, font: 'title', color: COL.gold, maxWidth: 98 });
    txt(G.t('hp') + ' ' + d.hp, 274, 58, { size: 7, color: COL.text });
    txt(G.t('atk') + ' ' + d.atk + '   ' + G.t('def') + ' ' + (d.def || 0), 274, 69, { size: 7, color: COL.text });
    txt(G.t('exp') + ' ' + d.exp, 274, 80, { size: 7, color: COL.text });
    const el = (arr) => arr.map((e) => T(G.ELEMENTS[e] || { en: e, es: e })).join(', ');
    let yy = 114;
    if (d.weak.length) {
      txt(G.t('weak') + ': ' + el(d.weak), 172, yy, { size: 6.5, color: '#ff9a60', maxWidth: 196 });
      yy += 10;
    }
    if (d.resist.length) {
      txt(G.t('resist') + ': ' + el(d.resist), 172, yy, { size: 6.5, color: COL.blue, maxWidth: 196 });
      yy += 10;
    }
    if (d.absorb.length) {
      txt(G.t('absorb') + ': ' + el(d.absorb), 172, yy, { size: 6.5, color: COL.green, maxWidth: 196 });
      yy += 10;
    }
    gfx.wrap(T(d.desc || ''), 196, 6.5).slice(0, 7).forEach((l, i) => txt(l, 172, yy + 6 + i * 9, { size: 6.5, color: COL.dim }));
  };

  // ---- confirm dialog -------------------------------------------------------------------------------
  class Confirm extends Panel {
    constructor(q, cb) {
      super();
      this.q = q;
      this.cb = cb;
      this.c = 1;
    }
    update() {
      if (I.pressed.left || I.pressed.right || I.pressed.up || I.pressed.down) {
        this.c = 1 - this.c;
        G.audio.sfx('menu_move');
      }
      if (I.pressed.confirm) {
        G.audio.sfx(this.c === 0 ? 'menu_select' : 'menu_cancel');
        this.cb(this.c === 0);
      } else if (I.pressed.cancel) {
        G.audio.sfx('menu_cancel');
        this.cb(false);
      }
    }
    draw() {
      const lines = gfx.wrap(this.q, 220, 7.5);
      const h = 34 + lines.length * 10;
      const y = H / 2 - h / 2;
      gfx.panel(W / 2 - 125, y, 250, h);
      lines.forEach((l, i) => txt(l, W / 2, y + 15 + i * 10, { size: 7.5, align: 'center', color: COL.text }));
      [G.t('yes'), G.t('no')].forEach((o, i) => {
        const x = W / 2 - 40 + i * 80, yy = y + h - 10;
        if (i === this.c) selBar(x - 22, yy - 9, 44, 12);
        txt(o, x, yy, { size: 8, font: 'title', align: 'center', color: i === this.c ? '#fff' : COL.dim });
      });
    }
  }
  UI.Confirm = Confirm;
  UI.confirm = function (q, cb) {
    UI.push(
      new Confirm(q, (yes) => {
        UI.pop();
        cb(yes);
      })
    );
  };

  // ---- save slots ----------------------------------------------------------------------------------------
  class SavePanel extends Panel {
    constructor(at, mode) {
      super();
      this.at = at;
      this.mode = mode || 'save'; // 'save' | 'load'
      this.c = Math.max(0, (G.save.lastSlot || 1) - 1);
      this.msg = null;
      this.msgT = 0;
      this.busy = false;
      this.metas = [null, null, null];
      this.refresh();
    }
    refresh() {
      G.save.listMeta().then((m) => (this.metas = m));
    }
    onOpen() {
      G.audio.duck(true);
    }
    update() {
      if (this.confirm) return this.confirm.update();
      if (this.msgT > 0) {
        this.msgT--;
        if (this.msgT === 0 && this.closeAfter) UI.pop();
        return;
      }
      if (this.busy) return;
      if (I.repeat('down')) {
        this.c = (this.c + 1) % 3;
        G.audio.sfx('menu_move');
      }
      if (I.repeat('up')) {
        this.c = (this.c + 2) % 3;
        G.audio.sfx('menu_move');
      }
      if (I.pressed.cancel) {
        G.audio.sfx('menu_cancel');
        UI.pop();
        return;
      }
      if (I.pressed.confirm) {
        const slot = this.c + 1;
        const doSave = () => {
          this.busy = true;
          const s = G.state;
          s.room = this.at.room;
          s.px = this.at.x;
          s.py = this.at.y;
          s.saveRoom = this.at.room;
          s.saves = (s.saves || 0) + 1;
          G.save.write(slot, s).then((ok) => {
            this.busy = false;
            this.msg = ok ? G.t('saved') : G.t('save_fail');
            this.msgT = 70;
            this.closeAfter = ok;
            G.audio.sfx(ok ? 'menu_select' : 'menu_error');
            this.refresh();
          });
        };
        if (this.metas[this.c]) {
          this.confirm = new Confirm(G.t('overwrite'), (yes) => {
            this.confirm = null;
            if (yes) doSave();
          });
        } else doSave();
      }
    }
    draw() {
      const m = gfx.mctx;
      m.fillStyle = 'rgba(40,0,10,0.45)';
      m.fillRect(0, 0, W, H);
      txt(G.t('save_here'), W / 2, 34, { size: 11, font: 'title', align: 'center', gradient: ['#ffe0e0', '#c04050'] });
      for (let i = 0; i < 3; i++) {
        const y = 48 + i * 52;
        gfx.panel(48, y, 288, 46, i === this.c ? { border: '#ffe0a0', top: 'rgba(60,20,40,0.95)', bottom: 'rgba(20,6,16,0.95)' } : {});
        UI.drawSlotMeta(this.metas[i], i + 1, 56, y, i === this.c);
      }
      if (this.msg && this.msgT > 0) {
        gfx.panel(W / 2 - 70, H / 2 - 12, 140, 24);
        txt(this.msg, W / 2, H / 2 + 3, { size: 8, font: 'title', align: 'center', color: COL.gold });
      }
      if (this.confirm) this.confirm.draw();
    }
  }
  UI.drawSlotMeta = function (meta, n, x, y, sel) {
    txt(G.t('slot') + ' ' + n, x, y + 13, { size: 8, font: 'title', color: sel ? COL.gold : COL.dim });
    if (!meta) {
      txt(G.t('empty_slot'), x + 140, y + 27, { size: 8, align: 'center', color: COL.dim });
      return;
    }
    txt('ALUCARD  ' + G.t('level') + ' ' + meta.level, x + 50, y + 13, { size: 8, font: 'title', color: '#ffffff' });
    txt(meta.areaName ? T(meta.areaName) : '', x + 50, y + 25, { size: 7, color: COL.text, maxWidth: 160 });
    txt(G.t('time') + ' ' + U.fmtTime(meta.time || 0), x + 270, y + 13, { size: 7, align: 'right', color: COL.text });
    txt((meta.pct || 0).toFixed(1) + '%', x + 270, y + 25, { size: 7, align: 'right', color: '#d0b0ff' });
    txt(G.t('hp') + ' ' + meta.hp + '/' + meta.hpMax + '   ' + G.t('gold') + ' ' + meta.gold, x + 50, y + 37, { size: 6.5, color: COL.dim });
    if (meta.date) txt(meta.date, x + 270, y + 37, { size: 6, align: 'right', color: COL.dim });
  };
  UI.openSave = function (at) {
    UI.push(new SavePanel(at));
  };

  // ---- teleporter list ------------------------------------------------------------------------------------
  class TeleportPanel extends Panel {
    constructor(from) {
      super();
      this.from = from;
      this.list = Object.keys(G.state.flags)
        .filter((k) => k.startsWith('tp_') && G.world.rooms[k.slice(3)])
        .map((k) => k.slice(3));
      this.c = Math.max(0, this.list.indexOf(from));
    }
    onOpen() {
      G.audio.duck(true);
      G.audio.sfx('menu_open');
    }
    update() {
      const n = this.list.length;
      if (I.repeat('down')) {
        this.c = (this.c + 1) % n;
        G.audio.sfx('menu_move');
      }
      if (I.repeat('up')) {
        this.c = (this.c + n - 1) % n;
        G.audio.sfx('menu_move');
      }
      if (I.pressed.cancel) {
        UI.pop();
        G.audio.sfx('menu_cancel');
        return;
      }
      if (I.pressed.confirm) {
        const id = this.list[this.c];
        UI.pop();
        if (id === this.from) return;
        const def = G.world.rooms[id];
        const sp = new G.world.Room(def).spawns.find((s) => s.t === 'teleport');
        G.audio.sfx('teleport');
        G.game.goRoom(id, sp ? sp.tx : null, sp ? sp.ty : null, { fade: 30, flash: '#ffe0a0' });
      }
    }
    draw() {
      gfx.panel(W / 2 - 110, 30, 220, 30 + this.list.length * 14);
      txt(G.t('teleport_to'), W / 2, 46, { size: 9, font: 'title', align: 'center', color: COL.gold });
      this.list.forEach((id, i) => {
        const y = 64 + i * 14;
        if (i === this.c) selBar(W / 2 - 96, y - 9.5, 192, 13);
        const def = G.world.rooms[id];
        txt(G.world.areaName(def.area) + (id === this.from ? '  ✦' : ''), W / 2 - 88, y, { size: 7.5, color: id === this.from ? COL.dim : COL.text });
      });
    }
  }
  UI.openTeleport = function (from) {
    UI.push(new TeleportPanel(from));
  };

  // ---- lore reader ------------------------------------------------------------------------------------------
  class Reader extends Panel {
    constructor(L) {
      super();
      this.L = L;
      this.t = 0;
    }
    onOpen() {
      G.audio.sfx('page_flutter');
      G.audio.duck(true);
    }
    update() {
      this.t++;
      if (this.t > 15 && (I.pressed.confirm || I.pressed.cancel || I.pressed.up)) {
        UI.pop();
        G.audio.sfx('page_flutter', { vol: 0.5 });
      }
    }
    draw() {
      const m = gfx.mctx;
      m.fillStyle = 'rgba(0,0,0,0.6)';
      m.fillRect(0, 0, W, H);
      const x = 52, y = 22, w = 280, h = 180;
      const gr = m.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, '#efe2c2');
      gr.addColorStop(1, '#d8c69c');
      m.fillStyle = gr;
      m.fillRect(x, y, w, h);
      m.strokeStyle = '#8a6a3a';
      m.lineWidth = 1;
      m.strokeRect(x + 4, y + 4, w - 8, h - 8);
      txt(T(this.L.title), W / 2, y + 22, { size: 10, font: 'title', weight: 700, align: 'center', color: '#5a1420', shadow: false });
      const lines = gfx.wrap(T(this.L.text), w - 40, 7.5);
      lines.slice(0, 15).forEach((l, i) => txt(l, x + 20, y + 40 + i * 9.5, { size: 7.5, color: '#2a1a10', shadow: false, italic: !!this.L.italic }));
      if (this.L.sign) txt(T(this.L.sign), x + w - 20, y + h - 14, { size: 7, align: 'right', italic: true, color: '#5a3a2a', shadow: false });
    }
  }
  UI.openReader = function (L) {
    UI.push(new Reader(L));
  };

  // ---- shop ---------------------------------------------------------------------------------------------------
  class Shop extends Panel {
    constructor() {
      super();
      this.mode = 'root';
      this.c = 0;
      this.qty = 1;
      this.say = G.tr({ en: 'Welcome, Master Alucard. Browse at your leisure.', es: 'Bienvenido, maese Alucard. Mire con calma.' });
      this.cur = {};
    }
    onOpen() {
      G.audio.duck(true);
      G.audio.playMusic('shop', { fade: 0.6 });
    }
    onClose() {
      const r = G.game.room;
      G.audio.playMusic(r.def.music || r.area.music, { fade: 0.8 });
    }
    stock() {
      return G.SHOP.filter((e) => !e.flag || G.state.flags[e.flag]).map((e) => e.id).filter((id) => G.ITEMS[id]);
    }
    sellable() {
      return Object.keys(G.state.inv).filter((id) => G.ITEMS[id] && G.ITEMS[id].kind !== 'key' && (G.ITEMS[id].price || 0) > 0);
    }
    update() {
      const s = G.state;
      if (this.mode === 'root') {
        const opts = 5;
        if (I.repeat('down')) {
          this.c = (this.c + 1) % opts;
          G.audio.sfx('menu_move');
        }
        if (I.repeat('up')) {
          this.c = (this.c + opts - 1) % opts;
          G.audio.sfx('menu_move');
        }
        if (I.pressed.cancel) {
          G.audio.sfx('menu_cancel');
          UI.pop();
          return;
        }
        if (I.pressed.confirm) {
          G.audio.sfx('menu_select');
          if (this.c === 0) {
            this.mode = 'buy';
            this.cur.list = 0;
          } else if (this.c === 1) {
            this.mode = 'sell';
            this.cur.list = 0;
          } else if (this.c === 2) {
            this.mode = 'bestiary';
            this.cur.bs = 0;
          } else if (this.c === 3) {
            const hints = G.LIBRARIAN_HINTS || [];
            const h = hints.find((x) => (!x.need || s.flags[x.need]) && (!x.until || !s.flags[x.until])) || hints[0];
            if (h) {
              this.say = T(h.text);
              G.audio.say(h.text.en, { speaker: 'librarian' });
            }
          } else UI.pop();
        }
        return;
      }
      if (this.mode === 'bestiary') {
        const l = Object.keys(G.ENEMIES).filter((id) => s.bestiary[id]);
        if (l.length) {
          if (I.repeat('down')) this.cur.bs = (this.cur.bs + 1) % l.length;
          if (I.repeat('up')) this.cur.bs = (this.cur.bs + l.length - 1) % l.length;
        }
        if (I.pressed.cancel) this.mode = 'root';
        return;
      }
      const list = this.mode === 'buy' ? this.stock() : this.sellable();
      if (!list.length) {
        if (I.pressed.cancel) this.mode = 'root';
        return;
      }
      const n = list.length;
      if (this.mode === 'qty') return;
      if (I.repeat('down')) {
        this.cur.list = (this.cur.list + 1) % n;
        this.qty = 1;
        G.audio.sfx('menu_move');
      }
      if (I.repeat('up')) {
        this.cur.list = (this.cur.list + n - 1) % n;
        this.qty = 1;
        G.audio.sfx('menu_move');
      }
      const id = list[this.cur.list];
      const it = G.ITEMS[id];
      const consumable = it.kind === 'use';
      if (consumable) {
        if (I.repeat('right')) this.qty = Math.min(99, this.qty + 1);
        if (I.repeat('left')) this.qty = Math.max(1, this.qty - 1);
      } else this.qty = 1;
      if (I.pressed.cancel) {
        this.mode = 'root';
        G.audio.sfx('menu_cancel');
        return;
      }
      if (I.pressed.confirm) {
        if (this.mode === 'buy') {
          const cost = it.price * this.qty;
          if (s.gold < cost) {
            G.audio.sfx('menu_error');
            this.say = G.t('not_enough_gold');
            return;
          }
          s.gold -= cost;
          G.invAdd(s, id, this.qty);
          G.audio.sfx('gold');
          this.say = G.t('thank_you');
        } else {
          const val = Math.floor((it.price || 0) / 2) * this.qty;
          if (G.invCount(s, id) < this.qty) return;
          G.invRemove(s, id, this.qty);
          s.gold += val;
          G.audio.sfx('gold');
          this.qty = 1;
          if (this.cur.list >= this.sellable().length) this.cur.list = Math.max(0, this.sellable().length - 1);
        }
      }
    }
    draw() {
      const s = G.state, m = gfx.mctx;
      m.fillStyle = 'rgba(4,2,0,0.7)';
      m.fillRect(0, 0, W, H);
      // header with portrait
      gfx.panel(8, 8, 368, 46, { top: 'rgba(40,24,10,0.95)', bottom: 'rgba(16,10,4,0.95)', border: '#e0c080' });
      const por = G.portrait && G.portrait('librarian');
      if (por) {
        m.imageSmoothingEnabled = false;
        m.drawImage(por, 12, 10, 36, 42);
      }
      txt(G.t('shop_title'), 54, 22, { size: 9, font: 'title', color: COL.gold });
      gfx.wrap(this.say, 230, 7).slice(0, 2).forEach((l, i) => txt(l, 54, 34 + i * 9, { size: 7, italic: true, color: COL.text }));
      txt(G.t('gold') + '  ' + s.gold, 368, 22, { size: 8, align: 'right', color: '#ffe070' });
      if (this.mode === 'root') {
        gfx.panel(8, 60, 120, 82);
        [G.t('buy'), G.t('sell'), G.t('enemy_list'), G.t('talk'), G.t('leave')].forEach((o, i) => {
          const y = 76 + i * 14;
          if (i === this.c) selBar(14, y - 9.5, 108, 13);
          txt(o, 22, y, { size: 8, font: 'title', color: i === this.c ? '#fff' : COL.text });
        });
        return;
      }
      if (this.mode === 'bestiary') {
        const l = Object.keys(G.ENEMIES).filter((id) => s.bestiary[id]);
        m.save();
        m.translate(0, 34);
        m.scale(1, 0.85);
        UI.drawBestiary(l, this.cur.bs || 0);
        m.restore();
        return;
      }
      const list = this.mode === 'buy' ? this.stock() : this.sellable();
      gfx.panel(8, 60, 368, 120);
      gfx.panel(8, 184, 368, 32);
      if (!list.length) {
        txt('—', W / 2, 120, { size: 8, align: 'center', color: COL.dim });
        return;
      }
      const c = this.cur.list || 0;
      const per = 8, start = Math.max(0, Math.min(c - 3, list.length - per));
      list.slice(start, start + per).forEach((id, k) => {
        const i = start + k, y = 76 + k * 13.5;
        const it = G.ITEMS[id];
        if (i === c) selBar(14, y - 9.5, 356, 13);
        icon(it, 18, y - 9, 11);
        txt(T(it.name), 33, y, { size: 7.5, color: COL.text, maxWidth: 170 });
        const price = this.mode === 'buy' ? it.price : Math.floor(it.price / 2);
        txt(G.t('owned') + ' ' + G.invCount(s, id), 270, y, { size: 6.5, align: 'right', color: COL.dim });
        txt(String(price), 360, y, { size: 7.5, align: 'right', color: s.gold >= price || this.mode === 'sell' ? '#ffe070' : COL.red });
      });
      const it = G.ITEMS[list[c]];
      if (it) {
        txt(T(it.desc), 16, 197, { size: 7, color: COL.text, maxWidth: 270 });
        if (it.kind === 'use') txt('◂ ' + G.t('quantity') + ' ' + this.qty + ' ▸', 368, 197, { size: 7, align: 'right', color: COL.gold });
        const total = (this.mode === 'buy' ? it.price : Math.floor(it.price / 2)) * this.qty;
        txt('= ' + total, 368, 209, { size: 7, align: 'right', color: '#ffe070' });
      }
    }
  }
  UI.openShop = function () {
    UI.push(new Shop());
  };

  // ---- game over ----------------------------------------------------------------------------------------------
  class GameOver extends Panel {
    constructor() {
      super();
      this.t = 0;
      this.c = 0;
    }
    onOpen() {
      G.audio.playMusic('gameover', { fade: 0.5 });
    }
    update() {
      this.t++;
      if (this.t < 90) return;
      if (I.pressed.up || I.pressed.down) {
        this.c = 1 - this.c;
        G.audio.sfx('menu_move');
      }
      if (I.pressed.confirm) {
        G.audio.sfx('menu_select');
        UI.closeAll();
        if (this.c === 0) G.loadLast();
        else G.toTitle();
      }
    }
    draw() {
      const m = gfx.mctx;
      m.fillStyle = 'rgba(30,0,4,' + Math.min(0.85, this.t / 90) + ')';
      m.fillRect(0, 0, W, H);
      const a = Math.min(1, this.t / 60);
      txt(G.t('game_over'), W / 2, 92, { size: 18, font: 'title', weight: 700, align: 'center', alpha: a, gradient: ['#ff9090', '#800010'], stroke: 'rgba(0,0,0,0.7)' });
      if (this.t >= 90)
        [G.t('load_last'), G.t('to_title')].forEach((o, i) => {
          const y = 130 + i * 16;
          if (i === this.c) selBar(W / 2 - 70, y - 10, 140, 14);
          txt(o, W / 2, y, { size: 8.5, font: 'title', align: 'center', color: i === this.c ? '#fff' : COL.dim });
        });
    }
  }
  UI.gameOver = function () {
    UI.push(new GameOver());
  };

  UI.drawPanels = function () {
    for (const p of UI.stack) p.draw();
  };
})();
