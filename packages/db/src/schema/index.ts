import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("account_type", [
  "cash",
  "bank",
  "mobile_wallet",
  "savings",
  "credit_card",
  "other",
]);

export const categoryKindEnum = pgEnum("category_kind", ["expense", "income"]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "expense",
  "income",
  "transfer",
  "adjustment",
  "refund",
]);

export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "cleared", "void"]);

export const budgetStatusEnum = pgEnum("budget_status", ["active", "archived"]);

export const fundingBucketTypeEnum = pgEnum("funding_bucket_type", [
  "salary",
  "freelance",
  "bonus",
  "gift",
  "loan",
  "other",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    type: accountTypeEnum("type").notNull(),
    currency: text("currency").notNull().default("BDT"),
    openingBalance: numeric("opening_balance", {
      precision: 16,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    icon: text("icon").notNull().default("wallet"),
    color: text("color").notNull().default("violet"),
    isArchived: boolean("is_archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index("accounts_user_active_idx").on(table.userId, table.isArchived),
    index("accounts_user_sort_idx").on(table.userId, table.sortOrder),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    kind: categoryKindEnum("kind").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    icon: text("icon").notNull().default("circle-dot"),
    color: text("color").notNull().default("slate"),
    isSystem: boolean("is_system").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index("categories_user_kind_idx").on(table.userId, table.kind, table.isArchived),
    index("categories_parent_idx").on(table.parentId),
    uniqueIndex("categories_user_kind_root_name_uidx")
      .on(table.userId, table.kind, sql`lower(${table.name})`)
      .where(sql`${table.parentId} is null and ${table.deletedAt} is null`),
    uniqueIndex("categories_user_kind_parent_name_uidx")
      .on(table.userId, table.kind, table.parentId, sql`lower(${table.name})`)
      .where(sql`${table.parentId} is not null and ${table.deletedAt} is null`),
  ],
);

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  defaultCurrency: text("default_currency").notNull().default("BDT"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fundingBuckets = pgTable(
  "funding_buckets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    type: fundingBucketTypeEnum("type").notNull().default("other"),
    periodStart: date("period_start", { mode: "string" }),
    periodEnd: date("period_end", { mode: "string" }),
    isArchived: boolean("is_archived").notNull().default(false),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [index("funding_buckets_user_idx").on(table.userId, table.isArchived)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    clientRequestId: text("client_request_id"),
    type: transactionTypeEnum("type").notNull(),
    status: transactionStatusEnum("status").notNull().default("cleared"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    title: text("title").notNull(),
    payee: text("payee"),
    note: text("note"),
    parentTransactionId: uuid("parent_transaction_id").references(
      (): AnyPgColumn => transactions.id,
      { onDelete: "set null" },
    ),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index("transactions_user_date_idx").on(table.userId, table.occurredAt),
    index("transactions_user_type_idx").on(table.userId, table.type),
    index("transactions_parent_idx").on(table.parentTransactionId),
    uniqueIndex("transactions_user_client_request_uidx")
      .on(table.userId, table.clientRequestId)
      .where(sql`${table.clientRequestId} is not null`),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    currency: text("currency").notNull().default("BDT"),
    rollover: boolean("rollover").notNull().default(false),
    status: budgetStatusEnum("status").notNull().default("active"),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index("budgets_user_period_idx").on(table.userId, table.periodStart, table.periodEnd),
    uniqueIndex("budgets_user_period_active_uidx")
      .on(table.userId, table.periodStart, table.periodEnd)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const budgetItems = pgTable(
  "budget_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    parentId: uuid("parent_id").references((): AnyPgColumn => budgetItems.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    plannedAmount: numeric("planned_amount", {
      precision: 16,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index("budget_items_budget_idx").on(table.budgetId, table.sortOrder),
    index("budget_items_category_idx").on(table.userId, table.categoryId),
    index("budget_items_parent_idx").on(table.parentId),
    check("budget_items_planned_amount_nonnegative", sql`${table.plannedAmount} >= 0`),
  ],
);

export const transactionEntries = pgTable(
  "transaction_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    budgetItemId: uuid("budget_item_id").references(() => budgetItems.id, {
      onDelete: "set null",
    }),
    fundingBucketId: uuid("funding_bucket_id").references(() => fundingBuckets.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 16, scale: 2, mode: "number" }).notNull(),
    memo: text("memo"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("transaction_entries_transaction_idx").on(table.transactionId, table.sortOrder),
    index("transaction_entries_account_idx").on(table.userId, table.accountId),
    index("transaction_entries_category_idx").on(table.userId, table.categoryId),
    index("transaction_entries_budget_idx").on(table.userId, table.budgetItemId),
    index("transaction_entries_funding_idx").on(table.userId, table.fundingBucketId),
    check("transaction_entries_amount_nonzero", sql`${table.amount} <> 0`),
  ],
);

export const accountsRelations = relations(accounts, ({ many }) => ({
  entries: many(transactionEntries),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryTree",
  }),
  children: many(categories, { relationName: "categoryTree" }),
  entries: many(transactionEntries),
  budgetItems: many(budgetItems),
}));

export const fundingBucketsRelations = relations(fundingBuckets, ({ many }) => ({
  entries: many(transactionEntries),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  parent: one(transactions, {
    fields: [transactions.parentTransactionId],
    references: [transactions.id],
    relationName: "transactionTree",
  }),
  children: many(transactions, { relationName: "transactionTree" }),
  entries: many(transactionEntries),
}));

export const budgetsRelations = relations(budgets, ({ many }) => ({
  items: many(budgetItems),
}));

export const budgetItemsRelations = relations(budgetItems, ({ one, many }) => ({
  budget: one(budgets, {
    fields: [budgetItems.budgetId],
    references: [budgets.id],
  }),
  category: one(categories, {
    fields: [budgetItems.categoryId],
    references: [categories.id],
  }),
  parent: one(budgetItems, {
    fields: [budgetItems.parentId],
    references: [budgetItems.id],
    relationName: "budgetTree",
  }),
  children: many(budgetItems, { relationName: "budgetTree" }),
  entries: many(transactionEntries),
}));

export const transactionEntriesRelations = relations(transactionEntries, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionEntries.transactionId],
    references: [transactions.id],
  }),
  account: one(accounts, {
    fields: [transactionEntries.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [transactionEntries.categoryId],
    references: [categories.id],
  }),
  budgetItem: one(budgetItems, {
    fields: [transactionEntries.budgetItemId],
    references: [budgetItems.id],
  }),
  fundingBucket: one(fundingBuckets, {
    fields: [transactionEntries.fundingBucketId],
    references: [fundingBuckets.id],
  }),
}));

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type TransactionEntry = typeof transactionEntries.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type BudgetItem = typeof budgetItems.$inferSelect;
export type FundingBucket = typeof fundingBuckets.$inferSelect;
