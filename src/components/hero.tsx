"use client";

// Hero — the "Vitrine" (the converged design language, folded in from the
// throwaway prototype). The work sits under glass like a museum vitrine /
// contact sheet; a horizontally-centered Fraunces thesis floats over it. The
// cool near-black-blue field earns the focused project's accent through
// attention. The thesis is the LCP (server-rendered text); the reactivity is a
// second-6 retention reward, not a first-5-seconds device.
//
// The contact sheet carries all five planes including the AnyPINN showpiece
// plane (it does not join the later 2x2 grid, but it is present in the hero).
// Each vessel links to its project's public repo (the always-on proof, the same
// cross-origin destination the proof cards use) and stays keyboard-operable.
// Real per-project recordings replace the motif media as they land; the
// composition is designed to read as intentional with a partial set. The
// contact CTA lives in the lower-page contact slice, never the hero.

import type { CSSProperties } from "react";
import {
  GlassVessel,
  type PlaneSubject,
} from "~/components/showcase/glass-vessel";
import { ShowcaseRoot } from "~/components/showcase/showcase-root";
import { content, type Project } from "~/content";

interface Plane {
  depth: 1 | 2 | 3;
  h: string;
  /** Subject carries a repo URL, so the plane can link to the work. */
  subject: PlaneSubject & { repoUrl: string };
  w: string;
  /** Absolute placement inside the field; leaves a central band for the thesis. */
  x: string;
  y: string;
}

const { showpiece, projects, hero } = content;

const project = (key: string): Project => {
  const found = projects.find((p) => p.key === key);
  if (!found) {
    throw new Error(`Unknown project: ${key}`);
  }
  return found;
};

// Cases hug the edges and leave a central band clear for the thesis.
const PLANES: Plane[] = [
  { subject: showpiece, depth: 2, x: "4%", y: "13%", w: "23vw", h: "34vh" },
  {
    subject: project("orray"),
    depth: 1,
    x: "6%",
    y: "55%",
    w: "21vw",
    h: "31vh",
  },
  {
    subject: project("scry"),
    depth: 2,
    x: "73%",
    y: "9%",
    w: "23vw",
    h: "30vh",
  },
  {
    subject: project("tempo"),
    depth: 3,
    x: "75%",
    y: "51%",
    w: "21vw",
    h: "33vh",
  },
  {
    subject: project("ginevra"),
    depth: 3,
    x: "40%",
    y: "5%",
    w: "22vw",
    h: "19vh",
  },
];

export function Hero() {
  return (
    <ShowcaseRoot className="field vitrine">
      <div className="field__tint" />

      <div className="field__vessels">
        {PLANES.map((plane) => (
          <span
            className="case"
            key={plane.subject.key}
            style={
              {
                left: plane.x,
                top: plane.y,
                width: plane.w,
                height: plane.h,
              } as CSSProperties
            }
          >
            <GlassVessel
              depth={plane.depth}
              href={plane.subject.repoUrl}
              shape="rect"
              subject={plane.subject}
            />
          </span>
        ))}
      </div>

      <div className="vignette" />

      <div className="vitrine__copy">
        <p className="eyebrow">{hero.eyebrow}</p>
        <h1 aria-label={hero.thesis} className="thesis">
          {hero.thesisLines.map((line) => (
            <span className="thesis__line" key={line}>
              {line}
            </span>
          ))}
        </h1>
        <p className="subline">{hero.subline}</p>
      </div>

      <p className="scroll-baton">{hero.scrollBaton}</p>
    </ShowcaseRoot>
  );
}
