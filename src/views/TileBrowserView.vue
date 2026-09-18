<script setup lang="ts">
import { mdiChessRook, mdiDelete, mdiViewGrid, mdiWall } from '@mdi/js';
import { computed, ref, watch } from 'vue';
import MyButton from '../components/MyButton.vue';
import SiblingButton from '../components/SiblingButton.vue';
import SiblingGroup from '../components/SiblingGroup.vue';
import SvgIcon from '../components/SvgIcon.vue';
import TileCell from '../components/TileCell.vue';
import WindowFrame from '../components/WindowFrame.vue';
import type { TileType } from '../domain/types';
import { useEditorStore } from '../stores/editor';
import { useLevelStore } from '../stores/level';

/**
 * The side panel listing the project's tiles.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/TileBrowser.vue`, which is where
 * the `Siblings` redesign earns itself: the old version kept the selected tab
 * in Vuex *and* pushed it back into the child through
 * `$refs.tileType.selectSiblingIndex(...)` from both `mounted` and a watcher.
 * Here the tab is a `v-model` index and the two stay in step by construction.
 */

const level = useLevelStore();
const editor = useEditorStore();

const TYPES: readonly TileType[] = ['wall', 'flat', 'sprite'];

/** The tab index, mapped onto the tile type the rest of the app reads. */
const tabIndex = computed({
    get: () => TYPES.indexOf(editor.tileBrowserType),
    set: (index: number) => {
        editor.tileBrowserType = TYPES[index] ?? 'wall';
    },
});

/** Selected tile ids, owned here rather than inside each tile. */
const selected = ref(new Set<number>());

watch(
    () => editor.tileBrowserType,
    () => selected.value.clear()
);

const tiles = computed(() => level.visibleTiles(editor.tileBrowserType));

/** A sprite has no project-wide size, so it is shown at a fixed swatch size. */
const size = computed(() => {
    switch (editor.tileBrowserType) {
        case 'wall':
            return { width: level.tileWidth, height: level.tileHeight };
        case 'flat':
            return { width: level.tileWidth, height: level.tileWidth };
        default:
            return { width: 96, height: 96 };
    }
});

const caption = computed(() => {
    const label = { wall: 'Wall', flat: 'Flat', sprite: 'Sprite' }[editor.tileBrowserType];
    const n = tiles.value.length;
    return `${label} Tile browser - ${n} tile${n > 1 ? 's' : ''}`;
});

function toggle(id: number, value: boolean): void {
    if (value) {
        selected.value.add(id);
    } else {
        selected.value.delete(id);
    }
    // A Set is not deeply reactive; replacing it is what redraws the tiles.
    selected.value = new Set(selected.value);
}

/** Reorders within a group. `moveTile` refuses a cross-group drop itself. */
function onDrop(targetId: number, incomingId: number): void {
    level.moveTile(incomingId, targetId);
}

function remove(): void {
    const ids = [...selected.value];
    if (ids.length === 0) {
        return;
    }
    const prompt = ids.length > 1 ? `Delete these ${ids.length} tiles ?` : 'Delete this tile ?';
    if (!confirm(prompt)) {
        return;
    }
    const refused: number[] = [];
    for (const id of ids) {
        const result = level.deleteTile(id);
        if (!result.deleted) {
            refused.push(id);
        }
    }
    selected.value = new Set(refused);
    editor.dirty = true;
    editor.setStatus(
        refused.length > 0
            ? `${ids.length - refused.length} deleted; #${refused.join(', #')} still used by things`
            : `${ids.length} tile${ids.length > 1 ? 's' : ''} deleted`
    );
}
</script>

<template>
    <WindowFrame :caption="caption">
        <template #toolbar>
            <SiblingGroup v-model="tabIndex">
                <SiblingButton title="Display project wall tiles">
                    <SvgIcon :path="mdiWall" />
                </SiblingButton>
                <SiblingButton title="Display project flat tiles">
                    <SvgIcon :path="mdiViewGrid" />
                </SiblingButton>
                <SiblingButton title="Display project sprite tiles">
                    <SvgIcon :path="mdiChessRook" />
                </SiblingButton>
            </SiblingGroup>
            <MyButton
                title="Delete the selected tiles"
                :disabled="selected.size === 0"
                @click="remove"
            >
                <SvgIcon :path="mdiDelete" />
            </MyButton>
        </template>
        <div>
            <p v-if="tiles.length === 0" class="hint" style="margin: 1em">
                No {{ editor.tileBrowserType }} tiles yet — import some from the Tiles screen
            </p>
            <TileCell
                v-for="tile in tiles"
                :key="tile.id"
                :tile="tile.id"
                :content="tile.content"
                :width="size.width"
                :height="size.height"
                :anim="!!tile.animation"
                :selected="selected.has(tile.id)"
                :dropzone="true"
                @select="(value) => toggle(tile.id, value)"
                @drop="(incoming) => onDrop(tile.id, incoming)"
            />
        </div>
    </WindowFrame>
</template>
