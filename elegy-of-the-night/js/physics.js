/* Elegy of the Night — physics.js
 * Tile collision for axis-aligned bodies: solid tiles, one-way platforms,
 * 45° stairs (slopes), grates (mist passes), water, spikes.
 * Body: {x, y, w, h, vx, vy, onGround, ...} with (x,y) = top-left.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = (root.G = root.G || {});
  const T = G.T;
  const TS = G.TILE;

  const P = (G.phys = {
    GRAV: 0.3,
    MAXFALL: 7,
  });

  // Full-tile solidity for a given body
  function solidFor(t, b) {
    switch (t) {
      case T.SOLID:
      case T.SPIKES:
      case T.BREAK:
      case T.SEAL:
        return true;
      case T.GRATE:
        return !(b && b.mist);
      default:
        return false;
    }
  }
  P.solidFor = solidFor;
  const isSlope = (t) => t === T.SLOPE_R || t === T.SLOPE_L;
  P.isSlope = isSlope;

  function slopeSurface(t, tx, ty, px) {
    let lx = px - tx * TS;
    if (lx < 0) lx = 0;
    if (lx > TS) lx = TS;
    return t === T.SLOPE_R ? ty * TS + TS - lx : ty * TS + lx;
  }
  P.slopeSurface = slopeSurface;

  P.move = function (b, room) {
    const wasGround = b.onGround;
    b.hitWall = 0;
    b.hitCeil = false;
    b.touchSpikes = false;
    b.onSlope = false;
    const prevBottom = b.y + b.h;

    // ---- horizontal ----
    if (b.vx !== 0) {
      b.x += b.vx;
      const allowance = wasGround ? 8 : 1;
      const top = b.y + 1;
      const bot = b.y + b.h - 1 - allowance;
      const ty0 = Math.floor(top / TS), ty1 = Math.floor(bot / TS);
      if (b.vx > 0) {
        const tx = Math.floor((b.x + b.w - 0.01) / TS);
        for (let ty = ty0; ty <= ty1; ty++) {
          const t = room.get(tx, ty);
          if (solidFor(t, b)) {
            if (t === T.SPIKES) b.touchSpikes = true;
            b.x = tx * TS - b.w;
            b.hitWall = 1;
            break;
          }
        }
      } else {
        const tx = Math.floor(b.x / TS);
        for (let ty = ty0; ty <= ty1; ty++) {
          const t = room.get(tx, ty);
          if (solidFor(t, b)) {
            if (t === T.SPIKES) b.touchSpikes = true;
            b.x = (tx + 1) * TS;
            b.hitWall = -1;
            break;
          }
        }
      }
      if (b.hitWall && !b.keepVX) b.vx = 0;
    }

    // ---- vertical ----
    b.y += b.vy;
    b.onGround = false;
    const L = b.x + 0.5, R = b.x + b.w - 0.5, cx = b.x + b.w / 2;
    if (b.vy < 0) {
      const ty = Math.floor(b.y / TS);
      const tx0 = Math.floor(L / TS), tx1 = Math.floor(R / TS);
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = room.get(tx, ty);
        if (solidFor(t, b)) {
          b.y = (ty + 1) * TS;
          b.vy = 0;
          b.hitCeil = true;
          break;
        }
      }
      b.inWater = room.get(Math.floor(cx / TS), Math.floor((b.y + b.h * 0.5) / TS)) === T.WATER;
      return;
    }

    // falling or resting: find the highest surface we are crossing
    const bottom = b.y + b.h;
    const tolUp = wasGround ? 9 : 2; // how far a surface may be above previous bottom (stairs)
    const snap = wasGround && b.vy >= 0 && !b.noSnap ? Math.max(6, Math.abs(b.vx) + 4) : 0;
    let surf = Infinity, surfIsSlope = false, surfSpikes = false;

    // 1) slope under the centre
    const tcx = Math.floor(cx / TS);
    const tyA = Math.floor((prevBottom - tolUp - TS) / TS), tyB = Math.floor((bottom + snap) / TS);
    let centreOnSlope = false;
    for (let ty = tyA; ty <= tyB; ty++) {
      const t = room.get(tcx, ty);
      if (isSlope(t)) {
        const s = slopeSurface(t, tcx, ty, cx);
        if (s >= prevBottom - tolUp - 0.01 && s <= bottom + snap && s < surf) {
          surf = s;
          surfIsSlope = true;
          centreOnSlope = true;
        }
      }
    }
    // 2) solid tiles / platforms under the body (ignored while the centre rides a slope)
    if (!centreOnSlope) {
      const tx0 = Math.floor(L / TS), tx1 = Math.floor(R / TS);
      const r0 = Math.floor((prevBottom - (wasGround ? 8 : 1)) / TS), r1 = Math.floor((bottom + snap) / TS);
      for (let tx = tx0; tx <= tx1; tx++) {
        for (let ty = r0; ty <= r1; ty++) {
          const t = room.get(tx, ty);
          const top = ty * TS;
          if (solidFor(t, b)) {
            if (top >= prevBottom - (wasGround ? 8.01 : 1.01) && top <= bottom + snap && top < surf) {
              surf = top;
              surfIsSlope = false;
              surfSpikes = t === T.SPIKES;
            }
            break;
          } else if (t === T.ONEWAY && !(b.dropT > 0) && !b.noOneWay) {
            if (top >= prevBottom - 0.01 - (wasGround ? 1 : 0) && top <= bottom + snap && top < surf) {
              surf = top;
              surfIsSlope = false;
            }
          }
          // slope tiles under a corner are ignored: only the centre rides stairs
        }
      }
    }
    // surf lies in [prevBottom - tol, bottom + snap]: land on penetration, or snap down
    if (surf !== Infinity && (bottom >= surf || snap > 0)) {
      b.y = surf - b.h;
      if (b.vy > 0) b.landV = b.vy;
      b.vy = 0;
      b.onGround = true;
      b.onSlope = surfIsSlope;
      if (surfSpikes) b.touchSpikes = true;
    }
    b.inWater = room.get(tcx, Math.floor((b.y + b.h * 0.5) / TS)) === T.WATER;
  };

  // Is the pixel solid (full tiles only)?
  P.solidAt = function (room, px, py, b) {
    return solidFor(room.get(Math.floor(px / TS), Math.floor(py / TS)), b);
  };
  // Is there something to stand on at pixel (px, py)? (solid, platform or slope)
  P.floorAt = function (room, px, py) {
    const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
    const t = room.get(tx, ty);
    if (solidFor(t) || t === T.ONEWAY) return true;
    if (isSlope(t)) return py >= slopeSurface(t, tx, ty, px) - 1;
    // slope just below (descending stairs)
    const t2 = room.get(tx, ty + 1);
    return isSlope(t2);
  };
  // Enemy helper: would walking forward step into a wall or off a ledge?
  P.blockedAhead = function (room, b, dir) {
    const fx = dir > 0 ? b.x + b.w + 2 : b.x - 2;
    const wall = P.solidAt(room, fx, b.y + b.h - 10) || P.solidAt(room, fx, b.y + 4);
    const ledge = !P.floorAt(room, fx, b.y + b.h + 4);
    return { wall, ledge };
  };
  // Line of sight between two points (tile DDA, coarse)
  P.los = function (room, x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.ceil(d / 8);
    for (let i = 1; i < n; i++) {
      const x = x1 + ((x2 - x1) * i) / n, y = y1 + ((y2 - y1) * i) / n;
      if (P.solidAt(room, x, y)) return false;
    }
    return true;
  };
  // Does a rectangle overlap any solid tile?
  P.rectSolid = function (room, x, y, w, h, b) {
    const tx0 = Math.floor(x / TS), tx1 = Math.floor((x + w - 0.01) / TS);
    const ty0 = Math.floor(y / TS), ty1 = Math.floor((y + h - 0.01) / TS);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (solidFor(room.get(tx, ty), b)) return true;
    return false;
  };
  // Simple projectile step: returns true if it hit a solid tile
  P.projHits = function (room, x, y) {
    const t = room.get(Math.floor(x / TS), Math.floor(y / TS));
    return t === T.SOLID || t === T.BREAK || t === T.SEAL || t === T.SPIKES || t === T.GRATE;
  };
})();
