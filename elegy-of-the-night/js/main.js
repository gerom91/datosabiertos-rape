/* Elegy of the Night — main.js
 * Boot, fixed-timestep main loop, scene routing, new game / continue,
 * touch controls, focus handling and live-update (hot) snapshots.
 */
(function () {
  'use strict';
  const G = window.G;
  const I = G.input, gfx = G.gfx;

  G.scene = 'boot';
  G.isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;

  // ---- game flow -----------------------------------------------------------------------------------
  G.newGame = function () {
    const s = G.newState();
    // Alucard arrives fully equipped... for now.
    s.equip = { rhand: 'dhampir_blade', lhand: 'crimson_shield', head: null, body: 'twilight_mail', cloak: 'nightfall_cloak', acc1: 'blood_signet', acc2: null };
    s.inv = { potion: 2 };
    s.sub = null;
    s.hearts = 20;
    G.ui.closeAll();
    G.game.start(s);
    G.game.player.refreshStats();
    s.hp = G.game.player.st.hpMax;
    s.mp = G.game.player.st.mpMax;
    G.story.play('prologue', { after: () => G.story.play('arrival') });
  };

  G.continueGame = function (st) {
    G.ui.closeAll();
    G.game.start(st);
    G.game.player.refreshStats();
  };

  G.loadLast = function () {
    G.save.read(G.save.lastSlot || 1).then((st) => {
      if (st) G.continueGame(st);
      else G.toTitle();
    });
  };

  G.toTitle = function () {
    G.audio.stopSpeech();
    G.story.active = false;
    G.game.running = false;
    G.title.open();
  };

  G.toggleFullscreen = function () {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen().catch(() => {});
      else document.exitFullscreen && document.exitFullscreen();
    } catch (e) {}
  };

  // ---- loop ------------------------------------------------------------------------------------------
  let last = 0, acc = 0, paused = false;
  const STEP = 1000 / 60;

  function step() {
    I.update();
    switch (G.scene) {
      case 'title':
        G.title.update();
        break;
      case 'game':
        if (paused) break;
        if (G.ui.modal()) G.ui.update();
        else if (G.story.active) {
          G.story.update();
          G.game.update();
        } else {
          if (I.pressed.menu && !G.game.player.dead) {
            G.ui.openPause('status');
            I.consumeAll();
          } else if (I.pressed.map && !G.game.player.dead) {
            G.ui.openPause('map');
            I.consumeAll();
          } else G.game.update();
        }
        G.ui.tick();
        break;
      case 'ending':
        G.endingScene.update();
        break;
    }
  }

  function render() {
    switch (G.scene) {
      case 'title':
        G.title.draw();
        break;
      case 'game':
        gfx.beginFrame();
        G.game.draw();
        gfx.present();
        gfx.ui();
        G.ui.drawHUD();
        G.story.draw();
        G.ui.drawPanels();
        if (paused) drawPaused();
        drawDebug();
        break;
      case 'ending':
        G.endingScene.draw();
        break;
      default:
        gfx.beginFrame();
        gfx.present();
    }
  }

  let dbg = false, fpsT = 0, fpsN = 0, fps = 0;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      dbg = !dbg;
      e.preventDefault();
    }
  });
  function drawDebug() {
    fpsN++;
    const now = performance.now();
    if (now - fpsT > 1000) {
      fps = fpsN;
      fpsN = 0;
      fpsT = now;
    }
    if (!dbg) return;
    const g = G.game;
    const p = g.player;
    const s = [fps + ' fps', 'ents ' + g.ents.length, 'parts ' + G.fx.parts.length, g.room ? g.room.id : '', p ? 'x ' + Math.round(p.cx / 16) + ' y ' + Math.round(p.fy / 16) : ''].join('  ');
    gfx.text(s, 4, G.H - 4, { size: 6, color: '#80ff80' });
  }

  function drawPaused() {
    const m = gfx.mctx;
    m.fillStyle = 'rgba(0,0,0,0.55)';
    m.fillRect(0, 0, G.W, G.H);
    gfx.text(G.t('paused'), G.W / 2, G.H / 2 - 4, { size: 14, font: 'title', align: 'center', color: '#e8c872' });
    gfx.text(G.t('click_resume'), G.W / 2, G.H / 2 + 12, { size: 7, align: 'center', color: '#d0c8e0' });
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    if (!last) last = ts;
    let dt = ts - last;
    last = ts;
    if (dt > 250) dt = STEP; // tab was hidden
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 4) {
      step();
      acc -= STEP;
      n++;
    }
    if (n >= 4) acc = 0;
    render();
  }

  // ---- touch controls ---------------------------------------------------------------------------------
  function setupTouch() {
    const el = document.getElementById('touch');
    if (!el) return;
    I.bindTouch(el);
    const apply = () => {
      const st = G.settings.touch;
      const show = st === true || (st === 'auto' && G.isTouch);
      el.hidden = !show;
      document.body.classList.toggle('touch-on', show);
    };
    G.on('settings', apply);
    window.addEventListener('touchstart', () => {
      if (!G.isTouch) {
        G.isTouch = true;
        apply();
      }
    }, { passive: true });
    apply();
  }

  // ---- boot ---------------------------------------------------------------------------------------------
  function boot(hotData) {
    G.save.loadSettings();
    G.world.build();
    const canvas = document.getElementById('game');
    gfx.init(canvas);
    G.applySettings();
    setupTouch();
    const unlock = () => G.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    canvas.addEventListener('pointerdown', () => {
      canvas.focus();
      if (G.scene === 'title') G.title.clicked = true;
      if (paused) {
        paused = false;
        G.audio.unlock();
      }
    });
    G.on('blur', () => {
      if (G.scene === 'game' && !G.ui.modal() && !G.story.active && G.game.player && !G.game.player.dead) paused = true;
    });
    window.addEventListener('keydown', () => {
      if (paused) {
        paused = false;
        I.clearAll();
      }
    });
    const fontsReady = document.fonts && document.fonts.load ? Promise.race([Promise.all([document.fonts.load('700 20px "Cinzel"'), document.fonts.load('500 16px "Crimson Pro"'), document.fonts.load('italic 500 16px "Crimson Pro"')]), new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
    Promise.all([fontsReady.catch(() => {}), G.save.init()]).then(() => {
      if (hotData && hotData.state && G.save.valid(hotData.state)) {
        G.audio.unlock();
        G.continueGame(G.save.migrate(hotData.state));
      } else G.title.open();
      const ld = document.getElementById('loading');
      if (ld) ld.remove();
    });
    canvas.focus();
    requestAnimationFrame(frame);
  }

  // live updates of a published artifact keep the current run
  const hot = window.claude && window.claude.hot;
  try {
    if (hot && hot.snapshot)
      hot.snapshot(() => {
        if (G.scene !== 'game' || !G.state || !G.game.room) return {};
        const st = JSON.parse(JSON.stringify(G.state));
        st.room = G.game.room.id;
        st.px = G.game.player.cx;
        st.py = G.game.player.fy;
        return { state: st };
      });
  } catch (e) {}
  const start = (data) => boot(data || {});
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});
})();
