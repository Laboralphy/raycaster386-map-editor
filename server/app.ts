import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';
import serve from 'koa-static';
import type { Config } from './config.ts';
import { vaultRoutes } from './routes/vault.ts';
import { VaultStore } from './vault/vaultStore.ts';

/**
 * The vault server.
 *
 * In development Vite serves the app and proxies `/vault` here. In production
 * this also serves the built SPA, so the client can use relative URLs in both.
 */
export function createApp(config: Config, options: { serveStatic?: boolean } = {}): Koa {
    const app = new Koa();
    const store = new VaultStore(config.vaultRoot);

    // One place where a thrown error becomes a status. `status` is set by
    // BadLevelName (400) and LevelNotFound (404); anything else is ours and is
    // logged rather than returned.
    app.use(async (ctx, next) => {
        try {
            await next();
        } catch (e) {
            const status = (e as { status?: number }).status;
            if (status === 400 || status === 404) {
                ctx.status = status;
                ctx.body = { status: 'error', error: (e as Error).message };
                return;
            }
            console.error(e);
            ctx.status = 500;
            ctx.body = { status: 'error', error: 'internal error' };
        }
    });

    // A level carries its tile images inline, so bodies reach a few megabytes.
    app.use(bodyParser({ jsonLimit: '64mb' }));

    const router = vaultRoutes(store);
    app.use(router.routes()).use(router.allowedMethods());

    if (options.serveStatic ?? true) {
        app.use(serve(config.staticDir));
        // SPA fallback: a GET that reached here is one of the app's own routes,
        // so hand back index.html and let the router sort it out.
        app.use(async (ctx) => {
            if (ctx.method !== 'GET' || ctx.path.startsWith('/vault')) {
                return;
            }
            const index = join(config.staticDir, 'index.html');
            try {
                await stat(index);
            } catch {
                return;
            }
            ctx.type = 'html';
            ctx.body = createReadStream(index);
        });
    }

    return app;
}
