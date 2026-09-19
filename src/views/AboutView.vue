<script setup lang="ts">
import { mdiFilePlus } from '@mdi/js';
import { useRouter } from 'vue-router';
import MyButton from '../components/MyButton.vue';
import SvgIcon from '../components/SvgIcon.vue';
import WindowFrame from '../components/WindowFrame.vue';
import splash from '../assets/splash.png';
import { useEditorStore } from '../stores/editor';
import { useHistoryStore } from '../stores/history';
import { useLevelStore } from '../stores/level';

/**
 * The home screen: the splash, and the one action that belongs nowhere else.
 *
 * Starting a level is the counterpart of opening one, and `LevelListView` is
 * the open dialog — so this is where "start from scratch" goes. The old editor
 * had no such button: it began with an empty document and the only way back to
 * one was to reload the page.
 */

const router = useRouter();
const level = useLevelStore();
const editor = useEditorStore();
const history = useHistoryStore();

async function startFromScratch(): Promise<void> {
    // Only when there is something to lose. A level that is saved, or one that
    // was never touched, can be discarded without asking — an unsaved one
    // cannot, and this is the one button in the editor that throws work away.
    if (
        editor.dirty &&
        !confirm('The current level has unsaved changes. Discard them and start a new level?')
    ) {
        return;
    }

    level.reset();
    // The undo stack belongs to the document that built it; keeping it would
    // let an undo paste the old level's cells into the new one.
    history.reset();
    editor.resetForLevel('');
    editor.setStatus('New level started — set the tile size in Settings before importing tiles');
    await router.push('/level/blocks');
}
</script>

<template>
    <WindowFrame caption="Raycaster Map Editor">
        <template #toolbar>
            <MyButton
                title="Discard the level in memory and start a new one"
                @click="startFromScratch"
            >
                <SvgIcon :path="mdiFilePlus" />
                Start from scratch
            </MyButton>
        </template>
        <div class="splash">
            <img :src="splash" alt="Raycaster Map Editor" />
        </div>
    </WindowFrame>
</template>

<style scoped>
.splash {
    text-align: center;
    padding: 1em;
}

.splash img {
    max-width: 100%;
}
</style>
