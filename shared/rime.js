// The Rime Steps (Part Eleven): a glacier valley on the cold coast north of the Cinder Reach, with its own terrain box.
// Shared by the server (heights, zones, the edge of the land) and the client (its terrain mesh and splat map).
// It imports only noise.js, so areas.js and terrain.js can import it without a cycle.
//
// Layout (north is -z, the valley climbs east): the ship comes in from the west to a timber pier on a grey shingle beach in the
// valley mouth; the landing camp sits on a low shelf above it (the Icefall Landing). Steep walls hem the valley in north and
// south and drop into the sea as cliffs. Eastward the floor climbs in three terraces joined by stone ramps: the Icefall
// Landing, the Flume Works (the Makers' water-driven mills on two meltwater channels) and the Dam Crown, where a long
// straight dam crosses the valley and holds back a frozen lake that runs up to the glacier at the east end. The meltwater
// leaves the dam's foot in two channels that run west to the sea and freeze where they fall over the terrace faces.
import { fbm, ridged, vnoise, smoothstep, lerp, clamp } from './noise.js';

export const RIME = {
  minX: 380, maxX: 680, minZ: -1800, maxZ: -1500,
  water: 0, floor: -6, // the sea surface and the sea floor beyond the shelf
  // the land's outline: a rounded rectangle (centre, half sizes, corner radius) with a wobbling coast, even along the west mouth
  land: { cx: 546, cz: -1650, hx: 122, hz: 130, r: 45 },
  // the valley floor: its centre line z = axis.z + axis.amp * sin((x - axis.x0) * axis.k), and its half width by x (the walls
  // start there and are not walkable beyond about 4 m up)
  axis: { z: -1650, amp: 9, x0: 424, k: 0.02 },
  halfW: [[424, 95], [500, 70], [580, 62], [650, 58]],
  glacier: 640, // the east end: the frozen lake runs up to the glacier, which nobody climbs
  // the landing pier in the valley mouth (top is the deck height); the ship berths along its north side
  pier: { x0: 394, x1: 432, z0: -1652.4, z1: -1647.6, top: 1.75 },
  berth: { x: 396, z: -1657, ry: Math.PI / 2 },
  landing: { x: 435, z: -1650 }, // where a crossing sets you down: the shingle at the pier's root
  harbour: { x: 429, z: -1648.8, ry: Math.PI / 2 }, // the harbour master, on the deck at the root of the pier
  camp: { x: 458, z: -1650, r: 24, flat: 3.6 }, // the Icefall Landing camp shelf
  grave: { x: 450, z: -1671 }, // where the fallen wake: the north edge of the camp
  caravan: { x: 468, z: -1636 }, // the caravan stop (no routes: the only way off is the ship, but a Homeward Compass home)
  // the terraces, on the wobbled x (u): the floor rises gently along each tread and steps up 12 m at two ice-hung faces
  tread: { base: 3.4, u0: 450, grade: 0.045, run: 150 },
  faces: [{ u0: 492, u1: 508, rise: 12 }, { u0: 566, u1: 582, rise: 12 }],
  // the region bands, west to east (on u): the Icefall Landing | the Flume Works | the Dam Crown
  bands: [500, 574],
  // the dam: straight across the valley at x, a solid crest (terrain) of half width hw at height crest; the lake behind it
  dam: { x: 601, hw: 3, crest: 40.5, z0: -1712, z1: -1592 },
  lake: { x0: 604, ice: 38.6 },
  // the Makers' mills on the Flume Works tread, each beside a channel (levelled pads for the client's water wheels and works)
  works: [{ x: 548, z: -1678, r: 9 }, { x: 548, z: -1622, r: 9 }],
  // the meltwater channels: from outlets at the dam's foot west to the sea (polylines [x, z]); frozen over the terrace faces
  channels: [
    [[596, -1695], [575, -1698], [560, -1694], [530, -1690], [505, -1688], [480, -1692], [450, -1700], [418, -1707]],
    [[596, -1606], [570, -1604], [540, -1610], [500, -1612], [470, -1606], [440, -1600], [418, -1596]],
  ],
  // stone ramps (polylines [x, z, height?]; a point without a height takes the ground's own): the only ways up the faces, up
  // the dam's downstream face to its crest, and from the crest down onto the ice
  ramps: [
    [[480, -1640], [518, -1636]], // the Icefall Landing up to the Flume Works
    [[552, -1658], [590, -1662]], // the Flume Works up to the Dam Crown
    [[596.5, -1670], [596.5, -1641, 40.5], [601, -1641, 40.5]], // up the dam's face, against its stonework, onto the crest
    [[603, -1652, 40.5], [613, -1652]], // down from the crest onto the frozen lake ((RF.7) 11 m north of the way up: no + across the crest)
  ],
  // tracks (polylines [x, z]): the main road east from the pier to the dam crest, the camp's loops under the walls, the mills,
  // and the walk along the crest
  paths: [
    [[431, -1650], [458, -1650], [480, -1640], [518, -1636], [540, -1645], [552, -1658], [590, -1662], [596.5, -1670], [596.5, -1641], [601, -1641]],
    [[468, -1645], [468, -1680], [474, -1712]], // north under the wall (leaves the main road east of the square: no tracks fanning out of one point, content rules) (crosses the north channel by a footbridge)
    [[446, -1650], [468, -1622], [474, -1590]], // south under the wall (crosses the south channel by a footbridge)
    [[552, -1658], [548, -1678]], // to the north mill ((RF.7) from the ramp foot, 17 m on from the south mill's track: no X)
    [[522, -1637.6], [523, -1625], [539, -1622]], // to the south mill ((RF.7) square off the road just past the ramp top, 30 m from the north mill's: the two met the road as an X)
    [[601, -1704], [601, -1596]], // along the dam crest
    [[450, -1671], [456, -1660]], // the graveyard to the camp
    [[601, -1652], [613, -1652]], // (RF.7) off the crest walk down onto the lake (offset from the way up)
  ],
  bridges: [], // footbridges where a track crosses a channel (filled in below): { x, z, ux, uz, hl, hw, top }
};

