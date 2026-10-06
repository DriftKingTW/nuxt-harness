# AGENTS.md

`@driftkingtw/nuxt-harness`: guardrails shared by the owner's Nuxt apps, plus a Claude Code plugin.
The README lists what is here and what deliberately is not.

## Commands

| Command | What it does |
|---|---|
| `yarn check` | **Run before saying you're done.** Lint + typecheck + tests + build. |
| `claude plugin validate .` | After editing `.claude-plugin/` or `plugin/`. The "No version specified" warning is intended: plugin users follow main. |

Yarn 4, pinned in `.yarn/releases`. TypeScript 5.9 (the apps pin it too).

## Where things are

```
src/            one file per package entry (eslint, playwright, vitest, nuxt) + adrs.ts, cli.ts
test/           Vitest tests for src/
plugin/         the Claude Code plugin: hooks/ (lint on edit, e2e gate, workflow modes, worktree
                guard) and
                skills/harness/ (SKILL.md, AGENTS.template.md)
.claude-plugin/ the marketplace that lists plugin/
```

## Rules

- Only guardrails two or more apps use. One-app ones stay in the app and are listed in the README
  under "Not here (yet)". Add options only for differences between apps that exist today.
- Every failure message says what to do instead and why: coding agents act on it.
- ESLint rules are custom rules under the `nuxt-harness` plugin, never shared
  `no-restricted-syntax` / `no-restricted-imports` settings (flat config replaces a rule's options
  as a whole, so an app's own settings would drop ours).
- Consumers load `dist/` without compiling it (Node, Playwright and Vitest skip `node_modules`), so
  `src/` uses `.js` import specifiers and builds with `tsc`.
- This repo is public: no personal data, real exports, or paths from anyone's machine.
- Changing the API: update the README, the skill (`plugin/skills/harness/SKILL.md`), and bump
  `version`. Pushing to main and pushing tags need the owner's OK; PRs with green CI may be
  merged without asking (`fast-dev` in `.claude/settings.json`).

## Commits

Format: `type(scope): subject`. Allowed scopes; omit the scope when a change spans several:

| scope | area |
|---|---|
| `eslint` | `src/eslint.ts` rules and config |
| `playwright` | `src/playwright.ts` fixtures and helpers |
| `vitest` | `src/vitest.ts` structural checks |
| `nuxt` | `src/nuxt.ts` module |
| `adrs` | `src/adrs.ts` and the CLI |
| `plugin` | `plugin/` hooks and skill, `.claude-plugin/` |
