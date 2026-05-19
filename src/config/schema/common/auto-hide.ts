// Conditions under which the menu or status bar auto-hides.
export const AUTO_HIDE_CONDITIONS = ['call', 'casting'] as const;

export type AutoHideCondition = (typeof AUTO_HIDE_CONDITIONS)[number];
