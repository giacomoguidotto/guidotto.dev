import Image from "next/image";
import { content } from "~/content";

// Masthead — the site chrome at frame 1: the wordmark plus a small
// signature-scale avatar (attribution, subordinate to the work). Present so the
// site is never faceless; this begins the human escalation that pays off as a
// full warm face before the CTA.

export function Masthead() {
  const { wordmark, name } = content.site;
  return (
    <header className="masthead">
      <a aria-label={name} className="masthead__home" href="/">
        <span className="masthead__avatar">
          <Image
            alt=""
            className="masthead__avatar-img"
            height={64}
            priority
            src="/portrait/avatar.jpg"
            width={64}
          />
        </span>
        <span className="masthead__wordmark">{wordmark}</span>
      </a>
    </header>
  );
}
