// Structural checks for an app's Vitest suite. Each returns what it found and how to fix it;
// expectClean() turns that into a failing assertion. Paths are relative to the working directory
// (the app's root when Vitest runs there).
import { existsSync, globSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import { parse } from 'yaml'

/** What a check found, and how to fix it. */
export interface Findings {
  offenders: string[]
  fix: string
}

/** Fails the current test, with the fix as the message, when a check found offenders. */
export function expectClean({ offenders, fix }: Findings) {
  expect(offenders, fix).toEqual([])
}

type Messages = { [key: string]: unknown }

function loadLocales(dir: string) {
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  if (files.length === 0) throw new Error(`No locale files (*.json) in ${dir}.`)
  return files.map(file => [file, new Set(keysOf(JSON.parse(readFileSync(join(dir, file), 'utf8'))))] as const)
}

function keysOf(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) => value && typeof value === 'object'
    ? keysOf(value as Messages, `${prefix}${key}.`)
    : [`${prefix}${key}`])
}

/** Every locale file in `dir` has the same message keys. */
export function localeKeyParity({ dir = 'i18n/locales' } = {}): Findings {
  const locales = loadLocales(dir)
  const all = new Set(locales.flatMap(([, keys]) => [...keys]))
  return {
    offenders: locales.flatMap(([file, keys]) => [...all].filter(key => !keys.has(key)).map(key => `${file}: ${key}`)),
    fix: `Add these keys to the locale files in ${dir}: every user-facing string exists in every language.`,
  }
}

/** Each of `keys`, such as errors.<code> for every error code, is a message in every locale file in `dir`. */
export function missingLocaleKeys(keys: string[], { dir = 'i18n/locales' } = {}): Findings {
  if (keys.length === 0) throw new Error('missingLocaleKeys got no keys: did the code that collects them break?')
  return {
    offenders: loadLocales(dir).flatMap(([file, present]) => keys.filter(key => !present.has(key)).map(key => `${file}: ${key}`)),
    fix: `Add these keys to the locale files in ${dir}. Without them the UI shows the raw key, or the server's English text.`,
  }
}

const PALETTE = 'white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const RAW_COLOUR = new RegExp(`(?<![\\w-])(?:[a-z0-9-]+:)*((?:bg|text|border|ring|divide|outline|from|via|to|fill|stroke|decoration|shadow)-(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?)(?![\\w/-])`, 'g')

export interface RawPaletteOptions {
  /** Files to scan (a glob). */
  files?: string
  /** Files that may use palette colours, such as a fixed chip palette. */
  allowFiles?: string[]
  /** Classes allowed anywhere, such as text-white on a photo overlay. */
  allowClasses?: string[]
}

/**
 * Components use colour roles (bg-surface, text-ink-muted, …), not Tailwind palette colours, so
 * dark mode and a restyle change the roles rather than every component.
 */
export function rawPaletteColours({ files = 'app/**/*.{vue,ts}', allowFiles = [], allowClasses = [] }: RawPaletteOptions = {}): Findings {
  const paths = globSync(files)
  if (paths.length === 0) throw new Error(`No files match ${files}.`)
  const offenders = new Set<string>()
  for (const file of paths) {
    if (allowFiles.includes(file)) continue
    for (const [, cls] of readFileSync(file, 'utf8').matchAll(RAW_COLOUR)) {
      if (!allowClasses.includes(cls!)) offenders.add(`${file}: ${cls}`)
    }
  }
  return {
    offenders: [...offenders],
    fix: 'Use a colour role from app/assets/css/main.css (or add a role there) instead of a Tailwind palette colour, so dark mode and a restyle change the roles, not every component.',
  }
}

export interface UiFilesOptions {
  /** Files to scan (a glob). */
  files?: string
  /** Classes allowed anywhere, each with a reason in the app's test. */
  allowClasses?: string[]
}

function scanClasses(files: string, pattern: RegExp, allowClasses: string[]) {
  const paths = globSync(files)
  if (paths.length === 0) throw new Error(`No files match ${files}.`)
  const offenders = new Set<string>()
  for (const file of paths) {
    for (const [, cls] of readFileSync(file, 'utf8').matchAll(pattern)) {
      if (!allowClasses.includes(cls!)) offenders.add(`${file}: ${cls}`)
    }
  }
  return [...offenders]
}

// A literal time or curve in a class: duration-[240ms], delay-[1s], ease-[cubic-bezier(…)].
// Values from a token (duration-(--duration-base), ease-(--ease-out)) pass.
const RAW_MOTION = /(?<![\w-])(?:[a-z0-9-]+:)*((?:duration|delay|ease)-\[[^\]\s]+\])/g

