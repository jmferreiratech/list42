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
    /** The list's updatedAt after the change, so a client that already has it can skip the refetch. */
    updatedAt: string | null;
}

// Tells every connection watching the list that it changed. The message is only a hint to refetch,
// so a connection that can't be reached is skipped instead of failing the others.
export async function notifyListChanged(settings: Settings, list: string, updatedAt: string | null): Promise<void> {
    const connections = ConnectionsRepository.config(settings);
    const ids = await connections.listIdsByList(list);
    if (!ids.length) {
        return;
    }

    const client = new ApiGatewayManagementApiClient({endpoint: managementEndpoint(settings.updatesURL)});
    const message: ListChangedMessage = {type: 'listChanged', updatedAt};
    const Data = JSON.stringify(message);

    await Promise.all(ids.map(async (ConnectionId) => {
        try {
            await client.send(new PostToConnectionCommand({ConnectionId, Data}));
        } catch (error) {
            if (error instanceof GoneException) {
                await connections.remove(ConnectionId);
                return;
            }
            logger.error('Failed to notify connection', {ConnectionId, list, error});
        }
    }));
}

// Messages are posted over HTTPS to the same API the clients connect to.
function managementEndpoint(updatesURL: string): string {
    return updatesURL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}
