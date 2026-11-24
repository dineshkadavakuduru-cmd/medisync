const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const dist = path.resolve(__dirname, '../dist');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
const rawTranslationKey = /\b(?:common|facility|onboarding|triage|patients|emergency|navigation)\.[a-z][\w.]*/i;
const cases = [
  { width: 1280, height: 812, language: 'en' },
  { width: 640, height: 406, language: 'en' },
  { width: 360, height: 780, language: 'hi', touch: true },
  { width: 390, height: 844, language: 'mr', touch: true, skip: true },
];
const selectedWidths = process.env.MOBILE_TEST_WIDTHS?.split(',').map(Number);

async function activate(page, control, touch, key = 'Enter') {
  if (touch) {
    await control.tap();
    return;
  }
  await control.waitFor();
  for (let i = 0; i < 140 && !await control.evaluate(node => node === document.activeElement); i++) {
    await page.keyboard.press('Tab');
  }
  assert.ok(await control.evaluate(node => node === document.activeElement), 'Tab reaches the control');
  assert.equal(await control.evaluate(node => getComputedStyle(node).outlineWidth), '3px');
  await page.keyboard.press(key);
}

async function assertUncovered(control, bar) {
  await control.scrollIntoViewIfNeeded();
  const item = await control.boundingBox();
  const footer = await bar.boundingBox();
  assert.ok(item && footer && item.y + item.height <= footer.y + 1,
    `Final control scrolls above the persistent bar (control ${JSON.stringify(item)}, bar ${JSON.stringify(footer)})`);
  assert.ok(await control.evaluate(node => {
    const box = node.getBoundingClientRect();
    return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  }), 'Final control is reachable by touch');
}

test('exported demo supports localized touch and keyboard flows at mobile and desktop widths', async () => {
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
    const target = new URL(process.env.MOBILE_TEST_URL || `http://127.0.0.1:${server.address().port}/`);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname);
    const vercel = target.protocol === 'https:' && target.hostname.endsWith('.vercel.app');
    assert.ok(local || vercel, 'Use a local static server or a MediSync Vercel deployment');
    browser = await chromium.launch({ headless: true });
    const checks = cases.filter(({ width }) => !selectedWidths || selectedWidths.includes(width));
    assert.ok(checks.length, 'Select at least one supported test width');
    for (const { width, height, language, touch, skip } of checks) {
      const copy = require(`../src/i18n/translations/${language}.json`);
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
      page.setDefaultTimeout(20000);
      await page.addInitScript(language => {
        localStorage.setItem('app_language', language);
        localStorage.setItem('demo_mode_active', 'true');
      }, language);
      if (touch) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 18, right: 6, bottom: 24, left: 6 } });
      }
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        return url.origin === target.origin && !/^\/api(?:\/|$)/.test(url.pathname) ? route.continue() : route.abort();
      });
      await page.routeWebSocket('**/*', socket => socket.close());
      await page.goto(target.href);
      const title = page.getByRole('heading', { name: copy.onboarding.unifiedHealthcare, exact: true });
      await title.waitFor({ state: 'visible' });
      assert.equal(await page.locator('html').getAttribute('lang'), language);
      if (width === 1280) assert.ok((await title.boundingBox()).x > width / 2, 'Desktop uses an illustrated two-column slide');
      if (touch) {
        assert.equal(await page.locator('#root').evaluate(node => getComputedStyle(node).paddingBottom), '24px');
      }
      const next = page.getByRole('button', { name: `${copy.onboarding.next} →`, exact: true });
      await activate(page, next, touch, 'Space');
      await page.getByRole('heading', { name: copy.onboarding.aiTriage }).waitFor();
      if (skip) {
        await activate(page, page.getByRole('button', { name: copy.onboarding.skip, exact: true }), touch);
      } else {
        await activate(page, next, touch);
        await page.getByText(copy.onboarding.emergencyResponseDesc, { exact: true }).waitFor();
        await activate(page, page.getByRole('button', { name: `${copy.onboarding.getStarted} →`, exact: true }), touch);
      }

      const nav = page.getByRole('navigation', { name: copy.navigation.main });
      const tabs = nav.getByRole('button');
      await nav.waitFor();
      assert.equal(await tabs.count(), 5);
      for (const route of ['triage', 'patients', 'home', 'facility']) {
        const tab = nav.getByRole('button', { name: copy.common[route], exact: true });
        await activate(page, tab, touch, route === 'facility' ? 'Space' : 'Enter');
        assert.equal(await tab.getAttribute('aria-current'), 'page');
        if (route === 'triage') await page.getByText(copy.triage.noAssessmentsYet, { exact: true }).waitFor();
        if (route === 'patients') await page.getByPlaceholder(copy.patients.searchPlaceholder).waitFor();
        assert.doesNotMatch(await page.locator('body').innerText(), rawTranslationKey);
      }

      await page.getByRole('heading', { name: copy.facility.title }).waitFor();
      const detail = page.getByRole('button', { name: new RegExp(`^${copy.facility.viewDetails}:`) });
      await detail.first().waitFor();
      const stock = page.getByText(new RegExp(`^\\d+% ${copy.facility.medicineAvailability}$`));
      assert.equal(await stock.count(), await detail.count());
      if (width === 1280) {
        const first = await detail.nth(0).boundingBox();
        const second = await detail.nth(1).boundingBox();
        assert.ok(first.x + first.width < second.x && first.y === second.y, 'Desktop lists two cards side by side');
      }
      await assertUncovered(detail.last(), nav);
      const sos = page.getByTestId('global-sos');
      await page.getByText(copy.emergency.sosHint, { exact: true }).waitFor();
      await activate(page, sos, touch, 'Space');
      await page.getByRole('heading', { name: copy.emergency.selectCondition, exact: true }).waitFor();
      await page.getByText(copy.onboarding.emergencyResponseDesc, { exact: true }).waitFor();
      await assertUncovered(page.getByRole('button', { name: /Persistent Vomiting/ }), sos);
      assert.match(await page.locator('body').innerText(), { en: /synthetic data/i, hi: /कृत्रिम डेटा/, mr: /कृत्रिम डेटा/ }[language]);
      assert.match(await page.locator('body').innerText(), { en: /server sync paused/i, hi: /सर्वर सिंक रुका है/, mr: /सर्व्हर सिंक थांबवले आहे/ }[language]);
      assert.doesNotMatch(await page.locator('body').innerText(), rawTranslationKey);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, [], `${width}px: no uncaught JavaScript errors`);
      console.log(`Verified ${width}×${height} (${language}): onboarding, five navigation buttons, Facility stock and SOS picker`);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
