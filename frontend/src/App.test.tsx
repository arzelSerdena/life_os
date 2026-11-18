import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { SIDEBAR_DEFAULT_WIDTH, useSidebarStore } from "./stores/sidebarStore";
import { emptyHome, renderApp } from "./test-utils";

beforeEach(() => {
  useSidebarStore.setState({ collapsed: false, width: SIDEBAR_DEFAULT_WIDTH });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      // Every list is empty; Finished & archived and Home each read one object.
      const path = new URL(request.url).pathname;
      const empty =
        path === "/api/archive"
          ? { areas: [], projects: [], routines: [] }
          : path === "/api/home"
            ? emptyHome({ setup: { life_area: null, routine: null, task: null } })
            : [];
      return new Response(JSON.stringify(empty), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});

test.each(["/", "/not-a-page"])("%s opens Home", async (path) => {
  renderApp(path);

  expect(await screen.findByRole("heading", { name: "Set up Life OS" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
});

test("the rail and the sidebar mark the current page", async () => {
  renderApp();

  expect(await screen.findByRole("link", { name: "Plan" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Life areas" })).toHaveAttribute("aria-current", "page");
});

test("Ctrl + B hides the sidebar, and the open group's rail icon brings it back", async () => {
  const user = userEvent.setup();
  renderApp("/areas");
  expect(await screen.findByRole("complementary", { name: "Plan" })).toBeInTheDocument();

  await user.keyboard("{Control>}b{/Control}");
  expect(screen.queryByRole("complementary", { name: "Plan" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("link", { name: "Plan" }));
  expect(screen.getByRole("complementary", { name: "Plan" })).toBeInTheDocument();
  expect(useSidebarStore.getState().collapsed).toBe(false);
});

test("the sidebar's border resizes it from the keyboard, within its limits", async () => {
  const user = userEvent.setup();
  renderApp("/areas");

  const handle = await screen.findByRole("separator", { name: "Resize sidebar" });
  handle.focus();
  await user.keyboard("{ArrowRight}");
  expect(useSidebarStore.getState().width).toBe(256);
  for (let i = 0; i < 10; i += 1) await user.keyboard("{ArrowRight}");
  expect(useSidebarStore.getState().width).toBe(320);
  await user.dblClick(handle);
  expect(useSidebarStore.getState().width).toBe(240);
});

test("the hide button hides the sidebar", async () => {
  const user = userEvent.setup();
  renderApp("/areas");

  await user.click(await screen.findByRole("button", { name: "Hide sidebar" }));

  expect(screen.queryByRole("complementary", { name: "Plan" })).not.toBeInTheDocument();
});

test("in a narrow window the sidebar is shown and docked, not floating", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const user = userEvent.setup();
  renderApp("/areas");

  const sidebar = await screen.findByRole("complementary", { name: "Plan" });
  expect(sidebar).not.toHaveClass("absolute");
  expect(screen.getByRole("separator", { name: "Resize sidebar" })).toBeInTheDocument();

  // A choice in the sidebar keeps it open.
  await user.click(screen.getByRole("link", { name: "Finished & archived" }));
  expect(screen.getByRole("complementary", { name: "Plan" })).toBeInTheDocument();
});
