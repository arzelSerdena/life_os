import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { LifeAreaRead } from "../../client/types.gen";
import { emptyOverview, lifeArea, renderApp } from "../../test-utils";

type RecordedRequest = { method: string; path: string; body: unknown };

let areas: LifeAreaRead[];
let requests: RecordedRequest[];
let deleteError: string | null;
let listFailures: number;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A small in-memory stand-in for the Life Area API. */
async function fakeApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const body = request.method === "GET" ? undefined : await request.json().catch(() => undefined);
  requests.push({ method: request.method, path: url.pathname, body });

  const [, , , idText, action] = url.pathname.split("/");
  const id = Number(idText);
  const index = areas.findIndex((area) => area.id === id);

  if (request.method === "GET" && idText === "overview") {
    return json(emptyOverview(areas.filter((area) => area.archived_at === null)));
  }
  if (request.method === "GET" && idText) {
    return index === -1 ? json({ detail: "Life area not found." }, 404) : json(areas[index]);
  }
  if (request.method === "GET") {
    if (listFailures > 0) {
      listFailures -= 1;
      return json({ detail: "The database is unavailable." }, 500);
    }
    const includeArchived = url.searchParams.get("include_archived") === "true";
    return json(areas.filter((area) => includeArchived || area.archived_at === null));
  }
  if (request.method === "POST" && idText === "reorder") {
    const ids = (body as { life_area_ids: number[] }).life_area_ids;
    areas.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    return json(areas.filter((area) => area.archived_at === null));
  }
  if (request.method === "POST" && !idText) {
    const created = lifeArea({ ...(body as Partial<LifeAreaRead>), id: areas.length + 1 });
    areas.push(created);
    return json(created, 201);
  }
  if (request.method === "PATCH") {
    areas[index] = { ...areas[index], ...(body as Partial<LifeAreaRead>) };
    return json(areas[index]);
  }
  if (action === "archive" || action === "unarchive") {
    areas[index] = {
      ...areas[index],
      archived_at: action === "archive" ? "2026-11-10T01:00:00Z" : null,
    };
    return json(areas[index]);
  }
  if (deleteError) {
    return json({ detail: deleteError }, 409);
  }
  areas.splice(index, 1);
  return new Response(null, { status: 204 });
}

function writes(): RecordedRequest[] {
  return requests.filter((request) => request.method !== "GET");
}

function sidebarAreas() {
  return within(screen.getByRole("navigation", { name: "Life areas" }));
}

beforeEach(() => {
  areas = [];
  requests = [];
  deleteError = null;
  listFailures = 0;
  vi.stubGlobal("fetch", vi.fn(fakeApi));
});

test("lists the active areas in the sidebar", async () => {
  areas = [
    lifeArea({ id: 1, title: "Career" }),
    lifeArea({ id: 2, title: "Old hobby", archived_at: "2026-11-10T01:00:00Z" }),
  ];
  renderApp();

  expect(await sidebarAreas().findByRole("link", { name: "Career" })).toHaveAttribute(
    "href",
    "/areas/1",
  );
  expect(sidebarAreas().queryByRole("link", { name: "Old hobby" })).not.toBeInTheDocument();
});

