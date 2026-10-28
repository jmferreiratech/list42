# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

List42 ("List For Two") is a shared grocery-list PWA. It is frontend only: React 19 + TypeScript + Vite, MUI v7 (dark theme, primary `#42b883`), Redux Toolkit / RTK Query, `better-auth` for sessions, and i18next (only `pt-BR`). The backend API lives elsewhere and is reached at `${VITE_BASE_URL}/api`.

## Commands

Use **yarn** (Node 20). `package.json` blocks npm on purpose.

```bash
yarn dev                     # Vite dev server (PWA service worker is enabled in dev too)
yarn build                   # tsc -b && vite build
yarn tsc -b                  # type-check only
yarn lint                    # eslint .
yarn test                    # vitest run
yarn test:watch
yarn test:coverage
yarn vitest run src/App.spec.tsx -t "adds an empty new item"   # single test by name
yarn generate-pwa-assets     # regenerate icons in public/ from public/logo.svg
```

`VITE_BASE_URL` comes from `.env` (gitignored). The app is served under the base path `/list42/`. Pushing to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`, which reads `VITE_BASE_URL` from the repo variable `vars.VITE_BASE_URL`). CI only builds; it does not run lint or tests.

## Architecture

- **Bootstrap** (`src/main.tsx`): Redux `Provider` (from `setupStore()`) → `AuthProvider` (gives the `better-auth` client through context; read it with `useAuth()`) → `App`. `App.tsx` wraps everything in the theme and `ToastProvider`. It shows `Loading`, then `SignIn` when there is no session, and otherwise the main view. The main view keeps the selected list id in localStorage under the key `${user.id}.selectedListId`.
- **Config**: `src/settings.ts` is the only place that reads env vars. `settings.baseURL` is `${VITE_BASE_URL}/api` (it already includes `/api`). `api.ts` appends `/lists/` and `auth.ts` appends `/auth`.
- **Data layer** (`src/api.ts`): one RTK Query API, `groceryApi`. The list id defaults to `'mine'` (the user's own list). The item mutations (`addItem`, `updateItem`, `deleteItem`) do **optimistic updates** on the `getGroceryList` cache in `onQueryStarted`. Each one swaps in the server response when it arrives and undoes the patch if the request fails. They do not invalidate tags. Follow the same pattern for any new item mutation.
- **Sharing**: `getShareCode` returns a code for the user's own list. Opening the app with `?shared=<code>` makes `ShareCodeRedeemer` POST it to `/lists?shared=`, remove the query param, and switch to the redeemed list.
- **Item editing** (`GroceryList.tsx`, `useItemsList`): a new item starts as a client-only temp item with an id starting `new-…`. Saving it is what sends `addItem`, with a fresh `cuid2` id. Code uses `id.startsWith('new')` to tell temp items apart. Saving a new item opens another blank one right away. Items are sorted by `updatedAt`, newest first.
- **UI text**: all user-facing strings are i18n keys in `src/locales/pt-BR/translation.json`, read through `useTranslation().t`.

## Testing

- Tests are integration-style and render the whole `<App />` through `renderWithProviders` in `src/App.spec.tsx`. That helper creates a real store and auth client, and returns `{ q, user, store }`.
- The HTTP backend (including `/auth/get-session`) is mocked with **MSW** `setupServer`. Override handlers per test with `server.use(...)`, and build URLs from `settings.baseURL`. In tests, `VITE_BASE_URL` is forced to `http://localhost:12345` (`vite.config.ts`).
- Any request without a matching MSW handler fails the test in `afterEach` (`expect(unhandledRequests).toEqual([])`). Register a handler for every request the test triggers, including follow-up refetches.
- `vitest.setup.ts` mocks `react-i18next` globally so that `t(key)` returns the key itself. Assert on **i18n keys** (e.g. `findByText('signInMessage')`, `findByLabelText('addItem')`), not on the Portuguese text.
- The test environment is happy-dom, with vitest globals enabled.

## Conventions

`.aider.conventions.md` (gitignored, local only) holds the project conventions. They mostly match the user-level principles. The project-specific points are:

- Function components and custom hooks only. Pull reusable stateful logic out into hooks (`src/hooks/`), and type props with interfaces or types.
- For complex conditional JSX, prefer extracting a component that uses an early return.
- Use semantic HTML and accessible labels. Tests query by `aria-label` and role.
- Ask before adding any npm package.
- TypeScript uses plain `"strict": true` (`tsconfig.app.json`), not `@tsconfig/strictest`. Don't migrate it unless asked.
