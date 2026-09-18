import { convertMapEditLevel } from '@laboralphy/raycaster386/mapedit';
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../src/domain/parse.ts';
import { toMapEditLevel } from '../../src/domain/serialise.ts';
import { FIXTURE_LEVELS, hasFixtures, readInlined, stubAppender } from '../helpers/fixtures.ts';

/**
 * The acceptance test: the editor does not change a level by opening it.
 *
 * Reading a save, holding it in the document model and writing it back must
 * produce something that compiles to exactly the same level. That is the whole
 * compatibility guarantee, and it is the reason the document model narrows
 * `number | string` to `number` only on fields the converter already coerces.
 *
 * It runs against all four real levels rather than a synthetic one, because the
 * interesting inputs are the accidents of five years of editing: numbers saved
 * as strings, cells with keys missing, `null` faces, 83 orphan blobs.
 */
describe.skipIf(!hasFixtures())('a level survives a round trip through the document model', () => {
    for (const name of FIXTURE_LEVELS) {
        it(`converts ${name} identically before and after`, async () => {
            const original = await readInlined(name);

            const document = parseLevel(original);
            const resaved = toMapEditLevel(document);

            const before = await convertMapEditLevel(original, stubAppender);
            const after = await convertMapEditLevel(resaved, stubAppender);

            expect(after).toEqual(before);
        });
    }

    it('produces a level the converter accepts at all', async () => {
        const document = parseLevel(await readInlined('mans-test-ai'));
        const converted = await convertMapEditLevel(toMapEditLevel(document), stubAppender);
        expect(converted).toHaveProperty('version', 'RCE-100');
        expect(converted).toHaveProperty('level');
    });
});
