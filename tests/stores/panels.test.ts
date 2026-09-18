import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyLevel } from '../../src/domain/defaults.ts';
import { useLevelStore } from '../../src/stores/level.ts';

beforeEach(() => setActivePinia(createPinia()));

function seeded(size = 3) {
    const store = useLevelStore();
    store.load(createEmptyLevel(size));
    return store;
}

describe('tags on cells', () => {
    it('adds a tag once, however often it is asked', () => {
        const store = seeded();
        store.addCellTag(0, 0, 'goto cabin');
        store.addCellTag(0, 0, 'goto cabin');
        expect(store.cellAt(0, 0)?.tags).toEqual(['goto cabin']);
    });

    it('ignores an empty tag', () => {
        const store = seeded();
        store.addCellTag(0, 0, '');
        expect(store.cellAt(0, 0)?.tags).toEqual([]);
    });

    it('removes and renames', () => {
        const store = seeded();
        store.addCellTag(1, 1, 'one');
        store.addCellTag(1, 1, 'two');

        store.renameCellTag(1, 1, 'one', 'uno');
        expect(store.cellAt(1, 1)?.tags).toEqual(['uno', 'two']);

        store.removeCellTag(1, 1, 'two');
        expect(store.cellAt(1, 1)?.tags).toEqual(['uno']);
    });

    it('collects the distinct tags across a set of cells', () => {
        const store = seeded();
        store.addCellTag(0, 0, 'a');
        store.addCellTag(0, 0, 'b');
        store.addCellTag(1, 0, 'b');
        store.addCellTag(2, 2, 'c');

        expect(
            store.tagsOn([
                { x: 0, y: 0 },
                { x: 1, y: 0 },
            ])
        ).toEqual(['a', 'b']);
    });
});

describe('start points', () => {
    it('adds one and reports where it landed', () => {
        const store = seeded();
        expect(store.doc.startpoints).toHaveLength(1);
        expect(store.addStartpoint()).toBe(1);
        expect(store.doc.startpoints[1]).toEqual({ x: -1, y: -1, z: 1, angle: 0 });
    });

    it('places one, forcing the eye height the format expects', () => {
        const store = seeded();
        store.setStartpoint(0, { x: 2, y: 1, angle: 1.5 });
        expect(store.doc.startpoints[0]).toEqual({ x: 2, y: 1, angle: 1.5, z: 1 });
    });

    it('keeps the chosen start point pointing at the same one after a removal', () => {
        const store = seeded();
        store.addStartpoint();
        store.addStartpoint();
        store.setStartpoint(2, { x: 9, y: 9, angle: 0 });
        store.setActorStartpoint(2);

        // `actor.startpoint` is an index, so removing an earlier entry shifts
        // the one it names — it has to move with it or it points at a stranger.
        store.removeStartpoint(0);
        expect(store.doc.actor.startpoint).toBe(1);
        expect(store.doc.startpoints[1]).toMatchObject({ x: 9, y: 9 });
    });

    it('clamps the chosen index when the one it named is removed', () => {
        const store = seeded();
        store.addStartpoint();
        store.setActorStartpoint(1);
        store.removeStartpoint(1);
        expect(store.doc.actor.startpoint).toBe(0);
    });

    it('refuses to remove the last one', () => {
        const store = seeded();
        expect(store.removeStartpoint(0)).toBe(false);
        expect(store.doc.startpoints).toHaveLength(1);
    });
});

describe('shifting the map', () => {
    /** Paints each cell with a distinct block id, so a shift is readable. */
    function numbered(store: ReturnType<typeof seeded>, size: number) {
        for (let y = 0; y < size; ++y) {
            for (let x = 0; x < size; ++x) {
                store.setCellBlock(x, y, 0, y * size + x + 1);
            }
        }
    }

    function blocks(store: ReturnType<typeof seeded>) {
        return store.doc.grid.map((row) => row.map((cell) => cell.block));
    }

    it('moves every row up and wraps the top one round', () => {
        const store = seeded(3);
        numbered(store, 3);
        store.shiftGrid('n');
        expect(blocks(store)).toEqual([
            [4, 5, 6],
            [7, 8, 9],
            [1, 2, 3],
        ]);
    });

    it('moves the map east, wrapping each row', () => {
        const store = seeded(3);
        numbered(store, 3);
        store.shiftGrid('e');
        expect(blocks(store)).toEqual([
            [3, 1, 2],
            [6, 4, 5],
            [9, 7, 8],
        ]);
    });

    it('carries the start point along with the map', () => {
        const store = seeded(3);
        store.setStartpoint(0, { x: 0, y: 0, angle: 0 });
        store.shiftGrid('s');
        // A level shifted down still starts where it did relative to its walls.
        expect(store.doc.startpoints[0]).toMatchObject({ x: 0, y: 1 });
    });

    it('wraps a start point round the edge', () => {
        const store = seeded(3);
        store.setStartpoint(0, { x: 0, y: 0, angle: 0 });
        store.shiftGrid('n');
        expect(store.doc.startpoints[0]).toMatchObject({ x: 0, y: 2 });
    });

    it('leaves an unplaced start point alone', () => {
        const store = seeded(3);
        store.shiftGrid('n');
        expect(store.doc.startpoints[0]).toMatchObject({ x: -1, y: -1 });
    });

    it('shifts only inside a region, leaving the rest where it was', () => {
        const store = seeded(3);
        numbered(store, 3);
        store.shiftRegion({ x1: 0, y1: 0, x2: 1, y2: 1 }, 'e');
        expect(blocks(store)).toEqual([
            [2, 1, 3],
            [5, 4, 6],
            [7, 8, 9],
        ]);
    });

    it('marks every cell for repainting, since all of them moved', () => {
        const store = seeded(3);
        for (const row of store.doc.grid) {
            for (const cell of row) {
                cell.modified = false;
            }
        }
        store.shiftGrid('w');
        expect(store.doc.grid.every((row) => row.every((cell) => cell.modified))).toBe(true);
    });
});
