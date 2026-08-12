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
import { Badge } from "@khoroch/ui/components/badge";
import { Button } from "@khoroch/ui/components/button";
import { CloudCheckIcon, CloudUploadIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";

import type { BudgetDraftStatus as DraftStatus } from "@/hooks/use-budget-draft";

function statusDetails(status: DraftStatus) {
  switch (status) {
    case "restored":
      return { label: "Draft restored", icon: RotateCcwIcon, variant: "secondary" as const };
    case "saving":
      return { label: "Saving draft…", icon: CloudUploadIcon, variant: "outline" as const };
    case "saved":
      return { label: "Draft saved", icon: CloudCheckIcon, variant: "outline" as const };
    case "error":
      return { label: "Draft not saved", icon: TriangleAlertIcon, variant: "destructive" as const };
    default:
      return {
        label: "Draft protection active",
        icon: CloudUploadIcon,
        variant: "outline" as const,
      };
  }
}

export function BudgetDraftStatus({
  status,
  updatedAt,
  wasRestored,
  stale = false,
  onDiscard,
}: {
  status: DraftStatus;
  updatedAt: string | null;
  wasRestored: boolean;
  stale?: boolean;
  onDiscard: () => void;
}) {
  const details =
    wasRestored && status !== "saving" && status !== "error"
      ? { label: "Draft restored", icon: RotateCcwIcon, variant: "secondary" as const }
      : statusDetails(status);
  const StatusIcon = details.icon;
  const savedTime = updatedAt
    ? new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(
        new Date(updatedAt),
      )
    : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <Badge variant={details.variant} aria-live="polite">
          <StatusIcon data-icon="inline-start" />
          {details.label}
        </Badge>
        <p className="text-xs text-muted-foreground">
          {status === "error"
            ? "Keep this drawer open until browser storage is available."
            : stale
              ? "This draft started from an older saved version. Review it before saving."
              : savedTime
                ? `Saved in this browser at ${savedTime}.`
                : "Changes are kept in this browser until you save the budget."}
        </p>
      </div>

      <AlertDialog>
        <AlertDialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>
          Discard draft
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this unsaved draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the browser recovery copy and resets every unsaved budget change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction type="button" variant="destructive" onClick={onDiscard}>
              Discard draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
