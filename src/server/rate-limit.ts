import "server-only";

import { z } from "zod";

import { ApiError, storageError } from "@/server/api/errors";
import { withStorageDeadline } from "@/server/api/deadline";
import { getDb } from "@/server/firebase";
import { ownerKey, type VerifiedViewer } from "@/server/session";

const counterSchema = z.strictObject({
  minute: z.number().int().nonnegative(), minuteCount: z.number().int().nonnegative(),
  day: z.number().int().nonnegative(), dayCount: z.number().int().nonnegative(),
});
type Counter = z.infer<typeof counterSchema>;
type Operation = "extraction" | "mutation" | "read" | "speech";
const policies = {
  speech: { minute: 12, daily: 120, global: 500 },
  extraction: { minute: 3, daily: 20, global: 200 },
  mutation: { minute: 10, daily: Number.MAX_SAFE_INTEGER, global: 1000 },
  read: { minute: Number.MAX_SAFE_INTEGER, daily: Number.MAX_SAFE_INTEGER, global: 5000 },
} satisfies Record<Operation, { minute: number; daily: number; global: number }>;
function currentCounter(input: unknown, minute: number, day: number): Counter {
  const old = input === undefined ? { minute, minuteCount: 0, day, dayCount: 0 } : counterSchema.parse(input);
  return { minute, day, minuteCount: old.minute === minute ? old.minuteCount : 0, dayCount: old.day === day ? old.dayCount : 0 };
}

export async function enforceRateLimit(operation: Operation, viewer?: VerifiedViewer, now = Date.now()): Promise<void> {
  if (operation !== "read" && !viewer) throw new ApiError("not_found", 404, "Guide not found.");
  const minute = Math.floor(now / 60000);
  const day = Math.floor(now / 86400000);
  const policy = policies[operation];
  try {
    const db = getDb();
    const globalRef = db.collection("_rate_limits").doc("global-" + operation);
    const viewerRef = viewer && operation !== "read" ? db.collection("_rate_limits").doc(operation + "-" + ownerKey(viewer)) : null;
    await withStorageDeadline(db.runTransaction(async (transaction) => {
      const global = currentCounter((await transaction.get(globalRef)).data(), minute, day);
      const owner = viewerRef ? currentCounter((await transaction.get(viewerRef)).data(), minute, day) : null;
      if (global.dayCount >= policy.global || (owner && owner.dayCount >= policy.daily)) {
        throw new ApiError("rate_limited", 429, "The daily request limit has been reached.", true, Math.ceil(((day + 1) * 86400000 - now) / 1000));
      }
      if (owner && owner.minuteCount >= policy.minute) {
        throw new ApiError("rate_limited", 429, "Too many requests. Please wait before trying again.", true, Math.ceil(((minute + 1) * 60000 - now) / 1000));
      }
      transaction.set(globalRef, { ...global, minuteCount: global.minuteCount + 1, dayCount: global.dayCount + 1 });
      if (viewerRef && owner) transaction.set(viewerRef, { ...owner, minuteCount: owner.minuteCount + 1, dayCount: owner.dayCount + 1 });
    }, { maxAttempts: 3 }));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw storageError();
  }
}
