import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blobNames, deblob, reblob, type BlobMap } from '../../server/vault/blobz.ts';
import { FIXTURE_LEVELS, hasFixtures, levelDir, readStored } from '../helpers/fixtures.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

describe('splitting images out of a document', () => {
    it('names a blob by the md5 of its bytes', () => {
        const { data, blobs } = deblob({ tile: PNG });
        const expected = `${createHash('md5').update(Buffer.from('iVBORw0KGgo=', 'base64')).digest('hex')}.png`;
        expect(data).toEqual({ tile: expected });
        expect([...blobs.keys()]).toEqual([expected]);
    });

    it('uses .jpg for jpeg data', () => {
        const { data } = deblob({ preview: JPEG });
        expect((data as { preview: string }).preview).toMatch(/^[0-9a-f]{32}\.jpg$/);
    });

    it('leaves strings that are not images alone', () => {
        const input = { ref: 'wall', sky: 'sky.png', empty: '', nested: { n: 4, flag: true } };
        expect(deblob(input).data).toEqual(input);
    });

    it('stores one blob for the same image used twice', () => {
        const { blobs } = deblob({ a: PNG, b: PNG });
        expect(blobs.size).toBe(1);
    });

    it('round-trips a document', async () => {
        const original = { tiles: [{ content: PNG }], preview: JPEG, ref: 'untouched' };
        const { data, blobs } = deblob(original);
        const back = await reblob(data, async () => blobs);
        expect(back).toEqual(original);
    });

    it('refuses to load a document whose blob is missing', async () => {
        const { data } = deblob({ tile: PNG });
        await expect(reblob(data, async () => new Map() as BlobMap)).rejects.toThrow(
            /error while fetching resource/
        );
    });

    it('preserves key order, which the stored file depends on', () => {
        const input = { z: 1, a: 2, m: PNG, b: 3 };
        expect(Object.keys(deblob(input).data as object)).toEqual(['z', 'a', 'm', 'b']);
    });
});

describe.skipIf(!hasFixtures())('against the real vault', () => {
    for (const name of FIXTURE_LEVELS) {
        it(`every blob ${name} references exists on disk`, async () => {
            const names = blobNames(readStored(name));
            expect(names.length).toBeGreaterThan(0);
            for (const blobName of names) {
                const blob = await readFile(join(levelDir(name), 'tiles', blobName));
                // The name is the content hash, so this also proves the files
                // have not been corrupted or swapped.
                expect(
                    `${createHash('md5').update(blob).digest('hex')}.${blobName.split('.')[1]}`
                ).toBe(blobName);
            }
        });
    }
});
