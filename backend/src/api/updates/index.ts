import type {DynamoDBStreamEvent} from 'aws-lambda';

import logger from '../../logger';
import {ListChangeNotifier, verifyUpdatesToken} from '../../modules/updates';
import ConnectionsRepository from '../../modules/updates/repository';
import settings from '../../settings';

// The parts of an API Gateway WebSocket event used here.
export interface WebSocketEvent {
    requestContext: {
        connectionId: string;
        eventType: 'CONNECT' | 'DISCONNECT' | 'MESSAGE';
    };
    queryStringParameters?: Record<string, string | undefined> | null;
}

export interface WebSocketResult {
    statusCode: number;
}

// Clients only listen. Messages they send are keep-alive pings, so a quiet connection isn't closed after 10 minutes.
export async function handleConnectionEvent(event: WebSocketEvent): Promise<WebSocketResult> {
    const {connectionId, eventType} = event.requestContext;
    const connections = ConnectionsRepository.config(settings);

    switch (eventType) {
        case 'CONNECT': {
            // The token was signed only after the lists API checked that the user can see the list.
            const subscription = verifyUpdatesToken(settings, event.queryStringParameters?.token);
            if (!subscription) {
                return {statusCode: 401};
            }
            await connections.create({id: connectionId, ...subscription});
            return {statusCode: 200};
        }
        case 'DISCONNECT':
            await connections.remove(connectionId);
            return {statusCode: 200};
        default:
            return {statusCode: 200};
    }
}

// Each write to grocery_lists arrives here through the table's stream. A batch can hold several
// changes to one list, so each list is notified once, with its newest version.
export async function handleListChanges(event: DynamoDBStreamEvent): Promise<void> {
    const changes = new Map<string, number>();

    for (const record of event.Records) {
        const list = record.dynamodb?.Keys?.id?.S;
        // Lists are created empty, without a version, right before their first item is saved. Only that save is worth telling.
        const version = Number(record.dynamodb?.NewImage?.version?.N);
        if (!list || !Number.isFinite(version)) {
            continue;
        }
        changes.set(list, Math.max(version, changes.get(list) ?? 0));
    }

    logger.debug('Notifying list changes', {changes: Object.fromEntries(changes)});

    const notifier = ListChangeNotifier.config(settings);
    await Promise.all([...changes].map(([list, version]) => notifier.notify(list, version)));
}
