<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import { Canvas, MapHelper, Renderer } from '@laboralphy/raycaster386';
import flatsUrl from '../assets/textures/flats.png';
import wallsUrl from '../assets/textures/walls.png';
import { LEVEL, METRICS, SCREEN, SHADING, START } from '../level/demoLevel';
import { usePreviewStore } from '../stores/preview';

/**
 * The dependency proof: `@laboralphy/raycaster386` rendering a level in a Vite
 * dev server and a Vite production build.
 *
 * It answers step 1 of MAPEDIT_ANALYSIS.md's order — does the library install
 * and work in a modern bundler — and nothing more. The camera orbits on its own
 * so that a still screenshot cannot pass for a working render loop.
 */

const store = usePreviewStore();
const screen = useTemplateRef<HTMLCanvasElement>('screen');

let frame = 0;

onMounted(async () => {
    const canvas = screen.value;
    if (canvas === null) {
        return;
    }

    const renderer = new Renderer();
    renderer.setScreen(SCREEN);
    renderer.setMetrics(METRICS);
    renderer.setShading(SHADING);

    // The renderer performs no I/O: textures are decoded here and handed in.
    // Vite rewrites the two imports above to served URLs, which is the half of
    // the dependency a typecheck cannot prove.
    store.status = 'loading textures...';
    const [walls, flats] = await Canvas.loadCanvases([wallsUrl, flatsUrl]);
    renderer.setWallTextures(walls);
    renderer.setFlatTextures(flats);

    new MapHelper().build(renderer, LEVEL);
    store.status = null;

    const target = canvas.getContext('2d');
    if (target === null) {
        store.status = 'no 2d context';
        return;
    }
    // Pixel art: never smooth the upscale.
    target.imageSmoothingEnabled = false;

    const x = START.x * METRICS.spacing;
    const y = START.y * METRICS.spacing;
    let angle = -Math.PI / 2;
    let previous = performance.now();

    const draw = (now: number): void => {
        const elapsed = Math.min(now - previous, 250);
        previous = now;

        // A slow orbit, in radians per second, so the frame is visibly live.
        angle += (elapsed / 1000) * 0.35;
        renderer.render(x, y, angle, START.height);

        const source = renderer.renderCanvas;
        if (source !== null) {
            target.drawImage(source, 0, 0, canvas.width, canvas.height);
        }
        store.countFrame(elapsed);
        frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
});

onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
    <section class="preview">
        <h1>Raycaster Map Editor</h1>
        <p class="lede">
            Scaffold check: <code>@laboralphy/raycaster386</code> rendering a hard-coded level
            through Vite.
        </p>

        <canvas ref="screen" :width="SCREEN.width" :height="SCREEN.height" class="screen"></canvas>

        <p class="readout">
            <span v-if="store.status">{{ store.status }}</span>
            <span v-else>{{ store.fps.toFixed(0) }} fps · {{ store.frames }} frames</span>
        </p>
    </section>
</template>

<style scoped>
.preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem 1rem;
}

h1 {
    margin: 0;
    font-size: 1.5rem;
}

.lede {
    margin: 0;
    opacity: 0.7;
}

.screen {
    width: min(100%, 960px);
    /* The render surface is 320x200; let CSS do the upscale, unsmoothed. */
    aspect-ratio: 320 / 200;
    image-rendering: pixelated;
    border: 1px solid rgba(127, 127, 127, 0.4);
    background: #000;
}

.readout {
    margin: 0;
    font-family: ui-monospace, monospace;
    opacity: 0.7;
}
</style>
