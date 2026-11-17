// The Russet Weald (Part Fifteen): an old hardwood forest in autumn over the ridge above the Rainward Gorge's Slip, on the dry
// side of the range, with its own terrain box. Shared by the server (heights, zones, the edge of the land, the gale) and the
// client (its terrain mesh, splat map and the gale's look). It imports only noise.js and tidewater.js (for the shared world
// clock), so areas.js and terrain.js can import it without a cycle.
//
// Layout (north is -z): a long forest floor rising gently from the west (the low wood, where the ropeway comes down off the
// ridge to the south) to the east (the high wood on the ridge), closed all round by steep wooded banks. One long straight
// main ride runs west to east down the middle; side rides leave it straight north or straight south, never both at the same
// place (every junction is a T, the north and south rides offset by 28 m and more: no four-way crossroads from above).
// West to east: the Ropeway Foot (the ropeway's lower station on a stone pad at the foot of the south bank, the Woodwrights'
// camp of square huts, the saw pits, young coppice panels, the first rides), the Long Sheds (two rows of long square
// louvred seasoning sheds north of the main ride, parallel, the north ride through the gap between them; log decks along the
// ride; old coppice panels to the south), the Standards (the high wood on the ridge: the great oaks, many half-cut and
// standing dead, the Coppice Engine's track up the north ride, the Makers' great ride going on east into the ridge).
// Hollows in the forest floor hold the mist (moss on their floors); the rides are trodden earth, the sheds' ground pale
// sawdust, the rest copper and gold leaf litter.
//
// The gale: one gale for the whole wood, a pure function of the shared world clock (the same clock as Tidewater Sound's
// tide and the Rainward Gorge's rain: the server's sim time, which every client reads from its snapshots), so every player
// sees the same storm. It blows for about a quarter of every cycle; dry (no rain here). At its height it throws the
// half-cut standards down, one after another, along their marked fall lines across the rides. galeLevel(t) and
// galeState(t) take a time directly for tests and for anything that wants a time other than now.
import { fbm, ridged, vnoise, smoothstep, lerp, clamp } from './noise.js';
import { tideNow } from './tidewater.js';

