"use client";

// ProjectTile — ONE DOM node that is the hero vitrine vessel at rest and the proof
// card once landed (the "same DOM element in both states" the scroll handoff calls
// for, realised literally). It is a single <a>:
//
//   - at rest / mid-flight it has NO href and is non-navigating (pointer-events are
//     off, set by the stage): a calm contact-sheet vessel, softened by its depth blur;
//   - once the morph resolves, the stage sets `href` + `data-live`, and it behaves
//     exactly like a ProofCard: the whole card navigates to the repo, hover/focus
//     light it, and the caption's bigger-picture copy reveals.
//
// It reuses the proof grid's own CSS module for every card layer (poster, glass,
// bloom, sweep, caption) so the resolved 2x2 is pixel-identical to the standalone
// grid; the stage drives the vitrine<->card morph imperatively through the stable
// data hooks (`data-key`, `data-poster`, `data-caption`) and the `.tile` class
// here. Soft -> sharp is the hero's OWN treatment: the stage fades the poster's
// `filter: blur()` (the same per-depth radii the hero uses) to none and tightens
// the corner from the softer vitrine radius to the proof card radius as it lands.
//
// The "see the story" affordance is deliberately absent: only the showpiece owns a
// `storyHref`, and it is null until a story page is sourced (content boundary). The
// slot lives structurally in the caption order and lights up the day the link is real.

import type { CSSProperties } from "react";
import proofStyles from "~/components/proof-grid/proof-grid.module.css";
import { ProjectMedia } from "~/components/showcase/project-media";
import type { Motif } from "~/content";
import styles from "./stage.module.css";

/** The minimum a tile needs in either state. Caption fields are peer-only; the
 *  showpiece is poster-only (it sets itself aside and never grows a card). */
export interface TileModel {
  readonly accent: string;
  readonly atRestLine?: string;
  readonly badge?: string;
  readonly key: string;
  readonly label: string;
  readonly motif: Motif;
  readonly onFocus?: string;
  readonly repoUrl: string;
  /** The showpiece is poster-only and never joins the grid. */
  readonly showpiece?: boolean;
  readonly tag?: string;
}

// A concise name for assistive tech once the tile is a live card: the project plus
// its one weighted line (both verbatim content). The decorative logo is aria-hidden
// inside ProjectMedia.
function TileCaption({ model }: { model: TileModel }) {
  return (
    <span className={proofStyles.caption} data-caption>
      <span className={proofStyles.title}>{model.label}</span>
      <span className={proofStyles.atRest}>{model.atRestLine}</span>
      <span className={proofStyles.tag}>{model.tag}</span>
      <span className={proofStyles.onFocus}>
        <span>{model.onFocus}</span>
        {model.badge ? (
          <span className={proofStyles.badge}>{model.badge}</span>
        ) : null}
        {/* "see the story" slot — rendered only when a real storyHref is sourced. */}
      </span>
    </span>
  );
}

export function ProjectTile({ model }: { model: TileModel }) {
  return (
    // No href here on purpose: the stage adds it (and turns navigation on) only
    // once the card has resolved. At rest this is an inert, calm display vessel.
    // Its accessible name, once it is a link, comes from its visible caption text.
    // biome-ignore lint/a11y/useValidAnchor: href + interactivity are added by the stage at the resolve threshold (dynamic, single-node handoff).
    <a
      className={`${proofStyles.card} ${styles.tile}`}
      data-href={model.repoUrl}
      data-key={model.key}
      rel="noreferrer"
      style={{ "--accent": model.accent } as CSSProperties}
    >
      <span className={proofStyles.vessel} data-poster>
        <span className={proofStyles.surface}>
          <span className={proofStyles.media}>
            <ProjectMedia motif={model.motif} />
          </span>
          <span className={proofStyles.bloom} />
          <span className={proofStyles.glass} />
          <span className={proofStyles.sweep} />
        </span>
      </span>
      {model.showpiece ? null : <TileCaption model={model} />}
    </a>
  );
}
