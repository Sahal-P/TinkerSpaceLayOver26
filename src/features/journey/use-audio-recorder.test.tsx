// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_AUDIO_BYTES } from "@/contracts/audio";
const { prepare, getMedia } = vi.hoisted(() => ({
  prepare: vi.fn(),
  getMedia: vi.fn(),
}));
vi.mock("./audio-client", () => ({ prepareClip: prepare }));
import {
  chooseRecorderType,
  recordingError,
  useAudioRecorder,
} from "./use-audio-recorder";
class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported = (mime: string) => mime.startsWith("audio/webm");
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    if (this.state !== "recording") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["test"]) });
    this.onstop?.();
  }
}
const track = { stop: vi.fn(), onended: null as (() => void) | null };
const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
beforeEach(() => {
  FakeRecorder.instances = [];
  prepare.mockReset();
  getMedia.mockReset();
  track.stop.mockReset();
  track.onended = null;
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: getMedia },
  });
  getMedia.mockResolvedValue(stream);
  prepare.mockResolvedValue({
    file: new File(["test"], "directions.webm", { type: "audio/webm" }),
    durationMs: 3000,
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("actual recorder lifecycle", () => {
  it("selects supported format without assuming WebM", () => {
    expect(chooseRecorderType((mime) => mime === "audio/mp4")).toBe(
      "audio/mp4",
    );
    expect(chooseRecorderType(() => false)).toBeNull();
  });
  it("requires consent and permits one pending permission request", async () => {
    const { result } = renderHook(() => useAudioRecorder(null));
    await act(() => result.current.start(false));
    expect(getMedia).not.toHaveBeenCalled();
    let resolve: (stream: unknown) => void = () => undefined;
    getMedia.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    act(() => {
      void result.current.start(true);
      void result.current.start(true);
    });
    expect(getMedia).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve(stream);
    });
    expect(result.current.phase).toBe("recording");
  });
  it("collects the final chunk, validates it, and releases microphone tracks", async () => {
    const { result } = renderHook(() => useAudioRecorder(null));
    await act(() => result.current.start(true));
    await act(() => result.current.stop());
    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(prepare.mock.calls[0]?.[0].size).toBe(4);
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.clip?.durationMs).toBe(3000);
  });
  it("rejects an oversized recording rather than truncating it", async () => {
    const { result } = renderHook(() => useAudioRecorder(null));
    await act(() => result.current.start(true));
    act(() =>
      FakeRecorder.instances[0]?.ondataavailable?.({
        data: new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)]),
      }),
    );
    expect(result.current.phase).toBe("error");
    expect(result.current.clip).toBeNull();
    expect(prepare).not.toHaveBeenCalled();
  });
  it("stops on page hiding and releases a late permission grant after unmount", async () => {
    const first = renderHook(() => useAudioRecorder(null));
    await act(() => first.result.current.start(true));
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    await act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(track.stop).toHaveBeenCalled();
    first.unmount();
    let resolve: (stream: unknown) => void = () => undefined;
    getMedia.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const second = renderHook(() => useAudioRecorder(null));
    act(() => {
      void second.result.current.start(true);
    });
    second.unmount();
    track.stop.mockClear();
    await act(async () => {
      resolve(stream);
    });
    expect(track.stop).toHaveBeenCalled();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });
  it("reports permission and corrupt clip failures safely", async () => {
    getMedia.mockRejectedValue(
      new DOMException("private device detail", "NotAllowedError"),
    );
    const { result } = renderHook(() => useAudioRecorder(null));
    await act(() => result.current.start(true));
    expect(result.current.error).toMatch(/permission was denied/);
    expect(result.current.error).not.toContain("private");
    prepare.mockRejectedValue(new Error("private parser payload"));
    act(() => result.current.upload(new File(["bad"], "bad.wav")));
    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.error).not.toContain("private");
    expect(recordingError(new DOMException("", "NotFoundError"))).toMatch(
      /No microphone/,
    );
  });
  it("stops before 120 seconds and clears clips on reset", async () => {
    vi.useFakeTimers();
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const { result } = renderHook(() => useAudioRecorder(null));
    await act(() => result.current.start(true));
    clock = 119000;
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.phase).toBe("ready");
    act(() => result.current.reset());
    expect(result.current.clip).toBeNull();
    expect(result.current.phase).toBe("idle");
  });
});
