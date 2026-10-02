CREATE TABLE "forecast_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"range_preset_days" integer,
	"starts_on" date,
	"ends_on" date,
	"currency" text DEFAULT 'all' NOT NULL,
	"account_kind" text DEFAULT 'all' NOT NULL,
	"account_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"granularity" text DEFAULT 'week' NOT NULL,
	"savings_mode" text DEFAULT 'exclude' NOT NULL,
	"chart_view" text DEFAULT 'balance' NOT NULL,
	"savings_simulation_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forecast_views" ADD CONSTRAINT "forecast_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_views" ADD CONSTRAINT "forecast_views_savings_simulation_id_forecast_savings_simulations_id_fk" FOREIGN KEY ("savings_simulation_id") REFERENCES "public"."forecast_savings_simulations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forecast_views_user_idx" ON "forecast_views" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "forecast_views_default_idx" ON "forecast_views" USING btree ("user_id") WHERE "forecast_views"."is_default";