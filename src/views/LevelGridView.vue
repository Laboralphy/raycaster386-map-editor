<script setup lang="ts">
import {
    mdiArrowCollapse,
    mdiArrowDownBold,
    mdiArrowExpand,
    mdiArrowUpBold,
    mdiClose,
    mdiContentCopy,
    mdiContentPaste,
    mdiContentSave,
    mdiCursorDefault,
    mdiMagnifyMinus,
    mdiMagnifyPlus,
    mdiPencil,
    mdiRedo,
    mdiUndo,
} from '@mdi/js';
import { computed, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MyButton from '../components/MyButton.vue';
import SiblingButton from '../components/SiblingButton.vue';
import SiblingGroup from '../components/SiblingGroup.vue';
import SvgIcon from '../components/SvgIcon.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { useBlockCache } from '../composables/useBlockCache';
import { useGridPaint } from '../composables/useGridPaint';
import { useGridSelection, type Cell } from '../composables/useGridSelection';
import { useGridTools } from '../composables/useGridTools';
import { blockCache } from '../libs/blockCache';
import { CellOverlayFactory } from '../libs/cellOverlay';
import { GridRenderer } from '../libs/gridRenderer';
import { useEditorStore } from '../stores/editor';
import { useHistoryStore } from '../stores/history';
import { useLevelStore } from '../stores/level';

/**
 * The level grid — the screen people actually use.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/LevelGrid.vue`, 1,159 lines of
 * which 967 were script. The work is split out: `useGridPaint` draws a cell,
 * `useGridSelection` turns drags into a rectangle, `useGridTools` does what the
 * toolbar buttons do. What is left here is the wiring.
 *
 * The same component serves five routes — blocks, things, tags, marks and
 * utilities — and what a click does depends on which. That was true of the
 * original too; the difference is that `mode` says so in one place instead of a
 * switch buried in the mouse handler.
 */

const route = useRoute();
const router = useRouter();
const level = useLevelStore();
const editor = useEditorStore();
const history = useHistoryStore();

const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const renderer = new GridRenderer();
const overlay = new CellOverlayFactory();

const { paintCell } = useGridPaint(blockCache, overlay);

/** Cells awaiting repaint, keyed to keep them unique. */
const dirty = new Map<string, Cell>();
let fullRedraw = true;

function invalidate(cells: readonly Cell[]): void {
    for (const cell of cells) {
        dirty.set(`${cell.x},${cell.y}`, cell);
    }
}

function invalidateAll(): void {
    fullRedraw = true;
}

function redraw(): void {
    const target = canvas.value;
    if (!target) {
        return;
    }
    overlay.setSize(renderer.cellSize, renderer.cellSize);
    const cells = fullRedraw ? undefined : [...dirty.values()];
    dirty.clear();
    fullRedraw = false;
    renderer.render(target, level.gridSize, paintCell, cells);
}

const selection = useGridSelection(() => renderer.cellSize, invalidate);
const tools = useGridTools(invalidate);
/*
 * Block previews are data URLs, and decoding one is asynchronous — so the grid
 * is first painted before a single thumbnail exists, and every cell comes out
 * as the red "no block here" dot. The cache reports once, when they have all
 * decoded, and this has to *repaint* on that: marking the grid stale without
 * drawing it left the level looking empty until some other event — a click —
 * happened to call `redraw()`.
 */
useBlockCache(blockCache, () => {
    invalidateAll();
    redraw();
});

/** What the grid edits, from the route it is mounted on. */
const mode = computed(() => {
    switch (route.path) {
        case '/level/things':
        case '/view-thing':
            return 'thing';
        case '/level/tags':
            return 'tag';
        case '/level/marks':
            return 'mark';
        case '/level/utilpanel':
            return 'util';
        default:
            return 'block';
    }
});

const canDraw = computed(() => mode.value === 'block' || mode.value === 'thing');
const canvasPixels = computed(() => renderer.canvasSize(level.gridSize));

/** Which third of a cell a click landed in, for placing things. */
function subCell(event: MouseEvent): { x: number; y: number; xt: number; yt: number } {
    const size = renderer.cellSize;
    const third = Math.floor(size / 3);
    const withinX = event.offsetX % size;
    const withinY = event.offsetY % size;
    const pick = (v: number) => (v > size - third ? 2 : v > third ? 1 : 0);
    return {
        x: Math.floor(event.offsetX / size),
        y: Math.floor(event.offsetY / size),
        xt: pick(withinX),
        yt: pick(withinY),
    };
}

function onMouseDown(event: MouseEvent): void {
    selection.onMouseDown(event);
    redraw();
}

function onMouseMove(event: MouseEvent): void {
    if (!selection.dragging.value) {
        return;
    }
    selection.onMouseMove(event);
    redraw();
}

/**
 * Picks the thing under the mouse and shows it in the thing panel.
 *
 * @returns false when there is no thing there
 */
function pickThing(x: number, y: number, xt: number, yt: number): boolean {
    if (!level.thingAt(x, y, xt, yt)) {
        return false;
    }
    editor.selectedThing = { xc: x, yc: y, xt, yt };
    void router.push('/view-thing');
    return true;
}

function onMouseUp(event: MouseEvent): void {
    selection.onMouseUp();
    if (editor.selectedTool !== 1) {
        // The select tool picks a thing only on a plain click: a drag across
        // cells is still a region selection, whatever it started on.
        const r = editor.selectedRegion;
        const clicked = r.x1 === r.x2 && r.y1 === r.y2;
        if (mode.value === 'thing' && clicked) {
            const { x, y, xt, yt } = subCell(event);
            if (pickThing(x, y, xt, yt)) {
                editor.clearRegion();
                invalidateAll();
                redraw();
            }
        }
        return;
    }
    if (mode.value === 'block') {
        tools.paintSelection();
    } else if (mode.value === 'thing') {
        const { x, y, xt, yt } = subCell(event);
        if (!pickThing(x, y, xt, yt)) {
            tools.placeThing(x, y, xt, yt);
        }
    }
    editor.clearRegion();
    invalidateAll();
    redraw();
}

function zoom(inwards: boolean): void {
    if (inwards ? renderer.zoomIn() : renderer.zoomOut()) {
        invalidateAll();
        redraw();
    }
}

function resize(by: number): void {
    const size = level.gridSize;
    // Past 40 cells a one-at-a-time button is useless, so ask for a number —
    // as the original did.
    const next =
        size > 40 ? Number(prompt('Enter the new grid size (1 to 256)', String(size))) : size + by;
    if (!Number.isFinite(next) || next < 1 || next > 256) {
        return;
    }
    tools.resizeGrid(next);
    invalidateAll();
    redraw();
}

async function save(): Promise<void> {
    const name = prompt('Save the level as:', editor.levelName);
    if (name === null || name === '') {
        return;
    }
    try {
        await level.saveToVault(name);
        editor.levelName = name;
        editor.dirty = false;
        editor.setStatus(`Level saved : ${name}`);
    } catch (e) {
        editor.setStatus(`Level NOT saved : ${(e as Error).message}`);
        editor.showPopup((e as Error).message, 'error');
    }
}

function onKeyDown(event: KeyboardEvent): void {
    const active = document.activeElement;
    const tag = active?.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
    }
    const key = (event.ctrlKey ? 'ctrl-' : '') + event.key.toLowerCase();
    const handlers: Record<string, () => void> = {
        'ctrl-c': tools.copySelection,
        'ctrl-v': () => {
            tools.pasteSelection();
            redraw();
        },
        'ctrl-z': () => {
            tools.undo();
            invalidateAll();
            redraw();
        },
        'ctrl-y': () => {
            tools.redo();
            invalidateAll();
            redraw();
        },
        delete: () => {
            tools.clearSelection();
            redraw();
        },
    };
    const handler = handlers[key];
    if (handler) {
        event.preventDefault();
        handler();
    }
}

