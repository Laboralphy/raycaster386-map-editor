<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MyButton from './MyButton.vue';
import { SIBLING_GROUP } from './siblings';

/**
 * One button of a `SiblingGroup`.
 *
 * It announces itself to the group on mount and reads its own selected state
 * back out. The old version stored `selected` in its own data and let the
 * parent assign to it, so the two could — and did — disagree.
 */
const props = withDefaults(defineProps<{ title?: string; disabled?: boolean }>(), {
    title: undefined,
    disabled: false,
});

const group = inject(SIBLING_GROUP, null);
const index = ref(-1);

onMounted(() => {
    if (group) {
        index.value = group.register({ isDisabled: () => props.disabled });
    }
});

onBeforeUnmount(() => {
    if (group && index.value >= 0) {
        group.unregister(index.value);
    }
});

const selected = computed(() => group !== null && group.selected.value === index.value);

// Becoming disabled while selected hands the selection back to the group.
watch(
    () => props.disabled,
    (now, before) => {
        if (now && !before && selected.value && group) {
            group.selectAnother();
        }
    }
);
</script>

<template>
    <MyButton
        :class="selected ? 'selected' : ''"
        :title="title"
        :disabled="disabled"
        @click="group?.select(index)"
    >
        <slot></slot>
    </MyButton>
</template>

<style scoped>
.selected {
    filter: brightness(150%);
    color: #0000ff;
}
</style>
