<script setup lang="ts">
import { mdiAnimation, mdiDelete } from '@mdi/js';
import { createTileAnimation } from '@laboralphy/raycaster386';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MyButton from '../components/MyButton.vue';
import SvgIcon from '../components/SvgIcon.vue';
import TileCell from '../components/TileCell.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { LOOP_TABLE } from '../domain/reference';
import { useEditorStore } from '../stores/editor';
import { useLevelStore } from '../stores/level';

/**
 * Turning a run of consecutive tiles into an animation.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/AnimationBuilder.vue`. An animation
 * is declared on its first tile and consumes the `frames` tiles that follow it
 * in the same group — position, not ids — which is why the tile browser hides
 * the followers and why reordering tiles is the one thing that can silently
 * redefine an animation.
 *
 * The preview runs on the engine's own `TileAnimation`, so what you see here
 * advances exactly as it will in the game.
 */

const level = useLevelStore();
const editor = useEditorStore();

const tileId = ref(0);
const frames = ref(2);
const duration = ref(120);
const loop = ref(1);
const saved = ref(false);
const frameIndex = ref(0);

const cursor = createTileAnimation();
let timer: ReturnType<typeof setInterval> | undefined;

/** How often the preview steps, and the unit `duration` is measured in. */
const TICK_MS = 40;

const tile = computed(() => level.findTile(tileId.value));
const hasAnimation = computed(() => !!tile.value?.animation);
const isValid = computed(() => !!tile.value && duration.value > 0 && frames.value > 1);

/** The whole group, unfiltered — an animation indexes into it by position. */
const groupFrames = computed(() => (tile.value ? level.allTiles(tile.value.type) : []));

const size = computed(() => {
    const t = tile.value;
    if (!t) {
        return { width: level.tileWidth, height: level.tileHeight };
    }
    switch (t.type) {
        case 'wall':
            return { width: level.tileWidth, height: level.tileHeight };
        case 'flat':
            return { width: level.tileWidth, height: level.tileWidth };
        default:
            return {
                width: Math.max(level.tileWidth, t.width),
                height: Math.max(level.tileWidth, t.height),
            };
    }
});

/** The frame the preview is showing, or the dropped tile when it cannot run. */
const preview = computed(() => {
    const t = tile.value;
    if (!t) {
        return '';
    }
    if (!isValid.value) {
        return t.content;
    }
    const first = groupFrames.value.findIndex((f) => f.id === t.id);
    const at = first + frameIndex.value;
    const frame = at < groupFrames.value.length ? groupFrames.value[at] : groupFrames.value.at(-1);
    return frame?.content ?? t.content;
});

function restartCursor(): void {
    cursor.count = Math.max(frames.value, 1);
    cursor.duration = Math.max(duration.value, 1);
    cursor.loop = loop.value as 0 | 1 | 2;
    cursor.reset();
    frameIndex.value = 0;
}

watch([frames, duration, loop], () => {
    saved.value = false;
    restartCursor();
});

/** Dropping a tile loads its animation, or sensible defaults if it has none. */
function onDrop(incoming: number): void {
    const dropped = level.findTile(incoming);
    if (!dropped) {
        return;
    }
    tileId.value = incoming;
    saved.value = false;
    if (dropped.animation) {
        frames.value = dropped.animation.frames;
        duration.value = dropped.animation.duration;
        loop.value = dropped.animation.loop;
    } else {
        frames.value = 2;
        duration.value = level.doc.time.interval * 2;
        loop.value = 0;
    }
    restartCursor();
}

function apply(): void {
    if (!tile.value) {
        return;
    }
    level.setTileAnimation(tileId.value, {
        frames: Number(frames.value),
        duration: Number(duration.value),
        loop: Number(loop.value),
    });
    saved.value = true;
    editor.dirty = true;
    editor.setStatus(`Animation set on tile #${tileId.value}`);
}

function remove(): void {
    // The old Delete button never worked: its action sent `{tile}` while the
    // mutation read `{idTile}`, so the lookup always failed and it threw.
    level.clearTileAnimation(tileId.value);
    saved.value = false;
    editor.dirty = true;
    editor.setStatus(`Animation cleared on tile #${tileId.value}`);
}

onMounted(() => {
    restartCursor();
    timer = setInterval(() => {
        if (isValid.value) {
            cursor.animate(TICK_MS);
            frameIndex.value = cursor.frame();
        }
    }, TICK_MS);
});

onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
    <WindowFrame caption="Animation builder">
        <div class="builder">
            <section>
                <h3>Animation properties</h3>
                <form @submit.prevent>
                    <div>
                        <label
                            >Frames: <input v-model.number="frames" type="number" min="2"
                        /></label>
                    </div>
                    <div>
                        <label>
                            Duration:
                            <input
                                v-model.number="duration"
                                type="number"
                                :min="level.doc.time.interval"
                                :step="level.doc.time.interval"
                            />
                        </label>
                    </div>
                    <ul>
                        <li v-for="entry in LOOP_TABLE" :key="entry.id">
                            <label>
                                <input v-model.number="loop" :value="entry.id" type="radio" />
                                {{ entry.label }}
                                <span class="hint">{{ entry.desc }}</span>
                            </label>
                        </li>
                    </ul>
                </form>
            </section>

            <section>
                <h3>Drag a wall, flat or sprite tile here</h3>
                <TileCell
                    :tile="tileId"
                    :content="preview"
                    :width="size.width"
                    :height="size.height"
                    :selectable="false"
                    :draggable="false"
                    :dropzone="true"
                    @drop="onDrop"
                />
                <p v-if="!tile" class="hint">nothing dropped yet</p>
                <p v-else-if="!isValid" class="hint">needs at least 2 frames and a duration</p>
            </section>
        </div>

        <div class="actions">
            <MyButton :disabled="!isValid || saved" @click="apply">
                <SvgIcon :path="mdiAnimation" /> Apply
            </MyButton>
            <MyButton :disabled="!hasAnimation" @click="remove">
                <SvgIcon :path="mdiDelete" /> Delete
            </MyButton>
        </div>
    </WindowFrame>
</template>

<style scoped>
.builder {
    display: flex;
    gap: 2em;
    padding: 1em;
    font-family: monospace;
}

.actions {
    padding: 0 1em 1em;
    display: flex;
    gap: 0.5em;
}

ul {
    list-style: none;
    padding-left: 0;
}
</style>
