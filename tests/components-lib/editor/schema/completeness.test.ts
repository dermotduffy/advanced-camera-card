import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  forEachFieldRecursively,
  getFormConfigPaths,
} from '../../../../src/components-lib/editor/form-data';
import {
  getCameraSchema,
  getCameraTriggersSchema,
  getTriggerEventSchema,
} from '../../../../src/components-lib/editor/schema/cameras';
import { getDimensionsSectionForms } from '../../../../src/components-lib/editor/schema/dimensions';
import { getEditorModeForms } from '../../../../src/components-lib/editor/schema/editor-mode';
import { getFolderSchema } from '../../../../src/components-lib/editor/schema/folders';
import { getFullEditorForms } from '../../../../src/components-lib/editor/schema/full';
import { getImageSectionForms } from '../../../../src/components-lib/editor/schema/image';
import { getLiveSectionForms } from '../../../../src/components-lib/editor/schema/live';
import { getMediaGallerySectionForms } from '../../../../src/components-lib/editor/schema/media-gallery';
import { getMediaViewerSectionForms } from '../../../../src/components-lib/editor/schema/media-viewer';
import { getMenuSectionForms } from '../../../../src/components-lib/editor/schema/menu';
import { getPerformanceSectionForms } from '../../../../src/components-lib/editor/schema/performance';
import { getProfilesSectionForms } from '../../../../src/components-lib/editor/schema/profiles';
import { getRemoteControlSectionForms } from '../../../../src/components-lib/editor/schema/remote-control';
import {
  getSimpleCameraForms,
  getSimpleMenuForms,
  getSimpleTopLevelForms,
} from '../../../../src/components-lib/editor/schema/simple';
import { getStatusBarSectionForms } from '../../../../src/components-lib/editor/schema/status-bar';
import { getTimelineSectionForms } from '../../../../src/components-lib/editor/schema/timeline';
import {
  getViewKeyboardShortcutsSectionForms,
  getViewSectionForms,
} from '../../../../src/components-lib/editor/schema/view';
import {
  findBinding,
  isComputedFieldBinding,
  type ConfigPath,
  type EditorForm,
} from '../../../../src/components-lib/editor/types';
import { advancedCameraCardConfigSchema } from '../../../../src/config/schema/types';
import { PTZ_KEYBOARD_SHORTCUTS } from '../../../../src/config/schema/view';
import type { HAFormSelectorSchema } from '../../../../src/ha/types';

// ============================================================================
//                   Editor <-> Zod Schema Completeness tests
//
// Two directions:
// - Direction 1 (editor -> config): every editor field path is a real config
//   key, its selector kind matches the zod type (number/boolean/enum), and its
//   dropdown offers every enum value.
// - Direction 2 (config -> editor): every configurable zod leaf appears in an
//   editor form, unless explicitly excepted. Catches config fields forgotten in
//   the editor.
// ============================================================================

// Configuration subtrees the editor renders with a dedicated widget instead of
// an `ha-form` field, so the field walk cannot see them.
const EDITOR_CUSTOM_WIDGETS = PTZ_KEYBOARD_SHORTCUTS.map(
  (name) => `view.keyboard_shortcuts.${name}`,
);

// Configuration subtrees intentionally kept YAML-only.
const EDITOR_EXCLUDED = [
  'cameras_global',
  'elements',
  'automations',
  'overrides',
  'debug',
  'type',
  'card_id',
  'card_mod',

  // Advanced/freeform camera subtrees not surfaced in the editor.
  'cameras.jsmpeg',
  'cameras.ptz',
  'cameras.dimensions.grid',
  'cameras.triggers.events.context',

  // Free-form CSS variable overrides.
  'view.theme.overrides',

  // Not surfaced in the editor (the maintainer declined adding it).
  'view.render_entities',

  // Section-level action handlers (`tap_action` etc.) need a dedicated action
  // editor and have never been exposed.
  'view.actions',
  'image.actions',
  'media_gallery.actions',
  'live.actions',
  'media_viewer.actions',

  // Free-form CSS object for the PTZ control styling.
  'live.controls.ptz.style',
  'media_viewer.controls.ptz.style',

  // Advanced folder path parsers/matchers/templating: text-editor only.
  'folders.ha.path',
];

