<script setup lang="ts">
/**
 * The frame every screen and side panel sits in.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/Window.vue`, which 22 of the 38 old
 * components imported. Renamed from `Window` because that shadows the DOM
 * global and reads badly in a `<script setup>` file.
 *
 * The old component also declared a `commands` prop that nothing ever passed;
 * it is not carried over.
 */
defineProps<{ caption?: string }>();
</script>

<template>
    <table class="o876structure o876window">
        <tbody>
            <tr class="titlebar">
                <td>
                    <div>
                        <h1>{{ caption }}</h1>
                    </div>
                </td>
            </tr>
            <tr class="toolbar">
                <td>
                    <div><slot name="toolbar"></slot></div>
                </td>
            </tr>
            <tr class="body floatingHeight">
                <td>
                    <div class="body"><slot></slot></div>
                </td>
            </tr>
        </tbody>
    </table>
</template>

<style scoped>
table.o876window {
    box-sizing: border-box;
    background-color: #ddd;
    border: solid 0.3em #666;
    padding: 0.3em;
    margin: 0;
    font-family: monospace;
    font-size: 1em;
}

table.o876window .toolbar button {
    font-size: 1em;
    height: 2.4em;
}

table.o876window h1 {
    font-size: 1.3em;
    font-family: monospace;
    text-shadow: 0.1em 0.1em 0.1em #0000cc;
    background-color: #4488ff;
    color: white;
    border: solid 0.15em #24a;
    padding: 0.15em 0.15em 0.15em 0.6em;
    margin-top: 0;
    margin-bottom: 0.15em;
}

table.o876window span.label {
    font-family: monospace;
    font-size: 0.9em;
}

table.o876window .toolbar > td > div {
    background-color: #aaa;
    border: solid thin #666;
}

table.o876window td {
    vertical-align: top;
    margin: 0;
}

table.o876window .toolbar button.selected {
    color: #07f;
    text-shadow: 0.1em 0.1em 0.1em #fff;
}
</style>
