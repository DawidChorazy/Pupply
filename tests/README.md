# Profile regression checks

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
