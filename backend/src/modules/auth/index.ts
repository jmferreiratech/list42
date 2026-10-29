import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {betterAuth} from 'better-auth';

import {ddbAdapter} from '../../db/ddb-adapter';
import settings from '../../settings';

const auth = betterAuth({
    secret: settings.secret,
    baseURL: settings.baseURL.replace(/\/v1$/, ''), // without stage to internal route match
    database: ddbAdapter({
        debugLogs: settings.logLevel === 'debug',
        ddbDocClient: new DynamoDBClient(),
    }),
    socialProviders: {
        google: {
            clientId: settings.googleSSO.clientId,
            clientSecret: settings.googleSSO.clientSecret,
            redirectURI: `${settings.baseURL}/api/auth/callback/google`,
        },
    },
    trustedOrigins: settings.trustedOrigins,
    advanced: {
        defaultCookieAttributes: {
            // This combination will need change: https://privacysandbox.google.com/cookies#report-issues
            sameSite: 'none',
            partitioned: false,
        },
    },
});

export default auth;
