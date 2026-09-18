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
     * Which tile group the browser is showing.
     *
     * It lives here rather than in the browser component because the tile
     * loader reads it too — what you import depends on which tab you are on.
     */
    const tileBrowserType = ref<TileType>('wall');

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
        tileBrowserType,
        popup,
        popupTitle,
        setStatus,
        showPopup,
        hidePopup,
        refreshLevelList,
    };
});
