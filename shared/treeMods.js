// The Skill Web's rules (docs/ai/combat_design.md 3.3, 3.4, 4.3): points, allocation, leaf refund, respec, Forms, carry
// and the hero's modifier table. treeMods replaces talentMods for classes on the Web (TREE_CLASSES) and returns the same
// shape (dmg, crit, armor, haste, cdr, aoe, sk[id]...), so damage, heal, skillCost, skillCd and set bonuses keep working.
// It adds:
//   tag[tag] = { pow, brk, radius, cost }   modifiers over tags (every leap, every shot...)
//   forms[skillId] = optionId               the Form picked for each core skill (from allocated Form nodes)
//   keys = [keystoneId...], hooks = [notableHookId...]   (shared/keystones.js runs them)
//   fu[fusionId] = 1                        fusions and triads unlocked by tree notables
//   link (s), linkSk[skillId] (s), fuse, fuseCost, brk, range, vs[state], skfx[skillId] = [fx...], flags[name] = 1,
//   plus every keystone's flat mods (linkSet, linkMul, chainwork, dodgeCharges, parryWin...).
// compileEff(rec, tal) is steps 2-5 of compileKit (3.3): the Form patch, the fusion's carry from its inputs' Forms, the
// keystone patches and renames, and the tag, skill-fx and fusion-power numbers. The fusion engine (S2) calls it for every
// core skill and fusion when it builds p.eff; the result already holds tag pow, tal.fuse and skfx, so the cast path must not
// apply those again (tal.sk[id] pow/cd/cost and the flat dmg/aoe stay runtime, as today).
import { TREE_NODES, TREE_BY_ID, TREE_START, TREE_V } from './tree.js';
import { KEYSTONES, keyCompile } from './keystones.js';
import { STORY } from './story.js';
import { LINK, compileKit, fusionUnlocked } from './fusions.js';

export { TREE_V };
export const TREE_CLASSES = new Set(['knight', 'sandblade', 'warden', 'deadeye', 'ranger', 'chemist']); // classes on the Web (the others keep talents until their slice: S8-S13)
export const onWeb = (cls) => TREE_CLASSES.has(cls);
export const TREE_FREE_LEVEL = 20; // refunds and resets are free at this level and below
export const TREE_FREE_DAYS = 14; // after the move from talents
export const leafRefundCost = (level) => 2 * level; // copper, one leaf node
export const treeResetCost = (level) => 50 * level; // copper (today's talentResetCost)

// ---------------------------------------------------------------------------------------------- points (4.3)
const CHAPTER_END = STORY.map((C) => C.steps[C.steps.length - 1][0]);
const CHAPTER_ID = Object.fromEntries(STORY.map((C, i) => [C.id, CHAPTER_END[i]]));
export const chaptersDone = (done = {}) => CHAPTER_END.filter((q) => done[q]).length;
export const chapterDone = (done = {}, ch) => !!(CHAPTER_ID[ch] && done[CHAPTER_ID[ch]]);
// 1 a level from level 2, and 1 for every three Main Story chapters (84 at level 70 with Chapter 45)
export const treePoints = (level, done) => Math.max(0, (level | 0) - 1) + Math.floor(chaptersDone(done) / 3);
export const treeSpent = (alloc) => Object.keys(alloc || {}).filter((id) => alloc[id] && TREE_BY_ID[id] && TREE_BY_ID[id].kind !== 'start').length;

