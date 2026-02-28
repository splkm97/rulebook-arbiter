/**
 * Demo Video Recording Script
 *
 * Records a 1-minute demo walkthrough of all 5 scenes from docs/demo-scenario.md.
 * Uses Playwright's built-in video capture with human-like interactions and
 * demo-specific mock API responses (Korean).
 *
 * Usage:
 *   npx playwright test e2e/demo-recording.spec.ts
 *
 * Output:
 *   ./demo-videos/<timestamp>.webm
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test'

// ---------------------------------------------------------------------------
// Demo-specific mock data (Korean, matching the demo scenario)
// ---------------------------------------------------------------------------

const DEMO_SESSION_ID = 'demo-session-001'
const DEMO_TITLE = '카탄 보드게임 룰북'

const DEMO_UPLOAD_RESPONSE = {
  session_id: DEMO_SESSION_ID,
  title: DEMO_TITLE,
  total_pages: 8,
  total_chunks: 16,
} as const

/** Scene 2 response — arbiter mode, formal tone with citations */
const DEMO_CHAT_RESPONSE_ARBITER = {
  answer:
    '게임 준비는 다음과 같습니다.\n\n' +
    '1. 게임 보드를 펼쳐 테이블 중앙에 놓습니다 [p.3, §게임 준비].\n' +
    '2. 지형 타일을 무작위로 배치하고, 숫자 토큰을 알파벳 순서대로 올려놓습니다 [p.3, §게임 준비].\n' +
    '3. 각 플레이어는 자신의 색상을 선택하고 해당 색의 건물과 도로를 가져갑니다 [p.4, §구성물].\n' +
    '4. 자원 카드를 종류별로 분류하여 보드 옆에 놓습니다.\n' +
    '5. 가장 나이가 어린 플레이어가 먼저 시작합니다 [p.5, §턴 순서].',
  sources: [
    {
      chunk_id: 'chunk-001',
      page: 3,
      section: '게임 준비',
      label: '[p.3, §게임 준비]',
      score: 0.95,
    },
    {
      chunk_id: 'chunk-002',
      page: 4,
      section: '구성물',
      label: '[p.4, §구성물]',
      score: 0.88,
    },
    {
      chunk_id: 'chunk-003',
      page: 5,
      section: '턴 순서',
      label: '[p.5, §턴 순서]',
      score: 0.82,
    },
  ],
  model_used: 'gemini-3-flash-preview',
} as const

/** Scene 4 response — learn mode, friendly beginner tone */
const DEMO_CHAT_RESPONSE_LEARN = {
  answer:
    '쉽게 설명해 드릴게요! 🎲\n\n' +
    '**1단계: 보드 깔기**\n' +
    '큰 판을 테이블에 펼치세요. 육각형 타일을 섞어서 빈칸에 채워 넣으면 매번 다른 맵이 만들어져요!\n\n' +
    '**2단계: 숫자 올리기**\n' +
    '알파벳이 적힌 숫자 칩을 A부터 순서대로 타일 위에 놓아주세요 [p.3, §게임 준비].\n\n' +
    '**3단계: 내 색깔 고르기**\n' +
    '좋아하는 색을 골라서 그 색의 집, 도시, 도로를 가져오세요 [p.4, §구성물].\n\n' +
    '**4단계: 자원 카드 준비**\n' +
    '나무, 벽돌, 밀, 양, 광석 카드를 종류별로 분류해서 보드 옆에 놓으면 끝!\n\n' +
    '> 💡 **다음에 알면 좋은 것:** 첫 번째 정착지를 어디에 놓느냐가 게임의 핵심이에요. ' +
    '자원이 다양하게 나오는 교차점을 노려보세요!',
  sources: [
    {
      chunk_id: 'chunk-001',
      page: 3,
      section: '게임 준비',
      label: '[p.3, §게임 준비]',
      score: 0.95,
    },
    {
      chunk_id: 'chunk-002',
      page: 4,
      section: '구성물',
      label: '[p.4, §구성물]',
      score: 0.88,
    },
  ],
  model_used: 'gemini-3-flash-preview',
} as const

const DEMO_SOURCE_DETAIL = {
  chunk_id: 'chunk-001',
  text: '게임 보드를 펼쳐 테이블 중앙에 놓습니다. 지형 타일(산, 언덕, 숲, 목초지, 밭, 사막)을 무작위로 배치합니다. 숫자 토큰을 알파벳 순서(A→R)대로 지형 타일 위에 올려놓습니다. 사막 타일에는 도적 말을 놓습니다.',
  page: 3,
  section: '게임 준비',
} as const

