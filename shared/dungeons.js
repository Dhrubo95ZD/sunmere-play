// Dungeons: underground interiors that live east of the world map (x > 700), reached through doors in the
// overworld. Each one is a 2 m cell grid rasterised from rooms and passages. The server and the client share
// the grid for walkability, collision (mobs and players are pushed out of rock) and flat floors at y = 0.
// Layouts run south to north, so the default camera looks "up" the dungeon toward its boss.
import { vnoise } from './noise.js';

export const CELL = 2;
export const DUNGEON_MIN_X = 700;
const PI = Math.PI;

const DEFS = [
  {
    id: 'warrens', name: 'The Briar Warrens', level: '4-6', theme: 'warren', ox: 1600, oz: -60, w: 100, h: 92,
    door: { x: -147, z: -27, ry: 1.1, label: 'The Briar Warrens', labelUp: true },
    start: [50, 77], exit: [50, 82],
    ellipses: [[50, 78, 8, 6.5], [26, 62, 10, 8], [72, 60, 11, 8], [48, 46, 9, 7], [22, 30, 10, 8], [76, 28, 10, 8], [50, 14, 14, 8.5]],
    paths: [
      [[[50, 78], [48, 46]], 4.5], [[[48, 66], [26, 62]], 4], [[[49, 56], [72, 60]], 4], [[[48, 46], [22, 30]], 4],
      [[[48, 46], [76, 28]], 4], [[[48, 46], [50, 14]], 5], [[[26, 62], [22, 30]], 3.5],
    ],
  },
  {
    id: 'deepmine', name: 'Ironcliff Deepmine', level: '8-10', theme: 'mine', ox: 1000, oz: -60, w: 124, h: 104,
    door: { x: 229.2, z: -36, ry: -PI / 2, label: 'Ironcliff Deepmine' },
    start: [62, 90], exit: [62, 96.5],
    ellipses: [[62, 90, 9, 7.5], [58, 66, 12, 8], [24, 60, 13, 10], [98, 54, 12, 11], [30, 28, 12, 9], [62, 38, 11, 8], [64, 15, 17, 10]],
    paths: [
      [[[62, 90], [58, 66]], 5], [[[56, 71], [40, 64], [24, 60]], 4.5], [[[61, 60], [80, 57], [98, 54]], 4.5],
      [[[24, 60], [22, 44], [30, 28]], 4], [[[98, 54], [90, 40], [62, 38]], 4], [[[58, 66], [62, 38]], 5],
      [[[30, 28], [46, 32], [62, 38]], 4], [[[62, 38], [64, 15]], 6],
    ],
  },
  {
    id: 'vault', name: 'Sandsunk Vault', level: '13-15', theme: 'vault', ox: 1200, oz: -60, w: 112, h: 112,
    door: { x: -150, z: 214, ry: PI, label: 'Sandsunk Vault' },
    start: [56, 99], exit: [56, 104.5],
    rects: [
      [46, 92, 66, 106], [50, 60, 62, 92], [14, 54, 40, 78], [40, 73, 50, 78], [72, 54, 98, 78], [62, 58, 72, 63],
      [44, 40, 68, 60], [14, 16, 38, 38], [22, 38, 28, 54], [44, 10, 64, 30], [50, 30, 56, 40],
      [72, 6, 104, 32], [84, 32, 90, 54],
    ],
  },
  {
    id: 'depths', name: 'The Foundry Depths', level: '18-20', theme: 'foundry', ox: 1400, oz: -60, w: 124, h: 112,
    door: { x: -124, z: -168, ry: 0.3, label: 'The Foundry Depths', labelUp: true },
    start: [30, 99], exit: [30, 104.5],
    rects: [
      [16, 90, 44, 106], [24, 86, 36, 90], [30, 62, 94, 86], [6, 50, 26, 74], [26, 68, 30, 73], [98, 50, 118, 74],
      [94, 62, 98, 66], [54, 42, 70, 62], [12, 14, 40, 38], [16, 38, 22, 50], [84, 14, 112, 38],
      [100, 38, 106, 50], [44, 4, 80, 30], [56, 30, 68, 42],
    ],
  },
  {
    id: 'stormworks', name: 'The Stormworks', level: '24-25', theme: 'storm', ox: 1800, oz: -60, w: 116, h: 108,
    door: { x: 203, z: -242, ry: -PI / 2, label: 'The Stormworks' },
    start: [58, 99], exit: [58, 104.5],
    rects: [
      [46, 92, 70, 106], [54, 80, 62, 92], // entry hall and the stair down
      [36, 58, 80, 80], // the Coil Hall
      [20, 72, 36, 78], [6, 40, 28, 78], [12, 26, 18, 40], [8, 6, 36, 26], // west wing: winding room, cable works
      [80, 58, 94, 63], [92, 36, 112, 66], [100, 22, 106, 36], [86, 6, 112, 22], // east wing: battery gallery, transformer yard
      [36, 14, 44, 19], [76, 10, 86, 15], [44, 4, 76, 30], // the Thunderhead Chamber, reached from both wings
    ],
  },
];

