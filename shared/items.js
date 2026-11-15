// Itemization: what a random piece of gear is. Weapon types belong to classes, armour comes in three weights, every piece
// has a rarity from Poor to Prismatic, a material that follows its item level, and Uncommon and better pieces carry
// affixes that name them ("Keen Steel Longsword of Swiftness"). Epics and better get a name of their own.
// Shared by the server (which rolls items) and the client (which shows them).
//
// ---- RARITY AND UPGRADE API (rarity_upgrade_plan.md A and B). Everything here is pure: no globals, no ITEMS import.
// Rarity q: 0 Poor, 1 Common, 2 Uncommon, 3 Rare, 4 Epic, 5 Legendary (golden), 6 Prismatic. Names and colours: data.js
// QUALITY / QUALITY_NAME / PRISMATIC_STOPS / PRISMATIC_CSS.
// A gear object may carry: bs (base stats before upgrades; absent means `stats` is the base), tq (a named piece's designed
// rarity, from its ITEMS template), up (upgrade step 0..10). The old reforge field `rf` is read only by migrateGear/upOf.
//   QUALITY_MULT[q]                  random-gear stat budget by rarity (7 entries)
//   NAMED_MULT[q]                    named-template scale; stats = template * NAMED_MULT[q] / NAMED_MULT[tq]
//   DROP_TABLES[src]                 [green, blue, purple, golden, prismatic] fractions per source
//   RARITY_SRC                       the source keys: world elite boss bossH raid raidH worldboss ds
//   TEMPER                           Tempering (bad-run protection) constants
//   rollRarity(rnd, src, temper?) -> q 2..6. With a temper object ({ g, p }, kept on the player) the roll counts as an
//                                    endgame roll and the object is UPDATED IN PLACE (golden at most 20 rolls apart,
//                                    prismatic weight +0.01% per counted roll from 150, certain at 300, then reset).
//   newTemper() -> { g: 0, p: 0 };  temperInfo(temper) -> { goldenIn, prisBonus, prisIn } for the Armory
//   rollNamed(template, src, rnd?, temper?, id?) -> gear object { ...template, id, q, tq, bs, stats, up: 0 }; src null or
//                                    'fixed' keeps the designed rarity (quest rewards, vendors, crafted pieces)
//   namedStats(stats, tq, q) -> stats scaled from the designed rarity to q
//   rollGear(rnd, level, opts)       opts.src (+ opts.temper) rolls the rarity on DROP_TABLES; opts.q fixes it (0..6)
//   UPG                              upgrade constants and per-step tables (K, ore, billet, core)
//   upOf(g) -> 0..10                 the upgrade step (reads old rf too)
//   baseStats(g) -> stats before upgrades
//   upgradeStats(bs, up) -> round(bs * (1 + 0.03 * up))
//   canUpgrade(g) -> bool;  upgradeCost(g) -> { step, gold, mats: [[itemId, n], ...] } | null (cost of the NEXT step)
//   upgraded(g) -> new gear object one step up (never fails; +10 adds a socket); ilvl does not change
//   upgradeTotal(g, to = 10) -> { gold, mats } from the current step to `to`
//   oreFor(ilvl) -> the ore item id for that item-level band (ORE_BANDS)
//   gearName(g) -> 'Name +N' (or the plain name at +0)
//   gearValue(g) -> merchant price (GEAR_VALUE_MULT by rarity, +10% per upgrade step)
//   salvageYield(g, opts?) -> [[itemId, n], ...]; opts.dupDs adds DS_DUP_CORES War-Engine Cores for a Dragonslayer duplicate
//   migrateGear(g, items?) -> gear object in the gearV 2 shape (rf n -> up n, ilvl - 2n, stats rebuilt). Idempotent.
//   migrateEntry(entry, items) -> bag/bank entry; id-only gear becomes { gear: full object }
//   migratePlayer(p, items) -> p with equip, bag and bank migrated and p.gearV = GEAR_V. Idempotent.
//   Compat shim (to be dropped once sim/ui call the upgrade API): REFORGE, canReforge, reforgeCost, reforged.

