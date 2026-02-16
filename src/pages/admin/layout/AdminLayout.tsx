import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-slate-100">
      <AdminSidebar />

      <main className="flex-1 p-6 lg:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="min-h-[calc(100vh-3rem)]"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
