import { type Page, expect } from '@playwright/test'

export const MOCK_SESSION_ID = 'test-session-abc123'
export const MOCK_TITLE = 'Catan Board Game Rules'

export const MOCK_UPLOAD_RESPONSE = {
  session_id: MOCK_SESSION_ID,
  title: MOCK_TITLE,
  total_pages: 12,
  total_chunks: 24,
} as const

export const MOCK_CHAT_RESPONSE = {
  answer:
    'According to the rules [p.3, §Setup], each player places their initial settlements at the intersection of three terrain hexes. The youngest player [p.5, §Turn Order] goes first.',
  sources: [
    {
      chunk_id: 'chunk-001',
      page: 3,
      section: 'Setup',
      label: '[p.3, §Setup]',
      score: 0.92,
    },
    {
      chunk_id: 'chunk-002',
      page: 5,
      section: 'Turn Order',
      label: '[p.5, §Turn Order]',
      score: 0.85,
    },
  ],
  model_used: 'gemini-3-flash-preview',
} as const

export const MOCK_SOURCE_DETAIL = {
  chunk_id: 'chunk-001',
  text: 'Each player places 2 settlements and 2 roads on the board. Settlements must be placed at intersections of terrain hexes. Roads connect settlements along hex edges.',
  page: 3,
  section: 'Setup',
} as const

export const MOCK_SETTINGS_RESPONSE = {
  model: 'gemini-3-flash-preview',
  available_models: ['gemini-3-flash-preview', 'gemini-3-pro-preview'],
  preset: 'arbiter',
  available_presets: ['learn', 'setup', 'arbiter'],
} as const

/**
 * Check whether a request URL is an actual /api/ endpoint call
 * (not a Vite dev-server module like /src/api/settings.ts).
 */
function isApiEndpoint(url: string): boolean {
  const path = new URL(url).pathname
  return path.startsWith('/api/')
}

/**
 * Intercept all /api/* routes with deterministic mock responses.
 * Must be called before page.goto() so routes are registered before
 * the app makes any requests.
 *
 * Uses URL-checking callbacks rather than plain globs to avoid
 * collisions with Vite dev-server module paths like /src/api/settings.ts.
 */
export async function mockAllApiRoutes(page: Page): Promise<void> {
  // Health — GET /api/health
  await page.route(
    (url) => isApiEndpoint(url.toString()) && url.pathname === '/api/health',
    (route) => route.fulfill({ json: { status: 'ok' } }),
  )

  // Upload — POST /api/upload
  await page.route(
    (url) => isApiEndpoint(url.toString()) && url.pathname === '/api/upload',
    (route) => route.fulfill({ json: MOCK_UPLOAD_RESPONSE }),
  )

  // Chat — POST /api/chat (slight delay to test loading state)
  await page.route(
    (url) => isApiEndpoint(url.toString()) && url.pathname === '/api/chat',
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      await route.fulfill({ json: MOCK_CHAT_RESPONSE })
    },
  )

  // Sources — GET /api/sources/:chunkId
  await page.route(
    (url) =>
      isApiEndpoint(url.toString()) && url.pathname.startsWith('/api/sources/'),
    (route) => route.fulfill({ json: MOCK_SOURCE_DETAIL }),
  )

  // Sessions — GET /api/sessions/:sessionId
  await page.route(
    (url) =>
      isApiEndpoint(url.toString()) &&
      url.pathname.startsWith('/api/sessions/'),
    (route) =>
      route.fulfill({
        json: {
          session_id: MOCK_SESSION_ID,
          title: MOCK_TITLE,
          total_pages: 12,
          total_chunks: 24,
          model: 'gemini-3-flash-preview',
          preset: 'arbiter',
          conversation: [],
        },
      }),
  )

  // Settings — GET and PUT /api/settings
  await page.route(
    (url) =>
      isApiEndpoint(url.toString()) &&
      url.pathname.startsWith('/api/settings'),
    (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: MOCK_SETTINGS_RESPONSE })
      }
      // PUT returns the updated settings
      const body = route.request().postDataJSON() as Record<string, unknown>
      return route.fulfill({
        json: {
          ...MOCK_SETTINGS_RESPONSE,
          ...(body.model ? { model: body.model } : {}),
          ...(body.preset ? { preset: body.preset } : {}),
        },
      })
    },
  )
}

/**
 * Upload a fake PDF to establish a session.
 *
 * Uses the dropzone's hidden file input via setInputFiles and
 * clicks the confirm button. Waits for the modal to auto-close
 * on success (600ms timer in the component).
 */
export async function uploadPdf(page: Page): Promise<void> {
  // Click the upload button in the sidebar (Korean: "룰북 업로드")
  await page.getByRole('button', { name: /업로드|upload/i }).first().click()

  // Wait for the dialog to appear
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })

  // Set a fake PDF on the hidden file input inside the dropzone
  const buffer = Buffer.from('%PDF-1.4 fake content for testing')
  const fileInput = dialog.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'test-rulebook.pdf',
    mimeType: 'application/pdf',
    buffer,
  })

  // Wait for the file name to appear (confirms selection registered)
  await expect(dialog.getByText('test-rulebook.pdf')).toBeVisible()

  // Click the upload/confirm button inside the modal (Korean: "업로드")
  await dialog.getByRole('button', { name: /업로드|upload|confirm/i }).click()

  // Wait for the success message ("Upload complete") to appear
  await expect(dialog.getByRole('status')).toBeVisible({ timeout: 5000 })

  // Wait for auto-close (component uses 600ms timer)
  await dialog.waitFor({ state: 'detached', timeout: 3000 })
}

/**
 * Send a chat message and wait for the assistant response to appear.
 */
export async function sendChatMessage(
  page: Page,
  message: string,
): Promise<void> {
  // The textarea aria-label is the chat placeholder translation
  const textarea = page.locator('textarea')
  await textarea.fill(message)

  // Click the send button (Korean: "보내기")
  await page.getByRole('button', { name: /보내기|send/i }).click()

  // Wait for the assistant response to appear in the chat log
  await expect(
    page.getByText('According to the rules', { exact: false }),
  ).toBeVisible({ timeout: 5000 })
}