export const WEALD = {
  minX: 380, maxX: 680, minZ: -3600, maxZ: -3300,
  water: 0, floor: 0, // (no open water anywhere in the wood: tpspot's fallback)
  // the gale: level 0..1 = blow(phase), phase = (t - t0) / period mod 1, so world time 0 is calm. It comes on at phase on
  // (building over ramp) and drops at off; the standards come down while the level is above throw
  gale: { period: 840, t0: 0, on: 0.56, off: 0.84, ramp: 0.05, throw: 0.85, fall: 0.012 },
  // the walkable floor: a rectangle (x0..x1, z0..z1) with a wobbled edge; past it the banks rise steep and wooded
  edge: { x0: 400, x1: 660, z0: -3578, z1: -3322 },
  // the floor's level along x (low wood in the west, the ridge in the east)
  rise: [[380, 8], [430, 9], [490, 12], [560, 17], [600, 24], [640, 33], [680, 38]],
  // the region bands, west to east (on a wobbled x): the Ropeway Foot | the Long Sheds | the Standards
  bands: [472, 588],
  // the rides (straight centre lines [x, z]), half width rideHW: the main ride west to east, the north rides (from the main
  // ride to the north bank), the south rides (to the ropeway's station and to the south bank), and the short straight spurs
  // into the camp and to the lofts' pad (each meets its ride in a T)
  rideHW: 4,
  rides: [
    { id: 'main', pts: [[406, -3450], [641, -3450]] },
    { id: 'n450', pts: [[450, -3450], [450, -3570]] },
    { id: 'n532', pts: [[532, -3450], [532, -3570]] },
    { id: 'n615', pts: [[615, -3450], [615, -3570]] },
    { id: 's418', pts: [[418, -3450], [418, -3359]] }, // (down to the ropeway's station pad)
    { id: 's560', pts: [[560, -3450], [560, -3330]] },
    { id: 'camp', pts: [[418, -3405], [433, -3405]], hw: 2.6 }, // (east off the station ride into the camp)
    { id: 'lofts', pts: [[450, -3476], [481, -3476]], hw: 2.6 }, // (east off the first north ride to the lofts' pad)
  ],
  // the ropeway's lower station: a levelled stone pad at the foot of the south bank (the car comes in over its south edge,
  // the ropeway's towers climb the bank to the ridge behind), where a ride down sets you (landing), the ropeman (keeper)
  station: { pad: { x: 418, z: -3352, s: 7 }, landing: { x: 420, z: -3358 }, keeper: { x: 425.5, z: -3356.5, ry: -1.9 } },
  // the Woodwrights' camp on a level square (half size s), its graveyard and caravan stop by it, the shed master; the saw pits
  camp: { x: 446, z: -3405, s: 13 },
  grave: { x: 408, z: -3394 },
  caravan: { x: 440, z: -3431 },
  qm: { x: 449.5, z: -3409.5, ry: 2.8 },
  sawpits: { x: 446, z: -3376, s: 6 },
  // the Long Sheds: two rows of two, long along x, square, on levelled floors (x0..x1, z0..z1), the north ride through the
  // gap between the pairs. The first shed's west gable opens onto the lofts' pad (P15.4: The Drying Lofts' door)
  sheds: [
    { x0: 492, x1: 527, z0: -3481, z1: -3471 }, { x0: 537, x1: 575, z0: -3481, z1: -3471 },
    { x0: 492, x1: 527, z0: -3505, z1: -3495 }, { x0: 537, x1: 575, z0: -3505, z1: -3495 },
  ],
  lofts: { x: 485.5, z: -3476, s: 4.5, b: 9 }, // (eased over 9 m: it stands at the shed floor's level, above the ground west of it)
  // the Makers' great ride: the main ride's east end, a levelled pad before the cut into the ridge (P15.5: The Great Ride's
  // door, facing west out of the ridge)
  greatride: { x: 648, z: -3450, s: 7 },
  // log decks: trunks lying parallel along x on the strip between the main ride and the sheds (x0..x1 at z, half depth hd)
  decks: [{ x0: 494, x1: 504, z: -3463, hd: 2 }, { x0: 516, x1: 526, z: -3463, hd: 2 }, { x0: 540, x1: 550, z: -3463, hd: 2 }, { x0: 564, x1: 573, z: -3463, hd: 2 }],
  // the coppice panels, cut on the old round (rectangles bounded by the rides; age 0 just cut .. 3 overgrown)
  panels: [
    { x0: 404, x1: 444, z0: -3570, z1: -3458, age: 1 },
    { x0: 456, x1: 486, z0: -3570, z1: -3484, age: 0 },
    { x0: 482, x1: 554, z0: -3444, z1: -3330, age: 3 },
    { x0: 540, x1: 610, z0: -3570, z1: -3512, age: 2 },
    { x0: 566, x1: 655, z0: -3444, z1: -3330, age: 3 },
  ],
  // the high wood of great standards (the Standards region north of the main ride, either side of the north ride)
  highwood: [{ x0: 590, x1: 609, z0: -3570, z1: -3458 }, { x0: 621, x1: 656, z0: -3570, z1: -3458 }],
  // hollows in the forest floor where the mist lies (centre, radius, depth)
  hollows: [{ x: 482, z: -3532, r: 13, d: 1.5 }, { x: 512, z: -3400, r: 13, d: 1.4 }, { x: 592, z: -3542, r: 15, d: 1.8 }, { x: 640, z: -3392, r: 12, d: 1.5 }, { x: 428, z: -3518, r: 10, d: 1.2 }],
  // the marked fall lines: a half-cut standard at the base (x, z), 9.5 m off a ride's line, falls along the line to (x2, z2),
  // its crown coming to rest just over the ride's far edge (from above a T on that edge, never a bar right through the ride);
  // marked with banded posts at both edges of the ride. Every line runs straight across one ride, none cross another
  falls: [
    { x: 470, z: -3459.5, x2: 470, z2: -3445.5 },
    { x: 440.5, z: -3520, x2: 454.5, z2: -3520 },
    { x: 510, z: -3440.5, x2: 510, z2: -3454.5 },
    { x: 550.5, z: -3395, x2: 564.5, z2: -3395 },
    { x: 595, z: -3440.5, x2: 595, z2: -3454.5 },
    { x: 628, z: -3459.5, x2: 628, z2: -3445.5 },
    { x: 605.5, z: -3510, x2: 619.5, z2: -3510 },
    { x: 624.5, z: -3545, x2: 610.5, z2: -3545 },
  ],
  fallHW: 1.8,
  // the Coppice Engine's track: twin ruts up the north ride through the Standards (x, z0..z1, rut spacing)
  track: { x: 615, z0: -3572, z1: -3452, gauge: 2.6 },
};
const table = (Tb, x) => {
  if (x <= Tb[0][0]) return Tb[0][1];
  for (let i = 0; i < Tb.length - 1; i++) if (x <= Tb[i + 1][0]) return lerp(Tb[i][1], Tb[i + 1][1], (x - Tb[i][0]) / (Tb[i + 1][0] - Tb[i][0]));
  return Tb[Tb.length - 1][1];
};
export const floorLevel = (x) => table(WEALD.rise, x);
export const inWeald = (x, z, pad = 0) => x >= WEALD.minX + pad && x <= WEALD.maxX - pad && z >= WEALD.minZ + pad && z <= WEALD.maxZ - pad;

