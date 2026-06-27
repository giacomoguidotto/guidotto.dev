"use client";

// LiveInstrument — the client orchestrator for the finale's instrument area.
//
// It owns the degradation ladder and the lazy-load discipline:
//   - it detects capability (prefers-reduced-motion, WebGL support) up front and
//     keeps listening for reduced-motion changes;
//   - it reads the network/data signal as the TOP rung of the ladder — Save-Data,
//     `prefers-reduced-data`, or a browser-classified slow connection (see
//     data-saver.ts). When the user/network asks us to be cheap it takes the
//     poster floor alongside reduced motion: no 6.8 MB fetch, no scene;
//   - for a motion-welcome, capable, unconstrained visitor it loads the showpiece
//     asset + precomputes the trajectories only once the finale scrolls into view
//     (an IntersectionObserver gates `loadFinaleData`), so neither the 6.8 MB asset
//     nor — via the ssr:false dynamic import below — three.js ever enters the
//     initial HTML / critical JS budget;
//   - it picks the tier:
//       full     — the R3F scene (capable + motion-welcome);
//       static   — the data-driven 2D butterfly (no WebGL, motion fine), or the
//                  drop-target if the live scene throws (a React error);
//       poster   — the baked still <img> (reduced motion, a constrained network,
//                  or a failed asset load): the true floor, which fetches/computes
//                  nothing and never a hole.
//   - while the finale is off-screen it pauses the scene's frame loop, so the
//     perpetual comet/bloom never burns frames the visitor cannot see;
//   - a LOST WebGL context (the browser reclaims an off-screen canvas's GPU
//     context on scroll-away) is recovered by remounting a fresh Canvas once the
//     finale is back on-screen — not a permanent drop; only a device that cannot
//     hold a context (repeated fast-fails) finally settles for the static tier.
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
import {
  getNetworkInformation,
  isDataConstrained,
  REDUCED_DATA_QUERY,
} from "./data-saver";
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

// A WebGL context lost off-screen is recovered by remounting a fresh Canvas (see
// `generation` below). Guard against a device that genuinely cannot hold one: if a
// freshly remounted scene dies again within this window it counts as a fast-fail,
// and a few in a row drop to the static floor instead of remounting forever.
const RECOVER_FASTFAIL_MS = 4000;
const RECOVER_FASTFAIL_LIMIT = 3;

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
  // The console never plays its staged entrance in these tiers (there is no scene
  // conducting it); hold it fully revealed so the readouts show at once.
  controller.controlReveal = 1;
  controller.gaugeReveal = 1;
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
  // Whether a network/data signal asks us to be cheap (Save-Data, reduced-data, or
  // a slow effectiveType). The top rung of the ladder: like reduced motion it takes
  // the poster floor, so the 6.8 MB asset is never fetched and no scene mounts.
  const [constrained, setConstrained] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<Mode>("full");
  // Whether the scene should render frames — false while the finale is off-screen.
  const [active, setActive] = useState(true);
  // The live scene's mount generation. A lost WebGL context (browsers reclaim the
  // GPU context of an off-screen canvas on scroll-away) is recovered by REMOUNTING
  // a fresh Canvas — bumping this key — rather than demoting to the static still
  // permanently. The rebuild waits until the finale is back on-screen, so a context
  // dropped while parked off-screen heals on return instead of churning unseen.
  const [generation, setGeneration] = useState(0);
  const [contextLost, setContextLost] = useState(false);
  const recoverGuard = useRef({
    fastFails: 0,
    lastAt: Number.NEGATIVE_INFINITY,
  });

  // Capability: prefers-reduced-motion, kept live (a visitor can toggle it).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Network/data signal, kept live (a data-saver toggle or a connection change can
  // flip it mid-session). Read before the IntersectionObserver below ever fires the
  // load, so a constrained client never pays the 6.8 MB / WebGL spend.
  useEffect(() => {
    const mq = window.matchMedia(REDUCED_DATA_QUERY);
    const connection = getNetworkInformation();
    const evaluate = () =>
      setConstrained(
        isDataConstrained({
          reducedData: mq.matches,
          saveData: connection?.saveData,
          effectiveType: connection?.effectiveType,
        })
      );
    evaluate();
    mq.addEventListener("change", evaluate);
    connection?.addEventListener("change", evaluate);
    return () => {
      mq.removeEventListener("change", evaluate);
      connection?.removeEventListener("change", evaluate);
    };
  }, []);

  // Load + visibility. The poster floor (reduced motion OR a constrained network)
  // fetches nothing and mounts no three.
  useEffect(() => {
    if (reduced || constrained) {
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
  }, [reduced, constrained]);

  const failToStatic = useCallback(() => {
    if (controllerRef.current) {
      freezeConverged(controllerRef.current);
    }
    setMode("static");
  }, []);

  // A lost context is recoverable — just flag it; the effect below rebuilds the
  // scene when (and only when) the finale is on-screen, so we never spin up a fresh
  // context the visitor cannot see (which the browser would likely reclaim again).
  const handleContextLost = useCallback(() => setContextLost(true), []);

  useEffect(() => {
    if (!(contextLost && active)) {
      return;
    }
    const now = performance.now();
    const guard = recoverGuard.current;
    // A rebuild that survives a while resets the streak; one that dies almost
    // immediately is a fast-fail. Enough fast-fails in a row means this device
    // cannot hold a context, so settle for the static floor rather than loop.
    guard.fastFails =
      now - guard.lastAt < RECOVER_FASTFAIL_MS ? guard.fastFails + 1 : 0;
    guard.lastAt = now;
    setContextLost(false);
    if (guard.fastFails >= RECOVER_FASTFAIL_LIMIT) {
      failToStatic();
      return;
    }
    setGeneration((g) => g + 1);
  }, [contextLost, active, failToStatic]);

  const data = dataRef.current;
  const controller = controllerRef.current;
  const ready = status === "ready" && data && controller;
  // The poster floor: reduced motion or a constrained network. Both fetch nothing
  // and mount no scene — the asset request and three.js never happen.
  const posterFloor = reduced || constrained;

  return (
    <div className={styles.live} ref={rootRef}>
      {posterFloor && <PosterStill />}
      {!posterFloor && status === "failed" && <PosterStill />}
      {!posterFloor && status === "loading" && (
        <div aria-hidden="true" className={styles.loading} />
      )}
      {!posterFloor && ready && (
        <>
          <div className={styles.canvas}>
            {mode === "full" ? (
              <SceneBoundary onError={failToStatic}>
                <AttractorScene
                  accent={copy.accent}
                  active={active}
                  controller={controller}
                  data={data}
                  key={generation}
                  onContextLost={handleContextLost}
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
