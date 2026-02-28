import { test, expect } from '@playwright/test'
import {
  mockAllApiRoutes,
  uploadPdf,
  sendChatMessage,
  MOCK_TITLE,
} from './helpers'

test.describe('Session', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiRoutes(page)
    await page.goto('/')
  })

  test('initial state shows upload prompt', async ({ page }) => {
    // Sidebar should show the upload button
    const sidebar = page.getByRole('complementary')
    const uploadBtn = sidebar.getByRole('button', {
      name: /업로드|upload/i,
    })
    await expect(uploadBtn).toBeVisible()

    // No session info should be visible in the sidebar
    await expect(sidebar.getByText(MOCK_TITLE)).not.toBeVisible()

    // The sidebar empty hint should be visible (scoped to sidebar to avoid
    // the duplicate in the chat empty state)
    await expect(
      sidebar.getByText(/사이드바에서|Upload a PDF rulebook from the sidebar/),
    ).toBeVisible()
  })

  test('new session clears chat messages and session info', async ({
    page,
  }) => {
    const sidebar = page.getByRole('complementary')

    // Upload and send a message
    await uploadPdf(page)
    await sendChatMessage(page, 'Test question')

    // Verify session info is showing in the sidebar
    await expect(sidebar.getByText(MOCK_TITLE)).toBeVisible()

    // Verify chat message is visible
    await expect(page.getByText('Test question')).toBeVisible()

    // Click "New Session" button (Korean: "새 세션")
    await page
      .getByRole('button', { name: /새 세션|New Session/i })
      .click()

    // Session info should be cleared from sidebar
    await expect(sidebar.getByText(MOCK_TITLE)).not.toBeVisible()

    // Chat messages should be cleared -- empty state should return
    // (scoped to main to avoid duplicate with sidebar)
    await expect(
      page
        .getByRole('main')
        .getByText(/룰북을 업로드하고|Upload a rulebook/),
    ).toBeVisible()

    // The user message should no longer be visible
    await expect(page.getByText('Test question')).not.toBeVisible()
  })

  test('can upload new document after clearing session', async ({ page }) => {
    const sidebar = page.getByRole('complementary')

    // Upload first document
    await uploadPdf(page)
    await expect(sidebar.getByText(MOCK_TITLE)).toBeVisible()

    // Clear session
    await page
      .getByRole('button', { name: /새 세션|New Session/i })
      .click()
    await expect(sidebar.getByText(MOCK_TITLE)).not.toBeVisible()

    // Upload again
    await uploadPdf(page)

    // New session should be established
    await expect(sidebar.getByText(MOCK_TITLE)).toBeVisible()
  })
})
