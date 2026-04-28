import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  History,
  LogIn,
  LogOut,
  Pencil,
  Timer,
  Utensils,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import accounts from "../data/accounts.json";
import AdminAttendanceCalendar, {
  type AttendanceRecord,
} from "./components/AdminAttendanceCalendar";
import adminAccounts from "./data/adminAccounts.json";

type Account = { id: number; email: string; password: string; name: string };

const ATTENDANCE_KEY = "worktime_attendance_v1";
const ALL_LEAVES_KEY = "all_leaves_v1";
const MONTH_TARGET_HOURS = 160;

const STANDARD_SHIFT_START = "08:00";
const LATE_THRESHOLD_MINUTES = 0;

type StoredLeaveRequest = {
  id: number;
  employee: string;
  status: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
};

// Maps leave type strings to display config
const LEAVE_TYPE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  "Vacation Leave": {
    label: "Vacation Leave",
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-500",
  },
  "Sick Leave": {
    label: "Sick Leave",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  "Emergency Leave": {
    label: "Emergency Leave",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-500",
  },
  "Maternity/Paternity Leave": {
    label: "Maternity/Paternity Leave",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
};

function getLeaveTypeConfig(type: string) {
  return (
    LEAVE_TYPE_CONFIG[type] ?? {
      label: type,
      bg: "bg-slate-50",
      text: "text-slate-700",
      border: "border-slate-200",
      dot: "bg-slate-400",
    }
  );
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isoToLocalMidnight(dateISO: string) {
  return new Date(dateISO + "T00:00:00");
}
function isWeekdayISO(dateISO: string) {
  const d = isoToLocalMidnight(dateISO);
  const day = d.getDay();
  return day !== 0 && day !== 6;
}
function isPastDayISO(dateISO: string) {
  const d = isoToLocalMidnight(dateISO).getTime();
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return d < t0;
}
function isTodayISO(dateISO: string) {
  return dateISO === toISODate(new Date());
}

function formatFullDate(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const dt = new Date(iso);
  return dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function minutesBetween(aISO: string | null, bISO: string | null) {
  if (!aISO || !bISO) return 0;
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 60000));
}

function computeWorkMinutes(r: AttendanceRecord) {
  const gross = minutesBetween(r.timeIn ?? null, r.timeOut ?? null);
  const lunch = minutesBetween(r.lunchOut ?? null, r.lunchIn ?? null);
  return Math.max(0, gross - lunch);
}

function formatHoursFromMinutes(mins: number) {
  return (mins / 60).toFixed(1);
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function getLateMinutes(timeIn: string | null, now?: Date): number {
  const [h, m] = STANDARD_SHIFT_START.split(":").map(Number);

  if (!timeIn) {
    if (!now) return 0;
    const shiftStart = new Date(now);
    shiftStart.setHours(h, m, 0, 0);
    const diff = Math.floor((now.getTime() - shiftStart.getTime()) / 60000);
    return diff > LATE_THRESHOLD_MINUTES ? diff : 0;
  }

  const t = new Date(timeIn);
  const dayShiftStart = new Date(t);
  dayShiftStart.setHours(h, m, 0, 0);
  const diff = Math.floor((t.getTime() - dayShiftStart.getTime()) / 60000);
  return diff > LATE_THRESHOLD_MINUTES ? diff : 0;
}

function safeTextCSV(v: unknown) {
  const s = String(v ?? "");
  return `"${s.replaceAll('"', '""')}"`;
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function isoToLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function localInputToISO(val: string) {
  if (!val) return null;
  const d = new Date(val);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function isValidISODateText(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  return Number.isFinite(d.getTime()) && toISODate(d) === s;
}

function listMonthDatesISO(viewMonth: Date) {
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const out: string[] = [];
  for (let day = 1; day <= last; day++) {
    out.push(
      `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    );
  }
  return out;
}

// ── Leave helpers ─────────────────────────────────────────────────────────────

function readLeaves(): StoredLeaveRequest[] {
  try {
    const raw = localStorage.getItem(ALL_LEAVES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as StoredLeaveRequest[]) : [];
  } catch {
    return [];
  }
}

function resolveLeaveRange(leave: StoredLeaveRequest): {
  dateFrom: string;
  dateTo: string;
} {
  return {
    dateFrom: leave.dateFrom ?? leave.startDate ?? leave.date ?? "",
    dateTo: leave.dateTo ?? leave.endDate ?? leave.date ?? "",
  };
}

function enumerateDateRange(dateFrom: string, dateTo: string): string[] {
  if (!dateFrom || !dateTo) return [];
  const dates: string[] = [];
  const cursor = new Date(dateFrom + "T00:00:00");
  const end = new Date(dateTo + "T00:00:00");
  if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(end.getTime())) return [];
  while (cursor <= end) {
    dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function ActionButton({
  variant = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "dark";
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-primary text-white hover:opacity-95 focus:ring-primary/30"
      : variant === "danger"
      ? "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-200"
      : variant === "dark"
      ? "bg-slate-900 text-white hover:opacity-95 focus:ring-slate-200"
      : "border border-slate-200 bg-white text-text-heading hover:bg-soft focus:ring-primary/20";

  return <button className={cx(base, styles, className)} {...props} />;
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="text-sm font-bold text-text-heading">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-primary/70 hover:bg-soft"
            type="button"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function LogSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="p-3 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden"
        >
          <div className="flex justify-between items-center">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="h-3.5 rounded-full bg-slate-200 animate-pulse"
                  style={{ width: `${70 + (i % 3) * 24}px` }}
                />
                {i % 2 === 0 && (
                  <div className="h-3 w-12 rounded-full bg-slate-200 animate-pulse" />
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-10 rounded-full bg-green-100 animate-pulse" />
                <div className="h-2 w-3 rounded-full bg-slate-200 animate-pulse" />
                <div className="h-3 w-10 rounded-full bg-red-100 animate-pulse" />
              </div>
            </div>
            <div className="h-6 w-16 rounded-full bg-slate-200 animate-pulse ml-3" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── DayDetailModal ────────────────────────────────────────────────────────────

function DayDetailModal({
  dateISO,
  record,
  now,
  leaveInfo,
  onClose,
  onEdit,
}: {
  dateISO: string;
  record: AttendanceRecord | null;
  now: Date;
  /** Combined leave status + type for this date, if any */
  leaveInfo: { status: "Pending" | "Approved"; type: string } | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const date = new Date(dateISO + "T12:00:00");
  const isToday = isTodayISO(dateISO);

  const lateMinutes = getLateMinutes(record?.timeIn ?? null, isToday ? now : undefined);

  const workMins = record ? computeWorkMinutes(record) : 0;
  const totalHours = workMins / 60;
  const regularHours = Math.min(totalHours, 9);
  const overtimeHours = Math.max(totalHours - 9, 0);

  const hasAny =
    !!record?.timeIn || !!record?.timeOut || !!record?.lunchIn || !!record?.lunchOut;

  const isAbsentPastWeekday = isWeekdayISO(dateISO) && isPastDayISO(dateISO) && !record && !leaveInfo;

  const leaveCfg = leaveInfo ? getLeaveTypeConfig(leaveInfo.type) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1F3C68] p-6 text-white relative">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={onEdit}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              type="button"
              aria-label="Edit day record"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-white/70 text-sm font-medium">
            {date.toLocaleDateString("en-US", { weekday: "long" })}
          </p>

          <h2 className="text-2xl font-bold mt-0.5">
            {date.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h2>

          {/* Status badges row */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {isAbsentPastWeekday && (
              <span className="px-3 py-1 bg-rose-400/30 text-rose-100 rounded-full text-xs font-bold">
                Absent
              </span>
            )}

            {!record && !isAbsentPastWeekday && !leaveInfo && (
              <span className="px-3 py-1 bg-slate-500/40 rounded-full text-xs font-bold">
                No Record
              </span>
            )}

            {hasAny && (
              <span
                className={cx(
                  "px-3 py-1 rounded-full text-xs font-bold",
                  lateMinutes > 0
                    ? "bg-red-400/30 text-red-200"
                    : "bg-green-400/30 text-green-200"
                )}
              >
                {lateMinutes > 0 ? `Late ${formatMinutes(lateMinutes)}` : "On Time"}
              </span>
            )}

            {overtimeHours > 0 && (
              <span className="px-3 py-1 bg-orange-400/30 text-orange-200 rounded-full text-xs font-bold">
                +{overtimeHours.toFixed(1)}h OT
              </span>
            )}

            {/* Leave badge in header */}
            {leaveInfo && (
              <span
                className={cx(
                  "px-3 py-1 rounded-full text-xs font-bold border",
                  leaveInfo.status === "Approved"
                    ? "bg-blue-400/30 text-blue-100 border-blue-300/50"
                    : "bg-yellow-400/30 text-yellow-100 border-yellow-300/50"
                )}
              >
                {leaveInfo.status === "Approved" ? "✓ Approved Leave" : "⏳ Leave Pending"}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {/* ── Leave info card (shown regardless of attendance) ── */}
          {leaveInfo && leaveCfg && (
            <div
              className={cx(
                "rounded-2xl border p-4",
                leaveInfo.status === "Approved"
                  ? "bg-blue-50 border-blue-200"
                  : "bg-yellow-50 border-yellow-200"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Colored dot / icon */}
                <div
                  className={cx(
                    "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold",
                    leaveInfo.status === "Approved" ? "bg-blue-500" : "bg-yellow-500"
                  )}
                >
                  {leaveInfo.status === "Approved" ? "✓" : "⏳"}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className={cx(
                      "text-xs font-bold uppercase tracking-wide mb-1",
                      leaveInfo.status === "Approved"
                        ? "text-blue-600"
                        : "text-yellow-600"
                    )}
                  >
                    {leaveInfo.status === "Approved"
                      ? "Approved Leave"
                      : "Pending Leave Request"}
                  </div>

                  {/* Leave type pill */}
                  <span
                    className={cx(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
                      leaveCfg.bg,
                      leaveCfg.text,
                      leaveCfg.border
                    )}
                  >
                    <span
                      className={cx("w-1.5 h-1.5 rounded-full", leaveCfg.dot)}
                    />
                    {leaveCfg.label}
                  </span>

                  {leaveInfo.status === "Pending" && (
                    <p className="text-xs text-yellow-700/80 mt-2">
                      This leave request is awaiting admin approval.
                    </p>
                  )}
                  {leaveInfo.status === "Approved" && (
                    <p className="text-xs text-blue-700/80 mt-2">
                      Employee is on approved leave — no attendance required.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Attendance breakdown (shown if record exists) ── */}
          {record ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 bg-green-500 rounded-lg">
                      <LogIn className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wide">
                      Time In
                    </p>
                  </div>
                  <p className="text-xl font-bold text-green-800">
                    {formatTime(record.timeIn)}
                  </p>
                  {lateMinutes > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3 text-red-500" />
                      <p className="text-[10px] text-red-500 font-semibold">
                        {formatMinutes(lateMinutes)} late
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-red-50 border border-red-200 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 bg-red-500 rounded-lg">
                      <LogOut className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-xs font-bold text-red-700 uppercase tracking-wide">
                      Time Out
                    </p>
                  </div>
                  <p className="text-xl font-bold text-red-800">
                    {formatTime(record.timeOut)}
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 bg-yellow-500 rounded-lg">
                      <Coffee className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-xs font-bold text-yellow-700 uppercase tracking-wide">
                      Start Break
                    </p>
                  </div>
                  <p className="text-xl font-bold text-yellow-800">
                    {formatTime(record.lunchOut)}
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 bg-blue-500 rounded-lg">
                      <Utensils className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                      End Break
                    </p>
                  </div>
                  <p className="text-xl font-bold text-blue-800">
                    {formatTime(record.lunchIn)}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                  Hours Summary
                </p>

                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-600">Regular Hours</span>
                  <span className="font-bold text-[#1F3C68]">
                    {regularHours.toFixed(1)} hrs
                  </span>
                </div>

                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-slate-600">Overtime</span>
                  <span
                    className={cx(
                      "font-bold",
                      overtimeHours > 0 ? "text-orange-500" : "text-slate-400"
                    )}
                  >
                    {overtimeHours.toFixed(1)} hrs
                  </span>
                </div>

                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full flex">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((regularHours / 9) * 100, 100)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full bg-[#1F3C68] rounded-l-full"
                    />
                    {overtimeHours > 0 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((overtimeHours / 9) * 30, 30)}%` }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                        className="h-full bg-orange-400 rounded-r-full"
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-400">0h</span>
                  <span className="text-[10px] font-bold text-[#1F3C68]">
                    Total: {totalHours.toFixed(1)} hrs
                  </span>
                  <span className="text-[10px] text-slate-400">9h</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Device</span>
                <span className="font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full text-xs">
                  {record.source ?? "—"}
                </span>
              </div>
            </>
          ) : (
            /* No attendance record */
            !leaveInfo && (
              <div className="text-center py-8 text-slate-400">
                <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">
                  {isAbsentPastWeekday
                    ? "Absent (no attendance recorded)"
                    : "No attendance recorded"}
                </p>
                {!isAbsentPastWeekday && (
                  <p className="text-xs mt-2 text-slate-400">
                    Future dates won't be marked absent until the day has passed.
                  </p>
                )}
              </div>
            )
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Attendance Component ─────────────────────────────────────────────────

export default function Attendance() {
  const employeeList = useMemo(() => {
    const admins = (adminAccounts as Account[]).map((a) => ({
      id: String(a.id),
      name: `${a.name} (Admin)`,
    }));

    const users = (accounts as Account[]).map((u) => ({
      id: String(u.id),
      name: `${u.name} (User)`,
    }));

    return [...admins, ...users];
  }, []);

  function readAttendance(): AttendanceRecord[] {
    try {
      const raw = localStorage.getItem(ATTENDANCE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as AttendanceRecord[]) : [];
    } catch {
      return [];
    }
  }

  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>(() =>
    readAttendance()
  );

  useEffect(() => {
    try {
      localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(allRecords));
    } catch (e) {
      console.error("Failed to save attendance records:", e);
    }
  }, [allRecords]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ATTENDANCE_KEY) setAllRecords(readAttendance());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Leave state ───────────────────────────────────────────────────────────
  const [allLeaves, setAllLeaves] = useState<StoredLeaveRequest[]>(() =>
    readLeaves()
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ALL_LEAVES_KEY) setAllLeaves(readLeaves());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    employeeList[0]?.id ?? ""
  );
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  const [selectedDateISO, setSelectedDateISO] = useState<string>(
    toISODate(new Date())
  );

  const [detailOpen, setDetailOpen] = useState(false);

  const [dateQuery, setDateQuery] = useState<string>(selectedDateISO);
  const [dateError, setDateError] = useState<string>("");

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => setDateQuery(selectedDateISO), [selectedDateISO]);

  useEffect(() => {
    const d = new Date(selectedDateISO + "T00:00:00");
    if (!isSameMonth(d, viewMonth)) setViewMonth(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateISO]);

  useEffect(() => {
    if (!employeeList.length) return;
    const exists = employeeList.some((e) => e.id === selectedEmployeeId);
    if (!exists) setSelectedEmployeeId(employeeList[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeList.length]);

  const selectedEmployee = employeeList.find((e) => e.id === selectedEmployeeId);

  const recordsForEmployee = useMemo(() => {
    return allRecords.filter((r) => r.employeeId === selectedEmployeeId);
  }, [allRecords, selectedEmployeeId]);

  const recordsForMonth = useMemo(() => {
    const a = startOfMonth(viewMonth).getTime();
    const b = endOfMonth(viewMonth).getTime();
    return recordsForEmployee.filter((r) => {
      const t = new Date(r.dateISO + "T00:00:00").getTime();
      return t >= a && t <= b;
    });
  }, [recordsForEmployee, viewMonth]);

  const recordByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of recordsForMonth) map.set(r.dateISO, r);
    return map;
  }, [recordsForMonth]);

  const selectedDayRecord = useMemo(() => {
    return recordByDate.get(selectedDateISO) ?? null;
  }, [recordByDate, selectedDateISO]);

  // ── Leave date maps ───────────────────────────────────────────────────────

  /**
   * leaveDatesForMonth — passed to the calendar for tile coloring.
   * Only "Pending" and "Approved" are shown; "Rejected" is ignored.
   */
  const leaveDatesForMonth = useMemo(() => {
    const map = new Map<string, "Pending" | "Approved">();

    const baseName =
      selectedEmployee?.name.replace(/ \((Admin|User)\)$/, "") ?? "";

    if (!baseName) return map;

    const monthStart = startOfMonth(viewMonth).getTime();
    const monthEnd = endOfMonth(viewMonth).getTime();

    for (const leave of allLeaves) {
      if (leave.employee !== baseName) continue;
      if (leave.status !== "Pending" && leave.status !== "Approved") continue;

      const { dateFrom, dateTo } = resolveLeaveRange(leave);
      if (!dateFrom || !dateTo) continue;

      for (const dateISO of enumerateDateRange(dateFrom, dateTo)) {
        const t = new Date(dateISO + "T00:00:00").getTime();
        if (t < monthStart || t > monthEnd) continue;

        if (map.get(dateISO) !== "Approved") {
          map.set(dateISO, leave.status as "Pending" | "Approved");
        }
      }
    }

    return map;
  }, [allLeaves, selectedEmployee, viewMonth]);

  /**
   * leaveTypeForDate — maps each date to its leave type string so the modal
   * can display "Vacation Leave", "Sick Leave", etc.
   */
  const leaveTypeForDate = useMemo(() => {
    const map = new Map<string, string>();

    const baseName =
      selectedEmployee?.name.replace(/ \((Admin|User)\)$/, "") ?? "";

    if (!baseName) return map;

    for (const leave of allLeaves) {
      if (leave.employee !== baseName) continue;
      if (leave.status !== "Pending" && leave.status !== "Approved") continue;
      if (!leave.type) continue;

      const { dateFrom, dateTo } = resolveLeaveRange(leave);
      if (!dateFrom || !dateTo) continue;

      for (const dateISO of enumerateDateRange(dateFrom, dateTo)) {
        // "Approved" wins if multiple leaves overlap on the same date
        const existingStatus = leaveDatesForMonth.get(dateISO);
        if (!map.has(dateISO) || existingStatus === "Approved") {
          map.set(dateISO, leave.type);
        }
      }
    }

    return map;
  }, [allLeaves, selectedEmployee, leaveDatesForMonth]);

  /** Derive the combined leave info for a given date. */
  function getLeaveInfoForDate(
    dateISO: string
  ): { status: "Pending" | "Approved"; type: string } | null {
    const status = leaveDatesForMonth.get(dateISO);
    const type = leaveTypeForDate.get(dateISO);
    if (!status) return null;
    return { status, type: type ?? "Leave" };
  }

  // ── Month stats ───────────────────────────────────────────────────────────

  const monthTotalMinutes = useMemo(() => {
    return recordsForMonth.reduce((sum, r) => sum + computeWorkMinutes(r), 0);
  }, [recordsForMonth]);

  const monthOverview = useMemo(() => {
    const dates = listMonthDatesISO(viewMonth).filter(isWeekdayISO);

    let presentDays = 0;
    let absentDays = 0;
    let incompleteDays = 0;

    for (const dateISO of dates) {
      const r = recordByDate.get(dateISO);

      const hasAny =
        !!r?.timeIn || !!r?.timeOut || !!r?.lunchIn || !!r?.lunchOut;

      if (!r || !hasAny) {
        if (isPastDayISO(dateISO)) absentDays += 1;
        continue;
      }

      const complete = !!r.timeIn && !!r.timeOut;
      if (complete) presentDays += 1;
      else incompleteDays += 1;
    }

    const workDaysCount = presentDays + incompleteDays;
    const avgMins =
      workDaysCount > 0 ? Math.round(monthTotalMinutes / workDaysCount) : 0;

    return {
      presentDays,
      absentDays,
      incompleteDays,
      avgHoursPerWorkDay: avgMins / 60,
    };
  }, [viewMonth, recordByDate, monthTotalMinutes]);

  const targetMinutes = MONTH_TARGET_HOURS * 60;
  const progressPct = Math.min(
    100,
    Math.round((monthTotalMinutes / targetMinutes) * 100)
  );

  // ── Month navigation ──────────────────────────────────────────────────────

  function prevMonth() {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  function goToDate() {
    const q = dateQuery.trim();
    if (!isValidISODateText(q)) {
      setDateError(`Use YYYY-MM-DD (e.g. ${toISODate(new Date())}).`);
      return;
    }
    setDateError("");
    setSelectedDateISO(q);
    setDetailOpen(true);
  }

  // ── Month log items ───────────────────────────────────────────────────────

  type MonthLogItem =
    | { kind: "present"; dateISO: string; record: AttendanceRecord; minutes: number }
    | { kind: "incomplete"; dateISO: string; record: AttendanceRecord; minutes: number }
    | { kind: "absent"; dateISO: string }
    | { kind: "upcoming"; dateISO: string }
    | { kind: "weekend"; dateISO: string };

  const monthLogItems = useMemo<MonthLogItem[]>(() => {
    const dates = listMonthDatesISO(viewMonth);
    const items: MonthLogItem[] = [];

    for (const dateISO of dates) {
      if (!isWeekdayISO(dateISO)) {
        items.push({ kind: "weekend", dateISO });
        continue;
      }

      const r = recordByDate.get(dateISO);
      const hasAny =
        !!r?.timeIn || !!r?.timeOut || !!r?.lunchIn || !!r?.lunchOut;
      const complete = !!r?.timeIn && !!r?.timeOut;

      if (!r || !hasAny) {
        if (isPastDayISO(dateISO)) items.push({ kind: "absent", dateISO });
        else items.push({ kind: "upcoming", dateISO });
        continue;
      }

      const mins = computeWorkMinutes(r);
      if (complete) items.push({ kind: "present", dateISO, record: r, minutes: mins });
      else items.push({ kind: "incomplete", dateISO, record: r, minutes: mins });
    }

    items.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    return items;
  }, [viewMonth, recordByDate]);

  const [logsLoading, setLogsLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLogsLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setLogsLoading(true);
    const t = setTimeout(() => setLogsLoading(false), 500);
    return () => clearTimeout(t);
  }, [viewMonth, selectedEmployeeId]);

  // ── Export / Print ────────────────────────────────────────────────────────

  function exportMonthCSV() {
    const monthLabel = viewMonth.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    const header = [
      "Employee ID",
      "Employee Name",
      "Month",
      "Date",
      "Status",
      "Source",
      "Time In (ISO)",
      "Lunch Out (ISO)",
      "Lunch In (ISO)",
      "Time Out (ISO)",
      "Work Hours",
    ];

    const rows = monthLogItems
      .slice()
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
      .filter((i) => i.kind !== "weekend")
      .map((i) => {
        if (i.kind === "absent") {
          return [selectedEmployeeId, selectedEmployee?.name ?? "", monthLabel, i.dateISO, "Absent", "", "", "", "", "", "0.0"];
        }
        if (i.kind === "upcoming") {
          return [selectedEmployeeId, selectedEmployee?.name ?? "", monthLabel, i.dateISO, "Upcoming", "", "", "", "", "", "0.0"];
        }
        const r = i.record;
        const status = i.kind === "present" ? "Present" : "Incomplete";
        return [
          selectedEmployeeId,
          selectedEmployee?.name ?? "",
          monthLabel,
          i.dateISO,
          status,
          r.source ?? "",
          r.timeIn ?? "",
          r.lunchOut ?? "",
          r.lunchIn ?? "",
          r.timeOut ?? "",
          formatHoursFromMinutes(computeWorkMinutes(r)),
        ];
      });

    const csv =
      [header, ...rows].map((r) => r.map(safeTextCSV).join(",")).join("\n") + "\n";

    downloadCSV(
      `attendance_${selectedEmployeeId}_${toISODate(startOfMonth(viewMonth))}.csv`,
      csv
    );
  }

  function printReport() {
    window.print();
  }

  // ── Edit modal state ──────────────────────────────────────────────────────

  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<{
    dateISO: string;
    source: string;
    timeIn: string;
    lunchOut: string;
    lunchIn: string;
    timeOut: string;
  }>({
    dateISO: selectedDateISO,
    source: "",
    timeIn: "",
    lunchOut: "",
    lunchIn: "",
    timeOut: "",
  });

  function openEditModal() {
    const r = selectedDayRecord;
    setEditDraft({
      dateISO: selectedDateISO,
      source: (r?.source ?? "") as string,
      timeIn: isoToLocalInput(r?.timeIn ?? null),
      lunchOut: isoToLocalInput(r?.lunchOut ?? null),
      lunchIn: isoToLocalInput(r?.lunchIn ?? null),
      timeOut: isoToLocalInput(r?.timeOut ?? null),
    });
    setEditOpen(true);
  }

  function handleEditDate(dateISO: string) {
    setSelectedDateISO(dateISO);
    const r = recordByDate.get(dateISO) ?? null;
    setEditDraft({
      dateISO,
      source: (r?.source ?? "") as string,
      timeIn: isoToLocalInput(r?.timeIn ?? null),
      lunchOut: isoToLocalInput(r?.lunchOut ?? null),
      lunchIn: isoToLocalInput(r?.lunchIn ?? null),
      timeOut: isoToLocalInput(r?.timeOut ?? null),
    });
    setEditOpen(true);
  }

  function saveEdit() {
    const dateISO = editDraft.dateISO;
    const next: AttendanceRecord = {
      id: `${selectedEmployeeId}_${dateISO}`,
      employeeId: selectedEmployeeId,
      dateISO,
      source: editDraft.source?.trim() ? editDraft.source.trim() : undefined,
      timeIn: localInputToISO(editDraft.timeIn),
      lunchOut: localInputToISO(editDraft.lunchOut),
      lunchIn: localInputToISO(editDraft.lunchIn),
      timeOut: localInputToISO(editDraft.timeOut),
    };

    setAllRecords((prev) => {
      const idx = prev.findIndex(
        (r) => r.employeeId === selectedEmployeeId && r.dateISO === dateISO
      );
      if (idx === -1) return [...prev, next];
      return prev.map((r, i) => (i === idx ? { ...r, ...next } : r));
    });

    setEditOpen(false);
  }

  function handleSelectDate(dateISO: string) {
    setSelectedDateISO(dateISO);
    setDetailOpen(true);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="p-6 space-y-6"
    >
      {/* Day detail modal */}
      <AnimatePresence>
        {detailOpen && (
          <DayDetailModal
            dateISO={selectedDateISO}
            record={selectedDayRecord}
            now={now}
            leaveInfo={getLeaveInfoForDate(selectedDateISO)}
            onClose={() => setDetailOpen(false)}
            onEdit={() => {
              setDetailOpen(false);
              handleEditDate(selectedDateISO);
            }}
          />
        )}
      </AnimatePresence>

      {/* Header card */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-text-heading">
            Attendance Records
          </div>
          <div className="text-sm text-text-primary/70">
            {formatFullDate(selectedDateISO)}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-text-primary/70">
              Employee
            </label>

            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-text-heading outline-none focus:ring-2 focus:ring-primary/30"
            >
              {employeeList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>

            <span className="text-xs text-text-primary/60">
              Viewing:{" "}
              <span className="font-semibold">{selectedEmployee?.name}</span>
            </span>

            <div className="flex flex-wrap items-center gap-2 sm:ml-2">
              <div className="relative">
                <input
                  value={dateQuery}
                  onChange={(e) => setDateQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") goToDate();
                  }}
                  placeholder="YYYY-MM-DD"
                  className={cx(
                    "w-44 rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2",
                    dateError
                      ? "border-rose-300 focus:ring-rose-200"
                      : "border-slate-200 focus:ring-primary/30"
                  )}
                />
                {dateError && (
                  <div className="absolute left-0 top-full mt-1 text-[11px] font-semibold text-rose-600">
                    {dateError}
                  </div>
                )}
              </div>

              <ActionButton variant="default" onClick={goToDate} type="button">
                Go
              </ActionButton>

              <ActionButton
                variant="primary"
                onClick={exportMonthCSV}
                type="button"
              >
                Export CSV (Month)
              </ActionButton>

              <ActionButton variant="default" onClick={printReport} type="button">
                Print
              </ActionButton>
            </div>
          </div>
        </div>

        <div className="bg-primary text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <Clock className="h-4 w-4 opacity-90" />
          <span className="tabular-nums">
            {now.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <AdminAttendanceCalendar
            viewMonth={viewMonth}
            selectedDateISO={selectedDateISO}
            onSelectDateISO={handleSelectDate}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            recordsForMonth={recordsForMonth}
            leaveDatesForMonth={leaveDatesForMonth}
          />
        </div>

        {/* Right side cards */}
        <div className="lg:col-span-1 space-y-6">
          {/* Attendance Overview */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22 }}
            className="rounded-2xl bg-card border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-text-heading">
                  Attendance Overview
                </div>
                <div className="text-xs text-text-primary/70">
                  {viewMonth.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>
              <div className="text-xs font-bold rounded-full bg-secondary/10 text-secondary px-3 py-1">
                Avg {monthOverview.avgHoursPerWorkDay.toFixed(1)} hrs/day
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[10px] font-bold text-slate-500">PRESENT</div>
                  <div className="text-xl font-extrabold text-emerald-700">
                    {monthOverview.presentDays}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[10px] font-bold text-slate-500">ABSENT</div>
                  <div className="text-xl font-extrabold text-rose-700">
                    {monthOverview.absentDays}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[10px] font-bold text-slate-500">INCOMPLETE</div>
                  <div className="text-xl font-extrabold text-amber-700">
                    {monthOverview.incompleteDays}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-secondary/20 bg-secondary/10 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-semibold text-text-heading">
                      Total Work Hours
                    </div>
                    <div className="text-xs text-text-primary/70">This Month</div>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-white/60 flex items-center justify-center">
                    <Timer className="h-4 w-4 text-text-primary/70" />
                  </div>
                </div>

                <div className="mt-3 text-3xl font-extrabold text-text-heading">
                  {formatHoursFromMinutes(monthTotalMinutes)} hrs
                </div>

                <div className="mt-3 h-2 rounded-full bg-white/70 overflow-hidden">
                  <div
                    className="h-full bg-secondary"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="mt-2 text-xs font-semibold text-text-primary/80">
                  {progressPct}% of monthly target ({MONTH_TARGET_HOURS} hrs)
                </div>
              </div>
            </div>
          </motion.div>

          {/* Daily logs */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden flex flex-col h-[500px]"
          >
            <div className="p-5 border-b border-slate-100 bg-primary">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <History className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-[#F2F2F2]">Daily Logs</h2>
                  <p className="text-xs text-slate-300">
                    Click a date on calendar or a row below
                  </p>

                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={prevMonth}
                      className="p-2 rounded-full bg-slate-100 hover:bg-gray-200 transition"
                      type="button"
                      aria-label="Previous month"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <h2 className="text-sm font-semibold text-slate-200 min-w-[180px] text-center">
                      {viewMonth.toLocaleString("default", {
                        month: "long",
                        year: "numeric",
                      })}
                    </h2>

                    <button
                      onClick={nextMonth}
                      className="p-2 rounded-full bg-slate-100 hover:bg-gray-200 transition"
                      type="button"
                      aria-label="Next month"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-end gap-2">
                  <ActionButton
                    variant="dark"
                    onClick={openEditModal}
                    className="px-3 py-1.5 text-xs"
                    type="button"
                    title="Edit or create this day record"
                  >
                    Edit
                  </ActionButton>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <AnimatePresence mode="wait">
                {logsLoading ? (
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LogSkeleton />
                  </motion.div>
                ) : monthLogItems.length > 0 ? (
                  <motion.div
                    key="logs"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-3"
                  >
                    {monthLogItems.map((item, idx) => {
                      const isSelected = item.dateISO === selectedDateISO;
                      const leaveInfo = getLeaveInfoForDate(item.dateISO);

                      const dateLabel = new Date(item.dateISO + "T00:00:00").toLocaleDateString(
                        "en-US",
                        { weekday: "short", month: "short", day: "numeric" }
                      );

                      const baseRow = "p-3 rounded-2xl border transition-all";
                      const selectedRing = isSelected ? "ring-2 ring-[#F28C28]/40" : "";

                      if (item.kind === "weekend") {
                        return (
                          <motion.div
                            key={item.dateISO}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            className={cx(baseRow, "bg-slate-50 border-slate-100 hover:border-slate-200", selectedRing)}
                          >
                            <div className="flex justify-between items-center gap-3">
                              <button
                                onClick={() => {
                                  setSelectedDateISO(item.dateISO);
                                  setDetailOpen(true);
                                }}
                                className="flex-1 text-left"
                                type="button"
                              >
                                <p className="font-bold text-slate-500 text-sm">{dateLabel}</p>
                                <p className="text-xs text-slate-400 mt-1">Weekend</p>
                              </button>

                              <div className="flex items-center gap-2">
                                <div className="bg-slate-200/70 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                                  —
                                </div>
                                <button
                                  onClick={() => handleEditDate(item.dateISO)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-text-heading hover:bg-white transition"
                                  type="button"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      if (item.kind === "absent") {
                        return (
                          <motion.div
                            key={item.dateISO}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            className={cx(
                              baseRow,
                              // If on leave, override absent styling with leave colour
                              leaveInfo?.status === "Approved"
                                ? "bg-blue-50 border-blue-200 hover:border-blue-300"
                                : leaveInfo?.status === "Pending"
                                ? "bg-yellow-50 border-yellow-200 hover:border-yellow-300"
                                : "bg-rose-50 border-rose-200 hover:border-rose-300",
                              selectedRing
                            )}
                          >
                            <div className="flex justify-between items-center gap-3">
                              <button
                                onClick={() => {
                                  setSelectedDateISO(item.dateISO);
                                  setDetailOpen(true);
                                }}
                                className="flex-1 text-left"
                                type="button"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={cx(
                                    "font-bold text-sm",
                                    leaveInfo?.status === "Approved"
                                      ? "text-blue-700"
                                      : leaveInfo?.status === "Pending"
                                      ? "text-yellow-700"
                                      : "text-rose-700"
                                  )}>
                                    {dateLabel}
                                  </p>
                                  {leaveInfo ? (
                                    <span className={cx(
                                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                                      leaveInfo.status === "Approved"
                                        ? "bg-blue-100 text-blue-700 border-blue-200"
                                        : "bg-yellow-100 text-yellow-700 border-yellow-200"
                                    )}>
                                      {leaveInfo.status === "Approved" ? "On Leave" : "Pending Leave"}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-rose-700 bg-white/60 border border-rose-200 px-1.5 py-0.5 rounded-full">
                                      Absent
                                    </span>
                                  )}
                                </div>
                                {leaveInfo && (
                                  <p className={cx(
                                    "text-xs mt-1 font-medium",
                                    leaveInfo.status === "Approved" ? "text-blue-600" : "text-yellow-600"
                                  )}>
                                    {leaveInfo.type}
                                  </p>
                                )}
                                {!leaveInfo && (
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs text-slate-400 font-semibold">——</span>
                                    <span className="text-slate-300 text-xs">→</span>
                                    <span className="text-xs text-slate-400 font-semibold">——</span>
                                  </div>
                                )}
                              </button>

                              <div className="flex items-center gap-2">
                                <div className={cx(
                                  "px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm",
                                  leaveInfo?.status === "Approved"
                                    ? "bg-blue-500"
                                    : leaveInfo?.status === "Pending"
                                    ? "bg-yellow-500"
                                    : "bg-rose-600"
                                )}>
                                  {leaveInfo ? (leaveInfo.status === "Approved" ? "Leave" : "Pending") : "0.0 hrs"}
                                </div>
                                <button
                                  onClick={() => handleEditDate(item.dateISO)}
                                  className={cx(
                                    "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                                    leaveInfo?.status === "Approved"
                                      ? "border-blue-200 bg-white/70 text-blue-700 hover:bg-white"
                                      : leaveInfo?.status === "Pending"
                                      ? "border-yellow-200 bg-white/70 text-yellow-700 hover:bg-white"
                                      : "border-rose-200 bg-white/70 text-rose-700 hover:bg-white"
                                  )}
                                  type="button"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      if (item.kind === "upcoming") {
                        return (
                          <motion.div
                            key={item.dateISO}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            className={cx(
                              baseRow,
                              leaveInfo?.status === "Approved"
                                ? "bg-blue-50 border-blue-200 hover:border-blue-300"
                                : leaveInfo?.status === "Pending"
                                ? "bg-yellow-50 border-yellow-200 hover:border-yellow-300"
                                : "bg-slate-50 border-slate-100 hover:border-slate-200",
                              selectedRing
                            )}
                          >
                            <div className="flex justify-between items-center gap-3">
                              <button
                                onClick={() => {
                                  setSelectedDateISO(item.dateISO);
                                  setDetailOpen(true);
                                }}
                                className="flex-1 text-left"
                                type="button"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={cx(
                                    "font-bold text-sm",
                                    leaveInfo?.status === "Approved"
                                      ? "text-blue-700"
                                      : leaveInfo?.status === "Pending"
                                      ? "text-yellow-700"
                                      : "text-slate-600"
                                  )}>
                                    {dateLabel}
                                  </p>
                                  {leaveInfo ? (
                                    <span className={cx(
                                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                                      leaveInfo.status === "Approved"
                                        ? "bg-blue-100 text-blue-700 border-blue-200"
                                        : "bg-yellow-100 text-yellow-700 border-yellow-200"
                                    )}>
                                      {leaveInfo.status === "Approved" ? "On Leave" : "Pending Leave"}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-slate-600 bg-white/60 border border-slate-200 px-1.5 py-0.5 rounded-full">
                                      Upcoming
                                    </span>
                                  )}
                                </div>
                                {leaveInfo && (
                                  <p className={cx(
                                    "text-xs mt-1 font-medium",
                                    leaveInfo.status === "Approved" ? "text-blue-600" : "text-yellow-600"
                                  )}>
                                    {leaveInfo.type}
                                  </p>
                                )}
                              </button>

                              <div className="flex items-center gap-2">
                                <div className={cx(
                                  "px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm",
                                  leaveInfo?.status === "Approved"
                                    ? "bg-blue-500"
                                    : leaveInfo?.status === "Pending"
                                    ? "bg-yellow-500"
                                    : "bg-slate-700"
                                )}>
                                  {leaveInfo ? (leaveInfo.status === "Approved" ? "Leave" : "Pending") : "0.0 hrs"}
                                </div>
                                <button
                                  onClick={() => handleEditDate(item.dateISO)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-text-heading hover:bg-soft transition"
                                  type="button"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      // present / incomplete
                      const r = item.record;
                      const minutes = item.minutes;
                      const badge = item.kind === "present" ? "Present" : "Incomplete";
                      const badgeClass =
                        item.kind === "present"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : "text-amber-700 bg-amber-50 border-amber-200";

                      return (
                        <motion.div
                          key={item.dateISO}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className={cx(
                            baseRow,
                            "bg-slate-50 border-slate-100 hover:border-[#F28C28]/30 hover:shadow-sm",
                            selectedRing
                          )}
                        >
                          <div className="flex justify-between items-center gap-3">
                            <button
                              onClick={() => {
                                setSelectedDateISO(item.dateISO);
                                setDetailOpen(true);
                              }}
                              className="flex-1 text-left"
                              type="button"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-[#1F3C68] text-sm">{dateLabel}</p>
                                <span className={cx("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", badgeClass)}>
                                  {badge}
                                </span>
                                {/* Show leave badge alongside attendance if on leave */}
                                {leaveInfo && (
                                  <span className={cx(
                                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                                    leaveInfo.status === "Approved"
                                      ? "bg-blue-100 text-blue-700 border-blue-200"
                                      : "bg-yellow-100 text-yellow-700 border-yellow-200"
                                  )}>
                                    {leaveInfo.status === "Approved" ? "On Leave" : "Pending Leave"}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-green-600 font-semibold">{formatTime(r.timeIn)}</span>
                                <span className="text-slate-300 text-xs">→</span>
                                <span className="text-xs text-red-600 font-semibold">{formatTime(r.timeOut)}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1">• {r.source ?? "—"}</div>
                            </button>

                            <div className="flex items-center gap-2">
                              <div className="bg-primary px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm">
                                {formatHoursFromMinutes(minutes)} hrs
                              </div>
                              <button
                                onClick={() => handleEditDate(item.dateISO)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-text-heading hover:bg-soft transition"
                                type="button"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-12"
                  >
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <History className="w-12 h-12 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">No records for this month</p>
                    <p className="text-xs text-center max-w-[220px]">
                      Select a date and click Edit to create or correct logs.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Small-screen Edit button */}
            <div className="sm:hidden p-4 pt-0">
              <ActionButton
                variant="dark"
                onClick={openEditModal}
                className="w-full"
                type="button"
              >
                Edit / Create Selected Day
              </ActionButton>
            </div>
          </motion.div>
        </div>
      </div>

      {/* EDIT MODAL */}
      <Modal
        open={editOpen}
        title={`Admin Edit • ${selectedEmployee?.name ?? selectedEmployeeId} • ${editDraft.dateISO}`}
        onClose={() => setEditOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            Tip: Use datetime inputs to correct logs. Leave blank to set as "—".
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Time In</label>
              <input
                type="datetime-local"
                value={editDraft.timeIn}
                onChange={(e) => setEditDraft((p) => ({ ...p, timeIn: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Time Out</label>
              <input
                type="datetime-local"
                value={editDraft.timeOut}
                onChange={(e) => setEditDraft((p) => ({ ...p, timeOut: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Lunch Out</label>
              <input
                type="datetime-local"
                value={editDraft.lunchOut}
                onChange={(e) => setEditDraft((p) => ({ ...p, lunchOut: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Lunch In</label>
              <input
                type="datetime-local"
                value={editDraft.lunchIn}
                onChange={(e) => setEditDraft((p) => ({ ...p, lunchIn: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">
              Source / Remark
            </label>
            <input
              value={editDraft.source}
              onChange={(e) => setEditDraft((p) => ({ ...p, source: e.target.value }))}
              placeholder="e.g. Admin correction"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ActionButton onClick={() => setEditOpen(false)} type="button">
              Cancel
            </ActionButton>
            <ActionButton variant="primary" onClick={saveEdit} type="button">
              Save Changes
            </ActionButton>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}