<script setup lang="ts">
import WindowFrame from '../components/WindowFrame.vue';
import splash from '../assets/splash.png';
</script>

<template>
    <WindowFrame caption="Raycaster Map Editor">
        <div class="splash">
            <img :src="splash" alt="Raycaster Map Editor" />
        </div>
    </WindowFrame>
</template>

<style scoped>
.splash {
    text-align: center;
    padding: 1em;
}

.splash img {
    max-width: 100%;
}
</style>