// ---------------------------------------------------------------- the gale
// the clock the gale reads: the shared world clock (shared/tidewater.js: the sim sets its own time, the client the server's)
export const galeNow = () => tideNow();
const phaseOf = (t) => { const G = WEALD.gale; return ((((t - G.t0) / G.period) % 1) + 1) % 1; };
// how hard it blows at world time t (0 calm .. 1 the height of the gale)
export function galeLevel(t = galeNow()) {
  const G = WEALD.gale, p = phaseOf(t);
  return smoothstep(G.on, G.on + G.ramp, p) * (1 - smoothstep(G.off - G.ramp, G.off, p));
}
// the gale at world time t: { level, phase, blowing (a gale), calm, throwing (the standards are coming down), toGale / toCalm
// (seconds to the next gale's start and to the next calm's start) }
export function galeState(t = galeNow()) {
  const G = WEALD.gale, level = galeLevel(t), phase = phaseOf(t);
  return {
    level, phase, blowing: level > 0.5, calm: level < 0.02, throwing: level > G.throw,
    toGale: ((((G.on - phase) % 1) + 1) % 1) * G.period, toCalm: ((((G.off - phase) % 1) + 1) % 1) * G.period,
  };
}
// when fall line i comes down (a phase): one after another through the height of the gale
export function fallPhase(i) { const G = WEALD.gale, a = G.on + G.ramp + 0.01, b = G.off - G.ramp - 0.03; return a + (b - a) * (i / Math.max(1, WEALD.falls.length - 1)); }
// each fall line at world time t: { i, k (0 standing .. 1 down across the ride, as it falls over fall of a cycle), down (it
// lies across the ride: from its fall to the end of the gale) }
export function fallState(t = galeNow()) {
  const G = WEALD.gale, p = phaseOf(t);
  return WEALD.falls.map((F, i) => { const f0 = fallPhase(i), k = clamp((p - f0) / G.fall, 0, 1); return { i, k: p >= f0 && p < G.off ? k : 0, down: p >= f0 + G.fall && p < G.off }; });
}

