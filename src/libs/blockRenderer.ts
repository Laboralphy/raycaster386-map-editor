import {
    PHYS_CURT_DOWN,
    PHYS_CURT_UP,
    PHYS_DOOR_DOUBLE,
    PHYS_DOOR_DOWN,
    PHYS_DOOR_LEFT,
    PHYS_DOOR_RIGHT,
    PHYS_DOOR_UP,
    PHYS_INVISIBLE_BLOCK,
    PHYS_NONE,
    PHYS_OFFSET_BLOCK,
    PHYS_SECRET_BLOCK,
    PHYS_TRANSPARENT_BLOCK,
    PHYS_WALL,
} from '@laboralphy/raycaster386';
import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../domain/reference';
import { context2d, domCanvasOps, type CanvasOps } from './canvasOps';

/**
 * The block thumbnail: a flat, top-down sketch of a block's six faces.
 *
 * Ported from `_OLD_MAPEDIT_/src/libs/block-renderer/index.js`. This is what
 * the block browser shows and what the grid paints, so it has to say at a
 * glance what a block *is*: which textures it wears, how it behaves, and
 * whether it glows. It does that in three passes — the textures, a coloured
 * outline per physical kind, and a star for a light source.
 *
 * The layout adapts to how many distinct wall textures there are: a block with
 * one texture all round is drawn as a single square, one with matching
 * opposites as two halves, and anything else as four quarters. That is the
 * `similarity` below, and it is why most blocks read as one clean tile.
 *
 * A block's `phys` is an index into `PHYS_TABLE`, which happens to equal the
 * engine's `PHYS_*` value — `tests/domain/reference.test.ts` pins that, since
 * this file and the converter both rely on it.
 */

/** Faces as the renderer wants them: image data URLs, or empty for none. */
export interface FaceContents {
    n: string;
    e: string;
    w: string;
    s: string;
    f: string;
    c: string;
}

const SIMILARITY_NONE = 0;
const SIMILARITY_OPPOSITE = 1;
const SIMILARITY_ALL = 2;

function similarityOf({ n, e, w, s }: FaceContents): number {
    const acrossX = w === e;
    const acrossY = n === s;
    if (acrossX && acrossY && n === w) {
        return SIMILARITY_ALL;
    }
    if (acrossX && acrossY) {
        return SIMILARITY_OPPOSITE;
    }
    return SIMILARITY_NONE;
}

/**
 * Draws one face into a sub-rectangle of the thumbnail.
 *
 * Offsets and stretches are fractions of the thumbnail, not pixels, so the
 * whole layout scales with `BLOCK_WIDTH`.
 */
async function drawFace(
    canvas: HTMLCanvasElement,
    content: string,
    xStretch: number,
    yStretch: number,
    xOffset: number,
    yOffset: number,
    ops: CanvasOps
): Promise<void> {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = context2d(canvas);
    const width = (w * xStretch) | 0;
    const height = (h * yStretch) | 0;
    const x = (w * xOffset) | 0;
    const y = (h * yOffset) | 0;
    if (content !== '') {
        try {
            const source = await ops.loadCanvas(content);
            ctx.drawImage(source, 0, 0, source.width, source.height, x, y, width, height);
        } catch {
            // A face whose image will not decode is drawn as its outline alone.
            // The original swallowed this too — a block builder that threw on a
            // bad tile would be worse than one that shows a gap.
        }
    }
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(x, y, width, height);
}

const drawFloor = (c: HTMLCanvasElement, stretch: number, content: string, ops: CanvasOps) =>
    drawFace(c, content, 1, stretch, 0, 1 - stretch, ops);

const drawCeiling = (c: HTMLCanvasElement, stretch: number, content: string, ops: CanvasOps) =>
    drawFace(c, content, 1, stretch, 0, 0, ops);

