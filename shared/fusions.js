// Fusions (combat_design.md sections 3 and 5, stage S2): when skill A lands, a link window opens; skill B pressed in it
// casts the fusion A>B, a new named move with its own rules. Fusions and triads are ordinary skill records with from, to,
// need, lvl or tree, carry, ai and tier. FUSE[cls]['a>b'] finds one. compileKit(p) builds p.eff (every skill a player can
// cast, by id) and p.effFuse (its fusions by pair); the sim, the bar, tooltips and bots read those, not SKILL_BY_ID.
// Choreography: each fusion names its clip (choreo); S4 gave Stormfall, Battering Line, Turning Riposte, Sidewind Cut and
// Anvil Fall their own DEFs on the authored hero clips (client/game/choreo.js, 'ual'); the rest still name an existing one.
// Imports only from shared/.
import { SKILLS, SKILL_BY_ID } from './classes.js';
import { KIT_V2, CORE, CORE_BY_ID, DODGES } from './kit.js';

export const LINK = { win: 1.0, afterLock: 0.25, tick: 0.05, grace: 0.15 }; // window from contact; never shorter than the lock + 0.25 s; one tick of grace; 0.15 s for a claimed chain
export const MASTERY = [25, 100, 300]; // landed uses for ranks I, II, III (a Book badge; III adds the extra beat)
export const DISCOVER_XP = 0.05; // of a level, for the first cast of a fusion
export const DUEL_FUSE = 0.8; // fusion damage on a player in a duel, on top of DUEL.scale (combat_design.md section 8)

// power (section 9, adversarial review 18 Nov): a fusion and its A together deal about 1.35x A + B cast plain, the aerial
// bonus counted on a lifted machine (Stormfall 2.3 x air 1.4, High Ledger 3 x 0.5 x 1.5). The first numbers (Stormfall
// 3.0, High Ledger 3 x 0.9, Kingsfall 3 x 1.4) left --nofusion at 57-65% of full damage against the 75-85% target
const F = (id, name, o) => ({ id, name, gcd: true, cast: 0, cost: 0, cd: 0, range: 4, target: 'enemy', kit: 2, extra: 0, tier: 4, ...o });

// gate words for the Book ('Rising Cut must lift the foe'); a fusion may say its own
export const GATES = {
  hit: (a) => `${a} must strike a machine`,
  done: (a) => `${a} must take effect`,
  parry: (a) => `${a} must parry a blow`,
  dodge: () => 'Come out of a dodge',
  block: () => 'Block a blow in the dodge', // (S9 Breakwater: a perfect Brace)
  'state:lifted': (a) => `${a} must leave the machine in the air`,
  'state:staggered': (a) => `${a} must stagger or stun the machine`,
};

