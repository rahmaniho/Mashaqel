/**
 * آزمون تطبیق (parity) بین موتور اصلی (node:sqlite) و هسته محاسباتی مرورگر.
 * تضمین می‌کند وب‌اپ همان اعداد موتور و گزارش آزمون را تولید کند.
 * اجرا: npm run verify:web
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-ignore — ماژول مرورگری بدون تایپ است
import * as core from '../web/engine-core.js';
import { MashaqelEngine } from '../src/index.ts';
import type { EmployeeWageInput, PointBasedSelection } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const data = JSON.parse(readFileSync(join(root, 'web', 'data', 'mashaqel-data.json'), 'utf8'));

const engine = MashaqelEngine.open();
const failures: string[] = [];
let checks = 0;

function compare(label: string, expected: unknown, actual: unknown): void {
  checks += 1;
  const same = typeof expected === 'number' && typeof actual === 'number'
    ? Math.abs(expected - actual) <= 2
    : JSON.stringify(expected) === JSON.stringify(actual);
  if (!same) failures.push(`${label}: موتور=${String(expected)} | وب=${String(actual)}`);
}

const SERVICE = 'SERVICE_COMPANIES_NATIONWIDE';
const NATIONAL = 'NATIONAL_20_GROUP_1389';

const WAGE_CASES: EmployeeWageInput[] = [
  { schemeCode: SERVICE, jobGroup: 1, priorDailyJobWage: 3_463_656, computationDate: '1405-03-15' },
  { schemeCode: SERVICE, jobGroup: 5, priorDailyJobWage: 3_491_031, computationDate: '1405-03-15', overtimeHours: 10 },
  {
    schemeCode: SERVICE,
    jobGroup: 10,
    priorDailyJobWage: 3_541_569,
    priorAccumulatedDailySeniority: 600_403,
    serviceYearsInWorkshop: 5,
    isMarried: true,
    eligibleChildrenCount: 2,
    payableDays: 31,
    computationDate: '1405-05-20',
  },
  {
    schemeCode: SERVICE,
    jobGroup: 12,
    priorDailyJobWage: 3_566_838,
    priorAccumulatedDailySeniority: 302_967,
    serviceYearsInWorkshop: 2,
    priorDailyRankWage: 120_000,
    priorOtherFixedDailyWage: 80_000,
    shiftType: 'MORNING_EVENING_NIGHT',
    computationDate: '1405-08-01',
  },
  {
    schemeCode: SERVICE,
    jobGroup: 20,
    priorDailyJobWage: 3_741_615,
    priorAccumulatedDailySeniority: 1_143_906,
    serviceYearsInWorkshop: 9,
    nightWorkHours: 12,
    parameterVersion: '1405-v1',
    computationDate: '1405-02-10',
  },
  {
    schemeCode: SERVICE,
    jobGroup: 7,
    priorDailyJobWage: 3_507_877,
    serviceYearsInWorkshop: 0.5,
    payableDays: 22,
    computationDate: '1405-06-01',
    includeWelfareBenefits: false,
  },
  { schemeCode: SERVICE, jobGroup: 3, priorDailyJobWage: 3_476_291, shiftType: 'DAY_NIGHT', computationDate: '1405-11-11' },
];

for (const [index, input] of WAGE_CASES.entries()) {
  const expected = engine.computeWage(input);
  const actual = core.computeWage(data, input);
  for (const field of [
    'dailyJobWage',
    'dailySeniorityWage',
    'dailyRankWage',
    'dailyOtherBaseElements',
    'dailyBaseWage',
    'monthlyJobWage',
    'monthlySeniorityWage',
    'monthlyBaseWage',
    'overtimePay',
    'shiftPay',
    'nightWorkPay',
    'groceryAllowance',
    'housingAllowance',
    'maritalAllowance',
    'childAllowance',
    'welfareSubtotal',
    'wageSubtotal',
    'grossTotal',
    'workerInsurance',
    'employerInsurance',
    'tax',
    'netPayable',
  ]) {
    compare(`مزد #${index + 1}.${field}`, (expected as unknown as Record<string, unknown>)[field], actual[field]);
  }
  compare(`مزد #${index + 1}.parameterVersion`, expected.parameterVersion, actual.parameterVersion);
}

/* --------------------------- ارزیابی و گروه‌بندی --------------------------- */

const WELDER: PointBasedSelection[] = [
  { subFactorCode: 'EDU', kind: 'LEVEL', levelCode: 'EDU_3' },
  { subFactorCode: 'EXP', kind: 'LEVEL', levelCode: 'EXP_3' },
  { subFactorCode: 'SUP', kind: 'SUPERVISION', directHeadcountByGrade: {}, indirectHeadcount: 0 },
  { subFactorCode: 'MAT_PRD', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'P_MEDIUM' },
  { subFactorCode: 'MCH_EQP', kind: 'MATRIX', levelCode: 'L3', secondaryDimensionCode: 'P_HIGH' },
  { subFactorCode: 'COM_REL', kind: 'MATRIX', levelCode: 'L1', secondaryDimensionCode: 'C_LOW' },
  { subFactorCode: 'FIN_AST', kind: 'MATRIX', levelCode: 'L1', secondaryDimensionCode: 'P_LOW' },
  { subFactorCode: 'FRM_RPT', kind: 'MATRIX', levelCode: 'L1', secondaryDimensionCode: 'V_LOW' },
  { subFactorCode: 'SPC_RSP', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'I_LOW' },
  { subFactorCode: 'MNT_EFF', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'I_MEDIUM' },
  { subFactorCode: 'PHY_EFF', kind: 'DOMINANT_ROW', levelCode: 'PHY_6B', hoursBracketCode: 'H5' },
  {
    subFactorCode: 'ENV_CND',
    kind: 'ENV_ITEMS',
    items: [
      { itemCode: 'ENV_TEMP', intensityCode: 'HIGH', hoursBracketCode: 'B8' },
      { itemCode: 'ENV_NOISE', intensityCode: 'HIGH', hoursBracketCode: 'B6' },
      { itemCode: 'ENV_DUST', intensityCode: 'SEVERE', hoursBracketCode: 'B4' },
      { itemCode: 'ENV_SMOKE', intensityCode: 'HIGH', hoursBracketCode: 'B6' },
    ],
  },
  { subFactorCode: 'OCC_HAZ', kind: 'HAZARD', injuryLevelCode: 'HZ_INJ_3', injuryProbabilityCode: 'HIGH', diseaseProbabilityCode: 'MEDIUM' },
];

