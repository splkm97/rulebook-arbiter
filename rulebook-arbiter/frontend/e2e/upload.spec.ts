import { test, expect } from '@playwright/test'
import { mockAllApiRoutes, uploadPdf, MOCK_TITLE } from './helpers'

test.describe('Upload', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiRoutes(page)
    await page.goto('/')
  })

  test('upload modal opens and closes via Escape', async ({ page }) => {
    // Click the upload button in the sidebar
    await page
      .getByRole('button', { name: /업로드|upload/i })
      .first()
      .click()

    // Modal should be visible
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Press Escape to close
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('upload PDF successfully', async ({ page }) => {
    await uploadPdf(page)

    // After modal auto-closes, the sidebar (complementary) should show session info
    const sidebar = page.getByRole('complementary')
    await expect(sidebar.getByText(MOCK_TITLE)).toBeVisible({ timeout: 3000 })
  })

  test('upload shows error for rejected file', async ({ page }) => {
    // Override the upload route to return an error
    await page.route(
      (url) => url.pathname === '/api/upload',
      (route) =>
        route.fulfill({
          status: 400,
          json: { error: 'Invalid file type' },
        }),
    )

    // Open the modal
    await page
      .getByRole('button', { name: /업로드|upload/i })
      .first()
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Upload a fake PDF (the mock will reject it)
    const buffer = Buffer.from('%PDF-1.4 fake content')
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'bad-file.pdf',
      mimeType: 'application/pdf',
      buffer,
    })

    // Click upload
    await dialog
      .getByRole('button', { name: /업로드|upload|confirm/i })
      .click()

    // Error alert should be visible
    await expect(dialog.getByRole('alert')).toBeVisible({ timeout: 5000 })
  })

  test('header shows rulebook title after upload', async ({ page }) => {
    // Before upload, title should not be present in the banner
    const banner = page.getByRole('banner')
    await expect(banner.getByText(MOCK_TITLE)).not.toBeVisible()

    await uploadPdf(page)

    // The header (banner role) shows the title in a badge
    await expect(banner.getByText(MOCK_TITLE).first()).toBeVisible()
  })

  test('sidebar shows document stats after upload', async ({ page }) => {
    await uploadPdf(page)

    // Sidebar (complementary) should show pages and chunks
    const sidebar = page.getByRole('complementary')
    await expect(sidebar.getByText('12')).toBeVisible()
    await expect(sidebar.getByText('24')).toBeVisible()
  })
})
