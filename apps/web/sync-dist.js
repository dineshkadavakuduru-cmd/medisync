const fs = require('fs');
const path = require('path');

const mobileDist = path.join(__dirname, 'apps', 'mobile', 'dist');
const dotNext = path.join(__dirname, '.next');
	try {
  if (fs.existsSync(mobileDist) && !fs.existsSync(dotNext)) {
    fs.cpSync(mobileDist, dotNext, { recursive: true });
    console.log('[sync-dist] Synced apps/mobile/dist -> .next');
  } else if (fs.existsSync(dotNext) && !fs.existsSync(mobileDist)) {
    fs.mkdirSync(path.dirname(mobileDist), { recursive: true });
    fs.cpSync(dotNext, mobileDist, { recursive: true });
    console.log('[sync-dist] Synced .next -> apps/mobile/dist');
  }
} catch (err) {
  console.warn('[sync-dist] Warning: ', err.message);
}
