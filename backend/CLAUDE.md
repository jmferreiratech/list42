# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Backend for List42, a shared grocery-list app. TypeScript on Node 22, Express 5 apps wrapped as AWS Lambdas (`serverless-http`), deployed with Serverless Framework v3, data in DynamoDB. Authentication is [Better Auth](https://better-auth.com) with Google SSO, backed by a custom DynamoDB adapter. User-facing strings (error messages, default list names) are in Portuguese.

## Commands

Use yarn (npm is blocked via `engines`).

- `yarn test` — runs Vitest. The `pretest` hook starts DynamoDB Local in Docker (`ddb-local`, port **8080**), so Docker must be running.
- `yarn test src/db/ddb-adapter.test.ts` — run a single file; add `-t "<name>"` to filter by test name. Running `npx vitest` directly skips `pretest`, so start `ddb-local` first.
- `npx tsc` — type-check (`noEmit`; also runs automatically before `serverless package`).
- `npx eslint .` — lint. A husky pre-commit hook runs `eslint --fix` on staged `.ts`/`.mts` files.
- `npx serverless deploy` — deploy (stage `v1`). Requires `secrets.yml` at the repo root (`LOG_LEVEL`, `ORIGINS`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`), which is injected as Lambda environment variables.

## Architecture

**Layout:** `src/api/<name>/` holds one Lambda each; `src/modules/<domain>/` holds data access and the DynamoDB table definitions for that domain.

- Each API has `index.ts` (Express app, exported for testing), `lambda.ts` (the `serverless-http` handler), and `lambda.yml` (function and routes). `serverless.yml` merges every `lambda.yml` and `resources.yml` via `${file(...)}` — when adding an API or table, register it there and add the table ARN to the IAM statements.
- Two Lambdas: `api-auth` (`/api/auth/*`, hands everything to Better Auth's `toNodeHandler`) and `api-lists` (`/api/lists/*`).
- Express app setup order matters: helmet → `noCacheControl` → CORS (checked against `settings.trustedOrigins`) → body parsers → routes → `unknownRoute` → `exceptions`. Express 5 forwards rejected async handlers to the error middleware, so handlers just `throw`. `api-auth` has no body parsers, because Better Auth reads the raw request body itself.

**Errors:** throw subclasses of `ApplicationError` from `src/modules/errors` (`NotFoundError`, `BadRequestError`, `ValidationError`, …). The `exceptions` middleware turns them into RFC 7807-style JSON (`type`/`title`/`status`/`detail`). Anything else becomes a 500 `InternalError`, and `ServerError` subclasses hide `detail` from the response.

**Logging:** use the winston logger in `src/logger.ts`, not `console`. `LOG_LEVEL=debug` switches to colorized output, makes the `exceptions` middleware log every error (otherwise only `ServerError`s), and turns on the adapter's debug logs. The logger is silent when `NODE_ENV=test`.

**Configuration:** `src/settings.ts` reads `process.env` (the only exception is `src/logger.ts` checking `NODE_ENV`). Table and index names are hard-coded there. `SERVICE_ENDPOINT` is set by `serverless.yml`, not `secrets.yml`: it is the API Gateway URL including the `/v1` stage, and Better Auth's `baseURL` strips `/v1` so its internal routes match. Repositories take `Settings` through a static `Repository.config(settings)` factory.

**Auth / DynamoDB adapter:** `src/db/ddb-adapter.ts` implements Better Auth's `CustomAdapter`. With `usePlural: true`, Better Auth model names are used directly as table names (`users`, `accounts`, `sessions`, `verifications`, defined in `src/modules/auth/resources.yml`). `findMany`/`count` use full table **Scans** with in-memory filtering, sorting and paging, so they are expensive. `UsersRepository` reuses the adapter methods to read users.

**Lists and sharing (`src/api/lists/index.ts`):**
- A user's own list has the same `id` as their user id. The alias `mine` in `:listId` is resolved to the user id by `app.param`.
- `grocery_lists`: one document per list with `items` stored as a map keyed by item id. Every item mutation rewrites the whole document (`PutCommand`). `publicList()` turns `items` into an array for responses.
- Sharing: `GET /api/lists/mine/share-code` signs a 24h JWT (`iss` = owner/list id, `jti` = new cuid2). `POST /api/lists?shared=<code>` redeems it into a `list_shares` row (PK `user`, SK `list`, GSI `list_shares_by_id` on `id` = `jti`); each code can be redeemed once.
- Access check: the `/api/lists/:listId` middleware allows the owner, or a user with a share row for that list; otherwise 404.
- Request bodies are validated with Zod through the local `parse()` helper, which throws `ValidationError`.

**Tests:** `tests-setup.js` creates DynamoDB tables in DynamoDB Local before tests by parsing a `resources.yml` (currently only `src/modules/auth/resources.yml`) and drops them afterwards. Add other modules' `resources.yml` there when tests need those tables. The adapter test runs Better Auth's `runAdapterTest` suite against DynamoDB Local. `src/db/ddb-adapter.test.ts` is the only test file; there are no API-level tests yet.

## Conventions

- ESLint: `strictTypeChecked`, 4-space indent, semicolons, no spaces inside braces (`{a}`), mandatory `curly`, and `import/order` (external/builtin group, then local group, alphabetized, blank line between groups).
- TS config extends `@tsconfig/strictest`, `moduleResolution: bundler`, `baseUrl: src`. esbuild bundles each function separately and leaves out `@aws-sdk/*` because the Lambda runtime provides it (that's why it is a devDependency).
