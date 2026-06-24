"use client";

// Signature — the handwritten mark that draws itself on, stroke by stroke.
//
// Every stroke is server-rendered in its finished state, so a no-JS visitor (and
// a prefers-reduced-motion visitor) sees the completed signature with no motion
// at all. When motion is allowed, the strokes are armed (hidden) on mount and
// then drawn on exactly once, the moment the mark scrolls into view, each by
// transitioning its own `stroke-dashoffset` from the full normalized length to
// zero. pathLength is normalized to 1 on every stroke so the dash math is
// independent of the traced geometry.
//
// This is the single earned micro-motion of the denouement: it is triggered by
// attention (scroll-into-view), never autonomous, and it runs once.

import { useEffect, useRef } from "react";
import styles from "./denouement.module.css";

// The signature broken into the strokes the hand actually makes, in order, each
// carrying its own start delay, duration (ms), and easing so the reveal follows
// the pen rather than flickering on at random:
//
//   1. the capital G of "Giacomo" as one continuous gesture — down the stem,
//      round the loop, then the sweep out to the right (all one stroke)
//   2. "iacomo", left to right
//   3. a beat (the space between the names)
//   4. the capital G of "Guidotto", top to bottom, on its own
//   5. another beat
//   6. "uidotto", left to right
//   7. the closing flourish (the line over the tt), slowing to a stop
//
// The gaps between delays are the held beats; the only motion in each window is
// the single stroke whose turn it is. Each `d` is a centerline trace whose
// subpaths are ordered and oriented to follow that stroke's path (the G's
// subpaths are pen-connected end to end, so its one reveal reads as a single
// unbroken gesture). Re-tracing the source only ever changes these `d`s (and the
// matching viewBox).
const STROKES = [
  {
    // Capital G of "Giacomo": stem down, loop, then the rightward sweep.
    d: "M52.8 14.8C53.1 14.7 54.4 13.7 53.5 13.6C53.1 13.5 52.6 13.8 52.3 14.1C51.4 14.7 50.6 15.5 49.8 16.1C46.2 19 43.1 22.3 40 25.6C37 28.8 34.2 31.9 31.5 35.2C29.8 37.4 28.2 39.6 26.5 41.8C23.4 45.7 20.1 49.4 17.1 53.5C14.3 57.4 11.5 61.3 8.6 65.1C7.7 66.4 6.6 67.7 5.7 69C5.4 69.4 5.4 69.9 5 70.3 M5.4 70.2C7 70.2 8.8 69 10.3 68.3C12.9 67 15.6 65.9 18.2 64.7C26.3 60.9 34.8 58 43.1 54.9C46 53.8 48.9 52.7 52 52.3C52.7 52.1 54.9 51.5 55 52.7C55 53.7 53.9 54.8 53.3 55.4C51.4 57.4 49.2 59.1 47 60.7C40.9 65.2 34.2 69.1 27.7 73C25.6 74.3 23.4 75.5 21.6 77C20.8 77.7 19.9 78.2 19.5 79.1L20.4 79.1L19.9 78.5 M20.5 79.1C24.9 76.6 29.6 74.7 34.3 72.8C38.1 71.2 41.9 69.7 45.8 68.4C49.7 67 54 65.3 58.2 64.9C60.4 64.6 62.5 64.7 64.5 65.9C66.2 66.8 67.5 68.5 69.5 69C73.1 69.9 76.8 67.7 79.9 66.1C81.4 65.3 83 64.7 84.4 63.7",
    delayMs: 0,
    durationMs: 470,
    ease: "cubic-bezier(0.4, 0, 0.3, 1)",
  },
  {
    // "iacomo", left to right.
    d: "M62.1 48.5C62.2 48 61.9 47.9 61.5 48.1C62.5 49.1 60.9 50.9 60.3 51.9C60.2 52.2 59.5 53.1 59.9 53.4C60.4 53.8 62 52.5 62.4 52.2C64.1 51 65.7 49.8 67.4 48.7C67.9 48.4 68.8 47.5 69.4 47.5C69.8 47.5 69.8 48.2 69.8 48.5C69.7 49.3 69.5 50.1 69.2 50.9C69.2 51.1 69 51.5 69.3 51.7C69.7 51.8 70.1 51.4 70.4 51.2C71.1 50.7 71.6 50 72.2 49.3C72.4 49.1 72.7 48.6 73 48.6C73.4 48.5 73.4 49.1 73.4 49.3C73.4 50.1 73 51 74 51.1C75.9 51.5 76.8 49.7 78.4 49.5C78.2 50.3 77.3 51.6 77.7 52.4C78.2 53.4 80.2 52.3 80.8 52C82.9 51.1 85.1 50 87.1 48.9C87.8 48.5 88.6 47.5 89.4 47.4C89.8 47.3 89.9 47.6 89.8 47.9C89.6 48.5 88.8 49.5 89.5 50.1C90.3 50.9 92.1 49.8 93 49.5C94.9 48.6 96.7 47 98.4 45.8C98.9 45.5 99.9 44.3 100.5 44.5C100.9 44.7 100.7 45.2 100.6 45.5C100.3 46.3 99.4 47.3 99.7 48.3C101.1 47.7 102.4 46.1 103.6 45.1C103.9 44.9 104.8 44 105.2 44.4C105.7 44.9 105.2 46.4 105.2 47C106.5 46.8 107.4 44.9 108.3 43.9C108.6 43.6 109.1 42.9 109.6 43C110.2 43 110 44 110 44.3C110 45.5 109.9 46.7 109.7 47.9C109.7 48.2 109.6 48.9 110 49C110.5 49.1 110.9 48.6 111.2 48.3C112.1 47.5 112.9 46.3 113.9 45.6C114.6 45.1 115.2 46.4 116 46.2C117.6 46 118.7 44.4 120.4 44.1C122.1 43.9 123.8 45.2 125.3 45.8C127.2 46.6 129.7 46.9 131.8 46.9",
    delayMs: 490,
    durationMs: 330,
    ease: "cubic-bezier(0.45, 0, 0.4, 1)",
  },
  {
    // Capital G of "Guidotto", top to bottom (after the space between names),
    // on its own beat.
    d: "M190 5.7C190.6 5.6 192.4 5 192.8 5.6C193.3 6.4 191.3 8.2 190.7 8.8C188 11.5 185 14.1 182 16.7C177.2 21.1 172.3 25.2 167.6 29.7C160.8 36.1 154.5 43.1 147.7 49.4C144.2 52.7 140.4 55.7 136.7 58.7C135.9 59.4 134.9 60 134.3 60.9C134 61.2 133.7 61.7 134.1 62.1C134.7 62.7 136.8 61.6 137.5 61.4C140.8 60.4 144.1 59.5 147.4 58.6C156.3 56.2 165.1 53.5 174 51C176.9 50.2 179.9 49.6 183 49C184.8 48.7 186.8 48.3 188.7 48.5C191.4 48.9 191.1 51.8 189.9 53.6C187.6 57.1 183.5 59.6 180 61.8C176.4 63.9 172.6 65.7 168.9 67.7C165.5 69.5 161.9 71.3 158.2 72.7C157.2 73.1 156.2 73.5 155.1 73.8C154.8 74 154.2 74.1 154 74.4C153.7 74.9 154.5 75 154.8 74.9L154.6 74.2",
    delayMs: 930,
    durationMs: 300,
    ease: "cubic-bezier(0.4, 0, 0.3, 1)",
  },
  {
    // "uidotto", left to right (after a beat so the G above stands alone).
    d: "M154.8 74.9C163.4 74.9 171.9 72.3 180.3 71.1C185.7 70.3 191.2 69.5 196.7 69C200.6 68.6 204.5 68.3 208.3 67.7C212.6 67 216.8 66.2 221.1 65.6C223.5 65.3 225.9 64.8 228.4 64.8 M198.5 47.9C198.2 48.7 197.3 49.6 197.3 50.5C197.4 51.4 199 51.2 199.6 51.1C201.8 50.9 203.3 48.8 204.7 47.4C205.7 48.4 204.7 50 205.3 51.4C205.7 52.2 206.8 52.4 207.6 52.1C209 51.5 209.6 49.9 210.5 48.8C210.8 49.1 211.1 49.3 211.1 49.7C211.2 50.3 210.9 51.4 211.5 51.8C212 52.2 212.7 51.5 213 51.2C213.7 50.5 214.8 47.9 215.9 48C216.5 48 216.7 48.6 216.5 49.1C216.1 49.8 215.2 50.3 214.8 51C214.5 51.3 214.5 51.8 215 51.9C216.2 52.3 218.1 50.4 218.8 49.6C220.3 47.9 221.7 46.3 222.9 44.3C223.7 43.1 224.4 41.4 225.7 40.6 M230.9 29.9C230.7 31.8 229 33.8 228.2 35.6C226.4 39.4 225 43.4 223.4 47.4C222.8 48.8 222.2 50.2 221.6 51.6C221.4 52.1 221 52.8 221.2 53.3C221.4 53.7 222 53.5 222.3 53.4C223.2 52.9 224.1 52.4 224.9 51.8C227.1 50.1 229 48.3 230.9 46.3C231.8 45.3 232.9 43.6 234.2 43.1C235 42.8 235 43.6 234.9 44.1C234.7 45.1 234 46.1 233.4 46.9C232.5 48 231.8 48.9 231.2 50.2 M230.2 51.3C231.2 50.4 232.4 50.1 233.5 49.3C234.5 48.5 235.2 47.4 236 46.4C236.9 45.4 237.8 44.5 238.6 43.4C240.7 40.4 242.1 37 244.4 34.1C244.6 33.8 244.4 33.4 244.6 33.1C244.9 32.8 246 33 246.4 32.9C247.8 32.8 249.2 32.8 250.5 32.7C251.1 32.6 251.8 32.8 252.3 32.5C252.9 32.2 253.3 30.6 253.6 30C254.3 28.4 254.9 26.9 255.5 25.3C255.8 24.4 256 23.4 256.5 22.6 M234 33.4L241.5 33.2L244.5 33.2 M243.9 34.6C244.9 35.6 243.6 37.5 243.1 38.6C242.1 41.2 240.9 44 240.2 46.7C240 47.5 239.4 49 239.7 49.7C240 50.2 240.8 49.7 241 49.5C242 48.7 243 47.7 243.7 46.6C245.9 43.4 248.2 40.3 250.1 36.8C250.7 35.5 251.8 34.2 252.1 32.8",
    delayMs: 1340,
    durationMs: 380,
    ease: "cubic-bezier(0.45, 0, 0.4, 1)",
  },
  {
    // Closing flourish (the line over the tt), slowing to a stop.
    d: "M252.6 32.6C253.1 32.6 254.6 32.3 254.8 32.9C254.9 33.3 254.7 34 254.6 34.4C254.4 35.5 254.2 36.6 254 37.6C253.4 41.6 252.7 45.8 252.5 49.7C252.5 50.7 252.4 51.6 252.4 52.5C252.4 52.8 252.4 53.4 252.7 53.6C253.2 53.9 253.9 53 254.2 52.6C255.2 51.2 255.9 49.4 256.5 47.8C257.1 46.3 257.9 44.8 258.5 43.3C259.3 40.9 259.8 38.3 260.8 36C261.9 37.1 261.2 38.6 261.1 40.1C260.8 43.5 260.1 47.3 260.5 50.7C260.7 52.4 261.4 55 263.6 55.1C265.5 55.2 267.1 53 268.2 51.7C271.6 47.6 272.6 42.1 275.9 37.9C277.5 35.9 279.8 34.9 282.1 33.9C286.2 32.1 290.6 30.6 294.8 29.2C297.4 28.3 300.1 27.4 302.6 26.2C303 26 305 25.2 304.7 24.6C304.5 24 302.1 24.5 301.6 24.6C298.2 25.3 294.8 26 291.5 26.7C282.5 28.8 273.4 30.4 264.2 31.4C262.1 31.7 259.9 31.9 257.8 32.1C257.2 32.1 255.8 32.5 255.4 32.1C254.9 31.6 255.4 30.3 255.6 29.8C256 27.6 256.9 25.3 257.1 23.1 M257.2 22.8C256.8 23.1 256.6 22.6 256.6 22.3L257.2 22.8C257.7 21.9 258.2 20.8 257.4 19.9C257.8 19.5 258.1 19.3 258.1 18.7",
    delayMs: 1720,
    durationMs: 280,
    ease: "cubic-bezier(0.2, 0.6, 0.2, 1)",
  },
] as const;

