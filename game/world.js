// Client world: terrain, water, grass and every static prefab placed by biome rules.
import * as THREE from 'three';
import { G, CUT_SLOTS, CUT_PARTS } from '../engine/globals.js';
import { createShafts } from '../engine/shafts.js';
import { REACH, RIME, islandAt } from '/sunmere-play/shared/terrain.js';
import { reachHeight, reachGround } from '/sunmere-play/shared/reach.js';
import { rimeHeight, rimeGround, rimeWater } from '/sunmere-play/shared/rime.js';
import { buildReach } from './reachLayout.js';
import { buildRime } from './rimeLayout.js';
import { HEIGHTS, heightsHeight, heightsGround } from '/sunmere-play/shared/heights.js';
import { buildHeights, buildRimeLift } from './heightsLayout.js';
import { TIDEWATER, tidewaterHeight, tidewaterGround } from '/sunmere-play/shared/tidewater.js';
import { buildTidewater } from './tidewaterLayout.js';
import { RAINWARD, rainwardHeight, rainwardGround } from '/sunmere-play/shared/rainward.js';
import { buildRainward } from './rainwardLayout.js';
import { WEALD, wealdHeight, wealdGround } from '/sunmere-play/shared/weald.js';
import { buildWeald } from './wealdLayout.js';
import { WORLD, ZONES, LAKE, ROADS, WATERFALL, roadDist, desertWeight, gladeWeight, forestWeight, highreachWeight, alpineWeight, snowWeight, coastWeight, flatsWeight, wildWeight, edgeE, inVillage, streamInfo } from '/sunmere-play/shared/terrain.js';
import { buildVillage } from './villageLayout.js';
import { buildQuarry } from './quarryLayout.js';
import { buildZones } from './zonesLayout.js';
import { DUNGEONS, DUNGEON_MIN_X, dungeonAt, dungeonPush } from '/sunmere-play/shared/dungeons.js';
import { buildDungeon, dungeonEntrance } from '../assets/dungeon.js';
import { mulberry32, fbm } from '/sunmere-play/shared/noise.js';
import { Terrain } from '../engine/terrain.js';
import { HOME_SPOTS, HOME_MOVABLE } from '/sunmere-play/shared/data.js';
import { createLake, createSea, createWaterfall, createStream, createChannels } from '../engine/water.js';
import { createGrass } from '../engine/grass.js';
import { Scatter } from './scatter.js';
import * as trees from '../assets/trees.js';
import { Builder, movePane } from '../assets/kit.js';
import * as B from '../assets/buildings.js';
import * as P from '../assets/props.js';
import { assemble, swingFocus } from '../assets/dynamic.js';
import * as D from '../assets/dressing.js';
import { allHouses, housesIn, houseAt, HOUSE_GROUP_AREA } from '/sunmere-play/shared/houses.js';
import { buildHouseGroup, buildInterior, buildCutCaps, cutParts, cutKeep, CUT_LOW, CUT_CEIL } from '../assets/houses/index.js';
import { modelSlot, tripoEnabled } from '../assets/tripoModels.js';
import { IS_MOBILE } from '../engine/platform.js';
import { QUALITY } from '../engine/globals.js';
import { fxLightCount } from './fx.js';
import { freezeStatic } from './freeze.js';
import { buildShadowProxies } from './layers.js';
import { cutDepthMaterial } from '../engine/materials.js';
import { cgtEnabled, shellGroup } from '../assets/houses/cgt.js';
import { buildRamYard } from './ramLayout.js';

// Enterable houses (houses spec §6, WP3). Each settlement group's houses are built by the house builders (WP2) into one
// merged shell and one detail object in its area group; spec.walls go into this.boxes exactly as given (world boxes, never
// turned again), so the client pushes out of the same walls the server checks. world.house is the house you stand in
// (hysteresis: in when inside spec.inner, out 0.6 m past it), which drives the camera's house mode, the shader cut-away
// (globals.js cut*), the light-pool priority and engine.setHouseLight. Interiors are built on demand (updateHouses).
// v108: the cut-away is RuneScape style (updateCuts): every wall of the open house goes down to a 0.8 m wainscot with a
// sill strip on top, the roof, upper walls and ceiling go, for the house you stand in and any house hiding you from the
// camera; eased over 0.35 s, with hysteresis, the same on every side (no camera-side walls flipping as the view turns).
const HOUSE = {
  BUILD_R: 30, FREE_R: 45, LIVE: IS_MOBILE ? 2 : 3, LRU: IS_MOBILE ? 1 : 4, // interiors: built within 30 m (at most LIVE), freed beyond 45 m
  DETAIL_R: IS_MOBILE ? 45 : 70, // the detail builder (flowers, hardware, yard props) is hidden beyond this
  OUT: 0.6, // world.house is kept until you are this far outside its inner rect
  CUT_EASE: 0.35,
};
const _cutHead = new THREE.Vector3();
const _lampAmber = new THREE.Color(0xff9440); // (judge) street lamps' light leans amber, so the grass under them reads warm, not lime
const toLocal = (S, x, z) => { const c = Math.cos(S.rot), s = Math.sin(S.rot), dx = x - S.x, dz = z - S.z; return [dx * c - dz * s, dx * s + dz * c]; };

const VARIANTS = {
  oak: 3, pine: 3, lilac: 2, palm: 3, glowbark: 2, bushGreen: 3, bushRed: 2, fern: 2, rock: 5, rockDesert: 4,
  log: 2, stump: 2, flowerPatch: 3, dryBush: 2, cactus: 2, reeds: 2,
};

function flowerPatch(seed) {
  const b = new Builder(seed);
  const kinds = ['flowers', 'flowers', 'lavender', 'grassCard'];
  for (let i = 0; i < 9; i++) {
    const a = b.r(0, Math.PI * 2), d = Math.sqrt(b.r(0, 1)) * 1.6;
    trees.addTuft(b, kinds[(i + seed) % kinds.length], [Math.cos(a) * d, 0, Math.sin(a) * d], b.r(0.55, 0.8), b.r(0.4, 0.65), b.r(0, 3), 0xffffff, 2);
  }
  return { builder: b };
}

function rockPrefab(seed, desert) {
  const b = new Builder(seed);
  const n = 1 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const s = i === 0 ? 1 : 0.55;
    trees.addRock(b, [i === 0 ? 0 : b.r(-1, 1), 0, i === 0 ? 0 : b.r(-1, 1)], [b.r(0.8, 1.5) * s, b.r(0.6, 1.0) * s, b.r(0.8, 1.4) * s], seed * 7 + i,
      desert ? { mat: 'rockSand', moss: 0, tint: '#ffffff' } : { moss: 0.7 });
  }
  return { builder: b, collider: { r: 1.1 } };
}

const COL_CELL = 8; // collide grid cell (m)
const numAsc = (a, b) => a - b;

export class World {
  constructor(engine, onProgress = () => {}) {
    this.engine = engine;
    this.group = new THREE.Group();
    // the outdoor areas: everything placed in the valley, on the Cinder Reach and on the Rime Steps (setArea shows one)
    this.valleyGroup = new THREE.Group(); this.valleyGroup.name = 'valley';
    this.reachGroup = new THREE.Group(); this.reachGroup.name = 'reach'; this.reachGroup.visible = false;
    this.rimeGroup = new THREE.Group(); this.rimeGroup.name = 'rime'; this.rimeGroup.visible = false;
    this.heightsGroup = new THREE.Group(); this.heightsGroup.name = 'heights'; this.heightsGroup.visible = false;
    this.tidewaterGroup = new THREE.Group(); this.tidewaterGroup.name = 'tidewater'; this.tidewaterGroup.visible = false;
    this.rainwardGroup = new THREE.Group(); this.rainwardGroup.name = 'rainward'; this.rainwardGroup.visible = false;
    this.wealdGroup = new THREE.Group(); this.wealdGroup.name = 'weald'; this.wealdGroup.visible = false;
    this.areaGroups = { valley: this.valleyGroup, reach: this.reachGroup, rime: this.rimeGroup, heights: this.heightsGroup, tidewater: this.tidewaterGroup, rainward: this.rainwardGroup, weald: this.wealdGroup };
    this.group.add(this.valleyGroup, this.reachGroup, this.rimeGroup, this.heightsGroup, this.tidewaterGroup, this.rainwardGroup, this.wealdGroup);
    this.area = 'valley';
    onProgress(0.1, 'Shaping the land…');
    this.terrain = new Terrain();
    this.valleyGroup.add(this.terrain.group);
    // the island's own terrain box: the valley terrain hands every lookup inside it on (terrain.alt)
    this.reachTerrain = new Terrain({ minX: REACH.minX, maxX: REACH.maxX, minZ: REACH.minZ, maxZ: REACH.maxZ, cell: 1.25, height: reachHeight, ground: reachGround, chunks: 6, segs: 40, theme: 'reach' });
    this.terrain.alts.push(this.reachTerrain);
    this.reachGroup.add(this.reachTerrain.group);
    // the Rime Steps: a third box, the same shared ground textures with a cold look
    this.rimeTerrain = new Terrain({ minX: RIME.minX, maxX: RIME.maxX, minZ: RIME.minZ, maxZ: RIME.maxZ, cell: 1.25, height: rimeHeight, ground: rimeGround, chunks: 6, segs: 40, theme: 'rime' });
    this.terrain.alts.push(this.rimeTerrain);
    this.rimeGroup.add(this.rimeTerrain.group);
    // the Windward Heights: a fourth box above the cloud, the same shared textures with a wind-scoured look
    this.heightsTerrain = new Terrain({ minX: HEIGHTS.minX, maxX: HEIGHTS.maxX, minZ: HEIGHTS.minZ, maxZ: HEIGHTS.maxZ, cell: 1.25, height: heightsHeight, ground: heightsGround, chunks: 6, segs: 40, theme: 'heights' });
    this.terrain.alts.push(this.heightsTerrain);
    this.heightsGroup.add(this.heightsTerrain.group);
    // Tidewater Sound: a fifth box, salt-burnt grass, shingle and wet mud (the terrain's tidewater theme)
    this.tidewaterTerrain = new Terrain({ minX: TIDEWATER.minX, maxX: TIDEWATER.maxX, minZ: TIDEWATER.minZ, maxZ: TIDEWATER.maxZ, cell: 1.25, height: tidewaterHeight, ground: tidewaterGround, chunks: 6, segs: 40, theme: 'tidewater' });
    this.terrain.alts.push(this.tidewaterTerrain);
    this.tidewaterGroup.add(this.tidewaterTerrain.group);
    // the Rainward Gorge: a sixth box, deep wet green, dark wet rock, red-brown mud (the terrain's rainward theme)
    this.rainwardTerrain = new Terrain({ minX: RAINWARD.minX, maxX: RAINWARD.maxX, minZ: RAINWARD.minZ, maxZ: RAINWARD.maxZ, cell: 1.25, height: rainwardHeight, ground: rainwardGround, chunks: 6, segs: 40, theme: 'rainward' });
    this.terrain.alts.push(this.rainwardTerrain);
    this.rainwardGroup.add(this.rainwardTerrain.group);
    // the Russet Weald: a seventh box, copper and gold leaf litter, trodden rides, pale sawdust, grey banks (the terrain's weald theme)
    this.wealdTerrain = new Terrain({ minX: WEALD.minX, maxX: WEALD.maxX, minZ: WEALD.minZ, maxZ: WEALD.maxZ, cell: 1.25, height: wealdHeight, ground: wealdGround, chunks: 6, segs: 40, theme: 'weald' });
    this.terrain.alts.push(this.wealdTerrain);
    this.wealdGroup.add(this.wealdTerrain.group);
    this.areaTerrains = { valley: this.terrain, reach: this.reachTerrain, rime: this.rimeTerrain, heights: this.heightsTerrain, tidewater: this.tidewaterTerrain, rainward: this.rainwardTerrain, weald: this.wealdTerrain };
    onProgress(0.35, 'Filling the lake…');
    this.lake = createLake(this.terrain, engine.sunDir);
    this.valleyGroup.add(this.lake);
    this.sea = createSea(this.terrain, engine.sunDir);
    this.valleyGroup.add(this.sea);
    this.reachSea = createSea(this.reachTerrain, engine.sunDir, { x: (REACH.minX + REACH.maxX) / 2, z: (REACH.minZ + REACH.maxZ) / 2, w: 1500, h: 1500 });
    this.reachGroup.add(this.reachSea);
    // the cold sea round the Rime Steps (greener-grey and darker), and the running meltwater in the two channels
    this.rimeSea = createSea(this.rimeTerrain, engine.sunDir, { x: (RIME.minX + RIME.maxX) / 2, z: (RIME.minZ + RIME.maxZ) / 2, w: 1500, h: 1500 });
    { const u = this.rimeSea.material.uniforms; u.uDeep.value.set('#10303e'); u.uShallow.value.set('#3e7684'); u.uSky.value.set('#b4c8d6'); u.uFoam.value.set('#eef4f8'); }
    this.rimeGroup.add(this.rimeSea);
    this.rimeChannels = createChannels(this.rimeTerrain, engine.sunDir, RIME.channels, (x, z) => { const w = rimeWater(x, z); return w !== null && w > RIME.water + 0.05 ? w : null; });
    this.rimeGroup.add(this.rimeChannels);
    // the grey-green sea of Tidewater Sound: one sheet, raised and lowered with the tide each frame (tidewaterLayout.js tick)
    this.tidewaterSea = createSea(this.tidewaterTerrain, engine.sunDir, { x: (TIDEWATER.minX + TIDEWATER.maxX) / 2, z: (TIDEWATER.minZ + TIDEWATER.maxZ) / 2, w: 1500, h: 1500 });
    { const u = this.tidewaterSea.material.uniforms; u.uDeep.value.set('#1c3a3c'); u.uShallow.value.set('#56786e'); u.uSky.value.set('#b8c4c6'); u.uFoam.value.set('#e2e6e0'); }
    this.tidewaterGroup.add(this.tidewaterSea);
    this.waterfall = createWaterfall(this.terrain);
    this.valleyGroup.add(this.waterfall);
    this.stream = createStream(this.terrain, engine.sunDir);
    this.valleyGroup.add(this.stream);
    onProgress(0.45, 'Growing the meadows…');
    this.grass = createGrass(this.terrain);
    this.valleyGroup.add(this.grass); // the island has no grass: it hides with the valley
    onProgress(0.55, 'Planting the forests…');
    this.scatter = new Scatter();
    this.buildPrefabs();
    this.boxes = [];
    this.dyn = [];
    // enterable houses: the built settlement groups, the interiors built near you (live or kept hidden in an LRU), the house
    // you stand in, the light spots of the live interiors, and the cut-away's fade
    this.houseGroups = new Map(); this.interiors = new Map(); this.houseLru = []; this.houseQueue = [];
    this.house = null; this.houseSpots = []; this.baseSpots = null; this._houseT = 0; this._cutS = null; this._cutK = 0;
    this.houseSkips = []; this.houseOverlaps = [];
    this.guardScatter(this.scatter);
    // open glades kept free of trees: camps, NPCs, monster grounds
    this.clearings = [{ x: -32, z: 90, r: 17 }, { x: -184, z: -188, r: 15 }, { x: -224, z: -224, r: 19 }, { x: -242, z: -242, r: 7 }, { x: 48, z: -24, r: 12.5 }, { x: -66, z: -78, r: 11 }, { x: -104, z: -112, r: 9 }, { x: -78, z: -56, r: 15 }, { x: -70, z: -8, r: 14 }, { x: 128, z: -128, r: 7 }, { x: 68, z: -40, r: 12 }, { x: 120, z: 40, r: 12 },
      { x: 178, z: -128, r: 12 }, { x: -104, z: -110, r: 16 }, { x: -124, z: -16, r: 20 }, { x: -205, z: -62, r: 21 }, { x: 198, z: 148, r: 22 }, { x: -148, z: 202, r: 20 }, { x: -40, z: 170, r: 18 }, { x: -196, z: 40, r: 24 }, { x: 6, z: -206, r: 22 }, { x: -170, z: -46, r: 11 }, { x: -160, z: -92, r: 10 }, { x: -192, z: -112, r: 9 }, { x: 166, z: -96, r: 8 }, { x: 182, z: 140, r: 8 },
      ...DUNGEONS.map((D) => ({ x: D.door.x, z: D.door.z, r: 9 }))];
    onProgress(0.62, 'Raising the village...');
    this.buildSettlements();
    buildRamYard(this); // LF.6 the Ram Engine's yard, road, piles and engine on the Harrow Coast (before the scatter: kept clear)
    this.populate();
    this.valleyGroup.add(this.scatter.build());
    this.colliders = this.scatter.colliders;
    onProgress(0.72, 'Crossing the sea…');
    this.buildReach();
    onProgress(0.76, 'Sailing north…');
    this.buildRime();
    onProgress(0.78, 'Riding the lift…');
    this.buildHeights();
    onProgress(0.79, 'Waiting for the tide…');
    this.buildTidewater();
    onProgress(0.795, 'Up the haul road…');
    this.buildRainward();
    onProgress(0.797, 'Over the ridge by the rope…');
    this.buildWeald();
    onProgress(0.8, 'Digging the dungeons…');
    this.buildDungeons();
    this.shafts = createShafts(this.shaftSpots, engine.sunDir);
    this.valleyGroup.add(this.shafts);
    onProgress(0.9, 'Lighting the lanterns…');
    this.buildShadowProxies(); // (game.js switches them on, and calls freezeWorld after engine/slim.js on phones)
  }

