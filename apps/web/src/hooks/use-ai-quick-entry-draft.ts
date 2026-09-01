"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  readAiQuickEntryDraft,
  removeAiQuickEntryDraft,
  writeAiQuickEntryDraft,
  type AiQuickEntryDraft,
  type AiQuickEntryDraftInput,
} from "@/lib/finance/ai-quick-entry";

export type AiQuickEntryDraftStatus = "idle" | "restored" | "saving" | "saved" | "error";

export function useAiQuickEntryDraft({
  storageKey,
  draft,
  isDirty,
  onRestore,
}: {
  storageKey: string | null;
  draft: AiQuickEntryDraftInput;
  isDirty: boolean;
  onRestore: (draft: AiQuickEntryDraft) => void;
}) {
  const [status, setStatus] = useState<AiQuickEntryDraftStatus>("idle");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const readyKeyRef = useRef<string | null>(null);
  const draftRef = useRef(draft);
  const dirtyRef = useRef(isDirty);
  const restoreRef = useRef(onRestore);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    draftRef.current = draft;
    dirtyRef.current = isDirty;
    restoreRef.current = onRestore;
  }, [draft, isDirty, onRestore]);

  useEffect(() => {
    readyKeyRef.current = null;
    setStatus("idle");
    setUpdatedAt(null);
    if (!storageKey) return;

    try {
      const storedDraft = readAiQuickEntryDraft(storageKey);
      if (storedDraft && !dirtyRef.current) {
        restoreRef.current(storedDraft);
        setStatus("restored");
        setUpdatedAt(storedDraft.updatedAt);
      }
      readyKeyRef.current = storageKey;
    } catch {
      readyKeyRef.current = storageKey;
      setStatus("error");
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || readyKeyRef.current !== storageKey || !isDirty) return;

    setStatus("saving");
    timeoutRef.current = window.setTimeout(() => {
      try {
        const savedAt = writeAiQuickEntryDraft(storageKey, draft);
        setUpdatedAt(savedAt);
        setStatus("saved");
      } catch {
        setStatus("error");
      } finally {
        timeoutRef.current = null;
      }
    }, 250);

    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [draft, isDirty, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    const flush = () => {
      if (readyKeyRef.current !== storageKey || !dirtyRef.current) return;
      try {
        writeAiQuickEntryDraft(storageKey, draftRef.current);
      } catch {
        // The mounted status reports browser storage errors while the drawer is active.
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

  const clearDraft = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    readyKeyRef.current = null;
    dirtyRef.current = false;
    if (storageKey) {
      try {
        removeAiQuickEntryDraft(storageKey);
      } catch {
        // Reset the active session even if browser storage is unavailable.
      }
    }
    setStatus("idle");
    setUpdatedAt(null);
  }, [storageKey]);

  return { clearDraft, status, updatedAt };
}