const DEMO_SETTINGS_RESPONSE = {
  model: 'gemini-3-flash-preview',
  available_models: ['gemini-3-flash-preview', 'gemini-3-pro-preview'],
  preset: 'arbiter',
  available_presets: ['learn', 'setup', 'arbiter'],
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isApiEndpoint(url: string): boolean {
  const path = new URL(url).pathname
  return path.startsWith('/api/')
}

/** Simulate human typing — visible character-by-character input */
async function humanType(page: Page, selector: string, text: string): Promise<void> {
  const el = page.locator(selector)
  await el.click()
  for (const char of text) {
    await el.pressSequentially(char, { delay: 0 })
    // Vary typing speed: 40-90ms per character
    await page.waitForTimeout(40 + Math.random() * 50)
  }
}

/** Track which chat request number we're on to vary responses */
let chatRequestCount = 0

/**
 * Register demo-specific mock routes with realistic delays.
 * - Upload: 3s processing simulation
 * - Chat: 1.5s "thinking" delay, response varies by request count
 * - Source: 0.5s fetch delay
 */
async function mockDemoApiRoutes(page: Page): Promise<void> {
  chatRequestCount = 0

  await page.route(
    (url) => isApiEndpoint(url.toString()) && url.pathname === '/api/health',
    (route) => route.fulfill({ json: { status: 'ok' } }),
  )

  // Upload — 3s processing delay
  await page.route(
    (url) => isApiEndpoint(url.toString()) && url.pathname === '/api/upload',
    async (route) => {
      await new Promise((r) => setTimeout(r, 3000))
      await route.fulfill({ json: DEMO_UPLOAD_RESPONSE })
    },
  )

  // Chat — 1.5s delay, alternate responses
  await page.route(
    (url) => isApiEndpoint(url.toString()) && url.pathname === '/api/chat',
    async (route) => {
      chatRequestCount++
      await new Promise((r) => setTimeout(r, 1500))
      const response =
        chatRequestCount === 1
          ? DEMO_CHAT_RESPONSE_ARBITER
          : DEMO_CHAT_RESPONSE_LEARN
      await route.fulfill({ json: response })
    },
  )

  // Sources — 0.5s delay
  await page.route(
    (url) =>
      isApiEndpoint(url.toString()) && url.pathname.startsWith('/api/sources/'),
    async (route) => {
      await new Promise((r) => setTimeout(r, 500))
      await route.fulfill({ json: DEMO_SOURCE_DETAIL })
    },
  )

  // Sessions
  await page.route(
    (url) =>
      isApiEndpoint(url.toString()) && url.pathname.startsWith('/api/sessions/'),
    (route) =>
      route.fulfill({
        json: {
          session_id: DEMO_SESSION_ID,
          title: DEMO_TITLE,
          total_pages: 8,
          total_chunks: 16,
          model: 'gemini-3-flash-preview',
          preset: 'arbiter',
          conversation: [],
        },
      }),
  )

  // Settings — GET and PUT
  await page.route(
    (url) =>
      isApiEndpoint(url.toString()) && url.pathname.startsWith('/api/settings'),
    (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: DEMO_SETTINGS_RESPONSE })
      }
      const body = route.request().postDataJSON() as Record<string, unknown>
      return route.fulfill({
        json: {
          ...DEMO_SETTINGS_RESPONSE,
          ...(body.model ? { model: body.model } : {}),
          ...(body.preset ? { preset: body.preset } : {}),
        },
      })
    },
  )
}

// ---------------------------------------------------------------------------
// Demo Recording
// ---------------------------------------------------------------------------

