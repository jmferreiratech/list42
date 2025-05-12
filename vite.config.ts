import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig as vitestConfig } from "vitest/config";

const env = loadEnv('tests', process.cwd(), '');

const config = defineConfig({
    plugins: [
        react(),
        VitePWA({
            injectRegister: 'script-defer',
            registerType: 'autoUpdate',
            devOptions: {enabled: true},
            manifest: {
                name: "List For Two",
                short_name: 'List42',
                description: 'Lists to Share',
                theme_color: '#42b883',
                background_color: '#000000',
                icons: [
                    {
                        src: "pwa-64x64.png",
                        sizes: "64x64",
                        type: "image/png"
                    },
                    {
                        src: "pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png"
                    },
                    {
                        src: "pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png"
                    },
                    {
                        src: "maskable-icon-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable"
                    }
                ]
            }
        }),
    ],
    base: '/list42/',
});

const testConfig = vitestConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
        env: {
            ...env,
            VITE_BASE_URL: 'http://localhost:12345',
        },
        setupFiles: ['./vitest.setup.ts'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'src/vite-env.d.ts']
        }
    }
});

export default {
    ...config,
    ...testConfig,
};