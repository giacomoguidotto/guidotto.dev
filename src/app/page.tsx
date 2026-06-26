import { Attractor } from "~/components/attractor/attractor";
import { ContactDoor } from "~/components/contact/contact-door";
import contactStyles from "~/components/contact/contact-door.module.css";
import { Denouement } from "~/components/denouement/denouement";
import denouementStyles from "~/components/denouement/denouement.module.css";
import { Masthead } from "~/components/masthead";
import { Stage } from "~/components/stage/stage";

// The home page — the capstone (#10). The verified deep modules from the earlier
// slices are composed here into one continuous story, in the canonical order:
//
//   hero (Vitrine) -> proof grid -> showpiece finale -> mission -> human anchor -> CTA
//
// The order is realised through three composed surfaces:
//
//   - <Stage /> owns the hero -> proof-grid handoff. It server-renders the plain,
//     fully indexable sectioned story (Hero then ProofGrid) and upgrades, only on
//     motion-welcome fine pointers wide enough for the 2x2, to the single-DOM-node
//     FLIP morph. The thesis is server text, so it is the LCP and the first words
//     a reader (or a crawler) sees.
//   - <Attractor /> is the showpiece finale: a server-rendered, indexable stage
//     whose one live WebGL instrument lazy-loads only when it scrolls into view,
//     so the single heavy spend is never in the initial budget. The AnyPINN vessel
//     that set itself aside during the handoff lands here, small, at the top-left
//     of the instrument (the Stage aims its set-aside at [data-finale-landing]).
//   - <Denouement /> (Mission + Human anchor + Signature) then the <ContactDoor />
//     CTA close the page. These are the denouement, not a third act: no new
//     spectacle, just the warm human landing and the one loud door.
//
// Every section owns its own reactivity and only one is ever on screen, so the
// reactivity law (one physics, one element loud at a time) holds across the whole
// page. Each surface carries its own prefers-reduced-motion / coarse-pointer /
// no-JS / no-WebGL degradation, so the composed page stays legible and static
// wherever the enhancements are unwelcome.

export default function Home() {
  return (
    <main className="page">
      <Masthead />
      <Stage />
      <Attractor />
      <div className={denouementStyles.stage}>
        <Denouement />
      </div>
      <div className={contactStyles.stage}>
        <ContactDoor />
      </div>
    </main>
  );
}
