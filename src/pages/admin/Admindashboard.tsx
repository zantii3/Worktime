import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import accounts from "../data/accounts.json";
import { STORAGE_KEY as LEAVE_STORAGE_KEY } from "../user/types/leaveconstants";
import { getCurrentAdmin } from "../utils/sessionAuth";
import { useAdmin } from "./context/AdminProvider";

import {
  AlertTriangle,
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
  X,
  TrendingUp,
  Zap,
  Activity,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status    = "Active" | "Inactive";
type StatusMap = Record<string, Status>;
type UserAccount = { id: number; email: string; password: string; name: string };

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

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_KEY            = "worktime_account_status_v1";
const ATTENDANCE_KEY        = "worktime_attendance_v1";
const CREATED_ACCOUNTS_KEY  = "worktime_created_accounts_v1";
const DELETED_IDS_KEY       = "worktime_deleted_account_ids_v1";
const EDITS_KEY             = "worktime_account_edits_v1";

/** Admin shift: 9 AM → 6 PM (9 hours) */
const SHIFT_HOURS          = 9;
const SHIFT_MS             = SHIFT_HOURS * 60 * 60 * 1000;
const LATE_THRESHOLD_HOUR  = 9;   // mark late if clock-in > 9:00 AM
const BREAK_UNLOCK_HOUR    = 12;  // break locked until 12:00 PM

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toISODate(d: Date) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readStatusMap(): StatusMap {
  try {
    const raw    = localStorage.getItem(STATUS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as StatusMap) : {};
  } catch { return {}; }
}

function readAttendance(): AttendanceRecord[] {
  try {
    const raw    = localStorage.getItem(ATTENDANCE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AttendanceRecord[]) : [];
  } catch { return []; }
}

function writeAttendance(list: AttendanceRecord[]) {
  try { localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(list)); } catch {}
}

/**
 * Builds the full user-only account list exactly the way Users.tsx does:
 * static accounts.json  +  created accounts  –  deleted IDs  +  name edits.
 * Returns { total, active } counts based on statusMap.
 */
function resolveUserStats(statusMap: StatusMap): { total: number; active: number } {
  const deleted = new Set<string>(
    (() => { try { return JSON.parse(localStorage.getItem(DELETED_IDS_KEY) ?? "[]") as string[]; } catch { return []; } })()
  );
  const edits = (() => {
    try { return JSON.parse(localStorage.getItem(EDITS_KEY) ?? "{}") as Record<string, { name?: string }>; }
    catch { return {}; }
  })();
  const created = (() => {
    try { return JSON.parse(localStorage.getItem(CREATED_ACCOUNTS_KEY) ?? "[]") as CreatedAccount[]; }
    catch { return []; }
  })();

  // Static user accounts (not deleted)
  const staticIds = (accounts as UserAccount[])
    .filter((u) => !deleted.has(`user:${u.id}`))
    .map((u) => ({ key: `user:${u.id}` }));

  // Locally created user accounts (not deleted)
  const createdUserIds = created
    .filter((a) => a.kind === "user" && !deleted.has(`user:${a.id}`))
    .map((a) => ({ key: `user:${a.id}` }));

  const allUserKeys = [...staticIds, ...createdUserIds];
  const total  = allUserKeys.length;
  const active = allUserKeys.filter(({ key }) => (statusMap[key] ?? "Active") === "Active").length;

  return { total, active };
}

function normalizeLeave(raw: unknown): DashboardLeave | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;

  const employee = typeof item.employee === "string" && item.employee.trim()
    ? item.employee.trim() : "Unknown";
  const type   = typeof item.type   === "string" && item.type.trim()   ? item.type.trim()   : "Leave";
  const status = typeof item.status === "string" && item.status.trim() ? item.status.trim() : "Pending";

  const dateFrom = typeof item.dateFrom === "string" && item.dateFrom ? item.dateFrom
    : typeof item.startDate === "string" && item.startDate ? item.startDate
    : typeof item.date      === "string" && item.date      ? item.date : "";
  const dateTo   = typeof item.dateTo   === "string" && item.dateTo   ? item.dateTo
    : typeof item.endDate   === "string" && item.endDate   ? item.endDate
    : typeof item.date      === "string" && item.date      ? item.date : dateFrom;
  const appliedOn = typeof item.appliedOn === "string" ? item.appliedOn
    : typeof item.date === "string" ? item.date : undefined;

  return {
    id: typeof item.id === "number" || typeof item.id === "string" ? item.id : Date.now(),
    employee, type, status, dateFrom, dateTo, appliedOn,
    reason: typeof item.reason === "string" ? item.reason : undefined,
  };
}

function readLeavesFromStorage(): DashboardLeave[] {
  try {
    const raw    = localStorage.getItem(LEAVE_STORAGE_KEY);
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
  } catch { return []; }
}

