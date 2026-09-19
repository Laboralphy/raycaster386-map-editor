import { describe, expect, it } from 'vitest';
import { PreviewInputManager, emptyInput } from '../../src/libs/previewInput.ts';

/**
 * The half of the preview's input that is pure.
 *
 * `plugListeners` is not exercised here — it needs a window — but everything it
 * feeds is, which is where the mistakes actually live: a key mapped to the
 * wrong axis, or an event replayed on the tick after it happened.
 */

function manager(...held: string[]): PreviewInputManager {
    const im = new PreviewInputManager();
    for (const key of held) {
        im.held.add(key);
    }
    return im;
}

describe('reading a tick of input', () => {
    it('asks for nothing when nothing is held', () => {
        expect(manager().readInput()).toEqual(emptyInput());
    });

    it('maps WASD to forward and strafe', () => {
        expect(manager('w').readInput().forward).toBe(1);
        expect(manager('s').readInput().forward).toBe(-1);
        expect(manager('a').readInput().strafe).toBe(-1);
        expect(manager('d').readInput().strafe).toBe(1);
    });

    /** The author's keyboard is AZERTY, and the old editor answered to both. */
    it('maps ZQSD the same way', () => {
        expect(manager('z').readInput().forward).toBe(1);
        expect(manager('q').readInput().strafe).toBe(-1);
    });

    it('turns with the arrow keys, and walks with up and down', () => {
        expect(manager('arrowleft').readInput().turn).toBe(-1);
        expect(manager('arrowright').readInput().turn).toBe(1);
        expect(manager('arrowup').readInput().forward).toBe(1);
        expect(manager('arrowdown').readInput().forward).toBe(-1);
    });

    it('cancels opposite keys held together rather than favouring one', () => {
        const input = manager('w', 's', 'a', 'd', 'arrowleft', 'arrowright').readInput();
        expect(input).toEqual(emptyInput());
    });

    /**
     * A press is an event, not a state. Reporting it on the following tick too
     * would open a door twice, and turn one mouse nudge into a spin.
     */
    it('reports a use press once and then forgets it', () => {
        const im = manager();
        im.usePressed = true;
        expect(im.readInput().use).toBe(true);
        expect(im.readInput().use).toBe(false);
    });

    /**
     * Mouse rotation is reported in radians, on its own field: it is a turn
     * that already happened, not a rate being asked for, so the thinker must
     * not scale it by a turn speed or a tick length.
     */
    it('reports mouse rotation as radians, and drains it', () => {
        const im = manager();
        im.mouseTurn = 0.09;
        expect(im.readInput().look).toBeCloseTo(0.09, 6);
        expect(im.readInput().look).toBe(0);
    });

    it('keeps mouse look and the keyboard turn rate apart', () => {
        const im = manager('arrowright');
        im.mouseTurn = 0.09;
        const input = im.readInput();
        expect(input.turn).toBe(1);
        expect(input.look).toBeCloseTo(0.09, 6);
    });

    /** Alt-tabbing away must not leave the camera walking forever. */
    it('forgets everything when cleared', () => {
        const im = manager('w', 'arrowright');
        im.mouseTurn = 1;
        im.usePressed = true;
        im.clear();
        expect(im.readInput()).toEqual(emptyInput());
    });
});
