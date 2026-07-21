import { describe, expect, it } from 'vitest';

import {
  applyConfigChanges,
  computeConfigChanges,
  computeDisplayedData,
  forEachFieldRecursively,
} from '../../../src/components-lib/editor/form-data';
import type { ConfigChange, EditorForm } from '../../../src/components-lib/editor/types';
import { getConfigValue } from '../../../src/config/management';
import type { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import type { HAFormSchema } from '../../../src/ha/types';

const createForm = (schema: HAFormSchema[] = SCHEMA): EditorForm => ({
  basePath: ['live'],
  schema,
});
const createConfig = (live: unknown) => ({ live });

const SCHEMA: HAFormSchema[] = [
  { name: 'title', selector: { text: {} } },
  { name: 'preload', selector: { boolean: {} } },
  {
    name: 'controls',
    type: 'expandable',
    schema: [
      { name: 'wheel', selector: { boolean: {} } },
      { name: 'size', selector: { number: { min: 0 } } },
      {
        name: 'thumbnails',
        type: 'expandable',
        schema: [{ name: 'mode', selector: { select: { options: ['none'] } } }],
      },
    ],
  },
  { name: 'modes', selector: { select: { options: ['a', 'b'], multiple: true } } },
];

// Defaults mirror the configuration shape; the form displays these where the
// configuration leaves a field unset.
const DEFAULTS = {
  preload: false,
  controls: { wheel: true },
};

describe('forEachFieldRecursively', () => {
  it('should not add a nameless grouping to the path', () => {
    const visited: string[][] = [];
    forEachFieldRecursively(
      [
        {
          type: 'expandable',
          schema: [{ name: 'style', selector: { text: {} } }],
        },
      ],
      (path) => visited.push(path),
    );
    expect(visited).toEqual([['style']]);
  });

  it('should visit every leaf field with its relative path', () => {
    const visited: [string[], string][] = [];
    forEachFieldRecursively(SCHEMA, (path, field) => visited.push([path, field.name]));
    expect(visited).toEqual([
      [['title'], 'title'],
      [['preload'], 'preload'],
      [['controls', 'wheel'], 'wheel'],
      [['controls', 'size'], 'size'],
      [['controls', 'thumbnails', 'mode'], 'mode'],
      [['modes'], 'modes'],
    ]);
  });
});

describe('computeDisplayedData', () => {
  it('should fill in defaults for absent fields', () => {
    expect(
      computeDisplayedData(createForm(), createConfig({}), createConfig(DEFAULTS)),
    ).toEqual({
      preload: false,
      controls: { wheel: true },
    });
  });

  it('should not override configured values with defaults', () => {
    expect(
      computeDisplayedData(
        createForm(),
        createConfig({ preload: true, controls: { wheel: false } }),
        createConfig(DEFAULTS),
      ),
    ).toEqual({
      preload: true,
      controls: { wheel: false },
    });
  });

  it('should only fill in fields that have a default', () => {
    // `title` and `modes` have no default in DEFAULTS, so they stay absent.
    expect(
      computeDisplayedData(createForm(), createConfig({}), createConfig(DEFAULTS)),
    ).not.toHaveProperty('title');
  });

  it('should preserve unknown keys', () => {
    expect(
      computeDisplayedData(
        createForm(),
        createConfig({ unknown_key: 42 }),
        createConfig(DEFAULTS),
      ),
    ).toEqual({
      unknown_key: 42,
      preload: false,
      controls: { wheel: true },
    });
  });

  it('should treat a non-object configuration as empty', () => {
    expect(
      computeDisplayedData(
        createForm(),
        createConfig('NOT_AN_OBJECT'),
        createConfig(DEFAULTS),
      ),
    ).toEqual({
      preload: false,
      controls: { wheel: true },
    });
  });

  it('should tolerate absent defaults', () => {
    expect(
      computeDisplayedData(createForm(), createConfig({ title: 'Front' }), {}),
    ).toEqual({
      title: 'Front',
    });
  });

  it('should not modify the raw configuration', () => {
    const raw = { title: 'Front' };
    computeDisplayedData(createForm(), createConfig(raw), createConfig(DEFAULTS));
    expect(raw).toEqual({ title: 'Front' });
  });

  it('should copy non-primitive defaults rather than share them', () => {
    const defaults = { modes: ['a'] };
    const schema: HAFormSchema[] = [
      { name: 'modes', selector: { select: { options: ['a', 'b'], multiple: true } } },
    ];
    const data = computeDisplayedData(
      createForm(schema),
      createConfig({}),
      createConfig(defaults),
    );
    expect(data.modes).toEqual(['a']);
    expect(data.modes).not.toBe(defaults.modes);
  });
});

describe('computeConfigChanges', () => {
  it('should return no changes for a non-object emission', () => {
    expect(computeConfigChanges(createForm(), {}, 'NOT_AN_OBJECT', {})).toEqual([]);
  });

  it('should return no changes when nothing changed', () => {
    const displayed = computeDisplayedData(
      createForm(),
      createConfig({ title: 'Front' }),
      createConfig(DEFAULTS),
    );
    expect(computeConfigChanges(createForm(), displayed, displayed, {})).toEqual([]);
  });

  it('should never report an untouched display default', () => {
    const displayed = computeDisplayedData(
      createForm(),
      createConfig({}),
      createConfig(DEFAULTS),
    );
    expect(computeConfigChanges(createForm(), displayed, { ...displayed }, {})).toEqual(
      [],
    );
  });

  it('should report a changed value', () => {
    const displayed = computeDisplayedData(
      createForm(),
      createConfig({}),
      createConfig(DEFAULTS),
    );
    expect(
      computeConfigChanges(
        createForm(),
        displayed,
        { ...displayed, title: 'Front' },
        {},
      ),
    ).toEqual([{ path: ['live', 'title'], type: 'set', value: 'Front' }]);
  });

  it('should report a changed nested value', () => {
    const displayed = computeDisplayedData(
      createForm(),
      createConfig({}),
      createConfig(DEFAULTS),
    );
    expect(
      computeConfigChanges(
        createForm(),
        displayed,
        { preload: false, controls: { wheel: false } },
        {},
      ),
    ).toEqual([{ path: ['live', 'controls', 'wheel'], type: 'set', value: false }]);
  });

  it('should report a value set back to its default as a change', () => {
    // Diffing against the displayed baseline: when the stored value is
    // non-default, returning it to the default value is a real change (this is
    // how a user pins a default-equal value).
    const displayed = computeDisplayedData(
      createForm(),
      createConfig({ controls: { wheel: false } }),
      createConfig(DEFAULTS),
    );
    const emitted = { ...displayed, controls: { wheel: true } };
    expect(computeConfigChanges(createForm(), displayed, emitted, {})).toEqual([
      { path: ['live', 'controls', 'wheel'], type: 'set', value: true },
    ]);
  });

  it('should trim string values', () => {
    expect(computeConfigChanges(createForm(), {}, { title: '  Front  ' }, {})).toEqual([
      { path: ['live', 'title'], type: 'set', value: 'Front' },
    ]);
  });

  it('should not report a value that only differs by whitespace', () => {
    expect(
      computeConfigChanges(createForm(), { title: 'Front' }, { title: ' Front ' }, {}),
    ).toEqual([]);
  });

  it('should request deletion for an emptied string', () => {
    expect(
      computeConfigChanges(createForm(), { title: 'Front' }, { title: '' }, {}),
    ).toEqual([{ path: ['live', 'title'], type: 'delete' }]);
  });

  it('should request deletion for a cleared value', () => {
    expect(
      computeConfigChanges(
        createForm(),
        { controls: { size: 5 } },
        { controls: { size: undefined } },
        {},
      ),
    ).toEqual([{ path: ['live', 'controls', 'size'], type: 'delete' }]);
  });

  it('should set a zero value rather than delete it', () => {
    expect(
      computeConfigChanges(createForm(), {}, { controls: { size: 0 } }, {}),
    ).toEqual([{ path: ['live', 'controls', 'size'], type: 'set', value: 0 }]);
  });

  it('should compare multi-select arrays by value', () => {
    expect(
      computeConfigChanges(createForm(), { modes: ['a'] }, { modes: ['a'] }, {}),
    ).toEqual([]);
    expect(
      computeConfigChanges(createForm(), { modes: ['a'] }, { modes: ['a', 'b'] }, {}),
    ).toEqual([{ path: ['live', 'modes'], type: 'set', value: ['a', 'b'] }]);
  });

  it('should ignore emitted keys that are not in the schema', () => {
    expect(computeConfigChanges(createForm(), {}, { unknown_key: 42 }, {})).toEqual([]);
  });
});

describe('applyConfigChanges', () => {
  it('should return null without changes', () => {
    expect(applyConfigChanges({ title: 'Front' }, [])).toBeNull();
  });

  it('should set values', () => {
    expect(
      applyConfigChanges({}, [{ path: ['title'], type: 'set', value: 'Front' }]),
    ).toEqual({ title: 'Front' });
  });

  it('should create intermediate objects for absent branches', () => {
    expect(
      applyConfigChanges({}, [
        { path: ['image', 'proxy', 'dynamic'], type: 'set', value: true },
      ]),
    ).toEqual({ image: { proxy: { dynamic: true } } });
  });

  it('should delete values', () => {
    expect(
      applyConfigChanges({ image: { preload: true } }, [
        { path: ['image', 'preload'], type: 'delete' },
      ]),
    ).toEqual({ image: {} });
  });

  it('should leave unknown keys untouched', () => {
    expect(
      applyConfigChanges({ image: { unknown_key: 42 } }, [
        { path: ['image', 'title'], type: 'set', value: 'Front' },
      ]),
    ).toEqual({ image: { unknown_key: 42, title: 'Front' } });
  });

  it('should return null when the changes leave the configuration unmodified', () => {
    expect(
      applyConfigChanges({}, [{ path: ['image', 'preload'], type: 'delete' }]),
    ).toBeNull();
  });

  it('should not modify the given configuration', () => {
    const config = { image: { preload: true } };
    applyConfigChanges(config, [
      { path: ['image', 'preload'], type: 'set', value: false },
    ]);
    expect(config).toEqual({ image: { preload: true } });
  });

  it('should copy the values it sets rather than share them', () => {
    const value = { mode: 'none' };
    const result = applyConfigChanges({}, [
      { path: ['image', 'thumbnails'], type: 'set', value },
    ]);
    expect(getConfigValue(result ?? {}, 'image.thumbnails')).toEqual(value);
    expect(getConfigValue(result ?? {}, 'image.thumbnails')).not.toBe(value);
  });
});

describe('field bindings', () => {
  // A form gathering fields from across the configuration: the field is shown
  // in the form under its own name, but stored somewhere else entirely.
  const BOUND_FORM: EditorForm = {
    basePath: [],
    schema: [{ name: 'menu_style', selector: { text: {} } }],
    bindings: [{ formPath: ['menu_style'], configPath: ['menu', 'style'] }],
  };

  it('should display the value from the bound path', () => {
    expect(computeDisplayedData(BOUND_FORM, { menu: { style: 'outside' } }, {})).toEqual(
      { menu: { style: 'outside' }, menu_style: 'outside' },
    );
  });

  it('should display nothing for a bound path with no value or default', () => {
    expect(computeDisplayedData(BOUND_FORM, {}, {})).toEqual({ menu_style: undefined });
  });

  it('should display a bound path configured to null as null', () => {
    // As an unbound field would: only an absent value falls back to a default.
    expect(
      computeDisplayedData(
        BOUND_FORM,
        { menu: { style: null } },
        { menu: { style: 'hidden' } },
      ),
    ).toMatchObject({ menu_style: null });
  });

  it('should bind nothing for a path that names no field', () => {
    const form: EditorForm = {
      basePath: ['live'],
      schema: [
        {
          name: 'controls',
          type: 'expandable',
          schema: [{ name: 'mode', selector: { text: {} } }],
        },
      ],
      // A group, not a field: its fields are bound individually or not at all.
      bindings: [{ formPath: ['controls'], configPath: ['elsewhere'] }],
    };

    expect(computeConfigChanges(form, {}, { controls: { mode: 'above' } }, {})).toEqual([
      { path: ['live', 'controls', 'mode'], type: 'set', value: 'above' },
    ]);
  });

  it('should display the default of the bound path', () => {
    expect(computeDisplayedData(BOUND_FORM, {}, { menu: { style: 'hidden' } })).toEqual({
      menu_style: 'hidden',
    });
  });

  it('should write an edit to the bound path', () => {
    expect(
      computeConfigChanges(
        BOUND_FORM,
        { menu_style: 'hidden' },
        { menu_style: 'overlay' },
        {},
      ),
    ).toEqual([{ path: ['menu', 'style'], type: 'set', value: 'overlay' }]);
  });

  it('should delete the bound path for an emptied field', () => {
    expect(
      computeConfigChanges(BOUND_FORM, { menu_style: 'hidden' }, { menu_style: '' }, {}),
    ).toEqual([{ path: ['menu', 'style'], type: 'delete' }]);
  });

  describe('with a field that reads and writes itself', () => {
    // One field standing for many configuration keys: a list of which menu
    // buttons are on, where each button stores its own `enabled`. This is what
    // a computed binding exists for: the field's shape in the form and its
    // shape in the configuration have nothing to do with each other.
    const BUTTONS = ['cameras', 'fullscreen', 'timeline'];
    const isEnabled = (
      config: RawAdvancedCameraCardConfig,
      defaults: RawAdvancedCameraCardConfig,
      button: string,
    ): boolean =>
      (getConfigValue(config, ['menu', 'buttons', button, 'enabled']) ??
        getConfigValue(defaults, ['menu', 'buttons', button, 'enabled'])) !== false;

    const BUTTONS_FORM: EditorForm = {
      basePath: [],
      schema: [
        {
          name: 'buttons',
          selector: { select: { options: BUTTONS, multiple: true } },
        },
      ],
      bindings: [
        {
          formPath: ['buttons'],
          read: (config, defaults) =>
            BUTTONS.filter((button) => isEnabled(config, defaults, button)),
          write: (value, config, defaults) => {
            const enabled = Array.isArray(value) ? value : [];
            return BUTTONS.flatMap((button): ConfigChange[] => {
              const path = ['menu', 'buttons', button, 'enabled'];
              const wanted = enabled.includes(button);
              if (wanted === isEnabled(config, defaults, button)) {
                return [];
              }
              // Returning to the default deletes the key rather than writing a
              // value the user never set.
              const isDefault = wanted === (getConfigValue(defaults, path) !== false);
              return isDefault
                ? [{ path, type: 'delete' }]
                : [{ path, type: 'set', value: wanted }];
            });
          },
        },
      ],
    };

    const DEFAULTS = {
      menu: {
        buttons: {
          cameras: { enabled: true },
          fullscreen: { enabled: false },
          timeline: { enabled: true },
        },
      },
    };

    it('should display the buttons that are on', () => {
      expect(
        computeDisplayedData(
          BUTTONS_FORM,
          { menu: { buttons: { timeline: { enabled: false } } } },
          DEFAULTS,
        ),
      ).toMatchObject({ buttons: ['cameras'] });
    });

    it('should write only the buttons whose state actually changed', () => {
      const config = {};
      const displayed = computeDisplayedData(BUTTONS_FORM, config, DEFAULTS);

      // Turn `fullscreen` on (it defaults off) and `cameras` off (defaults on).
      expect(
        computeConfigChanges(
          BUTTONS_FORM,
          displayed,
          { buttons: ['fullscreen', 'timeline'] },
          config,
          DEFAULTS,
        ),
      ).toEqual([
        { path: ['menu', 'buttons', 'cameras', 'enabled'], type: 'set', value: false },
        {
          path: ['menu', 'buttons', 'fullscreen', 'enabled'],
          type: 'set',
          value: true,
        },
      ]);
    });

    it('should delete a button returned to its default rather than writing it', () => {
      const config = { menu: { buttons: { cameras: { enabled: false } } } };
      const displayed = computeDisplayedData(BUTTONS_FORM, config, DEFAULTS);

      expect(
        computeConfigChanges(
          BUTTONS_FORM,
          displayed,
          { buttons: ['cameras', 'timeline'] },
          config,
          DEFAULTS,
        ),
      ).toEqual([{ path: ['menu', 'buttons', 'cameras', 'enabled'], type: 'delete' }]);
    });
  });
});