// The Brasswind Shafts: the buried engine works under Halim's dig, two galleries down to the engine hall (levels 11-13)
DEFS.push({
  id: 'shafts', name: 'The Brasswind Shafts', level: '11-13', theme: 'mine', ox: 2000, oz: -60, w: 120, h: 104,
  door: { x: 196, z: 170, ry: Math.PI, label: 'The Brasswind Shafts' },
  start: [60, 92], exit: [60, 98],
  ellipses: [[60, 92, 9, 7], [60, 70, 11, 8], [26, 64, 12, 9], [94, 62, 12, 9], [30, 34, 11, 9], [90, 34, 11, 9], [60, 16, 16, 10]],
  paths: [
    [[[60, 92], [60, 70]], 5], [[[57, 70], [40, 66], [26, 64]], 4.5], [[[63, 70], [80, 64], [94, 62]], 4.5],
    [[[26, 64], [28, 48], [30, 34]], 4], [[[94, 62], [92, 48], [90, 34]], 4], [[[30, 34], [46, 24], [60, 16]], 4.5], [[[90, 34], [74, 24], [60, 16]], 4.5],
  ],
});

// Part Three: the Brass Concord's strongrooms, cut into the mountain behind the Coilway depot (level 25)
DEFS.push({
  id: 'strongrooms', name: 'The Concord Strongrooms', level: '25', theme: 'foundry', ox: 2200, oz: -60, w: 120, h: 104,
  door: { x: -243, z: -243, ry: Math.PI / 4, label: 'The Concord Strongrooms' },
  start: [60, 92], exit: [60, 98],
  ellipses: [[60, 90, 9, 7], [32, 62, 12, 9], [84, 42, 12, 9], [58, 15, 16, 9]],
  paths: [[[[60, 88], [54, 76], [40, 66]], 5], [[[36, 56], [52, 50], [72, 44]], 4.5], [[[84, 34], [76, 24], [66, 18]], 4.5]],
});

// Part Four: the Council Hall of Ledgerholm, the Provost's last stand (level 28-30, for a full company)
// the door is the council hall's own front door (the hall model stands at -385,-387 facing the gate)
DEFS.push({
  id: 'councilhall', name: 'The Council Hall', level: '28-30', theme: 'foundry', raid: true, ox: 2400, oz: -60, w: 120, h: 104,
  door: { x: -381.9, z: -383.9, ry: Math.PI / 4, label: 'The Council Hall', bare: true },
  start: [60, 92], exit: [60, 98],
  ellipses: [[60, 90, 8, 6], [60, 66, 15, 9], [60, 14, 19, 10]],
  rects: [[36, 28, 84, 54]],
  paths: [[[[60, 88], [60, 72]], 5], [[[60, 60], [60, 50]], 6], [[[60, 30], [60, 20]], 6]],
});

// Part Five: the Dry Docks under the Guild Yards, the Guildmaster and his launching engine (raid, level 30)
DEFS.push({
  id: 'drydocks', name: 'The Dry Docks', level: '30', theme: 'foundry', raid: true, ox: 2600, oz: -60, w: 120, h: 104,
  door: { x: 381, z: -50, ry: Math.PI / 2, label: 'The Dry Docks' },
  start: [60, 92], exit: [60, 98],
  ellipses: [[60, 90, 8, 6], [30, 70, 13, 9], [92, 70, 13, 9], [60, 12, 20, 9]],
  rects: [[26, 26, 94, 52]],
  paths: [[[[56, 88], [40, 76]], 5], [[[64, 88], [82, 76]], 5], [[[34, 62], [40, 50]], 6], [[[88, 62], [80, 50]], 6], [[[60, 28], [60, 20]], 7]],
});

// Part Six: the Kiln Heart under the Kilnworks, the Glasswright and the furnace engine (raid, level 35)
DEFS.push({
  id: 'kilnheart', name: 'The Kiln Heart', level: '35', theme: 'foundry', raid: true, ox: 2800, oz: -60, w: 120, h: 104,
  door: { x: 76, z: 412, ry: Math.PI / 2, label: 'The Kiln Heart' },
  start: [60, 92], exit: [60, 98],
  ellipses: [[60, 90, 8, 6], [60, 66, 16, 9], [28, 40, 12, 9], [92, 40, 12, 9], [60, 12, 21, 9]],
  rects: [[40, 26, 80, 54]],
  paths: [[[[60, 86], [60, 74]], 5], [[[48, 62], [34, 46]], 5], [[[72, 62], [86, 46]], 5], [[[38, 40], [46, 40]], 5], [[[82, 40], [74, 40]], 5], [[[60, 28], [60, 20]], 7]],
});

// Part Seven: the Assembly Line under the Wildworks, the Assembler and its unfinished engine (raid, level 35)
DEFS.push({
  id: 'assemblyline', name: 'The Assembly Line', level: '35', theme: 'foundry', raid: true, ox: 3000, oz: -60, w: 120, h: 104,
  door: { x: 360, z: -372, ry: Math.PI / 2, label: 'The Assembly Line' },
  start: [60, 92], exit: [60, 98],
  ellipses: [[60, 90, 8, 6], [30, 68, 12, 8], [90, 68, 12, 8], [60, 12, 22, 9]],
  rects: [[22, 30, 98, 50]],
  paths: [[[[56, 88], [34, 74]], 5], [[[64, 88], [86, 74]], 5], [[[30, 60], [30, 50]], 5], [[[90, 60], [90, 50]], 5], [[[60, 30], [60, 20]], 7]],
});

