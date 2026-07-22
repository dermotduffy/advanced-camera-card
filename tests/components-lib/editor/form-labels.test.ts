import { describe, expect, it } from 'vitest';

import {
  computeFormLabel,
  getLocalizationKeyForPath,
} from '../../../src/components-lib/editor/form-labels';
import type {
  ConfigPath,
  EditorForm,
  FieldBinding,
} from '../../../src/components-lib/editor/types';

const createForm = (basePath: ConfigPath, bindings?: FieldBinding[]): EditorForm => ({
  basePath,
  // The label is computed from the field it is given, so the form's own schema
  // plays no part.
  schema: [],
  ...(bindings ? { bindings } : {}),
});

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
      computeFormLabel(createForm(['cameras', 2]), {
        name: 'title',
        label: 'Explicit',
        selector: { text: {} },
      }),
    ).toBe('Explicit');
  });

  it('should localize the configuration path', () => {
    expect(
      computeFormLabel(createForm(['view']), {
        name: 'default',
        selector: { text: {} },
      }),
    ).toBe('Default view');
  });

  it('should include container paths provided by the form', () => {
    expect(
      computeFormLabel(
        createForm(['cameras', 2]),
        { name: 'title', selector: { text: {} } },
        { path: [] },
      ),
    ).toBe('Title for this camera (autodetected from entity)');
  });

  it('should order nested container paths into configuration order', () => {
    expect(
      computeFormLabel(
        createForm(['cameras', 2]),
        { name: 'dashboard_path', selector: { text: {} } },
        { path: ['dashboard', 'cast'] },
      ),
    ).toBe('Dashboard path');
  });

  it('should localize a bound field by where its setting is stored', () => {
    expect(
      computeFormLabel(
        createForm([], [{ formPath: ['menu_style'], configPath: ['menu', 'style'] }]),
        { name: 'menu_style', selector: { text: {} } },
      ),
    ).toBe('Menu style');
  });

  it('should localize a field that reads and writes itself where it sits', () => {
    // Such a field stands for more than one setting, so there is no single
    // stored setting to name it after.
    expect(
      computeFormLabel(
        createForm(
          ['editor'],
          [
            {
              formPath: ['mode'],
              configPaths: [['editor', 'mode']],
              read: () => null,
              write: () => [],
            },
          ],
        ),
        { name: 'mode', selector: { boolean: {} } },
      ),
    ).toBe('Full editor');
  });

  it('should use the title for container nodes', () => {
    expect(
      computeFormLabel(createForm(['image']), {
        name: 'proxy',
        type: 'expandable',
        title: 'Proxy',
        schema: [],
      }),
    ).toBe('Proxy');
  });

  it('should fall back to the name for container nodes without a title', () => {
    expect(
      computeFormLabel(createForm(['image']), {
        name: 'proxy',
        type: 'expandable',
        schema: [],
      }),
    ).toBe('proxy');
  });

  it('should return an empty label for a grid', () => {
    // The fields a grid lays out are labelled individually; the grid itself
    // shows nothing.
    expect(computeFormLabel(createForm([]), { type: 'grid', schema: [] })).toBe('');
  });

  it('should return an empty label for a nameless, titleless container', () => {
    expect(
      computeFormLabel(createForm(['cameras', 0]), { type: 'expandable', schema: [] }),
    ).toBe('');
  });
});
