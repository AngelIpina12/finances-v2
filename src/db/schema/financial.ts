import {
    boolean, foreignKey, index,
    integer, jsonb, numeric, pgEnum,
    date, pgTable, text, timestamp,
    uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { LoanTerms } from "@/src/features/loan-simulations/domain/amortization-calculator";
import { users } from "./auth";

export const accountTypeEnum = pgEnum("account_type", ["cash", "debit", "credit", "wallet", "investment", "fixed_income", "loan"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense", "transfer"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "scheduled", "cancelled"]);
export const transferDirectionEnum = pgEnum("transfer_direction", ["in", "out"]);
export const currencyCodeEnum = pgEnum("currency_code", ["MXN", "USD", "EUR", "GBP"]);
export const occurrenceStatusEnum = pgEnum("occurrence_status", ["scheduled", "completed", "skipped", "cancelled"]);
export const occurrenceSourceEnum = pgEnum("occurrence_source", ["manual", "recurring_rule", "financing_installment"]);
export const scheduleFrequencyEnum = pgEnum("schedule_frequency", [
    "weekly", "biweekly", "semimonthly", "monthly", "quarterly", "yearly", "custom",
]);
export const recurrenceEndModeEnum = pgEnum("recurrence_end_mode", ["never", "on_date"]);
export const recurrenceAmountStrategyEnum = pgEnum("recurrence_amount_strategy", [
    "fixed", "period_total", "custom_per_occurrence",
]);
export const fifthOccurrencePolicyEnum = pgEnum("fifth_occurrence_policy", [
    "keep_fixed", "distribute_monthly_total", "custom_amount",
]);
export const financingStatusEnum = pgEnum("financing_status", ["active", "completed", "cancelled"]);
export const budgetPeriodEnum = pgEnum("budget_period", ["weekly", "monthly", "quarterly", "yearly", "custom"]);
export const rolloverTypeEnum = pgEnum("rollover_type", ["disabled", "carry_remaining", "carry_deficit"]);
export const creditCardPaymentStrategyEnum = pgEnum("credit_card_payment_strategy", [
    "full_statement", "minimum_payment", "fixed_amount", "manual",
]);
export const fixedIncomeCalculationMethodEnum = pgEnum("fixed_income_calculation_method", ["simple", "compound"]);
export const fixedIncomeDayCountConventionEnum = pgEnum("fixed_income_day_count_convention", ["actual_360", "actual_365"]);
export const fixedIncomeInterestFrequencyEnum = pgEnum("fixed_income_interest_frequency", ["daily", "monthly", "at_maturity"]);
export const fixedIncomeStatusEnum = pgEnum("fixed_income_status", ["planned", "active", "matured", "settled", "cancelled"]);
export const fixedIncomeCashFlowTypeEnum = pgEnum("fixed_income_cash_flow_type", ["contribution", "interest", "withholding", "withdrawal", "maturity"]);

export const categories = pgTable(
    "categories",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        parentId: uuid("parent_id"),
        name: text("name").notNull(),
        type: transactionTypeEnum("type").notNull(),
        iconUrl: text("icon_url"),
        color: text("color"),
        sortOrder: integer("sort_order").notNull().default(0),
        isSystem: boolean("is_system").notNull().default(false),
        deletedAt: timestamp("deleted_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex("categories_user_type_name_idx")
            .on(table.userId, table.type, table.name)
            .where(sql`${table.deletedAt} is null`),
        index("categories_user_sort_order_idx")
            .on(table.userId, table.type, table.sortOrder)
            .where(sql`${table.deletedAt} is null`),
        foreignKey({
            columns: [table.parentId],
            foreignColumns: [table.id],
            name: "categories_parent_id_categories_id_fk"
        }).onDelete("set null"),
    ],
);

export const financialAccounts = pgTable(
    "financial_accounts",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        type: accountTypeEnum("type").notNull(),
        currency: currencyCodeEnum("currency").notNull(),
        openingBalance: numeric("opening_balance", { precision: 15, scale: 2 }).notNull().default("0"),
        currentBalance: numeric("current_balance", { precision: 15, scale: 2 }).notNull().default("0"),
        institution: text("institution"),
        note: text("note"),
        color: text("color"),
        iconUrl: text("icon_url"),
        lastFourDigits: text("last_four_digits"),
        includeInNetWorth: boolean("include_in_net_worth").notNull().default(true),
        includeInLiquidity: boolean("include_in_liquidity").notNull().default(true),
        hideBalance: boolean("hide_balance").notNull().default(false),
        isActive: boolean("is_active").notNull().default(true),
        creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),
        availableCredit: numeric("available_credit", { precision: 15, scale: 2 }),
        owedAmount: numeric("owed_amount", { precision: 15, scale: 2 }),
        minimumPayment: numeric("minimum_payment", { precision: 15, scale: 2 }),
        statementBalance: numeric("statement_balance", { precision: 15, scale: 2 }),
        interestRate: numeric("interest_rate", { precision: 7, scale: 4 }),
        billingDate: integer("billing_date"),
        dueDate: integer("due_date"),
        paymentReminder: boolean("payment_reminder").notNull().default(false),
        deletedAt: timestamp("deleted_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        index("financial_accounts_user_active_idx").on(table.userId, table.isActive),
        index("financial_accounts_user_type_idx").on(table.userId, table.type),
    ],
);

export const creditCardPaymentSettings = pgTable(
    "credit_card_payment_settings",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        creditAccountId: uuid("credit_account_id")
            .notNull().references(() => financialAccounts.id, { onDelete: "cascade" }),
        sourceAccountId: uuid("source_account_id")
            .notNull().references(() => financialAccounts.id, { onDelete: "restrict" }),
        strategy: creditCardPaymentStrategyEnum("strategy").notNull().default("full_statement"),
        fixedAmount: numeric("fixed_amount", { precision: 15, scale: 2 }),
        paymentTermDays: integer("payment_term_days").notNull().default(20),
        includeInForecast: boolean("include_in_forecast").notNull().default(true),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex("credit_card_payment_settings_credit_account_idx").on(table.creditAccountId),
        index("credit_card_payment_settings_user_idx").on(table.userId),
        index("credit_card_payment_settings_source_account_idx").on(table.sourceAccountId),
    ],
);

export const creditCardPaymentDismissals = pgTable(
    "credit_card_payment_dismissals",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        creditAccountId: uuid("credit_account_id")
            .notNull().references(() => financialAccounts.id, { onDelete: "cascade" }),
        dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("credit_card_payment_dismissals_card_due_idx")
            .on(table.creditAccountId, table.dueAt),
        index("credit_card_payment_dismissals_user_idx").on(table.userId),
    ],
);

