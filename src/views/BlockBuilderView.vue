<script setup lang="ts">
import { mdiCloseCircle, mdiContentDuplicate } from '@mdi/js';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MyButton from '../components/MyButton.vue';
import SvgIcon from '../components/SvgIcon.vue';
import TileCell from '../components/TileCell.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { emptyBlock } from '../domain/defaults';
import { PHYS_TABLE } from '../domain/reference';
import type { EditorBlock, TileType } from '../domain/types';
import { renderBlockPreview, type FaceContents } from '../libs/blockRenderer';
import { useEditorStore } from '../stores/editor';
import { useLevelStore } from '../stores/level';

/**
 * Building one block out of six tiles and a physical kind.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/BlockBuilder.vue`, whose 546 lines
 * were mostly twelve near-identical computed properties — one pair per face.
 * The faces are a list here instead, so the template says once what it used to
 * say six times.
 *
 * Route `/build-block/0` creates; any other id edits that block.
 */

const route = useRoute();
const router = useRouter();
const level = useLevelStore();
const editor = useEditorStore();

/** Which tile group a face draws from. Walls take walls; floor and ceiling take flats. */
const FACES: { key: keyof EditorBlock['faces']; label: string; kind: TileType; wall: boolean }[] = [
    { key: 'c', label: 'Ceiling', kind: 'flat', wall: false },
    { key: 'w', label: 'West', kind: 'wall', wall: true },
    { key: 'n', label: 'North', kind: 'wall', wall: true },
    { key: 's', label: 'South', kind: 'wall', wall: true },
    { key: 'e', label: 'East', kind: 'wall', wall: true },
    { key: 'f', label: 'Floor', kind: 'flat', wall: false },
];

const WALL_FACES = ['n', 'e', 'w', 's'] as const;

const draft = ref<EditorBlock>(emptyBlock(0));
const saving = ref(false);

const editedId = computed(() => Number(route.params.id ?? 0) | 0);
const isNew = computed(() => editedId.value === 0);

watch(
    editedId,
    (id) => {
        const existing = id > 0 ? level.findBlock(id) : undefined;
        // A structured clone, so abandoning the form leaves the document alone.
        draft.value = existing ? JSON.parse(JSON.stringify(existing)) : emptyBlock(0);
    },
    { immediate: true }
);

/** The phys entry currently chosen, for its `offset` and `tiles` hints. */
const physEntry = computed(() => PHYS_TABLE[draft.value.phys]);

/**
 * Light only escapes a block rays can pass through. The old builder said so in
 * a warning, and the rule is the engine's, not the editor's.
 */
const lightIsIgnored = computed(() => ![0, 10, 11].includes(draft.value.phys));

function faceContent(key: keyof EditorBlock['faces']): string {
    const id = draft.value.faces[key];
    return id === null ? '' : (level.findTile(id)?.content ?? '');
}

function faceIsAnimated(key: keyof EditorBlock['faces']): boolean {
    const id = draft.value.faces[key];
    return id !== null && !!level.findTile(id)?.animation;
}

/**
 * Accepts a dropped tile, if it is the right kind for this face.
 *
 * The old builder took anything. A flat tile on a wall face — or the reverse —
 * produces a level that edits and previews but fails to convert, because the
 * converter resolves a face id against the tileset for that face's kind. Same
 * class of silent breakage as deleting a tile still in use.
 */
function onDrop(key: keyof EditorBlock['faces'], incoming: number): void {
    const tile = level.findTile(incoming);
    if (!tile) {
        return;
    }
    const face = FACES.find((f) => f.key === key);
    if (!face || tile.type !== face.kind) {
        editor.setStatus(
            `${face?.label ?? key} takes a ${face?.kind ?? '?'} tile, not a ${tile.type}`
        );
        return;
    }
    draft.value.faces[key] = incoming;
}

function clearFace(key: keyof EditorBlock['faces']): void {
    draft.value.faces[key] = null;
}

/** Copies one wall onto all four, which is most of what a plain wall needs. */
function duplicateWall(key: keyof EditorBlock['faces']): void {
    const id = draft.value.faces[key];
    for (const face of WALL_FACES) {
        draft.value.faces[face] = id;
    }
}

