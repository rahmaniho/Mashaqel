/**
 * سرور مرکزی مشاغل — فاز ۱۱ (بدون هیچ وابستگی npm).
 *
 * مسئولیت‌ها:
 *  - احراز هویت سمت سرور با رمز هش‌شده PBKDF2-SHA256 و نشست توکنی ۸ ساعته
 *  - کنترل دسترسی نقش‌محور (مدیر سامانه / کارشناس طبقه‌بندی / کارشناس حقوق و دستمزد / بازدیدکننده)
 *  - گزارش فعالیت غیرقابل‌دستکاری با زنجیره هش (هر رویداد به هش رویداد قبلی گره خورده است)
 *  - پشتیبان‌گیری مرکزی نسخه‌دار
 *
 * اجرا: npm run serve:api   (پیش‌فرض: http://0.0.0.0:8787)
 * پایگاه داده: SQLite داخلی Node (node:sqlite) — مسیر با MASHQEL_DB قابل تغییر است.
 */

import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

export const SERVER_VERSION = '12.0.0';
export const ROLES = ['ADMIN', 'EXPERT', 'PAYROLL', 'VIEWER'];
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,20}$/;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z\u0600-\u06FF])(?=.*\d).{8,64}$/;

const SESSION_HOURS = 8;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const PBKDF2_ITERATIONS = 120_000;
const BODY_LIMIT = 512 * 1024;
const BACKUP_LIMIT = 8 * 1024 * 1024;
const AUTH_WINDOW_MS = 60_000;
const AUTH_WINDOW_MAX = 30;

/* ------------------------------ ابزارهای پایه ------------------------------ */

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const nowIso = () => new Date().toISOString();

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
  return { salt, hash, iterations: PBKDF2_ITERATIONS };
}

