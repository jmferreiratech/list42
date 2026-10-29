import {toNodeHandler} from 'better-auth/node';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import exceptions from '../../middlewares/exceptions';
import noCacheControl from '../../middlewares/no-cache-control';
import unknownRoute from '../../middlewares/unknown-route';
import auth from '../../modules/auth';
import settings from '../../settings';

const app = express();

app.use(helmet());
app.use(noCacheControl);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || settings.trustedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

const handler = toNodeHandler(auth);

app.all('/api/auth/{*splat}', async (req, res) => {
    await handler(req, res);
    res.end();
});

app.use(unknownRoute);
app.use(exceptions(settings.logLevel === 'debug'));

export default app;