const SUPERVISOR: PointBasedSelection[] = [
  { subFactorCode: 'EDU', kind: 'LEVEL', levelCode: 'EDU_4' },
  { subFactorCode: 'EXP', kind: 'LEVEL', levelCode: 'EXP_6' },
  { subFactorCode: 'SUP', kind: 'SUPERVISION', directHeadcountByGrade: { G1: 8, G2: 3, G3: 1 }, indirectHeadcount: 25 },
  { subFactorCode: 'MAT_PRD', kind: 'MATRIX', levelCode: 'L3', secondaryDimensionCode: 'P_MEDIUM' },
  { subFactorCode: 'MCH_EQP', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'P_MEDIUM' },
  { subFactorCode: 'COM_REL', kind: 'MATRIX', levelCode: 'L3', secondaryDimensionCode: 'C_MEDIUM' },
  { subFactorCode: 'FIN_AST', kind: 'MATRIX', levelCode: 'L2', secondaryDimensionCode: 'P_MEDIUM' },
  { subFactorCode: 'FRM_RPT', kind: 'MATRIX', levelCode: 'L3', secondaryDimensionCode: 'V_MEDIUM' },
  { subFactorCode: 'SPC_RSP', kind: 'MATRIX', levelCode: 'L3', secondaryDimensionCode: 'I_MEDIUM' },
  { subFactorCode: 'MNT_EFF', kind: 'MATRIX', levelCode: 'L4', secondaryDimensionCode: 'I_MEDIUM' },
  { subFactorCode: 'PHY_EFF', kind: 'DOMINANT_ROW', levelCode: 'PHY_2', hoursBracketCode: 'H4' },
  { subFactorCode: 'ENV_CND', kind: 'ENV_ITEMS', items: [{ itemCode: 'ENV_NOISE', intensityCode: 'HIGH', hoursBracketCode: 'B4' }] },
  { subFactorCode: 'OCC_HAZ', kind: 'HAZARD', injuryLevelCode: 'HZ_INJ_2', injuryProbabilityCode: 'MEDIUM', diseaseProbabilityCode: 'LOW' },
];

for (const [name, selections] of [
  ['جوشکار', WELDER],
  ['سرپرست تولید', SUPERVISOR],
] as Array<[string, PointBasedSelection[]]>) {
  const expected = engine.evaluatePointBased({ systemCode: 'EVAL_1389_POINT_FACTOR', evaluationDate: '1405-03-15', selections });
  const actual = core.evaluatePointBased(data, { systemCode: 'EVAL_1389_POINT_FACTOR', evaluationDate: '1405-03-15', selections });
  compare(`ارزیابی ${name}.totalScore`, expected.totalScore, actual.totalScore);
  compare(`ارزیابی ${name}.scoringComplete`, expected.scoringComplete, actual.scoringComplete);
  for (const sub of expected.subFactorScores) {
    const mirror = actual.subFactorScores.find((row: { subFactorCode: string }) => row.subFactorCode === sub.subFactorCode);
    compare(`ارزیابی ${name}.${sub.subFactorCode}`, sub.points, mirror?.points);
  }
}

for (const score of [0, 40, 80, 81, 95, 125, 126, 300, 500, 665, 740, 745]) {
  const expected = engine.matchGroup({ schemeCode: NATIONAL, score, asOfDate: '1405-03-15' });
  const actual = core.matchGroup(data, { schemeCode: NATIONAL, score, asOfDate: '1405-03-15' });
  compare(`گروه امتیاز ${score}`, expected.group, actual.group);
  compare(`تطبیق کامل ${score}`, expected.matched, actual.matched);
}

for (let group = 1; group <= 20; group += 1) {
  const expected = engine.seniorityRate({ schemeCode: NATIONAL, group, fiscalYear: 1405, asOfDate: '1405-05-01' });
  const actual = core.getSeniorityRate(data, { schemeCode: NATIONAL, group, fiscalYear: 1405, asOfDate: '1405-05-01' });
  compare(`نرخ سنوات گروه ${group}`, expected.rate, actual.rate);
}

for (const years of [0, 1, 2, 7, 7.5, 12.25, 30]) {
  const expected = engine.cumulativeSeniority({ schemeCode: NATIONAL, yearsOfService: years, asOfDate: '1405-05-01' });
  const actual = core.computeCumulativeSeniority(data, { schemeCode: NATIONAL, yearsOfService: years, asOfDate: '1405-05-01' });
  compare(`سنوات تجمیعی ${years} سال`, expected.amount, actual.amount);
}

engine.close();

if (failures.length > 0) {
  console.error(`تطبیق وب و موتور ناموفق: ${failures.length} اختلاف از ${checks} بررسی`);
  for (const failure of failures.slice(0, 25)) console.error(` - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`تطبیق کامل وب‌اپ و موتور تأیید شد: ${checks} بررسی عددی بدون اختلاف.`);
}
