import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist-web/', import.meta.url));
let html = await readFile(join(root, 'index.html'), 'utf8');
html = html.replace(/<html\b[^>]*>/, '<html lang="de">').replace(/<title>.*?<\/title>/s, '<title>PAT Mentorship</title>')
  .replace('</head>', '<meta name="theme-color" content="#0D1113"><style>html,body,#root{background:#0D1113} :focus-visible{outline:2px solid #E78370;outline-offset:2px}</style></head>')
  .replace('</body>', '<script>if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});</script></body>');
await writeFile(join(root, 'index.html'), html);
async function walk(dir) {
  const entries = await readdir(join(root, dir), { withFileTypes: true });
  const all = await Promise.all(entries.map(entry => {
    const rel = join(dir, entry.name);
    return entry.isDirectory() ? walk(rel) : [rel];
  }));
  return all.flat();
}
const files = (await walk('')).filter(path => path !== 'sw.js' && !/\.(map|hbc|mp4)$/.test(path)).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(join(root, file)));
const cacheName = 'pat-preview-shell-' + hash.digest('hex').slice(0, 14);
const urls = files.map(file => '/' + file);
await writeFile(join(root, 'sw.js'), `const name = ${JSON.stringify(cacheName)}, urls = ${JSON.stringify(urls)};
self.addEventListener('install', e => e.waitUntil(caches.open(name).then(c => c.addAll(urls)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('pat-preview-shell-') && k !== name).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const path = new URL(e.request.url);
  if (e.request.method !== 'GET' || path.origin !== self.location.origin) return;
  const file = path.pathname === '/' ? '/index.html' : path.pathname;
  if (urls.includes(file)) e.respondWith(caches.open(name).then(c => c.match(file)).then(r => r || fetch(e.request)));
});`);
