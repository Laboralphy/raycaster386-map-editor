import { describe, expect, it } from 'vitest';
import { rescaleTile, splitTileset } from '../../src/libs/tilesetSplitter.ts';
import { fakeCanvasOps } from '../helpers/fakeCanvas.ts';

/**
 * Cutting a sheet into tiles.
 *
 * Order is the point: the importer assigns ids in the order it gets them, and
 * an animation is a run of consecutive tiles, so a splitter that returned rows
 * bottom-up would make every animation built from a sheet run backwards.
 */
describe('splitting a tileset', () => {
    it('cuts row-major, left to right then top to bottom', async () => {
        const ops = fakeCanvasOps({ sheet: { width: 128, height: 192 } });
        const tiles = await splitTileset('sheet', 64, 96, ops);

        expect(tiles).toHaveLength(4);
        // Each tile records where on the sheet it was copied from.
        expect(
            tiles.map((t) =>
                t
                    .match(/\[(\d+),(\d+)/)
                    ?.slice(1, 3)
                    .join(',')
            )
        ).toEqual(['0,0', '64,0', '0,96', '64,96']);
    });

    it('gives every tile its own cleared canvas', async () => {
        const ops = fakeCanvasOps({ sheet: { width: 128, height: 96 } });
        await splitTileset('sheet', 64, 96, ops);
        expect(ops.created).toHaveLength(2);
        // The old splitter reused one scratch canvas for the whole sheet, so a
        // partial edge tile kept pixels from the tile before it.
        expect(ops.created.every((c) => c.cleared === 1)).toBe(true);
        expect(ops.created.every((c) => c.width === 64 && c.height === 96)).toBe(true);
    });

    it('ignores a partial tile at the right or bottom edge', async () => {
        const ops = fakeCanvasOps({ sheet: { width: 100, height: 96 } });
        // 100px of sheet holds one whole 64px tile and a 36px remainder.
        expect(await splitTileset('sheet', 64, 96, ops)).toHaveLength(1);
    });

    it('returns nothing for a sheet smaller than one tile', async () => {
        const ops = fakeCanvasOps({ sheet: { width: 32, height: 32 } });
        expect(await splitTileset('sheet', 64, 96, ops)).toEqual([]);
    });

    it('refuses a tile size that cannot produce tiles', async () => {
        const ops = fakeCanvasOps();
        await expect(splitTileset('sheet', 0, 96, ops)).rejects.toThrow(/must be positive/);
        await expect(splitTileset('sheet', 64, -1, ops)).rejects.toThrow(/must be positive/);
    });
});

describe('rescaling a tile', () => {
    it('draws the whole source into a canvas of the new size', async () => {
        const ops = fakeCanvasOps({ tile: { width: 64, height: 96 } });
        const out = await rescaleTile('tile', 32, 48, ops);

        expect(ops.created).toHaveLength(1);
        expect(ops.created[0].width).toBe(32);
        expect(ops.created[0].height).toBe(48);
        expect(ops.created[0].calls[0]).toMatchObject({ sx: 0, sy: 0, sw: 64, sh: 96 });
        expect(out).toContain('32x48');
    });
});
