import { test, expect } from '@playwright/test'
import { gotoReady } from './helpers'

test('page loads, intro is skippable, main experience becomes usable, no critical console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))

  await page.goto('/')
  await expect(page.getByRole('button', { name: /skip intro/i })).toBeVisible()

  await gotoReady(page)

  // the main experience is usable: the hidden h1 and the terrain canvases exist
  await expect(page.locator('h1')).toHaveText(/PREDICTIVE/)
  await expect(page.locator('canvas')).toHaveCount(2, { timeout: 10_000 })

  const critical = consoleErrors.filter(
    (e) => !/favicon|DevTools|Download the React DevTools/i.test(e)
  )
  expect(critical, `console errors: ${critical.join('\n')}`).toEqual([])
})
