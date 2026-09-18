<script setup lang="ts">
import { mdiFilmstrip } from '@mdi/js';
import { computed, ref } from 'vue';
import SvgIcon from './SvgIcon.vue';

/**
 * One tile: a swatch that can be selected, dragged, and dropped onto.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/Tile.vue`, with selection made a
 * prop rather than internal state. The old tile owned its own `selected` flag
 * *and* every browser kept a parallel map of selections, so the two could
 * disagree — clearing the browser's map left the tiles still drawn as selected,
 * which only went unnoticed because switching tabs destroyed them.
 *
 * Named `TileCell` because `Tile` alone reads like a domain type next to
 * `EditorTile`.
 */
const props = withDefaults(
    defineProps<{
        /** The tile id. Carried in the drag payload. */
        tile: number;
        content: string;
        width: number;
        height: number;
        /** Marks the tile as the first frame of an animation. */
        anim?: boolean;
        selected?: boolean;
        selectable?: boolean;
        draggable?: boolean;
        dropzone?: boolean;
    }>(),
    { anim: false, selected: false, selectable: true, draggable: true, dropzone: false }
);

const emit = defineEmits<{
    /** The tile was clicked; carries what its selection should become. */
    select: [boolean];
    /** Another tile was dropped on this one; carries the incoming tile id. */
    drop: [number];
}>();

const dragover = ref(false);

const style = computed(
    () =>
        `width: ${props.width}px; height: ${props.height}px; background-image: url(${props.content})`
);

function onClick(): void {
    if (props.selectable) {
        emit('select', !props.selected);
    }
}

function onDragStart(event: DragEvent): void {
    if (props.draggable && event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text', String(props.tile));
    }
}

function onDragOver(event: DragEvent): void {
    if (props.dropzone) {
        // Without preventDefault the browser refuses the drop entirely.
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }
}

function onDrop(event: DragEvent): void {
    if (!props.dropzone) {
        return;
    }
    event.preventDefault();
    dragover.value = false;
    const incoming = Number.parseInt(event.dataTransfer?.getData('text') ?? '', 10);
    if (!Number.isNaN(incoming)) {
        emit('drop', incoming);
    }
}
</script>

<template>
    <div
        :style="style"
        :class="['tile', { selected, dragover }]"
        :draggable="draggable"
        @click="onClick"
        @dragstart="onDragStart"
        @dragenter="dragover = dropzone"
        @dragleave="dragover = false"
        @dragover="onDragOver"
        @drop="onDrop"
    >
        <div v-if="anim" class="indicator">
            <SvgIcon :path="mdiFilmstrip" title="This tile is part of an animation" />
        </div>
    </div>
</template>

<style scoped>
div.indicator {
    font-size: 2em;
    color: white;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: 15%;
    width: 1em;
    position: absolute;
}

div.tile {
    border: solid 0.4em #00c;
    margin: 0.3em;
    cursor: pointer;
    user-select: none;
    display: inline-block;
    background-repeat: no-repeat;
    background-position: center;
    filter: brightness(100%);
}

div.tile:hover {
    border-color: #55f;
    filter: brightness(140%);
}

div.tile.selected {
    border-color: lime;
    filter: brightness(120%);
}

div.tile.selected:hover {
    border-color: #8f8;
    filter: brightness(140%);
}

@keyframes dragover-pulse {
    from {
        border-color: lime;
    }
    to {
        border-color: black;
    }
}

div.tile.dragover {
    animation: dragover-pulse 777ms alternate infinite ease-in-out;
}
</style>
