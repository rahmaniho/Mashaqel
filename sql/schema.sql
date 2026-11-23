-- =============================================================================
-- سامانه طبقه‌بندی مشاغل و محاسبه مزد و معوقات قانون کار ایران (Mashaqel Engine)
-- ساختار کامل ۱۷ جدول دیتابیس رابطه‌ای (سازگار با SQLite 3.35+ / Node SQLite)
-- واحد پولی الزامی در تمامی جداول مالی: ریال ایران (IRR)
-- =============================================================================

PRAGMA foreign_keys = ON;

-- ۱. جدول اسناد و مستندات قانونی مرجع (legal_documents)
CREATE TABLE IF NOT EXISTS legal_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    issuing_authority TEXT NOT NULL,
    circular_number TEXT,
    approval_date_jalali TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('LAW', 'BYLAW', 'EVALUATION_SYSTEM', 'INSTRUCTION', 'CIRCULAR', 'CABINET_DECREE')),
    validity_status TEXT NOT NULL CHECK (validity_status IN (
        '1_VERIFIED_USABLE',
        '2_EXTRACTED_NEEDS_VERIFICATION',
        '3_INSUFFICIENT_DOCUMENTATION',
        '4_REQUIRES_WORKSHOP_APPROVED_SCHEME'
    )),
    summary_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ۲. جدول نسخه‌بندی و شناسنامه فرمول‌ها (formula_versions)
CREATE TABLE IF NOT EXISTS formula_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    formula_code TEXT NOT NULL,
    formula_name TEXT NOT NULL,
    calculation_description TEXT NOT NULL,
    expression_spec TEXT NOT NULL,
    version TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    currency_unit TEXT NOT NULL DEFAULT 'IRR' CHECK (currency_unit = 'IRR'),
    legal_source TEXT NOT NULL,
    circular_number TEXT,
    validity_status TEXT NOT NULL CHECK (validity_status IN (
        '1_VERIFIED_USABLE',
        '2_EXTRACTED_NEEDS_VERIFICATION',
        '3_INSUFFICIENT_DOCUMENTATION',
        '4_REQUIRES_WORKSHOP_APPROVED_SCHEME'
    )),
    legal_document_id INTEGER REFERENCES legal_documents(id),
    last_modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (formula_code, version)
);

-- ۳. جدول نظام‌های ارزیابی مشاغل (evaluation_systems)
CREATE TABLE IF NOT EXISTS evaluation_systems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system_code TEXT NOT NULL,
    name TEXT NOT NULL,
    legal_basis TEXT NOT NULL,
    circular_number TEXT,
    approval_date_jalali TEXT NOT NULL,
    version TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    scoring_mode TEXT NOT NULL CHECK (scoring_mode IN ('POINT_FACTOR_FIXED', 'CONFIGURABLE_QUANTITATIVE_OR_HYBRID')),
    max_theoretical_score REAL,
    requires_workshop_tables INTEGER NOT NULL DEFAULT 0 CHECK (requires_workshop_tables IN (0, 1)),
    validity_status TEXT NOT NULL CHECK (validity_status IN (
        '1_VERIFIED_USABLE',
        '2_EXTRACTED_NEEDS_VERIFICATION',
        '3_INSUFFICIENT_DOCUMENTATION',
        '4_REQUIRES_WORKSHOP_APPROVED_SCHEME'
    )),
    legal_document_id INTEGER REFERENCES legal_documents(id),
    description TEXT,
    UNIQUE (system_code, version)
);

-- ۴. جدول عوامل اصلی ارزیابی مشاغل (evaluation_factors)
CREATE TABLE IF NOT EXISTS evaluation_factors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system_id INTEGER NOT NULL REFERENCES evaluation_systems(id) ON DELETE CASCADE,
    factor_code TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    max_score REAL,
    official_weight_pct REAL,
    definition TEXT NOT NULL,
    validity_status TEXT NOT NULL CHECK (validity_status IN (
        '1_VERIFIED_USABLE',
        '2_EXTRACTED_NEEDS_VERIFICATION',
        '3_INSUFFICIENT_DOCUMENTATION',
        '4_REQUIRES_WORKSHOP_APPROVED_SCHEME'
    )),
    UNIQUE (system_id, factor_code)
);

