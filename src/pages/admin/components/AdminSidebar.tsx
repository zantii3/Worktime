import { motion } from "framer-motion";
import {
  LayoutDashboard,
  CalendarDays,
  FileUser,
  ListTodo,
  Users,
  LogOut,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { notifySuccess } from "../utils/toast";
import picture from "/logo.png";

type Props = {
  close?: () => void;
};

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: CalendarDays, label: "Attendance", path: "/admin/attendance" },
  { icon: FileUser, label: "Leave", path: "/admin/leave" },
  { icon: ListTodo, label: "Task", path: "/admin/tasks" },
  { icon: Users, label: "Users", path: "/admin/users" },
] as const;

export default function AdminSidebar({ close }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const go = (path: string) => {
    close?.();
    navigate(path);
  };

  const logout = () => {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_email");
  localStorage.removeItem("currentAdmin"); // ✅ REQUIRED
  notifySuccess("Logged out successfully.");
  close?.();
  navigate("/admin/login", { replace: true });
};


  const isActive = (itemPath: string) => {
    const current = location.pathname;
    if (itemPath === "/admin") return current === "/admin";
    return current === itemPath || current.startsWith(itemPath + "/");
  };

  return (
    <aside className="w-72 bg-card border-r border-slate-200 min-h-dvh">
      <div className="flex flex-col h-full p-6">
        {/* Logo */}
        <div className="flex items-center justify-center mb-10 relative">
          <motion.img
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            src={picture}
            alt="Logo"
            className="w-20 md:w-20 lg:w-28 h-auto object-contain select-none"
            draggable={false}
          />

          {close && (
            <motion.button
              whileHover={{ rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={close}
              className="absolute top-0 right-0 mt-2 mr-2 p-2 hover:bg-slate-100 rounded-lg transition-colors"
              type="button"
              aria-label="Close sidebar"
            >
              <X className="text-slate-600" />
            </motion.button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-2 flex-1">
          {navItems.map((item, index) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <motion.button
                key={item.path}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ x: 4 }} // <- IMPORTANT: no inline backgroundColor
                onClick={() => go(item.path)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[#1E293B] font-medium transition-all group
                  hover:bg-slate-100
                  border-b-2 ${active ? "border-secondary bg-secondary/10" : "border-transparent"}`}
                type="button"
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  size={20}
                  className={`text-slate-500 transition-colors ${
                    active ? "text-primary" : "group-hover:text-primary"
                  }`}
                />
                <span
                  className={`transition-colors ${
                    active ? "text-primary" : "group-hover:text-primary"
                  }`}
                >
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </nav>

        {/* Logout pinned bottom */}
        <motion.button
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.95 }}
          onClick={logout}
          className="mt-auto flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 font-medium hover:bg-red-50 transition-all"
          type="button"
          aria-label="Logout"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </motion.button>
      </div>
    </aside>
  );
}

