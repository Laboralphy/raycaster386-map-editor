import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * What the preview pane reports back to the rest of the app.
 *
 * Trivial on purpose: it exists so this scaffold proves Pinia is wired, not
 * because the editor's state belongs here. The real store is the level itself,
 * and it comes with the save format in the next step.
 */
export const usePreviewStore = defineStore('preview', () => {
    /** Frames drawn since the preview started. */
    const frames = ref(0);
    /** Smoothed frame rate, for the readout. */
    const fps = ref(0);
    /** Null until the textures have been decoded and the map built. */
    const status = ref<string | null>('starting...');

    function countFrame(elapsedMs: number): void {
        frames.value += 1;
        fps.value = fps.value * 0.9 + (1000 / Math.max(elapsedMs, 1)) * 0.1;
    }

    return { frames, fps, status, countFrame };
});
