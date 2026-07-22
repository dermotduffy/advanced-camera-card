import { assert, describe, expect, it } from 'vitest';

import { getForms } from '../../../../src/components-lib/editor/schema/registry';
import type { ConfigPath } from '../../../../src/components-lib/editor/types';
import { isFormFieldSchema } from '../../../../src/ha/types';

const OPTIONS = { cameras: [], folders: [] };

// Every section the editor offers, and where its first form edits.
const SECTIONS: [string, ConfigPath][] = [
  ['dimensions', ['dimensions']],
  ['image', ['image']],
  ['live', ['live']],
  ['media_gallery', ['media_gallery', 'controls']],
  ['media_viewer', ['media_viewer']],
  ['menu', ['menu']],
  ['performance', ['performance']],
  ['profiles', []],
  ['remote_control', ['remote_control']],
  ['status_bar', ['status_bar']],
  ['timeline', ['timeline']],
  ['view', ['view']],
  ['view.keyboard_shortcuts', ['view', 'keyboard_shortcuts']],
];

describe('getForms', () => {
  describe('should build the forms of a section', () => {
    it.each(SECTIONS)('should build the %s section', (name, basePath) => {
      const forms = getForms({ kind: 'full-section', name }, OPTIONS);

      expect(forms.length).toBeGreaterThan(0);
      expect(forms[0].basePath).toEqual(basePath);
      forms.forEach((form) => expect(form.schema.length).toBeGreaterThan(0));
    });

    it('should build no forms for a section it does not know', () => {
      expect(getForms({ kind: 'full-section', name: 'nonexistent' }, OPTIONS)).toEqual(
        [],
      );
    });
  });

  describe('should offer a camera the other cameras, but not itself', () => {
    const CAMERAS = [
      { value: 'one', label: 'One' },
      { value: 'two', label: 'Two' },
      { value: 'three', label: 'Three' },
    ];

    const getDependencyOptions = (index: number): unknown => {
      const [form] = getForms(
        { kind: 'full-camera', index },
        { ...OPTIONS, cameras: CAMERAS },
      );
      const dependencies = form.schema.find(
        (field) => 'name' in field && field.name === 'dependencies',
      );
      assert(dependencies && 'schema' in dependencies);
      const cameras = dependencies.schema.find(
        (field) => 'name' in field && field.name === 'cameras',
      );
      assert(cameras && isFormFieldSchema(cameras) && 'select' in cameras.selector);
      return cameras.selector.select?.options;
    };

    it.each([
      [0, ['two', 'three']],
      [1, ['one', 'three']],
      [2, ['one', 'two']],
    ])('should leave camera %i out of its own dependencies', (index, expected) => {
      expect(getDependencyOptions(index)).toEqual(
        CAMERAS.filter((camera) => expected.includes(camera.value)),
      );
    });
  });

  // Every request other than a section, which is named rather than being a
  // request of its own and is covered above. Each edits one place in the
  // configuration, so each builds a single form.
  describe('should build the forms of every other request', () => {
    it.each([
      [{ kind: 'editor-mode' as const }, ['editor']],
      [{ kind: 'simple-top-level' as const }, []],
      [{ kind: 'simple-menu' as const }, []],
      [{ kind: 'simple-camera' as const, index: 3 }, ['cameras', 3]],
      [{ kind: 'full-camera' as const, index: 2 }, ['cameras', 2]],
      [{ kind: 'full-folder' as const, index: 1 }, ['folders', 1]],
      [
        { kind: 'full-camera-triggers' as const, cameraIndex: 2 },
        ['cameras', 2, 'triggers'],
      ],
      [
        { kind: 'full-camera-event' as const, cameraIndex: 2, eventIndex: 4 },
        ['cameras', 2, 'triggers', 'events', 4],
      ],
    ])('should build the forms for %j', (request, basePath) => {
      const forms = getForms(request, OPTIONS);

      expect(forms).toHaveLength(1);
      expect(forms[0].basePath).toEqual(basePath);
      expect(forms[0].schema.length).toBeGreaterThan(0);
    });
  });
});
