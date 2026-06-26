// Denouement — the lower-page close, composed: the Mission beat, then the Human
// anchor (warm portrait slot, the personal line, the animated signature).
//
// Deep module: <Denouement /> is the whole interface for the lower page; the
// mission narration, the human anchor, the placeholder-tolerant portrait, and
// the scroll-into-view signature draw are all hidden inside. It carries its own
// .stage backdrop, so it drops onto the composed home page as one self-contained
// section (like <Stage /> and <Attractor />) with no wrapper at the call site.
// The CTA door and the quiet social rail are a separate slice (#7); on the
// composed home page this section sits between the showpiece finale and that
// CTA close.

import styles from "./denouement.module.css";
import { HumanAnchor } from "./human-anchor";
import { Mission } from "./mission";

export function Denouement() {
  return (
    <div className={styles.stage}>
      <div className={styles.section}>
        <Mission />
        <HumanAnchor portraitSrc="/portrait/giacomo.jpg" />
      </div>
    </div>
  );
}
