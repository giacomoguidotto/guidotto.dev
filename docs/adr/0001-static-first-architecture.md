# Static-first site (MDX + SSG); no Convex/Clerk; deferred newsletter

guidotto.dev is a portfolio whose top goals include incredible SEO, extreme
performance, and engineering-judgment-as-signal. We chose a **static-first**
architecture — MDX blog posts statically generated so post *bodies* live in the
server-rendered HTML and are fully indexable, a single serverless Route Handler +
Resend for the contact path, and **no Convex/Clerk backend** — deliberately
diverging from the workspace default (Convex). Convex's realtime/reactive
strengths buy a portfolio nothing while costing SSG, SEO, simplicity, and a free
static deploy; matching the tool to the job is itself part of the senior signal.

The 3D centerpiece (`@react-three/fiber`) and any interactive demos are loaded
lazily so they never enter the initial HTML or critical JS budget.

## Newsletter (deferred)

Built only when the first post ships. Double opt-in, Resend + React Email
templates (lifted from the Ginevra Renier patterns, which are Clerk-free), backed
by a lightweight **Drizzle + Turso** store rather than standing up Convex for one
`subscribers` table.

**Publish ≠ Announce.** *Publish* is the post going live via `git push`/deploy
(indexed immediately). *Announce* is the email blast, a separate deliberate act.

Mechanism: a **scheduled GitHub Action** (cron at a high-engagement slot, plus
`workflow_dispatch` for manual sends) runs `newsletter:announce`. The command
blasts only posts that are `announce: true` in frontmatter *and* have no `sentAt`
record in Turso, then writes `sentAt`. This decouples publish timing (whenever the
author pushes) from announce timing (optimal scheduled slot); the per-post
`announce` flag lets a post go live for SEO without ever emailing unless explicitly
blessed; and the `sentAt` guard makes blasts idempotent so redeploys/rollbacks/
hotfixes can never re-email subscribers.
