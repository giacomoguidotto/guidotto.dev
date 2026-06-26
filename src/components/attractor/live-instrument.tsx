"use client";

// LiveInstrument — the client orchestrator for the finale's instrument area.
//
// It owns the degradation ladder and the lazy-load discipline:
//   - it detects capability (prefers-reduced-motion, WebGL support) up front and
//     keeps listening for reduced-motion changes;
//   - for a motion-welcome, capable visitor it loads the showpiece asset +
//     precomputes the trajectories only once the finale scrolls into view (an
//     IntersectionObserver gates `loadFinaleData`), so neither the 6.8 MB asset
//     nor — via the ssr:false dynamic import below — three.js ever enters the
//     initial HTML / critical JS budget;
//   - it picks the tier:
//       full     — the R3F scene (capable + motion-welcome);
//       static   — the data-driven 2D butterfly (no WebGL, motion fine), or the
//                  drop-target if the live scene throws / loses its context;
//       poster   — the baked still <img> (reduced motion, or a failed asset load):
//                  the true floor, which fetches/computes nothing and never a hole.
//   - while the finale is off-screen it pauses the scene's frame loop, so the
//     perpetual comet/bloom never burns frames the visitor cannot see.
//
// The HUD and scrubber render as DOM overlays beside the canvas, sharing the one
// mutable controller with the scene (see controller.ts).

import dynamic from "next/dynamic";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { content } from "~/content";
import styles from "./attractor.module.css";
import { createController, type FinaleController } from "./controller";
import { type FinaleData, loadFinaleData } from "./finale-data";
import { Hud } from "./hud";
import { Scrubber } from "./scrubber";
import { StaticButterfly } from "./static-butterfly";

// The single WebGL spend, code-split behind a dynamic import so three.js loads
// only when this component actually renders the scene (capable + in view).
const AttractorScene = dynamic(() => import("./attractor-scene"), {
  ssr: false,
  loading: () => null,
});

const POSTER_LABEL =
  "The recovered Lorenz attractor, converged into its butterfly.";

type Mode = "full" | "static";
type Status = "idle" | "loading" | "ready" | "failed";

const copy = content.showpiece;

function webglAvailable(): boolean {
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl) {
      return false;
    }
    // Browsers cap simultaneous WebGL contexts (~16); free the probe so it never
    // counts against the real <Canvas>.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

interface BoundaryProps {
  readonly children: ReactNode;
  readonly onError: () => void;
}

/** Drop the live scene to the static tier if WebGL throws at runtime. */
class SceneBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Settle a controller onto the converged snapshot (the static / failed tier). */
function freezeConverged(controller: FinaleController): void {
  controller.progress = 1;
  controller.reveal = 1;
  controller.autoplayActive = false;
}

/** The baked still: the floor of the ladder (reduced motion or a failed load).
 *  A CSS background of the committed SVG — fetches nothing else, no JS, no CLS. */
function PosterStill() {
  return <div aria-label={POSTER_LABEL} className={styles.poster} role="img" />;
}

export function LiveInstrument() {
  const rootRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<FinaleData | null>(null);
  const controllerRef = useRef<FinaleController | null>(null);
  const started = useRef(false);
  const [reduced, setReduced] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<Mode>("full");
  // Whether the scene should render frames — false while the finale is off-screen.
  const [active, setActive] = useState(true);

  // Capability: prefers-reduced-motion, kept live (a visitor can toggle it).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Load + visibility. Reduced motion takes the poster floor (no fetch, no three).
  useEffect(() => {
    if (reduced) {
      return;
    }
    const webgl = webglAvailable();
    setMode(webgl ? "full" : "static");

    const begin = () => {
      if (started.current) {
        return;
      }
      started.current = true;
      setStatus("loading");
      loadFinaleData()
        .then((data) => {
          const controller = createController(
            data.snapshotCount,
            data.settleIndex
          );
          if (!webgl) {
            freezeConverged(controller);
          }
          dataRef.current = data;
          controllerRef.current = controller;
          setStatus("ready");
        })
        .catch(() => setStatus("failed"));
    };

    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      begin();
      return;
    }
    // One persistent observer: it triggers the load on first approach (200px
    // rootMargin) and tracks visibility so the scene's frame loop pauses when the
    // finale leaves the viewport. Because no frames run off-screen, the once-on-view
    // autoplay cannot play unseen either (the timeline only advances on frames).
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (visible) {
          begin();
        }
        setActive(visible);
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  const failToStatic = useCallback(() => {
    if (controllerRef.current) {
      freezeConverged(controllerRef.current);
    }
    setMode("static");
  }, []);

  const data = dataRef.current;
  const controller = controllerRef.current;
  const ready = status === "ready" && data && controller;

  return (
    <div className={styles.live} ref={rootRef}>
      {reduced && <PosterStill />}
      {!reduced && status === "failed" && <PosterStill />}
      {!reduced && status === "loading" && (
        <div aria-hidden="true" className={styles.loading} />
      )}
      {!reduced && ready && (
        <>
          <div className={styles.canvas}>
            {mode === "full" ? (
              <SceneBoundary onError={failToStatic}>
                <AttractorScene
                  accent={copy.accent}
                  active={active}
                  controller={controller}
                  data={data}
                  onContextLost={failToStatic}
                />
              </SceneBoundary>
            ) : (
              <StaticButterfly accent={copy.accent} data={data} />
            )}
          </div>
          <div className={styles.console}>
            <Hud
              controller={controller}
              live={mode === "full"}
              lossLabel={copy.hud.loss}
              parametersLabel={copy.hud.parameters}
              showpiece={data.showpiece}
            />
            {mode === "full" && <Scrubber controller={controller} />}
          </div>
        </>
      )}
    </div>
  );
}
