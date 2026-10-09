import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { loanSimulations } from "@/src/db/schema";
import { LoanSimulationError } from "../application/loan-simulation-error";
import type { LoanTerms } from "../domain/amortization-calculator";
import { loanTermsSchema, type LoanSimulationData } from "../schemas/loan-simulation.schema";

function toRecord(input: LoanSimulationData) {
    const terms: LoanTerms = loanTermsSchema.parse(input);
    return { name: input.name, notes: input.notes || null, terms };
}

export class DrizzleLoanSimulationRepository {
    async list(userId: string) {
        return db
            .select()
            .from(loanSimulations)
            .where(eq(loanSimulations.userId, userId))
            .orderBy(desc(loanSimulations.updatedAt));
    }

    async create(userId: string, input: LoanSimulationData) {
        const [simulation] = await db
            .insert(loanSimulations)
            .values({ userId, ...toRecord(input) })
            .returning({ id: loanSimulations.id });
        return simulation.id;
    }

    async update(userId: string, simulationId: string, input: LoanSimulationData) {
        const updated = await db
            .update(loanSimulations)
            .set(toRecord(input))
            .where(and(eq(loanSimulations.id, simulationId), eq(loanSimulations.userId, userId)))
            .returning({ id: loanSimulations.id });
        if (!updated.length) throw new LoanSimulationError("No puedes editar esta simulación.");
    }

    async delete(userId: string, simulationId: string) {
        const deleted = await db
            .delete(loanSimulations)
            .where(and(eq(loanSimulations.id, simulationId), eq(loanSimulations.userId, userId)))
            .returning({ id: loanSimulations.id });
        if (!deleted.length) throw new LoanSimulationError("No puedes eliminar esta simulación.");
    }
}