export const inRime = (x, z, pad = 0) => x >= RIME.minX + pad && x <= RIME.maxX - pad && z >= RIME.minZ + pad && z <= RIME.maxZ - pad;

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
export function rimePathDist(x, z) {
  let best = 1e9;
  for (const P of RIME.paths) { const n = nearest(P, x, z); if (n.d < best) best = n.d; }
  return best + (vnoise(x * 0.06, z * 0.06, 331) - 0.5) * 2.0;
}
// distance to the nearest channel centre line, with the nearest centre point (cx, cz)
export function rimeChannel(x, z) {
  let best = null;
  for (const P of RIME.channels) { const n = nearest(P, x, z); if (!best || n.d < best.d) best = n; }
  return { d: best.d + (vnoise(x * 0.08, z * 0.08, 332) - 0.5) * 1.2, cx: best.x, cz: best.z };
}

// the valley floor: its centre line and half width at x, and how far a point is from the centre line
export const rimeAxisZ = (x) => RIME.axis.z + RIME.axis.amp * Math.sin((x - RIME.axis.x0) * RIME.axis.k);
export function rimeHalfW(x) {
  const H = RIME.halfW;
  if (x <= H[0][0]) return H[0][1];
  for (let i = 0; i < H.length - 1; i++) if (x <= H[i + 1][0]) return lerp(H[i][1], H[i + 1][1], (x - H[i][0]) / (H[i + 1][0] - H[i][0]));
  return H[H.length - 1][1];
}
const wallD = (x, z) => Math.abs(z - rimeAxisZ(x)) - rimeHalfW(x); // past the floor's edge (negative on the floor)

// the coastline: distance past the shore (negative on land)
export function rimeShore(x, z) {
  const L = RIME.land;
  const qx = Math.abs(x - L.cx) - L.hx + L.r, qz = Math.abs(z - L.cz) - L.hz + L.r;
  const sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - L.r;
  let wob = (vnoise(x * 0.012 + 3, z * 0.012 + 3, 301) - 0.5) * 18 + (vnoise(x * 0.045, z * 0.045, 302) - 0.5) * 6;
  const mouth = (1 - smoothstep(434, 452, x)) * (1 - smoothstep(70, 100, Math.abs(z - rimeAxisZ(x)))); // the valley mouth: an even strand
  wob *= 1 - mouth * 0.92;
  return sd - wob;
}

