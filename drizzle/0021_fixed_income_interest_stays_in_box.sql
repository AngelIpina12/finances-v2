UPDATE "financial_accounts" AS settlement
SET "current_balance" = settlement."current_balance" - confirmed_interest."net_amount"
FROM (
    SELECT
        position."settlement_account_id" AS account_id,
        sum(flow."net_amount") AS net_amount
    FROM "fixed_income_cash_flows" AS flow
    INNER JOIN "fixed_income_positions" AS position
        ON position."id" = flow."position_id"
    WHERE flow."type" = 'interest'
      AND flow."transaction_id" IS NOT NULL
      AND position."account_id" IS NULL
    GROUP BY position."settlement_account_id"
) AS confirmed_interest
WHERE settlement."id" = confirmed_interest."account_id";
--> statement-breakpoint
UPDATE "fixed_income_cash_flows"
SET "transaction_id" = NULL
WHERE "type" = 'interest'
  AND "transaction_id" IS NOT NULL;
--> statement-breakpoint
DELETE FROM "transactions"
WHERE "merchant" LIKE 'Rendimiento:%'
  AND "type" = 'income';
