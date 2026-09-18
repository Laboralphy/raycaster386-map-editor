import { describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_CELL_SIZE,
    GridRenderer,
    ZOOM_MAX,
    ZOOM_MIN,
    type CellPaint,
} from '../../src/libs/gridRenderer.ts';
import { fakeCanvasOps } from '../helpers/fakeCanvas.ts';

/**
 * Painting the grid cell by cell.
 *
 * The partial repaint is the whole point: dragging a selection across a 59x59
 * level repaints a handful of cells, not 3,481.
 */

function setup() {
    const ops = fakeCanvasOps();
    const renderer = new GridRenderer(ops);
    const target = ops.createCanvas(0, 0);
    const painted: { x: number; y: number }[] = [];
    const paint = vi.fn((p: CellPaint) => painted.push({ x: p.x, y: p.y }));
    return { ops, renderer, target, painted, paint };
}

describe('rendering the grid', () => {
    it('paints every cell when nothing is named as dirty', () => {
        const { renderer, target, painted, paint } = setup();
        renderer.render(target, 3, paint);
        expect(paint).toHaveBeenCalledTimes(9);
        expect(painted[0]).toEqual({ x: 0, y: 0 });
        expect(painted.at(-1)).toEqual({ x: 2, y: 2 });
    });

    it('paints only the dirty cells', () => {
        const { renderer, target, painted, paint } = setup();
        renderer.render(target, 10, paint, [
            { x: 1, y: 2 },
            { x: 3, y: 4 },
        ]);
        expect(painted).toEqual([
            { x: 1, y: 2 },
            { x: 3, y: 4 },
        ]);
    });

    it('skips a dirty cell that is off the grid', () => {
        const { renderer, target, paint } = setup();
        renderer.render(target, 2, paint, [
            { x: -1, y: 0 },
            { x: 0, y: 0 },
            { x: 5, y: 5 },
        ]);
        expect(paint).toHaveBeenCalledTimes(1);
    });

    it('sizes the canvas to the grid', () => {
        const { renderer, target, paint } = setup();
        renderer.render(target, 4, paint);
        expect(target.width).toBe(4 * DEFAULT_CELL_SIZE);
        expect(target.height).toBe(4 * DEFAULT_CELL_SIZE);
    });

    it('leaves the canvas size alone when it already fits', () => {
        const { renderer, target, paint } = setup();
        renderer.render(target, 4, paint);
        const fake = target as unknown as { resizes: unknown[] };
        const before = fake.resizes.length;

        renderer.render(target, 4, paint, [{ x: 0, y: 0 }]);

        // Assigning width or height clears a canvas, so a partial repaint that
        // touched either would wipe everything it was not repainting.
        expect(fake.resizes.length).toBe(before);
    });

    it('blits each cell into its own place', () => {
        const { renderer, target, paint } = setup();
        renderer.cellSize = 16;
        renderer.render(target, 2, paint, [{ x: 1, y: 1 }]);
        const fake = target as unknown as { calls: { dx: number; dy: number }[] };
        expect(fake.calls).toEqual([expect.objectContaining({ dx: 16, dy: 16 })]);
    });
});

describe('zooming', () => {
    it('steps in and out between the limits', () => {
        const { renderer } = setup();
        expect(renderer.cellSize).toBe(DEFAULT_CELL_SIZE);
        renderer.zoomIn();
        expect(renderer.cellSize).toBe(DEFAULT_CELL_SIZE + 8);
    });

    it('stops at the maximum and reports that nothing changed', () => {
        const { renderer } = setup();
        while (renderer.zoomIn()) {
            /* to the top */
        }
        expect(renderer.cellSize).toBe(ZOOM_MAX);
        expect(renderer.zoomIn()).toBe(false);
    });

    it('stops at the minimum', () => {
        const { renderer } = setup();
        while (renderer.zoomOut()) {
            /* to the bottom */
        }
        expect(renderer.cellSize).toBe(ZOOM_MIN);
        expect(renderer.zoomOut()).toBe(false);
    });

    it('resizes the scratch canvas with the zoom', () => {
        const { ops, renderer } = setup();
        const scratch = ops.created[0];
        renderer.cellSize = 48;
        expect(scratch.width).toBe(48);
        expect(scratch.height).toBe(48);
    });
});
