// HUD + windows (DOM). Frames, action bars, cast bar, xp, minimap, chat, quest tracker, nameplates,
// floating combat text, character / bags / quests / skills / dialog / vendor / loot / map windows.
import * as THREE from 'three';
import { CLASSES, xpForLevel, LEVEL_CAP, dailyXp, OLD_TO_NEW } from '/sunmere-play/shared/classes.js';
import { kitOf } from '/sunmere-play/shared/kit.js';
import { skillOf, fusionBook } from '/sunmere-play/shared/fusions.js';
import { treeMods, webEff, pathTo, isLeaf, formOpt, leafRefundCost, treeResetCost } from '/sunmere-play/shared/treeMods.js';
import { TREE_NODES, TREE_LINKS, TREE_BY_ID, TREE_MAP, TREE_START } from '/sunmere-play/shared/tree.js';
import { KEYSTONES } from '/sunmere-play/shared/keystones.js';
import { effName } from '/sunmere-play/shared/keystones.js';
const SKILL_BY_ID = new Proxy({}, { get: (_, id) => skillOf(id) }); // (S2: a class on the new kit reads its kit and fusions)
import { shownName } from '/sunmere-play/shared/social.js';
import { ITEMS, QUESTS, MOBS, NPCS, QUALITY, QUALITY_NAME, PRISMATIC_STOPS, HOME_DECO, HOME_TROPHIES, HOME_SPOTS, HOME_MOVABLE, BAG_BASE } from '/sunmere-play/shared/data.js';
import { ZONES, zoneAt, WORLD, REACH, RIME, HEIGHTS, TIDEWATER, RAINWARD, WEALD, AREA_BY_ID, areaOf, waterKind } from '/sunmere-play/shared/terrain.js';
// the maps cover the world rectangle (not centred on the village any more)
const _plPos = new THREE.Vector3(), _plDir = new THREE.Vector3(); // nameplate occlusion rays
const MAP = { x0: WORLD.minX, z0: WORLD.minZ, w: WORLD.maxX - WORLD.minX, h: WORLD.maxZ - WORLD.minZ };
// the Cinder Reach island has its own box, minimap base and map
const RMAP = { x0: REACH.minX, z0: REACH.minZ, w: REACH.maxX - REACH.minX, h: REACH.maxZ - REACH.minZ };
// ... and so has the Rime Steps
const RIMAP = { x0: RIME.minX, z0: RIME.minZ, w: RIME.maxX - RIME.minX, h: RIME.maxZ - RIME.minZ };
// ... and the Windward Heights (no pier: the lift deck on its west cliff, and cloud all round instead of sea)
const HMAP = { x0: HEIGHTS.minX, z0: HEIGHTS.minZ, w: HEIGHTS.maxX - HEIGHTS.minX, h: HEIGHTS.maxZ - HEIGHTS.minZ };
// ... and Tidewater Sound (the quay at the head of the Sound stands for the pier)
const TMAP = { x0: TIDEWATER.minX, z0: TIDEWATER.minZ, w: TIDEWATER.maxX - TIDEWATER.minX, h: TIDEWATER.maxZ - TIDEWATER.minZ };
// ... and the Rainward Gorge (the haul road's head at its west end stands for the pier)
const GMAP = { x0: RAINWARD.minX, z0: RAINWARD.minZ, w: RAINWARD.maxX - RAINWARD.minX, h: RAINWARD.maxZ - RAINWARD.minZ };
// ... and the Russet Weald (the ropeway's lower station stands for the pier)
const WMAP = { x0: WEALD.minX, z0: WEALD.minZ, w: WEALD.maxX - WEALD.minX, h: WEALD.maxZ - WEALD.minZ };
const AMAP = { reach: RMAP, rime: RIMAP, heights: HMAP, tidewater: TMAP, rainward: GMAP, weald: WMAP };
// each area's map: its sea colour, what the pier's label says (at: where it goes, the pier's head by default), and any other
// way off (more: [x, z, label])
const LIFT_FOOT = HEIGHTS.rimeLift.foot;
const AMAP_LOOK = {
  reach: { sea: '#24505e', ship: (you) => 'Ship to Harrowmouth' + (you?.done?.m_c33_refit ? ' / the Rime Steps' : '') },
  rime: { sea: '#2a4a5a', ship: (you) => 'Ship to the Cinder Reach / Harrowmouth' + (you?.done?.m_c41_chart ? ' / Tidewater Sound' : ''), more: (you) => [LIFT_FOOT.x, LIFT_FOOT.z, you?.done?.m_c36_keep ? 'Lift to the Windward Heights' : 'The lift (not running yet)'] },
  heights: { sea: '#dfe6ee', ship: () => 'Lift down to the Dam Crown', at: () => [HEIGHTS.lift.x0 + 6, HEIGHTS.lift.z1 + 10] },
  tidewater: { sea: '#3c5a5c', ship: () => 'Ship to the Rime Steps / Harrowmouth', at: () => [TIDEWATER.quay.x0 - 30, TIDEWATER.quay.z1 + 4], more: (you) => [HAUL_ROAD.stand.x, HAUL_ROAD.stand.z, you?.done?.m_c45_haulier ? 'Haul road to the Rainward Gorge' : 'The haul road (not running yet)'] },
  rainward: { sea: '#3e4a44', ship: () => 'Haul road down to the Tide Mills', at: () => [RAINWARD.road.pad.x - 20, RAINWARD.road.pad.z + 12], more: (you) => [ROPEWAY.slip.pad.x, ROPEWAY.slip.pad.z, you?.done?.m_c49_rope ? 'Ropeway over the ridge to the Russet Weald' : 'The ropeway (not running yet)'] },
  weald: { sea: '#4a3c30', ship: () => 'Ropeway over the ridge to the Slip', at: () => [WEALD.station.pad.x - 20, WEALD.station.pad.z - 14] },
};
// crossing points: quest targets across the sea point here (Haroun's gangway in Harrowmouth, each island pier's harbour master)
// (the Windward Heights are reached only by the lift: from the Heights every other area is down it, at Ghazi's landing, and
// from the Rime Steps a target on the Heights points at Mansur at the lift's foot)
const SAIL_FROM = { valley: [444, 80.6], reach: [REACH.harbour.x, REACH.harbour.z], rime: [RIME.harbour.x, RIME.harbour.z], heights: [HEIGHTS.lift.keeper.x, HEIGHTS.lift.keeper.z], tidewater: [TIDEWATER.harbour.x, TIDEWATER.harbour.z], rainward: [RAINWARD.road.keeper.x, RAINWARD.road.keeper.z], weald: [WEALD.station.keeper.x, WEALD.station.keeper.z] };
// (the Rainward Gorge is reached only by the haul road: from the Sound a target in the gorge points at the waggoner on the
// haulier's stand between the Tide Mills)
// (the Russet Weald is reached only by the ropeway: from the gorge a target in the wood points at the wheelman at the upper
// station, and from the Sound at the waggoner, as for the gorge)
const LIFT_FROM = { rime: { heights: [HEIGHTS.rimeLift.keeper.x, HEIGHTS.rimeLift.keeper.z] }, tidewater: { rainward: [HAUL_ROAD.keeper.x, HAUL_ROAD.keeper.z], weald: [HAUL_ROAD.keeper.x, HAUL_ROAD.keeper.z] }, rainward: { weald: [ROPEWAY.slip.keeper.x, ROPEWAY.slip.keeper.z] } };
const SAIL_LINE = { reach: 'Sail to the Cinder Reach.', valley: 'Sail home to Harrowmouth.', rime: 'Sail north to the Rime Steps.', heights: 'Ride the lift up to the Windward Heights.', rimelift: 'Ride the lift down to the Dam Crown.', tidewater: 'Sail round the cold cape to Tidewater Sound.', rainward: 'Ride the wagon up the haul road to the Rainward Gorge.', tidemills: 'Ride the wagon down the haul road to the Tide Mills.', weald: 'Ride the car over the ridge to the Russet Weald.', slip: 'Ride the car back over the ridge to the Slip.' };
const NEED_CH = { m_c29_aboard: 'Main Story, Chapter 29', m_c32_cold: 'Main Story, Chapter 32', m_c33_refit: 'Main Story, Chapter 33', m_c36_keep: 'Main Story, Chapter 36', m_c41_chart: 'Main Story, Chapter 41', m_c45_haulier: 'Main Story, Chapter 45', m_c49_rope: 'Main Story, Chapter 49' };
const MAP_PX = Math.round(MAP.w); // world map width in pixels (1 px per metre)
import { DUNGEONS, DUNGEON_AREAS, areaCenter, dungeonAt, cellFloor, CELL } from '/sunmere-play/shared/dungeons.js';
import { OBJECT_KINDS, SPAWNS, LOOT_TABLES, NODES, OBJECTS, COMPANIONS, FACTIONS, REP_RANKS, repRank, factionOfZone, SETS, RECIPES, STATION_NAME, PAINTS, PETS, ESCORTS, repairCost, TRADE, tradeFair, PROF_NAME, PROF_MAX, profColor, LEDGER } from '/sunmere-play/shared/data.js';
import { icon, skillIcon, buffArt, achArt, factionArt, homeArt, menuArt, miscArt } from './icons.js';
import { CHANGELOG, CHANGELOG_VERSION } from './changelog.js';
import { installSocial } from './social.js';
import { PerfHud } from './perfhud.js';
import { OTHERS_FX } from '../game/fxbudget.js';
import { CombatHud, setPin, pinsOf, pinnable, pinCast } from './combathud.js';
import { openWebScreen } from './webscreen.js';
import { fusionBookPage, wireFusionBook } from './fusionbook.js';
import { botPrefsMsg } from '../game/net.js';
import { STAT_NAME, STAT_PCT, SLOT_LABEL, typeLine, gearValue, offhandLook, wornLook, SHINE_NAME, OH_NAME, SH_NAME, CLOAK_NAME, GEMS, UPG, upOf, canUpgrade, upgradeCost, upgraded, upgradeTotal, gearName, salvageYield, unsocketFee, BILLET, ENGINE_CORE } from '/sunmere-play/shared/items.js';
import { buildCharacter, setCharWeapon, setCharArmor, setCharCape, setCharGear } from '../assets/characters.js';
import { disposeCharGeometry } from '../assets/rig.js';
import { Animator } from '../game/anim.js';
import * as AUTH from '../game/auth.js';
import { PORTRAITS } from './portraits/manifest.js';
import { LOADING } from './loading/manifest.js';
import { QUALITY as GFX } from '../engine/globals.js';
import { bgState } from '../engine/platform.js';
import { SETTINGS, saveSettings, QUALITY_PRESETS, MINI_ZOOMS, KEY_ACTIONS, keyLabel, keyFor, TOUCH_DEFAULTS, touchSettingsChanged, fpsCapChanged } from '../engine/settings.js';
import { ACHIEVEMENTS, ACH_CATS, ACH_BY_ID, achProgress } from '/sunmere-play/shared/achievements.js';
import { STORY, STORY_PARTS, STORY_NEXT, MSQ_ORDER, storyAt } from '/sunmere-play/shared/story.js';
import { LEGENDARIES, TEMPEST, tempestMods } from '/sunmere-play/shared/data.js';
import { ARMORY, ARMORY_SRC, ARMORY_TOTAL, ARMORY_ROLLED, armoryBest } from '/sunmere-play/shared/armory.js';
import { VENDORS } from '/sunmere-play/shared/data.js';
import { HAUL_ROAD, ROPEWAY } from '/sunmere-play/shared/data.js';
import { IS_TOUCH, IS_APP, IS_WEB, IS_MOBILE, exitGame } from '../engine/platform.js';
// phones and tablets: the full-screen sheet styles (client/mobile-panels.css, all scoped to html.touch / html.phone), loaded
// after hud.css unless index.html already links them; and the mobile nameplate rules (ui/mobileplates.js), loaded when present
if (IS_TOUCH && typeof document !== 'undefined' && !document.querySelector('link[href*="mobile-panels.css"]')) {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/sunmere-play/mobile-panels.css'; document.head.appendChild(l);
}
let MP = null; // { plateRules, declutter } once ui/mobileplates.js has loaded
if (IS_MOBILE) import('./mobileplates.js').then((m) => { MP = m; }).catch(() => { /* not there yet: the built-in mobile rules below apply */ });
const isPhone = () => document.documentElement.classList.contains('phone');
// the 7 wheel slots of a class: the saved list, or the first 7 skills in learn order
// the default is the first 7 skills the hero already knows (as ui/touch.js builds the HUD wheel), never a locked one
// (S2: on the new kit a saved wheel is remapped through OLD_TO_NEW: a slot keeps its place where its skill survives)
const wheelOf = (cls, lvl = Infinity) => { const kit = kitOf(cls), w = SETTINGS.touch?.wheel?.[cls], known = kit.filter((s) => s.lvl <= lvl), have = new Set(); const rm = (id) => { if (!id || kit.some((s) => s.id === id)) return id; const to = OLD_TO_NEW[id]?.to; return to && kit.some((s) => s.id === to) ? to : null; }; return Array.from({ length: 7 }, (_, i) => { const id = Array.isArray(w) ? rm(w[i] ?? null) : known[i]?.id ?? null; if (!id || have.has(id)) return null; have.add(id); return id; }); };
import { describeEffect, skillCost, skillCd } from '/sunmere-play/shared/talents.js';
const SKILL_BY_NAME = Object.fromEntries(Object.keys(CLASSES).flatMap(kitOf).map((k) => [k.name, k]));

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
// painted coin after each amount (client/ui/icons/misc/coin_*.webp); the g/s/c letter stays only when a coin file is missing
const COIN = (k, l) => { const a = miscArt('coin_' + k); return a ? `<img class="coin-im" src="${a}" alt="${l}">` : l; };
const COINS = { g: COIN('gold', 'g'), s: COIN('silver', 's'), c: COIN('copper', 'c') };
const fmtMoney = (c) => { const g = Math.floor(c / 10000), s = Math.floor((c % 10000) / 100), cp = c % 100; return ((g ? `<b class="m-g">${g}</b>${COINS.g} ` : '') + (s ? `<b class="m-s">${s}</b>${COINS.s} ` : '') + (cp || (!g && !s) ? `<b class="m-c">${cp}</b>${COINS.c}` : '')).trim(); }; // (zero parts are left out: "5s", not "5s 0c")
// the same amount as plain text ("5g 3s"), for buttons and labels that strip markup
const fmtMoneyText = (c) => { const g = Math.floor(c / 10000), s = Math.floor((c % 10000) / 100), cp = c % 100; return ((g ? `${g}g ` : '') + (s ? `${s}s ` : '') + (cp || (!g && !s) ? `${cp}c` : '')).trim(); };
// Muster and Dungeon Rides row icon: the dungeon's own painting cropped to a square, else the painted doorway, else the shield
const dgIc = (id, feat) => { const a = LOADING.has('dg_' + id) ? `/sunmere-play/ui/loading/dg_${id}.webp` : miscArt('dungeon'); return `<img class="tr-ic${a ? ' tr-thumb' : ''}${feat ? ' tr-feat' : ''}" src="${a || icon('shield', feat ? '#6a4a10' : '#3a3226', 36)}" alt="">`; };
// homestead furnishing art; the faction standards (std_*) stay held off until they are repainted without the flag look
const decoArt = (k) => (k.startsWith('std_') ? null : homeArt(k));
const itemDef = (it) => (it?.gear ? it.gear : it?.id ? { ...ITEMS[it.id], id: it.id } : null);
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
// key shown for action bar slot i: 1..0, Shift+1..0, then the rebindable keys of skills 21 to 28 (Q, E, T, V, X, P, [, ] by default)
const skillKeyLabel = (i, short) => (i < 10 ? KEYS[i] : i < 20 ? (short ? 'S' : 'Shift+') + KEYS[i - 10] : keyLabel(keyFor('skill' + (i + 1))));
const placeName = (id) => ZONES.find((z) => z.id === id)?.name || DUNGEONS.find((d) => d.id === id)?.name || DUNGEON_AREAS.find((a) => a.id === id)?.name || id;
const npcName = (id) => NPCS.find((n) => n.id === id)?.name || id;
const npcPlace = (id) => { const n = NPCS.find((x) => x.id === id); return n ? zoneAt(n.x, n.z).name : ''; };
// the Main Story's crest (a small shield with a ! or ?), used in the tracker, dialogs and the quest log
const CREST = (ch = '!', dim = false) => `<svg class="crest" viewBox="0 0 20 24" aria-hidden="true"><path d="M2 2H18V11.5Q17.6 18.6 10 22.6Q2.4 18.6 2 11.5Z" fill="${dim ? '#6a665e' : '#b02e12'}" stroke="${dim ? '#c8c0b0' : '#f2c450'}" stroke-width="1.8"/><text x="10" y="15.6" text-anchor="middle" font-size="12" font-weight="700" font-family="Georgia,serif" fill="${dim ? '#f0ece4' : '#ffe9a0'}">${ch}</text></svg>`;
// regions with a painting: finding one for the first time shows it as a banner
const REGION_ART = { icefall: 'storm', fields: 'valley', briarhold: 'briar', glade: 'glade', quarry: 'quarry', westfold: 'westfold', dunewatch: 'desert', foundry: 'rust', lookout: 'storm', coilway: 'coilway', passwatch: 'farvale', ledgerholm: 'farvale', harrowmouth: 'harrow', saltcamp: 'saltpan', dw_camp: 'deepway' };
const ZONE_ART = { village: 'valley', fields: 'valley', meadows: 'valley', greenwood: 'valley', briarhold: 'briar', glade: 'glade', quarry: 'quarry', eastreach: 'quarry', westfold: 'westfold', dunewatch: 'desert', sunscar: 'desert', brasswind: 'desert', vaultruins: 'desert', raidercamp: 'desert', foundrywatch: 'rust', rustwood: 'rust', sawmill: 'rust', foundry: 'rust', northwatch: 'rust', highreach: 'storm', lookout: 'storm', coilfields: 'storm', cragcamp: 'storm', coilway: 'coilway', nwpass: 'farvale', farside: 'farvale', passwatch: 'farvale', ledgerholm: 'farvale', saltgap: 'harrow', harrowcoast: 'harrow', harrowmouth: 'harrow', guildyards: 'harrow', sunpass: 'saltpan', glasswaste: 'saltpan', saltcamp: 'saltpan', kilnworks: 'saltpan', ashfall: 'harrow', slagterraces: 'rust', oldworks: 'rust', firstfurnace: 'rust', icefall: 'storm', flumeworks: 'storm', damcrown: 'storm', greatdam: 'storm' };
// the Deepway, its named areas and the raid behind it share one painting
for (const id of ['deepway', 'makershall', ...DUNGEON_AREAS.map((a) => a.id)]) ZONE_ART[id] = 'deepway';
// zones and dungeons with their own Codex painting (client/ui/loading/manifest.js) use it, and a zone's is its discovery banner
for (const z of ZONES) if (LOADING.has(z.id)) ZONE_ART[z.id] = REGION_ART[z.id] = z.id;
if (LOADING.has('scrapway')) ZONE_ART.scrapwatch = REGION_ART.scrapwatch = 'scrapway';
for (const d of DUNGEONS) if (LOADING.has('dg_' + d.id)) ZONE_ART[d.id] = 'dg_' + d.id;
const artAt = (x, z) => ZONE_ART[zoneAt(x, z).id] || 'valley';
// a chapter's painting, or the nearest earlier chapter's when its own is missing or held back
const chapterArt = (C) => { for (let i = STORY.indexOf(C); i >= 0; i--) if (LOADING.has(STORY[i].art)) return STORY[i].art; return 'valley'; };
// quality colours dark enough to read on parchment
const INK = ['#5a5a5a', '#2a1e10', '#11660a', '#0a44a0', '#5e1a9a', '#8a5a00', '#3a3a9a'];
// ---- rarity and upgrades in the UI (rarity_upgrade_plan.md A8, B4)
// Prismatic (q 6) has no single colour: QUALITY[6] is its flat fallback, and hud.css paints any name or border written in that
// fallback with the tempered-steel gradient (--prism, set here from PRISMATIC_STOPS). It drifts slowly on desktop only.
try { document.documentElement.style.setProperty('--prism', `linear-gradient(135deg, ${[...PRISMATIC_STOPS, PRISMATIC_STOPS[0]].join(', ')})`); } catch { /* no document (tests) */ }
// the heat each upgrade stage shows on the steel (physical colours on the blackbody ramp: dull red, cherry, orange, white)
const HEAT_STAGE = { 7: { name: 'Dull red', col: '#8a2a1a' }, 8: { name: 'Cherry red', col: '#c8321e' }, 9: { name: 'Bright orange', col: '#ff7a1a' }, 10: { name: 'White heat', col: '#ffe8a0' } };
// ten pips for an upgrade step: filled up to `up`, stages 7 to 10 carry their heat colour
const upPips = (up, next = 0) => `<span class="up-pips">${Array.from({ length: UPG.max }, (_, i) => { const s = i + 1, h = HEAT_STAGE[s]; return `<i class="${s <= up ? 'on' : s === next ? 'nx' : ''}${h ? ' heat' : ''}"${h ? ` style="--hc:${h.col}"` : ''}></i>`; }).join('')}</span>`;
const shineName = (q) => SHINE_NAME[q] || (Number(q) === 6 ? 'Prismatic shine' : 'Plain');
const ROMAN = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen'];
// one line saying what a quest wants
const goalLine = (Q) => { const g = Q.goal; return g.kills ? g.kills.map((k) => MOBS[k].name).join(', ') + ' defeated' : g.kill ? `${MOBS[g.kill].name} slain` : g.item ? `${ITEMS[g.item].name}` : g.gather ? `${ITEMS[g.gather].name} gathered` : g.use ? OBJECT_KINDS[g.use].goal : g.escort ? `${ESCORTS[g.escort].name} brought safely` : g.talk ? `Speak with ${npcName(Q.turnin)} (${npcPlace(Q.turnin)})` : `Reach ${placeName(g.reach)}`; };
const plur = (n, w) => (n > 1 && !/s$|^The /.test(w) ? (/(ch|sh|x)$/.test(w) ? w + 'es' : w + 's') : w);
const goalAsk = (Q) => { const g = Q.goal; return g.kills ? `Defeat ${g.kills.map((k) => MOBS[k].name).join(', ')}` : g.kill ? `Defeat ${g.n} ${plur(g.n, MOBS[g.kill].name)}` : g.item ? `Bring ${g.n} ${plur(g.n, ITEMS[g.item].name)}` : g.gather ? `Gather ${g.n} ${plur(g.n, ITEMS[g.gather].name)}` : g.use ? `${OBJECT_KINDS[g.use].prompt} (${g.n})` : g.escort ? `Escort ${ESCORTS[g.escort].name} safely` : g.talk ? `Speak with ${npcName(Q.turnin)} in ${npcPlace(Q.turnin)}` : 'Travel to ' + placeName(g.reach); };
const GEAR_SLOTS = ['head', 'shoulders', 'back', 'chest', 'hands', 'legs', 'feet', 'weapon', 'offhand', 'trinket'];
// faint silhouettes for empty paper-doll slots (the slot name stays in the tooltip). Plain shapes only:
// a faceless helm, a sword with a round guard (no crossbar), a plain shield and an oval trinket.
const SLOT_GLYPH = {
  head: 'M32 8C19 8 13 18 13 30V44L19 50H45L51 44V30C51 18 45 8 32 8ZM20 32H44V38H20Z',
  shoulders: 'M14 14Q32 8 50 14L52 26Q32 21 12 26ZM10 30Q32 25 54 30L56 42Q32 37 8 42ZM8 46Q32 41 56 46L57 56Q32 51 7 56Z', // three stacked lames
  back: 'M20 8H44L48 16L52 56L42 52L32 57L22 52L12 56L16 16Z',
  chest: 'M18 9L26 12C28 16 36 16 38 12L46 9L56 18L50 28V54C40 58 24 58 14 54V28L8 18Z',
  hands: 'M22 56V34L16 26C14 23 17 20 20 22L24 26V12C24 9 28 9 28 12V24H30V8C30 5 34 5 34 8V24H36V10C36 7 40 7 40 10V26H42V16C42 13 46 13 46 16V40L42 56Z',
  legs: 'M17 8H47L45 32L43 56H35L33 32H31L29 56H21L19 32Z',
  feet: 'M22 8H36V40L54 46C57 47 57 54 54 54H12C10 54 10 50 12 48L20 40Z',
  weapon: 'M51 7L57 13L33 37L27 31ZM20 39A5 5 0 1 0 30 39A5 5 0 1 0 20 39ZM18 44L21 47L13 55L10 52Z',
  offhand: 'M32 7L52 13V30C52 44 43 52 32 57C21 52 12 44 12 30V13Z',
  trinket: 'M28 7H36V13H28ZM32 16C41 16 46 26 46 36S41 56 32 56S18 46 18 36S23 16 32 16Z', // a plain pendant
};
const slotGlyph = (s) => `<svg class="eglyph" viewBox="0 0 64 64" aria-hidden="true"><path d="${SLOT_GLYPH[s] || ''}" fill="currentColor" fill-rule="evenodd"/></svg>`;
// backpack category tabs: Gear, Consumables, Materials (anything a recipe asks for, or a sound trade good), Quest and Junk
const MATS = new Set(RECIPES.flatMap((r) => (r.needs || []).map((n) => n[0])));
const bagCat = (it) => {
  const d = itemDef(it); if (!d) return null;
  const q = d.q ?? 1;
  if (d.slot === 'quest') return 'quest';
  if (d.slot === 'use') return 'use';
  if (d.stats && GEAR_SLOTS.includes(d.slot)) return q === 0 ? 'junk' : 'gear';
  return MATS.has(it.id) || q >= 1 ? 'mat' : 'junk';
};
// one number to rank gear by: what the stats are worth to a fighter of any class
// "▲ Upgrade +3": a piece that beats what you wear in its slot, with the item-level gain
const upTag = (d, y) => { if (!isUpgrade(d, y)) return ''; const cur = y.equip?.[d.slot], gain = cur?.ilvl && d.ilvl ? d.ilvl - cur.ilvl : 0; return `<i class="up-tag" title="Better than what you wear">▲ Upgrade${gain > 0 ? ` +${gain} item level${gain > 1 ? 's' : ''}` : ''}</i>`; };
const isUpgrade = (d, y) => !!(d?.stats && GEAR_SLOTS.includes(d.slot) && y && !(d.classes && !d.classes.includes(y.cls)) && gearScore(d) > gearScore(y.equip?.[d.slot]) + 0.5);
const gearScore = (d) => (d?.stats ? (d.stats.power || 0) * 1.6 + (d.stats.armor || 0) * 0.3 + (d.stats.hp || 0) * 0.9 + (d.stats.haste || 0) * 1.2 + (d.stats.crit || 0) * 1.5 + (d.stats.dodge || 0) * 1.3 + (d.stats.leech || 0) * 2.5 : 0);
const classArt = (c) => `/sunmere-play/ui/classes/${c}.webp`; // painted class portraits (Codex art, faceless)

export class UI {
  constructor(game) {
    this.g = game;
    this.root = $('#ui');
    this.you = null;
    this.windows = {};
    this.floats = [];
    this.plates = new Map();
    this.lastZone = null;
    this.tip = el('div', 'tooltip');
    document.body.appendChild(this.tip);
    // v116 Performance readout (Options > Graphics): nothing is installed while it is off
    this.perfHud = new PerfHud(game);
    if (SETTINGS.perfHud) this.perfHud.setOn(true);
    this.tip2 = el('div', 'tooltip tip-cmp');
    document.body.appendChild(this.tip2);
  }

  // the online connection's state: 'reconnecting' (a small banner at the top, the game stays up behind it), 'failed' (a
  // panel with the reason and a button back to the login screen) or null (gone)
  netBanner(state, info) {
    let b = this.netBox;
    if (!state) { b?.remove(); this.netBox = null; return; }
    if (!b || b.dataset.s !== state) {
      b?.remove();
      b = this.netBox = el('div', 'net-banner ' + state);
      b.dataset.s = state;
      b.innerHTML = state === 'failed'
        ? '<b>Disconnected</b><span class="nb-text"></span><button class="nb-back">Back to login</button>'
        : '<i class="nb-dot"></i><b>Reconnecting...</b><span class="nb-text"></span>';
      b.querySelector('.nb-back')?.addEventListener('click', () => location.reload());
      this.root.appendChild(b);
    }
    b.querySelector('.nb-text').textContent = state === 'failed'
      ? `${info || 'The connection to the server was lost.'} Your progress up to the drop is saved.`
      : info > 1 ? `attempt ${info}` : '';
  }

  // ======================================================== LOGIN
  showLogin(onEnter, onPreview) {
    const w = el('div', 'login');
    const test = /[?&]test=1/.test(location.search);
    const last = (() => { try { const l = JSON.parse(localStorage.getItem('sunmere:last') || '{}'); return l.name === 'Deskcheck' ? {} : l; } catch { return {}; } })();
    // test runs may pick the class: ?test=1&cls=deadeye (off-screen screenshots of a class)
    const qc = test ? /[?&]cls=(\w+)/.exec(location.search)?.[1] : null;
    let cls = (qc && CLASSES[qc] ? qc : null) || last.cls || 'knight', cv = last.cv || 0;
    // sign-in and the Local / Online choice (shown only when client/config.js sets them up)
    const hasOnline = !!AUTH.CONFIG.online, ACCT = AUTH.AUTH_ON || hasOnline;
    const srvSaved = (() => { try { return test ? {} : JSON.parse(localStorage.getItem('sunmere:srv') || '{}'); } catch { return {}; } })();
    // the browser build on GitHub Pages starts on Online (there is no local server there), unless the player picked Local
    let srv = hasOnline && (srvSaved.s === 'online' || (IS_WEB && srvSaved.s !== 'local')) ? 'online' : 'local', acct = null, busy = false;
    const SW = { knight: ['#2c4a9a', '#8a2626', '#2a6a3a'], warden: ['#2c4a9a', '#8a2626', '#2a6a3a'], ranger: ['#4f6e2a', '#7a4a24', '#46566a'], chemist: ['#4e2e62', '#245262', '#6a2a2a'], sandblade: ['#a32e2e', '#22608a', '#3a6e2a'], herbalist: ['#4f7a2a', '#2a6a6a', '#8a6a2a'], deadeye: ['#8a3a24', '#a8865a', '#2a7a78'] };
    w.innerHTML = `
      <div class="login-title"><div class="t1">Sunmere</div><div class="t2">Online</div></div>
      <div class="login-classes">${Object.entries(CLASSES).map(([id, c]) => `<button class="cls-card" data-c="${id}" style="--cc:${c.color}"><img src="${classArt(id)}"><span class="cn">${c.name}</span><span class="cr">${c.role}</span></button>`).join('')}</div>
      <div class="login-panel">
        <div class="cls-name"></div><div class="cls-role"></div><div class="cls-desc"></div><div class="cls-weapon"></div>
        <div class="cls-skills"></div>
        <div class="cls-colours"><label>Colours</label><div class="cv-row">${[0, 1, 2].map((i) => `<button class="cv" data-v="${i}"></button>`).join('')}</div></div>
        ${ACCT ? `<div class="login-acct">
          ${AUTH.AUTH_ON ? `<div class="acct-row"><button class="g-in">Sign in with Google</button><span class="acct-who hidden">Signed in as <b></b></span><button class="g-out hidden">Sign out</button></div>` : ''}
          ${hasOnline ? `<div class="srv-row"><label>Server</label><div class="srv-seg"><button data-s="local">${IS_WEB ? 'Offline' : 'Local'}</button><button data-s="online">Online</button></div><span class="srv-count hidden"></span></div>
          <input class="srv-in hidden" maxlength="200" placeholder="Online server address" value="">` : ''}
        </div>` : ''}
        <div class="login-chars"></div>
        <label>Character name</label>
        <input class="name-in" maxlength="14" placeholder="Enter a name" value="${last.name || ''}">
        <div class="login-err hidden"></div>
        <button class="enter-btn">Enter World</button>
        ${hasOnline ? '<button class="off-btn hidden">Play offline</button>' : ''}
        <div class="login-note">Follow the Main Story tracker on the right: Marshal Aldric is waiting for you in Sunmere.</div>
      </div>`;
    this.root.appendChild(w);
    const pick = (c) => {
      cls = c;
      w.querySelectorAll('.cls-card').forEach((b) => b.classList.toggle('on', b.dataset.c === c));
      const C = CLASSES[c];
      $('.cls-name', w).textContent = C.name; $('.cls-name', w).style.color = C.color;
      $('.cls-role', w).textContent = C.role; $('.cls-desc', w).textContent = C.desc; $('.cls-weapon', w).textContent = C.weapon + ' · ' + C.resource;
      $('.cls-skills', w).innerHTML = kitOf(c).map((s) => `<img title="${s.name}" src="${skillIcon(s)}">`).join('');
      w.querySelectorAll('.cv').forEach((b) => { b.style.background = SW[c][b.dataset.v]; b.classList.toggle('on', Number(b.dataset.v) === cv); });
      onPreview?.(c, cv);
    };
    w.addEventListener('click', (e) => { const b = e.target.closest('.cls-card'); if (b) pick(b.dataset.c); const v = e.target.closest('.cv'); if (v) { cv = Number(v.dataset.v); pick(cls); } });
    const err = (t) => { const e = $('.login-err', w); e.textContent = t || ''; e.classList.toggle('hidden', !t); };
    const srvAddr = () => ($('.srv-in', w)?.value.trim() || AUTH.CONFIG.online);
    const go = async (mode) => {
      if (busy) return;
      const name = $('.name-in', w).value.trim() || 'Hero';
      const online = hasOnline && (mode || srv) === 'online';
      if (!test) try { localStorage.setItem('sunmere:last', JSON.stringify({ name, cls, cv })); } catch {} // test runs never overwrite your last character
      const finish = () => { w.classList.add('out'); setTimeout(() => w.remove(), 500); };
      // not signed in, not online: straight in, exactly as before
      if (!online && !acct) { finish(); onEnter(name, cls, cv); return; }
      err('');
      const tok = acct ? await AUTH.token().catch(() => null) : null;
      // (?test=1&noauth=1: a test run joins a local test world that has sign-in off, without Google)
      if (online && !tok && !(test && /[?&]noauth=1/.test(location.search))) { err(AUTH.AUTH_ON ? 'Sign in with Google to play online.' : 'Online play needs sign-in, which is not set up.'); return; }
      const urls = online ? AUTH.serverUrls(srvAddr()) : null;
      if (online && !urls) { err('Type the online server address.'); return; }
      busy = true;
      const btn = $('.enter-btn', w), label = btn.textContent;
      btn.textContent = 'Entering...'; btn.disabled = true;
      try { await onEnter(name, cls, cv, { url: urls?.ws, token: tok, getToken: acct ? () => AUTH.token() : null }); finish(); }
      catch (e) { err(e?.message || String(e)); btn.textContent = label; btn.disabled = false; }
      finally { busy = false; }
    };
    $('.enter-btn', w).onclick = () => go();
    $('.name-in', w).addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); e.stopPropagation(); });
    pick(cls);
    // your saved characters: click to pick, double-click to enter (online: delete too, with a second click)
    let firstList = true;
    const showChars = (list, { online = false, note = '' } = {}) => {
      const box = $('.login-chars', w);
      if (!box) return;
      box.innerHTML = '';
      // (owner 20 Nov) character slots: your characters, then empty "New character" slots, at least 4 (8 at most)
      const slotsOn = online || list.length > 0;
      if (!slotsOn) { if (note) box.innerHTML = `<div class="chars-note">${note}</div>`; return; }
      if (list.length && firstList && !$('.name-in', w).value) { $('.name-in', w).value = list[0].name; if (CLASSES[list[0].cls] && !qc) pick(list[0].cls); } // (a test run's ?cls= wins)
      if (list.length) firstList = false;
      const shown = list.slice(0, 8), empty = Math.max(0, Math.min(8, Math.max(4, shown.length + 1)) - shown.length);
      box.innerHTML = `<label>${online ? 'Your characters online' : 'Your characters'}</label>`
        + shown.map((c) => `<div class="char-row"><button class="char-pick" data-n="${c.name}" data-c="${c.cls}" style="--cc:${CLASSES[c.cls]?.color || '#fff'}"><img src="${classArt(CLASSES[c.cls] ? c.cls : 'knight')}"><span><b>${c.name}</b><em>Level ${c.level} ${CLASSES[c.cls]?.name || ''}</em></span></button>${online ? `<button class="char-del" data-n="${c.name}" title="Delete this character">Delete</button>` : ''}</div>`).join('')
        + Array.from({ length: empty }, () => '<div class="char-row"><button class="char-pick char-new"><span class="char-plus">+</span><span><b>New character</b><em>Pick a class and a name</em></span></button></div>').join('')
        + (list.length ? '' : (note ? `<div class="chars-note">${note}</div>` : ''));
      box.querySelectorAll('.char-new').forEach((b) => {
        b.onclick = () => { const n = $('.name-in', w); n.value = ''; n.focus(); box.querySelectorAll('.char-pick').forEach((x) => x.classList.toggle('on', x === b)); };
      });
      box.querySelectorAll('.char-pick:not(.char-new)').forEach((b) => {
        b.onclick = () => { $('.name-in', w).value = b.dataset.n; if (CLASSES[b.dataset.c]) pick(b.dataset.c); box.querySelectorAll('.char-pick').forEach((x) => x.classList.toggle('on', x === b)); };
        b.ondblclick = () => { b.onclick(); go(); };
      });
      box.querySelectorAll('.char-del').forEach((b) => {
        b.onclick = async () => {
          if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'Sure?'; setTimeout(() => { b.classList.remove('sure'); b.textContent = 'Delete'; }, 3000); return; }
          const urls = AUTH.serverUrls(srvAddr()), tok = await AUTH.token().catch(() => null);
          try {
            const r = await fetch(`${urls.http}/api/characters/${encodeURIComponent(b.dataset.n)}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } });
            const j = await r.json().catch(() => ({}));
            err(r.ok ? '' : j.error || 'Could not delete that character.');
          } catch { err('Could not reach the online server.'); }
          loadChars();
        };
      });
    };
    const localList = () => {
      // offline play keeps its characters in this browser
      const list = [];
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k.startsWith('sunmere:') || k === 'sunmere:last' || k === 'sunmere:opts' || k === 'sunmere:srv') continue; const s = JSON.parse(localStorage.getItem(k)); if (s?.cls) list.push({ name: k.slice(8)[0].toUpperCase() + k.slice(9), cls: s.cls, level: s.level || 1 }); } } catch { /* nothing stored */ }
      return list;
    };
    let loadSeq = 0, countSeq = 0;
    // Online picked: how many players are in the online world right now (the server's /api/status, a number only)
    async function showCount(online) {
      const box = $('.srv-count', w), seq = ++countSeq;
      if (!box) return;
      if (!online) { box.classList.add('hidden'); return; }
      const urls = AUTH.serverUrls(srvAddr());
      if (!urls) { box.classList.add('hidden'); return; }
      try {
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(urls.http + '/api/status', { signal: ctl.signal }).finally(() => clearTimeout(to));
        const j = r.ok ? await r.json() : null;
        if (seq !== countSeq) return;
        const n = Number(j?.online);
        box.textContent = Number.isFinite(n) ? `${n} ${n === 1 ? 'player' : 'players'} online` : 'Server not answering';
        box.classList.toggle('off', !Number.isFinite(n));
      } catch { if (seq !== countSeq) return; box.textContent = 'Server not answering'; box.classList.add('off'); }
      box.classList.remove('hidden');
    }
    async function loadChars() {
      const seq = ++loadSeq, online = hasOnline && srv === 'online';
      showCount(online);
      const tok = acct ? await AUTH.token().catch(() => null) : null;
      const headers = tok ? { Authorization: 'Bearer ' + tok } : {};
      if (online) {
        if (!tok) { showChars([], { note: AUTH.AUTH_ON ? 'Sign in with Google to play online and see your characters.' : '' }); return; }
        const urls = AUTH.serverUrls(srvAddr());
        try {
          const r = await fetch(urls.http + '/api/characters', { headers });
          const list = r.ok ? await r.json() : [];
          if (seq === loadSeq) showChars(list, { online: true, note: r.ok ? 'No characters online yet: pick a class and a name to make one.' : 'The online server did not accept your sign-in. Sign out and in again.' });
        } catch { if (seq === loadSeq) showChars([], { note: 'Could not reach the online server.' }); }
        return;
      }
      if (IS_WEB) { showChars(localList()); return; } // no server next to the page: the characters saved in this browser
      fetch('/api/characters', { headers }).then((r) => (r.ok ? r.json() : [])).then((l) => { if (seq === loadSeq) showChars(l); }).catch(() => { if (seq === loadSeq) showChars(localList()); });
    }
    // the account row and the server choice
    const paintAcct = () => {
      if (!ACCT) return;
      $('.g-in', w)?.classList.toggle('hidden', !!acct);
      $('.acct-who', w)?.classList.toggle('hidden', !acct);
      $('.g-out', w)?.classList.toggle('hidden', !acct);
      if (acct && $('.acct-who b', w)) $('.acct-who b', w).textContent = acct.name;
      w.querySelectorAll('.srv-seg button').forEach((b) => b.classList.toggle('on', b.dataset.s === srv));
      $('.srv-in', w)?.classList.toggle('hidden', srv !== 'online' || IS_WEB); // the web build always uses the published address
      $('.off-btn', w)?.classList.toggle('hidden', srv !== 'online');
      $('.enter-btn', w).textContent = srv === 'online' ? 'Enter World Online' : 'Enter World';
    };
    if (ACCT) {
      if ($('.srv-in', w)) $('.srv-in', w).value = (srvSaved.addr && !/trycloudflare\.com/i.test(srvSaved.addr) ? srvSaved.addr : '') || AUTH.CONFIG.online;
      const keepSrv = () => { if (!test) try { localStorage.setItem('sunmere:srv', JSON.stringify({ s: srv, addr: $('.srv-in', w)?.value.trim() || '' })); } catch {} };
      w.querySelectorAll('.srv-seg button').forEach((b) => { b.onclick = () => { srv = b.dataset.s; keepSrv(); err(''); paintAcct(); loadChars(); }; });
      $('.srv-in', w)?.addEventListener('keydown', (e) => e.stopPropagation());
      $('.srv-in', w)?.addEventListener('change', () => { keepSrv(); loadChars(); });
      const off = $('.off-btn', w);
      if (off) off.onclick = () => { srv = 'local'; paintAcct(); go('local'); };
      const gin = $('.g-in', w);
      if (gin) gin.onclick = async () => {
        err(''); gin.disabled = true; gin.textContent = 'Opening Google...';
        try { acct = await AUTH.signIn(); paintAcct(); loadChars(); }
        catch (e) { err(e?.message || 'Sign-in did not finish.'); }
        finally { gin.disabled = false; gin.textContent = 'Sign in with Google'; }
      };
      const gout = $('.g-out', w);
      if (gout) gout.onclick = async () => { await AUTH.signOut(); acct = null; paintAcct(); loadChars(); };
      paintAcct();
    }
    if (AUTH.AUTH_ON) AUTH.init().then((a) => { acct = a; paintAcct(); loadChars(); }).catch(() => loadChars());
    else loadChars();
  }

  // ======================================================== HUD
  buildHUD() {
    const r = this.root;
    r.insertAdjacentHTML('beforeend', `
      <div class="hud">
        <div class="unit player-frame"><div class="portrait"><img><span class="lvl"></span></div><div class="bars"><div class="nm"></div><div class="bar hp"><i></i><span></span></div><div class="bar res"><i></i><span></span></div><div class="buffs"></div></div></div>
        <div class="unit target-frame hidden"><div class="portrait"><img><span class="lvl"></span></div><div class="bars"><div class="nm"></div><div class="bar hp"><i></i><span></span></div><div class="sub"></div><div class="buffs"></div></div></div>
        <div class="minimap"><div class="zone-name"></div><canvas width="200" height="200"></canvas><div class="mm-zoom"><button data-z="1" title="Zoom in (+)">+</button><button data-z="-1" title="Zoom out (-)">&minus;</button></div><div class="coords"></div><div class="post-note hidden">Post waiting</div><div class="dura hidden"></div></div>
        <div class="quest-tracker"></div>
        <div class="chat"><div class="chat-log"></div><input class="chat-in" maxlength="200" placeholder="Enter to chat (/s say, /p party, /w name whisper)"></div>
        <div class="castbar hidden"><i></i><span></span></div>
        <div class="actionbars"><div class="ab row3"></div><div class="ab row2"></div><div class="ab row1"></div></div>
        <div class="xpbar"><b class="rest"></b><i></i><span></span></div>
        <div class="menubar">
          <button data-w="char" title="Character (C)">C</button><button data-w="skills" title="Skills (K)">K</button><button data-w="quests" title="Quest Log (L)">L</button>
          <button data-w="talents" title="Skill Web (N)">N</button><button data-w="bags" title="Bags (B)">B</button><button data-w="ach" title="Achievements (Y)">Y</button><button data-w="journal" title="Valley Journal (J)">J</button><button data-w="map" title="World Map (M)">M</button><button data-w="recall" class="recall-btn" title="Homeward Compass (G)">G</button><button data-w="meter" title="Damage meter (U)">U</button><button data-w="social" title="Players: who is online, friends (/who)">P</button><button data-w="options" title="Options (O or Esc)">O</button><button data-w="help" title="Help (H)">?</button>
        </div>
        <div class="gold-box"></div>
        <div class="err-text"></div>
        <div class="prompt hidden"><span class="pk">F</span><span class="pt"></span></div>
        <div class="zone-banner"><div class="zb1"></div><div class="zb2"></div></div>
        <div class="ach-toasts"></div>
        <div class="party-frames"></div>
        <div class="invite-pop hidden"></div>
        <div class="tf-actions hidden"></div>
        <div class="death hidden"><div class="d1">You have fallen</div><button class="respawn">Return to Sunmere</button></div>
        <div class="plates"></div>
        <div class="floats"></div>
        <div class="offline-tag hidden">${IS_APP ? 'Offline · your world is saved on this device' : 'Offline mode · your world runs in this browser'}</div>
      </div>`);
    this.hud = $('.hud', r);
    r.style.setProperty('--ui-scale', SETTINGS.uiScale);
    this.combat = new CombatHud(this); // (S6: the morphing bar, pill, toast, dodge chip, pins, combo counter, poise bar)
    this.buildActionBars();
    // painted menu icons, with the hotkey letter kept small in the corner
    for (const b of r.querySelectorAll('.menubar button')) { const a = menuArt(b.dataset.w); if (a) { b.innerHTML = `<img src="${a}" alt=""><span>${b.textContent}</span>`; b.classList.add('mb-art'); } }
    $('.menubar', r).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.w === 'recall') return this.g.send({ t: 'recall' }); this.toggle(b.dataset.w); });
    $('.respawn', r).onclick = () => this.g.send({ t: 'respawn' });
    const chatIn = $('.chat-in', r);
    chatIn.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const t = chatIn.value.trim(); const links = (this.chatLinks || []).filter((L) => t.includes(`[${L.name}]`)).map((L) => (L.id ? { id: L.id } : { g: L.g })); if (t) this.g.send({ t: 'chat', text: t, links: links.length ? links : undefined }); chatIn.value = ''; this.chatLinks = []; chatIn.blur(); }
      if (e.key === 'Escape') chatIn.blur();
    });
    this.mini = $('.minimap canvas', r).getContext('2d');
    this.buildMinimapBase();
    $('.minimap canvas', r).addEventListener('click', () => this.toggle('map'));
    $('.mm-zoom', r).addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.miniZoom(Number(b.dataset.z)); });
    // target frame click: nothing; player frame click: target self
    $('.player-frame', r).addEventListener('click', () => this.g.setTarget(this.g.localId));
  }

  buildActionBars() {
    const cls = this.g.cls;
    const color = CLASSES[cls].color;
    const list = kitOf(cls); // (S2: the class's seven core skills)
    const rows = [$('.row1', this.root), $('.row2', this.root), $('.row3', this.root)];
    this.slots = [];
    list.forEach((s, i) => {
      // skills 21 to 30 (levels 42 to 65) sit on a short third row, a tab on the top right of the bars, on
      // their own keys (Q, E, T, V, X, P, [, ], ; and ' by default), so the bars keep their width and stay clear of the chat and the menu buttons
      const row = rows[i < 10 ? 0 : i < 20 ? 1 : 2];
      const b = el('div', 'slot');
      b.innerHTML = `<img src="${skillIcon(s)}"><div class="cd"></div><span class="key">${skillKeyLabel(i, true)}</span><span class="cdt"></span><div class="lock"><span>${s.lvl}</span></div>`;
      b.addEventListener('click', (e) => this.g.useSkill(s.id, { plain: SETTINGS.fuseAlt ? !e.altKey : e.altKey })); // (S6: Alt casts B plain; "fuse only with Alt" turns it round)
      b.addEventListener('mouseenter', (e) => this.showTip(e, b.dataset.fz ? this.fuseTip(b.dataset.fz, s) : this.skillTip(s)));
      b.addEventListener('mouseleave', () => this.hideTip());
      row.appendChild(b);
      this.slots.push({ s, el: b, cd: $('.cd', b), cdt: $('.cdt', b), lock: $('.lock', b) });
    });
    this.combat?.buildBar(this.slots, rows[0]);
    this.buildPotionSlot();
  }

  // the potion slot (desktop and browser; phones have their own potion and food buttons): just above the left end of the
  // bars, on its own key (, by default). Drag a consumable from the bags onto it to keep that one there
  // (SETTINGS.potion); empty or used up, it picks the best healing potion in the bags by itself. Right-click clears it.
  buildPotionSlot() {
    if (IS_TOUCH || this.pot) return;
    const bars = $('.actionbars', this.root);
    if (!bars) return;
    const b = el('div', 'slot potslot empty');
    b.innerHTML = '<img alt=""><div class="cd"></div><span class="key"></span><span class="cdt"></span><span class="pcnt"></span>';
    bars.appendChild(b);
    this.pot = { el: b, img: $('img', b), cd: $('.cd', b), cdt: $('.cdt', b), cnt: $('.pcnt', b), key: $('.key', b), id: null };
    b.addEventListener('click', () => this.usePotion());
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (SETTINGS.potion) { SETTINGS.potion = null; saveSettings(); this.hideTip(); } });
    b.addEventListener('mouseenter', (e) => this.showTip(e, this.potionTip()));
    b.addEventListener('mouseleave', () => this.hideTip());
    b.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('text/sunmere-use')) { e.preventDefault(); b.classList.add('drop'); } });
    b.addEventListener('dragleave', () => b.classList.remove('drop'));
    b.addEventListener('drop', (e) => {
      e.preventDefault(); b.classList.remove('drop');
      const id = e.dataTransfer.getData('text/sunmere-use');
      if (id && ITEMS[id]?.slot === 'use') { SETTINGS.potion = id; saveSettings(); this.pot.id = null; this.hideTip(); }
    });
  }
  // what the slot holds now: the chosen item if any are left in the bags, else the best healing potion
  potionPick() {
    const y = this.you, bag = y?.bag || [];
    const lvlOk = (d) => !d.lvl || d.lvl <= (y.level || 1);
    if (SETTINGS.potion) {
      let n = 0, i = -1;
      bag.forEach((it, k) => { if (it?.id === SETTINGS.potion && !it.gear) { n += it.n || 1; if (i < 0) i = k; } });
      const d = ITEMS[SETTINGS.potion];
      if (d) return { i, id: SETTINGS.potion, d, n, chosen: true, ok: i >= 0 && lvlOk(d) };
    }
    let best = null, bv = -1;
    bag.forEach((it, k) => {
      const d = itemDef(it), us = d?.use;
      if (!us || it.gear || d.slot !== 'use' || us.food || !(us.heal || us.res) || !lvlOk(d)) return;
      const v = (us.heal || 0) + (us.res || 0) * 0.5;
      if (v > bv) { bv = v; best = { i: k, id: it.id, d, n: 0, ok: true }; }
    });
    if (best) bag.forEach((it) => { if (it?.id === best.id && !it.gear) best.n += it.n || 1; });
    return best;
  }
  usePotion() {
    const p = this.potionPick();
    if (!p || !p.ok) { this.error(p ? `You have no ${p.d.name} left.` : 'You have no potion. Drag one from your bags onto the potion slot.'); return; }
    this.g.send({ t: 'use', slot: p.i }); this.g.sfx?.play('ui');
  }
  potionTip() {
    const p = this.potionPick(), k = keyLabel(keyFor('potion')) || 'no key';
    const head = `<div class="tt-name">Potion slot <span class="tt-sub">(${k})</span></div>`;
    const how = `<div class="tt-desc">Drag a potion or food from your bags here to keep it in the slot.${SETTINGS.potion ? ' Right-click to go back to your best potion.' : ' Empty, it uses your best healing potion.'}</div>`;
    return p ? head + this.itemTip({ id: p.id, n: p.n }, false) + how : head + how;
  }
  updatePotionSlot(now) {
    const P = this.pot;
    if (!P || !this.you) return;
    const p = this.potionPick(), id = p?.id || null;
    if (P.id !== id) { P.id = id; if (id) P.img.src = icon(p.d.icon || 'potion', '#3a3226', 64); else P.img.removeAttribute('src'); }
    P.el.classList.toggle('empty', !p);
    P.el.classList.toggle('nores', !!p && (!p.ok || p.n <= 0));
    P.el.classList.toggle('chosen', !!p?.chosen);
    const n = p ? p.n : 0, nt = n > 1 ? String(n) : '';
    if (P.cnt.textContent !== nt) P.cnt.textContent = nt;
    const kl = keyLabel(keyFor('potion')) || '';
    if (P.key.textContent !== kl) P.key.textContent = kl;
    const end = id ? this.you.cds?.['item:' + id] || 0 : 0, left = end - now;
    if (left > 0) { P.cd.style.background = `conic-gradient(rgba(0,0,0,0.72) ${Math.min(1, left / 30) * 360}deg, transparent 0)`; P.cdt.textContent = left > 1.5 ? Math.ceil(left) : ''; }
    else if (P.cdt.textContent || P.cd.style.background !== 'none') { P.cd.style.background = 'none'; P.cdt.textContent = ''; }
  }

  // the Fusion Book tab of the Skills window (S6), from an empty pin or the hint
  openBook() { this._skTab = 'book'; if (this.windows.skills?.isConnected) this.windows.skills.refresh(); else this.toggle('skills'); }
  // a morphed slot's tooltip: the fusion it would cast now, and what plain B would be
  fuseTip(fid, s) {
    const f = SKILL_BY_ID[fid], rec = (this.you?.web && this.eff?.[fid]) || f, known = (this.you?.fusions || []).includes(fid);
    if (!f) return this.skillTip(s);
    const C = CLASSES[this.you.cls];
    return `<div class="tt-name" style="color:#ffd88a">${known ? effName(rec) : 'A fusion not found yet'}</div><div class="tt-row"><span>${skillCost(SKILL_BY_ID[f.to] || s, this.tmods) + (rec.extra || 0)} ${C.resource}</span><span>${rec.cd}s cooldown</span></div><div class="tt-desc">${known ? rec.desc : f.hint || ''}</div><div class="tt-hint">${IS_TOUCH ? 'Two fingers' : SETTINGS.fuseAlt ? 'Without Alt' : 'Alt + key'}: ${s.name} plain</div>`;
  }
  skillTip(s) {
    const C = CLASSES[s.cls];
    const e = this.eff?.[s.id]; // (on the Web: the compiled record, renamed by a keystone as "Cinderfall (Stormfall)")
    const lines = [`<div class="tt-name" style="color:${C.color}">${e ? effName(e) : s.name}</div>`];
    if (e?.formName) lines.push(`<div class="tt-row"><span>Form: ${e.formName}</span><span></span></div>`);
    lines.push(`<div class="tt-row"><span>${skillCost(s, this.tmods)} ${C.resource}</span><span>${s.range ? s.range + ' yd range' : 'Self'}</span></div>`);
    lines.push(`<div class="tt-row"><span>${s.cast ? s.cast.toFixed(1) + ' sec cast' : s.channel ? 'Channeled' : 'Instant'}</span><span>${s.cd ? +skillCd(s, this.tmods).toFixed(1) + ' sec cooldown' : ''}</span></div>`);
    lines.push(`<div class="tt-desc">${s.desc}</div>`);
    if (this.you && s.lvl > this.you.level) lines.push(`<div class="tt-req">Requires level ${s.lvl}</div>`);
    return lines.join('');
  }
  itemTip(it, compare = true) {
    const d = itemDef(it);
    if (!d) return '';
    const q = d.q ?? 1, y = this.you, gearish = d.stats && GEAR_SLOTS.includes(d.slot);
    const pct = (k, v) => (STAT_PCT[k] ? `+${v}% ${STAT_NAME[k]}` : `+${v} ${STAT_NAME[k] || k}`);
    // lq: the rarity the piece was designed at (a Legendary weapon found as Rare keeps its Equip line and its voice)
    const up = upOf(d), lq = Math.max(q, d.tq ?? 0);
    const lines = [`<div class="tt-name q${q}" style="color:${QUALITY[q]}">${d.name}${up ? ` <span class="tt-rf">+${up}</span>` : ''}</div>`];
    if (q >= 4 && d.base) lines.push(`<div class="tt-base">${d.base}</div>`);
    if (gearish && q >= 2) lines.push(`<div class="tt-rar q${q}"><span style="color:${QUALITY[q]}">${QUALITY_NAME[q]}</span>${d.tq != null && d.tq !== q && d.tq >= 2 ? ` <em>(this piece is usually ${QUALITY_NAME[d.tq]})</em>` : ''}</div>`);
    else if (q === 5) lines.push(`<div class="tt-leg">Legendary</div>`);
    if (gearish && d.ilvl) lines.push(`<div class="tt-ilvl">Item Level ${d.ilvl}</div>`);
    if (gearish && q >= UPG.minQ) lines.push(`<div class="tt-upg${up >= UPG.max ? ' full' : ''}"><span>Upgrade +${up} / ${UPG.max}</span>${upPips(up)}</div>`);
    if (d.bd) lines.push('<div class="tt-sub tt-bound">Bound to you: it cannot be sent by post</div>');
    if (gearish) lines.push(`<div class="tt-row"><span>${SLOT_LABEL[d.slot] || d.slot}</span><span>${typeLine(d) || QUALITY_NAME[q]}</span></div>`);
    else if (d.slot === 'quest') lines.push(`<div class="tt-sub">Quest Item</div>`);
    else if (d.slot === 'junk') lines.push(`<div class="tt-sub">${(d.q ?? 1) === 0 ? 'Junk' : 'Trade Goods'}</div>`);
    if (d.stats) {
      const main = ['power', 'armor', 'hp'].filter((k) => d.stats[k]), extra = Object.keys(d.stats).filter((k) => !main.includes(k));
      for (const k of main) lines.push(`<div class="tt-stat">${pct(k, d.stats[k])}</div>`);
      for (const k of extra) lines.push(`<div class="tt-eq">${pct(k, d.stats[k])}</div>`);
    }
    if (d.power && lq >= 5) lines.push(`<div class="tt-eq">Equip: ${d.power}</div>`);
    if (d.sockets) for (const gm of d.sockets) lines.push(gm && GEMS[gm] ? `<div class="tt-sock full"><i class="gem-${GEMS[gm].color}"></i>${GEMS[gm].name}: ${Object.entries(GEMS[gm].stats).map(([k, v]) => pct(k, v)).join(', ')}</div>` : '<div class="tt-sock"><i></i>Empty Socket</div>');
    if (it?.gear && gearish) { const du = d.dur ?? 100; lines.push(du === 0 ? '<div class="tt-down">Broken: no stats until repaired</div>' : `<div class="tt-sub"${du < 30 ? ' style="color:#ffb040"' : ''}>Durability ${du} / 100</div>`); }
    if (d.classes && y) lines.push(`<div class="${d.classes.includes(y.cls) ? 'tt-sub' : 'tt-down'}">Classes: ${d.classes.map((c) => CLASSES[c]?.name || c).join(', ')}</div>`);
    if (d.req && y) lines.push(`<div class="${y.level >= d.req ? 'tt-sub' : 'tt-down'}">Requires Level ${d.req}</div>`);
    if (d.lvl && d.slot === 'use' && y) lines.push(`<div class="${y.level >= d.lvl ? 'tt-sub' : 'tt-down'}">Requires Level ${d.lvl}</div>`);
    if (d.desc) lines.push(`<div class="tt-desc">${lq >= 5 ? '' : '\u201c'}${d.desc}${lq >= 5 ? '' : '\u201d'}</div>`);
    if (d.set && SETS[d.set] && y) {
      const S = SETS[d.set], worn = new Set(Object.values(y.equip).filter((e) => e?.set === d.set).map((e) => e.id || e.name));
      const n = Object.values(y.equip).filter((e) => e?.set === d.set).length;
      lines.push(`<div class="tt-set"><div class="tt-setn">${S.name} (${n}/${S.pieces.length})</div>${S.pieces.map((id) => `<div class="${worn.has(id) || worn.has(ITEMS[id].name) ? 'tt-have' : 'tt-miss'}">${ITEMS[id].name}</div>`).join('')}${Object.entries(S.bonus).map(([k, fx]) => `<div class="${n >= Number(k) ? 'tt-up' : 'tt-miss'}">(${k}) Set: ${fx.map((e) => describeEffect(e)).join(', ')}</div>`).join('')}</div>`);
    }
    const value = it?.gear ? gearValue(it.gear) : d.price ? d.price * 3 : 0;
    if (value && d.slot !== 'quest') lines.push(`<div class="tt-sell">Sell Price: ${fmtMoney(value * (it?.n || 1))}</div>`);
    if (compare && gearish && y && y.equip[d.slot] && y.equip[d.slot] !== d) this._tipCmp = y.equip[d.slot];
    if (compare && gearish && y && !(d.classes && !d.classes.includes(y.cls))) {
      const cur = y.equip[d.slot];
      if (!cur) lines.push(`<div class="tt-cmp"><div class="tt-up">Empty slot: a straight upgrade</div></div>`);
      else if (cur !== d) {
        const keys = [...new Set([...Object.keys(d.stats), ...Object.keys(cur.stats || {})])];
        const rows = keys.map((k) => { const v = (d.stats[k] || 0) - (cur.stats?.[k] || 0); return v ? `<div class="${v > 0 ? 'tt-up' : 'tt-down'}">${v > 0 ? '+' : ''}${v}${STAT_PCT[k] ? '%' : ''} ${STAT_NAME[k] || k}</div>` : ''; }).join('');
        const better = gearScore(d) - gearScore(cur);
        lines.push(`<div class="tt-cmp"><div class="tt-sub">Compared with your <span style="color:${QUALITY[cur.q ?? 1]}">${gearName(cur)}</span>:</div>${rows || '<div class="tt-sub">No change</div>'}${better > 0.5 ? '<div class="tt-up tt-verdict">Upgrade</div>' : better < -0.5 ? '<div class="tt-down tt-verdict">Downgrade</div>' : ''}</div>`);
      }
    }
    return lines.join('');
  }
  showTip(e, html) {
    this.tip.innerHTML = html;
    this.tip.style.display = 'block';
    const r = e.currentTarget.getBoundingClientRect();
    const tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
    let x = r.right + 8, y = r.top - th - 6, side = 0;
    // inside a window (bags, character, vendor) the tip sits beside the window, level with the slot, so it never
    // covers the window's own header, tabs or neighbouring slots
    const win = e.currentTarget.closest?.('.window');
    if (win) {
      const wr = win.getBoundingClientRect();
      if (wr.right + 8 + tw < innerWidth - 8) { x = wr.right + 8; side = 1; } else if (wr.left - tw - 8 > 8) { x = wr.left - tw - 8; side = -1; }
      if (side) y = Math.max(8, Math.min(innerHeight - th - 8, r.top));
    }
    if (!side) {
      if (y < 8) y = r.bottom + 6;
      if (x + tw > innerWidth - 8) x = r.left - tw - 8;
    }
    this.tip.style.left = Math.max(8, x) + 'px'; this.tip.style.top = Math.max(8, y) + 'px';
    // what you are wearing in that slot, side by side (like WoW)
    const cmp = this._tipCmp; this._tipCmp = null;
    if (cmp) {
      this.tip2.innerHTML = '<div class="tt-cur">Currently Equipped</div>' + this.itemTip({ gear: cmp }, false);
      this._tipCmp = null;
      this.tip2.style.display = 'block';
      const t2w = this.tip2.offsetWidth, t2h = this.tip2.offsetHeight;
      const L = Math.max(8, x);
      let x2 = side === 1 && L + tw + 6 + t2w < innerWidth - 8 ? L + tw + 6 : L - t2w - 6;
      if (x2 < 8) x2 = L + tw + 6;
      this.tip2.style.left = x2 + 'px'; this.tip2.style.top = Math.max(8, Math.min(innerHeight - t2h - 8, Math.max(8, y))) + 'px';
    } else this.tip2.style.display = 'none';
  }
  hideTip() { this.tip.style.display = 'none'; if (this.tip2) this.tip2.style.display = 'none'; }

  // ======================================================== state updates
  setYou(you) {
    const first = !this.you;
    this.you = you;
    const C = CLASSES[you.cls];
    const pf = $('.player-frame', this.root);
    $('img', pf).src = classArt(you.cls);
    $('.lvl', pf).textContent = you.level;
    $('.nm', pf).textContent = you.name;
    $('.bar.res i', pf).style.background = `linear-gradient(180deg, ${C.resColor}, #3a2a10)`;
    $('.gold-box', this.root).innerHTML = fmtMoney(you.gold);
    {
      const eq = Object.values(you.equip).filter(Boolean), broke = eq.filter((g) => g.dur === 0).length, worn = eq.filter((g) => (g.dur ?? 100) < 30).length;
      const du = $('.dura', this.root);
      du.classList.toggle('hidden', !worn);
      du.classList.toggle('bad', broke > 0);
      du.innerHTML = broke ? `<img src="${miscArt('repair') || icon('hammer', '#5a1a14', 24)}"> ${broke} broken: repair at a merchant` : worn ? `<img src="${miscArt('repair') || icon('hammer', '#5a4214', 24)}"> Gear badly worn` : '';
      this._repaintRepair?.();
      if (this.windows.outfit?.isConnected) this.windows.outfit.refresh();
      $('.post-note', this.root).classList.toggle('hidden', !you.mailNew);
      { const pn = $('.post-note', this.root); pn.innerHTML = you.mailNew ? `<i class="pn-env"></i><b>${you.mailNew}</b><span>letter${you.mailNew > 1 ? 's' : ''} waiting</span>` : ''; pn.title = you.mailNew ? 'Collect your post from a Caravan Master' : ''; }
    }
    this.renderBuffs($('.buffs', pf), you.buffs);
    this.renderTracker();
    // a hero on the Skill Web (S3): its table, and its compiled kit with Forms, carry and keystone renames for the tooltips
    this.tmods = treeMods(you.cls, you.tree || {}, { forms: you.forms, done: you.done });
    this.eff = webEff(you, this.tmods);
    $('.menubar [data-w="talents"]', this.root)?.classList.toggle('has-pts', (you.treePts || 0) > 0);
    { const rb = $('.menubar .recall-btn', this.root), left = (you.recallReady || 0) - Date.now(); if (rb) { rb.title = `Homeward Compass (G): back to ${you.home || 'Sunmere Village'}${left > 0 ? ` · ready in ${Math.ceil(left / 60000)} min` : ''}`; rb.classList.toggle('cooling', left > 0); clearTimeout(this._recallT); if (left > 0) this._recallT = setTimeout(() => rb.classList.remove('cooling'), Math.min(left, 2 ** 31 - 1)); } }
    for (const k of Object.keys(this.windows)) if (this.windows[k]?.isConnected && this.windows[k].refresh) this.windows[k].refresh();
    // the player frame and the death panel follow every full update too (dying sends one, and no stat tick follows while dead)
    this.setStat(you);
  }
  setStat(s) {
    if (!this.you) return;
    Object.assign(this.you, s);
    const pf = $('.player-frame', this.root);
    const hp = this.you.hp / this.you.maxHp;
    $('.bar.hp i', pf).style.width = (hp * 100).toFixed(1) + '%';
    $('.bar.hp span', pf).textContent = `${Math.round(this.you.hp)} / ${this.you.maxHp}`;
    $('.bar.res i', pf).style.width = (this.you.res / this.you.maxRes * 100).toFixed(1) + '%';
    $('.bar.res span', pf).textContent = `${Math.round(this.you.res)} / ${this.you.maxRes}`;
    pf.classList.toggle('low', hp < 0.3);
    const xp = this.you.xp / this.you.xpNext;
    $('.xpbar i', this.root).style.width = (xp * 100).toFixed(1) + '%';
    const rest = Math.min(1, (this.you.xp + (this.you.rested || 0)) / this.you.xpNext);
    $('.xpbar .rest', this.root).style.width = (this.you.rested ? rest * 100 : 0).toFixed(1) + '%';
    $('.xpbar span', this.root).textContent = `Level ${this.you.level} · ${this.you.xp} / ${this.you.xpNext} XP${this.you.rested ? ` · rested ${this.you.rested.toLocaleString()}` : ''}`;
    $('.death', this.root).classList.toggle('hidden', !this.you.dead);
    if (this.you.dead && this.windows.pickup?.isConnected) { this.windows.pickup.remove(); this.windows.pickup = null; } // no looting while dead
    $('.hud', this.root)?.classList.toggle('is-dead', !!this.you.dead); // toasts move clear of the death panel
    if (this.you.dead) { const P = this.g.playerPos?.(), b = $('.death .respawn', this.root), a = P && areaOf(P.x, P.z), t = this.you.grave === 'the entrance' ? 'Return to the entrance' : a === 'reach' ? 'Return to Ashfall Landing' : a === 'rime' ? 'Return to the Icefall Landing' : a === 'heights' ? 'Return to the Windward Camp' : a === 'tidewater' ? 'Return to the Tidewrights’ Camp' : a === 'rainward' ? 'Return to the Seedwrights’ Camp' : a === 'weald' ? 'Return to the Woodwrights’ Camp' : this.you.grave ? `Return to ${this.you.grave}` : 'Return to Sunmere'; if (b && b.textContent !== t) b.textContent = t; }
  }
  renderBuffs(box, buffs = []) {
    box.innerHTML = buffs.slice(0, 10).map((b) => `<div class="buff ${b.debuff ? 'debuff' : ''}" title="${b.name}"><img src="${SKILL_BY_NAME[b.name] ? skillIcon(SKILL_BY_NAME[b.name]) : buffArt(b) || icon(b.icon || 'flask', b.debuff ? '#7a2a2a' : '#2a4a7a', 32)}"><span>${Math.ceil(b.t)}</span></div>`).join('');
  }

  // where you stand in the Main Story: { at, Q, C, state: active | ready | offer | level | end, have, need }
  storyNow() {
    const y = this.you;
    if (!y) return null;
    const at = storyAt(y.done || {});
    if (at.end) return { at, C: STORY[STORY.length - 1], state: 'end' };
    const Q = QUESTS[at.qid], C = STORY[at.ch], st = y.quests?.[at.qid];
    if (st) {
      const g = Q.goal, have = g.item || g.gather ? (y.bag || []).filter((b) => b.id === (g.item || g.gather)).reduce((a, b) => a + b.n, 0) : g.reach ? (st.n ? 1 : 0) : st.n, need = g.reach ? 1 : g.n;
      return { at, Q, C, state: have >= need ? 'ready' : 'active', have: Math.min(have, need), need };
    }
    return { at, Q, C, state: Q.lvl > y.level + 2 ? 'level' : 'offer' };
  }
  storyTrackerHtml(S) {
    const head = `<div class="msq-h">${CREST(S.state === 'ready' ? '?' : '!', S.state === 'level' || S.state === 'end')}<span>Main Story</span></div><div class="msq-ch">${S.state === 'end' ? 'All chapters complete' : `Chapter ${S.at.ch + 1}: ${S.C.name}`}</div>`;
    if (S.state === 'end') return `<div class="msq-box end" title="Open the Main Story">${head}<div class="msq-g">${STORY_NEXT.split('.')[0]}.</div></div>`;
    const Q = S.Q;
    const line = S.state === 'active' ? `- ${goalLine(Q)}${Q.goal.talk ? '' : `: ${S.have}/${S.need}`}`
      : S.state === 'ready' ? `- Return to ${npcName(Q.turnin)} (${npcPlace(Q.turnin)})`
      : S.state === 'offer' ? `- Speak with ${npcName(Q.giver)} (${npcPlace(Q.giver)})`
      : `- Reach level ${Q.lvl - 2} to continue (side quests, dungeons and bounties all help)`;
    return `<div class="msq-box ${S.state}" title="Open the Main Story">${head}<div class="msq-n">${Q.name}</div><div class="msq-g">${line}${S.state === 'ready' ? ' <b>(Complete)</b>' : ''}</div></div>`;
  }
  // the Russet Weald's "Clear the Rides" tally (ev 'rides', shared/rides.js): kept while it runs and for a little after
  setRides(ev) {
    // the first word of a gale's event: its painted banner (the galeride painting), once a gale
    const now = performance.now();
    if (ev.on && !this.scene && !(this.rides?.on && now - this.rides.at < 12000) && !(now - (this.ridesCardAt || -1e9) < 300000) && LOADING.has('galeride')) {
      this.ridesCardAt = now;
      this.bigCard({ art: 'galeride', top: 'Open event', title: 'Clear the Rides', sub: 'The gale is up: cut the fallen standards clear before it drops', secs: 6 });
    }
    this.rides = { ...ev, at: now };
    clearTimeout(this.ridesHide);
    if (!ev.on) this.ridesHide = setTimeout(() => this.renderTracker(), 15000);
    this.renderTracker();
  }
  ridesNow() {
    const R = this.rides;
    if (!R || this.g.world?.area !== 'weald') return null;
    if (!R.on && performance.now() - R.at > 14500) return null;
    if (R.on && performance.now() - R.at > 12000) return null; // (no word for a while: out of the wood or the event gone)
    return R;
  }
  ridesLine(R) {
    const n = R.cl.filter((c) => c > 0).length, left = Math.max(0, Math.round(R.left - (performance.now() - R.at) / 1000));
    return R.on ? `<b>Clear the Rides</b> ${n}/${R.cl.length} clear · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `<b>Clear the Rides</b> ${R.won ? 'won!' : 'over'}`;
  }
  ridesHtml(R) {
    const n = R.cl.filter((c) => c > 0).length, down = R.dn.filter((d, i) => d && !R.cl[i]).length;
    const left = Math.max(0, Math.round(R.left - (performance.now() - R.at) / 1000)), mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const marks = R.cl.map((c, i) => `<i class="${c ? 'ok' : R.dn[i] ? 'dn' : ''}"></i>`).join('');
    const head = `<div class="rides-h">Clear the Rides</div>`;
    if (!R.on) return `<div class="rides-box ${R.won ? 'won' : 'lost'}">${head}<div class="rides-g">${R.won ? 'Every ride is clear! Open the Woodwrights’ chest at the camp.' : 'The gale dropped with rides still blocked.'}</div><div class="rides-marks">${marks}</div></div>`;
    return `<div class="rides-box">${head}<div class="rides-marks">${marks}</div><div class="rides-g">- Rides clear: ${n}/${R.cl.length}${down ? ` (${down} blocked now)` : ''}</div><div class="rides-g">- Machines broken: ${R.br}</div><div class="rides-g">- The gale drops in ${mm}</div><div class="rides-g you">- Your part: ${R.you[0]} trunk${R.you[0] === 1 ? '' : 's'}, ${R.you[1]} machine${R.you[1] === 1 ? '' : 's'}${R.n ? ` · ${R.n} helping` : ''}</div></div>`;
  }
  // LF.6 the Ram Engine (ev 'ram', shared/ramEngine.js): its state near the yard road, ten times a second while it runs
  // (every two seconds while it stands); the tracker is redrawn at most once a second, or at once when something changes
  setRam(ev) {
    const now = performance.now();
    this.ram = { ...ev, at: now };
    const key = [ev.on, ev.end, ev.g.join(), ev.boss, ev.sh, ev.n, ev.dr].join('|');
    if (key !== this._ramKey || now - (this._ramT || 0) > 1000) { this._ramKey = key; this._ramT = now; this.renderTracker(); }
    clearTimeout(this.ramHide); this.ramHide = setTimeout(() => this.renderTracker(), 4000); // (out of hearing: the box goes)
  }
  // a run starts: its banner card (once a run)
  ramStart() {
    const now = performance.now();
    if (this.scene || now - (this.ramCardAt || -1e9) < 300000 || !LOADING.has('harrow')) return;
    this.ramCardAt = now;
    this.bigCard({ art: 'harrow', top: 'Open event', title: 'The Ram Engine', sub: 'Drive it down the yard road, load its ram and break the Wall-Layer’s gates', secs: 6 });
  }
  ramNow() {
    const R = this.ram;
    if (!R || performance.now() - R.at > 3500) return null;
    if (R.end && performance.now() - R.at > 3000) return null;
    return R;
  }
  ramLine(R) {
    const s = Math.max(0, Math.round((R.on ? R.left : R.next) - (performance.now() - R.at) / 1000)), mm = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (!R.on) return R.end ? `<b>The Ram Engine</b> ${R.won ? 'won!' : 'over'}` : `<b>The Ram Engine</b> next run in ${mm}`;
    const gd = R.g.filter((h) => h <= 0).length;
    return `<b>The Ram Engine</b> ${gd}/${R.g.length} gates · ${mm}`;
  }
  ramHtml(R) {
    const s = Math.max(0, Math.round((R.on ? R.left : R.next) - (performance.now() - R.at) / 1000)), mm = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const head = '<div class="rides-h">The Ram Engine</div>';
    if (R.end) return `<div class="rides-box ram-box ${R.won ? 'won' : 'lost'}">${head}<div class="rides-g">${R.won ? 'The Wall-Layer is broken! Open Yusuf’s chest by the engine’s park.' : 'The run is over: the Wall-Layer still stands.'}</div></div>`;
    if (!R.on) return `<div class="rides-box ram-box idle">${head}<div class="rides-g">- The crew raises steam on the world clock: the next run starts in ${mm}</div></div>`;
    const marks = R.g.map((h, i) => `<i class="${h <= 0 ? 'ok' : h < R.gm[i] ? 'dn' : ''}"></i>`).join('') + `<i class="${R.boss ? 'dn' : ''}"></i>`;
    const y = R.you || [0, 0, 0, 0, 0], part = [y[0] >= 5 ? `${y[0]} m driven` : '', y[1] ? `${y[1]} loaded` : '', y[2] ? `${y[2]} struck` : '', y[3] ? `${y[3]} repairs` : '', y[4] ? `${y[4]} machines` : ''].filter(Boolean).join(', ') || 'none yet';
    const gi = R.g.findIndex((h) => h > 0), what = gi >= 0 ? `Gate ${gi + 1} of ${R.g.length}: ${R.g[gi]}/${R.gm[gi]} left` : R.boss ? 'Break the Wall-Layer' : 'Both gates are down';
    return `<div class="rides-box ram-box">${head}<div class="rides-marks">${marks}</div><div class="rides-g">- ${what}</div><div class="rides-g">- Engine frame ${Math.round((100 * R.hp) / R.mh)}%${R.stall ? ' (stalled: repair it!)' : ''} · steam ${R.st} · weights ${R.w}</div><div class="rides-g">- ${R.dr ? `${R.dn}${R.db ? ' (bot)' : ''} at the levers` : 'The levers are free'}</div><div class="rides-g">- Time left ${mm}${R.br ? ` · ${R.br} menders broken` : ''}</div><div class="rides-g you">- Your part: ${part}${R.n ? ` · ${R.n} helping` : ''}</div></div>`;
  }
  renderTracker() {
    const box = $('.quest-tracker', this.root);
    const q = this.you?.quests || {};
    const S = this.storyNow();
    const all = Object.keys(q).filter((id) => id !== S?.at?.qid), ids = all.filter((id) => !this.untracked.has(id)).slice(0, 6), hidden = all.length - ids.length;
    box.innerHTML = (S && !this.untracked.has('msq') ? this.storyTrackerHtml(S) : '') + (ids.length || hidden ? '<div class="qt-h">Quests' + (hidden ? ` <span class="qt-more">+${hidden} more in the log</span>` : '') + '</div>' + ids.map((id) => {
      const Q = QUESTS[id], st = q[id];
      const g = Q.goal;
      const n = g.reach ? (st.n ? 1 : 0) : st.n, need = g.reach ? 1 : g.n;
      const done = n >= need;
      return `<div class="qt ${done ? 'done' : ''} ${Q.msq ? 'msq' : ''}" data-q="${id}" title="${IS_TOUCH ? 'Tap' : 'Click'} to open in the quest log"><div class="qt-n">${Q.msq ? CREST(done ? '?' : '!') : ''}${Q.name}</div><div class="qt-g">- ${goalLine(Q)}${g.talk ? '' : `: ${n}/${need}`}${done ? ' <b>(Complete)</b>' : ''}</div></div>`;
    }).join('') : '');
    const AT = this.ach ? this.achTracked.map((id) => ACH_BY_ID[id]).filter((a) => a && !this.ach.done?.[a.id]) : [];
    if (AT.length) box.insertAdjacentHTML('beforeend', '<div class="qt-h">Achievements</div>' + AT.map((a) => { const [h, n] = achProgress(a, this.ach.c, this.ach.done); return `<div class="qt at" data-a="${a.id}" title="${IS_TOUCH ? 'Tap' : 'Click'} to open your achievements"><div class="qt-n">${a.name}</div><div class="qt-g">- ${a.c === 'gold' ? `${Math.floor(h / 100)} / ${n / 100} silver` : `${h} / ${n}`}</div></div>`; }).join(''));
    box.querySelectorAll('.qt.at').forEach((e) => (e.onclick = () => { if (!this.windows.ach?.isConnected) this.toggle('ach'); }));
    // v109: a click (a tap) walks you to the quest (game/questwalk.js); a second click on the one you are walking to, or a
    // right click, opens it in the quest log as before
    const openLog = (id) => { this.questSel = id; this.questTab = 'log'; if (this.windows.quests?.isConnected) this.windows.quests.refresh(); else this.toggle('quests'); };
    const openStory = () => { this.questTab = 'story'; this.storySel = null; if (this.windows.quests?.isConnected) this.windows.quests.refresh(); else this.toggle('quests'); };
    const walking = this.g.qwalk?.qid;
    const walk = (id, orElse) => { if (!this.g.questWalk || walking === id) return orElse(); this.g.sfx?.play('ui'); if (this.g.questWalk(id)) this.g.touch?.toggleTracker?.(false); };
    box.querySelectorAll('.qt:not(.at)').forEach((e) => {
      e.title = `${IS_TOUCH ? 'Tap' : 'Click'} to walk there${IS_TOUCH ? '' : '; right-click'} to open in the quest log`;
      e.classList.toggle('qw-on', e.dataset.q === walking);
      e.onclick = () => walk(e.dataset.q, () => openLog(e.dataset.q));
      e.oncontextmenu = (ev) => { ev.preventDefault(); openLog(e.dataset.q); };
    });
    const mb = $('.msq-box', box);
    if (mb) {
      const sid = S?.at?.qid, canWalk = sid && ['active', 'ready', 'offer'].includes(S.state);
      if (canWalk) mb.title = `${IS_TOUCH ? 'Tap' : 'Click'} to walk there${IS_TOUCH ? '' : '; right-click to open the Main Story'}`;
      mb.classList.toggle('qw-on', !!sid && sid === walking);
      mb.onclick = () => (canWalk ? walk(sid, openStory) : openStory());
      mb.oncontextmenu = (ev) => { ev.preventDefault(); openStory(); };
    }
    // P15.3 Clear the Rides: the zone-wide tally at the very top of the tracker (and a small pill at the top on phones)
    { const R = this.ridesNow(), html = R ? this.ridesHtml(R) : ''; if (html) box.insertAdjacentHTML('afterbegin', html);
      let pill = $('.rides-pill', this.root);
      if (R && IS_TOUCH) { if (!pill) { pill = el('div', 'rides-pill', ''); (this.hud || this.root).appendChild(pill); } pill.innerHTML = this.ridesLine(R); }
      else pill?.remove(); }
    // LF.6 the Ram Engine: its tally (or its next run) at the top of the tracker near the yard road, a pill on phones
    { const R = this.ramNow(), html = R ? this.ramHtml(R) : ''; if (html) box.insertAdjacentHTML('afterbegin', html);
      let pill = $('.ram-pill', this.root);
      if (R && IS_TOUCH && (R.on || R.end)) { if (!pill) { pill = el('div', 'ram-pill', ''); (this.hud || this.root).appendChild(pill); } pill.innerHTML = this.ramLine(R); }
      else pill?.remove(); }
    // "Travelling to: ..." with a way to stop, at the top of the tracker (and pinned under the quest pill on phones)
    if (walking) box.insertAdjacentHTML('afterbegin', `<div class="qw-note"><span>Travelling to: <b>${QUESTS[walking]?.name || ''}</b></span><button class="qw-stop">Stop</button></div>`);
    let pin = $('.qw-pin', this.root);
    if (IS_TOUCH && walking) {
      if (!pin) { pin = el('div', 'qw-pin', ''); (this.hud || this.root).appendChild(pin); }
      pin.innerHTML = `<span>Travelling to: <b>${QUESTS[walking]?.name || ''}</b></span><button class="qw-stop">Stop</button>`;
    } else pin?.remove();
    this.root.querySelectorAll('.qw-stop').forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); this.g.questWalkStop?.(); }));
  }

  // a story scene: letterbox bars, the HUD steps aside, the camera closes in on you and the person you report to, and a
  // line of narration plays; any key or click skips it. The chapter card waits until it is over.
  // a story scene (by quest id), or a one-off: playScene(null, { text, x, z }) looks toward that point
  playScene(qid, one) {
    const Q = one ? { scene: one.text } : QUESTS[qid], rig = this.g.rig;
    if (!Q?.scene || !rig) return;
    this.endScene(true);
    const me = this.g.playerPos(), npcV = one ? null : this.g.entities.get(Q.turnin), n = one ? null : NPCS.find((x) => x.id === Q.turnin);
    const np = one ? new THREE.Vector3(one.x, me.y, one.z) : npcV ? npcV.pos : n ? new THREE.Vector3(n.x, me.y, n.z) : null;
    const S = { qid, saved: { yaw: rig.yawTarget, dist: rig.distTarget }, npcV, npcRy: npcV?.ryTarget, t0: performance.now() };
    if (np) {
      // look past your shoulder at them, from a little to the side, and drift round as the line plays
      const fwd = Math.atan2(-(np.x - me.x), -(np.z - me.z));
      rig.sceneFocus = new THREE.Vector3((me.x + np.x) / 2, me.y, (me.z + np.z) / 2);
      rig.yawTarget = fwd + 0.75; rig.distTarget = one ? 28 : 15; rig.pitchBiasTarget = one ? -0.1 : -0.32;
      S.drift = fwd + 0.35;
      if (npcV) npcV.ryTarget = Math.atan2(me.x - np.x, me.z - np.z);
    }
    const el2 = el('div', 'scene-bars', `<div class="sb-top"></div><div class="sb-bot"><div class="sb-line">${Q.scene}</div><div class="sb-skip">Press any key to skip</div></div>`);
    document.body.appendChild(el2);
    this.root.classList.add('in-scene');
    requestAnimationFrame(() => el2.classList.add('on'));
    setTimeout(() => el2.classList.add('say'), 900);
    const secs = Math.min(10, 4 + Q.scene.length * 0.045);
    S.el = el2;
    S.timers = [setTimeout(() => { if (S.drift != null && this.scene === S) rig.yawTarget = S.drift; }, 1600), setTimeout(() => this.endScene(), secs * 1000)];
    el2.onclick = () => this.endScene();
    this.scene = S;
  }
  endScene(quiet) {
    const S = this.scene, rig = this.g.rig;
    if (!S) return;
    this.scene = null;
    S.timers.forEach(clearTimeout);
    if (rig) { rig.sceneFocus = null; rig.yawTarget = S.saved.yaw; rig.distTarget = S.saved.dist; rig.pitchBiasTarget = 0; }
    if (S.npcV && S.npcRy != null) S.npcV.ryTarget = S.npcRy;
    S.el.classList.remove('on', 'say');
    setTimeout(() => S.el.remove(), 700);
    this.root.classList.remove('in-scene');
    const q = this.sceneQueue; this.sceneQueue = null;
    if (q && !quiet) setTimeout(q, 500);
  }

  // the Main Story's title cards: a new chapter begins, or one is complete
  storyCard(ev) {
    const C = STORY[ev.ch];
    if (!C) return;
    if (this.scene) { this.sceneQueue = () => this.storyCard(ev); return; }
    const end = ev.kind === 'end', next = STORY[ev.ch + 1];
    const newPart = !end && (ev.ch === 0 || STORY[ev.ch - 1].part !== C.part);
    this.bigCard({
      art: chapterArt(C),
      top: end ? 'Chapter Complete' : newPart ? `Part ${ROMAN[C.part]} \u00b7 ${STORY_PARTS[C.part]}` : 'Main Story',
      title: `Chapter ${ev.ch + 1}: ${C.name}`,
      sub: end ? (next ? `The story continues: Chapter ${ev.ch + 2}, ${next.name}` : STORY_NEXT) : C.blurb,
    });
    if (this.windows.quests?.isConnected) this.windows.quests.refresh();
  }
  // "Quest complete" across the screen when you hand a quest in (a story scene covers it instead)
  questDoneBanner(qid, pick = null) {
    const Q = QUESTS[qid];
    if (!Q || this.scene) return;
    this.qdoneEl?.remove();
    // the rewards laid out as cards under the title: coin, experience and the item you chose
    const cards = [];
    if (Q.gold) cards.push(`<div class="qd-card"><div class="qd-coin"></div><b>${fmtMoney(Q.gold * 10)}</b></div>`);
    if (Q.xp) cards.push(`<div class="qd-card"><div class="qd-xp">XP</div><b>${Q.xp.toLocaleString()}</b></div>`);
    const it = pick && ITEMS[pick];
    if (it) cards.push(`<div class="qd-card" style="--qc:${QUALITY[it.q ?? 1]}"><img src="${icon(it.icon, '#3a3226', 44)}"><b style="color:${QUALITY[it.q ?? 1]}">${it.name}</b></div>`);
    const b = el('div', 'qdone-banner' + (Q.msq ? ' msq' : ''), `<div class="qd1">${Q.msq ? CREST('?') : ''}Quest Complete</div><div class="qd2">${Q.name}</div>${cards.length ? `<div class="qd-cards">${cards.join('')}</div>` : ''}`);
    this.root.appendChild(b);
    this.qdoneEl = b;
    setTimeout(() => { if (b.isConnected) b.remove(); }, cards.length ? 4600 : 3600);
  }
  // after logging in mid-story: what happened last, and what comes next
  storyRecap() {
    const S = this.storyNow();
    if (!S || S.at.n === 0) return;
    const lastQ = QUESTS[MSQ_ORDER[S.at.n - 1]];
    const next = S.state === 'end' ? STORY_NEXT : S.state === 'ready' ? `Return to ${npcName(S.Q.turnin)} in ${npcPlace(S.Q.turnin)}.` : S.state === 'active' ? `${S.Q.name}: ${goalAsk(S.Q)}.` : S.state === 'level' ? `Reach level ${S.Q.lvl - 2} to continue.` : `Speak with ${npcName(S.Q.giver)} in ${npcPlace(S.Q.giver)}.`;
    const C = STORY[S.at.ch];
    const p = el('div', 'story-recap parch', `<div class="sr-h">${CREST()}<span>Previously in the Main Story</span><button class="sr-x" title="Close">\u00d7</button></div><div class="sr-ch">Chapter ${S.at.ch + 1}: ${C.name}</div><p>${lastQ.recap}</p><div class="sr-next"><b>Next:</b> ${next}</div>`);
    this.root.appendChild(p);
    const close = () => { p.classList.add('out'); setTimeout(() => p.remove(), 600); };
    $('.sr-x', p).onclick = close;
    p.onclick = (e) => { if (e.target.classList.contains('sr-x')) return; this.questTab = 'story'; this.storySel = null; close(); if (!this.windows.quests?.isConnected) this.toggle('quests'); else this.windows.quests.refresh(); };
    setTimeout(() => { if (p.isConnected) close(); }, 16000);
  }

  // a named piece went onto the Armory shelf (the server also says so in chat)
  onFound(id) {
    if (this.ach?.c && !this.ach.c['found:' + id]) { this.ach.c['found:' + id] = 1; this.ach.c.found = (this.ach.c.found || 0) + 1; }
    if (this.windows.journal?.isConnected) this.windows.journal.refresh();
  }
  // the first time you find a region that has a painting
  discoverCard(zone) {
    const art = REGION_ART[zone], z = ZONES.find((x) => x.id === zone);
    if (!art || !z) return;
    this.cardUntil = performance.now() + 6200;
    $('.zone-banner', this.root)?.classList.remove('show');
    this.bigCard({ art, top: 'Discovered', title: z.name, sub: z.level ? `Level ${z.level}` : '', secs: 6 });
  }
  // a painted banner across the middle of the screen (story chapters, regions found for the first time)
  bigCard({ art, top, title, sub, secs = 7 }) {
    this.bigCardEl?.remove();
    const c = el('div', 'story-card', `<div class="sc-art" style="background-image:url('/sunmere-play/ui/loading/${art}.webp')"></div><div class="sc-txt"><div class="sc-top">${top || ''}</div><div class="sc-title">${title}</div><div class="sc-sub">${sub || ''}</div></div>`);
    c.style.animationDuration = secs + 's';
    this.root.appendChild(c);
    this.bigCardEl = c;
    setTimeout(() => { if (c.isConnected) c.remove(); }, secs * 1000 + 200);
  }

  // shift-click an item: its [link] goes into the chat box (static items by id, rolled pieces as they are)
  linkItem(it) {
    const d = it?.gear || (it?.id ? ITEMS[it.id] : null);
    if (!d?.name) return;
    const chatIn = $('.chat-in', this.root);
    if (!chatIn) return;
    // a piece is linked as it is when it differs from its template: upgraded, or found at another rarity
    const plain = it.gear && it.gear.id && ITEMS[it.gear.id] && !upOf(it.gear) && (it.gear.q ?? 1) === (ITEMS[it.gear.id].q ?? 1);
    const L = it.gear && !plain ? { name: gearName(d), g: it.gear } : { name: d.name, id: it.id || it.gear?.id };
    (this.chatLinks ||= []).push(L);
    const tag = `[${gearName(d)}]`, pos = chatIn.selectionStart ?? chatIn.value.length;
    chatIn.focus();
    chatIn.value = (chatIn.value.slice(0, pos) + (pos && chatIn.value[pos - 1] !== ' ' ? ' ' : '') + tag + ' ' + chatIn.value.slice(pos)).slice(0, 200);
    chatIn.setSelectionRange(chatIn.value.length, chatIn.value.length);
  }
  // walk-up interaction prompt
  setPrompt(it) {
    const el2 = $('.prompt', this.root);
    if (!el2) return;
    let text = '';
    if (it?.door) text = it.door.label + (it.door.level ? ` (Level ${it.door.level})` : '');
    else if (it?.qobj) text = OBJECT_KINDS[it.qobj.kind].prompt;
    else if (it?.node) text = (it.node.item === 'c37_block' ? 'Chip out ' : 'Gather ') + (ITEMS[it.node.item]?.name || 'Mosscap');
    else if (it?.salvage) text = waterKind(it.salvage.x, it.salvage.z) === 'sea' ? 'Cast your fishing line' : 'Cast your salvage hook';
    else if (it?.sail) text = it.label;
    else if (it?.ram) text = it.label; // the Ram Engine's walk-up actions (game/ramEvent.js)
    else if (it?.ty === 'n') text = this.windows.dialog?.isConnected && this.windows.dialog._npc === it.id ? '' : `Talk to ${it.name}`; // (not while you are already talking)
    else if (it?.ty === 'm') text = 'Loot';
    if (text !== this._prompt) { this._prompt = text; $('.pt', el2).textContent = text; el2.classList.toggle('hidden', !text); }
  }

  // ======================================================== events
  chat(text, color = '#f4ead2', from, links) {
    const log = $('.chat-log', this.root);
    if (!log) return;
    // the backing fades in on new lines (and on hover), then fades back out
    log.classList.add('live'); clearTimeout(this._chatLiveT); this._chatLiveT = setTimeout(() => log.classList.remove('live'), 6000);
    // fold repeated system lines within 10 s into one: "Your gear is worn (x3)"
    const now = performance.now(), last = log.lastElementChild;
    if (!from && !links && last && last._raw === text && last._col === color && now - last._t < 10000) {
      last._n = (last._n || 1) + 1; last._t = now;
      let n = last.querySelector('.cl-n'); if (!n) { n = el('span', 'cl-n'); last.appendChild(n); }
      n.textContent = ` (x${last._n})`;
      log.scrollTop = log.scrollHeight;
      return;
    }
    const line = el('div', 'cl');
    if (!from && !links) { line._raw = text; line._col = color; line._t = now; }
    line.style.color = color;
    let body = from ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;') : text;
    const L = (links || []).map((k) => (k.id && ITEMS[k.id] ? { id: k.id, d: ITEMS[k.id] } : k.g ? { g: k.g, d: k.g } : null)).filter(Boolean);
    L.forEach((k, i) => { const nm = String(gearName(k.d)).replace(/&/g, '&amp;').replace(/</g, '&lt;'); body = body.split(`[${nm}]`).join(`<span class="clink" data-k="${i}" style="color:${QUALITY[k.d.q ?? 1] || '#fff'}">[${nm}]</span>`); });
    line.innerHTML = from ? `<b>[${from}]</b>: ${body}` : body;
    line.querySelectorAll('.clink').forEach((s) => { const k = L[Number(s.dataset.k)]; s.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip(k.id ? { id: k.id } : { gear: k.g }, false))); s.addEventListener('mouseleave', () => this.hideTip()); });
    log.appendChild(line);
    while (log.children.length > 80) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  error(text) {
    const e = $('.err-text', this.root);
    e.textContent = text; e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
    this.g.sfx?.play('ui');
  }
  // a short fade to black and back (doors, long teleports)
  fade() {
    let f = document.querySelector('.tp-fade');
    if (!f) { f = document.createElement('div'); f.className = 'tp-fade'; Object.assign(f.style, { position: 'fixed', inset: '0', background: '#000', pointerEvents: 'none', zIndex: 50, opacity: '0' }); document.body.appendChild(f); }
    f.style.transition = 'none'; f.style.opacity = '1'; void f.offsetWidth;
    f.style.transition = 'opacity 0.9s ease-out 0.25s'; f.style.opacity = '0';
  }
  zoneBanner(name, sub) {
    const b = $('.zone-banner', this.root);
    $('.zb1', b).textContent = name; $('.zb2', b).textContent = sub || '';
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  floatText(pos, text, cls = '', crit = false) {
    const d = el('div', 'ft ' + cls + (crit ? ' crit' : ''), text);
    $('.floats', this.root).appendChild(d);
    // rapid hits fan out to alternating sides along a short arc instead of stacking
    const dmg = cls === 'dmg-out' || cls === 'dmg-in';
    this._fan = ((this._fan || 0) + 1) % 4;
    const side = this._fan % 2 ? 1 : -1, reach = dmg ? 40 + (this._fan >> 1) * 34 + Math.random() * 16 : (Math.random() - 0.5) * 40;
    this.floats.push({ el: d, pos: pos.clone(), t: 0, dur: crit ? 1.6 : 1.2, dx: dmg ? side * reach : reach, dy: dmg ? -(this._fan >> 1) * 22 - (crit ? 18 : 0) : 0, pop: dmg || crit, crit });
  }

  // ======================================================== windows
  toggle(name) {
    if (this.windows[name]?.isConnected) { this.windows[name].remove(); this.windows[name] = null; this.g.sfx?.play('ui'); return; }
    const fn = { char: () => this.winChar(), bags: () => this.winBags(), quests: () => this.winQuests(), skills: () => this.winSkills(), talents: () => this.winTalents(), ach: () => this.winAch(), journal: () => this.winJournal(), options: () => this.winOptions(), map: () => this.winMap(), help: () => this.winHelp(), meter: () => this.winMeter(), news: () => this.winNews(), loot: () => this.winLoot() }[name];
    if (fn) { this.windows[name] = fn(); this.g.sfx?.play('ui'); }
  }
  closeAll() { for (const k of Object.keys(this.windows)) { this.windows[k]?.remove(); this.windows[k] = null; } this.hideTip(); }
  makeWindow(title, cls, x, y) {
    const w = el('div', 'window ' + cls);
    w.innerHTML = `<div class="wh"><span>${title}</span><button class="wx">✕</button></div><div class="wb"></div>`;
    w.style.left = x + 'px'; w.style.top = y + 'px';
    $('.wx', w).onclick = () => { w.remove(); this.hideTip(); };
    // drag by header
    const h = $('.wh', w);
    h.addEventListener('pointerdown', (e) => {
      const ox = e.clientX - w.offsetLeft, oy = e.clientY - w.offsetTop;
      const mv = (ev) => { w.style.left = ev.clientX - ox + 'px'; w.style.top = ev.clientY - oy + 'px'; };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
    this.root.appendChild(w);
    return w;
  }

  // the paper doll: a small renderer of its own showing your character, turned by dragging (or the round buttons under it)
  dollStart(canvas, y) {
    if (!canvas) return;
    // render at the size the stage really shows (the window may be scaled), so the figure is never blurred or squashed
    { const r = canvas.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); if (r.width > 20 && r.height > 20) { const k = Math.min(1, 1400 / Math.max(r.width * d, r.height * d)); canvas.width = Math.round(r.width * d * k); canvas.height = Math.round(r.height * d * k); } }
    const W = canvas.width, H = canvas.height;
    const R = this._dollR ||= (() => {
      const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.18;
      return r;
    })();
    R.setSize(W, H, false);
    const scene = new THREE.Scene();
    scene.environment = this.g.engine?.scene?.environment || null; scene.environmentIntensity = 0.6;
    scene.add(new THREE.HemisphereLight(0xfff2dc, 0x3a2e22, 1.4));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.4); key.position.set(2, 4, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ae8ff, 1.6); rim.position.set(-3, 2, -3); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xe8eef4, 0.9); fill.position.set(-2, 1.4, 4); scene.add(fill);
    const ch = buildCharacter(y.cls, y.cv || 0);
    { const L = wornLook(y); setCharWeapon(ch, L.wt, L.wq, L.oh, L.wu, L.ou); setCharArmor(ch, L.sh); setCharCape(ch, L.ck); setCharGear(ch, L.gr); }
    scene.add(ch);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.7, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.01; scene.add(disc);
    // the camera backs off until about 1.75 units fit across (aimed a touch to the side the back gear swings to), so a cloak or shield on the back never leaves the frame
    const cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 50);
    cam.position.set(0.1, 1.2, Math.max(5.15, 1.75 / (0.4617 * (W / H)))); cam.lookAt(0.1, 1.0, 0);
    const anim = new Animator(ch, y.cls);
    const ctx = canvas.getContext('2d');
    // the turn survives refreshes (every update rebuilds the window); the buttons ease towards their aim
    const HOME = 0.28;
    let aim = this._dollYaw ?? HOME, yaw = aim, drag = null, t0 = performance.now(), run = true;
    canvas.onpointerdown = (e) => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); canvas.classList.add('held'); };
    canvas.onpointermove = (e) => { if (drag !== null) { aim += (e.clientX - drag) * 0.012; yaw = aim; drag = e.clientX; this._dollYaw = aim; } };
    canvas.onpointerup = canvas.onpointercancel = () => { drag = null; canvas.classList.remove('held'); };
    this.dollCtl = { turn: (d) => { aim += d; this._dollYaw = aim; }, reset: () => { aim = HOME + Math.round((yaw - HOME) / (Math.PI * 2)) * Math.PI * 2; this._dollYaw = aim; } };
    const loop = (now) => {
      if (!run || !canvas.isConnected) return;
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      anim.update(dt, { speed: 0, turnRate: 0, combat: false });
      yaw += (aim - yaw) * Math.min(1, dt * 7);
      ch.rotation.y = yaw;
      R.render(scene, cam);
      ctx.clearRect(0, 0, W, H); ctx.drawImage(R.domElement, 0, 0);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    this.dollStop = () => { run = false; scene.traverse((o) => { if (o.geometry && o !== disc) disposeCharGeometry(o.geometry); }); };
  }

  // ======================================================== the character window
  // A tabbed sheet in the spirit of a modern MMO: Equipment (sets, paper doll, stats), Attributes, Wardrobe, Reputation, Guild & Pets
  winChar() {
    const W0 = 980, H0 = 664;
    const w = this.makeWindow('Character', 'w-char', 0, 0);
    // one size everywhere: centred, and scaled down as a whole on small screens
    // big screens get a larger sheet (up to 120%), small ones a smaller one; it always leaves room round the edges
    let s = Math.min(1.2, (innerWidth - 24) / W0, (innerHeight - 24) / H0);
    if (s > 1) s = Math.max(1, Math.min(s, (innerWidth - 360) / W0, (innerHeight - 200) / H0));
    if (s !== 1) { w.style.transform = `scale(${s.toFixed(3)})`; w.style.transformOrigin = '0 0'; }
    w.style.left = Math.max(12, Math.round((innerWidth - W0 * s) / 2)) + 'px';
    w.style.top = Math.max(12, Math.round((innerHeight - H0 * s) / 2 - 10 * s)) + 'px';
    const TABS = [['gear', 'Equipment'], ['attr', 'Attributes'], ['look', 'Wardrobe'], ['rep', 'Reputation'], ['guild', 'Guild & Pets']];
    if (isPhone()) TABS.splice(1, 0, ['stats', 'Stats']); // a phone: the stats column gets its own tab
    const bar = el('div', 'cw-tabs', TABS.map(([k, n]) => `<button data-ct="${k}"><span>${n}</span></button>`).join(''));
    w.insertBefore(bar, $('.wb', w));
    bar.querySelectorAll('button').forEach((b) => (b.onclick = () => { if ((this.charTab || 'gear') === b.dataset.ct) return; this.charTab = b.dataset.ct; this.hideTip(); this.g.sfx?.play('ui'); w.refresh(true); }));
    w.refresh = (anim) => {
      const y = this.you, C = CLASSES[y.cls], tab = this.charTab || 'gear';
      this.dollStop?.(); this.dollStop = null; this.dollCtl = null;
      bar.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.ct === tab));
      const wb = $('.wb', w);
      // panes that scroll keep their place across the frequent refreshes
      const scrolls = [...wb.querySelectorAll('.cw-scroll')].map((e) => e.scrollTop);
      wb.className = 'wb cw-pane cw-p-' + tab;
      wb.innerHTML = { gear: () => (isPhone() ? this.charGearPhone(y, C) : this.charGearHtml(y, C)), stats: () => this.charStatsPhone(y, C), attr: () => this.charAttrHtml(y, C), look: () => this.charLookHtml(y, C), rep: () => this.charRepHtml(y), guild: () => this.charGuildHtml(y) }[tab]();
      if (anim) { wb.classList.add('cw-in'); setTimeout(() => wb.classList.remove('cw-in'), 260); }
      if (!anim) wb.querySelectorAll('.cw-scroll').forEach((e, i) => { if (scrolls[i]) e.scrollTop = scrolls[i]; });
      this.charWire(w, y, tab);
    };
    w.refresh(true);
    return w;
  }
  // the little pieces every pane shares
  charBits(y) {
    const C = CLASSES[y.cls];
    const crest = `<img src="${classArt(y.cls)}" alt="">`;
    // average over the pieces you actually wear (a fresh character in one starter piece reads its level, not 0.2)
    const worn = GEAR_SLOTS.filter((s) => y.equip[s]?.ilvl), ilvl = worn.length ? worn.reduce((a, s) => a + y.equip[s].ilvl, 0) / worn.length : 0;
    const gem = '<svg class="cw-gem" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3H18L23 9H1Z" fill="#a6f4ea"/><path d="M1 9H23L12 22Z" fill="#2fb5a6"/><path d="M7.5 9L12 22L16.5 9Z" fill="#5fe0d0"/><path d="M6 3L7.5 9L12 3L16.5 9L18 3" stroke="#eafffb" stroke-width=".7" fill="none" opacity=".75"/></svg>';
    const durCol = (d) => (d === 0 ? '#ff3020' : d < 30 ? '#ff8a2a' : d < 60 ? '#e8c26a' : '#5ad66a');
    const tile = (sl, side) => {
      const it = y.equip[sl];
      if (!it) return `<div class="eslot cw-slot empty ${side}" data-s="${sl}" title="${SLOT_LABEL[sl]}">${slotGlyph(sl)}<span class="es-lab">${SLOT_LABEL[sl]}</span></div>`;
      const q = it.q ?? 1, dur = it.dur ?? 100;
      return `<div class="eslot cw-slot q${q} ${side}${dur === 0 ? ' broke' : ''}" data-s="${sl}" style="--qc:${QUALITY[q]}"><img src="${icon(it.icon || sl, '#3a3226', 64)}" style="border-color:${dur === 0 ? '#ff3020' : QUALITY[q]}" class="${dur === 0 ? 'broken' : dur < 30 ? 'worn' : ''}">${it.ilvl ? `<span class="es-il">${it.ilvl}</span>` : ''}${upOf(it) ? `<span class="es-up">+${upOf(it)}</span>` : ''}<span class="es-dur"><i style="height:${dur}%;background:${durCol(dur)}"></i></span></div>`;
    };
    return { C, crest, ilvl, gem, tile, durCol, title: ACH_BY_ID[y.title]?.title || '' };
  }
  charStage(y, cols) {
    const { tile } = this.charBits(y);
    const L = cols ? ['head', 'shoulders', 'chest', 'legs', 'feet'] : null, Rt = cols ? ['weapon', 'offhand', 'hands', 'back', 'trinket'] : null;
    return `<div class="cw-stage">${L ? `<div class="cw-col">${L.map((sl) => tile(sl, 'l')).join('')}</div>` : ''}<div class="cw-doll"><div class="cw-floor"></div><canvas width="432" height="624"></canvas><div class="doll-hint">Drag to turn</div></div>${Rt ? `<div class="cw-col">${Rt.map((sl) => tile(sl, 'r')).join('')}</div>` : ''}</div>`;
  }
  charGearHtml(y, C) {
    const B = this.charBits(y);
    const xpPct = y.level >= LEVEL_CAP ? 100 : (100 * y.xp) / Math.max(1, y.xpNext), restPct = y.rested && y.level < LEVEL_CAP ? Math.min(100, (100 * (y.xp + y.rested)) / Math.max(1, y.xpNext)) : 0;
    // the two loadouts (level 10): each keeps its own Skill Web tree and Forms, remembers its gear and puts it back on
    let sets = '';
    if (y.level >= 2) {
      const lo = y.lo || 0, places = (i) => (i === lo ? Object.keys(y.tree || {}).length : y.webSets?.[i] || 0);
      sets = `<h5 class="cw-h" title="Switching loadouts changes your Skill Web and puts back on the gear that loadout last wore">Loadouts <span>${IS_TOUCH ? 'tap' : 'click'} to switch</span></h5><div class="cw-sets">${[0, 1].map((i) => {
        const n = places(i), locked = i !== lo && y.level < 10;
        const right = i === lo ? `${B.gem}<b>${Math.round(B.ilvl)}</b>` : y.lgear?.[i] ? `<em>${y.lgear[i]} pieces</em>` : '';
        return `<div class="cw-set ${i === lo ? 'on' : ''} ${locked ? 'locked' : ''}" data-i="${i}" title="${locked ? 'A second loadout opens at level 10' : i === lo ? 'The loadout you are using' : 'Switch to this loadout (its Skill Web and the gear it last wore)'}"><span class="cw-sn">${i + 1}</span><span class="cw-sic"><img src="${classArt(y.cls)}" alt=""></span><div class="cw-st"><b>${n ? `Skill Web: ${n} place${n > 1 ? 's' : ''}` : 'Skill Web: empty'}</b><em>${i === lo && y.treePts ? `${y.treePts} point${y.treePts > 1 ? 's' : ''} to spend` : i !== lo && !y.lgear?.[i] ? 'Empty: no gear saved' : ''}</em></div><span class="cw-sil">${right}</span></div>`;
      }).join('')}</div>`;
    }
    const left = `<aside class="cw-left"><div class="cw-card"><div class="cw-cc"><span class="cw-crest" style="--cc:${C.color}">${B.crest}</span><div class="cw-who"><b style="color:${C.color}">${y.name}</b>${B.title ? `<i>${B.title}</i>` : ''}<em>${C.role}</em></div></div>
      <div class="cw-lvl"><span>Level <b>${y.level}</b></span><span>${y.level >= LEVEL_CAP ? 'Highest level' : `${y.xp.toLocaleString()} / ${y.xpNext.toLocaleString()} XP`}</span></div>
      <div class="cw-xp"><i class="rest" style="width:${restPct.toFixed(1)}%"></i><i style="width:${xpPct.toFixed(1)}%"></i></div>
      <div class="cw-rested ${y.rested ? 'on' : ''}">${y.rested ? `Rested: ${y.rested.toLocaleString()} bonus XP` : 'Not rested'}</div>
      <div class="cw-home">Home: <b>${y.home || 'Sunmere Village'}</b></div></div>${sets}${(() => {
      // how worn the gear is: one gauge for the lot, and what needs a merchant's hammer
      const eq = GEAR_SLOTS.map((sl) => y.equip[sl]).filter(Boolean);
      if (!eq.length) return '';
      const avg = eq.reduce((a, g) => a + (g.dur ?? 100), 0) / eq.length, broke = eq.filter((g) => g.dur === 0).length, worn = eq.filter((g) => (g.dur ?? 100) > 0 && (g.dur ?? 100) < 30).length;
      return `<h5 class="cw-h cw-condh">Gear Condition <span>${Math.round(avg)}%</span></h5><div class="cw-cond"><i style="width:${avg.toFixed(0)}%;background:${B.durCol(Math.round(avg))}"></i></div>${broke || worn ? `<div class="cw-note ${broke ? 'bad' : ''}">${broke ? `${broke} broken piece${broke > 1 ? 's give' : ' gives'} no stats: repair at a merchant.` : `${worn} piece${worn > 1 ? 's are' : ' is'} badly worn: repair soon.`}</div>` : ''}`;
    })()}${this.charSetsHtml(y)}<div class="cw-gold"><span class="bg-coin"></span><span>Gold</span><b>${fmtMoney(y.gold)}</b></div></aside>`;
    const RB = (k, tip, d) => `<button class="cw-rb" data-b="${k}" title="${tip}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg></button>`;
    const mid = `<section class="cw-mid"><div class="cw-head"><span class="cw-hcrest" style="--cc:${C.color}">${B.crest}</span><div class="cw-hl"><em>Level ${y.level}</em><b>${C.name}</b></div><div class="cw-hn"><b>${y.name}</b>${y.guild ? `<i>&lt;${y.guild.name}&gt;</i>` : B.title ? `<i>${B.title}</i>` : ''}</div></div>
      ${this.charStage(y, true)}
      <div class="cw-btns">${RB('l', 'Turn left', 'M5 12a7 7 0 1 0 2.05-4.95M7 3v4.5h4.5')}${RB('home', 'Face forward', 'M12 4a3 3 0 1 1 0 6a3 3 0 1 1 0-6M6 20c0-4 2.7-7 6-7s6 3 6 7')}${RB('r', 'Turn right', 'M19 12a7 7 0 1 1-2.05-4.95M17 3v4.5h-4.5')}${RB('cloak', y.cklook === 'none' ? 'Show your cloak' : 'Hide your cloak', 'M8 4h8l3 16-4-2-3 3-3-3-4 2z')}${RB('look', 'Open the wardrobe', 'M12 9a2 2 0 1 1 2-2c0 1-2 1.3-2 3L21 16H3z')}</div></section>`;
    return `<div class="cw-gear">${left}${mid}${this.charStatsHtml(y, C, B)}</div>`;
  }
  // the Equipment tab on a phone: the doll on the left (drag to turn), every gear slot as a 48 px row on the right
  // (icon, name, slot, item level); tap a row for its tooltip and Unequip (touch.js)
  charGearPhone(y, C) {
    const B = this.charBits(y);
    const rows = GEAR_SLOTS.map((sl) => {
      const it = y.equip[sl], dur = it?.dur ?? 100, q = it?.q ?? 1;
      return `<div class="cw-gr cw-gp ${it ? '' : 'none'}" data-s="${sl}"><span class="cw-gi">${it ? `<img src="${icon(it.icon || sl, '#3a3226', 48)}" style="border-color:${dur === 0 ? '#ff3020' : QUALITY[q]}">` : slotGlyph(sl)}</span><div class="cw-gt"><b style="color:${it ? QUALITY[q] : 'inherit'}">${it ? gearName(it) : 'Nothing worn'}</b><small><em>${SLOT_LABEL[sl]}</em>${it && dur < 30 ? ` · <span style="color:${B.durCol(dur)}">${dur === 0 ? 'broken' : 'worn ' + dur + '%'}</span>` : ''}</small></div><span class="cw-gl">${it?.ilvl || ''}</span></div>`;
    }).join('');
    return `<div class="cw-gear cw-gphone"><section class="cw-mid">${this.charStage(y, false)}</section><section class="cw-ledger cw-scroll"><div class="cw-pwho"><b style="color:${C.color}">${y.name}</b><span>Level ${y.level} ${C.name}</span><span class="cw-pil">${B.gem}<b>${B.ilvl.toFixed(1)}</b></span></div>${rows}<div class="cw-note">Tap a piece, then Unequip or Link in chat</div></section></div>`;
  }
  // the Stats tab on a phone: your level, experience and gold, then the stats column of the desktop sheet
  charStatsPhone(y, C) {
    const B = this.charBits(y);
    const xpPct = y.level >= LEVEL_CAP ? 100 : (100 * y.xp) / Math.max(1, y.xpNext);
    const card = `<aside class="cw-left cw-scroll"><div class="cw-card"><div class="cw-cc"><span class="cw-crest" style="--cc:${C.color}">${B.crest}</span><div class="cw-who"><b style="color:${C.color}">${y.name}</b>${B.title ? `<i>${B.title}</i>` : ''}<em>${C.role}</em></div></div>
      <div class="cw-lvl"><span>Level <b>${y.level}</b></span><span>${y.level >= LEVEL_CAP ? 'Highest level' : `${y.xp.toLocaleString()} / ${y.xpNext.toLocaleString()} XP`}</span></div>
      <div class="cw-xp"><i style="width:${xpPct.toFixed(1)}%"></i></div>
      <div class="cw-rested ${y.rested ? 'on' : ''}">${y.rested ? `Rested: ${y.rested.toLocaleString()} bonus XP` : 'Not rested'}</div>
      <div class="cw-home">Home: <b>${y.home || 'Sunmere Village'}</b></div></div>${this.charSetsHtml(y)}<div class="cw-gold"><span class="bg-coin"></span><span>Gold</span><b>${fmtMoney(y.gold)}</b></div></aside>`;
    return `<div class="cw-attr cw-sphone">${card}${this.charStatsHtml(y, C, B)}</div>`;
  }
  // set pieces worn and what they give: sits in the left column under the gear condition
  charSetsHtml(y) {
    const worn = {}; for (const g of Object.values(y.equip || {})) if (g?.set && SETS[g.set] && g.dur !== 0) worn[g.set] = (worn[g.set] || 0) + 1;
    const sets = Object.entries(worn).map(([k, n]) => { const S = SETS[k]; return `<div class="cs-set"><div class="cs-sh"><b>${S.name}</b><span>${n} / ${S.pieces.length}</span></div>${Object.entries(S.bonus).map(([need, fx]) => `<div class="${n >= Number(need) ? 'tt-up' : 'cs-off'}">(${need}) ${fx.map((e) => describeEffect(e)).join(', ')}</div>`).join('')}</div>`; });
    return sets.length ? `<h5 class="cw-h cw-seth">Set Bonuses</h5><div class="cw-setb">${sets.join('')}</div>` : '';
  }
  // the right-hand panel: item level, health and resource, then the stats in groups
  charStatsHtml(y, C, B) {
    const st = y.stats || {}, M = y.mods || {};
    const pct = (v) => `${Math.round((v || 0) * 1000) / 10}%`;
    const row = (n, v, tip) => `<div class="cw-row"${tip ? ` title="${tip}"` : ''}><span>${n}</span><b>${v}</b></div>`;
    const sec = (name, ic, rows) => `<div class="cw-sec"><h5><svg viewBox="0 0 64 64" aria-hidden="true"><path d="${ic}" fill="currentColor" fill-rule="evenodd"/></svg>${name}</h5>${rows.filter(Boolean).join('')}</div>`;
    const bar = (cls, n, v, max, col) => `<div class="cw-bar ${cls}"><div><span>${n}</span><b>${Math.round(v).toLocaleString()} / ${max.toLocaleString()}</b></div><i><u style="width:${Math.min(100, (100 * v) / Math.max(1, max)).toFixed(1)}%;${col ? `background:linear-gradient(90deg, ${col}aa, ${col})` : ''}"></u></i></div>`;
    const ATTR = 'M32 6L54 18V46L32 58L10 46V18ZM32 16L20 23V41L32 48L44 41V23Z';
    return `<aside class="cw-right cw-scroll"><div class="cw-il" title="Average item level of the gear you wear">${B.gem}<b>${B.ilvl.toFixed(1)}</b><span>Item level</span></div>
      ${bar('hp', 'Health', y.hp, y.maxHp)}${bar('res', C.resource, y.res ?? y.maxRes, y.maxRes, C.resColor)}
      ${sec('Attributes', ATTR, [row('Power', y.power.toLocaleString(), 'Raises the damage and healing of every skill'), row('Stamina', (st.hp || 0).toLocaleString(), 'From gear: each point is 4 health'), row('Armour', (st.armor || 0).toLocaleString(), 'From gear: lowers the damage you take'), row('Max health', y.maxHp.toLocaleString())])}
      ${sec('Offensive', SLOT_GLYPH.weapon, [row('Critical strike', pct(y.crit)), row('Critical damage', `${Math.round((1.6 + (M.critDmg || 0)) * 100)}%`, 'Damage of a critical strike'), row('Haste', pct(y.hastePct ?? (st.haste || 0) / 100)), M.dmg ? row('Damage bonus', '+' + pct(M.dmg)) : '', M.heal ? row('Healing bonus', '+' + pct(M.heal)) : '', M.cdr ? row('Cooldowns', '-' + pct(M.cdr)) : ''])}
      ${sec('Defensive', SLOT_GLYPH.offhand, [row('Damage reduction', pct(y.armorPct), 'From armour, class and the Skill Web (up to 75%, more with armour from the Web)'), row('Dodge', pct(y.dodge)), row('Recovery', pct(M.leech), 'Share of damage dealt that heals you'), M.thorns ? row('Thorns', pct(M.thorns)) : '', M.absorb ? row('Shield strength', '+' + pct(M.absorb)) : ''])}</aside>`;
  }
  charAttrHtml(y, C) {
    const B = this.charBits(y), st = y.stats || {}, M = y.mods || {};
    const statLine = (g) => Object.entries(g.stats || {}).filter(([, v]) => v).map(([k, v]) => `+${v}${STAT_PCT[k] ? '%' : ''} ${STAT_NAME[k] || k}`).join(' · ');
    const rows = GEAR_SLOTS.map((sl) => {
      const it = y.equip[sl], dur = it?.dur ?? 100;
      return `<div class="cw-gr ${it ? '' : 'none'}" data-s="${sl}"><span class="cw-gi">${it ? `<img src="${icon(it.icon || sl, '#3a3226', 48)}" style="border-color:${QUALITY[it.q ?? 1]}">` : slotGlyph(sl)}</span><div class="cw-gt"><b style="color:${it ? QUALITY[it.q ?? 1] : 'inherit'}">${it ? gearName(it) : 'Nothing worn'}</b><small><em>${SLOT_LABEL[sl]}</em>${it ? `${statLine(it)}${it.sockets ? ` · ${it.sockets.filter(Boolean).length}/${it.sockets.length} sockets` : ''}` : ''}</small></div><span class="cw-gl">${it?.ilvl || ''}</span><span class="cw-gdw" title="Durability">${it ? `<span class="cw-gd"><i style="width:${dur}%;background:${B.durCol(dur)}"></i></span><small>${dur}%</small>` : ''}</span></div>`;
    }).join('');
    const tot = Object.keys(STAT_NAME).filter((k) => st[k]).map((k) => `<div class="cw-row"><span>${STAT_NAME[k]}</span><b>+${st[k]}${STAT_PCT[k] ? '%' : ''}</b></div>`).join('') || '<div class="cw-none">Nothing worn yet.</div>';
    const mods = Object.entries(M).map(([k, v]) => { const t = describeEffect([k, v]); return `<div class="cw-mod">${t.charAt(0).toUpperCase() + t.slice(1)}</div>`; }).join('') || '<div class="cw-none">No bonuses yet: take places on the Skill Web and wear set pieces.</div>';
    return `<div class="cw-attr"><section class="cw-ledger cw-scroll"><h5 class="cw-h">Equipped <span>${B.gem}${B.ilvl.toFixed(1)}</span></h5>${rows}<div class="cw-note">${IS_TOUCH ? 'Tap a piece, then Unequip or Link in chat' : 'Right-click a piece to take it off · Shift-click to link it in chat'}</div></section>
      <aside class="cw-right cw-scroll"><div class="cw-sec"><h5>From your gear</h5>${tot}</div><div class="cw-sec"><h5>Skill Web, sets and effects</h5>${mods}</div>
      <div class="cw-sec"><h5>Skill Web</h5><div class="cw-row"><span>Unspent points</span><b>${y.treePts || 0}</b></div><div class="cw-row"><span>Active loadout</span><b>${(y.lo || 0) + 1}</b></div></div></aside></div>`;
  }
  charLookHtml(y) {
    // the wardrobe: every weapon type, offhand and shine you have owned, worn over what you actually carry
    const WN = { sword: 'Sword', axe: 'Axe', mace: 'Mace', hammer: 'Hammer', bow: 'Bow', rod: 'Coil Rod', scimitar: 'Scimitar', staff: 'Staff', pistol: 'Pistol' };
    const looks = y.looks || [], ohl = y.ohlooks || [], sh = [1, ...(y.shines || [])], shl = y.shlooks || [], ckl = y.cklooks || [];
    const opt = (v, cur, label) => `<option value="${v}" ${String(cur ?? '') === String(v) ? 'selected' : ''}>${label}</option>`;
    const row = (cls, label, list, cur, name, first, off, glyph, extra = '') => `<div class="look-row ${off ? 'off' : ''} ${extra}"><span class="lk-ic">${slotGlyph(glyph)}</span><span>${label}</span><select class="${cls}" ${off ? 'disabled' : ''}>${opt('', cur, first)}${list.map((t) => opt(t, cur, name(t))).join('')}</select></div>`;
    const chip = (n, label) => `<div class="lk-chip"><b>${n}</b><span>${label}</span></div>`;
    return `<div class="cw-look">${this.charStage(y, false)}<section class="wardrobe cw-scroll"><h5 class="cw-h">Wardrobe <span>${looks.length + ohl.length + sh.length - 1 + shl.length + ckl.length} looks collected</span></h5>
      <div class="lk-chips">${chip(looks.length, 'Weapons')}${chip(sh.length - 1, 'Shines')}${chip(ohl.length, 'Offhands')}${chip(shl.length, 'Shoulders')}${chip(ckl.length, 'Cloaks')}</div>`
      + row('wlook', 'Weapon', looks, y.wlook, (t) => WN[t] || t, 'What I wield', !y.equip?.weapon, 'weapon')
      + row('wshine', 'Shine', sh, y.wshine, (q) => shineName(q), 'As it is', !y.equip?.weapon, 'trinket', Number(y.wshine ?? y.equip?.weapon?.q) === 6 ? 'lk-prism' : '')
      // heat: the glow an upgraded weapon shows from +7 (each stage you have reached stays here), or cold steel
      + row('wheat', 'Heat', [0, ...(y.heats || []).filter((n) => HEAT_STAGE[n]).sort((a, b) => a - b)], y.wheat, (n) => (n === 0 ? 'Cold steel' : `${HEAT_STAGE[n].name} (+${n})`), 'As forged', !y.equip?.weapon || !(y.heats || []).length, 'weapon', y.wheat > 0 || (y.wheat == null && upOf(y.equip?.weapon) >= 7) ? 'lk-heat' : '')
      + row('ohlook', 'Offhand', ohl, y.ohlook, (t) => OH_NAME[t] || t, 'What I carry', !y.equip?.offhand, 'offhand')
      + row('shlook', 'Shoulders', ['none', ...shl], y.shlook, (t) => t === 'none' ? 'My own (hidden)' : `${SH_NAME[t.split(':')[0]]}, ${SHINE_NAME[t.split(':')[1]] || t.split(':')[1] === '6' ? shineName(t.split(':')[1]).replace(' shine', '') : ['', 'Common', 'Uncommon'][t.split(':')[1]] || ''}`, 'What I wear', false, 'shoulders')
      + row('cklook', 'Cloak', ['none', ...ckl], y.cklook, (t) => t === 'none' ? 'No cloak shown' : CLOAK_NAME[t] || t, 'What I wear', false, 'back')
      + `<div class="wd-hint">Every weapon, shield, shine and heat stage that passes through your hands is kept here for good. The figure shows each change as soon as you pick it.</div></section></div>`;
  }
  charRepHtml(y) {
    return `<div class="cw-rep cw-scroll"><h5 class="cw-h">Reputation <span>Earn standing by helping each watch: quests, dailies and their foes</span></h5><div class="rep-list cw-repgrid">${Object.entries(FACTIONS).map(([f, F]) => {
      const v = y.rep?.[f] || 0, r = repRank(v), lo = REP_RANKS[r].at, hi = REP_RANKS[r + 1]?.at; const pct = hi ? (100 * (v - lo)) / (hi - lo) : 100;
      return `<div class="rep cw-repc" style="--fc:${F.color}"><div class="cw-rh"><span>${factionArt(f) ? `<img class="crest-ic" src="${factionArt(f)}" alt="">` : ''}${F.name}</span><em>${REP_RANKS[r].name}</em></div><div class="rep-bar"><i style="width:${pct.toFixed(0)}%;background:linear-gradient(180deg, ${F.color}, #1a1208)"></i><b>${hi ? `${v - lo} / ${hi - lo}` : 'Highest standing'}</b></div><div class="cw-rf">${[NPCS.find((n) => n.id === F.qm)?.name && `Quartermaster: ${NPCS.find((n) => n.id === F.qm).name}`, hi && `Next: ${REP_RANKS[r + 1].name}`].filter(Boolean).join(' · ')}</div></div>`;
    }).join('')}</div></div>`;
  }
  charGuildHtml(y) {
    const G = y.guild;
    // the guild fills its column: banner, members online as rows, then the commands as a small reference
    const cmd = (c, d) => `<div class="cw-gcmd"><code>${c}</code><span>${d}</span></div>`;
    const guild = G ? `<div class="guild-box cw-gbox"><h4>&lt;${G.name}&gt; <span>${G.rank}</span></h4><div class="cw-gsub">Members online <b>${G.roster.length}</b></div><div class="g-roster cw-groster cw-scroll">${G.roster.map((r) => `<div class="cw-gm" style="--cc:${CLASSES[r.cls]?.color || '#fff'}"><i></i><b>${shownName(r.name, r.bot)}</b><span>${CLASSES[r.cls]?.name || ''}</span><em>${r.level}</em></div>`).join('')}${G.roster.length < 4 ? '<div class="cw-gempty">Only a few here for now. Recruit players or your adventurers with /ginvite.</div>' : ''}</div><div class="cw-gcmds">${cmd('/g', 'talk to the guild')}${cmd('/ginvite name', 'recruit a player or adventurer')}${cmd('/groster', 'list who is online')}${cmd('/gleave', 'leave the guild')}</div></div>`
      : `<div class="guild-box cw-gbox"><h4>Guild</h4><p class="cw-note">Found a guild to gather friends and adventurers under one banner.</p><div class="g-new"><input class="g-name" maxlength="24" placeholder="Name a guild"><button class="g-make">Found (10 silver)</button></div><div class="cw-gcmds">${cmd('/g', 'talk to the guild')}${cmd('/ginvite name', 'recruit a player or adventurer')}${cmd('/gleave', 'leave the guild')}</div></div>`;
    const pets = `<div class="pet-list cw-pets">${Object.entries(PETS).map(([k, P]) => { const have = !!y.pets?.[k], ic = ITEMS['pet_' + k]?.icon || 'gear'; return `<div class="petb cw-pet ${have ? '' : 'locked'} ${y.pet === k ? 'on' : ''}" data-p="${k}" title="${have ? (y.pet === k ? 'Click to send home' : 'Click to bring along') : 'From ' + P.from}"><img src="${icon(ic, '#3a3226', 64)}" alt=""><div><b>${P.name}</b><em>${have ? (y.pet === k ? 'With you' : 'At home') : 'From ' + P.from}</em></div><span class="cw-ptag">${have ? (y.pet === k ? 'Out' : 'Owned') : 'Not found'}</span></div>`; }).join('')}</div>`;
    return `<div class="cw-guild"><section class="cw-scroll"><h5 class="cw-h">Guild</h5>${guild}</section><section class="cw-scroll"><h5 class="cw-h">Clockwork Pets <span>${Object.keys(y.pets || {}).length} / ${Object.keys(PETS).length}</span></h5>${pets}</section></div>`;
  }
  charWire(w, y, tab) {
    const tipFor = (it) => this.itemTip({ gear: it }, false) + (IS_TOUCH ? '' : '<div class="tt-hint">Right-click to unequip · Shift-click to link in chat</div>');
    w.querySelectorAll('.cw-slot, .cw-gr').forEach((e) => {
      const it = y.equip[e.dataset.s];
      if (!it) { if (e.classList.contains('cw-slot')) e.addEventListener('mouseenter', (ev) => this.showTip(ev, `<b>${SLOT_LABEL[e.dataset.s]}</b><div class="tt-hint">Empty: ${IS_TOUCH ? 'tap gear in your bags, then Equip' : 'right-click gear in your bags to wear it'}</div>`)), e.addEventListener('mouseleave', () => this.hideTip()); return; }
      e.addEventListener('mouseenter', (ev) => this.showTip(ev, tipFor(it)));
      e.addEventListener('click', (ev) => { if (ev.shiftKey) { ev.preventDefault(); this.linkItem({ gear: it }); } });
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('contextmenu', (ev) => { ev.preventDefault(); this.g.send({ t: 'unequip', slot: e.dataset.s }); this.hideTip(); });
    });
    w.querySelectorAll('.cw-set:not(.on):not(.locked)').forEach((b) => (b.onclick = () => { this.g.send({ t: 'loadout', i: Number(b.dataset.i) }); this.g.sfx?.play('ui'); }));
    w.querySelectorAll('.cw-rb').forEach((b) => (b.onclick = () => {
      const k = b.dataset.b;
      if (k === 'l') this.dollCtl?.turn(-Math.PI / 4);
      else if (k === 'r') this.dollCtl?.turn(Math.PI / 4);
      else if (k === 'home') this.dollCtl?.reset();
      else if (k === 'cloak') this.g.send({ t: 'wlook', ck: y.cklook === 'none' ? null : 'none' });
      else if (k === 'look') { this.charTab = 'look'; w.refresh(true); }
      this.g.sfx?.play('ui');
    }));
    if (tab === 'look') {
      $('.wlook', w).onchange = (e) => this.g.send({ t: 'wlook', w: e.target.value || null });
      $('.wshine', w).onchange = (e) => this.g.send({ t: 'wlook', sh: e.target.value ? Number(e.target.value) : null });
      $('.wheat', w).onchange = (e) => this.g.send({ t: 'wlook', ht: e.target.value === '' ? null : Number(e.target.value) });
      $('.ohlook', w).onchange = (e) => this.g.send({ t: 'wlook', oh: e.target.value || null });
      $('.shlook', w).onchange = (e) => this.g.send({ t: 'wlook', arm: e.target.value || null });
      $('.cklook', w).onchange = (e) => this.g.send({ t: 'wlook', ck: e.target.value || null });
    }
    w.querySelectorAll('.petb:not(.locked)').forEach((e) => (e.onclick = () => this.g.send({ t: 'pet', id: y.pet === e.dataset.p ? null : e.dataset.p })));
    const gm = $('.g-make', w); if (gm) { const gi = $('.g-name', w); gi.addEventListener('keydown', (e) => e.stopPropagation()); gm.onclick = () => this.g.send({ t: 'chat', text: '/guild create ' + gi.value }); }
    const cv = $('.cw-doll canvas', w); if (cv) this.dollStart(cv, y);
  }

  // dims every bag slot that does not match the search (name, slot, type, quality, set, "junk", "quest", "use")
  itemMatches(it, q) {
    const d = itemDef(it) || {}, qq = d.q ?? 1;
    const hay = [d.name, SLOT_LABEL[d.slot], d.slot, typeLine(d), QUALITY_NAME[qq], d.set && SETS[d.set]?.name, d.weight, d.wtype, d.otype, d.slot === 'quest' ? 'quest item' : '', d.slot === 'use' ? 'use consumable' : '', qq === 0 ? 'junk' : '', upOf(d) ? `upgraded upgrade +${upOf(d)}` : '', d.sockets ? 'socket' : ''].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  }
  filterSlots(slots, items, query) {
    const q = (query || '').trim().toLowerCase();
    slots.forEach((e) => {
      const it = items?.[Number(e.dataset.i)];
      if (!q || !it) { e.classList.remove('dim', 'hit'); return; }
      const hit = this.itemMatches(it, q);
      e.classList.toggle('dim', !hit); e.classList.toggle('hit', hit);
    });
  }
  // the search first, then the category tab dims what is not in it (empty slots fade too while a tab is picked)
  applyBagFilter(w) {
    const bag = this.you?.bag, cat = this.bagCat || 'all';
    const slots = w.querySelectorAll('.bag-grid .bslot');
    this.filterSlots(slots, bag, this.bagFilter);
    slots.forEach((e) => {
      const it = bag?.[Number(e.dataset.i)];
      e.classList.toggle('void', cat !== 'all' && !it);
      if (cat !== 'all' && it && bagCat(it) !== cat) { e.classList.add('dim'); e.classList.remove('hit'); }
    });
  }
  winBags() {
    const BW = 486;
    const w = this.makeWindow('Backpack', 'w-bags', Math.max(12, innerWidth - BW - 24), 60);
    // the head (capacity, search, sort, category tabs) lives outside the part that refreshes, so typing is never interrupted by an update
    {
      const CATS = [['all', 'All'], ['gear', 'Gear'], ['use', 'Consumables'], ['mat', 'Materials'], ['quest', 'Quest'], ['junk', 'Junk']];
      const hd = el('div', 'bag-head', `<div class="bag-cap"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 14V10C22 6 26 4 32 4S42 6 42 10V14H50C54 14 56 17 56 21V54C56 58 53 60 50 60H14C11 60 8 58 8 54V21C8 17 10 14 14 14ZM27 14H37V10C37 9 35 8 32 8S27 9 27 10ZM16 30H48V36H16Z" fill="currentColor" fill-rule="evenodd"/></svg><div class="bc-tx"><div><b>Capacity</b><span class="bc-n"></span></div><div class="bc-bar"><i></i></div></div></div>
        <div class="bag-search"><input type="text" placeholder="Search your bags" spellcheck="false" maxlength="40"><button class="bs-x" title="Clear the search">×</button><button class="bsort" title="Sort your bags">Sort</button></div>
        <div class="bag-cats">${CATS.map(([k, n]) => `<button data-c="${k}"><span>${n}</span><i></i></button>`).join('')}</div>`);
      w.insertBefore(hd, $('.wb', w));
      const inp = $('input', hd), set = (v) => { inp.value = v; this.bagFilter = v; this.applyBagFilter(w); };
      inp.value = this.bagFilter || '';
      inp.oninput = () => set(inp.value);
      inp.onkeydown = (e) => { if (e.key === 'Escape') { set(''); inp.blur(); } e.stopPropagation(); };
      $('.bs-x', hd).onclick = () => set('');
      $('.bsort', hd).onclick = () => { this.g.send({ t: 'sortBag' }); this.g.sfx?.play('ui'); };
      hd.querySelectorAll('.bag-cats button').forEach((b) => (b.onclick = () => { this.bagCat = b.dataset.c; hd.querySelectorAll('.bag-cats button').forEach((x) => x.classList.toggle('on', x === b)); this.applyBagFilter(w); this.g.sfx?.play('ui'); }));
      hd.querySelector(`.bag-cats [data-c="${this.bagCat || 'all'}"]`)?.classList.add('on');
    }
    w.refresh = () => {
      const y = this.you;
      const cells = [];
      const size = y.bagSize || BAG_BASE;
      const count = { all: y.bag.length, gear: 0, use: 0, mat: 0, quest: 0, junk: 0 };
      for (let i = 0; i < size; i++) {
        const it = y.bag[i], d = itemDef(it);
        if (d) count[bagCat(it)]++;
        const up = d?.stats && GEAR_SLOTS.includes(d.slot) && !(d.classes && !d.classes.includes(y.cls)) && gearScore(d) > gearScore(y.equip[d.slot]) + 0.5;
        const gq = d ? (d.q ?? 1) : -1, gearish = d?.stats && GEAR_SLOTS.includes(d.slot), cant = gearish && ((d.req && d.req > y.level) || (d.classes && !d.classes.includes(y.cls)));
        cells.push(`<div class="bslot${this.postWrite && this.postDraft?.slot === i ? ' attached' : ''}${d ? ' bq' + gq : ' empty'}${cant ? ' cant' : ''}" data-i="${i}"${d ? ` style="--qc:${QUALITY[gq]}"` : ''}>${d ? `<img src="${icon(d.icon || 'ring', '#3a3226', 64)}" style="border-color:${QUALITY[gq]}">${it.n > 1 ? `<span class="cnt">${it.n}</span>` : ''}${gearish && d.ilvl ? `<span class="bil">${d.ilvl}</span>` : ''}${gearish && upOf(d) ? `<span class="bplus">+${upOf(d)}</span>` : ''}${up ? '<span class="bup" title="Upgrade"></span>' : ''}` : ''}</div>`);
      }
      const used = y.bag.length, full = used >= size;
      const hd = $('.bag-head', w);
      $('.bc-n', hd).textContent = `${used} / ${size}`;
      $('.bc-bar i', hd).style.width = `${Math.min(100, (100 * used) / size).toFixed(1)}%`;
      hd.classList.toggle('full', full); hd.classList.toggle('near', !full && used >= size - 3);
      hd.querySelectorAll('.bag-cats button').forEach((b) => { $('i', b).textContent = count[b.dataset.c] || ''; });
      const cols = size <= 30 ? 6 : size <= 42 ? 7 : 8;
      w.classList.toggle('tall', Math.ceil(size / cols) >= 6); // six rows or more: smaller sockets on short screens
      const mode = this.outfitFor && this.windows.outfit?.isConnected ? 'give to your companion' : this.postWrite ? 'attach to your letter' : this.storeOpen ? 'put on the storehouse shelves' : `use / equip${this.vendorOpen ? ' / sell' : ''}`;
      $('.wb', w).innerHTML = `<div class="bag-grid" style="--cols:${cols}">${cells.join('')}</div><div class="bag-foot"><div class="bag-gold"><span class="bg-coin"></span><span>${fmtMoney(y.gold)}</span></div><div class="bag-free">${size - used} free</div></div><div class="bag-hint">${IS_TOUCH ? `Tap an item, then ${mode.replace(/ \/ /g, ', ')}` : `Right-click: ${mode} · Shift-click: link in chat`}</div>`;
      this.applyBagFilter(w);
      // a bigger pack (more columns or rows) must not grow off the screen: nudge it back in, wherever it was dragged
      if (w.offsetLeft + w.offsetWidth > innerWidth - 12) w.style.left = Math.max(12, innerWidth - w.offsetWidth - 24) + 'px';
      if (w.offsetTop + w.offsetHeight > innerHeight - 12) w.style.top = Math.max(12, innerHeight - w.offsetHeight - 12) + 'px';
      w.querySelectorAll('.bslot').forEach((e) => {
        const i = Number(e.dataset.i), it = y.bag[i];
        if (!it) return;
        e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip(it)));
        e.addEventListener('mouseleave', () => this.hideTip());
        e.addEventListener('click', (ev) => { if (ev.shiftKey) { ev.preventDefault(); this.linkItem(it); } });
        // consumables drag onto the potion slot (desktop and browser)
        if (!IS_TOUCH && !it.gear && ITEMS[it.id]?.slot === 'use') {
          e.draggable = true;
          e.addEventListener('dragstart', (ev) => { this.hideTip(); ev.dataTransfer.setData('text/sunmere-use', it.id); ev.dataTransfer.effectAllowed = 'copy'; this.pot?.el.classList.add('drag'); });
          e.addEventListener('dragend', () => this.pot?.el.classList.remove('drag', 'drop'));
        }
        e.addEventListener('contextmenu', (ev) => {
          ev.preventDefault(); this.hideTip();
          if (this.storeOpen) return this.g.send({ t: 'deposit', slot: i });
          if (this.postWrite) return this.attachPost(i);
          if (this.outfitFor && this.windows.outfit?.isConnected) return this.g.send({ t: 'compGive', id: this.outfitFor, slot: i });
          if (this.vendorOpen) return this.g.send({ t: 'sell', slot: i });
          const d = itemDef(it);
          if (d.slot === 'use') this.g.send({ t: 'use', slot: i });
          else if (d.stats) this.g.send({ t: 'equip', slot: i });
        });
      });
    };
    w.refresh();
    // sit above the action bars on the right, whatever the height of the pack
    w.style.top = Math.max(12, innerHeight - w.offsetHeight - 120) + 'px';
    w.style.left = Math.max(12, innerWidth - w.offsetWidth - 24) + 'px';
    return w;
  }

  winQuests() {
    const w = this.makeWindow('Quest Log', 'w-quests', 260, 110);
    let sel = null;
    w.refresh = () => {
      const q = this.you.quests, ids = Object.keys(q);
      if (this.questSel && q[this.questSel]) { sel = this.questSel; this.questSel = null; if (!this.questTab) this.questTab = 'log'; }
      const tab = this.questTab || 'story';
      const side = ids.filter((id) => !QUESTS[id]?.msq).length;
      const tabs = `<div class="post-tabs ql-tabs"><button data-qt="story" class="${tab === 'story' ? 'on' : ''}">${CREST()} Main Story</button><button data-qt="log" class="${tab === 'log' ? 'on' : ''}">Quests (${side}/12)</button></div>`;
      if (tab === 'story') { $('.wb', w).innerHTML = tabs + this.storyLogHtml(); this.wireStoryLog(w); }
      else {
        if (!sel || !q[sel]) sel = ids[0];
        const Q = sel ? QUESTS[sel] : null;
        const C = Q?.msq ? STORY[Q.msq.ch] : null;
        // grouped by where each quest comes from: the Main Story first, then each region
        const where = (id) => { const Qx = QUESTS[id]; if (Qx.msq) return '\u0000Main Story'; if (Qx.daily) return '\uffffDaily'; return npcPlace(Qx.giver) || 'Elsewhere'; };
        const groups = {};
        for (const id of ids) (groups[where(id)] ||= []).push(id);
        const list = Object.keys(groups).sort().map((g) => `<div class="ql-grp">${g.replace(/^[\u0000\uffff]/, '')}</div>` + groups[g].map((id) => `<div class="ql ${id === sel ? 'on' : ''} ${this.untracked.has(id) ? 'untracked' : ''} ${QUESTS[id].msq ? 'msq' : ''}" data-q="${id}">${QUESTS[id].msq ? CREST() : ''}[${QUESTS[id].lvl}] ${QUESTS[id].name}</div>`).join('')).join('');
        $('.wb', w).innerHTML = tabs + `<div class="ql-body"><div class="ql-list">${list || '<div class="ql-empty">No quests. Look for <b style="color:#f0b020">!</b> above people\'s heads, or follow the Main Story.</div>'}</div>
        <div class="ql-detail">${Q ? `${C ? `<div class="msq-rib">${CREST()} Main Story \u00b7 Chapter ${Q.msq.ch + 1}: ${C.name}</div>` : ''}<h3>${Q.name}</h3><p>${Q.text}</p><div class="qgoal">Objective: ${goalAsk(Q)}</div><div class="ql-rw">Reward: ${Q.xp} XP · ${fmtMoney(Q.gold * 10)}</div><label class="opt chk ql-track"><input type="checkbox" class="trk" ${this.untracked.has(sel) ? '' : 'checked'}> Show in the quest tracker</label><div class="dbtns"><button class="qwalk">${this.g.qwalk?.qid === sel ? 'Stop walking' : 'Walk there'}</button>${this.party && !Q.daily ? '<button class="share">Share with party</button>' : ''}${Q.msq ? '<span class="ql-note">Main Story quests stay until they are done.</span>' : '<button class="abandon">Abandon</button>'}</div>` : ''}</div></div>`;
        w.querySelectorAll('.ql').forEach((e) => (e.onclick = () => { sel = e.dataset.q; w.refresh(); }));
        const ab = $('.abandon', w); if (ab) ab.onclick = () => this.g.send({ t: 'abandon', q: sel });
        const sh = $('.share', w); if (sh) sh.onclick = () => this.g.send({ t: 'share', q: sel });
        const qw = $('.qwalk', w); if (qw) qw.onclick = () => { if (this.g.qwalk?.qid === sel) { this.g.questWalkStop?.(); w.refresh(); } else if (this.g.questWalk?.(sel) && w.isConnected) this.toggle('quests'); };
        const tk = $('.trk', w); if (tk) tk.onchange = () => { this.setTracked(sel, tk.checked); w.refresh(); };
      }
      w.querySelectorAll('[data-qt]').forEach((b) => (b.onclick = () => { this.questTab = b.dataset.qt; w.refresh(); }));
    };
    w.refresh();
    return w;
  }

  // the Main Story tab: parts and chapters on the left; the chosen chapter's story so far on the right
  storyLogHtml() {
    const y = this.you, S = this.storyNow(), cur = S.state === 'end' ? STORY.length : S.at.ch;
    const ch = this.storySel ?? Math.min(cur, STORY.length - 1);
    let list = '', part = 0;
    STORY.forEach((C, i) => {
      if (C.part !== part) { part = C.part; list += `<div class="sl-part">Part ${ROMAN[part]}<span>${STORY_PARTS[part]}</span></div>`; }
      const st = i < cur ? 'done' : i === cur ? 'cur' : 'locked';
      list += `<div class="sl-ch ${st} ${i === ch ? 'on' : ''}" data-ch="${i}"><b>${st === 'done' ? '\u2713' : st === 'cur' ? '\u25b6' : '\u00b7'}</b><span>Chapter ${i + 1}: ${C.name}</span><em>Lv ${C.lvl[0]}${C.lvl[1] > C.lvl[0] ? '-' + C.lvl[1] : ''}</em></div>`;
    });
    const C = STORY[ch];
    let body = `<div class="sl-art" style="background-image:url('/sunmere-play/ui/loading/${chapterArt(C)}.webp')"><div><em>Part ${ROMAN[C.part]} \u00b7 ${STORY_PARTS[C.part]}</em><h3>Chapter ${ch + 1}: ${C.name}</h3></div></div><p class="sl-blurb">${C.blurb}</p>`;
    if (ch > cur) body += `<div class="sl-locked">This chapter opens when you finish Chapter ${ch}: ${STORY[ch - 1].name}.</div>`;
    else {
      body += '<div class="sl-steps">';
      let hidden = 0;
      for (const [qid] of C.steps) {
        const Q = QUESTS[qid], n = Q.msq.n, done = !!y.done?.[qid];
        if (done) body += `<div class="sl-step done"><b>\u2713</b><div><span>${Q.name}</span><p>${Q.recap}</p></div></div>`;
        else if (n === S.at.n && S.state !== 'end') {
          const where = S.state === 'ready' ? `Return to ${npcName(Q.turnin)} in ${npcPlace(Q.turnin)}.` : S.state === 'offer' ? `Speak with ${npcName(Q.giver)} in ${npcPlace(Q.giver)}.` : S.state === 'level' ? `Reach level ${Q.lvl - 2} to continue. Side quests, dungeons, bounties and world events all help.` : `${goalAsk(Q)}${Q.goal.talk ? '' : ` (${S.have}/${S.need})`}.`;
          body += `<div class="sl-step cur">${CREST(S.state === 'ready' ? '?' : '!', S.state === 'level')}<div><span>${Q.name} <i>Level ${Q.lvl}</i></span>${y.quests?.[qid] ? `<p>${Q.text}</p>` : ''}<p class="sl-next">${where}</p></div></div>`;
        } else if (n < S.at.n) body += `<div class="sl-step missed"><b>\u25cb</b><div><span>${Q.name}</span><p>Missed on the way: still open with ${npcName(Q.giver)} in ${npcPlace(Q.giver)}.</p></div></div>`;
        else hidden++;
      }
      if (hidden) body += `<div class="sl-more">${hidden} more step${hidden > 1 ? 's' : ''} in this chapter. They unlock as the story goes on.</div>`;
      body += '</div>';
      if (ch === STORY.length - 1 && S.state === 'end') body += `<div class="sl-end">${STORY_NEXT}</div>`;
    }
    return `<div class="ql-body"><div class="ql-list sl-list">${list}<label class="opt chk ql-track"><input type="checkbox" class="trk-msq" ${this.untracked.has('msq') ? '' : 'checked'}> Show in the tracker</label></div><div class="ql-detail sl-detail">${body}</div></div>`;
  }
  wireStoryLog(w) {
    w.querySelectorAll('.sl-ch').forEach((e) => (e.onclick = () => { this.storySel = Number(e.dataset.ch); w.refresh(); }));
    const tk = $('.trk-msq', w); if (tk) tk.onchange = () => { this.setTracked('msq', tk.checked); w.refresh(); };
  }

  winSkills() {
    const w = this.makeWindow('Skills', 'w-skills', 300, 80);
    w.refresh = () => {
      const C = CLASSES[this.you.cls];
      // (S6) two tabs, Skills and the Fusion Book
      const tab = this._skTab || 'skills';
      w.classList.toggle('w-book', tab === 'book');
      const tabs = `<div class="sk-tabs"><button data-t="skills" class="${tab === 'skills' ? 'on' : ''}">Skills</button><button data-t="book" class="${tab === 'book' ? 'on' : ''}">Fusion Book</button></div>`;
      const wire = () => w.querySelectorAll('.sk-tabs button').forEach((b) => (b.onclick = () => { this._skTab = b.dataset.t; this.g.sfx?.play('ui'); w.refresh(); }));
      if (tab === 'book') { $('.wb', w).innerHTML = tabs + fusionBookPage(this); wireFusionBook(this, w); wire(); return; }
      if (IS_TOUCH) { this.skillsTouch(w); $('.wb', w).insertAdjacentHTML('afterbegin', tabs); wire(); return; }
      $('.wb', w).innerHTML = tabs + `<div class="sk-list">${kitOf(this.you.cls).map((s, i) => `<div class="sk ${s.lvl > this.you.level ? 'locked' : ''}" data-id="${s.id}"><img src="${skillIcon(s)}"><div><b>${this.eff?.[s.id] ? effName(this.eff[s.id]) : s.name}</b> <span class="sk-key">${skillKeyLabel(i)}</span><div class="sk-d">${s.desc}</div><div class="sk-m">${s.cost} ${C.resource}${s.cast ? ' · ' + s.cast + 's cast' : ''}${s.cd ? ' · ' + s.cd + 's cooldown' : ''} · Level ${s.lvl}</div></div></div>`).join('')}</div>`;
      wire();
      w.querySelectorAll('.sk').forEach((e) => (e.onclick = () => this.g.useSkill(e.dataset.id)));
    };
    w.refresh();
    return w;
  }
  // the Skills sheet on a phone or tablet: tap a skill to open it (Use, Add to wheel); "Add to wheel" shows a small copy of
  // the skill wheel, and tapping one of its 7 slots puts the skill there (SETTINGS.touch.wheel[class], 7 slots)
  skillsTouch(w) {
    const y = this.you, cls = y.cls, wb = $('.wb', w), list = kitOf(cls);
    const pick = this._skPick; // { id, wheel: true } while choosing a slot
    const slots = wheelOf(cls, y.level);
    // the mini wheel: the same arc as the touch controls (attack + 4 inner + 2 outer), drawn small
    const POS = [[0, 0, 1], [118, 180], [118, 150], [118, 120], [118, 90], [180, 158], [180, 134]];
    const mini = () => `<div class="skw"><div class="skw-arc">${POS.map(([r, a, big], i) => {
      const sid = slots[i], s = sid ? SKILL_BY_ID[sid] : null, rad = (a || 0) * Math.PI / 180, k = 0.82;
      const x = 184 + Math.cos(rad) * r * k, yy = 128 - Math.sin(rad) * r * k;
      return `<button class="skw-s${big ? ' main' : ''}${s ? '' : ' empty'}${pick?.id && sid === pick.id ? ' cur' : ''}" data-slot="${i}" style="left:${x.toFixed(0)}px;top:${yy.toFixed(0)}px" title="Slot ${i + 1}">${s ? `<img src="${skillIcon(s)}" alt="">` : `<span>${i + 1}</span>`}</button>`;
    }).join('')}</div><div class="skw-tx">${pick?.id ? `<b>Put ${SKILL_BY_ID[pick.id].name} on the wheel</b><span>Tap a slot. The big one is your main attack.</span>` : '<b>Your skill wheel</b><span>Tap a skill below, then Add to wheel. Tap a slot here to empty it.</span>'}<div class="skw-btns">${pick?.id ? '<button class="skw-cancel">Cancel</button>' : ''}<button class="skw-reset">Reset to learn order</button></div></div></div>`;
    const open = this._skOpen;
    wb.innerHTML = mini() + `<div class="sk-list sk-touch">${list.map((s, i) => {
      const locked = s.lvl > y.level, on = slots.indexOf(s.id);
      return `<div class="sk ${locked ? 'locked' : ''} ${open === s.id ? 'open' : ''}" data-id="${s.id}"><img src="${skillIcon(s)}"><div class="sk-b"><b>${s.name}</b>${on >= 0 ? `<span class="sk-on">Wheel slot ${on + 1}</span>` : ''}<div class="sk-m">${s.cost} ${CLASSES[cls].resource}${s.cast ? ' · ' + s.cast + 's cast' : ''}${s.cd ? ' · ' + s.cd + 's cooldown' : ''} · Level ${s.lvl}</div>${open === s.id ? `<div class="sk-d">${s.desc}</div><div class="sk-acts">${locked ? `<span class="sk-lk">Opens at level ${s.lvl}</span>` : `<button class="sk-use">Use</button><button class="sk-add">${on >= 0 ? 'Move on the wheel' : 'Add to wheel'}</button>`}</div>` : ''}</div></div>`;
    }).join('')}</div>`;
    const save = (arr) => { (SETTINGS.touch.wheel ||= {})[cls] = arr; saveSettings(); touchSettingsChanged(); };
    wb.querySelectorAll('.skw-s').forEach((b) => (b.onclick = () => {
      const i = Number(b.dataset.slot), arr = wheelOf(cls, y.level);
      if (pick?.id) {
        const was = arr.indexOf(pick.id);
        if (was >= 0) arr[was] = arr[i]; // swap with whatever had the slot
        arr[i] = pick.id; this._skPick = null; save(arr);
      } else if (arr[i]) { arr[i] = null; save(arr); }
      this.g.sfx?.play('ui'); w.refresh();
    }));
    const cancel = $('.skw-cancel', wb); if (cancel) cancel.onclick = () => { this._skPick = null; w.refresh(); };
    $('.skw-reset', wb).onclick = () => { if (SETTINGS.touch.wheel) delete SETTINGS.touch.wheel[cls]; this._skPick = null; saveSettings(); touchSettingsChanged(); w.refresh(); };
    wb.querySelectorAll('.sk').forEach((e) => (e.onclick = (ev) => {
      const id = e.dataset.id;
      if (ev.target.closest('.sk-use')) { this.g.useSkill(id); return; }
      if (ev.target.closest('.sk-add')) { this._skPick = { id }; this.g.sfx?.play('ui'); w.refresh(); wb.scrollTop = 0; return; }
      this._skOpen = this._skOpen === id ? null : id; w.refresh();
    }));
  }

  winTalents() { return openWebScreen(this); } // (the 'talents' window is the Skill Web screen, S6; the talent screen went at S16)

  // ======================================================== party
  setParty(m) {
    this.party = m;
    this.partyIds = new Set(m.members.map((q) => q.id));
    const box = $('.party-frames', this.root);
    const seen = new Set();
    for (const q of m.members) {
      seen.add(q.id);
      let f = box.querySelector(`[data-id="${q.id}"]`);
      if (!f) {
        f = el('div', 'pframe');
        f.dataset.id = q.id;
        f.innerHTML = `<div class="pf-por"><img><span class="pf-lvl"></span></div><div class="pf-bars"><div class="pf-nm"></div><div class="pf-hp"><i></i><span></span></div><div class="pf-res"><i></i></div></div>`;
        f.onclick = () => this.g.setTarget(q.id);
        box.appendChild(f);
      }
      const C = CLASSES[q.cls];
      const img = $('img', f), src = classArt(q.cls);
      if (img.dataset.c !== q.cls) { img.src = src; img.dataset.c = q.cls; }
      $('.pf-lvl', f).textContent = q.level;
      $('.pf-nm', f).innerHTML = `<span style="color:${C.color}">${shownName(q.name, q.bot)}</span>${q.id === m.leader ? ' <b class="pf-lead" title="Party leader">L</b>' : ''}${q.role ? `<em>${q.role}</em>` : ''}`;
      $('.pf-hp i', f).style.width = (100 * q.hp / q.maxHp).toFixed(0) + '%';
      $('.pf-hp span', f).textContent = q.dead ? 'Fallen' : `${q.hp} / ${q.maxHp}`;
      $('.pf-res i', f).style.width = (100 * q.res / q.maxRes).toFixed(0) + '%';
      $('.pf-res i', f).style.background = `linear-gradient(180deg, ${C.resColor}, #3a2a10)`;
      f.classList.toggle('dead', !!q.dead);
      f.classList.toggle('far', this.g.playerPos ? Math.hypot(this.g.playerPos().x - q.x, this.g.playerPos().z - q.z) > 60 : false);
      f.classList.toggle('targeted', this.g.target === q.id);
    }
    for (const f of [...box.children]) if (f.dataset.id && !seen.has(f.dataset.id)) f.remove();
    let lv = box.querySelector('.pf-leave');
    if (m.members.length && !lv) { lv = el('button', 'pf-leave', 'Leave party'); lv.onclick = () => this.g.send({ t: 'chat', text: '/leave' }); }
    if (lv) { if (m.members.length) box.appendChild(lv); else lv.remove(); }
  }
  doorChoice(id, go) {
    const D = DUNGEONS.find((d) => d.id === id);
    const pop = $('.invite-pop', this.root);
    const capD = !D?.raid && parseInt(D?.level, 10) >= 36; // made for the level 40 cap: Heroic is the raid kind, no Tempest or Veteran
    const tmp = (this.you?.level || 0) >= 25 && !D?.raid && !capD, vet = (this.you?.level || 0) >= 38 && !D?.raid && !capD;
    pop.innerHTML = `<div class="dc-h">${D?.name || 'Dungeon'}</div><div class="dc-t">Normal is level ${D?.level}. Heroic raises everything inside to level 24-26, with better loot and a second roll at set pieces.${tmp ? ' Tempest (after a Heroic clear) is level 25-27: sturdier foes, storm surges at every boss and the Tempest-Forged set.' : ''}${vet ? ' Veteran is level 39-41, with loot made for the level 40 cap.' : ''}</div><div class="dbtns"><button class="n">Normal</button><button class="h">Heroic</button>${tmp ? '<button class="t">Tempest</button>' : ''}${vet ? '<button class="v">Veteran</button>' : ''}<button class="c">Cancel</button></div>`;
    if (tmp && $('.t', pop)) $('.dc-t', pop).insertAdjacentHTML('afterend', `<div class="dc-mods"><b>Tempest this week:</b> ${tempestMods().map((k) => `<span title="${TEMPEST.mods[k].desc}">${TEMPEST.mods[k].name}</span>`).join(' \u00b7 ')}<div>${tempestMods().map((k) => TEMPEST.mods[k].desc).join(' ')}</div></div>`);
    if (capD) $('.dc-t', pop).textContent = `Normal is level ${D.level}. Heroic, after you have beaten the last boss on Normal: everything inside has 60% more health and hits 25% harder, and the loot is 4 item levels higher with an extra piece from each boss.`;
    if (D?.raid) $('.dc-t', pop).textContent = `Normal is level ${D.level}, and its bosses pay their treasure once a week. Heroic, after you have beaten the last boss on Normal: everything inside has 60% more health and hits 25% harder, loot is 4 item levels higher with an extra piece from each boss, and it keeps its own weekly lockout.`;
    pop.classList.remove('hidden');
    const done = (v) => { pop.classList.add('hidden'); if (v !== null) go(v); };
    $('.n', pop).onclick = () => done('normal');
    $('.h', pop).onclick = () => done('heroic');
    if ($('.t', pop)) $('.t', pop).onclick = () => done('tempest');
    if ($('.v', pop)) $('.v', pop).onclick = () => done('veteran');
    $('.c', pop).onclick = () => done(null);
  }
  invitePopup(ev) {
    const pop = $('.invite-pop', this.root);
    pop.innerHTML = `<div><span style="color:${CLASSES[ev.cls]?.color || '#fff'}">${shownName(ev.from, ev.bot)}</span> invites you to join a party.</div><div class="dbtns"><button class="ok">Accept</button><button class="no">Decline</button></div>`;
    pop.classList.remove('hidden');
    const done = (accept) => { this.g.send({ t: 'partyReply', accept }); pop.classList.add('hidden'); };
    $('.ok', pop).onclick = () => done(true);
    $('.no', pop).onclick = () => done(false);
    clearTimeout(this._invT); this._invT = setTimeout(() => { if (!pop.classList.contains('hidden')) done(false); }, 55000);
  }
  receipt(ev) {
    const col = QUALITY[ev.q] || '#ffffff', g = ev.item?.gear;
    this.chat(`You receive <span style="color:${col}">[${g ? gearName(g) : ev.name}]</span>${ev.n > 1 ? ' x' + ev.n : ''}.`, '#b8e8ff'); this.logLoot(ev);
    if (ev.item) this.lootToast(ev.item);
  }
  // the sound a find makes: a quench hiss for Prismatic, the loot chime for Epic and Legendary
  lootSound(q) { if (q >= 6) this.g.sfx?.play('quench'); else if (q >= 4) this.g.sfx?.play('loot'); }
  lootToast(item) {
    const d = itemDef(item), q = d.q ?? 1;
    let box = $('.toasts', this.root);
    if (!box) { box = el('div', 'toasts'); this.root.appendChild(box); }
    // several drops close together collapse into one card: "4 items, best Epic" with their icons in a row
    const S = this._lootStack, now = performance.now();
    if (S && S.el.isConnected && !S.el.classList.contains('out') && now - S.t < 3500) {
      S.items.push(item); S.t = now; S.q = Math.max(S.q, q);
      const best = S.q, word = best >= 3 ? QUALITY_NAME[best] : '';
      S.el.className = 'ltoast stack q' + best;
      S.el.innerHTML = `<div><span class="lt-k">${S.items.length} items${word ? ', best ' + word : ''}</span><div class="lt-row">${S.items.slice(-7).map((it) => { const dd = itemDef(it), qq = dd.q ?? 1; return `<img src="${icon(dd.icon || 'ring', '#2a2620', 40)}" style="border-color:${QUALITY[qq]}">`; }).join('')}</div><b style="color:${QUALITY[q]}">${gearName(d)}</b></div>`;
      S.el.querySelectorAll('.lt-row img').forEach((im, i) => { const it = S.items.slice(-7)[i]; im.addEventListener('mouseenter', (e) => this.showTip(e, this.itemTip(it))); im.addEventListener('mouseleave', () => this.hideTip()); });
      this.lootSound(q);
      clearTimeout(S.t1); clearTimeout(S.t2);
      const hold = best >= 6 ? 7000 : best >= 4 ? 4500 : 3000;
      S.t1 = setTimeout(() => S.el.classList.add('out'), hold); S.t2 = setTimeout(() => S.el.remove(), hold + 600);
      return;
    }
    const t = el('div', 'ltoast q' + q);
    this._lootStack = { el: t, items: [item], t: now, q };
    t.innerHTML = `<img src="${icon(d.icon || 'ring', '#2a2620', 48)}" style="border-color:${QUALITY[q]}"><div><span class="lt-k">${q >= 6 ? 'Prismatic!' : q >= 5 ? 'Legendary!' : q >= 4 ? 'Epic loot!' : 'You found'}</span><b style="color:${QUALITY[q]}">${gearName(d)}</b><em>${[d.base && q >= 4 ? d.base : '', d.stats && q >= 2 ? QUALITY_NAME[q] : '', typeLine(d) || '', d.ilvl ? 'Item Level ' + d.ilvl : ''].filter(Boolean).join(' · ')}</em></div>`;
    box.appendChild(t);
    $('img', t).addEventListener('mouseenter', (e) => this.showTip(e, this.itemTip(item)));
    $('img', t).addEventListener('mouseleave', () => this.hideTip());
    this.lootSound(q);
    const hold = q >= 6 ? 7000 : q >= 4 ? 4500 : 3000;
    this._lootStack.t1 = setTimeout(() => t.classList.add('out'), hold);
    this._lootStack.t2 = setTimeout(() => t.remove(), hold + 600);
    while (box.children.length > 3) box.firstChild.remove();
  }
  // a short card in the toast column (upgrades done, a Prismatic found somewhere in the world)
  noticeToast(cls, html, hold = 4000, item = null) {
    let box = $('.toasts', this.root);
    if (!box) { box = el('div', 'toasts'); this.root.appendChild(box); }
    const t = el('div', 'ltoast ' + cls, html);
    box.appendChild(t);
    const im = $('img', t);
    if (im && item) { im.addEventListener('mouseenter', (e) => this.showTip(e, this.itemTip(item, false))); im.addEventListener('mouseleave', () => this.hideTip()); }
    setTimeout(() => t.classList.add('out'), hold); setTimeout(() => t.remove(), hold + 600);
    while (box.children.length > 3) box.firstChild.remove();
    return t;
  }
  // server-wide: "A Prismatic piece! <names> has found <item> on <mob>." (your own find already has its loot card)
  prismaticNews(ev) {
    const g = ev.item?.gear;
    // your own find already has its own card: skip it (the whole name, so "Al" does not hide news of "Alan")
    const me = this.you?.name, esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!g || (me && new RegExp(`(^|[^\\w])${esc(me)}([^\\w]|$)`).test(String(ev.text || '')))) return;
    this.noticeToast('q6 lt-news', `<img src="${icon(g.icon || 'ring', '#2a2620', 48)}" style="border-color:${QUALITY[6]}"><div><span class="lt-k">A Prismatic piece</span><b style="color:${QUALITY[6]}">${gearName(g)}</b><em>${String(ev.text || '').replace(/^A Prismatic piece! /, '').replace(/</g, '&lt;')}</em></div>`, 6000, { gear: g });
    this.g.sfx?.play('quench', 0.5);
  }
  // the smith finished a step: hammer blows (and a quench from +7, when the steel is worked hot)
  onUpgrade(ev) {
    if (this.upgSel && ev.where) this.upgSel = { where: ev.where, slot: ev.slot };
    const y = this.you, g = ev.where === 'equip' ? y?.equip?.[ev.slot] : y?.bag?.[ev.slot]?.gear;
    this.g.sfx?.play('hammer');
    if (ev.up >= 7) setTimeout(() => this.g.sfx?.play('quench', 0.45), 520);
    const h = HEAT_STAGE[ev.up];
    this.noticeToast('q' + (ev.q ?? 2) + ' lt-upg', `<img src="${icon(g?.icon || 'gear', '#2a2620', 48)}" style="border-color:${QUALITY[ev.q ?? 2]}"><div><span class="lt-k">Upgraded to +${ev.up}${ev.up >= UPG.max ? ': a new socket' : ''}</span><b style="color:${QUALITY[ev.q ?? 2]}">${ev.name}</b>${upPips(ev.up)}${h ? `<em style="color:${h.col}">${h.name} in the steel</em>` : ''}</div>`, 3600, g ? { gear: g } : null);
  }
  // what is on each unit (from 'buff' events), and what a boss is winding up (from telegraphs)
  unitBuff(ev) {
    const now = performance.now() / 1000, M = (this.ubuffs ||= new Map());
    const list = (M.get(ev.id) || []).filter((b) => b.until > now && b.name !== ev.name);
    list.push({ name: ev.name, icon: ev.icon || (ev.cc || 'stun'), debuff: !!ev.debuff, until: now + (ev.dur || 5), dur: ev.dur || 5 });
    M.set(ev.id, list);
  }
  unitCast(id, name, secs) { (this.ucast ||= new Map()).set(id, { name, t0: performance.now() / 1000, secs }); }
  renderTargetExtras(tf, tv) {
    let box = $('.tf-auras', tf), cb = $('.tf-cast', tf);
    if (!box) { box = el('div', 'tf-auras'); tf.appendChild(box); cb = el('div', 'tf-cast hidden', '<i></i><span></span>'); tf.appendChild(cb); }
    const now = performance.now() / 1000;
    const list = (this.ubuffs?.get(tv.id) || []).filter((b) => b.until > now);
    if (this.ubuffs) this.ubuffs.set(tv.id, list);
    const key = list.map((b) => b.name + Math.ceil(b.until - now)).join('|');
    if (box._k !== key) {
      box._k = key;
      box.innerHTML = list.slice(0, 8).map((b) => `<div class="aura ${b.debuff ? 'debuff' : 'buff'}" title="${b.name}"><img src="${SKILL_BY_NAME[b.name] ? skillIcon(SKILL_BY_NAME[b.name]) : buffArt(b) || icon(b.icon || 'flask', b.debuff ? '#4a1410' : '#143a14', 28)}"><span>${Math.ceil(b.until - now)}</span></div>`).join('');
    }
    const c = this.ucast?.get(tv.id);
    if (c && now - c.t0 < c.secs && !tv.dead) {
      cb.classList.remove('hidden');
      $('i', cb).style.width = (Math.min(1, (now - c.t0) / c.secs) * 100).toFixed(1) + '%';
      $('span', cb).textContent = c.name;
    } else cb.classList.add('hidden');
  }
  claimCard(ev) {
    let box = $('.claims', this.root);
    if (!box) { box = el('div', 'claims'); this.root.appendChild(box); }
    const d = itemDef(ev.item);
    if (!d) return;
    // the piece's rarity was settled when it dropped, before anyone claims it: the card shows it plainly
    const q = d.q ?? 1, card = el('div', 'claim q' + q);
    card.innerHTML = `<img src="${icon(d.icon || 'ring', '#3a3226', 44)}" style="border-color:${QUALITY[q]}"><div class="c-mid"><b style="color:${QUALITY[q]}">${gearName(d)}</b><span>${d.stats && q >= 2 ? `<em class="c-rar" style="color:${QUALITY[q]}">${QUALITY_NAME[q]}</em> · ` : ''}${d.ilvl ? `Item Level ${d.ilvl} · ` : ''}from ${ev.from}${d.bd ? ' · bound' : ''}</span><div class="c-bar"><i></i></div></div><div class="c-btns"><button class="want">Claim</button><button class="pass">Pass</button></div>`;
    box.appendChild(card);
    const bar = $('.c-bar i', card);
    bar.style.transition = `width ${ev.secs}s linear`;
    requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = '0%')));
    const done = (want) => { if (!card.isConnected) return; this.g.send({ t: 'claim', cid: ev.cid, want }); card.remove(); this.hideTip(); };
    $('.want', card).onclick = () => done(true);
    $('.pass', card).onclick = () => done(false);
    $('img', card).addEventListener('mouseenter', (e) => this.showTip(e, this.itemTip(ev.item)));
    $('img', card).addEventListener('mouseleave', () => this.hideTip());
    setTimeout(() => { if (card.isConnected) { card.remove(); this.hideTip(); } }, ev.secs * 1000 + 500);
  }
  guildPopup(ev) {
    const pop = $('.invite-pop', this.root);
    pop.innerHTML = `<div><span style="color:${CLASSES[ev.cls]?.color || '#fff'}">${ev.from}</span> invites you to join the guild <b style="color:#7aff9a">&lt;${ev.guild}&gt;</b>.</div><div class="dbtns"><button class="ok">Join</button><button class="no">Decline</button></div>`;
    pop.classList.remove('hidden');
    const done = (accept) => { this.g.send({ t: 'guildReply', accept }); pop.classList.add('hidden'); };
    $('.ok', pop).onclick = () => done(true);
    $('.no', pop).onclick = () => done(false);
    clearTimeout(this._invT); this._invT = setTimeout(() => { if (!pop.classList.contains('hidden')) done(false); }, 55000);
  }
  sharePopup(ev) {
    const pop = $('.invite-pop', this.root), Q = QUESTS[ev.q];
    if (!Q) return;
    pop.innerHTML = `<div><span style="color:${CLASSES[ev.cls]?.color || '#fff'}">${ev.from}</span> shares a quest with you: <b style="color:#ffd060">${Q.name}</b> (level ${Q.lvl}).</div><div class="dbtns"><button class="ok">Accept</button><button class="no">Decline</button></div>`;
    pop.classList.remove('hidden');
    const done = (accept) => { this.g.send({ t: 'shareReply', q: ev.q, accept }); pop.classList.add('hidden'); };
    $('.ok', pop).onclick = () => done(true);
    $('.no', pop).onclick = () => done(false);
    clearTimeout(this._invT); this._invT = setTimeout(() => { if (!pop.classList.contains('hidden')) done(false); }, 55000);
  }
  // quests you chose not to show in the tracker, kept per character in this app profile
  get untracked() { if (!this._untr || this._untrFor !== this.you?.name) { this._untrFor = this.you?.name; try { this._untr = new Set(JSON.parse(localStorage.getItem('sunmere:untrack:' + this._untrFor) || '[]')); } catch { this._untr = new Set(); } } return this._untr; }
  setTracked(id, on) { const u = this.untracked; if (on) u.delete(id); else u.add(id); try { localStorage.setItem('sunmere:untrack:' + this._untrFor, JSON.stringify([...u])); } catch { /* not stored */ } this.renderTracker(); }
  duelPopup(ev) {
    const pop = $('.invite-pop', this.root);
    pop.innerHTML = `<div><span style="color:${CLASSES[ev.cls]?.color || '#fff'}">${ev.from}</span> challenges you to a duel.</div><div class="dbtns"><button class="ok">Accept</button><button class="no">Decline</button></div>`;
    pop.classList.remove('hidden');
    const done = (accept) => { this.g.send({ t: 'duelReply', accept }); pop.classList.add('hidden'); };
    $('.ok', pop).onclick = () => done(true);
    $('.no', pop).onclick = () => done(false);
    clearTimeout(this._invT); this._invT = setTimeout(() => { if (!pop.classList.contains('hidden')) done(false); }, 28000);
  }
  updateTargetActions(tv) {
    const box = $('.tf-actions', this.root);
    let key = '', html = '';
    if (tv && tv.ty === 'p' && tv.id !== this.g.localId) {
      const d = tv.data || {};
      const bot = d.ti && d.ti[0] === '<';
      const inParty = this.partyIds?.has(tv.id);
      const mine = bot && inParty;
      if (mine && d.ti !== '<Escort>') { const st = this.party?.members?.find((m) => m.id === tv.id)?.stance || 'assist'; key = 'dismiss' + tv.id + st; html = ['assist', 'hold', 'passive'].map((o) => `<button data-a="order" data-o="${o}" class="${st === o ? 'on' : ''}">${{ assist: 'Assist', hold: 'Hold', passive: 'Passive' }[o]}</button>`).join('') + `<button data-a="outfit">Outfit</button><button data-a="dismiss">Dismiss</button>`; }
      else if (!bot && this.you?.duel?.with === tv.id) { key = 'yield' + tv.id; html = `<button data-a="yield">Yield the duel</button>`; }
      else if (!bot && !inParty) { const gi = this.you?.guild && d.g !== this.you.guild.name; key = 'invite' + tv.id + !!this.you?.duel + gi; html = `<button data-a="invite">Invite to party</button>${this.you?.duel ? '' : '<button data-a="duel">Duel</button>'}${gi ? '<button data-a="ginvite">Guild</button>' : ''}<button data-a="home">Homestead</button><button data-a="more">More</button>`; }
      else if (!bot && inParty) { key = 'kick' + tv.id + !!this.you?.duel; html = `${this.party?.leader === this.g.localId ? '<button data-a="kick">Remove from party</button>' : ''}${this.you?.duel ? '' : '<button data-a="duel">Duel</button>'}<button data-a="home">Homestead</button><button data-a="more">More</button>`; }
    }
    if (box._k === key) return;
    box._k = key;
    box.innerHTML = html;
    box.classList.toggle('hidden', !html);
    box.onclick = (e) => {
      const a = e.target.closest('button')?.dataset.a;
      const d = tv?.data || {};
      if (a === 'invite') this.g.send({ t: 'chat', text: '/invite ' + d.n });
      if (a === 'kick') this.g.send({ t: 'chat', text: '/kick ' + d.n });
      if (a === 'duel') this.g.send({ t: 'duel', id: tv.id });
      if (a === 'ginvite') this.g.send({ t: 'guildInvite', id: tv.id });
      if (a === 'yield') this.g.send({ t: 'chat', text: '/yield' });
      if (a === 'home') this.g.send({ t: 'inspectHome', id: tv.id });
      if (a === 'dismiss') this.g.send({ t: 'chat', text: '/dismiss ' + (d.n || '') });
      if (a === 'outfit') this.openOutfit(tv.id);
      if (a === 'order') this.g.send({ t: 'compOrder', order: e.target.closest('button').dataset.o, id: tv.id });
      if (a === 'leave') this.g.send({ t: 'chat', text: '/leave' });
      if (a === 'more') { const r = e.target.closest('button').getBoundingClientRect(); this.playerMenu(tv.id, d.n, r.left, r.bottom + 4); }
    };
  }

  // ======================================================== achievements
  get achTracked() {
    if (this._atFor !== this.you?.name) { this._atFor = this.you?.name; try { this._at = JSON.parse(localStorage.getItem('sunmere:achtrack:' + this._atFor) || '[]'); } catch { this._at = []; } }
    return this._at || (this._at = []);
  }
  setAchTracked(ids) {
    this._at = ids.slice(-3);
    try { localStorage.setItem('sunmere:achtrack:' + this._atFor, JSON.stringify(this._at)); } catch { /* not stored */ }
    this.g.send({ t: 'achTrack', ids: this._at });
    this.renderTracker();
  }
  achCounter(m) { if (this.ach?.c) { this.ach.c[m.k] = m.v; clearTimeout(this._atT); this._atT = setTimeout(() => this.renderTracker(), 150); } }
  // another player's homestead: what stands in their yard
  openHomeView(ev) {
    this.windows.homeview?.remove();
    const w = this.makeWindow(`${ev.name}’s Homestead`, 'w-homeview', innerWidth / 2 - 200, 120);
    this.windows.homeview = w;
    const T = HOME_TROPHIES.filter(([k]) => (ev.trophies || []).includes(k)), F = Object.entries(HOME_DECO).filter(([k]) => (ev.deco || []).includes(k));
    $('.wb', w).innerHTML = `<h4>Trophies</h4>${T.length ? T.map(([k, n]) => `<div class="hv-row">${homeArt(k) ? `<img class="hv-ic" src="${homeArt(k)}" alt="">` : '• '}${n}</div>`).join('') : '<div class="hv-row none">None yet.</div>'}
      <h4>Furnishings</h4>${F.length ? F.map(([k, D]) => `<div class="hv-row">${decoArt(k) ? `<img class="hv-ic" src="${decoArt(k)}" alt="">` : '<i class="hv-ic"></i>'}${D.name}</div>`).join('') : '<div class="hv-row none">An empty yard.</div>'}
      <div class="dbtns"><button class="hv-show">Show it on the homestead plot</button></div>`;
    const W = this.g.world;
    const back = () => { if (W.homeVisit) { W.homeVisit = null; W.updateHomestead(); } };
    $('.hv-show', w).onclick = () => { W.homeVisit = { trophies: ev.trophies || [], deco: ev.deco || [] }; W.updateHomestead(); this.chat(`The homestead plot south of Sunmere now shows ${ev.name}’s yard. Close this window to see your own again.`, '#7ab0ff'); };
    const rm = w.remove.bind(w); w.remove = () => { back(); rm(); };
  }
  setAch(m) {
    const firstAch = !this.ach;
    this.ach = m;
    if (firstAch && this.achTracked.length) this.g.send({ t: 'achTrack', ids: this.achTracked });
    // finished achievements leave the tracker by themselves
    if (this.achTracked.some((id) => m.done?.[id])) this.setAchTracked(this.achTracked.filter((id) => !m.done?.[id]));
    else this.renderTracker();
    if (this.windows.ach?.isConnected) this.windows.ach.refresh();
    if (this.windows.journal?.isConnected) this.windows.journal.refresh();
  }
  achToast(id) {
    const a = ACH_BY_ID[id];
    if (!a) return;
    const box = $('.ach-toasts', this.root);
    const t = el('div', 'ach-toast', `<div class="at-ic" style="background-image:url(${achArt(a)})"><span>${a.pts}</span></div><div><div class="at-h">Achievement earned</div><div class="at-n">${a.name}</div><div class="at-d">${a.desc}${a.title ? ` <span class="at-t">Title: ${a.title}</span>` : ''}</div></div>`);
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 5200);
    setTimeout(() => t.remove(), 6000);
  }
  statsHtml(c) {
    const kills = c.kills || 0, played = c.played || 0;
    const rows = [
      ['Time played', played >= 3600 ? `${Math.floor(played / 3600)} h ${Math.floor((played % 3600) / 60)} min` : `${Math.floor(played / 60)} min`],
      ['Machines and raiders defeated', kills], ['Elites defeated', c.elites || 0], ['Rare elites defeated', c.rares || 0], ['Dungeon bosses defeated', c.dbosses || 0],
      ['Deaths', c.deaths || 0], ['Quests completed', c.quests || 0], ['Bounties claimed', c.bounties || 0], ['World events won', c.events || 0],
      ['Coin earned', fmtMoney(c.gold || 0)], ['Things crafted', c.crafts || 0], ['Mosscaps gathered', c.gathers || 0], ['Salvage hauls', c.salvages || 0],
      ['Work orders delivered', c.orders || 0], ['Caravan rides', c.travels || 0], ['Homeward Compass uses', c.recalls || 0], ['Letters sent', c.letters || 0],
      ['Duels won', c.duels || 0], ['Escorts brought home', c.escorts || 0], ['Best Proving Ring wave', c.arena || 0],
    ];
    const top = Object.entries(c).filter(([k]) => k.startsWith('kill:')).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return `<div class="stats-list">${rows.map(([k, v]) => `<div class="st-row"><span>${k}</span><b>${typeof v === 'number' ? v.toLocaleString() : v}</b></div>`).join('')}</div>`
      + (top.length ? `<h4 class="st-h">Most defeated</h4><div class="stats-list">${top.map(([k, v]) => `<div class="st-row"><span>${MOBS[k.slice(5)]?.name || k.slice(5)}</span><b>${v.toLocaleString()}</b></div>`).join('')}</div>` : '');
  }
  winAch() {
    const w = this.makeWindow('Achievements', 'w-ach', Math.max(20, innerWidth / 2 - 330), 60);
    let cat = 'General';
    this.g.send({ t: 'achq' });
    w.refresh = () => {
      const A = this.ach || { c: {}, done: {}, title: '' };
      const pts = ACHIEVEMENTS.reduce((s, a) => s + (A.done[a.id] ? a.pts : 0), 0), max = ACHIEVEMENTS.reduce((s, a) => s + a.pts, 0);
      const nDone = ACHIEVEMENTS.filter((a) => A.done[a.id]).length;
      const titles = ACHIEVEMENTS.filter((a) => a.title && A.done[a.id]);
      // 'Nearly there': unfinished achievements with progress, closest first
      const frac = (a) => { const [h, n] = achProgress(a, A.c, A.done); return n > 0 ? h / n : 0; };
      const near = ACHIEVEMENTS.filter((a) => !A.done[a.id] && frac(a) > 0).sort((a, b) => frac(b) - frac(a)).slice(0, 12);
      const list = cat === 'Nearly there' ? near : ACHIEVEMENTS.filter((a) => a.cat === cat).sort((a, b) => !!A.done[b.id] - !!A.done[a.id]);
      $('.wb', w).innerHTML = `
        <div class="ach-head"><div class="ach-pts"><b>${pts}</b> / ${max} points · ${nDone} of ${ACHIEVEMENTS.length} earned</div>
          <label>Title <select class="ach-title"><option value="">None</option>${titles.map((a) => `<option value="${a.id}" ${A.title === a.id ? 'selected' : ''}>${a.title}</option>`).join('')}</select></label></div>
        <div class="ach-body"><div class="ach-cats"><div class="ach-cat ${cat === 'Nearly there' ? 'on' : ''}" data-c="Nearly there">Nearly there<span>${near.length}</span></div><div class="ach-cat ${cat === 'Statistics' ? 'on' : ''}" data-c="Statistics">Statistics</div>${ACH_CATS.map((c) => { const all = ACHIEVEMENTS.filter((a) => a.cat === c); const d = all.filter((a) => A.done[a.id]).length; return `<div class="ach-cat ${c === cat ? 'on' : ''}" data-c="${c}">${c}<span>${d}/${all.length}</span></div>`; }).join('')}</div>
        <div class="ach-list">${cat === 'Statistics' ? this.statsHtml(A.c) : ''}${cat === 'Statistics' ? '' : list.map((a) => {
          const done = !!A.done[a.id];
          const [have, need] = achProgress(a, A.c, A.done);
          const bar = !done && need > 1 ? `<div class="ach-bar"><i style="width:${(100 * have / need).toFixed(0)}%"></i><span>${a.c === 'gold' ? Math.floor(have / 100) + ' / ' + need / 100 + ' silver' : have + ' / ' + need}</span></div>` : '';
          const when = done && A.done[a.id] > 1 ? new Date(A.done[a.id]).toLocaleDateString() : done ? 'Earned' : '';
          return `<div class="ach ${done ? 'done' : ''}"><div class="ach-ic" style="background-image:url(${achArt(a)})"><span>${a.pts}</span></div><div class="ach-tx"><b>${a.name}</b><div class="ach-d">${a.desc}</div>${a.title ? `<div class="ach-tt">Title: ${a.title}</div>` : ''}${bar}</div><div class="ach-when">${when}${done ? '' : `<button class="ach-trk ${this.achTracked.includes(a.id) ? 'on' : ''}" data-a="${a.id}" title="Show it in the tracker (up to three)">${this.achTracked.includes(a.id) ? 'Tracked' : 'Track'}</button>`}</div></div>`;
        }).join('')}</div></div>`;
      w.querySelectorAll('.ach-cat').forEach((e) => (e.onclick = () => { cat = e.dataset.c; w.refresh(); }));
      w.querySelectorAll('.ach-trk').forEach((b) => (b.onclick = () => { const id = b.dataset.a, T = this.achTracked; this.setAchTracked(T.includes(id) ? T.filter((x) => x !== id) : [...T, id]); w.refresh(); }));
      const sel = $('.ach-title', w);
      sel.onchange = () => this.g.send({ t: 'title', id: sel.value });
      sel.addEventListener('keydown', (e) => e.stopPropagation());
    };
    w.refresh();
    return w;
  }

  // ======================================================== the Valley Journal: every enemy you have met
  journalData() {
    if (this._jd) return this._jd;
    // in an open region (the Deepway) name the area inside it: 'the Weigh Galleries, the Deepway'
    const where = (sp) => (sp.dungeon && DUNGEONS.find((d) => d.id === sp.dungeon)?.open ? `${zoneAt(sp.x, sp.z).name}, ${DUNGEONS.find((d) => d.id === sp.dungeon).name}` : sp.dungeon ? DUNGEONS.find((d) => d.id === sp.dungeon)?.name : placeName(zoneAt(sp.path ? sp.path[0][0] : sp.x, sp.path ? sp.path[0][1] : sp.z).id));
    this._jd = Object.entries(MOBS).map(([k, m]) => {
      const sps = SPAWNS.filter((s) => s.mob === k);
      const lv = sps.map((s) => s.lvl || m.lvl).flat();
      const lo = Math.min(...lv, m.lvl[0]), hi = Math.max(...lv, m.lvl[1]);
      const T = LOOT_TABLES[m.loot];
      const drops = (T?.items || []).filter(([i]) => ITEMS[i] && ((ITEMS[i].q ?? 0) >= 3 || ITEMS[i].slot === 'quest' || ITEMS[i].set)).map(([i]) => i);
      return { k, m, lo, hi, zones: [...new Set(sps.map(where).filter(Boolean))], drops };
    }).sort((a, b) => a.lo - b.lo || a.k.localeCompare(b.k));
    return this._jd;
  }
  winJournal() {
    const w = this.makeWindow('Valley Journal', 'w-journal', Math.max(20, innerWidth / 2 - 330), 60);
    this.g.send({ t: 'achq' });
    let sel = null, tab = this.journalTab || 'foes', page = null, gsel = null;
    w.refresh = () => {
      const tabs = `<div class="post-tabs"><button data-jt="foes" class="${tab === 'foes' ? 'on' : ''}">Bestiary</button><button data-jt="guide" class="${tab === 'guide' ? 'on' : ''}">Dungeons &amp; Loot</button><button data-jt="armory" class="${tab === 'armory' ? 'on' : ''}">Armory (${this.ach?.c?.found || 0}/${ARMORY_TOTAL})</button><button data-jt="coll" class="${tab === 'coll' ? 'on' : ''}">Collections</button><button data-jt="ledger" class="${tab === 'ledger' ? 'on' : ''}">The Lost Ledger (${(this.you.ledger || []).length}/${LEDGER.length})</button></div>`;
      const wireTabs = () => w.querySelectorAll('[data-jt]').forEach((b) => (b.onclick = () => { tab = this.journalTab = b.dataset.jt; w.refresh(); }));
      if (tab === 'coll') {
        const y = this.you, owned = y.pets || {};
        // where a pet comes from: a shop, or a rare elite's loot (with the chance)
        const petSrc = (k) => {
          const id = 'pet_' + k, out = [];
          for (const [v, list] of Object.entries(VENDORS)) if (list.includes(id)) { const n = NPCS.find((x) => x.vendor === v); out.push(`Sold by ${n ? n.name : 'a merchant'}${n ? ' in ' + zoneAt(n.x, n.z).name : ''}`); }
          for (const [mk, m] of Object.entries(MOBS)) { const e = LOOT_TABLES[m.loot]?.items.find(([i]) => i === id); if (e) out.push(`Carried by ${m.name}${m.rare ? ', a rare elite' : ''} (${Math.round(e[1] * 100)}% each time it falls)`); }
          return out.join('; ') || `From ${PETS[k].from}`;
        };
        const paintNeed = (P) => (!P.need ? 'Every runabout comes in it' : P.need.rep ? `${REP_RANKS[P.need.rank]?.name} with the ${FACTIONS[P.need.rep]?.name}` : P.need.ach ? `Earn \u201c${ACH_BY_ID[P.need.ach]?.name || P.need.ach}\u201d` : '');
        const paintHave = (P) => (!P.need ? true : P.need.rep ? repRank(y.rep?.[P.need.rep] || 0) >= P.need.rank : P.need.ach ? !!this.ach?.done?.[P.need.ach] : false);
        const pk = Object.keys(PETS), pn = pk.filter((k) => owned[k]).length, ck = Object.keys(PAINTS), cn = ck.filter((k) => paintHave(PAINTS[k])).length;
        $('.wb', w).innerHTML = tabs + `<div class="co-wrap"><div class="co-sec"><div class="dg-sh">Clockwork pets <span>${pn} of ${pk.length}</span></div><div class="co-grid">${pk.map((k) => { const P = PETS[k], it = ITEMS['pet_' + k], have = !!owned[k]; return `<div class="co-card ${have ? 'got' : 'miss'}"><img src="${icon(it?.icon || 'gear', '#3a3226', 48)}"><div><b>${P.name}</b><span>${petSrc(k)}</span>${have ? `<button class="co-pet" data-p="${k}">${y.pet === k ? 'Send home' : 'Summon'}</button>` : '<em>Not found yet</em>'}</div></div>`; }).join('')}</div></div>
          <div class="co-sec"><div class="dg-sh">Runabout paints <span>${cn} of ${ck.length}</span></div><div class="co-grid">${ck.map((k) => { const P = PAINTS[k], have = paintHave(P); return `<div class="co-card ${have ? 'got' : 'miss'}">${miscArt('paint_' + k) ? `<img class="co-sw co-paint" src="${miscArt('paint_' + k)}" alt="">` : `<i class="co-sw" style="background:linear-gradient(135deg, ${P.body} 0 62%, ${P.trim || '#d9a650'} 62% 78%, ${P.seat || '#3a2a1c'} 78%)"></i>`}<div><b>${P.name}</b><span>${paintNeed(P)}</span>${have ? `<em class="co-ok">${y.paint === k ? 'On your runabout' : y.runabout ? 'Unlocked: Gearwright Ottmar applies it' : 'Unlocked'}</em>` : '<em>Not unlocked yet</em>'}</div></div>`; }).join('')}</div></div></div>`;
        w.querySelectorAll('.co-pet').forEach((b) => (b.onclick = () => this.g.send({ t: 'pet', id: y.pet === b.dataset.p ? null : b.dataset.p })));
        wireTabs();
        return;
      }
      if (tab === 'armory') {
        const y = this.you || {}, c = this.ach?.c || {}, have = (id) => !!c['found:' + id];
        // best: the best rarity of each named piece you have held (rolled pieces drop at any rarity from Uncommon up)
        const best = (id) => armoryBest(c, id) ?? (ITEMS[id]?.q ?? 1);
        if (!this.armSel || !ARMORY.some((C) => C.id === this.armSel)) this.armSel = ARMORY[0].id;
        const C = ARMORY.find((x) => x.id === this.armSel), count = (ids) => ids.filter(have).length;
        const all = ARMORY_TOTAL, got = Object.keys(c).filter((k) => k.startsWith('found:')).length;
        const list = ARMORY.map((x) => { const ids = x.groups.flatMap((g) => g.items); return `<div class="jr ${x.id === C.id ? 'on' : ''}" data-ac="${x.id}"><span>${x.name}</span><em>${count(ids)}/${ids.length}</em></div>`; }).join('');
        const shelves = C.groups.map((g) => `<div class="ar-grp"><div class="ar-gh">${g.name}<em>${count(g.items)}/${g.items.length}</em></div><div class="ar-tiles">${g.items.map((id) => { const it = ITEMS[id], q = have(id) ? best(id) : it.q ?? 1, rolled = ARMORY_ROLLED.has(id); return `<div class="ar-tile ${have(id) ? 'got' : 'miss'} aq${q}" data-i="${id}" style="--qc:${QUALITY[q]}"><img src="${icon(it.icon, '#3a3226', 64)}">${have(id) ? rolled ? `<i class="ar-q" style="background:${QUALITY[q]}"></i>` : '' : '<b>?</b>'}</div>`; }).join('')}</div></div>`).join('');
        // Tempering: shown openly, never sold. Endgame boss kills count toward a certain Legendary and a certain Prismatic.
        const T = y.temper, tm = T ? `<div class="ar-temper"><div class="at-h">Tempering <span>endgame bosses, level 50 and up</span></div>
          <div class="at-row"><span class="at-l" style="color:${QUALITY[5]}">Legendary</span><div class="at-bar g"><i style="width:${Math.min(100, T.g / T.golden * 100).toFixed(1)}%"></i></div><em>${T.g} of ${T.golden}: certain within ${T.goldenIn} kill${T.goldenIn === 1 ? '' : 's'}</em></div>
          <div class="at-row"><span class="at-l" style="color:${QUALITY[6]}">Prismatic</span><div class="at-bar p"><i style="width:${Math.min(100, T.p / T.prisAt * 100).toFixed(1)}%"></i><s style="left:${(T.prisFrom / T.prisAt * 100).toFixed(1)}%"></s></div><em>${T.p} of ${T.prisAt}: ${T.p < T.prisFrom ? `Tempering starts adding after ${T.prisFrom - T.p} more` : `Tempering now gives ${(T.prisBonus * 100).toFixed(2)}% on every kill`}, certain within ${T.prisIn} kill${T.prisIn === 1 ? '' : 's'}</em></div></div>` : '';
        $('.wb', w).innerHTML = tabs + `<div class="ar-head"><span>Every named piece you have held stays on your shelf, even after you sell it. Each tile shows the best rarity you have held.</span><div class="ar-bar"><i style="width:${(got / all * 100).toFixed(1)}%"></i><b>${got} of ${all} found</b></div></div>${tm}<div class="jr-body"><div class="jr-list dg-list">${list}</div><div class="jr-detail dg-detail ar-detail">${shelves}</div></div>`;
        w.querySelectorAll('[data-ac]').forEach((e) => (e.onclick = () => { this.armSel = e.dataset.ac; w.refresh(); }));
        w.querySelectorAll('.ar-tile').forEach((e) => {
          e.addEventListener('mouseenter', (ev) => {
            const id = e.dataset.i, it = ITEMS[id], bq = best(id), bestLine = ARMORY_ROLLED.has(id) ? `<div class="tt-src">Best you have held: <span style="color:${QUALITY[bq]}">${QUALITY_NAME[bq]}</span>. It drops at any rarity from Uncommon to Prismatic.</div>` : '';
            this.showTip(ev, have(id) ? this.itemTip({ id }, false) + bestLine + `<div class="tt-src">${ARMORY_SRC[id]}</div>` : `<div class="tt-name" style="color:${QUALITY[it.q ?? 1]};opacity:.75">${it.name}</div><div class="tt-sub">${[SLOT_LABEL[it.slot], typeLine(it)].filter(Boolean).join(' · ')}</div>${it.classes ? `<div class="tt-sub">For ${it.classes.map((c) => CLASSES[c]?.name + 's').join(' and ')}</div>` : ''}<div class="tt-notyet">Not found yet</div>${ARMORY_ROLLED.has(id) ? '<div class="tt-src">It drops at any rarity from Uncommon to Prismatic.</div>' : ''}<div class="tt-src">${ARMORY_SRC[id]}</div>`);
          });
          e.addEventListener('mouseleave', () => this.hideTip());
        });
        wireTabs();
        return;

      }
      if (tab === 'guide') {
        const G = this.guideData();
        if (!gsel) gsel = G.dungeons[0].id;
        $('.wb', w).innerHTML = tabs + `<div class="jr-body"><div class="jr-list dg-list"><div class="dg-grp">Dungeons</div>${G.dungeons.map((D) => `<div class="jr ${gsel === D.id ? 'on' : ''}" data-g="${D.id}"><span>${D.name}</span><em>${D.level}</em></div>`).join('')}<div class="dg-grp">World bosses</div>${G.world.map((k) => `<div class="jr ${gsel === k ? 'on' : ''}" data-g="${k}"><span>${MOBS[k].name}</span><em>${MOBS[k].lvl[0]}</em></div>`).join('')}<div class="dg-grp">Treasures</div><div class="jr ${gsel === '_leg' ? 'on' : ''}" data-g="_leg"><span>Legendary weapons</span><em>${LEGENDARIES.length}</em></div><div class="jr ${gsel === '_tmp' ? 'on' : ''}" data-g="_tmp"><span>${SETS.tempest?.name || 'Tempest set'}</span><em>25</em></div></div><div class="jr-detail dg-detail">${this.guidePage(gsel)}</div></div>`;
        w.querySelectorAll('[data-g]').forEach((e) => (e.onclick = () => { gsel = e.dataset.g; w.refresh(); }));
        w.querySelectorAll('.lcard').forEach((e) => { e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip({ id: e.dataset.i }, false))); e.addEventListener('mouseleave', () => this.hideTip()); });
        wireTabs();
        return;
      }
      if (tab === 'ledger') {
        const have = new Set(this.you.ledger || []);
        if (!page || !have.has(page)) page = LEDGER.find((L) => have.has(L.id))?.id || null;
        const P = LEDGER.find((L) => L.id === page);
        $('.wb', w).innerHTML = tabs + `<div class="jr-body"><div class="jr-list">${LEDGER.map((L, i) => have.has(L.id) ? `<div class="jr ${L.id === page ? 'on' : ''}" data-pg="${L.id}"><span>${i + 1}. ${L.title}</span></div>` : `<div class="jr unknown"><span>${i + 1}. Somewhere in ${L.where}</span></div>`).join('')}</div><div class="jr-detail">${P ? `<h3>${P.title}</h3><div class="letter"><div class="l-body">${P.text}</div></div><div class="jr-kills">Found in ${P.where}.</div>` : '<p class="qtext">Hollin Marsh, a clerk of the Old Foundry, hid the pages of his ledger along the roads of the valley. Look for a leather folio left on a flat stone, glinting in the grass.</p>'}</div></div>`;
        w.querySelectorAll('[data-pg]').forEach((e) => (e.onclick = () => { page = e.dataset.pg; w.refresh(); }));
        wireTabs();
        return;
      }
      const c = this.ach?.c || {}, J = this.journalData();
      const seen = J.filter((e) => c['kill:' + e.k] > 0);
      if (!sel || !c['kill:' + sel]) sel = seen[0]?.k || null;
      const tag = (m) => (m.boss ? 'Boss' : m.rare ? 'Rare' : m.elite ? 'Elite' : m.humanoid ? 'Raider' : 'Machine');
      const E = J.find((e) => e.k === sel);
      $('.wb', w).innerHTML = tabs + `<div class="jr-head">${seen.length} of ${J.length} enemies recorded</div><div class="jr-body"><div class="jr-list">${J.map((e) => {
        const n = c['kill:' + e.k] || 0;
        return n ? `<div class="jr ${e.k === sel ? 'on' : ''} t-${tag(e.m).toLowerCase()}" data-k="${e.k}"><span>${e.m.name}</span><em>${e.lo === e.hi ? e.lo : e.lo + '-' + e.hi}</em></div>` : `<div class="jr unknown"><span>Unknown</span><em>${e.lo === e.hi ? e.lo : e.lo + '-' + e.hi}</em></div>`;
      }).join('')}</div><div class="jr-detail">${E ? `
        ${PORTRAITS.has(E.k) ? `<img class="jr-portrait" src="/sunmere-play/ui/portraits/${E.k}.webp">` : ''}<h3>${E.m.name}</h3><div class="jr-tag t-${tag(E.m).toLowerCase()}">${tag(E.m)} · level ${E.lo === E.hi ? E.lo : E.lo + '-' + E.hi}${E.m.ranged ? ' · fights at range' : ''}</div>
        <div class="jr-row"><b>Found in</b> ${E.zones.join(', ') || 'the wilds'}</div>
        <div class="jr-row"><b>Health</b> about ${Math.round(E.m.hp)} at level ${E.m.lvl[0]} · <b>Hits</b> ${E.m.dmg[0]}-${E.m.dmg[1]} at level ${E.m.lvl[0]}</div>
        ${(E.m.abilities || []).filter((a) => a.text).map((a) => `<div class="jr-ab">${a.kind === 'circles' ? 'Ground strikes' : a.kind === 'nova' ? 'Blast around itself' : 'Enrages'}: <i>${a.text}</i></div>`).join('')}
        ${E.drops.length ? `<div class="jr-row"><b>Notable drops</b></div><div class="jr-drops">${E.drops.map((i) => `<span class="jr-drop" data-i="${i}" style="color:${QUALITY[ITEMS[i].q ?? 1]}">${ITEMS[i].name}</span>`).join('')}</div>` : ''}
        <div class="jr-kills">You have defeated ${c['kill:' + E.k]}.</div>` : '<p class="qtext">Defeat an enemy to record it here.</p>'}</div></div>`;
      w.querySelectorAll('.jr[data-k]').forEach((e) => (e.onclick = () => { sel = e.dataset.k; w.refresh(); }));
      wireTabs();
      w.querySelectorAll('.jr-drop').forEach((e) => { e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip({ id: e.dataset.i }, false))); e.addEventListener('mouseleave', () => this.hideTip()); });
    };
    // refreshes (every update from the server, each new find) keep where you had scrolled to, unless you changed page
    const render = w.refresh;
    w.refresh = () => {
      const key = [tab, this.armSel, gsel, sel, page].join('|'), same = key === w._rkey;
      const keep = same ? [...w.querySelectorAll('.jr-list, .jr-detail')].map((e) => e.scrollTop) : null, wbTop = same ? $('.wb', w).scrollTop : 0;
      render();
      w._rkey = [tab, this.armSel, gsel, sel, page].join('|');
      if (keep && w._rkey === key) { w.querySelectorAll('.jr-list, .jr-detail').forEach((e, i) => { if (keep[i] != null) e.scrollTop = keep[i]; }); $('.wb', w).scrollTop = wbTop; }
    };
    w.refresh();
    return w;
  }

  // ---- the Dungeons & Loot guide: every dungeon's bosses and elites with their own drops, sets, world bosses, legendaries
  guideData() {
    if (this._guide) return this._guide;
    const lv = (s) => parseInt(String(s).split('-')[0], 10) || 0;
    const dungeons = [...DUNGEONS].sort((a, b) => lv(a.level) - lv(b.level)).map((D) => {
      const seen = new Set(), foes = [];
      for (const s of SPAWNS) if (s.dungeon === D.id && !seen.has(s.mob) && (MOBS[s.mob]?.boss || MOBS[s.mob]?.elite)) { seen.add(s.mob); foes.push(s.mob); }
      foes.sort((a, b) => (MOBS[a].boss ? 1 : 0) - (MOBS[b].boss ? 1 : 0));
      return { id: D.id, name: D.name, level: D.level, door: D.door, foes };
    });
    const world = Object.entries(MOBS).filter(([, m]) => m.world).map(([k]) => k);
    return (this._guide = { dungeons, world });
  }
  // the gear a foe carries by name (its own pieces and rewards, not the random rolls or set pieces)
  dropsOf(mob) {
    const T = LOOT_TABLES[MOBS[mob]?.loot];
    return T ? [...new Set(T.items.map(([i]) => i))].filter((i) => ITEMS[i]?.stats && (ITEMS[i].q ?? 1) >= 2 && !ITEMS[i].set) : [];
  }
  lootCard(id) {
    const it = ITEMS[id], q = it.q ?? 1;
    return `<div class="lcard" data-i="${id}" style="--qc:${QUALITY[q]}"><img src="${icon(it.icon, '#3a3226', 64)}"><div><b>${it.name}</b><span>${[SLOT_LABEL[it.slot], typeLine(it)].filter(Boolean).join(' \u00b7 ')}</span></div></div>`;
  }
  guidePage(g) {
    const G = this.guideData();
    const abil = (m) => (m.abilities || []).map((a) => {
      const what = a.kind === 'circles' ? 'Ground strikes' : a.kind === 'nova' ? 'Blast around itself' : a.kind === 'beam' ? 'Beam' : a.kind === 'adds' ? `Calls in ${MOBS[a.mob]?.name || 'help'}${a.n > 1 ? ` (×${a.n})` : ''} at ${Math.round(a.at * 100)}% health` : a.kind === 'enrage' ? `Enrages at ${Math.round(a.at * 100)}% health` : a.kind;
      return `<div class="dg-ab"><b>${what}</b>${a.every ? ` every ${a.every} s` : ''}${a.text ? `: <i>${a.text}</i>` : ''}</div>`;
    }).join('');
    const foe = (k, tag) => { const m = MOBS[k], drops = this.dropsOf(k); return `<div class="dg-foe"><div class="dg-fh">${PORTRAITS.has(k) ? `<img class="dg-por" src="/sunmere-play/ui/portraits/${k}.webp">` : ''}<div><b>${m.name}</b><em>${tag || (m.boss ? 'Final boss' : 'Elite')}</em></div></div>${abil(m)}<div class="dg-loot">${drops.map((i) => this.lootCard(i)).join('') || '<i class="dg-none">Coin and random gear only</i>'}</div></div>`; };
    const setBlock = (S, where) => S ? `<div class="dg-set"><div class="dg-sh">${S.name}<span>${S.pieces.length} pieces ${where}</span></div><div class="dg-loot">${S.pieces.map((i) => this.lootCard(i)).join('')}</div><div class="dg-bonus">${Object.entries(S.bonus).map(([n, fx]) => `<div>(${n}) Set: ${fx.map((e) => describeEffect(e)).join(', ')}</div>`).join('')}</div></div>` : '';
    const head = (art, title, sub) => `<div class="dg-head" style="background-image:url('/sunmere-play/ui/loading/${art}.webp')"><div><h3>${title}</h3><span>${sub}</span></div></div>`;
    const D = G.dungeons.find((d) => d.id === g);
    if (D) return head(ZONE_ART[D.id] || artAt(D.door.x, D.door.z), D.name, `Level ${D.level} \u00b7 Heroic from level 23 \u00b7 Tempest at level 25`) + D.foes.map((k) => foe(k)).join('') + setBlock(SETS[D.id], 'from the bosses here');
    if (g === '_leg') return head('storm', 'Legendary Weapons', 'One for each weapon type: 8% from Tempest bosses, 2% in Heroic, 6% from world bosses') + `<div class="dg-legs">${LEGENDARIES.map((id) => { const L = ITEMS[id]; return `<div class="dg-leg">${this.lootCard(id)}<p><b>Equip:</b> ${L.power}</p><p class="dg-for">${(L.classes || []).map((c) => CLASSES[c]?.name || c).join(', ')}</p></div>`; }).join('')}</div>`;
    if (g === '_tmp') return head('storm', SETS.tempest?.name || 'Tempest set', 'Dropped by bosses in Tempest mode (level 25)') + `<div class="dg-mods"><div class="dg-sh">This week in the Tempest</div>${tempestMods().map((k) => `<div class="dg-mod"><b>${TEMPEST.mods[k].name}</b> ${TEMPEST.mods[k].desc}</div>`).join('')}<div class="dg-none">Three modifiers each week from a fixed rotation; they change on Monday.</div></div>` + setBlock(SETS.tempest, 'from Tempest bosses');
    if (MOBS[g]) { const sp = SPAWNS.find((s) => s.mob === g), at = sp ? (sp.path ? sp.path[0] : [sp.x, sp.z]) : [0, 0]; return head(artAt(at[0], at[1]), MOBS[g].name, `World boss \u00b7 level ${MOBS[g].lvl[0]} \u00b7 roams ${zoneAt(at[0], at[1]).name} \u00b7 everyone who fights it gets their own loot`) + foe(g, 'World boss'); }
    return '';
  }

  winOptions() {
    const w = this.makeWindow('Options', 'w-opts', Math.max(20, innerWidth / 2 - 190), 110);
    const applyScale = () => this.root.style.setProperty('--ui-scale', SETTINGS.uiScale);
    // Esc menu bar: Resume and Exit game (saves first; closes the desktop window or the Android app)
    const bar = el('div', 'o-exitbar', `<button data-x="resume">Resume</button><button data-x="exit" class="o-exit">Exit game</button>`);
    w.insertBefore(bar, $('.wb', w));
    bar.querySelector('[data-x=resume]').onclick = () => { this.g.sfx?.play('ui'); w.remove(); };
    bar.querySelector('[data-x=exit]').onclick = () => {
      this.g.sfx?.play('ui');
      if (window.confirm('Exit Sunmere Online? Your progress is saved.')) exitGame();
    };
    // phones and tablets: three tabs (General, Touch, Keys); the desktop keeps the one long page
    if (IS_TOUCH) {
      const tabs = el('div', 'post-tabs o-tabs', [['gen', 'General'], ['touch', 'Touch'], ['keys', 'Keys']].map(([k, n]) => `<button data-ot="${k}">${n}</button>`).join(''));
      w.insertBefore(tabs, $('.wb', w));
      tabs.querySelectorAll('button').forEach((b) => (b.onclick = () => { this.optTab = b.dataset.ot; this.g.sfx?.play('ui'); w.refresh(); }));
    }
    w.refresh = () => {
      $('.wb', w).innerHTML = `
        <h4>Sound</h4>
        <label class="opt"><span>Volume</span><input type="range" class="o-vol" min="0" max="1" step="0.05" value="${SETTINGS.volume}"><b class="o-volv">${Math.round(SETTINGS.volume * 100)}%</b></label>
        <label class="opt chk"><input type="checkbox" class="o-mute" ${SETTINGS.muted ? 'checked' : ''}> Mute all sound</label>
        <label class="opt chk"><input type="checkbox" class="o-voice" ${SETTINGS.voiceAmb !== false ? 'checked' : ''}> Voice ambience: quiet wordless men's humming under towns at night, dungeons and the menu (no music; it fades under combat${IS_MOBILE ? '; one lighter layer on phones' : ''})</label>
        <label class="opt chk"><input type="checkbox" class="o-bg" ${SETTINGS.bgMute ? 'checked' : ''}> Silent when the game is in the background</label>
        <label class="opt chk"><input type="checkbox" class="o-fog" ${SETTINGS.mapFog !== false ? 'checked' : ''}> World map: hide places you have not explored yet</label>
        <label class="opt chk"><input type="checkbox" class="o-junk" ${SETTINGS.autoJunk ? 'checked' : ''}> Sell Poor-quality gear automatically when I talk to a merchant (it stays in Buyback)</label>
        <label class="opt chk"><input type="checkbox" class="o-trail" ${SETTINGS.questTrail !== false ? 'checked' : ''}> Quest trail: faint prints on the ground show the way to your tracked quest (${IS_TOUCH ? 'tap' : 'click'} a quest in the tracker to walk there)</label>
        <h4>Graphics</h4>
        <div class="opt"><span>Quality</span><div class="o-q">${Object.entries(QUALITY_PRESETS).filter(([, q]) => !IS_MOBILE || q.mobile).map(([k, q]) => `<button data-q="${k}" class="${SETTINGS.quality === k ? 'on' : ''}">${q.label}</button>`).join('')}</div></div>
        ${SETTINGS.quality === 'ultra' ? '<div class="o-qhint">Ultra adds crisper light shafts and softer shadow edges. It costs only a little more than High.</div>' : ''}
        ${IS_MOBILE && !SETTINGS.qualityPicked && SETTINGS.qualityAuto ? '<div class="o-qhint">Picked to suit the graphics chip in this device. Mobile High is sharpest (smooth edges); Mobile and Mobile Low run cooler.</div>' : ''}
        <div class="o-note">Quality changes take effect when the world view reloads. <a class="o-reload">Reload now</a></div>
        <label class="opt chk"><input type="checkbox" class="o-shake" ${SETTINGS.shake ? 'checked' : ''}> Camera shake on big hits</label>
        <div class="opt o-trow"><span>Others' effects</span><div class="o-seg o-ofx">${OTHERS_FX.map(([v, n]) => `<button data-v="${v}" class="${SETTINGS.othersFx === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="o-note">How much of other heroes' and bots' fusions you see. Your party always shows more, far casters show only dust, and in a crowd the others drop to the contact flash. Minimal is lightest on the phone.</div>
        <label class="opt chk"><input type="checkbox" class="o-perfhud" ${SETTINGS.perfHud ? 'checked' : ''}> Performance readout: frame rate, frame times and draw counts in a small corner panel, with Copy and a 20 s Bench here</label>
        <label class="opt chk"><input type="checkbox" class="o-herobody" ${SETTINGS.heroBody !== false ? 'checked' : ''}> New hero body: the reworked body and animation for every hero and townsperson (untick for the old body). Takes effect when the world view reloads.</label>
        ${IS_TOUCH ? '' : `<h4>Camera</h4>${this.freeCamHtml()}`}
        ${IS_TOUCH ? '' : '<h4>Performance</h4>' + this.perfOptsHtml()}
        <h4>Combat</h4>
        <label class="opt chk"><input type="checkbox" class="o-fusealt" ${SETTINGS.fuseAlt ? 'checked' : ''}> ${IS_TOUCH ? 'Fuse only with a two-finger tap (a one-finger tap casts the second skill plain)' : 'Fuse only while Alt is held (without Alt the second skill casts plain)'}</label>
        ${IS_TOUCH ? `<label class="opt chk"><input type="checkbox" class="o-vib" ${SETTINGS.vibrate !== false ? 'checked' : ''}> Vibration: a light tick when a fusion window opens, and a short buzz on your big hits (stronger for the biggest)</label>` : ''}
        <h4>Interface</h4>
        <div class="opt"><span>Interface size</span><div class="o-s">${[0.85, 1, 1.15, 1.3].map((v) => `<button data-s="${v}" class="${SETTINGS.uiScale === v ? 'on' : ''}">${Math.round(v * 100)}%</button>`).join('')}</div></div>
        ${this.botChatHtml()}
        <h4>Keys</h4><div class="o-kb">${KEY_ACTIONS.map(([a, label]) => `<div class="kb"><span>${label}</span><button data-k="${a}" class="${this._rebind === a ? 'wait' : ''}">${this._rebind === a ? 'Press a key...' : keyLabel(SETTINGS.keys[a])}</button></div>`).join('')}</div>
        <div class="o-note">${IS_TOUCH ? 'Tap a key, then press the new one on your keyboard' : 'Click a key, then press the new one'} (Esc cancels). Skills stay on 1-0 and Shift+1-0; arrow keys always move. <a class="o-kreset">Reset keys</a></div>`;
      if (IS_TOUCH) this.optTouch(w);
      this.bindPerfOpts(w);
      const set = () => { saveSettings(); this.g.sfx?.applyVolume(); };
      const vol = $('.o-vol', w); vol.oninput = () => { SETTINGS.volume = Number(vol.value); $('.o-volv', w).textContent = Math.round(SETTINGS.volume * 100) + '%'; set(); };
      $('.o-mute', w).onchange = (e) => { SETTINGS.muted = e.target.checked; set(); };
      $('.o-voice', w).onchange = (e) => { SETTINGS.voiceAmb = e.target.checked; set(); };
      $('.o-bg', w).onchange = (e) => { SETTINGS.bgMute = e.target.checked; set(); };
      const mf = $('.o-fog', w); if (mf) mf.onchange = (e) => { SETTINGS.mapFog = e.target.checked; set(); if (this.windows.map?.isConnected) this.windows.map.refresh(); };
      const mj = $('.o-junk', w); if (mj) mj.onchange = (e) => { SETTINGS.autoJunk = e.target.checked; set(); };
      const qt = $('.o-trail', w); if (qt) qt.onchange = (e) => { SETTINGS.questTrail = e.target.checked; set(); };
      $('.o-shake', w).onchange = (e) => { SETTINGS.shake = e.target.checked; set(); };
      w.querySelectorAll('.o-ofx button').forEach((b) => (b.onclick = () => { SETTINGS.othersFx = b.dataset.v; set(); this.g.sfx?.play('ui'); w.refresh(); })); // (S14: live, fx.js reads it on each cast)
      $('.o-perfhud', w).onchange = (e) => { SETTINGS.perfHud = e.target.checked; set(); this.perfHud?.setOn(SETTINGS.perfHud); };
      { const fa = $('.o-fusealt', w); if (fa) fa.onchange = (e) => { SETTINGS.fuseAlt = e.target.checked; set(); }; const vb = $('.o-vib', w); if (vb) vb.onchange = (e) => { SETTINGS.vibrate = e.target.checked; set(); }; }
      const hb = $('.o-herobody', w); if (hb) hb.onchange = (e) => { SETTINGS.heroBody = e.target.checked; set(); }; // (assets/hero/heroBody.js reads it at load)
      this.bindFreeCam(w);
      this.bindBotChat(w);
      w.querySelectorAll('.o-q button').forEach((b) => (b.onclick = () => { SETTINGS.quality = b.dataset.q; SETTINGS.qualityPicked = true; set(); w.refresh(); })); // a picked quality wins over the phone's auto pick (settings.js)
      w.querySelectorAll('.o-s button').forEach((b) => (b.onclick = () => { SETTINGS.uiScale = Number(b.dataset.s); set(); applyScale(); w.refresh(); }));
      $('.o-reload', w).onclick = () => location.reload();
      w.querySelectorAll('.o-kb button').forEach((b) => (b.onclick = () => {
        this._rebind = b.dataset.k; w.refresh();
        this.keyCapture = (code) => {
          this.keyCapture = null;
          const a = this._rebind; this._rebind = null;
          if (code !== 'Escape' && !/^Digit/.test(code) && !/^(Shift|Control|Alt|Meta)/.test(code)) {
            for (const [o] of KEY_ACTIONS) if (o !== a && SETTINGS.keys[o] === code) SETTINGS.keys[o] = SETTINGS.keys[a]; // swap with whatever had it
            SETTINGS.keys[a] = code; saveSettings();
          }
          this.slots?.forEach((sl, i) => { const k = $('.key', sl.el); if (k) k.textContent = skillKeyLabel(i, true); }); // Q/E/T/V labels on the bar
          w.refresh();
        };
      }));
      $('.o-kreset', w).onclick = () => { SETTINGS.keys = Object.fromEntries(KEY_ACTIONS.map(([a, , k]) => [a, k])); saveSettings(); this.slots?.forEach((sl, i) => { const k = $('.key', sl.el); if (k) k.textContent = skillKeyLabel(i, true); }); w.refresh(); };
      w.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
    };
    w.refresh();
    return w;
  }

  // the Options window on a phone or tablet: splits the page into General / Touch / Keys and builds the Touch tab
  // (SETTINGS.touch: writers set the field, then saveSettings(), then touchSettingsChanged())
  optTouch(w) {
    const tab = this.optTab || 'gen', wb = $('.wb', w);
    w.querySelectorAll('.o-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.ot === tab));
    // General: everything but the keys (and the desktop interface size: the touch HUD has its own, on the Touch tab)
    const kh = [...wb.children].findIndex((n) => n.tagName === 'H4' && n.textContent === 'Keys');
    const kids = [...wb.children];
    kids.forEach((n, i) => { const keys = kh >= 0 && i >= kh; n.classList.toggle('o-hide', tab === 'touch' || (tab === 'gen' ? keys : !keys)); });
    { const r = wb.querySelector('.o-s')?.closest('.opt'); r?.classList.add('o-hide'); if (r?.previousElementSibling?.tagName === 'H4') r.previousElementSibling.classList.add('o-hide'); } // and its now empty heading
    if (tab === 'keys' && kh >= 0) wb.insertAdjacentHTML('afterbegin', '<div class="o-note o-ktip">Keys are for a keyboard joined to your phone or tablet.</div>');
    if (tab !== 'touch') return;
    const T = SETTINGS.touch;
    const seg = (f, opts) => `<div class="o-seg" data-f="${f}">${opts.map(([v, n]) => `<button data-v="${v}" class="${String(T[f]) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const row = (label, ctl, hint = '') => `<div class="opt o-trow"><span>${label}</span>${ctl}</div>${hint ? `<div class="o-note">${hint}</div>` : ''}`;
    const tog = (f, label) => `<label class="opt chk o-tog"><input type="checkbox" data-f="${f}" ${T[f] ? 'checked' : ''}> ${label}</label>`;
    const sld = (f, min, max, step) => `<input type="range" class="o-sl" data-f="${f}" min="${min}" max="${max}" step="${step}" value="${T[f]}"><b class="o-slv" data-f="${f}">${Math.round(T[f] * 100)}%</b>`;
    // Camera first: the zoom row is the one players look for, and on a 412-464 px phone it sat below the fold
    wb.insertAdjacentHTML('beforeend', `<div class="o-touch">
      <h4>Camera</h4>
      ${row('Zoom', seg('camPreset', [['close', 'Close'], ['normal', 'Normal'], ['far', 'Far']]), 'Pinch with two fingers to zoom at any time.')}
      ${row('Turn speed', sld('camSens', 0.5, 2, 0.1))}
      ${tog('invertY', 'Invert up and down when you drag to look')}
      ${tog('autoFollow', 'Camera swings behind you while you run')}
      ${this.freeCamHtml()}
      <h4>Controls</h4>
      ${row('Button size', seg('btnScale', [[0.9, 'Small'], [1, 'Normal'], [1.15, 'Large']]))}
      ${row('Joystick', seg('stick', [['float', 'Follows your thumb'], ['fixed', 'Fixed']]))}
      ${row('Layout', seg('leftHanded', [['false', 'Skills on the right'], ['true', 'Skills on the left']]))}
      <h4>Interface</h4>
      ${row('Interface size', sld('uiScale', 0.8, 1.3, 0.05))}
      ${row('Nameplates', seg('plates', [['off', 'Target only'], ['few', 'Nearby'], ['all', 'All']]))}
      ${tog('playerNames', 'Show other players’ names')}
      <h4>Performance</h4>
      ${this.perfOptsHtml()}
      <div class="o-foot"><button class="o-treset">Reset touch settings</button></div></div>`);
    const apply = () => { saveSettings(); touchSettingsChanged(); };
    wb.querySelectorAll('.o-seg').forEach((g) => g.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      const f = g.dataset.f, v = b.dataset.v;
      T[f] = typeof TOUCH_DEFAULTS[f] === 'number' ? Number(v) : typeof TOUCH_DEFAULTS[f] === 'boolean' ? v === 'true' : v;
      apply(); g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); this.g.sfx?.play('ui');
    })));
    wb.querySelectorAll('.o-tog input').forEach((i) => (i.onchange = () => { T[i.dataset.f] = i.checked; apply(); }));
    wb.querySelectorAll('.o-sl').forEach((i) => {
      i.oninput = () => { T[i.dataset.f] = Number(i.value); $(`.o-slv[data-f="${i.dataset.f}"]`, wb).textContent = Math.round(T[i.dataset.f] * 100) + '%'; };
      i.onchange = () => apply();
    });
    $('.o-treset', wb).onclick = () => { const wheel = T.wheel; Object.assign(T, TOUCH_DEFAULTS, { wheel }); apply(); w.refresh(); };
    this.bindFreeCam(w);
    this.bindPerfOpts(w);
  }

  // Bot chat (living bots C.11, desktop and phones): which adventurers' (bots') chat to show, per channel, and whether they may
  // invite or whisper first. Saved here and sent to the server (net.js botPrefsMsg), which then makes no line for a hidden channel.
  botChatHtml() {
    const C = SETTINGS.botChat || {};
    const on = (ch) => C[ch] !== 0 && C[ch] !== false;
    const box = (ch, label) => `<label class="opt chk"><input type="checkbox" class="o-bc" data-c="${ch}" ${on(ch) ? 'checked' : ''}> ${label}</label>`;
    return `<h4>Bot chat</h4>
        ${box('world', 'Show adventurers’ chat in World')}${box('say', 'Show adventurers’ chat in Say')}${box('whisper', 'Show adventurers’ Whispers')}${box('guild', 'Show adventurers’ chat in Guild')}${box('party', 'Show adventurers’ chat in Party')}
        <label class="opt chk"><input type="checkbox" class="o-binv" ${SETTINGS.botInvites !== false ? 'checked' : ''}> Adventurers may invite me to groups</label>
        <label class="opt chk"><input type="checkbox" class="o-bwh" ${SETTINGS.botWhispers !== false ? 'checked' : ''}> Adventurers may whisper me first</label>
        <div class="o-note">Adventurers are the valley’s bots, shown as “Name (bot)”.</div>`;
  }
  bindBotChat(w) {
    const send = () => { saveSettings(); try { this.g.send?.(botPrefsMsg()); } catch { /* not in the world yet: sent after the welcome */ } };
    w.querySelectorAll('.o-bc').forEach((i) => (i.onchange = () => { SETTINGS.botChat = { world: 1, say: 1, whisper: 1, guild: 1, party: 1, ...(SETTINGS.botChat || {}), [i.dataset.c]: i.checked ? 1 : 0 }; send(); }));
    const inv = w.querySelector('.o-binv'); if (inv) inv.onchange = () => { SETTINGS.botInvites = inv.checked; send(); };
    const wh = w.querySelector('.o-bwh'); if (wh) wh.onchange = () => { SETTINGS.botWhispers = wh.checked; send(); };
  }

  // Free camera (SETTINGS.freeCam, every platform; camera.js reads it each frame): the camera never turns by itself, zooms
  // out to 60 m and the up/down drag sets the pitch. Reset camera puts it back behind the hero (touchcam on phones).
  freeCamHtml() {
    const how = IS_TOUCH ? 'Drag up and down to tilt from low to straight down, pinch to zoom out to 60 m. The camera button by the map resets the view.' : 'Hold the right mouse button and drag up and down to tilt from low to straight down; the wheel zooms out to 60 m.';
    return `<label class="opt chk o-free"><input type="checkbox" class="o-freecam" ${SETTINGS.freeCam ? 'checked' : ''}> Free camera: it never turns on its own, and zooms and tilts further</label>
      <div class="o-note">${how} <a class="o-camreset">Reset camera</a></div>
      <label class="opt chk o-hz"><input type="checkbox" class="o-hzcam" ${SETTINGS.horizonCam ? 'checked' : ''}> Horizon camera: a low view close behind your hero, with the hills on the skyline</label>
      <div class="o-note">Zoom still works; the Free camera takes over while it is on.</div>`;
  }
  bindFreeCam(w) {
    const box = w.querySelector('.o-freecam');
    if (box) box.onchange = () => { SETTINGS.freeCam = box.checked; saveSettings(); if (IS_TOUCH) touchSettingsChanged(); this.g.sfx?.play('ui'); };
    // Horizon camera (SETTINGS.horizonCam, LF.4; camera.js reads it each frame): turning it on brings the view in low behind the hero
    const hz = w.querySelector('.o-hzcam');
    if (hz) hz.onchange = () => { SETTINGS.horizonCam = hz.checked; saveSettings(); this.g.sfx?.play('ui'); };
    w.querySelectorAll('.o-camreset').forEach((a) => (a.onclick = () => { if (this.g.touchcam?.resetView) this.g.touchcam.resetView(); else this.g.rig?.resetView(); this.g.sfx?.play('ui'); }));
  }

  // Performance rows (desktop Options and the touch Options' Touch tab): frame cap, Battery saver, dynamic resolution
  // (phones), shadows. The frame cap and Battery saver's cap apply at once (fpsCapChanged); the rest on the next load.
  // Desktop: 30 / 60 / 90 / 120 / Monitor (every vsync, the default) / Unlimited (vsync off: needs a restart of the app).
  perfOpts() {
    const pacer = this.g.engine?.pacer, lab = (n) => (pacer?.label ? pacer.label(n) : String(n || 'Unlimited'));
    const fps = [];
    for (const n of [30, 60, 90, 120]) { const l = lab(n); if (!fps.some((o) => o.label === l)) fps.push({ v: String(n), label: l }); }
    if (IS_MOBILE) fps.push({ v: '0', label: 'Max' });
    else { fps.push({ v: 'mon', label: 'Monitor' }); if (window.sunmereDesktop?.setLaunch) fps.push({ v: 'unl', label: 'Unlimited' }); }
    const cur = SETTINGS.fpsCap ? String(SETTINGS.fpsCap) : IS_MOBILE ? '0' : SETTINGS.vsync === false ? 'unl' : 'mon';
    return { fps, cur };
  }
  perfOptsHtml() {
    const { fps, cur } = this.perfOpts();
    const seg = (k, opts, on) => `<div class="o-seg o-pf" data-p="${k}">${opts.map(([v, n]) => `<button data-v="${v}" class="${String(on) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const row = (label, ctl) => `<div class="opt o-trow"><span>${label}</span>${ctl}</div>`;
    const sh = ['auto', 'high', 'medium', 'low', 'off'].includes(SETTINGS.shadowQ) ? SETTINGS.shadowQ : 'auto';
    return `${row('Frame rate', seg('fps', fps.map((o) => [o.v, o.label]), cur))}
      ${!IS_MOBILE && SETTINGS.vsync === false ? '<div class="o-note">Unlimited takes effect when you restart the game.</div>' : ''}
      <label class="opt chk"><input type="checkbox" class="o-batt" ${SETTINGS.battery ? 'checked' : ''}> Battery saver: 30 fps, lighter shadows, grass and effects</label>
      <div class="o-note">The 30 fps cap applies at once; the rest when the world view reloads.</div>
      ${IS_MOBILE ? `<label class="opt chk"><input type="checkbox" class="o-dynres" ${SETTINGS.dynRes !== false ? 'checked' : ''}> Dynamic resolution: draw fewer pixels when the phone is busy, to hold the frame rate</label>` : ''}
      ${row('Shadows', seg('shadow', [['auto', 'By quality'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['off', 'Off']], sh))}
      <div class="o-note">Shadow and resolution changes take effect when the world view reloads. <a class="o-reload2">Reload now</a></div>
      ${row('Upgrade effects', seg('upgfx', [['full', 'Full'], ['simple', 'Simple'], ['off', 'Off']], SETTINGS.upgradeFx || (IS_MOBILE ? 'simple' : 'full')))}
      <div class="o-note">The heat on gear upgraded to +7 and beyond. Full: the steel shimmers, with steam and sparks near you. Simple: a steady glow, sparks only on your own blows. Off: plain steel.</div>`;
  }
  bindPerfOpts(w) {
    const wb = $('.wb', w);
    wb.querySelectorAll('.o-pf[data-p="fps"] button').forEach((b) => (b.onclick = () => {
      const v = b.dataset.v, wasVsync = SETTINGS.vsync !== false;
      SETTINGS.fpsCap = v === 'mon' || v === 'unl' ? 0 : Number(v);
      if (!IS_MOBILE) {
        SETTINGS.vsync = v !== 'unl';
        if (wasVsync !== SETTINGS.vsync) window.sunmereDesktop?.setLaunch?.({ vsync: SETTINGS.vsync });
      }
      saveSettings(); fpsCapChanged(); this.g.sfx?.play('ui'); w.refresh();
    }));
    const bt = $('.o-batt', wb); if (bt) bt.onchange = () => { SETTINGS.battery = bt.checked; saveSettings(); fpsCapChanged(); };
    const dr = $('.o-dynres', wb); if (dr) dr.onchange = () => { SETTINGS.dynRes = dr.checked; saveSettings(); };
    wb.querySelectorAll('.o-pf[data-p="shadow"] button').forEach((b) => (b.onclick = () => { SETTINGS.shadowQ = b.dataset.v; saveSettings(); this.g.sfx?.play('ui'); w.refresh(); }));
    const rl = $('.o-reload2', wb); if (rl) rl.onclick = () => location.reload();
    wb.querySelectorAll('.o-pf[data-p="upgfx"] button').forEach((x) => (x.onclick = () => { SETTINGS.upgradeFx = x.dataset.v; saveSettings(); this.g.sfx?.play('ui'); w.refresh(); })); // live: heat.js reads it each frame
  }

  // ======================================================== damage meter (you, your party and your companions)
  meterEvent(kind, ev) {
    if (kind === 'dmg') this.combat?.onDmg(ev);
    const M = this.meter ||= { overall: { last: 0, dur: 0, by: {} }, cur: null, tab: 'dmg', seg: 'cur' };
    const me = this.g.localId, team = (id) => id === me || this.partyIds?.has(id);
    const now = performance.now() / 1000;
    const hits = [];
    if (kind === 'dmg' && team(ev.src) && ev.tgt !== ev.src) hits.push([ev.src, 'dmg']);
    if (kind === 'dmg' && team(ev.tgt)) hits.push([ev.tgt, 'taken']);
    if (kind === 'heal' && team(ev.src)) hits.push([ev.src, 'heal']);
    if (!hits.length) return;
    if (!M.cur || now - M.cur.last > 6) M.cur = { last: 0, dur: 0, by: {} };
    for (const S of [M.cur, M.overall]) {
      if (S.last && now - S.last < 6) S.dur += now - S.last;
      S.last = now;
      for (const [id, k] of hits) {
        const v = this.g.entities.get(id), name = id === me ? this.you?.name : v?.data?.n ? shownName(v.data.n, v.data.b) : '?', cls = id === me ? this.you?.cls : v?.data?.c;
        const e = S.by[id] ||= { name, cls, dmg: 0, heal: 0, taken: 0 };
        e[k] += ev.amt || 0;
      }
    }
  }
  winMeter() {
    const w = this.makeWindow('Meter', 'w-meter', innerWidth - 600, 120);
    const M = this.meter ||= { overall: { last: 0, dur: 0, by: {} }, cur: null, tab: 'dmg', seg: 'cur' };
    w.refresh = () => {
      if (!w.isConnected) { clearInterval(w._iv); return; }
      const S = M.seg === 'cur' ? M.cur || { dur: 0, by: {} } : M.overall, k = M.tab;
      const rows = Object.values(S.by).filter((e) => e[k] > 0).sort((a, b) => b[k] - a[k]);
      const top = rows[0]?.[k] || 1, secs = Math.max(1, S.dur);
      const tabs = [['dmg', 'Damage'], ['heal', 'Healing'], ['taken', 'Taken']].map(([t, l]) => `<button data-t="${t}" class="${k === t ? 'on' : ''}">${l}</button>`).join('');
      const segs = [['cur', 'This fight'], ['all', 'Overall']].map(([t, l]) => `<button data-s="${t}" class="${(M.seg === 'cur' ? 'cur' : 'all') === t ? 'on' : ''}">${l}</button>`).join('');
      $('.wb', w).innerHTML = `<div class="mt-tabs">${tabs}</div><div class="mt-tabs mt-seg">${segs}<button class="mt-reset">Reset</button></div>
        <div class="mt-rows">${rows.length ? rows.map((e) => `<div class="mt-row"><i style="width:${((e[k] / top) * 100).toFixed(1)}%;background:${CLASSES[e.cls]?.color || '#8a7a5a'}"></i><span>${e.name}</span><b>${Math.round(e[k]).toLocaleString()} <em>${(e[k] / secs).toFixed(1)}/s</em></b></div>`).join('') : '<p class="qtext">Nothing yet. Hit something!</p>'}</div>
        <div class="bag-hint">${Math.round(S.dur)} s in combat · training dummies stand by the ranger lodge and the Proving Ring</div>`;
      w.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { M.tab = b.dataset.t; w.refresh(); }));
      w.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { M.seg = b.dataset.s === 'cur' ? 'cur' : 'all'; w.refresh(); }));
      $('.mt-reset', w).onclick = () => { M.cur = null; M.overall = { last: 0, dur: 0, by: {} }; w.refresh(); };
    };
    w.refresh();
    w._iv = setInterval(() => w.refresh(), 700);
    return w;
  }

  // what's new: opens once after an update, and from the help window
  maybeNews() {
    let seen = 0;
    try { seen = Number(localStorage.getItem('sunmere:news') || 0); } catch { /* not stored */ }
    if (seen >= CHANGELOG_VERSION || /[?&]test=1/.test(location.search)) return;
    try { localStorage.setItem('sunmere:news', String(CHANGELOG_VERSION)); } catch { /* not stored */ }
    this.newsSince = seen;
    if (!this.windows.news?.isConnected) this.toggle('news');
  }
  // ---- loot history: the last 50 things you received, kept per character in this app profile
  get lootLog() {
    if (this._lootFor !== this.you?.name) { this._lootFor = this.you?.name; try { this._lootLog = JSON.parse(localStorage.getItem('sunmere:loot:' + this._lootFor) || '[]'); } catch { this._lootLog = []; } }
    return this._lootLog || (this._lootLog = []);
  }
  logLoot(ev) {
    const p = this.g.playerPos?.(), L = this.lootLog;
    L.unshift({ name: ev.name, q: ev.q ?? 1, n: ev.n || 1, icon: ev.icon || null, id: ev.id || null, gear: ev.item?.gear || null, t: Date.now(), where: p ? zoneAt(p.x, p.z).name : '' });
    if (L.length > 50) L.length = 50;
    try { localStorage.setItem('sunmere:loot:' + this._lootFor, JSON.stringify(L)); } catch { /* not stored */ }
    if (this.windows.loot?.isConnected) this.windows.loot.refresh();
  }
  winLoot() {
    const w = this.makeWindow('Loot History', 'w-loothist', Math.max(20, innerWidth - 420), 120);
    let minQ = this.lootMinQ ?? 0;
    const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };
    w.refresh = () => {
      const L = this.lootLog.filter((e) => (e.q ?? 1) >= minQ);
      const filt = [[0, 'All'], [2, 'Uncommon+'], [3, 'Rare+'], [4, 'Epic+'], [5, 'Legendary+'], [6, 'Prismatic']].map(([q, l]) => `<button data-mq="${q}" class="${minQ === q ? 'on' : ''}">${l}</button>`).join('');
      $('.wb', w).innerHTML = `<div class="post-tabs lh-tabs">${filt}</div><div class="lh-list">${L.map((e, i) => `<div class="lh-row" data-i="${this.lootLog.indexOf(e)}"><img src="${icon(e.icon || 'ring', '#3a3226', 36)}" style="border-color:${QUALITY[e.q] || '#666'}"><div><b style="color:${QUALITY[e.q] || '#fff'}">${e.gear ? gearName(e.gear) : e.name}</b>${e.n > 1 ? ` <i>x${e.n}</i>` : ''}<span>${e.where ? e.where + ' \u00b7 ' : ''}${ago(e.t)}</span></div></div>`).join('') || '<p class="qtext">Nothing yet. Everything you loot, earn or buy will be listed here.</p>'}</div>`;
      w.querySelectorAll('[data-mq]').forEach((b) => (b.onclick = () => { minQ = this.lootMinQ = Number(b.dataset.mq); w.refresh(); }));
      w.querySelectorAll('.lh-row').forEach((r) => {
        const e = this.lootLog[Number(r.dataset.i)];
        if (!e || !(e.gear || (e.id && ITEMS[e.id]))) return;
        r.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip(e.gear ? { gear: e.gear } : { id: e.id }, false)));
        r.addEventListener('mouseleave', () => this.hideTip());
      });
    };
    w.refresh();
    return w;
  }
  winNews() {
    const w = this.makeWindow('What\u2019s new', 'w-news', Math.max(20, innerWidth / 2 - 280), 70);
    const since = this.newsSince ?? 0; this.newsSince = null;
    const list = CHANGELOG.filter((C) => C.v > since);
    $('.wb', w).innerHTML = `<div class="news-list">${(list.length ? list : CHANGELOG).map((C) => `<h3>${C.title}</h3><div class="news-date">${C.date}</div>${C.items.map(([h, t]) => `<div class="news-it"><b>${h}</b><span>${t}</span></div>`).join('')}`).join('')}</div><div class="dbtns"><button class="ok">Back to the valley</button></div>`;
    $('.ok', w).onclick = () => { w.remove(); this.windows.news = null; };
    return w;
  }
  winHelp() {
    const w = this.makeWindow('How to play', 'w-help', innerWidth / 2 - 220, 120);
    $('.wb', w).innerHTML = `<div class="help"><p><button class="news-btn">What’s new</button></p>${IS_TOUCH ? `
      <p><b>Touch:</b> put your left thumb anywhere on the left of the screen to walk (push further to run). Drag on the right to turn the camera and pinch to zoom. Tap an enemy to target it, and the big buttons at the bottom right to fight (the arrow button shows more skills). Tap a person, remains or a mushroom to walk up to it, or tap the round prompt when it shows. The buttons at the top open chat, your character, your bags and every other window. In a window, tap an item for its details and what you can do with it; hold a finger on anything for its tooltip.</p>` : ''}
      <p><b>Move:</b> WASD or left-click the ground. <b>Jump:</b> Space. <b>Camera:</b> mouse wheel to zoom, hold the right mouse button and drag to turn.</p>
      <p><b>Target:</b> click an enemy or press Tab. <b>Skills:</b> 1-0 and Shift+1-0 (you learn one per level); the skills of levels 42 to 65 sit on Q, E, T, V, X, P, [, ], ; and ' (change them in Options).</p>
      <p><b>Talk / loot / gather / enter dungeons:</b> walk up and press <b>F</b>, or right-click people, sparkling remains and glowing mushrooms.</p>
      <p><b>The valley:</b> Sunmere and its meadows (1-5), the Glade and Ironcliff Quarry (5-10), the Sunscar desert (10-15), Rustwood and the Old Foundry (15-20), and the Highreach plateau above the glade falls (20-25). Each of the first four bands ends in a dungeon, marked on the map (M); from level 23 every dungeon can be run on Heroic (24-26).</p>
      <p><b>Windows:</b> C character · N Skill Web · B bags · L quests · K skills · Y achievements · J journal · M map · I loot history · O options (volume, quality) · Esc closes, or opens options.</p>
      <p><b>Skill Web:</b> from level 2 you earn a Web point each level (and from Main Story chapters). Spend them on the Web (N).</p>
      <p><b>Emotes:</b> /wave /cheer /point /salute /clap /laugh /shrug /nod /sit (target someone to aim it at them).</p>
      <p><b>Salvage:</b> buy a Salvage Hook from a trader, stand by the lake, the stream or the pond and press F to haul things up out of the water.</p>
      <p><b>Runabout:</b> from level 10 Gearwright Ottmar at the Sunmere gate sells a clockwork steam cart. Press <b>R</b> to ride.</p>
      <p><b>Party:</b> target a player and click <i>Invite</i>, or type <code>/invite name</code>. <code>/p</code> talks to your party, <code>/s</code> to players nearby, <code>/w name</code> whispers to one player and <code>/r</code> answers. Right-click a player (or More on their frame) to whisper, invite, trade, inspect or add a friend; the Who button lists everyone online and your friends. Captain Leof in Sunmere hires out companions who fight beside you.</p>
      <p>The <b style="color:#ff8a50">Main Story</b> is one long chain of quests that tells the valley\u2019s tale, step by step: its people wear a crimson crest, and the tracker always says where to go next. Side quests (a gold <b style="color:#f0b020">!</b>) are optional. Turn quests in where you see <b style="color:#f0b020">?</b>.</p>
      <p><b>Testing:</b> type <code>/level ${LEVEL_CAP}</code> in chat to unlock every skill and Web point.</p></div>`;
    $('.news-btn', w).onclick = () => { w.remove(); this.windows.help = null; this.toggle('news'); };
    return w;
  }

  // ---- map exploration (world map fog): 8 m cells you have been near, kept per character in this app profile
  get fogGrid() {
    const name = this.you?.name;
    if (this._fogFor !== name) {
      this._fogFor = name; this._fogNX = Math.ceil(MAP.w / 8); this._fogNZ = Math.ceil(MAP.h / 8); this._fog = new Uint8Array(this._fogNX * this._fogNZ); this._fogVer = (this._fogVer || 0) + 1; this._fogSeed = true;
      try {
        // fog3: the grid over the whole rectangle (west to -440, east to 470). Older grids are copied in: fog2 (95 x 95 from -440)
        // and the first one (80 x 80 from -320); the origin never moved in x from fog2, only the width grew.
        const s3 = localStorage.getItem('sunmere:fog3:' + name);
        if (s3) { const b = atob(s3); for (let i = 0; i < Math.min(b.length, this._fog.length); i++) this._fog[i] = b.charCodeAt(i); }
        else {
          const copy = (str, n0, x0, z0) => { const b = atob(str); if (b.length !== n0 * n0) return; const di = Math.round((x0 - MAP.x0) / 8), dj = Math.round((z0 - MAP.z0) / 8); for (let j = 0; j < n0; j++) for (let i = 0; i < n0; i++) if (b.charCodeAt(j * n0 + i)) this._fog[(j + dj) * this._fogNX + i + di] = 1; this._fogDirty = true; };
          const o2 = localStorage.getItem('sunmere:fog2:' + name), o1 = localStorage.getItem('sunmere:fog:' + name);
          if (o2) copy(o2, 95, -440, -440); else if (o1) copy(o1, 80, -320, -320);
        }
      } catch { /* nothing stored */ }
    }
    return this._fog;
  }
  revealAt(x, z, r) {
    const F = this.fogGrid, NX = this._fogNX, NZ = this._fogNZ;
    const i0 = Math.max(0, Math.floor((x - r - MAP.x0) / 8)), i1 = Math.min(NX - 1, Math.floor((x + r - MAP.x0) / 8));
    const j0 = Math.max(0, Math.floor((z - r - MAP.z0) / 8)), j1 = Math.min(NZ - 1, Math.floor((z + r - MAP.z0) / 8));
    let changed = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = MAP.x0 + (i + 0.5) * 8, cz = MAP.z0 + (j + 0.5) * 8;
      if ((cx - x) ** 2 + (cz - z) ** 2 > r * r) continue;
      const k = j * NX + i;
      if (!F[k]) { F[k] = 1; changed = true; }
    }
    if (changed) { this._fogDirty = true; this._fogVer++; }
    return changed;
  }
  // called every frame with your position: reveals a circle around you as you move (overworld only)
  exploreTick(pos) {
    if (!this.you || pos.x < MAP.x0 || pos.x > MAP.x0 + MAP.w || pos.z < MAP.z0 || pos.z > MAP.z0 + MAP.h) return;
    this.fogGrid;
    if (!this._fogHooked) { this._fogHooked = true; const save = () => { if (this._fogDirty) this.saveFog(); }; addEventListener('pagehide', save); addEventListener('beforeunload', save); document.addEventListener('visibilitychange', () => { if (document.hidden) save(); }); }
    if (this._fogSeed) {
      // characters from before the fog: everything they have already discovered starts revealed
      this._fogSeed = false;
      for (const z of ZONES) if (!z.area && (z.id === 'village' || this.you.visited?.['z:' + z.id])) this.revealAt(z.lx ?? z.x, z.lz ?? z.z, Math.max(40, z.r || 0));
    }
    const lp = this._fogLast;
    if (lp && Math.hypot(pos.x - lp.x, pos.z - lp.z) < 4 && !this._fogDirty) return;
    this._fogLast = { x: pos.x, z: pos.z };
    this.revealAt(pos.x, pos.z, 44);
    if (this._fogDirty && performance.now() - (this._fogSaved || 0) > 8000) this.saveFog();
  }
  saveFog() {
    if (!this._fog) return;
    this._fogDirty = false; this._fogSaved = performance.now();
    try { let s = ''; for (let i = 0; i < this._fog.length; i++) s += String.fromCharCode(this._fog[i]); localStorage.setItem('sunmere:fog3:' + this._fogFor, btoa(s)); } catch { /* not stored */ }
  }
  explored(x, z) {
    const F = this.fogGrid, NX = this._fogNX, NZ = this._fogNZ, i = Math.floor((x - MAP.x0) / 8), j = Math.floor((z - MAP.z0) / 8);
    return i >= 0 && j >= 0 && i < NX && j < NZ && !!F[j * NX + i];
  }
  zoneSeen(z) { return z.id === 'village' || !!this.you?.visited?.['z:' + z.id] || this.explored(z.lx ?? z.x, z.lz ?? z.z); }
  // parchment over everything not yet explored, with soft edges; rebuilt only when new cells are revealed
  fogLayer() {
    const F = this.fogGrid, NX = this._fogNX, NZ = this._fogNZ, W = MAP_PX, H = Math.round(MAP_PX * MAP.h / MAP.w);
    if (this._fogCanvas && this._fogBuilt === this._fogVer) return this._fogCanvas;
    const m = this._fogMask || (this._fogMask = document.createElement('canvas'));
    m.width = NX; m.height = NZ;
    const mx = m.getContext('2d'), img = mx.createImageData(NX, NZ);
    for (let k = 0; k < NX * NZ; k++) if (F[k]) img.data[k * 4 + 3] = 255;
    mx.putImageData(img, 0, 0);
    const c = this._fogCanvas || (this._fogCanvas = document.createElement('canvas'));
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.drawImage(this.parchment(), 0, 0, W, H);
    x.globalCompositeOperation = 'destination-out'; x.filter = `blur(${Math.round(9 * W / 640)}px)`; x.imageSmoothingEnabled = true;
    x.drawImage(m, 0, 0, NX * 8 * W / MAP.w, NZ * 8 * H / MAP.h);
    x.globalCompositeOperation = 'source-over'; x.filter = 'none';
    this._fogBuilt = this._fogVer;
    return c;
  }
  parchment() {
    if (this._parch) return this._parch;
    const c = document.createElement('canvas'); c.width = 640; c.height = 640; // drawn scaled to the map's size
    const x = c.getContext('2d');
    x.fillStyle = '#d8c7a0'; x.fillRect(0, 0, 640, 640);
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 24; i++) { const cx = rnd() * 640, cy = rnd() * 640, r = 30 + rnd() * 80, g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(150,110,60,0.12)'); g.addColorStop(1, 'rgba(150,110,60,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${110 + rnd() * 60 | 0},${80 + rnd() * 50 | 0},${45 + rnd() * 30 | 0},${(0.04 + rnd() * 0.06).toFixed(3)})`; x.fillRect(rnd() * 640, rnd() * 640, 1 + rnd() * 14, 1 + rnd() * 1.5); }
    return (this._parch = c);
  }
  // the part of the valley the world map shows (world metres), at the canvas aspect
  mapView(fog, aspect) {
    if (!fog) return MAP;
    const p = this.g.playerPos(), key = this._fogVer + '|' + Math.round(p.x / 20) + ',' + Math.round(p.z / 20) + '|' + (this.you?.quests ? Object.keys(this.you.quests).join() : '');
    if (this._mapViewK === key && this._mapView) return this._mapView;
    let x0 = p.x, x1 = p.x, z0 = p.z, z1 = p.z;
    const grow = (x, z) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; };
    const F = this.fogGrid, NX = this._fogNX, NZ = this._fogNZ;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) if (F[j * NX + i]) grow(MAP.x0 + i * 8, MAP.z0 + j * 8), grow(MAP.x0 + i * 8 + 8, MAP.z0 + j * 8 + 8);
    for (const t of this.questTargets()) if (areaOf(t.x, t.z) === 'valley' && !dungeonAt(t.x, t.z)) grow(t.x, t.z);
    let cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, vw = Math.max(260, x1 - x0 + 90), vh = Math.max(260 / aspect, z1 - z0 + 90);
    if (vw / vh < aspect) vw = vh * aspect; else vh = vw / aspect;
    if (vw >= MAP.w || vh >= MAP.h) { vw = MAP.w; vh = MAP.h; }
    cx = Math.max(MAP.x0 + vw / 2, Math.min(MAP.x0 + MAP.w - vw / 2, cx)); cz = Math.max(MAP.z0 + vh / 2, Math.min(MAP.z0 + MAP.h - vh / 2, cz));
    this._mapViewK = key;
    return (this._mapView = { x0: cx - vw / 2, z0: cz - vh / 2, w: vw, h: vh });
  }
  winMap() {
    const w = this.makeWindow('World Map', 'w-map', Math.max(20, innerWidth / 2 - MAP_PX / 2 - 10), 40);
    const c = el('canvas'); c.width = MAP_PX; c.height = Math.round(MAP_PX * MAP.h / MAP.w);
    $('.wb', w).appendChild(c);
    $('.wb', w).insertBefore(el('div', 'bag-hint map-hint', IS_TOUCH ? 'Tap to place a pin (up to 6); tap a pin to take it away. Pinch to zoom, drag to look around.' : 'Click the map to place a pin (up to 6); click a pin to take it away. Pins show on the minimap.'), c);
    // phones and tablets: pinch to zoom (1x to 4x), one finger pans, a button centres on you. On a phone the canvas fills
    // the sheet at one canvas pixel per CSS pixel, so the labels keep their size (11 px and up) at any zoom.
    const T = IS_TOUCH ? (w._tz = { z: 1, px: 0, pz: 0, moved: 0 }) : null;
    if (T) {
      const vp = el('div', 'map-vp'); c.replaceWith(vp); vp.appendChild(c);
      const tools = el('div', 'map-tools', '<button class="map-me" title="Centre on me">Centre on me</button><button class="map-zin" title="Zoom in">+</button><button class="map-zout" title="Zoom out">−</button>');
      vp.appendChild(tools);
      c.style.touchAction = 'none';
      const view = () => w._view || MAP;
      const zoomTo = (z) => { T.z = Math.max(1, Math.min(4, z)); if (T.z === 1) { T.px = 0; T.pz = 0; } w.refresh(); };
      $('.map-zin', tools).onclick = () => zoomTo(T.z * 1.5);
      $('.map-zout', tools).onclick = () => zoomTo(T.z / 1.5);
      $('.map-me', tools).onclick = () => { const p = this.g.playerPos(), B = w._base || MAP; T.px = p.x - (B.x0 + B.w / 2); T.pz = p.z - (B.z0 + B.h / 2); if (T.z < 2) T.z = 2; w.refresh(); };
      const pts = new Map(); let pinch = null;
      c.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); T.moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: T.z }; } try { c.setPointerCapture(e.pointerId); } catch { /* fine */ } });
      c.addEventListener('pointermove', (e) => {
        const q = pts.get(e.pointerId); if (!q) return;
        const dx = e.clientX - q.x, dy = e.clientY - q.y; q.x = e.clientX; q.y = e.clientY;
        if (pts.size >= 2 && pinch) { const [a, b] = [...pts.values()]; T.z = Math.max(1, Math.min(4, pinch.z * (Math.hypot(a.x - b.x, a.y - b.y) || 1) / pinch.d)); T.moved = 99; w.refresh(); return; }
        T.moved += Math.abs(dx) + Math.abs(dy);
        if (T.moved > 8 && T.z > 1) { const r = c.getBoundingClientRect(), V = view(); T.px -= dx * V.w / r.width; T.pz -= dy * V.h / r.height; w.refresh(); }
      });
      const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      c.addEventListener('wheel', (e) => { e.preventDefault(); zoomTo(T.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2)); }, { passive: false });
    }
    c.addEventListener('click', (e) => {
      if (T && T.moved > 8) { T.moved = 0; return; } // that was a drag or a pinch, not a tap
      { const p0 = this.g.playerPos(); if (dungeonAt(p0.x, p0.z) || areaOf(p0.x, p0.z) !== 'valley') return; } // pins are for the valley
      const r = c.getBoundingClientRect(), mx = ((e.clientX - r.left) / r.width) * c.width, my = ((e.clientY - r.top) / r.height) * c.height;
      const V = w._view || MAP, wx = V.x0 + (mx / c.width) * V.w, wz = V.z0 + (my / c.height) * V.h;
      const pins = this.pins, near = pins.findIndex((q) => Math.hypot(q.x - wx, q.z - wz) < 14 * V.w / c.width);
      if (near >= 0) pins.splice(near, 1); else { if (pins.length >= 6) pins.shift(); pins.push({ x: Math.round(wx), z: Math.round(wz) }); }
      this.savePins(); w.refresh();
    });
    const x = c.getContext('2d');
    w.refresh = () => {
      // a phone: the canvas takes the sheet's free space, one canvas pixel per CSS pixel
      if (T && isPhone()) {
        const vp = c.parentElement, r = vp.getBoundingClientRect();
        const cw = Math.max(200, Math.round(r.width)), ch = Math.max(150, Math.round(r.height));
        if (r.width > 50 && r.height > 50 && (c.width !== cw || c.height !== ch)) { c.width = cw; c.height = ch; }
      }
      // underground: the map shows the plan of the dungeon or region you are in instead of the valley
      { const p0 = this.g.playerPos(), D = dungeonAt(p0.x, p0.z); if (D) { this.drawUnderMap(x, c, D, p0); return; } const a0 = areaOf(p0.x, p0.z); if (AMAP[a0] && this.areaBase?.[a0]) { this.drawAreaMap(x, c, p0, a0); return; } }
      const fog = SETTINGS.mapFog !== false && this.you;
      // the view: fitted round what you have explored, where you stand and where your quests lead (never the whole
      // empty parchment for a new character); it widens as you explore, up to the whole valley
      let V = this.mapView(fog, c.width / c.height);
      if (T) {
        // touch: the fitted view widened to the canvas's shape, then zoomed and panned (clamped to the valley)
        const a = c.width / c.height;
        let bw = V.w, bh = V.h; if (bw / bh < a) bw = bh * a; else bh = bw / a;
        const B = (w._base = { x0: V.x0 + V.w / 2 - bw / 2, z0: V.z0 + V.h / 2 - bh / 2, w: bw, h: bh });
        const vw = bw / T.z, vh = bh / T.z, hx = Math.max(0, (MAP.w - vw) / 2), hz = Math.max(0, (MAP.h - vh) / 2);
        let cx = B.x0 + bw / 2 + T.px, cz = B.z0 + bh / 2 + T.pz;
        const mx = MAP.x0 + MAP.w / 2, mz = MAP.z0 + MAP.h / 2;
        if (T.z > 1) { cx = Math.max(mx - hx, Math.min(mx + hx, cx)); cz = Math.max(mz - hz, Math.min(mz + hz, cz)); T.px = cx - (B.x0 + bw / 2); T.pz = cz - (B.z0 + bh / 2); }
        V = { x0: cx - vw / 2, z0: cz - vh / 2, w: vw, h: vh };
      }
      w._view = V;
      const sx = (V.x0 - MAP.x0) / MAP.w, sy = (V.z0 - MAP.z0) / MAP.h, sw = V.w / MAP.w, sh = V.h / MAP.h;
      x.fillStyle = '#d8c7a0'; x.fillRect(0, 0, c.width, c.height);
      { const B = this.mapBase; x.drawImage(B, sx * B.width, sy * B.height, sw * B.width, sh * B.height, 0, 0, c.width, c.height); }
      if (fog) { const F = this.fogLayer(); x.drawImage(F, sx * F.width, sy * F.height, sw * F.width, sh * F.height, 0, 0, c.width, c.height); }
      const ppm = c.width / V.w;
      const toMap = (wx, wz) => [(wx - V.x0) / V.w * c.width, (wz - V.z0) / V.h * c.height];
      // labels never sit on top of each other: each is nudged down until it finds a free spot
      const placed = [];
      const label = (text, mx, my, font, fill, shadow = 'rgba(20,14,8,0.6)') => {
        x.font = font; const tw = x.measureText(text).width, th = parseInt(font.match(/(\d+)px/)[1], 10) + 3;
        mx = Math.max(tw / 2 + 4, Math.min(c.width - tw / 2 - 4, mx));
        for (let k = 0; k < 8; k++) {
          const r = [mx - tw / 2, my - th + 3, mx + tw / 2, my + 3];
          if (!placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) { placed.push(r); break; }
          my += k % 2 ? -th * (k + 1) : th * (k + 1);
        }
        if (shadow) { x.fillStyle = shadow; x.fillText(text, mx + 1, my + 1); }
        x.fillStyle = fill; x.fillText(text, mx, my);
      };
      x.textAlign = 'center';
      for (const z of ZONES) { if (z.nomap || z.area || (fog && !this.zoneSeen(z))) continue; const [mx, my] = toMap(z.lx ?? z.x, z.lz ?? z.z); if (mx < -40 || my < -20 || mx > c.width + 40 || my > c.height + 20) continue; label(z.name, mx, my, 'bold 19px Cinzel, serif', '#f8e8c0'); label(`Level ${z.level}`, mx, my + 19, 'bold 14px sans-serif', '#f8e8c0'); }
      for (const n of NPCS) { if (areaOf(n.x, n.z) !== 'valley' || (fog && !this.explored(n.x, n.z))) continue; const [mx, my] = toMap(n.x, n.z); x.fillStyle = '#ffd040'; x.beginPath(); x.arc(mx, my, 3, 0, Math.PI * 2); x.fill(); }
      for (const dd of DUNGEONS) { if (fog && !this.explored(dd.door.x, dd.door.z)) continue; const [mx, my] = toMap(dd.door.x, dd.door.z); x.fillStyle = '#2a1a10'; x.beginPath(); x.arc(mx, my, 7, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#f0b040'; x.lineWidth = 2.5; x.stroke(); x.fillStyle = '#ffe0a0'; x.font = 'bold 11px sans-serif'; x.fillText(`${dd.name} (${dd.level})`, mx, my + (dd.door.labelUp ? -12 : 20)); x.font = 'bold 14px Cinzel, serif'; }
      const p = this.g.playerPos();
      for (const t of this.questTargets()) {
        const [qx, qy] = toMap(t.x, t.z);
        x.fillStyle = t.msq ? 'rgba(226,85,42,0.26)' : 'rgba(240,176,32,0.22)'; x.strokeStyle = t.msq ? (t.done ? '#ffb070' : '#ff6a3a') : t.done ? '#ffe060' : '#f0b020'; x.lineWidth = 2;
        x.beginPath(); x.arc(qx, qy, Math.max(6, t.r * ppm), 0, Math.PI * 2); x.fill(); x.stroke();
        label((t.msq ? 'Main Story: ' : '') + QUESTS[t.qid].name, qx, Math.max(16, qy - Math.max(8, t.r * ppm) - 4), 'bold 14px sans-serif', t.msq ? '#ffc8a0' : '#ffe8a0', 'rgba(20,14,8,0.75)'); x.font = 'bold 14px Cinzel, serif';
      }
      for (const pin of this.pins) {
        const [mx, my] = toMap(pin.x, pin.z);
        x.fillStyle = '#5ae0ff'; x.strokeStyle = '#06222a'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(mx, my); x.bezierCurveTo(mx - 9, my - 11, mx - 7, my - 20, mx, my - 20); x.bezierCurveTo(mx + 7, my - 20, mx + 9, my - 11, mx, my); x.fill(); x.stroke();
        x.fillStyle = '#06222a'; x.beginPath(); x.arc(mx, my - 13, 2.6, 0, Math.PI * 2); x.fill();
        const d = Math.round(Math.hypot(pin.x - p.x, pin.z - p.z));
        x.font = 'bold 11px sans-serif'; x.fillStyle = '#c8f4ff'; x.fillText(`${d} m`, mx, my + 13); x.font = 'bold 14px Cinzel, serif';
      }
      const [px, py] = toMap(p.x, p.z);
      x.save(); x.translate(px, py); x.rotate(-this.g.playerYaw() + Math.PI);
      x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -9); x.lineTo(6, 7); x.lineTo(0, 3); x.lineTo(-6, 7); x.closePath(); x.fill(); x.stroke(); x.restore();
    };
    w.refresh();
    return w;
  }

  // an island area (the Cinder Reach, the Rime Steps) on the world map: its own painted base, its three regions, the people
  // on it, quest targets (those across the sea point at the pier), and you. No fog and no pins over the sea.
  drawAreaMap(x, c, p, id = 'reach') {
    const M = AMAP[id], L = AMAP_LOOK[id], B = AREA_BY_ID[id].box, title = AREA_BY_ID[id].name;
    const base = this.areaBase[id], k = Math.min(c.width / M.w, c.height / M.h), ox = (c.width - M.w * k) / 2, oy = (c.height - M.h * k) / 2;
    const toM = (wx, wz) => [ox + (wx - M.x0) * k, oy + (wz - M.z0) * k];
    x.fillStyle = L.sea; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(base, ox, oy, M.w * k, M.h * k);
    x.textAlign = 'center';
    x.font = 'bold 22px Cinzel, serif'; x.fillStyle = 'rgba(20,14,8,0.6)'; x.fillText(title, c.width / 2 + 1, 29); x.fillStyle = '#f8e8c0'; x.fillText(title, c.width / 2, 28);
    x.font = 'bold 15px Cinzel, serif';
    for (const z of ZONES) { if (z.area !== id) continue; const [mx, my] = toM(z.lx ?? z.x, z.lz ?? z.z); x.fillStyle = 'rgba(20,14,8,0.65)'; x.fillText(z.name, mx + 1, my + 1); x.fillStyle = '#f8e8c0'; x.fillText(z.name, mx, my); x.font = '12px sans-serif'; x.fillText(`(${z.level})`, mx, my + 15); x.font = 'bold 15px Cinzel, serif'; }
    for (const n of NPCS) { if (areaOf(n.x, n.z) !== id) continue; const [mx, my] = toM(n.x, n.z); x.fillStyle = '#ffd040'; x.strokeStyle = '#3a2a10'; x.lineWidth = 1.5; x.beginPath(); x.arc(mx, my, 4, 0, Math.PI * 2); x.fill(); x.stroke(); }
    { const [wx, wz] = L.at ? L.at() : [B.pier.x0 + 4, (B.pier.z0 + B.pier.z1) / 2], [mx, my] = toM(wx, wz); x.font = 'bold 12px sans-serif'; x.fillStyle = id === 'heights' ? '#2a3a4c' : '#e8f4ff'; x.fillText(L.ship(this.you), mx + 60, my + 22); }
    if (L.more) { const [wx, wz, label] = L.more(this.you), [mx, my] = toM(wx, wz); x.font = 'bold 12px sans-serif'; x.fillStyle = 'rgba(20,14,8,0.6)'; x.fillText(label, mx + 1, my + 17); x.fillStyle = '#f0f6ff'; x.fillText(label, mx, my + 16); x.strokeStyle = '#2a3a4c'; x.fillStyle = '#c8a46a'; x.lineWidth = 1.5; x.fillRect(mx - 4, my - 4, 8, 8); x.strokeRect(mx - 4, my - 4, 8, 8); }
    for (const t of this.questTargets()) {
      if (areaOf(t.x, t.z) !== id) continue;
      const [qx, qy] = toM(t.x, t.z);
      x.fillStyle = t.msq ? 'rgba(226,85,42,0.3)' : 'rgba(240,176,32,0.28)'; x.strokeStyle = t.msq ? '#ff6a3a' : '#f0b020'; x.lineWidth = 2;
      x.beginPath(); x.arc(qx, qy, Math.max(6, t.r * k), 0, Math.PI * 2); x.fill(); x.stroke();
      x.fillStyle = t.msq ? '#ffc8a0' : '#ffe8a0'; x.font = 'bold 12px sans-serif'; x.fillText((t.msq ? 'Main Story: ' : '') + QUESTS[t.qid].name, Math.max(90, Math.min(c.width - 90, qx)), Math.max(14, qy - Math.max(8, t.r * k) - 4));
    }
    const [px, py] = toM(p.x, p.z);
    x.save(); x.translate(px, py); x.rotate(-this.g.playerYaw() + Math.PI);
    x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -9); x.lineTo(6, 7); x.lineTo(0, 3); x.lineTo(-6, 7); x.closePath(); x.fill(); x.stroke(); x.restore();
  }

  // the plan of a dungeon or an open region (the Deepway) on the world map: floor in parchment, its named areas,
  // the people in it, quest targets inside it, the way out, and you
  drawUnderMap(x, c, D, p) {
    const k = Math.min(c.width / D.w, c.height / D.h) * 0.94, ox = (c.width - D.w * k) / 2, oy = (c.height - D.h * k) / 2;
    const toM = (wx, wz) => [ox + (wx - D.ox) * k, oy + (wz - D.oz) * k];
    x.fillStyle = '#2a2018'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#d8c8a4';
    for (let j = 0; j < D.nz; j++) for (let i = 0; i < D.nx; i++) if (cellFloor(D, i, j)) x.fillRect(ox + i * CELL * k, oy + j * CELL * k, CELL * k + 0.6, CELL * k + 0.6);
    x.textAlign = 'center';
    x.font = 'bold 22px Cinzel, serif'; x.fillStyle = '#f8e8c0'; x.fillText(D.name, c.width / 2, 28);
    x.font = 'bold 13px Cinzel, serif';
    for (const [, name, x0, z0, x1, z1] of D.areas || []) { const [mx, my] = toM(D.ox + (x0 + x1) / 2, D.oz + (z0 + z1) / 2); x.fillStyle = 'rgba(248,240,220,0.7)'; x.fillText(name, mx + 1, my + 1); x.fillStyle = '#4a2e14'; x.fillText(name, mx, my); }
    for (const n of NPCS) { if (dungeonAt(n.x, n.z) !== D) continue; const [mx, my] = toM(n.x, n.z); x.fillStyle = '#ffd040'; x.strokeStyle = '#3a2a10'; x.lineWidth = 1.5; x.beginPath(); x.arc(mx, my, 4, 0, Math.PI * 2); x.fill(); x.stroke(); }
    for (const dd of DUNGEONS) { if (dd === D || dungeonAt(dd.door.x, dd.door.z) !== D) continue; const [mx, my] = toM(dd.door.x, dd.door.z); x.fillStyle = '#2a1a10'; x.strokeStyle = '#f0b040'; x.lineWidth = 2; x.beginPath(); x.arc(mx, my, 6, 0, Math.PI * 2); x.fill(); x.stroke(); x.fillStyle = '#4a2e14'; x.font = 'bold 12px sans-serif'; x.fillText(dd.name, mx, my - 10); }
    { const [mx, my] = toM(D.exitW[0], D.exitW[1]); x.fillStyle = '#5a8a3a'; x.beginPath(); x.arc(mx, my, 5, 0, Math.PI * 2); x.fill(); x.font = 'bold 12px sans-serif'; x.fillStyle = '#2a4a1a'; x.fillText('Way out', mx, my + 16); }
    for (const t of this.questTargets()) {
      if (dungeonAt(t.x, t.z) !== D) continue;
      const [qx, qy] = toM(t.x, t.z);
      x.fillStyle = t.msq ? 'rgba(226,85,42,0.3)' : 'rgba(240,176,32,0.28)'; x.strokeStyle = t.msq ? '#c8441a' : '#b07a10'; x.lineWidth = 2;
      x.beginPath(); x.arc(qx, qy, Math.max(6, t.r * k), 0, Math.PI * 2); x.fill(); x.stroke();
    }
    const [px, py] = toM(p.x, p.z);
    x.save(); x.translate(px, py); x.rotate(-this.g.playerYaw() + Math.PI);
    x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -9); x.lineTo(6, 7); x.lineTo(0, 3); x.lineTo(-6, 7); x.closePath(); x.fill(); x.stroke(); x.restore();
  }

  // NPC dialog: greeting + quests + vendor
  openDialog(d) {
    this.windows.dialog?.remove();
    const npc = NPCS.find((n) => n.id === d.npc);
    const w = this.makeWindow(npc.name, 'w-dialog', 60, 140);
    this.windows.dialog = w; w._npc = d.npc; // game.js closes it once you walk away
    const greetings = ['Well met, traveller.', 'The valley needs every able hand.', 'Mind the machines on the roads.', 'Light and safe travels to you.'];
    const showQuest = (qid, mode) => {
      const Q = QUESTS[qid];
      let choice = 0;
      const C = Q.msq ? STORY[Q.msq.ch] : null;
      const lv = Math.max(this.you.level, Q.lvl), xp = Q.daily && !Q.weekly ? dailyXp(Q, this.you.level) : Q.xp, money = (Q.daily ? 8 + lv * 3 : Q.gold) * 10;
      // reward cards: painted icon in a quality frame, name, slot and type, the main stats
      // a bow and its pistol twin (v107): show only the one your class can use (the hand-in swaps them anyway)
      const hide = (r) => { const it = ITEMS[r], W = it?.twin && ITEMS[it.twin]; return !!(W && it.classes && !it.classes.includes(this.you.cls) && W.classes?.includes(this.you.cls)); };
      const shown = Q.rewards.map((r, i) => i).filter((i) => !hide(Q.rewards[i]));
      choice = shown[0] ?? 0;
      const cards = shown.map((i) => {
        const r = Q.rewards[i], it = ITEMS[r], q = it.q ?? 1, S = it.stats || {};
        const st = [...['power', 'armor', 'hp'].filter((k) => S[k]), ...Object.keys(S).filter((k) => !['power', 'armor', 'hp'].includes(k) && S[k])].slice(0, 3).map((k) => `+${S[k]}${STAT_PCT[k] ? '%' : ''} ${STAT_NAME[k] || k}`).join(' \u00b7 ');
        return `<div class="rcard ${i === choice && shown.length > 1 ? 'on' : ''}" data-i="${i}" style="--qc:${QUALITY[q]};--qi:${INK[q]}"><img src="${icon(it.icon, '#3a3226', 64)}"><div><b>${it.name}</b><span>${[SLOT_LABEL[it.slot], typeLine(it)].filter(Boolean).join(' \u00b7 ')}</span><em>${st}</em>${upTag(it, this.you)}</div></div>`;
      }).join('');
      const body = $('.wb', w);
      body.classList.add('parch');
      body.innerHTML = `<div class="qp-head" style="background-image:url('/sunmere-play/ui/loading/${artAt(npc.x, npc.z)}.webp')"><div class="qp-who"><b>${npc.name}</b>${npc.title ? `<span>${npc.title}</span>` : ''}</div></div>
        ${C ? `<div class="msq-rib">${CREST(mode === 'turnin' ? '?' : '!')} Main Story \u00b7 Chapter ${Q.msq.ch + 1}: ${C.name}</div>` : ''}<h3 class="qp-title">${Q.name}</h3>
        <p class="qp-text">${mode === 'active' ? 'Have you finished the task?' : mode === 'turnin' && Q.done ? Q.done : Q.text}</p>
        ${mode === 'offer' ? `<div class="qp-obj"><span>Objective</span>${goalAsk(Q)}</div>` : mode === 'active' ? `<div class="qp-obj"><span>Still to do</span>${goalAsk(Q)}</div>` : ''}
        <div class="qp-sec">Rewards</div>
        <div class="qp-pay"><span class="qp-xp">${xp.toLocaleString()} XP</span><span class="qp-money">${fmtMoney(money)}</span>${Q.daily ? '<span class="qp-rep">+ reputation \u00b7 once a day</span>' : ''}</div>
        ${cards ? `<div class="qp-pick">${shown.length > 1 ? (mode === 'turnin' ? 'Choose one:' : 'You will choose one of:') : mode === 'turnin' ? 'You receive:' : 'You will also receive:'}</div><div class="qp-cards">${cards}</div>` : ''}
        <div class="dbtns">${mode === 'offer' ? '<button class="acc">Accept</button>' : mode === 'turnin' ? '<button class="acc">Complete Quest</button>' : ''}<button class="back">Back</button></div>`;
      body.scrollTop = 0;
      if (shown.length > 1) w.querySelectorAll('.rcard').forEach((e) => (e.onclick = () => { choice = Number(e.dataset.i); w.querySelectorAll('.rcard').forEach((x) => x.classList.toggle('on', x === e)); }));
      w.querySelectorAll('.rcard').forEach((e) => { e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip({ id: Q.rewards[Number(e.dataset.i)] }))); e.addEventListener('mouseleave', () => this.hideTip()); });
      const acc = $('.acc', w);
      if (acc) acc.onclick = () => { this.g.send(mode === 'offer' ? { t: 'accept', q: qid } : { t: 'turnin', q: qid, choice }); w.remove(); };
      $('.back', w).onclick = () => main();
    };
    const main = () => {
      $('.wb', w).classList.add('parch');
      const opts = [
        // the story comes first and wears its crest
        ...d.turnins.filter((q) => QUESTS[q].msq).map((q) => `<div class="dopt msq turnin" data-q="${q}" data-m="turnin">${CREST('?')} ${QUESTS[q].name}<span class="msq-tag">Main Story</span></div>`),
        ...d.offers.filter((q) => QUESTS[q].msq).map((q) => `<div class="dopt msq offer" data-q="${q}" data-m="offer">${CREST('!')} ${QUESTS[q].name}<span class="msq-tag">Main Story</span></div>`),
        ...d.turnins.filter((q) => !QUESTS[q].msq).map((q) => `<div class="dopt turnin" data-q="${q}" data-m="turnin"><b>?</b> ${QUESTS[q].name}</div>`),
        ...d.offers.filter((q) => !QUESTS[q].msq).map((q) => `<div class="dopt offer" data-q="${q}" data-m="offer"><b>!</b> ${QUESTS[q].name}</div>`),
        ...d.active.map((q) => `<div class="dopt active ${QUESTS[q].msq ? 'msq' : ''}" data-q="${q}" data-m="active">${QUESTS[q].msq ? CREST('?', true) : '<b>?</b>'} ${QUESTS[q].name}</div>`),
      ];
      if (d.vendor) opts.push('<div class="dopt vendor" data-v="1"><b>$</b> Let me browse your goods.</div>');
      if (d.travel) opts.push('<div class="dopt travel" data-t="1"><b>&gt;</b> I need to travel.</div>');
      if (d.hire) opts.push('<div class="dopt travel" data-h="1"><b>+</b> I need a companion.</div>');
      if (d.ladder) opts.push(`<div class="dopt travel" data-ld="1"><b>&gt;</b> Show me this week’s ladder.${d.ladder.rank ? ` <span style="float:right;opacity:.8">You: #${d.ladder.rank}</span>` : ''}</div>`);
      if (d.arena) opts.push(`<div class="dopt vendor" data-a="1"><b>!</b> I want to fight in the ring. <span style="float:right;opacity:.8">Your best: wave ${d.arena.best}</span></div>`);
      if (d.craft) opts.push(`<div class="dopt vendor" data-c="1"><b>+</b> I want to make something. (${STATION_NAME[d.craft]})</div>`);
      if (d.upgrade) opts.push('<div class="dopt vendor" data-rf="1"><b>+</b> I want my gear upgraded.</div>');
      if (d.craft === 'smith') opts.push('<div class="dopt vendor" data-sv="1"><b>+</b> I want to salvage gear I no longer need.</div>', '<div class="dopt vendor" data-us="1"><b>+</b> I want a gem taken out of its socket.</div>');
      if (d.bounty) opts.push(`<div class="dopt vendor" data-bt="1"><b>!</b> What bounties are posted this week?${d.bounty.list.some((b) => b.killed && !b.claimed) ? ' <span style="float:right;color:#ffc040">reward waiting</span>' : ''}</div>`);
      if (d.rides) opts.push(`<div class="dopt travel" data-dr="1"><b>&gt;</b> Arrange a ride to a dungeon.${d.rides.done ? '' : ` <span style="float:right;color:#ffc040">featured: ${DUNGEONS.find((x) => x.id === d.rides.featured)?.name}</span>`}</div>`);
      if (d.trade) opts.push('<div class="dopt vendor" data-x="1"><b>$</b> Show me the trading board.</div>');
      if (d.spares?.length) opts.push(`<div class="dopt vendor" data-sp="1"><b>$</b> Do you still have the rewards I did not choose? <span style="float:right;opacity:.8">${d.spares.length}</span></div>`);
      if (d.home) opts.push(d.home.here ? '<div class="dopt travel muted"><b>&gt;</b> Your Homeward Compass points here.</div>' : '<div class="dopt travel" data-hm="1"><b>&gt;</b> Make this stop my home (Homeward Compass).</div>');
      if (d.post) opts.push(`<div class="dopt vendor" data-p="1"><b>@</b> Is there any post for me?${this.you?.mailNew ? ` <span style="float:right;color:#ffe08a">${this.you.mailNew} new</span>` : ''}</div>`);
      if (d.store) opts.push('<div class="dopt vendor" data-b="1"><b>$</b> I would like to use my storehouse shelves.</div>');
      if (d.valley) { const V = d.valley; opts.push(`<div class="dopt vendor" data-don="1"><b>+</b> Give Darius my scrap, cogs and bronze. <span style="float:right;color:#ffc040">${V.name}${V.next ? ` \u00b7 ${V.pts} / ${V.next}` : ' \u00b7 finished'}</span></div>`); }
      if (d.repShop) opts.push(`<div class="dopt vendor" data-s="1"><b>$</b> ${d.repShop.mark ? 'Trade Makers\u2019 Marks for gear.' : `Show me the stores of ${/^the /i.test(FACTIONS[d.repShop.faction].name) ? FACTIONS[d.repShop.faction].name.replace(/^The /, 'the ') : 'the ' + FACTIONS[d.repShop.faction].name}.`}</div>`);
      // one line per port the man sails to (his default first); a port still shut is greyed with the chapter that opens it
      // (a liftwright's routes are kind 'lift': ridden, not sailed, and only waiting on their own chapter)
      if (d.sail) for (const R of d.sail.routes || [{ to: d.sail.to, ok: d.sail.ok, need: 'm_c29_aboard' }]) { const rope = R.kind === 'rope' || (!d.sail.haul && d.sail.rope), haul = !rope && (R.kind === 'haul' || d.sail.haul), lift = !haul && !rope && (R.kind === 'lift' || d.sail.lift), line = SAIL_LINE[R.to] || (rope ? `Ride the ropeway to ${R.name}.` : haul ? `Ride the haul road to ${R.name}.` : lift ? `Ride the lift to ${R.name}.` : `Sail to ${R.name}.`); opts.push(R.ok ? `<div class="dopt travel" data-sl="1" data-to="${R.to}"><b>&gt;</b> ${line}</div>` : `<div class="dopt travel muted"><b>&gt;</b> ${rope ? `${line} The rope is not wound yet.` : haul ? `${line} The haulier is not wound yet.` : lift ? `${line} The lift is not running yet.` : R.need === 'm_c29_aboard' ? 'The ship is not ready to sail yet.' : `${line} The ship is not ready for that voyage yet.`} <span style="float:right;opacity:.8">${NEED_CH[R.need] || 'Main Story'}</span></div>`); }
      if (d.runabout) opts.push('<div class="dopt travel" data-r="1"><b>+</b> Tell me about the runabouts.</div>');
      if (d.muster) opts.push('<div class="dopt travel" data-mu="1"><b>&gt;</b> Find me a group for a dungeon.</div>');
      if (d.homeshop) opts.push('<div class="dopt travel" data-hs="1"><b>+</b> Furnish my homestead.</div>');
      $('.wb', w).innerHTML = `<div class="qp-head" style="background-image:url('/sunmere-play/ui/loading/${artAt(npc.x, npc.z)}.webp')"><div class="qp-who"><b>${npc.name}</b>${npc.title ? `<span>${npc.title}</span>` : ''}</div></div><p class="qp-greet">\u201c${npc.greet || (npc.caravan ? 'The carts leave when they are loaded. Where are you bound?' : greetings[npc.name.length % greetings.length])}\u201d</p><div class="qp-opts">${opts.join('') || '<p class="qp-greet">I have nothing for you right now.</p>'}</div>`;
      $('.wb', w).scrollTop = 0;
      w.querySelectorAll('.dopt').forEach((e) => (e.onclick = () => ($('.wb', w).classList.remove('parch'), e.dataset.sl ? (this.g.send({ t: 'sail', npc: d.npc, to: e.dataset.to }), w.remove()) : e.dataset.don ? (this.g.send({ t: 'donate', npc: d.npc }), w.remove()) : e.dataset.v ? this.openVendor(d.vendor, w, d.npc) : e.dataset.b ? this.openStore(d.store, w) : e.dataset.p ? this.openPost(d.npc, w) : e.dataset.hm ? (this.g.send({ t: 'setHome', npc: d.npc }), w.remove()) : e.dataset.x ? this.openTrade(d.npc, w) : e.dataset.bt ? this.openBounty(d.bounty, d.npc, w) : e.dataset.rf ? this.openUpgrade(d.npc, w) : e.dataset.sv ? this.openSalvage(d.npc, w) : e.dataset.us ? this.openUnsocket(d.npc, w) : e.dataset.sp ? spares() : e.dataset.mu ? muster() : e.dataset.hs ? homeshop() : e.dataset.dr ? rides() : e.dataset.ld ? ladder() : e.dataset.c ? this.openCraft(d.craft, d.npc, w) : e.dataset.a ? (this.g.send({ t: 'trial', npc: d.npc }), w.remove()) : e.dataset.s ? stores() : e.dataset.t ? travel() : e.dataset.h ? hire() : e.dataset.r ? runabout() : showQuest(e.dataset.q, e.dataset.m))));
    };
    // the rewards you did not choose, from quests handed in here
    const spares = () => {
      $('.wb', w).classList.add('parch');
      $('.wb', w).innerHTML = `<div class="qp-head" style="background-image:url('/sunmere-play/ui/loading/${artAt(npc.x, npc.z)}.webp')"><div class="qp-who"><b>${npc.name}</b>${npc.title ? `<span>${npc.title}</span>` : ''}</div></div><p class="qp-greet">\u201cI kept the ones you left behind. They are yours, for the cost of the smith\u2019s time.\u201d</p><div class="qp-cards">${d.spares.map((sp) => {
        const it = ITEMS[sp.id], q = it.q ?? 1, S = it.stats || {};
        const st = [...['power', 'armor', 'hp'].filter((k) => S[k]), ...Object.keys(S).filter((k) => !['power', 'armor', 'hp'].includes(k) && S[k])].slice(0, 3).map((k) => `+${S[k]}${STAT_PCT[k] ? '%' : ''} ${STAT_NAME[k] || k}`).join(' \u00b7 ');
        return `<div class="rcard sp-card" data-i="${sp.id}" style="--qc:${QUALITY[q]};--qi:${INK[q]}"><img src="${icon(it.icon, '#3a3226', 64)}"><div><b>${it.name}</b><span>${[SLOT_LABEL[it.slot], typeLine(it)].filter(Boolean).join(' \u00b7 ')} \u00b7 from \u201c${QUESTS[sp.q].name}\u201d</span><em>${st}</em>${upTag(it, this.you)}</div><button class="sp-buy" data-q="${sp.q}" data-i="${sp.id}" ${this.you.gold >= sp.price ? '' : 'disabled'}>${fmtMoney(sp.price)}</button></div>`;
      }).join('')}</div><div class="dbtns"><button class="back">Back</button></div>`;
      w.querySelectorAll('.sp-card img').forEach((e) => { e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip({ id: e.parentElement.dataset.i }))); e.addEventListener('mouseleave', () => this.hideTip()); });
      w.querySelectorAll('.sp-buy').forEach((b) => (b.onclick = () => this.g.send({ t: 'buySpare', npc: d.npc, q: b.dataset.q, id: b.dataset.i })));
      $('.back', w).onclick = () => main();
    };
    const stores = () => {
      const S = d.repShop, F = S.mark ? { name: 'The Makers\u2019 Marks', color: '#c8a050' } : FACTIONS[S.faction];
      $('.wb', w).innerHTML = `${S.mark ? `<h3>${miscArt('mark_makers') ? `<img class="crest-ic" src="${miscArt('mark_makers')}" alt="">` : ''}Trade for Makers\u2019 Marks</h3><p class="qtext">You carry <b style="color:#e8c060">${S.have}</b> Makers\u2019 Marks. They drop from the level 38+ bosses, rares and world boss: the Deepway, the Copy-Works and the Makers\u2019 Hall.</p>` : `<h3>${factionArt(S.faction) ? `<img class="crest-ic" src="${factionArt(S.faction)}" alt="">` : ''}${F.name} stores</h3><p class="qtext">Your standing: <b style="color:${F.color}">${REP_RANKS[S.rank].name}</b> (${S.rep} reputation). The higher your standing with ${F.name.replace(/^The /, 'the ')}, the more they will trust you with.</p>`}
        <div class="rep-shop">${S.items.map((s) => { const it = ITEMS[s.item]; return `<div class="vitem rs ${s.ok ? '' : 'locked'}" data-id="${s.item}"><img src="${icon(it.icon, '#3a3226', 40)}" style="border-color:${QUALITY[it.q]}"><div><b style="color:${QUALITY[it.q]}">${it.name}</b><div class="vp">${S.mark ? `${s.price} marks` : s.ok ? fmtMoney(s.price) : `Requires ${REP_RANKS[s.rank].name}`}</div></div></div>`; }).join('')}</div>
        <div class="dbtns"><button class="back">Back</button></div>`;
      w.querySelectorAll('.rs').forEach((e) => {
        e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip({ id: e.dataset.id })));
        e.addEventListener('mouseleave', () => this.hideTip());
        if (!e.classList.contains('locked')) e.onclick = () => this.g.send({ t: 'repBuy', npc: d.npc, item: e.dataset.id });
      });
      $('.back', w).onclick = () => main();
    };
    const runabout = () => {
      const R = d.runabout, ok = this.you.level >= R.level;
      $('.wb', w).innerHTML = `<h3>The Brass Runabout</h3><p class="qtext">A one-seat clockwork steam cart with a copper boiler and solid iron wheels. It carries you 65% faster than running, anywhere outdoors. Press <b>R</b> to ride and R again to step down. Any attack or blow throws you off, and there is no room to drive inside the dungeons.</p>
        <div class="qrw">${R.have ? 'You already own one. Press R to ride.' : `Price: ${fmtMoney(R.cost)} · Requires level ${R.level}`}</div>
        <div class="dbtns">${R.have ? '' : `<button class="buy" ${ok && this.you.gold >= R.cost ? '' : 'disabled style="filter:grayscale(1);opacity:.6"'}>Buy the runabout</button>`}<button class="back">Back</button></div>`;
      const b = $('.buy', w); if (b && ok) b.onclick = () => { this.g.send({ t: 'buyRunabout', npc: d.npc }); w.remove(); };
      // the three marks side by side, yours lit
      {
        const mk = R.have ? R.mk || 1 : 0, rows = [[1, 'Mk I', '65% faster', 'copper boiler, iron wheels', 'Ottmar'], [2, 'Mk II', '100% faster', 'twin stacks, broad rear wheels', `Ottmar, level ${R.mk2?.level || 20}`], [3, 'Mk III', '130% faster', 'Makers’ bronze drive, verdigris bands', 'Kasim, Exalted with the Explorers’ Guild']];
        $('.dbtns', w).insertAdjacentHTML('beforebegin', `<div class="mk-table">${rows.map(([n, name, sp, look, from]) => `<div class="mk-row ${mk === n ? 'on' : mk > n ? 'past' : ''}"><b>${name}</b><span>${sp}</span><em>${look}</em><i>${from}</i></div>`).join('')}</div>`);
      }
      if (R.have && R.mk2) {
        const M = R.mk2, can = this.you.level >= M.level && this.you.gold >= M.cost;
        $('.dbtns', w).insertAdjacentHTML('beforebegin', R.mk >= 3 ? '<div class="qrw mk2">Yours is a Mk III: the Makers’ bronze drive, 130% faster than running.</div>' : R.mk === 2 ? '<div class="qrw mk2">Yours is a Mk II: twin-stack boiler, broad rear wheels, 100% faster than running. Exalted with the Explorers’ Guild? Kasim sells a drive kit that makes it a Mk III.</div>' : `<div class="qrw mk2"><b>Mk II upgrade</b>: a twin-stack boiler and broad rear wheels, 100% faster than running. ${fmtMoney(M.cost)} · Requires level ${M.level} <button class="up" ${can ? '' : 'disabled style="filter:grayscale(1);opacity:.6"'}>Upgrade</button></div>`);
        const u = $('.up', w); if (u && can) u.onclick = () => { this.g.send({ t: 'upgradeRunabout', npc: d.npc }); w.remove(); };
      }
      if (R.crawler) {
        // the Deepway Crawler deed: choose which mount R brings (a style choice; the crawler runs at Mk II speed)
        const kb = (k, label) => `<button class="mkind" data-k="${k}" ${R.kind === k ? 'disabled style="outline:2px solid #e8c26a"' : ''} ${k === 'runabout' && !R.have ? 'disabled style="filter:grayscale(1);opacity:.6"' : ''}>${label}</button>`;
        $('.dbtns', w).insertAdjacentHTML('beforebegin', `<div class="qrw mk2"><b>R brings:</b> ${kb('runabout', 'Your runabout')} ${kb('crawler', 'Deepway Crawler')}<br><span style="opacity:.8">The crawler is a bronze half-track from the Deepway. It runs as fast as a Mk II and takes your paint.</span></div>`);
        w.querySelectorAll('.mkind').forEach((e) => (e.onclick = () => { this.g.send({ t: 'mountKind', npc: d.npc, kind: e.dataset.k }); R.kind = e.dataset.k; w.querySelectorAll('.mkind').forEach((x) => { const on = x === e; x.disabled = on || (x.dataset.k === 'runabout' && !R.have); x.style.outline = on ? '2px solid #e8c26a' : ''; }); }));
      }
      if (R.have || R.crawler) {
        $('.dbtns', w).insertAdjacentHTML('beforebegin', `<div class="paints"><div class="qrw">Paint:</div>${Object.entries(PAINTS).map(([k, P]) => { const got = R.paints.includes(k), need = P.need ? (P.need.rep ? `Honored with ${FACTIONS[P.need.rep].name}` : 'Reach level 25') : ''; return `<div class="paint ${got ? '' : 'locked'} ${R.paint === k ? 'on' : ''}" data-p="${k}" title="${got ? P.name : 'Unlocks: ' + need}">${miscArt('paint_' + k) ? `<img class="paint-ic" src="${miscArt('paint_' + k)}" alt="">` : `<i style="background:${P.body}"></i><i style="background:${P.trim || '#d9a650'}"></i>`}<span>${P.name}${got ? '' : `<em>${need}</em>`}</span></div>`; }).join('')}</div>`);
        w.querySelectorAll('.paint:not(.locked)').forEach((e) => (e.onclick = () => { this.g.send({ t: 'paint', npc: d.npc, paint: e.dataset.p }); R.paint = e.dataset.p; w.querySelectorAll('.paint').forEach((x) => x.classList.toggle('on', x === e)); }));
      }
      $('.back', w).onclick = () => main();
    };
    const ladder = () => {
      const L = d.ladder, days = Math.max(0, Math.ceil((L.next - Date.now()) / 864e5));
      $('.wb', w).innerHTML = `<h3>The Ring\u2019s Ladder</h3><p class="qtext">The best trial of the week for everyone who steps into the ring. The top three are paid when the week turns (in ${days} day${days === 1 ? '' : 's'}).</p><div class="mt-rows ladder">${L.rows.map((r, i) => `<div class="mt-row ${r.you ? 'me' : ''}"><i style="width:${(r.best / Math.max(1, L.rows[0].best)) * 100}%;background:${CLASSES[r.cls]?.color || '#8a7a5a'}"></i><span>${i + 1}. ${shownName(r.name, r.bot)}</span><b>wave ${r.best}</b></div>`).join('')}</div>${L.rank ? '' : '<p class="qtext">Fight a trial this week to get on the ladder.</p>'}<div class="dbtns"><button class="back">Back</button></div>`;
      $('.back', w).onclick = () => main();
    };
    const homeshop = () => {
      const own = d.homeshop.owned || {};
      $('.wb', w).innerHTML = `<h3>Furnish your homestead</h3><p class="qtext">Idwal builds it and it stands in your yard for good. Your trophies (the gavel, the compass, the core and a plaque for each raid you have cleared) stand on their own stands once you have earned them.</p>
        <div class="tr-list">${Object.entries(HOME_DECO).map(([k, D]) => `<div class="tr-row ${own[k] ? 'done' : ''}"><img class="tr-ic" src="${decoArt(k) || icon('hammer', '#3a3226', 36)}"><div class="tr-mid"><b>${D.name}</b><span>${D.desc}</span></div><div class="tr-end">${own[k] ? (HOME_MOVABLE.includes(k) ? `<select class="hs-spot" data-id="${k}"><option value="-1">Where Idwal set it</option>${HOME_SPOTS.map((_, i) => `<option value="${i}" ${d.homeshop.pos?.[k] === i ? 'selected' : ''}>Spot ${i + 1}</option>`).join('')}</select>` : '<span class="tr-pay">Built</span>') : D.need && repRank(d.homeshop.rep?.[D.need.rep] || 0) < D.need.rank ? `<span class="tr-pay">${REP_RANKS[D.need.rank]?.name || 'Honored'} with ${FACTIONS[D.need.rep].name}</span>` : `<span class="tr-pay">${fmtMoney(D.price)}</span><button class="hs-buy" data-id="${k}">Build</button>`}</div></div>`).join('')}</div>
        <h4 class="tr-h">Trophies</h4><div class="tr-list hs-tro">${HOME_TROPHIES.map(([k, n, need]) => { const got = need.done ? !!this.you.done?.[need.done] : !!this.ach?.done?.[need.ach]; return `<div class="tr-row ${got ? '' : 'tr-not'}"><img class="tr-ic" src="${homeArt(k) || icon('notice', '#3a3226', 36)}" alt=""><div class="tr-mid"><b>${n}</b><span>${got ? 'Earned: it stands in your yard' : need.done ? 'From the Main Story' : `From the achievement “${ACH_BY_ID[need.ach]?.name || need.ach}”`}</span></div></div>`; }).join('')}</div><div class="dbtns"><button class="back">Back</button></div>`;
      w.querySelectorAll('.hs-buy').forEach((b) => (b.onclick = () => { this.g.send({ t: 'homeBuy', npc: d.npc, id: b.dataset.id }); w.remove(); }));
      w.querySelectorAll('.hs-spot').forEach((sel) => (sel.onchange = () => { this.g.send({ t: 'homeMove', npc: d.npc, id: sel.dataset.id, spot: Number(sel.value) }); (d.homeshop.pos ||= {})[sel.dataset.id] = Number(sel.value); }));
      $('.back', w).onclick = () => main();
    };
    const muster = () => {
      const M = d.muster, RC = { tank: '#7ab0ff', healer: '#8ae07a', damage: '#ff9a6a' };
      const who = (x, extra) => `<span class="mu-m" style="--rc:${RC[x.role]}"><b style="color:${CLASSES[x.cls].color}">${x.name}</b> <em>${x.role}</em>${extra || ''}</span>`;
      $('.wb', w).innerHTML = `<h3>Group Finder</h3><p class="qtext">Bram fills your company to five: a tank first, then a healer, then damage. Volunteers meet you inside and go home when you leave. Road money: ${fmtMoney(M.cost)}.</p>
        <div class="mu-party"><div><label>Your company</label>${M.have.map((x) => who(x, x.you ? ' (you)' : '')).join('')}</div><div><label>Volunteers</label>${M.need.length ? M.need.map((x) => who(x)).join('') : '<span class="mu-m">None needed: your company is full.</span>'}</div></div>
        ${M.alone ? '' : '<p class="qtext" style="color:#ffb070">The board is for those travelling alone or with companions.</p>'}${this.lfgPanelHtml?.(M) || ''}
        <div class="tr-list">${M.list.map((x) => `<div class="tr-row ${x.ok ? '' : 'done'}">${dgIc(x.id, false)}<div class="tr-mid"><b>${x.name}</b><span>Level ${x.level}${x.raid ? ' \u00b7 raid' : ''}</span></div><div class="tr-end">${x.ok && M.alone ? `<button class="mu-go" data-id="${x.id}">Muster</button>` : ''}${x.ok && M.queue && M.lead && !(this.lfg || M.queue).queued ? `<button class="mu-q" data-id="${x.id}">Queue</button>` : ''}</div></div>`).join('')}</div><div class="dbtns"><button class="back">Back</button></div>`;
      w.querySelectorAll('.mu-go').forEach((b) => (b.onclick = () => { this.g.send({ t: 'muster', npc: d.npc, id: b.dataset.id }); w.remove(); }));
      this.lfgPanelWire?.(w, M, muster); // the group finder queue (living bots A.7, client/ui/social.js)
      $('.back', w).onclick = () => main();
    };
    const rides = () => {
      const R = d.rides;
      $('.wb', w).innerHTML = `<h3>Dungeon Rides</h3><p class="qtext">The watch keeps a cart for those brave enough to go underground. Today's featured dungeon pays a bonus from the watch for its final boss${R.done ? ' (you have claimed today\u2019s)' : ''}.</p><div class="tr-list">${R.list.map((x) => `<div class="tr-row ${x.ok ? '' : 'done'}">${dgIc(x.id, x.id === R.featured)}<div class="tr-mid"><b>${x.name}${x.id === R.featured ? ' <span style="color:#ffc040;font-weight:400">featured today</span>' : ''}</b><span>Level ${x.level}${x.raid ? ' \u00b7 raid for a full company (smaller groups face weaker bosses)' : ''}</span>${x.lock ? `<span class="tr-lock">This week: ${x.lock.map((b) => `${b.name} ${b.done ? '<i>looted</i>' : '<em>ready</em>'}`).join(', ')}</span>` : ''}</div><div class="tr-end"><span class="tr-pay">${fmtMoney(x.cost)}</span>${x.ok ? `<button class="ride" data-id="${x.id}">Ride</button>` : ''}</div></div>`).join('')}</div><div class="dbtns"><button class="back">Back</button></div>`;
      w.querySelectorAll('.ride').forEach((b) => (b.onclick = () => { this.g.send({ t: 'dungeonRide', npc: d.npc, id: b.dataset.id }); w.remove(); }));
      $('.back', w).onclick = () => main();
    };
    const hire = () => {
      const with_ = d.companions || [];
      $('.wb', w).innerHTML = `<h3>Companions for hire</h3><p class="qtext">Up to two companions walk with you: a shield and a medic make a good pair for the dungeons. Each joins your party, follows you everywhere and fights with his own skills.${with_.length >= 2 ? ' You lead two already: dismiss one to hire another.' : ''}</p>
        ${d.hire.map((c) => `<div class="dopt hire ${with_.includes(c.cls) ? 'cur' : ''}" data-c="${c.cls}"><img src="${classArt(c.cls)}"><div><b style="color:${CLASSES[c.cls].color}">${c.name}</b> <span class="hire-role">${c.role} · ${CLASSES[c.cls].name}</span><div class="hire-d">${c.desc}</div></div><span class="hire-cost">${with_.includes(c.cls) ? 'With you' : fmtMoney(c.cost)}</span></div>`).join('')}
        <div class="dbtns">${with_.length ? '<button class="dis">Dismiss all</button>' : ''}<button class="back">Back</button></div>`;
      w.querySelectorAll('.dopt.hire').forEach((e) => (e.onclick = () => { if (with_.includes(e.dataset.c)) return; this.g.send({ t: 'hire', npc: d.npc, cls: e.dataset.c }); w.remove(); }));
      const dis = $('.dis', w); if (dis) dis.onclick = () => { this.g.send({ t: 'chat', text: '/dismiss' }); w.remove(); };
      $('.back', w).onclick = () => main();
    };
    const travel = () => {
      $('.wb', w).innerHTML = `<h3>Supply caravans</h3><p class="qtext">The caravans run to every stop you have found. Where to?</p>${d.travel.map((c) => `<div class="dopt ${c.known ? 'travel' : 'locked'}" data-to="${c.id}" style="${c.known ? '' : 'opacity:.45;cursor:default'}"><b>&gt;</b> ${c.name} <span style="float:right">${c.known ? fmtMoney(c.cost) : 'not yet found'}</span></div>`).join('')}<div class="dbtns"><button class="back">Back</button></div>`;
      w.querySelectorAll('.dopt.travel').forEach((e) => (e.onclick = () => { this.g.send({ t: 'travel', npc: d.npc, to: e.dataset.to }); w.remove(); }));
      $('.back', w).onclick = () => main();
    };
    main();
    // a story hand-in (or the only hand-in) opens straight away, the way a story should
    const storyIn = d.turnins.find((q) => QUESTS[q].msq);
    if (storyIn) showQuest(storyIn, 'turnin');
    else if (d.turnins.length === 1 && !d.offers.length) showQuest(d.turnins[0], 'turnin');
  }

  openCraft(station, npcId, w) {
    this.craftWin = w;
    w.refresh = () => {
      if (!w.isConnected) return;
      const y = this.you, have = (id) => y.bag.filter((b) => b.id === id).reduce((a, b) => a + b.n, 0);
      const list = RECIPES.filter((r) => r.station === station).sort((a, b) => (a.skill || 0) - (b.skill || 0));
      const sk = y.prof?.[station] || 0;
      $('.wb', w).innerHTML = `<h3>${STATION_NAME[station]}</h3><div class="prof-bar"><span>${PROF_NAME[station]}</span><div class="pb"><i style="width:${sk}%"></i><b>${sk} / ${PROF_MAX}</b></div></div><div class="craft-list">${list.map((r) => {
        const it = ITEMS[r.makes], col = profColor(sk, r.skill || 0), okLvl = y.level >= r.lvl && col !== 'red';
        const needs = r.needs.map(([id, n]) => { const h = have(id); return `<span class="${h >= n ? 'cn-ok' : 'cn-no'}">${ITEMS[id].name} ${Math.min(h, n)}/${n}</span>`; }).join(' · ');
        const can = okLvl && r.needs.every(([id, n]) => have(id) >= n) && y.gold >= r.cost;
        return `<div class="craft ${can ? '' : 'cant'}" data-r="${r.id}"><img src="${icon(it.icon, '#3a3226', 40)}" style="border-color:${QUALITY[it.q ?? 1]}"><div class="cr-tx"><b style="color:${QUALITY[it.q ?? 1]}">${it.name}${r.n > 1 ? ' x' + r.n : ''}</b><div class="cr-n">${needs}</div><div class="cr-c">${y.level < r.lvl ? `Requires level ${r.lvl}` : col === 'red' ? `Requires ${PROF_NAME[station]} ${r.skill}` : fmtMoney(r.cost)}<span class="pc pc-${col}" title="Orange always teaches, yellow usually, green sometimes, grey never">${r.skill || 0}</span></div></div><button class="cr-b" ${can ? '' : 'disabled'}>Make</button></div>`;
      }).join('')}</div><div class="bag-hint">Ingredients come from machines, raiders and the mosscaps of the glade.</div><div class="dbtns"><button class="back">Back</button></div>`;
      w.querySelectorAll('.craft').forEach((e) => {
        const r = RECIPES.find((x) => x.id === e.dataset.r);
        e.querySelector('img').addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip({ id: r.makes })));
        e.querySelector('img').addEventListener('mouseleave', () => this.hideTip());
        e.querySelector('.cr-b').onclick = () => { this.g.send({ t: 'craft', npc: npcId, recipe: r.id }); this.g.sfx?.play('grind'); };
      });
      $('.back', w).onclick = () => { w.refresh = null; this.g.send({ t: 'npc', id: npcId }); };
    };
    w.refresh();
  }
  // Upgrades +1 to +10 (plan B4; replaces reforging): every Uncommon or better piece you wear or carry, ten pips with the heat
  // of stages 7 to 10, what the next step changes, its fixed price in gold and materials, and one button. It always works.
  openUpgrade(npcId, w) {
    this.upgradeWin = w;
    const npc = NPCS.find((n) => n.id === npcId);
    w.refresh = () => {
      if (!w.isConnected) return;
      const y = this.you, have = (id) => y.bag.filter((b) => b.id === id).reduce((a, b) => a + b.n, 0);
      const rows = [];
      for (const [slot, g] of Object.entries(y.equip || {})) if (g?.stats && (g.q ?? 1) >= UPG.minQ) rows.push({ g, where: 'equip', slot, worn: true });
      y.bag.forEach((b, i) => { const g = b.gear || (b.id && ITEMS[b.id]?.stats ? { ...ITEMS[b.id], id: b.id } : null); if (g?.stats && GEAR_SLOTS.includes(g.slot) && (g.q ?? 1) >= UPG.minQ) rows.push({ g, where: 'bag', slot: i }); });
      let S = this.upgSel && rows.find((r) => r.where === this.upgSel.where && String(r.slot) === String(this.upgSel.slot));
      if (!S) S = rows.find((r) => canUpgrade(r.g)) || rows[0];
      if (S) this.upgSel = { where: S.where, slot: S.slot };
      const list = rows.map((r) => { const g = r.g, q = g.q ?? 1, u = upOf(g); return `<div class="ug-row ${r === S ? 'on' : ''} ${u >= UPG.max ? 'full' : ''}" data-w="${r.where}" data-s="${r.slot}"><img src="${icon(g.icon, '#3a3226', 40)}" style="border-color:${QUALITY[q]}"><div class="ug-rt"><b style="color:${QUALITY[q]}">${gearName(g)}</b><span>${r.worn ? '<em class="rf-worn">worn</em> ' : ''}${SLOT_LABEL[g.slot] || g.slot} · ${g.ilvl || 1}</span>${upPips(u)}</div></div>`; }).join('');
      let detail = '<p class="qtext">You carry nothing Uncommon or better to upgrade. Bring green, blue, purple or better gear.</p>';
      if (S) {
        const g = S.g, q = g.q ?? 1, u = upOf(g), full = !canUpgrade(g), cost = full ? null : upgradeCost(g), next = full ? null : upgraded(g);
        const ok = !!cost && y.gold >= cost.gold && cost.mats.every(([id, n]) => have(id) >= n);
        const keys = ['power', 'armor', 'hp', 'haste', 'crit', 'dodge', 'leech', ...Object.keys(g.stats)].filter((k, i, a) => a.indexOf(k) === i && g.stats[k]);
        const fmt = (k, v) => `${v}${STAT_PCT[k] ? '%' : ''}`;
        const stats = keys.map((k) => `<div class="ug-st"><span>${STAT_NAME[k] || k}</span><b>${fmt(k, g.stats[k])}</b>${next ? `<i>→ ${fmt(k, next.stats[k])}</i>${next.stats[k] !== g.stats[k] ? `<em>+${next.stats[k] - g.stats[k]}</em>` : '<em class="z">–</em>'}` : ''}</div>`).join('');
        const nh = next && HEAT_STAGE[next.up], tot = full ? null : upgradeTotal(g);
        const mat = ([id, n]) => `<span class="ug-m ${have(id) >= n ? 'ok' : 'no'}"><img src="${icon(ITEMS[id]?.icon || 'scrap', '#3a3226', 28)}" style="border-color:${QUALITY[ITEMS[id]?.q ?? 1]}"><span>${ITEMS[id]?.name || id}</span><b>${Math.min(have(id), n)} / ${n}</b></span>`;
        detail = `<div class="ug-head"><img src="${icon(g.icon, '#3a3226', 64)}" style="border-color:${QUALITY[q]}" class="ug-ic"><div><b style="color:${QUALITY[q]}">${gearName(g)}</b><span><em style="color:${QUALITY[q]}">${QUALITY_NAME[q]}</em> · ${SLOT_LABEL[g.slot] || g.slot} · Item Level ${g.ilvl || 1}${S.worn ? ' · worn' : ''}</span></div></div>
          <div class="ug-track">${Array.from({ length: UPG.max }, (_, i) => { const s = i + 1, h = HEAT_STAGE[s]; return `<div class="ug-pip ${s <= u ? 'on' : next && s === next.up ? 'nx' : ''}${h ? ' heat' : ''}"${h ? ` style="--hc:${h.col}"` : ''} title="${h ? h.name + ' heat' : 'Step +' + s}"><i></i><span>+${s}</span></div>`; }).join('')}</div>
          <div class="ug-note">${full ? `Fully upgraded: +30% on every stat${(g.sockets || []).length ? ' and a socket of its own' : ''}. Nothing more to work.` : `Next: <b>+${next.up}</b>, every stat ${Math.round(next.up * UPG.per * 100)}% above its base${next.up === UPG.max ? ', and a new socket opens' : ''}.${nh ? ` <span class="ug-heat" style="--hc:${nh.col}"><i></i>${nh.name} in the steel</span>` : ''}`}</div>
          <div class="ug-stats">${stats}</div>
          ${full ? '' : `<div class="ug-cost"><span class="ug-g ${y.gold >= cost.gold ? 'ok' : 'no'}"><b>${fmtMoney(cost.gold)}</b><span>smith’s fee</span></span>${cost.mats.map(mat).join('')}</div>
          <div class="ug-tot">From here to +${UPG.max}: ${fmtMoney(tot.gold)} · ${tot.mats.map(([id, n]) => `${n} ${ITEMS[id]?.name || id}`).join(' · ')}</div>
          <button class="ug-b" ${ok ? '' : 'disabled'}>${ok ? `Upgrade to +${next.up}` : y.gold < cost.gold ? 'Not enough gold' : 'Missing materials'}</button>`}`;
      }
      $('.wb', w).innerHTML = `<h3>Upgrades</h3><p class="qtext">${npc?.name || 'The smith'} can work any Uncommon or better piece up to +10. Each step adds 3% of its base to every stat, and +10 opens a socket. It always works: a fixed price for a fixed result.</p>
        <div class="ug-wrap"><div class="ug-list">${list || ''}</div><div class="ug-detail">${detail}</div></div>
        <div class="bag-hint">Materials: the ore of the piece’s item level for every step, Tempered Billets from +4 (Heroic and Tempest bosses, or salvaged Epic pieces of item level 40 and up), War-Engine Cores from +7 (raid bosses and world bosses).</div><div class="dbtns"><button class="back">Back</button></div>`;
      w.querySelectorAll('.ug-row').forEach((e) => {
        const r = rows.find((x) => x.where === e.dataset.w && String(x.slot) === e.dataset.s);
        e.onclick = () => { this.upgSel = { where: r.where, slot: r.slot }; this.g.sfx?.play('ui'); w.refresh(); };
        const im = $('img', e); im.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip({ gear: r.g }, false))); im.addEventListener('mouseleave', () => this.hideTip());
      });
      const ic = $('.ug-ic', w); if (ic && S) { ic.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip({ gear: S.g }, false))); ic.addEventListener('mouseleave', () => this.hideTip()); }
      const b = $('.ug-b', w);
      if (b && S) b.onclick = () => {
        b.disabled = true; b.textContent = 'Working the steel…';
        const ref = JSON.stringify(S.where === 'bag' ? y.bag[S.slot] : y.equip[S.slot]);
        this.g.send({ t: 'upgrade', npc: npcId, where: S.where, slot: S.slot, ref });
        this.g.sfx?.play('clang', 0.5);
        setTimeout(() => { if (b.isConnected && b.disabled) w.refresh(); }, 2500); // no answer (an error line in the chat): let them try again
      };
      $('.back', w).onclick = () => { w.refresh = null; this.upgradeWin = null; this.g.send({ t: 'npc', id: npcId }); };
    };
    w.refresh();
  }
  // Salvage: what each Uncommon or better piece in your bags breaks down into; Epic and better ask twice
  openSalvage(npcId, w) {
    w.refresh = () => {
      if (!w.isConnected) return;
      const y = this.you, rows = [];
      y.bag.forEach((b, i) => { const g = b.gear || (b.id && ITEMS[b.id]?.stats ? { ...ITEMS[b.id], id: b.id } : null); if (g?.stats && salvageYield(g).length) rows.push({ g, i }); });
      // a Dragonslayer piece you hold twice (worn or in the bags) gives War-Engine Cores as well
      const held = (id) => Object.values(y.equip || {}).filter((e) => e?.id === id).length + y.bag.filter((b) => (b.gear?.id || b.id) === id).length;
      const dupDs = (g) => String(g.id || '').startsWith('ds_') && held(g.id) >= 2;
      $('.wb', w).innerHTML = `<h3>Salvage</h3><p class="qtext">The smith breaks down gear you no longer need into the ore that upgrades take. Every piece gives a fixed amount: more for better rarity, more again for upgraded pieces. Epic and better pieces of item level 40 and up also give Tempered Billets, and a second copy of a Dragonslayer piece gives War-Engine Cores. Worn gear is safe; only what is in your bags is listed.</p>
        <div class="rf-list">${rows.map((r) => { const g = r.g, q = g.q ?? 1, out = salvageYield(g, { dupDs: dupDs(g) }); return `<div class="rf-row"><img src="${icon(g.icon, '#3a3226', 44)}" style="border-color:${QUALITY[q]}" data-i="${r.i}"><div class="rf-tx"><b style="color:${QUALITY[q]}">${gearName(g)}</b><span>Item level ${g.ilvl || 1} \u00b7 ${QUALITY_NAME[q]}</span><span class="rf-cost">Gives ${out.map(([id, k]) => `${k} ${ITEMS[id].name}`).join(' \u00b7 ')}</span></div><button class="sv-b" data-i="${r.i}" data-q="${q}">Salvage</button></div>`; }).join('') || '<p class="qtext">Nothing in your bags is worth salvaging. Bring Uncommon gear or better.</p>'}</div>
        <div class="dbtns"><button class="back">Back</button></div>`;
      w.querySelectorAll('.sv-b').forEach((b) => (b.onclick = () => {
        const it = y.bag[Number(b.dataset.i)];
        if ((Number(b.dataset.q) >= 4 || upOf(it?.gear) >= 4) && !b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Sure?'; return; }
        this.g.send({ t: 'salvageGear', npc: npcId, slot: Number(b.dataset.i), ref: JSON.stringify(it) }); this.g.sfx?.play('grind');
      }));
      w.querySelectorAll('.rf-row img').forEach((e) => { const it = y.bag[Number(e.dataset.i)]; e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip(it))); e.addEventListener('mouseleave', () => this.hideTip()); });
      $('.back', w).onclick = () => { w.refresh = null; this.g.send({ t: 'npc', id: npcId }); };
    };
    w.refresh();
  }
  // Unsocketing: every gem set in what you wear or carry, and the fee to have it back
  openUnsocket(npcId, w) {
    w.refresh = () => {
      if (!w.isConnected) return;
      const y = this.you, rows = [];
      for (const [slot, g] of Object.entries(y.equip || {})) if (g?.sockets?.some(Boolean)) rows.push({ g, where: 'equip', slot, worn: true });
      y.bag.forEach((b, i) => { if (b.gear?.sockets?.some(Boolean)) rows.push({ g: b.gear, where: 'bag', slot: i }); });
      $('.wb', w).innerHTML = `<h3>Gems and sockets</h3><p class="qtext">Brannoc can work a gem free of its socket without a scratch, so you can set it into something better.</p>
        <div class="rf-list">${rows.map((r) => { const g = r.g, q = g.q ?? 1, fee = unsocketFee(g); return `<div class="rf-row"><img src="${icon(g.icon, '#3a3226', 44)}" style="border-color:${QUALITY[q]}"><div class="rf-tx"><b style="color:${QUALITY[q]}">${gearName(g)}</b>${r.worn ? ' <span class="rf-worn">worn</span>' : ''}${g.sockets.map((gm, i) => gm && GEMS[gm] ? `<span class="us-gem"><i class="gem-${GEMS[gm].color}"></i>${GEMS[gm].name}: ${Object.entries(GEMS[gm].stats).map(([k, v]) => `+${v}${STAT_PCT[k] ? '%' : ''} ${STAT_NAME[k]}`).join(', ')} <button class="us-b" data-w="${r.where}" data-s="${r.slot}" data-i="${i}" ${y.gold >= fee ? '' : 'disabled'}>Take out \u00b7 ${fmtMoney(fee)}</button></span>` : '').join('')}</div></div>`; }).join('') || '<p class="qtext">None of your gear has a gem in it.</p>'}</div>
        <div class="dbtns"><button class="back">Back</button></div>`;
      w.querySelectorAll('.us-b').forEach((b) => (b.onclick = () => { this.g.send({ t: 'unsocket', npc: npcId, where: b.dataset.w, slot: b.dataset.w === 'bag' ? Number(b.dataset.s) : b.dataset.s, i: Number(b.dataset.i) }); this.g.sfx?.play('ui'); }));
      $('.back', w).onclick = () => { w.refresh = null; this.g.send({ t: 'npc', id: npcId }); };
    };
    w.refresh();
  }
  openBounty(state, npc, w) { this.bountyWin = w; this.bountyNpc = npc; this.setBounty(state); }
  setBounty(state) {
    const w = this.bountyWin, npc = this.bountyNpc;
    if (!w?.isConnected) return;
    const days = Math.max(0, Math.ceil((state.next - Date.now()) / 864e5));
    $('.wb', w).innerHTML = `<h3>${miscArt('bounty') ? `<img class="bb-head" src="${miscArt('bounty')}" alt="">` : ''}Bounty Board</h3><p class="qtext">Wanted by the watches this week. Any blow you land on the target counts.</p><div class="tr-list">${state.list.map((b) => `<div class="tr-row ${b.claimed ? 'done' : ''}"><img class="tr-ic${b.boss ? ' tr-boss' : ''}${PORTRAITS.has(b.kind) ? ' tr-thumb' : ''}" src="${PORTRAITS.has(b.kind) ? `/sunmere-play/ui/portraits/${b.kind}.webp` : miscArt('bounty') || icon(b.boss ? 'shield' : 'gear', b.boss ? '#5a1a14' : '#3a3226', 36)}" alt=""><div class="tr-mid"><b>${b.name} <span style="color:#a8987a;font-weight:400">level ${b.lvl}</span></b><span>${b.where}${b.boss ? ' · dungeon boss' : ''}</span><span>${b.claimed ? 'Claimed. Well done.' : b.killed ? 'Done: claim your reward' : 'Open'}</span></div><div class="tr-end"><span class="tr-pay">${fmtMoney(b.gold)}</span>${b.killed && !b.claimed ? `<button class="claimb" data-k="${b.kind}">Claim</button>` : ''}</div></div>`).join('')}</div>
      <div class="bag-hint">New bounties in ${days} day${days === 1 ? '' : 's'} · rewards also pay experience and reputation with the target's watch</div><div class="dbtns"><button class="back">Back</button></div>`;
    w.querySelectorAll('.claimb').forEach((b) => (b.onclick = () => this.g.send({ t: 'bountyClaim', npc, kind: b.dataset.k })));
    $('.back', w).onclick = () => this.g.send({ t: 'npc', id: npc });
  }
  openTrade(npc, w) {
    this.tradeWin = w; this.tradeNpc = npc; this.tradeTab ||= 'work'; this.tradeData = null;
    $('.wb', w).innerHTML = '<p class="qtext">Factor Odo turns the pages of his ledger...</p>';
    this.g.send({ t: 'tradeOpen', npc });
  }
  setTrade(d) { this.tradeData = d; this.renderTrade(); }
  renderTrade() {
    const w = this.tradeWin, d = this.tradeData;
    if (!w?.isConnected || !d) return;
    const y = this.you, npc = this.tradeNpc, have = (id) => y.bag.filter((b) => b.id === id).reduce((a, b) => a + b.n, 0);
    const ic = (id) => `<img class="tr-ic" src="${icon(ITEMS[id].icon || 'scrap', '#3a3226', 36)}">`;
    const mins = Math.max(0, Math.round((d.next - Date.now()) / 60000));
    const tabs = `<div class="post-tabs"><button data-tab="work" class="${this.tradeTab === 'work' ? 'on' : ''}">Work orders</button><button data-tab="buy" class="${this.tradeTab === 'buy' ? 'on' : ''}">Buy orders</button></div>`;
    let body = '';
    if (this.tradeTab === 'work') {
      body = `<div class="tr-list">${d.work.map((o) => { const left = o.n - o.got, h = have(o.item); return `<div class="tr-row ${left <= 0 ? 'done' : ''}">${ic(o.item)}<div class="tr-mid"><b>${o.n} ${ITEMS[o.item].name}</b><span>${o.from}</span><span>${left <= 0 ? 'Filled. Thank you!' : `Delivered ${o.got}/${o.n} · you carry ${h}`}</span></div><div class="tr-end"><span class="tr-pay">${fmtMoney(o.pay)} each</span>${left > 0 ? `<button class="fill" data-id="${o.id}" ${h ? '' : 'disabled'}>Deliver${h ? ' ' + Math.min(h, left) : ''}</button>` : ''}</div></div>`; }).join('')}</div>
        <div class="bag-hint">New orders in ${mins >= 60 ? Math.floor(mins / 60) + 'h ' : ''}${mins % 60}m · every delivery also earns reputation with the order's watch</div>`;
    } else {
      const goods = Object.keys(TRADE.goods);
      const F = this.tradeForm ||= { item: goods[0], n: 10, price: tradeFair(goods[0]) };
      const total = F.n * F.price, fee = Math.ceil(total * TRADE.fee);
      body = `<h4 class="tr-h">Your buy orders (${d.mine.length}/${TRADE.maxOwn})</h4>${d.mine.length ? `<div class="tr-list">${d.mine.map((o) => `<div class="tr-row">${ic(o.item)}<div class="tr-mid"><b>${o.n} ${ITEMS[o.item].name}</b><span>${o.got} of ${o.n} arrived · ${fmtMoney(o.price)} each</span></div><div class="tr-end"><button class="cancel" data-id="${o.id}">Withdraw</button></div></div>`).join('')}</div>` : '<p class="qtext">None. Post one below and the goods will come to you by post.</p>'}
        ${d.mine.length < TRADE.maxOwn ? `<div class="tr-form"><select class="tf-item">${goods.map((id) => `<option value="${id}" ${id === F.item ? 'selected' : ''}>${ITEMS[id].name}</option>`).join('')}</select>
          <label>Qty <input class="tf-n" type="number" min="1" max="${TRADE.maxN}" value="${F.n}"></label><label>Each (copper) <input class="tf-p" type="number" min="1" value="${F.price}"></label>
          <div class="tr-sum">Fair price ${fmtMoney(tradeFair(F.item))} · held in trust ${fmtMoney(total)} + fee ${fmtMoney(fee)}</div><button class="post">Post order</button></div>` : ''}
        ${d.others.length ? `<h4 class="tr-h">Other adventurers are buying</h4><div class="tr-list">${d.others.map((o) => { const h = have(o.item); return `<div class="tr-row">${ic(o.item)}<div class="tr-mid"><b>${o.n - o.got} ${ITEMS[o.item].name}</b><span>for ${o.by} · ${fmtMoney(o.price)} each</span></div><div class="tr-end"><button class="sell" data-id="${o.id}" data-o="${o.owner}" ${h ? '' : 'disabled'}>Sell${h ? ' ' + Math.min(h, o.n - o.got) : ''}</button></div></div>`; }).join('')}</div>` : ''}`;
    }
    $('.wb', w).innerHTML = `<h3>Trading Post</h3>${tabs}${body}`;
    w.querySelectorAll('.post-tabs button').forEach((b) => (b.onclick = () => { this.tradeTab = b.dataset.tab; this.renderTrade(); }));
    w.querySelectorAll('.fill').forEach((b) => (b.onclick = () => this.g.send({ t: 'tradeFill', npc, id: b.dataset.id })));
    w.querySelectorAll('.cancel').forEach((b) => (b.onclick = () => this.g.send({ t: 'tradeCancel', npc, id: b.dataset.id })));
    w.querySelectorAll('.sell').forEach((b) => (b.onclick = () => this.g.send({ t: 'tradeSell', npc, id: b.dataset.id, owner: b.dataset.o })));
    const F = this.tradeForm, q = (c) => $(c, w);
    if (q('.tr-form')) {
      w.querySelectorAll('.tr-form input, .tr-form select').forEach((e) => { e.addEventListener('keydown', (ev) => ev.stopPropagation()); e.addEventListener('keyup', (ev) => ev.stopPropagation()); });
      q('.tf-item').onchange = (e) => { F.item = e.target.value; F.price = tradeFair(F.item); this.renderTrade(); };
      q('.tf-n').onchange = (e) => { F.n = Math.max(1, Math.min(TRADE.maxN, e.target.value | 0)); this.renderTrade(); };
      q('.tf-p').onchange = (e) => { F.price = Math.max(1, e.target.value | 0); this.renderTrade(); };
      q('.post').onclick = () => this.g.send({ t: 'tradePost', npc, item: F.item, n: F.n, price: F.price });
    }
    w.querySelectorAll('.tr-ic').forEach((e, i) => {});
  }
  openOutfit(id) {
    this.outfitFor = id;
    this.windows.outfit?.remove();
    const w = this.makeWindow('Outfit', 'w-outfit', 60, 140);
    this.windows.outfit = w;
    w.refresh = () => {
      const c = (this.you.comps || []).find((x) => x.id === this.outfitFor);
      if (!c) { $('.wb', w).innerHTML = '<p class="qtext">That companion is no longer with you.</p>'; return; }
      const kit = this.you.compGear?.[c.cls] || {};
      const SL = ['head', 'shoulders', 'back', 'chest', 'hands', 'legs', 'feet', 'weapon', 'offhand', 'trinket'];
      $('.wb', w).innerHTML = `<h3 style="color:${CLASSES[c.cls]?.color}">${c.name}</h3><div class="o-note">Power ${c.power} · Health ${c.hp} · Armour ${c.armor}%</div>
        <div class="equip">${SL.map((s) => { const it = kit[s]; return `<div class="eslot" data-s="${s}">${it ? `<img src="${icon(it.icon || s, '#3a3226', 48)}" style="border-color:${QUALITY[it.q]}">` : `<span>${s}</span>`}</div>`; }).join('')}</div>
        <div class="bag-hint">${IS_TOUCH ? 'Tap gear in your bags, then Give' : 'Right-click gear in your bags to give it'}; ${IS_TOUCH ? 'tap' : 'click'} a piece here to take it back. Empty slots use the standard kit.</div>`;
      w.querySelectorAll('.eslot').forEach((e) => {
        const it = kit[e.dataset.s];
        if (!it) return;
        e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip({ gear: it }, false)));
        e.addEventListener('mouseleave', () => this.hideTip());
        e.onclick = () => { this.hideTip(); this.g.send({ t: 'compTake', id: this.outfitFor, gslot: e.dataset.s }); };
      });
    };
    w.refresh();
    if (!this.windows.bags?.isConnected) this.toggle('bags'); else this.windows.bags.refresh();
  }
  openPost(npc, w) {
    this.postWin = w; this.postNpc = npc; this.postTab = 'in'; this.postList = null; this.postSel = null;
    $('.wb', w).innerHTML = '<div class="post"><p class="qtext">The Caravan Master leafs through a satchel of letters...</p></div>';
    this.g.send({ t: 'mailOpen', npc });
    const obs = new MutationObserver(() => { if (!w.isConnected) { this.postWin = null; this.postWrite = false; obs.disconnect(); this.windows.bags?.refresh?.(); } });
    obs.observe(this.root, { childList: true });
  }
  setMail(list) { this.postList = list; this.renderPost(); }
  mailSent() { this.postDraft = null; this.postTab = 'in'; this.postWrite = false; this.renderPost(); this.windows.bags?.refresh?.(); }
  attachPost(i) { if (!this.postDraft) return; this.postDraft.slot = this.postDraft.slot === i ? null : i; this.postDraft.ref = this.postDraft.slot == null ? null : JSON.stringify(this.you.bag[i]); this.renderPost(); this.windows.bags?.refresh?.(); }
  renderPost() {
    const w = this.postWin;
    if (!w?.isConnected) return;
    const list = this.postList || [], npc = this.postNpc;
    const tabs = `<div class="post-tabs"><button data-tab="in" class="${this.postTab === 'in' ? 'on' : ''}">Letters (${list.length})</button><button data-tab="out" class="${this.postTab === 'out' ? 'on' : ''}">Write a letter</button></div>`;
    let body = '';
    this.postWrite = this.postTab === 'out';
    if (this.postTab === 'in') {
      const sel = list.find((m) => m.id === this.postSel);
      if (sel) {
        const d = sel.item ? itemDef(sel.item) : null;
        body = `<div class="letter"><div class="l-head"><b>${sel.sub}</b><span>From ${sel.from} · ${new Date(sel.t).toLocaleDateString()}</span></div><div class="l-body">${(sel.body || '').replace(/\n/g, '<br>') || '<i>(no message)</i>'}</div>
          ${sel.gold || d ? `<div class="l-att">${sel.gold ? `<span class="l-gold">${fmtMoney(sel.gold)}</span>` : ''}${d ? `<span class="l-item"><img src="${icon(d.icon || 'ring', '#3a3226', 40)}" style="border-color:${QUALITY[d.q ?? 1]}"> ${gearName(d)}</span>` : ''}<button class="take">Take</button></div>` : ''}
          <div class="dbtns"><button class="back">Back</button>${sel.gold || sel.item ? '' : '<button class="del">Throw away</button>'}</div></div>`;
      } else body = list.length ? `<div class="mlist">${[...list].reverse().map((m) => `<div class="mrow ${m.read ? '' : 'new'}" data-id="${m.id}"><b>${m.sub}</b><span>${m.from}${m.gold ? ' · coin' : ''}${m.item ? ' · parcel' : ''}</span></div>`).join('')}</div>` : '<p class="qtext">No letters for you today.</p>';
    } else {
      const D = this.postDraft ||= { to: '', sub: '', body: '', g: 0, s: 0, c: 0, slot: null };
      const it = D.slot != null ? this.you.bag[D.slot] : null, d = it ? itemDef(it) : null;
      body = `<div class="compose"><label>To <input class="p-to" maxlength="14" value="${D.to}" placeholder="Character name"></label><label>Subject <input class="p-sub" maxlength="40" value="${D.sub}"></label><textarea class="p-body" maxlength="500" placeholder="Your message">${D.body}</textarea>
        <div class="p-row"><span>Coin</span><input class="p-g" type="number" min="0" value="${D.g}"><i class="m-g">g</i><input class="p-s" type="number" min="0" max="99" value="${D.s}"><i class="m-s">s</i><input class="p-c" type="number" min="0" max="99" value="${D.c}"><i class="m-c">c</i></div>
        <div class="p-row p-att">${d ? `<img src="${icon(d.icon || 'ring', '#3a3226', 36)}" style="border-color:${QUALITY[d.q ?? 1]}"> ${gearName(d)}${it.n > 1 ? ' x' + it.n : ''} <a class="p-un">remove</a>` : `<span class="hint">${IS_TOUCH ? 'Tap an item in your bags, then Attach, to put it in the letter.' : 'Right-click an item in your bags to put it in the letter.'}</span>`}</div>
        <div class="dbtns"><span class="hint">Postage ${fmtMoney(30)}</span><button class="send">Send</button></div></div>`;
    }
    $('.wb', w).innerHTML = `<h3>The Post</h3>${tabs}${body}`;
    w.querySelectorAll('.post-tabs button').forEach((b) => (b.onclick = () => { this.postTab = b.dataset.tab; this.postSel = null; this.renderPost(); this.windows.bags?.refresh?.(); if (this.postTab === 'out' && !this.windows.bags?.isConnected) this.toggle('bags'); }));
    w.querySelectorAll('.mrow').forEach((r) => (r.onclick = () => { this.postSel = r.dataset.id; this.g.send({ t: 'mailRead', id: r.dataset.id }); const m = list.find((x) => x.id === r.dataset.id); if (m) m.read = true; this.renderPost(); }));
    const q = (c) => $(c, w);
    if (q('.back')) q('.back').onclick = () => { this.postSel = null; this.renderPost(); };
    if (q('.take')) q('.take').onclick = () => this.g.send({ t: 'mailTake', id: this.postSel, npc });
    if (q('.del')) q('.del').onclick = () => { this.g.send({ t: 'mailDelete', id: this.postSel, npc }); this.postSel = null; };
    if (q('.l-item img')) { const sel = list.find((m) => m.id === this.postSel); q('.l-item img').addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip(sel.item))); q('.l-item img').addEventListener('mouseleave', () => this.hideTip()); }
    if (this.postTab === 'out') {
      const D = this.postDraft;
      const save = () => { D.to = q('.p-to').value; D.sub = q('.p-sub').value; D.body = q('.p-body').value; D.g = Math.max(0, q('.p-g').value | 0); D.s = Math.max(0, q('.p-s').value | 0); D.c = Math.max(0, q('.p-c').value | 0); };
      w.querySelectorAll('.compose input, .compose textarea').forEach((e) => { e.addEventListener('input', save); e.addEventListener('keydown', (ev) => ev.stopPropagation()); e.addEventListener('keyup', (ev) => ev.stopPropagation()); });
      if (q('.p-un')) q('.p-un').onclick = () => { D.slot = null; this.renderPost(); this.windows.bags?.refresh?.(); };
      q('.send').onclick = () => { save(); this.g.send({ t: 'mailSend', npc, to: D.to, sub: D.sub, body: D.body, gold: D.g * 10000 + D.s * 100 + D.c, slot: D.slot, ref: D.ref }); };
    }
  }
  openStore(items, w) {
    this.storeOpen = true;
    this.storeWin = w;
    this.setBank(items);
    if (!this.windows.bags?.isConnected) this.toggle('bags'); else this.windows.bags.refresh();
    const obs = new MutationObserver(() => { if (!w.isConnected) { this.storeOpen = false; obs.disconnect(); this.windows.bags?.refresh?.(); } });
    obs.observe(this.root, { childList: true });
  }
  setBank(items) {
    const w = this.storeWin;
    if (!w?.isConnected || !this.storeOpen) return;
    const cells = [];
    for (let i = 0; i < 30; i++) { const it = items[i], d = itemDef(it), gq = d ? (d.q ?? 1) : -1; cells.push(`<div class="bslot${d ? ' bq' + gq : ' empty'}" data-i="${i}"${d ? ` style="--qc:${QUALITY[gq]}"` : ''}>${d ? `<img src="${icon(d.icon || 'ring', '#3a3226', 64)}" style="border-color:${QUALITY[gq]}">${it.n > 1 ? `<span class="cnt">${it.n}</span>` : ''}${d.stats && GEAR_SLOTS.includes(d.slot) && d.ilvl ? `<span class="bil">${d.ilvl}</span>` : ''}` : ''}</div>`); }
    const had = document.activeElement?.classList.contains('store-q');
    $('.wb', w).innerHTML = `<div class="bag-head store-head${items.length >= 30 ? ' full' : ''}"><div class="bag-cap"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 14H58V22H6ZM10 26H54V58H10ZM24 34V40H40V34Z" fill="currentColor" fill-rule="evenodd"/></svg><div class="bc-tx"><div><b>Storehouse</b><span class="bc-n">${items.length} / 30 shelves</span></div><div class="bc-bar"><i style="width:${(100 * items.length / 30).toFixed(1)}%"></i></div></div></div><div class="bag-search store-search"><input class="store-q" type="text" placeholder="Search your shelves" spellcheck="false" maxlength="40"><button class="bs-x" title="Clear the search">×</button></div></div><div class="bag-grid store-grid" style="--cols:6">${cells.join('')}</div><div class="bag-hint">${IS_TOUCH ? 'Tap a shelf to take the item back · tap an item in your bags, then Deposit' : 'Click a shelf to take the item back · Right-click items in your bags to store them'}</div>`;
    w.querySelectorAll('.bslot').forEach((e) => {
      const i = Number(e.dataset.i), it = items[i];
      if (!it) return;
      e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip(it)));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.onclick = () => { this.hideTip(); this.g.send({ t: 'withdraw', slot: i }); };
    });
    {
      const inp = $('.store-q', w), apply = () => this.filterSlots(w.querySelectorAll('.store-grid .bslot'), items, this.storeFilter);
      inp.value = this.storeFilter || '';
      inp.oninput = () => { this.storeFilter = inp.value; apply(); };
      inp.onkeydown = (e) => { if (e.key === 'Escape') { inp.value = ''; this.storeFilter = ''; apply(); inp.blur(); } e.stopPropagation(); };
      $('.store-search .bs-x', w).onclick = () => { inp.value = ''; this.storeFilter = ''; apply(); };
      if (had) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      apply();
    }
  }
  openVendor(list, w, npcId) {
    this.vendorOpen = true; this.vendorWin = w;
    if (SETTINGS.autoJunk && this.you?.bag.some((x) => x.gear && (x.gear.q ?? 1) === 0)) this.g.send({ t: 'sellJunk', npc: npcId });
    const npc = NPCS.find((n) => n.id === npcId);
    const f = npc ? factionOfZone(zoneAt(npc.x, npc.z).id) : null;
    const rk = f ? repRank(this.you.rep?.[f] || 0) : 0, k = 1 - 0.05 * rk;
    let tab = 'wares';
    // a phone: one sheet with three tabs (Wares, Sell, Buyback); the bags stay shut, the Sell tab shows them instead
    const tabbed = isPhone();
    if (tabbed) w.classList.add('w-vendor-tabs');
    const render = () => {
      if (!w.isConnected) return;
      const y = this.you, bb = y.buyback || [];
      if (tabbed) return this.vendorTabs(w, list, npcId, k, rk, f, () => tab, (t) => { tab = t; render(); });
      const card = (d, price, attrs, extra = '') => { const q = d.q ?? 1, gearish = d.stats && GEAR_SLOTS.includes(d.slot); const sub = gearish ? `${typeLine(d) || SLOT_LABEL[d.slot]}${d.ilvl ? ' · ilvl ' + d.ilvl : ''}` : d.slot === 'use' ? 'Consumable' : d.slot === 'junk' ? ((d.q ?? 1) === 0 ? 'Junk' : 'Trade Goods') : ''; const lack = y.gold < price || (d.lvl && y.level < d.lvl);
        return `<div class="vcard q${q}${lack ? ' lack' : ''}" ${attrs}><div class="li-ic" style="border-color:${QUALITY[q]}"><img src="${icon(d.icon || 'ring', '#2a2620', 44)}">${extra}${isUpgrade(d, y) ? '<span class="bup" title="Upgrade"></span>' : ''}</div><div class="li-tx"><b style="color:${QUALITY[q]}">${gearName(d)}</b><em>${sub}</em><span class="vprice">${fmtMoney(price)}</span></div></div>`; };
      const tabs = `<div class="post-tabs"><button data-vt="wares" class="${tab === 'wares' ? 'on' : ''}">Wares</button><button data-vt="buyback" class="${tab === 'buyback' ? 'on' : ''}">Buyback (${bb.length})</button></div>`;
      const body = tab === 'wares'
        ? `<div class="vgrid">${list.map((id) => card(ITEMS[id], Math.max(1, Math.round(ITEMS[id].price * 10 * k)), `data-id="${id}"`)).join('')}</div>`
        : bb.length ? `<div class="vgrid">${bb.map((B, i) => card(itemDef(B.it), B.value, `data-bb="${i}"`, B.it.n > 1 ? `<span class="cnt">${B.it.n}</span>` : '')).slice().reverse().join('')}</div>` : '<p class="qtext">Nothing sold yet. Things you sell here can be bought back for what they fetched, until you leave the valley.</p>';
      $('.wb', w).innerHTML = `${tabs}${body}<div class="bag-hint">${IS_TOUCH ? 'Tap to buy · tap an item in your bags, then Sell' : 'Click to buy · Right-click items in your bags to sell'}${rk ? ` · ${REP_RANKS[rk].name} with ${FACTIONS[f].name}: ${rk * 5}% off` : ''}</div><div class="repair-row"></div>`;
      w.querySelectorAll('[data-vt]').forEach((b2) => (b2.onclick = () => { tab = b2.dataset.vt; render(); }));
      w.querySelectorAll('.vcard[data-id]').forEach((e) => {
        e.onclick = () => this.g.send({ t: 'buy', item: e.dataset.id, npc: npcId });
        e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip({ id: e.dataset.id })));
        e.addEventListener('mouseleave', () => this.hideTip());
      });
      w.querySelectorAll('.vcard[data-bb]').forEach((e) => {
        const B = bb[Number(e.dataset.bb)];
        e.onclick = () => { this.hideTip(); this.g.send({ t: 'buyback', i: Number(e.dataset.bb) }); };
        e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip(B.it)));
        e.addEventListener('mouseleave', () => this.hideTip());
      });
      const rr = $('.repair-row', w);
      let c = 0; for (const g of Object.values(y.equip)) c += repairCost(g); for (const it of y.bag) if (it.gear) c += repairCost(it.gear); c = Math.round(c * k);
      const junk = y.bag.filter((x) => x.gear && (x.gear.q ?? 1) === 0);
      rr.innerHTML = (junk.length ? `<button class="selljunk">Sell junk (${junk.length}) · ${fmtMoney(junk.reduce((a2, x) => a2 + gearValue(x.gear), 0))}</button>` : '') + (c ? `<button class="repair">Repair all gear · ${fmtMoney(c)}</button>` : '<span class="repair-ok">Your gear is in good repair.</span>');
      const rb = $('.repair', rr); if (rb) rb.onclick = () => this.g.send({ t: 'repair', npc: npcId });
      const sj = $('.selljunk', rr); if (sj) sj.onclick = () => this.g.send({ t: 'sellJunk', npc: npcId });
    };
    render(); this._repaintRepair = render;
    if (!tabbed) { if (!this.windows.bags?.isConnected) this.toggle('bags'); else this.windows.bags.refresh(); }
    const obs = new MutationObserver(() => { if (!w.isConnected) { this.vendorOpen = false; this._repaintRepair = null; w.classList.remove('w-vendor-tabs'); obs.disconnect(); this.windows.bags?.refresh?.(); } });
    obs.observe(this.root, { childList: true });
  }

  // the merchant on a phone: Wares / Sell / Buyback tabs in one sheet. Sell shows your bags as a grid: tap an item to see it
  // and the Sell bar (touch.js), tap again or press Sell to sell it. Sell junk and Repair sit in the sticky footer.
  vendorTabs(w, list, npcId, k, rk, f, getTab, setTab) {
    const y = this.you, bb = y.buyback || [], tab = getTab(), wb = $('.wb', w);
    const keep = wb.querySelector('.vt-body')?.scrollTop || 0;
    const card = (d, price, attrs, extra = '') => { const q = d.q ?? 1, gearish = d.stats && GEAR_SLOTS.includes(d.slot); const sub = gearish ? `${typeLine(d) || SLOT_LABEL[d.slot]}${d.ilvl ? ' · ilvl ' + d.ilvl : ''}` : d.slot === 'use' ? 'Consumable' : d.slot === 'junk' ? ((d.q ?? 1) === 0 ? 'Junk' : 'Trade Goods') : ''; const lack = y.gold < price || (d.lvl && y.level < d.lvl);
      return `<div class="vcard q${q}${lack ? ' lack' : ''}" ${attrs}><div class="li-ic" style="border-color:${QUALITY[q]}"><img src="${icon(d.icon || 'ring', '#2a2620', 44)}">${extra}${isUpgrade(d, y) ? '<span class="bup" title="Upgrade"></span>' : ''}</div><div class="li-tx"><b style="color:${QUALITY[q]}">${gearName(d)}</b><em>${sub}</em><span class="vprice">${fmtMoney(price)}</span></div></div>`; };
    const sellable = y.bag.map((it, i) => [it, i]).filter(([it]) => it && !(it.id && ITEMS[it.id]?.slot === 'quest'));
    const tabs = `<div class="post-tabs vt-tabs"><button data-vt="wares" class="${tab === 'wares' ? 'on' : ''}">Wares</button><button data-vt="sell" class="${tab === 'sell' ? 'on' : ''}">Sell (${sellable.length})</button><button data-vt="buyback" class="${tab === 'buyback' ? 'on' : ''}">Buyback (${bb.length})</button></div>`;
    let body;
    if (tab === 'wares') body = `<div class="vgrid">${list.map((id) => card(ITEMS[id], Math.max(1, Math.round(ITEMS[id].price * 10 * k)), `data-id="${id}"`)).join('')}</div>`;
    else if (tab === 'buyback') body = bb.length ? `<div class="vgrid">${bb.map((B, i) => card(itemDef(B.it), B.value, `data-bb="${i}"`, B.it.n > 1 ? `<span class="cnt">${B.it.n}</span>` : '')).slice().reverse().join('')}</div>` : '<p class="qtext">Nothing sold yet. Things you sell here can be bought back for what they fetched, until you leave the valley.</p>';
    else {
      // sell value: the same sum the merchant pays (shared/sim.js on_sell)
      const val = (it) => (it.gear ? gearValue(it.gear) : (ITEMS[it.id]?.price || 1) * 3 * it.n);
      body = sellable.length ? `<div class="bag-grid vt-sell">${sellable.map(([it, i]) => { const d = itemDef(it), gq = d.q ?? 1, gearish = d.stats && GEAR_SLOTS.includes(d.slot);
        return `<div class="bslot bq${gq}" data-i="${i}" style="--qc:${QUALITY[gq]}"><img src="${icon(d.icon || 'ring', '#3a3226', 64)}" style="border-color:${QUALITY[gq]}">${it.n > 1 ? `<span class="cnt">${it.n}</span>` : ''}${gearish && d.ilvl ? `<span class="bil">${d.ilvl}</span>` : ''}<span class="vt-price">${fmtMoney(val(it))}</span></div>`; }).join('')}</div>` : '<p class="qtext">Your bags hold nothing a merchant will buy.</p>';
    }
    let c = 0; for (const g of Object.values(y.equip)) c += repairCost(g); for (const it of y.bag) if (it.gear) c += repairCost(it.gear); c = Math.round(c * k);
    const junk = y.bag.filter((x) => x.gear && (x.gear.q ?? 1) === 0);
    const foot = `<div class="vt-foot"><span class="vt-gold"><span class="bg-coin"></span>${fmtMoney(y.gold)}</span>${junk.length ? `<button class="selljunk">Sell junk (${junk.length}) · ${fmtMoney(junk.reduce((a2, x) => a2 + gearValue(x.gear), 0))}</button>` : ''}${c ? `<button class="repair">Repair all · ${fmtMoney(c)}</button>` : '<span class="repair-ok">Gear in good repair</span>'}</div>`;
    const hint = `<div class="bag-hint vt-hint">${tab === 'sell' ? 'Tap an item to see it, then Sell' : tab === 'wares' ? 'Tap to buy' : 'Tap to buy back'}${rk ? ` · ${REP_RANKS[rk].name} with ${FACTIONS[f].name}: ${rk * 5}% off` : ''}</div>`;
    wb.innerHTML = `${tabs}<div class="vt-body">${hint}${body}</div>${foot}`;
    wb.querySelector('.vt-body').scrollTop = keep;
    w.querySelectorAll('[data-vt]').forEach((b2) => (b2.onclick = () => { if (b2.dataset.vt !== tab) { setTab(b2.dataset.vt); wb.querySelector('.vt-body').scrollTop = 0; } }));
    w.querySelectorAll('.vcard[data-id]').forEach((e) => {
      e.onclick = () => this.g.send({ t: 'buy', item: e.dataset.id, npc: npcId });
      e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip({ id: e.dataset.id })));
      e.addEventListener('mouseleave', () => this.hideTip());
    });
    w.querySelectorAll('.vcard[data-bb]').forEach((e) => {
      const B = bb[Number(e.dataset.bb)];
      e.onclick = () => { this.hideTip(); this.g.send({ t: 'buyback', i: Number(e.dataset.bb) }); };
      e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip(B.it)));
      e.addEventListener('mouseleave', () => this.hideTip());
    });
    w.querySelectorAll('.vt-sell .bslot').forEach((e) => {
      const i = Number(e.dataset.i), it = y.bag[i];
      e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip(it)));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('contextmenu', (ev) => { ev.preventDefault(); this.hideTip(); this.g.send({ t: 'sell', slot: i }); }); // the Sell bar (touch.js) sends this
    });
    const rb = $('.repair', wb); if (rb) rb.onclick = () => this.g.send({ t: 'repair', npc: npcId });
    const sj = $('.selljunk', wb); if (sj) sj.onclick = () => this.g.send({ t: 'sellJunk', npc: npcId });
  }


  openLoot(l) {
    // the pickup window keeps its own slot: windows.loot is the Loot History window (logLoot refreshes it)
    if (l.closed || (!l.gold && !l.items.length)) { this.windows.pickup?.remove(); return; }
    let w = this.windows.pickup;
    if (!w?.isConnected) { w = this.makeWindow('Loot', 'w-loot', innerWidth / 2 + 90, innerHeight / 2 - 160); this.windows.pickup = w; }
    const rows = [];
    if (l.gold) rows.push(`<div class="litem coin" data-gold="1"><div class="li-ic coin-ic"></div><div class="li-tx"><b>${fmtMoney(l.gold)}</b><em>Coin</em></div></div>`);
    l.items.forEach((it, i) => {
      const d = itemDef(it), q = d.q ?? 1;
      const sub = d.stats && GEAR_SLOTS.includes(d.slot) ? [typeLine(d) || SLOT_LABEL[d.slot], SLOT_LABEL[d.slot] !== typeLine(d) && typeLine(d) ? SLOT_LABEL[d.slot] : '', d.ilvl ? 'ilvl ' + d.ilvl : ''].filter(Boolean).join(' · ') : d.slot === 'quest' ? 'Quest Item' : d.slot === 'use' ? 'Consumable' : (d.q ?? 1) === 0 ? 'Junk' : 'Trade Goods';
      rows.push(`<div class="litem q${q}" data-i="${i}"><div class="li-ic" style="border-color:${QUALITY[q]}"><img src="${icon(d.icon || 'ring', '#2a2620', 44)}">${it.n > 1 ? `<span class="cnt">${it.n}</span>` : ''}${isUpgrade(d, this.you) ? '<span class="bup" title="Upgrade"></span>' : ''}</div><div class="li-tx"><b style="color:${QUALITY[q]}">${gearName(d)}</b><em>${sub}</em></div></div>`);
    });
    $('.wb', w).innerHTML = `<div class="loot-list">${rows.join('')}</div><button class="takeall">Take All</button>`;
    w.querySelectorAll('.litem').forEach((e) => {
      e.onclick = () => this.g.send(e.dataset.gold ? { t: 'take', id: l.id, gold: 1 } : { t: 'take', id: l.id, slot: Number(e.dataset.i) });
      if (!e.dataset.gold) { const it = l.items[Number(e.dataset.i)]; e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip(it))); e.addEventListener('mouseleave', () => this.hideTip()); }
    });
    $('.takeall', w).onclick = () => { this.g.send({ t: 'take', id: l.id, all: 1 }); this.hideTip(); };
    // coin goes straight into the purse, like WoW's auto-loot for money
    if (l.gold && !l.items.length) this.g.send({ t: 'take', id: l.id, gold: 1 });
    this.g.sfx?.play('loot');
  }

  // ======================================================== minimap
  buildMinimapBase() {
    this.mapBase = this.paintBase(this.g.world.terrain);
    this.areaBase = {};
    const RT = this.g.world.reachTerrain, IT = this.g.world.rimeTerrain, HT = this.g.world.heightsTerrain, TT = this.g.world.tidewaterTerrain, GT = this.g.world.rainwardTerrain, WT = this.g.world.wealdTerrain;
    if (RT) this.reachBase = this.areaBase.reach = this.paintBase(RT, 'reach');
    if (IT) this.areaBase.rime = this.paintBase(IT, 'rime');
    if (HT) this.areaBase.heights = this.paintBase(HT, 'heights');
    if (TT) this.areaBase.tidewater = this.paintBase(TT, 'tidewater');
    if (GT) this.areaBase.rainward = this.paintBase(GT, 'rainward');
    if (WT) this.areaBase.weald = this.paintBase(WT, 'weald');
  }
  // one pixel per terrain cell, painted from the splat maps with hill shading; the island in black sand, ash, basalt and soot
  paintBase(T, isle = false) {
    const NX = T.nx, NZ = T.nz;
    const c = document.createElement('canvas');
    c.width = NX; c.height = NZ;
    const x = c.getContext('2d');
    const img = x.createImageData(NX, NZ);
    const A = T.splatDataA, B = T.splatDataB;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const k = (j * NX + i) * 4;
      const wx = T.minX + (i + 0.5) * T.cell, wz = T.minZ + (j + 0.5) * T.cell;
      const h = T.height(wx, wz);
      const sand = A[k] / 255, path = A[k + 1] / 255, rock = A[k + 2] / 255, lush = A[k + 3] / 255, forest = B[k] / 255;
      let r = 112, g = 140, b = 60;
      if (isle === 'heights') {
        // wind-packed snow, bare grey rock, glazed ice, trodden tracks, the stone pads; the cloud below the cliffs
        const cob = B[k + 1] / 255;
        r = 232; g = 238; b = 244;
        r += (104 - r) * rock; g += (108 - g) * rock; b += (116 - b) * rock;
        r += (186 - r) * path; g += (182 - g) * path; b += (176 - b) * path;
        r += (146 - r) * cob; g += (148 - g) * cob; b += (152 - b) * cob;
        r += (170 - r) * lush; g += (206 - g) * lush; b += (230 - b) * lush;
        if (h < HEIGHTS.cloud + 6) { const n = Math.sin(wx * 0.07 + wz * 0.03) * Math.sin(wz * 0.05 - wx * 0.02); r = 220 + n * 10; g = 228 + n * 9; b = 238 + n * 7; }
        const sh = (T.height(wx - 2, wz - 2) - T.height(wx + 2, wz + 2)) * 0.05, k2 = 1 + Math.max(-0.35, Math.min(0.35, sh));
        img.data[k] = r * k2; img.data[k + 1] = g * k2; img.data[k + 2] = b * k2; img.data[k + 3] = 255;
        continue;
      }
      if (isle === 'weald') {
        // copper leaf litter, gold litter under the standards and the coppice, moss in the hollows, the rides' trodden earth,
        // pale sawdust, the Makers' stone, the grey banks
        const cob = B[k + 1] / 255;
        r = 150; g = 92; b = 50;
        r += (170 - r) * forest; g += (122 - g) * forest; b += (52 - b) * forest;
        r += (90 - r) * lush; g += (104 - g) * lush; b += (58 - b) * lush;
        r += (120 - r) * rock; g += (116 - g) * rock; b += (108 - b) * rock;
        r += (126 - r) * path; g += (98 - g) * path; b += (72 - b) * path;
        r += (214 - r) * sand; g += (196 - g) * sand; b += (156 - b) * sand;
        r += (156 - r) * cob; g += (154 - g) * cob; b += (146 - b) * cob;
        const sh = (T.height(wx - 2, wz - 2) - T.height(wx + 2, wz + 2)) * 0.05, k2 = 1 + Math.max(-0.35, Math.min(0.35, sh));
        img.data[k] = r * k2; img.data[k + 1] = g * k2; img.data[k + 2] = b * k2; img.data[k + 3] = 255;
        continue;
      }
      if (isle === 'rainward') {
        // deep wet green, moss, the timber's needles, dark wet rock, river gravel, the road and the beds' dark earth, the Makers'
        // stone, red-brown mud (the splat's snow channel); the river and its pool
        const cob = B[k + 1] / 255, mud = B[k + 3] / 255;
        r = 76; g = 116; b = 60;
        r += (64 - r) * lush; g += (100 - g) * lush; b += (50 - b) * lush;
        r += (46 - r) * forest; g += (66 - g) * forest; b += (40 - b) * forest;
        r += (84 - r) * rock; g += (88 - g) * rock; b += (84 - b) * rock;
        r += (130 - r) * sand; g += (130 - g) * sand; b += (124 - b) * sand;
        r += (112 - r) * path; g += (88 - g) * path; b += (64 - b) * path;
        r += (150 - r) * cob; g += (150 - g) * cob; b += (142 - b) * cob;
        r += (132 - r) * mud; g += (72 - g) * mud; b += (44 - b) * mud;
        if (waterKind(wx, wz) === 'stream') { r = 70; g = 110; b = 104; }
        const sh = (T.height(wx - 2, wz - 2) - T.height(wx + 2, wz + 2)) * 0.05, k2 = 1 + Math.max(-0.35, Math.min(0.35, sh));
        img.data[k] = r * k2; img.data[k + 1] = g * k2; img.data[k + 2] = b * k2; img.data[k + 3] = 255;
        continue;
      }
      if (isle === 'tidewater') {
        // salt-burnt grass, grey shingle, wet mud (the splat's snow channel), the rows' dark green, tracks, paving, tar-black
        // ground, the log ponds; the Sound and the sea at mean tide (the flats show as mud)
        const cob = B[k + 1] / 255, tar = B[k + 2] / 255, mud = B[k + 3] / 255;
        r = 168; g = 160; b = 112;
        r += (128 - r) * sand; g += (128 - g) * sand; b += (124 - b) * sand;
        r += (96 - r) * rock; g += (94 - g) * rock; b += (90 - b) * rock;
        r += (52 - r) * lush; g += (82 - g) * lush; b += (50 - b) * lush;
        r += (176 - r) * path; g += (160 - g) * path; b += (128 - b) * path;
        r += (160 - r) * cob; g += (158 - g) * cob; b += (150 - b) * cob;
        r += (50 - r) * tar; g += (46 - g) * tar; b += (42 - b) * tar;
        r += (80 - r) * mud; g += (72 - g) * mud; b += (60 - b) * mud;
        if (waterKind(wx, wz) === 'stream') { r = 64; g = 92; b = 80; }
        if (h < -0.4) { const dp = Math.min(1, -h / 6); r = 66 - dp * 22; g = 100 - dp * 34; b = 104 - dp * 26; }
        const sh = (T.height(wx - 2, wz - 2) - T.height(wx + 2, wz + 2)) * 0.05, k2 = 1 + Math.max(-0.35, Math.min(0.35, sh));
        img.data[k] = r * k2; img.data[k + 1] = g * k2; img.data[k + 2] = b * k2; img.data[k + 3] = 255;
        continue;
      }
      if (isle === 'rime') {
        // snow, grey shingle, dark rock, blue ice, trodden tracks, stone paving, running meltwater, the cold sea
        const cob = B[k + 1] / 255;
        r = 226; g = 232; b = 238;
        r += (130 - r) * sand; g += (132 - g) * sand; b += (136 - b) * sand;
        r += (92 - r) * rock; g += (98 - g) * rock; b += (108 - b) * rock;
        r += (190 - r) * path; g += (184 - g) * path; b += (176 - b) * path;
        r += (150 - r) * cob; g += (154 - g) * cob; b += (160 - b) * cob;
        r += (150 - r) * lush; g += (196 - g) * lush; b += (226 - b) * lush;
        if (waterKind(wx, wz) === 'stream') { r = 70; g = 150; b = 190; }
        if (h < 0.05) { const dp = Math.min(1, -h / 6); r = 62 - dp * 22; g = 112 - dp * 36; b = 132 - dp * 28; }
        const sh = (T.height(wx - 2, wz - 2) - T.height(wx + 2, wz + 2)) * 0.05, k2 = 1 + Math.max(-0.35, Math.min(0.35, sh));
        img.data[k] = r * k2; img.data[k + 1] = g * k2; img.data[k + 2] = b * k2; img.data[k + 3] = 255;
        continue;
      }
      if (isle) {
        // ash ground, black sand, basalt, soot, tracks, the camp's paving, and the glowing seams
        const cob = B[k + 1] / 255, soot = B[k + 2] / 255;
        r = 118; g = 112; b = 104;
        r += (52 - r) * sand; g += (50 - g) * sand; b += (50 - b) * sand;
        r += (66 - r) * rock; g += (60 - g) * rock; b += (58 - b) * rock;
        r += (44 - r) * soot; g += (40 - g) * soot; b += (38 - b) * soot;
        r += (150 - r) * path; g += (134 - g) * path; b += (110 - b) * path;
        r += (176 - r) * cob; g += (170 - g) * cob; b += (160 - b) * cob;
        r += (240 - r) * lush; g += (110 - g) * lush; b += (40 - b) * lush;
        if (h < 0.05) { const dp = Math.min(1, -h / 6); r = 58 - dp * 22; g = 120 - dp * 40; b = 140 - dp * 30; }
        const sh = (T.height(wx - 2, wz - 2) - T.height(wx + 2, wz + 2)) * 0.06, k2 = 1 + Math.max(-0.4, Math.min(0.4, sh));
        img.data[k] = r * k2; img.data[k + 1] = g * k2; img.data[k + 2] = b * k2; img.data[k + 3] = 255;
        continue;
      }
      r += (70 - r) * forest; g += (100 - g) * forest; b += (44 - b) * forest;
      r += (80 - r) * lush; g += (150 - g) * lush; b += (70 - b) * lush;
      r += (222 - r) * sand; g += (192 - g) * sand; b += (140 - b) * sand;
      r += (160 - r) * path; g += (130 - g) * path; b += (90 - b) * path;
      const m = Math.max(rock, Math.min(1, Math.max(0, (h - 12) / 30)));
      r += (130 - r) * m; g += (124 - g) * m; b += (116 - b) * m;
      const sn = B[k + 3] / 255; // snow beyond the Brasswork Pass
      r += (228 - r) * sn; g += (234 - g) * sn; b += (242 - b) * sn;
      if (h < 0.05) { r = 60; g = 140; b = 170; }
      // hill shading
      const sh = (T.height(wx - 2, wz - 2) - T.height(wx + 2, wz + 2)) * 0.05;
      const k2 = 1 + Math.max(-0.35, Math.min(0.35, sh));
      img.data[k] = r * k2; img.data[k + 1] = g * k2; img.data[k + 2] = b * k2; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  // where each active quest wants you to go: [{ qid, x, z, r, done }], nearest area per quest; a target inside a dungeon
  // you are not in points at that dungeon's door instead
  questTargets() {
    const now = performance.now();
    if (this._qt && now - this._qtT < 800) return this._qt;
    const you = this.you, p = this.g.playerPos(), here = dungeonAt(p.x, p.z);
    // across the sea: a target on the island while you are in the valley (or underground) points at Haroun's gangway, and a
    // valley or dungeon target while you are on the island points at the island pier
    // (three areas joined only by ship: from any area, a target in another points at your own pier, where the harbour master
    // sails on; underground, the way out comes first. A target inside a dungeon counts as the area its door is in.)
    const hereA = here ? 'dungeon' : areaOf(p.x, p.z);
    const sea = (x, z) => {
      if (here) return null;
      const D = x >= 700 ? dungeonAt(x, z) : null, tA = D ? areaOf(D.door.x, D.door.z) : x >= 700 ? 'valley' : areaOf(x, z);
      if (tA !== hereA && LIFT_FROM[hereA]?.[tA]) return [LIFT_FROM[hereA][tA][0], LIFT_FROM[hereA][tA][1], 3, true];
      if (tA !== hereA && SAIL_FROM[hereA]) return [SAIL_FROM[hereA][0], SAIL_FROM[hereA][1], 3, true];
      return null;
    };
    const out = [];
    const spawnPt = (s) => s.path ? [s.path[Math.floor(s.path.length / 2)][0], s.path[Math.floor(s.path.length / 2)][1], 12] : [s.x, s.z, Math.max(5, s.r)];
    for (const [qid, st] of Object.entries(you.quests || {})) {
      const Q = QUESTS[qid];
      if (!Q) continue;
      const g = Q.goal;
      const have = g.item || g.gather ? (you.bag || []).filter((b) => b.id === (g.item || g.gather)).reduce((a, b) => a + b.n, 0) : st.n;
      const done = have >= (g.reach ? 1 : g.n);
      let pts = [];
      if (done) { const n = NPCS.find((x) => x.id === Q.turnin); if (n) pts = [[n.x, n.z, 4]]; }
      else if (g.kill) pts = SPAWNS.filter((s) => s.mob === g.kill).map(spawnPt);
      else if (g.item) pts = SPAWNS.filter((s) => LOOT_TABLES[MOBS[s.mob].loot]?.items.some(([i]) => i === g.item)).map(spawnPt);
      else if (g.gather) { const ns = NODES.filter((n) => n.item === g.gather); if (ns.length) pts = [[ns.reduce((a, n) => a + n.x, 0) / ns.length, ns.reduce((a, n) => a + n.z, 0) / ns.length, 24]]; }
      else if (g.use) pts = OBJECTS.filter((o) => o.kind === g.use && !(st.used || []).includes(o.id)).map((o) => [o.x, o.z, 2.5]);
      else if (g.reach) { const z = ZONES.find((zz) => zz.id === g.reach), D = DUNGEONS.find((dd) => dd.id === g.reach); if (z) pts = [[z.x, z.z, Math.max(10, (z.r || 30) * 0.5)]]; else if (D) pts = [[D.door.x, D.door.z, 6]]; else if (areaCenter(g.reach)) pts = [areaCenter(g.reach)]; }
      pts = pts.map(([x, z, r]) => {
        const S2 = sea(x, z); if (S2) return S2;
        const D = dungeonAt(x, z);
        if (D && D !== here) { const fx = Math.sin(D.door.ry), fz = Math.cos(D.door.ry); return [D.door.x + fx * 2, D.door.z + fz * 2, 3, true]; }
        if (!D && here) return [here.exitW[0], here.exitW[1], 3, true];
        return [x, z, r, false];
      });
      let best = null, bd = 1e18;
      for (const pt of pts) { const d = (pt[0] - p.x) ** 2 + (pt[1] - p.z) ** 2; if (d < bd) { bd = d; best = pt; } }
      if (best) out.push({ qid, x: best[0], z: best[1], r: best[2], door: best[3], done, msq: !!Q.msq });
    }
    const S = this.storyNow();
    if (S && S.state === 'offer' && !this.untracked.has('msq')) {
      const n = NPCS.find((x) => x.id === S.Q.giver);
      const S2 = n && sea(n.x, n.z);
      if (S2) out.push({ qid: S.at.qid, x: S2[0], z: S2[1], r: 3, door: true, done: false, msq: true, offer: true });
      else if (n) {
        const D = dungeonAt(n.x, n.z);
        out.push(!D && here ? { qid: S.at.qid, x: here.exitW[0], z: here.exitW[1], r: 3, door: true, done: false, msq: true, offer: true } : { qid: S.at.qid, x: n.x, z: n.z, r: 4, done: false, msq: true, offer: true });
      }
    }
    this._qt = out; this._qtT = now;
    return out;
  }

  dungeonBase(D) {
    this._dBase = this._dBase || new Map();
    if (this._dBase.has(D.id)) return this._dBase.get(D.id);
    const k = 4, c = document.createElement('canvas');
    c.width = D.nx * k; c.height = D.nz * k;
    const x = c.getContext('2d');
    x.fillStyle = '#16120e'; x.fillRect(0, 0, c.width, c.height);
    const floorCol = { mine: '#6a5a46', warren: '#6a5636', vault: '#a8946e', foundry: '#5e5650', storm: '#4e5a6a', ore: '#5a504a', furnace: '#4e4846', sluice: '#56606a', dam: '#5c666e', pump: '#5a6064', mills: '#585a56', seagate: '#565a58', cutting: '#5e5246', workshop: '#7a6a56' }[D.theme] || '#5e5650';
    for (let j = 0; j < D.nz; j++) for (let i = 0; i < D.nx; i++) if (cellFloor(D, i, j)) { x.fillStyle = floorCol; x.fillRect(i * k, j * k, k, k); }
    x.strokeStyle = 'rgba(255,220,160,0.25)'; x.lineWidth = 1;
    for (let j = 0; j < D.nz; j++) for (let i = 0; i < D.nx; i++) if (cellFloor(D, i, j)) {
      if (!cellFloor(D, i, j - 1)) { x.beginPath(); x.moveTo(i * k, j * k); x.lineTo(i * k + k, j * k); x.stroke(); }
      if (!cellFloor(D, i - 1, j)) { x.beginPath(); x.moveTo(i * k, j * k); x.lineTo(i * k, j * k + k); x.stroke(); }
    }
    this._dBase.set(D.id, c);
    return c;
  }

  ping(x, z, color = '#ffffff') { (this.pings ||= []).push({ x, z, color, t0: performance.now() }); }
  miniZoom(dir) {
    const i = MINI_ZOOMS.indexOf(SETTINGS.miniZoom || 70), j = Math.max(0, Math.min(MINI_ZOOMS.length - 1, (i < 0 ? 1 : i) - dir));
    SETTINGS.miniZoom = MINI_ZOOMS[j]; saveSettings();
  }
  // map pins, kept per character in this app profile
  get pins() { if (!this._pins || this._pinsFor !== this.you?.name) { this._pinsFor = this.you?.name; try { this._pins = JSON.parse(localStorage.getItem('sunmere:pins:' + this._pinsFor) || '[]'); } catch { this._pins = []; } } return this._pins; }
  savePins() { try { localStorage.setItem('sunmere:pins:' + this._pinsFor, JSON.stringify(this._pins)); } catch { /* not stored */ } }
  drawMinimap() {
    const x = this.mini, S = 200;
    const p = this.g.playerPos();
    const aHere = areaOf(p.x, p.z), isle = !!(AMAP[aHere] && this.areaBase?.[aHere]);
    const M = isle ? AMAP[aHere] : MAP, mb = isle ? this.areaBase[aHere] : this.mapBase;
    const scale = mb.width / M.w; // px per metre on the base map
    const range = SETTINGS.miniZoom || 70; // metres radius shown
    x.save();
    x.clearRect(0, 0, S, S);
    x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); x.clip();
    const yaw = this.g.camYaw();
    x.translate(S / 2, S / 2);
    x.rotate(yaw);
    const k = (S / 2) / range;
    const D = dungeonAt(p.x, p.z);
    if (D) {
      // dungeon plan: floor cells on dark rock
      const base = this.dungeonBase(D), ds = base.width / D.w;
      x.fillStyle = '#16120e'; x.fillRect(-S / 2, -S / 2, S, S);
      x.drawImage(base, (p.x - D.ox - range) * ds, (p.z - D.oz - range) * ds, range * 2 * ds, range * 2 * ds, -S / 2, -S / 2, S, S);
    } else {
      const bx = (p.x - M.x0) * scale, bz = (p.z - M.z0) * scale;
      if (isle) { x.fillStyle = AMAP_LOOK[aHere].sea; x.fillRect(-S / 2, -S / 2, S, S); }
      x.drawImage(mb, bx - range * scale, bz - range * scale, range * 2 * scale, range * 2 * scale, -S / 2, -S / 2, S, S);
      if (!isle) for (const dd of DUNGEONS) { const dx = (dd.door.x - p.x) * ((S / 2) / range), dz = (dd.door.z - p.z) * ((S / 2) / range); if (dx * dx + dz * dz < (S / 2 - 6) ** 2) { x.fillStyle = '#2a1a10'; x.beginPath(); x.arc(dx, dz, 6, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#f0b040'; x.lineWidth = 2; x.stroke(); } }
    }
    const dot = (wx, wz, color, r = 3) => { const dx = (wx - p.x) * k, dz = (wz - p.z) * k; if (dx * dx + dz * dz > (S / 2) ** 2) return; x.fillStyle = color; x.beginPath(); x.arc(dx, dz, r, 0, Math.PI * 2); x.fill(); };
    for (const v of this.g.entities.views.values()) {
      if (v.id === this.g.localId) continue;
      if (v.ty === 'm') { if (!v.dead) dot(v.pos.x, v.pos.z, v.def.rare ? '#e0e8ff' : v.def.elite ? '#ff9a30' : '#e04030', v.def.elite ? 4 : 2.5); }
      else if (v.ty === 'p') dot(v.pos.x, v.pos.z, this.partyIds?.has(v.id) ? '#7aff7a' : '#5aa0ff', 3);
      else if (v.ty === 'n') {
        if (!v.markerKind) { dot(v.pos.x, v.pos.z, '#e8e0c0', 2.5); continue; }
        // quest givers: a gold ! (new quest) or ? (ready to hand in), grey ? while you are still working on it
        const dx = (v.pos.x - p.x) * k, dz = (v.pos.z - p.z) * k;
        if (dx * dx + dz * dz > (S / 2 - 6) ** 2) continue;
        x.save(); x.translate(dx, dz); x.rotate(-yaw);
        if (v.markerKind.startsWith('msq')) {
          // the Main Story: a small crimson crest
          const dim = v.markerKind === 'msq-active';
          x.beginPath(); x.moveTo(-6, -7); x.lineTo(6, -7); x.lineTo(6, -1); x.quadraticCurveTo(5.6, 5, 0, 8); x.quadraticCurveTo(-5.6, 5, -6, -1); x.closePath();
          x.fillStyle = dim ? '#6a665e' : '#b02e12'; x.fill(); x.lineWidth = 1.6; x.strokeStyle = dim ? '#c8c0b0' : '#f2c450'; x.stroke();
          x.font = 'bold 10px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffe9a0'; x.fillText(v.markerKind === 'msq-offer' ? '!' : '?', 0, 0);
          x.restore(); continue;
        }
        x.font = 'bold 15px Cinzel, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.lineWidth = 3; x.strokeStyle = '#2a1a06'; const ch = v.markerKind === 'offer' ? '!' : '?';
        x.strokeText(ch, 0, 0); x.fillStyle = v.markerKind === 'active' ? '#b8b8b8' : '#ffd040'; x.fillText(ch, 0, 0);
        x.restore();
      }
    }
    for (const n of this.g.nodesList()) if (n.ready) dot(n.x, n.z, '#b8ff7a', 2.5);
    // pings: expanding rings for a few seconds (a rare spotted nearby)
    const nowP = performance.now();
    this.pings = (this.pings || []).filter((q) => nowP - q.t0 < 6000);
    for (const q of this.pings) {
      const dx = (q.x - p.x) * k, dz = (q.z - p.z) * k, age = ((nowP - q.t0) / 1000) % 1.5 / 1.5;
      if (dx * dx + dz * dz > (S / 2 - 4) ** 2) continue;
      x.strokeStyle = q.color; x.globalAlpha = 1 - age; x.lineWidth = 2;
      x.beginPath(); x.arc(dx, dz, 4 + age * 22, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
    }
    for (const pin of isle ? [] : this.pins) {
      const dx = (pin.x - p.x) * k, dz = (pin.z - p.z) * k, dd = Math.hypot(dx, dz), R = S / 2 - 9;
      x.fillStyle = '#5ae0ff'; x.strokeStyle = '#06222a'; x.lineWidth = 1.5;
      if (dd + 2 < R) { x.beginPath(); x.arc(dx, dz, 4.5, 0, Math.PI * 2); x.fill(); x.stroke(); }
      else { const a = Math.atan2(dz, dx); x.save(); x.translate(Math.cos(a) * R, Math.sin(a) * R); x.rotate(a); x.beginPath(); x.moveTo(7, 0); x.lineTo(-4, -5); x.lineTo(-4, 5); x.closePath(); x.fill(); x.stroke(); x.restore(); }
    }
    // quest areas: a gold ring when in range, a gold arrow on the rim when not
    for (const t of this.questTargets()) {
      const dx = (t.x - p.x) * k, dz = (t.z - p.z) * k, dd = Math.hypot(dx, dz), R = S / 2 - 9;
      const col = t.msq ? (t.done ? '#ffb070' : '#ff6a3a') : t.done ? '#ffe060' : '#f0b020';
      if (dd + 2 < R) {
        x.fillStyle = t.msq ? 'rgba(226,85,42,0.2)' : t.done ? 'rgba(255,224,96,0.18)' : 'rgba(240,176,32,0.16)'; x.strokeStyle = col; x.lineWidth = 1.5;
        x.beginPath(); x.arc(dx, dz, Math.max(4, t.r * k), 0, Math.PI * 2); x.fill(); x.setLineDash([3, 3]); x.stroke(); x.setLineDash([]);
        if ((t.done || t.r < 4) && !t.offer) { x.fillStyle = col; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.fillText(t.done ? '?' : '!', dx, dz + 4); }
      } else {
        const a = Math.atan2(dz, dx);
        x.save(); x.translate(Math.cos(a) * R, Math.sin(a) * R); x.rotate(a);
        x.fillStyle = col; x.strokeStyle = '#2a1a06'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(8, 0); x.lineTo(-5, -6); x.lineTo(-2, 0); x.lineTo(-5, 6); x.closePath(); x.fill(); x.stroke();
        x.restore();
      }
    }
    x.restore();
    // player arrow (always up = facing relative to camera)
    x.save(); x.translate(S / 2, S / 2); x.rotate(-(this.g.playerYaw() - yaw) + Math.PI);
    x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, -7); x.lineTo(5, 6); x.lineTo(0, 3); x.lineTo(-5, 6); x.closePath(); x.fill(); x.stroke(); x.restore();
    // north marker
    x.save(); x.translate(S / 2, S / 2); x.rotate(yaw); x.fillStyle = '#ffe8a0'; x.font = 'bold 13px Cinzel, serif'; x.textAlign = 'center'; x.fillText('N', 0, -S / 2 + 16); x.restore();
    let z = zoneAt(p.x, p.z);
    // the village's flat circle is wide (96 m): out east past its fences the header reads the open meadow (display only)
    if (z.id === 'village' && p.x > 30 && p.z > -40 && Math.hypot(p.x, p.z + 4) > 62) z = { id: 'meadows', name: 'Sunmere Meadows', level: '1-3' };
    $('.zone-name', this.root).textContent = z.name;
    $('.coords', this.root).textContent = `${Math.round(p.x)}, ${Math.round(p.z)}`;
    if (this.lastZone !== z.id) { if (this.lastZone && performance.now() > (this.cardUntil || 0)) this.zoneBanner(z.name, z.level ? `Level ${z.level}` : ''); this.lastZone = z.id; }
  }

  // ======================================================== per frame
  update(dt, camera) {
    if (!this.you) return;
    const g = this.g;
    // target frame
    const tf = $('.target-frame', this.root);
    const tv = g.target ? g.entities.get(g.target) : null;
    if (tv) {
      tf.classList.remove('hidden');
      this.renderTargetExtras(tf, tv);
      const d = tv.data;
      const name = tv.ty === 'm' ? MOBS[d.k].name : tv.ty === 'n' ? tv.name : shownName(d.n, d.b);
      const hostile = tv.ty === 'm';
      $('.nm', tf).textContent = name;
      $('.nm', tf).style.color = hostile ? '#ff6a50' : tv.ty === 'n' ? '#ffe070' : '#8ac0ff';
      $('.lvl', tf).textContent = tv.ty === 'n' ? '' : d.l;
      const hp = tv.ty === 'n' ? 1 : d.h ?? 1;
      $('.bar.hp i', tf).style.width = (hp * 100).toFixed(1) + '%';
      $('.bar.hp span', tf).textContent = tv.ty === 'm' ? `${d.hp} / ${d.mh}` : tv.ty === 'p' ? Math.round(hp * 100) + '%' : '';
      $('.sub', tf).textContent = tv.ty === 'm' ? (tv.def.dummy ? 'Practice target' : tv.def.boss ? 'Boss' : tv.def.rare ? 'Rare Elite' : tv.def.elite ? 'Elite' : 'Machine') : tv.ty === 'n' ? (tv.npc?.title || '') : CLASSES[d.c]?.name || '';
      tf.classList.toggle('elite', !!tv.def?.elite);
      const img = $('img', tf);
      const ik = tv.ty === 'm' ? (tv.def.dummy ? 'shield' : tv.def.humanoid ? 'dagger' : 'gear') : tv.ty === 'n' || !CLASSES[d.c] ? 'person' : kitOf(d.c)[0].icon;
      const ic = tv.ty === 'm' ? '#6a2a20' : tv.ty === 'n' || !CLASSES[d.c] ? '#5a4a1a' : CLASSES[d.c].color;
      // friendly townsfolk: their class portrait when they dress as one, else a sign of their trade
      const nl = tv.ty === 'n' ? tv.npc?.look : null;
      const npcSrc = tv.ty === 'n' ? (nl && CLASSES[nl] ? classArt(nl) : miscArt(tv.npc?.vendor ? 'npc_vendor' : tv.npc?.quests?.length ? 'npc_quest' : 'npc') || icon(tv.npc?.vendor ? 'satchel' : tv.npc?.quests?.length ? 'notice' : 'shield', '#2c4a26', 64)) : null;
      const fbArt = tv.ty === 'm' ? (tv.def.dummy ? null : miscArt(tv.def.humanoid ? 'mob_humanoid' : 'mob_machine')) : tv.ty === 'p' ? miscArt('player') : null;
      const src = npcSrc || (tv.ty === 'p' && CLASSES[d.c] ? classArt(d.c) : tv.ty === 'm' && PORTRAITS.has(d.k) ? `/sunmere-play/ui/portraits/${d.k}.webp` : fbArt || icon(ik, ic, 64));
      tf.classList.toggle('friendly', tv.ty !== 'm');
      if (tv.ty === 'n') $('.bar.hp span', tf).textContent = 'Friendly';
      if (img.dataset.k !== src.slice(-40)) { img.src = src; img.dataset.k = src.slice(-40); }
      if (tv.ty === 'p' && d.ti && d.ti[0] === '<') $('.sub', tf).textContent = d.ti.slice(1, -1) + (CLASSES[d.c] ? ' · ' + CLASSES[d.c].name : '');
      if (tv.ty === 'p' && this.you?.duel?.with === tv.id) $('.sub', tf).textContent = 'Duel opponent · ' + (CLASSES[d.c]?.name || '');
      tf.classList.toggle('duel-foe', tv.ty === 'p' && this.you?.duel?.with === tv.id);
    } else tf.classList.add('hidden');
    this.updateTargetActions(tv);
    // action bar state
    const now = g.serverTime();
    const res = this.you.res;
    for (const sl of this.slots) {
      const s = sl.s;
      const locked = s.lvl > this.you.level;
      sl.lock.style.display = locked ? 'flex' : 'none';
      const cdEnd = Math.max(this.you.cds?.[s.id] || 0, s.gcd ? this.you.gcd || 0 : 0);
      const cdLen = (this.you.cds?.[s.id] || 0) > now ? s.cd : 1;
      const left = cdEnd - now;
      if (left > 0 && !locked) {
        const k = Math.min(1, left / cdLen);
        sl.cd.style.background = `conic-gradient(rgba(0,0,0,0.72) ${k * 360}deg, transparent 0)`;
        sl.cdt.textContent = left > 1.5 ? Math.ceil(left) : '';
      } else { sl.cd.style.background = 'none'; sl.cdt.textContent = ''; }
      sl.el.classList.toggle('nores', !locked && res < skillCost(s, this.tmods));
      sl.el.classList.toggle('pressed', g.pressedSkill === s.id);
    }
    this.updatePotionSlot(now);
    this.combat?.update(now);
    // bar rows whose skills are all still locked stay out of the way until the first one unlocks
    if (this._rowLvl !== this.you.level) {
      this._rowLvl = this.you.level;
      for (const r of ['.row2', '.row3']) { const row = $(r, this.root); if (row) row.classList.toggle('all-locked', !this.slots.some((sl) => sl.el.parentElement === row && sl.s.lvl <= this.you.level)); }
      // the potion slot sits above the third row's tab once that row shows (levels 42 and up), never on its first skill
      if (this.pot) { const r3 = $('.row3', this.root); this.pot.el.classList.toggle('over3', !!r3 && !r3.classList.contains('all-locked') && r3.children.length > 0); }
    }
    // cast bar
    const cb = $('.castbar', this.root);
    const c = g.casting;
    if (c && c.cast > 0) {
      cb.classList.remove('hidden');
      const k = Math.min(1, (performance.now() / 1000 - c.t0) / c.cast);
      $('i', cb).style.width = (k * 100) + '%';
      $('span', cb).textContent = c.name;
      if (k >= 1) g.casting = null;
    } else cb.classList.add('hidden');
    // nameplates + floating text (F1: at QUALITY.plateHz when a preset sets one, Battery saver 15 Hz; else every frame)
    this.plT = (this.plT || 0) + dt;
    if (!GFX.plateHz || this.plT >= 1 / GFX.plateHz - 1e-4) { this.plT = 0; this.updatePlates(camera); }
    const W = innerWidth, H = innerHeight;
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      const k = f.t / f.dur;
      if (k >= 1) { f.el.remove(); this.floats.splice(i, 1); continue; }
      const v = f.pos.clone().add(new THREE.Vector3(0, 2.2 + k * 1.4, 0)).project(camera);
      if (v.z > 1) { f.el.style.display = 'none'; continue; }
      f.el.style.display = 'block';
      let sc, jx = 0;
      if (f.pop) {
        // punch in with overshoot: 0.4 -> 1.6 -> 1.0 over ~140 ms, then settle a little smaller as it drifts away
        const e = f.t / 0.14;
        if (e < 0.5) { const q = e / 0.5; sc = 0.4 + 1.2 * (1 - (1 - q) * (1 - q)); }
        else if (e < 1) { const q = (e - 0.5) / 0.5; sc = 1.6 - 0.6 * q * q * (3 - 2 * q); }
        else sc = 1 - Math.min(0.12, (k - 0.14) * 0.2);
        if (f.crit && f.t < 0.1) jx = (Math.random() - 0.5) * 12;
      } else sc = k < 0.12 ? 0.6 + (k / 0.12) * 0.7 : 1.3 - Math.min(0.3, (k - 0.12) * 1.5);
      const ax = f.pop ? f.dx * Math.pow(k, 0.7) : f.dx * k, ay = f.pop ? 18 * k * k + (f.dy || 0) : 0; // sideways arc that dips at the end
      f.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W + ax + jx - 80}px, ${(-v.y * 0.5 + 0.5) * H + ay}px) scale(${sc})`;
      f.el.style.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
    }
    this.mmT = (this.mmT || 0) + dt;
    // F2: the minimap redraws at QUALITY.miniHz (10 Hz; Battery saver 5), and not at all while the game is hidden
    if (this.mmT > 1 / (GFX.miniHz || 10) && !bgState().hidden) { this.mmT = 0; this.drawMinimap(); if (this.windows.map?.isConnected) this.windows.map.refresh(); this.layoutCorner(); }
    this.buffT = (this.buffT || 0) + dt;
    if (this.buffT > 0.5 && this.you) { this.buffT = 0; for (const b of this.you.buffs || []) b.t = Math.max(0, b.t - 0.5); this.renderBuffs($('.player-frame .buffs', this.root), (this.you.buffs || []).filter((b) => b.t > 0)); }
  }

  // the top-right column: the quest tracker starts just under whatever the minimap shows (zone name, map, coords, the
  // letters and worn-gear notes), so the notes never slide under it. Phones keep the tracker on the left (hud.css).
  layoutCorner() {
    const mm = $('.minimap', this.root), qt = $('.quest-tracker', this.root);
    if (!mm || !qt) return;
    const z = parseFloat(getComputedStyle(qt).zoom) || 1;
    if (document.documentElement.classList.contains('phone')) {
      // phones: the tracker sits on the left under the party frames, and stops above the movement stick
      const pf = $('.party-frames', this.root), st = $('.tc-stick .tc-base', this.root);
      const pr = pf?.childElementCount ? pf.getBoundingClientRect() : null;
      const top = pr && pr.height ? Math.round(pr.bottom + 6) : 0;
      const floor = st && st.offsetParent ? st.getBoundingClientRect().top - 4 : innerHeight * 0.62;
      const key = top + ':' + Math.round(floor);
      if (this._qtTop !== key) {
        this._qtTop = key;
        qt.style.top = top ? Math.round(top / z) + 'px' : '';
        qt.style.maxHeight = top ? Math.max(0, Math.round((floor - top) / z)) + 'px' : '';
        qt.classList.toggle('squeezed', !!top && floor - top < 44);
      }
      return;
    }
    if (qt.style.maxHeight) { qt.style.maxHeight = ''; qt.classList.remove('squeezed'); }
    const top = Math.round((mm.getBoundingClientRect().bottom + 10) / z);
    if (this._qtTop !== top) { this._qtTop = top; qt.style.top = top + 'px'; }
  }

  updatePlates(camera) {
    const box = $('.plates', this.root);
    const W = innerWidth, H = innerHeight;
    const used = new Set();
    const camPos = camera.position, list = [];
    this._plF = ((this._plF || 0) + 1) % 7;
    // phones and tablets: only a few plates (mobileplates.js rules: NPCs near you, foes in range, the target always, at most
    // 6 plus the target, nearest first); titles only on the target and the nearest person you can talk to
    const mob = IS_MOBILE ? this.mobilePlates(camPos, camera) : null;
    for (const v of this.g.entities.views.values()) {
      if (v.id === this.g.localId && v.id) { /* own plate hidden */ continue; }
      if (v.ty === 'n' && v.npc && (v.npc.seenFrom || v.npc.seenUntil) && v.root && !v.root.visible) continue; // a story-timed man not here yet (npcSeen): no floating name
      const dist = v.pos.distanceTo(camPos);
      if (dist > 70) continue;
      const mr = mob ? mob.get(v.id) : null;
      if (mob && !mr) continue;
      const pos = v.pos.clone(); pos.y += (v.height || 2) + 0.35;
      const s = pos.project(camera);
      if (s.z > 1 || s.x < -1.1 || s.x > 1.1 || s.y < -1.1 || s.y > 1.1) continue;
      used.add(v.id);
      let p = this.plates.get(v.id);
      if (!p) {
        p = el('div', 'plate');
        p.innerHTML = '<div class="pn"></div><div class="ph"><i></i></div>';
        box.appendChild(p);
        this.plates.set(v.id, p);
      }
      const d = v.data || {};
      const name = v.ty === 'm' && v.dead && v.lootName ? `<span class="lootname" style="color:${QUALITY[Math.max(1, v.sparkleQ ?? 1)] || '#ffe08a'}">${v.lootName}</span>` : v.ty === 'm' ? `${MOBS[d.k].name}` : v.ty === 'n' ? v.name : shownName(d.n, d.b) + (d.ti && d.ti[0] === '<' ? `<div class="pt">${d.ti.replace('<', '&lt;').replace('>', '&gt;')}</div>` : d.ti ? `<span class="ptl">${d.ti.startsWith('the ') ? ' ' : ', '}${d.ti}</span>` : '');
      const showHp = v.ty !== 'n' && !v.dead;
      p.className = 'plate ' + (v.ty === 'm' ? 'hostile' : v.ty === 'n' ? 'npc' : 'friendly') + (this.g.target === v.id ? ' targeted' : '') + (v.dead ? ' dead' : '') + (v.def?.elite ? ' elite' : '');
      const ttl = !mr || mr.title; // mobile: the title lines only where the rules allow them
      const txt = (v.ty !== 'n' && d.l && !(v.dead && v.lootName) ? `<span class="pl">${d.l}</span> ` : '') + (ttl ? name : name.replace(/<div class="pt">[\s\S]*?<\/div>|<span class="ptl">[\s\S]*?<\/span>/g, '')) + (ttl && v.ty === 'n' && v.npc?.title ? `<div class="pt">&lt;${v.npc.title}&gt;</div>` : '') + (ttl && v.ty === 'p' && d.g ? `<div class="pg">&lt;${d.g}&gt;</div>` : '');
      if (p._t !== txt) { p.firstChild.innerHTML = txt; p._t = txt; p._h = 0; p._w = 0; }
      // a quest marker floats clear above the name and title, however far the camera is (plates keep their pixel size)
      if (v.marker) {
        if (!p._h) p._h = p.offsetHeight || 34;
        const ppm = H / (2 * Math.max(1, dist) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
        v.marker.position.y = (v.height || 2) + Math.max(1.6, 0.35 + (p._h + 8) / ppm + v.marker.scale.y / 2);
      }
      p.lastChild.style.display = showHp && (mr && mr.hp === false ? false : true) && (v.ty === 'm' ? (d.h < 1 || this.g.target === v.id) : true) ? 'block' : 'none';
      p.lastChild.firstChild.style.width = ((d.h ?? 1) * 100).toFixed(0) + '%';
      const hpOn = p.lastChild.style.display === 'block';
      if (p._hp !== hpOn) { p._hp = hpOn; p._w = 0; p._h = 0; }
      const tg = this.g.target === v.id;
      // behind a building or a hill: a ray from the plate to the lens (the camera's own ground + world.dyn test), a few
      // plates a frame. Hits within 1.5 m of the head (an awning over a stall) don't count.
      if (p._k === undefined) p._k = (this._plK = ((this._plK || 0) + 1) % 7);
      if ((this._plF + p._k) % 7 === 0) {
        const rig = this.g.rig;
        // mobile: the target and anyone within 10 m of the hero are never hidden as "behind something" (phones test
        // freed meshes by their boxes, which hid the quest giver you stand next to)
        if (rig?.castHit && dist > 3 && !mr?.near) {
          const dir = _plDir.copy(camPos).sub(_plPos.copy(v.pos).setY(v.pos.y + (v.height || 2) + 0.35));
          const len = dir.length(); dir.multiplyScalar(1 / len);
          const hit = rig.castHit(_plPos, dir, len);
          p._occ = hit > 1.5 && hit < len - 1;
        } else p._occ = false;
      }
      const want = p._occ ? (tg ? 0.35 : 0) : Math.max(0.25, 1 - (dist - 40) / 30);
      p._a = p._a === undefined ? want : p._a + (want - p._a) * 0.25;
      list.push({ p, x: (s.x * 0.5 + 0.5) * W, y: (-s.y * 0.5 + 0.5) * H, tg, dist });
    }
    for (const [id, p] of this.plates) if (!used.has(id)) { p.remove(); this.plates.delete(id); }
    if (mob) { this.layoutPlatesMobile(list, W, H); return; }
    // lay the plates out: the targeted one first, then nearest first. A plate that would overlap one already placed may
    // step up by at most one plate height (so it stays over its own model and never drifts onto another mob); if that
    // isn't enough it stays where it is, dimmed and behind. Every plate stays inside the screen; the nudge eases.
    list.sort((a, b) => (b.tg - a.tg) || a.dist - b.dist);
    const PAD = 8, BOT = 30, placed = []; // BOT: clear of the experience bar along the bottom edge
    for (const it of list) {
      const p = it.p;
      if (p._a < 0.03) { p.style.visibility = 'hidden'; p._off = 0; continue; }
      p.style.visibility = '';
      if (!p._w) { p._w = p.offsetWidth || 80; p._h = p.offsetHeight || 34; }
      const w = p._w, h = p._h;
      const x = Math.min(W - PAD - w / 2, Math.max(PAD + w / 2, it.x));
      const hits = (yy) => placed.some((q) => Math.abs(x - q.x) < (w + q.w) / 2 + 2 && yy - h < q.y + 1 && q.y - q.h - 1 < yy);
      let y = it.y, under = false;
      if (hits(y)) {
        let best = null;
        for (const q of placed) {
          const c = q.y - q.h - 2;
          if (c < y && y - c <= h + 4 && !hits(c) && (best === null || c > best)) best = c;
        }
        if (best !== null) y = best; else under = !it.tg;
      }
      const off = y - it.y;
      p._off = p._off === undefined || Math.abs(off - p._off) > h + 6 ? off : p._off + (off - p._off) * 0.3;
      const fy = Math.min(H - BOT, Math.max(PAD + h, it.y + p._off));
      if (!under) placed.push({ x, y: Math.min(H - BOT, Math.max(PAD + h, y)), w, h });
      p.style.transform = `translate(${x.toFixed(1)}px, ${fy.toFixed(1)}px) translate(-50%, -100%)`;
      p.style.opacity = (under ? p._a * 0.3 : p._a).toFixed(2);
      p.style.zIndex = it.tg ? 3 : under ? 0 : 1;
    }
  }

  // ---- mobile nameplates (IS_MOBILE only; the desktop never calls these)
  // which entities get a plate this frame: Map id -> { show, title, hp }. The rules come from ui/mobileplates.js
  // (plateRules) when it has loaded, else the same rules built in. Distances are from your hero, not the lens.
  mobilePlates(camPos, camera) {
    const g = this.g, T = SETTINGS.touch || TOUCH_DEFAULTS, me = g.entities.get(g.localId), at = me?.pos || camPos;
    let near = null, nd = 8; // the nearest person you can talk to, within 8 m
    for (const v of g.entities.views.values()) if (v.ty === 'n' && !v.dead) { const d = Math.hypot(v.pos.x - at.x, v.pos.z - at.z); if (d < nd) { nd = d; near = v.id; } }
    const ctx = { targetId: g.target, nearestNpcId: near, isMobile: true, mode: T.plates, playerNames: T.playerNames };
    const rule = MP?.plateRules || ((v, dist, c) => {
      const tg = v.id === c.targetId;
      if (tg) return { show: true, title: true, hp: true };
      if (c.mode === 'off') return { show: false };
      const show = v.ty === 'n' ? dist <= 22 : v.ty === 'm' ? dist <= 35 : !!c.playerNames && dist <= 35;
      return { show, title: v.id === c.nearestNpcId, hp: true };
    });
    const cand = [];
    for (const v of g.entities.views.values()) {
      if (v.id === g.localId) continue;
      const dist = Math.hypot(v.pos.x - at.x, v.pos.z - at.z);
      if (dist > 70) continue;
      if (v.ty === 'p' && !T.playerNames && v.id !== g.target) continue; // other players' names: off unless asked for
      const r = rule(v, dist, ctx);
      if (!r?.show) continue;
      // only what is on screen counts toward the cap (else NPCs behind the lens took the six places)
      if (camera && v.id !== g.target) { const s = _plPos.copy(v.pos).setY(v.pos.y + (v.height || 2) + 0.35).project(camera); if (s.z > 1 || Math.abs(s.x) > 0.98 || Math.abs(s.y) > 0.98) continue; } // head on screen: no plate pinned to the edge
      cand.push([v.id, r, dist, v.id === g.target]);
    }
    cand.sort((a, b) => (b[3] - a[3]) || a[2] - b[2]);
    const cap = MP?.PLATES?.[T.plates]?.max ?? (T.plates === 'all' ? 12 : 6);
    const out = new Map();
    let n = 0;
    const tag = (c) => (c[3] || c[2] < 10 ? { ...c[1], near: true } : c[1]); // near: skips the occlusion ray (updatePlates)
    for (const c of cand) { if (c[3]) { out.set(c[0], tag(c)); continue; } if (n >= cap) break; n++; out.set(c[0], tag(c)); }
    return out;
  }
  // lay the mobile plates out: clamped inside the screen, one step up when two meet (as on the desktop); a plate that
  // still overlaps one already placed, or sits on the HUD (frames, minimap, skill wheel, tracker), is hidden, not dimmed.
  // mobileplates.js declutter(list, W, H, avoidRects) does this when it has loaded (it sets item.hidden / the element's
  // visibility); the built-in pass below is the same rule.
  layoutPlatesMobile(list, W, H) {
    list.sort((a, b) => (b.tg - a.tg) || a.dist - b.dist);
    const PAD = 6, BOT = 30, placed = [];
    let avoid = [];
    try { avoid = (this.g.touch?.hudRects?.() || []).map((r) => ({ left: r.left ?? r.x, top: r.top ?? r.y, right: r.right ?? (r.x + r.width), bottom: r.bottom ?? (r.y + r.height) })); } catch { avoid = []; }
    if (MP?.declutter) {
      // mobileplates.js: it picks, lifts and hides (visibility); the shown ones are then placed where it says
      try {
        const items = [];
        for (const it of list) {
          const p = it.p;
          if (p._a < 0.03) { p.style.visibility = 'hidden'; continue; }
          if (!p._w) { p._w = p.offsetWidth || 80; p._h = p.offsetHeight || 34; }
          items.push({ el: p, x: it.x, y: Math.min(H - BOT, it.y), w: p._w, h: p._h, tg: it.tg, dist: it.dist });
        }
        const max = MP.PLATES?.[SETTINGS.touch?.plates]?.max ?? 6;
        MP.declutter(items, W, H - BOT, avoid, { max });
        for (const it of items) {
          if (it.hidden) continue;
          const p = it.el;
          p._off = 0;
          p.style.transform = `translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px) translate(-50%, -100%)`;
          p.style.opacity = p._a.toFixed(2);
          p.style.zIndex = it.tg ? 3 : 1;
        }
        return;
      } catch (e) { /* fall back to the built-in layout below */ }
    }
    for (const it of list) {
      const p = it.p;
      if (p._a < 0.03) { p.style.visibility = 'hidden'; p._off = 0; continue; }
      if (!p._w) { p._w = p.offsetWidth || 80; p._h = p.offsetHeight || 34; }
      const w = p._w, h = p._h, x = Math.min(W - PAD - w / 2, Math.max(PAD + w / 2, it.x));
      const hits = (yy) => placed.some((q) => Math.abs(x - q.x) < (w + q.w) / 2 + 2 && yy - h < q.y + 1 && q.y - q.h - 1 < yy);
      let y = it.y, hide = false;
      if (hits(y)) {
        let best = null;
        for (const q of placed) { const c = q.y - q.h - 2; if (c < y && y - c <= h + 4 && !hits(c) && (best === null || c > best)) best = c; }
        if (best !== null) y = best; else hide = !it.tg;
      }
      const fy = Math.min(H - BOT, Math.max(PAD + h, y));
      const rect = { left: x - w / 2, right: x + w / 2, top: fy - h, bottom: fy };
      if (!it.tg && avoid.some((a) => rect.left < a.right && rect.right > a.left && rect.top < a.bottom && rect.bottom > a.top)) hide = true;
      if (!hide) placed.push({ x, y: fy, w, h });
      p._off = 0;
      p.style.transform = `translate(${x.toFixed(1)}px, ${fy.toFixed(1)}px) translate(-50%, -100%)`;
      p.style.opacity = p._a.toFixed(2);
      p.style.zIndex = it.tg ? 3 : 1;
      p.style.visibility = hide ? 'hidden' : '';
    }
  }
}

// playing together (v113): Players window, player menu, trade and inspect windows (ui/social.js)
installSocial(UI);