// ---------------------------------------------------------------------------------------------- allocation and refund
const held = (cls, alloc, id) => id === TREE_START[cls] || !!alloc?.[id];
// why a node cannot be taken now, or null
export function allocBlock(cls, alloc, id, pts) {
  const n = TREE_BY_ID[id];
  if (!n) return 'There is no such place on the Web.';
  if (n.kind === 'start') return 'That is a class start.';
  if (alloc?.[id]) return 'You already hold that.';
  if (!TREE_START[cls]) return 'Your class is not on the Web yet.';
  if (!n.adj.some((a) => held(cls, alloc, a))) return 'That is not joined to anything you hold.';
  if (pts != null && pts <= 0) return 'No Web points left.';
  return null;
}
// the nodes still joined to the start after taking `skip` out
function joined(cls, alloc, skip) {
  const seen = new Set([TREE_START[cls]]), st = [TREE_START[cls]];
  while (st.length) { const id = st.pop(); for (const a of TREE_BY_ID[id].adj) if (a !== skip && !seen.has(a) && alloc[a]) { seen.add(a); st.push(a); } }
  return seen;
}
// a leaf can be refunded on its own: everything else stays joined to the start
export function isLeaf(cls, alloc, id) {
  if (!alloc?.[id] || !TREE_START[cls]) return false;
  const seen = joined(cls, alloc, id);
  return Object.keys(alloc).every((k) => k === id || !alloc[k] || seen.has(k));
}
// drop anything no longer joined to the start (after a Web change); returns the cleaned allocation
export function pruneAlloc(cls, alloc = {}) {
  const ok = {};
  for (const [k, v] of Object.entries(alloc)) if (v && TREE_BY_ID[k] && TREE_BY_ID[k].kind !== 'start') ok[k] = 1;
  if (!TREE_START[cls]) return {};
  const seen = joined(cls, ok);
  return Object.fromEntries(Object.keys(ok).filter((k) => seen.has(k)).map((k) => [k, 1]));
}
// the shortest road from what the hero holds to a node (for "path to here"): node ids to take, in order
export function pathTo(cls, alloc, id) {
  if (!TREE_BY_ID[id] || !TREE_START[cls]) return null;
  const prev = new Map(), q = [], seen = new Set();
  for (const k of [TREE_START[cls], ...Object.keys(alloc || {}).filter((k) => alloc[k])]) { seen.add(k); q.push(k); }
  while (q.length) {
    const c = q.shift();
    if (c === id) break;
    for (const a of TREE_BY_ID[c].adj) if (!seen.has(a) && TREE_BY_ID[a].kind !== 'start') { seen.add(a); prev.set(a, c); q.push(a); }
  }
  if (!seen.has(id)) return null;
  const out = [];
  for (let c = id; prev.has(c); c = prev.get(c)) out.unshift(c);
  return out;
}
// a respec is free at level 20 and below, for 14 days after the move, and after any Web change
export const freeRespec = (p, now = Date.now()) => (p.level || 1) <= TREE_FREE_LEVEL || (p.treeFree || 0) > now;

// ---------------------------------------------------------------------------------------------- Forms
// the option a Form node gives: the picked one if allowed (zone options need their chapter), else the first
export function formOpt(node, forms = {}, done = {}) {
  const want = forms[node.id];
  const o = node.form.opts.find((x) => x.id === want);
  if (o && (!o.need?.ch || chapterDone(done, o.need.ch))) return o;
  return node.form.opts[0];
}
export const formAllowed = (node, optId, done = {}) => { const o = node?.form?.opts.find((x) => x.id === optId); return !!o && (!o.need?.ch || chapterDone(done, o.need.ch)); };

// ---------------------------------------------------------------------------------------------- the modifier table
const BASE = () => ({ dmg: 0, hp: 0, armor: 0, haste: 0, crit: 0, critDmg: 0, heal: 0, regen: 0, speed: 0, leech: 0, thorns: 0, cost: 0, dot: 0, aoe: 0, execute: 0, opener: 0, killRes: 0, dodge: 0, cdr: 0, threat: 0, ccDur: 0, absorb: 0, lastStand: 0, sk: {},
  tag: {}, forms: {}, formNode: {}, keys: [], hooks: [], fu: {}, link: 0, linkSk: {}, fuse: 0, fuseCost: 0, brk: 0, range: 0, vs: {}, skfx: {}, flags: {} });
export function treeMods(cls, alloc = {}, o = {}) {
  const m = BASE();
  const forms = o.forms || {}, done = o.done || {};
  for (const id of Object.keys(alloc || {})) {
    const n = TREE_BY_ID[id];
    if (!n || !alloc[id] || n.kind === 'start') continue;
    if (n.kind === 'form') { const opt = formOpt(n, forms, done); m.forms[n.form.skill] = opt.id; m.formNode[n.form.skill] = n.id; continue; }
    for (const e of n.e || []) {
      switch (e[0]) {
        case 'sk': { const s = (m.sk[e[1]] ||= { pow: 0, cd: 0, cost: 0 }); s[e[2]] += e[3]; break; }
        case 'tag': { const t = (m.tag[e[1]] ||= { pow: 0, brk: 0, radius: 0, cost: 0 }); t[e[2]] = (t[e[2]] || 0) + e[3]; break; }
        case 'linkSk': m.linkSk[e[1]] = (m.linkSk[e[1]] || 0) + e[2]; break;
        case 'vs': m.vs[e[1]] = (m.vs[e[1]] || 0) + e[2]; break;
        case 'skfx': (m.skfx[e[1]] ||= []).push(e[2]); break;
        case 'fu': m.fu[e[1]] = 1; break;
        case 'key': m.keys.push(e[1]); break;
        case 'hook': m.hooks.push(e[1]); break;
        case 'flag': m.flags[e[1]] = 1; break;
        default: m[e[0]] = (m[e[0]] || 0) + e[1];
      }
    }
  }
  m.keys.sort(); m.hooks.sort();
  for (const k of m.keys) for (const [kk, v] of Object.entries(KEYSTONES[k]?.mods || {})) m[kk] = typeof v === 'number' && typeof m[kk] === 'number' ? m[kk] + v : v;
  // linkWin: seconds added to the link window (the fusion engine's p.tal.linkWin): Long Breath sets 2.0 s, Hair Trigger halves it
  let win = (m.linkSet || LINK.win) + m.link;
  if (m.linkMul) win *= m.linkMul;
  m.linkWin = +(win - LINK.win).toFixed(3);
  return m;
}

