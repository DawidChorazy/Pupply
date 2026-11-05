# Regression checks

## Walker reviews

`backend/src/services/review.integration.test.ts` covers ownership, verified accounts,
completed walks, score validation, concurrent retries, immutable publication,
public data isolation, cursor pagination, aggregate counts and search filtering.
Apply all migrations to the separate test database before running it.

`tests/reviews-browser.cjs` uses a real dedicated API on port 4001 and real fixtures
in the guarded test database. With Expo on port 8081, a built backend, `NODE_ENV=test`,
the same test `DATABASE_URL` as the dedicated API and Playwright installed, run
`NODE_PATH=/tmp/pupply-browser/node_modules node tests/reviews-browser.cjs`.
Set `PUPPLY_CHROMIUM_EXECUTABLE` when selecting a browser executable manually.
It checks publication from bookings, required criteria, reload persistence,
lost-response retry, public reviews, author privacy, minimum-rating filtering
and stranger/sitter restrictions. Only location suggestions are mocked; review,
booking and search requests use the test API. It removes its own fixtures.
Screenshots: `/tmp/pupply-review-mobile.png` and `/tmp/pupply-reviews-public.png`.

## Chat

Backend scenarios are in `backend/src/services/chat.integration.test.ts`. They use
the guarded, separate test database and cover participant-only access, contact
before booking acceptance, concurrent idempotent sends, pagination, read markers,
rate limits, inactive accounts and private notifications.

`tests/chat-browser.cjs` uses real test accounts and a dedicated API on port 4001,
with all requests from its browser contexts redirected to that API. It refuses
to run without `NODE_ENV=test` and an explicitly named test database. See
[chat setup and behavior](../docs/chat.md) for prerequisites. It covers two users,
unread counts, reload persistence, a lost response and safe retry, notification
routing, older history, mobile layout and stranger isolation.

## Calendar and booking schedule

`node tests/scheduling.test.cjs` checks local calendar dates, daylight-saving changes, repeat schedules, breaks, elapsed time and service duration. With the temporary Playwright installation described below and Expo running:

```sh
NODE_PATH=/tmp/pupply-browser/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/pupply-browser/browsers node tests/scheduling-browser.cjs
```

The browser check uses HTTP fixtures. It checks protected reservations, choosing hours without typing, repeating work days with multiple breaks, afternoon break defaults, bounded time choices, removing breaks, separate day/multiple-date modes, a compact editor with a fixed save action, immediate archive/undo, atomic bulk removal, original interval IDs, failed delete/undo and lost-response recovery, a four-week schedule, failed saves/retry, overlaps, persistence after reload, mobile/desktop layouts, sending an exact booking time, selecting multiple dates, proportional prices, extended visits, common availability across days and refreshing after single/batch booking conflicts, monthly loading, removing availability after cancellation, replaying a lost response and recovering a committed booking after page reload. Screenshots are saved as `/tmp/pupply-calendar-mobile.png`, `/tmp/pupply-calendar-desktop.png`, `/tmp/pupply-booking-calendar-mobile.png`, `/tmp/pupply-multiday-booking-mobile.png`, `/tmp/pupply-multiple-breaks-mobile.png` and `/tmp/pupply-multiple-breaks-desktop.png` and `/tmp/pupply-calendar-bulk-desktop.png`.

`backend/src/services/schedule.integration.test.ts` uses a separate test database and covers atomic batch saves/rollback, simultaneous submissions, permissions, private reservation data, free intervals, editing hours, preserving booking history, a concurrent booking versus schedule change, longer appointments, server price calculation, stale quotes atomic multi-day reservations, bulk archive/undo, foreign IDs, conflicting restores and concurrent booking/removal. Run it alongside the booking scenarios in `reliability.integration.test.ts`; the latter's PDF scenarios also require configured test storage.

`backend/src/services/booking-reliability.integration.test.ts` covers the review regressions: 10 pairs of concurrent non-overlapping bookings, concurrent idempotent retries, original-response replay, account isolation, atomic batch rollback, cancelling/archiving availability without deleting history, read-only handling of expired requests, targeted expiry during writes, bounded date ranges and cursor pagination. Apply migration `20261019220000_schedule_reliability` to the separate test database first.

