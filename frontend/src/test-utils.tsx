import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { App } from "./App";
import type { LifeAreaRead, OverviewRead } from "./client/types.gen";
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

/** An overview of the given areas with no tasks, metrics, projects, routines or wins. */
export function emptyOverview(
  lifeAreas: LifeAreaRead[],
  overrides: Partial<OverviewRead> = {},
): OverviewRead {
  return {
    period: "quarter",
    range: { start: "2026-10-01", end: "2026-12-31" },
    previous_range: { start: "2026-07-01", end: "2026-09-30" },
    today: "2026-11-14",
    life_areas: lifeAreas,
    effort: lifeAreas.map((area) => ({ life_area_id: area.id, done: 0, previous_done: 0 })),
    outcomes: [],
    projects: lifeAreas.map((area) => ({
      life_area_id: area.id,
      active_projects: 0,
      done: 0,
      total: 0,
      pace: null,
      pace_status: null,
    })),
    routines: lifeAreas.map((area) => ({
      life_area_id: area.id,
      steps: 0,
      routines: 0,
      due: 0,
      done: 0,
      weeks: [],
    })),
    wins: [],
    ...overrides,
  };
}
