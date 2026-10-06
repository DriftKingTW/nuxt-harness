---
name: harness
description: Adopt, upgrade or extend @driftkingtw/nuxt-harness in a Nuxt app (shared ESLint rules, Playwright fixtures, Vitest structural checks, the Nuxt hydration module, the ADR check). Use when setting up a new Nuxt project, replacing an app's copied harness files with the package, bumping its version, or turning a mistake into a lint rule or structural test and deciding whether it belongs in the package or the app.
---

# nuxt-harness

`@driftkingtw/nuxt-harness` (repo `DriftKingTW/nuxt-harness`) holds the guardrails that two or more
of the owner's Nuxt apps use. This plugin adds hooks (lint on edit; no `gh pr create` with UI
changes newer than the last passing `yarn e2e`; workflow-mode reminders) and this guide. The plugin
follows the repo's main branch, while an app pins a release tag: for the API, read the installed
version's `node_modules/@driftkingtw/nuxt-harness/README.md`, not memory. Also ask, when a mistake
or idea comes up in any app: should this become a shared guardrail? (See "Add a guardrail".)

## Adopt it in an app

1. Approve the repo in `.yarnrc.yml` (Yarn 4 blocks git dependencies by default):
   `approvedGitRepositories: ["https://github.com/DriftKingTW/nuxt-harness.git"]`. Find the latest
   tag (`git ls-remote --tags https://github.com/DriftKingTW/nuxt-harness`) and install it:
   `yarn add -D @driftkingtw/nuxt-harness@github:DriftKingTW/nuxt-harness#<tag>`. Yarn builds it on
   install (prepack), so the first install takes a few seconds longer.
2. Name `@driftkingtw/nuxt-harness` in an ADR (the ADR check requires every dependency to be).
   No `AGENTS.md` yet? Start from `${CLAUDE_PLUGIN_ROOT}/skills/harness/AGENTS.template.md` and
   fill in the placeholders; its "## Commits" scope table is what the owner's commit-msg hook and
   `agentsMap()` read.
3. Wire each part, deleting the app's own copy of it:
   - `nuxt.config.ts`: add `'@driftkingtw/nuxt-harness/nuxt'` to `modules`; remove the
     `dataset.hydrated` line from `app/app.vue`.
   - `eslint.config.mjs`: spread `...harness({ bareStrings: [/* app-only symbols */] })` (from
     `@driftkingtw/nuxt-harness/eslint`) into `withNuxt(...)`; remove the app's
     `vue/no-bare-strings-in-template` and `page.goto` rules.
   - `e2e/fixtures.ts`: `export { expect, gotoHydrated, test } from '@driftkingtw/nuxt-harness/playwright'`,
     next to the app's own helpers. Specs import `test` and `expect` from `./fixtures`.
   - `playwright.config.ts`: `const port = e2ePort()`, and `defineConfig<HarnessTestOptions>(...)`
     when it sets `consoleIgnore`.
   - Vitest (e.g. `test/structure.test.ts`): `expectClean(agentsMap())`, `expectClean(localeKeyParity())`,
     `expectClean(missingLocaleKeys(codes.map(c => \`errors.${c}\`)))`, and
     `expectClean(rawPaletteColours({ ... }))` once the app's components use colour roles from
     `main.css` (leave it out until then); `expectClean(rawMotionValues())`,
     `expectClean(rawRadiusValues())`, `expectClean(transitionNames())` and
     `expectClean(reducedMotionReset())` once `main.css` defines motion tokens, radius tokens and
     its `<Transition>` classes (existing literals go in `allowClasses` with a reason, or get fixed).
   - `scripts/check.sh`: `yarn nuxt-harness check-adrs` replaces `scripts/check-adrs.ts` and its test.
   - Claude Code: `claude plugin marketplace add DriftKingTW/nuxt-harness --scope project`, then
     `claude plugin install nuxt-harness@nuxt-harness --scope project`; commit the
     `.claude/settings.json` they write, and delete `.claude/hooks/lint-edited-file.sh` and its hook entry.
4. Ask the owner which workflow modes to turn on, and put the answer in the `env` of
   `.claude/settings.json` (tracked, so every worktree has it), e.g. `"HARNESS_MODES": "preview"`:
   - `preview`: UI changes go on a preview with a copy of the real data, and wait for their OK,
     before the PR. Safer, slower.
   - `fast-dev`: PRs whose CI is green are merged and deployed without asking. Faster, riskier.
   - `worktree`: the main checkout stays on main for deploys; every change happens in a linked
     worktree (below). Edits, commits and branch switches in the main checkout are blocked.
   The plugin reminds them after every `gh pr create` which modes are on, so they can turn one off.
5. Run `yarn check` and `yarn e2e`. The shared `test` fails on console errors and warnings, so
   adopting it may surface real ones: fix them. `consoleIgnore` is only for lines a test provokes on
   purpose (say why in a comment).

## Work in a worktree (worktree mode)

1. From the main checkout: `orca worktree create --repo path:<main checkout> --name <task> --no-parent --setup skip --json`
   (or `git worktree add ../<repo>-<task> -b <type>/<short-description> origin/main` outside Orca).
   Orca names the branch `<user>/<task>`: rename it with `git -C <worktree> branch -m <type>/<short-description>`.
2. `yarn install` in the worktree (quick with Yarn's cache). Git-ignored files such as `.env` are not
   copied; settings that every checkout needs belong in tracked files.
3. Work there. The session's project folder may still be the main checkout: use absolute paths and
   `cd <worktree> && …` or `git -C <worktree> …`; the hooks follow the checkout a file or command is in.
4. Once the PR is merged, remove it: `orca worktree rm --worktree path:<worktree> --force --json`
   (or `git worktree remove <worktree>`).

If the main checkout was left on another branch, `git switch main` there is allowed.

## Upgrade an app

Read the changes between the app's tag and the new one (`gh api repos/DriftKingTW/nuxt-harness/compare/<old>...<new>`
or the README), change the tag in `package.json`, `yarn install`, then `yarn check` and `yarn e2e`.

## Add a guardrail

When a mistake could have been caught by tooling, add a rule instead of only fixing the instance:

1. Can existing tooling catch it (a type, an existing rule's options)? Do that.
2. Is it about this app (its folders, domain, helpers)? It goes in the app's `eslint.config.mjs` or
   `test/structure.test.ts`.
3. Does another app have the same rule, or the same problem? Then move it into the package. A
   guardrail one app uses stays in that app; the package README lists those under "Not here (yet)".
4. Not about Nuxt apps at all (git hooks, the Bash guard, how the owner wants Claude to work)? That
   belongs in the owner's global setup (`~/.claude`, `~/.config/git/hooks`), not this package.

Not doing it now? Open an issue on `DriftKingTW/nuxt-harness` with the app and the mistake that
prompted it, so the idea isn't lost.

In the package:

- The message says what to do instead and why, in a sentence: agents act on lint output.
- ESLint: add a rule to the `nuxt-harness` plugin in `src/eslint.ts`. Don't share
  `no-restricted-syntax` or `no-restricted-imports` settings: flat config replaces a rule's options
  as a whole, so an app's own settings for the same files would silently drop the shared ones.
- Structural checks return `Findings`, and throw when they found nothing to look at, so a broken
  glob fails instead of passing.
- Add options only for differences that exist between apps today.
- Test it in `test/`, run `yarn check`.

## Release

Bump `version` in `package.json`, commit, then tag `v<version>`. Pushing to main and pushing tags
need the owner's OK. Then upgrade each app. The plugin has no version, so plugin users get main
with `/plugin marketplace update nuxt-harness`.
