/* Elegy of the Night — save.js
 * Three save files. Backends, in order of preference:
 *   cloud  — the claude.ai artifact store (db capability, private per player)
 *   local  — this browser's localStorage
 *   none   — storage blocked: progress lives in memory, export/import a .json
 * Every write is mirrored to localStorage when it is available.
 * Settings (volumes, language…) are a per-browser convenience in localStorage.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});

  const KEY = 'elegy_night_slot';
  const SKEY = 'elegy_night_settings';
  const mem = {};

  const S = (G.save = { backend: 'none', db: null, uid: null, lastSlot: 1, ready: false });

  function localOK() {
    try {
      const k = '__elegy_test';
      root.localStorage.setItem(k, '1');
      root.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  S.init = function () {
    S.backend = localOK() ? 'local' : 'none';
    const claude = root.claude;
    if (!claude || typeof claude.use !== 'function') {
      S.ready = true;
      return Promise.resolve(S.backend);
    }
    const timeout = new Promise((res) => setTimeout(() => res(null), 6000));
    return Promise.race([Promise.all([claude.use('db'), claude.use('user')]), timeout])
      .then(async (r) => {
        if (!r) return S.backend;
        const [db, user] = r;
        if (!db || !user) return S.backend;
        const uid = await user.id();
        if (!uid) return S.backend;
        S.db = db;
        S.uid = uid;
        S.backend = 'cloud';
        return S.backend;
      })
      .catch(() => S.backend)
      .then((b) => {
        S.ready = true;
        G.emit('saveBackend', b);
        return b;
      });
  };

  function docRef(slot) {
    return S.db.collection('data/users/' + S.uid).doc('slot' + slot);
  }

  S.meta = function (st) {
    const room = G.world.rooms[st.room];
    const area = room && G.world.areas[room.area];
    let hpMax = st.base.hp;
    try {
      hpMax = G.calcStats(st).hpMax;
    } catch (e) {}
    const d = new Date();
    return {
      level: st.level,
      areaName: area ? area.name : { en: '?', es: '?' },
      time: st.time,
      pct: G.mapCompletion(st, 'castle') + G.mapCompletion(st, 'archives'),
      hp: st.hp,
      hpMax,
      gold: st.gold,
      date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
      savedAt: Date.now(),
    };
  };

  S.write = async function (slot, st) {
    const data = JSON.parse(JSON.stringify(st));
    const rec = { v: 1, meta: S.meta(st), data };
    S.lastSlot = slot;
    G.store.set('elegy_night_last', slot);
    let ok = false;
    if (S.backend === 'cloud' && S.db) {
      try {
        await docRef(slot).set(rec);
        ok = true;
      } catch (e) {
        if (e && (e.code === 'invalid_argument' || e.code === 'not_granted' || e.code === 'revoked')) {
          // this viewer cannot write: fall back to the browser
          S.backend = localOK() ? 'local' : 'none';
        }
      }
    }
    if (G.store.set(KEY + slot, rec)) ok = true;
    mem[slot] = rec;
    return ok || S.backend === 'none';
  };

  S.readRec = async function (slot) {
    let cloud = null, local = null;
    if (S.backend === 'cloud' && S.db) {
      try {
        const snap = await docRef(slot).get();
        if (snap.exists) cloud = snap.data();
      } catch (e) {}
    }
    local = G.store.get(KEY + slot) || mem[slot] || null;
    if (cloud && local) return (cloud.meta && cloud.meta.savedAt) >= (local.meta && local.meta.savedAt) ? cloud : local;
    return cloud || local;
  };

  S.read = async function (slot) {
    const rec = await S.readRec(slot);
    if (!rec || !rec.data) return null;
    S.lastSlot = slot;
    return S.migrate(JSON.parse(JSON.stringify(rec.data)));
  };

  S.listMeta = async function () {
    const out = [];
    for (let i = 1; i <= 3; i++) {
      const r = await S.readRec(i);
      out.push(r ? r.meta : null);
    }
    return out;
  };

  S.remove = async function (slot) {
    if (S.backend === 'cloud' && S.db) {
      try {
        await docRef(slot).delete();
      } catch (e) {}
    }
    G.store.del(KEY + slot);
    delete mem[slot];
  };

  // fill fields that older saves may lack
  S.migrate = function (st) {
    const fresh = G.newState();
    for (const k in fresh) if (st[k] === undefined) st[k] = fresh[k];
    for (const k in fresh.base) if (st.base[k] === undefined) st.base[k] = fresh.base[k];
    for (const k in fresh.equip) if (st.equip[k] === undefined) st.equip[k] = null;
    st.visited = st.visited || { castle: {}, archives: {} };
    st.visited.castle = st.visited.castle || {};
    st.visited.archives = st.visited.archives || {};
    st.status = st.status || { poison: 0, curse: 0 };
    return st;
  };

  S.valid = function (st) {
    return st && typeof st === 'object' && st.base && st.equip && typeof st.level === 'number' && st.inv;
  };

  // ---- export / import -----------------------------------------------------------------------
  S.exportCurrent = async function () {
    const st = G.state;
    if (!st) return;
    const rec = { v: 1, game: 'elegy-of-the-night', meta: S.meta(st), data: st };
    const json = JSON.stringify(rec);
    const name = 'elegy-of-the-night-save-L' + st.level + '.json';
    let done = false;
    try {
      const dl = root.claude && root.claude.use ? await root.claude.use('downloads') : null;
      if (dl) {
        await dl.save({ filename: name, data: json });
        done = true;
      }
    } catch (e) {
      if (e && e.code === 'declined') return;
    }
    if (!done) {
      try {
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 1000);
        done = true;
      } catch (e) {}
    }
    if (done) G.ui.notify(G.t('export_save') + ' ✓', '#a0ffb0');
  };

  // Opens a file picker; cb(state|null)
  S.importFile = function (cb, slot) {
    if (typeof document === 'undefined') return cb(null);
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return cb(null);
      const r = new FileReader();
      r.onload = async () => {
        try {
          const obj = JSON.parse(r.result);
          const st = obj && obj.data ? obj.data : obj;
          if (!S.valid(st)) throw new Error('bad');
          const clean = S.migrate(st);
          await S.write(slot || 3, clean);
          G.ui.notify(G.t('import_save') + ' ✓ (' + G.t('slot') + ' ' + (slot || 3) + ')', '#a0ffb0');
          cb(clean);
        } catch (e) {
          G.ui.notify(G.tr({ en: 'That file is not an Elegy save.', es: 'Ese archivo no es una partida de Elegía.' }), '#ff8080');
          cb(null);
        }
      };
      r.readAsText(f);
    });
    inp.click();
  };

  // ---- settings ---------------------------------------------------------------------------------
  G.settings = { music: 0.7, sfx: 0.8, voice: 0.9, voices: true, shake: true, flashes: true, dmgNumbers: true, minimap: true, touch: 'auto', lang: null };
  S.loadSettings = function () {
    const st = G.store.get(SKEY);
    if (st) Object.assign(G.settings, st);
    if (G.settings.lang) G.lang = G.settings.lang;
    const ls = G.store.get('elegy_night_last');
    if (ls) S.lastSlot = ls;
  };
  G.applySettings = function () {
    const st = G.settings;
    if (G.audio) {
      G.audio.setVolume('music', st.music);
      G.audio.setVolume('sfx', st.sfx);
      G.audio.setVolume('voice', st.voice);
      if (G.audio.setVoiceEnabled) G.audio.setVoiceEnabled(st.voices);
    }
    G.store.set(SKEY, st);
    G.emit('settings');
  };
})();