export const recurringRules = pgTable(
    "recurring_rules",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        accountId: uuid("account_id").notNull().references(() => financialAccounts.id, { onDelete: "restrict" }),
        categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
        transactionType: transactionTypeEnum("transaction_type").notNull(),
        frequency: scheduleFrequencyEnum("frequency").notNull(),
        endMode: recurrenceEndModeEnum("end_mode").notNull().default("never"),
        amountStrategy: recurrenceAmountStrategyEnum("amount_strategy").notNull().default("fixed"),
        fifthOccurrencePolicy: fifthOccurrencePolicyEnum("fifth_occurrence_policy").notNull().default("keep_fixed"),
        name: text("name").notNull(),
        amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
        periodTotal: numeric("period_total", { precision: 15, scale: 2 }),
        fifthOccurrenceAmount: numeric("fifth_occurrence_amount", { precision: 15, scale: 2 }),
        currency: currencyCodeEnum("currency").notNull(),
        notes: text("notes"),
        semimonthlyFirstDay: integer("semimonthly_first_day"),
        semimonthlySecondDay: integer("semimonthly_second_day"),
        calendarEntries: jsonb("calendar_entries").notNull().default(sql`'[]'::jsonb`),
        dateOverrides: jsonb("date_overrides").notNull().default(sql`'[]'::jsonb`),
        startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
        endsAt: timestamp("ends_at", { withTimezone: true }),
        lastGeneratedAt: timestamp("last_generated_at", { withTimezone: true }),
        isActive: boolean("is_active").notNull().default(true),
        deletedAt: timestamp("deleted_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        index("recurring_rules_user_active_next_idx")
            .on(table.userId, table.isActive, table.startsAt)
            .where(sql`${table.deletedAt} is null`),
        index("recurring_rules_account_idx").on(table.accountId),
        index("recurring_rules_category_idx").on(table.categoryId),
    ],
);

