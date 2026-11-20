const { createReadStream, statSync } = require('node:fs');
const { join } = require('node:path');

// Only these two preview films may be served by Metro or the local web preview.
const films = new Set(['fvg-v1.mp4', 'wochenprofil-v1.mp4']);
function sendFilm(req, res, next) {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (!route.startsWith('/media/')) return next();
  const name = route.slice('/media/'.length);
  if (!films.has(name)) { res.writeHead(404).end(); return; }
  if (req.method !== 'HEAD' && req.method !== 'GET') { res.writeHead(405).end(); return; }
  const file = join(__dirname, '..', 'preview-media', name);
  let total;
  try { total = statSync(file).size; } catch { res.writeHead(404).end(); return; }
  let start = 0, end = total - 1;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': 'bytes */' + total }).end(); return; }
    if (match[1]) {
      start = Number(match[1]);
      if (match[2]) end = Math.min(Number(match[2]), end);
    } else { start = Math.max(0, total - Number(match[2])); }
    if (start > end) { res.writeHead(416, { 'Content-Range': 'bytes */' + total }).end(); return; }
    res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + total);
  }
  res.writeHead(req.headers.range ? 206 : 200, {
    'Content-Type': 'video/mp4', 'Content-Length': end - start + 1,
    'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = createReadStream(file, { start, end });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
module.exports = { sendFilm };
