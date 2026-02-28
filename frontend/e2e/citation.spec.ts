import { test, expect } from '@playwright/test'
import {
  mockAllApiRoutes,
  uploadPdf,
  sendChatMessage,
  MOCK_SOURCE_DETAIL,
} from './helpers'

test.describe('Citation', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiRoutes(page)
    await page.goto('/')
    await uploadPdf(page)
    await sendChatMessage(page, 'How do I set up?')
  })

  test('citation badge is clickable', async ({ page }) => {
    // Find the [p.3, §Setup] citation button
    const citationBtn = page.getByRole('button', {
      name: /View source:.*p\.3.*Setup/,
    })
    await expect(citationBtn).toBeVisible()
    await expect(citationBtn).toBeEnabled()
  })

  test('citation popover shows source text', async ({ page }) => {
    // Click the citation badge
    const citationBtn = page.getByRole('button', {
      name: /View source:.*p\.3.*Setup/,
    })
    await citationBtn.click()

    // Popover should appear (role="tooltip")
    const popover = page.getByRole('tooltip')
    await expect(popover).toBeVisible({ timeout: 3000 })

    // Source text should be visible
    await expect(
      popover.getByText(MOCK_SOURCE_DETAIL.text, { exact: false }),
    ).toBeVisible({ timeout: 3000 })
  })

  test('citation popover shows page and section', async ({ page }) => {
    const citationBtn = page.getByRole('button', {
      name: /View source:.*p\.3.*Setup/,
    })
    await citationBtn.click()

    const popover = page.getByRole('tooltip')
    await expect(popover).toBeVisible({ timeout: 3000 })

    // Page number and section should be visible
    // Korean locale: "페이지 3" and "Setup"
    await expect(popover.getByText('3')).toBeVisible()
    await expect(popover.getByText('Setup')).toBeVisible()
  })

  test('citation popover closes on Escape', async ({ page }) => {
    const citationBtn = page.getByRole('button', {
      name: /View source:.*p\.3.*Setup/,
    })
    await citationBtn.click()

    const popover = page.getByRole('tooltip')
    await expect(popover).toBeVisible({ timeout: 3000 })

    // Press Escape
    await page.keyboard.press('Escape')
    await expect(popover).not.toBeVisible()
  })

  test('citation popover closes on outside click', async ({ page }) => {
    const citationBtn = page.getByRole('button', {
      name: /View source:.*p\.3.*Setup/,
    })
    await citationBtn.click()

    const popover = page.getByRole('tooltip')
    await expect(popover).toBeVisible({ timeout: 3000 })

    // Click somewhere else on the page (use the main content area)
    await page.getByRole('main').click({ position: { x: 10, y: 10 } })
    await expect(popover).not.toBeVisible()
  })
})
