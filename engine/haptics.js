// Haptics (docs/ai/combat_design.md 2.10, S14): short pulses on phones only, never on a desktop (a touch laptop included).
// Capacitor's Haptics plugin when the app carries it, else the web view's vibrate call (the Android build asks for the
// VIBRATE permission, mobile/build.mjs). Behind the "Vibration" option (SETTINGS.vibrate, on by default). Pulses closer
// than 70 ms merge into the stronger one, so a contact that the clip and the server both report buzzes once.
import { SETTINGS } from './settings.js';
import { IS_MOBILE, IS_APP } from './platform.js';

const MS = { light: 12, medium: 26, heavy: 40 };
let lastAt = -1e9, lastKind = null;
export const hapticsOn = () => (IS_MOBILE || IS_APP) && SETTINGS.vibrate !== false;
export function haptic(kind = 'light') {
  if (!hapticsOn()) return false;
  const now = performance.now();
  if (now - lastAt < 70 && (MS[lastKind] || 0) >= (MS[kind] || 0)) return false;
  lastAt = now; lastKind = kind;
  try {
    const H = globalThis.Capacitor?.Plugins?.Haptics;
    if (H?.impact) { H.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' }); return true; }
    if (navigator.vibrate) return navigator.vibrate(MS[kind] || MS.light);
  } catch { /* no vibration here */ }
  return false;
}
// by hit-stop tier: T3 light, T4 medium, T5 (a triad) heavy; lighter tiers never buzz
export const hapticTier = (t) => (t >= 5 ? haptic('heavy') : t >= 4 ? haptic('medium') : t >= 3 ? haptic('light') : false);
