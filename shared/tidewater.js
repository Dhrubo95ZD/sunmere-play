// Tidewater Sound (Part Thirteen): the Makers' yards on a deep inlet south-west of the Rime Steps, with its own terrain box.
// Shared by the server (heights, zones, the edge of the land, the tide) and the client (its terrain mesh, splat map and the
// tide's water). It imports only noise.js, so areas.js and terrain.js can import it without a cycle.
//
// Layout (north is -z): the Sound is a long straight inlet running in from the open sea in the east to its head in the west,
// with a broad peninsula of low land north of it (all the walkable ground) and a steep wooded ridge south of it that nobody
// climbs. West to east along the north shore: the Ropewalk Shore (the ship's timber quay at the head of the Sound, the
// Tidewrights' camp, the tar yards, and the Makers' ropewalk, a long open shed parallel to the shore), the Tide Mills (two
// creeks run down into the Sound, each with a square log pond held behind a sluice and a saw mill astride its tail race;
// below them the mud flats, dry at ebb and wade-deep at flood), and the Sea Gate (the barrage across the Sound's mouth,
// jammed half open, square gatehouses at both ends, and the Makers' planted rows of straight timber on the headland).
//
// The tide: one sea level for the whole area, rising and falling on a slow cycle that is a pure function of the shared world
// clock (the server's sim time, which every client reads from its snapshots), so every player sees the same water. waterAt
// asks the clock set with setTideClock (the sim sets its own time, the client the server's); tideLevel(t) and tideState(t)
// take a time directly for tests and for anything that wants a time other than now.
import { fbm, ridged, vnoise, smoothstep, lerp, clamp } from './noise.js';

