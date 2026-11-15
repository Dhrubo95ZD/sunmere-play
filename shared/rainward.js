// The Rainward Gorge (Part Fourteen): a deep wet gorge on the rainy side of the range, inland of Tidewater Sound, with its own
// terrain box. Shared by the server (heights, zones, the edge of the land, the rain) and the client (its terrain mesh, splat
// map, water and the rain's look). It imports only noise.js and tidewater.js (for the shared world clock), so areas.js and
// terrain.js can import it without a cycle.
//
// Layout (north is -z): the gorge runs east into the hills, its river coming down off them westward, over two falls, and
// out of the west end toward the Sound. The river keeps to the foot of the south wall (steep wooded rock, then cliff, never
// walked); all the walkable ground is the north side, rising from the river to the foot of the north cliff. West to east:
// the Gorge Foot (the haul road's head at the west end, the Seedwrights' camp on a level shelf, the falls pool under the
// lower falls, the lowest beds on two terraces and on a shelf across the river reached by a flat footbridge), the Seed
// Terraces (three blocks of terraces cut into the side in straight steps with square corners, each step a long level row
// of seed beds, the stone drain channels along the back of each step and down the stair lanes between the blocks, the drain
// adits in the cliff behind the top steps), and the Slip (the upper gorge above the upper falls, where the hill is sliding:
// raw mud scars, the marked mud lanes the slips run down in heavy rain, the Makers' planted timber in straight rows on the
// ridge, and the head of the gorge where the Makers' upper cutting goes into the east wall).
//
// v is the distance north of the river's line (z = river.z, wobbling a little outside the terraces): v < 0 is the river and
// the south wall, v > 0 the walkable side.
//
// The rain: one rain for the whole gorge, a pure function of the shared world clock (the same clock as Tidewater Sound's
// tide: the server's sim time, which every client reads from its snapshots), so every player sees the same downpour. It
// pours for about a third of every cycle; while it pours the slips run down the marked mud lanes. rainLevel(t) and
// rainState(t) take a time directly for tests and for anything that wants a time other than now.
import { fbm, ridged, vnoise, smoothstep, lerp, clamp } from './noise.js';
import { tideNow } from './tidewater.js';

