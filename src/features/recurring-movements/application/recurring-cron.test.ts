import { describe, expect, it, vi } from "vitest";
import { hasValidCronSecret, runRecurringCron } from "./recurring-cron";

function logger() {
    return {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
}

describe("hasValidCronSecret", () => {
    it("acepta únicamente el bearer token exacto", () => {
        expect(hasValidCronSecret("Bearer correct-secret", "correct-secret")).toBe(true);
        expect(hasValidCronSecret("Bearer wrong-secret-x", "correct-secret")).toBe(false);
        expect(hasValidCronSecret("Basic correct-secret", "correct-secret")).toBe(false);
        expect(hasValidCronSecret(null, "correct-secret")).toBe(false);
        expect(hasValidCronSecret("Bearer correct-secret", undefined)).toBe(false);
    });
});

describe("runRecurringCron", () => {
    it("rechaza peticiones sin autorización y no ejecuta el generador", async () => {
        const executeForAllUsers = vi.fn();
        const cronLogger = logger();

        const response = await runRecurringCron(
            new Request("http://localhost/api/internal/recurring/generate"),
            {
                generator: { executeForAllUsers },
                secret: "correct-secret",
                logger: cronLogger,
                requestId: () => "execution-1",
            },
        );

        expect(response.status).toBe(401);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toEqual({
            error: "No autorizado.",
            executionId: "execution-1",
        });
        expect(executeForAllUsers).not.toHaveBeenCalled();
        expect(cronLogger.warn).toHaveBeenCalledOnce();
    });

    it("reporta reglas, ocurrencias, fecha e identificador de ejecución", async () => {
        const generatedAt = new Date("2026-09-03T14:00:00.000Z");
        const executeForAllUsers = vi.fn().mockResolvedValue({
            processedRules: 4,
            generated: 12,
        });
        const cronLogger = logger();
        const request = new Request("http://localhost/api/internal/recurring/generate", {
            method: "POST",
            headers: { authorization: "Bearer correct-secret" },
        });

        const response = await runRecurringCron(request, {
            generator: { executeForAllUsers },
            secret: "correct-secret",
            logger: cronLogger,
            now: () => generatedAt,
            requestId: () => "execution-2",
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(body).toMatchObject({
            ok: true,
            executionId: "execution-2",
            processedRules: 4,
            generatedOccurrences: 12,
            generatedAt: generatedAt.toISOString(),
        });
        expect(body.durationMs).toEqual(expect.any(Number));
        expect(executeForAllUsers).toHaveBeenCalledWith(generatedAt);
        expect(cronLogger.info).toHaveBeenCalledOnce();
    });

    it("registra el error sin exponer detalles internos en la respuesta", async () => {
        const cronLogger = logger();
        const request = new Request("http://localhost/api/internal/recurring/generate", {
            headers: { authorization: "Bearer correct-secret" },
        });

        const response = await runRecurringCron(request, {
            generator: {
                executeForAllUsers: vi.fn().mockRejectedValue(new Error("database exploded")),
            },
            secret: "correct-secret",
            logger: cronLogger,
            requestId: () => "execution-3",
        });
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({
            error: "No fue posible generar las ocurrencias.",
            executionId: "execution-3",
        });
        expect(JSON.stringify(body)).not.toContain("database exploded");
        expect(cronLogger.error).toHaveBeenCalledWith(
            "Recurring cron failed.",
            expect.objectContaining({
                executionId: "execution-3",
                error: { name: "Error", message: "database exploded" },
            }),
        );
    });
});
