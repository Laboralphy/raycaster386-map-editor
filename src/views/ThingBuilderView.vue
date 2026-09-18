<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MyButton from '../components/MyButton.vue';
import TileCell from '../components/TileCell.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { emptyThing } from '../domain/defaults';
import type { EditorThing } from '../domain/types';
import { useEditorStore } from '../stores/editor';
import { useLevelStore } from '../stores/level';

/**
 * Building one thing template: a sprite plus how it behaves.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/ThingBuilder.vue`. Route
 * `/build-thing/0` creates; any other id edits that thing.
 *
 * The old version copied the light object straight off the stored thing rather
 * than cloning it, so editing the form mutated the document before anything was
 * saved — and cancelling kept the change.
 */

const route = useRoute();
const router = useRouter();
const level = useLevelStore();
const editor = useEditorStore();

const draft = ref<EditorThing>(emptyThing(0));

const editedId = computed(() => Number(route.params.id ?? 0) | 0);
const isNew = computed(() => editedId.value === 0);

watch(
    editedId,
    (id) => {
        const existing = id > 0 ? level.findThing(id) : undefined;
        draft.value = existing ? JSON.parse(JSON.stringify(existing)) : emptyThing(0);
    },
    { immediate: true }
);

const tile = computed(() => level.findTile(draft.value.tile));
const hasTile = computed(() => !!tile.value);

function onDrop(incoming: number): void {
    const dropped = level.findTile(incoming);
    if (!dropped) {
        return;
    }
    if (dropped.type !== 'sprite') {
        editor.setStatus('A thing draws with a sprite tile, not a ' + dropped.type);
        return;
    }
    draft.value.tile = incoming;
}

async function save(): Promise<void> {
    if (!hasTile.value) {
        editor.setStatus('This thing needs a sprite tile first');
        return;
    }
    const id = level.upsertThing({ ...draft.value, id: editedId.value });
    editor.thingBrowserSelected = id;
    editor.dirty = true;
    editor.setStatus(isNew.value ? `Thing #${id} created` : `Thing #${id} updated`);
    await router.push('/level/things');
}
</script>

<template>
    <WindowFrame :caption="isNew ? 'Thing Builder - new thing' : `Thing Builder - #${editedId}`">
        <div class="builder">
            <form @submit.prevent>
                <h3>Thing properties</h3>
                <div>
                    <label>
                        Opacity:
                        <select v-model.number="draft.opacity">
                            <option :value="0">100%</option>
                            <option :value="1">75%</option>
                            <option :value="2">50%</option>
                            <option :value="3">25%</option>
                        </select>
                    </label>
                    <div class="hint">100% is fully opaque; 25% is nearly transparent.</div>
                </div>

                <div>
                    <label
                        >Light emitter: <input v-model="draft.light.enabled" type="checkbox"
                    /></label>
                    <div class="hint">
                        A light emitter never dims with distance from the point of view.
                    </div>
                    <fieldset v-if="draft.light.enabled">
                        <legend>Light source properties</legend>
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
                    <label>Ghost filter: <input v-model="draft.ghost" type="checkbox" /></label>
                    <div class="hint">An additive colour filter — most visible in dark areas.</div>
                </div>

                <div>
                    <label>Obstacle: <input v-model="draft.tangible" type="checkbox" /></label>
                    <div class="hint">A tangible thing blocks whatever collides with it.</div>
                </div>

                <div v-if="draft.tangible">
                    <label>
                        Physical size:
                        <input v-model.number="draft.size" type="number" min="1" />
                    </label>
                    <div class="hint">Only used while the thing is tangible.</div>
                </div>

                <div>
                    <label>Ref: <input v-model="draft.ref" type="text" style="width: 8em" /></label>
                    <div class="hint">Optional symbolic identifier, used during development</div>
                </div>

                <hr />
                <MyButton :disabled="!hasTile" @click="save">
                    {{ isNew ? 'Create' : 'Update' }}
                </MyButton>
                <span v-if="!hasTile" class="hint">drop a sprite tile first</span>
            </form>

            <section>
                <h3>Drag a sprite tile here...</h3>
                <TileCell
                    :tile="draft.tile"
                    :content="tile?.content ?? ''"
                    :width="96"
                    :height="96"
                    :selectable="false"
                    :draggable="false"
                    :dropzone="true"
                    @drop="onDrop"
                />
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

input[type='number'] {
    width: 5em;
}
</style>
