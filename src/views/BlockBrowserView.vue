<script setup lang="ts">
import { mdiDelete, mdiPencil, mdiPlus } from '@mdi/js';
import { useRouter } from 'vue-router';
import BlockSwatch from '../components/BlockSwatch.vue';
import MyButton from '../components/MyButton.vue';
import SvgIcon from '../components/SvgIcon.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { useEditorStore } from '../stores/editor';
import { useLevelStore } from '../stores/level';

/**
 * The block palette, ported from
 * `_OLD_MAPEDIT_/src/components/BlockBrowser.vue`.
 *
 * Blocks are shown in phys order, which groups the walls, the doors and the
 * walkable floors together. That ordering is a copy — the old getter sorted
 * `state.blocks` itself, so opening this panel permanently reordered the
 * document, and block order is legend order in the exported level.
 */

const router = useRouter();
const level = useLevelStore();
const editor = useEditorStore();

function pick(id: number): void {
    editor.blockBrowserSelected = editor.blockBrowserSelected === id ? null : id;
}

function remove(): void {
    const id = editor.blockBrowserSelected;
    if (id === null || !confirm('Delete this block ?')) {
        return;
    }
    level.deleteBlock(id);
    editor.blockBrowserSelected = null;
    editor.dirty = true;
    editor.setStatus(`Block #${id} deleted`);
}
</script>

<template>
    <WindowFrame :caption="`Block browser - ${level.doc.blocks.length} block(s)`">
        <template #toolbar>
            <MyButton title="Create a new block" @click="router.push('/build-block/0')">
                <SvgIcon :path="mdiPlus" />
            </MyButton>
            <MyButton
                :disabled="editor.blockBrowserSelected === null"
                title="Modify the selected block"
                @click="router.push(`/build-block/${editor.blockBrowserSelected}`)"
            >
                <SvgIcon :path="mdiPencil" />
            </MyButton>
            <MyButton
                :disabled="editor.blockBrowserSelected === null"
                title="Delete the selected block"
                @click="remove"
            >
                <SvgIcon :path="mdiDelete" />
            </MyButton>
        </template>
        <div>
            <p v-if="level.doc.blocks.length === 0" class="hint" style="margin: 1em">
                No blocks yet — create one once some tiles are imported
            </p>
            <BlockSwatch
                v-for="block in level.blocksByPhys"
                :key="block.id"
                :content="block.preview"
                :selected="block.id === editor.blockBrowserSelected"
                @click="pick(block.id)"
            />
        </div>
    </WindowFrame>
</template>
