// data-saver — the network/data rung of the attractor's degradation ladder.
//
// Beyond capability and reduced-motion, the platform exposes "be cheap" signals:
// the user's explicit data-saver, a `prefers-reduced-data` preference, or a
// connection the browser itself already calls slow. The attractor is the one
// ~6.8 MB WebGL spend, so when any of these fire it should default straight to
// the poster floor — fetch nothing, mount no scene (CONTEXT.md → System & network
// signals). The signals are Android-leaning (iOS Low Data Mode doesn't reliably
// expose `saveData` to the web), so this is a progressive win, not universal.
//
// This module is the framework-free read of those signals: a pure predicate plus
// a typed accessor for the experimental NetworkInformation object, so the
// orchestrator (live-instrument) just flips a boolean and listens for changes.

/** `@media (prefers-reduced-data: reduce)` — the user/OS asking for less data. */
export const REDUCED_DATA_QUERY = "(prefers-reduced-data: reduce)";

/** `effectiveType` values slow enough to take the poster floor. */
const SLOW_EFFECTIVE_TYPES: ReadonlySet<string> = new Set(["slow-2g", "2g"]);

/**
 * The slice of the experimental NetworkInformation API we consult. Every field is
 * optional: support is partial (largely Chromium/Android), so a present object may
 * still omit any given property.
 */
export interface NetworkInformation extends EventTarget {
  /** The browser's own round-trip estimate (`slow-2g` | `2g` | `3g` | `4g`). */
  readonly effectiveType?: string;
  /** The explicit data-saver toggle. */
  readonly saveData?: boolean;
}

/** The three "be cheap" signals, already read off the platform. */
export interface DataSaverSignals {
  /** `navigator.connection.effectiveType`. */
  readonly effectiveType?: string;
  /** Whether {@link REDUCED_DATA_QUERY} matches. */
  readonly reducedData?: boolean;
  /** `navigator.connection.saveData`. */
  readonly saveData?: boolean;
}

/** `navigator.connection`, when the experimental API is exposed. */
export function getNetworkInformation(): NetworkInformation | undefined {
  if (typeof navigator === "undefined") {
    return;
  }
  return (navigator as Navigator & { connection?: NetworkInformation })
    .connection;
}

/**
 * Whether any signal asks the attractor to skip its 6.8 MB spend and default to
 * the poster floor: an explicit data-saver, a reduced-data preference, or a
 * connection the browser already classifies as slow (`2g` / `slow-2g`).
 */
export function isDataConstrained(signals: DataSaverSignals): boolean {
  return (
    signals.reducedData === true ||
    signals.saveData === true ||
    (signals.effectiveType !== undefined &&
      SLOW_EFFECTIVE_TYPES.has(signals.effectiveType))
  );
}