export const FUSIONS = {
  knight: [
    F('kf_stormfall', 'Stormfall', { cls: 'knight', icon: 'leap', from: 'k_rising', to: 'k_skybreaker', lvl: 5, need: 'hit', cd: 14, extra: 10, range: 9,
      hit: { t: 0.72, kind: 'aoe', r: 4.5 }, fx: [['leap', 6], ['dmg', 2.3], ['air', 1.4], ['slamDown', 0.6], ['brk', 60], ['slow', 40, 3]], // (S5: the plunge slams the machine down, a 0.3 m bounce, and it lies stunned 0.6 s; it no longer hangs 1.4 s over the crater)
      tags: ['air', 'slam', 'fusion'], cam: 'lift', choreo: 'kf_stormfall', gateText: 'Rising Cut must lift the foe', hint: 'Something rises, then something falls.',
      carry: { a: { aloft: { hang: 0.3, airMul: 0.25 }, gale: { allLifted: true } }, b: { higharc: { leap: 10, r: 1.3 } } }, ai: { role: 'burst', want: { state: 'lifted' } },
      desc: 'Vault straight up past the lifted machine, hang at the top and drive down through it into the ground.' }),
    F('kf_highledger', 'High Ledger', { cls: 'knight', icon: 'twin', from: 'k_rising', to: 'k_valiant', lvl: 7, need: 'state:lifted', cd: 10, extra: 10,
      hit: { t: 0.24, kind: 'melee', n: 3, gap: 0.26 }, fx: [['dmg', 0.5], ['air', 1.5], ['brk', 8], ['holdLift', 0.35]], fxLast: [['holdLift', 0.6]], tiers: [1, 1, 3], // (each cut keeps the machine up, review 18 Nov: Rising Cut's 1.0 s lift ran out before the third; S5: three T1 sparks, then a T3 with the camera kicked up, no slam)
      tags: ['air', 'fusion'], choreo: 'kf_highledger', hint: 'What is in the air can be cut again.', ai: { role: 'burst', want: { state: 'lifted' } },
      desc: 'Follow the machine up with three cuts in the air; the last keeps it aloft.' }),
    F('kf_kingsfall', 'Kingsfall', { cls: 'knight', icon: 'crown', from: 'k_cleave', to: 'k_skybreaker', lvl: 9, need: 'hit', cd: 16, extra: 10, range: 10,
      hit: { t: 0.32, kind: 'aoe', r: 5, n: 3, gap: 0.42 }, fx: [['dmg', 0.85], ['brk', 12]], fxLast: [['brk', 50], ['knock', 2]], tiers: [2, 2, 4], // (S5: cut 1 T2, cut 2 T2, the slam T4)
      tags: ['leap', 'slam', 'fusion'], choreo: 'kf_kingsfall', hint: 'A wide cut, then come down on what is left.', ai: { role: 'aoe' },
      desc: 'Two wide cuts, then a leaping slam on the shield rim that knocks machines back.' }),
    F('kf_pierce', 'Pierce the Line', { cls: 'knight', icon: 'thrust', from: 'k_valiant', to: 'k_lunge', lvl: 11, need: 'hit', step: 3, cd: 12, extra: 5, range: 10,
      hit: { t: 0.32, kind: 'line', r: 9 }, fx: [['dash', 7], ['dmg', 1.8], ['debuff', 'armor', 20, 8], ['brk', 15]],
      tags: ['line', 'fusion'], choreo: 'kf_pierce', gateText: 'The third step of Valiant Strike must land', hint: 'Finish the chain, then go through them.', ai: { role: 'line' },
      desc: 'A thrust through every machine on a 9 m line, opening their plating; you end behind them.' }),
    F('kf_battering', 'Battering Line', { cls: 'knight', icon: 'charge', from: 'k_lunge', to: 'k_bash', lvl: 13, need: 'hit', cd: 14, extra: 5,
      hit: { t: 0.28, kind: 'melee' }, fx: [['dash', 3], ['dmg', 1.3], ['knock', 4], ['wallSlam', 2], ['brk', 45]], // (dash 3, S5: the Knight runs on behind the machine he carries, so his own move never interrupts it)
      tags: ['dash', 'fusion'], choreo: 'kf_battering', hint: 'Keep running, shield first.', ai: { role: 'control' },
      desc: 'The lunge runs on shield-first and carries the machine; into a wall or another machine, it is pinned.' }),
    F('kf_upheaval', 'Upheaval', { cls: 'knight', icon: 'rise', from: 'k_bash', to: 'k_rising', lvl: 16, need: 'state:staggered', cd: 12, extra: 5,
      hit: { t: 0.3, kind: 'melee' }, fx: [['dmg', 2.0], ['launch', 1.4], ['brk', 40]], liftH: 2.6, // (2.6 m up, S5: it read weakly at 2.3)
      tags: ['lift', 'fusion'], choreo: 'kf_upheaval', hint: 'A machine that cannot stand can be lifted.', ai: { role: 'control', want: { state: 'staggered' } },
      desc: 'Scoop the shield rim under the stunned machine and drive it up into the air.' }),
    F('kf_riposte', 'Turning Riposte', { cls: 'knight', icon: 'parry', from: 'k_guard', to: 'k_cleave', tree: 'riposte_drill', need: 'parry', cd: 12, target: 'self', range: 0,
      hit: { t: 0.35, kind: 'aoe', r: 4.5 }, fx: [['dmg', 1.8], ['parryBack', 0.5], ['taunt', 3], ['res', 20], ['brk', 30]],
      tags: ['sweep', 'spin', 'taunt', 'fusion'], choreo: 'kf_riposte', hint: 'Turn their blow into your swing.', ai: { role: 'tank' },
      desc: 'Answer a parry with a turning cut around you that adds half the blow you blocked and turns every machine on you.' }),
    F('kf_sidewind', 'Sidewind Cut', { cls: 'knight', icon: 'spin', from: 'dodge', to: 'k_valiant', tree: 'rolling_edge', need: 'dodge', cd: 8, extra: 5, target: 'self', range: 0,
      hit: { t: 0.35, kind: 'aoe', r: 4.5 }, fx: [['dmg', 1.1], ['brk', 20], ['knock', 1.5]], // (knock 1.5, S5: the cut throws machines back a step, so it reads; before it only flinched them)
      tags: ['spin', 'fusion'], choreo: 'kf_sidewind', hint: 'Come up out of the roll swinging.', ai: { role: 'aoe' },
      desc: 'The roll comes up into a wide turning cut.' }),
    // the triad (a deep tree notable): Stormfall > Shield Bash
    F('kt_anvilfall', 'Anvil Fall', { cls: 'knight', icon: 'disc', from: 'kf_stormfall', to: 'k_bash', tree: 'three_heights', need: 'hit', triad: true, cd: 50, extra: 10, range: 20,
      hit: { t: 0.53, kind: 'proj', speed: 26 }, fx: [['dmg', 2.4], ['ricochet', 2, 8], ['brk', 120], ['slow', 40, 4]],
      tags: ['shield', 'throw', 'triad'], tier: 5, choreo: 'kt_anvilfall', hint: 'From the crater, the shield has one more fall in it.', ai: { role: 'burst' }, // (hit 0.53, S5: the shield leaves the hand at 0.4 s and lands about 0.13 s later; the damage at 0.38 came first and the machine waited. S6: the hint and ai sat inside this comment)
      desc: 'From the crater, bounce the shield off the ground into the slammed machine; it strikes two more and returns.' }),
  ],
  // the Sandblade (combat_design.md 5.3, S8). Power as the Knight's: a fusion and its A together about 1.35x A + B plain,
  // the aerial bonus counted on a lifted machine. Every move is sand, grit, sparks and heat; spin trails are open arcs
  sandblade: [
    F('sf_sandspout', 'Sandspout', { cls: 'sandblade', move: true, icon: 'spin', from: 's_whirl', to: 's_leap', lvl: 5, need: 'hit', cd: 14, extra: 10, target: 'self', range: 0,
      hit: { t: 0.18, kind: 'aoe', r: 4, n: 5, gap: 0.18 }, fx: [['pull', 3], ['dmg', 0.4], ['launch', 1.0], ['air', 1.3], ['brk', 6], ['holdLift', 0.3]], fxLast: [['dmg', 0.54], ['slamDown', 0.4], ['brk', 40]], tiers: [1, 1, 1, 1, 4],
      tags: ['air', 'sand', 'spin', 'fusion'], cam: 'lift', choreo: 'sf_sandspout', gateText: 'Whirling Scimitar must cut a machine', hint: 'Spin, then keep spinning, up.',
      carry: { a: { drawing: { r: 1.3 }, lowsweep: { airMul: 0.15 } } }, ai: { role: 'aoe', want: { minFoes: 1 } },
      desc: 'Spin up a rising column of sand that pulls the machines round you in and lifts them, cut them four times in the air, then dive and drive them into the ground.' }),
    F('sf_glasscutter', 'Glasscutter', { cls: 'sandblade', move: true, icon: 'thrust', from: 's_step', to: 's_needle', lvl: 7, need: 'hit', cd: 10, extra: 5,
      hit: { t: 0.2, kind: 'melee' }, fx: [['dmg', 2.16], ['dot', 1.5, 6], ['brk', 25]], sureCrit: true, behindMul: 1.25,
      tags: ['fusion'], choreo: 'sf_glasscutter', gateText: 'Desert Step must reach the machine', hint: 'From behind, one line is enough.',
      carry: { b: { searing: { heat: 0.6 }, longneedle: { pow: 0.1 } } }, ai: { role: 'burst' },
      desc: 'Out of the step, straight into the seam from behind: a certain critical strike, a hot line along the blade and a bleed twice as deep.' }),
    F('sf_sirocco', 'Sirocco', { cls: 'sandblade', move: true, icon: 'storm', from: 's_slash', to: 's_step', step: 4, lvl: 9, need: 'hit', cd: 12, extra: 5, range: 8,
      hit: { t: 0.16, kind: 'melee', n: 3, gap: 0.18 }, fx: [['dmg', 0.62], ['brk', 8]], fxLast: [['brk', 20]], tiers: [2, 2, 4],
      tags: ['fusion'], choreo: 'sf_sirocco', gateText: 'The fourth cut of Sand Slash must land', hint: 'Finish the chain, then go through, and back, and through.',
      carry: { a: { heavyfourth: { airMul: 0.4 } } }, ai: { role: 'burst' },
      desc: 'Three dashes through the machine in a zig-zag, leaving three fading sand shapes behind.' }),
    F('sf_dustwhirl', 'Dust Whirl', { cls: 'sandblade', icon: 'whirlwind', from: 's_dust', to: 's_whirl', lvl: 12, need: 'hit', cd: 16, extra: 10, target: 'self', range: 0,
      hit: { t: 0.3, kind: 'aoe', r: 3.5 }, fx: [['dmg', 0.48], ['brk', 10], ['column', 4, 3, 0.32]], tiers: [3],
      tags: ['sand', 'cc', 'fusion'], choreo: 'sf_dustwhirl', gateText: 'Dust Kick must reach a machine', hint: 'The sand you kicked up wants to turn.',
      carry: { b: { drawing: { colPull: 1.4 }, lowsweep: { colLift: 1.4 } } }, ai: { role: 'control', want: { minFoes: 2 } },
      desc: 'The kicked sand rises into a 3 m whirling column that travels with you for 4 s, cutting, blinding and dragging small machines in, and throws them up when it falls.' }),
    F('sf_thousand', 'Thousand Cuts', { cls: 'sandblade', move: true, icon: 'storm', from: 's_step', to: 's_slash', lvl: 15, need: 'hit', cd: 18, extra: 10, range: 8,
      hit: { t: 0.9, kind: 'aoe', at: 'target', r: 3, n: 5, gap: 0 }, fx: [['dmg', 0.43], ['brk', 10]], tiers: [0, 0, 0, 0, 4], untarget: 0.7,
      tags: ['dash', 'fusion'], choreo: 'sf_thousand', gateText: 'Desert Step must reach the machine', hint: 'Go through it five times before it knows.',
      carry: { a: { threecharges: { hits: 7 }, shieldstep: { untarget: 1.0 } } }, ai: { role: 'burst' },
      desc: 'Five short dashes through the machine in a zig-zag, out of reach for 0.7 s; then all the cuts land at once.' }),
    F('sf_riptide', 'Riptide', { cls: 'sandblade', icon: 'twin', from: 's_counter', to: 's_slash', lvl: 16, need: 'parry', cd: 12, extra: 5,
      hit: { t: 0.1, kind: 'melee', n: 6, gap: 0.1 }, fx: [['dmg', 0.4], ['brk', 4]], fxLast: [['knock', 1.5], ['stun', 1.0]], tiers: [1, 0, 0, 0, 0, 4],
      tags: ['fusion'], choreo: 'sf_riptide', hint: 'Turn the blow aside, then answer it six times.', ai: { role: 'burst' },
      desc: 'Answer a turned blow with six cuts in 0.6 s; the last knocks the machine down.' }),
    F('sf_sandline', 'Sand Line', { cls: 'sandblade', icon: 'spin', from: 's_whirl', to: 's_step', tree: 'rolling_sand', need: 'hit', cd: 12, extra: 5, range: 9,
      hit: { t: 0.2, kind: 'line', r: 9, n: 2, gap: 0.3 }, fx: [['dash', 9], ['dmg', 0.7], ['brk', 8]], fxLast: [['knock', 1.5]], tiers: [2, 4], // (the second pass throws them aside a step, so the machine reads it)
      tags: ['fusion'], choreo: 'sf_sandline', gateText: 'Whirling Scimitar must cut a machine', hint: 'Keep spinning, and go.',
      carry: { a: { drawing: { pull: 2 } }, b: { shieldstep: { untarget: 0.5 } } }, ai: { role: 'line' },
      desc: 'Whirl on along a 9 m line, cutting everything on the way twice.' }),
    F('sf_whiteout', 'Whiteout', { cls: 'sandblade', icon: 'cloak', from: 'dodge', to: 's_dust', tree: 'sand_veil', need: 'dodge', cd: 14, extra: 5, target: 'self', range: 0,
      hit: { t: 0.25, kind: 'aoe', r: 4.5 }, fx: [['dmg', 0.62], ['debuff', 'miss', 50, 4], ['brk', 15], ['knock', 1.2], ['cloudAt', 4.5]], untarget: 1.0,
      tags: ['sand', 'cc', 'fusion'], choreo: 'sf_whiteout', hint: 'Come out of the step kicking.',
      carry: {}, ai: { role: 'control' },
      desc: 'Kick sand out of the sidestep: a cloud where you were and one where you are, out of reach for 1 s; every machine in either is blinded (50% for 4 s).' }),
    // the triad (a deep tree notable): Dust Whirl > Dune Leap
    F('st_sandstorm', 'Sandstorm Drop', { cls: 'sandblade', move: true, icon: 'leap', from: 'sf_dustwhirl', to: 's_leap', tree: 'long_column', need: 'hit', triad: true, cd: 50, extra: 10, target: 'self', range: 0,
      hit: { t: 0.78, kind: 'aoe', r: 4.5 }, fx: [['dmg', 2.76], ['brk', 120], ['slamDown', 0.6], ['slow', 40, 4], ['endColumn', 1]],
      tags: ['air', 'slam', 'sand', 'triad'], tier: 5, cam: 'lift', choreo: 'st_sandstorm', hint: 'Ride what you raised, and come down through it.', ai: { role: 'burst' },
      desc: 'Ride the whirling column up and dive down through it: every machine inside takes 2.8x and is driven into the ground.' }),
  ],
  // the Warden (combat_design.md 5.2, S9). Power as the Knight's (a fusion and its A together about 1.35x A + B plain, the
  // aerial bonus counted on a lifted machine). Everything is stone, dust, grit and sparks off the hammer; cracks run one way
  // or branch one way, never out from a point; at most two rings a beat
  warden: [
    F('wf_colossus', 'Colossus Drop', { cls: 'warden', move: true, icon: 'crater', from: 'w_uppercut', to: 'w_pound', lvl: 5, need: 'state:lifted', cd: 16, extra: 10, range: 6, // (an enemy target: the gate reads the lifted machine; the crater is round the Warden)
      hit: { t: 0.78, kind: 'aoe', r: 5 }, fx: [['dmg', 2.8], ['air', 1.4], ['slamDown', 0.6], ['brk', 70], ['slow', 50, 3], ['knockOthers', 2]],
      tags: ['air', 'slam', 'crater', 'fusion'], cam: 'lift', choreo: 'wf_colossus', gateText: 'Uppercut Smash must leave the machine in the air', hint: 'What goes up comes down, and so does he.',
      carry: { b: { widecrater: { r: 1.4 }, forwardfault: { shape: 'line', range: 10 } } }, ai: { role: 'burst', want: { state: 'lifted' } },
      desc: 'Leap 3.5 m up after the lifted machine with the hammer held overhead in both hands and come down through it into the ground: a crater, every machine within 5 m struck and slowed, the others thrown back.' }),
    F('wf_piledriver', 'Pile Driver', { cls: 'warden', move: true, icon: 'pound', from: 'w_bulwark', to: 'w_pound', lvl: 7, need: 'hit', cd: 14, extra: 10, range: 14,
      hit: { t: 0.5, kind: 'aoe', at: 'target', r: 4 }, fx: [['dmg', 2.44], ['stun', 2.0], ['brk', 45]],
      tags: ['slam', 'crater', 'fusion'], choreo: 'wf_piledriver', gateText: 'Bulwark Charge must reach a machine', hint: 'Do not stop at the end of the charge. Go down.',
      carry: { a: { wallpin: { wallPin: 3 } }, b: { widecrater: { r: 1.4 }, forwardfault: { shape: 'line', range: 10 } } }, ai: { role: 'control' },
      desc: 'The charge ends with the hammer driven down through the machines it carried: a 4 m crater, and they lie stunned for 2 s.' }),
    F('wf_bastion', 'Bastion Combo', { cls: 'warden', icon: 'combo', from: 'w_slam', to: 'w_blow', lvl: 9, need: 'hit', cd: 10, extra: 5,
      hit: { t: 0.24, kind: 'melee', n: 3, gap: 0.34 }, fx: [['dmg', 0.76], ['brk', 10]], fxLast: [['knock', 5], ['brk', 25]], tiers: [2, 2, 3],
      tags: ['shield', 'fusion'], choreo: 'wf_bastion', gateText: 'Shield Slam must strike a machine', hint: 'Shield, hammer, shield.',
      carry: { b: { ironweight: { brkMul: 2 }, longhaft: { radius: 4.5, kind: 'cone', cone: 120 } } }, ai: { role: 'control' },
      desc: 'Shield, hammer, shield: three blows with dust at each step; the last throws the machine back 5 m.' }),
    F('wf_faultline', 'Fault Line', { cls: 'warden', icon: 'fissure', from: 'w_pound', to: 'w_split', lvl: 12, need: 'hit', cd: 14, extra: 10, range: 12,
      hit: { t: 0.5, kind: 'line', r: 12, n: 2, gap: 0.2, lines: [[-0.75, -5], [0.75, 9]] }, fx: [['dmg', 1.16], ['launch', 0.7], ['brk', 30]], tiers: [3, 4],
      tags: ['earth', 'fissure', 'fusion'], choreo: 'wf_faultline', gateText: 'Ground Pound must strike a machine', hint: 'The ground is already cracked. Open it twice.',
      carry: { b: { longfissure: { r: 1.34 } } }, ai: { role: 'line' },
      desc: 'Two fissures 12 m long, from points 1.5 m apart and running a little apart, erupt one after the other: each throws the machines on it up.' }),
    F('wf_triphammer', 'Trip Hammer', { cls: 'warden', icon: 'pulverize', from: 'w_blow', to: 'w_uppercut', step: 3, lvl: 15, need: 'hit', cd: 10, extra: 5,
      hit: { t: 0.2, kind: 'melee', n: 2, gap: 0.22 }, fx: [['dmg', 1.46], ['brk', 20]], fxLast: [['launch', 1.2], ['brk', 20]], tiers: [2, 3],
      tags: ['lift', 'fusion'], choreo: 'wf_triphammer', gateText: 'The third step of Hammer Blow must land', hint: 'Finish the chain, then bring it back up at once.',
      carry: { a: { ironweight: { brkMul: 2 }, longhaft: { radius: 4.5, kind: 'cone', cone: 120 } } }, ai: { role: 'burst' },
      desc: 'The overhead smash goes straight into an upswing: a shower of sparks off the ground, then the machine is lifted.' }),
    F('wf_earthbreaker', 'Earthbreaker Charge', { cls: 'warden', move: true, icon: 'charge', from: 'w_bulwark', to: 'w_split', lvl: 18, need: 'hit', cd: 14, extra: 10, range: 14,
      hit: { t: 0.4, kind: 'line', r: 12, from: 'cast', n: 2, gap: 0.5 }, fx: [['dash', 10], ['dmg', 1.28], ['brk', 15]], fxLast: [['root', 1.0]], tiers: [2, 4],
      tags: ['earth', 'fusion'], choreo: 'wf_earthbreaker', gateText: 'Bulwark Charge must reach a machine', hint: 'Drag the hammer and let the ground follow.',
      carry: { a: { unstoppable: { ccImmune: true }, wallpin: { wallPin: 3 } }, b: { longfissure: { r: 1.34 } } }, ai: { role: 'line' },
      desc: 'Charge on 10 m dragging the hammer through the ground, sparks all the way; half a second later the furrow erupts behind you.' }),
    F('wf_breakwater', 'Breakwater', { cls: 'warden', icon: 'shield', from: 'dodge', to: 'w_slam', tree: 'living_wall', need: 'block', cd: 12, extra: 5, target: 'self', range: 0,
      hit: { t: 0.3, kind: 'cone', r: 8, cone: 70 }, fx: [['dmg', 0.73], ['parryBack', 1.5], ['knock', 4], ['brk', 30]], tiers: [3],
      tags: ['shield', 'fusion'], choreo: 'wf_breakwater', gateText: 'Brace must block a blow', hint: 'What you held back, send back.',
      carry: {}, ai: { role: 'tank' },
      desc: 'Out of a perfect Brace, heave the tower shield: a forward wall of dust and grit 8 m long carries the blocked blow back at 1.5x and throws the machines back.' }),
    F('wf_intercept', 'Intercept', { cls: 'warden', move: true, icon: 'leap', from: 'w_challenge', to: 'w_bulwark', tree: 'shoulder_to_shoulder', need: 'done', cd: 16, extra: 5, target: 'ally', range: 16, intercept: true,
      hit: { t: 0.45, kind: 'self' }, fx: [['intercept', 2, 0.5, 6]],
      tags: ['shield', 'guard', 'fusion'], choreo: 'wf_intercept', gateText: 'Challenge must take effect', hint: 'Shout, then stand where they are.',
      carry: {}, ai: { role: 'tank' },
      desc: 'Charge to an ally and turn the shield to face what threatens them: their next two blows land on you instead, at half strength.' }),
    // the triad (a deep tree notable): Colossus Drop > Earthsplitter
    F('wt_hammerfall', 'Hammerfall', { cls: 'warden', icon: 'fissure', from: 'wf_colossus', to: 'w_split', tree: 'fault_and_fall', need: 'hit', triad: true, cd: 50, extra: 10, range: 14,
      hit: { t: 0.55, kind: 'line', r: 14 }, fx: [['dmg', 3.17], ['launch', 0.8], ['root', 1.5], ['brk', 120]],
      tags: ['earth', 'fissure', 'slam', 'triad'], tier: 5, choreo: 'wt_hammerfall', hint: 'From the crater, one more blow, and the ground opens.', ai: { role: 'burst' },
      desc: 'From the crater, a last blow sends a fissure out toward the machine that erupts along its whole length: every machine on it is thrown up and held fast.' }),
  ],
};

