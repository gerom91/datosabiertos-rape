// World validator: loads the game data in a Node VM, checks room formats,
// door alignment between neighbours, and simulates Alucard's real movement
// (same physics code) to verify every room can be traversed with the
// abilities the player has when first arriving.
//
//   node tools/validate.js                 all rooms
//   node tools/validate.js ent_hall -v     one room, verbose + ASCII map of reachable spots
//
// Room meta used by the validator (all optional):
//   lvl:   ability level on arrival (0 none, 1 double jump, 2 +wolf, 3 +mist,
//          4 +Belmont Crest, 5 +bat, 6 +lantern & gravity boots)
//   entry: the door the player normally enters from ('L0', 'R1', 'T0', 'B2'...)
//   gates: { R0: 5, 'item:hp_up': 3 }  doors/items that need a higher level
//   oneway: ['B0']  doors the player only leaves through (pits)
//   noValidate: true
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const files = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]).filter((f) => !/(main|title|audio|music)\.js$/.test(f));
const ctx = { console, setTimeout, clearTimeout, Math, JSON, Date, Map, Set, WeakMap, Promise, Array, Object };
vm.createContext(ctx);
const loadIssues = [];
for (const f of files) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  try {
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  } catch (e) {
    // a content file that is being edited right now must not block room validation
    if (/rooms_|roombuilder|world|physics|util/.test(f)) throw e;
    loadIssues.push(f + ': ' + e.message);
  }
}
if (loadIssues.length) console.log('(skipped files that failed to load: ' + loadIssues.join(' | ') + ')');
const G = ctx.G;
G.world.build();
const T = G.T, P = G.phys, TS = 16, CW = 24, CH = 14;

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const only = args.filter((a) => !a.startsWith('-'));

const LV = { dj: 1, wolf: 2, mist: 3, crest: 4, bat: 5, lantern: 6 };
const ab = (lvl) => ({ dj: lvl >= 1, wolf: lvl >= 2, mist: lvl >= 3, crest: lvl >= 4, bat: lvl >= 5, lantern: lvl >= 6 });

let problems = 0, warnings = 0;
const report = [];
function problem(msg) {
  problems++;
  report.push('  ✗ ' + msg);
}
function warn(msg) {
  warnings++;
  report.push('  ! ' + msg);
}

// ---------------------------------------------------------------- format checks
for (const e of G.world.errors) problem('[world] ' + e);
for (const id of G.world.order) {
  const def = G.world.rooms[id];
  if (!G.world.areas[def.area]) problem(id + ': unknown area ' + def.area);
  for (const sp of new G.world.Room(def).spawns) {
    if (sp.t === 'enemy' && !G.ENEMIES[sp.id]) warn(id + ': enemy "' + sp.id + '" not defined yet');
    if ((sp.t === 'item' || sp.t === 'relic') && !G.ITEMS[sp.id] && !['hp_up', 'heart_up', 'mp_up'].includes(sp.id)) problem(id + ': unknown item ' + sp.id);
    if (sp.t === 'lore' && !(G.LORE && G.LORE[sp.id])) warn(id + ': lore "' + sp.id + '" missing');
    if (sp.t === 'trigger' && !(G.SCENES && G.SCENES[sp.scene])) warn(id + ': scene "' + sp.scene + '" missing');
    if (sp.t === 'portal' && !G.world.rooms[sp.to]) problem(id + ': portal to unknown room ' + sp.to);
    if (sp.t === 'tome' && !G.SPELLS[sp.spell]) problem(id + ': unknown spell ' + sp.spell);
  }
}

