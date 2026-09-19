<script setup lang="ts">
/**
 * The universal button, ported from `_OLD_MAPEDIT_/src/components/MyButton.vue`.
 *
 * Still an `<a>` rather than a `<button>`, because the old styling and the
 * layout around it assume an inline anchor. Making it a real button is a change
 * worth making later, with the accessibility pass.
 *
 * `href` is a declared prop rather than something left to fall through, because
 * the default must be suppressed for a button and honoured for a link, and the
 * component cannot tell which it is from a fallthrough attribute. The port
 * originally handled the click with `@click.stop.prevent`, which cancels the
 * navigation an `href` exists for — so the download button on the render panel
 * did nothing at all. Only a placeholder link is prevented now.
 */
const props = withDefaults(
    defineProps<{
        title?: string;
        disabled?: boolean;
        /** Makes it a real link. Left out, it is a button. */
        href?: string;
        /** Offers the link as a file of this name. Needs `href`. */
        download?: string;
    }>(),
    { title: undefined, disabled: false, href: undefined, download: undefined }
);

const emit = defineEmits<{ click: [] }>();

function onClick(event: MouseEvent): void {
    // An anchor has no disabled state of its own, so a disabled one has to be
    // stopped here or it would still navigate.
    if (props.disabled || !props.href) {
        event.preventDefault();
    }
    if (!props.disabled) {
        emit('click');
    }
}
</script>

<template>
    <a
        :href="disabled ? undefined : (href ?? '#')"
        :download="href ? download : undefined"
        :title="title"
        :class="['myButton', disabled ? 'disabled' : 'enabled']"
        @click.stop="onClick"
    >
        <slot></slot>
    </a>
</template>

<style scoped>
.myButton {
    box-shadow: inset 0 0.1em 0 0 #bee2f9;
    background: linear-gradient(to bottom, #63b8ee 5%, #468ccf 100%);
    background-color: #63b8ee;
    border-radius: 0.3em;
    border: 0.1em solid #3866a3;
    display: inline-block;
    cursor: pointer;
    color: #14396a;
    font-family: Arial, sans-serif;
    font-size: 1em;
    font-weight: bold;
    padding: 0.3em 0.5em;
    text-decoration: none;
    text-shadow: 0 0.1em 0 #7cacde;
}

.myButton:focus {
    outline: 0;
}

.myButton.enabled:hover {
    background: linear-gradient(to bottom, #468ccf 5%, #63b8ee 100%);
    background-color: #468ccf;
}

.myButton.enabled:active {
    position: relative;
    top: 1px;
}

.myButton.disabled {
    box-shadow: inset 0 0.1em 0 0 #ccc;
    background: linear-gradient(to bottom, #999 5%, #777 100%);
    background-color: #777;
    color: #555;
    border: 0.1em solid #555;
    text-shadow: 0 0.1em 0 #999;
    cursor: default;
}
</style>
