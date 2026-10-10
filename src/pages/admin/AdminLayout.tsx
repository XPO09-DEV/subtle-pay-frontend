import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { adminApi, clearAdminToken, getAdminToken } from "../../api/admin";
import { Navigate } from "react-router-dom";

const links = [
  { to: "/", label: "Overview", end: true },
  { to: "/users", label: "Users & Access" },
  { to: "/merchants", label: "Merchants" },
  { to: "/autopay", label: "Autopay" },
  { to: "/audit", label: "Audit Logs" },
  { to: "/database", label: "Database" },
  { to: "/health", label: "System Health" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  if (!getAdminToken()) return <Navigate to="/login" replace />;

  async function logout() {
    await adminApi.logout().catch(() => undefined);
    clearAdminToken();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-[#f5f5f7] text-gray-900">
      <aside className="hidden w-56 shrink-0 border-r border-black/5 bg-white md:flex md:flex-col">
        <div className="px-5 py-6">
          <p className="text-xs font-medium tracking-widest text-gray-400">SUBTLE</p>
          <p className="text-lg font-semibold">Admin</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm ${isActive ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={logout} className="m-3 rounded-lg px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100">
          Sign out
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-black/5 bg-white px-5 py-3">
          <p className="text-sm font-medium">Super Admin Panel</p>
          <button onClick={logout} className="text-sm text-gray-500 md:hidden">
            Sign out
          </button>
        </header>
        <main className="flex-1 overflow-auto p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
