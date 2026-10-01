#!/usr/bin/env node
/*
 * Verification for the Elegy of the Night audio system (js/music.js + js/audio.js).
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/test_audio.js [--seconds=12] [--full] [--skip-live]
 *
 * 1. Loads both files in a Node `vm` context with a minimal fake window (no Web Audio, no TTS),
 *    in both load orders, and checks every public function is a safe no-op.
 * 2. Opens tools/audio_test.html in headless Chromium (Playwright): no console/page errors,
 *    music data validates, every track and every sfx renders offline -> {peak, rms};
 *    flags silent (rms ~ 0) and clipping (peak > 1.0) outputs; also reports the pre-limiter peak.
 * 3. Exercises the live API (unlock, crossfade, rate limiting, voice cap, duck, TTS fallback).
 * Exit code 1 on any failure.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
function opt(k, d) { const a = args.find(x => x === '--' + k || x.startsWith('--' + k + '=')); if (!a) return d; const v = a.split('=')[1]; return v === undefined ? true : v; }
const SECONDS = +opt('seconds', 12);
const FULL = !!opt('full', false);
const SKIP_LIVE = !!opt('skip-live', false);

const REQUIRED_MUSIC = ['title', 'prologue', 'entrance', 'gallery', 'library', 'archives', 'archives_deep', 'caverns', 'clocktower',
  'catacombs', 'chapel', 'keep', 'boss', 'boss_final', 'save', 'shop', 'gameover', 'ending'];
const REQUIRED_SFX = ('menu_move menu_select menu_cancel menu_open menu_error text_blip pause jump double_jump land backdash step super_jump ' +
  'swing_light swing_heavy whip punch hit_flesh hit_metal hit_bone crit block player_hurt player_die heal mp_restore level_up status_poison ' +
  'status_curse petrify enemy_die enemy_die_big explosion fireball projectile magic_cast bone_rattle ghost_wail bat_screech slime page_flutter ' +
  'ink_splash roar boss_die gear water_splash thunder stomp heart heart_big gold item_get relic_get door break_wall candle_break save teleport ' +
  'portal secret chest seal_break lever dagger_throw axe_throw holy_water cross_throw stopwatch quill_throw ink_bottle page_orbit spell_fire ' +
  'spell_dark spell_spirit spell_soul_steal spell_holy spell_ink transform bat_flap mist wolf_howl wolf_dash fanfare low_health').split(' ');
const API = ['unlock', 'isUnlocked', 'setVolume', 'getVolume', 'playMusic', 'stopMusic', 'currentMusic', 'duck', 'sfx', 'say',
  'stopSpeech', 'speechAvailable', 'setVoiceEnabled', 'listMusic', 'listSfx', '_renderOffline'];

let failures = 0, warnings = 0;
function fail(m) { failures++; console.log('  FAIL ' + m); }
function warn(m) { warnings++; console.log('  WARN ' + m); }
function ok(m) { console.log('  ok   ' + m); }
function check(cond, m) { if (cond) ok(m); else fail(m); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------------ 1. Node vm
async function phaseVm() {
  console.log('\n[1] Node vm context: no AudioContext, no speechSynthesis');
  for (const order of [['music.js', 'audio.js'], ['audio.js', 'music.js']]) {
    const logs = [];
    const fakeConsole = { log() {}, info() {}, warn: (...a) => logs.push('warn: ' + a.join(' ')), error: (...a) => logs.push('error: ' + a.join(' ')) };
    const win = {};
    const sandbox = { window: win, console: fakeConsole, setTimeout, clearTimeout, setInterval, clearInterval };
    vm.createContext(sandbox);
    try {
      for (const f of order) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), sandbox, { filename: f });
    } catch (e) { fail('load order ' + order.join(' -> ') + ' threw: ' + e.message); continue; }
    const A = win.G && win.G.audio, M = win.G && win.G.musicData;
    check(A && M, 'load order ' + order.join(' -> ') + ': G.audio and G.musicData defined');
    if (!A || !M) continue;
    const missing = API.filter(k => typeof A[k] !== 'function');
    check(!missing.length, 'all public functions present' + (missing.length ? ' (missing ' + missing.join(', ') + ')' : ''));
    let threw = null;
    let ends = 0, starts = 0, cancelEnds = 0, h, renderRes;
    try {
      check(A.unlock() === false && A.isUnlocked() === false, 'unlock() is a no-op without Web Audio');
      for (const k of ['master', 'music', 'sfx', 'voice']) { A.setVolume(k, 0.5); if (A.getVolume(k) !== 0.5) fail('get/setVolume ' + k); }
      A.setVolume('master', 0.8); A.setVolume('music', 0.7); A.setVolume('sfx', 0.8); A.setVolume('voice', 0.9);
      A.setVolume('bogus', 1); A.setVolume('music', 7); check(A.getVolume('music') === 1, 'volume clamps to 0..1'); A.setVolume('music', 0.7);
      A.playMusic('title'); check(A.currentMusic() === 'title', 'playMusic before unlock remembers the track');
      A.playMusic('title'); A.playMusic('nope'); A.playMusic('nope');
      check(A.currentMusic() === null, 'unknown music id stops music');
      A.playMusic('archives', { fade: 2 }); A.stopMusic(); A.stopMusic(0); A.duck(true); A.duck(false);
      check(A.sfx('jump') === false, 'sfx() no-op without Web Audio'); A.sfx('nope'); A.sfx('nope', { vol: 2, pitch: 9, pan: 3 });
      check(A.speechAvailable() === false, 'speechAvailable() false without speechSynthesis');
      A.setVoiceEnabled(false); A.setVoiceEnabled(true);
      check(A.listMusic().length === 18, 'listMusic() has 18 tracks');
      const sfxList = A.listSfx(), miss = REQUIRED_SFX.filter(n => sfxList.indexOf(n) < 0);
      check(!miss.length, 'listSfx() has all ' + REQUIRED_SFX.length + ' required sfx' + (miss.length ? ' (missing ' + miss.join(',') + ')' : ''));
      A.say('Hello there, hunter.', { speaker: 'alucard', onstart: () => starts++, onend: () => ends++ });
      h = A.say('', {}); A.stopSpeech();
      const h2 = A.say('This one gets cancelled.', { onend: () => cancelEnds++ });
      check(h2 && typeof h2.cancel === 'function', 'say() returns {cancel}');
      h2.cancel(); h2.cancel();
      A.say(null); A.say(undefined, null); A.stopSpeech();
      ends = 0; starts = 0;
      A.say('Hello there, hunter.', { speaker: 'alucard', onstart: () => starts++, onend: () => ends++ });
      renderRes = await A._renderOffline('music', 'title', 1);
    } catch (e) { threw = e; }
    check(!threw, 'no public call threw' + (threw ? ': ' + threw.stack : ''));
    check(renderRes && renderRes.error, '_renderOffline resolves with an error field when OfflineAudioContext is missing');
    await sleep(1400);
    check(ends === 1 && starts === 1, 'say() fallback fires onstart/onend once after ~1.2 s (ends=' + ends + ')');
    check(cancelEnds === 0, 'cancelled say() never fires onend');
    const w = logs.filter(l => l.startsWith('warn'));
    check(w.length === 3, 'unknown music/sfx/volume kind warn once each (' + w.length + ' warnings)');
    check(!logs.some(l => l.startsWith('error')), 'no console.error');
  }
}

// ------------------------------------------------------------------ 2+3. Browser
function findChrome() {
  const cands = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'];
  try { for (const d of fs.readdirSync('/opt/pw-browsers')) if (/^chromium-\d+$/.test(d)) cands.push('/opt/pw-browsers/' + d + '/chrome-linux/chrome'); } catch (e) { /* ignore */ }
  return cands.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });
}
function fmt(n, d) { return (n == null || isNaN(n)) ? '-' : n.toFixed(d); }
function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }

