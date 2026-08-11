import type {
  Account,
  Budget,
  BudgetItem,
  Category,
  FundingBucket,
  Transaction,
  TransactionEntry,
  UserPreferences,
} from "@khoroch/db/schema";

export type AccountWithBalance = Account & { balance: number };

export type TransactionEntryView = TransactionEntry & {
  accountName: string;
  accountType: Account["type"];
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  budgetItemName: string | null;
  fundingBucketName: string | null;
};

export type TransactionView = Transaction & {
  amount: number;
  transferFee: number;
  entries: TransactionEntryView[];
};

export type BudgetItemView = BudgetItem & {
  spentAmount: number;
  remainingAmount: number;
  category: Pick<Category, "id" | "name" | "icon" | "color"> | null;
};

export type BudgetView = Budget & {
  plannedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  items: BudgetItemView[];
};

export type FundingBucketView = FundingBucket & {
  fundedAmount: number;
  spentAmount: number;
  remainingAmount: number;
};

export type FinanceSettings = Omit<UserPreferences, "createdAt" | "updatedAt"> & {
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};
