import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

/**
 * The vault API is served by the Koa process in `server/`, on 8080 by default.
 * Proxying it here means the client uses the same relative `/vault` URLs in
 * development and in production, where Koa serves the built app as well.
 */
export default defineConfig({
    plugins: [vue()],
    server: {
        proxy: {
            '/vault': {
                target: `http://localhost:${process.env.MAPEDIT_PORT ?? 8080}`,
                changeOrigin: false,
            },
        },
    },
});
