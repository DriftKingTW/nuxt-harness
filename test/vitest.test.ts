import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { agentsMap, commitScopes, localeKeyParity, missingLocaleKeys, rawMotionValues, rawPaletteColours, rawRadiusValues, reducedMotionReset, transitionNames } from '../src/vitest.js'

function project(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'nuxt-harness-'))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return root
}

describe('localeKeyParity', () => {
  it('lists keys missing from any locale file, nested ones included', () => {
    const dir = join(project({
      'locales/en.json': JSON.stringify({ a: 'A', nav: { home: 'Home', about: 'About' } }),
      'locales/zh-TW.json': JSON.stringify({ a: '甲', nav: { home: '首頁' }, extra: '多' }),
    }), 'locales')
    expect(localeKeyParity({ dir }).offenders).toEqual(['en.json: extra', 'zh-TW.json: nav.about'])
  })

  it('refuses an empty folder rather than passing', () => {
    const dir = join(project({ 'locales/.keep': '' }), 'locales')
    expect(() => localeKeyParity({ dir })).toThrow('No locale files')
  })
})

describe('missingLocaleKeys', () => {
  it('lists each key a locale file lacks', () => {
    const dir = join(project({
      'locales/en.json': JSON.stringify({ errors: { not_found: 'Not found', conflict: 'Conflict' } }),
      'locales/zh-TW.json': JSON.stringify({ errors: { not_found: '找不到' } }),
    }), 'locales')
    expect(missingLocaleKeys(['errors.not_found', 'errors.conflict'], { dir }).offenders).toEqual(['zh-TW.json: errors.conflict'])
  })

  it('refuses an empty key list rather than passing', () => {
    expect(() => missingLocaleKeys([])).toThrow('got no keys')
  })
})

describe('rawPaletteColours', () => {
  const root = project({
    'app/Card.vue': '<div class="bg-surface text-ink hover:bg-blue-500 dark:text-white/70 shadow-black/20"></div>',
    'app/chips.ts': 'export const red = "bg-red-100 text-red-800"',
    'app/Fine.vue': '<div class="bg-accent text-danger border-line"></div>',
  })

  it('finds palette colours with variants, shades and opacity', () => {
    const { offenders } = rawPaletteColours({ files: `${root}/app/**/*.{vue,ts}`, allowFiles: [`${root}/app/chips.ts`] })
    expect(offenders.map(o => o.slice(root.length + 1))).toEqual([
      'app/Card.vue: bg-blue-500',
      'app/Card.vue: text-white/70',
      'app/Card.vue: shadow-black/20',
    ])
  })

  it('allows listed classes', () => {
    const { offenders } = rawPaletteColours({ files: `${root}/app/Card.vue`, allowClasses: ['bg-blue-500', 'text-white/70', 'shadow-black/20'] })
    expect(offenders).toEqual([])
  })
})

describe('agentsMap', () => {
  const commits = '## Commits\n\n| scope | area |\n|---|---|\n| `app` | pages |\n| `e2e` | specs |\n\n## Language\n\n| `not-a-scope` | x |\n'

  it('reads the scopes from the Commits table only', () => {
    expect(commitScopes(`# AGENTS.md\n\n${commits}`)).toEqual(['app', 'e2e'])
  })

  it('accepts a short map with a scope table', () => {
    const root = project({ 'AGENTS.md': `# AGENTS.md\n\n${commits}` })
    expect(agentsMap({ file: join(root, 'AGENTS.md') }).offenders).toEqual([])
  })

  it('flags a long map without a scope table, or a missing one', () => {
    const root = project({ 'AGENTS.md': `# AGENTS.md\n${'line\n'.repeat(120)}` })
    const file = join(root, 'AGENTS.md')
    expect(agentsMap({ file }).offenders).toEqual([`${file}: 121 lines (limit 100)`, `${file}: no "## Commits" section with a scope table`])
    expect(agentsMap({ file: join(root, 'missing.md') }).offenders).toEqual([`${join(root, 'missing.md')} is missing`])
  })
})

