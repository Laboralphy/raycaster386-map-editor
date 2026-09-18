<script setup lang="ts">
import {
    mdiArrowBottomLeft,
    mdiArrowBottomRight,
    mdiArrowDown,
    mdiArrowLeft,
    mdiArrowRight,
    mdiArrowTopLeft,
    mdiArrowTopRight,
    mdiArrowUp,
} from '@mdi/js';
import MyButton from './MyButton.vue';
import SvgIcon from './SvgIcon.vue';

/**
 * Eight arrows in a ring, for choosing a facing.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/DirectionalPad.vue`. It emits an
 * angle directly rather than a direction name the caller has to translate — the
 * old version emitted `'top-left'` and every consumer carried the same
 * eight-case switch to turn that back into a number.
 *
 * Angles are in half-turns, as the save format stores them and the converter
 * reads them: 0 faces east, 0.5 south, 1 west, 1.5 north.
 */
defineEmits<{ select: [number] }>();

const DIRECTIONS = [
    { angle: 1.25, icon: mdiArrowTopLeft, title: 'North-west' },
    { angle: 1.5, icon: mdiArrowUp, title: 'North' },
    { angle: 1.75, icon: mdiArrowTopRight, title: 'North-east' },
    { angle: 1, icon: mdiArrowLeft, title: 'West' },
    { angle: -1, icon: null, title: '' },
    { angle: 0, icon: mdiArrowRight, title: 'East' },
    { angle: 0.75, icon: mdiArrowBottomLeft, title: 'South-west' },
    { angle: 0.5, icon: mdiArrowDown, title: 'South' },
    { angle: 0.25, icon: mdiArrowBottomRight, title: 'South-east' },
];
</script>

<template>
    <div class="dpad">
        <template v-for="d in DIRECTIONS" :key="d.angle">
            <span v-if="d.icon === null" class="hole"></span>
            <MyButton v-else :title="d.title" @click="$emit('select', d.angle)">
                <SvgIcon :path="d.icon" />
            </MyButton>
        </template>
    </div>
</template>

<style scoped>
.dpad {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 0.2em;
    justify-content: start;
}

.hole {
    display: inline-block;
}
</style>
