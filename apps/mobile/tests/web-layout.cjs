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
      const page = await browser.newPage({ viewport: { width, height: 812 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // Exercise the existing offline fallback without touching a real backend.
      await page.route('**/api/**', route => route.abort());
      await page.goto(process.env.MOBILE_TEST_URL || `http://127.0.0.1:${server.address().port}/`);
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
      const tabs = page.getByRole('tablist').getByRole('link');
      assert.equal(await tabs.count(), 8);
      for (const tab of await tabs.all()) {
        const box = await tab.boundingBox();
        assert.ok(box && box.x >= (width - frameWidth) / 2 - 1 && box.x + box.width <= (width + frameWidth) / 2 + 1);
        assert.ok(box.y >= 700 && box.y + box.height <= 813, `${width}px: bottom tab must remain in viewport`);
      }
      await tabs.nth(1).click();
      await tabs.nth(0).click();
      await page.getByText('Queue Management', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByText('AD', { exact: true }).click();
      await page.getByText('Switch Persona / Role:', { exact: true }).waitFor();
      await page.getByText(/ Patient$/, { exact: true }).click();
      await page.getByText('Close Profile', { exact: true }).click();
      await page.getByText('Active Medicines', { exact: true }).waitFor();
      assert.deepEqual(errors, [], `${width}px: no uncaught JavaScript errors`);
      console.log(`Verified ${width}px: onboarding, dashboard, seven bottom tabs, navigation, no page overflow`);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
