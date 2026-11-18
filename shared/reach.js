// The Cinder Reach (Part Ten): a volcanic island over the sea north-east of Harrowmouth, with its own terrain box.
// Shared by the server (heights, zones, the edge of the land) and the client (its terrain mesh and splat map).
// It imports only noise.js so terrain.js can import it without a cycle.
//
// Layout (north is -z): the ship comes in from the west to a timber pier on a black-sand beach; the landing camp sits on a low
// shelf above the beach (Ashfall Landing, ash dunes to the north and south). East of the camp the ground climbs in stepped slag
// terraces (the Slag Terraces), and the east third is a high plateau of dark glassy lava with glowing seams, where the Makers'
// old works lie half buried in ash (the Old Works), under a squat cinder cone in the south-east.
import { fbm, ridged, vnoise, smoothstep, lerp, clamp } from './noise.js';

export const REACH = {
  minX: 380, maxX: 680, minZ: -1350, maxZ: -1050,
  water: 0, floor: -6, // the sea surface and the sea floor beyond the shelf
  cx: 530, cz: -1200, ax: 106, az: 102, // the island: centre and half-axes of its outline (before the coastline wobble)
  // the landing pier on the west beach (top is the deck height); the ship berths at its seaward (west) end
  pier: { x0: 394, x1: 432, z0: -1202.4, z1: -1197.6, top: 1.75 },
  berth: { x: 396, z: -1207, ry: Math.PI / 2 }, // where the ship lies along the pier's north side (bow to the east)
  landing: { x: 435, z: -1200 }, // where a crossing sets you down: the beach at the pier's root
  harbour: { x: 429, z: -1198.8, ry: Math.PI / 2 }, // the harbour master, on the deck at the root of the pier
  camp: { x: 463, z: -1200, r: 26, flat: 3.6 }, // Ashfall Landing camp shelf
  grave: { x: 453, z: -1214 }, // where the fallen wake: the north edge of the camp
  caravan: { x: 473, z: -1190 }, // the caravan stop (the island's only one: a recall home, no routes)
  // the half-buried works on the plateau (levelled pads for the client's machinery and ruins)
  works: [{ x: 590, z: -1172, r: 14 }, { x: 594, z: -1224, r: 12 }, { x: 576, z: -1262, r: 11 }],
  cone: { x: 612, z: -1132, r: 40, h: 15 }, // the cinder cone in the south-east, a shallow crater on top
  // the region bands, west to east (on x, wobbled): Ashfall Landing | the Slag Terraces | the Old Works
  bands: [486, 560],
  terrace: { x0: 484, x1: 562, steps: 4, rise: 15.4, base: 3.6 },
  plateau: 19,
  // tracks across the island (polylines [x, z]): the main road east, and a loop south and north through the regions
  paths: [
    [[431, -1200], [463, -1200], [488, -1201], [524, -1198], [562, -1194], [586, -1190], [590, -1172]], // pier, camp, terraces, works
    [[500, -1200], [500, -1160], [496, -1146], [536, -1138], [568, -1150], [590, -1172]], // south: the dunes, the terraces, past the cone ((RF.7) leaves the road square-on, 12 m east of the north track: no X out of the camp; (RF.7 review) east of the camp's south wall, which it ran into at x 476 with the workshop's tank and pipe)
    [[586, -1190], [598, -1206], [594, -1224], [590, -1246], [576, -1262]], // across the plateau between the works
    [[576, -1262], [542, -1264], [504, -1250], [492, -1240], [488, -1228], [488, -1201]], // north: back down the terraces to the camp (a T on the road)
    [[453, -1214], [459, -1206]], // the graveyard to the camp
  ],
};

export const inReach = (x, z, pad = 0) => x >= REACH.minX + pad && x <= REACH.maxX - pad && z >= REACH.minZ + pad && z <= REACH.maxZ - pad;

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}
// distance to the nearest track centre line (with a little meander)
export function reachPathDist(x, z) {
  let best = 1e9;
  for (const P of REACH.paths) for (let i = 0; i < P.length - 1; i++) { const d = segDist(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]); if (d < best) best = d; }
  return best + (vnoise(x * 0.06, z * 0.06, 231) - 0.5) * 2.2;
}

