DROP INDEX "categories_user_type_name_idx";--> statement-breakpoint
DROP INDEX "categories_user_sort_order_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_type_name_idx" ON "categories" USING btree ("user_id","type","name") WHERE "categories"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "categories_user_sort_order_idx" ON "categories" USING btree ("user_id","type","sort_order") WHERE "categories"."deleted_at" is null;