  // what moves, toggles or is rebuilt at run time (never merged into a shadow proxy, never frozen): the house shells (the
  // cut-away) and their detail (shown by distance), house interiors, doors, the homestead's furnishings and the valley's
  // build stages (both toggled and moved: userData.cols), water, grass, shafts, the light pools and lights
  _runtimeSet() {
    const S = new Set([this.grass, this.lake, this.sea, this.reachSea, this.rimeSea, this.rimeChannels, this.tidewaterSea, ...(this.tidewaterRuntime || []), ...(this.rainwardRuntime || []), ...(this.wealdRuntime || []), this.waterfall, this.stream, this.shafts, ...this.lightPool]);
    for (const g of this.houseGroups.values()) { S.add(g.shell); S.add(g.detail); }
    for (const o of Object.values(this.home || {})) for (const x of Array.isArray(o) ? o : [o]) if (x) S.add(x);
    for (const list of this.valleyParts?.parts || []) for (const x of list) S.add(x);
    for (const x of [this.valleyParts?.scaffold, this.reachShip, this.rimeShip, this.reachIceBow, this.harrowIceBow]) if (x) S.add(x);
    return S;
  }
  _runtimeExclude(S) { return (o) => S.has(o) || !!o.userData.houseInt || !!o.userData.door || !!o.userData.houseGroup; }

  // B1: shadow-only proxies. The static opaque casters of each outdoor area and dungeon are merged into a few depth-only
  // meshes per 48 m cell on SHADOW_LAYER; the engine switches the shadow camera to them (engine.useShadowProxies). An
  // assembled building (assets/dynamic.js) carries userData.update only for its fires, smoke and lanterns: its own shell is
  // static, so it is opened up for the proxy build (its moving children keep their own update and stay out).
  // Built before engine/slim.js frees the vertex copies on phones. ?proxies=0 leaves them off (bench A/B).
  buildShadowProxies() {
    this.shadowProxies = [];
    if (/[?&]proxies=0/.test(globalThis.location?.search || '')) return;
    const run = this._runtimeSet(), ex = this._runtimeExclude(run);
    const opened = [];
    const roots = [...Object.values(this.areaGroups), ...[...this.dungeonViews.values()].map((v) => v.group)];
    for (const r of roots) r.traverse((o) => { if (o !== r && o._demand && o.userData.update && !run.has(o)) { opened.push([o, o.userData.update]); o.userData.update = null; } });
    const dynList = this.dyn.filter((o) => !o._demand || run.has(o));
    const hidden = roots.filter((r) => !r.visible); // (the islands are hidden until you sail there: build them as shown)
    for (const r of hidden) r.visible = true;
    try {
      for (const r of roots) this.shadowProxies.push(buildShadowProxies(r, { exclude: ex, dynamic: dynList, freeArrays: IS_MOBILE }));
    } finally { for (const [o, up] of opened) o.userData.update = up; for (const r of hidden) r.visible = false; }
    for (const s of [this.scatter, this.reachScatter, this.rimeScatter, this.heightsScatter, this.tidewaterScatter, this.rainwardScatter, this.wealdScatter]) if (s?.buildShadowProxies) this.shadowProxies.push(s.buildShadowProxies());
  }

  // D1: freeze the static world's matrices (client/game/freeze.js): computed once, then the scene walk skips them. Everything
  // that moves stays walking (anything with an update, the scatter's dynamic props, the runtime set above). The world
  // group and the area groups stay walking too: house interiors and the light pools are added to them later.
  freezeWorld() {
    if (/[?&]freeze=0/.test(globalThis.location?.search || '')) return;
    const run = this._runtimeSet(), ex = this._runtimeExclude(run);
    // (the world and area groups hold lights and fires, so they keep walking and only their static children freeze)
    const dynamic = [...this.dyn, ...run];
    for (const s of [this.scatter, this.reachScatter, this.rimeScatter, this.heightsScatter, this.tidewaterScatter, this.rainwardScatter, this.wealdScatter]) if (s?.dynamics) dynamic.push(...s.dynamics);
    this.freezeInfo = freezeStatic(this.group, { dynamic, exclude: ex });
    // a hidden area or dungeon (every one but the place you are in) is not walked for matrices at all: nothing of it is
    // drawn, and its static parts keep the matrices they had; the walk on the frame it shows again brings it up to date
    for (const c of this.group.children) {
      if (!c.isGroup || c._hiddenSkip) continue;
      const f = c.updateMatrixWorld;
      c._hiddenSkip = true;
      c.updateMatrixWorld = function (force) { if (this.visible) f.call(this, force); };
    }
  }

  buildPrefabs() {
    const S = this.scatter;
    for (let v = 0; v < VARIANTS.oak; v++) S.addPrefab('oak' + v, trees.oak(v + 1));
    for (let v = 0; v < VARIANTS.pine; v++) S.addPrefab('pine' + v, trees.pine(v + 1));
    for (let v = 0; v < VARIANTS.lilac; v++) S.addPrefab('lilac' + v, trees.lilac(v + 1));
    for (let v = 0; v < VARIANTS.palm; v++) S.addPrefab('palm' + v, trees.palm(v + 1));
    for (let v = 0; v < VARIANTS.glowbark; v++) S.addPrefab('glowbark' + v, trees.glowbark(v + 1));
    for (let v = 0; v < VARIANTS.bushGreen; v++) S.addPrefab('bushGreen' + v, trees.bush(v + 1, { kind: 'green' }));
    for (let v = 0; v < VARIANTS.bushRed; v++) S.addPrefab('bushRed' + v, trees.bush(v + 11, { kind: 'red' }));
    for (let v = 0; v < VARIANTS.fern; v++) S.addPrefab('fern' + v, trees.fernPlant(v + 1));
    for (let v = 0; v < VARIANTS.rock; v++) S.addPrefab('rock' + v, rockPrefab(v + 3, false));
    for (let v = 0; v < VARIANTS.rockDesert; v++) S.addPrefab('rockDesert' + v, rockPrefab(v + 31, true));
    for (let v = 0; v < VARIANTS.log; v++) S.addPrefab('log' + v, D.fallenLog(v + 1));
    for (let v = 0; v < VARIANTS.stump; v++) S.addPrefab('stump' + v, D.stump(v + 1));
    for (let v = 0; v < VARIANTS.flowerPatch; v++) S.addPrefab('flowerPatch' + v, flowerPatch(v + 1));
    for (let v = 0; v < VARIANTS.dryBush; v++) S.addPrefab('dryBush' + v, D.dryBush(v + 1));
    for (let v = 0; v < VARIANTS.cactus; v++) S.addPrefab('cactus' + v, D.barrelCactus(v + 1));
    for (let v = 0; v < VARIANTS.reeds; v++) S.addPrefab('reeds' + v, D.reeds(v + 1));
    S.addPrefab('lily', D.lilyPads(1));
    S.addPrefab('pillar0', D.sandPillar(3));
    S.addPrefab('pillar1', D.sandPillar(7));
    S.addPrefab('palisade', D.palisade(4));
    S.addPrefab('weaponRack', D.weaponRack(5));
    S.addPrefab('raiderBanner', D.raiderBanner(6));
    S.addPrefab('scrap0', D.scrapHeap(7));
    S.addPrefab('scrap1', D.scrapHeap(11));
    S.addPrefab('coal', D.coalPile(8));
    S.addPrefab('mineCart', D.mineCart(9));
    S.addPrefab('hayBales', D.hayBales(10));
    S.addPrefab('flowerBed', D.flowerBed(12));
  }

