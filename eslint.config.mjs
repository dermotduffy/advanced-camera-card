import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

// Local rule: ban the em-dash character (U+2014) anywhere, including comments and
// strings. The codebase uses a colon or a double hyphen `--` instead. The regex uses
// the unicode escape so the character never appears literally in this file.
const noEmDash = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow the em-dash character; use ":" or "--" instead.' },
    messages: {
      emDash: 'Em-dash character is not allowed; use ":" or "--" instead.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      Program(node) {
        const text = sourceCode.getText();
        const re = /\u2014/g;
        let match;
        while ((match = re.exec(text)) !== null) {
          context.report({
            node,
            loc: {
              start: sourceCode.getLocFromIndex(match.index),
              end: sourceCode.getLocFromIndex(match.index + 1),
            },
            messageId: 'emDash',
          });
        }
      },
    };
  },
};

export default defineConfig([
  {
    extends: compat.extends('plugin:@typescript-eslint/recommended', 'prettier'),

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
    },

    plugins: {
      local: { rules: { 'no-em-dash': noEmDash } },
    },

    rules: {
      curly: 'error',
      'local/no-em-dash': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/parameter-properties': 'error',
    },
  },

  // Timers must go through the Timer class (src/utils/timer.ts).
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression > Identifier.callee[name=/^(setTimeout|setInterval)$/]',
          message:
            'Use the Timer class (src/utils/timer.ts) instead of setTimeout/setInterval.',
        },
        {
          selector: 'MemberExpression[property.name=/^(setTimeout|setInterval)$/]',
          message:
            'Use the Timer class (src/utils/timer.ts) instead of window.setTimeout/setInterval.',
        },
      ],
    },
  },

  // The rules below need type information, so the `projectService` option runs the
  // TypeScript type-checker while linting. That makes linting slower.
  {
    files: ['{scripts,src,tests}/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // A deprecation is a JSDoc `@deprecated` tag on the declaration, which is only
      // visible to the type-checker.
      '@typescript-eslint/no-deprecated': 'error',
    },
  },

  // A fire-and-forget promise must be marked with `void` to show it is deliberate.
  // Tests are excluded: they leave promises unawaited freely.
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },

  // The vitest matcher aliases (`toBeCalled`, `toThrowError`, ...) are deprecated in
  // favor of their full names. `@typescript-eslint/no-deprecated` above reports them as
  // well, but this rule names the replacement and can fix it automatically.
  {
    files: ['tests/**/*.ts'],
    plugins: { vitest },
    rules: {
      'vitest/no-alias-methods': 'error',
    },
  },
]);
