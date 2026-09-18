import type { ImageAppender, MapEditLevel } from '@laboralphy/raycaster386/mapedit';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { reblob, type BlobMap } from '../../server/vault/blobz.ts';

/**
 * The real levels, as test data.
 *
 * These are the four mansion levels the original editor produced — the only
 * real editor data that exists anywhere. The vault directory is gitignored and
 * seeded by copying, so a fresh clone has none and the suites that need them
 * skip rather than fail. Nothing here writes: tests that save work in a
 * temporary directory.
 */

export const FIXTURE_ROOT = resolve(process.env.MAPEDIT_FIXTURES ?? './vault');

/** Smallest first — `mans-test-ai` is 59 KB with 6 blobs, the one to iterate on. */
export const FIXTURE_LEVELS = ['mans-test-ai', 'mans-cabin', 'mans-level-1', 'mans-intro'];

export function hasFixtures(): boolean {
    return FIXTURE_LEVELS.every((name) => existsSync(join(FIXTURE_ROOT, name, 'level.json')));
}

export function levelDir(name: string): string {
    return join(FIXTURE_ROOT, name);
}

/** The level exactly as stored: blob references, not images. */
export function readStored(name: string): unknown {
    return JSON.parse(readFileSync(join(levelDir(name), 'level.json'), 'utf8')) as unknown;
}

/** The level as the editor receives it, with images inlined. */
export async function readInlined(name: string): Promise<MapEditLevel> {
    const dir = levelDir(name);
    const data = await reblob(readStored(name), async (names) => {
        const blobs: BlobMap = new Map();
        for (const blobName of names) {
            blobs.set(blobName, await readFile(join(dir, 'tiles', blobName)));
        }
        return blobs;
    });
    return data as MapEditLevel;
}

/**
 * An appender that counts instead of drawing.
 *
 * Every part of the conversion but the image merging is pure data, and the
 * merging is the injected part — so a stub covers the whole path, and its short
 * `src` strings keep a failed comparison readable instead of a megabyte of
 * base64. Mirrors the stub in the engine library's own fidelity test.
 */
export const stubAppender: ImageAppender = (tiles, start, count) =>
    Promise.resolve({
        src: `stub:${String(tiles[start].id)}+${count}`,
        width: tiles[start].width,
        height: tiles[start].height,
    });
