import { beforeAll, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

import { PUBLIC_ENTRIES, PUBLIC_ENTRY } from '../../scripts/public-entries.js';
import type { RawAdvancedCameraCardConfig } from '../../src/config/types';
import type { FakeHASS } from '../browser/fake-hass';
import { defineHAElementStubs } from '../browser/ha-element-stubs';
import {
  MountedCard,
  MountedCardFactory,
  type MountOptions,
} from '../browser/mounted-card';
import {
  createCameraHASS,
  createStillImageCardConfig,
  isLiveMediaShowing,
} from '../browser/test-utils';
import { loadModule } from './test-utils';

// A facade holds one re-export and nothing else. Generous size, so that this
// fails on an entry carrying the (whole) card rather than on formatting.
const MAX_FACADE_BYTES = 1024;

// What HACS appends to a dashboard resource URL. The value is arbitrary; that
// there is one is the point.
const HACSTAG = '1234567890';

const CARD_ELEMENT = 'advanced-camera-card';
const LEGACY_CARD_ELEMENT = 'frigate-card';

interface DistImports {
  staticImports: string[];
  dynamicImports: string[];
}

declare module 'vitest/browser' {
  interface BrowserCommands {
    listDistFiles: () => Promise<string[]>;
    getDistImportGraph: () => Promise<Record<string, DistImports>>;
  }
}

/**
 * The card types registered in Home Assistant's card picker.
 */
const getRegisteredCardTypes = (): string[] => {
  const registry: unknown = Reflect.get(window, 'customCards');
  if (!Array.isArray(registry)) {
    return [];
  }
  return registry.flatMap((entry: unknown) =>
    typeof entry === 'object' && entry !== null && 'type' in entry
      ? [String(entry.type)]
      : [],
  );
};

// Read before the bundle is loaded below, so a test can tell what loading it
// registered.
const registrationsBeforeLoad = {
  card: !!customElements.get(CARD_ELEMENT),
  legacy: !!customElements.get(LEGACY_CARD_ELEMENT),
  cardTypes: getRegisteredCardTypes(),
};

const getFileName = (specifier: string): string =>
  specifier.split('/').pop() ?? specifier;

class BuildMountedCardFactory extends MountedCardFactory {
  /**
   * A card loaded from `url`, the way Home Assistant loads one: as a dashboard
   * resource, with a HACS tag attached.
   */
  public static async createFromBuild(
    url: string,
    config: RawAdvancedCameraCardConfig,
    hass: FakeHASS,
    options?: MountOptions,
  ): Promise<MountedCard> {
    return await MountedCard.create(
      async () => {
        // The card side-loads Home Assistant's own elements as a required step
        // of initializing, and gives up if they cannot be had. Before the card
        // loads, because the build subclasses the three player elements as soon
        // as they exist.
        defineHAElementStubs();

        await loadModule(url);
      },
      config,
      hass,
      options,
    );
  }
}

/**
 * The built card on the page, mounted from the file Home Assistant would load
 * rather than from `src/`.
 */
const mountBuiltCard = async (
  hass: FakeHASS = createCameraHASS(),
): Promise<MountedCard> =>
  await BuildMountedCardFactory.createFromBuild(
    `/${PUBLIC_ENTRY}?hacstag=${HACSTAG}`,
    createStillImageCardConfig(),
    hass,
  );

beforeAll(async () => {
  // These tests read a build rather than making one. Insist on existence.
  const files = await commands.listDistFiles();
  if (!files.includes(PUBLIC_ENTRY)) {
    throw new Error(`No build to test. Run \`yarn run build\` first.`);
  }
});

describe('the built card', () => {
  it('should ship a public entry that only re-exports a hashed chunk', async () => {
    const files = await commands.listDistFiles();
    const graph = await commands.getDistImportGraph();
    const facadeImports = new Set<string>();

    for (const entry of PUBLIC_ENTRIES) {
      expect(files).toContain(entry);

      const source = await commands.readFile(`dist/${entry}`);
      expect(source.length).toBeLessThan(MAX_FACADE_BYTES);

      // A facade re-exports one hashed chunk and does nothing else. Anything
      // more -- a second import, or one reached through another file -- is the
      // card being split across the name that Home Assistant loads, which is
      // what the whole arrangement exists to prevent.
      expect(graph[entry].dynamicImports).toEqual([]);
      expect(graph[entry].staticImports).toHaveLength(1);

      const imported = getFileName(graph[entry].staticImports[0]);
      expect(files).toContain(imported);
      expect(imported).toMatch(/-[A-Za-z0-9_-]{8}\.js$/);

      facadeImports.add(imported);
    }

    // Both public entries should re-export the same chunk.
    expect(facadeImports.size).toBe(1);
  });

  it('should hand the browser the file exactly as it was built', async () => {
    const served = await (await fetch(`/${PUBLIC_ENTRY}`)).text();

    // Every other test here assumes the card it loads is the built one, which
    // stops being true if Vite transforms the file on the way in.
    expect(served).toBe(await commands.readFile(`dist/${PUBLIC_ENTRY}`));
  });

  it('should never import a public entry from another file', async () => {
    const graph = await commands.getDistImportGraph();

    // The browser treats a different URL as a different file, so a chunk
    // importing the untagged entry would fetch and run the card a second time.
    const offenders = Object.entries(graph).flatMap(([file, imports]) =>
      [...imports.staticImports, ...imports.dynamicImports]
        .filter((specifier) => PUBLIC_ENTRIES.includes(getFileName(specifier)))
        .map((specifier) => `${file} -> ${specifier}`),
    );

    expect(offenders).toEqual([]);
  });

  it('should not fetch lazily loaded code before the card runs', async () => {
    const graph = await commands.getDistImportGraph();

    // What the browser fetches before the card runs: the entry and everything
    // reachable from it without a dynamic import. Each file found is appended
    // and then followed in turn, until nothing new turns up.
    const fetchedAtStartup = [PUBLIC_ENTRY];
    for (let index = 0; index < fetchedAtStartup.length; index++) {
      for (const specifier of graph[fetchedAtStartup[index]]?.staticImports ?? []) {
        const imported = getFileName(specifier);
        if (!fetchedAtStartup.includes(imported)) {
          fetchedAtStartup.push(imported);
        }
      }
    }

    // Verify lazy loading still works. Use the editor as a sample as it is one
    // of the largest things the card can load, so it is the clearest signal
    // that chunking has stopped working correctly.
    const editor = Object.keys(graph).filter((file) => file.startsWith('editor-'));
    expect(editor).toHaveLength(1);
    expect(fetchedAtStartup).not.toContain(editor[0]);
  });

  it('should only have JavaScript output', async () => {
    const files = await commands.listDistFiles();

    // Home Assistant is pointed at one file and a release ships `dist/*.js`, so
    // a stylesheet or an image emitted beside the bundle would never reach a
    // user. Sourcemaps are allowed: a development build writes them, and they
    // are not something the card fetches.
    const assets = files.filter(
      (file) => !file.endsWith('.js') && !file.endsWith('.js.map'),
    );

    expect(assets).toEqual([]);
  });

  it('should register the card exactly once when loaded with a HACS tag', async () => {
    expect(registrationsBeforeLoad.card).toBe(false);
    expect(registrationsBeforeLoad.legacy).toBe(false);
    expect(registrationsBeforeLoad.cardTypes).not.toContain(CARD_ELEMENT);

    await mountBuiltCard();

    expect(customElements.get(CARD_ELEMENT)).toBeDefined();
    expect(customElements.get(LEGACY_CARD_ELEMENT)).toBeDefined();

    expect(
      getRegisteredCardTypes().filter((type) => type.includes(CARD_ELEMENT)),
    ).toHaveLength(1);
  });

  it('should start up and show its camera', async () => {
    const mounted = await mountBuiltCard();

    // Starting up runs the whole of Lit's update cycle, which reaches the card
    // only through the accessors `@property` installs. Were the decorator
    // output wrong, writes would land on plain instance fields and none of this
    // would work. This verifies the build's treatment of decorators rather than
    // the card's behaviour per se (already well covered in other tests).
    await mounted.events.waitForFirst('advanced-camera-card:media:loaded');

    expect(isLiveMediaShowing(mounted.card)).toBe(true);
  });

  it('should fetch a language chunk only when that language is used', async () => {
    const getLanguageChunks = (): string[] =>
      performance
        .getEntriesByType('resource')
        .map((entry) => getFileName(entry.name))
        .filter((file) => file.startsWith('lang-'));

    // Clear resource timings to only measure the impact of mounting the card.
    performance.clearResourceTimings();

    const mounted = await mountBuiltCard(createCameraHASS({ language: 'de' }));
    await mounted.events.waitForFirst('advanced-camera-card:media:loaded');

    expect(getLanguageChunks()).toEqual([expect.stringMatching(/^lang-de-/)]);
  });
});
