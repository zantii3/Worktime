import { motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import accounts from "../data/accounts.json";
import { STORAGE_KEY as LEAVE_STORAGE_KEY } from "../user/types/leaveconstants";
import { useAdmin } from "./context/AdminProvider";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock as ClockIcon,
  Coffee,
  FileText,
  LogIn,
  LogOut,
  Play,
  Timer as TimerIcon,
  Users as UsersIcon,
} from "lucide-react";

type Status = "Active" | "Inactive";
type StatusMap = Record<string, Status>;

type UserAccount = { id: number; email: string; password: string; name: string };

type LooseLeaveStatus = "Pending" | "Approved" | "Rejected" | string;

type DashboardLeave = {
  id: number | string;
  employee: string;
  type: string;
  status: LooseLeaveStatus;
  dateFrom: string;
  dateTo: string;
  appliedOn?: string;
  reason?: string;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  source?: "Desktop" | "Mobile" | string;
  dateISO: string;
  timeIn: string | null;
  lunchOut: string | null;
  lunchIn: string | null;
  timeOut: string | null;
};

const STATUS_KEY = "worktime_account_status_v1";
const ATTENDANCE_KEY = "worktime_attendance_v1";

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

function normalizeLeave(raw: unknown): DashboardLeave | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as Record<string, unknown>;

  const employee =
    typeof item.employee === "string" && item.employee.trim()
      ? item.employee.trim()
      : "Unknown";

  const type =
    typeof item.type === "string" && item.type.trim() ? item.type.trim() : "Leave";

  const status =
    typeof item.status === "string" && item.status.trim() ? item.status.trim() : "Pending";

  const dateFrom =
    typeof item.dateFrom === "string" && item.dateFrom
      ? item.dateFrom
      : typeof item.startDate === "string" && item.startDate
      ? item.startDate
      : typeof item.date === "string" && item.date
      ? item.date
      : "";

  const dateTo =
    typeof item.dateTo === "string" && item.dateTo
      ? item.dateTo
      : typeof item.endDate === "string" && item.endDate
      ? item.endDate
      : typeof item.date === "string" && item.date
      ? item.date
      : dateFrom;

  const appliedOn =
    typeof item.appliedOn === "string"
      ? item.appliedOn
      : typeof item.date === "string"
      ? item.date
      : undefined;

  return {
    id:
      typeof item.id === "number" || typeof item.id === "string"
        ? item.id
        : Date.now(),
    employee,
    type,
    status,
    dateFrom,
    dateTo,
    appliedOn,
    reason: typeof item.reason === "string" ? item.reason : undefined,
  };
}

