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
// `render=explicit` stops the script from auto-scanning for `.cf-turnstile`
// elements: we render the widget ourselves in an effect so it re-initialises
// cleanly every time the form remounts, and so the minted token lands in React
// state where Send can wait on it.
const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// The slice of the Cloudflare Turnstile browser API we drive explicitly.
interface TurnstileApi {
  remove: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: {
      readonly sitekey: string;
      readonly appearance?: "always" | "execute" | "interaction-only";
      readonly callback?: (token: string) => void;
      readonly "error-callback"?: () => void;
      readonly "expired-callback"?: () => void;
      readonly theme?: "auto" | "dark" | "light";
    }
  ) => string;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

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
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const wasOpen = useRef(false);
  // Whether the next close should pull focus back to the pill. True for keyboard
  // dismissals (Escape) so a keyboard user is never stranded; flipped to false
  // for a pointer click outside, where yanking focus back — and flashing the
  // pill's focus ring — would be unexpected.
  const restoreFocus = useRef(true);

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
  // The Turnstile token, captured from the widget's callback. Empty until
  // Cloudflare has cleared the visitor; Send stays disabled until it lands so a
  // quick click can never post a null token. The interaction-only widget is
  // invisible, so there is otherwise no cue that it is still working.
  const [token, setToken] = useState("");
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
  // the morph) follows from the resulting `toggle` event. `afterSettle` runs
  // once the morph has fully finished, so any content change the caller wants to
  // make (resetting the form on close) lands while the card is hidden behind the
  // collapsed pill rather than flashing through the still-open card.
  const setDoor = useCallback((next: boolean, afterSettle?: () => void) => {
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
      const transition = document.startViewTransition(apply);
      if (afterSettle) {
        // `.finished` rejects if the transition is skipped; either way the card
        // has settled, so run the callback on both outcomes.
        transition.finished.then(afterSettle, afterSettle);
      }
      return;
    }
    apply();
    afterSettle?.();
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

  // Dismissing the card discards the draft: clear the fields and drop any sent /
  // error state so the next open is a fresh form rather than a stale "Got it!"
  // or a half-typed message. The inputs are uncontrolled, so the actual clearing
  // is the form's native reset(); when the form is unmounted (the sent state),
  // dropping status back to "idle" remounts it empty anyway.
  const resetForm = useCallback(() => {
    formRef.current?.reset();
    setStatus("idle");
    setErrorReason(null);
  }, []);

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

  // Open hands focus to the first field; closing returns it to the door, but
  // only when the close was a keyboard dismissal — a pointer click outside
  // leaves focus where the click landed (and so never flashes the pill's ring).
  useEffect(() => {
    if (open) {
      firstFieldRef.current?.focus();
    } else if (wasOpen.current && restoreFocus.current) {
      summaryRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // While the card is open, the document owns two keyboard shortcuts: Escape
  // closes it (restoring focus to the trigger), and Cmd/Ctrl+Enter sends from
  // any field — including the multi-line message, where a bare Enter inserts a
  // newline rather than submitting. The shortcut validates first: an invalid
  // field (an empty required box, a malformed email) surfaces the browser's
  // native prompt via reportValidity() and leaves Send active, so it can never
  // strand the button in a dimmed "sending" state that no submit will clear. A
  // valid form goes through requestSubmit() (not submit()) so it fires the same
  // submit event as the Send button, and submit() self-guards against a send
  // already in flight or Turnstile still verifying, so a held shortcut can never
  // double-post. Click-outside also closes (and resets) the card.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const el = doorRef.current;
      if (el && !el.contains(event.target as Node)) {
        restoreFocus.current = false;
        setDoor(false, resetForm);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        restoreFocus.current = true;
        setDoor(false, resetForm);
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        const form = formRef.current;
        if (!form) {
          return;
        }
        if (form.checkValidity()) {
          form.requestSubmit();
        } else {
          form.reportValidity();
        }
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setDoor, resetForm]);

  // Soft keyboard (mobile). The on-screen keyboard overlays the page without
  // resizing the layout viewport, so a field low in the card can end up
  // typing-blind behind it. We read the overlap from the VisualViewport API and
  // publish it on the door as the --keyboard-inset length plus a data-keyboard
  // flag; the stylesheet uses them to pin the card to the top and cap the
  // scrollable form to the band above the keyboard. We then keep whichever field
  // is focused scrolled into that band — both as the keyboard opens and as focus
  // tabs between fields while it is up. Inert on desktop and on engines without
  // VisualViewport: the inset stays 0 and the centred layout is untouched.
  useEffect(() => {
    const viewport = window.visualViewport;
    const el = doorRef.current;
    if (!(open && viewport && el)) {
      return;
    }
    const scrollActiveIntoView = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && el.contains(active)) {
        active.scrollIntoView({ block: "nearest" });
      }
    };
    const sync = () => {
      const overlap = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop
      );
      if (overlap > 0) {
        el.dataset.keyboard = "open";
        el.style.setProperty("--keyboard-inset", `${overlap}px`);
        scrollActiveIntoView();
      } else {
        el.removeAttribute("data-keyboard");
        el.style.removeProperty("--keyboard-inset");
      }
    };
    const onFocusIn = () => {
      if (el.dataset.keyboard === "open") {
        scrollActiveIntoView();
      }
    };
    sync();
    viewport.addEventListener("resize", sync);
    el.addEventListener("focusin", onFocusIn);
    return () => {
      viewport.removeEventListener("resize", sync);
      el.removeEventListener("focusin", onFocusIn);
      el.removeAttribute("data-keyboard");
      el.style.removeProperty("--keyboard-inset");
    };
  }, [open]);

  // The form (and so the Turnstile container) is mounted whenever the door has
  // been opened and we are not showing the post-send confirmation.
  const turnstileMounted = hasOpened && status !== "sent";

  // Render the invisible Turnstile widget once its script is ready and capture
  // the token into state. We render explicitly (rather than via the script's
  // auto-scan) so the widget re-initialises every time the form remounts — after
  // a send, or a close-and-reopen — and so the token is React state we can hold
  // Send on. Fails safe: on expiry or error the token clears and Send re-locks.
  useEffect(() => {
    if (!(turnstileMounted && TURNSTILE_SITE_KEY)) {
      return;
    }
    let cancelled = false;
    let pollId: number | undefined;
    const renderWidget = () => {
      const api = window.turnstile;
      const container = turnstileRef.current;
      if (cancelled || !(api && container) || widgetId.current !== null) {
        return;
      }
      widgetId.current = api.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: "interaction-only",
        theme: "dark",
        callback: (value: string) => setToken(value),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    };
    // The API may still be loading; poll briefly until it is on `window`.
    if (window.turnstile) {
      renderWidget();
    } else {
      pollId = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(pollId);
          renderWidget();
        }
      }, 150);
    }
    return () => {
      cancelled = true;
      if (pollId !== undefined) {
        window.clearInterval(pollId);
      }
      const api = window.turnstile;
      if (api && widgetId.current !== null) {
        api.remove(widgetId.current);
      }
      widgetId.current = null;
      setToken("");
    };
  }, [turnstileMounted]);

  const submit = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    // Guard the keyboard path (Cmd/Ctrl+Enter bypasses the disabled button): a
    // send already in flight is left alone, and a null Turnstile token is never
    // posted — Send is disabled until it lands, but the shortcut isn't. Either
    // would otherwise slip a duplicate or a 403 through.
    if (status === "sending") {
      return;
    }
    if (TURNSTILE_SITE_KEY && token === "") {
      return;
    }
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
          honeypot: data.get("contact_extra"),
          token,
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

  // Hold Send until Turnstile has cleared the visitor. Only when a site key is
  // configured (otherwise there is no widget to wait on).
  const verifying = Boolean(TURNSTILE_SITE_KEY) && token === "";

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
            <span className={styles.label}>
              {open && status === "sent" ? cta.confirmationTitle : cta.button}
            </span>
          </summary>

          <div className={styles.panel}>
            {status === "sent" ? (
              <p className={styles.confirmation} role="status">
                {cta.confirmation}
              </p>
            ) : (
              <form
                className={styles.form}
                onSubmit={handleSubmit}
                ref={formRef}
              >
                {/* Honeypot: visually hidden and off the tab order, and made
                    un-autofillable — no label, a neutral name, and the major
                    password managers' opt-out attributes — so a real visitor's
                    browser never fills it. A bot that does gets a friendly 200
                    and nothing sent. */}
                <div aria-hidden="true" className={styles.honeypot}>
                  <input
                    autoComplete="off"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    data-lpignore="true"
                    name="contact_extra"
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
                    <Script
                      src={TURNSTILE_SCRIPT}
                      strategy="afterInteractive"
                    />
                    <div ref={turnstileRef} />
                  </>
                ) : null}

                <button
                  aria-busy={status === "sending"}
                  className={`${styles.send} ${styles.reveal}`}
                  disabled={status === "sending" || verifying}
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
