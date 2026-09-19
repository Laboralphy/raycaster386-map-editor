<script setup lang="ts">
import { computed } from 'vue';
import MyButton from '../components/MyButton.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { useEditorStore } from '../stores/editor';

/**
 * What sits beside the preview: how to drive it, and the compiled level.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/RenderSide.vue`. The old panel
 * illustrated the controls with a screenshot of a keyboard; the keys are
 * written out instead, so they stay true when they change and can be read by
 * anything that is not looking at a picture.
 *
 * The download is the level the preview just compiled — the same RCE-100
 * document `convertMapEditLevel` produces for a real export. Publishing to a
 * game directory is phase 6; this is only a way to take what is already in
 * memory, which is also the quickest way to inspect a conversion by hand.
 */

const editor = useEditorStore();

const downloadUrl = computed(() => {
    const data = editor.generatedLevel;
    if (data === null) {
        return '';
    }
    return `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, '  '))}`;
});

const fileName = computed(() => `${editor.levelName || 'level'}.json`);
</script>

<template>
    <WindowFrame caption="Rendering options">
        <div class="render-side">
            <h3>Controls</h3>
            <table class="keys">
                <tbody>
                    <tr>
                        <th>W A S D</th>
                        <td>move and strafe</td>
                    </tr>
                    <tr>
                        <th>Z Q S D</th>
                        <td>the same, on an AZERTY keyboard</td>
                    </tr>
                    <tr>
                        <th>&larr; &rarr;</th>
                        <td>turn</td>
                    </tr>
                    <tr>
                        <th>E</th>
                        <td>open the door you are facing</td>
                    </tr>
                    <tr>
                        <th>click</th>
                        <td>capture the mouse to look around</td>
                    </tr>
                    <tr>
                        <th>Esc</th>
                        <td>release the mouse</td>
                    </tr>
                </tbody>
            </table>
            <p class="hint">
                Leaving this screen stores what you are looking at as the level's thumbnail.
            </p>
            <hr />
            <h3>Compiled level</h3>
            <p>
                The level as the engine reads it, compiled by the same converter an export runs.
                Available once the preview has loaded.
            </p>
            <MyButton :disabled="!downloadUrl" :href="downloadUrl" :download="fileName">
                Download .json
            </MyButton>
        </div>
    </WindowFrame>
</template>

<style scoped>
.render-side {
    padding: 1em;
    font-family: monospace;
}

.keys th {
    text-align: right;
    padding-right: 0.6em;
    white-space: nowrap;
    vertical-align: top;
}

.keys td {
    text-align: left;
}

.hint {
    color: #555;
}
</style>