// Part Eight: the Deepway, the Makers' sealed undercity under the Sunscar. Not a dungeon run but an open region (open: true):
// shared like the overworld, always Normal, no featured day or group finder. Named areas inside it count as zones.
DEFS.push({
  id: 'deepway', name: 'The Deepway', level: '36-40', theme: 'deep', open: true, ox: 3400, oz: -60, w: 300, h: 260,
  door: { x: -124, z: 212, ry: PI, label: 'The Deepway' },
  start: [150, 240], exit: [150, 251], grave: [150, 211],
  rects: [
    [138, 232, 162, 256], [144, 212, 156, 233], // the stair hall and the great stair
    [30, 88, 58, 196], // the aqueducts
    [236, 92, 274, 190], // the wheelworks
    [96, 44, 204, 82], // the drafting halls
    [224, 22, 282, 70], // the weigh galleries
  ],
  ellipses: [[150, 198, 28, 16], [150, 128, 34, 26], [52, 52, 30, 22], [150, 20, 30, 14]], // camp, square, cistern, first chamber
  paths: [
    // the arms leave the square at different heights (never one straight line across the spine: from above that reads as a cross)
    [[[150, 184], [150, 152]], 8], [[[124, 146], [56, 146]], 7], [[[176, 110], [238, 110]], 7],
    [[[124, 200], [56, 184]], 6], [[[176, 200], [238, 180]], 6], [[[150, 104], [150, 80]], 8],
    [[[98, 62], [78, 58]], 6], [[[44, 90], [46, 70]], 7], [[[202, 56], [226, 50]], 6], [[[256, 94], [256, 68]], 6],
    [[[150, 46], [150, 30]], 10],
  ],
  // [id, name, x0, z0, x1, z1] in local metres: these count as zones (discovery, quests, caravans)
  areas: [
    ['dw_stair', 'The Great Stair', 136, 212, 164, 258], ['dw_camp', 'Explorers\u2019 Camp', 118, 180, 182, 212],
    ['dw_square', 'The Makers\u2019 Square', 110, 96, 190, 158], ['dw_aqueducts', 'The Aqueducts', 22, 84, 64, 200],
    ['dw_cistern', 'The Long Cistern', 18, 26, 90, 84], ['dw_wheelworks', 'The Wheelworks', 230, 86, 280, 196],
    ['dw_halls', 'The Drafting Halls', 90, 38, 210, 86], ['dw_galleries', 'The Weigh Galleries', 218, 16, 288, 76],
    ['dw_chamber', 'The First Chamber', 116, 2, 184, 40],
  ],
});

// Part Eight: the Makers' Hall behind the First Engine (raid, level 40). Its door is inside the Deepway, in the north wall of the
// First Chamber (a bare doorway in the wall: the frame is dressed by the Deepway itself)
DEFS.push({
  id: 'makershall', name: 'The Makers\u2019 Hall', level: '40', theme: 'deep', raid: true, ox: 3800, oz: -60, w: 120, h: 104,
  door: { x: 3550, z: -53.9, ry: 0, label: 'The Makers\u2019 Hall', bare: true },
  start: [60, 92], exit: [60, 98],
  rects: [[48, 84, 72, 100], [24, 46, 96, 72], [30, 8, 90, 34]], // the entry hall, the Hall of Drawings, the Pattern Room
  paths: [[[[60, 86], [60, 70]], 12], [[[60, 48], [60, 32]], 7]],
});

// Part Nine: the Copy-Works, Clerk Benedek's workshop under the empty yard north of Harrowmouth (dungeon, level 40)
DEFS.push({
  id: 'copyworks', name: 'The Copy-Works', level: '40', theme: 'foundry', ox: 4000, oz: -60, w: 120, h: 104,
  door: { x: 372, z: 10, ry: 0, label: 'The Copy-Works' },
  start: [60, 92], exit: [60, 98],
  ellipses: [[60, 90, 9, 7], [32, 62, 12, 9], [84, 42, 12, 9], [58, 15, 16, 9]],
  paths: [[[[60, 88], [54, 76], [40, 66]], 5], [[[36, 56], [52, 50], [72, 44]], 4.5], [[[84, 34], [76, 24], [66, 18]], 4.5]],
});

// Part Ten: the Ore Galleries, the mine the Makers cut for ore under the Old Works on the Cinder Reach (dungeon, level 45).
// One winding gallery, south to north: the adit foot, the Skip Hall, the slag cavern, the Bore Face (with the drill's
// fresh bore running off it as a dead end) and the Sorting Floor. No junction is a crossing, so the plan never reads as a cross.
// The door is an adit in the plateau beside the third works pad (the ore hoppers), its back to the pad.
DEFS.push({
  id: 'oregalleries', name: 'The Ore Galleries', level: '45', theme: 'ore', ox: 4200, oz: -60, w: 124, h: 112,
  door: { x: 568, z: -1250, ry: -0.55, label: 'The Ore Galleries' },
  start: [62, 94], exit: [62, 99],
  ellipses: [[62, 94, 9, 7], [32, 68, 14, 9], [58, 44, 11, 8], [96, 52, 13, 10], [60, 16, 20, 10]],
  paths: [
    [[[62, 89], [52, 80], [40, 74]], 5], [[[30, 60], [36, 51], [48, 46]], 5], [[[68, 45], [80, 48], [86, 50]], 4.5],
    [[[106, 47], [116, 36]], 4], [[[94, 43], [88, 31], [76, 22]], 5],
  ],
});