export function Signature() {
  const pathsRef = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    const paths = pathsRef.current;
    if (paths.length !== STROKES.length || paths.some((p) => p === null)) {
      return;
    }
    // prefers-reduced-motion keeps the finished, server-rendered mark (the
    // default state): never armed, never animated, shown instantly.
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) {
      return;
    }
    // If scroll-into-view cannot be observed, never arm. Arming hides the strokes,
    // and without an observer to un-hide them the visitor would be left with a
    // blank signature (worse than no motion). Bail to the finished mark instead.
    // This guard must stay before the arming below.
    if (typeof IntersectionObserver === "undefined") {
      return;
    }
    // Arm every stroke: hide it with no transition, so nothing moves on its own
    // until the signature is scrolled into view.
    for (const path of paths) {
      if (!path) {
        continue;
      }
      path.style.transition = "none";
      path.style.strokeDasharray = "1";
      path.style.strokeDashoffset = "1";
    }

    const root = paths[0]?.ownerSVGElement ?? paths[0];
    if (!root) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Draw the strokes on in order, once, then stop observing. Each
            // stroke runs on its own delay/duration/easing, so the held beats and
            // the final slow-down live entirely in the STROKES data.
            paths.forEach((path, i) => {
              if (!path) {
                return;
              }
              const { delayMs, durationMs, ease } = STROKES[i];
              path.style.transition = `stroke-dashoffset ${durationMs}ms ${ease} ${delayMs}ms`;
              path.style.strokeDashoffset = "0";
            });
            obs.disconnect();
          }
        }
      },
      { threshold: 0.45 }
    );
    // Observe the <svg> root, not the inner <path>s: intersection on SVG geometry
    // children is unreliable across engines, and a missed callback is the same
    // blank-signature failure mode the guard above protects against.
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <svg
      aria-hidden="true"
      className={styles.signature}
      fill="none"
      viewBox="0 0 310 86.3"
    >
      {STROKES.map((stroke, i) => (
        <path
          className={styles.signaturePath}
          d={stroke.d}
          key={stroke.d}
          pathLength={1}
          ref={(el) => {
            pathsRef.current[i] = el;
          }}
        />
      ))}
    </svg>
  );
}
