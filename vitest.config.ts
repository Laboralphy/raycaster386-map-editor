import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

/**
 * Two projects, because most of this suite has no business paying for a DOM.
 *
 * `src/domain` and `server/` are plain TypeScript — the round-trip test that
 * proves the editor does not corrupt a level runs in Node, in milliseconds.
 * Only component tests need happy-dom.
 *
 * Note happy-dom has no canvas 2d context, so anything drawing to a canvas
 * (phases 2 onward) has to take its canvas as a dependency to be testable.
 */
export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'unit',
                    include: ['tests/{domain,server,libs,stores}/**/*.test.ts'],
                    environment: 'node',
                },
            },
            {
                plugins: [vue()],
                test: {
                    name: 'dom',
                    include: ['tests/components/**/*.test.ts'],
                    environment: 'happy-dom',
                },
            },
        ],
    },
});
