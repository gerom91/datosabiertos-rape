// Scenarios for tools/shot.js
module.exports = {
  async title({ shot, key, wait }) {
    await wait(600);
    await shot('press');
    await key('KeyZ');
    await wait(500);
    await shot('menu');
  },
  async newgame({ shot, key, wait, ev }) {
    await key('KeyZ');
    await wait(300);
    await key('KeyZ'); // New game
    await wait(1600);
    await shot('prologue');
    // skip the prologue + arrival
    for (let i = 0; i < 12; i++) {
      await key('KeyZ');
      await wait(120);
    }
    await wait(600);
    await shot('start');
    await ev(() => (window.G.story.active ? 'story' : 'free'));
  },
  // jump straight into a room: ROOM=id
  async room({ shot, key, wait, ev, page }) {
    const room = process.env.ROOM || 'ent_gate';
    await ev((room) => {
      const G = window.G;
      G.audio.unlock();
      const s = G.newState();
      s.equip = { rhand: 'longsword', lhand: 'buckler', head: null, body: 'leather_coat', cloak: 'nightfall_cloak', acc1: null, acc2: null };
      s.room = room;
      s.relics = { leap_stone: true, soul_wolf: true, form_mist: true, soul_bat: true, belmont_crest: true };
      G.continueGame(s);
    }, room);
    await wait(700);
    await shot('a');
    await page.keyboard.down('ArrowRight');
    await wait(900);
    await shot('walk');
    await page.keyboard.up('ArrowRight');
    await key('KeyX');
    await wait(90);
    await shot('attack');
    await key('KeyZ', 200);
    await wait(150);
    await shot('jump');
    await wait(800);
    await shot('land');
  },
  // tour: renders every room of the world for review (ROOMS=comma list optional)
  async tour({ shot, wait, ev }) {
    const ids = await ev(() => {
      const G = window.G;
      G.world.build();
      return G.world.order.slice();
    });
    const list = process.env.ROOMS ? process.env.ROOMS.split(',') : ids;
    for (const id of list) {
      await ev((id) => {
        const G = window.G;
        const s = G.newState();
        s.room = id;
        s.equip.cloak = 'nightfall_cloak';
        G.continueGame(s);
        G.ui.closeAll();
        G.ui.area = null;
      }, id);
      await wait(350);
      await shot(id);
    }
  },
};

// Mini script runner: SCRIPT="room:ent_hall@5,25;hold:ArrowRight:800;tap:KeyX;wait:200;shot:a"
module.exports.script = async function ({ shot, key, wait, ev, page }) {
  const steps = (process.env.SCRIPT || '').split(';').map((s) => s.trim()).filter(Boolean);
  for (const st of steps) {
    const [cmd, ...rest] = st.split(':');
    const arg = rest.join(':');
    if (cmd === 'room') {
      const [id, pos] = arg.split('@');
      const [tx, ty] = pos ? pos.split(',').map(Number) : [null, null];
      await ev(([id, tx, ty, gear]) => {
        const G = window.G;
        G.audio.unlock();
        const s = G.newState();
        s.equip = { rhand: 'longsword', lhand: 'buckler', head: null, body: 'leather_coat', cloak: 'nightfall_cloak', acc1: null, acc2: null };
        s.inv = { potion: 3, high_potion: 1, chain_whip: 1, bone_cleaver: 1, ember_tome: 1, iron_mace: 1, quill_rapier: 1 };
        s.room = id;
        if (tx != null) {
          s.px = tx * 16 + 8;
          s.py = (ty + 1) * 16;
        }
        s.hearts = 50;
        s.sub = 'axe';
        if (gear === 'all') {
          s.relics = {};
          for (const r in G.RELICS) s.relics[r] = !G.RELICS[r].familiar;
          for (const k in G.SPELLS) s.spells[k] = true;
          s.flags.richter_free = 1;
        }
        G.continueGame(s);
        G.ui.closeAll();
        G.ui.area = null;
      }, [id, tx, ty, process.env.GEAR || '']);
      await wait(300);
    } else if (cmd === 'hold') {
      const [k, ms] = arg.split(':');
      await key(k, Number(ms) || 100);
    } else if (cmd === 'down') await page.keyboard.down(arg);
    else if (cmd === 'up') await page.keyboard.up(arg);
    else if (cmd === 'tap') await key(arg, 50);
    else if (cmd === 'wait') await wait(Number(arg));
    else if (cmd === 'shot') await shot(arg);
    else if (cmd === 'eval') console.log('eval>', JSON.stringify(await ev(new Function('return (' + arg + ')'))));
    else if (cmd === 'spawn') {
      // spawn:<enemyId>@tx,ty  — adds an enemy to the current room
      const [eid, pos] = arg.split('@');
      const [tx, ty] = pos.split(',').map(Number);
      console.log('spawn>', await ev(([eid, tx, ty]) => {
        const G = window.G;
        const e = G.ENT.enemy({ t: 'enemy', id: eid, x: tx * 16 + 8, y: (ty + 1) * 16, key: 'test' + Math.random() }, G.game);
        if (!e) return 'not defined: ' + eid;
        G.game.add(e);
        return 'ok ' + eid;
      }, [eid, tx, ty]));
    } else if (cmd === 'perf')
      console.log('perf>', await ev((n) => {
        const G = window.G;
        const t0 = performance.now();
        for (let i = 0; i < n; i++) {
          G.input.update();
          G.game.update();
        }
        const t1 = performance.now();
        for (let i = 0; i < n; i++) {
          G.gfx.beginFrame();
          G.game.draw();
          G.gfx.present();
          G.gfx.ui();
          G.ui.drawHUD();
        }
        const t2 = performance.now();
        return 'update ' + ((t1 - t0) / n).toFixed(3) + ' ms, draw ' + ((t2 - t1) / n).toFixed(3) + ' ms, ents ' + G.game.ents.length;
      }, Number(arg) || 300));
    else if (cmd === 'god') await ev(() => (window.G.DEBUG_GOD = true));
    else if (cmd === 'clear') await ev(() => window.G.game.ents.forEach((e) => { if (e instanceof window.G.Enemy) e.dead = true; }));
    else if (cmd === 'level') await ev((n) => { const G = window.G; G.gainExp(G.state, 999999 * 0); while (G.state.level < n) G.gainExp(G.state, G.expFor(G.state.level)); G.game.player.refreshStats(); G.state.hp = G.game.player.st.hpMax; }, Number(arg));
  }
};

