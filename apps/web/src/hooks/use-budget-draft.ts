"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  readBudgetDraft,
  removeBudgetDraft,
  writeBudgetDraft,
  type BudgetDraft,
  type BudgetDraftInput,
} from "@/lib/finance/budget-draft-storage";

export type BudgetDraftStatus = "idle" | "restored" | "saving" | "saved" | "error";

export function useBudgetDraft<TDraft extends BudgetDraft>({
  storageKey,
  kind,
  draft,
  isDirty,
  onRestore,
}: {
  storageKey: string | null;
  kind: TDraft["kind"];
  draft: BudgetDraftInput;
  isDirty: boolean;
  onRestore: (draft: TDraft) => void;
}) {
  const [status, setStatus] = useState<BudgetDraftStatus>("idle");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [wasRestored, setWasRestored] = useState(false);
  const readyKeyRef = useRef<string | null>(null);
  const draftRef = useRef(draft);
  const dirtyRef = useRef(isDirty);
  const restoreRef = useRef(onRestore);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    draftRef.current = draft;
    dirtyRef.current = isDirty;
    restoreRef.current = onRestore;
  }, [draft, isDirty, onRestore]);

  useEffect(() => {
    readyKeyRef.current = null;
    setStatus("idle");
    setUpdatedAt(null);
    setWasRestored(false);
    if (!storageKey) return;

    try {
      const storedDraft = readBudgetDraft(storageKey, kind);
      if (storedDraft && !dirtyRef.current) {
        restoreRef.current(storedDraft as TDraft);
        setStatus("restored");
        setUpdatedAt(storedDraft.updatedAt);
        setWasRestored(true);
      }
      readyKeyRef.current = storageKey;
    } catch {
      readyKeyRef.current = storageKey;
      setStatus("error");
    }
  }, [kind, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    if (readyKeyRef.current !== storageKey) {
      if (!isDirty) readyKeyRef.current = storageKey;
      return;
    }
    if (!isDirty) return;

    setStatus("saving");
    saveTimeoutRef.current = window.setTimeout(() => {
      try {
        const savedAt = writeBudgetDraft(storageKey, draft);
        setUpdatedAt(savedAt);
        setStatus("saved");
      } catch {
        setStatus("error");
      } finally {
        saveTimeoutRef.current = null;
      }
    }, 250);

    return () => {
      if (saveTimeoutRef.current !== null) window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    };
  }, [draft, isDirty, storageKey]);

  useEffect(() => {
    if (!storageKey) return;

    const flush = () => {
      if (readyKeyRef.current !== storageKey || !dirtyRef.current) return;
      try {
        writeBudgetDraft(storageKey, draftRef.current);
      } catch {
        // The mounted status effect reports storage failures while the page is active.
      }
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [storageKey]);

  useEffect(() => {
    if (!isDirty || status !== "error") return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty, status]);

  const clearDraft = useCallback(() => {
    if (saveTimeoutRef.current !== null) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
    readyKeyRef.current = null;
    dirtyRef.current = false;
    if (storageKey) {
      try {
        removeBudgetDraft(storageKey);
      } catch {
        // State is still reset so the current session can continue normally.
      }
    }
    setStatus("idle");
    setUpdatedAt(null);
    setWasRestored(false);
  }, [storageKey]);

  return { clearDraft, status, updatedAt, wasRestored };
}
