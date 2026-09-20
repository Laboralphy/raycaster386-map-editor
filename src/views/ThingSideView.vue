<script setup lang="ts">
import { mdiDelete } from '@mdi/js';
import { computed } from 'vue';
import MyButton from '../components/MyButton.vue';
import SvgIcon from '../components/SvgIcon.vue';
import ThingSwatch from '../components/ThingSwatch.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { missingTileImage } from '../libs/missingTile';
import { useEditorStore } from '../stores/editor';
import { useHistoryStore } from '../stores/history';
import { useLevelStore } from '../stores/level';

/**
 * The thing standing on the cell you clicked.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/ThingView.vue`. The grid puts a
 * thing here when you click one on the map; this shows what it is and lets you
 * take it off again.
 */

const level = useLevelStore();
const editor = useEditorStore();
const history = useHistoryStore();

const placed = computed(() => {
    const at = editor.selectedThing;
    if (!at) {
        return null;
    }
    const entry = level.thingAt(at.xc, at.yc, at.xt, at.yt);
    if (!entry) {
        return null;
    }
    const template = level.findThing(entry.id);
    const tile = template ? level.findTile(template.tile) : undefined;
    return {
        at,
        template,
        content: tile?.content ?? missingTileImage(),
        missingTile: !!template && !tile,
    };
});

function remove(): void {
    const current = placed.value;
    if (!current) {
        return;
    }
    const { xc, yc, xt, yt } = current.at;
    history.transact('remove thing', { cells: [{ x: xc, y: yc }] }, () => {
        level.removeCellThing(xc, yc, xt, yt);
    });
    editor.selectedThing = null;
    editor.dirty = true;
    // Both the thing and its selection highlight have gone from the cell.
    editor.requestRepaint();
    editor.setStatus(`Thing removed from ${xc},${yc}`);
}
</script>

<template>
    <WindowFrame caption="Thing">
        <div class="thing-view">
            <p v-if="!placed" class="hint">Click a thing on the map to see it here</p>

            <template v-else>
                <ThingSwatch :content="placed.content" :selected="true" />
                <p v-if="placed.missingTile" class="warning">
                    This thing's sprite tile is missing from the level.
                </p>

                <dl v-if="placed.template">
                    <dt>Id</dt>
                    <dd>#{{ placed.template.id }}</dd>
                    <dt>Ref</dt>
                    <dd>{{ placed.template.ref || '—' }}</dd>
                    <dt>Cell</dt>
                    <dd>
                        {{ placed.at.xc }}, {{ placed.at.yc }} ({{ placed.at.xt }}:{{
                            placed.at.yt
                        }})
                    </dd>
                    <dt>Opacity</dt>
                    <dd>{{ [100, 75, 50, 25][placed.template.opacity] ?? '?' }}%</dd>
                    <dt>Obstacle</dt>
                    <dd>
                        {{ placed.template.tangible ? `yes, size ${placed.template.size}` : 'no' }}
                    </dd>
                    <dt>Ghost</dt>
                    <dd>{{ placed.template.ghost ? 'yes' : 'no' }}</dd>
                    <dt>Light</dt>
                    <dd>
                        {{
                            placed.template.light.enabled
                                ? `${placed.template.light.value} (${placed.template.light.inner} to ${placed.template.light.outer})`
                                : 'no'
                        }}
                    </dd>
                </dl>
                <p v-else class="warning">
                    This cell holds a thing whose template no longer exists.
                </p>

                <MyButton title="Remove this thing from the map" @click="remove">
                    <SvgIcon :path="mdiDelete" /> Remove from map
                </MyButton>
            </template>
        </div>
    </WindowFrame>
</template>

<style scoped>
.thing-view {
    padding: 0.5em;
    font-family: monospace;
}

dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.2em 0.8em;
}

dt {
    font-weight: bold;
}

dd {
    margin: 0;
}

.warning {
    color: darkred;
    font-weight: bold;
}
</style>
