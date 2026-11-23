/**
 * بازبینی بسته استقرار سازمانی (فاز ۱۲).
 * فایل‌های Docker/Nginx/Caddy/systemd را از نظر هم‌خوانی پورت، مسیر و سخت‌سازی بررسی می‌کند.
 * اجرا: npm run check:deploy
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');

const checks: Array<{ label: string; ok: boolean; detail?: string }> = [];
const check = (label: string, ok: boolean, detail = ''): void => {
  checks.push({ label, ok, ...(detail ? { detail } : {}) });
};

const files = [
  'deploy/Dockerfile',
  'deploy/docker-compose.yml',
  'deploy/Caddyfile',
  'deploy/nginx.conf',
  'deploy/mashaqel-api.service',
  'deploy/.env.example',
  'server/README.md',
];
for (const file of files) check(`وجود ${file}`, existsSync(resolve(root, file)));

const dockerfile = read('deploy/Dockerfile');
check('Dockerfile: Node 22', /FROM node:22/.test(dockerfile));
check('Dockerfile: پورت ۸۷۸۷', /EXPOSE 8787/.test(dockerfile));
check('Dockerfile: HEALTHCHECK', /HEALTHCHECK[\s\S]*\/api\/health/.test(dockerfile));
check('Dockerfile: اجرای غیر ریشه', /USER node/.test(dockerfile));
check('Dockerfile: پایگاه داده روی والیوم', /MASHQEL_DB=\/data\//.test(dockerfile));
check('Dockerfile: دستور اجرا', /CMD \["node", "server\/server\.mjs"\]/.test(dockerfile));

const compose = read('deploy/docker-compose.yml');
check('Compose: سرویس api', /^\s{2}api:/m.test(compose));
check('Compose: سرویس web', /^\s{2}web:/m.test(compose));
check('Compose: سیاست restart', /restart: unless-stopped/.test(compose));
check('Compose: والیوم داده', /mashaqel-data:\/data/.test(compose));
check('Compose: پورت‌های ۸۰/۴۴۳', /'80:80'/.test(compose) && /'443:443'/.test(compose));
check('Compose: Caddyfile', /\.\/Caddyfile/.test(compose));
check('Compose: env_file', /env_file:/.test(compose));

const caddy = read('deploy/Caddyfile');
check('Caddy: پراکسی /api', /handle \/api\/\*/.test(caddy) && /reverse_proxy api:8787/.test(caddy));
check('Caddy: SPA fallback', /try_files \{path\} \/index\.html/.test(caddy));
check('Caddy: HSTS', /Strict-Transport-Security/.test(caddy));

const nginx = read('deploy/nginx.conf');
check('Nginx: پراکسی به ۸۷۸۷', /proxy_pass http:\/\/127\.0\.0\.1:8787/.test(nginx));
check('Nginx: TLS 1.2/1.3', /TLSv1\.2 TLSv1\.3/.test(nginx));
check('Nginx: HSTS', /Strict-Transport-Security/.test(nginx));
check('Nginx: سقف حجم بدنه', /client_max_body_size/.test(nginx));
check('Nginx: SPA fallback', /try_files \$uri \$uri\/ \/index\.html/.test(nginx));

const unit = read('deploy/mashaqel-api.service');
check('systemd: اجرای سرور', /ExecStart=.*server\/server\.mjs/.test(unit));
check('systemd: کاربر اختصاصی', /User=mashaqel/.test(unit));
check('systemd: راه‌اندازی دوباره', /Restart=on-failure/.test(unit));
check('systemd: سخت‌سازی فایل‌سیستم', /ProtectSystem=strict/.test(unit) && /ReadWritePaths=\/var\/lib\/mashaqel/.test(unit));

const env = read('deploy/.env.example');
for (const key of ['PORT', 'HOST', 'MASHQEL_DB', 'MASHQEL_CORS_ORIGIN']) {
  check(`env: کلید ${key}`, new RegExp(`^${key}=`, 'm').test(env));
}
check('env: بدون رمز واقعی', !/(password|client_secret)=.+/i.test(env));

const serverSource = read('server/server.mjs');
for (const key of ['PORT', 'HOST', 'MASHQEL_DB', 'MASHQEL_CORS_ORIGIN']) {
  check(`سرور: خواندن ${key}`, serverSource.includes(key));
}

const browserSources = ['web/app.js', 'web/index.html', 'web/style.css'].map((file) => ({ file, text: read(file) }));
for (const { file, text } of browserSources) {
  check(
    `${file}: بدون فراخوانی مستقیم localhost`,
    !/https?:\/\/(localhost|127\.0\.0\.1)/.test(text),
  );
}

const failed = checks.filter((entry) => !entry.ok);
for (const entry of checks) console.log(`${entry.ok ? '✓' : '✗'} ${entry.label}${entry.ok ? '' : ` → ${entry.detail ?? ''}`}`);
console.log(`\n${checks.length - failed.length}/${checks.length} بررسی بسته استقرار موفق.`);
if (failed.length > 0) {
  console.error('بسته استقرار ناسازگار است.');
  process.exitCode = 1;
}
