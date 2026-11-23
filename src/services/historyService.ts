/** ثبت تاریخچه کامل ممیزی محاسبات (calculation_history) برای ردیابی و بازتولید نتایج */

import { randomUUID } from 'node:crypto';
import type { Db } from '../db/query.ts';

export interface HistoryEntry {
  operationType: string;
  entityType: string;
  entityId?: number | null;
  formulaCode: string;
  formulaVersion: string;
  input: unknown;
  appliedTables: unknown;
  output: unknown;
  actor?: string;
}

export function recordHistory(db: Db, entry: HistoryEntry): string {
  const traceId = randomUUID();
  db.run(
    `INSERT INTO calculation_history (
       trace_id, operation_type, entity_type, entity_id, formula_code, formula_version,
       input_snapshot_json, applied_tables_json, output_snapshot_json, currency_unit, actor
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'IRR', ?)`,
    traceId,
    entry.operationType,
    entry.entityType,
    entry.entityId ?? null,
    entry.formulaCode,
    entry.formulaVersion,
    JSON.stringify(entry.input),
    JSON.stringify(entry.appliedTables),
    JSON.stringify(entry.output),
    entry.actor ?? 'SYSTEM',
  );
  return traceId;
}

export interface HistoryRow {
  id: number;
  trace_id: string;
  operation_type: string;
  entity_type: string;
  entity_id: number | null;
  formula_code: string;
  formula_version: string;
  input_snapshot_json: string;
  applied_tables_json: string;
  output_snapshot_json: string;
  currency_unit: string;
  actor: string;
  created_at: string;
}

export function listHistory(db: Db, entityType: string, entityId?: number): HistoryRow[] {
  if (entityId !== undefined) {
    return db.all<HistoryRow>(
      'SELECT * FROM calculation_history WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC',
      entityType,
      entityId,
    );
  }
  return db.all<HistoryRow>('SELECT * FROM calculation_history WHERE entity_type = ? ORDER BY id DESC', entityType);
}
