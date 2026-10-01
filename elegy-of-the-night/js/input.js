/* Elegy of the Night — input.js
 * Keyboard + gamepad + touch → abstract actions, with per-frame pressed /
 * held / released states, menu auto-repeat and a directional history used to
 * recognise spell motions (e.g. ↓↘→ + attack).
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const hasDOM = typeof document !== 'undefined';

  const ACTIONS = [
    'left', 'right', 'up', 'down', 'jump', 'attack', 'attack2', 'backdash', 'sub',
    'bat', 'mist', 'wolf', 'menu', 'map', 'confirm', 'cancel', 'tabL', 'tabR',
  ];

  const DEFAULT_KEYS = {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    jump: ['KeyZ', 'Space'],
    attack: ['KeyX'],
    attack2: ['KeyC'],
    backdash: ['KeyA', 'ShiftLeft', 'ShiftRight'],
    sub: ['KeyS'],
    bat: ['KeyQ'],
    mist: ['KeyW'],
    wolf: ['KeyE'],
    menu: ['Enter', 'Escape'],
    map: ['Tab', 'KeyM'],
    confirm: ['KeyZ', 'Enter', 'Space'],
    cancel: ['KeyX', 'Escape', 'Backspace'],
    tabL: ['KeyQ', 'PageUp'],
    tabR: ['KeyE', 'PageDown'],
  };
  // standard gamepad mapping
  const PAD = {
    jump: [0], attack: [2], attack2: [1], backdash: [3], bat: [4], mist: [5], wolf: [6], sub: [7],
    map: [8], menu: [9], up: [12], down: [13], left: [14], right: [15],
    confirm: [0], cancel: [1], tabL: [4], tabR: [5],
  };

  const I = (G.input = {
    ACTIONS,
    held: {},
    pressed: {},
    released: {},
    kb: {},
    pad: {},
    touch: {},
    downEvents: {},
    repeatT: {},
    keys: JSON.parse(JSON.stringify(DEFAULT_KEYS)),
    DEFAULT_KEYS,
    lastDevice: 'kb',
    frame: 0,
    hist: [], // {d, f}
    lastDir: 0,
    anyKey: false,
    enabled: true,
  });
  ACTIONS.forEach((a) => {
    I.held[a] = I.pressed[a] = I.released[a] = false;
    I.kb[a] = I.pad[a] = I.touch[a] = false;
    I.downEvents[a] = 0;
    I.repeatT[a] = 0;
  });

  const codeToActions = {};
  function rebuildMap() {
    for (const k in codeToActions) delete codeToActions[k];
    for (const a of ACTIONS)
      for (const code of I.keys[a] || []) (codeToActions[code] = codeToActions[code] || []).push(a);
  }
  rebuildMap();
  I.setKeys = function (keys) {
    I.keys = Object.assign(JSON.parse(JSON.stringify(DEFAULT_KEYS)), keys || {});
    rebuildMap();
  };

  const kbDown = new Set();
  function onKey(e, down) {
    const acts = codeToActions[e.code];
    if (acts || e.code === 'Tab' || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    if (down && e.repeat) return;
    I.lastDevice = 'kb';
    if (down) {
      kbDown.add(e.code);
      I.anyKey = true;
    } else kbDown.delete(e.code);
    if (!acts) return;
    for (const a of acts) {
      // a key held under another binding keeps the action held
      let h = false;
      for (const c of I.keys[a]) if (kbDown.has(c)) h = true;
      I.kb[a] = h;
      if (down) I.downEvents[a]++;
    }
  }
  I.clearAll = function () {
    kbDown.clear();
    for (const a of ACTIONS) {
      I.kb[a] = I.pad[a] = I.touch[a] = false;
      I.downEvents[a] = 0;
    }
  };

  if (hasDOM) {
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));
    window.addEventListener('blur', () => {
      I.clearAll();
      G.emit('blur');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        I.clearAll();
        G.emit('blur');
      }
    });
  }

  // ---- Gamepad --------------------------------------------------------------
  const padPrev = {};
  function pollPad() {
    if (!hasDOM || !navigator.getGamepads) return;
    let pads;
    try {
      pads = navigator.getGamepads();
    } catch (e) {
      return;
    }
    const st = {};
    ACTIONS.forEach((a) => (st[a] = false));
    let any = false;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      for (const a in PAD)
        for (const b of PAD[a]) {
          const btn = p.buttons[b];
          if (btn && (btn.pressed || btn.value > 0.5)) {
            st[a] = true;
            any = true;
          }
        }
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (ax < -0.45) st.left = true;
      if (ax > 0.45) st.right = true;
      if (ay < -0.5) st.up = true;
      if (ay > 0.5) st.down = true;
      if (Math.abs(ax) > 0.45 || Math.abs(ay) > 0.5) any = true;
    }
    for (const a of ACTIONS) {
      if (st[a] && !padPrev[a]) {
        I.downEvents[a]++;
        I.anyKey = true;
      }
      padPrev[a] = st[a];
      I.pad[a] = st[a];
    }
    if (any) I.lastDevice = 'pad';
  }

  // ---- Touch ----------------------------------------------------------------
  // Buttons are DOM elements with data-act="action"; the d-pad is data-dpad.
  I.bindTouch = function (container) {
    if (!container) return;
    const ptrs = new Map(); // pointerId -> {acts:Set}
    function recompute() {
      const st = {};
      for (const p of ptrs.values()) for (const a of p.acts) st[a] = true;
      for (const a of ACTIONS) {
        const v = !!st[a];
        if (v && !I.touch[a]) {
          I.downEvents[a]++;
          I.anyKey = true;
        }
        I.touch[a] = v;
      }
    }
    function actsFor(el, x, y) {
      const acts = new Set();
      if (!el) return acts;
      const dp = el.closest('[data-dpad]');
      if (dp) {
        const r = dp.getBoundingClientRect();
        const dx = (x - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (y - (r.top + r.height / 2)) / (r.height / 2);
        if (Math.hypot(dx, dy) > 0.22) {
          const ang = Math.atan2(dy, dx);
          const oct = Math.round(ang / (Math.PI / 4));
          const map = { 0: ['right'], 1: ['right', 'down'], 2: ['down'], 3: ['down', 'left'], 4: ['left'], '-4': ['left'], '-3': ['left', 'up'], '-2': ['up'], '-1': ['up', 'right'] };
          (map[oct] || []).forEach((a) => acts.add(a));
        }
        return acts;
      }
      const b = el.closest('[data-act]');
      if (b) b.dataset.act.split(' ').forEach((a) => acts.add(a));
      return acts;
    }
    function down(e) {
      I.lastDevice = 'touch';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const dp = el && el.closest('[data-dpad]');
      ptrs.set(e.pointerId, { acts: actsFor(el, e.clientX, e.clientY), dpad: dp });
      if (e.target.setPointerCapture) {
        try {
          e.target.setPointerCapture(e.pointerId);
        } catch (er) {}
      }
      recompute();
      e.preventDefault();
    }
    function move(e) {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      if (p.dpad) p.acts = actsFor(p.dpad, e.clientX, e.clientY);
      else {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        p.acts = actsFor(el, e.clientX, e.clientY);
      }
      recompute();
      e.preventDefault();
    }
    function up(e) {
      ptrs.delete(e.pointerId);
      recompute();
    }
    container.addEventListener('pointerdown', down, { passive: false });
    container.addEventListener('pointermove', move, { passive: false });
    container.addEventListener('pointerup', up);
    container.addEventListener('pointercancel', up);
    container.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  // ---- Per-frame update ----------------------------------------------------
  const DIRS = { '0,0': 0, '1,0': 'r', '-1,0': 'l', '0,-1': 'u', '0,1': 'd', '1,-1': 'ur', '-1,-1': 'ul', '1,1': 'dr', '-1,1': 'dl' };
  I.update = function () {
    pollPad();
    I.frame++;
    for (const a of ACTIONS) {
      const raw = I.enabled && (I.kb[a] || I.pad[a] || I.touch[a]);
      const ev = I.enabled ? I.downEvents[a] : 0;
      const was = I.held[a];
      // any key-down since last frame counts as a press (also sub-frame taps)
      I.pressed[a] = (raw && !was) || ev > 0;
      I.released[a] = was && !raw;
      I.held[a] = !!raw || ev > 0;
      I.downEvents[a] = 0;
    }
    // directional history
    const dx = (I.held.right ? 1 : 0) - (I.held.left ? 1 : 0);
    const dy = (I.held.down ? 1 : 0) - (I.held.up ? 1 : 0);
    const d = DIRS[dx + ',' + dy];
    if (d !== I.lastDir) {
      if (d) {
        I.hist.push({ d, f: I.frame });
        if (I.hist.length > 24) I.hist.shift();
      }
      I.lastDir = d;
    }
  };

  // Menu-style auto repeat
  I.repeat = function (a, delay, rate) {
    if (I.pressed[a]) {
      I.repeatT[a] = 0;
      return true;
    }
    if (!I.held[a]) return false;
    I.repeatT[a]++;
    const d = delay || 18, r = rate || 5;
    return I.repeatT[a] > d && (I.repeatT[a] - d) % r === 0;
  };
  I.consume = function (a) {
    I.pressed[a] = false;
  };
  I.consumeAll = function () {
    for (const a of ACTIONS) I.pressed[a] = false;
  };
  I.anyPressed = function () {
    for (const a of ACTIONS) if (I.pressed[a]) return true;
    return false;
  };

  /* Motion matching. seq uses facing-relative codes:
   * f, b, u, d, uf, ub, df, db (forward = facing direction).
   * Returns true if the recent directional history ends with seq (allowing a
   * couple of stray diagonals produced by keyboard overlap) within maxFrames. */
  I.matchMotion = function (seq, facing, maxFrames) {
    const toAbs = (c) => {
      const f = facing >= 0 ? 'r' : 'l', b = facing >= 0 ? 'l' : 'r';
      return c.replace('uf', 'u' + f).replace('ub', 'u' + b).replace('df', 'd' + f).replace('db', 'd' + b).replace(/^f$/, f).replace(/^b$/, b);
    };
    const want = seq.map(toAbs);
    const H = I.hist;
    if (!H.length) return false;
    const last = H[H.length - 1];
    if (I.frame - last.f > 16) return false;
    let wi = want.length - 1, skips = 0;
    let firstFrame = last.f;
    for (let i = H.length - 1; i >= 0 && wi >= 0; i--) {
      if (H[i].d === want[wi]) {
        firstFrame = H[i].f;
        wi--;
      } else if (++skips > 3) return false;
    }
    return wi < 0 && I.frame - firstFrame <= (maxFrames || 50);
  };
  I.clearMotion = function () {
    I.hist.length = 0;
  };

  // Display names for prompts
  I.keyName = function (a) {
    const k = (I.keys[a] || [])[0] || '';
    return k.replace('Key', '').replace('Arrow', '').replace('Digit', '').replace('Left', '').replace('Right', '') || k;
  };
})();