function getStatusLabel(r: AttendanceRecord | null) {
  if (!r?.timeIn)  return "Not Started";
  if (r.timeOut)   return "Clocked Out";
  return "Clocked In";
}

function computeBreakMsLive(r: AttendanceRecord | null, nowMs: number) {
  if (!r?.lunchOut) return 0;
  const start = new Date(r.lunchOut).getTime();
  const end   = r.lunchIn ? new Date(r.lunchIn).getTime() : nowMs;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

function computeWorkMsLive(r: AttendanceRecord | null, nowMs: number) {
  if (!r?.timeIn) return 0;
  const start = new Date(r.timeIn).getTime();
  const end   = r.timeOut ? new Date(r.timeOut).getTime() : nowMs;
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
  if (from && to && from !== to) return `${from} → ${to}`;
  return from || to;
}

function getDeviceLabel() {
  const ua             = navigator.userAgent.toLowerCase();
  const w              = window.innerWidth;
  const isMobileUA     = /android|iphone|ipod|blackberry|iemobile|opera mini/.test(ua);
  const isTabletUA     = /ipad|tablet|playbook|silk/.test(ua);
  const isMobileView   = w <= 765;
  const isTabletView   = w > 765 && w <= 1024;
  const hasTouch       = () => "ontouchstart" in window || navigator.maxTouchPoints > 0;
  return isMobileUA || (isMobileView && hasTouch()) ? "Mobile"
    : isTabletUA || isTabletView ? "Tablet" : "Desktop";
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

/** Returns rendered hours (work time excluding break) as a float */
function getRenderedHours(r: AttendanceRecord | null, nowMs: number): number {
  if (!r?.timeIn) return 0;
  const workMs = computeWorkMsLive(r, nowMs);
  return Math.max(workMs / (1000 * 60 * 60), 0);
}

/** Minutes late past 9 AM */
function getLateMinutes(timeIn: string | null): number {
  if (!timeIn) return 0;
  const t         = new Date(timeIn);
  const threshold = new Date(t);
  threshold.setHours(LATE_THRESHOLD_HOUR, 0, 0, 0);
  const diff = Math.floor((t.getTime() - threshold.getTime()) / 60000);
  return diff > 0 ? diff : 0;
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const base = "px-2.5 py-1 rounded-full text-xs font-bold border";
  const map: Record<string, string> = {
    "Pending":     "bg-yellow-50 text-yellow-700 border-yellow-200",
    "Approved":    "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Rejected":    "bg-rose-50 text-rose-700 border-rose-200",
    "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
    "Completed":   "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={`${base} ${map[status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {status}
    </span>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const size   = 160;
  const radius = 56;
  const stroke = 11;
  const cxp    = size / 2;
  const cyp    = size / 2;
  const c      = 2 * Math.PI * radius;
  const safe   = clamp(pct, 0, 100);
  const dash   = (safe / 100) * c;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cxp} cy={cyp} r={radius} fill="none"
          stroke="rgba(148,163,184,0.18)" strokeWidth={stroke} />
        <motion.circle cx={cxp} cy={cyp} r={radius} fill="none"
          stroke={safe >= 100 ? "#f97316" : "#F28C28"} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${cxp} ${cyp})`}
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${dash} ${c - dash}` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</span>
        <span className="text-3xl font-extrabold text-[#1F3C68] tabular-nums leading-none mt-0.5">
          {Math.round(safe)}%
        </span>
      </div>
    </div>
  );
}

// ─── Early-out warning modal ──────────────────────────────────────────────────

function EarlyOutModal({
  onClose, onConfirm, renderedHours,
}: {
  onClose: () => void;
  onConfirm: () => void;
  renderedHours: number;
}) {
  const remainingMinutes = Math.max(0, Math.round((SHIFT_HOURS - renderedHours) * 60));
  const remainingDisplay = remainingMinutes >= 60
    ? `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m`
    : `${remainingMinutes}m`;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-red-500 to-rose-600 p-6 text-white relative">
          <button onClick={onClose} type="button"
            className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Warning</p>
              <h2 className="text-xl font-bold">Early Time Out</h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-1">Hours Rendered</p>
              <p className="text-2xl font-bold text-emerald-700">
                {renderedHours.toFixed(1)}<span className="text-sm font-medium">h</span>
              </p>
            </div>
            <div className="flex-1 bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide mb-1">Still Needed</p>
              <p className="text-2xl font-bold text-red-600">{remainingDisplay}</p>
            </div>
          </div>

          <p className="text-slate-500 text-sm text-center leading-relaxed">
            You haven't completed your{" "}
            <span className="font-bold text-[#1F3C68]">{SHIFT_HOURS}-hour shift</span> yet.
            Are you sure you want to clock out early?
          </p>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-medium">
              <span>Shift Progress</span>
              <span className="font-bold text-[#1F3C68]">
                {Math.round((renderedHours / SHIFT_HOURS) * 100)}%
              </span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((renderedHours / SHIFT_HOURS) * 100, 100)}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0h</span>
              <span>{SHIFT_HOURS}h required</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={onClose} type="button"
              className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm transition-colors">
              Cancel
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={onConfirm} type="button"
              className="py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-red-200 text-sm">
              Clock Out Early
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Break-locked modal ───────────────────────────────────────────────────────

