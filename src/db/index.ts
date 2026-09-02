import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { APP_TIME_ZONE } from '@/src/shared/constants/date-time';
import * as schema from './schema';
import { relations } from './relations';

const globalForDatabase = globalThis as typeof globalThis & {
    postgresPool?: Pool;
};

const postgresPool = globalForDatabase.postgresPool ?? new Pool({
    connectionString: process.env.DATABASE_URL!,
    options: `-c timezone=${APP_TIME_ZONE}`,
});

if (process.env.NODE_ENV !== "production") {
    globalForDatabase.postgresPool = postgresPool;
}

export const db = drizzle(postgresPool, {
    schema: {
        ...schema,
        ...relations
    }
});
