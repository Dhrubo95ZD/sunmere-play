// House interiors, built on demand near the player (world.updateHouses): floors, wall lining, partitions with framed
// openings, ceiling joists at cutY - 0.15, window sills, the hearth (wall breast, oven, forge or hearth pit), and the
// furniture, laid out on a 5 cm occupancy grid so nothing ever lands on:
//   * the NPC spots (spot-tied pieces stand beside them: the bench in front of the worker, the bed beside the sleeper,
//     the table before the seat, all at least 0.3 m off the spot itself),
//   * the doorZone, the walk from the door to the main room and through every partition gap (0.5 m either side),
//   * the questbot approach (1 m to world +x of spot 0),
//   * windows (tall pieces keep off any window above their height).
// Every placed piece gives collision circles (inside its footprint) for world.collide; rugs and hanging things give none.
// The layout depends only on houseRng(seed, 4), so a house is furnished the same way every time.
// Ready-made models (assets/tripoModels.js): with { props: true } the oven, loom, workbench and the wall hearth's lower
// part are not built into the interior's builder but listed in out.props [{ name, p, ry, s, fb }] (house space: p the
// model's foot centre, s its scale per axis, fb a Builder holding the built piece, the stand-in until the model is in).
// The same pieces and the same random draws either way, so the layout never changes.
import { Builder } from '../kit.js';
import { houseRng, WALL_T, DOOR_W, DOOR_H, WALL_H, PART_GAP } from '/sunmere-play/shared/houses.js';
import { HT, U, faceOf, FACES, fbox, fp, bx, openingsOn, doorFace, doorT, wallBand, shade, pick, between, clamp, lerp } from './parts.js';
import * as Fu from './furniture.js';

