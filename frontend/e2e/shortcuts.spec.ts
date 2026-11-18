import { expect, type Page, test } from "@playwright/test";
import { createArea, createProject, postTask, unique } from "./api.ts";

// The Ctrl K palette against a real API (search, then opening a project page and a task in
// the detail panel, and running a command), `?` and the Calendar's keys.

const palette = (page: Page) => page.getByRole("dialog", { name: "Command palette" });
const field = (page: Page) => page.getByRole("combobox", { name: "Search or run a command" });

test("Ctrl K finds a project and a task and opens them", async ({ page, request }) => {
  const word = unique("Kestrel");
  const area = await createArea(request, unique("Hobbies"), "teal");
  const project = await createProject(request, area, `${word} watching`);
  await postTask(request, { project_id: project.id, title: `Buy ${word} guide` });

  await page.goto("/home");
  await page.keyboard.press("Control+k");
  await expect(field(page)).toBeFocused();
  await field(page).fill(word);
  const projectRow = page.getByRole("option", { name: new RegExp(`^${project.title}`) });
  await expect(projectRow).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("option", { name: `Buy ${word} guide` })).toContainText(
    `${area.title} · ${project.title}`,
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/areas/projects/${project.id}$`));
  await expect(palette(page)).toHaveCount(0);

  await page.keyboard.press("Control+k");
  await field(page).fill(`buy ${word}`);
  await page.getByRole("option", { name: new RegExp(`Buy ${word} guide`) }).click();
  await expect(
    page.getByRole("complementary", { name: "Details" }).getByText(`Buy ${word} guide`),
  ).toBeVisible();
});

test("a command runs from the palette, and Esc closes it", async ({ page }) => {
  await page.goto("/home");
  await page.keyboard.press("Control+k");
  await field(page).fill("inbox");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tasks\/inbox$/);

  await page.keyboard.press("Control+k");
  await expect(palette(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette(page)).toHaveCount(0);
});

test("? lists the shortcuts and the Calendar takes 1–4, ← → and T", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByRole("radio", { name: "Week" }).click();
  // Leave the view switch, whose arrows move between its options.
  await page.locator("body").click({ position: { x: 600, y: 10 } });
  await page.keyboard.press("Shift+?");
  const shortcuts = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(shortcuts).toContainText("Previous or next period");
  await page.keyboard.press("Escape");
  await expect(shortcuts).toHaveCount(0);

  await page.keyboard.press("2");
  await expect(page.getByRole("radio", { name: "Month" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Today" })).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
  await page.keyboard.press("t");
  await expect(page.getByRole("button", { name: "Today" })).toHaveCount(0);
  await page.keyboard.press("4");
  await expect(page.getByRole("radio", { name: "Year" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("1");
  await expect(page.getByRole("radio", { name: "Week" })).toHaveAttribute("aria-checked", "true");
});