export const RAINWARD = {
  minX: 380, maxX: 680, minZ: -3150, maxZ: -2850,
  water: 1.6, floor: 0, // the river's level where it leaves the box (tpspot's fallback) and the ground far below nothing
  // the rain: level 0..1 = pour(phase), phase = (t - t0) / period mod 1, so world time 0 is dry. It comes on at phase on
  // (ramping in over ramp) and stops at off; the slips run while the level is above slip
  rain: { period: 900, t0: 0, on: 0.5, off: 0.86, ramp: 0.035, slip: 0.75 },
  // the river's line (z, with a wobble outside the terraces) and its half width; the falls pool below the lower falls
  river: { z: -2948, wob: 2.5, hw: 3.4 },
  pool: { x0: 442, x1: 461, hw: 7.2, deep: 1.15 },
  // the river's level along x (its bed is a little below): two falls, the lower at x 461..465, the upper at 584..588
  bed: [[380, 1.6], [452, 4.6], [461, 5.2], [465, 17], [580, 25.6], [584, 26.2], [588, 35.6], [680, 44]],
  falls: [{ x: 463, x0: 461, x1: 465 }, { x: 586, x0: 584, x1: 588 }],
  // the north side's level along x before it climbs (the haul road ramps up beside each falls), how steeply it climbs north
  // (per metre of v past v 20), and where the north cliff's foot is (v)
  side: [[380, 3.2], [440, 6.0], [476, 18.6], [572, 26.8], [604, 37.4], [680, 45]],
  climb: [[380, 0.12], [470, 0.16], [580, 0.16], [600, 0.22], [680, 0.22]],
  north: [[380, 80], [470, 112], [580, 112], [600, 120], [680, 120]],
  east: 663, // the head wall of the gorge (x)
  // the region bands, west to east (on a wobbled x): the Gorge Foot | the Seed Terraces | the Slip
  bands: [474, 581],
  // the terraces: blocks of rows cut into the side, each row a level rectangle (x0..x1 along the gorge, v0 + i * d .. + d
  // north), stepping up row by row northward in straight steps with square corners. The first block is the Gorge Foot's
  // lowest beds; the other three are the Seed Terraces, with the stair lanes between them (lanes)
  terraces: [
    { x0: 404, x1: 432, v0: 64, d: 10, n: 2, lane: null },
    { x0: 482, x1: 511, v0: 28, d: 12, n: 6, lane: 480 },
    // (the middle block is set back half a step: its risers fall between its neighbours', so from above no wall lines up
    // with another across a stair lane into a cross)
    { x0: 515, x1: 542, v0: 34, d: 12, n: 5, lane: 513 },
    { x0: 546, x1: 573, v0: 28, d: 12, n: 6, lane: 544 },
  ],
  // the stair lanes between the blocks (x, half width, v0..v1): stone steps up the natural slope, the drain channel down the
  // middle of the first three
  lanes: [{ x: 480, hw: 2, v0: 14, v1: 106, drain: true }, { x: 513, hw: 2, v0: 14, v1: 106, drain: true }, { x: 544, hw: 2, v0: 14, v1: 106, drain: true }, { x: 575, hw: 2, v0: 14, v1: 104, drain: false }],
  // the shelf across the river in the Gorge Foot (x0..x1, v0..v1 south of the river: negative v), level, with the lowest beds
  shelf: { x0: 412, x1: 446, v0: -19, v1: -6.4, top: 5.0 },
  // the haul road's head at the west end: the stand where the rewound log haulier and its wagon come in (pad), where a
  // ride up sets you down (landing), the roadman who sends you back down to the Sound (keeper)
  road: { pad: { x: 404, z: -2963.5, s: 6 }, landing: { x: 407, z: -2966.5 }, keeper: { x: 402.5, z: -2969.6, ry: 2.6 } },
  // the Seedwrights' camp on a level shelf (square, half size s), its graveyard and caravan stop at its edges, the head grower
  camp: { x: 425, z: -2990, s: 15 },
  grave: { x: 406.5, z: -3005 },
  caravan: { x: 441, z: -2981 },
  qm: { x: 427.5, z: -2994.5, ry: 0.4 },
  // the drain adits in the north cliff behind the top steps of the Seed Terraces: a levelled stone pad in front of each
  // square mouth (the mouth itself stands in the cliff face north of the pad, facing south). adits[1] is held for the Drain
  // Adits dungeon's door (P14.4)
  // (each pad's square is eased into the ground round it over b metres: 2 here, so the top steps stay level)
  adits: [{ x: 497, z: -3054, s: 4, b: 2 }, { x: 528.5, z: -3054.5, s: 4.5, b: 2 }, { x: 559.5, z: -3054, s: 4, b: 2 }],
  // the head of the gorge: a levelled pad before the Makers' upper cutting in the east wall (the Upper Cutting raid's door,
  // P14.5, faces west out of the wall)
  cutting: { x: 650, z: -2990, s: 7 },
  // the marked mud lanes the slips run down in heavy rain (polylines [x, z] from the cliff foot down to the river, all
  // running the same way, side by side: never crossing), half width hw
  slips: [
    { pts: [[592.5, -3062], [590.5, -3010], [589, -2958]], hw: 3.2 },
    { pts: [[613, -3066], [611, -3012], [609.5, -2958]], hw: 3.4 },
    { pts: [[634, -3066], [632, -3012], [630.5, -2958]], hw: 3.4 },
  ],
  // the Makers' planted timber on the Slip's ridge (straight rows along x, staggered) and on the Gorge Foot's upper slope
  timber: [{ x0: 596, x1: 658, v0: 86, v1: 118, dx: 6, dv: 6.5 }, { x0: 396, x1: 470, v0: 87, v1: 100, dx: 5.5, dv: 6 }],
  // the haul road (polylines [x, z]): from the road head east along the north bank, past the camp, up beside the lower falls,
  // along the foot of the Seed Terraces, up beside the upper falls and across the Slip to the head of the gorge; spurs into
  // the camp, to the graveyard, to the footbridge, and up the stair lanes to the adits
  paths: [
    [[397, -2962.5], [416, -2965.5], [432, -2970], [446, -2974.5], [458, -2981], [470, -2978], [484, -2968], [494, -2966.5], [540, -2966], [574, -2966.5], [590, -2969.5], [606, -2977], [626, -2984], [646, -2990]],
    [[432, -2970], [428, -2980], [425, -2990]], // into the camp
    [[425, -2990], [418, -2992], [409, -2993], [406.5, -3005]], // the graveyard (between the huts, round the west one)
    [[421, -2967], [429, -2955]], // down to the footbridge
    [[497, -3054], [481, -3054], [480, -3052], [480, -2970]], // up each stair lane and along behind the top step to its adit
    [[528.5, -3054.5], [514, -3054.5], [513, -3052.5], [513, -2968]],
    [[559.5, -3054], [545, -3054], [544, -3052], [544, -2968]],
  ],
  // flat timber bridges on square piers: the footbridge over the river to the shelf, and the haul road over each lane's
  // drain channel (x0..x1, z0..z1, deck height filled in below: a little above the ground at each end)
  bridges: [],
  // white falls off the north cliff into the gorge (where they reach the cliff foot), and the low cloud along the walls
  sideFalls: [{ x: 404, v: 82 }, { x: 640, v: 121 }],
};
// the river's line: straight along the Seed Terraces (so the steps run square to it), wobbling a little outside them
const inTerr = (x) => smoothstep(458, 478, x) * (1 - smoothstep(582, 602, x));
export const riverZ = (x) => RAINWARD.river.z + RAINWARD.river.wob * Math.sin((x - 380) * 0.021) * (1 - inTerr(x));
export const vOf = (x, z) => riverZ(x) - z;
export const zOfV = (x, v) => riverZ(x) - v;
const table = (Tb, x) => {
  if (x <= Tb[0][0]) return Tb[0][1];
  for (let i = 0; i < Tb.length - 1; i++) if (x <= Tb[i + 1][0]) return lerp(Tb[i][1], Tb[i + 1][1], (x - Tb[i][0]) / (Tb[i + 1][0] - Tb[i][0]));
  return Tb[Tb.length - 1][1];
};
// the river's level at x, the north side's base level, its climb, the north cliff's foot
export const riverLevel = (x) => table(RAINWARD.bed, x);
export const sideLevel = (x) => table(RAINWARD.side, x);
const climbOf = (x) => table(RAINWARD.climb, x);
export const northFoot = (x) => table(RAINWARD.north, x);
const poolK = (x) => { const P = RAINWARD.pool; return smoothstep(P.x0 - 4, P.x0 + 2, x) * (1 - smoothstep(P.x1 - 1, P.x1 + 1.2, x)); };
// the river's half width at x (wider in the falls pool)
export const riverHW = (x) => RAINWARD.river.hw + (vnoise(x * 0.05, 3.1, 601) - 0.5) * 0.8 + (RAINWARD.pool.hw - RAINWARD.river.hw) * poolK(x);

