/* Elegy of the Night — gfx.js
 * Canvas setup: a low-res world buffer (384x224) presented with crisp scaling,
 * a high-res UI layer for text, a sprite pipeline that turns procedural vector
 * drawings into clean pixel art (alpha threshold + palette snap + outline),
 * lighting, screen shake/flash.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util;
  const hasDOM = typeof document !== 'undefined';

  const F = {
    title: '"Cinzel", "Trajan Pro", Georgia, "Times New Roman", serif',
    body: '"Crimson Pro", "Iowan Old Style", Georgia, "Times New Roman", serif',
  };

  function makeCanvas(w, h, willRead) {
    if (!hasDOM) {
      return { width: w, height: h, getContext: () => null };
    }
    const c = document.createElement('canvas');
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    if (willRead) c._wr = true;
    return c;
  }
  function ctxOf(c) {
    if (!c.getContext) return null;
    if (!c._ctx) c._ctx = c.getContext('2d', c._wr ? { willReadFrequently: true } : undefined);
    return c._ctx;
  }

  const gfx = (G.gfx = {
    F,
    W: G.W,
    H: G.H,
    buf: null,
    ctx: null,
    main: null,
    mctx: null,
    k: 1, // device pixels per virtual pixel
    ox: 0, // device-pixel offset of the virtual screen
    oy: 0,
    dpr: 1,
    shakeT: 0,
    shakeMag: 0,
    shakeX: 0,
    shakeY: 0,
    flashT: 0,
    flashMax: 1,
    flashColor: '#ffffff',
    fade: 0, // 0..1 black overlay
    fadeColor: '#000000',
    lights: [],
    cache: new Map(),
    makeCanvas,
    ctxOf,
  });

  gfx.init = function (canvas) {
    gfx.main = canvas;
    gfx.mctx = canvas.getContext('2d', { alpha: false });
    gfx.buf = makeCanvas(G.W, G.H);
    gfx.ctx = ctxOf(gfx.buf);
    gfx.ctx.imageSmoothingEnabled = false;
    gfx.light = makeCanvas(G.W, G.H);
    gfx.lctx = ctxOf(gfx.light);
    gfx.mid = makeCanvas(G.W, G.H); // integer-upscaled intermediate
    gfx.midCtx = ctxOf(gfx.mid);
    gfx.resize();
    if (hasDOM) {
      window.addEventListener('resize', gfx.resize);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', gfx.resize);
    }
  };

  gfx.resize = function () {
    const c = gfx.main;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const rect = c.parentElement ? c.parentElement.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    const cw = Math.max(64, Math.floor(rect.width));
    const ch = Math.max(64, Math.floor(rect.height));
    c.style.width = cw + 'px';
    c.style.height = ch + 'px';
    c.width = Math.floor(cw * dpr);
    c.height = Math.floor(ch * dpr);
    gfx.dpr = dpr;
    let k = Math.min(c.width / G.W, c.height / G.H);
    // Prefer integer scale when it costs little space
    const ki = Math.floor(k);
    if (ki >= 2 && k - ki < 0.12) k = ki;
    gfx.k = k;
    gfx.ox = Math.floor((c.width - G.W * k) / 2);
    gfx.oy = Math.floor((c.height - G.H * k) / 2);
    // portrait phones: pin the screen to the top, leaving the lower half for touch controls
    gfx.portrait = c.height > c.width * 1.15;
    if (gfx.portrait) gfx.oy = Math.floor(Math.min(gfx.oy, 12 * dpr));
    try {
      document.documentElement.style.setProperty('--screen-bottom', Math.round((gfx.oy + G.H * k) / dpr) + 'px');
      document.body.classList.toggle('portrait', gfx.portrait);
    } catch (e) {}
    const n = Math.max(1, Math.ceil(k));
    if (gfx.mid.width !== G.W * n) {
      gfx.mid.width = G.W * n;
      gfx.mid.height = G.H * n;
      gfx.midCtx = gfx.mid.getContext('2d');
    }
    gfx.midN = n;
    gfx.mctx.imageSmoothingEnabled = false;
    gfx.cssScale = k / dpr;
    G.emit('resize');
  };

  // Converts a client (CSS) point to virtual coordinates.
  gfx.toVirtual = function (cx, cy) {
    const r = gfx.main.getBoundingClientRect();
    const x = ((cx - r.left) * gfx.dpr - gfx.ox) / gfx.k;
    const y = ((cy - r.top) * gfx.dpr - gfx.oy) / gfx.k;
    return { x, y };
  };

  gfx.shake = function (mag, frames) {
    if (G.settings && G.settings.shake === false) return;
    gfx.shakeMag = Math.max(gfx.shakeMag, mag);
    gfx.shakeT = Math.max(gfx.shakeT, frames || 12);
  };
  gfx.flash = function (color, frames) {
    if (G.settings && G.settings.flashes === false) return;
    gfx.flashColor = color || '#ffffff';
    gfx.flashT = gfx.flashMax = frames || 6;
  };

  gfx.beginFrame = function () {
    const ctx = gfx.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, G.W, G.H);
    gfx.lights.length = 0;
    if (gfx.shakeT > 0) {
      gfx.shakeT--;
      const m = gfx.shakeMag * Math.min(1, gfx.shakeT / 8);
      gfx.shakeX = Math.round(U.rnd(-m, m));
      gfx.shakeY = Math.round(U.rnd(-m, m));
      if (gfx.shakeT === 0) gfx.shakeMag = 0;
    } else {
      gfx.shakeX = gfx.shakeY = 0;
    }
  };

  // Lighting: darkness 0..1, lights in screen (buffer) coordinates.
  gfx.addLight = function (x, y, r, color, intensity) {
    gfx.lights.push({ x, y, r, color: color || null, i: intensity == null ? 1 : intensity });
  };
  gfx.applyLighting = function (darkness, tint) {
    const ctx = gfx.ctx;
    // additive glows (always, subtle)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const L of gfx.lights) {
      if (!L.color) continue;
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * 0.6);
      g.addColorStop(0, U.rgba(L.color, 0.22 * L.i));
      g.addColorStop(1, U.rgba(L.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    ctx.restore();
    if (!darkness || darkness <= 0.01) return;
    const l = gfx.lctx;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, G.W, G.H);
    l.fillStyle = U.rgba(tint || '#05040a', darkness);
    l.fillRect(0, 0, G.W, G.H);
    l.globalCompositeOperation = 'destination-out';
    for (const L of gfx.lights) {
      const g = l.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      g.addColorStop(0, 'rgba(0,0,0,' + Math.min(1, L.i) + ')');
      g.addColorStop(0.55, 'rgba(0,0,0,' + Math.min(1, L.i) * 0.6 + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    l.globalCompositeOperation = 'source-over';
    ctx.drawImage(gfx.light, 0, 0);
  };

  gfx.present = function () {
    const m = gfx.mctx, ctx = gfx.ctx;
    // flash & fade happen in buffer space
    if (gfx.flashT > 0) {
      ctx.globalAlpha = (gfx.flashT / gfx.flashMax) * 0.7;
      ctx.fillStyle = gfx.flashColor;
      ctx.fillRect(0, 0, G.W, G.H);
      ctx.globalAlpha = 1;
      gfx.flashT--;
    }
    if (gfx.fade > 0) {
      ctx.globalAlpha = U.clamp(gfx.fade, 0, 1);
      ctx.fillStyle = gfx.fadeColor;
      ctx.fillRect(0, 0, G.W, G.H);
      ctx.globalAlpha = 1;
    }
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.fillStyle = '#000';
    m.fillRect(0, 0, gfx.main.width, gfx.main.height);
    const k = gfx.k;
    const dx = gfx.ox + gfx.shakeX * k, dy = gfx.oy + gfx.shakeY * k;
    if (Math.abs(k - Math.round(k)) < 0.001) {
      m.imageSmoothingEnabled = false;
      m.drawImage(gfx.buf, 0, 0, G.W, G.H, Math.round(dx), Math.round(dy), G.W * k, G.H * k);
    } else {
      // sharp-bilinear: nearest upscale by an integer, then smooth to final size
      const n = gfx.midN, mc = gfx.midCtx;
      mc.imageSmoothingEnabled = false;
      mc.drawImage(gfx.buf, 0, 0, G.W, G.H, 0, 0, G.W * n, G.H * n);
      m.imageSmoothingEnabled = true;
      m.imageSmoothingQuality = 'high';
      m.drawImage(gfx.mid, 0, 0, G.W * n, G.H * n, dx, dy, G.W * k, G.H * k);
    }
  };

  // Switch the main context to UI space (virtual coords, high-res).
  gfx.ui = function () {
    const m = gfx.mctx;
    m.setTransform(gfx.k, 0, 0, gfx.k, gfx.ox, gfx.oy);
    m.globalAlpha = 1;
    m.imageSmoothingEnabled = false;
    return m;
  };

  // ---- Text (UI layer) ------------------------------------------------------
  gfx.font = function (size, kind, weight, italic) {
    return (italic ? 'italic ' : '') + (weight || (kind === 'title' ? 700 : 500)) + ' ' + size + 'px ' + (F[kind] || F.body);
  };
  gfx.text = function (str, x, y, o) {
    o = o || {};
    const m = gfx.mctx;
    m.font = gfx.font(o.size || 8, o.font || 'body', o.weight, o.italic);
    m.textAlign = o.align || 'left';
    m.textBaseline = o.baseline || 'alphabetic';
    const a = o.alpha == null ? 1 : o.alpha;
    m.globalAlpha = a;
    if (o.shadow !== false) {
      m.fillStyle = o.shadowColor || 'rgba(0,0,0,0.85)';
      m.fillText(str, x + 0.6, y + 0.6, o.maxWidth);
    }
    if (o.stroke) {
      m.lineWidth = o.strokeWidth || 1.2;
      m.strokeStyle = o.stroke;
      m.lineJoin = 'round';
      m.strokeText(str, x, y, o.maxWidth);
    }
    if (o.gradient) {
      const g = m.createLinearGradient(0, y - (o.size || 8), 0, y + 1);
      o.gradient.forEach((c, i) => g.addColorStop(i / (o.gradient.length - 1), c));
      m.fillStyle = g;
    } else m.fillStyle = o.color || '#e8e2d0';
    m.fillText(str, x, y, o.maxWidth);
    m.globalAlpha = 1;
  };
  gfx.measure = function (str, size, kind, weight) {
    const m = gfx.mctx;
    m.font = gfx.font(size || 8, kind || 'body', weight);
    return m.measureText(str).width;
  };
  // word-wrap into lines that fit width (virtual px)
  gfx.wrap = function (str, width, size, kind) {
    const out = [];
    String(str)
      .split('\n')
      .forEach((para) => {
        const words = para.split(' ');
        let line = '';
        for (const w of words) {
          const t = line ? line + ' ' + w : w;
          if (gfx.measure(t, size, kind) > width && line) {
            out.push(line);
            line = w;
          } else line = t;
        }
        out.push(line);
      });
    return out;
  };

  // SotN-style window panel on the UI layer
  gfx.panel = function (x, y, w, h, o) {
    o = o || {};
    const m = gfx.mctx;
    m.save();
    const g = m.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.top || 'rgba(18,22,58,0.94)');
    g.addColorStop(1, o.bottom || 'rgba(6,6,22,0.96)');
    m.fillStyle = g;
    m.fillRect(x, y, w, h);
    m.lineWidth = 0.8;
    m.strokeStyle = o.border || 'rgba(196,204,230,0.85)';
    m.strokeRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8);
    m.lineWidth = 0.5;
    m.strokeStyle = o.inner || 'rgba(120,128,176,0.55)';
    m.strokeRect(x + 2, y + 2, w - 4, h - 4);
    // corner ornaments
    m.fillStyle = o.corner || '#c9b37a';
    const c = 2.2;
    [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy]) => {
      m.beginPath();
      m.moveTo(cx, cy - c);
      m.lineTo(cx + c, cy);
      m.lineTo(cx, cy + c);
      m.lineTo(cx - c, cy);
      m.closePath();
      m.fill();
    });
    m.restore();
  };

  // ---- Sprite pipeline -------------------------------------------------------
  const paletteCache = new Map();
  function parsePalette(pal) {
    const key = pal.join(',');
    let p = paletteCache.get(key);
    if (!p) {
      p = pal.map(U.hex2rgb);
      paletteCache.set(key, p);
    }
    return p;
  }

  /* pixelize(canvas, opts)
   *  opts.threshold: alpha cut (0..255, default 110)
   *  opts.palette: array of hex colors to snap to (optional)
   *  opts.outline: hex color for a 1px outer outline (optional)
   *  opts.outlineDiag: also outline diagonals
   */
  gfx.pixelize = function (cv, o) {
    o = o || {};
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return cv;
    const w = cv.width, h = cv.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const thr = o.threshold == null ? 110 : o.threshold;
    const pal = o.palette ? parsePalette(o.palette) : null;
    const n = w * h;
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      if (d[j + 3] < thr) {
        d[j + 3] = 0;
        continue;
      }
      d[j + 3] = 255;
      if (pal) {
        let best = 0, bd = 1e9;
        const r = d[j], g = d[j + 1], b = d[j + 2];
        for (let p = 0; p < pal.length; p++) {
          const c = pal[p];
          const dr = r - c[0], dg = g - c[1], db = b - c[2];
          const dd = dr * dr * 3 + dg * dg * 4 + db * db * 2;
          if (dd < bd) {
            bd = dd;
            best = p;
          }
        }
        const c = pal[best];
        d[j] = c[0];
        d[j + 1] = c[1];
        d[j + 2] = c[2];
      }
    }
    if (o.outline) {
      const oc = U.hex2rgb(o.outline);
      const solid = new Uint8Array(n);
      for (let i = 0; i < n; i++) solid[i] = d[i * 4 + 3] ? 1 : 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (solid[i]) continue;
          let near =
            (x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w]);
          if (!near && o.outlineDiag)
            near =
              (x > 0 && y > 0 && solid[i - w - 1]) ||
              (x < w - 1 && y > 0 && solid[i - w + 1]) ||
              (x > 0 && y < h - 1 && solid[i + w - 1]) ||
              (x < w - 1 && y < h - 1 && solid[i + w + 1]);
          if (near) {
            const j = i * 4;
            d[j] = oc[0];
            d[j + 1] = oc[1];
            d[j + 2] = oc[2];
            d[j + 3] = 255;
          }
        }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  };

  // Cached sprite: draw(ctx, w, h) is called once per key.
  gfx.sprite = function (key, w, h, draw, opts) {
    let c = gfx.cache.get(key);
    if (c) return c;
    c = makeCanvas(w, h, true);
    const ctx = ctxOf(c);
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      draw(ctx, w, h);
      if (!opts || opts.pixelize !== false) gfx.pixelize(c, opts);
    }
    gfx.cache.set(key, c);
    return c;
  };

  // White silhouette version of a sprite (hit flash)
  gfx.whiteOf = function (img, color) {
    const key = img;
    if (!gfx._white) gfx._white = new WeakMap();
    let m = gfx._white.get(key);
    const col = color || '#ffffff';
    if (m && m[col]) return m[col];
    const c = makeCanvas(img.width, img.height);
    const x = ctxOf(c);
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = col;
    x.fillRect(0, 0, c.width, c.height);
    if (!m) {
      m = {};
      gfx._white.set(key, m);
    }
    m[col] = c;
    return c;
  };

  // Uncached tinted copy into a reusable canvas (for sprites redrawn every frame)
  const tintPool = {};
  gfx.tintFresh = function (img, color, slot) {
    const key = (slot || 'a') + img.width + 'x' + img.height;
    let c = tintPool[key];
    if (!c) c = tintPool[key] = makeCanvas(img.width, img.height);
    const x = ctxOf(c);
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color || '#ffffff';
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-over';
    return c;
  };

  /* Draw an image on the buffer with an anchor point (ax, ay inside the image)
   * placed at (x, y). flip mirrors horizontally around the anchor. */
  gfx.drawAnchored = function (img, x, y, ax, ay, flip, alpha, ctx) {
    ctx = ctx || gfx.ctx;
    if (!img) return;
    if (alpha != null && alpha < 1) ctx.globalAlpha = alpha;
    if (flip) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.scale(-1, 1);
      ctx.drawImage(img, -ax, -Math.round(ay));
      ctx.restore();
    } else {
      ctx.drawImage(img, Math.round(x - ax), Math.round(y - ay));
    }
    if (alpha != null && alpha < 1) ctx.globalAlpha = 1;
  };

  /* ASCII pixel art → canvas. rows: array of strings; pal: {char: '#hex'}.
   * '.' and ' ' are transparent. */
  gfx.ascii = function (key, rows, pal, opts) {
    let c = gfx.cache.get(key);
    if (c) return c;
    const h = rows.length, w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    c = makeCanvas(w, h);
    const ctx = ctxOf(c);
    if (ctx) {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < rows[y].length; x++) {
          const ch = rows[y][x];
          const col = pal[ch];
          if (!col) continue;
          ctx.fillStyle = col;
          ctx.fillRect(x, y, 1, 1);
        }
      if (opts && opts.outline) gfx.pixelize(c, { outline: opts.outline, threshold: 1 });
    }
    gfx.cache.set(key, c);
    return c;
  };

  // Recolor a cached canvas through a color map {fromHex: toHex}
  gfx.recolor = function (key, src, map) {
    let c = gfx.cache.get(key);
    if (c) return c;
    c = makeCanvas(src.width, src.height, true);
    const ctx = ctxOf(c);
    if (ctx) {
      ctx.drawImage(src, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
      const pairs = Object.keys(map).map((k) => [U.hex2rgb(k), U.hex2rgb(map[k])]);
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        for (const [f, t] of pairs)
          if (d[i] === f[0] && d[i + 1] === f[1] && d[i + 2] === f[2]) {
            d[i] = t[0];
            d[i + 1] = t[1];
            d[i + 2] = t[2];
            break;
          }
      }
      ctx.putImageData(img, 0, 0);
    }
    gfx.cache.set(key, c);
    return c;
  };

  // Small drawing helpers on any ctx (vector, before pixelize)
  gfx.limb = function (ctx, x1, y1, x2, y2, w, col) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  gfx.poly = function (ctx, pts, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  };
  gfx.circle = function (ctx, x, y, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  gfx.ellipse = function (ctx, x, y, rx, ry, rot, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
    ctx.fill();
  };
  // crisp pixel rect on buffer
  gfx.rect = function (x, y, w, h, col, ctx) {
    ctx = ctx || gfx.ctx;
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
})();
