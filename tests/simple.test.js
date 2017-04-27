/* global document, window , fixture, it, describe, beforeEach, afterEach */
/* jslint node: true, esnext: true */

'use strict';

describe('Calculator', function () {

  const controls = {
    get result() {
      return document.getElementById('result').innerHTML;
    },
    get x() {
      return document.getElementById('x').value;
    },
    set x(val) {
      document.getElementById('x').value = val;
    },
    get y() {
      return document.getElementById('y').value;
    },
    set y(val) {
      document.getElementById('y').value = val;
    },
    clickAdd: function () {
      document.getElementById('add').click();
    }
  };

  // inject the HTML fixture for the tests
  beforeEach(() => {
    // Why this line? See: https://github.com/billtrik/karma-fixture/issues/3
    fixture.base = './'; // 'tests';
    fixture.load('simple.fixture.html');

    // init js lib
    window.calculator.init();
  });

  afterEach(() => fixture.cleanup());

  it('should calculate 3 for 1 + 2', () => {
    controls.x = 1;
    controls.y = 2;
    controls.clickAdd();
    controls.result.should.equal('3');
  });

  it('should calculate zero for invalid x value', () => {
    controls.x = 'hello';
    controls.y = 2;
    controls.clickAdd();
    controls.result.should.equal('0');
  });

  it('should calculate zero for invalid y value', () => {
    controls.x = 1;
    controls.y = 'goodbye';
    controls.clickAdd();
    controls.result.should.equal('0');
  });
});