// ---------------------------------------------------------------- door alignment
function openAt(def, tx, ty) {
  const ch = def._rows[ty] && def._rows[ty][tx];
  return ch !== undefined && G.world.charOpen(ch);
}
for (const id of G.world.order) {
  const def = G.world.rooms[id];
  const tw = def.w * CW, th = def.h * CH;
  for (const d of def._doors) {
    if (!d.to) {
      if (!def.outdoor && !def.noValidate) warn(id + ': opening ' + d.side + d.cell + ' leads nowhere');
      continue;
    }
    const nd = G.world.rooms[d.to];
    // compare the opening tile set with the neighbour's facing edge
    if (d.side === 'L' || d.side === 'R') {
      const gx = d.side === 'L' ? def.x * CW - 1 : (def.x + def.w) * CW; // global tile x in neighbour
      const nx = gx - nd.x * CW;
      for (let ty = d.cell * CH; ty < (d.cell + 1) * CH; ty++) {
        const here = openAt(def, d.side === 'L' ? 0 : tw - 1, ty);
        const gy = def.y * CH + ty, ny = gy - nd.y * CH;
        const there = openAt(nd, nx, ny);
        if (here && !there) problem(id + ': door ' + d.side + d.cell + ' row ' + ty + ' is open but ' + d.to + ' is solid there');
      }
    } else {
      const gy = d.side === 'T' ? def.y * CH - 1 : (def.y + def.h) * CH;
      const ny = gy - nd.y * CH;
      for (let tx = d.cell * CW; tx < (d.cell + 1) * CW; tx++) {
        const here = openAt(def, tx, d.side === 'T' ? 0 : th - 1);
        const gx = def.x * CW + tx, nx = gx - nd.x * CW;
        const there = openAt(nd, nx, ny);
        if (here && !there) problem(id + ': door ' + d.side + d.cell + ' col ' + tx + ' is open but ' + d.to + ' is solid there');
      }
    }
  }
}

// ---------------------------------------------------------------- traversal simulation
function makeRoom(def, A) {
  const r = new G.world.Room(def);
  for (let i = 0; i < r.tiles.length; i++) {
    const t = r.tiles[i];
    if (t === T.SEAL && A.crest) r.tiles[i] = T.EMPTY;
    else if (t === T.INK) r.tiles[i] = A.lantern ? T.ONEWAY : T.EMPTY;
    else if (t === T.BREAK) r.tiles[i] = T.EMPTY;
  }
  return r;
}
function doorOf(room, cx, cy) {
  if (cx < 0) return 'L' + Math.floor(cy / 224);
  if (cx >= room.pw) return 'R' + Math.floor(cy / 224);
  if (cy < 0) return 'T' + Math.floor(cx / 384);
  if (cy >= room.ph) return 'B' + Math.floor(cx / 384);
  return null;
}

// one simulated trajectory for a ground form. Returns {land:[x,y]|null, exit:door|null}
function simulate(room, body0, form, A, plan) {
  const b = Object.assign({}, body0);
  if (plan.drop) {
    // only one-way platforms can be dropped through
    const ty = Math.floor((b.y + b.h + 1) / 16);
    const t1 = room.get(Math.floor((b.x + 1) / 16), ty), t2 = room.get(Math.floor((b.x + b.w - 1) / 16), ty);
    if (!((t1 === T.ONEWAY || t2 === T.ONEWAY) && (t1 === T.ONEWAY || t1 === T.EMPTY) && (t2 === T.ONEWAY || t2 === T.EMPTY))) return {};
  }
  b.dropT = plan.drop ? 14 : 0;
  if (plan.drop) {
    b.y += 2;
    b.onGround = false;
  }
  const jumpV = form === 'wolf' ? 6.1 : 6.75;
  const spd = form === 'wolf' ? 3.7 : 2.0;
  let airJumps = 0, left = false;
  const maxF = plan.frames || 150;
  for (let f = 0; f < maxF; f++) {
    const dir = f >= (plan.delay || 0) ? plan.dir : 0;
    b.vx = dir * spd;
    const hold = f < (plan.hold || 0);
    if (f === 0 && plan.jump && b.onGround) {
      b.vy = -jumpV;
      b.onGround = false;
    }
    if (form === 'human' && A.dj && plan.dj && f === plan.dj && !b.onGround && airJumps < 1) {
      b.vy = -5.8;
      airJumps++;
    }
    const djHold = plan.dj && f >= plan.dj && f < plan.dj + (plan.hold2 || 30);
    let gm = 1;
    if (b.vy < 0 && !hold && !djHold) gm = form === 'wolf' ? 2.2 : 2.3;
    b.vy = Math.min(b.vy + 0.3 * gm, 7);
    if (b.dropT > 0) b.dropT--;
    P.move(b, room);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const door = doorOf(room, cx, cy);
    if (door) return { exit: door };
    if (!b.onGround) left = true;
    if (b.onGround && (left || f > 0) && (plan.jump || plan.drop || left || f >= (plan.walk || 0))) {
      if (left || plan.walk) return { land: [b.x, b.y], body: b };
    }
  }
  return b.onGround ? { land: [b.x, b.y], body: b } : {};
}

function nodeKey(form, b) {
  return form + ':' + Math.floor((b.x + b.w / 2) / 12) + ',' + Math.round((b.y + b.h) / 6);
}

