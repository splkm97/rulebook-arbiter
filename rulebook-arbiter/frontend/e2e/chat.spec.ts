import { test, expect } from '@playwright/test'
import {
  mockAllApiRoutes,
  uploadPdf,
  sendChatMessage,
} from './helpers'

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiRoutes(page)
    await page.goto('/')
  })

  test('chat input disabled without session', async ({ page }) => {
    const textarea = page.locator('textarea')
    await expect(textarea).toBeDisabled()
  })

  test('chat input enabled after upload', async ({ page }) => {
    await uploadPdf(page)

    const textarea = page.locator('textarea')
    await expect(textarea).toBeEnabled()
  })

  test('send message and receive response', async ({ page }) => {
    await uploadPdf(page)

    const textarea = page.locator('textarea')
    await textarea.fill('How do I set up the game?')

    // Click send button
    await page.getByRole('button', { name: /보내기|send/i }).click()

    // User message should appear
    await expect(
      page.getByText('How do I set up the game?'),
    ).toBeVisible()

    // Assistant response should appear
    await expect(
      page.getByText('According to the rules', { exact: false }),
    ).toBeVisible({ timeout: 5000 })
  })

  test('send message via keyboard shortcut Ctrl+Enter', async ({ page }) => {
    await uploadPdf(page)

    const textarea = page.locator('textarea')
    await textarea.fill('What are the victory conditions?')

    // Use Ctrl+Enter to send
    await textarea.press('Control+Enter')

    // User message should appear
    await expect(
      page.getByText('What are the victory conditions?'),
    ).toBeVisible()

    // Assistant response should appear
    await expect(
      page.getByText('According to the rules', { exact: false }),
    ).toBeVisible({ timeout: 5000 })
  })

  test('typing indicator shown during response', async ({ page }) => {
    // Use a longer delay for this test so we can observe the indicator
    await page.route(
      (url) => url.pathname === '/api/chat',
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await route.fulfill({
          json: {
            answer: 'Test response',
            sources: [],
            model_used: 'gemini-3-flash-preview',
          },
        })
      },
    )

    await uploadPdf(page)

    const textarea = page.locator('textarea')
    await textarea.fill('Test question')
    await page.getByRole('button', { name: /보내기|send/i }).click()

    // Typing indicator should appear (has role="status" and aria-label)
    const typingIndicator = page.getByRole('status', {
      name: 'Assistant is typing',
    })
    await expect(typingIndicator).toBeVisible({ timeout: 2000 })

    // Wait for response, then indicator should disappear
    await expect(page.getByText('Test response')).toBeVisible({
      timeout: 5000,
    })
    await expect(typingIndicator).not.toBeVisible()
  })

  test('assistant response contains citations', async ({ page }) => {
    await uploadPdf(page)
    await sendChatMessage(page, 'How do I set up?')

    // Citation badges should be rendered as buttons
    const setupCitation = page.getByRole('button', {
      name: /View source:.*p\.3.*Setup/,
    })
    await expect(setupCitation).toBeVisible()

    const turnOrderCitation = page.getByRole('button', {
      name: /View source:.*p\.5.*Turn Order/,
    })
    await expect(turnOrderCitation).toBeVisible()
  })

  test('empty state shown when no messages', async ({ page }) => {
    // The empty state shows: "룰북을 업로드하고 질문을 시작하세요" (Korean)
    await expect(
      page.getByText(/룰북을 업로드하고|Upload a rulebook/),
    ).toBeVisible()
  })

  test('messages auto-scroll to bottom', async ({ page }) => {
    await uploadPdf(page)

    // Send multiple messages to fill the chat
    for (let i = 0; i < 3; i++) {
      const textarea = page.locator('textarea')
      await textarea.fill(`Question number ${i + 1}`)
      await page.getByRole('button', { name: /보내기|send/i }).click()

      // Wait for assistant response each time
      await expect(
        page.getByText('According to the rules', { exact: false }).nth(i),
      ).toBeVisible({ timeout: 5000 })
    }

    // The chat log container should be scrolled to the bottom
    const chatLog = page.getByRole('log')
    const isScrolledToBottom = await chatLog.evaluate((el) => {
      // Allow a small tolerance (5px) for rounding
      return Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 5
    })
    expect(isScrolledToBottom).toBe(true)
  })
})
