// Renders every room in full (far layer + background + tiles + entity markers) to PNG
// files for layout review: node tools/roommaps.js [outdir]   (ROOMS=a,b to limit)
// Entities are drawn as labelled boxes: enemies red, items gold, save/teleport blue,
// npc/lore/tome green.  Requires the global Playwright install.
const path = require('path');
const fs = require('fs');
let pw;
try {
  pw = require('playwright');
} catch (e) {
  pw = require('/opt/node22/lib/node_modules/playwright');
}
const ROOT = path.resolve(__dirname, '..');
const outDir = process.argv[2] || path.join(process.env.SHOT_DIR || '/tmp', 'elegy-rooms');
fs.mkdirSync(outDir, { recursive: true });

function findChrome() {
  const base = '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(base)) {
      const p = path.join(base, d, 'chrome-linux', 'chrome');
      if (d.startsWith('chromium-') && fs.existsSync(p)) return p;
    }
  } catch (e) {}
  return undefined;
}

(async () => {
  const browser = await pw.chromium.launch({ executablePath: findChrome() });
  const page = await browser.newPage({ viewport: { width: 800, height: 480 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('[console] ' + m.text());
  });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForTimeout(800);
  const ids = await page.evaluate(() => window.G.world.order.slice());
  const list = process.env.ROOMS ? process.env.ROOMS.split(',') : ids;
  for (const id of list) {
    const url = await page.evaluate((id) => {
      const G = window.G;
      const s = G.newState();
      s.room = id;
      s.relics = {};
      G.continueGame(s);
      G.ui.closeAll && G.ui.closeAll();
      const g = G.game, room = g.room;
      const c = document.createElement('canvas');
      c.width = room.pw;
      c.height = room.ph;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      if (room.needsFar && G.drawFar) {
        // tile the far layer under the whole room
        for (let y = 0; y < room.ph; y += G.H)
          for (let x = 0; x < room.pw; x += G.W) {
            ctx.save();
            ctx.translate(x, y);
            try {
              G.drawFar(ctx, room.def.far || room.theme.far, x, y, 0);
            } catch (e) {}
            ctx.restore();
          }
      }
      if (room.bgCanvas) ctx.drawImage(room.bgCanvas, 0, 0);
      if (room.fgCanvas) ctx.drawImage(room.fgCanvas, 0, 0);
      // cell grid
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      for (let x = 0; x <= room.pw; x += G.CELL_PX_W) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, room.ph);
        ctx.stroke();
      }
      for (let y = 0; y <= room.ph; y += G.CELL_PX_H) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(room.pw, y + 0.5);
        ctx.stroke();
      }
      ctx.font = '8px monospace';
      const col = (t) =>
        t === 'enemy' ? '#ff4040' : t === 'item' || t === 'relic' || t === 'subweapon' ? '#ffd040' : t === 'save' || t === 'teleport' || t === 'portal' ? '#40a0ff' : '#40ff80';
      for (const sp of room.spawns) {
        const w = 14, h = 20;
        ctx.strokeStyle = col(sp.t);
        ctx.strokeRect(sp.x - w / 2 + 0.5, sp.y - h + 0.5, w, h);
        ctx.fillStyle = col(sp.t);
        ctx.fillText(String(sp.id || sp.item || sp.relic || sp.sub || sp.scene || sp.t).slice(0, 14), sp.x - w / 2, sp.y - h - 2);
      }
      return c.toDataURL('image/png');
    }, id);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(outDir, id + '.png'), buf);
  }
  console.log('rendered', list.length, 'rooms to', outDir);
  if (errors.length) console.log(errors.slice(0, 20).join('\n'));
  await browser.close();
})();
