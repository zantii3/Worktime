import React from "react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "./context/AdminProvider";
import accounts from "../data/accounts.json";

import {
  Clock as ClockIcon,
  Users as UsersIcon,
  FileText,
  CheckCircle2,
  ClipboardList,
  CalendarDays,
  Timer as TimerIcon,
  LogIn,
  Coffee,
  Play,
  LogOut,
} from "lucide-react";

type Status = "Active" | "Inactive";
type StatusMap = Record<string, Status>;

type UserAccount = { id: number; email: string; password: string; name: string };

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

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function writeAttendance(list: AttendanceRecord[]) {
  try {
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function msToHMS(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function getStatusLabel(r: AttendanceRecord | null) {
  if (!r?.timeIn) return "Not Started";
  if (r.timeOut) return "Clocked Out";
  return "Clocked In";
}

function computeBreakMsLive(r: AttendanceRecord | null, nowMs: number) {
  if (!r?.lunchOut) return 0;
  const start = new Date(r.lunchOut).getTime();
  const end = r.lunchIn ? new Date(r.lunchIn).getTime() : nowMs;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

/**
 * Work elapsed:
 * (timeOut or now) - timeIn - (break duration)
 * - If break is ongoing, subtract break from lunchOut -> now (or timeOut if ended)
 */
function computeWorkMsLive(r: AttendanceRecord | null, nowMs: number) {
  if (!r?.timeIn) return 0;

  const start = new Date(r.timeIn).getTime();
  const end = r.timeOut ? new Date(r.timeOut).getTime() : nowMs;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;

  // break subtraction
  let breakMs = 0;
  if (r.lunchOut && r.lunchIn) {
    const bo = new Date(r.lunchOut).getTime();
    const bi = new Date(r.lunchIn).getTime();
    if (Number.isFinite(bo) && Number.isFinite(bi)) breakMs = Math.max(0, bi - bo);
  } else if (r.lunchOut && !r.lunchIn) {
    const bo = new Date(r.lunchOut).getTime();
    if (Number.isFinite(bo)) breakMs = Math.max(0, (r.timeOut ? end : nowMs) - bo);
  }

  return Math.max(0, end - start - breakMs);
}

function formatTimeLocal(iso: string | null) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "--:--";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function getDeviceLabel() {
  const ua = navigator.userAgent.toLowerCase();
  const w = window.innerWidth;
  const isMobileUA = /android|iphone|ipod|blackberry|iemobile|opera mini/.test(ua);
  const isTabletUA = /ipad|tablet|playbook|silk/.test(ua);
  const isMobileViewport = w <= 765;
  const isTabletViewport = w > 765 && w <= 1024;
  const hasTouch = () => "ontouchstart" in window || navigator.maxTouchPoints > 0;
  return isMobileUA || (isMobileViewport && hasTouch())
    ? "Mobile"
    : isTabletUA || isTabletViewport
    ? "Tablet"
    : "Desktop";
}

function StatusBadge({ status }: { status: string }) {
  const base = "px-2 py-1 rounded-full text-xs font-semibold border";
  const map: Record<string, string> = {
    Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Approved: "bg-green-50 text-green-700 border-green-200",
    Rejected: "bg-rose-50 text-rose-700 border-rose-200",
    "In Progress": "bg-soft text-text-heading border-slate-200",
    Completed: "bg-green-50 text-green-700 border-green-200",
  };
  return (
    <span className={`${base} ${map[status] ?? "bg-soft text-text-primary border-slate-200"}`}>
      {status}
    </span>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
  right,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-9 w-9 rounded-xl bg-soft border border-slate-200 flex items-center justify-center">
            <Icon className="w-4 h-4 text-text-primary/70" />
          </span>
          <h2 className="text-sm font-semibold text-text-heading">{title}</h2>
        </div>
        {right}
      </div>

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
    <div className="p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text-heading truncate">{primary}</div>
        <div className="text-xs text-text-primary/70 truncate">{secondary}</div>
      </div>
      <StatusBadge status={badge} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-4 text-sm text-text-primary/70">{text}</div>;
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15 }}
      className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-card"
    >
      <div className="bg-primary p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold tracking-wide opacity-95">{title}</div>
            <div className="mt-2 text-4xl font-extrabold leading-none">{value}</div>
          </div>
          <span className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </span>
        </div>
      </div>

      <div className="p-4 bg-card">
        <div className="text-xs text-text-primary/70">{subtitle}</div>
      </div>
    </motion.div>
  );
}

function TimeDetailTile({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone: "blue" | "orange" | "red" | "yellow" | "slate";
  sub?: string;
}) {
  const map = {
    blue: "border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 text-[#1F3C68]",
    orange: "border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 text-[#F28C28]",
    red: "border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 text-[#e91f1f]",
    yellow: "border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100/50 text-[#F28C28]",
    slate: "border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 text-[#1F3C68]",
  } as const;

  return (
    <div className={cx("p-4 rounded-xl border", map[tone])}>
      <p className="text-xs text-slate-600 mb-1 font-medium">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1 tabular-nums">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { tasks, leaves } = useAdmin();

  // main clock
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // tick to force live elapsed timers even if now isn't referenced somewhere else
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const nowMs = Date.now();

  // localStorage-backed status map
  const [statusMap, setStatusMap] = useState<StatusMap>(() => readStatusMap());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATUS_KEY) setStatusMap(readStatusMap());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // localStorage-backed attendance
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>(() => readAttendance());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ATTENDANCE_KEY) setAllAttendance(readAttendance());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // current admin session
  const currentAdmin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentAdmin") || "null") as
        | { id: number; email: string; name: string }
        | null;
    } catch {
      return null;
    }
  }, []);

  const adminEmployeeId = currentAdmin ? String(currentAdmin.id) : "";

  const todayISO = useMemo(() => toISODate(now), [now]);

  // KPI: Active Users (employees only)
  const userStats = useMemo(() => {
    const list = accounts as UserAccount[];
    const total = list.length;
    const active = list.filter((u) => (statusMap[`user:${u.id}`] ?? "Active") === "Active").length;
    return { total, active };
  }, [statusMap]);

  // KPI: Pending leaves
  const pendingLeaves = useMemo(() => leaves.filter((l) => l.status === "Pending").length, [leaves]);

  // KPI: Task completion
  const taskStats = useMemo(() => {
    const completed = tasks.filter((t) => t.status === "Completed").length;
    const inProgress = tasks.filter((t) => t.status === "In Progress").length;
    const pending = tasks.filter((t) => t.status === "Pending").length;
    const total = tasks.length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { completed, inProgress, pending, total, pct };
  }, [tasks]);

  // KPI: Attendance today (all records today with a Time In)
  const todayAttendanceCount = useMemo(() => {
    return allAttendance.filter((r) => r.dateISO === todayISO && !!r.timeIn).length;
  }, [allAttendance, todayISO]);

  // Admin record today
  const adminTodayRecord = useMemo(() => {
    if (!adminEmployeeId) return null;
    return allAttendance.find((r) => r.employeeId === adminEmployeeId && r.dateISO === todayISO) ?? null;
  }, [allAttendance, adminEmployeeId, todayISO]);

  const adminStatus = useMemo(() => {
    if (!currentAdmin) return "—";
    const key = `admin:${currentAdmin.id}`;
    return statusMap[key] ?? "Active";
  }, [currentAdmin, statusMap]);

  // Live timers
  const statusLabel = getStatusLabel(adminTodayRecord);
  const workMs = useMemo(() => computeWorkMsLive(adminTodayRecord, nowMs), [adminTodayRecord, nowMs, tick]);
  const breakMs = useMemo(() => computeBreakMsLive(adminTodayRecord, nowMs), [adminTodayRecord, nowMs, tick]);

  const isClockedIn = !!adminTodayRecord?.timeIn && !adminTodayRecord?.timeOut;
  const isOnBreak = !!adminTodayRecord?.lunchOut && !adminTodayRecord?.lunchIn && !adminTodayRecord?.timeOut;

  const upsertAttendance = (patch: Partial<AttendanceRecord>) => {
    if (!adminEmployeeId) return;

    const id = `${adminEmployeeId}_${todayISO}`;
    const nextList = [...allAttendance];
    const idx = nextList.findIndex((r) => r.employeeId === adminEmployeeId && r.dateISO === todayISO);

    if (idx === -1) {
      const base: AttendanceRecord = {
        id,
        employeeId: adminEmployeeId,
        source: getDeviceLabel(),
        dateISO: todayISO,
        timeIn: null,
        lunchOut: null,
        lunchIn: null,
        timeOut: null,
      };
      nextList.unshift({ ...base, ...patch });
    } else {
      nextList[idx] = { ...nextList[idx], ...patch };
    }

    setAllAttendance(nextList);
    writeAttendance(nextList);
  };

  // Actions
  const doTimeIn = () => {
    if (!adminEmployeeId) return;
    if (adminTodayRecord?.timeIn) return;
    upsertAttendance({ timeIn: new Date().toISOString(), source: getDeviceLabel() });
  };

  const doStartBreak = () => {
    if (!adminTodayRecord?.timeIn || adminTodayRecord?.timeOut) return;
    if (adminTodayRecord.lunchOut && !adminTodayRecord.lunchIn) return;
    upsertAttendance({ lunchOut: new Date().toISOString() });
  };

  const doEndBreak = () => {
    if (!adminTodayRecord?.lunchOut || adminTodayRecord?.lunchIn || adminTodayRecord?.timeOut) return;
    upsertAttendance({ lunchIn: new Date().toISOString() });
  };

  const doTimeOut = () => {
    if (!adminTodayRecord?.timeIn || adminTodayRecord?.timeOut) return;
    const nowISO = new Date().toISOString();
    const patch: Partial<AttendanceRecord> = { timeOut: nowISO };
    // if break ongoing, auto-end it
    if (adminTodayRecord.lunchOut && !adminTodayRecord.lunchIn) patch.lunchIn = nowISO;
    upsertAttendance(patch);
  };

  const recentLeaves = useMemo(() => leaves.slice(0, 5), [leaves]);
  const recentTasks = useMemo(() => tasks.slice(0, 5), [tasks]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-text-heading">Admin Dashboard</div>
          <div className="text-sm text-text-primary/70">Workforce overview and activity snapshot</div>

          <div className="mt-2 text-xs text-text-primary/70">
            Signed in as{" "}
            <span className="font-semibold text-text-heading">{currentAdmin?.name ?? "—"}</span> • Status:{" "}
            <span className={cx("font-semibold", adminStatus === "Active" ? "text-green-700" : "text-rose-700")}>
              {adminStatus}
            </span>
          </div>
        </div>

        <div className="bg-primary text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <ClockIcon className="w-4 h-4" />
          <span className="tabular-nums">
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
        <KpiCard title="Active Users" value={userStats.active} subtitle={`Out of ${userStats.total} users`} icon={UsersIcon} />
        <KpiCard title="Pending Leaves" value={pendingLeaves} subtitle="Needs approval" icon={FileText} />
        <KpiCard title="Task Completion" value={`${taskStats.pct}%`} subtitle={`${taskStats.completed}/${taskStats.total} completed`} icon={CheckCircle2} />
        <KpiCard title="Attendance Today" value={todayAttendanceCount} subtitle={todayISO} icon={CalendarDays} />
      </motion.div>

      {/* ✅ Admin Time Tracking (matches user-side look) */}
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-3xl shadow-xl border-2 border-[#F28C28]/20 overflow-hidden"
      >
        {/* Header bar */}
        <div className="bg-primary p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl flex-shrink-0">
                <TimerIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold">Time Tracking</h2>
                <p className="text-sm text-white/90">Track your daily work hours (Admin)</p>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-sm text-white/80 mb-1">Status</p>
              <div
                className={cx(
                  "flex items-center justify-end gap-2 font-bold whitespace-nowrap",
                  statusLabel === "Clocked In"
                    ? "text-emerald-200"
                    : statusLabel === "Clocked Out"
                    ? "text-red-200"
                    : "text-white/70"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                <span className="text-lg">{statusLabel}</span>
              </div>

              {/* ✅ Live timers */}
              <div className="mt-2 text-xs text-white/90 tabular-nums">
                Work Elapsed: <span className="font-extrabold">{adminTodayRecord?.timeIn ? msToHMS(workMs) : "0m 00s"}</span>
              </div>
              <div className="mt-1 text-[11px] text-white/80 tabular-nums">
                Break Elapsed: <span className="font-bold">{adminTodayRecord?.lunchOut ? msToHMS(breakMs) : "0m 00s"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Buttons row (4 big buttons like screenshot) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <motion.button
              whileHover={{ scale: adminStatus === "Active" && !adminTodayRecord?.timeIn ? 1.02 : 1 }}
              whileTap={{ scale: adminStatus === "Active" && !adminTodayRecord?.timeIn ? 0.98 : 1 }}
              onClick={doTimeIn}
              disabled={adminStatus !== "Active" || !!adminTodayRecord?.timeIn}
              className={cx(
                "h-24 rounded-2xl font-bold shadow-sm transition-all border",
                adminStatus !== "Active" || adminTodayRecord?.timeIn
                  ? "bg-slate-200/40 border-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-slate-200/70 border-slate-200 hover:bg-slate-200 text-white"
              )}
              type="button"
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <LogIn className={cx("w-6 h-6", adminStatus !== "Active" || adminTodayRecord?.timeIn ? "text-slate-400" : "text-white")} />
                <span className={cx("text-lg", adminStatus !== "Active" || adminTodayRecord?.timeIn ? "text-slate-400" : "text-white")}>
                  Time In
                </span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: adminStatus === "Active" && !!adminTodayRecord?.timeIn && !adminTodayRecord?.lunchOut && !adminTodayRecord?.timeOut ? 1.02 : 1 }}
              whileTap={{ scale: adminStatus === "Active" && !!adminTodayRecord?.timeIn && !adminTodayRecord?.lunchOut && !adminTodayRecord?.timeOut ? 0.98 : 1 }}
              onClick={doStartBreak}
              disabled={
                adminStatus !== "Active" ||
                !adminTodayRecord?.timeIn ||
                !!adminTodayRecord?.lunchOut ||
                !!adminTodayRecord?.timeOut
              }
              className={cx(
                "h-24 rounded-2xl font-bold shadow-sm transition-all border",
                adminStatus !== "Active" ||
                  !adminTodayRecord?.timeIn ||
                  !!adminTodayRecord?.lunchOut ||
                  !!adminTodayRecord?.timeOut
                  ? "bg-slate-200/40 border-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-slate-200/70 border-slate-200 hover:bg-slate-200 text-white"
              )}
              type="button"
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <Coffee className={cx("w-6 h-6", adminStatus !== "Active" || !adminTodayRecord?.timeIn || !!adminTodayRecord?.lunchOut || !!adminTodayRecord?.timeOut ? "text-slate-400" : "text-white")} />
                <span className={cx("text-lg", adminStatus !== "Active" || !adminTodayRecord?.timeIn || !!adminTodayRecord?.lunchOut || !!adminTodayRecord?.timeOut ? "text-slate-400" : "text-white")}>
                  Start Break
                </span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: adminStatus === "Active" && isOnBreak ? 1.02 : 1 }}
              whileTap={{ scale: adminStatus === "Active" && isOnBreak ? 0.98 : 1 }}
              onClick={doEndBreak}
              disabled={adminStatus !== "Active" || !isOnBreak}
              className={cx(
                "h-24 rounded-2xl font-bold shadow-sm transition-all border",
                adminStatus !== "Active" || !isOnBreak
                  ? "bg-slate-200/40 border-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-slate-200/70 border-slate-200 hover:bg-slate-200 text-white"
              )}
              type="button"
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <Play className={cx("w-6 h-6", adminStatus !== "Active" || !isOnBreak ? "text-slate-400" : "text-white")} />
                <span className={cx("text-lg", adminStatus !== "Active" || !isOnBreak ? "text-slate-400" : "text-white")}>
                  End Break
                </span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: adminStatus === "Active" && !!adminTodayRecord?.timeIn && !adminTodayRecord?.timeOut ? 1.02 : 1 }}
              whileTap={{ scale: adminStatus === "Active" && !!adminTodayRecord?.timeIn && !adminTodayRecord?.timeOut ? 0.98 : 1 }}
              onClick={doTimeOut}
              disabled={adminStatus !== "Active" || !adminTodayRecord?.timeIn || !!adminTodayRecord?.timeOut}
              className={cx(
                "h-24 rounded-2xl font-bold shadow-sm transition-all border",
                adminStatus !== "Active" || !adminTodayRecord?.timeIn || !!adminTodayRecord?.timeOut
                  ? "bg-slate-200/40 border-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-red-500 border-red-500 hover:bg-red-600 text-white"
              )}
              type="button"
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <LogOut className={cx("w-6 h-6", adminStatus !== "Active" || !adminTodayRecord?.timeIn || !!adminTodayRecord?.timeOut ? "text-slate-400" : "text-white")} />
                <span className={cx("text-lg", adminStatus !== "Active" || !adminTodayRecord?.timeIn || !!adminTodayRecord?.timeOut ? "text-slate-400" : "text-white")}>
                  Time Out
                </span>
              </div>
            </motion.button>
          </div>

          {adminStatus !== "Active" && (
            <div className="mb-4 text-xs font-semibold text-rose-700">
              Your admin account is inactive. Time tracking actions are disabled.
            </div>
          )}

          {/* Details tiles row (6 tiles like user dashboard) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <TimeDetailTile label="Time In" value={formatTimeLocal(adminTodayRecord?.timeIn ?? null)} tone="blue" />
            <TimeDetailTile label="Start Break" value={formatTimeLocal(adminTodayRecord?.lunchOut ?? null)} tone="orange" />
            <TimeDetailTile label="End Break" value={formatTimeLocal(adminTodayRecord?.lunchIn ?? null)} tone="orange" />
            <TimeDetailTile label="Time Out" value={formatTimeLocal(adminTodayRecord?.timeOut ?? null)} tone="red" />
            <TimeDetailTile
              label="Elapsed Time"
              value={adminTodayRecord?.timeIn ? msToHMS(workMs) : "--:--"}
              tone="yellow"
              sub="(Work time, break excluded)"
            />
            <TimeDetailTile
              label="Device"
              value={adminTodayRecord?.source ?? getDeviceLabel()}
              tone="slate"
              sub={currentAdmin?.name ? `Admin: ${currentAdmin.name}` : undefined}
            />
          </div>

          {/* Small break timer helper (requested “under first timer”) */}
          <div className="mt-4 text-xs text-slate-600 tabular-nums">
            Break timer:{" "}
            <span className="font-bold text-slate-800">
              {adminTodayRecord?.lunchOut ? msToHMS(breakMs) : "0m 00s"}
            </span>{" "}
            {isOnBreak ? <span className="ml-2 font-semibold text-amber-700">(running)</span> : null}
          </div>
        </div>
      </motion.div>

      {/* Task Progress */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.06 }}
        className="bg-card rounded-2xl shadow-sm border border-slate-200 p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-heading flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-text-primary/70" />
            Task Progress
          </h2>
          <span className="text-xs text-text-primary/70">{taskStats.pct}%</span>
        </div>

        <div className="mt-3 w-full bg-soft rounded-full h-3 overflow-hidden border border-slate-200">
          <div className="bg-primary h-3 rounded-full transition-all" style={{ width: `${taskStats.pct}%` }} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-xs text-text-primary/70">
          <div className="bg-soft border border-slate-200 rounded-xl p-3">
            <div className="font-extrabold text-text-heading text-lg leading-none">{taskStats.completed}</div>
            <div className="text-[11px] text-text-primary/70 mt-1">Completed</div>
          </div>
          <div className="bg-soft border border-slate-200 rounded-xl p-3">
            <div className="font-extrabold text-text-heading text-lg leading-none">{taskStats.inProgress}</div>
            <div className="text-[11px] text-text-primary/70 mt-1">In Progress</div>
          </div>
          <div className="bg-soft border border-slate-200 rounded-xl p-3">
            <div className="font-extrabold text-text-heading text-lg leading-none">{taskStats.pending}</div>
            <div className="text-[11px] text-text-primary/70 mt-1">Pending</div>
          </div>
        </div>
      </motion.div>

      {/* Recent panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Recent Leave Requests" icon={FileText}>
          {recentLeaves.map((l, idx) => (
            <motion.div
              key={l.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
            >
              <Row primary={l.employee} secondary={`${l.type} • ${l.dateFrom ?? l.date ?? ""}`} badge={l.status} />
            </motion.div>
          ))}
          {recentLeaves.length === 0 && <Empty text="No leave requests." />}
        </Panel>

        <Panel title="Recent Tasks" icon={ClipboardList}>
          {recentTasks.map((t, idx) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
            >
              <Row primary={t.title} secondary={`${t.assignedTo} • ${t.priority}`} badge={t.status} />
            </motion.div>
          ))}
          {recentTasks.length === 0 && <Empty text="No tasks." />}
        </Panel>
      </div>
    </motion.div>
  );
}
