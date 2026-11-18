import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { HomeRead } from "../../client/types.gen";
import { emptyHome, lifeArea, renderApp, taskRead } from "../../test-utils";

const career = lifeArea({ id: 1, title: "Career", color: "blue" });

let home: HomeRead;
let posts: { path: string; body: unknown }[];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  posts = [];
  home = emptyHome();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "POST") {
        posts.push({ path: url.pathname, body: await request.json() });
        return json(taskRead({ title: "Call the landlord" }), 201);
      }
      switch (url.pathname) {
        case "/api/home":
          return json(home);
        case "/api/life-areas":
          return json([career]);
        default:
          return json([]);
      }
    }),
  );
});

test("first run lists what to set up, with a check for what exists", async () => {
  home = emptyHome({ setup: { life_area: "Career", routine: null, task: null } });
  renderApp("/home");

  expect(await screen.findByRole("heading", { name: "Set up Life OS" })).toBeInTheDocument();
  const rows = within(screen.getByRole("list", { name: "Setup" })).getAllByRole("listitem");
  expect(rows.map((row) => row.textContent)).toEqual([
    "Life areaCareer",
    "RoutineNone yetNew routine",
    "TaskNone yetNew task",
  ]);
  expect(within(rows[0]).getByLabelText("Done")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Today" })).not.toBeInTheDocument();
});

test("Home shows the date, the done count and its cards", async () => {
  home = emptyHome({
    tasks: [taskRead({ title: "Buy groceries", scheduled_date: "2026-11-14" })],
    completed: [taskRead({ title: "Run 5 km", status: "done" })],
    inbox: 2,
  });
  renderApp("/");

  expect(
    await screen.findByRole("heading", { level: 1, name: "Saturday, Nov 14" }),
  ).toBeInTheDocument();
  expect(screen.getByText("1 of 2 done")).toBeInTheDocument();
  const today = screen.getByRole("region", { name: "Today" });
  expect(within(today).getByText("Buy groceries")).toBeInTheDocument();
  // Completed starts collapsed.
  expect(within(today).queryByText("Run 5 km")).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Routines today" })).toHaveTextContent(
    "No routines due today.",
  );
  // Log today is hidden when nothing needs a log.
  expect(screen.queryByRole("region", { name: "Log today" })).not.toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Needs a push" })).getByRole("link", {
      name: /Inbox/,
    }),
  ).toHaveAttribute("href", "/tasks/inbox");
});

test("quick add creates a task scheduled today with no owner", async () => {
  const user = userEvent.setup();
  renderApp("/home");

  const add = await screen.findByRole("textbox", { name: "Add task" });
  await user.type(add, "Call the landlord{Enter}");

  await waitFor(() =>
    expect(posts).toEqual([
      { path: "/api/tasks", body: { title: "Call the landlord", scheduled_date: "2026-11-14" } },
    ]),
  );
  await waitFor(() => expect(add).toHaveValue(""));
});

test("nothing scheduled today offers to plan from the Inbox", async () => {
  home = emptyHome({ inbox: 6 });
  renderApp("/home");

  const today = await screen.findByRole("region", { name: "Today" });
  expect(today).toHaveTextContent("Nothing scheduled today.");
  expect(within(today).getByRole("button", { name: /Plan from Inbox/ })).toHaveTextContent("6");
  expect(screen.getByRole("region", { name: "Needs a push" })).not.toHaveTextContent(
    "Nothing needs a push.",
  );
});
