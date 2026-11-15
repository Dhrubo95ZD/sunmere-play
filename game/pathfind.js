// A light grid path finder for the quest walk (v109): a coarse grid (2 m cells) over one outdoor area or one dungeon,
// filled lazily (a cell is only tested when the search first reaches it, then cached), searched with A* over the eight
// neighbours (no cutting a blocked corner), and smoothed by string pulling (a waypoint is dropped when the walker can go
// straight past it). It has no imports, so the node test (tools/tests/questwalktest.mjs) loads it as it is.
//
// new PathGrid({ minX, minZ, maxX, maxZ, cell, test, edge })
//   test(x, z) -> 0 blocked | -1 water (wading, used only as a last resort) | cost >= 1 (1 = plain ground)
//   edge(x0, z0, x1, z1) -> true when the straight step between two cell centres is blocked (thin walls between free cells)
// grid.find(sx, sz, gx, gz, { maxNodes, water }) -> [[x, z], ...] from the start to the goal (smoothed), or null
const BLOCK = 255, WATER = 254, UNKNOWN = 0;
const WATER_COST = 7; // wading is allowed only when nothing dry gets there, and then as little of it as possible
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

export class PathGrid {
  constructor({ minX, minZ, maxX, maxZ, cell = 2, test, edge = null }) {
    this.cell = cell; this.x0 = minX; this.z0 = minZ;
    this.nx = Math.max(1, Math.ceil((maxX - minX) / cell)); this.nz = Math.max(1, Math.ceil((maxZ - minZ) / cell));
    const n = this.nx * this.nz;
    this.test = test; this.edgeFn = edge;
    this.st = new Uint8Array(n); // UNKNOWN, BLOCK, WATER or the cost * 20 (1..253)
    this.ed = edge ? new Uint8Array(n * 4) : null; // the E, S, SE and SW edge of each cell: 0 unknown, 1 open, 2 blocked
    this.g = new Float32Array(n); this.par = new Int32Array(n); this.seen = new Uint32Array(n); this.shut = new Uint32Array(n);
    this.stamp = 0; this.tests = 0;
  }
  idx(x, z) { const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell); return i < 0 || j < 0 || i >= this.nx || j >= this.nz ? -1 : j * this.nx + i; }
  cx(k) { return this.x0 + ((k % this.nx) + 0.5) * this.cell; }
  cz(k) { return this.z0 + (Math.floor(k / this.nx) + 0.5) * this.cell; }
  // the cached state of a cell (tests it the first time)
  stat(k) {
    let s = this.st[k];
    if (s === UNKNOWN) {
      this.tests++;
      const c = this.test(this.cx(k), this.cz(k));
      s = c === 0 ? BLOCK : c < 0 ? WATER : Math.max(1, Math.min(253, Math.round(c * 20)));
      this.st[k] = s;
    }
    return s;
  }
  // forget everything known (the world's colliders changed)
  reset() { this.st.fill(0); if (this.ed) this.ed.fill(0); }
  // forget what is known around a point (a house interior built, a door opened...): r in metres
  forget(x, z, r) {
    const c = this.cell, i0 = Math.max(0, Math.floor((x - r - this.x0) / c)), i1 = Math.min(this.nx - 1, Math.floor((x + r - this.x0) / c));
    const j0 = Math.max(0, Math.floor((z - r - this.z0) / c)), j1 = Math.min(this.nz - 1, Math.floor((z + r - this.z0) / c));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * this.nx + i; this.st[k] = 0; if (this.ed) this.ed.fill(0, k * 4, k * 4 + 4); }
  }
  costOf(s, water) { return s === BLOCK ? -1 : s === WATER ? (water ? WATER_COST : -1) : s / 20; }
  // is the step between neighbouring cells a and b blocked by a thin wall?
  edgeBlocked(a, b) {
    if (!this.edgeFn) return false;
    const lo = Math.min(a, b), hi = Math.max(a, b), nx = this.nx, d = hi - lo;
    let slot = d === 1 ? 0 : d === nx ? 1 : d === nx + 1 ? 2 : d === nx - 1 ? 3 : -1;
    if (slot === 3 && lo % nx === 0) slot = -1; // (the wrap from a row's first cell)
    if (slot < 0) return !!this.edgeFn(this.cx(a), this.cz(a), this.cx(b), this.cz(b));
    const e = lo * 4 + slot;
    let v = this.ed[e];
    if (!v) { v = this.edgeFn(this.cx(a), this.cz(a), this.cx(b), this.cz(b)) ? 2 : 1; this.ed[e] = v; }
    return v === 2;
  }
  // the nearest open cell to a point (a goal on a rock, a start pressed against a tree), searched in rings up to rMax cells
  nearestOpen(x, z, rMax = 6, water = false) {
    const k0 = this.idx(x, z);
    if (k0 < 0) return -1;
    if (this.costOf(this.stat(k0), water) > 0) return k0;
    const i0 = k0 % this.nx, j0 = Math.floor(k0 / this.nx);
    for (let r = 1; r <= rMax; r++) {
      let best = -1, bd = 1e18;
      for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r || i < 0 || j < 0 || i >= this.nx || j >= this.nz) continue;
        const k = j * this.nx + i;
        if (this.costOf(this.stat(k), water) <= 0) continue;
        const d = (this.cx(k) - x) ** 2 + (this.cz(k) - z) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }
  find(sx, sz, gx, gz, o = {}) {
    const water = !!o.water, maxNodes = o.maxNodes || 90000;
    const s = this.nearestOpen(sx, sz, 4, water), g = this.nearestOpen(gx, gz, o.goalR || 6, water);
    if (s < 0 || g < 0) return null;
    const st = ++this.stamp, G = this.g, P = this.par, seen = this.seen, shut = this.shut, nx = this.nx, nz = this.nz;
    const gi = g % nx, gj = Math.floor(g / nx);
    const h = (k) => { const di = Math.abs((k % nx) - gi), dj = Math.abs(Math.floor(k / nx) - gj); return (Math.max(di, dj) + (Math.SQRT2 - 1) * Math.min(di, dj)) * 1.0; };
    // binary heap of [f, k]
    const hk = [], hf = [];
    const push = (k, f) => { let i = hk.length; hk.push(k); hf.push(f); while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; hk[i] = hk[p]; hf[i] = hf[p]; i = p; } hk[i] = k; hf[i] = f; };
    const pop = () => {
      const top = hk[0], lk = hk.pop(), lf = hf.pop(), n = hk.length;
      if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; hk[i] = hk[c]; hf[i] = hf[c]; i = c; } hk[i] = lk; hf[i] = lf; }
      return top;
    };
    seen[s] = st; G[s] = 0; P[s] = -1; push(s, h(s));
    let n = 0, found = false, bestK = s, bestH = h(s);
    while (hk.length) {
      const k = pop();
      if (shut[k] === st) continue;
      shut[k] = st;
      if (k === g) { found = true; break; }
      if (++n > maxNodes) break;
      const hh = h(k); if (hh < bestH) { bestH = hh; bestK = k; }
      const i = k % nx, j = Math.floor(k / nx);
      for (let d = 0; d < 8; d++) {
        const [di, dj, len] = DIRS[d], ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const q = jj * nx + ii;
        if (shut[q] === st) continue;
        const c = this.costOf(this.stat(q), water);
        if (c <= 0) continue;
        // a diagonal never cuts the corner of a blocked cell
        if (di && dj && (this.costOf(this.stat(j * nx + ii), water) <= 0 || this.costOf(this.stat(jj * nx + i), water) <= 0)) continue;
        if (this.edgeBlocked(k, q)) continue;
        const ng = G[k] + len * (c + this.costOf(this.stat(k), water)) * 0.5;
        if (seen[q] === st && ng >= G[q]) continue;
        seen[q] = st; G[q] = ng; P[q] = k; push(q, ng + h(q));
      }
    }
    this.lastNodes = n;
    if (!found) { if (!o.partial) return null; } // (partial: the closest the search got, for a goal past the search budget)
    const cells = [];
    for (let k = found ? g : bestK; k >= 0; k = P[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map((k) => [this.cx(k), this.cz(k)]);
    pts[0] = [sx, sz];
    if (found) pts.push([gx, gz]);
    return this.smooth(pts, water);
  }
  // can a walker go straight from a to b? Every cell the segment touches is open (dry, unless water) and no thin wall is crossed
  los(ax, az, bx, bz, water = false) {
    const L = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(L / (this.cell * 0.25)));
    let pk = this.idx(ax, az);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, k = this.idx(ax + (bx - ax) * t, az + (bz - az) * t);
      if (k < 0) return false;
      if (k === pk) continue;
      if (this.costOf(this.stat(k), water) <= 0) return false;
      // a costly cell (a steep bank, a ford) on the way: keep the bend the search found round it
      if (this.st[k] > 34 && this.st[pk] <= 34) return false;
      pk = k;
    }
    return !(this.edgeFn && this.edgeFn(ax, az, bx, bz));
  }
  smooth(pts, water) {
    if (pts.length <= 2) return pts;
    const out = [pts[0]];
    let a = 0;
    while (a < pts.length - 1) {
      let b = a + 1;
      for (let j = Math.min(pts.length - 1, a + 48); j > a + 1; j--) if (this.los(pts[a][0], pts[a][1], pts[j][0], pts[j][1], water)) { b = j; break; }
      out.push(pts[b]); a = b;
    }
    return out;
  }
}

