// Voice ambience (ROADMAP VA.1): quiet looping beds of men's wordless humming (CC0 recordings, see assets/tex/CREDITS.txt),
// under the town at night, the dungeons and the main menu. Voice only: no instruments, no music. It plays through the SFX
// master (so Volume, Mute and "silent in the background" apply), fades over 2 s whenever the context changes, and ducks
// right down while you are in combat so it never sits over the fight sounds. Phones play one layer, a little lower.
// The pure part (voiceContext, voiceLayers) has no browser imports so tools/tests/voiceambtest.mjs can run it in node.
export const VOICE_BASE = new URL('../assets/audio/voice/', import.meta.url).href;
export const VOICE_FADE = 2; // seconds, in and out
export const VOICE_DUCK = 0.12; // the level under combat (times the normal level)
export const NIGHT_FROM = 0.45; // world.night (0 day .. 1 deepest night) above which a town hums
// the settled places (centre x, z, radius in metres): the village, Briarhold, Westfold, Dunewatch, Northwatch, Brasswind, the Coilway
export const TOWNS = [[0, -4, 70], [-124, -16, 40], [-196, 40, 36], [-40, 172, 36], [6, -206, 30], [196, 148, 34], [-213, -215, 46]];
export function inTown(x, z) { for (const [cx, cz, r] of TOWNS) if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true; return false; }
// the context for the current moment: 'menu' | 'dungeon' | 'town' | null (silence: daytime and the open country)
export function voiceContext({ menu = false, dungeon = false, night = 0, x = 0, z = 0 } = {}) {
  if (menu) return 'menu';
  if (dungeon) return 'dungeon';
  return night >= NIGHT_FROM && inTown(x, z) ? 'town' : null;
}
// the bed files for a context: desktop layers two, phones one
export function voiceLayers(ctx, mobile = false) { return !ctx ? [] : mobile ? [ctx + '_a'] : [ctx + '_a', ctx + '_b']; }
export const voiceUrl = (name) => VOICE_BASE + name + '.ogg';

export class VoiceAmb {
  // sfx: the SFX (ctx, master); mobile: phones take one layer at 60 %
  constructor(sfx, mobile) { this.sfx = sfx; this.mobile = !!mobile; this.ctx = null; this.live = []; this.buf = new Map(); this.bus = null; this.duck = false; this.retry = {}; }
  gainOf() { return this.mobile ? 0.6 : 1; }
  load(name) {
    let p = this.buf.get(name);
    if (!p) {
      p = fetch(voiceUrl(name)).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then((a) => this.sfx.ctx.decodeAudioData(a));
      p.catch(() => { this.buf.delete(name); this.retry[name] = performance.now() + 30000; }); // try again in 30 s
      this.buf.set(name, p);
    }
    return p;
  }
  // called every frame: want = a context name or null (already false when the option is off), combat = true while fighting
  update(want, combat) {
    const c = this.sfx.ctx; if (!c || !this.sfx.master) return;
    if (!this.bus) { this.bus = c.createGain(); this.bus.gain.value = 1; this.bus.connect(this.sfx.master); }
    if (want !== this.ctx) this.change(want);
    if (combat !== this.duck) {
      this.duck = combat;
      const g = this.bus.gain, now = c.currentTime;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      g.setTargetAtTime(combat ? VOICE_DUCK : 1, now, combat ? 0.35 : 1.4); // down quickly, back slowly
    }
  }
  ramp(g, to, secs) { const c = this.sfx.ctx, now = c.currentTime; g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(to, now + secs); }
  change(want) {
    const c = this.sfx.ctx;
    for (const L of this.live) { L.dead = true; this.ramp(L.g, 0, VOICE_FADE); setTimeout(() => { try { L.src?.stop(); L.g.disconnect(); } catch { /* already gone */ } }, VOICE_FADE * 1000 + 150); }
    this.live = []; this.ctx = want;
    for (const name of voiceLayers(want, this.mobile)) {
      const L = { name, g: c.createGain(), src: null, dead: false }; L.g.gain.value = 0; L.g.connect(this.bus); this.live.push(L);
      this.load(name).then((b) => {
        if (L.dead) return;
        const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.connect(L.g); s.start(0, Math.random() * b.duration); L.src = s;
        this.ramp(L.g, this.gainOf(), VOICE_FADE);
      }).catch(() => { /* the bed is missing: stay silent, load() retries later */ });
    }
  }
}
