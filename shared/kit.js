// The new class kits (combat_design.md sections 3.1 and 5, stage S2): per class seven core skills and a dodge, in the same
// S() grammar as classes.js plus tags, win, tier and steps. A class plays this kit when its KIT_V2 switch is on (section
// 11); every other class keeps its 30 skills from classes.js (LEGACY_SKILLS) until its own slice (S8-S13).
// Ids that survive from today's kit keep their id, so choreo.js, cooldown slots and talents keyed by id carry over; the
// sim reads a player's compiled records (p.eff, shared/fusions.js compileKit), never SKILL_BY_ID, for a class on KIT_V2.
// Hit times match the existing choreography for now (S4 gives the authored clips, S5 the beats).
// Imports only from shared/.
import { SKILLS } from './classes.js';

// classes on the new kit. Knight first (the pilot slice); the old path goes at S16
export const KIT_V2 = { knight: true, sandblade: true, warden: true, deadeye: true, ranger: true, chemist: true, herbalist: true }; // (S8: the Sandblade's slice; S9: the Warden's; S10: the Deadeye's; S11: the Ranger's; S12: the Chemist's; S13: the Herbalist's, the last)
export const onKit2 = (cls) => !!KIT_V2[cls];

const K = (id, name, o) => ({ id, name, gcd: true, cast: 0, cost: 15, cd: 0, range: 4, target: 'enemy', kit: 2, ...o });

// the basic chain (section 2.3): steps of one skill, each its own record (contact, lock, tier); chain steps 1-2 never
// open a link, the last does. The chain resets after CHAIN_RESET s without a step
export const CHAIN_RESET = 1.2;
// the Deadeye's numbers (S10): the design's coefficients x this, tuned on deadeyetest's dummy against the Ranger
export const DE_POW = 0.7;
export const DE_SKILL = 1.2; // (the six skills over the chain, S10 tuning)
// the Ranger's numbers (S11): the design's coefficients x this, tuned on ranger11test's dummy and on realfight against the old kit
export const RA_POW = 0.95, RA_FILL = 0.5, RA_FUSE = 2.1; // (the skills x RA_POW; Quick Shot x RA_FILL of that, so the filler is not most of the damage; the fusions x RA_FUSE of it)
// the Chemist's numbers (S12): the design's coefficients x CH_POW; Acid Flask x CH_FILL of that; the fusions x CH_FUSE of it
export const CH_POW = 1.1, CH_FILL = 0.45, CH_FUSE = 2.0;
// the Herbalist's numbers (S13): damage x HB_POW (Nettle Dart x HB_FILL of that; the damage of fusions x HB_FUSE of it), every
// heal x HB_HEAL (fusion heals are the design's own numbers x HB_HEAL; they are already sized as fusions)
export const HB_POW = 0.8, HB_FILL = 0.5, HB_FUSE = 2.0, HB_HEAL = 1.08;
const chain = (base, steps) => {
  const list = steps.map((s, i) => ({ ...base, ...s, step: i + 1, steps: steps.length, fx: s.fx, win: { ...(base.win || {}), ...(s.win || {}) }, tags: [...base.tags, ...(i === steps.length - 1 ? ['finisher'] : [])] }));
  for (const s of list) s.chain = list;
  return list[0];
};