export const WEAPON_TYPES = {
  sword: { label: 'Sword', classes: ['knight'], bases: ['Shortsword', 'Broadsword', 'Longsword', 'Bastard Sword'] },
  axe: { label: 'Axe', classes: ['knight', 'warden'], bases: ['Hatchet', 'Bearded Axe', 'Battle Axe', 'War Axe'] },
  mace: { label: 'Mace', classes: ['knight', 'warden'], bases: ['Cudgel', 'Flanged Mace', 'Spiked Mace', 'Warmace'] },
  hammer: { label: 'Hammer', classes: ['warden'], bases: ['Maul', 'Warhammer', 'Forge Hammer', 'Pile Driver'] },
  bow: { label: 'Bow', classes: ['ranger'], bases: ['Shortbow', 'Longbow', 'Recurve Bow', 'Composite Bow'] },
  rod: { label: 'Coil Rod', classes: ['chemist'], bases: ['Spark Rod', 'Coil Rod', 'Reactor Rod', 'Arc Projector'] },
  scimitar: { label: 'Scimitar', classes: ['sandblade'], bases: ['Scimitar', 'Sabre', 'Tulwar', 'Dune Scimitar'] },
  staff: { label: 'Staff', classes: ['herbalist'], bases: ['Walking Staff', 'Quarterstaff', 'Thornwood Staff', 'Brass-Shod Staff'] },
  // the Deadeye's main-hand pistol (one-handed, in weaponR); the off-hand one is a sidearm (OFFHAND_TYPES.sidearm, weaponL)
  pistol: { label: 'Pistol', classes: ['deadeye'], bases: ['Flintlock Pistol', 'Snaplock Pistol', 'Steam Pistol', 'Pressure Pistol'] },
};
export const OFFHAND_TYPES = {
  shield: { label: 'Shield', classes: ['knight', 'warden'], bases: ['Buckler', 'Heater Shield', 'Kite Shield', 'Tower Shield'] },
  quiver: { label: 'Quiver', classes: ['ranger'], bases: ['Quiver', 'Hip Quiver', 'Long Quiver', 'Hunter’s Quiver'] },
  bandolier: { label: 'Bandolier', classes: ['chemist'], bases: ['Flask Bandolier', 'Reagent Case', 'Brass Bandolier', 'Field Kit'] },
  dagger: { label: 'Dagger', classes: ['sandblade'], bases: ['Parrying Dagger', 'Main-Gauche', 'Kris', 'Off-Hand Blade'] },
  pouch: { label: 'Herb Pouch', classes: ['herbalist'], bases: ['Herb Pouch', 'Seed Satchel', 'Remedy Case', 'Root Bag'] },
  sidearm: { label: 'Sidearm', classes: ['deadeye'], bases: ['Pocket Flintlock', 'Snaplock Sidearm', 'Steam Sidearm', 'Pressure Sidearm'] },
};
// armour weights: who wears what by preference (anyone may equip any armour)
export const CLASS_WEIGHT = { knight: 'plate', warden: 'plate', ranger: 'mail', sandblade: 'mail', chemist: 'cloth', herbalist: 'cloth', deadeye: 'mail' };
export const CLASS_WEAPONS = Object.fromEntries(['knight', 'warden', 'ranger', 'chemist', 'sandblade', 'herbalist', 'deadeye'].map((c) => [c, Object.keys(WEAPON_TYPES).filter((k) => WEAPON_TYPES[k].classes.includes(c))]));
export const CLASS_OFFHANDS = Object.fromEntries(['knight', 'warden', 'ranger', 'chemist', 'sandblade', 'herbalist', 'deadeye'].map((c) => [c, Object.keys(OFFHAND_TYPES).filter((k) => OFFHAND_TYPES[k].classes.includes(c))]));

const ARMOR_BASES = {
  plate: { head: ['Helm', 'Greathelm', 'Barbute'], shoulders: ['Pauldrons', 'Spaulders'], chest: ['Breastplate', 'Cuirass'], hands: ['Gauntlets', 'Plated Gloves'], legs: ['Legplates', 'Greaves'], feet: ['Sabatons', 'War Boots'] },
  mail: { head: ['Coif', 'Mail Hood'], shoulders: ['Shoulderguards', 'Mantle'], chest: ['Hauberk', 'Brigandine'], hands: ['Grips', 'Mail Gloves'], legs: ['Chausses', 'Leggings'], feet: ['Boots', 'Treads'] },
  cloth: { head: ['Cap', 'Hood'], shoulders: ['Shoulderpads', 'Mantle'], chest: ['Coat', 'Tunic', 'Vest'], hands: ['Gloves', 'Wraps'], legs: ['Trousers', 'Breeches'], feet: ['Shoes', 'Soft Boots'] },
};
const BACK_BASES = ['Cloak', 'Cape', 'Travelling Cloak', 'Hooded Cape'];
const TRINKET_BASES = ['Keepsake', 'Locket', 'Band', 'Pocket Watch', 'Gear Fob', 'Signet'];
// materials by item level band (1-6, 7-12, 13-18, 19+)
const MATERIAL = {
  plate: ['Iron', 'Steel', 'Brass-Bound', 'Storm-Forged'], mail: ['Riveted', 'Chain', 'Brass-Ringed', 'Coil-Linked'], cloth: ['Linen', 'Woolen', 'Quilted', 'Coil-Woven'],
  weapon: ['Iron', 'Steel', 'Brass', 'Storm-Forged'], pistol: ['Iron', 'Steel', 'Blued Steel', 'Brass-Bound'], back: ['Rough', 'Canvas', 'Oiled', 'Storm-Proof'], trinket: ['Copper', 'Silver', 'Brass', 'Storm-Glass'],
};
const POOR = ['Cracked', 'Rusted', 'Frayed', 'Bent', 'Battered', 'Chipped'];
export const AFFIX = {
  crit: { prefix: 'Keen', suffix: 'of Precision', k: 0.1 },
  haste: { prefix: 'Swift', suffix: 'of Swiftness', k: 0.2 },
  dodge: { prefix: 'Nimble', suffix: 'of Evasion', k: 0.08 },
  armor: { prefix: 'Reinforced', suffix: 'of the Bulwark', k: 1.0 },
  hp: { prefix: 'Hardy', suffix: 'of Fortitude', k: 0.4 },
  power: { prefix: 'Tempered', suffix: 'of Might', k: 0.3 },
  leech: { prefix: 'Mending', suffix: 'of Recovery', k: 0.05 },
};
// epic names: two parts, plain words only
const EPIC_A = ['Storm', 'Iron', 'Ember', 'Granite', 'Gale', 'Thunder', 'Cinder', 'Brass', 'Quarry', 'Rust', 'Dune', 'Cliff', 'Coal', 'Slate', 'Ash', 'Copper'];
const EPIC_B = ['breaker', 'fall', 'guard', 'edge', 'crest', 'hold', 'spark', 'reach', 'heart', 'bite', 'cleaver', 'wall', 'striker', 'warden', 'mark', 'fist'];

