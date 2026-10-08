import { test, expect } from '@playwright/test'

test('reduced-motion mode works and never hides content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  // reduced motion replaces the animated intro with 3 static frames that
  // auto-advance (REDUCED_INTRO_FRAME_HOLD_MS = 1200ms each, motion/reduced-motion.ts) -
  // wait them out rather than clicking skip, to prove that path also works.
  await expect(page.getByTestId('focal-probability').first()).not.toHaveText('...', { timeout: 20_000 })

  // all the same content is present: beats, rail, evaluation section - nothing is hidden.
  await expect(page.locator('h1')).toHaveText(/PREDICTIVE/)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(page.getByRole('heading', { name: /How often is it right\?/ })).toBeVisible()
})