describe('rawMotionValues', () => {
  const root = project({
    'app/Reel.vue': '<div class="transition-transform duration-[2400ms] ease-[cubic-bezier(0.12,0.8,0.2,1)] motion-safe:delay-[50ms]"></div>',
    'app/Fine.vue': '<div class="transition duration-200 duration-(--duration-base) ease-(--ease-out) ease-out"></div>',
  })

  it('finds literal times and curves, with variants', () => {
    const { offenders } = rawMotionValues({ files: `${root}/app/**/*.vue` })
    expect(offenders.map(o => o.slice(root.length + 1))).toEqual([
      'app/Reel.vue: duration-[2400ms]',
      'app/Reel.vue: ease-[cubic-bezier(0.12,0.8,0.2,1)]',
      'app/Reel.vue: delay-[50ms]',
    ])
  })

  it('allows listed classes', () => {
    const { offenders } = rawMotionValues({ files: `${root}/app/Reel.vue`, allowClasses: ['duration-[2400ms]', 'ease-[cubic-bezier(0.12,0.8,0.2,1)]', 'delay-[50ms]'] })
    expect(offenders).toEqual([])
  })
})

describe('rawRadiusValues', () => {
  const root = project({
    'app/Chip.vue': '<span class="rounded-[0.5rem] sm:rounded-t-[6px] rounded-[calc(var(--radius-control)-2px)] rounded-full rounded-card"></span>',
  })

  it('finds literal radii, sides and variants included; token-derived radii pass', () => {
    const { offenders } = rawRadiusValues({ files: `${root}/app/**/*.vue` })
    expect(offenders.map(o => o.slice(root.length + 1))).toEqual(['app/Chip.vue: rounded-[0.5rem]', 'app/Chip.vue: rounded-t-[6px]'])
  })

  it('allows listed classes', () => {
    expect(rawRadiusValues({ files: `${root}/app/Chip.vue`, allowClasses: ['rounded-[0.5rem]', 'rounded-t-[6px]'] }).offenders).toEqual([])
  })
})

describe('transitionNames', () => {
  const root = project({
    'app/assets/css/main.css': '.fade-enter-active, .fade-leave-active { transition: opacity 200ms; }\n.sheet-enter-from { transform: translateY(100%); }',
    'app/Page.vue': '<Transition name="fade"><p v-if="a" /></Transition><Transition mode="out-in" name="pop"><p v-if="b" /></Transition><TransitionGroup tag="ul" name="sheet"><li /></TransitionGroup>',
  })

  it('lists transition names without classes in the stylesheet', () => {
    const { offenders } = transitionNames({ files: `${root}/app/**/*.vue`, css: `${root}/app/assets/css/main.css` })
    expect(offenders.map(o => o.slice(root.length + 1))).toEqual(['app/Page.vue: pop'])
  })
})

describe('reducedMotionReset', () => {
  it('passes when the stylesheet shortens transitions and animations for reduced motion', () => {
    const root = project({ 'main.css': '@media (prefers-reduced-motion: reduce) {\n  *, ::before, ::after { transition-duration: 1ms !important; animation-duration: 1ms !important; }\n}\n' })
    expect(reducedMotionReset({ css: `${root}/main.css` }).offenders).toEqual([])
  })

  it('fails without the block, or when it only resets one of the two', () => {
    const none = project({ 'main.css': '.a { transition: opacity 200ms; }\n' })
    const half = project({ 'main.css': '@media (prefers-reduced-motion: reduce) {\n  * { transition-duration: 1ms !important; }\n}\n' })
    expect(reducedMotionReset({ css: `${none}/main.css` }).offenders).toHaveLength(1)
    expect(reducedMotionReset({ css: `${half}/main.css` }).offenders).toHaveLength(1)
  })
})
