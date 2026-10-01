// Headless test driver: loads the game, runs a scenario, saves screenshots and
// prints console errors.  Usage: node tools/shot.js <scenario> [outdir]
// Requires the global Playwright install (NODE_PATH=/opt/node22/lib/node_modules).
const path = require('path');
const fs = require('fs');
let pw;
try {
  pw = require('playwright');
} catch (e) {
  pw = require('/opt/node22/lib/node_modules/playwright');
}

const ROOT = path.resolve(__dirname, '..');
const scenario = process.argv[2] || 'title';
const outDir = process.argv[3] || path.join(process.env.SHOT_DIR || '/tmp', 'elegy-shots');
fs.mkdirSync(outDir, { recursive: true });

function findChrome() {
  const base = '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(base)) {
      if (d.startsWith('chromium-')) {
        const p = path.join(base, d, 'chrome-linux', 'chrome');
        if (fs.existsSync(p)) return p;
      }
    }
  } catch (e) {}
  return undefined;
}

(async () => {
  const browser = await pw.chromium.launch({ executablePath: findChrome(), args: ['--autoplay-policy=no-user-gesture-required'] });
  const vp = (process.env.VIEWPORT || '1152x672').split('x').map(Number);
  const mobile = !!process.env.MOBILE;
  const page = await browser.newPage({ viewport: { width: vp[0], height: vp[1] }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push('[' + m.type() + '] ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  const url = 'file://' + path.join(ROOT, process.env.PAGE || 'index.html');
  await page.goto(url);
  await page.waitForTimeout(800);
  const shot = async (name) => {
    const f = path.join(outDir, scenario + '_' + name + '.png');
    await page.screenshot({ path: f });
    console.log('shot', f);
  };
  const key = async (k, ms) => {
    await page.keyboard.down(k);
    await page.waitForTimeout(ms || 60);
    await page.keyboard.up(k);
  };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const ctx = { page, shot, key, ev, wait: (ms) => page.waitForTimeout(ms) };
  try {
    const sc = require('./scenarios.js')[scenario];
    if (!sc) throw new Error('unknown scenario ' + scenario);
    await sc(ctx);
  } catch (e) {
    errors.push('[driver] ' + e.message);
  }
  console.log('--- console errors/warnings (' + errors.length + ') ---');
  errors.slice(0, 40).forEach((e) => console.log(e));
  await browser.close();
})();
