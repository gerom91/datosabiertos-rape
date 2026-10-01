/* Elegy of the Night — title.js
 * Title screen, file select, options, credits and the ending roll.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, I = G.input, gfx = G.gfx;
  const W = G.W, H = G.H;

  const TL = (G.title = { mode: 'press', t: 0, c: 0, metas: [null, null, null], bats: [] });

  TL.open = function () {
    TL.mode = G.audio.isUnlocked() ? 'menu' : 'press';
    TL.t = 0;
    TL.c = 0;
    G.scene = 'title';
    G.ui.closeAll();
    if (G.audio.isUnlocked()) G.audio.playMusic('title', { fade: 1 });
    TL.refresh();
    TL.bats = [];
    for (let i = 0; i < 9; i++) TL.bats.push({ x: Math.random() * W, y: 40 + Math.random() * 80, s: 0.4 + Math.random() * 0.6, p: Math.random() * 6 });
  };
  TL.refresh = function () {
    G.save.listMeta().then((m) => (TL.metas = m));
  };

  function menuItems() {
    const any = TL.metas.some((m) => m);
    return [
      { k: 'new', label: G.t('new_game') },
      { k: 'continue', label: G.t('continue'), disabled: !any },
      { k: 'options', label: G.t('options') },
      { k: 'controls', label: G.t('controls') },
      { k: 'credits', label: G.t('credits') },
    ];
  }

  TL.update = function () {
    TL.t++;
    for (const b of TL.bats) {
      b.x += b.s;
      b.p += 0.2;
      if (b.x > W + 20) {
        b.x = -20;
        b.y = 40 + Math.random() * 80;
      }
    }
    if (G.ui.modal()) return G.ui.update();
    switch (TL.mode) {
      case 'press':
        if (I.anyPressed() || TL.clicked) {
          TL.clicked = false;
          G.audio.unlock();
          G.audio.playMusic('title', { fade: 1.5 });
          G.audio.sfx('menu_select');
          TL.mode = 'menu';
          I.consumeAll();
        }
        break;
      case 'menu': {
        const items = menuItems();
        if (I.repeat('down')) {
          do TL.c = (TL.c + 1) % items.length;
          while (items[TL.c].disabled);
          G.audio.sfx('menu_move');
        }
        if (I.repeat('up')) {
          do TL.c = (TL.c + items.length - 1) % items.length;
          while (items[TL.c].disabled);
          G.audio.sfx('menu_move');
        }
        if (I.pressed.tabL || I.pressed.tabR) {
          G.lang = G.lang === 'es' ? 'en' : 'es';
          G.settings.lang = G.lang;
          G.applySettings();
          G.audio.sfx('menu_move');
        }
        if (I.pressed.confirm) {
          const it = items[TL.c];
          if (it.disabled) return G.audio.sfx('menu_error');
          G.audio.sfx('menu_select');
          if (it.k === 'new') {
            TL.mode = 'fade';
            TL.fadeT = 0;
          } else if (it.k === 'continue') {
            TL.mode = 'files';
            TL.fc = Math.max(0, (G.save.lastSlot || 1) - 1);
            TL.refresh();
          } else if (it.k === 'options') {
            TL.mode = 'options';
            TL.oc = 0;
          } else if (it.k === 'controls') TL.mode = 'controls';
          else TL.mode = 'credits';
        }
        break;
      }
      case 'fade':
        TL.fadeT++;
        if (TL.fadeT === 1) G.audio.stopMusic(1.2);
        if (TL.fadeT > 70) G.newGame();
        break;
      case 'files': {
        if (I.repeat('down')) {
          TL.fc = (TL.fc + 1) % 4;
          G.audio.sfx('menu_move');
        }
        if (I.repeat('up')) {
          TL.fc = (TL.fc + 3) % 4;
          G.audio.sfx('menu_move');
        }
        if (I.pressed.cancel) {
          TL.mode = 'menu';
          G.audio.sfx('menu_cancel');
        }
        if (I.pressed.confirm) {
          if (TL.fc === 3) {
            G.save.importFile((st) => {
              if (st) TL.refresh();
            }, 3);
            return;
          }
          const m = TL.metas[TL.fc];
          if (!m) return G.audio.sfx('menu_error');
          G.audio.sfx('menu_select');
          G.save.read(TL.fc + 1).then((st) => {
            if (st) G.continueGame(st);
          });
        }
        if (I.pressed.backdash && TL.metas[TL.fc] && TL.fc < 3) {
          const slot = TL.fc + 1;
          G.ui.confirm(G.t('delete_q'), (yes) => {
            if (yes) G.save.remove(slot).then(TL.refresh);
          });
        }
        break;
      }
      case 'options': {
        const items = optionItems();
        if (I.repeat('down')) {
          TL.oc = (TL.oc + 1) % items.length;
          G.audio.sfx('menu_move');
        }
        if (I.repeat('up')) {
          TL.oc = (TL.oc + items.length - 1) % items.length;
          G.audio.sfx('menu_move');
        }
        const it = items[TL.oc];
        const dir = I.repeat('right') ? 1 : I.repeat('left') ? -1 : 0;
        const st = G.settings;
        if (['music', 'sfx', 'voice'].includes(it.k) && dir) {
          st[it.k] = Math.round(U.clamp(st[it.k] + dir * 0.1, 0, 1) * 10) / 10;
          G.applySettings();
          G.audio.sfx('menu_move');
          if (it.k === 'voice') G.audio.say('What is a castle, but a library of sorrows?', { speaker: 'alucard' });
        }
        if (I.pressed.confirm || (dir && !['music', 'sfx', 'voice'].includes(it.k))) {
          if (it.k === 'lang') {
            G.lang = G.lang === 'es' ? 'en' : 'es';
            st.lang = G.lang;
          } else if (it.k === 'back') {
            TL.mode = 'menu';
          } else if (it.k === 'touch') st.touch = st.touch === 'auto' ? true : st.touch === true ? false : 'auto';
          else if (it.k === 'fullscreen') G.toggleFullscreen();
          else if (typeof st[it.k] === 'boolean') st[it.k] = !st[it.k];
          G.applySettings();
          G.audio.sfx('menu_select');
        }
        if (I.pressed.cancel) {
          TL.mode = 'menu';
          G.audio.sfx('menu_cancel');
        }
        break;
      }
      case 'controls':
      case 'credits':
        if (I.pressed.cancel || I.pressed.confirm) {
          TL.mode = 'menu';
          G.audio.sfx('menu_cancel');
        }
        break;
    }
  };

  function optionItems() {
    const st = G.settings, pct = (v) => Math.round(v * 100) + '%';
    const on = (b) => (b ? G.t('on') : G.t('off'));
    return [
      { k: 'lang', label: G.t('language'), val: G.lang === 'es' ? 'Español' : 'English' },
      { k: 'music', label: G.t('music_vol'), val: pct(st.music) },
      { k: 'sfx', label: G.t('sfx_vol'), val: pct(st.sfx) },
      { k: 'voice', label: G.t('voice_vol'), val: pct(st.voice) },
      { k: 'voices', label: G.t('voices'), val: on(st.voices) },
      { k: 'shake', label: G.t('screen_shake'), val: on(st.shake) },
      { k: 'dmgNumbers', label: G.t('show_damage'), val: on(st.dmgNumbers) },
      { k: 'touch', label: G.t('touch_controls'), val: st.touch === 'auto' ? G.t('auto') : on(st.touch) },
      { k: 'fullscreen', label: G.t('fullscreen'), val: '' },
      { k: 'back', label: G.t('back') },
    ];
  }

  G.controlsHelp = function () {
    const kb = G.input.lastDevice !== 'pad';
    if (!kb)
      return [
        [G.tr({ en: 'Move', es: 'Mover' }), 'D-pad / L-stick'], [G.tr({ en: 'Jump', es: 'Saltar' }), 'A'], [G.tr({ en: 'Right hand', es: 'Mano der.' }), 'X'],
        [G.tr({ en: 'Left hand', es: 'Mano izq.' }), 'B'], [G.tr({ en: 'Backdash', es: 'Paso atrás' }), 'Y'], [G.tr({ en: 'Sub-weapon', es: 'Subarma' }), '↑+X / RT'],
        [G.tr({ en: 'Bat / Mist', es: 'Murciél. / Niebla' }), 'LB / RB'], [G.tr({ en: 'Wolf', es: 'Lobo' }), 'LT'], [G.tr({ en: 'Menu', es: 'Menú' }), 'Start'], [G.tr({ en: 'Map', es: 'Mapa' }), 'Back'],
        [G.tr({ en: 'Interact', es: 'Interactuar' }), '↑'], [G.tr({ en: 'Drop down', es: 'Bajar' }), '↓ + A'],
      ];
    return [
      [G.tr({ en: 'Move', es: 'Mover' }), '← →'], [G.tr({ en: 'Crouch', es: 'Agacharse' }), '↓'], [G.tr({ en: 'Jump', es: 'Saltar' }), 'Z / Space'],
      [G.tr({ en: 'Right hand', es: 'Mano der.' }), 'X'], [G.tr({ en: 'Left hand', es: 'Mano izq.' }), 'C'], [G.tr({ en: 'Backdash', es: 'Paso atrás' }), 'A / Shift'],
      [G.tr({ en: 'Sub-weapon', es: 'Subarma' }), '↑+X / S'], [G.tr({ en: 'Bat · Mist · Wolf', es: 'Murc. · Niebla · Lobo' }), 'Q · W · E'],
      [G.tr({ en: 'Menu', es: 'Menú' }), 'Enter / Esc'], [G.tr({ en: 'Map', es: 'Mapa' }), 'Tab / M'], [G.tr({ en: 'Interact', es: 'Interactuar' }), '↑'], [G.tr({ en: 'Drop down', es: 'Bajar' }), '↓ + Z'],
    ];
  };

  // ---- drawing -------------------------------------------------------------------------------------
  TL.draw = function () {
    const ctx = gfx.ctx;
    gfx.beginFrame();
    G.drawFar(ctx, 'night', TL.t * 0.3, 20, TL.t);
    // bats
    for (const b of TL.bats) {
      const img = G.drawBat(Math.floor(b.p * 3));
      ctx.globalAlpha = 0.85;
      ctx.drawImage(img, Math.round(b.x - 16), Math.round(b.y + Math.sin(b.p) * 4 - 12));
      ctx.globalAlpha = 1;
    }
    // a cliff in the foreground with Alucard watching the castle, cape in the wind
    ctx.fillStyle = '#05040a';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, 178);
    ctx.lineTo(24, 172);
    ctx.lineTo(58, 176);
    ctx.lineTo(92, 186);
    ctx.lineTo(118, 196);
    ctx.lineTo(132, 212);
    ctx.lineTo(140, H);
    ctx.closePath();
    ctx.fill();
    const t = TL.t;
    const cape = [], hair = [];
    for (let i = 0; i < 7; i++) {
      const k = i / 6;
      cape.push({ x: -4 - i * 3.2 - Math.sin(t * 0.07 + i * 0.7) * 2.2 * k, y: -33 + i * 4.2 + Math.sin(t * 0.05 + i) * 1.5 * k });
    }
    for (let i = 0; i < 4; i++) hair.push({ x: -3 - i * 3 - Math.sin(t * 0.09 + i) * 1.2, y: -40 + i * 2.6 });
    const pose = G.alucardPose('idle', t);
    const res = G.drawAlucard(pose, cape, hair, { extraPal: ['#16121c', '#9a1426'] });
    gfx.drawAnchored(res.canvas, 66, 177, 64, 76, false);
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 260);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    if (TL.mode === 'fade') gfx.fade = Math.min(1, TL.fadeT / 60);
    else gfx.fade = 0;
    gfx.present();
    gfx.ui();
    const m = gfx.mctx;
    const a = Math.min(1, TL.t / 60);
    // title
    const ty = TL.mode === 'press' ? 74 : 54;
    gfx.text('ELEGY', W / 2, ty - 18, { size: 9, font: 'title', align: 'center', alpha: a, color: '#c8b8e8', weight: 600 });
    gfx.text('OF THE NIGHT', W / 2, ty + 6, { size: 22, font: 'title', weight: 700, align: 'center', alpha: a, gradient: ['#fff6dc', '#e0b860', '#8a5a20'], stroke: 'rgba(30,6,10,0.9)', strokeWidth: 2 });
    gfx.text(G.lang === 'es' ? '— Los Archivos Belmont —' : '— The Belmont Archives —', W / 2, ty + 22, { size: 8.5, font: 'title', align: 'center', alpha: a, color: '#e8c0c8' });
    m.globalAlpha = a * 0.8;
    m.fillStyle = '#c9a24a';
    m.fillRect(W / 2 - 110, ty + 28, 220, 0.6);
    m.globalAlpha = 1;
    if (TL.mode === 'press') {
      let focused = true;
      try {
        focused = document.hasFocus();
      } catch (e) {}
      const msg = G.input.lastDevice === 'touch' || G.isTouch ? G.t('tap_start') : focused ? G.t('press_start') : G.t('click_start');
      if (TL.t % 60 < 42) gfx.text(msg, W / 2, 150, { size: 9, font: 'title', align: 'center', color: '#f0e6d0' });
    } else if (TL.mode === 'menu' || TL.mode === 'fade') {
      const items = menuItems();
      items.forEach((it, i) => {
        const y = 112 + i * 15;
        const sel = i === TL.c;
        if (sel) {
          const gr = m.createLinearGradient(W / 2 - 70, 0, W / 2 + 70, 0);
          gr.addColorStop(0, 'rgba(160,30,50,0)');
          gr.addColorStop(0.5, 'rgba(160,30,50,0.55)');
          gr.addColorStop(1, 'rgba(160,30,50,0)');
          m.fillStyle = gr;
          m.fillRect(W / 2 - 70, y - 10, 140, 13);
        }
        gfx.text(it.label, W / 2, y, { size: 9, font: 'title', align: 'center', color: it.disabled ? '#5a5466' : sel ? '#ffffff' : '#c8c0d8', weight: sel ? 700 : 500 });
      });
      gfx.text('Q / E : ' + (G.lang === 'es' ? 'Español ⇄ English' : 'English ⇄ Español'), W / 2, 196, { size: 6, align: 'center', color: '#8a84a0' });
    } else if (TL.mode === 'files') {
      for (let i = 0; i < 3; i++) {
        const y = 86 + i * 40;
        gfx.panel(48, y, 288, 36, i === TL.fc ? { border: '#ffe0a0', top: 'rgba(50,20,40,0.95)' } : {});
        m.save();
        m.translate(0, -5);
        G.ui.drawSlotMeta(TL.metas[i], i + 1, 56, y, i === TL.fc);
        m.restore();
      }
      const y = 86 + 3 * 40;
      gfx.panel(48, y, 288, 16, TL.fc === 3 ? { border: '#ffe0a0' } : {});
      gfx.text(G.t('import_save'), W / 2, y + 11, { size: 7.5, font: 'title', align: 'center', color: TL.fc === 3 ? '#fff' : '#a8a0b8' });
      gfx.text('[Z] ' + G.t('continue') + '   [X] ' + G.t('back') + '   [A] ' + G.t('delete_file'), W / 2, H - 5, { size: 6, align: 'center', color: '#8a84a0' });
    } else if (TL.mode === 'options') {
      gfx.panel(70, 84, 244, 136);
      optionItems().forEach((it, i) => {
        const y = 98 + i * 12.5;
        const sel = i === TL.oc;
        if (sel) {
          m.fillStyle = 'rgba(120,150,255,0.3)';
          m.fillRect(76, y - 9, 232, 12);
        }
        gfx.text(it.label, 82, y, { size: 7, color: sel ? '#fff' : '#c8c0d8' });
        if (it.val) gfx.text('◂ ' + it.val + ' ▸', 302, y, { size: 7, align: 'right', color: '#e8c872' });
      });
      gfx.text(G.t('storage_' + (G.save.backend === 'cloud' ? 'cloud' : G.save.backend === 'local' ? 'local' : 'none')), W / 2, 78, { size: 6, align: 'center', color: '#a8a0c0' });
    } else if (TL.mode === 'controls') {
      gfx.panel(70, 84, 244, 136);
      G.controlsHelp().forEach((r, i) => {
        gfx.text(r[0], 84, 100 + i * 10, { size: 7, color: '#a8a0b8' });
        gfx.text(r[1], 300, 100 + i * 10, { size: 7, align: 'right', color: '#ffffff' });
      });
    } else if (TL.mode === 'credits') {
      gfx.panel(40, 84, 304, 136);
      const lines = [
        ['Elegy of the Night — The Belmont Archives', '#e8c872'],
        [G.tr({ en: 'An unofficial fan-made sequel to the gameplay of Symphony of the Night.', es: 'Una secuela no oficial, hecha por fans, de la jugabilidad de Symphony of the Night.' }), '#d8d0e8'],
        [G.tr({ en: 'All code, pixel art, music and sound are original and generated in your browser.', es: 'Todo el código, pixel art, música y sonido son originales y se generan en tu navegador.' }), '#d8d0e8'],
        [G.tr({ en: 'English voices use your browser’s speech synthesis.', es: 'Las voces en inglés usan la síntesis de voz de tu navegador.' }), '#d8d0e8'],
        ['', ''],
        [G.tr({ en: 'Castlevania, Alucard and the Belmont family are trademarks of Konami.', es: 'Castlevania, Alucard y la familia Belmont son marcas de Konami.' }), '#a8a0b8'],
        [G.tr({ en: 'This project is not affiliated with or endorsed by Konami.', es: 'Este proyecto no está afiliado ni respaldado por Konami.' }), '#a8a0b8'],
      ];
      let y = 102;
      lines.forEach(([l, c]) => {
        gfx.wrap(l, 280, 7).forEach((s) => {
          gfx.text(s, W / 2, y, { size: 7, align: 'center', color: c });
          y += 10;
        });
      });
    }
    gfx.text(G.t('unofficial'), W / 2, H - (TL.mode === 'files' ? 14 : 5), { size: 4.8, align: 'center', color: 'rgba(200,190,220,0.55)', maxWidth: 370 });
    G.ui.drawPanels();
  };

  // ---- ending ---------------------------------------------------------------------------------------
  const EN = (G.endingScene = { t: 0 });
  G.startEnding = function () {
    G.scene = 'ending';
    EN.t = 0;
    G.state.flags.game_clear = 1;
    G.state.clears = (G.state.clears || 0) + 1;
    G.audio.playMusic('ending', { fade: 2 });
  };
  EN.update = function () {
    EN.t++;
    if (EN.t > 2400 || (EN.t > 300 && (I.pressed.confirm || I.pressed.menu))) {
      // autosave a cleared file into the last slot so the record is kept
      G.save.write(G.save.lastSlot || 1, G.state).then(() => G.toTitle());
      EN.t = -99999;
    }
  };
  EN.draw = function () {
    const ctx = gfx.ctx;
    gfx.beginFrame();
    G.drawFar(ctx, 'night', EN.t * 0.2, 10, EN.t);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    gfx.fade = 0;
    gfx.present();
    gfx.ui();
    const s = G.state;
    const roll = [
      ['ELEGY OF THE NIGHT', 14, '#e8c872'],
      [G.tr({ en: 'The Belmont Archives', es: 'Los Archivos Belmont' }), 9, '#e8c0c8'],
      ['', 10],
      [G.tr({ en: 'The pages flew home before dawn.', es: 'Las páginas volvieron a casa antes del alba.' }), 8, '#efe4cc'],
      [G.tr({ en: 'The castle sank once more into the mist,', es: 'El castillo se hundió de nuevo en la niebla,' }), 8, '#efe4cc'],
      [G.tr({ en: 'and a dhampir walked away with a borrowed book.', es: 'y un dhampir se marchó con un libro prestado.' }), 8, '#efe4cc'],
      ['', 10],
      [G.t('level') + ' ' + s.level + '   ·   ' + G.t('time') + ' ' + U.fmtTime(s.time), 8, '#ffffff'],
      [G.t('completion') + ' ' + (G.mapCompletion(s, 'castle') + G.mapCompletion(s, 'archives')).toFixed(1) + '%   ·   ' + G.t('kills') + ' ' + s.kills, 8, '#ffffff'],
      ['', 10],
      [G.tr({ en: 'Code, pixel art, music: original, generated in your browser', es: 'Código, pixel art, música: originales, generados en tu navegador' }), 7, '#c8c0d8'],
      [G.tr({ en: 'Voices: your browser’s English speech synthesis', es: 'Voces: síntesis de voz en inglés de tu navegador' }), 7, '#c8c0d8'],
      [G.tr({ en: 'Inspired by Castlevania: Symphony of the Night (Konami, 1997)', es: 'Inspirado en Castlevania: Symphony of the Night (Konami, 1997)' }), 7, '#a8a0b8'],
      [G.tr({ en: 'Unofficial fan project — not affiliated with Konami', es: 'Proyecto fan no oficial — sin afiliación con Konami' }), 7, '#a8a0b8'],
      ['', 30],
      [G.t('the_end'), 16, '#e8c872'],
    ];
    let y = H + 20 - EN.t * 0.35;
    for (const [l, sz, c] of roll) {
      if (l) gfx.text(l, W / 2, Math.max(y, l === G.t('the_end') ? H / 2 + 6 : -50), { size: sz, font: sz >= 9 ? 'title' : 'body', align: 'center', color: c, weight: sz >= 12 ? 700 : 500 });
      y += (sz || 8) + 8;
    }
  };
})();