function verifyPassword(password, salt, expectedHash, iterations) {
  const actual = pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  const left = Buffer.from(actual, 'hex');
  const right = Buffer.from(expectedHash, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const bad = (message, code = 'BAD_REQUEST', status = 400) => new HttpError(status, code, message);

/* ------------------------------ پایگاه داده ------------------------------ */

export function openDatabase(dbPath) {
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      role TEXT NOT NULL,
      workshop_ids TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      iterations INTEGER NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      user_id TEXT,
      username TEXT,
      role TEXT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      workshop_id TEXT,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS state_docs (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS backups (
      version INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      created_by TEXT,
      payload TEXT NOT NULL
    );
  `);
  return db;
}

/* ------------------------------ گزارش فعالیت ------------------------------ */

const AUDIT_FIELDS = ['at', 'userId', 'username', 'role', 'module', 'action', 'detail', 'workshopId'];

export function auditCanonical(entry) {
  return JSON.stringify(AUDIT_FIELDS.map((field) => entry[field] ?? null));
}

export function auditAppend(db, entry) {
  const last = db.prepare('SELECT hash FROM audit ORDER BY seq DESC LIMIT 1').get();
  const prevHash = last?.hash ?? 'GENESIS';
  const record = {
    at: entry.at ?? nowIso(),
    userId: entry.userId ?? null,
    username: entry.username ?? null,
    role: entry.role ?? null,
    module: String(entry.module ?? 'security'),
    action: String(entry.action ?? 'UPDATE'),
    detail: String(entry.detail ?? ''),
    workshopId: entry.workshopId ?? null,
  };
  const hash = sha256(`${prevHash}|${auditCanonical(record)}`);
  db.prepare(
    `INSERT INTO audit (at, user_id, username, role, module, action, detail, workshop_id, prev_hash, hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.at,
    record.userId,
    record.username,
    record.role,
    record.module,
    record.action,
    record.detail,
    record.workshopId,
    prevHash,
    hash,
  );
  return { ...record, prevHash, hash };
}

export function verifyAuditChain(db) {
  const rows = db.prepare('SELECT * FROM audit ORDER BY seq ASC').all();
  let prev = 'GENESIS';
  for (const row of rows) {
    const canonical = auditCanonical({
      at: row.at,
      userId: row.user_id,
      username: row.username,
      role: row.role,
      module: row.module,
      action: row.action,
      detail: row.detail,
      workshopId: row.workshop_id,
    });
    const expected = sha256(`${prev}|${canonical}`);
    if (row.prev_hash !== prev || row.hash !== expected) {
      return { ok: false, count: rows.length, brokenAt: row.seq, expected, actual: row.hash };
    }
    prev = row.hash;
  }
  return { ok: true, count: rows.length, brokenAt: null, head: prev };
}

/* --------------------------- همگام‌سازی وضعیت (فاز ۱۲) --------------------------- */

const STATE_LIMIT = 4 * 1024 * 1024;

/** فیلتر کردن سند سازمانی بر اساس کارگاه‌های مجاز کاربر (محدوده خالی = همه). */
export function scopeState(doc, scopeIds) {
  if (!doc) return null;
  const scope = Array.isArray(scopeIds) ? scopeIds : [];
  if (scope.length === 0) return doc;
  const inScope = (row) => row && scope.includes(row.workshopId ?? row.id);
  const workshops = (doc.workshops ?? []).filter((row) => scope.includes(row.id));
  const activeWorkshopId = scope.includes(doc.activeWorkshopId) ? doc.activeWorkshopId : workshops[0]?.id ?? null;
  return {
    ...doc,
    workshops,
    units: (doc.units ?? []).filter(inScope),
    jobs: (doc.jobs ?? []).filter(inScope),
    employees: (doc.employees ?? []).filter(inScope),
    activeWorkshopId,
  };
}

/**
 * ادغام ارسال کاربر محدود به کارگاه: فقط کارگاه‌های مجاز جایگزین می‌شوند و
 * بقیه کارگاه‌های سند سرور دست‌نخورده می‌مانند. برای مدیر (محدوده خالی) جایگزینی کامل است.
 */
export function mergeScoped(existing, incoming, scopeIds) {
  const scope = Array.isArray(scopeIds) ? scopeIds : [];
  if (scope.length === 0 || !existing) return incoming;
  const outside = (row) => row && row.workshopId && !scope.includes(row.workshopId);
  const inside = (row) => row && scope.includes(row.workshopId);
  const workshops = [
    ...(existing.workshops ?? []).filter((row) => !scope.includes(row.id)),
    ...(incoming.workshops ?? []).filter((row) => scope.includes(row.id)),
  ];
  return {
    ...incoming,
    workshops,
    units: [...(existing.units ?? []).filter(outside), ...(incoming.units ?? []).filter(inside)],
    jobs: [...(existing.jobs ?? []).filter(outside), ...(incoming.jobs ?? []).filter(inside)],
    employees: [...(existing.employees ?? []).filter(outside), ...(incoming.employees ?? []).filter(inside)],
    activeWorkshopId: scope.includes(incoming.activeWorkshopId)
      ? incoming.activeWorkshopId
      : existing.activeWorkshopId ?? null,
  };
}

/* -------------------------------- کاربران -------------------------------- */

function publicUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    role: row.role,
    workshopIds: JSON.parse(row.workshop_ids ?? '[]'),
    active: row.active === 1,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    lockedUntil: row.locked_until,
  };
}

function validateUserFields(input, { requirePassword }) {
  const fullName = String(input.fullName ?? '').trim();
  const username = String(input.username ?? '').trim();
  const role = String(input.role ?? 'EXPERT').trim().toUpperCase();
  const password = String(input.password ?? '');
  if (fullName.length < 2 || fullName.length > 80) throw bad('نام و نام خانوادگی باید بین ۲ تا ۸۰ نویسه باشد.');
  if (!USERNAME_PATTERN.test(username)) {
    throw bad('نام کاربری باید ۳ تا ۲۰ نویسه لاتین، رقم، نقطه، خط تیره یا زیرخط باشد.');
  }
  if (!ROLES.includes(role)) throw bad('نقش انتخاب‌شده معتبر نیست.');
  if (requirePassword && !PASSWORD_PATTERN.test(password)) {
    throw bad('رمز عبور حداقل ۸ نویسه و شامل حرف و رقم باشد.');
  }
  if (!requirePassword && password && !PASSWORD_PATTERN.test(password)) {
    throw bad('رمز جدید حداقل ۸ نویسه و شامل حرف و رقم باشد.');
  }
  const workshopIds = Array.isArray(input.workshopIds) ? input.workshopIds.map(String).slice(0, 50) : [];
  return { fullName, username, role, password, workshopIds };
}

function countActiveAdmins(db) {
  return db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN' AND active = 1").get().total;
}

/* --------------------------------- سرور --------------------------------- */

export function createApp({ dbPath = process.env.MASHQEL_DB ?? ':memory:', corsOrigin = process.env.MASHQEL_CORS_ORIGIN ?? '*' } = {}) {
  const db = openDatabase(dbPath);
  const authHits = new Map();

  function rateLimit(key) {
    const now = Date.now();
    const bucket = authHits.get(key);
    if (!bucket || bucket.resetAt < now) {
      authHits.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
      return;
    }
    bucket.count += 1;
    if (bucket.count > AUTH_WINDOW_MAX) throw bad('تلاش‌های ورود بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.', 'RATE_LIMITED', 429);
  }

  function sessionUser(request) {
    const header = String(request.headers.authorization ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw bad('برای این عملیات باید وارد شوید.', 'UNAUTHENTICATED', 401);
    const row = db
      .prepare('SELECT * FROM sessions WHERE token_hash = ?')
      .get(sha256(token));
    if (!row) throw bad('نشست معتبر نیست؛ دوباره وارد شوید.', 'UNAUTHENTICATED', 401);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
      throw bad('نشست منقضی شده است؛ دوباره وارد شوید.', 'SESSION_EXPIRED', 401);
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
    if (!user || user.active !== 1) throw bad('این حساب غیرفعال است.', 'ACCOUNT_DISABLED', 403);
    return { user, tokenHash: row.token_hash };
  }

  function requireAdmin(ctx) {
    if (ctx.user.role !== 'ADMIN') throw bad('این عملیات فقط برای مدیر سامانه مجاز است.', 'FORBIDDEN', 403);
  }

  function record(ctx, module, action, detail, workshopId = null) {
    return auditAppend(db, {
      userId: ctx?.user?.id ?? null,
      username: ctx?.user?.username ?? null,
      role: ctx?.user?.role ?? null,
      module,
      action,
      detail,
      workshopId,
    });
  }

  function issueSession(user) {
    const token = randomBytes(32).toString('hex');
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
      sha256(token),
      user.id,
      createdAt,
      expiresAt,
    );
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(createdAt);
    return { token, expiresAt };
  }

  const routes = [];
  const route = (method, pattern, handler, { bodyLimit = BODY_LIMIT } = {}) => routes.push({ method, pattern, handler, bodyLimit });

  /* ------------------------------- عمومی ------------------------------- */

  route('GET', /^\/api\/health$/, () => ({
    ok: true,
    service: 'mashaqel-backend',
    version: SERVER_VERSION,
    time: nowIso(),
    users: db.prepare('SELECT COUNT(*) AS total FROM users').get().total,
    audit: db.prepare('SELECT COUNT(*) AS total FROM audit').get().total,
    stateVersion: db.prepare('SELECT version FROM state_docs WHERE id = 1').get()?.version ?? 0,
  }));

  route('GET', /^\/api\/auth\/status$/, () => {
    const users = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
    return { setupRequired: users === 0, users };
  });

  route('POST', /^\/api\/auth\/setup$/, (ctx) => {
    rateLimit(`setup:${ctx.ip}`);
    if (db.prepare('SELECT COUNT(*) AS total FROM users').get().total > 0) {
      throw bad('حساب مدیر قبلاً ساخته شده است.', 'SETUP_DONE', 409);
    }
    const fields = validateUserFields({ ...ctx.body, role: 'ADMIN' }, { requirePassword: true });
    const { salt, hash, iterations } = hashPassword(fields.password);
    const id = `user-${randomBytes(6).toString('hex')}`;
    db.prepare(
      `INSERT INTO users (id, full_name, username, role, workshop_ids, active, salt, hash, iterations, created_at)
       VALUES (?, ?, ?, 'ADMIN', '[]', 1, ?, ?, ?, ?)`,
    ).run(id, fields.fullName, fields.username, salt, hash, iterations, nowIso());
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    const session = issueSession(user);
    record(null, 'security', 'SETUP', `ساخت حساب مدیر سامانه: ${fields.username}`);
    return { ...session, user: publicUser(user) };
  });

  route('POST', /^\/api\/auth\/login$/, (ctx) => {
    rateLimit(`login:${ctx.ip}`);
    const username = String(ctx.body.username ?? '').trim();
    const password = String(ctx.body.password ?? '');
    const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
    if (!user) {
      record(null, 'security', 'DENIED', `تلاش ورود با نام کاربری ناشناس «${username}»`);
      throw bad('نام کاربری یا رمز عبور نادرست است.', 'BAD_CREDENTIALS', 401);
    }
    if (user.active !== 1) {
      record(null, 'security', 'DENIED', `تلاش ورود به حساب غیرفعال «${username}»`);
      throw bad('این حساب غیرفعال شده است.', 'ACCOUNT_DISABLED', 403);
    }
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      throw bad('حساب به دلیل تلاش‌های ناموفق موقتاً قفل شده است.', 'LOCKED', 423);
    }
    if (!verifyPassword(password, user.salt, user.hash, user.iterations)) {
      const failed = Number(user.failed_attempts ?? 0) + 1;
      const lockedUntil = failed >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
      db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(failed, lockedUntil, user.id);
      record(null, 'security', 'DENIED', `رمز نادرست برای «${username}» (تلاش ${failed})`);
      throw bad(
        lockedUntil ? 'رمز نادرست است؛ حساب موقتاً قفل شد.' : 'نام کاربری یا رمز عبور نادرست است.',
        lockedUntil ? 'LOCKED' : 'BAD_CREDENTIALS',
        lockedUntil ? 423 : 401,
      );
    }
    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?').run(nowIso(), user.id);
    const session = issueSession(user);
    const ctxUser = { user: { ...user, failed_attempts: 0, locked_until: null } };
    record(ctxUser, 'security', 'LOGIN', `ورود موفق ${user.full_name} (${user.role})`);
    return { ...session, user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) };
  });

  /* ------------------------------ نیازمند ورود ------------------------------ */

  route('GET', /^\/api\/auth\/me$/, (ctx) => {
    const { user } = sessionUser(ctx.request);
    return { user: publicUser(user) };
  });

  route('POST', /^\/api\/auth\/logout$/, (ctx) => {
    const { user, tokenHash } = sessionUser(ctx.request);
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    record({ user }, 'security', 'LOGOUT', `خروج ${user.full_name}`);
    return { ok: true };
  });

  route('GET', /^\/api\/users$/, (ctx) => {
    const { user } = sessionUser(ctx.request);
    requireAdmin({ user });
    return { users: db.prepare('SELECT * FROM users ORDER BY created_at ASC').all().map(publicUser) };
  });

  route('POST', /^\/api\/users$/, (ctx) => {
    const { user } = sessionUser(ctx.request);
    requireAdmin({ user });
    const fields = validateUserFields(ctx.body, { requirePassword: true });
    const exists = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(fields.username);
    if (exists) throw bad('این نام کاربری قبلاً ثبت شده است.', 'DUPLICATE_USERNAME', 409);
    const { salt, hash, iterations } = hashPassword(fields.password);
    const id = `user-${randomBytes(6).toString('hex')}`;
    db.prepare(
      `INSERT INTO users (id, full_name, username, role, workshop_ids, active, salt, hash, iterations, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, fields.fullName, fields.username, fields.role, JSON.stringify(fields.workshopIds), 1, salt, hash, iterations, nowIso());
    record({ user }, 'users', 'CREATE', `ایجاد کاربر «${fields.username}» با نقش ${fields.role}`);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) };
  });

  route('PATCH', /^\/api\/users\/([A-Za-z0-9-]+)$/, (ctx) => {
    const { user: actor } = sessionUser(ctx.request);
    requireAdmin({ user: actor });
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.params[0]);
    if (!target) throw bad('کاربر یافت نشد.', 'NOT_FOUND', 404);
    const fields = validateUserFields(
      {
        fullName: ctx.body.fullName ?? target.full_name,
        username: ctx.body.username ?? target.username,
        role: ctx.body.role ?? target.role,
        password: ctx.body.password ?? '',
        workshopIds: ctx.body.workshopIds ?? JSON.parse(target.workshop_ids ?? '[]'),
      },
      { requirePassword: false },
    );
    const duplicate = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id <> ?').get(fields.username, target.id);
    if (duplicate) throw bad('این نام کاربری قبلاً ثبت شده است.', 'DUPLICATE_USERNAME', 409);
    const active = ctx.body.active === undefined ? target.active === 1 : Boolean(ctx.body.active);
    if (target.role === 'ADMIN' && target.active === 1 && (fields.role !== 'ADMIN' || !active) && countActiveAdmins(db) <= 1) {
      throw bad('حداقل یک مدیر فعال باید باقی بماند.', 'LAST_ADMIN', 409);
    }
    let { salt, hash, iterations } = target;
    if (fields.password) ({ salt, hash, iterations } = hashPassword(fields.password));
    db.prepare(
      `UPDATE users SET full_name = ?, username = ?, role = ?, workshop_ids = ?, active = ?, salt = ?, hash = ?, iterations = ?
       WHERE id = ?`,
    ).run(
      fields.fullName,
      fields.username,
      fields.role,
      JSON.stringify(fields.workshopIds),
      active ? 1 : 0,
      salt,
      hash,
      iterations,
      target.id,
    );
    if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
    record({ user: actor }, 'users', 'UPDATE', `ویرایش کاربر «${fields.username}» (نقش ${fields.role}، ${active ? 'فعال' : 'غیرفعال'})`);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(target.id)) };
  });

  route('DELETE', /^\/api\/users\/([A-Za-z0-9-]+)$/, (ctx) => {
    const { user: actor } = sessionUser(ctx.request);
    requireAdmin({ user: actor });
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.params[0]);
    if (!target) throw bad('کاربر یافت نشد.', 'NOT_FOUND', 404);
    if (target.id === actor.id) throw bad('حذف حساب جاری مجاز نیست.', 'SELF_DELETE', 400);
    if (target.role === 'ADMIN' && target.active === 1 && countActiveAdmins(db) <= 1) {
      throw bad('حذف آخرین مدیر سامانه مجاز نیست.', 'LAST_ADMIN', 409);
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
    record({ user: actor }, 'users', 'DELETE', `حذف کاربر «${target.username}»`);
    return { ok: true };
  });

  route('GET', /^\/api\/activity$/, (ctx) => {
    const { user } = sessionUser(ctx.request);
    requireAdmin({ user });
    const search = (ctx.query.search ?? '').toLowerCase();
    const limit = Math.min(Math.max(Number(ctx.query.limit ?? 200), 1), 1000);
    const rows = db
      .prepare('SELECT * FROM audit ORDER BY seq DESC LIMIT ?')
      .all(limit)
      .map((row) => ({
        seq: row.seq,
        at: row.at,
        username: row.username,
        role: row.role,
        module: row.module,
        action: row.action,
        detail: row.detail,
        workshopId: row.workshop_id,
        prevHash: row.prev_hash,
        hash: row.hash,
      }))
      .filter((row) =>
        !search ? true : `${row.username} ${row.module} ${row.action} ${row.detail}`.toLowerCase().includes(search),
      );
    return { events: rows, total: db.prepare('SELECT COUNT(*) AS total FROM audit').get().total };
  });

  route('POST', /^\/api\/activity$/, (ctx) => {
    const { user } = sessionUser(ctx.request);
    const module = String(ctx.body.module ?? 'security').slice(0, 40);
    const action = String(ctx.body.action ?? 'UPDATE').slice(0, 40);
    const detail = String(ctx.body.detail ?? '').slice(0, 500);
    const workshopId = ctx.body.workshopId ? String(ctx.body.workshopId).slice(0, 80) : null;
    const entry = record({ user }, module, action, detail, workshopId);
    return { ok: true, seq: entry.seq ?? null, hash: entry.hash };
  });

  route('GET', /^\/api\/audit\/verify$/, (ctx) => {
    const { user } = sessionUser(ctx.request);
    requireAdmin({ user });
    return verifyAuditChain(db);
  });

  route('GET', /^\/api\/state$/, (ctx) => {
    const { user } = sessionUser(ctx.request);
    const row = db.prepare('SELECT * FROM state_docs WHERE id = 1').get();
    if (!row) return { state: null };
    const doc = JSON.parse(row.payload);
    const scope = JSON.parse(user.workshop_ids ?? '[]');
    return {
      state: {
        version: row.version,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
        scoped: scope.length > 0,
        payload: scopeState(doc, scope),
      },
    };
  });

  route(
    'PUT',
    /^\/api\/state$/,
    (ctx) => {
      const { user } = sessionUser(ctx.request);
      if (user.role === 'VIEWER') throw bad('نقش بازدیدکننده اجازه تغییر وضعیت سازمان را ندارد.', 'FORBIDDEN', 403);
      const payload = ctx.body.payload;
      if (!payload || typeof payload !== 'object' || !Array.isArray(payload.workshops)) {
        throw bad('ساختار وضعیت معتبر نیست (فیلد workshops الزامی است).');
      }
      const serialized = JSON.stringify(payload);
      if (serialized.length > STATE_LIMIT - 4096) throw bad('حجم وضعیت بیش از حد مجاز است.', 'TOO_LARGE', 413);
      const baseVersion = Number(ctx.body.baseVersion ?? 0);
      const current = db.prepare('SELECT * FROM state_docs WHERE id = 1').get();
      const currentVersion = current?.version ?? 0;
      if (baseVersion !== currentVersion) {
        throw new HttpError(409, 'STALE_VERSION', `نسخه سرور ${currentVersion} است و نسخه ارسالی ${baseVersion}؛ ابتدا دریافت کنید.`);
      }
      const scope = JSON.parse(user.workshop_ids ?? '[]');
      const merged = mergeScoped(current ? JSON.parse(current.payload) : null, payload, scope);
      const nextSerialized = JSON.stringify(merged);
      if (nextSerialized.length > STATE_LIMIT) throw bad('حجم وضعیت بیش از حد مجاز است.', 'TOO_LARGE', 413);
      const version = currentVersion + 1;
      const at = nowIso();
      db.prepare(
        `INSERT INTO state_docs (id, version, updated_at, updated_by, payload) VALUES (1, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at,
           updated_by = excluded.updated_by, payload = excluded.payload`,
      ).run(version, at, user.username, nextSerialized);
      record({ user }, 'settings', 'SYNC', `همگام‌سازی وضعیت سازمان — نسخه ${version} (${payload.workshops.length} کارگاه)`);
      return { ok: true, version, updatedAt: at, scoped: scope.length > 0 };
    },
    { bodyLimit: STATE_LIMIT },
  );

  route(
    'GET',
    /^\/api\/backup$/,
    (ctx) => {
      const { user } = sessionUser(ctx.request);
      requireAdmin({ user });
      const row = db.prepare('SELECT version, at, created_by, payload FROM backups ORDER BY version DESC LIMIT 1').get();
      const count = db.prepare('SELECT COUNT(*) AS total FROM backups').get().total;
      if (!row) return { backup: null, count };
      return { backup: { version: row.version, at: row.at, createdBy: row.created_by, snapshot: JSON.parse(row.payload) }, count };
    },
    { bodyLimit: BACKUP_LIMIT },
  );

  route(
    'PUT',
    /^\/api\/backup$/,
    (ctx) => {
      const { user } = sessionUser(ctx.request);
      requireAdmin({ user });
      const snapshot = ctx.body.snapshot;
      if (!snapshot || typeof snapshot !== 'object') throw bad('ساختار پشتیبان معتبر نیست.');
      const payload = JSON.stringify(snapshot);
      if (payload.length > BACKUP_LIMIT - 1024) throw bad('حجم پشتیبان بیش از حد مجاز است.', 'TOO_LARGE', 413);
      db.prepare('INSERT INTO backups (at, created_by, payload) VALUES (?, ?, ?)').run(nowIso(), user.username, payload);
      const version = db.prepare('SELECT MAX(version) AS version FROM backups').get().version;
      record({ user }, 'settings', 'BACKUP', `پشتیبان مرکزی نسخه ${version} (${Math.round(payload.length / 1024)} کیلوبایت)`);
      return { ok: true, version };
    },
    { bodyLimit: BACKUP_LIMIT },
  );

  /* -------------------------------- HTTP -------------------------------- */

  async function readBody(request, limit) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > limit) throw bad('حجم درخواست بیش از حد مجاز است.', 'TOO_LARGE', 413);
      chunks.push(chunk);
    }
    if (chunks.length === 0) return {};
    const raw = Buffer.concat(chunks).toString('utf8');
    try {
      const parsed = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
      return parsed;
    } catch {
      throw bad('بدنه درخواست JSON معتبر نیست.');
    }
  }

  function send(response, status, payload) {
    const body = JSON.stringify(payload);
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
    });
    response.end(body);
  }

  function applyCors(request, response) {
    const origin = request.headers.origin;
    const allowed = corsOrigin === '*' ? '*' : origin && origin !== corsOrigin ? origin : corsOrigin;
    response.setHeader('access-control-allow-origin', allowed);
    response.setHeader('vary', 'origin');
    response.setHeader('access-control-allow-methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    response.setHeader('access-control-allow-headers', 'authorization, content-type');
    response.setHeader('access-control-max-age', '600');
  }

  const server = createServer(async (request, response) => {
    applyCors(request, response);
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const match = routes
      .map((entry) => ({ entry, found: entry.method === request.method ? entry.pattern.exec(path) : null }))
      .find((candidate) => candidate.found);
    if (!match) {
      send(response, 404, { error: 'NOT_FOUND', message: 'این مسیر وجود ندارد.' });
      return;
    }
    try {
      const body = ['POST', 'PATCH', 'PUT'].includes(request.method ?? '') ? await readBody(request, match.entry.bodyLimit) : {};
      const ctx = {
        request,
        response,
        body,
        params: match.found.slice(1),
        query: Object.fromEntries(url.searchParams.entries()),
        ip: request.socket.remoteAddress ?? 'unknown',
      };
      const result = await match.entry.handler(ctx);
      send(response, 200, result ?? { ok: true });
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 401 || error.status === 403) {
          try {
            record(null, 'security', 'DENIED', `${error.message} — ${request.method} ${path}`);
          } catch {
            /* ثبت رویداد نباید خطا را بپوشاند */
          }
        }
        send(response, error.status, { error: error.code, message: error.message });
        return;
      }
      console.error('server error', error);
      send(response, 500, { error: 'INTERNAL', message: 'خطای داخلی سرور رخ داد.' });
    }
  });

  server.on('close', () => {
    try {
      db.close();
    } catch {
      /* already closed */
    }
  });

  return { server, db };
}

/* ------------------------------ اجرای مستقیم ------------------------------ */

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '0.0.0.0';
  const dbPath = process.env.MASHQEL_DB ?? resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'mashaqel.sqlite');
  const { server } = createApp({ dbPath });
  server.listen(port, host, () => {
    console.log(`سرور مرکزی مشاغل نسخه ${SERVER_VERSION} روی http://${host}:${port} آماده است.`);
    console.log(`پایگاه داده: ${dbPath}`);
  });
}