// Every section's forms, keyed by section, so the harness walks the full
// field tree of everything rendered via `ha-form`.
const SECTION_FORMS: Record<string, EditorForm[]> = {
  profiles: getProfilesSectionForms(),
  view: [...getViewSectionForms(), ...getViewKeyboardShortcutsSectionForms()],
  image: getImageSectionForms(),
  live: getLiveSectionForms(),
  media_gallery: getMediaGallerySectionForms(),
  media_viewer: getMediaViewerSectionForms(),
  menu: getMenuSectionForms(),
  status_bar: getStatusBarSectionForms(),
  timeline: getTimelineSectionForms(),
  dimensions: getDimensionsSectionForms(),
  performance: getPerformanceSectionForms(),
  remote_control: getRemoteControlSectionForms(),

  // Array section: one representative item at index 0 for testing purposes. The
  // numeric index is stripped when building covered paths, so this checks the
  // item's fields (`folders.type`, ...) against the array element's schema.
  folders: [{ basePath: ['folders', 0], schema: getFolderSchema() }],

  // Array section split across the camera form, the triggers sub-form, and the
  // per-event item form (the triggers group is hand-built to host the events
  // list, so its fields live in a separate schema).
  cameras: [
    {
      basePath: ['cameras', 0],
      schema: getCameraSchema({
        otherCameras: [{ value: 'camera.other', label: 'Other' }],
        folders: [{ value: 'folder-1', label: 'Folder' }],
      }),
    },
    {
      basePath: ['cameras', 0, 'triggers'],
      schema: getCameraTriggersSchema(),
    },
    {
      basePath: ['cameras', 0, 'triggers', 'events', 0],
      schema: getTriggerEventSchema(),
    },
  ],
};

// The forms that are not a section of the configuration: the switch between the
// editors, and the simple editor, which gathers its fields from across the
// configuration and binds each to where its setting is stored. Their names are
// the editor's own, so a failure says which set of forms it came from. Every
// path they address is one a section covers too, so they add nothing to
// direction 2 and everything to direction 1.
const UNSECTIONED_FORMS: Record<string, EditorForm[]> = {
  editor_mode: getEditorModeForms(),
  simple_top_level: getSimpleTopLevelForms(),
  simple_menu: getSimpleMenuForms(),

  // The camera form is the array item at index 0, as the array sections above.
  simple_cameras: getSimpleCameraForms(0),
};

const ALL_FORMS: Record<string, EditorForm[]> = {
  ...SECTION_FORMS,
  ...UNSECTIONED_FORMS,
};

// `z.core.$ZodType` is zod v4's base schema type for introspection: it is what
// `.unwrap()` and `ZodArray.element` return, and what every schema (including
// the config root) is assignable to. The classic `z.ZodType` is a subtype with
// extra methods, so those introspection results would not assign back to it.

// Unwrap the zod wrappers that carry no structural meaning for path
// navigation (optional/default/nullable/readonly/lazy).
const unwrap = (schema: z.core.$ZodType): z.core.$ZodType => {
  let current: z.core.$ZodType = schema;
  for (let guard = 0; guard < 20; guard++) {
    if (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable ||
      current instanceof z.ZodDefault ||
      current instanceof z.ZodReadonly
    ) {
      current = current.unwrap();
    } else if (current instanceof z.ZodLazy) {
      current = current.unwrap();
    } else {
      break;
    }
  }
  return current;
};

// Resolve a configuration path to its zod leaf schema, or null if the path
// does not exist in the configuration schema.
const resolvePath = (path: ConfigPath): z.core.$ZodType | null => {
  let current: z.core.$ZodType = advancedCameraCardConfigSchema;
  for (const segment of path) {
    current = unwrap(current);
    if (current instanceof z.ZodObject) {
      const next: z.core.$ZodType | undefined = current.shape[segment];
      if (!next) {
        return null;
      }
      current = next;
    } else if (current instanceof z.ZodArray) {
      current = current.element;
    } else {
      return null;
    }
  }
  return unwrap(current);
};

// A selector object has exactly one key naming its kind (`{ number: {} }` ->
// 'number', `{ select: {} }` -> 'select'), so its single key is the kind.
const selectorKind = (field: HAFormSelectorSchema): string =>
  Object.keys(field.selector)[0];

// Collect the literal values of a zod enum or union-of-literals, or null if the
// schema is not an enumeration.
const enumValues = (schema: z.core.$ZodType): unknown[] | null => {
  if (schema instanceof z.ZodEnum) {
    return Object.values(schema.enum);
  }
  if (schema instanceof z.ZodUnion) {
    const values: unknown[] = [];
    for (const option of schema.options) {
      const inner = unwrap(option);
      if (inner instanceof z.ZodLiteral) {
        values.push(inner.value);
      } else {
        return null;
      }
    }
    return values;
  }
  return null;
};

// True if a config path lies inside a subtree the editor forms do not own
// (YAML-only, or rendered by a custom widget), so the completeness walk skips
// it.
const isPruned = (path: ConfigPath): boolean => {
  const key = path.join('.');
  return [...EDITOR_CUSTOM_WIDGETS, ...EDITOR_EXCLUDED].some(
    (prefix) => key === prefix || key.startsWith(`${prefix}.`),
  );
};

