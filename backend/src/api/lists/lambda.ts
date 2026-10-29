import type {Context, APIGatewayEvent} from 'aws-lambda';
import serverless from 'serverless-http';

import app from './index.ts';
import logger from '../../logger';

const serverlessHandler = serverless(app);

export const handler = async (event: APIGatewayEvent, context: Context) => {
    logger.debug('Received event', {event});

    const response = await serverlessHandler(event, context);

    logger.debug('Sending response', {response});

    // ToDo: add error notification

    return response;
};
