import { Badge } from "@khoroch/ui/components/badge";
import { Button } from "@khoroch/ui/components/button";
import { CornerDownRightIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";

export function SubItemPanel({
  index,
  label,
  nested = false,
  onRemove,
  children,
}: {
  index: number;
  label: string;
  nested?: boolean;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {nested ? <CornerDownRightIcon className="shrink-0 text-muted-foreground" /> : null}
          <Badge variant="secondary">{index + 1}</Badge>
          <p className="truncate text-xs font-medium">{label}</p>
        </div>
        {onRemove ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
}
