import { useMemo } from "react";
import AdminCard from "./components/AdminCard";
import { useAdmin } from "./context/AdminProvider";

export default function Dashboard() {
  const { users, tasks, leaves, attendance } = useAdmin();

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Admin Dashboard</h1>
        <p className="text-sm text-slate-500">
          Workforce overview and activity snapshot
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <AdminCard title="Active Users">
          <div className="text-3xl font-semibold text-slate-800">{activeUsers}</div>
          <div className="text-xs text-slate-400 mt-1">
            Out of {users.length} users
          </div>
        </AdminCard>

        <AdminCard title="Pending Leaves">
          <div className="text-3xl font-semibold text-amber-600">{pendingLeaves}</div>
          <div className="text-xs text-slate-400 mt-1">Needs approval</div>
        </AdminCard>

        <AdminCard title="Task Completion">
          <div className="text-3xl font-semibold text-slate-800">{taskStats.pct}%</div>
          <div className="text-xs text-slate-400 mt-1">
            {taskStats.completed}/{taskStats.total} completed
          </div>
        </AdminCard>

        <AdminCard title="Attendance Today">
          <div className="text-3xl font-semibold text-slate-800">{todayAttendance}</div>
          <div className="text-xs text-slate-400 mt-1">{today}</div>
        </AdminCard>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-700">Task Progress</h2>
          <span className="text-xs text-slate-500">{taskStats.pct}%</span>
        </div>

        <div className="mt-3 w-full bg-slate-200 rounded-full h-3">
          <div
            className="bg-indigo-600 h-3 rounded-full transition-all"
            style={{ width: `${taskStats.pct}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-xs text-slate-600">
          <Stat label="Completed" value={taskStats.completed} />
          <Stat label="In Progress" value={taskStats.inProgress} />
          <Stat label="Pending" value={taskStats.pending} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Recent Leave Requests">
          {recentLeaves.map((l) => (
            <Row
              key={l.id}
              primary={l.employee}
              secondary={`${l.type} • ${l.date}`}
              badge={l.status}
            />
          ))}
          {recentLeaves.length === 0 && <Empty text="No leave requests." />}
        </Panel>

        <Panel title="Recent Tasks">
          {recentTasks.map((t) => (
            <Row
              key={t.id}
              primary={t.title}
              secondary={`${t.assignedTo} • ${t.priority}`}
              badge={t.status}
            />
          ))}
          {recentTasks.length === 0 && <Empty text="No tasks." />}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-semibold text-slate-800">{value}</div>
      <div>{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
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
        <div className="text-sm font-medium text-slate-800">{primary}</div>
        <div className="text-xs text-slate-500">{secondary}</div>
      </div>
      <StatusBadge status={badge} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-4 text-sm text-slate-500">{text}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const base = "px-2 py-1 rounded-full text-xs font-medium";
  const map: Record<string, string> = {
    Pending: "bg-yellow-100 text-yellow-700",
    Approved: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
    "In Progress": "bg-blue-100 text-blue-700",
    Completed: "bg-green-100 text-green-700",
  };
  return (
    <span className={`${base} ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}
