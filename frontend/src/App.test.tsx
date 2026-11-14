import { screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { renderApp } from "./test-utils";

beforeEach(() => {
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

  expect(await screen.findByRole("link", { name: "Areas" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("link", { name: "Life areas" })).toHaveAttribute("aria-current", "page");
});
