<script setup lang="ts">
/**
 * The universal button, ported from `_OLD_MAPEDIT_/src/components/MyButton.vue`.
 *
 * Still an `<a>` rather than a `<button>`, because the old styling and the
 * layout around it assume an inline anchor, and one of the call sites relies on
 * `href`/`download` falling through onto it. Making it a real button is a
 * change worth making later, with the accessibility pass.
 */
withDefaults(
    defineProps<{
        title?: string;
        disabled?: boolean;
    }>(),
    { title: undefined, disabled: false }
);

const emit = defineEmits<{ click: [] }>();

function onClick(disabled: boolean): void {
    if (!disabled) {
        emit('click');
    }
}
</script>

<template>
    <a
        href="#"
        :title="title"
        :class="['myButton', disabled ? 'disabled' : 'enabled']"
        @click.stop.prevent="onClick(disabled)"
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
