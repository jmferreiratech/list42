import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse, ws } from 'msw';
import { setupServer } from 'msw/node';
import { focusManager, onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { createQueryClient, GroceryItem } from './api';
import { setupAuthClient } from './auth';
import { AuthProvider } from './components/Auth';
import settings from './settings';
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
    expect(q.getByRole('tab', {name: 'pending'})).toBeInTheDocument();
    expect(await q.findByText('emptyPending')).toBeInTheDocument();
    expect(q.getByRole('tab', {name: 'pending (0)'})).toBeInTheDocument();
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

  it('moves a completed item back to pending when its name is typed with other case and accents', async () => {
    mockSignedInUser({items: [
      {id: 'item1', name: 'Ração', completed: true},
      {id: 'item2', name: 'Manteiga', completed: false},
    ]});
    let sentItem: GroceryItem | undefined;
    server.use(
      http.put(`${settings.baseURL}/lists/mine/items/item1`, async ({request}) => {
        sentItem = await request.json() as GroceryItem;
        return HttpResponse.json({id: 'mine', items: [sentItem, {id: 'item2', name: 'Manteiga', completed: false}]});
      }),
    );

    const {q, user} = renderWithProviders(<App />);
    await q.findByText('Manteiga');
    await user.click(q.getByLabelText('addItem'));
    await user.keyboard('RACAO{Enter}');

    await waitFor(() => expect(sentItem).toMatchObject({name: 'Ração', completed: false}));
  });

  it('does not add a duplicate of a pending item', async () => {
    mockSignedInUser({items: [{id: 'item1', name: 'Ração', completed: false}]});

    const {q, user} = renderWithProviders(<App />);
    await q.findByText('Ração');
    await user.click(q.getByLabelText('addItem'));
    await user.keyboard('racao{Enter}');

    expect(await q.findByText('itemAlreadyPending')).toBeInTheDocument();
    expect(q.getAllByRole('checkbox', {name: 'Ração'})).toHaveLength(1);
  });

  it('suggests only completed items whose words start with the typed text', async () => {
    mockSignedInUser({items: [
      {id: 'item1', name: 'Pão de forma', completed: true},
      {id: 'item2', name: 'Feijão preto', completed: true},
      {id: 'item3', name: 'Papel toalha', completed: true},
      {id: 'item4', name: 'Pepino', completed: false},
    ]});

    const {q, user} = renderWithProviders(<App />);
    await q.findByText('Pepino');
    await user.click(q.getByLabelText('addItem'));
    await user.keyboard('p');

    const options = await q.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual(['Pão de forma', 'Papel toalha', 'Feijão preto']);
  });

  it('loads changes made elsewhere when the app regains focus', async () => {
    mockSignedInUser({items: []});
    server.use(
      http.get(`${settings.baseURL}/lists/mine`, () => HttpResponse.json({id: 'mine', items: []}), {once: true}),
      http.get(`${settings.baseURL}/lists/mine`, () => {
        return HttpResponse.json({id: 'mine', items: [{id: 'item1', name: 'Café', completed: false}]});
      }),
    );

    const {q} = renderWithProviders(<App />);
    await q.findByText('emptyPending');
    focusManager.setFocused(false);
    focusManager.setFocused(true);

    expect(await q.findByText('Café')).toBeInTheDocument();
  });

  it('keeps a quickly completed item checked when the reply to an earlier change arrives', async () => {
    const leite = {id: 'item1', name: 'Leite', completed: false};
    const pao = {id: 'item2', name: 'Pão', completed: false};
    mockSignedInUser({items: [leite, pao]});
    let isPaoSent = false;
    let sendPaoReply: () => void = () => {};
    const paoReply = new Promise<void>(resolve => { sendPaoReply = resolve; });
    server.use(
      http.put(`${settings.baseURL}/lists/mine/items/item1`, async () => {
        await delay(400);
        return HttpResponse.json({id: 'mine', items: [{...leite, completed: true}, pao]});
      }),
      http.put(`${settings.baseURL}/lists/mine/items/item2`, async () => {
        isPaoSent = true;
        await paoReply;
        return HttpResponse.json({id: 'mine', items: [{...leite, completed: true}, {...pao, completed: true}]});
      }),
    );

    const {q, user} = renderWithProviders(<App />);
    await user.click(await q.findByRole('checkbox', {name: 'Leite'}));
    await user.click(q.getByRole('checkbox', {name: 'Pão'}));
    // Changes to a list are sent one at a time, so Pão goes out only once the reply for Leite is handled.
    await waitFor(() => expect(isPaoSent).toBe(true));

    expect(q.queryByRole('checkbox', {name: 'Pão'})).not.toBeInTheDocument();
    sendPaoReply();
    expect(await q.findByRole('tab', {name: 'completed (2)'})).toBeInTheDocument();
  });

  it('lists completed items by name and filters them by search', async () => {
    mockSignedInUser({items: [
      {id: 'item1', name: 'Pão', completed: true, updatedAt: '2026-10-30T10:00:00Z'},
      {id: 'item2', name: 'Açúcar', completed: true, updatedAt: '2026-10-29T10:00:00Z'},
      {id: 'item3', name: 'Leite', completed: true, updatedAt: '2026-10-31T10:00:00Z'},
    ]});

    const {q, user} = renderWithProviders(<App />);
    await user.click(await q.findByRole('tab', {name: 'completed (3)'}));

    const names = () => q.getAllByRole('checkbox').map(checkbox => checkbox.getAttribute('aria-labelledby'));
    expect(names()).toEqual(['list-item-label-item2', 'list-item-label-item3', 'list-item-label-item1']);

    await user.type(q.getByLabelText('searchCompleted'), 'acu');
    await waitFor(() => expect(names()).toEqual(['list-item-label-item2']));

    await user.type(q.getByLabelText('searchCompleted'), 'xyz');
    expect(await q.findByText('noSearchResults')).toBeInTheDocument();
  });

  it('restores a deleted item when undo is pressed', async () => {
    const leite = {id: 'item1', name: 'Leite', completed: false};
    mockSignedInUser({items: [leite]});
    let restoredItem: GroceryItem | undefined;
    server.use(
      http.delete(`${settings.baseURL}/lists/mine/items/item1`, () => HttpResponse.json({id: 'mine', items: []})),
      http.post(`${settings.baseURL}/lists/mine/items`, async ({request}) => {
        restoredItem = await request.json() as GroceryItem;
        return HttpResponse.json({id: 'mine', items: [restoredItem]});
      }),
    );

    const {q, user} = renderWithProviders(<App />);
    await user.click(await q.findByRole('button', {name: 'deleteItem'}));
    expect(await q.findByText('itemDeleted')).toBeInTheDocument();
    await user.click(q.getByRole('button', {name: 'undo'}));

    expect(await q.findByText('Leite')).toBeInTheDocument();
    expect(restoredItem).toMatchObject(leite);
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

  describe('live changes', () => {
    type LiveClient = Parameters<Parameters<typeof liveUpdates.addEventListener<'connection'>>[1]>[0]['client'];

    // Serves the list as it is now, counts the times it is asked for, and hands over each live connection.
    function serveLiveList(initial: {updatedAt: string; items: GroceryItem[]}) {
      const state = {list: initial, gets: 0, connections: [] as LiveClient[]};
      server.use(
        http.get(`${settings.baseURL}/auth/get-session`, () => HttpResponse.json({user: {id: 'foo'}, session: {}})),
        http.get(`${settings.baseURL}/lists`, () => HttpResponse.json([{id: 'mine', name: 'Minha Lista'}])),
        http.get(`${settings.baseURL}/lists/mine`, () => {
          state.gets++;
          return HttpResponse.json({id: 'mine', ...state.list});
        }),
        liveUpdates.addEventListener('connection', ({client}) => {
          state.connections.push(client);
        }),
      );
      return state;
    }

    function tellChanged(client: LiveClient | undefined, updatedAt: string) {
      client?.send(JSON.stringify({type: 'listChanged', updatedAt}));
    }

    const leite = {id: 'leite', name: 'Leite', completed: false, updatedAt: '2026-10-01T10:00:00.000Z'};
    const pao = {id: 'pao', name: 'Pão', completed: false, updatedAt: '2026-10-01T11:00:00.000Z'};

    it('shows an item the other person added as soon as the change is told', async () => {
      const state = serveLiveList({updatedAt: '2026-10-01T10:00:00.000Z', items: [leite]});
      const {q} = renderWithProviders(<App />);
      await q.findByText('Leite');
      await waitFor(() => expect(state.connections).toHaveLength(1));

      state.list = {updatedAt: '2026-10-01T11:00:00.000Z', items: [leite, pao]};
      tellChanged(state.connections[0], '2026-10-01T11:00:00.000Z');

      expect(await q.findByText('Pão')).toBeInTheDocument();
    });

    it('does not ask for the list again for a change it already has', async () => {
      const state = serveLiveList({updatedAt: '2026-10-01T11:00:00.000Z', items: [leite, pao]});
      const {q} = renderWithProviders(<App />);
      await q.findByText('Pão');
      await waitFor(() => expect(state.connections).toHaveLength(1));
      await delay(100);
      const getsBefore = state.gets;

      // Such as the user's own change, whose reply already brought the list with it.
      tellChanged(state.connections[0], '2026-10-01T11:00:00.000Z');
      tellChanged(state.connections[0], '2026-10-01T10:30:00.000Z');
      await delay(100);
      expect(state.gets).toBe(getsBefore);

      tellChanged(state.connections[0], '2026-10-01T12:00:00.000Z');
      await waitFor(() => expect(state.gets).toBe(getsBefore + 1));
    });

    it('connects again after the connection drops, and picks up what changed meanwhile', async () => {
      const state = serveLiveList({updatedAt: '2026-10-01T10:00:00.000Z', items: [leite]});
      const {q} = renderWithProviders(<App />);
      await q.findByText('Leite');
      await waitFor(() => expect(state.connections).toHaveLength(1));

      state.connections[0]?.close();
      state.list = {updatedAt: '2026-10-01T11:00:00.000Z', items: [leite, pao]};

      await waitFor(() => expect(state.connections).toHaveLength(2), {timeout: 3000});
      expect(await q.findByText('Pão')).toBeInTheDocument();
    });
  });

  describe('offline', () => {
    it('shows the last loaded list when the app opens without network', async () => {
      mockSignedInUser({items: [{id: 'item1', name: 'Leite', completed: false}]});
      const online = renderWithProviders(<App />);
      await online.q.findByText('Leite');
      await waitFor(() => expect(savedOfflineCache()).toContain('Leite'));
      online.q.unmount();

      goOffline();
      const {q} = renderWithProviders(<App />);

      expect(await q.findByText('Leite')).toBeInTheDocument();
      expect(q.getByRole('status')).toHaveTextContent('offline');
    });

    it('sends a change made offline once the connection returns', async () => {
      mockSignedInUser({items: [{id: 'item1', name: 'Leite', completed: false}]});
      const sentItems = recordSentItems();
      const {q, user} = renderWithProviders(<App />);
      await q.findByText('Leite');

      onlineManager.setOnline(false);
      await user.click(q.getByRole('checkbox', {name: 'Leite'}));
      await user.click(q.getByRole('tab', {name: 'completed (1)'}));
      expect(await q.findByTitle('unsentChange')).toBeInTheDocument();
      expect(sentItems).toEqual([]);
      onlineManager.setOnline(true);

      await waitFor(() => expect(sentItems).toMatchObject([{id: 'item1', completed: true}]));
      await waitFor(() => expect(q.queryByTitle('unsentChange')).not.toBeInTheDocument());
    });

    it('sends a change made offline after the app is closed and opened again', async () => {
      mockSignedInUser({items: [{id: 'item1', name: 'Leite', completed: false}]});
      const sentItems = recordSentItems();
      const offline = renderWithProviders(<App />);
      await offline.q.findByText('Leite');
      onlineManager.setOnline(false);
      await offline.user.click(offline.q.getByRole('checkbox', {name: 'Leite'}));
      await waitFor(() => expect(savedOfflineCache()).toContain('"isPaused":true'));
      offline.q.unmount();

      onlineManager.setOnline(true);
      renderWithProviders(<App />);

      await waitFor(() => expect(sentItems).toMatchObject([{id: 'item1', completed: true}]));
    });

    it('shows the list with its unsent change when the app opens again without network', async () => {
      mockSignedInUser({items: [{id: 'item1', name: 'Leite', completed: false}]});
      const online = renderWithProviders(<App />);
      await online.q.findByText('Leite');
      onlineManager.setOnline(false);
      await online.user.click(online.q.getByRole('checkbox', {name: 'Leite'}));
      await waitFor(() => expect(savedOfflineCache()).toContain('"isPaused":true'));
      online.q.unmount();

      goOffline();
      const {q, user} = renderWithProviders(<App />);
      await user.click(await q.findByRole('tab', {name: 'completed (1)'}));

      expect(await q.findByTitle('unsentChange')).toBeInTheDocument();
      expect(q.getByRole('checkbox', {name: 'Leite'})).toBeChecked();
    });

    it('sends the time the change was made', async () => {
      mockSignedInUser({items: [{id: 'item1', name: 'Leite', completed: false}]});
      const sentItems = recordSentItems();
      const {q, user} = renderWithProviders(<App />);

      await user.click(await q.findByRole('checkbox', {name: 'Leite'}));

      await waitFor(() => expect(sentItems).toHaveLength(1));
      expect(Date.parse(sentItems[0].updatedAt ?? '')).not.toBeNaN();
    });

    it('sends the time an item was deleted', async () => {
      mockSignedInUser({items: [{id: 'item1', name: 'Leite', completed: false}]});
      const sentDeletes: {updatedAt?: string}[] = [];
      server.use(
        http.delete(`${settings.baseURL}/lists/mine/items/item1`, async ({request}) => {
          sentDeletes.push(await request.json() as {updatedAt?: string});
          return HttpResponse.json({id: 'mine', items: []});
        }),
      );
      const {q, user} = renderWithProviders(<App />);

      await user.click(await q.findByRole('button', {name: 'deleteItem'}));

      await waitFor(() => expect(sentDeletes).toHaveLength(1));
      expect(Date.parse(sentDeletes[0].updatedAt ?? '')).not.toBeNaN();
    });

    it('forgets the saved lists when the user signs out', async () => {
      mockSignedInUser({items: [{id: 'item1', name: 'Leite', completed: false}]});
      const {q, user} = renderWithProviders(<App />);
      await q.findByText('Leite');
      await waitFor(() => expect(savedOfflineCache()).toContain('Leite'));
      server.use(
        http.post(`${settings.baseURL}/auth/sign-out`, () => HttpResponse.json({success: true})),
        http.get(`${settings.baseURL}/auth/get-session`, () => HttpResponse.json(null)),
      );

      await user.click(q.getByTestId('PersonIcon'));
      await user.click(await q.findByText('logout'));

      expect(await q.findByText('signInMessage')).toBeInTheDocument();
      await waitFor(() => expect(savedOfflineCache()).toBeNull());
      goOffline();
      const reopened = renderWithProviders(<App />);
      expect(await reopened.q.findAllByText('signInMessage')).not.toHaveLength(0);
    });
  });
});

function savedOfflineCache(): string | null {
  return localStorage.getItem('list42.offlineCache');
}

// The device has no network: every request fails, as fetch does offline.
function goOffline() {
  onlineManager.setOnline(false);
  server.use(http.all('*', () => HttpResponse.error()));
}

function recordSentItems(): GroceryItem[] {
  const sentItems: GroceryItem[] = [];
  server.use(
    http.put(`${settings.baseURL}/lists/mine/items/:id`, async ({request}) => {
      const item = await request.json() as GroceryItem;
      sentItems.push(item);
      return HttpResponse.json({id: 'mine', items: [item]});
    }),
  );
  return sentItems;
}

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

// Every open list connects for live changes. By default the connection opens and never tells anything.
const liveUpdates = ws.link('ws://localhost:12345/updates');
const liveUpdatesHandlers = [
  http.get(`${settings.baseURL}/lists/:listId/updates-ticket`, () => {
    return HttpResponse.json({url: 'ws://localhost:12345/updates', token: 'test-token'});
  }),
  liveUpdates.addEventListener('connection', () => {}),
];

const server = setupServer(...liveUpdatesHandlers);

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
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  server.resetHandlers();
  expect(unhandledRequests).toEqual([]);
});

afterAll(() => server.close());

export function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  const authClient = setupAuthClient();

  function Wrapper({children}: {children: ReactNode}) {
    return (
      <QueryClientProvider client={queryClient}>
          <AuthProvider client={authClient}>
            {children}
          </AuthProvider>
      </QueryClientProvider>
    );
  }

  return {
    q: render(ui, {wrapper: Wrapper}),
    user: userEvent.setup(),
  };
}
