// Structural checks for an app's Vitest suite. Each returns what it found and how to fix it;
// expectClean() turns that into a failing assertion. Paths are relative to the working directory
// (the app's root when Vitest runs there).
import { existsSync, globSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'

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
