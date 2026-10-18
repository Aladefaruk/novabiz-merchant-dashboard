# NovaBiz Merchant Dashboard

A merchant dashboard for **FirstBank NovaPay → NovaBiz**: live balance and inflows, a 1,000+ row transaction feed, and a 4-step **Send Money** flow. The optimistic update rolls back correctly, and the transfer stays idempotent through timeouts, dropped responses and retries.

React 18 · TypeScript (strict) · TanStack Query v5 · TanStack Virtual · MSW v2 · Vitest + React Testing Library · Playwright

```bash
npm install && npm run dev      # → http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | App + in-browser mock API (MSW) |
| `npm test` | 84 unit / component / integration tests (Vitest + RTL + MSW) |
| `npm run test:e2e` | Playwright E2E. Runs Send Money at **1440px desktop** and **360px Android**. First run: `npx playwright install chromium` |
| `npm run typecheck` / `npm run build` | Strict TS check / production build |

---

## 1. What to look at first (a 5-minute demo)

1. **Mock API panel** (header → *Mock API*). Use it to set latency, the **failure rate** (a 503 before the server does anything) and the **lost-response rate** (the server commits the transfer, then the reply is dropped). It also shows a live counter of how many transfers the server actually committed.
2. **Send ₦1,000** to GTBank `0123456789`, demo PIN `1234`. The balance drops at once and a *Processing* row appears. Then the server confirms.
3. Set **failure rate = 100%** and send again. The UI shows the money as sent, retries 3× with the same key, then rolls back to the **server's** balance. The *committed* counter stays at 0. Set the rate back to 0, press **Check & retry**, and the transfer goes through exactly once.
4. Set **lost response = 100%** and send. The first attempt commits but the client never hears back. The automatic retry carries the same `Idempotency-Key`, the server replays its stored result, and the merchant is debited **once**.
5. Scroll the feed. More than 1,250 rows load, but only about 25 DOM nodes exist at any time.

URL overrides for scripted runs: `/?mock.fail=0.3&mock.lost=0.5&mock.latency=1500&mock.live=0`.

---

## 2. Architecture

```
src/
  lib/            pure, framework-free, unit-tested
    money.ts        Kobo branded type, Intl formatting, string-based parsing
    fees.ts         CBN NIP fee tiers, transfer limits
    sanitize.ts     untrusted-text handling, account masking
    validation.ts   form rules (pure functions)
    dates.ts        Africa/Lagos business-day logic
    idempotency.ts  per-intent key generation
  api/            typed fetch client (timeouts, error taxonomy), endpoints, query keys
  hooks/          useBalance, useTransfer (optimistic outbox), useTheme, useUrlFilters…
  features/
    balance/        BalanceSummary
    transactions/   TransactionFeed (virtualized), TransactionRow (memo), FeedFilters, PendingTransfers
    send-money/     reducer + Recipient → Amount → Review → Confirm → Result
    dev-panel/      Mock API chaos controls
  mocks/          MSW handlers + in-memory "core banking" (ledger, idempotency store)
