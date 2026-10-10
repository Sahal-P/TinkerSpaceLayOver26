import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  ambiguousFixture,
  englishFixture,
  guideFixtures,
} from "../src/contracts/fixtures";
import type { GuideDraft } from "../src/contracts/guide";
async function selectClip(page: Page, extension = "wav") {
  await page.goto("/record");
  await expect(page.getByLabel("Upload directions audio")).toBeEnabled();
  await page
    .getByLabel("Upload directions audio")
    .setInputFiles(resolve("src/server/testing/audio/silence." + extension));
  await expect(
    page.getByRole("button", { name: "Shape my route" }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: /permission to record and send/ })
    .check();
}
async function respond(page: Page, guide: GuideDraft) {
  await page.route("**/api/directions/extract", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["content-type"]).toContain(
      "multipart/form-data",
    );
    await route.fulfill({ json: { data: guide, requestId: randomUUID() } });
  });
}
async function goToGuide(page: Page) {
  await page.getByRole("button", { name: "Shape my route" }).click();
  await expect(
    page.getByRole("link", { name: "Review my route" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Review my route" }).click();
  const warning = page.getByRole("checkbox", { name: /remaining uncertainty/ });
  if (await warning.count()) await warning.check();
  await page
    .getByRole("button", { name: /Confirm route|Confirm with warnings/ })
    .click();
}
test.beforeEach(async ({ page }) => {
  // No live service calls are permitted in automated browser tests.
  await page.route("**/api/**", (route) => route.abort());
});
for (const name of ["english", "malayalam", "hindi", "mixed"] as const) {
  test(`validated ${name} upload reaches a local guide`, async ({ page }) => {
    await respond(page, guideFixtures[name]);
    await selectClip(page);
    await goToGuide(page);
    await expect(
      page.getByRole("heading", { name: "Start at the bus stop." }),
    ).toBeVisible();
    await expect(page.getByText("Not stated", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Illustrative sequence · not a map"),
    ).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("heading", { name: /two hundred meters/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/Lisbon|Português|minutes on foot/),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Lens check coming later" }).click();
    await expect(
      page.getByRole("heading", { name: "Lens check is coming later." }),
    ).toBeVisible();
  });
}
test("acknowledging contradictory directions retains warnings", async ({
  page,
}) => {
  await respond(page, ambiguousFixture);
  await selectClip(page);
  await page.getByRole("button", { name: "Shape my route" }).click();
  await page.getByRole("link", { name: "Review my route" }).click();
  await page.getByRole("button", { name: "Acknowledge step" }).click();
  await expect(
    page.getByText("The speaker named contradictory turns."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm with warnings" }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /remaining uncertainty/ }).check();
  await page.getByRole("button", { name: "Confirm with warnings" }).click();
  await expect(
    page.getByText("Direction unclear", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/speaker named contradictory turns/),
  ).toBeVisible();
});
test("quota cooldown and explicit retry keep the clip without fallback", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/directions/extract", async (route) => {
    calls++;
    await route.fulfill(
      calls === 1
        ? {
            status: 503,
            headers: { "Retry-After": "1" },
            json: {
              error: {
                code: "upstream_quota_exceeded",
                message: "The AI service quota is temporarily exhausted.",
                retryable: true,
              },
              requestId: randomUUID(),
            },
          }
        : { json: { data: englishFixture, requestId: randomUUID() } },
    );
  });
  await selectClip(page);
  await page.getByRole("button", { name: "Shape my route" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "quota",
  );
  await expect(page.getByRole("link", { name: "Review my route" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Retry this clip" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Retry this clip" }).click();
  await expect(
    page.getByRole("link", { name: "Review my route" }),
  ).toBeVisible();
  expect(calls).toBe(2);
});
test("malformed response stays an error and never opens a demo", async ({
  page,
}) => {
  await page.route("**/api/directions/extract", (route) =>
    route.fulfill({ json: { fabricated: "invalid" } }),
  );
  await selectClip(page);
  await page.getByRole("button", { name: "Shape my route" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be validated",
  );
  await expect(page.getByRole("link", { name: "Review my route" })).toHaveCount(
    0,
  );
});
test("cancellation keeps the selected clip and ignores late completion", async ({
  page,
}) => {
  let finish: (() => void) | null = null;
  await page.route("**/api/directions/extract", async (route) => {
    await new Promise<void>((done) => {
      finish = done;
    });
    await route
      .fulfill({ json: { data: englishFixture, requestId: randomUUID() } })
      .catch(() => undefined);
  });
  await selectClip(page);
  await page.getByRole("button", { name: "Shape my route" }).click();
  await page.getByRole("button", { name: "Cancel processing" }).click();
  const complete = finish as (() => void) | null;
  complete?.();
  await expect(
    page.getByRole("button", { name: "Process this clip" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Review my route" })).toHaveCount(
    0,
  );
});
test("corrupt, video-bearing, and oversized uploads cannot be submitted", async ({
  page,
}) => {
  await page.goto("/record");
  const input = page.getByLabel("Upload directions audio");
  for (const file of [
    "src/server/testing/audio/silence-video.mp4",
    { name: "bad.wav", mimeType: "audio/wav", buffer: Buffer.from("bad") },
    {
      name: "big.wav",
      mimeType: "audio/wav",
      buffer: Buffer.alloc(4 * 1024 * 1024 + 1),
    },
  ]) {
    await expect(input).toBeEnabled();
    await input.setInputFiles(file);
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Shape my route" }),
    ).toHaveCount(0);
  }
});
test("real media playback uses a validated MP4 clip", async ({ page }) => {
  await selectClip(page, "m4a");
  await page.getByRole("button", { name: "Play recording" }).click();
  await expect(
    page.getByRole("button", { name: "Pause playback" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause playback" }).click();
  await expect(
    page.getByRole("button", { name: "Play recording" }),
  ).toBeVisible();
});
test("browser microphone capture yields playable media and submits once", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Chromium fake media devices exercise capture; physical Safari is a separate live check.",
  );
  let calls = 0;
  await page.route("**/api/directions/extract", (route) => {
    calls++;
    return route.fulfill({
      json: { data: englishFixture, requestId: randomUUID() },
    });
  });
  await page.goto("/record");
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /permission to record and send/ })
    .check();
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByRole("button", { name: "Shape my route" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play recording" }).click();
  await expect(
    page.getByRole("button", { name: "Pause playback" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Shape my route" }).click();
  await expect(
    page.getByRole("link", { name: "Review my route" }),
  ).toBeVisible();
  expect(calls).toBe(1);
});
test("review rejects unsaved blank steps and preserves blank distance corrections", async ({
  page,
}) => {
  await respond(page, englishFixture);
  await selectClip(page);
  await page.getByRole("button", { name: "Shape my route" }).click();
  await page.getByRole("link", { name: "Review my route" }).click();
  await page.getByRole("button", { name: "Add a step" }).click();
  const newForm = page.getByRole("form", { name: "Edit step 5" });
  await newForm.getByRole("button", { name: "Save step" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm route" }),
  ).toBeDisabled();
  await newForm.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Edit step 2" }).click();
  const form = page.getByRole("form", { name: "Edit step 2" });
  await form.getByLabel("Distance (m)").fill("");
  await form.getByLabel("Landmark", { exact: true }).fill("");
  await form.getByRole("button", { name: "Save step" }).click();
  await page.getByRole("button", { name: "Confirm route" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(
    page.getByText("Landmark not specified", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Not stated", { exact: true })).toBeVisible();
});
test("explicit demo, empty refresh, themes, overflow and no-WebGL fallback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/guide?no-webgl");
  await expect(
    page.getByRole("heading", { name: "Start with a recording." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore demo" }).click();
  await page.getByRole("checkbox", { name: /remaining uncertainty/ }).check();
  await page.getByRole("button", { name: "Confirm with warnings" }).click();
  // Soft navigation preserves memory; refresh intentionally does not.
  await expect(
    page.getByRole("heading", {
      name: "Start at the yellow tram stop and face uphill.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Start with a recording." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.goto("/?no-webgl");
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("permission denial offers upload without pretending to record", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("private device details", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/record");
  await page
    .getByRole("checkbox", { name: /permission to record and send/ })
    .check();
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Microphone permission was denied",
  );
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Upload audio" }),
  ).toBeEnabled();
});

test("network failure and retry never substitute a demo", async ({ page }) => {
  await page.route("**/api/directions/extract", (route) =>
    route.abort("failed"),
  );
  await selectClip(page);
  await page.getByRole("button", { name: "Shape my route" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "connection failed",
  );
  await expect(page.getByRole("link", { name: "Review my route" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Retry this clip" }),
  ).toBeEnabled();
});

test("replacing a failed clip with an invalid file clears the old retry source", async ({
  page,
}) => {
  await page.route("**/api/directions/extract", (route) =>
    route.abort("failed"),
  );
  await selectClip(page);
  await page.getByRole("button", { name: "Shape my route" }).click();
  await page
    .getByRole("link", { name: "Record or choose another clip" })
    .click();
  await expect(page.getByLabel("Upload directions audio")).toBeEnabled();
  await page.getByLabel("Upload directions audio").setInputFiles({
    name: "corrupt.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("corrupt"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "not a valid supported audio clip",
  );
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Start with a recording." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry this clip" }),
  ).toHaveCount(0);
});