async function phaseBrowser() {
  let pw;
  try { pw = require('playwright'); } catch (e) {
    try { pw = require('/opt/node22/lib/node_modules/playwright'); } catch (e2) { fail('playwright not found (set NODE_PATH)'); return; }
  }
  const exe = findChrome();
  const browser = await pw.chromium.launch({ headless: true, executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errors = [], cwarn = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); else if (m.type() === 'warning') cwarn.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.join(ROOT, 'tools', 'audio_test.html'));
  await page.waitForFunction(() => window.G && window.G.audio && window.G.musicData, null, { timeout: 10000 });

  console.log('\n[2] Browser: data + offline renders (Chromium ' + browser.version() + ')');
  const v = await page.evaluate(() => window.G.musicData.validate());
  check(v.length === 0, 'G.musicData.validate(): ' + (v.length ? v.join('; ') : 'no warnings'));
  const ids = await page.evaluate(() => window.G.audio.listMusic());
  const missM = REQUIRED_MUSIC.filter(x => ids.indexOf(x) < 0);
  check(!missM.length, 'all 18 track ids present' + (missM.length ? ' (missing ' + missM.join(',') + ')' : ''));

  console.log('\n  ' + pad('track', 15) + pad('loop s', 8) + pad('render s', 10) + pad('peak', 8) + pad('rms', 8) + pad('dBFS', 7) + pad('pre-lim', 9) + 'flags');
  const musicStats = [];
  for (const id of ids) {
    const info = await page.evaluate(id => window.G.musicData.info(id), id);
    const secs = FULL ? Math.min(140, info.introSeconds + info.loopSeconds + (info.loop ? 4 : 3)) : SECONDS;
    const t0 = Date.now();
    const r = await page.evaluate(([id, s]) => window.G.audio._renderOffline('music', id, s), [id, secs]);
    const raw = await page.evaluate(([id, s]) => window.G.audio._renderOffline('music', id, s, { raw: true }), [id, secs]);
    const flags = [];
    if (!(r.rms > 1e-4)) { flags.push('SILENT'); fail(id + ' is silent'); }
    if (r.peak > 1.0) { flags.push('CLIP'); fail(id + ' clips (peak ' + r.peak.toFixed(3) + ')'); }
    if (raw.peak > 1.0) { flags.push('pre-limiter>1'); warn(id + ' pre-limiter peak ' + raw.peak.toFixed(3)); }
    musicStats.push({ id, rms: r.rms });
    console.log('  ' + pad(id, 15) + pad(fmt(info.loopSeconds, 1), 8) + pad(fmt(secs, 1), 10) + pad(fmt(r.peak, 3), 8) + pad(fmt(r.rms, 4), 8) +
      pad(fmt(20 * Math.log10(r.rms || 1e-9), 1), 7) + pad(fmt(raw.peak, 3), 9) + (flags.join(' ') || 'ok') + '  (' + (Date.now() - t0) + ' ms)');
  }

  const sfxNames = await page.evaluate(() => window.G.audio.listSfx());
  const missS = REQUIRED_SFX.filter(x => sfxNames.indexOf(x) < 0);
  check(!missS.length, 'all ' + REQUIRED_SFX.length + ' required sfx present' + (missS.length ? ' (missing ' + missS.join(',') + ')' : ''));
  console.log('\n  ' + pad('sfx', 18) + pad('peak', 8) + pad('rms', 8) + pad('pre-lim', 9) + 'flags');
  for (const n of sfxNames) {
    const r = await page.evaluate(n => window.G.audio._renderOffline('sfx', n, 4), n);
    const raw = await page.evaluate(n => window.G.audio._renderOffline('sfx', n, 4, { raw: true }), n);
    const flags = [];
    if (!(r.rms > 1e-5)) { flags.push('SILENT'); fail('sfx ' + n + ' is silent'); }
    if (r.peak > 1.0) { flags.push('CLIP'); fail('sfx ' + n + ' clips'); }
    if (raw.peak > 1.0) { flags.push('pre-limiter>1'); warn('sfx ' + n + ' pre-limiter peak ' + raw.peak.toFixed(3)); }
    console.log('  ' + pad(n, 18) + pad(fmt(r.peak, 3), 8) + pad(fmt(r.rms, 4), 8) + pad(fmt(raw.peak, 3), 9) + (flags.join(' ') || 'ok'));
  }

  if (!SKIP_LIVE) {
    console.log('\n[3] Browser: live API');
    const live = await page.evaluate(async () => {
      const A = window.G.audio, out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
      out.unlock = A.unlock(); out.unlock2 = A.unlock();
      await wait(300);
      out.state = A._debug().state;
      A.playMusic('entrance');
      await wait(1200);
      out.cur = A.currentMusic(); out.voices = A._debug().voices;
      out.same = A.playMusic('entrance'); out.fadingAfterSame = A._debug().fading;
      let acc = 0; for (let i = 0; i < 10; i++) if (A.sfx('hit_flesh', { pitch: 0.9 + i * 0.02 })) acc++;
      out.rateAccepted = acc;
      const names = A.listSfx(); let acc2 = 0;
      for (let i = 0; i < 60; i++) if (A.sfx(names[i % names.length], { vol: 0.2 })) acc2++;
      out.capAccepted = acc2; out.sfxVoices = A._debug().sfxVoices;
      A.duck(true); await wait(300); out.ducked = A._debug().ducked; A.duck(false);
      A.playMusic('boss', { fade: 0.5 });
      await wait(200); out.fadingDuring = A._debug().fading;
      await wait(4200); out.fadingAfter = A._debug().fading; out.cur2 = A.currentMusic();
      A.playMusic('boss', { restart: true, fade: 0.2 }); await wait(100); out.restartFading = A._debug().fading;
      let st = 0, en = 0; const t0 = performance.now();
      await new Promise(res => { A.say('Short line.', { speaker: 'alucard', onstart: () => st++, onend: () => { en++; res(); } }); setTimeout(res, 9000); });
      out.sayMs = Math.round(performance.now() - t0); await wait(600); out.sayStarts = st; out.sayEnds = en;
      let ce = 0; const hh = A.say('This line will be cancelled right away.', { onend: () => ce++ }); hh.cancel();
      await wait(2500); out.cancelEnds = ce;
      // polyphony survey: every track for 1.2 s
      out.poly = {};
      for (const id of A.listMusic()) {
        A.playMusic(id, { fade: 0.05 }); let mx = 0;
        for (let k = 0; k < 6; k++) { await wait(200); mx = Math.max(mx, A._debug().voices); }
        out.poly[id] = mx;
      }
      A.stopMusic(0.1); await wait(300); out.afterStop = A.currentMusic();
      A.playMusic('gameover'); await wait(100); out.gameover = A.currentMusic();
      A.playMusic('does_not_exist'); out.afterUnknown = A.currentMusic();
      return out;
    });
    check(live.unlock === true && live.state === 'running', 'unlock() -> AudioContext running (' + live.state + ')');
    check(live.cur === 'entrance' && live.voices > 0, 'playMusic plays (' + live.voices + ' active voices)');
    check(live.same === true && live.fadingAfterSame === 0, 'same id again is a no-op');
    check(live.rateAccepted === 1, 'identical sfx rate-limited (' + live.rateAccepted + '/10 accepted)');
    check(live.capAccepted <= 24 && live.sfxVoices <= 24, 'sfx voice cap respected (' + live.capAccepted + ' accepted, ' + live.sfxVoices + ' active)');
    check(live.ducked === true, 'duck() toggles');
    check(live.fadingDuring === 1 && live.fadingAfter === 0 && live.cur2 === 'boss', 'crossfade: old track fades out and is released');
    check(live.restartFading === 1, 'restart:true crossfades into a fresh instance');
    check(live.sayEnds === 1 && live.sayStarts === 1, 'say() fires onstart/onend exactly once (' + live.sayMs + ' ms)');
    check(live.cancelEnds === 0, 'cancelled utterance never fires onend');
    const maxPoly = Math.max.apply(null, Object.values(live.poly));
    console.log('  info peak music voices per track: ' + Object.entries(live.poly).map(([k, n]) => k + '=' + n).join(' '));
    check(maxPoly <= 110, 'music polyphony stays under the cap (max ' + maxPoly + ')');
    check(live.afterStop === null && live.gameover === 'gameover' && live.afterUnknown === null, 'stopMusic / one-shot / unknown id behave');
  }

  const realErrors = errors.filter(e => !/favicon/i.test(e));
  check(realErrors.length === 0, 'no console errors / page errors' + (realErrors.length ? ': ' + realErrors.join(' | ') : ''));
  const unexpectedWarn = cwarn.filter(w => !/does_not_exist/.test(w));
  if (unexpectedWarn.length) warn('console warnings: ' + unexpectedWarn.join(' | '));
  await browser.close();
}

(async () => {
  const t0 = Date.now();
  try { await phaseVm(); } catch (e) { fail('vm phase crashed: ' + e.stack); }
  try { await phaseBrowser(); } catch (e) { fail('browser phase crashed: ' + e.stack); }
  console.log('\n' + (failures ? 'FAILED' : 'PASSED') + ': ' + failures + ' failure(s), ' + warnings + ' warning(s) in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  process.exit(failures ? 1 : 0);
})();