const PLANS = [];
for (const dir of [-1, 0, 1]) {
  PLANS.push({ dir, walk: 10, frames: 10 }); // short walk
  PLANS.push({ dir, walk: 24, frames: 60 }); // walk off ledges
  for (const hold of [5, 12, 40])
    for (const delay of [0, 12])
      for (const dj of [0, 10, 18, 27]) {
        if ((dj && hold < 12) || (delay && dir === 0)) continue;
        PLANS.push({ dir, jump: true, hold, delay, dj });
      }
  PLANS.push({ dir, drop: true, frames: 80 });
}

function explore(room, A, starts) {
  // returns {nodes:Map, exits:Set, positions:[]}
  const nodes = new Map();
  const exits = new Set();
  const q = [];
  const forms = ['human'].concat(A.wolf ? ['wolf'] : []);
  const dims = { human: [12, 40], wolf: [24, 14] };
  function fits(form, cx, fy) {
    const [w, h] = dims[form];
    return !P.rectSolid(room, cx - w / 2, fy - h, w, h, {});
  }
  function add(form, b) {
    const k = nodeKey(form, b);
    if (nodes.has(k)) return;
    nodes.set(k, { form, x: b.x, y: b.y, w: b.w, h: b.h });
    q.push(k);
  }
  for (const s of starts) {
    for (const form of forms) {
      const [w, h] = dims[form];
      const b = { x: s.cx - w / 2, y: s.fy - h, w, h, vx: 0, vy: s.vy || 0, onGround: false };
      if (P.rectSolid(room, b.x, b.y, w, h, {})) continue;
      if (s.plans) {
        for (const pl of s.plans) {
          const r = simulate(room, b, form, A, Object.assign({ frames: 160 }, pl));
          if (r.exit) exits.add(r.exit);
          if (r.land) add(form, r.body);
        }
      } else {
        // settle
        const r = simulate(room, b, form, A, { dir: 0, frames: 120, walk: 1 });
        if (r.land) add(form, r.body);
      }
    }
  }
  let guard = 0;
  while (q.length && guard++ < 6000) {
    const k = q.shift();
    const n = nodes.get(k);
    const base = { x: n.x, y: n.y, w: n.w, h: n.h, vx: 0, vy: 0, onGround: true };
    for (const pl of PLANS) {
      const r = simulate(room, base, n.form, A, pl);
      if (r.exit) exits.add(r.exit);
      else if (r.land) add(n.form, r.body);
    }
    // form changes in place
    for (const f2 of forms) {
      if (f2 === n.form) continue;
      const cx = n.x + n.w / 2, fy = n.y + n.h;
      if (fits(f2, cx, fy)) {
        const [w, h] = dims[f2];
        add(f2, { x: cx - w / 2, y: fy - h, w, h });
      }
    }
  }
  return { nodes, exits };
}

// free-flight flood fill for bat (and mist through grates)
function flyExplore(room, A, starts) {
  const step = 6;
  const seen = new Set(), exits = new Set();
  const q = [];
  const sz = A.mist ? [16, 14] : [14, 12];
  const body = { mist: !!A.mist };
  const push = (x, y) => {
    const k = Math.round(x / step) + ',' + Math.round(y / step);
    if (seen.has(k)) return;
    seen.add(k);
    q.push([x, y]);
  };
  for (const s of starts) push(s.cx, s.fy - 10);
  let guard = 0;
  const pts = [];
  while (q.length && guard++ < 200000) {
    const [x, y] = q.shift();
    const d = doorOf(room, x, y);
    if (d) {
      exits.add(d);
      continue;
    }
    if (P.rectSolid(room, x - sz[0] / 2, y - sz[1] / 2, sz[0], sz[1], body)) continue;
    pts.push([x, y]);
    push(x + step, y);
    push(x - step, y);
    push(x, y + step);
    push(x, y - step);
  }
  return { exits, pts };
}

