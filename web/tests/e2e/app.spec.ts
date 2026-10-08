import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs'

const EVIDENCE_DIR = '../artifacts/verification'

test.beforeEach(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
})

test('app loads, intro plays, and reveals the real prediction form', async ({ page }) => {
  await page.goto('/')
  // The intro overlay is visible first.
  await expect(page.getByText('skip intro')).toBeVisible()
  // Click through rather than waiting out the ~3.2s animation.
  await page.getByText('skip intro').click()
  // A real DOM element from the mounted form, not just "no error banner".
  await expect(page.getByRole('button', { name: 'Predict churn' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'PREDICTIVE' })).toBeVisible()
})

test('filling the form and clicking Predict shows a result', async ({ page }) => {
  await page.goto('/')
  await page.getByText('skip intro').click()
  await expect(page.getByRole('button', { name: 'Predict churn' })).toBeVisible()

  await page.getByRole('button', { name: 'Predict churn' }).click()
  // Either a result renders, or an error is shown - either way the UI must
  // leave the "fill the form" placeholder and show *something* real.
  await expect(page.getByText('Fill the form and click Predict.')).not.toBeVisible({ timeout: 10_000 })
  const resultVisible = await page.getByText('probability of churn').isVisible().catch(() => false)
  const errorVisible = await page.getByText(/^Error:/).isVisible().catch(() => false)
  if (errorVisible && !resultVisible) {
    const errorText = await page.getByText(/^Error:/).textContent()
    fs.writeFileSync(`${EVIDENCE_DIR}/predict-click-error.txt`, errorText ?? '')
  }
  expect(resultVisible, 'Predict click should show a probability result, see predict-click-error.txt if this fails').toBe(true)
})

test('axe-core scan of the main page reports zero serious/critical violations', async ({ page }) => {
  await page.goto('/')
  await page.getByText('skip intro').click()
  await expect(page.getByRole('button', { name: 'Predict churn' })).toBeVisible()

  const results = await new AxeBuilder({ page }).analyze()
  fs.writeFileSync(`${EVIDENCE_DIR}/axe-violations.json`, JSON.stringify(results.violations, null, 2))

  const seriousOrCritical = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    seriousOrCritical,
    `Found ${seriousOrCritical.length} serious/critical a11y violations, see artifacts/verification/axe-violations.json:\n` +
      seriousOrCritical.map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`).join('\n'),
  ).toEqual([])
})

test('mobile (390px) and desktop (1280px) screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByText('skip intro').click()
  await expect(page.getByRole('button', { name: 'Predict churn' })).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE_DIR}/mobile-390px.png`, fullPage: true })

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.reload()
  await page.getByText('skip intro').click()
  await expect(page.getByRole('button', { name: 'Predict churn' })).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE_DIR}/desktop-1280px.png`, fullPage: true })
})

test('prefers-reduced-motion: reduce skips the canvas intro entirely', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  // The intro's own code path calls onDone() synchronously and renders null
  // when reduced-motion is set, so the overlay/skip-intro link must never appear.
  await expect(page.getByText('skip intro')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Predict churn' })).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE_DIR}/reduced-motion.png` })
})
