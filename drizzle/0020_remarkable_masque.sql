ALTER TABLE "fixed_income_positions" ALTER COLUMN "account_id" DROP NOT NULL;
--> statement-breakpoint
UPDATE "financial_accounts" AS funding
SET "current_balance" = funding."current_balance" + position."outstanding_principal"
FROM "fixed_income_positions" AS position
WHERE position."funding_account_id" = funding."id"
  AND position."account_id" IS NOT NULL
  AND position."is_available_on_demand" = true;
--> statement-breakpoint
UPDATE "fixed_income_positions" AS position
SET "outstanding_principal" = position."outstanding_principal" + coalesce((
    SELECT sum(flow."net_amount")
    FROM "fixed_income_cash_flows" AS flow
    WHERE flow."position_id" = position."id"
      AND flow."type" = 'interest'
), 0)
WHERE position."account_id" IS NOT NULL
  AND position."is_available_on_demand" = true;
--> statement-breakpoint
UPDATE "financial_accounts" AS internal_account
SET "is_active" = false,
    "deleted_at" = now()
FROM "fixed_income_positions" AS position
WHERE position."account_id" = internal_account."id"
  AND position."is_available_on_demand" = true;
--> statement-breakpoint
UPDATE "fixed_income_positions"
SET "account_id" = NULL
WHERE "account_id" IS NOT NULL
  AND "is_available_on_demand" = true;
