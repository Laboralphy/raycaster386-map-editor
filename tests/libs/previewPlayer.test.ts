import { CellMap, PHYS_NONE, PHYS_WALL } from '@laboralphy/raycaster386';
import { Actor } from '@laboralphy/raycaster386/simulation';
import { describe, expect, it } from 'vitest';
import { emptyInput, type PreviewInput } from '../../src/libs/previewInput.ts';
import {
    PreviewPlayerThinker,
    TURN_SPEED,
    WALK_SPEED,
    type PreviewContext,
} from '../../src/libs/previewPlayer.ts';

/**
 * How the preview camera moves.
 *
 * The one part of the preview that can be checked without a canvas, and the
 * part most worth checking: walking through a wall is the failure that does not
 * show up in a screenshot. The simulation tier imports no renderer and touches
 * no DOM, so a real `CellMap` and the real `moveActor` run here in Node.
 */

const SPACING = 64;
const SIZE = 5;
/** The interval all four real levels declare: 40ms, so 25 ticks a second. */
const DT = 40 / 1000;

/** A square room: solid border, open middle. */
function room(size = SIZE): CellMap {
    const map = new CellMap();
    map.setSize(size);
    for (let x = 0; x < size; ++x) {
        for (let y = 0; y < size; ++y) {
            const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
            map.setPhys(x, y, edge ? PHYS_WALL : PHYS_NONE);
        }
    }
    return map;
}

/** A camera in the middle of the room, facing east (angle 0). */
function camera(): Actor<PreviewContext> {
    const actor = new Actor<PreviewContext>(1);
    actor.position.x = 2 * SPACING + SPACING / 2;
    actor.position.y = 2 * SPACING + SPACING / 2;
    actor.position.angle = 0;
    actor.size = 12;
    return actor;
}

function context(map: CellMap, input: Partial<PreviewInput> = {}, dt = DT): PreviewContext {
    return { map, spacing: SPACING, time: 0, dt, input: { ...emptyInput(), ...input } };
}

const thinker = new PreviewPlayerThinker();

describe('the preview camera', () => {
    it('stands still when nothing is asked of it', () => {
        const actor = camera();
        const before = { ...actor.position };
        thinker.think(actor, context(room()));
        expect(actor.position.x).toBe(before.x);
        expect(actor.position.y).toBe(before.y);
        expect(actor.position.angle).toBe(before.angle);
    });

    it('turns at its turn speed, without moving', () => {
        const actor = camera();
        thinker.think(actor, context(room(), { turn: 1 }));
        expect(actor.position.angle).toBeCloseTo(TURN_SPEED * DT, 6);
        expect(actor.position.x).toBe(2 * SPACING + SPACING / 2);
    });

    /**
     * Mouse look is a rotation that already happened, so it is applied as-is
     * rather than scaled by the turn speed and the tick.
     */
    it('applies mouse look directly', () => {
        const actor = camera();
        thinker.think(actor, context(room(), { look: 0.25 }));
        expect(actor.position.angle).toBeCloseTo(0.25, 6);
    });

    it('walks forward along its facing', () => {
        const actor = camera();
        thinker.think(actor, context(room(), { forward: 1 }));
        // Facing east, so forward is +x and y is untouched.
        expect(actor.position.x).toBeCloseTo(2 * SPACING + SPACING / 2 + WALK_SPEED * DT, 6);
        expect(actor.position.y).toBeCloseTo(2 * SPACING + SPACING / 2, 6);
    });

    it('strafes at a right angle to its facing', () => {
        const actor = camera();
        thinker.think(actor, context(room(), { strafe: 1 }));
        expect(actor.position.x).toBeCloseTo(2 * SPACING + SPACING / 2, 6);
        expect(actor.position.y).toBeCloseTo(2 * SPACING + SPACING / 2 + WALK_SPEED * DT, 6);
    });

    /**
     * The defect this replaced: speeds were per tick, and the tick rate is the
     * level's own `time.interval` — so a level declaring a shorter interval
     * walked faster, and every real level, at 40ms, walked at a third of the
     * pace the per-tick numbers were tuned for.
     *
     * A second of walking has to cover the same ground whatever the level says
     * its tick is, so these two runs must agree.
     */
    it('covers the same ground per second whatever the tick rate', () => {
        // A hall long enough that a second of walking does not reach a wall,
        // which would clamp both runs to the same wrong answer.
        const walk = (dt: number, ticks: number): number => {
            const map = room(20);
            const actor = camera();
            const startX = actor.position.x;
            for (let i = 0; i < ticks; ++i) {
                thinker.think(actor, context(map, { forward: 1 }, dt));
            }
            return actor.position.x - startX;
        };
        // One second at 25Hz, and one second at 60Hz.
        const slow = walk(1 / 25, 25);
        const fast = walk(1 / 60, 60);
        expect(slow).toBeCloseTo(fast, 4);
        expect(slow).toBeCloseTo(WALK_SPEED, 4);
    });

    /**
     * The guarantee that matters. Walking at a wall for far longer than it
     * takes to reach it must leave the camera inside the room.
     */
    it('cannot walk through a wall', () => {
        const map = room();
        const actor = camera();
        for (let i = 0; i < 200; ++i) {
            thinker.think(actor, context(map, { forward: 1 }));
        }
        // The east wall starts at x = 4 * 64; the camera's own size keeps it clear.
        expect(actor.position.x).toBeLessThanOrEqual(4 * SPACING - actor.size);
        expect(actor.position.x).toBeGreaterThan(3 * SPACING);
    });

    /**
     * Sliding, not stopping: pressed into a wall at an angle, the component
     * along the wall still moves. Without it, corridors feel like glue.
     */
    it('slides along a wall it is pressed against', () => {
        const map = room();
        const actor = camera();
        // Face north-east, into the top wall.
        actor.position.angle = -Math.PI / 4;
        const startY = actor.position.y;
        for (let i = 0; i < 40; ++i) {
            thinker.think(actor, context(map, { forward: 1 }));
        }
        expect(actor.position.y).toBeLessThan(startY);
        expect(actor.position.y).toBeGreaterThanOrEqual(SPACING);
        // Stopped by the wall to the north, but still travelled east along it.
        expect(actor.position.x).toBeGreaterThan(3 * SPACING);
    });
});
