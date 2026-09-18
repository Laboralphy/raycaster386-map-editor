<script setup lang="ts">
import { onMounted, ref } from 'vue';
import MyButton from '../components/MyButton.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { rescaleTile } from '../libs/tilesetSplitter';
import { useEditorStore } from '../stores/editor';
import { useLevelStore } from '../stores/level';

/**
 * Level settings, ported from `_OLD_MAPEDIT_/src/components/Settings.vue`.
 *
 * Changing the tile size rescales every wall and flat image through a canvas,
 * and `setTileSize` scales the values measured in tile widths — block offsets,
 * light radii, thing sizes, fog distance. Sprites keep their own size, as they
 * did before: they are not laid out on the tile grid.
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
const applying = ref(false);

onMounted(() => {
    tileWidth.value = level.doc.metrics.tileWidth;
    tileHeight.value = level.doc.metrics.tileHeight;
    cameraThinker.value = level.doc.actor.thinker;
    flagSmooth.value = level.doc.flags.smooth;
    flagStretch.value = level.doc.flags.stretch;
    flagExport.value = level.doc.flags.export;
});

async function apply(): Promise<void> {
    const width = Number(tileWidth.value);
    const height = Number(tileHeight.value);
    const resize = width !== level.doc.metrics.tileWidth || height !== level.doc.metrics.tileHeight;

    if (resize) {
        applying.value = true;
        editor.setStatus('resizing tiles...');
        try {
            for (const type of ['wall', 'flat'] as const) {
                const target = type === 'wall' ? height : width;
                for (const tile of level.allTiles(type)) {
                    const content = await rescaleTile(tile.content, width, target);
                    level.replaceTileContent(tile.id, content, width, target);
                }
            }
        } catch (e) {
            applying.value = false;
            editor.setStatus(`Could not resize tiles : ${(e as Error).message}`);
            editor.showPopup((e as Error).message, 'error');
            return;
        }
        applying.value = false;
    }

    level.setTileSize(width, height);
    level.setCameraThinker(cameraThinker.value);
    level.setFlag('smooth', flagSmooth.value);
    level.setFlag('stretch', flagStretch.value);
    level.setFlag('export', flagExport.value);
    editor.dirty = true;
    editor.setStatus(resize ? 'Settings applied, tiles resized' : 'Settings applied');
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
                    <div class="hint">
                        Reference of the camera thinker (which controls its behavior).
                    </div>
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
                        If checked, the second story wall textures will be stretched, and will
                        appear twice taller.
                    </div>
                </div>
            </fieldset>
            <fieldset>
                <legend>Level publication</legend>
                <div>
                    <label
                        >Auto-publish this level: <input v-model="flagExport" type="checkbox"
                    /></label>
                    <div class="hint">
                        If checked, each time you save the level, it will also be published to the
                        local game project.
                    </div>
                </div>
            </fieldset>
            <br />
            <div class="actions">
                <MyButton :disabled="applying" @click="apply">
                    {{ applying ? 'Resizing...' : 'Apply changes' }}
                </MyButton>
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