test("creates an area with the first free color, then opens its page", async () => {
  areas = [lifeArea({ id: 1, title: "Career", color: "blue" })];
  const user = userEvent.setup();
  renderApp();

  await user.click(await screen.findByRole("button", { name: "New area" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("radio", { name: /Teal/ })).toBeChecked();
  expect(within(dialog).getByRole("radio", { name: "Blue, used by Career" })).not.toBeChecked();
  await user.type(within(dialog).getByLabelText("Name"), "  Health  ");
  await user.type(within(dialog).getByLabelText(/^Vision/), "Feel strong");
  await user.click(within(dialog).getByRole("button", { name: "Create area" }));

  expect(await screen.findByRole("heading", { name: "Health" })).toBeInTheDocument();
  expect(screen.getByText("Feel strong")).toBeInTheDocument();
  expect(await sidebarAreas().findByRole("link", { name: "Health" })).toBeInTheDocument();
  expect(writes()).toEqual([
    {
      method: "POST",
      path: "/api/life-areas",
      body: { title: "Health", vision: "Feel strong", color: "teal" },
    },
  ]);
});

test("asks for a name before saving", async () => {
  const user = userEvent.setup();
  renderApp();

  await user.click(await screen.findByRole("button", { name: "New life area" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Create area" }));

  expect(await within(dialog).findByText("Enter a name.")).toBeInTheDocument();
  expect(writes()).toEqual([]);
});

test("edits an area from its page with its current values filled in", async () => {
  areas = [lifeArea({ title: "Health", vision: "Feel strong", notes: "Keep these" })];
  const user = userEvent.setup();
  renderApp("/areas/1");

  await user.click(await screen.findByRole("button", { name: "More actions for Health" }));
  await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
  const dialog = await screen.findByRole("dialog");
  const title = within(dialog).getByLabelText("Name");
  expect(title).toHaveValue("Health");
  expect(within(dialog).getByLabelText(/^Vision/)).toHaveValue("Feel strong");

  await user.clear(title);
  await user.type(title, "Fitness");
  await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

  expect(await screen.findByRole("heading", { name: "Fitness" })).toBeInTheDocument();
  expect(writes()[0]).toMatchObject({
    method: "PATCH",
    path: "/api/life-areas/1",
    body: { title: "Fitness", vision: "Feel strong", color: "teal" },
  });
  expect(writes()[0].body).toMatchObject({ notes: "Keep these" });
});

test("archives an area, then restores it from the archived areas", async () => {
  areas = [lifeArea()];
  const user = userEvent.setup();
  renderApp("/areas/1");

  await user.click(await screen.findByRole("button", { name: "More actions for Health" }));
  await user.click(await screen.findByRole("menuitem", { name: "Archive" }));

  expect(await screen.findByRole("heading", { name: "Life areas" })).toBeInTheDocument();
  await waitFor(() =>
    expect(sidebarAreas().queryByRole("link", { name: "Health" })).not.toBeInTheDocument(),
  );

  await user.click(screen.getByRole("link", { name: "Archived areas" }));
  await user.click(await screen.findByRole("button", { name: "Restore" }));

  expect(await screen.findByText("No archived areas.")).toBeInTheDocument();
  expect(await sidebarAreas().findByRole("link", { name: "Health" })).toBeInTheDocument();
});

test("deletes an area after confirmation", async () => {
  areas = [lifeArea()];
  const user = userEvent.setup();
  renderApp("/areas/1");

  await user.click(await screen.findByRole("button", { name: "More actions for Health" }));
  await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(writes()).toEqual([]);
  await user.click(within(dialog).getByRole("button", { name: "Delete" }));

  expect(await screen.findByText("Set up your first life area")).toBeInTheDocument();
  expect(writes()).toEqual([{ method: "DELETE", path: "/api/life-areas/1", body: undefined }]);
});

test("explains why a delete was refused and keeps the area", async () => {
  areas = [lifeArea({ archived_at: "2026-11-10T01:00:00Z" })];
  deleteError = "Life area 1 still has items in it. Archive it instead.";
  const user = userEvent.setup();
  renderApp("/areas/archived");

  await user.click(await screen.findByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Delete" }));

  expect(await within(dialog).findByText(deleteError)).toBeInTheDocument();
  expect(areas).toHaveLength(1);
});

test("shows an error when the areas can't load, and can try again", async () => {
  listFailures = 1;
  const user = userEvent.setup();
  renderApp();

  expect(await screen.findByText("The database is unavailable.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Try again" }));

  expect(await screen.findByText("Set up your first life area")).toBeInTheDocument();
});

test("with no areas, offers a first area and quick starts that fill in the pop-up", async () => {
  const user = userEvent.setup();
  renderApp();

  expect(await screen.findByText("Set up your first life area")).toBeInTheDocument();
  expect(screen.getByText("No life areas yet. Use + to add one.")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Quarter" })).toBeDisabled();

  await user.click(screen.getByRole("button", { name: "Relationships" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByLabelText("Name")).toHaveValue("Relationships");
  expect(within(dialog).getByRole("radio", { name: /Ochre/ })).toBeChecked();
});

test("with areas but no data yet, each card says what will appear", async () => {
  areas = [lifeArea({ id: 1, title: "Career", color: "blue" })];
  renderApp();

  const outcomes = await screen.findByRole("region", { name: "Outcomes" });
  expect(within(outcomes).getByRole("heading", { name: /Career/ })).toBeInTheDocument();
  expect(within(outcomes).getAllByText("No metrics yet")).toHaveLength(2);
  expect(screen.getByRole("region", { name: "Projects" })).toHaveTextContent("No active projects.");
});

test("reorders the areas by dragging them in the Reorder areas pop-up", async () => {
  areas = [
    lifeArea({ id: 1, title: "Career", color: "blue" }),
    lifeArea({ id: 2, title: "Finance", color: "teal" }),
  ];
  const user = userEvent.setup();
  renderApp();

  await user.click(await screen.findByRole("button", { name: "More actions" }));
  await user.click(await screen.findByRole("menuitem", { name: "Reorder areas" }));
  const dialog = await screen.findByRole("dialog");
  within(dialog).getByRole("button", { name: "Move Finance" }).focus();
  await user.keyboard("[Space]");
  await user.keyboard("[ArrowUp]");
  await user.keyboard("[Space]");
  await user.click(within(dialog).getByRole("button", { name: "Save order" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(writes()).toEqual([
    { method: "POST", path: "/api/life-areas/reorder", body: { life_area_ids: [2, 1] } },
  ]);
  await waitFor(() =>
    expect(
      sidebarAreas()
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Finance", "Career"]),
  );
});

test("the period switch steps through periods", async () => {
  areas = [lifeArea()];
  const user = userEvent.setup();
  renderApp();

  await user.click(await screen.findByRole("radio", { name: "Year" }));
  const label = String(new Date().getFullYear());
  expect(screen.getByText(label)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Next period" }));
  expect(screen.getByText(String(Number(label) + 1))).toBeInTheDocument();
});
