import { asArray, isRecord, toBool, toFloat, toIdOrNull, toInt, toStr } from './coerce';
import { defaultAmbiance, emptyCell, emptyLight } from './defaults';
import type {
    EditorAmbiance,
    EditorBlock,
    EditorCell,
    EditorCellThing,
    EditorFaces,
    EditorLevel,
    EditorLight,
    EditorMark,
    EditorStartpoint,
    EditorThing,
    EditorTile,
    EditorTileAnimation,
    TileType,
} from './types';

/**
 * Reads a save into the document model.
 *
 * This replaces the old `SET_STATE_CONTENT` mutation
 * (`_OLD_MAPEDIT_/src/store/modules/level/mutations.js:319`), which was
 * `for (let sKey in content) state[sKey] = content[sKey]` — a shallow key copy
 * with no validation, no defaults for missing keys, and no removal of stale
 * ones, so loading a level that lacked a key silently kept the value from the
 * level before it.
 *
 * Every numeric coercion here matches one the converter performs anyway, so a
 * parsed document converts to exactly what the raw save would have. See
 * `coerce.ts`.
 */

export class LevelParseError extends Error {
    constructor(message: string) {
        super(`level: ${message}`);
        this.name = 'LevelParseError';
    }
}

const TILE_TYPES: readonly TileType[] = ['wall', 'flat', 'sprite'];

function parseLight(raw: unknown): EditorLight {
    if (!isRecord(raw)) {
        return emptyLight();
    }
    return {
        enabled: toBool(raw.enabled),
        value: toFloat(raw.value),
        inner: toFloat(raw.inner),
        outer: toFloat(raw.outer),
    };
}

function parseAnimation(raw: unknown): EditorTileAnimation | null {
    if (!isRecord(raw)) {
        return null;
    }
    return {
        frames: toInt(raw.frames),
        duration: toInt(raw.duration),
        loop: toInt(raw.loop),
    };
}

function parseTile(raw: unknown, fallbackType: TileType): EditorTile {
    if (!isRecord(raw)) {
        throw new LevelParseError('a tile is not an object');
    }
    const type = TILE_TYPES.find((t) => t === raw.type) ?? fallbackType;
    return {
        id: toInt(raw.id),
        type,
        content: toStr(raw.content),
        width: toInt(raw.width),
        height: toInt(raw.height),
        animation: parseAnimation(raw.animation),
    };
}

function parseFaces(raw: unknown): EditorFaces {
    const r = isRecord(raw) ? raw : {};
    return {
        n: toIdOrNull(r.n),
        e: toIdOrNull(r.e),
        w: toIdOrNull(r.w),
        s: toIdOrNull(r.s),
        f: toIdOrNull(r.f),
        c: toIdOrNull(r.c),
    };
}

function parseBlock(raw: unknown): EditorBlock {
    if (!isRecord(raw)) {
        throw new LevelParseError('a block is not an object');
    }
    return {
        id: toInt(raw.id),
        ref: toStr(raw.ref),
        phys: toInt(raw.phys),
        offs: toFloat(raw.offs),
        light: parseLight(raw.light),
        faces: parseFaces(raw.faces),
        preview: toStr(raw.preview),
    };
}

function parseThing(raw: unknown): EditorThing {
    if (!isRecord(raw)) {
        throw new LevelParseError('a thing is not an object');
    }
    return {
        id: toInt(raw.id),
        ref: toStr(raw.ref),
        size: toFloat(raw.size),
        opacity: toInt(raw.opacity),
        ghost: toBool(raw.ghost),
        tangible: toBool(raw.tangible),
        light: parseLight(raw.light),
        tile: toInt(raw.tile),
    };
}

function parseCellThing(raw: unknown): EditorCellThing {
    const r = isRecord(raw) ? raw : {};
    return { id: toInt(r.id), x: toInt(r.x), y: toInt(r.y) };
}

function parseMark(raw: unknown): EditorMark {
    const r = isRecord(raw) ? raw : {};
    // `color` is a number in the default cell but the marker UI writes CSS
    // colour names, so real saves hold both. Kept as-is rather than coerced.
    const color = typeof r.color === 'string' ? r.color : toInt(r.color);
    return { color, shape: toInt(r.shape) };
}