// the wobbled x the terraces and regions follow
const uOf = (x, z) => x + (vnoise(x * 0.006, z * 0.02, 311) - 0.5) * 12 + (vnoise(x * 0.03, z * 0.03, 312) - 0.5) * 2;
export function rimeZone(x, z) {
  const u = uOf(x, z);
  return u < RIME.bands[0] ? 'icefall' : u < RIME.bands[1] ? 'flumeworks' : 'damcrown';
}
// the terrace profile along u (no noise): treads and faces
function prof(u) {
  const T = RIME.tread;
  let h = T.base + T.grade * clamp(u - T.u0, 0, T.run);
  for (const F of RIME.faces) h += F.rise * smoothstep(F.u0, F.u1, u);
  return h;
}
// is the profile steep here (a terrace face)? The channels freeze where they fall over one
const onFace = (u) => RIME.faces.some((F) => u > F.u0 - 1 && u < F.u1 + 1);

// the floor and walls before the ramps, dam, camp and channels
function ground0(x, z) {
  const R = RIME, u = uOf(x, z);
  let h = prof(u) + (vnoise(x * 0.07, z * 0.07, 313) - 0.5) * 0.4;
  // the frozen lake behind the dam: a level sheet of ice, up to the glacier, which climbs away east
  if (x > R.lake.x0 - 1) h = lerp(h, R.lake.ice, smoothstep(R.lake.x0 - 0.5, R.lake.x0 + 0.5, x));
  if (x > R.glacier - 4) h += smoothstep(R.glacier - 4, R.glacier + 14, x) * (24 + ridged(x * 0.05, z * 0.05, 2, 314) * 6);
  // treads: drifts and hummocks of old snow
  h += (ridged(x * 0.06, z * 0.06, 2, 315) - 0.3) * 0.5 * (x < R.lake.x0 ? 1 : 0);
  // the walls: steep rock and snow rising from the floor's edge into broken ridges
  const wd = wallD(x, z) + (vnoise(x * 0.04, z * 0.04, 316) - 0.5) * 8;
  const w = smoothstep(-2, 22, wd);
  if (w > 0) h += w * (28 + ridged(x * 0.02, z * 0.03, 3, 317) * 14 + (fbm(x * 0.05, z * 0.05, 2, 318) - 0.5) * 6);
  return h;
}

// a ramp's heights at each point (a point's own height, or the ground's there), worked out once
let rampH = null;
function rampHeights() {
  if (!rampH) rampH = RIME.ramps.map((P) => P.map((q) => (q.length > 2 ? q[2] : ground0(q[0], q[1]))));
  return rampH;
}

// the land before the coast cuts it: treads, faces and walls, then the ramps, the dam, the tracks, the camp and the mills
function inland(x, z) {
  const R = RIME;
  let h = ground0(x, z);
  // ramps: an even climb along each, the ground eased to it over 3-7 m either side
  const RH = rampHeights();
  for (let k = 0; k < R.ramps.length; k++) {
    const n = nearest(R.ramps[k], x, z);
    if (n.d >= 7) continue;
    const H = RH[k], rh = lerp(H[n.i], H[n.i + 1], n.t);
    h = lerp(h, rh, 1 - smoothstep(3, 7, n.d));
  }
  // the dam: a solid crest straight across the valley (its stone faces are the client's)
  const D = R.dam;
  if (z > D.z0 - 30 && z < D.z1 + 30 && wallD(x, z) < 12) {
    const k = 1 - smoothstep(D.hw - 0.4, D.hw + 0.4, Math.abs(x - D.x));
    if (k > 0) h = Math.max(h, lerp(h, D.crest, k));
  }
  // the tracks are a touch sunk
  const pd = rimePathDist(x, z);
  if (pd < 5) h -= (1 - smoothstep(1.2, 5, pd)) * 0.12;
  // levelled ground: the camp shelf and the mill pads
  const cd = Math.hypot(x - R.camp.x, z - R.camp.z);
  if (cd < R.camp.r) h = lerp(h, R.camp.flat + (vnoise(x * 0.06, z * 0.06, 319) - 0.5) * 0.3, 1 - smoothstep(R.camp.r * 0.55, R.camp.r, cd));
  for (const W of R.works) {
    const d = Math.hypot(x - W.x, z - W.z);
    if (d < W.r * 1.5) h = lerp(h, prof(uOf(W.x, W.z)) - 0.2, 1 - smoothstep(W.r * 0.7, W.r * 1.5, d));
  }
  return h;
}

