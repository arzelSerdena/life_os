import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { App } from "./App";
import type {
  AreaPageRead,
  LifeAreaRead,
  OverviewRead,
  ProjectPageRead,
  ProjectRead,
  TaskRead,
} from "./client/types.gen";
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

let nextTaskId = 1;
/** A to-do task with no owner and no dates; each call gets a new id. */
export function taskRead(overrides: Partial<TaskRead>): TaskRead {
  const id = nextTaskId++;
  return {
    id,
    life_area_id: null,
    project_id: null,
    section_id: null,
    template_id: null,
    occurrence_date: null,
    title: `Task ${id}`,
    notes: null,
    status: "todo",
    priority: "none",
    scheduled_date: null,
    due_date: null,
    due_time: null,
    completed_at: null,
    cancelled_at: null,
    archived_at: null,
    sort_order: 0,
    rollover_count: 0,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    subtasks: [],
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

/** An area's page with nothing in it. */
export function emptyAreaPage(
  lifeArea: LifeAreaRead,
  overrides: Partial<AreaPageRead> = {},
): AreaPageRead {
  return {
    life_area: lifeArea,
    period: "quarter",
    range: { start: "2026-10-01", end: "2026-12-31" },
    today: "2026-11-14",
    contents: {
      active_projects: 0,
      open_tasks: 0,
      upcoming_events: 0,
      metrics: 0,
      routine_steps: 0,
      has_items: false,
    },
    metrics: [],
    projects: [],
    events: [],
    routines: [],
    overdue_tasks: [],
    rolled_over_tasks: [],
    unscheduled_tasks: [],
    recurring: [],
    completed_tasks: [],
    agenda_range: { start: "2026-11-14", end: "2026-12-31" },
    agenda_tasks: [],
    deadlines: [],
    ...overrides,
  };
}

/** A project's page with nothing in it: the project itself is its one project item. */
export function emptyProjectPage(
  lifeArea: LifeAreaRead,
  project: ProjectRead,
  overrides: Partial<ProjectPageRead> = {},
): ProjectPageRead {
  return {
    ...emptyAreaPage(lifeArea),
    project,
    projects: [
      {
        id: project.id,
        title: project.title,
        status: project.status,
        start: project.start_date ?? project.created_at.slice(0, 10),
        due_date: project.due_date,
        completed_on: null,
        done: project.progress.done,
        total: project.progress.total,
      },
    ],
    pace: null,
    pace_status: null,
    ...overrides,
  };
}
