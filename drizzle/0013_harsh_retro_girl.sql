ALTER TABLE "budgets" ADD COLUMN "forecast_account_id" uuid;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "include_in_forecast" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_forecast_account_id_financial_accounts_id_fk" FOREIGN KEY ("forecast_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;
