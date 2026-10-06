import { RuleTester } from 'eslint'
import { describe, expect, it } from 'vitest'
import { BARE_STRING_ALLOWLIST, harness, plugin } from '../src/eslint.js'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only
const tester = new RuleTester()

tester.run('goto-hydrated', plugin.rules!['goto-hydrated']!, {
  valid: [
    'await gotoHydrated(page, "/items")',
    'await other.goto("/items")',
  ],
  invalid: [
    { code: 'await page.goto("/items")', errors: [{ messageId: 'goto' }] },
  ],
})

tester.run('test-from-fixtures', plugin.rules!['test-from-fixtures']!, {
  valid: [
    'import { test, expect } from "./fixtures"',
    'import { devices } from "@playwright/test"',
  ],
  invalid: [
    { code: 'import { test, expect } from "@playwright/test"', errors: [{ messageId: 'fixtures' }, { messageId: 'fixtures' }] },
    { code: 'import { expect as check } from "@playwright/test"', errors: [{ messageId: 'fixtures' }] },
  ],
})

describe('harness()', () => {
  it('adds the app\'s symbols to the shared allowlist', () => {
    const rule = harness({ bareStrings: ['Esc'] })[0]!.rules!['vue/no-bare-strings-in-template']
    expect(rule).toEqual(['error', { allowlist: [...BARE_STRING_ALLOWLIST, 'Esc'] }])
  })
})
