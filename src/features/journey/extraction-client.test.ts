import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { englishFixture } from "@/contracts/fixtures";
import { submitExtraction, retryAtFromHeader } from "./extraction-client";
class FakeXHR {
  static requests: FakeXHR[] = [];
  upload: {
    onprogress?: (event: {
      lengthComputable: boolean;
      loaded: number;
      total: number;
    }) => void;
    onload?: () => void;
  } = {};
  withCredentials = false;
  timeout = 0;
  status = 200;
  responseText = "";
  body: FormData | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  retryAfter: string | null = null;
  constructor() {
    FakeXHR.requests.push(this);
  }
  open = vi.fn();
  getResponseHeader() {
    return this.retryAfter;
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.onabort?.();
  }
  reply(body: unknown, status = 200) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }
}
const clip = {
  file: new File(["safe fixture"], "directions.wav", { type: "audio/wav" }),
  durationMs: 3000,
};
beforeEach(() => {
  FakeXHR.requests = [];
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
});
afterEach(() => vi.unstubAllGlobals());
function latest() {
  const xhr = FakeXHR.requests.at(-1);
  if (!xhr) throw new Error("Missing XHR");
  return xhr;
}
describe("typed extraction browser boundary", () => {
  it("sends the documented multipart fields with consent, cookies, timeout, and real progress", async () => {
    const progress = vi.fn();
    const promise = submitExtraction(
      clip,
      "ml",
      true,
      new AbortController().signal,
      progress,
    );
    const xhr = latest();
    expect([...(xhr.body?.keys() ?? [])]).toEqual([
      "audio",
      "languageHint",
      "durationMs",
      "consent",
    ]);
    expect(xhr.body?.get("consent")).toBe("true");
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.timeout).toBe(60000);
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    expect(progress).toHaveBeenCalledWith(0.25);
    xhr.upload.onload?.();
    expect(progress).toHaveBeenCalledWith(1);
    const requestId = crypto.randomUUID();
    xhr.reply({ data: englishFixture, requestId });
    await expect(promise).resolves.toEqual({
      guide: englishFixture,
      requestId,
    });
  });
  it("refuses missing consent without starting a request", async () => {
    await expect(
      submitExtraction(
        clip,
        "auto",
        false,
        new AbortController().signal,
        vi.fn(),
      ),
    ).rejects.toMatchObject({
      failure: { code: "consent_required", retryable: false },
    });
    expect(FakeXHR.requests).toHaveLength(0);
  });
  it("handles curated quota errors with a retry deadline", async () => {
    const promise = submitExtraction(
      clip,
      "auto",
      true,
      new AbortController().signal,
      vi.fn(),
    );
    const xhr = latest();
    xhr.retryAfter = "60";
    xhr.reply(
      {
        error: {
          code: "upstream_quota_exceeded",
          message: "The AI service quota is temporarily exhausted.",
          retryable: true,
        },
        requestId: crypto.randomUUID(),
      },
      503,
    );
    await expect(promise).rejects.toMatchObject({
      failure: { code: "upstream_quota_exceeded", retryAt: expect.any(Number) },
    });
    expect(FakeXHR.requests).toHaveLength(1);
  });
  it.each(["malformed", "network", "timeout", "cancel"])(
    "handles %s without mock fallback or private errors",
    async (kind) => {
      const controller = new AbortController();
      const promise = submitExtraction(
        clip,
        "auto",
        true,
        controller.signal,
        vi.fn(),
      );
      const xhr = latest();
      if (kind === "malformed")
        xhr.reply({ secret: "private provider response" });
      else if (kind === "network") xhr.onerror?.();
      else if (kind === "timeout") xhr.ontimeout?.();
      else controller.abort();
      await expect(promise).rejects.toMatchObject({
        failure: { message: expect.not.stringContaining("private") },
      });
    },
  );
  it("parses seconds/date Retry-After safely", () => {
    expect(retryAtFromHeader("60", 1000)).toBe(61000);
    expect(retryAtFromHeader("nonsense", 1000)).toBeNull();
    expect(retryAtFromHeader(new Date(5000).toUTCString(), 1000)).toBe(5000);
  });
});