-- ۵. جدول زیرعامل‌های ارزیابی مشاغل (evaluation_sub_factors)
CREATE TABLE IF NOT EXISTS evaluation_sub_factors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factor_id INTEGER NOT NULL REFERENCES evaluation_factors(id) ON DELETE CASCADE,
    sub_factor_code TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    max_score REAL,
    official_weight_pct REAL,
    scoring_mechanism TEXT NOT NULL CHECK (scoring_mechanism IN (
        'SINGLE_DEGREE',
        'MATRIX_2D',
        'SUPERVISION_COMPOSITE',
        'DOMINANT_ACTIVITY_ROW',
        'MULTI_ITEM_SUM_CAPPED',
        'INJURY_PLUS_DISEASE_CAPPED',
        'WORKSHOP_SCHEME_DEFINED',
        'DISABLED_PENDING_OFFICIAL_TABLE'
    )),
    scoring_enabled INTEGER NOT NULL DEFAULT 1 CHECK (scoring_enabled IN (0, 1)),
    definition TEXT NOT NULL,
    application_rule TEXT,
    validity_status TEXT NOT NULL CHECK (validity_status IN (
        '1_VERIFIED_USABLE',
        '2_EXTRACTED_NEEDS_VERIFICATION',
        '3_INSUFFICIENT_DOCUMENTATION',
        '4_REQUIRES_WORKSHOP_APPROVED_SCHEME'
    )),
    UNIQUE (factor_id, sub_factor_code)
);

-- ۶. جدول سطوح و درجات زیرعامل‌ها (evaluation_levels)
CREATE TABLE IF NOT EXISTS evaluation_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sub_factor_id INTEGER NOT NULL REFERENCES evaluation_sub_factors(id) ON DELETE CASCADE,
    level_code TEXT NOT NULL,
    level_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    secondary_dimension_code TEXT NOT NULL DEFAULT 'DEFAULT',
    secondary_dimension_title TEXT,
    criteria_description TEXT,
    tvto_hours_equivalent INTEGER,
    validity_status TEXT NOT NULL CHECK (validity_status IN (
        '1_VERIFIED_USABLE',
        '2_EXTRACTED_NEEDS_VERIFICATION',
        '3_INSUFFICIENT_DOCUMENTATION',
        '4_REQUIRES_WORKSHOP_APPROVED_SCHEME'
    )),
    UNIQUE (sub_factor_id, level_code, secondary_dimension_code)
);

-- ۷. جدول امتیازات نسخه‌بندی‌شده هر سطح (evaluation_scores)
CREATE TABLE IF NOT EXISTS evaluation_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level_id INTEGER NOT NULL REFERENCES evaluation_levels(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    points REAL NOT NULL CHECK (points >= 0),
    formula_rule_json TEXT,
    validity_status TEXT NOT NULL CHECK (validity_status IN (
        '1_VERIFIED_USABLE',
        '2_EXTRACTED_NEEDS_VERIFICATION',
        '3_INSUFFICIENT_DOCUMENTATION',
        '4_REQUIRES_WORKSHOP_APPROVED_SCHEME'
    )),
    legal_document_id INTEGER REFERENCES legal_documents(id),
    UNIQUE (level_id, version)
);

-- ۸. جدول وزن‌ها و ضرایب عوامل در نظام یا طرح کارگاه (evaluation_weights)
CREATE TABLE IF NOT EXISTS evaluation_weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system_id INTEGER NOT NULL REFERENCES evaluation_systems(id) ON DELETE CASCADE,
    scheme_code TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('FACTOR', 'SUB_FACTOR')),
    target_code TEXT NOT NULL,
    weight_percent REAL NOT NULL CHECK (weight_percent >= 0 AND weight_percent <= 100),
    coefficient REAL NOT NULL DEFAULT 1.0 CHECK (coefficient > 0),
    version TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    is_official_national INTEGER NOT NULL DEFAULT 0 CHECK (is_official_national IN (0, 1)),
    validity_status TEXT NOT NULL CHECK (validity_status IN (
        '1_VERIFIED_USABLE',
        '2_EXTRACTED_NEEDS_VERIFICATION',
        '3_INSUFFICIENT_DOCUMENTATION',
        '4_REQUIRES_WORKSHOP_APPROVED_SCHEME'
    )),
    legal_document_id INTEGER REFERENCES legal_documents(id),
    UNIQUE (system_id, scheme_code, target_type, target_code, version)
);

