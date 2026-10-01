# Elegy of the Night — engine guide for contributors

Browser game, no build step, classic `<script>` files sharing the global `G`
(see the order in `index.html`). Everything (art, music) is generated at runtime.
Internal resolution **384×224**, tiles **16 px**, one map cell (= one screen) is
**24×14 tiles**. 60 fps fixed step.

## Files you will touch
| File | Owner | Content |
|---|---|---|
| `js/rooms_castle.js` | castle-rooms agent (Entrance section is done) | castle rooms |
| `js/rooms_archives.js` | archives-rooms agent | Belmont Archives rooms |
| `js/data_enemies.js` | enemies agent (4 examples exist: ghoul, night_bat, bone_scribe, warg) | regular enemies |
| `js/data_bosses.js` | bosses agent | the 6 bosses |

Do **not** edit engine files (`world.js`, `physics.js`, `game.js`, `player*.js`, `enemy_base.js`,
`entities.js`, `ui.js`, `tiles.js`, …). If you truly need an engine change, keep it tiny and additive,
and list it explicitly in your final report.

## Rooms (`G.R` builder, `js/roombuilder.js`)
```js
G.R({ id:'gal_hall', area:'gallery', x:16, y:16, w:4, h:3, lvl:0, gates:{L0:1, R0:1} }, (b) => {
  b.shell();                // solid frame: 1-tile side walls, 2-tile ceiling and floor
  b.door('L', 2); b.door('R', 2); b.door('L', 0); b.door('R', 0);
  b.cellFloor(1, 30, 60);   // a floor at cell-row 1 level (rows 26-27) from col 30 to 60
  b.fill(x0,y0,x1,y1);      // solid rectangle (inclusive), b.fill(...,'B') breakable, 'X' seal, 'G' grate, '^' spikes, '~' water, 'I' ink walkway
  b.clear(x0,y0,x1,y1);     // carve empty space
  b.stairs(x, y, n, 'r');   // '/' going up-right from (x,y): (x+i, y-i). 'l' = '\' going up-left
  b.plat(x0, x1, y);        // one-way platform '=' (jump through from below, ↓+jump to drop)
  b.stamp(x, y, ['..##', '####']); // ASCII overlay (spaces are skipped)
  // entities: (x, y) = the tile the entity STANDS IN (its feet rest on the bottom of that tile),
  // so for a floor whose top row is R, place grounded things at row R-1.
  b.enemy(x, y, 'ghoul');   b.boss(x, y, 'colossus');
  b.candle(x, y[, drop]);   // drop: 'heart' | 'heart_big' | 'gold' | 'gold:250' | 'sub:axe' | 'item:potion' | item id
  b.item(x, y, 'potion');   b.relic(x, y, 'leap_stone');   b.hidden(x, y, 'pheasant') // item inside a breakable block
  b.item(x, y, 'hp_up')     // also 'heart_up', 'mp_up' (max HP / hearts / MP vessels)
  b.save(x, y); b.tp(x, y); b.lore(x, y, 'arc_oath'); b.tome(x, y, 'ink_lance');
  b.npc(x, y, 'maria', {scene:'maria_gallery', scene2:'maria_again'}); b.shop(x, y);
  b.portal(x, y, 'arc_entry', tx, ty);  // book portal to another room (tile position of arrival)
  b.trigger(x, y, 'scene_id', tilesWide, tilesHigh);  // plays a story scene once
  b.mplat(x, y, {dx:4, dy:0, len:3, period:240});     // moving platform (one-way top)
  b.sub(x, y, 'cross');     // a sub-weapon lying on a pedestal
});
```
Room meta: `id, area, x, y, w, h` (cells, on the map grid), optional `lvl, entry, gates, oneway`
(validator), `music` (override), `darkness` 0..1, `outdoor:true`, `weather:'rain'`,
`decor:[...]` (override background decorations), `noDecor:true`, `far:'night'|'void'|'redmoon'|'cave'`,
`onEnter(g, room)`.

### Doors (must match the plan in `docs/WORLD.md`)
* Side doors `b.door('L'|'R', cellRow)`: open rows `cellRow*14+8 .. +11` at the edge, floor at rows
  `cellRow*14+12..13`. So the floor in front of a side door is always the bottom of that cell.
