import { ref } from 'vue';
import { useEditorStore } from '../stores/editor';

/**
 * Turning mouse drags on the grid canvas into a selected rectangle.
 *
 * The region itself lives in the editor store, because the tag, mark and
 * utility panels all act on it. What lives here is the dragging.
 *
 * Coordinates come from `offsetX`/`offsetY` rather than the old `layerX`, which
 * is non-standard and measured against a different element depending on the
 * browser.
 */
export function useGridSelection(cellSize: () => number, invalidate: (cells: Cell[]) => void) {
    const editor = useEditorStore();
    const dragging = ref(false);
    const anchor = ref({ x: -1, y: -1 });

    function toCell(event: MouseEvent): Cell {
        const size = cellSize();
        return { x: Math.floor(event.offsetX / size), y: Math.floor(event.offsetY / size) };
    }

    /** Every cell of a rectangle, corners in any order. */
    function rectCells(x1: number, y1: number, x2: number, y2: number): Cell[] {
        const cells: Cell[] = [];
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); ++y) {
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); ++x) {
                cells.push({ x, y });
            }
        }
        return cells;
    }

    /** The cells the previous selection covered, so they can be repainted. */
    function currentRegionCells(): Cell[] {
        const r = editor.selectedRegion;
        return r.x1 < 0 ? [] : rectCells(r.x1, r.y1, r.x2, r.y2);
    }

    function onMouseDown(event: MouseEvent): void {
        const cell = toCell(event);
        invalidate(currentRegionCells());
        editor.selectedRegion = { x1: cell.x, y1: cell.y, x2: cell.x, y2: cell.y };
        invalidate([cell]);
        anchor.value = cell;
        dragging.value = true;
    }

    function onMouseMove(event: MouseEvent): void {
        if (!dragging.value) {
            return;
        }
        const cell = toCell(event);
        const region = editor.selectedRegion;
        if (cell.x === region.x2 && cell.y === region.y2) {
            return;
        }
        invalidate(currentRegionCells());
        editor.selectedRegion = { x1: anchor.value.x, y1: anchor.value.y, x2: cell.x, y2: cell.y };
        invalidate(currentRegionCells());
    }

    function onMouseUp(): void {
        dragging.value = false;
    }

    return { dragging, toCell, rectCells, currentRegionCells, onMouseDown, onMouseMove, onMouseUp };
}

export interface Cell {
    x: number;
    y: number;
}