-- ۹. جدول بازه امتیازات و سقف گروه‌های شغلی (group_score_ranges)
CREATE TABLE IF NOT EXISTS group_score_ranges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system_id INTEGER NOT NULL REFERENCES evaluation_systems(id) ON DELETE CASCADE,
    scheme_code TEXT NOT NULL,
    version TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    group_number INTEGER NOT NULL CHECK (group_number >= 1),
    min_score REAL NOT NULL CHECK (min_score >= 0),
    max_score REAL NOT NULL CHECK (max_score >= min_score),
    ceiling_score_xn REAL NOT NULL,
    excess_over_g1_bn REAL NOT NULL,
    consecutive_diff_delta REAL NOT NULL,
    validity_status TEXT NOT NULL CHECK (validity_status IN (
        '1_VERIFIED_USABLE',
        '2_EXTRACTED_NEEDS_VERIFICATION',
        '3_INSUFFICIENT_DOCUMENTATION',
        '4_REQUIRES_WORKSHOP_APPROVED_SCHEME'
    )),
    legal_document_id INTEGER REFERENCES legal_documents(id),
    UNIQUE (scheme_code, version, group_number)
);

-- ۱۰. جدول شناسنامه مشاغل (job_profiles)
CREATE TABLE IF NOT EXISTS job_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workshop_code TEXT NOT NULL,
    job_code TEXT NOT NULL,
    job_title TEXT NOT NULL,
    organizational_unit TEXT NOT NULL,
    job_objective TEXT NOT NULL,
    duties_description TEXT NOT NULL,
    responsibilities TEXT NOT NULL,
    authorities TEXT NOT NULL,
    qualification_requirements TEXT NOT NULL,
    required_education TEXT NOT NULL,
    required_experience_years REAL NOT NULL DEFAULT 0 CHECK (required_experience_years >= 0),
    required_skills TEXT NOT NULL,
    working_conditions TEXT NOT NULL,
    parent_supervisor_job_code TEXT,
    version TEXT NOT NULL DEFAULT '1.0',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (workshop_code, job_code, version)
);

-- ۱۱. جدول ارزیابی مشاغل و وضعیت تأیید کارشناسی (job_evaluations)
CREATE TABLE IF NOT EXISTS job_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_profile_id INTEGER NOT NULL REFERENCES job_profiles(id) ON DELETE CASCADE,
    system_id INTEGER NOT NULL REFERENCES evaluation_systems(id),
    scheme_code TEXT NOT NULL,
    group_table_version TEXT NOT NULL,
    evaluated_at TEXT NOT NULL DEFAULT (datetime('now')),
    factor_scores_json TEXT NOT NULL,
    sub_factor_scores_json TEXT NOT NULL,
    total_score REAL NOT NULL CHECK (total_score >= 0),
    matched_range_id INTEGER REFERENCES group_score_ranges(id),
    proposed_group INTEGER CHECK (proposed_group IS NULL OR proposed_group >= 1),
    final_confirmed_group INTEGER CHECK (final_confirmed_group IS NULL OR final_confirmed_group >= 1),
    determination_reasons_json TEXT NOT NULL,
    expert_warnings_json TEXT NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'PENDING_COMMITTEE_APPROVAL' CHECK (
        approval_status IN (
            'DRAFT',
            'PENDING_COMMITTEE_APPROVAL',
            'COMMITTEE_APPROVED',
            'MINISTRY_APPROVED',
            'REJECTED'
        )
    ),
    reviewed_by_expert TEXT,
    committee_reference_no TEXT,
    approved_at TEXT,
    -- قید حیاتی قانونی: گروه شغلی بدون بررسی و تأیید کارشناس/کمیته و مرجع مسئول هرگز قطعی نمی‌شود
    CHECK (
        (approval_status IN ('COMMITTEE_APPROVED', 'MINISTRY_APPROVED')
            AND final_confirmed_group IS NOT NULL
            AND reviewed_by_expert IS NOT NULL)
        OR
        (approval_status IN ('DRAFT', 'PENDING_COMMITTEE_APPROVAL', 'REJECTED')
            AND final_confirmed_group IS NULL)
    )
);