// the coastline: distance past the shore (negative on land). The outline is an ellipse with a wobbling coast, kept smooth
// along the west beach so the landing is a long even strand.
export function reachShore(x, z) {
  const R = REACH;
  if (Math.abs(x - R.cx) + Math.abs(z - R.cz) < 1e-3) x = R.cx + 1e-3; // the very centre has no direction
  const dx = (x - R.cx) / R.ax, dz = (z - R.cz) / R.az, a = Math.atan2(dz, dx);
  const ca = Math.cos(a), sa = Math.sin(a);
  let wob = (vnoise(ca * 1.7 + 7, sa * 1.7 + 7, 201) - 0.5) * 34 + (vnoise(ca * 4.3 + 3, sa * 4.3 + 3, 202) - 0.5) * 9;
  const west = 1 - smoothstep(0.25, 0.7, Math.abs(Math.atan2(sa, -ca))); // 1 facing due west (the beach)
  wob *= 1 - west * 0.92;
  const rad = Math.hypot(dx * R.ax, dz * R.az) / Math.max(1e-6, Math.hypot(dx, dz)); // the ellipse radius in this direction
  return Math.hypot(x - R.cx, z - R.cz) - (rad + wob);
}

// which region a point lies in, as a value along the bands (wobbled x)
const bandX = (x, z) => x + (vnoise(x * 0.006, z * 0.018, 211) - 0.5) * 22 + (vnoise(x * 0.03, z * 0.03, 210) - 0.5) * 3;
export function reachZone(x, z) {
  const u = bandX(x, z);
  return u < REACH.bands[0] ? 'ashfall' : u < REACH.bands[1] ? 'slagterraces' : 'oldworks';
}

// the climb from the camp shelf to the plateau: an even grade, and the same climb as four stepped slag terraces
function terraceT(x, z) { const T = REACH.terrace; return clamp((bandX(x, z) - T.x0) / (T.x1 - T.x0), 0, 1); }
function terraceSmooth(t) { const T = REACH.terrace; return T.base + T.rise * t; }
function terraceStepped(t) {
  const T = REACH.terrace, s = t * T.steps, k = Math.floor(Math.min(s, T.steps - 1e-6)), f = s - k;
  // each step: a level tread, then a slag face over the last half of its width (about 10 m for a 3.9 m rise)
  return T.base + (T.rise / T.steps) * (k + smoothstep(0.5, 1, f));
}

