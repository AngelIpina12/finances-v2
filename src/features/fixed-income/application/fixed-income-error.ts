export class FixedIncomeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "FixedIncomeError";
    }
}
