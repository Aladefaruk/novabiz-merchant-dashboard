# AI Usage

> The brief asks how I directed AI and where I caught it being wrong. This file is a factual record. Sections marked ✍️ are for me to complete in my own words before submitting.

## Tools

| Tool | Used for |
| --- | --- |
| **Claude Code** (Anthropic, agentic CLI in VS Code) | Scaffolding, most of the implementation, test writing, running the test suites and Playwright, taking screenshots at 360px and 1440px to check the layout, drafting the README |
| ✍️ *(add any others you used, e.g. ChatGPT, Copilot)* | |

**How I worked:** I gave the agent the brief and told it what mattered: original work, FirstBank's deep-blue and gold brand, and the assessment criteria. Then I reviewed its design decisions, ran the app, and used the Mock API panel to break things on purpose. I'm responsible for every line. Anything I couldn't explain, I asked about or changed.

## Prompts and what came back

### 1. The kickoff prompt

> "I have an assessment for a Frontend job at FirstBank [brief attached]… I want you to do it in a very impressive way… FirstBank's colors are deep blue and gold… we are also supposed to create a ppt presentation."

**What came back:** a plan built around the scoring criteria, not a generic dashboard. It used TanStack Query for server state, an in-memory "core banking" mock behind MSW with *real* idempotency semantics (replay, key reuse with a different payload is rejected), and chaos controls in the UI so a reviewer can trigger the failure cases. It also wrote integration tests that run the whole App against the mock.

### 2. ✍️ *(Add a real follow-up prompt you gave, e.g. asking it to explain the outbox pattern, or to change something, and summarise the answer.)*

### 3. ✍️ *(Another real prompt, e.g. "why not use the React Query docs' optimistic-update example?")*

## Where AI output was wrong or risky, and how it was caught

These all happened during this build. Each one now has a test that would catch a regression.

### ❶ The "standard" optimistic rollback would have erased a customer's payment

**Risky output:** the default optimistic-update recipe, the one found in docs, tutorials and AI suggestions, is:

```ts
onMutate: async () => { const previous = qc.getQueryData(key); qc.setQueryData(key, optimistic); return { previous }; },
onError: (_e, _v, ctx) => qc.setQueryData(key, ctx.previous),   // ← restore snapshot
```

The first alternative considered was to "subtract on mutate, add back on error".

**Why both are wrong here:**

- **Snapshot restore:** this dashboard receives live inflows. If a customer pays while a transfer is in flight, restoring the snapshot puts back the *old* balance and the payment disappears from the screen.
- **"Add it back":** this double-credits the merchant if a refetch already replaced the optimistic value.
- **Timeouts:** neither approach handles a timeout where the server *did* commit. That case should end with the money shown as gone, not rolled back.

**Fix:** never write the optimistic value into the server cache. Displayed balance = `server balance − Σ in-flight outbox`.

- **On error:** drop the outbox entry.
- **On an ambiguous error** (timeout, network or 5xx): fetch server truth first, then swap it in and drop the entry in one `notifyManager.batch`.
- **Regression test:** `SendMoney.test.tsx › reconciles to SERVER truth — keeps payments that arrived meanwhile`. It sends a payment to the merchant mid-transfer, fails the transfer, and asserts the balance equals `start + inflow`. A snapshot rollback would show `start`.

### ❷ Naive kobo ↔ Naira math

**Risky pattern:** `Math.round(parseFloat(input) * 100)` for parsing and `(kobo / 100).toLocaleString()` for display. The `*100` version without `Math.round` is worse: `parseFloat("19.99") * 100 === 1998.9999999999998`, and `1.15 * 100 === 114.99999999999999`.

**Fix:**

- **Parsing:** string-based, in `parseNairaInput`.
- **Display:** an exact decimal string handed to `Intl.NumberFormat` (`formatNaira`).
- **Verified:** I checked in Node that `Intl` formats a large value as `…409.91` from a string but `…409.90` from a float.
- **Tests:** `money.test.ts` pins `19.99`, `1.15`, `0.29` and `MAX_SAFE_INTEGER`. `security.test.ts` fails CI if `* 100` or `/ 100` appears outside `money.ts`.

### ❸ A failed "load more" would have wiped 1,000 loaded rows

**Wrong output:** the first version of the feed rendered `isError ? <ErrorState/> : <List/>`. That looks right. But in **TanStack Query v5, a failed `fetchNextPage` sets the whole query to `status: 'error'` while keeping `data`**. So one failed page on a flaky 3G connection would have replaced the entire feed with an error screen.

**How it was caught:** TypeScript narrowing produced an impossible `never` type on the footer's retry handler. Asking *why* that branch was unreachable exposed the v5 behaviour.

**Fix:** a full error screen only when `isError && !data`. A next-page error gets an inline retry and keeps the rows.

**Test:** `TransactionFeed.test.tsx › keeps loaded rows when a NEXT page fails`.

### ❹ The balance card would hide the last known balance on a failed refresh

**Wrong output:** `if (isError) return <ErrorState/>` on the balance card. Background polling failures are routine on low-end connections, and this replaced a perfectly good balance with an error.

**Fix:** a full error screen only when there's no data. Otherwise show the last balance with "Couldn't refresh — showing balance from HH:MM WAT · Retry". I caught this while designing the E2E failure test: with a 100% failure rate, the post-failure reconciliation fetch also fails.

### ❺ A 19px horizontal scroll on 360px Android

The CSS looked correct and passed visual review at desktop size. The Playwright `mobile-360` project (mobile emulation) measured `scrollWidth − clientWidth = 19`. Probing the element boxes showed mobile Chrome gives `<input type="date">` a large intrinsic minimum width, and a `1fr` grid column won't shrink below it.

**Fix:** `minmax(0, 1fr)` columns plus `min-width: 0` on the inputs. A second review of the 360px screenshot then showed the status badge cutting off the transaction time, so the channel label is now hidden below 480px.

### ❻ A test that was wrong, not the app

An insufficient-funds test typed `floor(balance)` naira and expected an error. It failed because the seeded balance was above the ₦5M per-transfer limit, so a *different* (correct) validation fired first. The test was rewritten to pin the balance at ₦5,000 and send exactly ₦5,000, which is the real edge case: the fee is what pushes the total over.

**Lesson:** a failing test isn't automatically an app bug. Read what it's actually asserting.

## ✍️ My own review notes

*(Before submitting, add one or two things you personally checked, questioned or changed after reading the code. For example: walk the Send Money flow with only the keyboard, or turn on a screen reader (VoiceOver: Cmd+F5) and listen to the transfer status announcements. The panel will ask you to explain and modify this code live, so make sure you can.)*
