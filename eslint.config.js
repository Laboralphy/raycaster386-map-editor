import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

/**
 * Shaped after `raycaster-386/eslint.config.js`, so both repositories behave
 * alike, plus the Vue plugin. `prettier` must stay last: it exists to switch
 * off the stylistic rules the earlier configs turn on.
 */
export default tseslint.config(
    { ignores: ['**/dist/**', '**/node_modules/**', '_OLD_MAPEDIT_/**', 'vault/**'] },
    ...tseslint.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    {
        files: ['**/*.vue'],
        languageOptions: { parserOptions: { parser: tseslint.parser } },
    },
    prettier,
    {
        rules: {
            curly: 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    {
        // Tests legitimately use `any` for fixtures and partial objects.
        files: ['tests/**', '**/*.test.ts'],
        rules: { '@typescript-eslint/no-explicit-any': 'off' },
    }
);
