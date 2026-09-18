import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import { useEditorStore } from '../../src/stores/editor.ts';
import { useLevelStore } from '../../src/stores/level.ts';
import LevelListView from '../../src/views/LevelListView.vue';

const listLevels = vi.fn(async () => [
    { name: 'mans-intro', date: 1700000000, preview: '/vault/mans-intro.jpg' },
    { name: 'mans-cabin', date: 1700000100, preview: '/vault/mans-cabin.jpg' },
]);
const loadLevel = vi.fn(async () => ({ grid: [[{}]] }));
const deleteLevel = vi.fn(async () => undefined);

vi.mock('../../src/services/vaultClient', () => ({
    listLevels: (...args: unknown[]) => listLevels(...(args as [])),
    loadLevel: (...args: unknown[]) => loadLevel(...(args as [])),
    deleteLevel: (...args: unknown[]) => deleteLevel(...(args as [])),
    saveLevel: vi.fn(async () => undefined),
    previewUrl: (name: string) => `/vault/${name}.jpg`,
    VaultError: Error,
}));

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/settings', component: { template: '<div />' } },
    ],
});

beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    await router.push('/');
    await router.isReady();
});

async function mountList() {
    const wrapper = mount(LevelListView, { global: { plugins: [router] } });
    await vi.waitFor(() => expect(useEditorStore().levelList.length).toBeGreaterThan(0));
    await wrapper.vm.$nextTick();
    return wrapper;
}

describe('the level list', () => {
    it('shows one thumbnail per level in the vault', async () => {
        const wrapper = await mountList();
        const figures = wrapper.findAll('figure.level-thumbnail');
        expect(figures).toHaveLength(2);
        expect(figures[0].text()).toContain('mans-intro');
        expect(figures[0].find('img').attributes('src')).toBe('/vault/mans-intro.jpg');
    });

    it('renders the stored date as a readable day and time', async () => {
        const wrapper = await mountList();
        // Epoch seconds, not milliseconds — the old component multiplied by
        // 1000 with a string concatenation that broke on any other input.
        expect(wrapper.findAll('figure.level-thumbnail')[0].text()).toMatch(
            /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/
        );
    });

    it('disables Open and Delete until a level is selected', async () => {
        const wrapper = await mountList();
        const buttons = wrapper.findAll('a.myButton');
        expect(buttons[0].classes()).toContain('disabled');

        await wrapper.findAll('figure.level-thumbnail')[0].trigger('click');
        expect(wrapper.findAll('a.myButton')[0].classes()).toContain('enabled');
    });

    it('loads the level and records its name when one is opened', async () => {
        const wrapper = await mountList();
        await wrapper.findAll('figure.level-thumbnail')[1].trigger('dblclick');
        await vi.waitFor(() => expect(loadLevel).toHaveBeenCalledWith('mans-cabin'));

        const editor = useEditorStore();
        expect(editor.levelName).toBe('mans-cabin');
        expect(editor.dirty).toBe(false);
        expect(useLevelStore().gridSize).toBe(1);
    });

    it('reports a failure to load instead of leaving the old level in place', async () => {
        loadLevel.mockRejectedValueOnce(new Error('level is corrupt'));
        const wrapper = await mountList();
        await wrapper.findAll('figure.level-thumbnail')[0].trigger('dblclick');

        const editor = useEditorStore();
        await vi.waitFor(() => expect(editor.statusBar).toContain('level is corrupt'));
        expect(editor.popup.visible).toBe(true);
        expect(editor.levelName).toBe('');
    });
});
