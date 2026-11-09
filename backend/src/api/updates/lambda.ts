import type {DynamoDBStreamEvent} from 'aws-lambda';

import {handleConnectionEvent, handleListChanges, type WebSocketEvent} from './index.ts';
import logger from '../../logger';

export const connection = async (event: WebSocketEvent) => {
    // Not the whole event: its query string holds the connect token, which must not reach the logs.
    logger.debug('Received WebSocket event', {
        eventType: event.requestContext.eventType,
        connectionId: event.requestContext.connectionId,
    });

    return await handleConnectionEvent(event);
};

export const listChanges = async (event: DynamoDBStreamEvent) => {
    logger.debug('Received stream event', {records: event.Records.length});

    await handleListChanges(event);
};
