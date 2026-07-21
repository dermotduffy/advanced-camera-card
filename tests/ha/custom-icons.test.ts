import { readFileSync } from 'fs';
import { join } from 'path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  CUSTOM_ICON_NAMES,
  CUSTOM_ICONSET_PREFIX,
  registerCustomIconset,
} from '../../src/ha/custom-icons';

// @vitest-environment jsdom
describe('registerCustomIconset', () => {
  beforeEach(() => {
    delete window.customIcons;
  });

  it('should register the iconset', () => {
    registerCustomIconset();

    expect(window.customIcons?.[CUSTOM_ICONSET_PREFIX]).toBeDefined();
  });

  it('should leave an existing registration in place', () => {
    registerCustomIconset();
    const helpers = window.customIcons?.[CUSTOM_ICONSET_PREFIX];

    registerCustomIconset();

    expect(window.customIcons?.[CUSTOM_ICONSET_PREFIX]).toBe(helpers);
  });

  it('should leave other iconsets untouched', () => {
    const other = {
      getIcon: async () => ({ path: '' }),
      getIconList: async () => [],
    };
    window.customIcons = { other: other };

    registerCustomIconset();

    expect(window.customIcons['other']).toBe(other);
    expect(window.customIcons[CUSTOM_ICONSET_PREFIX]).toBeDefined();
  });

  it('should resolve an icon', async () => {
    registerCustomIconset();

    await expect(
      window.customIcons?.[CUSTOM_ICONSET_PREFIX].getIcon('frigate'),
    ).resolves.toEqual({
      path: expect.stringMatching(/^M/),
      viewBox: '0 0 24 24',
    });
  });

  it('should resolve an icon with a non-default viewBox', async () => {
    registerCustomIconset();

    await expect(
      window.customIcons?.[CUSTOM_ICONSET_PREFIX].getIcon('tplink'),
    ).resolves.toEqual({
      path: expect.stringMatching(/^M/),
      viewBox: '0 0 256 256',
    });
  });

  it('should reject an unknown icon', async () => {
    registerCustomIconset();

    await expect(
      window.customIcons?.[CUSTOM_ICONSET_PREFIX].getIcon('unknown'),
    ).rejects.toThrow('Unknown icon: advanced-camera-card:unknown');
  });

  it('should list the icons', async () => {
    registerCustomIconset();

    await expect(
      window.customIcons?.[CUSTOM_ICONSET_PREFIX].getIconList(),
    ).resolves.toEqual([
      { name: 'frigate' },
      { name: 'iris' },
      { name: 'motioneye' },
      { name: 'reolink' },
      { name: 'tplink' },
    ]);
  });
});

describe('custom icon assets', () => {
  it.each(CUSTOM_ICON_NAMES)('should have a single-path SVG asset for %s', (name) => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'images', 'icons', `${name}.svg`),
      'utf-8',
    );
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');

    expect(doc.querySelectorAll('svg > path')).toHaveLength(1);
    expect(doc.querySelector('svg > path')?.getAttribute('d')).toBeTruthy();
    expect(doc.querySelector('svg')?.getAttribute('viewBox')).toBeTruthy();
  });
});
