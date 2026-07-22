import { z } from 'zod';

const EDITOR_MODES = ['simple', 'full'] as const;
const editorModeSchema = z.enum(EDITOR_MODES);
export type EditorMode = z.infer<typeof editorModeSchema>;

// Options for the visual editor. The card itself renders identically whatever
// these are set to.
export const editorConfigSchema = z.object({
  // Which editor experience to show. When unset, the editor chooses for itself
  // based on whether the configuration only uses settings the simple editor can
  // express.
  mode: editorModeSchema.optional(),
});
