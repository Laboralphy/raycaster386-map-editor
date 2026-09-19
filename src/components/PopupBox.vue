<script setup lang="ts">
import WindowFrame from './WindowFrame.vue';

/**
 * The modal box, ported from `_OLD_MAPEDIT_/src/components/Popup.vue`.
 *
 * Renamed from `Popup` for symmetry with `WindowFrame`. It still reaches into
 * the frame's markup from a scoped style — `div.popup > table.o876window` — as
 * the original did; scoped selectors only tag their last element, which is what
 * makes that work.
 */
withDefaults(
    defineProps<{
        title: string;
        type?: 'simple' | 'progress' | 'error';
        progress?: number;
    }>(),
    { type: 'simple', progress: 0 }
);
</script>

<template>
    <div :class="['popup', type]">
        <WindowFrame :caption="title">
            <div class="message">
                <slot></slot>
                <div v-if="type === 'progress'">
                    <progress style="width: 100%" max="1" :value="progress"></progress>
                </div>
            </div>
        </WindowFrame>
    </div>
</template>

<style scoped>
/*
 * Sized in `em` so the box tracks the root font size with the rest of the UI;
 * at the 12px root a desktop used to get, 40x20em is the 480x240px it was.
 *
 * Centred with a translate rather than the original's negative margins, which
 * were half the width and half the height written out again — three places to
 * keep in step, and they were already in pixels while the box is not.
 */
div.popup {
    /* Capped so the box cannot be wider than the screen, as its fixed 480px
       was on anything narrower than that. */
    width: min(40em, 92vw);
    height: 20em;
    box-shadow: 0 0 2.67em 1.33em rgba(0, 0, 0, 0.6);
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    position: absolute;
}

div.popup > :deep(table.o876window) {
    width: 100%;
    height: 100%;
    border-color: black;
}

div.popup div.message {
    margin: 1.33em;
    font-size: 125%;
}

div.popup.error > :deep(table.o876window) h1 {
    background-color: #a00;
    border-color: #800;
}
</style>
