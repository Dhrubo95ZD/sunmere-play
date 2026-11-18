// World shape: height field, zones, roads and ground-type weights.
// Used by the server (mob movement, spawn heights) and the client (terrain mesh, splat map, collisions).
import { fbm, ridged, vnoise, smoothstep, lerp, clamp } from './noise.js';
import { DUNGEON_MIN_X, dungeonAt, dungeonArea } from './dungeons.js';
import { REACH, inReach } from './reach.js';
import { RIME, inRime } from './rime.js';
import { HEIGHTS, inHeights } from './heights.js';
import { TIDEWATER, inTidewater } from './tidewater.js';
import { RAINWARD, inRainward } from './rainward.js';
import { WEALD, inWeald } from './weald.js';
import { AREAS, AREA_BY_ID, islandAt } from './areas.js';
import { houseFloor } from './houses.js'; // a circular import: houses.js reads heightAt / islandAt only when first asked
export { REACH, inReach, RIME, inRime, HEIGHTS, inHeights, TIDEWATER, inTidewater, RAINWARD, inRainward, WEALD, inWeald, AREAS, AREA_BY_ID, islandAt };

// The overworld is a rectangle: the old 640 m valley (-320..320) plus a strip to the north-west (to -440) where a pass
// climbs through the mountains to the far valley (Part Four). The origin stays put, so every coordinate in the data holds.
// size is the longest side (the maps are square). There is deliberately no 'half': nothing may assume a centred world.
export const WORLD = { minX: -440, maxX: 470, minZ: -440, maxZ: 480, size: 920, water: 0 };
// Part Six: a gap south from Dunewatch Post through the mountains to the salt flats (the Glass Waste, z ~352..470)
export const SOUTH_PASS = { pts: [[-38, 214], [-33, 244], [-27, 272], [-20, 300], [-14, 328], [-10, 352]], floor: 8, wall: 22, approach: [[-40, 190], [-38, 214]] };
export const FLATS = { x: -20, z: 401, hx: 150, hz: 49, wall: 30, top: 3.2 };
// Part Seven: the Scrapway, a pass east out of the Highreach past Cragborn Camp, to the Wildworks basin in the north-east corner
export const NE_PASS = { pts: [[166, -236], [200, -256], [240, -280], [275, -300], [308, -322]], floor: 8, wall: 22 };
export const WILD = { x: 372, z: -356, hx: 64, hz: 52, wall: 30, top: 21 };
// Part Five: a gap through the east mountains past the Eastreach Hills, down to the Harrow Coast and the sea (x > ~430)
export const EAST_PASS = { pts: [[262, 48], [288, 46], [314, 43], [342, 40]], floor: 8, wall: 22, approach: [[214, 58], [240, 52], [262, 48]] };
export const COAST = { x: 410, z: 40, hx: 70, hz: 150, wall: 30, top: 4.6 };
// walkable timber decks over the water: Harrowmouth's pier (top is the deck height)
export const PIERS = [{ x0: 404, x1: 452, z0: 77.6, z1: 82.4, top: 1.75 }];
// the far valley beyond the north-west pass, and the pass itself (a polyline from the Coilway up to the valley rim)
export const FARSIDE = { x: -352, z: -352, r: 56, wall: 30, lift: 16 };
export const NW_PASS = { pts: [[-256, -222], [-274, -242], [-292, -264], [-308, -288], [-320, -310]], floor: 7, wall: 22, approach: [[-232, -203], [-244, -207], [-256, -222]] };