* Top/bottom doors `b.door('T'|'B', cellCol)`: open columns `cellCol*24+10 .. +13`.
* The room border must be solid everywhere except real doors (openings with no neighbour block the
  player and the validator warns).
* Going **up** through a T door the game gives the player a small upward boost, but the room above
  must have something to land on next to the hole (a ledge within 3–4 tiles), otherwise the player
  falls straight back down. Coming **down** through a B door the player falls in from the top.

### What Alucard can do (design rules)
| | reach |
|---|---|
| walk | 2 px/frame; player box 12×40 px (needs 3 free tiles of height) |
| single jump | climbs ledges **≤ 4 tiles** high; clears gaps **≤ 5 tiles** wide |
| double jump (Leap Stone, lvl ≥ 1) | ledges **≤ 7 tiles**; gaps ≤ 8 |
| wolf (lvl ≥ 2) | box 24×14: passes **1-tile-high** tunnels; jump ≈ 3 tiles; fast |
| mist (lvl ≥ 3) | floats, passes **grates `G`** (and only mist does) |
| Belmont Crest (lvl ≥ 4) | seals **`X`** vanish |
| bat (lvl ≥ 5) | flies anywhere a 1-tile gap allows |
| Lantern (lvl 6) | invisible-ink walkways **`I`** become one-way platforms |
| Gravity Boots (optional) | ↓↑+jump: super jump ≈ 14 tiles |

Stairs: diagonal `/` `\` slopes. Walking into the low end climbs them; you can walk *under* the high
end; jumping up through stairs from below is allowed. **A staircase whose low end touches a floor that
the player must walk along blocks that floor in one direction** (walking into it climbs it). So for
freestanding stairs over a path, start the low end **one tile above the floor** (e.g. floor top row 26
→ first step at row 24): the floor stays walkable both ways and the player hops onto the first step.
Stairs that rise from a dead-end corner can start at floor level. Breakable walls `B` are broken by attacks (validator treats them as open).

Level design style (SotN): wide horizontal halls with 2–3 floor heights, platforms, stairs, pillars,
alcoves with candles; tall shafts with alternating ledges; secrets behind `B` walls (food, vessels);
save rooms are small 1×1 rooms; enemies placed on floors/platforms with room to fight. Keep at least
3 tiles of headroom on paths. Candles every ~10–15 tiles, some with fixed drops.

### Validate & look
```
node tools/validate.js                # all rooms: format, door alignment, reachability per level
node tools/validate.js gal_hall -v    # one room + ASCII map of reachable standing spots
NODE_PATH=/opt/node22/lib/node_modules SHOT_DIR=<scratch> ROOMS=gal_hall,gal_east node tools/shot.js tour
NODE_PATH=... SHOT_DIR=<scratch> GEAR=all SCRIPT="room:gal_hall@5,40;down:ArrowRight;wait:900;up:ArrowRight;shot:a" node tools/shot.js script
```
`lvl` = ability level on arrival (0 none, 1 double jump, 2 +wolf, 3 +mist, 4 +crest, 5 +bat, 6 +lantern).
`gates` = doors/items that need a higher level, e.g. `{R0:1, 'item:hp_up':5}`. `entry` = usual entrance
door (default: first door). `oneway:['B1']` for doors you only leave through. The validator must report
**no problems** for your rooms (warnings about enemies not yet defined are fine).

## Enemies (`G.defEnemy`, `js/enemy_base.js`)
```js
G.defEnemy('marionette', {
  name:{en,es}, desc:{en,es}, area:'gallery',
  hp, atk, def, exp, w, h,          // hitbox in px (feet at the bottom)
  gold:[min,max], drops:[{id:'potion', p:0.05}],   // ids from js/data_items.js (or 'heart', 'gold:50')
  weak:['holy'], resist:['cut'], absorb:[], immune:['poison'],
  el:'cut',                          // element of contact damage
  flying:false, heavy:false,         // heavy: no knockback/stun
  touch:true,                        // contact damage
  bony / armored : true,             // hit sound
  noBlood, blood:'#hex', stunTime,
  init(e, g){}, ai(e, g){}, draw(e, ctx, sx, sy){}, onHit(e, hit, g){}, onDeath(e, g){},
  previewState:'walk',               // state used to draw the bestiary preview (if the initial state is invisible)
});
```
Instance helpers: `e.move()` (gravity + tiles), `e.drift()` (no collision), `e.face()`, `e.dxp()`, `e.dyp()`,
`e.dist()`, `e.seesPlayer(range)`, `e.onScreen()`, `e.setState(s)` + `e.state` / `e.stT` (frames in state),
`e.t`, `e.facing`, `e.rnd` (seeded RNG), `e.shoot({x,y,vx,vy,w,h,dmg,el,grav,life,kind:'orb'|'bone',
color, wall, pierce, status:'poison', chance, magic, unblockable, upd(p,g), drawFn(p,ctx,sx,sy)})`,
`e.hurtPlayer(dmg, el, opts)`, `e.player`, `e.contact` (toggle contact damage), `e.alpha`,
`e.invuln` (frames), `e.flying`. Physics helpers: `G.phys.blockedAhead(room, e, dir) → {wall, ledge}`,
`G.phys.solidAt(room, px, py)`, `G.phys.floorAt(room, px, py)`, `G.phys.los(room, x1,y1,x2,y2)`.
Effects: `G.fx.burst(x,y,col,n,spd)`, `G.fx.spark`, `G.fx.dust`, `G.fx.explode(x,y,scale)`,
`G.fx.debris`, `G.fx.particle(x,y,vx,vy,col,life,{glow,grav,size})`, `G.gfx.shake(mag,frames)`,
`G.gfx.flash(col,frames)`, `G.gfx.addLight(sx, sy, radius, color, intensity)` (screen coords, call in draw).
Sounds: `G.audio.sfx(name, {vol, pitch})` — names listed in `js/audio.js` (`G.audio.listSfx()`), e.g.
`hit_flesh, hit_metal, hit_bone, enemy_die, explosion, fireball, projectile, magic_cast, bone_rattle,
ghost_wail, bat_screech, slime, page_flutter, ink_splash, roar, stomp, gear, water_splash, thunder`.

### Art pipeline
Draw procedurally with canvas 2D into a cached sprite, which is then snapped to your palette with a
1-px dark outline so it reads as pixel art:
```js
const img = G.gfx.sprite('marionette_' + frame, 32, 48, (c) => { /* draw with c (CanvasRenderingContext2D) */ },
                        { palette: ['#hex', ...], outline: '#07050b', threshold: 100 });
