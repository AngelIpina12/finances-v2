export class FinancingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "FinancingError";
    }
}