async function save(): Promise<void> {
    saving.value = true;
    try {
        const faces: FaceContents = {
            n: faceContent('n'),
            e: faceContent('e'),
            w: faceContent('w'),
            s: faceContent('s'),
            f: faceContent('f'),
            c: faceContent('c'),
        };
        // The thumbnail is part of the saved block, so it is rendered here and
        // handed to the store — which never touches a canvas itself.
        draft.value.preview = await renderBlockPreview(
            draft.value.phys,
            faces,
            draft.value.light.enabled
        );
        const id = level.upsertBlock({ ...draft.value, id: editedId.value });
        editor.blockBrowserSelected = id;
        editor.dirty = true;
        editor.setStatus(isNew.value ? `Block #${id} created` : `Block #${id} updated`);
        await router.push('/level/blocks');
    } catch (e) {
        editor.setStatus(`Could not save the block : ${(e as Error).message}`);
        editor.showPopup((e as Error).message, 'error');
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <WindowFrame :caption="isNew ? 'Block Builder - new block' : `Block Builder - #${editedId}`">
        <div class="builder">
            <form @submit.prevent>
                <h3>Physical properties</h3>
                <div>
                    <label>
                        Phys:
                        <select v-model.number="draft.phys">
                            <option v-for="p in PHYS_TABLE" :key="p.id" :value="p.id">
                                {{ p.label }}
                            </option>
                        </select>
                    </label>
                    <div class="hint">{{ physEntry?.desc }}</div>
                </div>
                <div v-if="physEntry?.offset">
                    <label>
                        Offs:
                        <input
                            v-model.number="draft.offs"
                            type="number"
                            min="0"
                            :max="level.tileWidth"
                        />
                    </label>
                    <div class="hint">
                        Increasing this value creates an alcove; the higher the value, the deeper.
                    </div>
                </div>
                <div>
                    <label>Light: <input v-model="draft.light.enabled" type="checkbox" /></label>
                    <div v-if="!draft.light.enabled" class="hint">
                        Check this to open the light properties
                    </div>
                    <fieldset v-else>
                        <legend>Light source properties</legend>
                        <p v-if="lightIsIgnored" class="warning">
                            This Phys value is opaque, so no light passes through this block and
                            these values are ignored. Choose Walkable, Transparent or Invisible to
                            let light through.
                        </p>
                        <div>
                            <label>
                                Intensity:
                                <input
                                    v-model.number="draft.light.value"
                                    type="number"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                />
                            </label>
                        </div>
                        <div>
                            <label>
                                In.rad.:
                                <input v-model.number="draft.light.inner" type="number" min="0" />
                            </label>
                        </div>
                        <div>
                            <label>
                                Out.rad.:
                                <input v-model.number="draft.light.outer" type="number" min="0" />
                            </label>
                        </div>
                    </fieldset>
                </div>
                <div>
                    <label>Ref: <input v-model="draft.ref" type="text" style="width: 8em" /></label>
                    <div class="hint">Optional symbolic identifier, used during development</div>
                </div>
                <hr />
                <MyButton :disabled="saving" @click="save">
                    {{ isNew ? 'Create' : 'Update' }}
                </MyButton>
            </form>

            <section class="faces">
                <h3>Drag tiles here...</h3>
                <figure v-for="face in FACES" :key="face.key" class="face">
                    <TileCell
                        :tile="0"
                        :content="faceContent(face.key)"
                        :width="level.tileWidth"
                        :height="face.wall ? level.tileHeight : level.tileWidth"
                        :anim="faceIsAnimated(face.key)"
                        :selectable="false"
                        :draggable="false"
                        :dropzone="true"
                        @drop="(incoming) => onDrop(face.key, incoming)"
                    />
                    <figcaption>
                        {{ face.label }}
                        <span
                            v-if="face.wall"
                            class="icon"
                            title="duplicate this tile to all wall panels"
                            @click="duplicateWall(face.key)"
                        >
                            <SvgIcon :path="mdiContentDuplicate" />
                        </span>
                        <span
                            class="icon"
                            title="clear this placeholder"
                            @click="clearFace(face.key)"
                        >
                            <SvgIcon :path="mdiCloseCircle" />
                        </span>
                    </figcaption>
                </figure>
            </section>
        </div>
    </WindowFrame>
</template>

<style scoped>
.builder {
    display: flex;
    gap: 2em;
    padding: 1em;
    font-family: monospace;
    align-items: flex-start;
}

.faces {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
    max-width: 40em;
}

.face {
    text-align: center;
    margin: 0;
}

.icon {
    cursor: pointer;
    margin-left: 0.2em;
}

.warning {
    color: darkred;
    font-weight: bold;
    max-width: 24em;
}

input[type='number'] {
    width: 5em;
}
</style>
