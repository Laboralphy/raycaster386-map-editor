<script setup lang="ts">
import { ref, watch } from 'vue';
import { useEditorStore } from '../stores/editor';

/**
 * The status bar's text, flashing when it changes.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/FlashyText.vue`. The old one
 * exposed a writable computed that pushed back into Vuex, which nothing used —
 * it only ever displayed. This just reads.
 */
const editor = useEditorStore();
const flashy = ref(true);

watch(
    () => editor.statusBar,
    () => {
        flashy.value = false;
        setTimeout(() => {
            flashy.value = true;
        }, 200);
    }
);
</script>

<template>
    <span :class="flashy ? 'flashy' : 'no-flashy'">{{ editor.statusBar }}</span>
</template>

<style scoped>
@keyframes flashy-animation {
    from {
        color: rgb(255, 255, 255);
    }
    to {
        color: rgb(0, 0, 0);
    }
}

span.flashy {
    font-weight: bolder;
    font-size: 1.05em;
    animation: flashy-animation 0.2s 3 alternate linear;
}

span.no-flashy {
    color: rgba(0, 0, 0, 0);
}
</style>
