/**
 * Decoded block thumbnails, by block id.
 *
 * A block's `preview` is stored as a data URL, and decoding one is asynchronous
 * — but the grid paints a cell synchronously, hundreds of times per redraw. So
 * the decoding happens once, when a level loads or a block changes, and the
 * grid reads canvases out of here.
 *
 * Ported from `_OLD_MAPEDIT_/src/libs/block-cache/index.js`, which was a
 * module-level object with no eviction. This is a class so that a test — or a
 * second editor instance — gets its own.
 */
export class BlockCache {
    private readonly canvases = new Map<number, HTMLCanvasElement>();

    store(id: number, canvas: HTMLCanvasElement): void {
        this.canvases.set(id, canvas);
    }

    load(id: number): HTMLCanvasElement | undefined {
        return this.canvases.get(id);
    }

    has(id: number): boolean {
        return this.canvases.has(id);
    }

    remove(id: number): void {
        this.canvases.delete(id);
    }

    clear(): void {
        this.canvases.clear();
    }

    get size(): number {
        return this.canvases.size;
    }
}

/** The one the editor uses. */
export const blockCache = new BlockCache();
