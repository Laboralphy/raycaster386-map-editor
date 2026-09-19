<script setup lang="ts">
import { Canvas } from '@laboralphy/raycaster386';
import type { RceLevel } from '@laboralphy/raycaster386';
import { convertMapEditLevel } from '@laboralphy/raycaster386/mapedit';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import WindowFrame from '../components/WindowFrame.vue';
import { previewBlocker } from '../domain/previewable';
import { appendImages } from '../libs/appendImages';
import { PreviewInputManager } from '../libs/previewInput';
import { PreviewWorld } from '../libs/previewWorld';
import { useEditorStore } from '../stores/editor';
import { useLevelStore } from '../stores/level';

/**
 * The level, as the game sees it.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/RenderView.vue`, which drove the
 * original monolithic `Engine`. The engine is now two tiers and the editor
 * composes them itself — see `src/libs/previewWorld.ts`, which holds the world
 * and knows nothing about Vue. What is left here is the browser: a canvas, a
 * frame loop, the keyboard, and telling the user what went wrong.
 *
 * **This is also the export path.** `convertMapEditLevel` is exactly what
 * publishing a level runs, so a preview that draws correctly is the strongest
 * evidence available that the level exports correctly — which is why phase 6
 * comes after this one rather than before.
 *
 * Converting is not cheap: `mans-intro` is 59x59 with 98 tiles and the appender
 * builds every atlas. So it happens once, when the screen opens, and again only
 * when asked — never on a keystroke.
 */

/** Internal render resolution. CSS scales the canvas up. */
const WIDTH = 400;
const HEIGHT = 250;

const level = useLevelStore();
const editor = useEditorStore();

const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const status = ref('');
const error = ref('');
const running = ref(false);

/** Set when the document cannot be converted at all, with the reason. */
const blocked = computed(() => previewBlocker(level.doc));

let world: PreviewWorld | null = null;
const input = new PreviewInputManager();
let unplug: (() => void) | null = null;
let frame = 0;
/** Left over from the last frame, so the tick rate is independent of it. */
let carry = 0;
let previous = 0;

function stopLoop(): void {
    if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
    }
}

/**
 * Captures the thumbnail, at half the render size as the original did.
 *
 * Guarded because it runs on the way out: the screen can be left before a
 * single frame has been drawn, and `screenshot` on an unrendered canvas would
 * throw where nothing is left to catch it.
 */
function captureThumbnail(): void {
    if (world === null || !world.ready || world.renderer.renderCanvas === null) {
        return;
    }
    try {
        level.setPreview(world.screenshot(WIDTH >> 1, HEIGHT >> 1));
        editor.dirty = true;
    } catch (e) {
        // A missing thumbnail is not worth losing the level over.
        console.error(e);
    }
}

function loop(now: number): void {
    frame = requestAnimationFrame(loop);
    if (world === null || !world.ready) {
        return;
    }
    // A long pause — a tab in the background, a breakpoint — must not be
    // repaid as hundreds of catch-up ticks.
    const elapsed = Math.min(now - previous, 250);
    previous = now;

    carry += elapsed;
    let steps = 0;
    while (carry >= world.tickMs && steps < 8) {
        world.update(input.readInput());
        carry -= world.tickMs;
        ++steps;
    }

    world.render();
    const target = canvas.value;
    const source = world.renderer.renderCanvas;
    if (target && source) {
        const context = target.getContext('2d');
        if (context) {
            context.imageSmoothingEnabled = false;
            context.drawImage(source, 0, 0, target.width, target.height);
        }
    }
}

async function start(): Promise<void> {
    const target = canvas.value;
    if (!target || blocked.value !== null) {
        return;
    }

    stopLoop();
    captureThumbnail();
    world = null;
    running.value = false;
    error.value = '';

    try {
        status.value = 'converting the level...';
        // Yielding first, so the message is painted before the conversion
        // blocks the main thread for a second or two on a large level.
        await new Promise((resolve) => setTimeout(resolve, 0));
        const data = (await convertMapEditLevel(level.serialise(), appendImages)) as unknown;
        // Published to the store rather than kept here: the side panel is a
        // sibling router-view, not a child, so it cannot read this component.
        editor.generatedLevel = data as Record<string, unknown>;

        status.value = 'loading textures...';
        const next = new PreviewWorld();
        next.setScreen(WIDTH, HEIGHT);
        await next.build(
            data as RceLevel,
            (src) => Canvas.loadCanvas(src),
            level.doc.time.interval
        );

        world = next;
        status.value = '';
        running.value = true;
        previous = performance.now();
        carry = 0;
        frame = requestAnimationFrame(loop);
    } catch (e) {
        world = null;
        running.value = false;
        status.value = '';
        error.value = (e as Error).message;
        editor.setStatus(`Could not render the level : ${(e as Error).message}`);
        console.error(e);
    }
}

onMounted(() => {
    const target = canvas.value;
    if (target) {
        unplug = input.plugListeners(target);
    }
    void start();
});

onBeforeUnmount(() => {
    stopLoop();
    captureThumbnail();
    // Both halves of the pair are the manager's, so leaving by any route —
    // a menu click, the back button, a hot reload — unplugs the keyboard.
    unplug?.();
    unplug = null;
    world = null;
    // Several megabytes of atlases and base64; the original dropped it here too.
    editor.generatedLevel = null;
});
</script>

<template>
    <WindowFrame caption="Raycaster rendering">
        <div class="render">
            <p v-if="blocked" class="blocked">{{ blocked }}</p>
            <template v-else>
                <div class="screen">
                    <canvas ref="canvas" :width="WIDTH" :height="HEIGHT"></canvas>
                    <p v-if="status" class="status">{{ status }}</p>
                    <p v-if="error" class="error">Could not render level: {{ error }}</p>
                </div>
                <p v-if="running" class="hint">
                    Click the picture to look around with the mouse, then Escape to release it.
                </p>
            </template>
        </div>
    </WindowFrame>
</template>

<style scoped>
.render {
    padding: 1em;
    font-family: monospace;
}

.screen {
    text-align: center;
}

canvas {
    width: 80%;
    image-rendering: pixelated;
    background-color: black;
    box-shadow: 0 0 1em rgba(0, 0, 0, 0.5);
}

.blocked {
    padding: 2em;
    font-weight: bold;
}

.error {
    color: darkred;
    font-weight: bold;
}

.hint {
    text-align: center;
    color: #555;
}
</style>
