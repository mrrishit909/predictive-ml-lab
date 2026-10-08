import { test, expect } from '@playwright/test'
import { gotoReady } from './helpers'

test('scroll narrative transitions through the six beats', async ({ page }) => {
  await gotoReady(page)

  // beat 0 (hero): the hero claim is in the accessible fallback text.
  await expect(page.getByText(/Drag her\. The model answers every frame\./)).toHaveCount(1)

  // scroll into beat 1 (Data): its caption claim should appear.
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.3))
  await expect(page.getByText(/Four hundred customers from the held-out test set\./)).toBeVisible({ timeout: 5_000 })

  // scroll into beat 3 (Decision boundary): its caption claim should appear.
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 5))
  await expect(page.getByText(/One number decides/)).toBeVisible({ timeout: 5_000 })

  // scroll to the un-stuck Evaluation section past the sticky track.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(page.getByRole('heading', { name: /How often is it right\?/ })).toBeVisible()
})
