import { getEditorMode } from '../mode';
import type { ConfigPath, EditorForm, FieldBinding } from '../types';

const EDITOR_MODE_PATH: ConfigPath = ['editor', 'mode'];

// The switch between the two editors. It shows whether the full editor is in
// use, while the configuration names the editor itself, so the two
// representations are converted here. The mode is always written out, including
// when it matches what would have been chosen anyway, so that the choice sticks.
const getEditorModeBinding = (): FieldBinding => ({
  formPath: ['mode'],
  configPaths: [EDITOR_MODE_PATH],
  read: (config) => getEditorMode(config) === 'full',
  write: (value) => [
    { path: EDITOR_MODE_PATH, type: 'set', value: value === true ? 'full' : 'simple' },
  ],
});

/**
 * Get the form choosing which editor to show. It is shown above both editors,
 * so that the way back is in the same place whichever is in use.
 * @returns The editor mode forms.
 */
export const getEditorModeForms = (): EditorForm[] => [
  {
    basePath: ['editor'],
    schema: [{ name: 'mode', selector: { boolean: {} } }],
    bindings: [getEditorModeBinding()],
  },
];
