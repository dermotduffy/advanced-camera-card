import { readFileSync } from 'node:fs';

/**
 * Rollup/Vite plugin: importing an SVG yields `{ path, viewBox }` extracted at
 * build time, the shape a Home Assistant custom iconset serves. The SVG must
 * be a single-path icon.
 *
 * @type {() => import('rollup').Plugin}
 */
export const svgPath = () => ({
  name: 'svg-path',

  // Vite: run before its builtin asset handling.
  enforce: 'pre',

  load(id) {
    if (!id.endsWith('.svg')) {
      return null;
    }
    const source = readFileSync(id, 'utf-8');
    const path = / d="([^"]*)"/.exec(source)?.[1];
    const viewBox = /viewBox="([^"]*)"/.exec(source)?.[1];
    if (!path || !viewBox) {
      throw new Error(`Imported SVG must have a path and viewBox: ${id}`);
    }
    return `export default ${JSON.stringify({ path, viewBox })};`;
  },
});
