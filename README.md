<p align="center">
  <!-- Logo slot: add assets/logo.png, assets/logo.svg, or light/dark logo variants here. -->
</p>

<h1 align="center">guidotto.dev</h1>

<p align="center">
  <strong>Public portfolio for a backend-focused engineer building toward AI-native product and systems work.</strong><br>
  <sub>Next.js 16 &middot; Tailwind CSS 4 &middot; Bun &middot; Notion-backed source material</sub>
</p>

<p align="center">
  <a href="https://github.com/giacomoguidotto/guidotto-dev/actions"><img src="https://github.com/giacomoguidotto/guidotto-dev/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/giacomoguidotto/guidotto-dev/blob/main/LICENSE"><img src="https://img.shields.io/github/license/giacomoguidotto/guidotto-dev" alt="License"></a>
</p>

<br>

guidotto.dev is the public website for Giacomo Guidotto. It is being shaped from public-safe profile and project facts, while Notion remains the canonical source of truth.

This repo owns the Next.js implementation, local validation, and reviewable exported source material. It should not become a duplicate knowledge base.

## What Is Here

- `src/app/`: the public website surface.
- `public/`: static assets used by the site.
- `.github/`: contribution, issue, pull request, security, ownership, and CI files.
- `docs/agents/`: repo-local navigation for agent workflows.

## Source Material

Notion owns the canonical profile, portfolio, project, task, and personal context. When profile, project, or positioning facts might have changed, use a narrow live Notion lookup before changing public content.

Do not commit raw personal information dumps or broad Notion exports to this repo.

## Local Development

Install dependencies:

```sh
bun install
```

Start the development server:

```sh
bun run dev
```

Run the canonical local validation command:

```sh
bun run ci
```

CI mirrors this command.

## Tooling

| Tool | Purpose |
| --- | --- |
| [Bun](https://bun.sh) | Runtime and package manager |
| [mise](https://mise.jdx.dev) | Optional local tool provisioning |
| [Next.js](https://nextjs.org) | App Router site framework |
| [Tailwind CSS](https://tailwindcss.com) | Styling |
| [Biome](https://biomejs.dev) / [Ultracite](https://www.ultracite.ai) | Linting and formatting |

## Contributing

Free and open source under the [MIT License](LICENSE). See [CONTRIBUTING.md](.github/CONTRIBUTING.md) to get involved.

Agents should start at [AGENTS.md](AGENTS.md).
