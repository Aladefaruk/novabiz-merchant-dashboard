import { expect, test, type Page } from '@playwright/test';

/** Parse "₦1,234,567.89" from the balance card into integer kobo (string math, no floats). */
async function readBalanceKobo(page: Page): Promise<number> {
  const text = (await page.getByTestId('available-balance').locator('[aria-hidden="true"]').first().textContent()) ?? '';
  const match = /₦([\d,]+)\.(\d{2})/.exec(text);
  if (!match) throw new Error(`Unparseable balance: ${text}`);
  return Number(match[1]!.replace(/,/g, '')) * 100 + Number(match[2]);
}

async function openApp(page: Page) {
  // Fixed latency + no random live inflows => deterministic balances.
  await page.goto('/?mock.latency=300&mock.live=0&mock.fail=0&mock.lost=0');
  await expect(page.getByTestId('available-balance')).toBeVisible();
}

async function fillRecipientAndAmount(page: Page, amount = '2500') {
  const sendCard = page.locator('section.send');
  await expect(sendCard.getByRole('option', { name: 'Guaranty Trust Bank' })).toBeAttached();
  await sendCard.getByLabel(/^bank/i).selectOption('058');
  await sendCard.getByLabel(/account number/i).fill('0123456789');
  await expect(sendCard.getByTestId('resolved-name')).toBeVisible();
  // Keyboard: Enter submits each step's form.
  await sendCard.getByLabel(/account number/i).press('Enter');

  const amountInput = sendCard.getByLabel(/amount/i);
  await expect(amountInput).toBeVisible();
  await amountInput.fill(amount);
  await amountInput.press('Enter');

  await sendCard.getByRole('button', { name: /continue to confirm/i }).click();
  await expect(sendCard.getByLabel(/transaction pin/i)).toBeVisible();
}

test.describe('Send Money', () => {
  test('happy path: keyboard-operable, debits amount + fee exactly once, appears in the feed', async ({ page }) => {
    await openApp(page);
    const start = await readBalanceKobo(page);

    await fillRecipientAndAmount(page, '2500');
    // Focus is moved to each step heading for keyboard / screen-reader users.
    await expect(page.getByRole('heading', { name: /confirm with your pin/i })).toBeFocused();

    const pin = page.getByLabel(/transaction pin/i);
    await pin.fill('1234');
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/api/transfers') && r.method() === 'POST'),
      pin.press('Enter'),
    ]);
    expect(request.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);

    // Optimistic UI: "Processing" row + reduced balance before the server answers.
    await expect(page.getByTestId('optimistic-row')).toBeVisible();

    await expect(page.getByRole('heading', { name: /transfer successful/i })).toBeVisible();
    await expect(page.getByTestId('optimistic-row')).toHaveCount(0);
    await expect.poll(() => readBalanceKobo(page)).toBe(start - 2_500_00 - 10_75);
    await expect(page.getByRole('feed').getByRole('article').first()).toContainText(/sent to/i);
  });

  test('server failure after the UI showed the transfer: rolls back and explains', async ({ page }) => {
    await openApp(page);
    const start = await readBalanceKobo(page);
    await fillRecipientAndAmount(page, '1000');

    // Break the network only for the submit.
    await page.getByRole('button', { name: /mock api controls/i }).click();
    await page.getByLabel(/failure rate/i).fill('1');

    await page.getByLabel(/transaction pin/i).fill('1234');
    await page.getByLabel(/transaction pin/i).press('Enter');

    await expect(page.getByTestId('optimistic-row')).toBeVisible();
    await expect.poll(() => readBalanceKobo(page)).toBe(start - 1_000_00 - 10_75);

    await expect(page.getByRole('heading', { name: /couldn’t confirm this transfer/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('optimistic-row')).toHaveCount(0);
    await expect.poll(() => readBalanceKobo(page)).toBe(start);
    await expect(page.getByTestId('committed-count')).toHaveText('0');

    // Recovery: network back, retry with the same reference succeeds once.
    await page.getByLabel(/failure rate/i).fill('0');
    await page.getByRole('button', { name: /check & retry/i }).click();
    await expect(page.getByRole('heading', { name: /transfer successful/i })).toBeVisible();
    await expect(page.getByTestId('committed-count')).toHaveText('1');
  });

  test('response lost after commit: retried with the same key, debited exactly once', async ({ page }) => {
    await openApp(page);
    const start = await readBalanceKobo(page);
    await page.getByRole('button', { name: /mock api controls/i }).click();
    await page.getByLabel(/lost response/i).fill('1');

    await fillRecipientAndAmount(page, '1000');
    const keys: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/transfers')) keys.push(r.headers()['idempotency-key'] ?? '');
    });
    await page.getByLabel(/transaction pin/i).fill('1234');
    await page.getByLabel(/transaction pin/i).press('Enter');

    await expect(page.getByRole('heading', { name: /transfer successful/i })).toBeVisible({ timeout: 20_000 });
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(new Set(keys).size).toBe(1);
    await expect(page.getByTestId('committed-count')).toHaveText('1');
    await expect.poll(() => readBalanceKobo(page)).toBe(start - 1_000_00 - 10_75);
  });
});

test('layout has no horizontal scroll at this viewport', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('feed')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
