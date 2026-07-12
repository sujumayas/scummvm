/* Grog Engine — walk: walkable-polygon grid, A* pathfinding, movement, y-scaling. */
(function () {
  'use strict';
  const Grog = window.Grog;
  const E = Grog.Engine.prototype;
  const CELL = 4;

  E.buildWalkGrid = function (room) {
    const w = room.w || Grog.W;
    const cols = Math.ceil(w / CELL), rows = Math.ceil(Grog.VIEW_H / CELL);
    const cells = new Uint8Array(cols * rows);
    const polys = room.walk || [];
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2;
        for (const poly of polys) {
          if (Grog.pointInPoly(x, y, poly)) { cells[gy * cols + gx] = 1; break; }
        }
      }
    }
    this.walkGrid = { cols, rows, cells, cell: CELL };
  };

  E.walkable = function (x, y) {
    const g = this.walkGrid;
    if (!g) return false;
    const gx = Math.floor(x / g.cell), gy = Math.floor(y / g.cell);
    if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return false;
    return !!g.cells[gy * g.cols + gx];
  };

  // nearest walkable cell center to (x,y) — spiral search
  E.nearestWalkable = function (x, y) {
    const g = this.walkGrid;
    if (!g) return { x, y };
    let gx = Grog.clamp(Math.floor(x / g.cell), 0, g.cols - 1);
    let gy = Grog.clamp(Math.floor(y / g.cell), 0, g.rows - 1);
    if (g.cells[gy * g.cols + gx]) return { x, y };
    let best = null, bestD = Infinity;
    for (let r = 1; r < Math.max(g.cols, g.rows); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = gx + dx, ny = gy + dy;
          if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
          if (!g.cells[ny * g.cols + nx]) continue;
          const cx = nx * g.cell + g.cell / 2, cy = ny * g.cell + g.cell / 2;
          const d = Grog.dist(x, y, cx, cy);
          if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
        }
      }
      if (best) return best;
    }
    return { x, y };
  };

  E.findPath = function (x1, y1, x2, y2) {
    const g = this.walkGrid;
    if (!g) return null;
    const start = this.nearestWalkable(x1, y1);
    const goal = this.nearestWalkable(x2, y2);
    const sx = Math.floor(start.x / g.cell), sy = Math.floor(start.y / g.cell);
    const tx = Math.floor(goal.x / g.cell), ty = Math.floor(goal.y / g.cell);
    if (sx === tx && sy === ty) return [{ x: goal.x, y: goal.y }];
    const idx = (x, y) => y * g.cols + x;
    const open = [{ x: sx, y: sy, f: 0 }];
    const came = new Int32Array(g.cols * g.rows).fill(-1);
    const gScore = new Float32Array(g.cols * g.rows).fill(Infinity);
    gScore[idx(sx, sy)] = 0;
    const closed = new Uint8Array(g.cols * g.rows);
    const h = (x, y) => Math.hypot(x - tx, y - ty);
    let found = false;
    while (open.length) {
      // min-f pop (grids are small: 80x36 cells max ~2880)
      let mi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[mi].f) mi = i;
      const cur = open.splice(mi, 1)[0];
      if (cur.x === tx && cur.y === ty) { found = true; break; }
      const ci = idx(cur.x, cur.y);
      if (closed[ci]) continue;
      closed[ci] = 1;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cur.x + dx, ny = cur.y + dy;
          if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
          if (!g.cells[idx(nx, ny)]) continue;
          if (dx && dy && (!g.cells[idx(cur.x + dx, cur.y)] || !g.cells[idx(cur.x, cur.y + dy)])) continue; // no corner cutting
          const cost = gScore[ci] + (dx && dy ? 1.414 : 1);
          const ni = idx(nx, ny);
          if (cost < gScore[ni]) {
            gScore[ni] = cost;
            came[ni] = ci;
            open.push({ x: nx, y: ny, f: cost + h(nx, ny) });
          }
        }
      }
    }
    if (!found) return null;
    // reconstruct
    let cells = [];
    let ci = idx(tx, ty);
    while (ci !== -1) {
      cells.push({ x: (ci % g.cols) * g.cell + g.cell / 2, y: Math.floor(ci / g.cols) * g.cell + g.cell / 2 });
      ci = came[ci];
    }
    cells.reverse();
    // line-of-sight smoothing
    const clear = (a, b) => {
      const steps = Math.ceil(Grog.dist(a.x, a.y, b.x, b.y) / (g.cell / 2));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (!this.walkable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
      }
      return true;
    };
    const path = [cells[0]];
    let anchor = 0;
    for (let i = 2; i < cells.length; i++) {
      if (!clear(cells[anchor], cells[i])) { path.push(cells[i - 1]); anchor = i - 1; }
    }
    path.push({ x: goal.x, y: goal.y });
    return path;
  };

  // Walk an actor somewhere. Returns a promise resolving on arrival (or interruption).
  E.walkTo = function (actorId, x, y, dir) {
    const a = this.actors[actorId];
    if (!a) return Promise.resolve();
    if (a.walkResolve) { a.walkResolve(); a.walkResolve = null; }
    const path = this.findPath(a.x, a.y, x, y);
    if (!path || !path.length) { if (dir) a.dir = dir; return Promise.resolve(); }
    a.path = path;
    a.pathI = 0;
    a.arriveDir = dir || null;
    return new Promise((res) => { a.walkResolve = res; });
  };

  E.stopWalk = function (actorId) {
    const a = this.actors[actorId];
    if (!a) return;
    a.path = null;
    if (a.walkResolve) { a.walkResolve(); a.walkResolve = null; }
  };

  E.updateWalks = function (dt) {
    for (const id in this.actors) {
      const a = this.actors[id];
      a.scale = a.roomId === this.state.room ? this.scaleAt(a.y) : a.scale;
      if (!a.path) continue;
      let remaining = a.speed * (a.scale || 1) * dt;
      while (remaining > 0 && a.path) {
        const target = a.path[a.pathI];
        const d = Grog.dist(a.x, a.y, target.x, target.y);
        if (d <= remaining) {
          a.x = target.x; a.y = target.y;
          remaining -= d;
          a.pathI++;
          if (a.pathI >= a.path.length) {
            a.path = null;
            if (a.arriveDir) a.dir = a.arriveDir;
            if (a.walkResolve) { const r = a.walkResolve; a.walkResolve = null; r(); }
          }
        } else {
          const nx = (target.x - a.x) / d, ny = (target.y - a.y) / d;
          a.x += nx * remaining; a.y += ny * remaining;
          // facing from dominant axis
          if (Math.abs(nx) > Math.abs(ny) * 0.8) a.dir = nx < 0 ? 'L' : 'R';
          else a.dir = ny < 0 ? 'U' : 'D';
          remaining = 0;
        }
      }
    }
  };

  // Actor scale from the room's scale band: linear in y between (y1,s1) and (y2,s2).
  E.scaleAt = function (y) {
    const sc = this.room && this.room.scale;
    if (!sc) return 1;
    const t = Grog.clamp((y - sc.y1) / Math.max(1, sc.y2 - sc.y1), 0, 1);
    return sc.s1 + (sc.s2 - sc.s1) * t;
  };
})();