// the land before the coast cuts it: shelf, dunes, terraces, plateau, lava fields, works pads and the cone
function inland(x, z) {
  const R = REACH;
  const t = terraceT(x, z);
  let h = terraceStepped(t) + (vnoise(x * 0.07, z * 0.07, 212) - 0.5) * 0.5;
  // the west shelf: ash dunes north and south of the camp, long ridges running north-south, crossed by ripples
  const west = 1 - smoothstep(464, 492, bandX(x, z));
  if (west > 0) {
    const dune = ridged(x * 0.012 + vnoise(x * 0.01, z * 0.01, 213) * 1.1, z * 0.024, 3, 214);
    const away = smoothstep(R.camp.r * 0.8, R.camp.r * 1.6, Math.hypot(x - R.camp.x, z - R.camp.z));
    h += dune * 5.2 * away * west;
  }
  // the east plateau: dark lava fields, low bumpy flows with glassy ridges
  const east = smoothstep(548, 572, bandX(x, z));
  if (east > 0) {
    const flow = (fbm(x * 0.035, z * 0.035, 3, 215) - 0.5) * 3.2 + ridged(x * 0.05, z * 0.05, 2, 216) * 1.2;
    h = lerp(h, R.plateau + flow, east);
  }
  // terrace treads carry heaps of slag and ash drifts
  const mid = smoothstep(480, 494, bandX(x, z)) * (1 - east);
  if (mid > 0) h += (ridged(x * 0.08, z * 0.08, 2, 217) - 0.3) * 0.7 * mid;
  // the cinder cone: a broad squat mound with a shallow crater
  const C = R.cone, cd = Math.hypot(x - C.x, z - C.z) + (vnoise(x * 0.05, z * 0.05, 218) - 0.5) * 6;
  if (cd < C.r) {
    const k = 1 - smoothstep(0, C.r, cd);
    h += C.h * k * k * (3 - 2 * k) * 0.5 + C.h * 0.5 * k - (1 - smoothstep(0, C.r * 0.22, cd)) * 4.5;
  }
  // the tracks: through the terraces they climb the even grade instead of the steps, and they are a touch sunk
  const pd = reachPathDist(x, z);
  if (pd < 9) {
    const k = 1 - smoothstep(3.2, 9, pd);
    if (t > 0 && t < 1 && east < 1) h = lerp(h, terraceSmooth(t) + (vnoise(x * 0.07, z * 0.07, 212) - 0.5) * 0.3, k * (1 - east));
    h -= (1 - smoothstep(1.2, 5, pd)) * 0.15;
  }
  // levelled ground: the camp shelf and the works pads
  const cd2 = Math.hypot(x - R.camp.x, z - R.camp.z);
  if (cd2 < R.camp.r) h = lerp(h, R.camp.flat + (vnoise(x * 0.06, z * 0.06, 219) - 0.5) * 0.35, 1 - smoothstep(R.camp.r * 0.55, R.camp.r, cd2));
  for (const W of R.works) {
    const d = Math.hypot(x - W.x, z - W.z);
    if (d < W.r * 1.5) h = lerp(h, R.plateau - 0.6 + (vnoise(x * 0.1, z * 0.1, 220) - 0.5) * 0.3, 1 - smoothstep(W.r * 0.7, W.r * 1.5, d));
  }
  return h;
}

// ground height: the land, the black-sand beach and the shelf under the sea, down to the sea floor at the edge of the box
export function reachHeight(x, z) {
  const R = REACH, s = reachShore(x, z);
  let h;
  if (s >= 0) h = R.floor * smoothstep(0, 26, s);
  else {
    const H = inland(x, z), beach = 1.6 * smoothstep(0, -14, s);
    // low ground runs down to a black-sand beach; the high plateau ends in basalt sea cliffs
    const st = -2 - 9 * (1 - smoothstep(4.5, 8, H)); // a wide strand below low ground, cliffs straight off the shore below high ground
    h = lerp(beach, Math.max(H, beach), smoothstep(st, st - (12 + Math.max(0, H - 4) * 1.0), s));
  }
  // nothing but sea floor at the very edge of the box (the island's sea sheet covers the rest)
  const edge = Math.min(x - R.minX, R.maxX - x, z - R.minZ, R.maxZ - z);
  if (edge < 12) h = lerp(R.floor, h, smoothstep(0, 12, edge));
  return h;
}

// the landing pier (absolute deck height), else -Infinity
export function reachDeck(x, z) {
  const P = REACH.pier;
  return x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1 ? P.top : -Infinity;
}

// the sea round the island: its surface height, or null
export function reachWater(x, z) { return reachHeight(x, z) < REACH.water - 0.25 ? REACH.water : null; }

// the seams follow the 0.5 contour of one noise field. Where the field has a saddle near 0.5 the contour crosses itself into
// a four-armed shape that reads as a cross from above. The field is flat at a saddle, so the seams fade out wherever its
// slope is low: the arms then stop short of each other (this also opens some of the smallest rings round low humps).
const veinRaw = (x, z) => fbm(x * 0.045, z * 0.045, 3, 239);
function veinSlope(x, z) { return Math.hypot(veinRaw(x + 0.5, z) - veinRaw(x - 0.5, z), veinRaw(x, z + 0.5) - veinRaw(x, z - 0.5)); }

