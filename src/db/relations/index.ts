import { relations as drizzleRelations } from "drizzle-orm";
import { users, sessions, accounts } from "../schema/auth";

export const usersRelations = drizzleRelations(users, ({ many }) => ({
    sessions: many(sessions),
    accounts: many(accounts)
}));

export const sessionsRelations = drizzleRelations(sessions, ({ one }) => ({
    user: one(users, { fields: [sessions.userId], references: [users.id] })
}));

export const accountsRelations = drizzleRelations(accounts, ({ one }) => ({
    user: one(users, { fields: [accounts.userId], references: [users.id] })
}));

export const relations = {
    usersRelations,
    sessionsRelations,
    accountsRelations
};