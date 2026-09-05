import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });
const developmentUrl = process.env.DATABASE_URL;

config({ path: ".env.test", override: true });

const testUrl = process.env.DATABASE_URL_TEST;

if (!testUrl) {
    throw new Error("Define DATABASE_URL_TEST en .env.test antes de ejecutar pruebas de integración.");
}

if (testUrl === developmentUrl) {
    throw new Error("DATABASE_URL_TEST no puede ser la misma base que DATABASE_URL.");
}

const environment = { ...process.env, DATABASE_URL: testUrl };

function run(command: string, args: string[]) {
    const result = spawnSync(command, args, {
        cwd: process.cwd(),
        env: environment,
        stdio: "inherit",
    });

    if (result.status !== 0) process.exit(result.status ?? 1);
}

run("pnpm", ["exec", "drizzle-kit", "migrate"]);
run("pnpm", ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"]);
