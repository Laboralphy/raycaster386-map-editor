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

describe('painting cells', () => {
    it('writes the storey it is told to', () => {
        const store = seeded();
        store.setCellBlock(1, 1, 0, 5);
        store.setCellBlock(1, 1, 1, 6);
        expect(store.cellAt(1, 1)).toMatchObject({ block: 5, upperblock: 6, modified: true });
    });

    it('ignores a cell outside the grid', () => {
        const store = seeded();
        expect(() => store.setCellBlock(99, 99, 0, 1)).not.toThrow();
    });

    it('paints a list of cells at once', () => {
        const store = seeded();
        store.setCellsBlock(
            [
                { x: 0, y: 0 },
                { x: 2, y: 2 },
            ],
            0,
            4
        );
        expect(store.cellAt(0, 0)?.block).toBe(4);
        expect(store.cellAt(2, 2)?.block).toBe(4);
        expect(store.cellAt(1, 1)?.block).toBe(0);
    });
});

describe('resizing the grid', () => {
    it('grows, keeping what was there', () => {
        const store = seeded(2);
        store.setCellBlock(1, 1, 0, 3);
        store.setGridSize(4);

        expect(store.gridSize).toBe(4);
        expect(store.doc.grid.every((row) => row.length === 4)).toBe(true);
        expect(store.cellAt(1, 1)?.block).toBe(3);
        expect(store.cellAt(3, 3)?.block).toBe(0);
    });

    it('shrinks, dropping what falls outside', () => {
        const store = seeded(4);
        store.setCellBlock(0, 0, 0, 3);
        store.setGridSize(2);

        expect(store.gridSize).toBe(2);
        expect(store.doc.grid.every((row) => row.length === 2)).toBe(true);
        expect(store.cellAt(0, 0)?.block).toBe(3);
    });

    it('stays within one and 256', () => {
        const store = seeded();
        store.setGridSize(0);
        expect(store.gridSize).toBe(1);
        store.setGridSize(1000);
        expect(store.gridSize).toBe(256);
    });
});

describe('things on a cell', () => {
    it('places one on a sub-cell and keeps the list sorted', () => {
        const store = seeded();
        store.setCellThing(0, 0, 2, 2, 7);
        store.setCellThing(0, 0, 0, 1, 8);
        store.setCellThing(0, 0, 1, 0, 9);

        // Sorted by sub-cell position, so the saved order does not depend on
        // the order things happened to be placed.
        expect(store.cellAt(0, 0)?.things).toEqual([
            { id: 8, x: 0, y: 1 },
            { id: 9, x: 1, y: 0 },
            { id: 7, x: 2, y: 2 },
        ]);
    });

    it('replaces whatever stood on the same sub-cell', () => {
        const store = seeded();
        store.setCellThing(0, 0, 1, 1, 1);
        store.setCellThing(0, 0, 1, 1, 2);
        expect(store.cellAt(0, 0)?.things).toEqual([{ id: 2, x: 1, y: 1 }]);
    });

    it('finds and removes one, marking the cell', () => {
        const store = seeded();
        store.setCellThing(0, 0, 1, 1, 4);
        expect(store.thingAt(0, 0, 1, 1)).toMatchObject({ id: 4 });

        store.cellAt(0, 0)!.modified = false;
        store.removeCellThing(0, 0, 1, 1);

        expect(store.thingAt(0, 0, 1, 1)).toBeUndefined();
        // The old REMOVE_CELL_THING left the cell unmarked, so the grid kept
        // drawing a thing that was no longer there.
        expect(store.cellAt(0, 0)?.modified).toBe(true);
    });
});

describe('tags and marks', () => {
    it('replaces a cell’s tags', () => {
        const store = seeded();
        store.setCellTags(1, 0, ['goto cabin', 'event thunder']);
        expect(store.cellAt(1, 0)?.tags).toEqual(['goto cabin', 'event thunder']);
        expect(store.cellAt(1, 0)?.modified).toBe(true);
    });

    it('copies the tags rather than aliasing the caller’s array', () => {
        const store = seeded();
        const tags = ['one'];
        store.setCellTags(0, 0, tags);
        tags.push('two');
        expect(store.cellAt(0, 0)?.tags).toEqual(['one']);
    });

    it('changes only the parts of a mark it is given', () => {
        const store = seeded();
        store.setCellMark(0, 0, { color: 'cyan', shape: 3 });
        store.setCellMark(0, 0, { shape: 5 });
        expect(store.cellAt(0, 0)?.mark).toEqual({ color: 'cyan', shape: 5 });
    });
});
