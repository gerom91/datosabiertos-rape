/* Elegy of the Night — fx.js
 * Particles, damage numbers (pixel digits), slash trails, dust, sparks,
 * explosions and floating texts. Everything lives in world coordinates.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, gfx = G.gfx;

  const parts = [];
  const nums = [];
  const slashes = [];
  const MAXP = 700;

  const fx = (G.fx = { parts, nums, slashes });

  fx.clear = function () {
    parts.length = 0;
    nums.length = 0;
    slashes.length = 0;
  };

  fx.particle = function (x, y, vx, vy, col, life, o) {
    if (parts.length >= MAXP) parts.shift();
    o = o || {};
    parts.push({ x, y, vx, vy, col, life, max: life, size: o.size || 1, grav: o.grav || 0, drag: o.drag == null ? 0.98 : o.drag, glow: !!o.glow, shape: o.shape || 'px', rot: o.rot || 0, vr: o.vr || 0 });
  };
  fx.burst = function (x, y, col, n, spd, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.3 + Math.random()) * (spd || 2);
      fx.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, col, 18 + Math.random() * 18, Object.assign({ size: Math.random() < 0.3 ? 2 : 1 }, o));
    }
  };
  fx.spark = function (x, y, col, n) {
    for (let i = 0; i < (n || 6); i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2.5;
      fx.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, i % 2 ? '#ffffff' : col || '#ffe080', 8 + Math.random() * 8, { glow: true });
    }
  };
  fx.blood = function (x, y, dir, n, col) {
    for (let i = 0; i < (n || 8); i++)
      fx.particle(x, y, dir * (0.5 + Math.random() * 2.5), -Math.random() * 2.5, col || '#a01020', 22 + Math.random() * 16, { grav: 0.15, size: Math.random() < 0.3 ? 2 : 1 });
  };
  fx.dust = function (x, y, n) {
    for (let i = 0; i < n; i++) fx.particle(x + U.rnd(-6, 6), y - 1, U.rnd(-0.8, 0.8), U.rnd(-0.6, -0.1), '#8a8070', 18 + Math.random() * 10, { size: 2, drag: 0.92 });
  };
  fx.ring = function (x, y, col) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      fx.particle(x, y, Math.cos(a) * 1.8, Math.sin(a) * 0.6, col, 16, { glow: true });
    }
  };
  fx.explode = function (x, y, scale) {
    scale = scale || 1;
    const cols = ['#fff6c0', '#ffc040', '#ff6020', '#a02010', '#402018'];
    for (let i = 0; i < 26 * scale; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 3 * scale;
      fx.particle(x, y, Math.cos(a) * s, Math.sin(a) * s - 0.5, cols[Math.floor(Math.random() * cols.length)], 20 + Math.random() * 20, { size: Math.random() < 0.5 ? 2 : 3, glow: i % 3 === 0, drag: 0.93 });
    }
  };
  fx.debris = function (x, y, col, n) {
    for (let i = 0; i < (n || 10); i++)
      fx.particle(x + U.rnd(-6, 6), y + U.rnd(-6, 6), U.rnd(-2, 2), U.rnd(-3.5, -0.5), i % 2 ? col : U.shade(col, -0.3), 40 + Math.random() * 20, { grav: 0.22, size: 2 + (i % 2), drag: 0.99 });
  };
  fx.soul = function (x, y, tx, ty, col) {
    fx.particle(x, y, (tx - x) / 30, (ty - y) / 30 - 1, col || '#ff4060', 30, { glow: true, size: 2, drag: 1 });
  };

  // ---- damage numbers -------------------------------------------------------------------
  const DIG = {
    0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
    3: ['111', '001', '011', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
    6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
    9: ['111', '101', '111', '001', '111'], '+': ['000', '010', '111', '010', '000'], '!': ['010', '010', '010', '000', '010'],
  };
  function digitImg(ch, col) {
    return gfx.sprite('dig' + ch + col, 4, 6, (c) => {
      const rows = DIG[ch];
      if (!rows) return;
      c.fillStyle = col;
      for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (rows[y][x] === '1') c.fillRect(x, y, 1, 1);
    }, { outline: '#100810', threshold: 1 });
  }
  fx.number = function (x, y, val, col, big) {
    if (G.settings && G.settings.dmgNumbers === false) return;
    nums.push({ x, y, s: String(val), col: col || '#ffffff', life: 46, vy: -1.4, big: !!big });
  };
  fx.text = function (x, y, str, col) {
    nums.push({ x, y, s: str, col: col || '#ffffff', life: 70, vy: -0.6, text: true });
  };

  // ---- slashes (follow the player) ---------------------------------------------------------
  fx.slash = function (owner, kind, col, yoff) {
    slashes.push({ owner, kind, col, yoff, t: 0, dur: kind === 'big' ? 10 : 7, facing: owner.facing });
  };

  fx.update = function () {
    for (const p of parts) {
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.grav;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life--;
    }
    U.removeIf(parts, (p) => p.life <= 0);
    for (const n of nums) {
      n.y += n.vy;
      n.vy *= 0.92;
      n.life--;
    }
    U.removeIf(nums, (n) => n.life <= 0);
    for (const s of slashes) s.t++;
    U.removeIf(slashes, (s) => s.t >= s.dur);
  };

  fx.draw = function (ctx, camx, camy) {
    // particles
    for (const p of parts) {
      const a = Math.min(1, p.life / (p.max * 0.5));
      ctx.globalAlpha = a;
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = p.col;
        ctx.fillRect(Math.round(p.x - camx - p.size), Math.round(p.y - camy - p.size), p.size * 2 + 1, p.size * 2 + 1);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.fillStyle = p.col;
        ctx.fillRect(Math.round(p.x - camx), Math.round(p.y - camy), p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
    // slashes
    for (const s of slashes) {
      const o = s.owner;
      G.drawSlash(ctx, o.cx - camx + o.facing * 4, o.fy - s.yoff - camy, o.facing, s.kind, s.t / s.dur, s.col);
    }
  };

  fx.drawNumbers = function (ctx, camx, camy) {
    for (const n of nums) {
      if (n.text) continue;
      const a = Math.min(1, n.life / 12);
      ctx.globalAlpha = a;
      let x = Math.round(n.x - camx - (n.s.length * 4) / 2), y = Math.round(n.y - camy);
      for (const ch of n.s) {
        const img = digitImg(ch, n.col);
        if (n.big) ctx.drawImage(img, x, y, 8, 12);
        else ctx.drawImage(img, x, y);
        x += n.big ? 8 : 4;
      }
    }
    ctx.globalAlpha = 1;
  };
  // texts are drawn in the UI layer for crisp letters
  fx.drawTexts = function (camx, camy) {
    for (const n of nums) {
      if (!n.text) continue;
      gfx.text(n.s, n.x - camx, n.y - camy, { size: 7, font: 'title', align: 'center', color: n.col, alpha: Math.min(1, n.life / 15) });
    }
  };
})();
