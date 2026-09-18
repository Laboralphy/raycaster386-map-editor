<script setup lang="ts">
import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../domain/reference';

/**
 * A block's thumbnail, ported from `_OLD_MAPEDIT_/src/components/Block.vue`.
 *
 * The image is the `preview` data URL stored on the block itself — rendered by
 * `libs/blockRenderer` whenever the block is created or changed, and saved with
 * the level, which is why a level opens with its blocks already drawn.
 */
withDefaults(
    defineProps<{
        content: string;
        selected?: boolean;
        width?: number;
        height?: number;
    }>(),
    { selected: false, width: BLOCK_WIDTH, height: BLOCK_HEIGHT }
);

defineEmits<{ click: [] }>();
</script>

<template>
    <div :class="['block', { selected }]">
        <img :width="width" :height="height" :src="content" alt="block" @click="$emit('click')" />
    </div>
</template>

<style scoped>
div.block {
    display: inline-block;
    user-select: none;
}

div.block img {
    cursor: pointer;
    border: solid 0.4em #00c;
    margin: 0.3em;
    user-select: none;
    background-color: #666;
}

div.block.selected img {
    border-color: lime;
}
</style>
