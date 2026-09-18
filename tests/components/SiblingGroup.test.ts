import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, ref } from 'vue';
import SiblingButton from '../../src/components/SiblingButton.vue';
import SiblingGroup from '../../src/components/SiblingGroup.vue';

/**
 * The one genuine redesign of the migration.
 *
 * The old pair coupled itself both ways with no declared contract: the group
 * assigned `selected` straight onto each child's data through `$children`, and
 * each child called `this.$parent.selectSibling(this)`. `$children` no longer
 * exists in Vue 3, so this had to be rebuilt rather than translated — which
 * makes it the piece most worth testing directly.
 */

function harness(options: { disabled?: boolean[]; start?: number } = {}) {
    const disabled = options.disabled ?? [false, false, false];
    return defineComponent({
        components: { SiblingGroup, SiblingButton },
        setup() {
            return { index: ref(options.start ?? 0), disabled: ref([...disabled]) };
        },
        template: `
            <SiblingGroup v-model="index">
                <SiblingButton v-for="(d, i) in disabled" :key="i" :disabled="d">{{ i }}</SiblingButton>
            </SiblingGroup>
        `,
    });
}

function selectedIndexes(wrapper: ReturnType<typeof mount>): number[] {
    return wrapper
        .findAll('a.myButton')
        .map((b, i) => (b.classes().includes('selected') ? i : -1))
        .filter((i) => i >= 0);
}

describe('a group of mutually exclusive buttons', () => {
    it('marks exactly the selected button', async () => {
        const wrapper = mount(harness());
        await wrapper.vm.$nextTick();
        expect(selectedIndexes(wrapper)).toEqual([0]);
    });

    it('selects the button that was clicked, and only it', async () => {
        const wrapper = mount(harness());
        await wrapper.vm.$nextTick();

        await wrapper.findAll('a.myButton')[2].trigger('click');
        expect(selectedIndexes(wrapper)).toEqual([2]);
        expect((wrapper.vm as unknown as { index: number }).index).toBe(2);
    });

    it('reflects the model when the parent sets it, with no ref poking', async () => {
        // Consumers used to reach in with `$refs.group.selectSiblingIndex(n)`;
        // the selection is a v-model now, so this is just an assignment.
        const wrapper = mount(harness());
        await wrapper.vm.$nextTick();

        (wrapper.vm as unknown as { index: number }).index = 1;
        await wrapper.vm.$nextTick();
        expect(selectedIndexes(wrapper)).toEqual([1]);
    });

    it('ignores a click on a disabled button', async () => {
        const wrapper = mount(harness({ disabled: [false, true, false] }));
        await wrapper.vm.$nextTick();

        await wrapper.findAll('a.myButton')[1].trigger('click');
        expect(selectedIndexes(wrapper)).toEqual([0]);
    });

    it('hands the selection on when the selected button becomes disabled', async () => {
        const wrapper = mount(harness({ disabled: [true, false, false], start: 1 }));
        await wrapper.vm.$nextTick();
        expect(selectedIndexes(wrapper)).toEqual([1]);

        const vm = wrapper.vm as unknown as { disabled: boolean[] };
        vm.disabled[1] = true;
        await wrapper.vm.$nextTick();

        // Index 0 is disabled too, so it must land on 2 rather than stick on a
        // button that can no longer be used.
        expect(selectedIndexes(wrapper)).toEqual([2]);
    });

    it('stays put when a button that is not selected becomes disabled', async () => {
        const wrapper = mount(harness({ start: 0 }));
        await wrapper.vm.$nextTick();

        const vm = wrapper.vm as unknown as { disabled: boolean[] };
        vm.disabled[2] = true;
        await wrapper.vm.$nextTick();

        expect(selectedIndexes(wrapper)).toEqual([0]);
    });
});
