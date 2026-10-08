import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { gotoReady } from './helpers'

test('axe-core scan has zero serious/critical violations', async ({ page }) => {
  await gotoReady(page)

  const results = await new AxeBuilder({ page }).analyze()
  const seriousOrCritical = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')

  expect(
    seriousOrCritical,
    seriousOrCritical.map((v) => `${v.id} (${v.impact}): ${v.help} - ${v.nodes.length} node(s)`).join('\n')
  ).toEqual([])
})
