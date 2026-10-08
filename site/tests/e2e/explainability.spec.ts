import { test, expect } from '@playwright/test'
import { gotoReady } from './helpers'

test('SHAP view and live-sensitivity view are visually/textually distinct, and editing switches to sensitivity', async ({ page }) => {
  await gotoReady(page)

  // scroll into beat 5 (Explanation): cumulative beat bounds are
  // hero 0-100vh, data 100-250, features 250-450, boundary 450-700,
  // prediction 700-850, explanation 850-1050 (motion/scroll-scenes.ts).
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 9.3))

  // unedited: both panels render side by side, clearly labeled.
  await expect(page.getByTestId('shap-panel')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('shap-panel')).toContainText('SHAP')
  await expect(page.getByTestId('shap-panel')).toContainText('not the calibrated probability')
  await expect(page.getByTestId('sensitivity-panel')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('sensitivity-panel')).toContainText('not SHAP')

  // edit a feature: the SHAP panel for the now-stale fixture row must disappear,
  // and the restore-original link + sensitivity-only view must take over.
  await page.getByLabel('Instrument rail: prediction lab controls').hover()
  await page.getByRole('radiogroup', { name: 'Contract' }).getByRole('radio').last().click()

  await expect(page.getByText(/SHAP was precomputed for the original/)).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('shap-panel')).toHaveCount(0)
  await expect(page.getByTestId('sensitivity-panel')).toBeVisible({ timeout: 15_000 })
})
