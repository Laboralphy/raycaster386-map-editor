<script setup lang="ts">
import { useTemplateRef } from 'vue';
import MyButton from './MyButton.vue';

/**
 * A button that opens a file picker and hands back data URLs.
 *
 * Ported from `_OLD_MAPEDIT_/src/components/ImageLoader.vue`. The old one
 * passed the literal string `"title"` to its button instead of the prop, so
 * every import button had the same tooltip.
 */
withDefaults(defineProps<{ title?: string; multiple?: boolean }>(), {
    title: undefined,
    multiple: false,
});

const emit = defineEmits<{ load: [string] }>();

const input = useTemplateRef<HTMLInputElement>('input');

function pick(): void {
    const element = input.value;
    if (element) {
        // Cleared first, so choosing the same file twice still fires `change`.
        element.value = '';
        element.click();
    }
}

function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(String(reader.result)));
        // The old version attached no error listener, so an unreadable file
        // left the importer waiting forever.
        reader.addEventListener('error', () => reject(new Error(`could not read ${file.name}`)));
        reader.readAsDataURL(file);
    });
}

async function onChange(event: Event): Promise<void> {
    const files = (event.target as HTMLInputElement).files;
    if (!files) {
        return;
    }
    for (const src of await Promise.all([...files].map(readAsDataUrl))) {
        emit('load', src);
    }
}
</script>

<template>
    <div class="image-loader">
        <input
            ref="input"
            type="file"
            accept="image/png, image/jpeg, image/gif"
            :multiple="multiple"
            @change="onChange"
        />
        <MyButton :title="title" @click="pick"><slot></slot></MyButton>
    </div>
</template>

<style scoped>
.image-loader {
    display: inline;
}

input[type='file'] {
    visibility: hidden;
    position: absolute;
    top: -50px;
    left: -50px;
}
</style>
