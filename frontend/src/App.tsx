import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { ArchivePage } from "./features/archive/ArchivePage";
import { HomePage } from "./features/home/HomePage";
import { AreaPage } from "./features/life-areas/AreaPage";
import { AreasLayout } from "./features/life-areas/AreasLayout";
import { AreasOverviewPage } from "./features/life-areas/AreasOverviewPage";
import { ProjectPage } from "./features/projects/ProjectPage";
import { ProjectsOverviewPage } from "./features/projects/ProjectsOverviewPage";
import { RoutinePage } from "./features/routines/RoutinePage";
import { RoutinesOverviewPage } from "./features/routines/RoutinesOverviewPage";
import { InboxPage } from "./features/tasks/InboxPage";
import { Next7Page } from "./features/tasks/Next7Page";
import { RoutinesPage } from "./features/tasks/RoutinesPage";
import { TasksLayout } from "./features/tasks/TasksLayout";
import { TasksPage } from "./features/tasks/TasksPage";

// The Calendar brings FullCalendar, so it loads the first time the Calendar is opened.
const CalendarPage = lazy(() =>
  import("./features/calendar/CalendarPage").then((module) => ({ default: module.CalendarPage })),
);

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="areas" element={<AreasLayout />}>
          <Route index element={<AreasOverviewPage />} />
          <Route path="archived" element={<ArchivePage />} />
          <Route path="routines" element={<RoutinesOverviewPage />} />
          <Route path="routines/:routineId" element={<RoutinePage />} />
          <Route path="projects" element={<ProjectsOverviewPage />} />
          <Route path="projects/:projectId" element={<ProjectPage />} />
          <Route path=":areaId" element={<AreaPage />} />
        </Route>
        <Route path="tasks" element={<TasksLayout />}>
          <Route index element={<Navigate to="all" replace />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="next-7-days" element={<Next7Page />} />
          <Route path="routines" element={<RoutinesPage />} />
          <Route path=":view" element={<TasksPage />} />
        </Route>
        <Route
          path="calendar"
          element={
            <Suspense fallback={null}>
              <CalendarPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  );
}
