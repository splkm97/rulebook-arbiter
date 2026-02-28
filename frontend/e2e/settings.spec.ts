import { test, expect } from '@playwright/test'
import { mockAllApiRoutes, uploadPdf } from './helpers'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiRoutes(page)
    await page.goto('/')
    await uploadPdf(page)
  })

  test('model selector shows available models', async ({ page }) => {
    // Two Header instances exist (mobile + desktop); scope to the visible one
    const select = page.locator('#model-selector >> visible=true')
    await expect(select).toBeVisible()

    // Should have both model options
    const options = select.locator('option')
    await expect(options).toHaveCount(2)
    await expect(options.nth(0)).toHaveText('gemini-3-flash-preview')
    await expect(options.nth(1)).toHaveText('gemini-3-pro-preview')
  })

  test('model selector changes model', async ({ page }) => {
    const select = page.locator('#model-selector >> visible=true')

    // Track the PUT request
    const putPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/api/settings') && req.method() === 'PUT',
    )

    // Select a different model
    await select.selectOption('gemini-3-pro-preview')

    // Verify the PUT request was sent
    const putRequest = await putPromise
    const body = putRequest.postDataJSON()
    expect(body).toEqual({ model: 'gemini-3-pro-preview' })
  })

  test('language toggle switches to English', async ({ page }) => {
    // Default is Korean. The toggle button shows "EN" (to switch to English)
    const toggleBtn = page.getByRole('button', {
      name: /Switch language/i,
    })
    await expect(toggleBtn).toBeVisible()
    await expect(toggleBtn).toHaveText('EN')

    // Click to switch to English
    await toggleBtn.click()

    // Now the button should show "한국어" (to switch back to Korean)
    await expect(toggleBtn).toHaveText('한국어')

    // Verify a UI label changed to English
    // The header title should now be "Rulebook Arbiter" — use first() since
    // the layout renders two Header components (mobile + desktop)
    await expect(
      page.getByRole('heading', { name: 'Rulebook Arbiter' }).first(),
    ).toBeVisible()
  })

  test('language toggle switches back to Korean', async ({ page }) => {
    const toggleBtn = page.getByRole('button', {
      name: /Switch language/i,
    })

    // Switch to English
    await toggleBtn.click()
    await expect(toggleBtn).toHaveText('한국어')

    // Switch back to Korean
    await toggleBtn.click()
    await expect(toggleBtn).toHaveText('EN')

    // Header title should be Korean again — use first() for same reason
    await expect(
      page.getByRole('heading', { name: '룰북 심판관' }).first(),
    ).toBeVisible()
  })
})
