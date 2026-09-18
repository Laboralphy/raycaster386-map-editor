import type { MapEditLevel } from '@laboralphy/raycaster386/mapedit';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createEmptyLevel, emptyCell } from '../domain/defaults';
import { nextBlockId, nextThingId, nextTileId } from '../domain/ids';
import { parseLevel } from '../domain/parse';
import { toMapEditLevel } from '../domain/serialise';
import type {
    EditorBlock,
    EditorCell,
    EditorLevel,
    EditorMark,
    EditorThing,
    EditorTile,
    TileType,
} from '../domain/types';
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

    // --- blocks and things --------------------------------------------------

    function findBlock(id: number): EditorBlock | undefined {
        return doc.value.blocks.find((b) => b.id === id);
    }

    function findThing(id: number): EditorThing | undefined {
        return doc.value.things.find((t) => t.id === id);
    }

    /**
     * Creates a block, or replaces one that exists.
     *
     * `id` 0 means "new" — the same convention the old routes used, where
     * `/build-block/0` was the create form. The preview is rendered by the
     * caller and passed in: it needs a canvas, and this store stays free of the
     * DOM so its tests can run in Node.
     */
    function upsertBlock(block: Omit<EditorBlock, 'id'> & { id?: number }): number {
        const id = block.id && block.id > 0 ? block.id : nextBlockId(doc.value);
        const value: EditorBlock = { ...block, id };
        const at = doc.value.blocks.findIndex((b) => b.id === id);
        if (at >= 0) {
            doc.value.blocks[at] = value;
        } else {
            doc.value.blocks.push(value);
        }
        return id;
    }

    /**
     * Deletes a block and clears the cells that used it.
     *
     * The old `DESTROY_BLOCK` reset `cell.block` but left `cell.upperblock`
     * pointing at the deleted id, so a second storey kept a block that no
     * longer existed — and the converter reads the upper grid the same way it
     * reads the lower one.
     */
    function deleteBlock(id: number): boolean {
        const at = doc.value.blocks.findIndex((b) => b.id === id);
        if (at < 0) {
            return false;
        }
        doc.value.blocks.splice(at, 1);
        for (const row of doc.value.grid) {
            for (const cell of row) {
                if (cell.block === id) {
                    cell.block = 0;
                    cell.modified = true;
                }
                if (cell.upperblock === id) {
                    cell.upperblock = 0;
                    cell.modified = true;
                }
            }
        }
        return true;
    }

    function upsertThing(thing: Omit<EditorThing, 'id'> & { id?: number }): number {
        const id = thing.id && thing.id > 0 ? thing.id : nextThingId(doc.value);
        const value: EditorThing = { ...thing, id };
        const at = doc.value.things.findIndex((t) => t.id === id);
        if (at >= 0) {
            doc.value.things[at] = value;
        } else {
            doc.value.things.push(value);
        }
        return id;
    }

    /** Deletes a thing template and every placement of it on the grid. */
    function deleteThing(id: number): boolean {
        const at = doc.value.things.findIndex((t) => t.id === id);
        if (at < 0) {
            return false;
        }
        doc.value.things.splice(at, 1);
        for (const row of doc.value.grid) {
            for (const cell of row) {
                const before = cell.things.length;
                cell.things = cell.things.filter((placed) => placed.id !== id);
                if (cell.things.length !== before) {
                    cell.modified = true;
                }
            }
        }
        return true;
    }

    /** Reorders the thing palette. Order is cosmetic; nothing indexes into it. */
    function moveThing(idSource: number, idTarget: number): void {
        const things = doc.value.things;
        const from = things.findIndex((t) => t.id === idSource);
        const to = things.findIndex((t) => t.id === idTarget);
        if (from < 0 || to < 0 || from === to) {
            return;
        }
        const [moved] = things.splice(from, 1);
        things.splice(to, 0, moved);
    }

    // --- the grid -----------------------------------------------------------

    function cellAt(x: number, y: number): EditorCell | undefined {
        return doc.value.grid[y]?.[x];
    }

    /** Paints one cell on one storey. `0` clears it. */
    function setCellBlock(x: number, y: number, floor: number, blockId: number): void {
        const cell = cellAt(x, y);
        if (!cell) {
            return;
        }
        if (floor === 1) {
            cell.upperblock = blockId;
        } else {
            cell.block = blockId;
        }
        cell.modified = true;
    }

    function setCellsBlock(
        cells: readonly { x: number; y: number }[],
        floor: number,
        blockId: number
    ): void {
        for (const { x, y } of cells) {
            setCellBlock(x, y, floor, blockId);
        }
    }

    /**
     * Resizes the grid, keeping what still fits.
     *
     * Ported from `SET_GRID_SIZE`, which grew and shrank the square in place.
     * Startpoints outside the new bounds are left where they are — they read as
     * unplaced, which is what the old editor did too.
     */
    function setGridSize(size: number): void {
        const next = Math.max(1, Math.min(256, size | 0));
        const grid = doc.value.grid;
        while (grid.length > next) {
            grid.pop();
        }
        for (const row of grid) {
            while (row.length > next) {
                row.pop();
            }
            while (row.length < next) {
                row.push(emptyCell());
            }
        }
        while (grid.length < next) {
            grid.push(Array.from({ length: next }, emptyCell));
        }
    }

    function setCellTags(x: number, y: number, tags: readonly string[]): void {
        const cell = cellAt(x, y);
        if (cell) {
            cell.tags = [...tags];
            cell.modified = true;
        }
    }

    function setCellMark(x: number, y: number, mark: Partial<EditorMark>): void {
        const cell = cellAt(x, y);
        if (cell) {
            cell.mark = { ...cell.mark, ...mark };
            cell.modified = true;
        }
    }

    /**
     * Places a thing on a cell's 3x3 sub-grid, replacing whatever was there.
     *
     * The list is kept sorted by sub-cell position, as the original did, so the
     * saved order does not depend on the order things were placed.
     */
    function setCellThing(x: number, y: number, xt: number, yt: number, id: number): void {
        const cell = cellAt(x, y);
        if (!cell) {
            return;
        }
        const others = cell.things.filter((t) => t.x !== xt || t.y !== yt);
        cell.things = [...others, { id, x: xt, y: yt }].sort(
            (a, b) => a.x * 10 + a.y - (b.x * 10 + b.y)
        );
        cell.modified = true;
    }

    function removeCellThing(x: number, y: number, xt: number, yt: number): void {
        const cell = cellAt(x, y);
        if (!cell) {
            return;
        }
        cell.things = cell.things.filter((t) => t.x !== xt || t.y !== yt);
        // The old REMOVE_CELL_THING forgot to mark the cell, so the grid kept
        // drawing a thing that was no longer there until something else forced
        // a full repaint.
        cell.modified = true;
    }

    function thingAt(x: number, y: number, xt: number, yt: number) {
        return cellAt(x, y)?.things.find((t) => t.x === xt && t.y === yt);
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
        findBlock,
        findThing,
        upsertBlock,
        deleteBlock,
        upsertThing,
        deleteThing,
        moveThing,
        cellAt,
        setCellBlock,
        setCellsBlock,
        setGridSize,
        setCellTags,
        setCellMark,
        setCellThing,
        removeCellThing,
        thingAt,
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