/**
 * Durations, delays and easing curves come from the motion tokens in main.css, so the app moves
 * with one rhythm and a change of pace is one edit.
 */
export function rawMotionValues({ files = 'app/**/*.vue', allowClasses = [] }: UiFilesOptions = {}): Findings {
  return {
    offenders: scanClasses(files, RAW_MOTION, allowClasses),
    fix: 'Use a motion token from app/assets/css/main.css instead of a literal time or curve, e.g. duration-(--duration-base) or ease-(--ease-out); add a token there if none fits.',
  }
}

// A literal radius: rounded-[6px], rounded-t-[0.5rem]. Radii derived from a token pass:
// rounded-[calc(var(--radius-control)-2px)] keeps a nested corner concentric with its parent.
const RAW_RADIUS = /(?<![\w-])(?:[a-z0-9-]+:)*(rounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?-\[(?!calc\(var\(--radius-)[^\]\s]+\])/g

/**
 * Corners come from the radius tokens (rounded-card, rounded-control, …), so surfaces share a
 * small set of shapes and a restyle changes the tokens.
 */
export function rawRadiusValues({ files = 'app/**/*.vue', allowClasses = [] }: UiFilesOptions = {}): Findings {
  return {
    offenders: scanClasses(files, RAW_RADIUS, allowClasses),
    fix: 'Use a radius token from app/assets/css/main.css (rounded-card, rounded-control, rounded-full, …) instead of a literal radius; for a corner nested in a token-rounded parent use rounded-[calc(var(--radius-…)-Npx)].',
  }
}

export interface TransitionOptions {
  /** Components to scan (a glob). */
  files?: string
  /** The stylesheet that defines the transition classes. */
  css?: string
}

/**
 * Every <Transition name="x"> / <TransitionGroup name="x"> has its classes (.x-enter-active, …)
 * in the stylesheet. Vue applies the classes either way, so a missing definition fails silently:
 * the element just appears and disappears.
 */
export function transitionNames({ files = 'app/**/*.vue', css = 'app/assets/css/main.css' }: TransitionOptions = {}): Findings {
  const paths = globSync(files)
  if (paths.length === 0) throw new Error(`No files match ${files}.`)
  const styles = readFileSync(css, 'utf8')
  const offenders = new Set<string>()
  for (const file of paths) {
    for (const [, name] of readFileSync(file, 'utf8').matchAll(/<Transition(?:Group)?\b[^>]*?\sname="([\w-]+)"/g)) {
      if (!new RegExp(`\\.${name}-(?:enter|leave)-(?:active|from|to)\\b`).test(styles)) offenders.add(`${file}: ${name}`)
    }
  }
  return {
    offenders: [...offenders],
    fix: `Define these transitions in ${css} (.name-enter-active, .name-leave-active, .name-enter-from, .name-leave-to), or use a name defined there. Without the classes the element appears and vanishes without moving.`,
  }
}

/**
 * The stylesheet turns motion off for people who ask their system for less of it: a
 * prefers-reduced-motion: reduce block that shortens transitions and animations.
 */
export function reducedMotionReset({ css = 'app/assets/css/main.css' } = {}): Findings {
  const styles = readFileSync(css, 'utf8')
  const block = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(styles)?.[1] ?? ''
  const resets = /transition-duration/.test(block) && /animation-duration/.test(block)
  return {
    offenders: resets ? [] : [`${css}: no @media (prefers-reduced-motion: reduce) block resetting transition-duration and animation-duration`],
    fix: `Add to ${css}: @media (prefers-reduced-motion: reduce) { *, ::before, ::after { transition-duration: 1ms !important; animation-duration: 1ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; } }. Motion can make people with vestibular disorders unwell.`,
  }
}

/** The scopes in the `| \`scope\` | area |` table of AGENTS.md's "## Commits" section. */
export function commitScopes(agentsMd: string): string[] {
  const section = /^## Commits\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(agentsMd)?.[1] ?? ''
  return [...section.matchAll(/^\|\s*`([a-z0-9-]+)`\s*\|/gm)].map(m => m[1]!)
}

/**
 * AGENTS.md is the map agents read first: short (detail lives in docs/), with a "## Commits"
 * section whose table lists the allowed commit scopes (a commit-msg hook can enforce them).
 */
export function agentsMap({ file = 'AGENTS.md', maxLines = 100 } = {}): Findings {
  const fix = `${file} is the map agents read first. Keep it under ${maxLines} lines by moving detail into docs/ and linking it, and keep a "## Commits" section with a "| \`scope\` | area |" table of the allowed commit scopes.`
  if (!existsSync(file)) return { offenders: [`${file} is missing`], fix }
  const text = readFileSync(file, 'utf8')
  const lines = text.trimEnd().split('\n').length
  return {
    offenders: [
      ...(lines > maxLines ? [`${file}: ${lines} lines (limit ${maxLines})`] : []),
      ...(commitScopes(text).length ? [] : [`${file}: no "## Commits" section with a scope table`]),
    ],
    fix,
  }
}

interface Job {
  'if'?: string
  'needs'?: string | string[]
  'uses'?: string
  'timeout-minutes'?: number | string
  'concurrency'?: unknown
  'steps'?: { if?: string, run?: string }[]
}

const E2E_STEP = /\b(?:yarn|npm run|pnpm)\s+e2e\b|\bplaywright\s+test\b/
const E2E_OPT_IN = /ci:e2e|inputs\.e2e|CI_E2E/

/**
 * GitHub Actions minutes go to work that tells something new. In `dir`, a workflow that runs on
 * pull requests: does not run again on push to main, starts when a draft is marked ready and skips
 * drafts, and cancels superseded runs. Every job has a timeout. e2e runs locally (`nuxt-harness
 * e2e`), so an e2e step in CI runs only when asked for (label ci:e2e or a dispatch input).
 */
export function ciBudget({ dir = '.github/workflows' } = {}): Findings {
  const files = globSync(`${dir}/*.{yml,yaml}`).sort()
  if (files.length === 0) throw new Error(`No workflows (*.yml) in ${dir}.`)
  const offenders: string[] = []
  for (const file of files) {
    const workflow = parse(readFileSync(file, 'utf8')) ?? {}
    const on = workflow.on ?? {}
    const triggers: Record<string, { branches?: string[], types?: string[] } | null> = typeof on === 'string'
      ? { [on]: null }
      : Array.isArray(on) ? Object.fromEntries(on.map((t: string) => [t, null])) : on
    const jobs: Record<string, Job> = workflow.jobs ?? {}
    const skipsDrafts = (name: string, seen = new Set<string>()): boolean => {
      if (seen.has(name)) return false
      seen.add(name)
      const job = jobs[name]
      const needs = job?.needs === undefined ? [] : [job.needs].flat()
      return /pull_request\.draft/.test(String(job?.if ?? '')) || needs.some(n => skipsDrafts(n, seen))
    }

    if ('pull_request' in triggers) {
      const push = triggers.push
      if ('push' in triggers && (!push?.branches || push.branches.some(b => b === 'main' || b === 'master')))
        offenders.push(`${file}: runs on push to main as well as on pull requests (the merged PR already passed)`)
      if (!triggers.pull_request?.types?.includes('ready_for_review'))
        offenders.push(`${file}: pull_request.types lacks ready_for_review (a draft marked ready would not run)`)
      for (const name of Object.keys(jobs))
        if (!skipsDrafts(name)) offenders.push(`${file}: job ${name} runs on draft pull requests`)
      const cancels = (c: unknown) => typeof c === 'object' && c !== null && (c as Record<string, unknown>)['cancel-in-progress'] === true
      if (!cancels(workflow.concurrency) && !Object.values(jobs).every(j => cancels(j.concurrency)))
        offenders.push(`${file}: no concurrency with cancel-in-progress: true (superseded runs keep going)`)
    }
    for (const [name, job] of Object.entries(jobs)) {
      if (!job.uses && job['timeout-minutes'] === undefined) offenders.push(`${file}: job ${name} has no timeout-minutes`)
      for (const step of job.steps ?? []) {
        if (step.run && E2E_STEP.test(step.run) && !E2E_OPT_IN.test(`${step.if ?? ''} ${job.if ?? ''}`))
          offenders.push(`${file}: job ${name} runs e2e on every run`)
      }
    }
  }
  return {
    offenders,
    fix: 'Spend Actions minutes only on new information: trigger on `pull_request: { types: [opened, synchronize, reopened, ready_for_review] }` without `push` to main; give each job `if: ${{ !github.event.pull_request.draft }}` (or `needs` a job that has it); set `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`; give every job `timeout-minutes`. e2e runs on the developer\'s machine (`yarn nuxt-harness e2e`) and CI checks it with `yarn nuxt-harness require-local-e2e --sha ${{ github.event.pull_request.head.sha }}`; an e2e step in CI needs an `if` on the ci:e2e label or an `inputs.e2e` dispatch input, as in the CI example in the nuxt-harness README.',
  }
}