export const QUALITY_MULT = [0.6, 0.8, 1.0, 1.45, 2.0, 2.5, 2.9];
// what a merchant pays for a piece of gear (by rarity; each upgrade step adds 10%)
export const GEAR_VALUE_MULT = [0.6, 1, 2, 3.5, 6, 10, 16];
export const gearValue = (g) => Math.max(1, Math.round((4 + (g.ilvl || 1) * 3) * (GEAR_VALUE_MULT[g.q ?? 1] ?? 1) * 4 * (1 + 0.1 * upOf(g))));
export const STAT_NAME = { power: 'Power', armor: 'Armour', hp: 'Stamina', haste: 'Haste', crit: 'Critical Strike', dodge: 'Dodge', leech: 'Recovery' };
// stats shown as a percentage on the character (haste, crit, dodge and recovery are hundredths)
export const STAT_PCT = { haste: true, crit: true, dodge: true, leech: true };
export const SLOT_LABEL = { head: 'Head', shoulders: 'Shoulders', back: 'Back', chest: 'Chest', hands: 'Hands', legs: 'Legs', feet: 'Feet', weapon: 'Main Hand', offhand: 'Off Hand', trinket: 'Trinket' };
const SLOTS = [['weapon', 18], ['offhand', 7], ['trinket', 6], ['back', 7], ['head', 10], ['shoulders', 10], ['chest', 11], ['hands', 10], ['legs', 11], ['feet', 10]];

