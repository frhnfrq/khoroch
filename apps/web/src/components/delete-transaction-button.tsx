"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@khoroch/ui/components/alert-dialog";
import { Button } from "@khoroch/ui/components/button";
import { Spinner } from "@khoroch/ui/components/spinner";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";

import { apiFetch } from "@/lib/client-api";

export function DeleteTransactionButton({
  transactionId,
  transactionTitle,
  onDeleted,
}: {
  transactionId: string;
  transactionTitle: string;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { mutate } = useSWRConfig();

  async function deleteTransaction() {
    setDeleting(true);
    try {
      await apiFetch(`/api/transactions/${transactionId}`, { method: "DELETE" });
      await Promise.all([
        mutate((key) => typeof key === "string" && key.startsWith("/api/transactions")),
        mutate("/api/accounts"),
        mutate((key) => typeof key === "string" && key.startsWith("/api/budgets")),
        mutate("/api/funding-buckets"),
      ]);
      toast.success("Activity removed.");
      setOpen(false);
      onDeleted?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this activity.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button type="button" variant="destructive" className="flex-1" />}
      >
        <Trash2Icon data-icon="inline-start" />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{transactionTitle}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Account balances and linked budgets will be recalculated. The record remains recoverable
            in the ledger.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={deleting} onClick={deleteTransaction}>
            {deleting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Trash2Icon data-icon="inline-start" />
            )}
            {deleting ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