// a path's length, and the point at distance s along it
export function pathLength(P) { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; }

// the cell test for one outdoor area, from the shared terrain and house rules (the client adds its own static colliders,
// trees, rocks and buildings, through extra). T: { walkHeight, waterAt, worldGap, areaOf, housePush, houseAt, roadDist }
//   blocked: outside the walkable edge, in another area, inside or against a house (its walls, its room, its doorstep),
//   a slope steeper than about 1 in 1 (a cliff), or anything extra says. Open water deeper than ankle height: water (-1).
//   cost: 1 on a road, 1.3 on open ground, more on a slope (paths keep to the roads and round the hills when that is cheap)
export function outdoorTest(area, T, extra = null, R = 0.75) {
  return (x, z) => {
    if (T.worldGap(x, z) > -1.2 || T.areaOf(x, z) !== area) return 0;
    if (T.houseAt(x, z, true)) return 0;
    { const [px, pz] = T.housePush(x, z, R); if (Math.abs(px - x) + Math.abs(pz - z) > 1e-3) return 0; }
    if (extra && extra(x, z)) return 0;
    const h = T.walkHeight(x, z);
    const s = Math.max(Math.abs(T.walkHeight(x + 1, z) - T.walkHeight(x - 1, z)), Math.abs(T.walkHeight(x, z + 1) - T.walkHeight(x, z - 1))) / 2;
    if (s > 1.0) return 0;
    const w = T.waterAt(x, z);
    if (w !== null && w > h + 0.18) return -1;
    const road = T.roadDist && area === 'valley' ? T.roadDist(x, z) < 3.5 : false;
    return (road ? 1 : 1.3) + Math.max(0, s - 0.25) * 5;
  };
}
// the thin-wall test between two points: no house wall in the way (and anything extra says)
export const outdoorEdge = (T, extra = null) => (x0, z0, x1, z1) => T.houseCrosses(x0, z0, x1, z1) || !!(extra && extra(x0, z0, x1, z1));

