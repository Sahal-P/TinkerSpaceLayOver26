import { describe, expect, it } from "vitest";
import { ApiError } from "@google/genai";
import { classifyProviderFailure } from "./provider-failure";

describe("safe provider failure classification", () => {
  it.each([
    [429, "quota"], [400, "configuration"], [401, "configuration"], [403, "configuration"], [404, "configuration"],
    [408, "timeout"], [504, "timeout"], [500, "unavailable"], [502, "unavailable"], [503, "unavailable"],
  ])("classifies status %s without exposing its message", (status, kind) => {
    const classified = classifyProviderFailure(new ApiError({ status, message: "private provider payload" }));
    expect(classified).toEqual({ kind, status }); expect(JSON.stringify(classified)).not.toContain("private");
  });
  it("handles wrapped status fields and nested transport causes", () => {
    expect(classifyProviderFailure(new Error("private", { cause: { status: 429 } }))).toEqual({ kind: "quota", status: 429 });
    expect(classifyProviderFailure(new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }))).toEqual({ kind: "timeout", status: null });
    expect(classifyProviderFailure(new TypeError("fetch failed", { cause: { code: "ECONNRESET" } }))).toEqual({ kind: "network", status: null });
    expect(classifyProviderFailure(new DOMException("private", "TimeoutError"))).toEqual({ kind: "timeout", status: null });
  });
  it("does not infer configuration or network errors from arbitrary exception text", () => {
    expect(classifyProviderFailure(new Error("private secret 403 503"))).toEqual({ kind: "unknown", status: null });
    expect(classifyProviderFailure({ status: "503", message: "private" })).toEqual({ kind: "unknown", status: null });
    const cycle: { cause?: unknown } = {}; cycle.cause = cycle;
    expect(classifyProviderFailure(cycle)).toEqual({ kind: "unknown", status: null });
  });
});