// ---------------------------------------------------------------------------------------------- compile (3.3 steps 2-5)
const copy = (r) => ({ ...r, fx: (r.fx || []).map((e) => [...e]), hit: r.hit ? { ...r.hit } : r.hit, tags: [...(r.tags || [])], ...(r.seq ? { seq: r.seq.map((q) => ({ ...q, fx: (q.fx || []).map((e) => [...e]) })) } : {}) });
// (S10) a record with seq (one { hit, fx } a contact) has its numbers changed in each contact's own fx too
const fxSet = (r, kind, f) => { let hit = false; r.fx = r.fx.map((e) => { if (e[0] !== kind) return e; hit = true; return f(e); }); for (const q of r.seq || []) q.fx = q.fx.map((e) => { if (e[0] !== kind) return e; hit = true; return f(e); }); return hit; };
// one Form option's or carry rule's mods on a record (the fixed list in 3.4 plus the carry keys of section 5)
export function applyMods(r, mods = {}) {
  for (const [k, v] of Object.entries(mods)) {
    switch (k) {
      case 'hang': r.hang = (r.hang || 0) + v; if (!fxSet(r, 'slamDown', (e) => [e[0], +(e[1] + v).toFixed(3)]) && !fxSet(r, 'holdLift', (e) => [e[0], e[1] + v])) r.fx.push(['holdLift', v]); break; // (Stormfall slams the machine down: the hang is the hero's at the top and the machine lies down longer, S5)
      case 'airMul': if (!fxSet(r, 'air', (e) => [e[0], +(e[1] * (1 + v)).toFixed(3)])) r.fx.push(['air', +(1 + v).toFixed(3)]); break;
      case 'leap': fxSet(r, 'leap', () => ['leap', v]); r.range = Math.max(r.range || 0, v); break;
      case 'range': r.range = v; break;
      case 'r': if (r.hit) r.hit.r = +((r.hit.r || 1) * v).toFixed(2); break;
      case 'radius': if (r.hit) { r.hit.r = v; if (mods.kind) r.hit.kind = mods.kind; } break;
      case 'kind': break;
      case 'shape': r.shape = v; if (r.hit && v === 'line') { r.hit.kind = 'line'; r.hit.r = mods.range || r.hit.r; } break; // (Arc Wave: the sweep runs on as a line along the ground)
      case 'pow': fxSet(r, 'dmg', (e) => [e[0], +(e[1] * (1 + v)).toFixed(3), ...e.slice(2)]); break;
      case 'lift': if (!fxSet(r, 'launch', () => ['launch', v])) r.fx.push(['launch', v]); break;
      case 'step': break;
      case 'cd': r.cd = v; break;
      case 'brk': if (!fxSet(r, 'brk', (e) => [e[0], e[1] + v])) r.fx.push(['brk', v]); break;
      case 'slow': if (!fxSet(r, 'slow', () => ['slow', ...v])) r.fx.push(['slow', ...v]); break;
      case 'hits': if (r.hit) r.hit.n = v; r.hits = v; break;
      // (S8, the Sandblade) a heated blade: a heat dot and the heat tag (Ignite); a pull toward the hero
      case 'heat': r.fx.push(['dot', v, 4]); if (!r.tags.includes('heat')) r.tags.push('heat'); break;
      case 'pull': if (!fxSet(r, 'pull', () => ['pull', v])) r.fx.unshift(['pull', v]); break;
      case 'gap': if (r.hit) r.hit.gap = v; break;
      // (S9, the Warden) Iron Weight's x2 poise and 20% slower swing; Long Haft's cone; Unstoppable's longer charge; Hammer
      // Toss (Earthsplitter thrown: out and back, two contacts); Wall Pin (a wall slam stuns 3 s)
      case 'brkMul': fxSet(r, 'brk', (e) => [e[0], Math.round(e[1] * v)]); break;
      case 'tempo': r.tempo = v; break; // (the sim plays the cast at haste / tempo: contacts, lock and the clip all slower)
      case 'cone': if (r.hit) r.hit.cone = v; break;
      case 'dash': fxSet(r, 'dash', () => ['dash', v]); r.range = Math.max(r.range || 0, v + 2); break;
      case 'toss': r.hit = { t: 0.45, kind: 'proj', speed: 22, n: 2, gap: 0.6 }; r.range = 20; r.toss = true; break;
      case 'wallPin': if (!r.fx.some((e) => e[0] === 'wallSlam')) r.fx.push(['wallSlam', v]); r.wallStun = true; break;
      // (S10, the Deadeye) High Recoil's extra apex shot (one more contact like the last); Rock Salt's stacking slow
      case 'addShot': if (r.seq && r.hit) { for (let i = 0; i < v; i++) { r.seq.push({ ...r.seq[r.seq.length - 1] }); const ts = r.hit.ts || [r.hit.t]; r.hit = { ...r.hit, n: (r.hit.n || 1) + 1, ts: [...ts, +(ts[ts.length - 1] + 0.12).toFixed(3)] }; if (r.tiers) r.tiers = [...r.tiers.slice(0, -1), 2, r.tiers[r.tiers.length - 1]]; } } break;
      case 'slowStack': r.fx.push(['slowStack', v, 3, 40]); break;
      case 'back': fxSet(r, 'back', () => ['back', v]); break; // (High Recoil: thrown 10 m)
      case 'knockFlat': if (!fxSet(r, 'slamDown', () => ['slamDown', v])) r.fx.push(['slamDown', v]); break; // (Wide Bore: the machines knocked flat)
      // (S11, the Ranger) an added effect (Bodkin Hail's armour break, Tar-Head's coat); Ricochet's bounces; Ridgeline's wider stretch
      case 'addFx': for (const e of v) r.fx.push([...e]); break;
      case 'bounceN': fxSet(r, 'bounce', (e) => [e[0], v, ...e.slice(2)]); break;
      case 'segW': if (r.hit) r.hit.segW = v; break;
      // (S12, the Chemist) Cluster: the bomb splits into three smaller ones that land side by side (0.42 each, 60% of the
      // reach, 0.12 s apart); Splash Flask: every flask splashes; Sticky Charge: the bomb sticks to the machine and goes with it
      case 'cluster': if (r.hit && !r.hit.cluster) { const t0 = r.hit.ts ? r.hit.ts[0] : r.hit.t; r.hit = { ...r.hit, t: t0, n: 3, ts: [t0, +(t0 + 0.12).toFixed(3), +(t0 + 0.26).toFixed(3)], r: +((r.hit.r || 4) * 0.6).toFixed(2), cluster: 1.8 }; delete r.hit.gap; fxSet(r, 'dmg', (e) => [e[0], +(e[1] * 0.42).toFixed(3), ...e.slice(2)]); const tl = r.tiers?.[r.tiers.length - 1] ?? r.tier ?? 3; r.tiers = [2, 2, tl]; } break;
      case 'splash': if (r.hit) r.hit.r = Math.max(r.hit.r || 0, v); break;
      case 'sticky': if (r.hit) r.hit.at = 'target'; r.sticky = true; break;
      case 'hotTar': r.hotTar = true; if (!r.tags.includes('heat')) r.tags.push('heat'); break;
      default: r[k] = v; // noTarget, single, allLifted, step3, shape, field, onRun, charges, split, pierce, chain, coat, parryWin...
    }
  }
  return r;
}
// rec: a core skill or a fusion record (from kit.js / fusions.js). tal: treeMods(...) (or p.tal). Returns a new record.
export function compileEff(rec, tal, ctx = {}) {
  if (!rec) return rec;
  const r = copy(rec);
  if (!tal) return r;
  // 2. the Form patch on a core skill
  const opt = tal.forms?.[r.id];
  if (opt && !r.from) {
    const node = TREE_BY_ID[tal.formNode?.[r.id]], o = node?.form.opts.find((x) => x.id === opt);
    // (an option for one step of a chain, mods.step, patches only that step's record)
    if (o) { if (!o.mods.step || [].concat(o.mods.step).includes(r.step)) { // (a list of steps: Twin Cut's 1 and 2, S8)
      applyMods(r, o.mods); if (o.choreo) r.formChoreo = o.choreo; } r.form = opt; r.formName = o.name; }
  }
  // 3. a fusion carries its inputs' Forms through its own carry rules
  if (r.from && r.carry) {
    r.carried = [];
    for (const [side, input] of [['a', r.from], ['b', r.to], ...Object.keys(r.carry).filter((k) => k !== 'a' && k !== 'b').map((k) => [k, k])]) { // (S10: a rule keyed by a skill id, Snap Shot's Forms into Falling Storm)
      const pick = tal.forms?.[input], rule = pick && r.carry[side]?.[pick];
      if (rule) { applyMods(r, rule); r.carried.push(pick); }
    }
  }
  // 4. keystones over tags, which may rename
  keyCompile(r, tal.keys || [], { ...ctx, tal });
  // 5. numbers: tag modifiers, a notable's added effects, fusion power
  for (const t of r.tags) {
    const T = tal.tag?.[t];
    if (!T) continue;
    if (T.pow) fxSet(r, 'dmg', (e) => [e[0], +(e[1] * (1 + T.pow)).toFixed(3), ...e.slice(2)]);
    if (T.brk) fxSet(r, 'brk', (e) => [e[0], Math.round(e[1] * (1 + T.brk))]);
    if (T.radius && r.hit?.r) r.hit.r = +(r.hit.r * (1 + T.radius)).toFixed(2);
    if (T.cost) r.cost = Math.max(0, Math.round((r.cost || 0) * (1 - T.cost)));
  }
  // the Web's range nodes (Sightline on the bridges, +4% each; S5 review: they did nothing for the Knight): every reach past
  // melee, a leap's or a dash's distance with it (melee reach and self skills stay as they are)
  if (tal.range && (r.range || 0) > 5) { r.range = +(r.range * (1 + tal.range)).toFixed(2); fxSet(r, 'leap', (e) => [e[0], +(e[1] * (1 + tal.range)).toFixed(2)]); fxSet(r, 'dash', (e) => [e[0], +(e[1] * (1 + tal.range)).toFixed(2)]); }
  for (const f of tal.skfx?.[r.id] || []) r.fx.push([...f]);
  if (r.from && tal.fuse) fxSet(r, 'dmg', (e) => [e[0], +(e[1] * (1 + tal.fuse)).toFixed(3), ...e.slice(2)]);
  return r;
}

