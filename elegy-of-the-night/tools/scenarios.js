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
    } else if (cmd === 'god') await ev(() => (window.G.DEBUG_GOD = true));
    else if (cmd === 'clear') await ev(() => window.G.game.ents.forEach((e) => { if (e instanceof window.G.Enemy) e.dead = true; }));
    else if (cmd === 'level') await ev((n) => { const G = window.G; G.gainExp(G.state, 999999 * 0); while (G.state.level < n) G.gainExp(G.state, G.expFor(G.state.level)); G.game.player.refreshStats(); G.state.hp = G.game.player.st.hpMax; }, Number(arg));
  }
};
