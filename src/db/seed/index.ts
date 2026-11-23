/** اجرای همه بذرهای رسمی به‌صورت idempotent */

import type { Db } from '../query.ts';
import { seedLegalDocuments } from './legalDocuments.ts';
import { seedFormulaVersions } from './formulaVersions.ts';
import { seedEvaluationSystemB } from './evaluationSystemB.ts';
import { seedEvaluationSystemA } from './evaluationSystemA.ts';
import { seedGroupScoreRanges } from './groupScoreRanges.ts';
import { seedWageTables, seedSeniorityTables } from './wageAndSeniority.ts';
import { seedAnnualParameters } from './annualParameters.ts';

export function seedAll(db: Db): void {
  db.transaction(() => {
    seedLegalDocuments(db);
    seedFormulaVersions(db);
    seedEvaluationSystemB(db);
    seedEvaluationSystemA(db);
    seedGroupScoreRanges(db);
    seedWageTables(db);
    seedSeniorityTables(db);
    seedAnnualParameters(db);
  });
}
