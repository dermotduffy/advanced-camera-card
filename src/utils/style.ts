import type { StyleInfo } from 'lit/directives/style-map.js';

/**
 * Get the color a style sets.
 * @param style The style.
 * @returns The color, or null if the style does not set one as a CSS color.
 */
export const getStyleColor = (style?: StyleInfo | null): string | null => {
  return typeof style?.color === 'string' ? style.color : null;
};

/**
 * Get the style with `--state-icon-color` added from its color. Home Assistant
 * icons use that property when nothing colors them by state.
 * @param style The style.
 * @returns A StyleInfo.
 */
export const getStyleWithStateIconColor = (style?: StyleInfo | null): StyleInfo => {
  const color = getStyleColor(style);
  return {
    ...(color !== null ? { '--state-icon-color': color } : {}),
    ...style,
  };
};
