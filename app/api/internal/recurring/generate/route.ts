import { timingSafeEqual } from "node:crypto";
import { GenerateRecurringOccurrencesUseCase } from "@/src/features/recurring-movements/application/use-cases/generate-recurring-occurrences";
import { DrizzleRecurringRuleRepository } from "@/src/features/recurring-movements/infrastructure/drizzle-recurring-rule-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const generator = new GenerateRecurringOccurrencesUseCase(
    new DrizzleRecurringRuleRepository(),
);

function hasValidSecret(request: Request) {
    const secret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (!secret || !authorization?.startsWith("Bearer ")) {
        return false;
    }

    const supplied = authorization.slice("Bearer ".length);
    const expectedBuffer = Buffer.from(secret);
    const suppliedBuffer = Buffer.from(supplied);

    return expectedBuffer.length === suppliedBuffer.length
        && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

async function generate(request: Request) {
    if (!hasValidSecret(request)) {
        return Response.json({ error: "No autorizado." }, { status: 401 });
    }

    try {
        const result = await generator.executeForAllUsers();

        return Response.json({
            ok: true,
            processedRules: result.processedRules,
            generatedOccurrences: result.generated,
            generatedAt: new Date().toISOString(),
        });
    } catch {
        return Response.json(
            { error: "No fue posible generar las ocurrencias." },
            { status: 500 },
        );
    }
}

export async function GET(request: Request) {
    return generate(request);
}

export async function POST(request: Request) {
    return generate(request);
}