// North is -z. Flat areas where settlements sit.
export const ZONES = [
  { id: 'village', name: 'Sunmere Village', x: 0, z: -4, r: 96, flat: 4.0, level: '1-5' },
  { id: 'fields', name: 'Brightfield Farms', x: 100, z: 12, r: 40, flat: 4.6, level: '2-4' },
  { id: 'briarhold', name: 'Briarhold', x: -124, z: -16, r: 30, flat: 8.8, level: '3-5' },
  { id: 'greenwood', name: 'The Greenwood', x: -80, z: -70, r: 0, lx: -66, lz: -60, level: '3-5' },
  { id: 'glade', name: 'Glimmer Glade', x: 145, z: -148, r: 58, flat: 2.6, level: '5-8' },
  { id: 'quarry', name: 'Ironcliff Quarry', x: 194, z: -32, r: 48, flat: 5.5, lx: 192, lz: -64, level: '7-10' },
  { id: 'dunewatch', name: 'Dunewatch Post', x: -40, z: 172, r: 32, flat: 5.0, level: '10-12' },
  { id: 'sunscar', name: 'Sunscar Expanse', x: 60, z: 200, r: 0, level: '10-13' },
  { id: 'brasswind', name: 'Brasswind Dig', x: 196, z: 148, r: 30, flat: 7.6, level: '12-14' },
  { id: 'vaultruins', name: 'Sandsunk Ruins', x: -148, z: 202, r: 28, flat: 4.9, level: '13-14' },
  { id: 'raidercamp', name: 'Dustcloak Camp', x: 112, z: 232, r: 44, flat: 4.2, level: '13-15' },
  { id: 'foundrywatch', name: 'Foundry Watch', x: -104, z: -110, r: 16, flat: 4.3, lx: -92, lz: -112, level: '15' },
  { id: 'rustwood', name: 'Rustwood', x: -160, z: -80, r: 0, lx: -172, lz: -100, level: '15-17' },
  { id: 'sawmill', name: 'The Old Sawmill', x: -205, z: -62, r: 24, flat: 7.6, lx: -222, lz: -54, level: '15-17' },
  { id: 'foundry', name: 'Old Foundry', x: -150, z: -150, r: 44, flat: 7.5, level: '16-19' },
  { id: 'westfold', name: 'Westfold Farmsteads', x: -196, z: 40, r: 30, flat: 8.8, level: '6-8' },
  { id: 'northwatch', name: 'Northwatch Keep', x: 6, z: -206, r: 26, flat: 3.9, level: '17-19' },
  { id: 'eastreach', name: 'Eastreach Hills', x: 215, z: 60, r: 0, level: '8-12' },
  // Part Three: the flats at the foot of the north-west pass, where the Brass Concord keeps its depot (level 25)
  { id: 'coilway', name: 'The Coilway', x: -213, z: -215, r: 46, flat: 5.4, level: '25' },
  // the Highreach: the high plateau above the glade waterfall (20-25)
  { id: 'highreach', name: 'The Highreach', x: 150, z: -222, r: 0, lx: 150, lz: -262, level: '20-25' },
  { id: 'lookout', name: 'Highreach Lookout', x: 108, z: -210, r: 14, flat: 24.4, late: true, lx: 126, lz: -184, level: '20' },
  { id: 'coilfields', name: 'The Coilfields', x: 186, z: -216, r: 22, level: '21-23', nomap: true },
  { id: 'cragcamp', name: 'Cragborn Camp', x: 148, z: -232, r: 16, flat: 23.2, late: true, level: '22-24', nomap: true },
  // Part Four: the climb through the north-west mountains and the high valley beyond
  { id: 'nwpass', name: 'The Brasswork Pass', x: -288, z: -262, r: 0, lx: -290, lz: -262, level: '25' },
  { id: 'farside', name: 'The Far Vale', x: -352, z: -352, r: 0, lx: -352, lz: -360, level: '25-30' },
  { id: 'saltgap', name: 'The Saltgap', x: 300, z: 45, r: 0, lx: 300, lz: 34, level: '28' },
  { id: 'homestead', name: 'Your Homestead', x: -32, z: 90, r: 13, flat: 5.2, level: '' },
  { id: 'scrapwatch', name: 'Scrapway Watch', x: 322, z: -330, r: 11, flat: 21.2, level: '35' },
  { id: 'scrapway', name: 'The Scrapway', x: 240, z: -280, r: 0, lx: 240, lz: -270, level: '35' },
  { id: 'wildworks', name: 'The Wildworks', x: 372, z: -356, r: 0, lx: 372, lz: -350, level: '35' },
  { id: 'sunpass', name: 'The Sunward Pass', x: -24, z: 290, r: 0, lx: -24, lz: 286, level: '30' },
  { id: 'saltcamp', name: 'Saltpan Camp', x: -40, z: 385, r: 14, flat: 3.5, level: '31-34' },
  { id: 'kilnworks', name: 'The Kilnworks', x: 70, z: 412, r: 24, flat: 3.4, level: '31-33' },
  { id: 'glasswaste', name: 'The Glass Waste', x: -20, z: 412, r: 0, lx: -20, lz: 404, level: '30-35' },
  { id: 'harrowcoast', name: 'The Harrow Coast', x: 400, z: 40, r: 0, lx: 392, lz: 10, level: '28-30' },
  { id: 'harrowmouth', name: 'Harrowmouth', x: 385, z: 80, r: 22, flat: 4.0, level: '28-30' },
  { id: 'guildyards', name: 'The Guild Yards', x: 385, z: -50, r: 24, flat: 3.8, level: '29-30' },
  { id: 'passwatch', name: 'Pass Watch', x: -338, z: -318, r: 11, flat: 22.3, lx: -338, lz: -306, level: '26' },
  { id: 'ledgerholm', name: 'Ledgerholm', x: -378, z: -380, r: 22, flat: 20.8, level: '27-28' },
  // Part Ten: the Cinder Reach, an island with its own terrain box (shared/reach.js). r 0: the valley loops never touch them
  { id: 'ashfall', name: 'Ashfall Landing', area: 'reach', x: 456, z: -1200, r: 0, lx: 462, lz: -1214, level: '40-41' },
  { id: 'slagterraces', name: 'The Slag Terraces', area: 'reach', x: 532, z: -1200, r: 0, lx: 532, lz: -1206, level: '42-43' },
  { id: 'oldworks', name: 'The Old Works', area: 'reach', x: 605, z: -1205, r: 0, lx: 606, lz: -1206, level: '44-45' },
  // Part Eleven: the Rime Steps, a glacier valley north of the Reach with its own terrain box (shared/rime.js)
  { id: 'icefall', name: 'The Icefall Landing', area: 'rime', x: 458, z: -1650, r: 0, lx: 462, lz: -1662, level: '45-46' },
  { id: 'flumeworks', name: 'The Flume Works', area: 'rime', x: 538, z: -1648, r: 0, lx: 536, lz: -1652, level: '47-48' },
  { id: 'damcrown', name: 'The Dam Crown', area: 'rime', x: 622, z: -1650, r: 0, lx: 624, lz: -1656, level: '49-50' },
  // Part Twelve: the Windward Heights, a plateau above the Rime Steps' glacier with its own terrain box (shared/heights.js)
  { id: 'driftfields', name: 'The Drift Fields', area: 'heights', x: 470, z: -2100, r: 0, lx: 474, lz: -2112, level: '50-51' },
  { id: 'enginerows', name: 'The Engine Rows', area: 'heights', x: 545, z: -2100, r: 0, lx: 545, lz: -2112, level: '52-53' },
  { id: 'makersrest', name: 'The Makers’ Rest', area: 'heights', x: 626, z: -2100, r: 0, lx: 620, lz: -2110, level: '54-55' },
  // Part Thirteen: Tidewater Sound, an inlet with the Makers' yards and its own terrain box (shared/tidewater.js)
  { id: 'ropewalkshore', name: 'The Ropewalk Shore', area: 'tidewater', x: 470, z: -2600, r: 0, lx: 470, lz: -2612, level: '55-56' },
  { id: 'tidemills', name: 'The Tide Mills', area: 'tidewater', x: 545, z: -2620, r: 0, lx: 545, lz: -2636, level: '57-58' },
  { id: 'seagate', name: 'The Sea Gate', area: 'tidewater', x: 624, z: -2610, r: 0, lx: 624, lz: -2620, level: '59-60' },
  // Part Fourteen: the Rainward Gorge, a deep wet gorge inland of the Sound with its own terrain box (shared/rainward.js)
  { id: 'gorgefoot', name: 'The Gorge Foot', area: 'rainward', x: 428, z: -2990, r: 0, lx: 428, lz: -3010, level: '60-61' },
  { id: 'seedterraces', name: 'The Seed Terraces', area: 'rainward', x: 528, z: -3000, r: 0, lx: 528, lz: -3012, level: '62-63' },
  { id: 'slip', name: 'The Slip', area: 'rainward', x: 622, z: -3010, r: 0, lx: 622, lz: -3020, level: '64-65' },
  // Part Fifteen: the Russet Weald, an old autumn hardwood forest over the ridge with its own terrain box (shared/weald.js)
  { id: 'ropewayfoot', name: 'The Ropeway Foot', area: 'weald', x: 432, z: -3420, r: 0, lx: 432, lz: -3438, level: '65-66' },
  { id: 'longsheds', name: 'The Long Sheds', area: 'weald', x: 532, z: -3480, r: 0, lx: 532, lz: -3462, level: '67-68' },
  { id: 'standards', name: 'The Standards', area: 'weald', x: 622, z: -3500, r: 0, lx: 622, lz: -3482, level: '69-70' },
];
// which outdoor area a point belongs to: the dungeons (x 700 and on), one of the island-style AREAS ('reach', 'rime', 'heights'), or the valley.
// Nothing walks between areas: they change only by teleport (doors, the ship, the compass, caravans)
export const areaOf = (x, z) => (x >= DUNGEON_MIN_X ? 'dungeon' : islandAt(x, z)?.id || 'valley');

export const LAKE = { x: 150, z: -160, r: 24 };
// Ironcliff Quarry: a stepped pit (rim, two terraces, floor) with a cut ramp from the camp on the west side
export const QUARRY = { x: 208, z: -36, rings: [22, 15, 8.5], drop: 1.9, ramp: { x0: 183, x1: 201, z: -36, w: 2.4 } };
export const WATERFALL = { x: 150, z: -187, top: 22.4 };

// ---------------------------------------------------------------- Sunmere Village layout
// Square fountain plaza in the middle; the guild hall stands north on a raised terrace reached by a grand
// two-flight staircase; the market lines the south avenue down to the gate; a stream runs from a spring
// fall in the west, past the forge's waterwheel, under three flat beam bridges and into a pond by the farms.
export const VILLAGE = {
  plaza: { x: 0, z: 0, r: 15 },
  terrace: { x0: -19, x1: 19, z0: -58, z1: -31, top: 7.7 }, // z1 is the front (south) edge
  stairs: { w: 8, top: -31, landing0: -26.6, landing1: -25.2, bottom: -20.8 },
  gate: { x: 0, z: 46 },
  // area kept free of wild scatter (trees, rocks): an ellipse around the built-up village
  clear: { x: 4, z: -6, rx: 72, rz: 62 },
};
export const STREAM = {
  pts: [[-66, -8], [-58, -3], [-48, 4], [-38, 14], [-26, 23], [-12, 29], [0, 30], [14, 29], [28, 24], [40, 17], [49, 6], [58, -4], [68, -10], [75, -17]],
  // water level along the stream (arc length, height): two small falls, one turns the forge's waterwheel
  levels: [[0, 3.7], [21, 3.7], [25, 3.05], [108, 3.05], [112, 2.5], [1e4, 2.5]],
  pond: { x: 78, z: -21, r: 7 },
};
// stone beam bridges: a -> b along the deck, width w, rise above the end heights (0 = level, no arch)
export const BRIDGES = [
  // rise 0: level beam bridges (a straight deck from bank to bank, no hump)
  { a: [0, 24.6], b: [0, 35.4], w: 5.2, rise: 0 },
  { a: [43.4, 4.66], b: [53.6, 6.7], w: 4.4, rise: 0 },
  { a: [-29.0, 14.5], b: [-35.0, 22.5], w: 2.6, rise: 0 },
];

