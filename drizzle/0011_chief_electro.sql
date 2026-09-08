CREATE TYPE "public"."credit_card_payment_strategy" AS ENUM('full_statement', 'minimum_payment', 'fixed_amount', 'manual');--> statement-breakpoint
CREATE TABLE "credit_card_payment_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"credit_account_id" uuid NOT NULL,
	"source_account_id" uuid NOT NULL,
	"strategy" "credit_card_payment_strategy" DEFAULT 'full_statement' NOT NULL,
	"fixed_amount" numeric(15, 2),
	"payment_term_days" integer DEFAULT 20 NOT NULL,
	"include_in_forecast" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD COLUMN "include_in_liquidity" boolean DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE "financial_accounts"
SET "include_in_liquidity" = "type" IN ('cash', 'debit', 'wallet');--> statement-breakpoint
ALTER TABLE "credit_card_payment_settings" ADD CONSTRAINT "credit_card_payment_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_payment_settings" ADD CONSTRAINT "credit_card_payment_settings_credit_account_id_financial_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_payment_settings" ADD CONSTRAINT "credit_card_payment_settings_source_account_id_financial_accounts_id_fk" FOREIGN KEY ("source_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_card_payment_settings_credit_account_idx" ON "credit_card_payment_settings" USING btree ("credit_account_id");--> statement-breakpoint
CREATE INDEX "credit_card_payment_settings_user_idx" ON "credit_card_payment_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_card_payment_settings_source_account_idx" ON "credit_card_payment_settings" USING btree ("source_account_id");
