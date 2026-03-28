import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MockProxy, mock } from 'vitest-mock-extended';
import type { HomeAssistant } from '../../src/ha/types';

// localize.ts stores the active language and loaded translations in module-level
// variables. resetModules() clears Vitest's module cache so each test gets a
// fresh import with those variables re-initialized.
const importFresh = async () => {
  vi.resetModules();
  return await import('../../src/localize/localize');
};

const stubGlobals = (): MockProxy<Storage> => {
  const storage = mock<Storage>();
  storage.getItem.mockReturnValue(null);
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('navigator', { languages: [] });
  return storage;
};

describe('getLanguage', () => {
  let storage: MockProxy<Storage>;

  beforeEach(() => {
    storage = stubGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return hass.language when available', async () => {
    const { getLanguage } = await importFresh();
    const hass = mock<HomeAssistant>();
    hass.language = 'fr';
    hass.selectedLanguage = null;

    expect(getLanguage(hass)).toBe('fr');
  });

  it('should return hass.selectedLanguage when language is not set', async () => {
    const { getLanguage } = await importFresh();
    const hass = mock<HomeAssistant>();

    // language must be nullish (not empty string) for selectedLanguage fallback.
    hass.language = undefined as unknown as string;
    hass.selectedLanguage = 'de';

    expect(getLanguage(hass)).toBe('de');
  });

  it('should canonicalize hyphens to underscores', async () => {
    const { getLanguage } = await importFresh();
    const hass = mock<HomeAssistant>();
    hass.language = 'pt-BR';

    expect(getLanguage(hass)).toBe('pt_BR');
  });

  it('should fall back to localStorage selectedLanguage', async () => {
    const { getLanguage } = await importFresh();
    storage.getItem.mockReturnValue(JSON.stringify('it'));

    expect(getLanguage()).toBe('it');
  });

  it('should canonicalize localStorage language', async () => {
    const { getLanguage } = await importFresh();
    storage.getItem.mockReturnValue(JSON.stringify('pt-BR'));

    expect(getLanguage()).toBe('pt_BR');
  });

  it('should skip null localStorage value', async () => {
    const { getLanguage } = await importFresh();
    storage.getItem.mockReturnValue(JSON.stringify(null));

    expect(getLanguage()).toBe('en');
  });

  it('should fall back to navigator.languages when matching a loaded language', async () => {
    vi.stubGlobal('navigator', { languages: ['en'] });
    const { getLanguage } = await importFresh();

    expect(getLanguage()).toBe('en');
  });

  it('should skip non-matching navigator languages', async () => {
    vi.stubGlobal('navigator', { languages: ['xx', 'yy'] });
    const { getLanguage } = await importFresh();

    expect(getLanguage()).toBe('en');
  });

  it('should return default language when no sources available', async () => {
    const { getLanguage } = await importFresh();

    expect(getLanguage()).toBe('en');
  });
});

describe('loadLanguages', () => {
  beforeEach(() => {
    stubGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should load and use Catalan translations', async () => {
    const { loadLanguages, localize } = await importFresh();
    const hass = mock<HomeAssistant>();
    hass.language = 'ca';

    await loadLanguages(hass);

    expect(localize('common.live')).toBe('En directe');
  });

  it('should load and use German translations', async () => {
    const { loadLanguages, localize } = await importFresh();
    const hass = mock<HomeAssistant>();
    hass.language = 'de';

    await loadLanguages(hass);

    expect(localize('actions.abort')).toBe('Aktion abbrechen');
  });

  it('should load and use French translations', async () => {
    const { loadLanguages, localize } = await importFresh();
    const hass = mock<HomeAssistant>();
    hass.language = 'fr';

    await loadLanguages(hass);

    expect(localize('common.live')).toBe('En direct');
  });

  it('should load and use Italian translations', async () => {
    const { loadLanguages, localize } = await importFresh();
    const hass = mock<HomeAssistant>();
    hass.language = 'it';

    await loadLanguages(hass);

    expect(localize('common.no_media')).toBe(
      'Nessun contenuto multimediale da visualizzare',
    );
  });

  it('should load and use Polish translations', async () => {
    const { loadLanguages, localize } = await importFresh();
    const hass = mock<HomeAssistant>();
    hass.language = 'pl';

    await loadLanguages(hass);

    expect(localize('actions.abort')).toBe('Przerwano akcję');
  });

  it('should load and use Portuguese translations', async () => {
    const { loadLanguages, localize } = await importFresh();
    const hass = mock<HomeAssistant>();
    hass.language = 'pt';

    await loadLanguages(hass);

    expect(localize('common.live')).toBe('Ao Vivo');
  });

  it('should load and use Brazilian Portuguese translations', async () => {
    const { loadLanguages, localize } = await importFresh();
    const hass = mock<HomeAssistant>();
    hass.language = 'pt_BR';
    hass.selectedLanguage = null;

    await loadLanguages(hass);

    expect(localize('common.live')).toBe('Ao Vivo');
  });

  it('should fall back to English for unsupported language', async () => {
    const { loadLanguages, localize } = await importFresh();
    const hass = mock<HomeAssistant>();
    hass.language = 'xx';

    await loadLanguages(hass);

    expect(localize('common.advanced_camera_card')).toBe('Advanced Camera Card');
  });
});

describe('localize', () => {
  beforeEach(() => {
    stubGlobals();
    vi.stubGlobal('navigator', { languages: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should resolve a dotted key from English', async () => {
    const { localize } = await importFresh();

    expect(localize('common.advanced_camera_card')).toBe('Advanced Camera Card');
  });

  it('should use loaded language when available', async () => {
    const { loadLanguages, localize } = await importFresh();
    const hass = mock<HomeAssistant>();
    hass.language = 'de';
    await loadLanguages(hass);

    // German translation should be used (and it exists).
    const result = localize('common.advanced_camera_card');
    expect(result).toBeTruthy();
  });

  it('should fall back to English when primary language key is missing', async () => {
    const { loadLanguages, localize } = await importFresh();
    const hass = mock<HomeAssistant>();
    hass.language = 'de';
    await loadLanguages(hass);

    // 'common.no_media' exists only in English, so the German lookup throws
    // and falls back to English.
    expect(localize('common.no_media')).toBe('No media to display');
  });

  it('should perform search and replace', async () => {
    const { localize } = await importFresh();

    const result = localize('common.advanced_camera_card', 'Advanced', 'Basic');
    expect(result).toBe('Basic Camera Card');
  });

  it('should not replace when search is empty', async () => {
    const { localize } = await importFresh();

    expect(localize('common.advanced_camera_card', '', '')).toBe('Advanced Camera Card');
  });

  it('should throw for completely missing key', async () => {
    const { localize } = await importFresh();

    // The first reduce throws (caught), the English fallback also throws
    // (uncaught), so this will throw a TypeError.
    expect(() => localize('nonexistent.deeply.nested.key')).toThrow();
  });

  it('should return translated value for single-segment key', async () => {
    const { localize } = await importFresh();

    // 'actions' is a top-level key that resolves to an object, not a string,
    // but should not throw.
    expect(localize('actions')).toBeTruthy();
  });
});
