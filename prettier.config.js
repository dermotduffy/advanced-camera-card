// @ts-check

/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import('prettier').Options}
 * */
const config = {
  semi: true,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 89,
  tabWidth: 2,
  embeddedLanguageFormatting: 'auto',

  // Sort imports as part of formatting so editor-on-save and CI agree. Three groups
  // separated by a blank line: node built-ins, then non-relative (third-party), then
  // relative. Empty strings insert the blank line between groups; sort is
  // case-insensitive. Side-effect imports are left in place as sort barriers to
  // preserve their evaluation order. Setting the TypeScript version lets same-module
  // type and value imports combine into a single statement with an inline `type`.
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  importOrder: ['<BUILTIN_MODULES>', '', '<THIRD_PARTY_MODULES>', '', '^[.]'],
  importOrderTypeScriptVersion: '5.8.3',

  // The codebase compiles with tsconfig `experimentalDecorators` (Lit's
  // `@customElement`/`@property`/etc.), so babel must parse the legacy decorator
  // proposal; without this it throws on decorated classes and silently skips sorting
  // those files.
  importOrderParserPlugins: ['typescript', 'decorators-legacy'],
};

export default config;
