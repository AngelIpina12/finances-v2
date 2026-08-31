import { buildAccountRecord } from "../../domain/account-rules";
import type { AccountInput, AccountRepository } from "../../domain/account-repository";

export class UpdateAccountUseCase {
    constructor(private readonly accounts: AccountRepository) {}

    async execute(userId: string, accountId: string, input: AccountInput) {
        return this.accounts.update(userId, accountId, buildAccountRecord(input));
    }
}
