// Rejects CSS the browsers in `.browserslistrc` cannot render.
export default {
  // A postcss syntax that can read SCSS.
  customSyntax: 'postcss-scss',

  plugins: ['stylelint-browser-compat'],

  rules: {
    'plugin/browser-compat': [
      true,
      {
        allow: {
          features: [
            // Cosmetic: these are allowed since a browser that ignores these
            // draws its normal scrollbar.
            'properties.scrollbar-color',
            'properties.scrollbar-width',
            'selectors.-webkit-scrollbar',
            'selectors.-webkit-scrollbar-thumb',
            'selectors.-webkit-scrollbar-track',

            // Known limitation: this is allowed since the only gap is Safari on
            // iOS, where fullscreen works on an iPad but not an iPhone.
            'selectors.fullscreen',

            // Nothing to suppress: these are allowed since they only remove the
            // grey tap flash and the long-press menu, neither of which the
            // browsers lacking them ever show anyway.
            'properties.-webkit-tap-highlight-color',
            'properties.-webkit-touch-callout',
          ],
        },
      },
    ],
  },
};
