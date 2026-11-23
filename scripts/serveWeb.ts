/**
 * سرو محلی وب‌اپ (پیش‌نمایش توسعه).
 * اجرا: npm run serve:web  →  http://localhost:4173
 * پورت با متغیر محیطی PORT قابل تغییر است.
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..', 'web');
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '0.0.0.0';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(join(webRoot, 'data', 'mashaqel-data.json'))) {
  console.warn('هشدار: web/data/mashaqel-data.json موجود نیست. ابتدا `npm run export:web` را اجرا کنید.');
}

function resolveTarget(urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  const candidate = resolve(webRoot, relative);
  if (candidate !== webRoot && !candidate.startsWith(webRoot + sep)) return null;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) return join(candidate, 'index.html');
  return existsSync(candidate) ? candidate : null;
}

const server = createServer((request, response) => {
  const startedAt = Date.now();
  let target = resolveTarget(request.url ?? '/');
  if (!target) target = join(webRoot, 'index.html');

  if (!existsSync(target)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('یافت نشد');
    return;
  }

  const extension = extname(target).toLowerCase();
  const headers: Record<string, string> = {
    'content-type': MIME[extension] ?? 'application/octet-stream',
    'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=300',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff',
  };

  response.writeHead(200, headers);
  const stream = createReadStream(target);
  stream.on('error', () => {
    response.destroy();
  });
  stream.pipe(response);
  response.on('finish', () => {
    console.log(`${request.method} ${request.url} → ${extension || 'html'} (${Date.now() - startedAt}ms)`);
  });
});

server.listen(port, host, () => {
  console.log(`وب‌اپ مشاغل روی http://localhost:${port} سرو می‌شود (ریشه: ${webRoot}).`);
});