// (LF.3) ?lf3=0 in the URL leaves out the look pass (rugs by bed and hearth, the pictures, the baked lamp light and the
// floor sheet): for A/B shots and benches
const LF3 = !(typeof location !== 'undefined' && /[?&]lf3=0\b/.test(location.search));
const CELL = 0.05;
// grid of the inner rect; 1 = taken
class Grid {
  constructor(I) { this.I = I; this.nx = Math.ceil((I.x1 - I.x0) / CELL); this.nz = Math.ceil((I.z1 - I.z0) / CELL); this.a = new Uint8Array(this.nx * this.nz); }
  ix(x) { return Math.floor((x - this.I.x0) / CELL); }
  iz(z) { return Math.floor((z - this.I.z0) / CELL); }
  rect(R, v = 1) { for (let i = Math.max(0, this.ix(R.x0)); i <= Math.min(this.nx - 1, this.ix(R.x1 - 1e-6)); i++) for (let j = Math.max(0, this.iz(R.z0)); j <= Math.min(this.nz - 1, this.iz(R.z1 - 1e-6)); j++) this.a[i * this.nz + j] = Math.max(this.a[i * this.nz + j], v); }
  free(R) {
    if (R.x0 < this.I.x0 - 1e-6 || R.z0 < this.I.z0 - 1e-6 || R.x1 > this.I.x1 + 1e-6 || R.z1 > this.I.z1 + 1e-6) return false;
    for (let i = Math.max(0, this.ix(R.x0)); i <= Math.min(this.nx - 1, this.ix(R.x1 - 1e-6)); i++) for (let j = Math.max(0, this.iz(R.z0)); j <= Math.min(this.nz - 1, this.iz(R.z1 - 1e-6)); j++) if (this.a[i * this.nz + j]) return false;
    return true;
  }
  capsule(a, b, r, v = 1) {
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9;
    for (let i = 0; i < this.nx; i++) for (let j = 0; j < this.nz; j++) {
      const x = this.I.x0 + (i + 0.5) * CELL, z = this.I.z0 + (j + 0.5) * CELL;
      const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1);
      if (Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z) < r) this.a[i * this.nz + j] = Math.max(this.a[i * this.nz + j], v);
    }
  }
}
const grow = (R, e) => ({ x0: R.x0 - e, z0: R.z0 - e, x1: R.x1 + e, z1: R.z1 + e });
const rectAt = (x, z, w, d) => ({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
const inR = (R, x, z, pad = 0) => x > R.x0 - pad && x < R.x1 + pad && z > R.z0 - pad && z < R.z1 + pad;
const center = (R) => [(R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2];

// the walks kept clear: the door to the main room's centre, and through every partition gap into both rooms
export function corridors(S) {
  const n = [S.door.nx, S.door.nz];
  const dIn = [S.door.lx - n[0] * (HT + 0.9), S.door.lz - n[1] * (HT + 0.9)];
  const roomOf = (x, z) => S.rooms.find((R) => inR(R, x, z)) || null;
  const main = roomOf(dIn[0], dIn[1]) || S.rooms[0];
  const out = [[[S.door.lx - n[0] * HT, S.door.lz - n[1] * HT], dIn], [dIn, center(main)]];
  for (const G of partGaps(S)) {
    const [a, b] = G.ends;
    out.push([a, b]);
    for (const R of S.rooms) if (inR(R, a[0], a[1], 0.05)) out.push([a, center(R)]); else if (inR(R, b[0], b[1], 0.05)) out.push([b, center(R)]);
  }
  return { list: out, dIn, main };
}
// the openings in the partitions: {c: [x, z], along: 'x'|'z', ends: [[x, z], [x, z]] one step into each room}
export function partGaps(S) {
  const out = [], I = S.inner;
  const lines = new Map();
  for (const P of S.parts) {
    const alongX = P.x1 - P.x0 > P.z1 - P.z0; // the partition runs along x
    const key = alongX ? 'x:' + ((P.z0 + P.z1) / 2).toFixed(3) : 'z:' + ((P.x0 + P.x1) / 2).toFixed(3);
    if (!lines.has(key)) lines.set(key, { alongX, at: alongX ? (P.z0 + P.z1) / 2 : (P.x0 + P.x1) / 2, segs: [] });
    lines.get(key).segs.push(alongX ? [P.x0, P.x1] : [P.z0, P.z1]);
  }
  for (const L of lines.values()) {
    const lo = L.alongX ? I.x0 : I.z0, hi = L.alongX ? I.x1 : I.z1;
    L.segs.sort((a, b) => a[0] - b[0]);
    let cur = lo;
    for (const [a, b] of [...L.segs, [hi, hi]]) {
      if (a - cur > PART_GAP * 0.8) {
        const m = (cur + a) / 2, c = L.alongX ? [m, L.at] : [L.at, m];
        const ends = L.alongX ? [[m, L.at - 0.8], [m, L.at + 0.8]] : [[L.at - 0.8, m], [L.at + 0.8, m]];
        out.push({ c, along: L.alongX ? 'x' : 'z', lo: cur, hi: a, at: L.at, ends });
      }
      cur = Math.max(cur, b);
    }
  }
  return out;
}

// ------------------------------------------------------------------ what each house holds
const LINING = { sunmere: ['plaster', '#f0eadc'], farmland: ['plaster', '#e8e0cc'], ledgerholm: ['plaster', '#e4e2dc'], harrowmouth: ['wood', '#c8a882'], reach: ['plaster', '#dcd6cc'], rime: ['wood', '#c8ac8c'], heights: ['plaster', '#d8d4cc'] };
function floorMat(S, room) {
  if (S.arch === 'smithy' || S.arch === 'works' || S.arch === 'towerhouse' || (S.variant === 'bakery' && room.kind === 'work')) return ['dFloorDeep', '#d8d0c4'];
  if (S.style === 'farmland' && room.kind === 'main') return ['dFloorDeep', '#e0d4c0'];
  return ['woodLight', pick(houseRng(S.seed, 6), ['#e0c8a8', '#d8bc98', '#ecd8b8'])];
}
// the ready-made props in an item: scale per axis and the foot centre in item space (GLB sizes from tools/tripo/out)
const PROP_FIT = {
  // the brick oven: the leaning door and peel make the GLB wider than the brickwork; fuel stacked on top, ~1.5 m
  oven: (it) => ({ s: [Math.min(1.45, it.w / 0.813), 1.5, it.d / 0.811], at: [0, 0, 0] }),
  // the loom with the weaver's bench in front (the built bench runs out to d/2 + 0.5)
  loom: (it) => { const sx = it.w / 0.981, sz = (it.d + 0.5) / 0.912; return { s: [sx, Math.min(1.75 / 0.865, 1.2 * Math.max(sx, sz)), sz], at: [0, 0, 0.25] }; },
  // the bench: its top at 0.88 m like the built one (the lamp-host height)
  workbench: (it) => ({ s: [it.w / 0.978, 1.62, it.d / 0.507], at: [0, 0, 0] }),
};
// the wall hearth's model: its back against the wall, its upper block (0.62 x 0.29 of its normalised size) as wide and
// deep as the breast that carries on above it to the ceiling, 1.5 m tall (its cheeks then stand a little proud of the
// breast, over the kept-clear hearthstone). flush (an oven or forge stands in front): its cheeks end at the breast's face
// and the breast above is only as deep as its upper block.
// v108: the breast stops at 1.75 m under a stone cap (the cut-away takes the room's walls down to the wainscot; a breast
// to the ceiling stood up as a raw pillar in the open room)
const HEARTH_TOP = 1.75;
const HEARTH_FIT = (w, d, flush = false) => {
  const sx = (w - 0.06) / 0.62, sz = flush ? d / 0.4 : (d - 0.03) / 0.29, sy = 1.5 / 0.98;
  return { sx, sy, sz, top: 0.97 * sy - 0.02, cz: -d / 2 + 0.332 * sz, upper: flush ? 0.29 * sz : d - 0.03 };
};

// spot-tied work pieces: [w, d, builder] (the worker faces the piece)
function workPiece(S) {
  const v = S.variant;
  if (S.arch === 'smithy') return { key: 'anvil', w: 0.7, d: 0.5, build: (b, it, r) => Fu.anvil(b, it, r) };
  if (S.arch === 'shop' && v === 'bakery') return { key: 'knead', w: 1.3, d: 0.6, build: Fu.kneadTrough };
  if (S.arch === 'shop' && v === 'weaver') return { key: 'loom', w: 1.4, d: 0.8, build: Fu.loom, front: true, model: 'loom' };
  if ((S.arch === 'shop' && v === 'clerk') || S.arch === 'towerhouse') return { key: 'desk', w: 1.2, d: 0.65, build: Fu.desk, chair: true };
  if (S.arch === 'works' || S.arch === 'longhouse') return { key: 'wbench', w: 1.5, d: 0.65, build: Fu.workbench, model: 'workbench' };
  if (S.arch === 'townhouse' || (S.arch === 'shop' && v === 'chandler')) return { key: 'wtable', w: 1.3, d: 0.6, build: (b, it, r) => Fu.worktable(b, it, r, (y) => { for (let i = 0; i < 3; i++) Fu.ib(b, 'cloth', it, -0.45 + i * 0.32, y, -0.15, -0.2 + i * 0.32, y + 0.12, 0.15, pick(r, ['#4a5a8a', '#8a3a2a', '#d8c8a0', '#5e7a4e'])); }) };
  return { key: 'ktable', w: 1.2, d: 0.6, build: (b, it, r) => Fu.worktable(b, it, r, (y) => { Fu.bowls(b, it, -0.4, y, -0.05, 2, r); Fu.crocks(b, it, 0.2, y, 0.05, 2, r); b.add(new Fu.THREE.BoxGeometry(0.3, 0.06, 0.2), 'cloth', { p: Fu.at(it, -0.05, y + 0.03, 0.1), r: [0, it.ry, 0], uv: 'box', c: '#f0dcb0' }); }) };
}
// the pieces that fill the rest, in order of importance: [key, w, d, h, rooms, opts]
function fillList(S) {
  const A = S.arch, v = S.variant, home = S.role === 'home';
  const L = [];
  const add = (key, w, d, h, rooms, build, o = {}) => L.push({ key, w, d, h, rooms, build, ...o });
  if (A === 'cottage' || A === 'farmhouse') {
    add('kshelf', 1.1, 0.35, 1.8, ['main', 'back'], Fu.kitchenShelf, { tall: true });
    if (A === 'farmhouse') { add('dresser', 1.3, 0.5, 2.0, ['main'], Fu.dresser, { tall: true }); add('churn', 0.45, 0.45, 1.3, ['main'], Fu.churn); }
    add('chest', 0.9, 0.5, 0.6, ['bed', 'main'], Fu.chest);
    add('barrel', 0.62, 0.62, 0.8, ['main'], Fu.barrelAt);
    add('crocks', 0.7, 0.35, 0.3, ['main'], (b, it, r) => Fu.crocks(b, it, -0.25, 0, 0, 3, r));
    add('sacks', 0.9, 0.55, 0.5, ['main', 'bed'], Fu.sacks);
    add('bench', 1.3, 0.38, 0.5, ['main'], Fu.bench);
  } else if (A === 'townhouse') {
    add('counter', 1.8, 0.6, 1.0, ['shop'], (b, it, r) => Fu.counter(b, it, r, (y) => { for (let i = 0; i < 3; i++) Fu.ib(b, 'cloth', it, -0.6 + i * 0.4, y, -0.15, -0.3 + i * 0.4, y + 0.1, 0.15, pick(r, ['#4a5a8a', '#8a3a2a', '#d8c8a0'])); }));
    add('cshelf', 1.2, 0.4, 1.8, ['shop'], Fu.clothShelf, { tall: true });
    add('stair', 2.6, 0.85, 2.75, ['shop', 'back'], Fu.stair, { tall: true });
    add('dresser', 1.2, 0.5, 2.0, ['back'], Fu.dresser, { tall: true });
    add('crates', 1.0, 0.6, 0.9, ['shop', 'back'], Fu.crates);
    add('barrel', 0.62, 0.62, 0.8, ['back'], Fu.barrelAt);
    add('chest', 0.9, 0.5, 0.6, ['back', 'shop'], Fu.chest);
  } else if (A === 'longhouse') {
    add('ltable', 2.4, 0.8, 0.8, ['main'], (b, it, r) => { Fu.table(b, it, r); for (const sz of [-1, 1]) Fu.bench(b, { ...it, z: it.z, w: it.w - 0.2, d: 0.32, ...shiftIt(it, 0, sz * 0.62) }); }, { free: true, dz: 1.9 });
    add('sbench', 2.0, 0.75, 0.6, ['bed'], Fu.sleepBench);
    add('sbench', 2.0, 0.75, 0.6, ['bed', 'main'], Fu.sleepBench);
    add('tools', 1.0, 0.2, 1.8, ['main'], Fu.hangTools, { tall: true, thin: true });
    add('sacks', 1.0, 0.55, 0.5, ['main', 'bed'], Fu.sacks);
    add('barrel', 0.62, 0.62, 0.8, ['main'], Fu.barrelAt);
    add('chest', 0.9, 0.5, 0.6, ['bed'], Fu.chest);
  } else if (A === 'shop') {
    const shopRoom = ['shop'], back = [v === 'bakery' ? 'work' : 'back'];
    if (v === 'bakery') {
      add('lshelf', 1.2, 0.4, 1.8, shopRoom, Fu.loafShelf, { tall: true });
      add('peels', 1.0, 0.2, 2.0, back, Fu.peelRack, { tall: true, thin: true });
      add('flour', 1.1, 0.55, 0.5, back, (b, it, r) => Fu.sacks(b, it, r, null, '#e8e0d0'));
    } else if (v === 'weaver') {
      add('spools', 1.2, 0.4, 1.8, shopRoom.concat(back), Fu.spoolRack, { tall: true });
      add('cshelf', 1.2, 0.4, 1.8, shopRoom, Fu.clothShelf, { tall: true });
    } else if (v === 'clerk') {
      add('ledgers', 1.1, 0.35, 1.9, shopRoom.concat(back), Fu.ledgerShelf, { tall: true });
      add('ledgers', 1.1, 0.35, 1.9, back.concat(shopRoom), Fu.ledgerShelf, { tall: true });
      add('strong', 0.7, 0.5, 0.55, back, Fu.strongbox);
    } else {
      add('jars', 1.2, 0.38, 1.8, shopRoom, Fu.jarShelf, { tall: true });
      add('jars', 1.0, 0.38, 1.8, back, Fu.jarShelf, { tall: true });
      add('barrel', 0.62, 0.62, 0.8, back, Fu.barrelAt);
    }
    add('counter', 1.6, 0.6, 1.0, shopRoom, (b, it, r) => Fu.counter(b, it, r));
    add('crates', 1.0, 0.6, 0.9, back.concat(shopRoom), Fu.crates);
    add('chest', 0.9, 0.5, 0.6, back, Fu.chest);
  } else if (A === 'towerhouse') {
    add('barrel', 0.62, 0.62, 0.8, ['main'], Fu.barrelAt);
    add('barrel', 0.62, 0.62, 0.8, ['main'], Fu.barrelAt);
    add('wrack', 1.1, 0.3, 1.6, ['main'], Fu.weaponRack, { tall: true });
    add('sacks', 0.9, 0.55, 0.5, ['main'], Fu.sacks);
    add('chest', 0.9, 0.5, 0.6, ['main'], Fu.chest);
    add('crates', 0.8, 0.6, 0.9, ['main'], Fu.crates);
  } else if (A === 'smithy') {
    add('quench', 0.9, 0.55, 0.6, ['work'], Fu.quench);
    add('trrack', 1.2, 0.2, 1.9, ['work'], Fu.toolRack, { tall: true, thin: true });
    add('bars', 1.4, 0.35, 1.1, ['work'], Fu.barStock);
    add('wbench', 1.4, 0.6, 1.0, ['work'], Fu.workbench, { model: 'workbench' });
    add('coal', 0.9, 0.6, 0.6, ['work'], Fu.coalBin);
  } else { // works
    add('pipes', 2.4, 0.3, 2.4, ['main', 'back'], Fu.pipesWall, { tall: true, thin: true });
    add('gauges', 1.2, 0.18, 1.9, ['main', 'back'], Fu.gauges, { tall: true, thin: true });
    if (home) { add('bunk', 1.9, 0.9, 1.8, ['back', 'main'], Fu.bunk, { tall: true }); add('bunk', 1.9, 0.9, 1.8, ['main', 'back'], Fu.bunk, { tall: true }); }
    add('crates', 1.0, 0.6, 0.9, ['main', 'back'], Fu.crates);
    add('coal', 0.9, 0.6, 0.6, ['back', 'main'], Fu.coalBin);
    add('jars', 1.0, 0.36, 1.8, ['back', 'main'], Fu.jarShelf, { tall: true });
    add('sacks', 0.9, 0.55, 0.5, ['main', 'back'], Fu.sacks);
    add('barrel', 0.62, 0.62, 0.8, ['main', 'back'], Fu.barrelAt);
  }
  // then the small things that fill corners: a basket of crates, sacks, a spare barrel, a stool, as room allows
  const any = S.rooms.map((R) => R.kind);
  const area = (S.inner.x1 - S.inner.x0) * (S.inner.z1 - S.inner.z0);
  const extra = [['crates', 0.8, 0.6, 0.9, Fu.crates], ['sacks', 0.8, 0.5, 0.5, Fu.sacks], ['barrel', 0.62, 0.62, 0.8, Fu.barrelAt], ['stool', 0.4, 0.4, 0.5, Fu.stool], ['crocks', 0.6, 0.3, 0.3, (b, it, r) => Fu.crocks(b, it, -0.2, 0, 0, 3, r)]];
  if (A !== 'works' && A !== 'smithy') extra.push(['bench', 1.2, 0.36, 0.5, Fu.bench]);
  for (let i = 0; i < Math.min(5, Math.floor(area / 7)); i++) { const [k, w, d, h, f] = extra[(i + S.seed) % extra.length]; add(k, w, d, h, any, f); }
  return L;
}
function shiftIt(it, dx, dz) { const c = Math.cos(it.ry), s = Math.sin(it.ry); return { x: it.x + dx * c + dz * s, z: it.z - dx * s + dz * c }; }

// ------------------------------------------------------------------ the interior
export function buildInteriorLocal(S, { props = false } = {}) {
  const b = new Builder(S.seed * 7 + 5), r = houseRng(S.seed, 4), I = S.inner;
  const out = { builder: b, circles: [], lamps: [], fires: [], items: [], reserve: null, props: [] };
  // a ready-made prop: its built piece goes to its own stand-in builder (same draws from r), the model is listed
  const asProp = (name, it, fit) => { const fb = new Builder(S.seed * 7 + 6 + out.props.length); const f = fit || PROP_FIT[name](it); out.props.push({ name, p: Fu.at(it, f.at[0], f.at[1], f.at[2]), ry: it.ry, s: f.s, fb }); return fb; };
  const [linMat, linC] = LINING[S.style] || LINING.sunmere;
  const topY = Math.min(S.wallTop, WALL_H);
  // floors, one per room and under each partition
  // (LF.3: the walked-on face is a sheet cut in ~0.5 m cells over the slab, so the baked lamp light and dark corners
  // (bakeLight) have vertices to shade; the box UVs run on across the cells, so the boards look the same)
  for (const R of S.rooms) {
    const [m, c] = floorMat(S, R), w = R.x1 - R.x0, d = R.z1 - R.z0;
    if (!LF3) { bx(b, m, R.x0, -0.03, R.z0, R.x1, 0, R.z1, c); continue; }
    bx(b, m, R.x0, -0.03, R.z0, R.x1, -0.002, R.z1, c);
    const fg = new Fu.THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / 0.5)), Math.max(1, Math.round(d / 0.5)));
    fg.rotateX(-Math.PI / 2); fg.translate((R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2);
    b.add(fg, m, { uv: 'box', c });
  }
  for (const P of S.parts) bx(b, floorMat(S, S.rooms[0])[0], P.x0, -0.03, P.z0, P.x1, -0.001, P.z1, '#c8b090');
  // the lining on every outer wall (cut round the openings), with a skirting board; the side faces stop short of the
  // corners so no two lining faces overlap
  const fakeCtx = { shell: b };
  for (const f of FACES) {
    const F = faceOf(S, f), opens = openingsOn(S, f).filter((o) => o.y0 < topY);
    const [ta, tb] = f === 'front' || f === 'back' ? [I.x0, I.x1] : [I.z0 + 0.021, I.z1 - 0.021];
    wallBand(fakeCtx, F, ta, tb, 0, topY, opens, { upperMat: linMat, upperTint: linC, inner: U.lining, uOut: -HT });
    const door = opens.find((o) => o.kind === 'door');
    const runs = door ? [[ta, door.t0], [door.t1, tb]] : [[ta, tb]];
    for (const [p, q] of runs) if (q - p > 0.05) fbox(b, 'wood', F, p + 0.001, q - 0.001, 0, 0.12, U.lining - 0.022, U.lining, '#6a5040');
    // inner window sills
    for (const o of opens) if (o.kind === 'win') fbox(b, 'wood', F, o.t0 - 0.05, o.t1 + 0.05, o.y0 - 0.035, o.y0 + 0.012, -HT - 0.16, -HT + 0.02, '#a88a68');
  }
  // partitions, the head above each gap and a timber door frame round it
  for (const P of S.parts) bx(b, linMat, P.x0, 0, P.z0, P.x1, topY, P.z1, shade(linC, 0.97));
  for (const G of partGaps(S)) {
    const t = 0.1, half = 0.115;
    if (G.along === 'x') {
      bx(b, linMat, G.lo, DOOR_H - 0.08, G.at - 0.1, G.hi, topY, G.at + 0.1, shade(linC, 0.97));
      for (const x of [G.lo, G.hi - t]) if (x > I.x0 + 0.01 && x + t < I.x1 - 0.01) bx(b, 'beam', x, 0, G.at - half, x + t, DOOR_H - 0.08, G.at + half, '#ffffff');
      bx(b, 'beam', G.lo, DOOR_H - 0.16, G.at - half, G.hi, DOOR_H - 0.08, G.at + half, '#ffffff');
    } else {
      bx(b, linMat, G.at - 0.1, DOOR_H - 0.08, G.lo, G.at + 0.1, topY, G.hi, shade(linC, 0.97));
      for (const z of [G.lo, G.hi - t]) if (z > I.z0 + 0.01 && z + t < I.z1 - 0.01) bx(b, 'beam', G.at - half, 0, z, G.at + half, DOOR_H - 0.08, z + t, '#ffffff');
      bx(b, 'beam', G.at - half, DOOR_H - 0.16, G.lo, G.at + half, DOOR_H - 0.08, G.hi, '#ffffff');
    }
  }
  // ceiling joists across the short span, 0.15 under the cut
  const jy = S.cutY - S.floorY - 0.15;
  const alongX = I.x1 - I.x0 <= I.z1 - I.z0; // joists run along the shorter side
  const L0 = alongX ? I.z0 : I.x0, L1 = alongX ? I.z1 : I.x1, n = Math.max(2, Math.round((L1 - L0) / 1.9)); // (review: every 1.9 m, not 0.95: dense joists striped the top-down view)
  // (v108: the joists are no longer built. The room is only ever seen with the house cut away, and the cut takes
  // everything over CUT_CEIL inside the room: they only ever showed as dark bars crossing the view. out.joist stays for
  // the layout's random draws.)
  out.joist = { alongX, at: Array.from({ length: n }, (_, i) => lerp(L0 + 0.3, L1 - 0.3, i / (n - 1))), y: jy };

  // ---------------------------------------------------------------- the grid: what must stay clear
  const g = new Grid(I);
  for (const P of S.parts) g.rect(grow(P, 0.03));
  const C = S.chimney;
  let hearth = null;
  if (C && C.face) {
    const s = C.face === 'right' ? 1 : -1, x0 = s * (S.w / 2 - WALL_T), x1 = C.lx - s * C.w / 2;
    hearth = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: C.lz - C.w / 2, z1: C.lz + C.w / 2, s };
    g.rect(grow(hearth, 0.04));
  } else if (C) hearth = { pit: true, ...rectAt(C.lx, C.lz, C.w, C.w) };
  g.rect(grow(S.doorZone, 0.1));
  const { list: corr, main } = corridors(S);
  for (const [a, c] of corr) g.capsule(a, c, 0.56);
  const spots = S.spots.map((p) => ({ ...p, ly: p.ry - S.rot }));
  for (const p of spots) g.capsule([p.lx, p.lz], [p.lx, p.lz], 0.3);
  const approach = spots[0] ? [spots[0].lx + Math.cos(S.rot), spots[0].lz + Math.sin(S.rot)] : null;
  if (approach) g.capsule([spots[0].lx, spots[0].lz], approach, 0.42);
  const roomOf = (x, z) => S.rooms.find((R) => inR(R, x, z)) || null;
  const win = (f) => openingsOn(S, f).filter((o) => o.kind !== 'door');
  const place = (it, build, { circles = true, model = null } = {}) => {
    const R = rectAt(it.x, it.z, Math.abs(Math.cos(it.ry)) > 0.5 ? it.w : it.d, Math.abs(Math.cos(it.ry)) > 0.5 ? it.d : it.w);
    g.rect(grow(R, 0.02));
    build(props && model ? asProp(model, it) : b, it, r, S.accent);
    out.items.push({ key: it.key, rect: R, x: it.x, z: it.z, ry: it.ry, w: it.w, d: it.d, h: it.h, room: roomOf(it.x, it.z)?.kind || null });
    if (circles && it.h > 0.25) for (const c of circlesOf(R)) out.circles.push({ ...c, kind: 'furn' });
    return R;
  };

  // ---------------------------------------------------------------- the hearth
  let ovenless = false; // a bakery whose oven found no room before its breast: it stands against a work-room wall instead
  if (hearth && !hearth.pit) {
    const room = roomOf((hearth.x0 + hearth.x1) / 2, (hearth.z0 + hearth.z1) / 2);
    const s = hearth.s, face = s > 0 ? 'right' : 'left', it = { x: (hearth.x0 + hearth.x1) / 2, z: C.lz, ry: s > 0 ? -Math.PI / 2 : Math.PI / 2, w: C.w, d: hearth.x1 - hearth.x0, h: topY };
    // a bakery's oven or a smithy's forge stands in front of the breast (a bakery's oven, when the full-size one has no
    // room, a little shallower and narrower, or slid along the breast)
    const fx = C.lx - s * (C.w / 2 + 0.55), smithy = S.arch === 'smithy';
    let ov = null;
    if (S.variant === 'bakery' || smithy) {
      const big0 = smithy ? { w: 1.2, d: 0.9 } : { w: Math.min(1.3, C.w + 0.1), d: 0.95 }, small = { w: Math.min(1.1, big0.w), d: 0.8 };
      const cands = smithy ? [[big0, 0]] : [[big0, 0], [{ w: big0.w, d: 0.8 }, 0], ...[0, 0.15, -0.15, 0.3, -0.3].map((dz) => [small, dz])];
      for (const [big, dz] of cands) {
        const ox = hearth.s > 0 ? hearth.x0 - big.d / 2 - 0.02 : hearth.x1 + big.d / 2 + 0.02;
        if (g.free(rectAt(ox, C.lz + dz, big.d, big.w))) { ov = { big, ox, oz: C.lz + dz }; break; }
      }
    }
    wallHearth(b, it, r, S, Math.min(topY, HEARTH_TOP), out, props ? (fit) => asProp('hearth', it, fit) : null, !!ov);
    for (const c of circlesOf(hearth)) out.circles.push({ ...c, kind: 'hearth' });
    if (ov) {
      const { big, ox, oz } = ov;
      const oit = { key: smithy ? 'forge' : 'oven', x: ox, z: oz, ry: it.ry, w: big.w, d: big.d, h: 1.2 };
      place(oit, smithy ? Fu.forge : Fu.oven, { model: smithy ? null : 'oven' });
      // the forge's coals on top; the oven's fire in its mouth (the model's mouth is a shallow recess)
      out.fires.push({ p: smithy ? [ox, 0.9, oz] : Fu.at(oit, 0, 0.55, big.d / 2 - 0.1), scale: 0.35, light: true });
    } else if (!smithy) {
      ovenless = S.variant === 'bakery';
      // the hearthstone in front (a decal-height slab) is kept clear
      g.rect(rectAt(fx + s * 0.2, C.lz, 0.6, C.w + 0.2));
    }
    void room; void face;
  } else if (hearth && hearth.pit) {
    hearthPit(b, C, r, out);
    g.rect(grow(hearth, 0.3));
    for (const c of circlesOf(hearth)) out.circles.push({ ...c, kind: 'pit' });
  }

  // ---------------------------------------------------------------- spot-tied pieces
  // walls only (partition cells are 1 too, so a fresh grid of walls for the distance check)
  const wallsOnly = new Grid(I); for (const P of S.parts) wallsOnly.rect(P, 2); if (hearth) wallsOnly.rect(hearth.pit ? grow(hearth, 0.3) : hearth, 2);
  const toWall = (x, z, dx, dz) => { for (let k = 0.05; k < 3; k += 0.05) { const px = x + dx * k, pz = z + dz * k; if (!inR(I, px, pz) || wallsOnly.a[wallsOnly.ix(px) * wallsOnly.nz + wallsOnly.iz(pz)]) return k; } return 3; };
  const tied = (sp, piece, { gap = 0.32, along = 0, fit = true } = {}) => {
    const f = [Math.sin(sp.ly), Math.cos(sp.ly)], side = [f[1], -f[0]];
    const room = toWall(sp.lx, sp.lz, f[0], f[1]) - 0.04;
    const d = fit ? clamp(room - gap, 0.4, piece.d) : piece.d;
    for (const sh of [0, 0.25, -0.25, 0.5, -0.5]) {
      for (const w of [piece.w, piece.w * 0.8]) {
        const c = gap + d / 2, x = sp.lx + f[0] * c + side[0] * (sh + along), z = sp.lz + f[1] * c + side[1] * (sh + along);
        const ry = Math.atan2(-f[0], -f[1]); // the piece faces the man
        const R = rectAt(x, z, Math.abs(f[0]) > 0.5 ? d : w, Math.abs(f[0]) > 0.5 ? w : d);
        if (!g.free(R)) continue;
        return place({ key: piece.key, x, z, ry, w, d, h: piece.h ?? 0.9 }, piece.build, { model: piece.model || null });
      }
    }
    return null;
  };
  const sp = (k) => spots.find((p) => p.k === k);
  // the worker's piece, the sleeper's bed, the sitter's table (each needs its wall roughly square to the house)
  const snap = (p) => { const a = Math.round(p.ly / (Math.PI / 2)) * (Math.PI / 2); return Math.abs(a - p.ly) < 0.3 ? { ...p, ly: a } : null; };
  { const p = sp('work') && snap(sp('work')), wp = workPiece(S);
    if (p && tied(p, wp) && wp.chair) Fu.chair(b, { x: p.lx, z: p.lz, ry: p.ly + Math.PI, w: 0.45, d: 0.45 }); }
  { const p = sp('bed') && snap(sp('bed'));
    const bunk = S.arch === 'works';
    if (p) tied(p, { key: bunk ? 'bunk' : 'bed', w: 1.95, d: 0.92, h: bunk ? 1.8 : 0.6, build: (bb, it, rr) => (bunk ? Fu.bunk(bb, it, rr) : Fu.bed(bb, it, rr, S.accent)) }, { gap: 0.3 }); }
  { const p = sp('sit');
    if (p) {
      Fu.stool(b, { x: p.lx, z: p.lz, ry: p.ly, w: 0.34, d: 0.34 });
      const q = { ...p, ly: Math.round(p.ly / (Math.PI / 2)) * (Math.PI / 2) };
      tied(q, { key: 'table', w: 0.9, d: 0.65, h: 0.78, build: (bb, it, rr) => { Fu.table(bb, it, rr); Fu.bowls(bb, it, -0.2, 0.78, 0.0, 2, rr); } }, { gap: 0.3, fit: false });
    }
  }
  // now the full keep-clear disc round every spot
  for (const p of spots) g.capsule([p.lx, p.lz], [p.lx, p.lz], 0.45);

  // ---------------------------------------------------------------- the rest, against the walls
  const edges = [];
  for (const R of S.rooms) {
    for (const side of ['x0', 'x1', 'z0', 'z1']) {
      const outerFace = side === 'x0' && Math.abs(R.x0 - I.x0) < 1e-3 ? 'left' : side === 'x1' && Math.abs(R.x1 - I.x1) < 1e-3 ? 'right' : side === 'z0' && Math.abs(R.z0 - I.z0) < 1e-3 ? 'back' : side === 'z1' && Math.abs(R.z1 - I.z1) < 1e-3 ? 'front' : null;
      edges.push({ R, side, outer: outerFace });
    }
  }
  const fills = fillList(S);
  if (ovenless) fills.unshift({ key: 'oven', w: 1.1, d: 0.8, h: 1.5, rooms: ['work', 'back', 'shop'], build: Fu.oven, model: 'oven', tall: true });
  for (const item of fills) {
    let best = null, bs = Infinity;
    if (item.free) {
      // free-standing (the long table): anywhere in its room, square to the walls
      for (const R of S.rooms) {
        if (!item.rooms.includes(R.kind)) continue;
        for (const rot of [0, 1]) for (let x = R.x0 + 0.3; x <= R.x1 - 0.3; x += 0.1) for (let z = R.z0 + 0.3; z <= R.z1 - 0.3; z += 0.1) {
          const w = rot ? item.d + (item.dz || 0) : item.w, d = rot ? item.w : item.d + (item.dz || 0);
          const Rr = rectAt(x, z, w, d); if (!g.free(Rr)) continue;
          const [cx, cz] = center(R), s = Math.hypot(x - cx, z - cz) * 0.4 + r() * 0.3;
          if (s < bs) { bs = s; best = { x, z, ry: rot ? Math.PI / 2 : 0, w: item.w, d: item.d, h: item.h, rect: Rr }; }
        }
      }
    } else {
      for (const E of edges) {
        const pref = item.rooms.indexOf(E.R.kind); if (pref < 0) continue;
        const R = E.R, vert = E.side === 'x0' || E.side === 'x1';
        const a0 = vert ? R.z0 : R.x0, a1 = vert ? R.z1 : R.x1;
        const inset = E.outer ? 0.025 : 0.035;
        const line = E.side === 'x0' ? R.x0 + inset : E.side === 'x1' ? R.x1 - inset : E.side === 'z0' ? R.z0 + inset : R.z1 - inset;
        const into = E.side === 'x0' || E.side === 'z0' ? 1 : -1;
        const ry = E.side === 'x0' ? Math.PI / 2 : E.side === 'x1' ? -Math.PI / 2 : E.side === 'z0' ? 0 : Math.PI;
        const wins = E.outer ? win(E.outer) : [];
        for (let t = a0 + item.w / 2 + 0.02; t <= a1 - item.w / 2 - 0.02; t += 0.1) {
          const c = line + into * item.d / 2;
          const x = vert ? c : t, z = vert ? t : c;
          const Rr = rectAt(x, z, vert ? item.d : item.w, vert ? item.w : item.d);
          if (!g.free(Rr)) continue;
          if (E.outer && wins.some((o) => o.t0 < t + item.w / 2 + 0.05 && o.t1 > t - item.w / 2 - 0.05 && o.y0 < item.h + 0.05)) continue;
          // the door wall near the door stays clear of tall things
          const s = pref * 1.2 + r() * 1.5 + (item.tall && E.outer === doorFace(S) ? 0.8 : 0);
          if (s < bs) { bs = s; best = { x, z, ry, w: item.w, d: item.d, h: item.h, rect: Rr }; }
        }
      }
    }
    if (!best) continue;
    place({ key: item.key, ...best }, item.build, { circles: !item.thin, model: item.model || null });
    if (item.key === 'oven') out.fires.push({ p: Fu.at(best, 0, 0.55, best.d / 2 - 0.1), scale: 0.35, light: true });
  }

  // ---------------------------------------------------------------- rugs and herbs (no collision), then the lamps
  for (const R of S.rooms) {
    if (!['main', 'bed', 'shop', 'back'].includes(R.kind) || r() < 0.3 || S.arch === 'works' || S.arch === 'smithy') continue;
    const w = clamp((R.x1 - R.x0) * 0.45, 1.0, 2.2), d = clamp((R.z1 - R.z0) * 0.4, 0.8, 1.6);
    const [cx, cz] = center(R), Rr = rectAt(cx, cz, w, d);
    if (out.items.some((it) => overlap(it.rect, Rr)) || (hearth && overlap(grow(hearth, 0.4), Rr)) || overlap(S.doorZone, Rr)) continue;
    Fu.rug(b, { x: cx, z: cz, ry: 0, w, d }, r);
    out.items.push({ key: 'rug', rect: Rr, x: cx, z: cz, ry: 0, w, d, h: 0.04, room: R.kind });
  }
  if (['cottage', 'farmhouse', 'longhouse', 'townhouse'].includes(S.arch)) {
    const at = out.joist.at[Math.floor(r() * out.joist.at.length)];
    const p = out.joist.alongX ? [lerp(I.x0 + 0.8, I.x1 - 0.8, r()), at] : [at, lerp(I.z0 + 0.8, I.z1 - 0.8, r())];
    Fu.herbs(new Builder(1), { x: p[0], z: p[1], ry: out.joist.alongX ? 0 : Math.PI / 2, w: 1, d: 0.1 }, r, jy - 0.09); // (v108: built into a throwaway: no herbs without joists, but the same draws, so the layout never changes)
  }
  // every room gets a light: its fire, or a lantern on a piece in it, or a lantern on a wall bracket
  const lit = new Set();
  for (const f of out.fires) { const R = roomOf(f.p[0], f.p[2]); if (R) lit.add(R); }
  if (hearth) { const R = roomOf((hearth.x0 + hearth.x1) / 2 - (hearth.s || 0) * 0.4, (hearth.z0 + hearth.z1) / 2); if (R) lit.add(R); }
  for (const R of S.rooms) {
    const host = out.items.find((it) => it.room === R.kind && ['table', 'ktable', 'wtable', 'desk', 'counter', 'dresser', 'chest', 'wbench', 'knead', 'strong', 'ltable'].includes(it.key) && inR(R, it.x, it.z));
    if (lit.has(R) && !host) continue;
    if (host) {
      const top = { table: 0.78, ktable: 0.86, wtable: 0.86, desk: 0.78, counter: 0.96, dresser: 0.9, chest: 0.55, wbench: 0.88, knead: 0.92, strong: 0.5, ltable: 0.8 }[host.key];
      const c = Math.cos(host.ry), s = Math.sin(host.ry), lx = (host.w / 2 - 0.15) * (r() < 0.5 ? 1 : -1), lz = host.key === 'dresser' ? 0.08 : 0;
      const p = [host.x + lx * c + lz * s, top, host.z - lx * s + lz * c];
      Fu.lantern(b, p, 1);
      out.lamps.push({ p: [p[0], p[1] + 0.15, p[2]], color: 0xffc070, scale: 0.9 });
    } else {
      // a lantern on an iron stand 0.36 m off the wall, mid-wall first, a wall without windows first (v109: it hung on a
      // wall bracket at 1.75 m, inside the wall band the cut-away takes, so an open house lost the lantern and kept its
      // light; the stand keeps it clear of the band and under the cut's ceiling line). No room for one: on the floor.
      const o = 0.36, fr = [0.5, 0.3, 0.7];
      const cand = [];
      for (const [f, x, z] of [['left', R.x0 + o, null], ['right', R.x1 - o, null], ['back', null, R.z0 + o], ['front', null, R.z1 - o]]) {
        const bare = win(f).length === 0;
        for (const t of fr) cand.push([x ?? lerp(R.x0, R.x1, t), z ?? lerp(R.z0, R.z1, t), f, bare ? 0 : 1]);
      }
      cand.sort((A, B) => A[3] - B[3]);
      const st = cand.find(([x, z]) => g.free(rectAt(x, z, 0.3, 0.3)));
      if (st) {
        const [x, z] = st, y = 1.42;
        bx(b, 'iron', x - 0.12, 0, z - 0.12, x + 0.12, 0.04, z + 0.12, '#3a3634');
        bx(b, 'iron', x - 0.025, 0.04, z - 0.025, x + 0.025, y, z + 0.025, '#3a3634');
        Fu.lantern(b, [x, y, z], 0.9);
        g.rect(rectAt(x, z, 0.3, 0.3));
        out.circles.push({ x, z, r: 0.15, kind: 'furn' });
        out.lamps.push({ p: [x, y + 0.15, z], color: 0xffc070, scale: 0.85 });
      } else {
        const p = [R.x0 + 0.2, 0, center(R)[1]];
        Fu.lantern(b, p, 0.9);
        out.lamps.push({ p: [p[0], 0.2, p[2]], color: 0xffc070, scale: 0.85 });
      }
    }
    lit.add(R);
  }
  // (LF.3) rugs by the bed and the hearth, landscapes on the walls, then the lamp light and dark corners baked in
  // (client-only random streams 11 and 12: the layout above never moves)
  if (LF3) lookExtras(b, S, out, { hearth, roomOf, r2: houseRng(S.seed, 11) });
  if (LF3) bakeLight([b, ...out.props.map((P) => P.fb)], S, out);
  out.reserve = { corridors: corr, doorZone: S.doorZone, approach };
  void main;
  return out;
}
// ------------------------------------------------------------------ LF.3 look: rugs, pictures, lamp light
// rugs (no collision) beside the bed and before the hearth, where they touch no piece, no door zone and no lamp stand;
// up to two framed landscapes on the outer walls at eye height, clear of windows, the door, the hearth and anything over
// 1 m standing under them. (The wall pictures sit in the wall band, so the cut-away takes them with the wall: they show
// from the doorway and through the windows. The breast's picture, wallHearth, stays.)
function lookExtras(b, S, out, { hearth, roomOf, r2 }) {
  const I = S.inner, items = out.items.slice();
  const clearRug = (Rr, R) => R && Rr.x0 > R.x0 + 0.05 && Rr.x1 < R.x1 - 0.05 && Rr.z0 > R.z0 + 0.05 && Rr.z1 < R.z1 - 0.05 &&
    !items.some((it) => overlap(it.rect, Rr)) && !overlap(S.doorZone, Rr) && !(hearth && overlap(grow(hearth, 0.05), Rr)) &&
    !out.circles.some((c) => inR(Rr, c.x, c.z, c.r)) && !out.lamps.some((l) => inR(Rr, l.p[0], l.p[2], 0.2));
  const rugAt = (key, it) => {
    const along = Math.abs(Math.cos(it.ry)) > 0.5, Rr = rectAt(it.x, it.z, along ? it.w : it.d, along ? it.d : it.w);
    if (!clearRug(Rr, roomOf(it.x, it.z))) return false;
    Fu.rug(b, it, r2);
    const e = { key, rect: Rr, x: it.x, z: it.z, ry: it.ry, w: it.w, d: it.d, h: 0.04, room: roomOf(it.x, it.z)?.kind || null };
    out.items.push(e); items.push(e);
    return true;
  };
  // beside the bed (its long side faces the sleeper: item +z)
  const bed = out.items.find((it) => it.key === 'bed');
  if (bed) for (const dz of [0.42, 0.55, 0.7]) { const p = Fu.at(bed, 0, 0, bed.d / 2 + dz); if (rugAt('rug', { x: p[0], z: p[2], ry: bed.ry, w: 1.3, d: 0.62 })) break; }
  // before the wall hearth, past its hearthstone (a longhouse's pit gets none: people sit round it)
  if (hearth && !hearth.pit) {
    const s = hearth.s, face = s > 0 ? hearth.x0 : hearth.x1, z = (hearth.z0 + hearth.z1) / 2;
    for (const off of [0.9, 1.0, 1.15]) if (rugAt('rug', { x: face - s * off, z, ry: Math.PI / 2, w: 1.4, d: 0.66 })) break;
  }
  // the wall pictures
  let pics = 0;
  const onFace = (R, f) => (f === 'front' ? Math.abs(R.z1 - I.z1) < 1e-3 : f === 'back' ? Math.abs(R.z0 - I.z0) < 1e-3 : f === 'left' ? Math.abs(R.x0 - I.x0) < 1e-3 : Math.abs(R.x1 - I.x1) < 1e-3);
  for (const R of S.rooms) {
    if (pics >= 2 || S.arch === 'works' || S.arch === 'smithy') break;
    let done = false;
    for (const f of FACES) {
      if (done || !onFace(R, f)) continue;
      const F = faceOf(S, f), lo = F.tan[0] ? R.x0 : R.z0, hi = F.tan[0] ? R.x1 : R.z1, opens = openingsOn(S, f);
      const pw = between(r2, 0.62, 0.8), ph = pw * between(r2, 0.6, 0.7), yc = 1.52;
      for (const tf of [0.5, 0.32, 0.68]) {
        const t = lerp(lo, hi, tf);
        if (t - pw / 2 < lo + 0.2 || t + pw / 2 > hi - 0.2) continue;
        if (opens.some((o) => o.t0 < t + pw / 2 + 0.12 && o.t1 > t - pw / 2 - 0.12 && o.y1 > yc - ph / 2 - 0.1 && o.y0 < yc + ph / 2 + 0.1)) continue;
        const A = fp(F, t - pw / 2, 0, U.lining), B = fp(F, t + pw / 2, 0, U.lining - 0.75);
        const Rr = { x0: Math.min(A[0], B[0]), z0: Math.min(A[2], B[2]), x1: Math.max(A[0], B[0]), z1: Math.max(A[2], B[2]) };
        if (out.items.some((it) => it.h > 1.0 && overlap(it.rect, Rr))) continue;
        if (out.lamps.some((l) => l.p[1] > 0.9 && inR(Rr, l.p[0], l.p[2], 0.3))) continue;
        if (hearth && overlap(grow(hearth, 0.25), Rr)) continue;
        const P = fp(F, t, 0, U.lining);
        Fu.landscape(b, { x: P[0], z: P[2], ry: Math.atan2(-F.n[0], -F.n[1]) }, r2, pw, ph, yc);
        pics++; done = true; break;
      }
    }
  }
}
// the room's light, baked into the vertex colours (free at draw time, every quality): warm and full near each lamp and
// fire (lights count only in their own room), dimmer away from them, and darker again in the corners and along the
// walls, so a room reads lamp-lit with dark corners by day and night alike. The glowing glass and flames are left as
// they are
const NO_BAKE = new Set(['glowYellow', 'glassWarm', 'doorWarm', 'fire']);
function bakeLight(builders, S, out) {
  const I = S.inner, roomOf = (x, z) => S.rooms.find((R) => inR(R, x, z)) || null;
  const L = [...out.lamps.map((l) => ({ p: l.p, k: 1, R: 3.2 })), ...out.fires.map((f) => ({ p: [f.p[0], f.p[1] + 0.35, f.p[2]], k: 1.25, R: 4.4 }))]
    .map((l) => ({ ...l, room: roomOf(l.p[0], l.p[2]) }));
  const sst = (a, c, v) => { const t = clamp((v - a) / (c - a), 0, 1); return t * t * (3 - 2 * t); };
  for (const bd of builders) for (const [mat, list] of bd.parts) {
    if (NO_BAKE.has(mat) || mat.startsWith('glow')) continue;
    for (const geo of list) {
      const p = geo.attributes.position, col = geo.attributes.color;
      if (!col) continue;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), R = roomOf(x, z);
        const kx = sst(0, 1.1, Math.max(0, Math.min(x - I.x0, I.x1 - x))), kz = sst(0, 1.1, Math.max(0, Math.min(z - I.z0, I.z1 - z)));
        const occ = 1 - 0.26 * (1 - kx) * (1 - kz) - 0.07 * (2 - kx - kz);
        let lit = 0;
        for (const l of L) {
          if (R && l.room && l.room !== R) continue;
          const q = ((x - l.p[0]) ** 2 + (y - l.p[1]) ** 2 + (z - l.p[2]) ** 2) / (l.R * l.R);
          if (q < 1) lit += l.k * (1 - q) * (1 - q);
        }
        lit = Math.min(1.2, lit);
        const m = occ * (0.76 + 0.32 * lit);
        col.setXYZ(i, col.getX(i) * m * (1 + 0.07 * lit), col.getY(i) * m, col.getZ(i) * m * (1 - 0.1 * lit));
      }
    }
  }
}
const overlap = (A, B) => A.x0 < B.x1 && A.x1 > B.x0 && A.z0 < B.z1 && A.z1 > B.z0;
// circles inside a footprint: radius half the short side, centres spread along the long side
export function circlesOf(R) {
  const w = R.x1 - R.x0, d = R.z1 - R.z0, rr = Math.min(w, d) / 2, L = Math.max(w, d), n = Math.max(1, Math.ceil(L / (2 * rr) - 0.15));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), a = -L / 2 + rr + t * (L - 2 * rr);
    out.push(w >= d ? { x: (R.x0 + R.x1) / 2 + a, z: (R.z0 + R.z1) / 2, r: rr } : { x: (R.x0 + R.x1) / 2, z: (R.z0 + R.z1) / 2 + a, r: rr });
  }
  return out;
}

