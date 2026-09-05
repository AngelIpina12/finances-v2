CREATE TYPE "public"."budget_period" AS ENUM('weekly', 'monthly', 'quarterly', 'yearly', 'custom');--> statement-breakpoint
CREATE TYPE "public"."rollover_type" AS ENUM('disabled', 'carry_remaining', 'carry_deficit');--> statement-breakpoint
CREATE TABLE "budget_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"allocated_amount" numeric(15, 2) NOT NULL,
	"rollover_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency_code" "currency_code" NOT NULL,
	"period" "budget_period" DEFAULT 'monthly' NOT NULL,
	"rollover" "rollover_type" DEFAULT 'disabled' NOT NULL,
	"is_reusable" boolean DEFAULT true NOT NULL,
	"color" text DEFAULT '#2563eb' NOT NULL,
	"warning_threshold" integer DEFAULT 80 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_allocations_budget_category_idx" ON "budget_allocations" USING btree ("budget_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_periods_budget_range_idx" ON "budget_periods" USING btree ("budget_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "budget_periods_budget_start_idx" ON "budget_periods" USING btree ("budget_id","period_start");--> statement-breakpoint
CREATE INDEX "budgets_user_active_idx" ON "budgets" USING btree ("user_id","is_active") WHERE "budgets"."deleted_at" is null;