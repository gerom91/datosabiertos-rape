/* Elegy of the Night — story.js
 * Dialogue engine (typed text, English voices via TTS, portraits), story
 * scenes, NPC art, lore pages and the Librarian's hints.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, I = G.input, gfx = G.gfx;

  const SPEAKERS = {
    alucard: { name: 'Alucard', col: '#d8e0ff' },
    maria: { name: 'Maria', col: '#ffd0e0' },
    richter: { name: 'Richter', col: '#b8d0ff' },
    librarian: { name: { en: 'Librarian', es: 'Bibliotecario' }, col: '#ffe0a0' },
    scrivener: { name: { en: 'The Scrivener', es: 'El Escriba' }, col: '#d0a8ff' },
    echo: { name: { en: 'Echo of the Belmont', es: 'Eco del Belmont' }, col: '#a8e8ff' },
    narrator: { name: '', col: '#e8e0d0' },
  };

  // ---- portraits (48x56 pixel art) ------------------------------------------------------------
  G.portrait = function (id) {
    const P = PORTRAITS[id];
    if (!P) return null;
    return gfx.sprite('portrait_' + id, 48, 56, (c) => P.draw(c), { palette: P.pal, outline: '#07050b', threshold: 100 });
  };
  function poly(c, col, pts) {
    gfx.poly(c, pts, col);
  }
  const PORTRAITS = {
    alucard: {
      pal: ['#eef2f8', '#b4bed2', '#7e88a2', '#f4e2d6', '#cfae9e', '#a8887a', '#e8c050', '#2a2030', '#1c1e30', '#3a4064', '#9a1426', '#ecebf4', '#16121c'],
      draw(c) {
        // hair mass behind
        poly(c, '#b4bed2', [8, 18, 14, 6, 26, 2, 38, 6, 42, 18, 44, 40, 40, 54, 8, 54, 4, 40]);
        poly(c, '#7e88a2', [6, 34, 10, 22, 12, 54, 4, 54]);
        // collar / coat
        poly(c, '#16121c', [2, 56, 6, 42, 14, 38, 34, 38, 44, 44, 46, 56]);
        poly(c, '#9a1426', [10, 56, 14, 42, 18, 46, 18, 56]);
        poly(c, '#1c1e30', [16, 56, 18, 44, 32, 44, 36, 56]);
        poly(c, '#ecebf4', [22, 40, 30, 40, 28, 52, 26, 54, 24, 52]);
        poly(c, '#3a4064', [32, 46, 36, 44, 38, 56, 34, 56]);
        // neck & face
        poly(c, '#cfae9e', [20, 30, 30, 30, 30, 41, 20, 41]);
        poly(c, '#f4e2d6', [15, 14, 33, 12, 35, 22, 33, 31, 27, 37, 22, 36, 17, 30, 14, 22]);
        poly(c, '#cfae9e', [27, 37, 33, 31, 34, 27, 30, 33]);
        // eyes
        poly(c, '#2a2030', [18, 21, 23, 20, 23, 22, 18, 22.5]);
        poly(c, '#2a2030', [27, 20, 32, 20, 32, 22, 27, 22]);
        c.fillStyle = '#e8c050';
        c.fillRect(20, 21, 2, 1.5);
        c.fillRect(29, 21, 2, 1.5);
        // nose & mouth
        c.fillStyle = '#a8887a';
        c.fillRect(25, 23, 1, 5);
        c.fillRect(23, 31, 5, 1);
        // fringe
        poly(c, '#eef2f8', [12, 18, 14, 6, 26, 3, 37, 6, 38, 16, 33, 11, 30, 16, 26, 10, 22, 17, 18, 11, 15, 20]);
        poly(c, '#eef2f8', [12, 16, 16, 18, 14, 34, 10, 40]);
        poly(c, '#eef2f8', [36, 12, 39, 18, 40, 36, 36, 28]);
        c.fillStyle = '#b4bed2';
        c.fillRect(20, 7, 1, 7);
        c.fillRect(30, 7, 1, 6);
      },
    },
    maria: {
      pal: ['#e8c878', '#b8904a', '#f6e2d2', '#d6b0a0', '#4a7ad8', '#2a2030', '#e86a9a', '#f0f0f8', '#4a6ac8', '#2a3a7a', '#f0a0a0'],
      draw(c) {
        poly(c, '#b8904a', [8, 20, 14, 6, 34, 4, 42, 14, 42, 44, 36, 50, 12, 50, 6, 40]);
        poly(c, '#4a6ac8', [4, 56, 8, 44, 18, 40, 30, 40, 40, 44, 44, 56]);
        poly(c, '#f0f0f8', [16, 42, 24, 46, 32, 42, 30, 50, 24, 52, 18, 50]);
        poly(c, '#d6b0a0', [20, 32, 28, 32, 28, 42, 20, 42]);
        poly(c, '#f6e2d2', [14, 16, 34, 14, 35, 24, 32, 32, 26, 37, 22, 37, 16, 32, 13, 24]);
        c.fillStyle = '#2a2030';
        c.fillRect(17, 22, 5, 1);
        c.fillRect(27, 22, 5, 1);
        c.fillStyle = '#4a7ad8';
        c.fillRect(18, 23, 3, 3);
        c.fillRect(28, 23, 3, 3);
        c.fillStyle = '#f0a0a0';
        c.fillRect(16, 28, 3, 1);
        c.fillRect(30, 28, 3, 1);
        c.fillStyle = '#d6b0a0';
        c.fillRect(22, 32, 5, 1);
        poly(c, '#e8c878', [12, 20, 15, 7, 30, 5, 38, 10, 37, 20, 32, 13, 27, 18, 23, 12, 18, 19]);
        poly(c, '#e8c878', [10, 18, 14, 22, 12, 40, 8, 36]);
        poly(c, '#e86a9a', [30, 6, 40, 2, 42, 10, 36, 10]);
        poly(c, '#e86a9a', [36, 8, 44, 12, 40, 16]);
      },
    },
    richter: {
      pal: ['#6a4022', '#3e2412', '#f2d8c4', '#cfa890', '#3a5a8a', '#2a2030', '#f0f0f0', '#2a3a7a', '#1a2450', '#a8784a'],
      draw(c) {
        poly(c, '#3e2412', [8, 22, 12, 8, 30, 4, 40, 12, 40, 34, 34, 30, 12, 34]);
        poly(c, '#2a3a7a', [2, 56, 6, 44, 16, 40, 32, 40, 42, 44, 46, 56]);
        poly(c, '#1a2450', [18, 42, 24, 50, 30, 42, 30, 56, 18, 56]);
        poly(c, '#cfa890', [19, 32, 29, 32, 29, 42, 19, 42]);
        poly(c, '#f2d8c4', [13, 16, 35, 14, 36, 24, 33, 33, 27, 38, 21, 38, 15, 32, 12, 24]);
        c.fillStyle = '#2a2030';
        c.fillRect(17, 22, 5, 1.5);
        c.fillRect(27, 22, 5, 1.5);
        c.fillStyle = '#3a5a8a';
        c.fillRect(19, 23, 2, 2);
        c.fillRect(29, 23, 2, 2);
        c.fillStyle = '#cfa890';
        c.fillRect(24, 24, 1, 5);
        c.fillRect(21, 32, 6, 1);
        poly(c, '#6a4022', [11, 18, 14, 6, 30, 3, 39, 10, 38, 18, 33, 12, 28, 16, 24, 10, 19, 16, 15, 12]);
        poly(c, '#f0f0f0', [11, 15, 38, 12, 38, 15, 11, 18]);
        poly(c, '#f0f0f0', [38, 12, 46, 18, 42, 20, 38, 15]);
      },
    },
    librarian: {
      pal: ['#e8e8e8', '#b8b8c0', '#e8c8b0', '#c09a80', '#8a6a5a', '#2a2030', '#d4ac52', '#7a1a20', '#4a0a10', '#f0f0f0'],
      draw(c) {
        poly(c, '#7a1a20', [2, 56, 6, 42, 16, 38, 32, 38, 42, 42, 46, 56]);
        poly(c, '#d4ac52', [16, 40, 20, 56, 18, 56, 14, 42]);
        poly(c, '#d4ac52', [32, 40, 28, 56, 30, 56, 34, 42]);
        poly(c, '#e8c8b0', [14, 12, 34, 12, 36, 24, 32, 34, 16, 34, 12, 24]);
        poly(c, '#c09a80', [14, 14, 18, 12, 16, 20]);
        // beard
        poly(c, '#e8e8e8', [14, 28, 18, 30, 24, 32, 30, 30, 34, 28, 33, 40, 28, 48, 24, 50, 20, 48, 15, 40]);
        poly(c, '#b8b8c0', [20, 40, 24, 44, 28, 40, 26, 48, 22, 48]);
        // side hair
        poly(c, '#e8e8e8', [10, 16, 14, 14, 14, 28, 10, 26]);
        poly(c, '#e8e8e8', [34, 14, 38, 16, 38, 26, 34, 28]);
        // spectacles
        c.strokeStyle = '#d4ac52';
        c.lineWidth = 1;
        c.strokeRect(16.5, 20.5, 6, 4);
        c.strokeRect(25.5, 20.5, 6, 4);
        c.fillStyle = '#2a2030';
        c.fillRect(18, 22, 3, 1.5);
        c.fillRect(27, 22, 3, 1.5);
        c.fillStyle = '#8a6a5a';
        c.fillRect(23, 24, 2, 4);
        c.fillRect(17, 16, 5, 1);
        c.fillRect(26, 16, 5, 1);
      },
    },
    scrivener: {
      pal: ['#1a1020', '#2e2040', '#4a3a66', '#c8c0cc', '#8a8296', '#3a2a5a', '#c890ff', '#f0e0ff', '#120a18', '#e8dcc0'],
      draw(c) {
        poly(c, '#1a1020', [4, 56, 6, 30, 12, 10, 24, 2, 36, 10, 42, 30, 44, 56]);
        poly(c, '#2e2040', [10, 56, 12, 32, 16, 16, 24, 8, 32, 16, 36, 32, 38, 56]);
        poly(c, '#120a18', [15, 20, 33, 20, 33, 40, 15, 40]);
        poly(c, '#c8c0cc', [17, 22, 31, 22, 31, 34, 27, 40, 21, 40, 17, 34]);
        poly(c, '#8a8296', [17, 22, 21, 22, 19, 38, 17, 34]);
        // ink tears
        c.fillStyle = '#3a2a5a';
        c.fillRect(19, 28, 2, 10);
        c.fillRect(28, 28, 2, 8);
        c.fillStyle = '#c890ff';
        c.fillRect(18, 26, 4, 2);
        c.fillRect(27, 26, 4, 2);
        c.fillStyle = '#f0e0ff';
        c.fillRect(19, 26, 1, 1);
        c.fillRect(28, 26, 1, 1);
        // quill
        poly(c, '#e8dcc0', [36, 54, 44, 20, 46, 22, 38, 54]);
        poly(c, '#4a3a66', [44, 20, 47, 14, 46, 22]);
      },
    },
    echo: {
      pal: ['#a8e8ff', '#5a90c8', '#2a4a7a', '#e0f8ff', '#ffffff', '#16304a'],
      draw(c) {
        poly(c, '#2a4a7a', [8, 22, 12, 8, 30, 4, 40, 12, 40, 34, 12, 34]);
        poly(c, '#5a90c8', [2, 56, 6, 44, 16, 40, 32, 40, 42, 44, 46, 56]);
        poly(c, '#16304a', [18, 42, 24, 50, 30, 42, 30, 56, 18, 56]);
        poly(c, '#a8e8ff', [13, 16, 35, 14, 36, 24, 33, 33, 27, 38, 21, 38, 15, 32, 12, 24]);
        c.fillStyle = '#ffffff';
        c.fillRect(17, 22, 5, 2);
        c.fillRect(27, 22, 5, 2);
        c.fillStyle = '#5a90c8';
        c.fillRect(24, 24, 1, 5);
        c.fillRect(21, 32, 6, 1);
        poly(c, '#5a90c8', [11, 18, 14, 6, 30, 3, 39, 10, 38, 18, 33, 12, 28, 16, 24, 10, 19, 16, 15, 12]);
        poly(c, '#e0f8ff', [11, 15, 38, 12, 38, 15, 11, 18]);
      },
    },
  };

  // ---- in-world NPC art ---------------------------------------------------------------------------------
  function personSprite(key, w, h, pal, fn) {
    return gfx.sprite(key, w, h, fn, { palette: pal, outline: '#07050b', threshold: 100 });
  }
  G.NPC_ART = {
    maria(ctx, x, y, t, facing) {
      const f = Math.floor(t / 20) % 2;
      const img = personSprite('npc_maria' + f, 32, 44, ['#e8c878', '#b8904a', '#f6e2d2', '#4a6ac8', '#2a3a7a', '#f0f0f8', '#e86a9a', '#2a2030', '#7a5a3a'], (c) => {
        c.translate(16, 43);
        poly(c, '#4a6ac8', [-7, 0, -5, -18, 5, -18, 8, 0]);
        poly(c, '#2a3a7a', [-2, 0, -1, -16, 2, -16, 3, 0]);
        poly(c, '#f0f0f8', [-5, -18, 5, -18, 4, -28, -4, -28]);
        gfx.limb(c, -4, -26, -6, -16 + f, 2.2, '#f6e2d2');
        gfx.limb(c, 4, -26, 6, -16, 2.2, '#f6e2d2');
        gfx.circle(c, 0, -32, 4.4, '#f6e2d2');
        poly(c, '#e8c878', [-5, -34, 0, -38, 5, -34, 6, -24, 4, -30, -4, -30, -6, -24]);
        poly(c, '#e86a9a', [2, -37, 7, -39, 6, -34]);
        c.fillStyle = '#2a2030';
        c.fillRect(1, -32, 1, 1);
        c.fillStyle = '#7a5a3a';
        c.fillRect(-4, -1, 3, 1);
        c.fillRect(2, -1, 3, 1);
      });
      gfx.drawAnchored(img, x, y, 16, 43, facing < 0, null, ctx);
    },
    richter(ctx, x, y, t, facing) {
      const bound = !G.state.flags.richter_free;
      const img = personSprite('npc_richter' + (bound ? 'b' : ''), 32, 46, ['#6a4022', '#3e2412', '#f2d8c4', '#2a3a7a', '#1a2450', '#f0f0f0', '#5a3a1a', '#3a2a5a', '#8a6ae0'], (c) => {
        c.translate(16, 45);
        gfx.limb(c, -2, -20, -3, 0, 3.2, '#1a2450');
        gfx.limb(c, 2, -20, 3, 0, 3.2, '#1a2450');
        poly(c, '#2a3a7a', [-6, -20, 6, -20, 5, -32, -5, -32]);
        gfx.limb(c, -5, -30, -7, -20, 2.6, '#2a3a7a');
        gfx.limb(c, 5, -30, 7, -21, 2.6, '#2a3a7a');
        gfx.circle(c, 0, -36, 4.6, '#f2d8c4');
        poly(c, '#6a4022', [-5, -37, 0, -42, 5, -38, 5, -35, 2, -38, -2, -37, -5, -33]);
        c.fillStyle = '#f0f0f0';
        c.fillRect(-5, -39, 10, 1.4);
        c.fillStyle = '#5a3a1a';
        c.fillRect(-6, -21, 12, 2);
        if (bound) {
          c.fillStyle = '#3a2a5a';
          for (let i = 0; i < 4; i++) c.fillRect(-8, -30 + i * 6, 16, 2);
          c.fillStyle = '#8a6ae0';
          c.fillRect(-8, -27, 16, 1);
        }
      });
      gfx.drawAnchored(img, x, y, 16, 45, facing < 0, null, ctx);
      if (bound) gfx.addLight(x, y - 24, 40, '#8a6ae0', 0.5);
    },
    librarian(ctx, x, y, t, facing) {
      const bob = Math.floor(t / 30) % 2;
      const img = personSprite('npc_librarian' + bob, 64, 48, ['#e8e8e8', '#e8c8b0', '#7a1a20', '#d4ac52', '#4a2418', '#7a4028', '#efe6d0', '#2a2030', '#3a6a3a'], (c) => {
        // desk with books
        c.fillStyle = '#4a2418';
        c.fillRect(8, 28, 50, 20);
        c.fillStyle = '#7a4028';
        c.fillRect(6, 26, 54, 4);
        c.fillStyle = '#efe6d0';
        c.fillRect(30, 22, 12, 4);
        c.fillStyle = '#3a6a3a';
        c.fillRect(46, 16, 4, 10);
        c.fillStyle = '#7a1a20';
        c.fillRect(50, 18, 4, 8);
        // the old man behind the desk
        poly(c, '#7a1a20', [12, 28, 14, 16, 26, 14, 30, 28]);
        gfx.circle(c, 20, 10 + bob, 5, '#e8c8b0');
        poly(c, '#e8e8e8', [15, 11 + bob, 20, 14 + bob, 25, 11 + bob, 23, 20 + bob, 20, 22 + bob, 17, 20 + bob]);
        c.fillStyle = '#d4ac52';
        c.fillRect(16, 8 + bob, 3, 2);
        c.fillRect(21, 8 + bob, 3, 2);
        gfx.limb(c, 26, 20, 32, 24, 2.4, '#7a1a20');
      });
      gfx.drawAnchored(img, x, y, 32, 48, false, null, ctx);
      gfx.addLight(x + 6, y - 26, 50, '#ffd080', 0.6);
    },
    scrivener(ctx, x, y, t, facing) {
      const bob = Math.sin(t * 0.05) * 3;
      const img = personSprite('npc_scrivener', 40, 60, ['#1a1020', '#2e2040', '#c8c0cc', '#c890ff', '#e8dcc0', '#3a2a5a'], (c) => {
        c.translate(20, 58);
        poly(c, '#1a1020', [-12, 0, -9, -30, -6, -46, 0, -52, 6, -46, 9, -30, 12, 0, 6, -4, 0, 0, -6, -4]);
        poly(c, '#2e2040', [-6, -10, -4, -40, 0, -46, 4, -40, 6, -10]);
        gfx.ellipse(c, 1, -40, 3.4, 4, 0, '#c8c0cc');
        c.fillStyle = '#c890ff';
        c.fillRect(1, -41, 2, 1);
        c.fillStyle = '#3a2a5a';
        c.fillRect(1, -40, 1, 4);
        gfx.limb(c, 6, -34, 14, -30, 2.6, '#1a1020');
        gfx.limb(c, 14, -30, 18, -40, 1.4, '#e8dcc0');
      });
      gfx.drawAnchored(img, x, y + bob, 20, 58, facing < 0, null, ctx);
      gfx.addLight(x, y - 30, 60, '#a070ff', 0.7);
      if (t % 6 === 0) G.fx.particle(G.game.camx + x + U.rnd(-8, 8), G.game.camy + y + bob - 4, 0, 0.4, '#1a1028', 40, { size: 2 });
    },
  };

  // ---- actors spawned by scenes ----------------------------------------------------------------------
  class Actor extends G.Ent {
    constructor(id, x, y, facing) {
      super({ x: x - 8, y: y - 40, w: 16, h: 40, z: 1 });
      this.actor = id;
      this.facing = facing || -1;
      this.alpha = 0;
      this.fadeTo = 1;
    }
    update(g) {
      this.t++;
      this.alpha = U.approach(this.alpha, this.fadeTo, 0.04);
      if (this.fadeTo === 0 && this.alpha === 0) this.dead = true;
    }
    draw(ctx, camx, camy) {
      const fn = G.NPC_ART[this.actor];
      if (!fn) return;
      ctx.globalAlpha = this.alpha;
      fn(ctx, Math.round(this.cx - camx), Math.round(this.fy - camy), this.t, this.facing);
      ctx.globalAlpha = 1;
    }
  }

  // ---- dialogue engine ---------------------------------------------------------------------------------
  const ST = (G.story = { active: false, steps: [], i: 0, line: null, typed: 0, wait: 0, t: 0, actors: {}, opts: {} });

  ST.play = function (id, opts) {
    const sc = G.SCENES[id];
    if (!sc) return;
    if (ST.active) return;
    ST.active = true;
    ST.id = id;
    ST.steps = typeof sc === 'function' ? sc() : sc;
    ST.i = -1;
    ST.opts = opts || {};
    ST.line = null;
    ST.narr = false;
    ST.actors = {};
    G.state.flags['scene_' + id] = 1;
    const pl = G.game.player;
    if (pl) {
      pl.locked = true;
      pl.atk = null;
      if (pl.form !== 'human') pl.setForm('human', true);
    }
    G.audio.duck(true);
    ST.next();
  };

  ST.end = function () {
    ST.active = false;
    ST.line = null;
    G.audio.stopSpeech();
    G.audio.duck(false);
    const pl = G.game.player;
    if (pl) pl.locked = false;
    I.consumeAll();
    const after = ST.opts.after;
    ST.opts = {};
    if (after) after();
  };

  ST.next = function () {
    ST.i++;
    G.audio.stopSpeech();
    ST.line = null;
    while (ST.i < ST.steps.length) {
      const s = ST.steps[ST.i];
      const g = G.game;
      if (s.who || s.narr) {
        ST.line = s;
        ST.typed = 0;
        ST.t = 0;
        ST.narr = !!s.narr;
        ST.spoken = false;
        const sp = s.narr ? 'narrator' : s.who;
        if (G.settings.voices) {
          ST.speaking = true;
          G.audio.say(s.en, { speaker: sp, onend: () => (ST.speaking = false) });
        } else ST.speaking = false;
        return;
      }
      if (s.wait) {
        ST.wait = s.wait;
        return;
      }
      if (s.do) s.do(g);
      if (s.music) G.audio.playMusic(s.music, { fade: s.fade || 1 });
      if (s.stopMusic) G.audio.stopMusic(s.stopMusic);
      if (s.sfx) G.audio.sfx(s.sfx);
      if (s.shake) gfx.shake(s.shake[0], s.shake[1]);
      if (s.flash) gfx.flash(s.flash, 10);
      if (s.flag) G.state.flags[s.flag] = 1;
      if (s.give) {
        G.invAdd(G.state, s.give, 1);
        G.ui.notify(G.tr(G.ITEMS[s.give].name), '#f0e6c8', G.ITEMS[s.give]);
      }
      if (s.relic) {
        G.state.relics[s.relic] = true;
        G.audio.sfx('relic_get');
        const r = G.RELICS[s.relic];
        G.ui.banner(G.tr(r.name), G.tr(r.desc), r.col, 260);
      }
      if (s.actor) {
        const a = s.actor;
        if (a.remove) {
          const ac = ST.actors[a.id];
          if (ac) ac.fadeTo = 0;
        } else {
          const ac = new Actor(a.id, a.x, a.y, a.facing);
          ST.actors[a.id] = ac;
          g.add(ac);
        }
      }
      if (s.face) G.game.player.facing = s.face;
      ST.i++;
    }
    ST.end();
  };

  ST.update = function () {
    if (!ST.active) return;
    if (G.ui.modal()) return;
    if (ST.wait > 0) {
      ST.wait--;
      if (ST.wait === 0) ST.next();
      return;
    }
    if (!ST.line) return;
    ST.t++;
    const text = G.tr(ST.line);
    if (ST.typed < text.length) {
      ST.typed = Math.min(text.length, ST.typed + (ST.narr ? 0.9 : 1.4));
      if (!G.settings.voices && Math.floor(ST.typed) % 3 === 0) G.audio.sfx('text_blip', { vol: 0.25 });
    }
    if (I.pressed.menu && ST.opts.skippable !== false && G.SCENES_SKIPPABLE) {
      // skip the whole scene
      while (ST.i < ST.steps.length - 1) {
        ST.i++;
        const s = ST.steps[ST.i];
        if (s.do) s.do(G.game);
        if (s.flag) G.state.flags[s.flag] = 1;
        if (s.give) G.invAdd(G.state, s.give, 1);
        if (s.relic) G.state.relics[s.relic] = true;
        if (s.music) G.audio.playMusic(s.music);
      }
      ST.end();
      return;
    }
    if (I.pressed.confirm || I.pressed.attack) {
      if (ST.typed < text.length) ST.typed = text.length;
      else {
        G.audio.sfx('menu_move', { vol: 0.4 });
        ST.next();
      }
    }
    // auto-advance narration after the voice finishes
    if (ST.narr && ST.typed >= text.length && !ST.speaking && ST.t > 60 + text.length * 2 && ST.line.auto) ST.next();
  };

  ST.draw = function () {
    if (!ST.active || !ST.line) return;
    const W = G.W, H = G.H, m = gfx.mctx;
    const text = G.tr(ST.line).slice(0, Math.floor(ST.typed));
    if (ST.narr) {
      m.fillStyle = 'rgba(0,0,0,' + (ST.line.dark ? 0.92 : 0.55) + ')';
      m.fillRect(0, 0, W, H);
      const lines = gfx.wrap(text, 300, 9, 'body');
      lines.forEach((l, i) => gfx.text(l, W / 2, H / 2 - (lines.length * 13) / 2 + 10 + i * 13, { size: 9, align: 'center', color: '#efe4cc', italic: true }));
      if (ST.typed >= G.tr(ST.line).length && ST.t % 40 < 26) gfx.text('▼', W / 2, H - 20, { size: 7, align: 'center', color: '#c9a24a' });
      return;
    }
    const sp = SPEAKERS[ST.line.who] || SPEAKERS.narrator;
    const top = G.game.player && G.game.player.cy - G.game.camy > H * 0.62;
    const y = top ? 8 : H - 70;
    gfx.panel(8, y, W - 16, 62, { top: 'rgba(10,10,34,0.94)', bottom: 'rgba(4,4,14,0.96)' });
    const por = G.portrait(ST.line.who);
    let tx = 18;
    if (por) {
      m.imageSmoothingEnabled = false;
      m.fillStyle = 'rgba(0,0,0,0.5)';
      m.fillRect(14, y + 4, 50, 54);
      m.drawImage(por, 15, y + 5, 48, 52);
      m.strokeStyle = 'rgba(201,162,74,0.8)';
      m.lineWidth = 0.6;
      m.strokeRect(14.5, y + 4.5, 49, 53);
      tx = 72;
    }
    gfx.text(G.tr(sp.name), tx, y + 14, { size: 8, font: 'title', weight: 700, color: sp.col });
    const lines = gfx.wrap(text, W - tx - 24, 8);
    lines.slice(0, 4).forEach((l, i) => gfx.text(l, tx, y + 27 + i * 10, { size: 8, color: '#ece6d6' }));
    if (ST.typed >= G.tr(ST.line).length && ST.t % 40 < 26) gfx.text('▼', W - 20, y + 56, { size: 7, color: '#c9a24a' });
  };
  G.SCENES_SKIPPABLE = true;

  // ---- scenes --------------------------------------------------------------------------------------------
  const L = (who, en, es, o) => Object.assign({ who, en, es }, o || {});
  const N = (en, es, o) => Object.assign({ narr: true, en, es, dark: true }, o || {});

  G.SCENES = {
    prologue: [
      { music: 'prologue' },
      N('1798. One year after the night the castle crumbled into dust...', '1798. Un año después de la noche en que el castillo se deshizo en polvo...'),
      N('...a blood-red eclipse raised it once more from the mists of Wallachia.', '...un eclipse rojo como la sangre lo alzó de nuevo entre las brumas de Valaquia.'),
      N('That same night, the hidden library of the Belmont family vanished: centuries of chronicles, bestiaries and sacred vows.', 'Esa misma noche desapareció la biblioteca secreta de la familia Belmont: siglos de crónicas, bestiarios y votos sagrados.'),
      N('Richter Belmont went after it. He has not returned.', 'Richter Belmont fue tras ella. No ha regresado.'),
      N('And so the son of Dracula, who swore to sleep until the end of days, opens his eyes once more.', 'Y así, el hijo de Drácula, que juró dormir hasta el fin de los días, abre los ojos una vez más.'),
      { do: () => G.state.flags.prologue_done = 1 },
    ],
    arrival: [
      { wait: 40 },
      L('alucard', 'The castle, again... and something else beneath its stones. Old paper. Ink. And Belmont blood.', 'El castillo, otra vez... y algo más bajo sus piedras. Papel viejo. Tinta. Y sangre Belmont.'),
      L('alucard', 'Whoever stole a hunter’s memory and hid it here... has made a grave mistake.', 'Quien haya robado la memoria de los cazadores y la haya escondido aquí... ha cometido un grave error.'),
    ],
    scrivener_erase: () => {
      const g = G.game, p = g.player;
      return [
        { stopMusic: 1.5 },
        { actor: { id: 'scrivener', x: p.cx + 96, y: p.fy - 10, facing: -1 } },
        { sfx: 'page_flutter' },
        { wait: 50 },
        { face: 1 },
        L('scrivener', 'Ah. The dhampir. A footnote I had hoped to strike out.', 'Ah. El dhampir. Una nota al pie que esperaba tachar.'),
        L('alucard', 'And who are you, to speak of me as a line of ink?', '¿Y quién eres tú, que hablas de mí como de una línea de tinta?'),
        L('scrivener', 'I am the Scrivener, keeper of the Chronicle of Blood. Every Belmont who ever lived is written in my book... and soon, none will be.', 'Soy el Escriba, custodio de la Crónica de Sangre. Todo Belmont que haya existido está escrito en mi libro... y pronto, ninguno lo estará.'),
        L('scrivener', 'Let us begin with you. Ink remembers only what it is told.', 'Empecemos contigo. La tinta solo recuerda lo que se le ordena.'),
        { music: 'archives_deep', fade: 0.5 },
        { sfx: 'spell_ink', shake: [4, 40], flash: '#3a1a6a' },
        {
          do: (g) => {
            const s = G.state;
            for (const sl of G.SLOTS) s.equip[sl] = null;
            s.equip.body = 'linen_shirt';
            s.flags.gear_erased = 1;
            g.player.refreshStats();
            G.fx.burst(g.player.cx, g.player.cy, '#2a1a4a', 60, 3);
          },
        },
        { wait: 40 },
        L('alucard', 'My sword... my armour... unwritten?', '¿Mi espada... mi armadura... borradas?'),
        L('scrivener', 'Run along, little footnote. The Archives will finish the rest.', 'Corre, pequeña nota al pie. Los Archivos harán el resto.'),
        { actor: { id: 'scrivener', remove: true } },
        { sfx: 'teleport' },
        { wait: 50 },
        L('alucard', 'He wrote my own blade out of existence. Then I shall write him out of this castle.', 'Ha borrado mi propia espada de la existencia. Entonces yo lo borraré a él de este castillo.'),
        { do: (g) => G.audio.playMusic(g.room.area.music, { fade: 2 }) },
      ];
    },
    maria_gallery: [
      L('maria', 'Alucard! You’re awake... I’m so glad.', '¡Alucard! Estás despierto... me alegro tanto.'),
      L('alucard', 'Maria. You came looking for Richter.', 'Maria. Has venido a buscar a Richter.'),
      L('maria', 'He went to guard the family library and never came back. And now the whole library is... here. Inside the castle.', 'Fue a proteger la biblioteca de la familia y nunca volvió. Y ahora toda la biblioteca está... aquí. Dentro del castillo.'),
      L('alucard', 'The Long Library lies past this gallery. The old Librarian sees everything that moves between his shelves.', 'La Biblioteca Larga está tras esta galería. El viejo Bibliotecario ve todo lo que se mueve entre sus estantes.'),
      L('maria', 'Then go. I’ll search the lower halls. Please... bring him home.', 'Entonces ve. Yo buscaré en las salas inferiores. Por favor... tráelo a casa.'),
      { flag: 'met_maria' },
    ],
    maria_again: [L('maria', 'Be careful. The pages in that place move on their own... I saw them bite a guard.', 'Ten cuidado. Las páginas de ese lugar se mueven solas... vi cómo mordían a un guardia.')],
    librarian_first: [
      L('librarian', 'Master Alucard! Bless the night. You find me in a most peculiar state of affairs.', '¡Maese Alucard! Bendita sea la noche. Me encuentra usted en una situación de lo más peculiar.'),
      L('librarian', 'Something has nested beneath my shelves. A library within my library, full of Belmont ink and very ill-tempered books.', 'Algo ha anidado bajo mis estantes. Una biblioteca dentro de mi biblioteca, llena de tinta Belmont y de libros con muy mal carácter.'),
      L('alucard', 'The Belmont Archives.', 'Los Archivos Belmont.'),
      L('librarian', 'Just so. The great book on the lectern at the far end opens onto them. Do mind the pages, they bite. And do buy something.', 'Exacto. El gran libro del atril, al fondo, se abre hacia ellos. Cuidado con las páginas, muerden. Y compre algo, por favor.'),
      { flag: 'met_librarian' },
    ],
    archives_enter: [
      { wait: 30 },
      L('alucard', 'So this is where the hunters kept their memory. Every page smells of holy water and old blood.', 'Así que aquí guardaban los cazadores su memoria. Cada página huele a agua bendita y a sangre antigua.'),
      L('alucard', 'And the Scrivener’s ink is everywhere, devouring it line by line.', 'Y la tinta del Escriba está por todas partes, devorándola línea a línea.'),
    ],
    doppel_pre: [
      L('scrivener', 'Let us see whether you survive a rough draft of yourself, dhampir.', 'Veamos si sobrevives a un borrador de ti mismo, dhampir.'),
    ],
    echo_pre: [
      L('echo', 'Creature of the night. These halls are sworn to my blood. Leave them, or be judged.', 'Criatura de la noche. Estas salas pertenecen a mi sangre. Abandónalas, o serás juzgado.'),
      L('alucard', 'I am not your enemy, hunter.', 'No soy tu enemigo, cazador.'),
      L('echo', 'Your eyes say otherwise. Have at you!', 'Tus ojos dicen lo contrario. ¡En guardia!'),
    ],
    echo_post: [
      L('echo', '...You do not fight like your father. You fight like one of us.', '...No luchas como tu padre. Luchas como uno de nosotros.'),
      L('echo', 'Take our crest, son of Dracula. The seals of this house will know you now.', 'Toma nuestro blasón, hijo de Drácula. Los sellos de esta casa te reconocerán.'),
      { relic: 'belmont_crest' },
      { do: (g) => G.ITEMS.page1 && G.invAdd(G.state, 'page1') },
      { do: () => G.ui.notify(G.tr(G.ITEMS.page1.name), '#e8d8b0', G.ITEMS.page1) },
      { flag: 'boss_echo' },
    ],
    richter_freed: [
      L('richter', 'Alucard?! Of all the... Thank you. Those chains were written, not forged.', '¿Alucard? De todos los... Gracias. Esas cadenas estaban escritas, no forjadas.'),
      L('alucard', 'The Scrivener holds your family’s chronicle.', 'El Escriba tiene la crónica de tu familia.'),
      L('richter', 'He means to unwrite us. Every Belmont since the first. If our line never existed, nothing would stand between your father and this world.', 'Pretende desescribirnos. A todos los Belmont desde el primero. Si nuestro linaje nunca hubiera existido, nada se interpondría entre tu padre y este mundo.'),
      L('alucard', 'Then we take the pages back.', 'Entonces recuperaremos las páginas.'),
      L('richter', 'Three pages seal his sanctum in the Keep. One you already carry. The Bibliophage swallowed another in the Forbidden Vault, and a clockwork angel guards the last atop the tower.', 'Tres páginas sellan su santuario en el Torreón. Una ya la llevas. El Bibliófago se tragó otra en la Cripta Prohibida, y un ángel de relojería guarda la última en lo alto de la torre.'),
      L('richter', 'I’ll find Maria and get her out. Take this, it’s served me well.', 'Buscaré a Maria y la sacaré de aquí. Toma esto, me ha servido bien.'),
      { give: 'belmont_rosary' },
      { flag: 'richter_free' },
    ],
    biblio_pre: [L('alucard', 'A bookworm... grown fat on centuries of vows.', 'Una polilla de libros... engordada con siglos de juramentos.')],
    seraph_pre: [L('alucard', 'A clockwork angel, keeping time for a madman. Let us see how it handles a broken hour.', 'Un ángel de relojería, marcando el tiempo de un loco. Veamos cómo soporta una hora rota.')],
    keep_door: () => {
      const s = G.state;
      const have = ['page1', 'page2', 'page3'].filter((p) => G.invCount(s, p) > 0).length;
      if (have < 3)
        return [L('alucard', 'Three hollows in the door, shaped like torn pages. I have ' + have + ' of them.', 'Tres huecos en la puerta, con forma de páginas arrancadas. Tengo ' + have + '.')];
      return [
        L('alucard', 'The three pages of the Chronicle... the door remembers them.', 'Las tres páginas de la Crónica... la puerta las recuerda.'),
        { sfx: 'seal_break', flash: '#ffe8a0', shake: [3, 30] },
        { flag: 'keep_open' },
        { do: (g) => g.room.def.onEnter && g.room.def.onEnter(g, g.room) },
      ];
    },
    final_pre: [
      { stopMusic: 1 },
      L('scrivener', 'You came all this way to save the very people who hunted your father.', 'Has venido hasta aquí para salvar a la misma gente que cazó a tu padre.'),
      L('alucard', 'I came to stop a man who believes history is his to rewrite.', 'He venido a detener a un hombre que cree que la historia es suya para reescribirla.'),
      L('scrivener', 'History is ink, dhampir. And I am the hand that holds the quill!', 'La historia es tinta, dhampir. ¡Y yo soy la mano que sostiene la pluma!'),
    ],
    ending: [
      { stopMusic: 2 },
      L('scrivener', 'No... the ink... it remembers them... every name...', 'No... la tinta... los recuerda... cada nombre...'),
      L('alucard', 'Every vow kept. Every life spent guarding the night. That is not a footnote.', 'Cada juramento cumplido. Cada vida entregada a custodiar la noche. Eso no es una nota al pie.'),
      { wait: 60 },
      { music: 'ending' },
      L('maria', 'Alucard! It’s over... the pages are flying home, all of them!', '¡Alucard! Se acabó... las páginas vuelven volando a casa, ¡todas!'),
      L('richter', 'The library will be whole again. Our family owes you more than a page can hold.', 'La biblioteca volverá a estar completa. Nuestra familia te debe más de lo que cabe en una página.'),
      L('alucard', 'Then write it down. Someone ought to remember this night correctly.', 'Entonces escríbelo. Alguien debería recordar esta noche como fue.'),
      L('maria', 'Will you sleep again?', '¿Volverás a dormir?'),
      L('alucard', 'Perhaps. But this time... I will keep a book by my side.', 'Quizá. Pero esta vez... tendré un libro a mi lado.'),
      { do: () => G.startEnding && G.startEnding() },
    ],
  };

  // ---- lore pages ---------------------------------------------------------------------------------------
  const P = (title, en, es, sign) => ({ title, text: { en, es }, sign });
  G.LORE = {
    gate_plaque: P({ en: 'Weathered plaque', es: 'Placa desgastada' }, 'Controls: ← → walk, ↓ crouch, Z jump, X right hand, C left hand (hold a shield to guard), A backdash, ↑ + X sub-weapon (costs hearts). Enter opens the menu, Tab the map. Q / W / E transform once you recover those powers.', 'Controles: ← → caminar, ↓ agacharse, Z saltar, X mano derecha, C mano izquierda (mantén un escudo para cubrirte), A paso atrás, ↑ + X subarma (gasta corazones). Enter abre el menú, Tab el mapa. Q / W / E para transformarte cuando recuperes esos poderes.'),
    arc_oath: P({ en: 'The Hunters’ Oath', es: 'El Juramento de los Cazadores' }, 'We who carry the whip carry no crown. We guard the threshold between the night and the sleepers. When the castle rises, a Belmont rises with it. When a Belmont falls, another reads these pages and stands.', 'Los que portamos el látigo no portamos corona. Guardamos el umbral entre la noche y los que duermen. Cuando el castillo se alza, un Belmont se alza con él. Cuando un Belmont cae, otro lee estas páginas y se pone en pie.', { en: '— first page of the Chronicle', es: '— primera página de la Crónica' }),
    arc_scrivener: P({ en: 'Ledger of the Scribes', es: 'Libro de los Escribas' }, 'Brother Ambrose Vellum, chronicler of the house, has been relieved of his duties. He was found copying the forbidden folios of the Count in his own blood, and claiming that ink, rightly mixed, could make the past forget itself.', 'El hermano Ambrose Vellum, cronista de la casa, ha sido relevado de sus funciones. Se le encontró copiando los folios prohibidos del Conde con su propia sangre, y afirmando que la tinta, bien mezclada, podía hacer que el pasado se olvidara de sí mismo.', { en: '— archive ledger, 1691', es: '— libro del archivo, 1691' }),
    arc_ink: P({ en: 'On Invisible Ink', es: 'Sobre la tinta invisible' }, 'The oldest walkways of these Archives were written, not built. Only a lantern lit with a hunter’s oath can make such words solid enough to walk upon. The lantern rests where the Vault meets the Stacks.', 'Las pasarelas más antiguas de estos Archivos fueron escritas, no construidas. Solo una linterna encendida con el juramento de un cazador puede volver esas palabras lo bastante sólidas para pisarlas. La linterna descansa donde la Cripta se une a las Estanterías.'),
    arc_spells: P({ en: 'Margins of a spellbook', es: 'Márgenes de un grimorio' }, 'Down, down-forward, forward — the ink lance. Forward, down, down-forward — the warding crosses. Down, up, down, up — the crimson requiem, though no hunter has dared it. The tomes that hold these rites hide in the quietest corners.', 'Abajo, abajo-adelante, adelante: la lanza de tinta. Adelante, abajo, abajo-adelante: las cruces protectoras. Abajo, arriba, abajo, arriba: el réquiem carmesí, aunque ningún cazador lo ha osado. Los tomos que guardan estos ritos se esconden en los rincones más silenciosos.'),
    arc_portraits: P({ en: 'Hall of Portraits', es: 'Salón de los Retratos' }, 'Each portrait in this hall was painted the night its subject first faced the castle. Some are young. Some are very young. None of them look away.', 'Cada retrato de este salón se pintó la noche en que su modelo se enfrentó por primera vez al castillo. Algunos son jóvenes. Algunos, muy jóvenes. Ninguno aparta la mirada.'),
    arc_bibliophage: P({ en: 'A warning, scrawled', es: 'Una advertencia, garabateada' }, 'Do NOT feed the worm in the Vault. It has eaten three apprentices’ notebooks and the cook’s recipe for blood pudding. It is no longer small.', 'NO alimentéis al gusano de la Cripta. Se ha comido los cuadernos de tres aprendices y la receta de morcilla de la cocinera. Ya no es pequeño.'),
    cas_clock: P({ en: 'Tower inscription', es: 'Inscripción de la torre' }, 'The Seraph was built to keep the castle’s hours. The Scrivener taught it to keep his instead. It hates being late.', 'El Serafín se construyó para marcar las horas del castillo. El Escriba le enseñó a marcar las suyas. Odia llegar tarde.'),
    cas_keep: P({ en: 'Note pinned to a door', es: 'Nota clavada en una puerta' }, 'Three pages bind the sanctum. Torn from the Chronicle, each guarded by something that should not exist. Without them, this door will not even remember being a door.', 'Tres páginas atan el santuario. Arrancadas de la Crónica, cada una guardada por algo que no debería existir. Sin ellas, esta puerta ni siquiera recordará que es una puerta.'),
    cas_chapel: P({ en: 'Prayer card', es: 'Estampa de oración' }, 'Lord, keep the hunters’ hands steady and their hearts unhardened. And if one of the night’s own children should walk among them, let them know him by his deeds.', 'Señor, mantén firmes las manos de los cazadores y blandos sus corazones. Y si uno de los hijos de la noche camina entre ellos, que lo conozcan por sus obras.'),
  };

  // ---- the Librarian's hints ----------------------------------------------------------------------------
  G.LIBRARIAN_HINTS = [
    { until: 'scene_archives_enter', text: { en: 'The great book at the far end of my library opens onto the Belmont Archives. Step up to it and press up.', es: 'El gran libro al fondo de mi biblioteca se abre hacia los Archivos Belmont. Acérquese y pulse arriba.' } },
    { until: 'boss_doppel', text: { en: 'Something in the Archives wears your face, I am told. Ink is a poor copyist. It forgets to defend itself after it strikes.', es: 'Me dicen que algo en los Archivos lleva su cara. La tinta es mala copista. Olvida defenderse justo después de atacar.' } },
    { until: 'boss_echo', text: { en: 'Iron grates block the Hall of Hunters. A wise vampire would become mist, would he not?', es: 'Rejas de hierro bloquean el Salón de los Cazadores. Un vampiro sabio se convertiría en niebla, ¿no cree?' } },
    { until: 'richter_free', text: { en: 'With the Belmont Crest, the golden seals will part for you. Some guard the way to the Forbidden Vault, below the Stacks.', es: 'Con el Blasón Belmont, los sellos dorados se abrirán para usted. Algunos guardan el paso a la Cripta Prohibida, bajo las Estanterías.' } },
    { until: 'boss_seraph', text: { en: 'The Clock Tower is sealed with Belmont gold, high above the Marble Gallery. Mind the gears.', es: 'La Torre del Reloj está sellada con oro Belmont, muy por encima de la Galería de Mármol. Cuidado con los engranajes.' } },
    { until: 'boss_biblio', text: { en: 'The Bibliophage lurks at the bottom of the Forbidden Vault. Fire disagrees with paper, Master Alucard.', es: 'El Bibliófago acecha en el fondo de la Cripta Prohibida. El fuego no se lleva bien con el papel, maese Alucard.' } },
    { until: 'keep_open', text: { en: 'With three pages in hand, the Keep’s sanctum awaits. They say a bat can reach the top of the castle.', es: 'Con las tres páginas, el santuario del Torreón le espera. Dicen que un murciélago puede llegar a lo alto del castillo.' } },
    { text: { en: 'The catacombs hide the finest blade I have never sold. Seek the deepest crypt.', es: 'Las catacumbas esconden la mejor espada que nunca he vendido. Busque la cripta más profunda.' } },
  ];
})();
