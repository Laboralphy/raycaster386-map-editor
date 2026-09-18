import { ref } from 'vue';
import type { Cell } from './useGridSelection';
import { useEditorStore } from '../stores/editor';
import { useHistoryStore } from '../stores/history';
import { useLevelStore } from '../stores/level';

/**
 * What the grid's toolbar does: paint, copy, paste, clear, resize, undo.
 *
 * Every change goes through `history.transact`, naming the cells it touches, so
 * undo works for all of them — the old editor recorded only block painting, and
 * had no redo at all.
 */

interface Clipboard {
    width: number;
    height: number;
    cells: { block: number; upperblock: number }[];
}

export function useGridTools(invalidate: (cells: Cell[]) => void) {
    const level = useLevelStore();
    const editor = useEditorStore();
    const history = useHistoryStore();

    const clipboard = ref<Clipboard | null>(null);

    /** Paints the selection with the block the browser has picked. */
    function paintSelection(): void {
        const blockId = editor.blockBrowserSelected;
        const cells = editor.regionCells();
        if (blockId === null || cells.length === 0) {
            return;
        }
        history.transact(`paint block #${blockId}`, { cells }, () => {
            level.setCellsBlock(cells, editor.selectedFloor, blockId);
        });
        invalidate(cells);
        editor.dirty = true;
    }

    function copySelection(): void {
        const r = editor.region;
        const cells = editor.regionCells();
        if (cells.length === 0) {
            return;
        }
        clipboard.value = {
            width: r.x2 - r.x1 + 1,
            height: r.y2 - r.y1 + 1,
            cells: cells.map(({ x, y }) => {
                const cell = level.cellAt(x, y);
                return { block: cell?.block ?? 0, upperblock: cell?.upperblock ?? 0 };
            }),
        };
        editor.setStatus(`${cells.length} cell(s) copied`);
    }

    /**
     * Pastes the clipboard with its top-left corner at the selection's.
     *
     * Cells that would land outside the grid are skipped rather than wrapped —
     * but the clipboard index still advances with them, so the block that
     * *would* have gone off the edge is not silently pasted somewhere else.
     */
    function pasteSelection(): void {
        const board = clipboard.value;
        if (!board || !editor.hasRegion) {
            return;
        }
        const { x1, y1 } = editor.region;
        const size = level.gridSize;
        const touched: Cell[] = [];
        for (let y = 0; y < board.height; ++y) {
            for (let x = 0; x < board.width; ++x) {
                const tx = x1 + x;
                const ty = y1 + y;
                if (tx >= 0 && ty >= 0 && tx < size && ty < size) {
                    touched.push({ x: tx, y: ty });
                }
            }
        }
        if (touched.length === 0) {
            return;
        }
        history.transact('paste', { cells: touched }, () => {
            let i = 0;
            for (let y = 0; y < board.height; ++y) {
                for (let x = 0; x < board.width; ++x) {
                    const source = board.cells[i++];
                    const tx = x1 + x;
                    const ty = y1 + y;
                    if (tx >= 0 && ty >= 0 && tx < size && ty < size) {
                        level.setCellBlock(tx, ty, 0, source.block);
                        level.setCellBlock(tx, ty, 1, source.upperblock);
                    }
                }
            }
        });
        invalidate(touched);
        editor.dirty = true;
        editor.setStatus(`${touched.length} cell(s) pasted`);
    }

    /** Empties the selection on the storey being edited. */
    function clearSelection(): void {
        const cells = editor.regionCells();
        if (cells.length === 0) {
            return;
        }
        history.transact('clear', { cells }, () => {
            level.setCellsBlock(cells, editor.selectedFloor, 0);
        });
        invalidate(cells);
        editor.dirty = true;
    }

    /**
     * Places the selected thing template at a sub-cell.
     *
     * Clicking a sub-cell that already holds a thing selects it instead, which
     * is what the thing panel shows.
     */
    function placeThing(x: number, y: number, xt: number, yt: number): boolean {
        const id = editor.thingBrowserSelected;
        if (id === null) {
            return false;
        }
        history.transact(`place thing #${id}`, { cells: [{ x, y }] }, () => {
            level.setCellThing(x, y, xt, yt, id);
        });
        invalidate([{ x, y }]);
        editor.dirty = true;
        return true;
    }

    function removeThing(x: number, y: number, xt: number, yt: number): void {
        history.transact('remove thing', { cells: [{ x, y }] }, () => {
            level.removeCellThing(x, y, xt, yt);
        });
        invalidate([{ x, y }]);
        editor.dirty = true;
    }

    /**
     * Resizes the grid.
     *
     * Every cell is in scope, because shrinking drops rows and growing adds
     * them — one large history entry rather than an unusable undo.
     */
    function resizeGrid(size: number): void {
        const next = Math.max(1, Math.min(256, size | 0));
        if (next === level.gridSize) {
            return;
        }
        const cells: Cell[] = [];
        for (let y = 0; y < Math.max(next, level.gridSize); ++y) {
            for (let x = 0; x < Math.max(next, level.gridSize); ++x) {
                cells.push({ x, y });
            }
        }
        history.transact(`resize to ${next}`, { cells }, () => level.setGridSize(next));
        editor.clearRegion();
        editor.dirty = true;
    }

    function undo(): void {
        const label = history.undo();
        editor.setStatus(label ? `undo: ${label}` : 'nothing to undo');
    }

    function redo(): void {
        const label = history.redo();
        editor.setStatus(label ? `redo: ${label}` : 'nothing to redo');
    }

    return {
        clipboard,
        paintSelection,
        copySelection,
        pasteSelection,
        clearSelection,
        placeThing,
        removeThing,
        resizeGrid,
        undo,
        redo,
    };
}