export const inRainward = (x, z, pad = 0) => x >= RAINWARD.minX + pad && x <= RAINWARD.maxX - pad && z >= RAINWARD.minZ + pad && z <= RAINWARD.maxZ - pad;

// ---------------------------------------------------------------- the rain
// the clock the rain reads: the shared world clock (shared/tidewater.js: the sim sets its own time, the client the server's)
export const rainNow = () => tideNow();
// how hard it rains at world time t (0 dry .. 1 pouring)
export function rainLevel(t = rainNow()) {
  const R = RAINWARD.rain, p = ((((t - R.t0) / R.period) % 1) + 1) % 1;
  return smoothstep(R.on, R.on + R.ramp, p) * (1 - smoothstep(R.off - R.ramp, R.off, p));
}
// the rain at world time t: { level, phase, pouring (heavy rain), dry, slip (the slips are running), toPour / toDry (seconds
// to the next downpour's start and to the next dry spell's start) }
export function rainState(t = rainNow()) {
  const R = RAINWARD.rain, level = rainLevel(t), phase = ((((t - R.t0) / R.period) % 1) + 1) % 1;
  return {
    level, phase, pouring: level > 0.5, dry: level < 0.02, slip: level > R.slip,
    toPour: ((((R.on - phase) % 1) + 1) % 1) * R.period, toDry: ((((R.off - phase) % 1) + 1) % 1) * R.period,
  };
}

