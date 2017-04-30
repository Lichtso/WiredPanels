import WirdedPanels from '../src/WiredPanels';

describe("myFunction", function () {
  let myfunc = new WiredPanels();

  beforeEach(function () {
    spyOn(myfunc, 'init').andCallThrough();
  });

  afterEach(function () {
    myfunc.reset();
  });

  it("should be able to initialize", function () {
    expect(myfunc.init).toBeDefined();
    myfunc.init();
    expect(myfunc.init).toHaveBeenCalled();
  });

  it("should populate stuff during initialization", function () {
    myfunc.init();
    expect(myfunc.stuff.length).toEqual(1);
    expect(myfunc.stuff[0]).toEqual('Testing');
  });
});
