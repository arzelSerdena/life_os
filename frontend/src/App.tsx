import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { getSettingsOptions } from "./client/@tanstack/react-query.gen";
import { AppLayout } from "./components/AppLayout";
import { AreasLayout } from "./features/life-areas/AreasLayout";
import { START_PATHS } from "./features/settings/settings";
import { TasksLayout } from "./features/tasks/TasksLayout";

const HomePage = lazy(() =>
  import("./features/home/HomePage").then((module) => ({ default: module.HomePage })),
);
const AreasOverviewPage = lazy(() =>
  import("./features/life-areas/AreasOverviewPage").then((module) => ({
    default: module.AreasOverviewPage,
  })),
);
const ArchivePage = lazy(() =>
  import("./features/archive/ArchivePage").then((module) => ({ default: module.ArchivePage })),
);
const RoutinesOverviewPage = lazy(() =>
  import("./features/routines/RoutinesOverviewPage").then((module) => ({
    default: module.RoutinesOverviewPage,
  })),
);
const RoutinePage = lazy(() =>
  import("./features/routines/RoutinePage").then((module) => ({ default: module.RoutinePage })),
);
const ProjectsOverviewPage = lazy(() =>
  import("./features/projects/ProjectsOverviewPage").then((module) => ({
    default: module.ProjectsOverviewPage,
  })),
);
const ProjectPage = lazy(() =>
  import("./features/projects/ProjectPage").then((module) => ({ default: module.ProjectPage })),
);
const AreaPage = lazy(() =>
  import("./features/life-areas/AreaPage").then((module) => ({ default: module.AreaPage })),
);
const InboxPage = lazy(() =>
  import("./features/tasks/InboxPage").then((module) => ({ default: module.InboxPage })),
);
const Next7Page = lazy(() =>
  import("./features/tasks/Next7Page").then((module) => ({ default: module.Next7Page })),
);
const RoutinesPage = lazy(() =>
  import("./features/tasks/RoutinesPage").then((module) => ({ default: module.RoutinesPage })),
);
const TasksPage = lazy(() =>
  import("./features/tasks/TasksPage").then((module) => ({ default: module.TasksPage })),
);
const CalendarPage = lazy(() =>
  import("./features/calendar/CalendarPage").then((module) => ({ default: module.CalendarPage })),
);
const SettingsPage = lazy(() =>
  import("./features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);

/** Opening the app goes where Settings › Open on start says; Home until the settings load
 * or when they can't. */
function StartPage() {
  const settings = useQuery(getSettingsOptions());
  if (settings.isPending) return null;
  return <Navigate to={START_PATHS[settings.data?.open_on_start ?? "home"] ?? "/home"} replace />;
}

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<StartPage />} />
        <Route
          path="home"
          element={
            <Suspense fallback={null}>
              <HomePage />
            </Suspense>
          }
        />
        <Route path="areas" element={<AreasLayout />}>
          <Route
            index
            element={
              <Suspense fallback={null}>
                <AreasOverviewPage />
              </Suspense>
            }
          />
          <Route
            path="archived"
            element={
              <Suspense fallback={null}>
                <ArchivePage />
              </Suspense>
            }
          />
          <Route
            path="routines"
            element={
              <Suspense fallback={null}>
                <RoutinesOverviewPage />
              </Suspense>
            }
          />
          <Route
            path="routines/:routineId"
            element={
              <Suspense fallback={null}>
                <RoutinePage />
              </Suspense>
            }
          />
          <Route
            path="projects"
            element={
              <Suspense fallback={null}>
                <ProjectsOverviewPage />
              </Suspense>
            }
          />
          <Route
            path="projects/:projectId"
            element={
              <Suspense fallback={null}>
                <ProjectPage />
              </Suspense>
            }
          />
          <Route
            path=":areaId"
            element={
              <Suspense fallback={null}>
                <AreaPage />
              </Suspense>
            }
          />
        </Route>
        <Route path="tasks" element={<TasksLayout />}>
          <Route index element={<Navigate to="all" replace />} />
          <Route
            path="inbox"
            element={
              <Suspense fallback={null}>
                <InboxPage />
              </Suspense>
            }
          />
          <Route
            path="next-7-days"
            element={
              <Suspense fallback={null}>
                <Next7Page />
              </Suspense>
            }
          />
          <Route
            path="routines"
            element={
              <Suspense fallback={null}>
                <RoutinesPage />
              </Suspense>
            }
          />
          <Route
            path=":view"
            element={
              <Suspense fallback={null}>
                <TasksPage />
              </Suspense>
            }
          />
        </Route>
        <Route
          path="calendar"
          element={
            <Suspense fallback={null}>
              <CalendarPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={null}>
              <SettingsPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