// opening: new game, skip the intro scenes, walk from the gate into the hall until the
// Scrivener's scene runs, then skip it and report the gear that is left
module.exports.opening = async function ({ shot, key, wait, ev, page }) {
  await key('KeyZ');
  await wait(300);
  await key('KeyZ');
  await wait(1200);
  const skip = async (max) => {
    for (let i = 0; i < max; i++) {
      const active = await ev(() => !!(window.G.story && window.G.story.active));
      if (!active) return i;
      await key('KeyZ', 40);
      await wait(220);
    }
    return max;
  };
  console.log('intro presses', await skip(80));
  await shot('gate');
  await page.keyboard.down('ArrowRight');
  for (let i = 0; i < 40; i++) {
    await wait(500);
    const st = await ev(() => [window.G.game.room.id, Math.round(window.G.game.player.cx / 16), !!window.G.story.active]);
    if (st[2]) {
      console.log('scene started in', st[0], 'at x', st[1]);
      break;
    }
    if (i % 6 === 0) console.log('walk', st.join(' '));
    // hop over steps
    if (i % 3 === 2) await key('KeyZ', 200);
  }
  await page.keyboard.up('ArrowRight');
  await wait(1500);
  await shot('erase_scene');
  console.log('scene presses', await skip(120));
  await wait(500);
  await shot('after_erase');
  console.log('equip>', JSON.stringify(await ev(() => window.G.state.equip)));
};

