<script setup lang="ts">
/**
 * A thing's sprite, ported from `_OLD_MAPEDIT_/src/components/Thing.vue`.
 *
 * `content` is the sprite tile the thing draws with — or the placeholder the
 * browser builds when the thing points at a tile that no longer exists.
 */
withDefaults(defineProps<{ content: string; selected?: boolean }>(), { selected: false });

defineEmits<{ click: [] }>();
</script>

<template>
    <div :class="['thing', { selected }]" @click="$emit('click')">
        <img :src="content" alt="thing" />
    </div>
</template>

<style scoped>
div.thing {
    display: inline-block;
    user-select: none;
    border: solid 0.4em #00c;
    min-width: 64px;
    cursor: pointer;
    margin: 0.3em;
    text-align: center;
}

div.thing:hover {
    border-color: #55f;
    filter: brightness(140%);
}

div.thing.selected {
    border-color: lime;
    filter: brightness(120%);
}

div.thing.selected:hover {
    border-color: #8f8;
    filter: brightness(140%);
}

div.thing img {
    user-select: none;
    max-height: 96px;
}
</style>