// Part Ten: the Makers' First Furnace, the casting hall at the heart of the Old Works, deep under the plateau (raid, level 45).
// Five halls south to north: the stair foot, the Bellows Hall, the Casting Pits (crane rails along the hall), the Pattern
// Floor and the Furnace Hall with the First Furnace at its north wall. The halls are wide and deep and the passages between
// them sit off the middle, east then west then east, so from above the plan is a staggered run of blocks, never a cross.
// The door is a square pit-head in the plateau north of the third works pad, its back to the sea cliff; it opens once
// Chapter 31 is done (need.done) and Corbin has left the works alone.
DEFS.push({
  id: 'firstfurnace', name: 'The Makers’ First Furnace', level: '45', theme: 'furnace', raid: true, ox: 4400, oz: -60, w: 140, h: 176,
  door: { x: 567, z: -1276, ry: 0, label: 'The Makers’ First Furnace' },
  need: { done: 'm_c31_accord', text: 'The pit-head is chained shut. Corbin’s crew and the Cinderwrights have to settle who works the island first (finish Chapter 31).' },
  start: [72, 162], exit: [72, 168],
  rects: [
    [60, 154, 84, 172], [66, 144, 78, 156], // the stair foot and the stair down
    [36, 116, 98, 146], // the Bellows Hall
    [80, 106, 92, 118], // passage east
    [28, 72, 112, 108], // the Casting Pits
    [40, 62, 54, 74], // passage west
    [30, 42, 90, 64], // the Pattern Floor
    [70, 34, 82, 44], // passage east
    [22, 4, 118, 36], // the Furnace Hall
  ],
});

// Part Eleven: the Sluice Galleries, the Makers' tunnels and gate chambers inside the old dam on the Rime Steps (dungeon,
// level 50). Five chambers south to north, each a plain block joined by a short passage set off the middle (centre, then
// west, then east), so from above the plan is a staggered run of blocks, never a cross: the intake stair foot, the Gate
// Hall (gate wheels on the walls, two channels across the floor), the Turbine Hall (square turbine pits), and the Floodgate
// Hall, where the last gate of the dam holds back the lake. The door is the intake gatehouse at the head of the frozen
// lake, in the north-east corner under the glacier, well away from the dam's ramps, the crest walk and the lake's machines.
DEFS.push({
  id: 'sluicegalleries', name: 'The Sluice Galleries', level: '50', theme: 'sluice', ox: 4600, oz: -60, w: 124, h: 120,
  door: { x: 633.5, z: -1708.5, ry: -0.36, label: 'The Sluice Galleries' },
  start: [62, 108], exit: [62, 113],
  rects: [
    [52, 102, 72, 118], [58, 92, 66, 104], // the intake stair foot and the stair passage
    [28, 66, 96, 94], // the Gate Hall
    [32, 54, 44, 68], // passage west
    [14, 28, 72, 56], // the Turbine Hall
    [68, 34, 82, 42], // passage east
    [76, 4, 118, 46], // the Floodgate Hall
  ],
});

// Part Eleven: the Great Dam, the Makers' greatest dam, high in the glacier above the frozen lake, holding back the lake's
// source (raid, level 50). Six halls south to north, each a plain block joined by a short passage set off the middle (west,
// east, west, west), so from above the plan is a staggered run of blocks, never a cross: the gate stair foot, the Gate Hall
// (square piers and flat lintels, gate wheels on the walls), the Penstock Gallery (three great pipes down its length), the
// Spillway (the stepped spillway channel down the middle), the Turbine Hall (square turbine pits, the governor's floor)
// and the Dam Heart, where the dam's master gate stands against the north wall. The door is a square gatehouse cut into
// the foot of the glacier on the east shore of the frozen lake, facing west across the ice to the Dam Crown, well clear of
// the Sluice Galleries' intake gatehouse, the ramps, the crest walk and the lake's machines. It opens once Chapter 35 is
// done (need.done m_c35_hold) and the Flumewrights have taken the valley's help to hold the dams.
DEFS.push({
  id: 'greatdam', name: 'The Great Dam', level: '50', theme: 'dam', raid: true, ox: 4800, oz: -60, w: 150, h: 222,
  door: { x: 633, z: -1622, ry: -PI / 2, label: 'The Great Dam' },
  need: { done: 'm_c36_groan', text: 'The gatehouse is barred from inside, and the Flumewrights keep the key. Junaid will unbar it once you have heard the dam out (Chapter 36: "Still Groaning").' },
  start: [76, 212], exit: [76, 217],
  rects: [
    [64, 204, 88, 218], [72, 192, 80, 206], // the gate stair foot and the stair down
    [34, 160, 118, 194], // the Gate Hall
    [38, 148, 52, 162], // passage west
    [12, 104, 70, 150], // the Penstock Gallery
    [68, 116, 86, 126], // passage east
    [84, 84, 142, 134], // the Spillway
    [92, 74, 104, 86], // passage west
    [20, 46, 112, 76], // the Turbine Hall
    [32, 34, 46, 48], // passage west
    [14, 2, 136, 36], // the Dam Heart
  ],
});

