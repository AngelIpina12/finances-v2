import {
    boolean, foreignKey, index,
    integer, jsonb, numeric, pgEnum,
    pgTable, text, timestamp,
    uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const accountTypeEnum = pgEnum("account_type", ["cash", "debit", "credit", "wallet", "investment", "fixed_income", "loan"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense", "transfer"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "scheduled", "cancelled"]);
export const transferDirectionEnum = pgEnum("transfer_direction", ["in", "out"]);
export const currencyCodeEnum = pgEnum("currency_code", ["MXN", "USD", "EUR", "GBP"]);
export const occurrenceStatusEnum = pgEnum("occurrence_status", ["scheduled", "completed", "skipped", "cancelled"]);
export const occurrenceSourceEnum = pgEnum("occurrence_source", ["manual", "recurring_rule", "financing_installment"]);
export const scheduleFrequencyEnum = pgEnum("schedule_frequency", [
    "weekly", "biweekly", "semimonthly", "monthly", "yearly", "custom",
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
        uniqueIndex("financing_plans_purchase_transaction_idx").on(table.purchaseTransactionId),
        index("financing_plans_user_status_idx").on(table.userId, table.status),
        index("financing_plans_credit_account_idx").on(table.creditAccountId),
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
        uniqueIndex("financing_installments_payment_transfer_idx")
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