-- ۱۲. جدول مزد گروه‌های شغلی طرح‌های مصوب (wage_tables)
CREATE TABLE IF NOT EXISTS wage_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheme_code TEXT NOT NULL,
    scheme_title TEXT NOT NULL,
    workshop_code TEXT,
    fiscal_year INTEGER NOT NULL,
    version TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    currency_unit TEXT NOT NULL DEFAULT 'IRR' CHECK (currency_unit = 'IRR'),
    base_floor_daily_wage INTEGER NOT NULL CHECK (base_floor_daily_wage > 0),
    rial_coefficient_a REAL NOT NULL CHECK (rial_coefficient_a >= 0),
    has_ranking_system INTEGER NOT NULL DEFAULT 0 CHECK (has_ranking_system IN (0, 1)),
    rank_interval_years INTEGER NOT NULL DEFAULT 4 CHECK (rank_interval_years > 0),
    group_number INTEGER NOT NULL CHECK (group_number >= 1),
    daily_job_wage INTEGER NOT NULL CHECK (daily_job_wage >= base_floor_daily_wage),
    legal_document_id INTEGER REFERENCES legal_documents(id),
    validity_status TEXT NOT NULL CHECK (validity_status IN (
        '1_VERIFIED_USABLE',
        '2_EXTRACTED_NEEDS_VERIFICATION',
        '3_INSUFFICIENT_DOCUMENTATION',
        '4_REQUIRES_WORKSHOP_APPROVED_SCHEME'
    )),
    UNIQUE (scheme_code, fiscal_year, version, group_number)
);

-- ۱۳. جدول پایه سنوات گروه‌ها و سنوات تجمیعی گذشته (seniority_tables)
CREATE TABLE IF NOT EXISTS seniority_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheme_code TEXT NOT NULL,
    table_type TEXT NOT NULL CHECK (table_type IN ('ANNUAL_GROUP_RATE', 'CUMULATIVE_PAST_SERVICE')),
    fiscal_year INTEGER NOT NULL,
    version TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    currency_unit TEXT NOT NULL DEFAULT 'IRR' CHECK (currency_unit = 'IRR'),
    group_number INTEGER,
    years_of_service INTEGER,
    daily_seniority_amount INTEGER NOT NULL CHECK (daily_seniority_amount >= 0),
    legal_document_id INTEGER REFERENCES legal_documents(id),
    validity_status TEXT NOT NULL CHECK (validity_status IN (
        '1_VERIFIED_USABLE',
        '2_EXTRACTED_NEEDS_VERIFICATION',
        '3_INSUFFICIENT_DOCUMENTATION',
        '4_REQUIRES_WORKSHOP_APPROVED_SCHEME'
    )),
    CHECK (
        (table_type = 'ANNUAL_GROUP_RATE' AND group_number IS NOT NULL AND years_of_service IS NULL)
        OR
        (table_type = 'CUMULATIVE_PAST_SERVICE' AND years_of_service IS NOT NULL)
    )
);

