/** کمک‌کننده‌های اجرای پرس‌وجو روی node:sqlite */

import type { DatabaseSync, StatementSync } from 'node:sqlite';

export type SqlParam = string | number | null | bigint | Uint8Array;

export class Db {
  readonly raw: DatabaseSync;

  constructor(raw: DatabaseSync) {
    this.raw = raw;
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  run(sql: string, ...params: SqlParam[]): { changes: number; lastInsertRowid: number } {
    const stmt: StatementSync = this.raw.prepare(sql);
    const result = stmt.run(...params);
    return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
  }

  get<T>(sql: string, ...params: SqlParam[]): T | undefined {
    const stmt = this.raw.prepare(sql);
    const row = stmt.get(...params) as T | undefined;
    return row;
  }

  all<T>(sql: string, ...params: SqlParam[]): T[] {
    const stmt = this.raw.prepare(sql);
    return stmt.all(...params) as T[];
  }

  private transactionDepth = 0;

  /** تراکنش با پشتیبانی از تودرتویی (SAVEPOINT) */
  transaction<T>(fn: () => T): T {
    const depth = this.transactionDepth;
    const savepoint = `sp_${depth}`;
    this.exec(depth === 0 ? 'BEGIN' : `SAVEPOINT ${savepoint}`);
    this.transactionDepth += 1;
    try {
      const result = fn();
      this.transactionDepth -= 1;
      this.exec(depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      this.transactionDepth -= 1;
      this.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}`);
      throw error;
    }
  }
}
