import { createServer, type Server } from 'node:http';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app.ts';
import { FIXTURE_ROOT, hasFixtures } from '../helpers/fixtures.ts';

/**
 * The vault, over HTTP, against a copy of the real levels.
 *
 * Everything here runs in a temporary directory: the vault holds the only real
 * editor data that exists, and a test that writes to it would be a data-loss
 * bug waiting to happen.
 */

let root: string;
let server: Server;
let base: string;

async function api(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${base}${path}`, init);
}

beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'mapedit-vault-'));
    if (hasFixtures()) {
        await cp(FIXTURE_ROOT, root, { recursive: true });
    }
    const app = createApp(
        { vaultRoot: root, port: 0, staticDir: join(root, 'nonexistent') },
        { serveStatic: false }
    );
    server = createServer(app.callback());
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
});

describe.skipIf(!hasFixtures())('the vault API', () => {
    it('lists the levels with epoch-second dates and preview URLs', async () => {
        const list = (await (await api('/vault')).json()) as {
            name: string;
            date: number;
            preview: string;
        }[];
        expect(list.map((l) => l.name).sort()).toEqual([
            'mans-cabin',
            'mans-intro',
            'mans-level-1',
            'mans-test-ai',
        ]);
        const one = list[0];
        // Seconds, not milliseconds — a 13-digit value here would silently
        // render as a date in the year 50000 in the level list.
        expect(String(one.date)).toMatch(/^\d{10}$/);
        expect(one.preview).toBe(`/vault/${one.name}.jpg`);
    });

    it('loads a level with its images inlined', async () => {
        const level = (await (await api('/vault/mans-test-ai.json')).json()) as {
            tiles: { walls: { content: string }[] };
        };
        expect(level.tiles.walls[0].content).toMatch(/^data:image\/png;base64,/);
    });

    it('serves the preview with the stored file type, not the URL type', async () => {
        const response = await api('/vault/mans-intro.jpg');
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toMatch(/^image\/(jpeg|png)/);
        expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    });

    /**
     * The golden test: a level that goes out and comes back is the same file.
     *
     * Byte-identical, not merely equivalent — it catches a change in key order
     * or in the two-space indent, either of which would make every future save
     * rewrite files the original editor wrote.
     */
    it('writes back a loaded level byte for byte', async () => {
        const loaded = await (await api('/vault/mans-test-ai.json')).text();
        const put = await api('/vault/copy-of-test-ai', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: loaded,
        });
        expect(put.status).toBe(200);

        const before = await readFile(join(root, 'mans-test-ai', 'level.json'));
        const after = await readFile(join(root, 'copy-of-test-ai', 'level.json'));
        expect(after.equals(before)).toBe(true);

        const tilesBefore = (await readdir(join(root, 'mans-test-ai', 'tiles'))).sort();
        const tilesAfter = (await readdir(join(root, 'copy-of-test-ai', 'tiles'))).sort();
        expect(tilesAfter).toEqual(tilesBefore);
        for (const name of tilesBefore) {
            const a = await readFile(join(root, 'mans-test-ai', 'tiles', name));
            const b = await readFile(join(root, 'copy-of-test-ai', 'tiles', name));
            expect(b.equals(a)).toBe(true);
        }
    });

    it('deletes a level', async () => {
        await api('/vault/doomed', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grid: [[{}]] }),
        });
        expect((await api('/vault/doomed', { method: 'DELETE' })).status).toBe(200);
        expect((await api('/vault/doomed.json')).status).toBe(404);
    });

    it('404s a level that is not there', async () => {
        expect((await api('/vault/no-such-level.json')).status).toBe(404);
    });
});

describe('level names that try to escape the vault', () => {
    const attempts = ['..', '.', '%2e%2e', '%2e%2e%2fpwned', 'foo%00', '-leading-dash', 'a%2Fb'];

    /**
     * What matters is that none of these is *accepted* and that nothing lands
     * outside the vault. The exact status varies by design: names that reach
     * the handler are rejected as 400 by `assertLevelName`, while ones the
     * router never matches come back 404 or 405. Pinning a single code here
     * would be testing @koa/router's path matching rather than our validation —
     * which `levelName.test.ts` covers directly.
     */
    for (const name of attempts) {
        it(`never accepts ${JSON.stringify(name)}`, async () => {
            expect((await api(`/vault/${name}.json`)).ok).toBe(false);
            const put = await api(`/vault/${name}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: '{"grid":[[{}]]}',
            });
            expect(put.ok).toBe(false);
        });
    }

    it('leaves the vault root holding only well-formed level directories', async () => {
        const entries = await readdir(root);
        expect(entries.every((e) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(e))).toBe(true);
        expect(entries).not.toContain('pwned');
    });

    it('wrote nothing above the vault root', async () => {
        const above = await readdir(join(root, '..'));
        expect(above.filter((e) => e.includes('pwned'))).toEqual([]);
    });
});
