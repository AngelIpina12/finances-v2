import { relations as drizzleRelations } from "drizzle-orm";
import {
    accounts, sessions, users
} from "../schema/auth";
import {
    categories, financialAccounts, scheduledOccurrences, transactions
} from "../schema/financial";

export const usersRelations = drizzleRelations(users, ({ many }) => ({
    sessions: many(sessions),
    accounts: many(accounts),
    financialAccounts: many(financialAccounts),
    categories: many(categories),
    scheduledOccurrences: many(scheduledOccurrences),
    transactions: many(transactions),
}));

export const sessionsRelations = drizzleRelations(sessions, ({ one }) => ({
    user: one(users, { fields: [sessions.userId], references: [users.id] })
}));

export const accountsRelations = drizzleRelations(accounts, ({ one }) => ({
    user: one(users, { fields: [accounts.userId], references: [users.id] })
}));

export const financialAccountsRelations = drizzleRelations(financialAccounts, ({ many, one }) => ({
    user: one(users, { fields: [financialAccounts.userId], references: [users.id] }),
    transactions: many(transactions),
    scheduledOccurrences: many(scheduledOccurrences),
}));

export const categoriesRelations = drizzleRelations(categories, ({ many, one }) => ({
    user: one(users, { fields: [categories.userId], references: [users.id] }),
    parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: "category_hierarchy" }),
    children: many(categories, { relationName: "category_hierarchy" }),
    transactions: many(transactions),
    scheduledOccurrences: many(scheduledOccurrences),
}));

export const scheduledOccurrencesRelations = drizzleRelations(scheduledOccurrences, ({ many, one }) => ({
    user: one(users, { fields: [scheduledOccurrences.userId], references: [users.id] }),
    account: one(financialAccounts, { fields: [scheduledOccurrences.accountId], references: [financialAccounts.id] }),
    category: one(categories, { fields: [scheduledOccurrences.categoryId], references: [categories.id] }),
    transactions: many(transactions),
}));

export const transactionsRelations = drizzleRelations(transactions, ({ one }) => ({
    user: one(users, { fields: [transactions.userId], references: [users.id] }),
    account: one(financialAccounts, { fields: [transactions.accountId], references: [financialAccounts.id] }),
    category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
    scheduledOccurrence: one(scheduledOccurrences, {
        fields: [transactions.scheduledOccurrenceId],
        references: [scheduledOccurrences.id],
    }),
}));

export const relations = {
    usersRelations,
    sessionsRelations,
    accountsRelations,
    financialAccountsRelations,
    categoriesRelations,
    scheduledOccurrencesRelations,
    transactionsRelations,
};