// Roads as polylines [x, z] (dirt tracks, cobbled near the village)
export const ROADS = [
  [[0, -15], [0, -21]], // plaza to the hall stairs
  [[0, 15], [0, 50], [-4, 64], [-14, 100], [-30, 140], [-40, 168]], // south avenue, gate, road to the desert outpost
  [[15, 0], [40, 4], [70, 10], [100, 12]], // east road to the farms (over the east bridge)
  [[-15, 0], [-30, -1], [-40, 1]], // west lane to the forge
  // (RF.7) only the four square-on roads leave the plaza (N, S, E, W); the lanes that ran out of it diagonally (an X from
  // straight above) now leave the west and east roads square-on at T junctions, the north and south ones offset by 10 m
  [[-20, -0.33], [-20, -16], [-34, -30]], // north-west lane to the ranger lodge (off the west lane)
  [[-34, -30], [-50, -60], [-62, -88], [-96, -118], [-138, -142]], // on to the foundry
  [[22, 1.12], [22, -24], [42, -46], [70, -88], [112, -126], [140, -140]], // north-east road to the glade (off the east road)
  [[-30, -1], [-29, 14.5]], // south-west lane to the footbridge (off the west lane)
  [[-35, 22.5], [-42, 33]], // and on to the cottages
  [[-35, 22.5], [-44, 18.5], [-50.5, 15.5]], // and along the bank to Sunmere Mill
  [[-40, 186], [0, 196], [56, 216], [104, 228]], // outpost to raider camp ((RF.7) off the south road below the post, a T 14 m from the west road's)
  [[100, 12], [128, 6], [152, -10], [172, -26], [183, -36]], // farms to Ironcliff Quarry
  [[-50.5, 15.5], [-72, 12], [-96, 0], [-112, -10]], // west road from the mill to Briarhold
  [[-62, -88], [-100, -74], [-150, -66], [-190, -62]], // the Rustwood road to the Old Sawmill
  [[140, -140], [162, -112], [178, -82], [178, -52]], // Glimmer Glade to Ironcliff Quarry
  [[152, -10], [178, 30], [194, 80], [196, 128]], // the quarry road south to Brasswind Dig
  [[196, 128], [176, 176], [148, 212]], // and on to Dustcloak Camp
  [[-40, 172], [-80, 186], [-116, 196], [-140, 206]], // Dunewatch to the Sandsunk Ruins
  [[-138, -142], [-130, -156], [-125, -164]], // across the foundry yard to the Depths hatch
  [[-112, -10], [-150, 12], [-184, 30]], // Briarhold on to the Westfold farmsteads
  [[-140, -23], [-146, -26]], // out of Briarhold's back gate to the Warrens
  [[-96, -118], [-60, -160], [-24, -190], [2, -198]], // Foundry Watch to Northwatch Keep
  [[140, -140], [118, -150], [100, -164], [88, -182], [84, -196], [92, -206], [108, -208]], // up from the glade to Highreach Lookout
  [[2, -198], [40, -206], [70, -206], [92, -206]], // Northwatch Keep east along the ridge to the lookout
  [[108, -208], [130, -222], [146, -230]], // the lookout to Cragborn Camp
  [[108, -208], [150, -208], [182, -214]], // and out to the Coilfields
  [[-150, -66], [-172, -96], [-180, -128], [-182, -160], [-186, -184], [-204, -204], [-220, -222]], // the Coilway road, north-west past the foundry (Part Three)
  [[-220, -222], [-232, -233], [-240, -240]], // through the depot to the Strongrooms door
  [[-204, -204], [-226, -201], [-244, -207], [-256, -222], [-274, -242], [-292, -264], [-308, -288], [-320, -310], [-336, -332]], // round the depot and up the Brasswork Pass to the Far Vale (Part Four)
  [[-336, -332], [-350, -348], [-362, -362], [-368, -368]], // across the Far Vale to the gate of Ledgerholm
  [[186, 56], [214, 58], [240, 52], [262, 48], [288, 46], [314, 43], [342, 40], [372, 38]], // east from the Eastreach road through the Saltgap to the Harrow Coast (Part Five)
  [[372, 38], [380, 58], [384, 70]], // up the coast to the gate of Harrowmouth
  [[-40, 172], [-40, 190], [-38, 214], [-33, 244], [-27, 272], [-20, 300], [-14, 328], [-10, 352], [-8, 380]], // south from Dunewatch Post over the Sunward Pass to the Glass Waste (Part Six)
  [[-8, 380], [-28, 384]], // into Saltpan Camp
  [[-12.6, 95], [-24, 92]], // the path to your homestead
  [[150, -226], [166, -236], [200, -256], [240, -280], [275, -300], [308, -322], [336, -340]], // east out of the Highreach along the Scrapway to the Wildworks (Part Seven)
  [[-8, 380], [20, 396], [48, 406]], // across the pan to the Kilnworks gate
  [[372, 38], [378, 6], [384, -28]], // down the coast to the Guild Yards
];

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return Math.sqrt(qx * qx + qz * qz);
}

// Distance to the nearest road centre line (with a little meander from noise).
export function roadDist(x, z) {
  const wob = (vnoise(x * 0.05, z * 0.05, 91) - 0.5) * 3.0;
  let best = 1e9;
  for (const r of ROADS) {
    for (let i = 0; i < r.length - 1; i++) {
      const d = segDist(x, z, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]);
      if (d < best) best = d;
    }
  }
  return best + wob;
}

