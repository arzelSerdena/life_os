import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { emptyAreaPage, lifeArea, renderApp } from "../../test-utils";

const career = lifeArea({ id: 1, title: "Career", color: "blue" });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const { pathname } = new URL(request.url, "http://localhost");
      if (pathname === "/api/life-areas") return json([career]);
      if (pathname === "/api/life-areas/1") return json(career);
      if (pathname === "/api/life-areas/1/page") return json(emptyAreaPage(career));
      if (pathname === "/api/projects") return json([]);
      if (pathname === "/api/routines") return json([]);
      return json({});
    }),
  );
});

test("pristine modal closes on Escape without prompting, dirty modal asks to discard", async () => {
  const user = userEvent.setup();
  renderApp("/areas/1");
  await screen.findByRole("region", { name: "Projects" });

  // Open New metric and press Escape immediately — closes with no prompt
  await user.click(screen.getByRole("button", { name: "Add" }));
  await user.click(await screen.findByRole("menuitem", { name: "Metric" }));
  await screen.findByRole("dialog");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

  // Open New metric, type a name, press Escape — prompts Discard changes?
  await user.click(screen.getByRole("button", { name: "Add" }));
  await user.click(await screen.findByRole("menuitem", { name: "Metric" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Name"), "Applications");
  await user.keyboard("{Escape}");

  const confirm = await screen.findByRole("alertdialog");
  expect(confirm).toHaveTextContent("Discard changes?");
  await user.click(within(confirm).getByRole("button", { name: "Keep editing" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(within(screen.getByRole("dialog")).getByLabelText("Name")).toHaveValue("Applications");

  // Escape again and click Discard — closes both
  await user.keyboard("{Escape}");
  const confirmAgain = await screen.findByRole("alertdialog");
  await user.click(within(confirmAgain).getByRole("button", { name: "Discard" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("New area (React Hook Form) prompts before discarding edits on Escape", async () => {
  const user = userEvent.setup();
  renderApp("/areas/1");
  await screen.findByRole("region", { name: "Projects" });

  await user.click(await screen.findByRole("button", { name: "New life area" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Name"), "Health");
  await user.keyboard("{Escape}");

  const confirm = await screen.findByRole("alertdialog");
  expect(confirm).toHaveTextContent("Discard changes?");
  await user.click(within(confirm).getByRole("button", { name: "Discard" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
