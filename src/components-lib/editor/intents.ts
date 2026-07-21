import { fireAdvancedCameraCardEvent } from '../../utils/fire-advanced-camera-card-event';
import type { ConfigChange, ConfigPath } from './types';

// Something the user has asked to do to the configuration, addressed
// absolutely. A section reports these rather than editing anything itself: the
// editor holds the configuration and is the only thing that writes to it.
export type EditorIntent =
  | { type: 'changes'; changes: ConfigChange[] }
  | { type: 'list-add'; path: ConfigPath; item: unknown }
  | { type: 'list-move'; path: ConfigPath; from: number; to: number }
  | { type: 'list-delete'; path: ConfigPath; index: number };

const EDITOR_INTENT_EVENT = 'editor:intent';

/**
 * Report an intent to the editor. The event travels up out of the reporting
 * component's shadow root, and only the editor listens for it: nothing in
 * between interprets it, and the paths it carries are absolute, so it means
 * the same wherever it is seen.
 * @param target The element reporting the intent.
 * @param intent What the user asked to do.
 */
export const fireEditorIntent = (target: EventTarget, intent: EditorIntent): void => {
  fireAdvancedCameraCardEvent(target, EDITOR_INTENT_EVENT, intent, {
    bubbles: true,
    composed: true,
  });
};
