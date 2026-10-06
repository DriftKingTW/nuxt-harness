// ESLint rules shared by the apps. Each message says how to fix the problem, because coding agents
// read lint output and act on it.
import type { ESLint, Linter, Rule } from 'eslint'

/**
 * eslint-plugin-vue's default allowlist for vue/no-bare-strings-in-template (it is not exported),
 * plus symbols every app shows as-is in any language.
 */
export const BARE_STRING_ALLOWLIST = [
  '(', ')', ',', '.', '&', '+', '-', '=', '*', '/', '#', '%', '!', '?', ':', '[', ']', '{', '}', '<', '>',
  '·', '•', '‐', '–', '—', '−', '|',
  '×', '←', '…',
]

const gotoHydrated: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Navigate with gotoHydrated() instead of page.goto()' },
    messages: {
      goto: 'Use gotoHydrated(page, path) from e2e/fixtures.ts. Clicks before Vue hydration are silently lost, which makes tests flaky.',
    },
    schema: [],
  },
  create: context => ({
    'CallExpression[callee.object.name="page"][callee.property.name="goto"]'(node: Rule.Node) {
      context.report({ node, messageId: 'goto' })
    },
  }),
}

const testFromFixtures: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Import test and expect from e2e/fixtures.ts, not @playwright/test' },
    messages: {
      fixtures: 'Import {{name}} from ./fixtures (e2e/fixtures.ts): its test fails when a page logs a console error or warning.',
    },
    schema: [],
  },
  create: context => ({
    ImportDeclaration(node) {
      if (node.source.value !== '@playwright/test') return
      for (const specifier of node.specifiers) {
        if (specifier.type !== 'ImportSpecifier' || specifier.imported.type !== 'Identifier') continue
        const name = specifier.imported.name
        if (name === 'test' || name === 'expect') context.report({ node: specifier, messageId: 'fixtures', data: { name } })
      }
    },
  }),
}

export const plugin: ESLint.Plugin = {
  meta: { name: '@driftkingtw/nuxt-harness' },
  rules: {
    'goto-hydrated': gotoHydrated,
    'test-from-fixtures': testFromFixtures,
  },
}

export interface HarnessOptions {
  /** Symbols this app also shows as-is in every language, added to BARE_STRING_ALLOWLIST. */
  bareStrings?: string[]
}

/**
 * The shared rules as flat config items, for an app with the Nuxt layout (app/, e2e/*.spec.ts).
 * They use their own rule names, so an app's own no-restricted-syntax or no-restricted-imports
 * settings for the same files don't replace them (flat config replaces a rule's options as a whole).
 */
export function harness({ bareStrings = [] }: HarnessOptions = {}): Linter.Config[] {
  return [
    {
      name: 'nuxt-harness/i18n',
      files: ['app/**/*.vue'],
      rules: {
        // All user-facing copy goes through i18n (t / $t), including aria-label, title, placeholder, alt.
        'vue/no-bare-strings-in-template': ['error', { allowlist: [...BARE_STRING_ALLOWLIST, ...bareStrings] }],
      },
    },
    {
      name: 'nuxt-harness/e2e',
      files: ['e2e/**/*.spec.ts'],
      plugins: { 'nuxt-harness': plugin },
      rules: {
        'nuxt-harness/goto-hydrated': 'error',
        'nuxt-harness/test-from-fixtures': 'error',
      },
    },
  ]
}
