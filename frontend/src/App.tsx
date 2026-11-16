import { Navigate, Route, Routes } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { ArchivedAreasPage } from "./features/life-areas/ArchivedAreasPage";
import { AreaPage } from "./features/life-areas/AreaPage";
import { AreasLayout } from "./features/life-areas/AreasLayout";
import { AreasOverviewPage } from "./features/life-areas/AreasOverviewPage";
import { InboxPage } from "./features/tasks/InboxPage";
import { Next7Page } from "./features/tasks/Next7Page";
import { RoutinesPage } from "./features/tasks/RoutinesPage";
import { TasksLayout } from "./features/tasks/TasksLayout";
import { TasksPage } from "./features/tasks/TasksPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="areas" element={<AreasLayout />}>
          <Route index element={<AreasOverviewPage />} />
          <Route path="archived" element={<ArchivedAreasPage />} />
          <Route path=":areaId" element={<AreaPage />} />
        </Route>
        <Route path="tasks" element={<TasksLayout />}>
          <Route index element={<Navigate to="all" replace />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="next-7-days" element={<Next7Page />} />
          <Route path="routines" element={<RoutinesPage />} />
          <Route path=":view" element={<TasksPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/areas" replace />} />
      </Route>
    </Routes>
  );
}
