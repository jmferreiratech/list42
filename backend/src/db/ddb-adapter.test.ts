import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {runAdapterTest} from 'better-auth/adapters/test';
import {describe} from 'vitest';

import {ddbAdapter} from './ddb-adapter';

describe('DDB Adapter Tests', async () => {
    const adapter = ddbAdapter({
        debugLogs: {isRunningAdapterTests: true},
        ddbDocClient: new DynamoDBClient({region: 'localhost', endpoint: 'http://localhost:8080'}),
    });

    await runAdapterTest({
        getAdapter: async (betterAuthOptions = {}) => {
            return Promise.resolve(adapter(betterAuthOptions));
        },
    });
});