// the line under an item's name: "Rare Plate Helm", "Epic Two-Hand... "
// cut gems: each fits any socket and adds one stat
export const GEMS = {
  gem_ember: { name: 'Ember Garnet', stats: { power: 9 }, color: 'red' },
  gem_stone: { name: 'Ironstone', stats: { armor: 36 }, color: 'grey' },
  gem_moss: { name: 'Glade Peridot', stats: { hp: 14 }, color: 'green' },
  gem_storm: { name: 'Storm-Glass Prism', stats: { crit: 2 }, color: 'blue' },
  gem_spring: { name: 'Spring-Brass Bead', stats: { haste: 2 }, color: 'gold' },
  gem_dune: { name: 'Dune Topaz', stats: { dodge: 2 }, color: 'amber' },
};
// the wardrobe: what a character's weapon and offhand look like, from what is worn and the choices made at the wardrobe
// (a choice only shows while something is worn in that hand). Returns { wt, wq, oh, wu, ou, sh, ck, gr } for the
// setChar* builders and the snapshots.
// Look codes (old codes without the parts in brackets still parse the same):
//   gr  body armour, one code per GEAR_SLOTS slot: weight letter + quality 1..6 [':' heat 7..10] ['@ds'], or '-'
//       ('p3.-.m2.c4.p6:9@ds')
//   sh  shoulders 'plate:4' [':' heat] ['@ds'];  ck  cloak '4' [':' heat] ['@ds']
//   wq  weapon quality 1..6;  wu / ou  the weapon's and offhand's heat stage (7..10, only when shown)
// The heat part is the upgrade step the piece shows (plan C: +7..+10 heat the steel; +1..+6 look the same as +0), after
// the wardrobe's heat choice (y.wheat: null as forged, 0 cold, 7..10 a stage reached, never above the piece's own step).
// '@ds' marks a Dragonslayer piece (ids 'ds_*'), '@ds' + a class letter a Dragonslayer armour piece (DSA_CODE). shoulderLook / cloakLook stay the plain collected looks (no heat).
export const SHINE_NAME = { 1: 'Plain', 3: 'Rare shine', 4: 'Epic shine', 5: 'Legendary shine', 6: 'Prismatic shine' };
export const OH_NAME = { kite: 'Kite shield', tower: 'Tower shield', round: 'Buckler', dagger: 'Parrying dagger', 'kite@ds_knight_shield': 'Dragonslayer Bulwark', 'tower@ds_warden_shield': 'Dragonslayer Tower', 'round@ds_sandblade_buckler': 'Dragonslayer Buckler', sidearm: 'Sidearm pistol', 'sidearm@ds_deadeye_pistol_l': 'Dragonslayer Sidearm' };
export const LOOK_QMAX = 6, HEAT_MIN = 7;
// the heat stage a worn piece shows (7..10), or 0
export function heatShown(y, g) {
  const up = upOf(g);
  if (up < HEAT_MIN) return 0;
  const c = y?.wheat;
  const v = c == null ? up : c === 0 ? 0 : Math.min(c, up);
  return v >= HEAT_MIN ? v : 0;
}
const lookQ = (g) => Math.min(LOOK_QMAX, Math.max(1, g?.q || 1));
const isDs = (g) => typeof g?.id === 'string' && g.id.startsWith('ds_');
// ---- DRAGONSLAYER ARMOUR LOOK CONTRACT (rarity_upgrade_plan D; data in shared/data.js DRAGONSLAYER_ARMOUR)
// Item ids 'ds_<class>_<slot>' (slot head, shoulders, chest, hands, legs, feet, back); each carries dsa: '<class>'.
// A worn Dragonslayer armour piece ends its look code with '@ds' + the class letter of DSA_CODE:
//   gr  'p6:9@dsk' (knight plate head, Prismatic, +9 heat)   sh  'plate:5@dsw'   ck  '5:8@dsh'
// parseLook gives { ..., ds: true, dsc: '<class>' } (dsc only when a letter is there; a bare '@ds' is still read, ds
// true and no dsc, and then the wearer's own class is meant). The renderer maps (slot, dsc, weight) to a GLB with
// dsaModel: head 'dsa_<class>_helm', shoulders 'dsa_<class>_pauldron', chest 'dsa_<weight>_chest', hands
// 'dsa_<weight>_gauntlet', legs 'dsa_<weight>_greave', feet 'dsa_<weight>_boot' (client/assets/models/<id>.glb and
// <id>_lo.glb), back null (the cloak is procedural in the Dragonslayer palette). The weight is the code's own letter.
export const DSA_CODE = { knight: 'k', warden: 'w', ranger: 'r', sandblade: 's', chemist: 'c', herbalist: 'h', deadeye: 'd' };
export const DSA_CLASS = Object.fromEntries(Object.entries(DSA_CODE).map(([c, l]) => [l, c]));
const DSA_PART = { head: 'helm', shoulders: 'pauldron', chest: 'chest', hands: 'gauntlet', legs: 'greave', feet: 'boot' };
const WEIGHT_WORD = { p: 'plate', m: 'mail', c: 'cloth' };
export function dsaModel(slot, cls, weight) {
  const part = DSA_PART[slot];
  if (!part || !DSA_CODE[cls]) return null;
  const wt = WEIGHT_WORD[weight] || weight || CLASS_WEIGHT[cls];
  return slot === 'head' || slot === 'shoulders' ? `dsa_${cls}_${part}` : `dsa_${wt}_${part}`;
}
// the heat and Dragonslayer suffix a worn piece adds to its look code
const lookTail = (y, g, chosen = false) => { const h = heatShown(y, g); return (h ? ':' + h : '') + (isDs(g) && !(chosen && g.dsa) ? '@ds' + (DSA_CODE[g.dsa] || '') : ''); };
export function wornLook(y) {
  const w = y.equip?.weapon, o = y.equip?.offhand, sp = y.equip?.shoulders, bk = y.equip?.back;
  const sh = y.shlook === 'none' ? null : y.shlook || shoulderLook(sp);
  const ck = y.cklook === 'none' ? null : y.cklook || cloakLook(bk);
  return {
    // a named legendary carries its own model: 'sword@keeper' (only setCharWeapon reads the part after @)
    wt: (w && y.wlook) || (w?.model ? `${w.wtype}@${w.model}` : w?.wtype) || null,
    wq: w ? (y.wshine || w.q || 1) : 1,
    oh: o ? (y.ohlook || offhandLook(o)) : null,
    wu: w ? heatShown(y, w) : 0,
    ou: o ? heatShown(y, o) : 0,
    // a wardrobe look over a worn piece still shows that piece's heat
    // (the Dragonslayer model only when no wardrobe look is chosen: a chosen look shows that look, not the worn model)
    sh: sh && sp?.slot === 'shoulders' ? sh + lookTail(y, sp, !!y.shlook) : sh,
    ck: ck && bk?.slot === 'back' ? ck + lookTail(y, bk, !!y.cklook) : ck,
    gr: gearLook(y),
  };
}
// parse one look code back: { w, q, heat, ds } (w the weight letter for gr codes, the weight word for sh codes, null
// for cloaks). Old codes ('p3', 'plate:4', '4') parse with heat 0. null for '-', empty or unreadable codes.
export function parseLook(code) {
  if (!code || code === '-' || code === 'none') return null;
  let s = String(code), ds = false, dsc = null;
  const t = /@ds([kwrschd])?$/.exec(s);
  if (t) { ds = true; dsc = t[1] ? DSA_CLASS[t[1]] : null; s = s.slice(0, t.index); }
  const R = (w, q, h) => ({ w, q: +q, heat: h ? Math.min(10, +h) : 0, ds, ...(dsc ? { dsc } : {}) });
  let m = /^([pmc])([1-6])(?::(\d+))?$/.exec(s);
  if (m) return R(m[1], m[2], m[3]);
  m = /^(plate|mail|cloth):([1-6])(?::(\d+))?$/.exec(s);
  if (m) return R(m[1], m[2], m[3]);
  m = /^([1-6])(?::(\d+))?$/.exec(s);
  if (m) return R(null, m[1], m[2]);
  return null;
}
// the worn body armour (head, chest, hands, legs, feet) as one short string for setCharGear and the snapshots:
// one code per slot in GEAR_SLOTS order, '.'-separated: weight letter (p plate, m mail, c cloth) + quality 1..6, then
// ':heat' when the piece shows heat and '@ds' for a Dragonslayer piece, or '-' for an empty slot ('p3.-.m2.c4.p6:9@ds').
// null when nothing is worn there.
export const GEAR_SLOTS = ['head', 'chest', 'hands', 'legs', 'feet'];
export function gearLook(y) {
  const codes = GEAR_SLOTS.map((s) => {
    const g = y.equip?.[s];
    if (!g || g.slot !== s) return '-';
    const wt = g.weight || CLASS_WEIGHT[y.cls] || 'plate';
    return (wt === 'mail' ? 'm' : wt === 'cloth' ? 'c' : 'p') + lookQ(g) + lookTail(y, g);
  });
  return codes.every((c) => c === '-') ? null : codes.join('.');
}
export const CLOAK_NAME = { 1: 'Plain cloak', 2: 'Green cloak', 3: 'Blue cloak', 4: 'Purple and gold cloak', 5: 'Amber and gold cloak', 6: 'Tempered-steel cloak' };
export function cloakLook(g) { return g && g.slot === 'back' ? String(lookQ(g)) : null; }
export const SH_NAME = { plate: 'Plate pauldrons', mail: 'Mail lames', cloth: 'Cloth mantle' };
export function shoulderLook(g) { return g && g.slot === 'shoulders' ? `${g.weight || 'plate'}:${lookQ(g)}` : null; }
export function offhandLook(o) {
  if (!o) return null;
  // a shield with a model of its own (the Dragonslayer set): 'kite@ds_knight_shield' (only setCharOffhand reads the part after @)
  if (o.otype === 'shield') return (/Tower/.test(o.base || o.name) ? 'tower' : /Buckler/.test(o.base || o.name) ? 'round' : 'kite') + (o.model ? '@' + o.model : '');
  if (o.otype === 'dagger') return 'dagger';
  if (o.otype === 'sidearm') return 'sidearm' + (o.model ? '@' + o.model : ''); // the Deadeye's left-hand pistol
  return null;
}
export function typeLine(g) {
  if (g.wtype) return WEAPON_TYPES[g.wtype]?.label || 'Weapon';
  if (g.otype) return OFFHAND_TYPES[g.otype]?.label || 'Off Hand';
  if (g.weight) return g.weight[0].toUpperCase() + g.weight.slice(1);
  return null;
}

