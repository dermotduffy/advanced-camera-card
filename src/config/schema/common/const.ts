export const cardIDRegex = /^[-\w]+$/;

export const MENU_PRIORITY_DEFAULT = 50;
export const MENU_PRIORITY_MAX = 100;

export const STATUS_BAR_PRIORITY_DEFAULT = 50;
export const STATUS_BAR_PRIORITY_MAX = 100;

export const BUTTON_SIZE_MIN = 20;

// The default view (may not be supported on all cameras).
export const VIEW_DEFAULT = 'live' as const;

export const VIEWS_USER_SPECIFIED = [
  'diagnostics',
  'live',
  'clip',
  'clips',
  'folder',
  'folders',
  'snapshot',
  'snapshots',
  'recording',
  'recordings',
  'review',
  'reviews',
  'image',
  'timeline',
] as const;
export type AdvancedCameraCardUserSpecifiedView = (typeof VIEWS_USER_SPECIFIED)[number];
export type AdvancedCameraCardView =
  | AdvancedCameraCardUserSpecifiedView
  | 'media'
  | 'diagnostics';