// Part Twelve: the Pump Works, the deep shafts under the Engine Rows on the Windward Heights, where the wind engines once
// drove great pumps lifting meltwater up to the plateau (dungeon, level 55). Five chambers south to north, each a plain block
// joined by a short passage set off the middle (centre, then west, then east), so from above the plan is a staggered run of
// blocks, never a cross: the Shaft Head (the stair foot under the pump house), the Rod Hall (two square shafts with pump
// rods rising and falling in them, timber staging along the walls), the Cistern Gallery (square cisterns of meltwater in
// rows, pipes overhead) and the Great Shaft, where the Great Pump's beam engine stands over the deepest shaft at the north
// wall. The door is the pump house in the trough between the first two ridges of the Engine Rows, just north of the road
// where it crosses the saddle (a levelled stone pad, shared/heights.js pumpHouse), its front to the road, 25 m or more from
// the packs, the engine pads, the Chapter 37 brake lever and the Stormplough's beat, well west of the Makers' Rest hollow.
DEFS.push({
  id: 'pumpworks', name: 'The Pump Works', level: '55', theme: 'pump', ox: 5000, oz: -60, w: 128, h: 136,
  door: { x: 545, z: -2104.5, ry: 0, label: 'The Pump Works' },
  start: [64, 126], exit: [64, 131],
  rects: [
    [54, 118, 74, 134], [60, 106, 68, 120], // the Shaft Head and the stair passage
    [26, 76, 102, 108], // the Rod Hall
    [30, 64, 44, 78], // passage west
    [12, 32, 78, 66], // the Cistern Gallery
    [74, 38, 88, 46], // passage east
    [82, 4, 122, 52], // the Great Shaft
  ],
});

// Part Twelve: the Makers' Rest, the Makers' last workshop under the hollow at the head of the Windward Heights (raid, level
// 55). Not a tomb: a long, lit, orderly workshop still running on its own. Five halls south to north, each a plain block joined
// by a short passage set off the middle (centre, east, west, east), so from above the plan is a staggered run of blocks, never
// a cross: the Tool Store (racks of labelled tools, the ramp down), the Fitting Shop (crane rails along the hall), the Board
// Loft (racks of finished sail-boards), the Turning Shop (lathe beds and line shafting), and the Governor Room, where the Great
// Governor stands against the north wall over the twelve brake rods. The door is the workshop's own front door in the hollow
// (shared/heights.js workshop), facing west onto the workshop pad. It opens once Kamal has lifted the bar (Chapter 40,
// m_c40_bar). The dungeon id is not 'makersrest': that is the Heights zone round the hollow.
DEFS.push({
  id: 'lastworkshop', name: 'The Makers’ Rest', level: '55', theme: 'workshop', raid: true, ox: 5200, oz: -60, w: 150, h: 222,
  door: { x: 626.6, z: -2100, ry: -PI / 2, label: 'The Makers’ Rest', bare: true },
  need: { done: 'm_c40_bar', text: 'The workshop door is barred, and the label on it asks for the Windwrights. Kamal will lift the bar once the hollow is read (Chapter 40: "Lift the Bar").' },
  start: [76, 212], exit: [76, 217],
  rects: [
    [64, 204, 88, 218], [72, 192, 80, 206], // the Tool Store and the ramp down
    [30, 160, 120, 194], // the Fitting Shop
    [100, 148, 114, 162], // passage east
    [80, 106, 140, 150], // the Board Loft
    [86, 92, 100, 108], // passage west
    [14, 56, 104, 94], // the Turning Shop
    [84, 42, 98, 58], // passage east
    [12, 2, 138, 44], // the Governor Room
  ],
});

// Part Thirteen: the Mill Races, the wheel pits and race tunnels the Makers cut under the tide mills on Tidewater Sound
// (dungeon, level 60). Four chambers south to north, each a plain block joined by a short passage set off the middle
// (centre, then west, then east), so from above the plan is a staggered run of blocks, never a cross: the Hatch Foot (the
// ladder well under the wheel-pit hatch), the Log Way (the timber race where logs were floated in to the saws), the Saw
// Pit (under the saw floors, the frame saws' crank pits) and the Wheel Race, where the Great Undershot, the solid wheel that
// drove every saw in the yard, stands in its race against the north wall. The sea still comes up the races on a short
// tide of its own (tide.period seconds, the sea surging through the jammed race gates): the square pits (pits: local x, z
// and the radius of the ground they flood) fill on the flood and drain on the ebb, and the bosses' strikes follow it. The
// door is the wheel-pit hatch on the stone pad held for it between the two mills (shared/tidewater.js races), its front west
// to the track that comes in from the north-west. It opens once Sawyer Hisham has lifted the bar (Chapter 43, m_c43_hatch).
DEFS.push({
  id: 'millraces', name: 'The Mill Races', level: '60', theme: 'mills', ox: 5400, oz: -60, w: 140, h: 140,
  door: { x: 545, z: -2606, ry: -PI / 2, label: 'The Mill Races' },
  need: { done: 'm_c43_hatch', text: 'The wheel-pit hatch is barred and pinned from above, and Sawyer Hisham keeps the pin. He will draw it once the Tidewrights know who is going down (Chapter 43: "The Hatch on the Pad").' },
  start: [70, 130], exit: [70, 135],
  rects: [
    [60, 122, 80, 138], [66, 110, 74, 124], // the Hatch Foot and the ladder passage
    [22, 80, 118, 112], // the Log Way
    [30, 68, 44, 82], // passage west
    [10, 34, 82, 70], // the Saw Pit
    [78, 40, 92, 48], // passage east
    [86, 4, 134, 54], // the Wheel Race
  ],
  tide: { period: 36 },
  pits: [
    [46, 102, 4.4], [94, 102, 4.4], // the Log Way: the two log sumps
    [24, 46, 4.0], [46, 60, 4.0], [68, 46, 4.0], // the Saw Pit: three crank pits
    [98, 32, 4.4], [122, 32, 4.4], [110, 42, 4.4], // the Wheel Race: three tail pits
  ],
});

