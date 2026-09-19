/**
 * What the keyboard and mouse are asking the preview camera for.
 *
 * Ported from the library's `demos/simple/input.ts`. Kept apart from the world
 * it drives for the usual reason in this codebase: the mapping from held keys
 * to a movement request is pure, so it is tested in Node, while the half that
 * touches `window` is four listeners at the bottom.
 *
 * The old `RenderView` attached its two key listeners to `window` and removed
 * them in `beforeDestroy`, which meant any path out of that screen that did not
 * run the hook left the game engine receiving keystrokes. {@link
 * PreviewInputManager.plugListeners} returns the function that unplugs it, so
 * the caller cannot forget half of the pair.
 */

/** One tick's worth of intent. */
export interface PreviewInput {
    /** -1 back, 0 still, 1 forward. */
    forward: number;
    /** -1 left, 0 still, 1 right. */
    strafe: number;
    /** Turn *rate*, -1 to 1. The thinker scales it by its turn speed. */
    turn: number;
    /**
     * Mouse look, in radians, already turned.
     *
     * Separate from {@link turn} because it is a rotation that has happened,
     * not a rate being asked for: scaling it by a turn speed and a tick would
     * make how far the mouse moved you depend on the level's tick rate.
     */
    look: number;
    /** Set for exactly one tick when the use key is pressed. */
    use: boolean;
}

/** Radians per pixel of mouse movement while the pointer is locked. */
const MOUSE_SENSITIVITY = 0.0025;

export function emptyInput(): PreviewInput {
    return { forward: 0, strafe: 0, turn: 0, look: 0, use: false };
}

/** True while the event's target is a field the user is typing into. */
function isTyping(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) {
        return false;
    }
    const tag = element.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || element.isContentEditable;
}

export class PreviewInputManager {
    /** Currently held keys, lowercased. */
    readonly held = new Set<string>();
    /** Mouse rotation accumulated since the last tick, in radians. */
    mouseTurn = 0;
    usePressed = false;

    /**
     * Drains the accumulated intent into one tick's request.
     *
     * `mouseTurn` and `usePressed` are consumed rather than read: a mouse
     * movement and a key press are events, and replaying them on the next tick
     * would turn one nudge into a spin.
     */
    readInput(): PreviewInput {
        const input = emptyInput();
        const held = this.held;
        // WASD and ZQSD both, as the original did — the author's keyboard is
        // AZERTY and the old editor answered to either.
        if (held.has('w') || held.has('z') || held.has('arrowup')) {
            input.forward += 1;
        }
        if (held.has('s') || held.has('arrowdown')) {
            input.forward -= 1;
        }
        if (held.has('a') || held.has('q')) {
            input.strafe -= 1;
        }
        if (held.has('d')) {
            input.strafe += 1;
        }
        if (held.has('arrowleft')) {
            input.turn -= 1;
        }
        if (held.has('arrowright')) {
            input.turn += 1;
        }
        input.look = this.mouseTurn;
        this.mouseTurn = 0;
        input.use = this.usePressed;
        this.usePressed = false;
        return input;
    }

    /** Forgets everything held. Used when the window loses focus. */
    clear(): void {
        this.held.clear();
        this.mouseTurn = 0;
        this.usePressed = false;
    }

    /**
     * Listens for the keyboard and the pointer.
     *
     * @returns the function that removes every listener it added
     */
    plugListeners(canvas: HTMLCanvasElement): () => void {
        const onKeyDown = (e: KeyboardEvent): void => {
            // The level name field and the menu live on the same page; typing
            // in one must not walk the camera.
            if (isTyping(e.target)) {
                return;
            }
            const key = e.key.toLowerCase();
            this.held.add(key);
            if (key === 'e' || key === ' ') {
                this.usePressed = true;
                e.preventDefault();
            }
            // Or the arrow keys scroll the page out from under the canvas.
            if (key.startsWith('arrow')) {
                e.preventDefault();
            }
        };
        const onKeyUp = (e: KeyboardEvent): void => {
            this.held.delete(e.key.toLowerCase());
        };
        // Alt-tabbing away while walking would otherwise leave the key held
        // and the camera moving for as long as the screen stays open.
        const onBlur = (): void => this.clear();
        const onClick = (): void => {
            if (document.pointerLockElement !== canvas) {
                void canvas.requestPointerLock();
            } else {
                this.usePressed = true;
            }
        };
        const onMouseMove = (e: MouseEvent): void => {
            if (document.pointerLockElement === canvas) {
                this.mouseTurn += e.movementX * MOUSE_SENSITIVITY;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        canvas.addEventListener('click', onClick);
        document.addEventListener('mousemove', onMouseMove);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
            canvas.removeEventListener('click', onClick);
            document.removeEventListener('mousemove', onMouseMove);
            if (document.pointerLockElement === canvas) {
                document.exitPointerLock();
            }
            this.clear();
        };
    }
}
