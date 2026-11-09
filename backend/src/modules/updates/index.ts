import {ApiGatewayManagementApiClient, GoneException, PostToConnectionCommand} from '@aws-sdk/client-apigatewaymanagementapi';
import jwt from 'jsonwebtoken';

import ConnectionsRepository from './repository';
import logger from '../../logger';
import type {Settings} from '../../settings';

// Browsers can't send headers or the session cookie (it belongs to another host) when opening a WebSocket,
// so the client first gets this token through the lists API and passes it in the connection URL.
const TOKEN_AUDIENCE = 'list-updates';
const TOKEN_LIFETIME = '1m';

export interface UpdatesSubscription {
    user: string;
    list: string;
}

export function signUpdatesToken(settings: Settings, {user, list}: UpdatesSubscription): string {
    return jwt.sign({list}, settings.jwtSecret, {
        subject: user,
        audience: TOKEN_AUDIENCE,
        expiresIn: TOKEN_LIFETIME,
    });
}

export function verifyUpdatesToken(settings: Settings, token: string | undefined): UpdatesSubscription | null {
    if (!token) {
        return null;
    }

    try {
        const payload = jwt.verify(token, settings.jwtSecret, {audience: TOKEN_AUDIENCE}) as jwt.JwtPayload;
        if (typeof payload.sub !== 'string' || typeof payload.list !== 'string') {
            return null;
        }
        return {user: payload.sub, list: payload.list};
    } catch (error) {
        logger.warn('Updates token verification failed', {message: (error as Error).message});
        return null;
    }
}

export interface ListChangedMessage {
    type: 'listChanged';
    /** The list's version after the change, so a client that already has it can skip the refetch. */
    version: number;
}

// Tells connections watching a list that it changed. Create one per invocation and reuse it for every list,
// so its clients are set up once. A message is only a hint to refetch, so a connection that can't be reached
// is skipped instead of failing the others (or the stream batch, whose retry would tell everyone again).
export class ListChangeNotifier {
    private readonly connections: ConnectionsRepository;
    private readonly client: ApiGatewayManagementApiClient;

    static config(settings: Settings) {
        return new ListChangeNotifier(
            ConnectionsRepository.config(settings),
            new ApiGatewayManagementApiClient({endpoint: managementEndpoint(settings.updatesURL)}),
        );
    }

    async notify(list: string, version: number): Promise<void> {
        const ids = await this.connections.listIdsByList(list);
        const message: ListChangedMessage = {type: 'listChanged', version};
        const Data = JSON.stringify(message);

        await Promise.all(ids.map(async (ConnectionId) => {
            try {
                await this.client.send(new PostToConnectionCommand({ConnectionId, Data}));
            } catch (error) {
                if (error instanceof GoneException) {
                    await this.forget(ConnectionId);
                    return;
                }
                logger.error('Failed to notify connection', {ConnectionId, list, error});
            }
        }));
    }

    // If this fails, the row's TTL removes it later.
    private async forget(ConnectionId: string): Promise<void> {
        try {
            await this.connections.remove(ConnectionId);
        } catch (error) {
            logger.error('Failed to remove a gone connection', {ConnectionId, error});
        }
    }

    constructor(connections: ConnectionsRepository, client: ApiGatewayManagementApiClient) {
        this.connections = connections;
        this.client = client;
    }
}

// Messages are posted over HTTPS to the same API the clients connect to.
function managementEndpoint(updatesURL: string): string {
    return updatesURL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}
