import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { SIDEBAR_DEFAULT_WIDTH, useSidebarStore } from "./stores/sidebarStore";
import { renderApp } from "./test-utils";

beforeEach(() => {
  useSidebarStore.setState({ collapsed: false, width: SIDEBAR_DEFAULT_WIDTH, overlayOpen: false });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    ),
  );
});

test.each(["/", "/not-a-page"])("%s opens the life areas overview", async (path) => {
  renderApp(path);

  expect(await screen.findByRole("heading", { name: "Life areas" })).toBeInTheDocument();
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

test("below 1440 px the sidebar opens over the page and closes after a choice or Esc", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(max-width: 1439px)",
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const user = userEvent.setup();
  renderApp("/areas");

  const plan = await screen.findByRole("link", { name: "Plan" });
  expect(screen.queryByRole("complementary", { name: "Plan" })).not.toBeInTheDocument();

  await user.click(plan);
  expect(screen.getByRole("complementary", { name: "Plan" })).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("complementary", { name: "Plan" })).not.toBeInTheDocument();

  await user.keyboard("{Control>}b{/Control}");
  await user.click(screen.getByRole("link", { name: "Finished & archived" }));
  expect(screen.queryByRole("complementary", { name: "Plan" })).not.toBeInTheDocument();
  // The docked sidebar's own setting is left alone.
  expect(useSidebarStore.getState().collapsed).toBe(false);
});
