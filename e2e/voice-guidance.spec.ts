import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { englishFixture } from "../src/contracts/fixtures";
import { englishNarration, type NarrationInput } from "../src/contracts/speech";
async function speechRoutes(page: Page) {
  const bytes = await readFile("src/server/testing/audio/silence.wav"); bytes[bytes.length - 2] = 1;
  await page.route("**/api/**", route => route.abort());
  await page.route("**/api/speech", route => route.fulfill({ body: bytes, contentType: "audio/wav" }));
  await page.route("**/api/speech/translate", route => {
    const input = route.request().postDataJSON() as NarrationInput & { language: string };
    const sections = englishNarration(input);
    return route.fulfill({ json: { data: { language: input.language, sections: { ...sections, instruction: input.language === "hi" ? "bus stop से शुरू करें।" : "bus stop ൽ നിന്ന് തുടങ്ങുക." } }, requestId: randomUUID() } });
  });
}
async function demoGuide(page: Page) {
  await page.goto("/guide"); await page.getByRole("button", { name: "Explore demo", exact: true }).click();
  await page.getByRole("checkbox", { name: /remaining uncertainty/ }).check();
  await page.getByRole("button", { name: /Confirm route|Confirm with warnings/ }).click();
  await expect(page.getByRole("button", { name: "Turn on voice guidance" })).toBeVisible();
}

test("voice is opt-in, caches replay, translates preview and stops on exit", async ({ page }) => {
  await speechRoutes(page); let calls = 0;
  page.on("request", request => { if (request.url().endsWith("/api/speech")) calls++; });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await demoGuide(page); expect(calls).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Turn on voice guidance" }).click();
  const play = page.getByRole("button", { name: "Tap to play", exact: true });
  await expect(page.getByRole("button", { name: "Replay step", exact: true }).or(play)).toBeVisible();
  if (await play.count()) await play.click();
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "Replay step", exact: true }).click();
  await expect(page.getByRole("button", { name: "Replay step", exact: true }).or(play)).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole("combobox", { name: "Voice language" }).selectOption("hi");
  await expect(page.getByText("Translated voice text", { exact: true })).toBeVisible();
  await page.getByText("Translated voice text", { exact: true }).click();
  await expect(page.getByText("bus stop से शुरू करें।", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Turn off voice guidance" }).click();
  await expect(page.getByRole("button", { name: "Turn on voice guidance" })).toBeVisible();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/review/);
});

test("voice failure does not advance the guide or substitute another engine", async ({ page }) => {
  await speechRoutes(page);
  await page.route("**/api/speech", route => route.fulfill({ status: 503, headers: { "Retry-After": "60" }, json: { error: { code: "upstream_quota_exceeded", message: "Voice quota exhausted.", retryable: true }, requestId: randomUUID() } }));
  await demoGuide(page); await page.getByRole("button", { name: "Turn on voice guidance" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Voice quota exhausted.");
  await expect(page.getByRole("button", { name: "Retry voice", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: /Start/ })).toBeVisible();
});

test("Malayalam narration omits review warnings while keeping them visible", async ({ page }) => {
  await speechRoutes(page);
  const spoken: string[] = [];
  page.on("request", request => {
    if (request.url().endsWith("/api/speech")) spoken.push(request.postDataJSON().text);
  });
  await demoGuide(page);
  await page.getByRole("combobox", { name: "Voice language" }).selectOption("ml");
  await page.getByRole("button", { name: "Turn on voice guidance" }).click();
  await expect(page.getByText("Translated voice text", { exact: true })).toBeVisible();
  await page.getByText("Translated voice text", { exact: true }).click();
  await expect(page.getByText("bus stop ൽ നിന്ന് തുടങ്ങുക.", { exact: false })).toBeVisible();
  expect(spoken).toHaveLength(1);
  expect(spoken[0]).toContain("തുടങ്ങുക");
  expect(spoken.join(" ")).not.toMatch(/Not certain|Confirm.*speaker|heading.*specified/);
  await expect(page.getByRole("list", { name: "Route warnings" })).toBeVisible();
});

test("live processing has an indeterminate loader and removes it on cancellation", async ({ page }) => {
  await page.route("**/api/**", route => route.abort());
  await page.route("**/api/directions/extract", async route => { await new Promise(resolve => setTimeout(resolve, 5000)); await route.fulfill({ json: { data: englishFixture, requestId: randomUUID() } }).catch(() => {}); });
  await page.goto("/record"); await expect(page.getByLabel("Upload directions audio")).toBeEnabled();
  await page.getByLabel("Upload directions audio").setInputFiles("src/server/testing/audio/silence.wav");
  await page.getByRole("checkbox", { name: /permission to record and send/ }).check();
  await page.getByRole("button", { name: "Shape my route" }).click();
  const processing = page.getByRole("progressbar", { name: "Processing audio" });
  const loader = processing.or(page.getByRole("progressbar", { name: "Upload progress" }));
  await expect(loader).toBeVisible();
  if (await processing.count()) await expect(processing).not.toHaveAttribute("aria-valuenow");
  await page.getByRole("button", { name: "Cancel processing" }).click(); await expect(loader).toHaveCount(0);
});
