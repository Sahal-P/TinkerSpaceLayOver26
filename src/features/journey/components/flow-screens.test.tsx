// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { GuideScreen } from "@/features/journey/components/guide/guide-screen";
import { RecordScreen } from "@/features/journey/components/record/record-screen";
import { ReviewScreen } from "@/features/journey/components/review/review-screen";
import { ShareScreen } from "@/features/journey/components/share/share-screen";
import { JourneyProvider } from "@/features/journey/journey-store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
}));

const inFlow = (ui: ReactNode) => render(<JourneyProvider>{ui}</JourneyProvider>);

describe("Record", () => {
  it("requires consent before recording, and offers a sample", async () => {
    inFlow(<RecordScreen />);
    const record = screen.getByRole("button", { name: "Start recording" });
    expect(record).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("checkbox", { name: /i asked before recording/i }));
    expect(record).toHaveProperty("disabled", false);

    fireEvent.click(screen.getByRole("button", { name: /use a sample recording/i }));
    expect(await screen.findByRole("button", { name: /use this recording/i })).toBeDefined();
    expect(screen.getByRole("slider", { name: /playback position/i })).toBeDefined();
  });
});

describe("Review", () => {
  it("validates edits with readable errors", async () => {
    inFlow(<ReviewScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Edit step 1" }));
    const form = await screen.findByRole("form", { name: "Edit step 1" });
    fireEvent.change(within(form).getByLabelText("Instruction"), { target: { value: "" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save step" }));
    expect(within(form).getByText("Describe the step in a few words.")).toBeDefined();
  });

  it("resolves a flagged step", () => {
    inFlow(<ReviewScreen />);
    expect(screen.getByRole("button", { name: "Confirm anyway" })).toBeDefined();
    for (const button of screen.getAllByRole("button", { name: "Looks right" })) fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Confirm route" })).toBeDefined();
  });
});

describe("Guide", () => {
  it("steps through the route", async () => {
    inFlow(<GuideScreen />);
    expect(screen.getByRole("heading", { level: 2, name: /yellow tram stop/i })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(await screen.findByRole("heading", { level: 2, name: /bakery with blue tiles/i })).toBeDefined();
    expect(screen.getByRole("button", { name: "Previous step" })).toHaveProperty("disabled", false);
  });
});

describe("Share", () => {
  it("asks for acknowledgement before publishing uncertain steps", () => {
    inFlow(<ShareScreen />);
    const publish = screen.getByRole("button", { name: "Publish guide" });
    expect(publish).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("checkbox", { name: /shared with their warnings/i }));
    expect(publish).toHaveProperty("disabled", false);
  });
});
