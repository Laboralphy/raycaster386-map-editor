<script setup lang="ts">
import WindowFrame from '../components/WindowFrame.vue';
</script>

<template>
    <WindowFrame caption="About">
        <div class="about">
            <p>A level editor for the raycaster-386 engine.</p>
            <p>
                Built on
                <code>&#64;laboralphy/raycaster386</code>, the published engine library.
            </p>
            <p>
                <a href="https://github.com/Laboralphy/raycaster-386" target="_blank" rel="noopener">
                    The engine on GitHub
                </a>
            </p>
        </div>
    </WindowFrame>
</template>

<style scoped>
.about {
    padding: 1em;
    font-family: monospace;
}
</style>
