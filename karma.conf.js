// karma.conf.js
module.exports = (config) => {
  config.set({
    frameworks: ['mocha', 'chai', 'fixture'],
    files: [
      'build/test-bundle.js',
      'tests/*.js',
      'tests/*.html'
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
