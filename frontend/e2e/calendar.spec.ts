import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  addDays,
  createArea,
  createRoutine,
  createRoutineStep,
  getEvent,
  getTask,
  listOccurrences,
  mondayOf,
  postEvent,
  postTask,
  serverToday,
  unique,
} from "./api.ts";

// The Calendar's Week and Month against a real API: dragging tasks, events and one occurrence
// of a repeating event to other days
// (with Undo), resizing a bar, dropping an Inbox task on a day, a routine's steps, the add
// menu and "+n more". The tests share one database, so most work three weeks ahead, where
// the other specs put nothing.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (day: string) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8))}`;

/** The Monday three weeks after this week's. */
const futureMonday = (today: string) => addDays(mondayOf(today), 21);

/** Opens the Calendar on the week three weeks ahead. */
async function openFutureWeek(page: Page, today: string) {
  await page.goto("/calendar");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next week" }).click();
  await expect(cell(page, futureMonday(today))).toBeVisible();
}

const cell = (page: Page, day: string) => page.locator(`.calendar-day[data-date="${day}"]`);
const entry = (page: Page, title: string) =>
  page.locator(".calendar-entry", { hasText: title }).first();

/** Drags with small steps, so FullCalendar sees a drag, not a click. */
async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 4, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.move(to.x + 1, to.y + 1, { steps: 2 });
  await page.mouse.up();
}

async function box(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const found = await locator.boundingBox();
  if (!found) throw new Error("Not on screen");
  return found;
}

test("dragging a task to another day schedules it there, and Undo puts it back", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const monday = futureMonday(today);
  const wednesday = addDays(monday, 2);
  const area = await createArea(request, unique("Career"));
  const task = await postTask(request, {
    life_area_id: area.id,
    title: unique("Update resume"),
    scheduled_date: monday,
  });
  await openFutureWeek(page, today);

  const from = await box(entry(page, task.title));
  const to = await box(cell(page, wednesday));
  await dragTo(page, { x: from.x + 40, y: from.y + 12 }, { x: to.x + to.width / 2, y: to.y + 200 });

  await expect(page.getByText(`Scheduled “${task.title}” · ${short(wednesday)}`)).toBeVisible();
  await expect(cell(page, wednesday).getByRole("button", { name: task.title })).toBeVisible();
  await expect
    .poll(async () => getTask(request, task.id))
    .toMatchObject({ scheduled_date: wednesday });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(cell(page, monday).getByRole("button", { name: task.title })).toBeVisible();
  await expect
    .poll(async () => getTask(request, task.id))
    .toMatchObject({ scheduled_date: monday });
});

test("dragging an event keeps its length, its end can be dragged, and Undo restores it", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const monday = futureMonday(today);
  const area = await createArea(request, unique("Personal"), "plum");
  const event = await postEvent(request, {
    life_area_id: area.id,
    title: unique("Beach trip"),
    start_date: monday,
    end_date: addDays(monday, 1),
  });
  await openFutureWeek(page, today);

  const bar = await box(entry(page, event.title));
  const thursday = await box(cell(page, addDays(monday, 3)));
  await dragTo(page, { x: bar.x + 30, y: bar.y + 12 }, { x: thursday.x + 30, y: bar.y + 12 });

  await expect(page.getByText(new RegExp(`Moved “${event.title}”`))).toBeVisible();
  await expect
    .poll(async () => getEvent(request, event.id))
    .toMatchObject({ start_date: addDays(monday, 3), end_date: addDays(monday, 4) });

  // Drag the bar's end to Saturday.
  const moved = entry(page, event.title);
  await moved.hover();
  const handle = await box(moved.locator(".calendar-resizer"));
  const saturday = await box(cell(page, addDays(monday, 5)));
  await dragTo(
    page,
    { x: handle.x + 4, y: handle.y + 8 },
    { x: saturday.x + saturday.width / 2, y: handle.y + 8 },
  );

  await expect(page.getByText(new RegExp(`Changed “${event.title}”`))).toBeVisible();
  await expect
    .poll(async () => getEvent(request, event.id))
    .toMatchObject({ start_date: addDays(monday, 3), end_date: addDays(monday, 5) });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect
    .poll(async () => getEvent(request, event.id))
    .toMatchObject({ end_date: addDays(monday, 4) });
});

