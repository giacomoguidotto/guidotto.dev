# guidotto.dev

Personal portfolio site for Giacomo Guidotto, built with Next.js and public-safe source material from Notion.

## Workflow

- Package manager: Bun (`bun install`, not npm).
- Optional tool provisioning: `mise install`.
- Dev server: `bun run dev`.
- Lint: `bun run lint` (Ultracite/Biome, not ESLint/Prettier).
- Typecheck: `bun run typecheck`.
- Build: `bun run build`.
- Canonical validation: `bun run ci`.

## Content Boundaries

- Notion remains canonical for profile, portfolio, project, task, and personal knowledge.
- Do not commit raw personal information dumps or broad Notion exports.
- Do not publish private profile fields or unsupported claims.
- Do not invent headlines, summaries, taglines, project blurbs, or positioning.
- If a public fact may be stale or missing, do a narrow Notion lookup before changing site content.

## Structure

- `src/app/` contains the public site.
- `public/` contains static assets.
- `docs/agents/` contains repo-local navigation for issue tracking, triage labels, and domain docs.

## Agent Skills

### Issue Tracker

Issues are tracked in GitHub Issues on this repo. See `docs/agents/issue-tracker.md`.

### Triage Labels

Use the default five-label vocabulary. See `docs/agents/triage-labels.md`.

### Domain Docs

Single-context layout. Use narrow Notion lookups for public-safe content source material and create `CONTEXT.md` or ADRs lazily only when project language or hard-to-reverse decisions need them. See `docs/agents/domain.md`.
