import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "./context/AdminProvider";

export default function Dashboard() {
  const { users, tasks, leaves, attendance } = useAdmin();

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeUsers = users.filter((u) => u.status === "Active").length;
  const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;

  const taskStats = useMemo(() => {
    const completed = tasks.filter((t) => t.status === "Completed").length;
    const inProgress = tasks.filter((t) => t.status === "In Progress").length;
    const pending = tasks.filter((t) => t.status === "Pending").length;
    const total = tasks.length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { completed, inProgress, pending, total, pct };
  }, [tasks]);

  const today = "2026-02-12"; // demo constant; later replace with real date filter
  const todayAttendance = attendance.filter((a) => a.date === today).length;

  const recentLeaves = leaves.slice(0, 5);
  const recentTasks = tasks.slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header card like Attendance */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-text-heading">Admin Dashboard</div>
          <div className="text-sm text-text-primary/70">
            Workforce overview and activity snapshot
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <span>🕒</span>
          <span>
            {now.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        <KpiCard title="Active Users" value={activeUsers} subtitle={`Out of ${users.length} users`} />
        <KpiCard title="Pending Leaves" value={pendingLeaves} subtitle="Needs approval" tone="warning" />
        <KpiCard title="Task Completion" value={`${taskStats.pct}%`} subtitle={`${taskStats.completed}/${taskStats.total} completed`} />
        <KpiCard title="Attendance Today" value={todayAttendance} subtitle={today} />
      </motion.div>

      {/* Progress panel */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="bg-card rounded-2xl shadow-sm border border-slate-200 p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-heading">Task Progress</h2>
          <span className="text-xs text-text-primary/70">{taskStats.pct}%</span>
        </div>

        <div className="mt-3 w-full bg-slate-200 rounded-full h-3">
          <div
            className="bg-orange-600 h-3 rounded-full transition-all"
            style={{ width: `${taskStats.pct}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-xs text-text-primary/70">
          <Stat label="Completed" value={taskStats.completed} />
          <Stat label="In Progress" value={taskStats.inProgress} />
          <Stat label="Pending" value={taskStats.pending} />
        </div>
      </motion.div>

      {/* Recent panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Recent Leave Requests">
          {recentLeaves.map((l, idx) => (
            <motion.div
              key={l.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
            >
              <Row
                primary={l.employee}
                secondary={`${l.type} • ${l.date}`}
                badge={l.status}
              />
            </motion.div>
          ))}
          {recentLeaves.length === 0 && <Empty text="No leave requests." />}
        </Panel>

        <Panel title="Recent Tasks">
          {recentTasks.map((t, idx) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
            >
              <Row
                primary={t.title}
                secondary={`${t.assignedTo} • ${t.priority}`}
                badge={t.status}
              />
            </motion.div>
          ))}
          {recentTasks.length === 0 && <Empty text="No tasks." />}
        </Panel>
      </div>
    </motion.div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone?: "default" | "warning";
}) {
  // Orange gradient like attendance vibe
  const gradient =
    tone === "warning"
      ? "from-orange-500 to-orange-600"
      : "from-orange-500 to-orange-600";

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="rounded-2xl overflow-hidden border border-orange-200 shadow-sm"
    >
      <div className={`bg-gradient-to-r ${gradient} p-5 text-white`}>
        <div className="text-xs font-semibold opacity-90">{title}</div>
        <div className="mt-3 text-4xl font-extrabold">{value}</div>
        <div className="mt-2 text-xs opacity-90">{subtitle}</div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-semibold text-text-heading">{value}</div>
      <div>{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-text-heading">{title}</h2>
      <div className="bg-card rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({
  primary,
  secondary,
  badge,
}: {
  primary: string;
  secondary: string;
  badge: string;
}) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-text-heading">{primary}</div>
        <div className="text-xs text-text-primary/70">{secondary}</div>
      </div>
      <StatusBadge status={badge} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-4 text-sm text-text-primary/70">{text}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const base = "px-2 py-1 rounded-full text-xs font-semibold border";
  const map: Record<string, string> = {
    Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Approved: "bg-green-50 text-green-700 border-green-200",
    Rejected: "bg-red-50 text-red-700 border-red-200",
    "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
    Completed: "bg-green-50 text-green-700 border-green-200",
  };
  return <span className={`${base} ${map[status] ?? "bg-slate-50 text-slate-700 border-slate-200"}`}>{status}</span>;
}