// ---------------------------------------------------------------- shapes
// nearest point on a polyline: { d, x, z, i, t } (segment i, fraction t)
function nearest(P, px, pz) {
  let best = { d: 1e9, x: 0, z: 0, i: 0, t: 0 };
  for (let i = 0; i < P.length - 1; i++) {
    const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
    const x = ax + dx * t, z = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { d, x, z, i, t };
  }
  return best;
}
// distance to the nearest track centre line (with a little meander)
export function rainwardPathDist(x, z) {
  let best = 1e9;
  for (const P of RAINWARD.paths) { const n = nearest(P, x, z); if (n.d < best) best = n.d; }
  return best + (vnoise(x * 0.06, z * 0.06, 631) - 0.5) * 1.6;
}
// the nearest slip lane: { d (to its centre line), i, k (1 on the lane, 0 off it), s (0 at its top .. 1 at its foot) }
export function slipLane(x, z) {
  let best = { d: 1e9, i: -1, k: 0, s: 0 };
  RAINWARD.slips.forEach((L, i) => {
    const n = nearest(L.pts, x, z);
    if (n.d < best.d) {
      let tot = 0, run = 0;
      for (let j = 0; j < L.pts.length - 1; j++) { const s = Math.hypot(L.pts[j + 1][0] - L.pts[j][0], L.pts[j + 1][1] - L.pts[j][1]); if (j < n.i) run += s; if (j === n.i) run += s * n.t; tot += s; }
      best = { d: n.d, i, k: 1 - smoothstep(L.hw - 0.6, L.hw + 0.6, n.d), s: run / tot };
    }
  });
  return best;
}
// how hard a slip is running at a point at world time t (0..1): on a lane, while it pours hard; the mud front runs down the
// lane from its top as the rain builds (the whole lane is running at the height of a downpour)
export function rainwardSlipAt(x, z, t = rainNow()) {
  const L = slipLane(x, z);
  if (L.k <= 0) return 0;
  const lvl = rainLevel(t), run = smoothstep(RAINWARD.rain.slip, 1, lvl);
  return run > 0 && L.s <= 0.15 + run ? L.k * run : 0;
}

// the terraces: the level of row r of block B (no noise: the side's level at the block's middle, climbed to the row's middle)
const rowLevel = (B, r) => { const cx = (B.x0 + B.x1) / 2, vm = B.v0 + (r + 0.5) * B.d; return sideLevel(cx) + climbOf(cx) * Math.max(0, vm - 20); };
for (const B of RAINWARD.terraces) { B.levels = []; for (let r = 0; r < B.n; r++) B.levels.push(rowLevel(B, r)); B.v1 = B.v0 + B.n * B.d; }
// the terrace a point stands on: { k (1 inside, eased to 0 over half a metre past its edges), level, B, r } or null. Inside a
// block the level steps up at each row's front edge over 0.8 m (the risers are faced with stone walls on the client)
export function terraceAt(x, z) {
  const v = vOf(x, z);
  for (const B of RAINWARD.terraces) {
    const ex = Math.max(B.x0 - x, x - B.x1), ev = Math.max(B.v0 - v, v - B.v1);
    if (ex > 0.5 || ev > 0.5) continue;
    const k = (1 - smoothstep(-0.5, 0.5, ex)) * (1 - smoothstep(-0.5, 0.5, ev));
    let level = B.levels[0];
    for (let r = 1; r < B.n; r++) level += (B.levels[r] - B.levels[r - 1]) * smoothstep(-0.4, 0.4, v - (B.v0 + r * B.d));
    const r = clamp(Math.floor((v - B.v0) / B.d), 0, B.n - 1);
    return { k, level, B, r };
  }
  return null;
}
// the level a row's drain channel runs at (its water 0.3 m above the row), or null off the terraces
export function terraceLevelAt(x, z) { const T = terraceAt(x, z); return T && T.k > 0.99 ? T.level : null; }

