# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the frontend in `frontend/`. Paths below are relative to `frontend/`; run commands from there.

## Project

List42 ("List For Two") is a shared grocery-list PWA. This is the frontend: React 19 + TypeScript + Vite, MUI v7 (dark theme, primary `#42b883`), TanStack Query v5, `better-auth` for sessions, and i18next (only `pt-BR`). The backend API is reached at `${VITE_BASE_URL}/api`.

## Commands

Use **yarn** (Node 24). `package.json` blocks npm on purpose.

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

`VITE_BASE_URL` comes from `.env` (gitignored). The app is served under the base path `/list42/`. Pushing to `main` deploys to GitHub Pages (`../.github/workflows/deploy-frontend.yml`, which builds from `frontend/` and reads `VITE_BASE_URL` from the repo variable `vars.VITE_BASE_URL`). The deploy only builds; lint, type-check and tests run on pull requests (`../.github/workflows/ci-frontend.yml`).

## Architecture

- **Bootstrap** (`src/main.tsx`): sets `onlineManager` from `navigator.onLine`, then `QueryClientProvider` (from `createQueryClient()`) → `AuthProvider` (gives the `better-auth` client through context; read it with `useAuth()`) → `App`. `App.tsx` wraps everything in the theme and `ToastProvider`. It shows `Loading`, then `SignIn` when there is no session, and otherwise the main view inside `OfflineCacheProvider`. The main view keeps the selected list id in localStorage under the key `${user.id}.selectedListId`.
- **Session** (`hooks/useSessionUser.ts`): read the signed-in user through `useSessionUser()`, not `authClient.useSession()`. When the session request fails (offline), it returns the last user the server confirmed, kept in localStorage (`list42.lastSessionUser`, without the token). Only a server answer of "no session" signs the user out. That also clears the offline cache (`SignedOut` in `App.tsx`).
- **Offline** (`offlineCache.ts`, `components/OfflineCacheProvider.tsx`): the query cache and paused mutations are saved to localStorage (`list42.offlineCache`) on every change, with the user id as `buster`, so another user's cache is dropped. After a restore, paused changes are resumed and then all queries are invalidated. Queries use `networkMode: 'offlineFirst'`. Mutations keep the default `online` mode, so a change made offline pauses (and is saved) right away. `OfflineNotice` shows while offline, and items with paused changes show an "unsent" icon (`useUnsentItemIds`).
- **Config**: `src/settings.ts` is the only place that reads env vars. `settings.baseURL` is `${VITE_BASE_URL}/api` (it already includes `/api`). `api.ts` appends `/lists` and `auth.ts` appends `/auth`.
- **Data layer** (`src/api.ts`): TanStack Query. It exports the query keys (`queryKeys`), query options for `useQuery` (`groceryListsQuery`, `groceryListQuery(listId)`), and mutation hooks (`useAddItem`, `useUpdateItem`, `useDeleteItem`, `useRedeemShareCode`). The user's own list has the id `'mine'`. `createQueryClient()` sets `staleTime: Infinity` and `retry: false`, so cached data is reused and only the open list refetches: `GroceryList` polls it every 30s (not while the app is in the background) and refetches on focus and on reconnect.
- **Item mutations** all go through `useItemMutation`, which does **optimistic updates** on the list's cache. The work is in mutation defaults registered by key in `registerItemMutations` (not in the hook), so a change saved offline can be sent after a restart; the variables (`{listId, action, item}`) hold everything needed to send it. The client stamps `updatedAt` on every change (deletes send it in the body), and the backend ignores a change older than the stored item, replying with the list as stored. `onMutate` cancels in-flight refetches and applies the change. `onError` refetches the list when no other change to it is pending. Changes to one list share a mutation `scope`, so they are sent one at a time. A server reply is written to the cache only when no other change to that list is still pending (`isMutating(...) === 1`); an earlier reply would hide later changes. `GroceryList` also pauses polling and focus refetches while `useIsSavingItems(listId)` is true. Add any new item mutation through `useItemMutation`.
- **Live updates** (`hooks/useListUpdates.ts`, `useLiveListRefresh` in `GroceryList.tsx`): while online, the open list gets a ticket (`fetchUpdatesTicket`, `GET /lists/:listId/updates-ticket` → `{url, token}`) and opens a WebSocket to `url?token=`. It pings every 5 min (the server drops idle connections after 10) and reconnects with a growing delay (1s up to 60s) when the connection closes or can't be started. Messages other than `{type: 'listChanged', version: number}` are ignored. A change message invalidates the list unless the cached list's `version` is already at least that (true for the user's own changes, whose reply brought it). The list's `version` is an atomic counter, not a time, so it can't skip a change stored meanwhile. Each reconnect (not the first connect, which follows the list's own fetch) counts as a change of unknown version, so anything missed while disconnected is fetched. Told changes wait while `useIsSavingItems` is true. While connected, polling slows from 30s to 5 min.
- **Sharing**: `fetchShareCode()` gets a code for the user's own list. `AppBar` calls it on each share, without caching. Opening the app with `?shared=<code>` makes `ShareCodeRedeemer` POST it to `/lists?shared=`, remove the query param, and switch to the redeemed list.
- **Item editing** (`GroceryList.tsx`, `useItemsList`): a new item starts as a client-only temp item with an id starting `new-…`. Saving it is what sends `addItem`, with a fresh `cuid2` id. Code uses `id.startsWith('new')` to tell temp items apart. Saving a new item opens another blank one right away. Items are sorted by `updatedAt`, newest first.
- **UI text**: all user-facing strings are i18n keys in `src/locales/pt-BR/translation.json`, read through `useTranslation().t`.

