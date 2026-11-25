import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { init, parse } from 'es-module-lexer';
import type { BrowserCommand } from 'vitest/node';

const DIST_DIRECTORY = 'dist';

const listFiles = (): string[] =>
  existsSync(DIST_DIRECTORY)
    ? readdirSync(DIST_DIRECTORY, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
    : [];

interface FileImports {
  staticImports: string[];
  dynamicImports: string[];
}

const STATIC_IMPORT = -1;

/**
 * What a file imports, split into static imports, which the browser fetches
 * before the file runs, and dynamic ones, which it fetches only when reached.
 *
 * es-module-lexer names its fields tersely. `n` is the imported path, and is
 * absent when a dynamic import builds its path at runtime (e.g. `import('./' +
 * name)`), so no one file can be recorded for it. `d` is the position of a
 * dynamic import's `import(`, or -1 for a static import and -2 for
 * `import.meta`, which is not an import of a file at all.
 */
const getImports = async (source: string): Promise<FileImports> => {
  await init;
  const [imports] = parse(source);

  const staticImports: string[] = [];
  const dynamicImports: string[] = [];

  for (const { n: importedPath, d: dynamicImportPosition } of imports) {
    if (importedPath === undefined) {
      continue;
    }

    if (dynamicImportPosition === STATIC_IMPORT) {
      staticImports.push(importedPath);
    } else if (dynamicImportPosition >= 0) {
      dynamicImports.push(importedPath);
    }
  }

  return { staticImports, dynamicImports };
};

/**
 * Facts about the built output, gathered in Node and handed to a test running
 * in the browser.
 *
 * The imports are parsed rather than searched for: the card holds its own
 * filenames as plain strings, which a text search would mistake for imports.
 */
export const distCommands: Record<string, BrowserCommand<[], unknown>> = {
  listDistFiles: () => listFiles(),

  getDistImportGraph: async () => {
    const graph: Record<string, FileImports> = {};
    for (const file of listFiles().filter((name) => name.endsWith('.js'))) {
      graph[file] = await getImports(
        readFileSync(path.resolve(DIST_DIRECTORY, file), 'utf8'),
      );
    }
    return graph;
  },
};
