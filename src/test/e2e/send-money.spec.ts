import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Seeded mock data: the merchant always starts with this balance.
const START = '₦2,486,350.75';

/** Open the app with fixed latency and no random live payments, so balances are predictable. */
async function openApp(page: Page) {
  await page.goto('/?mock.latency=300&mock.live=0');
  await expect(page.getByTestId('available-balance')).toHaveText(START);
}

/** Recipient → Amount → Review → Confirm, stopping at the PIN field. */
async function fillTransfer(page: Page, amount: string) {
  await page.getByLabel('Bank').selectOption('058');
  await page.getByLabel('Account number').fill('0123456789');
  await expect(page.getByTestId('resolved-name')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Amount (₦)').fill(amount);
  await page.getByRole('button', { name: 'Review transfer' }).click();
  await page.getByRole('button', { name: 'Continue to confirm' }).click();
  await page.getByLabel('Transaction PIN').fill('1234');
}

/** Open the Mock API panel and set one of its sliders (0–1). */
async function setMock(page: Page, slider: RegExp, value: string) {
  const toggle = page.getByRole('button', { name: 'Mock API controls', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await page.getByLabel(slider).fill(value);
}

test('happy path: optimistic update, idempotency key, exact debit', async ({ page }) => {
  await openApp(page);
  await fillTransfer(page, '2500');

  const [request] = await Promise.all([
    page.waitForRequest((r) => r.url().includes('/api/transfers')),
    page.getByLabel('Transaction PIN').press('Enter'),
  ]);
  expect(request.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);

  // Optimistic: balance drops and a "Processing" row appears before the server answers.
  await expect(page.getByTestId('optimistic-row')).toBeVisible();
  await expect(page.getByTestId('available-balance')).toHaveText('₦2,483,840.00'); // − ₦2,500 − ₦10.75 fee

  // Server confirms: the pending row is replaced by the real transaction.
  await expect(page.getByRole('heading', { name: 'Transfer successful' })).toBeVisible();
  await expect(page.getByTestId('optimistic-row')).toHaveCount(0);
  await expect(page.getByRole('feed').getByRole('article').first()).toContainText('₦2,500.00');
  await expect(page.getByTestId('available-balance')).toHaveText('₦2,483,840.00');
});

test('server failure after the UI showed "sending": rolls back, then a retry succeeds once', async ({ page }) => {
  await openApp(page);
  await fillTransfer(page, '1000');
  await setMock(page, /Failure rate/, '1');

  await page.getByRole('button', { name: 'Send ₦1,000.00' }).click();
  await expect(page.getByTestId('optimistic-row')).toBeVisible();

  // After 3 attempts it gives up and rolls back to the server's balance.
  await expect(page.getByRole('heading', { name: 'We couldn’t confirm this transfer' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('optimistic-row')).toHaveCount(0);
  await expect(page.getByTestId('available-balance')).toHaveText(START);
  await expect(page.getByTestId('committed-count')).toHaveText('0');

  // Network recovers: "Try again" reuses the same key and the transfer goes through exactly once.
  await setMock(page, /Failure rate/, '0');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Transfer successful' })).toBeVisible();
  await expect(page.getByTestId('committed-count')).toHaveText('1');
});

test('server commits but the response is lost: retried with the same key, debited once', async ({ page }) => {
  await openApp(page);
  await setMock(page, /Lost response/, '1');
  await fillTransfer(page, '1000');

  const keys: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/transfers')) keys.push(r.headers()['idempotency-key'] ?? '');
  });
  await page.getByRole('button', { name: 'Send ₦1,000.00' }).click();

  await expect(page.getByRole('heading', { name: 'Transfer successful' })).toBeVisible({ timeout: 15_000 });
  expect(keys.length).toBeGreaterThanOrEqual(2); // original + retry
  expect(new Set(keys).size).toBe(1); // ...all with the same key
  await expect(page.getByTestId('committed-count')).toHaveText('1');
  await expect(page.getByTestId('available-balance')).toHaveText('₦2,485,340.00'); // − ₦1,000 − ₦10.75, once
});

test('double-clicking Send only sends one request', async ({ page }) => {
  await openApp(page);
  await fillTransfer(page, '1000');

  let requests = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/transfers')) requests++;
  });
  await page.getByRole('button', { name: 'Send ₦1,000.00' }).dblclick();

  await expect(page.getByRole('heading', { name: 'Transfer successful' })).toBeVisible();
  expect(requests).toBe(1);
});

test.describe('on a 360px phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  test('keyboard-only transfer, no horizontal scroll, no WCAG AA violations', async ({ page }) => {
    await openApp(page);

    // Layout fits the screen.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);

    // Automated accessibility scan (WCAG 2.0/2.1 A + AA rules).
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(scan.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    // Whole flow with the keyboard only: Tab to move, type to select, Enter to press.
    await page.getByLabel('Bank').focus();
    await page.keyboard.press('g'); // jumps to "Guaranty Trust Bank"
    await page.keyboard.press('Tab');
    await page.keyboard.type('0123456789');
    await expect(page.getByTestId('resolved-name')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused();
    await page.keyboard.press('Enter');

    // Each step moves focus to its heading.
    await expect(page.getByRole('heading', { name: /How much are you sending/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.type('500');
    await page.keyboard.press('Tab'); // narration
    await page.keyboard.press('Tab'); // Back
    await page.keyboard.press('Tab'); // Review transfer
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Review your transfer' })).toBeFocused();
    await page.keyboard.press('Tab'); // Back
    await page.keyboard.press('Tab'); // Continue to confirm
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Confirm with your PIN' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.type('1234');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Transfer successful' })).toBeVisible();
  });
});
