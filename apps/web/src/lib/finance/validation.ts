import { z } from "zod";

export const accountTypes = [
  "cash",
  "bank",
  "mobile_wallet",
  "savings",
  "credit_card",
  "other",
] as const;

export const transactionTypes = ["expense", "income", "transfer", "adjustment", "refund"] as const;

export const transactionStatuses = ["pending", "cleared", "void"] as const;

export const fundingBucketTypes = [
  "salary",
  "freelance",
  "bonus",
  "gift",
  "loan",
  "other",
] as const;

export const supportedCurrencies = ["BDT", "USD", "EUR", "GBP", "INR"] as const;

const moneySchema = z
  .number()
  .finite()
  .refine((value) => Math.abs(value) <= 999_999_999_999.99, "Amount is too large")
  .transform((value) => Math.round(value * 100) / 100);

const optionalIdSchema = z
  .uuid()
  .nullish()
  .transform((value) => value ?? null);

export const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(accountTypes),
  currency: z.string().trim().length(3).toUpperCase().default("BDT"),
  openingBalance: moneySchema.default(0),
  icon: z.string().trim().min(1).max(40).default("wallet"),
  color: z.string().trim().min(1).max(30).default("violet"),
});

export const updateAccountSchema = createAccountSchema
  .partial()
  .extend({ isArchived: z.boolean().optional(), version: z.number().int().positive() });

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["expense", "income"]),
  parentId: optionalIdSchema,
  icon: z.string().trim().min(1).max(40).default("circle-dot"),
  color: z.string().trim().min(1).max(30).default("slate"),
});

export const updateUserPreferencesSchema = z.object({
  defaultCurrency: z.enum(supportedCurrencies),
  version: z.number().int().positive().optional(),
});

export const transactionEntrySchema = z.object({
  accountId: z.uuid(),
  categoryId: optionalIdSchema,
  budgetItemId: optionalIdSchema,
  fundingBucketId: optionalIdSchema,
  amount: moneySchema.refine((value) => value !== 0, "Entry amount cannot be zero"),
  memo: z
    .string()
    .trim()
    .max(240)
    .nullish()
    .transform((value) => value || null),
});

export const createTransactionSchema = z
  .object({
    clientRequestId: z
      .string()
      .trim()
      .min(8)
      .max(128)
      .nullish()
      .transform((value) => value || null),
    type: z.enum(transactionTypes),
    status: z.enum(transactionStatuses).default("cleared"),
    occurredAt: z.iso.datetime({ offset: true }),
    title: z.string().trim().min(1).max(120),
    payee: z
      .string()
      .trim()
      .max(120)
      .nullish()
      .transform((value) => value || null),
    note: z
      .string()
      .trim()
      .max(1_000)
      .nullish()
      .transform((value) => value || null),
    parentTransactionId: optionalIdSchema,
    createFundingBucket: z
      .object({
        name: z.string().trim().min(1).max(100),
        type: z.enum(fundingBucketTypes),
        currency: z.enum(supportedCurrencies).default("BDT"),
        periodStart: z.iso
          .date()
          .nullish()
          .transform((value) => value ?? null),
        periodEnd: z.iso
          .date()
          .nullish()
          .transform((value) => value ?? null),
      })
      .nullish()
      .transform((value) => value ?? null),
    entries: z.array(transactionEntrySchema).min(1).max(30),
  })
  .superRefine((value, context) => {
    const amounts = value.entries.map((entry) => entry.amount);
    const hasPositive = amounts.some((amount) => amount > 0);
    const hasNegative = amounts.some((amount) => amount < 0);

    if (value.type === "expense" && hasPositive) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Expenses must reduce an account",
      });
    }
    if ((value.type === "income" || value.type === "refund") && hasNegative) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Income and refunds must increase an account",
      });
    }
    if (value.type === "transfer" && (!hasPositive || !hasNegative)) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Transfers need at least one source and one destination entry",
      });
    }
    if (value.createFundingBucket && value.type !== "income") {
      context.addIssue({
        code: "custom",
        path: ["createFundingBucket"],
        message: "Only income can create a funding bucket",
      });
    }
  });

export const transactionFiltersSchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  minAmount: z.coerce.number().finite().nonnegative().optional(),
  maxAmount: z.coerce.number().finite().nonnegative().optional(),
  categoryId: z.uuid().optional(),
  accountId: z.uuid().optional(),
  budgetId: z.uuid().optional(),
  type: z.enum(transactionTypes).optional(),
  status: z.enum(transactionStatuses).optional(),
  query: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(250).default(100),
  includeSummary: z
    .literal("true")
    .optional()
    .transform((value) => value === "true"),
});

const budgetItemInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  plannedAmount: moneySchema.refine((value) => value >= 0, "Planned amount cannot be negative"),
  priorSpentAmount: moneySchema
    .refine((value) => value >= 0, "Prior spending cannot be negative")
    .default(0),
  categoryId: optionalIdSchema,
  parentClientId: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .nullish()
    .transform((value) => value || null),
  clientId: z.string().trim().min(1).max(80),
});

export const createBudgetSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    currency: z.string().trim().length(3).toUpperCase().default("BDT"),
    rollover: z.boolean().default(false),
    items: z.array(budgetItemInputSchema).min(1).max(100),
  })
  .refine((value) => value.periodStart <= value.periodEnd, {
    path: ["periodEnd"],
    message: "Budget end date must be after its start date",
  });

const editableBudgetItemSchema = budgetItemInputSchema
  .extend({
    id: z.uuid().nullish(),
    version: z.number().int().positive().nullish(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.id) !== Boolean(value.version)) {
      context.addIssue({
        code: "custom",
        path: [value.id ? "version" : "id"],
        message: "Existing budget items require both an id and version",
      });
    }
  });

export const updateBudgetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  rollover: z.boolean(),
  version: z.number().int().positive(),
  items: z.array(editableBudgetItemSchema).max(100),
});

const standaloneBudgetItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  plannedAmount: moneySchema.refine((value) => value >= 0, "Planned amount cannot be negative"),
  priorSpentAmount: moneySchema
    .refine((value) => value >= 0, "Prior spending cannot be negative")
    .default(0),
  categoryId: optionalIdSchema,
  parentId: optionalIdSchema,
});

export const createBudgetItemSchema = standaloneBudgetItemSchema.extend({
  budgetVersion: z.number().int().positive(),
});

export const updateBudgetItemSchema = standaloneBudgetItemSchema.extend({
  budgetVersion: z.number().int().positive(),
  version: z.number().int().positive(),
});

export const deleteBudgetSchema = z.object({
  version: z.number().int().positive(),
});

export const createFundingBucketSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(fundingBucketTypes),
    currency: z.enum(supportedCurrencies).default("BDT"),
    periodStart: z.iso
      .date()
      .nullish()
      .transform((value) => value ?? null),
    periodEnd: z.iso
      .date()
      .nullish()
      .transform((value) => value ?? null),
  })
  .refine(
    (value) => !value.periodStart || !value.periodEnd || value.periodStart <= value.periodEnd,
    {
      path: ["periodEnd"],
      message: "Funding end date must be after its start date",
    },
  );

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type CreateBudgetItemInput = z.infer<typeof createBudgetItemSchema>;
export type UpdateBudgetItemInput = z.infer<typeof updateBudgetItemSchema>;
