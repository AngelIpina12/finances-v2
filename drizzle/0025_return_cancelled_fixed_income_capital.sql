UPDATE "financial_accounts" AS funding
SET "current_balance" = funding."current_balance" + withdrawal."net_amount"
FROM "fixed_income_positions" AS position
INNER JOIN "fixed_income_cash_flows" AS withdrawal ON withdrawal."position_id" = position."id"
WHERE funding."id" = position."funding_account_id"
  AND position."account_id" IS NULL
  AND position."status" = 'cancelled'
  AND withdrawal."type" = 'withdrawal'
  AND withdrawal."idempotency_key" = 'cancel:' || position."id";
