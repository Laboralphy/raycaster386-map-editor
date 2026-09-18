import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import AboutSide from '../views/AboutSide.vue';
import AboutView from '../views/AboutView.vue';
import AnimationBuilderView from '../views/AnimationBuilderView.vue';
import BlockBrowserView from '../views/BlockBrowserView.vue';
import BlockBuilderView from '../views/BlockBuilderView.vue';
import LevelListView from '../views/LevelListView.vue';
import NotYetView from '../views/NotYetView.vue';
import SettingsView from '../views/SettingsView.vue';
import ThingBrowserView from '../views/ThingBrowserView.vue';
import ThingBuilderView from '../views/ThingBuilderView.vue';
import TileBrowserView from '../views/TileBrowserView.vue';
import TileLoaderView from '../views/TileLoaderView.vue';

/**
 * Every route the old editor had, transcribed from
 * `_OLD_MAPEDIT_/src/index.js`.
 *
 * Each has two named views — the main screen and the side panel — which is what
 * the two-column layout in `App.vue` renders. Routes whose screens have not
 * been migrated yet point at `NotYetView` and carry the phase that brings them,
 * so the menu could be ported whole instead of grown one entry at a time.
 *
 * History mode rather than the old hash mode; the Koa server has an SPA
 * fallback for it.
 */

/** Both views of a route that has not been migrated yet. `meta` says which. */
const notYet = { default: NotYetView, side: NotYetView };

const routes: RouteRecordRaw[] = [
    { path: '/', name: 'about', components: { default: AboutView, side: AboutSide } },

    // The grid editor and its four side panels — phase 4.
    {
        path: '/level/blocks',
        components: { default: NotYetView, side: BlockBrowserView },
        meta: { title: 'Level grid', phase: 'phase 4 (the grid)' },
    },
    {
        path: '/level/things',
        components: { default: NotYetView, side: ThingBrowserView },
        meta: { title: 'Level grid', phase: 'phase 4 (the grid)' },
    },
    {
        path: '/level/tags',
        components: notYet,
        meta: { title: 'Tags', phase: 'phase 4 (the grid)' },
    },
    {
        path: '/level/marks',
        components: notYet,
        meta: { title: 'Marks', phase: 'phase 4 (the grid)' },
    },
    {
        path: '/level/utilpanel',
        components: notYet,
        meta: { title: 'Utilities', phase: 'phase 4 (the grid)' },
    },
    { path: '/view-thing', components: notYet, meta: { title: 'Thing', phase: 'phase 4' } },

    // Tiles and animation.
    { path: '/load-tiles', components: { default: TileLoaderView, side: TileBrowserView } },
    { path: '/build-anim', components: { default: AnimationBuilderView, side: TileBrowserView } },

    // Blocks and things — phase 3.
    { path: '/build-block/:id', components: { default: BlockBuilderView, side: TileBrowserView } },
    { path: '/build-thing/:id', components: { default: ThingBuilderView, side: TileBrowserView } },

    // Ambiance — phase 5, with the renderer that shows it.
    {
        path: '/setup-ambiance',
        components: notYet,
        meta: { title: 'Ambiance', phase: 'phase 5 (preview)' },
    },
    {
        path: '/render',
        components: notYet,
        meta: { title: 'Render', phase: 'phase 5 (preview)' },
    },

    // Built.
    { path: '/list-levels', components: { default: LevelListView, side: AboutSide } },
    { path: '/settings', components: { default: SettingsView, side: AboutSide } },

    { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});
