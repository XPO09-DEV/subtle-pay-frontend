import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import Overview from "./pages/admin/Overview";
import Users from "./pages/admin/Users";
import Merchants from "./pages/admin/Merchants";
import Autopay from "./pages/admin/Autopay";
import Audit from "./pages/admin/Audit";
import Database from "./pages/admin/Database";
import Health from "./pages/admin/Health";

function AdminApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<Overview />} />
          <Route path="users" element={<Users />} />
          <Route path="merchants" element={<Merchants />} />
          <Route path="autopay" element={<Autopay />} />
          <Route path="audit" element={<Audit />} />
          <Route path="database" element={<Database />} />
          <Route path="health" element={<Health />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>
);
