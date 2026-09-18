import {
    PHYS_CURT_DOWN,
    PHYS_CURT_UP,
    PHYS_DOOR_DOUBLE,
    PHYS_DOOR_DOWN,
    PHYS_DOOR_LEFT,
    PHYS_DOOR_RIGHT,
    PHYS_DOOR_UP,
    PHYS_INVISIBLE_BLOCK,
    PHYS_NONE,
    PHYS_OFFSET_BLOCK,
    PHYS_SECRET_BLOCK,
    PHYS_TRANSPARENT_BLOCK,
    PHYS_WALL,
} from '@laboralphy/raycaster386';
import { describe, expect, it } from 'vitest';
import { PHYS_TABLE } from '../../src/domain/reference.ts';

/**
 * The editor's phys table against the engine's constants.
 *
 * A block stores `phys` as an *index* into this table, and two separate things
 * rely on that index equalling the engine's constant of the same meaning: the
 * converter, which maps index to `@PHYS_*` by position, and `blockRenderer`,
 * which switches on the engine constants directly. Nothing enforces the
 * agreement, so it is asserted here.
 */
describe('the phys table', () => {
    const expected: [number, string][] = [
        [PHYS_NONE, 'Walkable'],
        [PHYS_WALL, 'Solid'],
        [PHYS_DOOR_UP, 'Door up'],
        [PHYS_CURT_UP, 'Curtain up'],
        [PHYS_DOOR_DOWN, 'Door down'],
        [PHYS_CURT_DOWN, 'Curtain down'],
        [PHYS_DOOR_LEFT, 'Door left'],
        [PHYS_DOOR_RIGHT, 'Door right'],
        [PHYS_DOOR_DOUBLE, 'Door double'],
        [PHYS_SECRET_BLOCK, 'Secret block'],
        [PHYS_TRANSPARENT_BLOCK, 'Transparent block'],
        [PHYS_INVISIBLE_BLOCK, 'Invisible block'],
        [PHYS_OFFSET_BLOCK, 'Offset block'],
    ];

    it('has one entry per engine phys code, at that code’s index', () => {
        expect(PHYS_TABLE).toHaveLength(expected.length);
        PHYS_TABLE.forEach((entry, index) => {
            expect(entry.id).toBe(index);
        });
    });

    /**
     * The old table named 6 "Door right" and 7 "Door left", while the converter
     * maps 6 to `@PHYS_DOOR_LEFT` and 7 to `@PHYS_DOOR_RIGHT` — so picking
     * "Door right" built a door the engine slid left. The labels are corrected;
     * the indices are not, so existing levels are unaffected.
     */
    it('labels each entry the way the engine names that code', () => {
        for (const [code, label] of expected) {
            expect(PHYS_TABLE[code].label).toBe(label);
        }
    });

    it('marks exactly the kinds whose offset is meaningful', () => {
        const withOffset = PHYS_TABLE.filter((p) => p.offset).map((p) => p.id);
        expect(withOffset).toEqual([PHYS_TRANSPARENT_BLOCK, PHYS_OFFSET_BLOCK]);
    });
});