/** The arrow showing which way a door opens. */
function drawDoorArrow(ctx: CanvasRenderingContext2D, phys: number, w: number, h: number): void {
    const left = 1;
    const centreX = w >> 1;
    const right = w - left;
    const top = h >> 2;
    const centreY = h >> 1;
    const bottom = h - top;

    ctx.strokeStyle = 'rgb(0, 255, 96)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.beginPath();

    switch (phys) {
        case PHYS_CURT_UP:
        case PHYS_DOOR_UP:
            ctx.moveTo(centreX, top);
            ctx.lineTo(right, bottom);
            ctx.lineTo(left, bottom);
            ctx.lineTo(centreX, top);
            break;
        case PHYS_CURT_DOWN:
        case PHYS_DOOR_DOWN:
            ctx.moveTo(centreX, bottom);
            ctx.lineTo(left, top);
            ctx.lineTo(right, top);
            ctx.lineTo(centreX, bottom);
            break;
        case PHYS_DOOR_LEFT:
            ctx.moveTo(left, centreY);
            ctx.lineTo(right, top);
            ctx.lineTo(right, bottom);
            ctx.lineTo(left, centreY);
            break;
        case PHYS_DOOR_RIGHT:
            ctx.moveTo(right, centreY);
            ctx.lineTo(left, top);
            ctx.lineTo(left, bottom);
            ctx.lineTo(right, centreY);
            break;
        case PHYS_DOOR_DOUBLE:
            ctx.moveTo(centreX, bottom);
            ctx.lineTo(right, centreY);
            ctx.lineTo(centreX, top);
            ctx.lineTo(centreX, bottom);
            ctx.lineTo(left, centreY);
            ctx.lineTo(centreX, top);
            break;
    }
    ctx.stroke();
}

/**
 * The walls of a block squeezed between a floor and a ceiling.
 *
 * The fractions are transcribed rather than derived. They do not quite follow a
 * formula — without a ceiling the two wall bands are 0.37 and 0.38, so that
 * together with the 0.25 floor they fill the tile exactly. Generalising them
 * costs a row of pixels.
 */
async function drawWallsWithCeiling(
    canvas: HTMLCanvasElement,
    faces: FaceContents,
    similarity: number,
    ops: CanvasOps
): Promise<void> {
    if (similarity === SIMILARITY_ALL) {
        await drawFace(canvas, faces.w, 1, 0.5, 0, 0.25, ops);
    } else if (similarity === SIMILARITY_OPPOSITE) {
        await drawFace(canvas, faces.w, 0.5, 0.5, 0, 0.25, ops);
        await drawFace(canvas, faces.n, 0.5, 0.5, 0.5, 0.25, ops);
    } else {
        await drawFace(canvas, faces.w, 0.5, 0.25, 0, 0.25, ops);
        await drawFace(canvas, faces.n, 0.5, 0.25, 0.5, 0.25, ops);
        await drawFace(canvas, faces.s, 0.5, 0.25, 0, 0.5, ops);
        await drawFace(canvas, faces.e, 0.5, 0.25, 0.5, 0.5, ops);
    }
}

async function drawWallsWithoutCeiling(
    canvas: HTMLCanvasElement,
    faces: FaceContents,
    similarity: number,
    ops: CanvasOps
): Promise<void> {
    if (similarity === SIMILARITY_ALL) {
        await drawFace(canvas, faces.w, 1, 0.75, 0, 0, ops);
    } else if (similarity === SIMILARITY_OPPOSITE) {
        await drawFace(canvas, faces.w, 0.5, 0.75, 0, 0, ops);
        await drawFace(canvas, faces.n, 0.5, 0.75, 0.5, 0, ops);
    } else {
        await drawFace(canvas, faces.w, 0.5, 0.37, 0, 0, ops);
        await drawFace(canvas, faces.n, 0.5, 0.37, 0.5, 0, ops);
        await drawFace(canvas, faces.s, 0.5, 0.38, 0, 0.37, ops);
        await drawFace(canvas, faces.e, 0.5, 0.38, 0.5, 0.37, ops);
    }
}

