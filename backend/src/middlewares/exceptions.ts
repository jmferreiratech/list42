import {type ErrorRequestHandler} from 'express';

import logger from '../logger';
import {ApplicationError, InternalError, ServerError} from '../modules/errors';

export default function exceptions(debug = false): ErrorRequestHandler {
    return (err, _req, res, _next) => {
        const error = err instanceof ApplicationError
            ? err
            : new InternalError('Erro Interno', err as Error);

        if (debug || error instanceof ServerError) {
            logger.error(error);
        }

        res.status(error.status).send(error.toJSON());
    };
}
