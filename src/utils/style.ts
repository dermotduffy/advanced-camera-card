import type { StyleInfo } from 'lit/directives/style-map.js';

/**
 * Get the color a style sets.
 * @param style The style.
 * @returns The color, or null if the style does not set one as a CSS color.
 */
export const getStyleColor = (style?: StyleInfo | null): string | null => {
  return typeof style?.color === 'string' ? style.color : null;
};
