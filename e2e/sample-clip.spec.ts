import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { guideFixtures } from "../src/contracts/fixtures";

type Upload = {
  name: string;
  type: string;
  size: number;
  consent: string | null;
};
declare global {
  interface Window {
    __uploads?: Upload[];
  }
}

const sample = resolve("public/samples/hindi-directions.mp3");

test.beforeEach(async ({ page }) => {
  // No live service calls are permitted in automated browser tests.
  await page.route("**/api/**", (route) => route.abort());
  // Records each audio upload the page makes, in every browser engine.
  await page.addInitScript(() => {
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const audio = body instanceof FormData ? body.get("audio") : null;
      if (body instanceof FormData && audio instanceof File) {
        window.__uploads = [
          ...(window.__uploads ?? []),
          {
            name: audio.name,
            type: audio.type,
            size: audio.size,
            consent: String(body.get("consent")),
          },
        ];
      }
      return send.call(this, body);
    };
  });
});

test("the bundled sample is validated and processed like an upload", async ({
  page,
}) => {
  await page.route("**/api/directions/extract", (route) =>
    route.fulfill({
      json: { data: guideFixtures.hindi, requestId: randomUUID() },
    }),
  );
  await page.goto("/record");
  await page.getByRole("button", { name: "Use sample audio" }).click();
  await expect(
    page.getByRole("button", { name: "Shape my route" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play recording" }),
  ).toBeVisible();
  // Consent is never implied by choosing the sample.
  await expect(
    page.getByRole("button", { name: "Shape my route" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /permission to record and send/ })
    .check();
  await page.getByRole("button", { name: "Shape my route" }).click();
  await expect(
    page.getByRole("link", { name: "Review my route" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__uploads)).toEqual([
    {
      name: "directions.mp3",
      type: "audio/mpeg",
      size: statSync(sample).size,
      consent: "true",
    },
  ]);
});

test("a failed sample download shows a clear error and can be retried", async ({
  page,
}) => {
  let available = false;
  await page.route("**/samples/hindi-directions.mp3", (route) =>
    available ? route.continue() : route.abort(),
  );
  await page.goto("/record");
  await page.getByRole("button", { name: "Use sample audio" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "sample clip could not be loaded",
  );
  await expect(
    page.getByRole("button", { name: "Shape my route" }),
  ).toHaveCount(0);
  available = true;
  await page.getByRole("button", { name: "Use sample audio" }).click();
  await expect(
    page.getByRole("button", { name: "Shape my route" }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});
