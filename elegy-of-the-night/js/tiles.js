/* Elegy of the Night — tiles.js
 * Procedural tile sets, back walls, background decorations and parallax
 * skies for every area theme. Rooms are pre-rendered once into two canvases
 * (background + foreground tiles); skies are drawn per frame.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, T = G.T, TS = G.TILE;

  // ---- Theme palettes --------------------------------------------------------
  const THEMES = (G.themes = {
    entrance: {
      solid: 'blocks', top: 'moss', wall: 'bricks', far: 'night',
      c: { base: '#4b5068', dark: '#2a2d40', light: '#7a809c', mortar: '#1c1e2c', accent: '#41613d', accent2: '#6f9a55', wall: '#232637', wall2: '#1a1c2a', trim: '#8a6a3a' },
      darkness: 0.18, tint: '#05061a', decor: ['window', 'pillar', 'torch', 'banner', 'chain'],
    },
    gallery: {
      solid: 'marble', top: 'gold', wall: 'panels', far: 'night',
      c: { base: '#c8c0bc', dark: '#8e8682', light: '#ece6e0', mortar: '#6b6460', accent: '#c9a24a', accent2: '#fff0b0', wall: '#5a4a52', wall2: '#40343c', trim: '#c9a24a', vein: '#a59c98' },
      darkness: 0.1, tint: '#0b0612', decor: ['window', 'painting', 'statue', 'pillar', 'chandelier', 'curtain'],
    },
    library: {
      solid: 'wood', top: 'carpet', wall: 'shelves', far: 'night',
      c: { base: '#6e4528', dark: '#3e2414', light: '#9a6a40', mortar: '#2a160a', accent: '#5a1a22', accent2: '#8a2a32', wall: '#2e1c12', wall2: '#22140c', trim: '#b8903a' },
      darkness: 0.3, tint: '#0c0604', decor: ['lamp', 'window', 'ladder', 'desk', 'globe'],
    },
    archives: {
      solid: 'mahogany', top: 'velvet', wall: 'tallshelves', far: 'void',
      c: { base: '#4a2418', dark: '#24100a', light: '#7a4028', mortar: '#160806', accent: '#7a1424', accent2: '#d4a84a', wall: '#1c0e0c', wall2: '#140908', trim: '#d4a84a', ink: '#1a1028', glow: '#e8c070' },
      darkness: 0.42, tint: '#0a0408', decor: ['candelabra', 'portrait', 'crest', 'scrollrack', 'rift', 'lectern', 'chain'],
    },
    vault: {
      solid: 'mahogany', top: 'ink', wall: 'tallshelves', far: 'void',
      c: { base: '#2c1830', dark: '#160a1a', light: '#4e2c56', mortar: '#0a040c', accent: '#3a1a52', accent2: '#a070e0', wall: '#120a16', wall2: '#0c060e', trim: '#8a6ab8', ink: '#0c0618', glow: '#b48cff' },
      darkness: 0.55, tint: '#06020c', decor: ['candelabra', 'chain', 'rift', 'crest', 'scrollrack'],
    },
    caverns: {
      solid: 'rock', top: 'wet', wall: 'cave', far: 'cave',
      c: { base: '#2f5263', dark: '#162a35', light: '#5a8a9a', mortar: '#0c1820', accent: '#4a8a8a', accent2: '#9ad6d6', wall: '#10202a', wall2: '#0a161e', trim: '#4a7a8a' },
      darkness: 0.45, tint: '#020812', decor: ['stalactite', 'crystal', 'waterfall', 'stalactite'],
    },
    clocktower: {
      solid: 'blocks', top: 'brass', wall: 'bricks', far: 'night',
      c: { base: '#5a5248', dark: '#302a24', light: '#8a8070', mortar: '#1e1a16', accent: '#b08d3c', accent2: '#e8c870', wall: '#2a241e', wall2: '#1e1a16', trim: '#b08d3c' },
      darkness: 0.15, tint: '#06040a', decor: ['gear', 'clockface', 'window', 'pendulum', 'gear'],
    },
    catacombs: {
      solid: 'bone', top: 'none', wall: 'skulls', far: 'none',
      c: { base: '#3a2e24', dark: '#1c1610', light: '#5e4c3a', mortar: '#0e0a08', accent: '#d8cdb0', accent2: '#f0e8d0', wall: '#181210', wall2: '#100c0a', trim: '#6a5a44' },
      darkness: 0.62, tint: '#060402', decor: ['niche', 'torch', 'bonepile', 'chain'],
    },
    chapel: {
      solid: 'blocks', top: 'carpet', wall: 'stone_light', far: 'night',
      c: { base: '#a8a294', dark: '#6e695e', light: '#d4cfc2', mortar: '#4a463e', accent: '#7a1420', accent2: '#c83040', wall: '#3c3a44', wall2: '#2c2a34', trim: '#c9a24a' },
      darkness: 0.12, tint: '#08060c', decor: ['stained', 'pillar', 'candelabra', 'pew', 'organ'],
    },
    keep: {
      solid: 'blocks', top: 'gold', wall: 'curtain', far: 'redmoon',
      c: { base: '#4a1a20', dark: '#220a0e', light: '#7a3036', mortar: '#12040a', accent: '#c9a24a', accent2: '#ffe08a', wall: '#1c080c', wall2: '#120408', trim: '#c9a24a' },
      darkness: 0.25, tint: '#0c0206', decor: ['window', 'candelabra', 'pillar', 'banner', 'throne'],
    },
  });

  // ---- Tile drawing ------------------------------------------------------------
  function px(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }
  function vary(c, rng, amt) {
    return U.shade(c, (rng.next() - 0.5) * 2 * (amt || 0.06));
  }

  function solidTile(ctx, th, x, y, nb, rng, deep) {
    const c = th.c;
    switch (th.solid) {
      case 'blocks': {
        const base = deep ? U.shade(c.base, -0.35) : vary(c.base, rng, 0.05);
        px(ctx, x, y, 16, 16, base);
        // two staggered half blocks for variety
        if (rng.next() < 0.5) {
          px(ctx, x, y + 7, 16, 1, c.mortar);
          px(ctx, x + (rng.next() < 0.5 ? 5 : 10), y, 1, 7, c.mortar);
          px(ctx, x + (rng.next() < 0.5 ? 3 : 12), y + 8, 1, 8, c.mortar);
        } else {
          px(ctx, x + 15, y, 1, 16, c.mortar);
          px(ctx, x, y + 15, 16, 1, c.mortar);
        }
        if (!deep) {
          px(ctx, x, y, 15, 1, U.shade(base, 0.18));
          px(ctx, x, y, 1, 15, U.shade(base, 0.1));
          if (rng.next() < 0.25) px(ctx, x + rng.int(3, 11), y + rng.int(3, 11), 2, 1, U.shade(base, -0.25));
          if (rng.next() < 0.2) px(ctx, x + rng.int(2, 12), y + rng.int(2, 12), 1, 2, U.shade(base, 0.2));
        }
        break;
      }
      case 'marble': {
        const base = deep ? U.shade(c.base, -0.45) : vary(c.base, rng, 0.03);
        px(ctx, x, y, 16, 16, base);
        if (!deep) {
          ctx.strokeStyle = c.vein;
          ctx.lineWidth = 1;
          ctx.beginPath();
          let vx = x + rng.int(0, 15), vy = y;
          ctx.moveTo(vx + 0.5, vy);
          for (let i = 0; i < 4; i++) {
            vx += rng.int(-3, 3);
            vy += 4;
            ctx.lineTo(vx + 0.5, vy);
          }
          ctx.stroke();
          px(ctx, x, y, 16, 1, c.light);
          px(ctx, x + 15, y, 1, 16, c.dark);
          px(ctx, x, y + 15, 16, 1, c.dark);
        } else {
          px(ctx, x + 15, y, 1, 16, U.shade(base, -0.2));
          px(ctx, x, y + 15, 16, 1, U.shade(base, -0.2));
        }
        break;
      }
      case 'wood': {
        const base = deep ? U.shade(c.base, -0.4) : vary(c.base, rng, 0.06);
        px(ctx, x, y, 16, 16, base);
        for (let i = 0; i < 4; i++) {
          px(ctx, x, y + i * 4 + 3, 16, 1, U.shade(base, -0.35));
          if (!deep && rng.next() < 0.6) px(ctx, x + rng.int(1, 12), y + i * 4 + 1, rng.int(2, 4), 1, U.shade(base, -0.15));
        }
        if (!deep) {
          px(ctx, x + rng.int(2, 13), y + rng.int(0, 3) * 4 + 1, 1, 1, '#2a1a10');
          px(ctx, x, y, 16, 1, U.shade(base, 0.2));
        }
        break;
      }
      case 'mahogany': {
        const base = deep ? U.shade(c.base, -0.5) : vary(c.base, rng, 0.05);
        px(ctx, x, y, 16, 16, base);
        // carved panel
        if (!deep) {
          px(ctx, x + 2, y + 2, 12, 12, U.shade(base, -0.18));
          px(ctx, x + 3, y + 3, 10, 10, U.shade(base, 0.06));
          px(ctx, x + 2, y + 2, 12, 1, U.shade(base, -0.35));
          px(ctx, x + 2, y + 2, 1, 12, U.shade(base, -0.35));
          px(ctx, x + 3, y + 13, 11, 1, U.shade(base, 0.22));
          px(ctx, x + 13, y + 3, 1, 11, U.shade(base, 0.22));
          if (rng.next() < 0.15) px(ctx, x + 7, y + 7, 2, 2, c.trim);
          px(ctx, x, y, 16, 1, U.shade(base, 0.25));
        } else {
          px(ctx, x, y + 15, 16, 1, U.shade(base, -0.3));
        }
        break;
      }
      case 'rock': {
        const base = deep ? U.shade(c.base, -0.5) : vary(c.base, rng, 0.07);
        px(ctx, x, y, 16, 16, base);
        const n = deep ? 2 : 6;
        for (let i = 0; i < n; i++) {
          const bx = x + rng.int(0, 13), by = y + rng.int(0, 13);
          px(ctx, bx, by, rng.int(2, 4), rng.int(1, 3), U.shade(base, -0.22));
        }
        if (!deep)
          for (let i = 0; i < 3; i++) px(ctx, x + rng.int(0, 15), y + rng.int(0, 15), 1, 1, U.shade(base, 0.3));
        break;
      }
      case 'bone': {
        const base = deep ? U.shade(c.base, -0.4) : vary(c.base, rng, 0.06);
        px(ctx, x, y, 16, 16, base);
        if (!deep && rng.next() < 0.55) skull(ctx, x + rng.int(2, 8), y + rng.int(2, 8), c.accent, c.mortar);
        else if (!deep && rng.next() < 0.6) {
          px(ctx, x + 2, y + rng.int(3, 12), 10, 2, U.shade(c.accent, -0.15));
          px(ctx, x + 1, y + 1 + rng.int(3, 11), 2, 3, c.accent);
        }
        for (let i = 0; i < 3; i++) px(ctx, x + rng.int(0, 15), y + rng.int(0, 15), 1, 1, U.shade(base, -0.3));
        break;
      }
      default:
        px(ctx, x, y, 16, 16, c.base);
    }
    // exposed edges
    if (!deep) {
      if (!nb.u) {
        switch (th.top) {
          case 'moss':
            px(ctx, x, y, 16, 2, c.accent);
            for (let i = 0; i < 16; i += 2) if (rng.next() < 0.5) px(ctx, x + i, y + 2, 1, rng.int(1, 3), c.accent);
            px(ctx, x, y, 16, 1, c.accent2);
            break;
          case 'gold':
            px(ctx, x, y, 16, 3, c.accent);
            px(ctx, x, y, 16, 1, c.accent2);
            px(ctx, x, y + 3, 16, 1, U.shade(c.accent, -0.5));
            if ((x / 16) % 2 === 0) px(ctx, x + 7, y + 1, 2, 1, U.shade(c.accent, -0.3));
            break;
          case 'carpet':
            px(ctx, x, y, 16, 3, c.accent);
            px(ctx, x, y, 16, 1, c.accent2);
            px(ctx, x, y + 3, 16, 1, c.trim);
            break;
          case 'velvet':
            px(ctx, x, y, 16, 2, c.accent);
            px(ctx, x, y, 16, 1, U.shade(c.accent, 0.25));
            px(ctx, x, y + 2, 16, 1, c.trim);
            for (let i = 1; i < 16; i += 4) px(ctx, x + i, y + 3, 2, 1, U.shade(c.trim, -0.3));
            break;
          case 'ink':
            px(ctx, x, y, 16, 2, c.ink);
            px(ctx, x, y, 16, 1, c.accent2);
            for (let i = 0; i < 16; i += 3) if (rng.next() < 0.4) px(ctx, x + i, y + 2, 1, rng.int(1, 4), c.ink);
            break;
          case 'wet':
            px(ctx, x, y, 16, 1, c.accent2);
            px(ctx, x, y + 1, 16, 1, c.accent);
            if (rng.next() < 0.3) px(ctx, x + rng.int(2, 13), y + 2, 1, 2, c.accent);
            break;
          case 'brass':
            px(ctx, x, y, 16, 3, c.accent);
            px(ctx, x, y, 16, 1, c.accent2);
            px(ctx, x + 3, y + 1, 1, 1, '#5a4010');
            px(ctx, x + 12, y + 1, 1, 1, '#5a4010');
            break;
          default:
            px(ctx, x, y, 16, 1, U.shade(c.base, 0.25));
        }
      }
      if (!nb.d) px(ctx, x, y + 15, 16, 1, U.shade(c.base, -0.45));
      if (!nb.l) px(ctx, x, y, 1, 16, U.shade(c.base, -0.25));
      if (!nb.r) px(ctx, x + 15, y, 1, 16, U.shade(c.base, -0.4));
    }
  }

  function skull(ctx, x, y, col, dark) {
    px(ctx, x + 1, y, 4, 1, col);
    px(ctx, x, y + 1, 6, 3, col);
    px(ctx, x + 1, y + 4, 4, 1, col);
    px(ctx, x + 1, y + 2, 1, 1, dark);
    px(ctx, x + 4, y + 2, 1, 1, dark);
    px(ctx, x + 2, y + 4, 1, 1, dark);
    px(ctx, x + 3, y + 5, 1, 1, col);
  }

  function platformTile(ctx, th, x, y, rng) {
    const c = th.c;
    switch (th.solid) {
      case 'wood':
      case 'mahogany':
        px(ctx, x, y, 16, 4, c.light);
        px(ctx, x, y, 16, 1, U.shade(c.light, 0.3));
        px(ctx, x, y + 4, 16, 1, c.dark);
        px(ctx, x + 2, y + 5, 2, 3, c.dark);
        px(ctx, x + 12, y + 5, 2, 3, c.dark);
        if (th.top === 'velvet' || th.top === 'ink') px(ctx, x, y + 1, 16, 1, c.trim);
        break;
      case 'marble':
        px(ctx, x, y, 16, 5, c.light);
        px(ctx, x, y, 16, 1, c.accent2);
        px(ctx, x, y + 1, 16, 1, c.accent);
        px(ctx, x, y + 5, 16, 1, c.dark);
        px(ctx, x + 6, y + 6, 4, 2, c.dark);
        break;
      case 'rock':
        px(ctx, x, y, 16, 5, c.base);
        px(ctx, x, y, 16, 1, c.accent2);
        px(ctx, x + 1, y + 5, 14, 1, c.dark);
        px(ctx, x + 3, y + 6, 4, 2, c.dark);
        px(ctx, x + 10, y + 6, 3, 3, c.dark);
        break;
      case 'bone':
        px(ctx, x, y + 1, 16, 3, c.accent);
        px(ctx, x, y + 1, 16, 1, c.accent2);
        px(ctx, x, y + 4, 16, 1, U.shade(c.accent, -0.4));
        px(ctx, x - 0, y, 3, 5, c.accent);
        px(ctx, x + 13, y, 3, 5, c.accent);
        break;
      default:
        px(ctx, x, y, 16, 5, c.light);
        px(ctx, x, y, 16, 1, U.shade(c.light, 0.3));
        px(ctx, x, y + 5, 16, 1, c.dark);
        px(ctx, x + 3, y + 6, 2, 3, c.dark);
        px(ctx, x + 11, y + 6, 2, 3, c.dark);
        if (th.top === 'brass' || th.top === 'gold') px(ctx, x, y + 1, 16, 1, c.accent);
    }
  }

  function slopeTile(ctx, th, x, y, dir, rng) {
    // filled triangle with stair steps (dir 1: rising right '/', -1: rising left '\')
    const c = th.c;
    const step = 4;
    for (let i = 0; i < 16; i += step) {
      // column band i..i+step: height of surface
      const h = dir > 0 ? i + step : 16 - i;
      const top = y + 16 - h;
      px(ctx, x + i, top, step, h, i % 8 === 0 ? c.base : U.shade(c.base, -0.06));
      px(ctx, x + i, top, step, 1, U.shade(c.light, 0.15));
      px(ctx, x + i + (dir > 0 ? step - 1 : 0), top, 1, h, U.shade(c.base, -0.3));
    }
    if (th.top === 'carpet' || th.top === 'velvet') {
      for (let i = 0; i < 16; i += step) {
        const h = dir > 0 ? i + step : 16 - i;
        px(ctx, x + i, y + 16 - h, step, 1, c.accent);
      }
    }
  }

  function spikesTile(ctx, th, x, y, down) {
    for (let i = 0; i < 4; i++) {
      const bx = x + i * 4;
      for (let k = 0; k < 7; k++) {
        const w = Math.max(1, 4 - Math.floor(k / 2));
        const yy = down ? y + k : y + 15 - k;
        px(ctx, bx + Math.floor((4 - w) / 2), yy, w, 1, k < 2 ? '#5a5c66' : k > 5 ? '#f0f0ff' : '#b8bccc');
      }
    }
    px(ctx, x, down ? y : y + 15, 16, 1, '#3a3c46');
  }

  function grateTile(ctx, th, x, y) {
    for (let i = 1; i < 16; i += 4) {
      px(ctx, x + i, y, 2, 16, '#3c3e48');
      px(ctx, x + i, y, 1, 16, '#6a6c78');
    }
    px(ctx, x, y + 6, 16, 2, '#2c2e36');
    px(ctx, x, y + 6, 16, 1, '#5a5c66');
  }

  function sealTile(ctx, th, x, y, rng) {
    px(ctx, x, y, 16, 16, 'rgba(230,190,90,0.28)');
    px(ctx, x + 7, y + 2, 2, 12, 'rgba(255,230,150,0.75)');
    px(ctx, x + 3, y + 6, 10, 2, 'rgba(255,230,150,0.75)');
    px(ctx, x, y, 1, 16, 'rgba(255,220,120,0.5)');
    px(ctx, x + 15, y, 1, 16, 'rgba(255,220,120,0.5)');
  }

  // ---- Back walls -----------------------------------------------------------------
  function backWall(ctx, room, th, rng) {
    const c = th.c, W = room.pw, H = room.ph;
    switch (th.wall) {
      case 'bricks':
      case 'stone_light': {
        px(ctx, 0, 0, W, H, c.wall);
        for (let y = 0; y < H; y += 8) {
          const off = (y / 8) % 2 ? 8 : 0;
          for (let x = -off; x < W; x += 16) {
            const col = vary(c.wall, rng, 0.08);
            px(ctx, x + 1, y + 1, 15, 7, col);
            if (rng.next() < 0.08) px(ctx, x + 4, y + 3, 3, 1, U.shade(col, -0.3));
          }
        }
        break;
      }
      case 'panels': {
        px(ctx, 0, 0, W, H, c.wall);
        for (let x = 0; x < W; x += 48) {
          px(ctx, x + 4, 16, 40, H - 32, c.wall2);
          px(ctx, x + 6, 18, 36, H - 36, U.shade(c.wall, 0.06));
          px(ctx, x + 4, 16, 40, 1, c.trim);
          px(ctx, x + 4, H - 17, 40, 1, U.shade(c.trim, -0.4));
        }
        // dado rail
        for (let y = 0; y < H; y += G.CELL_PX_H) px(ctx, 0, y + 150, W, 2, U.shade(c.trim, -0.3));
        break;
      }
      case 'shelves': {
        px(ctx, 0, 0, W, H, c.wall);
        for (let x = 0; x < W; x += 64) bookcase(ctx, x + 2, 0, 60, H, th, rng);
        break;
      }
      case 'tallshelves': {
        px(ctx, 0, 0, W, H, c.wall);
        for (let x = 0; x < W; x += 80) {
          bookcase(ctx, x + 4, 0, 72, H, th, rng, true);
          // carved pilaster between cases
          px(ctx, x, 0, 4, H, c.dark);
          px(ctx, x + 1, 0, 1, H, c.trim);
        }
        break;
      }
      case 'cave': {
        px(ctx, 0, 0, W, H, c.wall);
        for (let i = 0; i < (W * H) / 220; i++) {
          const x = rng.int(0, W), y = rng.int(0, H);
          px(ctx, x, y, rng.int(3, 12), rng.int(2, 8), rng.next() < 0.5 ? c.wall2 : U.shade(c.wall, 0.08));
        }
        break;
      }
      case 'skulls': {
        px(ctx, 0, 0, W, H, c.wall);
        for (let y = 2; y < H; y += 9)
          for (let x = (y % 18 ? 0 : 5); x < W; x += 10)
            if (rng.next() < 0.85) skull(ctx, x, y, U.shade(c.accent, -0.55 + rng.next() * 0.1), c.wall2);
        break;
      }
      case 'curtain': {
        px(ctx, 0, 0, W, H, c.wall);
        for (let x = 0; x < W; x += 6) {
          const s = Math.sin(x * 0.5) * 0.12;
          px(ctx, x, 0, 3, H, U.shade('#5a0c16', s - 0.25));
          px(ctx, x + 3, 0, 3, H, U.shade('#5a0c16', s - 0.4));
        }
        break;
      }
      default:
        px(ctx, 0, 0, W, H, c.wall);
    }
  }

  const BOOK_COLS = ['#7a1a1a', '#1a4a2a', '#1a2a5a', '#5a3a1a', '#6a5a1a', '#3a1a4a', '#8a6a2a', '#2a2a2a', '#5a1a3a', '#1a4a4a'];
  function bookcase(ctx, x, y, w, h, th, rng, tall) {
    const c = th.c;
    px(ctx, x, y, w, h, c.wall2);
    px(ctx, x, y, 3, h, c.dark);
    px(ctx, x + w - 3, y, 3, h, c.dark);
    const shelfH = tall ? 22 : 20;
    for (let sy = y + 6; sy < y + h - 4; sy += shelfH) {
      // books
      let bx = x + 3;
      while (bx < x + w - 5) {
        const bw = rng.int(2, 4), bh = rng.int(11, shelfH - 5);
        if (rng.next() < 0.1) {
          // a leaning book or gap
          bx += bw + 2;
          continue;
        }
        const col = U.shade(rng.pick(BOOK_COLS), th === THEMES.vault ? -0.35 : -0.15);
        px(ctx, bx, sy + shelfH - 3 - bh, bw, bh, col);
        px(ctx, bx, sy + shelfH - 3 - bh, 1, bh, U.shade(col, 0.15));
        if (rng.next() < 0.5) px(ctx, bx, sy + shelfH - 3 - bh + 3, bw, 1, c.trim);
        if (tall && rng.next() < 0.15) px(ctx, bx, sy + shelfH - 8, bw, 1, c.glow || c.trim);
        bx += bw;
      }
      px(ctx, x, sy + shelfH - 3, w, 3, c.base);
      px(ctx, x, sy + shelfH - 3, w, 1, c.light);
    }
  }

  // ---- Decorations -------------------------------------------------------------------
  // Each returns optional light sources {x,y,r,color,flicker}
  const DECOR = {
    window(ctx, x, y, th, rng, out) {
      const w = 28, h = 56;
      // arched window cut (transparent → shows far sky)
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + 14);
      ctx.arc(x + w / 2, y + 14, w / 2, Math.PI, 0);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // frame & mullions
      ctx.strokeStyle = th.c.dark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + 14);
      ctx.arc(x + w / 2, y + 14, w / 2, Math.PI, 0);
      ctx.lineTo(x + w, y + h);
      ctx.stroke();
      px(ctx, x + w / 2 - 1, y + 2, 2, h - 2, th.c.dark);
      px(ctx, x, y + 30, w, 2, th.c.dark);
      px(ctx, x - 3, y + h, w + 6, 4, th.c.light);
      px(ctx, x - 3, y + h, w + 6, 1, U.shade(th.c.light, 0.3));
      out.push({ x: x + w / 2, y: y + 30, r: 60, color: '#8aa0ff', i: 0.5, moon: true });
    },
    pillar(ctx, x, y, th, rng, out, room) {
      const h = G.CELL_PX_H - y - 32;
      const c = th.c;
      px(ctx, x, y + 8, 14, h, U.shade(c.base, -0.25));
      px(ctx, x + 2, y + 8, 3, h, U.shade(c.base, -0.1));
      px(ctx, x + 10, y + 8, 2, h, U.shade(c.base, -0.45));
      px(ctx, x - 3, y, 20, 8, U.shade(c.base, -0.15));
      px(ctx, x - 3, y, 20, 2, U.shade(c.light, -0.1));
      px(ctx, x - 3, y + 8 + h - 6, 20, 6, U.shade(c.base, -0.2));
    },
    torch(ctx, x, y, th, rng, out) {
      px(ctx, x + 2, y + 8, 4, 10, '#3a2a1a');
      px(ctx, x, y + 6, 8, 3, '#5a4a3a');
      px(ctx, x + 2, y + 1, 4, 6, '#ffb040');
      px(ctx, x + 3, y, 2, 3, '#fff0a0');
      out.push({ x: x + 4, y: y + 3, r: 70, color: '#ff9a40', i: 0.9, flicker: true });
    },
    banner(ctx, x, y, th, rng) {
      px(ctx, x - 2, y, 24, 3, th.c.trim);
      px(ctx, x, y + 3, 20, 44, '#5a0e18');
      px(ctx, x + 2, y + 3, 2, 44, '#7a1a26');
      ctx.fillStyle = '#5a0e18';
      ctx.beginPath();
      ctx.moveTo(x, y + 47);
      ctx.lineTo(x + 10, y + 55);
      ctx.lineTo(x + 20, y + 47);
      ctx.fill();
      // bat emblem
      px(ctx, x + 8, y + 18, 4, 6, th.c.trim);
      px(ctx, x + 4, y + 17, 4, 3, th.c.trim);
      px(ctx, x + 12, y + 17, 4, 3, th.c.trim);
    },
    chain(ctx, x, y, th) {
      for (let i = 0; i < 70; i += 4) px(ctx, x + (i % 8 ? 0 : 1), y + i, 2, 3, '#4a4a52');
    },
    painting(ctx, x, y, th, rng) {
      const w = 34, h = 42, c = th.c;
      px(ctx, x - 3, y - 3, w + 6, h + 6, c.trim);
      px(ctx, x - 2, y - 2, w + 4, h + 4, U.shade(c.trim, -0.4));
      const bg = rng.pick(['#2a3a2a', '#3a2a2a', '#2a2a3a', '#3a3424']);
      px(ctx, x, y, w, h, bg);
      // abstract portrait: dark figure
      gfx.ellipse(ctx, x + w / 2, y + 16, 6, 7, 0, '#d8c0a8');
      px(ctx, x + w / 2 - 9, y + 23, 18, 19, rng.pick(['#3a1418', '#14183a', '#1a1a1a']));
      px(ctx, x + w / 2 - 6, y + 9, 12, 4, rng.pick(['#e0e0e0', '#3a2414', '#c8a040']));
    },
    statue(ctx, x, y, th) {
      const c = th.c, b = G.CELL_PX_H - 32;
      px(ctx, x - 4, b - 14, 24, 14, c.dark);
      px(ctx, x - 4, b - 14, 24, 2, c.light);
      gfx.ellipse(ctx, x + 8, b - 52, 4, 5, 0, c.light);
      px(ctx, x + 3, b - 47, 10, 22, c.base);
      px(ctx, x + 1, b - 26, 14, 12, c.base);
      px(ctx, x - 1, b - 46, 4, 14, c.base);
      px(ctx, x + 13, b - 52, 3, 18, c.base);
      px(ctx, x + 3, b - 47, 2, 30, c.light);
    },
    chandelier(ctx, x, y, th, rng, out) {
      px(ctx, x + 11, 0, 2, y + 6, '#3a3a3a');
      px(ctx, x, y + 6, 24, 3, th.c.trim);
      for (let i = 0; i < 4; i++) {
        px(ctx, x + 1 + i * 7, y + 2, 2, 4, '#f0e8d0');
        px(ctx, x + 1 + i * 7, y, 2, 2, '#ffd060');
      }
      out.push({ x: x + 12, y: y + 2, r: 80, color: '#ffc860', i: 0.8, flicker: true });
    },
    curtain(ctx, x, y, th) {
      for (let i = 0; i < 20; i += 4) px(ctx, x + i, 0, 4, 70 - i, i % 8 ? '#6a1018' : '#8a1a24');
      px(ctx, x - 2, 0, 24, 4, th.c.trim);
    },
    lamp(ctx, x, y, th, rng, out) {
      px(ctx, x + 3, y + 6, 2, 10, '#3a2a1a');
      px(ctx, x, y, 8, 7, '#2a5a3a');
      px(ctx, x + 1, y + 1, 6, 5, '#7ad08a');
      out.push({ x: x + 4, y: y + 3, r: 66, color: '#9aff9a', i: 0.75 });
    },
    ladder(ctx, x, y, th) {
      const h = G.CELL_PX_H - 32;
      px(ctx, x, 0, 2, h, th.c.light);
      px(ctx, x + 12, 0, 2, h, th.c.light);
      for (let i = 6; i < h; i += 10) px(ctx, x, i, 14, 2, th.c.base);
    },
    desk(ctx, x, y, th, rng, out) {
      const b = G.CELL_PX_H - 32;
      px(ctx, x, b - 18, 36, 4, th.c.light);
      px(ctx, x + 2, b - 14, 3, 14, th.c.dark);
      px(ctx, x + 31, b - 14, 3, 14, th.c.dark);
      px(ctx, x + 6, b - 22, 12, 4, '#e8dcc0');
      px(ctx, x + 22, b - 26, 4, 8, '#f0e8d0');
      px(ctx, x + 23, b - 28, 2, 2, '#ffd060');
      out.push({ x: x + 24, y: b - 28, r: 50, color: '#ffc860', i: 0.7, flicker: true });
    },
    globe(ctx, x, y, th) {
      const b = G.CELL_PX_H - 32;
      px(ctx, x + 6, b - 10, 3, 10, th.c.dark);
      gfx.circle(ctx, x + 7.5, b - 18, 7, '#3a6a8a');
      px(ctx, x + 4, b - 22, 5, 3, '#6a8a3a');
      px(ctx, x + 6, b - 16, 6, 3, '#6a8a3a');
    },
    candelabra(ctx, x, y, th, rng, out) {
      const b = G.CELL_PX_H - 32;
      const c = th.c;
      px(ctx, x + 7, b - 34, 2, 34, c.trim);
      px(ctx, x + 3, b - 3, 10, 3, c.trim);
      px(ctx, x, b - 34, 16, 2, c.trim);
      for (let i = 0; i < 3; i++) {
        px(ctx, x + i * 7, b - 40, 2, 6, '#efe6d0');
        px(ctx, x + i * 7, b - 43, 2, 3, '#ffcc55');
      }
      out.push({ x: x + 8, y: b - 42, r: 74, color: '#ffb850', i: 0.95, flicker: true });
    },
    portrait(ctx, x, y, th, rng) {
      const w = 30, h = 40, c = th.c;
      px(ctx, x - 3, y - 3, w + 6, h + 6, c.trim);
      px(ctx, x - 1, y - 1, w + 2, h + 2, U.shade(c.trim, -0.5));
      px(ctx, x, y, w, h, '#2a1a14');
      // a hunter: brown hair, dark coat, whip coil
      gfx.ellipse(ctx, x + 15, y + 15, 5, 6, 0, '#e0c4a8');
      px(ctx, x + 9, y + 8, 12, 5, rng.pick(['#5a3a1a', '#3a2a1a', '#8a6a3a', '#2a1a10']));
      px(ctx, x + 7, y + 22, 16, 18, rng.pick(['#3a2a1a', '#1a2a3a', '#4a1a1a']));
      px(ctx, x + 13, y + 22, 4, 6, '#d8d0c0');
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + 22, y + 33, 3, 0, Math.PI * 2);
      ctx.stroke();
      px(ctx, x + 4, y + h - 5, w - 8, 3, c.trim); // nameplate
    },
    crest(ctx, x, y, th, rng, out) {
      const c = th.c;
      // Belmont crest: shield with a cross and a coiled whip
      ctx.fillStyle = U.shade(c.accent, -0.2);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 24, y);
      ctx.lineTo(x + 24, y + 18);
      ctx.lineTo(x + 12, y + 30);
      ctx.lineTo(x, y + 18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.trim;
      ctx.lineWidth = 2;
      ctx.stroke();
      px(ctx, x + 11, y + 4, 3, 20, c.glow || c.trim);
      px(ctx, x + 5, y + 10, 15, 3, c.glow || c.trim);
      out.push({ x: x + 12, y: y + 14, r: 44, color: c.glow || '#ffd080', i: 0.45 });
    },
    scrollrack(ctx, x, y, th, rng) {
      const b = G.CELL_PX_H - 32, c = th.c;
      px(ctx, x, b - 44, 30, 44, c.dark);
      for (let r = 0; r < 4; r++)
        for (let k = 0; k < 4; k++) {
          const sx = x + 2 + k * 7, sy = b - 42 + r * 11;
          px(ctx, sx, sy, 6, 6, '#e8dcb8');
          px(ctx, sx + 2, sy + 2, 2, 2, '#8a7a5a');
        }
    },
    rift(ctx, x, y, th, rng, out) {
      // tear into the ink void (transparent cut → shows the 'void' far layer)
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(x + 10, y);
      ctx.lineTo(x + 16, y + 20);
      ctx.lineTo(x + 12, y + 34);
      ctx.lineTo(x + 18, y + 58);
      ctx.lineTo(x + 6, y + 36);
      ctx.lineTo(x + 9, y + 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = th.c.glow || '#e8c070';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 10, y);
      ctx.lineTo(x + 16, y + 20);
      ctx.lineTo(x + 12, y + 34);
      ctx.lineTo(x + 18, y + 58);
      ctx.stroke();
      out.push({ x: x + 12, y: y + 30, r: 56, color: th.c.glow || '#e8c070', i: 0.5 });
    },
    lectern(ctx, x, y, th, rng, out) {
      const b = G.CELL_PX_H - 32, c = th.c;
      px(ctx, x + 6, b - 20, 4, 20, c.base);
      px(ctx, x + 2, b - 3, 12, 3, c.base);
      ctx.fillStyle = c.light;
      ctx.beginPath();
      ctx.moveTo(x, b - 20);
      ctx.lineTo(x + 16, b - 26);
      ctx.lineTo(x + 16, b - 22);
      ctx.lineTo(x, b - 17);
      ctx.fill();
      px(ctx, x + 3, b - 26, 10, 3, '#efe6d0');
    },
    stalactite(ctx, x, y, th, rng) {
      const c = th.c, h = rng.int(16, 46);
      ctx.fillStyle = U.shade(c.wall, 0.12);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 12, 0);
      ctx.lineTo(x + 6, h);
      ctx.fill();
    },
    crystal(ctx, x, y, th, rng, out) {
      const b = G.CELL_PX_H - 32;
      ctx.fillStyle = '#4ac0d0';
      ctx.beginPath();
      ctx.moveTo(x, b);
      ctx.lineTo(x + 4, b - 14);
      ctx.lineTo(x + 8, b);
      ctx.fill();
      ctx.fillStyle = '#9af0ff';
      ctx.beginPath();
      ctx.moveTo(x + 6, b);
      ctx.lineTo(x + 11, b - 9);
      ctx.lineTo(x + 14, b);
      ctx.fill();
      out.push({ x: x + 7, y: b - 6, r: 40, color: '#60e0ff', i: 0.5 });
    },
    waterfall(ctx, x, y, th, rng) {
      for (let i = 0; i < G.CELL_PX_H; i += 2) {
        px(ctx, x + Math.round(Math.sin(i * 0.3) * 1), i, 10, 2, i % 6 ? '#3a7a9a' : '#6ab0d0');
      }
    },
    gear(ctx, x, y, th, rng) {
      const r = rng.int(14, 28), c = th.c;
      const cx = x + r, cy = y + r;
      ctx.fillStyle = U.shade(c.accent, -0.45);
      ctx.beginPath();
      const teeth = Math.round(r / 2.5);
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const rr = i % 2 ? r : r - 4;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      gfx.circle(ctx, cx, cy, r - 8, U.shade(c.accent, -0.6));
      gfx.circle(ctx, cx, cy, 3, U.shade(c.accent, -0.3));
    },
    clockface(ctx, x, y, th) {
      const c = th.c;
      gfx.circle(ctx, x + 24, y + 24, 25, c.accent);
      gfx.circle(ctx, x + 24, y + 24, 22, '#e8e0c8');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        px(ctx, x + 24 + Math.cos(a) * 18 - 1, y + 24 + Math.sin(a) * 18 - 1, 2, 2, '#2a2420');
      }
      gfx.limb(ctx, x + 24, y + 24, x + 24, y + 10, 2, '#2a2420');
      gfx.limb(ctx, x + 24, y + 24, x + 34, y + 28, 2, '#2a2420');
    },
    pendulum(ctx, x, y, th) {
      px(ctx, x + 5, 0, 2, 90, th.c.accent);
      gfx.circle(ctx, x + 6, 96, 9, th.c.accent);
      gfx.circle(ctx, x + 6, 96, 6, U.shade(th.c.accent, 0.3));
    },
    niche(ctx, x, y, th, rng, out) {
      px(ctx, x, y, 22, 26, '#0a0806');
      skull(ctx, x + 8, y + 16, th.c.accent, '#0a0806');
      px(ctx, x + 3, y + 22, 16, 2, U.shade(th.c.accent, -0.3));
    },
    bonepile(ctx, x, y, th, rng) {
      const b = G.CELL_PX_H - 32;
      for (let i = 0; i < 6; i++) skull(ctx, x + i * 5 - (i > 2 ? 12 : 0), b - 6 - (i > 2 ? 6 : 0), U.shade(th.c.accent, -0.2), '#1a1410');
    },
    stained(ctx, x, y, th, rng, out) {
      const w = 30, h = 64;
      const cols = ['#c83040', '#3050c8', '#d0b030', '#30a050', '#a040c0'];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + 15);
      ctx.arc(x + w / 2, y + 15, w / 2, Math.PI, 0);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.clip();
      for (let yy = y; yy < y + h; yy += 6)
        for (let xx = x; xx < x + w; xx += 6) px(ctx, xx, yy, 6, 6, U.shade(rng.pick(cols), -0.1 + rng.next() * 0.2));
      for (let yy = y; yy < y + h; yy += 6) px(ctx, x, yy, w, 1, '#1a1a1a');
      for (let xx = x; xx < x + w; xx += 6) px(ctx, xx, y, 1, h, '#1a1a1a');
      ctx.restore();
      ctx.strokeStyle = th.c.dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + 15);
      ctx.arc(x + w / 2, y + 15, w / 2, Math.PI, 0);
      ctx.lineTo(x + w, y + h);
      ctx.stroke();
      out.push({ x: x + w / 2, y: y + 34, r: 70, color: '#ffd0a0', i: 0.55 });
    },
    pew(ctx, x, y, th) {
      const b = G.CELL_PX_H - 32;
      px(ctx, x, b - 16, 40, 3, '#4a2a18');
      px(ctx, x, b - 26, 3, 26, '#4a2a18');
      px(ctx, x + 37, b - 16, 3, 16, '#3a1e10');
      px(ctx, x, b - 10, 40, 2, '#3a1e10');
    },
    organ(ctx, x, y, th) {
      for (let i = 0; i < 9; i++) {
        const h = 40 + Math.abs(4 - i) * -6 + 30;
        px(ctx, x + i * 6, y + 90 - h, 5, h, i % 2 ? '#b8a060' : '#d0b878');
        px(ctx, x + i * 6 + 1, y + 90 - h + 4, 3, 2, '#2a2010');
      }
    },
    throne(ctx, x, y, th) {
      const b = G.CELL_PX_H - 32;
      px(ctx, x, b - 60, 30, 60, '#3a0a10');
      px(ctx, x + 3, b - 56, 24, 52, '#6a1018');
      px(ctx, x - 3, b - 66, 36, 8, th.c.trim);
      px(ctx, x - 4, b - 22, 38, 6, th.c.trim);
    },
  };
  G.DECOR = DECOR;
  const gfx = G.gfx;

  // ---- Room pre-render ---------------------------------------------------------------
  function isSolidT(t) {
    return t === T.SOLID || t === T.BREAK || t === T.SPIKES || t === T.SEAL;
  }

  G.renderRoom = function (room) {
    const th = THEMES[room.def.theme || room.area.theme] || THEMES.entrance;
    room.theme = th;
    const rng = U.RNG(room.id + ':bg');
    const bg = gfx.makeCanvas(room.pw, room.ph);
    const bctx = gfx.ctxOf(bg);
    room.lightsStatic = [];
    if (bctx) {
      backWall(bctx, room, th, rng);
      if (room.def.outdoor) {
        // open sky: clear the upper part of the wall
        bctx.clearRect(0, 0, room.pw, room.ph);
        // distant battlement silhouette at the bottom of each cell
        for (let cy = 0; cy < room.def.h; cy++) {
          const by = cy * G.CELL_PX_H + G.CELL_PX_H - 32;
          for (let x = 0; x < room.pw; x += 16) {
            const h = 30 + ((x / 16) % 3) * 6;
            px(bctx, x, by - h, 14, h, U.shade(th.c.wall, 0.05));
            if ((x / 16) % 4 === 0) px(bctx, x + 4, by - h - 8, 6, 8, U.shade(th.c.wall, 0.05));
          }
        }
      }
      // decorations: a few per cell, avoiding the floor band
      const list = room.def.decor || (room.def.outdoor ? null : th.decor);
      if (list && !room.def.noDecor) {
        for (let cy = 0; cy < room.def.h; cy++)
          for (let cx = 0; cx < room.def.w; cx++) {
            const n = rng.int(2, 3);
            for (let k = 0; k < n; k++) {
              const kind = list[(cx + cy * 3 + k) % list.length];
              const fn = DECOR[kind];
              if (!fn) continue;
              const x = cx * G.CELL_PX_W + 24 + k * 120 + rng.int(0, 60);
              const y = cy * G.CELL_PX_H + rng.int(28, 60);
              // skip decorations whose anchor is inside solid rock
              const tx = Math.floor(x / TS), ty = Math.floor((y + 20) / TS);
              if (isSolidT(room.get(tx, ty)) || isSolidT(room.get(tx + 1, ty))) continue;
              if (room.def.outdoor && (kind === 'window' || kind === 'painting' || kind === 'portrait')) continue;
              bctx.save();
              const dy = cy * G.CELL_PX_H;
              // decorations that sit on the floor use cell-relative coordinates
              if (['statue', 'desk', 'globe', 'candelabra', 'scrollrack', 'lectern', 'crystal', 'bonepile', 'pew', 'throne', 'ladder'].includes(kind)) {
                bctx.translate(0, dy);
                fn(bctx, x, 0, th, rng, room.lightsStatic, room);
                room.lightsStatic.forEach((L) => {
                  if (!L._fixed) {
                    L.y += dy;
                    L._fixed = true;
                  }
                });
              } else {
                fn(bctx, x, y, th, rng, room.lightsStatic, room);
                room.lightsStatic.forEach((L) => (L._fixed = true));
              }
              bctx.restore();
            }
          }
      }
    }
    // foreground tiles
    const fg = gfx.makeCanvas(room.pw, room.ph);
    const fctx = gfx.ctxOf(fg);
    if (fctx) drawTiles(fctx, room, th);
    room.bgCanvas = bg;
    room.fgCanvas = fg;
    room.renderedVersion = room.version;
    room.needsFar = !!(room.def.outdoor || (th.decor || []).some((d) => d === 'window' || d === 'rift') || th.wall === 'none');
  };

  function drawTiles(fctx, room, th) {
    fctx.clearRect(0, 0, room.pw, room.ph);
    for (let ty = 0; ty < room.th; ty++)
      for (let tx = 0; tx < room.tw; tx++) {
        const t = room.get(tx, ty);
        if (t === T.EMPTY || t === T.WATER) continue;
        const x = tx * TS, y = ty * TS;
        const rng = U.RNG(U.hash(room.id) + tx * 7919 + ty * 104729);
        if (t === T.SOLID || t === T.BREAK) {
          const nb = {
            u: isSolidT(room.get(tx, ty - 1)),
            d: isSolidT(room.get(tx, ty + 1)),
            l: isSolidT(room.get(tx - 1, ty)),
            r: isSolidT(room.get(tx + 1, ty)),
          };
          const deep =
            nb.u && nb.d && nb.l && nb.r &&
            isSolidT(room.get(tx - 1, ty - 1)) && isSolidT(room.get(tx + 1, ty - 1)) &&
            isSolidT(room.get(tx - 1, ty + 1)) && isSolidT(room.get(tx + 1, ty + 1));
          solidTile(fctx, th, x, y, nb, rng, deep);
          if (t === T.BREAK) {
            px(fctx, x + 4, y + 5, 5, 1, U.shade(th.c.base, -0.45));
            px(fctx, x + 8, y + 6, 1, 4, U.shade(th.c.base, -0.45));
            px(fctx, x + 9, y + 10, 3, 1, U.shade(th.c.base, -0.45));
          }
        } else if (t === T.ONEWAY) platformTile(fctx, th, x, y, rng);
        else if (t === T.SLOPE_R) slopeTile(fctx, th, x, y, 1, rng);
        else if (t === T.SLOPE_L) slopeTile(fctx, th, x, y, -1, rng);
        else if (t === T.SPIKES) spikesTile(fctx, th, x, y, isSolidT(room.get(tx, ty - 1)) && !isSolidT(room.get(tx, ty + 1)));
        else if (t === T.GRATE) grateTile(fctx, th, x, y);
        else if (t === T.SEAL) sealTile(fctx, th, x, y, rng);
      }
  }
  G.redrawTiles = function (room) {
    const fctx = gfx.ctxOf(room.fgCanvas);
    if (fctx) drawTiles(fctx, room, room.theme);
    room.renderedVersion = room.version;
  };

  // ---- Far (parallax) layers -------------------------------------------------------------
  const farCache = {};
  function stars(key, w, h, n, seed) {
    if (farCache[key]) return farCache[key];
    const c = gfx.makeCanvas(w, h), x = gfx.ctxOf(c);
    const r = U.RNG(seed);
    for (let i = 0; i < n; i++) {
      const b = r.next();
      x.fillStyle = b > 0.9 ? '#ffffff' : b > 0.6 ? '#b8c0e8' : '#6a70a0';
      x.fillRect(r.int(0, w), r.int(0, h), 1, 1);
    }
    farCache[key] = c;
    return c;
  }
  function mountains(key, w, h, col, seed, amp, base) {
    if (farCache[key]) return farCache[key];
    const c = gfx.makeCanvas(w, h), x = gfx.ctxOf(c);
    const r = U.RNG(seed);
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, h);
    let y = base;
    for (let i = 0; i <= w; i += 8) {
      y = U.clamp(y + r.range(-amp, amp), base - amp * 3, h - 4);
      x.lineTo(i, y);
    }
    x.lineTo(w, h);
    x.closePath();
    x.fill();
    farCache[key] = c;
    return c;
  }
  function castleSilhouette(key, w, h, col) {
    if (farCache[key]) return farCache[key];
    const c = gfx.makeCanvas(w, h), x = gfx.ctxOf(c);
    const r = U.RNG(key);
    x.fillStyle = col;
    for (let i = 0; i < w; i += r.int(14, 30)) {
      const tw = r.int(8, 18), th = r.int(30, h - 20);
      x.fillRect(i, h - th, tw, th);
      x.beginPath();
      x.moveTo(i - 2, h - th);
      x.lineTo(i + tw / 2, h - th - r.int(10, 22));
      x.lineTo(i + tw + 2, h - th);
      x.fill();
      if (r.next() < 0.5) {
        x.fillStyle = '#e8c070';
        x.fillRect(i + 3, h - th + 8, 2, 3);
        x.fillStyle = col;
      }
    }
    x.fillRect(0, h - 22, w, 22);
    farCache[key] = c;
    return c;
  }
  function tileX(ctx, img, ox, y) {
    const w = img.width;
    let x = -(((ox % w) + w) % w);
    for (; x < G.W; x += w) ctx.drawImage(img, Math.round(x), Math.round(y));
  }

  G.drawFar = function (ctx, kind, camx, camy, t) {
    switch (kind) {
      case 'night':
      case 'redmoon': {
        const red = kind === 'redmoon';
        const g = ctx.createLinearGradient(0, 0, 0, G.H);
        g.addColorStop(0, red ? '#12030a' : '#070920');
        g.addColorStop(0.6, red ? '#2a0812' : '#16173a');
        g.addColorStop(1, red ? '#3a0c14' : '#2a2448');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, G.W, G.H);
        tileX(ctx, stars('stars', 384, 160, 120, 7), camx * 0.02, 0);
        // moon
        const mx = 300 - camx * 0.03, my = 46 - camy * 0.02;
        const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 70);
        mg.addColorStop(0, red ? 'rgba(255,80,80,0.35)' : 'rgba(200,210,255,0.3)');
        mg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mg;
        ctx.fillRect(mx - 70, my - 70, 140, 140);
        gfx.circle(ctx, mx, my, 22, red ? '#e04848' : '#e8e6d8');
        gfx.circle(ctx, mx - 7, my - 5, 5, red ? '#c03030' : '#cfcdbd');
        gfx.circle(ctx, mx + 6, my + 7, 3, red ? '#c03030' : '#cfcdbd');
        gfx.circle(ctx, mx + 9, my - 9, 2, red ? '#c03030' : '#cfcdbd');
        // clouds
        ctx.fillStyle = red ? 'rgba(60,10,20,0.55)' : 'rgba(30,32,70,0.6)';
        for (let i = 0; i < 6; i++) {
          const cx = ((i * 97 + t * 0.15 - camx * 0.08) % 520) - 60;
          const cy = 30 + ((i * 53) % 70) - camy * 0.04;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 46, 8, 0, 0, Math.PI * 2);
          ctx.ellipse(cx + 22, cy - 4, 26, 7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        tileX(ctx, mountains('mtn1', 512, 120, red ? '#1e0610' : '#141634', 3, 5, 40), camx * 0.1, G.H - 130 - camy * 0.05);
        tileX(ctx, castleSilhouette('cast1', 640, 140, red ? '#140408' : '#0c0d22'), camx * 0.2, G.H - 140 - camy * 0.08);
        tileX(ctx, mountains('mtn2', 512, 90, red ? '#0c0206' : '#080918', 9, 4, 50), camx * 0.35, G.H - 80 - camy * 0.12);
        break;
      }
      case 'void': {
        const g = ctx.createLinearGradient(0, 0, 0, G.H);
        g.addColorStop(0, '#0c0410');
        g.addColorStop(0.5, '#2a0a18');
        g.addColorStop(1, '#100408');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, G.W, G.H);
        // drifting pages and glyphs
        for (let i = 0; i < 28; i++) {
          const px0 = ((i * 137 + t * (0.1 + (i % 5) * 0.05) - camx * 0.15) % 460) - 40;
          const py0 = ((i * 71 + Math.sin(t * 0.01 + i) * 12 - camy * 0.1) % 260) - 20;
          ctx.globalAlpha = 0.25 + (i % 4) * 0.1;
          ctx.fillStyle = i % 3 ? '#e8d8b0' : '#e8c070';
          ctx.save();
          ctx.translate(px0, py0);
          ctx.rotate(Math.sin(t * 0.02 + i) * 0.6);
          ctx.fillRect(-4, -5, 8, 10);
          ctx.fillStyle = '#6a4a2a';
          ctx.fillRect(-2, -3, 4, 1);
          ctx.fillRect(-2, -1, 4, 1);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'cave': {
        ctx.fillStyle = '#04080c';
        ctx.fillRect(0, 0, G.W, G.H);
        break;
      }
      default:
        ctx.fillStyle = '#050407';
        ctx.fillRect(0, 0, G.W, G.H);
    }
  };

  // Animated water overlay for '~' tiles (drawn every frame)
  G.drawWater = function (ctx, room, camx, camy, t) {
    if (!room.hasWater) return;
    const x0 = Math.max(0, Math.floor(camx / TS)), x1 = Math.min(room.tw - 1, Math.floor((camx + G.W) / TS));
    const y0 = Math.max(0, Math.floor(camy / TS)), y1 = Math.min(room.th - 1, Math.floor((camy + G.H) / TS));
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (room.get(tx, ty) !== T.WATER) continue;
        const sx = tx * TS - camx, sy = ty * TS - camy;
        const top = room.get(tx, ty - 1) !== T.WATER;
        ctx.fillStyle = 'rgba(40,110,170,0.38)';
        ctx.fillRect(sx, sy, TS, TS);
        if (top) {
          for (let i = 0; i < TS; i += 2) {
            const wy = Math.round(Math.sin((tx * TS + i) * 0.2 + t * 0.08) * 1.2);
            ctx.fillStyle = 'rgba(160,220,255,0.75)';
            ctx.fillRect(sx + i, sy + wy, 2, 1);
          }
        }
      }
  };
})();
