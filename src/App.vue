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
/* The side panel widens with the viewport, on the same breakpoints that scale
   the root font size. Ported from the old Application.vue. */
@media only screen and (max-width: 600px) {
    table.o876structure > tbody > tr > td.side-panel {
        width: 240px;
    }
}
@media only screen and (min-width: 600px) {
    table.o876structure > tbody > tr > td.side-panel {
        width: 280px;
    }
}
@media only screen and (min-width: 768px) {
    table.o876structure > tbody > tr > td.side-panel {
        width: 320px;
    }
}
@media only screen and (min-width: 992px) {
    table.o876structure > tbody > tr > td.side-panel {
        width: 360px;
    }
}
@media only screen and (min-width: 1200px) {
    table.o876structure > tbody > tr > td.side-panel {
        width: 420px;
    }
}
</style>