export const FUSE = {}; // cls -> 'a>b' -> fusion
export const FUSION_BY_ID = {};
const tagsOf = (id) => (CORE_BY_ID[id]?.tags || FUSION_BY_ID[id]?.tags || []);
for (const [cls, list] of Object.entries(FUSIONS)) {
  FUSE[cls] = {};
  for (const f of list) {
    f.key = f.from + '>' + f.to;
    const B = CORE_BY_ID[f.to];
    f.cost = (B?.cost || 0) + (f.extra || 0); // (B's cost + its own extra; the sim adds B's cost with its modifiers)
    FUSION_BY_ID[f.id] = f; FUSE[cls][f.key] = f;
  }
  // (a triad takes B's tags and its own, not its A fusion's: Anvil Fall is a shield throw, and Stormfall's leap tag gave it
  // Iron Comet's range and Hard Landing's poise and radius; S5)
  for (const f of list) f.tags = [...new Set([...(f.triad ? [] : tagsOf(f.from)), ...tagsOf(f.to), ...f.tags])];
}

// a skill record by id: the new kit (core skills, chain steps' first record, fusions) for a class on KIT_V2, else the legacy one
export const skillOf = (id) => {
  const k = CORE_BY_ID[id] || FUSION_BY_ID[id];
  if (k && KIT_V2[k.cls]) return k;
  return SKILL_BY_ID[id] || k || null;
};
export const nameOf = (id, cls) => (id === 'dodge' ? DODGES[cls]?.name || 'Dodge' : skillOf(id)?.name || id);

