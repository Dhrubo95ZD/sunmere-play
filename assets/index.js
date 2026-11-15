// Asset registry: every placeable model, grouped for the gallery.
import * as trees from './trees.js';
import { buildCharacter } from './characters.js';
import { buildMachine } from './creatures.js';
import * as B from './buildings.js';
import * as P from './props.js';
import { houseGallery } from './houses/index.js';

export const ASSETS = {
  // trees
  oak: { cat: 'Trees', make: (s) => trees.oak(s) },
  pine: { cat: 'Trees', make: (s) => trees.pine(s) },
  lilac: { cat: 'Trees', make: (s) => trees.lilac(s) },
  palm: { cat: 'Trees', make: (s) => trees.palm(s) },
  glowbark: { cat: 'Trees', make: (s) => trees.glowbark(s) },
  bushGreen: { cat: 'Plants', make: (s) => trees.bush(s, { kind: 'green' }) },
  bushRed: { cat: 'Plants', make: (s) => trees.bush(s, { kind: 'red' }) },
  fern: { cat: 'Plants', make: (s) => trees.fernPlant(s) },
  // characters
  knight: { cat: 'Classes', character: 'knight', make: () => buildCharacter('knight') },
  ranger: { cat: 'Classes', character: 'ranger', make: () => buildCharacter('ranger') },
  chemist: { cat: 'Classes', character: 'chemist', make: () => buildCharacter('chemist') },
  sandblade: { cat: 'Classes', character: 'sandblade', make: () => buildCharacter('sandblade') },
  warden: { cat: 'Classes', character: 'warden', make: () => buildCharacter('warden') },
  herbalist: { cat: 'Classes', character: 'herbalist', make: () => buildCharacter('herbalist') },
  deadeye: { cat: 'Classes', character: 'deadeye', make: () => buildCharacter('deadeye') },
  raider: { cat: 'Enemies', character: 'raider', make: (s) => buildCharacter('raider', 0) },
  raiderChief: { cat: 'Enemies', character: 'raider', make: (s) => buildCharacter('raider', 2) },
  villager: { cat: 'NPCs', character: 'villager', make: (s) => buildCharacter('villager', s) },
  guildHall: { cat: 'Buildings', make: () => B.guildHall(1) },
  rangerLodge: { cat: 'Buildings', make: () => B.rangerLodge(2) },
  bazaar: { cat: 'Buildings', make: () => B.bazaar(3) },
  forge: { cat: 'Buildings', make: () => B.forge(4) },
  treehouse: { cat: 'Buildings', make: () => B.treehouse(5) },
  watchtower: { cat: 'Buildings', make: () => B.watchtower(6) },
  ruinArch: { cat: 'Buildings', make: () => B.ruinArch(7) },
  gladeArch: { cat: 'Buildings', make: () => B.ruinArch(9, { glade: true }) },
  foundry: { cat: 'Buildings', make: () => B.foundryRuins(10) },
  lanternPost: { cat: 'Props', make: () => P.lanternPost(1) },
  signpost: { cat: 'Props', make: () => P.signpost(2) },
  fence: { cat: 'Props', make: () => P.fence(3) },
  well: { cat: 'Props', make: () => P.well(4) },
  marketStall: { cat: 'Props', make: () => P.marketStall(5) },
  cart: { cat: 'Props', make: () => P.cart(8) },
  waystone: { cat: 'Props', make: () => P.waystone(9) },
  mushrooms: { cat: 'Props', make: () => P.giantMushrooms(11) },
  crystals: { cat: 'Props', make: () => P.crystals(12) },
  tent: { cat: 'Props', make: () => P.raiderTent(13) },
  campfire: { cat: 'Props', make: () => P.campfire(14) },
  crates: { cat: 'Props', make: () => P.crateStack(15) },
  gearling: { cat: 'Machines', make: () => buildMachine('gearling', 0) },
  scrapRoller: { cat: 'Machines', make: () => buildMachine('gearling', 1) },
  crawler: { cat: 'Machines', make: () => buildMachine('crawler') },
  sentinel: { cat: 'Machines', make: () => buildMachine('sentinel', 0) },
  rustguard: { cat: 'Machines', make: () => buildMachine('sentinel', 1) },
  foreman: { cat: 'Machines', make: () => buildMachine('foreman') },
  // the Makers' Rest raid bosses (client/assets/makersRest.js)
  shopcrane: { cat: 'Machines', make: () => buildMachine('shopcrane') },
  boardplane: { cat: 'Machines', make: () => buildMachine('boardplane') },
  greatlathe: { cat: 'Machines', make: () => buildMachine('greatlathe') },
  greatgovernor: { cat: 'Machines', make: () => buildMachine('greatgovernor') },
  // the Mill Races dungeon bosses (client/assets/millRaces.js)
  logcarriage: { cat: 'Machines', make: () => buildMachine('logcarriage') },
  framesaw: { cat: 'Machines', make: () => buildMachine('framesaw') },
  greatundershot: { cat: 'Machines', make: () => buildMachine('greatundershot') },
  // the Sea Gate raid bosses (client/assets/seaGate.js)
  gatewinch: { cat: 'Machines', make: () => buildMachine('gatewinch') },
  siltram: { cat: 'Machines', make: () => buildMachine('siltram') },
  sluicecarriage: { cat: 'Machines', make: () => buildMachine('sluicecarriage') },
  tideengine: { cat: 'Machines', make: () => buildMachine('tideengine') },
};

export function registerAssets(more) { Object.assign(ASSETS, more); }
// the enterable houses: every archetype outside (house_*) and cut away with its interior (inside_*); the seed picks the style
registerAssets(houseGallery());