// where a point stands against the north-west pass: distance to its centre line, and how far along (0 at the foot, 1 at the top)
export function passInfo(x, z, P = NW_PASS.pts) {
  let best = 1e9, bt = 0, run = 0, total = 0;
  for (let i = 0; i < P.length - 1; i++) total += Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (L * L), 0, 1);
    const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
    if (d < best) { best = d; bt = (run + t * L) / total; }
    run += L;
  }
  return { d: best, t: bt };
}
// the value the mountain ring is built on: the old max(|x|,|z|) everywhere, except that in the north-west the far valley and the
// pass cut through it (a min can only lower it, so outside the cut nothing changes, and outside the north-west box nothing at all)
// the cut the pass makes: distance to the pass line or to the approach road leading to its foot
function passCut(x, z) {
  const A = NW_PASS.approach;
  let d = passInfo(x, z).d;
  for (let i = 0; i < A.length - 1; i++) d = Math.min(d, segDist(x, z, A[i][0], A[i][1], A[i + 1][0], A[i + 1][1]));
  return d;
}
export function edgeE(x, z) {
  const e = Math.max(Math.abs(x), Math.abs(z));
  if (inEastBox(x, z)) { const [ec, ep] = eastCut(x, z); return Math.min(e, ec, ep); }
  if (inSouthBox(x, z)) { const [ef, ep] = southCut(x, z); return Math.min(e, ef, ep); }
  if (inNEBox(x, z)) { const [ew, ep] = neCut(x, z); return Math.min(e, ew, ep); }
  if (x > -200 || z > -200) return e;
  const F = FARSIDE, dv = Math.hypot(x - F.x, z - F.z);
  const ev = 222 + Math.max(0, dv - F.r) / F.wall * 82;
  const ep = 222 + Math.max(0, passCut(x, z) - NW_PASS.floor) / NW_PASS.wall * 82;
  return Math.min(e, ev, ep);
}
// the north-east box: the only place the Scrapway and the Wildworks basin touch the ring
const inNEBox = (x, z) => x > 110 && z < -200; // the pass cut (behind its start at x 166 too) fades out well inside
export function wildSdf(x, z) {
  const dx = Math.abs(x - WILD.x) - WILD.hx, dz = Math.abs(z - WILD.z) - WILD.hz;
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
}
function neCut(x, z) {
  const ew = 222 + Math.max(0, wildSdf(x, z)) / WILD.wall * 82;
  return [ew, 222 + Math.max(0, passInfo(x, z, NE_PASS.pts).d - NE_PASS.floor) / NE_PASS.wall * 82];
}
// how much a point belongs to the Wildworks basin (1 on its floor)
export function wildWeight(x, z) { return inNEBox(x, z) ? 1 - smoothstep(-4, WILD.wall * 0.5, wildSdf(x, z)) : 0; }
// the south box: the only place the Sunward Pass and the salt flats touch the ring
const inSouthBox = (x, z) => z > 212 && x > -200 && x < 200;
export function flatsSdf(x, z) {
  const dx = Math.abs(x - FLATS.x) - FLATS.hx, dz = Math.abs(z - FLATS.z) - FLATS.hz;
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
}
function southCut(x, z) {
  const ef = 222 + Math.max(0, flatsSdf(x, z)) / FLATS.wall * 82;
  const A = SOUTH_PASS.approach;
  let d = passInfo(x, z, SOUTH_PASS.pts).d;
  for (let i = 0; i < A.length - 1; i++) d = Math.min(d, segDist(x, z, A[i][0], A[i][1], A[i + 1][0], A[i + 1][1]));
  return [ef, 222 + Math.max(0, d - SOUTH_PASS.floor) / SOUTH_PASS.wall * 82];
}
// how much a point belongs to the salt flats (1 on the flats, 0 in the mountains and the old valley)
export function flatsWeight(x, z) { return inSouthBox(x, z) ? 1 - smoothstep(-4, FLATS.wall * 0.5, flatsSdf(x, z)) : 0; }
// the east box: the only place the Saltgap and the coast basin touch the ring
const inEastBox = (x, z) => x > 212 && z > -200 && z < 260;
// signed distance from the coast basin (a box 140 x 300 m, negative inside)
export function coastSdf(x, z) {
  const dx = Math.abs(x - COAST.x) - COAST.hx, dz = Math.abs(z - COAST.z) - COAST.hz;
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
}
function eastCut(x, z) {
  const ec = 222 + Math.max(0, coastSdf(x, z)) / COAST.wall * 82;
  const A = EAST_PASS.approach;
  let d = passInfo(x, z, EAST_PASS.pts).d;
  for (let i = 0; i < A.length - 1; i++) d = Math.min(d, segDist(x, z, A[i][0], A[i][1], A[i + 1][0], A[i + 1][1]));
  const ep = 222 + Math.max(0, d - EAST_PASS.floor) / EAST_PASS.wall * 82;
  return [ec, ep];
}
// how much a point belongs to the coast (1 on the plain, 0 in the mountains and the old valley)
export function coastWeight(x, z) { return inEastBox(x, z) ? 1 - smoothstep(-4, COAST.wall * 0.5, coastSdf(x, z)) : 0; }
// the far valley is high ground: it and the upper pass are lifted, the pass climbing steadily from the Coilway
export function farsideLift(x, z) {
  if (x > -200 || z > -200) return 0;
  const F = FARSIDE, core = 1 - smoothstep(F.r, F.r + F.wall, Math.hypot(x - F.x, z - F.z));
  const p = passInfo(x, z), lane = (1 - smoothstep(NW_PASS.floor, NW_PASS.floor + NW_PASS.wall, p.d)) * clamp((p.t - 0.05) / 0.95, 0, 1); // an even climb
  return F.lift * Math.max(core, lane);
}
// can anyone stand here? The mountains are walkable up to the old 305 line, except in the north-west, where only the old valley,
// the pass corridor and the far valley are: nobody climbs over the ridge round the pass.
// worldGap is how far past that edge a point is (0 or less inside); in the north-west it is the least of the three ways in
export function worldGap(x, z) {
  { const I = x < DUNGEON_MIN_X && islandAt(x, z); if (I) return I.gap(x, z); }
  const e = Math.max(Math.abs(x), Math.abs(z));
  let g;
  if (x < -200 && z < -200) {
    const F = FARSIDE, ev = 222 + Math.max(0, Math.hypot(x - F.x, z - F.z) - F.r) / F.wall * 82, ep = 222 + Math.max(0, passCut(x, z) - NW_PASS.floor) / NW_PASS.wall * 82;
    g = Math.min(e - (305 - 20 * smoothstep(-205, -245, Math.max(x, z))), ev - 290, ep - 290);
  } else if (inEastBox(x, z)) {
    // the east: the old valley up to its 305 line (lowered along the ridge north and south of the gap), the Saltgap, the coast
    const [ec, ep] = eastCut(x, z);
    g = Math.min(e - (305 - 20 * smoothstep(250, 290, x)), ec - 290, ep - 290);
  } else if (inNEBox(x, z)) {
    // the old ring is walkable to its usual line, lowered round the north-east corner so nobody climbs over into the basin
    const [ew, ep] = neCut(x, z);
    g = Math.min(e - (305 - 20 * smoothstep(205, 245, Math.min(x, -z))), ew - 290, ep - 290);
  } else if (inSouthBox(x, z)) {
    const [ef, ep] = southCut(x, z);
    g = Math.min(e - (305 - 20 * smoothstep(250, 290, z)), ef - 290, ep - 290);
  } else g = e - 305;
  // ...and never within 15 m of the end of the land
  return Math.max(g, WORLD.minX + 15 - x, WORLD.minZ + 15 - z, x - (WORLD.maxX - 15), z - (WORLD.maxZ - 15));
}
export function inWorld(x, z, pad = 0) { return worldGap(x, z) <= -pad; }
// keep a move inside the world, sliding along the edge when only one axis is out. Someone already outside (an old save on what
// is now ridge, a knock-back) may always step back towards the inside, so nobody is ever pinned in place.
export function clampWorld(x, z, px, pz, pad = 0) {
  // a step never changes area (the islands and the valley are joined only by the ship)
  const A = areaOf(px, pz), same = (qx, qz) => areaOf(qx, qz) === A;
  if (same(x, z) && inWorld(x, z, pad)) return [x, z];
  const g0 = worldGap(px, pz) + pad;
  if (g0 > 0 && same(x, z) && worldGap(x, z) + pad <= g0) return [x, z];
  if (same(x, pz) && inWorld(x, pz, pad)) return [x, pz];
  if (same(px, z) && inWorld(px, z, pad)) return [px, z];
  return [px, pz];
}
// the high ground of Part Four: the pass and the far valley (wind-bent pines and boulders rather than oak and lilac)
export function alpineWeight(x, z) {
  if (x > -200 || z > -200) return 0;
  const core = 1 - smoothstep(FARSIDE.r, FARSIDE.r + FARSIDE.wall, Math.hypot(x - FARSIDE.x, z - FARSIDE.z));
  const lane = 1 - smoothstep(NW_PASS.floor, NW_PASS.floor + NW_PASS.wall, passInfo(x, z).d);
  return Math.max(core, lane);
}
// which side of the mountains: 'far' beyond the pass, 'valley' otherwise (graveyards and travel use it)
export function regionAt(x, z) {
  { const I = x < DUNGEON_MIN_X && islandAt(x, z); if (I) return I.id; }
  if (inNEBox(x, z) && (wildSdf(x, z) < WILD.wall || passInfo(x, z, NE_PASS.pts).t > 0.6 && passInfo(x, z, NE_PASS.pts).d < 30)) return 'wild';
  if (inSouthBox(x, z) && (flatsSdf(x, z) < FLATS.wall || passInfo(x, z, SOUTH_PASS.pts).t > 0.6 && passInfo(x, z, SOUTH_PASS.pts).d < 30)) return 'south';
  if (inEastBox(x, z) && (coastSdf(x, z) < COAST.wall || passInfo(x, z, EAST_PASS.pts).t > 0.6 && passInfo(x, z, EAST_PASS.pts).d < 30)) return 'coast';
  return x < -200 && z < -200 && (Math.hypot(x - FARSIDE.x, z - FARSIDE.z) < FARSIDE.r + FARSIDE.wall || passInfo(x, z).t > 0.55) ? 'far' : 'valley';
}

