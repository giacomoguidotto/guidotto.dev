// ProjectMedia — the per-project media primitive inside a vessel.
//
// Today it renders an abstract SVG motif (a stand-in that reads as a *different
// kind of thing* at a glance: variety is the message). It is the single swap
// point for when the real per-project screen recordings land: replace the motif
// with an optimized looping `<video>` + poster here and every vessel upgrades.
// Stroke art uses `currentColor` so the vessel can tint it on focus.

import type { Motif } from "~/content";

function Neural() {
  // AnyPINN — a small feed-forward network resolving from chaos to order.
  const columns = [
    { x: 30, ys: [22, 46, 70, 94, 118] },
    { x: 85, ys: [34, 70, 106] },
    { x: 140, ys: [46, 82, 118] },
    { x: 195, ys: [70] },
  ];
  const edges = columns.slice(0, -1).flatMap((col, i) =>
    col.ys.flatMap((y) =>
      columns[i + 1].ys.map((y2) => ({
        x1: col.x,
        x2: columns[i + 1].x,
        y1: y,
        y2,
      }))
    )
  );
  return (
    <svg aria-hidden="true" className="motif" fill="none" viewBox="0 0 220 140">
      <title>Neural network motif</title>
      {edges.map((e) => (
        <line
          key={`${e.x1}-${e.y1}-${e.x2}-${e.y2}`}
          stroke="currentColor"
          strokeWidth="0.6"
          x1={e.x1}
          x2={e.x2}
          y1={e.y1}
          y2={e.y2}
        />
      ))}
      {columns.flatMap((col) =>
        col.ys.map((y) => (
          <circle
            cx={col.x}
            cy={y}
            fill="currentColor"
            key={`${col.x}-${y}`}
            r="3.2"
          />
        ))
      )}
    </svg>
  );
}

function Topology() {
  // Orray — isometric spatial topology, stacked cells.
  const cells = [0, 1, 2, 3];
  return (
    <svg aria-hidden="true" className="motif" fill="none" viewBox="0 0 220 140">
      <title>Spatial topology motif</title>
      {cells.map((row) =>
        cells.map((col) => (
          <path
            d={`M ${30 + col * 36 + row * 14} ${40 + row * 22} l 26 -13 l 26 13 l -26 13 z`}
            key={`c-${row}-${col}`}
            stroke="currentColor"
            strokeWidth="0.7"
          />
        ))
      )}
    </svg>
  );
}

function Mobile() {
  // Tempo — Android app surface, tall and near.
  return (
    <svg aria-hidden="true" className="motif" fill="none" viewBox="0 0 120 240">
      <title>Mobile app motif</title>
      <rect
        height="232"
        rx="18"
        stroke="currentColor"
        strokeWidth="1.4"
        width="112"
        x="4"
        y="4"
      />
      <circle cx="60" cy="76" fill="currentColor" opacity="0.5" r="22" />
      {[120, 140, 160, 180, 200].map((y, i) => (
        <rect
          fill="currentColor"
          height="6"
          key={y}
          opacity={0.35 - i * 0.04}
          rx="3"
          width={i % 2 === 0 ? 78 : 56}
          x="21"
          y={y}
        />
      ))}
    </svg>
  );
}

function MacWindow() {
  // Scry — native macOS window.
  return (
    <svg aria-hidden="true" className="motif" fill="none" viewBox="0 0 240 150">
      <title>Desktop window motif</title>
      <rect
        height="142"
        rx="10"
        stroke="currentColor"
        strokeWidth="1.2"
        width="232"
        x="4"
        y="4"
      />
      <line
        stroke="currentColor"
        strokeWidth="1"
        x1="4"
        x2="236"
        y1="28"
        y2="28"
      />
      {[14, 26, 38].map((cx) => (
        <circle
          cx={cx}
          cy="16"
          key={cx}
          r="3"
          stroke="currentColor"
          strokeWidth="0.8"
        />
      ))}
      <line
        stroke="currentColor"
        strokeWidth="0.8"
        x1="64"
        x2="64"
        y1="28"
        y2="146"
      />
      {[44, 60, 76, 92].map((y) => (
        <rect
          fill="currentColor"
          height="5"
          key={y}
          opacity="0.3"
          rx="2"
          width="34"
          x="14"
          y={y}
        />
      ))}
      {[44, 62, 80, 98, 116].map((y, i) => (
        <rect
          fill="currentColor"
          height="6"
          key={y}
          opacity="0.28"
          rx="2"
          width={i % 2 === 0 ? 140 : 104}
          x="80"
          y={y}
        />
      ))}
    </svg>
  );
}

function Gallery() {
  // Ginevra Renier — a photographer's gallery grid (the love letter).
  const frames = [
    { x: 14, y: 16, w: 86, h: 70 },
    { x: 110, y: 16, w: 86, h: 44 },
    { x: 110, y: 68, w: 40, h: 36 },
    { x: 158, y: 68, w: 38, h: 36 },
    { x: 14, y: 96, w: 50, h: 30 },
    { x: 72, y: 96, w: 124, h: 30 },
  ];
  return (
    <svg aria-hidden="true" className="motif" fill="none" viewBox="0 0 210 140">
      <title>Photography gallery motif</title>
      {frames.map((f) => (
        <g key={`${f.x}-${f.y}`}>
          <rect
            height={f.h}
            stroke="currentColor"
            strokeWidth="0.9"
            width={f.w}
            x={f.x}
            y={f.y}
          />
          <circle
            cx={f.x + f.w * 0.7}
            cy={f.y + f.h * 0.35}
            fill="currentColor"
            opacity="0.4"
            r="4"
          />
          <path
            d={`M ${f.x + 2} ${f.y + f.h - 2} l ${f.w * 0.3} -${f.h * 0.4} l ${f.w * 0.25} ${f.h * 0.2} l ${f.w * 0.4} -${f.h * 0.3}`}
            opacity="0.5"
            stroke="currentColor"
            strokeWidth="0.8"
          />
        </g>
      ))}
    </svg>
  );
}

const MOTIFS: Record<Motif, () => React.JSX.Element> = {
  neural: Neural,
  topology: Topology,
  mobile: Mobile,
  macwindow: MacWindow,
  gallery: Gallery,
};

export function ProjectMedia({ motif }: { motif: Motif }) {
  const Art = MOTIFS[motif];
  return (
    <span className="vessel__media">
      <Art />
    </span>
  );
}
