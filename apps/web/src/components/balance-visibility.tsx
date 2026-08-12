"use client";

import { Button } from "@khoroch/ui/components/button";
import { cn } from "@khoroch/ui/lib/utils";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

type BalanceVisibilityProps = {
  children: ReactNode;
  className?: string;
};

export function BalanceVisibility({ children, className }: BalanceVisibilityProps) {
  const [isVisible, setIsVisible] = useState(false);
  const actionLabel = isVisible ? "Hide total balance" : "Show total balance";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="min-w-0 overflow-hidden rounded-md">
        <div
          aria-hidden={!isVisible}
          className={cn(
            "transition-[filter] duration-200 motion-reduce:transition-none",
            !isVisible && "pointer-events-none select-none blur-md",
          )}
        >
          {children}
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        aria-label={actionLabel}
        title={actionLabel}
        onClick={() => setIsVisible((visible) => !visible)}
      >
        {isVisible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
      </Button>
    </div>
  );
}
