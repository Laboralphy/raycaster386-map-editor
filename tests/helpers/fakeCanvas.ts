import type { CanvasOps } from '../../src/libs/canvasOps.ts';

/**
 * A canvas that records what was drawn on it instead of drawing.
 *
 * happy-dom has no 2d context, so the real thing cannot run in a test at all.
 * Recording the calls is better than a spy anyway: it lets a test assert *where*
 * each piece was drawn, which is the only interesting thing about a tileset
 * splitter or a block thumbnail.
 */

export interface DrawCall {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    /** Destination rectangle. */
    dx: number;
    dy: number;
    dw: number;
    dh: number;
}

export interface FakeCanvas {
    width: number;
    height: number;
    calls: DrawCall[];
    cleared: number;
    /** Every stroke colour used, in order — how a test reads the kind marks. */
    strokes: string[];
    /** Rectangles passed to strokeRect. */
    strokeRects: { x: number; y: number; w: number; h: number }[];
    /** Line segments, enough to tell an arrow from a star. */
    segments: number;
    arcs: number;
    getContext(kind: string): unknown;
}

function fakeCanvas(width: number, height: number): FakeCanvas {
    const canvas: FakeCanvas = {
        width,
        height,
        calls: [],
        cleared: 0,
        strokes: [],
        strokeRects: [],
        segments: 0,
        arcs: 0,
        getContext(kind: string) {
            if (kind !== '2d') {
                return null;
            }
            const ctx = {
                strokeStyle: '',
                lineWidth: 0,
                clearRect: () => {
                    canvas.cleared += 1;
                },
                drawImage: (...args: unknown[]) => {
                    const n = args.map((a) => (typeof a === 'number' ? a : NaN));
                    canvas.calls.push(
                        args.length >= 9
                            ? {
                                  sx: n[1],
                                  sy: n[2],
                                  sw: n[3],
                                  sh: n[4],
                                  dx: n[5],
                                  dy: n[6],
                                  dw: n[7],
                                  dh: n[8],
                              }
                            : {
                                  sx: 0,
                                  sy: 0,
                                  sw: NaN,
                                  sh: NaN,
                                  dx: n[1],
                                  dy: n[2],
                                  dw: NaN,
                                  dh: NaN,
                              }
                    );
                },
                strokeRect: (x: number, y: number, w: number, h: number) => {
                    canvas.strokeRects.push({ x, y, w, h });
                    canvas.strokes.push(ctx.strokeStyle);
                },
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {
                    canvas.segments += 1;
                },
                bezierCurveTo: () => {
                    canvas.segments += 1;
                },
                arc: () => {
                    canvas.arcs += 1;
                },
                stroke: () => {
                    canvas.strokes.push(ctx.strokeStyle);
                },
            };
            return ctx;
        },
    };
    return canvas;
}

export interface FakeOps extends CanvasOps {
    /** Every canvas created, in order. */
    created: FakeCanvas[];
}

/**
 * @param sizes the size to report for each source URL; anything not listed
 * comes back at `fallback`.
 */
export function fakeCanvasOps(
    sizes: Record<string, { width: number; height: number }> = {},
    fallback = { width: 64, height: 96 }
): FakeOps {
    const created: FakeCanvas[] = [];
    return {
        created,
        async loadCanvas(src: string) {
            const size = sizes[src] ?? fallback;
            return fakeCanvas(size.width, size.height) as unknown as HTMLCanvasElement;
        },
        createCanvas(width: number, height: number) {
            const canvas = fakeCanvas(width, height);
            created.push(canvas);
            return canvas as unknown as HTMLCanvasElement;
        },
        /** Encodes what was drawn, so a test can read a tile's provenance. */
        getData(canvas: HTMLCanvasElement) {
            const fake = canvas as unknown as FakeCanvas;
            const parts = fake.calls.map((c) => `${c.sx},${c.sy}->${c.dx},${c.dy}`);
            return `fake:${fake.width}x${fake.height}[${parts.join('|')}]`;
        },
    };
}
