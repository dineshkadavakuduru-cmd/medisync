import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = JSON.parse(readFileSync('package.json', 'utf8')).scripts.start;
assert.equal(script, 'node dist/server.js');
const directory = mkdtempSync(join(tmpdir(), 'medisync-start-'));
const child = spawn(process.execPath, [script.slice('node '.length)], {
  env: { ...process.env, HOST: '127.0.0.1', PORT: '0', DATABASE_URL: '', VITALS_MODE: 'demo', ENABLE_SIMULATOR: 'false', GEMINI_API_KEY: '',
    DIAGNOSTICS_STORE_PATH: join(directory, 'diagnostics.json'), REFERRALS_STORE_PATH: join(directory, 'referrals.json'), TELECONSULT_STORE_PATH: join(directory, 'teleconsult.json') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', data => { output += data.toString(); });
child.stderr.on('data', data => { output += data.toString(); });
try {
  const deadline = Date.now() + 15000;
  while (!/http:\/\/127\.0\.0\.1:\d+/.test(output)) {
    assert.equal(child.exitCode, null, output);
    assert.ok(Date.now() < deadline, `Startup timed out: ${output}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)![0];
  const health = await fetch(url);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).mode, 'demo');
  const vitals = await fetch(`${url}/api/emergencies/absent/vitals`);
  assert.equal(vitals.status, 404);
  assert.equal((await vitals.json()).error, 'Emergency not found');
  console.log(`PASS: npm start command (${script}) boots without DATABASE_URL; HTTP health and vitals verified`);
} finally {
  if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
  rmSync(directory, { recursive: true, force: true });
}
