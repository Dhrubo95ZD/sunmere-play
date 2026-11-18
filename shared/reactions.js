// Machine reactions, full (combat_design.md 2.5, 2.6, 5.8; stage S7): the coats one class leaves on a machine, the
// Reactions another blow sets off, Pinned, wall slams and the bosses' recovery after a big telegraph. Data and small pure
// helpers only: the sim (shared/sim.js) applies them and the client (client/game/reactfx.js) shows them. Imports nothing
// (shared/ may only import from shared/). All of it is physical: tar, frost salts, acid, powder, heat, sparks, blows.

// a coat: the buff it puts on the machine (stat/pct, as any debuff), how long it lasts, the Reaction it waits for and the
// kinds of blow that set it off. Corroded stacks (armour -3% a stack, up to 5). Powdered is the Blinded debuff (its
// swings miss 20%); it takes no part in a Reaction (section 2.5)
export const COATS = {
  tar: { name: 'Tarred', stat: 'slow', pct: 20, dur: 8, react: 'ignite', by: ['heat'], icon: 'tar' },
  chill: { name: 'Chilled', stat: 'slow', pct: 40, dur: 6, react: 'shatter', by: ['blunt', 'blast'], icon: 'frost' },
  corrode: { name: 'Corroded', stat: 'vuln', pct: 3, stacks: 5, dur: 8, react: 'galvanic', by: ['spark'], icon: 'acid' },
  powder: { name: 'Powdered', stat: 'miss', pct: 20, dur: 5, react: null, by: [], icon: 'powder' },
};
export const COAT_BY_NAME = Object.fromEntries(Object.entries(COATS).map(([k, c]) => [c.name, k]));

// a Reaction: shown as one plain word over the machine with its own sound; it consumes the coat and the hit is at least T3.
//   ignite: a burn of `burn` x the caster's power over `dur` s (flame sheets about 1 m tall on the machine)
//   shatter: the hit deals `mul` x and `brk` more poise (rime chips fall off)
//   galvanic: the hit jumps once to the nearest other machine within `range` m at `share` of its damage (a short arc)
export const REACTIONS = {
  ignite: { name: 'Ignite', burn: 1.6, dur: 4 },
  shatter: { name: 'Shatter', mul: 1.5, brk: 60 },
  galvanic: { name: 'Galvanic', share: 0.6, range: 6 },
};
export const ELEMS = ['heat', 'blunt', 'blast', 'spark'];

// today's (legacy) kits: the skills that leave a coat, and the kind of blow each skill is. New-kit records (shared/kit.js,
// fusions.js, keystones.js) carry these as tags instead ('heat', 'blunt', 'blast', 'spark'; a 'shield' move is blunt), so
// the class slices (S8-S13) only tag their moves. Section 5.8 lists who coats and who sets off.
export const SKILL_COAT = {
  c_tar: 'tar', c_tarpot: 'tar', r_tarhead: 'tar',
  c_chill: 'chill', c_frostpack: 'chill',
  c_acid: 'corrode', c_corrosive: 'corrode',
  h_sneeze: 'powder', c_quicklime: 'powder', c_kilnlime: 'powder',
};
const E = (elem, ids) => Object.fromEntries(ids.map((id) => [id, elem]));
export const SKILL_ELEM = {
  ...E('heat', ['c_fire', 'c_naphtha', 'c_thermite', 'c_carbide', 'c_volatile', 'd_hotshot', 'd_powderburn', 'h_lantern', 's_scorch']),
  ...E('blunt', ['k_bash', 'k_shieldthrow', 'k_pommel', 'k_charge', 's_ram', 's_shieldspin', 'h_sweep', 'h_flurry', 'h_uproot',
    'w_blow', 'w_slam', 'w_pound', 'w_bulwark', 'w_uppercut', 'w_toss', 'w_combo', 'w_ring', 'w_stomp', 'w_shatter', 'w_pulverize',
    'w_colossus', 'w_anvil', 'w_piledriver', 'w_triphammer', 'w_icefall', 'w_counterweight', 'w_brakeblock', 'w_spud', 'w_breakwater',
    'w_pilehammer', 'w_cribwall', 'w_split']),
  ...E('blast', ['c_concussion', 'c_shrapnel', 'c_grand', 'c_boiler', 'c_clockwork', 'c_ridgecharge', 'c_limemortar', 'r_explosive', 'd_scatter', 'd_breach', 'd_priming']),
  ...E('spark', ['c_spark', 'c_staff', 'c_chain', 'd_ricochet']),
};
// roots that are Pinned (nets, traps, chain shot): a Pinned machine takes +30% from behind
export const PIN_SKILLS = new Set(['r_pin', 'r_trap', 'h_net', 'd_chain', 'r_tether', 'r_stake']);
export const PIN = { behind: 0.3, cos: -0.25 }; // from behind = the attacker more than ~105 deg off the machine's facing

