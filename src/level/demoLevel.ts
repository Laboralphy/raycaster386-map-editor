import { PHYS_DOOR_UP, PHYS_NONE, PHYS_WALL } from '@laboralphy/raycaster386';
import type { LevelMap } from '@laboralphy/raycaster386';

/**
 * A hand-written level, standing in for one the editor will produce.
 *
 * Deliberately written against the library's own `LevelMap` shape rather than
 * the MapEdit save format: this scaffold proves the *renderer* dependency, and
 * the save format is the next step's design work (see MAPEDIT_ANALYSIS.md §3).
 */

/** Map characters, indexing the legend below. */
const VOID = ' ';
const WALL = '#';
const DOOR = '+';

export const LEVEL: LevelMap = {
    legend: [
        // Legend index 0 is the void: MapHelper takes its phys and offset from
        // an empty material whatever this entry says, so only the faces here
        // have an effect.
        { code: VOID, phys: PHYS_NONE, faces: { f: 0, c: 1 } },
        { code: WALL, phys: PHYS_WALL, faces: { n: 0, e: 0, w: 0, s: 0 } },
        { code: DOOR, phys: PHYS_DOOR_UP, faces: { n: 1, e: 1, w: 1, s: 1, f: 0, c: 1 } },
    ],
    map: [
        '##########',
        '#        #',
        '##+##    #',
        '#   #    #',
        '#   #    #',
        '#   #    #',
        '#   #    #',
        '#   #    #',
        '#   #    #',
        '##########',
    ],
};

/** Cell size in world units, and wall height in texels. Matches the atlases. */
export const METRICS = { spacing: 64, height: 96 };

export const SHADING = {
    shades: 16,
    color: '#000000',
    filter: null,
    brightness: 0.1,
};

/** Where the preview camera sits, in cell coordinates. */
export const START = { x: 5.5, y: 5.5, height: 1 };

/** Internal render resolution. The canvas is scaled up by CSS. */
export const SCREEN = { width: 320, height: 200 };
