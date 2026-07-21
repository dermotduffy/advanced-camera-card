import { describe, expect, it } from 'vitest';

import {
  computeFormLabel,
  getLocalizationKeyForPath,
} from '../../../src/components-lib/editor/form-labels';

describe('getLocalizationKeyForPath', () => {
  it('should build a config key without array indices', () => {
    expect(getLocalizationKeyForPath(['cameras', 2, 'title'])).toBe(
      'config.cameras.title',
    );
  });
});

describe('computeFormLabel', () => {
  it('should prefer an explicit schema label', () => {
    expect(
      computeFormLabel(['cameras', 2], {
        name: 'title',
        label: 'Explicit',
        selector: { text: {} },
      }),
    ).toBe('Explicit');
  });

  it('should localize the configuration path', () => {
    expect(computeFormLabel(['view'], { name: 'default', selector: { text: {} } })).toBe(
      'Default view',
    );
  });

  it('should include container paths provided by the form', () => {
    expect(
      computeFormLabel(
        ['cameras', 2],
        { name: 'title', selector: { text: {} } },
        { path: [] },
      ),
    ).toBe('Title for this camera (autodetected from entity)');
  });

  it('should order nested container paths into configuration order', () => {
    expect(
      computeFormLabel(
        ['cameras', 2],
        { name: 'dashboard_path', selector: { text: {} } },
        { path: ['dashboard', 'cast'] },
      ),
    ).toBe('Dashboard path');
  });

  it('should use the title for container nodes', () => {
    expect(
      computeFormLabel(['image'], {
        name: 'proxy',
        type: 'expandable',
        title: 'Proxy',
        schema: [],
      }),
    ).toBe('Proxy');
  });

  it('should fall back to the name for container nodes without a title', () => {
    expect(
      computeFormLabel(['image'], { name: 'proxy', type: 'expandable', schema: [] }),
    ).toBe('proxy');
  });

  it('should return an empty label for a nameless, titleless container', () => {
    expect(computeFormLabel(['cameras', 0], { type: 'expandable', schema: [] })).toBe(
      '',
    );
  });
});
