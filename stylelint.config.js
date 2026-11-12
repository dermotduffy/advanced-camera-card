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

            // Cosmetic: this is allowed since the only gap is Chrome before 94,
            // where an outline is drawn square rather than following the
            // element's border radius.
            'properties.outline',

            // Not CSS: `@function` in a `.scss` file is Sass, which sass
            // compiles away (i.e. no browser ever reads it). This cannot be
            // identified separately from a CSS "at-rule".
            'at-rules.function',

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