export const scheduledOccurrences = pgTable(
    "scheduled_occurrences",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        source: occurrenceSourceEnum("source").notNull().default("manual"),
        recurringRuleId: uuid("recurring_rule_id")
            .references(() => recurringRules.id, { onDelete: "cascade" }),
        financingInstallmentId: uuid("financing_installment_id"),
        sequence: integer("sequence"),
        accountId: uuid("account_id").notNull().references(() => financialAccounts.id, { onDelete: "restrict" }),
        categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
        transactionType: transactionTypeEnum("transaction_type").notNull(),
        name: text("name").notNull(),
        amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
        currency: currencyCodeEnum("currency").notNull(),
        notes: text("notes"),
        originalScheduledAt: timestamp("original_scheduled_at", { withTimezone: true }).notNull(),
        scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
        executedAt: timestamp("executed_at", { withTimezone: true }),
        status: occurrenceStatusEnum("status").notNull().default("scheduled"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        index("scheduled_occurrences_user_status_date_idx")
            .on(table.userId, table.status, table.scheduledAt),
        index("scheduled_occurrences_account_idx").on(table.accountId),
        index("scheduled_occurrences_category_idx").on(table.categoryId),
        index("scheduled_occurrences_rule_date_idx")
            .on(table.recurringRuleId, table.scheduledAt),
        uniqueIndex("scheduled_occurrences_rule_sequence_idx")
            .on(table.recurringRuleId, table.sequence)
            .where(sql`${table.recurringRuleId} is not null`),
        uniqueIndex("scheduled_occurrences_financing_installment_idx")
            .on(table.financingInstallmentId)
            .where(sql`${table.financingInstallmentId} is not null`),
    ],
);

export const financingPlans = pgTable(
    "financing_plans",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        creditAccountId: uuid("credit_account_id")
            .notNull().references(() => financialAccounts.id, { onDelete: "restrict" }),
        paymentAccountId: uuid("payment_account_id")
            .references(() => financialAccounts.id, { onDelete: "restrict" }),
        purchaseTransactionId: uuid("purchase_transaction_id").notNull(),
        name: text("name").notNull(),
        totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
        regularInstallmentCount: integer("regular_installment_count").notNull(),
        regularInstallmentAmount: numeric("regular_installment_amount", { precision: 15, scale: 2 }).notNull(),
        balloonAmount: numeric("balloon_amount", { precision: 15, scale: 2 }).notNull().default("0"),
        currency: currencyCodeEnum("currency").notNull(),
        startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
        status: financingStatusEnum("status").notNull().default("active"),
        cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex("financing_plans_purchase_transaction_idx")
            .on(table.purchaseTransactionId)
            .where(sql`${table.status} <> 'cancelled'`),
        index("financing_plans_user_status_idx").on(table.userId, table.status),
        index("financing_plans_credit_account_idx").on(table.creditAccountId),
        index("financing_plans_payment_account_idx").on(table.paymentAccountId),
    ],
);

export const financingInstallments = pgTable(
    "financing_installments",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        financingPlanId: uuid("financing_plan_id")
            .notNull().references(() => financingPlans.id, { onDelete: "cascade" }),
        sequence: integer("sequence").notNull(),
        scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
        amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
        isBalloon: boolean("is_balloon").notNull().default(false),
        paidAt: timestamp("paid_at", { withTimezone: true }),
        paymentTransferGroupId: uuid("payment_transfer_group_id"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex("financing_installments_plan_sequence_idx").on(table.financingPlanId, table.sequence),
        // No único: un pago de estado de cuenta puede liquidar varias cuotas
        // a la vez junto con los cargos regulares del ciclo.
        index("financing_installments_payment_transfer_idx")
            .on(table.paymentTransferGroupId)
            .where(sql`${table.paymentTransferGroupId} is not null`),
        index("financing_installments_plan_date_idx").on(table.financingPlanId, table.scheduledAt),
    ],
);

