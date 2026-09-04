const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = 'https://medisync-rose-one.vercel.app/';
const VIDEO_DIR = path.join(__dirname, 'demo-videos');

if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pause(page, ms = 2500) {
  await sleep(ms);
}
async function smoothScroll(page, dy, steps = 20) {
  const stepSize = dy / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepSize);
    await sleep(40);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: 780, height: 1688 },
    },
  });
  const page = await context.newPage();

  // === Scene 1: Splash Screen ===
  console.log('Scene 1: Splash...');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await pause(page, 3500); // let splash display

  // === Scene 2: Home Dashboard ===
  console.log('Scene 2: Home Dashboard...');
  await page.waitForLoadState('networkidle');
  await pause(page, 2500);

  // Scroll through home dashboard
  await smoothScroll(page, 600);
  await pause(page, 2000);
  await smoothScroll(page, 600);
  await pause(page, 2000);

  // Try to open profile (AD avatar)
  const avatar = page.locator('text=/^AD$/').first();
  if (await avatar.isVisible().catch(() => false)) {
    await avatar.click();
    await pause(page, 2500);
    // Close modal
    await page.keyboard.press('Escape').catch(() => {});
    const closeBtn = page.locator('text=/close/i').first();
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
    await pause(page, 1500);
  }

  // === Scene 3: Triage ===
  console.log('Scene 3: Triage...');
  const triage = page.locator('text=/triage/i').first();
  if (await triage.isVisible().catch(() => false)) {
    await triage.click();
    await pause(page, 3000);
    // Try "Start" / "Quick" buttons
    const start = page.locator('button:has-text("Start"), button:has-text("Quick"), button:has-text("Begin"), button:has-text("New")').first();
    if (await start.isVisible().catch(() => false)) {
      await start.click();
      await pause(page, 2500);
    }
    // Scroll through triage
    await smoothScroll(page, 500);
    await pause(page, 2000);
  }

  // === Scene 4: Teleconsult ===
  console.log('Scene 4: Teleconsult...');
  const tele = page.locator('text=/teleconsult|teleconsultation|consult/i').first();
  if (await tele.isVisible().catch(() => false)) {
    await tele.click();
    await pause(page, 3000);
    const join = page.locator('button:has-text("Join"), button:has-text("Start")').first();
    if (await join.isVisible().catch(() => false)) {
      await join.click();
      await pause(page, 2500);
      await page.goBack().catch(() => {});
      await pause(page, 1500);
    }
  }

  // === Scene 5: Appointments ===
  console.log('Scene 5: Appointments...');
  const appts = page.locator('text=/appoint|appts|schedule/i').first();
  if (await appts.isVisible().catch(() => false)) {
    await appts.click();
    await pause(page, 3000);
  }

  // === Scene 6: Patients ===
  console.log('Scene 6: Patients...');
  const patients = page.locator('text=/patients/i').first();
  if (await patients.isVisible().catch(() => false)) {
    await patients.click();
    await pause(page, 3000);
  }

  // === Scene 7: Facilities ===
  console.log('Scene 7: Facilities...');
  const facility = page.locator('text=/facilit|hospital|clinic/i').first();
  if (await facility.isVisible().catch(() => false)) {
    await facility.click();
    await pause(page, 3000);
    const filters = ['Sub-Centre', 'PHC', 'CHC', 'District Hospital'];
    for (const f of filters) {
      const chip = page.locator(`text=/${f}/i`).first();
      if (await chip.isVisible().catch(() => false)) {
        await chip.click();
        await pause(page, 1500);
      }
    }
    const view = page.locator('button:has-text("View"), a:has-text("View")').first();
    if (await view.isVisible().catch(() => false)) {
      await view.click();
      await pause(page, 2500);
      await page.goBack().catch(() => {});
    }
  }

  // === Scene 8: Emergency / SOS ===
  console.log('Scene 8: Emergency...');
  const sos = page.locator('text=/emergency|sos/i').first();
  if (await sos.isVisible().catch(() => false)) {
    await sos.click();
    await pause(page, 3000);
    const newBtn = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("SOS"), a:has-text("New")').first();
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click();
      await pause(page, 3000);
    }
  }

  // Close out
  await pause(page, 2000);
  await context.close();
  await browser.close();

  console.log('Done. Video saved to:', VIDEO_DIR);
})().catch((e) => {
  console.error('Recording failed:', e);
  process.exit(1);
});