/** The coloured outline that says what kind of block this is. */
function drawKindMarks(ctx: CanvasRenderingContext2D, phys: number, w: number, h: number): void {
    switch (phys) {
        case PHYS_NONE:
            break;

        case PHYS_WALL:
        case PHYS_INVISIBLE_BLOCK:
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgb(255, 64, 64)';
            ctx.strokeRect(1, 1, w - 2, h - 2);
            ctx.strokeRect(5, 5, w - 10, h - 10);
            break;

        case PHYS_TRANSPARENT_BLOCK:
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgb(255, 0, 255)';
            ctx.strokeRect(1, 1, w - 2, h - 2);
            ctx.beginPath();
            ctx.moveTo(1, 1);
            ctx.lineTo(w - 2, h - 2);
            ctx.stroke();
            break;

        case PHYS_DOOR_UP:
        case PHYS_DOOR_DOWN:
        case PHYS_DOOR_LEFT:
        case PHYS_DOOR_RIGHT:
        case PHYS_DOOR_DOUBLE:
        case PHYS_CURT_DOWN:
        case PHYS_CURT_UP:
            drawDoorArrow(ctx, phys, w, h);
            break;

        case PHYS_SECRET_BLOCK: {
            // A keyhole: the loop of the key, its shaft, and the bit.
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgb(255, 255, 0)';
            ctx.strokeRect(1, 1, w - 2, h - 2);
            ctx.beginPath();
            ctx.moveTo(w >> 2, h >> 2);
            ctx.bezierCurveTo(w >> 2, 1, w - 1, 1, w >> 1, h >> 1);
            ctx.lineTo(w >> 1, (h >> 1) + (h >> 2));
            const radius = (w / 24) | 0;
            ctx.moveTo((w >> 1) + radius, h - (h >> 3));
            ctx.arc(w >> 1, h - (h >> 3), radius, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }

        case PHYS_OFFSET_BLOCK:
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgb(255, 128, 0)';
            ctx.strokeRect(1, 1, w - 2, h - 2);
            ctx.beginPath();
            ctx.moveTo(1, 1);
            ctx.lineTo(w - 2, h - 2);
            ctx.stroke();
            break;
    }
}

/** Eight rays, for a block that emits light. */
function drawLightStar(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgb(255, 255, 255)';
    const cx = w >> 1;
    const cy = h >> 1;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.moveTo((w >> 4) * Math.cos(a) + cx, (w >> 4) * Math.sin(a) + cy);
        ctx.lineTo((w >> 1) * Math.cos(a) + cx, (w >> 1) * Math.sin(a) + cy);
    }
    ctx.stroke();
}

/** Draws a block into a canvas the caller owns. */
export async function renderBlockInto(
    canvas: HTMLCanvasElement,
    phys: number,
    faces: FaceContents,
    light: boolean,
    ops: CanvasOps = domCanvasOps
): Promise<HTMLCanvasElement> {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = context2d(canvas);
    ctx.clearRect(0, 0, w, h);

    const similarity = similarityOf(faces);

    switch (phys) {
        case PHYS_NONE:
        case PHYS_INVISIBLE_BLOCK:
            // Open floor: half ceiling over half floor, or all floor when there
            // is no ceiling to show.
            if (faces.c !== '') {
                await drawCeiling(canvas, 0.5, faces.c, ops);
                await drawFloor(canvas, 0.5, faces.f, ops);
            } else {
                await drawFloor(canvas, 1, faces.f, ops);
            }
            break;

        case PHYS_WALL:
            if (similarity === SIMILARITY_ALL) {
                await drawFace(canvas, faces.w, 1, 1, 0, 0, ops);
            } else if (similarity === SIMILARITY_OPPOSITE) {
                await drawFace(canvas, faces.w, 0.5, 1, 0, 0, ops);
                await drawFace(canvas, faces.n, 0.5, 1, 0.5, 0, ops);
            } else {
                await drawFace(canvas, faces.w, 0.5, 0.5, 0, 0, ops);
                await drawFace(canvas, faces.n, 0.5, 0.5, 0.5, 0, ops);
                await drawFace(canvas, faces.s, 0.5, 0.5, 0, 0.5, ops);
                await drawFace(canvas, faces.e, 0.5, 0.5, 0.5, 0.5, ops);
            }
            break;

        default:
            // Doors, curtains, secret, transparent and offset blocks: walls
            // squeezed between a floor and, if there is one, a ceiling.
            if (faces.c !== '') {
                await drawCeiling(canvas, 0.25, faces.c, ops);
                await drawFloor(canvas, 0.25, faces.f, ops);
                await drawWallsWithCeiling(canvas, faces, similarity, ops);
            } else {
                await drawFloor(canvas, 0.25, faces.f, ops);
                await drawWallsWithoutCeiling(canvas, faces, similarity, ops);
            }
            break;
    }

    drawKindMarks(ctx, phys, w, h);
    if (light) {
        drawLightStar(ctx, w, h);
    }
    return canvas;
}

/** Renders a block thumbnail and returns it as a data URL, ready to store. */
export async function renderBlockPreview(
    phys: number,
    faces: FaceContents,
    light: boolean,
    ops: CanvasOps = domCanvasOps
): Promise<string> {
    const canvas = ops.createCanvas(BLOCK_WIDTH, BLOCK_HEIGHT);
    await renderBlockInto(canvas, phys, faces, light, ops);
    return ops.getData(canvas);
}
