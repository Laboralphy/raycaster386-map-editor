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
div.popup {
    width: 480px;
    height: 240px;
    box-shadow: 0 0 32px 16px rgba(0, 0, 0, 0.6);
    left: 50%;
    top: 50%;
    margin-left: -240px;
    margin-top: -120px;
    position: absolute;
}

div.popup > :deep(table.o876window) {
    width: 100%;
    height: 100%;
    border-color: black;
}

div.popup div.message {
    margin: 16px;
    font-size: 125%;
}

div.popup.error > :deep(table.o876window) h1 {
    background-color: #a00;
    border-color: #800;
}
</style>