test("dragging a repeating event moves only that occurrence, and Undo puts it back", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const monday = futureMonday(today);
  const wednesday = addDays(monday, 2);
  const area = await createArea(request, unique("Health"), "teal");
  const event = await postEvent(request, {
    life_area_id: area.id,
    title: unique("Gym"),
    start_date: monday,
    start_time: "18:00",
    rrule: "FREQ=WEEKLY",
  });
  const occurrences = async () =>
    (await listOccurrences(request, monday, addDays(monday, 13)))
      .filter((occurrence) => occurrence.event_id === event.id)
      .map((occurrence) => [occurrence.occurrence_date, occurrence.start_date]);
  await openFutureWeek(page, today);

  const from = await box(entry(page, event.title));
  const to = await box(cell(page, wednesday));
  await dragTo(page, { x: from.x + 40, y: from.y + 12 }, { x: to.x + to.width / 2, y: to.y + 200 });

  await expect(page.getByText(`Moved “${event.title}” · ${short(wednesday)}`)).toBeVisible();
  await expect(cell(page, wednesday).getByText(event.title)).toBeVisible();
  const nextMonday = addDays(monday, 7);
  await expect.poll(occurrences).toEqual([
    [monday, wednesday],
    [nextMonday, nextMonday], // the rest of the series stays
  ]);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(cell(page, monday).getByText(event.title)).toBeVisible();
  await expect.poll(occurrences).toEqual([
    [monday, monday],
    [nextMonday, nextMonday],
  ]);
});

test("dropping a task from the Inbox panel on a day schedules it", async ({ page, request }) => {
  const today = await serverToday(request);
  const friday = addDays(futureMonday(today), 4);
  const area = await createArea(request, unique("Home"), "terracotta");
  const task = await postTask(request, { life_area_id: area.id, title: unique("Fix the faucet") });
  await openFutureWeek(page, today);
  await page.getByRole("button", { name: /^Inbox/ }).click();
  const inbox = page.getByRole("complementary", { name: "Inbox" });

  const row = await box(inbox.getByRole("listitem").filter({ hasText: task.title }));
  const to = await box(cell(page, friday));
  await dragTo(page, { x: row.x + 60, y: row.y + 20 }, { x: to.x + to.width / 2, y: to.y + 300 });

  await expect(page.getByText(`Scheduled “${task.title}” · ${short(friday)}`)).toBeVisible();
  await expect
    .poll(async () => getTask(request, task.id))
    .toMatchObject({ scheduled_date: friday });
  await expect(inbox.getByText(task.title)).toHaveCount(0);
});

test("a routine opens its steps, and checking one logs it for that day", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Health"), "rose");
  const routine = await createRoutine(request, {
    title: unique("Evening"),
    starts_on: addDays(today, -7),
  });
  const step = await createRoutineStep(request, routine, {
    title: unique("Stretch"),
    life_area_id: area.id,
    starts_on: addDays(today, -7),
  });

  await page.goto("/calendar");
  await cell(page, today)
    .getByRole("button", { name: `${routine.title}, 0 of 1 steps done` })
    .click();
  const popover = page.getByRole("dialog", { name: "Routine" });
  await popover.getByRole("checkbox", { name: `Mark ${step.title} done` }).click();

  await expect(
    cell(page, today).getByRole("button", { name: `${routine.title}, 1 of 1 steps done` }),
  ).toBeVisible();
  await expect(
    popover.getByRole("checkbox", { name: `Mark ${step.title} not done` }),
  ).toBeChecked();
});

test("clicking a day offers a new task on that day", async ({ page, request }) => {
  const today = await serverToday(request);
  const tuesday = addDays(futureMonday(today), 1);
  await openFutureWeek(page, today);

  const day = await box(cell(page, tuesday));
  await page.mouse.click(day.x + day.width / 2, day.y + day.height - 60);
  await page.getByRole("button", { name: "Task", exact: true }).click();

  const modal = page.getByRole("dialog", { name: "New task" });
  await expect(modal.getByRole("button", { name: "Scheduled" })).toContainText(short(tuesday));
});

test("Month: a full day ends with +n more, which opens the whole day", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Finance"), "teal");
  // The 10th of the month after next: no other spec reaches it.
  const [year, month] = today.split("-").map(Number);
  const target = new Date(Date.UTC(year, month + 1, 10)).toISOString().slice(0, 10);
  const titles = Array.from({ length: 12 }, (_, i) => unique(`Errand ${i}`));
  for (const title of titles) {
    await postTask(request, { life_area_id: area.id, title, scheduled_date: target });
  }

  await page.goto("/calendar");
  await page.getByRole("radio", { name: "Month" }).click();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Next month" }).click();
  await cell(page, target)
    .getByText(/^\+\d+ more$/)
    .click();

  const day = page.getByRole("dialog", { name: `Everything on ${target}` });
  for (const title of titles) await expect(day.getByRole("button", { name: title })).toBeVisible();
});
