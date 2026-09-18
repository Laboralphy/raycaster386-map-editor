<script setup lang="ts">
import { mdiDelete, mdiFolderOpen } from '@mdi/js';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import LevelThumbnail from '../components/LevelThumbnail.vue';
import MyButton from '../components/MyButton.vue';
import SvgIcon from '../components/SvgIcon.vue';
import WindowFrame from '../components/WindowFrame.vue';
import * as vault from '../services/vaultClient';
import { useEditorStore } from '../stores/editor';
import { useHistoryStore } from '../stores/history';
import { useLevelStore } from '../stores/level';

/**
 * The open dialog, ported from `_OLD_MAPEDIT_/src/components/LevelList.vue`.
 *
 * The Publish button is gone: it called `PUT /publish/:name`, a server-side
 * export that no longer exists now that conversion runs in the browser. It
 * comes back in phase 6, wired to the client-side path.
 */

const router = useRouter();
const editor = useEditorStore();
const level = useLevelStore();
const history = useHistoryStore();

const selected = ref('');

async function open(name: string): Promise<void> {
    try {
        await level.loadFromVault(name);
        // The undo stack belongs to the level that built it: keeping it would
        // let an undo paste cells from a different map into this one.
        history.reset();
        editor.clearRegion();
        editor.levelName = name;
        editor.dirty = false;
        editor.setStatus(`Level successfully loaded : ${name}`);
        await router.push('/level/blocks');
    } catch (e) {
        editor.setStatus(`Level NOT loaded : ${(e as Error).message}`);
        editor.showPopup((e as Error).message, 'error');
    }
}

async function erase(): Promise<void> {
    const name = selected.value;
    if (!confirm(`Do you want to delete this level : ${name} ? (this operation is definitive)`)) {
        return;
    }
    try {
        await vault.deleteLevel(name);
        selected.value = '';
        editor.setStatus(`Level deleted : ${name}`);
        await editor.refreshLevelList();
    } catch (e) {
        editor.setStatus(`Level NOT deleted : ${(e as Error).message}`);
    }
}

onMounted(() => {
    void editor.refreshLevelList();
});
</script>

<template>
    <WindowFrame caption="Open level">
        <template #toolbar>
            <MyButton :disabled="!selected" title="Open the selected level" @click="open(selected)">
                <SvgIcon :path="mdiFolderOpen" />
                Open
            </MyButton>
            <MyButton :disabled="!selected" title="Delete the selected level" @click="erase">
                <SvgIcon :path="mdiDelete" />
                Delete
            </MyButton>
        </template>
        <div>
            <p v-if="editor.levelList.length === 0" class="hint" style="margin: 2em">
                No levels in the vault
            </p>
            <LevelThumbnail
                v-for="l in editor.levelList"
                :key="l.name"
                :name="l.name"
                :date="l.date"
                :preview="l.preview"
                :selected="l.name === selected"
                @click="selected = l.name"
                @dblclick="open(l.name)"
            />
        </div>
    </WindowFrame>
</template>
