import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import serve from 'rollup-plugin-serve';
import json from '@rollup/plugin-json';
import styles from 'rollup-plugin-styles';
import image from '@rollup/plugin-image';

const dev = process.env.ROLLUP_WATCH;

const serveopts = {
  contentBase: ['./dist'],
  host: '0.0.0.0',
  port: 5000,
  allowCrossOrigin: true,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
};

const plugins = [
  styles({
    modules: false,
    // Behavior of inject mode, without actually injecting style
    // into <head>.
    mode: ['inject', () => undefined],
    sass: {
      includePaths: ['./node_modules/'],
    },
  }),
  image(),
  nodeResolve({
    browser: true,
  }),
  commonjs({
    include: 'node_modules/**',
  }),
  typescript(),
  json(),
  babel({
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
  }),
  dev && serve(serveopts),
  //!dev && terser(),
];

export default [
  {
    input: 'src/card.ts',
    output: {
      file: 'dist/frigate-hass-card.js',
      format: 'es',
    },
    plugins: [...plugins],
  },
];
