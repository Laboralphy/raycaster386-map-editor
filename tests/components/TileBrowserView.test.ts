import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyLevel } from '../../src/domain/defaults.ts';
import { useEditorStore } from '../../src/stores/editor.ts';
import { useLevelStore } from '../../src/stores/level.ts';
import TileBrowserView from '../../src/views/TileBrowserView.vue';

vi.mock('../../src/services/vaultClient', () => ({
    listLevels: vi.fn(async () => []),
    loadLevel: vi.fn(async () => ({ grid: [[{}]] })),
    saveLevel: vi.fn(async () => undefined),
    deleteLevel: vi.fn(async () => undefined),
    previewUrl: (name: string) => `/vault/${name}.jpg`,
    VaultError: Error,
}));

beforeEach(() => {
    setActivePinia(createPinia());
    vi.unstubAllGlobals();
});

/**
 * happy-dom implements no `confirm`, so there is nothing to spy on — it has to
 * be supplied. Replacing `window.confirm` outright is also closer to what the
 * component sees than a spy would be.
 */
function stubConfirm(answer: boolean) {
    const mock = vi.fn(() => answer);
    vi.stubGlobal('confirm', mock);
    return mock;
}

function seeded() {
    const level = useLevelStore();
    level.load(createEmptyLevel(1));
    level.addTiles('wall', [
        { content: 'w1', width: 64, height: 96 },
        { content: 'w2', width: 64, height: 96 },
    ]);
    level.addTiles('flat', [{ content: 'f1', width: 64, height: 64 }]);
    return level;
}

describe('the tile browser', () => {
    it('shows the tiles of the selected group and counts them', async () => {
        seeded();
        const wrapper = mount(TileBrowserView);
        await wrapper.vm.$nextTick();

        expect(wrapper.findAll('div.tile')).toHaveLength(2);
        expect(wrapper.text()).toContain('Wall Tile browser - 2 tiles');
    });

    it('switches group when its tab is clicked', async () => {
        seeded();
        const editor = useEditorStore();
        const wrapper = mount(TileBrowserView);
        await wrapper.vm.$nextTick();

        // The three tabs come first in the toolbar, then the delete button.
        await wrapper.findAll('a.myButton')[1].trigger('click');
        await wrapper.vm.$nextTick();

        expect(editor.tileBrowserType).toBe('flat');
        expect(wrapper.findAll('div.tile')).toHaveLength(1);
    });

    it('drops the selection when the group changes', async () => {
        seeded();
        const wrapper = mount(TileBrowserView);
        await wrapper.vm.$nextTick();

        await wrapper.findAll('div.tile')[0].trigger('click');
        await wrapper.vm.$nextTick();
        expect(wrapper.findAll('div.tile.selected')).toHaveLength(1);

        await wrapper.findAll('a.myButton')[1].trigger('click');
        await wrapper.vm.$nextTick();
        // Selection is owned here, not inside each tile, so switching tabs
        // really clears it rather than leaving stale highlights behind.
        expect(wrapper.findAll('div.tile.selected')).toHaveLength(0);
    });

    it('deletes the selected tiles once confirmed', async () => {
        const level = seeded();
        stubConfirm(true);
        const wrapper = mount(TileBrowserView);
        await wrapper.vm.$nextTick();

        await wrapper.findAll('div.tile')[0].trigger('click');
        await wrapper.vm.$nextTick();
        await wrapper.findAll('a.myButton')[3].trigger('click');
        await wrapper.vm.$nextTick();

        expect(level.allTiles('wall')).toHaveLength(1);
    });

    it('keeps a tile a thing draws with, and says so', async () => {
        const level = seeded();
        level.doc.things.push({
            id: 5,
            ref: 'lamp',
            size: 16,
            opacity: 0,
            ghost: false,
            tangible: true,
            light: { enabled: false, value: 0, inner: 0, outer: 0 },
            tile: 1,
        });
        stubConfirm(true);

        const wrapper = mount(TileBrowserView);
        await wrapper.vm.$nextTick();
        await wrapper.findAll('div.tile')[0].trigger('click');
        await wrapper.vm.$nextTick();
        await wrapper.findAll('a.myButton')[3].trigger('click');
        await wrapper.vm.$nextTick();

        expect(level.allTiles('wall')).toHaveLength(2);
        expect(useEditorStore().statusBar).toContain('still used by things');
    });

    it('does not ask for confirmation when nothing is selected', async () => {
        seeded();
        const confirm = stubConfirm(true);
        const wrapper = mount(TileBrowserView);
        await wrapper.vm.$nextTick();

        expect(wrapper.findAll('a.myButton')[3].classes()).toContain('disabled');
        await wrapper.findAll('a.myButton')[3].trigger('click');
        expect(confirm).not.toHaveBeenCalled();
    });
});
