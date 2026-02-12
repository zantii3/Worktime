import { motion } from "framer-motion";
import { LayoutDashboard, CalendarDays, ClipboardList, ListTodo, LogOut, X } from "lucide-react";
import picture from "/logo.png";

type Props = {
  navigate: (path: string) => void;
  logout: () => void;
  close?: () => void;
};

export default function Usersidebar({ navigate, logout, close }: Props) {
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: CalendarDays, label: "Attendance", path: "/attendance" },
    { icon: ClipboardList, label: "Leave", path: "/leave" },
    { icon: ListTodo, label: "Task", path: "/task" },
  ];

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-center mb-10 relative">
        <motion.img
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          src={picture}
          alt="Logo"
          className="w-20 md:w-20 lg:w-28 h-auto object-contain"
        />
        {close && (
          <motion.button
            whileHover={{ rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={close}
            className="absolute top-0 right-0 mt-2 mr-2 p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="text-slate-600" />
          </motion.button>
        )}
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item, index) => (
          <motion.button
            key={item.path}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ x: 4, backgroundColor: "rgba(242, 140, 40, 0.1)" }}
            onClick={() => {
              navigate(item.path);
              close?.();
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#1E293B] font-medium transition-all group"
          >
            <item.icon size={20} className="text-slate-500 group-hover:text-[#F28C28] transition-colors" />
            <span className="group-hover:text-[#F28C28] transition-colors">{item.label}</span>
          </motion.button>
        ))}
      </nav>

      <motion.button
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.95 }}
        onClick={logout}
        className="mt-auto flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 font-medium hover:bg-red-50 transition-all"
      >
        <LogOut size={20} />
        <span>Logout</span>
      </motion.button>
    </div>
  );
}
