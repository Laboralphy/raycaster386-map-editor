import type { EditorLevel } from './types';

/**
 * Id allocation: `max + 1`, as the old editor did.
 *
 * Ported from the `getMaxTileId` / `getMaxBlockId` / `getMaxThingId` getters in
 * `_OLD_MAPEDIT_/src/store/modules/level/getters.js`. Deriving the next id from
 * the current contents means **ids are reused after a deletion** — delete the
 * highest block and the next one created takes its number — so an id identifies
 * a thing only within one editing session.
 *
 * Kept anyway: the save format is full of these ids, changing the scheme risks
 * compatibility, and nothing observable improves. What does have to be true is
 * that reuse cannot corrupt a document, which is why deleting a tile clears the
 * faces that referenced it (see `stores/level.ts`).
 */

function maxId(ids: readonly number[]): number {
    return ids.reduce((max, id) => Math.max(max, id), 0);
}

/** Tile ids are unique across walls, flats and sprites together. */
export function nextTileId(level: EditorLevel): number {
    const { walls, flats, sprites } = level.tiles;
    return (
        maxId([...walls, ...flats, ...sprites].map((t) => t.id)) + 1
    );
}

export function nextBlockId(level: EditorLevel): number {
    return maxId(level.blocks.map((b) => b.id)) + 1;
}

export function nextThingId(level: EditorLevel): number {
    return maxId(level.things.map((t) => t.id)) + 1;
}
