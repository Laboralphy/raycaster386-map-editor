import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import App from '../../src/App.vue';

/**
 * Does the application actually start?
 *
 * Every other test mounts one view in isolation. This boots the real shell with
 * the real router and store, which is the only thing that catches a broken
 * import, a store that throws on creation, or a component the router names but
 * cannot resolve — the class of failure that shows up as a blank page rather
 * than as a test failure.
 *
 * The grid routes are deliberately not exercised: they paint to a canvas, and
 * happy-dom has no 2d context. That part needs a browser, and nothing here
 * should be read as saying otherwise.
 */

vi.mock('../../src/services/vaultClient', () => ({
    listLevels: vi.fn(async () => [
        { name: 'mans-test-ai', date: 1700000000, preview: '/vault/mans-test-ai.jpg' },
    ]),
    loadLevel: vi.fn(async () => ({ grid: [[{}]] })),
    saveLevel: vi.fn(async () => undefined),
    deleteLevel: vi.fn(async () => undefined),
    previewUrl: (name: string) => `/vault/${name}.jpg`,
    VaultError: Error,
}));

async function boot(path: string) {
    // The real routes, so a route naming a missing component fails here.
    const { router: appRouter } = await import('../../src/router/index.ts');
    const router = createRouter({ history: createWebHistory(), routes: appRouter.options.routes });
    await router.push(path);
    await router.isReady();
    const wrapper = mount(App, { global: { plugins: [createPinia(), router] } });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    return wrapper;
}

describe('the application', () => {
    it('starts on the about page with its menu and status bar', async () => {
        const wrapper = await boot('/');
        expect(wrapper.find('table.o876structure').exists()).toBe(true);
        // Both menu strips, so every route the menu names resolved.
        expect(wrapper.findAll('.simple-menu')).toHaveLength(2);
        expect(wrapper.find('.statusbar').exists()).toBe(true);
    });

    it('renders both the main view and the side panel', async () => {
        const wrapper = await boot('/');
        expect(wrapper.text()).toContain('Raycaster Map Editor');
        expect(wrapper.text()).toContain('About');
    });

    it('opens the level list and shows what the vault holds', async () => {
        const wrapper = await boot('/list-levels');
        await vi.waitFor(() => expect(wrapper.text()).toContain('mans-test-ai'));
        expect(wrapper.find('figure.level-thumbnail').exists()).toBe(true);
    });

    it('opens settings', async () => {
        const wrapper = await boot('/settings');
        expect(wrapper.text()).toContain('Settings');
        expect(wrapper.findAll('input[type="number"]').length).toBeGreaterThan(0);
    });

    it('opens the tile loader with its browser beside it', async () => {
        const wrapper = await boot('/load-tiles');
        expect(wrapper.text()).toContain('Tile loader');
        expect(wrapper.text()).toContain('Tile browser');
    });

    it('opens the block and thing builders', async () => {
        expect((await boot('/build-block/0')).text()).toContain('Block Builder');
        expect((await boot('/build-thing/0')).text()).toContain('Thing Builder');
    });

    /**
     * The layout is a chain of `height: 100%` and every link has to be in it.
     * Vue 3 mounts *inside* `#app` where Vue 2 replaced it, so the mount point
     * is a link the old stylesheet never had — and without it the menu and the
     * status bar render while everything between them is zero pixels tall.
     *
     * happy-dom computes no layout, so this is the most a test can do: it pins
     * the fix, which nothing else would catch.
     */
    it('keeps the mount point in the full-height chain', async () => {
        const { readFile } = await import('node:fs/promises');
        const css = await readFile('src/styles/structure.css', 'utf8');
        const chain = css.slice(0, css.indexOf('height: 100%'));
        expect(chain).toContain('#app');
    });

    it('resolves every declared route to a component', async () => {
        const { router } = await import('../../src/router/index.ts');
        for (const route of router.options.routes) {
            if ('redirect' in route) {
                continue;
            }
            expect(route.components, `route ${String(route.path)} has no components`).toBeDefined();
            expect(Object.keys(route.components ?? {})).toContain('default');
        }
    });
});
