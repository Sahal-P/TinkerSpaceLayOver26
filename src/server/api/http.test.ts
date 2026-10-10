import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { apiErrorSchema } from "@/contracts/guide";

import { ApiError } from "./errors";
import { handleApi, readJson, readLimitedBody, requireSameOrigin } from "./http";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "unit-test-only-secret-of-at-least-32-characters");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
});
afterEach(() => vi.unstubAllEnvs());
describe("API boundary protection", () => {
  it("checks the trusted application origin and denies cross-site requests", () => {
    expect(() => requireSameOrigin(new Request("http://localhost:3000", { headers: { Origin: "http://localhost:3000" } }))).not.toThrow();
    const rejected: HeadersInit[] = [{ Origin: "https://evil.example" }, {}, { Origin: "http://localhost:3000", "Sec-Fetch-Site": "cross-site" }];
    for (const headers of rejected) {
      expect(() => requireSameOrigin(new Request("http://localhost:3000", { headers }))).toThrow();
    }
  });
  it("rejects declared oversize before reading, malformed length, and length mismatch", async () => {
    await expect(readLimitedBody(new Request("http://localhost", {
      method: "POST", body: "small", headers: { "Content-Length": "100" },
    }), 10)).rejects.toMatchObject({ status: 413 });
    await expect(readLimitedBody(new Request("http://localhost", {
      method: "POST", body: "small", headers: { "Content-Length": "invalid" },
    }), 10)).rejects.toMatchObject({ status: 400 });
    await expect(readLimitedBody(new Request("http://localhost", {
      method: "POST", body: "small", headers: { "Content-Length": "1" },
    }), 10)).rejects.toMatchObject({ status: 400 });
  });
  it("caps chunked streams without Content-Length and cancels them", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(8)); }, cancel });
    const init: RequestInit & { duplex: "half" } = { method: "POST", body, duplex: "half" };
    await expect(readLimitedBody(new Request("http://localhost", init), 10)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("cancels an upload when the caller disconnects", async () => {
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({ pull() {} });
    const init: RequestInit & { duplex: "half" } = { method: "POST", body, signal: controller.signal, duplex: "half" };
    const reading = readLimitedBody(new Request("http://localhost", init), 10);
    controller.abort();
    await expect(reading).rejects.toMatchObject({ code: "request_timeout" });
  });
  it("strictly validates JSON and content types", async () => {
    const request = (body: string, contentType = "application/json") => new Request("http://localhost", { method: "POST", headers: { "Content-Type": contentType }, body });
    const schema = z.strictObject({ yes: z.literal(true) });
    expect(await readJson(request('{"yes":true}'), schema)).toEqual({ yes: true });
    await expect(readJson(request('{"yes":true,"secret":"extra"}'), schema)).rejects.toMatchObject({ status: 400 });
    await expect(readJson(request("bad"), schema)).rejects.toMatchObject({ status: 400 });
    await expect(readJson(request("{}", "text/plain"), schema)).rejects.toMatchObject({ status: 415 });
  });
  it("redacts unknown failures and includes no-store, correlation, and retry headers", async () => {
    const failed = await handleApi(async () => { throw new Error("PRIVATE_KEY and AUDIO and api-key-do-not-leak"); });
    const output: unknown = await failed.json();
    expect(apiErrorSchema.safeParse(output).success).toBe(true);
    expect(JSON.stringify(output)).not.toContain("PRIVATE_KEY");
    expect(JSON.stringify(output)).not.toContain("api-key-do-not-leak");
    expect(failed.headers.get("Cache-Control")).toContain("no-store");
    const limited = await handleApi(async () => { throw new ApiError("rate_limited", 429, "Wait.", true, 60); });
    expect(limited.headers.get("Retry-After")).toBe("60");
  });
});
