// Attractor — the live showpiece finale ("The Centerpiece"), issue #9.
//
// SKELETON CUT. This is the section scaffold + the AnyPINN vessel's landing slot,
// not the live WebGL scene yet. The `@react-three/fiber` instrument (observation
// motes raining in, the glowing green field tube uncurling and snapping into the
// butterfly, additive bloom peaking at convergence then easing into the perpetual
// comet, drag-to-orbit with depth fog, the epoch scrubber, the settling sigma /
// rho / beta HUD knobs and the falling loss) lands in a later cut — the heavy WebGL
// is lazy-loaded only when the finale scrolls into view, so it never enters the
// initial HTML / critical JS budget.
//
// What this cut establishes:
//   - the finale's own generous stage, a subtle spotlight pooling it out of the
//     cool-dark field;
//   - the AnyPINN vessel's RESTING PLACE. The fifth vessel that leaves the hero
//     contact sheet during the scroll handoff (#8) does NOT rejoin the grid — it
//     lands here, SMALL, at the TOP-LEFT of the instrument. The Stage aims its
//     set-aside at this slot ([data-finale-landing]), so the departure and the
//     landing read as one continuous through-line: when the handoff is over, all
//     five vessels are in place (four in the grid, this one parked on the finale).
//   - the verbatim `content.showpiece` copy the finale ships.
//
// It lands fully standalone too (the finale must not depend on the loop): with no
// handoff present the vessel simply rests in its slot.

import type { CSSProperties } from "react";
import { ProjectMedia } from "~/components/showcase/project-media";
import { content } from "~/content";
import styles from "./attractor.module.css";

export function Attractor() {
  const { showpiece } = content;
  return (
    <section
      aria-labelledby="finale-line"
      className={styles.finale}
      style={{ "--accent": showpiece.accent } as CSSProperties}
    >
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{showpiece.eyebrow}</p>
        <h2 className={styles.line} id="finale-line">
          {showpiece.line}
        </h2>
      </header>

      {/* The instrument's stage. The live R3F scene mounts inside `.scene` later;
          for now it is a quiet placeholder that still carries the HUD chrome and
          the vessel's landing slot so the composition reads true. */}
      <div className={styles.instrument}>
        {/* the live scene placeholder (the WebGL attractor lands here). */}
        <div aria-hidden="true" className={styles.scene}>
          <span className={styles.scenePlaceholder}>The Attractor</span>
        </div>

        {/* The landed fifth vessel: AnyPINN, small, top-left — the seam the Stage
            set-aside aims at. Poster-only, like the contact-sheet vessel. */}
        <div className={styles.landing} data-finale-landing>
          <span className={styles.vessel}>
            <ProjectMedia motif={showpiece.motif} />
            <span className={styles.vesselGlass} />
          </span>
          <span className={styles.landingTag}>{showpiece.label}</span>
        </div>

        {/* HUD — quiet, mono, never competing with the attractor. Skeleton: the
            two readout labels + the one live badge; the settling sigma / rho / beta
            knobs and the live falling loss arrive with the scene. */}
        <div className={styles.hud}>
          <span className={styles.hudLabel}>{showpiece.hud.parameters}</span>
          <span className={styles.hudLabel}>{showpiece.hud.loss}</span>
          <span className={styles.badge}>{showpiece.badge}</span>
        </div>

        {/* the interaction affordance (drag to orbit / scrub through training). */}
        <p className={styles.interaction}>{showpiece.interaction}</p>
      </div>

      <div className={styles.footer}>
        <p className={styles.caption}>{showpiece.caption}</p>
        {/* the footer ships the sentence alone — the "see the story" link is
            hidden at v1 (storyHref is null until a story page is sourced). */}
        <p className={styles.footline}>{showpiece.footer}</p>
      </div>
    </section>
  );
}
