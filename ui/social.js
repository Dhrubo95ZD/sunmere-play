// Playing together (v113), the client side: the Players window (who is online, friends), the menu on another
// player (right-click, or More on the target frame), the trade window and the inspect window.
// Installed on the UI class by ui.js (installSocial). The server checks everything; this only shows it.
import { CLASSES } from '/sunmere-play/shared/classes.js';
import { shownName } from '/sunmere-play/shared/social.js';
import { ITEMS, QUALITY } from '/sunmere-play/shared/data.js';
import { SLOT_LABEL, gearName } from '/sunmere-play/shared/items.js';
import { icon, miscArt } from './icons.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COIN = (k, l) => { const a = miscArt('coin_' + k); return a ? `<img class="coin-im" src="${a}" alt="${l}">` : l; };
const money = (c) => { const g = Math.floor(c / 10000), s = Math.floor((c % 10000) / 100), cp = c % 100; return ((g ? `<b class="m-g">${g}</b>${COIN('gold', 'g')} ` : '') + (s ? `<b class="m-s">${s}</b>${COIN('silver', 's')} ` : '') + (cp || (!g && !s) ? `<b class="m-c">${cp}</b>${COIN('copper', 'c')}` : '')).trim(); };
const defOf = (it) => (it?.gear ? it.gear : it?.id ? { ...ITEMS[it.id], id: it.id } : null);
const bound = (g) => !!(g && (g.bd || (g.q ?? 1) >= 6 || g.dragonslayer));
const tradable = (it) => (it?.gear ? !bound(it.gear) : !!ITEMS[it?.id] && ITEMS[it.id].slot !== 'quest');
const ccol = (c) => CLASSES[c]?.color || '#fff';
const EQUIP_ORDER = ['weapon', 'offhand', 'head', 'shoulders', 'chest', 'back', 'hands', 'legs', 'feet', 'trinket'];
const slotHtml = (it, extra = '') => {
  const d = defOf(it); if (!d) return '';
  const q = d.q ?? 1;
  return `<div class="bslot bq${q} ${extra}" style="--qc:${QUALITY[q]}"><img src="${icon(d.icon || 'ring', '#3a3226', 64)}" style="border-color:${QUALITY[q]}">${it.n > 1 ? `<span class="cnt">${it.n}</span>` : ''}</div>`;
};

