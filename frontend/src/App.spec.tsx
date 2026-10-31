import { cleanup, fireEvent, render, RenderOptions, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Provider } from 'react-redux';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { GroceryItem } from './api';
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

  it('shows completed items when swiping left to the screen edge', async () => {
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
            {id: 'item2', name: 'Manteiga', completed: false}
          ]
        });
      }),
    );

    const {q} = renderWithProviders(<App />);
    const list = (await q.findByText('Manteiga')).closest('ul');
    if (!list) throw new Error('Grocery list not found');

    fireEvent.touchStart(list, {targetTouches: [{clientX: 100}]});
    fireEvent.touchMove(list, {targetTouches: [{clientX: 0}]});
    fireEvent.touchEnd(list);

    expect(await q.findByText('Leite')).toBeInTheDocument();
  });

  it('hides the share button on a list shared with the user', async () => {
    localStorage.setItem('foo.selectedListId', JSON.stringify('shared-list'));
    mockSignedInUser({
      items: [{id: 'item1', name: 'Leite', completed: false}],
      lists: [{id: 'mine', name: 'Minha Lista'}, {id: 'shared-list', name: 'Lista da Ana'}],
    });

    const {q} = renderWithProviders(<App />);
    await q.findByText('Leite');

    expect(q.queryByLabelText('share')).not.toBeInTheDocument();
  });

  it('keeps the checkbox unchecked when completing an item fails', async () => {
    mockSignedInUser({items: [{id: 'item1', name: 'Leite', completed: false}]});
    server.use(
      http.put(`${settings.baseURL}/lists/mine/items/item1`, () => HttpResponse.json({}, {status: 500})),
    );

    const {q, user} = renderWithProviders(<App />);
    await user.click(await q.findByRole('checkbox', {name: 'Leite'}));

    expect(await q.findByText('updateItemError')).toBeInTheDocument();
    expect(await q.findByRole('checkbox', {name: 'Leite'})).not.toBeChecked();
  });

  it('deletes an item from its labeled delete button', async () => {
    mockSignedInUser({items: [{id: 'item1', name: 'Leite', completed: false}]});
    server.use(
      http.delete(`${settings.baseURL}/lists/mine/items/item1`, () => {
        return HttpResponse.json({id: 'mine', items: []});
      }),
    );

    const {q, user} = renderWithProviders(<App />);
    await q.findByText('Leite');
    await user.click(q.getByRole('button', {name: 'deleteItem'}));

    await waitFor(() => expect(q.queryByText('Leite')).not.toBeInTheDocument());
  });

  it('completes an item using only the keyboard', async () => {
    mockSignedInUser({items: [{id: 'item1', name: 'Leite', completed: false}]});
    server.use(
      http.put(`${settings.baseURL}/lists/mine/items/item1`, async ({request}) => {
        const item = await request.json() as GroceryItem;
        return HttpResponse.json({id: 'mine', items: [item]});
      }),
    );

    const {q, user} = renderWithProviders(<App />);
    const checkbox = await q.findByRole('checkbox', {name: 'Leite'});
    checkbox.focus();
    await user.keyboard(' ');

    await waitFor(() => expect(q.queryByText('Leite')).not.toBeInTheDocument());
  });

  it('starts editing an item using only the keyboard', async () => {
    mockSignedInUser({items: [{id: 'item1', name: 'Leite', completed: false}]});

    const {q, user} = renderWithProviders(<App />);
    (await q.findByRole('button', {name: 'editItem'})).focus();
    await user.keyboard('{Enter}');

    expect(await q.findByRole('combobox')).toHaveValue('Leite');
  });

  it('shows an empty message when nothing is pending', async () => {
    mockSignedInUser({items: [{id: 'item1', name: 'Leite', completed: true}]});

    const {q} = renderWithProviders(<App />);

    expect(await q.findByText('emptyPending')).toBeInTheDocument();
  });

  it('shows a loading indicator while the list loads', async () => {
    mockSignedInUser({items: []});
    server.use(
      http.get(`${settings.baseURL}/lists/mine`, async () => {
        await delay(200);
        return HttpResponse.json({id: 'mine', items: []});
      }),
    );

    const {q} = renderWithProviders(<App />);

    expect(await q.findByRole('progressbar', {name: 'loading'})).toBeInTheDocument();
    expect(await q.findByText('emptyPending')).toBeInTheDocument();
  });

  it('shows an error and loads the list again on retry', async () => {
    mockSignedInUser({items: []});
    server.use(
      http.get(`${settings.baseURL}/lists/mine`, () => HttpResponse.json({}, {status: 500}), {once: true}),
      http.get(`${settings.baseURL}/lists/mine`, () => {
        return HttpResponse.json({id: 'mine', items: [{id: 'item1', name: 'Leite', completed: false}]});
      }),
    );

    const {q, user} = renderWithProviders(<App />);
    expect(await q.findByText('loadListError')).toBeInTheDocument();
    await user.click(q.getByRole('button', {name: 'retry'}));

    expect(await q.findByText('Leite')).toBeInTheDocument();
  });

  it('shows how many items each tab holds', async () => {
    mockSignedInUser({items: [
      {id: 'item1', name: 'Leite', completed: true},
      {id: 'item2', name: 'Pão', completed: true},
      {id: 'item3', name: 'Manteiga', completed: false},
    ]});

    const {q} = renderWithProviders(<App />);

    expect(await q.findByRole('tab', {name: 'pending (1)'})).toBeInTheDocument();
    expect(q.getByRole('tab', {name: 'completed (2)'})).toBeInTheDocument();
  });

  it('shows a placeholder in the new item field', async () => {
    mockSignedInUser({items: []});

    const {q, user} = renderWithProviders(<App />);
    await user.click(await q.findByLabelText('addItem'));

    expect(await q.findByPlaceholderText('enterItemName')).toHaveFocus();
  });

  it('shows the list name in the app bar when the user has a single list', async () => {
    mockSignedInUser({items: [], lists: [{id: 'mine', name: 'Minha Lista'}]});

    const {q} = renderWithProviders(<App />);

    expect(await q.findByRole('heading', {name: 'Minha Lista'})).toBeInTheDocument();
  });

  it('shows an error toast when sign in fails', async () => {
    server.use(
      http.get(`${settings.baseURL}/auth/get-session`, () => HttpResponse.json(null)),
      http.post(`${settings.baseURL}/auth/sign-in/social`, () => HttpResponse.json({message: 'boom'}, {status: 500})),
    );

    const {q, user} = renderWithProviders(<App />);
    await user.click(await q.findByText('signInWithGoogle'));

    expect(await q.findByText('signInError')).toBeInTheDocument();
  });

  it('shows an error toast when sign out fails', async () => {
    mockSignedInUser({items: []});
    server.use(
      http.post(`${settings.baseURL}/auth/sign-out`, () => HttpResponse.json({message: 'boom'}, {status: 500})),
    );

    const {q, user} = renderWithProviders(<App />);
    await user.click(await q.findByTestId('PersonIcon'));
    await user.click(await q.findByText('logout'));

    expect(await q.findByText('signOutError')).toBeInTheDocument();
  });

  it('builds the share link from the app base path, dropping the current query and hash', async () => {
    window.history.replaceState({}, '', '/list42/?foo=bar#section');
    mockSignedInUser({items: []});
    server.use(
      http.get(`${settings.baseURL}/lists/mine/share-code`, () => HttpResponse.json('abc123')),
    );

    const {q, user} = renderWithProviders(<App />);
    await user.click(await q.findByLabelText('share'));

    await waitFor(async () => {
      expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/list42/?shared=abc123`);
    });
  });
});

interface MockSignedInUserOptions {
  items: GroceryItem[];
  lists?: {id: string; name: string}[];
}

function mockSignedInUser({items, lists = [{id: 'mine', name: 'Minha Lista'}]}: MockSignedInUserOptions) {
  server.use(
    http.get(`${settings.baseURL}/auth/get-session`, () => {
      return HttpResponse.json({user: {id: 'foo'}, session: {}});
    }),
    http.get(`${settings.baseURL}/lists`, () => HttpResponse.json(lists)),
    http.get(`${settings.baseURL}/lists/:listId`, ({params}) => {
      return HttpResponse.json({id: params.listId, name: 'Minha Lista', items});
    }),
  );
}

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
  localStorage.clear();
  window.history.replaceState({}, '', '/');
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
