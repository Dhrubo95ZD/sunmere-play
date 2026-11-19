// The combat HUD of stage S6 (docs/ai/combat_design.md 2.10, 6.1, 6.2): the morphing skill bar, the link line, the fusion
// pill and toast, the dodge chip, two pinned fusions, the combo counter, the target's poise bar and haptics on phones.
// Only a class on the new kit (KIT_V2) gets the morph, the chip and the pins; every other class keeps its bar as it is.
// The touch wheel (ui/touch.js) reads the same fusion state through fuseFor() and morphs its buttons the same way.
import { KIT_V2, DODGES, CHAIN_RESET } from '/sunmere-play/shared/kit.js';
import { FUSE, FUSION_BY_ID, LINK, fusionUnlocked, gateOk, skillOf } from '/sunmere-play/shared/fusions.js';
import { dodgeFor, dodgeWith, POISE } from '/sunmere-play/shared/feel.js';
import { effName } from '/sunmere-play/shared/keystones.js';
import { skillIcon } from './icons.js';
import { SETTINGS, saveSettings, keyFor, keyLabel } from '../engine/settings.js';
import { IS_TOUCH } from '../engine/platform.js';
import { haptic } from '../engine/haptics.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const DODGE_ICON = '/sunmere-play/ui/icons/dodge.webp';
export const CLEAN_FIRST = 0.35; // Clean Link: the first 0.35 s of a window (combat_design.md 4.4)

// ------------------------------------------------------------------ haptics (2.10): light on T3, medium on T4, a light
// tick when a link window opens on a phone. Capacitor's Haptics plugin when the app has it, else the page's vibrate.
// The "Vibration" option (SETTINGS.vibrate) is on by default; desktops never vibrate
// (S14: moved to client/engine/haptics.js, phones only; the hits buzz from fx.tierHit on the contact frame)
export { haptic };

// ------------------------------------------------------------------ the fusion a skill would make now
// The link (this client's own predicted one, then the server's), an authored pair, unlocked, inside the window with the
// grace, and its gate as far as the client can see it (as game.js predictFusion does). A fusion still cooling is
// returned too, with cooling: the slot shows a grey rim and B casts plain
const seen = (v, st) => (st === 'lifted' ? v?.react?.kind === 'air' : st === 'staggered' ? v?.react?.kind === 'stag' || v?.react?.kind === 'broken' || (v?.stunUntil || 0) > performance.now() : false);
export function fuseFor(game, ui, id, now) {
  const y = game.you, fuse = y && KIT_V2[game.cls] && FUSE[game.cls];
  if (!fuse) return null;
  const opening = (y.buffs || []).some((b) => b.name === 'Opening');
  for (const L of [game.plink, y.link]) {
    if (!L) continue;
    const f = fuse[L.from + '>' + id];
    if (!f || !fusionUnlocked(y, f) || now > L.until + LINK.grace) continue;
    if (f.target === 'enemy' && L.tgt && game.entities.get(L.tgt)?.dead) continue;
    const tv = f.target === 'enemy' ? (game.target && game.entities.get(game.target)) || (L.tgt && game.entities.get(L.tgt)) : null;
    if (!gateOk(f, L, tv, opening, seen)) continue;
    const rec = (y.web && ui.eff?.[f.id]) || f, at = L.at ?? L.until - LINK.win - (ui.tmods?.linkWin || 0);
    return { f, rec, L, name: effName(rec) || f.name, known: (y.fusions || []).includes(f.id), cooling: (y.cds?.[f.id] || 0) > now + 0.02,
      frac: clamp01((L.until - now) / Math.max(0.05, L.until - at)), clean: !!ui.tmods?.keys?.includes('clean_link') && now - at < CLEAN_FIRST, at };
  }
  return null;
}
// the record a slot shows for a fusion state: the fusion's own painted icon, or a "?" plate before it is discovered
export const fuseIcon = (st) => skillIcon(st.f);

