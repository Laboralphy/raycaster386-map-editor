import { createReadStream } from 'node:fs';
import Router from '@koa/router';
import type { VaultStatus } from '../../shared/api.ts';
import type { VaultStore } from '../vault/vaultStore.ts';

/**
 * The vault API, as the editor has always known it.
 *
 * Ported route for route from
 * `o876-raycaster-engine/srv/frameworks/web/routes/vault.js`, minus the two
 * endpoints that no longer exist: `PUT /publish/:name` (export runs in the
 * browser now) and `GET /user.json` (single-user).
 *
 * Registration order matters — `:name.json` and `:name.jpg` must be declared
 * before the bare `:name`, or a request for `foo.json` is read as a level
 * called "foo.json".
 */

const DONE: VaultStatus = { status: 'done' };

export function vaultRoutes(store: VaultStore): Router {
    const router = new Router({ prefix: '/vault' });

    router.get('/', async (ctx) => {
        ctx.body = await store.list();
    });

    router.get('/:name.json', async (ctx) => {
        ctx.body = await store.load(ctx.params.name);
    });

    router.get('/:name.jpg', async (ctx) => {
        const { path, type } = await store.previewPath(ctx.params.name);
        // The stored preview is often a PNG behind this .jpg URL, so the type
        // comes from the file, never from the route.
        ctx.type = type;
        ctx.body = createReadStream(path);
    });

    router.put('/:name', async (ctx) => {
        await store.save(ctx.params.name, ctx.request.body);
        ctx.body = DONE;
    });

    router.delete('/:name', async (ctx) => {
        await store.remove(ctx.params.name);
        ctx.body = DONE;
    });

    return router;
}
