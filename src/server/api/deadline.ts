import "server-only";

import { storageError } from "./errors";

/** Bound the caller's wait. A Firestore mutation can still commit; retry its idempotent operation. */
export async function withStorageDeadline<T>(operation: Promise<T>, timeoutMs = 8000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(storageError()), timeoutMs);
  });
  try { return await Promise.race([operation, deadline]); }
  finally { clearTimeout(timer); }
}
