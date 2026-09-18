<script setup lang="ts">
import { mdiDelete, mdiPencil, mdiPlus } from '@mdi/js';
import { computed, ref } from 'vue';
import MyButton from '../components/MyButton.vue';
import SvgIcon from '../components/SvgIcon.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { useEditorStore } from '../stores/editor';
import { useHistoryStore } from '../stores/history';
import { useLevelStore } from '../stores/level';

/**
 * Tags on the selected cells.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/TagManager.vue`. A tag is a command
 * string the game reads — `goto mans-cabin 1`, `event mi_lightning_0` — and it
 * is attached to cells, so everything here acts on the grid's selection.
 *
 * The old version kept its own list of "highlighted tags" in the editor store
 * and edited that alongside the cells, which could drift from what the cells
 * actually held. The list is derived from the selection here, so it cannot.
 */

const level = useLevelStore();
const editor = useEditorStore();
const history = useHistoryStore();

const newTag = ref('');
const editing = ref<string | null>(null);
const editedValue = ref('');

/** Every tag present anywhere in the selection. */
const tags = computed(() => level.tagsOn(editor.regionCells()));

function change(label: string, mutate: (x: number, y: number) => void): void {
    const cells = editor.regionCells();
    if (cells.length === 0) {
        return;
    }
    history.transact(label, { cells }, () => {
        for (const { x, y } of cells) {
            mutate(x, y);
        }
    });
    editor.dirty = true;
}

function add(): void {
    const tag = newTag.value.trim();
    if (tag === '') {
        return;
    }
    change(`tag "${tag}"`, (x, y) => level.addCellTag(x, y, tag));
    newTag.value = '';
    editor.setStatus(`Tag "${tag}" added to ${editor.regionCells().length} cell(s)`);
}

function remove(tag: string): void {
    change(`untag "${tag}"`, (x, y) => level.removeCellTag(x, y, tag));
    editor.setStatus(`Tag "${tag}" removed`);
}

function startEditing(tag: string): void {
    editing.value = tag;
    editedValue.value = tag;
}

function commitEdit(): void {
    const from = editing.value;
    const to = editedValue.value.trim();
    editing.value = null;
    if (from === null || to === '' || to === from) {
        return;
    }
    change(`rename tag to "${to}"`, (x, y) => level.renameCellTag(x, y, from, to));
}
</script>

<template>
    <WindowFrame caption="Tag Manager">
        <div class="tags">
            <p v-if="!editor.hasRegion" class="hint">
                Select a cell or a region on the map to see and edit its tags
            </p>

            <template v-else>
                <h3>Tags in the selection</h3>
                <p v-if="tags.length === 0" class="hint">none</p>
                <ul>
                    <li v-for="tag in tags" :key="tag">
                        <MyButton title="Remove this tag from the selection" @click="remove(tag)">
                            <SvgIcon :path="mdiDelete" />
                        </MyButton>
                        <MyButton title="Rename this tag" @click="startEditing(tag)">
                            <SvgIcon :path="mdiPencil" />
                        </MyButton>
                        <span v-if="editing !== tag">{{ tag }}</span>
                        <input
                            v-else
                            v-model="editedValue"
                            type="text"
                            class="tag-input"
                            @keydown.enter="commitEdit"
                            @keydown.esc="editing = null"
                        />
                    </li>
                </ul>

                <hr />
                <h3>Add a tag</h3>
                <label>
                    Tag:
                    <input v-model="newTag" type="text" style="width: 10em" @keydown.enter="add" />
                </label>
                <MyButton title="Add this tag to the selection" @click="add">
                    <SvgIcon :path="mdiPlus" />
                </MyButton>
            </template>
        </div>
    </WindowFrame>
</template>

<style scoped>
.tags {
    padding: 0.5em;
    font-family: monospace;
}

ul {
    list-style: none;
    padding-left: 0;
}

li {
    margin-bottom: 0.3em;
}

.tag-input {
    border: none;
    font-family: 'Courier New', Courier, monospace;
    font-size: 1em;
}
</style>
