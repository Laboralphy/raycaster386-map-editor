import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { VaultLevelSummary } from '../../shared/api';
import type { TileType } from '../domain/types';
import * as vault from '../services/vaultClient';

/**
 * Everything the editor knows that is not part of the document.
 *
 * The split matters: `stores/level.ts` holds exactly what gets saved, and this
 * holds what does not — which level is open, what the status bar says, what is
 * selected. The old editor made the same split across two Vuex modules.
 *
 * The static `phys` and `loops` tables that lived in the old `editor` module's
 * state are in `src/domain/reference.ts` instead: nothing mutates them, so they
 * are constants, not state.
 */

export type PopupType = 'simple' | 'progress' | 'error';

export const useEditorStore = defineStore('editor', () => {
    /** The name the open level was loaded from, or saved as. */
    const levelName = ref('');
    const levelList = ref<VaultLevelSummary[]>([]);
    const statusBar = ref('');
    const busy = ref(false);
    /** Set when the document has changed since it was last saved. */
    const dirty = ref(false);

    /**
     * The level as the preview last compiled it, or null.
     *
     * Not part of the document — it is derived from it, and large — but it
     * outlives the render screen so the side panel beside it can offer it as a
     * download. The old editor kept it in the same place, as the `editor`
     * module's `levelGeneratedData`.
     */
    const generatedLevel = ref<Record<string, unknown> | null>(null);

    /**
     * Which tile group the browser is showing.
     *
     * It lives here rather than in the browser component because the tile
     * loader reads it too — what you import depends on which tab you are on.
     */
    const tileBrowserType = ref<TileType>('wall');

    /** The block the browser has selected, and the grid would paint with. */
    const blockBrowserSelected = ref<number | null>(null);
    /** The thing template the browser has selected. */
    const thingBrowserSelected = ref<number | null>(null);

    /**
     * The rectangle selected on the grid. `x1 < 0` means nothing is selected.
     *
     * Kept here rather than in the grid because the tag, mark and utility
     * panels all act on it — the grid draws it, they read it.
     */
    const selectedRegion = ref({ x1: -1, y1: -1, x2: -1, y2: -1 });
    /** 0 selects, 1 draws. */
    const selectedTool = ref(0);
    /** 0 is the ground floor, 1 the upper storey. */
    const selectedFloor = ref(0);
    /** The thing the grid last picked, for the thing panel to show. */
    const selectedThing = ref<{ xc: number; yc: number; xt: number; yt: number } | null>(null);

    const hasRegion = computed(() => selectedRegion.value.x1 >= 0);

    /** The selection, with its corners in order. */
    const region = computed(() => {
        const r = selectedRegion.value;
        return {
            x1: Math.min(r.x1, r.x2),
            y1: Math.min(r.y1, r.y2),
            x2: Math.max(r.x1, r.x2),
            y2: Math.max(r.y1, r.y2),
        };
    });

    /** Every cell of the current selection, or nothing when there is none. */
    function regionCells(): { x: number; y: number }[] {
        if (!hasRegion.value) {
            return [];
        }
        const r = region.value;
        const cells: { x: number; y: number }[] = [];
        for (let y = r.y1; y <= r.y2; ++y) {
            for (let x = r.x1; x <= r.x2; ++x) {
                cells.push({ x, y });
            }
        }
        return cells;
    }

    function clearRegion(): void {
        selectedRegion.value = { x1: -1, y1: -1, x2: -1, y2: -1 };
    }

    /**
     * Bumped when something outside the grid changes what a cell looks like.
     *
     * The grid repaints in response to its own mouse and keyboard handlers, and
     * to the two things it watches — so a side panel editing the document had
     * no way to reach it, and its change stayed invisible until something else
     * happened to trigger a redraw. Removing a thing looked like it had done
     * nothing at all.
     *
     * A counter rather than a flag, so two edits to the same cell are two
     * signals. It carries no cell list on purpose: panel edits are user-paced
     * rather than per-frame, the grid already repaints in full on a floor or
     * route change, and naming cells here would invite the same silent
     * half-failure that getting a `history.transact` scope wrong does.
     */
    const repaintRequest = ref(0);

    /** Asks the grid to repaint. Call after changing what a cell looks like. */
    function requestRepaint(): void {
        repaintRequest.value += 1;
    }

    /**
     * Forgets everything that referred to the document being replaced.
     *
     * Every one of these holds a reference into the *old* level — a block id, a
     * cell, a rectangle, a compiled copy — and all of them are meaningless
     * against a different one. A stale `blockBrowserSelected` is the sharp
     * edge: it is the id the grid paints with, so left alone it would fill
     * cells of the new level with a block that does not exist in it.
     *
     * The undo stack is the caller's to reset, because it lives in its own
     * store; `tileBrowserType` and `selectedTool` are deliberately kept, being
     * preferences about the editor rather than facts about the level.
     *
     * @param name what the new document is called, or '' for an unsaved one
     */
    function resetForLevel(name: string): void {
        levelName.value = name;
        dirty.value = false;
        clearRegion();
        blockBrowserSelected.value = null;
        thingBrowserSelected.value = null;
        selectedThing.value = null;
        selectedFloor.value = 0;
        generatedLevel.value = null;
    }

    const popup = ref<{
        visible: boolean;
        type: PopupType;
        content: string;
        progress: number;
    }>({ visible: false, type: 'simple', content: '', progress: 0 });

    const popupTitle = computed(() => {
        switch (popup.value.type) {
            case 'progress':
                return 'Progress';
            case 'error':
                return 'Error';
            default:
                return 'Information';
        }
    });

    function setStatus(text: string): void {
        statusBar.value = text;
    }

    function showPopup(content: string, type: PopupType = 'simple'): void {
        popup.value = { visible: true, type, content, progress: 0 };
    }

    function hidePopup(): void {
        popup.value.visible = false;
    }

    async function refreshLevelList(): Promise<void> {
        busy.value = true;
        try {
            levelList.value = await vault.listLevels();
        } catch (e) {
            setStatus(`Could not list levels: ${(e as Error).message}`);
            showPopup((e as Error).message, 'error');
        } finally {
            busy.value = false;
        }
    }

    return {
        levelName,
        levelList,
        statusBar,
        busy,
        dirty,
        generatedLevel,
        tileBrowserType,
        blockBrowserSelected,
        thingBrowserSelected,
        selectedRegion,
        selectedTool,
        selectedFloor,
        selectedThing,
        hasRegion,
        region,
        regionCells,
        clearRegion,
        repaintRequest,
        requestRepaint,
        resetForLevel,
        popup,
        popupTitle,
        setStatus,
        showPopup,
        hidePopup,
        refreshLevelList,
    };
});
