import { DrizzleLoanSimulationRepository } from "../infrastructure/drizzle-loan-simulation-repository";

const repository = new DrizzleLoanSimulationRepository();

export async function getLoanSimulationsData(userId: string) {
    const simulations = await repository.list(userId);
    return {
        simulations: simulations.map((simulation) => ({
            id: simulation.id,
            name: simulation.name,
            currency: simulation.currency,
            notes: simulation.notes,
            terms: simulation.terms,
            updatedAt: simulation.updatedAt,
        })),
    };
}

export type LoanSimulationsData = Awaited<ReturnType<typeof getLoanSimulationsData>>;
export type LoanSimulationItem = LoanSimulationsData["simulations"][number];
