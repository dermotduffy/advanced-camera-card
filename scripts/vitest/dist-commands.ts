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

/**
 * What a file imports, split into static imports, which the browser fetches
 * before the file runs, and dynamic ones, which it fetches only when reached.
 *
 * `specifier` is the imported path. It is missing when a dynamic import builds
 * its path at runtime (e.g. `import('./' + name)`), and a template glob is not
 * one file, so neither is recorded. `import.meta` is not an import of a file.
 */
const getImports = async (source: string): Promise<FileImports> => {
  init();
  const [imports] = parse(source);

  const staticImports: string[] = [];
  const dynamicImports: string[] = [];

  for (const imported of imports) {
    if (imported.type === 'import-meta') {
      continue;
    }
    if (imported.type === 'dynamic') {
      if (imported.specifier !== undefined && !imported.glob) {
        dynamicImports.push(imported.specifier);
      }
      continue;
    }
    staticImports.push(imported.specifier);
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
