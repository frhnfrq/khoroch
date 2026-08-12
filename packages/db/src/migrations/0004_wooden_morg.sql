ALTER TABLE "accounts" ADD COLUMN "opening_balance_at" timestamp with time zone;--> statement-breakpoint
UPDATE "accounts" SET "opening_balance_at" = "created_at";--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "opening_balance_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "opening_balance_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_items" ADD COLUMN "prior_spent_amount" numeric(16, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_entries" ADD COLUMN "affects_balance" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_prior_spent_amount_nonnegative" CHECK ("budget_items"."prior_spent_amount" >= 0);