// a knockback that is stopped short by a wall, a rock face or another machine (combat_design.md 2.5, 2.6): a T3 wall slam.
//   bonus: extra damage, a share of the knocking blow; stun / stunElite: s held where it hit; pin: s Pinned after that;
//   other: the share the machine it was thrown into takes; rise: m of ground rise over the path that counts as a rock face;
//   short: the knock is "stopped" when it travels less than this share of its distance
export const WALL = { bonus: 0.2, stun: 0.8, stunElite: 0.45, pin: 0.5, other: 0.1, rise: 0.9, short: 0.6 };
// a humanoid foe knocked this far (or slammed) goes down and gets up (Knockdown, LayToIdle), held for `down` s
export const KNOCKDOWN = { dist: 2.5, down: 1.0, liftDown: 0.8 };

// a boss's readable window (section 2.6): after each big telegraphed attack of its own lands it recovers for 1.0-1.5 s
// (no swing, no new mechanic; its ability clock waits). A world boss too. Dungeon hazards it calls are not its own blow.
export const RECOVER = { min: 1.0, max: 1.5, kinds: new Set(['circles', 'nova', 'beam']) };

// the kinds of blow a skill record is (cached per record: a KIT_V2 record and each fusion is its own object)
const cache = new WeakMap();
const NONE = Object.freeze([]);
export function elemsOf(sk) {
  if (!sk || typeof sk !== 'object') return NONE;
  let e = cache.get(sk);
  if (e) return e;
  const s = new Set();
  for (const t of sk.tags || []) { if (ELEMS.includes(t)) s.add(t); else if (t === 'shield') s.add('blunt'); }
  if (SKILL_ELEM[sk.id] && !(sk.kit && sk.tags)) s.add(SKILL_ELEM[sk.id]); // (a new-kit record says it in its tags)
  e = s.size ? Object.freeze([...s]) : NONE;
  cache.set(sk, e);
  return e;
}
// the coat a skill leaves: ['coat', kind, dur?] in its fx, or the legacy table
export function coatOf(sk) {
  if (!sk) return null;
  const f = sk.fx?.find((x) => x[0] === 'coat');
  const kind = f ? f[1] : SKILL_COAT[sk.id];
  return kind && COATS[kind] ? { kind, dur: (f && f[2]) || COATS[kind].dur } : null;
}
// the Reaction a blow of these kinds sets off on a coat kind (or null)
export function reactionFor(coatKind, elems) {
  const c = COATS[coatKind];
  if (!c?.react || !elems?.length) return null;
  return elems.some((e) => c.by.includes(e)) ? c.react : null;
}
// is a Pinned machine (facing ry, sim convention: forward = (sin ry, cos ry)) struck from behind by an attacker at (sx, sz)?
export function fromBehind(m, sx, sz) {
  const dx = sx - m.x, dz = sz - m.z, d = Math.hypot(dx, dz) || 1;
  return (Math.sin(m.ry || 0) * dx + Math.cos(m.ry || 0) * dz) / d < PIN.cos;
}
