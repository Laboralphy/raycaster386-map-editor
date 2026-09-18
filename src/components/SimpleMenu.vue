<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import type { MenuEntry } from './menu';
import MyButton from './MyButton.vue';
import SvgIcon from './SvgIcon.vue';

defineProps<{ routes: readonly MenuEntry[] }>();

const router = useRouter();
const route = useRoute();

/**
 * The old component kept the current path in `data` and synced it with an
 * `immediate: true` `$route` watcher. `useRoute()` is already reactive, so the
 * watcher goes away.
 */
function isActive(entry: MenuEntry): boolean {
    return route.fullPath === entry.route || (entry.highlight?.test(route.fullPath) ?? false);
}
</script>

<template>
    <div class="simple-menu">
        <MyButton
            v-for="r in routes"
            :key="r.route"
            :title="r.title"
            :class="isActive(r) ? 'selected' : ''"
            style="margin-right: 0.25em; margin-left: 0.25em"
            @click="router.push(r.route)"
        >
            <SvgIcon :path="r.icon" />
            {{ r.caption }}
        </MyButton>
    </div>
</template>

<style scoped>
.simple-menu {
    display: inline-block;
}

.selected {
    filter: brightness(150%);
    color: #0000ff;
}
</style>