// bosses: for each boss arena, walk in, let the boss wake (skipping its intro scene), fight a
// little, then finish it and collect the reward.  BOSSES=colossus,doppel (default: all)
module.exports.bosses = async function ({ shot, key, wait, ev, page }) {
  const all = [
    ['colossus', 'gal_boss', 3, 25],
    ['doppel', 'stk_doppel', 3, 25],
    ['echo', 'hun_echo', 3, 25],
    ['biblio', 'vault_worm', 3, 39],
    ['seraph', 'clk_top', 40, 39],
    ['scrivener', 'keep_throne', 20, 11],
  ];
  const want = process.env.BOSSES ? process.env.BOSSES.split(',') : all.map((b) => b[0]);
  const skip = async (max) => {
    let n = 0;
    for (; n < max; n++) {
      if (!(await ev(() => !!(window.G.story && window.G.story.active)))) break;
      await key('KeyZ', 40);
      await wait(200);
    }
    return n;
  };
  const before = {
    colossus: [],
    doppel: ['leap_stone'],
    echo: ['leap_stone', 'soul_wolf', 'form_mist'],
    biblio: ['leap_stone', 'soul_wolf', 'form_mist', 'belmont_crest'],
    seraph: ['leap_stone', 'soul_wolf', 'form_mist', 'belmont_crest'],
    scrivener: ['leap_stone', 'soul_wolf', 'form_mist', 'belmont_crest', 'soul_bat'],
  };
  for (const [boss, room, tx, ty] of all.filter((b) => want.includes(b[0]))) {
    await ev(([room, tx, ty, owned]) => {
      const G = window.G;
      G.audio.unlock();
      const s = G.newState();
      s.room = room;
      s.px = tx * 16 + 8;
      s.py = (ty + 1) * 16;
      s.relics = {};
      for (const r of owned) s.relics[r] = true;
      s.equip = { rhand: 'longsword', lhand: 'iron_shield', head: 'iron_helm', body: 'chainmail', cloak: 'velvet_cape', acc1: null, acc2: null };
      s.flags.richter_free = 1;
      G.continueGame(s);
      G.ui.closeAll();
      G.ui.area = null;
      while (G.state.level < 30) G.gainExp(G.state, G.expFor(G.state.level));
      G.game.player.refreshStats();
      G.state.hp = G.game.player.st.hpMax;
      G.DEBUG_GOD = true;
    }, [room, tx, ty, before[boss]]);
    await wait(400);
    // approach until the boss wakes (its intro scene may start)
    const dir = await ev(() => {
      const G = window.G, b = G.game.ents.find((e) => e.boss);
      return b ? (b.cx > G.game.player.cx ? 'ArrowRight' : 'ArrowLeft') : 'ArrowRight';
    });
    let woke = false;
    for (let i = 0; i < 70 && !woke; i++) {
      await page.keyboard.down(dir);
      await wait(150);
      await page.keyboard.up(dir);
      if (await ev(() => !!(window.G.story && window.G.story.active))) await skip(80);
      woke = await ev(() => !!window.G.game.boss);
    }
    await wait(300);
    await skip(80);
    const info = await ev(() => {
      const G = window.G, b = G.game.boss || G.game.ents.find((e) => e.boss);
      return b ? { id: b.def.id, hp: b.hp, state: b.state, active: b.active, music: G.audio.currentMusic(), shut: (G.game.shutters || []).length } : null;
    });
    console.log(boss, 'woke', woke, JSON.stringify(info));
    // fight for a few seconds, closing in on the boss
    for (let i = 0; i < 20; i++) {
      const d = await ev(() => {
        const G = window.G, b = G.game.boss;
        return b ? (b.cx > G.game.player.cx ? 'ArrowRight' : 'ArrowLeft') : null;
      });
      if (!d) break;
      await page.keyboard.down(d);
      await wait(90);
      await page.keyboard.up(d);
      await key('KeyX', 60);
      await wait(90);
    }
    await shot(boss + '_fight');
    const hpAfter = await ev(() => (window.G.game.boss ? window.G.game.boss.hp : null));
    // finish it
    await ev(() => {
      const G = window.G, b = G.game.boss || G.game.ents.find((e) => e.boss);
      if (!b) return;
      b.invuln = 0;
      b.active = true;
      b.hp = 1;
      b.takeHit({ dmg: 99999, id: 'test' + Math.random(), el: 'hit', noCrit: true }, G.game);
      if (!b.dead) b.die(G.game);
    });
    for (let i = 0; i < 8; i++) {
      await wait(400);
      await skip(100);
    }
    // collect dropped rewards one at a time
    const got = [];
    for (let i = 0; i < 6; i++) {
      const id = await ev(() => {
        const G = window.G, g = G.game;
        const e = g.ents.find((e) => e.id && e.life === -1 && !e.dead);
        if (!e) return null;
        g.player.x = e.cx - g.player.w / 2;
        g.player.y = e.y + e.h - g.player.h;
        return e.id;
      });
      if (!id) break;
      got.push(id);
      await wait(500);
      await skip(100);
    }
    await wait(600);
    await skip(100);
    await wait(1200);
    await skip(100);
    const res = await ev((boss) => {
      const G = window.G, s = G.state;
      return { flag: !!s.flags['boss_' + boss], relics: Object.keys(s.relics).filter((r) => s.relics[r]), pages: ['page1', 'page2', 'page3'].filter((p) => G.invCount(s, p)), inv: Object.keys(s.inv).join(','), room: G.game.room.id, bossActive: !!G.game.boss, music: G.audio.currentMusic(), story: !!G.story.active, scene: G.scene };
    }, boss);
    console.log(boss, 'hp after fighting', hpAfter, 'drops', JSON.stringify(got), 'result', JSON.stringify(res));
    await shot(boss + '_after');
  }
};

// mapfull: mark every room visited and screenshot both map pages
module.exports.mapfull = async function ({ shot, key, wait, ev }) {
  const r = await ev(() => {
    const G = window.G;
    const s = G.newState();
    s.room = 'gal_hall';
    G.continueGame(s);
    G.ui.closeAll();
    for (const id of G.world.order) {
      const d = G.world.rooms[id];
      const v = (G.state.visited[d.map] = G.state.visited[d.map] || {});
      for (let x = 0; x < d.w; x++) for (let y = 0; y < d.h; y++) v[d.x + x + ',' + (d.y + y)] = 1;
    }
    G.ui.openPause('map');
    return [G.mapCompletion(G.state, 'castle'), G.mapCompletion(G.state, 'archives')];
  });
  console.log('completion', JSON.stringify(r));
  await wait(400);
  await shot('castle');
  await key('KeyZ');
  await wait(400);
  await shot('archives');
};
