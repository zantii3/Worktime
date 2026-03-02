import { motion } from "framer-motion";
import {
    Activity,
    CalendarDays,
    CheckCircle2,
    CircleDashed,
    Clock,
    Copy,
    Download,
    KeyRound,
    LogOut,
    Mail,
    Shield,
    UserCircle2,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "./context/AdminProvider";
import { notifyError, notifySuccess } from "./utils/toast";

type Status = "Active" | "Inactive";
type StatusMap = Record<string, Status>;

export type AttendanceRecord = {
  id: string;
  employeeId: string; // for admins: String(admin.id)
  source?: "Desktop" | "Mobile" | string;
  dateISO: string; // YYYY-MM-DD
  timeIn: string | null;
  lunchOut: string | null; // Start Break
  lunchIn: string | null; // End Break
  timeOut: string | null;
};

const STATUS_KEY = "worktime_account_status_v1";
const ATTENDANCE_KEY = "worktime_attendance_v1";

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function readStatusMap(): StatusMap {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as StatusMap) : {};
  } catch {
    return {};
  }
}

function readAttendance(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(ATTENDANCE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AttendanceRecord[]) : [];
  } catch {
    return [];
  }
}

function formatTimeLocal(iso: string | null) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "--:--";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}



function InfoTile({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone?: "slate" | "primary" | "secondary" | "success" | "danger";
}) {
  const base = "rounded-2xl border p-4 bg-white";
  const map = {
    slate: "border-slate-200",
    primary: "border-primary/20",
    secondary: "border-secondary/20",
    success: "border-green-200",
    danger: "border-rose-200",
  } as const;

  return (
    <div className={cx(base, map[tone])}>
      <div className="flex items-center gap-2 text-xs font-bold text-text-primary/70">
        <span className="h-8 w-8 rounded-xl bg-soft border border-slate-200 flex items-center justify-center">
          <Icon className="w-4 h-4 text-text-primary/70" />
        </span>
        {label}
      </div>
      <div className="mt-2 text-lg font-extrabold text-text-heading break-words">{value}</div>
    </div>
  );
}

