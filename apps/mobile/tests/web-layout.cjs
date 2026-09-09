const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const dist = path.resolve(__dirname, '../dist');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };

test('mobile export keeps onboarding and bottom navigation inside the app frame', async () => {
  const server = http.createServer(async (req, res) => {
    const file = path.resolve(dist, '.' + new URL(req.url, 'http://localhost').pathname);
    if (file !== dist && !file.startsWith(dist + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const target = file === dist ? path.join(dist, 'index.html') : file;
      const data = await fs.readFile(target);
      res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const width of [1280, 375, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 812 }, serviceWorkers: 'block' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const target = new URL(process.env.MOBILE_TEST_URL || `http://127.0.0.1:${server.address().port}/`);
      assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Use a local static server');
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        return url.origin === target.origin && !/^\/api(?:\/|$)/.test(url.pathname) ? route.continue() : route.abort();
      });
      await page.routeWebSocket('**/*', socket => socket.close());
      await page.goto(target.href);
      const title = page.getByText('Unified Healthcare', { exact: true });
      await title.waitFor({ state: 'visible' });
      const slide = await title.locator('..').boundingBox();
      const frameWidth = Math.min(width, 520);
      assert.ok(Math.abs(slide.width - frameWidth) <= 1, `${width}px: onboarding slide is ${slide.width}px, expected ${frameWidth}px`);
      await page.getByText('Next', { exact: false }).click();
      await page.getByText('Next', { exact: false }).click();
      await page.getByText('Get Started', { exact: false }).click();
      await page.getByText('Queue Management', { exact: true }).waitFor();
      assert.equal(await page.getByText('Active View:', { exact: true }).count(), 0);
      const tabs = page.getByRole('tab');
      assert.equal(await tabs.count(), 5);
      assert.deepEqual(await tabs.evaluateAll(items => items.map(item => item.getAttribute('aria-label'))), ['Home', 'Triage', 'Patients', 'Facility', 'More']);
      const sos = await page.getByTestId('global-sos').boundingBox();
      assert.ok(sos && sos.y + sos.height <= 813);
      for (const tab of await tabs.all()) {
        const box = await tab.boundingBox();
        assert.ok(box && box.x >= (width - frameWidth) / 2 - 1 && box.x + box.width <= (width + frameWidth) / 2 + 1);
        assert.ok(box.y > 406 && box.y + box.height <= sos.y + 1, `${width}px: bottom tab remains above SOS`);
      }
      await tabs.nth(1).click();
      await tabs.nth(0).click();
      await page.getByText('Queue Management', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByTestId('home-profile').click();
      await page.getByText('Switch demo persona', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Patient', exact: true }).click();
      await page.getByRole('button', { name: 'Close profile', exact: true }).click();
      await page.getByText('Active Medicines', { exact: true }).waitFor();
      assert.deepEqual(errors, [], `${width}px: no uncaught JavaScript errors`);
      console.log(`Verified ${width}px: onboarding, dashboard, five fixed tabs, global SOS, navigation, no page overflow`);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
