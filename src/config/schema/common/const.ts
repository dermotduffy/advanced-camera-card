export const cardIDRegex = /^[-\w]+$/;

export const MENU_PRIORITY_DEFAULT = 50;
export const MENU_PRIORITY_MAX = 100;

export const STATUS_BAR_PRIORITY_DEFAULT = 50;
export const STATUS_BAR_PRIORITY_MAX = 100;

export const BUTTON_SIZE_MIN = 20;

const VIEWS = [
  'diagnostics',
  'live',
  'clip',
  'clips',
  'folder',
  'folders',
  'gallery',
  'media',
  'snapshot',
  'snapshots',
  'recording',
  'recordings',
  'review',
  'reviews',
  'image',
  'timeline',
] as const;
export type AdvancedCameraCardView = (typeof VIEWS)[number];

export const VIEWS_USER_SPECIFIED = ['auto', ...VIEWS] as const;
export type AdvancedCameraCardUserSpecifiedView = (typeof VIEWS_USER_SPECIFIED)[number];
