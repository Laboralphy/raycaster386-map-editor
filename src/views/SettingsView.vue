<script setup lang="ts">
import { onMounted, ref } from 'vue';
import MyButton from '../components/MyButton.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { useEditorStore } from '../stores/editor';
import { useLevelStore } from '../stores/level';

/**
 * Level settings, ported from `_OLD_MAPEDIT_/src/components/Settings.vue`.
 *
 * The tile-size *rescale* — reloading every tile through a canvas and writing
 * it back at the new resolution — is deliberately not here. It belongs with the
 * rest of the tile pipeline in phase 2, and the old warning below still tells
 * the truth about what it will do once it lands.
 *
 * Until then this writes the metrics, the flags and the camera thinker, which
 * is exactly the set of fields a save stores as strings — so a load, an edit
 * and a save through this screen is the end-to-end proof that the document
 * survives a round trip.
 */

const level = useLevelStore();
const editor = useEditorStore();

const tileWidth = ref(64);
const tileHeight = ref(96);
const cameraThinker = ref('');
const flagSmooth = ref(false);
const flagStretch = ref(false);
const flagExport = ref(false);
const saving = ref(false);

onMounted(() => {
    tileWidth.value = level.doc.metrics.tileWidth;
    tileHeight.value = level.doc.metrics.tileHeight;
    cameraThinker.value = level.doc.actor.thinker;
    flagSmooth.value = level.doc.flags.smooth;
    flagStretch.value = level.doc.flags.stretch;
    flagExport.value = level.doc.flags.export;
});

function apply(): void {
    level.setTileSize(Number(tileWidth.value), Number(tileHeight.value));
    level.setCameraThinker(cameraThinker.value);
    level.setFlag('smooth', flagSmooth.value);
    level.setFlag('stretch', flagStretch.value);
    level.setFlag('export', flagExport.value);
    editor.dirty = true;
    editor.setStatus('Settings applied');
}

async function save(): Promise<void> {
    const name = prompt('Save the level as:', editor.levelName);
    if (name === null || name === '') {
        return;
    }
    saving.value = true;
    try {
        await level.saveToVault(name);
        editor.levelName = name;
        editor.dirty = false;
        editor.setStatus(`Level saved : ${name}`);
    } catch (e) {
        editor.setStatus(`Level NOT saved : ${(e as Error).message}`);
        editor.showPopup((e as Error).message, 'error');
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <WindowFrame caption="Settings">
        <form @submit.prevent>
            <fieldset>
                <legend>Tile size</legend>
                <div>
                    <label>Tile width: <input v-model="tileWidth" type="number" min="1" /></label>
                    <div class="hint">Tile width in pixels</div>
                </div>
                <div>
                    <label>Tile height: <input v-model="tileHeight" type="number" min="1" /></label>
                    <div class="hint">Tile height in pixels, from floor to ceiling</div>
                </div>
            </fieldset>
            <fieldset>
                <legend>Camera Thinker</legend>
                <div>
                    <label>Camera Thinker: <input v-model="cameraThinker" type="text" /></label>
                    <div class="hint">Reference of the camera thinker (which controls its behavior).</div>
                </div>
            </fieldset>
            <fieldset>
                <legend>Texture flags</legend>
                <div>
                    <label>Texture smoothing: <input v-model="flagSmooth" type="checkbox" /></label>
                    <div class="hint">
                        If checked, the wall texture rendering will be smoothed, else, it will be
                        pixelated
                    </div>
                </div>
                <div>
                    <label>
                        Second story texture stretching:
                        <input v-model="flagStretch" type="checkbox" />
                    </label>
                    <div class="hint">
                        If checked, the second story wall textures will be stretched, and will appear
                        twice taller.
                    </div>
                </div>
            </fieldset>
            <fieldset>
                <legend>Level publication</legend>
                <div>
                    <label>Auto-publish this level: <input v-model="flagExport" type="checkbox" /></label>
                    <div class="hint">
                        If checked, each time you save the level, it will also be published to the
                        local game project.
                    </div>
                </div>
            </fieldset>
            <br />
            <div class="actions">
                <MyButton @click="apply">Apply changes</MyButton>
                <MyButton :disabled="saving" @click="save">
                    {{ saving ? 'Saving...' : 'Save level' }}
                </MyButton>
                <span v-if="editor.levelName" class="hint">open: {{ editor.levelName }}</span>
            </div>
            <h3>Warning</h3>
            <p style="color: darkred; font-weight: bold">
                Changing tile width or height will resize all existing tiles and affect texture
                resolution and quality. It will also modify all metrics, block light radius values,
                block offsets, and thing physical size.
            </p>
            <p class="hint">
                Tile rescaling is not implemented yet: for now these fields change the recorded
                metrics only.
            </p>
        </form>
    </WindowFrame>
</template>

<style scoped>
form {
    padding: 1em;
    font-family: monospace;
}

.actions {
    display: flex;
    gap: 0.5em;
    align-items: center;
}
</style>
