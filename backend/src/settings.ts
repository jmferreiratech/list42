const LOG_LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] as const;

type LogLevel = typeof LOG_LEVELS[number];

const settings = {
    /** Winston log level. Defaults to 'info' if LOG_LEVEL is not set or invalid. */
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
    secret: process.env.BETTER_AUTH_SECRET ?? '',
    baseURL: process.env.SERVICE_ENDPOINT ?? '',
    trustedOrigins: (process.env.ORIGINS ?? '').split(','),
    googleSSO: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    listsTable: 'grocery_lists',
    sharesTable: 'list_shares',
    sharesByIdIndex: 'list_shares_by_id',
    jwtSecret: process.env.JWT_SECRET ?? '',
};

export default settings;

export type Settings = typeof settings;

function parseLogLevel(value: string | undefined): LogLevel {
    return LOG_LEVELS.find(level => level === value) ?? 'info';
}
