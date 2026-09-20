<script setup lang="ts">
import { mdiArrowDownThick, mdiArrowLeftThick, mdiArrowRightThick, mdiArrowUpThick } from '@mdi/js';
import { computed, ref } from 'vue';
import MyButton from '../components/MyButton.vue';
import SvgIcon from '../components/SvgIcon.vue';
import WindowFrame from '../components/WindowFrame.vue';
import type { ShiftDirection } from '../stores/level';
import { useEditorStore } from '../stores/editor';
import { useHistoryStore } from '../stores/history';
import { useLevelStore } from '../stores/level';

/**
 * Moving the map about, and how much room it takes.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/UtilPanel.vue`. Shifting wraps:
 * what leaves one edge comes back at the other, which is how you re-centre a
 * map you have drawn too far to one side without redrawing it.
 */

const level = useLevelStore();
const editor = useEditorStore();
const history = useHistoryStore();

const useRegion = ref(false);

/**
 * The old gauge measured the level against a 48 MB ceiling, which came from
 * holding every tile image inline as base64. The vault splits the images out
 * now, so the number here is what the document itself costs.
 */
const sizeKb = computed(() => Math.ceil(level.storageUsage / 1024));

function shift(direction: ShiftDirection): void {
    const region = useRegion.value && editor.hasRegion ? editor.region : null;
    // Everything moves, so every cell is in scope — one large history entry
    // rather than an unusable undo.
    const cells: { x: number; y: number }[] = [];
    const size = level.gridSize;
    for (let y = 0; y < size; ++y) {
        for (let x = 0; x < size; ++x) {
            cells.push({ x, y });
        }
    }
    history.transact(`shift ${direction}`, { cells, slices: ['startpoints'] }, () => {
        if (region) {
            level.shiftRegion(region, direction);
        } else {
            level.shiftGrid(direction);
        }
    });
    editor.dirty = true;
    editor.requestRepaint();
    editor.setStatus(region ? `Region shifted ${direction}` : `Map shifted ${direction}`);
}
</script>

<template>
    <WindowFrame caption="Tools &amp; Utilities">
        <div class="utils">
            <h3>Map shifting</h3>
            <p class="hint">
                Moves the map one cell. What leaves one edge reappears at the opposite one.
            </p>
            <label>
                <input v-model="useRegion" type="checkbox" :disabled="!editor.hasRegion" />
                Only shift cells inside the selected region
            </label>

            <div class="shiftpad">
                <span></span>
                <MyButton title="Shift north" @click="shift('n')">
                    <SvgIcon :path="mdiArrowUpThick" />
                </MyButton>
                <span></span>
                <MyButton title="Shift west" @click="shift('w')">
                    <SvgIcon :path="mdiArrowLeftThick" />
                </MyButton>
                <span></span>
                <MyButton title="Shift east" @click="shift('e')">
                    <SvgIcon :path="mdiArrowRightThick" />
                </MyButton>
                <span></span>
                <MyButton title="Shift south" @click="shift('s')">
                    <SvgIcon :path="mdiArrowDownThick" />
                </MyButton>
                <span></span>
            </div>

            <hr />
            <h3>Level size</h3>
            <p>
                The document is <b>{{ sizeKb }} kB</b>, before its images are split out by the
                vault.
            </p>
            <p class="hint">
                {{ level.gridSize }}x{{ level.gridSize }} cells,
                {{ level.doc.blocks.length }} blocks, {{ level.doc.things.length }} things
            </p>
        </div>
    </WindowFrame>
</template>

<style scoped>
.utils {
    padding: 0.5em;
    font-family: monospace;
}

.shiftpad {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 0.2em;
    justify-content: center;
    margin: 0.5em 0;
}
</style>
