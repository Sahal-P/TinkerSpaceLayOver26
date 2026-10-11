// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prepare } = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/features/journey/audio-client", () => ({ prepareClip: prepare }));

import { JourneyProvider } from "../../journey-store";
import { SAMPLE_CLIP_URL } from "../../sample-clip";
import { RecordScreen } from "./record-screen";

function renderRecorder() {
  render(
    <JourneyProvider>
      <RecordScreen />
    </JourneyProvider>,
  );
}

beforeEach(() => {
  prepare.mockReset();
  prepare.mockResolvedValue({
    file: new File(["clip"], "directions.mp3", { type: "audio/mpeg" }),
    durationMs: 84349,
  });
  // jsdom implements neither object URLs nor media loading.
  for (const name of ["createObjectURL", "revokeObjectURL"]) {
    Object.defineProperty(URL, name, {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:sample"),
    });
  }
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(
    () => undefined,
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
    () => undefined,
  );
});
afterEach(() => {
  // Unmount while the media stubs still exist, so teardown stays quiet.
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("bundled sample clip on the record screen", () => {
  it("is offered beside upload and described as synthetic", () => {
    renderRecorder();
    const sample = screen.getByRole("button", { name: "Use sample audio" });
    expect(screen.getByRole("button", { name: "Upload audio" })).toBeDefined();
    const note = document.getElementById(
      sample.getAttribute("aria-describedby") ?? "",
    );
    expect(note?.textContent).toMatch(/synthetic Hindi recording/);
  });

  it("loads through the shared validation and still needs consent to process", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetcher);
    renderRecorder();
    fireEvent.click(screen.getByRole("button", { name: "Use sample audio" }));
    const shape = await screen.findByRole("button", { name: "Shape my route" });
    expect(fetcher).toHaveBeenCalledWith(
      SAMPLE_CLIP_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(prepare.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(screen.getByText("1:24")).toBeDefined();
    expect(shape).toHaveProperty("disabled", true);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /permission to record and send/i }),
    );
    expect(shape).toHaveProperty("disabled", false);
  });

  it("shows a clear error when the sample cannot be downloaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );
    renderRecorder();
    fireEvent.click(screen.getByRole("button", { name: "Use sample audio" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/sample clip could not be loaded/);
    expect(screen.queryByRole("button", { name: "Shape my route" })).toBeNull();
    expect(prepare).not.toHaveBeenCalled();
  });
});
