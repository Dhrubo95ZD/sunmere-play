// The Windward Heights (Part Twelve): a high wind-scoured plateau above the Rime Steps' glacier, with its own terrain box.
// Shared by the server (heights, zones, the edge of the land) and the client (its terrain mesh and splat map).
// It imports only noise.js, so areas.js and terrain.js can import it without a cycle.
//
// Layout (north is -z, the plateau climbs east): the counterweight lift comes up the west cliff from the Rime Steps' Dam Crown
// to a timber landing deck that juts out over the cloud; the camp sits a little way in on level snow (the Drift Fields, deep
// drifts piled across the wind). Eastward the ground climbs onto the Engine Rows: three long straight ridges of bare rock,
// running north and south, each with a row of levelled pads for the Makers' wind engines. Beyond them the plateau climbs
// again to the Makers' Rest, a sheltered hollow ringed by a rock rim (open to the west, where the road comes in) with the
// Makers' last workshop on a levelled pad in its floor. There is no sea: every edge is a cliff that drops into the cloud.
import { fbm, ridged, vnoise, smoothstep, lerp, clamp } from './noise.js';

export const HEIGHTS = {
  minX: 380, maxX: 680, minZ: -2250, maxZ: -1950,
  floor: 30, // the ground far below the cliffs, hidden under the cloud
  cloud: 50, // the cloud deck the client draws round the plateau (nothing walkable is below 58 m)
  // the plateau's outline: a rounded rectangle (centre, half sizes, corner radius) with a wobbling cliff lip (even at the lift)
  land: { cx: 538, cz: -2100, hx: 122, hz: 112, r: 40 },
  // the climb along the wobbled x (u): a gentle grade with two longer rises, onto the Engine Rows and up to the Makers' Rest
  tread: { base: 60, u0: 428, grade: 0.05, run: 230 },
  rises: [{ u0: 492, u1: 528, rise: 5 }, { u0: 582, u1: 626, rise: 7 }],
  // the region bands, west to east (on u): the Drift Fields | the Engine Rows | the Makers' Rest
  bands: [512, 594],
  // the lift landing: a timber deck out over the west cliff (top is the deck height; the lift cage hangs at its west end, x0),
  // where a ride up sets you down (landing) and the liftwright who sends you back down (keeper)
  lift: { x0: 402, x1: 426, z0: -2103.5, z1: -2096.5, top: 60.3, cage: { x: 404, z: -2100 }, landing: { x: 429, z: -2100 }, keeper: { x: 427, z: -2104.6, ry: -1.2 } },
  // the lift's foot on the Rime Steps (Rime coordinates): on the frozen lake's north-west corner, where the dam's north end meets
  // the valley wall, clear of both dungeon doors, the Spillway Engine's round and the lake's machine packs (the cage and its
  // counterweight frame stand at foot, against the wall; the glacier is 30 m east along the ice)
  rimeLift: { foot: { x: 609.5, z: -1717.5, ry: 0 }, landing: { x: 606.5, z: -1713 }, keeper: { x: 606.2, z: -1710.6, ry: -2.6 } }, // keeper on the lake ice beside the landing, clear of the plinth (not sunk in it)
  camp: { x: 456, z: -2100, r: 22, flat: 61.5 }, // the Windward Camp, on level snow in the Drift Fields
  grave: { x: 449, z: -2121 }, // where the fallen wake: the north edge of the camp
  caravan: { x: 466, z: -2085 }, // the caravan stop (no routes: only the lift goes down, but a Homeward Compass home)
  qm: { x: 461, z: -2095, ry: -2.4 }, // the Windwrights' quartermaster, in the camp
  // the Engine Rows: long straight ridges of bare rock along z at x, crest rise above the plateau, half width hw; low saddles
  // where the road crosses at z saddle
  ridges: [{ x: 534, z0: -2178, z1: -2022 }, { x: 556, z0: -2182, z1: -2018 }, { x: 578, z0: -2176, z1: -2024 }],
  ridge: { rise: 3.5, hw: 11, saddle: -2100 },
  // the wind-engine pads on the ridge crests (filled in below: four on each ridge, north and south of the road)
  padZ: [-2160, -2132, -2068, -2040], padR: 4.5,
  pads: [],
  // the Makers' Rest: a level hollow (its floor depth below the climb at its west mouth, so it sinks deeper eastward as the
  // plateau climbs round it) ringed by a rim, open to the west; the workshop pad in its floor
  hollow: { x: 626, z: -2100, r: 22, depth: 1, rim: 7, rimW: 12 },
  workshop: { x: 630, z: -2100, r: 10 },
  // the Pump Works' pump house (a dungeon door, shared/dungeons.js): a levelled stone pad in the trough between the first two
  // ridges, just north of the road where it crosses the saddle (flat inside r, blended out to r * 1.7)
  pumpHouse: { x: 545, z: -2106, r: 7 },
  // tracks (polylines [x, z]): the road east from the lift to the workshop, the camp's loops into the drifts, the walks along
  // the three ridge crests, and the graveyard to the camp
  paths: [
    [[424, -2100], [456, -2100], [490, -2097], [520, -2100], [545, -2100], [567, -2100], [600, -2100], [630, -2100]],
    [[456, -2100], [470, -2140], [488, -2172]], // north into the drifts
    [[456, -2100], [470, -2060], [488, -2028]], // south into the drifts
    [[534, -2166], [534, -2034]], // along the first row
    [[556, -2166], [556, -2034]], // along the second row
    [[578, -2166], [578, -2034]], // along the third row
    [[449, -2121], [455, -2111]], // the graveyard to the camp
  ],
};
for (const R of HEIGHTS.ridges) for (const z of HEIGHTS.padZ) HEIGHTS.pads.push({ x: R.x, z, r: HEIGHTS.padR });

