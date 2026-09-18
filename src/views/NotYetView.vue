<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import WindowFrame from '../components/WindowFrame.vue';

/**
 * A placeholder for a screen the migration has not reached yet.
 *
 * Every route the old editor had is declared from the start, so the menu can be
 * transcribed whole rather than grown one entry at a time. Landing on one of
 * them should say what is missing and when it arrives, not 404.
 */
const route = useRoute();
const phase = computed(() => (route.meta.phase as string | undefined) ?? 'a later phase');
const title = computed(() => (route.meta.title as string | undefined) ?? 'Not built yet');
</script>

<template>
    <WindowFrame :caption="title">
        <div class="not-yet">
            <p>This screen has not been migrated from the old editor yet.</p>
            <p class="hint">Scheduled for {{ phase }}</p>
        </div>
    </WindowFrame>
</template>

<style scoped>
.not-yet {
    padding: 2em;
    font-family: monospace;
}
</style>
