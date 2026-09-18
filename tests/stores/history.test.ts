import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyLevel, emptyBlock } from '../../src/domain/defaults.ts';
import { HISTORY_DEPTH, useHistoryStore } from '../../src/stores/history.ts';
import { useLevelStore } from '../../src/stores/level.ts';

/**
 * Scoped undo.
 *
 * The scope is the whole design: a document snapshot per change would copy
 * 381 KB of grid to paint one cell, so a change declares what it touches and
 * only that is cloned. The flip side is that anything left out of the scope is
 * not restored — worth pinning, since it is the one way to use this wrongly.
 */

beforeEach(() => setActivePinia(createPinia()));

function seeded() {
    const level = useLevelStore();
    level.load(createEmptyLevel(3));
    return { level, history: useHistoryStore() };
}

describe('undo and redo', () => {
    it('puts back the cells a change touched', () => {
        const { level, history } = seeded();
        history.transact('paint', { cells: [{ x: 1, y: 1 }] }, () => {
            level.setCellBlock(1, 1, 0, 7);
        });
        expect(level.doc.grid[1][1].block).toBe(7);

        expect(history.undo()).toBe('paint');
        expect(level.doc.grid[1][1].block).toBe(0);

        expect(history.redo()).toBe('paint');
        expect(level.doc.grid[1][1].block).toBe(7);
    });

    it('restores a named slice of the document', () => {
        const { level, history } = seeded();
        history.transact('create block', { slices: ['blocks'] }, () => {
            level.upsertBlock({ ...emptyBlock(0), id: 0, ref: 'wall' });
        });
        expect(level.doc.blocks).toHaveLength(1);

        history.undo();
        expect(level.doc.blocks).toHaveLength(0);

        history.redo();
        expect(level.doc.blocks[0].ref).toBe('wall');
    });

    it('does not restore what the scope left out', () => {
        // Not a quirk to work around — the cost of not snapshotting the
        // document. A transaction has to name everything it changes.
        const { level, history } = seeded();
        history.transact('narrow', { cells: [{ x: 0, y: 0 }] }, () => {
            level.setCellBlock(0, 0, 0, 1);
            level.setCellBlock(2, 2, 0, 9);
        });
        history.undo();
        expect(level.doc.grid[0][0].block).toBe(0);
        expect(level.doc.grid[2][2].block).toBe(9);
    });

    it('reports what can be undone, and what it was', () => {
        const { level, history } = seeded();
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(false);

        history.transact('paint block #3', { cells: [{ x: 0, y: 0 }] }, () =>
            level.setCellBlock(0, 0, 0, 3)
        );
        expect(history.canUndo).toBe(true);
        expect(history.undoLabel).toBe('paint block #3');

        history.undo();
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(true);
        expect(history.redoLabel).toBe('paint block #3');
    });

    it('drops the redo stack once a new change is made', () => {
        const { level, history } = seeded();
        history.transact('first', { cells: [{ x: 0, y: 0 }] }, () =>
            level.setCellBlock(0, 0, 0, 1)
        );
        history.undo();
        expect(history.canRedo).toBe(true);

        history.transact('second', { cells: [{ x: 1, y: 1 }] }, () =>
            level.setCellBlock(1, 1, 0, 2)
        );
        // The undone future is unreachable now, and offering it would put the
        // document into a state that never existed.
        expect(history.canRedo).toBe(false);
    });

    it('keeps only the most recent changes', () => {
        const { level, history } = seeded();
        for (let i = 0; i < HISTORY_DEPTH + 5; ++i) {
            history.transact(`paint ${i}`, { cells: [{ x: 0, y: 0 }] }, () =>
                level.setCellBlock(0, 0, 0, i + 1)
            );
        }
        expect(history.past).toHaveLength(HISTORY_DEPTH);
        expect(history.undoLabel).toBe(`paint ${HISTORY_DEPTH + 4}`);
    });

    it('answers safely when there is nothing to undo or redo', () => {
        const { history } = seeded();
        expect(history.undo()).toBeNull();
        expect(history.redo()).toBeNull();
    });

    it('ignores cells outside the grid', () => {
        const { level, history } = seeded();
        history.transact('off the map', { cells: [{ x: 99, y: 99 }] }, () => {
            level.setCellBlock(0, 0, 0, 5);
        });
        expect(() => history.undo()).not.toThrow();
        expect(level.doc.grid[0][0].block).toBe(5);
    });

    it('forgets everything when a different level is loaded', () => {
        const { level, history } = seeded();
        history.transact('paint', { cells: [{ x: 0, y: 0 }] }, () =>
            level.setCellBlock(0, 0, 0, 1)
        );
        history.reset();
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(false);
    });

    it('restores a deep copy, so a later edit cannot reach into the past', () => {
        const { level, history } = seeded();
        history.transact('tag', { cells: [{ x: 0, y: 0 }] }, () => {
            level.setCellTags(0, 0, ['first']);
        });
        level.setCellTags(0, 0, ['second']);
        history.undo();
        expect(level.doc.grid[0][0].tags).toEqual([]);

        // Mutating the restored cell must not corrupt the entry we could redo.
        level.doc.grid[0][0].tags.push('scribble');
        history.redo();
        expect(level.doc.grid[0][0].tags).toEqual(['first']);
    });
});
