import { beforeAll, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

import type { RawAdvancedCameraCardConfig } from '../../src/config/types';
import type { FakeHASS } from '../browser/fake-hass';
import { defineHAElementStubs } from '../browser/ha-element-stubs';
import {
  MountedCard,
  MountedCardFactory,
  type MountOptions,
} from '../browser/mounted-card';
import {
  createStillCameraHASS,
  createStillImageCardConfig,
  isLiveMediaShowing,
} from '../browser/test-utils';

// The two filenames a dashboard resource can name. Home Assistant loads one of
// these directly, so their names are fixed and the rest of the output is
// hashed.
const PUBLIC_ENTRY = 'advanced-camera-card.js';
const LEGACY_ENTRY = 'frigate-hass-card.js';
const PUBLIC_ENTRIES = [PUBLIC_ENTRY, LEGACY_ENTRY];

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

        // The backticks matter! Vite leaves a dynamic import alone
        // when the file is a quoted string, and rewrites anything
        // else to append `?import`, which asks for the file as a module and
        // makes Vite refuse to serve a static one.
        //
        // The comment only silences the warning that the name could not be read
        // at build time.
        await import(/* @vite-ignore */ `${url}`);
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
  hass: FakeHASS = createStillCameraHASS(),
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

    for (const entry of PUBLIC_ENTRIES) {
      expect(files).toContain(entry);

      const source = await commands.readFile(`dist/${entry}`);
      expect(source.length).toBeLessThan(MAX_FACADE_BYTES);

      // Everything it names is a real file, and none of it is another entry.
      const specifiers = [...graph[entry].staticImports, ...graph[entry].dynamicImports];
      expect(specifiers.length).toBeGreaterThan(0);
      for (const specifier of specifiers) {
        expect(files).toContain(getFileName(specifier));
      }
    }
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

    const mounted = await mountBuiltCard(createStillCameraHASS({ language: 'de' }));
    await mounted.events.waitForFirst('advanced-camera-card:media:loaded');

    expect(getLanguageChunks()).toEqual([expect.stringMatching(/^lang-de-/)]);
  });
});
