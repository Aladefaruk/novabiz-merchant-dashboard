import { expect, test } from '@playwright/test';

test('merchant sends money: optimistic update, idempotency key, exact debit', async ({ page }) => {
  // Fixed latency and no random live payments, so the balance is predictable.
  await page.goto('/?mock.latency=300&mock.live=0');
  const balance = page.getByTestId('available-balance');
  await expect(balance).toHaveText('₦2,486,350.75'); // seeded balance

  // Step 1: recipient (name enquiry must resolve before continuing)
  await page.getByLabel('Bank').selectOption('058');
  await page.getByLabel('Account number').fill('0123456789');
  await expect(page.getByTestId('resolved-name')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2: amount
  await page.getByLabel('Amount (₦)').fill('2500');
  await page.getByRole('button', { name: 'Review transfer' }).click();

  // Step 3: review
  await page.getByRole('button', { name: 'Continue to confirm' }).click();

  // Step 4: confirm with PIN using the keyboard; focus was moved to the step heading.
  await expect(page.getByRole('heading', { name: 'Confirm with your PIN' })).toBeFocused();
  await page.getByLabel('Transaction PIN').fill('1234');
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.url().includes('/api/transfers')),
    page.getByLabel('Transaction PIN').press('Enter'),
  ]);
  expect(request.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);

  // Optimistic: balance drops and a "Processing" row appears before the server answers.
  await expect(page.getByTestId('optimistic-row')).toBeVisible();
  await expect(balance).toHaveText('₦2,483,840.00'); // − ₦2,500.00 − ₦10.75 fee

  // Server confirms: the pending row is replaced by the real transaction.
  await expect(page.getByRole('heading', { name: 'Transfer successful' })).toBeVisible();
  await expect(page.getByTestId('optimistic-row')).toHaveCount(0);
  await expect(page.getByRole('feed').getByRole('article').first()).toContainText('₦2,500.00');
  await expect(balance).toHaveText('₦2,483,840.00');
});
