import { createRouter, createWebHistory } from 'vue-router';
import PreviewView from './views/PreviewView.vue';

/**
 * One route, as the scaffold step calls for. The editor's real routes — the
 * grid, the block builder, the browsers — arrive with their components.
 */
export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [{ path: '/', name: 'preview', component: PreviewView }],
});
