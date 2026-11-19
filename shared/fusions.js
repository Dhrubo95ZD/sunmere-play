// Fusions (combat_design.md sections 3 and 5, stage S2): when skill A lands, a link window opens; skill B pressed in it
// casts the fusion A>B, a new named move with its own rules. Fusions and triads are ordinary skill records with from, to,
// need, lvl or tree, carry, ai and tier. FUSE[cls]['a>b'] finds one. compileKit(p) builds p.eff (every skill a player can
// cast, by id) and p.effFuse (its fusions by pair); the sim, the bar, tooltips and bots read those, not the legacy table (classes.js LEGACY_SKILLS).
// Choreography: each fusion names its clip (choreo); S4 gave Stormfall, Battering Line, Turning Riposte, Sidewind Cut and
// Anvil Fall their own DEFs on the authored hero clips (client/game/choreo.js, 'ual'); the rest still name an existing one.
// Imports only from shared/.
import { CORE, CORE_BY_ID, DODGES, DE_POW, RA_POW, RA_FUSE, CH_POW, CH_FUSE, HB_POW, HB_FUSE, HB_HEAL } from './kit.js';

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
  // the Deadeye (combat_design.md 5.5, S10). Power as the Knight's (a fusion and its A together about 1.35x A + B plain).
  // Everything is powder smoke, sparks, brass and gravel: muzzle smoke is a short flat cone or a plain puff (never a star),
  // the twin pistols are held parallel (never crossed), multi-shot moves have uneven gaps (hit.ts). seq: one entry a contact
  // ({ hit, fx } over the record's own: Recoil Vault's ground blast then its apex shots, Point Blank's grip then barrels)
  deadeye: (() => {
    const P = DE_POW, d = (v) => +(v * P).toFixed(3);
    return [
      F('df_recoilvault', 'Recoil Vault', { cls: 'deadeye', move: true, icon: 'backflip', from: 'd_pair', to: 'd_recoil', lvl: 5, need: 'hit', cd: 14, extra: 10, range: 24,
        hit: { t: 0.06, kind: 'aoe', r: 2, n: 3, ts: [0.06, 0.5, 0.62] }, fx: [['back', 7], ['dmg', d(1.0)], ['air', 1.3], ['brk', 20]],
        seq: [{ hit: { kind: 'aoe', r: 2 }, fx: [['dmg', d(0.6)], ['knock', 2], ['brk', 10]] }, { hit: { kind: 'proj' }, fx: [['dmg', d(1.0)], ['air', 1.3], ['brk', 20]] }, { hit: { kind: 'proj' }, fx: [['dmg', d(1.0)], ['air', 1.3], ['brk', 30]] }],
        tiers: [2, 2, 4], tags: ['air', 'fusion'], cam: 'lift', choreo: 'df_recoilvault', gateText: 'Paired Shot must strike a machine', hint: 'Shoot the ground, and keep shooting on the way up.',
        carry: { b: { highrecoil: { addShot: 1 }, forwardrecoil: { pow: 0.1 } } }, ai: { role: 'burst' },
        desc: 'Both pistols fired into the ground throw you up and back 7 m in a backflip; at the top, two more shots at the machine (30% harder against one in the air). You land in a slide.' }),
      F('df_overhead', 'Overhead Pair', { cls: 'deadeye', move: true, icon: 'leap', from: 'd_recoil', to: 'd_pair', lvl: 7, need: 'done', cd: 14, extra: 10, range: 16,
        hit: { t: 0.5, kind: 'aoe', at: 'target', r: 2.5 }, fx: [['leap', 9], ['dmg', d(2.8)], ['slamDown', 0.6], ['brk', 50]],
        tags: ['air', 'fusion'], cam: 'lift', choreo: 'df_overhead', gateText: 'Recoil Jump must go off', hint: 'Go over it, and fire straight down.',
        carry: { a: { highrecoil: { pow: 0.15 }, forwardrecoil: { leap: 12 } }, b: { ironslug: { r: 1.4 }, splitpair: { r: 1.25 } } }, ai: { role: 'burst' },
        desc: 'A forward recoil arc over the machine; at the top both pistols fire straight down into it (2.8x) and knock it flat. You land behind it.' }),
      F('df_platesplitter', 'Plate Splitter', { cls: 'deadeye', move: true, icon: 'pierce', from: 'd_knee', to: 'd_pair', lvl: 9, need: 'state:staggered', cd: 10, extra: 5, range: 22,
        hit: { t: 0.24, kind: 'proj', speed: 80 }, fx: [['dmg', d(2.2)], ['debuff', 'armor', 25, 8], ['brk', 30]],
        tags: ['fusion'], choreo: 'df_platesplitter', hint: 'A machine that staggers shows its rivets.',
        carry: { b: { ironslug: { pierce: true }, splitpair: { split: 1 } } }, ai: { role: 'burst', want: { state: 'staggered' } },
        desc: 'Both hardened balls into the rivet line of the staggered machine: 2.2x, and its plating splits (it takes 25% more for 8 s) in a spray of plate chips and sparks.' }),
      F('df_chainshot', 'Chain Shot', { cls: 'deadeye', move: true, icon: 'pin', from: 'd_knee', to: 'd_scatter', lvl: 12, need: 'hit', cd: 12, extra: 5, range: 20,
        hit: { t: 0.32, kind: 'proj', speed: 40 }, fx: [['dmg', d(1.2)], ['pin', 3], ['brk', 20]], split: 1, splitR: 6,
        tags: ['pin', 'fusion'], choreo: 'df_chainshot', gateText: 'Knee Shot must strike a machine', hint: 'Two balls, one chain, two machines.',
        carry: { b: { choke: { range: 24 }, widebore: { split: 2 } } }, ai: { role: 'control' },
        desc: 'Two balls on a straight chain spin out as one solid bar and wrap the machine and the one nearest it together: both are Pinned for 3 s.' }),
      F('df_pointblank', 'Point Blank', { cls: 'deadeye', move: true, icon: 'fist', from: 'd_scatter', to: 'd_quick', lvl: 15, need: 'hit', cd: 12, extra: 10, range: 9,
        hit: { t: 0.2, kind: 'melee', n: 2, ts: [0.2, 0.5] }, fx: [['dmg', d(2.0)], ['knock', 4], ['brk', 40]],
        seq: [{ fx: [['dmg', d(0.8)], ['stun', 0.6], ['brk', 10]] }, { fx: [['dmg', d(2.0)], ['knock', 4], ['brk', 40]] }],
        tiers: [2, 4], tags: ['fusion'], choreo: 'df_pointblank', gateText: 'Scatter Charge must strike a machine', hint: 'Close enough to touch, then closer.',
        carry: { a: { choke: { pow: 0.1 }, widebore: { split: 2 } } }, ai: { role: 'burst' },
        desc: 'Step in through the smoke: a crack of the pistol grip across the plate (it reels for 0.6 s), then both barrels against it: 2.0x, thrown back 4 m trailing smoke.' }),
      F('df_broadside', 'Broadside', { cls: 'deadeye', icon: 'barrage', from: 'd_knee', to: 'd_fan', lvl: 18, need: 'hit', cd: 14, extra: 10, range: 22,
        hit: { t: 0.34, kind: 'proj', speed: 80, n: 4, ts: [0.34, 0.62, 0.98, 1.26] }, fx: [['dmg', d(1.0)], ['knock', 2], ['debuff', 'armor', 15, 8], ['brk', 12]],
        tiers: [2, 2, 2, 4], tags: ['fusion'], choreo: 'df_broadside', gateText: 'Knee Shot must strike a machine', hint: 'Down on one knee, and do not hurry it.',
        carry: {}, ai: { role: 'burst' },
        desc: 'Down on one knee: four heavy shots, right, left, right, left, never on an even beat. Each knocks the machine back and buckles its plating (15% more taken).' }),
      F('df_slideshot', 'Slide Shot', { cls: 'deadeye', move: true, icon: 'roll', from: 'dodge', to: 'd_scatter', tree: 'low_road', need: 'dodge', cd: 10, extra: 5, range: 11,
        hit: { t: 0.18, kind: 'cone', r: 10, cone: 60 }, fx: [['dmg', d(1.4)], ['launch', 1.0], ['brk', 25]],
        tiers: [4], tags: ['lift', 'fusion'], choreo: 'df_slideshot', hint: 'Low on the ground, fire up.',
        carry: { b: { choke: { cone: 30, r: 1.4, range: 15 }, widebore: { cone: 120, r: 0.6, range: 7 } } }, ai: { role: 'control' },
        desc: 'Out of the slide, still on one knee, the loose shot fired upward: the small machines in the cone are thrown into the air, with a spray of gravel along the slide.' }),
      F('df_lastround', 'Last Round', { cls: 'deadeye', move: true, icon: 'execute', from: 'd_quick', to: 'd_pair', tree: 'held_breath', need: 'hit', cd: 12, extra: 10, range: 22,
        hit: { t: 0.36, kind: 'proj', speed: 90 }, fx: [['dmg', d(1.8)], ['execute', d(1.08)], ['brk', 30]],
        tiers: [4], tags: ['fusion'], choreo: 'df_lastround', hint: 'Hold your breath. Then both.',
        carry: { b: { ironslug: { pierce: true }, splitpair: { split: 1 } } }, ai: { role: 'burst' },
        desc: 'A held breath, a still beat, then both pistols\' heavy double charge: 1.8x, and 60% more against a machine below 35% health.' }),
      // the triad (a deep tree notable): Overhead Pair > Fan the Hammer
      F('dt_fallingstorm', 'Falling Storm', { cls: 'deadeye', move: true, icon: 'storm', from: 'df_overhead', to: 'd_fan', tree: 'high_ground', need: 'hit', triad: true, cd: 50, extra: 10, range: 16,
        hit: { t: 0.3, kind: 'aoe', at: 'target', r: 4, n: 12, ts: [0.3, 0.37, 0.46, 0.52, 0.61, 0.69, 0.76, 0.86, 0.93, 1.01, 1.1, 1.18] }, fx: [['dmg', d(0.36)], ['brk', 5]], fxLast: [['brk', 65], ['slow', 40, 3]],
        tiers: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5], tags: ['air', 'triad'], tier: 5, cam: 'lift', choreo: 'dt_fallingstorm', hint: 'From up there, empty the hammer on them.',
        carry: { d_snap: { hotshot: { heat: 0.1 }, rocksalt: { slowStack: 10 } } }, ai: { role: 'burst' },
        desc: 'Kick off the ground once more and come down slowly, fanning the hammer straight down: twelve shots over 8 m round the machine, then a heavy break.' }),
    ];
  })(),
  // the Ranger (combat_design_fusion.md 4.2, S11). Power as the Knight's (a fusion and its A together about 1.35x A + B
  // plain). Everything is wood, rope, chalk, dust and splinters; arrows in flight run roughly parallel (never crossing, never
  // fanned out from a point); a rain lands in a stitched, uneven pattern. at: 'cast' is round where the cast began (the
  // spot he flipped away from), at: 'trap' round his trap (every trap with Trapper's Ground); seg: a line struck one stretch
  // a contact, down its length
  ranger: (() => {
    const P = RA_POW * RA_FUSE, d = (v) => +(v * P).toFixed(3);
    return [
      F('rf_highwire', 'Highwire Volley', { cls: 'ranger', move: true, icon: 'backflip', from: 'r_disengage', to: 'r_volley', lvl: 5, need: 'done', cd: 14, extra: 10, target: 'self', range: 0,
        hit: { t: 0.4, kind: 'aoe', at: 'cast', r: 6, n: 4, ts: [0.4, 0.47, 0.55, 0.64] }, fx: [['back', 4], ['dmg', d(0.6)], ['brk', 8]], fxLast: [['dmg', d(0.3)], ['slow', 50, 3], ['brk', 20]],
        tiers: [1, 1, 1, 4], tags: ['air', 'rain', 'fusion'], cam: 'lift', choreo: 'rf_highwire', gateText: 'Disengage must go off', hint: 'From the top of the flip, look down.',
        carry: { b: { widesky: { r: 1.33 }, bodkinhail: { addFx: [['debuff', 'armor', 10, 8]] } } }, ai: { role: 'aoe' },
        desc: 'Flip on up and back from the top of Disengage and loose the volley straight down on the spot you left: twelve arrows over 6 m in a stitched line, the last slowing everything there 50%.' }),
      F('rf_rolling', 'Rolling Shot', { cls: 'ranger', move: true, icon: 'roll', from: 'dodge', to: 'r_quick', lvl: 7, need: 'dodge', cd: 8, extra: 5, range: 28,
        hit: { t: 0.12, kind: 'proj', speed: 60, n: 3, ts: [0.12, 0.25, 0.4] }, fx: [['dmg', d(0.45)], ['brk', 4]], tiers: [1, 1, 3],
        tags: ['arrow', 'fusion'], choreo: 'rf_rolling', hint: 'The arrow stayed on the string.',
        carry: { b: { rhythm: { hits: 4 }, bodkin: { pierce: true } } }, ai: { role: 'burst' },
        desc: 'Out of the tumble, three arrows loosed from the roll as you come up, the last a heavy one.' }),
      F('rf_tripwire', 'Tripwire Burst', { cls: 'ranger', icon: 'trap', from: 'r_trap', to: 'r_pierce', lvl: 9, need: 'done', cd: 12, extra: 5, range: 30,
        hit: { t: 0.32, kind: 'aoe', at: 'trap', r: 4 }, fx: [['dmg', d(2.4)], ['root', 2.5], ['brk', 30]],
        tags: ['trap', 'fusion'], choreo: 'rf_tripwire', gateText: 'Snare Trap must be on the ground', hint: 'Shoot your own trap.',
        carry: { a: { springtrap: { lift: 1.0 } }, b: { tarhead: { addFx: [['coat', 'tar', 8]] } } }, ai: { role: 'control', want: { minFoes: 1 } },
        desc: 'An arrow into your own trap: it bursts in wood splinters and flying rope, and every machine within 4 m is struck and held fast for 2.5 s.' }),
      F('rf_ridgeline', 'Ridgeline Salvo', { cls: 'ranger', icon: 'barrage', from: 'r_pierce', to: 'r_volley', lvl: 12, need: 'hit', cd: 14, extra: 10, range: 30,
        hit: { t: 0.5, kind: 'line', r: 14, n: 7, gap: 0.05, seg: 2, segW: 4 }, fx: [['dmg', d(1.5)], ['brk', 8]], tiers: [1, 1, 1, 1, 1, 1, 4],
        tags: ['rain', 'line', 'fusion'], choreo: 'rf_ridgeline', gateText: 'Piercing Arrow must strike a machine', hint: 'The arrow showed the way. Send the rest after it.',
        carry: { a: { tarhead: { addFx: [['coat', 'tar', 8]] }, splitting: { pow: 0.1 } }, b: { widesky: { segW: 6 }, bodkinhail: { addFx: [['debuff', 'armor', 10, 8]] } } }, ai: { role: 'line' },
        desc: 'The volley comes down along the line the arrow flew, 14 m of it, the arrows landing one stretch after another away from you with a puff of dust at each.' }),
      F('rf_ricochet', 'Ricochet Bodkin', { cls: 'ranger', move: true, icon: 'pierce', from: 'r_mark', to: 'r_quick', lvl: 15, need: 'hit', cd: 10, extra: 5, range: 30,
        hit: { t: 0.26, kind: 'proj', speed: 70 }, fx: [['dmg', d(1.1)], ['bounce', 3, 10, 0.7], ['brk', 10]], tiers: [3],
        tags: ['arrow', 'fusion'], choreo: 'rf_ricochet', gateText: 'Marked Target must strike a machine', hint: 'Chalk shows where the plate is hard.',
        carry: { b: { bodkin: { bounceN: 4 }, rhythm: { pow: 0.15 } } }, ai: { role: 'aoe' },
        desc: 'A hardened bodkin glances off the Marked machine\'s plate into the next within 10 m, and on to a third and a fourth: each is struck (70%) and Marked for 4 s.' }),
      F('rf_cloudburst', 'Cloudburst', { cls: 'ranger', icon: 'rain', from: 'r_volley', to: 'r_thousand', lvl: 18, need: 'hit', cd: 40, extra: 10, range: 26,
        hit: { t: 0.5, kind: 'aoe', at: 'target', r: 5, n: 12, gap: 0.16 }, fx: [['dmg', d(0.46)], ['root', 0.3], ['brk', 5]], fxLast: [['brk', 30]],
        tiers: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 4], tags: ['rain', 'fusion'], choreo: 'rf_cloudburst', gateText: 'Volley must strike a machine', hint: 'Where the rain fell once, let it fall harder.',
        carry: { a: { widesky: { r: 1.33 }, bodkinhail: { addFx: [['debuff', 'armor', 10, 8]] } } }, ai: { role: 'aoe', want: { minFoes: 1 } },
        desc: 'Thousand Arrows comes down on the volley\'s ground at twice the density for 2 s: every wave holds the machines there for a moment, and the ground is pocked with shafts.' }),
      F('rf_springsnare', 'Spring Snare', { cls: 'ranger', move: true, icon: 'leap', from: 'r_trap', to: 'r_disengage', tree: 'trappers_spring', need: 'done', cd: 12, extra: 5, target: 'self', range: 0,
        hit: { t: 0.12, kind: 'aoe', at: 'trap', r: 3, n: 3, ts: [0.12, 0.46, 0.6] }, fx: [['back', 12], ['dmg', d(0.45)], ['brk', 10]],
        seq: [{ fx: [['dmg', d(0.3)], ['launch', 1.0], ['brk', 20]] }, { fx: [['dmg', d(0.45)], ['brk', 10]] }, { fx: [['dmg', d(0.45)], ['brk', 10]] }],
        tiers: [3, 1, 3], tags: ['air', 'trap', 'fusion'], cam: 'lift', choreo: 'rf_springsnare', gateText: 'Snare Trap must be on the ground', hint: 'The trap has a spring in it. So do you.',
        carry: { a: { springtrap: { pow: 0.15 }, twinsnares: { pow: 0.1 } } }, ai: { role: 'control' },
        desc: 'Vault off your own trap 12 m back and up: its wooden bar snaps up and throws the machines within 3 m into the air, and you loose six arrows down on them from the top.' }),
      F('rf_longdraw', 'Long Draw', { cls: 'ranger', icon: 'aim', from: 'r_mark', to: 'r_pierce', tree: 'long_draw', need: 'hit', cd: 14, extra: 10, range: 32,
        hit: { t: 0.9, kind: 'line', r: 32 }, fx: [['dmg', d(3.2)], ['execute', d(1.6)], ['brk', 45]], tiers: [4],
        tags: ['line', 'fusion'], choreo: 'rf_longdraw', gateText: 'Marked Target must strike a machine', hint: 'Kneel, and take your time over the chalk.',
        carry: { b: { tarhead: { addFx: [['coat', 'tar', 8]] }, splitting: { split: 2 } } }, ai: { role: 'burst' },
        desc: 'Down on one knee, a full draw held on the chalk: 3.2x through the Marked machine and everything behind it on the line, half as much again against one below 35% health.' }),
      // the triad (a deep tree notable): Tripwire Burst > Volley
      F('rt_closedground', 'Closed Ground', { cls: 'ranger', icon: 'rain', from: 'rf_tripwire', to: 'r_volley', tree: 'closed_ground', need: 'hit', triad: true, cd: 50, extra: 10, target: 'self', range: 0,
        hit: { t: 0.6, kind: 'aoe', at: 'trap', r: 4.5, n: 3, ts: [0.6, 0.98, 1.34] }, fx: [['dmg', d(1.15)], ['brk', 20]], fxLast: [['brk', 80], ['slow', 50, 4]],
        tiers: [3, 3, 5], tags: ['rain', 'trap', 'triad'], tier: 5, choreo: 'rt_closedground', hint: 'What the trap holds, the sky can find.',
        carry: { r_volley: { widesky: { r: 1.25 }, bodkinhail: { addFx: [['debuff', 'armor', 10, 8]] } } }, ai: { role: 'burst' },
        desc: 'Three volleys, one after another, on everything the tripwire holds: 1.15x a wave, and the last breaks them.' }),
    ];
  })(),
  // the Chemist (combat_design_fusion.md 4.3, S12). Power as the Ranger's (the fusions x CH_FUSE of the design's numbers to
  // reach their share). Everything is real chemistry: tar and pine pitch, flame sheets low off a puddle's edge, cold-pack
  // salts and rime, acid in a low green-grey cloud, steam, sparks jumping between metal, smoke and blasting powder; flask
  // liquids are green, blue, white or clear (never amber or red). at: 'puddle' is round his nearest puddle (a burning one
  // first) or the machine; at: 'spot' where the machine stood at the throw; at: 'here' where the fusion began; fuse: s from
  // the landing to the burst (sim.js p.bombs). The triad's id keeps its art's name; it is a cask, never a drum
  chemist: (() => {
    const P = CH_POW * CH_FUSE, d = (v) => +(v * P).toFixed(3);
    return [
      F('cf_tarfire', 'Tarfire', { cls: 'chemist', icon: 'flame', from: 'c_tar', to: 'c_spark', lvl: 5, need: 'hit', cd: 14, extra: 10, range: 16,
        hit: { t: 0.34, kind: 'aoe', at: 'puddle', r: 4.5 }, fx: [['dmg', d(1.3)], ['ignitePuddle', 6, 0.5], ['brk', 30]], tiers: [4],
        tags: ['heat', 'spark', 'fusion'], choreo: 'cf_tarfire', gateText: 'Tar Pot must strike a machine', hint: 'Tar burns.',
        carry: { a: { pitchwall: { wall: 1 }, hottar: { pow: 0.15 } } }, ai: { role: 'aoe', want: { minFoes: 1 } },
        desc: 'A spark ribbon from the gear down into your tar: the puddle catches, flame sheets rise from its edge inward, and it burns 6 s (0.5 a second). Everything Tarred in it is set alight.' }),
      F('cf_corrosive', 'Corrosive Charge', { cls: 'chemist', icon: 'cloud', from: 'c_acid', to: 'c_volatile', step: 3, lvl: 7, need: 'hit', cd: 12, extra: 5, range: 22, fuse: 0.45,
        hit: { t: 0.5, kind: 'aoe', at: 'target', r: 5 }, fx: [['dmg', d(1.7)], ['coat', 'corrode', 8], ['zone', 'acid', 0.2, 5, 5], ['brk', 25]], coatN: 4, tiers: [4],
        tags: ['blast', 'acid', 'fusion'], choreo: 'cf_corrosive', gateText: 'The third Acid Flask must land', hint: 'Finish the chain, then something that bursts.',
        carry: { a: { etching: { coatN: 6 }, splash: { r: 1.2 } }, b: { cluster: { cluster: 1 }, sticky: { pow: 0.1 } } }, ai: { role: 'aoe' },
        desc: 'The bomb bursts in the acid: everything within 5 m is struck, eaten four Corroded stacks deep, and a low green-grey cloud lies there 5 s, eating at whatever stands in it.' }),
      F('cf_thermalshock', 'Thermal Shock', { cls: 'chemist', icon: 'frost', from: 'c_chill', to: 'c_volatile', lvl: 9, need: 'hit', cd: 12, extra: 5, range: 22, fuse: 0.4,
        hit: { t: 0.5, kind: 'aoe', at: 'target', r: 5 }, fx: [['dmg', d(1.3)], ['brk', 80]], coatMul: { chill: 1.35 }, tiers: [4],
        tags: ['blast', 'cold', 'fusion'], choreo: 'cf_thermalshock', gateText: 'Chill Powder must strike a machine', hint: 'Cold plate does not like a sudden blow.',
        carry: { a: { frostline: { r: 1.2 }, deepchill: { pow: 0.15 } }, b: { cluster: { cluster: 1 }, sticky: { pow: 0.1 } } }, ai: { role: 'burst' },
        desc: 'The bomb bursts on the frozen plate and the frost cracks it apart: twice as hard against a Chilled machine (the Shatter included), and a heavy poise blow.' }),
      F('cf_pitchvault', 'Pitch Vault', { cls: 'chemist', move: true, icon: 'vault', from: 'c_vault', to: 'c_tar', lvl: 12, need: 'done', cd: 14, extra: 5, target: 'self', range: 0, selfDone: true,
        hit: { t: 0.3, kind: 'aoe', at: 'cast', r: 4 }, fx: [['back', 4], ['dmg', d(0.7)], ['coat', 'tar', 8], ['tarPath', 8, 1.6], ['brk', 20]], tiers: [3],
        tags: ['vault', 'puddle', 'fusion'], choreo: 'cf_pitchvault', gateText: 'Rod Vault must go off', hint: 'Spill something on the way.',
        carry: { b: { pitchwall: { pow: 0.1 }, hottar: { hotTar: 1 } } }, ai: { role: 'control' },
        desc: 'Vault on 4 m with the pot in the other hand: tar spills along the whole path behind you and the pot splashes where you first stood, Tarring every machine there. The tar strip lies 8 s and slows what crosses it by half.' }),
      F('cf_flashsteam', 'Flash Steam', { cls: 'chemist', icon: 'cloud', from: 'c_spark', to: 'c_chill', lvl: 15, need: 'hit', cd: 14, extra: 10, range: 10,
        hit: { t: 0.3, kind: 'cone', r: 10, cone: 80 }, fx: [['dmg', d(1.6)], ['debuff', 'miss', 30, 3], ['knock', 4], ['brk', 40]], tiers: [4],
        tags: ['steam', 'fusion'], choreo: 'cf_flashsteam', gateText: 'Spark Gear must strike a machine', hint: 'A hot rod in cold salts.',
        carry: { b: { frostline: { radius: 14, kind: 'line' }, deepchill: { addFx: [['root', 1.5]] } } }, ai: { role: 'control' },
        desc: 'The hot rod driven into the cold salts: a huge cone of white steam rolls 10 m forward. Every machine in it is struck, thrown back 4 m and blinded (its swings miss 30% for 3 s).' }),
      F('cf_chainreaction', 'Chain Reaction', { cls: 'chemist', icon: 'chain', from: 'c_volatile', to: 'c_grand', lvl: 18, need: 'hit', cd: 40, extra: 10, range: 24, fuse: 0.3,
        hit: { t: 0.62, kind: 'aoe', at: 'spot', r: 12 }, fx: [['detonateAll', 15, d(0.7)], ['dmg', d(3.4)], ['launch', 1.0], ['brk', 70]], tiers: [5],
        tags: ['blast', 'fusion'], choreo: 'cf_chainreaction', gateText: 'Volatile Mixture must land by a machine', hint: 'Everything you left lying about wants to go off.',
        carry: { a: { cluster: { pow: 0.1 }, sticky: { pow: 0.1 } } }, ai: { role: 'aoe' },
        desc: 'Every bomb, puddle and cloud of yours within 15 m goes off in turn, 0.1 s apart, walking toward the cask, and then the cask itself bursts over 12 m.' }),
      F('cf_blastvault', 'Blast Vault', { cls: 'chemist', move: true, icon: 'leap', from: 'c_volatile', to: 'c_vault', tree: 'blast_vault', need: 'hit', cd: 16, extra: 5, range: 16,
        hit: { t: 0.08, kind: 'aoe', at: 'here', r: 3, n: 2, ts: [0.08, 0.95] }, fx: [['leap', 16], ['dmg', d(1.6)], ['slamDown', 0.5], ['brk', 40]],
        seq: [{ hit: { kind: 'aoe', at: 'here', r: 3 }, fx: [['useBomb'], ['dmg', d(0.5)], ['brk', 10]] }, { hit: { kind: 'aoe', at: 'target', r: 4 }, fx: [['dmg', d(1.6)], ['slamDown', 0.5], ['brk', 40]] }],
        tiers: [2, 4], tags: ['air', 'slam', 'fusion'], cam: 'lift', choreo: 'cf_blastvault', gateText: 'Volatile Mixture must land by a machine', hint: 'Plant the rod on something that is about to go off.',
        carry: { a: { cluster: { pow: 0.1 }, sticky: { pow: 0.1 } } }, ai: { role: 'burst' },
        desc: 'Plant the rod on a bomb of your own: it bursts under you (no harm to you) and flings you 14 m high on a 16 m arc onto the machine. The landing slams everything within 4 m down.' }),
      F('cf_galvanic', 'Galvanic Arc', { cls: 'chemist', icon: 'spark', from: 'c_acid', to: 'c_spark', step: 3, tree: 'live_rod', need: 'hit', cd: 12, extra: 5, range: 16,
        hit: { t: 0.3, kind: 'proj', speed: 90 }, fx: [['dmg', d(1.2)], ['arcCorroded', 12, d(1.2)], ['stun', 0.6], ['brk', 30]], tiers: [4],
        tags: ['spark', 'fusion'], choreo: 'cf_galvanic', gateText: 'The third Acid Flask must land', hint: 'Acid and metal want a spark.',
        carry: { a: { etching: { pow: 0.15 }, splash: { pow: 0.1 } } }, ai: { role: 'aoe' },
        desc: "The gear's spark runs on from machine to machine through every Corroded one within 12 m: each is struck (1.2x) and staggered, sparks dropping where the arc lands." }),
      // the triad (a deep tree notable): Tarfire > Grand Detonation
      F('ct_furnacedrum', 'Furnace Cask', { cls: 'chemist', icon: 'cask', from: 'cf_tarfire', to: 'c_grand', tree: 'furnace_cask', need: 'hit', triad: true, cd: 50, extra: 10, range: 24, fuse: 0.5,
        hit: { t: 0.62, kind: 'aoe', at: 'puddle', r: 10 }, fx: [['dmg', d(3.6)], ['launch', 1.0], ['zone', 'fire', 0.6, 5, 6], ['brk', 120]], zoneSlow: 20,
        tags: ['heat', 'blast', 'triad'], tier: 5, choreo: 'ct_furnacedrum', hint: 'Roll something heavy into the fire.',
        carry: { c_tar: { pitchwall: { pow: 0.1 }, hottar: { pow: 0.1 } } }, ai: { role: 'burst' },
        desc: 'Roll the cask into the burning tar: it bursts over 10 m, throwing the machines up, and leaves a ring of fire burning 5 s.' }),
    ];
  })(),
  // the Herbalist (combat_design_fusion.md 4.6, S13): heals in fusions. Damage x HB_POW x HB_FUSE (as the Chemist's), heals
  // the design's own numbers x HB_HEAL. Everything is a real remedy: salve and poultice splashes in green, resin and sap
  // hardening amber-green, herb smoke, steam off the kettle, the lantern's warm oil flame behind glass (a soft round glow,
  // never beams or rays). hzone: [kind, heal a second, s, m] (sim.js herbZone); at: 'smoke' round his nearest smoke
  herbalist: (() => {
    const P = HB_POW * HB_FUSE, d = (v) => +(v * P).toFixed(3), h = (v) => +(v * HB_HEAL).toFixed(3);
    return [
      F('hf_barkpoultice', 'Bark Poultice', { cls: 'herbalist', icon: 'bark', from: 'h_poultice', to: 'h_salve', lvl: 5, need: 'done', cd: 12, extra: 5, target: 'ally', range: 28,
        hit: { t: 0.45, kind: 'proj', speed: 24, arc: 0.45 }, fx: [['heal', h(2.0)], ['absorb', h(2.5), 10]], tiers: [3],
        tags: ['shell', 'fusion'], choreo: 'hf_barkpoultice', gateText: 'Mending Poultice must reach an ally', hint: 'Something warm, then something that sets.',
        carry: { a: { spreading: { healPow: 0.1 }, moss: { healPow: 0.15 } }, b: { splashjar: { splashHeal: [3, 4, 0.5] }, slowsalve: { healPow: 0.3 } } }, ai: { role: 'heal' },
        desc: 'The salve is thrown straight onto the warm poultice and hardens into a shell of sap and resin: the ally mends 2.0 at once, and the shell soaks up 2.5 of the next blows for 10 s.' }),
      F('hf_thistlenet', 'Thistle Net', { cls: 'herbalist', icon: 'dart', from: 'h_net', to: 'h_dart', lvl: 7, need: 'hit', cd: 12, extra: 5, range: 24,
        hit: { t: 0.2, kind: 'proj', speed: 50, n: 5, gap: 0.09 }, fx: [['dmg', d(0.5)], ['weak', 20, 6], ['sap', 1], ['brk', 6]], tiers: [1, 1, 1, 1, 3],
        tags: ['dart', 'fusion'], choreo: 'hf_thistlenet', gateText: 'Snare Net must strike a machine', hint: 'A held machine is an easy mark.',
        carry: { a: { weighted: { pow: 0.1 }, widenet: { splash: 3 } } }, ai: { role: 'burst' },
        desc: 'Five thistle darts pepper the netted machine one after another: each stores Sap, and the bitter sting leaves it striking 20% softer for 6 s.' }),
      F('hf_bitterroot', 'Bitterroot Tincture', { cls: 'herbalist', icon: 'potion', from: 'h_dart', to: 'h_salve', step: 3, lvl: 9, need: 'hit', cd: 10, extra: 5, range: 24,
        hit: { t: 0.42, kind: 'proj', speed: 24, arc: 0.5 }, fx: [['dmg', d(0.8)], ['healLowest', 15, h(2.1)], ['brk', 12]], tiers: [3],
        tags: ['throw', 'remedy', 'heal', 'fusion'], choreo: 'hf_bitterroot', gateText: 'The third Nettle Dart must land', hint: 'A remedy can sting the right patient.',
        carry: { b: { splashjar: { splashHeal: [3, 4, 0.5] }, slowsalve: { healPow: 0.3 } } }, ai: { role: 'heal' },
        desc: 'The salve is thrown at the machine instead, bitter and stinging: it is struck, and the most hurt ally within 15 m is washed with what splashes back (2.1).' }),
      F('hf_lanternhaze', 'Lantern Haze', { cls: 'herbalist', icon: 'lantern', from: 'h_smoke', to: 'h_lantern', lvl: 12, need: 'done', cd: 18, extra: 5, target: 'self', range: 0, selfDone: true,
        hit: { t: 0.45, kind: 'aoe', at: 'smoke', r: 6 }, fx: [['hazeSmoke', 3, h(1.0)], ['debuff', 'miss', 50, 3], ['stagger', 1.2], ['brk', 30]], tiers: [3],
        tags: ['lantern', 'smoke', 'fusion'], choreo: 'hf_lanternhaze', gateText: 'Calming Smoke must go down', hint: 'A lamp held into the smoke.',
        carry: { a: { camphor: { healPow: 0.15 }, drifting: { healPow: 0.15 } } }, ai: { role: 'heal' },
        desc: 'The lantern is held into your smoke and the smoke takes its warm light from inside: every ally in it is rid of every harmful effect and mends 1.0, and every machine in it staggers and is blinded for 3 s (half its swings miss).' }),
      F('hf_willowsteam', 'Willowbark Steam', { cls: 'herbalist', icon: 'steam', from: 'h_salve', to: 'h_smoke', lvl: 15, need: 'done', cd: 18, extra: 5, target: 'ally', range: 20,
        hit: { t: 0.6, kind: 'aoe', at: 'target', r: 6 }, fx: [['hzone', 'steam', h(0.4), 8, 6]], zoneWeak: 15, tiers: [3],
        tags: ['steam', 'zone', 'fusion'], choreo: 'hf_willowsteam', gateText: 'Soothing Salve must reach an ally', hint: 'Salve on a hot pot.',
        carry: { b: { camphor: { camphor: 1 }, drifting: { zoneFollow: true } } }, ai: { role: 'heal' },
        desc: 'The salve goes onto the hot smoke pot and it boils over into willowbark steam: for 8 s allies in it mend twice as fast for the first 4 s (0.8 a second) and run 20% faster; machines in it strike 15% softer.' }),
      F('hf_fieldhospital', 'Field Hospital', { cls: 'herbalist', icon: 'plant', from: 'h_lantern', to: 'h_remedy', lvl: 18, need: 'done', cd: 50, extra: 10, target: 'self', range: 0, cast: 0.3,
        hit: { t: 0.7, kind: 'self', r: 8 }, fx: [['heal', h(1.0)], ['hzone', 'hospital', h(0.6), 8, 8]], tiers: [5],
        tags: ['plant', 'zone', 'fusion'], choreo: 'hf_fieldhospital', gateText: 'Lantern Flash must open', hint: 'Hang the light where the wounded are.',
        carry: {}, ai: { role: 'heal' },
        desc: 'The staff is planted at a slant with the lantern hung from it and the remedies set out around it: for 8 s allies within 8 m mend 0.6 a second and take 30% less, and the first of them who would fall there stays up at 30% (once).' }),
      F('hf_sneezing', 'Sneezing Powder', { cls: 'herbalist', icon: 'powder', from: 'h_net', to: 'h_smoke', tree: 'sneezing_powder', need: 'hit', cd: 18, extra: 5, range: 20,
        hit: { t: 0.6, kind: 'aoe', at: 'target', r: 6 }, fx: [['dmg', d(0.4)], ['hzone', 'sneeze', h(0.4), 8, 6], ['brk', 20]], zoneWeak: 15, sneeze: 2, tiers: [3],
        tags: ['smoke', 'powder', 'fusion'], choreo: 'hf_sneezing', gateText: 'Snare Net must strike a machine', hint: 'Pepper in the smoke.',
        carry: { a: { weighted: { pow: 0.1 }, widenet: { r: 1.2 } }, b: { camphor: { camphor: 1 }, drifting: { zoneFollow: true } } }, ai: { role: 'control' },
        desc: 'The smoke pot goes down on the netted machine packed with ground pepper and dried thistle: for 8 s every machine in it chokes on it, its swing cut short every 2 s, while allies in it mend 0.4 a second.' }),
      F('hf_swiftroot', 'Swiftroot Toss', { cls: 'herbalist', move: true, icon: 'swift', from: 'dodge', to: 'h_salve', tree: 'swiftroot', need: 'dodge', cd: 14, extra: 5, target: 'self', range: 0, selfDone: true,
        hit: { t: 0.25, kind: 'self', r: 15 }, fx: [['healHurt', 2, h(2.0), 30, 4]], tiers: [3],
        tags: ['throw', 'remedy', 'heal', 'fusion'], choreo: 'hf_swiftroot', gateText: 'Come out of a Staff Hop', hint: 'Throw from the top of the hop.',
        carry: { b: { splashjar: { healPow: 0.1 }, slowsalve: { healPow: 0.2 } } }, ai: { role: 'heal' },
        desc: 'At the top of the hop two jars of swiftroot salve go out to the two most hurt allies within 15 m: each mends 2.0 and runs 30% faster for 4 s.' }),
      // the triad (a deep tree notable): Bark Poultice > Grand Remedy
      F('ht_fulldressing', 'Full Dressing', { cls: 'herbalist', icon: 'bark', from: 'hf_barkpoultice', to: 'h_remedy', tree: 'full_dressing', need: 'done', triad: true, cd: 50, extra: 10, target: 'self', range: 0, cast: 0.3,
        hit: { t: 0.7, kind: 'self', r: 15 }, fx: [['heal', h(3.0)], ['absorb', h(2.5), 10]], tier: 5,
        tags: ['plant', 'shell', 'triad'], choreo: 'ht_fulldressing', hint: 'Every wound bound at once.',
        carry: {}, ai: { role: 'heal' },
        desc: 'The staff is planted and the kettle loosed over the whole group: every ally within 15 m mends 3.0 and is bound in a shell of sap and resin that soaks up 2.5 for 10 s.' }),
    ];
  })(),
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

// a skill record by id: a core skill (a chain's first record) or a fusion
export const skillOf = (id) => CORE_BY_ID[id] || FUSION_BY_ID[id] || null;
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
  for (const s of CORE[p.cls] || []) eff[s.id] = s;
  for (const f of FUSIONS[p.cls] || []) { eff[f.id] = f; effFuse[f.key] = f; }
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
