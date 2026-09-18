import type { MapEditLevel } from '@laboralphy/raycaster386/mapedit';
import type { EditorLevel } from './types';

/**
 * The document, as a plain object ready to save or convert.
 *
 * Deliberately a deep clone rather than a field-by-field mapper: `EditorLevel`
 * is already a structural subtype of `MapEditLevel` (see the assertion in
 * `types.ts`), so there is nothing to map, and a mapper would only be a second
 * place for the two shapes to drift apart.
 *
 * The clone is not ceremony. It strips the Pinia reactive proxies, which the
 * converter would otherwise read through several hundred thousand times while
 * walking a 59x59 grid, and it drops `undefined` values the way `JSON.stringify`
 * does on the way to disk.
 */
export function toMapEditLevel(level: EditorLevel): MapEditLevel {
    return JSON.parse(JSON.stringify(level)) as MapEditLevel;
}
