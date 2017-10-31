const serve = require('koa-static');
const Koa = require('koa');
const app = new Koa();
const path = require('path');
const makeDir = require('make-dir');
const puppeteer = require('puppeteer');

const PORT = 8567;

async function createServer(port) {
  app.use(serve(path.join(__dirname, '..')));

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
  });
}

async function runPuppeteer(sd) {
  const browser = await puppeteer.launch({
    headless: false
    //  args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', (...args) => {
    //console.log.apply(console, ['[Browser]', ...args]);
    console.log(args[0].text);
  });

  await page.goto(`http://localhost:${PORT}/tests/index.html`);

  await page.mouse.click(200, 100, { clickCount: 2, delay: 50 });

  await page.screenshot({ path: path.join(sd, 'example.png') });

  await browser.close();
}

async function exec() {
  const sd = path.join(__dirname, '..', 'build');
  await makeDir(sd);
  const server = await createServer(PORT);
  await runPuppeteer(sd);

  server.close();
}

exec();