// snow lies on the high ground beyond the top of the pass (the Far Vale and the mountains round it)
export function snowWeight(x, z) {
  if (x > -280 || z > -280) return 0;
  return smoothstep(-296, -318, Math.max(x, z) + (vnoise(x * 0.04, z * 0.04, 141) - 0.5) * 14);
}

export function desertWeight(x, z) {
  return smoothstep(98, 138, z + (vnoise(x * 0.012, z * 0.012, 7) - 0.5) * 34);
}

export function gladeWeight(x, z) {
  const d = Math.hypot(x - 145, z + 148);
  return 1 - smoothstep(40, 78, d + (vnoise(x * 0.03, z * 0.03, 5) - 0.5) * 16);
}

// the Highreach plateau above the glade cliff
export function highreachWeight(x, z) {
  return smoothstep(-186, -198, z + (vnoise(x * 0.04, z * 0.04, 87) - 0.5) * 6) * (1 - smoothstep(56, 72, Math.abs(x - 150)));
}

export function forestWeight(x, z) {
  // Greenwood: north and west of the village, away from settlements and the desert
  const n = fbm(x * 0.011, z * 0.011, 3, 41);
  let w = smoothstep(0.42, 0.6, n + (-z) * 0.0016 + (-x) * 0.0008);
  w *= 1 - desertWeight(x, z);
  w *= smoothstep(66, 90, Math.hypot(x, z));
  w *= 1 - alpineWeight(x, z);
  w *= 1 - coastWeight(x, z);
  w *= 1 - flatsWeight(x, z);
  w *= 1 - wildWeight(x, z);
  return w;
}

// nearest point on the stream: distance, arc length and the water level there
export function streamInfo(x, z) {
  const P = STREAM.pts;
  let best = 1e9, bs = 0, acc = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az;
    const L = Math.hypot(dx, dz);
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (L * L), 0, 1);
    const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
    if (d < best) { best = d; bs = acc + t * L; }
    acc += L;
  }
  return { d: best, s: bs, level: streamLevel(bs), len: acc };
}
export function streamLevel(s) {
  const L = STREAM.levels;
  for (let i = 0; i < L.length - 1; i++) if (s <= L[i + 1][0]) return lerp(L[i][1], L[i + 1][1], smoothstep(L[i][0], L[i + 1][0], s));
  return L[L.length - 1][1];
}
// is (x, z) inside the built-up village (kept free of wild trees and rocks)?
export function inVillage(x, z, pad = 0) {
  const c = VILLAGE.clear;
  return ((x - c.x) / (c.rx + pad)) ** 2 + ((z - c.z) / (c.rz + pad)) ** 2 < 1;
}

// Walkable built surfaces: the hall terrace, its staircase and the bridge decks (absolute heights).
// The terrain mesh ignores them; characters stand on max(ground, deck).
let bridgeEnds = null;
export function deckAt(x, z) {
  const hf = houseFloor(x, z); if (hf > -Infinity) return hf; // inside a house, in its doorway or on its doorstep (shared/houses.js)
  { const I = islandAt(x, z); if (I) return I.deck(x, z); }
  for (const P of PIERS) if (x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1) return P.top;
  const T = VILLAGE.terrace, S = VILLAGE.stairs;
  if (x > T.x0 && x < T.x1 && z > T.z0 && z < T.z1) return T.top;
  if (Math.abs(x) < S.w / 2 && z >= S.top && z <= S.bottom) {
    const bottom = heightAt(0, S.bottom + 0.6), mid = (T.top + bottom) / 2;
    if (z < S.landing0) return Math.min(T.top, lerp(T.top, mid, (z - S.top) / (S.landing0 - S.top)) + 0.1);
    if (z < S.landing1) return mid;
    return Math.min(mid, lerp(mid, bottom, (z - S.landing1) / (S.bottom - S.landing1)) + 0.1);
  }
  if (!bridgeEnds) bridgeEnds = BRIDGES.map((b) => [heightAt(b.a[0], b.a[1]), heightAt(b.b[0], b.b[1])]);
  for (let i = 0; i < BRIDGES.length; i++) {
    const b = BRIDGES[i], dx = b.b[0] - b.a[0], dz = b.b[1] - b.a[1], L = Math.hypot(dx, dz);
    const t = ((x - b.a[0]) * dx + (z - b.a[1]) * dz) / (L * L);
    if (t < 0 || t > 1) continue;
    const lat = Math.abs((x - b.a[0]) * dz - (z - b.a[1]) * dx) / L;
    if (lat > b.w / 2) continue;
    return lerp(bridgeEnds[i][0], bridgeEnds[i][1], t) + b.rise * Math.sin(Math.PI * t) + 0.12;
  }
  return -Infinity;
}
export function walkHeight(x, z) {
  if (x >= DUNGEON_MIN_X) return 0;
  const I = islandAt(x, z);
  return I ? Math.max(I.height(x, z), I.deck(x, z), houseFloor(x, z)) : Math.max(heightAt(x, z), deckAt(x, z), houseFloor(x, z));
}

function edgeMountains(x, z) {
  const e = edgeE(x, z) + (vnoise(x * 0.02, z * 0.02, 13) - 0.5) * 36;
  const w = smoothstep(246, 304, e);
  if (w <= 0) return 0;
  return w * (38 + ridged(x * 0.012, z * 0.012, 4, 3) * 48);
}

// the rolling hills, the dunes and the north-west lift: everything before settlements, roads and cliffs shape the ground
function baseHeight(x, z) {
  // Rolling base hills
  let h = 6 + (fbm(x * 0.0075, z * 0.0075, 4, 11) - 0.5) * 16 + (fbm(x * 0.03, z * 0.03, 3, 23) - 0.5) * 3.2;
  // Soft floor so dry land never dips below the water line
  h = 1.4 + Math.log1p(Math.exp((h - 1.4) * 1.5)) / 1.5;

  // Desert dunes (long ridges running east-west with crossing ripples)
  const dw = desertWeight(x, z);
  if (dw > 0) {
    const dune = ridged(x * 0.02 + vnoise(x * 0.01, z * 0.01, 3) * 1.2, z * 0.009, 3, 77);
    h = lerp(h, 3.2 + dune * 7.5, dw * 0.85);
  }

  // the far valley and the pass up to it stand high (0 everywhere outside the north-west)
  h += farsideLift(x, z);
  return h;
}
let PASS_ENDS = null; // the ground at the foot and at the top of the pass (measured once)
let EAST_ENDS = null;
let SOUTH_ENDS = null;
let NE_ENDS = null, NE_BUSY = false;
// bridge ends: the ground under and round each end is held at the end's height (the carve's height there, so the decks keep
// theirs), full over 0.6 m under the deck to 0.4 m out and to 0.4 m past each side, fading out by 2.5 m out and 2 m to the side
let BANK_ENDS = null, BANK_BUSY = false;
function bankPad(x, z, h) {
  if (!BANK_ENDS) { BANK_BUSY = true; BANK_ENDS = BRIDGES.map((b) => [heightAt(b.a[0], b.a[1]), heightAt(b.b[0], b.b[1])]); BANK_BUSY = false; }
  for (let i = 0; i < BRIDGES.length; i++) {
    const b = BRIDGES[i], dx = b.b[0] - b.a[0], dz = b.b[1] - b.a[1], L = Math.hypot(dx, dz);
    const along = ((x - b.a[0]) * dx + (z - b.a[1]) * dz) / L, lat = Math.abs((x - b.a[0]) * dz - (z - b.a[1]) * dx) / L;
    if (lat > b.w / 2 + 2 || along < -2.5 || along > L + 2.5) continue;
    for (const [s, e] of [[-along, 0], [along - L, 1]]) { // s: metres out from that end (negative under the deck)
      if (s < -1.6 || s > 2.5) continue;
      const w = smoothstep(-1.6, -0.6, s) * (1 - smoothstep(0.4, 2.5, s)) * (1 - smoothstep(b.w / 2 + 0.4, b.w / 2 + 2, lat));
      if (w > 0) h = lerp(h, BANK_ENDS[i][e], w);
    }
  }
  return h;
}
// the Wildworks floor: rolling scrap mounds with craters where engines have burst
function wildTarget(x, z) {
  const mound = ridged(x * 0.03, z * 0.03, 3, 181) * 3.2;
  const crater = smoothstep(0.7, 0.85, vnoise(x * 0.025, z * 0.025, 182)) * -2.4;
  const lane = smoothstep(5, 16, roadDist(x, z)); // the road through the basin stays level
  return WILD.top + (mound + crater) * lane + (vnoise(x * 0.08, z * 0.08, 183) - 0.5) * 0.6;
}
// the salt pan: flat white crust, with long low dunes of glassy sand along its edges
function flatsTarget(x, z) {
  const edge = smoothstep(-40, -8, flatsSdf(x, z));
  const dune = ridged(x * 0.018 + vnoise(x * 0.01, z * 0.01, 171) * 1.2, z * 0.03, 3, 172);
  const lane = smoothstep(5, 16, roadDist(x, z)); // the road across the flats stays level
  return FLATS.top + (vnoise(x * 0.05, z * 0.05, 173) - 0.5) * 0.5 + dune * 6 * lane * Math.max(edge, smoothstep(0.62, 0.8, vnoise(x * 0.012, z * 0.012, 174)));
}
// the coast plain: level near the mountains, down over the dunes to the tide line (about x 426) and under the sea
function coastTarget(x, z) {
  const xn = x + (vnoise(x * 0.02, z * 0.02, 151) - 0.5) * 16;
  const land = lerp(COAST.top, 1.1, smoothstep(372, 426, xn)) + (vnoise(x * 0.06, z * 0.06, 152) - 0.5) * 1.6 * (1 - smoothstep(415, 430, xn));
  return land - smoothstep(424, 450, xn) * 6.5;
}

