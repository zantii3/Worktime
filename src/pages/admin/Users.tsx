import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import AdminTable from "./components/AdminTable";
import { useAdmin } from "./context/AdminProvider";
import { notifySuccess } from "./utils/toast";

export default function Users() {
  const { users, setUsers } = useAdmin();

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const toggle = (id: number) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === "Active" ? "Inactive" : "Active" } : u
      )
    );
    notifySuccess("User status updated.");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header card */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-text-heading">User Management</div>
          <div className="text-sm text-text-primary/70">Activate/deactivate accounts.</div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <span>🕒</span>
          <span>
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Table wrapper card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        <div className="p-5 border-b border-slate-100">
          <div className="text-sm font-semibold text-text-heading">Users</div>
          <div className="text-xs text-text-primary/70">Manage roles and statuses</div>
        </div>

        <AdminTable headers={["Name", "Role", "Status", "Actions"]}>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3">{u.name}</td>
              <td className="px-4 py-3">{u.role}</td>
              <td className="px-4 py-3">
                <span
                  className={[
                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border",
                    u.status === "Active"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-slate-50 text-slate-700 border-slate-200",
                  ].join(" ")}
                >
                  {u.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => toggle(u.id)}
                  className="text-sm text-orange-700 hover:underline font-semibold"
                >
                  {u.status === "Active" ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </AdminTable>
      </motion.div>
    </motion.div>
  );
}
