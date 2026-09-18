/**
 * The editor's vocabulary: what a phys code means, and what an animation loop
 * mode is called.
 *
 * Transcribed from `_OLD_MAPEDIT_/src/store/modules/editor/state.js`, where it
 * sat inside the Vuex `editor` module's state. It is frozen reference data that
 * nothing mutates, so it does not belong in a store.
 *
 * A block's `phys` is an index into `PHYS_TABLE`, not one of the engine's
 * `PHYS_*` constants — the two happen to agree today, and the converter maps
 * index to constant. Keep reading it as an index.
 *
 * **The labels for indices 6 and 7 are corrected here.** The old table called 6
 * "Door right" and 7 "Door left", but `convertMapEditLevel` maps 6 to
 * `@PHYS_DOOR_LEFT` and 7 to `@PHYS_DOOR_RIGHT` — so picking "Door right" in
 * the old editor built a door the engine slides left. Only the text changes;
 * the indices, and therefore every existing level, are untouched.
 */

/** Which faces a block of this kind actually uses: a subset of `fcnews`. */
export interface PhysEntry {
    id: number;
    label: string;
    desc: string;
    tiles: string;
    /** True when the `offs` field is meaningful for this kind. */
    offset: boolean;
}

export const PHYS_TABLE: readonly PhysEntry[] = Object.freeze([
    {
        id: 0,
        label: 'Walkable',
        desc: 'You can walk on this type of block',
        tiles: 'fc',
        offset: false,
    },
    {
        id: 1,
        label: 'Solid',
        desc: 'You cannot walk on this type of block : this is a plain solid wall',
        tiles: 'news',
        offset: false,
    },
    {
        id: 2,
        label: 'Door up',
        desc: 'This is a door that slides up when opened',
        tiles: 'fcnews',
        offset: false,
    },
    {
        id: 3,
        label: 'Curtain up',
        desc: 'This is a curtain that slides up when opened',
        tiles: 'fcnews',
        offset: false,
    },
    {
        id: 4,
        label: 'Door down',
        desc: 'This is a door that slides down when opened',
        tiles: 'fcnews',
        offset: false,
    },
    {
        id: 5,
        label: 'Curtain down',
        desc: 'This is a curtain that slides down when opened',
        tiles: 'fcnews',
        offset: false,
    },
    {
        id: 6,
        label: 'Door left',
        desc: 'This is a door that slides to the left when opened',
        tiles: 'fcnews',
        offset: false,
    },
    {
        id: 7,
        label: 'Door right',
        desc: 'This is a door that slides to the right when opened',
        tiles: 'fcnews',
        offset: false,
    },
    {
        id: 8,
        label: 'Door double',
        desc: 'This is a double panel door',
        tiles: 'fcnews',
        offset: false,
    },
    {
        id: 9,
        label: 'Secret block',
        desc: 'This is a secret block (they work in pair)',
        tiles: 'fcnews',
        offset: false,
    },
    {
        id: 10,
        label: 'Transparent block',
        desc: 'This is a transparent block : It is not walkable, but you can build windows with this because rays will pass through it.',
        tiles: 'fcnews',
        offset: true,
    },
    {
        id: 11,
        label: 'Invisible block',
        desc: 'This is an invisible block : It is not walkable',
        tiles: 'fc',
        offset: false,
    },
    {
        id: 12,
        label: 'Offset block',
        desc: 'This block is like a solid block, with an offset',
        tiles: 'fcnews',
        offset: true,
    },
]);

export interface LoopEntry {
    id: number;
    label: string;
    desc: string;
}

export const LOOP_TABLE: readonly LoopEntry[] = Object.freeze([
    { id: 0, label: 'None', desc: 'No animation at all' },
    { id: 1, label: 'Forward', desc: 'Forward animation only' },
    { id: 2, label: 'Yoyo', desc: 'Forward and backward animation' },
]);

/** Cell mark shapes, from `_OLD_MAPEDIT_/src/consts/index.js`. */
export const SHAPE_NONE = 0;
export const SHAPE_CIRCLE = 1;
export const SHAPE_TRIANGLE = 2;
export const SHAPE_RHOMBUS = 3;
export const SHAPE_HEXAGON = 4;
export const SHAPE_SQUARE = 5;

/** The colours the marker panel offers, in its order. */
export const MARK_COLORS: readonly string[] = Object.freeze([
    'black',
    'red',
    'lime',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
]);

/** A block preview is rendered at this size. */
export const BLOCK_WIDTH = 96;
export const BLOCK_HEIGHT = 96;

export function physOf(index: number): PhysEntry | undefined {
    return PHYS_TABLE[index];
}
