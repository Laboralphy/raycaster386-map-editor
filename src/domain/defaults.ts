import type {
    EditorAmbiance,
    EditorBlock,
    EditorCell,
    EditorLevel,
    EditorLight,
    EditorThing,
} from './types';

/**
 * What a fresh document, block, thing or cell starts as.
 *
 * Ported from `_OLD_MAPEDIT_/src/store/modules/level/state.js` and the cell
 * literal inside its `SET_GRID_SIZE` mutation. These are also the fallbacks
 * `parse.ts` uses for keys a save leaves out — the old `SET_STATE_CONTENT` had
 * none, so a missing key silently kept the *previous* level's value.
 */

/** Grid side, in cells, for a new level. */
export const DEFAULT_GRID_SIZE = 16;

export function emptyLight(): EditorLight {
    return { enabled: false, value: 0, inner: 0, outer: 0 };
}

export function emptyCell(): EditorCell {
    return {
        block: 0,
        upperblock: 0,
        tags: [],
        things: [],
        mark: { color: 0, shape: 0 },
        modified: false,
    };
}

export function emptyBlock(id: number): EditorBlock {
    return {
        id,
        ref: '',
        phys: 0,
        offs: 0,
        light: emptyLight(),
        faces: { n: null, e: null, w: null, s: null, f: null, c: null },
        preview: '',
    };
}

export function emptyThing(id: number): EditorThing {
    return {
        id,
        ref: '',
        size: 0,
        opacity: 0,
        ghost: false,
        tangible: false,
        light: emptyLight(),
        tile: 0,
    };
}

export function defaultAmbiance(): EditorAmbiance {
    return {
        sky: '',
        fog: { distance: 50, color: 'black' },
        filter: { enabled: false, color: '' },
        brightness: 0,
    };
}

export function emptyGrid(size: number): EditorCell[][] {
    return Array.from({ length: size }, () => Array.from({ length: size }, emptyCell));
}

export function createEmptyLevel(size = DEFAULT_GRID_SIZE): EditorLevel {
    return {
        tiles: { walls: [], flats: [], sprites: [] },
        blocks: [],
        things: [],
        grid: emptyGrid(size),
        metrics: { tileWidth: 64, tileHeight: 96 },
        flags: { smooth: false, stretch: false, export: false },
        time: { interval: 40 },
        ambiance: defaultAmbiance(),
        actor: { startpoint: 0, thinker: '' },
        startpoints: [{ x: -1, y: -1, z: 1, angle: 0 }],
        preview: '',
    };
}