export const budgets = pgTable(
    "budgets",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
        currency: currencyCodeEnum("currency_code").notNull(),
        period: budgetPeriodEnum("period").notNull().default("monthly"),
        rollover: rolloverTypeEnum("rollover").notNull().default("disabled"),
        isReusable: boolean("is_reusable").notNull().default(true),
        color: text("color").notNull().default("#2563eb"),
        warningThreshold: integer("warning_threshold").notNull().default(80),
        startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
        endsAt: timestamp("ends_at", { withTimezone: true }),
        forecastAccountId: uuid("forecast_account_id").references(() => financialAccounts.id, { onDelete: "set null" }),
        includeInForecast: boolean("include_in_forecast").notNull().default(false),
        isActive: boolean("is_active").notNull().default(true),
        deletedAt: timestamp("deleted_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        index("budgets_user_active_idx").on(table.userId, table.isActive).where(sql`${table.deletedAt} is null`),
    ],
);

export const budgetAllocations = pgTable(
    "budget_allocations",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        budgetId: uuid("budget_id").notNull().references(() => budgets.id, { onDelete: "cascade" }),
        categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
        amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [uniqueIndex("budget_allocations_budget_category_idx").on(table.budgetId, table.categoryId)],
);

export const budgetPeriods = pgTable(
    "budget_periods",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        budgetId: uuid("budget_id").notNull().references(() => budgets.id, { onDelete: "cascade" }),
        periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
        periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
        allocatedAmount: numeric("allocated_amount", { precision: 15, scale: 2 }).notNull(),
        rolloverAmount: numeric("rollover_amount", { precision: 15, scale: 2 }).notNull().default("0"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex("budget_periods_budget_range_idx").on(table.budgetId, table.periodStart, table.periodEnd),
        index("budget_periods_budget_start_idx").on(table.budgetId, table.periodStart),
    ],
);

export const transactions = pgTable(
    "transactions",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        accountId: uuid("account_id").notNull().references(() => financialAccounts.id, { onDelete: "restrict" }),
        categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
        scheduledOccurrenceId: uuid("scheduled_occurrence_id")
            .references(() => scheduledOccurrences.id, { onDelete: "set null" }),
        financingPlanId: uuid("financing_plan_id"),
        financingInstallmentId: uuid("financing_installment_id"),
        // A transfer is represented by two rows sharing this id: an outflow and an inflow.
        transferGroupId: uuid("transfer_group_id"),
        transferDirection: transferDirectionEnum("transfer_direction"),
        type: transactionTypeEnum("type").notNull(),
        status: transactionStatusEnum("status").notNull().default("completed"),
        amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
        // Null means the full transaction amount counts toward the budget.
        budgetAmount: numeric("budget_amount", { precision: 15, scale: 2 }),
        currency: currencyCodeEnum("currency").notNull(),
        exchangeRate: numeric("exchange_rate", { precision: 18, scale: 8 }),
        convertedAmount: numeric("converted_amount", { precision: 15, scale: 2 }),
        merchant: text("merchant"),
        location: text("location"),
        description: text("description"),
        notes: text("notes"),
        date: timestamp("date", { withTimezone: true }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        index("transactions_user_date_idx").on(table.userId, table.date),
        index("transactions_account_date_idx").on(table.accountId, table.date),
        index("transactions_category_date_idx").on(table.categoryId, table.date),
        index("transactions_financing_plan_idx").on(table.financingPlanId),
        index("transactions_financing_installment_idx").on(table.financingInstallmentId),
        index("transactions_transfer_group_idx").on(table.transferGroupId),
        uniqueIndex("transactions_scheduled_occurrence_idx")
            .on(table.scheduledOccurrenceId)
            .where(sql`${table.scheduledOccurrenceId} is not null and ${table.status} <> 'cancelled'`),
    ],
);