function doorStart(room, def, d) {
  const tw = def.w * CW, th = def.h * CH;
  if (d.side === 'L' || d.side === 'R') {
    const fy = (d.cell * CH + 12) * TS;
    return { cx: d.side === 'L' ? 10 : room.pw - 10, fy };
  }
  const cx = (d.cell * CW + 12) * TS;
  if (d.side === 'T') return { cx, fy: 44, vy: 2, plans: [{ dir: 0, frames: 200, walk: 1 }, { dir: 1, frames: 200, walk: 1 }, { dir: -1, frames: 200, walk: 1 }] };
  const plans = [];
  for (const dir of [-1, 0, 1]) for (const dj of [0, 6, 14, 22]) for (const delay of [0, 10]) plans.push({ dir, jump: false, hold: 40, dj, delay, frames: 160 });
  // arrival from below: feet just inside the bottom edge, rising as in game.js checkExit()
  return { cx, fy: room.ph - 2, vy: -6, plans };
}

function reachSet(def, lvl, fromDoor) {
  const A = ab(lvl);
  const room = makeRoom(def, A);
  const doors = def._doors.filter((d) => d.to || def.outdoor);
  const starts = [];
  if (fromDoor === 'spawn') {
    const sp = room.spawns.find((s) => s.t === 'start' || s.t === 'save');
    if (sp) starts.push({ cx: sp.x, fy: sp.y });
  } else {
    const d = doors.find((d) => d.side + d.cell === fromDoor);
    if (d) starts.push(doorStart(room, def, d));
  }
  const res = explore(room, A, starts);
  let pts = [];
  if (A.bat || A.mist) {
    const f = flyExplore(room, A, starts.map((s) => ({ cx: s.cx, fy: s.vy < 0 ? room.ph - 6 : s.fy })));
    // also take off from any ground node
    const extra = [];
    for (const n of res.nodes.values()) extra.push({ cx: n.x + n.w / 2, fy: n.y + n.h });
    const f2 = flyExplore(room, A, extra.slice(0, 400));
    if (A.bat) {
      f.exits.forEach((e) => res.exits.add(e));
      f2.exits.forEach((e) => res.exits.add(e));
    } else {
      // mist only drifts slowly and drains MP: count exits through grates as reachable too
      f.exits.forEach((e) => res.exits.add(e));
      f2.exits.forEach((e) => res.exits.add(e));
    }
    pts = f.pts.concat(f2.pts);
  }
  res.fly = pts;
  res.room = room;
  return res;
}

function itemReachable(res, sp, A) {
  const ix = sp.x, iy = sp.y - 8;
  for (const n of res.nodes.values()) {
    const cx = n.x + n.w / 2, fy = n.y + n.h;
    if (Math.abs(cx - ix) <= 18 && iy <= fy + 4 && iy >= fy - n.h - (A.dj ? 120 : 70)) return true;
  }
  for (const [x, y] of res.fly || []) if (Math.abs(x - ix) <= 12 && Math.abs(y - iy) <= 12) return true;
  return false;
}

const ids = only.length ? only : G.world.order;
for (const id of ids) {
  const def = G.world.rooms[id];
  if (!def) {
    console.log('no room ' + id);
    continue;
  }
  if (def.noValidate) continue;
  const lvl = def.lvl || 0;
  const gates = def.gates || {};
  const doors = def._doors.filter((d) => d.to);
  const names = doors.map((d) => d.side + d.cell);
  const entry = def.entry || (def._feat && def._feat.start ? 'spawn' : names[0]);
  if (!entry) continue;
  const before = problems + warnings;
  const lvlOf = (k) => (gates[k] != null ? gates[k] : lvl);
  // from the entry, at each relevant level
  const levels = [...new Set([lvl].concat(Object.values(gates)))].sort();
  const reach = {};
  for (const L of levels) reach[L] = reachSet(def, L, entry);
  for (const n of names) {
    if (n === entry) continue;
    const L = lvlOf(n);
    if (!reach[L].exits.has(n)) problem(id + ': door ' + n + ' unreachable from ' + entry + ' at level ' + L);
  }
  // return trip: from each non-gated, non-oneway door back to the entry
  if (entry !== 'spawn')
    for (const n of names) {
      if (n === entry || (def.oneway || []).includes(n)) continue;
      const L = lvlOf(n);
      const back = reachSet(def, Math.max(L, lvlOf(entry)), n);
      if (!back.exits.has(entry) && !(def.oneway || []).includes(entry)) problem(id + ': cannot get back from ' + n + ' to ' + entry + ' at level ' + Math.max(L, lvlOf(entry)));
    }
  // items & interactables
  for (const sp of reach[lvl].room.spawns) {
    if (!['item', 'relic', 'save', 'teleport', 'tome', 'npc', 'shop', 'portal', 'lore'].includes(sp.t)) continue;
    const key = sp.t === 'item' || sp.t === 'relic' ? 'item:' + sp.id : sp.t;
    const L = lvlOf(key);
    const res = reach[L] || reachSet(def, L, entry);
    if (!itemReachable(res, sp, ab(L))) (sp.hidden ? warn : problem)(id + ': ' + sp.t + ' ' + (sp.id || '') + ' at ' + sp.tx + ',' + sp.ty + ' unreachable at level ' + L);
  }
  if (verbose) {
    const res = reach[lvl];
    const rows = def._rows.map((r) => r.split(''));
    for (const n of res.nodes.values()) {
      const tx = Math.floor((n.x + n.w / 2) / 16), ty = Math.floor((n.y + n.h - 1) / 16);
      if (rows[ty] && rows[ty][tx] === '.') rows[ty][tx] = n.form === 'wolf' ? 'w' : '•';
    }
    console.log('\n' + id + ' (lvl ' + lvl + ', entry ' + entry + ') exits: ' + [...res.exits].join(' '));
    console.log(rows.map((r) => r.join('')).join('\n'));
  }
  if (problems + warnings > before) report.push('');
}

