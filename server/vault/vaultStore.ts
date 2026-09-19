import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { VaultLevelSummary } from '../../shared/api.ts';
import { type BlobMap, deblob, isBlobName, reblob } from './blobz.ts';
import { isLevelName, levelDir } from './levelName.ts';

/**
 * The vault on disk.
 *
 * Ported from the original's `VaultService` + `VaultFS`, minus the `<user>/maps`
 * namespace that went away with the decision that this editor is single-user,
 * and with `levelDir` standing between every request and the filesystem.
 *
 * ```
 * <root>/<level>/level.json        the document, images replaced by file names
 * <root>/<level>/tiles/<md5>.png   the images
 * ```
 *
 * `level.json` is written with a two-space indent and no trailing newline
 * because that is what the original wrote, and matching it is what lets a level
 * the old editor produced be loaded and saved without rewriting the file.
 */

const TILES = 'tiles';
const LEVEL = 'level.json';

/** Two-space indent, as `VaultFS.saveJSON` used. */
const INDENT = '  ';

export class LevelNotFound extends Error {
    readonly status = 404;

    constructor(message: string) {
        super(message);
        this.name = 'LevelNotFound';
    }
}

function isMissing(e: unknown): boolean {
    return (e as NodeJS.ErrnoException).code === 'ENOENT';
}

export class VaultStore {
    readonly root: string;

    constructor(root: string) {
        this.root = resolve(root);
    }

    /**
     * The levels, for the level list.
     *
     * A directory without a `level.json` is not a level — the original warned
     * and skipped, and so does this. A directory whose name this server would
     * refuse is skipped too: it could not be loaded or saved through any route,
     * so listing it would offer the user a level that cannot be opened.
     */
    async list(): Promise<VaultLevelSummary[]> {
        let entries;
        try {
            entries = await readdir(this.root, { withFileTypes: true });
        } catch (e) {
            if (isMissing(e)) {
                // An empty vault and a vault that does not exist yet are the
                // same thing to the editor; the first save creates it.
                return [];
            }
            throw e;
        }

        const levels: VaultLevelSummary[] = [];
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            if (!isLevelName(entry.name)) {
                console.warn(`vault: skipping "${entry.name}", not a usable level name`);
                continue;
            }
            let stats;
            try {
                stats = await stat(join(this.root, entry.name, LEVEL));
            } catch (e) {
                if (isMissing(e)) {
                    console.warn(`vault: skipping "${entry.name}", it has no ${LEVEL}`);
                    continue;
                }
                throw e;
            }
            levels.push({
                name: entry.name,
                // Seconds, the unit the old server used. Milliseconds here
                // would render in the level list as a date in the year 50000.
                date: Math.floor(stats.mtimeMs / 1000),
                preview: `/vault/${entry.name}.jpg`,
            });
        }
        return levels;
    }

    /** A level as the editor wants it: images inlined as data URLs. */
    async load(name: string): Promise<unknown> {
        const dir = levelDir(this.root, name);
        const stored = await this.read(dir, name);
        return reblob(stored, async (names) => {
            const blobs: BlobMap = new Map();
            for (const blobName of names) {
                try {
                    blobs.set(blobName, await readFile(join(dir, TILES, blobName)));
                } catch (e) {
                    if (!isMissing(e)) {
                        throw e;
                    }
                    // Left out, so `reblob` raises the one error that names the
                    // blob rather than a bare ENOENT with a path in it.
                }
            }
            return blobs;
        });
    }

    /**
     * Store a level, splitting its images back out into `tiles/`.
     *
     * Blobs are written before `level.json`, so a save interrupted halfway
     * leaves the previous document pointing at blobs that all still exist.
     * Blobs the new document no longer mentions are left alone: they cost a
     * little disk, and deleting on save is how an editor loses a tile.
     */
    async save(name: string, data: unknown): Promise<void> {
        const dir = levelDir(this.root, name);
        const { data: stored, blobs } = deblob(data);

        await mkdir(join(dir, TILES), { recursive: true });
        for (const [blobName, blob] of blobs) {
            await writeFile(join(dir, TILES, blobName), blob);
        }
        await writeFile(join(dir, LEVEL), JSON.stringify(stored, null, INDENT));
    }

    /** Delete a level, blobs and all. */
    async remove(name: string): Promise<void> {
        const dir = levelDir(this.root, name);
        try {
            await stat(dir);
        } catch (e) {
            if (isMissing(e)) {
                throw new LevelNotFound(`no level named "${name}"`);
            }
            throw e;
        }
        await rm(dir, { recursive: true, force: true });
    }

    /**
     * Where a level's thumbnail is, and what it actually is.
     *
     * The URL says `.jpg` but the stored preview is often a PNG, so the caller
     * needs the real type. The stored name is checked against the blob pattern
     * before it is joined: it comes out of a file, and a file is not a trusted
     * source of path segments.
     */
    async previewPath(name: string): Promise<{ path: string; type: string }> {
        const dir = levelDir(this.root, name);
        const stored = await this.read(dir, name);
        const preview = (stored as { preview?: unknown }).preview;
        if (!isBlobName(preview)) {
            throw new LevelNotFound(`level "${name}" has no preview`);
        }
        const path = join(dir, TILES, preview);
        try {
            await stat(path);
        } catch (e) {
            if (isMissing(e)) {
                throw new LevelNotFound(`the preview of level "${name}" is missing`);
            }
            throw e;
        }
        return { path, type: preview.toLowerCase().endsWith('.jpg') ? 'image/jpeg' : 'image/png' };
    }

    /** The document exactly as stored — blob references, not images. */
    private async read(dir: string, name: string): Promise<unknown> {
        try {
            return JSON.parse(await readFile(join(dir, LEVEL), 'utf8')) as unknown;
        } catch (e) {
            if (isMissing(e)) {
                throw new LevelNotFound(`no level named "${name}"`);
            }
            throw e;
        }
    }
}
