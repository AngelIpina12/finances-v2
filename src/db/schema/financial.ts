import {
    boolean, foreignKey, index,
    integer, numeric, pgEnum,
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
export const scheduleFrequencyEnum = pgEnum("schedule_frequency", ["weekly", "biweekly", "monthly", "yearly"]);
export const recurrenceEndModeEnum = pgEnum("recurrence_end_mode", ["never", "on_date"]);

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
        name: text("name").notNull(),
        amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
        currency: currencyCodeEnum("currency").notNull(),
        notes: text("notes"),
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
        index("transactions_transfer_group_idx").on(table.transferGroupId),
        uniqueIndex("transactions_scheduled_occurrence_idx")
            .on(table.scheduledOccurrenceId)
            .where(sql`${table.scheduledOccurrenceId} is not null`),
    ],
);
