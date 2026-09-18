<script setup lang="ts">
/**
 * One Material Design icon, drawn from `@mdi/js` path data.
 *
 * The old editor imported `vue-material-design-icons` — 83 component imports
 * for 56 distinct icons, from a package whose devDependencies still pin Vue 2
 * and which publishes no peerDependencies at all. Path data is the same icon
 * set from the same designer, with no framework coupling, and it tree-shakes:
 * 56 strings instead of 56 components.
 *
 * `title` is what the old `decorative` prop controlled — given one, the icon is
 * announced; without one it is hidden from assistive tech, which is right for
 * an icon sitting inside a labelled button.
 */
defineProps<{
    /** A path string from `@mdi/js`, e.g. `mdiFolderOpen`. */
    path: string;
    title?: string;
    /** Icon size, in `em`, so it scales with the surrounding text. */
    size?: number;
}>();
</script>

<template>
    <svg
        class="svg-icon"
        viewBox="0 0 24 24"
        :width="`${size ?? 1}em`"
        :height="`${size ?? 1}em`"
        :role="title ? 'img' : undefined"
        :aria-hidden="title ? undefined : 'true'"
        focusable="false"
    >
        <title v-if="title">{{ title }}</title>
        <path :d="path" fill="currentColor" />
    </svg>
</template>

<style scoped>
.svg-icon {
    vertical-align: -0.15em;
}
</style>
