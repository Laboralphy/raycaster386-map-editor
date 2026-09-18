import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyLevel, emptyThing } from '../../src/domain/defaults.ts';
import { useEditorStore } from '../../src/stores/editor.ts';
import { useLevelStore } from '../../src/stores/level.ts';
import MarkerManagerView from '../../src/views/MarkerManagerView.vue';
import TagManagerView from '../../src/views/TagManagerView.vue';
import ThingSideView from '../../src/views/ThingSideView.vue';
import UtilPanelView from '../../src/views/UtilPanelView.vue';

/**
 * The four side panels, mounted on their own.
 *
 * They live beside the grid, and the grid paints to a canvas happy-dom does not
 * provide — so they are mounted directly rather than through their routes.
 */

vi.mock('../../src/services/vaultClient', () => ({
    listLevels: vi.fn(async () => []),
    loadLevel: vi.fn(async () => ({ grid: [[{}]] })),
    saveLevel: vi.fn(async () => undefined),
    deleteLevel: vi.fn(async () => undefined),
    previewUrl: (name: string) => `/vault/${name}.jpg`,
    VaultError: Error,
}));

beforeEach(() => setActivePinia(createPinia()));

function seeded(size = 3) {
    const level = useLevelStore();
    level.load(createEmptyLevel(size));
    return { level, editor: useEditorStore() };
}

function select(
    editor: ReturnType<typeof useEditorStore>,
    x1: number,
    y1: number,
    x2 = x1,
    y2 = y1
) {
    editor.selectedRegion = { x1, y1, x2, y2 };
}

describe('the tag panel', () => {
    it('asks for a selection before it shows anything', async () => {
        seeded();
        const wrapper = mount(TagManagerView);
        expect(wrapper.text()).toContain('Select a cell or a region');
    });

    it('lists the tags in the selection', async () => {
        const { level, editor } = seeded();
        level.addCellTag(0, 0, 'goto cabin');
        level.addCellTag(1, 0, 'event thunder');
        select(editor, 0, 0, 1, 0);

        const wrapper = mount(TagManagerView);
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('goto cabin');
        expect(wrapper.text()).toContain('event thunder');
    });

    it('adds a tag to every selected cell', async () => {
        const { level, editor } = seeded();
        select(editor, 0, 0, 1, 1);

        const wrapper = mount(TagManagerView);
        await wrapper.find('input[type="text"]').setValue('sound door');
        await wrapper.findAll('a.myButton').at(-1)!.trigger('click');

        expect(level.cellAt(0, 0)?.tags).toEqual(['sound door']);
        expect(level.cellAt(1, 1)?.tags).toEqual(['sound door']);
    });

    it('derives its list from the cells, so it cannot drift from them', async () => {
        // The old panel kept a parallel list of "highlighted tags" in the store
        // and edited both; this reads the cells.
        const { level, editor } = seeded();
        level.addCellTag(0, 0, 'ghost');
        select(editor, 0, 0);

        const wrapper = mount(TagManagerView);
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('ghost');

        level.removeCellTag(0, 0, 'ghost');
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).not.toContain('ghost');
    });
});

