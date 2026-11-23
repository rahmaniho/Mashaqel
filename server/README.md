# سرور مرکزی مشاغل — فاز ۱۱

سرویس Node.js **بدون هیچ وابستگی npm** برای احراز هویت سمت سرور، کنترل دسترسی نقش‌محور،
گزارش فعالیت زنجیره‌هش‌شده و پشتیبان‌گیری مرکزی. ذخیره‌سازی پیش‌فرض: SQLite داخلی Node (`node:sqlite`).

## اجرا

```bash
npm run serve:api     # http://0.0.0.0:8787
npm run serve:web     # http://localhost:4173 + پراکسی /api → 8787
```

پایگاه داده پیش‌فرض در `server/data/mashaqel.sqlite` ساخته می‌شود (در `.gitignore` است).

## متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
| :--- | :--- | :--- |
| `PORT` | `8787` | پورت سرویس |
| `HOST` | `0.0.0.0` | نشانی اتصال (در استقرار پشت پراکسی معکوس بهتر است `127.0.0.1`) |
| `MASHQEL_DB` | `server/data/mashaqel.sqlite` | مسیر فایل SQLite (یا `:memory:` در آزمون‌ها) |
| `MASHQEL_CORS_ORIGIN` | `*` | مبدأ مجاز مرورگر؛ در استقرار واقعی دامنه پنل را بگذارید |
| `MASHQEL_API` | `http://127.0.0.1:8787` | مقصد پراکسی در `serve:web` |
| `MASHQEL_OIDC_ISSUER` | — | نشانی Issuer سرویس هویت (بدون اسلش پایانی)؛ خالی = SSO غیرفعال |
| `MASHQEL_OIDC_CLIENT_ID` | — | شناسه کلاینت OIDC |
| `MASHQEL_OIDC_CLIENT_SECRET` | — | رمز کلاینت (برای کلاینت‌های محرمانه) |
| `MASHQEL_OIDC_REDIRECT_URI` | — | نشانی بازگشت: `https://<دامنه>/api/auth/sso/callback` |
| `MASHQEL_OIDC_APP_URL` | `http://localhost/` | نشانی پوسته وب برای تحویل کد ورود |
| `MASHQEL_OIDC_SCOPE` | `openid email profile` | دامنه درخواستی |
| `MASHQEL_OIDC_DEFAULT_ROLE` | `VIEWER` | نقش پیش‌فرض کاربران SSO |
| `MASHQEL_OIDC_ADMIN_EMAILS` | — | ایمیل‌های مدیر سازمانی (با کاما) که نقش ADMIN می‌گیرند |
| `MASHQEL_OIDC_LABEL` | `ورود با حساب سازمانی` | برچسب دکمه ورود |
| `MASHQEL_LOCAL_LOGIN` | `on` | `off` = فقط ورود سازمانی |

## API

| روش | مسیر | دسترسی | کار |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | عمومی | سلامت، نسخه، تعداد کاربران و رویدادها |
| `GET` | `/api/auth/status` | عمومی | آیا راه‌اندازی اولیه لازم است |
| `POST` | `/api/auth/setup` | عمومی (فقط یک‌بار) | ساخت حساب مدیر سامانه |
| `POST` | `/api/auth/login` | عمومی | ورود و صدور توکن نشست ۸ ساعته |
| `POST` | `/api/auth/logout` | ورود | باطل‌کردن نشست جاری |
| `GET` | `/api/auth/me` | ورود | کاربر جاری |
| `GET/POST` | `/api/users` | مدیر | فهرست و ایجاد کاربر |
| `PATCH/DELETE` | `/api/users/:id` | مدیر | ویرایش، غیرفعال‌سازی، حذف |
| `GET` | `/api/activity` | مدیر | گزارش فعالیت سرور (جستجو و سقف) |
| `POST` | `/api/activity` | ورود | ثبت رویداد از پوسته وب |
| `GET` | `/api/audit/verify` | مدیر | بازبینی زنجیره هش و یافتن اولین شکست |
| `GET/PUT` | `/api/backup` | مدیر | آخرین پشتیبان / ثبت پشتیبان جدید |
| `GET` | `/api/state` | ورود | وضعیت سازمان (محدود به کارگاه‌های مجاز) |
| `PUT` | `/api/state` | ورود (نه بازدیدکننده) | ارسال نسخه‌دار وضعیت با بررسی تعارض |
| `GET` | `/api/auth/sso/status` | عمومی | فعال‌بودن SSO، برچسب ارائه‌دهنده و وضعیت ورود محلی |
| `GET` | `/api/auth/sso/start` | عمومی | شروع جریان OIDC (state، nonce و PKCE) |
| `GET` | `/api/auth/sso/callback` | عمومی | تبادل کد با IdP، تأیید توکن و صدور کد یک‌بارمصرف |
| `POST` | `/api/auth/sso/exchange` | عمومی | تبدیل کد یک‌بارمصرف به توکن نشست |

