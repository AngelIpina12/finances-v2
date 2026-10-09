export class LoanSimulationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LoanSimulationError";
    }
}