export const TIDEWATER = {
  minX: 380, maxX: 680, minZ: -2700, maxZ: -2400,
  water: 0, floor: -6, // mean sea level (tpspot's fallback) and the sea floor beyond the shelf
  // the tide: level = mean - amp * cos(2 pi (t - t0) / period), so world time 0 is low water. dry: the mud flats are out of
  // the water below this level (ebb); wet: above this the flats are wade-deep (flood)
  tide: { period: 1200, amp: 1.15, mean: 0, t0: 0, dry: 0.12, wet: 0.75 },
  // the land's outline: a rounded rectangle (centre, half sizes, corner radius) with a wobbling coast; the Sound cuts it
  land: { cx: 530, cz: -2550, hx: 138, hz: 140, r: 40 },
  // the Sound: its centre line z = z + amp * sin((x - x0) * k), its half width by x (0 at the head, widening to the mouth),
  // and the depth of its dredged channel
  sound: { z: -2548, amp: 2.5, k: 0.018, x0: 430, head: 430, bed: -4.5 },
  soundHW: [[430, 0], [446, 13], [470, 20], [520, 24], [600, 28], [660, 32], [720, 38]],
  // the foreshore on the north side of the Sound: its width by x (0 along the quay, broad mud flats in the Tide Mills) and its
  // height at the bank (top) and at its outer edge (low) before it drops into the channel
  fore: [[400, 3], [448, 3], [452, 0], [496, 0], [500, 3], [506, 24], [584, 24], [596, 4], [720, 4]],
  foreTop: 0.45, foreLow: 0.18,
  // the region bands, west to east (on a wobbled x): the Ropewalk Shore | the Tide Mills | the Sea Gate
  bands: [500, 590],
  // the ship's timber quay at the head of the Sound: a deck on piles from the bank out over the water (top is the deck
  // height, above the highest tide); the ship lies along its south face (berth). landing: where a crossing sets you down,
  // harbour: the harbour man on the quay's root
  quay: { x0: 452, x1: 494, z0: -2572.5, z1: -2563.5, top: 2.75 },
  berth: { x: 473, z: -2558.6, ry: Math.PI / 2 },
  landing: { x: 474.5, z: -2576 },
  harbour: { x: 469, z: -2575.2, ry: Math.PI },
  // the Tidewrights' camp on a level shelf above the quay; its graveyard and caravan stop at its edges, its yard master
  camp: { x: 470, z: -2593, r: 17, flat: 3.1 },
  grave: { x: 452.5, z: -2606.5 },
  caravan: { x: 489, z: -2600 },
  qm: { x: 466.5, z: -2595, ry: 0.6 },
  // the tar yards on the shore west of the quay (blackened ground, open tar pans over square hearths)
  taryard: { x: 432, z: -2588, r: 11, flat: 2.9 },
  // the Makers' ropewalk: a long open shed straight along the shore, its floor levelled (x0..x1 along it, hw its half width)
  ropewalk: { x0: 406, x1: 496, z: -2626, hw: 3.6, top: 3.4 },
  // the tidal creeks (polylines [x, z, bed]): from the foot of each log pond's sluice, under the mill's wheel, down across the
  // flats to the channel. The bed falls along each, so the flood runs up them to the wheels and the ebb drains them
  creeks: [
    // (each bends east as it nears the flats and runs out across them on a slant, so from straight above the creek and the
    // edge of the flats never meet square in a '+'; tidewaterCreek flares its banks into a funnel at the mouth)
    [[520, -2608.5, 0.25], [520, -2597, 0.05], [521.5, -2587, -0.12], [524.5, -2578.5, -0.28], [529.5, -2571, -0.4], [536, -2564.5, -0.5], [541, -2557, -0.58], [543.5, -2549, -0.65]],
    [[566, -2611.5, 0.25], [566, -2600, 0.05], [567.5, -2590, -0.12], [570.5, -2581.5, -0.28], [575.5, -2574, -0.4], [582, -2567.5, -0.5], [586, -2560, -0.58], [587.5, -2551, -0.65]],
  ],
  // the log ponds: square basins held at a level above the highest tide by the sluice at their south end (bed, level)
  ponds: [{ x: 520, z: -2621, hx: 12.5, hz: 8, bed: 0.5, level: 2.35 }, { x: 566, z: -2624, hx: 12, hz: 8.5, bed: 0.5, level: 2.35 }],
  // the saw mills: each on a levelled pad beside its creek (the house east of the creek, the solid undershot wheel in the
  // creek at wx), its door east
  mills: [{ x: 528.5, z: -2599, wx: 520, r: 8, flat: 3.0 }, { x: 574.5, z: -2602, wx: 566, r: 8, flat: 3.0 }],
  // a levelled stone pad held for the wheel-pit hatch of the Mill Races (P13.4: a dungeon door in the Tide Mills)
  races: { x: 545, z: -2606, r: 5.5, flat: 3.0 },
  // the Sea Gate: a barrage straight across the mouth at x; its crest deck (top) can be walked from the north gatehouse's pad
  // out to the jammed bay (gap, z0..z1), where one gate hangs stuck half raised. Square gatehouses at both ends.
  gate: { x: 628, hw: 1.7, top: 5.2, gap: [-2556, -2544], pier: 3.2, bays: 7 },
  gatePad: { x: 626, z: -2591, r: 12, flat: 5.2 },
  gatehouse: { x: 620, z: -2590, w: 10, d: 9, h: 8.5 }, // the north gatehouse (the Sea Gate raid's door, P13.5, goes in its north face)
  // the Makers' planted rows on the headland (straight north-south rows, staggered), and the square tide-mark tower
  rows: { x0: 594, x1: 662, z0: -2678, z1: -2598, dx: 6.5, dz: 5 },
  tower: { x: 652, z: -2600, s: 3.6, h: 13 },
  // tracks (polylines [x, z]): the road from the quay through the camp and east along the shore past the mills to the Sea
  // Gate; spurs to the tar yards and the west beach, the ropewalk, each mill, the races pad, the tide-mark tower and the flats
  paths: [
    [[476, -2574], [472, -2588], [486, -2604], [500, -2615], [503, -2634], [516, -2641], [542, -2644], [580, -2643], [604, -2630], [616, -2606], [626, -2596], [628, -2582]],
    [[462, -2589], [446, -2587], [432, -2589], [412, -2600], [402, -2606]], // west to the tar yards and the beach
    [[446, -2587.5], [445, -2603], [446, -2621]], // off the west road up to the ropewalk (not out of the square: no tracks fanning out of one point)
    [[406, -2626], [496, -2626]], // the ropewalk's own floor
    [[536, -2642], [538, -2620], [532.5, -2600]], // to the first mill's door
    [[538, -2620], [545, -2610]], // and on to the races pad
    [[582, -2641.9], [583, -2614], [578.5, -2603]], // to the second mill's door ((RF.7) starts on the road: it began 1 m past it, a stub tail)
    [[604, -2630], [640, -2614], [649, -2603]], // out to the tide-mark tower
    [[500, -2615], [506, -2596], [508, -2578]], // down the slipway onto the flats
    [[452.5, -2606.5], [445.5, -2605]], // the graveyard, off the ropewalk track
  ],
};

