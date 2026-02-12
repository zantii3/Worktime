import { NavLink, useNavigate } from "react-router-dom";
import { notifySuccess } from "../utils/toast";

const nav = [
  { label: "Dashboard", to: "/admin" },
  { label: "Attendance", to: "/admin/attendance" },
  { label: "Leave", to: "/admin/leave" },
  { label: "Task", to: "/admin/tasks" },
  { label: "Users", to: "/admin/users" },
];

export default function AdminSidebar() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_email");

    notifySuccess("Logged out successfully.");
    navigate("/admin/login", { replace: true });
  };

  return (
    <aside className="w-64 bg-card border-r border-slate-200 min-h-screen px-5 py-6 flex flex-col">
      {/* Logo/Header */}
      <div className="mb-8">
        <div className="text-lg font-bold text-text-heading">Worktime+</div>
        <div className="text-xs text-text-primary/70">Admin Panel</div>
      </div>

      <nav className="space-y-2 flex-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/admin"}
            className={({ isActive }) =>
              [
                "block px-4 py-2 rounded-xl text-sm font-medium transition",
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-primary hover:bg-slate-100",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="pt-6 border-t border-slate-200">
        <button
          onClick={logout}
          className="w-full text-left px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
