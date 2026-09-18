import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import { createEmptyLevel } from '../../src/domain/defaults.ts';
import { useEditorStore } from '../../src/stores/editor.ts';
import { useLevelStore } from '../../src/stores/level.ts';
import BlockBuilderView from '../../src/views/BlockBuilderView.vue';

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
        { path: '/build-block/:id', component: BlockBuilderView },
        { path: '/level/blocks', component: { template: '<div />' } },
    ],
});

beforeEach(() => setActivePinia(createPinia()));

/** Seeds one tile of each kind. Call once per test, before mounting. */
function seedLevel() {
    const level = useLevelStore();
    level.load(createEmptyLevel(1));
    level.addTiles('wall', [{ content: 'wall-tile', width: 64, height: 96 }]);
    level.addTiles('flat', [{ content: 'flat-tile', width: 64, height: 64 }]);
    level.addTiles('sprite', [{ content: 'sprite-tile', width: 32, height: 32 }]);
    return level;
}

async function mountAt(id: string) {
    const level = seedLevel();
    await router.push(`/build-block/${id}`);
    await router.isReady();
    const wrapper = mount(BlockBuilderView, { global: { plugins: [router] } });
    await wrapper.vm.$nextTick();
    return { wrapper, level };
}

/** Mounts the builder on an existing level, without reseeding it. */
async function mountOn(level: ReturnType<typeof seedLevel>, id: string) {
    void level;
    await router.push(`/build-block/${id}`);
    await router.isReady();
    const wrapper = mount(BlockBuilderView, { global: { plugins: [router] } });
    await wrapper.vm.$nextTick();
    return wrapper;
}

/** Drops a tile id onto the nth face swatch. */
async function dropOn(wrapper: ReturnType<typeof mount>, index: number, tileId: number) {
    await wrapper.findAll('div.tile')[index].trigger('drop', {
        dataTransfer: { getData: () => String(tileId) },
    });
}

// Face order in the template: ceiling, west, north, south, east, floor.
const CEILING = 0;
const WEST = 1;
const FLOOR = 5;

describe('the block builder', () => {
    it('offers every phys kind, labelled', async () => {
        const { wrapper } = await mountAt('0');
        const options = wrapper.findAll('option').map((o) => o.text());
        expect(options).toHaveLength(13);
        expect(options[1]).toBe('Solid');
        // The label the old table had backwards.
        expect(options[6]).toBe('Door left');
    });

    it('accepts a wall tile on a wall face', async () => {
        const { wrapper } = await mountAt('0');
        await dropOn(wrapper, WEST, 1);
        await wrapper.vm.$nextTick();
        expect(wrapper.findAll('div.tile')[WEST].attributes('style')).toContain('wall-tile');
    });

    /**
     * The old builder took any tile on any face. The converter resolves a face
     * id against the tileset for that face's kind, so a flat on a wall produced
     * a level that edited and previewed fine but could not be exported.
     */
    it('refuses a flat tile on a wall face, and says why', async () => {
        const { wrapper } = await mountAt('0');
        await dropOn(wrapper, WEST, 2);
        await wrapper.vm.$nextTick();

        expect(wrapper.findAll('div.tile')[WEST].attributes('style')).not.toContain('flat-tile');
        expect(useEditorStore().statusBar).toContain('West takes a wall tile');
    });

    it('refuses a wall tile on the floor', async () => {
        const { wrapper } = await mountAt('0');
        await dropOn(wrapper, FLOOR, 1);
        await wrapper.vm.$nextTick();
        expect(useEditorStore().statusBar).toContain('Floor takes a flat tile');
    });

    it('copies one wall onto all four', async () => {
        const { wrapper } = await mountAt('0');
        await dropOn(wrapper, WEST, 1);
        await wrapper.vm.$nextTick();

        // The duplicate icon on the West face.
        await wrapper.findAll('.face')[WEST].findAll('.icon')[0].trigger('click');
        await wrapper.vm.$nextTick();

        for (const face of [1, 2, 3, 4]) {
            expect(wrapper.findAll('div.tile')[face].attributes('style')).toContain('wall-tile');
        }
    });

    it('clears a face', async () => {
        const { wrapper } = await mountAt('0');
        await dropOn(wrapper, CEILING, 2);
        await wrapper.vm.$nextTick();
        expect(wrapper.findAll('div.tile')[CEILING].attributes('style')).toContain('flat-tile');

        // Ceiling has no duplicate button, so its only icon is clear.
        await wrapper.findAll('.face')[CEILING].findAll('.icon')[0].trigger('click');
        await wrapper.vm.$nextTick();
        expect(wrapper.findAll('div.tile')[CEILING].attributes('style')).not.toContain('flat-tile');
    });

    it('edits a copy, so abandoning the form leaves the block alone', async () => {
        const { wrapper, level } = await mountAt('0');
        const id = level.upsertBlock({
            id: 0,
            ref: 'original',
            phys: 1,
            offs: 0,
            light: { enabled: false, value: 0, inner: 0, outer: 0 },
            faces: { n: 1, e: 1, w: 1, s: 1, f: null, c: null },
            preview: '',
        });
        wrapper.unmount();

        const editor = await mountOn(level, String(id));
        await editor.find('input[type="text"]').setValue('changed');
        await editor.vm.$nextTick();

        // Nothing is written until Create/Update is pressed.
        expect(level.findBlock(id)?.ref).toBe('original');
    });

    it('shows the offset field only for the kinds that use it', async () => {
        const { wrapper } = await mountAt('0');
        expect(wrapper.find('input[type="number"]').exists()).toBe(false);

        // The options bind numbers, so the selection is made on the element and
        // the change event let Vue read the option's bound value back.
        const select = wrapper.find('select');
        (select.element as HTMLSelectElement).value = '12';
        await select.trigger('change');
        await wrapper.vm.$nextTick();
        expect(wrapper.find('input[type="number"]').exists()).toBe(true);
    });
});
