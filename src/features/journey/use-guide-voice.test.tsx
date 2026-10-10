// @vitest-environment jsdom
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { englishFixture } from "@/contracts/fixtures";
import { narrationInput } from "@/contracts/speech";
const state = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock("./speech-client", async importOriginal => {
  const actual = await importOriginal<typeof import("./speech-client")>(); return { ...actual, prepareNarration: state.prepare };
});
import { useGuideVoice } from "./use-guide-voice";
import { VoiceError } from "./speech-client";
const first = narrationInput(englishFixture.steps[0], []);
const second = narrationInput(englishFixture.steps[1], []);
const clips = { sections: { instruction: "Turn left", landmark: null, distance: null, warnings: [] }, clips: [new Blob(["audio"])] };
beforeEach(() => {
  state.prepare.mockReset().mockResolvedValue(clips);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:voice"), revokeObjectURL: vi.fn() }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("voice playback lifecycle", () => {
  it("requires opt-in, follows manual selection, stops and revokes on unmount", async () => {
    const { result, rerender, unmount } = renderHook(({ current }) => useGuideVoice(current, null), { initialProps: { current: first } });
    expect(state.prepare).not.toHaveBeenCalled();
    act(() => result.current.toggle()); await waitFor(() => expect(result.current.status).toBe("playing"));
    rerender({ current: second }); await waitFor(() => expect(state.prepare).toHaveBeenCalledTimes(2));
    unmount(); expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled(); expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
  it("handles blocked playback with a real user replay", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException("Blocked", "NotAllowedError"));
    const { result } = renderHook(() => useGuideVoice(first, null));
    act(() => result.current.toggle()); await waitFor(() => expect(result.current.status).toBe("blocked"));
    act(() => result.current.play()); await waitFor(() => expect(result.current.status).toBe("playing"));
    expect(state.prepare).toHaveBeenCalledTimes(1);
  });
  it("ignores late results and cancels on language change or disable", async () => {
    let finish: ((value: typeof clips) => void) | undefined;
    state.prepare.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useGuideVoice(first, null));
    act(() => result.current.toggle()); await waitFor(() => expect(result.current.status).toBe("loading"));
    const signal = state.prepare.mock.calls[0]?.[2] as AbortSignal;
    act(() => result.current.changeLanguage("hi")); await waitFor(() => expect(result.current.status).toBe("playing"));
    expect(signal.aborted).toBe(true); await act(async () => finish?.(clips));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    act(() => result.current.toggle()); expect(result.current.status).toBe("off");
  });
  it("stops automatic narration after a service failure until explicit retry", async () => {
    state.prepare.mockRejectedValueOnce(new VoiceError("Quota", 0, null, true));
    const { result, rerender } = renderHook(({ current }) => useGuideVoice(current, null), { initialProps: { current: first } });
    act(() => result.current.toggle()); await waitFor(() => expect(result.current.status).toBe("error"));
    rerender({ current: second }); await waitFor(() => expect(result.current.status).toBe("error"));
    expect(state.prepare).toHaveBeenCalledTimes(1);
    act(() => result.current.play()); await waitFor(() => expect(result.current.status).toBe("playing"));
  });
});

it("pauses and cancels when hidden, then requires manual playback", async () => {
  const { result } = renderHook(() => useGuideVoice(first, null));
  act(() => result.current.toggle()); await waitFor(() => expect(result.current.status).toBe("playing"));
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(result.current.status).toBe("paused");
  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(result.current.status).toBe("paused");
  act(() => result.current.play()); await waitFor(() => expect(result.current.status).toBe("playing"));
});
