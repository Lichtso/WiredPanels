const serve = require('koa-static');
const Koa = require('koa');
const app = new Koa();
const path = require('path');
const makeDir = require('make-dir');
const puppeteer = require('puppeteer');
const looksSame = require('looks-same');
const test = require('ava');

const PORT = 8567;

async function createServer(port) {
  app.use(serve(path.join(__dirname, '..')));

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
  });
}

async function runPuppeteer(sd) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', (...args) => {
    //console.log.apply(console, ['[Browser]', ...args]);
    //console.log(args[0].text);
  });

  await page.goto(`http://localhost:${PORT}/tests/index.html`);

  await page.mouse.click(200, 100, { clickCount: 2, delay: 50 });

  const screenshot = path.join(sd, 'onePanel.png');

  await page.screenshot({ path: screenshot });

  return new Promise((resolve, reject) => {
    looksSame(
      screenshot,
      path.join(__dirname, '..', 'tests', 'fixtures', 'onePanel.png'),
      { tolerance: 20, ignoreCaret: true },
      (error, equal) => {
        if (error) {
          reject(error);
        } else {
          resolve(equal);
        }
      }
    );
  });

  await browser.close();
}

test('simple', async t => {
  const sd = path.join(__dirname, '..', 'build');
  await makeDir(sd);
  const server = await createServer(PORT);
  const same = await runPuppeteer(sd);
  t.is(same, true);
  server.close();
});
