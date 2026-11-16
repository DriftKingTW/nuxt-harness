// Playwright helpers. Apps re-export them from e2e/fixtures.ts, next to their own helpers, and
// specs import from there (lint rules goto-hydrated and test-from-fixtures).
// The callbacks of page.evaluate run in the browser, hence the DOM types.
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { test as base, expect, type Page } from '@playwright/test'

export { expect }

export interface HarnessTestOptions {
  /**
   * Console lines a test may cause without failing, matched against "console.error: <text>",
   * "console.warning: <text>" or "page error: <message>". Only for lines a test provokes on purpose,
   * e.g. /^console\.error: Failed to load resource/ when it checks how the app handles an HTTP error.
   * In `test.use`, Playwright reads a two-item array as [value, options] and silently drops the
   * second pattern: there, pass one RegExp and join alternatives with `|`. A test's value replaces
   * the config's, so repeat the config's patterns it still needs.
   */
  consoleIgnore: RegExp | RegExp[]
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
    const patterns = [consoleIgnore].flat()
    const report = (line: string) => {
      if (!patterns.some(pattern => pattern.test(line))) problems.push(line)
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

export interface LayoutOverflowOptions {
  /** Boxes their contents must stay inside; each element is held to the closest one around it. */
  containers?: string
  /** The elements to check. */
  elements?: string
}

/**
 * What breaks the layout at the page's current width: a page that scrolls sideways, and elements
 * sticking out of the closest card or form around them (only the outermost of nested offenders).
 * Content in a box that scrolls or clips it, and anything fixed to the screen, doesn't count.
 * Check each page at phone width: `await expect.poll(() => layoutOverflow(page)).toEqual([])`.
 */
export async function layoutOverflow(page: Page, {
  containers = 'section, article, aside, figure, header, form, dialog',
  elements = 'input, select, textarea, button, a, label, img, canvas, video, table',
}: LayoutOverflowOptions = {}) {
  return await page.evaluate(({ containers, elements }) => {
    const problems: string[] = []
    const root = document.documentElement
    if (root.scrollWidth > window.innerWidth + 1) problems.push(`page scrolls sideways (${root.scrollWidth}px wide at ${window.innerWidth}px)`)
    const reported: Element[] = []
    for (const el of document.querySelectorAll(elements)) {
      const box = el.parentElement?.closest(containers)
      if (!box || reported.some(r => r.contains(el)) || !el.checkVisibility({ visibilityProperty: true })) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      let free = true
      for (let a: Element | null = el; a && a !== box; a = a.parentElement) {
        const style = getComputedStyle(a)
        if (style.position === 'fixed' || (a !== el && style.overflowX !== 'visible')) free = false
      }
      const b = box.getBoundingClientRect()
      if (!free || (r.left >= b.left - 1 && r.right <= b.right + 1)) continue
      reported.push(el)
      const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 20) || ''
      problems.push(`<${el.tagName.toLowerCase()}> "${name}" sticks out of its <${box.tagName.toLowerCase()}> (${Math.round(r.left)}–${Math.round(r.right)}px, the box ${Math.round(b.left)}–${Math.round(b.right)}px)`)
    }
    return problems
  }, { containers, elements })
}

/**
 * The e2e dev server port: E2E_PORT, or one derived from the working directory so e2e runs in
 * parallel worktrees don't collide.
 */
export function e2ePort(cwd = process.cwd()) {
  return Number(process.env.E2E_PORT ?? 4000 + ([...cwd].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % 1000))
}