export const SOCIAL_UI = {
  // ------------------------------------------------------------------ chat helpers
  whisperTo(name) {
    const chatIn = $('.chat-in', this.root);
    if (!chatIn) return;
    $('.chat', this.root)?.classList.add('tc-chat-on'); // (phones: make sure the chat box is showing)
    chatIn.value = `/w ${name} `;
    chatIn.focus();
    chatIn.setSelectionRange(chatIn.value.length, chatIn.value.length);
  },
  isFriend(name) { return !!this.friendList?.some((f) => f.name === name); },

  // ------------------------------------------------------------------ the menu on another player
  closePlayerMenu() { this._pmenu?.remove(); this._pmenu = null; },
  playerMenu(id, name, x, y) {
    this.closePlayerMenu();
    if (!id || !name || id === this.g.localId) return;
    const inParty = this.partyIds?.has(id), lead = this.party?.leader === this.g.localId || !this.party?.members?.length;
    const rows = [
      ['whisper', 'Whisper'],
      inParty ? (this.party?.leader === this.g.localId ? ['kick', 'Remove from party'] : null) : lead ? ['invite', 'Invite to party'] : null,
      inParty && this.party?.leader === this.g.localId ? ['promote', 'Make party leader'] : null,
      ['trade', 'Trade'],
      ['inspect', 'Inspect'],
      this.isFriend(name) ? ['unfriend', 'Remove friend'] : ['friend', 'Add friend'],
      this.you?.duel ? null : ['duel', 'Challenge to a duel'],
      ['home', 'Visit homestead'],
    ].filter(Boolean);
    const m = el('div', 'pmenu', `<div class="pm-h">${esc(name)}</div>${rows.map(([a, t]) => `<button data-a="${a}">${t}</button>`).join('')}`);
    this.root.appendChild(m);
    this._pmenu = m;
    const W = m.offsetWidth || 180, H = m.offsetHeight || 260;
    m.style.left = Math.max(8, Math.min(innerWidth - W - 8, x)) + 'px';
    m.style.top = Math.max(8, Math.min(innerHeight - H - 8, y)) + 'px';
    m.onclick = (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (!a) return;
      this.closePlayerMenu();
      if (a === 'whisper') this.whisperTo(name);
      if (a === 'invite') this.g.send({ t: 'chat', text: '/invite ' + name });
      if (a === 'kick') this.g.send({ t: 'chat', text: '/kick ' + name });
      if (a === 'promote') this.g.send({ t: 'chat', text: '/promote ' + name });
      if (a === 'trade') this.g.send({ t: 'ptrade', op: 'ask', id });
      if (a === 'inspect') this.g.send({ t: 'inspect', id });
      if (a === 'friend') this.g.send({ t: 'friend', op: 'add', name });
      if (a === 'unfriend') this.g.send({ t: 'friend', op: 'remove', name });
      if (a === 'duel') this.g.send({ t: 'duel', id });
      if (a === 'home') this.g.send({ t: 'inspectHome', id });
    };
    // any press elsewhere, or Escape, closes it
    const off = (e) => { if (!m.isConnected) return done(); if (e.type === 'keydown' ? e.key === 'Escape' : !m.contains(e.target)) { this.closePlayerMenu(); done(); } };
    const done = () => { removeEventListener('pointerdown', off, true); removeEventListener('keydown', off, true); };
    setTimeout(() => { addEventListener('pointerdown', off, true); addEventListener('keydown', off, true); }, 0);
  },

  // ------------------------------------------------------------------ Players window: who is online, friends
  setWho(m) { this.whoList = m; if (this.windows.social?.isConnected) this.renderSocial(); },
  setFriends(m) { this.friendList = m.list || []; if (this.windows.social?.isConnected) this.renderSocial(); },
  winSocial() {
    const w = this.makeWindow('Players', 'w-social', Math.max(10, innerWidth / 2 - 220), 90);
    w._tab = this._socTab || 'who';
    this.windows.social = w;
    this.g.send({ t: 'who' }); this.g.send({ t: 'friend', op: 'list' });
    setTimeout(() => this.renderSocial(), 0);
    return w;
  },
  renderSocial() {
    const w = this.windows.social;
    if (!w?.isConnected) return;
    const wb = $('.wb', w), tab = w._tab, me = this.g.localId;
    const keepQ = $('.so-q', wb)?.value || '', keepF = $('.so-fn', wb)?.value || '';
    const tabs = `<div class="so-tabs"><button data-t="who" class="${tab === 'who' ? 'on' : ''}">Online${this.whoList ? ` (${this.whoList.n})` : ''}</button><button data-t="friends" class="${tab === 'friends' ? 'on' : ''}">Friends${this.friendList ? ` (${this.friendList.filter((f) => f.on).length}/${this.friendList.length})` : ''}</button></div>`;
    let body = '';
    if (tab === 'who') {
      const list = this.whoList?.list || [];
      body = `<div class="so-bar"><input class="so-q" maxlength="14" placeholder="Find a name" value="${esc(keepQ)}"><button class="so-find">Search</button></div>
        <div class="so-list">${list.map((r) => `<div class="so-row${r.bot ? ' bot' : ''}${r.id === me ? ' me' : ''}" data-id="${r.id}" data-n="${esc(r.name)}"><i style="background:${ccol(r.cls)}"></i><b style="color:${ccol(r.cls)}">${esc(shownName(r.name, r.bot))}</b><span class="so-lv">${r.level}</span><span class="so-cl">${CLASSES[r.cls]?.name || ''}</span><span class="so-wh">${esc(r.where)}</span><span class="so-tags">${r.id === me ? '<em>you</em>' : ''}${r.party ? '<em class="t-p">party</em>' : ''}${r.friend ? '<em class="t-f">friend</em>' : ''}${r.guild ? `<em class="t-g">&lt;${esc(r.guild)}&gt;</em>` : ''}${r.bot ? '<em>adventurer</em>' : ''}</span></div>`).join('') || '<p class="qtext">No one matches.</p>'}</div>
        <div class="so-hint">Click a name for Whisper, Invite, Trade, Inspect and more.</div>`;
    } else {
      const list = this.friendList || [];
      body = `<div class="so-bar"><input class="so-fn" maxlength="14" placeholder="Name of a player online" value="${esc(keepF)}"><button class="so-add">Add friend</button></div>
        <div class="so-list">${list.map((f) => `<div class="so-row${f.on ? '' : ' off'}" data-id="${f.id || ''}" data-n="${esc(f.name)}"><i style="background:${f.on ? ccol(f.cls) : '#555'}"></i><b style="color:${f.on ? ccol(f.cls) : '#8a8a8a'}">${esc(f.name)}</b>${f.on ? `<span class="so-lv">${f.level}</span><span class="so-cl">${CLASSES[f.cls]?.name || ''}</span><span class="so-wh">${esc(f.where)}</span>` : '<span class="so-wh">Offline</span>'}<span class="so-btns">${f.on ? '<button data-a="w">Whisper</button><button data-a="i">Invite</button>' : ''}<button data-a="x">Remove</button></span></div>`).join('') || '<p class="qtext">No friends yet. Add a player while they are online, or right-click them in the world.</p>'}</div>`;
    }
    wb.innerHTML = tabs + body;
    wb.querySelectorAll('.so-tabs button').forEach((b) => (b.onclick = () => { w._tab = this._socTab = b.dataset.t; this.g.send(b.dataset.t === 'who' ? { t: 'who' } : { t: 'friend', op: 'list' }); this.renderSocial(); }));
    const find = () => this.g.send({ t: 'who', q: $('.so-q', wb)?.value || '' });
    if ($('.so-find', wb)) { $('.so-find', wb).onclick = find; $('.so-q', wb).onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') find(); }; }
    const add = () => { const n = $('.so-fn', wb).value.trim(); if (n) { this.g.send({ t: 'friend', op: 'add', name: n }); $('.so-fn', wb).value = ''; } };
    if ($('.so-add', wb)) { $('.so-add', wb).onclick = add; $('.so-fn', wb).onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') add(); }; }
    wb.querySelectorAll('.so-row').forEach((r) => {
      r.onclick = (e) => {
        const a = e.target.closest('button')?.dataset.a, n = r.dataset.n, id = r.dataset.id;
        if (a === 'w') return this.whisperTo(n);
        if (a === 'i') return this.g.send({ t: 'chat', text: '/invite ' + n });
        if (a === 'x') return this.g.send({ t: 'friend', op: 'remove', name: n });
        if (!r.classList.contains('bot') && id && id !== me) this.playerMenu(id, n, e.clientX, e.clientY);
      };
    });
  },

  // ------------------------------------------------------------------ inspect
  openInspect(m) {
    this.windows.inspect?.remove();
    const w = this.makeWindow(`${esc(shownName(m.name, m.bot))}`, 'w-inspect', Math.max(10, innerWidth / 2 - 170), 100);
    this.windows.inspect = w;
    const rows = EQUIP_ORDER.map((s) => {
      const g = m.equip?.[s];
      if (!g) return `<div class="in-row empty"><div class="bslot"></div><div class="in-tx"><b>Empty</b><span>${SLOT_LABEL[s] || s}</span></div></div>`;
      const q = g.q ?? 1;
      return `<div class="in-row" data-s="${s}"><div class="bslot bq${q}" style="--qc:${QUALITY[q]}"><img src="${icon(g.icon || 'ring', '#3a3226', 64)}" style="border-color:${QUALITY[q]}"></div><div class="in-tx"><b style="color:${QUALITY[q]}">${esc(gearName(g))}</b><span>${SLOT_LABEL[s] || s}${g.ilvl ? ' · item level ' + g.ilvl : ''}</span></div></div>`;
    }).join('');
    $('.wb', w).innerHTML = `<div class="in-head"><span style="color:${ccol(m.cls)}">Level ${m.level} ${CLASSES[m.cls]?.name || ''}</span>${m.title ? ` <em>${esc(m.title)}</em>` : ''}${m.guild ? ` <span class="t-g">&lt;${esc(m.guild)}&gt;</span>` : ''}<div class="in-il">Average item level <b>${m.ilvl || 0}</b></div></div><div class="in-list">${rows}</div>`;
    w.querySelectorAll('.in-row[data-s]').forEach((r) => {
      const g = m.equip[r.dataset.s];
      r.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip({ gear: g }, true)));
      r.addEventListener('mouseleave', () => this.hideTip());
    });
  },

  // ------------------------------------------------------------------ trade
  ptradeAsk(ev) {
    const pop = $('.invite-pop', this.root);
    pop.innerHTML = `<div><span style="color:${ccol(ev.cls)}">${esc(ev.from)}</span> wants to trade with you.</div><div class="dbtns"><button class="ok">Trade</button><button class="no">Decline</button></div>`;
    pop.classList.remove('hidden');
    const done = (accept) => { this.g.send({ t: 'ptrade', op: 'reply', accept }); pop.classList.add('hidden'); };
    $('.ok', pop).onclick = () => done(true);
    $('.no', pop).onclick = () => done(false);
    clearTimeout(this._invT); this._invT = setTimeout(() => { if (!pop.classList.contains('hidden')) done(false); }, 28000);
  },
  setPTrade(m) {
    if (m.closed) { this.ptrade = null; this.windows.ptrade?.remove(); this.windows.ptrade = null; this.hideTip(); return; }
    this.ptrade = m;
    let w = this.windows.ptrade;
    if (!w?.isConnected) {
      w = this.makeWindow('Trade', 'w-ptrade', Math.max(10, innerWidth / 2 - 260), 80);
      this.windows.ptrade = w;
      $('.wx', w).onclick = () => { this.g.send({ t: 'ptrade', op: 'cancel' }); w.remove(); this.hideTip(); };
    }
    this.renderPTrade();
  },
  ptSend(slots, gold) { const T = this.ptrade; if (T) this.g.send({ t: 'ptrade', op: 'set', slots, gold: gold ?? T.mine.gold }); },
  renderPTrade() {
    const T = this.ptrade, w = this.windows.ptrade, y = this.you;
    if (!T || !w?.isConnected || !y) return;
    $('.wh span', w).textContent = `Trade with ${T.with}`;
    const mineSlots = T.mine.items.map((it) => it.slot), N = 6;
    const grid = (items, mine) => Array.from({ length: N }, (_, k) => { const it = items[k]; return it ? slotHtml(it, mine ? 'pt-mine' : 'pt-their').replace('class="bslot', `data-k="${k}" class="bslot`) : '<div class="bslot pt-empty"></div>'; }).join('');
    const g0 = T.mine.gold, gg = Math.floor(g0 / 10000), gs = Math.floor((g0 % 10000) / 100), gc = g0 % 100;
    const bag = y.bag.map((it, i) => [it, i]).filter(([it, i]) => tradable(it) && !mineSlots.includes(i));
    const side = (title, who, cls, items, gold, ok, mine) => `<div class="pt-side${ok ? ' ok' : ''}"><div class="pt-who" style="color:${cls}">${title}</div><div class="pt-grid">${grid(items, mine)}</div>
      <div class="pt-gold">${mine ? `<label>Coin</label><input class="pt-g" type="number" min="0" value="${gg}"><span>${COIN('gold', 'g')}</span><input class="pt-s" type="number" min="0" max="99" value="${gs}"><span>${COIN('silver', 's')}</span><input class="pt-c" type="number" min="0" max="99" value="${gc}"><span>${COIN('copper', 'c')}</span>` : `<label>Coin</label> ${money(gold)}`}</div>
      <div class="pt-st">${ok ? 'Accepted' : mine ? 'Not accepted yet' : 'Deciding...'}</div></div>`;
    $('.wb', w).innerHTML = `<div class="pt-sides">${side('You offer', y.name, ccol(y.cls), T.mine.items, T.mine.gold, T.mine.ok, true)}${side(`${esc(T.with)} offers`, T.with, ccol(T.wcls), T.theirs.items, T.theirs.gold, T.theirs.ok, false)}</div>
      ${T.why === 'changed' ? '<div class="pt-warn">An offer changed: check the trade again before you accept.</div>' : T.why === 'full' ? '<div class="pt-warn">Not enough room in the bags for this trade.</div>' : ''}
      <div class="pt-bagh">Your bags: click something to offer it (bound pieces and quest items cannot be traded). Click an offered item to take it back.</div>
      <div class="pt-bag bag-grid">${bag.map(([it, i]) => slotHtml(it, 'pt-b').replace('class="bslot', `data-i="${i}" class="bslot`)).join('') || '<p class="qtext">Nothing in your bags can be traded.</p>'}</div>
      <div class="dbtns pt-btns"><span class="pt-purse">Purse ${money(y.gold)}</span><button class="pt-ok"${T.mine.ok ? ' disabled' : ''}>${T.mine.ok ? 'Accepted' : 'Accept trade'}</button><button class="pt-x">Cancel</button></div>`;
    const wb = $('.wb', w);
    const tip = (e, it) => { e.addEventListener('mouseenter', (ev) => this.showTip(ev, this.itemTip(it, true))); e.addEventListener('mouseleave', () => this.hideTip()); };
    wb.querySelectorAll('.pt-b').forEach((e) => { const i = Number(e.dataset.i); tip(e, y.bag[i]); e.onclick = () => { this.hideTip(); if (mineSlots.length >= N) return this.error('At most 6 things can change hands in one trade.'); this.ptSend([...mineSlots, i]); }; });
    wb.querySelectorAll('.pt-mine').forEach((e) => { const k = Number(e.dataset.k); tip(e, T.mine.items[k]); e.onclick = () => { this.hideTip(); this.ptSend(mineSlots.filter((_, j) => j !== k)); }; });
    wb.querySelectorAll('.pt-their').forEach((e) => tip(e, T.theirs.items[Number(e.dataset.k)]));
    const coin = () => { const v = (s) => Math.max(0, Math.floor(Number($(s, wb).value) || 0)); const c = v('.pt-g') * 10000 + Math.min(99, v('.pt-s')) * 100 + Math.min(99, v('.pt-c')); if (c !== T.mine.gold) this.ptSend(mineSlots, Math.min(c, y.gold)); };
    wb.querySelectorAll('.pt-gold input').forEach((i) => { i.onchange = coin; i.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') coin(); }; });
    $('.pt-ok', wb).onclick = () => this.g.send({ t: 'ptrade', op: 'ok', v: T.v });
    $('.pt-x', wb).onclick = () => this.g.send({ t: 'ptrade', op: 'cancel' });
  },
};

// wire the module into the UI class: the methods, the Players window in toggle(), and a fresh trade view whenever your bags change
export function installSocial(UI) {
  Object.assign(UI.prototype, SOCIAL_UI);
  const setYou = UI.prototype.setYou;
  UI.prototype.setYou = function (you) { setYou.call(this, you); if (this.ptrade && this.windows.ptrade?.isConnected) this.renderPTrade(); };
  const toggle = UI.prototype.toggle;
  UI.prototype.toggle = function (name) {
    if (name !== 'social') return toggle.call(this, name);
    if (this.windows.social?.isConnected) { this.windows.social.remove(); this.windows.social = null; } else this.winSocial();
    this.g.sfx?.play('ui');
  };
}
