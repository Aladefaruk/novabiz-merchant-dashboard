# AI Usage

> ✍️ = for me to fill in with my own words before submitting.

## Tools

| Tool | Used for |
| --- | --- |
| **Claude Code** (agentic, in VS Code) | Building the app, writing tests, running Vitest and Playwright, taking screenshots at 360px and 1440px to check layout, drafting docs |
| ✍️ *(any others)* | |

I directed the work, reviewed what came back, and pushed back where it was wrong or too much. I can explain every file. Anything I couldn't explain, I simplified or removed.

## Prompts and what came back

**1. Kickoff:** "I have an assessment for a Frontend job at FirstBank [brief attached]… FirstBank's colors are deep blue and gold."
The first version was built around the scoring criteria: integer-kobo money, idempotent transfers, a mock API with failure controls, and tests that run the whole app against it.

**2. Pushing back on scope:** "This looks like an overkill, I want to be able to defend every single line of code… use Tailwind, use icon libraries, use libraries or already built tools wherever we can, 1 Playwright test, fewer unit tests."
The result was a rewrite onto Tailwind, `lucide-react` and `react-hook-form` + `zod`. Custom CSS, hand-drawn icons, a hand-rolled form reducer, URL-synced filters and several extras were removed. Tests went from 84 unit tests + 8 E2E runs down to 10 + 1, keeping only the ones that guard the money flow. The core logic (kobo maths, outbox rollback, idempotency) was kept, because that's what the brief scores.

**3.** ✍️ *(Add one more real prompt, e.g. asking it to explain the optimistic update or idempotency, and what it said.)*

## Where AI output was wrong or risky, and how it was caught

**1. The "standard" optimistic rollback would erase customer payments.**
The common recipe is to snapshot the cache in `onMutate` and restore it in `onError`. On this dashboard, payments arrive while a transfer is in flight, so restoring the snapshot puts back an *old* balance and the payment vanishes. The other obvious idea, "add the amount back on error", double-credits if a refetch already happened. It also gets timeouts wrong, where the server may have actually committed.
→ **Fix:** displayed balance = server balance − pending outbox. On an ambiguous failure, fetch server truth first.
→ **Test:** "after a network failure, shows the SERVER balance — keeping a payment that arrived meanwhile".

**2. Naive kobo maths.** `parseFloat("19.99") * 100` is `1998.9999999999998`. `(kobo / 100).toLocaleString()` also loses the last kobo on very large values (`…409.90` instead of `…409.91`, which I checked in Node).
→ **Fix:** string-based parsing, and an exact decimal string passed to `Intl.NumberFormat`. Pinned in `money.test.ts`.

**3. A failed "load more" would have wiped the feed.** The first feed rendered `isError ? <Error/> : <List/>`. In TanStack Query v5, a failed `fetchNextPage` sets `isError` but *keeps the data*, so one bad page on a weak connection would have replaced 1,000 loaded rows with an error. A TypeScript "type is never" error on the retry button exposed it.
→ **Fix:** full error only when `isError && !data`.

**4. The balance card hid good data on a failed refresh.** `if (isError) return <Error/>` replaced the last known balance whenever a background poll failed.
→ **Fix:** keep the balance and show "Couldn't refresh — showing balance from HH:MM".

**5. 19px horizontal scroll on 360px Android.** Caught by Playwright's mobile emulation, not by eye. Mobile Chrome gives date inputs a wide minimum width.
→ **Fix:** `min-w-0` on inputs and `minmax(0,1fr)` grid columns.

**6. The simplification itself introduced a bug.** While converting the layout to Tailwind, `SendMoney` was rendered twice (one copy hidden per breakpoint). That would have meant two forms, two transfer mutations and duplicate element IDs. I caught it on review.
→ **Fix:** one instance, placed with grid positions.

**7. A wrong expected value in a test.** The E2E test expected ₦2,483,839.98 after sending ₦2,500 + ₦10.75 from ₦2,486,350.75. The correct answer is ₦2,483,840.00. The app was right and the test was wrong. A good reminder to check a failing test's arithmetic before "fixing" the app.

## ✍️ My own review notes

*(Add what you personally checked or changed. For example: did the whole Send Money flow with only the keyboard; tried VoiceOver (Cmd+F5) on the transfer result; changed X because Y.)*