export const inHeights = (x, z, pad = 0) => x >= HEIGHTS.minX + pad && x <= HEIGHTS.maxX - pad && z >= HEIGHTS.minZ + pad && z <= HEIGHTS.maxZ - pad;

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
export function heightsPathDist(x, z) {
  let best = 1e9;
  for (const P of HEIGHTS.paths) { const n = nearest(P, x, z); if (n.d < best) best = n.d; }
  return best + (vnoise(x * 0.06, z * 0.06, 431) - 0.5) * 2.0;
}

// the cliff lip: distance past the edge of the plateau (negative on it). The lip runs straight across at the lift landing
export function heightsEdge(x, z) {
  const L = HEIGHTS.land, F = HEIGHTS.lift;
  const qx = Math.abs(x - L.cx) - L.hx + L.r, qz = Math.abs(z - L.cz) - L.hz + L.r;
  const sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - L.r;
  let wob = (vnoise(x * 0.012 + 7, z * 0.012 + 7, 401) - 0.5) * 18 + (vnoise(x * 0.05, z * 0.05, 402) - 0.5) * 5;
  wob *= 1 - (1 - smoothstep(10, 30, Math.abs(z - (F.z0 + F.z1) / 2))) * (1 - smoothstep(440, 460, x)); // even at the lift
  return sd - wob;
}

