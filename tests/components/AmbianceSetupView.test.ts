import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import { createEmptyLevel } from '../../src/domain/defaults.ts';
import { useHistoryStore } from '../../src/stores/history.ts';
import { useLevelStore } from '../../src/stores/level.ts';
import AmbianceSetupView from '../../src/views/AmbianceSetupView.vue';

vi.mock('../../src/services/vaultClient', () => ({
    listLevels: vi.fn(async () => []),
    loadLevel: vi.fn(async () => ({ grid: [[{}]] })),
    saveLevel: vi.fn(async () => undefined),
    deleteLevel: vi.fn(async () => undefined),
    previewUrl: (name: string) => `/vault/${name}.jpg`,
    VaultError: Error,
}));

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/render', component: { template: '<div />' } },
    ],
});

beforeEach(async () => {
    setActivePinia(createPinia());
    await router.push('/');
    await router.isReady();
});

function mountAmbiance() {
    return mount(AmbianceSetupView, { global: { plugins: [router] } });
}

/** Clicks the button with exactly this label, rather than one by position. */
async function click(wrapper: ReturnType<typeof mountAmbiance>, label: string): Promise<void> {
    const button = wrapper.findAll('a.myButton').find((b) => b.text().trim() === label);
    if (button === undefined) {
        throw new Error(`no button labelled "${label}"`);
    }
    await button.trigger('click');
}

describe('the ambiance panel', () => {
    it('shows the level’s current ambiance', async () => {
        const level = useLevelStore();
        level.load(createEmptyLevel(1));
        level.setAmbiance({
            sky: '',
            fog: { distance: 17, color: '#123456' },
            filter: { enabled: false, color: '' },
            brightness: 30,
        });

        const wrapper = mountAmbiance();
        await wrapper.vm.$nextTick();

        const numbers = wrapper.findAll('input[type="number"]');
        expect((numbers[0].element as HTMLInputElement).value).toBe('17');
        expect((numbers[1].element as HTMLInputElement).value).toBe('30');
    });

    /**
     * The bug the old panel had: it bound the form straight to the store's
     * object, so the document changed as you typed and Apply was decorative.
     */
    it('edits a draft, leaving the document alone until Apply', async () => {
        const level = useLevelStore();
        level.load(createEmptyLevel(1));

        const wrapper = mountAmbiance();
        await wrapper.vm.$nextTick();

        const distance = wrapper.findAll('input[type="number"]')[0];
        await distance.setValue('42');

        expect(level.doc.ambiance.fog.distance).toBe(50);

        await click(wrapper, 'Apply');
        expect(level.doc.ambiance.fog.distance).toBe(42);
    });

    it('records the change so it can be undone', async () => {
        const level = useLevelStore();
        const history = useHistoryStore();
        level.load(createEmptyLevel(1));

        const wrapper = mountAmbiance();
        await wrapper.vm.$nextTick();
        await wrapper.findAll('input[type="number"]')[0].setValue('42');
        await click(wrapper, 'Apply');

        expect(level.doc.ambiance.fog.distance).toBe(42);
        expect(history.canUndo).toBe(true);
        history.undo();
        expect(level.doc.ambiance.fog.distance).toBe(50);
    });

    /**
     * The converter drops a filter with an empty colour, so turning one on
     * without choosing a colour would silently do nothing.
     */
    it('gives the colour filter a usable colour when it is switched on', async () => {
        const level = useLevelStore();
        level.load(createEmptyLevel(1));

        const wrapper = mountAmbiance();
        await wrapper.vm.$nextTick();
        expect(level.doc.ambiance.filter.color).toBe('');

        await wrapper.find('input[type="checkbox"]').setValue(true);
        await click(wrapper, 'Apply');

        expect(level.doc.ambiance.filter.enabled).toBe(true);
        expect(level.doc.ambiance.filter.color).not.toBe('');
    });
});
