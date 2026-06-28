// haptic — the single, guarded gateway to the Web Vibration API.
//
// Every buzz on the site (vessel tap, scroll-snap settle, convergence peak)
// routes through here so the platform gating lives in exactly one place and the
// four call sites can't drift apart. It is pure progressive enhancement: when a
// buzz is impossible or unwanted, it no-ops silently — there is no fallback.
//
// Why a buzz can be silent (so "haptics disappeared everywhere" is expected, not
// a bug):
//   - No API. iOS Safari exposes no Vibration API at all, and the server has no
//     `navigator`, so the call simply no-ops — every iPhone is silent, always.
//   - Reduced motion. A buzz IS motion, so honoring `prefers-reduced-motion:
//     reduce` keeps the calm tier silent. This is read live on every call, so a
//     mid-session OS toggle takes effect at once — and note that many Android
//     "battery saver" modes flip reduced-motion on, which is the usual reason a
//     working buzz vanishes site-wide until the saver is turned back off.
//   - Muted by the platform. Even when vibrate() is called, the OS can swallow
//     it: a system "touch vibration / haptics" toggle that's off, Do Not Disturb,
//     or a low-battery saver. Nothing here can — or should — override that.
export function haptic(durationMs: number): void {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.vibrate !== "function"
  ) {
    return;
  }
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  navigator.vibrate(durationMs);
}
