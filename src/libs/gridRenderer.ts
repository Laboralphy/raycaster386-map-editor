import { context2d, domCanvasOps, type CanvasOps } from './canvasOps';

/**
 * Painting the level grid, one cell at a time.
 *
 * Ported from `_OLD_MAPEDIT_/src/libs/grid-renderer/index.js`. It owns one
 * scratch canvas the size of a cell: each cell is cleared, handed to the
 * painter, given its border, and blitted into place. Only the cells named as
 * dirty are repainted, which is what keeps a 59x59 grid responsive while
 * dragging a selection across it.
 *
 * **The painter is a callback, not an event.** The original emitted `'paint'`
 * through Node's `EventEmitter` and the consumer subscribed with an *async*
 * handler — but `emit` is synchronous, so the cell was composited before any
 * awaited work inside the handler finished. Taking a synchronous callback makes
 * that race impossible to write.
 *
 * Cell width and height were separate fields with one setter each, but zooming
 * always set both to the same value, so there is one `cellSize` here.
 */

export const ZOOM_MIN = 16;
export const ZOOM_MAX = 64;
export const ZOOM_STEP = 8;
export const DEFAULT_CELL_SIZE = 32;

/** Where a cell is, and the scratch canvas to draw it on. */
export interface CellPaint {
    x: number;
    y: number;
    canvas: HTMLCanvasElement;
}

export type CellPainter = (paint: CellPaint) => void;

export interface Dirty {
    x: number;
    y: number;
}

export class GridRenderer {
    private readonly scratch: HTMLCanvasElement;
    private size = DEFAULT_CELL_SIZE;

    constructor(ops: CanvasOps = domCanvasOps) {
        this.scratch = ops.createCanvas(DEFAULT_CELL_SIZE, DEFAULT_CELL_SIZE);
    }

    get cellSize(): number {
        return this.size;
    }

    set cellSize(value: number) {
        this.size = value;
        this.scratch.width = value;
        this.scratch.height = value;
    }

    /** @returns true if the zoom actually changed. */
    zoomIn(): boolean {
        const next = Math.min(ZOOM_MAX, this.size + ZOOM_STEP);
        const changed = next !== this.size;
        this.cellSize = next;
        return changed;
    }

    zoomOut(): boolean {
        const next = Math.max(ZOOM_MIN, this.size - ZOOM_STEP);
        const changed = next !== this.size;
        this.cellSize = next;
        return changed;
    }

    /** The pixel size of a grid of `cells` cells per side. */
    canvasSize(cells: number): number {
        return cells * this.size;
    }

    private renderCell(target: HTMLCanvasElement, paint: CellPainter, x: number, y: number): void {
        const scratchCtx = context2d(this.scratch);
        scratchCtx.clearRect(0, 0, this.size, this.size);
        paint({ x, y, canvas: this.scratch });
        scratchCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        scratchCtx.strokeRect(0, 0, this.size, this.size);

        const ctx = context2d(target);
        ctx.clearRect(x * this.size, y * this.size, this.size, this.size);
        ctx.drawImage(this.scratch, x * this.size, y * this.size);
    }

    /**
     * Repaints the grid, or only the cells listed as dirty.
     *
     * @param cells the grid's side, in cells
     * @param dirty omit to repaint everything
     */
    render(
        target: HTMLCanvasElement,
        cells: number,
        paint: CellPainter,
        dirty?: readonly Dirty[]
    ): void {
        const pixels = this.canvasSize(cells);
        // Assigning either dimension clears the canvas, so only do it on a real
        // change — otherwise every partial redraw would wipe the whole grid.
        if (target.width !== pixels) {
            target.width = pixels;
        }
        if (target.height !== pixels) {
            target.height = pixels;
        }

        if (dirty === undefined) {
            for (let y = 0; y < cells; ++y) {
                for (let x = 0; x < cells; ++x) {
                    this.renderCell(target, paint, x, y);
                }
            }
            return;
        }
        for (const { x, y } of dirty) {
            if (x >= 0 && y >= 0 && x < cells && y < cells) {
                this.renderCell(target, paint, x, y);
            }
        }
    }
}
