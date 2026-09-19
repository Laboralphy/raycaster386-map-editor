<script setup lang="ts">
import { mdiFolderImage } from '@mdi/js';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ImageLoader from '../components/ImageLoader.vue';
import ImagePasteBin from '../components/ImagePasteBin.vue';
import MyButton from '../components/MyButton.vue';
import SvgIcon from '../components/SvgIcon.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { defaultAmbiance } from '../domain/defaults';
import type { EditorAmbiance } from '../domain/types';
import { useEditorStore } from '../stores/editor';
import { useHistoryStore } from '../stores/history';
import { useLevelStore } from '../stores/level';

/**
 * Sky, fog, brightness and the colour filter.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/AmbianceSetup.vue`, which was
 * captioned "Animation builder" — it had been copied from that component and
 * the title never changed.
 *
 * It lives beside the renderer because its effect cannot be judged any other
 * way: every field here changes how the level *looks*, and nothing in the grid
 * editor shows it. Apply, then Render.
 *
 * The draft is a copy. The old version assigned `this.value = this.getAmbiance`
 * and edited the document in place, so every keystroke was already applied and
 * there was nothing for its Apply button to do.
 */

const level = useLevelStore();
const editor = useEditorStore();
const history = useHistoryStore();
const router = useRouter();

/** A colour that reads as "no filter yet" rather than black. */
const DEFAULT_FILTER_COLOR = '#888888';

const draft = ref<EditorAmbiance>(defaultAmbiance());

onMounted(() => {
    const current = level.doc.ambiance;
    draft.value = {
        sky: current.sky,
        fog: { distance: current.fog.distance, color: current.fog.color },
        filter: { enabled: current.filter.enabled, color: current.filter.color },
        brightness: current.brightness,
    };
});

/**
 * The converter drops a filter whose colour is empty, so enabling one without
 * choosing a colour would silently do nothing. An empty `<input type="color">`
 * also shows black, which reads as a deliberate choice.
 */
function onFilterToggled(): void {
    if (draft.value.filter.enabled && draft.value.filter.color === '') {
        draft.value.filter.color = DEFAULT_FILTER_COLOR;
    }
}

function apply(): void {
    // 'meta' is the slice that carries ambiance, so this is undoable.
    history.transact('ambiance', { slices: ['meta'] }, () => {
        level.setAmbiance(draft.value);
    });
    editor.dirty = true;
    editor.setStatus('Ambiance applied');
}

function applyAndRender(): void {
    apply();
    void router.push('/render');
}

function clearSky(): void {
    draft.value.sky = '';
}
</script>

<template>
    <WindowFrame caption="Ambiance">
        <template #toolbar>
            <ImageLoader title="Import a sky background image" @load="draft.sky = $event">
                <SvgIcon :path="mdiFolderImage" /> Load sky
            </ImageLoader>
        </template>
        <div class="ambiance">
            <h3>Sky background</h3>
            <div class="sky">
                <img v-if="draft.sky" class="bg-sky" :src="draft.sky" alt="the level's sky" />
                <p v-else class="hint">No sky image. The backdrop will be plain fog colour.</p>
            </div>
            <p class="hint">You may also press <b>Ctrl-V</b> to paste an image here.</p>
            <MyButton :disabled="!draft.sky" @click="clearSky">Remove sky</MyButton>

            <hr />
            <h3>Fog and light</h3>
            <form @submit.prevent>
                <div>
                    <label>Fog colour: <input v-model="draft.fog.color" type="color" /></label>
                    <div class="hint">
                        Surfaces and sprites further away than the fog distance are painted with
                        this colour.
                    </div>
                </div>
                <div>
                    <label>
                        Fog distance:
                        <input v-model.number="draft.fog.distance" type="number" min="0" />
                    </label>
                    <div class="hint">
                        The distance at which the fog becomes completely opaque. Measured in tile
                        widths, so changing the tile size rescales it.
                    </div>
                </div>
                <div>
                    <label>
                        Ambient brightness:
                        <input
                            v-model.number="draft.brightness"
                            type="number"
                            min="0"
                            max="100"
                            step="10"
                        />%
                    </label>
                    <div class="hint">
                        Walls and flats can emit their own light. 0% emits none; 100% dissipates the
                        fog entirely.
                    </div>
                </div>
                <div>
                    <label>
                        Colour filter:
                        <input
                            v-model="draft.filter.enabled"
                            type="checkbox"
                            @change="onFilterToggled"
                        />
                    </label>
                    <div class="hint">Tints sprites and background objects.</div>
                </div>
                <fieldset v-if="draft.filter.enabled">
                    <legend>Colour filter</legend>
                    <div>
                        <label
                            >Filter colour: <input v-model="draft.filter.color" type="color"
                        /></label>
                        <div class="hint">
                            Sprites and other background objects are tinted with this colour.
                        </div>
                    </div>
                </fieldset>
                <hr />
                <div class="actions">
                    <MyButton @click="apply">Apply</MyButton>
                    <MyButton @click="applyAndRender">Apply and render</MyButton>
                </div>
            </form>
        </div>
        <ImagePasteBin @paste="draft.sky = $event" />
    </WindowFrame>
</template>

<style scoped>
.ambiance {
    padding: 1em;
    font-family: monospace;
}

.sky img {
    max-height: 20em;
    max-width: 100%;
    border: solid 0.2em black;
}

.actions {
    display: flex;
    gap: 0.5em;
    align-items: center;
}

.hint {
    color: #555;
}
</style>
