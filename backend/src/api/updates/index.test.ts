import {
    ApiGatewayManagementApiClient,
    GoneException,
    type PostToConnectionCommandInput,
} from '@aws-sdk/client-apigatewaymanagementapi';
import {createId} from '@paralleldrive/cuid2';
import type {DynamoDBStreamEvent} from 'aws-lambda';
import jwt from 'jsonwebtoken';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {handleConnectionEvent, handleListChanges} from '.';
import {signUpdatesToken} from '../../modules/updates';
import ConnectionsRepository from '../../modules/updates/repository';
import settings from '../../settings';

describe('list updates', () => {
    let posted: {ConnectionId: string; Data: unknown}[];
    let gone: Set<string>;

    beforeEach(() => {
        posted = [];
        gone = new Set();
        const send = (command: {input: PostToConnectionCommandInput}) => {
            const {ConnectionId = '', Data} = command.input;
            if (gone.has(ConnectionId)) {
                return Promise.reject(new GoneException({message: 'Gone', $metadata: {}}));
            }
            posted.push({ConnectionId, Data: JSON.parse(Data as string)});
            return Promise.resolve({});
        };
        vi.spyOn(ApiGatewayManagementApiClient.prototype, 'send')
            // send() also has a callback overload returning void, which its typing would pick.
            .mockImplementation(send as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('tells the connections watching a list that it changed', async () => {
        const list = createId();
        const watching = await connect(list);
        await connect(createId());

        await handleListChanges(streamEvent([list, '2026-10-01T10:00:00.000Z']));

        expect(posted).toEqual([{ConnectionId: watching, Data: {type: 'listChanged', updatedAt: '2026-10-01T10:00:00.000Z'}}]);
    });

    it('tells each list once per batch, with its newest change', async () => {
        const list = createId();
        const watching = await connect(list);

        await handleListChanges(streamEvent(
            [list, '2026-10-01T10:00:00.000Z'],
            [list, '2026-10-01T12:00:00.000Z'],
            [list, '2026-10-01T11:00:00.000Z'],
        ));

        expect(posted).toEqual([{ConnectionId: watching, Data: {type: 'listChanged', updatedAt: '2026-10-01T12:00:00.000Z'}}]);
    });

    it('does not tell about a list created empty, before its first item', async () => {
        const list = createId();
        await connect(list);

        await handleListChanges(streamEvent([list, null]));

        expect(posted).toEqual([]);
    });

    it('stops telling a connection that is gone', async () => {
        const list = createId();
        const connection = await connect(list);
        gone.add(connection);

        await handleListChanges(streamEvent([list, '2026-10-01T10:00:00.000Z']));

        expect(await connectionsTo(list)).toEqual([]);
    });

    it('forgets a connection once it closes', async () => {
        const list = createId();
        const connection = await connect(list);

        await handleConnectionEvent({requestContext: {connectionId: connection, eventType: 'DISCONNECT'}});

        expect(await connectionsTo(list)).toEqual([]);
    });

    it.each([
        ['no token', undefined],
        ['a token that is not valid', 'not-a-token'],
        ['an expired token', jwt.sign({list: 'some-list'}, settings.jwtSecret, {subject: 'someone', audience: 'list-updates', expiresIn: -1})],
        ['a share code', jwt.sign({iss: 'some-list', jti: createId()}, settings.jwtSecret, {expiresIn: '24h'})],
    ])('refuses a connection with %s', async (_name, token) => {
        const result = await handleConnectionEvent({
            requestContext: {connectionId: createId(), eventType: 'CONNECT'},
            queryStringParameters: token ? {token} : null,
        });

        expect(result.statusCode).toBe(401);
    });

    async function connect(list: string): Promise<string> {
        const connectionId = createId();
        const token = signUpdatesToken(settings, {user: createId(), list});

        const result = await handleConnectionEvent({
            requestContext: {connectionId, eventType: 'CONNECT'},
            queryStringParameters: {token},
        });

        expect(result.statusCode).toBe(200);
        return connectionId;
    }

    function connectionsTo(list: string) {
        return ConnectionsRepository.config(settings).listIdsByList(list);
    }
});

function streamEvent(...changes: [string, string | null][]): DynamoDBStreamEvent {
    return {
        Records: changes.map(([id, updatedAt]) => ({
            eventName: 'MODIFY',
            dynamodb: {
                Keys: {id: {S: id}},
                NewImage: {id: {S: id}, updatedAt: updatedAt ? {S: updatedAt} : {NULL: true}},
            },
        })),
    };
}
