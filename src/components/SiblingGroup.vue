<script setup lang="ts">
import { provide, readonly, ref } from 'vue';
import { SIBLING_GROUP, type SiblingGroupContext, type SiblingItem } from './siblings';

/**
 * A row of mutually exclusive buttons — the old `Siblings.vue`, rebuilt.
 *
 * Selection is a `v-model` index. The old component emitted
 * `$emit('input', {index})` — an object where a value belonged — and consumers
 * had to reach in through `$refs` to set it, which is why `TileBrowser` and
 * `LevelGrid` both carried a watcher just to push state back down.
 */
const model = defineModel<number>({ default: 0 });

const items = ref<SiblingItem[]>([]);

function select(index: number): void {
    const item = items.value[index];
    if (item === undefined || item.isDisabled()) {
        return;
    }
    model.value = index;
}

/** The first button that can take the selection, or -1 if none can. */
function firstEnabled(): number {
    return items.value.findIndex((item) => !item.isDisabled());
}

/** Moves the selection to the first usable button, if there is one. */
function selectAnother(): void {
    const next = firstEnabled();
    if (next >= 0) {
        model.value = next;
    }
}

const context: SiblingGroupContext = {
    register(item) {
        items.value.push(item);
        return items.value.length - 1;
    },
    unregister(index) {
        items.value.splice(index, 1);
    },
    select,
    selectAnother,
    selected: readonly(model),
};

provide(SIBLING_GROUP, context);
</script>

<template>
    <div class="sibling-group"><slot></slot></div>
</template>

<style scoped>
.sibling-group {
    display: inline;
    margin: 0;
    padding: 0;
}
</style>
