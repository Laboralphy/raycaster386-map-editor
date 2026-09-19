import { Vector, type ReadonlyCellMap } from '@laboralphy/raycaster386';
import { moveActor, type Actor, type Thinker } from '@laboralphy/raycaster386/simulation';
import type { PreviewInput } from './previewInput';

/**
 * How the preview camera moves.
 *
 * Split out of `previewWorld.ts` so it can be tested: the simulation tier
 * imports no renderer and touches no DOM, so a thinker, a `CellMap` and
 * `moveActor` run in Node — which is the only part of the preview that can be
 * checked without a canvas, and the part most worth checking, since walking
 * through a wall is the failure that does not show up in a screenshot.
 *
 * The camera is an actor steered by a thinker rather than a position updated by
 * hand, which is what gets it wall sliding for free and makes doors treat it as
 * something that can be closed on.
 *
 * **Speeds are per second, not per tick.** The tick rate is the level's own
 * `time.interval` — it is the clock for doors and animations, which are written
 * in ticks — and the four real levels declare 40ms, or 25 ticks a second. The
 * library's demos use per-tick speeds tuned at 60, so carrying those numbers
 * over made the camera walk at 80 units a second instead of 192. Per-tick
 * speeds would also mean a level that declared a shorter interval walked
 * faster, which is indefensible in an editor: how quickly you get across a map
 * you are inspecting has nothing to do with how quickly its doors slide.
 */

/** Everything the thinker is handed each tick. Satisfies `MotionContext`. */
export interface PreviewContext {
    map: ReadonlyCellMap;
    /** Cell size in world units. */
    spacing: number;
    time: number;
    /** Seconds this tick covers, from the level's `time.interval`. */
    dt: number;
    input: PreviewInput;
}

/**
 * World units per second. 192 is three cells a second at the usual spacing of
 * 64 — the pace the library's demos walk at, which is the only tuned reference
 * available.
 */
export const WALK_SPEED = 192;

/** Radians per second, about 155 degrees — the same reference. */
export const TURN_SPEED = 2.7;

export class PreviewPlayerThinker implements Thinker<PreviewContext> {
    think(actor: Actor<PreviewContext>, context: PreviewContext): void {
        const { input, dt } = context;
        const position = actor.position;

        // Mouse look is an absolute rotation that already happened, so it is
        // added as-is; the keys are a rate, so they are scaled by the tick.
        position.angle += input.look + input.turn * TURN_SPEED * dt;

        if (input.forward === 0 && input.strafe === 0) {
            // Skipped rather than called with a zero vector, which would cost a
            // wall probe every tick for nothing.
            return;
        }
        const cos = Math.cos(position.angle);
        const sin = Math.sin(position.angle);
        const step = WALK_SPEED * dt;
        moveActor(
            actor,
            context,
            new Vector(
                (cos * input.forward - sin * input.strafe) * step,
                (sin * input.forward + cos * input.strafe) * step
            )
        );
    }
}
