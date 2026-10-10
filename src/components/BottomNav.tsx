import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Home" },
  { to: "/history", label: "Activity" },
  { to: "/settings", label: "Settings" },
];

export default function BottomNav() {
  return (
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
        </NavLink>
      ))}
    </nav>
  );
}
