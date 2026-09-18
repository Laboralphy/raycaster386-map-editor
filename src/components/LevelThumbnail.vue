<script setup lang="ts">
import { computed } from 'vue';
import noPreview from '../assets/no-preview.png';

/**
 * One level in the open dialog.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/LevelThumbnail.vue`. Two fixes over
 * the original: the placeholder is imported so the bundler resolves it (the old
 * one used a bare `'./assets/images/no-preview.png'` string that only worked
 * when the page happened to be served from the right directory), and the date
 * is formatted without the `parseInt(date + '000')` string trick, which broke
 * on any non-integer input.
 */
const props = withDefaults(
    defineProps<{
        name: string;
        /** Epoch seconds, as the vault reports. */
        date?: number;
        preview?: string;
        selected?: boolean;
    }>(),
    { date: 0, preview: '', selected: false }
);

defineEmits<{ click: []; dblclick: [] }>();

const source = computed(() => (props.preview === '' ? noPreview : props.preview));

const dateString = computed(() => {
    if (!props.date) {
        return '';
    }
    const iso = new Date(props.date * 1000).toJSON();
    return iso === null ? '' : `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
});
</script>

<template>
    <figure
        :class="['level-thumbnail', { selected }]"
        @click="$emit('click')"
        @dblclick="$emit('dblclick')"
    >
        <img :src="source" :alt="`Preview of ${name}`" />
        <figcaption>
            <span class="filename">{{ name }}</span>
            <span v-if="dateString">
                - <span class="datestring">{{ dateString }}</span></span
            >
        </figcaption>
    </figure>
</template>

<style scoped>
figure.level-thumbnail {
    display: inline-block;
    border: outset #aaa 0.2em;
    border-radius: 0.3em;
    padding: 0.4em;
    background-color: #aaa;
    margin: 1.5em;
    cursor: pointer;
}

figure.level-thumbnail img {
    border: solid thin #000;
    padding: 0;
}

figure.level-thumbnail:hover {
    filter: brightness(140%);
}

figure.level-thumbnail.selected {
    border-color: lime;
    filter: brightness(120%);
}

figure.level-thumbnail.selected:hover {
    border-color: #8f8;
    filter: brightness(140%);
}

figure.level-thumbnail figcaption span.datestring {
    font-style: italic;
    font-size: 0.8em;
    color: #333;
}
</style>
