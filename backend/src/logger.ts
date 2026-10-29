import winston from 'winston';

import settings from './settings';

const {combine, errors, splat, json, colorize, simple} = winston.format;

const logger = winston.createLogger({
    level: settings.logLevel,
    format: combine(
        errors({stack: true}),
        splat(),
        json(),
    ),
    transports: [
        new winston.transports.Console({
            format: settings.logLevel === 'debug' // Check if logLevel is 'debug'
                ? combine(colorize(), simple()) // Simple colored output for debug
                : json(), // JSON output otherwise
            silent: process.env.NODE_ENV === 'test', // Silence logger during tests
        }),
    ],
    exitOnError: false,
});

export default logger;
