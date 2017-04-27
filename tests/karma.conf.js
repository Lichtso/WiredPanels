/* jslint node: true, esnext: true */

module.exports = (config) => {
  config.set({
    frameworks: ['mocha', 'chai', 'fixture'],
    files: [
      '../build/test-bundle.js',
      '*.js',
      '*.html'
    ],

    browsers: ['Chrome']
  });
};