// A repaint is needed whenever what a cell looks like changes, not only when
// the document does: the storey being edited and the selection both change it.
watch(
    () => [level.gridSize, editor.selectedFloor, mode.value],
    () => {
        invalidateAll();
        redraw();
    }
);

watch(
    () => route.path,
    () => {
        editor.clearRegion();
        invalidateAll();
        redraw();
    }
);

// The side panels edit the document but cannot reach this component, so they
// ask for a repaint through the store instead. Without it, a change made from
// a panel — removing a thing, tagging a selection, shifting the map — only
// appeared the next time something else happened to redraw the grid.
watch(
    () => editor.repaintRequest,
    () => {
        invalidateAll();
        redraw();
    }
);

onMounted(() => {
    document.addEventListener('keydown', onKeyDown);
    invalidateAll();
    redraw();
});

onBeforeUnmount(() => document.removeEventListener('keydown', onKeyDown));
</script>

<template>
    <WindowFrame caption="Level grid">
        <template #toolbar>
            <MyButton title="Save level" @click="save"><SvgIcon :path="mdiContentSave" /></MyButton>
            <MyButton title="Open level" @click="router.push('/list-levels')">
                <SvgIcon :path="mdiContentPaste" />
            </MyButton>

            <MyButton title="Decrease grid size" @click="resize(-1)">
                <SvgIcon :path="mdiArrowCollapse" />
            </MyButton>
            <MyButton title="Increase grid size" @click="resize(1)">
                <SvgIcon :path="mdiArrowExpand" />
            </MyButton>

            <MyButton title="Zoom out" @click="zoom(false)">
                <SvgIcon :path="mdiMagnifyMinus" />
            </MyButton>
            <MyButton title="Zoom in" @click="zoom(true)">
                <SvgIcon :path="mdiMagnifyPlus" />
            </MyButton>

            <SiblingGroup v-model="editor.selectedTool">
                <SiblingButton title="Select tool"
                    ><SvgIcon :path="mdiCursorDefault"
                /></SiblingButton>
                <SiblingButton title="Draw tool" :disabled="!canDraw">
                    <SvgIcon :path="mdiPencil" />
                </SiblingButton>
            </SiblingGroup>

            <SiblingGroup v-model="editor.selectedFloor">
                <SiblingButton title="Lower floor"
                    ><SvgIcon :path="mdiArrowDownBold"
                /></SiblingButton>
                <SiblingButton title="Upper floor"
                    ><SvgIcon :path="mdiArrowUpBold"
                /></SiblingButton>
            </SiblingGroup>

            <MyButton
                :title="history.canUndo ? `Undo ${history.undoLabel}` : 'Undo'"
                :disabled="!history.canUndo"
                @click="
                    tools.undo();
                    invalidateAll();
                    redraw();
                "
            >
                <SvgIcon :path="mdiUndo" />
            </MyButton>
            <MyButton
                :title="history.canRedo ? `Redo ${history.redoLabel}` : 'Redo'"
                :disabled="!history.canRedo"
                @click="
                    tools.redo();
                    invalidateAll();
                    redraw();
                "
            >
                <SvgIcon :path="mdiRedo" />
            </MyButton>

            <MyButton title="Copy" :disabled="!editor.hasRegion" @click="tools.copySelection()">
                <SvgIcon :path="mdiContentCopy" />
            </MyButton>
            <MyButton
                title="Paste"
                :disabled="tools.clipboard.value === null || !editor.hasRegion"
                @click="
                    tools.pasteSelection();
                    redraw();
                "
            >
                <SvgIcon :path="mdiContentPaste" />
            </MyButton>
            <MyButton
                title="Clear"
                :disabled="!editor.hasRegion"
                @click="
                    tools.clearSelection();
                    redraw();
                "
            >
                <SvgIcon :path="mdiClose" />
            </MyButton>

            <span class="coords">
                {{
                    editor.hasRegion
                        ? `(${editor.region.x1}:${editor.region.y1}) - (${editor.region.x2}:${editor.region.y2})`
                        : ''
                }}
            </span>
        </template>

        <div class="scrollzone">
            <canvas
                ref="canvas"
                :width="canvasPixels"
                :height="canvasPixels"
                @mousedown="onMouseDown"
                @mousemove="onMouseMove"
                @mouseup="onMouseUp"
            ></canvas>
        </div>
    </WindowFrame>
</template>

<style scoped>
.scrollzone {
    overflow: auto;
    max-width: 100%;
}

canvas {
    display: block;
    cursor: crosshair;
}

.coords {
    font-family: monospace;
    margin-left: 0.5em;
}
</style>
