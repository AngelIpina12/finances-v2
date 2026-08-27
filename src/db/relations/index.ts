import { relations as drizzleRelations } from "drizzle-orm";
import { accounts, sessions, users } from "../schema/auth";
import { categories, financialAccounts, transactions } from "../schema/financial";

export const usersRelations = drizzleRelations(users, ({ many }) => ({
    sessions: many(sessions),
    accounts: many(accounts),
    financialAccounts: many(financialAccounts),
    categories: many(categories),
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
}));

export const categoriesRelations = drizzleRelations(categories, ({ many, one }) => ({
    user: one(users, { fields: [categories.userId], references: [users.id] }),
    parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: "category_hierarchy" }),
    children: many(categories, { relationName: "category_hierarchy" }),
    transactions: many(transactions),
}));

export const transactionsRelations = drizzleRelations(transactions, ({ one }) => ({
    user: one(users, { fields: [transactions.userId], references: [users.id] }),
    account: one(financialAccounts, { fields: [transactions.accountId], references: [financialAccounts.id] }),
    category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
}));

export const relations = {
    usersRelations,
    sessionsRelations,
    accountsRelations,
    financialAccountsRelations,
    categoriesRelations,
    transactionsRelations,
};