// the north side and the walls before the river, the terraces and the levelled places
function natural(x, z) {
  const S = RAINWARD, v = vOf(x, z), bd = riverLevel(x), rw = riverHW(x);
  const n1 = (fbm(x * 0.04, z * 0.04, 3, 611) - 0.5) * 1.6 + (vnoise(x * 0.13, z * 0.13, 612) - 0.5) * 0.3;
  let h;
  if (v >= 0) {
    // the north side: level at first, then climbing toward the north cliff, always above the river's bank; down to the bank
    // (the bank's own level follows the river only near it, so the falls' rock steps never run on across the side)
    const land = Math.max(sideLevel(x) + climbOf(x) * Math.max(0, v - 20), bd + 1.0 + 0.04 * Math.max(0, v - rw) - 40 * smoothstep(rw + 3, rw + 10, v)) + n1 * smoothstep(rw + 2, rw + 12, v);
    h = lerp(bd + 0.85, land, smoothstep(rw, rw + 14, v));
    // the north cliff and the head wall of the gorge: dark wet rock rising sheer above the timber
    const c = Math.max(v - northFoot(x), x - S.east);
    if (c > -3) h += Math.max(0, c) * 1.2 + smoothstep(-2, 24, c) * (42 + ridged(x * 0.03, z * 0.05, 3, 613) * 16) + (fbm(x * 0.09, z * 0.09, 2, 614) - 0.5) * 3 * smoothstep(0, 8, c);
  } else {
    // the south wall: a short steep wooded bank off the river, then cliff
    const u = -v;
    h = lerp(bd + 0.85, bd + 1.4 + (u - rw) * 0.6 + n1, smoothstep(rw, rw + 4, u));
    h += smoothstep(rw + 10, rw + 44, u) * (46 + ridged(x * 0.03, z * 0.05, 3, 615) * 14) + (fbm(x * 0.08, z * 0.08, 2, 616) - 0.5) * 3 * smoothstep(rw + 8, rw + 20, u);
  }
  return h;
}
// the levelled square places (centre, half size s, level filled in lazily from the natural ground): the road head's pad, the
// camp, the adit pads, the cutting's pad
const PADS = [RAINWARD.road.pad, RAINWARD.camp, ...RAINWARD.adits, RAINWARD.cutting];
const padTop = (P) => { if (P.flat == null) P.flat = natural(P.x, P.z) - 0.05; return P.flat; };
function inland(x, z) {
  const S = RAINWARD;
  let h = natural(x, z);
  const T = terraceAt(x, z);
  if (T) h = lerp(h, T.level, T.k);
  for (const P of PADS) {
    const d = Math.max(Math.abs(x - P.x), Math.abs(z - P.z));
    const bl = P.b ?? 4;
    if (d < P.s + bl) h = lerp(h, padTop(P) + (vnoise(x * 0.09, z * 0.09, 619) - 0.5) * 0.08, 1 - smoothstep(P.s, P.s + bl, d));
  }
  const pd = rainwardPathDist(x, z);
  if (pd < 4.5) h -= (1 - smoothstep(1.2, 4.5, pd)) * 0.12 * (T ? 1 - T.k : 1); // the tracks are a touch sunk (not on the steps)
  // the shelf across the river: level, eased into the south bank over 2 m
  const Sh = S.shelf, v = vOf(x, z), sd = Math.max(Sh.x0 - x, x - Sh.x1, Sh.v0 - v, v - Sh.v1);
  if (sd < 2) h = lerp(h, Sh.top + (vnoise(x * 0.1, z * 0.1, 620) - 0.5) * 0.06, 1 - smoothstep(-0.5, 2, sd));
  return h;
}
// ground height: the land with the river (and the falls pool) cut into it
export function rainwardHeight(x, z) {
  let h = inland(x, z);
  const v = vOf(x, z), rw = riverHW(x), a = Math.abs(v);
  if (a < rw + 1.6) {
    const bd = riverLevel(x), pk = poolK(x), depth = lerp(0.75, RAINWARD.pool.deep, pk);
    const q = clamp(a / rw, 0, 1), bedH = bd - 0.08 - depth * (1 - q * q) + (vnoise(x * 0.3, z * 0.3, 621) - 0.5) * 0.12;
    h = lerp(h, Math.min(h, bedH), 1 - smoothstep(rw - 0.2, rw + 1.6, a));
  }
  return h;
}