function BreakLockedModal({
  onClose, currentTime,
}: {
  onClose: () => void;
  currentTime: Date;
}) {
  const hour            = currentTime.getHours();
  const minute          = currentTime.getMinutes();
  const minutesUntil12  = BREAK_UNLOCK_HOUR * 60 - (hour * 60 + minute);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white relative">
          <button onClick={onClose} type="button"
            className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl">
              <Coffee className="w-6 h-6" />
            </div>
            <div>
              <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Not Yet!</p>
              <h2 className="text-xl font-bold">Break Time Locked</h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-amber-50 rounded-full flex items-center justify-center border-4 border-amber-100">
            <TimerIcon className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <p className="text-slate-700 font-semibold text-base">
              Break starts at <span className="text-amber-500 font-bold">12:00 PM</span>
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {minutesUntil12 > 0
                ? `${minutesUntil12 >= 60
                    ? `${Math.floor(minutesUntil12 / 60)}h ${minutesUntil12 % 60}m`
                    : `${minutesUntil12}m`} to go!`
                : "Almost time — hang tight!"}
            </p>
          </div>

          {/* Live clock */}
          <div className="bg-slate-50 rounded-2xl px-5 py-3 border border-slate-100">
            <p className="text-xs text-slate-400 mb-1 font-medium">Current Time</p>
            <p className="text-2xl font-bold tabular-nums text-[#1F3C68]">
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit", minute: "2-digit", second: "2-digit",
              })}
            </p>
          </div>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={onClose} type="button"
            className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-200 text-sm">
            Got it, I'll wait!
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Shared small components ──────────────────────────────────────────────────

function TimeDetailTile({
  label, value, tone, sub,
}: {
  label: string; value: string;
  tone: "blue" | "orange" | "red" | "yellow" | "slate" | "green";
  sub?: string;
}) {
  const map = {
    blue:   "border-blue-200   bg-gradient-to-br from-blue-50   to-blue-100/50   text-[#1F3C68]",
    orange: "border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50 text-[#F28C28]",
    red:    "border-red-200    bg-gradient-to-br from-red-50    to-red-100/50    text-[#e91f1f]",
    yellow: "border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100/50 text-[#F28C28]",
    slate:  "border-slate-200  bg-gradient-to-br from-slate-50  to-slate-100/50  text-[#1F3C68]",
    green:  "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-700",
  } as const;
  return (
    <div className={cx("p-3 rounded-xl border min-w-0", map[tone])}>
      <p className="text-[10px] text-slate-500 mb-1 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-base font-bold tabular-nums truncate">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{sub}</p>}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, subtitle, icon: Icon, onClick, accent = false,
}: {
  title: string; value: string | number; subtitle: string;
  icon: React.ElementType; onClick: () => void; accent?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      type="button"
      className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-card text-left group cursor-pointer w-full"
    >
      <div className={cx(
        "p-5 text-white relative overflow-hidden",
        accent ? "bg-gradient-to-br from-secondary to-orange-600" : "bg-gradient-to-br from-primary to-[#2a4f8a]"
      )}>
        {/* subtle radial glow */}
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle at 85% 15%, white 0%, transparent 55%)" }} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-widest uppercase opacity-80">{title}</div>
            <div className="mt-2 text-4xl font-extrabold leading-none tabular-nums">{value}</div>
          </div>
          <span className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
            <Icon className="w-5 h-5 text-white" />
          </span>
        </div>
      </div>
      <div className="p-4 bg-card flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500 font-medium">{subtitle}</div>
        <ArrowRight className="w-4 h-4 text-slate-400 transition-transform group-hover:translate-x-1" />
      </div>
    </motion.button>
  );
}

// ─── Panel (leaves / tasks lists) ────────────────────────────────────────────

function Panel({
  title, icon: Icon, children, badge,
}: {
  title: string; icon: React.ElementType;
  children: React.ReactNode; badge?: number;
}) {
  return (
    <div className="bg-card rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-sm font-bold text-text-heading">{title}</h2>
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="bg-secondary text-white rounded-full px-2 py-0.5 text-[11px] font-bold min-w-[22px] text-center">
            {badge}
          </span>
        )}
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  );
}

