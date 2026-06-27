"use client";

// Reactivity root for the showcase surfaces.
//
// ShowcaseRoot owns two things, both written to CSS custom properties on the
// root via refs (no React state, so attention never triggers a re-render):
//   - earned color: `--live-accent` is set to the focused project's accent and
//     cleared on blur, so the field tint, the neutral CTA, and any downstream
//     accent element bloom in that project's color (one lead at a time);
//   - cheap field-parallax: `--mx` / `--my`, rAF-throttled. A fine pointer drives
//     them from pointer movement; a coarse (touch) pointer has no mouse, so the
//     same two vars are driven by *device tilt* instead (see gyro-tilt.ts) — the
//     phone is more feedback channels for the same one physics, not a new effect.
//
// Reduced-motion skips the parallax entirely (the law: it collapses to static).
// Glass is pure CSS; real WebGL stays reserved for the crown jewel.

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { type GyroTilt, startGyroTilt } from "./gyro-tilt";

interface AccentApi {
  /** Clear the earned accent. */
  clear: () => void;
  /** Bloom an accent onto `--live-accent`. */
  set: (accent: string) => void;
}

interface TiltApi {
  /**
   * The iOS gyro permission piggyback: enable device-tilt field parallax from a
   * user gesture (the hero's first tap-to-light). Idempotent, and a no-op on
   * fine pointers, under reduced-motion, and on platforms with no gesture gate
   * (where the tilt already started silently).
   */
  enable: () => void;
}

const noop = () => {
  // default no-op outside a ShowcaseRoot
};

const AccentContext = createContext<AccentApi>({ set: noop, clear: noop });
const TiltContext = createContext<TiltApi>({ enable: noop });

/** Access the earned-color API from any vessel inside a ShowcaseRoot. */
export function useAccent(): AccentApi {
  return useContext(AccentContext);
}

/** Access the gyro permission piggyback from any vessel inside a ShowcaseRoot. */
export function useTilt(): TiltApi {
  return useContext(TiltContext);
}

export function ShowcaseRoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // The live gyro driver (coarse pointers only), stashed so the hero's tap can
  // reach its `enable()` through the TiltContext below. Null on fine pointers.
  const tiltRef = useRef<GyroTilt | null>(null);

  const api = useMemo<AccentApi>(
    () => ({
      set: (accent: string) =>
        rootRef.current?.style.setProperty("--live-accent", accent),
      clear: () => rootRef.current?.style.removeProperty("--live-accent"),
    }),
    []
  );

  // A stable context value that delegates to the live driver: `enable()` is a
  // no-op until (and unless) the effect below set up a gyro driver.
  const tilt = useMemo<TiltApi>(
    () => ({ enable: () => tiltRef.current?.enable() }),
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
    // Reduced-motion gets tap/focus reactions only, no parallax (pointer OR gyro)
    // — the law: motion collapses to static.
    if (reduce) {
      return;
    }
    // One rAF-coalesced writer feeds `--mx` / `--my`, whichever input drives it,
    // so the field answers with a single physics. The input choice is a
    // mount-time snapshot on purpose: the parallax is a progressive enhancement,
    // so a hybrid device that boots coarse simply uses tilt until a reload (the
    // earned-color reactions, which VitrineStage re-detects live, are the part
    // that must adapt). Not worth re-wiring the loop for.
    let raf = 0;
    let mx = 0;
    let my = 0;
    const flush = () => {
      if (raf !== 0) {
        return;
      }
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", mx.toFixed(4));
        el.style.setProperty("--my", my.toFixed(4));
        raf = 0;
      });
    };
    const drive = (x: number, y: number) => {
      mx = x;
      my = y;
      flush();
    };

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) {
      // No mouse to track: device tilt drives the same field instead. Android
      // starts silently; iOS waits for the hero's tap to call `tilt.enable()`.
      const gyro = startGyroTilt(drive);
      tiltRef.current = gyro;
      return () => {
        gyro.stop();
        tiltRef.current = null;
        if (raf !== 0) {
          cancelAnimationFrame(raf);
        }
      };
    }

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      drive(
        (event.clientX - rect.left) / rect.width - 0.5,
        (event.clientY - rect.top) / rect.height - 0.5
      );
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
      <TiltContext.Provider value={tilt}>
        <div className={className} ref={rootRef}>
          {children}
        </div>
      </TiltContext.Provider>
    </AccentContext.Provider>
  );
}