-- ۱۴. جدول پارامترهای سالانه قانون کار و بخشنامه‌های مزد (annual_labor_parameters)
CREATE TABLE IF NOT EXISTS annual_labor_parameters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_year INTEGER NOT NULL,
    version TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    currency_unit TEXT NOT NULL DEFAULT 'IRR' CHECK (currency_unit = 'IRR'),
    min_daily_wage INTEGER NOT NULL CHECK (min_daily_wage > 0),
    other_levels_increase_pct REAL NOT NULL CHECK (other_levels_increase_pct >= 0),
    other_levels_fixed_daily INTEGER NOT NULL CHECK (other_levels_fixed_daily >= 0),
    base_daily_seniority_g1 INTEGER NOT NULL CHECK (base_daily_seniority_g1 >= 0),
    grocery_allowance_monthly INTEGER NOT NULL CHECK (grocery_allowance_monthly >= 0),
    housing_allowance_monthly INTEGER NOT NULL CHECK (housing_allowance_monthly >= 0),
    housing_legal_status TEXT NOT NULL,
    marital_allowance_monthly INTEGER NOT NULL CHECK (marital_allowance_monthly >= 0),
    child_allowance_multiplier INTEGER NOT NULL DEFAULT 3,
    normal_daily_hours_divisor REAL NOT NULL DEFAULT 7.33,
    overtime_multiplier REAL NOT NULL DEFAULT 1.40,
    shift_2_pct REAL NOT NULL DEFAULT 0.10,
    shift_3_pct REAL NOT NULL DEFAULT 0.15,
    shift_day_night_pct REAL NOT NULL DEFAULT 0.225,
    night_work_pct REAL NOT NULL DEFAULT 0.35,
    worker_insurance_pct REAL NOT NULL DEFAULT 0.07,
    employer_insurance_pct REAL NOT NULL DEFAULT 0.20,
    unemployment_insurance_pct REAL NOT NULL DEFAULT 0.03,
    insurable_daily_ceiling INTEGER,
    tax_brackets_json TEXT,
    legal_document_id INTEGER REFERENCES legal_documents(id),
    validity_status TEXT NOT NULL CHECK (validity_status IN (
        '1_VERIFIED_USABLE',
        '2_EXTRACTED_NEEDS_VERIFICATION',
        '3_INSUFFICIENT_DOCUMENTATION',
        '4_REQUIRES_WORKSHOP_APPROVED_SCHEME'
    )),
    UNIQUE (fiscal_year, version)
);

-- ۱۵. جدول پرونده پرسنلی و احکام کارگزینی شاغلان (employee_records)
CREATE TABLE IF NOT EXISTS employee_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    workshop_code TEXT NOT NULL,
    scheme_code TEXT NOT NULL,
    job_profile_id INTEGER REFERENCES job_profiles(id),
    confirmed_job_group INTEGER CHECK (confirmed_job_group IS NULL OR confirmed_job_group >= 1),
    education_level TEXT NOT NULL,
    tvto_skill_hours INTEGER NOT NULL DEFAULT 0 CHECK (tvto_skill_hours >= 0),
    service_years_in_workshop REAL NOT NULL DEFAULT 0 CHECK (service_years_in_workshop >= 0),
    related_experience_years REAL NOT NULL DEFAULT 0 CHECK (related_experience_years >= 0),
    military_service_months INTEGER NOT NULL DEFAULT 0 CHECK (military_service_months >= 0),
    is_married INTEGER NOT NULL DEFAULT 0 CHECK (is_married IN (0, 1)),
    eligible_children_count INTEGER NOT NULL DEFAULT 0 CHECK (eligible_children_count >= 0),
    has_720_days_insurance INTEGER NOT NULL DEFAULT 1 CHECK (has_720_days_insurance IN (0, 1)),
    currency_unit TEXT NOT NULL DEFAULT 'IRR' CHECK (currency_unit = 'IRR'),
    prior_daily_job_wage INTEGER NOT NULL DEFAULT 0 CHECK (prior_daily_job_wage >= 0),
    prior_accumulated_daily_seniority INTEGER NOT NULL DEFAULT 0 CHECK (prior_accumulated_daily_seniority >= 0),
    prior_daily_rank_wage INTEGER NOT NULL DEFAULT 0 CHECK (prior_daily_rank_wage >= 0),
    prior_other_fixed_daily_wage INTEGER NOT NULL DEFAULT 0 CHECK (prior_other_fixed_daily_wage >= 0),
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (workshop_code, employee_code, effective_date)
);