// ground paint, the same shape as groundAt's. On the island the channels mean: sand = black sand and ash, rock = basalt and
// slag faces, foundry = soot, path = tracks and the camp's trodden ground, cobble = the camp's stone paving. lush carries the
// glowing seams in the lava (also given as seam); forest and snow are 0.
export function reachGround(x, z) {
  const R = REACH, s = reachShore(x, z), h = reachHeight(x, z), u = bandX(x, z);
  const e = 1.0, gx = (reachHeight(x + e, z) - reachHeight(x - e, z)) / (2 * e), gz = (reachHeight(x, z + e) - reachHeight(x, z - e)) / (2 * e);
  const slope = Math.hypot(gx, gz);
  const pd = reachPathDist(x, z);
  let path = 1 - smoothstep(1.8, 4.2, pd);
  // black sand on the beaches and under the sea, ash on the dunes and in drifts across the treads
  let sand = 1 - smoothstep(9, 18, -s + (vnoise(x * 0.08, z * 0.08, 232) - 0.5) * 6);
  sand = Math.max(sand, (1 - smoothstep(464, 494, u)) * 0.9);
  sand = Math.max(sand, smoothstep(0.55, 0.75, vnoise(x * 0.04, z * 0.04, 233)) * 0.7 * (1 - smoothstep(548, 576, u)));
  // basalt on every steep face (terrace fronts, the cone, the sea cliffs) and on the lava plateau
  const east = smoothstep(546, 574, u);
  let rock = Math.max(smoothstep(0.32, 0.6, slope), east * smoothstep(0.25, 0.5, vnoise(x * 0.05, z * 0.05, 234) * 0.6 + 0.35));
  // soot round the works and blown across the plateau, and in the camp
  let foundry = 0;
  for (const W of R.works) foundry = Math.max(foundry, 1 - smoothstep(W.r * 0.6, W.r * 1.6, Math.hypot(x - W.x, z - W.z) + (vnoise(x * 0.1, z * 0.1, 235) - 0.5) * 6));
  foundry = Math.max(foundry, east * smoothstep(0.55, 0.8, vnoise(x * 0.07, z * 0.07, 236)) * 0.7);
  // camp: packed ground, a small paved square in its middle
  const cd = Math.hypot(x - R.camp.x, z - R.camp.z) + (vnoise(x * 0.12, z * 0.12, 237) - 0.5) * 5;
  const camp = 1 - smoothstep(R.camp.r * 0.45, R.camp.r * 0.9, cd);
  path = Math.max(path, camp * 0.85);
  let cobble = (1 - smoothstep(8, 10.5, cd)) * smoothstep(0.15, 0.4, vnoise(x * 0.3, z * 0.3, 238) + 0.3);
  // glowing seams: thin veins through the lava fields, never on the tracks or under the sand
  const vein = 1 - Math.abs(veinRaw(x, z) * 2 - 1);
  let seam = smoothstep(0.972, 0.992, vein) * east * (1 - path) * (1 - smoothstep(0.3, 0.6, sand)) * (s < -4 ? 1 : 0);
  if (seam > 0) seam *= smoothstep(0.014, 0.022, veinSlope(x, z));
  sand *= 1 - camp * 0.7;
  rock *= 1 - path * 0.6;
  return { sand: clamp(sand, 0, 1), path: clamp(path * (1 - sand * 0.5), 0, 1), rock: clamp(rock, 0, 1), lush: seam, forest: 0, cobble: clamp(cobble, 0, 1), foundry: clamp(foundry, 0, 1), snow: 0, seam };
}

// how far past the edge of the walkable island a point is (0 or less inside): the shore plus a 15 m wade, the pier deck,
// and never within 15 m of the edge of the box
export function reachGap(x, z) {
  const R = REACH, P = R.pier;
  let g = reachShore(x, z) - 15;
  g = Math.min(g, Math.max(P.x0 - x, x - P.x1, P.z0 - z, z - P.z1) - 5.5);
  return Math.max(g, R.minX + 15 - x, R.minZ + 15 - z, x - (R.maxX - 15), z - (R.maxZ - 15));
}