// Part Thirteen: the Sea Gate, the gatehouses and winding galleries inside the Makers' barrage across the mouth of Tidewater
// Sound (raid, level 60). The dungeon id is 'barrage', not 'seagate': that is the Tidewater zone round the gate (as the
// Makers' Rest is 'lastworkshop' beside the Heights zone 'makersrest'). Five halls south to north, each a plain block joined
// by a short passage set off the middle (centre, east, west, east), so from above the plan is a staggered run of blocks,
// never a cross: the Gatehouse Stair (down from the north gatehouse), the Winch Gallery (the Gate Winch's chain drums), the
// Silt Culvert (where the Silt Ram drives the silt out of the culverts), the Sluice Gallery (the Sluice Carriage's rails)
// and the Engine Hall, where the Tide Engine that has held the gate half open for a lifetime stands against the north wall.
// The sea comes into the barrage on a short tide of its own (tide.period seconds, through the jammed bay): the square
// sluice wells (pits) fill on the flood and drain on the ebb, and the bosses' strikes follow it. The door is the north
// gatehouse's own door in its north face (shared/tidewater.js gatehouse, client tidewaterLayout stoneBlock: 2.2 m wide,
// its face 0.13 m in front of the wall), onto the gate pad. It opens once Gatewatch Nabil draws the bar at low water
// (Chapter 44, m_c44_low).
DEFS.push({
  id: 'barrage', name: 'The Sea Gate', level: '60', theme: 'seagate', raid: true, ox: 5600, oz: -60, w: 150, h: 222,
  door: { x: 620, z: -2594.9, ry: PI, label: 'The Sea Gate', bare: true },
  need: { done: 'm_c44_low', text: 'The gatehouse door is barred on the inside, below the low-water mark. Gatewatch Nabil draws the bar only at the bottom of the ebb (Chapter 44: "Low Water").' },
  start: [76, 212], exit: [76, 217],
  rects: [
    [64, 204, 88, 218], [72, 192, 80, 206], // the Gatehouse Stair and the stair passage
    [24, 160, 126, 194], // the Winch Gallery
    [104, 148, 118, 162], // passage east
    [78, 106, 140, 150], // the Silt Culvert
    [84, 92, 98, 108], // passage west
    [14, 56, 106, 94], // the Sluice Gallery
    [86, 42, 100, 58], // passage east
    [12, 2, 138, 44], // the Engine Hall
  ],
  tide: { period: 40 },
  pits: [
    [50, 180, 4.2], [100, 180, 4.2], // the Winch Gallery: two chain wells
    [92, 140, 4.0], [128, 140, 4.0], [92, 114, 4.0], [128, 114, 4.0], // the Silt Culvert: four silt sumps
    [26, 84, 4.0], [74, 84, 4.0], [26, 64, 4.0], [74, 64, 4.0], // the Sluice Gallery: four sluice wells
    [54, 30, 4.6], [96, 30, 4.6], [75, 36, 4.6], // the Engine Hall: three tide wells before the Tide Engine
  ],
});
// Part Fourteen: the Drain Adits, the stone-lined drainage tunnels the Makers drove into the hill under the Seed Terraces of the
// Rainward Gorge (dungeon, level 65). Four chambers south to north, each a plain block joined by a short passage set off the
// middle (centre, then west, then east), so from above the plan is a staggered run of blocks, never a cross: the Adit Mouth
// (the middle adit's mouth, dug clear and propped), the Long Drain (the main adit, a stone drain channel along it and side
// adits in its north wall), the Sump Gallery (square sumps under iron grates where the drains settle their silt) and the
// Collector, where every drain meets and the Adit Driver, the Makers' great drain-boring machine, stands against the north
// wall. Not a water rise: the hill is wet and the side adits are choked, so mud slips burst in through them on a timer of
// their own (slip.period seconds; slip.warn seconds of warning) and run straight down the marked lanes (lanes: local x0, z0,
// x1, z1, all running north to south, side by side, never crossing): step out of a lane before it bursts. The choked sumps
// (sumps: local x, z and the radius of the ground they flood) back up with mud while a boss works its chamber, wider each
// time, until someone stands on a sump's grate long enough to clear it. The door is the middle adit's mouth in the cliff
// behind the top steps of the Seed Terraces (shared/rainward.js adits[1], its pad held for it; the mouth faces south, its face
// 0.6 m past the pad's north edge). It opens once Drainman Mukhtar has dug the mouth clear and propped it (Chapter 47,
// m_c47_mouth).
DEFS.push({
  id: 'adits', name: 'The Drain Adits', level: '65', theme: 'adits', ox: 5800, oz: -60, w: 150, h: 142,
  door: { x: 528.5, z: -3059.4, ry: 0, label: 'The Drain Adits', bare: true },
  need: { done: 'm_c47_mouth', text: 'The adit mouth is choked with mud and stone to the lintel. Drainman Mukhtar means to dig it clear and prop it before anyone goes in (Chapter 47: "The Middle Adit").' },
  start: [72, 132], exit: [72, 137],
  rects: [
    [62, 124, 82, 140], [68, 110, 76, 126], // the Adit Mouth and the way in
    [20, 80, 124, 112], // the Long Drain
    [30, 68, 44, 82], // passage west
    [10, 34, 84, 70], // the Sump Gallery
    [80, 40, 94, 48], // passage east
    [88, 4, 146, 56], // the Collector
  ],
  slip: { period: 30, warn: 3.2 },
  lanes: [
    [23.8, 80.4, 28.2, 107.6], [55.8, 80.4, 60.2, 107.6], [83.8, 80.4, 88.2, 107.6], [107.8, 80.4, 112.2, 107.6], // the Long Drain (down to its channel)
    [33.8, 34.4, 38.2, 69.6], [55.8, 34.4, 60.2, 69.6], // the Sump Gallery
    [101.8, 4.4, 106.2, 55.6], [127.8, 4.4, 132.2, 55.6], // the Collector
  ],
  sumps: [
    [24, 44, 3.4], [47, 60, 3.4], [70, 44, 3.4], // the Sump Gallery
    [96, 34, 3.6], [138, 34, 3.6], [117, 44, 3.6], // the Collector
  ],
});
// Part Fourteen: the Upper Cutting, the Makers' deep cut at the head of the Rainward Gorge, where their machines carved the
// terraces out of the hill (raid, level 65). The raid id is 'uppercutting', not 'slip': that is the Slip region's zone id
// round the cutting's mouth (as the Sea Gate is 'barrage' beside the Tidewater zone 'seagate'). An open cut, its walls raw
// dark rock, five floors south to north, each a plain block joined by a short passage set off the middle (centre, east,
// west, east), so from above the plan is a staggered run of blocks, never a cross: the Cutting Mouth (the ramp down from
// the mouth in the head wall), the Stump Field (old stumps the Stump Puller Prime still pulls), the Spoil Run (the Spoil
// Conveyor's belt line), the Bed Floor (the Bed Ram's new beds, rammed level to an old plan) and the Cutting Face, where
// the Terrace Engine that has kept cutting the hill away for a lifetime stands against the north face. Squalls come in over
// the lip of the cut on a short cycle of their own (tide.period seconds, read by dungeonTide: 'flood' is a squall pouring,
// 'ebb' the dry spell between), and while it pours the slips run down the marked lanes: each lane a straight north-south
// run of square slip pads (pits: local x, z and the strike's radius), all the lanes parallel, never crossing. The door is
// the cutting's mouth in the gorge's head wall (shared/rainward.js cutting, client rainwardLayout: the square cut with its
// flat lintel), at the east edge of the cutting pad, facing west onto it. It opens once the rain has stopped and the
// stop-logs are lifted (Chapter 48, m_c48_dry: the cutting floods with mud while it pours).
DEFS.push({
  id: 'uppercutting', name: 'The Upper Cutting', level: '65', theme: 'cutting', raid: true, ox: 6000, oz: -60, w: 150, h: 222,
  door: { x: 657, z: -2990, ry: -PI / 2, label: 'The Upper Cutting', bare: true },
  need: { done: 'm_c48_dry', text: 'Timber stop-logs are dropped across the cutting mouth, and red mud stands behind them to the top log. Cutwatch Yaqub lifts them only once the rain has stopped (Chapter 48: "After the Rain").' },
  start: [76, 212], exit: [76, 217],
  rects: [
    [64, 204, 88, 218], [72, 192, 80, 206], // the Cutting Mouth and the ramp down
    [22, 160, 128, 194], // the Stump Field
    [102, 148, 116, 162], // passage east
    [76, 106, 140, 150], // the Spoil Run
    [84, 92, 98, 108], // passage west
    [12, 56, 108, 94], // the Bed Floor
    [86, 42, 100, 58], // passage east
    [12, 2, 138, 44], // the Cutting Face
  ],
  tide: { period: 44 }, // the squalls over the cut
  rain: true,
  pits: [
    // the Stump Field: two lanes
    ...[165.5, 171.1, 176.7, 182.3, 187.9].flatMap((z) => [[50, z, 3.4], [100, z, 3.4]]),
    // the Spoil Run: two lanes either side of the belt line
    ...[116, 121.6, 127.2, 132.8, 138.4].flatMap((z) => [[88, z, 3.4], [128, z, 3.4]]),
    // the Bed Floor: two lanes
    ...[64, 69.6, 75.2, 80.8, 86.4].flatMap((z) => [[34, z, 3.4], [86, z, 3.4]]),
    // the Cutting Face: two lanes down from the face
    ...[8, 13.6, 19.2, 24.8, 30.4, 36].flatMap((z) => [[50, z, 3.4], [100, z, 3.4]]),
  ],
});
// the slips in a dungeon with them (the Drain Adits) at world time t: n (the burst coming next, counted on the world clock),
// toBurst (seconds to it), warn (inside the warning before it), running (a burst in the lanes now: the first 1.5 s after one).
// Every player sees the same slips: the client passes the server's clock.
export function dungeonSlip(D, t) {
  const S = D?.slip;
  if (!S) return null;
  const q = t / S.period, n = Math.floor(q) + 1, toBurst = (n - q) * S.period, since = (q - Math.floor(q)) * S.period;
  return { n, toBurst, warn: toBurst <= S.warn, running: since < 1.5, since };
}
// the short tide in a dungeon with one (the Mill Races) at world time t: k 0 (dry) .. 1 (full), flood (the pits are full
// enough to drown a strike in), rising. Every player sees the same water: the client passes the server's clock.
export function dungeonTide(D, t) {
  const T = D?.tide;
  if (!T) return null;
  const ph = (((t / T.period) % 1) + 1) % 1, k = 0.5 - 0.5 * Math.cos(2 * PI * ph);
  return { k, flood: k > 0.5, rising: ph < 0.5, ph };
}

