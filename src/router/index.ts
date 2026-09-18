import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import AboutSide from '../views/AboutSide.vue';
import AboutView from '../views/AboutView.vue';
import AnimationBuilderView from '../views/AnimationBuilderView.vue';
import BlockBrowserView from '../views/BlockBrowserView.vue';
import BlockBuilderView from '../views/BlockBuilderView.vue';
import LevelGridView from '../views/LevelGridView.vue';
import MarkerManagerView from '../views/MarkerManagerView.vue';
import LevelListView from '../views/LevelListView.vue';
import NotYetView from '../views/NotYetView.vue';
import SettingsView from '../views/SettingsView.vue';
import TagManagerView from '../views/TagManagerView.vue';
import ThingBrowserView from '../views/ThingBrowserView.vue';
import ThingBuilderView from '../views/ThingBuilderView.vue';
import TileBrowserView from '../views/TileBrowserView.vue';
import ThingSideView from '../views/ThingSideView.vue';
import TileLoaderView from '../views/TileLoaderView.vue';
import UtilPanelView from '../views/UtilPanelView.vue';

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
    { path: '/level/blocks', components: { default: LevelGridView, side: BlockBrowserView } },
    { path: '/level/things', components: { default: LevelGridView, side: ThingBrowserView } },
    { path: '/level/tags', components: { default: LevelGridView, side: TagManagerView } },
    { path: '/level/marks', components: { default: LevelGridView, side: MarkerManagerView } },
    { path: '/level/utilpanel', components: { default: LevelGridView, side: UtilPanelView } },
    { path: '/view-thing', components: { default: LevelGridView, side: ThingSideView } },

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