// both inputs learned, and the fusion's level reached or its tree notable taken (p.tree, S3)
export function fusionUnlocked(p, f) {
  if (!f || !p) return false;
  const learned = (id) => id === 'dodge' || (FUSION_BY_ID[id] ? fusionUnlocked(p, FUSION_BY_ID[id]) : (CORE_BY_ID[id]?.lvl ?? 99) <= p.level);
  return learned(f.from) && learned(f.to) && (f.tree ? !!p.tree?.[f.tree] : p.level >= (f.lvl || 1));
}

// p.eff and p.effFuse (section 3.3), rebuilt where p.tal is rebuilt (recalc). Order: base skill, Form patch, fusion record
// with its carry bits, keystone patches over tags, number modifiers. S2 has the base and fusion records; Forms, carry and
// keystones come with the tree (S3) and patch here; number modifiers stay in p.tal (skillCost, skillCd, damage)
export function compileKit(p) {
  const eff = {}, effFuse = {};
  if (KIT_V2[p.cls]) {
    for (const s of CORE[p.cls] || []) eff[s.id] = s;
    for (const f of FUSIONS[p.cls] || []) { eff[f.id] = f; effFuse[f.key] = f; }
  } else for (const s of SKILLS[p.cls] || []) eff[s.id] = s;
  p.eff = eff; p.effFuse = effFuse;
  return p;
}