function PanelRow({
  primary, secondary, badge,
}: {
  primary: string; secondary: string; badge: string;
}) {
  return (
    <div className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text-heading truncate">{primary}</div>
        <div className="text-xs text-slate-400 truncate mt-0.5">{secondary}</div>
      </div>
      <StatusBadge status={badge} />
    </div>
  );
}

function PanelEmpty({ text }: { text: string }) {
  return (
    <div className="px-5 py-8 text-center text-sm text-slate-400 font-medium">{text}</div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { tasks } = useAdmin();

  // ── Clocks ────────────────────────────────────────────────────────────────
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

  // ── Modal state ───────────────────────────────────────────────────────────
  type ActiveModal = "early-out" | "break-locked" | null;
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  // ── Status map ────────────────────────────────────────────────────────────
  const [statusMap, setStatusMap] = useState<StatusMap>(() => readStatusMap());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATUS_KEY) setStatusMap(readStatusMap());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Bump this whenever Users.tsx creates, deletes, or edits an account so
  // userStats re-computes even within the same tab.
  const [accountsVersion, setAccountsVersion] = useState(0);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === CREATED_ACCOUNTS_KEY ||
        e.key === DELETED_IDS_KEY ||
        e.key === EDITS_KEY
      ) setAccountsVersion((v) => v + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Attendance ────────────────────────────────────────────────────────────
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>(() => readAttendance());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ATTENDANCE_KEY) setAllAttendance(readAttendance());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Leaves ────────────────────────────────────────────────────────────────
  const [storedLeaves, setStoredLeaves] = useState<DashboardLeave[]>(() => readLeavesFromStorage());
  useEffect(() => {
    const syncLeaves = () => setStoredLeaves(readLeavesFromStorage());
    const onStorage  = (e: StorageEvent) => { if (e.key === LEAVE_STORAGE_KEY) syncLeaves(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", syncLeaves);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", syncLeaves);
    };
  }, []);

  // ── Current admin ─────────────────────────────────────────────────────────
  const currentAdmin = useMemo(() => {
    return getCurrentAdmin<{ id: number; email: string; name: string }>();
  }, []);

  const adminEmployeeId = currentAdmin ? String(currentAdmin.id) : "";
  const todayISO        = useMemo(() => toISODate(now), [now]);

  // ── User stats (includes created accounts from Users.tsx) ────────────────
  const userStats = useMemo(
    () => resolveUserStats(statusMap),
    // accountsVersion re-triggers when created/deleted/edited keys change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statusMap, accountsVersion]
  );

  const pendingLeaves = useMemo(
    () => storedLeaves.filter((l) => l.status === "Pending").length,
    [storedLeaves]
  );

  // ── Task stats ────────────────────────────────────────────────────────────
  const taskStats = useMemo(() => {
    const completed  = tasks.filter((t) => t.status === "Completed").length;
    const inProgress = tasks.filter((t) => t.status === "In Progress").length;
    const pending    = tasks.filter((t) => t.status === "Pending").length;
    const total      = tasks.length;
    const pct        = total ? Math.round((completed / total) * 100) : 0;
    return { completed, inProgress, pending, total, pct };
  }, [tasks]);

  const todayAttendanceCount = useMemo(
    () => allAttendance.filter((r) => r.dateISO === todayISO && !!r.timeIn).length,
    [allAttendance, todayISO]
  );

  // ── Admin today record ────────────────────────────────────────────────────
  const adminTodayRecord = useMemo(
    () => adminEmployeeId
      ? allAttendance.find((r) => r.employeeId === adminEmployeeId && r.dateISO === todayISO) ?? null
      : null,
    [allAttendance, adminEmployeeId, todayISO]
  );

  const adminStatus = useMemo(() => {
    if (!currentAdmin) return "—";
    return statusMap[`admin:${currentAdmin.id}`] ?? "Active";
  }, [currentAdmin, statusMap]);

  // ── Computed time values ──────────────────────────────────────────────────
  const statusLabel = getStatusLabel(adminTodayRecord);
  const workMs      = useMemo(() => computeWorkMsLive(adminTodayRecord, nowMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adminTodayRecord, nowMs, tick]);
  const breakMs = useMemo(() => computeBreakMsLive(adminTodayRecord, nowMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adminTodayRecord, nowMs, tick]);

  const isOnBreak     = !!adminTodayRecord?.lunchOut && !adminTodayRecord?.lunchIn && !adminTodayRecord?.timeOut;
  const isTimedIn     = !!adminTodayRecord?.timeIn;
  const isTimedOut    = !!adminTodayRecord?.timeOut;
  const isBeforeBreak = now.getHours() < BREAK_UNLOCK_HOUR;

  // Rendered hours (for early-out check)
  const renderedHours = getRenderedHours(adminTodayRecord, nowMs);

  // Late detection (> 9 AM)
  const lateMinutes = getLateMinutes(adminTodayRecord?.timeIn ?? null);

  // Button capability flags
  const canTimeIn    = adminStatus === "Active" && !isTimedIn;
  const canTimeOut   = adminStatus === "Active" && isTimedIn && !isTimedOut;
  const canStartBreak = adminStatus === "Active" && isTimedIn && !adminTodayRecord?.lunchOut && !isTimedOut;
  const canEndBreak   = adminStatus === "Active" && isOnBreak;

  // Dynamic labels
  const timeButtonLabel  = canTimeIn  ? "Time In"    : "Time Out";
  const breakButtonLabel = canEndBreak ? "End Break"  : "Start Break";

  // Live state text
  const liveStateText = useMemo(() => {
    if (!isTimedIn)  return "Ready to Clock In";
    if (isOnBreak)   return "On Break";
    if (isTimedOut)  return "Shift Complete";
    return lateMinutes > 0 ? `Late by ${formatMinutes(lateMinutes)}` : "Working";
  }, [isTimedIn, isTimedOut, isOnBreak, lateMinutes]);

  // Progress ring
  const remainingMs  = clamp(SHIFT_MS - workMs, 0, SHIFT_MS);
  const regularMs    = clamp(workMs, 0, SHIFT_MS);
  const overtimeMs   = Math.max(0, workMs - SHIFT_MS);
  const progressPct  = SHIFT_MS ? Math.round((regularMs / SHIFT_MS) * 100) : 0;

  // ── Upsert helper ─────────────────────────────────────────────────────────
  const upsertAttendance = (patch: Partial<AttendanceRecord>) => {
    if (!adminEmployeeId) return;
    const id = `${adminEmployeeId}_${todayISO}`;
    const nextList = [...allAttendance];
    const idx = nextList.findIndex(
      (r) => r.employeeId === adminEmployeeId && r.dateISO === todayISO
    );
    if (idx === -1) {
      const base: AttendanceRecord = {
        id, employeeId: adminEmployeeId, source: getDeviceLabel(),
        dateISO: todayISO, timeIn: null, lunchOut: null, lunchIn: null, timeOut: null,
      };
      nextList.unshift({ ...base, ...patch });
    } else {
      nextList[idx] = { ...nextList[idx], ...patch };
    }
    setAllAttendance(nextList);
    writeAttendance(nextList);
  };

  // ── Attendance actions ────────────────────────────────────────────────────
  const doTimeIn     = () => { if (!adminTodayRecord?.timeIn) upsertAttendance({ timeIn: new Date().toISOString(), source: getDeviceLabel() }); };
  const doStartBreak = () => { if (adminTodayRecord?.timeIn && !adminTodayRecord?.timeOut && !(adminTodayRecord.lunchOut && !adminTodayRecord.lunchIn)) upsertAttendance({ lunchOut: new Date().toISOString() }); };
  const doEndBreak   = () => { if (adminTodayRecord?.lunchOut && !adminTodayRecord?.lunchIn && !adminTodayRecord?.timeOut) upsertAttendance({ lunchIn: new Date().toISOString() }); };
  const doTimeOut    = () => {
    if (!adminTodayRecord?.timeIn || adminTodayRecord?.timeOut) return;
    const nowISO = new Date().toISOString();
    const patch: Partial<AttendanceRecord> = { timeOut: nowISO };
    if (adminTodayRecord.lunchOut && !adminTodayRecord.lunchIn) patch.lunchIn = nowISO;
    upsertAttendance(patch);
  };

  // ── Button handlers (with modal guards) ───────────────────────────────────
  const handleTimeToggle = () => {
    if (canTimeIn)  { doTimeIn(); return; }
    if (canTimeOut) {
      if (renderedHours < SHIFT_HOURS) { setActiveModal("early-out"); return; }
      doTimeOut();
    }
  };

  const handleBreakToggle = () => {
    if (canEndBreak)   { doEndBreak(); return; }
    if (canStartBreak) {
      if (isBeforeBreak) { setActiveModal("break-locked"); return; }
      doStartBreak();
    }
  };

  const handleConfirmEarlyOut = () => { setActiveModal(null); doTimeOut(); };

  // ── Panel data ────────────────────────────────────────────────────────────
  const recentPendingLeaves = useMemo(
    () => storedLeaves.filter((l) => l.status === "Pending").slice(0, 5),
    [storedLeaves]
  );
  const adminOwnLeaves = useMemo(
    () => currentAdmin?.name
      ? storedLeaves.filter((l) => l.employee === currentAdmin.name).slice(0, 5)
      : [],
    [storedLeaves, currentAdmin]
  );
  const recentTasks = useMemo(() => tasks.slice(0, 5), [tasks]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="space-y-6 p-1"
    >
      {/* ── Modals ── */}
      <AnimatePresence>
        {activeModal === "early-out" && (
          <EarlyOutModal
            key="early-out"
            onClose={() => setActiveModal(null)}
            onConfirm={handleConfirmEarlyOut}
            renderedHours={renderedHours}
          />
        )}
        {activeModal === "break-locked" && (
          <BreakLockedModal
            key="break-locked"
            onClose={() => setActiveModal(null)}
            currentTime={now}
          />
        )}
      </AnimatePresence>

      {/* ── Top header bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm"
      >
        <div className="bg-gradient-to-r from-[#1F3C68] to-[#2a4f8a] px-6 py-5 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 90% 50%, white 0%, transparent 60%)" }} />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-white/60" />
                <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Admin Dashboard</span>
              </div>
              <h1 className="text-2xl font-extrabold text-white">Workforce Overview</h1>
              <p className="text-white/50 text-sm mt-0.5">
                Signed in as{" "}
                <span className="font-bold text-white/80">{currentAdmin?.name ?? "—"}</span>
                {" "}·{" "}
                <span className={cx(
                  "font-bold",
                  adminStatus === "Active" ? "text-emerald-300" : "text-rose-300"
                )}>
                  {adminStatus}
                </span>
              </p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm text-white rounded-2xl px-5 py-3 flex items-center gap-3 border border-white/20">
              <ClockIcon className="w-5 h-5 text-white/70" />
              <span className="text-xl font-extrabold tabular-nums">
                {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Active Users", value: userStats.active,
            subtitle: `${userStats.total} total employees`,
            icon: UsersIcon, onClick: () => navigate("/admin/users"),
          },
          {
            title: "Pending Leaves", value: pendingLeaves,
            subtitle: "Awaiting your approval",
            icon: FileText, onClick: () => navigate("/admin/leave"), accent: pendingLeaves > 0,
          },
          {
            title: "Task Completion", value: `${taskStats.pct}%`,
            subtitle: `${taskStats.completed} of ${taskStats.total} done`,
            icon: CheckCircle2, onClick: () => navigate("/admin/project-management"),
          },
          {
            title: "Attendance Today", value: todayAttendanceCount,
            subtitle: todayISO,
            icon: CalendarDays, onClick: () => navigate("/admin/attendance"),
          },
        ].map((card, i) => (
          <motion.div key={card.title}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: i * 0.06 }}>
            <KpiCard {...card} accent={(card as any).accent ?? false} />
          </motion.div>
        ))}
      </div>

      {/* ── Time Tracker ── */}
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.28, delay: 0.12 }}
        className="rounded-3xl overflow-hidden border-2 border-[#F28C28]/20 shadow-xl bg-white"
      >
        {/* Tracker header */}
        <div className="bg-gradient-to-r from-[#1F3C68] to-[#2a4f8a] px-6 py-5 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 80% 0%, white 0%, transparent 50%)" }} />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                <TimerIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Time Tracker</h2>
                <p className="text-white/50 text-xs mt-0.5">
                  Admin · {SHIFT_HOURS}h shift · Break from {BREAK_UNLOCK_HOUR}:00 PM · Late after {LATE_THRESHOLD_HOUR}:00 AM
                </p>
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex flex-col items-end">
              <div className={cx(
                "flex items-center gap-2 font-bold",
                statusLabel === "Clocked In"  ? "text-emerald-300"
                : statusLabel === "Clocked Out" ? "text-red-300" : "text-white/50"
              )}>
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                <span className="text-lg">{statusLabel}</span>
              </div>
              <span className="text-xs text-white/50 mt-0.5 font-semibold">{liveStateText}</span>
              {lateMinutes > 0 && isTimedIn && !isTimedOut && (
                <span className="mt-1.5 text-[10px] font-bold bg-red-500/25 text-red-300 border border-red-400/30 rounded-full px-2 py-0.5">
                  Late {formatMinutes(lateMinutes)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tracker body — 3 columns */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {/* Progress ring */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-full blur-2xl opacity-30 bg-orange-200" />
              <ProgressRing pct={progressPct} />
            </div>
          </div>

          {/* Center — remaining time */}
          <div className="flex flex-col items-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              {overtimeMs > 0 ? "Overtime" : "Remaining"}
            </p>
            <div className={cx(
              "text-5xl font-extrabold tabular-nums tracking-[0.06em] leading-none",
              overtimeMs > 0 ? "text-orange-500" : "text-[#1F3C68]"
            )}>
              {overtimeMs > 0 ? `+${msToClockText(overtimeMs)}` : msToClockText(remainingMs)}
            </div>

            <div className="mt-5 flex items-center gap-8">
              <div className="text-center">
                <p className="text-xs text-slate-400 font-semibold">Regular</p>
                <p className="text-xl font-extrabold text-emerald-600 tabular-nums mt-0.5">
                  {msToHM(regularMs)}
                </p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-xs text-slate-400 font-semibold">Overtime</p>
                <p className={cx(
                  "text-xl font-extrabold tabular-nums mt-0.5",
                  overtimeMs > 0 ? "text-orange-500" : "text-slate-300"
                )}>
                  {msToHM(overtimeMs)}
                </p>
              </div>
            </div>
          </div>

          {/* Right — elapsed / break tiles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Elapsed Work</p>
              <p className="text-3xl font-extrabold tabular-nums text-[#1F3C68]">
                {adminTodayRecord?.timeIn ? msToClockText(workMs) : "00:00:00"}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">break excluded</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wide mb-1">Break</p>
              <p className="text-xl font-extrabold tabular-nums text-amber-700">
                {adminTodayRecord?.lunchOut ? msToClockText(breakMs) : "00:00:00"}
              </p>
              <p className="text-[10px] text-amber-400 mt-1">{isOnBreak ? "running" : "stopped"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Device</p>
              <p className="text-sm font-bold text-slate-600 truncate">
                {adminTodayRecord?.source ?? getDeviceLabel()}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 truncate">{currentAdmin?.name ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Time In / Out */}
            <motion.button
              whileHover={{ scale: canTimeIn || canTimeOut ? 1.02 : 1 }}
              whileTap={{ scale: canTimeIn || canTimeOut ? 0.97 : 1 }}
              onClick={handleTimeToggle}
              disabled={!canTimeIn && !canTimeOut}
              type="button"
              className={cx(
                "h-24 rounded-2xl font-bold shadow-sm transition-all border-2 flex flex-col items-center justify-center gap-2",
                !canTimeIn && !canTimeOut
                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                  : canTimeIn
                  ? "bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-600 text-white shadow-emerald-200 hover:shadow-emerald-300 hover:shadow-lg"
                  : "bg-gradient-to-br from-red-500 to-rose-600 border-red-500 text-white shadow-red-200 hover:shadow-red-300 hover:shadow-lg"
              )}
            >
              {canTimeIn ? <LogIn className="w-6 h-6" /> : <LogOut className="w-6 h-6" />}
              <span className="text-base">{timeButtonLabel}</span>
              <span className="text-[10px] opacity-70">
                {canTimeIn ? "Start your shift" : canTimeOut ? "End your shift" : "—"}
              </span>
            </motion.button>

            {/* Start / End Break */}
            <motion.button
              whileHover={{ scale: canStartBreak || canEndBreak ? 1.02 : 1 }}
              whileTap={{ scale: canStartBreak || canEndBreak ? 0.97 : 1 }}
              onClick={handleBreakToggle}
              disabled={!canStartBreak && !canEndBreak}
              type="button"
              className={cx(
                "h-24 rounded-2xl font-bold shadow-sm transition-all border-2 flex flex-col items-center justify-center gap-2 relative overflow-hidden",
                !canStartBreak && !canEndBreak
                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                  : canEndBreak
                  ? "bg-gradient-to-br from-[#1F3C68] to-[#2a4f8a] border-[#1F3C68] text-white shadow-blue-200 hover:shadow-blue-300 hover:shadow-lg"
                  : "bg-gradient-to-br from-amber-400 to-orange-500 border-amber-500 text-white shadow-amber-200 hover:shadow-amber-300 hover:shadow-lg"
              )}
            >
              {/* 12PM lock badge */}
              {canStartBreak && isBeforeBreak && !adminTodayRecord?.lunchOut && (
                <span className="absolute -top-1 -right-1 bg-white text-amber-600 text-[9px] font-black px-2 py-0.5 rounded-full shadow border border-amber-200 leading-tight">
                  12 PM
                </span>
              )}
              {canEndBreak ? <Play className="w-6 h-6" /> : <Coffee className="w-6 h-6" />}
              <span className="text-base">{breakButtonLabel}</span>
              <span className="text-[10px] opacity-70">
                {canEndBreak ? "Resume working" : isBeforeBreak ? "Available at 12:00 PM" : "Take a breather"}
              </span>
            </motion.button>
          </div>

          {adminStatus !== "Active" && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Your admin account is inactive — time tracking actions are disabled.
            </div>
          )}

          {/* Detail tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <TimeDetailTile label="Time In"     value={formatTimeLocal(adminTodayRecord?.timeIn ?? null)}   tone="blue"   />
            <TimeDetailTile label="Break Start" value={formatTimeLocal(adminTodayRecord?.lunchOut ?? null)} tone="orange" />
            <TimeDetailTile label="Break End"   value={formatTimeLocal(adminTodayRecord?.lunchIn ?? null)}  tone="orange" />
            <TimeDetailTile label="Time Out"    value={formatTimeLocal(adminTodayRecord?.timeOut ?? null)}  tone="red"    />
            <TimeDetailTile
              label="Elapsed" tone="yellow"
              value={adminTodayRecord?.timeIn ? msToClockText(workMs) : "--:--"}
              sub="Break excluded"
            />
            <TimeDetailTile
              label="Late" tone={lateMinutes > 0 ? "red" : "green"}
              value={lateMinutes > 0 ? formatMinutes(lateMinutes) : "On time"}
              sub={`After ${LATE_THRESHOLD_HOUR}:00 AM`}
            />
          </div>
        </div>
      </motion.div>

      {/* ── Task progress bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.16 }}
        className="bg-card rounded-2xl border border-slate-200 shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-heading">Task Progress</h2>
              <p className="text-xs text-slate-400">{taskStats.completed} of {taskStats.total} tasks completed</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold text-primary tabular-nums">{taskStats.pct}%</span>
            <button
              onClick={() => navigate("/admin/project-management")}
              type="button"
              className="flex items-center gap-1 text-xs font-semibold text-primary/60 hover:text-primary transition px-2 py-1 rounded-lg hover:bg-primary/5"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bar */}
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${taskStats.pct}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-primary to-[#2a4f8a]"
          />
        </div>

        {/* Stat chips */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Completed",   value: taskStats.completed,  bg: "bg-emerald-50 border-emerald-200", val: "text-emerald-700" },
            { label: "In Progress", value: taskStats.inProgress,  bg: "bg-blue-50 border-blue-200",       val: "text-blue-700"    },
            { label: "Pending",     value: taskStats.pending,     bg: "bg-amber-50 border-amber-200",     val: "text-amber-700"   },
          ].map(({ label, value, bg, val }) => (
            <div key={label} className={cx("rounded-xl border p-3 text-center", bg)}>
              <div className={cx("text-2xl font-extrabold tabular-nums leading-none", val)}>{value}</div>
              <div className="text-[11px] font-bold text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Bottom panels ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.18 }}>
          <Panel title="Pending Leave Requests" icon={FileText} badge={recentPendingLeaves.length}>
            {recentPendingLeaves.length > 0
              ? recentPendingLeaves.map((l) => (
                  <PanelRow
                    key={String(l.id)}
                    primary={l.employee}
                    secondary={`${l.type} · ${formatLeaveDateRange(l.dateFrom, l.dateTo)}`}
                    badge={String(l.status)}
                  />
                ))
              : <PanelEmpty text="No pending leave requests." />}
          </Panel>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.22 }}>
          <Panel title="My Leave Requests" icon={CalendarDays}>
            {adminOwnLeaves.length > 0
              ? adminOwnLeaves.map((l) => (
                  <PanelRow
                    key={String(l.id)}
                    primary={l.type}
                    secondary={formatLeaveDateRange(l.dateFrom, l.dateTo)}
                    badge={String(l.status)}
                  />
                ))
              : <PanelEmpty text="You have no leave requests yet." />}
          </Panel>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.26 }}>
          <Panel title="Recent Tasks" icon={ClipboardList}>
            {recentTasks.length > 0
              ? recentTasks.map((t) => (
                  <PanelRow
                    key={t.id}
                    primary={t.title}
                    secondary={`${t.assignedTo} · ${t.priority}`}
                    badge={t.status}
                  />
                ))
              : <PanelEmpty text="No tasks yet." />}
          </Panel>
        </motion.div>
      </div>

      {/* ── Quick nav shortcuts ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.3 }}
        className="bg-gradient-to-r from-[#1F3C68] to-[#2a4f8a] rounded-2xl p-5 border border-[#1F3C68]/20"
      >
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-white/60" />
          <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Quick Access</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { label: "Attendance",    icon: CalendarDays,  path: "/admin/attendance"         },
            { label: "Leave",         icon: FileText,       path: "/admin/leave"              },
            { label: "Projects",      icon: ClipboardList,  path: "/admin/project-management" },
            { label: "Project List",  icon: TimerIcon,      path: "/admin/project-list"       },
            { label: "Users",         icon: UsersIcon,      path: "/admin/users"              },
            { label: "Profile",       icon: Activity,       path: "/admin/profile"            },
          ].map(({ label, icon: Icon, path }) => (
            <motion.button
              key={path}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(path)}
              type="button"
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/25 transition-all text-white group"
            >
              <Icon className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
              <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">
                {label}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