// the bridges' decks (absolute heights), filled in once: the footbridge over the river to the shelf, and the haul road over
// each lane's drain channel
{
  const S = RAINWARD, fx = 429, zN = zOfV(fx, 5.2), zS = zOfV(fx, -6.8);
  S.bridges.push({ id: 'foot', x0: fx - 1.6, x1: fx + 1.6, z0: zN, z1: zS, top: S.shelf.top + 0.05, piers: true });
  for (const L of S.lanes) if (L.drain) { const z = (-2966.3), top = inland(L.x - 1.8, z) + 0.36; S.bridges.push({ id: 'lane' + L.x, x0: L.x - 1.7, x1: L.x + 1.7, z0: z - 2.6, z1: z + 2.6, top, piers: false }); }
}
export function rainwardDeck(x, z) {
  for (const B of RAINWARD.bridges) if (x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1) return B.top;
  return -Infinity;
}

// open water: the river (and its falls pool) below its level; else null
export function rainwardWater(x, z) {
  const v = vOf(x, z), rw = riverHW(x);
  if (Math.abs(v) > rw + 1.6) return null;
  const L = riverLevel(x) - 0.08, h = rainwardHeight(x, z);
  return h < L - 0.04 ? L : null;
}
// the river is running fresh water: it takes a salvage hook (no fish live in it: Part Fourteen)
export const rainwardWaterKind = (x, z) => (rainwardWater(x, z) === null ? null : 'stream');
// how far a point is from the river's bank (negative in the river), for the water's sound
export const rainwardRiverDist = (x, z) => Math.abs(vOf(x, z)) - riverHW(x);

// the wobbled x the regions follow
const uOf = (x, z) => x + (vnoise(x * 0.006, z * 0.02, 641) - 0.5) * 8 + (vnoise(x * 0.03, z * 0.03, 642) - 0.5) * 2;
export function rainwardZone(x, z) {
  const u = uOf(x, z);
  return u < RAINWARD.bands[0] ? 'gorgefoot' : u < RAINWARD.bands[1] ? 'seedterraces' : 'slip';
}

// the seed beds on a terrace row: 1 on a bed's dark earth, 0 on the grass paths between them (the beds run along x, parallel,
// 1.4 m wide, 2.3 m apart; none on the row's front 1.4 m behind its wall or its back 1.8 m by the drain)
export function bedK(x, z) {
  const T = terraceAt(x, z);
  if (!T || T.k < 0.99) return 0;
  const B = T.B, v = vOf(x, z), f = v - (B.v0 + T.r * B.d);
  if (f < 1.4 || f > B.d - 1.8 || x < B.x0 + 1.4 || x > B.x1 - 1.4) return 0;
  const s = ((f - 1.4) % 2.3) / 2.3;
  return (1 - smoothstep(0.55, 0.64, s)) * smoothstep(0.0, 0.05, s);
}