// a point clear of a house's doorstep, straight out from its door
export function doorFront(S, extra = 1.6) {
  const dx = S.doorOut.x - S.doorAt.x, dz = S.doorOut.z - S.doorAt.z, L = Math.hypot(dx, dz) || 1, u = (S.stepLen || 0.9) + extra;
  return [S.doorAt.x + (dx / L) * u, S.doorAt.z + (dz / L) * u];
}
// the whole outdoor route from (sx, sz) to (gx, gz): out of the house you are in by its door, across the grid, and in at
// the door of the house the goal is in. Returns { pts, partial, water } or null.
export function planOutdoor(grid, sx, sz, gx, gz, T, o = {}) {
  const Hs = T.houseAt(sx, sz, false), Hg = T.houseAt(gx, gz, false);
  if (Hs && Hg && Hs.id === Hg.id) return { pts: [[sx, sz], [gx, gz]], partial: false, water: false };
  const pre = [[sx, sz]], post = [[gx, gz]];
  if (Hs) pre.push([Hs.doorIn.x, Hs.doorIn.z], [Hs.doorAt.x, Hs.doorAt.z], doorFront(Hs));
  if (Hg) post.unshift(doorFront(Hg), [Hg.doorAt.x, Hg.doorAt.z], [Hg.doorIn.x, Hg.doorIn.z]);
  const a = pre[pre.length - 1], b = post[0];
  let water = false, partial = false;
  let mid = grid.find(a[0], a[1], b[0], b[1], o);
  if (!mid) { water = true; mid = grid.find(a[0], a[1], b[0], b[1], { ...o, water: true }); }
  if (!mid) { partial = true; mid = grid.find(a[0], a[1], b[0], b[1], { ...o, water: true, partial: true }); }
  if (!mid) return null;
  const pts = [...pre.slice(0, -1), ...mid, ...(partial ? [] : post.slice(1))];
  return { pts, partial, water };
}
