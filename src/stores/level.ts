import type { MapEditLevel } from '@laboralphy/raycaster386/mapedit';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createEmptyLevel } from '../domain/defaults';
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

    // --- settings, as the Settings screen edits them -----------------------

    function setTileSize(width: number, height: number): void {
        // Rescaling the existing tiles is deliberately not here: it belongs
        // with the rest of the tile pipeline. See the plan's phase 2.
        doc.value.metrics.tileWidth = width | 0;
        doc.value.metrics.tileHeight = height | 0;
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
