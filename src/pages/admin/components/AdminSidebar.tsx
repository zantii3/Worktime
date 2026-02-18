import { AnimatePresence, motion } from "framer-motion";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { notifySuccess } from "../utils/toast";
import picture from "/logo.png"; // adjust path if needed

const nav = [
  { label: "Dashboard", to: "/admin" },
  { label: "Attendance", to: "/admin/attendance" },
  { label: "Leave", to: "/admin/leave" },
  { label: "Task", to: "/admin/tasks" },
  { label: "Users", to: "/admin/users" },
];

export default function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_email");

    notifySuccess("Logged out successfully.");
    navigate("/admin/login", { replace: true });
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="w-64 min-h-screen px-5 py-6 flex flex-col bg-card border-r border-slate-200"
    >
      {/* Brand */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <img
            src={picture}
            alt="Worktime+ Logo"
            className="h-12 w-auto object-contain"
          />
          <div>
            <div className="text-lg font-extrabold text-text-heading leading-none">
              Worktime+
            </div>
            <div className="text-xs text-text-primary/70">Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="space-y-2 flex-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/admin"}
            className={({ isActive }) =>
              [
                "relative block rounded-xl overflow-hidden",
                "focus:outline-none focus:ring-2 focus:ring-primary/30",
                isActive
                  ? "text-white"
                  : "text-text-primary hover:bg-soft",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                {/* Active background fills the whole link */}
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      layoutId="admin-nav-active"
                      className="absolute inset-0 rounded-xl bg-primary"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    />
                  )}
                </AnimatePresence>

                {/* Content stays above the background */}
                <span className="relative z-10 flex items-center justify-between px-4 py-2 text-sm font-semibold">
                  {item.label}
                  <AnimatePresence>
                    {isActive && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.18 }}
                        className="text-xs font-extrabold text-white/90"
                      >
                        •
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="pt-6 border-t border-slate-200 space-y-3">
        <div className="text-xs text-text-primary/60 px-1">
          Current:{" "}
          <span className="font-semibold text-text-heading">
            {location.pathname}
          </span>
        </div>

        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.99 }}
          onClick={logout}
          className="w-full text-left px-4 py-2 rounded-xl text-sm font-semibold text-red-600 bg-soft hover:bg-red-50 transition border border-slate-200"
        >
          Logout
        </motion.button>
      </div>
    </motion.aside>
  );
}
