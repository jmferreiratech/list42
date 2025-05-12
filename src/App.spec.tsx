import { cleanup, render, RenderOptions, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Provider } from 'react-redux';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { setupAuthClient } from './auth';
import { AuthProvider } from './components/Auth';
import settings from './settings';
import { AppStore, RootState, setupStore } from './store';
import { ReactNode } from 'react';

describe('App', () => {

  it('renders sign in screen when no active session if found', async () => {
    server.use(
      http.get(`${settings.baseURL}/auth/get-session`, () => {
        return HttpResponse.json(null, {status: 200});
      })
    )
    
    const {q} = renderWithProviders(<App />);

    expect(await q.findByText('signInMessage')).toBeInTheDocument();
  });

  it('renders users list', async () => {
    server.use(
      http.get(`${settings.baseURL}/auth/get-session`, () => {
        return HttpResponse.json({user: {id: 'foo'}, session: {}});
      }),
      http.get(`${settings.baseURL}/lists`, () => {
        return HttpResponse.json([{id: 'mine', name: 'Minha Lista'}]);
      }),
      http.get(`${settings.baseURL}/lists/mine`, () => {
        return HttpResponse.json({id: 'mine', name: 'Minha Lista', items: [{id: 'first', name: 'First Item', completed: false}]});
      }),
    );
    
    const {q} = renderWithProviders(<App />);

    expect(await q.findByText('First Item')).toBeInTheDocument();
  });

  it('adds an empty new item when FAB is hit', async () => {
    server.use(
      http.get(`${settings.baseURL}/auth/get-session`, () => {
        return HttpResponse.json({user: {id: 'foo'}, session: {}});
      }),
      http.get(`${settings.baseURL}/lists`, () => {
        return HttpResponse.json([{id: 'mine', name: 'Minha Lista'}]);
      }),
      http.get(`${settings.baseURL}/lists/mine`, () => {
        return HttpResponse.json({id: 'mine', name: 'Minha Lista', items: [{id: 'first', name: 'First Item', completed: false}]});
      }),
    );
    
    const {q, user} = renderWithProviders(<App />);
    
    await q.findByText('First Item');
    
    const fabButton = await q.findByLabelText('addItem');
    await user.click(fabButton);
    
    const items = await q.findAllByRole('listitem');
    expect(items.length).toBe(2);
  });

  it('sends a new item when submited', async () => {
    server.use(
      http.get(`${settings.baseURL}/auth/get-session`, () => {
        return HttpResponse.json({user: {id: 'foo'}, session: {}});
      }),
      http.get(`${settings.baseURL}/lists`, () => {
        return HttpResponse.json([{id: 'mine', name: 'Minha Lista'}]);
      }),
      http.get(`${settings.baseURL}/lists/mine`, () => {
        return HttpResponse.json({id: 'mine', name: 'Minha Lista', items: [{id: 'first', name: 'First Item', completed: false}]});
      }),
      http.post(`${settings.baseURL}/lists/mine/items`, async ({request}) => {
        const body = await request.json() as {name: string; completed: boolean};

        return HttpResponse.json({
          id: 'mine', 
          name: 'Minha Lista', 
          items: [
            {id: 'first', name: 'First Item', completed: false},
            {id: 'new-item', name: body.name, completed: body.completed || false}
          ]
        });
      }, {once: true}),
    );
    
    const {q, user} = renderWithProviders(<App />);
    
    await q.findByText('First Item');
    
    const fabButton = await q.findByLabelText('addItem');
    await user.click(fabButton);

    if (document.activeElement) {
      await user.type(document.activeElement, 'Novo Item de Teste');
    }
    
    await user.keyboard('{Enter}');
    
    expect(await q.findByText('Novo Item de Teste')).toBeInTheDocument();
  });

  it('suggests existent items on autocomplete', async () => {
    server.use(
      http.get(`${settings.baseURL}/auth/get-session`, () => {
        return HttpResponse.json({user: {id: 'foo'}, session: {}});
      }),
      http.get(`${settings.baseURL}/lists`, () => {
        return HttpResponse.json([{id: 'mine', name: 'Minha Lista'}]);
      }),
      http.get(`${settings.baseURL}/lists/mine`, () => {
        return HttpResponse.json({
          id: 'mine', 
          name: 'Minha Lista', 
          items: [
            {id: 'item1', name: 'Leite', completed: true},
            {id: 'item2', name: 'Pão', completed: true},
            {id: 'item3', name: 'Manteiga', completed: false}
          ]
        });
      }),
    );
    
    const {q, user} = renderWithProviders(<App />);
    
    await q.findByText('Manteiga');
    
    await user.click((await q.findByLabelText('addItem')));
    
    if (document.activeElement) {
      await user.type(document.activeElement, 'Le');
    } 

    expect((await q.findByText('Leite'))).toBeInTheDocument();
  });

  it('uses existent item even if it is not selected', async () => {
    server.use(
      http.get(`${settings.baseURL}/auth/get-session`, () => {
        return HttpResponse.json({user: {id: 'foo'}, session: {}});
      }),
      http.get(`${settings.baseURL}/lists`, () => {
        return HttpResponse.json([{id: 'mine', name: 'Minha Lista'}]);
      }),
      http.get(`${settings.baseURL}/lists/mine`, () => {
        return HttpResponse.json({
          id: 'mine', 
          name: 'Minha Lista', 
          items: [
            {id: 'item1', name: 'Leite', completed: true},
            {id: 'item2', name: 'Pão', completed: true},
            {id: 'item3', name: 'Manteiga', completed: false}
          ]
        });
      }),
      http.put(`${settings.baseURL}/lists/mine/items/item1`, async ({request}) => {
        const body = await request.json() as {name: string; completed: boolean};

        return HttpResponse.json({
          id: 'mine', 
          name: 'Minha Lista', 
          items: [
            {id: 'item1', name: 'Leite', completed: body.completed},
            {id: 'item2', name: 'Pão', completed: true},
            {id: 'item3', name: 'Manteiga', completed: false}
          ]
        });
      }),
    );
    
    const {q, user} = renderWithProviders(<App />);
    
    await q.findByText('Manteiga');
    
    await user.click((await q.findByLabelText('addItem')));
    
    if (document.activeElement) {
      await user.type(document.activeElement, 'Leite');
    }
    await user.keyboard('{Enter}');

    await waitFor(() => {});
    await q.findByText('Leite');
  });
});

const server = setupServer();

let unhandledRequests: string[] = [];

beforeAll(() => server.listen({
  onUnhandledRequest: (req) => {
    unhandledRequests.push(`${req.method} ${req.url}`);
  },
}));

beforeEach(() => {
  unhandledRequests = [];
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  expect(unhandledRequests).toEqual([]);
});

afterAll(() => server.close());

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: Partial<RootState>
  store?: AppStore
}

export function renderWithProviders(ui: React.ReactElement, extendedRenderOptions: ExtendedRenderOptions = {}) {
  const {
    preloadedState = {},
    store = setupStore(preloadedState),
    ...renderOptions
  } = extendedRenderOptions;

  const authClient = setupAuthClient();

  function Wrapper({children}: {children: ReactNode}) {
    return (
      <Provider store={store}>
          <AuthProvider client={authClient}>
            {children}
          </AuthProvider>
      </Provider>
    );
  }

  const {
    container,
    baseElement,
    debug,
    rerender,
    unmount,
    asFragment,
    ...queries
  } = render(ui, {wrapper: Wrapper, ...renderOptions});
  return {
    store,
    user: userEvent.setup(),
    container,
    baseElement,
    debug,
    rerender,
    unmount,
    asFragment,
    q: queries,
  };
}