e.blit(ctx, img, sx, sy, anchorX, anchorY, e.facing < 0);   // honours the white hit-flash
```
Quantise animation into a few frames (cache keys must be finite). Helpers: `G.gfx.limb(c,x1,y1,x2,y2,w,col)`,
`G.gfx.poly(c,[x,y,...],col)`, `G.gfx.circle(c,x,y,r,col)`, `G.gfx.ellipse(c,x,y,rx,ry,rot,col)`.
Draw facing **right**; flipping is automatic. `sx, sy` = screen position of the feet centre.
Look at `js/data_enemies.js` (ghoul, bat, bone scribe, warg) and `js/player_art.js` for the style:
gothic, readable silhouettes, 3–5 tones per material, no anti-aliasing mush.

## Bosses
Same API with `boss:true`. The boss sleeps until the player is near (`wakeDist`, default 150 px, or a
custom `wake(e,g)`), optionally plays `introScene` (id in `G.SCENES`), then the arena doors close,
the boss music starts and `ai` runs. HP bar is automatic. On death the engine sets flag `boss_<id>`,
reopens the doors, plays a fanfare and spawns `reward: {relic:'leap_stone', items:['page2'], scene:'echo_post'}`.
Optional hooks: `idle(e,g)` while asleep, `onStart(e,g)`, `music:'boss'|'boss_final'`.
Use `e.hurtbox()` override for odd shapes (return `{x,y,w,h}`), `onHitCheck(e, hit, g) → false` to ignore
hits (e.g. invulnerable phases), extra hitboxes via `e.hurtPlayer()` in `ai`.

## Testing
`node tools/validate.js` (no browser) and `tools/shot.js` (headless Chromium screenshots; look at them!).
Do not run git commands that change the repository.