  // the group an object at (x, z) belongs to: its outdoor area's (the valley's for anything not in an island box)
  groupAt(x, z) { const A = islandAt(x, z); return A ? this.areaGroups[A.id] : this.valleyGroup; }
  // place a building / prop result as its own object (rotY turns its front, which faces +z)
  placeObject(res, x, z, rotY = 0, yOff = 0) {
    const T = this.terrain;
    if (this.inHouseFoot(x, z)) this.houseOverlaps.push(`${x.toFixed(1)},${z.toFixed(1)}`); // (listed by the off-screen checks)
    const obj = assemble(res);
    obj.position.set(x, T.height(x, z) + yOff, z);
    obj.rotation.y = rotY;
    this.groupAt(x, z).add(obj);
    this.dyn.push(obj);
    const c = Math.cos(rotY), s2 = Math.sin(rotY);
    const cols = (obj.userData.cols = []);
    for (const col of res.colliders || (res.collider ? [res.collider] : [])) {
      const cx = col.x || 0, cz = col.z || 0;
      const wx = x + cx * c + cz * s2, wz = z - cx * s2 + cz * c;
      const e = col.r ? { x: wx, z: wz, r: col.r } : { x: wx, z: wz, hw: col.hw, hd: col.hd, rot: (col.rot || 0) + rotY };
      (col.r ? this.scatter.colliders : this.boxes).push(e);
      cols.push(e);
    }
    return obj;
  }

  // place a result built in world coordinates (terrace, hall, bridges, merged groups)
  placeAbs(res) { return this.placeAt(res, 0, 0, 0, 0); }
  // place a local result at an absolute position and turn
  placeAt(res, x, y, z, rotY = 0) {
    const obj = assemble(res);
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    this.groupAt(x, z).add(obj);
    this.dyn.push(obj);
    const c = Math.cos(rotY), s2 = Math.sin(rotY);
    for (const col of res.colliders || (res.collider ? [res.collider] : [])) {
      const cx = col.x || 0, cz = col.z || 0;
      const wx = x + cx * c + cz * s2, wz = z - cx * s2 + cz * c;
      if (col.r) this.scatter.colliders.push({ x: wx, z: wz, r: col.r });
      else this.boxes.push({ x: wx, z: wz, hw: col.hw, hd: col.hd, rot: (col.rot || 0) + rotY });
    }
    return obj;
  }

