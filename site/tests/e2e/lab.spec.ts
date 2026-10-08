import { test, expect } from '@playwright/test'
import { gotoReady } from './helpers'

test('Prediction Lab produces a real probability and the terrain grid recomputes on a feature edit', async ({ page }) => {
  await gotoReady(page)

  const probBefore = await page.getByTestId('focal-probability').first().textContent()
  expect(probBefore).toMatch(/^(<0\.001|>0\.999|0\.\d{3})$/)

  // the grid-meta ledger line (components/InferenceLedger.tsx) only renders
  // once a real grid result has landed - wait for the first one.
  await expect(page.getByTestId('grid-meta').first()).toBeVisible({ timeout: 10_000 })
  const gridBefore = await page.getByTestId('grid-meta').first().textContent()

  // open the desktop rail (hover expands it - InstrumentRail.tsx) and move
  // the tenure scrubber: a real feature edit.
  await page.getByLabel('Instrument rail: prediction lab controls').hover()
  await page.getByRole('slider', { name: /Tenure/i }).first().focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')

  await expect(async () => {
    const probAfter = await page.getByTestId('focal-probability').first().textContent()
    expect(probAfter).not.toBe(probBefore)
  }).toPass({ timeout: 10_000 })

  await expect(async () => {
    const gridAfter = await page.getByTestId('grid-meta').first().textContent()
    expect(gridAfter).not.toBe(gridBefore)
  }).toPass({ timeout: 10_000 })
})
