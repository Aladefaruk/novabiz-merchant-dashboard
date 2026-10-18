# NovaBiz Merchant Dashboard

A dashboard for small merchants on **FirstBank NovaPay → NovaBiz**. It shows the live balance and today's money in and out, a transaction feed of 1,250+ rows, and a 4-step **Send Money** flow. The optimistic update rolls back correctly when the network fails, and the transfer can't be sent twice.

```bash
npm install && npm run dev        # http://localhost:5173
npm test                          # Vitest + React Testing Library (against the mock API)
npx playwright install chromium   # first time only
npm run test:e2e                  # Playwright: the Send Money flow end to end
```

**Stack:** React 18 + TypeScript · Vite · Tailwind CSS v4 · TanStack Query (server state) · TanStack Virtual (feed) · react-hook-form + zod (Send Money form) · lucide-react (icons) · MSW (mock API) · Vitest + RTL · Playwright

## Demo in 2 minutes

1. Send ₦1,000 to **GTBank `0123456789`** with demo PIN **`1234`**. The balance drops and a *Processing* row appears immediately, then the server confirms.
2. Open **Mock API** (header), set **Failure rate = 100%**, and send again. The app retries 3 times with the same key, then rolls back to the server's balance and explains what happened.
3. Set **Lost response = 100%** and send. The server commits but the reply is dropped. The automatic retry sends the same `Idempotency-Key`, the server replays its result, and the merchant is debited **once** (see the "Server committed" counter).

Accounts ending in `0000` return "account not found".

## Key decisions

**State: TanStack Query plus local state, no Redux or Zustand.** Almost all state here is server state (balance, transactions, banks). TanStack Query gives caching, retries with backoff, infinite scroll and mutation hooks out of the box. The Send Money form uses `react-hook-form` with a `zod` schema. Theme is a small hook with `localStorage`. Nothing else is global, so a store would only add a second copy of server data.

**Money is integer kobo everywhere** (`src/lib/money.ts`).
- **Display:** `formatNaira` builds an exact decimal string (`100050 → "1000.50"`) with integer maths and passes it to `Intl.NumberFormat('en-NG', { currency: 'NGN' })`. No float ever exists.
- **Input:** `parseNairaInput` uses string maths, because `parseFloat("19.99") * 100` is `1998.9999999999998`.
- **Type safety:** a branded `Kobo` type stops a raw float being passed by accident.

**Optimistic update that can't corrupt the balance** (`src/hooks/useTransfer.ts`).
- The usual recipe (snapshot the cache, restore it on error) is wrong for a merchant. If a customer pays *during* the transfer, restoring the snapshot erases that payment.
- Instead, in-flight transfers go into an "outbox", and **displayed balance = server balance − pending transfers**. The server's cached balance is never edited optimistically.
- **On a 4xx** (definite rejection), the outbox entry is removed.
- **On a timeout, network error or 5xx**, we don't know whether money moved. The app fetches the server balance *first*, then removes the entry, so it always ends on server truth.
- Balance polling pauses while a transfer is in flight.

**Idempotency.**
- One `crypto.randomUUID()` key per transfer *intent* (recipient + amount + narration), created when the merchant reaches Confirm.
- Every retry reuses it: automatic retries, the "Try again" button, and a wrong PIN corrected afterwards. If the merchant edits the transfer, a new key is made.
- The mock server enforces real idempotency rules. The same key replays the original result, and the same key with a different payload is rejected.
- That's what makes it safe to retry a POST at all. 4xx errors are never retried.

**Feed performance.**
- `useWindowVirtualizer` keeps about 20 rows in the DOM no matter how many are loaded.
- Rows are `memo`ised with a fixed 76px height.
- Keyset (cursor) pagination, so new payments arriving at the top don't shift pages.
- "Refresh" and post-transfer syncs refetch only the first page, not every loaded page.

**Async states.** Every fetch has loading (skeleton), empty and error-with-retry states. Two details:
- A failed *next page* keeps the rows already loaded. In TanStack Query v5 that case also sets `isError`.
- A failed background balance refresh keeps the last balance on screen with a note, instead of an error screen.

**Accessibility (WCAG AA).**
- The Send Money flow is keyboard-operable, and focus moves to each step's heading.
- Visible focus rings; every field has a label, with errors linked via `aria-describedby` and `aria-invalid`.
- Live regions for the name-enquiry result, step changes and transfer status.
- The feed uses the ARIA `feed` pattern.
- Status badges use text and an icon, never colour alone.

**Responsive.** Mobile-first Tailwind from 360px to 1440px. Send Money becomes a sticky right column from `lg`.

**Untrusted text.** Descriptions and names are rendered only as React text, never as HTML. `toSafeDisplayText` also strips invisible and bidi-override characters, which could make a description *look* like a different amount. The seeded data includes `<img onerror>` and `<script>` payloads to prove they render inert.

**Nigerian context.**
- **NIP fees:** CBN tiers incl. VAT (₦10.75, ₦26.88 or ₦53.75), shown before confirming and included in the balance check.
- **Name enquiry first:** the recipient's name comes from the bank and can't be typed in.
- **Lagos time:** "today" is the Africa/Lagos day.
- **NDPA data minimisation:** account numbers are masked to the last 4 digits.
- **USSD fallback:** *894# is suggested when offline or after a failure.

## Assumptions

- The merchant is KYC Tier 3, with transfers of ₦100–₦5,000,000 each.
- The PIN is a 4-digit demo PIN, sent as plain JSON only because the backend is a mock. In production it would be encrypted or replaced by device binding.
- NIP is synchronous, so a committed transfer is successful immediately.
- The mock ledger lives in page memory, so a refresh resets the data.

## Trade-offs and next steps

- **Kept deliberately small** so every line can be explained. No Storybook, no router (it's a single screen), and a small test suite focused on the money flow.
- **Live inflows use polling** (every 15s). In production I'd push events over SSE.
- **Next:**
  - A transaction detail and receipt view.
  - Saved beneficiaries.
  - Transfer status lookup by reference after a timeout.

## Tests

- `src/lib/money.test.ts`: formatting and parsing, including the float-drift cases.
- `src/features/send-money/SendMoney.test.tsx`: full app against the mock API.
  - Happy path with the `Idempotency-Key`.
  - Optimistic row, then rollback.
  - A network failure reconciles to server truth and *keeps a payment that arrived meanwhile*.
  - A lost response is retried with the same key and debited exactly once.
- `src/features/transactions/TransactionFeed.test.tsx`: newest first and virtualized, hostile text renders inert, error state retry works.
- `e2e/send-money.spec.ts`: real browser (Playwright), 5 tests.
  1. Happy path: optimistic row, idempotency header, exact debit.
  2. Server failure after the UI showed "sending": rolls back to the server balance, then "Try again" succeeds exactly once.
  3. Server commits but the response is lost: retried with the same key, debited once.
  4. Double-clicking Send sends only one request.
  5. On a 360px phone: the whole flow with the keyboard only, no horizontal scroll, and an **axe** scan with zero WCAG 2.1 AA violations.

See [AI_USAGE.md](AI_USAGE.md) for how AI was used.
