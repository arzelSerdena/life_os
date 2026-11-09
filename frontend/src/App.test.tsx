import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { App } from "./App";

function renderApp() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>,
  );
}

function healthyResponse() {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("shows that the API is connected", async () => {
  const fetchMock = vi.fn(async (_request: Request) => healthyResponse());
  vi.stubGlobal("fetch", fetchMock);

  renderApp();

  expect(await screen.findByText("API connected")).toBeInTheDocument();
  expect(new URL(fetchMock.mock.calls[0][0].url).pathname).toBe("/api/health");
});

test("shows an error, then recovers when checked again", async () => {
  const fetchMock = vi
    .fn<() => Promise<Response>>()
    .mockRejectedValueOnce(new TypeError("Network error"))
    .mockImplementation(async () => healthyResponse());
  vi.stubGlobal("fetch", fetchMock);

  renderApp();

  expect(await screen.findByText("API unreachable")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Check again" }));

  expect(await screen.findByText("API connected")).toBeInTheDocument();
});
