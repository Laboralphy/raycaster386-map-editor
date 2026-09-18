<script setup lang="ts">
import { mdiChessRook, mdiImport, mdiViewGrid, mdiWall } from '@mdi/js';
import { computed, ref } from 'vue';
import ImageLoader from '../components/ImageLoader.vue';
import ImagePasteBin from '../components/ImagePasteBin.vue';
import MyButton from '../components/MyButton.vue';
import SvgIcon from '../components/SvgIcon.vue';
import TileCell from '../components/TileCell.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { domCanvasOps } from '../libs/canvasOps';
import { splitTileset } from '../libs/tilesetSplitter';
import { useEditorStore } from '../stores/editor';
import { useLevelStore } from '../stores/level';

/**
 * Importing tiles from a sheet.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/TileLoader.vue` (whose `name` said
 * `WallTileLoader`). A sheet is cut into candidate tiles, you pick the ones you
 * want, and Import copies them into the project.
 *
 * The old `doImportType` walked the candidates backwards so it could splice as
 * it went, but pushed onto its result in the same backwards order — so a sheet
 * imported with its tiles reversed, and an animation built from them ran
 * backwards. Selection order is preserved here.
 */

const level = useLevelStore();
const editor = useEditorStore();

interface Candidate {
    id: number;
    src: string;
    width: number;
    height: number;
    selected: boolean;
}

const candidates = ref<Candidate[]>([]);
const busy = ref(false);
let lastId = 0;

const hasCandidates = computed(() => candidates.value.length > 0);
const selectedCount = computed(() => candidates.value.filter((c) => c.selected).length);

/** Walls are `width x height`; flats are square; a sprite is whatever it is. */
function candidateSize(): { width: number; height: number } {
    return editor.tileBrowserType === 'wall'
        ? { width: level.tileWidth, height: level.tileHeight }
        : { width: level.tileWidth, height: level.tileWidth };
}

async function load(src: string): Promise<void> {
    busy.value = true;
    candidates.value = [];
    try {
        if (editor.tileBrowserType === 'sprite') {
            // A sprite is imported whole, at its own size.
            const image = await domCanvasOps.loadCanvas(src);
            candidates.value = [
                {
                    id: ++lastId,
                    src: domCanvasOps.getData(image),
                    width: image.width,
                    height: image.height,
                    selected: false,
                },
            ];
        } else {
            const { width, height } = candidateSize();
            const pieces = await splitTileset(src, width, height);
            candidates.value = pieces.map((piece) => ({
                id: ++lastId,
                src: piece,
                width,
                height,
                selected: false,
            }));
        }
        editor.setStatus(`${candidates.value.length} tile(s) ready to import`);
    } catch (e) {
        editor.setStatus(`Could not read that image : ${(e as Error).message}`);
        editor.showPopup((e as Error).message, 'error');
    } finally {
        busy.value = false;
    }
}

function toggle(id: number, value: boolean): void {
    const candidate = candidates.value.find((c) => c.id === id);
    if (candidate) {
        candidate.selected = value;
    }
}

function doImport(): void {
    const picked = candidates.value.filter((c) => c.selected);
    if (picked.length === 0) {
        return;
    }
    level.addTiles(
        editor.tileBrowserType,
        picked.map((c) => ({ content: c.src, width: c.width, height: c.height }))
    );
    candidates.value = candidates.value.filter((c) => !c.selected);
    editor.dirty = true;
    editor.setStatus(`${picked.length} tile(s) imported`);
}
</script>

<template>
    <WindowFrame caption="Tile loader">
        <template #toolbar>
            <ImageLoader
                v-if="editor.tileBrowserType === 'wall'"
                title="Import a wall tileset from an image"
                @load="load"
            >
                <SvgIcon :path="mdiWall" /> Load walls
            </ImageLoader>
            <ImageLoader
                v-else-if="editor.tileBrowserType === 'flat'"
                title="Import a flat tileset from an image"
                @load="load"
            >
                <SvgIcon :path="mdiViewGrid" /> Load flats
            </ImageLoader>
            <ImageLoader
                v-else
                title="Import a single tile from an image to make a sprite"
                :multiple="true"
                @load="load"
            >
                <SvgIcon :path="mdiChessRook" /> Load sprites
            </ImageLoader>
            <MyButton
                :disabled="selectedCount === 0"
                title="Import all selected tiles into current project"
                @click="doImport"
            >
                <SvgIcon :path="mdiImport" /> Import{{ selectedCount ? ` (${selectedCount})` : '' }}
            </MyButton>
        </template>

        <div v-if="!hasCandidates" class="help">
            <h3>Tileset importation</h3>
            <ul>
                <li>Pick the tile group on the right, then load a tileset image.</li>
                <li>Click tiles to select them. Click again to toggle.</li>
                <li>Click <b>Import</b> to copy the selected tiles into the project.</li>
                <li>You may also press <b>Ctrl-V</b> to paste an image here.</li>
            </ul>
            <p v-if="busy" class="hint">reading image...</p>
        </div>
        <div v-else>
            <h3>
                {{ editor.tileBrowserType }} tiles — {{ candidates.length }} found,
                {{ selectedCount }} selected
            </h3>
            <TileCell
                v-for="candidate in candidates"
                :key="candidate.id"
                :tile="candidate.id"
                :content="candidate.src"
                :width="candidate.width"
                :height="candidate.height"
                :selected="candidate.selected"
                :draggable="false"
                @select="(value) => toggle(candidate.id, value)"
            />
        </div>

        <ImagePasteBin @paste="load" />
    </WindowFrame>
</template>

<style scoped>
.help {
    padding: 1em;
    font-family: monospace;
}

h3 {
    padding-left: 0.5em;
    text-transform: capitalize;
}
</style>