-- ۱۶. جدول محاسبات مزد، مزایا و معوقات (wage_calculations)
CREATE TABLE IF NOT EXISTS wage_calculations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employee_records(id),
    calculation_type TEXT NOT NULL CHECK (calculation_type IN ('MONTHLY_PAYROLL', 'DAILY_WAGE', 'ARREARS')),
    fiscal_year INTEGER NOT NULL,
    period_year_month TEXT NOT NULL,
    calculation_date TEXT NOT NULL,
    parameter_version TEXT NOT NULL,
    wage_table_version TEXT,
    seniority_table_version TEXT,
    currency_unit TEXT NOT NULL DEFAULT 'IRR' CHECK (currency_unit = 'IRR'),
    payable_days REAL NOT NULL CHECK (payable_days >= 0),
    daily_job_wage INTEGER NOT NULL CHECK (daily_job_wage >= 0),
    daily_seniority_wage INTEGER NOT NULL DEFAULT 0 CHECK (daily_seniority_wage >= 0),
    daily_rank_wage INTEGER NOT NULL DEFAULT 0 CHECK (daily_rank_wage >= 0),
    daily_other_base_elements INTEGER NOT NULL DEFAULT 0 CHECK (daily_other_base_elements >= 0),
    daily_adaptation_diff INTEGER NOT NULL DEFAULT 0 CHECK (daily_adaptation_diff >= 0),
    daily_base_wage INTEGER NOT NULL CHECK (daily_base_wage >= 0),
    monthly_job_wage INTEGER NOT NULL CHECK (monthly_job_wage >= 0),
    monthly_seniority_wage INTEGER NOT NULL DEFAULT 0 CHECK (monthly_seniority_wage >= 0),
    monthly_base_wage INTEGER NOT NULL CHECK (monthly_base_wage >= 0),
    overtime_pay INTEGER NOT NULL DEFAULT 0 CHECK (overtime_pay >= 0),
    shift_pay INTEGER NOT NULL DEFAULT 0 CHECK (shift_pay >= 0),
    night_work_pay INTEGER NOT NULL DEFAULT 0 CHECK (night_work_pay >= 0),
    other_wage_allowances INTEGER NOT NULL DEFAULT 0 CHECK (other_wage_allowances >= 0),
    -- مزایای رفاهی و انگیزشی کاملاً تفکیک‌شده از مزد شغل و مزد مبنا
    grocery_allowance INTEGER NOT NULL DEFAULT 0 CHECK (grocery_allowance >= 0),
    housing_allowance INTEGER NOT NULL DEFAULT 0 CHECK (housing_allowance >= 0),
    marital_allowance INTEGER NOT NULL DEFAULT 0 CHECK (marital_allowance >= 0),
    child_allowance INTEGER NOT NULL DEFAULT 0 CHECK (child_allowance >= 0),
    gross_total INTEGER NOT NULL CHECK (gross_total >= 0),
    worker_insurance_deduction INTEGER NOT NULL DEFAULT 0 CHECK (worker_insurance_deduction >= 0),
    employer_insurance_contribution INTEGER NOT NULL DEFAULT 0 CHECK (employer_insurance_contribution >= 0),
    tax_deduction INTEGER NOT NULL DEFAULT 0 CHECK (tax_deduction >= 0),
    net_payable INTEGER NOT NULL CHECK (net_payable >= 0),
    breakdown_json TEXT NOT NULL,
    warnings_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ۱۷. جدول تاریخچه ممیزی و ردیابی کامل محاسبات (calculation_history)
CREATE TABLE IF NOT EXISTS calculation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT NOT NULL UNIQUE,
    operation_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    formula_code TEXT NOT NULL,
    formula_version TEXT NOT NULL,
    input_snapshot_json TEXT NOT NULL,
    applied_tables_json TEXT NOT NULL,
    output_snapshot_json TEXT NOT NULL,
    currency_unit TEXT NOT NULL DEFAULT 'IRR' CHECK (currency_unit = 'IRR'),
    actor TEXT NOT NULL DEFAULT 'SYSTEM',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ایندکس‌های بهینه‌سازی جستجوی چندتاریخی و نسخه‌بندی
CREATE INDEX IF NOT EXISTS idx_formula_versions_dates ON formula_versions (formula_code, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_group_ranges_lookup ON group_score_ranges (scheme_code, effective_from, effective_to, min_score, max_score);
CREATE INDEX IF NOT EXISTS idx_wage_tables_lookup ON wage_tables (scheme_code, fiscal_year, effective_from, effective_to, group_number);
CREATE INDEX IF NOT EXISTS idx_seniority_lookup ON seniority_tables (scheme_code, table_type, fiscal_year, effective_from, effective_to, group_number);
CREATE INDEX IF NOT EXISTS idx_annual_params_lookup ON annual_labor_parameters (fiscal_year, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_calc_history_entity ON calculation_history (entity_type, entity_id, created_at);
