// The Fusion Book (combat_design.md 3.2, 4.5; stage S6): a tab of the Skills window (K) for a class on the new kit. Every
// fusion and the triad: its two inputs, the gate in plain words, its numbers with the hero's Forms and keystones applied,
// a short looping preview cut from the recorded clips (client/ui/fusions/<id>.webp, tools/fusion_previews.py), the
// mastery badge, the Forms and keystones that touch it (with renamed names) and a Pin button. Unknown entries are a grey
// strip with the hint; the triad shows once its notable is taken.
import { CLASSES } from '/sunmere-play/shared/classes.js';
import { DODGES } from '/sunmere-play/shared/kit.js';
import { FUSIONS, fusionBook, skillOf } from '/sunmere-play/shared/fusions.js';
import { KEYSTONES, effName } from '/sunmere-play/shared/keystones.js';
import { TREE_NODES } from '/sunmere-play/shared/tree.js';
import { skillCost } from '/sunmere-play/shared/talents.js';
import { skillIcon } from './icons.js';
import { DODGE_ICON, pinsOf, setPin, pinnable } from './combathud.js';
import { IS_TOUCH } from '../engine/platform.js';

// the recorded previews that exist (one per Knight and Sandblade fusion)
const PREVIEWS = new Set(['kf_stormfall', 'kf_highledger', 'kf_kingsfall', 'kf_pierce', 'kf_battering', 'kf_upheaval', 'kf_riposte', 'kf_sidewind', 'kt_anvilfall',
  'sf_sandspout', 'sf_glasscutter', 'sf_sirocco', 'sf_dustwhirl', 'sf_thousand', 'sf_riptide', 'sf_sandline', 'sf_whiteout', 'st_sandstorm']); // (S8: the Sandblade's, tools/shots/combat/s8)
const ROMAN = ['', 'I', 'II', 'III'];
const icoOf = (id, cls) => (id === 'dodge' ? DODGE_ICON : skillIcon(skillOf(id) || { id }));
const nameOf = (id, cls) => (id === 'dodge' ? DODGES[cls]?.name || 'Dodge' : skillOf(id)?.name || id);
// damage in plain numbers: "2.3x weapon power" (each cut counted), from the compiled record
const powerOf = (r) => { const d = (r.fx || []).filter((e) => e[0] === 'dmg').reduce((a, e) => a + e[1], 0) * (r.hit?.n || 1); return d ? `${+d.toFixed(2)}x weapon power${(r.hit?.n || 1) > 1 ? ` over ${r.hit.n} cuts` : ''}` : ''; };
// the Forms that change a fusion (its carry rules, by input) and the keystones that rename it
function touches(f, you) {
  const out = [];
  for (const side of ['a', 'b']) {
    const input = side === 'a' ? f.from : f.to, rules = f.carry?.[side];
    if (!rules) continue;
    const node = TREE_NODES.find((n) => n.kind === 'form' && n.form.skill === input);
    if (!node) continue;
    for (const o of node.form.opts) if (rules[o.id]) out.push({ kind: 'Form', name: o.name, held: !!you.tree?.[node.id] && (you.forms?.[node.id] || node.form.opts[0].id) === o.id });
  }
  for (const [id, K] of Object.entries(KEYSTONES)) if (K.renames?.[f.id]) out.push({ kind: 'Keystone', name: `${K.name}: becomes ${K.renames[f.id].name}`, held: !!you.tree?.[id] });
  return out;
}

export function fusionBookPage(ui) {
  const y = ui.you, cls = y.cls, C = CLASSES[cls], pins = pinsOf(cls);
  const list = fusionBook(cls, y).filter((e) => e.show);
  const found = list.filter((e) => e.known).length;
  const rows = list.map((e) => {
    const f = FUSIONS[cls].find((x) => x.id === e.id), rec = (y.web && ui.eff?.[e.id]) || f;
    const ins = `<span class="fb-ins"><img src="${icoOf(e.from, cls)}" alt=""><i class="fb-then"></i><img src="${icoOf(e.to, cls)}" alt=""></span>`;
    const lock = !e.unlocked ? (e.lvl ? `Opens at level ${e.lvl}` : `Needs ${TREE_NODES.find((n) => n.id === e.tree)?.name || 'a notable'} on the Skill Web`) : '';
    if (!e.known) {
      return `<div class="fb-row unk" data-id="${e.id}">${ins}<div class="fb-b"><b>${e.unlocked ? 'Not found yet' : 'Locked'}</b><div class="fb-g">${e.fromName}, then ${e.toName}. ${e.gate}.</div><div class="fb-h">${e.hint}</div>${lock ? `<div class="fb-l">${lock}</div>` : ''}</div></div>`;
    }
    const B = skillOf(f.to), cost = (B && f.from !== undefined ? skillCost(B, ui.tmods) : 0) + (rec.extra || 0);
    const T = touches(f, y), pin = pins.indexOf(e.id);
    const prev = PREVIEWS.has(e.id) ? `<div class="fb-prev" style="background-image:url(/sunmere-play/ui/fusions/${e.id}.webp)"></div>` : `<div class="fb-prev still"><img src="${skillIcon(f)}" alt=""></div>`;
    return `<div class="fb-row" data-id="${e.id}">${prev}<div class="fb-b"><div class="fb-t"><img class="fb-ic" src="${skillIcon(f)}" alt=""><b>${effName(rec)}</b>${e.rank ? `<span class="fb-rank r${e.rank}">Mastery ${ROMAN[e.rank]}</span>` : ''}${e.triad ? '<span class="fb-tri">Triad</span>' : ''}</div>
      <div class="fb-in">${ins}<span>${e.fromName}, then ${e.toName}. ${e.gate}.</span></div>
      <div class="fb-d">${rec.desc || f.desc}</div>
      <div class="fb-m"><span>${cost} ${C.resource}</span><span>${rec.cd}s cooldown</span>${powerOf(rec) ? `<span>${powerOf(rec)}</span>` : ''}<span>${e.uses} landed</span></div>
      ${T.length ? `<div class="fb-x">${T.map((t) => `<span class="${t.held ? 'on' : ''}">${t.kind}: ${t.name}${t.held ? ' (yours)' : ''}</span>`).join('')}</div>` : ''}
      ${lock ? `<div class="fb-l">${lock}</div>` : pinnable(f) ? `<div class="fb-pins">${[0, 1].map((i) => `<button class="fb-pin ${pin === i ? 'on' : ''}" data-i="${i}">${pin === i ? `Pinned ${i + 1} (unpin)` : `Pin ${i + 1}`}</button>`).join('')}</div>` : ''}
    </div></div>`;
  }).join('');
  const tip = IS_TOUCH ? 'Land the first skill, then tap the second while its button shows the fusion, or slide your thumb from the first onto the second.' : 'Land the first skill, then press the second while its slot shows the fusion. Alt casts it plain.';
  return `<div class="fz-book2"><div class="fb-head"><b>Fusion Book</b><span>${found} of ${list.length} found</span><em>${tip}</em></div>${rows}</div>`;
}
export function wireFusionBook(ui, root) {
  const cls = ui.you.cls;
  root.querySelectorAll('.fb-pin').forEach((b) => (b.onclick = (ev) => {
    ev.stopPropagation();
    const id = b.closest('.fb-row').dataset.id, i = Number(b.dataset.i);
    setPin(cls, i, pinsOf(cls)[i] === id ? null : id);
    ui.g.sfx?.play('ui'); ui.windows.skills?.refresh?.();
  }));
}
