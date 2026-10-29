import {createId} from '@paralleldrive/cuid2';
import {fromNodeHeaders} from 'better-auth/node';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import {z} from 'zod';

import logger from '../../logger';
import exceptions from '../../middlewares/exceptions';
import noCacheControl from '../../middlewares/no-cache-control';
import unknownRoute from '../../middlewares/unknown-route';
import auth from '../../modules/auth';
import {UsersRepository} from '../../modules/auth/repository';
import {BadRequestError, NotFoundError, UnauthorizedError, ValidationError} from '../../modules/errors';
import ListsRepository, {type GroceryList} from '../../modules/lists/repository';
import SharesRepository from '../../modules/shares/repository';
import settings from '../../settings';

const app = express();

app.set('json spaces', 2);

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

app.use(express.json({limit: '6mb', strict: false}));
app.use(express.text({limit: '6mb'}));
app.use(express.urlencoded({limit: '6mb', extended: false}));

type Session = typeof auth.$Infer.Session;

app.use(async (req, res, next) => {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
        throw new UnauthorizedError();
    }

    res.locals.auth = session;
    next();
});

app.get('/api/lists', async (_req, res) => {
    const {user} = res.locals.auth as Session;

    const shares = await SharesRepository.config(settings)
        .listByUser(user.id);

    const result = [
        {id: 'mine', name: 'Minha lista'},
        ...shares.map(s => ({
            id: s.list,
            name: s.name || 'Lista misteriosa',
        })),
    ];

    res.send(result);
});

app.param('listId', (req, res, next, val, param) => {
    const {user} = res.locals.auth as Session;

    if (val === 'mine') {
        req.params[param] = user.id;
    }

    next();
});

app.use('/api/lists/:listId', async (req, res, next) => {
    const {listId} = req.params;
    const {user} = res.locals.auth as Session;

    if (listId !== user.id) {
        const shared = await SharesRepository.config(settings)
            .find(user.id, listId);
        if (!shared) {
            throw new NotFoundError();
        }
    }

    res.locals.item = await ListsRepository.config(settings)
        .retrieve(listId) ?? {id: listId, items: []};

    next();
});

app.get('/api/lists/:listId', (_req, res) => {
    const result = res.locals.item as GroceryList;

    res.send(publicList(result));
});

const GroceryListItemInputSchema = z.object({
    id: z.string().cuid2(),
    name: z.string().trim().min(1),
    completed: z.boolean(),
    updatedAt: z.string().optional(),
    updatedBy: z.string().optional(),
});

app.post('/api/lists/:listId/items', async (req, res) => {
    const {listId} = req.params;
    const {user} = res.locals.auth as Session;
    const list = res.locals.item as GroceryList;

    const item = parse(GroceryListItemInputSchema, req.body);

    const result = await ListsRepository.config(settings)
        .upsert(listId, {
            ...list,
            items: {
                ...list.items,
                [item.id]: {
                    ...item,
                    updatedAt: new Date().toISOString(),
                    updatedBy: user.id,
                },
            },
            updatedBy: user.id,
        });

    res.send(publicList(result));
});

app.put('/api/lists/:listId/items/:id', async (req, res) => {
    const {listId, id} = req.params;
    const list = res.locals.item as GroceryList;
    const {user} = res.locals.auth as Session;
    const item = parse(GroceryListItemInputSchema, req.body);

    const result = await ListsRepository.config(settings)
        .upsert(listId, {
            ...list,
            items: {
                ...list.items,
                [id]: {
                    ...item,
                    id,
                    updatedAt: new Date().toISOString(),
                    updatedBy: user.id,
                },
            },
            updatedBy: user.id,
        });

    res.send(publicList(result));
});

app.delete('/api/lists/:listId/items/:id', async (req, res) => {
    const {listId, id} = req.params;
    const list = res.locals.item as GroceryList;
    const {user} = res.locals.auth as Session;

    const {[id]: _, ...rest} = list.items;

    const result = await ListsRepository.config(settings)
        .upsert(listId, {
            ...list,
            items: rest,
            updatedBy: user.id,
        });

    res.send(publicList(result));
});

interface JwtPayload {
    jti: string;
    iss: GroceryList['id'];
}

app.get('/api/lists/mine/share-code', (_req, res) => {
    const {user} = res.locals.auth as Session;

    const payload: JwtPayload = {
        iss: user.id,
        jti: createId(),
    };

    const code = jwt.sign(payload, settings.jwtSecret, {expiresIn: '24h'});

    res.json(code);
});

app.post('/api/lists', async (req, res) => {
    const {user} = res.locals.auth as Session;
    const code = req.query.shared as string;

    if (!code) {
        throw new BadRequestError('Missing share code');
    }

    let payload: JwtPayload;
    try {
        payload = jwt.verify(code, settings.jwtSecret) as JwtPayload;
    } catch (error) {
        logger.warn('JWT verification failed', {message: (error as Error).message, error});
        throw new BadRequestError('Invalid or expired share code');
    }

    if (payload.iss === user.id) {
        logger.warn('User trying to share to herself', {userId: user.id, listId: payload.iss});
        res.send(await ListsRepository.config(settings)
            .retrieve(payload.iss));
        return;
    }

    const share = await SharesRepository.config(settings)
        .retrieve(payload.jti);
    if (share) {
        if (share.user === user.id) {
            logger.warn('User accessing link used by herself', {userId: user.id, shareId: payload.jti, listId: payload.iss});
            res.send(await ListsRepository.config(settings)
                .retrieve(payload.iss));
            return;
        }
        throw new BadRequestError('Share code already used');
    }

    const owner = await UsersRepository.config(settings)
        .retrieve(payload.iss);
    if (!owner) {
        throw new NotFoundError();
    }

    await SharesRepository.config(settings)
        .create({
            id: payload.jti,
            user: user.id,
            list: payload.iss,
            // O ideal é o nome ser um atributo da lista e ser copiado de lá pro share
            name: `Lista de ${owner.name}`,
        });

    const result = await ListsRepository.config(settings)
        .retrieve(payload.iss);

    res.send(publicList(result));
});

app.use(unknownRoute);
app.use(exceptions(settings.logLevel === 'debug'));

export default app;

function publicList(list?: GroceryList | null) {
    if (!list) {
        return list;
    }

    return {
        ...list,
        items: Object.values(list.items),
    };
}

function parse<T extends z.ZodType<unknown>>(schema: T, value: unknown) {
    try {
        return schema.parse(value) as z.infer<T>;
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new ValidationError('Invalid item data provided.', error.errors);
        }
        throw error;
    }
}