// the hearth in a chimney breast: stone cheeks round a square firebox, a stone lintel, the breast above, a mantel shelf,
// an iron bar with a pot on a hook, and the fire (its flame anchor goes to the world's fires). asProp(fit): the
// ready-made hearth takes everything up to its own top (HEARTH_FIT); the breast above it stays in b, up to the ceiling.
function wallHearth(b0, it, r, S, topY, out, asProp = null, flush = false) {
  const { w, d } = it, open = Math.min(0.9, w - 0.34), cheek = (w - open) / 2, mouthH = 0.95;
  const c = '#cfc6b6', cd = '#2a2420';
  const H = HEARTH_FIT(w, d, flush), cut = asProp ? H.top : topY;
  const b = asProp ? asProp({ s: [H.sx, H.sy, H.sz], at: [0, 0, H.cz] }) : b0;
  if (asProp) Fu.ib(b0, 'stoneDark', it, -w / 2 + 0.03, cut, -d / 2, w / 2 - 0.03, topY, -d / 2 + H.upper, c); // the breast above the model
  // item space: x along the wall, z out of the wall (+z into the room), the breast from z -d/2 to d/2
  Fu.ib(b, 'stoneDark', it, -w / 2, 0, -d / 2, -w / 2 + cheek, mouthH, d / 2, c);
  Fu.ib(b, 'stoneDark', it, w / 2 - cheek, 0, -d / 2, w / 2, mouthH, d / 2, c);
  Fu.ib(b, 'stoneDark', it, -open / 2, 0, -d / 2, open / 2, mouthH, -d / 2 + 0.06, cd); // the sooty back
  Fu.ib(b, 'stoneLarge', it, -w / 2 - 0.05, mouthH, -d / 2, w / 2 + 0.05, mouthH + 0.24, d / 2 + 0.04, '#e0d8c8'); // lintel
  Fu.ib(b, 'stoneDark', it, -w / 2 + 0.03, mouthH + 0.24, -d / 2, w / 2 - 0.03, cut, d / 2 - 0.03, c);
  Fu.ib(b, 'wood', it, -w / 2 - 0.12, mouthH + 0.24, -d / 2, w / 2 + 0.12, mouthH + 0.3, d / 2 + 0.12, '#8a6a48'); // mantel
  Fu.crocks(b, it, -w / 2 + 0.05, mouthH + 0.3, d / 2 - 0.02, 2, r);
  Fu.ib(b, 'stoneLarge', it, -w / 2 - 0.15, 0, d / 2, w / 2 + 0.15, 0.03, d / 2 + 0.5, '#d8d0c0'); // hearthstone, 3 cm up
  Fu.ib(b, 'stoneDark', it, -open / 2 + 0.05, 0.0, -d / 2 + 0.06, open / 2 - 0.05, 0.08, d / 2 - 0.02, '#3a3028'); // the fire bed
  // logs (laid side by side), the bar and the pot
  for (let i = 0; i < 3; i++) b.add(new Fu.THREE.CylinderGeometry(0.05, 0.05, open * 0.7, 6), 'bark', { p: Fu.at(it, 0, 0.13, -d / 2 + 0.1 + i * 0.07), r: [0, it.ry, Math.PI / 2], order: 'YXZ', c: '#c8b090' });
  Fu.ib(b, 'iron', it, -open / 2, mouthH - 0.12, -0.02, open / 2, mouthH - 0.09, 0.02, '#2a2826');
  Fu.ib(b, 'iron', it, -0.008, mouthH - 0.4, -0.008, 0.008, mouthH - 0.12, 0.008, '#2a2826');
  b.add(new Fu.THREE.LatheGeometry([[0.001, 0], [0.12, 0.01], [0.15, 0.1], [0.13, 0.2], [0.001, 0.2]].map(([x, y]) => new Fu.THREE.Vector2(x, y)), 8), 'iron', { p: Fu.at(it, 0, mouthH - 0.62, 0), c: '#3a3634' });
  // (v108) the stone cap on the breast, 4 cm proud all round (the breast stops at HEARTH_TOP)
  Fu.ib(b0, 'stoneLarge', it, -w / 2 - 0.04, topY, -d / 2, w / 2 + 0.04, topY + 0.08, (asProp ? -d / 2 + H.upper : d / 2 - 0.03) + 0.04, '#e0d8c8');
  // (LF.3) a small framed landscape on the breast over the mantel: on the breast's face, inside the cut's kept rect
  // (houses/index.js cutKeep, 0.6 m in from the outer wall), so it stays when the house is open. Not over an oven or forge
  if (!flush && LF3) {
    // (over the ready-made hearth it hangs a little proud, its foot over the model's stone above the mantel)
    const y0 = asProp ? H.top - 0.14 : mouthH + 0.34, y1 = topY - 0.04;
    if (y1 - y0 > 0.18) { const pf = Fu.at(it, 0, 0, d / 2 - (asProp ? 0 : 0.03)), h = y1 - y0; Fu.landscape(b0, { x: pf[0], z: pf[2], ry: it.ry }, houseRng(S.seed, 12), Math.min(w - 0.3, h * 1.6), h, (y0 + y1) / 2); }
  }
  const fp0 = Fu.at(it, 0, 0.13, -d / 2 + 0.2); // (in the model's firebox too)
  out.fires.push({ p: fp0, scale: 0.42, light: true });
}
// the longhouse's hearth pit: a square stone curb round the embers, two posts and a bar with a hanging pot
function hearthPit(b, C, r, out) {
  const s = C.w / 2, x = C.lx, z = C.lz, c = '#c8bfae';
  bx(b, 'stoneDark', x - s, 0, z - s, x + s, 0.22, z - s + 0.2, c);
  bx(b, 'stoneDark', x - s, 0, z + s - 0.2, x + s, 0.22, z + s, c);
  bx(b, 'stoneDark', x - s, 0, z - s + 0.2, x - s + 0.2, 0.22, z + s - 0.2, c);
  bx(b, 'stoneDark', x + s - 0.2, 0, z - s + 0.2, x + s, 0.22, z + s - 0.2, c);
  bx(b, 'stoneDark', x - s + 0.2, 0, z - s + 0.2, x + s - 0.2, 0.06, z + s - 0.2, '#2a2420');
  for (let i = 0; i < 3; i++) b.add(new Fu.THREE.CylinderGeometry(0.05, 0.05, s * 1.1, 6), 'bark', { p: [x, 0.11, z - 0.12 + i * 0.12], r: [0, 0, Math.PI / 2], c: '#c8b090' });
  for (const sx of [-1, 1]) bx(b, 'beam', x + sx * (s - 0.1) - 0.05, 0.22, z - 0.05, x + sx * (s - 0.1) + 0.05, 1.55, z + 0.05, '#8a6a48');
  bx(b, 'beam', x - s + 0.05, 1.55, z - 0.04, x + s - 0.05, 1.63, z + 0.04, '#8a6a48');
  bx(b, 'iron', x - 0.008, 1.0, z - 0.008, x + 0.008, 1.55, z + 0.008, '#2a2826');
  b.add(new Fu.THREE.LatheGeometry([[0.001, 0], [0.14, 0.01], [0.17, 0.12], [0.15, 0.22], [0.001, 0.22]].map(([a, y]) => new Fu.THREE.Vector2(a, y)), 8), 'iron', { p: [x, 0.78, z], c: '#3a3634' });
  out.fires.push({ p: [x, 0.1, z], scale: 0.5, light: true });
}