## امنیت پیاده‌شده

- رمز عبور: PBKDF2-SHA256، نمک تصادفی ۱۶ بایتی، ۱۲۰٬۰۰۰ تکرار، مقایسه زمان‌ثابت؛ رمز خام ذخیره نمی‌شود.
- نشست: توکن تصادفی ۳۲ بایتی که فقط هش SHA-256 آن در پایگاه داده است؛ انقضا ۸ ساعت.
- قفل ورود: ۵ تلاش ناموفق → قفل ۵ دقیقه‌ای؛ محدودیت نرخ ۳۰ درخواست در دقیقه برای مسیرهای احراز هویت.
- نقش‌ها روی هر مسیر سمت سرور بررسی می‌شوند (نه در مرورگر)؛ حذف حساب جاری و حذف/تنزل آخرین مدیر مسدود است.
- گزارش فعالیت: هر رویداد `hash = SHA256(prevHash|canonical)` دارد؛ هر دستکاری مستقیم در پایگاه داده با
  `GET /api/audit/verify` آشکار می‌شود (`brokenAt`).
- هدرهای امنیتی پاسخ، محدودیت حجم بدنه (۵۱۲ کیلوبایت؛ پشتیبان تا ۸ مگابایت) و CORS قابل تنظیم.

## هویت سازمانی (SSO/OIDC)

- جریان: `sso/start` (state + nonce + `code_challenge` S256) → IdP → `sso/callback` (تبادل کد، تأیید امضای
  RS256 با JWKS، بررسی `iss`/`aud`/`exp`/`nonce`) → کد یک‌بارمصرف ۲ دقیقه‌ای → `sso/exchange` → نشست ۸ ساعته.
- ساخت خودکار کاربر (JIT) با نام کاربری مشتق از ایمیل و یکتاسازی خودکار؛ نگاشت هویت با `sub` سرویس هویت.
- `email_verified: false` رد می‌شود؛ نقش `ADMIN` فقط برای ایمیل‌های `MASHQEL_OIDC_ADMIN_EMAILS`.
- آزمون: `npm run test:sso` با IdP شبیه‌سازی‌شده (شامل امضای دستکاری‌شده، state تکراری، کد منقضی و حالت فقط-SSO).

نمونه پیکربندی Keycloak: کلاینت `confidential` با `Standard Flow` و Redirect URI
`https://mashaqel.example.org/api/auth/sso/callback`؛ در Azure AD/Entra، App Registration با
`Web` redirect و scopeهای `openid email profile`.

## آمادگی PostgreSQL (فاز ۱۴)

لایه داده فعلی SQLite داخلی Node است. برای مهاجرت به PostgreSQL باید:
۱) لایه ذخیره‌سازی به آداپتور async تبدیل شود (کلاینت `pg` async است و مسیرهای فعلی همگام‌اند)،
۲) DDL معادل (`state_docs`، `audit` با زنجیره هش، `sessions`، `sso_*`) و مهاجرت داده نوشته شود،
۳) آزمون یکپارچه روی نمونه واقعی PostgreSQL اجرا شود.
هیچ‌کدام از این سه در محیط توسعه فعلی (بدون PostgreSQL/Docker) قابل **آزمون** نبود؛ طبق قاعده پروژه،
قابلیت آزمون‌نشده منتشر نمی‌شود. این مورد به فاز ۱۴ منتقل شده است.

## استقرار سازمانی (پیشنهادی)

```nginx
server {
  listen 443 ssl http2;
  server_name mashaqel.example.org;
  ssl_certificate     /etc/ssl/fullchain.pem;
  ssl_certificate_key /etc/ssl/privkey.pem;

  root /srv/mashaqel/web;           # فایل‌های استاتیک
  location / { try_files $uri $uri/ /index.html; }

  location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

- سرویس را با `systemd` یا `pm2` اجرا و `MASHQEL_CORS_ORIGIN=https://mashaqel.example.org` را تنظیم کنید.
- فایل `server/data/mashaqel.sqlite` را شبانه پشتیبان بگیرید (خود `/api/backup` هم نسخه‌های داده را نگه می‌دارد).
- برای چندکاربره سنگین یا HA، لایه ذخیره‌سازی را به PostgreSQL منتقل کنید (فاز ۱۲ نقشه راه).

## آزمون

```bash
npm run test:server      # ۲۶ بررسی سرور
npm run test:web-server  # ۲۰ بررسی یکپارچه پوسته وب با سرور واقعی
```
