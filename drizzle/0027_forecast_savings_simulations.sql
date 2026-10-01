CREATE TABLE "forecast_savings_simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"account_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"minimum_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forecast_savings_simulations" ADD CONSTRAINT "forecast_savings_simulations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_savings_simulations" ADD CONSTRAINT "forecast_savings_simulations_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_savings_simulations" ADD CONSTRAINT "forecast_savings_simulations_position_id_fixed_income_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."fixed_income_positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forecast_savings_simulations_user_idx" ON "forecast_savings_simulations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "forecast_savings_simulations_default_idx" ON "forecast_savings_simulations" USING btree ("user_id") WHERE "forecast_savings_simulations"."is_default";