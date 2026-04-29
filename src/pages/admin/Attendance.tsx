import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Download,
  History,
  LogIn,
  LogOut,
  Pencil,
  Printer,
  RefreshCw,
  Search,
  Timer,
  TrendingUp,
  Utensils,
  X,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import accounts from "../data/accounts.json";
import AdminAttendanceCalendar, {
  type AttendanceRecord,
} from "./components/AdminAttendanceCalendar";
import adminAccounts from "./data/adminAccounts.json";

// ─── Types ────────────────────────────────────────────────────────────────────

type Account = { id: number; email: string; password: string; name: string };

type CreatedAccount = {
  id: number;
  kind: "user" | "admin";
  name: string;
  email: string;
  password: string;
  roleLabel: string;
  department: string;
  createdAt: string;
};

type EmployeeEntry = {
  id: string;
  name: string;
  kind: "user" | "admin";
  roleLabel: string;
  department: string;
};

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

// ─── Constants ────────────────────────────────────────────────────────────────

const ATTENDANCE_KEY      = "worktime_attendance_v1";
const ALL_LEAVES_KEY      = "all_leaves_v1";
const CREATED_ACCOUNTS_KEY = "worktime_created_accounts_v1";
const DELETED_IDS_KEY     = "worktime_deleted_account_ids_v1";
const EDITS_KEY           = "worktime_account_edits_v1";
const MONTH_TARGET_HOURS  = 160;
const STANDARD_SHIFT_START = "08:00";
const LATE_THRESHOLD_MINUTES = 0;

// ─── Leave type config ────────────────────────────────────────────────────────

