import type { CanvasOps } from '../../src/libs/canvasOps.ts';

/**
 * A canvas that records what was drawn on it instead of drawing.
 *
 * happy-dom has no 2d context, so the real thing cannot run in a test at all.
 * Recording the calls is better than a spy anyway: it lets a test assert *which
 * part of the sheet* each tile came from, which is the only interesting thing
 * about a tileset splitter.
 */

export interface DrawCall {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dx: number;
    dy: number;
}

export interface FakeCanvas {
    width: number;
    height: number;
    calls: DrawCall[];
    cleared: number;
    getContext(kind: string): unknown;
}

function fakeCanvas(width: number, height: number): FakeCanvas {
    const canvas: FakeCanvas = {
        width,
        height,
        calls: [],
        cleared: 0,
        getContext(kind: string) {
            if (kind !== '2d') {
                return null;
            }
            return {
                clearRect: () => {
                    canvas.cleared += 1;
                },
                drawImage: (...args: unknown[]) => {
                    const n = args.map((a) => (typeof a === 'number' ? a : NaN));
                    // Both the 5-argument and 9-argument forms are used.
                    canvas.calls.push(
                        args.length >= 9
                            ? { sx: n[1], sy: n[2], sw: n[3], sh: n[4], dx: n[5], dy: n[6] }
                            : { sx: 0, sy: 0, sw: NaN, sh: NaN, dx: n[1], dy: n[2] }
                    );
                },
            };
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
