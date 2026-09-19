import type { EditorLevel } from './types';

/**
 * Whether a level can be rendered at all, and why not when it cannot.
 *
 * `convertMapEditLevel` refuses a level with no wall tile, and one with no flat
 * tile, before it looks at anything else — so a level started from scratch
 * cannot be previewed until at least one of each has been imported. Asking
 * first turns what would be a thrown `convertMapEditLevel: no wall tile is
 * defined` into a sentence saying what to do about it.
 *
 * The two conditions are checked independently, in the converter's own order,
 * because a level can easily have walls and no flats.
 *
 * @returns the reason it cannot be previewed, or null if it can
 */
export function previewBlocker(level: EditorLevel): string | null {
    if (level.tiles.walls.length === 0) {
        return 'This level has no wall tile yet. Import one from the Tiles screen before rendering it.';
    }
    if (level.tiles.flats.length === 0) {
        return 'This level has no flat tile yet. Import a floor or ceiling tile before rendering it.';
    }
    return null;
}
