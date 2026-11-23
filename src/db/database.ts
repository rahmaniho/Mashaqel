/** لایه اتصال دیتابیس: ایجاد، مهاجرت‌ها (migrations) و اجرای اسکیمای ۱۷ جدولی */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..', '..');
const schemaPath = join(projectRoot, 'sql', 'schema.sql');

export interface Migration {
  version: string;
  description: string;
  up: (db: DatabaseSync) => void;
}

/** فهرست مهاجرت‌های نسخه‌بندی‌شده دیتابیس */
export const MIGRATIONS: Migration[] = [
  {
    version: '001_initial_schema',
    description: 'ایجاد ۱۷ جدول مستقل سامانه طبقه‌بندی مشاغل و محاسبات مزد',
    up: (db) => {
      if (!existsSync(schemaPath)) {
        throw new Error(`فایل اسکیمای دیتابیس یافت نشد: ${schemaPath}`);
      }
      db.exec(readFileSync(schemaPath, 'utf8'));
    },
  },
  {
    version: '002_add_history_indexes',
    description: 'ایندکس‌های تکمیلی جستجوی چندتاریخی و نسخه‌بندی',
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_eval_scores_dates
          ON evaluation_scores (level_id, effective_from, effective_to);
        CREATE INDEX IF NOT EXISTS idx_employee_lookup
          ON employee_records (workshop_code, employee_code, effective_date);
        CREATE INDEX IF NOT EXISTS idx_wage_calc_period
          ON wage_calculations (employee_id, fiscal_year, period_year_month);
      `);
    },
  },
];

export function createDatabase(fileName = ':memory:'): DatabaseSync {
  if (fileName !== ':memory:') {
    const dir = dirname(fileName);
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(fileName);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = MEMORY');
  return db;
}

export function applyMigrations(db: DatabaseSync): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: string }>).map((r) => r.version),
  );
  const newlyApplied: string[] = [];
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    db.exec('BEGIN');
    try {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)').run(
        migration.version,
        migration.description,
      );
      db.exec('COMMIT');
      newlyApplied.push(migration.version);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return newlyApplied;
}
