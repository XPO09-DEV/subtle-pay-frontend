import { NavLink } from "react-router-dom";
import { Home, ArrowLeftRight, Settings } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/history", label: "Activity", icon: ArrowLeftRight },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 border-t bg-white pb-[env(safe-area-inset-bottom)]">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
              isActive ? "font-semibold text-brand" : "text-gray-400"
            }`
          }
        >
          <Icon size={22} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}