  buildSettlements() {
    const S = this.scatter;
    const pre = (key, res) => { if (!S.prefabs.has(key)) S.addPrefab(key, res); };
    pre('lantern', P.lanternPost(1, 'yellow'));
    pre('lanternGreen', P.lanternPost(2, 'green'));
    pre('fence', P.fence(3, 3));
    pre('signpost', P.signpost(4));
    pre('crates', P.crateStack(5));
    pre('bench', P.bench(6));
    pre('haystack', P.haystack(7));
    pre('mushrooms', P.giantMushrooms(8));
    pre('crystalTeal', P.crystals(9, 'crystalTeal'));
    pre('crystalPurple', P.crystals(10, 'crystalPurple'));
    pre('tent', P.raiderTent(11));
    pre('column', P.brokenColumn(12));
    pre('column2', P.brokenColumn(17));
    const T = this.terrain;
    const put = (key, x, z, r = 0, s = 1) => S.place(key, x, T.height(x, z) - 0.02, z, r, s);
    // --- Sunmere Village (layout in villageLayout.js)
    buildVillage(this);
    buildQuarry(this);
    buildZones(this);
    // --- Greenwood woodcutter camp
    this.placeObject(P.campfire(5), -66, -78, 0);
    for (const [x, z] of [[-62, -74], [-70, -73], [-71, -82], [-61, -83]]) put('stump' + ((x + z) & 1), x, z, x);
    put('log0', -58, -79, 0.4); put('log1', -73, -86, 2.0); put('crates', -64, -71, 1.1);
    // --- Brightfield Farms
    this.placeObject(D.wheatField(1, 12, 8), 104, 4, 0.08);
    this.placeObject(D.wheatField(2, 10, 7), 113, 22, -0.1);
    this.placeObject(D.wheatField(3, 9, 7), 90, 24, 0.2);
    this.buildHouses('fields'); // the Brightfield farmhouse (enterable; shared/houses.js bf_farm)
    this.placeObject(D.barn(2), 126, -2, -Math.PI / 2 + 0.2);
    this.placeObject(D.trough(3), 93, -2, 0.3);
    put('hayBales', 118, 14, 0.4); put('hayBales', 100, 33, 1.2); put('haystack', 96, 14, 0); put('haystack', 120, 32, 1);
    this.placeObject(P.cart(9), 80, 2, 1.6);
    put('flowerBed', 80, -3.5, 0);
    // fences framing the fields
    for (let i = 0; i < 5; i++) put('fence', 98.5 + i * 3, -1.2, 0.08);
    for (let i = 0; i < 5; i++) put('fence', 98.5 + i * 3, 9.6, 0.08);
    for (let i = 0; i < 3; i++) put('fence', 96.5, 1.6 + i * 3, Math.PI / 2 + 0.08);
    // --- Dunewatch Post
    this.placeObject(B.watchtower(6), -46, 170, 0.5);
    this.buildHouses('dunewatch'); // (v109) four desert houses round the post (background, shared/houses.js bg_dw_*)
    for (const g of ['brasswind', 'raidercamp', 'vaultruins', 'saltcamp', 'kilnworks']) this.buildHouses(g); // (v110) the other desert towns and camps (bg_bw_*, bg_dc_1, bg_ss_1, bg_sp_1, bg_kw_1)
    // crates, lanterns and the campfire square are dressed in zonesLayout.js (no doubled dressing)
    for (const [x, z] of [[-30, 182], [-54, 184], [-58, 158], [-26, 160], [-60, 172]]) put('palm' + ((x + z) % 3 + 3) % 3, x, z, x, 1.1);
    put('cactus0', -52, 162, 1); put('weaponRack', -38, 176, 0.4);
    // --- Dustcloak Camp (raiders)
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; put('tent', 112 + Math.cos(a) * 15, 232 + Math.sin(a) * 12, -a); }
    this.placeObject(P.campfire(1), 108, 228, 0);
    this.placeObject(P.campfire(2), 122, 238, 0);
    this.placeObject(B.ruinArch(7), 124, 250, 0.4);
    this.placeObject(B.ruinArch(8), 40, 205, -0.6);
    put('crates', 100, 240, 0.4); put('crates', 128, 224, 1.4);
    {
      const cx = 112, cz = 232, R = 23;
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2;
        const gap = Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.2 || Math.abs(Math.atan2(Math.sin(a - 0.7), Math.cos(a - 0.7))) < 0.14;
        if (gap) continue;
        const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R * 0.85;
        put('palisade', x, z, -(a + Math.PI / 2));
        this.scatter.colliders.push({ x, z, r: 1.5 });
      }
      for (const [x, z, r] of [[104, 222, 0.3], [122, 242, 2.2], [110, 246, 3.0]]) put('weaponRack', x, z, r);
      this.placeObject(P.chiefPavilion(1), 116, 246, Math.PI);
      for (const [x, z, r] of [[106, 236, 0.5], [118, 226, 2.0], [100, 228, 1.2], [126, 232, 2.8]]) put('crates', x, z, r);
      for (const [x, z] of [[92, 230], [94, 238], [130, 236], [114, 214]]) put('raiderBanner', x, z, 0);
    }
    for (const [x, z, k] of [[20, 150, 0], [72, 142, 1], [150, 196, 0], [-84, 222, 1], [182, 252, 0], [58, 262, 1], [-120, 162, 0], [168, 160, 1], [-10, 210, 0], [95, 175, 1], [-150, 230, 1], [210, 210, 0]]) put('pillar' + k, x, z, x * 0.1, 1);
    // ruined colonnades scattered across the Sunscar
    for (const [cx, cz, n, rot] of [[30, 180, 5, 0.3], [140, 168, 4, -0.5], [-100, 196, 6, 0.9], [70, 230, 4, 1.4], [-30, 240, 5, -0.2]]) {
      for (let i = 0; i < n; i++) put(i % 2 ? 'column2' : 'column', cx + Math.cos(rot) * i * 3.2, cz + Math.sin(rot) * i * 3.2, rot + i);
      put('rockDesert' + (n % 4), cx - 3, cz + 2, rot, 1.8);
    }
    // --- Glimmer Glade
    this.placeObject(B.ruinArch(9, { glade: true }), 132, -176, 0.25);
    for (const [x, z] of [[124, -140], [168, -136], [158, -128], [118, -158], [176, -150]]) put('mushrooms', x, z, x);
    for (const [x, z, k] of [[136, -134, 'crystalTeal'], [172, -144, 'crystalPurple'], [128, -170, 'crystalTeal'], [162, -122, 'crystalPurple'], [180, -164, 'crystalTeal']]) put(k, x, z, x);
    put('lanternGreen', 128, -124, 0); put('lanternGreen', 140, -120, 1);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + Math.sin(i * 7) * 0.05;
      const rr = LAKE.r - 2.2 + Math.sin(i * 3.7) * 1.2;
      const x = LAKE.x + Math.cos(a) * rr, z = LAKE.z + Math.sin(a) * rr;
      if (z < WATERFALL.z + 8) continue;
      if (i % 2 === 0) S.place('reeds' + (i % 4 === 0 ? 0 : 1), x, Math.max(-0.2, T.height(x, z)), z, a, 0.9 + (i % 3) * 0.15);
      const rr2 = LAKE.r - 7 - (i % 5) * 1.6;
      if (i % 3 === 0) S.place('lily', LAKE.x + Math.cos(a + 0.2) * rr2, 0, LAKE.z + Math.sin(a + 0.2) * rr2, a, 0.9);
    }
    put('mushrooms', 146, -126, 2); put('crystalTeal', 156, -178, 0.4); put('crystalPurple', 142, -182, 1.2);
    // --- Old Foundry
    this.placeObject(B.foundryRuins(10), -150, -146, 0);
    put('signpost', -110, -118, 0.8);
    this.placeObject(D.railTrack(1, 26), -146, -128, 0);
    put('mineCart', -146, -132, 0); put('mineCart', -146, -122, 0.02);
    for (const [x, z, k] of [[-162, -136, 0], [-137, -152, 1], [-139, -134, 0], [-165, -153, 1], [-128, -160, 0]]) put('scrap' + k, x, z, x);
    put('coal', -157, -151, 0.4); put('coal', -142, -151, 1.6);
    put('lantern', -134, -124, 0); put('lantern', -166, -124, 2);
  }

  // the Cinder Reach: its pier, camp, works and scatter (reachLayout.js), drawn through its own scatter batches
  buildReach() {
    this.reachScatter = new Scatter();
    this.guardScatter(this.reachScatter);
    this.reachScatter.colliders = this.scatter.colliders; // one collider list for the whole outdoors
    buildReach(this, this.reachScatter);
    this.reachGroup.add(this.reachScatter.build());
  }

  // the Rime Steps: its pier, camp, dam, flumes, mills and scatter (rimeLayout.js), through its own scatter batches
  buildRime() {
    this.rimeScatter = new Scatter();
    this.guardScatter(this.rimeScatter);
    this.rimeScatter.colliders = this.scatter.colliders;
    buildRime(this, this.rimeScatter);
    buildRimeLift(this); // the foot of the Windward Heights' lift, by the dam's north tower
    this.rimeGroup.add(this.rimeScatter.build());
  }

  // the Windward Heights: the lift landing, the camp, the wind engines, the workshop, the cloud sea (heightsLayout.js)
  buildHeights() {
    this.heightsScatter = new Scatter();
    this.guardScatter(this.heightsScatter);
    this.heightsScatter.colliders = this.scatter.colliders;
    buildHeights(this, this.heightsScatter);
    this.heightsGroup.add(this.heightsScatter.build());
  }

  // Tidewater Sound: the quay and the ship, the camp, the ropewalk, the tar yards, the mills and ponds, the flats, the Sea
  // Gate, the planted rows, and the tide's water (tidewaterLayout.js)
  buildTidewater() {
    this.tidewaterScatter = new Scatter();
    this.guardScatter(this.tidewaterScatter);
    this.tidewaterScatter.colliders = this.scatter.colliders;
    buildTidewater(this, this.tidewaterScatter);
    this.tidewaterGroup.add(this.tidewaterScatter.build());
  }

  // the Rainward Gorge: the road head, the camp, the terraces and their drains, the adits, the Slip, the river and falls, the
  // timber, the low cloud and the rain's look (rainwardLayout.js)
  buildRainward() {
    this.rainwardScatter = new Scatter();
    this.guardScatter(this.rainwardScatter);
    this.rainwardScatter.colliders = this.scatter.colliders;
    buildRainward(this, this.rainwardScatter);
    this.rainwardGroup.add(this.rainwardScatter.build());
  }

  // the Russet Weald: the ropeway's station and towers, the camp and saw pits, the rides, the Long Sheds and log decks, the
  // coppice and the standards, the fall lines, the great ride's gate, the mist in the hollows and the gale's look (wealdLayout.js)
  buildWeald() {
    this.wealdScatter = new Scatter();
    this.guardScatter(this.wealdScatter);
    this.wealdScatter.colliders = this.scatter.colliders;
    buildWeald(this, this.wealdScatter);
    this.wealdGroup.add(this.wealdScatter.build());
  }

  // which outdoor area is shown: 'valley', 'reach', 'rime', 'heights' or 'dungeon' (the valley stays loaded behind the dungeons, as
  // before; the islands hide). The far plane reaches 1200 m, so the other areas must be hidden, not just fogged.
  setArea(area) {
    if (area === this.area) return;
    this.area = area;
    const shown = this.areaGroups[area] ? area : 'valley';
    for (const [id, g] of Object.entries(this.areaGroups)) g.visible = id === shown;
    this.spots = null; // the light spots of the area you are in
  }
  // the terrain of the area you are in (for picking the ground under the mouse)
  areaTerrain() { return this.areaTerrains[this.area] || this.terrain; }

  // dungeon interiors (east of the map) and their doors in the overworld; a pool of point lights follows the torches
  buildDungeons() {
    this.dungeonViews = new Map();
    this.doors = [];
    this.floors = [];
    for (const D of DUNGEONS) {
      const v = buildDungeon(D);
      this.group.add(v.group);
      for (const c of v.colliders) this.colliders.push(c);
      this.dungeonViews.set(D.id, v);
      v.group.visible = false; // shown while you are inside it (setIndoor)
      this.floors.push(v.floor);
      this.placeObject(dungeonEntrance(D), D.door.x, D.door.z, D.door.ry);
      const fx = Math.sin(D.door.ry), fz = Math.cos(D.door.ry);
      this.doors.push({ id: D.id, open: !!D.open, x: D.door.x + fx * 1.5, z: D.door.z + fz * 1.5, label: D.open ? `Go down into ${D.name}` : `Enter ${D.name}`, level: D.level });
      this.doors.push({ id: D.id, exit: true, x: D.exitW[0], z: D.exitW[1], label: `Leave ${D.name}` });
    }
    this.lightPool = [];
    // C2: a fixed point-light budget per preset (QUALITY.lights = world pool + fx pool; High 4 + 4, phones 2 + 2, Battery 1 + 1).
    // The lights stay visible at intensity 0 when idle, so the light count never changes and no shader recompiles
    const nPool = Math.max(1, QUALITY.lights ? QUALITY.lights - fxLightCount() : QUALITY.mobile ? 2 : 4);
    for (let i = 0; i < nPool; i++) { const l = new THREE.PointLight(0xffa050, 0, 15, 1.5); l.castShadow = false; this.group.add(l); this.lightPool.push(l); }
    // what each pooled light is doing: its source, its fade (0..1) and whether it is on its way out. A light is only handed
    // to a new source once it has faded right out, so lights never pop or jump from lamp to lamp
    this.poolSlots = this.lightPool.map(() => ({ src: null, w: 0, out: false }));
    this._poolT = null;
    this.indoor = null;
    this.night = 0;
  }

  // every fire and lamp in the overworld, for the light pool
  collectLightSpots() {
    this.group.updateMatrixWorld(true);
    this.spots = [];
    const v = new THREE.Vector3();
    (this.areaGroups[this.area] || this.valleyGroup).traverse((o) => {
      if (o.userData.houseInt) return; // house interiors come and go: their lamps are this.houseSpots
      if (o.userData.lightSpot) { o.getWorldPosition(v); if (v.x < 700) this.spots.push({ x: v.x, y: v.y + o.userData.lightSpot.y, z: v.z, color: o.userData.lightSpot.color, k: o.userData.lightSpot.k, fire: true }); }
      else if (o.isSprite && o.userData.glow && o.userData.glow.size >= 1.2) {
        o.getWorldPosition(v);
        if (v.x >= 700) return;
        const c = new THREE.Color(o.userData.glow.color);
        if (c.r < c.b) return; // warm lamps only
        this.spots.push({ x: v.x, y: v.y, z: v.z, color: o.userData.glow.color, k: 0.5, fire: false });
      }
    });
    this.buildLightPools();
    this.buildWindowGlows();
    this.baseSpots = this.spots;
    this.spots = this.baseSpots.concat(this.houseSpots);
  }

  // a soft warm pool of light on the ground under every lamp and fire, one instanced draw; fades in at dusk
  buildLightPools() {
    if (this.pools) { this.group.remove(this.pools); this.pools.geometry.dispose(); this.pools.material.dispose(); }
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false });
    // (LF.1) only fires flicker: a fire's pool is marked by a y scale of 2 in its instance matrix (the flat quad ignores it)
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = G.time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <color_vertex>', `#include <color_vertex>
        #if defined(USE_INSTANCING) && defined(USE_INSTANCING_COLOR)
        if (length(instanceMatrix[1].xyz) > 1.5) { float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.61;
          vColor.rgb *= 0.86 + 0.09 * sin(uTime * 9.0 + ph) * sin(uTime * 5.3 + ph * 1.7) + 0.05 * sin(uTime * 13.0 + ph); }
        #endif`);
    };
    mat.customProgramCacheKey = () => 'lfPool';
    const list = this.spots.filter((s) => s.y - this.terrain.height(s.x, s.z) < 7);
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    const M = new THREE.Matrix4(), c = new THREE.Color();
    list.forEach((s, i) => {
      const gy = this.terrain.height(s.x, s.z), r = s.fire ? 4.5 : 3.4;
      M.makeScale(r * 2, s.fire ? 2 : 1, r * 2).setPosition(s.x, gy + 0.06, s.z); m.setMatrixAt(i, M);
      m.setColorAt(i, c.setHex(s.color).lerp(_lampAmber, s.fire ? 0 : 0.4).multiplyScalar(s.fire ? 0.22 : 0.17)); // (judge: lamp pools amber, not lime on the grass)
    });
    m.count = list.length; m.renderOrder = 16; m.frustumCulled = false;
    this.pools = m; this.group.add(m);
  }

  // (LF.1) a warm glow on the wall round every lit window pane (the built houses' glassWarm panes, the CGTrader shells' dark
  // window cells), strongest under the sill and fading down the wall: one instanced additive draw, faded in with the
  // lamps behind the glass (G.winLit). Rebuilt with the light spots and when a settlement's shells finish loading
  buildWindowGlows() {
    this._winDirty = false;
    if (this.winGlow) { this.group.remove(this.winGlow); this.winGlow.geometry.dispose(); }
    const panes = [];
    (this.areaGroups[this.area] || this.valleyGroup).traverse((o) => {
      if (!o.userData.panes) return;
      for (const pn of o.userData.panes) { const w = movePane(pn, o.matrixWorld); if (w.c[0] < 700) panes.push(w); }
    });
    if (!this._winMat) {
      // the glow's shape: brightest at the pane (upper middle), spilling down the wall below the sill and a little to the sides
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
      const x = cv.getContext('2d'), img = x.createImageData(64, 128);
      for (let j = 0; j < 128; j++) for (let i = 0; i < 64; i++) {
        const u = (i + 0.5) / 64 - 0.5, v = (j + 0.5) / 128; // v 0 at the top
        const dy = v < 0.3 ? (0.3 - v) / 0.3 : (v - 0.3) / 0.7; // 0 at the pane's middle, 1 at the top and bottom edges
        const a = Math.max(0, 1 - Math.hypot(u / 0.5, dy)) ** 1.6;
        const k = (j * 64 + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(255 * a);
      }
      x.putImageData(img, 0, 0);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      this._winMat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffa04a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      // a window of a house that is cut open (CGT/built walls taken down to the cut line) loses its glow with the wall
      this._winMat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { cutA: G.cutA, cutR: G.cutR, cutH: G.cutH });
        sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
          uniform vec4 cutA[${CUT_SLOTS}]; uniform vec4 cutR[${CUT_SLOTS}]; uniform vec4 cutH[${CUT_SLOTS}];`).replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
          { vec3 ic = instanceMatrix[3].xyz;
            for (int k = 0; k < ${CUT_SLOTS}; k++) { vec4 A = cutA[k]; if (A.w < 0.5) continue;
              float c = cos(A.z), s = sin(A.z); vec2 d = ic.xz - A.xy, l = vec2(d.x * c - d.y * s, d.x * s + d.y * c); vec4 R = cutR[k];
              if (l.x > R.x - 0.6 && l.x < R.z + 0.6 && l.y > R.y - 0.6 && l.y < R.w + 0.6 && ic.y > cutH[k].x - 0.6) transformed = vec3(0.0); } }
          #endif
          vHole = aHole;`).replace('#include <common>', `#include <common>
          attribute vec4 aHole; varying vec4 vHole;`);
        // a closed shutter: no glow on the shutter itself (the quad lies in its plane and, with the polygon offset, would
        // light the leaves up as a lit window with a seam and straps across it, a grid; phones showed it), only round it
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
          varying vec4 vHole;`).replace('#include <map_fragment>', `#include <map_fragment>
          #ifdef USE_MAP
          if (vHole.w > 0.5) { float hd = max(abs(vMapUv.x - 0.5) - vHole.x, max(vHole.y - vMapUv.y, vMapUv.y - vHole.z)); diffuseColor.a *= smoothstep(-0.015, 0.012, hd); }
          #endif`);
      };
      this._winMat.customProgramCacheKey = () => 'lfWin2';
    }
    if (!panes.length) { this.winGlow = null; return; }
    const geo = new THREE.PlaneGeometry(1, 1), hole = new Float32Array(panes.length * 4);
    geo.setAttribute('aHole', new THREE.InstancedBufferAttribute(hole, 4));
    const m = new THREE.InstancedMesh(geo, this._winMat, panes.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
    panes.forEach((pn, i) => {
      // the quad stands in the pane's plane: from 1.7 x the pane's height below its middle to 0.8 x above, 1.8 x as wide
      const w = pn.w * 2 * 1.8 + 0.5, hTop = pn.h * 1.8 + 0.2, hBot = pn.h * 1.0 + 1.5;
      // (a closed shutter's rectangle in the quad's uv: half width, bottom, top; the shader leaves it dark)
      if (pn.shut) hole.set([pn.w / w, (hBot - pn.h) / (hTop + hBot), (hBot + pn.h) / (hTop + hBot), 1], i * 4);
      q.setFromAxisAngle(up, Math.atan2(pn.n[0], pn.n[1]));
      P.set(pn.c[0], pn.c[1] + (hTop - hBot) / 2, pn.c[2]);
      M.compose(P, q, S.set(w, hTop + hBot, 1)); m.setMatrixAt(i, M);
      m.setColorAt(i, C.setScalar(pn.shut ? 0.55 : 1)); // (closed shutters: only what leaks round them)
    });
    m.renderOrder = 15; m.frustumCulled = true; m.computeBoundingSphere(); m.castShadow = m.receiveShadow = false;
    this.winGlow = m; this.group.add(m);
  }

  // hand the pooled point lights to the best sources in `want` (sorted, best first; each an object that stays the same
  // from frame to frame). Sources that drop out of the wanted set fade out over ~0.4 s and only then free their light;
  // a free light fades in on the best unlit source. A source keeps its light while it stays within the first
  // `keep` wanted (hysteresis), so two lamps at about the same distance never trade lights back and forth.
  // With `score` (a Map source -> cost, lower is better) a lit source also keeps its light until a source in the top N costs
  // 20% less than it does (houses spec §6), so lamps at about the same distance never pop as you walk.
  assignPool(want, dt, keep, slots = this.poolSlots, score = null) {
    const rate = dt / 0.4;
    const top = new Set(want.slice(0, slots.length)), kept = new Set(want.slice(0, keep));
    const thr = score && want.length ? score.get(want[Math.min(slots.length, want.length) - 1]) * 1.2 : -1;
    const lit = new Set();
    for (const sl of slots) {
      if (!sl.src) continue;
      if (!sl.out && !kept.has(sl.src) && !(score && score.has(sl.src) && score.get(sl.src) <= thr)) sl.out = true;
      sl.w = Math.max(0, Math.min(1, sl.w + (sl.out ? -rate : rate)));
      if (sl.out && sl.w <= 0) { sl.src = null; sl.out = false; continue; }
      lit.add(sl.src);
    }
    // free lights go to the best wanted sources not yet lit (only the top N: a far source never steals a light)
    for (const src of want) {
      if (!top.has(src) || lit.has(src)) continue;
      const sl = slots.find((x) => !x.src);
      if (!sl) break;
      sl.src = src; sl.w = 0; sl.out = false; lit.add(src);
    }
  }

  poolDt(t) { const dt = this._poolT == null ? 0.016 : Math.min(0.1, Math.max(0, t - this._poolT)); this._poolT = t; return dt; }

  // the nearest fires (and lamps, by night) get the six real lights, faded in and out (assignPool); every lamp and fire
  // within reach also lights the air (engine atmosphere pass), faded smoothly with distance so nothing pops
  updateLights(t, focus) {
    if (!this.spots) { this.collectLightSpots(); for (const sl of this.poolSlots) { sl.src = null; sl.w = 0; sl.out = false; } }
    const dt = this.poolDt(t);
    const night = this.night, cand = [], hid = this.house?.id;
    // (LF.1: steady; only the fires' pools flicker, per instance in their shader)
    if (this.pools) this.pools.material.opacity = Math.min(1, night * 1.2);
    if (this._winDirty) this.buildWindowGlows();
    if (this.winGlow) { this.winGlow.material.opacity = 0.7 * G.winLit.value; /* (judge: 0.5 read faint on the walls by night) */ this.winGlow.visible = G.winLit.value > 0.01; }
    const air = (G.airLamps.length = 0, G.airLamps);
    for (const s of this.spots) {
      const d = (s.x - focus.x) ** 2 + (s.z - focus.z) ** 2;
      // lamps come on with the dusk (a smooth weight, not a cut-off), fires burn all day
      // (the lamps of the house you stand in burn by day too, and score 4x: the room is lit first)
      const mine = s.house && s.house === hid;
      const on = s.fire || mine ? 1 : Math.min(1, Math.max(0, (night - 0.03) / 0.25));
      if (on <= 0 || d > 52 * 52) continue;
      cand.push({ s, d: d / (s.fire ? 1.6 : 1) / (mine ? 4 : 1) });
      const fade = 1 - Math.min(1, Math.max(0, (Math.sqrt(d) - 38) / 12));
      // (a house's lamps and hearth light its room, not the air round it: only a little of them goes into the haze)
      if (fade > 0) air.push({ s, k: (s.fire ? 1.2 * s.k : 0.55) * on * fade * (s.house ? (s.fire ? 0.45 : 0.2) : 1), d });
    }
    cand.sort((a, b) => a.d - b.d);
    air.sort((a, b) => a.d - b.d);
    air.length = Math.min(air.length, 16);
    for (let i = 0; i < air.length; i++) {
      const a = air[i];
      air[i] = { x: a.s.x, y: a.s.y, z: a.s.z, w: a.k * (a.s.fire ? (a.s.house ? 1 + 0.05 * Math.sin(t * Math.PI + i) : 0.9 + 0.1 * Math.sin(t * 9 + i)) : 1), c: a.s.c || (a.s.c = new THREE.Color(a.s.color)) };
    }
    // the hero glow (by night) keeps light 0 to itself; the others go to the sources. With a single pooled light (Mobile
    // Low, Battery saver) the lamps, fires and hearths get it instead (a room lit by its hearth beats the faint glow)
    const heroOn = this.lightPool.length > 1, h0 = heroOn ? 1 : 0;
    if (heroOn) {
      const hero = this.lightPool[0];
      // (a faint, cool moonlit pool so the path stays readable; the warm one lit a 13 m disc round you and night read as dusk)
      hero.position.set(focus.x, focus.y + 3.2, focus.z); hero.color.setHex(0xc4d2f0); hero.distance = 10; hero.decay = 1.4;
      hero.intensity = 0.95 * Math.min(1, Math.max(0, (night - 0.25) / 0.4));
      this.poolSlots[0].src = null;
    }
    if (!this._slotsH || this._slotsH[0] !== h0) this._slotsH = [h0, this.poolSlots.slice(h0)];
    const slots = this._slotsH[1], want = cand.map((c) => c.s), score = new Map(cand.map((c) => [c.s, c.d]));
    this.assignPool(want, dt, slots.length + 2, slots, score);
    slots.forEach((sl, j) => {
      const i = j + h0, l = this.lightPool[i], s = sl.src;
      if (!s) { l.intensity = 0; return; }
      const mine = s.house && s.house === hid;
      const on = s.fire || mine ? 1 : Math.min(1, Math.max(0, (night - 0.03) / 0.25));
      const w = sl.w * sl.w * (3 - 2 * sl.w) * on;
      l.position.set(s.x, s.y, s.z); l.color.setHex(s.color);
      // house hearths burn steady (a slow 0.5 Hz swell of 5%, no flicker); the lamps of your house light the room by day too
      if (s.fire) { l.distance = (s.house ? 7 : 10) * s.k; l.decay = 1.6; l.intensity = w * 7 * s.k * (s.house ? 1 + 0.05 * Math.sin(t * Math.PI + i) : 0.85 + 0.15 * Math.sin(t * 13 + i) * Math.sin(t * 7.3 + i * 2)); }
      else if (s.house) { l.distance = 6; l.decay = 1.6; // (judge: 6 m, so a room's lamp no longer lights the yard round the house)
        l.intensity = w * 4 * Math.max(mine ? 0.75 : 0, night); }
      else { l.color.lerp(_lampAmber, 0.4); l.distance = 11; l.decay = 1.5; l.intensity = w * 5 * night; } // (LF.1) lamps burn steady: only fires flicker
    });
  }

  // switch outdoor-only systems off underground; returns the dungeon (or null)
  setIndoor(focus) {
    const D = focus.x >= DUNGEON_MIN_X ? dungeonAt(focus.x, focus.z) : null;
    const id = D ? D.id : null;
    if (id === this.indoor) return D;
    this.indoor = id;
    const out = !D;
    for (const o of [this.grass, this.lake, this.waterfall, this.stream, this.shafts, this.sea]) if (o) o.visible = out; // the sea plane reaches far east, under the dungeon floors
    // only the dungeon you are in is shown (and so culled, walked and drawn): the rest stay hidden
    for (const [k, v] of this.dungeonViews || []) v.group.visible = k === id;
    return D;
  }

  updateDungeon(dt, t, focus) {
    const view = this.indoor && this.dungeonViews.get(this.indoor);
    if (!view) return;
    view.group.userData.update(dt, t);
    if (this._poolView !== view) { this._poolView = view; for (const sl of this.poolSlots) { sl.src = null; sl.w = 0; sl.out = false; } }
    const near = view.torches.map((tr) => ({ tr, d: (tr.x - focus.x) ** 2 + (tr.z - focus.z) ** 2 })).filter((n) => n.d < 45 * 45).sort((a, b) => a.d - b.d);
    this.assignPool(near.map((n) => n.tr), this.poolDt(t), this.poolSlots.length + 2);
    this.lightPool.forEach((l, i) => {
      const sl = this.poolSlots[i], tr = sl.src;
      if (!tr) { l.intensity = 0; return; }
      const w = sl.w * sl.w * (3 - 2 * sl.w);
      l.position.set(tr.x, tr.y, tr.z);
      l.color.setHex(tr.color);
      l.distance = 15; l.decay = 1.5; // fixed reach underground (it used to inherit whatever the overworld last set)
      l.intensity = w * 16 * (tr.k ?? 1) * (0.88 + 0.08 * Math.sin(t * 11 + i * 2.1) + 0.05 * Math.sin(t * 23 + i));
    });
    // the torches light the dungeon air too (engine atmosphere pass)
    const air = (G.airLamps.length = 0, G.airLamps);
    for (let i = 0; i < near.length && air.length < 16; i++) {
      const tr = near[i].tr, fade = 1 - Math.min(1, Math.max(0, (Math.sqrt(near[i].d) - 30) / 12));
      air.push({ x: tr.x, y: tr.y, z: tr.z, w: 0.9 * (tr.k ?? 1) * fade * (0.9 + 0.1 * Math.sin(t * 11 + i * 2.1)), c: tr._c || (tr._c = new THREE.Color(tr.color)) });
    }
  }

  // is this spot kept clear (roads, settlements, water, cliffs)?
  blocked(x, z, pad = 0) {
    for (const c of this.clearings || []) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
    for (const bx of this.boxes || []) if (Math.abs(x - bx.x) < bx.hw + 3 + pad && Math.abs(z - bx.z) < bx.hd + 3 + pad) return true;
    if (roadDist(x, z) < 5 + pad) return true;
    for (const zn of ZONES) if (zn.r && zn.id !== 'village' && Math.hypot(x - zn.x, z - zn.z) < zn.r * 0.62 + pad) return true;
    if (inVillage(x, z, pad)) return true;
    if (x > -80 && x < 100 && z > -30 && z < 45 && streamInfo(x, z).d < 5.5 + pad) return true;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4 + pad) return true;
    const h = this.terrain.height(x, z);
    if (h < 0.6) return true;
    const n = this.terrain.normal(x, z);
    if (n.y < 0.8) return true;
    return false;
  }

  populate() {
    const S = this.scatter, T = this.terrain;
    // every tree cell and every scattered prop draws from its own small random stream, so a new road or camp only changes the
    // scatter where it is (with one shared stream, any change reshuffled the whole valley after it)
    let rng = mulberry32(2024);
    const seed = (a, b = 0) => { rng = mulberry32(Math.imul(a + 7, 73856093) ^ Math.imul(b + 13, 19349663) ^ 0x7e3); };
    const r = (a = 0, b = 1) => a + (b - a) * rng();
    const pick = (base) => base + Math.floor(rng() * VARIANTS[base]);
    // the world rectangle, 8 m in from its edge (the same 7.5 m lattice as the old 624 m square); the random-point counts were
    // set for that square, so they grow with the area to keep the same density
    const X0 = WORLD.minX + 8, X1 = WORLD.maxX - 8, Z0 = WORLD.minZ + 8, Z1 = WORLD.maxZ - 8;
    const many = (k) => Math.round((k * (X1 - X0) * (Z1 - Z0)) / (624 * 624));
    const spot = () => [r(X0, X1), r(Z0, Z1)];
    const put = (key, x, z, sMin = 0.85, sMax = 1.2) => S.place(key, x, T.height(x, z) - 0.05, z, r(0, Math.PI * 2), r(sMin, sMax));

    // sun shafts go into gaps in the canopy (their own random stream, so the trees stay the same)
    let srng = mulberry32(77);
    const sr = (a = 0, b = 1) => a + (b - a) * srng();
    this.shaftSpots = [];
    const sunY = this.engine.sunDir.y;
    const shaft = (x, z, k = 1) => this.shaftSpots.push({ x, y: T.height(x, z) - 0.3, z, w: sr(2.2, 4.8), len: sr(9, 15) / sunY, k: k * sr(0.6, 1.1) });
    // trees on a jittered grid
    const cell = 7.5;
    for (let iz = 0, gz = Z0; gz < Z1; iz++, gz += cell) for (let ix = 0, gx = X0; gx < X1; ix++, gx += cell) {
      seed(ix, iz); srng = mulberry32(Math.imul(ix + 3, 83492791) ^ Math.imul(iz + 5, 50331653) ^ 77);
      const x = gx + r(0, cell), z = gz + r(0, cell);
      const edge = edgeE(x, z); // the mountain ring, with the north-west pass and the far valley cut through it
      if (edge > 296) continue;
      if (this.blocked(x, z)) {
        // open ground inside the woods (roads, clearings, camps): sunlight falls in from the canopy edge
        const fo = forestWeight(x, z), go = gladeWeight(x, z);
        // (not in the middle of big camp clearings, where a dozen beams would cross the whole view)
        const camp = this.clearings.some((c) => c.r >= 14 && Math.hypot(x - c.x, z - c.z) < c.r - 4);
        if (!camp && (fo > 0.3 || go > 0.4) && T.height(x, z) > 0.6 && srng() < 0.4) shaft(x, z, 1.15);
        continue;
      }
      const fw = forestWeight(x, z), dw = desertWeight(x, z), gw = gladeWeight(x, z);
      const mountain = edge > 250 ? (edge - 250) / 50 : 0;
      const roll = rng();
      const hw = Math.max(highreachWeight(x, z), alpineWeight(x, z));
      // the Wildworks: heaps of scrap and broken rock among the craters, no trees
      if (wildWeight(x, z) > 0.5 && mountain === 0) { if (roll < 0.07) put('scrap' + (roll < 0.035 ? 0 : 1), x, z, 0.9, 1.6); else if (roll < 0.11) put(pick('rock'), x, z, 0.6, 1.3); continue; }
      // the Glass Waste: a bare salt pan, the odd boulder of glassy rock on the dunes
      if (flatsWeight(x, z) > 0.5 && mountain === 0) { if (roll < 0.025 && T.height(x, z) > 4.2) put(pick('rockDesert'), x, z, 0.6, 1.4); continue; }
      const cw = coastWeight(x, z);
      if (cw > 0.5 && mountain === 0) {
        // the Harrow Coast: wind-leaning palms in loose groves behind the dunes, scrub and stones; the beach stays open
        if (x > 412 || T.height(x, z) < 1.2) continue;
        const grove = fbm(x * 0.025, z * 0.025, 2, 161);
        if (roll < (grove > 0.55 ? 0.3 : 0.05)) put(pick('palm'), x, z, 0.85, 1.3);
        else if (roll < (grove > 0.55 ? 0.42 : 0.14)) put(rng() < 0.6 ? pick('dryBush') : pick('rockDesert'), x, z, 0.7, 1.2);
        continue;
      }
      if (hw > 0.5 && mountain === 0) {
        // the Highreach, the Brasswork Pass and the Far Vale: wind-bent pines in small stands, boulders, open rock
        const stand = fbm(x * 0.03, z * 0.03, 2, 17);
        if (roll < (stand > 0.55 ? 0.45 : 0.08)) put(pick('pine'), x, z, 0.8, 1.25);
        else if (roll < (stand > 0.55 ? 0.55 : 0.2)) put(pick('rock'), x, z, 0.8, 1.6);
      } else if (gw > 0.35) {
        if (roll >= 0.42 * gw && srng() < 0.3) shaft(x, z, 0.8);
        if (roll < 0.42 * gw) put(rng() < 0.4 ? pick('glowbark') : rng() < 0.6 ? pick('lilac') : pick('oak'), x, z, 0.9, 1.25);
        else if (roll < 0.6 * gw) put(rng() < 0.5 ? pick('bushRed') : pick('bushGreen'), x, z, 0.8, 1.3);
      } else if (dw > 0.5) {
        if (roll < 0.045) put(pick('palm'), x, z, 0.85, 1.25);
        else if (roll < 0.09) put(pick('rockDesert'), x, z, 0.8, 1.6);
      } else if (mountain > 0) {
        if (roll < 0.35 * mountain + 0.1) put(pick('pine'), x, z, 0.9, 1.3);
      } else if (fw > 0.15) {
        if (roll < 0.7 * fw) put(rng() < 0.5 ? pick('pine') : pick('oak'), x, z, 0.85, 1.3);
        else if (roll < 0.95 * fw) put(rng() < 0.6 ? pick('bushGreen') : pick('fern'), x, z, 0.8, 1.3);
        if (roll >= 0.7 * fw && fw > 0.35 && srng() < 0.55) shaft(x, z, 1);
      } else {
        // meadows: copses of oak and lilac with bushy edges, open grass between them
        const gv = fbm(x * 0.017, z * 0.017, 3, 7);
        if (gv > 0.6) {
          if (roll < 0.5) put(rng() < 0.86 ? pick('oak') : pick('lilac'), x, z, 0.85, 1.3);
          else if (roll < 0.76) put(rng() < 0.6 ? pick('bushGreen') : pick('bushRed'), x, z, 0.8, 1.3);
          else if (roll < 0.84) put(pick('rock'), x, z, 0.6, 1.1);
          else if (roll < 0.92) put(pick('fern'), x, z, 0.8, 1.2);
        } else if (gv > 0.5) {
          if (roll < 0.12) put(rng() < 0.9 ? pick('oak') : pick('lilac'), x, z, 0.9, 1.25);
          else if (roll < 0.34) put(rng() < 0.7 ? pick('bushGreen') : pick('bushRed'), x, z, 0.8, 1.2);
          else if (roll < 0.4) put(pick('rock'), x, z, 0.6, 1.1);
        } else {
          if (roll < 0.05) put(pick('oak'), x, z, 0.9, 1.25);
          else if (roll < 0.12) put(rng() < 0.7 ? pick('bushGreen') : pick('bushRed'), x, z, 0.8, 1.2);
          else if (roll < 0.16) put(pick('rock'), x, z, 0.6, 1.1);
        }
      }
    }
    // undergrowth: ferns and small bushes in forests
    for (let i = 0, N = many(1400); i < N; i++) {
      seed(101, i); const [x, z] = spot();
      if (edgeE(x, z) > 300) continue;
      const fw = forestWeight(x, z);
      if (fw < 0.3 || rng() > fw || this.blocked(x, z, -2)) continue;
      put(rng() < 0.65 ? pick('fern') : pick('bushGreen'), x, z, 0.7, 1.15);
    }
    // forest floor: fallen logs and stumps
    for (let i = 0, N = many(260); i < N; i++) {
      seed(102, i); const [x, z] = spot();
      if (edgeE(x, z) > 300) continue;
      const fw = forestWeight(x, z);
      if (fw < 0.35 || rng() > fw || this.blocked(x, z, -2)) continue;
      put(rng() < 0.5 ? pick('log') : pick('stump'), x, z, 0.8, 1.2);
    }
    // meadow and glade flower patches
    for (let i = 0, N = many(2000); i < N; i++) {
      seed(103, i); const [x, z] = spot();
      if (edgeE(x, z) > 300) continue;
      const dw = desertWeight(x, z), fw = forestWeight(x, z), gw = gladeWeight(x, z);
      if (dw > 0.2 || fw > 0.5 || alpineWeight(x, z) > 0.5 || this.blocked(x, z, -3.5)) continue;
      if (rng() > 0.35 + gw * 0.6) continue;
      put(pick('flowerPatch'), x, z, 0.8, 1.3);
    }
    // desert scrub: dry bushes and cacti
    for (let i = 0, N = many(2200); i < N; i++) {
      seed(104, i); const [x, z] = spot();
      const dw = desertWeight(x, z);
      if (dw < 0.5 || flatsWeight(x, z) > 0.5 && rng() > 0.1 || this.blocked(x, z, -2)) continue;
      put(rng() < 0.75 ? pick('dryBush') : pick('cactus'), x, z, 0.6, 1.3);
    }
    // desert stones: small, low and half sunk in the sand, so the open dunes never read as a bare decal
    for (let i = 0, N = many(3000); i < N; i++) {
      seed(106, i); const [x, z] = spot();
      if (desertWeight(x, z) < 0.6 || flatsWeight(x, z) > 0.5 || this.blocked(x, z, -1.5)) continue;
      put(pick('rockDesert'), x, z, 0.25, 0.6);
    }
    // roadsides: bushes, stones, flowers and the odd fence run, so travel never crosses bare ground
    for (const [ri, road] of ROADS.entries()) {
      seed(200 + ri);
      for (let i = 0; i < road.length - 1; i++) {
        const [ax, az] = road[i], [bx, bz] = road[i + 1];
        const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
        for (let t = r(0, 6); t < L; t += r(5, 9)) {
          for (const side of [-1, 1]) {
            const off = r(5.4, 7.5);
            const x = ax + (bx - ax) * (t / L) + nx * off * side, z = az + (bz - az) * (t / L) + nz * off * side;
            if (Math.hypot(x, z) < 26 || this.blocked(x, z, -0.6)) continue;
            const dw = desertWeight(x, z), roll = rng();
            if (snowWeight(x, z) > 0.4) { if (roll < 0.22) put(pick('rock'), x, z, 0.45, 0.95); continue; } // only stones show through the snow
            if (dw > 0.5) { if (roll < 0.25) put(pick('dryBush'), x, z, 0.7, 1.2); else if (roll < 0.38) put(pick('rockDesert'), x, z, 0.5, 1.0); continue; }
            if (roll < 0.28) put(rng() < 0.7 ? pick('bushGreen') : pick('bushRed'), x, z, 0.7, 1.15);
            else if (roll < 0.42) put(pick('rock'), x, z, 0.45, 0.9);
            else if (roll < 0.6) put(pick('flowerPatch'), x, z, 0.8, 1.2);
            else if (roll < 0.66 && forestWeight(x, z) < 0.3) S.place('fence', x, T.height(x, z) - 0.02, z, Math.atan2(-(bz - az), bx - ax), 1);
          }
        }
      }
    }
    // rocks scattered everywhere, more on hills
    for (let i = 0, N = many(620); i < N; i++) {
      seed(105, i); const [x, z] = spot();
      if (edgeE(x, z) > 312 || this.blocked(x, z, -2)) continue;
      put(desertWeight(x, z) > 0.5 ? pick('rockDesert') : pick('rock'), x, z, 0.5, 1.3);
    }
  }

  update(dt, t, focus) {
    swingFocus.copy(focus); // (v116: lanterns swing near the player only, assets/dynamic.js)
    this.updateHouses(focus, dt, t);
    this.grass.userData.setFocus(focus.x, focus.z);
    this.waterfall.userData.update(dt, t);
    if (this.indoor) { if (this.winGlow) this.winGlow.visible = false; /* (LF review: the last area's window glow, left lit) */ this.updateDungeon(dt, t, focus); return; }
    this.updateLights(t, focus);
    if (this.shafts) { const k = (1 - this.night) * (1 - (this.rain || 0)) * (1 - 0.7 * (this.sand || 0)); this.shafts.visible = k > 0.08; if (this.shafts.material?.uniforms?.uStrength) this.shafts.material.uniforms.uStrength.value = k; }
    (this.area === 'reach' ? this.reachScatter : this.area === 'rime' ? this.rimeScatter : this.area === 'heights' ? this.heightsScatter : this.area === 'tidewater' ? this.tidewaterScatter : this.area === 'rainward' ? this.rainwardScatter : this.area === 'weald' ? this.wealdScatter : this.scatter).update(dt, t, focus, 70);
    if (this.area === 'heights') this.heightsTick?.(dt);
    if (this.area === 'tidewater') this.tidewaterTick?.(dt, t);
    if (this.area === 'rainward') this.rainwardTick?.(dt, t);
    if (this.area === 'weald') this.wealdTick?.(dt, t);
    for (const o of this.dyn) if ((o.userData.center || o.position).distanceToSquared(focus) < (o.userData.reach || 90) ** 2) o.userData.update?.(dt, t);
  }

  // the Homestead: each player sees their own trophies (from the story and raid achievements) and what they bought from Idwal
  updateHomestead(y, achDone) {
    const H = this.home;
    if (y) this._homeYou = y;
    y = this._homeYou;
    if (!H || !y) return;
    if (achDone) this._homeAch = achDone;
    // looking at a visitor's yard: their trophies and furnishings stand on the plot until the view is closed
    const V = this.homeVisit;
    if (V) {
      for (const [k, o] of Object.entries(H)) {
        const on = k === 'home_garden_f' ? V.deco.includes('home_garden') : k.startsWith('home_') || k.startsWith('std_') ? V.deco.includes(k) : V.trophies.includes(k);
        for (const obj of Array.isArray(o) ? o : [o]) if (obj) { obj.visible = on; for (const c of obj.userData.cols || []) c.off = !on; }
      }
      return;
    }
    const ach = this._homeAch || y.ach?.done || {}, done = y.done || {}, deco = y.homeDeco || {};
    // chosen spots for movable furnishings (HOME_SPOTS), else where Idwal first set them
    for (const k of HOME_MOVABLE) {
      const o = H[k]; if (!o) continue;
      const u = o.userData;
      if (!u.home0) u.home0 = { x: o.position.x, z: o.position.z, r: o.rotation.y, cols: (u.cols || []).map((c) => ({ x: c.x, z: c.z })) };
      const sp = HOME_SPOTS[(y.homePos || {})[k]];
      const nx = sp ? -32 + sp[0] : u.home0.x, nz = sp ? 90 + sp[1] : u.home0.z;
      if (o.position.x !== nx || o.position.z !== nz) {
        o.position.set(nx, this.terrain.height(nx, nz), nz); o.rotation.y = sp ? sp[2] : u.home0.r;
        (u.cols || []).forEach((c, i) => { c.x = u.home0.cols[i].x + (nx - u.home0.x); c.z = u.home0.cols[i].z + (nz - u.home0.z); });
        this._colDirty = true;
      }
    }
    const show = { trophy_gavel: !!done.m_c12_end, trophy_compass: !!done.m_c15_end, trophy_core: !!done.m_c18_end,
      plaque_council: !!ach.rProv, plaque_docks: !!ach.rGuild, plaque_kiln: !!ach.rGlass, plaque_hcouncil: !!ach.rhProv, plaque_hdocks: !!ach.rhGuild, plaque_hkiln: !!ach.rhGlass, plaque_line: !!ach.rAsm, plaque_hline: !!ach.rhAsm, trophy_drum: !!done.m_c21_end, plaque_makers: !!ach.rPattern, plaque_hmakers: !!ach.rhPattern, trophy_pattern: !!done.m_c25_end, trophy_drawings: !!ach.drawAll, plaque_hcopy: !!ach.rhBenedek, plaque_furnace: !!ach.rFirstFurnace, plaque_hfurnace: !!ach.rhFirstFurnace, plaque_dam: !!ach.rGreatDam, plaque_hdam: !!ach.rhGreatDam };
    for (const [k, o] of Object.entries(H)) {
      const on = k in show ? show[k] : k === 'home_garden_f' ? !!deco.home_garden : !!deco[k];
      for (const obj of Array.isArray(o) ? o : [o]) if (obj) { obj.visible = on; for (const c of obj.userData.cols || []) c.off = !on; }
    }
  }
  // ---------------------------------------------------------------- enterable houses (houses spec §6)
  // is (x, z) on a house's footprint (plus pad)? Nothing scattered may stand in a house (guardScatter); placed objects are
  // only listed (houseOverlaps), the layouts keep them clear
  // (tree > 0: a tree crown needs that much room from the house's cut box, so no crown hangs over a roof you look into)
  inHouseFoot(x, z, pad = 0.15, tree = 0) {
    for (const S of allHouses()) {
      if (Math.abs(x - S.x) > 14 + tree || Math.abs(z - S.z) > 14 + tree) continue;
      const [lx, lz] = toLocal(S, x, z), F = S.foot, R = S.cutRect;
      if (lx > F.x0 - pad && lx < F.x1 + pad && lz > F.z0 - pad && lz < F.z1 + pad) return S;
      const tp = S.shell ? tree * 1.4 : tree; // (v109: a model's roof reads higher and wider: crowns keep further off)
      if (tree && lx > R.x0 - tp && lx < R.x1 + tp && lz > R.z0 - tp && lz < R.z1 + tp) return S;
      if (tree && Math.hypot(x - S.doorOut.x, z - S.doorOut.z) < 3 * tree) return S; // (the house camera hangs out over the door)
      // and the doorstep and the first metre and a half in front of it
      const D = S.door, u = (lx - D.lx) * D.nx + (lz - D.lz) * D.nz, t = (lx - D.lx) * -D.nz + (lz - D.lz) * D.nx;
      if (u > 0 && u < (S.stepLen || 0.9) + 1.5 && Math.abs(t) < 1.1) return S;
    }
    return null;
  }
  // (v110) a model house's whole bounds (its cut box: roof stairs, porches and eaves outside the wall box), grown by pad:
  // the scattered boulders and bushes keep out of it (one sat half inside a desert house's roof stair)
  inShellBounds(x, z, pad = 0) {
    for (const S of allHouses()) {
      if (!S.shell || Math.abs(x - S.x) > 14 + pad || Math.abs(z - S.z) > 14 + pad) continue;
      const [lx, lz] = toLocal(S, x, z), R = S.cutRect;
      if (lx > R.x0 - pad && lx < R.x1 + pad && lz > R.z0 - pad && lz < R.z1 + pad) return S;
    }
    return null;
  }
  guardScatter(S) {
    const place = S.place.bind(S);
    S.place = (key, x, y, z, r, s) => {
      if (this.inHouseFoot(x, z, 0.15, /^(oak|pine|lilac|palm|glowbark)/.test(key) ? 2.5 * (s || 1) : 0) || this.inShellBounds(x, z, 1.2 * (s || 1))) { this.houseSkips.push(`${key}@${x.toFixed(1)},${z.toFixed(1)}`); return null; }
      return place(key, x, y, z, r, s);
    };
  }

  // build one settlement group's houses: the merged shell (walls, roofs, chimneys, doors; the cut-away works on it) and the
  // detail (shown within DETAIL_R), the walls as box colliders and the yard props as circles. Called by the layouts.
  buildHouses(group) {
    if (this.houseGroups.has(group)) return this.houseGroups.get(group);
    const specs = housesIn(group);
    if (!specs.length) return null;
    const res = buildHouseGroup(specs);
    const parent = this.areaGroups[HOUSE_GROUP_AREA[group]] || this.valleyGroup;
    const shell = assemble({ builder: res.shell, smokes: res.smokes, lanterns: res.lanterns, glows: res.glows, fires: res.fires });
    const detail = assemble({ builder: res.detail }, { shadow: !IS_MOBILE });
    shell.name = 'houses_' + group; detail.name = 'housesDetail_' + group;
    // (v115) the shells and their detail stand still: the static shadow cache draws them (engine/shadowCache.js; their
    // own update only drives the smoke, lanterns and fires in them, which stay dynamic casters)
    shell.userData.shadowStatic = true; detail.userData.shadowStatic = true;
    // (v109) their shadows go with the cut: an open house's hidden roof no longer shades its room
    for (const o of [shell, detail]) o.traverse((m) => { if (m.isMesh && m.castShadow && !m.customDepthMaterial) m.customDepthMaterial = cutDepthMaterial(); });
    let cx = 0, cy = 0, cz = 0;
    for (const S of specs) { cx += S.x / specs.length; cy += S.floorY / specs.length; cz += S.z / specs.length; }
    let reach = 0;
    for (const S of specs) reach = Math.max(reach, Math.hypot(S.x - cx, S.z - cz) + 10);
    // (built in world coordinates at the origin: the dyn loop updates its smoke and lanterns by the group's middle)
    shell.userData.center = new THREE.Vector3(cx, cy, cz); shell.userData.reach = reach + 80;
    shell.userData.houseGroup = group;
    // (review fix) each chimney's smoke, by house: hidden while its house is cut away, so it never drifts over the open room
    { const n = res.smokes.length, kids = n ? shell.children.slice(-n) : []; this.houseSmokes ||= new Map();
      kids.forEach((o, i) => { const id = res.smokes[i].house; if (!id || o.position.distanceToSquared(new THREE.Vector3().fromArray(res.smokes[i].p)) > 1e-4) return; if (!this.houseSmokes.has(id)) this.houseSmokes.set(id, []); this.houseSmokes.get(id).push(o); }); }
    // (v109) and each door lantern with its glow: the cut takes the wall it hangs on, so it went and its glow hung in the air
    { const nl = res.lanterns.length, ng = res.glows.length + res.fires.length + res.smokes.length, kids = nl ? shell.children.slice(-(nl + ng), ng ? -ng : undefined) : [];
      kids.forEach((o, i) => { const id = res.lanterns[i].house; if (!id || o.position.distanceToSquared(new THREE.Vector3().fromArray(res.lanterns[i].p)) > 1e-4) return; if (!this.houseSmokes.has(id)) this.houseSmokes.set(id, []); this.houseSmokes.get(id).push(o); }); }
    parent.add(shell, detail);
    // (v109) the CGTrader models of the shelled houses (houses/cgt.js), instanced, in the shell (cut-away, camera bump)
    if (specs.some((S) => S.shell) && cgtEnabled()) shellGroup(specs).then((o) => { if (!o) return; o.traverse((m) => { m.userData.houseGroup = group; }); shell.add(o); this._winDirty = true; });
    this.dyn.push(shell); // the camera bumps on the shells (not on the detail)
    for (const S of specs) for (const b of S.walls) this.boxes.push({ x: b.x, z: b.z, hw: b.hw, hd: b.hd, rot: b.rot, house: S.id });
    for (const c of res.circles) this.scatter.colliders.push({ x: c.x, z: c.z, r: c.r, house: c.house });
    // (review fix) bare earth under each valley house: the meadow grass (up to 1.1 m tall, rooted on the terrain 0.3 m or
    // more below the floor) grew up through the floorboards. The islands have no grass field.
    if (HOUSE_GROUP_AREA[group] === 'valley' && this.terrain.paintEarth) for (const S of specs) {
      const F = S.foot, lx = (F.x0 + F.x1) / 2, lz = (F.z0 + F.z1) / 2, c = Math.cos(S.rot), s = Math.sin(S.rot);
      this.terrain.paintEarth(S.x + lx * c + lz * s, S.z - lx * s + lz * c, (F.x1 - F.x0) / 2 - 0.1, (F.z1 - F.z0) / 2 - 0.1, S.rot, 0.8);
    }
    const G2 = { group, specs, shell, detail, x: cx, z: cz };
    this.houseGroups.set(group, G2);
    return G2;
  }

  // the interior of one house, built now (one per frame at most, from the queue): furniture circles join the colliders,
  // lamps and hearths join the light pool (this.houseSpots), everything sits in the house's area group
  buildHouseInterior(S) {
    const glb = tripoEnabled();
    const res = buildInterior(S, { props: glb });
    // the ready-made props (assets/tripoModels.js): oven, loom, workbench and the hearth, their built stand-ins shown until
    // the model is in; the model joins the house (houseInt) when it lands
    const slots = res.props.map((P) => modelSlot(P.name, { p: P.p, ry: P.ry, s: P.s, shadow: !IS_MOBILE, fallback: P.fb.build({ shadow: !IS_MOBILE }),
      onPut: (h) => h.traverse((o) => { o.userData.houseInt = S.id; }) }));
    const obj = assemble({ builder: res.builder, dynamics: slots, fires: res.fires, glows: res.lamps.map((l) => ({ p: l.p, color: l.color, size: 1.2 * (l.scale || 1), intensity: 0.5 })) }, { shadow: !IS_MOBILE });
    obj.name = 'inside_' + S.id;
    obj.traverse((o) => { o.userData.houseInt = S.id; });
    (this.areaGroups[S.area] || this.valleyGroup).add(obj);
    const circles = res.circles.map((c) => ({ x: c.x, z: c.z, r: c.r, house: S.id, kind: c.kind }));
    for (const c of circles) this.scatter.colliders.push(c);
    this._colDirty = true;
    const spots = [
      ...res.lamps.map((l) => ({ x: l.p[0], y: l.p[1], z: l.p[2], color: l.color, k: 0.5, fire: false, house: S.id })),
      ...res.fires.filter((f) => f.light !== false).map((f) => ({ x: f.p[0], y: f.p[1] + 0.6 * (f.scale || 1), z: f.p[2], color: 0xff9a40, k: f.scale || 1, fire: true, house: S.id })),
    ];
    const I = { S, obj, circles, spots, live: true };
    this.interiors.set(S.id, I);
    this.refreshHouseSpots();
    return I;
  }
  setInteriorLive(I, on) {
    if (I.live === on) return;
    I.live = on; I.obj.visible = on;
    for (const c of I.circles) c.off = !on;
    if (on) { const k = this.houseLru.indexOf(I); if (k >= 0) this.houseLru.splice(k, 1); }
    else this.houseLru.push(I);
    this.refreshHouseSpots();
  }
  freeInterior(I) {
    I.obj.removeFromParent();
    I.obj.traverse((o) => { if (!o.geometry?.userData?.shared) o.geometry?.dispose?.(); if (o.isSprite) o.material?.dispose?.(); });
    const drop = new Set(I.circles), cols = this.scatter.colliders;
    for (let i = cols.length - 1; i >= 0; i--) if (drop.has(cols[i])) cols.splice(i, 1);
    this._colDirty = true;
    this.interiors.delete(I.S.id);
    const k = this.houseLru.indexOf(I); if (k >= 0) this.houseLru.splice(k, 1);
    this.refreshHouseSpots();
  }
  refreshHouseSpots() {
    this.houseSpots = [];
    for (const I of this.interiors.values()) if (I.live) this.houseSpots.push(...I.spots);
    if (this.baseSpots) this.spots = this.baseSpots.concat(this.houseSpots);
  }

  // which interiors to have: the nearest LIVE enterable houses within BUILD_R (the one you are in first), in the area shown
  scanHouses(pos) {
    const area = this.areaGroups[this.area] ? this.area : null;
    const dist = (S) => Math.hypot(S.x - pos.x, S.z - pos.z);
    // the detail builders: shown near their houses only
    for (const g of this.houseGroups.values()) {
      let d = Infinity;
      for (const S of g.specs) d = Math.min(d, dist(S) - Math.max(S.w, S.d) / 2);
      g.detail.visible = d < HOUSE.DETAIL_R;
    }
    const near = area ? allHouses().filter((S) => S.enter && S.area === area && this.houseGroups.has(S.group) && dist(S) < HOUSE.BUILD_R) : [];
    near.sort((a, b) => (a === this.house ? -1 : b === this.house ? 1 : dist(a) - dist(b)));
    const want = near.slice(0, HOUSE.LIVE), wantSet = new Set(want);
    // live ones not wanted go to the LRU (hidden) once they are far or once there are too many
    let live = [...this.interiors.values()].filter((I) => I.live);
    for (const I of live.sort((a, b) => dist(b.S) - dist(a.S))) {
      if (wantSet.has(I.S)) continue;
      if (dist(I.S) > HOUSE.FREE_R || I.S.area !== area || live.filter((J) => J.live).length > HOUSE.LIVE) this.setInteriorLive(I, false);
    }
    for (const S of want) { const I = this.interiors.get(S.id); if (I) this.setInteriorLive(I, true); }
    while (this.houseLru.length > HOUSE.LRU) this.freeInterior(this.houseLru[0]);
    this.houseQueue = want.filter((S) => !this.interiors.has(S.id));
  }

  // every frame (world.update): the house you stand in, the interiors (scanned 4 times a second, one built per frame at
  // most), the interiors' fires, and the cut-away uniforms
  updateHouses(pos, dt, t) {
    // in a house: inside its inner rect or on its doorstep; kept until 0.6 m outside the room (so the doorway never flickers)
    const H = this.house;
    let keep = false;
    if (H && this.areaGroups[this.area]) { const [lx, lz] = toLocal(H, pos.x, pos.z), I = H.inner, o = HOUSE.OUT; keep = lx > I.x0 - o && lx < I.x1 + o && lz > I.z0 - o && lz < I.z1 + o; }
    // (spec deviation: you are in from the doorstep on, houseAt with the threshold, so the roof is already cut away as you
    // step through the door and the camera never squeezes in under the eaves)
    if (!keep) { const S = this.areaGroups[this.area] && pos.x < 700 ? houseAt(pos.x, pos.z, true) : null; this.house = S && S.enter && this.houseGroups.has(S.group) ? S : null; }
    if (this.house !== H) this._houseT = 0; // walking in: scan (and build its interior) at once
    this._houseT -= dt;
    if (this._houseT <= 0) { this._houseT = 0.25; this.scanHouses(pos); }
    if (this.houseQueue.length) { const S = this.houseQueue.shift(); if (!this.interiors.has(S.id)) this.buildHouseInterior(S); }
    for (const I of this.interiors.values()) if (I.live) I.obj.userData.update?.(dt, t);
    this.updateCuts(pos, dt);
  }

  // v108: the RuneScape-style cut-away. Up to CUT_SLOTS houses are open at once: the one you stand in (world.house, with
  // its own 0.6 m hysteresis) and any house whose walls or roof stand between the camera and you (held for 0.6 s after
  // the view clears and tested against a box 0.8 m larger to let go, so walking past a corner never toggles it). Each open
  // house eases its cut line down from over its roof to the wainscot (CUT_LOW) over CUT_EASE seconds and back up when it
  // closes: a smooth wipe, no dither and nothing that flips frame to frame. The cut walls are capped with sill strips
  // (houses/index.js buildCutCaps) that ride the cut line down.
  occludes(S, cam, head, grow) {
    const [ax, az] = toLocal(S, cam.x, cam.z), [bx, bz] = toLocal(S, head.x, head.z), R = S.cutRect;
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    for (const [p, q] of [[-dx, ax - (R.x0 - grow)], [dx, R.x1 + grow - ax], [-dz, az - (R.z0 - grow)], [dz, R.z1 + grow - az]]) {
      if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    if (t0 > t1 || t0 > 0.97) return false; // (the last few cm: the hero's own head, never a wall in front of it)
    const top = S.floorY + (S.wallTop || 3) + (S.roof?.rise || 0) + grow;
    return Math.min(cam.y + (head.y - cam.y) * t0, cam.y + (head.y - cam.y) * t1) < top;
  }
  updateCuts(pos, dt) {
    const cuts = (this._cuts ||= new Map());
    for (const C of cuts.values()) C.want = false;
    const want = (S, hold) => { let C = cuts.get(S.id); if (!C) cuts.set(S.id, (C = { S, k: 0, hold: 0, caps: null })); C.want = true; if (hold) C.hold = hold; };
    if (this.house) want(this.house, 0);
    const cam = this.camPos;
    if (cam && this.areaGroups[this.area] && pos.x < 700) {
      const head = _cutHead.set(pos.x, pos.y + 1.4, pos.z);
      for (const S of allHouses()) {
        if (S === this.house || !this.houseGroups.has(S.group) || Math.abs(S.x - pos.x) > 40 || Math.abs(S.z - pos.z) > 40) continue;
        const C = cuts.get(S.id), on = C && C.k > 0;
        if (this.occludes(S, cam, head, on ? 0.8 : 0)) want(S, 0.6);
        else if (C && C.hold > 0) { C.hold -= dt; if (C.hold > 0) C.want = true; }
      }
    }
    for (const [id, C] of cuts) {
      C.k = Math.max(0, Math.min(1, C.k + ((C.want ? 1 : -1) * dt) / HOUSE.CUT_EASE));
      if (C.k <= 0 && !C.want) { if (C.caps) for (const o of C.caps) o.visible = false; cuts.delete(id); }
    }
    // the slots: the house you stand in first, then the most open
    const list = [...cuts.values()].sort((a, b) => (a.S === this.house ? -1 : b.S === this.house ? 1 : b.k - a.k)).slice(0, CUT_SLOTS);
    // chimney smoke and door lanterns are hidden over an open house
    const smoke = new Set(list.map((C) => C.S.id));
    for (const id of this._smokeOff || []) if (!smoke.has(id)) for (const o of this.houseSmokes?.get(id) || []) o.visible = true;
    for (const id of smoke) for (const o of this.houseSmokes?.get(id) || []) o.visible = false;
    this._smokeOff = smoke;
    G.cutOn.value = list.length ? 1 : 0;
    for (let i = 0; i < CUT_SLOTS; i++) {
      const C = list[i];
      if (!C) { G.cutA.value[i].w = 0; continue; }
      const S = C.S, k = C.k * C.k * (3 - 2 * C.k), top = S.floorY + (S.wallTop || 3) + (S.roof?.rise || 0) + 0.6;
      const low = top + (S.floorY + CUT_LOW - top) * k, ceil = Math.max(low, S.floorY + CUT_CEIL);
      C.low = low;
      G.cutA.value[i].set(S.x, S.z, S.rot, 1);
      G.cutR.value[i].set(S.cutRect.x0, S.cutRect.z0, S.cutRect.x1, S.cutRect.z1);
      G.cutF.value[i].set(S.foot.x0, S.foot.z0, S.foot.x1, S.foot.z1);
      G.cutH.value[i].set(low, ceil, S.floorY, 0);
      if (!C.parts) { C.parts = cutParts(S); C.keep = cutKeep(S); } // (specs are frozen: kept on the cut entry)
      { const K = C.keep; if (K) G.cutK.value[i].set(K.x0, K.z0, K.x1, K.z1); else G.cutK.value[i].set(1e6, 1e6, -1e6, -1e6); }
      for (let j = 0; j < CUT_PARTS; j++) { const P = C.parts[j], V = G.cutP.value[i * CUT_PARTS + j]; if (P) V.set(P.x0, P.z0, P.x1, P.z1); else V.set(1e6, 1e6, -1e6, -1e6); }
      // the sill strips: just under the cut line (never over their own wall's top), shown while the house is open
      if (!C.caps) C.caps = this.cutCaps(S);
      for (const o of C.caps) { o.position.y = Math.min(low, S.floorY + o.userData.capTop) - 0.004; o.visible = true; }
    }
    for (const C of cuts.values()) if (C.caps && !list.includes(C)) for (const o of C.caps) o.visible = false;
  }
  // is a world point cut away by an open house (its cut box, above its cut line)? The camera's lens ignores such hits.
  cutHides(p) {
    if (!this._cuts?.size) return false;
    for (const C of this._cuts.values()) {
      const S = C.S, [lx, lz] = toLocal(S, p.x, p.z), R = S.cutRect;
      if (lx < R.x0 - 0.2 || lx > R.x1 + 0.2 || lz < R.z0 - 0.2 || lz > R.z1 + 0.2) continue;
      if (p.y > (C.low ?? Infinity)) return true;
    }
    return false;
  }
  // one house's sill strips (built once, kept hidden while the house is closed)
  cutCaps(S) {
    const all = (this._capObjs ||= new Map());
    if (all.has(S.id)) return all.get(S.id);
    const parent = this.houseGroups.get(S.group)?.shell.parent || this.valleyGroup;
    const out = buildCutCaps(S).map(({ builder, top }) => {
      const o = builder.build({ shadow: false });
      o.userData.houseGroup = S.group; o.userData.capTop = top; o.name = 'cutCaps_' + S.id; o.visible = false;
      o.traverse((m) => { m.userData.houseGroup = S.group; m.frustumCulled = false; });
      parent.add(o);
      return o;
    });
    all.set(S.id, out);
    return out;
  }

  // D8: an 8 m grid over the circle colliders and the boxes (7,400 circles and ~240 boxes were all tested by every
  // collide call). Rebuilt when either list changes length or is marked dirty (_colDirty: house interiors built and freed,
  // homestead furnishings moved); off flags are read at query time. A query takes every item whose bounds come within
  // radius + 4 m of the point and visits them in list order (boxes first, then circles), as the full loops did, so the
  // pushes come out the same.
  colGrid() {
    const cols = this.colliders, boxes = this.boxes;
    let Q = this._cg;
    if (Q && Q.cols === cols && Q.boxes === boxes && Q.nc === cols.length && Q.nb === boxes.length && !this._colDirty) return Q;
    this._colDirty = false;
    Q = this._cg = { cols, boxes, nc: cols.length, nb: boxes.length, cc: new Map(), cb: new Map(), sc: new Uint32Array(cols.length), sb: new Uint32Array(boxes.length), stamp: 0, tmp: [] };
    const C = COL_CELL, put = (map, i, x0, z0, x1, z1) => {
      for (let cx = Math.floor(x0 / C), cx1 = Math.floor(x1 / C); cx <= cx1; cx++) for (let cz = Math.floor(z0 / C), cz1 = Math.floor(z1 / C); cz <= cz1; cz++) {
        const k = (cx + 8192) * 16384 + (cz + 8192); let a = map.get(k); if (!a) map.set(k, (a = [])); a.push(i);
      }
    };
    cols.forEach((c, i) => put(Q.cc, i, c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r));
    boxes.forEach((b, i) => { const r = Math.hypot(b.hw, b.hd); put(Q.cb, i, b.x - r, b.z - r, b.x + r, b.z + r); });
    return Q;
  }
  // the indices in one grid map near (x, z), sorted (list order); into Q.tmp
  colNear(Q, map, seen, x, z, reach) {
    const out = Q.tmp; out.length = 0;
    const st = ++Q.stamp, C = COL_CELL;
    for (let cx = Math.floor((x - reach) / C), cx1 = Math.floor((x + reach) / C); cx <= cx1; cx++) for (let cz = Math.floor((z - reach) / C), cz1 = Math.floor((z + reach) / C); cz <= cz1; cz++) {
      const a = map.get((cx + 8192) * 16384 + (cz + 8192)); if (!a) continue;
      for (let k = 0; k < a.length; k++) { const i = a[k]; if (seen[i] !== st) { seen[i] = st; out.push(i); } }
    }
    if (out.length > 1) out.sort(numAsc);
    return out;
  }

  // push a circle out of static colliders (trees, rocks, buildings)
  collide(pos, radius) {
    const Q = this.colGrid(), reach = radius + 4, cols = this.colliders;
    if (pos.x >= DUNGEON_MIN_X) {
      for (const i of this.colNear(Q, Q.cc, Q.sc, pos.x, pos.z, reach)) { const c = cols[i]; if (c.off || c.x < DUNGEON_MIN_X) continue; const dx = pos.x - c.x, dz = pos.z - c.z, rr = c.r + radius, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = c.x + (dx / d) * rr; pos.z = c.z + (dz / d) * rr; } }
      const [x, z] = dungeonPush(pos.x, pos.z, radius); pos.x = x; pos.z = z; return;
    }
    for (const i of this.colNear(Q, Q.cb, Q.sb, pos.x, pos.z, reach)) {
      const b = this.boxes[i];
      if (b.off) continue;
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const dx = pos.x - b.x, dz = pos.z - b.z;
      // into box space
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const hw = b.hw + radius, hd = b.hd + radius;
      if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
        const px = hw - Math.abs(lx), pz = hd - Math.abs(lz);
        let nx = lx, nz = lz;
        if (px < pz) nx = Math.sign(lx || 1) * hw; else nz = Math.sign(lz || 1) * hd;
        // deep in a solid house box (a teleport): never out into a room it was not in (the same rule as shared housePush)
        if (b.house && Math.min(px, pz) > radius && houseAt(pos.x, pos.z, false)?.id !== b.house) {
          const outs = [[Math.sign(lx || 1) * hw, lz, px], [-Math.sign(lx || 1) * hw, lz, 2 * hw - px], [lx, Math.sign(lz || 1) * hd, pz], [lx, -Math.sign(lz || 1) * hd, 2 * hd - pz]].sort((a, b2) => a[2] - b2[2]);
          for (const [ox, oz] of outs) if (houseAt(b.x + ox * c + oz * s, b.z - ox * s + oz * c, false)?.id !== b.house) { nx = ox; nz = oz; break; }
        }
        pos.x = b.x + nx * c + nz * s;
        pos.z = b.z - nx * s + nz * c;
      }
    }
    for (const i of this.colNear(Q, Q.cc, Q.sc, pos.x, pos.z, reach)) {
      const c = cols[i];
      if (c.off) continue;
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const rr = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = c.x + (dx / d) * rr;
        pos.z = c.z + (dz / d) * rr;
      }
    }
  }
}
