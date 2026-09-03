CREATE TYPE "public"."fifth_occurrence_policy" AS ENUM('keep_fixed', 'distribute_monthly_total', 'custom_amount');--> statement-breakpoint
CREATE TYPE "public"."recurrence_amount_strategy" AS ENUM('fixed', 'period_total', 'custom_per_occurrence');--> statement-breakpoint
ALTER TYPE "public"."schedule_frequency" ADD VALUE 'semimonthly' BEFORE 'monthly';--> statement-breakpoint
ALTER TYPE "public"."schedule_frequency" ADD VALUE 'custom';--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD COLUMN "amount_strategy" "recurrence_amount_strategy" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD COLUMN "fifth_occurrence_policy" "fifth_occurrence_policy" DEFAULT 'keep_fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD COLUMN "period_total" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD COLUMN "fifth_occurrence_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD COLUMN "semimonthly_first_day" integer;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD COLUMN "semimonthly_second_day" integer;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD COLUMN "calendar_entries" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD COLUMN "date_overrides" jsonb DEFAULT '[]'::jsonb NOT NULL;