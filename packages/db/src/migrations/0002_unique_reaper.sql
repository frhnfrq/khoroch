CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"default_currency" text DEFAULT 'BDT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TEMP TABLE "category_duplicate_map" (
	"duplicate_id" uuid PRIMARY KEY,
	"canonical_id" uuid NOT NULL
);
--> statement-breakpoint
DO $$
DECLARE
	duplicate_count integer;
BEGIN
	LOOP
		DELETE FROM "category_duplicate_map";

		INSERT INTO "category_duplicate_map" ("duplicate_id", "canonical_id")
		SELECT "id", "canonical_id"
		FROM (
			SELECT
				"id",
				first_value("id") OVER (
					PARTITION BY "user_id", "kind", "parent_id", lower("name")
					ORDER BY "is_system" DESC, "created_at", "id"
				) AS "canonical_id",
				row_number() OVER (
					PARTITION BY "user_id", "kind", "parent_id", lower("name")
					ORDER BY "is_system" DESC, "created_at", "id"
				) AS "duplicate_rank"
			FROM "categories"
			WHERE "deleted_at" IS NULL
		) AS "ranked_categories"
		WHERE "duplicate_rank" > 1;

		GET DIAGNOSTICS duplicate_count = ROW_COUNT;
		EXIT WHEN duplicate_count = 0;

		UPDATE "transaction_entries"
		SET "category_id" = "category_duplicate_map"."canonical_id"
		FROM "category_duplicate_map"
		WHERE "transaction_entries"."category_id" = "category_duplicate_map"."duplicate_id";

		UPDATE "budget_items"
		SET "category_id" = "category_duplicate_map"."canonical_id"
		FROM "category_duplicate_map"
		WHERE "budget_items"."category_id" = "category_duplicate_map"."duplicate_id";

		UPDATE "categories"
		SET "parent_id" = "category_duplicate_map"."canonical_id"
		FROM "category_duplicate_map"
		WHERE "categories"."parent_id" = "category_duplicate_map"."duplicate_id";

		DELETE FROM "categories"
		USING "category_duplicate_map"
		WHERE "categories"."id" = "category_duplicate_map"."duplicate_id";
	END LOOP;
END $$;
--> statement-breakpoint
DROP TABLE "category_duplicate_map";
--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_kind_root_name_uidx" ON "categories" USING btree ("user_id","kind",lower("name")) WHERE "categories"."parent_id" is null and "categories"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_kind_parent_name_uidx" ON "categories" USING btree ("user_id","kind","parent_id",lower("name")) WHERE "categories"."parent_id" is not null and "categories"."deleted_at" is null;
