"use client";

// CopyEmail — the quiet fast path beside the loud door: the contact address,
// surfaced as click/tap-to-copy (Clipboard API) for someone who'd rather paste
// it into their own client than open the form. It obeys the earned-feedback
// law: a brief, quiet "copied" settle plus the snap-haptic channel where the
// platform supports it (Android buzzes; iOS Safari has no Web Vibration API and
// silently no-ops), and both the haptic and the visual settle are off under
// reduced motion.
//
// It is a real <button>, so Enter/Space trigger the copy for free and the
// control is in the tab order. The address itself stays selectable text, so
// anyone who prefers to drag-select and copy by hand still can — and if the
// Clipboard API is unavailable or denied (an insecure context, a hardened
// browser), the click falls back to selecting the address rather than leaving
// the visitor with nothing.

import { useCallback, useEffect, useRef, useState } from "react";
import { content } from "~/content";
import styles from "./copy-email.module.css";

const { cta } = content;

// How long the "copied" confirmation lingers before the control settles back.
const FEEDBACK_MS = 1800;

export function CopyEmail() {
  const addressRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);

  // Drop a pending settle timer if the component unmounts mid-confirmation.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  // The earned feedback: flip to the "copied" settle, fire the snap haptic where
  // supported, and schedule the quiet return. Reduced motion silences the buzz
  // (the law); the visual swap stays so the confirmation is never lost.
  const confirm = useCallback(() => {
    setCopied(true);
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!reduce && typeof navigator.vibrate === "function") {
      navigator.vibrate(8);
    }
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCopied(false), FEEDBACK_MS);
  }, []);

  // Last resort when the clipboard is unreachable: select the address so the
  // visitor can copy it by hand. We do not claim "copied" in this path.
  const selectAddress = useCallback(() => {
    const node = addressRef.current;
    const selection = window.getSelection();
    if (!(node && selection)) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const copyAddress = useCallback(async () => {
    if (!navigator.clipboard?.writeText) {
      selectAddress();
      return;
    }
    try {
      await navigator.clipboard.writeText(cta.email);
      confirm();
    } catch {
      selectAddress();
    }
  }, [confirm, selectAddress]);

  const handleClick = useCallback(() => {
    copyAddress().catch(() => {
      // copyAddress never rejects (the failure path falls back internally);
      // this guard only stops an unhandled-rejection lint from the floating
      // promise.
    });
  }, [copyAddress]);

  return (
    <div className={styles.wrap}>
      <button
        aria-label={`Copy email address ${cta.email}`}
        className={copied ? `${styles.copy} ${styles.copied}` : styles.copy}
        onClick={handleClick}
        type="button"
      >
        <span aria-hidden="true" className={styles.icon}>
          {copied ? <CheckMark /> : <CopyMark />}
        </span>
        <span className={styles.address} ref={addressRef}>
          {cta.email}
        </span>
      </button>
      {/* Politely announce the confirmation to assistive tech without stealing
          focus; empty until a copy lands, so it only ever speaks the result. */}
      <span aria-live="polite" className={styles.status} role="status">
        {copied ? cta.emailCopied : ""}
      </span>
    </div>
  );
}

const ICON_BOX = "0 0 24 24";
const ICON_SIZE = 15;

function CopyMark() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={ICON_SIZE}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox={ICON_BOX}
      width={ICON_SIZE}
    >
      <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={ICON_SIZE}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox={ICON_BOX}
      width={ICON_SIZE}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
