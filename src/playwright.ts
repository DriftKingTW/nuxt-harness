// Playwright helpers. Apps re-export them from e2e/fixtures.ts, next to their own helpers, and
// specs import from there (lint rules goto-hydrated and test-from-fixtures).
import { test as base, expect, type Page } from '@playwright/test'

export { expect }

export interface HarnessTestOptions {
  /**
   * Console lines a test may cause without failing, matched against "console.error: <text>",
   * "console.warning: <text>" or "page error: <message>". Only for lines a test provokes on purpose,
   * e.g. /^console\.error: Failed to load resource/ when it checks how the app handles an HTTP error.
   */
  consoleIgnore: RegExp[]
}

/**
 * Playwright's test, failing any test whose pages log a console error or warning or throw. Such a
 * test can pass by luck while hiding a race (a request cut off by navigating mid-save) or a broken
 * link (a Vue Router "No match found" warning).
 */
export const test = base.extend<HarnessTestOptions & { consoleProblems: string[] }>({
  consoleIgnore: [[], { option: true }],
  consoleProblems: [async ({ context, consoleIgnore }, use) => {
    const problems: string[] = []
    const report = (line: string) => {
      if (!consoleIgnore.some(pattern => pattern.test(line))) problems.push(line)
    }
    context.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') report(`console.${message.type()}: ${message.text()}`)
    })
    context.on('weberror', error => report(`page error: ${error.error().message}`))
    await use(problems)
    expect(problems, 'Pages logged errors or warnings. Fix them, or the test that causes them; consoleIgnore in playwright.config.ts is only for lines a test provokes on purpose.').toEqual([])
  }, { auto: true }],
})

/**
 * Navigates and waits until Nuxt has hydrated (the package's Nuxt module marks <html>). Clicks
 * before that are silently lost, so specs use this instead of page.goto().
 */
export async function gotoHydrated(page: Page, path: string) {
  await page.goto(path)
  await page.locator('html[data-hydrated="true"]').waitFor()
}

/**
 * The e2e dev server port: E2E_PORT, or one derived from the working directory so e2e runs in
 * parallel worktrees don't collide.
 */
export function e2ePort(cwd = process.cwd()) {
  return Number(process.env.E2E_PORT ?? 4000 + ([...cwd].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % 1000))
}
