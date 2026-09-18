import { context2d, domCanvasOps, type CanvasOps } from './canvasOps';

/**
 * The placeholder for a sprite tile that is no longer there.
 *
 * A thing keeps a numeric tile id, and nothing stops that tile being deleted —
 * `deleteTile` refuses when a thing uses it, but a level saved by the old
 * editor may already contain the dangling reference. Drawing a red cross says
 * so plainly; the original's first attempt threw instead, which took the whole
 * browser panel down with it.
 *
 * Cached, because a browser full of broken things would otherwise redraw this
 * once per entry per render.
 */
let cached: string | null = null;

export function missingTileImage(ops: CanvasOps = domCanvasOps): string {
    if (cached !== null) {
        return cached;
    }
    const canvas = ops.createCanvas(64, 64);
    const ctx = context2d(canvas);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(64, 64);
    ctx.moveTo(64, 0);
    ctx.lineTo(0, 64);
    ctx.stroke();
    cached = ops.getData(canvas);
    return cached;
}

/** Test seam: forgets the cached placeholder. */
export function resetMissingTileImage(): void {
    cached = null;
}
