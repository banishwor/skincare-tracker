// Post-build assertion (run in CI after `npm run build`): the built
// service worker must carry the current package version in its cache
// name, with no placeholder left. If this fails, browsers would never
// register the release as an update.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const sw = fs.readFileSync(path.join(root, 'dist/sw.js'), 'utf-8');

if (sw.includes('__APP_VERSION__')) {
  console.error('FAIL: dist/sw.js still contains the __APP_VERSION__ placeholder.');
  process.exit(1);
}
if (!sw.includes(`skin-routine-pwa-${version}`)) {
  console.error(`FAIL: dist/sw.js cache name does not carry package version ${version}.`);
  process.exit(1);
}
console.log(`OK: dist/sw.js cache name carries version ${version}.`);
