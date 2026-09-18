import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { EditorCell } from '../domain/types';
import { useLevelStore } from './level';

/**
 * Undo and redo, scoped to what a change actually touched.
 *
 * Whole-document snapshots are not an option: `mans-intro`'s grid alone is
 * 381 KB of JSON, and painting a block would copy all of it twice. So each
 * change declares its own scope — a list of cells, or a named slice of the
 * document — and only that is cloned, before and after.
 *
 * Painting, placing a thing, tagging and marking all name the handful of cells
 * they touch, at roughly 120 bytes each. Creating a block names the `blocks`
 * slice. Shifting the whole grid names every cell, which is one expensive entry
 * rather than an expensive entry per action.
 *
 * The old editor had 16 snapshots of `{x, y, block, upperblock}`, pushed only
 * by the grid and covering only block painting: no redo, and nothing else was
 * undoable. This covers everything that declares a scope.
 *
 * **Tiles stay outside.** Their `content` is megabytes of base64, and an undo
 * stack holding a few tile imports would be larger than the level. That was
 * true of the original too; the difference is that it is said out loud.
 */

export const HISTORY_DEPTH = 32;

/** What a transaction is allowed to name as its scope. */
export interface Scope {
    cells?: readonly { x: number; y: number }[];
    slices?: readonly SliceName[];
}

export type SliceName = 'blocks' | 'things' | 'startpoints' | 'meta';

interface Snapshot {
    cells: { x: number; y: number; cell: EditorCell }[];
    slices: Partial<Record<SliceName, unknown>>;
}

interface Entry {
    label: string;
    before: Snapshot;
    after: Snapshot;
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export const useHistoryStore = defineStore('history', () => {
    const past = ref<Entry[]>([]);
    const future = ref<Entry[]>([]);

    const canUndo = computed(() => past.value.length > 0);
    const canRedo = computed(() => future.value.length > 0);
    const undoLabel = computed(() => past.value.at(-1)?.label ?? '');
    const redoLabel = computed(() => future.value.at(-1)?.label ?? '');

    function snapshot(scope: Scope): Snapshot {
        const level = useLevelStore();
        const doc = level.doc;
        const cells = (scope.cells ?? [])
            .filter(({ x, y }) => doc.grid[y]?.[x] !== undefined)
            .map(({ x, y }) => ({ x, y, cell: clone(doc.grid[y][x]) }));

        const slices: Partial<Record<SliceName, unknown>> = {};
        for (const name of scope.slices ?? []) {
            slices[name] =
                name === 'meta'
                    ? clone({
                          metrics: doc.metrics,
                          flags: doc.flags,
                          ambiance: doc.ambiance,
                          actor: doc.actor,
                          time: doc.time,
                      })
                    : clone(doc[name]);
        }
        return { cells, slices };
    }

    function apply(state: Snapshot): void {
        const level = useLevelStore();
        const doc = level.doc;
        for (const { x, y, cell } of state.cells) {
            if (doc.grid[y]?.[x] !== undefined) {
                doc.grid[y][x] = clone(cell);
            }
        }
        for (const [name, value] of Object.entries(state.slices)) {
            if (name === 'meta') {
                Object.assign(doc, clone(value));
            } else {
                // The slice names are keys of the document by construction.
                (doc as unknown as Record<string, unknown>)[name] = clone(value);
            }
        }
    }

    /**
     * Runs a change and records how to undo it.
     *
     * The scope has to name everything `mutate` touches — anything left out is
     * simply not restored. That is the cost of not snapshotting the document.
     */
    function transact(label: string, scope: Scope, mutate: () => void): void {
        const before = snapshot(scope);
        mutate();
        const after = snapshot(scope);
        past.value.push({ label, before, after });
        if (past.value.length > HISTORY_DEPTH) {
            past.value.shift();
        }
        // A new change makes any redone future unreachable.
        future.value = [];
    }

    function undo(): string | null {
        const entry = past.value.pop();
        if (!entry) {
            return null;
        }
        apply(entry.before);
        future.value.push(entry);
        return entry.label;
    }

    function redo(): string | null {
        const entry = future.value.pop();
        if (!entry) {
            return null;
        }
        apply(entry.after);
        past.value.push(entry);
        return entry.label;
    }

    /** Called when a different level is loaded: its history means nothing here. */
    function reset(): void {
        past.value = [];
        future.value = [];
    }

    return { canUndo, canRedo, undoLabel, redoLabel, transact, undo, redo, reset, past, future };
});
