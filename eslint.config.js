import prettierConfig from 'eslint-config-prettier'
import jestPlugin from 'eslint-plugin-jest'
import jsdocPlugin from 'eslint-plugin-jsdoc'
import globals from 'globals'
import neostandard from 'neostandard'
import tseslint from 'typescript-eslint'

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Global ignores
  {
    ignores: ['**/coverage/**', '**/dist/**', 'node_modules', 'node_modules/.*']
  },

  // Neostandard base (replaces standard + import + n + promise)
  ...neostandard({ ts: true, noStyle: true }),

  // TypeScript strict + stylistic type-checked configs
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // JSDoc recommended
  jsdocPlugin.configs['flat/recommended'],

  // Base config for all linted files
  {
    files: ['**/*.{cjs,js,mjs,ts}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      jsdoc: jsdocPlugin
    },
    rules: {
      'no-console': 'error',

      // Allow void return shorthand in arrow functions
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        {
          ignoreArrowShorthand: true
        }
      ],

      // Warn on explicit `any` usage (errors demoted to warnings)
      '@typescript-eslint/no-explicit-any': 'warn',

      // Don't show eslint warnings for types - let TS handle
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // Check type support for template string implicit `.toString()`
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowBoolean: true,
          allowNumber: true
        }
      ],

      // Skip rules handled by TypeScript compiler
      'import-x/default': 'off',
      'import-x/extensions': 'off',
      'import-x/named': 'off',
      'import-x/namespace': 'off',
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-unresolved': 'off',

      // Check import or require statements are A-Z ordered
      'import-x/order': [
        'error',
        {
          alphabetize: { order: 'asc' },
          named: true,
          'newlines-between': 'always'
        }
      ],

      // Check relative import paths use aliases
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./', '../'],
              message: "Please use '~/*' import alias instead."
            }
          ]
        }
      ],

      // Check for valid formatting
      'jsdoc/check-line-alignment': [
        'warn',
        'never',
        {
          tags: ['param', 'property', 'typedef', 'returns']
        }
      ],

      // Require hyphens before param description (TSDoc style)
      'jsdoc/require-hyphen-before-param-description': [
        'warn',
        'always',
        {
          tags: {
            param: 'always',
            property: 'always',
            returns: 'never'
          }
        }
      ],

      // JSDoc blocks are optional but must be valid
      'jsdoc/require-jsdoc': [
        'error',
        {
          enableFixer: false,
          require: {
            FunctionDeclaration: false
          }
        }
      ],

      // JSDoc @param is optional
      'jsdoc/reject-any-type': 'off',
      'jsdoc/reject-function-type': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-param': 'off',

      // JSDoc @returns is optional
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-returns-type': 'off',
      'jsdoc/require-returns': 'off',

      // Skip rules handled by TypeScript compiler
      'n/no-extraneous-require': 'off',
      'n/no-extraneous-import': 'off',
      'n/no-missing-require': 'off',
      'n/no-missing-import': 'off',

      // Prefer rules that are type aware
      'no-unused-vars': 'off',
      'no-use-before-define': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-use-before-define': ['error', 'nofunc']
    }
  },

  // JavaScript-specific JSDoc rules (require param types)
  {
    files: ['**/*.{cjs,js,mjs}'],
    ...jsdocPlugin.configs['flat/recommended-typescript-flavor'],
    rules: {
      ...jsdocPlugin.configs['flat/recommended-typescript-flavor'].rules,

      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',

      // JSDoc blocks are optional but must be valid
      'jsdoc/require-jsdoc': [
        'error',
        {
          enableFixer: false,
          require: {
            FunctionDeclaration: false
          }
        }
      ],

      // JSDoc @param types are mandatory for JavaScript
      'jsdoc/reject-any-type': 'off',
      'jsdoc/reject-function-type': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-param-type': 'error',
      'jsdoc/require-param': 'off',

      // JSDoc @returns is optional
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-returns-type': 'off',
      'jsdoc/require-returns': 'off'
    }
  },

  // CJS-specific overrides
  {
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off'
    }
  },

  // ESM source type
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      sourceType: 'module'
    }
  },

  // Jest rules for test files
  {
    files: ['**/*.test.{cjs,js,mjs}'],
    ...jestPlugin.configs['flat/recommended'],
    ...jestPlugin.configs['flat/style'],
    plugins: {
      ...jestPlugin.configs['flat/recommended'].plugins,
      ...jestPlugin.configs['flat/style'].plugins
    },
    languageOptions: {
      globals: globals.jest
    },
    rules: {
      ...jestPlugin.configs['flat/recommended'].rules,
      ...jestPlugin.configs['flat/style'].rules,

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',

      // Allow Jest to assert on mocked unbound methods
      '@typescript-eslint/unbound-method': 'off',
      'jest/unbound-method': 'error'
    }
  },

  // Prettier (disables conflicting style rules)
  prettierConfig
]