// a morph applied to one button (bar slot or wheel button): classes and the icon swap, written only when they change.
// S: { el, img, base (the skill's own icon), fz (cache) }
export function morph(S, st) {
  const key = st ? `${st.f.id}|${st.known ? 1 : 0}|${st.cooling ? 1 : 0}|${st.clean ? 1 : 0}` : '';
  if (S.fzKey !== key) {
    const was = S.fzKey;
    S.fzKey = key;
    S.el.classList.toggle('fz', !!st && !st.cooling);
    S.el.classList.toggle('fz-unk', !!st && !st.known && !st.cooling);
    S.el.classList.toggle('fz-cool', !!st?.cooling);
    S.el.classList.toggle('fz-clean', !!st?.clean && !st.cooling);
    const src = st && !st.cooling ? fuseIcon(st) : S.base;
    if (S.img && S.img.getAttribute('src') !== src) S.img.src = src;
    if (st && !st.cooling && !was) { S.el.classList.remove('fz-in'); void S.el.offsetWidth; S.el.classList.add('fz-in'); }
    else if (!st || st.cooling) S.el.classList.remove('fz-in');
    S.el.dataset.fz = st && !st.cooling ? st.f.id : '';
  }
  if (st && !st.cooling) { const w = (st.frac * 100).toFixed(1) + '%'; if (S.fzw && S.fzw.style.width !== w) S.fzw.style.width = w; }
}

// ------------------------------------------------------------------ pinned fusions (3.2): two slots; a press casts A and
// buffers B with the same result, cost and gates as pressing them in turn. SETTINGS.pins[cls] = [id, id]
export const pinsOf = (cls) => { const p = SETTINGS.pins?.[cls]; return [p?.[0] || null, p?.[1] || null]; };
export function setPin(cls, i, id) {
  const p = pinsOf(cls);
  if (id) { const o = p.indexOf(id); if (o >= 0 && o !== i) p[o] = p[i]; }
  p[i] = id || null;
  (SETTINGS.pins ||= {})[cls] = p; saveSettings();
}
export const pinnable = (f) => !!f && !f.triad;
export function pinCast(game, ui, id) {
  const f = FUSION_BY_ID[id], y = game.you;
  if (!f || !y) return false;
  if (!fusionUnlocked(y, f)) { ui.error(f.lvl ? `${f.name} opens at level ${f.lvl}.` : `${f.name} needs its notable on the Skill Web.`); return false; }
  if (f.from === 'dodge') { game.dodge?.(); game.useSkill(f.to); return true; }
  const t0 = game.lastCast?.t0;
  game.useSkill(f.from);
  // A went off now: B follows into its window (held to A's contact); A held in the buffer: B goes once A fires
  if (game.lastCast && game.lastCast.t0 !== t0) game.useSkill(f.to);
  else ui.combat.pend = { a: f.from, b: f.to, t0, until: performance.now() + 450 };
  return true;
}
// drag-fuse on the wheel (6.2): A went off on the press; lifting on B presses B into A's window (or the buffer)
export function dragFuse(game, ui, bId) { game.useSkill(bId); haptic('light'); }

