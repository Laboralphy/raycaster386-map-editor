import { context2d, domCanvasOps, type CanvasOps } from './canvasOps';

/**
 * Cutting a tilesheet into individual tiles.
 *
 * Ported from `_OLD_MAPEDIT_/src/libs/tileset-splitter/index.js`. Row-major,
 * left to right then top to bottom, which is the order the importer then
 * assigns ids in — so it is also the order an animation's frames end up in.
 *
 * Two fixes over the original: it took an `Image` and never attached an error
 * listener, so a corrupt paste hung the importer forever with no message; and
 * it reused one scratch canvas across the whole sheet, which meant a partial
 * tile at the right or bottom edge kept pixels from the previous tile. Each
 * tile now gets a cleared canvas of its own.
 */
export async function splitTileset(
    src: string,
    tileWidth: number,
    tileHeight: number,
    ops: CanvasOps = domCanvasOps
): Promise<string[]> {
    if (tileWidth <= 0 || tileHeight <= 0) {
        throw new Error(`splitTileset: tile size must be positive, got ${tileWidth}x${tileHeight}`);
    }
    const sheet = await ops.loadCanvas(src);
    const tiles: string[] = [];
    for (let y = 0; y + tileHeight <= sheet.height; y += tileHeight) {
        for (let x = 0; x + tileWidth <= sheet.width; x += tileWidth) {
            const tile = ops.createCanvas(tileWidth, tileHeight);
            const ctx = context2d(tile);
            ctx.clearRect(0, 0, tileWidth, tileHeight);
            ctx.drawImage(sheet, x, y, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);
            tiles.push(ops.getData(tile));
        }
    }
    return tiles;
}

/** Rescales one tile image, for when the project's tile size changes. */
export async function rescaleTile(
    src: string,
    width: number,
    height: number,
    ops: CanvasOps = domCanvasOps
): Promise<string> {
    const source = await ops.loadCanvas(src);
    const out = ops.createCanvas(width, height);
    context2d(out).drawImage(source, 0, 0, source.width, source.height, 0, 0, width, height);
    return ops.getData(out);
}