// the hero's compiled kit with the Web applied: p.eff and p.effFuse (built by compileKit) rebuilt through compileEff. A
// chain skill compiles step by step and keeps its chain list. Called by recalc right after compileKit for a hero on the Web
export function treeCompile(p) {
  const tal = p.tal;
  if (!p.eff || !tal) return p;
  const out = {};
  for (const [id, r] of Object.entries(p.eff)) {
    if (!r?.chain) { out[id] = compileEff(r, tal); continue; }
    const steps = r.chain.map((s) => compileEff(s, tal));
    for (const s of steps) s.chain = steps;
    out[id] = steps[0];
  }
  const ef = {};
  // (S11) a keystone may re-key a fusion (One Arrow: the fusions with Quick Shot take Piercing Arrow): the compiled record's own
  // from > to keys it, an unlocked fusion before a locked one on the same pair
  for (const [k, f] of Object.entries(p.effFuse || {})) { const g = out[f.id] || compileEff(f, tal), k2 = g.from + '>' + g.to; if (!ef[k2] || (fusionUnlocked(p, g) && (!fusionUnlocked(p, ef[k2]) || k2 === k))) ef[k2] = g; }
  p.eff = out; p.effFuse = ef;
  return p;
}

// the client's copy of a hero's compiled kit (tooltips, the bar, the Fusion Book): from the hero's state (you.tree,
// you.forms, you.done) the same way recalc builds p.eff; tal: its treeMods table if already made
export function webEff(you, tal) {
  const q = { cls: you.cls, level: you.level, tree: you.tree || {}, tal: tal || treeMods(you.cls, you.tree || {}, { forms: you.forms, done: you.done }) };
  compileKit(q);
  treeCompile(q);
  return q.eff;
}

// every Web id the tree names (for lint and tests)
export const treeIds = () => ({
  forms: TREE_NODES.filter((n) => n.kind === 'form').map((n) => n.form.skill),
  fusions: TREE_NODES.filter((n) => n.kind === 'fusion' || n.kind === 'triad').flatMap((n) => n.e.filter((e) => e[0] === 'fu').map((e) => e[1])),
  keys: TREE_NODES.filter((n) => n.kind === 'keystone').map((n) => n.id),
});
