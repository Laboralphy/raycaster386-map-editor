import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import { createEmptyLevel } from '../../src/domain/defaults.ts';
import { useEditorStore } from '../../src/stores/editor.ts';
import { useLevelStore } from '../../src/stores/level.ts';
import RenderSideView from '../../src/views/RenderSideView.vue';
import RenderView from '../../src/views/RenderView.vue';

/**
 * What can be checked of the preview without a canvas.
 *
 * happy-dom has no 2d context, so the render loop itself cannot run here — as
 * with `LevelGridView`, the drawing is verified by the typecheck and by the
 * browser. What is testable is the decision made *before* any canvas is
 * touched: a level the converter would refuse must produce a sentence, not a
 * thrown error. That path is the whole reason `previewBlocker` exists.
 */

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
    routes: [{ path: '/', component: { template: '<div />' } }],
});

beforeEach(async () => {
    setActivePinia(createPinia());
    await router.push('/');
    await router.isReady();
});

describe('the render screen', () => {
    it('explains why an empty level cannot be rendered, instead of failing', async () => {
        const level = useLevelStore();
        level.load(createEmptyLevel(1));

        const wrapper = mount(RenderView, { global: { plugins: [router] } });
        await flushPromises();

        expect(wrapper.text()).toMatch(/no wall tile/i);
        // Nothing was converted, so nothing reached the canvas either.
        expect(wrapper.find('canvas').exists()).toBe(false);
        expect(useEditorStore().generatedLevel).toBeNull();
    });
});

describe('the render side panel', () => {
    it('offers no download until the preview has compiled a level', () => {
        const wrapper = mount(RenderSideView, { global: { plugins: [router] } });
        const button = wrapper.findAll('a.myButton').find((b) => b.text().includes('Download'));
        expect(button?.classes()).toContain('disabled');
        expect(button?.attributes('href')).toBeUndefined();
    });

    /**
     * The download is an `<a href download>`, and `MyButton` used to cancel
     * every click with `.prevent` — which made this button do nothing at all.
     */
    it('offers the compiled level as a named download once there is one', () => {
        const editor = useEditorStore();
        editor.levelName = 'mans-test-ai';
        editor.generatedLevel = { version: 'RCE-100' };

        const wrapper = mount(RenderSideView, { global: { plugins: [router] } });
        const button = wrapper.findAll('a.myButton').find((b) => b.text().includes('Download'));

        expect(button?.classes()).toContain('enabled');
        expect(button?.attributes('download')).toBe('mans-test-ai.json');
        expect(button?.attributes('href')).toMatch(/^data:text\/json/);
        expect(decodeURIComponent(button?.attributes('href') ?? '')).toContain('RCE-100');
    });
});
