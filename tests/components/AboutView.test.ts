import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import { createEmptyLevel } from '../../src/domain/defaults.ts';
import { useEditorStore } from '../../src/stores/editor.ts';
import { useHistoryStore } from '../../src/stores/history.ts';
import { useLevelStore } from '../../src/stores/level.ts';
import AboutView from '../../src/views/AboutView.vue';

/**
 * Starting a level from scratch.
 *
 * This is the only button in the editor that throws work away, so most of what
 * is worth testing is what it refuses to do: discard unsaved changes without
 * asking, and leave the previous level's identifiers lying around afterwards.
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
    routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/level/blocks', component: { template: '<div />' } },
    ],
});

beforeEach(async () => {
    setActivePinia(createPinia());
    await router.push('/');
    await router.isReady();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function mountAbout() {
    return mount(AboutView, { global: { plugins: [router] } });
}

async function clickStart(wrapper: ReturnType<typeof mountAbout>): Promise<void> {
    const button = wrapper
        .findAll('a.myButton')
        .find((b) => b.text().includes('Start from scratch'));
    if (button === undefined) {
        throw new Error('no "Start from scratch" button');
    }
    await button.trigger('click');
    await flushPromises();
}

/** A level that has been worked on: named, edited, with things selected. */
function openedLevel() {
    const level = useLevelStore();
    const editor = useEditorStore();
    const history = useHistoryStore();

    level.load(createEmptyLevel(4));
    level.upsertBlock({
        id: 7,
        ref: '',
        phys: 1,
        offs: 0,
        light: { enabled: false, value: 0, inner: 0, outer: 0 },
        faces: { n: 0, e: 0, w: 0, s: 0, f: 0, c: 0 },
        preview: '',
    });
    history.transact('paint', { cells: [{ x: 0, y: 0 }] }, () => {
        level.setCellBlock(0, 0, 0, 7);
    });

    editor.levelName = 'mans-intro';
    editor.dirty = true;
    editor.blockBrowserSelected = 7;
    editor.thingBrowserSelected = 3;
    editor.selectedThing = { xc: 1, yc: 1, xt: 0, yt: 0 };
    editor.selectedFloor = 1;
    editor.selectedRegion = { x1: 0, y1: 0, x2: 2, y2: 2 };
    editor.generatedLevel = { version: 'RCE-100' };

    return { level, editor, history };
}

describe('starting from scratch', () => {
    it('asks before discarding unsaved changes, and does nothing if refused', async () => {
        const { level, editor } = openedLevel();
        vi.stubGlobal(
            'confirm',
            vi.fn(() => false)
        );

        await clickStart(mountAbout());

        expect(level.gridSize).toBe(4);
        expect(level.doc.blocks).toHaveLength(1);
        expect(editor.levelName).toBe('mans-intro');
        expect(editor.dirty).toBe(true);
    });

    it('replaces the document with an empty one when confirmed', async () => {
        const { level, editor } = openedLevel();
        vi.stubGlobal(
            'confirm',
            vi.fn(() => true)
        );

        await clickStart(mountAbout());

        expect(level.doc).toEqual(createEmptyLevel());
        expect(level.doc.blocks).toHaveLength(0);
        expect(editor.levelName).toBe('');
        expect(editor.dirty).toBe(false);
    });

    /** Nothing to lose, so it must not nag. */
    it('does not ask when the level has no unsaved changes', async () => {
        const { level } = openedLevel();
        useEditorStore().dirty = false;
        const confirmed = vi.fn(() => true);
        vi.stubGlobal('confirm', confirmed);

        await clickStart(mountAbout());

        expect(confirmed).not.toHaveBeenCalled();
        expect(level.doc.blocks).toHaveLength(0);
    });

    /**
     * `blockBrowserSelected` is the id the grid paints with. Carried over, it
     * would fill cells of the new level with a block it does not contain.
     */
    it('forgets everything that referred to the old level', async () => {
        const { editor } = openedLevel();
        vi.stubGlobal(
            'confirm',
            vi.fn(() => true)
        );

        await clickStart(mountAbout());

        expect(editor.blockBrowserSelected).toBeNull();
        expect(editor.thingBrowserSelected).toBeNull();
        expect(editor.selectedThing).toBeNull();
        expect(editor.selectedFloor).toBe(0);
        expect(editor.hasRegion).toBe(false);
        expect(editor.generatedLevel).toBeNull();
    });

    /** An undo across the boundary would paste the old level into the new one. */
    it('drops the undo history', async () => {
        const { history } = openedLevel();
        expect(history.canUndo).toBe(true);
        vi.stubGlobal(
            'confirm',
            vi.fn(() => true)
        );

        await clickStart(mountAbout());

        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(false);
    });

    it('goes to the level editor', async () => {
        openedLevel();
        vi.stubGlobal(
            'confirm',
            vi.fn(() => true)
        );

        await clickStart(mountAbout());

        expect(router.currentRoute.value.path).toBe('/level/blocks');
    });
});