export const CORE = {
  knight: [
    chain(K('k_valiant', 'Valiant Strike', { icon: 'slash', slot: 1, lvl: 1, cost: 0, cd: 0, hit: { t: 0.34, kind: 'melee' }, tags: ['strike', 'blade', 'chain'], desc: 'A three-step chain: a diagonal cut, a return cut and a stepping overhead. Costs nothing and builds Valor.' }), [
      { fx: [['dmg', 0.8], ['brk', 4], ['res', 6]], win: { lock: 0.42 }, tier: 1 },
      { fx: [['dmg', 0.8], ['brk', 4], ['res', 6]], win: { lock: 0.42 }, tier: 1 },
      { fx: [['dmg', 1.4], ['brk', 10], ['res', 10]], win: { lock: 0.6 }, tier: 2 },
    ]),
    K('k_rising', 'Rising Cut', { icon: 'rise', slot: 2, lvl: 1, cost: 15, cd: 6, hit: { t: 0.3, kind: 'melee' }, fx: [['dmg', 1.2], ['launch', 1.0], ['brk', 20]], tags: ['strike', 'blade', 'lift'], tier: 2, desc: 'A low-to-high cut that lifts the machine off the ground.' }),
    K('k_skybreaker', 'Skybreaker', { icon: 'leap', slot: 3, lvl: 3, cost: 30, cd: 12, range: 12, hit: { t: 0.72, kind: 'aoe', r: 4 }, fx: [['leap', 9], ['dmg', 1.6], ['slow', 30, 3], ['brk', 25]], tags: ['strike', 'blade', 'leap', 'slam'], tier: 2, desc: 'Leap to the target and bring the blade down, slowing everything nearby.' }),
    K('k_bash', 'Shield Bash', { icon: 'shield', slot: 4, lvl: 5, cost: 15, cd: 8, hit: { t: 0.28, kind: 'melee' }, fx: [['dmg', 0.6], ['stun', 1.5], ['brk', 35]], tags: ['shield', 'blunt', 'cc'], tier: 2, desc: 'Drive the shield in, stunning the machine.' }),
    K('k_cleave', 'Cleaving Arc', { icon: 'arc', slot: 5, lvl: 8, cost: 20, cd: 6, hit: { t: 0.4, kind: 'cone', r: 4.5, cone: 160 }, fx: [['dmg', 0.9], ['brk', 12]], tags: ['strike', 'blade', 'sweep'], tier: 2, desc: 'A broad sweep that strikes every machine in front.' }),
    K('k_lunge', 'Lunge', { icon: 'thrust', slot: 6, lvl: 11, cost: 15, cd: 9, range: 10, hit: { t: 0.32, kind: 'melee' }, fx: [['dash', 7], ['dmg', 1.2], ['brk', 15]], tags: ['strike', 'blade', 'dash'], tier: 2, desc: 'Close 7 m with a piercing thrust.' }),
    K('k_guard', 'Guard', { icon: 'stance', slot: 7, lvl: 14, cost: 10, cd: 10, target: 'self', range: 0, hit: { t: 0.3, kind: 'self' }, fx: [['buff', 'armor', 60, 1.0], ['parry', 0.25]], tags: ['shield', 'guard'], tier: 2, desc: 'Shield up for 1 s, taking 60% less. A blow in the first 0.25 s is parried: the attacker staggers and you gain 20 Valor.' }),
  ],
  // the Sandblade (combat_design.md 5.3, S8): the fastest blade, the shortest locks (0.42 s chain steps) and the most cancels.
  // Hit times match the clips (choreo.js: the chain has a clip per step, s_slash_2..4; the rest keep their ids' clips)
  sandblade: [
    chain(K('s_slash', 'Sand Slash', { icon: 'slash', slot: 1, lvl: 1, cost: 0, cd: 0, hit: { t: 0.22, kind: 'melee' }, tags: ['strike', 'blade', 'chain'], desc: 'A four-step chain: a flat forehand, a backhand, a jab with the shield rim and a stepping cut. Costs nothing and builds Energy.' }), [
      { fx: [['dmg', 0.96], ['brk', 3], ['res', 5]], win: { lock: 0.42 }, tier: 1 },
      { hit: { t: 0.2, kind: 'melee' }, fx: [['dmg', 0.96], ['brk', 3], ['res', 5]], win: { lock: 0.42 }, tier: 1 },
      { hit: { t: 0.18, kind: 'melee' }, fx: [['dmg', 0.96], ['brk', 3], ['res', 5]], win: { lock: 0.42 }, tier: 1, rim: true },
      { hit: { t: 0.3, kind: 'melee' }, fx: [['dmg', 1.8], ['brk', 8], ['res', 8]], win: { lock: 0.55 }, tier: 2 },
    ]),
    K('s_whirl', 'Whirling Scimitar', { icon: 'spin', slot: 2, lvl: 1, cost: 20, cd: 6, target: 'self', range: 0, hit: { t: 0.25, kind: 'aoe', r: 4, n: 2, gap: 0.3 }, fx: [['dmg', 0.78], ['brk', 6]], tags: ['strike', 'blade', 'spin', 'sweep'], tier: 2, desc: 'Spin twice with the blade held out, cutting everything around you.' }),
    K('s_leap', 'Dune Leap', { icon: 'leap', slot: 3, lvl: 3, cost: 25, cd: 10, range: 12, hit: { t: 0.62, kind: 'aoe', r: 3 }, fx: [['leap', 9], ['dmg', 2.04], ['brk', 15]], tags: ['strike', 'blade', 'leap', 'slam', 'sand'], tier: 2, desc: 'Bound up to 9 m and land cutting, throwing sand round the landing.' }),
    K('s_step', 'Desert Step', { icon: 'step', slot: 4, lvl: 5, cost: 10, cd: 10, charges: 2, range: 8, hit: { t: 0.18, kind: 'melee' }, fx: [['unseen', 2], ['dash', 6], ['dmg', 0.78], ['brk', 6]], tags: ['dash', 'sand', 'blade'], tier: 2, desc: 'A 6 m blur of sand that ends behind the machine with a cut. Two charges. Arriving behind one that is not fighting you gives Opening.' }),
    K('s_dust', 'Dust Kick', { icon: 'kick', slot: 5, lvl: 8, cost: 15, cd: 9, hit: { t: 0.28, kind: 'cone', r: 5, cone: 70 }, fx: [['dmg', 0.78], ['debuff', 'miss', 40, 3], ['brk', 15]], tags: ['sand', 'cc', 'blunt'], tier: 2, desc: 'Kick a cone of sand 5 m into the joints and vents of the machines in front: their swings miss 40% of the time for 3 s.' }),
    K('s_needle', 'Needle Thrust', { icon: 'thrust', slot: 6, lvl: 11, cost: 15, cd: 7, hit: { t: 0.24, kind: 'melee' }, fx: [['dmg', 2.34], ['dot', 0.8, 6], ['brk', 12]], critAdd: 0.3, behindMul: 1.5, tags: ['strike', 'blade'], tier: 2, desc: 'A precise thrust at a seam: 30% more likely to strike critically, 50% harder from behind, and it bleeds for 6 s.' }),
    K('s_counter', 'Counter Stance', { icon: 'parry', slot: 7, lvl: 14, cost: 10, cd: 12, target: 'self', range: 0, hit: { t: 0.15, kind: 'self' }, fx: [['parry', 1.0], ['counter', 2.5], ['buff', 'evade', 50, 1.5]], tags: ['guard', 'blade'], tier: 2, desc: 'Hold a low stance for 1 s. The first blow that comes is turned aside on the shield: the machine staggers and you slip aside and cut back (2.5x). For 1.5 s other blows land only half the time.' }),
  ],
  // the Warden (combat_design.md 5.2, S9): the slowest, heaviest swings (0.55-0.7 s chain locks), the ground is his weapon.
  // Hit times match the clips (choreo.js: the chain has a clip per step, w_blow_2..3 on Sword_Heavy_Combo's three swings;
  // Ground Pound on Hammer_Overhead). Every slam is a 'slam' (Aftershock repeats it), every hammer strike a 'hammer'
  warden: [
    chain(K('w_blow', 'Hammer Blow', { icon: 'hammer', slot: 1, lvl: 1, cost: 0, cd: 0, hit: { t: 0.42, kind: 'melee' }, tags: ['strike', 'blunt', 'hammer', 'chain'], desc: 'A three-step chain: a flat swing from the side, a backhand and an overhead. Costs nothing.' }), [
      { fx: [['dmg', 1.22], ['brk', 6]], win: { lock: 0.55 }, tier: 1 },
      { hit: { t: 0.42, kind: 'melee' }, fx: [['dmg', 1.22], ['brk', 6]], win: { lock: 0.55 }, tier: 1 },
      { hit: { t: 0.5, kind: 'melee' }, fx: [['dmg', 1.95], ['brk', 16]], win: { lock: 0.7 }, tier: 2 },
    ]),
    K('w_uppercut', 'Uppercut Smash', { icon: 'rise', slot: 2, lvl: 1, cost: 15, cd: 7, hit: { t: 0.38, kind: 'melee' }, fx: [['dmg', 1.46], ['launch', 1.1], ['brk', 25]], tags: ['strike', 'blunt', 'hammer', 'lift'], tier: 2, desc: 'The hammer brought up from the ground through the machine, lifting it into the air.' }),
    K('w_pound', 'Ground Pound', { icon: 'pound', slot: 3, lvl: 3, cost: 20, cd: 8, target: 'self', range: 0, hit: { t: 0.43, kind: 'aoe', r: 5 }, fx: [['dmg', 1.34], ['slow', 40, 3], ['brk', 18]], tags: ['strike', 'blunt', 'hammer', 'slam', 'earth'], tier: 2, desc: 'Drive the hammer into the ground: everything within 5 m is struck and slowed 40% for 3 s.' }),
    K('w_slam', 'Shield Slam', { icon: 'shield', slot: 4, lvl: 5, cost: 15, cd: 8, hit: { t: 0.32, kind: 'melee' }, fx: [['dmg', 0.97], ['stun', 1.2], ['taunt', 2], ['brk', 30]], tags: ['shield', 'blunt', 'cc', 'taunt'], tier: 2, desc: 'Drive the tower shield in: the machine is stunned and turns on you.' }),
    K('w_bulwark', 'Bulwark Charge', { icon: 'charge', slot: 5, lvl: 8, cost: 20, cd: 14, range: 14, hit: { t: 0.5, kind: 'melee' }, fx: [['dash', 12], ['dmg', 1.22], ['knock', 2], ['brk', 25]], tags: ['shield', 'blunt', 'dash', 'charge'], tier: 2, desc: 'Charge up to 12 m behind the tower shield and knock the machine back.' }),
    K('w_split', 'Earthsplitter', { icon: 'fissure', slot: 6, lvl: 11, cost: 25, cd: 10, range: 12, hit: { t: 0.7, kind: 'line', r: 12 }, fx: [['dmg', 1.58], ['root', 1.5], ['brk', 20]], tags: ['strike', 'blunt', 'hammer', 'earth', 'fissure'], tier: 2, desc: 'Split the ground: a fissure runs 12 m ahead and holds every machine on it fast for 1.5 s.' }),
    K('w_challenge', 'Challenge', { icon: 'shout', slot: 7, lvl: 14, cost: 10, cd: 12, target: 'self', range: 0, hit: { t: 0.32, kind: 'aoe', r: 10 }, fx: [['taunt', 4], ['selfBuff', 'armor', 20, 6]], tags: ['shield', 'taunt', 'guard'], tier: 2, desc: 'One heavy hammer strike on the shield rim: every machine within 10 m turns on you, and your armour is 20% thicker for 6 s.' }),
  ],
  // the Deadeye (combat_design.md 5.5, S10): gun-kata in a long road coat. Every skill fires on the run (move: true: moving
  // never interrupts it, and the client plays the shot on the upper body over the running legs), the locks are the shortest
  // of any class (0.4 s chain steps) and a dodge cuts a shot's wind-up by firing it at once (sim.js on_dodge). Every shot is
  // a 'shot' (Bank Shot skips it, Six Chambers counts it). Hit times match the clips (choreo.js S10: d_snap..d_snap_3, the
  // twin shots on Pistols_Twin_Shoot, Recoil Jump on Leap_Rise into Backflip). Numbers x DE_POW (tuned on deadeyetest's dummy
  // against the Ranger and on realfight)
  deadeye: (() => {
    const P = DE_POW, d = (v) => +(v * P).toFixed(3), e = (v) => d(v * DE_SKILL);
    return [
      chain(K('d_snap', 'Snap Shot', { icon: 'arrow', slot: 1, lvl: 1, cost: 0, cd: 0, range: 22, move: true, hit: { t: 0.2, kind: 'proj', speed: 70 }, tags: ['shot', 'chain'], desc: 'A three-step chain of quick shots fired on the run: the right pistol, the left, then both together. Costs nothing and builds Powder.' }), [
        { fx: [['dmg', d(0.42)], ['brk', 2], ['res', 4]], win: { lock: 0.4 }, tier: 1, side: 'R' },
        { fx: [['dmg', d(0.42)], ['brk', 2], ['res', 4]], win: { lock: 0.4 }, tier: 1, side: 'L' },
        { hit: { t: 0.22, kind: 'proj', speed: 70 }, fx: [['dmg', d(0.8)], ['brk', 6], ['res', 8]], win: { lock: 0.5 }, tier: 2, side: 'B' }, // (the chain at 0.42/0.42/0.8 of the design's 0.55/0.55/1.0 and the skills x1.2: the filler alone was over half the damage and its chain order swung a fight by 25%)
      ]),
      K('d_pair', 'Paired Shot', { icon: 'twinarrow', slot: 2, lvl: 1, cost: 15, cd: 6, range: 22, move: true, hit: { t: 0.24, kind: 'proj', speed: 70 }, fx: [['dmg', e(1.2)], ['knock', 1.5], ['brk', 15]], tags: ['shot', 'blast'], tier: 2, desc: 'Both pistols up level and fired as one: the machine is thrown back a step.' }),
      K('d_recoil', 'Recoil Jump', { icon: 'backflip', slot: 3, lvl: 3, cost: 10, cd: 12, target: 'self', range: 0, move: true, selfDone: true, hit: { t: 0.12, kind: 'aoe', r: 2 }, fx: [['back', 7], ['dmg', e(0.6)], ['knock', 1.5], ['brk', 10]], tags: ['shot', 'blast', 'jump'], tier: 2, desc: 'Fire both pistols into the ground at your feet: the kick throws you up and back 7 m in a backflip, and the blast knocks back what stood there.' }),
      K('d_knee', 'Knee Shot', { icon: 'cripple', slot: 4, lvl: 5, cost: 12, cd: 8, range: 22, move: true, bash: true, hit: { t: 0.22, kind: 'proj', speed: 70 }, fx: [['dmg', e(0.9)], ['slow', 50, 4], ['brk', 12]], tags: ['shot'], tier: 2, desc: 'A low shot at a leg joint: the machine staggers and is slowed 50% for 4 s.' }),
      K('d_scatter', 'Scatter Charge', { icon: 'fan', slot: 5, lvl: 8, cost: 20, cd: 8, range: 11, move: true, hit: { t: 0.3, kind: 'cone', r: 10, cone: 50 }, fx: [['dmg', e(1.1)], ['knock', 3], ['brk', 18]], tags: ['shot', 'blast'], tier: 2, desc: 'Both pistols loaded with loose shot and fired from the hip on a step back: every machine in a 10 m cone is thrown back.' }),
      K('d_fan', 'Fan the Hammer', { icon: 'barrage', slot: 6, lvl: 11, cost: 25, cd: 10, range: 18, move: true, hit: { t: 0.16, kind: 'proj', speed: 70, n: 6, ts: [0.16, 0.25, 0.37, 0.45, 0.57, 0.66] }, fx: [['dmg', e(0.4)], ['brk', 3]], tags: ['shot'], tier: 2, desc: 'The left palm works the hammer: six fast shots from the right pistol, never quite on a beat.' }),
      K('d_quick', 'Quickdraw', { icon: 'aim', slot: 7, lvl: 14, cost: 12, cd: 10, gcd: false, range: 22, move: true, sureLand: true, hit: { t: 0.12, kind: 'proj', speed: 80 }, fx: [['dmg', e(1.0)], ['brk', 8]], tags: ['shot'], tier: 2, desc: 'Holster to shot faster than the eye can follow. It ignores the recovery of your last skill, and as the first of two it always counts as landed.' }),
    ];
  })(),
  // the Ranger (combat_design_fusion.md 4.2 and combat_design.md 5.4, S11): never where the arrows came from. Quick Shot and
  // Marked Target fire on the run (move: true: the upper body over the running legs); Piercing Arrow is drawn and held
  // (draw: a press draws to full in 1.0 s and looses; held, it looses on the release, 0.3 s at the least, 2.5 s at the
  // most, its power from 0.58 at the shortest to 1 at full); Volley and Thousand Arrows rain on the machine; Snare Trap is
  // thrown and stays on the ground as a trap (sim.js traps); Disengage is a backflip with a shot at the nearest machine.
  // Every arrow is an 'arrow' (Never Still counts the bow skills). Ids keep the old kit's, so its clips carry over
  ranger: (() => {
    const P = RA_POW, d = (v) => +(v * P).toFixed(3), q = (v) => d(v * RA_FILL);
    return [
      chain(K('r_quick', 'Quick Shot', { icon: 'arrow', slot: 1, lvl: 1, cost: 0, cd: 0, range: 28, move: true, hit: { t: 0.26, kind: 'proj', speed: 60 }, tags: ['shot', 'arrow', 'chain'], desc: 'A three-step chain of quick shots loosed on the run: two fast arrows, then Twin Arrows, two on the string at once. Costs nothing and builds Focus.' }), [
        { fx: [['dmg', q(0.6)], ['brk', 2], ['res', 5]], win: { lock: 0.45 }, tier: 1 },
        { fx: [['dmg', q(0.6)], ['brk', 2], ['res', 5]], win: { lock: 0.45 }, tier: 1 },
        { hit: { t: 0.3, kind: 'proj', speed: 60, n: 2, gap: 0.08 }, fx: [['dmg', q(0.55)], ['brk', 4], ['res', 4]], win: { lock: 0.55 }, tier: 2, twin: true },
      ]),
      K('r_disengage', 'Disengage', { icon: 'backflip', slot: 2, lvl: 1, cost: 10, cd: 10, target: 'self', range: 0, nearest: 24, selfDone: true, hit: { t: 0.3, kind: 'proj', speed: 60 }, fx: [['back', 8], ['dmg', d(0.8)], ['brk', 8]], tags: ['arrow', 'shot', 'jump'], tier: 2, desc: 'Backflip 8 m away and loose an arrow at the nearest machine from the top of the flip.' }),
      K('r_volley', 'Volley', { icon: 'rain', slot: 3, lvl: 3, cost: 20, cd: 8, range: 26, move: true, hit: { t: 0.7, kind: 'aoe', at: 'target', r: 5, n: 3, ts: [0.7, 0.86, 1.0] }, fx: [['dmg', d(0.6)], ['slow', 30, 3], ['brk', 6]], tags: ['arrow', 'rain'], tier: 2, desc: 'Loose a dozen arrows high: they come down on the machine in three waves over 5 m, slowing everything there 30%.' }),
      K('r_trap', 'Snare Trap', { icon: 'trap', slot: 4, lvl: 5, cost: 15, cd: 12, range: 12, noTarget: true, selfDone: true, hit: { t: 0.5, kind: 'aoe', at: 'target', r: 1.8 }, fx: [['trap', 3, 20], ['dmg', d(0.4)], ['brk', 10]], tags: ['trap', 'throw'], tier: 2, desc: 'Throw a spring snare of rope and a wooden bar up to 12 m: it closes on the machine it lands by (Pinned 3 s), or lies armed for 20 s and closes on the first that steps in.' }),
      K('r_pierce', 'Piercing Arrow', { icon: 'pierce', slot: 5, lvl: 8, cost: 20, cd: 7, range: 30, draw: { min: 0.3, full: 1.0, max: 2.5, lo: 0.58 }, hit: { t: 1.04, kind: 'line', r: 30 }, fx: [['dmg', d(2.4)], ['brk', 30]], tags: ['shot', 'arrow', 'pierce'], tier: 3, desc: 'Draw and hold: the arrow goes through every machine on a 30 m line. A press draws to full (2.4x) and looses; held, it looses when you let go (from 0.3 s, 1.4x) or at 2.5 s.' }),
      K('r_mark', 'Marked Target', { icon: 'mark', slot: 6, lvl: 11, cost: 10, cd: 16, range: 35, move: true, hit: { t: 0.3, kind: 'proj', speed: 70 }, fx: [['debuff', 'vuln', 10, 12]], tags: ['shot', 'arrow', 'mark'], tier: 1, desc: 'A blunt arrow packed with chalk dye bursts on the plate: the machine is Marked for 12 s and takes 10% more from you.' }),
      K('r_thousand', 'Thousand Arrows', { icon: 'storm', slot: 7, lvl: 14, cost: 40, cd: 40, range: 24, hit: { t: 0.6, kind: 'aoe', at: 'target', r: 8, n: 18, gap: 0.14 }, fx: [['dmg', d(0.2)], ['slow', 30, 2], ['brk', 3]], tags: ['arrow', 'rain'], tier: 2, desc: 'Loose arrow after arrow high over the machine: 3 s of rain, eighteen waves over 8 m.' }),
    ];
  })(),
  // the Chemist (combat_design_fusion.md 4.3 and combat_design.md 5.6, S12): sets up the board, then lights it. Acid Flask's
  // chain and Tar Pot coat the machines (Corroded, Tarred), Tar Pot leaves a puddle (sim.js zones), Spark Gear's hot arc sets
  // Tarred machines alight and jumps between Corroded ones, Volatile Mixture and Grand Detonation are bombs that lie on the
  // ground and burst when their fuse burns out (fuse: s after the landing contact; sim.js p.bombs), Chill Powder is a cone of
  // cold-pack salts (Chilled), Rod Vault a pole vault back. Every throw is a 'throw' (thrown on the run: move), every bomb a
  // 'bomb' and a 'blast'. Ids keep the old kit's, so its clips and talents carry over. Signature: Tar Pot > Spark Gear
  chemist: (() => {
    const P = CH_POW, d = (v) => +(v * P).toFixed(3), q = (v) => d(v * CH_FILL);
    return [
      chain(K('c_acid', 'Acid Flask', { icon: 'acid', slot: 1, lvl: 1, cost: 0, cd: 0, range: 22, move: true, hit: { t: 0.42, kind: 'proj', speed: 26, arc: 0.6 }, tags: ['throw', 'acid', 'chain'], desc: 'A three-step chain of acid flasks thrown on the run, the third a heavier one that splashes 2.5 m. Each flask leaves a Corroded stack on what it strikes (armour 3% thinner a stack, up to five). Costs nothing and builds Reagents.' }), [
        { fx: [['dmg', q(0.9)], ['coat', 'corrode', 8], ['brk', 3], ['res', 5]], win: { lock: 0.5 }, tier: 1 },
        { fx: [['dmg', q(0.9)], ['coat', 'corrode', 8], ['brk', 3], ['res', 5]], win: { lock: 0.5 }, tier: 1 },
        { hit: { t: 0.46, kind: 'proj', speed: 26, arc: 0.7, r: 2.5 }, fx: [['dmg', q(1.3)], ['coat', 'corrode', 8], ['brk', 8], ['res', 6]], win: { lock: 0.6 }, tier: 2 },
      ]),
      K('c_tar', 'Tar Pot', { icon: 'tar', slot: 2, lvl: 1, cost: 15, cd: 12, range: 20, hit: { t: 0.6, kind: 'aoe', at: 'target', r: 3 }, fx: [['dmg', d(0.6)], ['coat', 'tar', 8], ['zone', 'tar', 0, 8, 4], ['brk', 8]], zoneSlow: 50, tags: ['throw', 'puddle'], tier: 2, desc: 'Swing an iron pot of pine tar underarm: it bursts on the machine in a 4 m black puddle that lies 8 s. Machines in it are slowed by half and Tarred (any heat sets them alight).' }),
      K('c_spark', 'Spark Gear', { icon: 'spark', slot: 3, lvl: 3, cost: 18, cd: 7, range: 14, hit: { t: 0.36, kind: 'proj', speed: 80 }, fx: [['dmg', d(1.1)], ['arc', 2, 6, 0.6], ['brk', 12]], tags: ['spark', 'heat', 'rod'], tier: 2, desc: 'Spin the toothed gear on the rod against its flint: a hot spark arc leaps to the machine and on to two more within 6 m (60%). The sparks set Tarred machines alight and jump between Corroded ones.' }),
      K('c_volatile', 'Volatile Mixture', { icon: 'volatile', slot: 4, lvl: 5, cost: 20, cd: 8, range: 22, fuse: 1.2, hit: { t: 0.5, kind: 'aoe', at: 'spot', r: 5 }, fx: [['dmg', d(2.2)], ['launch', 0.8], ['brk', 25]], tags: ['throw', 'blast', 'bomb'], tier: 3, desc: 'Shake a flask until it hisses and throw it where the machine stands: it lies on the ground, and 1.2 s later it bursts. Everything within 5 m is struck and the small machines are thrown up.' }),
      K('c_chill', 'Chill Powder', { icon: 'frost', slot: 5, lvl: 8, cost: 15, cd: 10, range: 10, hit: { t: 0.36, kind: 'cone', r: 10, cone: 70 }, fx: [['dmg', d(0.7)], ['coat', 'chill', 5], ['brk', 10]], tags: ['powder', 'cold'], tier: 2, desc: 'Thrust the rod and blow a cone of cold-pack salts 10 m ahead: every machine in it is Chilled for 5 s (slowed 40%; a heavy blow or a blast shatters the frost).' }),
      K('c_vault', 'Rod Vault', { icon: 'vault', slot: 6, lvl: 11, cost: 10, cd: 14, target: 'self', range: 0, selfDone: true, hit: { t: 0.2, kind: 'self' }, fx: [['back', 9], ['smokeAt', 3, 20, 3]], tags: ['vault', 'jump'], tier: 2, desc: 'Plant the rod and vault 9 m back, leaving a puff of smoke where you stood: machines in it miss 20% of their swings for 3 s.' }),
      K('c_grand', 'Grand Detonation', { icon: 'cask', slot: 7, lvl: 14, cost: 40, cd: 40, range: 24, fuse: 2.0, hit: { t: 0.62, kind: 'aoe', at: 'spot', r: 8 }, fx: [['dmg', d(4.4)], ['launch', 1.0], ['brk', 60]], tags: ['throw', 'blast', 'bomb'], tier: 4, desc: 'Heave an iron cask of blasting powder underarm with both hands: it rolls to a stop where the machine stood, its fuse burns 2 s, and it bursts over 8 m, throwing the machines up.' }),
    ];
  })(),
  // the Herbalist (combat_design_fusion.md 4.6 and combat_design.md 5.7, S13): keeps the group up, and is not harmless. Nettle
  // Dart is a chain blown on the run from the staff's hollow haft (each dart that strikes stores Sap, which the next heal
  // spends), Soothing Salve a kneaded jar tossed to an ally (1.2 s), Mending Poultice a heal over time, Snare Net a weighted
  // net (Pinned), Calming Smoke a smouldering pot that lies as a herb zone (sim.js herbZone: allies mend, machines strike
  // softer), Lantern Flash the kettle-lantern's shutter opened (a soft round flare: no beams), Grand Remedy a draught and the
  // staff planted. Every remedy is a 'remedy', every heal a 'heal'. Ids keep the old kit's, so its talents carry over
  herbalist: (() => {
    const P = HB_POW, d = (v) => +(v * P).toFixed(3), q = (v) => d(v * HB_FILL), h = (v) => +(v * HB_HEAL).toFixed(3);
    return [
      chain(K('h_dart', 'Nettle Dart', { icon: 'dart', slot: 1, lvl: 1, cost: 0, cd: 0, range: 24, move: true, hit: { t: 0.26, kind: 'proj', speed: 40 }, tags: ['dart', 'shot', 'chain'], desc: 'A three-step chain of nettle darts blown on the run from the hollow haft of the staff, the third two at once. Each dart that strikes stores a drop of Sap (up to five); your next heal spends them, 8% stronger for each. Costs nothing and builds Herbs.' }), [
        { fx: [['dmg', q(0.8)], ['sap', 1], ['brk', 2], ['res', 5]], win: { lock: 0.5 }, tier: 1 },
        { fx: [['dmg', q(0.8)], ['sap', 1], ['brk', 2], ['res', 5]], win: { lock: 0.5 }, tier: 1 },
        { hit: { t: 0.3, kind: 'proj', speed: 40, n: 2, gap: 0.08 }, fx: [['dmg', q(0.6)], ['sap', 1], ['brk', 4], ['res', 4]], win: { lock: 0.6 }, tier: 2, twin: true },
      ]),
      K('h_salve', 'Soothing Salve', { icon: 'salve', slot: 2, lvl: 1, cost: 15, cd: 0, cast: 1.2, target: 'ally', range: 28, hit: { t: 1.3, kind: 'proj', speed: 22, arc: 0.5 }, fx: [['heal', h(2.2)]], tags: ['throw', 'remedy', 'heal'], tier: 2, desc: 'Knead a jar of salve for 1.2 s and toss it to an ally (or yourself): it bursts in a soft green splash and mends 2.2.' }),
      K('h_poultice', 'Mending Poultice', { icon: 'leaf', slot: 3, lvl: 3, cost: 15, cd: 6, target: 'ally', range: 28, hit: { t: 0.45, kind: 'proj', speed: 24, arc: 0.5 }, fx: [['hot', h(3.0), 12]], tags: ['throw', 'remedy', 'heal', 'hot'], tier: 2, desc: 'Toss a warm poultice of bruised leaves bound in linen to an ally: it mends 3.0 over 12 s.' }),
      K('h_net', 'Snare Net', { icon: 'net', slot: 4, lvl: 5, cost: 15, cd: 14, range: 16, hit: { t: 0.5, kind: 'proj', speed: 18, arc: 0.4 }, fx: [['dmg', d(0.3)], ['pin', 3], ['brk', 15]], tags: ['throw', 'net', 'cc'], tier: 2, desc: 'Throw a weighted net with a square weave over the machine: it is held fast for 3 s (Pinned: 30% more from behind).' }),
      K('h_smoke', 'Calming Smoke', { icon: 'smoke', slot: 5, lvl: 8, cost: 20, cd: 16, target: 'ally', range: 20, hit: { t: 0.6, kind: 'aoe', at: 'target', r: 6 }, fx: [['hzone', 'smoke', h(0.4), 8, 6]], zoneWeak: 15, tags: ['throw', 'smoke', 'heal', 'zone'], tier: 2, desc: 'Swing a clay pot of smouldering herbs underarm to an ally\'s feet (or your own): a low smoke lies over 6 m for 8 s. Allies in it mend 0.4 a second; machines in it strike 15% softer.' }),
      K('h_lantern', 'Lantern Flash', { icon: 'lantern', slot: 6, lvl: 11, cost: 15, cd: 18, target: 'self', range: 0, selfDone: true, hit: { t: 0.45, kind: 'cone', r: 10, cone: 70 }, fx: [['stagger', 1.0], ['debuff', 'miss', 40, 2], ['cleanseOne', 10], ['brk', 25]], tags: ['lantern', 'cc'], tier: 2, desc: 'Open the shutter of the kettle-lantern at the machines: a soft round flare of the oil flame over a 10 m cone. They stagger and their swings miss 40% for 2 s, and every ally within 10 m loses one harmful effect.' }),
      K('h_remedy', 'Grand Remedy', { icon: 'remedy', slot: 7, lvl: 14, cost: 40, cd: 50, cast: 0.6, target: 'self', range: 0, hit: { t: 0.75, kind: 'self', r: 15 }, fx: [['heal', h(4.0)]], tags: ['remedy', 'heal', 'plant'], tier: 3, desc: 'Drink a bitter draught, then plant the staff and let the kettle loose its steam: every ally within 15 m mends 4.0.' }),
    ];
  })(),
};
// the dodge (feel.js DODGE does the move): it counts as an input, and always as landed (gate 'dodge')
export const DODGES = { knight: { id: 'dodge', name: 'Shoulder Roll', icon: 'evade', tags: ['dash'] }, sandblade: { id: 'dodge', name: 'Sidestep', icon: 'evade', tags: ['dash'] }, warden: { id: 'dodge', name: 'Brace', icon: 'shield', tags: ['guard', 'shield'] }, deadeye: { id: 'dodge', name: 'Slide', icon: 'evade', tags: ['dash', 'slide'] }, ranger: { id: 'dodge', name: 'Tumble', icon: 'evade', tags: ['dash', 'roll'] }, chemist: { id: 'dodge', name: 'Side Hop', icon: 'evade', tags: ['dash', 'hop'] }, herbalist: { id: 'dodge', name: 'Staff Hop', icon: 'evade', tags: ['dash', 'hop', 'vault'] } }; // (S13: the Herbalist's short vault on the staff) // (S12: the Chemist's short hop, a puff of smoke left behind) // (S11: the Ranger's roll keeps the arrow nocked: the Quick Shot chain goes on) // (S10: the Deadeye's knee slide; with Snap Shot held it fires out of it) // (S9: the Warden does not move: he braces behind the tower shield)
export const PARRY = { res: 20, stagger: 1.2 }; // a parry: Valor back and the attacker Staggered

export const CORE_BY_ID = {};
for (const [cls, list] of Object.entries(CORE)) for (const s of list) { for (const r of s.chain || [s]) r.cls = cls; CORE_BY_ID[s.id] = s; }

// the bar of a class: the new kit when its switch is on, else the 30 legacy skills
export const kitOf = (cls) => (KIT_V2[cls] ? CORE[cls] : SKILLS[cls]) || [];
export const kitForLevel = (cls, level) => kitOf(cls).filter((s) => s.lvl <= level);
// a chain skill's record for a step (1-based); any other skill is itself
export const stepOf = (sk, step) => (sk?.chain ? sk.chain[Math.max(0, Math.min(sk.chain.length, step) - 1)] : sk);
