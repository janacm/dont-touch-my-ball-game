import { test, expect } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

function getIndexUrl() {
  const filePath = path.resolve("index.html");
  return pathToFileURL(filePath).href;
}

test("hideMenu() sets uiRoot.style.display to \"none\"", async ({ page }) => {
  await page.goto(getIndexUrl(), { waitUntil: "domcontentloaded" });

  await expect(page.locator("#ui")).toHaveJSProperty("style.display", "grid");
  await page.click("#start-btn");

  await page.waitForFunction(() => {
    const el = document.getElementById("ui");
    return el && el.style.display === "none";
  });

  await expect(page.locator("#ui")).toHaveJSProperty("style.display", "none");
});

test("hideMenu() sets panel.style.display to \"none\"", async ({ page }) => {
  await page.goto(getIndexUrl(), { waitUntil: "domcontentloaded" });

  await expect(page.locator("#panel")).toHaveJSProperty("style.display", "block");
  await page.click("#start-btn");

  await page.waitForFunction(() => {
    const el = document.getElementById("panel");
    return el && el.style.display === "none";
  });

  await expect(page.locator("#panel")).toHaveJSProperty("style.display", "none");
});