// roll one piece of gear. rnd() is the caller's random source; cls (optional) is who it should probably suit.
export function rollGear(rnd, level, opts = {}) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const ilvl = Math.max(1, Math.round(level));
  // rarity
  let q = opts.q ?? (opts.src && DROP_TABLES[opts.src] ? rollRarity(rnd, opts.src, opts.temper) : rnd() < 0.6 ? 2 : rnd() < 0.8 ? 3 : 4);
  if (opts.minQ) q = Math.max(q, opts.minQ);
  q = Math.max(0, Math.min(6, q | 0));
  // slot (weighted)
  let slot = opts.slot;
  if (!slot) { let r = rnd() * SLOTS.reduce((s, x) => s + x[1], 0); for (const [s, w] of SLOTS) { r -= w; if (r <= 0) { slot = s; break; } } slot ||= 'chest'; }
  const smart = opts.cls && rnd() < 0.7;
  const band = Math.min(3, Math.floor((ilvl - 1) / 6));
  const B = (3 + ilvl * 1.6) * QUALITY_MULT[q];
  const stats = {};
  const add = (k, v) => { v = Math.round(v); if (v > 0) stats[k] = (stats[k] || 0) + v; };
  const g = { slot, q, ilvl, req: Math.max(1, ilvl - 2) };
  let base, mat;
  if (slot === 'weapon') {
    const t = smart ? pick(CLASS_WEAPONS[opts.cls]) : pick(Object.keys(WEAPON_TYPES));
    const T = WEAPON_TYPES[t];
    g.wtype = t; g.classes = T.classes; g.icon = `w_${t}~${band}`;
    base = T.bases[Math.min(T.bases.length - 1, band)]; mat = (MATERIAL[t] || MATERIAL.weapon)[band];
    add('power', B * 0.8); add('hp', B * 0.25);
  } else if (slot === 'offhand') {
    const t = smart ? pick(CLASS_OFFHANDS[opts.cls]) : pick(Object.keys(OFFHAND_TYPES));
    const T = OFFHAND_TYPES[t];
    g.otype = t; g.classes = T.classes; g.icon = `o_${t}~${band}`;
    base = T.bases[Math.min(T.bases.length - 1, band)]; mat = t === 'shield' ? MATERIAL.weapon[band] : t === 'dagger' ? MATERIAL.weapon[band] : t === 'sidearm' ? MATERIAL.pistol[band] : '';
    if (t === 'shield') { add('armor', B * 2.2); add('hp', B * 0.6); } else { add('power', B * 0.5); add('hp', B * 0.4); }
  } else if (slot === 'trinket') {
    base = pick(TRINKET_BASES); mat = MATERIAL.trinket[band]; g.icon = `t_trinket~${band}`;
    add('power', B * 0.5); add('hp', B * 0.3);
  } else if (slot === 'back') {
    base = pick(BACK_BASES); mat = MATERIAL.back[band]; g.icon = `a_back~${band}`;
    add('armor', B * 1.6); add('hp', B * 0.6);
  } else {
    const weight = smart ? (opts.weight || 'plate') : pick(['plate', 'mail', 'cloth']);
    g.weight = weight; g.icon = `a_${weight}_${slot}~${band}`;
    base = pick(ARMOR_BASES[weight][slot]); mat = MATERIAL[weight][band];
    if (weight === 'plate') { add('armor', B * 3.2); add('hp', B * 0.9); }
    else if (weight === 'mail') { add('armor', B * 2.4); add('hp', B * 0.7); add('power', B * 0.2); }
    else { add('armor', B * 1.4); add('hp', B * 0.6); add('power', B * 0.4); }
  }
  g.base = `${mat ? mat + ' ' : ''}${base}`;
  // affixes: Uncommon one, Rare and Epic two, Legendary and Prismatic three
  const n = q >= 5 ? 3 : q >= 3 ? 2 : q === 2 ? 1 : 0;
  const keys = Object.keys(AFFIX).filter((k) => !(k === 'armor' && (slot === 'weapon' || slot === 'trinket')));
  const aff = [];
  while (aff.length < n) { const k = pick(keys); if (!aff.includes(k)) aff.push(k); }
  for (const k of aff) add(k, B * AFFIX[k].k * (n > 2 ? 0.7 : n > 1 ? 0.8 : 1));
  g.affixes = aff;
  if (q === 0) g.name = `${pick(POOR)} ${g.base}`;
  else if (q === 1) g.name = g.base;
  else if (q === 2) g.name = `${g.base} ${AFFIX[aff[0]].suffix}`;
  else if (q === 3) g.name = `${AFFIX[aff[0]].prefix} ${g.base} ${AFFIX[aff[1]].suffix}`;
  else g.name = pick(EPIC_A) + pick(EPIC_B);
  if (q === 0) { for (const k of Object.keys(stats)) stats[k] = Math.max(1, Math.round(stats[k] * 0.5)); }
  g.stats = stats;
  if (q >= 5 || (q >= 3 && rnd() < (q >= 4 ? 0.6 : 0.3))) g.sockets = [null];
  return g;
}