// ground paint, the same shape as groundAt's. In the Rainward Gorge the channels mean: the base is deep wet green grass (the
// terrain's rainward theme), lush = moss (the cliff feet, under the timber, the wet north slopes), forest = needles under the
// planted timber, rock = dark wet rock (steep faces, the walls, the falls), sand = grey river gravel along the banks, path =
// the haul road, the camp's trodden ground and the seed beds' dark earth, cobble = the Makers' stone (the pads, the stair
// lanes' steps, the shelf's edging), mud = red-brown mud (the slip lanes, the scars in the Slip, the fresh slips over the east
// beds; carried in the splat's snow channel, which is 0 here). foundry and snow are 0.
export function rainwardGround(x, z) {
  const S = RAINWARD, h = rainwardHeight(x, z), v = vOf(x, z), rw = riverHW(x);
  const e = 1.0, gx = (rainwardHeight(x + e, z) - rainwardHeight(x - e, z)) / (2 * e), gz = (rainwardHeight(x, z + e) - rainwardHeight(x, z - e)) / (2 * e);
  const slope = Math.hypot(gx, gz);
  const pd = rainwardPathDist(x, z);
  let path = (1 - smoothstep(1.6, 3.4, pd)) * (pd < 3.4 ? 1 : 0);
  let mud = 0;
  let rock = Math.max(smoothstep(0.75, 1.15, slope), smoothstep(-2, 6, Math.max(v - northFoot(x), x - S.east)), smoothstep(rw + 6, rw + 16, -v) * 0.9);
  // the falls: wet rock across the river and its banks at each step
  for (const F of S.falls) rock = Math.max(rock, (1 - smoothstep(2.5, 6, Math.abs(x - F.x))) * (1 - smoothstep(6, 11, v)));
  // river gravel along the banks and the pool's edge
  const ra = Math.abs(v);
  let sand = (1 - smoothstep(rw + 0.8, rw + 2.6 + (vnoise(x * 0.1, z * 0.1, 652) - 0.5) * 1.6, ra)) * (1 - rock * 0.6);
  // moss: thick at the cliff feet and on the wet north slopes, patchy over the grass
  const cf = Math.max(v - northFoot(x), x - S.east);
  let lush = Math.max(smoothstep(-14, -3, cf) * (1 - smoothstep(4, 10, cf)), smoothstep(0.5, 0.75, vnoise(x * 0.045, z * 0.045, 653)) * 0.55, smoothstep(rw + 2, rw + 9, -v) * 0.7);
  // needles under the planted timber
  let forest = 0;
  for (const P of S.timber) { const k = smoothstep(P.x0 - 5, P.x0 + 1, x) * (1 - smoothstep(P.x1 - 1, P.x1 + 5, x)) * smoothstep(P.v0 - 5, P.v0 + 1, v) * (1 - smoothstep(P.v1 - 1, P.v1 + 5, v)); forest = Math.max(forest, k * 0.85); }
  // the terraces: the beds' dark earth in parallel rows, the grass paths between them kept short
  const T = terraceAt(x, z);
  let cobble = 0;
  if (T && T.k > 0.5) {
    path = Math.max(path, bedK(x, z) * 0.95);
    lush *= 0.3; rock *= 0.2;
  }
  // the stair lanes: stone steps the length of each lane, the drain channel down the middle
  for (const L of S.lanes) if (v > L.v0 - 1 && v < L.v1 + 1) cobble = Math.max(cobble, (1 - smoothstep(L.hw - 0.3, L.hw + 0.4, Math.abs(x - L.x))) * 0.85);
  // the pads: stone paving (patchy at the camp, which is mostly trodden ground)
  for (const P of [S.road.pad, ...S.adits, S.cutting]) cobble = Math.max(cobble, (1 - smoothstep(P.s - 0.6, P.s + 0.4, Math.max(Math.abs(x - P.x), Math.abs(z - P.z)))) * smoothstep(0.1, 0.35, vnoise(x * 0.3, z * 0.3, 654) + 0.3));
  { const C = S.camp, cd = Math.max(Math.abs(x - C.x), Math.abs(z - C.z)) + (vnoise(x * 0.12, z * 0.12, 655) - 0.5) * 3;
    path = Math.max(path, (1 - smoothstep(C.s * 0.55, C.s * 0.95, cd)) * 0.7 * smoothstep(0.25, 0.5, vnoise(x * 0.2, z * 0.2, 656) + 0.2));
    cobble = Math.max(cobble, (1 - smoothstep(3.5, 5, Math.max(Math.abs(x - C.x), Math.abs(z - C.z)))) * 0.8); }
  // the shelf's beds
  { const Sh = S.shelf; if (x > Sh.x0 + 2 && x < Sh.x1 - 2 && v > Sh.v0 + 1.5 && v < Sh.v1 - 1.2) { const s = (((Sh.v1 - 1.2 - v) % 2.3) + 2.3) % 2.3 / 2.3; path = Math.max(path, (1 - smoothstep(0.55, 0.64, s)) * 0.9); } }
  // the Slip: raw mud scars down the slope, the marked lanes red-brown mud from the cliff to the river, fresh slips over the
  // top rows of the east beds
  const slipX = smoothstep(584, 596, x);
  const L = slipLane(x, z);
  mud = Math.max(mud, L.k * 0.95 * smoothstep(-2, 2, v - 3));
  // (the scars run down the slope, long and narrow along z, and keep clear of the lanes: from above they never join two lanes
  // across into an H or a cross)
  mud = Math.max(mud, slipX * smoothstep(0.6, 0.74, vnoise(x * 0.11, z * 0.024, 657) * 0.8 + vnoise(x * 0.2, z * 0.1, 658) * 0.2) * smoothstep(L.i >= 0 ? S.slips[L.i].hw + 3 : 0, L.i >= 0 ? S.slips[L.i].hw + 6 : 1, L.d) * smoothstep(40, 60, v) * (1 - smoothstep(northFoot(x) - 2, northFoot(x) + 4, v)) * 0.9);
  mud = Math.max(mud, smoothstep(557, 563, x) * (1 - smoothstep(572, 576, x)) * smoothstep(74, 82, v) * smoothstep(0.42, 0.6, vnoise(x * 0.07, z * 0.1, 659)) * 0.85);
  // bare dark earth through the grass now and then, and trodden ground round the camp's huts
  path = Math.max(path, smoothstep(0.66, 0.86, vnoise(x * 0.05 + 3, z * 0.05, 660)) * 0.3 * (1 - rock));
  rock *= (1 - path * 0.6) * (1 - cobble);
  lush *= (1 - path) * (1 - cobble) * (1 - rock * 0.5) * (1 - mud);
  forest *= (1 - path) * (1 - cobble) * (1 - mud);
  sand *= (1 - cobble) * (1 - mud * 0.6);
  path *= 1 - mud * 0.7;
  return { sand: clamp(sand, 0, 1), path: clamp(path, 0, 1), rock: clamp(rock, 0, 1), lush: clamp(lush, 0, 1), forest: clamp(forest, 0, 1), cobble: clamp(cobble, 0, 1), foundry: 0, snow: 0, mud: clamp(mud, 0, 1) };
}

// how far past the edge of the walkable ground a point is (0 or less inside): the north side from the river's south edge (a
// wade across) to a metre short of the north cliff's foot and the head wall, the shelf across the river, the bridges to their
// rails, never onto the falls' rock steps, never up the south wall, never within 15 m of the edge of the box
export function rainwardGap(x, z) {
  const S = RAINWARD, v = vOf(x, z), rw = riverHW(x);
  let g = Math.max(-v - (rw - 0.4), v - (northFoot(x) - 1), x - (S.east - 2));
  const Sh = S.shelf;
  g = Math.min(g, Math.max(Sh.x0 + 0.5 - x, x - Sh.x1 + 0.5, Sh.v0 + 0.5 - v, v - (Sh.v1 + 3)));
  for (const B of S.bridges) g = Math.min(g, Math.max(B.x0 + 0.35 - x, x - B.x1 + 0.35, B.z0 - 0.6 - z, z - B.z1 - 0.6));
  for (const F of S.falls) g = Math.max(g, Math.min(5 - Math.abs(x - F.x), 11 - v));
  return Math.max(g, S.minX + 15 - x, S.minZ + 15 - z, x - (S.maxX - 15), z - (S.maxZ - 15));
}
