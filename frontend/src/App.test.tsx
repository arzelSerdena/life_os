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

test.each(["/", "/not-a-page"])("%s opens the life areas page", async (path) => {
  renderApp(path);

  expect(await screen.findByRole("heading", { name: "Life areas" })).toBeInTheDocument();
});

test("the sidebar marks the current page", async () => {
  renderApp();

  const link = await screen.findByRole("link", { name: "Life areas" });

  expect(link).toHaveAttribute("aria-current", "page");
});
