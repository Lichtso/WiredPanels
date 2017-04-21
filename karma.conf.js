// karma.conf.js
module.exports = function (config) {
  config.set({
    files: [
      'dist/WiredPanels.js',
      'tests/*test.js'
    ],

    browsers: ['Chrome', 'Chrome_without_security'], // You may use 'ChromeCanary' or 'Chromium' as well


    // you can define custom flags
    customLaunchers: {
      Chrome_without_security: {
        base: 'Chrome',
        flags: ['--disable-web-security']
      }
    }
  });
};
