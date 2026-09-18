import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertLevelName, levelDir } from '../../server/vault/levelName.ts';

/**
 * The validation itself, where the guarantee actually lives.
 *
 * The original server had none of this — `VaultFS.fqn()` was a bare
 * `path.join(root, namespace, name)` with the name straight off the request —
 * so these cases are the reason this module exists.
 */

const ROOT = '/srv/vault';

describe('level names', () => {
    for (const good of ['mans-intro', 'level1', 'A', 'a.b', 'a_b-c.d', 'x'.repeat(64)]) {
        it(`accepts ${JSON.stringify(good)}`, () => {
            expect(assertLevelName(good)).toBe(good);
        });
    }

    const bad = [
        '',
        '.',
        '..',
        '../etc',
        'a/b',
        'a\\b',
        '/abs',
        '.hidden',
        '-dash',
        '_under',
        'a b',
        'a\0b',
        'x'.repeat(65),
        'é',
    ];

    for (const name of bad) {
        it(`rejects ${JSON.stringify(name)}`, () => {
            expect(() => assertLevelName(name)).toThrow();
        });
    }

    it('rejects a name that is not a string', () => {
        expect(() => assertLevelName(undefined)).toThrow();
        expect(() => assertLevelName(42)).toThrow();
    });
});

describe('the directory a level name resolves to', () => {
    it('is directly under the root', () => {
        expect(levelDir(ROOT, 'mans-intro')).toBe(resolve(ROOT, 'mans-intro'));
    });

    it('never escapes the root', () => {
        for (const name of ['..', '../..', 'a/../..', '/etc']) {
            expect(() => levelDir(ROOT, name)).toThrow();
        }
    });

    it('resolves a relative root the same way', () => {
        expect(levelDir('./vault', 'x')).toBe(resolve('./vault', 'x'));
    });
});
