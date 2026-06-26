"use client";

// ContactDoor — the one loud owned door of the CTA close (#7) plus the quiet
// rail beneath it. The reactivity law: one loud door, a quiet rail of
// alternatives, never an equal-weight menu.
//
// Static-first: the door is a native <details>/<summary>, so "Get in touch"
// expands the form with no JS at all, never a modal or a nav. When scripting is
// on, the same toggle is upgraded into a morph: the pill grows into a raised
// card, the "Get in touch" label glides from the pill's centre to the card's
// top-left and settles as the card's title, and the fields cascade in. That
// upgrade is the View Transitions API (a shared-element morph between two DOM
// states) plus a CSS stagger — both feature-detected and collapsed to an
// instant show under reduced motion or on engines without the API. The open
// card closes on a click outside or on Escape; it rests on a lifted shadow
// rather than a page-dimming scrim.
//
// Anti-spam is load-bearing and split across the seam: a honeypot field and the
// Cloudflare Turnstile token ride along in the body; the actual verification,
// rate limiting, and send all happen in the deep handler behind /api/contact.
// No raw mailto — the form IS the spam-safe email.

import Script from "next/script";
import {
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { content } from "~/content";
import styles from "./contact-door.module.css";
import { GitHubMark, LinkedInMark, XMark } from "./social-icons";

const { cta } = content;

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

type Status = "idle" | "sending" | "sent" | "error";

type Mark = (props: { readonly className?: string }) => ReactNode;

const RAIL_ICONS: Record<string, Mark> = {
  GitHub: GitHubMark,
  LinkedIn: LinkedInMark,
  X: XMark,
};

// Position in the cascade. The stylesheet turns it into a per-field delay so the
// fields appear in succession once the card has finished morphing open.
function revealOrder(index: number): CSSProperties {
  return { "--reveal-index": index } as CSSProperties;
}

function QuietRail() {
  return (
    <nav aria-label="Other ways to reach me" className={styles.rail}>
      {cta.rail.map((link) => {
        const Icon = RAIL_ICONS[link.label];
        if (link.href) {
          return (
            <a
              aria-label={link.label}
              className={styles.railLink}
              href={link.href}
              key={link.label}
              rel="me noreferrer"
              target="_blank"
            >
              <Icon className={styles.railIcon} />
            </a>
          );
        }
        // Dark until a handle is sourced (X): present for visual completeness
        // but inert, so it is hidden from assistive tech (nothing to action).
        return (
          <span
            aria-hidden="true"
            className={`${styles.railLink} ${styles.railLinkDark}`}
            key={link.label}
          >
            <Icon className={styles.railIcon} />
          </span>
        );
      })}
    </nav>
  );
}

export function ContactDoor() {
  const doorRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  const [open, setOpen] = useState(false);
  // hasOpened latches true the first time the door opens. The Turnstile loader is
  // a third-party anti-spam script; gating it on this keeps it out of the home
  // page's hydration path entirely for the many visitors who scroll past the CTA
  // without ever opening it, and only ever pulls it in once the form is actually
  // in use. Latched (not just `open`) so a started challenge / minted token
  // survives a close-and-reopen rather than re-initialising.
  const [hasOpened, setHasOpened] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorReason, setErrorReason] = useState<string | null>(null);
  // canMorph: the View Transitions API is present and motion is welcome, so the
  // door is allowed to grow the field cascade's start delay to match the morph.
  // Resolved after mount so SSR and first paint agree.
  const [canMorph, setCanMorph] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    setCanMorph("startViewTransition" in document && !reduce);
  }, []);

  // The single toggle. The DOM mutation (el.open) is synchronous so the View
  // Transition snapshots a clean before/after; everything else (React state,
  // the morph) follows from the resulting `toggle` event.
  const setDoor = useCallback((next: boolean) => {
    const el = doorRef.current;
    if (!el) {
      return;
    }
    const apply = () => {
      el.open = next;
    };
    const supported =
      typeof document !== "undefined" && "startViewTransition" in document;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (supported && !reduce) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }, []);

  const handleSummaryClick = (event: MouseEvent<HTMLElement>) => {
    // Take the toggle off the browser so it can ride a View Transition; without
    // JS this handler never runs and the native <details> toggle stands in.
    event.preventDefault();
    // Once open, the header is a title — closing is the ✕, a click outside, or
    // Escape, never the header itself.
    if (doorRef.current?.open) {
      return;
    }
    setDoor(true);
  };

  // Keep React state in step with the real <details>, whoever flipped it.
  const handleToggle = () => {
    const el = doorRef.current;
    if (el) {
      setOpen(el.open);
      if (el.open) {
        setHasOpened(true);
      }
    }
  };

  // Open hands focus to the first field; closing returns it to the door.
  useEffect(() => {
    if (open) {
      firstFieldRef.current?.focus();
    } else if (wasOpen.current) {
      summaryRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Click-outside and Escape close the open card.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const el = doorRef.current;
      if (el && !el.contains(event.target as Node)) {
        setDoor(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDoor(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setDoor]);

  const submit = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    setStatus("sending");
    setErrorReason(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          honeypot: data.get("company"),
          token: data.get("cf-turnstile-response"),
        }),
      });
      if (response.ok) {
        setStatus("sent");
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;
      setErrorReason(typeof body?.error === "string" ? body.error : null);
      setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(event.currentTarget).catch(() => {
      setStatus("error");
    });
  };

  return (
    <div className={styles.stage}>
      <section className={styles.contact} id="contact">
        <details
          className={canMorph ? `${styles.door} ${styles.morph}` : styles.door}
          onToggle={handleToggle}
          ref={doorRef}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: <summary> is a
              native disclosure button (implicit role, built-in keyboard toggle);
              onClick only upgrades that toggle into a view transition. */}
          <summary
            className={styles.summary}
            onClick={handleSummaryClick}
            ref={summaryRef}
          >
            <span aria-hidden="true" className={styles.summaryDot} />
            <span className={styles.label}>{cta.button}</span>
          </summary>

          <div className={styles.panel}>
            {status === "sent" ? (
              <p className={styles.confirmation} role="status">
                {cta.confirmation}
              </p>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                {/* Honeypot: off-screen, no human ever fills it; a bot that does
                    gets a friendly 200 and nothing sent. */}
                <div aria-hidden="true" className={styles.honeypot}>
                  <label htmlFor="contact-company">Company</label>
                  <input
                    autoComplete="off"
                    id="contact-company"
                    name="company"
                    tabIndex={-1}
                  />
                </div>

                <label
                  className={`${styles.field} ${styles.reveal}`}
                  style={revealOrder(0)}
                >
                  <span className={styles.fieldLabel}>{cta.fields.name}</span>
                  <input
                    autoComplete="name"
                    className={styles.input}
                    name="name"
                    ref={firstFieldRef}
                    required
                    type="text"
                  />
                </label>

                <label
                  className={`${styles.field} ${styles.reveal}`}
                  style={revealOrder(1)}
                >
                  <span className={styles.fieldLabel}>{cta.fields.email}</span>
                  <input
                    autoComplete="email"
                    className={styles.input}
                    name="email"
                    required
                    type="email"
                  />
                </label>

                <label
                  className={`${styles.field} ${styles.reveal}`}
                  style={revealOrder(2)}
                >
                  <span className={styles.fieldLabel}>
                    {cta.fields.message}
                  </span>
                  <textarea
                    className={styles.textarea}
                    name="message"
                    required
                    rows={4}
                  />
                </label>

                {TURNSTILE_SITE_KEY && hasOpened ? (
                  <>
                    <Script async defer src={TURNSTILE_SCRIPT} />
                    <div
                      className="cf-turnstile"
                      data-appearance="interaction-only"
                      data-sitekey={TURNSTILE_SITE_KEY}
                      data-theme="dark"
                    />
                  </>
                ) : null}

                <button
                  className={`${styles.send} ${styles.reveal}`}
                  disabled={status === "sending"}
                  style={revealOrder(3)}
                  type="submit"
                >
                  {cta.send}
                </button>

                {status === "error" ? (
                  <p className={styles.error} role="alert">
                    {errorReason ?? "Something went wrong. Please try again."}
                  </p>
                ) : null}
              </form>
            )}
          </div>
        </details>

        <QuietRail />
      </section>
    </div>
  );
}
