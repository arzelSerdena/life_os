import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { App } from "./App";
import type { LifeAreaRead } from "./client/types.gen";
import { createQueryClient } from "./queryClient";

export function renderApp(path = "/areas") {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function lifeArea(overrides: Partial<LifeAreaRead> = {}): LifeAreaRead {
  return {
    id: 1,
    title: "Health",
    vision: null,
    notes: null,
    color: "teal",
    sort_order: 0,
    archived_at: null,
    created_at: "2026-11-10T00:00:00Z",
    updated_at: "2026-11-10T00:00:00Z",
    ...overrides,
  };
}
