const BROWSERS = ['chromium', 'firefox', 'webkit'] as const;

export type Browser = (typeof BROWSERS)[number];

const isValidBrowser = (name: string): name is Browser =>
  BROWSERS.some((browser) => browser === name);

/**
 * Which browsers to run, all of them unless one is named. CI names one per job
 * so that the three run at the same time on separate machines rather than one
 * after another on one.
 *
 * Shared by every suite that mounts the card, so that naming a browser means
 * the same thing to each of them.
 */
export const getBrowsers = (): readonly Browser[] => {
  const requested = process.env.VITEST_BROWSER;
  if (requested === undefined) {
    return BROWSERS;
  }

  if (!isValidBrowser(requested)) {
    throw new Error(`Unknown browser: ${requested}`);
  }

  return [requested];
};
