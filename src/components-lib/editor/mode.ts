import { editorConfigSchema, type EditorMode } from '../../config/schema/editor';
import type { RawAdvancedCameraCardConfig } from '../../config/types';
import { isRecord } from '../../utils/basic';
import { getFormConfigPaths } from './form-data';
import { stripArrayIndices } from './paths';
import { getFullEditorForms } from './schema/full';
import {
  getSimpleCameraForms,
  getSimpleMenuForms,
  getSimpleTopLevelForms,
} from './schema/simple';
import type { EditorForm } from './types';

// The configuration paths a set of forms shows, without array indices so that
// the third camera's title is the camera title field.
const getShownPaths = (forms: EditorForm[]): Set<string> =>
  new Set(
    forms.flatMap(getFormConfigPaths).map((path) => stripArrayIndices(path).join('.')),
  );

// What the full editor shows and the simple editor does not. Configuration
// outside this is either something the simple editor shows too, or something
// neither shows (`elements`, `debug`, anything the card does not recognize at
// all), which the full editor would be no better at showing.
const getFullOnlyPaths = (): Set<string> => {
  const simplePaths = getShownPaths([
    ...getSimpleCameraForms(0),
    ...getSimpleMenuForms(),
    ...getSimpleTopLevelForms(),
  ]);
  return new Set(
    [...getShownPaths(getFullEditorForms())].filter((path) => !simplePaths.has(path)),
  );
};

// The paths of every value the configuration sets. Lists contribute the paths
// of their items' contents, without the position of the item.
const getSetPaths = (value: unknown, prefix: string[] = []): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => getSetPaths(item, prefix));
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, item]) =>
      getSetPaths(item, [...prefix, key]),
    );
  }
  return [prefix.join('.')];
};

/**
 * Work out which editor to show for a configuration that does not say. The full
 * editor is shown when the configuration sets something it shows and the simple
 * editor does not, so that opening the simple editor never hides a setting the
 * user could otherwise have seen.
 * @param config The raw (possibly invalid) configuration.
 * @returns The editor mode.
 */
export const deriveEditorMode = (config: RawAdvancedCameraCardConfig): EditorMode => {
  const fullOnlyPaths = getFullOnlyPaths();
  return getSetPaths(config).some((path) => fullOnlyPaths.has(path)) ? 'full' : 'simple';
};

/**
 * Get which editor to show for a configuration: what it asks for, or, if it
 * does not ask (or asks for something that is not an editor), what suits it.
 * @param config The raw (possibly invalid) configuration.
 * @returns The editor mode.
 */
export const getEditorMode = (config: RawAdvancedCameraCardConfig): EditorMode => {
  const editor = editorConfigSchema.safeParse(config['editor']);
  return editor.success && editor.data.mode
    ? editor.data.mode
    : deriveEditorMode(config);
};
