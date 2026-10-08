ALTER TABLE "forecast_savings_simulations" DROP CONSTRAINT "forecast_savings_simulations_account_id_financial_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "forecast_savings_simulations" DROP CONSTRAINT "forecast_savings_simulations_position_id_fixed_income_positions_id_fk";
--> statement-breakpoint
ALTER TABLE "forecast_savings_simulations" DROP COLUMN "account_id";--> statement-breakpoint
ALTER TABLE "forecast_savings_simulations" DROP COLUMN "position_id";--> statement-breakpoint
ALTER TABLE "forecast_savings_simulations" DROP COLUMN "minimum_balance";