<script setup lang="ts">
import {
    mdiAnimation,
    mdiChessRook,
    mdiCog,
    mdiFolderMultipleImage,
    mdiGamepadVariant,
    mdiGrid,
    mdiHome,
    mdiInformation,
    mdiShape,
    mdiTag,
    mdiTexture,
    mdiToolbox,
    mdiWeatherFog,
} from '@mdi/js';
import type { MenuEntry } from './menu';
import MyButton from './MyButton.vue';
import SimpleMenu from './SimpleMenu.vue';
import StatusBar from './StatusBar.vue';
import SvgIcon from './SvgIcon.vue';
import { useRouter } from 'vue-router';

/**
 * The top navigation, ported from `_OLD_MAPEDIT_/src/components/MainMenu.vue`.
 *
 * Both strips are transcribed entry for entry. While screens were still
 * missing, their entries landed on `NotYetView` and said which phase would
 * bring them; as of phase 5 every entry reaches a real screen. Half-porting the
 * menu and adding entries later would have meant revisiting this file for every
 * screen.
 *
 * The old `[username]` indicator is gone with `/user.json`: the editor is
 * single-user by decision.
 */

const router = useRouter();

const main: readonly MenuEntry[] = [
    {
        icon: mdiGrid,
        route: '/level/blocks',
        highlight: /^\/level\//,
        caption: 'Level',
        title: 'Level editor',
    },
    {
        icon: mdiFolderMultipleImage,
        route: '/load-tiles',
        caption: 'Tiles',
        title: 'Load tileset and import wall and flat tiles',
    },
    { icon: mdiAnimation, route: '/build-anim', caption: 'Anim.', title: 'Make animated textures' },
    {
        icon: mdiWeatherFog,
        route: '/setup-ambiance',
        caption: 'Ambiance',
        title: 'Setup fog, brightness, and background image',
    },
    {
        icon: mdiGamepadVariant,
        route: '/render',
        caption: 'Render',
        title: 'Load the level into the raycasting engine',
    },
    {
        icon: mdiCog,
        route: '/settings',
        caption: 'Settings',
        title: 'Go to settings panel. Configure tile size and rendering flags',
    },
    { icon: mdiInformation, route: '/', caption: 'About', title: 'About this application' },
];

const tools: readonly MenuEntry[] = [
    {
        icon: mdiTexture,
        route: '/level/blocks',
        highlight: /^\/level\/block/,
        caption: 'Blocks',
        title: 'Display the block browser',
    },
    {
        icon: mdiTag,
        route: '/level/tags',
        caption: 'Tags',
        title: 'Put tags on the map to add some in-game behavior',
    },
    {
        icon: mdiShape,
        route: '/level/marks',
        caption: 'Marks',
        title: 'Put visual marks on the map',
    },
    {
        icon: mdiChessRook,
        route: '/level/things',
        highlight: /^\/level\/things/,
        caption: 'Things',
        title: 'Place sprites on the map',
    },
    {
        icon: mdiToolbox,
        route: '/level/utilpanel',
        highlight: /^\/level\/utilpanel/,
        caption: 'Util.',
        title: 'Various tools and utilities',
    },
];
</script>

<template>
    <StatusBar>
        <MyButton title="Open level" @click="router.push('/list-levels')">
            <SvgIcon :path="mdiHome" />
        </MyButton>
        <SimpleMenu :routes="main" />
        <SimpleMenu style="float: right" :routes="tools" />
    </StatusBar>
</template>