function parseCell(raw: unknown): EditorCell {
    if (!isRecord(raw)) {
        return emptyCell();
    }
    return {
        // Absent in the fixtures for empty cells; 0 means empty either way.
        block: toInt(raw.block),
        upperblock: toInt(raw.upperblock),
        tags: asArray(raw.tags).map((t) => toStr(t)),
        things: asArray(raw.things).map(parseCellThing),
        mark: parseMark(raw.mark),
        modified: toBool(raw.modified),
    };
}

function parseGrid(raw: unknown): EditorCell[][] {
    const rows = asArray(raw);
    if (rows.length === 0) {
        throw new LevelParseError('the grid is empty');
    }
    const grid = rows.map((row) => asArray(row).map(parseCell));
    const width = grid[0].length;
    if (grid.some((row) => row.length !== width)) {
        throw new LevelParseError('the grid is not rectangular');
    }
    if (width !== grid.length) {
        throw new LevelParseError(`the grid is not square (${width}x${grid.length})`);
    }
    return grid;
}

function parseAmbiance(raw: unknown): EditorAmbiance {
    const d = defaultAmbiance();
    if (!isRecord(raw)) {
        return d;
    }
    const fog = isRecord(raw.fog) ? raw.fog : {};
    const filter = isRecord(raw.filter) ? raw.filter : {};
    return {
        sky: toStr(raw.sky, d.sky),
        fog: {
            distance: toFloat(fog.distance, d.fog.distance),
            color: toStr(fog.color, d.fog.color),
        },
        filter: {
            enabled: toBool(filter.enabled, d.filter.enabled),
            color: toStr(filter.color, d.filter.color),
        },
        brightness: toFloat(raw.brightness, d.brightness),
    };
}

function parseStartpoint(raw: unknown): EditorStartpoint {
    const r = isRecord(raw) ? raw : {};
    return {
        x: toInt(r.x, -1),
        y: toInt(r.y, -1),
        angle: toFloat(r.angle),
        // The old mutations forced z to 1 on every write.
        z: toFloat(r.z, 1),
    };
}

/** Reads any saved level into the document model, or throws `LevelParseError`. */
export function parseLevel(input: unknown): EditorLevel {
    if (!isRecord(input)) {
        throw new LevelParseError('not an object');
    }

    const version = input.version;
    if (version !== undefined && version !== 'MAPEDIT-1') {
        // The converter refuses unknown versions rather than guessing; so do we,
        // and for the same reason.
        throw new LevelParseError(`unknown save version "${String(version)}"`);
    }

    const tiles = isRecord(input.tiles) ? input.tiles : {};
    const metrics = isRecord(input.metrics) ? input.metrics : {};
    const flags = isRecord(input.flags) ? input.flags : {};
    const time = isRecord(input.time) ? input.time : {};
    const actor = isRecord(input.actor) ? input.actor : {};

    const startpoints = asArray(input.startpoints).map(parseStartpoint);

    return {
        tiles: {
            walls: asArray(tiles.walls).map((t) => parseTile(t, 'wall')),
            flats: asArray(tiles.flats).map((t) => parseTile(t, 'flat')),
            sprites: asArray(tiles.sprites).map((t) => parseTile(t, 'sprite')),
        },
        blocks: asArray(input.blocks).map(parseBlock),
        things: asArray(input.things).map(parseThing),
        grid: parseGrid(input.grid),
        metrics: {
            tileWidth: toInt(metrics.tileWidth, 64),
            tileHeight: toInt(metrics.tileHeight, 96),
        },
        flags: {
            smooth: toBool(flags.smooth),
            stretch: toBool(flags.stretch),
            export: toBool(flags.export),
        },
        time: { interval: toInt(time.interval, 40) },
        ambiance: parseAmbiance(input.ambiance),
        actor: {
            startpoint: toInt(actor.startpoint),
            thinker: toStr(actor.thinker),
        },
        startpoints: startpoints.length > 0 ? startpoints : [{ x: -1, y: -1, z: 1, angle: 0 }],
        preview: toStr(input.preview),
    };
}