// the land with the coast cut in: low ground runs down to a shingle beach, the walls end in sea cliffs
function land(x, z) {
  const R = RIME, s = rimeShore(x, z);
  let h;
  if (s >= 0) h = R.floor * smoothstep(0, 26, s);
  else {
    const H = inland(x, z), beach = 2.0 * smoothstep(0, -12, s);
    const st = -2 - 9 * (1 - smoothstep(4.5, 8, H)); // a wide strand below low ground, cliffs straight off the shore below high ground
    h = lerp(beach, Math.max(H, beach), smoothstep(st, st - (10 + Math.max(0, H - 4) * 0.25), s));
  }
  const edge = Math.min(x - R.minX, R.maxX - x, z - R.minZ, R.maxZ - z);
  if (edge < 12) h = lerp(R.floor, h, smoothstep(0, 12, edge));
  return h;
}

// a channel's water surface at its nearest centre point (the land there less 0.35 m), or null where it is frozen or at the sea
function channelLevel(C) {
  if (onFace(uOf(C.cx, C.cz))) return null;
  const lv = land(C.cx, C.cz) - 0.35;
  return lv > 0.15 ? lv : null;
}

// ground height: the land with the meltwater channels cut into it
export function rimeHeight(x, z) {
  let h = land(x, z);
  const C = rimeChannel(x, z);
  if (C.d < 4.2 && x < RIME.dam.x - RIME.dam.hw) {
    const lv = land(C.cx, C.cz) - 0.35; // frozen or not, the channel's bed is cut (on the faces it holds the ice of the falls)
    if (lv > -0.5) h = Math.min(h, lerp(lv - 0.9, h, smoothstep(1.6, 4.2, C.d)));
  }
  return h;
}

// footbridges: where a track crosses a channel, a short deck along the track (found once, from the polylines)
function findBridges() {
  const R = RIME;
  for (const P of R.paths) for (let i = 0; i < P.length - 1; i++) for (const Q of R.channels) for (let j = 0; j < Q.length - 1; j++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], [cx, cz] = Q[j], [dx, dz] = Q[j + 1];
    const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz, den = rx * sz - rz * sx;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((cx - ax) * sz - (cz - az) * sx) / den, v = ((cx - ax) * rz - (cz - az) * rx) / den;
    if (t < 0 || t > 1 || v < 0 || v > 1) continue;
    const L = Math.hypot(rx, rz), x = ax + rx * t, z = az + rz * t;
    R.bridges.push({ x, z, ux: rx / L, uz: rz / L, hl: 4.5, hw: 1.6, top: land(x, z) + 0.3 });
  }
}
findBridges();

// the landing pier and the footbridges (absolute deck height), else -Infinity
export function rimeDeck(x, z) {
  const P = RIME.pier;
  if (x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1) return P.top;
  for (const B of RIME.bridges) {
    const dx = x - B.x, dz = z - B.z, a = dx * B.ux + dz * B.uz, b = -dx * B.uz + dz * B.ux;
    if (Math.abs(a) < B.hl && Math.abs(b) < B.hw) return B.top;
  }
  return -Infinity;
}

// open water: the sea round the land, and the running meltwater in the channels (not where they are frozen); else null
export function rimeWater(x, z) {
  const h = rimeHeight(x, z);
  if (h < RIME.water - 0.25) return RIME.water;
  const C = rimeChannel(x, z);
  if (C.d < 2.6) { const lv = channelLevel(C); if (lv !== null && h < lv - 0.2) return lv; }
  return null;
}
// what kind of water: the channels are running water (a salvage hook), the rest is sea (a fishing line)
export function rimeWaterKind(x, z) {
  const w = rimeWater(x, z);
  if (w === null) return null;
  return w > RIME.water + 0.05 ? 'stream' : 'sea';
}

