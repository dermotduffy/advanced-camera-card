import { describe, expect, it } from 'vitest';

import {
  computeConfigChanges,
  computeDisplayedData,
} from '../../../../src/components-lib/editor/form-data';
import { getEditorModeForms } from '../../../../src/components-lib/editor/schema/editor-mode';
import type { RawAdvancedCameraCardConfig } from '../../../../src/config/types';

const [MODE_FORM] = getEditorModeForms();

const isFullEditorShown = (config: RawAdvancedCameraCardConfig): unknown =>
  computeDisplayedData(MODE_FORM, config, {})['mode'];

const setFullEditorShown = (config: RawAdvancedCameraCardConfig, shown: boolean) =>
  computeConfigChanges(
    MODE_FORM,
    computeDisplayedData(MODE_FORM, config, {}),
    { mode: shown },
    config,
    {},
  );

describe('the editor mode field', () => {
  it('should be on for a configuration asking for the full editor', () => {
    expect(isFullEditorShown({ editor: { mode: 'full' } })).toBe(true);
  });

  it('should be off for a configuration asking for the simple editor', () => {
    expect(isFullEditorShown({ editor: { mode: 'simple' } })).toBe(false);
  });

  it('should follow the editor chosen for a configuration that does not ask', () => {
    expect(isFullEditorShown({ type: 'custom:advanced-camera-card' })).toBe(false);
    expect(isFullEditorShown({ view: { dim: true } })).toBe(true);
  });

  it('should ask for the full editor when turned on', () => {
    expect(setFullEditorShown({}, true)).toEqual([
      { path: ['editor', 'mode'], type: 'set', value: 'full' },
    ]);
  });

  it('should ask for the simple editor when turned off', () => {
    expect(setFullEditorShown({ editor: { mode: 'full' } }, false)).toEqual([
      { path: ['editor', 'mode'], type: 'set', value: 'simple' },
    ]);
  });
});
