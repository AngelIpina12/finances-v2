import { buildAccountRecord } from "../../domain/account-rules";
import type { AccountInput, AccountRepository } from "../../domain/account-repository";

export class CreateAccountUseCase {
    constructor(private readonly accounts: AccountRepository) {}

    async execute(userId: string, input: AccountInput) {
        await this.accounts.create(userId, buildAccountRecord(input));
    }
}
