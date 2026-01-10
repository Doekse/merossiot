'use strict';

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'coverage/**',
            '*.min.js',
            'packages/**/cli/tests/**',
            'packages/**/example/**'
        ]
    },
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                // Node.js globals
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                global: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly',
                // Node.js 18+ Web API globals
                fetch: 'readonly',
                AbortController: 'readonly',
                URLSearchParams: 'readonly'
            }
        },
        rules: {
            'no-console': 'off',
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_|^(err|error|e)$'
            }],
            'no-undef': 'error',
            'eqeqeq': ['error', 'always'],
            'curly': ['error', 'all'],
            'no-throw-literal': 'error',
            'prefer-const': 'warn',
            'no-var': 'warn',
            'strict': ['error', 'global'],
            'comma-dangle': ['error', 'never'],
            'semi': ['error', 'always'],
            'quotes': ['error', 'single', { avoidEscape: true }],
            'indent': ['error', 4],
            'max-len': ['warn', {
                code: 140,
                ignoreUrls: true,
                ignoreStrings: true,
                ignoreTemplateLiterals: true,
                ignoreComments: true,
                ignoreRegExpLiterals: true
            }],
            'max-statements': ['warn', 50],
            'complexity': ['warn', 15],
            'no-trailing-spaces': 'error',
            'eol-last': ['error', 'always'],
            'object-curly-spacing': ['error', 'always'],
            'array-bracket-spacing': ['error', 'never'],
            'comma-spacing': ['error', { before: false, after: true }],
            'key-spacing': ['error', { beforeColon: false, afterColon: true }],
            'space-before-blocks': ['error', 'always'],
            'space-before-function-paren': ['error', {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'always'
            }],
            'space-infix-ops': 'error',
            'space-unary-ops': ['error', { words: true, nonwords: false }],
            'spaced-comment': ['error', 'always', { exceptions: ['-', '+'] }],
            'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
            'brace-style': ['error', '1tbs', { allowSingleLine: true }],
            'camelcase': ['warn', {
                properties: 'always',
                ignoreDestructuring: true,
                ignoreImports: true,
                ignoreGlobals: true
            }],
            'no-empty': 'warn',
            'no-unused-expressions': 'error',
            'no-useless-return': 'error',
            'no-useless-concat': 'error',
            'prefer-template': 'warn',
            'prefer-arrow-callback': 'warn',
            'arrow-spacing': ['error', { before: true, after: true }],
            'no-duplicate-imports': 'error',
            'no-useless-constructor': 'error',
            'no-useless-rename': 'error',
            'object-shorthand': ['warn', 'always'],
            'prefer-destructuring': 'off',
            'callback-return': 'error',
            'handle-callback-err': 'error',
            'no-path-concat': 'error',
            'prefer-promise-reject-errors': 'error',
            'require-await': 'off'
        }
    },
    {
        files: ['packages/meross-cli/cli/**/*.js'],
        rules: {
            'complexity': ['warn', 25],
            'max-statements': ['warn', 100],
            'max-len': ['warn', {
                code: 150,
                ignoreUrls: true,
                ignoreStrings: true,
                ignoreTemplateLiterals: true,
                ignoreComments: true,
                ignoreRegExpLiterals: true
            }]
        }
    }
];

