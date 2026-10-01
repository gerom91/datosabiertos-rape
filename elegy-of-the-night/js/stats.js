/* Elegy of the Night — stats.js
 * Persistent game state (what gets saved), levelling, derived stats from
 * equipment, inventory and equipment management.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util;

  G.SLOTS = ['rhand', 'lhand', 'head', 'body', 'cloak', 'acc1', 'acc2'];

  G.newState = function () {
    return {
      v: 1,
      room: 'ent_gate',
      px: null,
      py: null,
      saveRoom: null,
      level: 1,
      exp: 0,
      gold: 0,
      hp: 90,
      mp: 30,
      hearts: 20,
      base: { hp: 90, mp: 30, hearts: 50, str: 8, con: 7, int: 8, lck: 6 },
      equip: { rhand: null, lhand: null, head: null, body: null, cloak: null, acc1: null, acc2: null },
      inv: {},
      relics: {},
      sub: null,
      spells: {},
      flags: {},
      visited: { castle: {}, archives: {} },
      bestiary: {},
      kills: 0,
      time: 0,
      status: { poison: 0, curse: 0 },
      saves: 0,
      deaths: 0,
    };
  };

  // EXP needed to go from level L to L+1
  G.expFor = function (L) {
    return Math.floor(11 * Math.pow(L, 1.85) + 19 * L);
  };
  G.LEVEL_CAP = 99;

  // Level up gains (deterministic per level so they look designed)
  G.levelGains = function (L) {
    const r = U.RNG('lvl' + L);
    return { hp: 7 + r.int(0, 4), mp: 3 + r.int(0, 2), str: r.chance(0.7) ? 1 : 0, con: r.chance(0.6) ? 1 : 0, int: r.chance(0.6) ? 1 : 0, lck: r.chance(0.35) ? 1 : 0 };
  };

  G.item = (id) => G.ITEMS[id];

  // Derived stats
  G.calcStats = function (s, buffs) {
    const b = s.base;
    const st = {
      hpMax: b.hp, mpMax: b.mp, heartsMax: b.hearts,
      str: b.str, con: b.con, int: b.int, lck: b.lck,
      def: 0, res: {}, immune: {}, mpRegen: 0, hpOnHit: 0, flags: {},
    };
    for (const slot of G.SLOTS) {
      const id = s.equip[slot];
      if (!id) continue;
      const it = G.ITEMS[id];
      if (!it) continue;
      if (it.def) st.def += it.def;
      if (it.bonus)
        for (const k in it.bonus) {
          if (k === 'hp') st.hpMax += it.bonus[k];
          else if (k === 'mp') st.mpMax += it.bonus[k];
          else st[k] += it.bonus[k];
        }
      if (it.res) for (const k in it.res) st.res[k] = Math.max(st.res[k] || 0, it.res[k]);
      if (it.immune) it.immune.forEach((k) => (st.immune[k] = true));
      if (it.mpRegen) st.mpRegen += it.mpRegen;
      if (it.hpOnHit) st.hpOnHit += it.hpOnHit;
      ['heartsOnKill', 'subDiscount', 'watchDiscount', 'seeWalls', 'wolfBoost', 'rareBoost', 'showHp'].forEach((k) => {
        if (it[k]) st.flags[k] = it[k];
      });
    }
    st.def += st.con;
    // attack per hand
    const atkOf = (slot) => {
      const id = s.equip[slot];
      const it = id ? G.ITEMS[id] : null;
      if (!it || it.kind !== 'weapon') {
        if (it && it.kind === 'shield') return st.str + 1;
        return st.str + 2;
      }
      return it.wtype === 'tome' ? it.atk + st.int : it.atk + st.str;
    };
    st.atkR = atkOf('rhand');
    st.atkL = atkOf('lhand');
    if (buffs && buffs.atk) {
      st.atkR += buffs.atk;
      st.atkL += buffs.atk;
    }
    if (s.status && s.status.poison > 0) {
      st.atkR = Math.floor(st.atkR * 0.75);
      st.atkL = Math.floor(st.atkL * 0.75);
    }
    return st;
  };

  G.hasRelic = (s, id) => !!(s.relics && s.relics[id] !== undefined);
  G.relicOn = (s, id) => !!(s.relics && s.relics[id]);

  // ---- Inventory -----------------------------------------------------------------------
  G.invAdd = function (s, id, n) {
    s.inv[id] = (s.inv[id] || 0) + (n == null ? 1 : n);
    if (s.inv[id] > 99) s.inv[id] = 99;
  };
  G.invRemove = function (s, id, n) {
    if (!s.inv[id]) return false;
    s.inv[id] -= n == null ? 1 : n;
    if (s.inv[id] <= 0) delete s.inv[id];
    return true;
  };
  G.invCount = (s, id) => s.inv[id] || 0;

  // Equip from inventory into slot. Returns true on success.
  G.equipItem = function (s, slot, id) {
    const it = id ? G.ITEMS[id] : null;
    if (it && !G.slotAccepts(slot, it)) return false;
    const prev = s.equip[slot];
    if (id) {
      if (!G.invRemove(s, id, 1)) return false;
    }
    if (prev) G.invAdd(s, prev, 1);
    s.equip[slot] = id || null;
    // two-handed rules
    if (it && it.hands === 2) {
      const other = slot === 'rhand' ? 'lhand' : 'rhand';
      if (s.equip[other]) {
        G.invAdd(s, s.equip[other], 1);
        s.equip[other] = null;
      }
    } else if (it && (slot === 'rhand' || slot === 'lhand')) {
      const other = slot === 'rhand' ? 'lhand' : 'rhand';
      const o = s.equip[other] ? G.ITEMS[s.equip[other]] : null;
      if (o && o.hands === 2) {
        G.invAdd(s, s.equip[other], 1);
        s.equip[other] = null;
      }
    }
    return true;
  };
  G.slotAccepts = function (slot, it) {
    switch (slot) {
      case 'rhand':
      case 'lhand':
        return it.kind === 'weapon' || it.kind === 'shield';
      case 'head':
      case 'body':
      case 'cloak':
        return it.kind === slot;
      case 'acc1':
      case 'acc2':
        return it.kind === 'acc';
    }
    return false;
  };

  G.isEquippable = (it) => ['weapon', 'shield', 'head', 'body', 'cloak', 'acc'].includes(it.kind);

  // Grant EXP; returns number of levels gained
  G.gainExp = function (s, n) {
    if (s.level >= G.LEVEL_CAP) return 0;
    s.exp += n;
    let ups = 0;
    while (s.level < G.LEVEL_CAP && s.exp >= G.expFor(s.level)) {
      s.exp -= G.expFor(s.level);
      s.level++;
      ups++;
      const g = G.levelGains(s.level);
      s.base.hp += g.hp;
      s.base.mp += g.mp;
      s.base.str += g.str;
      s.base.con += g.con;
      s.base.int += g.int;
      s.base.lck += g.lck;
    }
    return ups;
  };

  G.mapCompletion = function (s, mapId) {
    const m = G.world.maps[mapId];
    if (!m || !m.total) return 0;
    const v = Object.keys(s.visited[mapId] || {}).length;
    return (v / m.total) * 100;
  };
})();