// ground paint, the same shape as groundAt's. On the Rime Steps the channels mean: snow = snow (the base everywhere above the
// shingle), lush = ice (the frozen lake, the frozen falls on the terrace faces, icy channel banks and patches on the treads;
// also given as ice), rock = rock on every steep face, the walls and the sea cliffs, sand = grey shingle on the beach and
// under the sea, path = tracks and the camp's trodden snow, cobble = stone paving (the camp square, the ramps and the dam
// crest). forest and foundry are 0.
export function rimeGround(x, z) {
  const R = RIME, s = rimeShore(x, z), u = uOf(x, z);
  const e = 1.0, gx = (rimeHeight(x + e, z) - rimeHeight(x - e, z)) / (2 * e), gz = (rimeHeight(x, z + e) - rimeHeight(x, z - e)) / (2 * e);
  const slope = Math.hypot(gx, gz);
  const pd = rimePathDist(x, z), wd = wallD(x, z);
  let path = 1 - smoothstep(1.8, 4.0, pd);
  const sand = 1 - smoothstep(8, 16, -s + (vnoise(x * 0.08, z * 0.08, 341) - 0.5) * 6);
  let rock = Math.max(smoothstep(0.5, 0.9, slope), smoothstep(4, 14, wd) * smoothstep(0.35, 0.65, vnoise(x * 0.05, z * 0.05, 342)) * 0.8);
  // ice: the frozen lake, the falls where the channels cross the faces, the channel banks, patches on the treads
  const lake = x > R.lake.x0 && wd < 2 && x < R.glacier + 2 ? 1 - smoothstep(R.glacier - 6, R.glacier + 2, x) * 0.6 : 0;
  const C = rimeChannel(x, z);
  const fall = onFace(u) ? 1 - smoothstep(3, 5.5, C.d) : 0;
  const bank = (1 - smoothstep(2, 4.5, C.d)) * 0.7 * (x < R.dam.x - R.dam.hw ? 1 : 0);
  const patch = smoothstep(0.66, 0.82, vnoise(x * 0.045, z * 0.045, 343)) * 0.6 * (1 - smoothstep(0, 8, wd)) * (x < R.lake.x0 ? 1 : 0);
  let ice = Math.max(lake, fall, bank, patch);
  // stone paving: the camp square, the ramps, the dam crest
  const cd = Math.hypot(x - R.camp.x, z - R.camp.z) + (vnoise(x * 0.12, z * 0.12, 344) - 0.5) * 5;
  const camp = 1 - smoothstep(R.camp.r * 0.45, R.camp.r * 0.9, cd);
  path = Math.max(path, camp * 0.85);
  let cobble = (1 - smoothstep(7, 9.5, cd)) * smoothstep(0.15, 0.4, vnoise(x * 0.3, z * 0.3, 345) + 0.3);
  for (const P of R.ramps) cobble = Math.max(cobble, 1 - smoothstep(2.2, 3.4, nearest(P, x, z).d));
  if (z > R.dam.z0 - 4 && z < R.dam.z1 + 4) cobble = Math.max(cobble, 1 - smoothstep(R.dam.hw - 0.6, R.dam.hw + 0.2, Math.abs(x - R.dam.x)));
  ice *= (1 - path) * (1 - cobble);
  rock *= (1 - path * 0.6) * (1 - cobble);
  const snow = 1 - sand * 0.85;
  return { sand: clamp(sand, 0, 1), path: clamp(path * (1 - sand * 0.5), 0, 1), rock: clamp(rock, 0, 1), lush: clamp(ice, 0, 1), forest: 0, cobble: clamp(cobble, 0, 1), foundry: 0, snow: clamp(snow, 0, 1), ice: clamp(ice, 0, 1) };
}

// how far past the edge of the walkable valley a point is (0 or less inside): the shore plus a 15 m wade (and the pier), never
// more than 4 m up the walls, never onto the glacier, and never within 15 m of the edge of the box
export function rimeGap(x, z) {
  const R = RIME, P = R.pier;
  let g = rimeShore(x, z) - 15;
  g = Math.min(g, Math.max(P.x0 - x, x - P.x1, P.z0 - z, z - P.z1) - 5.5);
  return Math.max(g, wallD(x, z) - 4, x - (R.glacier - 2), R.minX + 15 - x, R.minZ + 15 - z, x - (R.maxX - 15), z - (R.maxZ - 15));
}
