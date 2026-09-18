import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../src/domain/parse.ts';
import { toMapEditLevel } from '../../src/domain/serialise.ts';
import { FIXTURE_LEVELS, hasFixtures, readInlined } from '../helpers/fixtures.ts';

/**
 * What the document model changes about a save, exactly.
 *
 * `roundtrip.test.ts` proves the *converted output* is unchanged, which is the
 * guarantee that matters to the engine. This is the stricter question: what
 * differs in the file itself? Every difference has to be one we chose, so the
 * allowlist below is the complete, reviewed list of them. Anything else is a
 * regression — a field silently dropped, renamed or rounded.
 */

type Diff = { path: string; before: unknown; after: unknown };

/** Every path where two documents differ, including keys added or removed. */
function diffPaths(before: unknown, after: unknown, path = ''): Diff[] {
    if (Object.is(before, after)) {
        return [];
    }
    const bothObjects =
        typeof before === 'object' &&
        before !== null &&
        typeof after === 'object' &&
        after !== null;
    if (!bothObjects) {
        return before === after ? [] : [{ path, before, after }];
    }
    if (Array.isArray(before) !== Array.isArray(after)) {
        return [{ path, before, after }];
    }
    const keys = new Set([...Object.keys(before as object), ...Object.keys(after as object)]);
    const out: Diff[] = [];
    for (const key of keys) {
        const b = (before as Record<string, unknown>)[key];
        const a = (after as Record<string, unknown>)[key];
        out.push(...diffPaths(b, a, path === '' ? key : `${path}/${key}`));
    }
    return out;
}

/** Array indices collapsed, so `blocks/3/offs` reads as `blocks/*\/offs`. */
function generalise(path: string): string {
    return path.replace(/\/\d+(?=\/|$)/g, '/*');
}

/**
 * The differences the document model deliberately introduces.
 *
 * The first group is numeric normalisation: the old editor bound these fields
 * to text inputs and saved whatever the field held, so real levels contain
 * `"offs": "16"`. Every one of them is read through `int()` or `parseFloat()`
 * inside the converter, which is why normalising them cannot change its output.
 *
 * The second group is cell regularisation: the fixtures omit `block` and
 * `upperblock` on empty cells — four different cell shapes appear across the
 * four levels — and the document model always writes them as `0`, which is what
 * the converter reads them as anyway.
 */
const TILE_FIELDS = [
    'animation/frames',
    'animation/duration',
    'animation/loop',
    'id',
    'width',
    'height',
];

const ALLOWED = [
    ...['walls', 'flats', 'sprites'].flatMap((group) =>
        TILE_FIELDS.map((field) => `tiles/${group}/*/${field}`)
    ),
    'blocks/*/offs',
    'blocks/*/phys',
    'blocks/*/light/value',
    'blocks/*/light/inner',
    'blocks/*/light/outer',
    'things/*/size',
    'things/*/opacity',
    'things/*/tile',
    'things/*/light/value',
    'things/*/light/inner',
    'things/*/light/outer',
    'metrics/tileWidth',
    'metrics/tileHeight',
    'ambiance/fog/distance',
    'ambiance/brightness',
    'actor/startpoint',
    'startpoints/*/x',
    'startpoints/*/y',
    'startpoints/*/z',
    'startpoints/*/angle',
    'grid/*/*/block',
    'grid/*/*/upperblock',
];

describe.skipIf(!hasFixtures())('the document model changes only what it means to', () => {
    for (const name of FIXTURE_LEVELS) {
        it(`introduces only allowed differences in ${name}`, async () => {
            const original = await readInlined(name);
            const resaved = toMapEditLevel(parseLevel(original));

            const unexpected = diffPaths(original, resaved)
                .map((d) => ({ ...d, general: generalise(d.path) }))
                .filter((d) => !ALLOWED.includes(d.general));

            // Named paths, not a count, so a failure says what moved.
            expect(
                unexpected.map(
                    (d) =>
                        `${d.general} (${JSON.stringify(d.before)} -> ${JSON.stringify(d.after)})`
                )
            ).toEqual([]);
        });
    }

    it('detects a difference when one is introduced', async () => {
        const original = await readInlined('mans-test-ai');
        const tampered = toMapEditLevel(parseLevel(original));
        tampered.ambiance.sky = 'something-else.png';

        const diffs = diffPaths(original, tampered).map((d) => generalise(d.path));
        expect(diffs).toContain('ambiance/sky');
    });
});
