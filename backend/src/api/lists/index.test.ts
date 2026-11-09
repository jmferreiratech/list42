import {createId} from '@paralleldrive/cuid2';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import app from '.';
import auth from '../../modules/auth';
import {verifyUpdatesToken} from '../../modules/updates';
import settings from '../../settings';

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

interface ItemInput {
    id: string;
    name: string;
    completed: boolean;
    updatedAt?: string;
}

interface ListResponse {
    items: (ItemInput & {updatedAt: string})[];
    version?: number;
}

describe('lists API item changes', () => {
    let server: Server;
    let baseURL: string;

    beforeAll(async () => {
        server = app.listen(0);
        await new Promise(resolve => server.once('listening', resolve));
        baseURL = `http://localhost:${String((server.address() as AddressInfo).port)}/api/lists/mine/items`;
    });

    afterAll(() => {
        server.close();
    });

    beforeEach(() => {
        // Each test signs in as a new user, so it starts with an empty list of its own.
        vi.spyOn(auth.api, 'getSession').mockResolvedValue({
            user: {id: createId()},
            session: {},
        } as AuthSession);
    });

    it('keeps a newer change when an older change made offline arrives later', async () => {
        const id = createId();
        await addItem({id, name: 'Leite', completed: false, updatedAt: '2026-10-01T10:00:00.000Z'});
        await updateItem({id, name: 'Leite', completed: true, updatedAt: '2026-10-01T12:00:00.000Z'});

        const list = await updateItem({id, name: 'Leite integral', completed: false, updatedAt: '2026-10-01T11:00:00.000Z'});

        expect(list.items).toEqual([expect.objectContaining({id, name: 'Leite', completed: true})]);
    });

    it('saves a change made after the stored one, keeping its time', async () => {
        const id = createId();
        await addItem({id, name: 'Pão', completed: false, updatedAt: '2026-10-01T10:00:00.000Z'});

        const list = await updateItem({id, name: 'Pão', completed: true, updatedAt: '2026-10-01T11:00:00.000Z'});

        expect(list.items).toEqual([expect.objectContaining({id, completed: true, updatedAt: '2026-10-01T11:00:00.000Z'})]);
    });

    it('does not bring back an older version of an item through a late add', async () => {
        const id = createId();
        await addItem({id, name: 'Café', completed: true, updatedAt: '2026-10-01T12:00:00.000Z'});

        const list = await addItem({id, name: 'Café', completed: false, updatedAt: '2026-10-01T09:00:00.000Z'});

        expect(list.items).toEqual([expect.objectContaining({id, completed: true})]);
    });

    it('caps a change time ahead of the server clock at the time it arrives', async () => {
        const id = createId();
        const before = new Date();

        const list = await addItem({id, name: 'Arroz', completed: false, updatedAt: '2999-01-01T00:00:00.000Z'});

        const savedTime = new Date(list.items[0]?.updatedAt ?? '');
        expect(savedTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(savedTime.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('rejects a change time that is not a date', async () => {
        const response = await send('POST', baseURL, {id: createId(), name: 'Feijão', completed: false, updatedAt: 'yesterday'});

        expect(response.status).toBe(400);
    });

    it('keeps changes to different items of the same list made at the same time', async () => {
        const items = ['Ovos', 'Manteiga', 'Queijo', 'Tomate', 'Cebola'].map(name => ({id: createId(), name, completed: false}));

        await Promise.all(items.map(addItem));

        const list = await getList();
        expect(list.items.map(i => i.name).sort()).toEqual(items.map(i => i.name).sort());
    });

    it('deletes an item', async () => {
        const id = createId();
        await addItem({id, name: 'Sal', completed: false, updatedAt: '2026-10-01T10:00:00.000Z'});

        const list = await deleteItem(id, {updatedAt: '2026-10-01T11:00:00.000Z'});

        expect(list.items).toEqual([]);
    });

    it('deletes an item when the delete carries no time', async () => {
        const id = createId();
        await addItem({id, name: 'Sal', completed: false, updatedAt: '2026-10-01T10:00:00.000Z'});

        const list = await deleteItem(id);

        expect(list.items).toEqual([]);
    });

    it('does not bring back a deleted item through an older change arriving later', async () => {
        const id = createId();
        await addItem({id, name: 'Óleo', completed: false, updatedAt: '2026-10-01T10:00:00.000Z'});
        await deleteItem(id, {updatedAt: '2026-10-01T12:00:00.000Z'});

        const list = await updateItem({id, name: 'Óleo', completed: true, updatedAt: '2026-10-01T11:00:00.000Z'});

        expect(list.items).toEqual([]);
    });

    it('keeps a newer change when an older delete made offline arrives later', async () => {
        const id = createId();
        await addItem({id, name: 'Farinha', completed: false, updatedAt: '2026-10-01T10:00:00.000Z'});
        await updateItem({id, name: 'Farinha', completed: true, updatedAt: '2026-10-01T12:00:00.000Z'});

        const list = await deleteItem(id, {updatedAt: '2026-10-01T11:00:00.000Z'});

        expect(list.items).toEqual([expect.objectContaining({id, completed: true})]);
    });

    it('counts up the list version for each saved change, but not for an ignored one', async () => {
        const id = createId();
        const added = await addItem({id, name: 'Uva', completed: false, updatedAt: '2026-10-01T10:00:00.000Z'});
        const updated = await updateItem({id, name: 'Uva', completed: true, updatedAt: '2026-10-01T12:00:00.000Z'});
        const ignored = await updateItem({id, name: 'Uva', completed: false, updatedAt: '2026-10-01T11:00:00.000Z'});
        const deleted = await deleteItem(id, {updatedAt: '2026-10-01T13:00:00.000Z'});

        expect([added.version, updated.version, ignored.version, deleted.version]).toEqual([1, 2, 2, 3]);
    });

    async function addItem(item: ItemInput): Promise<ListResponse> {
        return await json(await send('POST', baseURL, item));
    }

    async function updateItem(item: ItemInput): Promise<ListResponse> {
        return await json(await send('PUT', `${baseURL}/${item.id}`, item));
    }

    async function deleteItem(id: string, body?: {updatedAt: string}): Promise<ListResponse> {
        return await json(await send('DELETE', `${baseURL}/${id}`, body));
    }

    async function getList(): Promise<ListResponse> {
        return await json(await fetch(baseURL.replace(/\/items$/, '')));
    }
});

describe('lists API updates ticket', () => {
    let server: Server;
    let baseURL: string;
    let userId: string;

    beforeAll(async () => {
        server = app.listen(0);
        await new Promise(resolve => server.once('listening', resolve));
        baseURL = `http://localhost:${String((server.address() as AddressInfo).port)}/api/lists`;
    });

    afterAll(() => {
        server.close();
    });

    beforeEach(() => {
        userId = createId();
        vi.spyOn(auth.api, 'getSession').mockResolvedValue({
            user: {id: userId},
            session: {},
        } as AuthSession);
    });

    it('gives where to connect and a token for the user\'s own list', async () => {
        const response = await fetch(`${baseURL}/mine/updates-ticket`);

        expect(response.status).toBe(200);
        const ticket = await response.json() as {url: string; token: string};
        expect(ticket.url).toBe(settings.updatesURL);
        expect(verifyUpdatesToken(settings, ticket.token)).toEqual({user: userId, list: userId});
    });

    it('gives no ticket for a list the user can\'t see', async () => {
        const response = await fetch(`${baseURL}/${createId()}/updates-ticket`);

        expect(response.status).toBe(404);
    });
});

async function send(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<Response> {
    if (body === undefined) {
        return await fetch(url, {method});
    }
    return await fetch(url, {
        method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    });
}

async function json(response: Response): Promise<ListResponse> {
    expect(response.status).toBe(200);
    return await response.json() as ListResponse;
}