// ---- Rarity rolls (plan A4). Fractions of [Uncommon, Rare, Epic, Legendary, Prismatic] per drop source; each row sums to 1.
export const RARITY_SRC = ['world', 'elite', 'boss', 'bossH', 'raid', 'raidH', 'worldboss', 'ds'];
export const DROP_TABLES = {
  world: [0.68, 0.27, 0.049, 0.0009, 0.0001],
  elite: [0.45, 0.40, 0.13, 0.018, 0.002],
  boss: [0.20, 0.50, 0.26, 0.036, 0.004],
  bossH: [0.05, 0.40, 0.45, 0.095, 0.005],
  raid: [0.05, 0.30, 0.50, 0.145, 0.005],
  raidH: [0, 0.15, 0.55, 0.295, 0.005],
  worldboss: [0, 0.20, 0.50, 0.296, 0.004],
  ds: [0.25, 0.30, 0.28, 0.166, 0.004],
};
// Tempering: endgame rolls only. g = rolls since the last Legendary or better, p = counted rolls toward a Prismatic.
export const TEMPER = { golden: 20, prisFrom: 150, prisStep: 0.0001, prisAt: 300 };
export const newTemper = () => ({ g: 0, p: 0 });
export function temperInfo(t) {
  const g = t?.g | 0, p = t?.p | 0;
  return { goldenIn: Math.max(1, TEMPER.golden - g), prisBonus: Math.max(0, p + 1 - TEMPER.prisFrom) * TEMPER.prisStep, prisIn: Math.max(1, TEMPER.prisAt - p) };
}
// roll a rarity (2..6) for a drop from `src`. With `temper` (the player's { g, p }) the roll is an endgame roll: it is
// counted and the object is updated in place.
export function rollRarity(rnd, src, temper) {
  const T = DROP_TABLES[src] || DROP_TABLES.world;
  let pris = T[4], q;
  if (temper) {
    temper.g = temper.g | 0; temper.p = (temper.p | 0) + 1;
    if (temper.p > TEMPER.prisFrom) pris += (temper.p - TEMPER.prisFrom) * TEMPER.prisStep;
    if (temper.p >= TEMPER.prisAt) pris = 1;
  }
  if (rnd() < pris) q = 6;
  else {
    // the rest of the row, scaled to fill what the prismatic roll left (exactly the table when nothing was added)
    let r = rnd() * (1 - T[4]); q = 5;
    for (let i = 0; i < 4; i++) { r -= T[i]; if (r < 0) { q = 2 + i; break; } }
  }
  if (temper) {
    if (q < 5 && temper.g + 1 >= TEMPER.golden) q = 5;
    temper.g = q >= 5 ? 0 : temper.g + 1;
    if (q === 6) temper.p = 0;
  }
  return q;
}

