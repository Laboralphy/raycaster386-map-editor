import { convertMapEditLevel } from '@laboralphy/raycaster386/mapedit';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyLevel } from '../../src/domain/defaults.ts';
import { useLevelStore } from '../../src/stores/level.ts';
import { stubAppender } from '../helpers/fixtures.ts';

/**
 * The tile half of the document.
 *
 * Four of the five old bugs this phase fixes live here, so most of these cases
 * exist to pin a behaviour the original got wrong.
 */

function tile(content: string, width = 64, height = 96) {
    return { content, width, height };
}

beforeEach(() => setActivePinia(createPinia()));

function seeded() {
    const store = useLevelStore();
    store.load(createEmptyLevel(1));
    return store;
}

describe('adding tiles', () => {
    it('hands out ids unique across all three groups', () => {
        const store = seeded();
        expect(store.addTiles('wall', [tile('a'), tile('b')])).toEqual([1, 2]);
        expect(store.addTiles('flat', [tile('c')])).toEqual([3]);
        expect(store.addTiles('sprite', [tile('d')])).toEqual([4]);
    });

    it('keeps the order it was given', () => {
        // The old importer walked its candidates backwards while pushing
        // forwards, so a sheet imported reversed — and an animation built from
        // it ran backwards.
        const store = seeded();
        store.addTiles('wall', [tile('first'), tile('second'), tile('third')]);
        expect(store.allTiles('wall').map((t) => t.content)).toEqual(['first', 'second', 'third']);
    });
});

describe('reordering tiles', () => {
    it('moves a tile to another tile’s position', () => {
        const store = seeded();
        store.addTiles('wall', [tile('a'), tile('b'), tile('c')]);
        store.moveTile(3, 1);
        expect(store.allTiles('wall').map((t) => t.content)).toEqual(['c', 'a', 'b']);
    });

    it('refuses to move a tile into another group', () => {
        const store = seeded();
        store.addTiles('wall', [tile('a')]);
        store.addTiles('flat', [tile('b')]);
        store.moveTile(1, 2);
        expect(store.allTiles('wall')).toHaveLength(1);
        expect(store.allTiles('flat')).toHaveLength(1);
    });
});

describe('animations', () => {
    it('hides the frames an animation consumes from the browser', () => {
        const store = seeded();
        store.addTiles('wall', [tile('a'), tile('b'), tile('c'), tile('d')]);
        store.setTileAnimation(1, { frames: 3, duration: 100, loop: 1 });

        // Tiles 2 and 3 are frames of tile 1's animation, not tiles in their
        // own right — offering them would let someone paint with frame 2.
        expect(store.visibleTiles('wall').map((t) => t.id)).toEqual([1, 4]);
        expect(store.allTiles('wall')).toHaveLength(4);
    });

    it('clears an animation', () => {
        // The old Delete button sent `{tile}` to a mutation reading `{idTile}`,
        // so it always threw and never once cleared an animation.
        const store = seeded();
        store.addTiles('wall', [tile('a'), tile('b')]);
        store.setTileAnimation(1, { frames: 2, duration: 100, loop: 1 });
        store.clearTileAnimation(1);
        expect(store.findTile(1)?.animation).toBeNull();
        expect(store.visibleTiles('wall')).toHaveLength(2);
    });
});

describe('deleting a tile', () => {
    it('clears the block faces that referenced it', async () => {
        const store = seeded();
        store.addTiles('wall', [tile('a'), tile('b')]);
        store.addTiles('flat', [tile('f')]);
        store.doc.blocks.push({
            id: 1,
            ref: '',
            phys: 1,
            offs: 0,
            light: { enabled: false, value: 0, inner: 0, outer: 0 },
            faces: { n: 1, e: 2, w: 1, s: 2, f: 3, c: 3 },
            preview: '',
        });
        store.doc.grid[0][0].block = 1;

        expect(store.tileUsage(1).blocks).toEqual([1]);
        expect(store.deleteTile(1).deleted).toBe(true);

        expect(store.doc.blocks[0].faces).toEqual({ n: null, e: 2, w: null, s: 2, f: 3, c: 3 });

        // The point of the fix: the level still converts. Before, the dangling
        // face id made `buildFace` fail and the level could not be exported at
        // all, with nothing connecting that to the deletion.
        await expect(convertMapEditLevel(store.serialise(), stubAppender)).resolves.toBeDefined();
    });

    it('refuses to delete a tile a thing draws with', () => {
        const store = seeded();
        store.addTiles('sprite', [tile('s')]);
        store.doc.things.push({
            id: 7,
            ref: 'ghost',
            size: 16,
            opacity: 0,
            ghost: false,
            tangible: true,
            light: { enabled: false, value: 0, inner: 0, outer: 0 },
            tile: 1,
        });

        // The old guard compared a *thing's own id* against the tile id, so it
        // never fired and a thing could be left pointing at nothing.
        const result = store.deleteTile(1);
        expect(result).toEqual({ deleted: false, usedByThings: [7] });
        expect(store.allTiles('sprite')).toHaveLength(1);
    });

    it('reports nothing for a tile that is not there', () => {
        expect(seeded().deleteTile(99)).toEqual({ deleted: false, usedByThings: [] });
    });
});

describe('changing the tile size', () => {
    it('rescales everything measured in tile widths', () => {
        const store = seeded();
        store.doc.blocks.push({
            id: 1,
            ref: '',
            phys: 12,
            offs: 16,
            light: { enabled: true, value: 0.5, inner: 32, outer: 64 },
            faces: { n: null, e: null, w: null, s: null, f: null, c: null },
            preview: '',
        });
        store.doc.things.push({
            id: 1,
            ref: '',
            size: 30,
            opacity: 0,
            ghost: false,
            tangible: true,
            light: { enabled: false, value: 0, inner: 0, outer: 0 },
            tile: 0,
        });
        store.doc.ambiance.fog.distance = 50;

        store.setTileSize(128, 192);

        // Tile width is the world unit, so doubling it doubles everything
        // measured in it — otherwise the level silently resizes around the
        // tiles. Light intensity is not a distance and does not scale.
        expect(store.doc.blocks[0].offs).toBe(32);
        expect(store.doc.blocks[0].light.inner).toBe(64);
        expect(store.doc.blocks[0].light.outer).toBe(128);
        expect(store.doc.blocks[0].light.value).toBe(0.5);
        expect(store.doc.things[0].size).toBe(60);
        expect(store.doc.ambiance.fog.distance).toBe(100);
    });

    it('leaves the measurements alone when only the height changes', () => {
        const store = seeded();
        store.doc.ambiance.fog.distance = 50;
        store.setTileSize(64, 128);
        expect(store.doc.metrics.tileHeight).toBe(128);
        expect(store.doc.ambiance.fog.distance).toBe(50);
    });
});
