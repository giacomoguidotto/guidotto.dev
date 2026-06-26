import { Attractor } from "~/components/attractor/attractor";
import { Masthead } from "~/components/masthead";

// Standalone preview of the showpiece finale (The Attractor) so the section is
// independently verifiable by eye at /preview/attractor. This is the skeleton cut
// (#9): the section scaffold, the quiet HUD chrome, and the AnyPINN vessel's small
// top-left landing slot — the live WebGL scene is a later cut. Composing the
// finale into the real home page (and wiring the handoff's set-aside return) is
// the later capstone slice (#10), which is why this lives behind a thin preview
// route rather than touching src/app/page.tsx.

export default function AttractorPreview() {
  return (
    <main className="page">
      <Masthead />
      <Attractor />
    </main>
  );
}