const LEAVE_TYPE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  "Vacation Leave":           { label: "Vacation Leave",           bg: "bg-sky-50",    text: "text-sky-700",    border: "border-sky-200",    dot: "bg-sky-500"    },
  "Sick Leave":               { label: "Sick Leave",               bg: "bg-rose-50",   text: "text-rose-700",   border: "border-rose-200",   dot: "bg-rose-500"   },
  "Emergency Leave":          { label: "Emergency Leave",          bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500" },
  "Maternity/Paternity Leave":{ label: "Maternity/Paternity Leave",bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
};

function getLeaveTypeConfig(type: string) {
  return LEAVE_TYPE_CONFIG[type] ?? {
    label: type, bg: "bg-slate-50", text: "text-slate-700",
    border: "border-slate-200", dot: "bg-slate-400",
  };
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

function readAttendance(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(ATTENDANCE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AttendanceRecord[]) : [];
  } catch { return []; }
}

function readLeaves(): StoredLeaveRequest[] {
  try {
    const raw = localStorage.getItem(ALL_LEAVES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as StoredLeaveRequest[]) : [];
  } catch { return []; }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function isoToLocalMidnight(dateISO: string) { return new Date(dateISO + "T00:00:00"); }
function isWeekdayISO(dateISO: string) {
  const day = isoToLocalMidnight(dateISO).getDay();
  return day !== 0 && day !== 6;
}
function isPastDayISO(dateISO: string) {
  const d = isoToLocalMidnight(dateISO).getTime();
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return d < t0;
}
function isTodayISO(dateISO: string) { return dateISO === toISODate(new Date()); }
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
    out.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return out;
}

// ─── Time / computation helpers ───────────────────────────────────────────────

function formatFullDate(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "2-digit", year: "numeric",
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
function formatHoursFromMinutes(mins: number) { return (mins / 60).toFixed(1); }
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
function isoToLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToISO(val: string) {
  if (!val) return null;
  const d = new Date(val);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}
function safeTextCSV(v: unknown) {
  const s = String(v ?? "");
  return `"${s.replaceAll('"', '""')}"`;
}
function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Leave helpers ────────────────────────────────────────────────────────────

function resolveLeaveRange(leave: StoredLeaveRequest) {
  return {
    dateFrom: leave.dateFrom ?? leave.startDate ?? leave.date ?? "",
    dateTo:   leave.dateTo   ?? leave.endDate   ?? leave.date ?? "",
  };
}
function enumerateDateRange(dateFrom: string, dateTo: string): string[] {
  if (!dateFrom || !dateTo) return [];
  const dates: string[] = [];
  const cursor = new Date(dateFrom + "T00:00:00");
  const end    = new Date(dateTo   + "T00:00:00");
  if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(end.getTime())) return [];
  while (cursor <= end) {
    dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

// ─── cx helper ────────────────────────────────────────────────────────────────

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionButton({
  variant = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "dark";
}) {
  const base = "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 gap-1.5";
  const styles =
    variant === "primary" ? "bg-primary text-white hover:opacity-90 focus:ring-primary/30 shadow-sm" :
    variant === "danger"  ? "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-200" :
    variant === "dark"    ? "bg-slate-800 text-white hover:bg-slate-900 focus:ring-slate-200" :
    "border border-slate-200 bg-white text-text-heading hover:bg-slate-50 focus:ring-primary/20";
  return <button className={cx(base, styles, className)} {...props} />;
}

function StatBadge({ label, value, tone }: { label: string; value: number | string; tone: "green" | "rose" | "amber" | "blue" | "slate" }) {
  const colors = {
    green: "bg-emerald-50 border-emerald-200 text-emerald-700",
    rose:  "bg-rose-50 border-rose-200 text-rose-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    blue:  "bg-blue-50 border-blue-200 text-blue-700",
    slate: "bg-slate-50 border-slate-200 text-slate-600",
  };
  return (
    <div className={cx("rounded-xl border px-3 py-2 text-center min-w-[70px]", colors[tone])}>
      <div className="text-xl font-extrabold tabular-nums leading-none">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide mt-1 opacity-80">{label}</div>
    </div>
  );
}

function Modal({
  open, title, children, onClose,
}: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="text-sm font-bold text-text-heading">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition" type="button" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </motion.div>
    </div>
  );
}

function LogSkeleton() {
  return (
    <div className="space-y-2.5">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 animate-pulse">
          <div className="flex justify-between items-center gap-3">
            <div className="space-y-2 flex-1">
              <div className="h-3 rounded-full bg-slate-200" style={{ width: `${60 + (i % 4) * 15}px` }} />
              <div className="flex gap-2">
                <div className="h-2.5 w-14 rounded-full bg-slate-200" />
                <div className="h-2.5 w-14 rounded-full bg-slate-200" />
              </div>
            </div>
            <div className="h-6 w-16 rounded-full bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── DayDetailModal ───────────────────────────────────────────────────────────

function DayDetailModal({
  dateISO, record, now, leaveInfo, onClose, onEdit,
}: {
  dateISO: string;
  record: AttendanceRecord | null;
  now: Date;
  leaveInfo: { status: "Pending" | "Approved"; type: string } | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const date      = new Date(dateISO + "T12:00:00");
  const isToday   = isTodayISO(dateISO);
  const lateMin   = getLateMinutes(record?.timeIn ?? null, isToday ? now : undefined);
  const workMins  = record ? computeWorkMinutes(record) : 0;
  const totalH    = workMins / 60;
  const regularH  = Math.min(totalH, 9);
  const overtimeH = Math.max(totalH - 9, 0);
  const hasAny    = !!record?.timeIn || !!record?.timeOut || !!record?.lunchIn || !!record?.lunchOut;
  const isAbsent  = isWeekdayISO(dateISO) && isPastDayISO(dateISO) && !record && !leaveInfo;
  const leaveCfg  = leaveInfo ? getLeaveTypeConfig(leaveInfo.type) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-[#1F3C68] to-[#2d5499] p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 0%, transparent 50%)" }} />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                  {date.toLocaleDateString("en-US", { weekday: "long" })}
                </p>
                <h2 className="text-2xl font-bold mt-1">
                  {date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </h2>
              </div>
              <div className="flex gap-2">
                <button onClick={onEdit} className="p-2 bg-white/15 hover:bg-white/25 rounded-xl transition" type="button" aria-label="Edit">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={onClose} className="p-2 bg-white/15 hover:bg-white/25 rounded-xl transition" type="button">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              {isAbsent && (
                <span className="px-2.5 py-1 bg-rose-500/30 text-rose-100 rounded-full text-xs font-bold border border-rose-400/30">
                  Absent
                </span>
              )}
              {!record && !isAbsent && !leaveInfo && (
                <span className="px-2.5 py-1 bg-white/15 rounded-full text-xs font-bold">No Record</span>
              )}
              {hasAny && (
                <span className={cx(
                  "px-2.5 py-1 rounded-full text-xs font-bold border",
                  lateMin > 0 ? "bg-red-500/25 text-red-200 border-red-400/30" : "bg-emerald-500/25 text-emerald-200 border-emerald-400/30"
                )}>
                  {lateMin > 0 ? `Late ${formatMinutes(lateMin)}` : "On Time"}
                </span>
              )}
              {overtimeH > 0 && (
                <span className="px-2.5 py-1 bg-orange-500/25 text-orange-200 rounded-full text-xs font-bold border border-orange-400/30">
                  +{overtimeH.toFixed(1)}h OT
                </span>
              )}
              {leaveInfo && (
                <span className={cx(
                  "px-2.5 py-1 rounded-full text-xs font-bold border",
                  leaveInfo.status === "Approved"
                    ? "bg-blue-500/25 text-blue-100 border-blue-400/30"
                    : "bg-yellow-500/25 text-yellow-100 border-yellow-400/30"
                )}>
                  {leaveInfo.status === "Approved" ? "✓ Approved Leave" : "⏳ Pending Leave"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {leaveInfo && leaveCfg && (
            <div className={cx(
              "rounded-2xl border p-4",
              leaveInfo.status === "Approved" ? "bg-blue-50 border-blue-200" : "bg-yellow-50 border-yellow-200"
            )}>
              <div className="flex items-center gap-3">
                <div className={cx("h-9 w-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0",
                  leaveInfo.status === "Approved" ? "bg-blue-500" : "bg-yellow-500")}>
                  {leaveInfo.status === "Approved" ? "✓" : "⏳"}
                </div>
                <div>
                  <div className={cx("text-xs font-bold uppercase tracking-wide",
                    leaveInfo.status === "Approved" ? "text-blue-600" : "text-yellow-600")}>
                    {leaveInfo.status === "Approved" ? "Approved Leave" : "Pending Leave Request"}
                  </div>
                  <span className={cx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border mt-1",
                    leaveCfg.bg, leaveCfg.text, leaveCfg.border)}>
                    <span className={cx("w-1.5 h-1.5 rounded-full", leaveCfg.dot)} />
                    {leaveCfg.label}
                  </span>
                </div>
              </div>
            </div>
          )}

          {record ? (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Time In",     time: record.timeIn,   Icon: LogIn,    bg: "bg-emerald-50 border-emerald-200", hd: "text-emerald-700", val: "text-emerald-800", iconBg: "bg-emerald-500" },
                  { label: "Time Out",    time: record.timeOut,  Icon: LogOut,   bg: "bg-rose-50 border-rose-200",      hd: "text-rose-700",    val: "text-rose-800",    iconBg: "bg-rose-500" },
                  { label: "Start Break", time: record.lunchOut, Icon: Coffee,   bg: "bg-amber-50 border-amber-200",   hd: "text-amber-700",   val: "text-amber-800",   iconBg: "bg-amber-500" },
                  { label: "End Break",   time: record.lunchIn,  Icon: Utensils, bg: "bg-blue-50 border-blue-200",     hd: "text-blue-700",    val: "text-blue-800",    iconBg: "bg-blue-500" },
                ].map(({ label, time, Icon, bg, hd, val, iconBg }) => (
                  <div key={label} className={cx("rounded-2xl border p-3", bg)}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={cx("p-1.5 rounded-lg", iconBg)}>
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                      <p className={cx("text-[10px] font-bold uppercase tracking-wide", hd)}>{label}</p>
                    </div>
                    <p className={cx("text-lg font-bold tabular-nums", val)}>{formatTime(time)}</p>
                    {label === "Time In" && lateMin > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        <p className="text-[10px] text-red-500 font-semibold">{formatMinutes(lateMin)} late</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Hours Summary</p>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm text-slate-600">Regular</span>
                  <span className="font-bold text-[#1F3C68]">{regularH.toFixed(1)} hrs</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-slate-600">Overtime</span>
                  <span className={cx("font-bold", overtimeH > 0 ? "text-orange-500" : "text-slate-400")}>
                    {overtimeH.toFixed(1)} hrs
                  </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full flex">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${Math.min((regularH / 9) * 100, 100)}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className="h-full bg-primary rounded-l-full"
                    />
                    {overtimeH > 0 && (
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${Math.min((overtimeH / 9) * 30, 30)}%` }}
                        transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
                        className="h-full bg-orange-400 rounded-r-full"
                      />
                    )}
                  </div>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-slate-400">0h</span>
                  <span className="text-[10px] font-bold text-primary">Total: {totalH.toFixed(1)} hrs</span>
                  <span className="text-[10px] text-slate-400">9h</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Source</span>
                <span className="font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full text-xs">
                  {record.source ?? "—"}
                </span>
              </div>
            </>
          ) : (
            !leaveInfo && (
              <div className="text-center py-10 text-slate-400">
                <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-25" />
                <p className="text-sm font-semibold">
                  {isAbsent ? "Absent — no attendance recorded" : "No attendance recorded"}
                </p>
                {!isAbsent && (
                  <p className="text-xs mt-1 text-slate-400">
                    Future dates won't be marked absent until they pass.
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Attendance() {
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Build employee list (static JSON + created accounts) ──────────────────
  const employeeList = useMemo<EmployeeEntry[]>(() => {
    const deletedIds = new Set<string>(safeRead<string[]>(DELETED_IDS_KEY, []));
    const editsMap   = safeRead<Record<string, { name?: string }>>(EDITS_KEY, {});

    const resolveName = (kind: "user" | "admin", id: number, baseName: string): string => {
      const key = `${kind}:${id}`;
      return editsMap[key]?.name ?? baseName;
    };

    const adminEntries: EmployeeEntry[] = (adminAccounts as Account[])
      .filter((a) => !deletedIds.has(`admin:${a.id}`))
      .map((a) => ({
        id:         String(a.id),
        name:       `${resolveName("admin", a.id, a.name)} (Admin)`,
        kind:       "admin" as const,
        roleLabel:  "Admin",
        department: "—",
      }));

    const userEntries: EmployeeEntry[] = (accounts as Account[])
      .filter((u) => !deletedIds.has(`user:${u.id}`))
      .map((u) => ({
        id:         String(u.id),
        name:       `${resolveName("user", u.id, u.name)} (User)`,
        kind:       "user" as const,
        roleLabel:  "Employee",
        department: "—",
      }));

    // Created accounts from Users.tsx
    const created = safeRead<CreatedAccount[]>(CREATED_ACCOUNTS_KEY, []);
    const createdEntries: EmployeeEntry[] = created
      .filter((a) => !deletedIds.has(`${a.kind}:${a.id}`))
      .map((a) => {
        const edits = editsMap[`${a.kind}:${a.id}`] ?? {};
        const name  = (edits as any).name ?? a.name;
        const suffix = a.kind === "admin" ? "(Admin)" : "(User)";
        return {
          id:         String(a.id),
          name:       `${name} ${suffix}`,
          kind:       a.kind,
          roleLabel:  a.roleLabel,
          department: a.department,
        };
      });

    return [...adminEntries, ...userEntries, ...createdEntries];
  }, []); // recalculated on mount; search input forces re-render

  // Re-read created accounts when localStorage changes (cross-tab or Users page edits)
  const [createdAccountsVersion, setCreatedAccountsVersion] = useState(0);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === CREATED_ACCOUNTS_KEY ||
        e.key === DELETED_IDS_KEY ||
        e.key === EDITS_KEY
      ) setCreatedAccountsVersion((v) => v + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Recompute list when version bumps (same-tab refreshes won't trigger storage event,
  // so we offer a manual refresh button too)
  const [listKey, setListKey] = useState(0);
  const refreshList = () => setListKey((v) => v + 1);

  const resolvedEmployeeList = useMemo<EmployeeEntry[]>(() => {
    const deletedIds = new Set<string>(safeRead<string[]>(DELETED_IDS_KEY, []));
    const editsMap   = safeRead<Record<string, { name?: string }>>(EDITS_KEY, {});

    const resolveName = (kind: "user" | "admin", id: number, baseName: string): string =>
      (editsMap[`${kind}:${id}`] as any)?.name ?? baseName;

    const adminEntries: EmployeeEntry[] = (adminAccounts as Account[])
      .filter((a) => !deletedIds.has(`admin:${a.id}`))
      .map((a) => ({
        id: String(a.id), name: `${resolveName("admin", a.id, a.name)} (Admin)`,
        kind: "admin" as const, roleLabel: "Admin", department: "—",
      }));

    const userEntries: EmployeeEntry[] = (accounts as Account[])
      .filter((u) => !deletedIds.has(`user:${u.id}`))
      .map((u) => ({
        id: String(u.id), name: `${resolveName("user", u.id, u.name)} (User)`,
        kind: "user" as const, roleLabel: "Employee", department: "—",
      }));

    const created = safeRead<CreatedAccount[]>(CREATED_ACCOUNTS_KEY, []);
    const createdEntries: EmployeeEntry[] = created
      .filter((a) => !deletedIds.has(`${a.kind}:${a.id}`))
      .map((a) => {
        const edits = (editsMap[`${a.kind}:${a.id}`] ?? {}) as any;
        return {
          id: String(a.id),
          name: `${edits.name ?? a.name} ${a.kind === "admin" ? "(Admin)" : "(User)"}`,
          kind: a.kind, roleLabel: a.roleLabel, department: a.department,
        };
      });

    return [...adminEntries, ...userEntries, ...createdEntries];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, createdAccountsVersion]);

  // ── Attendance state ──────────────────────────────────────────────────────
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>(() => readAttendance());
  useEffect(() => {
    try { localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(allRecords)); } catch {}
  }, [allRecords]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ATTENDANCE_KEY) setAllRecords(readAttendance());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Leave state ───────────────────────────────────────────────────────────
  const [allLeaves, setAllLeaves] = useState<StoredLeaveRequest[]>(() => readLeaves());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ALL_LEAVES_KEY) setAllLeaves(readLeaves());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    resolvedEmployeeList[0]?.id ?? ""
  );
  const [viewMonth,     setViewMonth]     = useState<Date>(new Date());
  const [selectedDateISO, setSelectedDateISO] = useState<string>(toISODate(new Date()));
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [showSearch,    setShowSearch]    = useState(false);
  const [dateQuery,     setDateQuery]     = useState<string>(selectedDateISO);
  const [dateError,     setDateError]     = useState<string>("");

  useEffect(() => setDateQuery(selectedDateISO), [selectedDateISO]);
  useEffect(() => {
    const d = new Date(selectedDateISO + "T00:00:00");
    if (!isSameMonth(d, viewMonth)) setViewMonth(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateISO]);

  // Keep selection valid when list refreshes
  useEffect(() => {
    if (!resolvedEmployeeList.length) return;
    const exists = resolvedEmployeeList.some((e) => e.id === selectedEmployeeId);
    if (!exists) setSelectedEmployeeId(resolvedEmployeeList[0].id);
  }, [resolvedEmployeeList, selectedEmployeeId]);

  const filteredEmployeeList = useMemo(() => {
    if (!searchQuery.trim()) return resolvedEmployeeList;
    const q = searchQuery.trim().toLowerCase();
    return resolvedEmployeeList.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.roleLabel.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
    );
  }, [resolvedEmployeeList, searchQuery]);

  const selectedEmployee = resolvedEmployeeList.find((e) => e.id === selectedEmployeeId);

  // ── Records for selected employee ─────────────────────────────────────────
  const recordsForEmployee = useMemo(() =>
    allRecords.filter((r) => r.employeeId === selectedEmployeeId),
    [allRecords, selectedEmployeeId]
  );
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
  const selectedDayRecord = useMemo(() =>
    recordByDate.get(selectedDateISO) ?? null,
    [recordByDate, selectedDateISO]
  );

  // ── Leave maps ────────────────────────────────────────────────────────────
  const leaveDatesForMonth = useMemo(() => {
    const map  = new Map<string, "Pending" | "Approved">();
    const baseName = selectedEmployee?.name.replace(/ \((Admin|User)\)$/, "") ?? "";
    if (!baseName) return map;
    const monthStart = startOfMonth(viewMonth).getTime();
    const monthEnd   = endOfMonth(viewMonth).getTime();
    for (const leave of allLeaves) {
      if (leave.employee !== baseName) continue;
      if (leave.status !== "Pending" && leave.status !== "Approved") continue;
      const { dateFrom, dateTo } = resolveLeaveRange(leave);
      if (!dateFrom || !dateTo) continue;
      for (const dateISO of enumerateDateRange(dateFrom, dateTo)) {
        const t = new Date(dateISO + "T00:00:00").getTime();
        if (t < monthStart || t > monthEnd) continue;
        if (map.get(dateISO) !== "Approved")
          map.set(dateISO, leave.status as "Pending" | "Approved");
      }
    }
    return map;
  }, [allLeaves, selectedEmployee, viewMonth]);

  const leaveTypeForDate = useMemo(() => {
    const map      = new Map<string, string>();
    const baseName = selectedEmployee?.name.replace(/ \((Admin|User)\)$/, "") ?? "";
    if (!baseName) return map;
    for (const leave of allLeaves) {
      if (leave.employee !== baseName) continue;
      if (leave.status !== "Pending" && leave.status !== "Approved") continue;
      if (!leave.type) continue;
      const { dateFrom, dateTo } = resolveLeaveRange(leave);
      if (!dateFrom || !dateTo) continue;
      for (const dateISO of enumerateDateRange(dateFrom, dateTo)) {
        const existingStatus = leaveDatesForMonth.get(dateISO);
        if (!map.has(dateISO) || existingStatus === "Approved")
          map.set(dateISO, leave.type);
      }
    }
    return map;
  }, [allLeaves, selectedEmployee, leaveDatesForMonth]);

  function getLeaveInfoForDate(dateISO: string): { status: "Pending" | "Approved"; type: string } | null {
    const status = leaveDatesForMonth.get(dateISO);
    const type   = leaveTypeForDate.get(dateISO);
    if (!status) return null;
    return { status, type: type ?? "Leave" };
  }

  // ── Month stats ───────────────────────────────────────────────────────────
  const monthTotalMinutes = useMemo(() =>
    recordsForMonth.reduce((sum, r) => sum + computeWorkMinutes(r), 0),
    [recordsForMonth]
  );
  const monthOverview = useMemo(() => {
    const dates = listMonthDatesISO(viewMonth).filter(isWeekdayISO);
    let presentDays = 0, absentDays = 0, incompleteDays = 0;
    for (const dateISO of dates) {
      const r = recordByDate.get(dateISO);
      const hasAny = !!r?.timeIn || !!r?.timeOut || !!r?.lunchIn || !!r?.lunchOut;
      if (!r || !hasAny) {
        if (isPastDayISO(dateISO)) absentDays++;
        continue;
      }
      if (r.timeIn && r.timeOut) presentDays++;
      else incompleteDays++;
    }
    const workDays = presentDays + incompleteDays;
    return {
      presentDays, absentDays, incompleteDays,
      avgHoursPerWorkDay: workDays > 0 ? (monthTotalMinutes / workDays) / 60 : 0,
    };
  }, [viewMonth, recordByDate, monthTotalMinutes]);

  const progressPct = Math.min(100, Math.round((monthTotalMinutes / (MONTH_TARGET_HOURS * 60)) * 100));

  // ── Navigation ────────────────────────────────────────────────────────────
  function prevMonth() { setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }

  function goToDate() {
    const q = dateQuery.trim();
    if (!isValidISODateText(q)) {
      setDateError(`Use YYYY-MM-DD format`);
      return;
    }
    setDateError("");
    setSelectedDateISO(q);
    setDetailOpen(true);
  }

  // ── Month log items ───────────────────────────────────────────────────────
  type MonthLogItem =
    | { kind: "present";    dateISO: string; record: AttendanceRecord; minutes: number }
    | { kind: "incomplete"; dateISO: string; record: AttendanceRecord; minutes: number }
    | { kind: "absent";     dateISO: string }
    | { kind: "upcoming";   dateISO: string }
    | { kind: "weekend";    dateISO: string };

  const monthLogItems = useMemo<MonthLogItem[]>(() => {
    const dates = listMonthDatesISO(viewMonth);
    const items: MonthLogItem[] = [];
    for (const dateISO of dates) {
      if (!isWeekdayISO(dateISO)) { items.push({ kind: "weekend", dateISO }); continue; }
      const r      = recordByDate.get(dateISO);
      const hasAny = !!r?.timeIn || !!r?.timeOut || !!r?.lunchIn || !!r?.lunchOut;
      if (!r || !hasAny) {
        items.push({ kind: isPastDayISO(dateISO) ? "absent" : "upcoming", dateISO });
        continue;
      }
      const mins = computeWorkMinutes(r);
      items.push(r.timeIn && r.timeOut
        ? { kind: "present",    dateISO, record: r, minutes: mins }
        : { kind: "incomplete", dateISO, record: r, minutes: mins });
    }
    items.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    return items;
  }, [viewMonth, recordByDate]);

  const [logsLoading, setLogsLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLogsLoading(false), 700); return () => clearTimeout(t); }, []);
  useEffect(() => {
    setLogsLoading(true);
    const t = setTimeout(() => setLogsLoading(false), 400);
    return () => clearTimeout(t);
  }, [viewMonth, selectedEmployeeId]);

  // ── CSV Export ────────────────────────────────────────────────────────────
  function exportMonthCSV() {
    const mLabel = viewMonth.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const header = ["Employee ID", "Employee Name", "Month", "Date", "Status",
      "Source", "Time In", "Lunch Out", "Lunch In", "Time Out", "Work Hours"];
    const rows = monthLogItems
      .slice().sort((a, b) => a.dateISO.localeCompare(b.dateISO))
      .filter((i) => i.kind !== "weekend")
      .map((i) => {
        if (i.kind === "absent")   return [selectedEmployeeId, selectedEmployee?.name ?? "", mLabel, i.dateISO, "Absent",   "", "", "", "", "", "0.0"];
        if (i.kind === "upcoming") return [selectedEmployeeId, selectedEmployee?.name ?? "", mLabel, i.dateISO, "Upcoming", "", "", "", "", "", "0.0"];
        const r = i.record;
        return [selectedEmployeeId, selectedEmployee?.name ?? "", mLabel, i.dateISO,
          i.kind === "present" ? "Present" : "Incomplete",
          r.source ?? "", r.timeIn ?? "", r.lunchOut ?? "", r.lunchIn ?? "", r.timeOut ?? "",
          formatHoursFromMinutes(computeWorkMinutes(r))];
      });
    const csv = [header, ...rows].map((r) => r.map(safeTextCSV).join(",")).join("\n") + "\n";
    downloadCSV(`attendance_${selectedEmployeeId}_${toISODate(startOfMonth(viewMonth))}.csv`, csv);
  }

  // ── Edit modal ────────────────────────────────────────────────────────────
  const [editOpen,  setEditOpen]  = useState(false);
  const [editDraft, setEditDraft] = useState({
    dateISO: selectedDateISO, source: "",
    timeIn: "", lunchOut: "", lunchIn: "", timeOut: "",
  });

  function openEditForDate(dateISO: string) {
    const r = recordByDate.get(dateISO) ?? null;
    setEditDraft({
      dateISO, source: r?.source ?? "",
      timeIn:   isoToLocalInput(r?.timeIn   ?? null),
      lunchOut: isoToLocalInput(r?.lunchOut ?? null),
      lunchIn:  isoToLocalInput(r?.lunchIn  ?? null),
      timeOut:  isoToLocalInput(r?.timeOut  ?? null),
    });
    setEditOpen(true);
  }

  function saveEdit() {
    const dateISO = editDraft.dateISO;
    const next: AttendanceRecord = {
      id:         `${selectedEmployeeId}_${dateISO}`,
      employeeId: selectedEmployeeId,
      dateISO,
      source:   editDraft.source?.trim() || undefined,
      timeIn:   localInputToISO(editDraft.timeIn),
      lunchOut: localInputToISO(editDraft.lunchOut),
      lunchIn:  localInputToISO(editDraft.lunchIn),
      timeOut:  localInputToISO(editDraft.timeOut),
    };
    setAllRecords((prev) => {
      const idx = prev.findIndex(
        (r) => r.employeeId === selectedEmployeeId && r.dateISO === dateISO
      );
      return idx === -1 ? [...prev, next] : prev.map((r, i) => i === idx ? { ...r, ...next } : r);
    });
    setEditOpen(false);
  }

  function handleSelectDate(dateISO: string) {
    setSelectedDateISO(dateISO);
    setDetailOpen(true);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className="p-4 lg:p-6 space-y-5"
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
            onEdit={() => { setDetailOpen(false); openEditForDate(selectedDateISO); }}
          />
        )}
      </AnimatePresence>

      {/* ── Top header bar ── */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#1F3C68] to-[#2a4f8a] px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-white">Attendance Records</h1>
              <p className="text-white/60 text-sm mt-0.5">{formatFullDate(selectedDateISO)}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-white/15 text-white rounded-xl px-4 py-2.5 font-bold flex items-center gap-2 tabular-nums">
                <Clock className="h-4 w-4 opacity-80" />
                {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <ActionButton variant="default" onClick={exportMonthCSV} type="button" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Download className="w-4 h-4" /> Export CSV
              </ActionButton>
              <ActionButton variant="default" onClick={() => window.print()} type="button" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Printer className="w-4 h-4" /> Print
              </ActionButton>
            </div>
          </div>
        </div>

        {/* Employee selector bar */}
        <div className="px-6 py-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Employee</span>
          </div>

          {/* Search toggle */}
          <div className="relative flex items-center gap-2 flex-1 min-w-0">
            {showSearch ? (
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search employees…"
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : null}

            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-text-heading outline-none focus:ring-2 focus:ring-primary/30 max-w-xs"
            >
              {(searchQuery ? filteredEmployeeList : resolvedEmployeeList).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>

            <button
              onClick={() => { setShowSearch((v) => !v); setSearchQuery(""); }}
              type="button"
              className={cx(
                "p-2 rounded-xl border transition",
                showSearch ? "bg-primary/10 border-primary/20 text-primary" : "border-slate-200 text-slate-400 hover:bg-slate-50"
              )}
              title="Search employees"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={refreshList}
              type="button"
              className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition"
              title="Refresh employee list (picks up newly created accounts)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {selectedEmployee && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="text-xs text-slate-500">Viewing:</div>
              <div className="flex items-center gap-1.5 bg-primary/8 border border-primary/15 rounded-xl px-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs font-bold text-primary">{selectedEmployee.name}</span>
                {selectedEmployee.department !== "—" && (
                  <span className="text-[10px] text-primary/60">· {selectedEmployee.department}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Date jump bar */}
        <div className="px-6 py-3 flex flex-wrap items-center gap-2 bg-slate-50/50">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Jump to date</span>
          <div className="relative">
            <input
              value={dateQuery}
              onChange={(e) => setDateQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goToDate()}
              placeholder="YYYY-MM-DD"
              className={cx(
                "w-40 rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2",
                dateError ? "border-rose-300 focus:ring-rose-200" : "border-slate-200 focus:ring-primary/30"
              )}
            />
            {dateError && (
              <div className="absolute left-0 top-full mt-1 text-[11px] font-semibold text-rose-600 whitespace-nowrap">
                {dateError}
              </div>
            )}
          </div>
          <ActionButton onClick={goToDate} type="button">Go</ActionButton>

          <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-600">
              {resolvedEmployeeList.length}
            </span> employees total
            {resolvedEmployeeList.length > (adminAccounts.length + (accounts as Account[]).length) && (
              <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                +{resolvedEmployeeList.length - adminAccounts.length - (accounts as Account[]).length} created
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Calendar — 2 cols */}
        <div className="xl:col-span-2">
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

        {/* Right panel — 1 col */}
        <div className="xl:col-span-1 space-y-5">
          {/* ── Overview card ── */}
          <motion.div
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-card rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-text-heading text-sm">Monthly Overview</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-secondary/10 border border-secondary/20 rounded-xl px-2.5 py-1">
                <TrendingUp className="w-3.5 h-3.5 text-secondary" />
                <span className="text-xs font-bold text-secondary">
                  {monthOverview.avgHoursPerWorkDay.toFixed(1)} hrs/day
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Stat badges */}
              <div className="grid grid-cols-3 gap-2">
                <StatBadge label="Present"    value={monthOverview.presentDays}    tone="green" />
                <StatBadge label="Absent"     value={monthOverview.absentDays}     tone="rose"  />
                <StatBadge label="Incomplete" value={monthOverview.incompleteDays} tone="amber" />
              </div>

              {/* Total hours */}
              <div className="rounded-2xl border border-secondary/20 bg-gradient-to-br from-secondary/8 to-secondary/4 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs font-bold text-text-heading">Total Work Hours</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">This month</div>
                  </div>
                  <div className="h-8 w-8 rounded-xl bg-white/70 flex items-center justify-center border border-secondary/20">
                    <Timer className="w-4 h-4 text-secondary" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-text-heading tabular-nums">
                  {formatHoursFromMinutes(monthTotalMinutes)}
                  <span className="text-sm font-semibold text-slate-400 ml-1">hrs</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/60 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-secondary rounded-full"
                  />
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-500">
                  {progressPct}% of {MONTH_TARGET_HOURS}h target
                </div>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {[
                  { icon: UserCheck, label: "Present",    color: "text-emerald-600" },
                  { icon: UserX,     label: "Absent",     color: "text-rose-600"    },
                  { icon: AlertTriangle, label: "Incomplete", color: "text-amber-600" },
                  { icon: CalendarIcon,  label: "Leave",      color: "text-blue-600"  },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-1.5 text-slate-500">
                    <Icon className={cx("w-3.5 h-3.5", color)} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Daily logs card ── */}
          <motion.div
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, delay: 0.06 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
            style={{ height: "520px" }}
          >
            {/* Log header */}
            <div className="bg-gradient-to-r from-[#1F3C68] to-[#2a4f8a] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/15 rounded-xl">
                    <History className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Daily Logs</div>
                    <div className="text-[11px] text-white/50 mt-0.5">Click a row to view details</div>
                  </div>
                </div>
                <ActionButton
                  variant="default"
                  onClick={() => openEditForDate(selectedDateISO)}
                  className="bg-white/15 border-white/20 text-white hover:bg-white/25 text-xs py-1.5"
                  type="button"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Selected
                </ActionButton>
              </div>

              {/* Month nav */}
              <div className="flex items-center justify-between mt-4">
                <button onClick={prevMonth} type="button"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition">
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <span className="text-sm font-bold text-white">
                  {viewMonth.toLocaleString("default", { month: "long", year: "numeric" })}
                </span>
                <button onClick={nextMonth} type="button"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition">
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Log list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <AnimatePresence mode="wait">
                {logsLoading ? (
                  <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <LogSkeleton />
                  </motion.div>
                ) : monthLogItems.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full text-slate-400 py-16 space-y-3">
                    <History className="w-10 h-10 opacity-20" />
                    <p className="text-sm font-medium">No records this month</p>
                    <p className="text-xs text-center max-w-[200px]">
                      Select a date and click "Edit Selected" to create logs.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                    {monthLogItems.map((item, idx) => {
                      const isSelected = item.dateISO === selectedDateISO;
                      const leaveInfo  = getLeaveInfoForDate(item.dateISO);
                      const dateLabel  = new Date(item.dateISO + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                      });

                      const selectedRing = isSelected
                        ? "ring-2 ring-primary/40 ring-offset-1"
                        : "";

                      if (item.kind === "weekend") {
                        return (
                          <motion.div key={item.dateISO}
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.01 }}
                            className={cx("p-2.5 rounded-xl border border-slate-100 bg-slate-50/70", selectedRing)}>
                            <div className="flex items-center justify-between gap-2">
                              <button onClick={() => { setSelectedDateISO(item.dateISO); setDetailOpen(true); }}
                                className="flex-1 text-left" type="button">
                                <p className="text-xs font-semibold text-slate-400">{dateLabel}</p>
                                <p className="text-[10px] text-slate-300 mt-0.5">Weekend</p>
                              </button>
                              <button onClick={() => openEditForDate(item.dateISO)} type="button"
                                className="text-[11px] font-semibold text-slate-400 hover:text-primary flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary/5 transition">
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                            </div>
                          </motion.div>
                        );
                      }

                      if (item.kind === "absent" || item.kind === "upcoming") {
                        const isAbsent = item.kind === "absent";
                        const tileBg = leaveInfo?.status === "Approved"
                          ? "bg-blue-50 border-blue-200"
                          : leaveInfo?.status === "Pending"
                          ? "bg-yellow-50 border-yellow-200"
                          : isAbsent ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-100";
                        const textColor = leaveInfo?.status === "Approved"
                          ? "text-blue-700"
                          : leaveInfo?.status === "Pending"
                          ? "text-yellow-700"
                          : isAbsent ? "text-rose-700" : "text-slate-500";

                        return (
                          <motion.div key={item.dateISO}
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.01 }}
                            className={cx("p-2.5 rounded-xl border", tileBg, selectedRing)}>
                            <div className="flex items-center justify-between gap-2">
                              <button onClick={() => { setSelectedDateISO(item.dateISO); setDetailOpen(true); }}
                                className="flex-1 text-left" type="button">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className={cx("text-xs font-bold", textColor)}>{dateLabel}</p>
                                  <span className={cx("text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                                    leaveInfo?.status === "Approved" ? "bg-blue-100 text-blue-700 border-blue-200"
                                    : leaveInfo?.status === "Pending" ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                                    : isAbsent ? "bg-rose-100 text-rose-700 border-rose-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200")}>
                                    {leaveInfo?.status === "Approved" ? "On Leave" : leaveInfo?.status === "Pending" ? "Pending Leave" : isAbsent ? "Absent" : "Upcoming"}
                                  </span>
                                </div>
                                {leaveInfo && (
                                  <p className={cx("text-[10px] mt-0.5 font-medium",
                                    leaveInfo.status === "Approved" ? "text-blue-600" : "text-yellow-600")}>
                                    {leaveInfo.type}
                                  </p>
                                )}
                              </button>
                              <button onClick={() => openEditForDate(item.dateISO)} type="button"
                                className={cx("text-[11px] font-semibold flex items-center gap-1 px-2 py-1 rounded-lg transition",
                                  leaveInfo?.status === "Approved" ? "text-blue-600 hover:bg-blue-100"
                                  : leaveInfo?.status === "Pending" ? "text-yellow-600 hover:bg-yellow-100"
                                  : isAbsent ? "text-rose-600 hover:bg-rose-100" : "text-slate-400 hover:bg-slate-100")}>
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                            </div>
                          </motion.div>
                        );
                      }

                      // present / incomplete
                      const r       = item.record;
                      const isLate  = getLateMinutes(r.timeIn ?? null) > 0;
                      const badgeCls = item.kind === "present"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200";

                      return (
                        <motion.div key={item.dateISO}
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.01 }}
                          className={cx("p-2.5 rounded-xl border bg-white border-slate-150 hover:border-primary/25 hover:shadow-sm transition-all", selectedRing)}>
                          <div className="flex items-start justify-between gap-2">
                            <button onClick={() => { setSelectedDateISO(item.dateISO); setDetailOpen(true); }}
                              className="flex-1 text-left min-w-0" type="button">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs font-bold text-[#1F3C68]">{dateLabel}</p>
                                <span className={cx("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", badgeCls)}>
                                  {item.kind === "present" ? "Present" : "Incomplete"}
                                </span>
                                {isLate && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">
                                    Late
                                  </span>
                                )}
                                {leaveInfo && (
                                  <span className={cx("text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                                    leaveInfo.status === "Approved" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-yellow-50 text-yellow-700 border-yellow-200")}>
                                    {leaveInfo.status === "Approved" ? "On Leave" : "Pending"}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[11px] text-emerald-600 font-semibold tabular-nums">{formatTime(r.timeIn)}</span>
                                <span className="text-slate-300 text-[10px]">→</span>
                                <span className="text-[11px] text-rose-600 font-semibold tabular-nums">{formatTime(r.timeOut)}</span>
                              </div>
                            </button>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <div className="bg-primary px-2.5 py-1 rounded-full text-[11px] font-bold text-white tabular-nums">
                                {formatHoursFromMinutes(item.minutes)} hrs
                              </div>
                              <button onClick={() => openEditForDate(item.dateISO)} type="button"
                                className="text-[11px] font-semibold text-slate-400 hover:text-primary flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary/5 transition">
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Edit Modal ── */}
      <AnimatePresence>
        {editOpen && (
          <Modal
            open={editOpen}
            title={`Edit Record · ${selectedEmployee?.name ?? selectedEmployeeId} · ${editDraft.dateISO}`}
            onClose={() => setEditOpen(false)}
          >
            <div className="space-y-4">
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700 font-medium flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Use the datetime fields to create or correct attendance logs. Leave fields blank to clear them.
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Time In",    key: "timeIn"   as const },
                  { label: "Time Out",   key: "timeOut"  as const },
                  { label: "Start Break",key: "lunchOut" as const },
                  { label: "End Break",  key: "lunchIn"  as const },
                ].map(({ label, key }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</label>
                    <input
                      type="datetime-local"
                      value={editDraft[key]}
                      onChange={(e) => setEditDraft((p) => ({ ...p, [key]: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Source / Remark</label>
                <input
                  value={editDraft.source}
                  onChange={(e) => setEditDraft((p) => ({ ...p, source: e.target.value }))}
                  placeholder="e.g. Admin correction"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <ActionButton onClick={() => setEditOpen(false)} type="button">Cancel</ActionButton>
                <ActionButton variant="primary" onClick={saveEdit} type="button">Save Changes</ActionButton>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </motion.div>
  );
}