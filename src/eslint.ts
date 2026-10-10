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
    docs: { description: 'Navigate with gotoHydrated() instead of page.goto() or page.reload()' },
    messages: {
      goto: 'Use gotoHydrated(page, path) from e2e/fixtures.ts. Clicks before Vue hydration are silently lost, which makes tests flaky.',
      reload: 'Load the page again with gotoHydrated(page, path) from e2e/fixtures.ts. Right after page.reload() Vue has not hydrated yet, so the next click can be silently lost.',
    },
    schema: [],
  },
  create: context => ({
    'CallExpression[callee.object.name="page"][callee.property.name="goto"]'(node: Rule.Node) {
      context.report({ node, messageId: 'goto' })
    },
    // A reload hydrates again, the same race as a fresh page.goto().
    'CallExpression[callee.object.name="page"][callee.property.name="reload"]'(node: Rule.Node) {
      context.report({ node, messageId: 'reload' })
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

const DIALOGS = new Set(['alert', 'confirm', 'prompt'])
const BROWSER_GLOBALS = new Set(['window', 'globalThis', 'self'])

const noBrowserDialogs: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'No alert(), confirm() or prompt()' },
    messages: {
      dialog: 'No {{name}}(): browser dialogs block the page, cannot be styled or translated with the app, and look different on every device. Confirm a destructive action in the page (a two-step button: the first click arms it), show a message in the page (role="alert"), and ask for input with a form or the app\'s dialog component.',
    },
    schema: [],
  },
  create: context => ({
    CallExpression(node) {
      const callee = node.callee
      let name: string | undefined
      if (callee.type === 'Identifier') name = callee.name
      else if (callee.type === 'MemberExpression' && !callee.computed && callee.object.type === 'Identifier'
        && BROWSER_GLOBALS.has(callee.object.name) && callee.property.type === 'Identifier') name = callee.property.name
      if (name && DIALOGS.has(name)) context.report({ node, messageId: 'dialog', data: { name } })
    },
  }),
}

export const plugin: ESLint.Plugin = {
  meta: { name: '@driftkingtw/nuxt-harness' },
  rules: {
    'goto-hydrated': gotoHydrated,
    'no-browser-dialogs': noBrowserDialogs,
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
      name: 'nuxt-harness/app',
      files: ['app/**/*.{ts,vue}'],
      plugins: { 'nuxt-harness': plugin },
      rules: {
        'nuxt-harness/no-browser-dialogs': 'error',
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
