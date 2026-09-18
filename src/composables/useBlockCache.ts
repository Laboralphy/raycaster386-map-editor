import { watch } from 'vue';
import type { BlockCache } from '../libs/blockCache';
import { domCanvasOps, type CanvasOps } from '../libs/canvasOps';
import { useLevelStore } from '../stores/level';

/**
 * Keeping decoded block thumbnails in step with the document.
 *
 * A block's `preview` is a data URL and decoding one is asynchronous, but the
 * grid paints synchronously — so every preview is decoded once, here, and the
 * painter only ever reads canvases.
 *
 * Keyed by the preview string rather than by block id: editing a block gives it
 * a new preview under the same id, and a cache keyed on the id alone would keep
 * drawing the old picture. That is what the original did, which is why its grid
 * needed a full reload to show an edited block.
 */
export function useBlockCache(
    cache: BlockCache,
    onReady: () => void,
    ops: CanvasOps = domCanvasOps
) {
    const level = useLevelStore();
    const decoded = new Map<number, string>();

    async function hydrate(): Promise<void> {
        let changed = false;
        for (const block of level.doc.blocks) {
            if (decoded.get(block.id) === block.preview) {
                continue;
            }
            if (block.preview === '') {
                cache.remove(block.id);
                decoded.set(block.id, '');
                changed = true;
                continue;
            }
            try {
                cache.store(block.id, await ops.loadCanvas(block.preview));
                decoded.set(block.id, block.preview);
                changed = true;
            } catch {
                // A preview that will not decode leaves the cell blank rather
                // than stopping the rest of the level from drawing.
                cache.remove(block.id);
                decoded.set(block.id, block.preview);
            }
        }
        // Blocks that have gone.
        const live = new Set(level.doc.blocks.map((b) => b.id));
        for (const id of [...decoded.keys()]) {
            if (!live.has(id)) {
                cache.remove(id);
                decoded.delete(id);
                changed = true;
            }
        }
        if (changed) {
            onReady();
        }
    }

    watch(
        () =>
            level.doc.blocks
                .map((b) => `${b.id}:${b.preview.length}:${b.preview.slice(-16)}`)
                .join('|'),
        () => void hydrate(),
        { immediate: true }
    );

    return { hydrate };
}
