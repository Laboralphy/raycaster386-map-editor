<script setup lang="ts">
import { mdiCircle, mdiCloseCircle, mdiHexagon, mdiRhombus, mdiSquare, mdiTriangle } from '@mdi/js';
import { computed } from 'vue';
import DirectionalPad from '../components/DirectionalPad.vue';
import MyButton from '../components/MyButton.vue';
import SvgIcon from '../components/SvgIcon.vue';
import WindowFrame from '../components/WindowFrame.vue';
import {
    MARK_COLORS,
    SHAPE_CIRCLE,
    SHAPE_HEXAGON,
    SHAPE_NONE,
    SHAPE_RHOMBUS,
    SHAPE_SQUARE,
    SHAPE_TRIANGLE,
} from '../domain/reference';
import { useEditorStore } from '../stores/editor';
import { useHistoryStore } from '../stores/history';
import { useLevelStore } from '../stores/level';

/**
 * Marks on cells, and where the player starts.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/MarkerManager.vue`. Marks are
 * purely for the level designer — the converter drops them — so this is the one
 * panel whose output never reaches the game.
 *
 * Start points do reach it. A level can have several, and `actor.startpoint` is
 * an *index* into the list rather than an id, which is why removing one has to
 * re-point it.
 */

const level = useLevelStore();
const editor = useEditorStore();
const history = useHistoryStore();

const SHAPES = [
    { shape: SHAPE_NONE, icon: mdiCloseCircle, title: 'No mark', color: '#a00' },
    { shape: SHAPE_CIRCLE, icon: mdiCircle, title: 'Circle', color: undefined },
    { shape: SHAPE_SQUARE, icon: mdiSquare, title: 'Square', color: undefined },
    { shape: SHAPE_TRIANGLE, icon: mdiTriangle, title: 'Triangle', color: undefined },
    { shape: SHAPE_RHOMBUS, icon: mdiRhombus, title: 'Rhombus', color: undefined },
    { shape: SHAPE_HEXAGON, icon: mdiHexagon, title: 'Hexagon', color: undefined },
];

const startpointCount = computed(() => level.doc.startpoints.length);
const currentStartpoint = computed({
    get: () => level.doc.actor.startpoint,
    set: (value: number) => {
        level.setActorStartpoint(Number(value));
        editor.dirty = true;
        // The rose is drawn differently on the start point that is current, so
        // merely choosing a different one changes two cells.
        editor.requestRepaint();
    },
});

function markSelection(label: string, mark: { shape?: number; color?: string }): void {
    const cells = editor.regionCells();
    if (cells.length === 0) {
        return;
    }
    history.transact(label, { cells }, () => {
        for (const { x, y } of cells) {
            level.setCellMark(x, y, mark);
        }
    });
    editor.dirty = true;
    editor.requestRepaint();
}

/**
 * Puts the current start point on the selection's top-left cell.
 *
 * Start points live in the document, not on a cell, so the scope is the
 * `startpoints` slice — and the cell needs repainting because the grid draws
 * the compass rose over it.
 */
function placeStartpoint(angle: number): void {
    if (!editor.hasRegion) {
        return;
    }
    const { x1, y1 } = editor.region;
    const previous = level.doc.startpoints[currentStartpoint.value];
    const cells = [{ x: x1, y: y1 }];
    if (previous && previous.x >= 0) {
        cells.push({ x: previous.x, y: previous.y });
    }
    history.transact('move start point', { slices: ['startpoints'], cells }, () => {
        level.setStartpoint(currentStartpoint.value, { x: x1, y: y1, angle });
    });
    editor.dirty = true;
    editor.requestRepaint();
    editor.setStatus(`Start point #${currentStartpoint.value} at ${x1},${y1}`);
}

function addStartpoint(): void {
    history.transact('add start point', { slices: ['startpoints'] }, () => {
        level.setActorStartpoint(level.addStartpoint());
    });
    editor.dirty = true;
    editor.requestRepaint();
}

function removeStartpoint(): void {
    // The last one cannot go: a level with no start point has nowhere to begin.
    if (startpointCount.value <= 1) {
        editor.setStatus('A level needs at least one start point');
        return;
    }
    history.transact('remove start point', { slices: ['startpoints'] }, () => {
        level.removeStartpoint(currentStartpoint.value);
    });
    editor.dirty = true;
    editor.requestRepaint();
}
</script>

<template>
    <WindowFrame caption="Marker Manager">
        <div class="markers">
            <h3>Shapes</h3>
            <p class="hint">
                Select a cell or region on the map, then pick a shape. Marks are for you — the game
                never sees them.
            </p>
            <div class="row">
                <MyButton
                    v-for="s in SHAPES"
                    :key="s.shape"
                    :title="s.title"
                    :disabled="!editor.hasRegion"
                    @click="markSelection(`mark ${s.title.toLowerCase()}`, { shape: s.shape })"
                >
                    <SvgIcon :path="s.icon" :style="s.color ? `color: ${s.color}` : undefined" />
                </MyButton>
            </div>

            <hr />
            <h3>Colours</h3>
            <p class="hint">Applies to cells that already carry a mark.</p>
            <div class="row">
                <MyButton
                    v-for="colour in MARK_COLORS"
                    :key="colour"
                    :title="colour"
                    :disabled="!editor.hasRegion"
                    @click="markSelection(`mark ${colour}`, { color: colour })"
                >
                    <SvgIcon :path="mdiSquare" :style="`color: ${colour}`" />
                </MyButton>
            </div>

            <hr />
            <h3>Start point</h3>
            <p class="hint">
                Select a single cell, then click a direction to put the start point there facing
                that way.
            </p>
            <div class="startpoint">
                <DirectionalPad @select="placeStartpoint" />
                <div>
                    <label>
                        #
                        <input
                            v-model.number="currentStartpoint"
                            type="number"
                            min="0"
                            :max="startpointCount - 1"
                            step="1"
                            style="width: 5em"
                        />
                    </label>
                    <p>of {{ startpointCount }}</p>
                    <MyButton title="Add a new start point" @click="addStartpoint">Add</MyButton>
                    <MyButton
                        title="Remove the selected start point"
                        :disabled="startpointCount <= 1"
                        @click="removeStartpoint"
                    >
                        Remove
                    </MyButton>
                </div>
            </div>
        </div>
    </WindowFrame>
</template>

<style scoped>
.markers {
    padding: 0.5em;
    font-family: monospace;
}

.row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2em;
}

.startpoint {
    display: flex;
    gap: 1em;
    align-items: flex-start;
}
</style>