// the wobbled x the climb and the regions follow
const uOf = (x, z) => x + (vnoise(x * 0.006, z * 0.02, 411) - 0.5) * 12 + (vnoise(x * 0.03, z * 0.03, 412) - 0.5) * 2;
export function heightsZone(x, z) {
  const u = uOf(x, z);
  return u < HEIGHTS.bands[0] ? 'driftfields' : u < HEIGHTS.bands[1] ? 'enginerows' : 'makersrest';
}
// the climb along u (no noise)
function prof(u) {
  const T = HEIGHTS.tread;
  let h = T.base + T.grade * clamp(u - T.u0, 0, T.run);
  for (const F of HEIGHTS.rises) h += F.rise * smoothstep(F.u0, F.u1, u);
  return h;
}
// how much of a ridge stands at a point (0..1 of the crest rise), lowered to a saddle where the road crosses
function ridgeK(x, z) {
  const G = HEIGHTS.ridge;
  let k = 0;
  for (const R of HEIGHTS.ridges) {
    const along = Math.min(z - R.z0, R.z1 - z);
    if (along < -12) continue;
    const across = 1 - smoothstep(G.hw * 0.25, G.hw, Math.abs(x - R.x));
    k = Math.max(k, across * smoothstep(-12, 10, along));
  }
  const sd = Math.abs(z - G.saddle);
  return k * (0.42 + 0.58 * smoothstep(5, 15, sd));
}
// the rim round the Makers' Rest: 0 in the hollow, 1 on the rim, open to the west where the road comes in
// distance from the hollow's centre, scaled by an uneven lobed outline so the basin is an irregular blob from above,
// never a clean crescent (content rules)
export function hollowDist(x, z) {
  const H = HEIGHTS.hollow, dx = x - H.x, dz = z - H.z, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
  return d / (1 + 0.1 * Math.sin(2 * a + 0.7) + 0.07 * Math.sin(3 * a + 2.1) + 0.04 * Math.sin(5 * a + 0.4));
}
// two worn gaps through the rim (north-north-east and south), so from above it is three broken ridges, not one C
export function hollowGapK(x, z) {
  const H = HEIGHTS.hollow, a = Math.atan2(z - H.z, x - H.x);
  let k = 0;
  for (const g of [-0.95, 1.65]) { const d = Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))); k = Math.max(k, 1 - smoothstep(0.1, 0.26, d)); }
  return k;
}
function rimK(x, z) {
  const H = HEIGHTS.hollow, dx = x - H.x, dz = z - H.z, d = hollowDist(x, z);
  const ring = smoothstep(H.r - 2, H.r + 4, d) * (1 - smoothstep(H.r + H.rimW - 2, H.r + H.rimW + 8, d));
  const d0 = Math.hypot(dx, dz), west = d0 > 0 ? -dx / d0 : 0; // 1 straight west of the centre
  return ring * (1 - smoothstep(0.55, 0.85, west)) * (1 - hollowGapK(x, z));
}
const hollowK = (x, z) => 1 - smoothstep(HEIGHTS.hollow.r - 6, HEIGHTS.hollow.r + 2, hollowDist(x, z));

