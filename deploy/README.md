# بسته استقرار سازمانی — فاز ۱۲

استقرار امن سامانه در شبکه سازمان: سرو فایل‌های استاتیک + پراکسی `/api` + TLS + سرویس پایدار.

## گزینه ۱ — Docker Compose (سریع‌ترین)

```bash
cd deploy
cp .env.example .env          # MASHQEL_DOMAIN و MASHQEL_CORS_ORIGIN را تنظیم کنید
docker compose up -d --build
```

- `web` (Caddy) فایل‌های `web/` را سرو می‌کند، `/api/*` را به سرویس `api` می‌فرستد و گواهی TLS را
  برای دامنه `MASHQEL_DOMAIN` به‌صورت خودکار از Let's Encrypt می‌گیرد.
- داده در والیوم `mashaqel-data` (مسیر `/data/mashaqel.sqlite`) نگه‌داری می‌شود.
- سلامت سرویس با `HEALTHCHECK` تصویر و `GET /api/health` سنجیده می‌شود.

پشتیبان روزانه از والیوم:

```bash
docker run --rm -v mashaqel_mashaqel-data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/mashaqel-$(date +%F).tgz -C /data .
```

## گزینه ۲ — نصب مستقیم (systemd + Nginx)

```bash
sudo useradd --system --home /srv/mashaqel --shell /usr/sbin/nologin mashaqel
sudo mkdir -p /srv/mashaqel /var/lib/mashaqel /etc/mashaqel
sudo rsync -a ./web ./server /srv/mashaqel/
sudo chown -R mashaqel:mashaqel /srv/mashaqel /var/lib/mashaqel

sudo cp deploy/.env.example /etc/mashaqel/api.env   # مقادیر را ویرایش کنید
sudo cp deploy/mashaqel-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now mashaqel-api
sudo cp deploy/nginx.conf /etc/nginx/sites-available/mashaqel
sudo ln -s /etc/nginx/sites-available/mashaqel /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

گواهی TLS با `certbot --nginx -d mashaqel.example.org` یا گواهی سازمانی نصب می‌شود.

## هویت سازمانی (SSO)

در `.env` مقادیر `MASHQEL_OIDC_*` را پر کنید (Issuer، Client ID/Secret، Redirect URI =
`https://<دامنه>/api/auth/sso/callback`، App URL = `https://<دامنه>/`) و برای نصب فقط-SSO
`MASHQEL_LOCAL_LOGIN=off` بگذارید. برای Keycloak/Entra/Google Workspace، کلاینت را از نوع
«محرمانه» با Standard Flow و همان Redirect URI ثبت کنید. جزئیات در `server/README.md`.

## چک‌لیست امنیتی پیش از بهره‌برداری

1. `MASHQEL_CORS_ORIGIN` را به دامنه واقعی پنل محدود کنید (نه `*`).
2. سرور را پشت TLS اجرا کنید؛ `HOST=127.0.0.1` وقتی Nginx روی همان میزبان است.
3. `server/data`/والیوم داده را فقط برای کاربر سرویس قابل نوشتن کنید و پشتیبان شبانه بگیرید.
4. حساب مدیر اولیه را در اولین ورود بسازید و بلافاصله برای هر کارشناس حساب جدا با محدوده کارگاه تعریف کنید.
5. گزارش فعالیت سرور را دوره‌ای با `GET /api/audit/verify` بازبینی کنید (زنجیره هش).
6. `deploy/.env` هرگز در مخزن قرار نگیرد (در `.gitignore` پوشش داده شده است).
7. برای نصب سازمانی، ورود رمزی محلی را با `MASHQEL_LOCAL_LOGIN=off` ببندید و نقش‌ها را از IdP مدیریت کنید.

## ارتقا

```bash
git pull && docker compose up -d --build      # یا: rsync + systemctl restart mashaqel-api
```

پایگاه داده SQLite سازگار با نسخه‌های قبلی است (جدول‌ها با `CREATE TABLE IF NOT EXISTS` ساخته می‌شوند).
پیش از ارتقا یک نسخه پشتیبان بگیرید. مهاجرت به PostgreSQL در فاز ۱۳ نقشه راه است.

## بررسی خودکار

```bash
npm run check:deploy   # ۴۴ بررسی هم‌خوانی پورت/مسیر/سخت‌سازی فایل‌های استقرار
```