// ------------------------------------------------------------------ the HUD itself
export class CombatHud {
  constructor(ui) {
    this.ui = ui; this.g = ui.g;
    this.combo = { n: 0, t: 0, shown: 0 };
    this.linkAt = -1; this.react = null; this.pend = null; this.toastT = 0;
    const hud = ui.hud;
    this.toast = el('div', 'fz-toast'); hud.appendChild(this.toast);
    this.pill = el('div', 'fz-pill hidden'); hud.appendChild(this.pill);
  }
  get on() { return !!KIT_V2[this.g.cls]; }
  // a pinned fusion's key (game.js): cast it, or say how to pin one
  pin(i) { const id = pinsOf(this.g.cls)[i]; if (id) pinCast(this.g, this.ui, id); else this.ui.error('Nothing pinned there. Pin a fusion in the Fusion Book (K).'); }
  // the desktop bar (ui.buildActionBars): morph handles on each slot, chain pips on slot 1, the dodge chip, the pins
  buildBar(slots, row) {
    if (!this.on) return;
    const bars = row.closest('.actionbars');
    bars.classList.add('kit2');
    for (const sl of slots) {
      sl.base = skillIcon(sl.s); sl.img = $('img', sl.el);
      sl.fzw = el('i', 'fzw'); sl.el.appendChild(sl.fzw);
      sl.el.appendChild(el('b', 'fzq', '?'));
      if (sl.s.chain) { sl.pips = el('span', 'chpips', sl.s.chain.map(() => '<i></i>').join('')); sl.el.appendChild(sl.pips); }
    }
    const D = DODGES[this.g.cls];
    const dc = el('div', 'slot dchip');
    dc.innerHTML = `<img src="${DODGE_ICON}" alt=""><div class="cd"></div><span class="key"></span><span class="dpips"></span>`;
    dc.addEventListener('click', () => this.g.dodge?.());
    dc.addEventListener('mouseenter', (e) => this.ui.showTip(e, this.dodgeTip()));
    dc.addEventListener('mouseleave', () => this.ui.hideTip());
    row.appendChild(dc);
    this.dchip = { el: dc, cd: $('.cd', dc), key: $('.key', dc), pips: $('.dpips', dc), n: -1, name: D?.name };
    // (S10) Six Chambers: the twelve round pips, the right and the left pistol's six each in a straight row (never a ring)
    if (this.g.cls === 'deadeye') {
      const rd = el('div', 'rounds hidden', '<span class="cyl r">' + '<i></i>'.repeat(6) + '</span><span class="cyl l">' + '<i></i>'.repeat(6) + '</span>');
      row.appendChild(rd);
      this.rounds = { el: rd, r: [...$('.cyl.r', rd).children], l: [...$('.cyl.l', rd).children], k: null };
    }
    const pins = el('div', 'ab pins');
    pins.innerHTML = [0, 1].map((i) => `<div class="slot pin" data-i="${i}"><img alt=""><div class="cd"></div><span class="key"></span><span class="cdt"></span><b class="pin-plus"></b></div>`).join('');
    bars.appendChild(pins);
    this.pins = [...pins.children].map((e, i) => ({ el: e, img: $('img', e), cd: $('.cd', e), key: $('.key', e), cdt: $('.cdt', e), i, id: undefined }));
    for (const P of this.pins) {
      P.el.addEventListener('click', () => { const id = pinsOf(this.g.cls)[P.i]; if (id) pinCast(this.g, this.ui, id); else this.ui.openBook?.(); });
      P.el.addEventListener('contextmenu', (e) => { e.preventDefault(); setPin(this.g.cls, P.i, null); this.ui.hideTip(); });
      P.el.addEventListener('mouseenter', (e) => this.ui.showTip(e, this.pinTip(P.i)));
      P.el.addEventListener('mouseleave', () => this.ui.hideTip());
    }
    this.line = el('div', 'fz-lines'); bars.appendChild(this.line);
    this.bars = bars;
  }
  dodgeTip() {
    const y = this.g.you, D = y?.web ? dodgeWith(this.g.cls, this.ui.tmods) : dodgeFor(this.g.cls), nm = (y?.web && this.ui.tmods?.keys?.includes('oathbound')) ? 'Shield Step' : DODGES[this.g.cls]?.name || 'Dodge';
    return `<div class="tt-name">${nm} <span class="tt-sub">(${keyLabel(keyFor('dodge'))})</span></div><div class="tt-row"><span>${D.charges} charges</span><span>${D.regen.toFixed(1)} sec each</span></div><div class="tt-desc">A roll the way you move, or a hop back. Dodging a blow just as it lands gives Opening. The dodge counts as the first skill of a fusion.</div>`;
  }
  pinTip(i) {
    const id = pinsOf(this.g.cls)[i], f = id && FUSION_BY_ID[id], k = this.pinKey(i);
    if (!f) return `<div class="tt-name">Pinned fusion ${i + 1} <span class="tt-sub">(${k})</span></div><div class="tt-desc">Empty. Pin a fusion from the Fusion Book (K), and this key casts both of its skills in turn.</div>`;
    const rec = (this.g.you?.web && this.ui.eff?.[id]) || f;
    return `<div class="tt-name">${effName(rec)} <span class="tt-sub">(${k})</span></div><div class="tt-desc">Casts ${skillOf(f.from)?.name || DODGES[this.g.cls]?.name || 'the dodge'}, then ${skillOf(f.to)?.name} in its window.</div><div class="tt-hint">Right-click to unpin</div>`;
  }
  pinKey(i) { return keyLabel(keyFor('pin' + (i + 1)) || keyFor('skill' + (21 + i))) || ''; }
  // a fusion went off (from the cast or the server's swap): its name low centre for 0.9 s; the first time "New fusion: ..."
  fusionToast(name, isNew) {
    const t = this.toast, now = performance.now();
    if (!isNew && this.newToast?.name === name && now < this.newToast.until) return; // ("New fusion: ..." stays up over the cast's own toast)
    if (isNew) this.newToast = { name, until: now + 2400 };
    t.innerHTML = isNew ? `<small>New fusion</small><b>${name}</b>` : `<b>${name}</b>`;
    t.classList.remove('on', 'new'); void t.offsetWidth; t.classList.add('on'); if (isNew) t.classList.add('new');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.remove('on', 'new'), isNew ? 2400 : 900);
  }
  // every damage event (ui.meterEvent): the combo counter and haptics on your own heavy contacts
  onDmg(ev) {
    if (ev.src !== this.g.localId) return;
    const now = performance.now();
    if (now - this.combo.t > 2000) this.combo.n = 0;
    this.combo.n++; this.combo.t = now;
  }
  update(now) {
    const g = this.g, y = g.you;
    if (!y) return;
    const on = this.on;
    // a pinned press whose A was held in the buffer: B follows once A goes off
    const P = this.pend;
    if (P) { if (g.lastCast && g.lastCast.t0 !== P.t0 && g.lastCast.id === P.a) { this.pend = null; g.useSkill(P.b); } else if (performance.now() > P.until) this.pend = null; }
    // a fusion cast (this client's press, or the server's swap): the toast
    const lc = g.lastCast;
    if (lc && lc !== this.lastLc) { this.lastLc = lc; this.lastLcId = lc.id; if (lc.sk?.from) this.fusionToast(effName((y.web && this.ui.eff?.[lc.id]) || lc.sk), false); }
    else if (lc && lc.id !== this.lastLcId) { this.lastLcId = lc.id; if (lc.sk?.from) this.fusionToast(effName((y.web && this.ui.eff?.[lc.id]) || lc.sk), false); }
    if (on && this.bars) this.updateBar(now);
    this.updateCombo();
    this.updatePoise();
  }
  updateBar(now) {
    const g = this.g, y = g.you, ui = this.ui;
    const states = [];
    for (const sl of ui.slots) {
      const st = sl.s.lvl <= y.level ? fuseFor(g, ui, sl.s.id, now) : null;
      morph(sl, st);
      if (st && !st.cooling) states.push([sl, st]);
      if (sl.pips) {
        const ch = g.chain && g.chain.id === sl.s.id && now - g.chain.at <= CHAIN_RESET ? g.chain.step : 0;
        if (sl.pipN !== ch) { sl.pipN = ch; [...sl.pips.children].forEach((p, i) => p.classList.toggle('on', i < ch)); }
      }
    }
    // the link line: once per window, a bright line along the bar's top from A's slot to each slot that would fuse
    const L = states[0]?.[1].L;
    if (L && states[0][1].at !== this.linkAt) {
      this.linkAt = states[0][1].at;
      const from = L.from === 'dodge' ? this.dchip.el : ui.slots.find((s) => s.s.id === L.from)?.el;
      if (from) this.drawLines(from, states.map(([s]) => s.el));
    }
    // the pill above the bar: the fusion names (a "?" for one not found yet), with their keys
    const pill = this.pill, txt = states.map(([sl, st]) => `<span class="${st.known ? '' : 'unk'}${st.clean ? ' clean' : ''}"><i>${sl.el.querySelector('.key')?.textContent || ''}</i>${st.known ? st.name : '?'}</span>`).join('');
    if (pill.dataset.k !== txt) { pill.dataset.k = txt; pill.innerHTML = txt; pill.classList.toggle('hidden', !txt); if (txt) { pill.classList.remove('pop'); void pill.offsetWidth; pill.classList.add('pop'); } }
    // the dodge chip: charges as pips, the next charge's sweep
    const D = y.web ? dodgeWith(g.cls, ui.tmods) : dodgeFor(g.cls), c = g.dodgeC || { n: D.charges, next: 0 };
    let n = c.n, next = c.next;
    while (n < D.charges && next && now >= next) { n++; next = n < D.charges ? next + D.regen : 0; }
    const dc = this.dchip;
    if (dc.n !== n || dc.max !== D.charges) { dc.n = n; dc.max = D.charges; dc.pips.innerHTML = Array.from({ length: D.charges }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join(''); dc.el.classList.toggle('nores', n < 1); }
    const kl = keyLabel(keyFor('dodge'));
    if (dc.key.textContent !== kl) dc.key.textContent = kl;
    const left = n < D.charges && next ? next - now : 0;
    dc.cd.style.background = left > 0 && n < 1 ? `conic-gradient(rgba(0,0,0,0.72) ${clamp01(left / D.regen) * 360}deg, transparent 0)` : 'none';
    // (S10) Six Chambers: rounds left in each pistol; the hot loads of a perfect reload glow on the next shots
    if (this.rounds) {
      const R0 = y.rounds, key = R0 ? R0.join(',') : '';
      if (this.rounds.k !== key) {
        this.rounds.k = key; this.rounds.el.classList.toggle('hidden', !R0);
        if (R0) { let hot = R0[2] || 0; const fill = (pips, n) => pips.forEach((p, i) => { p.classList.toggle('on', i < n); p.classList.toggle('hot', i < n && i >= n - Math.ceil(hot / 2)); }); fill(this.rounds.r, R0[0]); fill(this.rounds.l, R0[1]); this.rounds.el.classList.toggle('dry', R0[0] + R0[1] === 0); }
      }
    }
    // the pins: their fusion's icon, cooldown and key
    const pins = pinsOf(g.cls);
    for (const Pn of this.pins) {
      const id = pins[Pn.i], f = id && FUSION_BY_ID[id];
      if (Pn.id !== id) { Pn.id = id; if (f) Pn.img.src = skillIcon(f); else Pn.img.removeAttribute('src'); Pn.el.classList.toggle('empty', !f); }
      const k = this.pinKey(Pn.i); if (Pn.key.textContent !== k) Pn.key.textContent = k;
      if (!f) continue;
      Pn.el.classList.toggle('locked', !fusionUnlocked(y, f));
      const end = Math.max(y.cds?.[f.id] || 0, f.from === 'dodge' ? 0 : y.cds?.[f.from] || 0, y.cds?.[f.to] || 0), l2 = end - now;
      if (l2 > 0) { Pn.cd.style.background = `conic-gradient(rgba(0,0,0,0.72) ${clamp01(l2 / (f.cd || 1)) * 360}deg, transparent 0)`; Pn.cdt.textContent = l2 > 1.5 ? Math.ceil(l2) : ''; }
      else if (Pn.cdt.textContent || Pn.cd.style.background !== 'none') { Pn.cd.style.background = 'none'; Pn.cdt.textContent = ''; }
    }
  }
  drawLines(from, tos) {
    const box = this.bars.getBoundingClientRect(), a = from.getBoundingClientRect(), ax = a.left + a.width / 2 - box.left;
    this.line.innerHTML = '';
    for (const t of tos) {
      const r = t.getBoundingClientRect(), bx = r.left + r.width / 2 - box.left, l = Math.min(ax, bx), w = Math.max(6, Math.abs(bx - ax));
      const ln = el('i', 'fz-line' + (bx < ax ? ' back' : ''));
      ln.style.left = l + 'px'; ln.style.width = w + 'px';
      this.line.appendChild(ln);
    }
    if (IS_TOUCH) haptic('light');
  }
  // the combo counter beside the target frame: "14 hits", plain numbers, gone 2 s after the last hit
  updateCombo() {
    const tf = $('.target-frame', this.ui.root);
    if (!tf) return;
    let c = this.comboEl;
    if (!c) { c = this.comboEl = el('div', 'combo'); tf.appendChild(c); }
    const live = performance.now() - this.combo.t < 2000 && this.combo.n >= 2;
    if (live && this.combo.shown !== this.combo.n) { this.combo.shown = this.combo.n; c.innerHTML = `<b>${this.combo.n}</b> hits`; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
    c.classList.toggle('on', live);
    if (!live) this.combo.shown = 0;
  }
  // the poise bar under the target's health: thin grey, a white flash when it breaks, "Staggered" or "Broken" while it lasts
  updatePoise() {
    const tf = $('.target-frame', this.ui.root), g = this.g, v = g.target ? g.entities.get(g.target) : null;
    if (!tf) return;
    let pb = this.poiseEl;
    if (!pb) { pb = this.poiseEl = el('div', 'bar poise', '<i></i><span></span>'); $('.bar.hp', tf)?.after(pb); this.poiseI = $('i', pb); this.poiseS = $('span', pb); }
    const mob = v && v.ty === 'm' && !v.dead && !v.def?.dummy;
    pb.classList.toggle('hidden', !mob);
    if (!mob) { this.react = null; return; }
    const r = v.react, now = performance.now();
    if (r && r !== this.react && (r.kind === 'stag' || r.kind === 'broken')) { this.react = r; this.reactEnd = now + 1000 * (r.kind === 'broken' ? r.dur || POISE.broken : POISE.stagger); this.reactKind = r.kind; this.reactId = v.id; pb.classList.remove('flash'); void pb.offsetWidth; pb.classList.add('flash'); }
    const st = this.reactId === v.id && now < (this.reactEnd || 0) ? this.reactKind : null;
    const po = st === 'broken' ? 0 : v.data?.po ?? 1, w = (po * 100).toFixed(0) + '%';
    if (this.poiseI.style.width !== w) this.poiseI.style.width = w;
    const lab = st === 'broken' ? 'Broken' : st === 'stag' ? 'Staggered' : '';
    if (this.poiseS.textContent !== lab) { this.poiseS.textContent = lab; pb.classList.toggle('broken', st === 'broken'); pb.classList.toggle('stag', st === 'stag'); }
  }
}