// Enumerate the configuration schema's leaf field paths (a leaf is anything
// that is not a plain object; arrays are descended into rather than treated
// as leaves), pruning the subtrees the editor does not own.
const enumerateConfigLeavesRecursively = (
  schema: z.core.$ZodType,
  prefix: ConfigPath = [],
): string[] => {
  if (prefix.length && isPruned(prefix)) {
    return [];
  }
  const current = unwrap(schema);
  if (current instanceof z.ZodObject) {
    return Object.keys(current.shape).flatMap((key) =>
      enumerateConfigLeavesRecursively(current.shape[key], [...prefix, key]),
    );
  }
  if (current instanceof z.ZodArray) {
    // Descend into array items without an index: array sections cover the item
    // fields once (e.g. `folders.type`, not `folders.0.type`).
    return enumerateConfigLeavesRecursively(current.element, prefix);
  }
  return [prefix.join('.')];
};

// Every configuration path the editor forms currently cover. Array sections
// carry a numeric index (`['folders', 0]`); strip it so covered paths match the
// index-free enumerated leaves.
const coveredPaths = new Set(
  Object.values(ALL_FORMS)
    .flat()
    .flatMap(getFormConfigPaths)
    .map((path) => path.filter((segment) => typeof segment !== 'number').join('.')),
);

// One check per configuration path a field addresses. A field that reads and
// writes itself addresses more than one, and its selector deliberately does not
// match how the value is stored (a switch for a named mode, a list of names for
// one boolean per menu button), so only the existence of its paths is checked.
interface FieldCheck {
  section: string;
  path: ConfigPath;
  field: HAFormSelectorSchema;
  checkSelector: boolean;
}

const getFieldChecks = (): FieldCheck[] => {
  const checks: FieldCheck[] = [];
  for (const [section, forms] of Object.entries(ALL_FORMS)) {
    for (const form of forms) {
      forEachFieldRecursively(form.schema, (formPath, field) => {
        const binding = findBinding(form, formPath);
        const computed = !!binding && isComputedFieldBinding(binding);
        const paths = !binding
          ? [[...form.basePath, ...formPath]]
          : isComputedFieldBinding(binding)
            ? binding.configPaths
            : [binding.configPath];

        checks.push(
          ...paths.map((path) => ({ section, path, field, checkSelector: !computed })),
        );
      });
    }
  }
  return checks;
};

describe('editor schema completeness', () => {
  // The derivation asks `getFullEditorForms` what the full editor shows, while
  // this harness walks the sections it is given above. The two must describe
  // the same editor, or a section could be checked here and invisible to the
  // derivation, or the reverse.
  it('should check every form the full editor shows', () => {
    const walked = new Set(
      Object.entries(ALL_FORMS)
        .filter(([section]) => !(section in UNSECTIONED_FORMS))
        .flatMap(([, forms]) => forms)
        .flatMap(getFormConfigPaths)
        .map((path) => path.join('.')),
    );

    for (const path of getFullEditorForms().flatMap(getFormConfigPaths)) {
      expect(walked, `${path.join('.')} is shown but not checked`).toContain(
        path.join('.'),
      );
    }
  });

  // Direction 1: every editor field path is a real configuration key.
  describe('every form field resolves to a matching configuration key', () => {
    for (const { section, path, field, checkSelector } of getFieldChecks()) {
      const key = path.join('.');

      it(`${section}: ${key}`, () => {
        const resolved = resolvePath(path);
        expect(resolved, `path ${key} is not in the config schema`).not.toBeNull();

        if (!checkSelector) {
          return;
        }

        // Direction 1b: the selector kind matches the zod type where the
        // type is unambiguous (number/boolean/enum).
        const kind = selectorKind(field);
        if (resolved instanceof z.ZodNumber) {
          expect(kind, `${key} should use a number selector`).toBe('number');
        } else if (resolved instanceof z.ZodBoolean) {
          expect(kind, `${key} should use a boolean selector`).toBe('boolean');
        } else {
          const values = resolved ? enumValues(resolved) : null;
          if (values) {
            expect(kind, `${key} should use a select selector`).toBe('select');
            // Direction 1c: the dropdown offers every enum value.
            if ('select' in field.selector) {
              const options = field.selector.select.options.map((option) =>
                typeof option === 'object' ? option.value : option,
              );
              for (const value of values) {
                expect(
                  options,
                  `${key} dropdown is missing enum value ${String(value)}`,
                ).toContain(value);
              }
            }
          }
        }
      });
    }
  });

  // Direction 2: every configurable field (outside the excluded subtrees)
  // appears in the editor. This is the forgotten-feature catcher.
  describe('every configurable field appears in the editor', () => {
    for (const path of enumerateConfigLeavesRecursively(
      advancedCameraCardConfigSchema,
    )) {
      it(path, () => {
        expect(
          coveredPaths.has(path),
          `${path} is a configurable field but is not in any editor form ` +
            `(add it to the editor, or to EDITOR_CUSTOM_WIDGETS / EDITOR_EXCLUDED)`,
        ).toBe(true);
      });
    }
  });
});
