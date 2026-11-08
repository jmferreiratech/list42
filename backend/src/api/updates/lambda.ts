import type {DynamoDBStreamEvent} from 'aws-lambda';

import {handleConnectionEvent, handleListChanges, type WebSocketEvent} from './index.ts';
import logger from '../../logger';

export const connection = async (event: WebSocketEvent) => {
    logger.debug('Received WebSocket event', {event});

    return await handleConnectionEvent(event);
};

export const listChanges = async (event: DynamoDBStreamEvent) => {
    logger.debug('Received stream event', {records: event.Records.length});

    await handleListChanges(event);
};
