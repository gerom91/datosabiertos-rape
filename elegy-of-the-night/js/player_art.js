/* Elegy of the Night — player_art.js
 * Alucard as a procedural puppet: jointed limbs, silver hair and a cape
 * simulated with verlet physics, rendered to a small canvas each frame and
 * snapped to a palette with a dark outline so it reads as pixel art.
 * Also: bat, wolf and mist forms, weapon art and slash effects.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const U = G.util, gfx = G.gfx;

  const C = (G.ALU_COL = {
    skin: '#f4e2d6', skinS: '#cfae9e', hair: '#eef2f8', hairS: '#b4bed2', hairD: '#7e88a2',
    coat: '#1c1e30', coatH: '#3a4064', coatD: '#0e0f1a', gold: '#d4ac52', goldD: '#8a6a2a',
    white: '#ecebf4', pants: '#24263c', boot: '#2c1c1c', bootH: '#5a3a34',
    capeO: '#16121c', capeOH: '#2e2640', capeI: '#9a1426', capeIH: '#d0303e', eye: '#ff3048',
    steel: '#cfd6e6', steelD: '#6a7090', steelL: '#ffffff', hilt: '#8a6a2a', outline: '#07050b',
  });
  const BASE_PAL = Object.values(C).filter((c, i, a) => a.indexOf(c) === i && c !== C.outline);

  const CW = 128, CH = 84, AX = 64, AY = 76;
  let canvas = null, ctx = null;

  function ensure() {
    if (!canvas) {
      canvas = gfx.makeCanvas(CW, CH, true);
      ctx = gfx.ctxOf(canvas);
    }
  }

  // ---- Pose library ------------------------------------------------------------------
  const P = (a) => Object.assign({ hipX: 0, hipY: -21, lean: 0, head: 0, legF: [0, 0], legB: [0, 0], armF: [0.15, 0.25], armB: [-0.12, 0.3], rot: 0, coatFlare: 0 }, a);

  G.alucardPose = function (st, t, o) {
    o = o || {};
    switch (st) {
      case 'idle': {
        const b = Math.sin(t * 0.06);
        return P({ hipY: -21 + b * 0.4, lean: 0.02, legF: [0.12, 0.08], legB: [-0.16, 0.06], armF: [0.12 + b * 0.03, 0.35], armB: [-0.22, 0.4] });
      }
      case 'walk': {
        const ph = t * 0.16;
        const s = Math.sin(ph), c = Math.cos(ph);
        return P({
          hipY: -21 + Math.abs(c) * 0.9 - 0.6,
          lean: 0.07,
          legF: [s * 0.55, Math.max(0, -c) * 0.9 + 0.1],
          legB: [-s * 0.55, Math.max(0, c) * 0.9 + 0.1],
          armF: [-s * 0.4 + 0.05, 0.35],
          armB: [s * 0.4 - 0.05, 0.35],
          coatFlare: 0.3,
        });
      }
      case 'crouch':
        return P({ hipY: -12, lean: 0.25, legF: [1.25, 2.3], legB: [0.6, 2.25], armF: [0.6, 0.6], armB: [0.2, 0.6], coatFlare: 0.4 });
      case 'jump':
        return P({ hipY: -22, lean: 0.05, legF: [0.85, 1.35], legB: [0.1, 0.6], armF: [0.6, 0.9], armB: [-0.6, 0.4], coatFlare: 0.6 });
      case 'fall':
        return P({ hipY: -22, lean: -0.04, legF: [0.25, 0.25], legB: [-0.2, 0.35], armF: [0.9, 0.5], armB: [-0.9, 0.3], coatFlare: 0.8 });
      case 'flip': {
        const p = P({ hipY: -20, lean: 0.2, legF: [1.4, 2.2], legB: [1.1, 2.0], armF: [1.0, 1.2], armB: [0.6, 1.2], coatFlare: 0.6 });
        p.rot = o.rot || 0;
        return p;
      }
      case 'backdash':
        return P({ hipY: -20, lean: 0.32, legF: [0.55, 0.5], legB: [-0.55, 0.2], armF: [-0.4, 0.5], armB: [-0.9, 0.3], coatFlare: 0.7 });
      case 'land':
        return P({ hipY: -17, lean: 0.18, legF: [0.7, 1.4], legB: [0.1, 1.1], armF: [0.4, 0.5], armB: [-0.3, 0.5] });
      case 'hurt':
        return P({ hipY: -20, lean: -0.38, head: -0.3, legF: [0.4, 0.6], legB: [-0.1, 0.5], armF: [1.6, 0.6], armB: [-1.2, 0.4], coatFlare: 0.6 });
      case 'dead':
        return P({ hipY: -9, lean: -1.25, head: -0.4, legF: [1.5, 0.2], legB: [1.4, 0.3], armF: [2.4, 0.2], armB: [2.0, 0.3], coatFlare: 0.2 });
      case 'kneel':
        return P({ hipY: -13, lean: 0.35, head: 0.25, legF: [1.4, 1.6], legB: [0.1, 2.6], armF: [0.4, 0.9], armB: [0.1, 0.5] });
      case 'cast': {
        const b = Math.sin(t * 0.3) * 0.05;
        return P({ hipY: -21, lean: -0.08, head: -0.12, legF: [0.25, 0.1], legB: [-0.25, 0.1], armF: [2.3 + b, 0.3], armB: [-2.2 - b, 0.3], coatFlare: 0.9 });
      }
      case 'dive':
        return P({ hipY: -24, lean: 0.55, legF: [0.9, 0.0], legB: [-0.1, 1.6], armF: [-0.3, 0.6], armB: [-1.0, 0.5], coatFlare: 1 });
      case 'superjump':
        return P({ hipY: -22, lean: -0.05, head: -0.25, legF: [0.05, 0.1], legB: [-0.05, 0.15], armF: [2.9, 0.1], armB: [-0.3, 0.2], coatFlare: 1 });
      case 'guard':
        return P({ hipY: -20, lean: 0.12, legF: [0.4, 0.4], legB: [-0.35, 0.3], armF: [1.2, 1.4], armB: [-0.2, 0.5] });
      case 'attack': {
        // o.phase: 0..1 over windup, 1..2 active, 2..3 recover; o.wtype
        const ph = o.phase || 0, w = o.wtype || 'sword', crouch = o.crouch;
        const base = crouch ? { hipY: -12, lean: 0.3, legF: [1.25, 2.3], legB: [0.6, 2.25] } : { hipY: -21, lean: 0.12, legF: [0.5, 0.3], legB: [-0.45, 0.2] };
        let armF, armB = [-0.6, 0.5], lean = base.lean;
        if (w === 'great' || w === 'mace') {
          // overhead arc: windup raises arm high behind, active sweeps down-forward
          const a = ph < 1 ? U.lerp(0.4, 2.9, U.ease.out(ph)) : ph < 2 ? U.lerp(2.9, 0.9, U.ease.out(ph - 1)) : U.lerp(0.9, 0.7, ph - 2);
          armF = [a, 0.2];
          armB = [a - 0.4, 0.4];
          lean += ph < 1 ? -0.1 : 0.15;
        } else if (w === 'whip') {
          const a = ph < 1 ? U.lerp(0.5, 2.8, ph) : ph < 2 ? U.lerp(2.8, 1.45, U.ease.out(Math.min(1, (ph - 1) * 2))) : 1.45;
          armF = [a, 0.15];
          lean += ph < 1 ? -0.12 : 0.1;
        } else if (w === 'tome') {
          armF = ph < 1 ? [0.9, 1.4] : [1.45, 0.25];
          armB = [0.5, 1.6];
        } else if (w === 'fist') {
          armF = ph < 1 ? [0.6, 1.8] : ph < 2 ? [1.52, 0.05] : [1.0, 0.9];
          armB = [0.4, 1.8];
        } else {
          // thrust / slash: arm pulled back then extended
          if (ph < 1) armF = [U.lerp(0.4, 0.15, ph), U.lerp(1.0, 1.9, ph)];
          else if (ph < 2) armF = [1.55, 0.04];
          else armF = [U.lerp(1.55, 0.9, ph - 2), U.lerp(0.04, 0.6, ph - 2)];
          lean += ph >= 1 && ph < 2 ? 0.1 : 0;
        }
        return P(Object.assign({}, base, { lean, armF, armB, coatFlare: 0.5 }));
      }
    }
    return P({});
  };

  // ---- Weapon geometry used by both art and hitboxes --------------------------------
  function weaponAngle(pose) {
    // direction of the forearm
    const a1 = pose.armF[0], a2 = a1 + pose.armF[1];
    return a2;
  }

  // ---- Drawing --------------------------------------------------------------------------------
  function limb(x1, y1, x2, y2, w, col) {
    gfx.limb(ctx, x1, y1, x2, y2, w, col);
  }

  /* drawAlucard(pose, cape, hair, opts) → canvas with anchor (AX, AY)
   * cape/hair: arrays of {x,y} in LOCAL space (facing right, origin at feet). */
  G.drawAlucard = function (pose, cape, hair, opts) {
    ensure();
    opts = opts || {};
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    ctx.translate(AX, AY);
    if (pose.rot) {
      ctx.translate(0, -20);
      ctx.rotate(pose.rot);
      ctx.translate(0, 20);
    }
    const col = opts.col || C;
    const capeOuter = opts.capeCol || col.capeO, capeInner = opts.liningCol || col.capeI;

    const hx = pose.hipX, hy = pose.hipY, ln = pose.lean;
    const sl = Math.sin(ln), cl = Math.cos(ln);
    const neckX = hx + sl * 14, neckY = hy - cl * 14;
    const shX = hx + sl * 12.5, shY = hy - cl * 12.5;
    const headX = hx + sl * 18.5 + Math.sin(pose.head) * 1, headY = hy - cl * 18.5;

    // limb kinematics
    function legPts(l, off) {
      const kx = hx + off + Math.sin(l[0]) * 11, ky = hy + Math.cos(l[0]) * 11;
      const a2 = l[0] - l[1];
      const fx = kx + Math.sin(a2) * 11, fy = ky + Math.cos(a2) * 11;
      return [hx + off, hy, kx, ky, fx, fy];
    }
    function armPts(a, off) {
      const sx = shX + off, sy = shY;
      const ex = sx + Math.sin(a[0]) * 8, ey = sy + Math.cos(a[0]) * 8;
      const a2 = a[0] + a[1];
      const hx2 = ex + Math.sin(a2) * 7.5, hy2 = ey + Math.cos(a2) * 7.5;
      return [sx, sy, ex, ey, hx2, hy2, a2];
    }
    const LB = legPts(pose.legB, -1), LF = legPts(pose.legF, 1);
    const AB = armPts(pose.armB, -2), AF = armPts(pose.armF, 1);

    // ---- cape (behind everything) ----
    if (cape && cape.length > 2) {
      ctx.fillStyle = capeOuter;
      ctx.beginPath();
      ctx.moveTo(neckX + 1, neckY + 1);
      ctx.lineTo(shX - 3, shY);
      for (const p of cape) ctx.lineTo(p.x, p.y);
      const last = cape[cape.length - 1];
      ctx.lineTo(Math.min(last.x + 4, hx + 2), Math.max(last.y - 2, hy + 6));
      ctx.lineTo(hx - 2, hy + 2);
      ctx.closePath();
      ctx.fill();
      // red lining along the trailing edge
      ctx.strokeStyle = capeInner;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cape[1].x + 0.8, cape[1].y);
      for (let i = 2; i < cape.length; i++) ctx.lineTo(cape[i].x + 0.8, cape[i].y - 0.5);
      ctx.stroke();
      ctx.strokeStyle = col.capeOH;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(shX - 2, shY + 2);
      ctx.lineTo(cape[Math.min(3, cape.length - 1)].x + 3, cape[Math.min(3, cape.length - 1)].y);
      ctx.stroke();
    }
    // ---- hair (behind head) ----
    if (hair && hair.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 0; i < hair.length - 1; i++) {
        const w = 5 - i * 1.0;
        limb(hair[i].x, hair[i].y, hair[i + 1].x, hair[i + 1].y, Math.max(1.4, w), i > 1 ? col.hairS : col.hair);
      }
    }
    // ---- back arm ----
    limb(AB[0], AB[1], AB[2], AB[3], 3.2, col.coatD);
    limb(AB[2], AB[3], AB[4], AB[5], 2.8, col.coatD);
    gfx.circle(ctx, AB[4], AB[5], 1.4, col.skinS);
    // ---- back leg ----
    limb(LB[0], LB[1], LB[2], LB[3], 4, col.pants);
    limb(LB[2], LB[3], LB[4], LB[5], 3.4, col.boot);
    ctx.fillStyle = col.boot;
    ctx.fillRect(LB[4] - 1.5, LB[5] - 2, 5, 2.4);
    // ---- coat tails ----
    const fl = pose.coatFlare || 0;
    ctx.fillStyle = col.coat;
    ctx.beginPath();
    ctx.moveTo(hx - 4, hy - 3);
    ctx.lineTo(hx + 4, hy - 3);
    ctx.lineTo(hx + 5 + fl * 2, hy + 9);
    ctx.lineTo(hx + 1, hy + 10);
    ctx.lineTo(hx - 3 - fl * 4, hy + 11 - fl * 2);
    ctx.lineTo(hx - 6 - fl * 3, hy + 8);
    ctx.closePath();
    ctx.fill();
    // ---- front leg ----
    limb(LF[0], LF[1], LF[2], LF[3], 4.2, col.pants);
    limb(LF[2], LF[3], LF[4], LF[5], 3.6, col.boot);
    limb(LF[2] + 0.5, LF[3] + 1, LF[4] + 0.5, LF[5] - 3, 1, col.bootH);
    ctx.fillStyle = col.boot;
    ctx.fillRect(LF[4] - 1.5, LF[5] - 2.2, 5.5, 2.6);
    // ---- torso ----
    ctx.fillStyle = col.coat;
    ctx.beginPath();
    ctx.moveTo(hx - 3.6, hy + 1);
    ctx.lineTo(hx + 3.8, hy + 1);
    ctx.lineTo(shX + 4.6, shY + 1);
    ctx.lineTo(neckX + 2, neckY);
    ctx.lineTo(neckX - 3, neckY);
    ctx.lineTo(shX - 4.6, shY + 1);
    ctx.closePath();
    ctx.fill();
    // lapel highlight & gold trim
    limb(hx + 3, hy, shX + 3.6, shY + 1.5, 1, col.coatH);
    limb(hx - 3.2, hy - 1, hx + 3.4, hy - 1, 1.6, col.gold);
    gfx.circle(ctx, hx + 1.5 + sl * 6, hy - cl * 6, 0.8, col.gold);
    gfx.circle(ctx, hx + 1.5 + sl * 9, hy - cl * 9, 0.8, col.gold);
    // cravat
    ctx.fillStyle = col.white;
    ctx.beginPath();
    ctx.moveTo(neckX - 0.5, neckY);
    ctx.lineTo(neckX + 2.4, neckY);
    ctx.lineTo(neckX + 1.5 + sl * 1, neckY + 5);
    ctx.lineTo(neckX - 0.2, neckY + 3.5);
    ctx.closePath();
    ctx.fill();
    // collar of the cape around the shoulders
    ctx.fillStyle = capeOuter;
    ctx.beginPath();
    ctx.moveTo(neckX - 4.5, neckY - 2.5);
    ctx.lineTo(neckX - 1, neckY - 1);
    ctx.lineTo(shX - 1, shY + 4);
    ctx.lineTo(shX - 6, shY + 3);
    ctx.closePath();
    ctx.fill();
    // ---- head ----
    gfx.ellipse(ctx, headX + 0.3, headY, 3.6, 4.4, 0, col.skin);
    // hair cap and fringe
    ctx.fillStyle = col.hair;
    ctx.beginPath();
    ctx.ellipse(headX - 0.8, headY - 1.8, 4.3, 3.6, -0.2, Math.PI * 0.9, Math.PI * 2.15);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(headX - 4.6, headY - 2);
    ctx.lineTo(headX - 2, headY - 3);
    ctx.lineTo(headX - 4.2, headY + 4.5);
    ctx.lineTo(headX - 5.2, headY + 3);
    ctx.closePath();
    ctx.fill();
    // fringe locks over the forehead
    ctx.fillStyle = col.hairS;
    ctx.fillRect(headX + 1.2, headY - 3.6, 2.6, 1.2);
    ctx.fillStyle = col.hair;
    ctx.fillRect(headX - 0.5, headY - 4.2, 3.8, 1.1);
    // eye & face shade
    ctx.fillStyle = opts.eyeCol || col.eye;
    ctx.fillRect(headX + 1.6, headY - 0.6, 1.2, 1);
    ctx.fillStyle = col.skinS;
    ctx.fillRect(headX + 2.6, headY + 2, 1, 1);
    // ---- weapon (behind front arm hand) ----
    const wp = opts.weapon;
    let tip = null;
    if (wp) tip = drawWeapon(wp, AF, pose, col);
    // ---- front arm ----
    limb(AF[0], AF[1], AF[2], AF[3], 3.4, col.coat);
    limb(AF[2], AF[3], AF[4], AF[5], 3, col.coat);
    limb(AF[0] + 0.6, AF[1], AF[2] + 0.6, AF[3], 1, col.coatH);
    // cuff + hand
    gfx.circle(ctx, AF[4], AF[5], 1.6, col.white);
    gfx.circle(ctx, AF[4] + Math.sin(AF[6]) * 1.2, AF[5] + Math.cos(AF[6]) * 1.2, 1.5, col.skin);
    if (opts.shield) drawShield(opts.shield, AF, col);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const pal = opts.extraPal ? BASE_PAL.concat(opts.extraPal) : BASE_PAL;
    gfx.pixelize(canvas, { palette: pal, outline: C.outline, threshold: 96 });
    canvas.anchorX = AX;
    canvas.anchorY = AY;
    return { canvas, hand: { x: AF[4], y: AF[5] }, tip };
  };

  function drawWeapon(wp, AF, pose, col) {
    const it = wp.item;
    const ang = wp.angle != null ? wp.angle : AF[6];
    const hx = AF[4], hy = AF[5];
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const steel = it.col || col.steel;
    const w = it.wtype;
    if (w === 'sword' || w === 'short' || w === 'great' || w === 'rapier') {
      const L = it.len || 18;
      const bw = w === 'great' ? 3.6 : w === 'rapier' ? 1.4 : w === 'short' ? 2.2 : 2.6;
      const tx = hx + dx * L, ty = hy + dy * L;
      limb(hx, hy, tx, ty, bw, steel);
      limb(hx + dx * 2, hy + dy * 2, tx - dx * 2, ty - dy * 2, 1, U.shade(steel, 0.5));
      // guard
      limb(hx - dy * 3, hy + dx * 3, hx + dy * 3, hy - dx * 3, 1.6, col.gold);
      limb(hx, hy, hx - dx * 3, hy - dy * 3, 1.6, col.hilt);
      return { x: tx, y: ty };
    }
    if (w === 'mace') {
      const L = it.len || 16;
      const tx = hx + dx * L, ty = hy + dy * L;
      limb(hx - dx * 2, hy - dy * 2, tx, ty, 1.8, '#5a4a3a');
      gfx.circle(ctx, tx, ty, it.hands === 2 ? 4.5 : 3.6, steel);
      gfx.circle(ctx, tx - 1, ty - 1, 1.2, U.shade(steel, 0.4));
      return { x: tx, y: ty };
    }
    if (w === 'spear') {
      const L = it.len || 36;
      const tx = hx + dx * (L - 10), ty = hy + dy * (L - 10);
      limb(hx - dx * 10, hy - dy * 10, tx, ty, 1.6, '#6a4a2a');
      limb(tx, ty, tx + dx * 9, ty + dy * 9, 2.6, steel);
      limb(tx - dy * 3, ty + dx * 3, tx + dy * 3, ty - dx * 3, 2, steel);
      return { x: tx + dx * 9, y: ty + dy * 9 };
    }
    if (w === 'tome') {
      ctx.save();
      ctx.translate(hx + dx * 3, hy + dy * 3);
      ctx.rotate(-ang + Math.PI / 2);
      ctx.fillStyle = it.col;
      ctx.fillRect(-4, -3, 8, 6);
      ctx.fillStyle = '#efe6d0';
      ctx.fillRect(-3, -2, 6, 1);
      ctx.restore();
      return { x: hx + dx * 6, y: hy + dy * 6 };
    }
    if (w === 'whip') {
      // handle only; the lash is drawn in world space
      limb(hx, hy, hx + dx * 5, hy + dy * 5, 2, '#5a3a1a');
      return { x: hx + dx * 5, y: hy + dy * 5 };
    }
    if (w === 'fist') {
      gfx.circle(ctx, hx, hy, 2.2, it.col || col.skin);
      return { x: hx, y: hy };
    }
    return null;
  }

  function drawShield(it, AF, col) {
    const hx = AF[4], hy = AF[5];
    ctx.fillStyle = it.col;
    ctx.beginPath();
    ctx.moveTo(hx - 1, hy - 7);
    ctx.lineTo(hx + 4, hy - 6);
    ctx.lineTo(hx + 4, hy + 3);
    ctx.lineTo(hx + 1.5, hy + 7);
    ctx.lineTo(hx - 1, hy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = U.shade(it.col, 0.35);
    ctx.fillRect(hx + 0.5, hy - 5, 1, 9);
  }

  // ---- Other forms ------------------------------------------------------------------------
  G.drawBat = function (t, opts) {
    const f = Math.floor(t / 4) % 4;
    return gfx.sprite('alubat' + f, 32, 24, (c) => {
      const wingY = [-7, -3, 2, -3][f];
      c.translate(16, 12);
      c.fillStyle = '#1a1220';
      c.beginPath();
      c.moveTo(-2, -1);
      c.lineTo(-13, wingY);
      c.lineTo(-10, wingY + 3);
      c.lineTo(-7, wingY + 1);
      c.lineTo(-4, wingY + 4);
      c.lineTo(-1, 3);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(2, -1);
      c.lineTo(13, wingY);
      c.lineTo(10, wingY + 3);
      c.lineTo(7, wingY + 1);
      c.lineTo(4, wingY + 4);
      c.lineTo(1, 3);
      c.closePath();
      c.fill();
      gfx.ellipse(c, 0, 1, 3.4, 4.2, 0, '#2a2236');
      c.fillStyle = '#2a2236';
      c.fillRect(-3, -4, 1.6, 2.4);
      c.fillRect(1.4, -4, 1.6, 2.4);
      c.fillStyle = '#ff3048';
      c.fillRect(-2, 0, 1.2, 1.2);
      c.fillRect(1, 0, 1.2, 1.2);
      c.strokeStyle = '#9a1426';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(-12, wingY + 0.5);
      c.lineTo(-3, 2);
      c.moveTo(12, wingY + 0.5);
      c.lineTo(3, 2);
      c.stroke();
    }, { outline: '#07050b', palette: ['#1a1220', '#2a2236', '#ff3048', '#9a1426'] });
  };

  G.drawWolf = function (t, moving, opts) {
    const f = moving ? Math.floor(t / 4) % 6 : 6 + (Math.floor(t / 20) % 2);
    return gfx.sprite('aluwolf' + f, 48, 32, (c) => {
      c.translate(24, 26);
      const run = f < 6;
      const ph = (f / 6) * Math.PI * 2;
      const body = run ? Math.sin(ph) * 1.2 : Math.sin(f) * 0.3;
      const fur = '#c8ccd8', furS = '#7e869e', furD = '#4a4e62';
      // tail
      c.strokeStyle = furS;
      c.lineWidth = 3.5;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-10, -10 + body);
      c.quadraticCurveTo(-17, -12 + body, -20, -7 - (run ? Math.sin(ph * 2) * 2 : 0));
      c.stroke();
      // legs
      const legs = run
        ? [[-7, Math.sin(ph) * 5], [-4, Math.sin(ph + 1) * 5], [6, Math.sin(ph + Math.PI) * 5], [9, Math.sin(ph + Math.PI + 1) * 5]]
        : [[-7, 0], [-4, 0], [6, 0], [9, 0]];
      legs.forEach(([x, s], i) => {
        gfx.limb(c, x, -6 + body, x + s, 0, 2.6, i % 2 ? fur : furS);
      });
      // body
      gfx.ellipse(c, 0, -9 + body, 11.5, 5.2, 0, fur);
      gfx.ellipse(c, -1, -7.5 + body, 9.5, 3, 0, furS);
      gfx.ellipse(c, 3, -11 + body, 6, 3.6, -0.2, '#e8ecf4');
      // head
      c.fillStyle = fur;
      c.beginPath();
      c.moveTo(9, -14 + body);
      c.lineTo(15, -13 + body);
      c.lineTo(20, -10 + body);
      c.lineTo(19, -8 + body);
      c.lineTo(12, -7 + body);
      c.closePath();
      c.fill();
      c.fillStyle = furS;
      c.beginPath();
      c.moveTo(10, -14 + body);
      c.lineTo(12, -19 + body);
      c.lineTo(14, -14 + body);
      c.fill();
      c.fillStyle = '#ff3048';
      c.fillRect(15, -12 + body, 1.4, 1.2);
      c.fillStyle = furD;
      c.fillRect(19, -10 + body, 1.5, 1.2);
    }, { outline: '#07050b', palette: ['#c8ccd8', '#7e869e', '#4a4e62', '#e8ecf4', '#ff3048'] });
  };

  // Mist is drawn with particles each frame (see player.js)
  G.drawMist = function (bctx, x, y, t) {
    for (let i = 0; i < 14; i++) {
      const a = t * 0.05 + i * 0.9;
      const r = 6 + (i % 4) * 3;
      const px = x + Math.cos(a) * r * 0.9, py = y - 8 + Math.sin(a * 1.3) * r * 0.5;
      bctx.globalAlpha = 0.18 + (i % 3) * 0.06;
      bctx.fillStyle = i % 2 ? '#c8d0e8' : '#8a96b8';
      bctx.beginPath();
      bctx.arc(px, py, 4 + (i % 3), 0, Math.PI * 2);
      bctx.fill();
    }
    bctx.globalAlpha = 1;
    bctx.fillStyle = '#ff3048';
    bctx.fillRect(Math.round(x - 2), Math.round(y - 9), 1, 1);
    bctx.fillRect(Math.round(x + 1), Math.round(y - 9), 1, 1);
  };

  // ---- Slash arcs (world space, additive) ----------------------------------------------
  G.drawSlash = function (bctx, sx, sy, facing, kind, t, col) {
    // t: 0..1 progress of the fade
    bctx.save();
    bctx.globalCompositeOperation = 'lighter';
    bctx.globalAlpha = (1 - t) * 0.85;
    bctx.translate(sx, sy);
    bctx.scale(facing, 1);
    const c = col || '#cfe0ff';
    if (kind === 'thrust') {
      const len = 30 + t * 6;
      const g = bctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, U.rgba(c, 0));
      g.addColorStop(0.6, U.rgba(c, 0.7));
      g.addColorStop(1, U.rgba('#ffffff', 0.95));
      bctx.fillStyle = g;
      bctx.beginPath();
      bctx.moveTo(4, -2.5);
      bctx.lineTo(len, -0.5);
      bctx.lineTo(len, 0.5);
      bctx.lineTo(4, 2.5);
      bctx.fill();
    } else {
      // crescent
      const r = kind === 'big' ? 34 : 26;
      bctx.strokeStyle = U.rgba(c, 0.9);
      bctx.lineWidth = kind === 'big' ? 5 : 3.5;
      bctx.beginPath();
      bctx.arc(0, 0, r, -1.6 + t * 0.2, 0.8 + t * 0.2);
      bctx.stroke();
      bctx.strokeStyle = 'rgba(255,255,255,0.9)';
      bctx.lineWidth = 1.2;
      bctx.beginPath();
      bctx.arc(0, 0, r + 1, -1.3 + t * 0.2, 0.6 + t * 0.2);
      bctx.stroke();
    }
    bctx.restore();
  };

  // Whip lash in world space: segments from the hand outward
  G.drawWhip = function (bctx, hx, hy, facing, ext, t, col, glow) {
    const n = 18;
    const L = ext;
    let px = hx, py = hy;
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const x = hx + facing * L * f;
      const y = hy + Math.sin(f * Math.PI * 1.5 + t * 0.9) * (1 - f) * 3 + f * 1.5;
      bctx.fillStyle = i % 2 ? col : U.shade(col, -0.35);
      const s = i > n - 2 ? 3 : 2;
      bctx.fillRect(Math.round(x - 1), Math.round(y - 1), s, s);
      px = x;
      py = y;
    }
    if (glow) {
      bctx.save();
      bctx.globalCompositeOperation = 'lighter';
      bctx.fillStyle = U.rgba(glow, 0.6);
      bctx.fillRect(Math.round(px - 2), Math.round(py - 2), 4, 4);
      bctx.restore();
    }
    return { x: px, y: py };
  };
})();
