import { expect, type Page, test } from "@playwright/test";
import { addDays, createArea, listEvents, mondayOf, serverToday, unique } from "./api.ts";

// New event against a real API: from the Calendar's add menu (timed, with its owner, times
// and location), all day over several days with a repeat, and from an area's Add menu. The
// tests share one database, so the Calendar ones work four weeks ahead.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Tue, Nov 17", as the date fields show it. */
const dayDate = (day: string) =>
  `${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]}, ${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8))}`;

const cell = (page: Page, day: string) => page.locator(`.calendar-day[data-date="${day}"]`);

/** Opens the Calendar on the week four weeks ahead and clicks an empty spot of `day`. */
async function addOn(page: Page, day: string) {
  await page.goto("/calendar");
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Next week" }).click();
  const found = await cell(page, day).boundingBox();
  if (!found) throw new Error("Not on screen");
  await page.mouse.click(found.x + found.width / 2, found.y + found.height - 60);
}

async function pickOwner(page: Page, title: string) {
  const modal = page.getByRole("dialog", { name: "New event" });
  await modal.getByRole("button", { name: "Owner" }).click();
  await page.getByRole("textbox", { name: "Search" }).fill(title);
  await page.getByRole("dialog", { name: "Owner" }).getByRole("button", { name: title }).click();
  await expect(page.getByRole("textbox", { name: "Search" })).toBeHidden();
}

async function pickTime(page: Page, field: string, time: string) {
  await page.getByRole("button", { name: field }).click();
  await page
    .getByRole("group", { name: "Times" })
    .getByRole("button", { name: time, exact: true })
    .click();
  await expect(page.getByRole("group", { name: "Times" })).toBeHidden();
}

test("the Calendar's add menu creates a timed event on that day", async ({ page, request }) => {
  const today = await serverToday(request);
  const tuesday = addDays(mondayOf(today), 29);
  const area = await createArea(request, unique("Relationships"), "ochre");
  await addOn(page, tuesday);
  await page.getByRole("button", { name: "Event", exact: true }).click();

  const modal = page.getByRole("dialog", { name: "New event" });
  const create = modal.getByRole("button", { name: "Create event" });
  await expect(modal.getByRole("button", { name: "Start date" })).toContainText(dayDate(tuesday));
  const title = unique("Coffee with Mia");
  await modal.getByRole("textbox", { name: "Name" }).fill(title);
  // An event always has an owner.
  await expect(create).toBeDisabled();
  await pickOwner(page, area.title);
  await expect(modal.getByRole("button", { name: "Owner" })).toContainText(area.title);

  // Moving the start keeps the hour (late at night it starts out ending the next day); the
  // end list shows durations.
  await pickTime(page, "Start time", "2 PM");
  await expect(modal.getByRole("button", { name: "End date" })).toContainText(dayDate(tuesday));
  await expect(modal.getByRole("button", { name: "End time" })).toContainText("3 PM");
  await modal.getByRole("button", { name: "End time" }).click();
  await expect(page.getByRole("group", { name: "Times" })).toContainText("1 h 30 m");
  await page
    .getByRole("group", { name: "Times" })
    .getByRole("button", { name: "3:30 PM 1 h 30 m", exact: true })
    .click();
  await modal.getByRole("textbox", { name: "Location" }).fill("Blue Bottle");
  await create.click();

  await expect(modal).toBeHidden();
  await expect(cell(page, tuesday).getByText(title)).toBeVisible();
  const events = await listEvents(request);
  expect(events.find((event) => event.title === title)).toMatchObject({
    life_area_id: area.id,
    start_date: tuesday,
    end_date: null,
    start_time: "14:00:00",
    end_time: "15:30:00",
    location: "Blue Bottle",
    rrule: null,
  });
});

test("an all-day event over several days can repeat", async ({ page, request }) => {
  const today = await serverToday(request);
  const wednesday = addDays(mondayOf(today), 30);
  const friday = addDays(wednesday, 2);
  const area = await createArea(request, unique("Career"));
  await addOn(page, wednesday);
  await page.getByRole("button", { name: "Event", exact: true }).click();

  const modal = page.getByRole("dialog", { name: "New event" });
  const title = unique("Hackathon");
  await modal.getByRole("textbox", { name: "Name" }).fill(title);
  await pickOwner(page, area.title);
  await modal.getByText("All day").click();
  await expect(modal.getByRole("button", { name: "Start time" })).toBeHidden();

  await modal.getByRole("button", { name: "End date" }).click();
  await page.getByRole("textbox", { name: "Date" }).fill(friday);
  await page.getByRole("textbox", { name: "Date" }).press("Enter");
  await expect(modal.getByRole("button", { name: "End date" })).toContainText(dayDate(friday));

  await modal.getByRole("button", { name: "Repeat" }).click();
  await page.getByRole("button", { name: "Every week Wed" }).click();
  await expect(modal.getByRole("button", { name: "Repeat" })).toContainText("Every Wed");
  await modal.getByRole("button", { name: "Create event" }).click();

  await expect(modal).toBeHidden();
  const events = await listEvents(request);
  expect(events.find((event) => event.title === title)).toMatchObject({
    start_date: wednesday,
    end_date: friday,
    start_time: null,
    end_time: null,
    rrule: "FREQ=WEEKLY;BYDAY=WE",
    repeat_ends_on: null,
  });
});

test("an end before the start can't be created", async ({ page, request }) => {
  const today = await serverToday(request);
  const thursday = addDays(mondayOf(today), 31);
  await addOn(page, thursday);
  await page.getByRole("button", { name: "Event", exact: true }).click();

  const modal = page.getByRole("dialog", { name: "New event" });
  await modal.getByRole("button", { name: "End date" }).click();
  await page.getByRole("textbox", { name: "Date" }).fill(addDays(thursday, -1));
  await page.getByRole("textbox", { name: "Date" }).press("Enter");
  await expect(modal.getByText("The event ends before it starts.")).toBeVisible();
  await expect(modal.getByRole("button", { name: "Create event" })).toBeDisabled();
});

test("an area's Add menu opens New event in that area", async ({ page, request }) => {
  const area = await createArea(request, unique("Health"), "rose");
  await page.goto(`/areas/${area.id}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: "Event" }).click();

  const modal = page.getByRole("dialog", { name: "New event" });
  await expect(modal.getByRole("button", { name: "Owner" })).toContainText(area.title);
  const title = unique("Dentist");
  await modal.getByRole("textbox", { name: "Name" }).fill(title);
  await modal.getByRole("textbox", { name: "Name" }).press("Enter");

  await expect(modal).toBeHidden();
  const events = await listEvents(request);
  expect(events.find((event) => event.title === title)).toMatchObject({ life_area_id: area.id });
});