// the plateau before the cliffs: the climb, the drifts, the ridges, the hollow and its rim, the levelled places
function inland(x, z) {
  const S = HEIGHTS, u = uOf(x, z);
  let h = prof(u) + (vnoise(x * 0.07, z * 0.07, 413) - 0.5) * 0.4;
  const pd = heightsPathDist(x, z);
  const calm = smoothstep(2.5, 9, pd); // the drifts and the rough ground ease off along the tracks
  // the Drift Fields: long drifts piled across the west wind (ridges running north and south), deepest out of the wind
  const drift = (1 - smoothstep(S.bands[0] - 14, S.bands[0] + 4, u)) * smoothstep(436, 452, x);
  if (drift > 0) {
    const r = ridged(x * 0.032 + (vnoise(x * 0.01, z * 0.01, 414) - 0.5) * 2, z * 0.011, 2, 415);
    h += drift * calm * ((r - 0.35) * 2.6 + (fbm(x * 0.05, z * 0.05, 2, 416) - 0.5) * 0.8);
  }
  // the Engine Rows: bare rock ridges
  h += ridgeK(x, z) * S.ridge.rise;
  h += (ridged(x * 0.08, z * 0.08, 2, 417) - 0.4) * 0.35 * calm * (u >= S.bands[0] ? 1 : 0);
  // the Makers' Rest: the hollow's floor lies level, the rim stands round it
  const H = S.hollow, hk = hollowK(x, z);
  if (hk > 0) h = lerp(h, workshopTop() + (vnoise(x * 0.08, z * 0.08, 420) - 0.5) * 0.3, hk);
  const rk = rimK(x, z);
  if (rk > 0) h += rk * (H.rim + ridged(x * 0.04, z * 0.04, 2, 418) * 3);
  // the tracks are a touch sunk
  if (pd < 5) h -= (1 - smoothstep(1.2, 5, pd)) * 0.12;
  // levelled ground: the lift landing, the camp, the engine pads, the workshop pad
  const F = S.lift, fd = Math.hypot(Math.max(0, x - F.x1), z - (F.z0 + F.z1) / 2);
  if (x < F.x1 + 14) h = lerp(h, F.top - 0.1, 1 - smoothstep(6, 14, fd));
  const C = S.camp, cd = Math.hypot(x - C.x, z - C.z);
  if (cd < C.r) h = lerp(h, C.flat + (vnoise(x * 0.06, z * 0.06, 419) - 0.5) * 0.3, 1 - smoothstep(C.r * 0.55, C.r, cd));
  for (const P of S.pads) {
    const d = Math.hypot(x - P.x, z - P.z);
    if (d < P.r * 1.8) h = lerp(h, padTop(P), 1 - smoothstep(P.r, P.r * 1.8, d));
  }
  const W = S.workshop, wd = Math.hypot(x - W.x, z - W.z);
  if (wd < W.r * 1.6) h = lerp(h, workshopTop(), 1 - smoothstep(W.r * 0.8, W.r * 1.6, wd));
  const PH = S.pumpHouse, phd = Math.hypot(x - PH.x, z - PH.z);
  if (phd < PH.r * 1.7) h = lerp(h, pumpTop(), 1 - smoothstep(PH.r, PH.r * 1.7, phd));
  return h;
}
// a pad's level: the crest of its ridge there (no noise), worked out once per pad
function padTop(P) {
  if (P.top == null) P.top = prof(uOf(P.x, P.z)) + ridgeK(P.x, P.z) * HEIGHTS.ridge.rise;
  return P.top;
}
// the pump house pad's level: the trough floor at its centre (no noise)
let phTop = null;
function pumpTop() {
  if (phTop == null) { const P = HEIGHTS.pumpHouse; phTop = prof(uOf(P.x, P.z)) + ridgeK(P.x, P.z) * HEIGHTS.ridge.rise - 0.05; }
  return phTop;
}
let wsTop = null;
function workshopTop() {
  if (wsTop == null) { const H = HEIGHTS.hollow; wsTop = prof(H.x - H.r) - H.depth; }
  return wsTop;
}

// ground height: the plateau, cut off at the cliff lip, falling sheer into the cloud
export function heightsHeight(x, z) {
  const S = HEIGHTS, s = heightsEdge(x, z);
  let h;
  if (s > 8) h = S.floor;
  else {
    const H = inland(x, z);
    h = lerp(H, S.floor + (vnoise(x * 0.05, z * 0.05, 421) - 0.5) * 6, smoothstep(-0.5, 8, s));
  }
  const edge = Math.min(x - S.minX, S.maxX - x, z - S.minZ, S.maxZ - z);
  if (edge < 12) h = lerp(S.floor, h, smoothstep(0, 12, edge));
  return h;
}

// the lift landing deck (absolute deck height), else -Infinity
export function heightsDeck(x, z) {
  const F = HEIGHTS.lift;
  return x > F.x0 && x < F.x1 && z > F.z0 && z < F.z1 ? F.top : -Infinity;
}

// no open water anywhere on the Heights (the cloud is not water)
export const heightsWater = () => null;
export const heightsWaterKind = () => null;

