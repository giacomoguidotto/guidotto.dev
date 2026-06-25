import { Attractor } from "~/components/attractor/attractor";
import { Masthead } from "~/components/masthead";
import { Stage } from "~/components/stage/stage";

// Standalone preview of the scroll handoff (Stage) followed by the showpiece
// finale (The Attractor), so the whole hero -> grid -> finale story is verifiable
// by eye at /preview/stage. The Stage owns the hero -> grid handoff: it
// server-renders the plain sectioned fallback and upgrades to the FLIP morph on
// motion-welcome fine pointers. The finale lands below the grid, and the fifth
// vessel's set-aside aims at the finale's landing slot (so the AnyPINN vessel ends
// up parked, small, at the top-left of the instrument rather than vanishing).
// Composing this into the real home page is the later capstone slice (#10), which
// is why it lives behind a thin preview route rather than touching page.tsx.

export default function StagePreview() {
  return (
    <main className="page">
      <Masthead />
      <Stage />
      <Attractor />
    </main>
  );
}