export const masteryRank = (n) => MASTERY.reduce((r, need) => (n >= need ? r + 1 : r), 0);

// does a link's gate hold? L: p.link; tgt: the fusion's target (for state gates); opening: the hero holds Opening
// (it satisfies hit and done, not parry). isState(tgt, name) is the sim's or the client's own check
export function gateOk(f, L, tgt, opening, isState) {
  const need = f.need || 'hit';
  if (f.step && L.step !== f.step) return false;
  if (need === 'hit') return !!(L.landed || opening);
  if (need === 'done') return !!(L.done || L.landed || opening);
  if (need === 'parry') return !!L.parried;
  if (need === 'dodge') return L.from === 'dodge';
  if (need === 'block') return L.from === 'dodge' && L.blocked > 0; // (S9: a blow blocked in the Warden's Brace)
  if (need.startsWith('state:')) return !!(L.landed || opening) && !!tgt && isState(tgt, need.slice(6));
  return false;
}

// the Fusion Book (section 4.5; the screen is S6): every fusion and the triad of a class with its inputs, gate in plain
// words, hint, numbers, whether it is known (discovered), unlocked, its uses and mastery rank. The triad shows once its
// notable is taken; unknown entries show their hint only
export function fusionBook(cls, p = {}) {
  const known = new Set(p.fusions || []), uses = p.fmastery || {};
  return (FUSIONS[cls] || []).map((f) => {
    const unlocked = fusionUnlocked(p, f), a = nameOf(f.from, cls), n = uses[f.id] || 0;
    return { id: f.id, name: f.name, icon: f.icon, from: f.from, to: f.to, fromName: a, toName: nameOf(f.to, cls), need: f.need, gate: f.gateText || (GATES[f.need] || GATES.hit)(a), hint: f.hint || '',
      lvl: f.lvl || null, tree: f.tree || null, triad: !!f.triad, cost: f.cost, cd: f.cd, desc: f.desc, known: known.has(f.id), unlocked, uses: n, rank: masteryRank(n), show: !f.triad || unlocked };
  });
}
