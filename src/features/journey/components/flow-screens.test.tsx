// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ambiguousFixture,
  englishFixture,
  mixedLanguageFixture,
} from "@/contracts/fixtures";
import type { GuideDraft } from "@/contracts/guide";
import { GuideScreen } from "./guide/guide-screen";
import { RecordScreen } from "./record/record-screen";
import { ReviewScreen } from "./review/review-screen";
import { ShareScreen } from "./share/share-screen";
import { LensScreen } from "./lens/lens-screen";
import { ProcessingScreen } from "./processing/processing-screen";
import { JourneyProvider, useJourney } from "../journey-store";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
}));
function Harness({
  children,
  fixture,
}: {
  children: ReactNode;
  fixture?: GuideDraft;
}) {
  const { dispatch } = useJourney();
  return (
    <>
      <button
        onClick={() => {
          if (fixture) {
            dispatch({ type: "extraction/started", attemptId: "test" });
            dispatch({
              type: "extraction/succeeded",
              attemptId: "test",
              guide: fixture,
              requestId: crypto.randomUUID(),
            });
          } else dispatch({ type: "demo/loaded" });
        }}
      >
        Load test directions
      </button>
      <button
        onClick={() =>
          dispatch({ type: "route/confirmed", acknowledgeWarnings: true })
        }
      >
        Confirm test directions
      </button>
      {children}
    </>
  );
}
function inFlow(ui: ReactNode, fixture?: GuideDraft) {
  render(
    <JourneyProvider>
      <Harness fixture={fixture}>{ui}</Harness>
    </JourneyProvider>,
  );
}
describe("integrated flow boundaries", () => {
  it("requires recording/processing consent and keeps demo explicit", () => {
    inFlow(<RecordScreen />);
    const button = screen.getByRole("button", { name: "Start recording" });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /permission to record and send/i }),
    );
    expect(button).toHaveProperty("disabled", false);
    expect(
      screen.getByRole("button", { name: "Try the demo guide" }),
    ).toBeDefined();
    expect(screen.queryByText(/Portugu/)).toBeNull();
  });
  it.each([
    <ReviewScreen key="review" />,
    <GuideScreen key="guide" />,
    <ProcessingScreen key="processing" />,
  ])("opens an empty flow without automatic fixtures", (ui) => {
    inFlow(ui);
    expect(
      screen.getByRole("heading", { name: "Start with a recording." }),
    ).toBeDefined();
  });
  it("validates an open editor and blocks confirmation until saved/cancelled", async () => {
    inFlow(<ReviewScreen />);
    fireEvent.click(
      screen.getByRole("button", { name: "Load test directions" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /remaining uncertainty/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit step 1" }));
    const form = await screen.findByRole("form", { name: "Edit step 1" });
    fireEvent.change(within(form).getByLabelText("Instruction"), {
      target: { value: "" },
    });
    fireEvent.submit(form);
    expect(
      screen.getByRole("button", {
        name: /Confirm route|Confirm with warnings/,
      }),
    ).toHaveProperty("disabled", true);
    expect(
      within(form)
        .getByRole("textbox", { name: "Instruction" })
        .getAttribute("aria-invalid"),
    ).toBe("true");
  });
  it("keeps acknowledged ambiguity and requires explicit route warning acknowledgement", () => {
    inFlow(<ReviewScreen />, ambiguousFixture);
    fireEvent.click(
      screen.getByRole("button", { name: "Load test directions" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge step" }));
    expect(
      screen.getByText("The speaker named contradictory turns."),
    ).toBeDefined();
    const confirm = screen.getByRole("button", {
      name: "Confirm with warnings",
    });
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /remaining uncertainty/i }),
    );
    expect(confirm).toHaveProperty("disabled", false);
  });
  it("renders detected mixed languages without fabricated timestamps", () => {
    inFlow(<ReviewScreen />, mixedLanguageFixture);
    fireEvent.click(
      screen.getByRole("button", { name: "Load test directions" }),
    );
    expect(screen.getByText(/Malayalam \+ Hindi \+ English/)).toBeDefined();
    expect(screen.queryByText("0:00")).toBeNull();
  });
  it("shows the reviewed guide, not Lisbon metadata, with nullable distance and keyboard navigation", async () => {
    inFlow(<GuideScreen />, englishFixture);
    fireEvent.click(
      screen.getByRole("button", { name: "Load test directions" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm test directions" }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Start at the bus stop." }),
    ).toBeDefined();
    expect(screen.getByText("Not stated")).toBeDefined();
    expect(screen.queryByText(/Lisbon/)).toBeNull();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /two hundred meters/,
      }),
    ).toBeDefined();
  });
  it.each([
    [<ShareScreen key="share" />, "Sharing"],
    [<LensScreen key="lens" />, "Lens check"],
  ] as const)("prevents simulated results for live guides", (ui, name) => {
    inFlow(ui, englishFixture);
    fireEvent.click(
      screen.getByRole("button", { name: "Load test directions" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm test directions" }),
    );
    expect(
      screen.getByRole("heading", { name: name + " is coming later." }),
    ).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /publish|analyz/i }),
    ).toBeNull();
  });
});

function ProcessingHarness() {
  const { dispatch } = useJourney();
  return <>
    <button onClick={() => dispatch({ type: "extraction/started", attemptId: "loader" })}>Start pending request</button>
    <button onClick={() => dispatch({ type: "extraction/progress", attemptId: "loader", progress: 1 })}>Finish upload</button>
    <button onClick={() => dispatch({ type: "extraction/cancelled", attemptId: "loader" })}>Cancel pending request</button>
    <ProcessingScreen />
  </>;
}
it("shows an active loader throughout upload/processing without fabricating stage percentages", () => {
  render(<JourneyProvider><ProcessingHarness /></JourneyProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Start pending request" }));
  expect(screen.getByRole("progressbar", { name: "Upload progress" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Finish upload" }));
  const progress = screen.getByRole("progressbar", { name: "Processing audio" });
  expect(progress.getAttribute("aria-valuenow")).toBeNull();
  expect(screen.getByText("Shaping your directions…")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Cancel pending request" }));
  expect(screen.queryByRole("progressbar")).toBeNull();
});

function ServiceFailureHarness() {
  const { dispatch } = useJourney();
  return <>
    <button onClick={() => {
      dispatch({ type: "clip/set", clip: { file: new File(["test"], "clip.wav", { type: "audio/wav" }), durationMs: 2000 }, consent: true });
      dispatch({ type: "extraction/started", attemptId: "service" });
      dispatch({ type: "extraction/failed", attemptId: "service", error: { code: "upstream_unavailable", message: "Gemini is unavailable.", retryable: true, requestId: null, retryAt: Date.now() + 2000 } });
    }}>Simulate service failure</button>
    <ProcessingScreen />
  </>;
}
it("identifies a service failure, counts down and stops its timer on expiry", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-11T08:00:00Z"));
  const clear = vi.spyOn(globalThis, "clearInterval");
  try {
    render(<JourneyProvider><ServiceFailureHarness /></JourneyProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Simulate service failure" }));
    expect(screen.getByRole("heading", { name: "Processing is temporarily unavailable." })).toBeDefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByRole("button", { name: "Retry in 1s" })).toHaveProperty("disabled", true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByRole("button", { name: "Retry this clip" })).toHaveProperty("disabled", false);
    expect(clear).toHaveBeenCalled();
  } finally { clear.mockRestore(); vi.useRealTimers(); }
});