export const fixedIncomePositions = pgTable(
    "fixed_income_positions",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        accountId: uuid("account_id").references(() => financialAccounts.id, { onDelete: "restrict" }),
        fundingAccountId: uuid("funding_account_id").notNull().references(() => financialAccounts.id, { onDelete: "restrict" }),
        settlementAccountId: uuid("settlement_account_id").notNull().references(() => financialAccounts.id, { onDelete: "restrict" }),
        name: text("name").notNull(),
        institution: text("institution"),
        currency: currencyCodeEnum("currency").notNull(),
        principal: numeric("principal", { precision: 15, scale: 2 }).notNull(),
        outstandingPrincipal: numeric("outstanding_principal", { precision: 15, scale: 2 }).notNull(),
        annualRate: numeric("annual_rate", { precision: 10, scale: 8 }).notNull(),
        calculationMethod: fixedIncomeCalculationMethodEnum("calculation_method").notNull().default("simple"),
        dayCountConvention: fixedIncomeDayCountConventionEnum("day_count_convention").notNull().default("actual_365"),
        interestFrequency: fixedIncomeInterestFrequencyEnum("interest_frequency").notNull().default("at_maturity"),
        withholdingRate: numeric("withholding_rate", { precision: 10, scale: 8 }),
        startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
        maturesAt: timestamp("matures_at", { withTimezone: true }),
        isAvailableOnDemand: boolean("is_available_on_demand").notNull().default(false),
        autoRenew: boolean("auto_renew").notNull().default(false),
        status: fixedIncomeStatusEnum("status").notNull().default("planned"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex("fixed_income_positions_account_idx").on(table.accountId),
        index("fixed_income_positions_user_status_idx").on(table.userId, table.status),
        index("fixed_income_positions_user_maturity_idx").on(table.userId, table.maturesAt),
    ],
);

export const fixedIncomeCashFlows = pgTable(
    "fixed_income_cash_flows",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        positionId: uuid("position_id").notNull().references(() => fixedIncomePositions.id, { onDelete: "cascade" }),
        type: fixedIncomeCashFlowTypeEnum("type").notNull(),
        grossAmount: numeric("gross_amount", { precision: 15, scale: 2 }).notNull(),
        taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).notNull().default("0"),
        netAmount: numeric("net_amount", { precision: 15, scale: 2 }).notNull(),
        occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
        transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "restrict" }),
        transferGroupId: uuid("transfer_group_id"),
        idempotencyKey: text("idempotency_key").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("fixed_income_cash_flows_position_idempotency_idx").on(table.positionId, table.idempotencyKey),
        index("fixed_income_cash_flows_position_date_idx").on(table.positionId, table.occurredAt),
    ],
);

// Simulación de ahorro automático en la previsión: los ingresos de una cuenta
// se barren a una de sus cajitas y los pagos retiran de ella lo que falte.
export const forecastSavingsSimulations = pgTable(
    "forecast_savings_simulations",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        /** Una regla por cuenta: sus ingresos se barren a la cajita y sus pagos retiran de ella. */
        rules: jsonb("rules").$type<Array<{ accountId: string; positionId: string; minimumBalance: number }>>().notNull().default([]),
        isDefault: boolean("is_default").notNull().default(false),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        index("forecast_savings_simulations_user_idx").on(table.userId),
        uniqueIndex("forecast_savings_simulations_default_idx")
            .on(table.userId)
            .where(sql`${table.isDefault}`),
    ],
);

/** Configuración guardada de la previsión: rango, filtros, vistas y simulación. */
export const forecastViews = pgTable(
    "forecast_views",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        /** Días desde hoy; null cuando el rango usa fechas fijas. */
        rangePresetDays: integer("range_preset_days"),
        startsOn: date("starts_on", { mode: "string" }),
        endsOn: date("ends_on", { mode: "string" }),
        currency: text("currency").notNull().default("all"),
        accountKind: text("account_kind").notNull().default("all"),
        accountIds: jsonb("account_ids").$type<string[]>().notNull().default([]),
        granularity: text("granularity").notNull().default("week"),
        savingsMode: text("savings_mode").notNull().default("exclude"),
        chartView: text("chart_view").notNull().default("balance"),
        savingsSimulationId: uuid("savings_simulation_id")
            .references(() => forecastSavingsSimulations.id, { onDelete: "set null" }),
        isDefault: boolean("is_default").notNull().default(false),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        index("forecast_views_user_idx").on(table.userId),
        uniqueIndex("forecast_views_default_idx")
            .on(table.userId)
            .where(sql`${table.isDefault}`),
    ],
);

/** Cotización de crédito simulada; la tabla de amortización se calcula al vuelo desde `terms`. */
export const loanSimulations = pgTable(
    "loan_simulations",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        currency: currencyCodeEnum("currency").notNull().default("MXN"),
        terms: jsonb("terms").$type<LoanTerms>().notNull(),
        notes: text("notes"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    },
    (table) => [
        index("loan_simulations_user_idx").on(table.userId),
    ],
);
