CREATE TYPE "public"."recurrence_end_mode" AS ENUM('never', 'on_date');--> statement-breakpoint
CREATE TYPE "public"."schedule_frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TABLE "recurring_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"transaction_type" "transaction_type" NOT NULL,
	"frequency" "schedule_frequency" NOT NULL,
	"end_mode" "recurrence_end_mode" DEFAULT 'never' NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" "currency_code" NOT NULL,
	"notes" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"last_generated_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduled_occurrences" ADD COLUMN "recurring_rule_id" uuid;--> statement-breakpoint
ALTER TABLE "scheduled_occurrences" ADD COLUMN "sequence" integer;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_rules_user_active_next_idx" ON "recurring_rules" USING btree ("user_id","is_active","starts_at") WHERE "recurring_rules"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "recurring_rules_account_idx" ON "recurring_rules" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "recurring_rules_category_idx" ON "recurring_rules" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "scheduled_occurrences" ADD CONSTRAINT "scheduled_occurrences_recurring_rule_id_recurring_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_occurrences_rule_date_idx" ON "scheduled_occurrences" USING btree ("recurring_rule_id","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_occurrences_rule_sequence_idx" ON "scheduled_occurrences" USING btree ("recurring_rule_id","sequence") WHERE "scheduled_occurrences"."recurring_rule_id" is not null;