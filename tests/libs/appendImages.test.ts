import type { MapEditTile } from '@laboralphy/raycaster386/mapedit';
import { describe, expect, it } from 'vitest';
import { createImageAppender } from '../../src/libs/appendImages.ts';
import { fakeCanvasOps } from '../helpers/fakeCanvas.ts';

/**
 * The browser `ImageAppender` the converter is handed.
 *
 * The one thing that must not drift: it reports the size of a single frame,
 * not of the strip it just built. Reporting the strip width makes the renderer
 * treat the whole sheet as one frame, so every animation freezes — a symptom a
 * long way from its cause.
 */

function tile(id: number, content: string): MapEditTile {
    return { id, type: 'wall', content, width: 64, height: 96, animation: null };
}

describe('appending frames into a strip', () => {
    it('reports the frame size, not the strip size', async () => {
        const ops = fakeCanvasOps({}, { width: 64, height: 96 });
        const append = createImageAppender(ops);

        const result = await append([tile(1, 'a'), tile(2, 'b'), tile(3, 'c')], 0, 3);

        expect(result.width).toBe(64);
        expect(result.height).toBe(96);
        // The strip itself really is three frames wide.
        expect(ops.created[0].width).toBe(192);
        expect(ops.created[0].height).toBe(96);
    });

    it('lays the frames out left to right, in order', async () => {
        const ops = fakeCanvasOps();
        const append = createImageAppender(ops);

        await append([tile(1, 'a'), tile(2, 'b'), tile(3, 'c')], 0, 3);

        expect(ops.created[0].calls.map((c) => c.dx)).toEqual([0, 64, 128]);
    });

    it('starts at the offset it is given', async () => {
        const ops = fakeCanvasOps();
        const append = createImageAppender(ops);

        const result = await append([tile(1, 'a'), tile(2, 'b'), tile(3, 'c')], 1, 2);

        expect(ops.created[0].width).toBe(128);
        expect(result.width).toBe(64);
    });

    it('refuses to build a strip from no frames', async () => {
        const append = createImageAppender(fakeCanvasOps());
        await expect(append([], 0, 0)).rejects.toThrow(/no tile defined/);
    });
});
