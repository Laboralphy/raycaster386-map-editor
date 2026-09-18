/**
 * The placeholder for a sprite tile that is no longer there.
 *
 * A thing keeps a numeric tile id, and nothing stops that tile being deleted —
 * `deleteTile` refuses when a thing uses it, but a level saved by the old
 * editor may already carry the dangling reference. Drawing a red cross says so
 * plainly.
 *
 * An inline SVG rather than a canvas. The original drew this with
 * `createCanvas` + `getContext('2d')`, which means a browser panel showing a
 * broken thing cannot be rendered anywhere without one — including in a test.
 * The picture is two lines; it does not need a rendering context to exist.
 */
const MISSING_TILE_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">',
    '<rect width="64" height="64" fill="none"/>',
    '<path d="M0 0 L64 64 M64 0 L0 64" stroke="red" stroke-width="4"/>',
    '</svg>',
].join('');

export const MISSING_TILE_IMAGE = `data:image/svg+xml,${encodeURIComponent(MISSING_TILE_SVG)}`;

/** The placeholder, as an image source. */
export function missingTileImage(): string {
    return MISSING_TILE_IMAGE;
}