// ---- Named pieces (plan A2): a template keeps its designed rarity tq; each drop rolls q and scales the stats.
export const NAMED_MULT = [1, 1, 0.80, 0.88, 1.00, 1.12, 1.25];
export function namedStats(stats, tq, q) {
  const k = (NAMED_MULT[q] ?? 1) / (NAMED_MULT[tq] ?? 1);
  return Object.fromEntries(Object.entries(stats || {}).map(([s, v]) => [s, v > 0 ? Math.max(1, Math.round(v * k)) : v]));
}
// a drop of a named template (an ITEMS entry). src null/'fixed' (or a template below Uncommon) keeps the designed rarity.
export function rollNamed(template, src, rnd = Math.random, temper, id = template?.id) {
  const tq = template.tq ?? template.q ?? 1;
  const q = !src || src === 'fixed' || tq < 2 ? tq : rollRarity(rnd, src, temper);
  const bs = namedStats(template.stats, tq, q);
  const g = { ...template, q, tq, bs, stats: { ...bs }, up: 0 };
  if (id) g.id = id;
  delete g.rf;
  return g;
}

// ---- Upgrades +1..+10 at a smith (plan B; replaces reforging). Always succeeds: a known price for a known result.
// Uncommon and better; stats = round(base * (1 + 0.03 * up)); the item level does not change; +10 adds one socket.
// Gold per step = round((ilvl^2 * 2 + 150) * K[step]). Materials per step: the item-level band's ore, Tempered Billets
// from +4 and War-Engine Cores from +7, in fixed amounts.
export const UPG = {
  max: 10, minQ: 2, per: 0.03,
  K: [0, 1, 1.4, 1.8, 2.5, 3.2, 4, 6, 8, 11, 15],
  ore: [0, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14],
  billet: [0, 0, 0, 0, 1, 1, 2, 2, 2, 3, 3],
  core: [0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2],
};
export const BILLET = 'billet', ENGINE_CORE = 'enginecore';
// the ore each item-level band works with (max = highest item level of the band); salvage also gives `extra`
export const ORE_BANDS = [
  { max: 12, ore: 'ironore', n: 2, extra: ['scrap', 2] },
  { max: 20, ore: 'brassplate', n: 1, extra: ['spring', 2] },
  { max: 49, ore: 'stormglass', n: 1, extra: ['capacitor', 1] },
  { max: 59, ore: 'cinderore', n: 1 },
  { max: 67, ore: 'frostore', n: 1 },
  { max: Infinity, ore: 'galeiron', n: 1 },
];
const bandFor = (ilvl) => ORE_BANDS.find((b) => (ilvl || 1) <= b.max);
export const oreFor = (ilvl) => bandFor(ilvl).ore;
// the upgrade step (an old save's reforge rf counts until migrateGear converts it)
export function upOf(g) { return Math.max(0, Math.min(UPG.max, (g?.up ?? g?.rf ?? 0) | 0)); }
export const baseStats = (g) => g?.bs || g?.stats || {};
export const upgradeStats = (bs, up) => Object.fromEntries(Object.entries(bs || {}).map(([k, v]) => [k, v > 0 ? Math.round(v * (1 + UPG.per * up)) : v]));
export const gearName = (g) => (upOf(g) ? `${g.name} +${upOf(g)}` : g?.name);
export const canUpgrade = (g) => !!(g?.stats && (g.q ?? 1) >= UPG.minQ && upOf(g) < UPG.max);
function stepCost(il, s) {
  const mats = [[oreFor(il), UPG.ore[s]], [BILLET, UPG.billet[s]], [ENGINE_CORE, UPG.core[s]]].filter(([, n]) => n > 0);
  return { step: s, gold: Math.round((il * il * 2 + 150) * UPG.K[s]), mats };
}
export function upgradeCost(g) { return canUpgrade(g) ? stepCost(g.ilvl || 1, upOf(g) + 1) : null; }
export function upgradeTotal(g, to = UPG.max) {
  const out = { gold: 0, mats: [] }, il = g?.ilvl || 1;
  for (let s = upOf(g) + 1; s <= Math.min(UPG.max, to); s++) {
    const c = stepCost(il, s); out.gold += c.gold;
    for (const [id, n] of c.mats) { const m = out.mats.find((x) => x[0] === id); if (m) m[1] += n; else out.mats.push([id, n]); }
  }
  return out;
}
export function upgraded(g) {
  const up = upOf(g) + 1, bs = { ...baseStats(g) };
  const out = { ...g, bs, stats: upgradeStats(bs, up), up };
  delete out.rf;
  if (up === UPG.max) out.sockets = [...(g.sockets || []), null];
  return out;
}

