import { Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api/client";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Send from "./pages/Send";
import Receive from "./pages/Receive";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Withdraw from "./pages/Withdraw";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import Overview from "./pages/admin/Overview";
import Users from "./pages/admin/Users";
import Merchants from "./pages/admin/Merchants";
import Autopay from "./pages/admin/Autopay";
import Audit from "./pages/admin/Audit";
import Database from "./pages/admin/Database";
import Health from "./pages/admin/Health";

function Private({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" />;
}

function UserApp() {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-[#faf8f4] md:my-6 md:min-h-[calc(100dvh-3rem)] md:overflow-hidden md:rounded-3xl md:shadow-xl">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Private><Home /></Private>} />
        <Route path="/send" element={<Private><Send /></Private>} />
        <Route path="/receive" element={<Private><Receive /></Private>} />
        <Route path="/history" element={<Private><History /></Private>} />
        <Route path="/settings" element={<Private><Settings /></Private>} />
        <Route path="/withdraw" element={<Private><Withdraw /></Private>} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Overview />} />
        <Route path="users" element={<Users />} />
        <Route path="merchants" element={<Merchants />} />
        <Route path="autopay" element={<Autopay />} />
        <Route path="audit" element={<Audit />} />
        <Route path="database" element={<Database />} />
        <Route path="health" element={<Health />} />
      </Route>
      <Route path="/*" element={<UserApp />} />
    </Routes>
  );
}