export const inTidewater = (x, z, pad = 0) => x >= TIDEWATER.minX + pad && x <= TIDEWATER.maxX - pad && z >= TIDEWATER.minZ + pad && z <= TIDEWATER.maxZ - pad;

// ---------------------------------------------------------------- the tide
let clock = () => 0;
// the clock waterAt reads: the sim passes its own time, the client the server's (game.serverTime)
export function setTideClock(fn) { clock = typeof fn === 'function' ? fn : () => +fn || 0; }
export const tideNow = () => { const t = +clock(); return isFinite(t) ? t : 0; };
// the sea level at world time t (seconds)
export function tideLevel(t = tideNow()) {
  const T = TIDEWATER.tide;
  return T.mean - T.amp * Math.cos((2 * Math.PI * (t - T.t0)) / T.period);
}
// the tide at world time t: { level, phase (0 low water, 0.5 high water), k (0 at low water .. 1 at high), rising, ebb (the
// flats are dry), flood (the flats are wade-deep), toLow / toHigh (seconds to the next low and high water) }
export function tideState(t = tideNow()) {
  const T = TIDEWATER.tide, level = tideLevel(t);
  const phase = ((((t - T.t0) / T.period) % 1) + 1) % 1;
  return {
    level, phase, k: (level - (T.mean - T.amp)) / (2 * T.amp), rising: phase < 0.5,
    ebb: level < T.dry, flood: level > T.wet,
    toLow: (1 - phase) * T.period, toHigh: (((0.5 - phase) % 1 + 1) % 1) * T.period,
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
const table = (Tb, x) => {
  if (x <= Tb[0][0]) return Tb[0][1];
  for (let i = 0; i < Tb.length - 1; i++) if (x <= Tb[i + 1][0]) return lerp(Tb[i][1], Tb[i + 1][1], (x - Tb[i][0]) / (Tb[i + 1][0] - Tb[i][0]));
  return Tb[Tb.length - 1][1];
};
// distance to the nearest track centre line (with a little meander)
export function tidewaterPathDist(x, z) {
  let best = 1e9;
  for (const P of TIDEWATER.paths) { const n = nearest(P, x, z); if (n.d < best) best = n.d; }
  return best + (vnoise(x * 0.06, z * 0.06, 531) - 0.5) * 2.0;
}
// each creek's mouth: how far along its line (from the sluice) it crosses the top of the flats (found once, lazily)
let MOUTHS = null;
function creekMouths() {
  if (MOUTHS) return MOUTHS;
  MOUTHS = TIDEWATER.creeks.map((C) => {
    const cum = [0];
    for (let i = 1; i < C.length; i++) cum.push(cum[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]));
    let sm = null;
    for (let i = 0; i < C.length - 1 && sm === null; i++) {
      const L = cum[i + 1] - cum[i];
      for (let s = 0; s <= L; s += 0.25) { const t = s / L, x = lerp(C[i][0], C[i + 1][0], t), z = lerp(C[i][1], C[i + 1][1], t); if (z > soundNorthZ(x)) { sm = cum[i] + s; break; } }
    }
    return { cum, sm: sm ?? cum[cum.length - 1] };
  });
  return MOUTHS;
}
// the nearest creek: { d (to its centre line, divided by its width there), bed (its bed there), cx, cz, i (which creek), w
// (its width there: 1 up by the mills), s (metres along it past its mouth, negative upstream) }. Toward the mouth the banks
// flare into a funnel (w up to 2.8 at the mouth) and out across the flats the channel stays a little wide, so from above
// the creek opens into the flats like a trumpet instead of crossing their edge square
export function tidewaterCreek(x, z) {
  let best = null;
  const M = creekMouths();
  TIDEWATER.creeks.forEach((C, i) => {
    const n = nearest(C, x, z), cum = M[i].cum, s = cum[n.i] + (cum[n.i + 1] - cum[n.i]) * n.t - M[i].sm;
    const w = 1 + 1.8 * (s < 0 ? 1 - smoothstep(0, 14, -s) : 1 - 0.8 * smoothstep(0, 9, s)), d = n.d / w;
    if (!best || d < best.d) best = { d, bed: lerp(C[n.i][2], C[n.i + 1][2], n.t), cx: n.x, cz: n.z, i, w, s };
  });
  best.d += (vnoise(x * 0.09, z * 0.09, 532) - 0.5) * 0.8;
  return best;
}

// the Sound: its centre line and half width at x, the width of the north foreshore, and how far into the Sound a point is
// from its north bank (dn) and from its south bank (ds) (positive in the water, negative on the land)
export const soundAxisZ = (x) => TIDEWATER.sound.z + TIDEWATER.sound.amp * Math.sin((x - TIDEWATER.sound.x0) * TIDEWATER.sound.k);
export const soundHalfW = (x) => Math.max(0, table(TIDEWATER.soundHW, x));
export const foreW = (x) => table(TIDEWATER.fore, x);
export const soundNorthZ = (x) => soundAxisZ(x) - soundHalfW(x);
export const soundSouthZ = (x) => soundAxisZ(x) + soundHalfW(x);
function soundD(x, z) {
  const a = soundAxisZ(x), hw = soundHalfW(x), wob = (vnoise(x * 0.05, z * 0.05, 501) - 0.5) * 1.6;
  return { dn: z - (a - hw) + wob, ds: (a + hw) - z + wob, hw };
}
// the foot of the south ridge (it rises south of here; at the head of the Sound it stands back from the axis)
const ridgeFoot = (x) => soundAxisZ(x) + Math.max(soundHalfW(x), 9);

// the coastline: distance past the shore (negative on land)
export function tidewaterShore(x, z) {
  const L = TIDEWATER.land;
  const qx = Math.abs(x - L.cx) - L.hx + L.r, qz = Math.abs(z - L.cz) - L.hz + L.r;
  const sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - L.r;
  const wob = (vnoise(x * 0.013 + 5, z * 0.013 + 5, 502) - 0.5) * 16 + (vnoise(x * 0.05, z * 0.05, 503) - 0.5) * 5;
  return sd - wob;
}

// the wobbled x the regions follow
const uOf = (x, z) => x + (vnoise(x * 0.006, z * 0.02, 511) - 0.5) * 10 + (vnoise(x * 0.03, z * 0.03, 512) - 0.5) * 2;
export function tidewaterZone(x, z) {
  const u = uOf(x, z);
  return u < TIDEWATER.bands[0] ? 'ropewalkshore' : u < TIDEWATER.bands[1] ? 'tidemills' : 'seagate';
}

// the north land's level along x (no noise): the low Ropewalk Shore terrace, the Tide Mills a little higher, and the headland
// rising east to the Sea Gate, falling away again at its tip
function prof(x) {
  return 3.0 + 1.2 * smoothstep(500, 585, x) + 4.6 * smoothstep(595, 640, x) - 3.2 * smoothstep(650, 672, x);
}
// the land before the Sound, the creeks, the ponds and the coast: the north land, rising gently inland, with the south ridge
function ground0(x, z) {
  let h = prof(x) + Math.min(60, Math.max(0, soundNorthZ(x) - z)) * 0.025;
  h += (fbm(x * 0.03, z * 0.03, 3, 513) - 0.5) * 2.0 + (vnoise(x * 0.11, z * 0.11, 514) - 0.5) * 0.3;
  // the south ridge: a steep wooded rise straight off the Sound's south bank (and off the head of the Sound)
  const rd = z - ridgeFoot(x) + (vnoise(x * 0.04, z * 0.04, 515) - 0.5) * 6;
  const r = smoothstep(-3, 30, rd);
  if (r > 0) h += r * (20 + ridged(x * 0.02, z * 0.03, 3, 516) * 12 + (fbm(x * 0.05, z * 0.05, 2, 517) - 0.5) * 5);
  return h;
}
// the levelled places (centre, radius, level): the camp, the tar yards, the mills, the races pad, the Sea Gate's pad
const PADS = [TIDEWATER.camp, TIDEWATER.taryard, ...TIDEWATER.mills, TIDEWATER.races, TIDEWATER.gatePad];

// the land with the levelled places and the ropewalk floor, before the water cuts in
function inland(x, z) {
  const W = TIDEWATER;
  let h = ground0(x, z);
  const pd = tidewaterPathDist(x, z);
  if (pd < 5) h -= (1 - smoothstep(1.2, 5, pd)) * 0.12; // the tracks are a touch sunk
  for (const P of PADS) {
    const d = Math.hypot(x - P.x, z - P.z);
    if (d < P.r * 1.7) h = lerp(h, P.flat + (vnoise(x * 0.07, z * 0.07, 519) - 0.5) * 0.15, 1 - smoothstep(P.r * 0.75, P.r * 1.7, d));
  }
  // the ropewalk: a long level strip, the ground eased to it over 4 m either side and past its ends
  const R = W.ropewalk, ra = Math.max(R.x0 - x, x - R.x1, 0), rb = Math.max(0, Math.abs(z - R.z) - R.hw);
  const rk = 1 - smoothstep(0, 5, Math.hypot(ra, rb));
  if (rk > 0) h = lerp(h, R.top, rk);
  // the quay's root: the bank behind the quay levelled to its deck
  const Q = W.quay, qa = Math.max(Q.x0 - x, x - Q.x1, 0), qb = Math.max(0, Q.z0 - z);
  if (z < Q.z1 + 2) { const qk = 1 - smoothstep(1, 7, Math.hypot(qa, qb)); if (qk > 0) h = lerp(h, Q.top - 0.15, qk); }
  return h;
}

// the Sound's bed at (dn, ds): the north foreshore (the mud flats in the Tide Mills) and the dredged channel, the steep south bank
function soundBed(x, dn, ds) {
  const W = TIDEWATER, fw = foreW(x), bed = W.sound.bed;
  const n = Math.max(0, dn), s = Math.max(0, ds);
  let bn;
  if (fw > 0.5 && n < fw) bn = lerp(W.foreTop, W.foreLow, n / fw) + (vnoise(x * 0.09, dn * 0.2, 521) - 0.5) * 0.14 * smoothstep(1, 4, n);
  else bn = lerp(fw > 0.5 ? W.foreLow : W.foreTop, bed, smoothstep(fw, fw + (fw > 0.5 ? 9 : 2.5), n));
  const bs = lerp(0.4, bed, smoothstep(0, 7, s));
  return Math.max(bn, bs);
}

// the land with the Sound and the coast cut in
function land(x, z) {
  const W = TIDEWATER;
  let h = inland(x, z);
  const S = soundD(x, z);
  if (S.hw > 0) {
    const w = smoothstep(-6, 0, S.dn) * smoothstep(-6, 0, S.ds) * smoothstep(0, 6, S.hw);
    if (w > 0) h = lerp(h, soundBed(x, S.dn, S.ds), w);
  }
  // the coast: low ground runs down to a shingle beach, the ridge and the headland end in cliffs
  const s = tidewaterShore(x, z);
  if (s >= 0) h = Math.min(h, W.floor * smoothstep(0, 26, s) + 0.4 * (1 - smoothstep(0, 4, s)));
  else {
    const beach = 0.8 + 1.0 * smoothstep(0, -12, s);
    const st = -2 - 8 * (1 - smoothstep(4.5, 9, h));
    h = Math.min(h, lerp(beach, Math.max(h, beach), smoothstep(st, st - (10 + Math.max(0, h - 4) * 0.25), s)));
  }
  const edge = Math.min(x - W.minX, W.maxX - x, z - W.minZ, W.maxZ - z);
  if (edge < 12) h = lerp(W.floor, h, smoothstep(0, 12, edge));
  return h;
}

// the log ponds: how far inside a pond's square a point is (negative inside), and which pond
function pondAt(x, z) {
  for (const P of TIDEWATER.ponds) { const d = Math.max(Math.abs(x - P.x) - P.hx, Math.abs(z - P.z) - P.hz); if (d < 2.5) return { P, d }; }
  return null;
}

// ground height: the land with the creeks and the log ponds cut into it
export function tidewaterHeight(x, z) {
  let h = land(x, z);
  const C = tidewaterCreek(x, z);
  if (C.d < 4.5) h = Math.min(h, lerp(C.bed - 0.15, h, smoothstep(1.3, 4.5, C.d)));
  const Pd = pondAt(x, z);
  if (Pd) h = Math.min(h, lerp(Pd.P.bed + (vnoise(x * 0.2, z * 0.2, 522) - 0.5) * 0.1, h, smoothstep(-1.2, 0.6, Pd.d)));
  return h;
}

// the quay and the Sea Gate's crest (absolute deck heights), else -Infinity
function inRect(x, z, x0, x1, z0, z1) { return x > x0 && x < x1 && z > z0 && z < z1; }
const crest = () => { const G = TIDEWATER.gate; return { x0: G.x - G.hw, x1: G.x + G.hw, z0: TIDEWATER.gatePad.z + 4, z1: G.gap[0] }; };
export function tidewaterDeck(x, z) {
  const Q = TIDEWATER.quay;
  if (inRect(x, z, Q.x0, Q.x1, Q.z0, Q.z1)) return Q.top;
  const C = crest();
  if (inRect(x, z, C.x0, C.x1, C.z0, C.z1)) return TIDEWATER.gate.top;
  return -Infinity;
}

// open water at world time t: the log ponds (held at their own level) and the tide over everything below it; else null
export function tidewaterWaterAt(x, z, t = tideNow()) {
  const h = tidewaterHeight(x, z);
  const Pd = pondAt(x, z);
  if (Pd && Pd.d < 0 && h < Pd.P.level - 0.05) return Pd.P.level;
  const L = tideLevel(t);
  return h < L - 0.04 ? L : null;
}
export const tidewaterWater = (x, z) => tidewaterWaterAt(x, z);
// what kind of water: the log ponds ('stream', still water) and the Sound ('tide') both take a salvage hook
export function tidewaterWaterKind(x, z) {
  const w = tidewaterWater(x, z);
  if (w === null) return null;
  const Pd = pondAt(x, z);
  // (the Sound is 'tide', not the open sea: no fish or shellfish live in it (Part Thirteen), so it takes a salvage hook too)
  return Pd && Pd.d < 0 && Math.abs(w - Pd.P.level) < 1e-9 ? 'stream' : 'tide';
}
// roughly how far a point on land is from open water at high tide (for the surf's sound); 0 or less in the water
export function tidewaterShoreDist(x, z) {
  const S = soundD(x, z), s = tidewaterShore(x, z);
  return Math.min(-s, S.hw > 1 ? -Math.min(S.dn, S.ds) : 1e9);
}

// the planted rows: is a point on a row's ground, and how much salt has reached it (0..1, near the Sound and the coast)
export function rowsK(x, z) {
  const R = TIDEWATER.rows;
  const k = smoothstep(R.x0 - 6, R.x0 + 2, x) * (1 - smoothstep(R.x1 - 2, R.x1 + 6, x)) * smoothstep(R.z0 - 6, R.z0 + 2, z) * (1 - smoothstep(R.z1 - 2, R.z1 + 6, z));
  return k;
}
export function saltK(x, z) {
  return Math.max(1 - smoothstep(8, 20, tidewaterShoreDist(x, z)), 0);
}

// ground paint, the same shape as groundAt's. In Tidewater Sound the channels mean: the base is salt-burnt grass (the
// terrain's tidewater theme), sand = grey shingle (the outer beaches and the Sound's banks), mud = wet mud (the flats, the
// creek beds, the ponds' edges, the silted channel; carried in the splat's snow channel, which is 0 here), lush = the dark
// green ground of the planted rows, forest = needles under the rows, rock = steep faces, the ridge's crags and the sea
// cliffs, path = tracks and trodden ground, cobble = the Makers' paving (the quay's apron, the camp square, the mill pads,
// the races pad, the Sea Gate's pad), foundry = the tar-blackened ground of the tar yards. snow is 0.
// (second dressing pass) the narrow shingle paths of the camp: each house door to the square, the doors joined round the
// west side and past the caravan on the east, on north to the ropewalk, and the tar house's door to the west road
export const SHINGLE = [
  [[459, -2584], [463.8, -2587.9]], [[460, -2598], [462.8, -2596.6]], [[478.6, -2604.9], [474.7, -2599.5]], [[483, -2589.3], [477.7, -2590.8]],
  [[459, -2584], [455, -2589.5], [455.5, -2594.5], [460, -2598]],
  [[460, -2598], [459.5, -2606], [462, -2614], [465, -2621.5]],
  [[478.6, -2604.9], [485, -2602.5], [488, -2596], [483, -2589.3]],
  [[437.5, -2602], [438, -2597], [441, -2592], [446, -2588.5]],
];
export function tidewaterGround(x, z) {
  const W = TIDEWATER, s = tidewaterShore(x, z), h = tidewaterHeight(x, z);
  const e = 1.0, gx = (tidewaterHeight(x + e, z) - tidewaterHeight(x - e, z)) / (2 * e), gz = (tidewaterHeight(x, z + e) - tidewaterHeight(x, z - e)) / (2 * e);
  const slope = Math.hypot(gx, gz);
  const pd = tidewaterPathDist(x, z), S = soundD(x, z);
  let path = 1 - smoothstep(1.8, 4.0, pd);
  // wet ground: everything the tide covers at its highest, and a little above
  const wetBand = 1 - smoothstep(1.25, 1.9, h + (vnoise(x * 0.1, z * 0.1, 541) - 0.5) * 0.4);
  const inSound = S.hw > 1 ? smoothstep(-6, 1, S.dn) * smoothstep(-6, 1, S.ds) : 0;
  const flatsX = smoothstep(494, 506, x) * (1 - smoothstep(586, 598, x));
  const C = tidewaterCreek(x, z), creek = 1 - smoothstep(2.5, 5, C.d);
  const Pd = pondAt(x, z), pond = Pd ? 1 - smoothstep(-1.5, 1.5, Pd.d) : 0;
  // mud: the flats and the creeks (with streaks of shingle through them), the pond beds, and the silted channel everywhere
  let mud = Math.max(inSound * Math.max(flatsX, smoothstep(0.5, -1.0, h)), creek, pond) * wetBand;
  mud *= 1 - 0.45 * smoothstep(0.62, 0.8, vnoise(x * 0.07, z * 0.14, 542)) * (1 - pond);
  // shingle: the outer beaches and under the sea, and the Sound's banks where they are not mud
  let sand = Math.max(1 - smoothstep(8, 16, -s + (vnoise(x * 0.08, z * 0.08, 543) - 0.5) * 6), inSound * wetBand * (1 - mud));
  let rock = Math.max(smoothstep(0.55, 0.95, slope), smoothstep(0.6, 0.75, vnoise(x * 0.05, z * 0.05, 544)) * smoothstep(8, 24, z - ridgeFoot(x)) * 0.7);
  // the planted rows' dark green ground and needles, burnt back by the salt nearest the water
  const rk = rowsK(x, z) * (1 - saltK(x, z) * 0.85);
  const ridgeRows = smoothstep(8, 16, z - ridgeFoot(x)) * (1 - smoothstep(50, 70, z - ridgeFoot(x))) * smoothstep(452, 470, x) * (1 - smoothstep(636, 650, x));
  let lush = Math.max(rk, ridgeRows * 0.8) * (1 - mud);
  let forest = Math.max(rk, ridgeRows) * 0.55 * (1 - mud);
  // paving: the camp square, the quay's apron, the mill pads, the races pad, the Sea Gate's pad
  const cd = Math.hypot(x - W.camp.x, z - W.camp.z) + (vnoise(x * 0.12, z * 0.12, 545) - 0.5) * 5;
  path = Math.max(path, (1 - smoothstep(W.camp.r * 0.45, W.camp.r * 0.95, cd)) * 0.85);
  let cobble = (1 - smoothstep(6, 9, cd)) * smoothstep(0.15, 0.4, vnoise(x * 0.3, z * 0.3, 546) + 0.3);
  const Q = W.quay;
  cobble = Math.max(cobble, (1 - smoothstep(0.5, 3, Math.hypot(Math.max(Q.x0 - x, x - Q.x1, 0), Math.max(0, Q.z0 - 6 - z)))) * (z < Q.z1 ? 1 : 0));
  for (const P of [...W.mills, W.races, W.gatePad]) cobble = Math.max(cobble, (1 - smoothstep(P.r * 0.6, P.r * 0.9, Math.hypot(x - P.x, z - P.z))) * smoothstep(0.1, 0.35, vnoise(x * 0.3, z * 0.3, 547) + 0.25));
  // the ropewalk's floor: trodden earth the length of the shed
  const R = W.ropewalk;
  if (x > R.x0 - 2 && x < R.x1 + 2) path = Math.max(path, 1 - smoothstep(R.hw - 0.6, R.hw + 1.2, Math.abs(z - R.z)));
  // the tar yards: blackened ground
  const td = Math.hypot(x - W.taryard.x, z - W.taryard.z) + (vnoise(x * 0.15, z * 0.15, 548) - 0.5) * 5;
  const foundry = (1 - smoothstep(W.taryard.r * 0.5, W.taryard.r * 1.1, td)) * (1 - mud);
  // (dressing pass) the ground less plain: cart ruts down the main road (two wet lines a cart's width apart, off the paving),
  // a dark wrack line of dried weed and drift along the high-water mark, shingle running up into the grass along the
  // shore in tongues, darker and bare patches through the salt grass
  const sd = tidewaterShoreDist(x, z), dry = smoothstep(1.5, 2.2, h);
  { const n = nearest(W.paths[0], x, z), d = n.d + (vnoise(x * 0.06, z * 0.06, 531) - 0.5) * 2.0;
    const rut = (1 - smoothstep(0.22, 0.6, Math.abs(Math.abs(d) - 1.05))) * smoothstep(0.3, 0.55, vnoise(x * 0.09, z * 0.09, 552) + 0.25) * dry * (1 - cobble);
    mud = Math.max(mud, rut * 0.8); }
  const wrack = (1 - smoothstep(0.06, 0.26, Math.abs(h - 1.3 + (vnoise(x * 0.2, z * 0.2, 553) - 0.5) * 0.3))) * smoothstep(0.35, 0.55, vnoise(x * 0.11, z * 0.11, 554)) * (1 - smoothstep(6, 12, sd)) * (1 - cobble) * (1 - pond);
  forest = Math.max(forest, wrack * 0.8);
  sand = Math.max(sand, smoothstep(0.52, 0.72, vnoise(x * 0.07, z * 0.13, 549)) * (1 - smoothstep(5, 16, sd)) * (1 - mud) * 0.85);
  const salted = 1 - saltK(x, z) * 0.7;
  lush = Math.max(lush, smoothstep(0.56, 0.8, vnoise(x * 0.035, z * 0.035, 550)) * 0.5 * salted * dry * (1 - mud));
  // (second dressing pass) the camp's and the tar yards' open ground broken up: the worn ring round the square in patches
  // with grass coming through, narrow grey shingle paths laid between the doors, the square and the yards (with ragged
  // edges), shingle scattered in the trodden ground, greener grass in the lee of the house walls, and bare dark patches
  if (x > 418 && x < 506 && z > -2632 && z < -2566) {
    const wear = smoothstep(0.3, 0.62, vnoise(x * 0.16, z * 0.16, 561) * 0.7 + vnoise(x * 0.5, z * 0.5, 562) * 0.3);
    const road = 1 - smoothstep(1.8, 4.0, pd), ring = smoothstep(7, 9.5, cd) * (1 - smoothstep(W.camp.r * 1.0, W.camp.r * 1.2, cd));
    path *= 1 - wear * 0.6 * ring * (1 - road);
    let sh = 0;
    for (const P of SHINGLE) { const n = nearest(P, x, z); if (n.d < 2.2) sh = Math.max(sh, 1 - smoothstep(0.3, 1.0, n.d + (vnoise(x * 0.9, z * 0.9, 563) - 0.5) * 0.7)); }
    sand = Math.max(sand, sh * 0.5, smoothstep(0.72, 0.9, vnoise(x * 0.6, z * 0.6, 564)) * path * 0.4);
    path = Math.max(path * (1 - sh * 0.8), sh * 0.25);
    lush = Math.max(lush, smoothstep(0.5, 0.75, vnoise(x * 0.11, z * 0.11, 565)) * 0.45 * (1 - path) * (1 - sh) * dry);
    mud = Math.max(mud, smoothstep(0.74, 0.9, vnoise(x * 0.09 + 7, z * 0.09, 566)) * 0.35 * path * dry);
  }
  path = Math.max(path, smoothstep(0.64, 0.84, vnoise(x * 0.05 + 3, z * 0.05, 551)) * 0.35 * dry);
  rock *= (1 - path * 0.6) * (1 - cobble);
  lush *= (1 - path) * (1 - cobble) * (1 - rock * 0.6);
  forest *= (1 - path) * (1 - cobble);
  sand *= 1 - cobble;
  path *= 1 - mud * 0.7;
  return { sand: clamp(sand, 0, 1), path: clamp(path, 0, 1), rock: clamp(rock, 0, 1), lush: clamp(lush, 0, 1), forest: clamp(forest, 0, 1), cobble: clamp(cobble, 0, 1), foundry: clamp(foundry, 0, 1), snow: 0, mud: clamp(mud, 0, 1) };
}

// how far past the edge of the walkable land a point is (0 or less inside): the coast plus a 6 m wade, the Sound's foreshore
// (the mud flats, out to a metre past their edge, but never the deep channel), the quay and the Sea Gate's crest to their
// rails, never up the south ridge (3 m past its foot at most), never within 15 m of the edge of the box
export function tidewaterGap(x, z) {
  const W = TIDEWATER, S = soundD(x, z);
  let g = tidewaterShore(x, z) - 6;
  if (S.hw > 1) g = Math.max(g, S.dn - (foreW(x) + 1));
  g = Math.max(g, z - (ridgeFoot(x) + 3));
  const Q = W.quay;
  g = Math.min(g, Math.max(Q.x0 + 0.4 - x, x - Q.x1 + 0.4, Q.z0 - 3 - z, z - Q.z1 + 0.4));
  const C = crest();
  g = Math.min(g, Math.max(C.x0 + 0.35 - x, x - C.x1 + 0.35, C.z0 - 2 - z, z - C.z1 + 0.35));
  return Math.max(g, W.minX + 15 - x, W.minZ + 15 - z, x - (W.maxX - 15), z - (W.maxZ - 15));
}
