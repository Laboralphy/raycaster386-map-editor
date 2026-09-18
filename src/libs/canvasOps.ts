import { Canvas } from '@laboralphy/raycaster386';

/**
 * The canvas operations the tile pipeline needs, as an injectable dependency.
 *
 * Every drawing library here takes one of these rather than reaching for
 * `document` directly. That is not ceremony: happy-dom has no 2d context, so a
 * module that calls `document.createElement('canvas').getContext('2d')` cannot
 * be unit-tested at all — the old `tileset-splitter` had exactly that problem.
 * With the operations injected, the logic is testable with a fake and the real
 * implementation is four lines.
 */
export interface CanvasOps {
    /** Decodes an image URL (including a data URL) into a canvas. */
    loadCanvas(src: string): Promise<HTMLCanvasElement>;
    createCanvas(width: number, height: number): HTMLCanvasElement;
    /** The canvas as a data URL. PNG unless told otherwise. */
    getData(canvas: HTMLCanvasElement, type?: string): string;
}

/** The real thing, over the engine library's canvas helpers. */
export const domCanvasOps: CanvasOps = {
    loadCanvas: (src) => Canvas.loadCanvas(src),
    createCanvas: (width, height) => Canvas.createCanvas(width, height),
    getData: (canvas, type) => Canvas.getData(canvas, type),
};

/** A canvas' 2d context, or a clear error rather than a null dereference. */
export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
        throw new Error('canvas: could not acquire a 2d rendering context');
    }
    return ctx;
}