describe('the marker panel', () => {
    it('disables the shape and colour buttons until something is selected', async () => {
        seeded();
        const wrapper = mount(MarkerManagerView);
        const shapes = wrapper.findAll('a.myButton');
        expect(shapes[0].classes()).toContain('disabled');
    });

    it('marks every selected cell', async () => {
        const { level, editor } = seeded();
        select(editor, 0, 0, 1, 0);

        const wrapper = mount(MarkerManagerView);
        await wrapper.vm.$nextTick();
        // Shapes come first: none, circle, square, ...
        await wrapper.findAll('a.myButton')[2].trigger('click');

        // Button order is none, circle, square, ... and SHAPE_SQUARE is 5:
        // the panel's order is the old editor's, not the constants' order.
        expect(level.cellAt(0, 0)?.mark.shape).toBe(5);
        expect(level.cellAt(1, 0)?.mark.shape).toBe(5);
    });

    it('adds and removes start points, never dropping the last', async () => {
        const { level } = seeded();
        const wrapper = mount(MarkerManagerView);
        await wrapper.vm.$nextTick();

        const add = wrapper.findAll('a.myButton').find((b) => b.text() === 'Add')!;
        await add.trigger('click');
        expect(level.doc.startpoints).toHaveLength(2);

        const remove = wrapper.findAll('a.myButton').find((b) => b.text() === 'Remove')!;
        await remove.trigger('click');
        expect(level.doc.startpoints).toHaveLength(1);

        await remove.trigger('click');
        expect(level.doc.startpoints).toHaveLength(1);
    });

    it('places the start point on the selection, facing the arrow clicked', async () => {
        const { level, editor } = seeded();
        select(editor, 2, 1);

        const wrapper = mount(MarkerManagerView);
        await wrapper.vm.$nextTick();
        // The pad's first arrow is north-west, 1.25 half-turns.
        const pad = wrapper.find('.dpad');
        await pad.findAll('a.myButton')[0].trigger('click');

        expect(level.doc.startpoints[0]).toMatchObject({ x: 2, y: 1, angle: 1.25, z: 1 });
    });
});

describe('the utility panel', () => {
    it('shifts the whole map', async () => {
        const { level } = seeded(2);
        level.setCellBlock(0, 0, 0, 1);

        const wrapper = mount(UtilPanelView);
        // Shift pad order: north, west, east, south.
        await wrapper.findAll('a.myButton')[3].trigger('click');

        expect(level.cellAt(0, 1)?.block).toBe(1);
    });

    it('will not offer region shifting without a region', async () => {
        seeded();
        const wrapper = mount(UtilPanelView);
        expect(wrapper.find('input[type="checkbox"]').attributes('disabled')).toBeDefined();
    });

    it('reports the document size and shape', async () => {
        const { level } = seeded(4);
        const wrapper = mount(UtilPanelView);
        expect(wrapper.text()).toContain('4x4 cells');
        expect(level.storageUsage).toBeGreaterThan(0);
    });
});

describe('the thing panel', () => {
    it('asks for a click on the map first', async () => {
        seeded();
        const wrapper = mount(ThingSideView);
        expect(wrapper.text()).toContain('Click a thing on the map');
    });

    it('describes the thing the grid selected', async () => {
        const { level, editor } = seeded();
        level.addTiles('sprite', [{ content: 'sprite', width: 32, height: 32 }]);
        const id = level.upsertThing({ ...emptyThing(0), id: 0, ref: 'lamp', tile: 1, opacity: 1 });
        level.setCellThing(1, 1, 0, 2, id);
        editor.selectedThing = { xc: 1, yc: 1, xt: 0, yt: 2 };

        const wrapper = mount(ThingSideView);
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('lamp');
        expect(wrapper.text()).toContain('75%');
        expect(wrapper.text()).toContain('1, 1');
    });

    it('takes the thing off the map', async () => {
        const { level, editor } = seeded();
        level.addTiles('sprite', [{ content: 'sprite', width: 32, height: 32 }]);
        const id = level.upsertThing({ ...emptyThing(0), id: 0, tile: 1 });
        level.setCellThing(0, 0, 1, 1, id);
        editor.selectedThing = { xc: 0, yc: 0, xt: 1, yt: 1 };

        const wrapper = mount(ThingSideView);
        await wrapper.vm.$nextTick();
        await wrapper.find('a.myButton').trigger('click');

        expect(level.thingAt(0, 0, 1, 1)).toBeUndefined();
        expect(editor.selectedThing).toBeNull();
    });

    it('says so when the template behind a placement has gone', async () => {
        const { level, editor } = seeded();
        level.setCellThing(0, 0, 0, 0, 99);
        editor.selectedThing = { xc: 0, yc: 0, xt: 0, yt: 0 };

        const wrapper = mount(ThingSideView);
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('template no longer exists');
    });
});
