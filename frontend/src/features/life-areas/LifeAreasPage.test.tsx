import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { LifeAreaRead } from "../../client/types.gen";
import { lifeArea, renderApp } from "../../test-utils";

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

  if (request.method === "GET") {
    if (listFailures > 0) {
      listFailures -= 1;
      return json({ detail: "The database is unavailable." }, 500);
    }
    const includeArchived = url.searchParams.get("include_archived") === "true";
    return json(areas.filter((area) => includeArchived || area.archived_at === null));
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

beforeEach(() => {
  areas = [];
  requests = [];
  deleteError = null;
  listFailures = 0;
  vi.stubGlobal("fetch", vi.fn(fakeApi));
});

test("creates a life area from the form", async () => {
  const user = userEvent.setup();
  renderApp();

  await user.click(await screen.findByRole("button", { name: "Create a life area" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Title"), "  Health  ");
  await user.type(within(dialog).getByLabelText("Vision"), "Feel strong");
  await user.click(within(dialog).getByRole("button", { name: "Create life area" }));

  expect(await screen.findByText("Feel strong")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(writes()).toEqual([
    {
      method: "POST",
      path: "/api/life-areas",
      body: { title: "Health", vision: "Feel strong", notes: null, color: "#F43F5E" },
    },
  ]);
});

test("asks for a title before saving", async () => {
  const user = userEvent.setup();
  renderApp();

  await user.click(await screen.findByRole("button", { name: "New life area" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Create life area" }));

  expect(await within(dialog).findByText("Enter a title.")).toBeInTheDocument();
  expect(writes()).toEqual([]);
});

test("edits a life area with its current values filled in", async () => {
  areas = [lifeArea({ title: "Health", vision: "Feel strong" })];
  const user = userEvent.setup();
  renderApp();

  await user.click(await screen.findByRole("button", { name: "Edit Health" }));
  const dialog = await screen.findByRole("dialog");
  const title = within(dialog).getByLabelText("Title");
  expect(title).toHaveValue("Health");
  expect(within(dialog).getByLabelText("Vision")).toHaveValue("Feel strong");

  await user.clear(title);
  await user.type(title, "Fitness");
  await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Fitness")).toBeInTheDocument();
  expect(writes()[0]).toMatchObject({
    method: "PATCH",
    path: "/api/life-areas/1",
    body: { title: "Fitness", vision: "Feel strong" },
  });
});

test("archives a life area, then restores it from the archived view", async () => {
  areas = [lifeArea()];
  const user = userEvent.setup();
  renderApp();

  await user.click(await screen.findByRole("button", { name: "Archive Health" }));

  expect(await screen.findByText("No active life areas.")).toBeInTheDocument();

  await user.click(screen.getByRole("switch", { name: "Show archived" }));
  expect(await screen.findByText("Archived")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Restore Health" }));

  await waitFor(() => expect(screen.queryByText("Archived")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Archive Health" })).toBeInTheDocument();
});

test("deletes a life area after confirmation", async () => {
  areas = [lifeArea()];
  const user = userEvent.setup();
  renderApp();

  await user.click(await screen.findByRole("button", { name: "Delete Health" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(writes()).toEqual([]);
  await user.click(within(dialog).getByRole("button", { name: "Delete" }));

  expect(await screen.findByText("No active life areas.")).toBeInTheDocument();
  expect(writes()).toEqual([{ method: "DELETE", path: "/api/life-areas/1", body: undefined }]);
});

test("explains why a delete was refused and keeps the life area", async () => {
  areas = [lifeArea()];
  deleteError = "Life area 1 still has items in it. Archive it instead.";
  const user = userEvent.setup();
  renderApp();

  await user.click(await screen.findByRole("button", { name: "Delete Health" }));
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Delete" }));

  expect(await within(dialog).findByText(deleteError)).toBeInTheDocument();
  expect(areas).toHaveLength(1);
});

test("shows an error when the list can't load, and can try again", async () => {
  areas = [lifeArea()];
  listFailures = 1;
  const user = userEvent.setup();
  renderApp();

  expect(await screen.findByText("The database is unavailable.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Try again" }));

  expect(await screen.findByRole("button", { name: "Edit Health" })).toBeInTheDocument();
});
