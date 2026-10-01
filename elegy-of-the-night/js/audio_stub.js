/* Elegy of the Night — audio_stub.js
 * Safe no-op audio API. js/audio.js replaces it with the real engine; if that
 * file is missing or fails, the game still runs silently.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  if (G.audio && G.audio._real) return;
  let music = null, unlocked = false;
  G.audio = {
    _stub: true,
    unlock() {
      unlocked = true;
    },
    isUnlocked: () => unlocked,
    setVolume() {},
    getVolume: () => 1,
    playMusic(id) {
      music = id;
    },
    stopMusic() {
      music = null;
    },
    currentMusic: () => music,
    duck() {},
    sfx() {},
    say(text, o) {
      const ms = Math.max(1200, String(text || '').length * 55);
      let done = false;
      const t = setTimeout(() => {
        if (!done && o && o.onend) {
          done = true;
          o.onend();
        }
      }, ms);
      return { cancel: () => clearTimeout(t) };
    },
    stopSpeech() {},
    speechAvailable: () => false,
    setVoiceEnabled() {},
    listMusic: () => [],
    listSfx: () => [],
  };
})();
