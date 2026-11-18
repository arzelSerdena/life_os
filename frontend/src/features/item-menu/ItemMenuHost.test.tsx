import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createQueryClient } from "../../queryClient";
import { useChangeToast } from "../../stores/changeToastStore";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { taskRead } from "../../test-utils";
import { ItemMenuHost } from "./ItemMenuHost";
import { decodeItem, encodeItem, itemMenuProps } from "./target";

const task = taskRead({ id: 3, title: "Buy running shoes" });
let calls: string[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      calls.push(`${request.method} ${url.pathname}`);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
      if (url.pathname === "/api/tasks/3/complete") {
        return json({ task: { ...task, status: "done" }, batch_id: "b1" });
      }
      if (url.pathname === "/api/tasks/3") return json(task);
      return json([]);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  useDetailPanel.getState().close();
  useChangeToast.getState().dismiss();
});

/** The host only answers right-clicks inside #root, as in the app. */
function renderWithRows() {
  const root = document.body.appendChild(document.createElement("div"));
  root.id = "root";
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <ul>
          <li {...itemMenuProps({ kind: "task", id: 3 })}>
            <span>Buy running shoes</span>
            <input aria-label="Note" />
          </li>
          <li>Not an item</li>
        </ul>
        <ItemMenuHost />
      </MemoryRouter>
    </QueryClientProvider>,
    { container: root },
  );
}

test("encodes and decodes every kind of item", () => {
  const targets = [
    { kind: "area", id: 1 },
    { kind: "project", id: 2 },
    { kind: "task", id: 3 },
    { kind: "template", id: 4 },
    { kind: "event", id: 5, day: "2026-11-18" },
    { kind: "event", id: 5, day: null },
    { kind: "metric", id: 6 },
    { kind: "routine", id: 7 },
    { kind: "step", id: 8, routineId: 7 },
  ] as const;
  for (const target of targets) expect(decodeItem(encodeItem(target))).toEqual(target);
  expect(decodeItem("task:abc")).toBeNull();
  expect(decodeItem("goal:1")).toBeNull();
  expect(decodeItem("step:8")).toBeNull();
});

test("right-clicking a row opens its item's ⋯ menu, whose actions work", async () => {
  renderWithRows();
  const notPrevented = fireEvent.contextMenu(screen.getByText("Buy running shoes"));
  expect(notPrevented).toBe(false);

  const menu = await screen.findByRole("menu", { name: "More actions for “Buy running shoes”" });
  const items = within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent);
  expect(items).toEqual(["Complete task", "Archive task", "Delete task"]);

  await userEvent.click(within(menu).getByRole("menuitem", { name: "Complete task" }));
  await waitFor(() => expect(calls).toContain("POST /api/tasks/3/complete"));
  await waitFor(() =>
    expect(useChangeToast.getState().change?.message).toBe("Completed “Buy running shoes”"),
  );
  expect(screen.queryByRole("menu")).toBeNull();
});

test("text fields and unmarked places keep the browser's menu", () => {
  renderWithRows();
  expect(fireEvent.contextMenu(screen.getByRole("textbox", { name: "Note" }))).toBe(true);
  expect(fireEvent.contextMenu(screen.getByText("Not an item"))).toBe(true);
  expect(screen.queryByRole("menu")).toBeNull();
});

test("Esc closes the menu without changing anything", async () => {
  renderWithRows();
  fireEvent.contextMenu(screen.getByText("Buy running shoes"));
  await screen.findByRole("menu");
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(calls.filter((call) => call.startsWith("POST"))).toEqual([]);
});