// ---------------------------------------------------------------- shapes
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  return { d: Math.hypot(ax + dx * t - px, az + dz * t - pz), t };
}
// the nearest ride: { d (to its centre line), hw, id }
export function rideAt(x, z) {
  let best = { d: 1e9, hw: WEALD.rideHW, id: null };
  for (const R of WEALD.rides) { const P = R.pts; for (let i = 0; i < P.length - 1; i++) { const { d } = segDist(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]); if (d < best.d) best = { d, hw: R.hw ?? WEALD.rideHW, id: R.id }; } }
  return best;
}
// how far a point is outside the nearest ride's edge (negative on it)
export function wealdPathDist(x, z) { const R = rideAt(x, z); return R.d - R.hw; }
// the nearest fall line: { d (to the line), i, s (0 at the standard's base .. 1 at its crown's end) }
export function fallLine(x, z) {
  let best = { d: 1e9, i: -1, s: 0 };
  WEALD.falls.forEach((F, i) => { const { d, t } = segDist(x, z, F.x, F.z, F.x2, F.z2); if (d < best.d) best = { d, i, s: t }; });
  return best;
}
// how hard a falling standard strikes a point at world time t (0..1): on a fall line, at the moment its standard comes down
export function wealdFallAt(x, z, t = galeNow()) {
  const L = fallLine(x, z);
  if (L.i < 0 || L.d > WEALD.fallHW) return 0;
  const S = fallState(t)[L.i];
  return S.k > 0 && !S.down ? 1 - smoothstep(WEALD.fallHW - 0.5, WEALD.fallHW, L.d) : 0;
}
// the coppice panel a point lies in, or null; the high wood likewise
const inRect = (P, x, z, pad = 0) => x >= P.x0 - pad && x <= P.x1 + pad && z >= P.z0 - pad && z <= P.z1 + pad;
export function panelAt(x, z) { for (const P of WEALD.panels) if (inRect(P, x, z)) return P; return null; }
export function highwoodAt(x, z) { for (const P of WEALD.highwood) if (inRect(P, x, z)) return P; return null; }
export function shedAt(x, z, pad = 0) { for (const S of WEALD.sheds) if (inRect(S, x, z, pad)) return S; return null; }
// how deep in a hollow a point is (0 outside .. 1 at its floor)
export function hollowK(x, z) { let k = 0; for (const H of WEALD.hollows) k = Math.max(k, 1 - smoothstep(H.r * 0.25, H.r, Math.hypot(x - H.x, z - H.z))); return k; }

// distance past the walkable floor's wobbled edge (negative inside)
function edgeGap(x, z) {
  const E = WEALD.edge, w = (vnoise(x * 0.04, z * 0.04, 701) - 0.5) * 5;
  return Math.max(E.x0 - x, x - E.x1, E.z0 - z, z - E.z1) + w;
}

