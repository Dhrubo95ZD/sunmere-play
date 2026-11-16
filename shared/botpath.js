// Living bots, part B.5 (docs/ai/living_bots_design.md): paths for bots, not straight lines. Owner: Builder B.
// Wraps the quest walk's PathGrid (client/game/pathfind.js, read-only here: it has no imports, so it loads in node, in the
// page and in the sim worker) with a cell test built from the shared terrain only: the walkable edge (worldGap), the area,
// houses (their walls are thin walls, their rooms blocked), slopes and water (wading only as a last resort).
// CPU rules (B.6): at most one search per tick for all bots together (a queue); a search may test at most TEST_CAP cells it
// has never seen (it gives up and is retried later: the cells it did test stay known, so the retry gets further); the grid
// is baked a little at a time while no search is waiting; finished paths are cached per (area, start cell, goal cell) for
// 10 minutes. Under 25 m with no house in the way a bot walks straight.
import { PathGrid, outdoorTest, outdoorEdge, planOutdoor } from '../client/game/pathfind.js';
import { walkHeight, waterAt, worldGap, areaOf, roadDist, WORLD, AREA_BY_ID } from './terrain.js';
import { houseAt, housePush, houseCrosses } from './houses.js';

export const BOT_PATH = { cell: 4, maxNodes: 3000, testCap: 100, bakePerTick: 60, cacheMs: 600, straight: 25, cacheMax: 400 };
const NAV = { walkHeight, waterAt, worldGap, areaOf, housePush, houseAt, houseCrosses, roadDist };
class Abort extends Error {}

export class BotPaths {
  constructor() {
    this.grids = new Map(); // area -> { g, budget }
    this.queue = []; // { key, area, sx, sz, gx, gz, cb, tries }
    this.cache = new Map(); // key -> { pts, t }
    this.stats = { searches: 0, aborted: 0, maxMs: 0, sumMs: 0, perTick: 0, maxPerTick: 0, baked: 0, bakeMs: 0 };
    this.time = 0;
  }
  grid(area) {
    let G = this.grids.get(area);
    if (G) return G;
    const B = area === 'valley' ? WORLD : AREA_BY_ID[area]?.box;
    if (!B) return null;
    const base = outdoorTest(area, NAV);
    G = { budget: Infinity, bake: 0 };
    // every new cell test spends the budget of the search running now; past it the search stops (Abort)
    const test = (x, z) => { if (--G.budget < 0) throw new Abort(); return base(x, z); };
    const eb = outdoorEdge(NAV), edge = (x0, z0, x1, z1) => { if ((G.budget -= 0.5) < 0) throw new Abort(); return eb(x0, z0, x1, z1); }; // (a new wall test spends half a cell test)
    G.g = new PathGrid({ minX: B.minX, minZ: B.minZ, maxX: B.maxX, maxZ: B.maxZ, cell: BOT_PATH.cell, test, edge });
    this.grids.set(area, G);
    return G;
  }
  // is a straight walk fine? (short and no house wall or room in the way)
  straight(sx, sz, gx, gz) {
    return Math.hypot(gx - sx, gz - sz) < BOT_PATH.straight && !houseCrosses(sx, sz, gx, gz);
  }
  keyOf(area, sx, sz, gx, gz) { const c = BOT_PATH.cell * 4; return `${area}:${Math.round(sx / c)},${Math.round(sz / c)}:${Math.round(gx / BOT_PATH.cell)},${Math.round(gz / BOT_PATH.cell)}`; }
  // ask for a path; cb(pts | null) later (or at once from the cache). Returns true when answered at once.
  request(sx, sz, gx, gz, cb) {
    const area = areaOf(sx, sz);
    if (area === 'dungeon' || areaOf(gx, gz) !== area) { cb(null); return true; }
    if (this.straight(sx, sz, gx, gz)) { cb([[sx, sz], [gx, gz]]); return true; }
    const key = this.keyOf(area, sx, sz, gx, gz), C = this.cache.get(key);
    if (C && this.time - C.t < BOT_PATH.cacheMs) { cb([[sx, sz], ...C.pts.slice(1)]); return true; }
    this.queue.push({ key, area, sx, sz, gx, gz, cb, tries: 0 });
    return false;
  }
  cancel(cb) { this.queue = this.queue.filter((q) => q.cb !== cb); }
  // one search per tick (or a little baking when none waits)
  tick(time) {
    this.time = time;
    this.stats.perTick = 0;
    const q = this.queue.shift();
    if (!q) return this.bake();
    const G = this.grid(q.area);
    if (!G) { q.cb(null); return; }
    const t0 = performance.now();
    G.budget = BOT_PATH.testCap;
    let r = null, aborted = false;
    try { r = planOutdoor(G.g, q.sx, q.sz, q.gx, q.gz, NAV, { maxNodes: BOT_PATH.maxNodes, partial: true }); }
    catch (e) { if (!(e instanceof Abort)) throw e; aborted = true; }
    G.budget = Infinity;
    const ms = performance.now() - t0;
    (this.stats.ms ||= []).push(ms); if (this.stats.ms.length > 400) this.stats.ms.shift();
    this.stats.searches++; this.stats.sumMs += ms; this.stats.maxMs = Math.max(this.stats.maxMs, ms); this.stats.perTick++; this.stats.maxPerTick = Math.max(this.stats.maxPerTick, this.stats.perTick);
    if (aborted) {
      this.stats.aborted++;
      // try again later (the cells tested so far stay known); after many tries settle for a straight line
      if (++q.tries < 40) this.queue.push(q); else q.cb(null);
      return;
    }
    const pts = r?.pts || null;
    if (pts && !r.partial) { this.cache.set(q.key, { pts, t: time }); if (this.cache.size > BOT_PATH.cacheMax) this.cache.delete(this.cache.keys().next().value); }
    q.cb(pts);
  }
  // test a few unknown cells of the grids in use, so later searches run on known ground
  bake() {
    const t0 = performance.now();
    try { this.bakeSome(); } finally { this.stats.bakeMs += performance.now() - t0; }
  }
  bakeSome() {
    for (const G of this.grids.values()) {
      const g = G.g, n = g.st.length;
      if (G.bake >= n) continue;
      G.budget = Infinity;
      let k = 0;
      while (k < BOT_PATH.bakePerTick && G.bake < n) { if (!g.st[G.bake]) { g.stat(G.bake); k++; } G.bake++; }
      this.stats.baked += k;
      return;
    }
  }
}
