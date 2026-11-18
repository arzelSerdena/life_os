import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { SearchHitRead } from "../../client/types.gen";
import { createQueryClient } from "../../queryClient";
import { useCommands } from "../../stores/commandStore";
import { useDetailPanel } from "../../stores/detailPanelStore";
import { useNewTask } from "../../stores/newTaskStore";
import { CommandPaletteHost } from "./CommandPalette";
import { useCommandShortcuts } from "./commandShortcuts";
import { ShortcutsHost } from "./ShortcutsDialog";

const hits: SearchHitRead[] = [
  {
    kind: "project",
    id: 7,
    title: "Run a marathon",
    status: "active",
    life_area_id: 1,
    life_area_title: "Health",
    life_area_color: "teal",
    project_id: null,
    project_title: null,
  },
  {
    kind: "task",
    id: 3,
    title: "Buy running shoes",
    status: "todo",
    life_area_id: 1,
    life_area_title: "Health",
    life_area_color: "teal",
    project_id: 7,
    project_title: "Run a marathon",
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (url.pathname === "/api/search") {
        return new Response(JSON.stringify(hits), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("[]", { headers: { "Content-Type": "application/json" } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  useCommands.getState().close();
  useDetailPanel.getState().close();
  useNewTask.getState().close();
});

function Where() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function Shell() {
  useCommandShortcuts();
  return (
    <>
      <Where />
      <CommandPaletteHost />
      <ShortcutsHost />
    </>
  );
}

function renderShell() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="*" element={<Shell />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test("Ctrl K opens the palette with the commands, and a command runs", async () => {
  const user = userEvent.setup();
  renderShell();

  await user.keyboard("{Control>}k{/Control}");
  const input = await screen.findByRole("combobox", { name: "Search or run a command" });
  expect(input).toHaveFocus();
  expect(screen.getByRole("option", { name: /New task/ })).toHaveAttribute("aria-selected", "true");

  await user.type(input, "today");
  await user.keyboard("{Enter}");

  expect(screen.getByTestId("path")).toHaveTextContent("/tasks/today");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

test("typing finds items, the arrows move, and Enter opens a task in the panel", async () => {
  const user = userEvent.setup();
  renderShell();
  act(() => useCommands.getState().show("palette"));

  await user.type(await screen.findByRole("combobox"), "run");
  const task = await screen.findByRole("option", { name: /Buy running shoes/ });
  expect(task).toHaveTextContent("Health · Run a marathon");
  expect(screen.getByRole("option", { name: /^Run a marathon/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await user.keyboard("{ArrowDown}");
  expect(task).toHaveAttribute("aria-selected", "true");
  await user.keyboard("{Enter}");

  expect(useDetailPanel.getState().target).toEqual({ kind: "task", id: 3 });
  expect(screen.getByTestId("path")).toHaveTextContent("/home");
});

test("clicking a project opens its page", async () => {
  const user = userEvent.setup();
  renderShell();
  act(() => useCommands.getState().show("palette"));

  await user.type(await screen.findByRole("combobox"), "mara");
  await user.click(await screen.findByRole("option", { name: /^Run a marathon/ }));

  expect(screen.getByTestId("path")).toHaveTextContent("/areas/projects/7");
});

test("says so when nothing matches", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("[]", { headers: { "Content-Type": "application/json" } })),
  );
  const user = userEvent.setup();
  renderShell();
  act(() => useCommands.getState().show("palette"));

  await user.type(await screen.findByRole("combobox"), "zebra");

  expect(await screen.findByText("No matches.")).toBeInTheDocument();
});

test("Esc and Ctrl K close it again", async () => {
  const user = userEvent.setup();
  renderShell();

  await user.keyboard("{Control>}k{/Control}");
  await screen.findByRole("combobox");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());

  await user.keyboard("{Control>}k{/Control}");
  await screen.findByRole("combobox");
  await user.keyboard("{Control>}k{/Control}");
  await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
});

test("New task closes the palette and opens New task", async () => {
  const user = userEvent.setup();
  renderShell();
  act(() => useCommands.getState().show("palette"));

  await user.click(await screen.findByRole("option", { name: /New task/ }));

  expect(useNewTask.getState().spot).toEqual({});
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

test("? lists the shortcuts, but not while typing", async () => {
  const user = userEvent.setup();
  renderShell();
  const field = document.createElement("input");
  document.body.append(field);

  field.focus();
  await user.keyboard("?");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  field.blur();
  await user.keyboard("?");
  const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
  expect(dialog).toHaveTextContent("Week, Month, Quarter, Year");
  field.remove();
});
