import {loadEnv} from 'vite';
import {defineConfig} from 'vitest/config';

const env = loadEnv('tests', process.cwd(), '');

export default defineConfig({
    test: {
        env: {
            JWT_SECRET: 'tests',
            UPDATES_URL: 'wss://updates.test/v1',
            ...env,
            AWS_ACCESS_KEY_ID: 'offline',
            AWS_SECRET_ACCESS_KEY: 'offline',
            AWS_REGION: 'offline',
            // Repositories create their own DynamoDB clients, so DynamoDB Local is set for all of them here.
            AWS_ENDPOINT_URL_DYNAMODB: 'http://localhost:8080',
        },
        setupFiles: ['./tests-setup.js'],
        // Every test file recreates the same DynamoDB Local tables, so files must not run at the same time.
        fileParallelism: false,
    },
});
