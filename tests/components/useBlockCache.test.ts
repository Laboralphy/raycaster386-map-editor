import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { createEmptyLevel } from '../../src/domain/defaults.ts';
import { BlockCache } from '../../src/libs/blockCache.ts';
import type { CanvasOps } from '../../src/libs/canvasOps.ts';
import { useBlockCache } from '../../src/composables/useBlockCache.ts';
import { useLevelStore } from '../../src/stores/level.ts';

/**
 * Decoding block thumbnails, and saying when they are ready.
 *
 * `LevelGridView` cannot be mounted — happy-dom has no 2d context — so the grid
 * itself is verified by the typecheck and by the browser. What *is* testable is
 * the signal the grid hangs its repaint on, and that signal is the whole reason
 * a freshly loaded level does not sit there drawn as empty cells: the previews
 * are data URLs, decoded asynchronously, so the first paint necessarily happens
 * before any of them exist.
 *
 * Canvas operations are injected, which is what lets any of this run headless.
 */

/** Ops that hand back a numbered stand-in instead of decoding anything. */
function fakeOps(): CanvasOps & { decoded: string[] } {
    const decoded: string[] = [];
    return {
        decoded,
        loadCanvas: async (src: string) => {
            decoded.push(src);
            return { width: 8, height: 8 } as unknown as HTMLCanvasElement;
        },
        createCanvas: () => ({ width: 8, height: 8 }) as unknown as HTMLCanvasElement,
        getData: () => '',
    };
}

function block(id: number, preview: string) {
    return {
        id,
        ref: '',
        phys: 1,
        offs: 0,
        light: { enabled: false, value: 0, inner: 0, outer: 0 },
        faces: { n: 0, e: 0, w: 0, s: 0, f: 0, c: 0 },
        preview,
    };
}

/** Runs the composable inside a scope, as a component would. */
function hydrateIn(cache: BlockCache, onReady: () => void, ops: CanvasOps) {
    const scope = effectScope();
    scope.run(() => useBlockCache(cache, onReady, ops));
    return scope;
}

beforeEach(() => setActivePinia(createPinia()));

describe('hydrating the block cache', () => {
    it('reports once when a level’s previews have all decoded', async () => {
        const level = useLevelStore();
        const doc = createEmptyLevel(2);
        doc.blocks.push(block(1, 'data:image/png;base64,AAA'));
        doc.blocks.push(block(2, 'data:image/png;base64,BBB'));
        doc.blocks.push(block(3, 'data:image/png;base64,CCC'));
        level.load(doc);

        const cache = new BlockCache();
        const ready = vi.fn();
        const ops = fakeOps();
        hydrateIn(cache, ready, ops);

        // Nothing is decoded synchronously, which is exactly why the grid's
        // first paint cannot show any of it.
        expect(cache.size).toBe(0);
        expect(ready).not.toHaveBeenCalled();

        await flushPromises();

        expect(ops.decoded).toHaveLength(3);
        expect(cache.size).toBe(3);
        // Once for the batch, not once per thumbnail — the grid does a full
        // redraw on this, and three of them would be three full redraws.
        expect(ready).toHaveBeenCalledTimes(1);
    });

    it('does not report when there is nothing to decode', async () => {
        useLevelStore().load(createEmptyLevel(2));
        const ready = vi.fn();
        hydrateIn(new BlockCache(), ready, fakeOps());

        await flushPromises();

        expect(ready).not.toHaveBeenCalled();
    });

    it('reports again when a block is edited, and re-decodes only that one', async () => {
        const level = useLevelStore();
        const doc = createEmptyLevel(2);
        doc.blocks.push(block(1, 'data:image/png;base64,AAA'));
        doc.blocks.push(block(2, 'data:image/png;base64,BBB'));
        level.load(doc);

        const cache = new BlockCache();
        const ready = vi.fn();
        const ops = fakeOps();
        hydrateIn(cache, ready, ops);
        await flushPromises();
        expect(ready).toHaveBeenCalledTimes(1);

        level.upsertBlock({ ...block(2, 'data:image/png;base64,ZZZ') });
        await nextTick();
        await flushPromises();

        expect(ready).toHaveBeenCalledTimes(2);
        // Keyed by the preview, not the id: the unchanged block is left alone.
        expect(ops.decoded).toEqual([
            'data:image/png;base64,AAA',
            'data:image/png;base64,BBB',
            'data:image/png;base64,ZZZ',
        ]);
    });

    it('drops a block that has gone, and reports that too', async () => {
        const level = useLevelStore();
        const doc = createEmptyLevel(2);
        doc.blocks.push(block(1, 'data:image/png;base64,AAA'));
        level.load(doc);

        const cache = new BlockCache();
        const ready = vi.fn();
        hydrateIn(cache, ready, fakeOps());
        await flushPromises();
        expect(cache.has(1)).toBe(true);

        level.deleteBlock(1);
        await nextTick();
        await flushPromises();

        expect(cache.has(1)).toBe(false);
        expect(ready).toHaveBeenCalledTimes(2);
    });
});