export function heightAt(x, z) {
  if (x >= DUNGEON_MIN_X) return 0; // dungeon interiors: flat floors
  { const I = islandAt(x, z); if (I) return I.height(x, z); }
  let h = baseHeight(x, z);

  // the Glass Waste: a level salt pan with low dunes of glassy sand; the Sunward Pass runs evenly from Dunewatch down to it
  if (inSouthBox(x, z)) {
    const fw = 1 - smoothstep(0, FLATS.wall, flatsSdf(x, z));
    if (fw > 0) h = lerp(h, flatsTarget(x, z), fw);
    const ps = passInfo(x, z, SOUTH_PASS.pts), pw = 1 - smoothstep(4, 11, ps.d);
    if (pw > 0) {
      const P = SOUTH_PASS.pts, E = SOUTH_ENDS || (SOUTH_ENDS = [baseHeight(P[0][0], P[0][1]), FLATS.top]);
      h = lerp(h, lerp(E[0], E[1], ps.t), pw);
    }
  }

  // the Harrow Coast: a low plain falling to a sandy beach and under the sea; the Saltgap's floor runs evenly down to it
  if (inEastBox(x, z)) {
    const cw = 1 - smoothstep(0, COAST.wall, coastSdf(x, z));
    if (cw > 0) h = lerp(h, coastTarget(x, z), cw);
    const pe = passInfo(x, z, EAST_PASS.pts), pw = 1 - smoothstep(4, 11, pe.d);
    if (pw > 0) {
      const P = EAST_PASS.pts, E = EAST_ENDS || (EAST_ENDS = [baseHeight(P[0][0], P[0][1]), COAST.top]);
      h = lerp(h, lerp(E[0], E[1], pe.t), pw);
    }
  }

  // the floor of the pass climbs evenly from its foot to the vale: the road up it is one smooth line, not the hills' bumps
  if (x < -200 && z < -200) {
    const p = passInfo(x, z), w = 1 - smoothstep(4, 11, p.d);
    if (w > 0) {
      const P = NW_PASS.pts, E = PASS_ENDS || (PASS_ENDS = [baseHeight(P[0][0], P[0][1]), baseHeight(P[P.length - 1][0], P[P.length - 1][1])]);
      h = lerp(h, lerp(E[0], E[1], p.t), w);
    }
  }

  // Settlements are flattened
  for (const zn of ZONES) {
    if (!zn.r || zn.flat == null || zn.late || zn.area) continue;
    const d = Math.hypot(x - zn.x, z - zn.z);
    if (d < zn.r) {
      const w = 1 - smoothstep(zn.r * 0.55, zn.r, d);
      h = lerp(h, zn.flat + (vnoise(x * 0.06, z * 0.06, 4) - 0.5) * 0.5, w);
    }
  }

  // Roads gently sunk into the ground
  const rd = roadDist(x, z);
  if (rd < 8) h -= (1 - smoothstep(1.5, 8, rd)) * 0.18;

  // Ironcliff Quarry pit: stepped terraces cut into the rock, and a straight ramp down from the camp
  {
    const Q = QUARRY, qd = Math.hypot(x - Q.x, z - Q.z);
    if (qd < Q.rings[0] + 3) {
      const wob = (vnoise(x * 0.12, z * 0.12, 98) - 0.5) * 2.2;
      const rim = ZONES.find((zz) => zz.id === 'quarry').flat;
      let steps = 0;
      for (const ring of Q.rings) steps += smoothstep(ring + 0.9, ring - 0.5, qd + wob);
      h = Math.min(h, rim) - steps * Q.drop + (vnoise(x * 0.3, z * 0.3, 99) - 0.5) * 0.25 * steps;
      const R = Q.ramp;
      if (Math.abs(z - R.z) < R.w + 1.2 && x > R.x0 - 2 && x < R.x1) {
        const t = clamp((x - R.x0) / (R.x1 - R.x0), 0, 1), rampH = lerp(rim, rim - Q.drop * 3, t);
        const k = 1 - smoothstep(R.w, R.w + 1.2, Math.abs(z - R.z));
        h = lerp(h, rampH, k);
      }
    }
  }

  // the hall terrace: ground under it stays below the paving (its retaining walls hide the join)
  const TR = VILLAGE.terrace;
  if (x > TR.x0 - 1 && x < TR.x1 + 1 && z > TR.z0 - 1 && z < TR.z1 + 1) h = Math.min(h, TR.top - 0.5);

  // the village stream: a carved bed with sloping banks, and the pond it ends in
  if (x > -80 && x < 100 && z > -30 && z < 45) {
    const si = streamInfo(x, z);
    if (si.d < 6) {
      const bed = si.level - 0.8;
      const k = smoothstep(1.2, 5.2, si.d + (vnoise(x * 0.2, z * 0.2, 95) - 0.5) * 0.8);
      if (h > bed) h = bed + k * (h - bed);
    }
    const pd = Math.hypot(x - STREAM.pond.x, z - STREAM.pond.z) + (vnoise(x * 0.15, z * 0.15, 96) - 0.5) * 2;
    if (pd < STREAM.pond.r + 3) {
      const bed = streamLevel(1e4) - 1.1, k = smoothstep(STREAM.pond.r - 3, STREAM.pond.r + 3, pd);
      if (h > bed) h = bed + k * (h - bed);
    }
    // the bank meets each bridge end flush: a level pad at the deck end's own height (no dip where the carve begins)
    if (!BANK_BUSY) h = bankPad(x, z, h);
  }

  // Glade cliff with the waterfall notch
  const cx = Math.abs(x - WATERFALL.x);
  const cliffBand = smoothstep(-174, -189, z + (vnoise(x * 0.08, 3, 2) - 0.5) * 4);
  const cliffSide = 1 - smoothstep(48, 82, cx);
  if (cliffBand * cliffSide > 0) {
    const ledge = (ridged(x * 0.05, z * 0.05, 3, 8) - 0.5) * 3;
    h += cliffBand * cliffSide * (19.8 + ledge * cliffBand);
    // notch the waterfall channel
    const notch = (1 - smoothstep(2.5, 6.5, cx)) * smoothstep(-186, -196, z);
    h -= notch * 1.4;
  }

  // plateau settlements are levelled after the cliff has lifted the ground
  for (const zn of ZONES) {
    if (!zn.late || zn.area) continue;
    const d = Math.hypot(x - zn.x, z - zn.z);
    if (d < zn.r) h = lerp(h, zn.flat + (vnoise(x * 0.06, z * 0.06, 4) - 0.5) * 0.4, 1 - smoothstep(zn.r * 0.55, zn.r, d));
  }

  // the Wildworks: a rusted basin of scrap mounds and craters; the Scrapway's floor runs evenly to it from Cragborn Camp
  if (inNEBox(x, z) && !NE_BUSY) {
    const ww = 1 - smoothstep(0, WILD.wall, wildSdf(x, z));
    if (ww > 0) h = lerp(h, wildTarget(x, z), ww);
    const pn = passInfo(x, z, NE_PASS.pts), pw = 1 - smoothstep(4, 11, pn.d);
    if (pw > 0) {
      if (!NE_ENDS) { NE_BUSY = true; const P = NE_PASS.pts[0]; NE_ENDS = [heightAt(P[0], P[1]) - edgeMountains(P[0], P[1]), WILD.top]; NE_BUSY = false; }
      h = lerp(h, lerp(NE_ENDS[0], NE_ENDS[1], pn.t), pw);
    }
  }

  // Glade lake basin
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z) + (vnoise(x * 0.07, z * 0.07, 19) - 0.5) * 4;
  if (ld < LAKE.r + 9) {
    const t = 1 - smoothstep(LAKE.r - 9, LAKE.r + 5, ld);
    h = lerp(h, -2.4, t);
  }

  h += edgeMountains(x, z);
  return h;
}