// ground paint, the same shape as groundAt's. On the Heights the channels mean: snow = wind-packed snow (the base everywhere),
// lush = wind-glazed ice (patches on the open drifts; also given as ice), rock = bare rock on the Engine Rows' ridges, the
// Makers' Rest rim, every steep face and the cliff lip, path = tracks and the camp's trodden snow, cobble = levelled stone
// (the lift landing, the camp square, the engine pads, the workshop pad). sand, forest and foundry are 0.
export function heightsGround(x, z) {
  const S = HEIGHTS, s = heightsEdge(x, z), u = uOf(x, z);
  const e = 1.0, gx = (heightsHeight(x + e, z) - heightsHeight(x - e, z)) / (2 * e), gz = (heightsHeight(x, z + e) - heightsHeight(x, z - e)) / (2 * e);
  const slope = Math.hypot(gx, gz);
  const pd = heightsPathDist(x, z);
  let path = 1 - smoothstep(1.8, 4.0, pd);
  const rk = ridgeK(x, z);
  let rock = Math.max(smoothstep(0.5, 0.9, slope), smoothstep(-6, -1, s), smoothstep(0.35, 0.7, rk) * smoothstep(0.25, 0.5, vnoise(x * 0.09, z * 0.09, 441) + 0.25), smoothstep(0.3, 0.6, rimK(x, z)) * 0.9);
  // the Engine Rows are scoured thin: rock shows through the snow between the ridges too
  if (u > S.bands[0] - 6) rock = Math.max(rock, smoothstep(0.55, 0.75, vnoise(x * 0.05, z * 0.05, 442)) * 0.6);
  // wind-glazed ice on the open drifts
  let ice = smoothstep(0.62, 0.8, vnoise(x * 0.04, z * 0.04, 443)) * 0.55 * (u < S.bands[0] ? 1 : 0.3);
  // levelled stone: the lift landing, the camp square, the pads, the workshop
  const C = S.camp, cd = Math.hypot(x - C.x, z - C.z) + (vnoise(x * 0.12, z * 0.12, 444) - 0.5) * 5;
  const camp = 1 - smoothstep(C.r * 0.45, C.r * 0.9, cd);
  path = Math.max(path, camp * 0.85);
  let cobble = (1 - smoothstep(7, 9.5, cd)) * smoothstep(0.15, 0.4, vnoise(x * 0.3, z * 0.3, 445) + 0.3);
  const F = S.lift;
  cobble = Math.max(cobble, (1 - smoothstep(3, 6, Math.hypot(Math.max(0, x - F.x1), z - (F.z0 + F.z1) / 2))) * (x > F.x1 - 8 ? 1 : 0));
  for (const P of S.pads) cobble = Math.max(cobble, 1 - smoothstep(P.r - 0.6, P.r + 0.4, Math.hypot(x - P.x, z - P.z)));
  const W = S.workshop;
  cobble = Math.max(cobble, 1 - smoothstep(W.r - 0.8, W.r + 0.4, Math.hypot(x - W.x, z - W.z)));
  cobble = Math.max(cobble, (1 - smoothstep(S.pumpHouse.r - 1.2, S.pumpHouse.r, Math.hypot(x - S.pumpHouse.x, z - S.pumpHouse.z))) * smoothstep(0.1, 0.35, vnoise(x * 0.3, z * 0.3, 446) + 0.2));
  ice *= (1 - path) * (1 - cobble) * (1 - rock);
  rock *= (1 - path * 0.6) * (1 - cobble);
  const snow = 1;
  return { sand: 0, path: clamp(path, 0, 1), rock: clamp(rock, 0, 1), lush: clamp(ice, 0, 1), forest: 0, cobble: clamp(cobble, 0, 1), foundry: 0, snow, ice: clamp(ice, 0, 1) };
}

// how far past the edge of the walkable plateau a point is (0 or less inside): never within 8 m of the cliff lip, except out
// along the lift landing deck to its rail, never up the Makers' Rest rim (only its foot), and never within 15 m of the edge
// of the box
export function heightsGap(x, z) {
  const S = HEIGHTS, F = S.lift;
  let g = heightsEdge(x, z) + 8;
  g = Math.min(g, Math.max(F.x0 + 1.2 - x, x - F.x1 - 2, F.z0 + 0.8 - z, z - (F.z1 - 0.8)));
  // the Makers' Rest: its steep inner walls and its rim are a ring nobody climbs, except at the west mouth
  const H = S.hollow, dx = x - H.x, dz = z - H.z, d0 = Math.hypot(dx, dz), d = hollowDist(x, z), west = d0 > 0 ? -dx / d0 : 0;
  const ring = Math.min(d - (H.r - 3), H.r + H.rimW + 4 - d) - smoothstep(0.72, 0.92, west) * 40 - hollowGapK(x, z) * 40;
  return Math.max(g, ring, S.minX + 15 - x, S.minZ + 15 - z, x - (S.maxX - 15), z - (S.maxZ - 15));
}
