import { buildAccountRecord } from "../../domain/account-rules";
import type {
    AccountInput, AccountRepository, AccountUpdateRecord,
} from "../../domain/account-repository";

export class UpdateAccountUseCase {
    constructor(private readonly accounts: AccountRepository) {}

    async execute(userId: string, accountId: string, input: AccountInput) {
        const account = buildAccountRecord(input);
        const accountDetails: AccountUpdateRecord = {
            name: account.name,
            type: account.type,
            currency: account.currency,
            institution: account.institution,
            currentBalance: account.currentBalance,
            color: account.color,
            lastFourDigits: account.lastFourDigits,
            includeInNetWorth: account.includeInNetWorth,
            includeInLiquidity: account.includeInLiquidity,
            creditLimit: account.creditLimit,
            billingDate: account.billingDate,
            dueDate: account.dueDate,
        };

        return this.accounts.update(userId, accountId, accountDetails);
    }
}
