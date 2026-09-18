import { context2d } from '../libs/canvasOps';
import type { CellOverlayFactory, OverlayThing } from '../libs/cellOverlay';
import type { BlockCache } from '../libs/blockCache';
import type { CellPaint } from '../libs/gridRenderer';
import { useEditorStore } from '../stores/editor';
import { useLevelStore } from '../stores/level';

/**
 * Drawing one cell of the grid.
 *
 * This is the 250-line `paintEvent` from the old `LevelGrid.vue`, on its own.
 * It composites, in order: the block or blocks standing in the cell, whatever
 * is drawn over them, and the blue wash if the cell is selected.
 *
 * The interesting part is the two storeys. Which one you are editing changes
 * what the other looks like, so that you can see the floor you are not on
 * without mistaking it for the one you are:
 *
 * - editing the ground floor — it is drawn solid, and an upper block appears as
 *   a half-height ghost across the top;
 * - editing the upper storey — the upper block is drawn solid across the top
 *   half, and the ground floor fades to half opacity beneath it.
 *
 * A cell with no block at all gets a small red dot, so that an empty cell is
 * visibly empty rather than merely blank.
 */
export function useGridPaint(cache: BlockCache, overlay: CellOverlayFactory) {
    const level = useLevelStore();
    const editor = useEditorStore();

    function isSelected(x: number, y: number): boolean {
        if (!editor.hasRegion) {
            return false;
        }
        const r = editor.region;
        return x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2;
    }

    function paintCell({ x, y, canvas }: CellPaint): void {
        const cell = level.cellAt(x, y);
        if (!cell) {
            return;
        }
        const ctx = context2d(canvas);
        const w = canvas.width;
        const h = canvas.height;

        const lower = cell.block ? cache.load(cell.block) : undefined;
        const upper = cell.upperblock ? cache.load(cell.upperblock) : undefined;
        const onUpperFloor = editor.selectedFloor === 1;

        if (!lower && !upper) {
            ctx.fillStyle = 'red';
            ctx.fillRect((w >> 1) - 2, (h >> 1) - 2, 4, 4);
        }

        if (lower) {
            // Faded when it is not the storey being edited.
            const alpha = ctx.globalAlpha;
            ctx.globalAlpha = onUpperFloor ? 0.5 : 1;
            ctx.drawImage(lower, 0, 0, lower.width, lower.height, 0, 0, w, h);
            ctx.globalAlpha = alpha;
        }

        if (upper) {
            // The upper storey is drawn across the top half only, so both
            // storeys of a cell can be read at once.
            const alpha = ctx.globalAlpha;
            ctx.globalAlpha = onUpperFloor ? 1 : 0.5;
            ctx.drawImage(upper, 0, 0, upper.width, upper.height, 0, 0, w, h >> 1);
            ctx.globalAlpha = alpha;
        }

        const things: OverlayThing[] = cell.things.map((thing) => ({
            x: thing.x,
            y: thing.y,
            state:
                editor.selectedThing &&
                editor.selectedThing.xc === x &&
                editor.selectedThing.yc === y &&
                editor.selectedThing.xt === thing.x &&
                editor.selectedThing.yt === thing.y
                    ? 1
                    : 0,
        }));

        const startpoints = level.doc.startpoints;
        const startIndex = startpoints.findIndex((sp) => sp.x === x && sp.y === y);
        const decoration = overlay.get(
            cell.tags,
            cell.mark,
            things,
            startIndex >= 0
                ? {
                      startpoint: {
                          angle: startpoints[startIndex].angle,
                          selected: startIndex === level.doc.actor.startpoint,
                      },
                  }
                : {}
        );
        if (decoration) {
            ctx.drawImage(decoration, 0, 0, decoration.width, decoration.height, 0, 0, w, h);
        }

        if (isSelected(x, y)) {
            ctx.fillStyle = 'rgba(0, 64, 255, 0.4)';
            ctx.fillRect(0, 0, w, h);
        }
    }

    return { paintCell, isSelected };
}