// the forest floor with its banks and hollows
function natural(x, z) {
  let h = floorLevel(x) + (fbm(x * 0.018, z * 0.018, 3, 711) - 0.5) * 3.2 + (vnoise(x * 0.09, z * 0.09, 712) - 0.5) * 0.35;
  const g = edgeGap(x, z);
  if (g > -6) h += smoothstep(-6, 4, g) * 2 + Math.max(0, g) * 0.9 + smoothstep(0, 30, g) * (26 + ridged(x * 0.03, z * 0.03, 3, 713) * 12);
  for (const H of WEALD.hollows) { const d = Math.hypot(x - H.x, z - H.z); if (d < H.r) h -= H.d * (1 - smoothstep(H.r * 0.2, H.r, d)); }
  return h;
}
// the levelled places: square pads (centre, half size s) and the sheds' floors (rectangles), each eased into the ground
// round it over b metres; their levels filled in lazily from the natural ground
const PADS = [WEALD.station.pad, WEALD.camp, WEALD.sawpits, WEALD.lofts, WEALD.greatride];
const shedTop = (S) => { if (S.flat == null) S.flat = natural((S.x0 + S.x1) / 2, (S.z0 + S.z1) / 2) + 0.05; return S.flat; };
// (the lofts' pad is the first shed's threshold: at its floor's level)
const padTop = (P) => { if (P.flat == null) P.flat = P === WEALD.lofts ? shedTop(WEALD.sheds[0]) - 0.05 : natural(P.x, P.z) - 0.05; return P.flat; };
function shaped(x, z) {
  let h = natural(x, z);
  // the rides: a touch sunk and smoothed (trodden), the side spurs too
  const R = rideAt(x, z);
  if (R.d < R.hw + 2) h -= (1 - smoothstep(R.hw - 1, R.hw + 2, R.d)) * 0.1;
  for (const P of PADS) {
    const d = Math.max(Math.abs(x - P.x), Math.abs(z - P.z)), bl = P.b ?? 4;
    if (d < P.s + bl) h = lerp(h, padTop(P) + (vnoise(x * 0.09, z * 0.09, 719) - 0.5) * 0.06, 1 - smoothstep(P.s, P.s + bl, d));
  }
  for (const S of WEALD.sheds) {
    const d = Math.max(S.x0 - x, x - S.x1, S.z0 - z, z - S.z1);
    if (d < 4) h = lerp(h, shedTop(S), 1 - smoothstep(0, 4, d));
  }
  return h;
}
export function wealdHeight(x, z) { return shaped(x, z); }
// no bridges or decks in the wood; no open water
export function wealdDeck() { return -Infinity; }
export function wealdWater() { return null; }
export const wealdWaterKind = () => null;

// the wobbled x the regions follow
const uOf = (x, z) => x + (vnoise(x * 0.006, z * 0.02, 741) - 0.5) * 8 + (vnoise(x * 0.03, z * 0.03, 742) - 0.5) * 2;
export function wealdZone(x, z) {
  const u = uOf(x, z);
  return u < WEALD.bands[0] ? 'ropewayfoot' : u < WEALD.bands[1] ? 'longsheds' : 'standards';
}