function readLeavesFromStorage(): DashboardLeave[] {
  try {
    const raw = localStorage.getItem(LEAVE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeLeave)
      .filter((item): item is DashboardLeave => Boolean(item))
      .sort((a, b) => {
        const aTime = new Date(b.appliedOn ?? b.dateFrom ?? 0).getTime();
        const bTime = new Date(a.appliedOn ?? a.dateFrom ?? 0).getTime();
        return aTime - bTime;
      });
  } catch {
    return [];
  }
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

function computeWorkMsLive(r: AttendanceRecord | null, nowMs: number) {
  if (!r?.timeIn) return 0;

  const start = new Date(r.timeIn).getTime();
  const end = r.timeOut ? new Date(r.timeOut).getTime() : nowMs;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;

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

function formatLeaveDateRange(from: string, to: string) {
  if (!from && !to) return "No date";
  if (from && to && from !== to) return `${from} • ${to}`;
  return from || to;
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

function msToClockText(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function msToHM(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function ProgressRing({ pct }: { pct: number }) {
  const size = 176;
  const radius = 62;
  const stroke = 12;
  const cxp = size / 2;
  const cyp = size / 2;
  const c = 2 * Math.PI * radius;
  const safePct = clamp(pct, 0, 100);
  const dash = (safePct / 100) * c;

  return (
    <div className="relative h-[176px] w-[176px] grid place-items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <circle
          cx={cxp}
          cy={cyp}
          r={radius}
          fill="none"
          stroke="rgba(148, 163, 184, 0.22)"
          strokeWidth={stroke}
        />
        <circle
          cx={cxp}
          cy={cyp}
          r={radius}
          fill="none"
          stroke="rgba(245, 158, 11, 0.95)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${cxp} ${cyp})`}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-text-primary/70">
          Progress
        </div>
        <div className="mt-1 text-3xl font-extrabold text-[#1F3C68] tabular-nums leading-none">
          {Math.round(safePct)}%
        </div>
      </div>
    </div>
  );
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-9 w-9 rounded-xl bg-soft border border-slate-200 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-text-primary/70" />
          </span>
          <h2 className="text-sm font-semibold text-text-heading truncate">{title}</h2>
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
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      type="button"
      className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-card text-left group cursor-pointer"
    >
      <div className="bg-primary p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold tracking-wide opacity-95">{title}</div>
            <div className="mt-2 text-4xl font-extrabold leading-none">{value}</div>
          </div>

          <span className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </span>
        </div>
      </div>

      <div className="p-4 bg-card flex items-center justify-between gap-3">
        <div className="text-xs text-text-primary/70">{subtitle}</div>
        <ArrowRight className="w-4 h-4 text-text-primary/50 transition-transform group-hover:translate-x-1" />
      </div>
    </motion.button>
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
    <div className={cx("p-4 rounded-xl border min-w-0", map[tone])}>
      <p className="text-xs text-slate-600 mb-1 font-medium">{label}</p>
      <p className="text-lg font-bold tabular-nums truncate">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1 tabular-nums line-clamp-2">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { tasks } = useAdmin();

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const nowMs = Date.now();

  const [statusMap, setStatusMap] = useState<StatusMap>(() => readStatusMap());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATUS_KEY) setStatusMap(readStatusMap());
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>(() => readAttendance());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ATTENDANCE_KEY) setAllAttendance(readAttendance());
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [storedLeaves, setStoredLeaves] = useState<DashboardLeave[]>(() => readLeavesFromStorage());
  useEffect(() => {
    const syncLeaves = () => setStoredLeaves(readLeavesFromStorage());

    const onStorage = (e: StorageEvent) => {
      if (e.key === LEAVE_STORAGE_KEY) syncLeaves();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", syncLeaves);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", syncLeaves);
    };
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

  const adminEmployeeId = currentAdmin ? String(currentAdmin.id) : "";
  const todayISO = useMemo(() => toISODate(now), [now]);

  const userStats = useMemo(() => {
    const list = accounts as UserAccount[];
    const total = list.length;
    const active = list.filter((u) => (statusMap[`user:${u.id}`] ?? "Active") === "Active").length;
    return { total, active };
  }, [statusMap]);

  const pendingLeaves = useMemo(
    () => storedLeaves.filter((l) => l.status === "Pending").length,
    [storedLeaves]
  );

  const taskStats = useMemo(() => {
    const completed = tasks.filter((t) => t.status === "Completed").length;
    const inProgress = tasks.filter((t) => t.status === "In Progress").length;
    const pending = tasks.filter((t) => t.status === "Pending").length;
    const total = tasks.length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { completed, inProgress, pending, total, pct };
  }, [tasks]);

  const todayAttendanceCount = useMemo(() => {
    return allAttendance.filter((r) => r.dateISO === todayISO && !!r.timeIn).length;
  }, [allAttendance, todayISO]);

  const adminTodayRecord = useMemo(() => {
    if (!adminEmployeeId) return null;
    return allAttendance.find((r) => r.employeeId === adminEmployeeId && r.dateISO === todayISO) ?? null;
  }, [allAttendance, adminEmployeeId, todayISO]);

  const adminStatus = useMemo(() => {
    if (!currentAdmin) return "—";
    const key = `admin:${currentAdmin.id}`;
    return statusMap[key] ?? "Active";
  }, [currentAdmin, statusMap]);

  const statusLabel = getStatusLabel(adminTodayRecord);
  const workMs = useMemo(() => computeWorkMsLive(adminTodayRecord, nowMs), [adminTodayRecord, nowMs, tick]);
  const breakMs = useMemo(() => computeBreakMsLive(adminTodayRecord, nowMs), [adminTodayRecord, nowMs, tick]);

  const isOnBreak = !!adminTodayRecord?.lunchOut && !adminTodayRecord?.lunchIn && !adminTodayRecord?.timeOut;

  /* ================================
   BUTTON + STATE LOGIC
  ================================ */

    const isTimedIn = !!adminTodayRecord?.timeIn;
    const isTimedOut = !!adminTodayRecord?.timeOut;

    const canTimeIn =
      adminStatus === "Active" &&
      !isTimedIn;

    const canTimeOut =
      adminStatus === "Active" &&
      isTimedIn &&
      !isTimedOut;

    const canStartBreak =
      adminStatus === "Active" &&
      isTimedIn &&
      !adminTodayRecord?.lunchOut &&
      !isTimedOut;

    const canEndBreak =
      adminStatus === "Active" &&
      isOnBreak;

    /* Toggle handlers */

    const handleTimeToggle = () => {
      if (canTimeIn) doTimeIn();
      else if (canTimeOut) doTimeOut();
    };

    const handleBreakToggle = () => {
      if (canStartBreak) doStartBreak();
      else if (canEndBreak) doEndBreak();
    };

    /* Dynamic Labels */

    const timeButtonLabel =
      canTimeIn ? "Time In" : "Time Out";

    const breakButtonLabel =
      canEndBreak ? "End Break" : "Start Break";

    /* ================================
       LIVE STATE TEXT
    ================================ */

    const liveStateText = useMemo(() => {
      if (!isTimedIn) return "Ready to Time In";

      if (isOnBreak) return "On Break";

      if (isTimedOut) return "Work Completed";

      return "Working";
    }, [
      isTimedIn,
      isTimedOut,
      isOnBreak
    ]);

  const SHIFT_MS = 8 * 60 * 60 * 1000;
  const remainingMs = clamp(SHIFT_MS - workMs, 0, SHIFT_MS);
  const regularMs = clamp(workMs, 0, SHIFT_MS);
  const overtimeMs = Math.max(0, workMs - SHIFT_MS);
  const progressPct = SHIFT_MS ? Math.round((regularMs / SHIFT_MS) * 100) : 0;

  const upsertAttendance = (patch: Partial<AttendanceRecord>) => {
    if (!adminEmployeeId) return;

    const id = `${adminEmployeeId}_${todayISO}`;
    const nextList = [...allAttendance];
    const idx = nextList.findIndex(
      (r) => r.employeeId === adminEmployeeId && r.dateISO === todayISO
    );

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
    if (adminTodayRecord.lunchOut && !adminTodayRecord.lunchIn) patch.lunchIn = nowISO;
    upsertAttendance(patch);
  };

  const recentPendingLeaves = useMemo(() => {
    return storedLeaves.filter((l) => l.status === "Pending").slice(0, 5);
  }, [storedLeaves]);

  const adminOwnLeaves = useMemo(() => {
    if (!currentAdmin?.name) return [];
    return storedLeaves.filter((l) => l.employee === currentAdmin.name).slice(0, 5);
  }, [storedLeaves, currentAdmin?.name]);

  const recentTasks = useMemo(() => tasks.slice(0, 5), [tasks]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
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
            {now.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
      >
        <KpiCard
          title="Active Users"
          value={userStats.active}
          subtitle={`Out of ${userStats.total} users`}
          icon={UsersIcon}
          onClick={() => navigate("/admin/users")}
        />
        <KpiCard
          title="Pending Leaves"
          value={pendingLeaves}
          subtitle="Needs approval"
          icon={FileText}
          onClick={() => navigate("/admin/leave")}
        />
        <KpiCard
          title="Task Completion"
          value={`${taskStats.pct}%`}
          subtitle={`${taskStats.completed}/${taskStats.total} completed`}
          icon={CheckCircle2}
          onClick={() => navigate("/admin/tasks")}
        />
        <KpiCard
          title="Attendance Today"
          value={todayAttendanceCount}
          subtitle={todayISO}
          icon={CalendarDays}
          onClick={() => navigate("/admin/attendance")}
        />
      </motion.div>

      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-3xl shadow-xl border-2 border-[#F28C28]/20 overflow-hidden"
      >
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
                <div
  className={cx(
    "flex flex-col items-end font-bold whitespace-nowrap",

    statusLabel === "Clocked In"
      ? "text-emerald-200"
      : statusLabel === "Clocked Out"
      ? "text-red-200"
      : "text-white/70"
  )}
>

  <div className="flex items-center gap-2">

    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />

    <span className="text-lg">
      {statusLabel}
    </span>

  </div>

  {/* NEW STATE TEXT */}
  <span className="text-xs text-white/80 mt-1 font-semibold tracking-wide">

    {liveStateText}

  </span>

</div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pt-7">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="flex justify-center lg:justify-start">
              <div className="relative">
                <div className="absolute inset-0 -z-10 rounded-full blur-2xl opacity-35 bg-orange-200" />
                <ProgressRing pct={progressPct} />
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="text-center max-w-full">
                <div className="text-sm text-text-primary/70 font-semibold">Remaining Time</div>
                <div className="mt-2 text-[clamp(2rem,5vw,3.5rem)] font-extrabold tabular-nums tracking-[0.08em] text-[#1F3C68] leading-none">
                  {msToClockText(remainingMs)}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-10">
                <div className="text-center">
                  <div className="text-sm text-text-primary/60 font-semibold">Regular</div>
                  <div className="mt-1 text-xl font-extrabold tabular-nums text-green-600">
                    {msToHM(regularMs)}
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-sm text-text-primary/60 font-semibold">Overtime</div>
                  <div className="mt-1 text-xl font-extrabold tabular-nums text-slate-400">
                    {msToHM(overtimeMs)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-[560px] grid grid-cols-1 sm:grid-cols-2 gap-4 lg:mt-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center min-w-0 overflow-hidden">
                  <div className="text-sm text-text-primary/70 font-semibold">Elapsed Time</div>
                  <div className="mt-2 text-[clamp(1.6rem,3vw,2.4rem)] font-extrabold tabular-nums tracking-[0.04em] text-[#1F3C68] leading-tight break-words">
                    {adminTodayRecord?.timeIn ? msToClockText(workMs) : "00:00:00"}
                  </div>
                  <div className="mt-1 text-xs text-text-primary/60">(work, break excluded)</div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center min-w-0 overflow-hidden">
                  <div className="text-sm text-text-primary/70 font-semibold">Break Time</div>
                  <div className="mt-2 text-[clamp(1.6rem,3vw,2.4rem)] font-extrabold tabular-nums tracking-[0.04em] text-secondary leading-tight break-words">
                    {adminTodayRecord?.lunchOut ? msToClockText(breakMs) : "00:00:00"}
                  </div>
                  <div className="mt-1 text-xs text-text-primary/60">{isOnBreak ? "(running)" : "(stopped)"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* ================================
   MERGED BUTTONS (2 ONLY)
================================ */}

<div className="grid grid-cols-2 gap-4 mb-6">

  {/* TIME BUTTON */}

  <motion.button
    whileHover={{
      scale: canTimeIn || canTimeOut ? 1.02 : 1
    }}
    whileTap={{
      scale: canTimeIn || canTimeOut ? 0.98 : 1
    }}
    onClick={handleTimeToggle}
    disabled={!canTimeIn && !canTimeOut}
    className={cx(
      "h-28 rounded-2xl font-bold shadow-sm transition-all border",

      !canTimeIn && !canTimeOut
        ? "bg-slate-200/40 border-slate-200 text-slate-400 cursor-not-allowed"

        : canTimeIn
        ? "bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white"

        : "bg-red-500 border-red-500 hover:bg-red-600 text-white"
    )}
    type="button"
  >

    <div className="flex flex-col items-center justify-center gap-2">

      {canTimeIn ? (

        <LogIn className="w-7 h-7 text-white" />

      ) : (

        <LogOut className="w-7 h-7 text-white" />

      )}

      <span className="text-lg">

        {timeButtonLabel}

      </span>

    </div>

  </motion.button>



  {/* BREAK BUTTON */}

  <motion.button
    whileHover={{
      scale: canStartBreak || canEndBreak ? 1.02 : 1
    }}
    whileTap={{
      scale: canStartBreak || canEndBreak ? 0.98 : 1
    }}
    onClick={handleBreakToggle}
    disabled={!canStartBreak && !canEndBreak}
    className={cx(
      "h-28 rounded-2xl font-bold shadow-sm transition-all border",

      !canStartBreak && !canEndBreak
        ? "bg-slate-200/40 border-slate-200 text-slate-400 cursor-not-allowed"

        : canEndBreak
        ? "bg-primary border-primary hover:opacity-95 text-white"

        : "bg-secondary border-secondary hover:opacity-95 text-white"
    )}
    type="button"
  >

    <div className="flex flex-col items-center justify-center gap-2">

      {canEndBreak ? (

        <Play className="w-7 h-7 text-white" />

      ) : (

        <Coffee className="w-7 h-7 text-white" />

      )}

      <span className="text-lg">

        {breakButtonLabel}

      </span>

    </div>

  </motion.button>

</div>

          {adminStatus !== "Active" && (
            <div className="mb-4 text-xs font-semibold text-rose-700">
              Your admin account is inactive. Time tracking actions are disabled.
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <TimeDetailTile label="Time In" value={formatTimeLocal(adminTodayRecord?.timeIn ?? null)} tone="blue" />
            <TimeDetailTile label="Start Break" value={formatTimeLocal(adminTodayRecord?.lunchOut ?? null)} tone="orange" />
            <TimeDetailTile label="End Break" value={formatTimeLocal(adminTodayRecord?.lunchIn ?? null)} tone="orange" />
            <TimeDetailTile label="Time Out" value={formatTimeLocal(adminTodayRecord?.timeOut ?? null)} tone="red" />
            <TimeDetailTile
              label="Elapsed Time"
              value={adminTodayRecord?.timeIn ? msToClockText(workMs) : "--:--"}
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
        </div>
      </motion.div>

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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Panel title="Recent Pending Leave Requests" icon={FileText}>
          {recentPendingLeaves.map((l, idx) => (
            <motion.div
              key={String(l.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
            >
              <Row
                primary={l.employee}
                secondary={`${l.type} • ${formatLeaveDateRange(l.dateFrom, l.dateTo)}`}
                badge={String(l.status)}
              />
            </motion.div>
          ))}
          {recentPendingLeaves.length === 0 && <Empty text="No pending leave requests." />}
        </Panel>

        <Panel title="My Leave Requests" icon={CalendarDays}>
          {adminOwnLeaves.map((l, idx) => (
            <motion.div
              key={String(l.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
            >
              <Row
                primary={l.type}
                secondary={formatLeaveDateRange(l.dateFrom, l.dateTo)}
                badge={String(l.status)}
              />
            </motion.div>
          ))}
          {adminOwnLeaves.length === 0 && <Empty text="You have no leave requests yet." />}
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