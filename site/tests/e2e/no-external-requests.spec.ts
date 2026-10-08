import { test, expect } from '@playwright/test'
import { gotoReady } from './helpers'

/**
 * Task requirement #9: the built site must make zero requests to any
 * origin other than its own - no Google Fonts link, no CDN, nothing. This
 * is also what would catch a font or icon library accidentally pulling
 * from a CDN. Listens on the browser context (not just `page`) so a
 * request made from the grid Web Worker is caught too.
 */
test('zero requests leave the page\'s own origin', async ({ page, context, baseURL }) => {
  const ownOrigin = new URL(baseURL!).origin
  const foreignRequests: string[] = []

  context.on('request', (req) => {
    const url = req.url()
    if (url.startsWith('data:') || url.startsWith('blob:')) return
    if (new URL(url).origin !== ownOrigin) foreignRequests.push(url)
  })

  await gotoReady(page)
  await page.evaluate(() => document.fonts.ready)

  // exercise all six beats plus the evaluation section so any lazily-loaded
  // asset (a font subset, an icon) has a chance to fire its request too.
  for (const frac of [0, 1.3, 3, 5, 7.5, 9.3, 11]) {
    await page.evaluate((f) => window.scrollTo(0, window.innerHeight * f), frac)
    await page.waitForTimeout(150)
  }

  expect(foreignRequests, foreignRequests.join('\n')).toEqual([])
})
