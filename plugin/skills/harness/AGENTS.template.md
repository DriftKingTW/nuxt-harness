# AGENTS.md

<One line: what the app is, and who it is for.> This file is a **map**. Details live in the linked docs.

## Commands

| Command | What it does |
|---|---|
| `yarn check` | **Run before saying you're done.** Lint + typecheck + tests + ADR checks. Must pass. |
| `yarn e2e` | Playwright against a throwaway database. Run after UI changes; a PR with UI changes needs a passing run. |
| `yarn dev` | Dev server. |
| `yarn lint:fix` | Auto-fix formatting (ESLint stylistic, no Prettier). |

CI (`.github/workflows/ci.yml`) runs `yarn check` + `yarn e2e` on every PR, plus gitleaks. Work reaches `main` through PRs.

Package manager is **Yarn 4** (pinned in `.yarn/releases`). Don't use npm or pnpm.

## Where things are

```
app/                    Nuxt frontend (Vue + Tailwind, no component library)
i18n/locales/           Every UI string, in every language
<more folders>
test/                   Structural tests + helpers
e2e/                    Playwright specs; import test, expect, gotoHydrated from fixtures.ts
docs/                   Knowledge base (below)
```

## Read before changing…

- **<An area>**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **What to build next**: [docs/roadmap.md](docs/roadmap.md)
- **A multi-step feature**: check [docs/exec-plans/active/](docs/exec-plans/active/) for a plan; create one for work spanning more than one session
- **Why something is the way it is**: [docs/decisions/](docs/decisions/README.md) (ADRs). Adding a dependency, changing data semantics, or changing a cross-cutting pattern requires a new ADR; `yarn check` fails if a dependency is not named in any ADR
- **A lint rule or structural test**: shared ones come from `@driftkingtw/nuxt-harness`; its `nuxt-harness:harness` skill says where a new one goes

## Commits

Format: `type(scope): subject`. Allowed scopes; omit the scope when a change spans several:

| scope | area |
|---|---|
| `app` | frontend pages, components, composables |
| `i18n` | locale files |
| `e2e` | Playwright specs and fixtures |
| `harness` | lint rules, check scripts, CI, `.claude/` settings |
| `docs` | docs (usually just use the `docs:` type) |

## Language

- Code, comments, commit messages, PR titles/descriptions and docs are in **English**.
- User-facing copy lives only in `i18n/locales/`, used via `t()` / `$t()`; add keys to **every** locale file. Enforced by `vue/no-bare-strings-in-template` and the locale key check; language-neutral symbols go in `harness({ bareStrings })` in `eslint.config.mjs`.

## Rules that are not (yet) enforced by tooling

- <Rules the app has that no lint rule or test checks yet.>
- When you hit a mistake that tooling could have caught, add a lint rule or structural test (with a remediation message) instead of only fixing the instance.
- Keep this file under ~100 lines; put detail in docs/.
