import browserslist from 'browserslist';

// browserslist name -> esbuild name. All supported browsers not explicitly named
// are built on one of these.
const ESBUILD_ENGINES: Record<string, string> = {
  chrome: 'chrome',
  edge: 'edge',
  firefox: 'firefox',
  ios_saf: 'ios',
  opera: 'opera',
  safari: 'safari',
};

/**
 * The oldest release of each browser the card supports, written in an esbuild
 * compatible way (i.e `safari16.4`, `chrome111`).
 */
export const getBrowserTargets = (): string[] => {
  const oldest = new Map<string, string>();

  for (const entry of browserslist()) {
    const [browser, version] = entry.split(' ');
    const engine = ESBUILD_ENGINES[browser];
    if (!engine) {
      continue;
    }

    // One entry can name a run of releases sharing a compatibility record (e.g.
    // `ios_saf 16.6-16.7`); the first of them has to work.
    oldest.set(engine, version.split('-')[0]);
  }

  return [...oldest].map(([engine, version]) => `${engine}${version}`);
};
