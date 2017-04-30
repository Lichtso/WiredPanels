/* jslint node: true, esnext: true */

import babel from 'rollup-plugin-babel';
//import multiEntry from 'rollup-plugin-multi-entry';

export default {
  entry: 'tests/simple.test.js',
  external: [],
  plugins: [
    /*babel({
      babelrc: false,
      presets: ['es2015-rollup'],
      exclude: 'node_modules/**'
    })*/
    /*,
       multiEntry()*/
  ],
  moduleName: 'XXX',
  format: 'iife',
  dest: 'build/test-bundle.js',
  sourceMap: true
};