// open water at (x, z): its surface height, or null (the glade lake, the village stream and its pond)
export function waterAt(x, z) {
  if (x >= DUNGEON_MIN_X) return null;
  { const I = islandAt(x, z); if (I) return I.water(x, z); }
  const h = heightAt(x, z);
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 8 && h < WORLD.water - 0.25) return WORLD.water;
  if (x > 400 && z > -200 && z < 260 && h < WORLD.water - 0.25) return WORLD.water; // the sea off the Harrow Coast
  if (x > -80 && x < 100 && z > -30 && z < 45) {
    const pd = Math.hypot(x - STREAM.pond.x, z - STREAM.pond.z);
    if (pd < STREAM.pond.r && h < streamLevel(1e4) - 0.2) return streamLevel(1e4);
    const si = streamInfo(x, z);
    if (si.d < 2.4 && h < si.level - 0.2) return si.level;
  }
  return null;
}
// a spot of water within reach of someone standing at (x, z), preferring the way they face
// what kind of water lies at (x, z): 'sea' (the sea off the Harrow Coast and round the islands), 'lake', 'stream'
// (the village stream and its pond, the Rime Steps' meltwater channels), or null. The sea takes a fishing line, the rest a salvage hook.
export function waterKind(x, z) {
  if (x >= DUNGEON_MIN_X) return null;
  { const I = islandAt(x, z); if (I) return I.waterKind(x, z); }
  if (waterAt(x, z) === null) return null;
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 8) return 'lake';
  if (x > -80 && x < 100 && z > -30 && z < 45) return 'stream';
  return 'sea';
}
export function waterNear(x, z, ry = 0) {
  let best = null, bs = -1e9;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    for (const d of [2.5, 3.5, 4.5, 5.5]) {
      const wx = x + Math.sin(a) * d, wz = z + Math.cos(a) * d, y = waterAt(wx, wz);
      if (y === null) continue;
      const score = Math.cos(a - ry) * 2 - d * 0.3;
      if (score > bs) { bs = score; best = { x: wx, z: wz, y }; }
      break;
    }
  }
  return best;
}

export function normalAt(x, z, e = 0.6) {
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  const nx = -hx, ny = 2 * e, nz = -hz;
  const l = Math.hypot(nx, ny, nz);
  return [nx / l, ny / l, nz / l];
}

