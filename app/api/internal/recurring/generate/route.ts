import { runRecurringCron } from "@/src/features/recurring-movements/application/recurring-cron";
import { GenerateRecurringOccurrencesUseCase } from "@/src/features/recurring-movements/application/use-cases/generate-recurring-occurrences";
import { DrizzleRecurringRuleRepository } from "@/src/features/recurring-movements/infrastructure/drizzle-recurring-rule-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const generator = new GenerateRecurringOccurrencesUseCase(
    new DrizzleRecurringRuleRepository(),
);

async function generate(request: Request) {
    return runRecurringCron(request, {
        generator,
        secret: process.env.CRON_SECRET,
    });
}

export async function GET(request: Request) {
    return generate(request);
}

export async function POST(request: Request) {
    return generate(request);
}
