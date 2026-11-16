// World content: mobs, spawn regions, NPCs, quests, items. Shared by server and client.
//
// The valley is laid out in level bands, each with a hub, its zones and a dungeon:
//   1-5   Sunmere Village, the Meadows, Brightfield Farms, the Greenwood edge, Briarhold (bandits, west)
//   5-10  Glimmer Glade (north-east), Ironcliff Quarry (east)       dungeon: Ironcliff Deepmine (8-10)
//   10-15 Dunewatch Post, the Sunscar Expanse, Brasswind Dig, Sandsunk Ruins, Dustcloak Camp (south)
//                                                                   dungeon: Sandsunk Vault (13-15)
//   15-20 Foundry Watch, Rustwood and the Old Sawmill, the Old Foundry (north-west)
//                                                                   dungeon: The Foundry Depths (18-20)
//
// The Main Story (one linear, unskippable chain through all of it) lives in story.js and is applied at the end of this file.
import { GEMS, dsaModel } from './items.js';
import { applyStory } from './story.js';
import { DUNGEON_BY_ID } from './dungeons.js';
import { REACH } from './reach.js';
import { RIME } from './rime.js';
import { HEIGHTS } from './heights.js';
import { TIDEWATER } from './tidewater.js';
import { RAINWARD } from './rainward.js';
import { ITEM_ART } from './itemArt.js';
const PI2 = Math.PI * 2;

export const MOBS = {
  // ---- rare elites: one roaming named machine per band, long respawn, a unique drop
  rattletrap: { name: 'Old Rattletrap', model: 'rattletrap', lvl: [4, 4], hp: 520, dmg: [7, 11], speed: 4.6, aggro: 12, range: 2.6, swing: 1.8, xp: 320, loot: 'rare1', radius: 1.0, elite: true, rare: true, abilities: [{ kind: 'nova', every: 13, r: 4, delay: 1.6, dmg: 1.3, text: 'Old Rattletrap spins up its cogs!' }] },
  clatterhook: { name: 'Clatterhook', model: 'clatterhook', lvl: [9, 9], hp: 1300, dmg: [12, 19], speed: 3.8, aggro: 13, range: 3.4, swing: 2.1, xp: 650, loot: 'rare2', radius: 1.6, elite: true, rare: true, abilities: [{ kind: 'circles', every: 12, n: 2, r: 3, delay: 1.7, dmg: 1.4, text: 'Clatterhook flings out its tines!' }] },
  sandsplitter: { name: 'Sandsplitter', model: 'sandsplitter', lvl: [14, 14], hp: 2400, dmg: [17, 27], speed: 4.6, aggro: 15, range: 3.6, swing: 2.2, xp: 950, loot: 'rare3', radius: 1.6, elite: true, rare: true, abilities: [{ kind: 'nova', every: 12, r: 5.5, delay: 1.7, dmg: 1.5, text: 'Sandsplitter rears up to stamp!' }] },
  ironbark: { name: 'Ironbark', model: 'ironbark', lvl: [18, 18], hp: 3200, dmg: [21, 33], speed: 3.8, aggro: 14, range: 3.6, swing: 2.3, xp: 1300, loot: 'rare4', radius: 1.8, elite: true, rare: true, abilities: [{ kind: 'circles', every: 11, n: 3, r: 3.2, delay: 1.8, dmg: 1.5, text: 'Ironbark hurls splintered logs!' }, { kind: 'enrage', at: 0.3, text: 'Ironbark\'s saw shrieks!' }] },
  // ---- 1-5: meadows, farms, the Greenwood edge and Briarhold
  gearling: { name: 'Rogue Gearling', model: 'gearling', lvl: [1, 2], hp: 42, dmg: [3, 6], speed: 4.0, aggro: 9, range: 2.0, swing: 1.9, xp: 45, loot: 'scrap', radius: 0.6 },
  scrapper: { name: 'Scrap Roller', model: 'gearling', variant: 1, lvl: [2, 4], hp: 64, dmg: [4, 8], speed: 5.2, aggro: 11, range: 2.2, swing: 1.6, xp: 60, loot: 'scrap', radius: 0.7 },
  tiller: { name: 'Runaway Tiller', model: 'tiller', lvl: [3, 4], hp: 100, dmg: [5, 9], speed: 3.8, aggro: 10, range: 2.6, swing: 2.2, xp: 70, loot: 'scrap', radius: 0.9 },
  bandit: { name: 'Briar Cutthroat', model: 'raider', variant: 3, lvl: [3, 5], hp: 92, dmg: [5, 9], speed: 5.0, aggro: 12, range: 2.2, swing: 1.8, xp: 75, loot: 'bandit', radius: 0.5, humanoid: true },
  banditArcher: { name: 'Briar Bowman', model: 'raider', variant: 4, lvl: [4, 5], hp: 80, dmg: [4, 8], speed: 4.6, aggro: 17, range: 17, swing: 2.4, xp: 78, loot: 'bandit', radius: 0.5, humanoid: true, ranged: 'arrow' },
  banditBoss: { name: 'Garrick Briar', model: 'raider', variant: 5, lvl: [5, 5], hp: 760, dmg: [9, 15], speed: 5.2, aggro: 14, range: 2.8, swing: 1.9, xp: 520, loot: 'banditBoss', radius: 0.6, humanoid: true, elite: true , abilities: [{ kind: 'nova', every: 14, r: 5, delay: 1.7, dmg: 1.4, text: 'Garrick swings his axe in a wide circle!' }] },
  hollis: { name: 'Hollis the Fence', model: 'raider', variant: 12, lvl: [5, 5], hp: 680, dmg: [8, 13], speed: 5.2, aggro: 13, range: 2.6, swing: 1.8, xp: 420, loot: 'warrensElite', radius: 0.6, humanoid: true, elite: true, abilities: [{ kind: 'circles', every: 12, n: 2, r: 2.8, delay: 1.7, dmg: 1.3, text: 'Hollis throws a pot of lamp oil!' }] },
  thresher: { name: 'The Iron Thresher', model: 'thresher', lvl: [6, 6], hp: 12000, dmg: [11, 17], speed: 3.2, aggro: 15, range: 4.2, swing: 2.5, xp: 1100, loot: 'thresher', radius: 2.2, elite: true, boss: true, abilities: [{ kind: 'circles', every: 10, n: 3, r: 3.0, delay: 1.9, dmg: 1.4, text: 'The Thresher spits out chaff and stones!' }, { kind: 'nova', every: 16, r: 6, delay: 2.2, dmg: 1.8, text: 'The Thresher spins its drum. Get clear!' }, { kind: 'enrage', at: 0.3, text: 'The Thresher\'s boiler shrieks!' }] },
  // ---- 5-10: Glimmer Glade, Westfold, Ironcliff Quarry, the Deepmine
  harvester: { name: 'Rusted Harvester', model: 'harvester', lvl: [6, 8], hp: 170, dmg: [8, 13], speed: 3.6, aggro: 11, range: 2.9, swing: 2.2, xp: 100, loot: 'harvester', radius: 1.2 },
  rustguard: { name: 'Rusted Warden-Engine', model: 'sentinel', variant: 1, lvl: [5, 7], hp: 150, dmg: [7, 12], speed: 3.4, aggro: 12, range: 2.8, swing: 2.4, xp: 95, loot: 'foundry', radius: 0.9 },
  poacher: { name: 'Glade Poacher', model: 'raider', variant: 6, lvl: [6, 8], hp: 160, dmg: [7, 12], speed: 5.0, aggro: 13, range: 2.3, swing: 1.8, xp: 105, loot: 'bandit', radius: 0.5, humanoid: true },
  driller: { name: 'Quarry Driller', model: 'driller', lvl: [7, 9], hp: 200, dmg: [9, 15], speed: 3.4, aggro: 13, range: 2.6, swing: 2.0, xp: 120, loot: 'quarry', radius: 0.9 },
  hauler: { name: 'Ore Hauler', model: 'driller', variant: 1, lvl: [8, 9], hp: 240, dmg: [10, 16], speed: 3.0, aggro: 11, range: 3.0, swing: 2.4, xp: 135, loot: 'quarry', radius: 1.1 },
  crusher: { name: 'The Stonegrinder', model: 'crusher', lvl: [10, 10], hp: 3000, dmg: [20, 32], speed: 2.8, aggro: 18, range: 4.8, swing: 2.8, xp: 1800, loot: 'crusher', radius: 2.7, elite: true, boss: true , abilities: [{ kind: 'circles', every: 11, n: 3, r: 3.2, delay: 1.9, dmg: 1.5, text: 'The Stonegrinder flings out broken rock!' }, { kind: 'enrage', at: 0.35, text: 'The Stonegrinder\'s drum screams faster!' }] },
  sapper: { name: 'Deepmine Sapper', model: 'raider', variant: 7, lvl: [8, 9], hp: 220, dmg: [9, 15], speed: 4.8, aggro: 12, range: 2.4, swing: 1.9, xp: 130, loot: 'deepmine', radius: 0.5, humanoid: true },
  borer: { name: 'Tunnel Borer', model: 'borer', lvl: [9, 9], hp: 1100, dmg: [14, 22], speed: 3.0, aggro: 13, range: 3.2, swing: 2.2, xp: 600, loot: 'deepElite', radius: 1.4, elite: true , abilities: [{ kind: 'nova', every: 12, r: 4.5, delay: 1.7, dmg: 1.5 }] },
  dregg: { name: 'Overseer Dregg', model: 'raider', variant: 11, lvl: [9, 9], hp: 1200, dmg: [13, 21], speed: 5.0, aggro: 13, range: 2.8, swing: 1.9, xp: 650, loot: 'deepElite', radius: 0.6, humanoid: true, elite: true , abilities: [{ kind: 'circles', every: 12, n: 2, r: 3.0, delay: 1.8, dmg: 1.4, text: 'Dregg lights a blasting charge!' }] },
  grandbore: { name: 'The Grand Bore', model: 'grandbore', lvl: [10, 10], hp: 21000, dmg: [22, 34], speed: 2.6, aggro: 16, range: 5.0, swing: 2.8, xp: 2600, loot: 'grandbore', radius: 2.8, elite: true, boss: true , abilities: [{ kind: 'circles', every: 10, n: 4, r: 3.4, delay: 1.9, dmg: 1.5, text: 'Rock falls from the cavern roof!' }, { kind: 'nova', every: 17, r: 7, delay: 2.3, dmg: 2.0, text: 'The Grand Bore drives its drill into the floor. Get clear!' }, { kind: 'enrage', at: 0.35, text: 'The Grand Bore overheats!' }] },
  // ---- 10-15: the Sunscar, Brasswind Dig, Dustcloak Camp, the Sandsunk Vault
  crawler: { name: 'Sand Crawler', model: 'crawler', lvl: [10, 12], hp: 260, dmg: [9, 15], speed: 3.8, aggro: 11, range: 2.8, swing: 2.1, xp: 150, loot: 'desert', radius: 1.1 },
  raider: { name: 'Dustcloak Raider', model: 'raider', variant: 0, lvl: [11, 13], hp: 280, dmg: [9, 16], speed: 5.0, aggro: 13, range: 2.4, swing: 1.7, xp: 160, loot: 'raider', radius: 0.5, humanoid: true },
  raiderArcher: { name: 'Dustcloak Lookout', model: 'raider', variant: 1, lvl: [12, 13], hp: 250, dmg: [8, 14], speed: 4.6, aggro: 18, range: 18, swing: 2.4, xp: 165, loot: 'raider', radius: 0.5, humanoid: true, ranged: 'arrow' },
  strider: { name: 'Dune Strider', model: 'strider', lvl: [12, 14], hp: 330, dmg: [11, 18], speed: 4.2, aggro: 14, range: 3.0, swing: 2.3, xp: 175, loot: 'striders', radius: 1.0 },
  chief: { name: 'Varrok the Dustcloak', model: 'raider', variant: 2, lvl: [15, 15], hp: 3400, dmg: [20, 32], speed: 5.4, aggro: 15, range: 2.8, swing: 1.8, xp: 1500, loot: 'chief', radius: 0.6, humanoid: true, elite: true , abilities: [{ kind: 'nova', every: 13, r: 5.5, delay: 1.6, dmg: 1.5, text: 'Varrok spins his axe!' }, { kind: 'enrage', at: 0.4, text: 'Varrok fights like a cornered man!' }] },
  guardian: { name: 'Vault Guardian', model: 'sentinel', variant: 2, lvl: [13, 14], hp: 360, dmg: [11, 18], speed: 3.6, aggro: 12, range: 2.8, swing: 2.3, xp: 185, loot: 'vault', radius: 0.9 },
  looter: { name: 'Dustcloak Looter', model: 'raider', variant: 8, lvl: [13, 14], hp: 330, dmg: [10, 17], speed: 5.0, aggro: 13, range: 2.4, swing: 1.7, xp: 180, loot: 'vault', radius: 0.5, humanoid: true },
  rask: { name: 'Rask the Looter-King', model: 'raider', variant: 10, lvl: [14, 14], hp: 2200, dmg: [17, 27], speed: 5.4, aggro: 14, range: 2.8, swing: 1.8, xp: 900, loot: 'vaultElite', radius: 0.6, humanoid: true, elite: true , abilities: [{ kind: 'circles', every: 11, n: 3, r: 2.8, delay: 1.6, dmg: 1.4, text: 'Rask hurls a spray of knives!' }] },
  keeper: { name: 'Vault Keeper Engine', model: 'keeper', lvl: [14, 14], hp: 2400, dmg: [17, 27], speed: 3.2, aggro: 13, range: 3.4, swing: 2.4, xp: 950, loot: 'vaultElite', radius: 1.3, elite: true , abilities: [{ kind: 'nova', every: 12, r: 5, delay: 1.9, dmg: 1.6, text: 'The Keeper Engine charges its pistons!' }] },
  colossus: { name: 'The Vault Colossus', model: 'colossus', lvl: [15, 15], hp: 31000, dmg: [26, 40], speed: 2.8, aggro: 16, range: 5.0, swing: 2.9, xp: 3600, loot: 'colossus', radius: 2.4, elite: true, boss: true , abilities: [{ kind: 'nova', every: 14, r: 8, delay: 2.4, dmg: 2.2, text: 'The Colossus raises its fists. Get clear!' }, { kind: 'circles', every: 9, n: 4, r: 3.0, delay: 1.8, dmg: 1.4, text: 'Sand pours from the vault ceiling!' }, { kind: 'enrage', at: 0.3, text: 'The Colossus grinds into overdrive!' }] },
  // ---- 15-20: Rustwood, the Old Sawmill, Northwatch Keep, the Old Foundry, the Foundry Depths
  nwarden: { name: 'Northwatch Warden-Engine', model: 'nwarden', lvl: [19, 19], hp: 3200, dmg: [22, 34], speed: 3.0, aggro: 14, range: 3.6, swing: 2.5, xp: 1400, loot: 'depthsElite', radius: 1.4, elite: true, abilities: [{ kind: 'nova', every: 12, r: 5.5, delay: 1.8, dmg: 1.6, text: 'The Warden-Engine braces and stamps!' }, { kind: 'enrage', at: 0.35, text: 'The Warden-Engine\'s gears grind red-hot!' }] },
  sawyer: { name: 'Rustwood Sawyer', model: 'sawyer', lvl: [15, 17], hp: 380, dmg: [12, 20], speed: 3.6, aggro: 12, range: 2.9, swing: 2.2, xp: 200, loot: 'rustwood', radius: 1.1 },
  scavenger: { name: 'Rustwood Scavenger', model: 'raider', variant: 9, lvl: [15, 16], hp: 360, dmg: [12, 19], speed: 5.0, aggro: 13, range: 2.4, swing: 1.8, xp: 195, loot: 'bandit', radius: 0.5, humanoid: true },
  sentinel: { name: 'Brass Sentinel', model: 'sentinel', lvl: [16, 18], hp: 420, dmg: [13, 21], speed: 3.6, aggro: 13, range: 2.8, swing: 2.3, xp: 215, loot: 'foundry', radius: 0.9 },
  furnace: { name: 'Furnace Engine', model: 'furnace', lvl: [17, 19], hp: 470, dmg: [14, 23], speed: 3.2, aggro: 12, range: 3.0, swing: 2.4, xp: 230, loot: 'foundry', radius: 1.0 },
  foreman: { name: 'The Foreman', model: 'foreman', lvl: [19, 19], hp: 6000, dmg: [28, 42], speed: 3.2, aggro: 18, range: 4.2, swing: 2.6, xp: 3600, loot: 'foreman', radius: 2.2, elite: true, boss: true , abilities: [{ kind: 'circles', every: 10, n: 3, r: 3.5, delay: 1.8, dmg: 1.5, text: 'The Foreman hammers the ground, scattering slag!' }, { kind: 'enrage', at: 0.4, text: 'The Foreman\'s boiler roars!' }] },
  overseer: { name: 'Depths Overseer', model: 'overseer', lvl: [19, 19], hp: 3000, dmg: [22, 34], speed: 3.0, aggro: 14, range: 3.4, swing: 2.4, xp: 1400, loot: 'depthsElite', radius: 1.4, elite: true , abilities: [{ kind: 'circles', every: 10, n: 3, r: 3.2, delay: 1.8, dmg: 1.5, text: 'The Overseer opens the slag gates!' }] },
  forgemaster: { name: 'The Forgemaster', model: 'forgemaster', lvl: [20, 20], hp: 40000, dmg: [32, 48], speed: 3.0, aggro: 18, range: 5.2, swing: 2.8, xp: 6000, loot: 'forgemaster', radius: 2.8, elite: true, boss: true , abilities: [{ kind: 'circles', every: 8, n: 5, r: 3.4, delay: 1.8, dmg: 1.6, text: 'Molten metal spills across the floor!' }, { kind: 'nova', every: 16, r: 8.5, delay: 2.4, dmg: 2.4, text: 'The Forgemaster vents its furnace. Get clear!' }, { kind: 'enrage', at: 0.3, text: 'The Forgemaster burns white-hot!' }] },
};

// dungeon spawn helper: local dungeon coordinates -> world
const ds = (d, mob, x, z, r, n, extra = {}) => ({ mob, x: DUNGEON_BY_ID[d].ox + x, z: DUNGEON_BY_ID[d].oz + z, r, n, dungeon: d, ...extra });

// spawn regions: { mob, x, z, r, n, lvl? } (lvl overrides the mob's level range)
export const SPAWNS = [
  // ---- rare elites (they roam wide; minimap shows them silver)
  { mob: 'rattletrap', x: 66, z: 88, r: 18, n: 1 }, // out in the north meadows, clear of the village (its wander never reaches the houses)
  { mob: 'clatterhook', x: -178, z: 52, r: 22, n: 1 },
  { mob: 'sandsplitter', x: 130, z: 176, r: 34, n: 1 },
  { mob: 'ironbark', x: -178, z: -100, r: 28, n: 1 },
  // ---- patrols on the roads between the hubs
  { mob: 'scrapper', path: [[70, 10], [100, 12], [128, 6], [150, -8]], r: 2, n: 2, lvl: [2, 3] }, // (through the starter field: never above a level 1 player's + 2)
  { mob: 'bandit', path: [[-58, 12], [-80, 8], [-100, -2], [-112, -10]], r: 2, n: 2 },
  { mob: 'poacher', path: [[150, -132], [164, -110], [178, -82], [178, -60]], r: 2, n: 2, lvl: [7, 7] },
  { mob: 'raider', path: [[-50, 176], [-80, 186], [-110, 196], [-130, 204]], r: 2, n: 3, lvl: [11, 12] },
  { mob: 'strider', path: [[194, 84], [196, 128], [182, 166], [160, 196]], r: 2, n: 2, lvl: [12, 13] },
  { mob: 'sawyer', path: [[-104, -74], [-150, -66], [-186, -62]], r: 2, n: 2, lvl: [16, 16] },
  { mob: 'sentinel', path: [[-128, -136], [-140, -162], [-166, -160], [-170, -134], [-150, -124]], r: 2, n: 2, lvl: [17, 17] },
  // ---- Sunmere Meadows and Brightfield Farms (1-4)
  { mob: 'gearling', x: 68, z: -40, r: 18, n: 6 },
  { mob: 'gearling', x: 98, z: 14, r: 26, n: 9 },
  { mob: 'gearling', x: 30, z: 74, r: 16, n: 5 },
  { mob: 'gearling', x: -62, z: 70, r: 14, n: 4 } /* moved off the homestead plot */,
  { mob: 'scrapper', x: 124, z: 40, r: 16, n: 6 },
  { mob: 'scrapper', x: 60, z: -72, r: 14, n: 4 },
  { mob: 'scrapper', x: -78, z: -56, r: 18, n: 5 },
  { mob: 'tiller', x: 128, z: 14, r: 9, n: 4 }, // (east of the gearling field, so a new player is not drawn into them)
  { mob: 'tiller', x: 114, z: 38, r: 7, n: 3 },
  // ---- Briarhold and the Greenwood edge (3-5)
  { mob: 'bandit', x: -122, z: -14, r: 16, n: 8 },
  { mob: 'bandit', x: -92, z: 2, r: 9, n: 3 },
  { mob: 'bandit', x: -66, z: -80, r: 11, n: 4 },
  { mob: 'banditArcher', x: -124, z: -20, r: 14, n: 4 },
  { mob: 'banditArcher', x: -70, z: -66, r: 9, n: 2 },
  { mob: 'banditBoss', x: -130, z: -26, r: 2, n: 1 },
  // ---- Westfold Farmsteads (6-8)
  { mob: 'harvester', x: -196, z: 44, r: 16, n: 7 },
  { mob: 'harvester', x: -168, z: 58, r: 10, n: 3 },
  // ---- the Briar Warrens (4-6)
  ds('warrens', 'bandit', 26, 62, 6, 3, { lvl: [4, 5] }), ds('warrens', 'bandit', 72, 60, 7, 3, { lvl: [4, 5] }), ds('warrens', 'banditArcher', 76, 56, 4, 1, { lvl: [5, 5] }),
  ds('warrens', 'scrapper', 48, 46, 5, 2, { lvl: [4, 5] }), ds('warrens', 'bandit', 22, 31, 6, 3, { lvl: [5, 5] }), ds('warrens', 'hollis', 22, 26, 1, 1),
  ds('warrens', 'scrapper', 76, 28, 6, 2, { lvl: [5, 5] }), ds('warrens', 'banditArcher', 78, 32, 5, 2, { lvl: [5, 5] }),
  ds('warrens', 'thresher', 50, 12, 1, 1),
  // ---- Glimmer Glade (5-8)
  { mob: 'rustguard', x: 132, z: -152, r: 24, n: 7 },
  { mob: 'rustguard', x: 106, z: -108, r: 12, n: 3 },
  { mob: 'poacher', x: 178, z: -128, r: 12, n: 6 },
  { mob: 'poacher', x: 166, z: -96, r: 10, n: 3 },
  // ---- Ironcliff Quarry (7-10)
  { mob: 'driller', x: 208, z: -36, r: 19, n: 7 },
  { mob: 'driller', x: 200, z: -12, r: 10, n: 3 },
  { mob: 'hauler', x: 214, z: -46, r: 12, n: 4 },
  { mob: 'crusher', x: 209, z: -36, r: 2, n: 1 },
  // ---- Ironcliff Deepmine (8-10)
  ds('deepmine', 'sapper', 58, 66, 6, 3), ds('deepmine', 'driller', 60, 62, 5, 1, { lvl: [8, 8] }),
  ds('deepmine', 'driller', 24, 60, 8, 3, { lvl: [8, 9] }), ds('deepmine', 'hauler', 20, 56, 5, 1, { lvl: [9, 9] }),
  ds('deepmine', 'hauler', 98, 54, 7, 2, { lvl: [9, 9] }), ds('deepmine', 'driller', 96, 58, 7, 2, { lvl: [8, 9] }),
  ds('deepmine', 'sapper', 22, 44, 3, 2), ds('deepmine', 'driller', 90, 40, 3, 2, { lvl: [9, 9] }),
  ds('deepmine', 'sapper', 30, 28, 7, 4), ds('deepmine', 'dregg', 30, 23, 1, 1),
  ds('deepmine', 'borer', 62, 37, 1, 1), ds('deepmine', 'sapper', 60, 40, 5, 2),
  ds('deepmine', 'grandbore', 64, 12, 1, 1),
  // ---- the Sunscar Expanse (10-13)
  { mob: 'crawler', x: 60, z: 152, r: 26, n: 7 },
  { mob: 'crawler', x: -100, z: 142, r: 20, n: 5 },
  { mob: 'crawler', x: 145, z: 150, r: 14, n: 5 }, // on the open Sunscar: clear of the level 1-3 meadows and the Brasswind camp
  { mob: 'raider', x: 30, z: 190, r: 18, n: 5 },
  { mob: 'raider', x: -88, z: 214, r: 14, n: 4 },
  { mob: 'raiderArcher', x: 40, z: 206, r: 10, n: 2 },
  // ---- Brasswind Dig (12-14)
  { mob: 'strider', x: 196, z: 152, r: 18, n: 8 },
  { mob: 'strider', x: 228, z: 108, r: 14, n: 4 },
  // ---- Sandsunk Ruins (13-14)
  { mob: 'looter', x: -152, z: 196, r: 14, n: 6, lvl: [13, 13] },
  // ---- Dustcloak Camp (13-15)
  { mob: 'raider', x: 110, z: 230, r: 22, n: 8, lvl: [13, 14] },
  { mob: 'raiderArcher', x: 112, z: 236, r: 24, n: 5, lvl: [13, 14] },
  { mob: 'chief', x: 118, z: 244, r: 2, n: 1 },
  // ---- Sandsunk Vault (13-15)
  ds('vault', 'looter', 56, 78, 8, 3), ds('vault', 'guardian', 56, 64, 2, 1),
  ds('vault', 'crawler', 27, 66, 9, 3, { lvl: [13, 14] }), ds('vault', 'looter', 85, 66, 9, 4),
  ds('vault', 'guardian', 56, 51, 10, 3), ds('vault', 'guardian', 26, 28, 7, 2), ds('vault', 'keeper', 26, 22, 1, 1),
  ds('vault', 'looter', 54, 24, 6, 3), ds('vault', 'rask', 54, 16, 1, 1),
  ds('vault', 'colossus', 88, 17, 1, 1),
  // ---- Rustwood and the Old Sawmill (15-17)
  { mob: 'sawyer', x: -205, z: -62, r: 15, n: 7 },
  { mob: 'sawyer', x: -160, z: -92, r: 16, n: 5 },
  { mob: 'sawyer', x: -192, z: -112, r: 12, n: 4 },
  { mob: 'scavenger', x: -170, z: -46, r: 13, n: 5 },
  { mob: 'scavenger', x: -214, z: -74, r: 9, n: 3 },
  // ---- Northwatch Keep (17-19)
  { mob: 'scavenger', x: 6, z: -204, r: 13, n: 6, lvl: [17, 18] },
  { mob: 'sentinel', x: 14, z: -214, r: 8, n: 3, lvl: [18, 18] },
  { mob: 'nwarden', x: 2, z: -216, r: 2, n: 1 },
  // ---- the Old Foundry (16-19)
  { mob: 'sentinel', x: -150, z: -150, r: 28, n: 8 },
  { mob: 'furnace', x: -138, z: -130, r: 16, n: 5 },
  { mob: 'furnace', x: -158, z: -158, r: 8, n: 3 }, // kept back from the Coilway camp
  { mob: 'foreman', x: -158, z: -140, r: 2, n: 1 },
  // ---- the Foundry Depths (18-20)
  ds('depths', 'sentinel', 62, 74, 13, 4, { lvl: [18, 19] }), ds('depths', 'furnace', 62, 70, 10, 2, { lvl: [18, 19] }),
  ds('depths', 'furnace', 16, 62, 8, 3, { lvl: [18, 19] }), ds('depths', 'sentinel', 108, 62, 8, 3, { lvl: [18, 19] }),
  ds('depths', 'sentinel', 62, 50, 5, 2, { lvl: [19, 19] }),
  ds('depths', 'furnace', 31, 26, 10, 3, { lvl: [19, 19] }), ds('depths', 'sentinel', 28, 30, 6, 2, { lvl: [19, 19] }),
  ds('depths', 'sentinel', 93, 28, 9, 3, { lvl: [19, 19] }), ds('depths', 'overseer', 93, 22, 1, 1),
  ds('depths', 'forgemaster', 62, 13, 1, 1),
];

// supply caravans between the hubs: a Caravan Master at each stop carries you to any stop you have visited
export const CARAVANS = [
  { id: 'village', name: 'Sunmere Village', x: 9.5, z: 52, zone: 'village' },
  { id: 'brightfield', name: 'Brightfield Farms', x: 90, z: 8, zone: 'fields' },
  { id: 'westfold', name: 'Westfold Farmsteads', x: -176, z: 24, zone: 'westfold' },
  { id: 'glade', name: 'Glimmer Glade', x: 120, z: -116, zone: 'glade' },
  { id: 'quarry', name: 'Ironcliff Camp', x: 163, z: -11, zone: 'quarry' },
  { id: 'dunewatch', name: 'Dunewatch Post', x: -22, z: 168, zone: 'dunewatch' },
  { id: 'brasswind', name: 'Brasswind Dig', x: 174, z: 134, zone: 'brasswind' }, // inside the dig, not on the Eastreach grass
  { id: 'foundrywatch', name: 'Foundry Watch', x: -86, z: -98, zone: 'foundrywatch' },
];

// NPCs: look = character outfit, v = variant
// companions for hire: they follow you, join your party and fight with their class's own skills
export const COMPANIONS = {
  knight: { name: 'Edmund', role: 'Sellsword', desc: 'Draws enemies onto his own shield with a shout and a hard blade.' },
  warden: { name: 'Gunnar', role: 'Shieldwarden', desc: 'A wall of iron that keeps the machines off you.' },
  ranger: { name: 'Fenwick', role: 'Hired Bow', desc: 'Shoots from range and slows whatever chases you.' },
  chemist: { name: 'Ivo', role: 'Field Chemist', desc: 'Bombs and acids for crowds of enemies.' },
  sandblade: { name: 'Rashid', role: 'Sand Duelist', desc: 'Fast blades at your side.' },
  herbalist: { name: 'Yusuf', role: 'Field Medic', desc: 'Keeps you standing with salves and tonics.' },
  deadeye: { name: 'Tobin', role: 'Road Gunhand', desc: 'Twin pistols, a chalk mark on whatever you fight, and smoke when it closes in.' },
};
export const companionCost = (level) => 40 * level; // copper
// the Homestead south of Sunmere: furnishings bought from Carpenter Idwal (cosmetic, kept per character). Trophies stand there by
// themselves once earned: the Provost's gavel, the Guildmaster's compass, the last core, and a plaque for each raid you have cleared.
export const HOME_TROPHIES = [
  ['trophy_gavel', 'The Provost’s Gavel', { done: 'm_c12_end' }], ['trophy_compass', 'The Guildmaster’s Compass', { done: 'm_c15_end' }],
  ['trophy_core', 'The Last Core', { done: 'm_c18_end' }], ['trophy_drum', 'The Assembler’s Order Drum', { done: 'm_c21_end' }],
  ['plaque_council', 'Council Hall plaque', { ach: 'rProv' }], ['plaque_docks', 'Dry Docks plaque', { ach: 'rGuild' }], ['plaque_kiln', 'Kiln Heart plaque', { ach: 'rGlass' }], ['plaque_line', 'Assembly Line plaque', { ach: 'rAsm' }], ['plaque_makers', 'Makers\u2019 Hall plaque', { ach: 'rPattern' }], ['trophy_pattern', 'The Master Pattern\u2019s Drawing', { done: 'm_c25_end' }],
  ['plaque_hcouncil', 'Gilded Council Hall plaque (Heroic)', { ach: 'rhProv' }], ['plaque_hdocks', 'Gilded Dry Docks plaque (Heroic)', { ach: 'rhGuild' }], ['plaque_hkiln', 'Gilded Kiln Heart plaque (Heroic)', { ach: 'rhGlass' }], ['plaque_hline', 'Gilded Assembly Line plaque (Heroic)', { ach: 'rhAsm' }],
  ['plaque_hmakers', 'Gilded Makers\u2019 Hall plaque (Heroic)', { ach: 'rhPattern' }],
];
// spots round the yard a single-piece furnishing can be moved to (offsets from the plot centre -32,90, and a turn)
export const HOME_SPOTS = [[-2, 6, Math.PI], [6, -7, 0], [-2, -8.5, 0], [1, 3, 0], [-6, 7.5, 0], [7, 3, Math.PI / 2], [3, 8, Math.PI], [-6, -8.5, Math.PI / 2]];
export const HOME_MOVABLE = ['home_bench', 'home_well', 'home_rack', 'home_firepit', 'home_runabout', 'home_makerlamp'];
export const HOME_DECO = {
  home_bench: { name: 'Oak Bench', price: 2000, desc: 'A long bench by the cottage door.' },
  home_lanterns: { name: 'Lantern Posts', price: 3000, desc: 'Four lantern posts round the yard, lit at dusk.' },
  home_garden: { name: 'Herb Garden', price: 4000, desc: 'Raised beds of lavender and sage.' },
  home_well: { name: 'Stone Well', price: 6000, desc: 'A well of your own, with a bucket that does not leak.' },
  home_rack: { name: 'Weapon Rack', price: 5000, desc: 'For the blades you no longer carry.' },
  home_firepit: { name: 'Fire Pit', price: 3500, desc: 'A ring of stones and a crackling fire for cold nights.' },
  home_runabout: { name: 'Runabout Shed', price: 8000, desc: 'A timber lean-to for your runabout.' },
  home_banner: { name: 'Watch Banners', price: 4500, desc: 'Two Sunmere Watch banners at the gate.' },
  // a standard for each faction that honours you (Honored or better), in its colours
  std_sunmere: { name: 'Sunmere Watch Standard', price: 3000, desc: 'Blue and gold. Built once the Sunmere Watch honours you.', need: { rep: 'sunmere', rank: 2 }, color: '#3a5a9a' },
  std_dunewatch: { name: 'Dunewatch Standard', price: 3000, desc: 'Sand and teal. Built once Dunewatch honours you.', need: { rep: 'dunewatch', rank: 2 }, color: '#d8b47a' },
  std_foundry: { name: 'Foundry Watch Standard', price: 3000, desc: 'Rust and black. Built once the Foundry Watch honours you.', need: { rep: 'foundry', rank: 2 }, color: '#8a3a22' },
  std_highreach: { name: 'Highreach Wardens Standard', price: 4000, desc: 'Storm slate. Built once the Wardens honour you.', need: { rep: 'highreach', rank: 2 }, color: '#4e5c70' },
  std_harrowmouth: { name: 'Harrowmouth Standard', price: 5000, desc: 'Harbour teal. Built once Harrowmouth honours you.', need: { rep: 'harrowmouth', rank: 2 }, color: '#2e7a7a' },
  std_saltpan: { name: 'Saltpan Miners Standard', price: 5000, desc: 'Salt white. Built once the miners honour you.', need: { rep: 'saltpan', rank: 2 }, color: '#ece6d6' },
};
// the group finder: the Muster-Sergeant fills your party to five with volunteers by role and takes you to the dungeon door.
// Volunteers stay for that dungeon only (they head home once you leave it). Tanks first, then a healer, then damage.
export const MUSTER = {
  roles: { knight: 'tank', warden: 'tank', herbalist: 'healer', ranger: 'damage', chemist: 'damage', sandblade: 'damage', deadeye: 'damage' },
  volunteers: { warden: 'Bertram', knight: 'Aldous', herbalist: 'Hamza', ranger: 'Corwin', chemist: 'Dashiell', sandblade: 'Khalid', deadeye: 'Garrett' },
  fill: ['warden', 'herbalist', 'ranger', 'deadeye', 'sandblade', 'chemist', 'knight'],
  cost: (level) => 20 * level, // copper, the volunteers' road money
};

// emotes (/wave etc.): verb shown in chat; sit lasts until you move
export const EMOTES = { wave: 'waves', cheer: 'cheers', point: 'points', salute: 'salutes', clap: 'claps', laugh: 'laughs', shrug: 'shrugs', nod: 'nods', sit: 'sits down' };

// reputation with the three watches that hold the valley: earned from quests, kills in their lands and defended hubs
export const FACTIONS = {
  sunmere: { name: 'Sunmere Watch', color: '#5a8ae8', zones: ['village', 'meadows', 'fields', 'briarhold', 'greenwood', 'westfold', 'glade', 'quarry', 'eastreach', 'warrens', 'deepmine'], qm: 'n_marshal' },
  dunewatch: { name: 'Dunewatch', color: '#e0a040', zones: ['dunewatch', 'sunscar', 'brasswind', 'vaultruins', 'raidercamp', 'vault'], qm: 'n_sutler' },
  foundry: { name: 'Foundry Watch', color: '#c86a4a', zones: ['foundrywatch', 'rustwood', 'sawmill', 'foundry', 'northwatch', 'depths'], qm: 'n_brom' },
};
export const REP_RANKS = [{ name: 'Neutral', at: 0 }, { name: 'Friendly', at: 1000 }, { name: 'Honored', at: 3000 }, { name: 'Revered', at: 6000 }, { name: 'Exalted', at: 10000 }];
export const REP_CAP = 12000;
export const repRank = (v = 0) => { let r = 0; for (let i = 0; i < REP_RANKS.length; i++) if (v >= REP_RANKS[i].at) r = i; return r; };
export const factionOfZone = (zid) => Object.keys(FACTIONS).find((f) => FACTIONS[f].zones.includes(zid)) || 'sunmere';
// quartermaster stores: rank needed, price in copper
export const REP_SHOP = {
  sunmere: [{ item: 'rep_s1', rank: 1, price: 900 }, { item: 'rep_s2', rank: 2, price: 1600 }, { item: 'rep_s3', rank: 3, price: 2600 }, { item: 'rep_s4', rank: 4, price: 4000 }],
  dunewatch: [{ item: 'rep_d1', rank: 1, price: 2400 }, { item: 'rep_d2', rank: 2, price: 3600 }, { item: 'rep_d3', rank: 3, price: 5200 }, { item: 'rep_d4', rank: 4, price: 7000 }],
  foundry: [{ item: 'rep_f1', rank: 1, price: 4200 }, { item: 'rep_f2', rank: 2, price: 6000 }, { item: 'rep_f3', rank: 3, price: 8400 }, { item: 'rep_f4', rank: 4, price: 11000 }],
};

// the Brass Runabout: a clockwork steam cart, sold by the gearwright at the Sunmere gate from level 10
export const RUNABOUT = { cost: 5000, level: 10, speed: 1.65, mk2: { cost: 25000, level: 20, speed: 2.0 }, mk3: { speed: 2.3 } }; // Mk III: the Explorers' Guild's drive kit (Exalted)
// the Deepway Crawler (Explorers' Guild deed, Revered) is a style choice: it always runs at the Mk II's speed
export const mountKind = (q) => (q?.crawler && (q.mountKind === 'crawler' || !q.runabout) ? 'crawler' : 'runabout');
export const mountSpeed = (q) => (mountKind(q) === 'crawler' ? RUNABOUT.mk2.speed : q?.runaboutMk >= 3 ? RUNABOUT.mk3.speed : q?.runaboutMk === 2 ? RUNABOUT.mk2.speed : RUNABOUT.speed);

// other adventurers of the valley: they hunt in the zones that suit their level, rest, fall, run back and talk in chat
export const WANDERERS = [
  { name: 'Kellan', cls: 'knight', lvl: 3 }, { name: 'Osric', cls: 'herbalist', lvl: 4 }, { name: 'Jarek', cls: 'ranger', lvl: 6 },
  { name: 'Dario', cls: 'sandblade', lvl: 7 }, { name: 'Marek', cls: 'warden', lvl: 9 }, { name: 'Halvard', cls: 'chemist', lvl: 10 },
  { name: 'Faris', cls: 'sandblade', lvl: 11 }, { name: 'Karim', cls: 'ranger', lvl: 13 }, { name: 'Lucan', cls: 'knight', lvl: 14 },
  { name: 'Stellan', cls: 'chemist', lvl: 16 }, { name: 'Viggo', cls: 'warden', lvl: 17 }, { name: 'Anwar', cls: 'herbalist', lvl: 19 },
];
// wanderers out on the islands talk about where they are, not the valley
export const WANDERER_LINES_AREA = {
  reach: ['Anyone heading up the Slag Terraces? The haulers there hit hard.', 'The ash gets into everything out here.', 'Need a group for the Old Works.', 'Edric at the landing mends boots as well as boats, and buys what you carry.', 'Watch your footing on the slag.'],
  rime: ['Cold enough to freeze a kettle on the fire.', 'Need two more for the Sluice Galleries.', 'Yusuf at the landing buys and mends, if your gear is worn.', 'The Spillway Engine just ground past the dam again.', 'Anyone seen the Snowbound Plough today?'],
  heights: ['The wind up here never stops.', 'Looking for a group for the Pump Works.', 'Fadil in the camp will buy your scrap and mend your gear.', 'Three boards to a wind engine, and every one of them turning.', 'Stay off the Engine Rows ridges in a gale.'],
};
export const WANDERER_LINES = [
  'Anyone up for the Briar Warrens? We need a healer.', 'Looking for a group for Ironcliff Deepmine, I can hold the front.',
  'Where do the rare machines turn up?', 'Just saw Old Rattletrap rolling along the mill road!', 'Selling copper ore, cheap. Find me in Sunmere.',
  'Is the caravan to Dunewatch worth the fare?', 'Those Dustcloak raiders hit hard.', 'Watch the Stonegrinder, it slams the whole floor.',
  'Anyone know where the glade herbs grow?', 'A storm is rolling over the Sunscar again.', 'Need two more for the Sandsunk Vault.',
  'The companions from Captain Leof are worth every copper.', 'Stay safe out there.', 'Foundry Watch needs defenders, the engines are moving!',
  'How do I get to Northwatch Keep from here?', 'Stay out of the circles when the Thresher spins up.', 'Anyone selling a better shield?',
  'Lost my way in Rustwood again.', 'The mill wheel in Sunmere is a fine sight at sunset.', 'Gearlings everywhere in Brightfield today.',
  'Spent all my talent points in one path. No regrets.', 'Who keeps leaving tonics at the fountain?', 'The night lamps in Sunmere are a welcome sight.',
  'Heading back to town to repair. Anyone need anything?', 'That Forgemaster is no joke. Bring a healer.',
];

export const NPCS = [
  { id: 'n_gearwright', name: 'Gearwright Ottmar', title: 'Runabouts', look: 'villager', v: 0, x: -11, z: 49.5, ry: 0.4, mounts: true, greet: 'Steam, springs and a good brass boiler. Faster than any cart in the valley, and it never tires.' },
  { id: 'n_store', name: 'Storekeeper Wynn', title: 'Storehouse', look: 'villager', v: 2, x: 30, z: -20.6, ry: 0.45, house: 'sv_c8', spot: 0, store: true, greet: 'Thirty shelves, all yours. Whatever you leave here is here when you come back, untouched.' },
  { id: 'n_merc', name: 'Captain Leof', title: 'Companions for Hire', look: 'knight', x: -15.4, z: 2.9, ry: 0.9, merc: true, greet: 'Nobody should walk the valley roads alone. My people fight for a fair wage, and they follow you anywhere.' },
  { id: 'n_cv_village', name: 'Caravan Master Oren', title: 'Caravans', look: 'villager', v: 1, x: 11.1, z: 52, ry: -1.57, caravan: 'village' },
  { id: 'n_cv_brightfield', name: 'Caravan Master Pell', title: 'Caravans', look: 'villager', v: 0, x: 91.6, z: 8, ry: 2.4, caravan: 'brightfield' },
  { id: 'n_cv_westfold', name: 'Caravan Master Bram', title: 'Caravans', look: 'villager', v: 2, x: -174.4, z: 24, ry: 0.9, caravan: 'westfold' },
  { id: 'n_cv_glade', name: 'Caravan Master Sefu', title: 'Caravans', look: 'villager', v: 1, x: 121.6, z: -116, ry: -0.8, caravan: 'glade' },
  { id: 'n_cv_quarry', name: 'Caravan Master Garth', title: 'Caravans', look: 'villager', v: 0, x: 164.6, z: -11, ry: 1.6, caravan: 'quarry' },
  { id: 'n_cv_dunewatch', name: 'Caravan Master Hamid', title: 'Caravans', look: 'villager', v: 1, x: -20.4, z: 168, ry: -2.2, caravan: 'dunewatch' },
  { id: 'n_cv_brasswind', name: 'Caravan Master Nuri', title: 'Caravans', look: 'villager', v: 2, x: 175.6, z: 134, ry: 0.6, caravan: 'brasswind' },
  { id: 'n_cv_foundrywatch', name: 'Caravan Master Taro', title: 'Caravans', look: 'villager', v: 0, x: -84.4, z: -98, ry: 2.8, caravan: 'foundrywatch' },
  // Sunmere Village
  { id: 'n_marshal', name: 'Marshal Aldric', title: 'Captain of the Guard', look: 'knight', x: 1.6, z: -33.4, ry: 0, quests: ['q_gears', 'q_briar', 'q_garrick', 'q_quarry_road', 'q_road', 'q_foundry_road', 'q_forgemaster'], greet: 'Sunmere stands because people like you keep the roads open.' },
  { id: 'n_smith', name: 'Brannoc Hale', title: 'Blacksmith', look: 'warden', x: -39.2, z: -3.6, ry: 0.3, quests: ['q_cogs'], vendor: 'smith', greet: 'Brass, iron, a little patience. That is all a good blade needs.' },
  { id: 'n_merchant', name: 'Idris Vane', title: 'Traveling Merchant', look: 'villager', v: 1, x: 9.4, z: 16.4, ry: -1.57, vendor: 'general', greet: 'Tonics from the coast, bread from the mill. Fair prices, mostly.' },
  { id: 'n_ranger', name: 'Corwin Ashleaf', title: 'Ranger of the Lodge', look: 'ranger', x: -45.5, z: -34.5, ry: 1.73, house: 'sv_lodge', spot: 0, quests: ['q_bowmen', 'q_caches', 'q_hollis', 'q_glade'], greet: 'Walk soft in the Greenwood. Half of what moves in there is not a tree.' },
  { id: 'n_miller', name: 'Miller Joss', title: 'Sunmere Mill', look: 'villager', v: 0, x: -53.2, z: 17.4, ry: -2.2, quests: ['q_flour'], vendor: 'baker', greet: 'Mind the wheel. It has taken a sleeve or two in its time.' },
  { id: 'n_villager2', name: 'Old Tobin', title: '', look: 'villager', v: 2, x: -8.6, z: 6.4, ry: -0.9, greet: 'When I was a boy, the only machines here were the mill and the fountain.' },
  // indoors (house + spot: shared/houses.js; the x/z is the same spot, kept as the fallback and for the map)
  { id: 'n_baker', name: 'Baker Hamid', title: 'Sunmere Bakery', look: 'villager', v: 1, x: 21.3, z: 42.7, ry: 1.27, house: 'sv_c5', spot: 0, vendor: 'baker', greet: 'The oven was lit before the sun was up. Take a loaf while the crust still crackles.' },
  { id: 'n_weaver', name: 'Weaver Tomas', title: 'The Weaving Shop', look: 'villager', v: 0, x: -30.1, z: 42.4, ry: -1.17, house: 'sv_c2', spot: 0, greet: 'Warp first, then weft, then patience. A good bolt of cloth outlasts the man who wove it.' },
  { id: 'n_clerk', name: 'Clerk Aldous', title: 'Village Records', look: 'villager', v: 2, x: -29.7, z: -62, ry: 0.06, house: 'sv_c9', spot: 0, greet: 'Every cart, every sack and every debt in Sunmere passes over this desk. Mind the ink; it is still wet.' },
  // Brightfield Farms
  { id: 'n_villager1', name: 'Farmer Gil', title: 'Brightfield Farms', look: 'villager', v: 0, x: 85.9, z: -7.6, ry: -0.03, house: 'bf_farm', spot: 0, quests: ['q_scrap', 'q_tillers', 'q_thresher', 'q_westfold'], greet: 'Every morning I count the rows. Every morning there are fewer.' },
  { id: 'n_hadley', name: 'Old Hadley', title: 'Westfold', look: 'villager', v: 2, x: -185.3, z: 20.7, ry: 0.45, house: 'wf_farm', spot: 0, quests: ['q_harvesters', 'q_tools'], vendor: 'general', greet: 'Westfold was good land. It will be again, if the engines let it.' },
  // Glimmer Glade
  { id: 'n_herbalist', name: 'Elder Moss', title: 'Herbalist', look: 'herbalist', x: 128, z: -128, ry: -0.6, quests: ['q_glowcaps', 'q_rust', 'q_poachers'], vendor: 'general', greet: 'Breathe in. Tread lightly here and the glade will keep you in salve and stew.' },
  // Ironcliff Quarry
  { id: 'n_quarry', name: 'Quartermaster Holt', title: 'Ironcliff Camp', look: 'warden', x: 171.5, z: -29.5, ry: 1.2, quests: ['q_quarry1', 'q_deepmine', 'q_kegs', 'q_dregg', 'q_quarry3'], greet: 'Ironcliff stone built half the valley. We mean to cut more of it.' },
  { id: 'n_mason', name: 'Mason Brik', title: 'Stonecutter', look: 'villager', v: 0, x: 175, z: -22.5, ry: 2.4, quests: ['q_quarry2', 'q_grandbore'], vendor: 'general', greet: 'Stone does not lie. Machines do, apparently.' },
  // Dunewatch Post and the Sunscar
  { id: 'n_captain', name: 'Captain Tariq', title: 'Dunewatch Post', look: 'sandblade', x: -36, z: 166, ry: 2.6, quests: ['q_crawlers', 'q_raiders', 'q_dig', 'q_vault_road', 'q_chief'], greet: 'Water first, questions second. That is the rule of the Sunscar.' },
  { id: 'n_sutler', name: 'Sutler Amir', title: 'Provisions', look: 'villager', v: 1, x: -44, z: 162, ry: 2.0, vendor: 'general', greet: 'Dates, water skins, bandages. You will want all three out there.' },
  { id: 'n_surveyor', name: 'Surveyor Halim', title: 'Brasswind Dig', look: 'sandblade', x: 182, z: 140, ry: 2.4, quests: ['q_striders', 'q_lenses'], greet: 'Look at the craftsmanship on these striders. A pity they want us dead.' },
  { id: 'n_scholar', name: 'Scholar Idrees', title: 'Sandsunk Ruins', look: 'villager', v: 2, x: -132, z: 194, ry: -2.0, quests: ['q_vault1', 'q_notes', 'q_vault2', 'q_colossus'], greet: "Every column in that vault has a mason's mark. I have counted four hundred." },
  // Foundry Watch
  { id: 'n_chemist', name: 'Master Ostrum', title: 'Chemist of the Foundry', look: 'chemist', x: -104, z: -112, ry: 0.8, quests: ['q_sentinels', 'q_furnace', 'q_valves', 'q_foreman', 'q_depths'], greet: 'Keep your distance from the foundry smoke. It stays in the lungs.' },
  { id: 'n_hesk', name: 'Warden Hesk', title: 'Foundry Watch', look: 'warden', x: -98, z: -118, ry: 0.2, quests: ['q_sawyers', 'q_scavengers', 'q_beacons', 'q_northwatch'], greet: 'We hold this line, or the woods come down to the village.' },
  { id: 'n_brom', name: 'Sergeant Brom', title: 'Quartermaster', look: 'knight', x: -110, z: -104, ry: 1.6, vendor: 'general', greet: 'Steel, rations, tonics. Sign the ledger and take what you need.' },
];

// reward gear scaled to the item's level. The budget (v108 gear budget pass) follows shared/items.js rollGear: the same
// per-slot split, armour by its weight (plate armour-heavy, cloth power-heavy), trinkets and cloaks at their own smaller
// budget, a slot size (chest and legs a little more, hands, feet and cloaks a little less, as the Dragonslayer armour),
// and haste taking 15% of the piece's worth instead of coming on top. GEAR_Q is the rarity step and GEAR_SRC the source
// step: a quest reward (or a world rare's piece) 1, a dungeon drop 1.15, a raid drop 1.35, so at each item level a quest
// reward stays below the dungeon and raid pieces of its rarity. gear() makes the piece with the quest budget and no
// weight; the GEAR BUDGET pass at the end of this file re-budgets every gear() piece once its weight (set later by the
// reward art pass and the chapter blocks) and its source (quests, dungeon and raid loot tables) are known, and lifts any
// hand-made dungeon or raid piece that came out below its tier. Report: node tools/gear_budget.mjs
const SLOT_ICON = { head: 'helm', shoulders: 'shoulders', chest: 'chest', legs: 'legs', feet: 'boots', hands: 'gloves', weapon: 'sword', offhand: 'flask', trinket: 'charm', back: 'cloak' };
export const GEAR_BUDGET = {
  q: { 0: 0.6, 1: 0.9, 2: 1.15, 3: 1.45, 4: 1.75, 5: 2.0, 6: 2.2 },
  src: { quest: 1, dungeon: 1.15, raid: 1.35 },
  slot: { head: 1, shoulders: 0.92, chest: 1.08, hands: 0.88, legs: 1.04, feet: 0.88, back: 0.88, weapon: 1, offhand: 1, trinket: 1 },
  // stat split per point of budget, by kind (items.js rollGear without affixes)
  coef: { weapon: { power: 0.8, hp: 0.25 }, offhand: { power: 0.5, hp: 0.4 }, shield: { armor: 2.2, hp: 0.6 }, trinket: { power: 0.5, hp: 0.3 }, back: { armor: 1.6, hp: 0.6 },
    plate: { armor: 3.2, hp: 0.9 }, mail: { armor: 2.4, hp: 0.7, power: 0.2 }, cloth: { armor: 1.6, hp: 0.7, power: 0.3 } },
  // what a point of each stat is worth (the client's gearScore, client/ui/ui.js)
  worth: { power: 1.6, armor: 0.3, hp: 0.9, haste: 1.2, crit: 1.5, dodge: 1.3, leech: 2.5 },
  haste: 0.15,
};
export const gearKind = (it) => (['weapon', 'trinket', 'back'].includes(it.slot) ? it.slot : it.slot === 'offhand' ? (it.otype === 'shield' ? 'shield' : 'offhand') : it.weight || 'plate');
export const gearWorth = (s) => Object.entries(s || {}).reduce((t, [k, v]) => t + v * (GEAR_BUDGET.worth[k] || 0), 0);
// the worth of a plain piece of this slot and kind at budget factor 1 (B = 3 + ilvl * 1.6)
export const gearRef = (it) => (3 + (it.ilvl || 1) * 1.6) * gearWorth(GEAR_BUDGET.coef[gearKind(it)]);
// the budget factor a piece should have: rarity x source x slot size
export const gearTier = (it, src = 'quest') => (GEAR_BUDGET.q[it.q ?? 1] ?? 1) * (GEAR_BUDGET.src[src] ?? 1) * (GEAR_BUDGET.slot[it.slot] ?? 1);
function gearStats(it, haste, src) {
  const C = GEAR_BUDGET.coef[gearKind(it)], B = (3 + it.ilvl * 1.6) * gearTier(it, src), h = haste ? 1 - GEAR_BUDGET.haste : 1;
  const stats = {};
  for (const [k, c] of Object.entries(C)) stats[k] = Math.max(1, Math.round(B * c * h));
  if (haste) stats.haste = Math.max(1, Math.round(B * gearWorth(C) * GEAR_BUDGET.haste / GEAR_BUDGET.worth.haste));
  return stats;
}
const GEAR_MADE = new WeakMap(); // stats object -> { haste } for every gear() piece (copies made with { ...gear() } share it)
function gear(name, slot, q, lvl, haste = false) {
  const it = { name, slot, icon: SLOT_ICON[slot], q, ilvl: lvl };
  it.stats = gearStats(it, haste, 'quest');
  GEAR_MADE.set(it.stats, { haste });
  return it;
}

export const QUESTS = {
  // ---------------------------------------------------------------- 1-5
  q_gears: { name: 'Trouble in Brightfield', giver: 'n_marshal', turnin: 'n_marshal', lvl: 1, text: 'Gears and springs are chewing through the Brightfield crops. Some old machine from the foundry must have broken loose and multiplied. Clear the meadows and fields east of the village.', goal: { kill: 'gearling', n: 8 }, xp: 380, gold: 25, rewards: ['r_band', 'r_boots'] },
  q_cogs: { name: 'Spare Parts', giver: 'n_smith', turnin: 'n_smith', lvl: 1, text: 'Those gearlings are full of good brass. Bring me cogs from their wreckage and I will forge you something worth carrying.', goal: { item: 'cog', n: 6 }, xp: 320, gold: 20, rewards: ['r_smithblade'] },
  q_scrap: { name: 'Rollers in the Rows', giver: 'n_villager1', turnin: 'n_villager1', lvl: 2, text: 'Scrap rollers come down the east road at night and flatten the young wheat. Break the ones east of the barn and I can sow again.', goal: { kill: 'scrapper', n: 6 }, xp: 480, gold: 25, rewards: ['r_farmgloves', 'r_farmcloak'] },
  q_tillers: { name: 'The Runaway Tillers', giver: 'n_villager1', turnin: 'n_villager1', lvl: 3, text: 'We bought three tilling engines from the foundry, years back. Now there are more of them, and they plough anything in their way, people included. Stop them in the fields.', goal: { kill: 'tiller', n: 6 }, xp: 640, gold: 30, rewards: ['r_furrowlegs', 'r_tinespear'], pre: 'q_scrap' },
  q_flour: { name: 'Stolen Sacks', giver: 'n_miller', turnin: 'n_miller', lvl: 3, text: 'The Briar bandits held up my cart on the west road and took a week of flour. They camp at Briarhold, past the spring. Bring my sacks back and the village eats.', goal: { item: 'flour', n: 5 }, xp: 700, gold: 35, rewards: ['r_millcharm', 'r_millbelt'] },
  q_briar: { name: 'Bandits of Briarhold', giver: 'n_marshal', turnin: 'n_marshal', lvl: 3, text: 'A band of cutthroats has dug in at Briarhold, west of the spring, and they rob anyone on the road. Go west and thin them out before they grow bold enough to come here.', goal: { kill: 'bandit', n: 8 }, xp: 820, gold: 40, rewards: ['r_briarjerkin', 'r_briarmantle'] },
  q_bowmen: { name: 'Bows in the Briar', giver: 'n_ranger', turnin: 'n_ranger', lvl: 4, text: 'Their bowmen shoot from the brush along the Greenwood edge and from the walls of Briarhold. A ranger does not let that stand. Find them and put them down.', goal: { kill: 'banditArcher', n: 6 }, xp: 860, gold: 40, rewards: ['r_lodgecloak', 'r_lodgeboots'] },
  q_caches: { name: 'Empty Larders', giver: 'n_ranger', turnin: 'n_ranger', lvl: 4, text: 'An army that cannot eat cannot raid. Briarhold keeps its stolen stores in crates about the yard. Get inside the palisade and smash them open.', goal: { use: 'cache', n: 3 }, xp: 820, gold: 40, rewards: ['r_cachegloves', 'r_cachecharm'] },
  q_hollis: { name: 'The Briar Warrens', giver: 'n_ranger', turnin: 'n_ranger', lvl: 5, text: 'Briarhold is only the roof. Under it the bandits dug tunnels where they hide what they steal, behind the back gate. A fence called Hollis sells it on. Go down and stop him.', goal: { kill: 'hollis', n: 1 }, xp: 1300, gold: 70, rewards: ['r_hollisknife', 'r_hollishood'], pre: 'q_briar' },
  q_thresher: { name: 'The Stolen Thresher', giver: 'n_villager1', turnin: 'n_villager1', lvl: 5, text: 'They stole my threshing engine and dragged it into their warrens under Briarhold. I hear they have rigged it to fight. If it cannot be brought home, break it.', goal: { kill: 'thresher', n: 1 }, xp: 1600, gold: 90, rewards: ['r_thresherheart', 'r_thresherplate'], pre: 'q_tillers' },
  q_garrick: { name: 'Garrick Briar', giver: 'n_marshal', turnin: 'n_marshal', lvl: 5, text: 'Their leader is Garrick Briar, a deserter from the old guard. He holds the back of the hideout. Without him the rest will scatter. Bring a friend if you can.', goal: { kill: 'banditBoss', n: 1 }, xp: 1400, gold: 80, rewards: ['r_hookblade', 'r_briarhelm'], pre: 'q_briar' },
  // ---------------------------------------------------------------- 5-10
  q_westfold: { name: 'Word from Westfold', giver: 'n_villager1', turnin: 'n_hadley', lvl: 6, text: 'My cousin Hadley farms out at Westfold, past Briarhold. He bought the big harvesting engines the year the tillers came. I have heard nothing since. Will you go and see?', goal: { reach: 'westfold' }, xp: 650, gold: 20, rewards: [], pre: 'q_tillers' },
  q_harvesters: { name: 'Harvest of Rust', giver: 'n_hadley', turnin: 'n_hadley', lvl: 7, text: 'The harvesters cut the wheat, then the fences, then my barn door. They will not stop until something stops them. Break them in the fields.', goal: { kill: 'harvester', n: 8 }, xp: 1400, gold: 55, rewards: ['r_westfoldboots', 'r_westfoldcloak'] },
  q_tools: { name: 'Hadley\'s Tools', giver: 'n_hadley', turnin: 'n_hadley', lvl: 7, text: 'The engines drag my tools about in their hoppers. Shovels, scythes, the good saw. Pull them out of the wrecks and I can mend the fences myself.', goal: { item: 'farmtools', n: 5 }, xp: 1350, gold: 50, rewards: ['r_hadleyblade', 'r_hadleycharm'] },
  q_glade: { name: 'The Glimmer Glade', giver: 'n_ranger', turnin: 'n_herbalist', lvl: 5, text: 'Elder Moss tends the glade to the north-east, past the lake and the falls. He asked for a capable hand. Follow the road and find him.', goal: { reach: 'glade' }, xp: 600, gold: 15, rewards: [] },
  q_glowcaps: { name: 'Mosscap Harvest', giver: 'n_herbalist', turnin: 'n_herbalist', lvl: 5, text: 'The mosscap mushrooms under the silverbark trees make the finest salve in the valley. Gather them for me, and mind the rusted engines.', goal: { gather: 'glowcap', n: 6 }, xp: 950, gold: 40, rewards: ['r_charm', 'r_gloves'], pre: 'q_glade' },
  q_rust: { name: 'Rust in the Glade', giver: 'n_herbalist', turnin: 'n_herbalist', lvl: 6, text: 'Old warden-engines have wandered into the glade and trample everything. Put them down.', goal: { kill: 'rustguard', n: 6 }, xp: 1150, gold: 45, rewards: ['r_helm', 'r_cloak'], pre: 'q_glade' },
  q_poachers: { name: 'Poachers\' Camp', giver: 'n_herbalist', turnin: 'n_herbalist', lvl: 7, text: 'Men from outside the valley camp on the east side of the glade. They strip the silverbark and set fire to the undergrowth. Drive them off, and watch the road to the quarry.', goal: { kill: 'poacher', n: 8 }, xp: 1350, gold: 55, rewards: ['r_poacherlegs', 'r_mossbracers'], pre: 'q_rust' },
  q_quarry_road: { name: 'Word from Ironcliff', giver: 'n_marshal', turnin: 'n_quarry', lvl: 6, text: 'The stonecutters at Ironcliff Quarry, east past Brightfield, have sent no carts for a week. Their quartermaster asked for help. Follow the farm road east and find Holt at the camp.', goal: { reach: 'quarry' }, xp: 700, gold: 25, rewards: [] },
  q_quarry1: { name: 'Silence the Drills', giver: 'n_quarry', turnin: 'n_quarry', lvl: 7, text: 'The drilling engines kept working after the crews left, and now they bore into anything that moves. Shut down the drillers on the terraces so my people can get back to the ledges.', goal: { kill: 'driller', n: 8 }, xp: 1500, gold: 55, rewards: ['r_quarrygloves', 'r_quarryboots'] },
  q_quarry2: { name: 'Gear-Cores', giver: 'n_mason', turnin: 'n_mason', lvl: 7, text: 'Every one of those machines runs on a gear-core. Pull them out of the haulers and drillers and I can fit them to our cranes. Honest work for honest stone.', goal: { item: 'gearcore', n: 6 }, xp: 1500, gold: 60, rewards: ['r_quarryhammer', 'r_quarryrod'] },
  q_deepmine: { name: 'Into the Deepmine', giver: 'n_quarry', turnin: 'n_quarry', lvl: 8, text: 'The adit on the east terrace leads down to the Deepmine. Sappers, men who blast tunnels for whoever pays, have moved in and keep the machines working. Go down and clear them out.', goal: { kill: 'sapper', n: 8 }, xp: 1900, gold: 70, rewards: ['r_sapperhood', 'r_minerlegs'], pre: 'q_quarry1' },
  q_kegs: { name: 'Live Charges', giver: 'n_quarry', turnin: 'n_quarry', lvl: 8, text: 'The sappers left blasting kegs with their fuses burning slow, all through the Deepmine. If they go, the whole quarry floor comes down. Find them and cut the fuses.', goal: { use: 'keg', n: 4 }, xp: 1900, gold: 70, rewards: ['r_fusecutter', 'r_blastboots'], pre: 'q_quarry1' },
  q_dregg: { name: 'Overseer Dregg', giver: 'n_quarry', turnin: 'n_quarry', lvl: 9, text: 'The sappers answer to a man called Dregg. He runs his camp in the north-west caverns of the Deepmine. End his overseeing.', goal: { kill: 'dregg', n: 1 }, xp: 2100, gold: 90, rewards: ['r_dreggmaul', 'r_dreggplate'], pre: 'q_deepmine' },
  q_quarry3: { name: 'The Stonegrinder', giver: 'n_quarry', turnin: 'n_quarry', lvl: 9, text: 'Down on the pit floor sits the Stonegrinder, the great crusher that fed the whole quarry. Bring friends, keep clear of its drum, and break it.', goal: { kill: 'crusher', n: 1 }, xp: 2400, gold: 120, rewards: ['r_grinderheart', 'r_quarryhelm'] },
  q_grandbore: { name: 'The Grand Bore', giver: 'n_mason', turnin: 'n_mason', lvl: 9, text: 'At the bottom of the Deepmine sits the Grand Bore, the machine that cut every tunnel down there. While it turns, the mine keeps growing under our feet. Stop it for good.', goal: { kill: 'grandbore', n: 1 }, xp: 3200, gold: 160, rewards: ['r_boreheart', 'r_borehelm'], pre: 'q_deepmine' },
  // ---------------------------------------------------------------- 10-15
  q_road: { name: 'The Desert Road', giver: 'n_marshal', turnin: 'n_captain', lvl: 9, text: 'Raiders out of the Sunscar have been ambushing our caravans. Take the south road to Dunewatch Post and report to Captain Tariq.', goal: { reach: 'dunewatch' }, xp: 1100, gold: 30, rewards: [] },
  q_crawlers: { name: 'Sand Crawlers', giver: 'n_captain', turnin: 'n_captain', lvl: 10, text: 'Drilling machines dig up the dunes and swallow whole carts. Break them apart.', goal: { kill: 'crawler', n: 8 }, xp: 2600, gold: 70, rewards: ['r_legs', 'r_dunewraps'], pre: 'q_road' },
  q_raiders: { name: 'Dustcloak Menace', giver: 'n_captain', turnin: 'n_captain', lvl: 11, text: 'The Dustcloaks raid from the ruins across the Sunscar. Thin their numbers and they will think twice before raiding again.', goal: { kill: 'raider', n: 10 }, xp: 2900, gold: 80, rewards: ['r_scimitar', 'r_chest'], pre: 'q_road' },
  q_dig: { name: 'The Brasswind Dig', giver: 'n_captain', turnin: 'n_surveyor', lvl: 11, text: 'Surveyor Halim was digging up an old engine works in the east of the Sunscar. His runner came back alone. Ride east and see what is left of his camp.', goal: { reach: 'brasswind' }, xp: 1300, gold: 30, rewards: [], pre: 'q_road' },
  q_striders: { name: 'Striders in the Dig', giver: 'n_surveyor', turnin: 'n_surveyor', lvl: 12, text: 'We woke them. Walking engines on long legs, still loyal to a works that closed a hundred years ago. They kick down everything we build. Break them.', goal: { kill: 'strider', n: 8 }, xp: 3300, gold: 90, rewards: ['r_striderboots', 'r_striderhelm'] },
  q_lenses: { name: 'Glass Eyes', giver: 'n_surveyor', turnin: 'n_surveyor', lvl: 12, text: 'Each strider sees through a ground lens finer than anything made today. Bring me their lenses and I will learn how they were cut.', goal: { item: 'lens', n: 6 }, xp: 3300, gold: 90, rewards: ['r_lenscharm', 'r_surveyorrod'] },
  q_vault_road: { name: 'The Sandsunk Ruins', giver: 'n_captain', turnin: 'n_scholar', lvl: 12, text: 'A scholar from the coast is camped at the Sandsunk Ruins in the south-west, digging for a sealed vault. The Dustcloaks have noticed. Go and keep him alive.', goal: { reach: 'vaultruins' }, xp: 1500, gold: 35, rewards: [], pre: 'q_raiders' },
  q_vault1: { name: 'Guardians of the Vault', giver: 'n_scholar', turnin: 'n_scholar', lvl: 13, text: 'The vault is open, and its guardian engines are awake. They were built to keep thieves out, and they cannot tell us from the Dustcloaks. Shut them down.', goal: { kill: 'guardian', n: 8 }, xp: 3800, gold: 100, rewards: ['r_vaultgreaves', 'r_vaultmantle'] },
  q_notes: { name: 'The Scholar\'s Notes', giver: 'n_scholar', turnin: 'n_scholar', lvl: 13, text: 'I dropped my notes when the guardians woke, four bundles of them, all over the vault. Twenty years of work. Please bring them back.', goal: { use: 'notes', n: 4 }, xp: 3800, gold: 100, rewards: ['r_scholarrod', 'r_scholarmantle'] },
  q_vault2: { name: 'The Looter-King', giver: 'n_scholar', turnin: 'n_scholar', lvl: 14, text: 'Rask, who calls himself the Looter-King, has carried half the vault into the east chamber. Take it back from him.', goal: { kill: 'rask', n: 1 }, xp: 4200, gold: 140, rewards: ['r_raskblades', 'r_raskhood'], pre: 'q_vault1' },
  q_colossus: { name: 'The Vault Colossus', giver: 'n_scholar', turnin: 'n_scholar', lvl: 14, text: 'The great guardian stands in the inner hall at the far end of the vault. My notes say it was the last thing its makers built. Bring friends.', goal: { kill: 'colossus', n: 1 }, xp: 6000, gold: 220, rewards: ['r_colossuscore', 'r_colossusplate'], pre: 'q_vault1' },
  q_chief: { name: 'Varrok\'s End', giver: 'n_captain', turnin: 'n_captain', lvl: 14, text: 'Varrok leads the Dustcloaks from the heart of their camp in the south-east. Bring friends. End him.', goal: { kill: 'chief', n: 1 }, xp: 5000, gold: 200, rewards: ['r_epicweapon', 'r_epicshoulders'], pre: 'q_raiders' },
  // ---------------------------------------------------------------- 15-20
  q_foundry_road: { name: 'Foundry Watch', giver: 'n_marshal', turnin: 'n_chemist', lvl: 14, text: 'Every one of these machines came out of the Old Foundry in the north-west. Master Ostrum keeps a watch camp on the road there. Go, and finish this at its source.', goal: { reach: 'foundrywatch' }, xp: 2200, gold: 40, rewards: [] },
  q_sawyers: { name: 'Rustwood Sawyers', giver: 'n_hesk', turnin: 'n_hesk', lvl: 15, text: 'The old sawmill west of here started its logging engines again. They cut the Rustwood to stumps and saw through our patrols. Put them down.', goal: { kill: 'sawyer', n: 8 }, xp: 5200, gold: 120, rewards: ['r_sawyergrips', 'r_rustwoodcloak'] },
  q_scavengers: { name: 'Scavengers', giver: 'n_hesk', turnin: 'n_hesk', lvl: 16, text: 'Scavengers strip anything brass from the wrecks and sell it back to the Foundry crews. Break up their camps in the Rustwood.', goal: { kill: 'scavenger', n: 8 }, xp: 5600, gold: 130, rewards: ['r_scavlegs', 'r_scavboots'] },
  q_beacons: { name: 'Light the North Road', giver: 'n_hesk', turnin: 'n_hesk', lvl: 17, text: 'Northwatch had three signal braziers on its towers. Light them again and every patrol on the north road will know the keep is ours to take back.', goal: { use: 'beacon', n: 3 }, xp: 6600, gold: 180, rewards: ['r_beaconcloak', 'r_beaconlegs'] },
  q_northwatch: { name: 'The Fall of Northwatch', giver: 'n_hesk', turnin: 'n_hesk', lvl: 18, text: 'Northwatch Keep held the north road for a hundred years. Now scavengers camp in its yard and a warden-engine from the foundry stands at its gate. Take the road north-east through the woods and bring the old keep back to silence.', goal: { kill: 'nwarden', n: 1 }, xp: 7800, gold: 230, rewards: ['r_northwatchhelm', 'r_northwatchblade'] },
  q_sentinels: { name: 'Foundry Watch', giver: 'n_chemist', turnin: 'n_chemist', lvl: 16, text: 'The foundry sentinels still patrol, but something has changed their orders. Shut them down so we can get close.', goal: { kill: 'sentinel', n: 8 }, xp: 5800, gold: 140, rewards: ['r_rod', 'r_plate'], pre: 'q_foundry_road' },
  q_furnace: { name: 'Cold Furnaces', giver: 'n_chemist', turnin: 'n_chemist', lvl: 17, text: 'The furnace engines carry their own fire. Every one we put out is a furnace that cannot be relit. Six of them, at least.', goal: { kill: 'furnace', n: 6 }, xp: 6200, gold: 150, rewards: ['r_furnacegauntlets', 'r_furnacehelm'], pre: 'q_sentinels' },
  q_valves: { name: 'Slag Valves', giver: 'n_chemist', turnin: 'n_chemist', lvl: 18, text: 'Below the foundry, slag runs through the walls in iron pipes. Close the four great valves in the Depths and their furnaces starve.', goal: { use: 'valve', n: 4 }, xp: 7800, gold: 220, rewards: ['r_valvegrips', 'r_slagboots'], pre: 'q_furnace' },
  q_foreman: { name: 'The Foreman', giver: 'n_chemist', turnin: 'n_chemist', lvl: 18, text: 'The Foreman stands in the yard and drives the others. Tear it down.', goal: { kill: 'foreman', n: 1 }, xp: 8000, gold: 260, rewards: ['r_foremanheart', 'r_foremanplate'], pre: 'q_sentinels' },
  q_depths: { name: 'Into the Depths', giver: 'n_chemist', turnin: 'n_chemist', lvl: 18, text: 'Under the foundry are the Depths, where the engines are still cast. The hatch is north of the stacks. An overseer engine runs the press room in the east. Stop it.', goal: { kill: 'overseer', n: 1 }, xp: 8000, gold: 240, rewards: ['r_overseerlegs', 'r_overseerrod'], pre: 'q_furnace' },
  q_forgemaster: { name: 'The Forgemaster', giver: 'n_marshal', turnin: 'n_marshal', lvl: 19, text: 'Ostrum sent word: at the heart of the Depths is the Forgemaster, the engine that builds all the others. Gather the bravest you know, go down, and end it. Then come home.', goal: { kill: 'forgemaster', n: 1 }, xp: 12000, gold: 500, rewards: ['r_legend1', 'r_legend2'], pre: 'q_depths' },
};

// item templates. slot: head shoulders chest legs feet hands weapon offhand trinket back | use | quest | junk
export const ITEMS = {
  cog: { name: 'Brass Cog', slot: 'quest', icon: 'gear', q: 1, stack: 20 },
  glowcap: { name: 'Mosscap', slot: 'quest', icon: 'mushroom', q: 1, stack: 20 },
  gearcore: { name: 'Gear-Core', slot: 'quest', icon: 'gear', q: 1, stack: 20 },
  flour: { name: 'Stolen Flour Sack', slot: 'quest', icon: 'cloth', q: 1, stack: 20 },
  lens: { name: 'Strider Lens', slot: 'quest', icon: 'ring', q: 1, stack: 20 },
  farmtools: { name: 'Hadley\'s Tools', slot: 'quest', icon: 'scrap', q: 1, stack: 20 },
  ironore: { name: 'Lump of Iron Ore', slot: 'junk', icon: 'scrap', q: 0, stack: 20, price: 7 },
  tonic: { name: 'Healing Tonic', slot: 'use', icon: 'potion', q: 1, stack: 20, use: { heal: 0.35 }, price: 8, desc: 'Restores 35% of your health.' },
  draught: { name: 'Focus Draught', slot: 'use', icon: 'elixir', q: 1, stack: 20, use: { res: 0.5 }, price: 8, desc: 'Restores half of your resource.' },
  bread: { name: 'Honey Bread', slot: 'use', icon: 'bread', q: 1, stack: 20, use: { heal: 0.6, food: true }, price: 4, desc: 'Sit and eat to recover 60% health.' },
  millloaf: { name: 'Miller\'s Loaf', slot: 'use', icon: 'bread', q: 1, stack: 20, use: { heal: 1.0, food: true }, price: 9, desc: 'Sit and eat to recover all your health.' },
  scrap: { name: 'Twisted Scrap', slot: 'junk', icon: 'scrap', q: 0, stack: 20, price: 3 },
  cloth: { name: 'Dusty Rag', slot: 'junk', icon: 'cloth', q: 0, stack: 20, price: 2 },
  spring: { name: 'Coiled Spring', slot: 'junk', icon: 'spring', q: 0, stack: 20, price: 6 },
  brassplate: { name: 'Dented Brass Plate', slot: 'junk', icon: 'scrap', q: 0, stack: 20, price: 14 },
  // ---- quest rewards (stats scale with the quest level)
  r_rattlecog: gear('Rattletrap\'s Mainspring', 'trinket', 3, 6, true),
  r_clatterhook: gear('Clatterhook Tine', 'weapon', 3, 10, true),
  r_sandsplitter: gear('Sandsplitter Treads', 'feet', 4, 15, true),
  r_ironbark: gear('Ironbark Saw-Plate', 'chest', 4, 19, true),
  r_band: { name: 'Brightfield Band', slot: 'trinket', icon: 'ring', q: 2, stats: { power: 4, hp: 10 } },
  r_boots: { name: 'Farmhand\'s Boots', slot: 'feet', icon: 'boots', q: 2, stats: { armor: 18, hp: 8 } },
  r_smithblade: { name: 'Hale-Forged Edge', slot: 'weapon', icon: 'sword', q: 2, stats: { power: 7 } },
  r_farmgloves: gear('Furrow-Stained Gloves', 'hands', 2, 3),
  r_farmcloak: gear('Brightfield Cloak', 'back', 2, 3, true),
  r_furrowlegs: gear('Furrow-Walker Breeches', 'legs', 2, 4),
  r_tinespear: gear('Tiller-Tine Edge', 'weapon', 2, 4),
  r_millcharm: gear('Millstone Keepsake', 'trinket', 2, 4, true),
  r_millbelt: gear('Flour-Dusted Jerkin', 'chest', 2, 4),
  r_briarjerkin: gear('Briar-Hunter Jerkin', 'chest', 3, 4),
  r_briarmantle: gear('Thornguard Mantle', 'shoulders', 3, 4),
  r_lodgecloak: gear('Lodge Ranger\'s Cloak', 'back', 3, 5, true),
  r_lodgeboots: gear('Brushwalker Boots', 'feet', 3, 5),
  r_hookblade: gear('Garrick\'s Hookblade', 'weapon', 3, 6, true),
  r_cachegloves: gear('Crate-Breaker Gloves', 'hands', 3, 5),
  r_hollisknife: gear('Fence\'s Hidden Knife', 'weapon', 3, 6, true),
  r_hollishood: gear('Hollis\' Smuggler Hood', 'head', 3, 6),
  r_thresherheart: gear('Thresher Governor', 'trinket', 4, 7, true),
  r_thresherplate: gear('Chaff-Guard Hauberk', 'chest', 4, 7),
  r_cachecharm: gear('Ranger\'s Thumb-Ring', 'trinket', 3, 5, true),
  r_briarhelm: gear('Briarhold Helm', 'head', 3, 6),
  r_westfoldboots: gear('Furrow-Stompers', 'feet', 3, 8),
  r_westfoldcloak: gear('Westfold Harvest Cloak', 'back', 3, 8, true),
  r_hadleyblade: gear('Hadley\'s Mended Scythe-Blade', 'weapon', 3, 8, true),
  r_hadleycharm: gear('Westfold Iron Ring', 'trinket', 3, 8),
  r_charm: gear('Mosscap Keepsake', 'trinket', 2, 6, true),
  r_gloves: gear('Herb-Stained Gloves', 'hands', 2, 6),
  r_helm: gear('Glade Warden Helm', 'head', 3, 7),
  r_cloak: gear('Mossweave Cloak', 'back', 2, 7, true),
  r_poacherlegs: gear('Poacher\'s Leggings', 'legs', 3, 8),
  r_mossbracers: gear('Silverbark Grips', 'hands', 3, 8, true),
  r_quarrygloves: gear('Stonecutter\'s Grips', 'hands', 3, 8),
  r_quarryboots: gear('Ledge-Walker Boots', 'feet', 3, 8),
  r_quarryhammer: gear('Ironcliff Maul', 'weapon', 3, 8),
  r_quarryrod: gear('Gear-Core Focus', 'offhand', 3, 8, true),
  r_sapperhood: gear('Sapper\'s Hood', 'head', 3, 9),
  r_minerlegs: gear('Deepmine Greaves', 'legs', 3, 9),
  r_dreggmaul: gear('Dregg\'s Rockbreaker', 'weapon', 3, 10, true),
  r_fusecutter: gear('Fuse-Cutter\'s Knife', 'weapon', 3, 9, true),
  r_blastboots: gear('Blast-Proof Boots', 'feet', 3, 9),
  r_dreggplate: gear('Overseer\'s Plate', 'chest', 3, 10),
  r_quarryhelm: gear('Quarry Warden Helm', 'head', 4, 10),
  r_grinderheart: gear('Stonegrinder Flywheel', 'trinket', 4, 10, true),
  r_boreheart: gear('Heart of the Grand Bore', 'trinket', 4, 11, true),
  r_borehelm: gear('Bore-Ward Helm', 'head', 4, 11),
  r_legs: gear('Crawler-Plate Greaves', 'legs', 3, 11),
  r_dunewraps: gear('Dune-Runner Wraps', 'feet', 3, 11, true),
  r_scimitar: gear('Dunewatch Scimitar', 'weapon', 3, 12, true),
  r_chest: gear('Sun-Bleached Hauberk', 'chest', 3, 12),
  r_striderboots: gear('Strider-Step Sabatons', 'feet', 3, 13),
  r_striderhelm: gear('Brasswind Helm', 'head', 3, 13),
  r_lenscharm: gear('Ground-Glass Locket', 'trinket', 3, 13, true),
  r_surveyorrod: gear('Surveyor\'s Sighting Rod', 'offhand', 3, 13),
  r_vaultgreaves: gear('Vault-Warden Greaves', 'legs', 3, 14),
  r_vaultmantle: gear('Sandsunk Mantle', 'shoulders', 3, 14),
  r_raskblades: gear('Looter-King\'s Blades', 'weapon', 4, 15, true),
  r_scholarrod: gear('Idrees\' Measuring Rod', 'offhand', 3, 14, true),
  r_scholarmantle: gear('Scholar\'s Dust-Mantle', 'shoulders', 3, 14),
  r_raskhood: gear('Rask\'s Hood', 'head', 4, 15),
  r_colossuscore: gear('Colossus Core', 'trinket', 4, 16, true),
  r_colossusplate: gear('Colossus-Plate Hauberk', 'chest', 4, 16),
  r_epicweapon: gear('Varrok\'s Sandreaver', 'weapon', 4, 15, true),
  r_epicshoulders: gear('Dustcloak Mantle', 'shoulders', 4, 15),
  r_sawyergrips: gear('Sawyer\'s Grips', 'hands', 3, 16),
  r_rustwoodcloak: gear('Rustwood Cloak', 'back', 3, 16, true),
  r_scavlegs: gear('Scavenger\'s Leggings', 'legs', 3, 17),
  r_scavboots: gear('Rustwood Treads', 'feet', 3, 17),
  r_rod: gear('Ostrum\'s Reactor Core', 'offhand', 3, 17, true),
  r_plate: gear('Foundry Breastplate', 'chest', 3, 17),
  r_furnacegauntlets: gear('Furnace-Tender Gauntlets', 'hands', 3, 18),
  r_furnacehelm: gear('Smelter\'s Helm', 'head', 3, 18),
  r_foremanheart: gear('Foreman\'s Governor', 'trinket', 4, 19, true),
  r_valvegrips: gear('Valve-Turner\'s Grips', 'hands', 3, 19),
  r_slagboots: gear('Slag-Walker Boots', 'feet', 3, 19, true),
  r_beaconcloak: gear('Northroad Cloak', 'back', 3, 18, true),
  r_beaconlegs: gear('Beacon-Keeper\'s Greaves', 'legs', 3, 18),
  r_foremanplate: gear('Foreman-Plate Pauldrons', 'shoulders', 4, 19),
  r_overseerlegs: gear('Overseer-Plate Greaves', 'legs', 4, 19),
  r_overseerrod: gear('Overseer\'s Regulator', 'offhand', 4, 19, true),
  r_northwatchhelm: gear('Northwatch Greathelm', 'head', 4, 19),
  r_northwatchblade: gear('Keep-Warden\'s Blade', 'weapon', 4, 19, true),
  r_legend1: gear('Heart of the Forgemaster', 'trinket', 4, 21, true),
  r_legend2: gear('Sunmere Crown-Helm', 'head', 4, 21, true),
};

// random gear names by slot
export const GEAR_NAMES = {
  head: ['Helm', 'Hood', 'Cap', 'Coif'], shoulders: ['Pauldrons', 'Mantle', 'Spaulders'], chest: ['Hauberk', 'Jerkin', 'Coat', 'Vest'],
  legs: ['Greaves', 'Leggings', 'Breeches'], feet: ['Boots', 'Treads', 'Sabatons'], hands: ['Gauntlets', 'Gloves', 'Grips'],
  weapon: ['Blade', 'Hammer', 'Bow', 'Rod', 'Staff', 'Scimitar'], offhand: ['Buckler', 'Ward', 'Flask'], trinket: ['Band', 'Keepsake', 'Locket'], back: ['Cloak', 'Cape', 'Shawl'],
};
export const GEAR_PREFIX = ['Sturdy', 'Worn', 'Polished', 'Dune-Worn', 'Brass-Bound', 'Ranger\'s', 'Foundry', 'Glade', 'Raider\'s', 'Sunmere', 'Hale-Forged', 'Gleaming', 'Briar', 'Deepmine', 'Vault-Forged', 'Rustwood'];

export const LOOT_TABLES = {
  scrap: { gold: [1, 4], items: [['scrap', 0.7], ['spring', 0.25], ['cog', 0.6], ['tonic', 0.08]], gear: 0.12 },
  harvester: { gold: [3, 8], items: [['farmtools', 0.55], ['scrap', 0.6], ['spring', 0.3], ['tonic', 0.1]], gear: 0.22 },
  bandit: { gold: [2, 7], items: [['cloth', 0.5], ['flour', 0.45], ['bread', 0.15], ['tonic', 0.1]], gear: 0.18 },
  banditBoss: { gold: [30, 50], items: [['tonic', 1], ['flour', 1]], gear: 1, gearQ: 3, gearN: 2 },
  raider: { gold: [3, 9], items: [['cloth', 0.6], ['tonic', 0.18], ['bread', 0.15]], gear: 0.2 },
  desert: { gold: [2, 6], items: [['scrap', 0.6], ['spring', 0.4], ['tonic', 0.1]], gear: 0.18 },
  striders: { gold: [3, 8], items: [['lens', 0.6], ['spring', 0.4], ['brassplate', 0.3], ['draught', 0.1]], gear: 0.24 },
  foundry: { gold: [5, 12], items: [['scrap', 0.6], ['spring', 0.4], ['brassplate', 0.3], ['draught', 0.15]], gear: 0.25 },
  rustwood: { gold: [4, 10], items: [['scrap', 0.5], ['spring', 0.35], ['brassplate', 0.25], ['tonic', 0.15]], gear: 0.26 },
  quarry: { gold: [6, 14], items: [['gearcore', 0.55], ['ironore', 0.5], ['spring', 0.3], ['draught', 0.12]], gear: 0.28 },
  deepmine: { gold: [6, 12], items: [['gearcore', 0.35], ['ironore', 0.6], ['tonic', 0.15]], gear: 0.3 },
  vault: { gold: [6, 14], items: [['brassplate', 0.4], ['cloth', 0.3], ['tonic', 0.2], ['draught', 0.15]], gear: 0.32 },
  chief: { gold: [40, 70], items: [['tonic', 1]], gear: 1, gearQ: 3, gearN: 2 },
  warrensElite: { gold: [20, 40], items: [['tonic', 1], ['flour', 1]], gear: 1, gearQ: 3, gearN: 2 },
  thresher: { gold: [50, 90], items: [['tonic', 1], ['draught', 1]], gear: 1, gearQ: 3, gearN: 3 },
  rare1: { gold: [20, 40], items: [['r_rattlecog', 1], ['tonic', 1]], gear: 1, gearQ: 3, gearN: 1 },
  rare2: { gold: [40, 70], items: [['r_clatterhook', 1], ['tonic', 1]], gear: 1, gearQ: 3, gearN: 1 },
  rare3: { gold: [60, 100], items: [['r_sandsplitter', 1], ['tonic', 1]], gear: 1, gearQ: 3, gearN: 1 },
  rare4: { gold: [80, 130], items: [['r_ironbark', 1], ['tonic', 1]], gear: 1, gearQ: 4, gearN: 1 },
  crusher: { gold: [80, 140], items: [['tonic', 1], ['draught', 1]], gear: 1, gearQ: 4, gearN: 2 },
  deepElite: { gold: [30, 60], items: [['tonic', 1]], gear: 1, gearQ: 3, gearN: 2 },
  grandbore: { gold: [120, 200], items: [['tonic', 1], ['draught', 1]], gear: 1, gearQ: 4, gearN: 3 },
  vaultElite: { gold: [50, 90], items: [['tonic', 1]], gear: 1, gearQ: 3, gearN: 2 },
  colossus: { gold: [160, 260], items: [['tonic', 1], ['draught', 1]], gear: 1, gearQ: 4, gearN: 3 },
  foreman: { gold: [140, 220], items: [['tonic', 1], ['draught', 1]], gear: 1, gearQ: 4, gearN: 3 },
  depthsElite: { gold: [80, 130], items: [['tonic', 1]], gear: 1, gearQ: 4, gearN: 2 },
  forgemaster: { gold: [250, 400], items: [['tonic', 1], ['draught', 1]], gear: 1, gearQ: 4, gearN: 4 },
};

// watch quartermaster gear
Object.assign(ITEMS, {
  rep_s1: { name: 'Sunmere Watch Cloak', slot: 'back', icon: 'back', q: 3, stats: { armor: 40, hp: 14, haste: 3 }, ilvl: 8, desc: 'Blue wool with the gold disc of the Watch.' },
  rep_s2: { name: 'Gatewarden Gauntlets', slot: 'hands', icon: 'hands', q: 3, stats: { armor: 52, hp: 18, power: 4 }, ilvl: 10 },
  rep_s3: { name: 'Marshal\u2019s Signet', slot: 'trinket', icon: 'charm', q: 3, stats: { power: 22, hp: 10, haste: 4 }, ilvl: 11 },
  rep_s4: { name: 'Blade of the Sunmere Watch', slot: 'weapon', icon: 'sword', q: 4, stats: { power: 46, haste: 6 }, ilvl: 13 },
  rep_d1: { name: 'Dunewatch Wrap', slot: 'back', icon: 'back', q: 3, stats: { armor: 62, hp: 22, haste: 4 }, ilvl: 13 },
  rep_d2: { name: 'Sandstrider Boots', slot: 'feet', icon: 'feet', q: 3, stats: { armor: 78, hp: 26, haste: 5 }, ilvl: 14 },
  rep_d3: { name: 'Sunscar Compass', slot: 'trinket', icon: 'charm', q: 3, stats: { power: 34, hp: 14, haste: 6 }, ilvl: 15 },
  rep_d4: { name: 'Dunewatch Saber', slot: 'weapon', icon: 'sword', q: 4, stats: { power: 66, haste: 8 }, ilvl: 17 },
  rep_f1: { name: 'Foundry Watch Mantle', slot: 'shoulders', icon: 'shoulders', q: 3, stats: { armor: 92, hp: 30, power: 6 }, ilvl: 18 },
  rep_f2: { name: 'Slagproof Girdle', slot: 'legs', icon: 'legs', q: 3, stats: { armor: 104, hp: 36, haste: 6 }, ilvl: 19 },
  rep_f3: { name: 'Pressure Gauge Keepsake', slot: 'trinket', icon: 'charm', q: 4, stats: { power: 48, hp: 20, haste: 8 }, ilvl: 20 },
  rep_f4: { name: 'Warden-Engine Breaker', slot: 'weapon', icon: 'sword', q: 4, stats: { power: 88, haste: 10 }, ilvl: 21 },
});

// dungeon gear sets: wear 2 or 4 pieces of one set for its bonuses
export const SETS = {
  warrens: { name: 'Briarwood Kit', pieces: ['set_warrens1', 'set_warrens2', 'set_warrens3', 'set_warrens4', 'set_warrens5'], bonus: { 2: [['hp', 0.05]], 4: [['dmg', 0.04], ['regen', 0.08]] } },
  deepmine: { name: 'Deepdelver Gear', pieces: ['set_deepmine1', 'set_deepmine2', 'set_deepmine3', 'set_deepmine4', 'set_deepmine5'], bonus: { 2: [['armor', 0.04]], 4: [['crit', 0.05], ['dmg', 0.03]] } },
  vault: { name: 'Vaultguard Plate', pieces: ['set_vault1', 'set_vault2', 'set_vault3', 'set_vault4', 'set_vault5'], bonus: { 2: [['haste', 0.05]], 4: [['leech', 0.03], ['dmg', 0.05]] } },
  depths: { name: 'Forgemaster\u2019s Harness', pieces: ['set_depths1', 'set_depths2', 'set_depths3', 'set_depths4', 'set_depths5'], bonus: { 2: [['hp', 0.08]], 4: [['thorns', 0.1], ['dmg', 0.06]] } },
};
Object.assign(ITEMS, {
  set_warrens1: { name: 'Briarwood Hood', slot: 'head', icon: 'head', q: 3, stats: { armor: 66, hp: 20, power: 8 }, ilvl: 7, set: 'warrens' },
  set_warrens2: { name: 'Briarwood Mantle', slot: 'shoulders', icon: 'shoulders', q: 3, stats: { armor: 66, hp: 20, haste: 7 }, ilvl: 7, set: 'warrens' },
  set_warrens3: { name: 'Briarwood Jerkin', slot: 'chest', icon: 'chest', q: 3, stats: { armor: 66, hp: 20, power: 8 }, ilvl: 7, set: 'warrens' },
  set_warrens4: { name: 'Briarwood Breeches', slot: 'legs', icon: 'legs', q: 3, stats: { armor: 66, hp: 20, haste: 7 }, ilvl: 7, set: 'warrens' },
  set_warrens5: { name: 'Briarwood Gloves', slot: 'hands', icon: 'hands', q: 3, stats: { armor: 66, hp: 20, power: 8 }, ilvl: 7, set: 'warrens' },
  set_deepmine1: { name: 'Deepdelver Helm', slot: 'head', icon: 'head', q: 3, stats: { armor: 96, hp: 29, power: 11 }, ilvl: 11, set: 'deepmine' },
  set_deepmine2: { name: 'Deepdelver Pauldrons', slot: 'shoulders', icon: 'shoulders', q: 3, stats: { armor: 96, hp: 29, haste: 10 }, ilvl: 11, set: 'deepmine' },
  set_deepmine3: { name: 'Deepdelver Vest', slot: 'chest', icon: 'chest', q: 3, stats: { armor: 96, hp: 29, power: 11 }, ilvl: 11, set: 'deepmine' },
  set_deepmine4: { name: 'Deepdelver Leggings', slot: 'legs', icon: 'legs', q: 3, stats: { armor: 96, hp: 29, haste: 10 }, ilvl: 11, set: 'deepmine' },
  set_deepmine5: { name: 'Deepdelver Boots', slot: 'feet', icon: 'feet', q: 3, stats: { armor: 96, hp: 29, power: 11 }, ilvl: 11, set: 'deepmine' },
  set_vault1: { name: 'Vaultguard Visor', slot: 'head', icon: 'head', q: 3, stats: { armor: 133, hp: 40, power: 16 }, ilvl: 16, set: 'vault' },
  set_vault2: { name: 'Vaultguard Shoulderguards', slot: 'shoulders', icon: 'shoulders', q: 3, stats: { armor: 133, hp: 40, haste: 13 }, ilvl: 16, set: 'vault' },
  set_vault3: { name: 'Vaultguard Breastplate', slot: 'chest', icon: 'chest', q: 3, stats: { armor: 133, hp: 40, power: 16 }, ilvl: 16, set: 'vault' },
  set_vault4: { name: 'Vaultguard Greaves', slot: 'legs', icon: 'legs', q: 3, stats: { armor: 133, hp: 40, haste: 13 }, ilvl: 16, set: 'vault' },
  set_vault5: { name: 'Vaultguard Gauntlets', slot: 'hands', icon: 'hands', q: 3, stats: { armor: 133, hp: 40, power: 16 }, ilvl: 16, set: 'vault' },
  set_depths1: { name: 'Forgeplate Helm', slot: 'head', icon: 'head', q: 3, stats: { armor: 170, hp: 51, power: 20 }, ilvl: 21, set: 'depths' },
  set_depths2: { name: 'Forgeplate Pauldrons', slot: 'shoulders', icon: 'shoulders', q: 3, stats: { armor: 170, hp: 51, haste: 17 }, ilvl: 21, set: 'depths' },
  set_depths3: { name: 'Forgeplate Cuirass', slot: 'chest', icon: 'chest', q: 3, stats: { armor: 170, hp: 51, power: 20 }, ilvl: 21, set: 'depths' },
  set_depths4: { name: 'Forgeplate Legguards', slot: 'legs', icon: 'legs', q: 3, stats: { armor: 170, hp: 51, haste: 17 }, ilvl: 21, set: 'depths' },
  set_depths5: { name: 'Forgeplate Sabatons', slot: 'feet', icon: 'feet', q: 3, stats: { armor: 170, hp: 51, power: 20 }, ilvl: 21, set: 'depths' },
});

export const VENDORS = {
  general: ['tonic', 'draught', 'bread'],
  smith: ['tonic'],
  baker: ['bread', 'millloaf'],
};

// gather nodes (mosscaps in the glade)
export const NODES = [
  ...Array.from({ length: 14 }, (_, i) => ({ id: 'node' + i, item: 'glowcap', x: 145 + Math.cos(i * 2.39) * (14 + (i % 4) * 7), z: -140 + Math.sin(i * 2.39) * (12 + (i % 5) * 5) })),
];

// things in the world a quest asks you to use: walk up and press F (each one counts once per player)
export const OBJECT_KINDS = {
  cache: { prompt: 'Smash the supply cache', goal: 'Bandit supply caches smashed', done: 'smashed' },
  keg: { prompt: 'Cut the fuse', goal: 'Blasting kegs defused', done: 'defused' },
  notes: { prompt: 'Gather the scholar\'s notes', goal: 'Bundles of notes recovered', done: 'gathered' },
  valve: { prompt: 'Close the slag valve', goal: 'Slag valves closed', done: 'closed' },
  beacon: { prompt: 'Light the signal brazier', goal: 'Signal braziers lit', done: 'lit' },
};
const dob = (d, id, kind, x, z, ry = 0) => ({ id, kind, x: DUNGEON_BY_ID[d].ox + x, z: DUNGEON_BY_ID[d].oz + z, ry });
export const OBJECTS = [
  { id: 'o_cache1', kind: 'cache', x: -127, z: -11, ry: 0.3 }, { id: 'o_cache2', kind: 'cache', x: -111, z: -18, ry: 1.4 }, { id: 'o_cache3', kind: 'cache', x: -133, z: -24, ry: 2.2 },
  dob('deepmine', 'o_keg1', 'keg', 51, 69, 0.4), dob('deepmine', 'o_keg2', 'keg', 31, 64, 1.2), dob('deepmine', 'o_keg3', 'keg', 104, 57, 2.0), dob('deepmine', 'o_keg4', 'keg', 68, 41, 0.8),
  dob('vault', 'o_notes1', 'notes', 54, 86, 0.2), dob('vault', 'o_notes2', 'notes', 19, 70, 1.6), dob('vault', 'o_notes3', 'notes', 93, 60, -1.4), dob('vault', 'o_notes4', 'notes', 66, 47, 2.6),
  dob('depths', 'o_valve1', 'valve', 33, 77, PI2 / 4), dob('depths', 'o_valve2', 'valve', 8, 64, PI2 / 4), dob('depths', 'o_valve3', 'valve', 116, 64, -PI2 / 4), dob('depths', 'o_valve4', 'valve', 18, 30, PI2 / 4),
  { id: 'o_beacon1', kind: 'beacon', x: -5, z: -219, ry: 0 }, { id: 'o_beacon2', kind: 'beacon', x: 17, z: -219, ry: 0 }, { id: 'o_beacon3', kind: 'beacon', x: 17, z: -197, ry: 0 },
];

// world events: every so often a wave marches on a hub; beating it back rewards everyone who fought
export const WORLD_EVENTS = [
  { id: 'swarm', name: 'Gearling Swarm', every: [540, 900], radius: 170, target: [100, 12],
    path: [[168, 40], [140, 30], [118, 20], [100, 12]], mobs: [['gearling', 8, [2, 3]], ['scrapper', 3, [3, 4]]], xp: 600, gold: 60,
    start: 'A swarm of gearlings is pouring out of the east toward Brightfield Farms!', win: 'The swarm is broken. Brightfield thanks its defenders.', lose: 'The swarm scatters into the fields.' },
  { id: 'raid', name: 'Dustcloak Raid', every: [600, 960], radius: 170, target: [-40, 170],
    path: [[40, 196], [10, 186], [-14, 178], [-36, 170]], mobs: [['raider', 6, [11, 12]], ['raiderArcher', 3, [11, 12]]], xp: 3000, gold: 220,
    start: 'Dustcloak raiders are riding on Dunewatch Post! To the walls!', win: 'The raid is broken. Captain Tariq salutes the defenders of Dunewatch.', lose: 'The raiders melt back into the dunes.' },
  { id: 'breakout', name: 'Foundry Breakout', every: [660, 1020], radius: 170, target: [-104, -110],
    path: [[-140, -140], [-128, -128], [-114, -118], [-104, -110]], mobs: [['sentinel', 4, [16, 16]], ['furnace', 2, [16, 17]]], xp: 5200, gold: 380,
    start: 'Engines are breaking out of the Old Foundry and marching on Foundry Watch!', win: 'The breakout is stopped. Foundry Watch holds.', lose: 'The engines turn back toward the foundry.' },
];

// where the fallen wake: the nearest of these (dungeons send you back to their entrance hall)
export const GRAVEYARDS = [
  { x: 2, z: 10 }, { x: 88, z: 6 }, { x: -60, z: -40 }, { x: 128, z: -122 }, { x: 170, z: -24 }, { x: -36, z: 160 },
  { x: 180, z: 134 }, { x: -134, z: 188 }, { x: -100, z: -104 }, { x: -180, z: 24 },
];

// rarity colours by q (0 Poor .. 6 Prismatic). Legendary is golden; Prismatic is drawn as the tempered-steel gradient
// PRISMATIC_STOPS (straw, bronze, peacock, blue) wherever a gradient fits, QUALITY[6] is its flat fallback.
export const QUALITY = ['#9d9d9d', '#ffffff', '#3ad65a', '#3a8aff', '#b45aff', '#ffc23a', '#ff6ad5'];
export const QUALITY_NAME = ['Poor', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Prismatic'];
export const PRISMATIC_STOPS = ['#f2d47c', '#c58a42', '#7a52c8', '#3d7fe0'];
export const PRISMATIC_CSS = `linear-gradient(135deg, ${PRISMATIC_STOPS.join(', ')})`;
// upgrade materials (plan B2): billets from Heroic and Tempest bosses and epic+ salvage of item level 40+, cores from raid
// and world bosses and duplicate Dragonslayer salvage (icons are placeholders until painted)
Object.assign(ITEMS, {
  billet: { name: 'Tempered Billet', slot: 'junk', icon: 'scrap', q: 3, stack: 50, price: 60, desc: 'A bar of steel worked and quenched by a master smith. Upgrades from +4 need it.' },
  enginecore: { name: 'War-Engine Core', slot: 'junk', icon: 'gear', q: 4, stack: 20, price: 250, desc: 'The heavy drive core of a great war-engine, still sound. Upgrades from +7 need it.' },
});

// set pieces drop from each dungeon's elites and boss
LOOT_TABLES.thresher.items.push(['set_warrens1', 0.16], ['set_warrens2', 0.16], ['set_warrens3', 0.16], ['set_warrens4', 0.16], ['set_warrens5', 0.16]);
LOOT_TABLES.warrensElite.items.push(['set_warrens1', 0.05], ['set_warrens2', 0.05], ['set_warrens3', 0.05], ['set_warrens4', 0.05], ['set_warrens5', 0.05]);
LOOT_TABLES.grandbore.items.push(['set_deepmine1', 0.16], ['set_deepmine2', 0.16], ['set_deepmine3', 0.16], ['set_deepmine4', 0.16], ['set_deepmine5', 0.16]);
LOOT_TABLES.deepElite.items.push(['set_deepmine1', 0.05], ['set_deepmine2', 0.05], ['set_deepmine3', 0.05], ['set_deepmine4', 0.05], ['set_deepmine5', 0.05]);
LOOT_TABLES.colossus.items.push(['set_vault1', 0.16], ['set_vault2', 0.16], ['set_vault3', 0.16], ['set_vault4', 0.16], ['set_vault5', 0.16]);
LOOT_TABLES.vaultElite.items.push(['set_vault1', 0.05], ['set_vault2', 0.05], ['set_vault3', 0.05], ['set_vault4', 0.05], ['set_vault5', 0.05]);
LOOT_TABLES.forgemaster.items.push(['set_depths1', 0.16], ['set_depths2', 0.16], ['set_depths3', 0.16], ['set_depths4', 0.16], ['set_depths5', 0.16]);
LOOT_TABLES.depthsElite.items.push(['set_depths1', 0.05], ['set_depths2', 0.05], ['set_depths3', 0.05], ['set_depths4', 0.05], ['set_depths5', 0.05]);

// daily quests: each watch quartermaster posts two jobs that can be done once per day; rewards scale with your level
const DAILY = (id, giver, name, lvl, kill, n, text) => { QUESTS[id] = { name: '[Daily] ' + name, giver, turnin: giver, lvl, text, goal: { kill, n }, xp: 0, gold: 0, rewards: [], daily: true }; NPCS.find((x) => x.id === giver).quests = [...(NPCS.find((x) => x.id === giver).quests || []), id]; };
DAILY('d_tillers', 'n_marshal', 'Furrows, Not Fences', 3, 'tiller', 8, 'The tillers have started ploughing through fences again. Bring eight of them to a stop before the farmers lose another field. The Watch pays every day this needs doing.');
DAILY('d_drillers', 'n_marshal', 'Quiet the Quarry Road', 7, 'driller', 8, 'Holt says the drillers are boring under the quarry road again. Put eight of them out of action so the carts can pass.');
DAILY('d_crawlers', 'n_sutler', 'Sand in the Supplies', 10, 'crawler', 10, 'Crawlers have been chewing through our supply crates every night. Ten fewer of them would let me sleep.');
DAILY('d_raiders', 'n_sutler', 'Dust on the Horizon', 12, 'raider', 10, 'Dustcloak scouts circle the post every day. Turn ten of them back and Dunewatch will remember it.');
DAILY('d_sentinels', 'n_brom', 'Brass on the March', 16, 'sentinel', 8, 'The sentinels keep walking out of the foundry in step. Break eight of them before they reach the watch walls.');
DAILY('d_sawyers', 'n_brom', 'Timber Trouble', 15, 'sawyer', 6, 'Those sawyers have cut the Rustwood road to ribbons. Stop six of them and I will sign the ledger in your favour.');

// ============================================================================ THE HIGHREACH (20-25)
// The plateau above the glade waterfall: storm-drinking coil engines in the Coilfields, the Cragborn marauders in their camp,
// and the Highreach Wardens holding a lookout at the head of the climb.
Object.assign(MOBS, {
  arcroller: { name: 'Arc Roller', model: 'arcroller', lvl: [20, 22], hp: 520, dmg: [12, 20], speed: 3.8, aggro: 13, range: 2.6, swing: 2.0, xp: 300, loot: 'storm', radius: 1.0 },
  pylon: { name: 'Coil Pylon', model: 'pylon', lvl: [21, 23], hp: 600, dmg: [10, 16], speed: 0, aggro: 20, range: 20, swing: 2.6, xp: 320, loot: 'storm', radius: 0.9, ranged: 'arc' },
  marauder: { name: 'Cragborn Marauder', model: 'raider', variant: 13, lvl: [22, 24], hp: 480, dmg: [13, 21], speed: 5.2, aggro: 14, range: 2.4, swing: 1.7, xp: 330, loot: 'crag', radius: 0.5, humanoid: true },
  slinger: { name: 'Cragborn Slinger', model: 'raider', variant: 14, lvl: [22, 24], hp: 420, dmg: [11, 18], speed: 4.8, aggro: 19, range: 18, swing: 2.3, xp: 330, loot: 'crag', radius: 0.5, humanoid: true, ranged: 'arrow' },
  thane: { name: 'Thane Halbrek', model: 'raider', variant: 15, lvl: [24, 24], hp: 5200, dmg: [26, 40], speed: 5.4, aggro: 15, range: 2.8, swing: 1.8, xp: 2400, loot: 'thane', radius: 0.6, humanoid: true, elite: true,
    abilities: [{ kind: 'nova', every: 12, r: 5.5, delay: 1.6, dmg: 1.6, text: 'Halbrek swings his great axe in a full circle!' }, { kind: 'enrage', at: 0.4, text: 'Halbrek roars for the Cragborn!' }] },
  sparkplug: { name: 'Sparkplug', model: 'sparkplug', lvl: [23, 23], hp: 4200, dmg: [22, 34], speed: 4.0, aggro: 14, range: 3.2, swing: 1.9, xp: 1800, loot: 'rare5', radius: 1.5, elite: true, rare: true,
    abilities: [{ kind: 'circles', every: 11, n: 2, r: 3, delay: 1.6, dmg: 1.4, text: 'Sparkplug spits arcs into the grass!' }] },
  stormengine: { name: 'The Stormengine', model: 'stormengine', lvl: [25, 25], hp: 14000, dmg: [34, 52], speed: 2.8, aggro: 18, range: 5.0, swing: 2.8, xp: 6000, loot: 'stormengine', radius: 3.0, elite: true, boss: true,
    abilities: [{ kind: 'circles', every: 9, n: 4, r: 3.5, delay: 1.8, dmg: 1.5, text: 'The Stormengine discharges into the ground!' },
      { kind: 'nova', every: 16, r: 8, delay: 2.2, dmg: 1.8, text: 'Arcs leap from the coil tower!' }, { kind: 'enrage', at: 0.35, text: 'The Stormengine\u2019s coils glow white-hot!' }] },
});
SPAWNS.push(
  { mob: 'arcroller', x: 186, z: -216, r: 14, n: 6 }, { mob: 'arcroller', x: 166, z: -204, r: 8, n: 3 }, { mob: 'arcroller', x: 202, z: -238, r: 8, n: 2 },
  { mob: 'pylon', x: 176, z: -206, r: 0.5, n: 1 }, { mob: 'pylon', x: 198, z: -205, r: 0.5, n: 1 }, { mob: 'pylon', x: 178, z: -229, r: 0.5, n: 1 }, { mob: 'pylon', x: 200, z: -224, r: 0.5, n: 1 },
  { mob: 'marauder', x: 148, z: -232, r: 11, n: 6 }, { mob: 'slinger', x: 148, z: -233, r: 11, n: 3 }, { mob: 'marauder', path: [[128, -220], [140, -226], [146, -228]], r: 2, n: 2 },
  { mob: 'thane', x: 152, z: -239, r: 1.5, n: 1 },
  { mob: 'sparkplug', path: [[124, -228], [160, -212], [196, -232], [170, -242]], r: 2, n: 1 },
  { mob: 'stormengine', x: 196, z: -233, r: 1.5, n: 1 },
);
CARAVANS.push({ id: 'highreach', name: 'Highreach Lookout', x: 112, z: -216, zone: 'lookout' });
GRAVEYARDS.push({ x: 102, z: -214 });
NPCS.push(
  { id: 'n_hr_captain', name: 'Warden-Captain Edris', title: 'Highreach Lookout', look: 'knight', x: 106, z: -212, ry: 0.5, quests: ['q_hr_rollers', 'q_hr_crag', 'q_hr_slingers', 'q_hr_thane'],
    greet: 'You made the climb. Good. Up here the storms walk on wheels and the Cragborn think the high ground makes them kings.' },
  { id: 'n_hr_engineer', name: 'Engineer Pazel', title: 'Coil Studies', look: 'chemist', x: 101, z: -206, ry: 0.9, quests: ['q_hr_wire', 'q_hr_pylons', 'q_hr_engine'],
    greet: 'Someone built those coils to drink the lightning. I intend to find out who, and how, and then unbuild them.' },
  { id: 'n_hr_qm', name: 'Quartermaster Wulf', title: 'Highreach Wardens', look: 'warden', x: 114, z: -206, ry: -0.6, vendor: 'general', quests: ['q_hr_spark'],
    greet: 'Rope, rations, tonics. Everything up here was carried on somebody\u2019s back, so mind the prices.' },
  { id: 'n_cv_highreach', name: 'Caravan Master Rolan', title: 'Caravans', look: 'villager', v: 2, x: 113.5, z: -216, ry: -1.2, caravan: 'highreach' },
);
NPCS.find((n) => n.id === 'n_hesk').quests = [...(NPCS.find((n) => n.id === 'n_hesk').quests || []), 'q_hr_up'];
Object.assign(ITEMS, {
  coilwire: { name: 'Copper Coil Wire', slot: 'quest', icon: 'spring', q: 1, stack: 20 },
  cragwool: { name: 'Cragborn Wool', slot: 'junk', icon: 'scrap', q: 0, stack: 20, price: 22 },
  capacitor: { name: 'Cracked Capacitor', slot: 'junk', icon: 'gear', q: 0, stack: 20, price: 30 },
  r_hr_boots: gear('Climber\u2019s Hobnailed Boots', 'feet', 3, 21),
  r_hr_gloves: gear('Coil-Handler Gloves', 'hands', 3, 21, true),
  r_hr_shoulder: gear('Lookout Pauldrons', 'shoulders', 3, 22),
  r_hr_cloak: gear('Windbreak Cloak', 'back', 3, 22, true),
  r_hr_helm: gear('Insulated Helm', 'head', 3, 23),
  r_hr_charm: gear('Grounding Keepsake', 'trinket', 3, 23, true),
  r_hr_chest: gear('Cragborn Hauberk', 'chest', 3, 24),
  r_hr_axe: gear('Halbrek\u2019s Great Axe', 'weapon', 4, 25),
  r_hr_legs: gear('Thane\u2019s Legguards', 'legs', 4, 25),
  r_hr_coil: gear('Stormengine Coil Core', 'trinket', 4, 26, true),
  r_hr_blade: gear('Coilbreaker', 'weapon', 4, 26, true),
  r_spark: gear('Sparkplug\u2019s Capacitor', 'trinket', 4, 24, true),
});
Object.assign(LOOT_TABLES, {
  storm: { gold: [8, 16], items: [['coilwire', 0.55], ['capacitor', 0.25], ['draught', 0.15]], gear: 0.28 },
  crag: { gold: [10, 18], items: [['cragwool', 0.45], ['draught', 0.15], ['tonic', 0.1]], gear: 0.3 },
  thane: { gold: [100, 160], items: [['r_hr_axe', 0.25], ['r_hr_legs', 0.25], ['draught', 1]], gear: 1, gearQ: 3, gearN: 2 },
  rare5: { gold: [80, 120], items: [['r_spark', 1]], gear: 1, gearQ: 3 },
  stormengine: { gold: [180, 260], items: [['r_hr_coil', 0.35], ['r_hr_blade', 0.35], ['draught', 1]], gear: 1, gearQ: 4, gearN: 3 },
});
OBJECT_KINDS.rod = { prompt: 'Drive in a grounding rod', goal: 'Grounding rods driven', done: 'driven' };
OBJECTS.push(
  { id: 'o_rod1', kind: 'rod', x: 172.5, z: -208.5, ry: 0.4 }, { id: 'o_rod2', kind: 'rod', x: 201.5, z: -208, ry: -0.6 },
  { id: 'o_rod3', kind: 'rod', x: 174.5, z: -226.5, ry: 2.1 }, { id: 'o_rod4', kind: 'rod', x: 203.5, z: -221.5, ry: -2.4 },
);
Object.assign(QUESTS, {
  q_hr_up: { name: 'The Highreach', giver: 'n_hesk', turnin: 'n_hr_captain', lvl: 19, text: 'The Highreach Wardens hold a lookout on the plateau above the glade falls. They have sent word: machines up there are drinking the storms, and the hill folk have turned raider. Take the road up from the glade and report to Warden-Captain Edris.', goal: { reach: 'lookout' }, xp: 2400, gold: 60, rewards: [] },
  q_hr_rollers: { name: 'Rolling Thunder', giver: 'n_hr_captain', turnin: 'n_hr_captain', lvl: 20, text: 'Drums on wheels, crackling with stolen lightning, rolling right up to our gate. They come from the Coilfields to the east. Stop eight of them.', goal: { kill: 'arcroller', n: 8 }, xp: 5200, gold: 90, rewards: ['r_hr_boots', 'r_hr_gloves'], pre: 'q_hr_up' },
  q_hr_wire: { name: 'Live Wire', giver: 'n_hr_engineer', turnin: 'n_hr_engineer', lvl: 21, text: 'The rollers are wound with copper wire finer than any smith in the valley can draw. Bring me six coils of it from their wreckage and I can learn how they were made.', goal: { item: 'coilwire', n: 6 }, xp: 5600, gold: 95, rewards: ['r_hr_cloak'], pre: 'q_hr_up' },
  q_hr_pylons: { name: 'Grounding the Pylons', giver: 'n_hr_engineer', turnin: 'n_hr_engineer', lvl: 22, text: 'Four great pylons feed the Coilfields. Drive a grounding rod into the earth beside each one and their charge will run harmlessly into the rock. They will not like it. Expect them to shoot.', goal: { use: 'rod', n: 4 }, xp: 6200, gold: 110, rewards: ['r_hr_helm', 'r_hr_charm'], pre: 'q_hr_wire' },
  q_hr_crag: { name: 'The Cragborn', giver: 'n_hr_captain', turnin: 'n_hr_captain', lvl: 22, text: 'The hill clans called themselves the Cragborn when they took to raiding. Their camp sits south of here, on the lip of the cliff. Show them the Wardens still patrol this plateau: bring down eight marauders.', goal: { kill: 'marauder', n: 8 }, xp: 6000, gold: 100, rewards: ['r_hr_shoulder', 'r_hr_chest'], pre: 'q_hr_rollers' },
  q_hr_slingers: { name: 'Stones from Above', giver: 'n_hr_captain', turnin: 'n_hr_captain', lvl: 23, text: 'Their slingers sit on the rocks and pick off anyone on the camp road. Six of them, and the road is ours again.', goal: { kill: 'slinger', n: 6 }, xp: 6600, gold: 110, rewards: [], pre: 'q_hr_crag' },
  q_hr_thane: { name: 'Thane Halbrek', giver: 'n_hr_captain', turnin: 'n_hr_captain', lvl: 24, text: 'Halbrek leads the Cragborn. He fights with a great axe and he does not fall easily. Take friends, or a hired blade from Sunmere, and end his raiding.', goal: { kill: 'thane', n: 1 }, xp: 9000, gold: 160, rewards: ['r_hr_axe', 'r_hr_legs'], pre: 'q_hr_slingers' },
  q_hr_engine: { name: 'The Stormengine', giver: 'n_hr_engineer', turnin: 'n_hr_engineer', lvl: 24, text: 'With the pylons grounded, the great engine at the heart of the Coilfields is starving for charge. This is our chance. Break the Stormengine before its builders come back for it.', goal: { kill: 'stormengine', n: 1 }, xp: 12000, gold: 220, rewards: ['r_hr_coil', 'r_hr_blade'], pre: 'q_hr_pylons' },
  q_hr_spark: { name: 'Sparkplug', giver: 'n_hr_qm', turnin: 'n_hr_qm', lvl: 23, text: 'There is a roller up here twice the size of the others. The Wardens call it Sparkplug. It wanders the whole plateau and wrecks our supply carts. Put it down if you cross its path.', goal: { kill: 'sparkplug', n: 1 }, xp: 5000, gold: 120, rewards: ['r_hr_charm'], pre: 'q_hr_up' },
});
DAILY('d_rollers', 'n_hr_qm', 'Wheels in the Wind', 21, 'arcroller', 8, 'The rollers keep coming. Eight of them, every day, and the lookout stays standing.');
DAILY('d_marauders', 'n_hr_qm', 'Clan Business', 23, 'marauder', 8, 'The Cragborn send fresh raiders up the camp road each morning. Send eight of them back down.');
FACTIONS.highreach = { name: 'Highreach Wardens', color: '#7ab0d8', zones: ['highreach', 'lookout', 'coilfields', 'cragcamp'], qm: 'n_hr_qm' };
REP_SHOP.highreach = [{ item: 'rep_h1', rank: 1, price: 6000 }, { item: 'rep_h2', rank: 2, price: 8500 }, { item: 'rep_h3', rank: 3, price: 11000 }, { item: 'rep_h4', rank: 4, price: 15000 }];
Object.assign(ITEMS, {
  rep_h1: { name: 'Warden\u2019s Windcloak', slot: 'back', icon: 'back', q: 3, stats: { armor: 120, hp: 40, haste: 7 }, ilvl: 23 },
  rep_h2: { name: 'Lookout Spaulders', slot: 'shoulders', icon: 'shoulders', q: 3, stats: { armor: 136, hp: 46, power: 10 }, ilvl: 24 },
  rep_h3: { name: 'Stormglass Lens', slot: 'trinket', icon: 'charm', q: 4, stats: { power: 62, hp: 26, haste: 10 }, ilvl: 25 },
  rep_h4: { name: 'Highreach Warblade', slot: 'weapon', icon: 'sword', q: 4, stats: { power: 112, haste: 12 }, ilvl: 26 },
});
WORLD_EVENTS.push({ id: 'surge', name: 'Storm Surge', every: [720, 1080], radius: 120, target: [108, -210],
  path: [[186, -216], [160, -212], [132, -210], [112, -210]], mobs: [['arcroller', 6, [21, 22]], ['marauder', 2, [22, 22]]], xp: 9000, gold: 600,
  start: 'A storm surge is driving the arc rollers out of the Coilfields toward the lookout!', win: 'The surge is spent. The Wardens hold the Highreach.', lose: 'The rollers grind back toward the Coilfields.' });
WANDERERS.push({ name: 'Eamon', cls: 'knight', lvl: 21 }, { name: 'Rurik', cls: 'chemist', lvl: 23 });

// ============================================================================ THE STORMWORKS (24-25 dungeon under the Coilfields)
const dsw = (mob, lx, lz, r, n, extra = {}) => ({ mob, dungeon: 'stormworks', x: 1800 + lx, z: -60 + lz, r, n, ...extra });
Object.assign(MOBS, {
  arcsentinel: { name: 'Arc Sentinel', model: 'sentinel', variant: 1, lvl: [24, 25], hp: 620, dmg: [13, 21], speed: 3.6, aggro: 12, range: 2.8, swing: 2.2, xp: 380, loot: 'storm', radius: 0.9 },
  lineman: { name: 'Stormworks Lineman', model: 'raider', variant: 16, lvl: [24, 25], hp: 520, dmg: [13, 21], speed: 5.0, aggro: 13, range: 2.4, swing: 1.7, xp: 370, loot: 'crag', radius: 0.5, humanoid: true },
  capwarden: { name: 'The Capacitor Warden', model: 'capwarden', lvl: [25, 25], hp: 9000, dmg: [24, 36], speed: 0, aggro: 22, range: 22, swing: 2.4, xp: 3600, loot: 'swBoss', radius: 2.0, elite: true, ranged: 'arc',
    abilities: [{ kind: 'circles', every: 8, n: 4, r: 3.2, delay: 1.7, dmg: 1.4, text: 'The Capacitor Warden discharges!' }, { kind: 'enrage', at: 0.3, text: 'The Warden\u2019s coils overload!' }] },
  voss: { name: 'Chief Engineer Voss', model: 'raider', variant: 17, lvl: [25, 25], hp: 8200, dmg: [26, 40], speed: 5.2, aggro: 14, range: 2.8, swing: 1.8, xp: 3600, loot: 'swBoss', radius: 0.6, humanoid: true, elite: true,
    abilities: [{ kind: 'nova', every: 12, r: 6, delay: 1.6, dmg: 1.6, text: 'Voss throws the breaker!' }, { kind: 'circles', every: 9, n: 3, r: 3, delay: 1.6, dmg: 1.3, text: 'Voss calls the lightning down on you!' }] },
  thunderhead: { name: 'The Thunderhead', model: 'thunderhead', lvl: [26, 26], hp: 74000, dmg: [36, 54], speed: 2.6, aggro: 20, range: 5.5, swing: 2.8, xp: 9000, loot: 'thunderhead', radius: 3.4, elite: true, boss: true,
    abilities: [{ kind: 'circles', every: 8, n: 5, r: 3.5, delay: 1.8, dmg: 1.5, text: 'The Thunderhead hurls arcs across the chamber!' },
      { kind: 'nova', every: 14, r: 9, delay: 2.4, dmg: 1.9, text: 'The Thunderhead gathers a storm in its towers!' }, { kind: 'enrage', at: 0.3, text: 'Both towers blaze white!' }] },
});
SPAWNS.push(
  dsw('arcsentinel', 58, 96, 4, 2), dsw('lineman', 58, 84, 2, 2),
  dsw('arcroller', 50, 70, 8, 3), dsw('arcsentinel', 68, 66, 6, 2), dsw('capwarden', 58, 62, 1, 1),
  dsw('lineman', 16, 64, 6, 3), dsw('arcroller', 16, 48, 6, 2), dsw('arcsentinel', 22, 16, 8, 2), dsw('lineman', 14, 12, 4, 2), dsw('voss', 28, 14, 1, 1),
  dsw('arcsentinel', 102, 56, 6, 2), dsw('arcroller', 100, 42, 6, 3), dsw('lineman', 96, 14, 6, 3), dsw('arcroller', 106, 12, 4, 2),
  dsw('arcsentinel', 50, 18, 4, 2), dsw('arcsentinel', 70, 18, 4, 2), dsw('thunderhead', 60, 12, 1, 1),
);
Object.assign(ITEMS, {
  coreshard: { name: 'Thunderhead Core Shard', slot: 'quest', icon: 'gear', q: 2, stack: 1 },
});
SETS.stormworks = { name: 'Thunderforged Plate', pieces: ['set_storm1', 'set_storm2', 'set_storm3', 'set_storm4', 'set_storm5'], bonus: { 2: [['hp', 0.06], ['haste', 0.03]], 4: [['crit', 0.04], ['dmg', 0.06], ['leech', 0.02]] } };
Object.assign(ITEMS, {
  set_storm1: { name: 'Thunderforged Helm', slot: 'head', icon: 'head', q: 4, stats: { armor: 160, hp: 54, power: 18 }, ilvl: 26, set: 'stormworks' },
  set_storm2: { name: 'Thunderforged Pauldrons', slot: 'shoulders', icon: 'shoulders', q: 4, stats: { armor: 150, hp: 50, haste: 9 }, ilvl: 26, set: 'stormworks' },
  set_storm3: { name: 'Thunderforged Cuirass', slot: 'chest', icon: 'chest', q: 4, stats: { armor: 190, hp: 62, power: 20 }, ilvl: 26, set: 'stormworks' },
  set_storm4: { name: 'Thunderforged Legplates', slot: 'legs', icon: 'legs', q: 4, stats: { armor: 176, hp: 58, haste: 10 }, ilvl: 26, set: 'stormworks' },
  set_storm5: { name: 'Thunderforged Gauntlets', slot: 'hands', icon: 'hands', q: 4, stats: { armor: 140, hp: 46, power: 16 }, ilvl: 26, set: 'stormworks' },
  r_sw_ring: gear('Insulated Signet', 'trinket', 4, 26, true),
  r_sw_hammer: gear('Thunderhead Maul', 'weapon', 4, 27),
});
Object.assign(LOOT_TABLES, {
  swBoss: { gold: [140, 200], items: [['set_storm1', 0.14], ['set_storm2', 0.14], ['set_storm3', 0.14], ['set_storm4', 0.14], ['set_storm5', 0.14], ['draught', 1]], gear: 1, gearQ: 4, gearN: 2 },
  thunderhead: { gold: [260, 360], items: [['coreshard', 1], ['set_storm1', 0.2], ['set_storm2', 0.2], ['set_storm3', 0.2], ['set_storm4', 0.2], ['set_storm5', 0.2], ['r_sw_hammer', 0.3], ['r_sw_ring', 0.3]], gear: 1, gearQ: 4, gearN: 3 },
});
Object.assign(QUESTS, {
  q_sw_enter: { name: 'Under the Coilfields', giver: 'n_hr_engineer', turnin: 'n_hr_engineer', lvl: 24, text: 'The pylons drew their charge from somewhere below. There is a hatch at the east edge of the Coilfields, and stairs going down. Find out what is under there.', goal: { reach: 'stormworks' }, xp: 7000, gold: 120, rewards: [], pre: 'q_hr_engine' },
  q_sw_voss: { name: 'The Chief Engineer', giver: 'n_hr_captain', turnin: 'n_hr_captain', lvl: 25, text: 'A man called Voss runs the works under the plateau. He built the coils, and he sold the Cragborn their axes. Stop him.', goal: { kill: 'voss', n: 1 }, xp: 11000, gold: 200, rewards: ['r_sw_ring'], pre: 'q_sw_enter' },
  q_sw_core: { name: 'The Heart of the Storm', giver: 'n_hr_engineer', turnin: 'n_hr_engineer', lvl: 25, text: 'Everything down there feeds one great engine: the Thunderhead. Break it and bring me a shard of its core, so the valley never has to face another like it.', goal: { item: 'coreshard', n: 1 }, xp: 15000, gold: 300, rewards: ['r_sw_hammer'], pre: 'q_sw_enter' },
});
NPCS.find((n) => n.id === 'n_hr_engineer').quests.push('q_sw_enter', 'q_sw_core');
NPCS.find((n) => n.id === 'n_hr_captain').quests.push('q_sw_voss');

// ============================================================================ CRAFTING
// Three stations: the smith (Brannoc Hale), the herbalist (Elder Moss) and the miller (Miller Joss). Recipes turn the junk the
// machines drop and the mosscaps of the glade into consumables and tinkered gear.
Object.assign(ITEMS, {
  whetstone: { name: 'Sharpening Stone', slot: 'use', icon: 'blade', q: 1, stack: 10, price: 12, use: { buff: { name: 'Sharpened', stat: 'dmg', pct: 6, dur: 600, icon: 'blade' } }, desc: 'Your strikes deal 6% more damage for 10 minutes.' },
  rivets: { name: 'Plate Rivets', slot: 'use', icon: 'shield', q: 1, stack: 10, price: 14, use: { buff: { name: 'Riveted', stat: 'armor', pct: 8, dur: 600, icon: 'shield' } }, desc: 'Take 8% less damage for 10 minutes.' },
  strongtonic: { name: 'Strong Tonic', slot: 'use', icon: 'potion', q: 2, stack: 10, price: 20, use: { heal: 0.6 }, desc: 'Restores 60% of your health.' },
  stew: { name: 'Mosscap Stew', slot: 'use', icon: 'bread', q: 2, stack: 10, price: 18, use: { heal: 1, food: true, buff: { name: 'Well Fed', stat: 'dmg', pct: 3, dur: 900, icon: 'bread' } }, desc: 'Eat to recover fully, then fight 3% harder for 15 minutes.' },
  t_gloves: gear('Riveted Work Gloves', 'hands', 3, 8),
  t_boots: gear('Brass-Bound Boots', 'feet', 3, 16, true),
  t_helm: gear('Coil-Wound Helm', 'head', 3, 22),
  t_cloak: gear('Cragwool Cloak', 'back', 3, 22, true),
  t_charm: gear('Tinker\u2019s Pocket Gear', 'trinket', 3, 12, true),
});
// station, result, how many, ingredients, cost in copper, level
export const RECIPES = [
  { id: 'rc_whet', station: 'smith', makes: 'whetstone', n: 2, needs: [['scrap', 3], ['ironore', 1]], cost: 20, lvl: 1 },
  { id: 'rc_rivets', station: 'smith', makes: 'rivets', n: 2, needs: [['scrap', 2], ['spring', 2]], cost: 30, lvl: 5 },
  { id: 'rc_gloves', station: 'smith', makes: 't_gloves', n: 1, needs: [['scrap', 8], ['spring', 4], ['cloth', 2]], cost: 300, lvl: 7 },
  { id: 'rc_charm', station: 'smith', makes: 't_charm', n: 1, needs: [['spring', 6], ['cog', 4], ['ironore', 3]], cost: 600, lvl: 11 },
  { id: 'rc_boots', station: 'smith', makes: 't_boots', n: 1, needs: [['brassplate', 6], ['spring', 4], ['scrap', 6]], cost: 1500, lvl: 15 },
  { id: 'rc_helm', station: 'smith', makes: 't_helm', n: 1, needs: [['coilwire', 6], ['capacitor', 4], ['brassplate', 2]], cost: 3000, lvl: 21 },
  { id: 'rc_cloak', station: 'smith', makes: 't_cloak', n: 1, needs: [['cragwool', 8], ['coilwire', 2]], cost: 3000, lvl: 21 },
  { id: 'rc_tonic', station: 'herbal', makes: 'tonic', n: 2, needs: [['glowcap', 2], ['cloth', 1]], cost: 10, lvl: 1 },
  { id: 'rc_draught', station: 'herbal', makes: 'draught', n: 2, needs: [['glowcap', 3]], cost: 10, lvl: 1 },
  { id: 'rc_strong', station: 'herbal', makes: 'strongtonic', n: 2, needs: [['glowcap', 4], ['capacitor', 1]], cost: 40, lvl: 12 },
  { id: 'rc_stew', station: 'cook', makes: 'stew', n: 2, needs: [['bread', 2], ['glowcap', 2]], cost: 20, lvl: 1 },
];
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const STATION_NAME = { smith: 'Smithing', herbal: 'Remedies', cook: 'Cooking' };
for (const [id, st] of [['n_smith', 'smith'], ['n_herbalist', 'herbal'], ['n_miller', 'cook']]) { const n = NPCS.find((x) => x.id === id); if (n) n.craft = st; }
// the quest items used as ingredients may stack and be kept after their quests
ITEMS.cog.stack = 20; ITEMS.glowcap.stack = 20; ITEMS.coilwire.stack = 20;

// ============================================================================ WORLD BOSS: THE WANDERING FORGE
// A foundry on treads that crawls the north road from Foundry Watch to the Highreach and back, about once an hour.
Object.assign(MOBS, {
  wforge: { name: 'The Wandering Forge', model: 'wforge', lvl: [26, 26], hp: 30000, dmg: [40, 60], speed: 2.4, aggro: 11, range: 6.5, swing: 3.0, xp: 12000, loot: 'wforge', radius: 4.0, elite: true, boss: true, world: true,
    abilities: [{ kind: 'circles', every: 7, n: 6, r: 3.6, delay: 1.9, dmg: 1.4, text: 'The Wandering Forge pours molten slag from its ladle!' },
      { kind: 'nova', every: 15, r: 10, delay: 2.4, dmg: 1.8, text: 'The Forge vents a blast of steam!' }, { kind: 'enrage', at: 0.25, text: 'The Forge\u2019s furnace roars white-hot!' }] },
});
SPAWNS.push({ mob: 'wforge', path: [[-96, -124], [-60, -160], [-24, -190], [2, -198], [40, -206], [70, -206]], r: 2, n: 1, world: true });
Object.assign(ITEMS, {
  r_forgeheart: gear('Heart of the Wandering Forge', 'trinket', 4, 27, true),
  r_forgeplate: gear('Forge-Walker Plate', 'chest', 4, 27),
});
Object.assign(LOOT_TABLES, {
  wforge: { gold: [400, 600], items: [['r_forgeheart', 0.4], ['r_forgeplate', 0.4], ['strongtonic', 1], ['brassplate', 1]], gear: 1, gearQ: 4, gearN: 3 },
});

// ============================================================================ SALVAGE: hauling things up out of the water
Object.assign(ITEMS, {
  hook: { name: 'Salvage Hook', slot: 'junk', icon: 'hammer', q: 1, stack: 1, price: 50, desc: 'A weighted hook on a long line. Stand by the lake, the stream or the pond and press F to cast it.' },
  oldboot: { name: 'Waterlogged Boot', slot: 'junk', icon: 'boot', q: 0, stack: 20, price: 1 },
  coinpouch: { name: 'Sodden Coin Purse', slot: 'junk', icon: 'ring', q: 1, stack: 20, price: 40 },
  r_locket: gear('Tarnished River Locket', 'trinket', 3, 8, true),
  r_lakering: gear('Lakebed Signet', 'trinket', 3, 14, true),
});
VENDORS.general.push('hook');
// one item per haul, weighted
export const SALVAGE = {
  stream: [['scrap', 30], ['cloth', 18], ['spring', 14], ['oldboot', 14], ['coinpouch', 10], ['ironore', 8], ['cog', 5], ['r_locket', 1]],
  lake: [['brassplate', 16], ['spring', 16], ['glowcap', 16], ['coinpouch', 14], ['oldboot', 10], ['capacitor', 10], ['scrap', 10], ['cog', 6], ['r_lakering', 2]],
  // the sea, with a fishing line: fish to eat, fish to sell, and now and then something rare
  sea: [['harrowsardine', 34], ['silverbass', 24], ['saltcrab', 14], ['oldboot', 8], ['driftwood', 8], ['goldfin', 5], ['pearlshell', 5], ['r_tidepearl', 2]],
};

// ============================================================================ RUNABOUT PAINTS (cosmetic)
// four channels: body (panels, tender, fenders, wheel faces; paint:false = oiled wood), trim (pin-stripes, rails, wheel rings,
// counterweights), metal (boiler skin: brass | copper | iron | bronze | gold) and seat (the cushions);
// unlocked by reputation (Honored) or achievements
export const PAINTS = {
  brass: { name: 'Workshop Brass', body: '#8a5a32', paint: false, trim: '#d9a650', metal: 'brass', seat: '#7a2a1c', need: null },
  sunmere: { name: 'Watch Blue', body: '#3a5a9a', paint: true, trim: '#e8c26a', metal: 'brass', seat: '#2a3a6a', need: { rep: 'sunmere', rank: 2 } },
  dune: { name: 'Dune Sand', body: '#d8b47a', paint: true, trim: '#2a8a8a', metal: 'copper', seat: '#6a4a2a', need: { rep: 'dunewatch', rank: 2 } },
  rust: { name: 'Foundry Rust', body: '#8a3a22', paint: true, trim: '#2a2a2a', metal: 'iron', seat: '#3a2a22', need: { rep: 'foundry', rank: 2 } },
  storm: { name: 'Storm Slate', body: '#4e5c70', paint: true, trim: '#e08a48', metal: 'copper', seat: '#2a3446', need: { rep: 'highreach', rank: 2 } },
  gilded: { name: 'Gilded', body: '#eadcb8', paint: true, trim: '#d8a84a', metal: 'gold', seat: '#7a1e1e', need: { ach: 'lvl25' } },
};

// ============================================================================ CLOCKWORK PETS (cosmetic)
export const PETS = {
  gearling: { name: 'Wind-up Gearling', model: 'gearling', scale: 0.42, from: 'Gearwright Ottmar' },
  tiller: { name: 'Little Tiller', model: 'tiller', scale: 0.34, from: 'Old Rattletrap' },
  sentinel: { name: 'Pocket Sentinel', model: 'sentinel', scale: 0.26, from: 'Clatterhook' },
  driller: { name: 'Tiny Driller', model: 'driller', scale: 0.3, from: 'Sandsplitter' },
  sawyer: { name: 'Twig Sawyer', model: 'sawyer', scale: 0.28, from: 'Ironbark' },
  roller: { name: 'Tin Roller', model: 'arcroller', scale: 0.3, from: 'Sparkplug' },
};
for (const [k, P] of Object.entries(PETS)) ITEMS['pet_' + k] = { name: P.name, slot: 'use', icon: 'pet_' + k, q: 3, stack: 1, price: k === 'gearling' ? 1500 : 0, use: { pet: k }, desc: 'A clockwork companion, wound and ready. Use it to keep it: it will follow you wherever you go.' };
LOOT_TABLES.rare1.items.push(['pet_tiller', 0.35]);
LOOT_TABLES.rare2.items.push(['pet_sentinel', 0.35]);
LOOT_TABLES.rare3.items.push(['pet_driller', 0.35]);
LOOT_TABLES.rare4.items.push(['pet_sawyer', 0.35]);
LOOT_TABLES.rare5.items.push(['pet_roller', 0.35]);
VENDORS.wind = ['pet_gearling'];
NPCS.find((n) => n.id === 'n_gearwright').vendor = 'wind';

// ============================================================================ BOSS MECHANICS: helpers and beams
// adds: once below `at` health the boss calls `n` helpers; beam: a line of strikes toward a player
const ABX = (k, ...abs) => { MOBS[k].abilities = [...(MOBS[k].abilities || []), ...abs]; };
ABX('thresher', { kind: 'adds', at: 0.5, mob: 'tiller', n: 2, text: 'The Thresher\u2019s horn calls the tillers!' });
ABX('grandbore', { kind: 'beam', every: 13, len: 16, r: 1.6, delay: 1.8, dmg: 1.4, text: 'The Grand Bore lines up its drill!' });
ABX('colossus', { kind: 'adds', at: 0.4, mob: 'guardian', n: 2, text: 'The Colossus calls up its guardians!' });
ABX('forgemaster', { kind: 'adds', at: 0.5, mob: 'furnace', n: 2, text: 'The Forgemaster stokes two furnaces into life!' }, { kind: 'beam', every: 14, len: 18, r: 1.7, delay: 1.9, dmg: 1.5, text: 'A river of slag pours from the Forgemaster!' });
ABX('foreman', { kind: 'adds', at: 0.5, mob: 'furnace', n: 1, text: 'The Foreman calls for help from the furnace line!' });
ABX('thunderhead', { kind: 'adds', at: 0.6, mob: 'arcroller', n: 3, text: 'Rollers spill out of the charging bays!' }, { kind: 'beam', every: 10, len: 20, r: 1.7, delay: 1.7, dmg: 1.5, text: 'The Thunderhead fires an arc down the chamber!' });
ABX('stormengine', { kind: 'beam', every: 11, len: 18, r: 1.6, delay: 1.8, dmg: 1.4, text: 'The Stormengine fires a bolt across the field!' });
ABX('wforge', { kind: 'adds', at: 0.5, mob: 'sentinel', n: 3, text: 'Sentinels march out of the Forge\u2019s hold!' });
ABX('voss', { kind: 'adds', at: 0.5, mob: 'lineman', n: 2, text: 'Voss shouts for his linemen!' });

// ============================================================================ THE PROVING RING (repeatable trials in Sunmere)
export const ARENA = { x: 48, z: -24, r: 10 };
// the machines each trial draws on, by the challenger's level
export const ARENA_POOL = [[1, ['gearling', 'scrapper']], [5, ['tiller', 'driller']], [10, ['crawler', 'strider']], [15, ['sentinel', 'sawyer']], [20, ['arcroller', 'sentinel']]];
NPCS.push({ id: 'n_arena', name: 'Arena Master Torvin', title: 'The Proving Ring', look: 'warden', v: 1, x: 48, z: -11.6, ry: 0, arena: true,
  greet: 'Step into the ring and the machines come in waves, each one harder than the last. Fall, or walk out, and the trial is over. Every wave you clear pays.' });

// ============================================================================ ESCORT QUESTS
// The escort walks a road at your pace, cowers when attacked, and calls out the ambushes. If they fall, talk to the
// quest giver again and they set out once more.
export const ESCORTS = {
  hob: { name: 'Young Hob', look: 'villager', v: 1, hp: 380, path: [[86, 6], [80, 10], [70, 10], [56, 7.2], [42, 4.4], [30, 2.4], [17, 1], [11, 11], [-10, 11], [-16, 1], [-30, -1], [-35, -1.5]],
    ambush: { 2: [['gearling', 3]], 3: [['scrapper', 2]], 5: [['scrapper', 2], ['gearling', 1]] },
    lines: { 0: 'Father says the road to Sunmere is safe these days. Mostly.', 2: 'Gearlings! Out of the hedges!', 3: 'Scrap rollers, on the bridge road!', 5: 'More of them! We are nearly there!', 6: 'So this is Sunmere. It is bigger than Father said.', end: 'The forge! Thank you, I would never have made it alone.' } },
  sami: { name: 'Water-bearer Sami', look: 'villager', v: 2, hp: 1500, path: [[-40, 170], [-60, 178], [-80, 186], [-98, 191], [-116, 196], [-127, 196]],
    ambush: { 2: [['raider', 2]], 3: [['raider', 2], ['raiderArcher', 1]], 4: [['crawler', 2]] },
    lines: { 0: 'The scholar’s people have had no fresh water in three days. Stay close.', 2: 'Dustcloaks! They want the water!', 3: 'Again! Do not let them near the skins!', 4: 'Crawlers in the sand!', end: 'Water for the ruins, and not a skin spilled. Thank you, friend.' } },
};
Object.assign(QUESTS, {
  q_esc_hob: { name: 'The Road to Sunmere', giver: 'n_villager1', turnin: 'n_smith', lvl: 5, text: 'My nephew Hob is walking to Sunmere to start at the forge, and the road is crawling with gearlings since the tillers broke loose. Walk with him to Brannoc’s forge, will you? He will keep your pace.', goal: { escort: 'hob', n: 1 }, xp: 1100, gold: 50, rewards: ['r_hob_boots'], pre: 'q_scrap' },
  q_esc_sami: { name: 'Water for the Ruins', giver: 'n_captain', turnin: 'n_scholar', lvl: 13, text: 'The scholar\u2019s camp at the Sandsunk Ruins is out of water, and the Dustcloaks watch the road. Sami will carry the skins; you keep the raiders off him. Get him to the ruins.', goal: { escort: 'sami', n: 1 }, xp: 4600, gold: 110, rewards: ['r_sami_wrap'] },
});
NPCS.find((n) => n.id === 'n_villager1').quests.push('q_esc_hob');
NPCS.find((n) => n.id === 'n_captain').quests.push('q_esc_sami');
Object.assign(ITEMS, {
  r_hob_boots: gear('Hob\u2019s Spare Boots', 'feet', 2, 6),
  r_sami_wrap: gear('Water-bearer\u2019s Wrap', 'back', 3, 14, true),
});

// ============================================================================ DURABILITY
// Every death wears the gear you are wearing. Broken gear gives no stats until a merchant repairs it.
export const DUR_LOSS = 10;
export function repairCost(g) {
  const miss = 100 - (g?.dur ?? 100);
  return miss <= 0 ? 0 : Math.max(1, Math.round(((g.q ?? 1) * 6 + (g.ilvl || 1) * 3) * 2 * (miss / 100)));
}

// ============================================================================ DUELS
// A friendly bout between two players (or a player and one of the valley's adventurers): no one dies, the loser
// is left on 1 health, and no gear is worn.
export const DUEL = { range: 40, time: 120, countdown: 3, scale: 0.6 };
export const DUEL_YES = ['You are on. Fight well!', 'A friendly bout? Gladly.', 'Alright, show me what you have.', 'First to yield, no hard feelings.'];
export const DUEL_NO = ['Not now, friend. I am catching my breath.', 'Maybe later, I have machines to break.', 'Another time!'];

// ============================================================================ THE POST
// Caravan Masters carry letters between the hubs: send coin, one item and a note to any character, online or not.
export const POST = { cost: 30, max: 30, keepDays: 30 };

// ============================================================================ THE TRADING POST (fixed prices, no bidding)
// Work orders from the valley's folk change every two hours. Your own buy orders hold the coin in trust until the valley's
// adventurers (or other players) fill them; the goods arrive by post.
export const TRADE = {
  goods: { scrap: 1, cloth: 1, spring: 3, brassplate: 8, ironore: 9, cragwool: 20, capacitor: 21, tonic: 1, draught: 5, bread: 1 },
  period: 7200, orders: 5, fee: 0.05, maxOwn: 3, maxN: 20,
};
export const ORDER_FROM = [
  ['Brannoc Hale, the Sunmere smithy', 'sunmere', 1], ['Farmer Gil, Brightfield', 'sunmere', 1], ['Miller Joss, Sunmere Mill', 'sunmere', 1],
  ['Sutler Amir, Dunewatch', 'dunewatch', 1], ['Sergeant Brom, Foundry Watch', 'foundry', 8], ['Warden-Captain Edris, the Highreach', 'highreach', 20],
];
export const tradeFair = (id) => Math.round((ITEMS[id]?.price || 1) * 3 * 1.5);
NPCS.push({ id: 'n_factor', name: 'Factor Odo', title: 'Trading Post', look: 'villager', v: 2, x: -9.2, z: 39.6, ry: 1.57, trade: true,
  greet: 'Fixed prices and honest weights. The valley needs its junk turned into something useful; I just keep the ledger.' });

// ============================================================================ BAG UPGRADES
// the backpack starts at 30 slots (20 before v82: older saves gain the 10 on load, see BAG_V in sim.js)
export const BAG_BASE = 30;
export const BAG_V = 2;
Object.assign(ITEMS, {
  satchel1: { name: 'Canvas Satchel', slot: 'use', icon: 'satchel', q: 2, stack: 1, price: 120, lvl: 5, use: { bag: 34 }, desc: 'Use: your backpack holds 34 items from now on.' },
  satchel2: { name: 'Stitched Rucksack', slot: 'use', icon: 'satchel', q: 2, stack: 1, price: 500, lvl: 12, use: { bag: 38 }, desc: 'Use: your backpack holds 38 items from now on.' },
  satchel3: { name: 'Brass-Framed Pack', slot: 'use', icon: 'satchel', q: 3, stack: 1, price: 200, lvl: 20, use: { bag: 42 }, desc: 'Use: your backpack holds 42 items from now on. Stitched by Miller Joss from Cragborn wool.' },
});
VENDORS.factor = ['satchel1', 'satchel2'];
NPCS.find((n) => n.id === 'n_factor').vendor = 'factor';
{ const r = { id: 'rc_pack', station: 'cook', makes: 'satchel3', n: 1, needs: [['cragwool', 6], ['cloth', 12], ['brassplate', 4]], cost: 2500, lvl: 20 }; RECIPES.push(r); RECIPE_BY_ID[r.id] = r; }

// ============================================================================ RESTED XP
// Time away builds a rested pool (faster when you logged out by a Caravan Master); kills grant double XP until it is spent.
export const RESTED = { hubRate: 0.05, wildRate: 0.0125, cap: 1.5, hubR: 30 }; // fractions of a level per hour; cap in levels

// ============================================================================ HOMEWARD COMPASS
// Everyone carries one: stand still for a few seconds and it takes you back to the caravan stop you call home.
export const RECALL = { secs: 6, cooldown: 15 * 60 * 1000 };
// a second set of talents to switch to outside combat
export const LOADOUT_LEVEL = 10;

// ============================================================================ THE BOUNTY BOARD
// Each week the watch posts two open-country targets and two dungeon bosses; kill them, then report to the clerk.
export const BOUNTY = { rep: 150 };
NPCS.push({ id: 'n_muster', name: 'Muster-Sergeant Bram', title: 'Group Finder', look: 'warden', v: 0, x: -12.4, z: -12.6, ry: 0.9, muster: true,
  greet: 'Need a full company? I keep a list of every sword, bow and medic in Sunmere who wants work. Tell me where, and I will have them at the door.' });
// the Deadeye's trainer (v106): Oswin Harl keeps the watch range by the training dummies behind the Ranger lodge and sells
// the plain starter pistols. His quest chain ("The Powder Ledger", docs/ai/deadeye_plan.md section 3) comes in v107.
NPCS.push({ id: 'n_gunsmith', name: 'Oswin Harl', title: 'Gunsmith of the Watch', look: 'deadeye', v: 0, x: -39.5, z: -42.8, ry: 1.57, vendor: 'gunsmith', quests: [],
  greet: 'Powder dry, barrel clean, and never stand where you fired from. That is the whole of the craft. The rest is practice.' });
VENDORS.gunsmith = ['gs_flintlock', 'gs_pocket', 'tonic'];
Object.assign(ITEMS, {
  gs_flintlock: { name: 'Worn Flintlock', slot: 'weapon', wtype: 'pistol', classes: ['deadeye'], base: 'Flintlock Pistol', icon: 'w_pistol~0', q: 1, ilvl: 2, req: 1, stats: { power: 5, hp: 2 }, price: 3, desc: 'Plain iron, a little loose in the frame. It still fires where you point it.' },
  gs_pocket: { name: 'Pocket Flintlock', slot: 'offhand', otype: 'sidearm', classes: ['deadeye'], base: 'Pocket Flintlock', icon: 'o_sidearm~0', q: 1, ilvl: 2, req: 1, stats: { power: 3, hp: 2 }, price: 3, desc: 'A short barrel for the left hand, light enough to draw while running.' },
});
// "The Powder Ledger" (v107, docs/ai/deadeye_plan.md section 3): Oswin Harl's chain, open to every class; the pistols it
// pays out only a Deadeye can use. The quests themselves are in story.js (STORY_QUESTS); their people, objects, escorts,
// quest items and rewards are here. Ketil Brann, Harl's brother, bores barrels at the Ironcliff camp.
NPCS.push({ id: 'n_ketil', name: 'Ketil Brann', title: 'Barrel Borer', look: 'villager', v: 3, x: 173.6, z: -39.2, ry: 1.57, quests: [],
  greet: 'A barrel is only a hole with iron around it. The trick is keeping the hole straight for a whole arm’s length.' });
OBJECT_KINDS.rangeplate = { prompt: 'Fire at the practice plate', goal: 'Practice plates knocked down', done: 'knocked down' };
OBJECTS.push(...[-32, -30, -28, -26, -24, -22].map((x, i) => ({ id: 'o_plate' + (i + 1), kind: 'rangeplate', x, z: -44.2 + (i % 2) * 0.6, ry: 0 })));
ESCORTS.ketil = { name: 'Ketil Brann', look: 'villager', v: 3, hp: 900, path: [[213, -37.5], [207, -36], [201, -36], [195, -36], [189, -36], [183, -36], [178.5, -37.6], [174.6, -39]],
  ambush: { 2: [['driller', 2]], 4: [['hauler', 1], ['driller', 1]] },
  lines: { 0: 'You found me. The props gave way behind me and I have been sitting in the dark since. My leg will carry me, slowly.', 2: 'Drillers, coming down the cut! They follow the noise.', 4: 'A hauler on the ramp! Keep it off me and I can make the top.', 6: 'Daylight. I had nearly forgotten the colour of it.', end: 'Out, and the leg is only bruised. Come and see me at the camp when you have your breath.' } };
// Harl walks between his travelling rifling bench and the cart while the Dustcloaks try for his tools
ESCORTS.harlbench = { name: 'Oswin Harl', look: 'deadeye', v: 0, hp: 2600, path: [[-100.5, -113.5], [-105.5, -115.5], [-108.5, -111.5], [-104, -114], [-99.5, -112], [-105, -115.5], [-101.5, -113]],
  ambush: { 1: [['raider', 2]], 3: [['raider', 2], ['raiderArcher', 1]], 5: [['sawyer', 1], ['raiderArcher', 2]] },
  lines: { 0: 'The bench is set and the boring bar is cutting. Every Dustcloak in the hills heard the cart come in. Stay by me.', 1: 'Raiders, over the palisade! They want the tools!', 3: 'More of them, and a bowman with them. Keep them off the bench!', 5: 'A sawing engine with them! Break it before it reaches the cart!', end: 'The last barrel is rifled and not one tool is gone. I will pack up and go home before they think of trying again.' } };
Object.assign(ITEMS, {
  powdertin: { name: 'Sealed Powder Tin', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A square tin of blasting powder, the lid sealed with wax. Bone dry inside.' },
  pressvalve: { name: 'Pressure Valve', slot: 'quest', icon: 'spring', q: 1, stack: 20, desc: 'A brass valve body off a dig machine, still tight on its seat.' },
  boreblank: { name: 'Hardened Bore Blank', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A bar of hardened steel, drilled through, waiting to be rifled.' },
  r_pl_flint: { name: 'Range Flintlock', slot: 'weapon', wtype: 'pistol', classes: ['deadeye'], base: 'Flintlock Pistol', icon: 'w_pistol~0', q: 1, ilvl: 4, stats: { power: 7, hp: 3 }, desc: 'Harl hands one to every gunhand who knocks down all six plates.' },
  r_pl_pocket: { name: 'Range Pocket Flintlock', slot: 'offhand', otype: 'sidearm', classes: ['deadeye'], base: 'Pocket Flintlock', icon: 'o_sidearm~0', q: 1, ilvl: 4, stats: { power: 4, hp: 3 }, desc: 'The left-hand twin of the range pistol, with a shorter barrel.' },
  r_pl_flask: { ...gear('Harl’s Cartridge Box', 'trinket', 2, 9), icon: 't_trinket~1', fx: [['regen', 0.05]], power: 'Your energy refills 5% faster.', desc: 'A brass-bound box of paper cartridges, each one measured out by hand. It keeps powder dry, and the habit of measuring helps any trade.' },
  r_pl_snaplock: { ...gear('Ketil’s Snaplock', 'weapon', 2, 11, true), wtype: 'pistol', classes: ['deadeye'], base: 'Snaplock Pistol', icon: 'w_pistol~1', desc: 'Bored by Ketil Brann, straight for a whole arm’s length.' },
  r_pl_snapside: { name: 'Ketil’s Snaplock Sidearm', slot: 'offhand', otype: 'sidearm', classes: ['deadeye'], base: 'Snaplock Sidearm', icon: 'o_sidearm~1', q: 2, ilvl: 11, stats: { power: 10, hp: 5, crit: 2, dodge: 1 }, desc: 'The short twin of Ketil’s snaplock, for the left hand.' },
  r_pl_steam: { ...gear('Brasswind Steam Pistol', 'weapon', 3, 15, true), wtype: 'pistol', classes: ['deadeye'], base: 'Steam Pistol', icon: 'w_pistol~2', desc: 'Its little pressure tank is fed by a valve taken off a dig machine.' },
  r_pl_pressure: { name: 'Harl’s Pressure Sidearm', slot: 'offhand', otype: 'sidearm', classes: ['deadeye'], base: 'Pressure Sidearm', icon: 'o_sidearm~2', q: 3, ilvl: 18, stats: { power: 22, hp: 10, crit: 3, dodge: 2 }, desc: 'Rifled on the travelling bench at Foundry Watch, under a Dustcloak raid.' },
  r_pl_mark: { ...gear('Harl-Marked Pressure Pistol', 'weapon', 4, 45, true), wtype: 'pistol', classes: ['deadeye'], base: 'Pressure Pistol', icon: 'w_pistol~3', desc: 'Stamped on the frame with Oswin Harl’s mark: a plain square. He stamps only work he would carry himself.' },
});
LOOT_TABLES.quarry.items.push(['powdertin', 0.5]);
LOOT_TABLES.striders.items.push(['pressvalve', 0.45]);
NPCS.push({ id: 'n_home', name: 'Carpenter Idwal', title: 'Your Homestead', look: 'villager', v: 1, x: -27, z: 92.5, ry: -1.9, homeshop: true,
  greet: 'The Marshal gave you this plot for what you have done for the valley. Your trophies are already on their stands. Want anything else built?' });
NPCS.push({ id: 'n_bounty', name: 'Clerk Wendel', title: 'Bounty Board', look: 'villager', v: 0, x: -8.6, z: -15.4, ry: 0.4, bounty: true,
  greet: 'Every week the watch posts the machines and rogues it wants gone. Bring word of the deed and the reward is yours.' });

// ============================================================================ CRAFT SKILLS
// Each station has a skill from 0 to 100. A recipe teaches you while it is orange (under its skill + 10), yellow (+20)
// or green (+25); after that it is grey and teaches nothing.
export const PROF_NAME = { smith: 'Smithing', herbal: 'Herbcraft', cook: 'Cookery' };
export const PROF_MAX = 100;
for (const [id, sk] of Object.entries({ rc_whet: 0, rc_rivets: 10, rc_gloves: 25, rc_charm: 40, rc_boots: 55, rc_helm: 75, rc_cloak: 75, rc_tonic: 0, rc_draught: 10, rc_strong: 40, rc_stew: 0, rc_pack: 45 })) if (RECIPE_BY_ID[id]) RECIPE_BY_ID[id].skill = sk;
Object.assign(ITEMS, {
  oiledgears: { name: 'Gear Oil', slot: 'use', icon: 'flask', q: 1, stack: 10, price: 16, use: { buff: { name: 'Oiled', stat: 'haste', pct: 6, dur: 600, icon: 'flask' } }, desc: 'Your weapon moves 6% faster for 10 minutes.' },
  glowsalve: { name: 'Mosscap Salve', slot: 'use', icon: 'potion', q: 2, stack: 10, price: 22, use: { heal: 0.45, res: 0.3 }, desc: 'Restores 45% of your health and 30% of your energy.' },
  millerspie: { name: 'Miller\u2019s Pie', slot: 'use', icon: 'bread', q: 2, stack: 10, price: 24, use: { heal: 1, food: true, buff: { name: 'Hearty', stat: 'armor', pct: 5, dur: 900, icon: 'bread' } }, desc: 'Eat to recover fully, then take 5% less damage for 15 minutes.' },
  trailbread: { name: 'Trail Bread', slot: 'use', icon: 'bread', q: 1, stack: 20, price: 6, use: { heal: 0.8, food: true }, desc: 'Eat to recover 80% of your health.' },
});
for (const r of [
  { id: 'rc_oil', station: 'smith', makes: 'oiledgears', n: 2, needs: [['spring', 2], ['cloth', 2]], cost: 25, lvl: 4, skill: 15 },
  { id: 'rc_salve', station: 'herbal', makes: 'glowsalve', n: 2, needs: [['glowcap', 3], ['cloth', 2]], cost: 30, lvl: 8, skill: 20 },
  { id: 'rc_trail', station: 'cook', makes: 'trailbread', n: 3, needs: [['bread', 2], ['cloth', 1]], cost: 10, lvl: 1, skill: 15 },
  { id: 'rc_pie', station: 'cook', makes: 'millerspie', n: 2, needs: [['bread', 2], ['glowcap', 3], ['cragwool', 1]], cost: 60, lvl: 12, skill: 30 },
]) { RECIPES.push(r); RECIPE_BY_ID[r.id] = r; }
export const profColor = (skill, req) => (skill < req ? 'red' : skill < req + 10 ? 'orange' : skill < req + 20 ? 'yellow' : skill < req + 25 ? 'green' : 'grey');

// ============================================================================ TEMPEST DIFFICULTY
// A third setting for every dungeon, for level 25 players who have cleared it on Heroic: everything inside is level
// 25-27 and sturdier, each boss calls a storm surge, and the bosses can drop the Tempest-Forged set.
export const TEMPEST = { level: 25, hp: 1.35, surge: { kind: 'circles', every: 19, n: 3, r: 3.2, delay: 1.6, dmg: 1.3, text: 'The storm surges through the chamber!' } };
// Tempest modifiers: three each week from a fixed rotation (never random); both server and client work out the same week
TEMPEST.mods = {
  overclocked: { name: 'Overclocked', desc: 'Foes move 15% faster and strike 12% faster.' },
  plated: { name: 'Reinforced Plating', desc: 'Foes have 20% more health.' },
  heavy: { name: 'Heavy Hands', desc: 'Foes hit 15% harder.' },
  fuses: { name: 'Short Fuses', desc: 'Bosses and elites use their big attacks 25% more often.' },
  static: { name: 'Static Field', desc: 'Every 20 seconds, bosses and elites call a strike under each of their foes.' },
  boilers: { name: 'Volatile Boilers', desc: 'Fallen machines burst 1.5 seconds later: step out of the circle.' },
};
TEMPEST.weeks = [['overclocked', 'plated', 'static'], ['heavy', 'fuses', 'boilers'], ['overclocked', 'heavy', 'boilers'], ['plated', 'fuses', 'static'], ['overclocked', 'fuses', 'boilers'], ['plated', 'heavy', 'static']];
TEMPEST.static = { kind: 'circles', every: 20, n: 4, r: 2.6, delay: 1.8, dmg: 1.05, text: 'Static crackles across the floor!' };
export const weekNumber = (t = Date.now()) => Math.floor((t / 864e5 + 3) / 7);
export const tempestMods = (t = Date.now()) => TEMPEST.weeks[weekNumber(t) % TEMPEST.weeks.length];
SETS.tempest = { name: 'Tempest-Forged', pieces: ['set_tmp1', 'set_tmp2', 'set_tmp3', 'set_tmp4', 'set_tmp5'], bonus: { 2: [['dmg', 0.05]], 4: [['crit', 0.05], ['haste', 0.06]] } };
Object.assign(ITEMS, {
  set_tmp1: { name: 'Tempest-Forged Helm', slot: 'head', icon: 'head', q: 4, stats: { armor: 174, hp: 60, power: 20 }, ilvl: 27, set: 'tempest' },
  set_tmp2: { name: 'Tempest-Forged Pauldrons', slot: 'shoulders', icon: 'shoulders', q: 4, stats: { armor: 162, hp: 55, haste: 10 }, ilvl: 27, set: 'tempest' },
  set_tmp3: { name: 'Tempest-Forged Cuirass', slot: 'chest', icon: 'chest', q: 4, stats: { armor: 206, hp: 68, power: 22 }, ilvl: 27, set: 'tempest' },
  set_tmp4: { name: 'Tempest-Forged Legplates', slot: 'legs', icon: 'legs', q: 4, stats: { armor: 190, hp: 64, haste: 11 }, ilvl: 27, set: 'tempest' },
  set_tmp5: { name: 'Tempest-Forged Gauntlets', slot: 'hands', icon: 'hands', q: 4, stats: { armor: 152, hp: 50, power: 18 }, ilvl: 27, set: 'tempest' },
});

// ============================================================================ TRAINING DUMMIES
// Straw dummies by the ranger lodge and the Proving Ring: they never fight back or fall, and mend after a pause.
MOBS.dummy = { name: 'Training Dummy', model: 'dummy', lvl: [1, 1], hp: 250000, dmg: [0, 0], speed: 0, aggro: 0, range: 0, swing: 999, xp: 0, loot: 'dummy', radius: 0.45, dummy: true };
LOOT_TABLES.dummy = { gold: [0, 0], items: [], gear: 0 };
SPAWNS.push(...[[-34.2, -41.2], [-34.6, -44.6], [34, -26], [62, -22]].map(([x, z]) => ({ mob: 'dummy', x, z, r: 0, n: 1 })));

// ============================================================================ THE LOST LEDGER
// Twelve pages of Hollin Marsh's ledger, a clerk of the Old Foundry, hidden along the roads of the valley.
export const LEDGER = [
  { id: 'pg1', x: 22, z: -58, where: 'Sunmere Village', title: 'The First Delivery', text: 'Day one of the new ledger. Six tilling engines delivered to Sunmere, paid in grain and good iron. The farmers stared at them like weather. I told them the engines would never tire. I did not think then what else that meant.' },
  { id: 'pg2', x: 118, z: 30, where: 'Brightfield Farms', title: 'Brightfield\u2019s Harvest', text: 'Farmer Gil brought in twice the wheat this autumn. He wrote to thank the Foundry and asked whether the engines could be taught to stop at the fence line. I passed the letter upstairs. No answer came down.' },
  { id: 'pg3', x: -92, z: -64, where: 'The Greenwood', title: 'The Greenwood Order', text: 'An order for forty saw-arms for the Greenwood, signed by no one I know. The foreman says the timber is needed for the furnaces. The furnaces have never burned so hot.' },
  { id: 'pg4', x: 134, z: -130, where: 'Glimmer Glade', title: 'The Glade Lenses', text: 'The engineers took the glowing lenses from the glade to steady the striders\u2019 sight. It worked too well. The striders see in the dark now, and walk in it.' },
  { id: 'pg5', x: 176, z: -16, where: 'Ironcliff Quarry', title: 'Ironcliff', text: 'The quarry crews quit after the third rockfall. The drillers kept digging without them. Nobody gave the order. The ore still arrives at our gate, sorted and stacked.' },
  { id: 'pg6', x: -60, z: 190, where: 'Dunewatch Post', title: 'Water Rights', text: 'Dunewatch wrote again: the Dustcloaks raid the wells and the crawlers dig under the walls. They asked for engines to guard the water. The Foundry sent them a bill instead.' },
  { id: 'pg7', x: 150, z: 170, where: 'the Sunscar Expanse', title: 'Out in the Sunscar', text: 'Brasswind Dig found a machine buried in the sand, older than the Foundry itself. The diggers said its gears were warm. I struck the entry from the official ledger and kept it here.' },
  { id: 'pg8', x: -170, z: 186, where: 'the Sandsunk Ruins', title: 'The Vault Keeper', text: 'The Sandsunk Vault was sealed with a keeper engine inside to guard the archive. The engineer who built it left the valley that same week. Its orders were never written down.' },
  { id: 'pg9', x: -185, z: 55, where: 'Westfold Farmsteads', title: 'Westfold', text: 'Hadley bought the great harvesters. In the first month they brought in every field from Westfold to the river. In the second month they began to bring in the fences.' },
  { id: 'pg10', x: -187.9, z: -66.7, where: 'the Old Sawmill', title: 'The Sawmill Fire', text: 'The old sawmill burned tonight. The saw engines walked out of the smoke in a line, carrying timber, and went on to the Foundry as if nothing were wrong. Perhaps, to them, nothing was.' },
  { id: 'pg11', x: 32, z: -200, where: 'near Northwatch Keep', title: 'Northwatch', text: 'The watch has built a keep in the north and asked for my ledgers as evidence. I am sending copies. The originals I will hide along the roads, so that someone finds them even if the keep falls.' },
  { id: 'pg12', x: 130, z: -214, where: 'the Highreach', title: 'The Last Page', text: 'The storm engines on the plateau draw lightning into coils and hum all night. The Foundry no longer answers the bell. If you are reading this, the valley still has people in it. Keep it that way. \u2014 Hollin Marsh, clerk' },
];
OBJECT_KINDS.page = { prompt: 'Pick up the ledger page', goal: 'Ledger pages found', done: 'found' };
OBJECTS.push(...LEDGER.map((L) => ({ id: L.id, kind: 'page', x: L.x, z: L.z, ry: (L.x * 7 + L.z * 3) % 6 })));

// ============================================================================ THE DUNE DREDGE (world boss of the Sunscar, level 16)
Object.assign(MOBS, {
  dredge: { name: 'The Dune Dredge', model: 'dredge', lvl: [16, 16], hp: 11000, dmg: [24, 36], speed: 2.6, aggro: 11, range: 5.5, swing: 2.8, xp: 5200, loot: 'dredge', radius: 3.2, elite: true, boss: true, world: true,
    notice: 'is churning along the desert road between Dunewatch and the Dustcloak Camp', yell: 'rumbles up out of the dunes!',
    abilities: [{ kind: 'circles', every: 8, n: 5, r: 3.4, delay: 1.9, dmg: 1.35, text: 'The Dune Dredge sprays scalding sand from its conveyor!' },
      { kind: 'nova', every: 16, r: 9, delay: 2.3, dmg: 1.7, text: 'The Dredge\u2019s augers throw up a wall of sand!' },
      { kind: 'adds', at: 0.5, mob: 'crawler', n: 3, text: 'Sand crawlers burrow out of the Dredge\u2019s hopper!' },
      { kind: 'enrage', at: 0.2, text: 'The Dredge\u2019s boiler screams!' }] },
});
SPAWNS.push({ mob: 'dredge', path: [[-20, 182], [0, 196], [30, 206], [56, 216], [80, 222], [104, 228]], r: 2, n: 1, world: true });
Object.assign(ITEMS, {
  r_dredgecore: gear('Dredge-Engine Governor', 'trinket', 4, 17, true),
  r_dredgetreads: gear('Sand-Tread Greaves', 'legs', 4, 17),
});
Object.assign(LOOT_TABLES, {
  dredge: { gold: [150, 250], items: [['r_dredgecore', 0.4], ['r_dredgetreads', 0.4], ['tonic', 1], ['brassplate', 1]], gear: 1, gearQ: 3, gearN: 2 },
});
MOBS.wforge.notice = 'is crawling the road between Foundry Watch and the Highreach'; MOBS.wforge.yell = 'rumbles out onto the north road!';

// ============================================================================ MORE WORLD EVENTS
WORLD_EVENTS.push(
  { id: 'poachers', name: 'Poachers in the Glade', every: [600, 960], radius: 150, target: [128, -126],
    path: [[176, -150], [160, -140], [144, -132], [130, -126]], mobs: [['poacher', 5, [6, 7]], ['rustguard', 3, [6, 7]]], xp: 1400, gold: 110,
    start: 'Poachers and their rusted engines are pushing into the glade toward Elder Moss!', win: 'The poachers are routed. The glade is quiet again.', lose: 'The poachers slip away into the trees.' },
  { id: 'drills', name: 'Runaway Drill Crew', every: [600, 960], radius: 150, target: [172, -30],
    path: [[206, -36], [196, -36], [186, -34], [174, -30]], mobs: [['driller', 5, [8, 9]], ['hauler', 2, [9, 9]]], xp: 2000, gold: 160,
    start: 'A drill crew is climbing out of the quarry pit and heading for Ironcliff Camp!', win: 'The drill crew is broken up. Quartermaster Holt sends his thanks.', lose: 'The drillers rumble back down into the pit.' },
  { id: 'harvest', name: 'Harvester Stampede', every: [600, 960], radius: 150, target: [-180, 26],
    path: [[-214, 58], [-202, 44], [-190, 32], [-180, 26]], mobs: [['harvester', 7, [6, 8]]], xp: 1300, gold: 100,
    start: 'Hadley\u2019s harvesters are stampeding toward the Westfold farmsteads!', win: 'The stampede is stopped. Old Hadley can breathe again.', lose: 'The harvesters wander off into the stubble.' },
  { id: 'timber', name: 'The Timber Train', every: [660, 1020], radius: 170, target: [-104, -96],
    path: [[-190, -62], [-150, -66], [-120, -72], [-104, -96]], mobs: [['sawyer', 4, [15, 16]], ['scavenger', 3, [15, 16]]], xp: 4600, gold: 330,
    start: 'A timber train of sawyers is marching out of the Old Sawmill on Foundry Watch!', win: 'The timber train is broken. Foundry Watch holds the road.', lose: 'The sawyers trundle back into the Rustwood.' },
);

// ============================================================================ GUILDS
// A guild is a name its members share. Players found one for 10 silver and invite other players or the valley's
// adventurers; recruited adventurers wear the tag and chat in guild chat while a member who recruited them is online.
export const GUILD = { cost: 1000, maxBots: 8 };
export const GUILD_LINES = ['Anyone heading to the Foundry Depths later? I could use a hand.', 'Found a ledger page out by the road. Odd reading.', 'The Dredge is out on the desert road again, if anyone wants a go.',
  'Repairs are getting dear. Mind your gear, all.', 'Good hunting today, everyone.', 'Who has spare springs? Factor Odo has an order up.', 'Heroic Warrens tonight? I will bring tonics.',
  'Just reached the Highreach. The wind up here never stops.', 'Remember to rest in town, it makes the next day go quicker.', 'That Proving Ring champion hits like a hammer.'];

// ============================================================================ THE CLERK'S TRAIL (after all twelve Lost Ledger pages)
OBJECT_KINDS.lockbox = { prompt: 'Open Hollin Marsh\u2019s lockbox', goal: 'Hollin Marsh\u2019s lockbox opened', done: 'opened' };
OBJECTS.push({ id: 'lockbox1', kind: 'lockbox', x: -95, z: -104.5, ry: 0.8 });
Object.assign(QUESTS, {
  q_clerk1: { name: 'The Clerk\u2019s Lockbox', giver: 'n_villager2', turnin: 'n_brom', lvl: 15, needLedger: 12, text: 'Hollin Marsh! I have not heard that name in years. He was a careful man; he would not have hidden his ledger without hiding something else. He kept a lockbox in the yard at Foundry Watch, against the fence. Find it, and show what you find to Sergeant Brom.', goal: { use: 'lockbox', n: 1 }, xp: 3200, gold: 120, rewards: [] },
  q_clerk2: { name: 'A Letter for the Highreach', giver: 'n_brom', turnin: 'n_hr_captain', lvl: 20, pre: 'q_clerk1', text: 'There is a sealed letter in the box, addressed to \u201cwhoever keeps the Highreach\u201d. That would be Warden-Captain Edris at the lookout. Carry it up the cliff road, and mind the storms.', goal: { reach: 'lookout' }, xp: 4200, gold: 140, rewards: [] },
  q_clerk3: { name: 'The Foundry Answers', giver: 'n_hr_captain', turnin: 'n_hr_captain', lvl: 20, pre: 'q_clerk2', text: 'Marsh writes that the Foundry\u2019s master engine still runs, deep under the Old Foundry, and that every machine in the valley still takes its orders from it. He calls it the Forgemaster. If he is right, ending it will not save the valley, but it will stop the orders. Go down into the Foundry Depths and end it.', goal: { kill: 'forgemaster', n: 1 }, xp: 7000, gold: 300, rewards: ['r_marsh_ledger'], ach: true },
});
NPCS.find((n) => n.id === 'n_villager2').quests = [...(NPCS.find((n) => n.id === 'n_villager2').quests || []), 'q_clerk1'];
NPCS.find((n) => n.id === 'n_brom').quests.push('q_clerk2');
NPCS.find((n) => n.id === 'n_hr_captain').quests.push('q_clerk3');
ITEMS.r_marsh_ledger = { name: 'Hollin Marsh\u2019s Pocket Ledger', slot: 'trinket', icon: 'charm', q: 4, stats: { power: 30, hp: 22, haste: 8 }, ilvl: 22, desc: 'Every page in a careful hand. The last line reads: keep it that way.' };

// ============================================================================ THE BRASSWIND SHAFTS (dungeon, 11-13)
Object.assign(MOBS, {
  shaftdriller: { name: 'Shaft Driller', model: 'driller', lvl: [11, 12], hp: 300, dmg: [11, 18], speed: 3.4, aggro: 13, range: 2.6, swing: 2.0, xp: 190, loot: 'shafts', radius: 0.9 },
  shafthauler: { name: 'Shaft Hauler', model: 'driller', variant: 1, lvl: [12, 12], hp: 360, dmg: [12, 19], speed: 3.0, aggro: 11, range: 3.0, swing: 2.3, xp: 210, loot: 'shafts', radius: 1.1 },
  shaftcrawler: { name: 'Tunnel Crawler', model: 'crawler', lvl: [11, 12], hp: 290, dmg: [10, 16], speed: 3.8, aggro: 12, range: 2.8, swing: 2.1, xp: 185, loot: 'shafts', radius: 1.1 },
  shaftlooter: { name: 'Shaft Looter', model: 'raider', variant: 9, lvl: [11, 12], hp: 280, dmg: [11, 17], speed: 4.8, aggro: 13, range: 2.4, swing: 1.8, xp: 190, loot: 'shafts', radius: 0.5, humanoid: true },
  kasim: { name: 'Foreman Kasim', model: 'raider', variant: 6, lvl: [12, 12], hp: 1700, dmg: [15, 24], speed: 5.0, aggro: 13, range: 2.8, swing: 1.9, xp: 800, loot: 'shaftElite', radius: 0.6, humanoid: true, elite: true,
    abilities: [{ kind: 'nova', every: 13, r: 5, delay: 1.6, dmg: 1.4, text: 'Foreman Kasim slams his pick into the floor!' }] },
  sandauger: { name: 'The Sand Auger', model: 'borer', lvl: [12, 12], hp: 1600, dmg: [16, 25], speed: 3.0, aggro: 13, range: 3.2, swing: 2.2, xp: 800, loot: 'shaftElite', radius: 1.4, elite: true,
    abilities: [{ kind: 'circles', every: 12, n: 2, r: 3, delay: 1.7, dmg: 1.4, text: 'The Sand Auger sprays grit across the gallery!' }] },
  buried: { name: 'The Buried Engine', model: 'buried', lvl: [13, 13], hp: 27000, dmg: [24, 36], speed: 2.6, aggro: 16, range: 5.0, swing: 2.8, xp: 3200, loot: 'buried', radius: 2.7, elite: true, boss: true,
    abilities: [{ kind: 'circles', every: 10, n: 3, r: 3.2, delay: 1.8, dmg: 1.4, text: 'The Buried Engine vents scalding steam through the floor!' },
      { kind: 'nova', every: 16, r: 7, delay: 2.2, dmg: 1.6, text: 'The Buried Engine shudders and throws out a wave of grit!' },
      { kind: 'adds', at: 0.5, mob: 'shaftcrawler', n: 3, text: 'Tunnel crawlers pour out of the engine\u2019s pipes!' },
      { kind: 'enrage', at: 0.2, text: 'The Buried Engine\u2019s boiler glows white!' }] },
});
SPAWNS.push(
  ds('shafts', 'shaftlooter', 60, 70, 6, 3), ds('shafts', 'shaftdriller', 58, 66, 5, 1),
  ds('shafts', 'shaftdriller', 26, 64, 8, 3), ds('shafts', 'shafthauler', 22, 60, 5, 1),
  ds('shafts', 'shaftcrawler', 94, 62, 8, 3), ds('shafts', 'shafthauler', 98, 58, 5, 1),
  ds('shafts', 'shaftlooter', 28, 48, 3, 2), ds('shafts', 'shaftcrawler', 92, 48, 3, 2),
  ds('shafts', 'shaftdriller', 30, 34, 6, 2), ds('shafts', 'kasim', 30, 30, 1, 1),
  ds('shafts', 'shaftcrawler', 90, 34, 6, 2), ds('shafts', 'sandauger', 90, 30, 1, 1),
  ds('shafts', 'shaftlooter', 46, 24, 3, 2), ds('shafts', 'shafthauler', 74, 24, 3, 1),
  ds('shafts', 'buried', 60, 12, 1, 1),
);
SETS.shafts = { name: 'Shaftrunner Gear', pieces: ['set_shaft1', 'set_shaft2', 'set_shaft3', 'set_shaft4', 'set_shaft5'], bonus: { 2: [['haste', 0.05]], 4: [['dmg', 0.04], ['crit', 0.03]] } };
Object.assign(ITEMS, {
  set_shaft1: { name: 'Shaftrunner Hood', slot: 'head', icon: 'head', q: 3, stats: { armor: 104, hp: 32, power: 12 }, ilvl: 14, set: 'shafts' },
  set_shaft2: { name: 'Shaftrunner Mantle', slot: 'shoulders', icon: 'shoulders', q: 3, stats: { armor: 104, hp: 32, haste: 11 }, ilvl: 14, set: 'shafts' },
  set_shaft3: { name: 'Shaftrunner Jerkin', slot: 'chest', icon: 'chest', q: 3, stats: { armor: 104, hp: 32, power: 12 }, ilvl: 14, set: 'shafts' },
  set_shaft4: { name: 'Shaftrunner Breeches', slot: 'legs', icon: 'legs', q: 3, stats: { armor: 104, hp: 32, haste: 11 }, ilvl: 14, set: 'shafts' },
  set_shaft5: { name: 'Shaftrunner Boots', slot: 'feet', icon: 'feet', q: 3, stats: { armor: 104, hp: 32, power: 12 }, ilvl: 14, set: 'shafts' },
  r_buriedcore: gear('Governor of the Buried Engine', 'trinket', 4, 14, true),
  r_shaftlamp: gear('Halim\u2019s Shaft Lantern', 'offhand', 3, 13),
  r_shaftpick: gear('Kasim\u2019s Rock Pick', 'weapon', 3, 13),
});
Object.assign(LOOT_TABLES, {
  shafts: { gold: [3, 9], items: [['spring', 0.4], ['brassplate', 0.3], ['tonic', 0.15]], gear: 0.28 },
  shaftElite: { gold: [30, 60], items: [['tonic', 1], ['set_shaft1', 0.12], ['set_shaft2', 0.12], ['set_shaft5', 0.12]], gear: 1, gearQ: 3, gearN: 2 },
  buried: { gold: [120, 200], items: [['r_buriedcore', 0.4], ['set_shaft3', 0.2], ['set_shaft4', 0.2], ['draught', 1]], gear: 1, gearQ: 4, gearN: 3 },
});
Object.assign(QUESTS, {
  q_shafts1: { name: 'Down the Shafts', giver: 'n_surveyor', turnin: 'n_surveyor', lvl: 12, text: 'We broke through into the old engine works last week, and the works broke out at us. Drillers, crawlers, looters from the camps. Go down the new shaft north of the dig and thin out those drillers before they bring the roof in.', goal: { kill: 'shaftdriller', n: 8 }, xp: 2600, gold: 90, rewards: ['r_shaftlamp'] },
  q_shafts2: { name: 'Foreman Kasim', giver: 'n_surveyor', turnin: 'n_surveyor', lvl: 12, pre: 'q_shafts1', text: 'Kasim was my foreman. When we found the works he took half the crew and a cart of picks down the west gallery and never came back up. Now his looters strip everything that shines. Bring him to an end.', goal: { kill: 'kasim', n: 1 }, xp: 3000, gold: 110, rewards: ['r_shaftpick'] },
  q_shafts3: { name: 'The Buried Engine', giver: 'n_surveyor', turnin: 'n_surveyor', lvl: 13, pre: 'q_shafts2', text: 'At the bottom of the works sits the engine that dug them, and it is still running. Every machine in those shafts answers to it. Stop it, and the Dig is ours again.', goal: { kill: 'buried', n: 1 }, xp: 4200, gold: 160, rewards: [] },
});
NPCS.find((n) => n.id === 'n_surveyor').quests.push('q_shafts1', 'q_shafts2', 'q_shafts3');
FACTIONS.dunewatch.zones.push('shafts');

// ============================================================================ MORE OF THE HIGHREACH (21-23)
ESCORTS.ivo = { name: 'Runner Ivo', look: 'warden', v: 1, hp: 2600, path: [[112, -208], [124, -208], [140, -208], [156, -210], [168, -213], [178, -216]],
  ambush: { 2: [['arcroller', 2]], 3: [['marauder', 2], ['slinger', 1]], 5: [['arcroller', 3]] },
  lines: { 0: 'The Coilfields watch post has had no word for two days. I run, you keep the machines off me.', 2: 'Rollers! Off the road, quick!', 3: 'Cragborn, up on the rocks!', 4: 'Nearly at the post. Keep close.', 5: 'More rollers! The storm must be up again.', end: 'The post still stands. Tell the Captain the line holds.' } };
OBJECT_KINDS.ridgefire = { prompt: 'Light the signal fire', goal: 'Ridge signal fires lit', done: 'lit' };
OBJECT_KINDS.warbanner = { prompt: 'Tear down the war banner', goal: 'Cragborn war banners torn down', done: 'torn down' };
OBJECTS.push(
  { id: 'o_ridge1', kind: 'ridgefire', x: 124, z: -228, ry: 0 }, { id: 'o_ridge2', kind: 'ridgefire', x: 98, z: -224, ry: 0 }, { id: 'o_ridge3', kind: 'ridgefire', x: 136, z: -194, ry: 0 },
  { id: 'o_wban1', kind: 'warbanner', x: 146.8, z: -225.2, ry: 0.4 }, { id: 'o_wban2', kind: 'warbanner', x: 154, z: -236, ry: 2.1 }, { id: 'o_wban3', kind: 'warbanner', x: 147.5, z: -239, ry: -0.8 },
);
ITEMS.stormglass = { name: 'Shard of Storm-Glass', slot: 'quest', icon: 'ring', q: 1, stack: 20 };
LOOT_TABLES.storm.items.push(['stormglass', 0.45]);
Object.assign(ITEMS, {
  r_hr_runner: gear('Signal Runner\u2019s Boots', 'feet', 3, 21),
  r_hr_firecloak: gear('Ridgefire Cloak', 'back', 3, 22, true),
  r_hr_glasscharm: gear('Storm-Glass Keepsake', 'trinket', 3, 22),
  r_hr_breaker: gear('Banner-Breaker Gauntlets', 'hands', 3, 23),
});
Object.assign(QUESTS, {
  q_hr_ivo: { name: 'The Signal Runner', giver: 'n_hr_qm', turnin: 'n_hr_captain', lvl: 21, pre: 'q_hr_rollers', text: 'Runner Ivo carries the watch orders out to our post at the edge of the Coilfields. Nothing has come back from there for two days, and the rollers are thick on that road. Keep him alive until he reaches the post, then report to the Captain.', goal: { escort: 'ivo', n: 1 }, xp: 6000, gold: 120, rewards: ['r_hr_runner'] },
  q_hr_fires: { name: 'Fires on the Ridge', giver: 'n_hr_qm', turnin: 'n_hr_qm', lvl: 22, pre: 'q_hr_rollers', text: 'There are three signal fires on the ridge around the lookout, one toward the Cragborn camp, one west on the cliff and one north above the falls. When they burn, the valley below knows the Wardens still hold. Light all three.', goal: { use: 'ridgefire', n: 3 }, xp: 5800, gold: 110, rewards: ['r_hr_firecloak'] },
  q_hr_glass: { name: 'Storm-Glass', giver: 'n_hr_engineer', turnin: 'n_hr_engineer', lvl: 22, pre: 'q_hr_wire', text: 'Where lightning strikes the sand in the Coilfields it leaves shards of storm-glass, and the rollers and pylons hoard them. Bring me eight; I think they are how the machines store their charge.', goal: { item: 'stormglass', n: 8 }, xp: 6200, gold: 120, rewards: ['r_hr_glasscharm'] },
  q_hr_banners: { name: 'Down with the Banners', giver: 'n_hr_captain', turnin: 'n_hr_captain', lvl: 23, pre: 'q_hr_crag', text: 'The Cragborn hang war banners over their camp to tell the hill clans they are winning. Three of them, around the fire pit. Pull them down, and let the hills see the cloth in the mud.', goal: { use: 'warbanner', n: 3 }, xp: 6600, gold: 140, rewards: ['r_hr_breaker'] },
});
NPCS.find((n) => n.id === 'n_hr_qm').quests.push('q_hr_ivo', 'q_hr_fires');
NPCS.find((n) => n.id === 'n_hr_engineer').quests.push('q_hr_glass');
NPCS.find((n) => n.id === 'n_hr_captain').quests.push('q_hr_banners');

// ============================================================================ LEGENDARY WEAPONS
// One for every weapon type, each with a power of its own. They drop from Tempest bosses, world bosses and (rarely) Heroic bosses.
const LEG = (name, wtype, classes, stats, fx, power, desc) => ({ name, slot: 'weapon', wtype, classes, icon: `leg_${wtype}`, q: 5, ilvl: 27, req: 25, stats, fx, power, desc });
Object.assign(ITEMS, {
  leg_sword: LEG('Keeper of the Valley', 'sword', ['knight'], { power: 98, hp: 34, crit: 4 }, [['dmg', 0.08], ['leech', 0.04]], 'Your strikes deal 8% more damage and heal you for 4% of the damage they deal.', 'Hollin Marsh wrote the last line. Someone forged it into steel.'),
  leg_axe: LEG('Halbrek\u2019s Splitter', 'axe', ['knight', 'warden'], { power: 98, hp: 34, haste: 5 }, [['crit', 0.06], ['critDmg', 0.35]], '+6% critical strike chance, and your critical strikes deal 35% more damage.', 'The thane never once lost it in a fight.'),
  leg_mace: LEG('The Northwatch Bell', 'mace', ['knight', 'warden'], { power: 92, hp: 44, armor: 60 }, [['armor', 0.06], ['thorns', 0.15]], 'You take 6% less damage, and machines that strike you take 15% of it back.', 'It rang the alarm at the keep for forty years.'),
  leg_hammer: LEG('Forgemaster\u2019s Maul', 'hammer', ['warden'], { power: 100, hp: 38 }, [['aoe', 0.25], ['dmg', 0.05]], 'Your area attacks deal 25% more damage; all your damage is raised by 5%.', 'Still warm, deep inside.'),
  leg_bow: LEG('Gale-Strung Longbow', 'bow', ['ranger'], { power: 98, hp: 30, haste: 6 }, [['haste', 0.08], ['crit', 0.04]], '+8% haste and +4% critical strike chance.', 'Strung with wire taken from the Highreach coils.'),
  leg_rod: LEG('Thunderhead\u2019s Coil', 'rod', ['chemist'], { power: 100, hp: 30, crit: 3 }, [['dot', 0.25], ['cdr', 0.1]], 'Your damage over time is 25% stronger and your skills recover 10% faster.', 'It hums when a storm is near.'),
  leg_scimitar: LEG('Sandsplitter\u2019s Fang', 'scimitar', ['sandblade'], { power: 98, hp: 32, dodge: 4 }, [['execute', 0.3], ['speed', 0.06]], 'You deal 30% more damage to enemies below 35% health, and move 6% faster.', 'Cut from the great strider\u2019s foreleg.'),
  leg_pistol: LEG('Harl’s Long Barrel', 'pistol', ['deadeye'], { power: 98, hp: 32, crit: 4 }, [['speed', 0.05], ['crit', 0.05]], 'You move 5% faster and gain +5% critical strike chance.', 'Oswin Harl bored it himself, a finger longer than any pistol has a right to be.'),
  leg_staff: LEG('Heartwood of the Glade', 'staff', ['herbalist'], { power: 94, hp: 40, leech: 2 }, [['heal', 0.15], ['regen', 0.2]], 'Your heals are 15% stronger and your energy returns 20% faster.', 'The mosscaps grow on it, if you leave it in the shade.'),
});
export const LEGENDARIES = Object.keys(ITEMS).filter((k) => k.startsWith('leg_'));
// legendaries with a model of their own (client/assets/weapons.js LEG_MODEL)
ITEMS.leg_sword.model = 'keeper'; ITEMS.leg_axe.model = 'splitter'; ITEMS.leg_scimitar.model = 'fang';

// ============================================================================ THE DRAGONSLAYER SET (endgame legendaries)
// "Dragonslayer" is the set's name: forged to bring down the great war-engines, crimson and chipped white enamel over
// blackened steel, gold-edged, with heated seams. One piece per class, and the knight, sandblade and warden also carry
// the set's shield. Item level 80, above every other weapon in the game. Where they come from (shared/sim.js
// dragonslayerDrop): the Great Dam's Heart, the last boss of the hardest raid. On Heroic your first kill each week always
// gives a piece of your class's set (the one you lack first); on Normal it is a rare drop (DS_NORMAL_CHANCE). Collect your
// class's whole set for the achievement "Dragonslayer". The models are Tripo GLBs split into moving parts
// (client/assets/dragonslayer.js; model: 'ds_<class>_<piece>' in the look string).
{
  // (P14.5, 16 Nov: the weapons' power raised again by 15-20, so each stays above the Upper Cutting's and the Drain Adits'
  // Heroic weapons, up to 329 at item level 96; tools/tests/uppercuttingtest.mjs checks it)
  const DS = (name, slot, kind, classes, model, stats, fx, power, desc) => ({
    name, slot, classes, q: 5, ilvl: 80, req: 55, stats, fx, power, desc, model, icon: model, unique: true, dragonslayer: true,
    // the Deadeye's off-hand Sidearm is a pistol in the left fist, not a shield
    ...(slot === 'weapon' ? { wtype: kind } : kind === 'sidearm' ? { otype: 'sidearm', base: 'Pressure Sidearm' } : { otype: 'shield', base: kind }),
  });
  Object.assign(ITEMS, {
    ds_knight_sword: DS('Dragonslayer Greatblade', 'weapon', 'sword', ['knight'], 'ds_knight_sword', { power: 345, hp: 150, crit: 14 }, [['dmg', 0.1], ['leech', 0.05]],
      'Your strikes deal 10% more damage and heal you for 5% of the damage they deal.', 'Forged to bring down the great war-engines. Its edge plates part in battle, and the steel beneath runs red-hot.'),
    ds_knight_shield: DS('Dragonslayer Bulwark', 'offhand', 'Kite Shield', ['knight'], 'ds_knight_shield', { armor: 820, hp: 175, dodge: 18 }, [['armor', 0.05]],
      'You take 5% less damage.', 'Its wings slide back on their spine when the fighting starts. The engines that struck it are scrap.'),
    ds_ranger_bow: DS('Dragonslayer Longbow', 'weapon', 'bow', ['ranger'], 'ds_ranger_bow', { power: 345, hp: 140, haste: 14 }, [['haste', 0.1], ['crit', 0.05]],
      '+10% haste and +5% critical strike chance.', 'Its limb blades fan out at the draw. Made to put a shaft through an engine’s firebox from a hundred paces.'),
    ds_chemist_rod: DS('Dragonslayer Pressure Rod', 'weapon', 'rod', ['chemist'], 'ds_chemist_rod', { power: 350, hp: 140, crit: 12 }, [['dot', 0.3], ['cdr', 0.12]],
      'Your damage over time is 30% stronger and your skills recover 12% faster.', 'Its tanks run out on their pistons and its vent door drops open. Keep your face clear of the steam.'),
    ds_sandblade_scimitar: DS('Dragonslayer Scimitar', 'weapon', 'scimitar', ['sandblade'], 'ds_sandblade_scimitar', { power: 345, hp: 145, dodge: 12 }, [['execute', 0.35], ['speed', 0.06]],
      'You deal 35% more damage to enemies below 35% health, and move 6% faster.', 'The plates along its back lift in a fight, and the hot steel under them shows red.'),
    ds_sandblade_buckler: DS('Dragonslayer Buckler', 'offhand', 'Buckler', ['sandblade'], 'ds_sandblade_buckler', { armor: 520, hp: 150, power: 60, dodge: 16 }, [['crit', 0.03]],
      '+3% critical strike chance.', 'A square of enamelled steel on four sliding corners. Light enough to dance with.'),
    ds_warden_hammer: DS('Dragonslayer Maul', 'weapon', 'hammer', ['warden'], 'ds_warden_hammer', { power: 355, hp: 160 }, [['aoe', 0.3], ['dmg', 0.06]],
      'Your area attacks deal 30% more damage; all your damage is raised by 6%.', 'Its head opens like an engine block and the spike runs out on a ram. It was made for boilers, not for men.'),
    ds_warden_shield: DS('Dragonslayer Tower', 'offhand', 'Tower Shield', ['warden'], 'ds_warden_shield', { armor: 880, hp: 190, dodge: 14 }, [['thorns', 0.15]],
      'Machines that strike you take 15% of the damage back.', 'Its side plates run out on rails to cover the whole line. Still warm, deep inside.'),
    ds_herbalist_staff: DS('Dragonslayer Lantern Staff', 'weapon', 'staff', ['herbalist'], 'ds_herbalist_staff', { power: 340, hp: 165, haste: 10 }, [['heal', 0.18], ['regen', 0.25]],
      'Your heals are 18% stronger and your energy returns 25% faster.', 'A lantern on a steel staff. Its panels ease open a finger’s width when the fighting starts, and the coals inside burn red.'),
    ds_deadeye_pistol: DS('Dragonslayer Hand Cannon', 'weapon', 'pistol', ['deadeye'], 'ds_deadeye_pistol', { power: 335, hp: 140, crit: 12 }, [['dmg', 0.08], ['speed', 0.05]],
      'Your attacks deal 8% more damage, and you move 5% faster.', 'A square barrel as long as your forearm over a pressure tank. Its shroud rides forward and the hammer cocks back when the fighting starts.'),
    ds_deadeye_pistol_l: DS('Dragonslayer Sidearm', 'offhand', 'sidearm', ['deadeye'], 'ds_deadeye_pistol_l', { power: 95, hp: 120, crit: 10, dodge: 8 }, [['haste', 0.04]],
      '+4% haste.', 'The Hand Cannon’s twin for the left fist, a little shorter and darker in the enamel. Steam puffs from its tank between shots.'),
  });
}
// each class's set, in the order the pieces drop (the weapon first)
export const DRAGONSLAYER = {
  knight: ['ds_knight_sword', 'ds_knight_shield'], ranger: ['ds_ranger_bow'], chemist: ['ds_chemist_rod'],
  sandblade: ['ds_sandblade_scimitar', 'ds_sandblade_buckler'], warden: ['ds_warden_hammer', 'ds_warden_shield'], herbalist: ['ds_herbalist_staff'],
  deadeye: ['ds_deadeye_pistol', 'ds_deadeye_pistol_l'],
};
export const DS_BOSS = 'damheart'; // the Great Dam's Heart, the last boss of the Great Dam (the hardest raid)
export const DS_NORMAL_CHANCE = 0.05; // per player, per weekly Normal kill

// ============================================================================ THE DRAGONSLAYER ARMOUR (rarity_upgrade_plan D)
// Seven pieces for each class (head, shoulders, chest, hands, legs, feet, back) = 49 items (the Deadeye's seven since v107), item level 80, needs level 55,
// designed Legendary (q 5) and rolled on the 'ds' rarity table each time one drops; bound (dragonslayer: true), upgradeable
// +1..+10 like any Uncommon-or-better piece, and a duplicate salvages for War-Engine Cores (shared/items.js salvageYield
// opts.dupDs, by the 'ds_' id prefix). Each class's seven pieces form one set (SETS['dsa_<class>'], bonuses at 2/4/6).
// CONTRACT for the renderer (WP8) and the icon painter (WP6-icons):
//   id      'ds_<class>_<slot>', class one of knight warden ranger sandblade chemist herbalist deadeye; slot as above
//   dsa     '<class>' on the item (and on every dropped copy): marks the piece as Dragonslayer armour
//   weight  CLASS_WEIGHT: knight/warden plate, ranger/sandblade/deadeye mail, chemist/herbalist cloth (the cloak has none)
//   model   dsaModel(slot, class, weight) from shared/items.js: 'dsa_<class>_helm', 'dsa_<class>_pauldron',
//           'dsa_<weight>_chest', 'dsa_<weight>_gauntlet', 'dsa_<weight>_greave', 'dsa_<weight>_boot'; null for the
//           back (a procedural cloak in the Dragonslayer palette)
//   look    worn codes end '@ds' + the DSA_CODE letter (k w r s c h d): gr 'p6:9@dsk', sh 'plate:5@dsw', ck '5@dsh'
//           (shared/items.js lookTail / parseLook -> { ds: true, dsc: '<class>' })
//   art     the painted icon key 'ds_<class>_<slot>' = client/ui/icons/items/ds_<class>_<slot>.webp (added to the
//           ITEM_ICONS manifest like the weapons' ds_*.webp). Until those are painted, icon is the shared armour
//           placeholder; set DSA_ICONS_READY = true once all 42 files are installed and icon becomes art.
// Where they come from (shared/sim.js dsArmourDrop, per player, once per weekly lockout kill): each of the first three
// Great Dam bosses owns two slots (DSA_SOURCE), 20% on Heroic and 5% on Normal for one of its two pieces (the one you
// lack first); the Great Dam's Heart owns the cloak alone, and on Heroic always gives one piece of your class's armour you
// have never held (any slot, cloak included; a random piece once you hold them all), on Normal a 5% chance of the cloak.
// The achievement "Dragonslayer Armour" is the whole of your own class's seven pieces held at least once.
export const DSA_SLOTS = ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'back'];
export const DSA_SOURCE = { penstockengine: ['hands', 'feet'], icebreaker: ['shoulders', 'legs'], governor: ['head', 'chest'], damheart: ['back'] };
export const DSA_HEROIC_CHANCE = 0.2, DSA_NORMAL_CHANCE = 0.05; // the three slot bosses; the Heart: Heroic always, Normal DSA_NORMAL_CHANCE
export const DSA_ICONS_READY = true; // the 49 painted icons (the Deadeye's mail chest/hands/legs/feet/cloak share the Ranger's art: same models) (Codex, Nov 2026; sources art_src/icons/ds_<class>_<slot>.png)
export const DRAGONSLAYER_ARMOUR = {};
{
  const WT = { knight: 'plate', warden: 'plate', ranger: 'mail', sandblade: 'mail', chemist: 'cloth', herbalist: 'cloth', deadeye: 'mail' };
  const WORD = { knight: 'Vanguard', warden: 'Rampart', ranger: 'Longshot', sandblade: 'Dune', chemist: 'Pressure', herbalist: 'Lantern', deadeye: 'Powder' };
  const PIECE = {
    plate: { head: 'Helm', shoulders: 'Pauldrons', chest: 'Breastplate', hands: 'Gauntlets', legs: 'Legplates', feet: 'Sabatons', back: 'Cloak' },
    mail: { head: 'Helm', shoulders: 'Spaulders', chest: 'Hauberk', hands: 'Gauntlets', legs: 'Legguards', feet: 'Boots', back: 'Cloak' },
    cloth: { head: 'Hood', shoulders: 'Mantle', chest: 'Coat', hands: 'Gloves', legs: 'Leggings', feet: 'Boots', back: 'Cloak' },
  };
  // the stat budget: the Great Dam's named armour (item level 66-68, Epic) carried up to item level 80 and Legendary, the
  // same step the Dragonslayer weapons took over the Dam's weapons (about x1.43)
  // (P14.5, 16 Nov: armour raised by a tenth, 1090/980/1000 -> 1200/1080/1100, so each piece stays above Part Fourteen's
  // item level 90-94 raid and mark armour, as the weapons were raised)
  const BASE = { plate: { armor: 1200, hp: 290, power: 62 }, mail: { armor: 1080, hp: 285, power: 44 }, cloth: { armor: 1100, hp: 250, power: 78 } };
  // the class's second stat, per piece. Each point is 1% (sim.js recalc), so this stays small: seven pieces of it, then
  // rarity and +10 on top (up to about x1.45). Haste counts for half as much as crit or dodge (items.js AFFIX k).
  const SEC = { knight: ['crit', 3], warden: ['dodge', 2], ranger: ['crit', 3], sandblade: ['dodge', 3], chemist: ['crit', 3], herbalist: ['haste', 5], deadeye: ['crit', 3] };
  const MULT = { head: 1, shoulders: 0.92, chest: 1.08, hands: 0.88, legs: 1.04, feet: 0.88 };
  const DESC = {
    head: 'Closed all round and smooth, crimson enamel over blackened steel. There is nothing on it for an engine’s hook to catch.',
    shoulders: 'Broad, rounded plates that turn a falling blow aside. The white enamel is chipped where the engines struck.',
    chest: 'Built to take the full swing of a war-engine’s arm. Gold runs along every edge, and the seams still hold their heat.',
    hands: 'Jointed at every finger, so you can still work a buckle or a valve wheel with them on.',
    legs: 'Heavy at the knee and light behind it, for fighting on wet stone and loose ice.',
    feet: 'Hobnailed soles and steel toes. They kept their footing on the Great Dam’s flooded floors.',
    back: 'Heavy crimson wool with a gold-edged hem, cut long to keep the spray and the sparks off your back.',
  };
  // the cloth classes' pieces are leather and padded cloth, not steel
  const DESC_CLOTH = {
    head: 'Closed all round and smooth, crimson-lacquered leather over a light steel cap. There is nothing on it for an engine’s hook to catch.',
    shoulders: 'A padded mantle with rounded plates sewn in to turn a falling blow aside. The white enamel is chipped where the engines struck.',
    hands: 'Close-fitting leather gloves with gold-edged cuffs, so you can still work a buckle or a valve wheel with them on.',
  };
  // set bonuses, one set per class: 2 pieces for staying power, 4 for damage (or healing), 6 for the class's own work.
  // A little above the Maker's Regalia (the best five-piece set) at 4, since it takes six item-level-80 pieces for the rest.
  const BONUS = {
    knight: { 2: [['hp', 0.07], ['armor', 0.04]], 4: [['dmg', 0.08], ['crit', 0.04]], 6: [['dmg', 0.06], ['leech', 0.04]] },
    warden: { 2: [['hp', 0.08], ['armor', 0.04]], 4: [['dmg', 0.06], ['thorns', 0.1]], 6: [['aoe', 0.12], ['armor', 0.03]] },
    ranger: { 2: [['hp', 0.05], ['haste', 0.04]], 4: [['dmg', 0.07], ['crit', 0.04]], 6: [['haste', 0.04], ['crit', 0.02], ['dmg', 0.03]] },
    sandblade: { 2: [['hp', 0.05], ['dodge', 0.03]], 4: [['dmg', 0.07], ['speed', 0.04]], 6: [['execute', 0.2], ['crit', 0.03]] },
    chemist: { 2: [['hp', 0.05], ['crit', 0.03]], 4: [['dmg', 0.07], ['dot', 0.15]], 6: [['cdr', 0.08], ['haste', 0.03]] },
    herbalist: { 2: [['hp', 0.06], ['regen', 0.1]], 4: [['heal', 0.1], ['haste', 0.04]], 6: [['heal', 0.08], ['dmg', 0.05], ['crit', 0.02]] },
    deadeye: { 2: [['hp', 0.05], ['dodge', 0.03]], 4: [['dmg', 0.07], ['crit', 0.04]], 6: [['speed', 0.04], ['haste', 0.03], ['dmg', 0.03]] },
  };
  for (const cls of Object.keys(WT)) {
    const wt = WT[cls], set = 'dsa_' + cls, [sk, sv] = SEC[cls], ids = [];
    for (const slot of DSA_SLOTS) {
      const id = `ds_${cls}_${slot}`;
      let stats;
      if (slot === 'back') stats = { armor: 490, hp: 170, power: 40, [sk]: sv };
      else { const k = MULT[slot]; stats = {}; for (const [s, v] of Object.entries(BASE[wt])) stats[s] = Math.round(v * k); stats[sk] = Math.round(sv * k); }
      const art = id;
      ITEMS[id] = { name: `Dragonslayer ${WORD[cls]} ${PIECE[wt][slot]}`, slot, classes: [cls], q: 5, ilvl: 80, req: 55, stats, desc: (wt === 'cloth' && DESC_CLOTH[slot]) || DESC[slot],
        unique: true, dragonslayer: true, dsa: cls, set, art, icon: DSA_ICONS_READY ? art : slot === 'back' ? 'a_back~3' : `a_${wt}_${slot}~3`,
        ...(slot === 'back' ? {} : { weight: wt }), model: dsaModel(slot, cls, wt) };
      ids.push(id);
    }
    DRAGONSLAYER_ARMOUR[cls] = ids;
    SETS[set] = { name: `Dragonslayer ${WORD[cls]} Armour`, pieces: ids, bonus: BONUS[cls], ds: true };
  }
}

// hand-made gear from before the loot overhaul: point its icons at the new painted art
{ const GEAR_ICON = { ring: 't_trinket~1', flask: 'o_bandolier~1', blade: 'w_sword~1', helm: 'a_plate_head~1', cloak: 'a_back~1' };
  for (const it of Object.values(ITEMS)) if (it.stats && GEAR_ICON[it.icon]) it.icon = GEAR_ICON[it.icon]; }

// ============================================================================ NAMED BOSS DROPS
// Every dungeon boss carries two pieces of its own: fixed names and stats, Rare or Epic, listed in the Valley Journal.
{
  const U = (name, slot, kind, q, ilvl, stats, desc) => {
    const w = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'].includes(kind) ? kind : null;
    const o = ['shield', 'quiver', 'bandolier', 'dagger', 'pouch', 'sidearm'].includes(kind) ? kind : null;
    const wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    const band = Math.min(3, Math.floor((ilvl - 1) / 6));
    const icon = w ? `w_${w}~${band}` : o ? `o_${o}~${band}` : slot === 'back' ? `a_back~${band}` : slot === 'trinket' ? `t_trinket~${band}` : `a_${wt}_${slot}~${band}`;
    const cls = w ? { sword: ['knight'], axe: ['knight', 'warden'], mace: ['knight', 'warden'], hammer: ['warden'], bow: ['ranger'], rod: ['chemist'], scimitar: ['sandblade'], staff: ['herbalist'], pistol: ['deadeye'] }[w] : o ? { shield: ['knight', 'warden'], quiver: ['ranger'], bandolier: ['chemist'], dagger: ['sandblade'], pouch: ['herbalist'], sidearm: ['deadeye'] }[o] : undefined;
    return { name, slot, q, ilvl, req: Math.max(1, ilvl - 2), icon, stats, desc, unique: true, ...(w ? { wtype: w } : {}), ...(o ? { otype: o, base: o === 'shield' ? 'Kite Shield' : o === 'sidearm' ? 'Pocket Flintlock' : o } : {}), ...(wt ? { weight: wt } : {}), ...(cls ? { classes: cls } : {}) };
  };
  const DROPS = {
    hollis: [U('Hollis\u2019s Ledger-Knife', 'offhand', 'dagger', 3, 6, { power: 9, hp: 4, crit: 2 }, 'Notched once for every sale.'), U('Fence\u2019s Fine Coat', 'chest', 'mail', 3, 6, { armor: 46, hp: 12, power: 4, dodge: 2 }, 'Somebody\u2019s best coat, once.')],
    thresher: [U('Threshing-Flail', 'weapon', 'mace', 4, 8, { power: 19, hp: 6, haste: 3 }, 'It still remembers the harvest.'), U('Chaff-Proof Greaves', 'legs', 'plate', 3, 8, { armor: 70, hp: 18, power: 3 }, 'Nothing gets through. Not even the dust.')],
    dregg: [U('Dregg\u2019s Overseer Cap', 'head', 'mail', 3, 10, { armor: 58, hp: 15, power: 6, crit: 2 }, 'Brim pulled low over a bad temper.'), U('Blasting Cord Bandolier', 'offhand', 'bandolier', 3, 10, { power: 12, hp: 8, haste: 3 }, 'Every pocket smells of powder.'), U('Shotfirer’s Pistol', 'weapon', 'pistol', 3, 10, { power: 17, hp: 6, crit: 2 }, 'Carried to set off the blasting charges. The grip is black with powder.')],
    borer: [U('Borer-Tooth Pick', 'weapon', 'axe', 3, 10, { power: 18, hp: 6, crit: 2 }, 'Cut from the borer\u2019s cutting head.'), U('Tunnel-Runner Boots', 'feet', 'mail', 3, 10, { armor: 52, hp: 14, haste: 3 }, 'Soled for loose stone.')],
    grandbore: [U('The Grand Auger', 'weapon', 'hammer', 4, 12, { power: 29, hp: 9, crit: 3 }, 'A spar of the Bore\u2019s own drill.'), U('Deep-Seam Cloak', 'back', 'cloth', 4, 12, { armor: 50, hp: 22, dodge: 3 }, 'Lined with the mine\u2019s cold.')],
    keeper: [U('Keeper\u2019s Archive Ward', 'offhand', 'shield', 3, 15, { armor: 120, hp: 28, power: 4 }, 'Marked with shelf numbers.'), U('Vault-Lamp Rod', 'weapon', 'rod', 3, 15, { power: 26, hp: 8, haste: 4 }, 'It lit the archive for a hundred years.')],
    rask: [U('Rask\u2019s Crown of Plunder', 'head', 'mail', 3, 15, { armor: 74, hp: 20, power: 8, crit: 3 }, 'Too many gems, all fake.'), U('Looter-King\u2019s Sabre', 'weapon', 'scimitar', 3, 15, { power: 26, hp: 8, dodge: 3 }, 'Taken from someone better.'), U('Caravan Guard’s Sidearm', 'offhand', 'sidearm', 3, 15, { power: 14, hp: 8, crit: 3 }, 'Taken off a caravan guard, and never cleaned since.')],
    colossus: [U('Colossus-Breaker', 'weapon', 'hammer', 4, 17, { power: 40, hp: 12, crit: 3 }, 'Forged from the Colossus\u2019s own knuckle.'), U('Sandsunk Bulwark', 'offhand', 'shield', 4, 17, { armor: 190, hp: 42, dodge: 3 }, 'It held the vault door shut.')],
    overseer: [U('Overseer\u2019s Gauge', 'trinket', 'trinket', 3, 20, { power: 22, hp: 14, haste: 4 }, 'The needle never rests.'), U('Furnace-Tender Gloves', 'hands', 'cloth', 3, 20, { armor: 46, hp: 18, power: 10, leech: 2 }, 'Singed, but whole.')],
    forgemaster: [U('Forgemaster\u2019s Ember-Staff', 'weapon', 'staff', 4, 22, { power: 52, hp: 16, haste: 5 }, 'Its tip never cools.'), U('Mantle of the Forge', 'shoulders', 'plate', 4, 22, { armor: 210, hp: 60, power: 12 }, 'Too hot to touch, too heavy to drop.')],
    capwarden: [U('Capacitor Ward', 'offhand', 'shield', 3, 26, { armor: 210, hp: 50, haste: 4 }, 'It crackles when struck.'), U('Warden-Coil Bracers', 'hands', 'plate', 3, 26, { armor: 160, hp: 46, power: 10 }, 'Wound with the warden\u2019s own wire.')],
    voss: [U('Voss\u2019s Schematics', 'trinket', 'trinket', 4, 26, { power: 40, hp: 22, crit: 4 }, 'Plans for things that should not be built.'), U('Chief Engineer\u2019s Longbow', 'weapon', 'bow', 4, 26, { power: 58, hp: 18, haste: 5 }, 'Strung with coil-wire.'), U('Chief Engineer’s Pressure Pistol', 'weapon', 'pistol', 4, 26, { power: 58, hp: 18, crit: 4 }, 'A test piece for a boiler valve. It fires harder than it should.')],
    thunderhead: [U('Eye of the Storm Coat', 'chest', 'cloth', 4, 27, { armor: 130, hp: 70, power: 26, dodge: 4 }, 'Calm at the centre.'), U('Thunderhead\u2019s Edge', 'weapon', 'sword', 4, 27, { power: 62, hp: 20, crit: 4 }, 'Struck by lightning, and better for it.')],
    kasim: [U('Kasim\u2019s Lantern Helm', 'head', 'mail', 3, 13, { armor: 66, hp: 18, power: 7 }, 'The lamp still works.'), U('Shift-Boss Gloves', 'hands', 'mail', 3, 13, { armor: 58, hp: 16, haste: 3 }, 'Worn smooth on a pick handle.')],
    sandauger: [U('Auger-Tooth Dagger', 'offhand', 'dagger', 3, 13, { power: 16, hp: 8, crit: 3 }, 'Ground from a drill tooth.'), U('Grit-Proof Leggings', 'legs', 'cloth', 3, 13, { armor: 44, hp: 18, power: 8 }, 'Sand gets in anyway.')],
    buried: [U('Buried Engine Piston', 'weapon', 'mace', 4, 15, { power: 36, hp: 11, haste: 4 }, 'Still moving, a little.'), U('Engine-Hall Spaulders', 'shoulders', 'mail', 4, 15, { armor: 140, hp: 36, power: 9 }, 'Riveted from the engine\u2019s housing.')],
  };
  for (const [mob, list] of Object.entries(DROPS)) {
    const tbl = LOOT_TABLES[MOBS[mob].loot];
    // each boss gets its own table so its pieces drop only from it
    const own = (LOOT_TABLES['u_' + mob] = { ...tbl, items: [...tbl.items] });
    MOBS[mob].loot = 'u_' + mob;
    // (the Deadeye's pistols keep the shared pistol and sidearm icons: they have no painting of their own)
    list.forEach((it, i) => { const id = `u_${mob}${i + 1}`; if (it.wtype !== 'pistol' && it.otype !== 'sidearm') it.icon = id; ITEMS[id] = it; own.items.push([id, MOBS[mob].boss ? 0.3 : 0.2]); });
  }
}

// ============================================================================ GEMS
Object.assign(ITEMS, Object.fromEntries(Object.entries(GEMS).map(([id, G]) => [id, { name: G.name, slot: 'use', icon: 'gem_' + G.color, q: 2, stack: 10, price: 60, use: { gem: id }, desc: `Socket into your gear: +${Object.entries(G.stats).map(([k, v]) => `${v}${['crit', 'haste', 'dodge'].includes(k) ? '%' : ''} ${{ power: 'Power', armor: 'Armour', hp: 'Stamina', crit: 'Critical Strike', haste: 'Haste', dodge: 'Dodge' }[k]}`).join(', ')}. Use it to fill the first empty socket on what you wear.` }])));
for (const r of [
  { id: 'rc_gem_ember', station: 'smith', makes: 'gem_ember', n: 1, needs: [['ironore', 3], ['scrap', 4]], cost: 150, lvl: 10, skill: 30 },
  { id: 'rc_gem_stone', station: 'smith', makes: 'gem_stone', n: 1, needs: [['ironore', 4], ['brassplate', 1]], cost: 150, lvl: 10, skill: 30 },
  { id: 'rc_gem_moss', station: 'smith', makes: 'gem_moss', n: 1, needs: [['glowcap', 4], ['ironore', 2]], cost: 150, lvl: 10, skill: 35 },
  { id: 'rc_gem_spring', station: 'smith', makes: 'gem_spring', n: 1, needs: [['spring', 6], ['brassplate', 2]], cost: 200, lvl: 14, skill: 45 },
  { id: 'rc_gem_dune', station: 'smith', makes: 'gem_dune', n: 1, needs: [['brassplate', 3], ['cloth', 4]], cost: 200, lvl: 14, skill: 45 },
  { id: 'rc_gem_storm', station: 'smith', makes: 'gem_storm', n: 1, needs: [['stormglass', 3], ['capacitor', 1]], cost: 400, lvl: 21, skill: 60 },
]) { RECIPES.push(r); RECIPE_BY_ID[r.id] = r; }
// elites sometimes carry a cut gem
for (const [k, T] of Object.entries(LOOT_TABLES)) if (/Elite|^rare|^u_/.test(k)) T.items.push([['gem_ember', 'gem_stone', 'gem_moss', 'gem_spring', 'gem_dune'][k.length % 5], 0.08]);

// ============================================================================ PART THREE: THE COILWAY (level 25)
// the flats at the foot of the north-west pass: the Highreach Wardens' Coilway Camp, and the Brass Concord's depot beyond it
CARAVANS.push({ id: 'coilway', name: 'Coilway Camp', x: -181, z: -185, zone: 'coilway' });
GRAVEYARDS.push({ x: -174, z: -172 });
NPCS.push(
  { id: 'n_cw_rennick', name: 'Scout-Captain Rennick', title: 'Coilway Camp', look: 'warden', v: 1, x: -181.5, z: -191, ry: 0.7, quests: [],
    greet: 'The wire runs on into the pass, and so do the carts. We watch both, and we count.' },
  { id: 'n_cw_oswin', name: 'Tinker Oswin', title: 'Concord Defector', look: 'chemist', v: 1, x: -187, z: -191.5, ry: -0.5, quests: [],
    greet: 'I kept their engines running for nine years. I know every bolt in that depot, and every lie in its ledgers.' },
  { id: 'n_cv_coilway', name: 'Caravan Master Ilyas', title: 'Caravans', look: 'villager', v: 1, x: -179.5, z: -184.5, ry: 2.6, caravan: 'coilway' },
);
FACTIONS.highreach.zones.push('coilway');

// ---- the Concord's people and engines in the Coilway (level 25-26), and what they carry
Object.assign(ITEMS, {
  concordseal: { name: 'Concord Seal', slot: 'quest', icon: 'ring_item', q: 1, stack: 20, desc: 'A brass seal stamped with a set of scales: the Concord\u2019s mark on every crate it buys.' },
  r_tallyring: { ...gear('Tallyman\u2019s Counting-Ring', 'trinket', 4, 26, true), desc: 'Every click is a sum.' },
});
Object.assign(MOBS, {
  enforcer: { name: 'Concord Enforcer', model: 'raider', variant: 18, lvl: [25, 26], hp: 600, dmg: [16, 25], speed: 5.2, aggro: 14, range: 2.4, swing: 1.7, xp: 360, loot: 'concord', radius: 0.5, humanoid: true },
  marksman: { name: 'Concord Marksman', model: 'raider', variant: 19, lvl: [25, 26], hp: 520, dmg: [14, 22], speed: 4.8, aggro: 19, range: 18, swing: 2.3, xp: 360, loot: 'concord', radius: 0.5, humanoid: true, ranged: 'arrow' },
  assessor: { name: 'Concord Assessor', model: 'sentinel', variant: 3, lvl: [25, 26], hp: 700, dmg: [18, 27], speed: 3.6, aggro: 13, range: 2.6, swing: 2.1, xp: 380, loot: 'concordMach', radius: 0.9 },
  loader: { name: 'Concord Loader', model: 'driller', variant: 2, lvl: [25, 26], hp: 760, dmg: [17, 26], speed: 3.4, aggro: 12, range: 2.8, swing: 2.2, xp: 380, loot: 'concordMach', radius: 1.0 },
  tallyman: { name: 'The Tallyman', model: 'tallyman', lvl: [26, 26], hp: 5600, dmg: [26, 40], speed: 3.8, aggro: 14, range: 3.4, swing: 2.0, xp: 2200, loot: 'rare6', radius: 1.6, elite: true, rare: true,
    abilities: [{ kind: 'circles', every: 11, n: 3, r: 3.2, delay: 1.8, dmg: 1.5, text: 'The Tallyman stamps its ledger-press!' }, { kind: 'enrage', at: 0.3, text: 'The Tallyman\u2019s gears grind faster!' }] },
});
Object.assign(LOOT_TABLES, {
  concord: { gold: [12, 22], items: [['concordseal', 0.5], ['draught', 0.15], ['tonic', 0.1]], gear: 0.32 },
  concordMach: { gold: [10, 18], items: [['concordseal', 0.3], ['brassplate', 0.3], ['draught', 0.12]], gear: 0.3 },
  rare6: { gold: [120, 200], items: [['r_tallyring', 1]], gear: 1, gearQ: 3 },
});
SPAWNS.push(
  { mob: 'enforcer', x: -224, z: -222, r: 10, n: 4 },
  { mob: 'enforcer', x: -206, z: -232, r: 8, n: 2 },
  { mob: 'marksman', x: -232, z: -214, r: 6, n: 2 },
  { mob: 'marksman', x: -214, z: -234, r: 6, n: 1 },
  { mob: 'assessor', x: -204, z: -222, r: 9, n: 3 },
  { mob: 'loader', x: -226, z: -232, r: 7, n: 2 },
  { mob: 'loader', x: -198, z: -212, r: 7, n: 2 },
  { mob: 'tallyman', path: [[-200, -206], [-214, -200], [-232, -208], [-238, -226], [-216, -238], [-202, -224]], r: 2, n: 1 },
);

// ---- Factor Corvane, the depot master (the Coil Road's last step), and the Coilway's rewards and side quests
Object.assign(MOBS, {
  corvane: { name: 'Factor Corvane', model: 'raider', variant: 20, lvl: [26, 26], hp: 6400, dmg: [28, 42], speed: 5.2, aggro: 15, range: 2.8, swing: 1.8, xp: 2600, loot: 'corvane', radius: 0.6, humanoid: true, elite: true,
    abilities: [{ kind: 'nova', every: 12, r: 5, delay: 1.7, dmg: 1.4, text: 'Factor Corvane calls in his debts!' }, { kind: 'adds', at: 0.5, mob: 'enforcer', n: 2, text: 'Corvane whistles for his enforcers!' }] },
});
LOOT_TABLES.corvane = { gold: [120, 180], items: [['concordseal', 1], ['draught', 1]], gear: 1, gearQ: 3, gearN: 2 };
SPAWNS.push({ mob: 'corvane', x: -229, z: -227, r: 2, n: 1 });
Object.assign(ITEMS, {
  r_cw_bracers: gear('Coilway Scout Bracers', 'hands', 3, 27),
  r_cw_hood: gear('Pass-Watcher\u2019s Hood', 'head', 3, 27),
  r_cw_sealring: gear('Ring of Broken Seals', 'trinket', 3, 27, true),
  r_cw_ledgerblade: gear('Ledger-Cutter', 'weapon', 3, 27),
  r_cw_plate: gear('Enamel-Plate Breastplate', 'chest', 3, 27),
  r_cw_clampmaul: gear('Clamp-Jaw Maul', 'weapon', 3, 27, true),
  r_cw_tallyaxe: gear('Corvane\u2019s Tally-Axe', 'weapon', 4, 28, true),
  r_cw_mantle: gear('Factor\u2019s Mantle', 'shoulders', 4, 28),
  r_cw_treads: gear('Loader-Tread Boots', 'feet', 3, 27),
  r_cw_longbow: gear('Marksman\u2019s Longbow', 'weapon', 3, 27, true),
  r_cw_abacus: gear('Tallyman\u2019s Abacus', 'trinket', 3, 27, true),
});
Object.assign(QUESTS, {
  q_cw_loaders: { name: 'Clamps and Cargo', giver: 'n_cw_rennick', turnin: 'n_cw_rennick', lvl: 25, pre: 'm_c8_road', text: 'The loaders carry whatever the assessors price straight up the pass. Six fewer loaders is six fewer crates gone from the valley.', goal: { kill: 'loader', n: 6 }, xp: 9000, gold: 180, rewards: ['r_cw_treads', 'r_cw_clampmaul'] },
  q_cw_marksmen: { name: 'Off the Watchtower', giver: 'n_cw_rennick', turnin: 'n_cw_rennick', lvl: 25, pre: 'm_c8_road', text: 'Their marksmen sit on the depot\u2019s tower and the crates and pick off my scouts. Bring six of them down.', goal: { kill: 'marksman', n: 6 }, xp: 9000, gold: 180, rewards: ['r_cw_longbow', 'r_cw_hood'] },
  q_cw_tallyman: { name: 'The Tallyman', giver: 'n_cw_oswin', turnin: 'n_cw_oswin', lvl: 25, pre: 'm_c8_road', text: 'There is a great assessor that walks the flats on its own, counting everything it passes. The Concord calls it the Tallyman. If it ever counts you, it does not stop. Break it if you meet it.', goal: { kill: 'tallyman', n: 1 }, xp: 12000, gold: 260, rewards: ['r_cw_abacus'] },
});
for (const [npc, qs] of [['n_cw_rennick', ['q_cw_loaders', 'q_cw_marksmen']], ['n_cw_oswin', ['q_cw_tallyman']]]) { const n = NPCS.find((x) => x.id === npc); n.quests = [...(n.quests || []), ...qs]; }
DAILY('d_concord', 'n_cw_rennick', 'Hold the Coil Road', 25, 'enforcer', 10, 'The Concord sends fresh enforcers down the pass every morning. Turn ten of them back and the road stays ours for one more day.');

// ============================================================================ PART FOUR (P4.2): THE FAR VALE (level 26-28)
// beyond the Brasswork Pass: the Wardens' Pass Watch at the top of the climb, and Ledgerholm, the Brass Concord's council town
CARAVANS.push({ id: 'passwatch', name: 'Pass Watch', x: -333, z: -313, zone: 'passwatch' });
GRAVEYARDS.push({ x: -346, z: -310 });
NPCS.push(
  { id: 'n_pw_halvard', name: 'Warden-Commander Halvard', title: 'Pass Watch', look: 'warden', v: 1, x: -339.5, z: -320.5, ry: 0.8, quests: [],
    greet: 'Snow on the brass and council fires across the vale. We hold the top of the pass, and we hold it together.' },
  { id: 'n_pw_idris', name: 'Surveyor Idris', title: 'Highreach Wardens', look: 'chemist', v: 1, x: -342.5, z: -315, ry: 2.2, quests: [],
    greet: 'I map what the snow lets me see. Ledgerholm is bigger than anyone in the valley believed.' },
  { id: 'n_cv_passwatch', name: 'Caravan Master Daud', title: 'Caravans', look: 'villager', v: 1, x: -332, z: -312, ry: 2.6, caravan: 'passwatch' },
);
FACTIONS.highreach.zones.push('passwatch', 'farside', 'nwpass', 'ledgerholm');
Object.assign(ITEMS, {
  councilwrit: { name: 'Council Writ', slot: 'quest', icon: 'cloth', q: 1, stack: 20, desc: 'An order from the Concord\u2019s council, sealed in brass wax: what to buy, what to take, and from whom.' },
  r_auditseal: { ...gear('Auditor\u2019s Seal', 'trinket', 4, 29, true), desc: 'It stamps a price on everything it touches.' },
});
Object.assign(MOBS, {
  valeguard: { name: 'Council Vale-Guard', model: 'raider', variant: 18, lvl: [26, 27], hp: 660, dmg: [17, 27], speed: 5.2, aggro: 14, range: 2.4, swing: 1.7, xp: 400, loot: 'council', radius: 0.5, humanoid: true },
  valebow: { name: 'Council Crossbowman', model: 'raider', variant: 19, lvl: [26, 27], hp: 560, dmg: [15, 24], speed: 4.8, aggro: 19, range: 18, swing: 2.3, xp: 400, loot: 'council', radius: 0.5, humanoid: true, ranged: 'arrow' },
  frosthauler: { name: 'Frost-Hauler', model: 'driller', variant: 2, lvl: [26, 27], hp: 820, dmg: [18, 28], speed: 3.4, aggro: 12, range: 2.8, swing: 2.2, xp: 420, loot: 'councilMach', radius: 1.0 },
  sentry: { name: 'Council Sentry', model: 'sentinel', variant: 3, lvl: [26, 27], hp: 760, dmg: [19, 29], speed: 3.6, aggro: 13, range: 2.6, swing: 2.1, xp: 420, loot: 'councilMach', radius: 0.9 },
  auditor: { name: 'The Auditor', model: 'tallyman', lvl: [28, 28], hp: 6600, dmg: [28, 42], speed: 3.8, aggro: 14, range: 3.4, swing: 2.0, xp: 2600, loot: 'rare7', radius: 1.6, elite: true, rare: true,
    abilities: [{ kind: 'circles', every: 11, n: 4, r: 3.2, delay: 1.8, dmg: 1.5, text: 'The Auditor stamps out its findings!' }, { kind: 'enrage', at: 0.3, text: 'The Auditor\u2019s gears grind faster!' }] },
  maddox: { name: 'Councillor Maddox', model: 'raider', variant: 21, lvl: [28, 28], hp: 7800, dmg: [30, 45], speed: 5.2, aggro: 15, range: 2.8, swing: 1.8, xp: 3000, loot: 'maddox', radius: 0.6, humanoid: true, elite: true,
    abilities: [{ kind: 'nova', every: 12, r: 5, delay: 1.7, dmg: 1.45, text: 'Councillor Maddox calls the vote!' }, { kind: 'adds', at: 0.5, mob: 'valeguard', n: 2, text: 'Maddox calls his vale-guards to the hall!' }] },
});
Object.assign(LOOT_TABLES, {
  council: { gold: [14, 24], items: [['councilwrit', 0.45], ['concordseal', 0.2], ['draught', 0.15]], gear: 0.34 },
  councilMach: { gold: [12, 20], items: [['councilwrit', 0.2], ['brassplate', 0.3], ['draught', 0.12]], gear: 0.32 },
  rare7: { gold: [140, 220], items: [['r_auditseal', 1]], gear: 1, gearQ: 3 },
  maddox: { gold: [140, 200], items: [['councilwrit', 1], ['draught', 1]], gear: 1, gearQ: 3, gearN: 2 },
});
SPAWNS.push(
  { mob: 'frosthauler', x: -352, z: -350, r: 9, n: 3 },
  { mob: 'frosthauler', x: -396, z: -352, r: 9, n: 2 },
  { mob: 'sentry', x: -398, z: -342, r: 10, n: 3 },
  { mob: 'sentry', x: -350, z: -396, r: 10, n: 3 },
  { mob: 'valeguard', x: -362, z: -364, r: 6, n: 3 },
  { mob: 'valeguard', x: -378, z: -378, r: 9, n: 4 },
  { mob: 'valebow', x: -372, z: -362, r: 5, n: 2 },
  { mob: 'valebow', x: -386, z: -372, r: 6, n: 2 },
  { mob: 'maddox', x: -382, z: -383, r: 2, n: 1 },
  { mob: 'auditor', path: [[-350, -340], [-378, -340], [-404, -356], [-404, -380], [-360, -404], [-344, -380]], r: 2, n: 1 },
);
Object.assign(ITEMS, {
  r_pw_greaves: gear('Snowline Greaves', 'legs', 3, 29),
  r_pw_blade: gear('Pass-Watch Blade', 'weapon', 3, 29),
  r_pw_gauntlets: gear('Frost-Hauler Gauntlets', 'hands', 3, 29),
  r_pw_hammer: gear('Drift-Breaker Hammer', 'weapon', 3, 29, true),
  r_pw_coat: gear('Surveyor\u2019s Snow-Coat', 'chest', 3, 29),
  r_pw_lens: gear('Survey Lens', 'trinket', 3, 29, true),
  r_pw_helm: gear('Helm of the Broken Council', 'head', 4, 30),
  r_pw_mantle: gear('Councillor\u2019s Mantle', 'shoulders', 4, 30, true),
});
Object.assign(ITEMS, {
  r_c11_bracers: gear('Gatebreaker Bracers', 'hands', 3, 29),
  r_c11_crossblade: gear('Palisade Cutter', 'weapon', 3, 29),
  r_c11_boots: gear('Snow-Packed Boots', 'feet', 3, 29),
  r_c11_charm: gear('Hauler\u2019s Lantern Keepsake', 'trinket', 3, 29, true),
  r_c12_greathelm: gear('Sentry-Breaker Helm', 'head', 4, 30),
  r_c12_edge: gear('Edge of the Vale', 'weapon', 4, 30, true),
});
Object.assign(ITEMS, {
  r_c12_crest: gear('Crest of the Free Valley', 'trinket', 4, 31, true),
  r_c12_warplate: gear('Pass-Holder’s Breastplate', 'chest', 4, 31),
});
Object.assign(QUESTS, {
  q_pw_guards: { name: 'A Foothold in the Snow', giver: 'n_pw_halvard', turnin: 'n_pw_halvard', lvl: 26, pre: 'm_c9_letter', text: 'The Concord\u2019s vale-guards patrol the road to Ledgerholm. Thin them out, eight of them, and the Pass Watch can breathe.', goal: { kill: 'valeguard', n: 8 }, xp: 10000, gold: 200, rewards: ['r_pw_greaves', 'r_pw_blade'] },
  q_pw_haulers: { name: 'Nothing Goes Down the Pass', giver: 'n_pw_halvard', turnin: 'n_pw_halvard', lvl: 26, pre: 'q_c10_climb', text: 'Frost-haulers drag the council\u2019s stores through the snow. Stop six of them before they reach the road down.', goal: { kill: 'frosthauler', n: 6 }, xp: 10000, gold: 200, rewards: ['r_pw_gauntlets', 'r_pw_hammer'] },
  q_pw_writs: { name: 'The Council\u2019s Orders', giver: 'n_pw_idris', turnin: 'n_pw_idris', lvl: 26, pre: 'm_c9_letter', text: 'Every guard in the vale carries a council writ. Bring me six and I will learn what they mean to do with the valley.', goal: { item: 'councilwrit', n: 6 }, xp: 10000, gold: 200, rewards: ['r_pw_coat', 'r_pw_lens'] },
  q_pw_auditor: { name: 'The Auditor', giver: 'n_pw_idris', turnin: 'n_pw_idris', lvl: 27, pre: 'q_c10_climb', text: 'The Tallyman had an elder: the Auditor walks the whole vale and checks every sum twice. It counted two of my surveyors. Break it.', goal: { kill: 'auditor', n: 1 }, xp: 13000, gold: 280, rewards: ['r_auditseal'] },
  q_pw_maddox: { name: 'The Councillor', giver: 'n_pw_halvard', turnin: 'n_pw_halvard', lvl: 27, pre: 'q_pw_guards', text: 'Councillor Maddox sits in the long hall of Ledgerholm and signs the orders that empty our valley. Go through the gate and end his sitting.', goal: { kill: 'maddox', n: 1 }, xp: 14000, gold: 320, rewards: ['r_pw_helm', 'r_pw_mantle'] },
});
for (const [npc, qs] of [['n_pw_halvard', ['q_pw_guards', 'q_pw_haulers', 'q_pw_maddox']], ['n_pw_idris', ['q_pw_writs', 'q_pw_auditor']]]) { const n = NPCS.find((x) => x.id === npc); n.quests = [...(n.quests || []), ...qs]; }
DAILY('d_vale', 'n_pw_halvard', 'Snow on the Sentries', 26, 'sentry', 10, 'The council keeps its sentries walking the vale day and night. Bring ten of them down and the road to the pass stays open.');

// ============================================================================ PART FIVE (P5.2): HARROWMOUTH, a free port on the Harrow Coast
CARAVANS.push({ id: 'harrowmouth', name: 'Harrowmouth', x: 380, z: 68, zone: 'harrowmouth' });
GRAVEYARDS.push({ x: 368, z: 92 });
Object.assign(ITEMS, {
  smokedfish: { name: 'Smoked Harrow Fish', slot: 'use', icon: 'bread', q: 1, stack: 20, use: { heal: 1.0, food: true }, price: 12, desc: 'Sit and eat to recover all your health. Salty.' },
  saltcake: { name: 'Salt-Crust Cake', slot: 'use', icon: 'bread', q: 1, stack: 20, use: { heal: 0.6, food: true }, price: 5, desc: 'Sit and eat to recover 60% health.' },
});
VENDORS.harbour = ['tonic', 'draught', 'smokedfish', 'saltcake', 'fishline'];
// fishing in the sea off the Harrow Coast (the salvage cast, with a line instead of a hook)
Object.assign(ITEMS, {
  fishline: { name: 'Harrow Fishing Line', slot: 'junk', icon: 'hammer', q: 1, stack: 1, price: 300, desc: 'A long line with a baited hook. Stand on the Harrowmouth pier or the beach and press F to cast it into the sea.' },
  harrowsardine: { name: 'Harrow Sardine', slot: 'use', icon: 'bread', q: 1, stack: 20, use: { heal: 0.6, food: true }, price: 6, desc: 'Sit and eat to recover 60% health. Best grilled on a beach fire.' },
  silverbass: { name: 'Silver Bass', slot: 'use', icon: 'bread', q: 1, stack: 20, use: { heal: 1.0, food: true }, price: 14, desc: 'Sit and eat to recover all your health.' },
  saltcrab: { name: 'Salt Crab', slot: 'junk', icon: 'cog', q: 1, stack: 20, price: 40, desc: 'Fishmonger Dawud pays well for these.' },
  driftwood: { name: 'Driftwood', slot: 'junk', icon: 'scrap', q: 0, stack: 20, price: 3, desc: 'Bleached grey by the sea.' },
  goldfin: { name: 'Goldfin', slot: 'junk', icon: 'ring_item', q: 3, stack: 20, price: 400, desc: 'A rare golden fish of the Harrow Coast. A collector\u2019s catch, worth a good price.' },
  pearlshell: { name: 'Pearl Shell', slot: 'junk', icon: 'ring_item', q: 3, stack: 20, price: 450, desc: 'A shell with a small pearl inside. Collectors and traders both want them.' },
  r_tidepearl: { ...gear('Tide Pearl', 'trinket', 4, 32, true), desc: 'Pulled from the sea off Harrowmouth. It is never quite dry.' },
});
NPCS.push(
  { id: 'n_hm_silas', name: 'Harbour-Captain Silas', title: 'Harrowmouth Watch', look: 'warden', v: 2, x: 389, z: 78, ry: -1.6, quests: [],
    greet: 'Harrowmouth answers to nobody, not the Guild and not the Concord. Some days that means we answer for ourselves alone.' },
  { id: 'n_hm_anwar', name: 'Ropemaker Anwar', title: 'The Rope-Walk', look: 'villager', v: 1, x: 371.2, z: 85, ry: 1.32, house: 'hm_2', spot: 0, vendor: 'general',
    greet: 'Every rope on this coast came off my walk. The Guild buys by the mile and pays by the inch.' },
  { id: 'n_hm_dawud', name: 'Fishmonger Dawud', title: 'Fish Market', look: 'villager', v: 2, x: 390.8, z: 92, ry: 3, house: 'hm_shop', spot: 0, vendor: 'harbour',
    greet: 'Smoked this morning, salted this afternoon, eaten by nightfall. Buy two.' },
  { id: 'n_cv_harrowmouth', name: 'Caravan Master Nabil', title: 'Caravans', look: 'villager', v: 0, x: 380, z: 66, ry: 0.4, caravan: 'harrowmouth' },
);
// Harrowmouth's own people: the free port keeps its own standing with those who help it (Harbour-Captain Silas is quartermaster)
FACTIONS.harrowmouth = { name: 'Harrowmouth', color: '#4ab8b0', zones: ['saltgap', 'harrowcoast', 'harrowmouth', 'guildyards'], qm: 'n_hm_silas' };
REP_SHOP.harrowmouth = [{ item: 'rep_c1', rank: 1, price: 9000 }, { item: 'rep_c2', rank: 2, price: 12000 }, { item: 'rep_c3', rank: 3, price: 15000 }, { item: 'rep_c4', rank: 4, price: 20000 }];
Object.assign(ITEMS, {
  rep_c1: { name: 'Harbour-Watch Sea Cloak', slot: 'back', icon: 'a_back~2', q: 3, stats: { armor: 150, hp: 52, haste: 9 }, ilvl: 32 },
  rep_c2: { name: 'Net-Weaver’s Bracers', slot: 'hands', icon: 'a_mail_hands~2', weight: 'mail', q: 3, stats: { armor: 190, hp: 58, power: 18 }, ilvl: 32 },
  rep_c3: { name: 'Tide-Warden’s Pauldrons', slot: 'shoulders', icon: 'a_plate_shoulders~3', weight: 'plate', q: 4, stats: { armor: 260, hp: 76, crit: 4 }, ilvl: 33 },
  rep_c4: { name: 'Harrowmouth Harpoon-Blade', slot: 'weapon', icon: 'w_sword~3', wtype: 'sword', q: 4, stats: { power: 132, haste: 14, hp: 30 }, ilvl: 34 },
});
PAINTS.tide = { name: 'Harbour Teal', body: '#2e7a7a', paint: true, trim: '#f0e6c8', metal: 'brass', seat: '#1e3a4a', need: { rep: 'harrowmouth', rank: 2 } };

// ---- P5.3 the Shipwrights' Guild on the Harrow Coast (level 28-30): its people, its engines, the Leviathan Hull
Object.assign(ITEMS, {
  guildrivet: { name: 'Guild Rivet', slot: 'quest', icon: 'gear', q: 1, stack: 20, desc: 'A copper rivet stamped with an anchor and the Guild\u2019s yard number.' },
  r_tidecore: { ...gear('Tidewright\u2019s Ballast Core', 'trinket', 4, 31, true), desc: 'It always knows which way is down.' },
});
Object.assign(MOBS, {
  riveter: { name: 'Guild Riveter', model: 'raider', variant: 23, lvl: [28, 29], hp: 740, dmg: [19, 29], speed: 5.2, aggro: 14, range: 2.4, swing: 1.7, xp: 440, loot: 'guild', radius: 0.5, humanoid: true },
  harpooneer: { name: 'Guild Harpooneer', model: 'raider', variant: 24, lvl: [28, 29], hp: 620, dmg: [17, 26], speed: 4.8, aggro: 19, range: 18, swing: 2.3, xp: 440, loot: 'guild', radius: 0.5, humanoid: true, ranged: 'arrow' },
  rivetengine: { name: 'Guild Rivet-Engine', model: 'sentinel', variant: 2, lvl: [28, 29], hp: 880, dmg: [20, 31], speed: 3.6, aggro: 13, range: 2.6, swing: 2.1, xp: 460, loot: 'guildMach', radius: 0.9 },
  tidecrawler: { name: 'Tide-Crawler', model: 'tidecrawler', lvl: [28, 29], hp: 820, dmg: [19, 30], speed: 3.9, aggro: 12, range: 2.8, swing: 2.1, xp: 450, loot: 'guildMach', radius: 1.1 },
  yardforeman: { name: 'Yard-Foreman Brask', model: 'raider', variant: 25, lvl: [30, 30], hp: 8400, dmg: [32, 47], speed: 5.2, aggro: 15, range: 2.8, swing: 1.8, xp: 3200, loot: 'yardforeman', radius: 0.6, humanoid: true, elite: true,
    abilities: [{ kind: 'nova', every: 12, r: 5, delay: 1.7, dmg: 1.45, text: 'Brask brings his riveting hammer down!' }, { kind: 'adds', at: 0.5, mob: 'riveter', n: 2, text: 'Brask whistles up his riveters!' }] },
  tidewright: { name: 'The Tidewright', model: 'tidewright', lvl: [30, 30], hp: 7200, dmg: [30, 44], speed: 3.8, aggro: 14, range: 3.4, swing: 2.0, xp: 2800, loot: 'rare8', radius: 1.6, elite: true, rare: true,
    abilities: [{ kind: 'beam', every: 10, len: 16, r: 2, delay: 1.6, dmg: 1.4, text: 'The Tidewright sprays seawater from its pumps!' }, { kind: 'enrage', at: 0.3, text: 'The Tidewright\u2019s pumps run dry and hot!' }] },
  leviathan: { name: 'The Leviathan Hull', model: 'leviathan', lvl: [30, 30], hp: 26000, dmg: [36, 52], speed: 2.4, aggro: 12, range: 6, swing: 2.8, xp: 9000, loot: 'leviathan', radius: 4.2, elite: true, boss: true, world: true,
    notice: 'is wading the shallows of the Harrow Coast between the Guild Yards and Harrowmouth', yell: 'heaves itself up out of the surf!',
    abilities: [{ kind: 'circles', every: 8, n: 6, r: 3.4, delay: 1.9, dmg: 1.35, text: 'The Leviathan Hull spills hot ballast across the sand!' },
      { kind: 'nova', every: 16, r: 10, delay: 2.3, dmg: 1.7, text: 'The Leviathan Hull vents its boilers into the surf!' },
      { kind: 'adds', at: 0.5, mob: 'tidecrawler', n: 3, text: 'Tide-crawlers scuttle out of the Hull\u2019s bilges!' },
      { kind: 'enrage', at: 0.2, text: 'The Leviathan Hull\u2019s boilers scream!' }] },
});
Object.assign(LOOT_TABLES, {
  guild: { gold: [16, 26], items: [['guildrivet', 0.45], ['draught', 0.15]], gear: 0.35 },
  guildMach: { gold: [14, 22], items: [['guildrivet', 0.25], ['brassplate', 0.3], ['draught', 0.12]], gear: 0.33 },
  rare8: { gold: [160, 240], items: [['r_tidecore', 1]], gear: 1, gearQ: 3 },
  yardforeman: { gold: [160, 220], items: [['guildrivet', 1], ['draught', 1]], gear: 1, gearQ: 3, gearN: 2 },
});
SPAWNS.push(
  { mob: 'riveter', x: 384, z: -50, r: 12, n: 5 },
  { mob: 'harpooneer', x: 394, z: -40, r: 6, n: 2 },
  { mob: 'harpooneer', x: 378, z: -64, r: 6, n: 2 },
  { mob: 'rivetengine', x: 370, z: -16, r: 9, n: 3 },
  { mob: 'rivetengine', x: 368, z: -90, r: 9, n: 3 },
  { mob: 'tidecrawler', x: 420, z: 0, r: 10, n: 3 },
  { mob: 'tidecrawler', x: 420, z: 130, r: 10, n: 3 },
  { mob: 'tidecrawler', x: 418, z: -100, r: 8, n: 2 },
  { mob: 'yardforeman', x: 386, z: -52, r: 2, n: 1 },
  { mob: 'tidewright', path: [[360, -100], [400, -110], [418, -70], [418, 20], [396, 40], [360, 10]], r: 2, n: 1 },
  { mob: 'leviathan', path: [[426, -110], [428, -60], [428, 0], [426, 50], [428, 120], [426, 170]], r: 2, n: 1, world: true },
);
Object.assign(ITEMS, {
  r_hm_boots: gear('Rope-Walker\u2019s Boots', 'feet', 3, 31),
  r_hm_hook: gear('Harbour-Watch Gaff', 'weapon', 3, 31, true),
  r_hm_gloves: gear('Net-Mender\u2019s Gloves', 'hands', 3, 31),
  r_hm_charm: gear('Salt-Glass Keepsake', 'trinket', 3, 31, true),
  r_hm_coat: gear('Quayside Coat', 'chest', 3, 31),
  r_hm_cleaver: gear('Fishmonger\u2019s Cleaver', 'weapon', 3, 31),
  r_hm_helm: gear('Yard-Breaker Helm', 'head', 4, 32),
  r_hm_mantle: gear('Foreman\u2019s Mantle', 'shoulders', 4, 32, true),
  r_leviathancore: gear('Leviathan Boiler-Heart', 'trinket', 4, 33, true),
  r_leviathanplate: gear('Hull-Plate Greaves', 'legs', 4, 33),
});
Object.assign(ITEMS, {
  r_c14_greaves: gear('Coast-Road Greaves', 'legs', 3, 32),
  r_c14_maul: gear('Rivet-Breaker Maul', 'weapon', 3, 32, true),
  r_c15_hood: gear('Dock-Watch Hood', 'head', 4, 33),
  r_c15_bow: gear('Harrowmouth Longbow', 'weapon', 4, 33, true),
});
Object.assign(ITEMS, {
  r_c15_anchor: gear('Harrowmouth Anchor-Keepsake', 'trinket', 4, 34, true),
  r_c15_greatcoat: gear('Watch-Captain\u2019s Greatcoat', 'chest', 4, 34),
});
LOOT_TABLES.leviathan = { gold: [300, 450], items: [['r_leviathancore', 0.35], ['r_leviathanplate', 0.35], ['tonic', 1], ['brassplate', 1]], gear: 1, gearQ: 4, gearN: 2 };
Object.assign(QUESTS, {
  q_hm_riveters: { name: 'Hammers on the Slipway', giver: 'n_hm_silas', turnin: 'n_hm_silas', lvl: 30, pre: 'm_c12_end', text: 'The Guild\u2019s riveters work all night and the hammering carries over the whole harbour. They also carry clubs for anyone who asks what they are building. Put eight of them down.', goal: { kill: 'riveter', n: 8 }, xp: 12000, gold: 240, rewards: ['r_hm_boots', 'r_hm_hook'] },
  q_hm_crawlers: { name: 'Nets in Ribbons', giver: 'n_hm_dawud', turnin: 'n_hm_dawud', lvl: 30, pre: 'm_c12_end', text: 'The Guild\u2019s tide-crawlers walk the shallows and cut every net they cross. Break six of them and the boats can fish again.', goal: { kill: 'tidecrawler', n: 6 }, xp: 12000, gold: 240, rewards: ['r_hm_gloves', 'r_hm_charm'] },
  q_hm_rivets: { name: 'Rivets by the Pound', giver: 'n_hm_anwar', turnin: 'n_hm_anwar', lvl: 30, pre: 'm_c12_end', text: 'The Guild pays me in promises and pays its own in rivets. Bring me eight Guild rivets and I will melt them into something honest.', goal: { item: 'guildrivet', n: 8 }, xp: 12000, gold: 240, rewards: ['r_hm_coat', 'r_hm_cleaver'] },
  q_hm_tidewright: { name: 'The Tidewright', giver: 'n_hm_silas', turnin: 'n_hm_silas', lvl: 30, pre: 'm_c12_end', text: 'The Guild built an engine to pump the water out of its slipways, and now it pumps the whole coast. It walks the beach on its own. If you see the Tidewright, stop it.', goal: { kill: 'tidewright', n: 1 }, xp: 15000, gold: 320, rewards: ['r_tidecore'] },
  q_hm_brask: { name: 'Yard-Foreman Brask', giver: 'n_hm_silas', turnin: 'n_hm_silas', lvl: 30, pre: 'q_hm_riveters', text: 'Brask runs the Guild Yards and the men in them. He has turned my watchmen back from the gate twice. Go through it and end his shift.', goal: { kill: 'yardforeman', n: 1 }, xp: 16000, gold: 360, rewards: ['r_hm_helm', 'r_hm_mantle'] },
});
for (const [npc, qs] of [['n_hm_silas', ['q_hm_riveters', 'q_hm_tidewright', 'q_hm_brask']], ['n_hm_dawud', ['q_hm_crawlers']], ['n_hm_anwar', ['q_hm_rivets']]]) { const n = NPCS.find((x) => x.id === npc); n.quests = [...(n.quests || []), ...qs]; }
DAILY('d_harrow', 'n_hm_silas', 'Silence the Rivet-Engines', 29, 'rivetengine', 10, 'The Guild\u2019s rivet-engines march up and down the coast road. Break ten of them and Harrowmouth gets a quiet day.');

// ============================================================================ PART SIX (P6.2): THE GLASS WASTE, the salt-miners' camp
CARAVANS.push({ id: 'saltcamp', name: 'Saltpan Camp', x: -34, z: 380, zone: 'saltcamp' });
GRAVEYARDS.push({ x: -52, z: 396 });
Object.assign(ITEMS, {
  saltwater: { name: 'Salt-Pan Water Skin', slot: 'use', icon: 'tonic', q: 1, stack: 20, use: { heal: 0.6, food: true }, price: 8, desc: 'Sit and drink to recover 60% health. Warm, but wet.' },
  datecake: { name: 'Date Cake', slot: 'use', icon: 'bread', q: 1, stack: 20, use: { heal: 1.0, food: true }, price: 16, desc: 'Sit and eat to recover all your health.' },
});
VENDORS.saltcamp = ['tonic', 'draught', 'saltwater', 'datecake'];
NPCS.push(
  { id: 'n_sc_jabir', name: 'Saltmaster Jabir', title: 'Saltpan Camp', look: 'warden', v: 2, x: -38, z: 383, ry: 1.2, quests: [],
    greet: 'We cut salt here for the whole valley, and have for three generations. The kilns across the pan are new. So is the glass in our water.' },
  { id: 'n_sc_hakon', name: 'Sledgewright Hakon', title: 'Sledges and Supplies', look: 'villager', v: 1, x: -46, z: 380, ry: 0.4, vendor: 'general',
    greet: 'Runners waxed, ropes new. Nothing crosses the pan faster than one of my sledges, except bad news.' },
  { id: 'n_sc_malik', name: 'Water-Seller Malik', title: 'Water and Food', look: 'villager', v: 0, x: -44, z: 391, ry: 2.6, vendor: 'saltcamp',
    greet: 'Water from the deep well, cakes from the oasis road. Drink before you are thirsty, out here.' },
  { id: 'n_cv_saltcamp', name: 'Caravan Master Yahya', title: 'Caravans', look: 'villager', v: 2, x: -32, z: 378, ry: 0.8, caravan: 'saltcamp' },
);
// the salt-miners of the Glass Waste keep their own standing (Saltmaster Jabir is quartermaster)
FACTIONS.saltpan = { name: 'Saltpan Miners', color: '#e8e2d0', zones: ['sunpass', 'glasswaste', 'saltcamp', 'kilnworks'], qm: 'n_sc_jabir' };
REP_SHOP.saltpan = [{ item: 'rep_m1', rank: 1, price: 12000 }, { item: 'rep_m2', rank: 2, price: 16000 }, { item: 'rep_m3', rank: 3, price: 20000 }, { item: 'rep_m4', rank: 4, price: 26000 }];
Object.assign(ITEMS, {
  rep_m1: { name: 'Salt-Wind Cloak', slot: 'back', icon: 'a_back~2', q: 3, stats: { armor: 180, hp: 62, haste: 11 }, ilvl: 38 },
  rep_m2: { name: 'Saltcutter’s Gloves', slot: 'hands', icon: 'a_cloth_hands~2', weight: 'cloth', q: 3, stats: { armor: 200, hp: 66, power: 22 }, ilvl: 38 },
  rep_m3: { name: 'Well-Keeper’s Pauldrons', slot: 'shoulders', icon: 'a_mail_shoulders~3', weight: 'mail', q: 4, stats: { armor: 300, hp: 88, crit: 5 }, ilvl: 39 },
  rep_m4: { name: 'Saltmaster’s Pick-Axe', slot: 'weapon', icon: 'w_axe~3', wtype: 'axe', q: 4, stats: { power: 150, haste: 16, hp: 36 }, ilvl: 40 },
});
PAINTS.salt = { name: 'Salt White', body: '#ece6d6', paint: true, trim: '#2a9a94', metal: 'copper', seat: '#7a5a3a', need: { rep: 'saltpan', rank: 2 } };

// ---- P6.3 the Glasswrights of Vitrea in the Glass Waste (level 31-35): kilnhands, sling-throwers, glass engines, the Furnace Strider
Object.assign(ITEMS, {
  glassshard: { name: 'Kiln Glass Shard', slot: 'quest', icon: 'gem_spring', q: 1, stack: 20, desc: 'A shard of teal glass, still warm. The Glasswrights pour it into every engine core they make.' },
  r_colossuslens: { ...gear('Colossus Lens', 'trinket', 4, 37, true), desc: 'Through it, everything looks further away than it is.' },
});
Object.assign(MOBS, {
  kilnhand: { name: 'Glasswright Kilnhand', model: 'raider', variant: 27, lvl: [31, 33], hp: 860, dmg: [22, 33], speed: 5.2, aggro: 14, range: 2.4, swing: 1.7, xp: 500, loot: 'glass', radius: 0.5, humanoid: true },
  glassslinger: { name: 'Glasswright Sling-Thrower', model: 'raider', variant: 28, lvl: [31, 33], hp: 720, dmg: [20, 30], speed: 4.8, aggro: 19, range: 18, swing: 2.3, xp: 500, loot: 'glass', radius: 0.5, humanoid: true, ranged: 'arrow' },
  glassengine: { name: 'Glass Sentinel', model: 'sentinel', variant: 5, lvl: [32, 34], hp: 1050, dmg: [24, 36], speed: 3.6, aggro: 13, range: 2.6, swing: 2.1, xp: 540, loot: 'glassMach', radius: 0.9 },
  skimmer: { name: 'Salt-Skimmer', model: 'crawler', lvl: [31, 33], hp: 900, dmg: [22, 34], speed: 4.2, aggro: 12, range: 2.8, swing: 2.1, xp: 520, loot: 'glassMach', radius: 1.1 },
  kilnmaster: { name: 'Kilnmaster Orlen', model: 'raider', variant: 29, lvl: [34, 34], hp: 9800, dmg: [36, 52], speed: 5.2, aggro: 15, range: 2.8, swing: 1.8, xp: 3600, loot: 'kilnmaster', radius: 0.6, humanoid: true, elite: true,
    abilities: [{ kind: 'nova', every: 12, r: 5, delay: 1.7, dmg: 1.45, text: 'Kilnmaster Orlen throws open a kiln door!' }, { kind: 'adds', at: 0.5, mob: 'kilnhand', n: 2, text: 'Orlen calls his kilnhands from the furnaces!' }] },
  glasscolossus: { name: 'The Glass Colossus', model: 'glasscolossus', lvl: [35, 35], hp: 8800, dmg: [34, 50], speed: 3.6, aggro: 14, range: 3.6, swing: 2.0, xp: 3200, loot: 'rare9', radius: 1.8, elite: true, rare: true,
    abilities: [{ kind: 'circles', every: 11, n: 4, r: 3.2, delay: 1.8, dmg: 1.5, text: 'The Glass Colossus shatters the ground into shards!' }, { kind: 'enrage', at: 0.3, text: 'The Glass Colossus glows white hot!' }] },
  furnacestrider: { name: 'The Furnace Strider', model: 'furnacestrider', lvl: [35, 35], hp: 32000, dmg: [40, 58], speed: 2.6, aggro: 12, range: 6, swing: 2.8, xp: 11000, loot: 'furnacestrider', radius: 3.8, elite: true, boss: true, world: true,
    notice: 'is striding across the Glass Waste between Saltpan Camp and the Kilnworks', yell: 'strides out of the heat haze!',
    abilities: [{ kind: 'circles', every: 8, n: 6, r: 3.4, delay: 1.9, dmg: 1.35, text: 'The Furnace Strider pours molten glass across the salt!' },
      { kind: 'nova', every: 16, r: 10, delay: 2.3, dmg: 1.7, text: 'The Furnace Strider vents its kiln-heart!' },
      { kind: 'adds', at: 0.5, mob: 'glassengine', n: 3, text: 'Glass sentinels step out of the Strider\u2019s furnace doors!' },
      { kind: 'enrage', at: 0.2, text: 'The Furnace Strider burns white!' }] },
});
Object.assign(LOOT_TABLES, {
  glass: { gold: [18, 30], items: [['glassshard', 0.45], ['draught', 0.15]], gear: 0.36 },
  glassMach: { gold: [16, 26], items: [['glassshard', 0.3], ['brassplate', 0.3], ['draught', 0.12]], gear: 0.34 },
  rare9: { gold: [180, 260], items: [['r_colossuslens', 1]], gear: 1, gearQ: 3 },
  kilnmaster: { gold: [180, 240], items: [['glassshard', 1], ['draught', 1]], gear: 1, gearQ: 3, gearN: 2 },
});
SPAWNS.push(
  { mob: 'kilnhand', x: 70, z: 412, r: 12, n: 5 },
  { mob: 'glassslinger', x: 60, z: 400, r: 6, n: 2 }, { mob: 'glassslinger', x: 82, z: 420, r: 6, n: 2 },
  { mob: 'glassengine', x: 30, z: 420, r: 10, n: 3 }, { mob: 'glassengine', x: 100, z: 380, r: 10, n: 3 },
  { mob: 'skimmer', x: -90, z: 400, r: 14, n: 3 }, { mob: 'skimmer', x: -130, z: 380, r: 10, n: 2 }, { mob: 'skimmer', x: 10, z: 440, r: 10, n: 3 },
  { mob: 'kilnmaster', x: 72, z: 414, r: 2, n: 1 },
  { mob: 'glasscolossus', path: [[-120, 425], [-60, 440], [0, 430], [40, 385], [20, 360], [-20, 420]], r: 2, n: 1 }, // kept 35 m+ off the Saltpan Camp givers
  { mob: 'furnacestrider', path: [[-150, 410], [-90, 380], [-20, 420], [40, 440], [110, 420], [120, 370]], r: 2, n: 1, world: true },
);
Object.assign(ITEMS, {
  r_sc_boots: gear('Salt-Crust Boots', 'feet', 3, 36),
  r_sc_pick: gear('Saltcutter\u2019s Pick', 'weapon', 3, 36, true),
  r_sc_wraps: gear('Glass-Handler\u2019s Wraps', 'hands', 3, 36),
  r_sc_charm: gear('Well-Water Keepsake', 'trinket', 3, 36, true),
  r_sc_robe: gear('Heat-Haze Coat', 'chest', 3, 36),
  r_sc_sling: gear('Skimmer-Plate Bow', 'weapon', 3, 36, true),
  r_sc_helm: gear('Kilnbreaker Helm', 'head', 4, 37),
  r_sc_mantle: gear('Kilnmaster\u2019s Mantle', 'shoulders', 4, 37, true),
  r_striderheart: gear('Strider\u2019s Kiln-Heart', 'trinket', 4, 38, true),
  r_striderplate: gear('Glass-Plate Greaves', 'legs', 4, 38),
});
Object.assign(ITEMS, {
  r_c17_greaves: gear('Glass-Road Greaves', 'legs', 3, 37),
  r_c17_glaive: gear('Sentinel-Breaker Maul', 'weapon', 3, 37, true),
  r_c18_hood: gear('Kiln-Yard Hood', 'head', 4, 38),
  r_c18_bow: gear('Saltpan Longbow', 'weapon', 4, 38, true),
});
Object.assign(ITEMS, {
  r_c18_crest: gear('Crest of the Free Waste', 'trinket', 4, 40, true),
  r_c18_mantle: gear('Saltmaster\u2019s Mantle', 'shoulders', 4, 40),
});
LOOT_TABLES.furnacestrider = { gold: [320, 480], items: [['r_striderheart', 0.35], ['r_striderplate', 0.35], ['tonic', 1], ['brassplate', 1]], gear: 1, gearQ: 4, gearN: 2 };
Object.assign(QUESTS, {
  q_sc_kilnhands: { name: 'Hands Off the Salt', giver: 'n_sc_jabir', turnin: 'n_sc_jabir', lvl: 31, pre: 'm_c15_end', text: 'The Glasswrights\u2019 kilnhands come over the pan at night and carry off our cut salt for their furnaces. Put eight of them down.', goal: { kill: 'kilnhand', n: 8 }, xp: 14000, gold: 280, rewards: ['r_sc_boots', 'r_sc_pick'] },
  q_sc_skimmers: { name: 'Skimmers on the Pan', giver: 'n_sc_malik', turnin: 'n_sc_malik', lvl: 31, pre: 'm_c15_end', text: 'Salt-skimmers race over the pan and drink our water barrels dry for their boilers. Break six of them.', goal: { kill: 'skimmer', n: 6 }, xp: 14000, gold: 280, rewards: ['r_sc_wraps', 'r_sc_charm'] },
  q_sc_shards: { name: 'Glass in the Well', giver: 'n_sc_hakon', turnin: 'n_sc_hakon', lvl: 32, pre: 'm_c15_end', text: 'Shards of kiln glass turn up in our well and cut our ropes to threads. Bring me eight of the shards the Glasswrights carry and I will show Jabir where they come from.', goal: { item: 'glassshard', n: 8 }, xp: 14000, gold: 280, rewards: ['r_sc_robe', 'r_sc_sling'] },
  q_sc_colossus: { name: 'The Glass Colossus', giver: 'n_sc_jabir', turnin: 'n_sc_jabir', lvl: 34, pre: 'q_c16_south', text: 'Something made all of glass walks the Waste on its own. The Glasswrights call it their Colossus. If you meet it, break it.', goal: { kill: 'glasscolossus', n: 1 }, xp: 17000, gold: 360, rewards: ['r_colossuslens'] },
  q_sc_orlen: { name: 'Kilnmaster Orlen', giver: 'n_sc_jabir', turnin: 'n_sc_jabir', lvl: 34, pre: 'q_sc_kilnhands', text: 'Kilnmaster Orlen runs the Kilnworks and decides whose salt goes into his furnaces. Go through his gate and put his fires out.', goal: { kill: 'kilnmaster', n: 1 }, xp: 18000, gold: 400, rewards: ['r_sc_helm', 'r_sc_mantle'] },
});
for (const [npc, qs] of [['n_sc_jabir', ['q_sc_kilnhands', 'q_sc_colossus', 'q_sc_orlen']], ['n_sc_malik', ['q_sc_skimmers']], ['n_sc_hakon', ['q_sc_shards']]]) { const n = NPCS.find((x) => x.id === npc); n.quests = [...(n.quests || []), ...qs]; }
DAILY('d_salt', 'n_sc_jabir', 'Glass Off the Pan', 32, 'glassengine', 10, 'Glass sentinels march out of the Kilnworks every morning. Break ten of them and the salt road stays open another day.');

// ============================================================================ PART SEVEN (P7.3): THE WILDWORKS, engines with no masters (level 34-35)
CARAVANS.push({ id: 'scrapwatch', name: 'Scrapway Watch', x: 316, z: -326, zone: 'scrapwatch' });
GRAVEYARDS.push({ x: 312, z: -338 });
NPCS.push(
  { id: 'n_wk_bastian', name: 'Warden-Captain Bastian', title: 'Scrapway Watch', look: 'warden', v: 1, x: 323, z: -332, ry: 0.8, quests: [],
    greet: 'They do not answer to anyone now, the engines. They just come here, the way water runs downhill. And something down there keeps mending them.' },
  { id: 'n_wk_rafiq', name: 'Scavenger Rafiq', title: 'Salvage and Supplies', look: 'villager', v: 2, x: 318, z: -334, ry: 0.2, vendor: 'general',
    greet: 'Every bolt in this basin used to belong to somebody. Now it belongs to whoever picks it up first.' },
  { id: 'n_cv_scrapwatch', name: 'Caravan Master Selim', title: 'Caravans', look: 'villager', v: 0, x: 316, z: -324, ry: 1.6, caravan: 'scrapwatch' },
);
FACTIONS.highreach.zones.push('scrapway', 'wildworks', 'scrapwatch');
Object.assign(ITEMS, {
  rustedgear: { name: 'Mended Gear', slot: 'quest', icon: 'gear', q: 1, stack: 20, desc: 'An old engine gear, cracked and then welded shut again. Somebody, or something, is repairing them.' },
  r_patchcore: { ...gear('Patchwork Core', 'trinket', 4, 40, true), desc: 'Welded together from six other cores. It still works.' },
});
Object.assign(MOBS, {
  feraltiller: { name: 'Feral Tiller', model: 'tiller', lvl: [34, 35], hp: 960, dmg: [24, 35], speed: 4.0, aggro: 12, range: 2.6, swing: 2.0, xp: 560, loot: 'feral', radius: 1.0 },
  feralsentinel: { name: 'Feral Sentinel', model: 'sentinel', variant: 1, lvl: [34, 35], hp: 1100, dmg: [26, 37], speed: 3.6, aggro: 13, range: 2.6, swing: 2.1, xp: 580, loot: 'feral', radius: 0.9 },
  feralborer: { name: 'Feral Borer', model: 'borer', lvl: [34, 35], hp: 1250, dmg: [27, 39], speed: 3.2, aggro: 12, range: 3.2, swing: 2.3, xp: 600, loot: 'feral', radius: 1.4 },
  scrapcrawler: { name: 'Scrap Crawler', model: 'crawler', lvl: [34, 35], hp: 980, dmg: [24, 36], speed: 4.2, aggro: 12, range: 2.8, swing: 2.1, xp: 570, loot: 'feral', radius: 1.1 },
  scrapforeman: { name: 'The Scrap Foreman', model: 'foreman', lvl: [35, 35], hp: 10800, dmg: [38, 54], speed: 3.4, aggro: 15, range: 3.4, swing: 2.0, xp: 3800, loot: 'scrapforeman', radius: 1.6, elite: true,
    abilities: [{ kind: 'circles', every: 11, n: 4, r: 3.2, delay: 1.8, dmg: 1.45, text: 'The Scrap Foreman drops a load of scrap!' }, { kind: 'adds', at: 0.5, mob: 'scrapcrawler', n: 2, text: 'Scrap crawlers pull themselves out of the heap!' }] },
  patchstrider: { name: 'The Patchwork Strider', model: 'strider', lvl: [35, 35], hp: 9200, dmg: [34, 50], speed: 4.4, aggro: 14, range: 3.0, swing: 1.8, xp: 3400, loot: 'rare10', radius: 1.6, elite: true, rare: true,
    abilities: [{ kind: 'beam', every: 10, len: 16, r: 2, delay: 1.5, dmg: 1.45, text: 'The Patchwork Strider charges on mismatched legs!' }, { kind: 'enrage', at: 0.3, text: 'The Patchwork Strider rattles itself to pieces, and keeps coming!' }] },
  scraptitan: { name: 'The Scrap Titan', model: 'scraptitan', lvl: [35, 35], hp: 36000, dmg: [42, 60], speed: 2.4, aggro: 12, range: 6, swing: 2.8, xp: 12000, loot: 'scraptitan', radius: 4.0, elite: true, boss: true, world: true,
    notice: 'is lumbering through the Wildworks, rebuilt from a dozen broken engines', yell: 'heaves itself up out of the scrap heaps!',
    abilities: [{ kind: 'circles', every: 8, n: 6, r: 3.4, delay: 1.9, dmg: 1.35, text: 'The Scrap Titan hurls scrap across the basin!' },
      { kind: 'nova', every: 16, r: 10, delay: 2.3, dmg: 1.7, text: 'The Scrap Titan\u2019s boilers burst!' },
      { kind: 'adds', at: 0.5, mob: 'scrapcrawler', n: 3, text: 'Scrap crawlers drop out of the Titan\u2019s chest!' },
      { kind: 'enrage', at: 0.2, text: 'The Scrap Titan tears loose its own plating!' }] },
});
Object.assign(LOOT_TABLES, {
  feral: { gold: [20, 32], items: [['rustedgear', 0.4], ['scrap', 0.3], ['draught', 0.12]], gear: 0.36 },
  rare10: { gold: [200, 280], items: [['r_patchcore', 1]], gear: 1, gearQ: 3 },
  scrapforeman: { gold: [200, 260], items: [['rustedgear', 1], ['draught', 1]], gear: 1, gearQ: 3, gearN: 2 },
});
SPAWNS.push(
  { mob: 'feraltiller', x: 350, z: -340, r: 12, n: 4 }, { mob: 'feraltiller', x: 410, z: -320, r: 10, n: 3 },
  { mob: 'feralsentinel', x: 380, z: -380, r: 12, n: 4 }, { mob: 'feralsentinel', x: 420, z: -360, r: 8, n: 2 },
  { mob: 'feralborer', x: 400, z: -400, r: 10, n: 3 }, { mob: 'feralborer', x: 340, z: -395, r: 9, n: 2 },
  { mob: 'scrapcrawler', x: 370, z: -330, r: 10, n: 3 }, { mob: 'scrapcrawler', x: 425, z: -395, r: 8, n: 2 },
  { mob: 'scrapforeman', x: 395, z: -370, r: 2, n: 1 },
  { mob: 'patchstrider', path: [[340, -330], [400, -320], [425, -360], [410, -400], [350, -400], [335, -365]], r: 2, n: 1 },
  { mob: 'scraptitan', path: [[345, -350], [380, -335], [420, -350], [415, -395], [370, -400], [340, -385]], r: 2, n: 1, world: true },
);
Object.assign(ITEMS, {
  r_wk_boots: gear('Scrap-Walker Boots', 'feet', 3, 38),
  r_wk_maul: gear('Wrecker\u2019s Maul', 'weapon', 3, 38),
  r_wk_gloves: gear('Rust-Proof Gloves', 'hands', 3, 38),
  r_wk_charm: gear('Mended-Gear Keepsake', 'trinket', 3, 38, true),
  r_wk_coat: gear('Salvager\u2019s Coat', 'chest', 3, 38),
  r_wk_bow: gear('Junkyard Longbow', 'weapon', 3, 38, true),
  r_wk_helm: gear('Foreman-Breaker Helm', 'head', 4, 39),
  r_wk_mantle: gear('Scrap-Plate Mantle', 'shoulders', 4, 39, true),
  r_titanheart: gear('Titan\u2019s Patched Heart', 'trinket', 4, 41, true),
  r_titanplate: gear('Titan-Plate Greaves', 'legs', 4, 41),
});
Object.assign(ITEMS, {
  r_c20_greaves: gear('Pit-Walker Greaves', 'legs', 3, 40),
  r_c20_maul: gear('Borer-Breaker Maul', 'weapon', 3, 40, true),
  r_c21_hood: gear('Shaft-Watch Hood', 'head', 4, 41),
  r_c21_bow: gear('Scrapway Longbow', 'weapon', 4, 41, true),
});
Object.assign(ITEMS, {
  r_c21_crest: gear('Crest of the Quiet Valley', 'trinket', 4, 42, true),
  r_c21_mantle: gear('Watch-Captain\u2019s Mantle', 'shoulders', 4, 42),
});
LOOT_TABLES.scraptitan = { gold: [340, 500], items: [['r_titanheart', 0.35], ['r_titanplate', 0.35], ['tonic', 1], ['brassplate', 1]], gear: 1, gearQ: 4, gearN: 2 };
Object.assign(QUESTS, {
  q_wk_tillers: { name: 'Nobody\u2019s Ploughs', giver: 'n_wk_bastian', turnin: 'n_wk_bastian', lvl: 35, pre: 'm_c18_end', text: 'The tillers came first. They wander up the Scrapway with nobody driving them and chew up whatever they find. Stop eight of them.', goal: { kill: 'feraltiller', n: 8 }, xp: 15000, gold: 300, rewards: ['r_wk_boots', 'r_wk_maul'] },
  q_wk_gears: { name: 'Mended Gears', giver: 'n_wk_bastian', turnin: 'n_wk_bastian', lvl: 35, pre: 'm_c18_end', text: 'Look at this gear. It broke, and someone welded it whole again. Bring me eight more like it from the engines out there. I need to know who is doing the mending.', goal: { item: 'rustedgear', n: 8 }, xp: 15000, gold: 300, rewards: ['r_wk_gloves', 'r_wk_charm'] },
  q_wk_sentinels: { name: 'Old Guards, No Orders', giver: 'n_wk_rafiq', turnin: 'n_wk_rafiq', lvl: 35, pre: 'm_c18_end', text: 'Rusted sentinels stand on the scrap heaps guarding nothing, and they will not let me near the good salvage. Knock eight of them over.', goal: { kill: 'feralsentinel', n: 8 }, xp: 15000, gold: 300, rewards: ['r_wk_coat', 'r_wk_bow'] },
  q_wk_strider: { name: 'The Patchwork Strider', giver: 'n_wk_rafiq', turnin: 'n_wk_rafiq', lvl: 35, pre: 'q_c19_scrapway', text: 'Something walks the basin on legs from three different engines. If you see the Patchwork Strider, break it, and bring me whatever is inside.', goal: { kill: 'patchstrider', n: 1 }, xp: 18000, gold: 380, rewards: ['r_patchcore'] },
  q_wk_foreman: { name: 'The Scrap Foreman', giver: 'n_wk_bastian', turnin: 'n_wk_bastian', lvl: 35, pre: 'q_wk_tillers', text: 'A great foreman-engine stands on the tallest heap and sorts the scrap into piles, as if somebody had told it to. Put it down.', goal: { kill: 'scrapforeman', n: 1 }, xp: 19000, gold: 420, rewards: ['r_wk_helm', 'r_wk_mantle'] },
});
for (const [npc, qs] of [['n_wk_bastian', ['q_wk_tillers', 'q_wk_gears', 'q_wk_foreman']], ['n_wk_rafiq', ['q_wk_sentinels', 'q_wk_strider']]]) { const n = NPCS.find((x) => x.id === npc); n.quests = [...(n.quests || []), ...qs]; }
DAILY('d_wild', 'n_wk_bastian', 'Keep the Scrapway Clear', 35, 'scrapcrawler', 10, 'Scrap crawlers climb up the Scrapway every night. Break ten and the road to the Highreach stays open.');

// ---- P3.4 the Concord Strongrooms (dungeon, level 25): the Weighbridge, Sealmaster Orrin and the Appraiser
Object.assign(MOBS, {
  weighbridge: { name: 'The Weighbridge', model: 'weighbridge', lvl: [26, 26], hp: 7800, dmg: [26, 38], speed: 3.0, aggro: 14, range: 3.6, swing: 2.3, xp: 3000, loot: 'u_weighbridge', radius: 1.7, elite: true,
    abilities: [{ kind: 'circles', every: 11, n: 3, r: 3, delay: 1.7, dmg: 1.4, text: 'The Weighbridge drops its counterweights!' }] },
  sealmaster: { name: 'Sealmaster Orrin', model: 'raider', variant: 21, lvl: [26, 26], hp: 7400, dmg: [27, 40], speed: 5.2, aggro: 14, range: 2.8, swing: 1.8, xp: 3000, loot: 'u_sealmaster', radius: 0.6, humanoid: true, elite: true,
    abilities: [{ kind: 'nova', every: 12, r: 5, delay: 1.6, dmg: 1.4, text: 'Sealmaster Orrin brings his seal-hammer down!' }, { kind: 'adds', at: 0.5, mob: 'marksman', n: 2, text: 'Orrin calls his marksmen down from the galleries!' }] },
  appraiser: { name: 'The Appraiser', model: 'appraiser', lvl: [27, 27], hp: 75000, dmg: [36, 54], speed: 2.6, aggro: 18, range: 5.0, swing: 2.7, xp: 9500, loot: 'u_appraiser', radius: 2.7, elite: true, boss: true,
    abilities: [{ kind: 'circles', every: 10, n: 4, r: 3.2, delay: 1.8, dmg: 1.45, text: 'The Appraiser stamps the floor with its pricing-press!' },
      { kind: 'nova', every: 16, r: 7, delay: 2.2, dmg: 1.6, text: 'The Appraiser vents its furnace across the vault!' },
      { kind: 'adds', at: 0.5, mob: 'assessor', n: 3, text: 'Assessors march out of the counting-cells!' },
      { kind: 'enrage', at: 0.2, text: 'The Appraiser\u2019s furnace burns white!' }] },
});
{
  const N = (name, slot, kind, q, ilvl, stats, desc, cls) => {
    const w = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'].includes(kind) ? kind : null, wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    return { name, slot, q, ilvl, req: Math.max(1, ilvl - 2), stats, desc, unique: true, ...(w ? { wtype: w } : {}), ...(wt ? { weight: wt } : {}), ...(cls ? { classes: cls } : {}) };
  };
  const drops = {
    weighbridge: [N('Counterweight Maul', 'weapon', 'hammer', 4, 28, { power: 64, hp: 22, crit: 4 }, 'Balanced to the last grain.', ['warden']), N('Weighbridge Pauldrons', 'shoulders', 'plate', 3, 28, { armor: 220, hp: 64, power: 12 }, 'Riveted from the bridge\u2019s own deck.'), N('Tally-Clerk\u2019s Pistol', 'weapon', 'pistol', 4, 28, { power: 64, hp: 22, crit: 4 }, 'It once fired a signal when the scales were full.', ['deadeye'])],
    sealmaster: [N('Orrin\u2019s Seal-Stamp', 'trinket', 'trinket', 4, 28, { power: 44, hp: 24, haste: 5 }, 'It leaves a set of scales on everything.'), N('Sealmaster\u2019s Gloves', 'hands', 'mail', 3, 28, { armor: 150, hp: 48, crit: 4 }, 'Stained with sealing-wax.')],
    appraiser: [N('Appraiser\u2019s Gauge-Staff', 'weapon', 'staff', 4, 29, { power: 68, hp: 22, haste: 6 }, 'It weighs whatever it strikes.', ['herbalist']), N('Enamelled Strongroom Plate', 'chest', 'plate', 4, 29, { armor: 300, hp: 80, power: 16 }, 'White as the Concord\u2019s ledgers, and as hard.')],
  };
  for (const [mob, list] of Object.entries(drops)) list.forEach((it, i) => { const id = `u_${mob}${i + 1}`; it.icon = it.wtype === 'pistol' ? 'w_pistol~3' : id; ITEMS[id] = it; }); // (pistols: the shared pistol icon)
}
SETS.strongrooms = { name: 'Concord Livery', pieces: ['set_strong1', 'set_strong2', 'set_strong3', 'set_strong4', 'set_strong5'], bonus: { 2: [['hp', 0.06], ['crit', 0.03]], 4: [['dmg', 0.06], ['haste', 0.04]] } };
Object.assign(ITEMS, {
  set_strong1: { name: 'Concord Livery Hood', slot: 'head', icon: 'a_cloth_head~3', weight: 'cloth', q: 4, stats: { armor: 170, hp: 58, power: 19 }, ilvl: 28, set: 'strongrooms' },
  set_strong2: { name: 'Concord Livery Mantle', slot: 'shoulders', icon: 'a_cloth_shoulders~3', weight: 'cloth', q: 4, stats: { armor: 170, hp: 58, haste: 14 }, ilvl: 28, set: 'strongrooms' },
  set_strong3: { name: 'Concord Livery Coat', slot: 'chest', icon: 'a_cloth_chest~3', weight: 'cloth', q: 4, stats: { armor: 170, hp: 58, power: 19 }, ilvl: 28, set: 'strongrooms' },
  set_strong4: { name: 'Concord Livery Breeches', slot: 'legs', icon: 'a_cloth_legs~3', weight: 'cloth', q: 4, stats: { armor: 170, hp: 58, haste: 14 }, ilvl: 28, set: 'strongrooms' },
  set_strong5: { name: 'Concord Livery Boots', slot: 'feet', icon: 'a_cloth_feet~3', weight: 'cloth', q: 4, stats: { armor: 170, hp: 58, power: 19 }, ilvl: 28, set: 'strongrooms' },
});
Object.assign(LOOT_TABLES, {
  u_weighbridge: { gold: [60, 100], items: [['u_weighbridge1', 0.2], ['u_weighbridge2', 0.2], ['u_weighbridge3', 0.2], ['set_strong1', 0.12], ['set_strong2', 0.12], ['tonic', 1]], gear: 1, gearQ: 3, gearN: 2 },
  u_sealmaster: { gold: [60, 100], items: [['u_sealmaster1', 0.2], ['u_sealmaster2', 0.2], ['set_strong3', 0.12], ['set_strong5', 0.12], ['tonic', 1]], gear: 1, gearQ: 3, gearN: 2 },
  u_appraiser: { gold: [260, 380], items: [['u_appraiser1', 0.3], ['u_appraiser2', 0.3], ['set_strong1', 0.2], ['set_strong2', 0.2], ['set_strong3', 0.2], ['set_strong4', 0.2], ['set_strong5', 0.2], ['draught', 1]], gear: 1, gearQ: 4, gearN: 3 },
});
SPAWNS.push(
  ds('strongrooms', 'enforcer', 60, 80, 5, 3), ds('strongrooms', 'marksman', 56, 74, 2, 1),
  ds('strongrooms', 'assessor', 48, 70, 3, 2),
  ds('strongrooms', 'loader', 34, 64, 6, 2), ds('strongrooms', 'enforcer', 30, 60, 6, 2), ds('strongrooms', 'weighbridge', 26, 58, 1, 1),
  ds('strongrooms', 'marksman', 52, 50, 3, 2), ds('strongrooms', 'assessor', 64, 46, 3, 1),
  ds('strongrooms', 'enforcer', 82, 44, 6, 3), ds('strongrooms', 'marksman', 90, 38, 3, 1), ds('strongrooms', 'sealmaster', 88, 40, 1, 1),
  ds('strongrooms', 'assessor', 76, 26, 3, 2),
  ds('strongrooms', 'appraiser', 58, 12, 1, 1),
);
FACTIONS.highreach.zones.push('strongrooms');

// ============================================================================ P4.3c THE COUNCIL HALL (raid, level 28-30)
// two great fights for a full company: the Exchequer, the Concord's greatest engine, and the Provost himself. Both change
// what they do as they weaken (abilities with below/above run only in their phase; 'phase' shouts as each one begins).
Object.assign(MOBS, {
  hallguard: { name: 'Council Hall Guard', model: 'raider', variant: 18, lvl: [28, 28], hp: 1500, dmg: [24, 34], speed: 5.0, aggro: 13, range: 2.4, swing: 1.8, xp: 700, loot: 'councilRaid', radius: 0.55, humanoid: true, elite: true },
  hallbow: { name: 'Council Hall Crossbowman', model: 'raider', variant: 19, lvl: [28, 28], hp: 1200, dmg: [20, 30], speed: 4.6, aggro: 18, range: 18, swing: 2.3, xp: 700, loot: 'councilRaid', radius: 0.5, humanoid: true, ranged: 'arrow', elite: true },
  hallsentry: { name: 'Council Sentry-Engine', model: 'sentinel', variant: 4, lvl: [28, 28], hp: 1900, dmg: [26, 36], speed: 3.4, aggro: 12, range: 2.8, swing: 2.2, xp: 760, loot: 'councilRaid', radius: 1.0, elite: true },
  exchequer: { name: 'The Exchequer', model: 'exchequer', lvl: [30, 30], hp: 135000, dmg: [40, 58], speed: 2.4, aggro: 18, range: 5.4, swing: 2.8, xp: 16000, loot: 'u_exchequer', radius: 2.9, elite: true, boss: true, raid: true,
    abilities: [
      { kind: 'circles', every: 10, n: 5, r: 3.2, delay: 1.8, dmg: 1.4, text: 'The Exchequer stamps its seals across the floor!' },
      { kind: 'nova', every: 15, r: 7, delay: 2.2, dmg: 1.5, above: 0.6, text: 'The Exchequer vents its boilers!' },
      { kind: 'phase', below: 0.6, text: 'The Exchequer\u2019s plates fold back: its counting-drums spin up!' },
      { kind: 'beam', every: 9, len: 22, r: 2.2, delay: 1.6, dmg: 1.5, below: 0.6, text: 'The Exchequer sweeps the hall with its drums!' },
      { kind: 'adds', at: 0.6, mob: 'hallsentry', n: 2, text: 'Sentry-engines march out of the Exchequer\u2019s housing!' },
      { kind: 'adds', at: 0.3, mob: 'hallsentry', n: 2, text: 'More sentry-engines unfold from the walls!' },
      { kind: 'enrage', at: 0.15, text: 'The Exchequer\u2019s furnace burns white!' }] },
  provost: { name: 'The Provost', model: 'raider', variant: 22, lvl: [30, 30], hp: 180000, dmg: [44, 62], speed: 5.4, aggro: 18, range: 2.8, swing: 1.6, xp: 18000, loot: 'u_provost', radius: 0.7, humanoid: true, elite: true, boss: true, raid: true,
    abilities: [
      { kind: 'nova', every: 12, r: 6, delay: 1.7, dmg: 1.5, text: 'The Provost calls the house to order!' },
      { kind: 'circles', every: 14, n: 4, r: 3.4, delay: 1.9, dmg: 1.4, above: 0.66, text: 'The Provost signs your warrants!' },
      { kind: 'phase', below: 0.66, text: 'The Provost: \u201cThe council will not be dismissed. Guards!\u201d' },
      { kind: 'adds', at: 0.66, mob: 'hallguard', n: 3, text: 'Hall guards pour in from the galleries!' },
      { kind: 'phase', below: 0.33, text: 'The Provost: \u201cThen I will take the valley alone.\u201d' },
      { kind: 'beam', every: 8, len: 18, r: 2.0, delay: 1.4, dmg: 1.6, below: 0.33, text: 'The Provost charges across the vault!' },
      { kind: 'circles', every: 9, n: 6, r: 3.0, delay: 1.6, dmg: 1.5, below: 0.33 },
      { kind: 'adds', at: 0.33, mob: 'hallbow', n: 2, text: 'Crossbowmen take the gallery!' },
      { kind: 'enrage', at: 0.12, text: 'The Provost fights on with nothing left to lose!' }] },
});
Object.assign(ITEMS, {
  r_raid_gavel: { ...gear('The Provost\u2019s Gavel', 'weapon', 4, 32), wtype: 'hammer', desc: 'It closed every sitting of the council. It closes fights too.' },
  r_raid_keyblade: { ...gear('Exchequer Key-Blade', 'weapon', 4, 32, true), wtype: 'sword', desc: 'Cut from the key that wound the Exchequer.' },
  r_raid_chain: { ...gear('Chain of Office', 'trinket', 4, 32), desc: 'Every link a seat on the council.' },
  r_raid_signet: { ...gear('Concord Signet', 'trinket', 4, 32, true), desc: 'The scales on it are bent now.' },
  r_raid_mantle: { ...gear('Provost\u2019s Mantle', 'shoulders', 4, 32), desc: 'Charcoal wool, brass at the hem.' },
  r_raid_plate: { ...gear('Ledger-Plate of the Exchequer', 'chest', 4, 32), desc: 'Riveted from the Exchequer\u2019s own housing.' },
  r_raid_greaves: { ...gear('Counting-House Greaves', 'legs', 4, 32), desc: 'Heavy enough to hold a vault door.' },
  r_raid_bow: { ...gear('Gallery Crossbow', 'weapon', 4, 32, true), wtype: 'bow', desc: 'Taken from the gallery above the council floor.' },
});
// the raid's pieces wear the epic art of their kind
for (const [id, w] of [['r_raid_gavel', 'hammer'], ['r_raid_keyblade', 'sword'], ['r_raid_bow', 'bow']]) ITEMS[id].icon = `w_${w}~3`;
for (const id of ['r_raid_chain', 'r_raid_signet']) ITEMS[id].icon = 't_trinket~3';
for (const [id, wt] of [['r_raid_mantle', 'cloth'], ['r_raid_plate', 'plate'], ['r_raid_greaves', 'plate']]) { ITEMS[id].weight = wt; ITEMS[id].icon = `a_${wt}_${ITEMS[id].slot}~3`; }
Object.assign(LOOT_TABLES, {
  councilRaid: { gold: [30, 50], items: [['councilwrit', 0.3], ['draught', 0.2]], gear: 0.45, gearQ: 3 },
  u_exchequer: { gold: [400, 600], items: [['r_raid_keyblade', 0.3], ['r_raid_plate', 0.3], ['r_raid_greaves', 0.3], ['r_raid_bow', 0.25]], gear: 1, gearQ: 4, gearN: 2 },
  u_provost: { gold: [600, 900], items: [['r_raid_gavel', 0.3], ['r_raid_chain', 0.3], ['r_raid_signet', 0.3], ['r_raid_mantle', 0.3]], gear: 1, gearQ: 4, gearN: 3 },
});
SPAWNS.push(
  ds('councilhall', 'hallguard', 60, 78, 3, 2),
  ds('councilhall', 'hallguard', 52, 66, 3, 2), ds('councilhall', 'hallbow', 70, 64, 2, 2), ds('councilhall', 'hallsentry', 60, 60, 2, 1),
  ds('councilhall', 'hallguard', 44, 46, 3, 2), ds('councilhall', 'hallbow', 76, 46, 2, 2),
  ds('councilhall', 'exchequer', 60, 38, 1, 1),
  ds('councilhall', 'hallsentry', 60, 25, 2, 2),
  ds('councilhall', 'provost', 60, 11, 1, 1),
);
FACTIONS.highreach.zones.push('councilhall');

// ============================================================================ P5.5 THE DRY DOCKS (raid, level 30)
// under the Guild Yards: the launching engine that was to carry the Guild's armies to sea, and the Guildmaster himself
Object.assign(MOBS, {
  dockguard: { name: 'Dry Dock Riveter', model: 'raider', variant: 23, lvl: [30, 30], hp: 1700, dmg: [26, 36], speed: 5.0, aggro: 13, range: 2.4, swing: 1.8, xp: 760, loot: 'dockRaid', radius: 0.55, humanoid: true, elite: true },
  dockbow: { name: 'Dry Dock Harpooneer', model: 'raider', variant: 24, lvl: [30, 30], hp: 1350, dmg: [22, 32], speed: 4.6, aggro: 18, range: 18, swing: 2.3, xp: 760, loot: 'dockRaid', radius: 0.5, humanoid: true, ranged: 'arrow', elite: true },
  dockengine: { name: 'Slipway Rivet-Engine', model: 'sentinel', variant: 2, lvl: [30, 30], hp: 2100, dmg: [28, 38], speed: 3.4, aggro: 12, range: 2.8, swing: 2.2, xp: 800, loot: 'dockRaid', radius: 1.0, elite: true },
  launchengine: { name: 'The Launching Engine', model: 'launchengine', lvl: [30, 30], hp: 135000, dmg: [42, 60], speed: 2.2, aggro: 18, range: 5.8, swing: 2.9, xp: 17000, loot: 'u_launchengine', radius: 3.1, elite: true, boss: true, raid: true,
    abilities: [
      { kind: 'circles', every: 10, n: 5, r: 3.4, delay: 1.8, dmg: 1.4, text: 'The Launching Engine drops its chocks across the dock!' },
      { kind: 'beam', every: 13, len: 24, r: 2.4, delay: 1.7, dmg: 1.5, above: 0.5, text: 'The Launching Engine lurches down its slipway!' },
      { kind: 'phase', below: 0.5, text: 'Sea water floods the dock: the Launching Engine\u2019s boilers roar!' },
      { kind: 'nova', every: 11, r: 8, delay: 2.0, dmg: 1.6, below: 0.5, text: 'The Launching Engine vents steam across the flooded dock!' },
      { kind: 'adds', at: 0.5, mob: 'dockengine', n: 2, text: 'Rivet-engines climb out of the dock walls!' },
      { kind: 'adds', at: 0.25, mob: 'dockguard', n: 3, text: 'Riveters run down the gantries!' },
      { kind: 'enrage', at: 0.12, text: 'The Launching Engine strains at its last chains!' }] },
  guildmaster: { name: 'The Guildmaster', model: 'raider', variant: 26, lvl: [30, 30], hp: 180000, dmg: [46, 64], speed: 5.4, aggro: 18, range: 2.8, swing: 1.6, xp: 19000, loot: 'u_guildmaster', radius: 0.7, humanoid: true, elite: true, boss: true, raid: true,
    abilities: [
      { kind: 'nova', every: 12, r: 6, delay: 1.7, dmg: 1.5, text: 'The Guildmaster strikes the anvil-bell!' },
      { kind: 'circles', every: 13, n: 4, r: 3.4, delay: 1.9, dmg: 1.45, above: 0.66, text: 'The Guildmaster marks the floor for rivets!' },
      { kind: 'phase', below: 0.66, text: 'The Guildmaster: \u201cEvery army on every shore will be built here. Riveters!\u201d' },
      { kind: 'adds', at: 0.66, mob: 'dockguard', n: 3, text: 'Riveters pour out of the gantries!' },
      { kind: 'phase', below: 0.33, text: 'The Guildmaster: \u201cThen I will launch it myself.\u201d' },
      { kind: 'beam', every: 8, len: 20, r: 2.0, delay: 1.4, dmg: 1.6, below: 0.33, text: 'The Guildmaster swings a launching chain across the dock!' },
      { kind: 'circles', every: 9, n: 6, r: 3.0, delay: 1.6, dmg: 1.5, below: 0.33 },
      { kind: 'adds', at: 0.33, mob: 'dockbow', n: 2, text: 'Harpooneers take the gantries!' },
      { kind: 'enrage', at: 0.12, text: 'The Guildmaster fights on with the dock flooding round him!' }] },
});
Object.assign(ITEMS, {
  r_dd_chain: { ...gear('Launching Chain', 'weapon', 4, 34), wtype: 'mace', desc: 'Each link was forged to hold a ship.' },
  r_dd_rivetgun: { ...gear('Guildmaster\u2019s Rivet-Bow', 'weapon', 4, 34, true), wtype: 'bow', desc: 'It fires rivets as well as arrows.' },
  r_dd_compass: { ...gear('Guildmaster\u2019s Compass', 'trinket', 4, 34, true), desc: 'It points to the nearest buyer.' },
  r_dd_seal: { ...gear('Yard-Number Seal', 'trinket', 4, 34), desc: 'Number one.' },
  r_dd_coat: { ...gear('Guildmaster\u2019s Coat', 'chest', 4, 34), desc: 'Deep navy, gold at every seam.' },
  r_dd_plate: { ...gear('Slipway Breastplate', 'chest', 4, 34), desc: 'Hammered from the Launching Engine\u2019s bow.' },
  r_dd_greaves: { ...gear('Dry Dock Greaves', 'legs', 4, 34), desc: 'They have stood in seawater for a week.' },
  r_dd_blade: { ...gear('Keel-Cutter', 'weapon', 4, 34, true), wtype: 'sword', desc: 'It cut the Launching Engine from its chocks.' },
});
for (const [id, w] of [['r_dd_chain', 'mace'], ['r_dd_rivetgun', 'bow'], ['r_dd_blade', 'sword']]) ITEMS[id].icon = `w_${w}~3`;
for (const id of ['r_dd_compass', 'r_dd_seal']) ITEMS[id].icon = 't_trinket~3';
for (const [id, wt] of [['r_dd_coat', 'cloth'], ['r_dd_plate', 'plate'], ['r_dd_greaves', 'plate']]) { ITEMS[id].weight = wt; ITEMS[id].icon = `a_${wt}_${ITEMS[id].slot}~3`; }
Object.assign(LOOT_TABLES, {
  dockRaid: { gold: [34, 56], items: [['guildrivet', 0.3], ['draught', 0.2]], gear: 0.45, gearQ: 3 },
  u_launchengine: { gold: [450, 650], items: [['r_dd_plate', 0.3], ['r_dd_greaves', 0.3], ['r_dd_blade', 0.3], ['r_dd_chain', 0.25]], gear: 1, gearQ: 4, gearN: 2 },
  u_guildmaster: { gold: [650, 950], items: [['r_dd_rivetgun', 0.3], ['r_dd_compass', 0.3], ['r_dd_seal', 0.3], ['r_dd_coat', 0.3]], gear: 1, gearQ: 4, gearN: 3 },
});
SPAWNS.push(
  ds('drydocks', 'dockguard', 48, 82, 2, 2),
  ds('drydocks', 'dockguard', 30, 70, 4, 2), ds('drydocks', 'dockbow', 36, 64, 2, 2),
  ds('drydocks', 'dockengine', 92, 70, 3, 2), ds('drydocks', 'dockbow', 86, 64, 2, 1),
  ds('drydocks', 'dockguard', 40, 46, 3, 2), ds('drydocks', 'dockbow', 80, 46, 2, 2),
  ds('drydocks', 'launchengine', 60, 38, 1, 1),
  ds('drydocks', 'dockengine', 60, 24, 2, 2),
  ds('drydocks', 'guildmaster', 60, 11, 1, 1),
);
FACTIONS.harrowmouth.zones.push('drydocks');

// ============================================================================ P6.5 THE KILN HEART (raid, level 35)
Object.assign(MOBS, {
  heartguard: { name: 'Kiln Heart Kilnhand', model: 'raider', variant: 27, lvl: [35, 35], hp: 1900, dmg: [30, 40], speed: 5.0, aggro: 13, range: 2.4, swing: 1.8, xp: 820, loot: 'kilnRaid', radius: 0.55, humanoid: true, elite: true },
  heartbow: { name: 'Kiln Heart Sling-Thrower', model: 'raider', variant: 28, lvl: [35, 35], hp: 1500, dmg: [26, 36], speed: 4.6, aggro: 18, range: 18, swing: 2.3, xp: 820, loot: 'kilnRaid', radius: 0.5, humanoid: true, ranged: 'arrow', elite: true },
  heartglass: { name: 'Core-Glass Sentinel', model: 'sentinel', variant: 5, lvl: [35, 35], hp: 2400, dmg: [32, 42], speed: 3.4, aggro: 12, range: 2.8, swing: 2.2, xp: 860, loot: 'kilnRaid', radius: 1.0, elite: true },
  furnaceengine: { name: 'The Furnace Engine', model: 'furnaceengine', lvl: [35, 35], hp: 140000, dmg: [46, 64], speed: 2.0, aggro: 18, range: 6.2, swing: 2.9, xp: 19000, loot: 'u_furnaceengine', radius: 3.4, elite: true, boss: true, raid: true,
    abilities: [
      { kind: 'circles', every: 10, n: 5, r: 3.4, delay: 1.8, dmg: 1.45, text: 'The Furnace Engine spills molten glass across the floor!' },
      { kind: 'nova', every: 14, r: 8, delay: 2.1, dmg: 1.5, above: 0.5, text: 'The Furnace Engine opens its doors: a wall of heat!' },
      { kind: 'phase', below: 0.5, text: 'A hundred cores flare at once: the Furnace Engine burns white!' },
      { kind: 'beam', every: 9, len: 24, r: 2.4, delay: 1.6, dmg: 1.6, below: 0.5, text: 'The Furnace Engine pours a river of glass toward you!' },
      { kind: 'adds', at: 0.5, mob: 'heartglass', n: 2, text: 'Core-glass sentinels step out of the furnace!' },
      { kind: 'adds', at: 0.25, mob: 'heartguard', n: 3, text: 'Kilnhands run in to feed the fire!' },
      { kind: 'enrage', at: 0.12, text: 'The Furnace Engine\u2019s cores begin to crack!' }] },
  glasswright: { name: 'The Glasswright', model: 'raider', variant: 30, lvl: [35, 35], hp: 190000, dmg: [50, 68], speed: 5.4, aggro: 18, range: 2.8, swing: 1.6, xp: 21000, loot: 'u_glasswright', radius: 0.7, humanoid: true, elite: true, boss: true, raid: true,
    abilities: [
      { kind: 'nova', every: 12, r: 6, delay: 1.7, dmg: 1.5, text: 'The Glasswright shatters a pane of core glass!' },
      { kind: 'circles', every: 13, n: 4, r: 3.4, delay: 1.9, dmg: 1.45, above: 0.66, text: 'The Glasswright scatters glass shards underfoot!' },
      { kind: 'phase', below: 0.66, text: 'The Glasswright: \u201cEvery engine in the valley was mine before it was anyone\u2019s. Kilnhands!\u201d' },
      { kind: 'adds', at: 0.66, mob: 'heartguard', n: 3, text: 'Kilnhands pour out of the furnace rooms!' },
      { kind: 'phase', below: 0.33, text: 'The Glasswright: \u201cThen I will melt the last of them myself.\u201d' },
      { kind: 'beam', every: 8, len: 20, r: 2.0, delay: 1.4, dmg: 1.65, below: 0.33, text: 'The Glasswright swings a ladle of molten glass across the floor!' },
      { kind: 'circles', every: 9, n: 6, r: 3.0, delay: 1.6, dmg: 1.55, below: 0.33 },
      { kind: 'adds', at: 0.33, mob: 'heartbow', n: 2, text: 'Sling-throwers take the furnace galleries!' },
      { kind: 'enrage', at: 0.12, text: 'The Glasswright fights on as the kilns go cold!' }] },
});
Object.assign(ITEMS, {
  r_kh_ladle: { ...gear('Glasswright\u2019s Ladle', 'weapon', 4, 40), wtype: 'mace', desc: 'Still warm. It always will be.' },
  r_kh_bow: { ...gear('Core-Glass Longbow', 'weapon', 4, 40, true), wtype: 'bow', desc: 'Its string hums like a core.' },
  r_kh_blade: { ...gear('Kiln-Tempered Blade', 'weapon', 4, 40, true), wtype: 'sword', desc: 'Quenched in the Furnace Engine\u2019s last breath.' },
  r_kh_lens: { ...gear('Glasswright\u2019s Loupe', 'trinket', 4, 40, true), desc: 'Every flaw shows through it.' },
  r_kh_core: { ...gear('Cooled Engine Core', 'trinket', 4, 40), desc: 'One of a hundred, and the only one left whole.' },
  r_kh_coat: { ...gear('Glasswright\u2019s Coat', 'chest', 4, 40), desc: 'White wool, teal at every seam.' },
  r_kh_plate: { ...gear('Furnace-Door Breastplate', 'chest', 4, 40), desc: 'Cut from the Furnace Engine\u2019s door.' },
  r_kh_greaves: { ...gear('Heat-Haze Greaves', 'legs', 4, 40), desc: 'They have walked on molten glass.' },
});
for (const [id, w] of [['r_kh_ladle', 'mace'], ['r_kh_bow', 'bow'], ['r_kh_blade', 'sword']]) ITEMS[id].icon = `w_${w}~3`;
for (const id of ['r_kh_lens', 'r_kh_core']) ITEMS[id].icon = 't_trinket~3';
for (const [id, wt] of [['r_kh_coat', 'cloth'], ['r_kh_plate', 'plate'], ['r_kh_greaves', 'plate']]) { ITEMS[id].weight = wt; ITEMS[id].icon = `a_${wt}_${ITEMS[id].slot}~3`; }
Object.assign(LOOT_TABLES, {
  kilnRaid: { gold: [40, 64], items: [['glassshard', 0.3], ['draught', 0.2]], gear: 0.45, gearQ: 3 },
  u_furnaceengine: { gold: [550, 750], items: [['r_kh_plate', 0.3], ['r_kh_greaves', 0.3], ['r_kh_blade', 0.3], ['r_kh_core', 0.25]], gear: 1, gearQ: 4, gearN: 2 },
  u_glasswright: { gold: [750, 1050], items: [['r_kh_ladle', 0.3], ['r_kh_bow', 0.3], ['r_kh_lens', 0.3], ['r_kh_coat', 0.3]], gear: 1, gearQ: 4, gearN: 3 },
});
SPAWNS.push(
  ds('kilnheart', 'heartguard', 60, 80, 2, 2),
  ds('kilnheart', 'heartguard', 54, 66, 3, 2), ds('kilnheart', 'heartbow', 66, 64, 2, 2),
  ds('kilnheart', 'heartglass', 28, 40, 3, 2), ds('kilnheart', 'heartglass', 92, 40, 3, 2),
  ds('kilnheart', 'heartbow', 46, 50, 2, 1), ds('kilnheart', 'heartbow', 74, 50, 2, 1),
  ds('kilnheart', 'furnaceengine', 60, 38, 1, 1),
  ds('kilnheart', 'heartglass', 60, 24, 2, 2),
  ds('kilnheart', 'glasswright', 60, 11, 1, 1),
);
FACTIONS.saltpan.zones.push('kilnheart');

// ============================================================================ P7.5 THE ASSEMBLY LINE (raid, level 35)
// under the Wildworks: an assembly line still obeying the Concord's last order, the Unfinished Engine on it, and the Assembler
Object.assign(MOBS, {
  lineguard: { name: 'Line Sentinel', model: 'sentinel', variant: 1, lvl: [35, 35], hp: 2300, dmg: [32, 42], speed: 3.4, aggro: 12, range: 2.8, swing: 2.2, xp: 860, loot: 'lineRaid', radius: 1.0, elite: true },
  linecrawler: { name: 'Line Crawler', model: 'crawler', lvl: [35, 35], hp: 1900, dmg: [30, 40], speed: 4.2, aggro: 12, range: 2.8, swing: 2.0, xp: 820, loot: 'lineRaid', radius: 1.1, elite: true },
  lineengine: { name: 'Half-Built Borer', model: 'borer', lvl: [35, 35], hp: 2600, dmg: [33, 44], speed: 3.0, aggro: 12, range: 3.2, swing: 2.3, xp: 880, loot: 'lineRaid', radius: 1.4, elite: true },
  unfinished: { name: 'The Unfinished Engine', model: 'unfinished', lvl: [35, 35], hp: 140000, dmg: [48, 66], speed: 2.0, aggro: 18, range: 6.2, swing: 2.9, xp: 20000, loot: 'u_unfinished', radius: 3.4, elite: true, boss: true, raid: true,
    abilities: [
      { kind: 'circles', every: 10, n: 5, r: 3.4, delay: 1.8, dmg: 1.45, text: 'Loose plates fall from the Unfinished Engine!' },
      { kind: 'nova', every: 14, r: 8, delay: 2.1, dmg: 1.5, above: 0.5, text: 'The Unfinished Engine\u2019s open boiler bursts!' },
      { kind: 'phase', below: 0.5, text: 'The line bolts new plates onto the Unfinished Engine while it fights!' },
      { kind: 'beam', every: 9, len: 24, r: 2.4, delay: 1.6, dmg: 1.6, below: 0.5, text: 'The Unfinished Engine lurches along the line!' },
      { kind: 'adds', at: 0.5, mob: 'lineguard', n: 2, text: 'Line sentinels step off the conveyor!' },
      { kind: 'adds', at: 0.25, mob: 'linecrawler', n: 3, text: 'Crawlers drop out of the half-built hull!' },
      { kind: 'enrage', at: 0.12, text: 'The Unfinished Engine shakes itself apart, and keeps fighting!' }] },
  assembler: { name: 'The Assembler', model: 'assembler', lvl: [35, 35], hp: 190000, dmg: [50, 68], speed: 3.2, aggro: 18, range: 4.0, swing: 2.0, xp: 22000, loot: 'u_assembler', radius: 2.4, elite: true, boss: true, raid: true,
    abilities: [
      { kind: 'nova', every: 12, r: 6, delay: 1.7, dmg: 1.5, text: 'The Assembler slams its press down!' },
      { kind: 'circles', every: 13, n: 4, r: 3.4, delay: 1.9, dmg: 1.45, above: 0.66, text: 'The Assembler marks the floor for welding!' },
      { kind: 'phase', below: 0.66, text: 'The Assembler: ORDER STANDS. ASSEMBLE. ASSEMBLE.' },
      { kind: 'adds', at: 0.66, mob: 'lineengine', n: 2, text: 'Half-built borers roll off the line!' },
      { kind: 'phase', below: 0.33, text: 'The Assembler: ORDER STANDS. NO MASTER. ASSEMBLE.' },
      { kind: 'beam', every: 8, len: 20, r: 2.0, delay: 1.4, dmg: 1.65, below: 0.33, text: 'The Assembler sweeps its welding arm across the line!' },
      { kind: 'circles', every: 9, n: 6, r: 3.0, delay: 1.6, dmg: 1.55, below: 0.33 },
      { kind: 'adds', at: 0.33, mob: 'linecrawler', n: 2, text: 'Crawlers scramble down from the gantries!' },
      { kind: 'enrage', at: 0.12, text: 'The Assembler runs past every limit it was built with!' }] },
});
Object.assign(ITEMS, {
  r_al_press: { ...gear('Assembler\u2019s Press-Hammer', 'weapon', 4, 42), wtype: 'hammer', desc: 'It stamped out ten thousand plates. Now it stamps out one.' },
  r_al_bow: { ...gear('Gantry Longbow', 'weapon', 4, 42, true), wtype: 'bow', desc: 'Strung with conveyor cable.' },
  r_al_blade: { ...gear('Line-Cutter', 'weapon', 4, 42, true), wtype: 'sword', desc: 'It cut the line, and the line stopped.' },
  r_al_drum: { ...gear('The Last Order Drum', 'trinket', 4, 42, true), desc: 'It still turns. It has nothing left to say.' },
  r_al_cog: { ...gear('Master Cog', 'trinket', 4, 42), desc: 'The first cog the Assembler ever fitted.' },
  r_al_coat: { ...gear('Line-Warden\u2019s Coat', 'chest', 4, 42), desc: 'Oil-dark wool, brass at the cuffs.' },
  r_al_plate: { ...gear('Unfinished Breastplate', 'chest', 4, 42), desc: 'Riveted from plates that were never fitted.' },
  r_al_greaves: { ...gear('Conveyor Greaves', 'legs', 4, 42), desc: 'They keep moving even when you do not.' },
});
for (const [id, w] of [['r_al_press', 'hammer'], ['r_al_bow', 'bow'], ['r_al_blade', 'sword']]) ITEMS[id].icon = `w_${w}~3`;
for (const id of ['r_al_drum', 'r_al_cog']) ITEMS[id].icon = 't_trinket~3';
for (const [id, wt] of [['r_al_coat', 'cloth'], ['r_al_plate', 'plate'], ['r_al_greaves', 'plate']]) { ITEMS[id].weight = wt; ITEMS[id].icon = `a_${wt}_${ITEMS[id].slot}~3`; }
Object.assign(LOOT_TABLES, {
  lineRaid: { gold: [44, 70], items: [['rustedgear', 0.3], ['draught', 0.2]], gear: 0.45, gearQ: 3 },
  u_unfinished: { gold: [600, 800], items: [['r_al_plate', 0.3], ['r_al_greaves', 0.3], ['r_al_blade', 0.3], ['r_al_cog', 0.25]], gear: 1, gearQ: 4, gearN: 2 },
  u_assembler: { gold: [800, 1100], items: [['r_al_press', 0.3], ['r_al_bow', 0.3], ['r_al_drum', 0.3], ['r_al_coat', 0.3]], gear: 1, gearQ: 4, gearN: 3 },
});
SPAWNS.push(
  ds('assemblyline', 'lineguard', 46, 82, 2, 2), ds('assemblyline', 'linecrawler', 74, 82, 2, 2),
  ds('assemblyline', 'lineguard', 30, 68, 3, 2), ds('assemblyline', 'lineengine', 90, 68, 3, 2),
  ds('assemblyline', 'linecrawler', 30, 54, 2, 2), ds('assemblyline', 'lineguard', 90, 54, 2, 2),
  ds('assemblyline', 'unfinished', 60, 40, 1, 1),
  ds('assemblyline', 'lineengine', 60, 24, 2, 2),
  ds('assemblyline', 'assembler', 60, 11, 1, 1),
);
FACTIONS.highreach.zones.push('assemblyline');
// the raid set drops in the Assembly Line too
LOOT_TABLES.u_unfinished.items.push(['set_free3', 0.15], ['set_free5', 0.15]);
LOOT_TABLES.u_assembler.items.push(['set_free1', 0.15], ['set_free2', 0.15], ['set_free4', 0.15]);

// ---- the weekly raid quest: Muster-Sergeant Bram sends you through all three raids, once a week
QUESTS.w_raids = { name: '[Weekly] Four Doors', giver: 'n_muster', turnin: 'n_muster', lvl: 35, pre: 'm_c18_end', weekly: true, daily: true,
  text: 'The Provost, the Guildmaster, the Glasswright and the Assembler are gone, but their halls fill up again every week with whoever wants their seats. Clear all four: the Council Hall, the Dry Docks, the Kiln Heart and the Assembly Line. Come back and I will make it worth your while: gold, and a piece of epic gear made for you.',
  goal: { kills: ['provost', 'guildmaster', 'glasswright', 'assembler'], n: 4 }, xp: 40000, gold: 2600, rewards: [], bonusGear: { ilvl: 40, q: 4 } };
NPCS.find((n) => n.id === 'n_muster').quests = [...(NPCS.find((n) => n.id === 'n_muster').quests || []), 'w_raids'];

// ---- the raid set: the Freeholder's Harness, split across both raids (Council Hall and Dry Docks), for any class
SETS.freeholder = { name: 'Freeholder’s Harness', pieces: ['set_free1', 'set_free2', 'set_free3', 'set_free4', 'set_free5'], bonus: { 2: [['hp', 0.08], ['armor', 0.03]], 4: [['dmg', 0.08], ['crit', 0.04], ['haste', 0.03]] } };
Object.assign(ITEMS, {
  set_free1: { name: 'Freeholder’s Helm', slot: 'head', icon: 'a_mail_head~3', weight: 'mail', q: 4, stats: { armor: 240, hp: 80, power: 26 }, ilvl: 34, set: 'freeholder' },
  set_free2: { name: 'Freeholder’s Pauldrons', slot: 'shoulders', icon: 'a_mail_shoulders~3', weight: 'mail', q: 4, stats: { armor: 240, hp: 80, haste: 18 }, ilvl: 34, set: 'freeholder' },
  set_free3: { name: 'Freeholder’s Hauberk', slot: 'chest', icon: 'a_mail_chest~3', weight: 'mail', q: 4, stats: { armor: 260, hp: 88, power: 28 }, ilvl: 34, set: 'freeholder' },
  set_free4: { name: 'Freeholder’s Legguards', slot: 'legs', icon: 'a_mail_legs~3', weight: 'mail', q: 4, stats: { armor: 250, hp: 84, crit: 5 }, ilvl: 34, set: 'freeholder' },
  set_free5: { name: 'Freeholder’s Gauntlets', slot: 'hands', icon: 'a_mail_hands~3', weight: 'mail', q: 4, stats: { armor: 230, hp: 76, power: 24 }, ilvl: 34, set: 'freeholder' },
});
// two pieces from the Council Hall, three from the Dry Docks
LOOT_TABLES.u_exchequer.items.push(['set_free5', 0.18]);
LOOT_TABLES.u_provost.items.push(['set_free1', 0.18]);
LOOT_TABLES.u_launchengine.items.push(['set_free3', 0.18]);
LOOT_TABLES.u_guildmaster.items.push(['set_free2', 0.18], ['set_free4', 0.18]);

// ---- P3.5 Chapter 9 rewards
Object.assign(ITEMS, {
  r_c9_charm: gear('Counterweight Keepsake', 'trinket', 3, 28, true),
  r_c9_gauntlets: gear('Gate-Warden Gauntlets', 'hands', 3, 28),
  r_c9_cloak: gear('Wax-Sealed Cloak', 'back', 3, 28),
  r_c9_boots: gear('Sealbreaker Boots', 'feet', 3, 28, true),
  r_c9_keyblade: gear('Strongroom Key-Blade', 'weapon', 4, 29, true),
  r_c9_greaves: gear('Concord-Breaker Greaves', 'legs', 4, 29),
});

// ---- Part Eight: the Deepway (P8.1). The explorers' camp at the foot of the great stair.
CARAVANS.push({ id: 'deepcamp', name: 'Explorers\u2019 Camp (Deepway)', x: 3550, z: 152, zone: 'dw_camp' });
NPCS.push(
  { id: 'n_dw_kasim', name: 'Expedition Leader Kasim', title: 'Explorers\u2019 Camp', look: 'warden', v: 1, x: 3544.5, z: 130.5, ry: 0.3, quests: ['q_dw_cistern', 'q_dw_first'],
    greet: 'Mind the channels: the water is cold enough to stop your heart. Everything down here still works. That is what frightens me.' },
  { id: 'n_dw_selim', name: 'Quartermaster Selim', title: 'Camp Stores', look: 'villager', v: 2, x: 3561, z: 145, ry: -2.4, vendor: 'general', quests: ['q_dw_aqueduct'],
    greet: 'Lamp oil, rope, bread that keeps. Everything carried down the stair on someone\u2019s back, so the prices are fair to them.' },
  { id: 'n_dw_garan', name: 'Smith Garan', title: 'Camp Forge', look: 'warden', v: 2, x: 3535.5, z: 143.5, ry: 2.2, vendor: 'smith', quests: ['q_dw_cogs', 'q_dw_galleries'],
    greet: 'Bronze, all of it. Not one rivet of iron in the whole undercity. I would give a year\u2019s wages to know how they cast it.' },
  { id: 'n_cv_deepcamp', name: 'Caravan Master Yusuf', title: 'Caravans', look: 'villager', v: 0, x: 3563, z: 130, ry: -1.0, caravan: 'deepcamp',
    greet: 'Pack mules do not like stairs. I carry them down one at a time.' },
);

// ---- Part Eight: the Makers' automata of the Deepway (P8.2), levels 36-40. Old bronze run on water and counterweights.
Object.assign(ITEMS, {
  bronzecog: { name: 'Makers\u2019 Bronze Cog', slot: 'junk', icon: 'gear', q: 0, stack: 20, price: 14, desc: 'Cast, not cut, and still true after who knows how long.' },
  r_brushcore: { ...gear('Brush-Drum Bearing', 'trinket', 4, 42, true), desc: 'It has swept the same square every night since before the valley had a name.' },
  r_keeperpole: { ...gear('Hall-Keeper\u2019s Maul-Pole', 'weapon', 4, 43), desc: 'Long enough to keep anyone at a polite distance.' },
  r_plumbcharm: { ...gear('Plumb-Line Keepsake', 'trinket', 4, 44, true), desc: 'A bronze bob on a cord. It always hangs true.' },
  r_firstheart: { ...gear('Heart of the First Engine', 'trinket', 4, 46, true), desc: 'Every engine in the valley was copied, at some remove, from this.' },
  r_firstplate: gear('First-Cast Plate', 'chest', 4, 46),
  r_firstmaul: gear('Counterweight Maul', 'weapon', 4, 46),
});
Object.assign(MOBS, {
  bronzesweeper: { name: 'Bronze Sweeper', model: 'sweeper', lvl: [36, 37], hp: 1080, dmg: [25, 37], speed: 4.4, aggro: 12, range: 2.6, swing: 1.9, xp: 620, loot: 'deepMach', radius: 0.9 },
  bronzewarden: { name: 'Bronze Warden', model: 'bwarden', lvl: [37, 38], hp: 1240, dmg: [27, 40], speed: 3.8, aggro: 14, range: 3.0, swing: 2.1, xp: 660, loot: 'deepWarden', radius: 0.8 },
  cwengine: { name: 'Counterweight Engine', model: 'cweight', lvl: [38, 39], hp: 1500, dmg: [30, 44], speed: 3.0, aggro: 13, range: 3.4, swing: 2.6, xp: 720, loot: 'deepMach', radius: 1.4 },
  oldbrush: { name: 'Old Brush', model: 'oldbrush', lvl: [37, 37], hp: 10200, dmg: [36, 52], speed: 4.6, aggro: 14, range: 3.0, swing: 1.8, xp: 3600, loot: 'rare11', radius: 1.5, elite: true, rare: true,
    abilities: [{ kind: 'beam', every: 10, len: 16, r: 2, delay: 1.5, dmg: 1.45, text: 'Old Brush sweeps across the square!' }, { kind: 'enrage', at: 0.3, text: 'Old Brush spins its drum faster and faster!' }] },
  hallkeeper: { name: 'The Hall-Keeper', model: 'hallkeeper', lvl: [38, 38], hp: 11600, dmg: [38, 55], speed: 3.8, aggro: 15, range: 3.4, swing: 2.0, xp: 3900, loot: 'rare12', radius: 1.2, elite: true, rare: true,
    abilities: [{ kind: 'circles', every: 11, n: 4, r: 3.0, delay: 1.8, dmg: 1.45, text: 'The Hall-Keeper brings its maul-pole down, again and again!' }, { kind: 'adds', at: 0.5, mob: 'bronzewarden', n: 2, text: 'The Hall-Keeper calls the halls\u2019 wardens to it!' }] },
  plumbweight: { name: 'The Plumb Weight', model: 'plumbweight', lvl: [39, 39], hp: 12800, dmg: [40, 58], speed: 2.8, aggro: 13, range: 4.0, swing: 2.6, xp: 4200, loot: 'rare13', radius: 2.0, elite: true, rare: true,
    abilities: [{ kind: 'nova', every: 13, r: 7, delay: 2.0, dmg: 1.5, text: 'The Plumb Weight swings its stone in a full circle!' }, { kind: 'enrage', at: 0.25, text: 'The Plumb Weight\u2019s chain runs out to its full length!' }] },
  firstengine: { name: 'The First Engine', model: 'firstengine', lvl: [40, 40], hp: 105000, dmg: [46, 66], speed: 2.2, aggro: 12, range: 6, swing: 2.8, xp: 14000, loot: 'firstengine', radius: 4.2, elite: true, boss: true, world: true,
    notice: 'is walking in the First Chamber of the Deepway, as it has since before the valley had a name', yell: 'rises on its stilts, and its paddle wheels begin to turn!',
    abilities: [{ kind: 'circles', every: 8, n: 6, r: 3.4, delay: 1.9, dmg: 1.35, text: 'The First Engine swings its weight across the chamber!' },
      { kind: 'nova', every: 16, r: 10, delay: 2.3, dmg: 1.7, text: 'The First Engine opens its sluices!' },
      { kind: 'adds', at: 0.5, mob: 'bronzesweeper', n: 3, text: 'Sweepers roll out from under the First Engine!' },
      { kind: 'enrage', at: 0.2, text: 'The First Engine lets its counterweight fall free!' }] },
});
Object.assign(LOOT_TABLES, {
  deepMach: { gold: [22, 34], items: [['bronzecog', 0.45], ['scrap', 0.2], ['draught', 0.12]], gear: 0.38 },
  rare11: { gold: [210, 290], items: [['r_brushcore', 1]], gear: 1, gearQ: 3 },
  rare12: { gold: [220, 300], items: [['r_keeperpole', 1]], gear: 1, gearQ: 3 },
  rare13: { gold: [230, 310], items: [['r_plumbcharm', 1]], gear: 1, gearQ: 3 },
  firstengine: { gold: [360, 520], items: [['r_firstheart', 0.35], ['r_firstplate', 0.35], ['r_firstmaul', 0.3], ['tonic', 1], ['brassplate', 1]], gear: 1, gearQ: 4, gearN: 2 },
});
// the Deepway's spawns (world coordinates; the region's origin is 3400, -60)
const dws = (mob, lx, lz, r, n, extra = {}) => ({ mob, dungeon: 'deepway', x: 3400 + lx, z: -60 + lz, r, n, ...extra });
SPAWNS.push(
  dws('bronzesweeper', 128, 118, 9, 3), dws('bronzesweeper', 172, 138, 9, 3), dws('bronzesweeper', 44, 108, 8, 3), dws('bronzesweeper', 44, 168, 8, 3),
  dws('bronzewarden', 52, 52, 14, 4), dws('bronzewarden', 120, 63, 10, 3), dws('bronzewarden', 180, 63, 10, 3), dws('bronzewarden', 245, 140, 6, 2, { lvl: [39, 40] }),
  dws('cwengine', 255, 115, 10, 2), dws('cwengine', 255, 165, 10, 2), dws('cwengine', 242, 46, 8, 2, { lvl: [39, 40] }), dws('cwengine', 268, 46, 8, 2, { lvl: [39, 40] }),
  dws('oldbrush', 150, 128, 18, 1), dws('hallkeeper', 150, 63, 26, 1), dws('plumbweight', 255, 46, 12, 1),
  dws('firstengine', 150, 18, 2, 1, { world: true }),
);

// ---- Part Eight story rewards and the camp's side quests (P8.3)
Object.assign(ITEMS, {
  makerplan: { name: 'Makers\u2019 Drafting Plan', slot: 'quest', icon: 'cloth', q: 1, stack: 20, desc: 'Rolled tight in a bronze tube. Every gear drawn to scale.' },
  r_c22_boots: gear('Stair-Worn Boots', 'feet', 3, 44),
  r_c22_staff: gear('Channel-Keeper\u2019s Pole', 'weapon', 3, 44, true),
  r_c23_helm: gear('Cistern-Diver\u2019s Hood', 'head', 3, 45),
  r_c23_bow: gear('Bronze-Strung Bow', 'weapon', 3, 45, true),
  r_c23_gloves: gear('Draughtsman\u2019s Gloves', 'hands', 3, 46),
  r_c23_charm: gear('Bronze Tube Keepsake', 'trinket', 3, 46, true),
  r_c24_legs: gear('Gallery-Walker Legguards', 'legs', 4, 47),
  r_c24_maul: gear('Counterweight-Breaker', 'weapon', 4, 47),
  r_c24_crest: { ...gear('Crest of the Deepway', 'trinket', 4, 48, true), desc: 'Given by the explorers\u2019 camp to those who stood in the First Chamber.' },
  r_dw_cogring: gear('Cast-Cog Ring', 'trinket', 3, 44, true),
  r_dw_waders: gear('Aqueduct Waders', 'legs', 3, 45),
  r_dw_cisternplate: gear('Cistern Plate', 'chest', 3, 46),
  r_dw_weighgloves: gear('Weighmaster\u2019s Gloves', 'hands', 3, 47),
  r_dw_firstcloak: gear('First Chamber Cloak', 'back', 4, 49),
});
Object.assign(LOOT_TABLES, {
  deepWarden: { gold: [22, 34], items: [['makerplan', 0.4], ['bronzecog', 0.45], ['draught', 0.12]], gear: 0.38 },
});
Object.assign(QUESTS, {
  q_dw_aqueduct: { name: 'Clean Water', giver: 'n_dw_selim', turnin: 'n_dw_selim', lvl: 36, pre: 'q_c22_stair', goal: { kill: 'bronzesweeper', n: 10 },
    text: 'The aqueducts carry our drinking water past the camp, and the sweepers keep shoving grit into them. Ten fewer sweepers and the water runs clear again.', xp: 15000, gold: 340, rewards: ['r_dw_waders'] },
  q_dw_cogs: { name: 'Cast, Not Cut', giver: 'n_dw_garan', turnin: 'n_dw_garan', lvl: 36, pre: 'q_c22_stair', goal: { item: 'bronzecog', n: 10 },
    text: 'Bring me ten of the Makers\u2019 bronze cogs. I want to melt one, saw one, file one, and find out how a cog can come out of a mould this true.', xp: 15000, gold: 340, rewards: ['r_dw_cogring'] },
  q_dw_cistern: { name: 'Rounds', giver: 'n_dw_kasim', turnin: 'n_dw_kasim', lvl: 37, pre: 'q_c23_wardens', goal: { kill: 'bronzewarden', n: 10 },
    text: 'The wardens keep coming back to their rounds, one by one. Keep them thinned out so the dig crews can work in the cistern. Ten will do for today.', xp: 16000, gold: 360, rewards: ['r_dw_cisternplate'] },
  q_dw_galleries: { name: 'Dead Weight', giver: 'n_dw_garan', turnin: 'n_dw_garan', lvl: 38, pre: 'q_c24_weights', goal: { kill: 'cwengine', n: 8 },
    text: 'Those weights are dressed stone banded in bronze, the best I have ever seen. Bring eight of the engines down so the crews can cut the bands free.', xp: 17000, gold: 380, rewards: ['r_dw_weighgloves'] },
  q_dw_first: { name: 'The First Engine', giver: 'n_dw_kasim', turnin: 'n_dw_kasim', lvl: 40, pre: 'm_c24_ready', goal: { kill: 'firstengine', n: 1 },
    text: 'When the First Engine walks, the whole camp shakes. Gather everyone you can and bring it down. The Makers built it to last; let us see how long.', xp: 30000, gold: 800, rewards: ['r_dw_firstcloak'], ach: true },
});

// ============================================================================ P8.4 THE MAKERS' HALL (raid, level 40)
// behind the First Engine: the Hall of Drawings, the Draughtsman that keeps it, and the Master Pattern every engine was drawn from
Object.assign(MOBS, {
  hallwarden: { name: 'Hall Warden', model: 'hallwarden', lvl: [40, 40], hp: 2900, dmg: [36, 48], speed: 3.6, aggro: 12, range: 3.2, swing: 2.1, xp: 980, loot: 'makersRaid', radius: 1.0, elite: true },
  hallweight: { name: 'Hall Counterweight', model: 'cweight', lvl: [40, 40], hp: 3300, dmg: [38, 50], speed: 3.0, aggro: 12, range: 3.6, swing: 2.5, xp: 1020, loot: 'makersRaid', radius: 1.4, elite: true },
  hallsweeper: { name: 'Hall Sweeper', model: 'sweeper', lvl: [40, 40], hp: 2400, dmg: [34, 46], speed: 4.4, aggro: 12, range: 2.8, swing: 1.9, xp: 940, loot: 'makersRaid', radius: 0.9, elite: true },
  draughtsman: { name: 'The Draughtsman', model: 'draughtsman', lvl: [40, 40], hp: 160000, dmg: [52, 70], speed: 3.0, aggro: 18, range: 4.4, swing: 2.2, xp: 26000, loot: 'u_draughtsman', radius: 2.2, elite: true, boss: true, raid: true,
    abilities: [
      { kind: 'circles', every: 10, n: 5, r: 3.2, delay: 1.8, dmg: 1.45, text: 'The Draughtsman marks out the floor!' },
      { kind: 'beam', every: 12, len: 26, r: 2.2, delay: 1.6, dmg: 1.6, text: 'The Draughtsman rules a straight line across the hall!' },
      { kind: 'phase', below: 0.5, text: 'The Draughtsman: MEASURE. MEASURE AGAIN. CUT.' },
      { kind: 'adds', at: 0.5, mob: 'hallwarden', n: 2, text: 'Hall wardens step down from the walls!' },
      { kind: 'nova', every: 14, r: 7, delay: 2.0, dmg: 1.55, below: 0.5, text: 'The Draughtsman sweeps its maul-pole round in a full circle!' },
      { kind: 'adds', at: 0.25, mob: 'hallsweeper', n: 3, text: 'Sweepers roll out from under the drafting tables!' },
      { kind: 'enrage', at: 0.12, text: 'The Draughtsman stops measuring!' }] },
  masterpattern: { name: 'The Master Pattern', model: 'masterpattern', lvl: [40, 40], hp: 210000, dmg: [54, 74], speed: 2.4, aggro: 18, range: 6.6, swing: 2.9, xp: 30000, loot: 'u_pattern', radius: 3.6, elite: true, boss: true, raid: true,
    abilities: [
      { kind: 'nova', every: 12, r: 7, delay: 1.8, dmg: 1.55, text: 'The Master Pattern swings its weight in a full circle!' },
      { kind: 'circles', every: 13, n: 5, r: 3.4, delay: 1.9, dmg: 1.45, above: 0.66, text: 'The Master Pattern opens its sluices across the room!' },
      { kind: 'phase', below: 0.66, text: 'Water roars down the channels. The Master Pattern\u2019s paddle wheels spin faster.' },
      { kind: 'adds', at: 0.66, mob: 'hallweight', n: 2, text: 'Counterweights drop from the ceiling and walk!' },
      { kind: 'phase', below: 0.33, text: 'The Master Pattern lets its weight run free on the chain.' },
      { kind: 'beam', every: 8, len: 24, r: 2.4, delay: 1.4, dmg: 1.65, below: 0.33, text: 'The Master Pattern strides the length of the room!' },
      { kind: 'circles', every: 9, n: 7, r: 3.0, delay: 1.6, dmg: 1.55, below: 0.33 },
      { kind: 'adds', at: 0.33, mob: 'hallsweeper', n: 3, text: 'Sweepers pour out of the channels!' },
      { kind: 'enrage', at: 0.12, text: 'The Master Pattern runs past every limit the Makers drew for it!' }] },
});
Object.assign(ITEMS, {
  r_mh_rule: { ...gear('The Draughtsman\u2019s Rule', 'weapon', 4, 50), wtype: 'sword', desc: 'A straight edge, sharpened.' },
  r_mh_bow: { ...gear('Plumb-Line Bow', 'weapon', 4, 50, true), wtype: 'bow', desc: 'Strung true to a hair.' },
  r_mh_maul: { ...gear('Master Pattern Maul', 'weapon', 4, 50), wtype: 'hammer', desc: 'Every hammer in the valley was drawn from this one.' },
  r_mh_compass: { ...gear('Makers\u2019 Compasses', 'trinket', 4, 50, true), desc: 'Bronze, with a point that never dulls.' },
  r_mh_wheel: { ...gear('Little Paddle Wheel', 'trinket', 4, 50), desc: 'It turns by itself if you hold it near water.' },
  r_mh_apron: { ...gear('Drafting-Room Apron', 'chest', 4, 50), desc: 'Heavy canvas, bronze-studded and ink-stained.' },
  r_mh_plate: { ...gear('Pattern-Cast Breastplate', 'chest', 4, 50), desc: 'Poured in one piece.' },
  r_mh_greaves: { ...gear('Counterweight Greaves', 'legs', 4, 50), desc: 'Heavy. Exactly as heavy as they should be.' },
  r_c25_crest: { ...gear('Crest of the Makers\u2019 Hall', 'trinket', 4, 50, true), desc: 'Given to those who broke the Master Pattern.' },
  r_c25_mantle: gear('Mantle of the Last Drawing', 'back', 4, 50),
});
for (const [id, w] of [['r_mh_rule', 'sword'], ['r_mh_bow', 'bow'], ['r_mh_maul', 'hammer']]) ITEMS[id].icon = `w_${w}~3`;
for (const id of ['r_mh_compass', 'r_mh_wheel']) ITEMS[id].icon = 't_trinket~3';
for (const [id, wt] of [['r_mh_apron', 'cloth'], ['r_mh_plate', 'plate'], ['r_mh_greaves', 'plate']]) { ITEMS[id].weight = wt; ITEMS[id].icon = `a_${wt}_${ITEMS[id].slot}~3`; }
// the raid set: the Maker's Regalia, split across both bosses, for any class
SETS.makers = { name: 'Maker\u2019s Regalia', pieces: ['set_mk1', 'set_mk2', 'set_mk3', 'set_mk4', 'set_mk5'], bonus: { 2: [['hp', 0.08], ['armor', 0.04]], 4: [['dmg', 0.09], ['crit', 0.04], ['haste', 0.04]] } };
Object.assign(ITEMS, {
  set_mk1: { name: 'Maker\u2019s Hood', slot: 'head', icon: 'a_mail_head~3', weight: 'mail', q: 4, stats: { armor: 350, hp: 116, power: 38 }, ilvl: 50, set: 'makers' },
  set_mk2: { name: 'Maker\u2019s Pauldrons', slot: 'shoulders', icon: 'a_mail_shoulders~3', weight: 'mail', q: 4, stats: { armor: 350, hp: 116, haste: 26 }, ilvl: 50, set: 'makers' },
  set_mk3: { name: 'Maker\u2019s Hauberk', slot: 'chest', icon: 'a_mail_chest~3', weight: 'mail', q: 4, stats: { armor: 376, hp: 128, power: 40 }, ilvl: 50, set: 'makers' },
  set_mk4: { name: 'Maker\u2019s Legguards', slot: 'legs', icon: 'a_mail_legs~3', weight: 'mail', q: 4, stats: { armor: 362, hp: 122, crit: 7 }, ilvl: 50, set: 'makers' },
  set_mk5: { name: 'Maker\u2019s Gauntlets', slot: 'hands', icon: 'a_mail_hands~3', weight: 'mail', q: 4, stats: { armor: 334, hp: 110, power: 35 }, ilvl: 50, set: 'makers' },
});
Object.assign(LOOT_TABLES, {
  makersRaid: { gold: [50, 80], items: [['bronzecog', 0.5], ['draught', 0.2]], gear: 0.45, gearQ: 3 },
  u_draughtsman: { gold: [700, 900], items: [['r_mh_rule', 0.3], ['r_mh_apron', 0.3], ['r_mh_compass', 0.25], ['r_mh_greaves', 0.3], ['set_mk3', 0.16], ['set_mk5', 0.16]], gear: 1, gearQ: 4, gearN: 2 },
  u_pattern: { gold: [900, 1200], items: [['r_mh_maul', 0.3], ['r_mh_bow', 0.3], ['r_mh_wheel', 0.3], ['r_mh_plate', 0.3], ['set_mk1', 0.16], ['set_mk2', 0.16], ['set_mk4', 0.16]], gear: 1, gearQ: 4, gearN: 3 },
});
SPAWNS.push(
  ds('makershall', 'hallwarden', 56, 78, 1, 2), ds('makershall', 'hallsweeper', 64, 78, 1, 2),
  ds('makershall', 'hallweight', 34, 66, 3, 2), ds('makershall', 'hallwarden', 86, 66, 3, 2),
  ds('makershall', 'hallsweeper', 34, 52, 2, 2), ds('makershall', 'hallweight', 86, 52, 2, 2),
  ds('makershall', 'draughtsman', 60, 59, 1, 1),
  ds('makershall', 'hallwarden', 60, 40, 2, 2),
  ds('makershall', 'masterpattern', 60, 18, 1, 1),
);
// the weekly raid quest takes in the fifth door
QUESTS.w_raids.name = '[Weekly] Five Doors';
QUESTS.w_raids.text = 'The Provost, the Guildmaster, the Glasswright, the Assembler and the Master Pattern are gone, but their halls fill up again every week. Clear all five: the Council Hall, the Dry Docks, the Kiln Heart, the Assembly Line and the Makers\u2019 Hall. Come back and I will make it worth your while: gold, and a piece of epic gear made for you.';
QUESTS.w_raids.goal = { kills: ['provost', 'guildmaster', 'glasswright', 'assembler', 'masterpattern'], n: 5 };
QUESTS.w_raids.gold = 3400; QUESTS.w_raids.xp = 48000; QUESTS.w_raids.bonusGear = { ilvl: 46, q: 4 };

// ============================================================================ THE EXPLORERS' GUILD (the Deepway's reputation)
// Kasim's diggers and surveyors keep their own standing; Kasim is quartermaster. Kills and quests anywhere in the Deepway count.
FACTIONS.explorers = { name: 'Explorers\u2019 Guild', color: '#3a7a6a', zones: ['deepway', ...DUNGEON_BY_ID.deepway.areas.map((a) => a[0]), 'makershall'], qm: 'n_dw_kasim' };
PETS.sweeper = { name: 'Little Sweeper', model: 'sweeper', scale: 0.38, from: 'the Explorers\u2019 Guild' };
Object.assign(ITEMS, {
  pet_sweeper: { name: 'Little Sweeper', slot: 'use', icon: 'pet_sweeper', q: 3, stack: 1, price: 0, use: { pet: 'sweeper' }, desc: 'A sweeper the size of a loaf, rebuilt by Garan from three broken ones. Use it to keep it: it will follow you and tidy up after you.' },
  rep_e1: { name: 'Surveyor\u2019s Lamp-Cloak', slot: 'back', icon: 'a_back~2', q: 3, stats: { armor: 210, hp: 72, haste: 13 }, ilvl: 44 },
  rep_e2: { name: 'Digger\u2019s Gauntlets', slot: 'hands', icon: 'a_plate_hands~2', weight: 'plate', q: 3, stats: { armor: 236, hp: 78, power: 26 }, ilvl: 45 },
  rep_e3: { name: 'Stair-Warden\u2019s Pauldrons', slot: 'shoulders', icon: 'a_mail_shoulders~3', weight: 'mail', q: 4, stats: { armor: 340, hp: 104, crit: 6 }, ilvl: 47 },
  rep_e4: { name: 'Kasim\u2019s Survey Staff', slot: 'weapon', icon: 'w_staff~3', wtype: 'staff', q: 4, stats: { power: 176, haste: 19, hp: 42 }, ilvl: 48 },
});
ITEMS.mk3kit = { name: 'Makers’ Drive Kit', slot: 'use', icon: 'gear', q: 4, stack: 1, price: 0, use: { mk3: true }, desc: 'Bronze gears cast in the Deepway, a verdigris-banded boiler and a square lamp. Use it on a Mk II runabout to make it a Mk III: 130% faster than running.' };
ITEMS.crawlerdeed = { name: 'Deepway Crawler Deed', slot: 'use', icon: 'gear', q: 4, stack: 1, price: 0, use: { crawler: true }, desc: 'Title to a low bronze half-track from the Deepway: twin rear tracks, a front roller drum and a sealed boiler under a slatted hood. Use it to keep the crawler; use it again to choose whether R brings the crawler or your runabout. It runs as fast as a Mk II.' };
REP_SHOP.explorers = [{ item: 'mk3kit', rank: 4, price: 60000 }, { item: 'crawlerdeed', rank: 3, price: 40000 }, { item: 'rep_e1', rank: 1, price: 14000 }, { item: 'pet_sweeper', rank: 2, price: 8000 }, { item: 'rep_e2', rank: 2, price: 18000 }, { item: 'rep_e3', rank: 3, price: 24000 }, { item: 'rep_e4', rank: 4, price: 30000 }];
PAINTS.bronze = { name: 'Makers\u2019 Bronze', body: '#b88a52', paint: true, trim: '#6a9a84', metal: 'bronze', seat: '#5a3a24', need: { rep: 'explorers', rank: 2 } };
HOME_DECO.home_makerlamp = { name: 'Makers’ Lamp Post', price: 9000, desc: 'A bronze lamp post from the Deepway, gone green at the seams, still lit. Built once the Explorers’ Guild reveres you.', need: { rep: 'explorers', rank: 3 } };
HOME_DECO.std_explorers = { name: 'Explorers\u2019 Guild Standard', price: 6000, desc: 'Verdigris green. Built once the Explorers\u2019 Guild honours you.', need: { rep: 'explorers', rank: 2 }, color: '#3a7a6a' };
DAILY('d_deep', 'n_dw_kasim', 'Keep the Square Swept', 37, 'bronzesweeper', 10, 'The sweepers are back in the Makers\u2019 Square every morning. Break ten and the crews get a day\u2019s digging done.');
DAILY('d_deep2', 'n_dw_garan', 'Wardens on Their Rounds', 38, 'bronzewarden', 10, 'The wardens walk the same rounds they walked a thousand years ago. Break ten and the drafting halls stay open to the crews.');
DAILY('d_deep3', 'n_dw_selim', 'Weights Off the Wheels', 39, 'cwengine', 6, 'The counterweight engines have been walking into the wheelworks and fouling the wheels. Break six and the crews can pump the cistern dry today.');
// the three Deepway jobs rotate: each day one of them rests
QUESTS.d_deep.rot = ['deep', 0, 3]; QUESTS.d_deep2.rot = ['deep', 1, 3]; QUESTS.d_deep3.rot = ['deep', 2, 3];

// ---- the Explorers' Guild weekly: Kasim's survey of the three keepers of the Deepway
QUESTS.w_survey = { name: '[Weekly] Kasim’s Survey', giver: 'n_dw_kasim', turnin: 'n_dw_kasim', lvl: 38, pre: 'm_c24_ready', weekly: true, daily: true,
  text: 'Every week the survey crews push further in, and every week the same three engines turn them back: Old Brush in the square, the Hall-Keeper in the drafting halls, and the Plumb Weight in the galleries. Break all three and I will see you paid, and the guild will not forget it.',
  goal: { kills: ['oldbrush', 'hallkeeper', 'plumbweight'], n: 3 }, xp: 30000, gold: 1800, rewards: [], bonusGear: { ilvl: 46, q: 4 } };
NPCS.find((n) => n.id === 'n_dw_kasim').quests.push('w_survey');

// ---- the Makers' drawings: one rolled drawing hidden in each named area of the Deepway, a collection (achievement drawAll)
export const DRAWINGS = [
  { id: 'o_draw1', area: 'dw_stair', lx: 155, lz: 236, title: 'The Great Stair, in section', text: 'Every step drawn to the same rise, the stair house above it marked \u201cto keep the sand out\u201d.' },
  { id: 'o_draw2', area: 'dw_camp', lx: 158, lz: 185, title: 'A Resting Place', text: 'A plan of this very floor, with a fire drawn where Kasim\u2019s camp now burns.' },
  { id: 'o_draw3', area: 'dw_square', lx: 166, lz: 117, title: 'The Square and its Basin', text: 'Four channels meeting in one basin, and a note: \u201cthe water must be heard everywhere\u201d.' },
  { id: 'o_draw4', area: 'dw_aqueducts', lx: 38, lz: 175, title: 'The Long Channel', text: 'The aqueduct\u2019s fall, measured in finger-widths over two hundred paces.' },
  { id: 'o_draw5', area: 'dw_cistern', lx: 28, lz: 46, title: 'The Cistern Pillars', text: 'Four pillars, and how much water each may stand in before the stone tires.' },
  { id: 'o_draw6', area: 'dw_wheelworks', lx: 244, lz: 182, title: 'A Paddle Wheel, Unrolled', text: 'Ten paddles, two solid rims, and the speed of the water that turns them.' },
  { id: 'o_draw7', area: 'dw_halls', lx: 200, lz: 78, title: 'The Drafting Table', text: 'A drawing of a drawing table, with a drawing on it, very small.' },
  { id: 'o_draw8', area: 'dw_galleries', lx: 278, lz: 27, title: 'The Weights, Balanced', text: 'Six weights, six chains, and the sum that keeps them all in step.' },
  { id: 'o_draw9', area: 'dw_chamber', lx: 166, lz: 24, title: 'The First Engine', text: 'Stilt legs, a weight, two wheels, and in the corner, in a careful hand: \u201cthe first; copy it well\u201d.' },
];
OBJECT_KINDS.drawing = { prompt: 'Take up the rolled drawing', goal: 'Makers\u2019 drawings found', done: 'taken' };
OBJECTS.push(...DRAWINGS.map((d, i) => ({ id: d.id, kind: 'drawing', x: 3400 + d.lx, z: -60 + d.lz, ry: i * 0.7 })));
Object.assign(ITEMS, { r_c26_cloak: { ...gear('Council Delegate\u2019s Cloak', 'back', 4, 50), desc: 'Worn to the council of the valley. Everyone was there.' } });
HOME_TROPHIES.push(['plaque_hcopy', 'Gilded Copy-Works plaque (Heroic)', { ach: 'rhBenedek' }]);
HOME_TROPHIES.push(['trophy_drawings', 'The Makers\u2019 Drawings, framed', { ach: 'drawAll' }]);

// ============================================================================ PART NINE: the Council of the Valley (P9.1)
// four delegates stand in an arc before the Marshal, come to argue over who keeps the Makers' drawings
NPCS.push(
  { id: 'n_dl_faris', name: 'Surveyor Faris', title: 'Explorers\u2019 Guild', look: 'warden', v: 2, x: -4.2, z: -13.2, ry: 2.86, quests: [],
    greet: 'The drawings came out of the Deepway, and the guild bled to bring them up. We will say so, politely, as often as it takes.' },
  { id: 'n_dl_osric', name: 'Shipwright Osric', title: 'Harrowmouth', look: 'villager', v: 1, x: -1.0, z: -12.4, ry: 3.02, quests: [],
    greet: 'Harrowmouth has hulls and no engines to drive them. Those drawings could change that in a season.' },
  { id: 'n_dl_tamir', name: 'Apprentice Tamir', title: 'The Glasswrights\u2019 Apprentices', look: 'chemist', v: 1, x: 3.4, z: -12.4, ry: -3.06, quests: [],
    greet: 'Our masters made weapons. We would like to learn to make something else. That is all we came to ask.' },
  { id: 'n_dl_benedek', name: 'Clerk Benedek', title: 'The Concord\u2019s Last Clerks', look: 'villager', v: 2, x: 6.6, z: -13.2, ry: -2.9, quests: [],
    greet: 'The Concord kept accounts of everything, you know. Including who owes whom for the engines. Someone should remember that.' },
);

// ---- P9.2 the copy engines: crude brass copies built from the stolen drawing, walking the old regions. Level 40, but passive:
// they never start a fight, so the valley's younger travellers can walk past them
const COPY = (name) => ({ name, model: 'copyengine', lvl: [40, 40], hp: 9000, dmg: [36, 50], speed: 3.2, aggro: 0, passive: true, range: 3.0, swing: 2.2, xp: 3000, loot: 'copyLoot', radius: 1.3, elite: true,
  abilities: [{ kind: 'circles', every: 11, n: 4, r: 3.0, delay: 1.8, dmg: 1.4, text: `The ${name} stamps, and its badly-cast plates shake loose!` }] });
Object.assign(MOBS, { copyfields: COPY('Copy Engine of the Fields'), copydunes: COPY('Copy Engine of the Dunes'), copycoast: COPY('Copy Engine of the Coast') });
Object.assign(ITEMS, {
  copyplate: { name: 'Badly Cast Plate', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'Bronze, poured too fast and too cold. Whoever made this had the drawing, and not the skill.' },
  r_c27_boots: gear('Trail-Runner\u2019s Boots', 'feet', 4, 50),
  r_c27_charm: { ...gear('Lamp-Oil Keepsake', 'trinket', 4, 51, true), desc: 'A drop of the thief\u2019s lamp oil, sealed in glass.' },
  r_c27_blade: gear('Copy-Breaker', 'weapon', 4, 51),
});
LOOT_TABLES.copyLoot = { gold: [180, 260], items: [['copyplate', 1], ['bronzecog', 0.5]], gear: 1, gearQ: 3 };
SPAWNS.push(
  { mob: 'copyfields', path: [[100, 25], [125, 15], [130, -5], [110, -15], [95, 5]], r: 2, n: 1 },
  { mob: 'copydunes', path: [[-75, 195], [-95, 215], [-115, 200], [-100, 180], [-80, 178]], r: 2, n: 1 },
  { mob: 'copycoast', path: [[360, 30], [380, 20], [395, 35], [380, 50], [362, 48]], r: 2, n: 1 },
);

// ============================================================================ P9.3 THE COPY-WORKS (dungeon, level 40)
// Clerk Benedek's workshop: hired hands, badly cast copies, ladle engines; Foreman Lorcan, the Miscast Weight, and Benedek himself
Object.assign(MOBS, {
  castworker: { name: 'Copy-Works Hand', model: 'raider', variant: 19, lvl: [39, 40], hp: 1500, dmg: [30, 44], speed: 5.0, aggro: 13, range: 2.6, swing: 1.9, xp: 760, loot: 'copyTrash', radius: 0.5, humanoid: true },
  brasscopy: { name: 'Brass Copy', model: 'sentinel', variant: 0, lvl: [39, 40], hp: 1750, dmg: [32, 46], speed: 3.6, aggro: 13, range: 2.8, swing: 2.1, xp: 790, loot: 'copyTrash', radius: 0.9 },
  ladleengine: { name: 'Ladle Engine', model: 'furnace', lvl: [39, 40], hp: 1850, dmg: [33, 47], speed: 3.2, aggro: 12, range: 3.0, swing: 2.3, xp: 800, loot: 'copyTrash', radius: 1.1 },
  lorcan: { name: 'Foreman Lorcan', model: 'raider', variant: 18, lvl: [40, 40], hp: 14000, dmg: [40, 56], speed: 5.2, aggro: 14, range: 2.8, swing: 1.8, xp: 4200, loot: 'u_lorcan', radius: 0.6, humanoid: true, elite: true,
    abilities: [{ kind: 'nova', every: 12, r: 5, delay: 1.6, dmg: 1.45, text: 'Foreman Lorcan swings his casting-hook round!' }, { kind: 'adds', at: 0.5, mob: 'castworker', n: 2, text: 'Lorcan shouts for his hands!' }] },
  miscast: { name: 'The Miscast Weight', model: 'plumbweight', lvl: [40, 40], hp: 15000, dmg: [42, 58], speed: 2.8, aggro: 13, range: 4.0, swing: 2.6, xp: 4400, loot: 'u_miscast', radius: 2.0, elite: true,
    abilities: [{ kind: 'circles', every: 11, n: 3, r: 3.2, delay: 1.7, dmg: 1.45, text: 'The Miscast Weight\u2019s chain slips and its stone crashes down!' }] },
  benedek: { name: 'Clerk Benedek', model: 'raider', variant: 21, lvl: [41, 41], hp: 115000, dmg: [46, 64], speed: 5.0, aggro: 18, range: 3.0, swing: 1.8, xp: 12000, loot: 'u_benedek', radius: 0.6, humanoid: true, elite: true, boss: true,
    abilities: [{ kind: 'circles', every: 10, n: 4, r: 3.2, delay: 1.8, dmg: 1.45, text: 'Benedek pulls a lever, and molten brass pours from the moulds!' },
      { kind: 'nova', every: 16, r: 7, delay: 2.2, dmg: 1.6, text: 'Benedek: Every engine in this valley was paid for! Every one!' },
      { kind: 'adds', at: 0.5, mob: 'brasscopy', n: 3, text: 'Benedek\u2019s brass copies step down from the casting line!' },
      { kind: 'enrage', at: 0.2, text: 'Benedek throws his ledger into the furnace!' }] },
});
{
  const N = (name, slot, kind, q, ilvl, stats, desc, cls) => {
    const w = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'].includes(kind) ? kind : null, wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    return { name, slot, q, ilvl, req: Math.max(1, ilvl - 2), stats, desc, unique: true, ...(w ? { wtype: w } : {}), ...(wt ? { weight: wt } : {}), ...(cls ? { classes: cls } : {}) };
  };
  const drops = {
    lorcan: [N('Lorcan\u2019s Casting-Hook', 'weapon', 'mace', 4, 50, { power: 118, hp: 40, crit: 7 }, 'For lifting moulds out of the fire.'), N('Foreman\u2019s Leather Apron', 'chest', 'cloth', 3, 50, { armor: 250, hp: 86, power: 24 }, 'Scorched, patched, scorched again.'), N('Mould-Runner Pistol', 'weapon', 'pistol', 4, 50, { power: 118, hp: 40, crit: 7 }, 'Bored from a mould runner, its barrel still grey with casting sand.', ['deadeye'])],
    miscast: [N('Miscast Pauldrons', 'shoulders', 'plate', 4, 51, { armor: 420, hp: 112, power: 24 }, 'Poured too fast and too cold, and still stronger than iron.'), N('Slipped-Chain Keepsake', 'trinket', 'trinket', 4, 51, { power: 70, hp: 38, haste: 9 }, 'A link from the chain that let go.')],
    benedek: [N('Benedek\u2019s Ledger-Staff', 'weapon', 'staff', 4, 52, { power: 124, hp: 42, haste: 10 }, 'Every debt the valley owes, written down its length.', ['herbalist']), N('Clerk\u2019s Grey Coat', 'chest', 'mail', 4, 52, { armor: 400, hp: 118, crit: 8 }, 'Concord grey, ink-stained at the cuffs.'), N('The Stolen Drawing\u2019s Case', 'trinket', 'trinket', 4, 52, { power: 74, hp: 40, crit: 8 }, 'The drawing went home to Sunmere. The case did not.')],
  };
  for (const [mob, list] of Object.entries(drops)) list.forEach((it, i) => { const id = `u_${mob}${i + 1}`; it.icon = it.wtype === 'pistol' ? 'w_pistol~3' : id; ITEMS[id] = it; }); // (pistols: the shared pistol icon)
}
SETS.copyworks = { name: 'Copyist\u2019s Garb', pieces: ['set_copy1', 'set_copy2', 'set_copy3', 'set_copy4', 'set_copy5'], bonus: { 2: [['hp', 0.07], ['crit', 0.03]], 4: [['dmg', 0.07], ['haste', 0.04]] } };
Object.assign(ITEMS, {
  set_copy1: { name: 'Copyist\u2019s Hood', slot: 'head', icon: 'a_cloth_head~3', weight: 'cloth', q: 4, stats: { armor: 260, hp: 90, power: 30 }, ilvl: 50, set: 'copyworks' },
  set_copy2: { name: 'Copyist\u2019s Mantle', slot: 'shoulders', icon: 'a_cloth_shoulders~3', weight: 'cloth', q: 4, stats: { armor: 260, hp: 90, haste: 22 }, ilvl: 50, set: 'copyworks' },
  set_copy3: { name: 'Copyist\u2019s Coat', slot: 'chest', icon: 'a_cloth_chest~3', weight: 'cloth', q: 4, stats: { armor: 260, hp: 90, power: 30 }, ilvl: 50, set: 'copyworks' },
  set_copy4: { name: 'Copyist\u2019s Breeches', slot: 'legs', icon: 'a_cloth_legs~3', weight: 'cloth', q: 4, stats: { armor: 260, hp: 90, haste: 22 }, ilvl: 50, set: 'copyworks' },
  set_copy5: { name: 'Copyist\u2019s Boots', slot: 'feet', icon: 'a_cloth_feet~3', weight: 'cloth', q: 4, stats: { armor: 260, hp: 90, power: 30 }, ilvl: 50, set: 'copyworks' },
  r_c28_ring: { ...gear('Returned Drawing Ring', 'trinket', 4, 52, true), desc: 'Given by the council to whoever brought the drawing home.' },
  r_c28_mantle: gear('Mantle of the Open Hall', 'back', 4, 52),
});
Object.assign(LOOT_TABLES, {
  copyTrash: { gold: [26, 40], items: [['copyplate', 0.3], ['bronzecog', 0.3], ['draught', 0.12]], gear: 0.4 },
  u_lorcan: { gold: [140, 200], items: [['u_lorcan1', 0.2], ['u_lorcan2', 0.2], ['u_lorcan3', 0.2], ['set_copy1', 0.12], ['set_copy2', 0.12], ['tonic', 1]], gear: 1, gearQ: 3, gearN: 2 },
  u_miscast: { gold: [140, 200], items: [['u_miscast1', 0.2], ['u_miscast2', 0.2], ['set_copy3', 0.12], ['set_copy5', 0.12], ['tonic', 1]], gear: 1, gearQ: 3, gearN: 2 },
  u_benedek: { gold: [420, 600], items: [['u_benedek1', 0.3], ['u_benedek2', 0.3], ['u_benedek3', 0.25], ['set_copy1', 0.2], ['set_copy2', 0.2], ['set_copy3', 0.2], ['set_copy4', 0.2], ['set_copy5', 0.2], ['draught', 1]], gear: 1, gearQ: 4, gearN: 3 },
});
SPAWNS.push(
  ds('copyworks', 'castworker', 57, 82, 3, 3), ds('copyworks', 'brasscopy', 54, 76, 1, 1),
  ds('copyworks', 'ladleengine', 48, 70, 3, 2),
  ds('copyworks', 'castworker', 34, 64, 6, 2), ds('copyworks', 'brasscopy', 30, 60, 6, 2), ds('copyworks', 'lorcan', 26, 58, 1, 1),
  ds('copyworks', 'ladleengine', 52, 50, 3, 2), ds('copyworks', 'castworker', 64, 46, 3, 1),
  ds('copyworks', 'brasscopy', 82, 44, 6, 3), ds('copyworks', 'ladleengine', 90, 38, 3, 1), ds('copyworks', 'miscast', 88, 40, 1, 1),
  ds('copyworks', 'castworker', 76, 26, 3, 2),
  ds('copyworks', 'benedek', 58, 12, 1, 1),
);
FACTIONS.harrowmouth.zones.push('copyworks');

// ============================================================================ P9.4 MAKERS' MARKS: a token vendor for gear at the level 40 cap
Object.assign(ITEMS, {
  makermark: { name: 'Makers\u2019 Mark', slot: 'quest', icon: 'gear', q: 3, stack: 200, desc: 'A bronze token stamped with a plain square. Quartermaster Hamid in Sunmere trades them for gear.' },
  mk_helm: { name: 'Marked Plate Helm', slot: 'head', icon: 'a_plate_head~3', weight: 'plate', q: 4, stats: { armor: 430, hp: 120, power: 26 }, ilvl: 50 },
  mk_hood: { name: 'Marked Cloth Hood', slot: 'head', icon: 'a_cloth_head~3', weight: 'cloth', q: 4, stats: { armor: 270, hp: 96, power: 32 }, ilvl: 50 },
  mk_coif: { name: 'Marked Mail Coif', slot: 'head', icon: 'a_mail_head~3', weight: 'mail', q: 4, stats: { armor: 360, hp: 108, crit: 8 }, ilvl: 50 },
  mk_belt: { name: 'Marked Girdle', slot: 'legs', icon: 'a_plate_legs~3', weight: 'plate', q: 4, stats: { armor: 440, hp: 124, haste: 18 }, ilvl: 51 },
  mk_cloak: { name: 'Marked Cloak', slot: 'back', icon: 'a_back~3', q: 4, stats: { armor: 240, hp: 84, haste: 16 }, ilvl: 51 },
  mk_charm: { name: 'Marked Keepsake', slot: 'trinket', icon: 't_trinket~3', q: 4, stats: { power: 76, hp: 42, crit: 9 }, ilvl: 52 },
  mk_sword: { name: 'Marked Blade', slot: 'weapon', icon: 'w_sword~3', wtype: 'sword', q: 4, stats: { power: 182, hp: 44, crit: 9 }, ilvl: 52 },
  mk_bow: { name: 'Marked Longbow', slot: 'weapon', icon: 'w_bow~3', wtype: 'bow', q: 4, stats: { power: 182, hp: 44, haste: 10 }, ilvl: 52 },
});
export const MARK_SHOP = [
  { item: 'mk_helm', price: 30 }, { item: 'mk_hood', price: 30 }, { item: 'mk_coif', price: 30 }, { item: 'mk_belt', price: 35 },
  { item: 'mk_cloak', price: 35 }, { item: 'mk_charm', price: 45 }, { item: 'mk_sword', price: 60 }, { item: 'mk_bow', price: 60 },
];
// marks: a few from rares and the Copy-Works bosses, more from raid bosses and the First Engine
for (const [t, n] of [['u_exchequer', 2], ['u_provost', 2], ['u_launchengine', 2], ['u_guildmaster', 2], ['u_furnaceengine', 2], ['u_glasswright', 2], ['u_unfinished', 2], ['u_assembler', 3], ['rare11', 3], ['rare12', 3], ['rare13', 3], ['u_lorcan', 2], ['u_miscast', 2], ['u_benedek', 5], ['firstengine', 8], ['u_draughtsman', 6], ['u_pattern', 10]]) {
  for (let i = 0; i < n; i++) LOOT_TABLES[t].items.push(['makermark', 1]);
}
NPCS.push({ id: 'n_marks', name: 'Quartermaster Hamid', title: 'Makers\u2019 Marks', look: 'warden', v: 1, x: 10.4, z: -21.6, ry: -2.3, marks: true,
  greet: 'Bronze marks for good steel. The council stamps them, I hand out the gear. Simple.' });

// ============================================================================ THE VALLEY BUILDS (a weekly shared project in Sunmere)
// everyone's donations raise one engine in the square, in five stages; it starts again from bare ground every week.
// The key has a digit in it, so no character (letters only) can ever share its save file.
export const VALLEY = { key: 'world9build', stages: [0, 120, 300, 550, 850, 1200], gifts: { scrap: 1, cog: 2, spring: 2, rustedgear: 3, bronzecog: 5, copyplate: 12 },
  names: ['Bare ground', 'The platform', 'The frame', 'The water tank', 'The paddle wheels', 'The valley\u2019s engine'], x: 25, z: -7 };
NPCS.push({ id: 'n_build', name: 'Master-Builder Darius', title: 'The Valley\u2019s Engine', look: 'warden', v: 0, x: 20.6, z: -3.6, ry: 2.2, build: true,
  greet: 'The drawings are open to all, so we build one engine for all of us. Bring scrap, cogs, springs, bronze: anything that can be melted down or bolted on.' });

// ============================================================================ PART TEN: THE FAR SHORE (P10.1, Chapter 29)
// the guild hall's cartographer on the terrace beside the Marshal, and the master shipwright at the gangway on the
// Harrowmouth pier, where the ship built around the valley's engine is moored
NPCS.push(
  { id: 'n_gh_ilyas', name: 'Cartographer Ilyas', title: 'Explorers’ Guild', look: 'chemist', v: 2, x: -8.4, z: -33.7, ry: 0.5, quests: [],
    greet: 'Every road, river and shore in the valley is on one of my charts. If it is not, nobody has walked it yet.' },
  { id: 'n_hm_haroun', name: 'Master Shipwright Haroun', title: 'Harrowmouth Shipyard', look: 'villager', v: 0, x: 442.2, z: 79.6, ry: 0.6, quests: [],
    greet: 'Mind the tar, mind the ropes, and mind my hull. Everything else on this pier you may tread on.' },
);
// Benedek's last copies, wandering the beach north of the pier: passive, not elite, and their fireboxes still full of coal
Object.assign(MOBS, { copydock: { ...COPY('Dock Copy Engine'), hp: 2600, xp: 1800, elite: false, loot: 'c29DockLoot', abilities: [] } });
Object.assign(ITEMS, {
  shipcoal: { name: 'Load of Firebox Coal', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'Hard, black and dry, raked out of a copy engine’s firebox. Master Haroun wants it for the ship’s bunkers.' },
  r_c29_gloves: gear('Shipwright’s Tarred Gloves', 'hands', 4, 53),
  r_c29_charm: { ...gear('Firebox Keepsake', 'trinket', 4, 53, true), desc: 'A lump of the copies’ coal, bound in brass wire.' },
  r_c29_helm: gear('Helm of the First Crossing', 'head', 4, 54),
  r_c29_legs: gear('Deckhand’s Greaves', 'legs', 4, 54),
});
LOOT_TABLES.c29DockLoot = { gold: [60, 90], items: [['shipcoal', 1], ['copyplate', 0.6]], gear: 0.5, gearQ: 3 };
SPAWNS.push({ mob: 'copydock', x: 401, z: 122, r: 6, n: 4 }); // the open beach north of the harbour, clear of the camp and the coast copy's patrol

// ============================================================================ PART TEN: THE CINDER REACH (P10.2)
// the island over the sea has its own terrain box (shared/reach.js). Once Chapter 29 is done (m_c29_aboard), Master Shipwright
// Haroun at the Harrowmouth gangway sails you out, and the harbour master on the island's landing pier sails you back.
// A crossing lands you within a few metres of the other man (who can sail you straight back).
// SAIL.to: every port, where a crossing lands you, and what is said on the way (sayFrom: by the area you sail from). A port may
// need one more quest done than SAIL.need (need, with notReady as the refusal). An NPC's sail is the port he sails you to by
// default; sails lists every port he sails to (sailRoutes()), and the client may pick one with { t: 'sail', npc, to }.
export const SAIL = { need: 'm_c29_aboard', range: 7, to: {
  reach: { x: REACH.landing.x, z: REACH.landing.z, name: 'the Cinder Reach', say: 'The ship steams out past the harbour wall and east over the sea. Hours later the black beaches of the Cinder Reach come up out of the haze.' },
  valley: { x: 438.5, z: 80, name: 'Harrowmouth', say: 'The ship takes you back over the sea to Harrowmouth.' },
} };
export const sailRoutes = (n) => (n?.sails || (n?.sail ? [n.sail] : []));
NPCS.find((n) => n.id === 'n_hm_haroun').sail = 'reach';
NPCS.push(
  { id: 'n_ar_zayd', name: 'Harbour Master Zayd', title: 'Ashfall Landing Pier', look: 'villager', v: 1, x: REACH.harbour.x, z: REACH.harbour.z, ry: REACH.harbour.ry, sail: 'valley', quests: [],
    greet: 'Black sand, grey ash and a sea that never sits still. Keep to the planks: the beach is warmer than it looks.' },
  { id: 'n_cv_ashfall', name: 'Caravan Master Munir', title: 'Caravans', look: 'villager', v: 2, x: REACH.caravan.x, z: REACH.caravan.z - 2, ry: 0.2, caravan: 'ashfall',
    greet: 'No roads out here yet, only the one ship. I keep the post, and I can set your compass to this camp.' },
);
// the island's caravan stop has no routes (the only way off is the ship), but it can be the Homeward Compass's home
CARAVANS.push({ id: 'ashfall', name: 'Ashfall Landing', x: REACH.caravan.x, z: REACH.caravan.z, zone: 'ashfall' });
GRAVEYARDS.push({ x: REACH.grave.x, z: REACH.grave.z });
// the island's own reputation (its shop comes with P10.6). questRep scales the reputation its quests give (sim on_turnin):
// the Reach's long story would otherwise open the whole shop at once
FACTIONS.cinderwrights = { name: 'The Cinderwrights', color: '#d0703a', zones: ['ashfall', 'slagterraces', 'oldworks'], qm: 'n_ar_zayd', questRep: 0.4 };

// ============================================================================ PART TEN: CHAPTERS 30-31 (P10.4 part 2)
// Ashfall Landing and Benedek's crew (story text in story.js). Four men on the island: the camp warden in the square, the
// Explorers' Guild surveyor at the foot of the terraces, and two of Benedek's old hired hands, their boss at the crew's camp
// at the top of the north track (by the Ore Galleries door) and their boat-mender on the beach north of the pier. The crew
// are people to outwit and talk round: none of them is a mob. Every turn-in stands on the island, so the chapters' quests
// give Cinderwright reputation.
NPCS.push(
  { id: 'n_ar_tahir', name: 'Camp Warden Tahir', title: 'Ashfall Landing', look: 'warden', v: 1, x: 470, z: -1206, ry: -0.86, quests: [],
    greet: 'Water in the cistern, bunks in the long house, and keep your boots on. The ash gets into everything.' },
  { id: 'n_ar_bashir', name: 'Surveyor Bashir', title: 'Explorers’ Guild', look: 'chemist', v: 1, x: 492, z: -1202.5, ry: -1.57, quests: [],
    greet: 'Every step of these terraces was laid by hand. A thousand years of slag, and not one step out of true.' },
  { id: 'n_ar_corbin', name: 'Corbin', title: 'Benedek’s Old Crew', look: 'villager', v: 2, x: 548, z: -1262, ry: -1.37, quests: [],
    greet: 'Mind the carts. And mind your own business, while you are at it.' },
  { id: 'n_ar_edric', name: 'Edric', title: 'Boat-Mender', look: 'villager', v: 0, x: 437, z: -1217, ry: 1.28, quests: [], vendor: 'general',
    greet: 'Tar, planks and patience. I have two of the three.' },
);
Object.assign(ITEMS, {
  c30_ore: { name: 'Fresh Ore Sample', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'Dark, heavy cinder ore with clean, square-cut faces. Surveyor Bashir wants to know where it was mined.' },
  c31_plate: { name: 'Sound Brass Plate', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'Thin, springy Makers’ brass off one of the island’s machines. Edric wants it to patch the stolen boat’s hull.' },
  r_c30_boots: gear('Black-Sand Boots', 'feet', 4, 54),
  r_c30_charm: { ...gear('Crawler-Scoop Keepsake', 'trinket', 4, 54, true), desc: 'A tooth off an ore crawler’s scoop, still bright where it bit.' },
  r_c30_gloves: gear('Ore-Raker’s Gloves', 'hands', 4, 55),
  r_c30_cloak: gear('Terrace-Walker’s Cloak', 'back', 4, 55),
  r_c30_hauberk: gear('Assayer’s Chain Hauberk', 'chest', 4, 55),
  r_c30_pick: gear('Surveyor’s Rock Pick', 'weapon', 4, 55),
  r_c31_greaves: gear('Patched-Hull Greaves', 'legs', 4, 56),
  r_c31_mantle: gear('Tar-and-Brass Mantle', 'shoulders', 4, 56),
  r_c31_helm: gear('Adit-Mouth Helm', 'head', 4, 56),
  r_c31_coif: gear('Cinder-Glass Coif', 'head', 4, 56),
  r_c31_hammer: gear('Sorter-Breaker Hammer', 'weapon', 4, 58),
  r_c31_charm: { ...gear('Graded Ore Keepsake', 'trinket', 4, 58, true), desc: 'One lump of ore the Great Sorter passed as perfect.' },
  r_c31_coat: gear('Cinderwright’s Long Coat', 'chest', 4, 57),
  r_c31_cloak: gear('Ashfall Accord Cloak', 'back', 4, 57),
});
// the Cinderwrights' stores, kept by Harbour Master Zayd on the landing pier (ranks Friendly to Exalted, item level 56-58)
Object.assign(ITEMS, {
  rep_cw1: { name: 'Cinderwright’s Ash-Cloak', slot: 'back', icon: 'a_back~2', q: 3, stats: { armor: 270, hp: 92, haste: 16 }, ilvl: 56 },
  rep_cw2: { name: 'Slag-Raker’s Gauntlets', slot: 'hands', icon: 'a_plate_hands~2', weight: 'plate', q: 3, stats: { armor: 300, hp: 98, power: 32 }, ilvl: 56 },
  rep_cw3: { name: 'Pourer’s Mail Spaulders', slot: 'shoulders', icon: 'a_mail_shoulders~3', weight: 'mail', q: 4, stats: { armor: 410, hp: 126, crit: 8 }, ilvl: 57 },
  rep_cw4: { name: 'Ash-Walker’s Hood', slot: 'head', icon: 'a_cloth_head~3', weight: 'cloth', q: 4, stats: { armor: 290, hp: 122, power: 34 }, ilvl: 57 },
  rep_cw5: { name: 'Cinderwright Casting-Ladle', slot: 'weapon', icon: 'w_hammer~3', wtype: 'hammer', q: 4, stats: { power: 212, haste: 23, hp: 52 }, ilvl: 58 },
});
REP_SHOP.cinderwrights = [{ item: 'rep_cw1', rank: 1, price: 18000 }, { item: 'rep_cw2', rank: 2, price: 24000 }, { item: 'rep_cw3', rank: 3, price: 30000 }, { item: 'rep_cw4', rank: 3, price: 30000 }, { item: 'rep_cw5', rank: 4, price: 38000 }];
// the Ashwright's colours for the runabout: slag-black panels, ember trim and an iron boiler (Honored with the Cinderwrights)
PAINTS.ashwright = { name: 'Ashwright Slag', body: '#3c3836', paint: true, trim: '#e0782e', metal: 'iron', seat: '#5a2a1c', need: { rep: 'cinderwrights', rank: 2 } };

// ============================================================================ PART TEN: CHAPTER 32 (P10.5 story)
// "The First Furnace", the last chapter of Part Ten (story text in story.js): the camp on the Reach finds where the Old Works
// draw their heat, gathers itself, sends a company of ten into the raid and leaves the furnace cold. No new people: Zayd,
// Corbin, Tahir and Bashir carry it. Rewards at item level 60-62; the last step grants the Part Ten title (achievement farShore).
Object.assign(ITEMS, {
  r_c32_boots: gear('Pit-Head Stair Boots', 'feet', 4, 60),
  r_c32_gloves: gear('Flue-Tester’s Gloves', 'hands', 4, 60),
  r_c32_legs: gear('Pump-Crew Greaves', 'legs', 4, 60),
  r_c32_helm: gear('Muster Helm of Ashfall', 'head', 4, 60),
  r_c32_maul: gear('Damper-Lever Maul', 'weapon', 4, 62),
  r_c32_charm: { ...gear('Charging-Plate Keepsake', 'trinket', 4, 62, true), desc: 'A corner of the First Furnace’s charging plate, cut with the last of the Makers’ tally marks.' },
  r_c32_mantle: gear('Mantle of the Far Shore', 'shoulders', 4, 61),
  r_c32_cloak: gear('Cold-Furnace Cloak', 'back', 4, 61),
});

// ============================================================================ PART ELEVEN: CHAPTER 33 (P11.1 story)
// "The Last Entry", the first chapter of Part Eleven (story text in story.js): Bashir and Ilyas read the Makers' last entry at the
// pit-head, a route north; Haroun and Zayd refit the ship with an armoured ice bow (driftwood off the Reach's beach for its backing,
// the iron Corbin's men pried off the works hauled down to the pier by handcart); then the ship sails north to the Rime Steps.
// Ilyas and Haroun came over on the last crossing, so each also stands on the Reach (n_ar_ilyas, n_ar_haroun); the Icefall
// Landing's camp warden Yusuf came north on the same ship as you. The Rime Steps route (SAIL.to.rime.need) waits for m_c33_refit.
Object.assign(ITEMS, {
  c33_drift: { name: 'Driftwood Baulk', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A heavy, salt-grey timber washed up on the black sand. Haroun wants it for the backing behind the ice bow.' },
  r_c33_gloves: gear('Beachcomber’s Gloves', 'hands', 4, 62),
  r_c33_boots: gear('Black-Sand Boots', 'feet', 4, 62),
  r_c33_greaves: gear('Handcart Greaves', 'legs', 4, 62),
  r_c33_charm: { ...gear('Rivet-Head Keepsake', 'trinket', 4, 62, true), desc: 'A spare rivet off the ice bow, its head still bright from the hammer.' },
  r_c33_helm: gear('Ice-Bow Riveter’s Helm', 'head', 4, 63),
  r_c33_hammer: gear('Plating Hammer of the Long Road', 'weapon', 4, 63),
  r_c33_mantle: gear('Mantle of the Long Road', 'shoulders', 4, 63),
  r_c33_cloak: gear('Icefall Landing Cloak', 'back', 4, 63),
});
NPCS.push(
  { id: 'n_ar_ilyas', name: 'Cartographer Ilyas', title: 'Explorers’ Guild', look: 'chemist', v: 2, x: 491.4, z: -1205.8, ry: -1.1, quests: [],
    greet: 'Every shore I ever charted, I charted from a boat. This is the first one I have stood on that no chart shows.' },
  { id: 'n_ar_haroun', name: 'Master Shipwright Haroun', title: 'Ashfall Landing Pier', look: 'villager', v: 0, x: 411.2, z: -1199.4, ry: Math.PI / 2, quests: [],
    greet: 'I built that hull for open water. Every crossing, I come over with it and look it over plate by plate.' },
  { id: 'n_rs_yusuf', name: 'Camp Warden Yusuf', title: 'Icefall Landing', look: 'warden', v: 0, x: 465.6, z: -1649.2, ry: -1.57, quests: [], vendor: 'general',
    greet: 'Stone walls, flat roofs and snow to the eaves. The Makers built these houses to last, and they have.' },
);
// driftwood on the Reach's west beach, north of the pier (gathered only while the refit wants it)
NODES.push(...[[433, -1207.5], [436.5, -1211], [431.5, -1213], [434, -1225.5], [433, -1229.5], [435, -1233], [437.5, -1237.5], [440.5, -1242]].map(([x, z], i) => ({ id: 'drift' + i, item: 'c33_drift', x, z, questOnly: true })));
// Corbin's crewman walks the handcart of iron sheet from the crew camp down the north track to the pier
ESCORTS.idris = { name: 'Crewman Idris', look: 'villager', v: 2, hp: 9000,
  path: [[545, -1263.4], [530, -1261], [516, -1255], [504, -1250], [490, -1240], [476, -1230], [469, -1215], [463, -1201], [448, -1200], [436, -1200], [422, -1199.8]],
  ambush: { 2: [['glasssentinel', 2]], 4: [['ashsentinel', 2], ['glasscrawler', 1]], 6: [['ashcrawler', 3]] },
  lines: { 0: 'The cart is loaded and the brakes are on. Walk beside me and keep the machines off the iron.', 2: 'Sentinels, off the terraces! Mind the cart!', 4: 'More of them! Hold the cart still and I will hold the iron.', 6: 'Crawlers! They can smell the iron from the dunes.', 8: 'The camp. Nearly there now.', end: 'Every sheet on the pier and not one dented. Tell Haroun the iron is his.' } };

// ============================================================================ MAIN STORY
// chains the story steps, moves givers and adds the story's own quests (see story.js)
applyStory(QUESTS, NPCS);

// ============================================================================ QUEST REWARD ART
// the quest rewards were made before the painted gear: give each the weapon type or armour weight its name suggests (for
// its model on the character and its icon) and its quality's material; named weapons and trinkets have art of their own
{
  const REWARD_ART = new Set(['r_smithblade', 'r_tinespear', 'r_hollisknife', 'r_hookblade', 'r_hadleyblade', 'r_quarryhammer', 'r_fusecutter', 'r_dreggmaul', 'r_scimitar', 'r_raskblades', 'r_epicweapon', 'r_hr_axe', 'r_hr_blade', 'r_sw_hammer', 'r_shaftpick',
    'r_millcharm', 'r_cachecharm', 'r_thresherheart', 'r_hadleycharm', 'r_charm', 'r_grinderheart', 'r_boreheart', 'r_lenscharm', 'r_colossuscore', 'r_foremanheart', 'r_legend1', 'r_hr_charm', 'r_hr_coil', 'r_sw_ring', 'r_marsh_ledger', 'r_hr_glasscharm',
    'r_surveyorrod', 'r_scholarrod', 'r_rod', 'r_overseerrod', 'r_shaftlamp']);
  const band = (q) => Math.max(0, Math.min(3, (q ?? 1) - 1));
  const WT = [[/maul|hammer|rockbreaker/i, 'hammer'], [/axe|pick/i, 'axe'], [/scimitar|sabre|hook|scythe|blades|sandreaver/i, 'scimitar'], [/mace/i, 'mace'], [/pistol|flintlock|sidearm/i, 'pistol'], [/bow\b/i, 'bow'], [/staff/i, 'staff']];
  const AW = [[/plate|greaves|pauldron|breastplate|helm|gauntlet|sabaton|spaulder|visor/i, 'plate'], [/hauberk|chain|mail|coif|legguard|bracer/i, 'mail'], [/robe|breeches|jerkin|mantle|hood|gloves|wraps|leggings|trousers|cap\b|coat|sash|tunic|mitts|shoes|slippers|cowl|vest/i, 'cloth']];
  const rewards = new Set(Object.values(QUESTS).flatMap((q) => q.rewards || []));
  for (const id of rewards) {
    const it = ITEMS[id];
    if (!it || it.wtype || it.otype || it.weight) continue;
    const b = band(it.q);
    if (it.slot === 'weapon') { it.wtype = (WT.find(([re]) => re.test(it.name)) || [0, 'sword'])[1]; it.icon = REWARD_ART.has(id) ? id : `w_${it.wtype}~${b}`; }
    else if (it.slot === 'trinket') it.icon = REWARD_ART.has(id) ? id : `t_trinket~${b}`;
    else if (it.slot === 'back') it.icon = `a_back~${b}`;
    else if (it.slot === 'offhand') { if (REWARD_ART.has(id)) it.icon = id; }
    else if (['head', 'shoulders', 'chest', 'hands', 'legs', 'feet'].includes(it.slot)) {
      it.weight = (AW.find(([re]) => re.test(it.name)) || [0, it.slot === 'feet' || it.slot === 'hands' ? 'mail' : 'plate'])[1];
      it.icon = `a_${it.weight}_${it.slot}~${b}`;
    }
  }
}
// bow rewards are the Ranger's alone (v107); each quest that pays one also offers a pistol twin with the same stats,
// appended to its rewards. The two point at each other (twin), and a hand-in gives whichever of the pair your class uses.
{
  const TWINS = [['r_cw_longbow', 'r_cw_pistol', 'Marksman’s Pistol', 'Carried by the depot’s tower marksmen for close work.'],
    ['r_sc_sling', 'r_sc_pistol', 'Skimmer-Plate Pistol', 'Its frame is cut from the plate of a salt skimmer.'],
    ['r_wk_bow', 'r_wk_pistol', 'Junkyard Pistol', 'Built from three broken pistols off the scrap heaps, and better than any of them.'],
    ['r_c23_bow', 'r_c23_pistol', 'Bronze-Bound Pistol', 'Makers’ bronze bands the barrel. It has not moved a hair in the cold.'],
    ['r_c21_bow', 'r_c21_pistol', 'Scrapway Pistol', 'A long barrel off a crawler’s gun mount, cut down and stocked.'],
    ['r_c18_bow', 'r_c18_pistol', 'Saltpan Pistol', 'Salt-white on the brass, and dry in any weather.'],
    ['r_c15_bow', 'r_c15_pistol', 'Harrowmouth Pistol', 'A harbour watchman’s pistol, oiled against the sea air.']];
  for (const [bow, id, name, desc] of TWINS) {
    const B = ITEMS[bow], band = Math.max(0, Math.min(3, (B.q ?? 1) - 1));
    B.classes = ['ranger']; B.twin = id;
    ITEMS[id] = { name, slot: 'weapon', wtype: 'pistol', classes: ['deadeye'], base: B.q >= 4 ? 'Pressure Pistol' : 'Steam Pistol', icon: `w_pistol~${band}`, q: B.q, ilvl: B.ilvl, stats: { ...B.stats }, desc, twin: bow };
    for (const Q of Object.values(QUESTS)) if (Q.rewards?.includes(bow) && !Q.rewards.includes(id)) Q.rewards.push(id);
  }
}


// ============================================================================ PART TEN: the Cinder Reach's machines (P10.3)
// three bands west to east: Ashfall Landing 40-41, the Slag Terraces 42-43, the Old Works 44-45 (models in client/assets/reachMachines.js)
Object.assign(ITEMS, {
  cinderore: { name: 'Lump of Cinder Ore', slot: 'junk', icon: 'gear', q: 0, stack: 20, price: 22, desc: 'Heavy, dark and still faintly warm. The Makers came a long way for this.' },
  r_wardenplate: gear('Unwound Warden\u2019s Plate', 'chest', 4, 56),
  r_haulerbelt: gear('Last Hauler\u2019s Skip-Chain Greaves', 'legs', 4, 56),
  r_ashwrightheart: { ...gear('Ashwright\u2019s Furnace Heart', 'trinket', 4, 58, true), desc: 'Still hot. It will be for a long time.' },
  r_ashwrightplate: gear('Smelter-Plate Pauldrons', 'shoulders', 4, 58),
  r_ashwrightmaul: { ...gear('Pour-Ladle Maul', 'weapon', 4, 58), wtype: 'hammer' },
});
const RM = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.4, aggro: 13, range: 3.0, swing: 2.3, xp, loot: 'reachMach', radius: 1.2, ...extra });
Object.assign(MOBS, {
  ashcrawler: RM('Ash Ore Crawler', 'orecrawler', 0, [40, 41], 1800, [34, 48], 900, { speed: 3.8, range: 2.8, radius: 1.3 }),
  slaghauler: RM('Slag Hauler', 'slaghauler', 0, [42, 43], 2400, [38, 54], 1050, { speed: 3.0, range: 3.4, swing: 2.6, radius: 1.5 }),
  ashsentinel: RM('Ash Sentinel', 'ashsentinel', 0, [42, 43], 2200, [40, 56], 1050, { radius: 1.1 }),
  glasscrawler: RM('Cinder-Glass Crawler', 'orecrawler', 1, [42, 43], 2000, [38, 52], 1000, { speed: 3.8, range: 2.8, radius: 1.3 }),
  glasssentinel: RM('Cinder-Glass Sentinel', 'ashsentinel', 1, [44, 45], 2900, [44, 60], 1200, { radius: 1.1 }),
  glasshauler: RM('Cinder-Glass Hauler', 'slaghauler', 1, [44, 45], 3100, [44, 62], 1250, { speed: 3.0, range: 3.4, swing: 2.6, radius: 1.5 }),
  furnacekeeper: RM('Furnace Keeper', 'furnacekeeper', 0, [45, 45], 10000, [60, 82], 2600, { elite: true, range: 3.8, swing: 2.4, radius: 1.3,
    abilities: [{ kind: 'nova', every: 14, r: 5, delay: 1.7, dmg: 1.3, text: 'The Furnace Keeper rakes its coals across the ground!' }] }),
  unwoundwarden: RM('The Unwound Warden', 'ashsentinel', 1, [44, 44], 15000, [48, 66], 4600, { elite: true, rare: true, loot: 'rareReach1', radius: 1.2,
    abilities: [{ kind: 'nova', every: 12, r: 6, delay: 1.8, dmg: 1.5, text: 'The Unwound Warden brings its slag hammer down!' }] }),
  lasthauler: RM('The Last Hauler', 'slaghauler', 1, [43, 43], 14000, [46, 64], 4400, { elite: true, rare: true, loot: 'rareReach2', speed: 3.2, range: 3.6, radius: 1.6,
    abilities: [{ kind: 'circles', every: 10, n: 4, r: 2.8, delay: 1.8, dmg: 1.3, text: 'The Last Hauler tips its skip of glowing slag!' }] }),
  ashwright: { name: 'The Ashwright', model: 'ashwright', lvl: [45, 45], hp: 64000, dmg: [54, 76], speed: 2.0, aggro: 12, range: 7, swing: 3.0, xp: 16000, loot: 'ashwright', radius: 5.0, elite: true, boss: true, world: true,
    notice: 'is crawling across the Old Works on the Cinder Reach, still smelting ore for masters long gone', yell: 'swings its ladle round and starts to pour!',
    abilities: [{ kind: 'circles', every: 9, n: 6, r: 3.6, delay: 2.0, dmg: 1.4, text: 'The Ashwright pours molten slag across the ground!' },
      { kind: 'nova', every: 17, r: 11, delay: 2.4, dmg: 1.7, text: 'The Ashwright vents its furnaces!' },
      { kind: 'adds', at: 0.5, mob: 'glasscrawler', n: 3, text: 'Ore crawlers roll out from the Ashwright\u2019s hoppers!' },
      { kind: 'enrage', at: 0.2, text: 'The Ashwright opens every furnace door at once!' }] },
});
Object.assign(LOOT_TABLES, {
  reachMach: { gold: [26, 40], items: [['cinderore', 0.45], ['bronzecog', 0.2], ['draught', 0.12]], gear: 0.4 },
  rareReach1: { gold: [240, 320], items: [['r_wardenplate', 1]], gear: 1, gearQ: 3 },
  rareReach2: { gold: [240, 320], items: [['r_haulerbelt', 1]], gear: 1, gearQ: 3 },
  ashwright: { gold: [400, 580], items: [['r_ashwrightheart', 0.35], ['r_ashwrightplate', 0.35], ['r_ashwrightmaul', 0.3], ['tonic', 1], ['cinderore', 1]], gear: 1, gearQ: 4, gearN: 2 },
});
LOOT_TABLES.reachMach.items.push(['boreblank', 0.4]); // The Gunsmith's Mark (the Powder Ledger, story.js): only drops while you are on it
SPAWNS.push(
  { mob: 'ashcrawler', x: 457, z: -1243, r: 6, n: 4 }, { mob: 'ashcrawler', x: 453, z: -1151, r: 10, n: 4 }, { mob: 'ashcrawler', x: 458, z: -1128, r: 6, n: 3 },
  { mob: 'slaghauler', x: 504, z: -1144, r: 8, n: 3 }, { mob: 'slaghauler', x: 525, z: -1133, r: 10, n: 3 }, { mob: 'slaghauler', x: 534, z: -1241, r: 10, n: 3 },
  { mob: 'ashsentinel', x: 510, z: -1230, r: 7, n: 3 }, { mob: 'ashsentinel', x: 507, z: -1178, r: 10, n: 3 }, { mob: 'ashsentinel', x: 543, z: -1169, r: 9, n: 3 },
  { mob: 'glasscrawler', x: 501, z: -1115, r: 6, n: 3 }, { mob: 'glasscrawler', x: 525, z: -1277, r: 9, n: 3 }, { mob: 'glasscrawler', x: 534, z: -1205, r: 9, n: 3 },
  { mob: 'glasssentinel', x: 570, z: -1214, r: 9, n: 3 }, { mob: 'glasssentinel', x: 561, z: -1133, r: 9, n: 3 }, { mob: 'glasssentinel', x: 599, z: -1246, r: 5, n: 2 },
  { mob: 'glasshauler', x: 564, z: -1277, r: 6, n: 3 }, { mob: 'glasshauler', x: 570, z: -1178, r: 8, n: 2 },
  { mob: 'furnacekeeper', x: 590, z: -1172, r: 8, n: 2 }, { mob: 'furnacekeeper', x: 594, z: -1224, r: 7, n: 2 }, { mob: 'furnacekeeper', x: 584, z: -1270, r: 4, n: 1 },
  { mob: 'unwoundwarden', x: 592, z: -1150, r: 8, n: 1 }, { mob: 'lasthauler', x: 497, z: -1268, r: 6, n: 1 },
  // (its loop keeps clear of the Ore Galleries door at 568, -1250, so a party walking out does not land on a world boss)
  { mob: 'ashwright', path: [[588, -1232], [606, -1214], [600, -1180], [570, -1200], [588, -1232]], r: 2, n: 1, world: true },
);

// ============================================================================ P10.4 THE ORE GALLERIES (dungeon, level 45)
// (block owned by the Ore Galleries work; story content for Chapters 30-31 goes in its own block)
// The mine the Makers cut for ore under the Old Works: machines still running its galleries. Three bosses, all machines:
// the Skip Engine (a slag-hauling engine), the Gallery Bore (a drill engine that bores through the walls) and the Great
// Sorter (the grading engine at the mine head, the last boss). Heroic is the raid kind (dmode raidheroic, after a Normal
// clear); there the bosses' named drops come at item level 60 (rhIlvl).
{
  const OG = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.4, aggro: 13, range: 3.0, swing: 2.2, xp, loot: 'oreTrash', radius: 1.2, ...extra });
  Object.assign(MOBS, {
    galcrawler: OG('Gallery Ore Crawler', 'orecrawler', 1, [44, 45], 2600, [42, 58], 1300, { speed: 3.8, range: 2.8, radius: 1.3 }),
    galsentinel: OG('Gallery Sentinel', 'ashsentinel', 0, [44, 45], 2800, [44, 60], 1350, { radius: 1.1 }),
    galhauler: OG('Ore Skip Hauler', 'slaghauler', 0, [44, 45], 3000, [44, 62], 1400, { speed: 3.0, range: 3.4, swing: 2.6, radius: 1.5 }),
    galkeeper: OG('Seam Keeper', 'furnacekeeper', 0, [44, 45], 3200, [46, 64], 1450, { range: 3.6, swing: 2.4, radius: 1.3 }),
    skipengine: OG('The Skip Engine', 'skipengine', 0, [45, 45], 19000, [50, 70], 5600, { loot: 'u_skipengine', rhIlvl: 60, speed: 3.2, range: 4.4, swing: 2.6, radius: 2.4, elite: true,
      abilities: [{ kind: 'circles', every: 11, n: 3, r: 3.2, delay: 1.8, dmg: 1.45, text: 'The Skip Engine tips its skip, and glowing slag runs across the floor!' },
        { kind: 'beam', every: 15, len: 16, r: 1.8, delay: 1.9, dmg: 1.5, text: 'The Skip Engine lines up on the rails and runs its skip down the hall!' },
        { kind: 'adds', at: 0.5, mob: 'galcrawler', n: 2, text: 'Two ore crawlers roll out of the side bays behind the Skip Engine!' }] }),
    gallerybore: OG('The Gallery Bore', 'gallerybore', 0, [45, 45], 20500, [52, 72], 5800, { loot: 'u_gallerybore', rhIlvl: 60, speed: 3.4, range: 4.2, swing: 2.4, radius: 2.4, elite: true,
      abilities: [{ kind: 'beam', every: 12, len: 18, r: 1.7, delay: 1.8, dmg: 1.5, text: 'The Gallery Bore swings its drill round and drives it at the wall!' },
        { kind: 'circles', every: 10, n: 4, r: 2.8, delay: 1.7, dmg: 1.4, text: 'Stone cracks loose from the roof as the Gallery Bore grinds through the rock!' },
        { kind: 'adds', at: 0.5, mob: 'galsentinel', n: 2, text: 'The Gallery Bore breaks into an old gallery, and the sentinels inside step out!' }] }),
    greatsorter: OG('The Great Sorter', 'greatsorter', 0, [46, 46], 160000, [58, 80], 16000, { loot: 'u_greatsorter', rhIlvl: 60, speed: 2.6, range: 5.0, swing: 2.8, radius: 3.6, elite: true, boss: true,
      abilities: [{ kind: 'circles', every: 10, n: 4, r: 3.2, delay: 1.8, dmg: 1.45, text: 'The Great Sorter swings its grab buckets out and drops a load of ore!' },
        { kind: 'nova', every: 16, r: 8, delay: 2.2, dmg: 1.6, text: 'The Great Sorter shakes its grading screens, and the whole floor shakes with them!' },
        { kind: 'adds', at: 0.5, mob: 'galkeeper', n: 3, text: 'Seam keepers come down from the sorting bins to tend the Great Sorter!' }] }),
  });
  // named drops: item level 56 (the Skip Engine), 57 (the Gallery Bore) and 58 (the Great Sorter), raised to 60 on Heroic
  const ST = {
    weapon: { power: 118, hp: 40, crit: 7 }, trinket: { power: 100, hp: 44, haste: 30 },
    plate: { armor: 420, hp: 112, power: 24 }, mail: { armor: 380, hp: 110, crit: 8 }, cloth: { armor: 380, hp: 96, power: 30 },
  };
  const W = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'];
  const N = (name, slot, kind, ilvl, desc) => {
    const w = W.includes(kind) ? kind : null, wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    const base = ST[w ? 'weapon' : wt || 'trinket'], k = (ilvl / 50) * 1.45, stats = {}; // above the Chapter 31 rewards, so the Galleries are worth farming
    for (const [s, v] of Object.entries(base)) stats[s] = Math.round(v * k);
    const icon = w ? `w_${w}~3` : wt ? `a_${wt}_${slot}~3` : 't_trinket~3';
    return { name, slot, q: 4, ilvl, req: 44, stats, desc, unique: true, icon, ...(w ? { wtype: w } : {}), ...(w === 'pistol' ? { classes: ['deadeye'] } : {}), ...(wt ? { weight: wt } : {}) };
  };
  const drops = {
    skipengine: [['Skip-Tipper’s Mace', 'weapon', 'mace', 56, 'The lever that tipped the skip, with a head forged on.'], ['Slag-Apron Greaves', 'legs', 'plate', 56, 'Splashed a thousand times, and never burnt through.'], ['Skip-Signal Pistol', 'weapon', 'pistol', 56, 'Fired once to tell the tip crew the skip was coming. It is louder than it needs to be.']],
    gallerybore: [['Bore-Bit Pick', 'weapon', 'axe', 57, 'A tooth off the Gallery Bore’s drill, on a haft of shoring timber.'], ['Rock-Dust Hood', 'head', 'cloth', 57, 'Grey with the dust of a gallery cut a thousand years ago.']],
    greatsorter: [['Grading-Screen Hauberk', 'chest', 'mail', 58, 'Links sized to the Sorter’s finest screen.'], ['The Assayer’s Weight', 'trinket', 'trinket', 58, 'The Makers’ standard for good ore. Heavier than it looks.'], ['Sorting-Floor Hammer', 'weapon', 'hammer', 58, 'For breaking the lumps the screens would not pass.']],
  };
  for (const [mob, list] of Object.entries(drops)) list.forEach(([name, slot, kind, ilvl, desc], i) => {
    ITEMS[`u_${mob}${i + 1}`] = N(name, slot, kind, ilvl, desc);
  });
  const T = (mob, gold, extra, gearQ, gearN) => {
    const ids = drops[mob].map((_, i) => `u_${mob}${i + 1}`);
    return { gold, items: [...ids.map((id) => [id, mob === 'greatsorter' ? 0.3 : 0.25]), ...extra], gear: 1, gearQ, gearN };
  };
  const boss = [['tonic', 1], ['cinderore', 1]], last = [['draught', 1], ['cinderore', 1]];
  Object.assign(LOOT_TABLES, {
    oreTrash: { gold: [28, 42], items: [['cinderore', 0.4], ['bronzecog', 0.25], ['draught', 0.12]], gear: 0.4 },
    u_skipengine: T('skipengine', [160, 220], boss, 3, 2), u_gallerybore: T('gallerybore', [160, 220], boss, 3, 2), u_greatsorter: T('greatsorter', [460, 640], last, 4, 3),
  });
  // trash packs room by room, south to north (local metres in the dungeon grid)
  SPAWNS.push(
    ds('oregalleries', 'galsentinel', 56, 84, 2, 2), ds('oregalleries', 'galcrawler', 46, 77, 2, 2),
    ds('oregalleries', 'galhauler', 38, 72, 3, 2), ds('oregalleries', 'galcrawler', 22, 66, 3, 2), ds('oregalleries', 'skipengine', 32, 66, 1, 1),
    ds('oregalleries', 'galsentinel', 34, 53, 2, 2), ds('oregalleries', 'galkeeper', 56, 45, 3, 2), ds('oregalleries', 'galhauler', 62, 42, 3, 1), ds('oregalleries', 'galcrawler', 76, 47, 2, 2),
    ds('oregalleries', 'galsentinel', 92, 58, 3, 2), ds('oregalleries', 'galhauler', 100, 47, 3, 1), ds('oregalleries', 'gallerybore', 97, 52, 1, 1),
    ds('oregalleries', 'galkeeper', 91, 36, 2, 2), ds('oregalleries', 'galcrawler', 82, 26, 2, 2),
    ds('oregalleries', 'galsentinel', 48, 18, 3, 2), ds('oregalleries', 'galkeeper', 72, 17, 3, 2),
    ds('oregalleries', 'greatsorter', 60, 15, 1, 1),
  );
}

// ============================================================================ P10.4 part 2: Chapter 30-31 loot and reputation
// the chapters' quest items come off any of the island's machines, only for players on the quest (sim.js loot); kills in the
// Ore Galleries count toward the Cinderwrights, like the island itself
LOOT_TABLES.reachMach.items.push(['c30_ore', 0.55], ['c31_plate', 0.5]);
FACTIONS.cinderwrights.zones.push('oregalleries', ...(DUNGEON_BY_ID.oregalleries?.areas || []).map((a) => a[0]));

// Corbin's crew: hired hands from the Copy-Works, now camped on the Reach (no quests; they give the camp people)
NPCS.push(
  { id: 'n_ar_crew1', name: 'Hob', title: 'Benedek’s Old Crew', look: 'villager', v: 5, x: 545.5, z: -1261, ry: 0.9, quests: [], greet: 'Corbin does the talking. Ask him.' },
  { id: 'n_ar_crew2', name: 'Lennart', title: 'Benedek’s Old Crew', look: 'villager', v: 7, x: 550.2, z: -1264.5, ry: -2.2, quests: [], greet: 'Brass is brass, wherever it lies. That was the idea, anyway.' },
  { id: 'n_ar_crew3', name: 'Piet', title: 'Benedek’s Old Crew', look: 'villager', v: 9, x: 549.6, z: -1258.4, ry: -0.6, quests: [], greet: 'We never meant to wake anything down there. Truly.' },
);

// ============================================================================ P10.5 THE MAKERS' FIRST FURNACE (raid, level 45)
// (block owned by the First Furnace raid work; Chapter 32's story goes in story.js, not here)
// The casting hall at the heart of the Old Works, where the Makers poured their first engines. Four bosses, all machines:
// the Bellows Engine (the blowing engine that fed the furnace air), the Crucible Crane (the gantry that carried the pours),
// the Pattern Caster (the moulding press that made the shapes) and the First Furnace itself, a towering square furnace
// engine that ends the raid. Ten players, Normal and Heroic (the raid kind, after a Normal clear); weekly lockouts per boss
// (sim.js m.def.raid); named drops at item level 60-62, raised to 64 on Heroic (rhIlvl); Makers' marks from every boss.
// The door (shared/dungeons.js) opens once Chapter 31 is done (need.done m_c31_accord).
{
  const FF = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.4, aggro: 13, range: 3.2, swing: 2.2, xp, loot: 'furnaceRaid', radius: 1.2, elite: true, ...extra });
  Object.assign(MOBS, {
    // trash: the island's own machines, still tending the hall
    ffkeeper: FF('Casting-Hall Keeper', 'furnacekeeper', 0, [45, 45], 4200, [48, 66], 1600, { range: 3.6, swing: 2.4, radius: 1.3 }),
    ffsentinel: FF('Pit Sentinel', 'ashsentinel', 1, [45, 45], 3800, [46, 64], 1550, { radius: 1.1 }),
    ffhauler: FF('Ladle Hauler', 'slaghauler', 1, [45, 45], 4400, [48, 68], 1650, { speed: 3.0, range: 3.4, swing: 2.6, radius: 1.5 }),
    ffcrawler: FF('Slag-Pit Crawler', 'orecrawler', 1, [45, 45], 3400, [44, 60], 1500, { speed: 3.8, range: 2.8, radius: 1.3 }),
    // 1. the Bellows Engine: a long blowing engine on treads, two great pleated bellows working on its back
    bellowsengine: FF('The Bellows Engine', 'bellowsengine', 0, [45, 45], 205000, [56, 76], 30000, { loot: 'u_bellowsengine', rhIlvl: 64, speed: 2.8, aggro: 18, range: 4.8, swing: 2.4, radius: 3.0, boss: true, raid: true,
      abilities: [
        { kind: 'nova', every: 13, r: 7, delay: 2.0, dmg: 1.55, text: 'The Bellows Engine fills its boards with a long draw of air, and blows the whole floor clear!' },
        { kind: 'beam', every: 11, len: 22, r: 2.0, delay: 1.7, dmg: 1.55, text: 'The Bellows Engine swings its nozzle round and drives a blast of hot air down the hall!' },
        { kind: 'circles', every: 10, n: 5, r: 3.0, delay: 1.8, dmg: 1.45, text: 'Hot cinders blow up out of the floor grates!' },
        { kind: 'adds', at: 0.5, mob: 'ffcrawler', n: 3, text: 'Slag crawlers roll out from under the bellows boards!' }] }),
    // 2. the Crucible Crane: a gantry on rail trucks, a square crucible of molten metal swinging under its trolley
    cruciblecrane: FF('The Crucible Crane', 'cruciblecrane', 0, [45, 45], 220000, [58, 80], 32000, { loot: 'u_cruciblecrane', rhIlvl: 64, speed: 2.4, aggro: 18, range: 5.4, swing: 2.8, radius: 3.4, boss: true, raid: true,
      abilities: [
        { kind: 'circles', every: 10, n: 6, r: 3.2, delay: 1.9, dmg: 1.5, text: 'The Crucible Crane tips its crucible, and molten metal splashes across the pits!' },
        { kind: 'beam', every: 13, len: 26, r: 2.2, delay: 1.8, dmg: 1.6, text: 'The Crucible Crane runs the length of its rails!' },
        { kind: 'adds', at: 0.6, mob: 'ffhauler', n: 2, text: 'Ladle haulers come up out of the casting pits!' },
        { kind: 'enrage', at: 0.15, text: 'The Crucible Crane’s brakes give out!' }] }),
    // 3. the Pattern Caster: the moulding press that made the Makers' shapes, a ram over a moulding flask, two pouring ladles
    patterncaster: FF('The Pattern Caster', 'patterncaster', 0, [45, 45], 230000, [60, 82], 34000, { loot: 'u_patterncaster', rhIlvl: 64, speed: 2.6, aggro: 18, range: 5.0, swing: 2.6, radius: 3.2, boss: true, raid: true,
      abilities: [
        { kind: 'nova', every: 12, r: 7.5, delay: 1.9, dmg: 1.6, text: 'The Pattern Caster brings its ram down on the flask, and the floor jumps!' },
        { kind: 'circles', every: 11, n: 5, r: 3.4, delay: 1.9, dmg: 1.5, text: 'The Pattern Caster pours both ladles out across the floor!' },
        { kind: 'adds', at: 0.5, mob: 'ffsentinel', n: 3, text: 'Pit sentinels step out of the moulding sand, fresh from the pattern!' },
        { kind: 'enrage', at: 0.12, text: 'The Pattern Caster casts faster than the sand can set!' }] }),
    // 4. THE FIRST FURNACE: the towering square furnace engine at the end of the hall, which hardly moves; three phases
    firstfurnace: FF('The First Furnace', 'firstfurnace', 0, [46, 46], 315000, [62, 86], 42000, { loot: 'u_firstfurnace', rhIlvl: 64, speed: 0.6, aggro: 20, range: 9.0, swing: 3.0, radius: 5.4, boss: true, raid: true,
      abilities: [
        { kind: 'circles', every: 11, n: 6, r: 3.2, delay: 1.9, dmg: 1.5, above: 0.66, text: 'The First Furnace opens its tapping holes, and metal runs down the pouring channels!' },
        { kind: 'nova', every: 14, r: 8, delay: 2.2, dmg: 1.6, text: 'The First Furnace’s grille glows white, and the heat rolls out across the hall!' },
        { kind: 'phase', below: 0.66, text: 'The bellows roar. The First Furnace runs hotter than the Makers ever ran it.' },
        { kind: 'adds', at: 0.66, mob: 'ffkeeper', n: 3, text: 'Casting-hall keepers come down from the charging floor to feed the furnace!' },
        { kind: 'beam', every: 10, len: 24, r: 2.3, delay: 1.6, dmg: 1.6, below: 0.66, text: 'The First Furnace taps a pour straight down the channel!' },
        { kind: 'phase', below: 0.33, text: 'The First Furnace’s lining cracks. Metal runs from every seam.' },
        { kind: 'circles', every: 8, n: 8, r: 3.0, delay: 1.6, dmg: 1.55, below: 0.33, text: 'Molten metal spills from every seam of the First Furnace!' },
        { kind: 'adds', at: 0.33, mob: 'ffcrawler', n: 4, text: 'Slag crawlers pour out of the furnace’s ash pit!' },
        { kind: 'enrage', at: 0.1, text: 'The First Furnace burns through its own grate!' }] }),
  });
  // named drops: item level 60 (the Bellows Engine), 61 (the Crane and the Caster), 62 (the First Furnace), 64 on Heroic.
  // The same stat budget as the Ore Galleries' named drops (x1.45 over the item-level line).
  const ST = {
    weapon: { power: 118, hp: 40, crit: 7 }, trinket: { power: 100, hp: 44, haste: 30 },
    plate: { armor: 420, hp: 112, power: 24 }, mail: { armor: 380, hp: 110, crit: 8 }, cloth: { armor: 380, hp: 96, power: 30 },
  };
  const W = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'];
  const N = (name, slot, kind, ilvl, desc) => {
    const w = W.includes(kind) ? kind : null, wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    const base = ST[w ? 'weapon' : wt || 'trinket'], k = (ilvl / 50) * 1.45, stats = {};
    for (const [s, v] of Object.entries(base)) stats[s] = Math.round(v * k);
    const icon = w ? `w_${w}~3` : wt ? `a_${wt}_${slot}~3` : 't_trinket~3';
    return { name, slot, q: 4, ilvl, req: 45, stats, desc, unique: true, icon, ...(w ? { wtype: w } : {}), ...(w === 'pistol' ? { classes: ['deadeye'] } : {}), ...(wt ? { weight: wt } : {}) };
  };
  const drops = {
    bellowsengine: [
      ['Bellows-Board Pauldrons', 'shoulders', 'plate', 60, 'Cut from the Bellows Engine’s boards. They still creak when you breathe in.'],
      ['Nozzle-Bore Bow', 'weapon', 'bow', 60, 'Strung across a length of bellows nozzle, polished by a thousand years of hot air.'],
      ['Pleated Canvas Gloves', 'hands', 'cloth', 60, 'Folded from the bellows’ own canvas, oiled against the heat.']],
    cruciblecrane: [
      ['Crane-Hook Axe', 'weapon', 'axe', 61, 'The crucible crane’s lifting hook, ground to an edge.'],
      ['Gantry-Rail Greaves', 'legs', 'plate', 61, 'Rolled from the same iron as the crane’s rails.'],
      ['Pour-Guard Hauberk', 'chest', 'mail', 61, 'The links the crane men wore to stand under a pour.'], ['Crane-Signal Pistol', 'weapon', 'pistol', 61, 'The crane men fired it to clear the floor before a pour. The barrel is scorched brown.']],
    patterncaster: [
      ['Pattern-Maker’s Rod', 'weapon', 'rod', 61, 'The rule the Makers checked their patterns against, shod in brass.'],
      ['Moulding-Sand Hood', 'head', 'cloth', 61, 'Grey with the fine sand of the first moulds.'],
      ['Flask-Iron Boots', 'feet', 'mail', 61, 'Clamped like a moulding flask. Nothing gets in.']],
    firstfurnace: [
      ['The First Pour', 'weapon', 'hammer', 62, 'Cast in the first mould the Makers ever filled, and never bettered.'],
      ['Furnace-Grate Breastplate', 'chest', 'plate', 62, 'Plate from the First Furnace’s own grate, still faintly warm.'],
      ['Tuyere Staff', 'weapon', 'staff', 62, 'A blast pipe from the furnace wall, long enough to lean on.'],
      ['The Furnace-Master’s Gauge', 'trinket', 'trinket', 62, 'It reads the heat of a furnace at a glance. This one reads cold now.'],
      ['Charging-Floor Mantle', 'shoulders', 'cloth', 62, 'Worn by whoever fed the furnace from the charging floor.']],
  };
  for (const [mob, list] of Object.entries(drops)) list.forEach(([name, slot, kind, ilvl, desc], i) => { ITEMS[`u_${mob}${i + 1}`] = N(name, slot, kind, ilvl, desc); });
  const T = (mob, gold, ch, extra, gearN) => ({ gold, items: [...drops[mob].map((_, i) => [`u_${mob}${i + 1}`, ch]), ...extra], gear: 1, gearQ: 4, gearN });
  Object.assign(LOOT_TABLES, {
    furnaceRaid: { gold: [60, 90], items: [['cinderore', 0.5], ['bronzecog', 0.3], ['draught', 0.2]], gear: 0.45, gearQ: 3 },
    u_bellowsengine: T('bellowsengine', [800, 1000], 0.3, [['tonic', 1], ['cinderore', 1]], 2),
    u_cruciblecrane: T('cruciblecrane', [850, 1050], 0.3, [['tonic', 1], ['cinderore', 1]], 2),
    u_patterncaster: T('patterncaster', [900, 1100], 0.3, [['tonic', 1], ['cinderore', 1]], 2),
    u_firstfurnace: T('firstfurnace', [1200, 1500], 0.28, [['draught', 1], ['cinderore', 1]], 3),
  });
  // Makers' marks for Quartermaster Hamid, more from each boss down the hall
  for (const [t, n] of [['u_bellowsengine', 6], ['u_cruciblecrane', 6], ['u_patterncaster', 7], ['u_firstfurnace', 12]]) for (let i = 0; i < n; i++) LOOT_TABLES[t].items.push(['makermark', 1]);
  // and a furnace-marked row in Hamid's stock to spend them on (item level 60)
  Object.assign(ITEMS, {
    mk_fhelm: { name: 'Furnace-Marked Helm', slot: 'head', icon: 'a_plate_head~3', weight: 'plate', q: 4, stats: { armor: 700, hp: 188, power: 40 }, ilvl: 60 },
    mk_fcoif: { name: 'Furnace-Marked Coif', slot: 'head', icon: 'a_mail_head~3', weight: 'mail', q: 4, stats: { armor: 620, hp: 182, crit: 13 }, ilvl: 60 },
    mk_fhood: { name: 'Furnace-Marked Hood', slot: 'head', icon: 'a_cloth_head~3', weight: 'cloth', q: 4, stats: { armor: 410, hp: 150, power: 46 }, ilvl: 60 },
    mk_fcharm: { name: 'Furnace-Marked Keepsake', slot: 'trinket', icon: 't_trinket~3', q: 4, stats: { power: 120, hp: 66, crit: 15 }, ilvl: 60 },
  });
  MARK_SHOP.push({ item: 'mk_fhelm', price: 70 }, { item: 'mk_fcoif', price: 70 }, { item: 'mk_fhood', price: 70 }, { item: 'mk_fcharm', price: 90 });
  // the halls, south to north (local metres in the raid grid): trash packs on the way, each boss in its own hall
  SPAWNS.push(
    ds('firstfurnace', 'ffsentinel', 68, 150, 1, 1), ds('firstfurnace', 'ffsentinel', 76, 150, 1, 1),
    ds('firstfurnace', 'ffkeeper', 46, 138, 3, 2), ds('firstfurnace', 'ffhauler', 88, 138, 3, 2), ds('firstfurnace', 'ffcrawler', 48, 122, 3, 2),
    ds('firstfurnace', 'bellowsengine', 66, 129, 1, 1),
    ds('firstfurnace', 'ffsentinel', 86, 112, 1, 2),
    ds('firstfurnace', 'ffhauler', 38, 100, 3, 2), ds('firstfurnace', 'ffkeeper', 102, 100, 3, 2), ds('firstfurnace', 'ffcrawler', 40, 80, 3, 2), ds('firstfurnace', 'ffsentinel', 100, 80, 3, 2),
    ds('firstfurnace', 'cruciblecrane', 70, 90, 1, 1),
    ds('firstfurnace', 'ffkeeper', 47, 68, 1, 2),
    ds('firstfurnace', 'ffhauler', 36, 52, 3, 2), ds('firstfurnace', 'ffsentinel', 84, 58, 3, 2),
    ds('firstfurnace', 'patterncaster', 58, 52, 1, 1),
    ds('firstfurnace', 'ffcrawler', 76, 39, 1, 2),
    ds('firstfurnace', 'ffkeeper', 32, 28, 3, 2), ds('firstfurnace', 'ffhauler', 108, 28, 3, 2), ds('firstfurnace', 'ffsentinel', 50, 30, 3, 2), ds('firstfurnace', 'ffcrawler', 92, 30, 3, 2),
    ds('firstfurnace', 'firstfurnace', 70, 17, 1, 1),
  );
  // the pit-head stands where a pack of glass haulers worked the plateau: move that pack south to the level ground by the first works pad,
  // clear of both doors and the Ashwright's road
  { const H = SPAWNS.find((q) => q.mob === 'glasshauler' && q.x === 564 && q.z === -1277); if (H) { H.x = 571; H.z = -1158; H.r = 5; } }
  // kills in the raid count toward the Cinderwrights, like the island and the Ore Galleries
  FACTIONS.cinderwrights.zones.push('firstfurnace');
  // homestead plaques for the Normal and Heroic clears
  HOME_TROPHIES.push(['plaque_furnace', 'First Furnace plaque', { ach: 'rFirstFurnace' }], ['plaque_hfurnace', 'Gilded First Furnace plaque (Heroic)', { ach: 'rhFirstFurnace' }]);
}

// ============================================================================ PART ELEVEN: THE RIME STEPS (P11.2)
// the glacier valley north of the Cinder Reach has its own terrain box (shared/rime.js, registered in shared/areas.js). Once
// the ship has its ice bow (m_c33_refit, Chapter 33), Harbour Master Zayd on the Reach pier also sails north; the Rime Steps' own harbour master
// on the Icefall Landing pier sails back to the Reach or straight home to Harrowmouth. A crossing lands you within a few
// metres of the man who can sail you on.
SAIL.to.rime = { x: RIME.landing.x, z: RIME.landing.z, name: 'the Rime Steps', need: 'm_c33_refit', notReady: 'The ship is not fitted for the ice yet.',
  say: 'The ship pushes north along the cold coast, the ice bow shouldering through the floe ice, until the white cliffs of the Rime Steps come up out of the fog.' };
SAIL.to.reach.sayFrom = { rime: 'The ship runs south out of the ice, and by evening the black beaches of the Cinder Reach are back under the bow.' };
SAIL.to.valley.sayFrom = { rime: 'The ship runs south out of the ice, past the Cinder Reach without stopping, and on over the sea to Harrowmouth.' };
NPCS.find((n) => n.id === 'n_ar_zayd').sails = ['valley', 'rime'];
NPCS.push(
  { id: 'n_rs_nasir', name: 'Harbour Master Nasir', title: 'Icefall Landing Pier', look: 'villager', v: 0, x: RIME.harbour.x, z: RIME.harbour.z, ry: RIME.harbour.ry, sail: 'reach', sails: ['reach', 'valley'], quests: [],
    greet: 'Mind the ice on the planks. Every flume and sluice up this valley was cut by hand, and the water still knows the way down.' },
  { id: 'n_cv_icefall', name: 'Caravan Master Bilal', title: 'Caravans', look: 'villager', v: 1, x: RIME.caravan.x, z: RIME.caravan.z - 2, ry: 0.2, caravan: 'icefall',
    greet: 'No caravan gets up these terraces, and none crosses the sea. I keep the post, and I can set your compass to this camp.' },
);
// the valley's caravan stop has no routes (the only way off is the ship), but it can be the Homeward Compass's home
CARAVANS.push({ id: 'icefall', name: 'Icefall Landing', x: RIME.caravan.x, z: RIME.caravan.z, zone: 'icefall' });
GRAVEYARDS.push({ x: RIME.grave.x, z: RIME.grave.z });
// the Rime Steps' own reputation, kept by the harbour master (its shop comes with P11.6)
FACTIONS.flumewrights = { name: 'The Flumewrights', color: '#6fb6d8', zones: ['icefall', 'flumeworks', 'damcrown'], qm: 'n_rs_nasir', questRep: 0.4 };
// the Main Story ran (applyStory) before the Rime Steps' men were placed: give them their story quests
for (const [id, Q] of Object.entries(QUESTS)) if (Q.msq) { const g = NPCS.find((n) => n.id === Q.giver); if (g && !(g.quests ||= []).includes(id)) g.quests.push(id); }

// ============================================================================ PART ELEVEN: the Rime Steps' machines (P11.3)
// three terraces west to east: Icefall Landing 45-46, the Flume Works 47-48, the Dam Crown 49-50 (models in client/assets/rimeMachines.js)
Object.assign(ITEMS, {
  frostore: { name: 'Frost-Bound Ore', slot: 'junk', icon: 'gear', q: 0, stack: 20, price: 30, desc: 'Ore the Makers dug and never smelted, cased in old ice.' },
  r_wheelplate: gear('Frozen Wheel Breastplate', 'chest', 4, 64),
  r_sluicegreaves: gear('Sluicewarden\u2019s Greaves', 'legs', 4, 64),
  r_spillheart: { ...gear('Spillway Engine\u2019s Governor', 'trinket', 4, 66, true), desc: 'A brass governor that once held back a lake. It still turns, slowly.' },
  r_spillplate: gear('Spillway Gate Pauldrons', 'shoulders', 4, 66),
  r_spillmaul: { ...gear('Gate-Winder\u2019s Maul', 'weapon', 4, 66), wtype: 'hammer' },
});
const IM = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.4, aggro: 13, range: 3.0, swing: 2.3, xp, loot: 'rimeMach', radius: 1.2, ...extra });
Object.assign(MOBS, {
  sluicekeeper: IM('Sluice Keeper', 'sluicekeeper', 0, [45, 46], 3300, [46, 62], 1450, { speed: 3.0, radius: 1.3 }),
  flumewalker: IM('Flume Walker', 'flumewalker', 0, [45, 46], 3100, [44, 60], 1400, { speed: 3.8, range: 3.4, radius: 1.0 }),
  wheelhammer: IM('Wheel Hammer', 'wheelhammer', 0, [47, 48], 3800, [50, 68], 1600, { speed: 2.8, range: 3.6, swing: 2.7, radius: 1.6 }),
  bronzewalker: IM('Bronze Flume Walker', 'flumewalker', 1, [47, 48], 3600, [48, 64], 1550, { speed: 3.8, range: 3.4, radius: 1.0 }),
  damsentry: IM('Dam Sentry', 'damsentry', 0, [49, 50], 4300, [54, 72], 1750, { radius: 1.2 }),
  bronzesentry: IM('Old Bronze Sentry', 'damsentry', 1, [49, 50], 12000, [72, 96], 1800, { radius: 1.2, elite: true,
    abilities: [{ kind: 'nova', every: 14, r: 5, delay: 1.7, dmg: 1.3, text: 'The Old Bronze Sentry slams the ice!' }] }),
  frozenwheel: IM('The Frozen Wheel', 'wheelhammer', 1, [48, 48], 22000, [68, 92], 5200, { elite: true, rare: true, loot: 'rareRime1', speed: 2.8, range: 3.8, radius: 1.7,
    abilities: [{ kind: 'circles', every: 10, n: 4, r: 2.8, delay: 1.8, dmg: 1.3, text: 'The Frozen Wheel brings its tilt-hammer down!' }] }),
  sluicewarden: IM('The Last Sluicewarden', 'sluicekeeper', 1, [50, 50], 25000, [70, 94], 5600, { elite: true, rare: true, loot: 'rareRime2', radius: 1.4,
    abilities: [{ kind: 'nova', every: 12, r: 6, delay: 1.8, dmg: 1.5, text: 'The Last Sluicewarden opens its gates!' }] }),
  spillwayengine: { name: 'The Spillway Engine', model: 'spillwayengine', lvl: [50, 50], hp: 88000, dmg: [62, 86], speed: 2.0, aggro: 12, range: 7, swing: 3.0, xp: 19000, loot: 'spillway', radius: 5.0, elite: true, boss: true, world: true,
    notice: 'is grinding across the frozen lake behind the Dam Crown, still trying to open gates that froze shut long ago', yell: 'heaves its spillway gate open!',
    abilities: [{ kind: 'circles', every: 9, n: 6, r: 3.6, delay: 2.0, dmg: 1.4, text: 'The Spillway Engine sends meltwater sheeting across the ice!' },
      { kind: 'nova', every: 17, r: 11, delay: 2.4, dmg: 1.7, text: 'The Spillway Engine blows its sluices!' },
      { kind: 'adds', at: 0.5, mob: 'sluicekeeper', n: 3, text: 'Sluice keepers wind out of the Spillway Engine\u2019s gatehouse!' },
      { kind: 'enrage', at: 0.2, text: 'The Spillway Engine throws every gate wide!' }] },
});
Object.assign(LOOT_TABLES, {
  rimeMach: { gold: [30, 46], items: [['frostore', 0.45], ['bronzecog', 0.2], ['draught', 0.12]], gear: 0.4 },
  rareRime1: { gold: [260, 340], items: [['r_wheelplate', 1]], gear: 1, gearQ: 3 },
  rareRime2: { gold: [260, 340], items: [['r_sluicegreaves', 1]], gear: 1, gearQ: 3 },
  spillway: { gold: [440, 620], items: [['r_spillheart', 0.35], ['r_spillplate', 0.35], ['r_spillmaul', 0.3], ['tonic', 1], ['frostore', 1]], gear: 1, gearQ: 4, gearN: 2 },
});
SPAWNS.push(
  { mob: 'sluicekeeper', x: 451, z: -1692, r: 6, n: 3 }, { mob: 'sluicekeeper', x: 465, z: -1594, r: 6, n: 3 },
  { mob: 'flumewalker', x: 479, z: -1706, r: 6, n: 3 }, { mob: 'flumewalker', x: 479, z: -1566, r: 6, n: 3 },
  { mob: 'wheelhammer', x: 507, z: -1671, r: 6, n: 3 }, { mob: 'wheelhammer', x: 542, z: -1699, r: 6, n: 3 }, { mob: 'wheelhammer', x: 549, z: -1615, r: 6, n: 2 },
  { mob: 'bronzewalker', x: 514, z: -1629, r: 6, n: 3 }, { mob: 'bronzewalker', x: 563, z: -1587, r: 5, n: 2 },
  { mob: 'damsentry', x: 584, z: -1706, r: 5, n: 3 }, { mob: 'damsentry', x: 584, z: -1636, r: 5, n: 3 }, { mob: 'damsentry', x: 612, z: -1622, r: 6, n: 3 },
  { mob: 'bronzesentry', x: 612, z: -1692, r: 5, n: 2 }, { mob: 'bronzesentry', x: 584, z: -1671, r: 4, n: 1 },
  { mob: 'frozenwheel', x: 535, z: -1657, r: 5, n: 1 }, { mob: 'sluicewarden', x: 612, z: -1657, r: 5, n: 1 },
  { mob: 'spillwayengine', path: [[620, -1700], [632, -1660], [620, -1615], [628, -1655], [620, -1700]], r: 2, n: 1, world: true },
);

// ============================================================================ P11.4 THE SLUICE GALLERIES (dungeon, level 50)
// (block owned by the Sluice Galleries work; Chapters 34-35's story goes in story.js, not here)
// The Makers' sluice tunnels and gate chambers inside the old dam on the Rime Steps, and the danger is the dam itself: the
// gates are failing and the water is coming through. Three bosses, all machines: the Gate Winder (the winding engine that
// raised and lowered the sluice gates), the Turbine Heart (the water turbine that drove the works' hammers) and the
// Floodgate (the last gate of the dam, the last boss: below half health its gate gives way and the hall floods). Their
// strikes are water (water/teleColor: blue circles that burst as spray, client game.js). Heroic is the raid kind
// (dmode raidheroic, after a Normal clear); there the bosses' named drops come at item level 68 (rhIlvl).
{
  const SG = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.4, aggro: 13, range: 3.0, swing: 2.3, xp, loot: 'sluiceTrash', radius: 1.2, ...extra });
  const WET = { water: true, teleColor: '#2f9cff', novaColor: '#6ad0ff' };
  Object.assign(MOBS, {
    sgkeeper: SG('Gallery Sluice Keeper', 'sluicekeeper', 0, [49, 50], 4200, [54, 72], 1700, { speed: 3.0, radius: 1.3 }),
    sgwalker: SG('Gallery Flume Walker', 'flumewalker', 1, [49, 50], 4000, [52, 70], 1650, { speed: 3.8, range: 3.4, radius: 1.0 }),
    sghammer: SG('Gallery Wheel Hammer', 'wheelhammer', 0, [49, 50], 4700, [56, 76], 1800, { speed: 2.8, range: 3.6, swing: 2.7, radius: 1.6 }),
    sgsentry: SG('Gallery Dam Sentry', 'damsentry', 1, [49, 50], 4500, [55, 74], 1750, { radius: 1.2 }),
    gatewinder: SG('The Gate Winder', 'gatewinder', 0, [50, 50], 26000, [58, 78], 7000, { ...WET, loot: 'u_gatewinder', rhIlvl: 68, speed: 3.0, range: 4.4, swing: 2.6, radius: 2.4, elite: true,
      abilities: [{ kind: 'beam', every: 13, len: 18, r: 1.9, delay: 1.9, dmg: 1.5, text: 'The Gate Winder lets its gate drop, and a wall of water runs down the channel!' },
        { kind: 'circles', every: 10, n: 4, r: 3.0, delay: 1.8, dmg: 1.4, text: 'Water jets through the leaking seals of the gates on the walls!' },
        { kind: 'adds', at: 0.5, mob: 'sgkeeper', n: 2, text: 'Two sluice keepers wind out of the gate niches to tend the Gate Winder!' }] }),
    turbineheart: SG('The Turbine Heart', 'turbineheart', 0, [50, 50], 28000, [60, 80], 7200, { ...WET, loot: 'u_turbineheart', rhIlvl: 68, speed: 2.6, range: 4.6, swing: 2.6, radius: 2.8, elite: true,
      abilities: [{ kind: 'nova', every: 15, r: 8, delay: 2.2, dmg: 1.6, text: 'The Turbine Heart races, and spray blasts out of its housing across the hall!' },
        { kind: 'circles', every: 9, n: 4, r: 2.8, delay: 1.7, dmg: 1.4, text: 'Water bursts up out of the turbine pits!' },
        { kind: 'adds', at: 0.5, mob: 'sgwalker', n: 2, text: 'Flume walkers climb out of the tailrace to feed the Turbine Heart!' }] }),
    // the last boss: three abilities, and the second only once the gate is giving way (below half health): the rising water
    floodgate: SG('The Floodgate', 'floodgate', 0, [51, 51], 225000, [66, 90], 20000, { ...WET, loot: 'u_floodgate', rhIlvl: 68, speed: 0.6, aggro: 18, range: 7.0, swing: 3.0, radius: 4.6, elite: true, boss: true,
      abilities: [{ kind: 'circles', every: 10, n: 4, r: 3.2, delay: 1.8, dmg: 1.45, above: 0.5, text: 'The Floodgate cracks its sluices, and water sheets across the floor!' },
        { kind: 'circles', every: 7, n: 8, r: 3.8, delay: 2.0, dmg: 1.5, below: 0.5, text: 'The gate is giving way! Water pours through and floods the hall, and it keeps rising!' },
        { kind: 'nova', every: 16, r: 9, delay: 2.4, dmg: 1.7, text: 'The Floodgate heaves its gate up, and a wave breaks over everything near it!' }] }),
  });
  // named drops: item level 64 (the Gate Winder), 65 (the Turbine Heart) and 66 (the Floodgate), raised to 68 on Heroic
  const ST = {
    weapon: { power: 118, hp: 40, crit: 7 }, trinket: { power: 100, hp: 44, haste: 30 },
    plate: { armor: 420, hp: 112, power: 24 }, mail: { armor: 380, hp: 110, crit: 8 }, cloth: { armor: 380, hp: 96, power: 30 },
  };
  const W = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'];
  const N = (name, slot, kind, ilvl, desc) => {
    const w = W.includes(kind) ? kind : null, wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    const base = ST[w ? 'weapon' : wt || 'trinket'], k = (ilvl / 50) * 1.45, stats = {}; // above the Rime Steps' quest rewards, so the Galleries are worth farming
    for (const [s, v] of Object.entries(base)) stats[s] = Math.round(v * k);
    const icon = w ? `w_${w}~3` : wt ? `a_${wt}_${slot}~3` : 't_trinket~3';
    return { name, slot, q: 4, ilvl, req: 49, stats, desc, unique: true, icon, ...(w ? { wtype: w } : {}), ...(w === 'pistol' ? { classes: ['deadeye'] } : {}), ...(wt ? { weight: wt } : {}) };
  };
  const drops = {
    gatewinder: [['Winding-Drum Mace', 'weapon', 'mace', 64, 'The pawl off the Gate Winder’s drum, on a shaft of black bronze.'], ['Gate-Plate Greaves', 'legs', 'plate', 64, 'Cut from a sluice gate that held for a thousand winters.']],
    turbineheart: [['Turbine-Vane Blade', 'weapon', 'sword', 65, 'One vane of the turbine’s runner, ground to an edge.'], ['Spray-Soaked Hood', 'head', 'cloth', 65, 'Stiff with frost from the turbine room. It never quite dries.'], ['Penstock-Valve Pistol', 'weapon', 'pistol', 65, 'Its lock was a turbine valve once. It still seals tight against the spray.']],
    floodgate: [['Floodgate Hauberk', 'chest', 'mail', 66, 'Links of gate chain, each one stamped with the height of the lake.'], ['The Lake Gauge', 'trinket', 'trinket', 66, 'It reads how high the water stands behind the dam. Read it often.'], ['Spillway Staff', 'weapon', 'staff', 66, 'The gauge rod from the spillway, marked in the Makers’ feet.']],
  };
  for (const [mob, list] of Object.entries(drops)) list.forEach(([name, slot, kind, ilvl, desc], i) => { ITEMS[`u_${mob}${i + 1}`] = N(name, slot, kind, ilvl, desc); });
  const T = (mob, gold, extra, gearQ, gearN) => ({ gold, items: [...drops[mob].map((_, i) => [`u_${mob}${i + 1}`, mob === 'floodgate' ? 0.3 : 0.25]), ...extra], gear: 1, gearQ, gearN });
  const boss = [['tonic', 1], ['frostore', 1]], last = [['draught', 1], ['frostore', 1]];
  Object.assign(LOOT_TABLES, {
    sluiceTrash: { gold: [32, 48], items: [['frostore', 0.45], ['bronzecog', 0.25], ['draught', 0.12]], gear: 0.4 },
    u_gatewinder: T('gatewinder', [180, 240], boss, 3, 2), u_turbineheart: T('turbineheart', [180, 240], boss, 3, 2), u_floodgate: T('floodgate', [520, 700], last, 4, 3),
  });
  // trash packs chamber by chamber, south to north (local metres in the dungeon grid), each boss in its own hall
  SPAWNS.push(
    ds('sluicegalleries', 'sgsentry', 62, 96, 2, 2),
    ds('sluicegalleries', 'sgkeeper', 40, 86, 3, 2), ds('sluicegalleries', 'sgwalker', 84, 86, 3, 2), ds('sluicegalleries', 'sghammer', 48, 75, 3, 1), ds('sluicegalleries', 'sgkeeper', 88, 73, 3, 2),
    ds('sluicegalleries', 'gatewinder', 68, 74, 1, 1),
    ds('sluicegalleries', 'sgsentry', 38, 61, 2, 2),
    ds('sluicegalleries', 'sghammer', 24, 48, 3, 1), ds('sluicegalleries', 'sgwalker', 62, 48, 3, 2), ds('sluicegalleries', 'sgkeeper', 22, 35, 3, 2),
    ds('sluicegalleries', 'turbineheart', 44, 38, 1, 1),
    ds('sluicegalleries', 'sgsentry', 75, 38, 2, 2),
    ds('sluicegalleries', 'sgkeeper', 84, 38, 3, 2), ds('sluicegalleries', 'sgwalker', 111, 38, 3, 2), ds('sluicegalleries', 'sghammer', 84, 20, 3, 1), ds('sluicegalleries', 'sgsentry', 111, 21, 3, 2),
    ds('sluicegalleries', 'floodgate', 97, 19, 1, 1), // 15 m off the north wall so the long gate model never clips it
  );
  // kills in the Galleries count toward the Flumewrights, like the Rime Steps themselves
  FACTIONS.flumewrights.zones.push('sluicegalleries');
  // the door is the intake gatehouse at the head of the lake, in its north-east corner: the Spillway Engine's beat and the
  // nearest lake pack are drawn back so a party walking out never lands in either (both stay on the frozen lake)
  { const S = SPAWNS.find((q) => q.mob === 'spillwayengine' && q.path); if (S) S.path = [[618, -1684], [630, -1652], [620, -1612], [627, -1650], [618, -1684]]; }
  { const S = SPAWNS.find((q) => q.mob === 'bronzesentry' && q.x === 612 && q.z === -1692); if (S) { S.x = 610; S.z = -1686; S.r = 4; } }
}


// ============================================================================ P11.4 CHAPTERS 34-35 (story text in story.js)
// "Meltwater" and "The Flumewrights": the crew at the Icefall Landing meet the real Flumewrights, a handful of men descended
// from the Makers' last water-wrights, learn the water works from them, repair the north mill's wheel, and stop the Floodgate
// in the Sluice Galleries before the Flumewrights accept the valley's help to hold the dams. Three of them stand on the Rime
// Steps: Gatewright Saleem on the Flume Works tread between the mills, Millwright Usman beside the north mill's wheel, and
// Sluiceman Junaid at the south end of the dam's foot on the Dam Crown. They are people, not mobs, and every fight is with
// machines. Turn-ins on the Rime Steps give Flumewright reputation (questRep 0.4).
Object.assign(ITEMS, {
  c34_pin: { name: 'Sluice Gate Pin', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A long iron pin, square at the head, that locks a sluice gate in its guides. Millwright Usman wants it back.' },
  c34_paddle: { name: 'Bronze Paddle Plate', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A curved bronze plate cast to the Makers’ pattern, the kind bolted round the rim of a solid water wheel.' },
});
{
  // the rewards (item level 63-66), with the armour weight or weapon type set here (the reward art pass ran before this block)
  const R = (name, slot, lvl, art, haste = false) => {
    const g = gear(name, slot, 4, lvl, haste);
    if (slot === 'weapon') { g.wtype = art; g.icon = `w_${art}~3`; }
    else if (slot === 'trinket') g.icon = 't_trinket~3';
    else if (slot === 'back') g.icon = 'a_back~3';
    else { g.weight = art; g.icon = `a_${art}_${slot}~3`; }
    return g;
  };
  Object.assign(ITEMS, {
    r_c34_gloves: R('Gate-Pin Gloves', 'hands', 63, 'cloth'),
    r_c34_boots: R('Sluice-Keeper’s Boots', 'feet', 63, 'mail'),
    r_c34_greaves: R('Trestle-Mender’s Greaves', 'legs', 63, 'plate'),
    r_c34_charm: { ...R('Tilt-Hammer Keepsake', 'trinket', 63, null, true), desc: 'The striking face off a wheel hammer’s head, worn smooth by a thousand years of iron.' },
    r_c34_maul: R('Millwright’s Maul', 'weapon', 64, 'hammer'),
    r_c34_hauberk: R('Paddle-Rim Hauberk', 'chest', 64, 'mail'),
    r_c34_helm: R('Dam Crown Helm', 'head', 64, 'plate'),
    r_c34_cloak: R('Meltwater Cloak', 'back', 64),
    r_c35_gauntlets: R('Joint-Packer’s Gauntlets', 'hands', 65, 'plate'),
    r_c35_sabatons: R('Crest-Walker’s Sabatons', 'feet', 65, 'plate'),
    r_c35_legguards: R('Old Bronze Legguards', 'legs', 65, 'mail'),
    r_c35_hood: R('Lake-Wind Hood', 'head', 65, 'cloth'),
    r_c35_staff: R('Gatewright’s Staff', 'weapon', 66, 'staff'),
    r_c35_charm: { ...R('Stilled Floodgate Keepsake', 'trinket', 66, null, true), desc: 'A link of the Floodgate’s chain, cold and dry at last.' },
    r_c35_mantle: R('Mantle of the Flumewrights', 'shoulders', 66, 'cloth'),
    r_c35_coat: R('Dam-Keeper’s Long Coat', 'chest', 66, 'cloth'),
  });
}
NPCS.push(
  { id: 'n_rs_saleem', name: 'Gatewright Saleem', title: 'The Flumewrights', look: 'villager', v: 1, x: 560, z: -1650, ry: -1.33, quests: [],
    greet: 'Eleven men, a valley of gates, and a lake that never sleeps. We manage. Mostly.' },
  { id: 'n_rs_usman', name: 'Millwright Usman', title: 'The North Mill', look: 'villager', v: 2, x: 553, z: -1669, ry: -3.07, quests: [],
    greet: 'Listen to the wheel. A wheel that turns true sounds like rain on a roof. This one does not, yet.' },
  { id: 'n_rs_junaid', name: 'Sluiceman Junaid', title: 'The Dam Crown', look: 'warden', v: 1, x: 590, z: -1598, ry: 1.2, quests: [],
    greet: 'Every joint in that face has a number, and I know them all. Lately I know them by how much they leak.' },
);
// the gate pins and paddle plates come off the Rime Steps' machines (only for those on the quest)
LOOT_TABLES.rimeMach.items.push(['c34_pin', 0.5], ['c34_paddle', 0.5]);
// the Flumewrights' stores, kept by Harbour Master Nasir on the Icefall Landing pier (ranks Friendly to Exalted, item level 64-66)
Object.assign(ITEMS, {
  rep_fw1: { name: 'Flumewright’s Spray-Cloak', slot: 'back', icon: 'a_back~2', q: 3, stats: { armor: 310, hp: 106, haste: 18 }, ilvl: 64 },
  rep_fw2: { name: 'Gate-Winder’s Gauntlets', slot: 'hands', icon: 'a_plate_hands~2', weight: 'plate', q: 3, stats: { armor: 345, hp: 112, power: 37 }, ilvl: 64 },
  rep_fw3: { name: 'Sluiceman’s Mail Spaulders', slot: 'shoulders', icon: 'a_mail_shoulders~3', weight: 'mail', q: 4, stats: { armor: 470, hp: 145, crit: 9 }, ilvl: 65 },
  rep_fw4: { name: 'Flume-Walker’s Hood', slot: 'head', icon: 'a_cloth_head~3', weight: 'cloth', q: 4, stats: { armor: 335, hp: 140, power: 39 }, ilvl: 65 },
  rep_fw5: { name: 'Flumewright Gate-Key', slot: 'weapon', icon: 'w_mace~3', wtype: 'mace', q: 4, stats: { power: 245, haste: 26, hp: 60 }, ilvl: 66 },
});
REP_SHOP.flumewrights = [{ item: 'rep_fw1', rank: 1, price: 22000 }, { item: 'rep_fw2', rank: 2, price: 28000 }, { item: 'rep_fw3', rank: 3, price: 34000 }, { item: 'rep_fw4', rank: 3, price: 34000 }, { item: 'rep_fw5', rank: 4, price: 42000 }];
// frost colours for the runabout: pale ice-blue panels, deep meltwater trim and an iron boiler (Honored with the Flumewrights)
PAINTS.meltwater = { name: 'Meltwater Frost', body: '#d6e6ef', paint: true, trim: '#3a7aaa', metal: 'iron', seat: '#2a4864', need: { rep: 'flumewrights', rank: 2 } };
// the Main Story ran (applyStory) before these men were placed: give them their story quests
for (const [id, Q] of Object.entries(QUESTS)) if (Q.msq) { const g = NPCS.find((n) => n.id === Q.giver); if (g && !(g.quests ||= []).includes(id)) g.quests.push(id); }

// ============================================================================ P11.5 THE GREAT DAM (raid, level 50)
// (block owned by the Great Dam raid work; Chapter 36's story goes in story.js, not here)
// Inside and beneath the Makers' greatest dam, high in the glacier, the one that holds back the frozen lake's source. Four
// bosses, all machines, and their strikes are water and ice (water/teleColor: blue circles that burst as spray, client
// game.js): the Penstock Engine (the pipe-crawling valve engine that kept the great penstocks), the Ice Breaker (the ram and
// hammer engine that broke the ice out of the spillway every spring), the Governor (the regulator that held the turbines'
// speed) and THE GREAT DAM'S HEART, the dam's master gate engine at the north wall, which does not move: as its gate gives
// way the water bursts out wider and more often. Ten players, Normal and Heroic (the raid kind, after a Normal clear);
// weekly lockouts per boss (sim.js m.def.raid); named drops at item level 66-68, raised to 70 on Heroic (rhIlvl); Makers'
// marks from every boss. The door (shared/dungeons.js) opens once Chapter 35 is done (need.done m_c35_hold).
{
  const WET = { water: true, teleColor: '#2f9cff', novaColor: '#6ad0ff' };
  const GD = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.4, aggro: 13, range: 3.2, swing: 2.2, xp, loot: 'damRaid', radius: 1.2, elite: true, ...extra });
  Object.assign(MOBS, {
    // trash: the Rime Steps' own machines, still keeping the dam
    gdkeeper: GD('Dam-Heart Sluice Keeper', 'sluicekeeper', 1, [50, 50], 5600, [58, 78], 1900, { speed: 3.0, radius: 1.4 }),
    gdwalker: GD('Penstock Flume Walker', 'flumewalker', 1, [50, 50], 5200, [56, 76], 1850, { speed: 3.8, range: 3.4, radius: 1.0 }),
    gdhammer: GD('Spillway Wheel Hammer', 'wheelhammer', 1, [50, 50], 6000, [60, 82], 1950, { speed: 2.8, range: 3.6, swing: 2.7, radius: 1.7 }),
    gdsentry: GD('Great Dam Sentry', 'damsentry', 1, [50, 50], 5800, [59, 80], 1900, { radius: 1.2 }),
    // 1. the Penstock Engine: a valve engine on treads, riding a length of the great pipe, its valve house on top
    penstockengine: GD('The Penstock Engine', 'penstockengine', 0, [50, 50], 290000, [64, 86], 34000, { ...WET, loot: 'u_penstockengine', rhIlvl: 70, speed: 2.6, aggro: 18, range: 5.0, swing: 2.5, radius: 3.2, boss: true, raid: true,
      abilities: [
        { kind: 'beam', every: 12, len: 24, r: 2.1, delay: 1.8, dmg: 1.55, text: 'The Penstock Engine opens its valve, and a jet of water drives down the gallery!' },
        { kind: 'circles', every: 10, n: 5, r: 3.0, delay: 1.8, dmg: 1.45, text: 'Water bursts from the flanges of the penstocks overhead!' },
        { kind: 'nova', every: 14, r: 7, delay: 2.0, dmg: 1.55, text: 'The Penstock Engine blows down its pipe, and water floods out across the floor!' },
        { kind: 'adds', at: 0.5, mob: 'gdwalker', n: 3, text: 'Flume walkers climb down out of the penstocks to tend the Penstock Engine!' }] }),
    // 2. the Ice Breaker: a heavy tracked engine with a wedge ram at the bow and a tilt hammer over it
    icebreaker: GD('The Ice Breaker', 'icebreaker', 0, [50, 50], 310000, [66, 88], 36000, { ...WET, loot: 'u_icebreaker', rhIlvl: 70, speed: 2.4, aggro: 18, range: 5.4, swing: 2.8, radius: 3.4, boss: true, raid: true,
      abilities: [
        { kind: 'nova', every: 13, r: 7.5, delay: 2.0, dmg: 1.6, text: 'The Ice Breaker brings its hammer down, and the ice shatters across the spillway!' },
        { kind: 'circles', every: 11, n: 6, r: 3.2, delay: 1.9, dmg: 1.5, text: 'Slabs of broken ice come crashing down the spillway steps!' },
        { kind: 'beam', every: 13, len: 26, r: 2.2, delay: 1.8, dmg: 1.6, text: 'The Ice Breaker drives its ram down the spillway!' },
        { kind: 'enrage', at: 0.15, text: 'The Ice Breaker’s hammer runs free of its brake!' }] }),
    // 3. the Governor: the turbines' regulator, a square tower on treads with its weights spinning on a tall spindle
    governor: GD('The Governor', 'governor', 0, [50, 50], 325000, [68, 90], 38000, { ...WET, loot: 'u_governor', rhIlvl: 70, speed: 2.6, aggro: 18, range: 5.0, swing: 2.6, radius: 3.0, boss: true, raid: true,
      abilities: [
        { kind: 'circles', every: 10, n: 5, r: 3.2, delay: 1.9, dmg: 1.5, text: 'The Governor throws every turbine gate open at once, and water spouts from the pits!' },
        { kind: 'nova', every: 12, r: 7.5, delay: 1.9, dmg: 1.6, text: 'The Governor’s weights fly out, and a sheet of spray sweeps the hall!' },
        { kind: 'adds', at: 0.5, mob: 'gdkeeper', n: 3, text: 'Sluice keepers come up out of the turbine pits to tend the Governor!' },
        { kind: 'enrage', at: 0.12, text: 'The Governor runs away with itself, faster than any turbine was built to turn!' }] }),
    // 4. THE GREAT DAM'S HEART: the master gate engine at the north wall of the Dam Heart, which never moves. Three phases:
    // as the gate gives way the water bursts out wider and more often
    damheart: GD('The Great Dam’s Heart', 'damheart', 0, [51, 51], 445000, [72, 96], 52000, { ...WET, loot: 'u_damheart', rhIlvl: 70, speed: 0, aggro: 22, range: 10.0, swing: 3.0, radius: 6.0, boss: true, raid: true,
      abilities: [
        { kind: 'circles', every: 11, n: 5, r: 3.0, delay: 1.9, dmg: 1.5, above: 0.66, text: 'The Great Dam’s Heart cracks its relief gates, and water bursts up through the floor!' },
        { kind: 'nova', every: 15, r: 8, delay: 2.2, dmg: 1.6, above: 0.33, text: 'The Great Dam’s Heart heaves against its gate, and a wave rolls out across the hall!' },
        { kind: 'phase', below: 0.66, text: 'The master gate shifts in its guides. The water comes through wider and faster.' },
        { kind: 'adds', at: 0.66, mob: 'gdkeeper', n: 3, text: 'Sluice keepers wind down from the gate gallery to hold the master gate!' },
        { kind: 'circles', every: 8, n: 7, r: 3.6, delay: 1.8, dmg: 1.55, below: 0.66, above: 0.33, text: 'Water jets from every seam of the master gate!' },
        { kind: 'beam', every: 11, len: 26, r: 2.3, delay: 1.7, dmg: 1.6, below: 0.66, text: 'The Great Dam’s Heart opens its scour port, and a jet of water tears straight down the hall!' },
        { kind: 'phase', below: 0.33, text: 'The lowest planks of the master gate burst. The lake is coming through!' },
        { kind: 'circles', every: 7, n: 8, r: 3.8, delay: 1.8, dmg: 1.6, below: 0.33, text: 'The lake bursts through the broken gate and floods the hall!' },
        { kind: 'nova', every: 13, r: 9, delay: 2.2, dmg: 1.7, below: 0.33, text: 'A wall of water breaks out from the master gate across the whole hall!' },
        { kind: 'adds', at: 0.33, mob: 'gdwalker', n: 4, text: 'Flume walkers wash out of the broken gate!' },
        { kind: 'enrage', at: 0.1, text: 'The Great Dam’s Heart throws its gate wide open!' }] }),
  });
  // named drops: item level 66 (the Penstock Engine), 67 (the Ice Breaker and the Governor), 68 (the Heart), 70 on Heroic.
  // The same stat budget as the First Furnace's named drops (x1.45 over the item-level line).
  const ST = {
    weapon: { power: 118, hp: 40, crit: 7 }, trinket: { power: 100, hp: 44, haste: 30 },
    plate: { armor: 420, hp: 112, power: 24 }, mail: { armor: 380, hp: 110, crit: 8 }, cloth: { armor: 380, hp: 96, power: 30 },
  };
  const W = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'];
  const N = (name, slot, kind, ilvl, desc) => {
    const w = W.includes(kind) ? kind : null, wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    const base = ST[w ? 'weapon' : wt || 'trinket'], k = (ilvl / 50) * 1.45, stats = {};
    for (const [s, v] of Object.entries(base)) stats[s] = Math.round(v * k);
    const icon = w ? `w_${w}~3` : wt ? `a_${wt}_${slot}~3` : 't_trinket~3';
    return { name, slot, q: 4, ilvl, req: 50, stats, desc, unique: true, icon, ...(w ? { wtype: w } : {}), ...(w === 'pistol' ? { classes: ['deadeye'] } : {}), ...(wt ? { weight: wt } : {}) };
  };
  const drops = {
    penstockengine: [
      ['Penstock-Flange Pauldrons', 'shoulders', 'plate', 66, 'Cut from a flange of the great penstock, the bolt holes still edged with rust.'],
      ['Valve-Stem Rod', 'weapon', 'rod', 66, 'The stem of a penstock valve, its thread worn bright by a thousand years of turning.'],
      ['Pipe-Lagging Wraps', 'hands', 'cloth', 66, 'Strips of the felt the Makers wound round their pipes against the frost.']],
    icebreaker: [
      ['Ice-Ram Axe', 'weapon', 'axe', 67, 'The cutting edge off the Ice Breaker’s ram, ground fine.'],
      ['Breaker-Link Hauberk', 'chest', 'mail', 67, 'Links that took the shock of every spring’s ice.'],
      ['Tilt-Hammer Greaves', 'legs', 'plate', 67, 'Rolled from the Ice Breaker’s hammer helve, heavy and true.'], ['Ram-Bolt Pistol', 'weapon', 'pistol', 67, 'Bored from a bolt of the Ice Breaker\u2019s ram, and heavy for it.']],
    governor: [
      ['Flyweight Mace', 'weapon', 'mace', 67, 'One of the Governor’s brass weights, on a haft of black bronze.'],
      ['Regulator’s Hood', 'head', 'cloth', 67, 'Worn by the men who set the turbines’ speed. It smells of oil and cold.'],
      ['Spindle-Guard Boots', 'feet', 'mail', 67, 'Clad in the guard plates off the Governor’s spindle.']],
    damheart: [
      ['The Last Gate', 'weapon', 'hammer', 68, 'A pin from the Great Dam’s master gate, with a hammer head forged onto it.'],
      ['Master-Gate Breastplate', 'chest', 'plate', 68, 'Plate from the master gate itself, stamped with the height of the lake.'],
      ['Lake-Level Staff', 'weapon', 'staff', 68, 'The gauge rod from the dam heart, marked in the Makers’ feet.'],
      ['The Dam-Keeper’s Gauge', 'trinket', 'trinket', 68, 'It reads the pressure on the dam at a glance. Read it often, and keep the dam in repair.'],
      ['Spillway Mantle', 'shoulders', 'cloth', 68, 'Grey wool from the gate gallery, frosted at the seams.']],
  };
  for (const [mob, list] of Object.entries(drops)) list.forEach(([name, slot, kind, ilvl, desc], i) => { ITEMS[`u_${mob}${i + 1}`] = N(name, slot, kind, ilvl, desc); });
  const T = (mob, gold, ch, extra, gearN) => ({ gold, items: [...drops[mob].map((_, i) => [`u_${mob}${i + 1}`, ch]), ...extra], gear: 1, gearQ: 4, gearN });
  Object.assign(LOOT_TABLES, {
    damRaid: { gold: [66, 96], items: [['frostore', 0.5], ['bronzecog', 0.3], ['draught', 0.2]], gear: 0.45, gearQ: 3 },
    u_penstockengine: T('penstockengine', [900, 1100], 0.3, [['tonic', 1], ['frostore', 1]], 2),
    u_icebreaker: T('icebreaker', [950, 1150], 0.3, [['tonic', 1], ['frostore', 1]], 2),
    u_governor: T('governor', [1000, 1200], 0.3, [['tonic', 1], ['frostore', 1]], 2),
    u_damheart: T('damheart', [1400, 1700], 0.28, [['draught', 1], ['frostore', 1]], 3),
  });
  // Makers' marks for Quartermaster Hamid, more from each boss deeper into the dam
  for (const [t, n] of [['u_penstockengine', 6], ['u_icebreaker', 6], ['u_governor', 7], ['u_damheart', 12]]) for (let i = 0; i < n; i++) LOOT_TABLES[t].items.push(['makermark', 1]);
  // and a dam-marked row in Hamid's stock to spend them on (item level 66)
  Object.assign(ITEMS, {
    mk_dpauldrons: { name: 'Dam-Marked Pauldrons', slot: 'shoulders', icon: 'a_plate_shoulders~3', weight: 'plate', q: 4, stats: { armor: 770, hp: 207, power: 44 }, ilvl: 66 },
    mk_dspaulders: { name: 'Dam-Marked Spaulders', slot: 'shoulders', icon: 'a_mail_shoulders~3', weight: 'mail', q: 4, stats: { armor: 682, hp: 200, crit: 14 }, ilvl: 66 },
    mk_dmantle: { name: 'Dam-Marked Mantle', slot: 'shoulders', icon: 'a_cloth_shoulders~3', weight: 'cloth', q: 4, stats: { armor: 451, hp: 165, power: 51 }, ilvl: 66 },
    mk_dcharm: { name: 'Dam-Marked Keepsake', slot: 'trinket', icon: 't_trinket~3', q: 4, stats: { power: 132, hp: 73, crit: 17 }, ilvl: 66 },
  });
  MARK_SHOP.push({ item: 'mk_dpauldrons', price: 90 }, { item: 'mk_dspaulders', price: 90 }, { item: 'mk_dmantle', price: 90 }, { item: 'mk_dcharm', price: 110 });
  // the halls, south to north (local metres in the raid grid): trash packs on the way, each boss in its own hall
  SPAWNS.push(
    ds('greatdam', 'gdsentry', 70, 189, 1, 1), ds('greatdam', 'gdsentry', 82, 189, 1, 1),
    ds('greatdam', 'gdkeeper', 46, 184, 3, 2), ds('greatdam', 'gdwalker', 106, 184, 3, 2), ds('greatdam', 'gdhammer', 52, 168, 3, 2), ds('greatdam', 'gdsentry', 100, 168, 3, 2),
    ds('greatdam', 'gdsentry', 45, 155, 1, 2),
    ds('greatdam', 'gdhammer', 22, 142, 3, 2), ds('greatdam', 'gdkeeper', 60, 142, 3, 2), ds('greatdam', 'gdwalker', 22, 112, 3, 2),
    ds('greatdam', 'penstockengine', 41, 124, 1, 1),
    ds('greatdam', 'gdwalker', 77, 121, 1, 2),
    ds('greatdam', 'gdkeeper', 94, 126, 3, 2), ds('greatdam', 'gdsentry', 132, 126, 3, 2), ds('greatdam', 'gdhammer', 132, 92, 3, 2),
    ds('greatdam', 'icebreaker', 113, 106, 1, 1),
    ds('greatdam', 'gdsentry', 98, 80, 1, 2),
    ds('greatdam', 'gdkeeper', 30, 68, 3, 2), ds('greatdam', 'gdhammer', 102, 68, 3, 2), ds('greatdam', 'gdwalker', 30, 54, 3, 2), ds('greatdam', 'gdsentry', 100, 52, 3, 2),
    ds('greatdam', 'governor', 66, 60, 1, 1),
    ds('greatdam', 'gdwalker', 39, 41, 1, 2),
    ds('greatdam', 'gdkeeper', 26, 28, 3, 2), ds('greatdam', 'gdsentry', 124, 28, 3, 2), ds('greatdam', 'gdhammer', 34, 10, 3, 2), ds('greatdam', 'gdwalker', 116, 10, 3, 2),
    ds('greatdam', 'damheart', 75, 11, 1, 1),
  );
  // the gatehouse stands on the east shore of the lake, under the glacier: the Spillway Engine's beat is drawn north (it
  // still walks the frozen lake, well clear of both doors), and the lake pack of dam sentries that worked the south shore
  // moves to the south-west corner of the ice by the dam, clear of the door, the crest ramp and the Dam Crown's men
  { const S = SPAWNS.find((q) => q.mob === 'spillwayengine' && q.path); if (S) S.path = [[617, -1688], [627, -1670], [618, -1650], [626, -1668], [617, -1688]]; }
  { const S = SPAWNS.find((q) => q.mob === 'damsentry' && q.x === 612 && q.z === -1622); if (S) { S.x = 610; S.z = -1603; S.r = 4; } }
  // kills in the raid count toward the Flumewrights, like the Rime Steps and the Sluice Galleries
  FACTIONS.flumewrights.zones.push('greatdam');
  // homestead plaques for the Normal and Heroic clears
  HOME_TROPHIES.push(['plaque_dam', 'Great Dam plaque', { ach: 'rGreatDam' }], ['plaque_hdam', 'Gilded Great Dam plaque (Heroic)', { ach: 'rhGreatDam' }]);
}

// ============================================================================ P11.5 CHAPTER 36 (story text in story.js)
// "The Great Dam", the last chapter of Part Eleven: the dam still groans after the Floodgate; the crew and the Flumewrights find
// the Great Dam's heart failing, gather the whole camp, send a company of ten into the raid, and keep the Makers' dams in repair.
// No new people: Nasir, Junaid, Saleem and Yusuf carry it. Rewards at item level 66-68 (below the raid's named drops in each
// slot); the last step grants the Part Eleven title (achievement longRoad, "the Flumewright").
{
  const R = (name, slot, lvl, art, haste = false) => {
    const g = gear(name, slot, 4, lvl, haste);
    if (slot === 'weapon') { g.wtype = art; g.icon = `w_${art}~3`; }
    else if (slot === 'trinket') g.icon = 't_trinket~3';
    else if (slot === 'back') g.icon = 'a_back~3';
    else { g.weight = art; g.icon = `a_${art}_${slot}~3`; }
    return g;
  };
  Object.assign(ITEMS, {
    r_c36_boots: R('Gate-Stair Boots', 'feet', 66, 'mail'),
    r_c36_gloves: R('Seam-Reader’s Gloves', 'hands', 66, 'cloth'),
    r_c36_legs: R('Sluice-Crew Legplates', 'legs', 67, 'plate'),
    r_c36_helm: R('Gatehouse Warden’s Helm', 'head', 67, 'mail'),
    r_c36_hammer: R('Master Gate Hammer', 'weapon', 68, 'hammer'),
    r_c36_charm: { ...R('Work-Plate Keepsake', 'trinket', 68, null, true), desc: 'A corner of the Great Dam’s Heart’s work plate. The cuts on it are a list of chores, every one still worth doing.' },
    r_c36_mantle: R('Mantle of the Long Road North', 'shoulders', 67, 'plate'),
    r_c36_cloak: R('Rime Steps Keeper’s Cloak', 'back', 67),
  });
}

// a second weekly for the far raids, so the first one stays five doors long
QUESTS.w_fardoors = { name: '[Weekly] The Far Doors', giver: 'n_muster', turnin: 'n_muster', lvl: 50, pre: 'm_c36_groan', weekly: true, daily: true,
  text: 'Two more halls fill up again every week, a long sail from here: the Makers\u2019 First Furnace under the Cinder Reach, and the Great Dam under the Rime Steps. Clear both. The volunteers will meet you at either door.',
  done: 'Both far doors cleared. The valley could not have asked for that a year ago.',
  goal: { kills: ['firstfurnace', 'damheart'], n: 2 }, xp: 64000, gold: 4400, rewards: [], bonusGear: { ilvl: 66, q: 4 } };
NPCS.find((n) => n.id === 'n_muster').quests.push('w_fardoors');

// NPCs who are only somewhere for part of the story, per player: seen from a step being done until another is done.
// Haroun and Ilyas cross to the Reach for Chapter 33 and go home with the refitted ship; their valley selves stay put.
export const npcSeen = (n, done = {}) => (!n.seenFrom || !!done[n.seenFrom]) && (!n.seenUntil || !done[n.seenUntil]);
for (const id of ['n_ar_ilyas', 'n_ar_haroun']) Object.assign(NPCS.find((n) => n.id === id), { seenFrom: 'm_c32_cold', seenUntil: 'm_c33_refit' });

// after Part Eleven: the men of the Rime Steps at work on the dam crest, packing the joints (seen once Chapter 36 is done)
NPCS.push(
  { id: 'n_rs_crest1', name: 'Sabir', title: 'Men of the Rime Steps', look: 'villager', v: 4, x: 601.6, z: -1690, ry: 1.57, quests: [], seenFrom: 'm_c36_keep', greet: 'One joint at a time, every year. That is the whole of it.' },
  { id: 'n_rs_crest2', name: 'Rafiq', title: 'Men of the Rime Steps', look: 'villager', v: 6, x: 600.4, z: -1655, ry: -1.57, quests: [], seenFrom: 'm_c36_keep', greet: 'I came north with Corbin to strip brass. Now look at me, mending a dam.' },
  { id: 'n_rs_crest3', name: 'Tamim', title: 'Men of the Rime Steps', look: 'villager', v: 8, x: 601.6, z: -1615, ry: 1.57, quests: [], seenFrom: 'm_c36_keep', greet: 'The Makers wrote down every chore. We are working down the list.' },
);

// ============================================================================ PART TWELVE: THE WINDWARD HEIGHTS (P12.2)
// a wind-scoured plateau above the Rime Steps' glacier with its own terrain box (shared/heights.js, registered in
// shared/areas.js). No ship goes there: a counterweight lift runs from the frozen lake's south shore under the Dam Crown up the
// cliff to a landing deck on the plateau's west edge. A lift is a port like a ship's (SAIL.to, kind 'lift'), ridden with the
// same { t: 'sail', npc, to } message from a liftwright at either end; it runs only once Chapter 36 is done (m_c36_keep) and
// takes no notice of SAIL.need. A ride sends ev { k: 'lift', to, from } (not 'sail', so the client shows no ship).
SAIL.to.heights = { x: HEIGHTS.lift.landing.x, z: HEIGHTS.lift.landing.z, name: 'the Windward Heights', kind: 'lift', need: 'm_c36_keep', notReady: 'The lift is not running yet: the Dam Crown needs its keepers first.',
  say: 'The counterweight drops past you into the cloud and the cage climbs the cliff, out of the cold blue of the Rime Steps, through the cloud and up into the wind.' };
SAIL.to.rimelift = { x: HEIGHTS.rimeLift.landing.x, z: HEIGHTS.rimeLift.landing.z, name: 'the Dam Crown', kind: 'lift', need: 'm_c36_keep', notReady: 'The lift is not running yet.',
  say: 'The cage drops off the edge of the Heights, down through the cloud, and settles on the ice by the frozen lake.' };
NPCS.push(
  { id: 'n_rs_mansur', name: 'Liftwright Mansur', title: 'The Counterweight Lift', look: 'villager', v: 3, x: HEIGHTS.rimeLift.keeper.x, z: HEIGHTS.rimeLift.keeper.z, ry: HEIGHTS.rimeLift.keeper.ry, sail: 'heights', sails: ['heights'], lift: true, quests: [],
    greet: 'The Makers hung this lift up the cliff before they built the dam. The counterweight is half a hill of iron. Step in and keep your hands inside.' },
  { id: 'n_wh_ghazi', name: 'Liftwright Ghazi', title: 'Windward Lift Landing', look: 'villager', v: 5, x: HEIGHTS.lift.keeper.x, z: HEIGHTS.lift.keeper.z, ry: HEIGHTS.lift.keeper.ry, sail: 'rimelift', sails: ['rimelift'], lift: true, quests: [],
    greet: 'Mind the wind on the deck. It comes off the plateau hard enough to lean on. When you want the Dam Crown again, the cage is ready.' },
  { id: 'n_wh_kamal', name: 'Windwright Kamal', title: 'The Windwrights', look: 'villager', v: 7, x: HEIGHTS.qm.x, z: HEIGHTS.qm.z, ry: HEIGHTS.qm.ry, quests: [],
    greet: 'Every engine on these rows once turned. My grandfather greased the last of them. We keep what tools we can and wait for hands.' },
  { id: 'n_cv_windward', name: 'Caravan Master Rashad', title: 'Caravans', look: 'villager', v: 2, x: HEIGHTS.caravan.x, z: HEIGHTS.caravan.z - 2, ry: 0.2, caravan: 'windward',
    greet: 'No cart comes up a cliff. I keep the post for the camp, and I can set your compass here.' },
);
// the Heights' caravan stop has no routes (the only way down is the lift), but it can be the Homeward Compass's home
CARAVANS.push({ id: 'windward', name: 'Windward Camp', x: HEIGHTS.caravan.x, z: HEIGHTS.caravan.z, zone: 'driftfields' });
GRAVEYARDS.push({ x: HEIGHTS.grave.x, z: HEIGHTS.grave.z });
// the Heights' own reputation, kept by Windwright Kamal (its shop comes with P12.6)
FACTIONS.windwrights = { name: 'The Windwrights', color: '#b8c8d8', zones: ['driftfields', 'enginerows', 'makersrest'], qm: 'n_wh_kamal', questRep: 0.4 };

// ============================================================================ P12.1 CHAPTER 37 "THE LAST CHORE" (story text in story.js)
// The Great Dam's work plate has one more chore on its back: keep the wind engines turning on the Heights. You cut the Makers'
// spare counterweight blocks out of the lake ice by the lift foot (questOnly nodes, Rime Steps), ride the lift up, and knock the
// brake out of the first wind engine on the Engine Rows (a quest object, kind 'engbrake', at the foot of pad 0's tower: x 534,
// z -2160, the first engine W.setEnginesTurning counts). The crew follow you up with Foreman Nadim. Rewards item level 70-71.
{
  const R = (name, slot, lvl, art, haste = false) => {
    const g = gear(name, slot, 4, lvl, haste);
    if (slot === 'weapon') { g.wtype = art; g.icon = `w_${art}~3`; }
    else if (slot === 'trinket') g.icon = 't_trinket~3';
    else if (slot === 'back') g.icon = 'a_back~3';
    else { g.weight = art; g.icon = `a_${art}_${slot}~3`; }
    return g;
  };
  Object.assign(ITEMS, {
    c37_block: { name: 'Counterweight Block', slot: 'quest', icon: 'gear', q: 1, stack: 20, desc: 'A square block of the Makers’ cast iron with a lifting eye on top, chipped out of the lake ice. Mansur wants it on the lift’s counterweight.' },
    r_c37_gloves: R('Ice-Chipper’s Gloves', 'hands', 70, 'mail'),
    r_c37_boots: R('Lift-Foot Boots', 'feet', 70, 'plate'),
    r_c37_legs: R('Cloud-Climber’s Leggings', 'legs', 70, 'cloth'),
    r_c37_helm: R('Liftwright’s Hood', 'head', 71, 'mail'),
    r_c37_hammer: R('Brake-Pin Hammer', 'weapon', 71, 'hammer'),
    r_c37_charm: { ...R('First Engine Keepsake', 'trinket', 71, null, true), desc: 'A brass grease cup off the first wind engine to turn on the Heights in living memory.' },
    r_c37_mantle: R('Windward Mantle', 'shoulders', 71, 'plate'),
    r_c37_cloak: R('Wind-Wall Cloak', 'back', 71),
  });
  // the spare counterweight blocks, frozen into the lake ice between the lift foot and the Sluice Galleries' door
  NODES.push(...[[611, -1706], [614, -1711], [618, -1706], [622, -1712], [615, -1703], [626, -1704], [621, -1702], [627, -1712]].map(([x, z], i) => ({ id: 'cwblock' + i, item: 'c37_block', x, z, questOnly: true })));
  // the first wind engine's brake lever, at the foot of its tower on the first ridge's north pad
  OBJECT_KINDS.engbrake = { prompt: 'Knock out the brake pin', goal: 'Wind engine brakes released', done: 'released', engine: true };
  OBJECTS.push({ id: 'o_engbrake1', kind: 'engbrake', x: 529.8, z: -2161.6, ry: -Math.PI / 2 }); // lever toward the west, clear of the pump house
  // the crew come up behind you once the first engine turns: their foreman by the fire, and two of the men
  NPCS.push(
    { id: 'n_wh_nadim', name: 'Foreman Nadim', title: 'The Crew', look: 'villager', v: 9, x: 452.6, z: -2096.2, ry: -0.66, quests: [], seenFrom: 'q_c37_engine',
      greet: 'Brakes in the morning, drifts in the afternoon. Kamal keeps a longer list than Saleem.' },
    { id: 'n_wh_crew1', name: 'Fadil', title: 'The Crew', look: 'villager', v: 6, x: 447.8, z: -2097.4, ry: 0.9, quests: [], vendor: 'general', seenFrom: 'q_c37_engine',
      greet: 'I thought the Dam Crown was cold. Then they put me in a cage and sent me up here.' },
    { id: 'n_wh_crew2', name: 'Waleed', title: 'The Crew', look: 'villager', v: 4, x: 462.2, z: -2105.8, ry: -2.6, quests: [], seenFrom: 'q_c37_engine',
      greet: 'One engine turning. You can hear it from the camp when the wind drops.' },
  );
}
// which of the Heights' wind engines a player has set turning, for the client's W.setEnginesTurning: each story step that
// releases brakes (ENGINE_STEPS: quest and object kind) turns the engine on the pad nearest each lever, the moment that lever
// is used (q.used) and for good once the step is handed in. Chapter 37 frees pad 0; Chapter 38 the rest of the first ridge
// and the whole second ridge; Chapter 39 three of the third ridge's four (the twelfth is held from the Makers' Rest).
// Returns a count (the first n pads, ridge by ridge, north to south) when the turning engines are exactly those, else a list
// of booleans, one per pad.
// Future chapters (Chapter 40 and on) need no edit here: any quest whose goal uses an object kind marked engine: true in
// OBJECT_KINDS is found on its own (engineSteps), and a step that frees engines without a lever (the twelfth engine, whose
// brake rod runs off to the Makers' Rest) lists its pads in ENGINE_RELEASES: { questId: [pad index, ...] }, turning once
// that quest is handed in.
export const ENGINE_STEPS = [['q_c37_engine', 'engbrake'], ['q_c38_brakes', 'rowbrake'], ['q_c38_ice', 'rowice'], ['q_c39_third', 'farbrake']];
export const ENGINE_RELEASES = {};
const engineSteps = () => {
  const L = ENGINE_STEPS.slice(), seen = new Set(L.map(([q]) => q));
  for (const [id, Q] of Object.entries(QUESTS)) { const k = Q.goal?.use; if (k && OBJECT_KINDS[k]?.engine && !seen.has(id)) L.push([id, k]); }
  return L;
};
const padOf = (o) => { if (o.pad != null) return o.pad; let b = 0, bd = 1e9; HEIGHTS.pads.forEach((P, i) => { const d = Math.hypot(P.x - o.x, P.z - o.z); if (d < bd) { bd = d; b = i; } }); return b; };
export const enginesTurning = (you) => {
  const done = you?.done || {}, quests = you?.quests || {}, on = HEIGHTS.pads.map(() => false);
  for (const [qid, kind] of engineSteps()) {
    const used = done[qid] ? null : quests[qid]?.used || [];
    for (const o of OBJECTS) if (o.kind === kind && (!used || used.includes(o.id))) on[padOf(o)] = true;
  }
  for (const [qid, pads] of Object.entries(ENGINE_RELEASES)) if (done[qid]) for (const i of pads) if (i >= 0 && i < on.length) on[i] = true;
  const n = on.indexOf(false) < 0 ? on.length : on.indexOf(false);
  return on.slice(n).some(Boolean) ? on : n;
};
// the Main Story ran (applyStory) before the Heights' men were placed: give them their story quests
for (const [id, Q] of Object.entries(QUESTS)) if (Q.msq) { const g = NPCS.find((n) => n.id === Q.giver); if (g && !(g.quests ||= []).includes(id)) g.quests.push(id); }

// ============================================================================ PART TWELVE: the Windward Heights' machines (P12.3)
// three bands west to east: the Drift Fields 50-51, the Engine Rows 52-53, the Makers' Rest 54-55 (models in
// client/assets/heightsMachines.js). Packs stand on walkable snow inside their own band, at least 40 m from the camp's centre,
// 25 m (past the pack's edge) from the lift landing, the graveyard, the caravan stop and the Chapter 37 brake lever and its pad,
// so a level 51 player can walk from the camp to the lever on the first ridge's north pad without meeting a 52-53 pack, and
// clear of the engine pads (their towers). The Makers' Rest hollow is left empty (a raid door comes later): its packs stand
// north of the rim, with one south of it, and the Stormplough works the snowfield south of the rim.
Object.assign(ITEMS, {
  galeiron: { name: 'Gale-Scoured Iron', slot: 'junk', icon: 'gear', q: 0, stack: 20, price: 38, desc: 'A plate off a storm machine, scoured bright on one face by a thousand years of wind.' },
  w_ploughplate: gear('Snowbound Moldboard Breastplate', 'chest', 4, 70),
  w_sweepgreaves: gear('Brush-Drum Greaves', 'legs', 4, 71),
  w_stormheart: { ...gear('Stormplough’s Hub Bearing', 'trinket', 4, 72, true), desc: 'The bearing off the hub of the Stormplough’s wind engine. Spin it and it runs on and on.' },
  w_stormplate: gear('Wind-Tower Pauldrons', 'shoulders', 4, 72),
  w_stormmaul: { ...gear('Moldboard-Edge Maul', 'weapon', 4, 72), wtype: 'hammer' },
});
const WM = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.4, aggro: 13, range: 3.0, swing: 2.3, xp, loot: 'windMach', radius: 1.2, ...extra });
Object.assign(MOBS, {
  iceplough: WM('Ice Plough', 'iceplough', 0, [50, 51], 4800, [58, 76], 1950, { speed: 3.0, range: 3.4, swing: 2.6, radius: 1.6 }),
  rimesweeper: WM('Rime Sweeper', 'rimesweeper', 0, [50, 51], 4600, [56, 74], 1900, { speed: 3.6, radius: 1.4 }),
  galewalker: WM('Gale Walker', 'galewalker', 0, [52, 53], 5400, [62, 82], 2150, { speed: 3.8, range: 3.6, radius: 1.0 }),
  bronzegale: WM('Bronze Gale Walker', 'galewalker', 1, [52, 53], 5600, [62, 84], 2200, { speed: 3.8, range: 3.6, radius: 1.0 }),
  towerwarden: WM('Tower Warden', 'towerwarden', 0, [54, 55], 6200, [66, 88], 2400, { range: 3.4, radius: 1.3 }),
  bronzetower: WM('Old Bronze Tower Warden', 'towerwarden', 1, [54, 55], 17000, [88, 116], 2450, { range: 3.4, radius: 1.3, elite: true,
    abilities: [{ kind: 'nova', every: 14, r: 5, delay: 1.7, dmg: 1.3, text: 'The Old Bronze Tower Warden brings its winding bar down on the snow!' }] }),
  snowplough: WM('The Snowbound Plough', 'iceplough', 1, [53, 53], 31000, [80, 108], 6200, { elite: true, rare: true, loot: 'rareWind1', speed: 3.0, range: 3.8, swing: 2.6, radius: 1.7,
    abilities: [{ kind: 'circles', every: 10, n: 4, r: 2.8, delay: 1.8, dmg: 1.3, text: 'The Snowbound Plough throws packed snow off its blade!' }] }),
  oldsweeper: WM('The Old Rime Sweeper', 'rimesweeper', 1, [55, 55], 35000, [88, 116], 6700, { elite: true, rare: true, loot: 'rareWind2', speed: 3.4, radius: 1.5,
    abilities: [{ kind: 'nova', every: 12, r: 6, delay: 1.8, dmg: 1.5, text: 'The Old Rime Sweeper races its brush drum and flings ice all round it!' }] }),
  stormplough: { name: 'The Stormplough', model: 'stormplough', lvl: [55, 55], hp: 121000, dmg: [72, 98], speed: 2.0, aggro: 12, range: 7, swing: 3.0, xp: 24000, loot: 'stormplough', radius: 5.0, elite: true, boss: true, world: true,
    notice: 'is grinding through the snowfield below the Makers’ Rest on the Windward Heights, still clearing a road nobody uses', yell: 'swings its wind engine round into the gale!',
    abilities: [{ kind: 'circles', every: 9, n: 6, r: 3.6, delay: 2.0, dmg: 1.4, text: 'The Stormplough heaves its blade and throws slabs of packed snow!' },
      { kind: 'nova', every: 17, r: 11, delay: 2.4, dmg: 1.7, text: 'The Stormplough’s wind engine races, and a gale blasts across the snow!' },
      { kind: 'adds', at: 0.5, mob: 'galewalker', n: 3, text: 'Gale walkers stalk out of the drifts to clear the Stormplough’s road!' },
      { kind: 'enrage', at: 0.2, text: 'The Stormplough drops its blade and charges!' }] },
});
Object.assign(LOOT_TABLES, {
  windMach: { gold: [34, 52], items: [['galeiron', 0.45], ['bronzecog', 0.2], ['draught', 0.12]], gear: 0.4 },
  rareWind1: { gold: [280, 360], items: [['w_ploughplate', 1]], gear: 1, gearQ: 3 },
  rareWind2: { gold: [280, 360], items: [['w_sweepgreaves', 1]], gear: 1, gearQ: 3 },
  stormplough: { gold: [480, 660], items: [['w_stormheart', 0.35], ['w_stormplate', 0.35], ['w_stormmaul', 0.3], ['tonic', 1], ['galeiron', 1]], gear: 1, gearQ: 4, gearN: 2 },
});
SPAWNS.push(
  // the Drift Fields (50-51), north and south of the camp and east of it toward the first ridge
  { mob: 'iceplough', x: 470, z: -2160, r: 6, n: 3 }, { mob: 'iceplough', x: 490, z: -2040, r: 6, n: 3 }, { mob: 'iceplough', x: 445, z: -2185, r: 6, n: 3 }, { mob: 'iceplough', x: 500, z: -2075, r: 5, n: 2 },
  { mob: 'rimesweeper', x: 497, z: -2130, r: 6, n: 3 }, { mob: 'rimesweeper', x: 465, z: -2040, r: 6, n: 3 }, { mob: 'rimesweeper', x: 445, z: -2160, r: 6, n: 3 },
  { mob: 'rimesweeper', x: 484, z: -2188, r: 5, n: 2 }, { mob: 'rimesweeper', x: 450, z: -2020, r: 6, n: 3 },
  // the Engine Rows (52-53), in the troughs between the ridges, between the pads; nothing north-west of the second ridge's
  // trough on the north side of the road, so the first ridge's north pad and its brake lever stay clear
  { mob: 'galewalker', x: 567, z: -2146, r: 4, n: 3 }, { mob: 'galewalker', x: 567, z: -2186, r: 5, n: 3 }, { mob: 'galewalker', x: 545, z: -2054, r: 4, n: 3 }, { mob: 'galewalker', x: 567, z: -2015, r: 5, n: 3 },
  { mob: 'bronzegale', x: 567, z: -2084, r: 4, n: 2 }, { mob: 'bronzegale', x: 520, z: -2025, r: 5, n: 2 }, { mob: 'bronzegale', x: 588, z: -2054, r: 4, n: 2 }, { mob: 'bronzegale', x: 588, z: -2146, r: 4, n: 2 },
  // the Makers' Rest approaches (54-55), north of the hollow's rim and one pack south-east of it
  { mob: 'towerwarden', x: 608, z: -2160, r: 5, n: 3 }, { mob: 'towerwarden', x: 640, z: -2180, r: 5, n: 3 }, { mob: 'towerwarden', x: 648, z: -2058, r: 3, n: 3 },
  { mob: 'bronzetower', x: 632, z: -2155, r: 4, n: 2 },
  { mob: 'snowplough', x: 545, z: -2022, r: 5, n: 1 }, { mob: 'oldsweeper', x: 610, z: -2190, r: 4, n: 1 },
  { mob: 'stormplough', path: [[608, -2030], [624, -2042], [638, -2022], [620, -2012], [608, -2030]], r: 2, n: 1, world: true },
);

// ============================================================================ P12.4 THE PUMP WORKS (dungeon, level 55)
// (block owned by the Pump Works work; Chapters 38-39's story goes in story.js, not here)
// The deep shafts under the Engine Rows, where the wind engines once drove great pumps lifting meltwater up to the Heights.
// With the engines stopped, the pumps still try to work on their own and the shafts are filling. Three bosses, all machines:
// the Rod Engine (the walking engine that drove the pump rods in the Rod Hall), the Cistern Warden (the tank engine that kept
// the cisterns level) and the Great Pump (the vast beam-engine pump over the deepest shaft, the last boss: below half health
// its shaft floods and the water comes up across the floor). Their strikes are pressure, steam and water (water/teleColor:
// blue circles that burst as spray, client game.js). Heroic is the raid kind (dmode raidheroic, after a Normal clear); there
// the bosses' named drops come at item level 74 (rhIlvl). Trash uses the Heights machine models.
{
  const PW = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.4, aggro: 13, range: 3.0, swing: 2.3, xp, loot: 'pumpTrash', radius: 1.2, ...extra });
  const WET = { water: true, teleColor: '#2f9cff', novaColor: '#e2f2ff' };
  Object.assign(MOBS, {
    pwplough: PW('Shaft Ice Plough', 'iceplough', 1, [54, 55], 7400, [70, 94], 2650, { speed: 3.0, range: 3.4, swing: 2.6, radius: 1.6 }),
    pwsweeper: PW('Shaft Rime Sweeper', 'rimesweeper', 1, [54, 55], 7000, [68, 92], 2600, { speed: 3.6, radius: 1.4 }),
    pwwalker: PW('Shaft Gale Walker', 'galewalker', 1, [54, 55], 7200, [68, 92], 2600, { speed: 3.8, range: 3.6, radius: 1.0 }),
    pwwarden: PW('Shaft Tower Warden', 'towerwarden', 0, [54, 55], 7800, [72, 96], 2700, { range: 3.4, radius: 1.3 }),
    rodengine: PW('The Rod Engine', 'rodengine', 0, [55, 55], 38000, [74, 98], 9200, { ...WET, loot: 'u_rodengine', rhIlvl: 74, speed: 2.8, range: 4.4, swing: 2.6, radius: 2.6, elite: true,
      abilities: [{ kind: 'beam', every: 13, len: 18, r: 1.9, delay: 1.9, dmg: 1.5, text: 'The Rod Engine drives its pump rod down, and a jet of water under pressure shoots along the floor!' },
        { kind: 'circles', every: 10, n: 4, r: 3.0, delay: 1.8, dmg: 1.4, text: 'Steam bursts out of the leaking glands along the Rod Engine\u2019s rods!' },
        { kind: 'adds', at: 0.5, mob: 'pwsweeper', n: 2, text: 'Two rime sweepers clatter down the staging to clear the Rod Engine\u2019s shafts!' }] }),
    cisternwarden: PW('The Cistern Warden', 'cisternwarden', 0, [55, 55], 40000, [76, 100], 9400, { ...WET, loot: 'u_cisternwarden', rhIlvl: 74, speed: 2.4, range: 4.6, swing: 2.6, radius: 2.8, elite: true,
      abilities: [{ kind: 'nova', every: 15, r: 8, delay: 2.2, dmg: 1.6, text: 'The Cistern Warden opens its relief valve, and steam blasts out across the gallery!' },
        { kind: 'circles', every: 9, n: 4, r: 2.8, delay: 1.7, dmg: 1.4, text: 'Meltwater bursts up out of the cisterns under pressure!' },
        { kind: 'adds', at: 0.5, mob: 'pwwalker', n: 2, text: 'Gale walkers climb down out of the air shafts to tend the Cistern Warden!' }] }),
    // the last boss: three abilities, and the second only once the shaft is flooding (below half health): the rising water
    greatpump: PW('The Great Pump', 'greatpump', 0, [56, 56], 310000, [84, 112], 27000, { ...WET, loot: 'u_greatpump', rhIlvl: 74, speed: 0, aggro: 18, range: 7.0, swing: 3.0, radius: 4.8, elite: true, boss: true,
      abilities: [{ kind: 'circles', every: 10, n: 4, r: 3.2, delay: 1.8, dmg: 1.45, above: 0.5, text: 'The Great Pump strokes, and meltwater spouts out of the shaft collars!' },
        { kind: 'circles', every: 7, n: 8, r: 3.8, delay: 2.0, dmg: 1.5, below: 0.5, text: 'The Great Pump loses its stroke! The shaft floods, and water comes up across the floor, and it keeps rising!' },
        { kind: 'nova', every: 16, r: 9, delay: 2.4, dmg: 1.7, text: 'The Great Pump\u2019s cylinder blows off its steam, and a scalding cloud rolls over everything near it!' }] }),
  });
  // named drops: item level 70 (the Rod Engine), 71 (the Cistern Warden) and 72 (the Great Pump), raised to 74 on Heroic
  const ST = {
    weapon: { power: 118, hp: 40, crit: 7 }, trinket: { power: 100, hp: 44, haste: 30 },
    plate: { armor: 420, hp: 112, power: 24 }, mail: { armor: 380, hp: 110, crit: 8 }, cloth: { armor: 380, hp: 96, power: 30 },
  };
  const W = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'];
  const N = (name, slot, kind, ilvl, desc) => {
    const w = W.includes(kind) ? kind : null, wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    const base = ST[w ? 'weapon' : wt || 'trinket'], k = (ilvl / 50) * 1.45, stats = {}; // above the Heights' quest rewards, so the Pump Works are worth farming
    for (const [s, v] of Object.entries(base)) stats[s] = Math.round(v * k);
    const icon = w ? `w_${w}~3` : wt ? `a_${wt}_${slot}~3` : 't_trinket~3';
    return { name, slot, q: 4, ilvl, req: 54, stats, desc, unique: true, icon, ...(w ? { wtype: w } : {}), ...(w === 'pistol' ? { classes: ['deadeye'] } : {}), ...(wt ? { weight: wt } : {}) };
  };
  const drops = {
    rodengine: [['Pump-Rod Maul', 'weapon', 'hammer', 70, 'The crosshead off the Rod Engine\u2019s rod, shrunk onto a shaft of black iron.'], ['Staging-Plank Greaves', 'legs', 'plate', 70, 'Faced with the iron that shod the staging boards in the Rod Hall.']],
    cisternwarden: [['Relief-Valve Blade', 'weapon', 'sword', 71, 'The valve spindle from the Cistern Warden, drawn out and ground to an edge.'], ['Cistern-Keeper\u2019s Hood', 'head', 'cloth', 71, 'Felt from the cistern lids, stiff with frost. It keeps the drips off.'], ['Relief-Line Pistol', 'weapon', 'pistol', 71, 'Its barrel was a relief line from the cistern. It kicks like a burst pipe.']],
    greatpump: [['Beam-Engine Hauberk', 'chest', 'mail', 72, 'Links of the Great Pump\u2019s beam chain, each one stamped with a stroke count.'], ['The Stroke Counter', 'trinket', 'trinket', 72, 'A brass counter off the Great Pump. It still clicks over, one stroke at a time.'], ['Plunger-Rod Staff', 'weapon', 'staff', 72, 'A length of the Great Pump\u2019s plunger rod, marked in the Makers\u2019 feet.']],
  };
  for (const [mob, list] of Object.entries(drops)) list.forEach(([name, slot, kind, ilvl, desc], i) => { ITEMS[`u_${mob}${i + 1}`] = N(name, slot, kind, ilvl, desc); });
  const T = (mob, gold, extra, gearQ, gearN) => ({ gold, items: [...drops[mob].map((_, i) => [`u_${mob}${i + 1}`, mob === 'greatpump' ? 0.3 : 0.25]), ...extra], gear: 1, gearQ, gearN });
  const boss = [['tonic', 1], ['galeiron', 1]], last = [['draught', 1], ['galeiron', 1]];
  Object.assign(LOOT_TABLES, {
    pumpTrash: { gold: [36, 54], items: [['galeiron', 0.45], ['bronzecog', 0.25], ['draught', 0.12]], gear: 0.4 },
    u_rodengine: T('rodengine', [200, 260], boss, 3, 2), u_cisternwarden: T('cisternwarden', [200, 260], boss, 3, 2), u_greatpump: T('greatpump', [560, 740], last, 4, 3),
  });
  // trash packs chamber by chamber, south to north (local metres in the dungeon grid), each boss in its own hall
  SPAWNS.push(
    ds('pumpworks', 'pwwarden', 64, 110, 2, 2),
    ds('pumpworks', 'pwplough', 40, 98, 3, 2), ds('pumpworks', 'pwwalker', 88, 98, 3, 2), ds('pumpworks', 'pwsweeper', 46, 84, 3, 2), ds('pumpworks', 'pwplough', 92, 84, 3, 2),
    ds('pumpworks', 'rodengine', 70, 84, 1, 1),
    ds('pumpworks', 'pwwarden', 37, 71, 2, 2),
    ds('pumpworks', 'pwsweeper', 22, 58, 3, 2), ds('pumpworks', 'pwwalker', 64, 58, 3, 2), ds('pumpworks', 'pwplough', 22, 40, 3, 2),
    ds('pumpworks', 'cisternwarden', 46, 44, 1, 1),
    ds('pumpworks', 'pwwarden', 81, 42, 2, 2),
    ds('pumpworks', 'pwplough', 90, 44, 3, 2), ds('pumpworks', 'pwwalker', 115, 44, 3, 2), ds('pumpworks', 'pwsweeper', 90, 28, 3, 2), ds('pumpworks', 'pwwarden', 115, 28, 3, 2),
    ds('pumpworks', 'greatpump', 102, 16, 1, 1),
  );
  // kills in the Pump Works count toward the Windwrights, like the Heights themselves
  FACTIONS.windwrights.zones.push('pumpworks');
}
// ============================================================================ end of P12.4 THE PUMP WORKS

// ============================================================================ P12.4 CHAPTERS 38-39 (story text in story.js)
// "The Engine Rows" and "The Pump Works": the crew free the rest of the first ridge's brakes and the whole second ridge (new
// quest objects, one lever at the foot of each tower, as Chapter 37's), the engines turn but the pump houses stay dry, and
// Pumpwright Hashim explains: the engines drove the Makers' pumps below, which lifted meltwater into the Heights' cisterns and
// sent the overflow down the cliff channels to feed the Rime Steps' dams. The machines that tended the pumps have gone wrong.
// The third ridge's brakes are freed (all but the twelfth engine, held from the Makers' Rest), and a company of five stops the
// Great Pump in the Pump Works. Two new Windwrights, both men: Ridgeman Zubair on the second ridge's crest walk north of the
// road, and Pumpwright Hashim on the road by the pump house. Turn-ins on the Heights give Windwright reputation. Rewards item
// level 70-74. The Pump Works' door opens once Chapter 38's "Dry Spouts" is done (Hashim unbars it).
{
  const R = (name, slot, lvl, art, haste = false) => {
    const g = gear(name, slot, 4, lvl, haste);
    if (slot === 'weapon') { g.wtype = art; g.icon = `w_${art}~3`; }
    else if (slot === 'trinket') g.icon = 't_trinket~3';
    else if (slot === 'back') g.icon = 'a_back~3';
    else { g.weight = art; g.icon = `a_${art}_${slot}~3`; }
    return g;
  };
  Object.assign(ITEMS, {
    c38_shell: { name: 'Bronze Bearing Shell', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A spare bronze shell the Makers cast to fit a wind engine’s hub bearing, carried off by a machine on the rows. Zubair wants it for the second ridge.' },
    r_c38_gloves: R('Brake-Pin Gauntlets', 'hands', 70, 'plate'),
    r_c38_boots: R('Ridge-Walker’s Boots', 'feet', 70, 'mail'),
    r_c38_legs: R('Gale-Scoured Leggings', 'legs', 71, 'cloth'),
    r_c38_helm: R('Tower-Climber’s Helm', 'head', 71, 'plate'),
    r_c38_axe: R('Ice-Chipper’s Axe', 'weapon', 71, 'axe'),
    r_c38_charm: { ...R('Bearing Shell Keepsake', 'trinket', 72, null, true), desc: 'A cracked bearing shell off the second ridge, polished bright by a thousand turns of the hub.' },
    r_c38_mantle: R('Engine Rows Mantle', 'shoulders', 72, 'mail'),
    r_c38_coat: R('Pump-House Coat', 'chest', 72, 'cloth'),
    r_c39_gloves: R('Brake-Rod Gloves', 'hands', 72, 'cloth'),
    r_c39_boots: R('Third Ridge Sabatons', 'feet', 73, 'plate'),
    r_c39_legs: R('Tower Warden Legguards', 'legs', 73, 'mail'),
    r_c39_hood: R('Windwright’s Hood', 'head', 73, 'cloth'),
    r_c39_staff: R('Pumpwright’s Staff', 'weapon', 74, 'staff'),
    r_c39_charm: { ...R('Rising Water Keepsake', 'trinket', 74, null, true), desc: 'A brass gauge glass off the Great Pump’s cistern pipe, with meltwater still standing in it.' },
    r_c39_mantle: R('Mantle of the Windwrights', 'shoulders', 74, 'plate'),
    r_c39_cloak: R('Cloud-Deck Cloak', 'back', 74),
  });
  // the bearing shells come off the Heights' machines (only for those on the quest)
  LOOT_TABLES.windMach.items.push(['c38_shell', 0.5]);
  // the brake levers: one at the foot of each tower on its pad's west side, like Chapter 37's (pad 0); the first ridge's other
  // three (rowbrake), the second ridge's four, iced in (rowice), and the third ridge's three northern ones (farbrake). The
  // twelfth engine (the third ridge's south pad) has no lever: its brake rod runs off east to the Makers' Rest.
  OBJECT_KINDS.rowbrake = { prompt: 'Knock out the brake pin', goal: 'First ridge brakes released', done: 'released', engine: true };
  OBJECT_KINDS.rowice = { prompt: 'Chip out the ice and lift the brake', goal: 'Second ridge brakes cleared', done: 'cleared', engine: true };
  OBJECT_KINDS.farbrake = { prompt: 'Knock out the brake pin', goal: 'Third ridge brakes released', done: 'released', engine: true };
  const lever = (id, kind, P) => OBJECTS.push({ id, kind, x: P.x - 4.2, z: P.z - 1.6, ry: -Math.PI / 2 });
  [1, 2, 3].forEach((i, k) => lever('o_rowbrake' + (k + 1), 'rowbrake', HEIGHTS.pads[i]));
  [4, 5, 6, 7].forEach((i, k) => lever('o_rowice' + (k + 1), 'rowice', HEIGHTS.pads[i]));
  [8, 9, 10].forEach((i, k) => lever('o_farbrake' + (k + 1), 'farbrake', HEIGHTS.pads[i]));
  NPCS.push(
    { id: 'n_wh_zubair', name: 'Ridgeman Zubair', title: 'The Windwrights', look: 'villager', v: 3, x: 558.5, z: -2116, ry: -1.9, quests: [],
      greet: 'I walk the rows for Kamal. Twelve towers, every day, in every wind. Lately some of them have been moving.' },
    { id: 'n_wh_hashim', name: 'Pumpwright Hashim', title: 'The Windwrights', look: 'villager', v: 8, x: 537, z: -2096, ry: 2.2, quests: [],
      greet: 'My family has kept the pump house door for longer than the camp has kept its stoves. Under it the shafts go down further than any rope I own.' },
  );
  // the Pump Works' door is barred until Hashim has heard why the spouts are dry
  DUNGEON_BY_ID.pumpworks.need = { done: 'm_c38_dry', text: 'The pump house door is barred from inside, and Pumpwright Hashim keeps the key. He will unbar it once he hears why the spouts are dry (Chapter 38: "Dry Spouts").' };
}
// the Windwrights' stores, kept by Windwright Kamal at the Windward Camp (ranks Friendly to Exalted, item level 72-74)
Object.assign(ITEMS, {
  rep_ww1: { name: 'Windwright’s Gale Cloak', slot: 'back', icon: 'a_back~2', q: 3, stats: { armor: 350, hp: 120, haste: 20 }, ilvl: 72 },
  rep_ww2: { name: 'Brake-Lever Gauntlets', slot: 'hands', icon: 'a_plate_hands~2', weight: 'plate', q: 3, stats: { armor: 390, hp: 126, power: 42 }, ilvl: 72 },
  rep_ww3: { name: 'Ridgeman’s Mail Spaulders', slot: 'shoulders', icon: 'a_mail_shoulders~3', weight: 'mail', q: 4, stats: { armor: 530, hp: 163, crit: 10 }, ilvl: 73 },
  rep_ww4: { name: 'Sail-Board Hood', slot: 'head', icon: 'a_cloth_head~3', weight: 'cloth', q: 4, stats: { armor: 378, hp: 158, power: 44 }, ilvl: 73 },
  rep_ww5: { name: 'Windwright Hub-Spanner', slot: 'weapon', icon: 'w_mace~3', wtype: 'mace', q: 4, stats: { power: 276, haste: 29, hp: 68 }, ilvl: 74 },
});
REP_SHOP.windwrights = [{ item: 'rep_ww1', rank: 1, price: 26000 }, { item: 'rep_ww2', rank: 2, price: 32000 }, { item: 'rep_ww3', rank: 3, price: 38000 }, { item: 'rep_ww4', rank: 3, price: 38000 }, { item: 'rep_ww5', rank: 4, price: 46000 }];
// wind colours for the runabout: cloud-grey panels, sail-board timber trim and an iron boiler (Honored with the Windwrights)
PAINTS.windward = { name: 'Windward Gale', body: '#c4ccd4', paint: true, trim: '#8a6a44', metal: 'iron', seat: '#38424c', need: { rep: 'windwrights', rank: 2 } };
// the Main Story ran (applyStory) before these men were placed: give them their story quests
for (const [id, Q] of Object.entries(QUESTS)) if (Q.msq) { const g = NPCS.find((n) => n.id === Q.giver); if (g && !(g.quests ||= []).includes(id)) g.quests.push(id); }
// ============================================================================ end of P12.4 CHAPTERS 38-39

// ============================================================================ P12.5 THE MAKERS' REST (raid, level 55)
// (docs/ai/p125_design.md; Chapter 40's story goes in story.js, not here)
// The Makers' last workshop, under the hollow at the head of the Windward Heights (dungeon id 'lastworkshop': 'makersrest' is
// the Heights zone round the hollow). Not a tomb: a lit, tidy workshop whose shop machines still run on alone, cutting
// boards and turning hubs nobody fits. Four bosses, all machines (models in client/assets/makersRest.js): the Shop Crane (a
// gantry crane come down off its rails), the Board Plane (a planing engine for sail-boards), the Great Lathe (the turning
// engine for the wind engines' hubs) and THE GREAT GOVERNOR, the engine that kept every tower in time, at the north wall of
// the Governor Room; it never moves, and each phase its brake rods come down wider, more often and in more places. Strikes
// are physical (falling castings, shavings, hot swarf, steam, driven rods), so no water flag. Ten players, Normal and Heroic
// (the raid kind, after a Normal clear); weekly lockouts per boss; named drops at item level 76-78, raised to 80 on Heroic
// (rhIlvl); Makers' marks from every boss. The door (shared/dungeons.js) opens once Kamal has lifted the bar (m_c40_bar).
// The Dragonslayer set and armour stay on the Great Dam (owner's decision, 14 Nov 2026).
{
  const MR = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.4, aggro: 13, range: 3.2, swing: 2.2, xp, loot: 'restRaid', radius: 1.2, elite: true, ...extra });
  Object.assign(MOBS, {
    // trash: the Heights' own machines, still keeping the workshop
    mrwarden: MR('Workshop Tower Warden', 'towerwarden', 1, [55, 55], 8200, [76, 100], 2500, { range: 3.4, radius: 1.3 }),
    mrwalker: MR('Workshop Gale Walker', 'galewalker', 1, [55, 55], 7600, [74, 98], 2450, { speed: 3.8, range: 3.4, radius: 1.0 }),
    mrsweeper: MR('Workshop Rime Sweeper', 'rimesweeper', 1, [55, 55], 7400, [72, 96], 2400, { speed: 3.6, radius: 1.4 }),
    mrplough: MR('Yard Ice Plough', 'iceplough', 1, [55, 55], 7900, [74, 100], 2500, { speed: 3.0, range: 3.4, swing: 2.6, radius: 1.6 }),
    // 1. the Shop Crane: a gantry crane on wheeled bogies, its hoist trolley carrying a crated casting
    shopcrane: MR('The Shop Crane', 'shopcrane', 0, [55, 55], 415000, [76, 100], 44000, { loot: 'u_shopcrane', rhIlvl: 80, speed: 2.6, aggro: 18, range: 5.2, swing: 2.6, radius: 3.4, boss: true, raid: true,
      abilities: [
        { kind: 'circles', every: 10, n: 5, r: 3.0, delay: 1.8, dmg: 1.45, text: 'The Shop Crane lets go of its load, and castings come crashing down!' },
        { kind: 'beam', every: 12, len: 24, r: 2.1, delay: 1.8, dmg: 1.55, text: 'The Shop Crane runs its trolley out along the bridge, and the spreader bar sweeps the floor!' },
        { kind: 'adds', at: 0.5, mob: 'mrwalker', n: 3, text: 'Gale walkers climb down off the crane rails to rig the Shop Crane’s load!' },
        { kind: 'enrage', at: 0.15, text: 'The Shop Crane’s brake slips, and it runs the length of its rails!' }] }),
    // 2. the Board Plane: a long planing engine on treads, a half-planed sail-board clamped on its bed
    boardplane: MR('The Board Plane', 'boardplane', 0, [55, 55], 440000, [78, 102], 46000, { loot: 'u_boardplane', rhIlvl: 80, speed: 2.2, aggro: 18, range: 5.6, swing: 2.8, radius: 3.6, boss: true, raid: true,
      abilities: [
        { kind: 'beam', every: 11, len: 28, r: 2.2, delay: 1.8, dmg: 1.6, text: 'The Board Plane runs its bed out the length of the loft!' },
        { kind: 'circles', every: 11, n: 6, r: 3.2, delay: 1.9, dmg: 1.5, text: 'Finished sail-boards slide off the racks!' },
        { kind: 'nova', every: 14, r: 7.5, delay: 2.0, dmg: 1.6, text: 'The Board Plane’s cutter block races, and shavings and splinters fly all round it!' },
        { kind: 'enrage', at: 0.15, text: 'The Board Plane runs on with nobody to feed it!' }] }),
    // 3. the Great Lathe: a heavy turning engine on treads, a wind engine's hub clamped to its faceplate
    greatlathe: MR('The Great Lathe', 'greatlathe', 0, [55, 55], 465000, [80, 104], 48000, { loot: 'u_greatlathe', rhIlvl: 80, speed: 2.4, aggro: 18, range: 5.2, swing: 2.6, radius: 3.4, boss: true, raid: true,
      abilities: [
        { kind: 'nova', every: 13, r: 7.5, delay: 2.0, dmg: 1.6, text: 'The Great Lathe spins up, and hot swarf flies off the work!' },
        { kind: 'circles', every: 10, n: 5, r: 3.2, delay: 1.9, dmg: 1.5, text: 'Chips of hot iron rain off the Great Lathe’s tool!' },
        { kind: 'adds', at: 0.5, mob: 'mrsweeper', n: 3, text: 'Rime sweepers come out from under the benches to clear the Great Lathe’s swarf!' },
        { kind: 'phase', below: 0.4, text: 'The hub on the Great Lathe works loose in its clamps!' },
        { kind: 'beam', every: 10, len: 26, r: 2.2, delay: 1.7, dmg: 1.6, below: 0.4, text: 'The hub flies off the Great Lathe and skids down the shop!' },
        { kind: 'enrage', at: 0.12, text: 'The Great Lathe runs flat out!' }] }),
    // 4. THE GREAT GOVERNOR: the timing engine at the north wall of the Governor Room, which never moves. Three phases: as it
    // fights the eleven engines it never set going, its brake rods come down wider, more often and in more places
    greatgovernor: MR('The Great Governor', 'greatgovernor', 0, [56, 56], 620000, [86, 114], 68000, { loot: 'u_greatgovernor', rhIlvl: 80, speed: 0, aggro: 22, range: 10.0, swing: 3.0, radius: 6.0, boss: true, raid: true,
      abilities: [
        { kind: 'circles', every: 11, n: 5, r: 3.0, delay: 1.9, dmg: 1.5, above: 0.66, text: 'The Great Governor drops a brake rod into its slot, and the floor jumps!' },
        { kind: 'beam', every: 12, len: 26, r: 2.3, delay: 1.8, dmg: 1.6, above: 0.66, text: 'A brake rod drives out of the Great Governor along the floor!' },
        { kind: 'phase', below: 0.66, text: 'The Great Governor counts eleven towers it never set turning, and fights them.' },
        { kind: 'adds', at: 0.66, mob: 'mrwarden', n: 3, text: 'Tower wardens climb up out of the rod shafts to set the brakes again!' },
        { kind: 'circles', every: 9, n: 7, r: 3.4, delay: 1.8, dmg: 1.55, below: 0.66, above: 0.33, text: 'Rods slam down all along the Great Governor’s frame!' },
        { kind: 'beam', every: 11, len: 26, r: 2.3, delay: 1.7, dmg: 1.6, n: 2, below: 0.66, above: 0.33, text: 'Two brake rods drive out across the room!' },
        { kind: 'nova', every: 15, r: 8, delay: 2.2, dmg: 1.6, below: 0.66, above: 0.33, text: 'The Great Governor’s timing cylinder blows off its steam!' },
        { kind: 'phase', below: 0.33, text: 'The Great Governor’s drum runs out of count. Every rod at once!' },
        { kind: 'circles', every: 7, n: 8, r: 3.8, delay: 1.8, dmg: 1.6, below: 0.33, text: 'Every rod in the floor jerks at once!' },
        { kind: 'beam', every: 10, len: 28, r: 2.4, delay: 1.7, dmg: 1.65, n: 3, below: 0.33, text: 'Three rods drive out of the frame, one after another!' },
        { kind: 'nova', every: 13, r: 9, delay: 2.2, dmg: 1.7, below: 0.33, text: 'Steam blasts out of every valve on the Great Governor!' },
        { kind: 'adds', at: 0.33, mob: 'mrwalker', n: 4, text: 'Gale walkers drop out of the rod shafts to hold the brakes!' },
        { kind: 'enrage', at: 0.1, text: 'The Great Governor tries to set all twelve brakes at once!' }] }),
  });
  // named drops: item level 76 (the Shop Crane), 77 (the Board Plane and the Great Lathe), 78 (the Great Governor), 80 on
  // Heroic. The same stat budget as the Great Dam's named drops (x1.45 over the item-level line).
  const ST = {
    weapon: { power: 118, hp: 40, crit: 7 }, trinket: { power: 100, hp: 44, haste: 30 },
    plate: { armor: 420, hp: 112, power: 24 }, mail: { armor: 380, hp: 110, crit: 8 }, cloth: { armor: 380, hp: 96, power: 30 },
  };
  const W = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'];
  const N = (name, slot, kind, ilvl, desc) => {
    const w = W.includes(kind) ? kind : null, wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    const base = ST[w ? 'weapon' : wt || 'trinket'], k = (ilvl / 50) * 1.45, stats = {};
    for (const [s, v] of Object.entries(base)) stats[s] = Math.round(v * k);
    const icon = w ? `w_${w}~3` : wt ? `a_${wt}_${slot}~3` : 't_trinket~3';
    return { name, slot, q: 4, ilvl, req: 55, stats, desc, unique: true, icon, ...(w ? { wtype: w } : {}), ...(w === 'pistol' ? { classes: ['deadeye'] } : {}), ...(wt ? { weight: wt } : {}) };
  };
  const drops = {
    shopcrane: [
      ['Crane-Rail Blade', 'weapon', 'sword', 76, 'A length of the Shop Crane’s rail, drawn out and ground to an edge.'],
      ['Gantry Greaves', 'legs', 'plate', 76, 'Faced with plate off the crane’s end carriages, still grey-green with shop paint.'],
      ['Rigger’s Grips', 'hands', 'mail', 76, 'Chain off the hoist, worked into gloves. They never let a load slip.']],
    boardplane: [
      ['Board-Loft Longbow', 'weapon', 'bow', 77, 'Cut from a sail-board the Board Plane finished and nobody ever fitted.'],
      ['Shaving-Felt Hood', 'head', 'cloth', 77, 'Felt packed with pale shavings off the loft floor. Warm, and it smells of timber.'],
      ['Plane-Bed Pauldrons', 'shoulders', 'plate', 77, 'Plate off the Board Plane’s bed, worn smooth by a thousand boards.'],
      ['Cutter-Block Pistol', 'weapon', 'pistol', 77, 'Its barrel was bored from the Board Plane’s cutter spindle. It throws a long, straight shot.']],
    greatlathe: [
      ['Tailstock Mace', 'weapon', 'mace', 77, 'The Great Lathe’s tailstock centre, on a haft of black iron.'],
      ['Turner’s Hauberk', 'chest', 'mail', 77, 'Links of the lathe’s drive chain, every one turned true.'],
      ['Tool-Rest Boots', 'feet', 'cloth', 77, 'Wrapped in the leather the turners stood on at the tool rest.'],
      ['Chuck-Key Scimitar', 'weapon', 'scimitar', 77, 'Forged from the long key that tightened the Great Lathe’s clamps.']],
    greatgovernor: [
      ['Brake-Rod Staff', 'weapon', 'staff', 78, 'One of the Great Governor’s twelve brake rods, marked off in the Makers’ measure.'],
      ['Timing-Drum Breastplate', 'chest', 'plate', 78, 'Plate off the Great Governor’s timing drum, cut with a row of flat cams.'],
      ['The Governor’s Count', 'trinket', 'trinket', 78, 'Twelve brass teeth on a drum. It clicks once for every tower that turns.'],
      ['Makers’ Measuring Rod', 'weapon', 'rod', 78, 'The rod the Makers set every part against. Every mark on it is still true.'],
      ['Wind-Vane Mantle', 'shoulders', 'cloth', 78, 'Grey wool from the Governor Room, frosted only where the door let the cold in.']],
  };
  for (const [mob, list] of Object.entries(drops)) list.forEach(([name, slot, kind, ilvl, desc], i) => { ITEMS[`u_${mob}${i + 1}`] = N(name, slot, kind, ilvl, desc); });
  const T = (mob, gold, ch, extra, gearN) => ({ gold, items: [...drops[mob].map((_, i) => [`u_${mob}${i + 1}`, ch]), ...extra], gear: 1, gearQ: 4, gearN });
  Object.assign(LOOT_TABLES, {
    restRaid: { gold: [80, 116], items: [['galeiron', 0.5], ['bronzecog', 0.3], ['draught', 0.2]], gear: 0.45, gearQ: 3 },
    u_shopcrane: T('shopcrane', [1150, 1400], 0.3, [['tonic', 1], ['galeiron', 1]], 2),
    u_boardplane: T('boardplane', [1200, 1450], 0.3, [['tonic', 1], ['galeiron', 1]], 2),
    u_greatlathe: T('greatlathe', [1250, 1500], 0.3, [['tonic', 1], ['galeiron', 1]], 2),
    u_greatgovernor: T('greatgovernor', [1800, 2200], 0.28, [['draught', 1], ['galeiron', 1]], 3),
  });
  // Makers' marks for Quartermaster Hamid, more from each boss deeper into the workshop
  for (const [t, n] of [['u_shopcrane', 6], ['u_boardplane', 6], ['u_greatlathe', 7], ['u_greatgovernor', 12]]) for (let i = 0; i < n; i++) LOOT_TABLES[t].items.push(['makermark', 1]);
  // and a rest-marked row in Hamid's stock to spend them on (item level 74, hands this time)
  Object.assign(ITEMS, {
    mk_rgauntlets: { name: 'Rest-Marked Gauntlets', slot: 'hands', icon: 'a_plate_hands~3', weight: 'plate', q: 4, stats: { armor: 863, hp: 232, power: 49 }, ilvl: 74 },
    mk_rgrips: { name: 'Rest-Marked Grips', slot: 'hands', icon: 'a_mail_hands~3', weight: 'mail', q: 4, stats: { armor: 765, hp: 224, crit: 16 }, ilvl: 74 },
    mk_rgloves: { name: 'Rest-Marked Gloves', slot: 'hands', icon: 'a_cloth_hands~3', weight: 'cloth', q: 4, stats: { armor: 506, hp: 185, power: 57 }, ilvl: 74 },
    mk_rcharm: { name: 'Rest-Marked Keepsake', slot: 'trinket', icon: 't_trinket~3', q: 4, stats: { power: 148, hp: 82, crit: 19 }, ilvl: 74 },
  });
  MARK_SHOP.push({ item: 'mk_rgauntlets', price: 100 }, { item: 'mk_rgrips', price: 100 }, { item: 'mk_rgloves', price: 100 }, { item: 'mk_rcharm', price: 120 });
  // the halls, south to north (local metres in the raid grid): trash packs on the way, each boss in its own hall, the
  // Great Governor last (it is the raid's final boss: Heroic opens after a Normal kill of it)
  SPAWNS.push(
    ds('lastworkshop', 'mrwarden', 70, 188, 1, 1), ds('lastworkshop', 'mrwarden', 82, 188, 1, 1),
    ds('lastworkshop', 'mrwalker', 44, 184, 3, 2), ds('lastworkshop', 'mrsweeper', 106, 184, 3, 2), ds('lastworkshop', 'mrplough', 46, 168, 3, 2), ds('lastworkshop', 'mrwarden', 104, 168, 3, 2),
    ds('lastworkshop', 'shopcrane', 75, 174, 1, 1),
    ds('lastworkshop', 'mrwalker', 107, 155, 1, 2),
    ds('lastworkshop', 'mrsweeper', 92, 142, 3, 2), ds('lastworkshop', 'mrplough', 132, 142, 3, 2), ds('lastworkshop', 'mrwarden', 132, 114, 3, 2), ds('lastworkshop', 'mrwalker', 100, 132, 3, 2),
    ds('lastworkshop', 'boardplane', 114, 124, 1, 1),
    ds('lastworkshop', 'mrwarden', 93, 100, 1, 2),
    ds('lastworkshop', 'mrplough', 26, 86, 3, 2), ds('lastworkshop', 'mrsweeper', 80, 86, 3, 2), ds('lastworkshop', 'mrwalker', 26, 62, 3, 2), ds('lastworkshop', 'mrwarden', 70, 62, 3, 2),
    ds('lastworkshop', 'greatlathe', 52, 74, 1, 1),
    ds('lastworkshop', 'mrwalker', 91, 50, 1, 2),
    ds('lastworkshop', 'mrwarden', 26, 30, 3, 2), ds('lastworkshop', 'mrsweeper', 124, 30, 3, 2), ds('lastworkshop', 'mrplough', 30, 10, 3, 2), ds('lastworkshop', 'mrwalker', 120, 10, 3, 2),
    ds('lastworkshop', 'greatgovernor', 75, 11, 1, 1),
  );
  // kills in the raid count toward the Windwrights, like the Heights themselves
  FACTIONS.windwrights.zones.push('lastworkshop');
  // homestead plaques for the Normal and Heroic clears
  HOME_TROPHIES.push(['plaque_rest', 'Makers’ Rest plaque', { ach: 'rMakersRest' }], ['plaque_hrest', 'Gilded Makers’ Rest plaque (Heroic)', { ach: 'rhMakersRest' }]);
}
// ============================================================================ end of P12.5 THE MAKERS' REST

// ============================================================================ P12.5 CHAPTER 40 "WHOEVER COMES NEXT" (story text in story.js)
// The last chapter of Part Twelve: Windwright Adil, the oldest Windwright and the only one who reads the Makers' marks, meets
// you at the hollow's mouth; you chip the ice out of the twelfth engine's rod guides (o_restrod1-3, kind restrod), gather the
// Makers' brass labels on the hollow floor (questOnly nodes resttag0-7, item c40_tag), Kamal lifts the bar on the workshop
// door (m_c40_bar opens the raid), a company of ten stops the Great Governor, and outside the workshop its master lever
// (o_restbrake, kind restbrake, pad 11) frees the twelfth brake: twelve engines turn. Rewards item level 74-76, one per slot.
// After the ending Hamza and Jamil keep the workshop yard.
{
  const R = (name, slot, lvl, art, haste = false) => {
    const g = gear(name, slot, 4, lvl, haste);
    if (slot === 'weapon') { g.wtype = art; g.icon = `w_${art}~3`; }
    else if (slot === 'trinket') g.icon = 't_trinket~3';
    else if (slot === 'back') g.icon = 'a_back~3';
    else { g.weight = art; g.icon = `a_${art}_${slot}~3`; }
    return g;
  };
  Object.assign(ITEMS, {
    c40_tag: { name: 'Makers’ Brass Label', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A square brass plate punched with the Makers’ marks, wired to a crate. Adil can read what it says the crate is for, and when to use it.' },
    r_c40_gloves: R('Rod-Guide Gauntlets', 'hands', 74, 'plate'),
    r_c40_boots: R('Hollow-Mouth Boots', 'feet', 74, 'cloth'),
    r_c40_legs: R('Labeller’s Legguards', 'legs', 74, 'mail'),
    r_c40_hood: R('Bar-Lifter’s Helm', 'head', 75, 'plate'),
    r_c40_coat: R('Day-Book Coat', 'chest', 75, 'cloth'),
    r_c40_hammer: R('Twelfth-Rod Hammer', 'weapon', 76, 'hammer'),
    r_c40_charm: { ...R('Twelfth Engine Keepsake', 'trinket', 76, null, true), desc: 'A brass count wheel off the Great Governor’s drum, stopped at twelve.' },
    r_c40_mantle: R('Mantle of the Twelve Towers', 'shoulders', 76, 'mail'),
    r_c40_cloak: R('Keeper’s Cloud-Cloak', 'back', 76),
  });
  // the Makers' brass labels, on the crates and racks round the workshop on the hollow floor
  NODES.push(...[[612, -2106], [614, -2092], [620, -2110], [632, -2110], [636, -2096], [610, -2098], [638, -2100], [640, -2116]].map(([x, z], i) => ({ id: 'resttag' + i, item: 'c40_tag', x, z, questOnly: true })));
  // the twelfth engine's rod guides: square iron boxes along the rod's line east from pad 11 under the snow to the hollow
  OBJECT_KINDS.restrod = { prompt: 'Chip the ice out of the rod guide', goal: 'Rod guides cleared', done: 'cleared' };
  OBJECTS.push(
    { id: 'o_restrod1', kind: 'restrod', x: 592, z: -2036, ry: 0 },
    { id: 'o_restrod2', kind: 'restrod', x: 606, z: -2062, ry: 0 },
    { id: 'o_restrod3', kind: 'restrod', x: 622, z: -2082, ry: 0 },
  );
  // the Great Governor's master lever, at the workshop's south-west corner where the twelfth rod comes in: it turns pad 11
  // (the third ridge's south engine), not the pad nearest the lever (pad: 11, see padOf)
  OBJECT_KINDS.restbrake = { prompt: 'Pull the master lever', goal: 'Twelfth brake released', done: 'released', engine: true };
  OBJECTS.push({ id: 'o_restbrake', kind: 'restbrake', x: 626.2, z: -2093.2, ry: -Math.PI / 2, pad: 11 });
  ENGINE_STEPS.push(['q_c40_twelfth', 'restbrake']);
  NPCS.push(
    { id: 'n_wh_adil', name: 'Windwright Adil', title: 'The Windwrights', look: 'villager', v: 2, x: 600.5, z: -2093.8, ry: -1.9, quests: [],
      greet: 'I read the Makers’ marks for Kamal. Fifty springs I have stood at this mouth and read the labels on the crates from here.' },
    { id: 'n_wh_rest1', name: 'Hamza', title: 'Men of the Heights', look: 'villager', v: 5, x: 618, z: -2106, ry: 1.57, quests: [], seenFrom: 'm_c40_keepers',
      greet: 'Every crate in the yard has its label, and every label is on the list now. We work down it, one chore a day.' },
    { id: 'n_wh_rest2', name: 'Jamil', title: 'Men of the Heights', look: 'villager', v: 8, x: 619, z: -2094, ry: 1.57, quests: [], seenFrom: 'm_c40_keepers',
      greet: 'Hub grease, autumn. Rope for the lift, every ten winters. The Makers left the list, and we keep it.' },
  );
}
// a weekly for the Heights: the Pump Works under the rows and the Makers' Rest in the hollow
QUESTS.w_heights = { name: '[Weekly] Over and Under', giver: 'n_wh_kamal', turnin: 'n_wh_kamal', lvl: 55, pre: 'm_c40_bar', weekly: true, daily: true,
  text: 'Two places on the Heights fill up again every week: the Pump Works under the rows, where the Great Pump drifts out of time, and the Makers’ Rest in the hollow, where the Great Governor keeps trying to set the brakes. Stop both. The camp keeps the ropes ready at either door.',
  done: 'Over and under, both quiet for another week. The engines on the rows never missed a turn.',
  goal: { kills: ['greatpump', 'greatgovernor'], n: 2 }, xp: 90000, gold: 6000, rewards: [], bonusGear: { ilvl: 74, q: 4 } };
NPCS.find((n) => n.id === 'n_wh_kamal').quests.push('w_heights');
// the Main Story ran (applyStory) before Adil was placed: give him his story quests
for (const [id, Q] of Object.entries(QUESTS)) if (Q.msq) { const g = NPCS.find((n) => n.id === Q.giver); if (g && !(g.quests ||= []).includes(id)) g.quests.push(id); }
// ============================================================================ end of P12.5 CHAPTER 40

// ============================================================================ PART THIRTEEN: TIDEWATER SOUND (P13.2)
// the Makers' yards on a deep inlet south-west of the Rime Steps, with its own terrain box (shared/tidewater.js, registered
// in shared/areas.js) and a tide that rises and falls on the world clock. Reached by the ship (the SAIL route comes with
// P13.1); the Tidewrights live in a camp above the timber quay at the head of the Sound. These are the zone's people as
// placeholders for the story: no quests, no sail, no shop yet (the yard master keeps the reputation, P13.6).
NPCS.push(
  { id: 'n_tw_murad', name: 'Harbourman Murad', title: 'Tidewater Quay', look: 'villager', v: 4, x: TIDEWATER.harbour.x, z: TIDEWATER.harbour.z, ry: TIDEWATER.harbour.ry, quests: [],
    greet: 'Mind the edge of the quay. At low water it is a long step down to the deck, and at high water a short one. The tide keeps its own hours.' },
  { id: 'n_tw_talib', name: 'Yard Master Talib', title: 'The Tidewrights', look: 'villager', v: 6, x: TIDEWATER.qm.x, z: TIDEWATER.qm.z, ry: TIDEWATER.qm.ry, quests: [],
    greet: 'There are eleven of us left to keep a yard built for three hundred. We lay what rope we can by hand and patch what the sea breaks.' },
  { id: 'n_tw_wasim', name: 'Ropewalker Wasim', title: 'The Ropewalk', look: 'villager', v: 1, x: 500.5, z: -2628.5, ry: -1.9, quests: [],
    greet: 'Walk the length of the shed and back, twisting all the way: that is one rope. The Makers had machines for it. We have our hands.' },
  { id: 'n_tw_raed', name: 'Millhand Raed', title: 'The Tide Mills', look: 'villager', v: 3, x: 534.5, z: -2596.5, ry: -2.2, quests: [],
    greet: 'The pond fills on the flood and runs out through the wheel on the ebb. Twice a day it would cut timber, if anyone could keep the saws.' },
  { id: 'n_tw_nabil', name: 'Gatewatch Nabil', title: 'The Sea Gate', look: 'villager', v: 5, x: 630.5, z: -2595.5, ry: 2.6, quests: [],
    greet: 'That gate has hung half open since my grandfather was a boy. Every spring tide comes through it and over the yards.' },
  { id: 'n_cv_tidewater', name: 'Caravan Master Hakim', title: 'Caravans', look: 'villager', v: 2, x: TIDEWATER.caravan.x, z: TIDEWATER.caravan.z - 2, ry: 0.4, caravan: 'tidewater',
    greet: 'No road comes round the cape, only the ship. I keep the post for the camp, and I can set your compass here.' },
);
// the Sound's caravan stop has no routes (the only way off is the ship), but it can be the Homeward Compass's home
CARAVANS.push({ id: 'tidewater', name: 'Tidewrights’ Camp', x: TIDEWATER.caravan.x, z: TIDEWATER.caravan.z, zone: 'ropewalkshore' });
GRAVEYARDS.push({ x: TIDEWATER.grave.x, z: TIDEWATER.grave.z });
// what wanderers say out on the Sound (the valley's lines are about the valley)
WANDERER_LINES_AREA.tidewater = ['The tide is out. Cross the flats while you can.', 'The flood comes in faster than you think. Mind the flats.',
  'Need a group for the Great Dredge when it walks again.', 'Salt on everything here. My boots will never be the same.',
  'The old bronze tide wardens up in the rows hit hard.', 'Yard Master Talib has work for anyone with strong arms.'];
// ============================================================================ end of P13.2 TIDEWATER SOUND
// ============================================================================ PART THIRTEEN: Tidewater Sound's machines (P13.3)
// three regions west to east: the Ropewalk Shore 55-56, the Tide Mills 57-58, the Sea Gate 59-60 (models in
// client/assets/tidewaterMachines.js). Packs stand on walkable ground above the highest tide inside their own region, 35 m
// or more from the camp's centre, 25 m (past the pack's edge) from every NPC, the landing, the graveyard and the caravan
// stop, 25 m from the north gatehouse (the Sea Gate raid's door), 20 m from the Mill Races' pad, clear of the ropewalk's
// floor, the log ponds and the mills. The only pack on the mud flats is a few silt dredges at their west end. The Great
// Dredge walks the flats east of them while the tide is out and works the outer edge of the flats while it is in (the
// spawn's floodPath, shared/sim.js). Stats and spawns via IM() (the Rime Steps' helper) with their own loot table.
Object.assign(ITEMS, {
  saltiron: { name: 'Salt-Eaten Iron', slot: 'junk', icon: 'gear', q: 0, stack: 20, price: 42, desc: 'A plate off a yard machine, pitted by a lifetime of spring tides and caked with grey silt.' },
  t_hauliergrab: gear('Snagged Haulier’s Clamp-Plate Breastplate', 'chest', 4, 78),
  t_sashgreaves: gear('Mudbound Sash-Frame Greaves', 'legs', 4, 79),
  t_dredgeheart: { ...gear('The Great Dredge’s Tumbler Bearing', 'trinket', 4, 80, true), desc: 'The bearing off the Great Dredge’s upper tumbler. It still turns over, slow as the tide.' },
  t_dredgeplate: gear('Bucket-Ladder Pauldrons', 'shoulders', 4, 80),
  t_dredgeaxe: { ...gear('Bucket-Lip Axe', 'weapon', 4, 80), wtype: 'axe' },
});
{
  const TM = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => IM(name, model, variant, lvl, hp, dmg, xp, { loot: 'tideMach', ...extra });
  Object.assign(MOBS, {
    ropelayer: TM('Rope Layer', 'ropelayer', 0, [55, 56], 6600, [68, 90], 2500, { speed: 3.6, radius: 1.1 }),
    loghaulier: TM('Log Haulier', 'loghaulier', 0, [55, 56], 6900, [70, 92], 2550, { speed: 3.0, range: 3.6, swing: 2.6, radius: 1.6 }),
    sawcarriage: TM('Saw Carriage', 'sawcarriage', 0, [57, 58], 7500, [74, 98], 2750, { speed: 3.2, range: 3.4, radius: 1.5 }),
    siltdredge: TM('Silt Dredge', 'siltdredge', 0, [57, 58], 7700, [74, 100], 2800, { speed: 2.8, range: 3.8, swing: 2.7, radius: 1.7 }),
    bronzedredge: TM('Old Bronze Silt Dredge', 'siltdredge', 1, [57, 58], 7900, [76, 100], 2850, { speed: 2.8, range: 3.8, swing: 2.7, radius: 1.7 }),
    tidewarden: TM('Tide Warden', 'tidewarden', 0, [59, 60], 8400, [80, 106], 3050, { range: 3.4, radius: 1.3 }),
    oldtidewarden: TM('Old Bronze Tide Warden', 'tidewarden', 1, [59, 60], 23000, [106, 140], 3100, { range: 3.4, radius: 1.3, elite: true,
      abilities: [{ kind: 'nova', every: 14, r: 5, delay: 1.7, dmg: 1.3, text: 'The Old Bronze Tide Warden drives its gate key down into the ground!' }] }),
    snaggedhaulier: TM('The Snagged Haulier', 'loghaulier', 1, [58, 58], 38000, [98, 128], 7600, { elite: true, rare: true, loot: 'rareTide1', speed: 3.0, range: 3.8, swing: 2.6, radius: 1.8,
      abilities: [{ kind: 'circles', every: 10, n: 4, r: 2.8, delay: 1.8, dmg: 1.3, text: 'The Snagged Haulier swings its waterlogged log round on the chain!' }] }),
    mudboundsaw: TM('The Mudbound Saw', 'sawcarriage', 1, [60, 60], 41000, [106, 138], 8200, { elite: true, rare: true, loot: 'rareTide2', speed: 3.0, range: 3.6, radius: 1.6,
      abilities: [{ kind: 'nova', every: 12, r: 6, delay: 1.8, dmg: 1.5, text: 'The Mudbound Saw races its blades and flings silt and sawdust all round it!' }] }),
    greatdredge: { name: 'The Great Dredge', model: 'greatdredge', lvl: [60, 60], hp: 158000, dmg: [86, 116], speed: 1.8, aggro: 12, range: 8, swing: 3.0, xp: 30000, loot: 'greatdredge', radius: 5.5, elite: true, boss: true, world: true,
      notice: 'is striding out across the mud flats below the Tide Mills on Tidewater Sound, still dredging channels the silt filled long ago', yell: 'drops its bucket ladder into the mud!',
      abilities: [{ kind: 'circles', every: 9, n: 6, r: 3.6, delay: 2.0, dmg: 1.4, text: 'The Great Dredge swings its spoil chute round and dumps silt across the flats!' },
        { kind: 'nova', every: 17, r: 11, delay: 2.4, dmg: 1.7, text: 'The Great Dredge drops all four spuds at once, and the mud heaves for metres round it!' },
        { kind: 'adds', at: 0.5, mob: 'siltdredge', n: 3, text: 'Silt dredges crawl up out of the channel to clear the Great Dredge’s path!' },
        { kind: 'enrage', at: 0.2, text: 'The Great Dredge races its bucket chain and comes on through the creeks!' }] },
  });
}
Object.assign(LOOT_TABLES, {
  tideMach: { gold: [38, 58], items: [['saltiron', 0.45], ['bronzecog', 0.2], ['draught', 0.12]], gear: 0.4 },
  rareTide1: { gold: [300, 380], items: [['t_hauliergrab', 1]], gear: 1, gearQ: 3 },
  rareTide2: { gold: [300, 380], items: [['t_sashgreaves', 1]], gear: 1, gearQ: 3 },
  greatdredge: { gold: [520, 700], items: [['t_dredgeheart', 0.35], ['t_dredgeplate', 0.35], ['t_dredgeaxe', 0.3], ['tonic', 1], ['saltiron', 1]], gear: 1, gearQ: 4, gearN: 2 },
});
SPAWNS.push(
  // the Ropewalk Shore (55-56): the fields north of the ropewalk, the west shore past the tar yards, the beach west of the head
  { mob: 'loghaulier', x: 408, z: -2652, r: 6, n: 3 }, { mob: 'loghaulier', x: 452, z: -2668, r: 6, n: 3 }, { mob: 'loghaulier', x: 406, z: -2600, r: 5, n: 2 },
  { mob: 'ropelayer', x: 430, z: -2664, r: 5, n: 3 }, { mob: 'ropelayer', x: 474, z: -2652, r: 5, n: 3 }, { mob: 'ropelayer', x: 486, z: -2674, r: 5, n: 2 }, { mob: 'ropelayer', x: 410, z: -2560, r: 5, n: 3 },
  // the Tide Mills (57-58): the cut-over ground north of the road, and silt dredges on the west end of the flats
  { mob: 'sawcarriage', x: 514, z: -2662, r: 5, n: 3 }, { mob: 'sawcarriage', x: 540, z: -2674, r: 5, n: 3 }, { mob: 'sawcarriage', x: 562, z: -2658, r: 5, n: 3 },
  { mob: 'siltdredge', x: 511, z: -2564, r: 4, n: 3 }, { mob: 'siltdredge', x: 540, z: -2652, r: 4, n: 2 }, { mob: 'bronzedredge', x: 580, z: -2676, r: 4, n: 2 },
  // the Sea Gate (59-60): among the planted rows on the headland, well back from the gatehouse
  { mob: 'tidewarden', x: 604, z: -2645, r: 5, n: 3 }, { mob: 'tidewarden', x: 628, z: -2662, r: 5, n: 3 }, { mob: 'tidewarden', x: 652, z: -2645, r: 5, n: 3 }, { mob: 'tidewarden', x: 606, z: -2672, r: 4, n: 2 },
  { mob: 'oldtidewarden', x: 642, z: -2628, r: 4, n: 2 }, { mob: 'oldtidewarden', x: 650, z: -2672, r: 4, n: 2 },
  { mob: 'snaggedhaulier', x: 580, z: -2650, r: 4, n: 1 }, { mob: 'mudboundsaw', x: 608, z: -2622, r: 4, n: 1 },
  // the Great Dredge: across the flats at ebb, along their outer edge at flood
  { mob: 'greatdredge', path: [[540, -2562], [556, -2556], [572, -2562], [586, -2558]],
    floodPath: [[540, -2552], [560, -2550], [584, -2552]], r: 2, n: 1, world: true },
);
// ============================================================================ end of P13.3 TIDEWATER MACHINES

// ============================================================================ P13.1 CHAPTER 41 "EVERY TEN WINTERS" (story text in story.js)
// The crossing: once Adil's chart has gone to Saleem (m_c41_chart), Harbour Master Nasir on the Icefall Landing pier also
// sails round the cold cape to Tidewater Sound (SAIL.to.tidewater); Harbourman Murad on the Sound's quay sails back to the
// Rime Steps or straight home to Harrowmouth. A crossing sets you down at the quay's root, a few metres from Murad. In the
// Sound you dig out the quay's three scour sluices (o_twscour1-3, kind twscour), bring back the tar barrels the spring tides
// left on the beaches west of the quay (questOnly nodes twtar0-7, item c41_tar) and the yarn hanks the flood dropped in the
// salt grass between the ropewalk and the camp (questOnly nodes twyarn0-7, item c41_yarn). Rewards item level 78-79, one per
// slot. The Tidewrights' reputation and shop come with P13.6.
SAIL.to.tidewater = { x: TIDEWATER.landing.x, z: TIDEWATER.landing.z, name: 'Tidewater Sound', need: 'm_c41_chart', notReady: 'The ship has no chart for the Sound yet.',
  say: 'The ship steams south-west round the cold cape, in through the one open bay of the Makers’ Sea Gate, and up Tidewater Sound to the timber quay at its head.' };
SAIL.to.rime.sayFrom = { ...(SAIL.to.rime.sayFrom || {}), tidewater: 'The ship runs out of the Sound on the ebb, round the cold cape and north-east along the ice to the Icefall Landing.' };
SAIL.to.valley.sayFrom = { ...(SAIL.to.valley.sayFrom || {}), tidewater: 'The ship runs out of the Sound on the ebb, round the cold cape, south past the Rime Steps and the Cinder Reach, and on over the open sea to Harrowmouth.' };
{ const N = NPCS.find((n) => n.id === 'n_rs_nasir'); N.sails ||= [N.sail]; if (!N.sails.includes('tidewater')) N.sails.push('tidewater'); }
{ const M = NPCS.find((n) => n.id === 'n_tw_murad'); M.sail = 'rime'; M.sails = ['rime', 'valley']; }
{
  const R = (name, slot, lvl, art, haste = false) => {
    const g = gear(name, slot, 4, lvl, haste);
    if (slot === 'weapon') { g.wtype = art; g.icon = `w_${art}~3`; }
    else if (slot === 'trinket') g.icon = 't_trinket~3';
    else if (slot === 'back') g.icon = 'a_back~3';
    else { g.weight = art; g.icon = `a_${art}_${slot}~3`; }
    return g;
  };
  Object.assign(ITEMS, {
    c41_tar: { name: 'Barrel of Pine Tar', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A heavy barrel of the Makers’ pine tar, its bung still tight, left on the shingle by a spring tide. Talib wants it back on his rows.' },
    c41_yarn: { name: 'Hank of Rope Yarn', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A straight hank of bast yarn, tied at both ends and stiff with salt from the flood. Wasim wants it back on his drying rack.' },
    r_c41_gloves: R('Scour-Sluice Gauntlets', 'hands', 78, 'plate'),
    r_c41_boots: R('Silted-Berth Boots', 'feet', 78, 'mail'),
    r_c41_legs: R('Tar-Yard Breeches', 'legs', 78, 'cloth'),
    r_c41_hood: R('Barrel-Finder’s Coif', 'head', 78, 'mail'),
    r_c41_coat: R('Quay-Plank Cuirass', 'chest', 79, 'plate'),
    r_c41_axe: R('Pole-Stripper’s Axe', 'weapon', 79, 'axe'),
    r_c41_charm: { ...R('Tied Hank Keepsake', 'trinket', 79, null, true), desc: 'A short tarred hank of the Makers’ own yarn, tied at both ends, off the last of Wasim’s drying racks.' },
    r_c41_mantle: R('Mantle of the Cold Cape', 'shoulders', 79, 'cloth'),
    r_c41_cloak: R('Tidewright’s Tarred Cloak', 'back', 79),
  });
  // the tar barrels, washed up on the shingle and the low bank west of the quay (out of the water at every tide, 10 m+ past
  // the edge of the rope layers' pack on the west beach)
  NODES.push(...[[402, -2544], [412, -2544], [420, -2546], [428, -2544], [426, -2552], [430, -2560], [434, -2566], [444, -2572]].map(([x, z], i) => ({ id: 'twtar' + i, item: 'c41_tar', x, z, questOnly: true })));
  // the yarn hanks, in the salt grass between the ropewalk and the camp (clear of the graveyard and the caravan stop)
  NODES.push(...[[412, -2614], [420, -2608], [428, -2616], [436, -2611], [484, -2614], [495, -2615], [442, -2617], [477, -2616]].map(([x, z], i) => ({ id: 'twyarn' + i, item: 'c41_yarn', x, z, questOnly: true })));
  // the quay's scour sluices: square timber hatches in the bank either side of the quay's root and on the head of the Sound,
  // each facing the water (ry 0: its face to +z, the Sound)
  OBJECT_KINDS.twscour = { prompt: 'Dig out and lift the sluice hatch', goal: 'Scour sluices opened', done: 'opened' };
  OBJECTS.push(
    { id: 'o_twscour1', kind: 'twscour', x: 450, z: -2577, ry: 0 },
    { id: 'o_twscour2', kind: 'twscour', x: 486, z: -2579, ry: 0 },
    { id: 'o_twscour3', kind: 'twscour', x: 440, z: -2563, ry: 0 },
  );
}
// the Main Story ran (applyStory) before the Sound's men were placed: give them their story quests
for (const [id, Q] of Object.entries(QUESTS)) if (Q.msq) { const g = NPCS.find((n) => n.id === Q.giver); if (g && !(g.quests ||= []).includes(id)) g.quests.push(id); }
// ============================================================================ end of P13.1 CHAPTER 41

// ============================================================================ P13.4 THE MILL RACES (dungeon, level 60)
// (Chapters 42-43's story goes in story.js; their quest objects, nodes and Sawyer Hisham in the block after this one)
// The wheel pits and race tunnels the Makers cut under the tide mills on Tidewater Sound. The race gates under the mills are
// jammed half open like the Sea Gate itself, so the sea surges up the races on a short tide of its own (shared/dungeons.js
// millraces tide, pits): the square pits fill on the flood and drain on the ebb. Three bosses, all machines: the Log Carriage
// (the carriage that ran logs down the Log Way to the saws), the Frame Saw (the great frame of parallel saw blades in the Saw
// Pit) and the Great Undershot (the solid wheel in the Wheel Race that drove every saw in the yard, the last boss). Each has
// the same dance: on the flood the pits of its chamber flood under you (kind 'pits', tide 'flood': stand out of the water),
// on the ebb it strikes at the dry floor (stand in the drained pits or step away), and a call as the tide turns (kind
// 'tide'). Their strikes are water and silt (water/teleColor). Heroic is the raid kind (dmode raidheroic, after a Normal
// clear); there the named drops come at item level 86 (rhIlvl). Trash uses the Sound's machine models.
{
  const ML = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.4, aggro: 13, range: 3.0, swing: 2.3, xp, loot: 'millTrash', radius: 1.2, ...extra });
  const WET = { water: true, teleColor: '#2f9cff', novaColor: '#d8e8ee' };
  const TIDE = (flood, ebb) => ({ kind: 'tide', flood, ebb });
  Object.assign(MOBS, {
    mlcarriage: ML('Race Saw Carriage', 'sawcarriage', 0, [59, 60], 9200, [84, 110], 3100, { speed: 3.2, range: 3.4, radius: 1.5 }),
    mldredge: ML('Race Silt Dredge', 'siltdredge', 0, [59, 60], 9600, [84, 112], 3150, { speed: 2.8, range: 3.8, swing: 2.7, radius: 1.7 }),
    mlhaulier: ML('Race Log Haulier', 'loghaulier', 0, [59, 60], 9400, [84, 110], 3100, { speed: 3.0, range: 3.6, swing: 2.6, radius: 1.6 }),
    mlwarden: ML('Race Tide Warden', 'tidewarden', 0, [59, 60], 9800, [86, 114], 3200, { range: 3.4, radius: 1.3 }),
    logcarriage: ML('The Log Carriage', 'logcarriage', 0, [60, 60], 46000, [88, 114], 10400, { ...WET, loot: 'u_logcarriage', rhIlvl: 86, speed: 2.8, range: 4.4, swing: 2.6, radius: 2.6, elite: true,
      abilities: [TIDE('The sea surges up the Log Way through the jammed race gate, and the log sumps fill!', 'The surge runs back down the race, and the log sumps drain.'),
        { kind: 'pits', tide: 'flood', every: 7, delay: 2.0, dmg: 1.5, text: 'Salt water boils up out of the flooded log sumps!' },
        { kind: 'beam', tide: 'ebb', every: 11, len: 18, r: 1.9, delay: 1.9, dmg: 1.5, text: 'The Log Carriage runs a log down the dry race!' },
        { kind: 'adds', at: 0.5, mob: 'mlcarriage', n: 2, text: 'Two saw carriages clatter down the Log Way to feed the Log Carriage!' }] }),
    framesaw: ML('The Frame Saw', 'framesaw', 0, [60, 60], 48000, [90, 116], 10600, { ...WET, loot: 'u_framesaw', rhIlvl: 86, speed: 2.4, range: 4.6, swing: 2.6, radius: 2.8, elite: true,
      abilities: [TIDE('The flood comes up under the saw floors, and the crank pits fill!', 'The water drains out of the crank pits, and the saw runs on the dry floor.'),
        { kind: 'pits', tide: 'flood', every: 6, delay: 2.0, dmg: 1.5, text: 'The flood surges up the crank pits!' },
        { kind: 'circles', tide: 'ebb', every: 9, n: 4, r: 2.8, delay: 1.7, dmg: 1.4, text: 'The Frame Saw races its blades, and splinters and wet sawdust fly across the pit!' },
        { kind: 'adds', at: 0.5, mob: 'mldredge', n: 2, text: 'Silt dredges crawl up out of the tail race to clear the Frame Saw’s pit!' }] }),
    // the last boss: the same tide, a churning sweep round its wheel on the ebb, and below half health the race overflows
    greatundershot: ML('The Great Undershot', 'greatundershot', 0, [61, 61], 395000, [96, 126], 31000, { ...WET, loot: 'u_greatundershot', rhIlvl: 86, speed: 0, aggro: 18, range: 7.0, swing: 3.0, radius: 4.8, elite: true, boss: true,
      abilities: [TIDE('The flood tide drives up the Wheel Race, the Great Undershot takes the water, and the tail pits fill!', 'The ebb turns the Great Undershot back, and the tail pits drain.'),
        { kind: 'pits', tide: 'flood', every: 6, delay: 2.0, dmg: 1.6, text: 'The tail pits flood to the kerb!' },
        { kind: 'nova', tide: 'ebb', every: 12, r: 9, delay: 2.4, dmg: 1.7, text: 'The Great Undershot churns in its race, and silt and spray sweep out all round it!' },
        { kind: 'circles', below: 0.5, every: 8, n: 6, r: 3.4, delay: 2.0, dmg: 1.45, text: 'The Wheel Race overflows! Salt water sheets across the floor, flood or ebb!' }] }),
  });
  // named drops: item level 84 (all three), raised to 86 on Heroic
  const ST = {
    weapon: { power: 118, hp: 40, crit: 7 }, trinket: { power: 100, hp: 44, haste: 30 },
    plate: { armor: 420, hp: 112, power: 24 }, mail: { armor: 380, hp: 110, crit: 8 }, cloth: { armor: 380, hp: 96, power: 30 },
  };
  const W = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'];
  const N = (name, slot, kind, ilvl, desc) => {
    const w = W.includes(kind) ? kind : null, wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    const base = ST[w ? 'weapon' : wt || 'trinket'], k = (ilvl / 50) * 1.45, stats = {}; // above the Sound's quest rewards, so the Races are worth farming
    for (const [s, v] of Object.entries(base)) stats[s] = Math.round(v * k);
    const icon = w ? `w_${w}~3` : wt ? `a_${wt}_${slot}~3` : 't_trinket~3';
    return { name, slot, q: 4, ilvl, req: 58, stats, desc, unique: true, icon, ...(w ? { wtype: w } : {}), ...(w === 'pistol' ? { classes: ['deadeye'] } : {}), ...(wt ? { weight: wt } : {}) };
  };
  const drops = {
    logcarriage: [['Log-Clamp Hammer', 'weapon', 'hammer', 84, 'The iron clamp that gripped the logs on the Log Carriage, forged onto a tarred shaft.'], ['Race-Plank Greaves', 'legs', 'plate', 84, 'Faced with the iron that shod the Log Way’s boards, pitted by the salt.']],
    framesaw: [['Frame-Blade Sword', 'weapon', 'sword', 84, 'One blade out of the Frame Saw’s frame, cut down and ground to a single edge.'], ['Sawpit Hood', 'head', 'cloth', 84, 'Felt off the saw floor, stiff with salt and sawdust.'], ['Crank-Pin Pistol', 'weapon', 'pistol', 84, 'Its barrel was the Frame Saw’s hollow crank pin. It still smells of tar.']],
    greatundershot: [['Undershot Hauberk', 'chest', 'mail', 84, 'Links of the Great Undershot’s brake chain, each one worn bright on one side.'], ['The Tide Counter', 'trinket', 'trinket', 84, 'A brass counter off the Great Undershot’s shaft. It counted every tide the wheel turned on.'], ['Wheel-Shaft Staff', 'weapon', 'staff', 84, 'A length of the Great Undershot’s iron shaft, marked in the Makers’ feet.']],
  };
  for (const [mob, list] of Object.entries(drops)) list.forEach(([name, slot, kind, ilvl, desc], i) => { ITEMS[`u_${mob}${i + 1}`] = N(name, slot, kind, ilvl, desc); });
  const T = (mob, gold, extra, gearQ, gearN) => ({ gold, items: [...drops[mob].map((_, i) => [`u_${mob}${i + 1}`, mob === 'greatundershot' ? 0.3 : 0.25]), ...extra], gear: 1, gearQ, gearN });
  const boss = [['tonic', 1], ['saltiron', 1]], last = [['draught', 1], ['saltiron', 1]];
  Object.assign(LOOT_TABLES, {
    millTrash: { gold: [40, 60], items: [['saltiron', 0.45], ['bronzecog', 0.25], ['draught', 0.12]], gear: 0.4 },
    u_logcarriage: T('logcarriage', [220, 280], boss, 3, 2), u_framesaw: T('framesaw', [220, 280], boss, 3, 2), u_greatundershot: T('greatundershot', [600, 780], last, 4, 3),
  });
  // trash packs chamber by chamber, south to north (local metres in the dungeon grid), each boss in its own chamber, every
  // pack clear of the pits
  SPAWNS.push(
    ds('millraces', 'mlwarden', 70, 108, 2, 2),
    ds('millraces', 'mlhaulier', 34, 104, 3, 2), ds('millraces', 'mlcarriage', 106, 104, 3, 2), ds('millraces', 'mldredge', 32, 86, 3, 2), ds('millraces', 'mlhaulier', 108, 86, 3, 2),
    ds('millraces', 'logcarriage', 70, 101, 1, 1), // north of the log race, not lying across it (a '+' from above)
    ds('millraces', 'mlwarden', 37, 74, 2, 2),
    ds('millraces', 'mlcarriage', 18, 62, 3, 2), ds('millraces', 'mldredge', 70, 64, 3, 2), ds('millraces', 'mlhaulier', 16, 37, 2, 2),
    ds('millraces', 'framesaw', 46, 44, 1, 1),
    ds('millraces', 'mlwarden', 85, 44, 2, 2),
    ds('millraces', 'mldredge', 94, 48, 2, 2), ds('millraces', 'mlcarriage', 128, 48, 2, 2), ds('millraces', 'mlhaulier', 93, 16, 3, 2), ds('millraces', 'mlwarden', 128, 16, 3, 2),
    ds('millraces', 'greatundershot', 110, 16, 1, 1),
  );
}
// ============================================================================ end of P13.4 THE MILL RACES

// ============================================================================ P13.4 CHAPTERS 42-43 (story text in story.js)
// "Salt in the Rows" and "The Mill Races" (levels 57-58, the Tide Mills). The Makers kept the salt out of the creeks that
// water the planted rows with tide flaps below the mills: hinged timber flaps that let the fresh water out on the ebb and
// shut against the flood. You free the three jammed flaps (o_twflap1-3), break the saw carriages dragging logs over the
// creek heads, bring back the flaps' bronze hinge pins off the silt dredges (c42_pin) and break the dredges dumping silt in
// the tail races; the flaps hang true, but on every flood the sea still comes up the races under the mills, because the
// race gates are held open from below. Sawyer Hisham (a new Tidewright, a man) keeps the wheel-pit hatch on the races pad;
// you gather stop-boards off the pond banks (questOnly nodes twboard0-7, item c43_board), drop them into the race heads at
// both log ponds (o_twrace1-2), and a company of five goes down and stops the Great Undershot. Rewards item level 80-82.
{
  const R = (name, slot, lvl, art, haste = false) => {
    const g = gear(name, slot, 4, lvl, haste);
    if (slot === 'weapon') { g.wtype = art; g.icon = `w_${art}~3`; }
    else if (slot === 'trinket') g.icon = 't_trinket~3';
    else if (slot === 'back') g.icon = 'a_back~3';
    else { g.weight = art; g.icon = `a_${art}_${slot}~3`; }
    return g;
  };
  Object.assign(ITEMS, {
    c42_pin: { name: 'Bronze Hinge Pin', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A long bronze pin off a tide flap’s hinge, scooped up with the silt by a dredge. Raed wants it back in its flap.' },
    c43_board: { name: 'Stop-Board', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A heavy tarred plank cut to drop into the slots of a race head. Hisham wants a stack of them at each pond.' },
    r_c42_gloves: R('Flap-Hinge Gauntlets', 'hands', 80, 'plate'),
    r_c42_boots: R('Creek-Bank Boots', 'feet', 80, 'mail'),
    r_c42_legs: R('Saw-Yard Breeches', 'legs', 80, 'cloth'),
    r_c42_helm: R('Millhand’s Helm', 'head', 81, 'plate'),
    r_c42_mace: R('Hinge-Pin Mace', 'weapon', 81, 'mace'),
    r_c42_charm: { ...R('Fresh Water Keepsake', 'trinket', 81, null, true), desc: 'A stoppered glass of creek water taken above the flaps, sweet again for the first time in a lifetime.' },
    r_c43_hands: R('Stop-Board Gloves', 'hands', 81, 'cloth'),
    r_c43_coat: R('Race-Tunnel Hauberk', 'chest', 81, 'mail'),
    r_c43_mantle: R('Wheel-Pit Pauldrons', 'shoulders', 82, 'plate'),
    r_c43_staff: R('Sawyer’s Staff', 'weapon', 82, 'staff'),
    r_c43_charm: { ...R('Tide Flap Keepsake', 'trinket', 82, null, true), desc: 'A short length of a flap’s leather seal, worn smooth by a lifetime of tides.' },
    r_c43_cloak: R('Cloak of the Tide Mills', 'back', 82),
  });
  // the hinge pins come off the Sound's machines (only for those on the quest)
  LOOT_TABLES.tideMach.items.push(['c42_pin', 0.5]);
  // the tide flaps: timber flaps on the creek banks below the mills (creek one below and at the first mill's tail, creek two
  // at the second mill's tail); the race heads: the timber heads of the races at the north end of each log pond
  OBJECT_KINDS.twflap = { prompt: 'Free the tide flap and hang it true', goal: 'Tide flaps freed', done: 'freed' };
  OBJECT_KINDS.twrace = { prompt: 'Drop the stop-boards into the race head', goal: 'Race heads boarded', done: 'boarded' };
  OBJECTS.push(
    { id: 'o_twflap1', kind: 'twflap', x: 518, z: -2576, ry: Math.PI / 2 },
    { id: 'o_twflap2', kind: 'twflap', x: 515, z: -2596, ry: Math.PI / 2 },
    { id: 'o_twflap3', kind: 'twflap', x: 561, z: -2600, ry: Math.PI / 2 },
    { id: 'o_twrace1', kind: 'twrace', x: 530, z: -2634, ry: 0 },
    { id: 'o_twrace2', kind: 'twrace', x: 580, z: -2630, ry: 0 },
  );
  // the stop-boards, stacked on the pond banks (out of the water at every tide)
  NODES.push(...[[548, -2624], [538, -2630], [586, -2620], [512, -2632], [520, -2640], [590, -2632], [524, -2638], [544, -2638]].map(([x, z], i) => ({ id: 'twboard' + i, item: 'c43_board', x, z, questOnly: true })));
  NPCS.push(
    { id: 'n_tw_hisham', name: 'Sawyer Hisham', title: 'The Tide Mills', look: 'villager', v: 7, x: 546, z: -2617.5, ry: 2.6, quests: [],
      greet: 'My father kept the saws and his father the hatch. I keep both, and the saws have not run in my lifetime.' },
  );
}
// the Main Story ran (applyStory) before Hisham was placed: give him his story quests
for (const [id, Q] of Object.entries(QUESTS)) if (Q.msq) { const g = NPCS.find((n) => n.id === Q.giver); if (g && !(g.quests ||= []).includes(id)) g.quests.push(id); }
// ============================================================================ end of P13.4 CHAPTERS 42-43

// ============================================================================ P13.5 THE SEA GATE (raid, level 60)
// (Chapter 44's story goes in story.js; its quest item, the young poles and the weekly in the block after this one)
// The gatehouses and winding galleries inside the Makers' barrage across the mouth of Tidewater Sound (dungeon id 'barrage':
// 'seagate' is the Tidewater zone round the gate). The barrage's own machines still work the gate that has hung jammed half
// open for a lifetime, and the sea comes into the galleries through the jammed bay on a short tide of its own
// (shared/dungeons.js barrage tide, pits): the square sluice wells fill on the flood and drain on the ebb. Four bosses, all
// machines (models in client/assets/seaGate.js): the Gate Winch (the chain winch that lifts a gate leaf), the Silt Ram (the
// culvert scraper that drove the silt out under the gate), the Sluice Carriage (a gate leaf in a frame on rails, that set
// the sluices) and THE TIDE ENGINE, the engine that has fought the tide with the gate half open for a lifetime, against the
// north wall of the Engine Hall; it never moves, and each phase it fights harder, until it runs the gate both ways at once
// and the wells flood on the ebb too. Every boss calls the turn of the tide (kind 'tide'), floods its wells on the flood
// (kind 'pits': stand out of the water) and strikes the dry floor on the ebb. Strikes are water and silt (water/teleColor).
// Ten players, Normal and Heroic (the raid kind, after a Normal clear); weekly lockouts per boss; named drops at item level
// 84-86, raised to 88 on Heroic (rhIlvl); Makers' marks from every boss. The door (shared/dungeons.js) is the north
// gatehouse's door, opened once Nabil has drawn the bar at low water (m_c44_low).
{
  const SG = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.4, aggro: 13, range: 3.2, swing: 2.3, xp, loot: 'seaRaid', radius: 1.2, elite: true, ...extra });
  const WET = { water: true, teleColor: '#2f9cff', novaColor: '#d8e8ee' };
  const TIDE = (flood, ebb) => ({ kind: 'tide', flood, ebb });
  Object.assign(MOBS, {
    // trash: the Sound's own machines, still working the barrage
    sgwarden: SG('Barrage Tide Warden', 'tidewarden', 1, [60, 60], 10400, [88, 114], 3300, { range: 3.4, radius: 1.3 }),
    sghaulier: SG('Barrage Log Haulier', 'loghaulier', 1, [60, 60], 10000, [86, 112], 3250, { speed: 3.0, range: 3.6, swing: 2.6, radius: 1.6 }),
    sgdredge: SG('Barrage Silt Dredge', 'siltdredge', 1, [60, 60], 10200, [86, 114], 3250, { speed: 2.8, range: 3.8, swing: 2.7, radius: 1.7 }),
    sgcarriage: SG('Barrage Saw Carriage', 'sawcarriage', 1, [60, 60], 9800, [86, 112], 3200, { speed: 3.2, range: 3.4, radius: 1.5 }),
    // 1. the Gate Winch: a tracked winch house with a solid chain drum and a square counterweight on a straight chain
    gatewinch: SG('The Gate Winch', 'gatewinch', 0, [60, 60], 540000, [92, 120], 52000, { ...WET, loot: 'u_gatewinch', rhIlvl: 88, speed: 2.4, aggro: 18, range: 5.2, swing: 2.6, radius: 3.4, boss: true, raid: true,
      abilities: [TIDE('The flood comes in through the jammed bay, and the chain wells fill!', 'The ebb drains the chain wells, and the Gate Winch takes up its slack.'),
        { kind: 'pits', tide: 'flood', every: 7, delay: 2.0, dmg: 1.5, text: 'The Gate Winch pays out its chain, and the sea boils up the chain wells!' },
        { kind: 'beam', tide: 'ebb', every: 11, len: 24, r: 2.1, delay: 1.8, dmg: 1.55, text: 'The Gate Winch snatches its chain tight, and it whips along the dry floor!' },
        { kind: 'circles', every: 12, n: 5, r: 3.0, delay: 1.9, dmg: 1.45, text: 'The Gate Winch drops its counterweight, and links of old chain come down all round!' },
        { kind: 'adds', at: 0.5, mob: 'sgwarden', n: 3, text: 'Tide wardens climb up out of the chain wells to wind the Gate Winch!' },
        { kind: 'enrage', at: 0.15, text: 'The Gate Winch’s pawl slips, and the drum runs free!' }] }),
    // 2. the Silt Ram: a long tracked culvert scraper with a flat square ram head and a square silt hopper
    siltram: SG('The Silt Ram', 'siltram', 0, [60, 60], 570000, [94, 122], 54000, { ...WET, loot: 'u_siltram', rhIlvl: 88, speed: 2.6, aggro: 18, range: 5.6, swing: 2.8, radius: 3.6, boss: true, raid: true,
      abilities: [TIDE('The flood fills the silt sumps, and the Silt Ram backs into its culvert!', 'The ebb drains the sumps, and the Silt Ram comes out to clear the silt.'),
        { kind: 'pits', tide: 'flood', every: 6, delay: 2.0, dmg: 1.5, text: 'Silt and salt water surge up out of the flooded sumps!' },
        { kind: 'beam', tide: 'ebb', every: 10, len: 26, r: 2.2, delay: 1.8, dmg: 1.6, text: 'The Silt Ram drives its ram head the length of the culvert!' },
        { kind: 'nova', tide: 'ebb', every: 13, r: 7.5, delay: 2.0, dmg: 1.6, text: 'The Silt Ram dumps its hopper, and wet silt slides out all round it!' },
        { kind: 'adds', at: 0.5, mob: 'sgdredge', n: 3, text: 'Silt dredges crawl out of the culverts to fill the Silt Ram’s hopper!' },
        { kind: 'enrage', at: 0.15, text: 'The Silt Ram rams on and on into the silt!' }] }),
    // 3. the Sluice Carriage: a timber gate leaf hung in a square frame on a tracked carriage, that ran along the sluices
    sluicecarriage: SG('The Sluice Carriage', 'sluicecarriage', 0, [60, 60], 600000, [96, 124], 56000, { ...WET, loot: 'u_sluicecarriage', rhIlvl: 88, speed: 2.2, aggro: 18, range: 5.2, swing: 2.6, radius: 3.4, boss: true, raid: true,
      abilities: [TIDE('The flood comes up the Sluice Gallery, and the Sluice Carriage drops its leaf to hold it!', 'The ebb runs out under the leaf, and the sluice wells drain.'),
        { kind: 'pits', tide: 'flood', every: 6, delay: 2.0, dmg: 1.55, text: 'The Sluice Carriage drops its leaf, and the sea spouts up every sluice well!' },
        { kind: 'circles', tide: 'ebb', every: 9, n: 6, r: 3.2, delay: 1.9, dmg: 1.5, text: 'The Sluice Carriage lifts its leaf, and the water held behind it sheets across the floor!' },
        { kind: 'phase', below: 0.4, text: 'The Sluice Carriage’s leaf jams crooked in its frame!' },
        { kind: 'nova', every: 10, r: 8, delay: 2.0, dmg: 1.6, below: 0.4, text: 'Water bursts out round the Sluice Carriage’s jammed leaf!' },
        { kind: 'enrage', at: 0.12, text: 'The Sluice Carriage races up and down its rails!' }] }),
    // 4. THE TIDE ENGINE: the engine that has held the Sea Gate half open for a lifetime, at the north wall of the Engine Hall;
    // it never moves. Three phases: as it fights the tide harder, its strikes come wider, more often and in more places, and
    // in the last it runs the gate both ways at once, so the wells flood on the ebb too
    tideengine: SG('The Tide Engine', 'tideengine', 0, [61, 61], 790000, [100, 132], 80000, { ...WET, loot: 'u_tideengine', rhIlvl: 88, speed: 0, aggro: 22, range: 10.0, swing: 3.0, radius: 6.5, boss: true, raid: true,
      abilities: [TIDE('The flood drives in under the Sea Gate, and the Tide Engine heaves the gate against it! The tide wells fill.', 'The ebb runs out under the gate, and the Tide Engine lets it down. The tide wells drain.'),
        { kind: 'pits', tide: 'flood', every: 7, delay: 2.0, dmg: 1.5, above: 0.66, text: 'The tide wells flood to the kerb!' },
        { kind: 'circles', tide: 'ebb', every: 11, n: 5, r: 3.0, delay: 1.9, dmg: 1.5, above: 0.66, text: 'The Tide Engine’s rack drops a tooth, and the floor jumps!' },
        { kind: 'beam', tide: 'ebb', every: 12, len: 26, r: 2.3, delay: 1.8, dmg: 1.6, above: 0.66, text: 'A sheet of sea water drives out from under the Tide Engine along the dry floor!' },
        { kind: 'phase', below: 0.66, text: 'The Tide Engine counts the tides it has held, and fights the next one harder.' },
        { kind: 'adds', at: 0.66, mob: 'sgwarden', n: 3, text: 'Tide wardens climb up out of the tide wells to keep the gate open!' },
        { kind: 'pits', tide: 'flood', every: 6, delay: 1.9, dmg: 1.6, below: 0.66, above: 0.33, text: 'The tide wells boil over!' },
        { kind: 'circles', tide: 'ebb', every: 9, n: 7, r: 3.4, delay: 1.8, dmg: 1.55, below: 0.66, above: 0.33, text: 'Teeth jump out of the Tide Engine’s rack all along the floor!' },
        { kind: 'beam', tide: 'ebb', every: 11, len: 26, r: 2.3, delay: 1.7, dmg: 1.6, n: 2, below: 0.66, above: 0.33, text: 'Two sheets of sea water drive out across the hall!' },
        { kind: 'phase', below: 0.33, text: 'The Tide Engine runs the gate both ways at once! Flood or ebb, the wells fill.' },
        { kind: 'pits', every: 7, delay: 1.9, dmg: 1.65, below: 0.33, text: 'The tide wells flood on the ebb!' },
        { kind: 'circles', every: 7, n: 8, r: 3.8, delay: 1.8, dmg: 1.6, below: 0.33, text: 'The whole rack jerks at once!' },
        { kind: 'beam', every: 10, len: 28, r: 2.4, delay: 1.7, dmg: 1.65, n: 3, below: 0.33, text: 'Three sheets of sea water drive out of the Tide Engine, one after another!' },
        { kind: 'nova', every: 13, r: 9, delay: 2.2, dmg: 1.7, below: 0.33, text: 'Steam and spray blast out of every valve on the Tide Engine!' },
        { kind: 'adds', at: 0.33, mob: 'sghaulier', n: 4, text: 'Log hauliers drag timber into the gate guides to jam them!' },
        { kind: 'enrage', at: 0.1, text: 'The Tide Engine throws the whole gate against the sea!' }] }),
  });
  // named drops: item level 84 (the Gate Winch), 85 (the Silt Ram and the Sluice Carriage), 86 (the Tide Engine), 88 on
  // Heroic. The same stat budget as the Makers' Rest's named drops (x1.45 over the item-level line).
  const ST = {
    weapon: { power: 118, hp: 40, crit: 7 }, trinket: { power: 100, hp: 44, haste: 30 },
    plate: { armor: 420, hp: 112, power: 24 }, mail: { armor: 380, hp: 110, crit: 8 }, cloth: { armor: 380, hp: 96, power: 30 },
  };
  const W = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'];
  const N = (name, slot, kind, ilvl, desc) => {
    const w = W.includes(kind) ? kind : null, wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    const base = ST[w ? 'weapon' : wt || 'trinket'], k = (ilvl / 50) * 1.45, stats = {};
    for (const [s, v] of Object.entries(base)) stats[s] = Math.round(v * k);
    const icon = w ? `w_${w}~3` : wt ? `a_${wt}_${slot}~3` : 't_trinket~3';
    return { name, slot, q: 4, ilvl, req: 60, stats, desc, unique: true, icon, ...(w ? { wtype: w } : {}), ...(w === 'pistol' ? { classes: ['deadeye'] } : {}), ...(wt ? { weight: wt } : {}) };
  };
  const drops = {
    gatewinch: [
      ['Chain-Drum Axe', 'weapon', 'axe', 84, 'Its head was a plate off the Gate Winch’s drum, its haft a length of the winch house’s oak.'],
      ['Counterweight Greaves', 'legs', 'plate', 84, 'Faced with iron off the Gate Winch’s counterweight, still grey with the barrage’s silt.'],
      ['Chain-Well Grips', 'hands', 'mail', 84, 'Old gate chain worked into gloves. Salt has never once made them slip.']],
    siltram: [
      ['Ram-Head Hammer', 'weapon', 'hammer', 85, 'A square of the Silt Ram’s ram head, forged onto a tarred shaft.'],
      ['Culvert Hood', 'head', 'cloth', 85, 'Felt off the culvert floor, stiff with salt and silt.'],
      ['Hopper-Plate Pauldrons', 'shoulders', 'plate', 85, 'Plate off the Silt Ram’s hopper, worn smooth by a lifetime of silt.'],
      ['Ram-Bore Pistol', 'weapon', 'pistol', 85, 'Its barrel was bored from the Silt Ram’s guide rod. It throws a long, straight shot.']],
    sluicecarriage: [
      ['Leaf-Guide Longbow', 'weapon', 'bow', 85, 'Cut from a guide timber of the Sluice Carriage’s frame, tarred black and straight as the day it was cut.'],
      ['Sluice-Rail Hauberk', 'chest', 'mail', 85, 'Links of the carriage’s haul chain, every one worn bright on one side.'],
      ['Gate-Leaf Boots', 'feet', 'cloth', 85, 'Wrapped in the leather seal off the Sluice Carriage’s leaf.'],
      ['Sluice-Key Scimitar', 'weapon', 'scimitar', 85, 'Forged from the long key that set the sluices.']],
    tideengine: [
      ['Gate-Rack Staff', 'weapon', 'staff', 86, 'A length of the Tide Engine’s rack, every tooth marked off in the Makers’ measure.'],
      ['Tide Engine Breastplate', 'chest', 'plate', 86, 'Plate off the Tide Engine’s frame, with a pale salt line a hand above its hem.'],
      ['The Engine’s Tide Count', 'trinket', 'trinket', 86, 'A brass counter off the Tide Engine’s shaft. It counted every tide the gate was held against.'],
      ['Makers’ Sounding Rod', 'weapon', 'rod', 86, 'The rod the Makers sounded the Sound with. Every mark on it is still true.'],
      ['Sea-Gate Mantle', 'shoulders', 'cloth', 86, 'Grey wool from the Engine Hall, salt-stiff only where the spray reached it.']],
  };
  for (const [mob, list] of Object.entries(drops)) list.forEach(([name, slot, kind, ilvl, desc], i) => { ITEMS[`u_${mob}${i + 1}`] = N(name, slot, kind, ilvl, desc); });
  const T = (mob, gold, ch, extra, gearN) => ({ gold, items: [...drops[mob].map((_, i) => [`u_${mob}${i + 1}`, ch]), ...extra], gear: 1, gearQ: 4, gearN });
  Object.assign(LOOT_TABLES, {
    seaRaid: { gold: [90, 128], items: [['saltiron', 0.5], ['bronzecog', 0.3], ['draught', 0.2]], gear: 0.45, gearQ: 3 },
    u_gatewinch: T('gatewinch', [1300, 1550], 0.3, [['tonic', 1], ['saltiron', 1]], 2),
    u_siltram: T('siltram', [1350, 1600], 0.3, [['tonic', 1], ['saltiron', 1]], 2),
    u_sluicecarriage: T('sluicecarriage', [1400, 1650], 0.3, [['tonic', 1], ['saltiron', 1]], 2),
    u_tideengine: T('tideengine', [2000, 2400], 0.28, [['draught', 1], ['saltiron', 1]], 3),
  });
  // Makers' marks for Quartermaster Hamid, more from each boss deeper into the barrage
  for (const [t, n] of [['u_gatewinch', 7], ['u_siltram', 7], ['u_sluicecarriage', 8], ['u_tideengine', 14]]) for (let i = 0; i < n; i++) LOOT_TABLES[t].items.push(['makermark', 1]);
  // and a tide-marked row in Hamid's stock to spend them on (item level 82, feet this time)
  Object.assign(ITEMS, {
    mk_tsabatons: { name: 'Tide-Marked Sabatons', slot: 'feet', icon: 'a_plate_feet~3', weight: 'plate', q: 4, stats: { armor: 956, hp: 257, power: 54 }, ilvl: 82 },
    mk_tboots: { name: 'Tide-Marked Boots', slot: 'feet', icon: 'a_mail_feet~3', weight: 'mail', q: 4, stats: { armor: 848, hp: 248, crit: 18 }, ilvl: 82 },
    mk_tshoes: { name: 'Tide-Marked Shoes', slot: 'feet', icon: 'a_cloth_feet~3', weight: 'cloth', q: 4, stats: { armor: 561, hp: 205, power: 63 }, ilvl: 82 },
    mk_tcharm: { name: 'Tide-Marked Keepsake', slot: 'trinket', icon: 't_trinket~3', q: 4, stats: { power: 164, hp: 91, crit: 21 }, ilvl: 82 },
  });
  MARK_SHOP.push({ item: 'mk_tsabatons', price: 110 }, { item: 'mk_tboots', price: 110 }, { item: 'mk_tshoes', price: 110 }, { item: 'mk_tcharm', price: 130 });
  // the halls, south to north (local metres in the raid grid): trash packs on the way, each boss in its own hall, every
  // pack and boss clear of the wells, the Tide Engine last (it is the raid's final boss: Heroic opens after a Normal kill)
  SPAWNS.push(
    ds('barrage', 'sgwarden', 70, 188, 1, 1), ds('barrage', 'sgwarden', 82, 188, 1, 1),
    ds('barrage', 'sghaulier', 34, 168, 3, 2), ds('barrage', 'sgdredge', 116, 168, 3, 2), ds('barrage', 'sgcarriage', 36, 188, 2, 2), ds('barrage', 'sgwarden', 114, 188, 2, 2),
    ds('barrage', 'gatewinch', 75, 172, 1, 1),
    ds('barrage', 'sgwarden', 111, 155, 1, 2),
    ds('barrage', 'sgdredge', 110, 145, 3, 2), ds('barrage', 'sgcarriage', 84, 127, 2, 2), ds('barrage', 'sghaulier', 135, 127, 2, 2), ds('barrage', 'sgwarden', 110, 109, 2, 2),
    ds('barrage', 'siltram', 110, 127, 1, 1),
    ds('barrage', 'sgwarden', 91, 100, 1, 2),
    ds('barrage', 'sghaulier', 50, 89, 3, 2), ds('barrage', 'sgdredge', 50, 60, 3, 2), ds('barrage', 'sgcarriage', 94, 74, 3, 2), ds('barrage', 'sgwarden', 20, 74, 2, 2),
    ds('barrage', 'sluicecarriage', 50, 74, 1, 1),
    ds('barrage', 'sgwarden', 93, 50, 1, 2),
    ds('barrage', 'sgdredge', 24, 38, 3, 2), ds('barrage', 'sghaulier', 126, 38, 3, 2), ds('barrage', 'sgcarriage', 26, 10, 3, 2), ds('barrage', 'sgwarden', 124, 10, 3, 2),
    ds('barrage', 'tideengine', 75, 11, 1, 1),
  );
  // homestead plaques for the Normal and Heroic clears
  HOME_TROPHIES.push(['plaque_seagate', 'Sea Gate plaque', { ach: 'rSeaGate' }], ['plaque_hseagate', 'Gilded Sea Gate plaque (Heroic)', { ach: 'rhSeaGate' }]);
}
// ============================================================================ end of P13.5 THE SEA GATE

// ============================================================================ P13.5 CHAPTER 44 "FOR WHOEVER COMES AFTER" (story text in story.js)
// The last chapter of Part Thirteen (levels 59-60, the Sea Gate). Gatewatch Nabil keeps watch on the jammed gate; you break
// the tide wardens on the headland that keep its guides open, bring back the gate winch pawls the Sound's machines carried
// off (c44_pawl), Talib brings out the gatehouse key, Nabil draws the bar at low water (m_c44_low opens the raid), a company
// of ten stops the Tide Engine, and the gate shuts on the flood and opens on the ebb again. Then the valley plants a new row
// of young poles of its own at the south end of the Makers' rows (o_twplant1-3, kind twplant), Wasim lays the first new lift
// rope, and it goes up the lift from Mansur's drum to the Heights. Rewards item level 83-84, one per slot. After the ending
// Qasim and Shakir tend the new row.
{
  const R = (name, slot, lvl, art, haste = false) => {
    const g = gear(name, slot, 4, lvl, haste);
    if (slot === 'weapon') { g.wtype = art; g.icon = `w_${art}~3`; }
    else if (slot === 'trinket') g.icon = 't_trinket~3';
    else if (slot === 'back') g.icon = 'a_back~3';
    else { g.weight = art; g.icon = `a_${art}_${slot}~3`; }
    return g;
  };
  Object.assign(ITEMS, {
    c44_pawl: { name: 'Gate Winch Pawl', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A heavy bronze pawl off one of the Sea Gate’s winches, the catch that holds a gate where it is set. Nabil wants them back in their winches.' },
    r_c44_gloves: R('Pawl-Setter’s Gauntlets', 'hands', 83, 'plate'),
    r_c44_boots: R('Headland Boots', 'feet', 83, 'mail'),
    r_c44_legs: R('Gatewatch Breeches', 'legs', 83, 'cloth'),
    r_c44_helm: R('Low-Water Helm', 'head', 83, 'mail'),
    r_c44_coat: R('Gatehouse Coat', 'chest', 84, 'cloth'),
    r_c44_sword: R('Bar of the Gatehouse', 'weapon', 84, 'sword'),
    r_c44_charm: { ...R('First Rope Keepsake', 'trinket', 84, null, true), desc: 'A short end cut off the first new lift rope laid on the Makers’ walk, whipped tight at both ends.' },
    r_c44_mantle: R('Mantle of the New Row', 'shoulders', 84, 'plate'),
    r_c44_cloak: R('Cloak of the Tidewater Yards', 'back', 84),
  });
  // the pawls come off the Sound's machines (only for those on the quest)
  LOOT_TABLES.tideMach.items.push(['c44_pawl', 0.5]);
  // the new row: three young straight poles planted north to south at the south end of the Makers' rows, between two of
  // the old rows, out of the salt and clear of the tracks and the packs
  OBJECT_KINDS.twplant = { prompt: 'Plant a young pole in the new row', goal: 'Young poles planted', done: 'planted' };
  OBJECTS.push(
    { id: 'o_twplant1', kind: 'twplant', x: 597.25, z: -2600, ry: 0 },
    { id: 'o_twplant2', kind: 'twplant', x: 597.25, z: -2605, ry: 0 },
    { id: 'o_twplant3', kind: 'twplant', x: 597.25, z: -2610, ry: 0 },
  );
  NPCS.push(
    { id: 'n_tw_row1', name: 'Qasim', title: 'The Tidewrights', look: 'villager', v: 2, x: 594.5, z: -2593, ry: 2.6, quests: [], seenFrom: 'm_c44_after',
      greet: 'Four winters before they are poles, ten before they are timber. Whoever comes after will cut them.' },
    { id: 'n_tw_row2', name: 'Shakir', title: 'The Tidewrights', look: 'villager', v: 8, x: 599, z: -2591.5, ry: -2.8, quests: [], seenFrom: 'm_c44_after',
      greet: 'The gate shut on the flood this morning, and opened on the ebb. Not a drop of salt came over the bank.' },
  );
}
// a weekly for the Sound: the Mill Races under the mills and the Sea Gate in the barrage
QUESTS.w_tidewater = { name: '[Weekly] Ebb and Flood', giver: 'n_tw_talib', turnin: 'n_tw_talib', lvl: 60, pre: 'm_c44_low', weekly: true, daily: true,
  text: 'Two places on the Sound go wrong again every week: the Mill Races under the mills, where the Great Undershot loses its count, and the Sea Gate, where the Tide Engine tries to hold the gate open against the flood. Stop both. Nabil and Hisham keep the doors.',
  done: 'Ebb and flood, both in their places for another week. The rows drank sweet water every day of it.',
  goal: { kills: ['greatundershot', 'tideengine'], n: 2 }, xp: 120000, gold: 7000, rewards: [], bonusGear: { ilvl: 82, q: 4 } };
NPCS.find((n) => n.id === 'n_tw_talib').quests.push('w_tidewater');
// the Main Story ran (applyStory) before these men were placed: give them their story quests
for (const [id, Q] of Object.entries(QUESTS)) if (Q.msq) { const g = NPCS.find((n) => n.id === Q.giver); if (g && !(g.quests ||= []).includes(id)) g.quests.push(id); }
// ============================================================================ end of P13.5 CHAPTER 44

// ============================================================================ P13.6 THE TIDEWRIGHTS (reputation, level 56-60)
// The Sound's own reputation, kept by Yard Master Talib at the Tidewrights' camp (shop ranks Friendly to Exalted, item
// level 81-83, between the Chapter 42-43 rewards and the Sea Gate's drops). Its zones are the Sound's three regions; kills
// in the Mill Races and the Sea Gate raid count too. questRep 0.4 like the other outer areas, so the long story does not
// open the whole shop at once. Rank 2 unlocks the Tidewater Yard paint (tarred black panels, sea-green trim, rope seat).
FACTIONS.tidewrights = { name: 'The Tidewrights', color: '#5a9a8e', zones: ['ropewalkshore', 'tidemills', 'seagate', 'millraces'], qm: 'n_tw_talib', questRep: 0.4 };
Object.assign(ITEMS, {
  rep_tw1: { name: 'Tidewright’s Oakum Cloak', slot: 'back', icon: 'a_back~2', q: 3, stats: { armor: 392, hp: 134, haste: 22 }, ilvl: 81 },
  rep_tw2: { name: 'Sluice-Hatch Gauntlets', slot: 'hands', icon: 'a_plate_hands~2', weight: 'plate', q: 3, stats: { armor: 437, hp: 141, power: 47 }, ilvl: 81 },
  rep_tw3: { name: 'Ropewalker’s Mail Spaulders', slot: 'shoulders', icon: 'a_mail_shoulders~3', weight: 'mail', q: 4, stats: { armor: 594, hp: 183, crit: 11 }, ilvl: 82 },
  rep_tw4: { name: 'Tarred Canvas Hood', slot: 'head', icon: 'a_cloth_head~3', weight: 'cloth', q: 4, stats: { armor: 423, hp: 177, power: 49 }, ilvl: 82 },
  rep_tw5: { name: 'Yard Master’s Caulking Mallet', slot: 'weapon', icon: 'w_mace~3', wtype: 'mace', q: 4, stats: { power: 280, haste: 30, hp: 72 }, ilvl: 83 }, // under the Sea Gate's own weapons (287-294 at 84-86)
});
REP_SHOP.tidewrights = [{ item: 'rep_tw1', rank: 1, price: 30000 }, { item: 'rep_tw2', rank: 2, price: 36000 }, { item: 'rep_tw3', rank: 3, price: 42000 }, { item: 'rep_tw4', rank: 3, price: 42000 }, { item: 'rep_tw5', rank: 4, price: 52000 }];
PAINTS.tideyard = { name: 'Tidewater Yard', body: '#262422', paint: true, trim: '#5a8a80', metal: 'iron', seat: '#b89a6a', need: { rep: 'tidewrights', rank: 2 } };
{ const n = NPCS.find((x) => x.id === 'n_tw_talib'); if (n) n.greet = 'There are eleven of us left to keep a yard built for three hundred. Work the yards with us and the stores are open to you: rope, tar and good timber, and the gear we make from them.'; }
// ============================================================================ end of P13.6 THE TIDEWRIGHTS

// ============================================================================ PART FOURTEEN: THE RAINWARD GORGE (P14.2)
// a deep wet gorge on the rainy side of the range, inland of Tidewater Sound, with its own terrain box (shared/rainward.js,
// registered in shared/areas.js) and a rain that comes and goes on the world clock. Reached by the haul road from the Tide
// Mills (the route comes with P14.1); the Seedwrights live in a camp at the gorge foot and raise what they can in the lowest
// beds. These are the zone's people as placeholders for the story: no quests, no route, no shop yet (the head grower keeps
// the reputation, P14.6).
NPCS.push(
  { id: 'n_rg_kareem', name: 'Roadman Kareem', title: 'The Road Head', look: 'villager', v: 4, x: RAINWARD.road.keeper.x, z: RAINWARD.road.keeper.z, ry: RAINWARD.road.keeper.ry, quests: [],
    greet: 'The haul road ends here, where the wagons turned. Every spring they came up empty and went down full of young poles. Nothing has gone down it in my lifetime.' },
  { id: 'n_rg_nadir', name: 'Head Grower Nadir', title: 'The Seedwrights', look: 'villager', v: 6, x: RAINWARD.qm.x, z: RAINWARD.qm.z, ry: RAINWARD.qm.ry, quests: [],
    greet: 'Seven of us, and beds cut for seven hundred. We keep the two lowest steps and the shelf over the river. Above that the hill does as it likes.' },
  { id: 'n_rg_mahir', name: 'Bedman Mahir', title: 'The Seed Terraces', look: 'villager', v: 1, x: 504.5, z: -2971.5, ry: -2.6, quests: [],
    greet: 'Every step is level and every bed runs straight along it, so the water lies even and the seed takes. The Makers measured all of it. We only weed.' },
  { id: 'n_rg_mukhtar', name: 'Drainman Mukhtar', title: 'The Drain Adits', look: 'villager', v: 3, x: 521.5, z: -3045.5, ry: 2.4, quests: [],
    greet: 'The adits carried the rain out of the hill before it could gather. Now they are choked, and the water stays in the hill until the hill moves.' },
  { id: 'n_rg_ghalib', name: 'Slipwatch Ghalib', title: 'The Slip', look: 'villager', v: 5, x: 600.5, z: -2983.5, ry: 2.8, quests: [],
    greet: 'When it pours, keep off the marked lanes. The mud comes down them faster than a man can run, and it takes the road with it.' },
  { id: 'n_cv_rainward', name: 'Caravan Master Jalal', title: 'Caravans', look: 'villager', v: 2, x: RAINWARD.caravan.x, z: RAINWARD.caravan.z - 2, ry: 0.5, caravan: 'rainward',
    greet: 'No caravan comes up the gorge, only the haul road from the Sound. I keep the post for the camp, and I can set your compass here.' },
);
// the gorge's caravan stop has no routes (the only way off is the haul road), but it can be the Homeward Compass's home
CARAVANS.push({ id: 'rainward', name: 'Seedwrights’ Camp', x: RAINWARD.caravan.x, z: RAINWARD.caravan.z, zone: 'gorgefoot' });
GRAVEYARDS.push({ x: RAINWARD.grave.x, z: RAINWARD.grave.z });
// what wanderers say in the gorge (the valley's lines are about the valley)
WANDERER_LINES_AREA.rainward = ['It has not stopped dripping since I got here.', 'Keep off the mud lanes when it pours. I mean it.',
  'The beds up on the terraces are beautiful work. Level as a table.', 'Anyone seen how deep the old adits go?',
  'My boots are full of red mud again.', 'Head Grower Nadir could use another pair of hands.'];
// ============================================================================ end of P14.2 THE RAINWARD GORGE

// ============================================================================ P14.1 CHAPTER 45 "BY THE HAUL ROAD EACH SPRING" (story text in story.js)
// The haul road: the Makers' log haulier stands on its stand between the Tide Mills (HAUL_ROAD.stand, the quest object
// o_twhaul1, kind twhaul: unwound until you wind it for q_c45_wind), with its timber wagon coupled behind it. Once it is
// wound and Waggoner Fawzi has the levers (m_c45_haulier), he takes you up the haul road to the Rainward Gorge's road head
// (SAIL.to.rainward, kind 'haul': a fade-teleport ride like the ship and the lift, sent as ev 'haul'), and Roadman Kareem
// at the road head takes you back down to the stand (SAIL.to.tidemills). At the Gorge Foot you dig a slip's spoil off the
// haul road above the camp (o_rgspoil1-3), bring back the seed trays a slip carried over the slope round the camp
// (questOnly nodes rgtray0-7, item c45_tray) and dig the mud off three beds on the shelf across the river (o_rgshelf1-3).
// Rewards item level 86-87, one per slot. The level cap goes 60 -> 65 with this part (shared/classes.js).
// (the stand: the haulier's centre and heading (ry PI: its front to -z, up the Sound side towards the hills), the waggoner
// beside it, where a ride down sets you down)
export const HAUL_ROAD = { stand: { x: 557, z: -2600, ry: Math.PI }, keeper: { x: 553.5, z: -2596.5, ry: Math.PI / 2 }, landing: { x: 552.5, z: -2594.5 } };
NPCS.push(
  { id: 'n_tw_fawzi', name: 'Waggoner Fawzi', title: 'The Haul Road', look: 'villager', v: 8, x: HAUL_ROAD.keeper.x, z: HAUL_ROAD.keeper.z, ry: HAUL_ROAD.keeper.ry, quests: [],
    greet: 'My grandfather’s father drove that haulier up the gorge every spring. I oil its tracks. Somebody ought to.' },
);
SAIL.to.rainward = { x: RAINWARD.road.landing.x, z: RAINWARD.road.landing.z, name: 'the Rainward Gorge', kind: 'haul', need: 'm_c45_haulier', notReady: 'The haulier is not wound yet.',
  say: 'The haulier pulls the wagon north out of the Tide Mills and up the river into the hills. The rain closes in, and at dusk the haul road ends at a stand under dripping rock.' };
// (the way down needs nothing more: anyone who is up the gorge can get home)
SAIL.to.tidemills = { x: HAUL_ROAD.landing.x, z: HAUL_ROAD.landing.z, name: 'the Tide Mills', kind: 'haul',
  say: 'The haulier lets the wagon down the haul road out of the gorge, the brake hissing on every steep stretch, out of the rain and along the river to the stand between the Tide Mills.' };
{ const F = NPCS.find((n) => n.id === 'n_tw_fawzi'); F.sail = 'rainward'; F.sails = ['rainward']; F.haul = true; }
{ const K = NPCS.find((n) => n.id === 'n_rg_kareem'); K.sail = 'tidemills'; K.sails = ['tidemills']; K.haul = true; }
{
  const R = (name, slot, lvl, art, haste = false) => {
    const g = gear(name, slot, 4, lvl, haste);
    if (slot === 'weapon') { g.wtype = art; g.icon = `w_${art}~3`; }
    else if (slot === 'trinket') g.icon = 't_trinket~3';
    else if (slot === 'back') g.icon = 'a_back~3';
    else { g.weight = art; g.icon = `a_${art}_${slot}~3`; }
    return g;
  };
  Object.assign(ITEMS, {
    c45_tray: { name: 'Seed Tray', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A shallow square timber tray of young seedlings in dark earth, carried off the lowest beds by a slip. Nadir wants it back on its step.' },
    r_c45_gloves: R('Spoil-Shoveller’s Gauntlets', 'hands', 86, 'plate'),
    r_c45_boots: R('Haul-Road Boots', 'feet', 86, 'mail'),
    r_c45_legs: R('Seedwright’s Breeches', 'legs', 86, 'cloth'),
    r_c45_hood: R('Rainward Coif', 'head', 86, 'mail'),
    r_c45_coat: R('Shelf-Bed Cuirass', 'chest', 87, 'plate'),
    r_c45_mace: R('Wagon-Pin Mace', 'weapon', 87, 'mace'),
    r_c45_charm: { ...R('Seed Tray Keepsake', 'trinket', 87, null, true), desc: 'A thumb-sized square cut from a seed tray’s rim, stained dark with the gorge’s red mud.' },
    r_c45_mantle: R('Mantle of the Haul Road', 'shoulders', 87, 'cloth'),
    r_c45_cloak: R('Seedwright’s Rain Cloak', 'back', 87),
  });
  // the haulier on its stand (one object: the quest needs it wound once), its front to the north
  OBJECT_KINDS.twhaul = { prompt: 'Knock out the chocks and wind the haulier', goal: 'Log haulier wound', done: 'wound' };
  // the slip's spoil: three heaps of red mud and stone across the haul road where it climbs beside the falls pool; the shelf
  // beds: three beds on the shelf across the river buried under mud off the far wall (ry 0: along the shelf, as its beds)
  OBJECT_KINDS.rgspoil = { prompt: 'Dig the slip’s spoil off the road', goal: 'Spoil heaps dug off the road', done: 'dug off' };
  OBJECT_KINDS.rgshelf = { prompt: 'Dig the mud off the bed', goal: 'Shelf beds cleared', done: 'cleared' };
  OBJECTS.push(
    { id: 'o_twhaul1', kind: 'twhaul', x: HAUL_ROAD.stand.x, z: HAUL_ROAD.stand.z, ry: HAUL_ROAD.stand.ry },
    { id: 'o_rgspoil1', kind: 'rgspoil', x: 437, z: -2971.4, ry: 0.28 },
    { id: 'o_rgspoil2', kind: 'rgspoil', x: 443.5, z: -2973.5, ry: 0.36 },
    { id: 'o_rgspoil3', kind: 'rgspoil', x: 450, z: -2976.6, ry: 0.5 },
    { id: 'o_rgshelf1', kind: 'rgshelf', x: 425.5, z: -2935.42, ry: 0 },
    { id: 'o_rgshelf2', kind: 'rgshelf', x: 433.1, z: -2930.62, ry: 0 },
    { id: 'o_rgshelf3', kind: 'rgshelf', x: 417.9, z: -2930.82, ry: 0 },
  );
  // the seed trays, out over the slope west and north-east of the camp (off the terraces, the tracks and the camp square)
  // (rgtray5-6 moved west of the camp in P14 integration: they lay inside the seed drill packs south-east of it)
  NODES.push(...[[396, -3018], [398, -3004], [400, -2992], [402, -3024], [406, -2988], [402, -3012], [400, -3032], [396, -2982]].map(([x, z], i) => ({ id: 'rgtray' + i, item: 'c45_tray', x, z, questOnly: true })));
}
// the Main Story ran (applyStory) before the Sound's waggoner and the Seedwrights were placed: give them their story quests
for (const [id, Q] of Object.entries(QUESTS)) if (Q.msq) { const g = NPCS.find((n) => n.id === Q.giver); if (g && !(g.quests ||= []).includes(id)) g.quests.push(id); }
// ============================================================================ end of P14.1 CHAPTER 45

// ============================================================================ PART FOURTEEN: the Rainward Gorge's machines (P14.3)
// three regions west to east: the Gorge Foot 60-61, the Seed Terraces 62-63, the Slip 64-65 (models in
// client/assets/rainwardMachines.js). Packs stand on walkable ground on the gorge's north side, out of the river and off the
// marked mud lanes, 35 m or more from the camp's centre, 25 m (past the pack's edge) from every NPC, the haul road's landing
// and pad, the graveyard, the caravan stop and the upper cutting's pad (the Upper Cutting raid's door), 20 m from each adit
// pad (adits[1] is the Drain Adits' door); none in the Seedwrights' own lowest beds or on the shelf across the river. The
// Hill Leveller cuts along the head of the Slip while it is dry and rides down its own mud lane (the east lane) while it
// pours (the spawn's rainPath, shared/sim.js). Stats and spawns via IM() (the Rime Steps' helper) with their own loot table.
Object.assign(ITEMS, {
  gorgeiron: { name: 'Mud-Choked Iron', slot: 'junk', icon: 'gear', q: 0, stack: 20, price: 46, desc: 'A plate off a nursery machine, rain-dark, its seams packed hard with red gorge mud.' },
  rw_pullergrip: gear('Mired Puller’s Grip-Plate Gauntlets', 'hands', 4, 86),
  rw_cutterhood: gear('Moss-Grown Cutter’s Hood-Plate Helm', 'head', 4, 87),
  rw_levellerheart: { ...gear('The Hill Leveller’s Drum Bearing', 'trinket', 4, 88, true), desc: 'The bearing off the Hill Leveller’s cutting drum. Still packed with red mud, and still turning.' },
  rw_levellerplate: gear('Cutting-Drum Breastplate', 'chest', 4, 88),
  rw_levellermace: { ...gear('Drum-Hoop Mace', 'weapon', 4, 88), wtype: 'mace' },
});
{
  const RM = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => IM(name, model, variant, lvl, hp, dmg, xp, { loot: 'rainMach', ...extra });
  Object.assign(MOBS, {
    seeddrill: RM('Seed Drill', 'seeddrill', 0, [60, 61], 9200, [84, 110], 3200, { speed: 3.4, radius: 1.3 }),
    stumppuller: RM('Stump Puller', 'stumppuller', 0, [60, 61], 9500, [86, 112], 3260, { speed: 3.0, range: 3.6, swing: 2.6, radius: 1.6 }),
    terracecutter: RM('Terrace Cutter', 'terracecutter', 0, [62, 63], 10200, [90, 118], 3450, { speed: 3.2, range: 3.6, radius: 1.6 }),
    drainborer: RM('Drain Borer', 'drainborer', 0, [62, 63], 10400, [90, 120], 3500, { speed: 2.9, range: 3.8, swing: 2.6, radius: 1.5 }),
    bronzeborer: RM('Old Bronze Drain Borer', 'drainborer', 1, [62, 63], 10700, [92, 120], 3550, { speed: 2.9, range: 3.8, swing: 2.6, radius: 1.5 }),
    slopewarden: RM('Slope Warden', 'slopewarden', 0, [64, 65], 11200, [96, 126], 3750, { range: 3.4, radius: 1.3 }),
    oldslopewarden: RM('Old Bronze Slope Warden', 'slopewarden', 1, [64, 65], 11800, [98, 128], 3800, { range: 3.4, radius: 1.3, elite: true,
      abilities: [{ kind: 'nova', every: 14, r: 5, delay: 1.7, dmg: 1.3, text: 'The Old Bronze Slope Warden rams its tamper down into the slope!' }] }),
    miredpuller: RM('The Mired Puller', 'stumppuller', 1, [63, 63], 42000, [92, 120], 9000, { elite: true, rare: true, loot: 'rareRain1', speed: 3.0, range: 3.8, swing: 2.6, radius: 1.8,
      abilities: [{ kind: 'circles', every: 10, n: 4, r: 2.8, delay: 1.8, dmg: 1.3, text: 'The Mired Puller drags its grip through the mud and flings it round!' }] }),
    mossgrowncutter: RM('The Moss-Grown Cutter', 'terracecutter', 1, [65, 65], 46000, [100, 130], 9800, { elite: true, rare: true, loot: 'rareRain2', speed: 3.0, range: 3.8, radius: 1.8,
      abilities: [{ kind: 'nova', every: 12, r: 6, delay: 1.8, dmg: 1.5, text: 'The Moss-Grown Cutter races its drum and throws mud and stone all round it!' }] }),
    hillleveller: { name: 'The Hill Leveller', model: 'hillleveller', lvl: [65, 65], hp: 196000, dmg: [104, 138], speed: 1.8, aggro: 12, range: 8, swing: 3.0, xp: 36000, loot: 'hillleveller', radius: 5.5, elite: true, boss: true, world: true,
      notice: 'is cutting along the Slip at the head of the Rainward Gorge, levelling the hill to a plan set down a lifetime ago', yell: 'drives its cutting drum into the hill!',
      abilities: [{ kind: 'circles', every: 9, n: 6, r: 3.6, delay: 2.0, dmg: 1.4, text: 'The Hill Leveller tips its spoil conveyor and spoil comes down across the slope!' },
        { kind: 'nova', every: 17, r: 11, delay: 2.4, dmg: 1.7, text: 'The Hill Leveller drives its drum into the hill, and the ground slumps for metres round it!' },
        { kind: 'adds', at: 0.5, mob: 'terracecutter', n: 3, text: 'Terrace cutters grind down the lanes to clear the Hill Leveller’s cut!' },
        { kind: 'enrage', at: 0.2, text: 'The Hill Leveller races its drum and comes down the Slip with the mud!' }] },
  });
}
Object.assign(LOOT_TABLES, {
  rainMach: { gold: [44, 66], items: [['gorgeiron', 0.45], ['bronzecog', 0.2], ['draught', 0.12]], gear: 0.4 },
  rareRain1: { gold: [340, 420], items: [['rw_pullergrip', 1]], gear: 1, gearQ: 3 },
  rareRain2: { gold: [340, 420], items: [['rw_cutterhood', 1]], gear: 1, gearQ: 3 },
  hillleveller: { gold: [580, 780], items: [['rw_levellerheart', 0.35], ['rw_levellerplate', 0.35], ['rw_levellermace', 0.3], ['tonic', 1], ['gorgeiron', 1]], gear: 1, gearQ: 4, gearN: 2 },
});
SPAWNS.push(
  // the Gorge Foot (60-61): the slope east and north of the lowest beds, up to the foot of the lower falls
  { mob: 'seeddrill', x: 444, z: -3024, r: 3, n: 3 }, { mob: 'seeddrill', x: 457, z: -3013, r: 4, n: 3 }, { mob: 'seeddrill', x: 435, z: -3036, r: 4, n: 3 },
  { mob: 'stumppuller', x: 467, z: -2998, r: 4, n: 3 }, { mob: 'stumppuller', x: 460, z: -3030, r: 4, n: 3 }, { mob: 'stumppuller', x: 468, z: -3046, r: 3, n: 3 },
  // the Seed Terraces (62-63): cutters on the steps, borers by the drains and the stair lanes, the Mired Puller on the bank
  { mob: 'terracecutter', x: 537, z: -2997, r: 4, n: 3 }, { mob: 'terracecutter', x: 512, z: -3018, r: 4, n: 3 }, { mob: 'terracecutter', x: 545, z: -3027, r: 4, n: 3 }, { mob: 'terracecutter', x: 563, z: -3017, r: 4, n: 2 },
  { mob: 'drainborer', x: 483, z: -3002, r: 4, n: 3 }, { mob: 'drainborer', x: 483, z: -3034, r: 4, n: 3 }, { mob: 'drainborer', x: 575, z: -3035, r: 4, n: 2 },
  { mob: 'bronzeborer', x: 573, z: -2999, r: 4, n: 2 }, { mob: 'bronzeborer', x: 553, z: -2975, r: 4, n: 2 }, { mob: 'bronzeborer', x: 564, z: -2958, r: 4, n: 2 },
  { mob: 'miredpuller', x: 531, z: -2958, r: 4, n: 1 },
  // the Slip (64-65): between the mud lanes, well back from the Slipwatch and the upper cutting
  { mob: 'slopewarden', x: 619, z: -2962, r: 3, n: 3 }, { mob: 'slopewarden', x: 623, z: -3014, r: 3, n: 3 },
  { mob: 'slopewarden', x: 600, z: -3012, r: 3, n: 3 }, { mob: 'slopewarden', x: 603, z: -3048, r: 3, n: 3 },
  { mob: 'oldslopewarden', x: 601, z: -3033, r: 3, n: 2 }, { mob: 'oldslopewarden', x: 648, z: -2960, r: 3, n: 3 },
  { mob: 'mossgrowncutter', x: 602, z: -3060, r: 1, n: 1 },
  // the Hill Leveller: along the head of the Slip when it is dry, down the east mud lane while it pours
  { mob: 'hillleveller', path: [[648, -3058], [650, -3047], [650, -3036]], rainPath: [[634, -3060], [633.5, -3048], [633, -3036]], r: 2, n: 1, world: true },
);
// ============================================================================ end of P14.3 RAINWARD MACHINES

// ============================================================================ P14.5 THE UPPER CUTTING (raid, level 65)
// The Makers' deep cut at the head of the Rainward Gorge, where their machines carved the terraces out of the hill (raid
// id 'uppercutting': 'slip' is the Slip region's zone round the cutting's mouth). The cutting's own machines still cut it
// to a plan set down a lifetime ago, and the Terrace Engine at the north face has undercut the hill above the Seed Terraces
// ever since. Squalls come in over the lip of the cut on a short cycle of their own (shared/dungeons.js uppercutting tide,
// read by dungeonTide: 'flood' is a squall pouring, 'ebb' the dry spell), and while it pours the slips run down the marked
// lanes (pits: straight north-south runs of square slip pads). Four bosses, all machines (models in
// client/assets/upperCutting.js): the Stump Puller Prime (the great tracked puller that cleared the cut of its timber),
// the Spoil Conveyor (a long tracked belt that carried the spoil out of the cut), the Bed Ram (a tamping ram that rams new
// beds level) and THE TERRACE ENGINE, the great cutting engine against the north face; it never moves, and each phase it
// cuts harder, until in the last the slips run down the lanes in the dry spells too. Every boss calls the squalls (kind
// 'tide'), sends the slips down its lanes while it pours (kind 'pits': stand out of the lanes) and strikes the open floor in
// the dry. Strikes are mud and stone (teleColor). Ten players, Normal and Heroic (the raid kind, after a Normal clear);
// weekly lockouts per boss; named drops at item level 92-94, raised to 96 on Heroic (rhIlvl); Makers' marks from every
// boss. Boss health for the v120 balance: about 60 s for the harness party at 65 (party about 11,200 a second), 80 s for
// the Terrace Engine. The door is the cutting's mouth, opened once the rain has stopped (m_c48_dry).
{
  const UC = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.4, aggro: 13, range: 3.2, swing: 2.3, xp, loot: 'cutRaid', radius: 1.2, elite: true, ...extra });
  const MUD = { mud: true, teleColor: '#a0643c', novaColor: '#8a6a52' }; // (mud: the client reads teleColor/novaColor only with it)
  const RAIN = (pour, dry) => ({ kind: 'tide', flood: pour, ebb: dry });
  const SLIPS = (o) => ({ kind: 'pits', label: 'Slips', ...o });
  Object.assign(MOBS, {
    // trash: the cutting's own machines, still working to the old plan (old bronze, green at the seams)
    ucpuller: UC('Cutting Stump Puller', 'stumppuller', 1, [65, 65], 11400, [96, 124], 3800, { speed: 3.0, range: 3.6, swing: 2.6, radius: 1.6 }),
    uccutter: UC('Cutting Terrace Cutter', 'terracecutter', 1, [65, 65], 11800, [98, 126], 3850, { speed: 3.2, range: 3.6, radius: 1.6 }),
    ucborer: UC('Cutting Drain Borer', 'drainborer', 1, [65, 65], 11600, [96, 126], 3850, { speed: 2.9, range: 3.8, swing: 2.6, radius: 1.5 }),
    ucwarden: UC('Cutting Slope Warden', 'slopewarden', 1, [65, 65], 12000, [98, 128], 3900, { range: 3.4, radius: 1.3 }),
    // 1. the Stump Puller Prime: a great tracked puller with a portal mast and a grip of two flat square plates
    stumpprime: UC('The Stump Puller Prime', 'stumpprime', 0, [65, 65], 650000, [100, 130], 58000, { ...MUD, loot: 'u_stumpprime', rhIlvl: 96, speed: 2.4, aggro: 18, range: 5.2, swing: 2.6, radius: 3.4, boss: true, raid: true,
      abilities: [RAIN('Rain sheets in over the lip of the cut, and the slips start down the lanes!', 'The squall blows over the cut, and the slips stop in the lanes.'),
        SLIPS({ tide: 'flood', every: 7, delay: 2.0, dmg: 1.5, text: 'Mud and stone come down the marked lanes!' }),
        { kind: 'circles', tide: 'ebb', every: 11, n: 5, r: 3.0, delay: 1.9, dmg: 1.45, text: 'The Stump Puller Prime rips old stumps out of the floor and flings them down all round!' },
        { kind: 'beam', tide: 'ebb', every: 12, len: 24, r: 2.1, delay: 1.8, dmg: 1.55, text: 'The Stump Puller Prime drags its grip along the floor!' },
        { kind: 'adds', at: 0.5, mob: 'ucpuller', n: 3, text: 'Stump pullers grind in from the edges of the Stump Field!' },
        { kind: 'enrage', at: 0.15, text: 'The Stump Puller Prime races its winch and tears at everything in reach!' }] }),
    // 2. the Spoil Conveyor: a long tracked belt with a square spoil hopper at its foot, tipping at its head
    spoilconveyor: UC('The Spoil Conveyor', 'spoilconveyor', 0, [65, 65], 680000, [102, 132], 60000, { ...MUD, loot: 'u_spoilconveyor', rhIlvl: 96, speed: 2.2, aggro: 18, range: 5.6, swing: 2.8, radius: 3.6, boss: true, raid: true,
      abilities: [RAIN('The squall comes over the cut, and wet spoil starts to slide off the Spoil Conveyor’s belt!', 'The rain stops, and the Spoil Conveyor’s belt runs dry.'),
        SLIPS({ tide: 'flood', every: 6, delay: 2.0, dmg: 1.5, text: 'The slips run down the lanes beside the belt!' }),
        { kind: 'beam', tide: 'ebb', every: 10, len: 26, r: 2.2, delay: 1.8, dmg: 1.6, text: 'The Spoil Conveyor throws spoil the whole length of its belt!' },
        { kind: 'nova', tide: 'ebb', every: 13, r: 7.5, delay: 2.0, dmg: 1.6, text: 'The Spoil Conveyor tips its hopper, and spoil slides out all round it!' },
        { kind: 'adds', at: 0.5, mob: 'ucborer', n: 3, text: 'Drain borers crawl out of the spoil to clear the belt!' },
        { kind: 'enrage', at: 0.15, text: 'The Spoil Conveyor’s belt runs faster and faster!' }] }),
    // 3. the Bed Ram: a tamping ram in a square frame on tracks, that rams new seed beds level
    bedram: UC('The Bed Ram', 'bedram', 0, [65, 65], 710000, [104, 134], 62000, { ...MUD, loot: 'u_bedram', rhIlvl: 96, speed: 2.2, aggro: 18, range: 5.2, swing: 2.6, radius: 3.4, boss: true, raid: true,
      abilities: [RAIN('The rain comes down on the Bed Floor, and the Bed Ram rams the wet beds harder!', 'The squall passes, and the new beds steam in the dry.'),
        SLIPS({ tide: 'flood', every: 6, delay: 2.0, dmg: 1.55, text: 'The Bed Ram’s ramming shakes the slips loose down the lanes!' }),
        { kind: 'circles', tide: 'ebb', every: 9, n: 6, r: 3.2, delay: 1.9, dmg: 1.5, text: 'The Bed Ram rams the floor, and the beds jump all round!' },
        { kind: 'phase', below: 0.4, text: 'The Bed Ram’s ram jams in its frame, and it rams on with all its weight!' },
        { kind: 'nova', every: 10, r: 8, delay: 2.0, dmg: 1.6, below: 0.4, text: 'Mud bursts out from under the Bed Ram’s jammed ram!' },
        { kind: 'enrage', at: 0.12, text: 'The Bed Ram rams the floor faster than the eye can follow!' }] }),
    // 4. THE TERRACE ENGINE: the great cutting engine at the north face of the cut, that has cut the hill to an old plan for a
    // lifetime and undercut the terraces; it never moves. Three phases: its strikes come wider, more often and in more places,
    // and in the last the slips run down the lanes in the dry spells too
    terraceengine: UC('The Terrace Engine', 'terraceengine', 0, [66, 66], 880000, [104, 136], 92000, { ...MUD, loot: 'u_terraceengine', rhIlvl: 96, speed: 0, aggro: 22, range: 10.0, swing: 3.0, radius: 6.5, boss: true, raid: true,
      abilities: [RAIN('A squall drives in over the cut, and the Terrace Engine cuts on into the wet face! The slips start down the lanes.', 'The squall blows over, and the slips stop in the lanes.'),
        SLIPS({ tide: 'flood', every: 7, delay: 2.0, dmg: 1.5, above: 0.66, text: 'The cut face sheds its mud down the lanes!' }),
        { kind: 'circles', tide: 'ebb', every: 11, n: 5, r: 3.0, delay: 1.9, dmg: 1.5, above: 0.66, text: 'The Terrace Engine’s drum bites the face, and stone comes down!' },
        { kind: 'beam', tide: 'ebb', every: 12, len: 26, r: 2.3, delay: 1.8, dmg: 1.6, above: 0.66, text: 'The Terrace Engine shoots its spoil out along the floor!' },
        { kind: 'phase', below: 0.66, text: 'The Terrace Engine reads the next step of its plan, and cuts deeper.' },
        { kind: 'adds', at: 0.66, mob: 'ucwarden', n: 3, text: 'Slope wardens stake out the next terrace for the Terrace Engine!' },
        SLIPS({ tide: 'flood', every: 6, delay: 1.9, dmg: 1.6, below: 0.66, above: 0.33, text: 'The slips come down the lanes thick and fast!' }),
        { kind: 'circles', tide: 'ebb', every: 9, n: 7, r: 3.4, delay: 1.8, dmg: 1.55, below: 0.66, above: 0.33, text: 'Stone breaks off the face all along the floor!' },
        { kind: 'beam', tide: 'ebb', every: 11, len: 26, r: 2.3, delay: 1.7, dmg: 1.6, n: 2, below: 0.66, above: 0.33, text: 'Two runs of spoil shoot out across the floor!' },
        { kind: 'phase', below: 0.33, text: 'The Terrace Engine undercuts the face! Rain or dry, the slips run down the lanes.' },
        SLIPS({ every: 7, delay: 1.9, dmg: 1.55, below: 0.33, text: 'The undercut face slides down the lanes in the dry!' }),
        { kind: 'circles', every: 8, n: 8, r: 3.8, delay: 1.8, dmg: 1.5, below: 0.33, text: 'The whole face shakes, and stone comes down everywhere!' },
        { kind: 'beam', every: 10, len: 28, r: 2.4, delay: 1.7, dmg: 1.55, n: 3, below: 0.33, text: 'Three runs of spoil shoot out of the Terrace Engine, one after another!' },
        { kind: 'nova', every: 14, r: 9, delay: 2.2, dmg: 1.6, below: 0.33, text: 'Steam and mud blast out from under the Terrace Engine’s drum!' },
        { kind: 'adds', at: 0.33, mob: 'uccutter', n: 4, text: 'Terrace cutters grind out of the face to cut the next step!' },
        { kind: 'enrage', at: 0.1, text: 'The Terrace Engine drives its drum into the hill with everything it has!' }] }),
  });
  // named drops: item level 92 (the Stump Puller Prime), 93 (the Spoil Conveyor and the Bed Ram), 94 (the Terrace Engine),
  // 96 on Heroic. The same stat budget as the Sea Gate's named drops (x1.45 over the item-level line). The Belt-Pin Pistol
  // stays under the Dragonslayer Hand Cannon even raised to 96 (tools/tests/uppercuttingtest.mjs)
  const ST = {
    weapon: { power: 118, hp: 40, crit: 7 }, trinket: { power: 100, hp: 44, haste: 30 },
    plate: { armor: 420, hp: 112, power: 24 }, mail: { armor: 380, hp: 110, crit: 8 }, cloth: { armor: 380, hp: 96, power: 30 },
  };
  const W = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'];
  const N = (name, slot, kind, ilvl, desc) => {
    const w = W.includes(kind) ? kind : null, wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    const base = ST[w ? 'weapon' : wt || 'trinket'], k = (ilvl / 50) * 1.45, stats = {};
    for (const [s, v] of Object.entries(base)) stats[s] = Math.round(v * k);
    const icon = w ? `w_${w}~3` : wt ? `a_${wt}_${slot}~3` : 't_trinket~3';
    return { name, slot, q: 4, ilvl, req: 65, stats, desc, unique: true, icon, ...(w ? { wtype: w } : {}), ...(w === 'pistol' ? { classes: ['deadeye'] } : {}), ...(wt ? { weight: wt } : {}) };
  };
  const drops = {
    stumpprime: [
      ['Stump-Grip Axe', 'weapon', 'axe', 92, 'Its head was cut from one of the Stump Puller Prime’s grip plates, still ribbed on one face.'],
      ['Grip-Plate Gauntlets', 'hands', 'plate', 92, 'Faced with the flat ribbed plate the Prime closed on a thousand stumps.'],
      ['Mast-Cable Leggings', 'legs', 'mail', 92, 'Links worked from the Prime’s mast cable, red with gorge mud in every joint.']],
    spoilconveyor: [
      ['Belt-Roller Hammer', 'weapon', 'hammer', 93, 'A roller off the Spoil Conveyor’s belt, forged solid onto an oak shaft.'],
      ['Spoil-Shed Hood', 'head', 'cloth', 93, 'Oiled canvas off the conveyor’s rain hood. The rain still runs straight off it.'],
      ['Hopper-Lip Pauldrons', 'shoulders', 'plate', 93, 'Plate off the lip of the Spoil Conveyor’s hopper, worn bright by a lifetime of spoil.'],
      ['Belt-Pin Pistol', 'weapon', 'pistol', 93, 'Its barrel was bored from one of the belt’s long hinge pins. It throws a low, flat shot.']],
    bedram: [
      ['Bed-Line Longbow', 'weapon', 'bow', 93, 'Cut from the straight line rail the Bed Ram ran its beds along, tarred and true.'],
      ['Rammed-Earth Hauberk', 'chest', 'mail', 93, 'Heavy links off the ram’s lifting chain, every one worn flat on its working face.'],
      ['Seedbed Boots', 'feet', 'cloth', 93, 'Wrapped in the felt the Bed Ram’s foot was shod with, so it never marked a bed.'],
      ['Ram-Shaft Scimitar', 'weapon', 'scimitar', 93, 'Forged from a length of the ram’s own shaft.']],
    terraceengine: [
      ['Terrace-Plan Staff', 'weapon', 'staff', 94, 'The Terrace Engine’s measuring rod, every step of the old plan marked on it in the Makers’ measure.'],
      ['Terrace Engine Breastplate', 'chest', 'plate', 94, 'Plate off the Terrace Engine’s frame, with a red mud line a hand above its hem.'],
      ['The Engine’s Step Count', 'trinket', 'trinket', 94, 'A brass counter off the Terrace Engine’s drum shaft. It counted every step the engine cut into the hill.'],
      ['Makers’ Level Rod', 'weapon', 'rod', 94, 'The rod the Makers levelled each terrace with. Every mark on it is still true.'],
      ['Upper Cutting Mantle', 'shoulders', 'cloth', 94, 'Grey wool from the cutting crew’s hut, rain-dark only where the squalls reached it.']],
  };
  for (const [mob, list] of Object.entries(drops)) list.forEach(([name, slot, kind, ilvl, desc], i) => { ITEMS[`u_${mob}${i + 1}`] = N(name, slot, kind, ilvl, desc); });
  const T = (mob, gold, ch, extra, gearN) => ({ gold, items: [...drops[mob].map((_, i) => [`u_${mob}${i + 1}`, ch]), ...extra], gear: 1, gearQ: 4, gearN });
  Object.assign(LOOT_TABLES, {
    cutRaid: { gold: [96, 136], items: [['gorgeiron', 0.5], ['bronzecog', 0.3], ['draught', 0.2]], gear: 0.45, gearQ: 3 },
    u_stumpprime: T('stumpprime', [1400, 1650], 0.3, [['tonic', 1], ['gorgeiron', 1]], 2),
    u_spoilconveyor: T('spoilconveyor', [1450, 1700], 0.3, [['tonic', 1], ['gorgeiron', 1]], 2),
    u_bedram: T('bedram', [1500, 1750], 0.3, [['tonic', 1], ['gorgeiron', 1]], 2),
    u_terraceengine: T('terraceengine', [2150, 2550], 0.28, [['draught', 1], ['gorgeiron', 1]], 3),
  });
  // Makers' marks for Quartermaster Hamid, more from each boss deeper into the cut
  for (const [t, n] of [['u_stumpprime', 7], ['u_spoilconveyor', 7], ['u_bedram', 8], ['u_terraceengine', 14]]) for (let i = 0; i < n; i++) LOOT_TABLES[t].items.push(['makermark', 1]);
  // and a cut-marked row in Hamid's stock to spend them on (item level 90, legs this time)
  Object.assign(ITEMS, {
    mk_clegplates: { name: 'Cut-Marked Legplates', slot: 'legs', icon: 'a_plate_legs~3', weight: 'plate', q: 4, stats: { armor: 1157, hp: 311, power: 65 }, ilvl: 90 },
    mk_cleggings: { name: 'Cut-Marked Leggings', slot: 'legs', icon: 'a_mail_legs~3', weight: 'mail', q: 4, stats: { armor: 1027, hp: 300, crit: 22 }, ilvl: 90 },
    mk_ctrousers: { name: 'Cut-Marked Trousers', slot: 'legs', icon: 'a_cloth_legs~3', weight: 'cloth', q: 4, stats: { armor: 679, hp: 248, power: 76 }, ilvl: 90 },
    mk_ccharm: { name: 'Cut-Marked Keepsake', slot: 'trinket', icon: 't_trinket~3', q: 4, stats: { power: 180, hp: 100, crit: 23 }, ilvl: 90 },
  });
  MARK_SHOP.push({ item: 'mk_clegplates', price: 120 }, { item: 'mk_cleggings', price: 120 }, { item: 'mk_ctrousers', price: 120 }, { item: 'mk_ccharm', price: 140 });
  // the floors, south to north (local metres in the raid grid): trash packs on the way, each boss on its own floor, every
  // pack and boss clear of the slip lanes, the Terrace Engine last (the raid's final boss: Heroic opens after a Normal kill)
  SPAWNS.push(
    ds('uppercutting', 'ucwarden', 70, 191, 1, 1), ds('uppercutting', 'ucwarden', 82, 191, 1, 1),
    ds('uppercutting', 'ucpuller', 34, 168, 3, 2), ds('uppercutting', 'uccutter', 116, 168, 3, 2), ds('uppercutting', 'ucborer', 36, 187, 2, 2), ds('uppercutting', 'ucwarden', 114, 187, 2, 2),
    ds('uppercutting', 'stumpprime', 75, 176, 1, 1),
    ds('uppercutting', 'ucwarden', 109, 155, 1, 2),
    ds('uppercutting', 'ucborer', 108, 145, 3, 2), ds('uppercutting', 'ucpuller', 108, 112, 3, 2),
    ds('uppercutting', 'spoilconveyor', 108, 128, 1, 1),
    ds('uppercutting', 'ucwarden', 91, 100, 1, 2),
    ds('uppercutting', 'uccutter', 60, 89, 3, 2), ds('uppercutting', 'ucborer', 60, 61, 3, 2), ds('uppercutting', 'ucpuller', 19, 75, 2, 2), ds('uppercutting', 'ucwarden', 99, 75, 2, 2),
    ds('uppercutting', 'bedram', 60, 75, 1, 1),
    ds('uppercutting', 'ucwarden', 93, 50, 1, 2),
    ds('uppercutting', 'uccutter', 24, 38, 3, 2), ds('uppercutting', 'ucborer', 126, 38, 3, 2), ds('uppercutting', 'ucpuller', 26, 10, 3, 2), ds('uppercutting', 'ucwarden', 124, 10, 3, 2),
    ds('uppercutting', 'terraceengine', 75, 11, 1, 1),
  );
  // homestead plaques for the Normal and Heroic clears
  HOME_TROPHIES.push(['plaque_uppercutting', 'Upper Cutting plaque', { ach: 'rUpperCutting' }], ['plaque_huppercutting', 'Gilded Upper Cutting plaque (Heroic)', { ach: 'rhUpperCutting' }]);
}
// ============================================================================ end of P14.5 THE UPPER CUTTING

// ============================================================================ P14.5 CHAPTER 48 "THE HILL HOLDS" (story text in story.js)
// The last chapter of Part Fourteen (levels 64-65, the Upper Cutting). With the drains running again the hill still moves:
// up at the head of the gorge the Terrace Engine keeps cutting to its old plan and undercuts the hill above the terraces.
// Slipwatch Ghalib sends you against the slope wardens staking out its next terrace and for the bronze plan plates the
// gorge's machines carry (c48_plate); Cutwatch Yaqub keeps the cutting's mouth and lifts its stop-logs once the rain has
// stopped (m_c48_dry opens the raid); a company of ten stops the Terrace Engine, and the hill holds through the next storm.
// Then the young poles are lifted from the beds (o_rglift1-3, kind rglift), the first load in a lifetime goes down the haul
// road to the Sound, the valley lays out a nursery of its own beside its new row (o_twnurse1-3, kind twnurse) with seed
// from the gorge, and the poles go up the lift to the Heights for Kamal's shelter rows. Rewards item level 90-91.
{
  const R = (name, slot, lvl, art, haste = false) => {
    const g = gear(name, slot, 4, lvl, haste);
    if (slot === 'weapon') { g.wtype = art; g.icon = `w_${art}~3`; }
    else if (slot === 'trinket') g.icon = 't_trinket~3';
    else if (slot === 'back') g.icon = 'a_back~3';
    else { g.weight = art; g.icon = `a_${art}_${slot}~3`; }
    return g;
  };
  Object.assign(ITEMS, {
    c48_plate: { name: 'Bronze Plan Plate', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A square bronze plate punched in rows of holes: one step of the Makers’ old cutting plan, carried by the gorge’s machines. Ghalib wants every one out of the hill.' },
    r_c48_gloves: R('Stop-Log Gauntlets', 'hands', 90, 'plate'),
    r_c48_boots: R('Slipwatch Boots', 'feet', 90, 'mail'),
    r_c48_legs: R('Cutwatch Breeches', 'legs', 90, 'cloth'),
    r_c48_helm: R('Squall Helm', 'head', 90, 'mail'),
    r_c48_coat: R('Nursery Coat', 'chest', 91, 'cloth'),
    r_c48_sword: R('Plan-Plate Blade', 'weapon', 91, 'sword'),
    r_c48_charm: { ...R('First Load Keepsake', 'trinket', 91, null, true), desc: 'A short peg of young timber off the first load down the haul road, its bark still green.' },
    r_c48_mantle: R('Mantle of the Holding Hill', 'shoulders', 91, 'plate'),
    r_c48_cloak: R('Cloak of the Rainward Gorge', 'back', 91),
  });
  // the plan plates come off the gorge's machines (only for those on the quest)
  LOOT_TABLES.rainMach.items.push(['c48_plate', 0.5]);
  // the young poles ready to lift: three beds on the first step of the Seed Terraces' west block, along the step (ry 0)
  OBJECT_KINDS.rglift = { prompt: 'Lift the young poles out of the bed', goal: 'Beds of young poles lifted', done: 'lifted' };
  // the valley's own nursery: three beds laid out in the lane east of the new row on the headland, parallel, along x
  OBJECT_KINDS.twnurse = { prompt: 'Lay out a nursery bed with seed from the gorge', goal: 'Nursery beds laid out', done: 'laid out' };
  OBJECTS.push(
    { id: 'o_rglift1', kind: 'rglift', x: 488, z: -2978.1, ry: 0 },
    { id: 'o_rglift2', kind: 'rglift', x: 494, z: -2978.1, ry: 0 },
    { id: 'o_rglift3', kind: 'rglift', x: 500, z: -2978.1, ry: 0 },
    { id: 'o_twnurse1', kind: 'twnurse', x: 603.75, z: -2598.5, ry: 0 },
    { id: 'o_twnurse2', kind: 'twnurse', x: 603.75, z: -2601.5, ry: 0 },
    { id: 'o_twnurse3', kind: 'twnurse', x: 603.75, z: -2604.5, ry: 0 },
  );
  NPCS.push(
    { id: 'n_rg_yaqub', name: 'Cutwatch Yaqub', title: 'The Upper Cutting', look: 'villager', v: 7, x: 645, z: -2993, ry: 1.33, quests: [],
      greet: 'My grandfather dropped the stop-logs across that mouth the year the cutting started to fill with mud. Nobody has lifted them since.' },
  );
}
// the Main Story ran (applyStory) before Yaqub was placed: give him his story quests
for (const [id, Q] of Object.entries(QUESTS)) if (Q.msq) { const g = NPCS.find((n) => n.id === Q.giver); if (g && !(g.quests ||= []).includes(id)) g.quests.push(id); }
// ============================================================================ end of P14.5 CHAPTER 48

// ============================================================================ P14.6 THE SEEDWRIGHTS (reputation, level 61-65)
// The gorge's own reputation, kept by Head Grower Nadir at the Seedwrights' camp (shop ranks Friendly to Exalted, item
// level 89-91: above the Chapter 45-48 rewards at 86-91 and the open-world drops at 86-88, below the Drain Adits' and the
// Upper Cutting's drops at 92-94). Its zones are the gorge's three regions; kills in the Drain Adits and the Upper Cutting
// count too. questRep 0.4 like the other outer areas. Rank 2 unlocks the Seed Terrace paint (moss-green panels, red clay
// trim, a dark wet-timber seat). Stats are the Tidewrights' pieces carried up by item level (3 + 1.6 x ilvl).
FACTIONS.seedwrights = { name: 'The Seedwrights', color: '#6a9a4a', zones: ['gorgefoot', 'seedterraces', 'slip', 'adits', 'uppercutting'], qm: 'n_rg_nadir', questRep: 0.4 };
Object.assign(ITEMS, {
  rep_sw1: { name: 'Seedwright’s Oilcloth Cape', slot: 'back', icon: 'a_back~2', q: 3, stats: { armor: 430, hp: 147, haste: 24 }, ilvl: 89 },
  rep_sw2: { name: 'Bed-Edger’s Gauntlets', slot: 'hands', icon: 'a_plate_hands~2', weight: 'plate', q: 3, stats: { armor: 479, hp: 155, power: 52 }, ilvl: 89 },
  rep_sw3: { name: 'Terrace-Walker’s Mail Spaulders', slot: 'shoulders', icon: 'a_mail_shoulders~3', weight: 'mail', q: 4, stats: { armor: 650, hp: 200, crit: 12 }, ilvl: 90 },
  rep_sw4: { name: 'Drip-Brim Grower’s Hood', slot: 'head', icon: 'a_cloth_head~3', weight: 'cloth', q: 4, stats: { armor: 463, hp: 194, power: 54 }, ilvl: 90 },
  rep_sw5: { name: 'Head Grower’s Iron Mattock', slot: 'weapon', icon: 'w_mace~3', wtype: 'mace', q: 4, stats: { power: 306, haste: 33, hp: 79 }, ilvl: 91 }, // under the Upper Cutting's own weapons (92-94)
});
REP_SHOP.seedwrights = [{ item: 'rep_sw1', rank: 1, price: 34000 }, { item: 'rep_sw2', rank: 2, price: 40000 }, { item: 'rep_sw3', rank: 3, price: 47000 }, { item: 'rep_sw4', rank: 3, price: 47000 }, { item: 'rep_sw5', rank: 4, price: 58000 }];
PAINTS.seedterrace = { name: 'Seed Terrace', body: '#3e5a32', paint: true, trim: '#a8583a', metal: 'iron', seat: '#3a2a1e', need: { rep: 'seedwrights', rank: 2 } };
{ const n = NPCS.find((x) => x.id === 'n_rg_nadir'); if (n) n.greet = 'Seven of us, and beds cut for seven hundred. Work the gorge with us and the sheds are open to you: oilcloth, good iron and what we make from them.'; }
// ============================================================================ end of P14.6 THE SEEDWRIGHTS

// ============================================================================ P14.4 THE DRAIN ADITS (dungeon, level 65)
// (Chapters 46-47's story goes in story.js; their quest items, objects, nodes and Channelman Yasin in the block after this one)
// The stone-lined drainage tunnels the Makers drove into the hill under the Seed Terraces. Not a water rise: the side adits
// are choked and the hill is wet, so mud slips burst in through them on a timer of their own (shared/dungeons.js adits slip,
// lanes): every mob fighting near a marked lane calls its burst (kind 'lanes': step out of the lane), and the choked sumps
// back up wider each time a boss works its chamber (kind 'sumps') until someone stands on a sump's grate to clear it. Three
// bosses, all machines (client/assets/drainAdits.js): the Spoil Tipper (the tracked skip that carried the spoil out of the
// adits and now tips it into the Long Drain), the Sump Ram (the tamper that kept the sumps' grates seated; it packs them
// shut) and the Adit Driver (the Makers' great drain-boring machine in the Collector, the last boss, still boring new adits
// to an old plan and choking the old ones with its spoil). Their strikes are mud (mud/teleColor). Heroic is the raid kind
// (dmode raidheroic, after a Normal clear); there the named drops come at item level 94 (rhIlvl). Trash uses the gorge's
// machine models. Health per the v120 balance (docs/ai/balance_v120.md): the last boss about 40 s for the harness party.
{
  const AM = (name, model, variant, lvl, hp, dmg, xp, extra = {}) => ({ name, model, variant, lvl, hp, dmg, speed: 3.2, aggro: 13, range: 3.2, swing: 2.4, xp, loot: 'aditTrash', radius: 1.3, ...extra });
  const MUD = { mud: true, teleColor: '#c8682e', novaColor: '#d8a070' };
  const LANES = (text, dmg = 1.5) => ({ kind: 'lanes', dmg, ...(text ? { text } : {}) });
  Object.assign(MOBS, {
    adborer: AM('Adit Drain Borer', 'drainborer', 0, [64, 65], 11200, [96, 124], 3750, { ...MUD, speed: 2.9, range: 3.8, swing: 2.6, radius: 1.5, abilities: [LANES(null, 1.3)] }),
    adcutter: AM('Adit Terrace Cutter', 'terracecutter', 0, [64, 65], 11000, [94, 122], 3700, { ...MUD, range: 3.6, radius: 1.6, abilities: [LANES(null, 1.3)] }),
    adpuller: AM('Adit Stump Puller', 'stumppuller', 0, [64, 65], 11400, [96, 126], 3780, { ...MUD, speed: 3.0, range: 3.6, swing: 2.6, radius: 1.6, abilities: [LANES(null, 1.3)] }),
    adwarden: AM('Adit Slope Warden', 'slopewarden', 1, [64, 65], 11800, [98, 128], 3820, { ...MUD, range: 3.4, abilities: [LANES(null, 1.3)] }),
    spoiltipper: AM('The Spoil Tipper', 'spoiltipper', 0, [65, 65], 110000, [98, 126], 12000, { ...MUD, loot: 'u_spoiltipper', rhIlvl: 94, speed: 2.6, range: 4.4, swing: 2.6, radius: 2.6, elite: true,
      abilities: [LANES('Mud bursts in through the side adits and runs down the marked lanes!'),
        { kind: 'beam', every: 10, len: 18, r: 2.0, delay: 1.9, dmg: 1.45, text: 'The Spoil Tipper tips its skip, and a tongue of spoil slides down the drain!' },
        { kind: 'circles', every: 12, n: 4, r: 2.8, delay: 1.8, dmg: 1.35, text: 'The Spoil Tipper shakes its skip, and clods of wet spoil fly across the Long Drain!' },
        { kind: 'adds', at: 0.5, mob: 'adcutter', n: 2, text: 'Two terrace cutters grind down the Long Drain to cut the Spoil Tipper a load!' }] }),
    sumpram: AM('The Sump Ram', 'sumpram', 0, [65, 65], 115000, [100, 128], 12200, { ...MUD, loot: 'u_sumpram', rhIlvl: 94, speed: 2.4, range: 4.6, swing: 2.6, radius: 2.6, elite: true,
      abilities: [LANES('The side adits give, and mud slips down the lanes across the Sump Gallery!'),
        { kind: 'sumps', every: 8, delay: 2.0, dmg: 1.3, max: 3, text: 'The Sump Ram tamps its foot down on the grates, and the choked sumps back up!' },
        { kind: 'nova', every: 13, r: 6, delay: 2.0, dmg: 1.5, text: 'The Sump Ram drives its tamper into the floor, and the mud jumps all round it!' },
        { kind: 'adds', at: 0.5, mob: 'adborer', n: 2, text: 'Drain borers crawl out of the side adits to bore the Sump Ram a new drain!' }] }),
    // the last boss: fixed against the Collector's north wall, the slips and the sumps all round it, a heave of mud round its
    // head, and below half health the roof above it sheds mud all over the chamber
    aditdriver: AM('The Adit Driver', 'aditdriver', 0, [66, 66], 430000, [106, 138], 36000, { ...MUD, loot: 'u_aditdriver', rhIlvl: 94, speed: 0, aggro: 18, range: 7.0, swing: 3.0, radius: 4.6, elite: true, boss: true,
      abilities: [LANES('The hill presses in through every side adit, and mud comes down the lanes into the Collector!', 1.6),
        { kind: 'sumps', every: 9, delay: 2.0, dmg: 1.35, max: 3, text: 'The Adit Driver drives its spoil into the Collector’s sumps, and they back up!' },
        { kind: 'nova', every: 14, r: 9, delay: 2.4, dmg: 1.6, text: 'The Adit Driver pulls its head out of the wall, and wet spoil sweeps out all round it!' },
        { kind: 'circles', below: 0.5, every: 8, n: 6, r: 3.4, delay: 2.0, dmg: 1.4, text: 'The Adit Driver bores up into the hill, and the roof sheds mud all over the Collector!' }] }),
  });
  // named drops: item level 92 (all three), raised to 94 on Heroic
  const ST = {
    weapon: { power: 118, hp: 40, crit: 7 }, trinket: { power: 100, hp: 44, haste: 30 },
    plate: { armor: 420, hp: 112, power: 24 }, mail: { armor: 380, hp: 110, crit: 8 }, cloth: { armor: 380, hp: 96, power: 30 },
  };
  const W = ['sword', 'axe', 'mace', 'hammer', 'bow', 'rod', 'scimitar', 'staff', 'pistol'];
  const N = (name, slot, kind, ilvl, desc) => {
    const w = W.includes(kind) ? kind : null, wt = ['plate', 'mail', 'cloth'].includes(kind) ? kind : null;
    const base = ST[w ? 'weapon' : wt || 'trinket'], k = (ilvl / 50) * 1.45, stats = {}; // above the gorge's quest rewards, so the Adits are worth farming
    for (const [s, v] of Object.entries(base)) stats[s] = Math.round(v * k);
    const icon = w ? `w_${w}~3` : wt ? `a_${wt}_${slot}~3` : 't_trinket~3';
    return { name, slot, q: 4, ilvl, req: 63, stats, desc, unique: true, icon, ...(w ? { wtype: w } : {}), ...(w === 'pistol' ? { classes: ['deadeye'] } : {}), ...(wt ? { weight: wt } : {}) };
  };
  const drops = {
    spoiltipper: [['Skip-Hinge Maul', 'weapon', 'hammer', 92, 'The iron hinge pin the Spoil Tipper’s skip turned on, forged into a maul head on a timber shaft.'], ['Spoil-Skip Greaves', 'legs', 'plate', 92, 'Plates off the skip’s sides, scoured bright by a lifetime of spoil.'], ['Tipper Ram Pistol', 'weapon', 'pistol', 92, 'Its barrel was the tipper’s hollow ram rod. Red mud still works out of the grooves.']],
    sumpram: [['Tamper-Shaft Mace', 'weapon', 'mace', 92, 'A length of the Sump Ram’s square tamper shaft, its foot still caked with grate mud.'], ['Sump-Grate Hood', 'head', 'cloth', 92, 'Felted drain cloth off the sump grates, stiff and dark with silt.'], ['Grate-Bar Recurve', 'weapon', 'bow', 92, 'Two grate bars of springy bronze, set straight and strung.']],
    aditdriver: [['Driver-Shroud Hauberk', 'chest', 'mail', 92, 'Links off the chain that hung the Adit Driver’s shroud, each one worn flat on one side.'], ['The Adit Count', 'trinket', 'trinket', 92, 'A brass counter off the Adit Driver’s gearing. It counted every metre it bored, and it never stopped.'], ['Bore-Shaft Staff', 'weapon', 'staff', 92, 'A length of the Adit Driver’s boring shaft, marked in the Makers’ feet.']],
  };
  for (const [mob, list] of Object.entries(drops)) list.forEach(([name, slot, kind, ilvl, desc], i) => { ITEMS[`u_${mob}${i + 1}`] = N(name, slot, kind, ilvl, desc); });
  const T = (mob, gold, extra, gearQ, gearN) => ({ gold, items: [...drops[mob].map((_, i) => [`u_${mob}${i + 1}`, mob === 'aditdriver' ? 0.3 : 0.25]), ...extra], gear: 1, gearQ, gearN });
  const boss = [['tonic', 1], ['gorgeiron', 1]], last = [['draught', 1], ['gorgeiron', 1]];
  Object.assign(LOOT_TABLES, {
    aditTrash: { gold: [46, 68], items: [['gorgeiron', 0.45], ['bronzecog', 0.25], ['draught', 0.12]], gear: 0.4 },
    u_spoiltipper: T('spoiltipper', [240, 300], boss, 3, 2), u_sumpram: T('sumpram', [240, 300], boss, 3, 2), u_aditdriver: T('aditdriver', [640, 820], last, 4, 3),
  });
  // trash packs chamber by chamber, south to north (local metres in the dungeon grid), each boss in its own chamber, every
  // pack clear of the slip lanes and the sumps
  SPAWNS.push(
    ds('adits', 'adwarden', 72, 104, 2, 2),
    ds('adits', 'adborer', 44, 104, 3, 3), ds('adits', 'adpuller', 98, 104, 3, 3), ds('adits', 'adcutter', 46, 88, 3, 2), ds('adits', 'adborer', 98, 88, 3, 2), ds('adits', 'adwarden', 118, 96, 2, 2), ds('adits', 'adcutter', 121, 84, 2, 2),
    ds('adits', 'spoiltipper', 72, 92, 1, 1), // between the lanes, south of the drain channel
    ds('adits', 'adwarden', 38, 75, 1.5, 2),
    ds('adits', 'adpuller', 20, 60, 2, 3), ds('adits', 'adcutter', 70, 60, 2, 2), ds('adits', 'adborer', 77, 37, 2, 2),
    ds('adits', 'sumpram', 47, 48, 1, 1),
    ds('adits', 'adwarden', 87, 44, 1.5, 2),
    ds('adits', 'adborer', 95, 24, 3, 2), ds('adits', 'adpuller', 140, 24, 3, 2), ds('adits', 'adcutter', 117, 52, 2, 2),
    ds('adits', 'aditdriver', 117, 14, 1, 1),
  );
}
// ============================================================================ end of P14.4 THE DRAIN ADITS

// ============================================================================ P14.4 CHAPTERS 46-47 (story text in story.js)
// "The Drains" and "Beds Under the Mud" (levels 62-63, the Seed Terraces). The Makers kept the rain from building up in the
// hill with stone drains: channels along the back of every step, down the stair lanes, under iron grates into the adits.
// Mahir sends you up to Drainman Mukhtar at the adit pads; you clear the four choked grates on the lanes (o_rggrate1-4),
// break the drain borers boring new holes into the steps, gather lining stones washed down off the channels (questOnly
// nodes rgstone0-7, item c46_stone) for Channelman Yasin (a new Seedwright, a man, at the foot of the first block of steps) and set them
// back at the three channel heads behind the top steps (o_rgchannel1-3). The channels run, and still nothing comes out of
// the adits: they are choked inside (Chapter 47). Then you dig four beds out from under the mud on the steps (o_rgbed1-4),
// break the terrace cutters undercutting them, bring Mukhtar timber props the gorge's machines dragged off the adit pads
// (c47_prop, off the rainMach table, only for those on the quest), Mukhtar digs the middle adit's mouth clear and props it
// (the dungeon's door, need m_c47_mouth), you look in, Nadir brings the camp up with lamps and ropes, and a company of five
// stops the Adit Driver in the Collector. Water runs out of all three adits and the hill drains, but at the head of the
// gorge the Terrace Engine still cuts to its old plan (Chapter 48). Rewards item level 88-90.
{
  const R = (name, slot, lvl, art, haste = false) => {
    const g = gear(name, slot, 4, lvl, haste);
    if (slot === 'weapon') { g.wtype = art; g.icon = `w_${art}~3`; }
    else if (slot === 'trinket') g.icon = 't_trinket~3';
    else if (slot === 'back') g.icon = 'a_back~3';
    else { g.weight = art; g.icon = `a_${art}_${slot}~3`; }
    return g;
  };
  Object.assign(ITEMS, {
    c46_stone: { name: 'Lining Stone', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A squared stone off the lining of a terrace drain channel, washed down the steps by a slip. Yasin wants it back in its channel.' },
    c47_prop: { name: 'Timber Prop', slot: 'quest', icon: 'scrap', q: 1, stack: 20, desc: 'A squared timber prop off an adit pad, dragged away by a nursery machine. Mukhtar wants five to hold the middle adit’s mouth.' },
    r_c46_gloves: R('Grate-Lifter’s Gauntlets', 'hands', 88, 'mail'),
    r_c46_boots: R('Channel-Bed Boots', 'feet', 88, 'plate'),
    r_c46_hood: R('Drainman’s Hood', 'head', 88, 'cloth'),
    r_c46_coat: R('Lining-Stone Hauberk', 'chest', 89, 'mail'),
    r_c46_rod: R('Channel Rod', 'weapon', 89, 'rod'),
    r_c47_legs: R('Bed-Digger’s Legguards', 'legs', 89, 'plate'),
    r_c47_blade: R('Adit-Prop Cleaver', 'weapon', 89, 'scimitar'),
    r_c47_mantle: R('Adit-Mouth Pauldrons', 'shoulders', 90, 'mail'),
    r_c47_charm: { ...R('Drain Water Keepsake', 'trinket', 90, null, true), desc: 'A stoppered glass of the first clear water out of the middle adit, drawn the day the hill began to drain.' },
    r_c47_cloak: R('Cloak of the Seed Terraces', 'back', 90),
  });
  // the props come off the gorge's machines (only for those on the quest)
  LOOT_TABLES.rainMach.items.push(['c47_prop', 0.5]);
  OBJECT_KINDS.rggrate = { prompt: 'Lift the grate and dig out the sump under it', goal: 'Drain grates cleared', done: 'cleared' };
  OBJECT_KINDS.rgchannel = { prompt: 'Set the lining stones back in the channel head', goal: 'Channel heads relined', done: 'relined' };
  OBJECT_KINDS.rgbed = { prompt: 'Dig the bed out from under the mud', goal: 'Beds dug out', done: 'dug out' };
  OBJECTS.push(
    // the grates: where the steps' channels drop into the stair lanes' drains (on the lanes, square to them)
    { id: 'o_rggrate1', kind: 'rggrate', x: 480.6, z: -2992, ry: 0 },
    { id: 'o_rggrate2', kind: 'rggrate', x: 513.6, z: -3004, ry: 0 },
    { id: 'o_rggrate3', kind: 'rggrate', x: 544.6, z: -2994, ry: 0 },
    { id: 'o_rggrate4', kind: 'rggrate', x: 513.6, z: -3030, ry: 0 },
    // the channel heads: the tops of the three drain lanes, behind the top steps
    { id: 'o_rgchannel1', kind: 'rgchannel', x: 480.6, z: -3048, ry: 0 },
    { id: 'o_rgchannel2', kind: 'rgchannel', x: 513.6, z: -3046, ry: 0 },
    { id: 'o_rgchannel3', kind: 'rgchannel', x: 544.6, z: -3048, ry: 0 },
    // the buried beds: on the steps of the three blocks, along the rows (ry 0: the beds run along x)
    { id: 'o_rgbed1', kind: 'rgbed', x: 495, z: -2990, ry: 0 },
    { id: 'o_rgbed2', kind: 'rgbed', x: 528, z: -3004, ry: 0 },
    { id: 'o_rgbed3', kind: 'rgbed', x: 560, z: -2995, ry: 0 },
    { id: 'o_rgbed4', kind: 'rgbed', x: 530, z: -2985, ry: 0 },
  );
  // the lining stones, washed down the steps onto the strip between the haul road and the lowest steps
  NODES.push(...[[481, -2973.5], [490, -2974.5], [527, -2973.5], [536, -2974], [549, -2974.5], [558, -2973.5], [567, -2974], [576, -2974.5]].map(([x, z], i) => ({ id: 'rgstone' + i, item: 'c46_stone', x, z, questOnly: true })));
  NPCS.push(
    { id: 'n_rg_yasin', name: 'Channelman Yasin', title: 'The Seed Terraces', look: 'villager', v: 2, x: 480.5, z: -2966, ry: 2.9, quests: [],
      greet: 'Every step has its channel along the back, and every channel runs to a lane. Keep the channels clean and the steps keep themselves.' },
  );
}
// the Main Story ran (applyStory) before Yasin was placed: give him his story quests
for (const [id, Q] of Object.entries(QUESTS)) if (Q.msq) { const g = NPCS.find((n) => n.id === Q.giver); if (g && !(g.quests ||= []).includes(id)) g.quests.push(id); }
// ============================================================================ end of P14.4 CHAPTERS 46-47

// ============================================================================ PAINTED ITEM ICONS
// every everyday item (food, tonics, materials, quest items, junk) with its own painted icon uses it instead of the shared drawing
for (const [id, it] of Object.entries(ITEMS)) if (!it.stats && ITEM_ART.has(id)) { it.iconShared = it.icon; it.icon = 'i_' + id; }

// ============================================================================ RARITY SOURCES AND UPGRADE MATERIALS (rarity_upgrade_plan A3-A5, B)
// Which drop table (shared/items.js DROP_TABLES) a kill's gear rolls on is decided in shared/sim.js dropSrc: a world boss
// 'worldboss', a raid boss 'raid' ('raidH' on Heroic), a dungeon boss 'boss' ('bossH' on Heroic, Tempest, Veteran and the
// raid-kind Heroic), an elite or rare elite 'elite', anything else 'world'; the Dragonslayer pieces 'ds'. A loot table may
// name its own source with `src` (one of RARITY_SRC). Paid or chosen gear keeps its designed rarity and is never rolled:
// quest rewards, spare rewards, vendors, REP_SHOP, MARK_SHOP, crafted gear, buy orders.
// Tempering counts endgame kills only: bosses (dungeon, raid, world) of ENDGAME_LVL and up, by players of ENDGAME_LVL and up.
export const ENDGAME_LVL = 50;
// upgrade materials handed straight to each player who earns the kill (fixed amounts, never a roll): Tempered Billets from
// Heroic, Tempest and Veteran dungeon bosses and from raid bosses; War-Engine Cores from raid bosses (once per weekly
// lockout kill), the Great Dam's Heart and world bosses
export const UPGRADE_DROPS = { billetBossH: 1, billetRaid: 1, billetRaidH: 2, coreRaid: 1, coreRaidH: 2, coreHeart: 4, coreWorld: 1 };
// the smiths who upgrade gear (+1..+10): Brannoc Hale in Sunmere, Smith Garan at the Deepway camp, and a forge at each
// endgame hub (Icefall Landing on the Rime Steps, the Windwrights' camp on the Windward Heights)
NPCS.push(
  { id: 'n_rs_forge', name: 'Smith Harith', title: 'Icefall Forge', look: 'warden', v: 3, x: 465.6, z: -1653.2, ry: -1.57, quests: [],
    greet: 'Cold steel cracks. Warm it right and it takes anything you ask of it. Bring me what you carry, and the materials, and I will raise it a step.' },
  { id: 'n_wh_forge', name: 'Smith Bakr', title: 'Windward Forge', look: 'warden', v: 4, x: 458, z: -2098, ry: -2.4, quests: [],
    greet: 'The wind feeds my fire for free up here. Every step I put into a blade stays in it. No guessing, no waste.' },
);
for (const [id, from] of [['n_rs_forge', 'n_rs_yusuf'], ['n_wh_forge', 'n_wh_kamal']]) { const n = NPCS.find((x) => x.id === id), f = NPCS.find((x) => x.id === from); if (n && f) { if (f.seenFrom) n.seenFrom = f.seenFrom; if (f.seenUntil) n.seenUntil = f.seenUntil; } }
for (const id of ['n_smith', 'n_dw_garan', 'n_rs_forge', 'n_wh_forge']) { const n = NPCS.find((x) => x.id === id); if (n) { n.craft = 'smith'; n.upg = true; } }

// ============================================================================ GEAR BUDGET (v108; see gear() and GEAR_BUDGET)
// Runs last, when every item, quest, loot table and spawn is in. Source of a piece: 'raid' if a loot table of a mob that
// spawns in a raid carries it, 'dungeon' if one in any other dungeon does, else 'quest' (quest rewards, world rares).
// 1) every gear() piece is re-budgeted in place for its final armour weight and source (its stats object is shared with
//    any { ...gear() } copy; a piece whose stats were replaced by hand is left alone), and pistol twins copy their bow;
// 2) a hand-made dungeon or raid piece (named boss drops, set pieces) below its tier is lifted to it, never lowered.
// Dragonslayer pieces, legendaries and above (q 5+) and item level 70+ are their own tier and are not touched.
{
  const kindOf = {};
  for (const s of SPAWNS) if (s.dungeon) { const raid = !!DUNGEON_BY_ID[s.dungeon]?.raid; if (raid || !kindOf[s.mob]) kindOf[s.mob] = raid ? 'raid' : 'dungeon'; }
  const srcOf = {};
  for (const [k, m] of Object.entries(MOBS)) {
    const kind = kindOf[k], T = LOOT_TABLES[m.loot];
    if (kind && T) for (const [id] of T.items) if (ITEMS[id]?.stats && srcOf[id] !== 'raid') srcOf[id] = kind;
  }
  const own = (it) => it?.stats && it.ilvl && it.ilvl < 70 && (it.q ?? 1) < 5 && !it.dsa;
  const remade = new Set();
  for (const [id, it] of Object.entries(ITEMS)) {
    const made = own(it) && GEAR_MADE.get(it.stats);
    if (!made || remade.has(it.stats)) continue;
    const s = gearStats(it, made.haste, srcOf[id] || 'quest');
    for (const k of Object.keys(it.stats)) delete it.stats[k];
    Object.assign(it.stats, s); remade.add(it.stats);
  }
  for (const it of Object.values(ITEMS)) { const B = it.twin && ITEMS[it.twin]; if (B && remade.has(B.stats) && !GEAR_MADE.has(it.stats)) { for (const k of Object.keys(it.stats)) delete it.stats[k]; Object.assign(it.stats, B.stats); } }
  for (const [id, it] of Object.entries(ITEMS)) {
    const src = srcOf[id];
    if (!src || !own(it) || GEAR_MADE.has(it.stats)) continue;
    const want = gearRef(it) * gearTier(it, src), has = gearWorth(it.stats);
    if (has > 0 && has < want) { const k = want / has; for (const s of Object.keys(it.stats)) if (it.stats[s] > 0) it.stats[s] = Math.ceil(it.stats[s] * k); }
  }
}
