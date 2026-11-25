import compat from 'eslint-plugin-compat';

// Rejects Javascript the browsers in `.browserslistrc` cannot run. Separate
// from `eslint.config.mjs` because it reads the built card (dist/), which is
// the only place the bundled dependencies can be seen.
//
// Exceptions are listed below rather than written as `eslint-disable` comments,
// which generated files cannot carry.
export default [
  {
    files: ['dist/*.js'],

    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },

    settings: {
      lintAllEsApis: true,

      // "polyfills" is the allowlist.
      polyfills: [
        // Firefox implements no part of the picture-in-picture API, and
        // `PIPManager.isSupported()` gates every use of it.
        'document.pictureInPictureEnabled',
        'document.pictureInPictureElement',
        'document.exitPictureInPicture',

        // Safari on iOS has no pointer lock. `@use-gesture/vanilla` tests for
        // it before calling it.
        'document.exitPointerLock',
        'document.pointerLockElement',

        // Safari has never had idle callbacks. `runWhenIdleIfSupported` tests
        // for this and runs the work straight away instead.
        'requestIdleCallback',

        // Safari on a Mac has no touch screen and so never dispatches a touch
        // event. The card tests for the constructor before naming it.
        'TouchEvent',
      ],
    },

    plugins: { compat },

    rules: {
      'compat/compat': 'error',
    },
  },
];
