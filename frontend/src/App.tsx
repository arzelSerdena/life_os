import { Navigate, Route, Routes } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { ArchivedAreasPage } from "./features/life-areas/ArchivedAreasPage";
import { AreaPage } from "./features/life-areas/AreaPage";
import { AreasLayout } from "./features/life-areas/AreasLayout";
import { AreasOverviewPage } from "./features/life-areas/AreasOverviewPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="areas" element={<AreasLayout />}>
          <Route index element={<AreasOverviewPage />} />
          <Route path="archived" element={<ArchivedAreasPage />} />
          <Route path=":areaId" element={<AreaPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/areas" replace />} />
      </Route>
    </Routes>
  );
}
