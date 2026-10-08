import { test, expect } from '@playwright/test'
import { gotoReady } from './helpers'

test('mobile (390px) layout is usable: sentence lab, no horizontal scroll, real probability', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoReady(page)

  // the mobile Prediction Lab is the explorable sentence (Concept B), not the desktop rail.
  await expect(page.locator('text=customer,').first()).toBeVisible()
  await expect(page.getByText('All 19 features')).toBeVisible()

  const [scrollWidth, clientWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ])
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1) // no horizontal page scroll

  await expect(page.getByTestId('focal-probability').first()).not.toHaveText('...')
})
