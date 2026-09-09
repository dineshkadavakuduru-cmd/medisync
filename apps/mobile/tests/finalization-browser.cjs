const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const ts = require('typescript');

// Run against the completed no-API export: node --test tests/finalization-browser.cjs
// MOBILE_TEST_URL may point to a loopback static server. No API mocks, storage
// seeding, public calls, or Jitsi joins. Restarts reuse only app-written storage.
const dist = path.resolve(__dirname, '../dist');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
const tabs = ['home', 'triage', 'patients', 'facility', 'more'];
const translations = Object.fromEntries(['en', 'hi', 'mr'].map(lang => [lang, require(`../src/i18n/translations/${lang}.json`)]));

test('finalization: rebuilt no-API browser journeys', { timeout: 300000 }, async t => {
  // Read feature-local copy without importing native app dependencies.
  const copyModule = { exports: {} };
  const copyCode = ts.transpileModule(await fs.readFile(path.join(__dirname, '../src/i18n/patientJourney.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('exports', copyCode)(copyModule.exports);
  const { patientJourney } = copyModule.exports;
  const copy = patientJourney.en;
  const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)];
  assert.ok(scripts.length, 'Build dist before running; missing exports are failures, not skips');
  for (const [, src] of scripts) {
    const file = path.join(dist, src.replace(/^\//, ''));
    const data = await fs.readFile(file);
    t.diagnostic(`Export ${src}: sha256=${createHash('sha256').update(data).digest('hex')}; mtime=${(await fs.stat(file)).mtime.toISOString()}`);
  }
  const server = http.createServer(async (req, res) => {
    try {
      const file = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (file !== dist && !file.startsWith(dist + path.sep)) return res.writeHead(403).end();
      const target = file === dist ? path.join(dist, 'index.html') : file;
      const data = await fs.readFile(target);
      res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const target = new URL(process.env.MOBILE_TEST_URL || `http://127.0.0.1:${server.address().port}/`);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'MOBILE_TEST_URL must serve local assets on loopback');
  assert.ok(['http:', 'https:'].includes(target.protocol));
  t.diagnostic(`Testing ${target.href}; only local static GETs and the local NetInfo HEAD probe are allowed.`);

  for (const width of [375, 320, 1280]) {
    await t.test(`${width}px`, { timeout: 95000 }, async viewportTest => {
      const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'medisync-finalization-'));
      let context;
      let page;
      let stage = 'startup';
      const errors = [];
      const blocked = [];
      const consoleErrors = new Set();
      const start = async () => {
        context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width, height: 812 }, serviceWorkers: 'block' });
        await context.route('**/*', route => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin === target.origin && url.pathname === target.pathname && request.method() === 'HEAD') return route.continue();
          if (url.origin !== target.origin || request.method() !== 'GET' || /\/api(?:\/|$)/.test(url.pathname) || !['document', 'script', 'stylesheet', 'image', 'font'].includes(request.resourceType())) {
            blocked.push(`${stage}: ${request.method()} ${url.origin}${url.pathname}`);
            return route.abort();
          }
          return route.continue();
        });
        await context.routeWebSocket('**/*', socket => {
          blocked.push(`${stage}: WebSocket ${socket.url()}`);
          socket.close();
        });
        await context.addInitScript(() => {
          window.__finalizationRejections = [];
          window.addEventListener('unhandledrejection', event => window.__finalizationRejections.push(String(event.reason?.stack || event.reason)));
        });
        page = context.pages()[0];
        page.setDefaultTimeout(8000);
        page.on('pageerror', error => errors.push(`${stage}: ${error.message}`));
        page.on('console', message => { if (message.type() === 'error') consoleErrors.add(message.text()); });
      };
      const text = value => page.getByText(value, { exact: true }).filter({ visible: true });
      const tab = name => page.getByTestId(`tab-${name}`);
      const demoSwitch = () => page.getByTestId('demo-mode-switch').locator('input[type="checkbox"]');
      const home = async () => { await page.goto(target.href); await tab('home').waitFor(); };
      const profileOpen = async () => { await tab('home').click(); await page.getByTestId('home-profile').click(); await page.getByTestId('demo-mode-switch').waitFor(); };
      const profileClose = async () => {
        await page.getByRole('button', { name: 'Close profile', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
      };
      const check = async (navigation = false, language = 'en') => {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.deepEqual(errors, [], `${stage}: uncaught JavaScript errors`);
        assert.deepEqual(await page.evaluate(() => window.__finalizationRejections), [], `${stage}: unhandled rejections`);
        assert.equal(await page.locator('iframe').count(), 0, 'No embedded public call');
        const overflow = await page.evaluate(() => {
          const problems = [];
          if (document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1) problems.push('document/body');
          for (const element of document.querySelectorAll('div')) {
            if (!element.checkVisibility() || !element.clientHeight) continue;
            const style = getComputedStyle(element);
            if (['auto', 'scroll'].includes(style.overflowY) && !['auto', 'scroll'].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1) problems.push(element.textContent.slice(0, 90));
          }
          return problems;
        });
        assert.deepEqual(overflow, [], `${stage}: horizontal overflow`);
        const frameWidth = Math.min(width, 520);
        const sos = await page.getByTestId('global-sos').boundingBox();
        assert.ok(sos && sos.x >= (width - frameWidth) / 2 - 1 && sos.x + sos.width <= (width + frameWidth) / 2 + 1 && sos.y + sos.height <= 813, 'Global SOS remains in frame');
        if (navigation) {
          assert.equal(await page.getByRole('tab').count(), 5);
          const boxes = [];
          for (const name of tabs) {
            assert.equal(await tab(name).getAttribute('aria-label'), translations[language].common[name]);
            const box = await tab(name).boundingBox();
            assert.ok(box && box.x >= (width - frameWidth) / 2 - 1 && box.x + box.width <= (width + frameWidth) / 2 + 1, `${name}: fixed tab fits without scrolling`);
            assert.ok(box.y > 812 / 2 && box.y + box.height <= sos.y + 1, `${name}: bottom tab above SOS: ${JSON.stringify({ box, sos })}`);
            boxes.push(box);
          }
          for (let i = 1; i < boxes.length; i++) {
            assert.ok(Math.abs(boxes[i].y - boxes[0].y) < 1 && boxes[i].x >= boxes[i - 1].x + boxes[i - 1].width - 1, 'Tabs share one row without overlap');
          }
        }
      };
      const step = (name, run) => viewportTest.test(name, async stepTest => {
        stage = name;
        try { await run(stepTest); }
        catch (error) { viewportTest.diagnostic(`${name}: visible text\n${(await page.locator('body').innerText()).slice(0, 6500)}`); throw error; }
      });
      try {
        await start();
        let patientId;
        const patientName = `TEST ONLY Finalization ${width}`;
        await step('onboarding; five fixed tabs and global SOS on every primary screen', async () => {
          await page.goto(target.href);
          await text('Unified Healthcare').waitFor();
          await text('Skip').click();
          await tab('home').waitFor();
          for (const name of tabs) { await tab(name).click(); await check(true); }
        });
        await step('no-API defaults demo on; required-field validation; local patient create/detail/reload', async () => {
          await home();
          await profileOpen();
          assert.equal(await demoSwitch().isChecked(), true);
          await profileClose();
          await tab('patients').click();
          await text('Demo: local only, no backend').waitFor();
          await text('+ Add Patient').click();
          await text(translations.en.common.save).click();
          await text(copy.ageError).waitFor();
          await page.getByPlaceholder('Name', { exact: true }).fill(patientName);
          await page.getByPlaceholder('Age', { exact: true }).fill('29');
          await text('Female').click();
          await page.getByPlaceholder('Village', { exact: true }).fill('Synthetic Village');
          await page.getByPlaceholder('Phone', { exact: true }).fill('9000000000');
          await text(translations.en.common.save).click();
          await text('Name, village and district are required (maximum 160 characters).').waitFor();
          await page.getByRole('textbox', { name: 'District', exact: true }).fill('Synthetic District');
          await text(translations.en.common.save).click();
          await page.getByRole('dialog').waitFor({ state: 'hidden' });
          await text(patientName).waitFor();
          patientId = await page.getByText(/^demo-patient-/, { exact: false }).innerText();
          assert.match(patientId, /^demo-patient-[\w-]+$/);
          await text(patientName).click();
          await text(`Local patient ID: ${patientId}`).waitFor();
          await text(patientName).waitFor();
          await text('9000000000').waitFor();
          await check();
          await page.reload();
          await tab('patients').click();
          await text(patientName).click();
          await text(`Local patient ID: ${patientId}`).waitFor();
          await check();
        });
        await step('demo patient print/save PDF availability (no fabricated prescription)', async () => {
          assert.ok(patientId, 'Patient creation must have passed');
          await home();
          await tab('patients').click();
          await text(patientName).click();
          await text(`${copy.localId}: ${patientId}`).waitFor();
          await page.getByText(copy.demoHistory, { exact: false }).filter({ visible: true }).waitFor();
          await text(copy.printHint).waitFor();
          assert.equal(await text(copy.printPdf).count(), 0, 'No Print/save PDF action without a linked prescription');
          assert.equal(context.pages().length, 1, 'No print popup opened');
          await check();
          viewportTest.diagnostic('PRINT GAP: demo registry has no linked Rx; popup HTML/print UI not exercised. No data injected and no print dialog or PDF generated.');
        });
        await step('Home demo toggle: server unavailable, no sample substitution, local patient restored', async () => {
          assert.ok(patientId, 'Patient creation must have passed');
          await home();
          await profileOpen();
          await demoSwitch().uncheck();
          assert.equal(await demoSwitch().isChecked(), false);
          await profileClose();
          await tab('patients').click();
          await page.getByRole('alert').filter({ hasText: 'No sample patients substituted.' }).waitFor();
          await text('Server-confirmed patients').waitFor();
          assert.equal(await text(patientName).isVisible(), false);
          assert.equal(await text('No patients found').isVisible(), false, 'Unavailable must not imply confirmed empty');
          assert.equal(await text('Local patient ID').count(), 0);
          await check(true);
          await page.reload();
          await profileOpen();
          assert.equal(await demoSwitch().isChecked(), false, 'Server mode survives reload');
          await demoSwitch().check();
          assert.equal(await demoSwitch().isChecked(), true);
          await profileClose();
          await tab('patients').click();
          await text(patientName).click();
          await text(`Local patient ID: ${patientId}`).waitFor();
          await check();
        });
        for (const [language, label] of [['hi', '\u0939\u093f\u0902'], ['mr', '\u092e\u0930\u093e']]) {
          await step(`${language}: UI language persists across browser process restart`, async () => {
            await home();
            await text(label).click();
            await page.getByRole('tab', { name: translations[language].common.home, exact: true }).waitFor();
            await check(true, language);
            await context.close();
            await start();
            await home();
            await page.getByRole('tab', { name: translations[language].common.home, exact: true }).waitFor();
            await check(true, language);
            await tab('patients').click();
            await text(patientJourney[language].demoSource).waitFor();
            await text(patientName).click();
            await text(`${patientJourney[language].localId}: ${patientId}`).waitFor();
            await text(patientJourney[language].timeline).waitFor();
            await page.getByText(patientJourney[language].demoHistory, { exact: false }).filter({ visible: true }).waitFor();
            await check(false, language);
            await home();
            await tab('patients').click();
            await text(`+ ${translations[language].patients.addPatient}`).click();
            const dialog = page.getByRole('dialog');
            for (const field of ['name', 'age', 'village', 'phone', 'district']) {
              await dialog.getByRole('textbox', { name: patientJourney[language][field], exact: true }).waitFor();
            }
            await dialog.getByText(translations[language].common.save, { exact: true }).click();
            await dialog.getByRole('alert').getByText(patientJourney[language].ageError, { exact: true }).waitFor();
            await home();
            await tab('more').click();
            await page.getByTestId('more-diagnostics').getByText(translations[language].common.diagnostics, { exact: true }).waitFor();
            await check(true, language);
            await tab('home').click();
            await text('EN').click();
            await page.getByRole('tab', { name: 'Home', exact: true }).waitFor();
          });
        }
        await step('More Diagnostics renders unavailable; role-specific entries react without reload', async () => {
          await home();
          await tab('more').click();
          for (const key of ['diagnostics', 'teleconsult', 'appointments', 'emergency']) await page.getByTestId(`more-${key}`).waitFor();
          assert.equal(await page.getByTestId('more-inventory').count(), 0);
          assert.equal(await page.getByTestId('more-ashahomevisit').count(), 0);
          await page.getByTestId('more-diagnostics').click();
          await text('The backend test catalogue is unavailable or empty. Creating orders is disabled until it loads.').waitFor();
          await text('Orders could not be refreshed. Any visible orders are the last loaded server snapshot.').waitFor();
          assert.equal(await page.getByRole('button', { name: 'New Order', exact: true }).isDisabled(), true);
          assert.equal(await text('No diagnostic orders').isVisible(), false);
          await page.getByRole('button', { name: 'Retry', exact: true }).click();
          await text('The backend test catalogue is unavailable or empty. Creating orders is disabled until it loads.').waitFor();
          await check();
          await home();
          for (const [role, present, absent] of [['Pharmacist', 'inventory', 'ashahomevisit'], ['ASHA', 'ashahomevisit', 'inventory']]) {
            await profileOpen();
            await page.getByRole('button', { name: role, exact: true }).click();
            await profileClose();
            await tab('more').click();
            await page.getByTestId(`more-${present}`).waitFor();
            assert.equal(await page.getByTestId(`more-${absent}`).count(), 0);
            await check(true);
          }
        });
        await step('Facility synthetic forecast: four horizons, local method, disclaimers, retry and close', async () => {
          await home();
          await tab('facility').click();
          await text('Mulshi PHC').click();
          await text('DEMO MODE: Synthetic selected facility').waitFor();
          await text('Mulshi PHC').waitFor();
          const disclaimer = 'Experimental synthetic/demo method, not clinically validated. Do not use for clinical decisions or automatic bed allocation.';
          await text(disclaimer).waitFor();
          await text('Only a current facility snapshot is available. No real hourly occupancy history is provided, so no facility forecast can be shown.').waitFor();
          await check();
          await page.getByRole('button', { name: 'Try synthetic forecast demo', exact: true }).click();
          await text('SAMPLE: total/general beds, not ICU').waitFor();
          await text("Reproducible sample only: 100 beds, 24 hourly observations on 1 Jan 2025 (UTC). Not this facility's history or live availability.").waitFor();
          await text('ML URL is not configured. Showing a local heuristic.').waitFor();
          await text('Source: On-device heuristic fallback').waitFor();
          await text('Heuristic, not LSTM: moving average plus fitted hourly trend, bounded to sample capacity.').waitFor();
          const horizons = page.getByText(/^\+\d+ hours$/).filter({ visible: true });
          assert.deepEqual(await horizons.allTextContents(), ['+6 hours', '+12 hours', '+24 hours', '+48 hours']);
          const forecastTiles = [];
          for (const horizon of [6, 12, 24, 48]) {
            const tile = text(`+${horizon} hours`).locator('..');
            const tileText = await tile.innerText();
            const counts = tileText.match(/Occupied: (\d+)\/100 \((\d+)%\)[\s\S]*Available: (\d+)/);
            assert.ok(counts, `${horizon}h: bounded occupancy and availability rendered`);
            assert.equal(Number(counts[1]) + Number(counts[3]), 100);
            assert.equal(Number(counts[1]), Number(counts[2]));
            const expectedTime = new Date(Date.UTC(2025, 0, 1, 23 + horizon)).toISOString().slice(0, 16).replace('T', ' ');
            assert.ok(tileText.includes(`UTC sample time: ${expectedTime}`));
            forecastTiles.push(tileText);
          }
          await text(disclaimer).waitFor();
          await check();
          await page.getByRole('button', { name: 'Retry forecast', exact: true }).click();
          await text('Source: On-device heuristic fallback').waitFor();
          for (const [index, horizon] of [6, 12, 24, 48].entries()) {
            assert.equal(await text(`+${horizon} hours`).locator('..').innerText(), forecastTiles[index], 'Retry is deterministic');
          }
          await page.getByRole('button', { name: 'Close demo', exact: true }).click();
          await page.getByRole('button', { name: 'Try synthetic forecast demo', exact: true }).waitFor();
          assert.equal(await horizons.count(), 0);
          await check();
        });
        await step('final safety: no public Jitsi join, no API/external requests, no uncaught errors', async () => {
          await check();
          assert.deepEqual(blocked, [], 'Unexpected network attempts (all blocked before transmission)');
        });
      } finally {
        if (consoleErrors.size) viewportTest.diagnostic(`Console errors (not uncaught exceptions): ${JSON.stringify([...consoleErrors])}`);
        if (blocked.length) viewportTest.diagnostic(`Blocked requests: ${JSON.stringify(blocked)}`);
        if (context) await context.close();
        await fs.rm(profile, { recursive: true, force: true });
      }
    });
  }
});