// the named area of an open region at a world point (or null)
export function dungeonArea(d, x, z) {
  const lx = x - d.ox, lz = z - d.oz;
  for (const [id, name, x0, z0, x1, z1] of d.areas || []) if (lx >= x0 && lx < x1 && lz >= z0 && lz < z1) return { id, name };
  return null;
}
export const DUNGEON_AREAS = DEFS.flatMap((d) => (d.areas || []).map(([id, name, x0, z0, x1, z1]) => ({ id, name, region: d.id, x: d.ox + (x0 + x1) / 2, z: d.oz + (z0 + z1) / 2, r: Math.min(x1 - x0, z1 - z0) / 2 })));
// the middle of a named area in world coordinates and a radius for quest markers: [x, z, r] (or null)
export function areaCenter(id) { const a = DUNGEON_AREAS.find((q) => q.id === id); return a ? [a.x, a.z, Math.max(4, a.r * 0.6)] : null; }

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}

function build(d) {
  const nx = Math.round(d.w / CELL), nz = Math.round(d.h / CELL);
  const grid = new Uint8Array(nx * nz);
  const cave = d.theme === 'mine' || d.theme === 'warren' || d.theme === 'ore';
  for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
    let floor = false;
    const n = cave ? (vnoise(x * 0.11, z * 0.11, 501) - 0.5) : 0;
    for (const [cx, cz, rx, rz] of d.ellipses || []) if (((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 < 1 + n * 0.5) floor = true;
    for (const [pts, w] of d.paths || []) for (let k = 0; k < pts.length - 1 && !floor; k++) if (segDist(x, z, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]) < w / 2 + n * 1.6) floor = true;
    for (const [x0, z0, x1, z1] of d.rects || []) if (x > x0 && x < x1 && z > z0 && z < z1) floor = true;
    grid[j * nx + i] = floor ? 1 : 0;
  }
  const out = { ...d, nx, nz, grid };
  out.startW = [d.ox + d.start[0], d.oz + d.start[1]];
  out.exitW = [d.ox + d.exit[0], d.oz + d.exit[1]];
  if (d.grave) out.graveW = [d.ox + d.grave[0], d.oz + d.grave[1]];
  return out;
}

