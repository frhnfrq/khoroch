import assert from "node:assert/strict";
import test from "node:test";

import { splitAiTransactionNotes } from "@/lib/finance/ai-quick-entry.server";

test("splits long notes and carries the latest date context forward", () => {
  const chunks = splitAiTransactionNotes(
    [
      "26th August",
      "Auto 20",
      "Meshkat 30",
      "29th August",
      "Nazma 200",
      "30 tarikh",
      "Bus 30",
    ].join("\n"),
    3,
  );

  assert.deepEqual(chunks, [
    {
      text: "26th August\nAuto 20\nMeshkat 30",
      precedingDateContext: "None",
    },
    {
      text: "29th August\nNazma 200\n30 tarikh",
      precedingDateContext: "26th August",
    },
    {
      text: "Bus 30",
      precedingDateContext: "26th August → 29th August → 30 tarikh",
    },
  ]);
});

test("keeps short notes in one chunk", () => {
  assert.deepEqual(splitAiTransactionNotes("Auto 20\n\nBus 30"), [
    { text: "Auto 20\nBus 30", precedingDateContext: "None" },
  ]);
});
