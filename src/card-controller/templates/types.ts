// The tracked card state -- shared as the base of the ambient
// `acc`/`advanced_camera_card` namespace AND the `trigger.from_acc`/`to_acc`
// before/after snapshots (the card analogue of HA's `trigger.from_state`/
// `to_state`). Only fields a trigger can snapshot belong here (notably not
// `media`).
export interface TemplateAdvancedCameraCardState {
  camera?: string;
  view?: string;
}

export interface TemplateMediaData {
  title: string;
  is_folder: boolean;
}

// The ambient `acc`/`advanced_camera_card` namespace: card state plus `media`
// (the item currently being templated, e.g. a folder-match candidate). `media`
// is not card state, so it is not part of the shared snapshot type above.
export interface TemplateACCNamespace extends TemplateAdvancedCameraCardState {
  media?: TemplateMediaData;
}
