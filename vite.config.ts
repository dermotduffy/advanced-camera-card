import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

import { getBuildDefines } from './scripts/vite/build-defines.js';
import { buildDate } from './scripts/vite/plugins/build-date.js';
import { cleanDist } from './scripts/vite/plugins/clean-dist.js';
import { facadeEntry } from './scripts/vite/plugins/facade-entry.js';
import { svgPath } from './scripts/vite/plugins/svg-path.js';
import { PUBLIC_ENTRIES } from './scripts/vite/public-entries.js';

// `yarn start` passes `--mode development`; a plain `vite build` is
// `production`.
export default defineConfig(({ mode }) => {
  const dev = mode === 'development';

  return {
    define: {
      // Necessary for xiel/embla-carousel-wheel-gestures
      // See:https://github.com/xiel/embla-carousel-wheel-gestures/issues/164
      'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),

      ...getBuildDefines({ dev, releaseVersion: process.env.RELEASE_VERSION }),
    },

    plugins: [
      cleanDist(),
      svgPath(),
      buildDate(),
      facadeEntry({ publicFileNames: PUBLIC_ENTRIES }),
      visualizer({ filename: 'visualizations/treemap.html', template: 'treemap' }),
    ],

    // `yarn preview` hands the built card out over HTTP, for a Home Assistant that
    // reads it from a URL rather than from a path on disk. The dev container
    // forwards this port and its Home Assistant loads the card from it.
    preview: {
      host: '0.0.0.0',
      port: 10001,

      // Fail rather than quietly moving: the port is what the dev container
      // expects to find the card on.
      strictPort: true,

      // Home Assistant is served from a different origin than this.
      cors: true,
    },

    resolve: {
      // Same as Vite's default, minus the trailing `jsnext:main` and `jsnext`: an
      // early convention for naming an ES module build that `module` replaced.
      // `moment` is the one dependency still shipping it, and honouring it hands
      // out moment as an ES module, which `vis-timeline`'s CommonJS build cannot
      // then use -- causing timeline views to throw an error. Requiring an ES
      // module yields the namespace object rather than moment itself.
      mainFields: ['browser', 'module'],
    },

    css: {
      preprocessorOptions: {
        scss: {
          // A couple of stylesheets are pulled in by package name (e.g. `@use
          // '@graphiteds/core/css/core.css'`). sass resolves a bare name like
          // that only if node_modules is on its load path.
          loadPaths: ['./node_modules/'],
        },
      },
    },

    build: {
      lib: { entry: 'src/card.ts', formats: ['es'] },
      target: 'es2021',
      outDir: 'dist',

      // `cleanDist` removes what an earlier build left instead, once the new
      // output is written, so the directory a running Home Assistant serves the
      // card from is never briefly empty.
      emptyOutDir: false,

      minify: dev ? false : 'oxc',
      sourcemap: dev,

      rolldownOptions: {
        output: {
          // The card lives in a hashed chunk that nothing outside the build can
          // name; `facadeEntry` emits the stable names pointing at it.
          entryFileNames: '[name]-[hash].js',

          chunkFileNames: (chunk) => {
            // Name the language chunks for what they hold: the module they are
            // built from is a bare `de.json`, which says nothing on its own.
            if (chunk.facadeModuleId?.match(/localize\/languages\/.*\.json/)) {
              return 'lang-[name]-[hash].js';
            }
            // The template engine is imported as `ha-nunjucks/dist`, which would
            // otherwise name the chunk `dist`.
            if (chunk.facadeModuleId?.match(/ha-nunjucks/)) {
              return 'templates-[hash].js';
            }
            return '[name]-[hash].js';
          },

          // Lib mode leaves whitespace in even when minifying.
          minify: !dev,

          // Rolldown gives a shared module its own chunk regardless of how small
          // it is, which by default leaves the card fetching dozens of files of a
          // few hundred bytes before it can start. Instead, gather small shared
          // modules into one chunk instead; anything larger keeps its own, so the
          // code behind a dynamic (lazy) imports is still effective.
          //
          // Numbers set by trial and error -- large values start pulling in
          // genuinely "lazy" code into the set that is fetched at startup.
          codeSplitting: {
            groups: [{ name: 'shared', maxModuleSize: 6000, minShareCount: 2 }],
          },
        },
      },
    },
  };
});
