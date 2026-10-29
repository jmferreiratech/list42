import {type RequestHandler} from 'express';

const noCacheControl: RequestHandler = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
        res.set('Cache-Control', 'no-cache,no-store');
        res.set('Pragma', 'no-cache');
    }

    next();
};

export default noCacheControl;
