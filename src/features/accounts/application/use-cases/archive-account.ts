import type { AccountRepository } from "../../domain/account-repository";

export class ArchiveAccountUseCase {
    constructor(private readonly accounts: AccountRepository) {}

    async execute(userId: string, accountId: string) {
        return this.accounts.archive(userId, accountId);
    }
}