export const DUNGEONS = DEFS.map(build);
export const DUNGEON_BY_ID = Object.fromEntries(DUNGEONS.map((d) => [d.id, d]));

export function dungeonAt(x, z) {
  if (x < DUNGEON_MIN_X) return null;
  for (const d of DUNGEONS) if (x >= d.ox && x < d.ox + d.w && z >= d.oz && z < d.oz + d.h) return d;
  return null;
}
export function cellFloor(d, i, j) { return i >= 0 && j >= 0 && i < d.nx && j < d.nz && d.grid[j * d.nx + i] === 1; }
export function isFloor(d, x, z) { return cellFloor(d, Math.floor((x - d.ox) / CELL), Math.floor((z - d.oz) / CELL)); }
export function dungeonWorld(d, lx, lz) { return [d.ox + lx, d.oz + lz]; }

// push a circle (x, z, radius r) out of the rock cells around it; returns [x, z]
export function dungeonPush(x, z, r = 0.45) {
  const d = dungeonAt(x, z);
  if (!d) return x >= DUNGEON_MIN_X ? [DUNGEONS[0].startW[0], DUNGEONS[0].startW[1]] : [x, z];
  for (let it = 0; it < 2; it++) {
    const ci = Math.floor((x - d.ox) / CELL), cj = Math.floor((z - d.oz) / CELL);
    if (!cellFloor(d, ci, cj)) {
      // stuck inside rock: hop to the nearest floor cell
      let best = null, bd = 1e9;
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) if (cellFloor(d, ci + di, cj + dj)) { const k = di * di + dj * dj; if (k < bd) { bd = k; best = [ci + di, cj + dj]; } }
      if (!best) return [...d.startW];
      x = d.ox + (best[0] + 0.5) * CELL; z = d.oz + (best[1] + 0.5) * CELL;
      continue;
    }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = ci + di, j = cj + dj;
      if (cellFloor(d, i, j)) continue;
      const x0 = d.ox + i * CELL, z0 = d.oz + j * CELL;
      const qx = Math.max(x0, Math.min(x0 + CELL, x)), qz = Math.max(z0, Math.min(z0 + CELL, z));
      const dx = x - qx, dz = z - qz, dd = Math.hypot(dx, dz);
      if (dd < r && dd > 1e-6) { x = qx + (dx / dd) * r; z = qz + (dz / dd) * r; }
    }
  }
  return [x, z];
}

// a random floor point within radius r of a local point (for spawns)
export function dungeonSpot(d, lx, lz, r, rand = Math.random) {
  for (let k = 0; k < 24; k++) {
    const a = rand() * PI * 2, rr = Math.sqrt(rand()) * r;
    const x = d.ox + lx + Math.cos(a) * rr, z = d.oz + lz + Math.sin(a) * rr;
    if (isFloor(d, x, z) && isFloor(d, x + 1, z) && isFloor(d, x - 1, z) && isFloor(d, x, z + 1) && isFloor(d, x, z - 1)) return [x, z];
  }
  return [d.ox + lx, d.oz + lz];
}
