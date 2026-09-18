import type { ImageAppender } from '@laboralphy/raycaster386/mapedit';
import { context2d, domCanvasOps, type CanvasOps } from './canvasOps';

/**
 * The browser half of the export path.
 *
 * `convertMapEditLevel(level, append)` does everything but combine images, and
 * this is the `append` it needs: it lays `count` consecutive frames out left to
 * right into one strip and hands back a data URL. Ported from
 * `_OLD_MAPEDIT_/src/libs/append-images/index.js`, which is the missing half
 * the analysis singled out as already written.
 *
 * The returned `width` and `height` are the size of **one frame**, not of the
 * strip. The renderer slices a sheet by frame, so reporting the full width
 * would make every animation exactly one frame long — an easy mistake with a
 * symptom far from its cause, which is why the library's `ImageAppender` type
 * says so too.
 */
export function createImageAppender(ops: CanvasOps = domCanvasOps): ImageAppender {
    return async (tiles, start, count) => {
        const frames = await Promise.all(
            Array.from({ length: count }, (_, i) =>
                ops.loadCanvas(String(tiles[start + i].content))
            )
        );
        if (frames.length === 0) {
            throw new Error('appendImages: no tile defined');
        }
        const width = frames[0].width;
        const height = frames[0].height;
        const strip = ops.createCanvas(width * count, height);
        const ctx = context2d(strip);
        frames.forEach((frame, i) => ctx.drawImage(frame, i * width, 0));
        return { src: ops.getData(strip), width: width | 0, height: height | 0 };
    };
}

/** The appender bound to the real DOM. */
export const appendImages: ImageAppender = createImageAppender();
