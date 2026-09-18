import {
    SHAPE_CIRCLE,
    SHAPE_HEXAGON,
    SHAPE_NONE,
    SHAPE_RHOMBUS,
    SHAPE_SQUARE,
    SHAPE_TRIANGLE,
} from '../domain/reference';
import type { EditorMark } from '../domain/types';
import { context2d, domCanvasOps, type CanvasOps } from './canvasOps';

/**
 * Everything drawn *over* a cell's block: its tags, its mark, the things placed
 * in it, and the start point if one stands there.
 *
 * Ported from `_OLD_MAPEDIT_/src/libs/silly-canvas-factory/index.js`. The name
 * was the original's own joke; what it does is memoise, which is the point —
 * a 59x59 grid holds 3,481 cells but only a handful of distinct overlays, so
 * the same canvas is reused for every cell that looks the same. Cells with
 * nothing on them get `null` and cost nothing at all.
 */

/** A thing placed on a cell's 3x3 sub-grid. `state` picks its colour. */
export interface OverlayThing {
    x: number;
    y: number;
    /** 0 normal, 1 selected, anything else highlighted. */
    state: number;
}

export interface OverlayExtras {
    startpoint?: { angle: number; selected: boolean };
}

export class CellOverlayFactory {
    private readonly ops: CanvasOps;
    private cache = new Map<string, HTMLCanvasElement>();
    private width: number;
    private height: number;

    constructor(size = 96, ops: CanvasOps = domCanvasOps) {
        this.ops = ops;
        this.width = size;
        this.height = size;
    }

    /** Resizing invalidates every cached overlay — they are size-specific. */
    setSize(width: number, height: number): void {
        if (this.width === width && this.height === height) {
            return;
        }
        this.width = width;
        this.height = height;
        this.cache.clear();
    }

    get cached(): number {
        return this.cache.size;
    }

    private drawTags(canvas: HTMLCanvasElement, tags: readonly string[]): void {
        const ctx = context2d(canvas);
        ctx.fillStyle = 'yellow';
        ctx.strokeStyle = 'black';
        const lineHeight = (this.height / 3) | 0;
        ctx.font = `${lineHeight}px bold Verdana`;
        ctx.textBaseline = 'top';
        tags.forEach((tag, i) => {
            ctx.strokeText(tag, 0, i * lineHeight);
            ctx.fillText(tag, 0, i * lineHeight);
        });
    }

    private drawMark(canvas: HTMLCanvasElement, mark: EditorMark): void {
        if (mark.shape === SHAPE_NONE) {
            return;
        }
        const ctx = context2d(canvas);
        const w = this.width;
        const h = this.height;
        const w2 = w >> 1;
        const h2 = h >> 1;
        const w4 = w >> 2;
        const h4 = h >> 2;
        ctx.strokeStyle = 'black';
        ctx.fillStyle = String(mark.color);

        switch (mark.shape) {
            case SHAPE_CIRCLE:
                ctx.beginPath();
                ctx.arc(w2, h2, w4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                break;

            case SHAPE_HEXAGON:
                ctx.beginPath();
                ctx.moveTo(w2, h4);
                ctx.lineTo(w2 + w4, (h2 + h4) >> 1);
                ctx.lineTo(w2 + w4, h - ((h2 + h4) >> 1));
                ctx.lineTo(w2, h2 + h4);
                ctx.lineTo(w4, h - ((h2 + h4) >> 1));
                ctx.lineTo(w4, (h2 + h4) >> 1);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;

            case SHAPE_SQUARE:
                ctx.fillRect(w4, h4, w2, h2);
                ctx.strokeRect(w4, h4, w2, h2);
                break;

            case SHAPE_TRIANGLE:
                ctx.beginPath();
                ctx.moveTo(w2, h4);
                ctx.lineTo(w2 + w4, h - ((h2 + h4) >> 1));
                ctx.lineTo(w4, h - ((h2 + h4) >> 1));
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;

            case SHAPE_RHOMBUS:
                ctx.beginPath();
                ctx.moveTo(w2, h4);
                ctx.lineTo(w2 + w4, h2);
                ctx.lineTo(w2, h2 + h4);
                ctx.lineTo(w4, h2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;

            default:
                // The original threw here. An unknown shape is bad data, not a
                // reason to take the whole grid down mid-repaint.
                break;
        }
    }

    private drawThings(canvas: HTMLCanvasElement, things: readonly OverlayThing[]): void {
        const ctx = context2d(canvas);
        ctx.strokeStyle = '#000';
        const pad = 2;
        const w3 = Math.floor(this.width / 3);
        const h3 = Math.floor(this.height / 3);
        const boxW = w3 - pad - pad;
        const boxH = h3 - pad - pad;
        for (const { x, y, state } of things) {
            ctx.fillStyle =
                state === 0 ? 'rgba(240, 150, 0, 0.75)' : state === 1 ? 'white' : '#FD0';
            ctx.strokeRect(x * w3 + pad, y * h3 + pad, boxW, boxH);
            ctx.fillRect(x * w3 + pad, y * h3 + pad, boxW, boxH);
        }
    }

    /** The compass rose showing where the player starts and which way they face. */
    private drawStartPoint(canvas: HTMLCanvasElement, angle: number, selected: boolean): void {
        const ctx = context2d(canvas);
        const w = this.width;
        const h = this.height;
        const pad = 2;
        const pad2 = pad << 1;
        const w2 = w >> 1;
        const h2 = h >> 1;
        ctx.save();
        ctx.lineWidth = 2;
        ctx.translate(w2, h2);
        // The angle is stored in half-turns, as the converter reads it.
        ctx.rotate(angle * Math.PI);
        ctx.translate(-w2, -h2);

        ctx.beginPath();
        ctx.strokeStyle = selected ? '#FFF' : '#BBB';
        ctx.arc(w2, h2, w2 - pad - pad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.closePath();

        ctx.beginPath();
        ctx.strokeStyle = selected ? '#06F' : '#333';
        ctx.arc(w2, h2, w2 - pad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.closePath();

        ctx.strokeStyle = selected ? '#F00' : '#555';
        ctx.beginPath();
        ctx.moveTo(pad, h2);
        ctx.lineTo(w - pad, h2);
        ctx.lineTo(w - pad - pad2, h2 - pad2);
        ctx.lineTo(w - pad - pad2, h2 + pad2);
        ctx.lineTo(w - pad, h2);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    /**
     * The overlay for one cell, or `null` when there is nothing to draw.
     *
     * Memoised on everything that affects the result, so the thousands of plain
     * cells in a level share one answer — `null` — and the rest share a handful
     * of canvases.
     */
    get(
        tags: readonly string[],
        mark: EditorMark,
        things: readonly OverlayThing[],
        extras: OverlayExtras = {}
    ): HTMLCanvasElement | null {
        if (
            tags.length === 0 &&
            mark.shape === SHAPE_NONE &&
            things.length === 0 &&
            extras.startpoint === undefined
        ) {
            return null;
        }
        const key = JSON.stringify({ tags, mark, things, extras });
        const hit = this.cache.get(key);
        if (hit) {
            return hit;
        }
        const canvas = this.ops.createCanvas(this.width, this.height);
        this.drawTags(canvas, tags);
        this.drawMark(canvas, mark);
        this.drawThings(canvas, things);
        if (extras.startpoint) {
            this.drawStartPoint(canvas, extras.startpoint.angle, extras.startpoint.selected);
        }
        this.cache.set(key, canvas);
        return canvas;
    }
}
