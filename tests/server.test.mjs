/**
 * آزمون سرور مرکزی (فاز ۱۱) — node:test + HTTP واقعی روی پورت موقت.
 * اجرا: npm run test:server
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createApp, verifyAuditChain, SERVER_VERSION } from '../server/server.mjs';

let app;
let base;

async function call(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  return { status: response.status, body: payload, headers: response.headers };
}

const admin = { fullName: 'مدیر آزمون', username: 'admin.test', password: 'Admin@1405' };

before(async () => {
  app = createApp({ dbPath: ':memory:', corsOrigin: '*' });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => app.server.close(resolve));
});

describe('سرور مرکزی — سلامت و راه‌اندازی', () => {
  it('سلامت سرویس و نسخه', async () => {
    const res = await call('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.version, SERVER_VERSION);
    assert.equal(res.body.users, 0);
  });

  it('وضعیت اولیه نیازمند راه‌اندازی است', async () => {
    const res = await call('/api/auth/status');
    assert.equal(res.body.setupRequired, true);
  });

  it('رمز ضعیف در راه‌اندازی رد می‌شود', async () => {
    const res = await call('/api/auth/setup', { method: 'POST', body: { ...admin, password: '123' } });
    assert.equal(res.status, 400);
  });

  it('راه‌اندازی حساب مدیر و صدور توکن', async () => {
    const res = await call('/api/auth/setup', { method: 'POST', body: admin });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'ADMIN');
    assert.equal(res.body.user.username, 'admin.test');
    assert.ok(res.body.token.length >= 64);
    assert.equal(res.body.user.password, undefined);
  });

  it('راه‌اندازی دوباره مسدود است', async () => {
    const res = await call('/api/auth/setup', { method: 'POST', body: admin });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'SETUP_DONE');
  });
});

describe('سرور مرکزی — احراز هویت و نشست', () => {
  it('ورود موفق و /auth/me', async () => {
    const login = await call('/api/auth/login', { method: 'POST', body: { username: 'admin.test', password: admin.password } });
    assert.equal(login.status, 200);
    const me = await call('/api/auth/me', { token: login.body.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.fullName, admin.fullName);
  });

  it('ورود با رمز نادرست رد می‌شود', async () => {
    const res = await call('/api/auth/login', { method: 'POST', body: { username: 'admin.test', password: 'Wrong1234' } });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'BAD_CREDENTIALS');
  });

  it('نشست نامعتبر رد می‌شود', async () => {
    const res = await call('/api/auth/me', { token: 'a'.repeat(64) });
    assert.equal(res.status, 401);
  });

  it('خروج نشست را باطل می‌کند', async () => {
    const login = await call('/api/auth/login', { method: 'POST', body: { username: 'admin.test', password: admin.password } });
    const token = login.body.token;
    const out = await call('/api/auth/logout', { method: 'POST', token });
    assert.equal(out.status, 200);
    const me = await call('/api/auth/me', { token });
    assert.equal(me.status, 401);
  });

  it('قفل حساب پس از ۵ تلاش ناموفق', async () => {
    const created = await call('/api/users', {
      method: 'POST',
      body: { fullName: 'کاربر قفل', username: 'locked.user', role: 'VIEWER', password: 'Locked@1405' },
      token: (await call('/api/auth/login', { method: 'POST', body: { username: 'admin.test', password: admin.password } })).body.token,
    });
    assert.equal(created.status, 200);
    let last = null;
    for (let index = 0; index < 5; index += 1) {
      last = await call('/api/auth/login', { method: 'POST', body: { username: 'locked.user', password: 'Wrong1234' } });
    }
    assert.equal(last.status, 423);
    assert.equal(last.body.error, 'LOCKED');
  });
});

describe('سرور مرکزی — نقش‌ها و کنترل دسترسی', () => {
  let adminToken;
  let expertToken;

  it('مدیر فقط می‌تواند کاربر بسازد', async () => {
    adminToken = (await call('/api/auth/login', { method: 'POST', body: { username: 'admin.test', password: admin.password } })).body.token;
    const expert = await call('/api/users', {
      method: 'POST',
      body: { fullName: 'کارشناس آزمون', username: 'expert.test', role: 'EXPERT', password: 'Expert@1405', workshopIds: ['workshop-1'] },
      token: adminToken,
    });
    assert.equal(expert.status, 200);
    assert.deepEqual(expert.body.user.workshopIds, ['workshop-1']);
    expertToken = (await call('/api/auth/login', { method: 'POST', body: { username: 'expert.test', password: 'Expert@1405' } })).body.token;
    assert.ok(expertToken);
  });

  it('کارشناس به فهرست کاربران دسترسی ندارد', async () => {
    const res = await call('/api/users', { token: expertToken });
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'FORBIDDEN');
  });

  it('کارشناس می‌تواند رویداد فعالیت ثبت کند', async () => {
    const res = await call('/api/activity', {
      method: 'POST',
      token: expertToken,
      body: { module: 'jobs', action: 'CREATE', detail: 'ایجاد شغل آزمون' },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.hash);
  });

  it('کارشناس به گزارش فعالیت کامل و بازبینی زنجیره دسترسی ندارد', async () => {
    assert.equal((await call('/api/activity', { token: expertToken })).status, 403);
    assert.equal((await call('/api/audit/verify', { token: expertToken })).status, 403);
  });

  it('مدیر گزارش فعالیت را با جزئیات می‌بیند', async () => {
    const res = await call('/api/activity?limit=50', { token: adminToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.total > 0);
    assert.ok(res.body.events.some((event) => event.action === 'CREATE'));
    assert.ok(res.body.events.every((event) => event.hash && event.prevHash));
  });
});

describe('سرور مرکزی — محافظت‌های مدیریت کاربران', () => {
  let adminToken;

  before(async () => {
    adminToken = (await call('/api/auth/login', { method: 'POST', body: { username: 'admin.test', password: admin.password } })).body.token;
  });

  it('آخرین مدیر را نمی‌توان تنزل داد', async () => {
    const users = await call('/api/users', { token: adminToken });
    const self = users.body.users.find((user) => user.username === 'admin.test');
    const res = await call(`/api/users/${self.id}`, { method: 'PATCH', token: adminToken, body: { role: 'VIEWER' } });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'LAST_ADMIN');
  });

  it('حذف حساب جاری مسدود است', async () => {
    const users = await call('/api/users', { token: adminToken });
    const self = users.body.users.find((user) => user.username === 'admin.test');
    const res = await call(`/api/users/${self.id}`, { method: 'DELETE', token: adminToken });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'SELF_DELETE');
  });

  it('نام کاربری تکراری رد می‌شود', async () => {
    const res = await call('/api/users', {
      method: 'POST',
      token: adminToken,
      body: { fullName: 'تکراری', username: 'EXPERT.TEST', role: 'VIEWER', password: 'Pass@1405' },
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'DUPLICATE_USERNAME');
  });

  it('غیرفعال‌سازی کاربر، نشست‌هایش را باطل می‌کند', async () => {
    const token = (await call('/api/auth/login', { method: 'POST', body: { username: 'expert.test', password: 'Expert@1405' } })).body.token;
    const users = await call('/api/users', { token: adminToken });
    const expert = users.body.users.find((user) => user.username === 'expert.test');
    const patch = await call(`/api/users/${expert.id}`, { method: 'PATCH', token: adminToken, body: { active: false } });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.user.active, false);
    const me = await call('/api/auth/me', { token });
    assert.equal(me.status, 401);
  });
});


describe('سرور مرکزی — همگام‌سازی چنددستگاهی (فاز ۱۲)', () => {
  let adminToken;
  let expertToken;
  let viewerToken;

  before(async () => {
    adminToken = (await call('/api/auth/login', { method: 'POST', body: { username: 'admin.test', password: admin.password } })).body.token;
    const users = await call('/api/users', { token: adminToken });
    if (!users.body.users.some((user) => user.username === 'sync.expert')) {
      await call('/api/users', {
        method: 'POST',
        token: adminToken,
        body: { fullName: 'همگام‌ساز', username: 'sync.expert', role: 'EXPERT', password: 'Sync@1405', workshopIds: ['workshop-1'] },
      });
    }
    if (!users.body.users.some((user) => user.username === 'sync.viewer')) {
      await call('/api/users', {
        method: 'POST',
        token: adminToken,
        body: { fullName: 'ناظر', username: 'sync.viewer', role: 'VIEWER', password: 'Viewer@1405' },
      });
    }
    expertToken = (await call('/api/auth/login', { method: 'POST', body: { username: 'sync.expert', password: 'Sync@1405' } })).body.token;
    viewerToken = (await call('/api/auth/login', { method: 'POST', body: { username: 'sync.viewer', password: 'Viewer@1405' } })).body.token;
  });

  const orgState = {
    workshops: [
      { id: 'workshop-1', workshopName: 'کارگاه یک' },
      { id: 'workshop-2', workshopName: 'کارگاه دو' },
    ],
    activeWorkshopId: 'workshop-1',
    units: [{ id: 'unit-1', workshopId: 'workshop-1', title: 'واحد یک' }],
    jobs: [{ id: 'job-1', workshopId: 'workshop-1', jobCode: 'J-1' }],
    employees: [{ id: 'emp-1', workshopId: 'workshop-1', personnelCode: 'E-1' }],
  };

  it('در ابتدا وضعیت سازمانی روی سرور نیست', async () => {
    const res = await call('/api/state', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.state, null);
  });

  it('مدیر وضعیت سازمان را با نسخه ۱ ارسال می‌کند', async () => {
    const res = await call('/api/state', { method: 'PUT', token: adminToken, body: { baseVersion: 0, payload: orgState } });
    assert.equal(res.status, 200);
    assert.equal(res.body.version, 1);
    const get = await call('/api/state', { token: adminToken });
    assert.equal(get.body.state.version, 1);
    assert.equal(get.body.state.scoped, false);
    assert.equal(get.body.state.payload.workshops.length, 2);
  });

  it('ارسال با نسخه قدیمی رد می‌شود (تعارض همگام‌سازی)', async () => {
    const res = await call('/api/state', { method: 'PUT', token: adminToken, body: { baseVersion: 0, payload: orgState } });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'STALE_VERSION');
  });

  it('ساختار نامعتبر رد می‌شود', async () => {
    const res = await call('/api/state', { method: 'PUT', token: adminToken, body: { baseVersion: 1, payload: { jobs: [] } } });
    assert.equal(res.status, 400);
  });

  it('کاربر محدود فقط کارگاه‌های مجاز را دریافت می‌کند', async () => {
    const res = await call('/api/state', { token: expertToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.state.scoped, true);
    assert.deepEqual(res.body.state.payload.workshops.map((workshop) => workshop.id), ['workshop-1']);
    assert.equal(res.body.state.payload.units.length, 1);
    assert.equal(res.body.state.payload.jobs.length, 1);
  });

  it('ارسال کاربر محدود فقط کارگاه خودش را به‌روز می‌کند', async () => {
    const scopedPayload = {
      workshops: [
        { id: 'workshop-1', workshopName: 'کارگاه یک — ویرایش‌شده' },
        { id: 'workshop-2', workshopName: 'تلاش برای تغییر غیرمجاز' },
      ],
      activeWorkshopId: 'workshop-1',
      units: [],
      jobs: [{ id: 'job-1', workshopId: 'workshop-1', jobCode: 'J-1-EDIT' }],
      employees: [],
    };
    const res = await call('/api/state', { method: 'PUT', token: expertToken, body: { baseVersion: 1, payload: scopedPayload } });
    assert.equal(res.status, 200);
    assert.equal(res.body.version, 2);
    assert.equal(res.body.scoped, true);
    const adminView = await call('/api/state', { token: adminToken });
    const doc = adminView.body.state.payload;
    assert.equal(doc.workshops.find((workshop) => workshop.id === 'workshop-1').workshopName, 'کارگاه یک — ویرایش‌شده');
    assert.equal(doc.workshops.find((workshop) => workshop.id === 'workshop-2').workshopName, 'کارگاه دو');
    assert.equal(doc.jobs.length, 1);
    assert.equal(doc.jobs[0].jobCode, 'J-1-EDIT');
    assert.equal(doc.units.length, 0);
  });

  it('بازدیدکننده دریافت می‌کند اما ارسال نمی‌تواند', async () => {
    const get = await call('/api/state', { token: viewerToken });
    assert.equal(get.status, 200);
    const put = await call('/api/state', { method: 'PUT', token: viewerToken, body: { baseVersion: 2, payload: orgState } });
    assert.equal(put.status, 403);
    assert.equal(put.body.error, 'FORBIDDEN');
  });

  it('نسخه وضعیت در سلامت سرویس دیده می‌شود', async () => {
    const res = await call('/api/health');
    assert.equal(res.body.stateVersion, 2);
  });
});

describe('سرور مرکزی — زنجیره گزارش فعالیت', () => {
  let adminToken;

  before(async () => {
    adminToken = (await call('/api/auth/login', { method: 'POST', body: { username: 'admin.test', password: admin.password } })).body.token;
  });

  it('زنجیره هش سالم است', async () => {
    const res = await call('/api/audit/verify', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.count > 0);
    assert.equal(verifyAuditChain(app.db).ok, true);
  });

  it('دستکاری مستقیم رکورد، زنجیره را می‌شکند', async () => {
    app.db.prepare('UPDATE audit SET detail = ? WHERE seq = 2').run('دستکاری‌شده');
    const res = await call('/api/audit/verify', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.brokenAt, 2);
  });
});

describe('سرور مرکزی — پشتیبان‌گیری مرکزی و CORS', () => {
  let adminToken;

  before(async () => {
    adminToken = (await call('/api/auth/login', { method: 'POST', body: { username: 'admin.test', password: admin.password } })).body.token;
  });

  it('در ابتدا پشتیبانی ثبت نشده است', async () => {
    const res = await call('/api/backup', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.backup, null);
  });

  it('ثبت و بازیابی پشتیبان نسخه‌دار', async () => {
    const snapshot = { workshops: [{ id: 'workshop-1', workshopName: 'کارگاه آزمون' }], jobs: [], employees: [], activityLog: [] };
    const put = await call('/api/backup', { method: 'PUT', token: adminToken, body: { snapshot } });
    assert.equal(put.status, 200);
    assert.equal(put.body.version, 1);
    const get = await call('/api/backup', { token: adminToken });
    assert.equal(get.body.backup.version, 1);
    assert.equal(get.body.backup.snapshot.workshops[0].workshopName, 'کارگاه آزمون');
  });

  it('پشتیبان‌گیری برای نقش غیرمدیر مسدود است', async () => {
    const viewerToken = (await call('/api/auth/login', { method: 'POST', body: { username: 'locked.user', password: 'Locked@1405' } })).body.token;
    if (!viewerToken) return; // حساب قفل‌شده در آزمون قبلی
    const res = await call('/api/backup', { token: viewerToken });
    assert.equal(res.status, 403);
  });

  it('پاسخ CORS و preflight', async () => {
    const preflight = await fetch(`${base}/api/users`, { method: 'OPTIONS', headers: { origin: 'https://example.test' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
    const health = await call('/api/health');
    assert.ok(health.headers.get('access-control-allow-methods').includes('PATCH'));
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  });

  it('ورودی نامعتبر JSON رد می‌شود', async () => {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    assert.equal(response.status, 400);
  });
});
