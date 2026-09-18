import { convertMapEditLevel } from '@laboralphy/raycaster386/mapedit';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import { createEmptyLevel } from '../../src/domain/defaults.ts';
import { useLevelStore } from '../../src/stores/level.ts';
import SettingsView from '../../src/views/SettingsView.vue';
import { stubAppender } from '../helpers/fixtures.ts';

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

function mountSettings() {
    return mount(SettingsView, { global: { plugins: [router] } });
}

/**
 * The smallest level the converter accepts.
 *
 * It refuses a level with no wall tile and no flat tile, so
 * `createEmptyLevel()` cannot be converted at all. Worth knowing for phase 5: a
 * level started from scratch has nothing to preview until at least one wall and
 * one flat have been imported.
 */
function convertibleLevel() {
    const level = createEmptyLevel(1);
    level.tiles.walls.push({
        id: 1,
        type: 'wall',
        content: 'data:image/png;base64,iVBORw0KGgo=',
        width: 64,
        height: 96,
        animation: null,
    });
    level.tiles.flats.push({
        id: 2,
        type: 'flat',
        content: 'data:image/png;base64,iVBORw0KGgo=',
        width: 64,
        height: 64,
        animation: null,
    });
    level.blocks.push({
        id: 1,
        ref: '',
        phys: 1,
        offs: 0,
        light: { enabled: false, value: 0, inner: 0, outer: 0 },
        faces: { n: 1, e: 1, w: 1, s: 1, f: 2, c: 2 },
        preview: '',
    });
    level.grid[0][0].block = 1;
    return level;
}

describe('the settings screen', () => {
    it('shows the open level’s metrics and thinker', async () => {
        const level = useLevelStore();
        level.load({ ...createEmptyLevel(), metrics: { tileWidth: 32, tileHeight: 48 } });
        level.doc.actor.thinker = 'IntroThinker';

        const wrapper = mountSettings();
        await wrapper.vm.$nextTick();

        const numbers = wrapper.findAll('input[type="number"]');
        expect((numbers[0].element as HTMLInputElement).value).toBe('32');
        expect((numbers[1].element as HTMLInputElement).value).toBe('48');
        expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe(
            'IntroThinker'
        );
    });

    /**
     * The end-to-end point of this screen: an edit made in the UI reaches the
     * document, and the document still converts afterwards. A change that
     * produced an unconvertible level would otherwise stay invisible until
     * someone tried to export.
     *
     * Deliberately no tile-size change here — that path rescales every tile
     * image through a canvas, which happy-dom does not implement. The rescale
     * is covered where it can be: `tests/stores/tiles.test.ts` for the values
     * it scales, `tests/libs/tilesetSplitter.test.ts` for the images.
     */
    it('writes an edit into the document, and the document still converts', async () => {
        const level = useLevelStore();
        level.load(convertibleLevel());

        const wrapper = mountSettings();
        await wrapper.vm.$nextTick();

        await wrapper.find('input[type="text"]').setValue('MyThinker');
        await wrapper.findAll('input[type="checkbox"]')[0].setValue(true);
        await wrapper.findAll('input[type="checkbox"]')[2].setValue(true);

        await wrapper.findAll('a.myButton')[0].trigger('click');
        await flushPromises();

        expect(level.doc.actor.thinker).toBe('MyThinker');
        expect(level.doc.flags.smooth).toBe(true);
        expect(level.doc.flags.export).toBe(true);

        const converted = await convertMapEditLevel(level.serialise(), stubAppender);
        expect(converted).toHaveProperty('version', 'RCE-100');
    });

    it('records a new tile size, with nothing to rescale', async () => {
        const level = useLevelStore();
        level.load(createEmptyLevel());

        const wrapper = mountSettings();
        await wrapper.vm.$nextTick();

        const numbers = wrapper.findAll('input[type="number"]');
        await numbers[0].setValue('128');
        await numbers[1].setValue('192');
        await wrapper.findAll('a.myButton')[0].trigger('click');
        await flushPromises();

        expect(level.doc.metrics).toEqual({ tileWidth: 128, tileHeight: 192 });
    });

    it('keeps tile width numeric even though the input hands back a string', () => {
        const level = useLevelStore();
        level.load(createEmptyLevel());
        level.setTileSize(Number('96'), Number('96'));
        expect(level.doc.metrics.tileWidth).toBe(96);
        expect(typeof level.doc.metrics.tileWidth).toBe('number');
    });
});
