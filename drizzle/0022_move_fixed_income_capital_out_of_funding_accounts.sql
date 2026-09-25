UPDATE "financial_accounts" AS funding
SET "current_balance" = funding."current_balance" - position."principal"
FROM "fixed_income_positions" AS position
WHERE position."funding_account_id" = funding."id"
  AND position."account_id" IS NULL
  AND position."status" IN ('active', 'matured');
