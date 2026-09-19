import { convertMapEditLevel } from '@laboralphy/raycaster386/mapedit';
import { describe, expect, it } from 'vitest';
import { createEmptyLevel } from '../../src/domain/defaults.ts';
import { previewBlocker } from '../../src/domain/previewable.ts';
import { toMapEditLevel } from '../../src/domain/serialise.ts';
import type { EditorLevel } from '../../src/domain/types.ts';
import { stubAppender } from '../helpers/fixtures.ts';

/**
 * The gate in front of the preview.
 *
 * Its value is not the check itself but that it agrees with the converter: a
 * blocker that let a level through would put a raw `convertMapEditLevel: no
 * wall tile is defined` on screen, and one that refused a level the converter
 * accepts would make a working level unpreviewable. The last case here asserts
 * that agreement directly rather than trusting the two to stay in step.
 */

function withTiles(walls: number, flats: number): EditorLevel {
    const level = createEmptyLevel(1);
    for (let i = 0; i < walls; ++i) {
        level.tiles.walls.push({
            id: 100 + i,
            type: 'wall',
            content: 'data:image/png;base64,iVBORw0KGgo=',
            width: 64,
            height: 96,
            animation: null,
        });
    }
    for (let i = 0; i < flats; ++i) {
        level.tiles.flats.push({
            id: 200 + i,
            type: 'flat',
            content: 'data:image/png;base64,iVBORw0KGgo=',
            width: 64,
            height: 64,
            animation: null,
        });
    }
    return level;
}

describe('whether a level can be previewed', () => {
    it('refuses a level fresh from New, naming the wall tile', () => {
        const reason = previewBlocker(createEmptyLevel());
        expect(reason).toMatch(/wall tile/);
    });

    it('still refuses one with walls but no flats, naming the flat tile', () => {
        const reason = previewBlocker(withTiles(1, 0));
        expect(reason).toMatch(/flat tile/);
    });

    it('accepts one with both', () => {
        expect(previewBlocker(withTiles(1, 1))).toBeNull();
    });

    /**
     * The agreement, checked both ways: whatever this lets through, the
     * converter must accept, and whatever it stops, the converter must refuse.
     */
    it('agrees with the converter about every combination', async () => {
        for (const [walls, flats] of [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
        ]) {
            const level = withTiles(walls, flats);
            const blocked = previewBlocker(level) !== null;
            let converterRefused = false;
            try {
                await convertMapEditLevel(toMapEditLevel(level), stubAppender);
            } catch {
                converterRefused = true;
            }
            expect(blocked, `walls=${walls} flats=${flats}`).toBe(converterRefused);
        }
    });
});