test.describe('Demo Recording', () => {
  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      recordVideo: {
        dir: './demo-videos/',
        size: { width: 1920, height: 1080 },
      },
      viewport: { width: 1920, height: 1080 },
      locale: 'ko-KR',
      colorScheme: 'light',
    })
    page = await context.newPage()
    await mockDemoApiRoutes(page)
  })

  test.afterAll(async () => {
    // Closing context finalizes the video file
    await context.close()
  })

  test('full demo walkthrough', async () => {
    // Increase timeout — demo takes ~60s plus buffer for delays
    test.setTimeout(120_000)

    // =================================================================
    // Scene 1 — Empty state + Rulebook upload (0:00 ~ 0:15)
    // =================================================================

    await page.goto('/')
    // Hold on empty state for 3 seconds so viewers see the initial screen
    await page.waitForTimeout(3000)

    // Click upload button in sidebar
    await page.getByRole('button', { name: /업로드|upload/i }).first().click()

    // Wait for modal
    const dialog = page.getByRole('dialog')
    await dialog.waitFor({ state: 'visible' })
    await page.waitForTimeout(800)

    // Upload a fake PDF (simulates drag-and-drop result)
    const pdfBuffer = Buffer.from('%PDF-1.4 demo rulebook content')
    const fileInput = dialog.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'catan-rulebook.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    })

    // Brief pause to show file preview
    await page.waitForTimeout(1000)

    // Click upload/confirm
    await dialog.getByRole('button', { name: /업로드|upload|confirm/i }).click()

    // Wait for processing (mock has 3s delay) — spinner visible
    await expect(dialog.getByRole('status')).toBeVisible({ timeout: 8000 })

    // Wait for modal auto-close
    await dialog.waitFor({ state: 'detached', timeout: 5000 })

    // Pause to show the sidebar now has session info
    await page.waitForTimeout(1500)

    // =================================================================
    // Scene 2 — Rule question + cited answer (0:15 ~ 0:35)
    // =================================================================

    // Type question character by character for visual effect
    await humanType(page, 'textarea', '게임 준비는 어떻게 하나요?')
    await page.waitForTimeout(500)

    // Send via button click
    await page.getByRole('button', { name: /보내기|send/i }).click()

    // Wait for typing indicator to appear
    const typingIndicator = page.getByRole('status', {
      name: 'Assistant is typing',
    })
    await expect(typingIndicator).toBeVisible({ timeout: 3000 })

    // Wait for response (mock has 1.5s delay)
    await expect(
      page.getByText('게임 준비는 다음과 같습니다', { exact: false }),
    ).toBeVisible({ timeout: 8000 })

    // Pause to let the viewer read the response
    await page.waitForTimeout(3000)

    // =================================================================
    // Scene 3 — Citation source verification (0:35 ~ 0:45)
    // =================================================================

    // Click the first citation badge [p.3, §게임 준비]
    const citationBtn = page
      .getByRole('button', { name: /View source:.*p\.3.*게임 준비/ })
      .first()
    await expect(citationBtn).toBeVisible()
    await citationBtn.click()

    // Wait for popover with source text (mock has 0.5s delay)
    const popover = page.getByRole('tooltip')
    await expect(popover).toBeVisible({ timeout: 5000 })
    await expect(
      popover.getByText(DEMO_SOURCE_DETAIL.text, { exact: false }),
    ).toBeVisible({ timeout: 3000 })

    // Pause so viewer can read the original source text
    await page.waitForTimeout(3000)

    // Close popover via Escape
    await page.keyboard.press('Escape')
    await expect(popover).not.toBeVisible()
    await page.waitForTimeout(500)

    // =================================================================
    // Scene 4 — Preset switch + tone difference (0:45 ~ 0:55)
    // =================================================================

    // Click the "게임 배우기" (Learn) preset chip
    const learnChip = page.getByRole('button', {
      name: /게임 배우기|Learn Game/i,
    })
    await expect(learnChip).toBeVisible()
    await learnChip.click()

    // Wait for aria-pressed to update
    await expect(learnChip).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(800)

    // Type follow-up question
    await humanType(page, 'textarea', '좀 더 쉽게 설명해줘')
    await page.waitForTimeout(500)

    // Send
    await page.getByRole('button', { name: /보내기|send/i }).click()

    // Wait for the learn-mode response
    await expect(
      page.getByText('쉽게 설명해 드릴게요', { exact: false }),
    ).toBeVisible({ timeout: 8000 })

    // Pause to let the viewer see the friendly, step-by-step tone
    await page.waitForTimeout(3000)

    // =================================================================
    // Scene 5 — Language toggle (0:55 ~ 1:00)
    // =================================================================

    // Click language toggle (Korean → English)
    const langToggle = page.getByRole('button', { name: /Switch language/i })
    await expect(langToggle).toBeVisible()
    await langToggle.click()

    // Verify UI switched to English
    await expect(
      page.getByRole('heading', { name: 'Rulebook Arbiter' }).first(),
    ).toBeVisible()

    // Final pause — full English UI visible with conversation history
    await page.waitForTimeout(3000)
  })
})
