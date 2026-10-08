import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Loads the site, skips the intro, and waits for a real (non-placeholder) model prediction. */
export async function gotoReady(page: Page, path = '/') {
  await page.goto(path)
  const skip = page.getByRole('button', { name: /skip intro/i })
  await skip.click({ timeout: 15_000 })
  await expect(page.getByTestId('focal-probability').first()).not.toHaveText('...', { timeout: 20_000 })
}
