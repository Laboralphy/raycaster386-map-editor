<script setup lang="ts">
import { mdiDelete, mdiPencil, mdiPlus } from '@mdi/js';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import MyButton from '../components/MyButton.vue';
import SvgIcon from '../components/SvgIcon.vue';
import ThingSwatch from '../components/ThingSwatch.vue';
import WindowFrame from '../components/WindowFrame.vue';
import { missingTileImage } from '../libs/missingTile';
import { useEditorStore } from '../stores/editor';
import { useLevelStore } from '../stores/level';

/**
 * The thing palette, ported from
 * `_OLD_MAPEDIT_/src/components/ThingBrowser.vue`.
 *
 * A thing whose sprite tile has gone shows a crossed-out placeholder rather
 * than a broken image — the old version did the same, having first tried
 * throwing, which took the whole panel down with it.
 *
 * The old file also carried a `setTileSelection` method that reached for
 * `this.$refs.tiles.$children` — there is no `ref="tiles"` in its template, and
 * the body referenced an undeclared variable. It was dead on arrival and is not
 * carried over.
 */

const router = useRouter();
const level = useLevelStore();
const editor = useEditorStore();

const entries = computed(() =>
    level.doc.things.map((thing) => {
        const tile = level.findTile(thing.tile);
        return {
            id: thing.id,
            ref: thing.ref,
            content: tile?.content ?? missingTileImage(),
            missing: !tile,
        };
    })
);

function pick(id: number): void {
    editor.thingBrowserSelected = editor.thingBrowserSelected === id ? null : id;
}

function remove(): void {
    const id = editor.thingBrowserSelected;
    if (id === null || !confirm('Delete this thing template ?')) {
        return;
    }
    level.deleteThing(id);
    editor.thingBrowserSelected = null;
    editor.dirty = true;
    editor.setStatus(`Thing #${id} deleted, and removed from the map`);
}
</script>

<template>
    <WindowFrame :caption="`Thing browser - ${entries.length} thing(s)`">
        <template #toolbar>
            <MyButton title="Create a new thing template" @click="router.push('/build-thing/0')">
                <SvgIcon :path="mdiPlus" />
            </MyButton>
            <MyButton
                :disabled="editor.thingBrowserSelected === null"
                title="Modify the selected thing template"
                @click="router.push(`/build-thing/${editor.thingBrowserSelected}`)"
            >
                <SvgIcon :path="mdiPencil" />
            </MyButton>
            <MyButton
                :disabled="editor.thingBrowserSelected === null"
                title="Delete the selected thing template"
                @click="remove"
            >
                <SvgIcon :path="mdiDelete" />
            </MyButton>
        </template>
        <div>
            <p v-if="entries.length === 0" class="hint" style="margin: 1em">
                No things yet — create one once some sprite tiles are imported
            </p>
            <ThingSwatch
                v-for="entry in entries"
                :key="entry.id"
                :content="entry.content"
                :selected="entry.id === editor.thingBrowserSelected"
                :title="entry.missing ? 'this thing’s sprite tile is missing' : entry.ref"
                @click="pick(entry.id)"
            />
        </div>
    </WindowFrame>
</template>
