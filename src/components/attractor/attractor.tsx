// Attractor — the live showpiece finale ("The Centerpiece"), issue #9.
//
// The section is the server-rendered stage: the indexable copy (eyebrow, line,
// caption, footer), the AnyPINN vessel's resting slot, and the badge all live
// here so they sit in the initial HTML. The live instrument — the single WebGL
// spend — is the client `LiveInstrument`, which lazy-loads the R3F scene + the
// showpiece asset only when the finale scrolls into view, and which carries the
// degradation ladder (full spectacle -> static converged butterfly -> a
// reduced-motion still). The footer ships the sentence alone (the "see the story"
// link is hidden at v1, `storyHref` null until a story page is sourced).
//
// The AnyPINN vessel's RESTING PLACE: the fifth vessel that leaves the hero
// contact sheet during the scroll handoff (#8) does NOT rejoin the grid — it
// lands here, SMALL, at the TOP-LEFT of the instrument. The Stage aims its
// set-aside at this slot ([data-finale-landing]); it lands fully standalone too
// (the finale must not depend on the loop): with no handoff present the vessel
// simply rests in its slot.

import type { CSSProperties, ReactNode } from "react";
import { ProjectMedia } from "~/components/showcase/project-media";
import { content } from "~/content";
import styles from "./attractor.module.css";
import { LiveInstrument } from "./live-instrument";

// Force a deliberate line break after `marker`. This is a presentation-only
// hand-break of the verbatim content string (like the hero's thesis stanza or the
// human-anchor elaboration): the words are untouched, only where the line wraps.
function hardBreak(text: string, marker: string): ReactNode {
  const at = text.indexOf(marker);
  if (at === -1) {
    return text;
  }
  const cut = at + marker.length;
  return (
    <>
      {text.slice(0, cut)}
      <br />
      {text.slice(cut).trimStart()}
    </>
  );
}

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

      {/* The instrument's stage. The live scene + the HUD knobs / scrubber mount
          inside `LiveInstrument`; the parked vessel and the badge are static
          chrome layered over it. */}
      <div className={styles.instrument}>
        <LiveInstrument />

        {/* The landed fifth vessel: AnyPINN, small, top-left — the seam the Stage
            set-aside aims at. Poster-only, like the contact-sheet vessel. The
            [data-finale-landing] hook sits on the vessel's media box itself (not
            the column that also holds the tag), so the Stage shrinks the departing
            vessel to exactly the box it lands in, even if this layout shifts. */}
        <div className={styles.landing}>
          <span className={styles.vessel} data-finale-landing>
            <ProjectMedia motif={showpiece.motif} />
            <span className={styles.vesselGlass} />
          </span>
          <span className={styles.landingTag}>{showpiece.label}</span>
        </div>

        {/* The one live badge (never "peer-reviewed"). */}
        <span className={styles.badge}>{showpiece.badge}</span>
      </div>

      <div className={styles.footer}>
        <p className={styles.caption}>
          {hardBreak(showpiece.caption, "browser.")}
        </p>
        <p className={styles.footline}>
          {hardBreak(showpiece.footer, "networks,")}
        </p>
      </div>
    </section>
  );
}