// ---------------------------------------------------------------- global progression
// Rooms are nodes; a door can be crossed at level max(room lvl, its gate). Portals link the maps.
if (!only.length) {
  const adj = {};
  const add = (a, b, L) => (adj[a] = adj[a] || []).push([b, L]);
  for (const id of G.world.order) {
    const def = G.world.rooms[id];
    const lvl = def.lvl || 0;
    const gates = def.gates || {};
    for (const d of def._doors) {
      if (!d.to) continue;
      const k = d.side + d.cell;
      add(id, d.to, Math.max(lvl, gates[k] != null ? gates[k] : lvl));
    }
    for (const sp of new G.world.Room(def).spawns) if (sp.t === 'portal' && G.world.rooms[sp.to]) add(id, sp.to, lvl);
  }
  const reachAt = (L) => {
    const seen = new Set(['ent_gate']);
    const q = ['ent_gate'];
    while (q.length) {
      const a = q.shift();
      for (const [b, need] of adj[a] || []) {
        if (need > L || seen.has(b)) continue;
        // entering b also requires b's own arrival level
        const nb = G.world.rooms[b];
        if ((nb.lvl || 0) > L) continue;
        seen.add(b);
        q.push(b);
      }
    }
    return seen;
  };
  const RELIC_LVL = { leap_stone: 1, soul_wolf: 2, form_mist: 3, belmont_crest: 4, soul_bat: 5, lantern: 6 };
  for (let L = 0; L <= 6; L++) {
    const seen = reachAt(L);
    for (const id of G.world.order) {
      const def = G.world.rooms[id];
      if ((def.lvl || 0) === L && !seen.has(id)) problem('[progression] ' + id + ' (lvl ' + L + ') is not reachable from ent_gate with level-' + L + ' abilities');
    }
  }
  // each ability relic must be obtainable with the previous level
  const relicRoom = {};
  for (const id of G.world.order) {
    const def = G.world.rooms[id];
    for (const sp of new G.world.Room(def).spawns) if (sp.t === 'relic') relicRoom[sp.id] = id;
  }
  const bossRelic = { leap_stone: 'gal_boss', soul_wolf: 'stk_doppel', belmont_crest: 'hun_echo' };
  for (const r in RELIC_LVL) {
    const room = relicRoom[r] || bossRelic[r];
    if (!room || !G.world.rooms[room]) {
      warn('[progression] relic ' + r + ' is not placed yet');
      continue;
    }
    if (!reachAt(RELIC_LVL[r] - 1).has(room)) problem('[progression] relic ' + r + ' (' + room + ') needs level ' + (RELIC_LVL[r] - 1) + ' but is not reachable then');
  }
  for (const page of [['page2', 'vault_worm'], ['page3', 'clk_top'], ['final', 'keep_throne']]) {
    if (G.world.rooms[page[1]] && !reachAt(5).has(page[1])) problem('[progression] ' + page[1] + ' unreachable at level 5');
  }
}

console.log(report.join('\n'));
console.log('Rooms: ' + G.world.order.length + ' | cells castle ' + G.world.maps.castle.total + ', archives ' + G.world.maps.archives.total);
console.log(problems ? '✗ ' + problems + ' problem(s), ' + warnings + ' warning(s)' : '✓ no problems (' + warnings + ' warnings)');
process.exitCode = problems ? 1 : 0;
