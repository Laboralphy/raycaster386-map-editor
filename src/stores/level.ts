import type { MapEditLevel } from '@laboralphy/raycaster386/mapedit';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createEmptyLevel } from '../domain/defaults';
import { nextTileId } from '../domain/ids';
import { parseLevel } from '../domain/parse';
import { toMapEditLevel } from '../domain/serialise';
import type { EditorLevel, EditorTile, TileType } from '../domain/types';
import * as vault from '../services/vaultClient';

/**
 * The document.
 *
 * `doc` is exactly what gets saved, and nothing else lives in it. The old store
 * conflated the two — `getLevel: state => state` handed the whole Vuex module
 * to `PUT /vault/:name` — so anything added to the store leaked into the file.
 * Keeping the document in one ref makes "the state is the save format" true of
 * `doc` precisely, and leaves room for store-level concerns beside it.
 */

const TILE_KEY: Record<TileType, 'walls' | 'flats' | 'sprites'> = {
    wall: 'walls',
    flat: 'flats',
    sprite: 'sprites',
};

export const useLevelStore = defineStore('level', () => {
    const doc = ref<EditorLevel>(createEmptyLevel());

    const gridSize = computed(() => doc.value.grid.length);
    const tileWidth = computed(() => doc.value.metrics.tileWidth);
    const tileHeight = computed(() => doc.value.metrics.tileHeight);

    function tilesOf(type: TileType): EditorTile[] {
        return doc.value.tiles[TILE_KEY[type]];
    }

    /** Every tile of a type, in order, including animation frames. */
    function allTiles(type: TileType): readonly EditorTile[] {
        return tilesOf(type);
    }

    /**
     * The tiles a browser should offer, hiding those consumed as animation
     * frames.
     *
     * Ported from `buildSmartTileGetter` in the old `level/getters.js`. An
     * animation occupies the `frames` tiles starting at the one declaring it,
     * so the followers are frames rather than tiles in their own right — and
     * offering them would let someone paint a wall with frame 2 of a torch.
     */
    function visibleTiles(type: TileType): EditorTile[] {
        const tiles = tilesOf(type);
        const hidden = new Set<number>();
        tiles.forEach((tile, index) => {
            const frames = tile.animation?.frames ?? 0;
            for (let i = 1; i < frames; ++i) {
                const follower = tiles[index + i];
                if (follower !== undefined) {
                    hidden.add(follower.id);
                }
            }
        });
        return tiles.filter((tile) => !hidden.has(tile.id));
    }

    function findTile(id: number): EditorTile | undefined {
        const { walls, flats, sprites } = doc.value.tiles;
        return (
            walls.find((t) => t.id === id) ??
            flats.find((t) => t.id === id) ??
            sprites.find((t) => t.id === id)
        );
    }

    /**
     * Blocks in phys order, as the block browser shows them.
     *
     * A copy. The old `getBlocks` getter ran `state.blocks.sort(...)` on the
     * state itself, so merely opening the block browser permanently reordered
     * `blocks` — and block order is legend order in the exported level, so a
     * read silently changed what the game would load.
     */
    const blocksByPhys = computed(() => [...doc.value.blocks].sort((a, b) => a.phys - b.phys));

    function load(raw: unknown): void {
        doc.value = parseLevel(raw);
    }

    /** The document as a plain object the converter accepts. */
    function serialise(): MapEditLevel {
        return toMapEditLevel(doc.value);
    }

    function reset(size?: number): void {
        doc.value = createEmptyLevel(size);
    }

    // --- tiles --------------------------------------------------------------

    /**
     * Adds tiles of one type, in order, and returns the ids they were given.
     *
     * The caller supplies the decoded size: the store stays free of the DOM so
     * that its tests run in Node. Ids are `max + 1` across all three groups —
     * see `domain/ids.ts` for why that is kept.
     */
    function addTiles(
        type: TileType,
        tiles: readonly { content: string; width: number; height: number }[]
    ): number[] {
        const ids: number[] = [];
        for (const tile of tiles) {
            const id = nextTileId(doc.value);
            tilesOf(type).push({
                id,
                type,
                content: tile.content,
                width: tile.width,
                height: tile.height,
                animation: null,
            });
            ids.push(id);
        }
        return ids;
    }

    /** Moves a tile to another tile's position, within its own group. */
    function moveTile(idSource: number, idTarget: number): void {
        const source = findTile(idSource);
        const target = findTile(idTarget);
        if (!source || !target || source.type !== target.type || source.id === target.id) {
            return;
        }
        const tiles = tilesOf(source.type);
        const from = tiles.findIndex((t) => t.id === idSource);
        const to = tiles.findIndex((t) => t.id === idTarget);
        tiles.splice(from, 1);
        tiles.splice(to, 0, source);
    }

    /** Every block face and thing that would dangle if this tile went away. */
    function tileUsage(id: number): { blocks: number[]; things: number[] } {
        const faces: (keyof EditorLevel['blocks'][number]['faces'])[] = [
            'n',
            'e',
            'w',
            's',
            'f',
            'c',
        ];
        return {
            blocks: doc.value.blocks
                .filter((b) => faces.some((f) => b.faces[f] === id))
                .map((b) => b.id),
            things: doc.value.things.filter((t) => t.tile === id).map((t) => t.id),
        };
    }

    /**
     * Deletes a tile and clears whatever referenced it.
     *
     * The old `DELETE_TILE` spliced the tile out and stopped there, leaving
     * `block.faces.*` pointing at an id that no longer existed. The converter's
     * `buildFace` calls `fail()` on an unknown face id, so the result was a
     * level that still edited and previewed but could no longer be exported,
     * with nothing to connect the failure to the deletion. Faces are nulled
     * here; things are refused outright, since a thing with no tile has nothing
     * to draw. The old guard for that compared a thing's own id against the
     * tile id and so never fired.
     */
    function deleteTile(id: number): { deleted: boolean; usedByThings: number[] } {
        const tile = findTile(id);
        if (!tile) {
            return { deleted: false, usedByThings: [] };
        }
        const usage = tileUsage(id);
        if (usage.things.length > 0) {
            return { deleted: false, usedByThings: usage.things };
        }
        for (const block of doc.value.blocks) {
            for (const face of ['n', 'e', 'w', 's', 'f', 'c'] as const) {
                if (block.faces[face] === id) {
                    block.faces[face] = null;
                }
            }
        }
        const tiles = tilesOf(tile.type);
        tiles.splice(
            tiles.findIndex((t) => t.id === id),
            1
        );
        return { deleted: true, usedByThings: [] };
    }

    function setTileAnimation(
        id: number,
        animation: { frames: number; duration: number; loop: number }
    ): void {
        const tile = findTile(id);
        if (tile) {
            tile.animation = { ...animation };
        }
    }

    /**
     * Removes a tile's animation.
     *
     * The old action passed `{tile}` while its mutation read `{idTile}`, so the
     * lookup was always `undefined` and the mutation always threw — the Delete
     * button in the animation builder never once worked.
     */
    function clearTileAnimation(id: number): void {
        const tile = findTile(id);
        if (tile) {
            tile.animation = null;
        }
    }

    function replaceTileContent(id: number, content: string, width: number, height: number): void {
        const tile = findTile(id);
        if (tile) {
            tile.content = content;
            tile.width = width;
            tile.height = height;
        }
    }

    // --- settings, as the Settings screen edits them -----------------------

    /**
     * Changes the project's tile size, rescaling everything measured in it.
     *
     * Ported from the old `SET_TILE_WIDTH` mutation, which scaled block
     * offsets, block light radii, thing sizes and fog distance by the ratio —
     * tile width is the world unit, so leaving them alone would silently resize
     * the level around the tiles. Rescaling the tile *images* is the caller's
     * job (see `rescaleTile`), because it needs a canvas.
     */
    function setTileSize(width: number, height: number): void {
        const previous = doc.value.metrics.tileWidth;
        const next = width | 0;
        doc.value.metrics.tileWidth = next;
        doc.value.metrics.tileHeight = height | 0;
        if (previous <= 0 || next === previous) {
            return;
        }
        const ratio = next / previous;
        for (const block of doc.value.blocks) {
            block.offs *= ratio;
            block.light.inner *= ratio;
            block.light.outer *= ratio;
        }
        for (const thing of doc.value.things) {
            thing.size *= ratio;
        }
        doc.value.ambiance.fog.distance *= ratio;
    }

    function setFlag(flag: keyof EditorLevel['flags'], value: boolean): void {
        doc.value.flags[flag] = value;
    }

    function setCameraThinker(thinker: string): void {
        doc.value.actor.thinker = thinker;
    }

    // --- persistence -------------------------------------------------------

    async function loadFromVault(name: string): Promise<void> {
        load(await vault.loadLevel(name));
    }

    async function saveToVault(name: string): Promise<void> {
        await vault.saveLevel(name, serialise());
    }

    return {
        doc,
        gridSize,
        tileWidth,
        tileHeight,
        blocksByPhys,
        allTiles,
        visibleTiles,
        findTile,
        tileUsage,
        addTiles,
        moveTile,
        deleteTile,
        setTileAnimation,
        clearTileAnimation,
        replaceTileContent,
        load,
        serialise,
        reset,
        setTileSize,
        setFlag,
        setCameraThinker,
        loadFromVault,
        saveToVault,
    };
});
