/* jslint node: true, esnext: true */

module.exports = (config) => {
  config.set({
    frameworks: ['jasmine'],
    files: [
      '../build/test-bundle.js'
    ],

    browsers: ['Chrome']
  });
};
