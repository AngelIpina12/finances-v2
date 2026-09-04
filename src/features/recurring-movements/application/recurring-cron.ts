import { timingSafeEqual } from "node:crypto";

export type RecurringCronResult = {
    processedRules: number;
    generated: number;
};

export interface RecurringCronGenerator {
    executeForAllUsers(now?: Date): Promise<RecurringCronResult>;
}

export interface RecurringCronLogger {
    info(message: string, context: Record<string, unknown>): void;
    warn(message: string, context: Record<string, unknown>): void;
    error(message: string, context: Record<string, unknown>): void;
}

type RecurringCronDependencies = {
    generator: RecurringCronGenerator;
    secret?: string;
    logger?: RecurringCronLogger;
    now?: () => Date;
    requestId?: () => string;
};

export function hasValidCronSecret(authorization: string | null, secret?: string) {
    if (!secret || !authorization?.startsWith("Bearer ")) {
        return false;
    }

    const supplied = authorization.slice("Bearer ".length);
    const expectedBuffer = Buffer.from(secret);
    const suppliedBuffer = Buffer.from(supplied);

    return expectedBuffer.length === suppliedBuffer.length
        && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function noStoreJson(body: unknown, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    headers.set("Cache-Control", "no-store");

    return Response.json(body, { ...init, headers });
}

export async function runRecurringCron(
    request: Request,
    {
        generator,
        secret,
        logger = console,
        now = () => new Date(),
        requestId = () => crypto.randomUUID(),
    }: RecurringCronDependencies,
) {
    const executionId = requestId();

    if (!hasValidCronSecret(request.headers.get("authorization"), secret)) {
        logger.warn("Recurring cron rejected an unauthorized request.", {
            executionId,
        });
        return noStoreJson({ error: "No autorizado.", executionId }, { status: 401 });
    }

    const startedAt = Date.now();
    const generatedAt = now();

    try {
        const result = await generator.executeForAllUsers(generatedAt);
        const durationMs = Date.now() - startedAt;

        logger.info("Recurring cron completed.", {
            executionId,
            processedRules: result.processedRules,
            generatedOccurrences: result.generated,
            durationMs,
        });

        return noStoreJson({
            ok: true,
            executionId,
            processedRules: result.processedRules,
            generatedOccurrences: result.generated,
            generatedAt: generatedAt.toISOString(),
            durationMs,
        });
    } catch (error) {
        const durationMs = Date.now() - startedAt;

        logger.error("Recurring cron failed.", {
            executionId,
            durationMs,
            error: error instanceof Error
                ? { name: error.name, message: error.message }
                : { name: "UnknownError", message: "Unknown error" },
        });

        return noStoreJson(
            { error: "No fue posible generar las ocurrencias.", executionId },
            { status: 500 },
        );
    }
}