## Testing

- Tests are integration-style and render the whole `<App />` through `renderWithProviders` in `src/App.spec.tsx`. That helper creates a fresh `QueryClient` (via `createQueryClient()`) and auth client for each test, and returns `{ q, user }`. To simulate the app regaining focus, call `focusManager.setFocused(false)` then `setFocused(true)`; `afterEach` resets it. To simulate no network, use `goOffline()` (sets `onlineManager` offline and makes every request fail); unmount and render again to simulate reopening the app. `afterEach` resets `onlineManager` and clears localStorage, which holds the offline cache.
- The HTTP backend (including `/auth/get-session`) is mocked with **MSW** `setupServer`. Override handlers per test with `server.use(...)`, and build URLs from `settings.baseURL`. In tests, `VITE_BASE_URL` is forced to `http://localhost:12345` (`vite.config.ts`).
- Any request without a matching MSW handler fails the test in `afterEach` (`expect(unhandledRequests).toEqual([])`). Register a handler for every request the test triggers, including follow-up refetches. The server starts with default handlers for the updates ticket and a `ws.link` live connection that never sends anything; override `liveUpdates.addEventListener('connection', …)` to send messages or close it. happy-dom has no `WebSocket`, so `vitest.setup.ts` defines a placeholder that MSW replaces with its mock.
- `vitest.setup.ts` mocks `react-i18next` globally so that `t(key)` returns the key itself. Assert on **i18n keys** (e.g. `findByText('signInMessage')`, `findByLabelText('addItem')`), not on the Portuguese text.
- The test environment is happy-dom, with vitest globals enabled.

## Conventions

`.aider.conventions.md` (gitignored, local only) holds the project conventions. They mostly match the user-level principles. The project-specific points are:

- Function components and custom hooks only. Pull reusable stateful logic out into hooks (`src/hooks/`), and type props with interfaces or types.
- For complex conditional JSX, prefer extracting a component that uses an early return.
- Use semantic HTML and accessible labels. Tests query by `aria-label` and role.
- Ask before adding any npm package.
- TypeScript uses plain `"strict": true` (`tsconfig.app.json`), not `@tsconfig/strictest`. Don't migrate it unless asked.