```

### State management: TanStack Query plus local state, no global store

- **Server state** (balance, transactions, banks, name enquiry) lives in **TanStack Query**. It gives caching, deduplication, cancellation, retry/backoff, infinite queries and mutation lifecycle hooks. Writing these by hand in Redux or Zustand is where most bugs in this kind of app come from.
- **Form state** for Send Money is a `useReducer` local to the feature. It holds the transfer intent and its idempotency key, and it's a pure reducer that's tested directly.
- **UI preferences** (theme, hidden balance, filters) use `localStorage` and the URL. Filters live in the query string so a filtered view survives a refresh and can be shared.
- **Why not Redux or Zustand?** No client state here needs sharing across distant components except the in-flight transfers, and those are kept in the query cache on purpose (see below). A global store would add a second source of truth for server data.

### Money correctness

- Money is an **integer number of kobo** everywhere. A branded `Kobo` type and `toKobo()` reject floats, `NaN` and unsafe integers.
- **Display:** `formatNaira()` builds an exact decimal *string* with integer arithmetic (`100050 → "1000.50"`). It passes that string to `Intl.NumberFormat('en-NG', { currency: 'NGN' })`. Intl.NumberFormat v3 (ES2023) treats string input as an exact decimal, so even `Number.MAX_SAFE_INTEGER` kobo prints as `₦90,071,992,547,409.91`. Formatting `kobo / 100` as a number prints `…409.90`, and a test pins that difference.
- **Input:** `parseNairaInput("19.99")` uses string arithmetic and returns `1999`. `parseFloat("19.99") * 100` returns `1998.9999999999998`.
- A guardrail test fails CI if `* 100` or `/ 100` appears outside `money.ts`.
- Screen readers get an unambiguous long form: "1,000 naira and 50 kobo".

### The Send Money optimistic update (the hard part)

**Requirement:** the UI shows "sent" immediately, but must reconcile correctly if the request fails or times out *after* that.

**The common pattern, and why I didn't use it:** snapshot the cache in `onMutate` and restore it in `onError`. That rollback overwrites anything that changed in the meantime. On a merchant dashboard, things change all the time: a customer's QR payment can land while the transfer is in flight, and restoring the snapshot erases it. Applying an "inverse" adjustment (adding the amount back) is also wrong. If a refetch already replaced the optimistic value, adding back double-credits the merchant.

**What this app does:**

```
displayed balance = server.availableKobo − Σ (amount + fee) of in-flight transfers
```

- In-flight transfers live in an **outbox**: a client-only key in the query cache, holding no PIN. The server balance in the cache is **never** written optimistically.
- **Success:** in one `notifyManager.batch`, remove the outbox entry, write the server's authoritative `balanceKobo`, and splice the confirmed transaction into every cached feed whose filters match. There's no flicker and no refetch of N pages.
- **Definite failure (4xx):** remove the outbox entry. Nothing moved on the server, so the derived balance is correct immediately.
- **Ambiguous failure** (timeout, network drop or 5xx after all retries): the client can't know whether money moved. It fetches **server truth first**, then swaps in the fresh balance and removes the outbox entry in one batch. It also re-syncs the feed head (one request). If the server *did* commit, the debit shows up as a real transaction, never as a ghost or a double count.
- Balance polling **pauses** while a transfer is in flight. A poll landing between the server commit and our response would otherwise briefly count the deduction twice.

### Idempotency

- There's **one key per transfer intent**: recipient, amount and narration. It's created when the merchant moves from Review to Confirm and stored in the reducer. **Every** retry reuses it: React Query's automatic retries (with backoff) and the merchant pressing *Check & retry*. Editing any field of the intent clears the key, so an edited transfer can never replay an old one (reducer test).
- The mock server is a faithful model of real idempotency semantics:
  - Same key and same payload → it replays the stored response with `Idempotent-Replayed: true`, and no new debit happens.
  - Same key with a different payload → `422 IDEMPOTENCY_KEY_REUSED`. It refuses rather than guesses.
  - Only successful commits are stored, so a wrong PIN can be corrected and resubmitted under the same key.
- Retrying a POST is safe *only because* of the key. That's why the mutation's `retry` is allowed at all, and only for retryable errors (timeout, network, 5xx, 429). 4xx responses are never retried.

### Error taxonomy (`api/client.ts`)

`ApiError.kind` is one of `http`, `timeout`, `network` or `aborted`. There's also an `isAmbiguous` flag (timeout, network or 5xx), and it drives all the reconciliation logic above. Timeouts use our own `AbortController`, so "we timed out" is distinguishable from "the caller cancelled".

### Transaction feed performance

- **Keyset (cursor) pagination** on `(createdAt, id)`. Offset pagination would duplicate or skip rows as live payments arrive at the top of the list.
- **Virtualized with `useWindowVirtualizer`.** It uses natural page scrolling, which matters on mobile, where nested scroll areas are painful. Rows have a fixed height of 76px at every breakpoint, so layout math is O(1). The next page is prefetched 15 rows before the end.
- **`React.memo` on rows.** Scroll re-renders only the virtual window, and a row re-renders only when its own transaction object changes.
- **"New activity" banner** instead of auto-inserting rows. Each page carries `headAt` (the newest ledger time). The polled balance summary carries `latestTransactionAt`, and the banner appears when they differ. Pressing *Show latest* trims the cache to the first page and refetches: one request, not 25.
- A test loads 1,250 rows and asserts fewer than 60 `<article>` elements are in the DOM.

### Async states

Every fetch has explicit loading (skeletons with `aria-busy` and a status message), empty, and error states with retry. Specifically:

- **Feed:** first-page failure shows a full error; a failed *next* page shows an inline retry and keeps the loaded rows (TanStack Query v5 marks the query as errored in this case; see AI_USAGE.md). Filtered-empty and brand-new-merchant empty states have different copy.
- **Balance:** a failed background refresh keeps the last known balance on screen with a "Couldn't refresh — showing balance from 14:02 WAT" note. It isn't replaced by an error screen.
- **Banks list and name enquiry:** each has its own error and retry.
- **Transfer:** pending, paused (offline), "retrying (2 of 3)", success, definite failure and ambiguous failure each get distinct copy.

### Security and compliance notes

- **Untrusted text:** descriptions and narrations render only as React text nodes. A test fails the build if `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML` or `eval(` appear anywhere. `toSafeDisplayText` also strips three kinds of characters:
  - **Bidi overrides** (U+202E etc.). A description like `Refund \u202E00.000,05₦` can visually *spoof an amount* (the Trojan Source attack). That matters in a money UI.
  - **Control characters.**
  - **Zero-width characters.**

  The seeded data deliberately includes `<img onerror>`, `<script>`, bidi and control-character payloads.
- **Narration input** is whitelisted to the character set NIP narrations accept, with a maximum of 60 characters.
- **NDPA 2023 data minimisation:** the API returns only masked account numbers (`•••• 6789`). Nothing personal is written to `localStorage`. The PIN is never stored in component state after submit and never put in the optimistic outbox.
- **Name enquiry before transfer** (the NIP pattern): the merchant can't type the recipient's name, only confirm the one the bank returns. The server re-checks it.
- **CBN NIP fees** (₦10.75, ₦26.88 or ₦53.75 including VAT) are shown before confirming. Balance validation includes the fee.
- **"Hide balance" toggle,** because merchants open this app at a busy counter.

### Accessibility (WCAG 2.1 AA)

- The whole Send Money flow is keyboard-operable. Each step is a `<form>`, so Enter submits. On every step change, focus moves to the new step heading, and the Playwright test asserts this.
- Visible focus on everything: a 3px outline plus a gold halo. Navy is used on light surfaces and gold on dark, so the ring keeps at least 3:1 contrast.
- Every field has a `<label>`. Hints and errors are linked with `aria-describedby`, plus `aria-invalid` and `aria-required`.
- Live regions: step changes (polite), name-enquiry result, transfer status (`role=status` while in progress, `role=alert` on failure), offline banner, new-activity banner.
- The feed uses the ARIA **feed** pattern (`role=feed`, with `aria-posinset` and `aria-setsize` on each row), which is designed for infinite scroll.
- Status is never shown by colour alone: there's always a text label, and the badge dot has a different shape for each status.
- `prefers-reduced-motion` is respected. Touch targets are at least 44px. Inputs use 16px text so iOS doesn't zoom on focus.

### Responsive: 360px → 1440px

Mobile-first CSS with design tokens and two themes. The layout is one column (balance → Send Money → feed) and becomes two columns with a sticky Send Money panel from 1024px. Feed rows switch from a stacked layout to a five-column grid at 768px. Playwright runs the flows at 360px and asserts **no horizontal scroll**. That test caught a real 19px overflow from mobile Chrome's date inputs, now fixed.

### Stretch goals delivered

- ✅ List virtualization
- ✅ Dark mode, persisted and applied before first paint with no flash
- ✅ Poor-connectivity handling:
  - jittered exponential backoff on queries and transfers
  - an offline banner
  - transfers pause while offline and resume when the connection returns, which is safe because of idempotency
  - a USSD `*894#` fallback hint
- ❌ Storybook: deliberately skipped (see trade-offs).

---

## 3. Assumptions (the brief left these open)

| Topic | Assumption |
| --- | --- |
| Merchant KYC | Tier 3 (BVN and NIN verified). Transfers are limited to ₦100–₦5,000,000 each. |
| Fees | Standard CBN NIP charges, VAT-inclusive, are passed to the merchant. |
| Timezone | "Today" means the **Africa/Lagos** calendar day, whatever timezone the device is set to. |
| PIN | 4-digit transaction PIN, demo value `1234`. In production it would be encrypted client-side with the bank's public key or replaced by device binding. It's sent in plain JSON here only because the backend is a mock. |
| Transfer status | NIP is synchronous, so a committed transfer is `successful` immediately. `pending` exists in the seeded history. |
| Mock persistence | The mock ledger lives in page memory, so a hard refresh resets it. That's deliberate, so every demo starts the same. |
| Account not found | Any account number ending in `0000` returns 404 from name enquiry, so you can demo that state. |

## 4. Trade-offs and what I'd do next

- **Storybook was skipped** in favour of more rigorous integration tests on the Send Money flow, since the brief scores test rigor. With another day, I'd add stories for `TransactionRow` (every status plus hostile text), `ResultView` (every state) and `BalanceSummary`.
- **Polling instead of SSE/WebSocket** for live inflows. It's simpler, cache-friendly and fine at a 15s interval. In production I'd push "new activity" events over SSE and keep polling as a fallback.
- **A fixed row height** makes virtualization cheap. The cost is that long descriptions are truncated with an ellipsis; the full text is in the `title` attribute. A detail drawer would be the next feature.
- **The mock always runs, including in production builds,** because there's no backend. With a real API, `main.tsx` would gate the mock behind `import.meta.env.DEV`.
- **Next steps:**
  - A transaction detail and receipt view, with a shareable receipt (merchants send these on WhatsApp).
  - Saved beneficiaries.
  - axe-core checks in Playwright.
  - A Lighthouse CI budget for low-end devices.
  - i18n (Yorùbá, Hausa, Igbo, Pidgin).

## 5. Tests

```
src/lib/money.test.ts            kobo formatting/parsing edge cases incl. float-drift regressions
src/lib/lib.test.ts              fees, validation, sanitisation (bidi/control chars), Lagos dates
src/features/send-money/state.test.ts   idempotency-key lifecycle
src/features/send-money/SendMoney.test.tsx   ← full App against MSW
  ✓ happy path sends an Idempotency-Key, debits amount+fee, row appears in feed
  ✓ optimistic row + reduced balance BEFORE the server answers, clean rollback on 4xx
  ✓ ambiguous failure reconciles to SERVER truth — a payment that arrived mid-flight is kept
  ✓ commit + lost response → auto-retry with same key → debited exactly once
  ✓ manual retry after ambiguous failure reuses key, can't double-send
  ✓ wrong PIN → back to PIN step → same key succeeds
  ✓ editing after review produces a NEW key
  ✓ validation: required fields, unknown account, fee pushes over balance, sub-kobo precision
src/features/transactions/TransactionFeed.test.tsx
  ✓ newest-first, aria-posinset/setsize · ✓ 1,250 rows loaded, <60 in DOM
  ✓ hostile HTML/bidi descriptions render inert · ✓ status/type filters (+URL sync)
  ✓ empty states · ✓ inverted date range · ✓ first-page error + retry · ✓ next-page error keeps rows
src/features/balance/BalanceSummary.test.tsx   formatting, loading → error → retry, hide balance
src/test/security.test.ts        no raw-HTML sinks; no float math on kobo
e2e/send-money.spec.ts           (× desktop 1440 and mobile 360)
  ✓ keyboard flow + focus management + exact debit · ✓ failure after optimistic "sent" → rollback → retry once
  ✓ lost response → same key → committed once · ✓ no horizontal scroll
```

The tests are written to catch the regressions that matter. For example, changing `onError` to the common snapshot-restore pattern fails the "server truth" test. Generating a key per attempt instead of per intent fails three tests.

See **[AI_USAGE.md](AI_USAGE.md)** for how AI was used and where it was wrong.
