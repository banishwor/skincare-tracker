import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

const pkgVersion = (
  JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')) as {
    version: string;
  }
).version;

/**
 * Stamp the service worker's cache name with the package version.
 * public/sw.js ships with an `__APP_VERSION__` placeholder; replacing it
 * in dist/sw.js makes every versioned release byte-different, which is
 * what makes the browser register an update at all. Throws if the
 * placeholder is missing or the version didn't land — a silent no-op
 * here would quietly kill the in-app update flow.
 */
function stampServiceWorker(version: string): Plugin {
  return {
    name: 'stamp-sw-version',
    apply: 'build',
    closeBundle: async () => {
      const swPath = path.resolve(__dirname, 'dist/sw.js');
      const src = await fs.promises.readFile(swPath, 'utf-8');
      if (!src.includes('__APP_VERSION__')) {
        throw new Error(
          'dist/sw.js is missing the __APP_VERSION__ placeholder — cannot stamp the cache version.',
        );
      }
      const stamped = src.split('__APP_VERSION__').join(version);
      if (!stamped.includes(`skin-routine-pwa-${version}`)) {
        throw new Error('Failed to stamp the service-worker cache version into dist/sw.js.');
      }
      await fs.promises.writeFile(swPath, stamped);
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), stampServiceWorker(pkgVersion)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
