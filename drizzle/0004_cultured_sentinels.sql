CREATE TYPE "public"."occurrence_source" AS ENUM('manual', 'recurring_rule', 'financing_installment');--> statement-breakpoint
CREATE TYPE "public"."occurrence_status" AS ENUM('scheduled', 'completed', 'skipped', 'cancelled');--> statement-breakpoint
CREATE TABLE "scheduled_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source" "occurrence_source" DEFAULT 'manual' NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"transaction_type" "transaction_type" NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" "currency_code" NOT NULL,
	"notes" text,
	"original_scheduled_at" timestamp with time zone NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	"status" "occurrence_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "scheduled_occurrence_id" uuid;--> statement-breakpoint
ALTER TABLE "scheduled_occurrences" ADD CONSTRAINT "scheduled_occurrences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_occurrences" ADD CONSTRAINT "scheduled_occurrences_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_occurrences" ADD CONSTRAINT "scheduled_occurrences_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_occurrences_user_status_date_idx" ON "scheduled_occurrences" USING btree ("user_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "scheduled_occurrences_account_idx" ON "scheduled_occurrences" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "scheduled_occurrences_category_idx" ON "scheduled_occurrences" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_scheduled_occurrence_id_scheduled_occurrences_id_fk" FOREIGN KEY ("scheduled_occurrence_id") REFERENCES "public"."scheduled_occurrences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_scheduled_occurrence_idx" ON "transactions" USING btree ("scheduled_occurrence_id") WHERE "transactions"."scheduled_occurrence_id" is not null;