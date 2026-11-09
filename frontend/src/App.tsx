import { Navigate, Route, Routes } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { LifeAreasPage } from "./features/life-areas/LifeAreasPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/life-areas" replace />} />
        <Route path="life-areas" element={<LifeAreasPage />} />
        <Route path="*" element={<Navigate to="/life-areas" replace />} />
      </Route>
    </Routes>
  );
}