## Profile

`backend/src/services/profile-photo.integration.test.ts` checks real profile image
upload/storage, persistence, ownership and purpose isolation, removal, chat avatars
and orphan cleanup. Configure the isolated test database and storage as below.
`tests/profile-photo-browser.cjs` additionally selects a real PNG through the web
file picker, saves it automatically, reloads the page, simulates a failed save,
replaces and removes the photo. Like the chat check, it requires a dedicated test
API on port 4001, a built backend, `NODE_ENV=test` and a test database. Run with
`NODE_PATH=/tmp/pupply-browser/node_modules`; `PUPPLY_CHROMIUM_EXECUTABLE` optionally
selects the browser executable. It redirects only its own browser's API requests.

Run validation, session isolation and API response tests without extra dependencies:

```sh
node tests/profile-validation.test.cjs
```

The browser check uses mocked API responses: it does not create or change real accounts or pets. Start Expo on port 8081 (`npm run start:frontend -- --web`). Install Playwright in a temporary directory, then run:

```sh
npm install --prefix /tmp/pupply-browser playwright
PLAYWRIGHT_BROWSERS_PATH=/tmp/pupply-browser/browsers /tmp/pupply-browser/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/pupply-browser/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/pupply-browser/browsers node tests/profile-browser.cjs
```

The browser check covers empty/single/multiple pets, profile editing and validation, failed saves, clearing birth date, cancellation, read-only pet details, entering/cancelling edit mode, adding/editing/deleting a pet, attaching a medical PDF with expiry validation and retaining it when returning to pet details, independent account/pet errors and retry, offline logout, account switching and expired sessions. It writes a mobile-width screenshot to `/tmp/pupply-profile-mobile.png`. Native keyboard and confirmation dialogs still require a device or emulator.

## Gamification

With Expo running, use the same temporary Playwright installation:

```sh
NODE_PATH=/tmp/pupply-browser/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/pupply-browser/browsers node tests/gamification-browser.cjs
```

This tests real UI transitions with mocked HTTP responses: adding a pet unlocks a quest, failed claims can be retried, claimed state survives reload, own rank is displayed outside the top 50, failed loads can be retried, and expired sessions redirect to login.

Backend regression tests are in `backend/src/services/gamification.integration.test.ts`. Apply migrations to a **separate test database**, then run `npm --prefix backend test` with `DATABASE_URL` pointing to that database. The existing full integration suite deletes accounts between tests; never run it against the development or production database.

Browser scripts accept `PUPPLY_WEB_URL` (default `http://localhost:8081`). Their HTTP mocks now persist document metadata through the document API rather than through a client-side memory map. Backend integration tests cover real private PDF upload/download, ownership isolation, reminder idempotency, concurrent slot/booking writes, expiration, account state/session revocation and delivery retries.

Backend tests load `backend/.env.test` and refuse to run unless `NODE_ENV=test` and the database is named `test` or ends with `_test`. Apply all migrations to that separate database first. Storage integration tests require both an image bucket and a **private** `S3_DOCUMENT_BUCKET`.

## Pet sharing

`backend/src/services/pet-share.integration.test.ts` checks real database ownership, seven-day expiry, hash-only persistence, read-only access, revocation, disabled owners, PDF scope, concurrent link limits and actual private PDF downloads with bounded signed URLs. Use the isolated test database and storage described above.

With Expo running and Playwright installed, `node tests/pet-sharing-browser.cjs` (with the same `NODE_PATH`/browser setup above) checks creating and copying links, the anonymous mobile-width page, health data, optional PDFs, independent scopes, automatic revalidation after revocation, missing links and token/referrer handling. It uses HTTP fixtures and never changes development accounts or pets. Screenshot: `/tmp/pupply-shared-pet-mobile.png` (override with `PUPPLY_SCREENSHOT_PATH`).
