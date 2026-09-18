import {
    PHYS_DOOR_UP,
    PHYS_NONE,
    PHYS_SECRET_BLOCK,
    PHYS_TRANSPARENT_BLOCK,
    PHYS_WALL,
} from '@laboralphy/raycaster386';
import { describe, expect, it } from 'vitest';
import { renderBlockPreview, type FaceContents } from '../../src/libs/blockRenderer.ts';
import { fakeCanvasOps } from '../helpers/fakeCanvas.ts';

/**
 * The block thumbnail.
 *
 * What matters is the layout decision: a block with one wall texture all round
 * is drawn as one square, matching opposites as two halves, and everything else
 * as four quarters. That is what makes a browser full of blocks readable, and
 * it is pure arithmetic, so it can be checked without drawing a pixel.
 */

function faces(over: Partial<FaceContents> = {}): FaceContents {
    return { n: '', e: '', w: '', s: '', f: '', c: '', ...over };
}

/** The destination rectangles drawn onto the thumbnail. */
function drawn(ops: ReturnType<typeof fakeCanvasOps>) {
    return ops.created[0].calls.map((c) => ({ x: c.dx, y: c.dy, w: c.dw, h: c.dh }));
}

describe('a solid wall block', () => {
    it('is one square when every wall wears the same texture', async () => {
        const ops = fakeCanvasOps();
        await renderBlockPreview(PHYS_WALL, faces({ n: 'a', e: 'a', w: 'a', s: 'a' }), false, ops);
        expect(drawn(ops)).toEqual([{ x: 0, y: 0, w: 96, h: 96 }]);
    });

    it('is two halves when opposite walls match', async () => {
        const ops = fakeCanvasOps();
        await renderBlockPreview(PHYS_WALL, faces({ w: 'a', e: 'a', n: 'b', s: 'b' }), false, ops);
        expect(drawn(ops)).toEqual([
            { x: 0, y: 0, w: 48, h: 96 },
            { x: 48, y: 0, w: 48, h: 96 },
        ]);
    });

    it('is four quarters when every wall differs', async () => {
        const ops = fakeCanvasOps();
        await renderBlockPreview(PHYS_WALL, faces({ w: 'a', n: 'b', s: 'c', e: 'd' }), false, ops);
        expect(drawn(ops)).toEqual([
            { x: 0, y: 0, w: 48, h: 48 },
            { x: 48, y: 0, w: 48, h: 48 },
            { x: 0, y: 48, w: 48, h: 48 },
            { x: 48, y: 48, w: 48, h: 48 },
        ]);
    });

    it('outlines a solid block in red, twice', async () => {
        const ops = fakeCanvasOps();
        await renderBlockPreview(PHYS_WALL, faces({ n: 'a', e: 'a', w: 'a', s: 'a' }), false, ops);
        const red = ops.created[0].strokes.filter((s) => s === 'rgb(255, 64, 64)');
        expect(red).toHaveLength(2);
    });
});

describe('an open cell', () => {
    it('shows floor and ceiling as halves when it has both', async () => {
        const ops = fakeCanvasOps();
        await renderBlockPreview(PHYS_NONE, faces({ f: 'floor', c: 'ceil' }), false, ops);
        expect(drawn(ops)).toEqual([
            { x: 0, y: 0, w: 96, h: 48 },
            { x: 0, y: 48, w: 96, h: 48 },
        ]);
    });

    it('fills the tile with the floor when there is no ceiling', async () => {
        const ops = fakeCanvasOps();
        await renderBlockPreview(PHYS_NONE, faces({ f: 'floor' }), false, ops);
        expect(drawn(ops)).toEqual([{ x: 0, y: 0, w: 96, h: 96 }]);
    });
});

describe('a block with a ceiling band', () => {
    it('stacks ceiling, walls and floor without a gap', async () => {
        const ops = fakeCanvasOps();
        await renderBlockPreview(
            PHYS_DOOR_UP,
            faces({ f: 'floor', c: 'ceil', n: 'a', e: 'a', w: 'a', s: 'a' }),
            false,
            ops
        );
        // ceiling 0..24, walls 24..72, floor 72..96
        expect(drawn(ops)).toEqual([
            { x: 0, y: 0, w: 96, h: 24 },
            { x: 0, y: 72, w: 96, h: 24 },
            { x: 0, y: 24, w: 96, h: 48 },
        ]);
    });

    it('fills the tile when there is no ceiling, using the odd 0.37/0.38 split', async () => {
        const ops = fakeCanvasOps();
        await renderBlockPreview(
            PHYS_DOOR_UP,
            faces({ f: 'floor', w: 'a', n: 'b', s: 'c', e: 'd' }),
            false,
            ops
        );
        const rects = drawn(ops);
        // The floor sits at the bottom, and the two wall bands are 35 and 36
        // pixels — deliberately uneven so that together with the floor they
        // cover the tile exactly.
        expect(rects[0]).toEqual({ x: 0, y: 72, w: 96, h: 24 });
        expect(rects[1].h).toBe(35);
        expect(rects[3].h).toBe(36);
        expect(rects[3].y + rects[3].h).toBe(71);
    });
});

describe('the kind marks', () => {
    it('draws a door arrow', async () => {
        const ops = fakeCanvasOps();
        await renderBlockPreview(PHYS_DOOR_UP, faces({ f: 'f', w: 'a' }), false, ops);
        expect(ops.created[0].strokes).toContain('rgb(0, 255, 96)');
        expect(ops.created[0].segments).toBeGreaterThan(0);
    });

    it('draws the secret block’s keyhole, arc and all', async () => {
        const ops = fakeCanvasOps();
        await renderBlockPreview(PHYS_SECRET_BLOCK, faces({ f: 'f', w: 'a' }), false, ops);
        expect(ops.created[0].strokes).toContain('rgb(255, 255, 0)');
        expect(ops.created[0].arcs).toBe(1);
    });

    it('marks a transparent block in magenta', async () => {
        const ops = fakeCanvasOps();
        await renderBlockPreview(PHYS_TRANSPARENT_BLOCK, faces({ f: 'f', w: 'a' }), false, ops);
        expect(ops.created[0].strokes).toContain('rgb(255, 0, 255)');
    });

    it('leaves an open cell unmarked', async () => {
        const ops = fakeCanvasOps();
        await renderBlockPreview(PHYS_NONE, faces({ f: 'f' }), false, ops);
        // Only the per-face black outline, no coloured kind mark.
        expect(ops.created[0].strokes.every((s) => s === '#000000')).toBe(true);
    });

    it('adds a star of eight rays for a light emitter', async () => {
        const ops = fakeCanvasOps();
        const dark = fakeCanvasOps();
        await renderBlockPreview(PHYS_NONE, faces({ f: 'f' }), true, ops);
        await renderBlockPreview(PHYS_NONE, faces({ f: 'f' }), false, dark);

        expect(ops.created[0].strokes).toContain('rgb(255, 255, 255)');
        expect(ops.created[0].segments - dark.created[0].segments).toBe(8);
    });
});

describe('a face that cannot be drawn', () => {
    it('still outlines the block rather than failing', async () => {
        const ops = fakeCanvasOps();
        ops.loadCanvas = () => Promise.reject(new Error('broken image'));

        // A block whose tile will not decode has to render *something*: the
        // builder throwing here would take the whole panel down.
        const preview = await renderBlockPreview(PHYS_WALL, faces({ w: 'bad' }), false, ops);
        expect(preview).toContain('fake:96x96');
        expect(ops.created[0].strokes).toContain('#000000');
    });
});
