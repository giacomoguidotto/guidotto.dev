"use client";

// Reactivity root for the showcase surfaces.
//
// ShowcaseRoot owns two things, both written to CSS custom properties on the
// root via refs (no React state, so attention never triggers a re-render):
//   - earned color: `--live-accent` is set to the focused project's accent and
//     cleared on blur, so the field tint, the neutral CTA, and any downstream
//     accent element bloom in that project's color (one lead at a time);
//   - cheap pointer-parallax: `--mx` / `--my` track the pointer, rAF-throttled.
//
// Reduced-motion and coarse (touch) pointers skip the parallax loop entirely.
// Glass is pure CSS; real WebGL stays reserved for the crown jewel.

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

interface AccentApi {
  /** Clear the earned accent. */
  clear: () => void;
  /** Bloom an accent onto `--live-accent`. */
  set: (accent: string) => void;
}

const noop = () => {
  // default no-op outside a ShowcaseRoot
};

const AccentContext = createContext<AccentApi>({ set: noop, clear: noop });

/** Access the earned-color API from any vessel inside a ShowcaseRoot. */
export function useAccent(): AccentApi {
  return useContext(AccentContext);
}

export function ShowcaseRoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  const api = useMemo<AccentApi>(
    () => ({
      set: (accent: string) =>
        rootRef.current?.style.setProperty("--live-accent", accent),
      clear: () => rootRef.current?.style.removeProperty("--live-accent"),
    }),
    []
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    // Reduced-motion and touch pointers get tap/focus reactions only, no parallax.
    // This is a mount-time snapshot on purpose: the parallax loop is a progressive
    // enhancement, so a hybrid device that boots coarse simply skips it until a
    // reload (the earned-color reactions, which VitrineStage re-detects live, are
    // the part that must adapt). Not worth re-wiring the rAF loop for.
    if (reduce || coarse) {
      return;
    }
    let raf = 0;
    let mx = 0;
    let my = 0;
    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      mx = (event.clientX - rect.left) / rect.width - 0.5;
      my = (event.clientY - rect.top) / rect.height - 0.5;
      if (raf === 0) {
        raf = requestAnimationFrame(() => {
          el.style.setProperty("--mx", mx.toFixed(4));
          el.style.setProperty("--my", my.toFixed(4));
          raf = 0;
        });
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf !== 0) {
        cancelAnimationFrame(raf);
      }
    };
  }, []);

  return (
    <AccentContext.Provider value={api}>
      <div className={className} ref={rootRef}>
        {children}
      </div>
    </AccentContext.Provider>
  );
}
