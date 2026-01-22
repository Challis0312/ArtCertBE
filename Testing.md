# Testing Overview

This document summarizes the testing approach for the project, how to run tests locally, where results live, and what remains in scope next.

## What we test

- Frontend (React + Vite)
  - Component/unit tests with Jest + Testing Library (jsdom)
  - Location: `frontend/src/**/__tests__/**` and `frontend/src/**/*.test.jsx`
- Backend (Node/Express)
  - Service-level unit tests with Jest (DB calls mocked)
  - Location: `backend/test/**/*.test.js`
- API (manual)
  - Manual functional checks via Postman and Swagger UI
  - Collections and example logs tracked in `docs/testing/` (see templates below)

## How to run tests

### Frontend

From `frontend/`:

- Run all tests
  - `npm test`
- Run with coverage
  - `npm run coverage`
- Environment
  - Jest config: `frontend/jest.config.mjs`
  - Setup file: `frontend/jest.setup.js`
  - Uses jsdom. Static assets and CSS are mocked.

#### Frontend E2E (Playwright)

- Location: `frontend/tests-e2e/`, config in `frontend/playwright.config.ts`
- Commands (run from `frontend/`):
  - `npm run e2e` – headless across Chromium/Firefox/WebKit
- Dev server: Playwright config auto-starts Vite on port 5173. Override with `PLAYWRIGHT_BASE_URL` if needed.
- Keep E2E selectors stable via data-testid or accessible roles; avoid brittle className/css chains.

### Backend

From `backend/`:

- Run tests with coverage
  - `npm test`
- Notes
  - Tests use `jest --coverage --setupFiles dotenv/config`
  - DB access is mocked (see `backend/src/database/getDBPool.js` mocks within tests)