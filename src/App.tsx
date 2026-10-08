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

// if not logged in, send the person to the login page
function Private({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#faf8f4]">
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