import type { AdvancedCameraCardConfig } from '../../config/schema/types';

// The card state exposed via the `acc` namespace AND as the
// `trigger.from_acc`/`to_acc` before/after snapshots (the card analogue of HA's
// full `trigger.from_state`/`to_state`).
export interface TemplateAdvancedCameraCardState {
  camera?: string;
  view?: string;
  config?: AdvancedCameraCardConfig;
}

export interface TemplateMediaData {
  title: string;
  is_folder: boolean;
}

// The ambient `acc` namespace: card state plus `media` (the item currently being
// templated, e.g. a folder-match candidate). `media` is not card state, so it is
// not part of the shared snapshot type above.
export interface TemplateACCNamespace extends TemplateAdvancedCameraCardState {
  media?: TemplateMediaData;
}
