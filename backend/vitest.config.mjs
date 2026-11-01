import {loadEnv} from 'vite';
import {defineConfig} from 'vitest/config';

const env = loadEnv('tests', process.cwd(), '');

export default defineConfig({
    test: {
        env: {
            ...env,
            AWS_ACCESS_KEY_ID: 'offline',
            AWS_SECRET_ACCESS_KEY: 'offline',
            AWS_REGION: 'offline',
        },
        setupFiles: ['./tests-setup.js'],
    },
});
