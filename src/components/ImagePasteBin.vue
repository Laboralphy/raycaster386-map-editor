<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

/**
 * Ctrl-V anywhere on the page imports the clipboard's image.
 *
 * The old `ImagePasteBin.vue` did this with a hidden `contenteditable` div, a
 * `keydown` watcher tracking whether Ctrl was held, a focus steal on `v`, and a
 * `MutationObserver` reading the `<img>` the browser dropped into it — 149
 * lines of workaround for browsers that had no clipboard API.
 *
 * The `paste` event carries the image directly, so all of that reduces to this.
 * Same behaviour, including staying out of the way while someone is typing in
 * a field.
 */
const emit = defineEmits<{ paste: [string] }>();

function isTyping(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) {
        return false;
    }
    const tag = element.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || element.isContentEditable;
}

function onPaste(event: ClipboardEvent): void {
    if (isTyping(event.target)) {
        return;
    }
    const item = [...(event.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (!file) {
        return;
    }
    event.preventDefault();
    const reader = new FileReader();
    reader.addEventListener('load', () => emit('paste', String(reader.result)));
    reader.readAsDataURL(file);
}

onMounted(() => document.addEventListener('paste', onPaste));
onBeforeUnmount(() => document.removeEventListener('paste', onPaste));
</script>

<template><span class="paste-bin" aria-hidden="true"></span></template>

<style scoped>
.paste-bin {
    display: none;
}
</style>