// Ground paint weights: { sand, path, rock, lush, forest }
export function groundAt(x, z) {
  { const I = x < DUNGEON_MIN_X && islandAt(x, z); if (I) return I.ground(x, z); }
  const rd = roadDist(x, z);
  const vd = Math.hypot(x, z);
  let path = 1 - smoothstep(2.2, 4.6, rd);
  // packed earth around buildings in settlements
  for (const zn of ZONES) {
    if (!zn.r || zn.area || zn.id === 'glade' || zn.id === 'village') continue;
    const d = Math.hypot(x - zn.x, z - zn.z);
    path = Math.max(path, (1 - smoothstep(zn.r * 0.18, zn.r * 0.42, d)) * 0.55 * smoothstep(0.35, 0.6, vnoise(x * 0.09, z * 0.09, 61)));
  }
  // village: round cobbled plaza, cobbled avenues near the middle, worn earth where the cobbles run out
  const ragged = vnoise(x * 0.22, z * 0.22, 81) * 0.7 + vnoise(x * 0.6, z * 0.6, 82) * 0.3;
  const PZ = VILLAGE.plaza, pdist = Math.hypot(x - PZ.x, z - PZ.z);
  let cobble = 1 - smoothstep(PZ.r - 1, PZ.r + 0.6, pdist + (ragged - 0.5) * 2.2);
  const nearMid = 1 - smoothstep(26, 54, vd + (ragged - 0.5) * 10);
  cobble = Math.max(cobble, (1 - smoothstep(1.6, 3.3, rd)) * nearMid);
  // south avenue widens into the market street
  if (z > 12 && z < 50 && Math.abs(x) < 9) cobble = Math.max(cobble, 1 - smoothstep(4.5, 6.5, Math.abs(x) + (ragged - 0.5) * 2));
  cobble *= smoothstep(0.12, 0.34, ragged + (1 - smoothstep(PZ.r - 4, PZ.r, pdist)) * 0.7 + nearMid * 0.15);
  path = Math.max(path, (1 - smoothstep(PZ.r + 0.5, PZ.r + 4, pdist)) * 0.7 * smoothstep(0.3, 0.55, vnoise(x * 0.12, z * 0.12, 62)));
  let sand = desertWeight(x, z);
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z) + (vnoise(x * 0.15, z * 0.15, 33) - 0.5) * 2.5;
  // narrow pebbly shore right at the waterline
  sand = Math.max(sand, (1 - smoothstep(LAKE.r - 1.6, LAKE.r + 0.6, ld)) * 0.75);
  const h = heightAt(x, z);
  let rock = smoothstep(14, 26, h) * smoothstep(240, 270, edgeE(x, z));
  // the glade cliff face
  rock = Math.max(rock, smoothstep(-176, -184, z) * smoothstep(-201, -193, z + (vnoise(x * 0.1, 7, 12) - 0.5) * 4) * (1 - smoothstep(50, 78, Math.abs(x - WATERFALL.x))) * 0.85);
  // industrial yard: trampled soot and dirt with stony patches
  const fd = Math.hypot(x + 150, z + 146);
  const foundry = 1 - smoothstep(24, 40, fd + (vnoise(x * 0.08, z * 0.08, 71) - 0.5) * 10);
  path = Math.max(path, foundry * 0.95);
  rock = Math.max(rock, foundry * smoothstep(0.55, 0.75, vnoise(x * 0.12, z * 0.12, 72)) * 0.7);
  // camps: packed earth
  for (const [cx, cz, cr, k] of [[112, 232, 24, 0.85], [-42, 170, 16, 0.8], [-224, -224, 18, 0.85], [-184, -188, 10, 0.7]]) {
    const cd = Math.hypot(x - cx, z - cz) + (vnoise(x * 0.1, z * 0.1, 73) - 0.5) * 8;
    const ck = (1 - smoothstep(cr * 0.45, cr, cd)) * smoothstep(0.25, 0.5, vnoise(x * 0.18, z * 0.18, 74) + 0.25);
    path = Math.max(path, ck * k);
    sand *= 1 - ck * 0.75;
  }
  // stream banks: wet earth and river stones
  if (x > -80 && x < 100 && z > -30 && z < 45) {
    const si = streamInfo(x, z);
    const bank = 1 - smoothstep(2.6, 5.0, si.d + (vnoise(x * 0.3, z * 0.3, 97) - 0.5) * 1.2);
    rock = Math.max(rock, bank * 0.75);
    path = Math.max(path, bank * 0.5);
    const pd = Math.hypot(x - STREAM.pond.x, z - STREAM.pond.z);
    rock = Math.max(rock, (1 - smoothstep(STREAM.pond.r, STREAM.pond.r + 2.5, pd)) * 0.7);
  }
  // the quarry: bare cut stone on the terrace walls, gravel and dust on the ledges
  {
    const qd = Math.hypot(x - QUARRY.x, z - QUARRY.z);
    if (qd < QUARRY.rings[0] + 8) {
      const inPit = 1 - smoothstep(QUARRY.rings[0] - 1, QUARRY.rings[0] + 6, qd);
      const n = normalAt(x, z, 0.8)[1];
      rock = Math.max(rock, inPit * (0.35 + smoothstep(0.92, 0.7, n) * 0.65));
      path = Math.max(path, inPit * 0.8 * smoothstep(0.3, 0.6, vnoise(x * 0.15, z * 0.15, 63) + 0.2));
    }
  }
  // the Highreach: bare rock breaking through thin grass; scorched ground among the coils
  const hrw = highreachWeight(x, z);
  let foundry2 = 0;
  if (hrw > 0) {
    rock = Math.max(rock, hrw * smoothstep(0.48, 0.72, vnoise(x * 0.06, z * 0.06, 88) * 0.75 + vnoise(x * 0.2, z * 0.2, 89) * 0.25) * 0.9);
    const cd = Math.hypot(x - 186, z + 216) + (vnoise(x * 0.09, z * 0.09, 90) - 0.5) * 9;
    foundry2 = hrw * (1 - smoothstep(10, 24, cd)) * smoothstep(0.35, 0.6, vnoise(x * 0.15, z * 0.15, 91) + 0.2) * 0.75;
    path = Math.max(path, foundry2 * 0.8);
  }
  // the Proving Ring: a packed earth floor east of the village
  { const ad = Math.hypot(x - 48, z + 24) + (vnoise(x * 0.3, z * 0.3, 92) - 0.5) * 0.8; path = Math.max(path, 1 - smoothstep(10.2, 11.6, ad)); }
  const lush = gladeWeight(x, z) * (1 - sand) * (1 - foundry) * (1 - hrw);
  const forest = forestWeight(x, z) * (1 - foundry);
  // the Wildworks: rust-red earth and soot among the scrap
  const wwz = wildWeight(x, z);
  if (wwz > 0) { path = Math.max(path, wwz * 0.7 * smoothstep(0.3, 0.55, vnoise(x * 0.06, z * 0.06, 184) + 0.2)); rock = Math.max(rock, wwz * smoothstep(0.55, 0.75, vnoise(x * 0.09, z * 0.09, 185)) * 0.6); }
  // the Glass Waste: white salt crust on the pan, glassy sand on the dunes
  const fwz = flatsWeight(x, z);
  let salt = 0;
  if (fwz > 0) { const hz = heightAt(x, z); salt = fwz * (1 - smoothstep(FLATS.top + 0.8, FLATS.top + 2.2, hz)) * smoothstep(0.25, 0.5, vnoise(x * 0.08, z * 0.08, 175) + 0.2); sand = Math.max(sand, fwz * (1 - salt * 0.8)); }
  // the Harrow Coast: sand from the dunes down to the tide line
  const cwz = coastWeight(x, z);
  if (cwz > 0) sand = Math.max(sand, cwz * smoothstep(398, 420, x + (vnoise(x * 0.05, z * 0.05, 153) - 0.5) * 14));
  // snow: drifts over the vale, thin where feet and carts have trodden it, rock showing through on the crags
  let snow = snowWeight(x, z);
  if (salt > 0) snow = Math.max(snow, salt * 0.75);
  if (snow > 0 && !salt) snow *= smoothstep(0.2, 0.55, vnoise(x * 0.05, z * 0.05, 142) * 0.6 + vnoise(x * 0.21, z * 0.21, 143) * 0.4 + 0.22) * (1 - path * 0.75);
  // cobble wear: broad worn patches (about 30 m across) where the paving gives way to dusty earth, strongest toward the edges of the paving
  let cbl = clamp(cobble, 0, 1);
  if (cbl > 0) {
    const wear = cbl * 0.55 * smoothstep(0.5, 0.78, vnoise(x * 0.033, z * 0.033, 186) * 0.7 + vnoise(x * 0.2, z * 0.2, 187) * 0.3 + (1 - cbl) * 0.35);
    cbl -= wear; path = Math.max(path, wear * 0.9);
  }
  return { sand, path: path * (1 - sand * 0.6), rock, lush, forest, cobble: cbl, foundry: Math.max(foundry, foundry2, wwz * 0.75), snow };
}

export function zoneAt(x, z) {
  if (x >= DUNGEON_MIN_X) {
    const d = dungeonAt(x, z);
    if (d) { const a = dungeonArea(d, x, z); return a ? { id: a.id, name: a.name, level: d.level, dungeon: true, region: d.id } : { id: d.id, name: d.name, level: d.level, dungeon: true }; }
  }
  { const I = x < DUNGEON_MIN_X && islandAt(x, z); if (I) { const id = I.zone(x, z); return ZONES.find((zz) => zz.id === id); } }
  let best = null, bd = 1e9;
  for (const zn of ZONES) {
    if (!zn.r || zn.area) continue;
    const d = Math.hypot(x - zn.x, z - zn.z) / zn.r;
    if (d < 1 && d < bd) { bd = d; best = zn; }
  }
  const byId = (id) => ZONES.find((zz) => zz.id === id);
  // the glade's circle reaches up over the cliff edge: up there it is the Highreach
  if (best && best.id === 'glade' && z < -190 && x > 86 && x < 214) return byId('highreach');
  if (best) return best;
  if (x < -200 && z < -200) {
    if (Math.hypot(x - FARSIDE.x, z - FARSIDE.z) < FARSIDE.r + FARSIDE.wall * 0.5) return byId('farside');
    const pi = passInfo(x, z); if (pi.d < NW_PASS.floor + NW_PASS.wall * 0.5 && pi.t > 0.12) return byId('nwpass');
  }
  if (inNEBox(x, z)) {
    if (wildSdf(x, z) < 6) return byId('wildworks');
    const pn = passInfo(x, z, NE_PASS.pts); if (pn.d < NE_PASS.floor + NE_PASS.wall * 0.5 && pn.t > 0.2) return byId('scrapway');
  }
  if (inSouthBox(x, z)) {
    if (flatsSdf(x, z) < 6) return byId('glasswaste');
    const ps = passInfo(x, z, SOUTH_PASS.pts); if (ps.d < SOUTH_PASS.floor + SOUTH_PASS.wall * 0.5 && ps.t > 0.2) return byId('sunpass');
  }
  if (inEastBox(x, z)) {
    if (coastSdf(x, z) < 6) return byId('harrowcoast');
    const pe = passInfo(x, z, EAST_PASS.pts); if (pe.d < EAST_PASS.floor + EAST_PASS.wall * 0.5 && pe.t > 0.2) return byId('saltgap');
  }
  if (desertWeight(x, z) > 0.5) return byId('sunscar');
  if (z < -190 && x > 86 && x < 214) return byId('highreach');
  if (gladeWeight(x, z) > 0.4) return byId('glade');
  const vd = Math.hypot(x, z + 4);
  if (x < -40 && vd > 135) return byId('rustwood');
  if (z < -40 || x < -60) return byId('greenwood');
  if (x > 150) return byId('eastreach');
  return { id: 'meadows', name: 'Sunmere Meadows', level: '1-3' };
}
