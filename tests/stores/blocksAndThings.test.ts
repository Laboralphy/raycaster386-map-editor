import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyLevel, emptyBlock, emptyThing } from '../../src/domain/defaults.ts';
import { useLevelStore } from '../../src/stores/level.ts';

beforeEach(() => setActivePinia(createPinia()));

function seeded() {
    const store = useLevelStore();
    store.load(createEmptyLevel(2));
    return store;
}

describe('blocks', () => {
    it('creates one when given id 0, the route’s "new" convention', () => {
        const store = seeded();
        const id = store.upsertBlock({ ...emptyBlock(0), id: 0, ref: 'wall' });
        expect(id).toBe(1);
        expect(store.doc.blocks).toHaveLength(1);
        expect(store.findBlock(1)?.ref).toBe('wall');
    });

    it('replaces one that already exists, without adding another', () => {
        const store = seeded();
        const id = store.upsertBlock({ ...emptyBlock(0), id: 0, ref: 'first' });
        store.upsertBlock({ ...emptyBlock(0), id, ref: 'second', phys: 2 });

        expect(store.doc.blocks).toHaveLength(1);
        expect(store.findBlock(id)).toMatchObject({ ref: 'second', phys: 2 });
    });

    it('clears both storeys of every cell that used a deleted block', () => {
        const store = seeded();
        const id = store.upsertBlock({ ...emptyBlock(0), id: 0 });
        const other = store.upsertBlock({ ...emptyBlock(0), id: 0 });

        store.doc.grid[0][0].block = id;
        store.doc.grid[0][1].upperblock = id;
        store.doc.grid[1][0].block = other;

        expect(store.deleteBlock(id)).toBe(true);

        expect(store.doc.grid[0][0].block).toBe(0);
        // The old DESTROY_BLOCK cleared `block` and left `upperblock` pointing
        // at a block that no longer existed — and the converter reads the upper
        // grid exactly as it reads the lower one.
        expect(store.doc.grid[0][1].upperblock).toBe(0);
        // A cell using a different block is left alone.
        expect(store.doc.grid[1][0].block).toBe(other);
    });

    it('marks the cells it cleared, so the grid knows to repaint them', () => {
        const store = seeded();
        const id = store.upsertBlock({ ...emptyBlock(0), id: 0 });
        store.doc.grid[0][0].block = id;
        store.doc.grid[0][0].modified = false;

        store.deleteBlock(id);
        expect(store.doc.grid[0][0].modified).toBe(true);
    });

    it('reports nothing for a block that is not there', () => {
        expect(seeded().deleteBlock(42)).toBe(false);
    });

    it('lists blocks in phys order without reordering the document', () => {
        const store = seeded();
        store.upsertBlock({ ...emptyBlock(0), id: 0, phys: 9 });
        store.upsertBlock({ ...emptyBlock(0), id: 0, phys: 1 });

        expect(store.blocksByPhys.map((b) => b.phys)).toEqual([1, 9]);
        // Block order is legend order in the exported level, so a mere read
        // must not change it — the old getter sorted the state in place.
        expect(store.doc.blocks.map((b) => b.phys)).toEqual([9, 1]);
    });
});

describe('things', () => {
    it('creates and updates a template', () => {
        const store = seeded();
        const id = store.upsertThing({ ...emptyThing(0), id: 0, ref: 'lamp' });
        expect(id).toBe(1);

        store.upsertThing({ ...emptyThing(0), id, ref: 'torch', tangible: true });
        expect(store.doc.things).toHaveLength(1);
        expect(store.findThing(id)).toMatchObject({ ref: 'torch', tangible: true });
    });

    it('removes every placement when a template is deleted', () => {
        const store = seeded();
        const id = store.upsertThing({ ...emptyThing(0), id: 0 });
        const other = store.upsertThing({ ...emptyThing(0), id: 0 });

        store.doc.grid[0][0].things = [
            { id, x: 0, y: 0 },
            { id: other, x: 1, y: 1 },
        ];
        store.doc.grid[1][1].things = [{ id, x: 2, y: 2 }];

        expect(store.deleteThing(id)).toBe(true);

        // A placement of a template that no longer exists would convert into a
        // blueprint reference pointing at nothing.
        expect(store.doc.grid[0][0].things).toEqual([{ id: other, x: 1, y: 1 }]);
        expect(store.doc.grid[1][1].things).toEqual([]);
        expect(store.doc.grid[1][1].modified).toBe(true);
    });

    it('leaves cells untouched when nothing was placed there', () => {
        const store = seeded();
        const id = store.upsertThing({ ...emptyThing(0), id: 0 });
        store.doc.grid[0][0].modified = false;

        store.deleteThing(id);
        expect(store.doc.grid[0][0].modified).toBe(false);
    });

    it('reorders the palette', () => {
        const store = seeded();
        const a = store.upsertThing({ ...emptyThing(0), id: 0, ref: 'a' });
        store.upsertThing({ ...emptyThing(0), id: 0, ref: 'b' });
        const c = store.upsertThing({ ...emptyThing(0), id: 0, ref: 'c' });

        store.moveThing(c, a);
        expect(store.doc.things.map((t) => t.ref)).toEqual(['c', 'a', 'b']);
    });

    it('ignores a reorder onto itself or onto something missing', () => {
        const store = seeded();
        const a = store.upsertThing({ ...emptyThing(0), id: 0, ref: 'a' });
        store.moveThing(a, a);
        store.moveThing(a, 99);
        expect(store.doc.things.map((t) => t.ref)).toEqual(['a']);
    });
});