// ground paint, the same shape as groundAt's. In the Russet Weald the channels mean: the base is copper and brown leaf litter
// (the terrain's weald theme), forest = gold and russet leaf litter, thick under the standards and the old coppice, lush =
// moss in the damp hollows and along the bank feet, path = the rides' trodden earth (and the Coppice Engine's twin ruts),
// sand = pale sawdust (the saw pits, round the sheds and the log decks), cobble = the Makers' stone pads (the ropeway's
// station, the lofts' pad, the great ride's pad, the camp's middle), rock = the grey banks. mud, foundry and snow are 0.
export function wealdGround(x, z) {
  const S = WEALD;
  const e = 1.0, gx = (wealdHeight(x + e, z) - wealdHeight(x - e, z)) / (2 * e), gz = (wealdHeight(x, z + e) - wealdHeight(x, z - e)) / (2 * e);
  const slope = Math.hypot(gx, gz), g = edgeGap(x, z);
  const R = rideAt(x, z);
  let path = 1 - smoothstep(R.hw - 1.0, R.hw + 0.4 + (vnoise(x * 0.3, z * 0.3, 751) - 0.5) * 0.8, R.d);
  // leaf litter blown over the rides' edges (never across their middle: the rides read straight)
  path *= 1 - smoothstep(0.5, 0.8, vnoise(x * 0.22, z * 0.22, 752)) * smoothstep(R.hw - 2, R.hw - 0.5, R.d) * 0.7;
  { const T = S.track; if (z > T.z0 && z < T.z1) for (const s of [-1, 1]) path = Math.max(path, (1 - smoothstep(0.35, 0.7, Math.abs(x - T.x - s * T.gauge / 2))) * 0.95); }
  let rock = Math.max(smoothstep(0.7, 1.1, slope), smoothstep(-1, 8, g));
  let lush = Math.max(hollowK(x, z) * 0.9, smoothstep(-8, -1, g) * (1 - smoothstep(2, 9, g)) * 0.6, smoothstep(0.68, 0.84, vnoise(x * 0.05, z * 0.05, 753)) * 0.35);
  let forest = smoothstep(0.35, 0.65, vnoise(x * 0.035, z * 0.035, 754)) * 0.6;
  { const P = panelAt(x, z); if (P) forest = Math.max(forest, 0.4 + 0.15 * P.age); if (highwoodAt(x, z)) forest = Math.max(forest, 0.9); }
  let sand = 0, cobble = 0;
  // sawdust: the saw pits' square and round the sheds and the log decks
  { const P = S.sawpits, d = Math.max(Math.abs(x - P.x), Math.abs(z - P.z)) + (vnoise(x * 0.2, z * 0.2, 755) - 0.5) * 2.5; sand = Math.max(sand, (1 - smoothstep(P.s - 1, P.s + 2.5, d)) * 0.95); }
  for (const Sh of S.sheds) { const d = Math.max(Sh.x0 - x, x - Sh.x1, Sh.z0 - z, z - Sh.z1) + (vnoise(x * 0.18, z * 0.18, 756) - 0.5) * 2; sand = Math.max(sand, (1 - smoothstep(0.5, 4, d)) * 0.85); }
  for (const D of S.decks) { const d = Math.max(D.x0 - x, x - D.x1, Math.abs(z - D.z) - D.hd) + (vnoise(x * 0.25, z * 0.25, 757) - 0.5) * 1.6; sand = Math.max(sand, (1 - smoothstep(0.5, 3, d)) * 0.7); }
  // the stone pads (the camp's middle: a worked square; the rest of the camp trodden earth)
  for (const P of [S.station.pad, S.lofts, S.greatride]) cobble = Math.max(cobble, (1 - smoothstep(P.s - 0.6, P.s + 0.4, Math.max(Math.abs(x - P.x), Math.abs(z - P.z)))) * smoothstep(0.1, 0.35, vnoise(x * 0.3, z * 0.3, 758) + 0.3));
  { const C = S.camp, cd = Math.max(Math.abs(x - C.x), Math.abs(z - C.z)) + (vnoise(x * 0.12, z * 0.12, 759) - 0.5) * 3;
    path = Math.max(path, (1 - smoothstep(C.s * 0.55, C.s * 0.95, cd)) * 0.7 * smoothstep(0.25, 0.5, vnoise(x * 0.2, z * 0.2, 760) + 0.2));
    cobble = Math.max(cobble, (1 - smoothstep(3.5, 5, Math.max(Math.abs(x - C.x), Math.abs(z - C.z)))) * 0.8); }
  rock *= (1 - path) * (1 - cobble);
  lush *= (1 - path) * (1 - cobble) * (1 - sand) * (1 - rock * 0.5);
  forest *= (1 - path) * (1 - cobble) * (1 - sand * 0.8) * (1 - rock * 0.6);
  sand *= 1 - cobble;
  path *= 1 - sand * 0.6;
  return { sand: clamp(sand, 0, 1), path: clamp(path, 0, 1), rock: clamp(rock, 0, 1), lush: clamp(lush, 0, 1), forest: clamp(forest, 0, 1), cobble: clamp(cobble, 0, 1), foundry: 0, snow: 0, mud: 0 };
}

// how far past the edge of the walkable ground a point is (0 or less inside): the forest floor to a metre inside the banks'
// foot, never within 15 m of the edge of the box
export function wealdGap(x, z) {
  const S = WEALD;
  const g = edgeGap(x, z) + 1;
  return Math.max(g, S.minX + 15 - x, S.minZ + 15 - z, x - (S.maxX - 15), z - (S.maxZ - 15));
}
