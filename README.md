# nuxt-harness

Shared guardrails for Nuxt apps built largely by coding agents: lint rules, e2e fixtures and
structural checks whose failure messages say how to fix the problem. It holds what two or more apps
already use; each app keeps its own rules next to these.

A personal toolkit, shared in case it is useful. No support is offered.

## What's in it

| Import | What |
|---|---|
| `@driftkingtw/nuxt-harness/eslint` | `harness({ bareStrings })`: flat config items. `vue/no-bare-strings-in-template` in `app/**/*.vue` with a shared allowlist; `nuxt-harness/no-browser-dialogs` in `app/**/*.{ts,vue}` (no `alert`/`confirm`/`prompt`); and two rules for `e2e/**/*.spec.ts`: `nuxt-harness/goto-hydrated` (no `page.goto`) and `nuxt-harness/test-from-fixtures` (no `test`/`expect` from `@playwright/test`) |
| `@driftkingtw/nuxt-harness/playwright` | `test` (fails on console errors, warnings and page errors; option `consoleIgnore`: one RegExp or a list, but one RegExp in `test.use`, where Playwright reads a two-item array as `[value, options]`), `expect`, `gotoHydrated(page, path)`, `e2ePort()` |
| `@driftkingtw/nuxt-harness/vitest` | `localeKeyParity()`, `missingLocaleKeys(keys)`, `rawPaletteColours({ files, allowFiles, allowClasses })`, UI motion and shape: `rawMotionValues({ files, allowClasses })` (durations, delays and curves from tokens), `rawRadiusValues({ files, allowClasses })` (corners from radius tokens; `calc(var(--radius-…)…)` passes), `transitionNames({ files, css })` (every `<Transition name>` has its classes in `main.css`), `reducedMotionReset({ css })`; `agentsMap({ maxLines })` (AGENTS.md stays a short map with a commit scope table), `ciBudget({ dir })` (workflows spend Actions minutes only on new information; see [CI budget](#ci-budget)), and `expectClean(findings)` |
| `@driftkingtw/nuxt-harness/nuxt` | Nuxt module: sets `<html data-hydrated="true">` once Nuxt has hydrated, which `gotoHydrated` waits for |
| `nuxt-harness check-adrs` | Validates `docs/decisions` (MADR-lite ADRs indexed in `README.md`) and that every dependency in `package.json` is named in one |
| `nuxt-harness e2e` | Runs the app's `e2e` script for the pushed, clean HEAD (one run at a time per repository, since worktrees share a local database) and sets the commit status `e2e (local)` to the result. Takes no arguments: a filtered run must not mark a commit as passed |
| `nuxt-harness require-local-e2e --sha <commit>` | For CI: fails unless the commit has a passing `e2e (local)` status, and says how to get one |
| Claude Code plugin `nuxt-harness` | Hooks: ESLint `--fix` on each edited file; `gh pr create` only as a draft; no `gh pr ready` until the PR head has a passing `e2e (local)` status (docs-only PRs excepted; apps on a package without `nuxt-harness e2e` get the older check against the last local `yarn e2e`); no commit statuses written by hand; edits to tracked files in the main checkout in worktree mode; workflow modes (below). The `harness` skill: adopt, upgrade, add a guardrail, with an `AGENTS.md` template |

## Install

From a release tag (Yarn builds the package on install). Yarn 4 fetches git dependencies only from
approved repositories, so approve this one first:

```yaml
# .yarnrc.yml
approvedGitRepositories:
  - "https://github.com/DriftKingTW/nuxt-harness.git"
```

```sh
yarn add -D @driftkingtw/nuxt-harness@github:DriftKingTW/nuxt-harness#v0.4.0
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
import { agentsMap, ciBudget, expectClean, localeKeyParity, rawMotionValues, rawPaletteColours, rawRadiusValues, reducedMotionReset, transitionNames } from '@driftkingtw/nuxt-harness/vitest'

it('locale files have the same keys', () => expectClean(localeKeyParity()))
it('app/ uses colour roles', () => expectClean(rawPaletteColours({ allowFiles: ['app/utils/chips.ts'] })))
it('motion comes from tokens', () => expectClean(rawMotionValues()))
it('corners come from radius tokens', () => expectClean(rawRadiusValues()))
it('every <Transition> name is defined', () => expectClean(transitionNames()))
it('reduced motion turns motion off', () => expectClean(reducedMotionReset()))
it('AGENTS.md is a short map with commit scopes', () => expectClean(agentsMap()))
it('CI spends minutes only on new information', () => expectClean(ciBudget()))
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
- `fast-dev`: once `yarn check` and `yarn nuxt-harness e2e` pass, mark the draft PR ready, merge it when CI is green, and deploy, without asking first. Without it, PRs stay drafts until the owner marks them ready.
- `worktree`: the main checkout stays on main for deploys, and every change happens in a linked
  worktree. The plugin blocks edits to files git tracks in the main checkout; pair it with a Bash
  guard that blocks commits and branch switches there.

The plugin tells Claude about them at session start, and after each `gh pr create` has it remind the
owner which modes are on, since they change the pace of work.

## CI budget

Private repositories spend the account's monthly GitHub Actions minutes, so CI runs only what tells
something new:

- **Drafts**: pull requests open as drafts (the plugin insists) and CI skips them, so pushes while
  the work still changes cost nothing. `gh pr ready` starts CI.
- **No repeat on main**: a pull request's checkout is already the merge with main.
- **e2e runs locally**: `yarn nuxt-harness e2e` on the pushed branch sets the commit status
  `e2e (local)`, and CI checks it instead of running the suite. To run e2e in CI anyway (no local
  run possible), add the label `ci:e2e` while the PR is a draft, or start the workflow by hand with
  `e2e: true`.
- Skipping steps by changed paths (docs-only and so on) is up to each app.

`ciBudget()` checks the workflow side. A minimal CI:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
  workflow_dispatch:
    inputs:
      e2e: { type: boolean, default: false, description: Run e2e in CI }

permissions:
  contents: read
  statuses: read # require-local-e2e reads the commit status

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    if: ${{ !github.event.pull_request.draft }}
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env:
      CI_E2E: ${{ inputs.e2e || contains(github.event.pull_request.labels.*.name, 'ci:e2e') }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: yarn }
      - run: yarn install --immutable
      - if: env.CI_E2E != 'true' && github.event_name == 'pull_request'
        run: yarn nuxt-harness require-local-e2e --sha ${{ github.event.pull_request.head.sha }}
        env:
          GH_TOKEN: ${{ github.token }}
      - run: yarn check
      - if: env.CI_E2E == 'true'
        run: yarn e2e
```

The flow for an agent: open a draft, push, `yarn check`, `yarn nuxt-harness e2e`, then
`gh pr ready` (fast-dev) or tell the owner. A push after `gh pr ready` runs CI again, and
`require-local-e2e` fails until `yarn nuxt-harness e2e` has run for the new head; re-run the job
then. While still changing things, `gh pr ready --undo` turns the PR back into a draft.

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
