CREATE TYPE "public"."account_type" AS ENUM('cash', 'bank', 'mobile_wallet', 'savings', 'credit_card', 'other');--> statement-breakpoint
CREATE TYPE "public"."budget_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TYPE "public"."funding_bucket_type" AS ENUM('salary', 'freelance', 'bonus', 'gift', 'loan', 'other');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'cleared', 'void');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('expense', 'income', 'transfer', 'adjustment', 'refund');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"currency" text DEFAULT 'BDT' NOT NULL,
	"opening_balance" numeric(16, 2) DEFAULT 0 NOT NULL,
	"icon" text DEFAULT 'wallet' NOT NULL,
	"color" text DEFAULT 'violet' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "budget_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"budget_id" uuid NOT NULL,
	"category_id" uuid,
	"parent_id" uuid,
	"name" text NOT NULL,
	"planned_amount" numeric(16, 2) DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "budget_items_planned_amount_nonnegative" CHECK ("budget_items"."planned_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"currency" text DEFAULT 'BDT' NOT NULL,
	"rollover" boolean DEFAULT false NOT NULL,
	"status" "budget_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "category_kind" NOT NULL,
	"parent_id" uuid,
	"icon" text DEFAULT 'circle-dot' NOT NULL,
	"color" text DEFAULT 'slate' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "funding_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "funding_bucket_type" DEFAULT 'other' NOT NULL,
	"period_start" date,
	"period_end" date,
	"is_archived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transaction_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"budget_item_id" uuid,
	"funding_bucket_id" uuid,
	"amount" numeric(16, 2) NOT NULL,
	"memo" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_entries_amount_nonzero" CHECK ("transaction_entries"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"client_request_id" text,
	"type" "transaction_type" NOT NULL,
	"status" "transaction_status" DEFAULT 'cleared' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"payee" text,
	"note" text,
	"parent_transaction_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_parent_id_budget_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."budget_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_entries" ADD CONSTRAINT "transaction_entries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_entries" ADD CONSTRAINT "transaction_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_entries" ADD CONSTRAINT "transaction_entries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_entries" ADD CONSTRAINT "transaction_entries_budget_item_id_budget_items_id_fk" FOREIGN KEY ("budget_item_id") REFERENCES "public"."budget_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_entries" ADD CONSTRAINT "transaction_entries_funding_bucket_id_funding_buckets_id_fk" FOREIGN KEY ("funding_bucket_id") REFERENCES "public"."funding_buckets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_parent_transaction_id_transactions_id_fk" FOREIGN KEY ("parent_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_active_idx" ON "accounts" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "accounts_user_sort_idx" ON "accounts" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE INDEX "budget_items_budget_idx" ON "budget_items" USING btree ("budget_id","sort_order");--> statement-breakpoint
CREATE INDEX "budget_items_category_idx" ON "budget_items" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE INDEX "budget_items_parent_idx" ON "budget_items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "budgets_user_period_idx" ON "budgets" USING btree ("user_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "categories_user_kind_idx" ON "categories" USING btree ("user_id","kind","is_archived");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "funding_buckets_user_idx" ON "funding_buckets" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "transaction_entries_transaction_idx" ON "transaction_entries" USING btree ("transaction_id","sort_order");--> statement-breakpoint
CREATE INDEX "transaction_entries_account_idx" ON "transaction_entries" USING btree ("user_id","account_id");--> statement-breakpoint
CREATE INDEX "transaction_entries_category_idx" ON "transaction_entries" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE INDEX "transaction_entries_budget_idx" ON "transaction_entries" USING btree ("user_id","budget_item_id");--> statement-breakpoint
CREATE INDEX "transaction_entries_funding_idx" ON "transaction_entries" USING btree ("user_id","funding_bucket_id");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "transactions_user_type_idx" ON "transactions" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "transactions_parent_idx" ON "transactions" USING btree ("parent_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_user_client_request_uidx" ON "transactions" USING btree ("user_id","client_request_id") WHERE "transactions"."client_request_id" is not null;