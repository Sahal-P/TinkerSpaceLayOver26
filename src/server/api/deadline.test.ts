import { afterEach, describe, expect, it, vi } from "vitest";

import { withStorageDeadline } from "./deadline";

afterEach(() => vi.useRealTimers());
describe("storage deadlines", () => {
  it("returns completed operations and rejects hung storage safely", async () => {
    await expect(withStorageDeadline(Promise.resolve("complete"))).resolves.toBe("complete");
    vi.useFakeTimers();
    const pending = withStorageDeadline(new Promise(() => {}));
    const expectation = expect(pending).rejects.toMatchObject({ code: "storage_unavailable", status: 503 });
    await vi.advanceTimersByTimeAsync(8000);
    await expectation;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cleans up when storage rejects early without changing the exception", async () => {
    vi.useFakeTimers();
    const error = new Error("storage");
    await expect(withStorageDeadline(Promise.reject(error))).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });
});
