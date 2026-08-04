/**
 * Emits the files a dashboard resource can name, each a re-export of the hashed
 * chunk holding the actual card.
 *
 * HACS registers the card as a dashboard resource with a `hacstag` query
 * parameter on the URL, and the browser treats a different URL as a different
 * file. Were a chunk to import the untagged name, the card would be fetched and
 * run a second time, and defining its elements twice will throw an error.
 * Keeping the card itself in a hashed chunk that nothing outside can name is
 * what prevents that, and the check below is what keeps it true.
 *
 * @type {(options: { publicFileNames: string[] }) => import('vite').Plugin}
 */
export const facadeEntry = ({ publicFileNames }) => ({
  name: 'facade-entry',

  generateBundle(_options, bundle) {
    const entries = Object.values(bundle).filter(
      (item) => item.type === 'chunk' && item.isEntry,
    );
    if (entries.length !== 1) {
      throw new Error(`Expected exactly one entry chunk, found ${entries.length}`);
    }
    const [entry] = entries;

    // A public name already in the bundle means the card was emitted under it
    // rather than into a hashed chunk, which is the arrangement this plugin
    // exists to prevent.
    const alreadyEmitted = publicFileNames.filter((name) => name in bundle);
    if (alreadyEmitted.length) {
      throw new Error(
        `The build should have emitted these under hashed names: ${alreadyEmitted.join(', ')}`,
      );
    }

    const offenders = Object.values(bundle).flatMap((item) =>
      item.type === 'chunk'
        ? [...item.imports, ...item.dynamicImports]
            .filter((imported) => publicFileNames.includes(imported))
            .map((imported) => `${item.fileName} -> ${imported}`)
        : [],
    );
    if (offenders.length) {
      throw new Error(
        `Chunks should not import a public entry point: ${offenders.join(', ')}`,
      );
    }

    for (const fileName of publicFileNames) {
      this.emitFile({
        type: 'asset',
        fileName,
        source: `export * from './${entry.fileName}';\n`,
      });
    }
  },
});
