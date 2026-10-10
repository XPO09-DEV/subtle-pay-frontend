import { NavLink } from "react-router-dom";
<<<<<<< HEAD
import { Home, ArrowLeftRight, Settings } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/history", label: "Activity", icon: ArrowLeftRight },
  { to: "/settings", label: "Settings", icon: Settings },
=======

const links = [
  { to: "/", label: "Home" },
  { to: "/history", label: "Activity" },
  { to: "/settings", label: "Settings" },
>>>>>>> a26f18097bfee4d553da3f1a17dee27e2f322425
];

export default function BottomNav() {
  return (
<<<<<<< HEAD
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
=======
    <nav className="fixed bottom-0 left-1/2 flex w-full max-w-md -translate-x-1/2 border-t bg-white">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          className={({ isActive }) =>
            `flex-1 py-3 text-center text-sm ${isActive ? "font-semibold text-brand" : "text-gray-400"}`
          }
        >
          {l.label}
>>>>>>> a26f18097bfee4d553da3f1a17dee27e2f322425
        </NavLink>
      ))}
    </nav>
  );
}