// ---- Salvage at a smith: unwanted Uncommon or better gear breaks down into the materials upgrades use, in fixed amounts
// (the item level picks the ore, the rarity how much; upgraded pieces give a little more back). Epic and better pieces of
// item level 40+ also give Tempered Billets; a duplicate Dragonslayer piece gives War-Engine Cores. Never a random roll.
export const SALVAGE_MULT = [0, 0, 1, 2, 3, 5, 8];
export const SALVAGE_BILLET = [0, 0, 0, 0, 1, 2, 3];
export const SALVAGE_BILLET_ILVL = 40, DS_DUP_CORES = 3;
export function salvageYield(g, opts = {}) {
  const k = SALVAGE_MULT[g?.q ?? 1] || 0, il = g?.ilvl || 1, up = upOf(g);
  if (!k || !g?.stats) return [];
  const b = bandFor(il), out = [[b.ore, b.n * k + up]];
  if (b.extra) out.push([b.extra[0], b.extra[1] * k + up]);
  const bil = (il >= SALVAGE_BILLET_ILVL ? SALVAGE_BILLET[g.q] || 0 : 0) + (up >= 4 ? Math.floor((up - 2) / 2) : 0);
  if (bil) out.push([BILLET, bil]);
  if (opts.dupDs && String(g.id || '').startsWith('ds_')) out.push([ENGINE_CORE, DS_DUP_CORES]);
  return out;
}

// ---- Save migration (plan A7, p.gearV = 2): keep q; add bs (and tq on named pieces) and up; an old reforge rf = n becomes
// up = n, the 2 item levels per step come off and the stats are rebuilt from the recovered base. Running it again changes
// nothing.
export const GEAR_V = 2;
// one old reforge step: every stat of 8 or more grew by about 6% (at least 1)
const rfStep = (v) => (v >= 8 ? Math.max(v + 1, Math.round(v * 1.06)) : v);
function unReforge(v, n) {
  for (let i = 0; i < n; i++) {
    if (v < 9) break; // stats under 8 never moved, and no step lands below 9
    let b = v;
    for (let c = Math.floor(v / 1.06) - 2; c < v; c++) if (c >= 8 && rfStep(c) === v) { b = c; break; }
    v = b;
  }
  return v;
}
export function migrateGear(g, items) {
  if (!g || typeof g !== 'object' || !g.stats) return g;
  const out = { ...g }, tpl = g.id && items?.[g.id];
  if (out.up === undefined) {
    const rf = Math.max(0, Math.min(3, g.rf | 0));
    if (!out.bs) out.bs = rf ? Object.fromEntries(Object.entries(g.stats).map(([k, v]) => [k, unReforge(v, rf)])) : { ...g.stats };
    if (rf) out.ilvl = Math.max(1, (g.ilvl || 1) - 2 * rf);
    out.up = rf;
  }
  delete out.rf;
  out.bs ||= { ...g.stats };
  if (tpl && out.tq === undefined) out.tq = tpl.q ?? out.q;
  out.stats = upgradeStats(out.bs, out.up);
  return out;
}
export function migrateEntry(b, items) {
  if (!b) return b;
  if (b.gear) return { ...b, gear: migrateGear(b.gear, items) };
  const tpl = b.id && items?.[b.id];
  if (tpl?.stats) { const { id, n, ...rest } = b; return { ...rest, gear: migrateGear({ ...tpl, id, stats: { ...tpl.stats } }, items) }; }
  return b;
}
export function migratePlayer(p, items) {
  if (!p) return p;
  if (p.equip) for (const [s, g] of Object.entries(p.equip)) {
    if (typeof g === 'string' && items?.[g]?.stats) p.equip[s] = migrateGear({ ...items[g], id: g, stats: { ...items[g].stats } }, items);
    else p.equip[s] = migrateGear(g, items);
  }
  for (const k of ['bag', 'bank']) if (Array.isArray(p[k])) p[k] = p[k].map((b) => migrateEntry(b, items));
  p.gearV = GEAR_V;
  return p;
}

// ---- Compat shim for code that still calls the old reforge names (sim on_reforge, the smith window). Same rules as the
// upgrade API above; nothing stores `rf` any more.
export const REFORGE = { steps: UPG.max, ilvl: 0, mult: UPG.per, minQ: UPG.minQ };
export const canReforge = canUpgrade;
export const reforgeCost = upgradeCost;
export const reforged = upgraded;

// a smith's fee for taking a gem out of its socket (the gem comes back whole)
export const unsocketFee = (g) => 30 + (g?.ilvl || 1) * 8;