export default function AdminProfile() {
  const navigate = useNavigate();
  const { tasks, leaves } = useAdmin();

  // keep time/clock consistent with your other pages
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [statusMap, setStatusMap] = useState<StatusMap>(() => readStatusMap());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => readAttendance());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATUS_KEY) setStatusMap(readStatusMap());
      if (e.key === ATTENDANCE_KEY) setAttendance(readAttendance());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const currentAdmin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentAdmin") || "null") as
        | { id: number; email: string; name: string }
        | null;
    } catch {
      return null;
    }
  }, []);

  const adminStatus: Status | "—" = useMemo(() => {
    if (!currentAdmin) return "—";
    return statusMap[`admin:${currentAdmin.id}`] ?? "Active";
  }, [currentAdmin, statusMap]);

  const adminAttendance = useMemo(() => {
    if (!currentAdmin) return [];
    const id = String(currentAdmin.id);
    return attendance
      .filter((r) => r.employeeId === id)
      .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  }, [attendance, currentAdmin]);

  const todayISO = useMemo(() => {
    const d = now;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, [now]);

  const todayRecord = useMemo(() => {
    if (!currentAdmin) return null;
    return (
      adminAttendance.find((r) => r.dateISO === todayISO) ??
      attendance.find((r) => r.employeeId === String(currentAdmin.id) && r.dateISO === todayISO) ??
      null
    );
  }, [adminAttendance, attendance, currentAdmin, todayISO]);

  const quickStats = useMemo(() => {
    const totalDays = adminAttendance.filter((r) => !!r.timeIn).length;
    const completedDays = adminAttendance.filter((r) => !!r.timeIn && !!r.timeOut).length;
    const incompleteDays = totalDays - completedDays;

    const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "Completed").length;

    return {
      totalDays,
      completedDays,
      incompleteDays,
      pendingLeaves,
      totalTasks,
      completedTasks,
    };
  }, [adminAttendance, leaves, tasks]);

  const copyEmail = async () => {
    if (!currentAdmin?.email) return;
    try {
      await navigator.clipboard.writeText(currentAdmin.email);
      notifySuccess("Email copied.");
    } catch {
      notifyError("Failed to copy email.");
    }
  };

  const exportMyAttendance = () => {
  if (!currentAdmin) return;

  try {
    if (!adminAttendance.length) {
      notifyError("No attendance records to export.");
      return;
    }

    // CSV headers
    const headers = [
      "Date",
      "Time In",
      "Start Break",
      "End Break",
      "Time Out",
      "Device",
    ];

    // Convert records to CSV rows
    const rows = adminAttendance.map((r) => [
      r.dateISO,
      formatTimeLocal(r.timeIn),
      formatTimeLocal(r.lunchOut),
      formatTimeLocal(r.lunchIn),
      formatTimeLocal(r.timeOut),
      r.source ?? "",
    ]);

    // Build CSV string
    const csvContent = [
      headers.join(","), 
      ...rows.map((row) =>
        row
          .map((field) =>
            `"${String(field ?? "").replace(/"/g, '""')}"`
          )
          .join(",")
      ),
    ].join("\n");

    // Create downloadable blob
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `admin_${currentAdmin.id}_attendance.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    notifySuccess("Attendance exported (CSV).");
  } catch {
    notifyError("Failed to export attendance.");
  }
};

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("currentAdmin");
    notifySuccess("Logged out successfully.");
    navigate("/admin/login", { replace: true });
  };

  if (!currentAdmin) {
    return (
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="text-lg font-bold text-text-heading">Admin Profile</div>
        <div className="mt-1 text-sm text-text-primary/70">
          No admin session found. Please log in again.
        </div>
        <button
          onClick={() => navigate("/admin/login", { replace: true })}
          className="mt-4 px-4 py-2 rounded-xl bg-primary text-white font-semibold"
          type="button"
        >
          Go to Admin Login
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <UserCircle2 className="w-5 h-5 text-primary" />
            </span>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-text-heading truncate">Admin Profile</div>
              <div className="text-sm text-text-primary/70 truncate">
                Manage your session and view your admin activity
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-text-primary/70">
            Signed in as{" "}
            <span className="font-semibold text-text-heading">{currentAdmin.name}</span>{" "}
            • Status:{" "}
            <span
              className={cx(
                "font-semibold",
                adminStatus === "Active" ? "text-green-700" : "text-rose-700"
              )}
            >
              {adminStatus}
            </span>
          </div>
        </div>

        <div className="bg-primary text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span className="tabular-nums">
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Profile cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <InfoTile icon={Shield} label="Role" value="Admin" tone="secondary" />
        <InfoTile icon={Mail} label="Email" value={currentAdmin.email} tone="primary" />
        <InfoTile icon={KeyRound} label="Admin ID" value={currentAdmin.id} tone="slate" />
      </div>

      {/* Actions */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-text-heading">Quick Actions</div>
            <div className="text-xs text-text-primary/70">
              Frontend demo actions (safe for now, backend later)
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={copyEmail}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-white border border-slate-200 text-text-heading hover:bg-soft transition"
              type="button"
            >
              <Copy className="w-4 h-4" />
              Copy Email
            </button>

            <button
              onClick={exportMyAttendance}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-white border border-slate-200 text-text-heading hover:bg-soft transition"
              type="button"
            >
              <Download className="w-4 h-4" />
              Export Attendance
            </button>

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition"
              type="button"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Activity snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-text-primary/70" />
            <div className="text-sm font-semibold text-text-heading">Snapshot</div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-soft border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Attendance Days</div>
              <div className="mt-1 text-2xl font-extrabold text-text-heading tabular-nums">
                {quickStats.totalDays}
              </div>
            </div>

            <div className="rounded-xl bg-soft border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Completed Days</div>
              <div className="mt-1 text-2xl font-extrabold text-text-heading tabular-nums">
                {quickStats.completedDays}
              </div>
            </div>

            <div className="rounded-xl bg-soft border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Tasks</div>
              <div className="mt-1 text-2xl font-extrabold text-text-heading tabular-nums">
                {quickStats.completedTasks}/{quickStats.totalTasks}
              </div>
            </div>

            <div className="rounded-xl bg-soft border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Pending Leaves</div>
              <div className="mt-1 text-2xl font-extrabold text-text-heading tabular-nums">
                {quickStats.pendingLeaves}
              </div>
            </div>
          </div>
        </div>

        {/* Today's attendance */}
        <div className="bg-card rounded-2xl shadow-sm border border-slate-200 p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-text-primary/70" />
              <div>
                <div className="text-sm font-semibold text-text-heading">Today’s Attendance</div>
                <div className="text-xs text-text-primary/70">{todayISO}</div>
              </div>
            </div>

            <div
              className={cx(
                "px-3 py-1 rounded-full text-xs font-bold border",
                todayRecord?.timeIn && !todayRecord?.timeOut
                  ? "bg-green-50 text-green-700 border-green-200"
                  : todayRecord?.timeOut
                  ? "bg-soft text-text-heading border-slate-200"
                  : "bg-slate-50 text-text-primary/70 border-slate-200"
              )}
            >
              {todayRecord?.timeIn ? (todayRecord.timeOut ? "Completed" : "In Progress") : "No Record"}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Time In</div>
              <div className="mt-1 font-extrabold text-green-700 tabular-nums">
                {formatTimeLocal(todayRecord?.timeIn ?? null)}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Start Break</div>
              <div className="mt-1 font-extrabold text-amber-700 tabular-nums">
                {formatTimeLocal(todayRecord?.lunchOut ?? null)}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">End Break</div>
              <div className="mt-1 font-extrabold text-blue-700 tabular-nums">
                {formatTimeLocal(todayRecord?.lunchIn ?? null)}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Time Out</div>
              <div className="mt-1 font-extrabold text-rose-700 tabular-nums">
                {formatTimeLocal(todayRecord?.timeOut ?? null)}
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="text-sm font-semibold text-text-heading">Recent Attendance</div>
            <div className="mt-2 grid gap-2">
              {adminAttendance.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text-heading">{r.dateISO}</div>
                    <div className="text-xs text-text-primary/70">
                      In {formatTimeLocal(r.timeIn)} • Out {formatTimeLocal(r.timeOut)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.timeOut ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                        <CheckCircle2 className="w-4 h-4" /> Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                        <CircleDashed className="w-4 h-4" /> Open
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {adminAttendance.length === 0 && (
                <div className="text-sm text-text-primary/70">No attendance records yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}