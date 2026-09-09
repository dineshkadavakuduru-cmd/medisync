const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

// Run after exporting with EXPO_PUBLIC_API_URL empty:
// node --test tests/stabilization-browser.cjs
// This exercises the exported UI and its own local demo, not backend E2E.
const dist = path.resolve(__dirname, '../dist');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };

test('stabilization: missing backend and local teleconsult browser flows', { timeout: 240000 }, async t => {
  // Main may still be exporting. An absent export is a failure, never a skip.
  const deadline = Date.now() + 120000;
  let exported;
  while (!exported) {
    try {
      const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
      const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)];
      assert.ok(scripts.length, 'dist/index.html must reference an exported bundle');
      for (const [, src] of scripts) await fs.access(path.join(dist, src.replace(/^\//, '')));
      exported = await fs.stat(path.join(dist, 'index.html'));
    } catch (error) {
      if (Date.now() >= deadline) throw new Error('No complete dist export. Run the main web build with EXPO_PUBLIC_API_URL empty.', { cause: error });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  t.diagnostic(`Serving local dist; index updated ${exported.mtime.toISOString()}. No backend mocks or public calls.`);

  const server = http.createServer(async (req, res) => {
    try {
      const file = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (file !== dist && !file.startsWith(dist + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const target = file === dist ? path.join(dist, 'index.html') : file;
      const data = await fs.readFile(target);
      res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const origin = process.env.MOBILE_TEST_URL || `http://127.0.0.1:${server.address().port}`;
    const target = new URL(origin);
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Use a local static server');
    for (const width of [375, 1280]) {
      await t.test(`${width}px`, { timeout: 55000 }, async viewportTest => {
        const context = await browser.newContext({ viewport: { width, height: 812 }, serviceWorkers: 'block' });
        const page = await context.newPage();
        page.setDefaultTimeout(8000);
        const errors = [];
        const forbiddenRequests = [];
        const consoleErrors = [];
        let stage = 'startup';
        page.on('pageerror', error => errors.push(`${stage}: ${error.message}`));
        page.on('console', message => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        });
        await context.addInitScript(() => {
          window.__stabilizationRejections = [];
          window.addEventListener('unhandledrejection', event => {
            window.__stabilizationRejections.push(String(event.reason?.stack || event.reason));
          });
        });
        // Abort AND fail unexpected requests: network blocking must not masquerade
        // as evidence that the bundle was built without backend configuration.
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.origin !== target.origin || /^\/api(?:\/|$)/.test(url.pathname)) {
            forbiddenRequests.push(`${route.request().method()} ${url.origin}${url.pathname}`);
            return route.abort();
          }
          return route.continue();
        });
        await context.routeWebSocket('**/*', socket => {
          forbiddenRequests.push(`WebSocket ${socket.url()}`);
          socket.close();
        });
        const text = value => page.getByText(value, { exact: true });
        const tab = name => page.getByRole('tab', { name, exact: true });
        const check = async name => {
          stage = name;
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const overflow = await page.evaluate(() => {
            const problems = [];
            if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('document');
            if (document.body.scrollWidth > innerWidth + 1) problems.push('body');
            for (const element of document.querySelectorAll('div')) {
              const rect = element.getBoundingClientRect();
              if (!rect.width || !rect.height || !element.checkVisibility()) continue;
              const style = getComputedStyle(element);
              // Vertical screen scrollers must not hide horizontal overflow.
              if (['auto', 'scroll'].includes(style.overflowY) && !['auto', 'scroll'].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1) {
                problems.push(`${element.textContent.slice(0, 80)} (${element.scrollWidth} > ${element.clientWidth})`);
              }
            }
            return problems;
          });
          assert.deepEqual(overflow, [], `${width}px ${name}: no horizontal overflow`);
          assert.deepEqual(errors, [], `${width}px ${name}: no unhandled JavaScript errors`);
          assert.deepEqual(await page.evaluate(() => window.__stabilizationRejections), [], `${name}: no unhandled promise rejections`);
          assert.deepEqual(forbiddenRequests, [], `${name}: no backend or public-call requests; export with EXPO_PUBLIC_API_URL empty`);
          viewportTest.diagnostic(`PASS ${name}`);
        };
        const switchRole = async (role, expectedTool, absentTool) => {
          await page.goto(origin);
          await page.getByTestId('home-profile').click();
          await text('Switch demo persona').waitFor();
          await page.getByRole('button', { name: role, exact: true }).click();
          await page.getByRole('button', { name: 'Close profile', exact: true }).click();
          await page.getByRole('dialog').waitFor({ state: 'hidden' });
          await tab('More').click();
          await page.getByTestId(`more-${expectedTool}`).waitFor();
          assert.equal(await page.getByTestId(`more-${absentTool}`).count(), 0, `${role}: previous role-only tool removed without reload`);
          assert.equal(await page.getByRole('tab').count(), 5);
          await check(`${role} reactive profile switch`);
        };
        try {
          await page.goto(origin);
          await text('Unified Healthcare').waitFor();
          await check('onboarding');
          await text('Skip').click();
          await text('Queue Management').waitFor();
          assert.equal(await page.getByRole('tab').count(), 5);
          await page.getByTestId('global-sos').waitFor();
          assert.equal(await tab('Inventory').count(), 0);
          assert.equal(await tab('Home Visit').count(), 0);
          await check('onboarding skip and home');

          await tab('More').click();
          await page.getByTestId('more-diagnostics').click();
          await text('The backend test catalogue is unavailable or empty. Creating orders is disabled until it loads.').waitFor();
          await text('Orders could not be refreshed. Any visible orders are the last loaded server snapshot.').waitFor();
          assert.equal(await page.getByRole('button', { name: 'New Order', exact: true }).isDisabled(), true);
          assert.equal(await text('No diagnostic orders').isVisible(), false, 'Backend failure must not be presented as confirmed empty orders');
          await page.getByRole('button', { name: 'Retry', exact: true }).click();
          await text('The backend test catalogue is unavailable or empty. Creating orders is disabled until it loads.').waitFor();
          await check('diagnostics explicit backend unavailable, nonblank, creation disabled');

          await switchRole('Pharmacist', 'inventory', 'ashahomevisit');
          await page.getByTestId('more-inventory').click();
          await text('Medicine Inventory').waitFor();
          await text('Server-confirmed stock and audit history. Pending actions are not stock or usage.').waitFor();
          await page.getByRole('textbox', { name: 'Facility ID', exact: true }).fill('stabilization-no-backend');
          await text('Load facility stock').click();
          await text('Inventory could not be loaded. Check the facility ID and connection; changes are disabled until a successful reload.').waitFor();
          for (const label of ['No medicines found', 'Dispense', 'Reorder', 'Record physical count']) {
            assert.equal(await text(label).isVisible(), false, `Unavailable inventory must not show ${label}`);
          }
          assert.equal(await page.getByText(/^Last server stock:/).isVisible(), false, 'No fake stock counts');
          await check('pharmacist More Inventory unavailable, no fake inventory');

          await switchRole('ASHA', 'ashahomevisit', 'inventory');
          await page.getByTestId('more-ashahomevisit').click();
          await text('ASHA Home Visit').waitFor();
          await text('ANC Due List').waitFor();
          await text('Patients could not be loaded. Retry when connected.').waitFor();
          await text('Filters use the recorded trimester and next visit date from the backend. Missing dates are shown as unknown; no clinical visit schedule is inferred.').waitFor();
          for (const label of ['Start Visit', 'No ANC patients due for visit']) {
            assert.equal(await text(label).isVisible(), false, `Missing backend must not imply ${label}`);
          }
          await page.getByRole('button', { name: 'Unknown / not recorded', exact: true }).click();
          await text('Patients could not be loaded. Retry when connected.').waitFor();
          await check('ASHA More Home Visit honest unavailable due list');

          await page.goto(origin);
          await tab('More').click();
          await page.getByTestId('more-teleconsult').click();
          await page.getByText(/^Local demo: sessions are saved only on this device\/browser/).waitFor();
          await page.getByRole('button', { name: 'Create local demo request', exact: true }).click();
          await text('Status: Requested').waitFor();
          assert.equal(await page.getByRole('button', { name: 'Accept request (clinician simulation)', exact: true }).count(), 0);
          await check('local demo request awaiting clinician');
          await page.getByRole('button', { name: 'Clinician', exact: true }).click();
          await page.getByRole('button', { name: 'Accept request (clinician simulation)', exact: true }).click();
          await text('Status: Accepted').waitFor();
          const room = page.getByText(/^https:\/\/meet\.jit\.si\/medisync-[a-f0-9]{48}$/);
          await room.waitFor();
          const roomLink = await room.innerText();
          assert.match(roomLink, /^https:\/\/meet\.jit\.si\/medisync-[a-f0-9]{48}$/);
          await page.getByText(/^Public Jitsi demo: do not share patient names/).waitFor();
          assert.equal(await page.getByRole('button', { name: 'Join real Jitsi meeting', exact: true }).isEnabled(), true);
          assert.equal(await page.locator('iframe').count(), 0, 'Do not embed or join the public meeting');
          await check('clinician acceptance displays real room link without joining');

          // Refresh reads app-owned storage; do not seed or alter session status.
          await page.getByRole('button', { name: 'Refresh', exact: true }).click();
          await text('Status: Accepted').waitFor();
          assert.equal(await room.innerText(), roomLink, 'Refresh preserves the accepted room');
          await viewportTest.test('local Rx when reachable without joining a public call', async rx => {
            const writeRx = page.getByRole('button', { name: 'Write Prescription', exact: true });
            if (!await writeRx.isVisible()) {
              rx.skip('Accepted sessions require an in-progress call before prescribing; no public call joined and no status injected.');
              return;
            }
            await writeRx.click();
            await page.getByPlaceholder('Medication Name', { exact: true }).fill('TEST ONLY - not a medicine');
            await page.getByPlaceholder('Dosage', { exact: true }).fill('test dose');
            await page.getByPlaceholder('Frequency', { exact: true }).fill('test frequency');
            await page.getByPlaceholder('Duration', { exact: true }).fill('test duration');
            await check('local Rx form');
            await text('Save Prescription').click();
            await text('Prescription saved to this local demo session on this device only.').waitFor();
            await text('Saved prescription').waitFor();
            await page.getByRole('button', { name: 'Refresh', exact: true }).click();
            await text('TEST ONLY - not a medicine').waitFor();
            await check('local Rx saved and refreshed, not backend prescribing');
          });
          await check('final state');
        } catch (error) {
          viewportTest.diagnostic(`Failed near ${stage}. Visible text:\n${(await page.locator('body').innerText().catch(() => '')).slice(0, 7000)}`);
          throw error;
        } finally {
          if (consoleErrors.length) viewportTest.diagnostic(`Console errors (separate from uncaught errors): ${JSON.stringify(consoleErrors)}`);
          if (errors.length) viewportTest.diagnostic(`Unhandled errors: ${JSON.stringify(errors)}`);
          if (forbiddenRequests.length) viewportTest.diagnostic(`Blocked unexpected requests: ${JSON.stringify(forbiddenRequests)}`);
          await context.close();
        }
      });
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
