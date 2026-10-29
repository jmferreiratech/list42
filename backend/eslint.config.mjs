import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin'
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    stylistic.configs.customize({
        indent: 4,
        semi: true,
        jsx: false,
        blockSpacing: false,
    }),
    {
        plugins: {
            'import': importPlugin,
        },
        rules: {
            'import/order': ['error', {
                'groups': [['external', 'builtin'], ['index', 'sibling', 'parent', 'internal']],
                'newlines-between': 'always',
                'alphabetize': {'order': 'asc', 'caseInsensitive': true},
            }],
            'import/no-cycle': 'warn',
        }
    },
    {
        rules: {
            'curly': 'error',
            '@stylistic/linebreak-style': ['error', 'unix'],
            '@stylistic/object-curly-spacing': ['error', 'never'],
            '@stylistic/object-curly-newline': ['error', {'multiline': true, 'consistent': true}],
            '@stylistic/brace-style': ['error', '1tbs'],
            '@typescript-eslint/no-shadow': ['error', {'builtinGlobals': true, 'hoist': 'all'}],
            '@typescript-eslint/no-unused-vars': ['error', {'ignoreRestSiblings': true, 'argsIgnorePattern': '^_'}],
            '@typescript-eslint/restrict-template-expressions': ['error', {
                allow: [{ name: ['Error', 'URL', 'URLSearchParams'], from: 'lib' }],
                allowAny: true,
                allowBoolean: true,
                allowNullish: true,
                allowNumber: true,
                allowRegExp: true,
            }],
        }
    }
);
