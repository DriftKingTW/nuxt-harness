// layoutOverflow measures a real layout, so it runs in a browser: Playwright's Chromium where it
// is installed, else the system Chrome (GitHub's ubuntu runners have one).
import { chromium, type Browser, type Page } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { layoutOverflow } from '../src/playwright.js'

let browser: Browser | undefined
beforeAll(async () => {
  browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' })).catch(() => undefined)
})
afterAll(() => browser?.close())

async function at(width: number, body: string, run: (page: Page) => Promise<void>) {
  const page = await browser!.newPage({ viewport: { width, height: 600 } })
  await page.setContent(`<!doctype html><style>* { box-sizing: border-box } body { margin: 0 }</style><body><main>${body}</main></body>`)
  try {
    await run(page)
  }
  finally {
    await page.close()
  }
}

describe('layoutOverflow', () => {
  it('has a browser to run in', () => {
    expect(browser, 'Install a browser: yarn playwright install chromium-headless-shell').toBeDefined()
  })

  it('passes a layout that fits', () => at(360, '<form style="width: 300px"><input style="width: 100%"><button>Save</button></form>', async (page) => {
    expect(await layoutOverflow(page)).toEqual([])
  }))

  it('finds a page that scrolls sideways', () => at(360, '<div style="width: 500px">wide</div>', async (page) => {
    expect(await layoutOverflow(page)).toEqual(['page scrolls sideways (500px wide at 360px)'])
  }))

  it('finds the outermost element sticking out of its card, and names it', () => at(800, [
    '<section style="width: 300px">',
    '  <label style="display: block; width: 400px">Name <input style="width: 100%"></label>',
    '  <button aria-label="Close" style="width: 30px; margin-left: -20px">×</button>',
    '</section>',
  ].join(''), async (page) => {
    expect(await layoutOverflow(page)).toEqual([
      '<label> "Name" sticks out of its <section> (0–400px, the box 0–300px)',
      '<button> "Close" sticks out of its <section> (-20–10px, the box 0–300px)',
    ])
  }))

  it('leaves content that scrolls in its own box, things fixed to the screen and hidden ones', () => at(800, [
    '<section style="width: 300px">',
    '  <div style="overflow-x: auto"><table style="width: 600px"><tr><td>wide</td></tr></table></div>',
    '  <div style="position: fixed; left: 0; width: 800px"><button>Save</button></div>',
    '  <button style="width: 600px; visibility: hidden">Hidden</button>',
    '  <button style="width: 600px; display: none">Gone</button>',
    '</section>',
    '<button style="width: 900px">Outside any box</button>',
  ].join(''), async (page) => {
    expect(await layoutOverflow(page, { elements: 'button, table' })).toEqual(['page scrolls sideways (900px wide at 800px)'])
  }))

  it('takes its own containers and elements', () => at(800, '<div class="card" style="width: 200px"><p style="width: 300px">Long</p></div>', async (page) => {
    expect(await layoutOverflow(page)).toEqual([])
    expect(await layoutOverflow(page, { containers: '.card', elements: 'p' })).toEqual(['<p> "Long" sticks out of its <div> (0–300px, the box 0–200px)'])
  }))
})
