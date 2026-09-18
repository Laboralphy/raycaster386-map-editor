import type { InjectionKey, Ref } from 'vue';

/**
 * The contract between a `SiblingGroup` and its buttons.
 *
 * This replaces the one genuinely Vue-2-shaped piece of the old editor. There,
 * `Siblings` reached into `this.$children` and assigned `c.selected = ...`
 * directly onto each child's data, while `SiblingButton` called
 * `this.$parent.selectSibling(this)` and passed itself as an argument. Neither
 * half declared anything about the other, `$children` is gone in Vue 3, and
 * consumers drove it from outside through `$refs.group.selectSiblingIndex(n)`.
 *
 * The replacement is an explicit, typed context: children announce themselves
 * and read their own state, the group owns the selection, and a consumer uses
 * `v-model` like any other input. Nothing writes into anything else's state.
 */
export interface SiblingGroupContext {
    /** Announces a button and returns its index, which is its identity. */
    register(item: SiblingItem): number;
    unregister(index: number): void;
    /** Asks the group to select a button. Ignored when it is disabled. */
    select(index: number): void;
    /**
     * Asks the group to move the selection to the first usable button.
     *
     * Called by a button that has just become disabled while selected. The old
     * editor did this by reaching up with `this.$parent.selectAnotherSibling()`;
     * the difference is that this is declared, and the group decides.
     */
    selectAnother(): void;
    /** Which button is selected. Read-only to the children. */
    readonly selected: Readonly<Ref<number>>;
}

export interface SiblingItem {
    /** Read by the group when it needs to pick a different button. */
    isDisabled(): boolean;
}

export const SIBLING_GROUP: InjectionKey<SiblingGroupContext> = Symbol('sibling-group');
