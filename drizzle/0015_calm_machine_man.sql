CREATE TABLE "credit_card_payment_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"credit_account_id" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_card_payment_dismissals" ADD CONSTRAINT "credit_card_payment_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_payment_dismissals" ADD CONSTRAINT "credit_card_payment_dismissals_credit_account_id_financial_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_card_payment_dismissals_card_due_idx" ON "credit_card_payment_dismissals" USING btree ("credit_account_id","due_at");--> statement-breakpoint
CREATE INDEX "credit_card_payment_dismissals_user_idx" ON "credit_card_payment_dismissals" USING btree ("user_id");