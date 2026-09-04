CREATE TYPE "public"."financing_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "financing_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"financing_plan_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"is_balloon" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone,
	"payment_transfer_group_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"credit_account_id" uuid NOT NULL,
	"purchase_transaction_id" uuid NOT NULL,
	"name" text NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"regular_installment_count" integer NOT NULL,
	"regular_installment_amount" numeric(15, 2) NOT NULL,
	"balloon_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" "currency_code" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"status" "financing_status" DEFAULT 'active' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduled_occurrences" ADD COLUMN "financing_installment_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "financing_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "financing_installment_id" uuid;--> statement-breakpoint
ALTER TABLE "financing_installments" ADD CONSTRAINT "financing_installments_financing_plan_id_financing_plans_id_fk" FOREIGN KEY ("financing_plan_id") REFERENCES "public"."financing_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_plans" ADD CONSTRAINT "financing_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_plans" ADD CONSTRAINT "financing_plans_credit_account_id_financial_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_plans" ADD CONSTRAINT "financing_plans_purchase_transaction_id_transactions_id_fk" FOREIGN KEY ("purchase_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_occurrences" ADD CONSTRAINT "scheduled_occurrences_financing_installment_id_financing_installments_id_fk" FOREIGN KEY ("financing_installment_id") REFERENCES "public"."financing_installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_financing_plan_id_financing_plans_id_fk" FOREIGN KEY ("financing_plan_id") REFERENCES "public"."financing_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_financing_installment_id_financing_installments_id_fk" FOREIGN KEY ("financing_installment_id") REFERENCES "public"."financing_installments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financing_installments_plan_sequence_idx" ON "financing_installments" USING btree ("financing_plan_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "financing_installments_payment_transfer_idx" ON "financing_installments" USING btree ("payment_transfer_group_id") WHERE "financing_installments"."payment_transfer_group_id" is not null;--> statement-breakpoint
CREATE INDEX "financing_installments_plan_date_idx" ON "financing_installments" USING btree ("financing_plan_id","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "financing_plans_purchase_transaction_idx" ON "financing_plans" USING btree ("purchase_transaction_id");--> statement-breakpoint
CREATE INDEX "financing_plans_user_status_idx" ON "financing_plans" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "financing_plans_credit_account_idx" ON "financing_plans" USING btree ("credit_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_occurrences_financing_installment_idx" ON "scheduled_occurrences" USING btree ("financing_installment_id") WHERE "scheduled_occurrences"."financing_installment_id" is not null;--> statement-breakpoint
CREATE INDEX "transactions_financing_plan_idx" ON "transactions" USING btree ("financing_plan_id");--> statement-breakpoint
CREATE INDEX "transactions_financing_installment_idx" ON "transactions" USING btree ("financing_installment_id");
