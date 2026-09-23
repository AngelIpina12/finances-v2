CREATE TYPE "public"."fixed_income_calculation_method" AS ENUM('simple', 'compound');--> statement-breakpoint
CREATE TYPE "public"."fixed_income_cash_flow_type" AS ENUM('contribution', 'interest', 'withholding', 'withdrawal', 'maturity');--> statement-breakpoint
CREATE TYPE "public"."fixed_income_day_count_convention" AS ENUM('actual_360', 'actual_365');--> statement-breakpoint
CREATE TYPE "public"."fixed_income_interest_frequency" AS ENUM('daily', 'monthly', 'at_maturity');--> statement-breakpoint
CREATE TYPE "public"."fixed_income_status" AS ENUM('planned', 'active', 'matured', 'settled', 'cancelled');--> statement-breakpoint
CREATE TABLE "fixed_income_cash_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_id" uuid NOT NULL,
	"type" "fixed_income_cash_flow_type" NOT NULL,
	"gross_amount" numeric(15, 2) NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(15, 2) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"transaction_id" uuid,
	"transfer_group_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_income_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"funding_account_id" uuid NOT NULL,
	"settlement_account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"institution" text,
	"currency" "currency_code" NOT NULL,
	"principal" numeric(15, 2) NOT NULL,
	"outstanding_principal" numeric(15, 2) NOT NULL,
	"annual_rate" numeric(10, 8) NOT NULL,
	"calculation_method" "fixed_income_calculation_method" DEFAULT 'simple' NOT NULL,
	"day_count_convention" "fixed_income_day_count_convention" DEFAULT 'actual_365' NOT NULL,
	"interest_frequency" "fixed_income_interest_frequency" DEFAULT 'at_maturity' NOT NULL,
	"withholding_rate" numeric(10, 8),
	"starts_at" timestamp with time zone NOT NULL,
	"matures_at" timestamp with time zone NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"status" "fixed_income_status" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fixed_income_cash_flows" ADD CONSTRAINT "fixed_income_cash_flows_position_id_fixed_income_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."fixed_income_positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_cash_flows" ADD CONSTRAINT "fixed_income_cash_flows_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_positions" ADD CONSTRAINT "fixed_income_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_positions" ADD CONSTRAINT "fixed_income_positions_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_positions" ADD CONSTRAINT "fixed_income_positions_funding_account_id_financial_accounts_id_fk" FOREIGN KEY ("funding_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_positions" ADD CONSTRAINT "fixed_income_positions_settlement_account_id_financial_accounts_id_fk" FOREIGN KEY ("settlement_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_income_cash_flows_position_idempotency_idx" ON "fixed_income_cash_flows" USING btree ("position_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "fixed_income_cash_flows_position_date_idx" ON "fixed_income_cash_flows" USING btree ("position_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_income_positions_account_idx" ON "fixed_income_positions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "fixed_income_positions_user_status_idx" ON "fixed_income_positions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "fixed_income_positions_user_maturity_idx" ON "fixed_income_positions" USING btree ("user_id","matures_at");