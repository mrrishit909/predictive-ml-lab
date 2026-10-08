import { test } from '@playwright/test'
import { gotoReady } from './helpers'

const OUT = '../artifacts/site-verification'

test('capture real screenshots for visual verification', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoReady(page)
  await page.screenshot({ path: `${OUT}/desktop-hero.png` })

  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.3))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/desktop-beat1-data.png` })

  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 5))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/desktop-beat3-boundary.png` })

  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 7.5))
  await page.getByLabel('Instrument rail: prediction lab controls').hover()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/desktop-beat4-prediction-lab.png` })

  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 9.3))
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/desktop-beat5-explanation.png` })

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/desktop-beat6-evaluation.png`, fullPage: false })

  // mobile
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/mobile-390px-hero.png` })

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/mobile-390px-evaluation.png` })
})

test('capture reduced-motion static intro frame', async ({ page, context }) => {
  await context.addInitScript(() => {})
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/reduced-motion-intro-frame.png` })
})
