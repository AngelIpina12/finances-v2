ALTER TABLE "forecast_savings_simulations" ADD COLUMN "rules" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "forecast_savings_simulations"
SET "rules" = jsonb_build_array(jsonb_build_object(
	'accountId', "account_id",
	'positionId', "position_id",
	'minimumBalance', "minimum_balance"::numeric
));
