import {type RequestHandler} from 'express';

import {NotFoundError} from '../modules/errors';

const unknownRoute: RequestHandler = (_req, _res, next) => {
    next(new NotFoundError('Rota não encontrada'));
};

export default unknownRoute;
