# nuxt-harness

Shared guardrails for Nuxt apps built largely by coding agents: lint rules, e2e fixtures and
structural checks whose failure messages say how to fix the problem. It holds what two or more apps
already use; each app keeps its own rules next to these.

A personal toolkit, shared in case it is useful. No support is offered.

## What's in it

| Import | What |
|---|---|
| `@driftkingtw/nuxt-harness/eslint` | `harness({ bareStrings })`: flat config items. `vue/no-bare-strings-in-template` in `app/**/*.vue` with a shared allowlist, and two rules for `e2e/**/*.spec.ts`: `nuxt-harness/goto-hydrated` (no `page.goto`) and `nuxt-harness/test-from-fixtures` (no `test`/`expect` from `@playwright/test`) |
| `@driftkingtw/nuxt-harness/playwright` | `test` (fails on console errors, warnings and page errors; option `consoleIgnore`: one RegExp or a list, but one RegExp in `test.use`, where Playwright reads a two-item array as `[value, options]`), `expect`, `gotoHydrated(page, path)`, `e2ePort()` |
| `@driftkingtw/nuxt-harness/vitest` | `localeKeyParity()`, `missingLocaleKeys(keys)`, `rawPaletteColours({ files, allowFiles, allowClasses })`, UI motion and shape: `rawMotionValues({ files, allowClasses })` (durations, delays and curves from tokens), `rawRadiusValues({ files, allowClasses })` (corners from radius tokens; `calc(var(--radius-…)…)` passes), `transitionNames({ files, css })` (every `<Transition name>` has its classes in `main.css`), `reducedMotionReset({ css })`; `agentsMap({ maxLines })` (AGENTS.md stays a short map with a commit scope table), and `expectClean(findings)` |
| `@driftkingtw/nuxt-harness/nuxt` | Nuxt module: sets `<html data-hydrated="true">` once Nuxt has hydrated, which `gotoHydrated` waits for |
| `nuxt-harness check-adrs` | Validates `docs/decisions` (MADR-lite ADRs indexed in `README.md`) and that every dependency in `package.json` is named in one |
| Claude Code plugin `nuxt-harness` | Hooks: ESLint `--fix` on each edited file; no `gh pr create` with UI changes (`app/`, `e2e/`, `i18n/`) newer than the last passing `yarn e2e`; edits to tracked files in the main checkout in worktree mode; workflow modes (below). The `harness` skill: adopt, upgrade, add a guardrail, with an `AGENTS.md` template |

## Install

From a release tag (Yarn builds the package on install). Yarn 4 fetches git dependencies only from
approved repositories, so approve this one first:

```yaml
# .yarnrc.yml
approvedGitRepositories:
  - "https://github.com/DriftKingTW/nuxt-harness.git"
```

```sh
yarn add -D @driftkingtw/nuxt-harness@github:DriftKingTW/nuxt-harness#v0.2.0
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@driftkingtw/nuxt-harness/nuxt'],
})
```

```js
// eslint.config.mjs
import { harness } from '@driftkingtw/nuxt-harness/eslint'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  ...harness({ bareStrings: ['Esc'] }),
  // the app's own rules
)
```

```ts
// e2e/fixtures.ts: specs import from here
export { expect, gotoHydrated, test } from '@driftkingtw/nuxt-harness/playwright'

// playwright.config.ts
import { defineConfig } from '@playwright/test'
import { e2ePort, type HarnessTestOptions } from '@driftkingtw/nuxt-harness/playwright'

const port = e2ePort()
export default defineConfig<HarnessTestOptions>({
  use: { baseURL: `http://localhost:${port}` },
})
```

```ts
// test/structure.test.ts
import { agentsMap, expectClean, localeKeyParity, rawMotionValues, rawPaletteColours, rawRadiusValues, reducedMotionReset, transitionNames } from '@driftkingtw/nuxt-harness/vitest'

it('locale files have the same keys', () => expectClean(localeKeyParity()))
it('app/ uses colour roles', () => expectClean(rawPaletteColours({ allowFiles: ['app/utils/chips.ts'] })))
it('motion comes from tokens', () => expectClean(rawMotionValues()))
it('corners come from radius tokens', () => expectClean(rawRadiusValues()))
it('every <Transition> name is defined', () => expectClean(transitionNames()))
it('reduced motion turns motion off', () => expectClean(reducedMotionReset()))
it('AGENTS.md is a short map with commit scopes', () => expectClean(agentsMap()))
```

```sh
# scripts/check.sh
yarn nuxt-harness check-adrs
```

Claude Code plugin, registered for everyone who works in the app:

```sh
claude plugin marketplace add DriftKingTW/nuxt-harness --scope project
claude plugin install nuxt-harness@nuxt-harness --scope project
```

## Workflow modes

A repo can turn on modes in the `env` of its `.claude/settings.json`, so every checkout and
worktree has them:

```json
{ "env": { "HARNESS_MODES": "preview,fast-dev,worktree" } }
```

- `preview`: show UI changes on a preview with a copy of the real data, and wait for the owner's OK, before opening the PR.
- `fast-dev`: merge PRs whose CI is green, and deploy, without asking first.
- `worktree`: the main checkout stays on main for deploys, and every change happens in a linked
  worktree. The plugin blocks edits to files git tracks in the main checkout; pair it with a Bash
  guard that blocks commits and branch switches there.

The plugin tells Claude about them at session start, and after each `gh pr create` has it remind the
owner which modes are on, since they change the pace of work.

## Not here (yet)

Guardrails one app uses stay in that app until a second one needs them. So far:

- e2e helpers: a generated PNG for upload tests, dropping files on the page, slowing the CPU down
- no user-facing literals in `<script>` (`label`, `title`, …); every `t('key')` the app uses exists
- native controls styled in `main.css`
- typecheck coverage of top-level folders, no machine-specific paths in source files

## Develop

`yarn check` runs lint, typecheck, tests and the build. To release: bump `version` in
`package.json`, commit, tag `v<version>`, push the tag, then upgrade each app.

## License

MIT
