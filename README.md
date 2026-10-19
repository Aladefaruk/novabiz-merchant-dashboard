# NovaBiz Merchant Dashboard

A dashboard for small merchants on **FirstBank NovaPay → NovaBiz**. It shows the live balance and today's money in and out, a virtualized, searchable transaction feed of 1,250+ rows, and a 4-step **Send Money** flow. The optimistic update rolls back correctly when the network fails, and the transfer can't be sent twice.

```bash
npm install && npm run dev        # http://localhost:5173
npm test                          # Vitest + React Testing Library (against the mock API)
npx playwright install chromium   # first time only
npm run test:e2e                  # Playwright: the Send Money flow end to end
npm run test:all                  # typecheck + unit + e2e in one go
npm run storybook                 # http://localhost:6006 — key components in every state
```

Requires **Node 20+** (exact money formatting relies on `Intl.NumberFormat` reading numeric strings, which Node 18 doesn't support).

**Stack:** React 18 + TypeScript · Vite · Tailwind CSS v4 · TanStack Query (server state) · TanStack Virtual (feed) · react-day-picker (date range) · react-hook-form + zod (Send Money form) · lucide-react (icons) · MSW (mock API) · Vitest + RTL · Playwright

## Demo in 2 minutes

1. Send ₦1,000 to **GTBank `0123456789`** with demo PIN **`1234`**. The balance drops and a *Processing* row appears immediately, then the server confirms.
2. Open **Mock API** (header), set **Failure rate = 100%**, and send again. The app tries up to 3 times with the same key, then rolls back to the server's balance and explains what happened.
3. Set **Lost response = 100%** and send. The server commits but the reply is dropped. The automatic retry sends the same `Idempotency-Key`, the server replays its result, and the merchant is debited **once** (see the "Server committed" counter).

Accounts ending in `0000` return "account not found".

## Project structure

Feature-based: each feature owns its UI, its state logic, and its tests and stories.

```
src/
├── main.tsx       entry: starts the mock API, mounts the app
├── app/           App layout, query client, global styles (wiring only)
├── features/
│   ├── balance/        BalanceSummary, useBalance (displayed = server − pending)
│   ├── send-money/     4-step flow, zod schema, useTransfer (outbox, retries, reconciliation)
│   ├── transactions/   virtualized feed, search, date range, filters, pending rows
│   └── dev-panel/      the Mock API controls
├── shared/        used by 2+ features: api client and types, UI components, hooks, money/fees/dates/sanitize
├── mocks/         the fake backend (MSW handlers, in-memory ledger, seed data)
└── test/          test setup and helpers, e2e/ (Playwright)
```

**Rule:** `shared/` never imports from `features/`. Features may read each other's hooks. Balance and the feed read Send Money's in-flight transfers, and Send Money reads the balance to check funds.

## Key decisions

**State: TanStack Query plus local state, no Redux or Zustand.** Almost all state here is server state (balance, transactions, banks). TanStack Query gives caching, retries with backoff, infinite scroll and mutation hooks out of the box. The Send Money form uses `react-hook-form` with a `zod` schema. Theme is a small hook with `localStorage`. Nothing else is global, so a store would only add a second copy of server data.

**Money is integer kobo everywhere** (`src/shared/lib/money.ts`).
- **Display:** `formatNaira` passes the amount to `Intl.NumberFormat('en-NG', { currency: 'NGN' })` as the string `"100050e-2"` ("move the decimal point two places left"). Intl reads numeric strings exactly, so there's no `kobo / 100` and no float ever exists. Intl adds the ₦, commas and decimals, so there's no string-splicing either. (Supported in all current browsers: Chrome 106+, Safari 15.4+, Firefox 116+.)
- **Input:** `parseNairaInput` uses string maths, because `parseFloat("19.99") * 100` is `1998.9999999999998`.
- **Type safety:** a branded `Kobo` type stops a raw float being passed by accident.

**Optimistic update that can't corrupt the balance** (`src/features/send-money/useTransfer.ts`).
- The usual recipe (snapshot the cache, restore it on error) is wrong for a merchant. If a customer pays *during* the transfer, restoring the snapshot erases that payment.
- Instead, in-flight transfers go into an "outbox", and **displayed balance = server balance − pending transfers**. The server's cached balance is never edited optimistically.
- **On a 4xx** (definite rejection), the outbox entry is removed.
- **On a timeout, network error or 5xx**, we don't know whether money moved. The app fetches the server balance *first*, then removes the entry, so it always ends on server truth.
- Balance polling pauses while a transfer is in flight.

**Idempotency.**
- One `crypto.randomUUID()` key per transfer *intent* (recipient + amount + narration), created when the merchant reaches Confirm.
- Every retry reuses it: automatic retries, the "Try again" button, and a wrong PIN corrected afterwards. If the merchant edits the transfer, a new key is made.
- The mock server enforces real idempotency rules. The same key replays the original result, and the same key with a different payload is rejected.
- That's what makes it safe to retry a POST at all. Definite rejections (4xx) are never retried; the one exception is 429 "too many requests", which is safe to retry with the same key.

**Feed: virtualized, with search and a date range.**
- `useWindowVirtualizer` keeps only the rows on screen plus a small overscan (about 20–30) in the DOM, however many are loaded. Rows are `memo`ised with a fixed 76px height.
- Keyset (cursor) pagination behind the infinite scroll, so new payments arriving at the top don't shift pages.
- **Search** over name, narration and reference. It waits for a 400ms pause in typing (Enter searches at once), so it doesn't send a request per keystroke on metered data.
- **One date-range control** (react-day-picker) with presets: Today, Yesterday, Last 7 days, Last 30 days, This month. Days are Lagos days, and future days can't be picked.
- "Refresh" and post-transfer syncs refetch only the first page, not every loaded page.

**Async states.** Every fetch has loading (skeleton), empty and error-with-retry states. Two details:
- A failed *next page* keeps the rows already loaded. In TanStack Query v5 that case also sets `isError`.
- A failed background balance refresh keeps the last balance on screen with a note, instead of an error screen.

**Accessibility (WCAG AA).**
- The Send Money flow is keyboard-operable, and focus moves to each step's heading.
- Visible focus rings; every field has a label, with errors linked via `aria-describedby` and `aria-invalid`.
- Live regions for the name-enquiry result, step changes and transfer status.
- The feed uses the ARIA `feed` pattern. The date-range picker closes with Escape and returns focus to its button.
- Status badges use text and an icon, never colour alone.

**Responsive.** Mobile-first Tailwind from 360px to 1440px. Send Money becomes a sticky right column from `lg`. On phones, today's money in and out stack as rows, and amounts never wrap mid-number.

**Untrusted text.** Descriptions and names are rendered only as React text, never as HTML. `toSafeDisplayText` also strips invisible and bidi-override characters, which could make a description *look* like a different amount. The seeded data includes `<img onerror>` and `<script>` payloads to prove they render inert.

**Nigerian context.**
- **NIP fees:** CBN tiers incl. VAT (₦10.75, ₦26.88 or ₦53.75), shown before confirming and included in the balance check.
- **Name enquiry first:** the recipient's name comes from the bank and can't be typed in.
- **Lagos time:** "today" is the Africa/Lagos day.
- **NDPA data minimisation:** account numbers are masked to the last 4 digits.
- **USSD fallback:** *894# is suggested when offline or after a failure.

**Storybook** (`npm run storybook`). Stories cover the pieces where a wrong state costs money or trust: `Money` (incl. the float-drift edge cases), `StatusBadge`, the loading/empty/error states, `TransactionRow` (incl. hostile text), `BalanceSummary` (incl. a transfer in flight and a failed refresh), every `ResultView` outcome, and the full Send Money flow with *Server down* and *Lost response* variants.
- Stories run against the **same MSW mock API** as the app; a story can override one endpoint via `parameters.msw`.
- Toolbar toggles light/dark and 360px/1440px viewports; the **a11y panel** runs axe (WCAG 2.1 AA) on every story. It caught a real bug: failed amounts in dark mode were below AA contrast.

## Assumptions

- The merchant is KYC Tier 3 (shown as a badge on the balance card), with transfers of ₦100–₦5,000,000 each.
- Narration is optional: a list of common merchant narrations, or a custom one (up to 60 characters, letters, numbers and basic punctuation).
- The PIN is a 4-digit demo PIN, sent as plain JSON only because the backend is a mock. In production it would be encrypted or replaced by device binding.
- NIP is synchronous, so a committed transfer is successful immediately.
- The mock ledger lives in page memory, so a refresh resets the data.

## Stretch goals (brief §2.4): all four

| Goal | Where |
| --- | --- |
| List virtualization | `TransactionFeed.tsx`: TanStack Virtual on the window (about 20–30 rows in the DOM out of 1,250) |
| Dark mode, persisted | `useTheme.ts` + a script in `index.html` that applies it before first paint; follows the OS by default |
| Storybook | 39 stories for 7 components, on the same mock API, with axe in every story |
| Offline / retry with backoff | Jittered exponential backoff on queries and transfers; transfers pause offline and resume; offline banner with *894# |

## Trade-offs and next steps

- **Kept deliberately small** so every line can be explained. No router (it's a single screen), and a small test suite focused on the money flow.
- **Live inflows use polling** (every 15s). In production I'd push events over SSE.
- **Next:**
  - A transaction detail and receipt view.
  - Saved beneficiaries.
  - Transfer status lookup by reference after a timeout.

## Tests

- `src/shared/lib/money.test.ts`: formatting and parsing, including the float-drift cases.
- `src/features/send-money/SendMoney.test.tsx`: full app against the mock API.
  - Happy path with the `Idempotency-Key`.
  - Optimistic row, then rollback.
  - A network failure reconciles to server truth and *keeps a payment that arrived meanwhile*.
  - A lost response is retried with the same key and debited exactly once.
- `src/features/transactions/TransactionFeed.test.tsx`: newest first and virtualized, search finds a transaction by reference, hostile text renders inert, error state retry works.
- `src/test/e2e/send-money.spec.ts`: real browser (Playwright), 5 tests. Playwright reuses a dev server already running on port 5173, so restart `npm run dev` after installing new packages.
  1. Happy path: optimistic row, idempotency header, exact debit.
  2. Server failure after the UI showed "sending": rolls back to the server balance, then "Try again" succeeds exactly once.
  3. Server commits but the response is lost: retried with the same key, debited once.
  4. Double-clicking Send sends only one request.
  5. On a 360px phone: the whole flow with the keyboard only, no horizontal scroll, and an **axe** scan with zero WCAG 2.1 AA violations.

See [AI_USAGE.md](AI_USAGE.md) for how AI was used.
