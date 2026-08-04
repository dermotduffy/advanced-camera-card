import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { init, parse } from 'es-module-lexer';

const DIST_DIRECTORY = 'dist';

const listFiles = () =>
  existsSync(DIST_DIRECTORY)
    ? readdirSync(DIST_DIRECTORY, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
    : [];

/**
 * What a file imports, split into static imports, which the browser fetches
 * before the file runs, and dynamic ones, which it fetches only when reached.
 */
const getImports = async (source) => {
  await init;
  const [imports] = parse(source);

  // `n` is the file named in the import, and is absent when that name is put
  // together at runtime, which names no one file.
  const named = imports.filter((entry) => entry.n);

  // `d` says how it is imported: -1 static, -2 `import.meta`, otherwise the
  // position of the `import(`.
  return {
    staticImports: named.filter((entry) => entry.d === -1).map((entry) => entry.n),
    dynamicImports: named.filter((entry) => entry.d >= 0).map((entry) => entry.n),
  };
};

/**
 * Facts about the built output, gathered in Node and handed to a test running
 * in the browser.
 *
 * The imports are parsed rather than searched for: the card holds its own
 * filenames as plain strings, which a text search would mistake for imports.
 *
 * @type {Record<string, import('vitest/node').BrowserCommand<[], unknown>>}
 */
export const distCommands = {
  listDistFiles: () => listFiles(),

  getDistImportGraph: async () => {
    const graph = {};
    for (const file of listFiles().filter((name) => name.endsWith('.js'))) {
      graph[file] = await getImports(
        readFileSync(path.resolve(DIST_DIRECTORY, file), 'utf8'),
      );
    }
    return graph;
  },
};
