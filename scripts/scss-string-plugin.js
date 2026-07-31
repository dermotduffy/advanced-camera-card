/**
 * Vite plugin: `import style from './foo.scss'` gives the compiled CSS as a
 * string, which is what the source tree passes to Lit's `unsafeCSS`. Left
 * alone, Vite adds those styles to the page and the import returns nothing
 * useful. Appending Vite's own `?inline` asks for the text instead, compiled by
 * the same sass the build uses.
 *
 * The build's `rollup-plugin-styler` cannot be used here: Vite always handles
 * `.scss` itself, so it would take that plugin's JavaScript output and hand it
 * to sass, which rejects it.
 *
 * @type {() => import('vite').Plugin}
 */
export const scssString = () => ({
  name: 'scss-string',

  // Vite: run before its builtin CSS handling.
  enforce: 'pre',

  async resolveId(source, importer, options) {
    if (!source.endsWith('.scss')) {
      return null;
    }
    return await this.resolve(`${source}?inline`, importer, options);
  },
});
