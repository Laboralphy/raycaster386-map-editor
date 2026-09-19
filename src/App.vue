<script setup lang="ts">
import MainMenu from './components/MainMenu.vue';
import PopupBox from './components/PopupBox.vue';
import StatusBar from './components/StatusBar.vue';
import FlashyText from './components/FlashyText.vue';
import { useEditorStore } from './stores/editor';

/**
 * The shell, ported from `_OLD_MAPEDIT_/src/components/Application.vue`.
 *
 * Two named router views side by side — the screen and its panel — which is
 * why every route declares both. The table layout is the original's; see
 * `styles/structure.css`.
 */
const editor = useEditorStore();
</script>

<template>
    <div class="o876structure">
        <table class="o876structure">
            <tbody>
                <tr>
                    <td colspan="2"><MainMenu /></td>
                </tr>
                <tr class="floatingHeight">
                    <td class="floatingWidth">
                        <div><RouterView /></div>
                    </td>
                    <td class="side-panel">
                        <div><RouterView name="side" /></div>
                    </td>
                </tr>
                <tr>
                    <td colspan="2">
                        <StatusBar><FlashyText /></StatusBar>
                    </td>
                </tr>
            </tbody>
        </table>
        <PopupBox
            v-if="editor.popup.visible"
            :title="editor.popupTitle"
            :type="editor.popup.type"
            :progress="editor.popup.progress"
            @click="editor.hidePopup()"
        >
            {{ editor.popup.content }}
        </PopupBox>
    </div>
</template>

<style scoped>
/*
 * The side panel, in `em`, so it tracks the root font size like everything
 * else. It was a ladder of five pixel widths on the same breakpoints that
 * scaled the root, and it stopped at 420px above 1200px — which on a 4K screen
 * left it occupying a ninth of the width instead of a third. 35em is that same
 * 420px at the 12px root a desktop used to get.
 */
table.o876structure > tbody > tr > td.side-panel {
    /*
     * The `vw` cap only binds below about 540px wide, where 35em of panel
     * would otherwise leave the level editor beside it a few dozen pixels.
     * The old ladder held it to 240px on a phone; this holds it to a share.
     */
    width: min(35em, 60vw);
}
</style>
