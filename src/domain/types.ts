import type { MapEditCell, MapEditLevel } from '@laboralphy/raycaster386/mapedit';

/**
 * The editor's document model.
 *
 * These mirror the library's `MapEdit*` types with one difference: every
 * numeric field is `number`. The library types them `number | string` because
 * the old editor bound them to text inputs and saved whatever the field held —
 * real saves do contain `"offs": "16"` and `"size": "30"`. Tolerating that
 * everywhere would push a coercion into every consumer, so it is dealt with
 * once, in `parse.ts`.
 *
 * Narrowing is safe in both directions that matter:
 *
 * - `number` is assignable to `number | string`, so an `EditorLevel` *is* a
 *   `MapEditLevel` and can be handed to `convertMapEditLevel` unchanged. The
 *   assertion at the bottom of this file makes the compiler prove it.
 * - Every field narrowed here is coerced by the converter itself (`int()` or
 *   `parseFloat(String(...))`), so normalising cannot change its output.
 */

export type TileType = 'wall' | 'flat' | 'sprite';

/** A light attached to a block or a thing. */
export interface EditorLight {
    enabled: boolean;
    value: number;
    inner: number;
    outer: number;
}

/** An animation over consecutive tiles, starting at the tile that declares it. */
export interface EditorTileAnimation {
    frames: number;
    duration: number;
    loop: number;
}

/** One source tile. `content` is a data URL in the client, a hash on disk. */
export interface EditorTile {
    id: number;
    type: TileType;
    content: string;
    width: number;
    height: number;
    animation: EditorTileAnimation | null;
}

/**
 * The six faces of a block, each a tile id.
 *
 * `null` is a real value here, not an absence — it means "draw nothing on this
 * face", and every fixture uses it.
 */
export interface EditorFaces {
    n: number | null;
    e: number | null;
    w: number | null;
    s: number | null;
    f: number | null;
    c: number | null;
}

export interface EditorBlock {
    id: number;
    ref: string;
    /** Index into `PHYS_TABLE`, not an engine `PHYS_*` constant. */
    phys: number;
    /** Recess depth, in world units. Only meaningful for offset blocks. */
    offs: number;
    light: EditorLight;
    faces: EditorFaces;
    /** A rendered thumbnail, as a data URL. Editor-only; the converter drops it. */
    preview: string;
}

export interface EditorThing {
    id: number;
    ref: string;
    size: number;
    /** 0 = opaque, 1 = 75%, 2 = 50%, 3 = 25%. */
    opacity: number;
    ghost: boolean;
    tangible: boolean;
    light: EditorLight;
    /** The sprite tile this thing draws with. */
    tile: number;
}

/** A thing placed in a cell, on the cell's 3x3 sub-grid. */
export interface EditorCellThing {
    id: number;
    /** 0, 1 or 2. */
    x: number;
    y: number;
}

/** A mark drawn over a cell, for the level designer's own use. */
export interface EditorMark {
    color: number | string;
    shape: number;
}

/**
 * One cell of the grid.
 *
 * `block` and `upperblock` are `0` for empty. Note that the fixtures omit the
 * key entirely for empty cells — four different cell shapes appear across the
 * four levels — and this model regularises that to an explicit `0`. The
 * converter reads `cell.block || 0`, so its output is unchanged; the saved JSON
 * gains the key. `tests/domain/fidelity.test.ts` allows exactly that difference
 * and nothing else.
 *
 * (The library's `MapEditCell` types both as required `number | null`, which
 * real saves do not satisfy — they are frequently absent. Worth reporting.)
 */
export interface EditorCell {
    block: number;
    upperblock: number;
    tags: string[];
    things: EditorCellThing[];
    mark: EditorMark;
    /** A dirty flag for incremental repainting. Persisted, for no good reason. */
    modified: boolean;
}

export interface EditorStartpoint {
    x: number;
    y: number;
    /** In half-turns: the converter multiplies by PI. */
    angle: number;
    z: number;
}

export interface EditorMetrics {
    tileWidth: number;
    tileHeight: number;
}

export interface EditorFlags {
    smooth: boolean;
    stretch: boolean;
    /** Publish to the game directory on save. */
    export: boolean;
}

export interface EditorAmbiance {
    /** Sky texture, as a data URL or a hash. Empty for none. */
    sky: string;
    fog: { distance: number; color: string };
    filter: { enabled: boolean; color: string };
    brightness: number;
}

export interface EditorActor {
    /** An index into `startpoints`, not an id. */
    startpoint: number;
    /** A thinker class name the game resolves. Empty for the default. */
    thinker: string;
}

/** A complete document — exactly what is saved, and nothing else. */
export interface EditorLevel {
    tiles: {
        walls: EditorTile[];
        flats: EditorTile[];
        sprites: EditorTile[];
    };
    blocks: EditorBlock[];
    things: EditorThing[];
    /** `grid[y][x]`. Always square. */
    grid: EditorCell[][];
    metrics: EditorMetrics;
    flags: EditorFlags;
    /** Milliseconds per simulation frame. Drives animation duration defaults. */
    time: { interval: number };
    ambiance: EditorAmbiance;
    actor: EditorActor;
    startpoints: EditorStartpoint[];
    /** A screenshot of the level, as a data URL. The vault serves it as a file. */
    preview: string;
}

/**
 * The wire type, with one field corrected.
 *
 * `MapEditCell['mark']` is typed `{ color: number; shape: number }`, but every
 * real save stores CSS colour names there — `"cyan"`, `"red"` — because that is
 * what the old marker panel wrote. The library's type is simply inaccurate
 * about data the library itself never reads: the converter drops `mark`
 * entirely, so nothing downstream can care.
 *
 * (`MapEditCell` also types `block` and `upperblock` as required, and real
 * saves frequently omit them. That direction is harmless here — the document
 * always has them — so it needs no patch, only the note in `EditorCell`.)
 *
 * Both are worth reporting upstream. Until then, patching the one field keeps
 * the assertion below meaningful rather than deleting it.
 */
type WireCell = Omit<MapEditCell, 'mark'> & { mark?: EditorMark };
type WireLevel = Omit<MapEditLevel, 'grid'> & { grid: WireCell[][] };

/**
 * The compiler proving that a document can be converted without a mapper.
 *
 * If this stops compiling, `serialise.ts` has stopped being a plain deep clone
 * and something above it will have started lying about the save format.
 */
type _DocumentIsWireCompatible = EditorLevel extends WireLevel ? true : never;
const _documentIsWireCompatible: _DocumentIsWireCompatible = true;
void _documentIsWireCompatible;
