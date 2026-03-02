import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Clock, ChevronLeft, ChevronRight, Calendar, History, Timer, X, LogIn, LogOut, Coffee, Utensils, AlertCircle } from "lucide-react";
import { useClock } from "./hooks/useClock";
import Usersidebar from "./components/Usersidebar.tsx";
import { useAttendance } from "./hooks/useAttendance";
import { daysInMonth, firstDayOfMonth } from "./utils/attendanceUtils.ts";
import { STORAGE_KEY } from "./types/leaveconstants";

const ATTENDANCE_KEY = "worktime_attendance_v1";
const STANDARD_SHIFT_START = "08:00";
const LATE_THRESHOLD_MINUTES = 0;

type AdminAttendanceRecord = {
  id: string;
  employeeId: string;
  source: "Desktop" | "Mobile";
  dateISO: string;
  timeIn: string | null;
  lunchOut: string | null;
  lunchIn: string | null;
  timeOut: string | null;
};

type LeaveRecord = {
  employee: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
};

const leaveConfig: Record<string, { short: string; bg: string; text: string; border: string }> = {
  "Vacation Leave":            { short: "Vacation",   bg: "bg-sky-100",    text: "text-sky-700",    border: "border-sky-200" },
  "Sick Leave":                { short: "Sick",        bg: "bg-rose-100",   text: "text-rose-700",   border: "border-rose-200" },
  "Emergency Leave":           { short: "Emergency",   bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  "Maternity/Paternity Leave": { short: "Mat/Pat",     bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
};

function getLeaveConfig(type: string) {
  return leaveConfig[type] ?? { short: type, bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };
}

function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return dates;
  const cur = new Date(s);
  while (cur <= e) {
    dates.push(cur.toLocaleDateString("en-CA"));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function readAdminAttendance(): AdminAttendanceRecord[] {
  try {
    const raw = localStorage.getItem(ATTENDANCE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AdminAttendanceRecord[]) : [];
  } catch { return []; }
}

function writeAdminAttendance(records: AdminAttendanceRecord[]) {
  try { localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records)); } catch { }
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

function formatTime(dt: string | null | undefined): string {
  if (!dt) return "--:--";
  return new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ─── Skeleton Loading Component ───────────────────────────────────────────────
function LogSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="p-3 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden"
        >
          <div className="flex justify-between items-center">
            <div className="space-y-2 flex-1">
              {/* Date line */}
              <div className="flex items-center gap-2">
                <div
                  className="h-3.5 rounded-full bg-slate-200 animate-pulse"
                  style={{ width: `${60 + (i % 3) * 20}px` }}
                />
                {i % 2 === 0 && (
                  <div className="h-3 w-12 rounded-full bg-slate-200 animate-pulse" />
                )}
              </div>
              {/* Time line */}
              <div className="flex items-center gap-3">
                <div className="h-3 w-10 rounded-full bg-green-100 animate-pulse" />
                <div className="h-2 w-3 rounded-full bg-slate-200 animate-pulse" />
                <div className="h-3 w-10 rounded-full bg-red-100 animate-pulse" />
              </div>
            </div>
            {/* Hours badge */}
            <div className="h-6 w-16 rounded-full bg-slate-200 animate-pulse ml-3" />
          </div>
        </motion.div>
      ))}

      {/* Shimmer overlay effect */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.5) 50%, transparent 75%);
          background-size: 200% 100%;
          animation: shimmer 1.6s infinite;
        }
      `}</style>
    </div>
  );
}

interface DayDetailProps {
  dateStr: string;
  record: { timeIn?: string; timeOut?: string; lunchOut?: string; lunchIn?: string; hours?: number; device?: string } | null;
  leaveType: string | undefined;
  onClose: () => void;
}

function DayDetailModal({ dateStr, record, leaveType, onClose }: DayDetailProps) {
  const now = useClock();
  const todayStr = new Date().toLocaleDateString("en-CA");
  const isToday = dateStr === todayStr;
  const lateMinutes = getLateMinutes(record?.timeIn ?? null, isToday ? now : undefined);
  const leaveCfg = leaveType ? getLeaveConfig(leaveType) : null;
  const date = new Date(dateStr + "T12:00:00");

  const totalHours = record?.hours ?? 0;
  const regularHours = Math.min(totalHours, 9);
  const overtimeHours = Math.max(totalHours - 9, 0);

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
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
          <p className="text-white/70 text-sm font-medium">
            {date.toLocaleDateString("en-US", { weekday: "long" })}
          </p>
          <h2 className="text-2xl font-bold mt-0.5">
            {date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </h2>
          <div className="flex gap-2 mt-3 flex-wrap">
            {!record?.timeIn && !leaveType && (
              <span className="px-3 py-1 bg-slate-500/40 rounded-full text-xs font-bold">No Record</span>
            )}
            {record?.timeIn && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${lateMinutes > 0 ? "bg-red-400/30 text-red-200" : "bg-green-400/30 text-green-200"}`}>
                {lateMinutes > 0 ? `Late ${formatMinutes(lateMinutes)}` : "On Time"}
              </span>
            )}
            {leaveType && leaveCfg && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${leaveCfg.bg} ${leaveCfg.text}`}>
                {leaveCfg.short}
              </span>
            )}
            {overtimeHours > 0 && (
              <span className="px-3 py-1 bg-orange-400/30 text-orange-200 rounded-full text-xs font-bold">
                +{overtimeHours.toFixed(1)}h OT
              </span>
            )}
          </div>
        </div>

        {/* Time breakdown */}
        <div className="p-5 space-y-3">
          {record?.timeIn ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 bg-green-500 rounded-lg">
                      <LogIn className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Time In</p>
                  </div>
                  <p className="text-xl font-bold text-green-800">{formatTime(record.timeIn)}</p>
                  {lateMinutes > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3 text-red-500" />
                      <p className="text-[10px] text-red-500 font-semibold">{formatMinutes(lateMinutes)} late</p>
                    </div>
                  )}
                </div>

                <div className="bg-red-50 border border-red-200 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 bg-red-500 rounded-lg">
                      <LogOut className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Time Out</p>
                  </div>
                  <p className="text-xl font-bold text-red-800">{formatTime(record.timeOut)}</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 bg-yellow-500 rounded-lg">
                      <Coffee className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-xs font-bold text-yellow-700 uppercase tracking-wide">Start Break</p>
                  </div>
                  <p className="text-xl font-bold text-yellow-800">{formatTime(record.lunchOut)}</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 bg-blue-500 rounded-lg">
                      <Utensils className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">End Break</p>
                  </div>
                  <p className="text-xl font-bold text-blue-800">{formatTime(record.lunchIn)}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Hours Summary</p>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-600">Regular Hours</span>
                  <span className="font-bold text-[#1F3C68]">{regularHours.toFixed(1)} hrs</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-slate-600">Overtime</span>
                  <span className={`font-bold ${overtimeHours > 0 ? "text-orange-500" : "text-slate-400"}`}>
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
                  <span className="text-[10px] font-bold text-[#1F3C68]">Total: {totalHours.toFixed(1)} hrs</span>
                  <span className="text-[10px] text-slate-400">9h</span>
                </div>
              </div>

              {record.device && (
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Device</span>
                  <span className="font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full text-xs">{record.device}</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-slate-400">
              {leaveType ? (
                <div className="space-y-2">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${leaveCfg?.bg} ${leaveCfg?.text}`}>
                    {leaveType}
                  </div>
                  <p className="text-sm text-slate-400 mt-2">Approved leave day — no attendance required</p>
                </div>
              ) : (
                <>
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No attendance recorded</p>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function AttendanceApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = location.state?.user || JSON.parse(localStorage.getItem("currentUser") || "null");
  const currentTime = useClock();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { attendanceData } = useAttendance(user?.id);

  // ─── Logs loading state ────────────────────────────────────────────────────
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    // Simulate a brief load so skeleton is visible, then resolve
    const timer = setTimeout(() => setLogsLoading(false), 900);
    return () => clearTimeout(timer);
  }, []);

  // Re-show skeleton when month changes
  useEffect(() => {
    setLogsLoading(true);
    const timer = setTimeout(() => setLogsLoading(false), 600);
    return () => clearTimeout(timer);
  }, [currentMonth]);

  const filteredLogs = attendanceData
                      .filter((r) => {
                        const d = new Date(r.date);
                        return (
                          d.getMonth() === currentMonth.getMonth() &&
                          d.getFullYear() === currentMonth.getFullYear()
                        );
                      })
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [approvedLeaveMap, setApprovedLeaveMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const loadLeaves = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const all: LeaveRecord[] = JSON.parse(raw);
        const userApproved = Array.isArray(all)
          ? all.filter((l) => l.employee === user?.name && l.status === "Approved")
          : [];
        const map = new Map<string, string>();
        for (const leave of userApproved) {
          for (const d of getDateRange(leave.startDate, leave.endDate)) {
            map.set(d, leave.type);
          }
        }
        setApprovedLeaveMap(map);
      } catch { }
    };
    if (user?.name) {
      loadLeaves();
      const interval = setInterval(loadLeaves, 3000);
      return () => clearInterval(interval);
    }
  }, [user?.name]);

  useEffect(() => {
    if (!user?.id) return;
    const employeeId = String(user.id);
    const existing = readAdminAttendance();
    const byKey = new Map<string, AdminAttendanceRecord>();
    for (const r of existing) byKey.set(`${r.employeeId}__${r.dateISO}`, r);

    for (const r of attendanceData) {
      const dateISO = r.date;
      const device = String(r.device ?? "");
      const source: "Desktop" | "Mobile" = device.toLowerCase().includes("mobile") ? "Mobile" : "Desktop";
      byKey.set(`${employeeId}__${dateISO}`, {
        id: `${employeeId}_${dateISO}`,
        employeeId, source, dateISO,
        timeIn: r.timeIn ?? null, lunchOut: r.lunchOut ?? null,
        lunchIn: r.lunchIn ?? null, timeOut: r.timeOut ?? null,
      });
    }
    writeAdminAttendance(Array.from(byKey.values()));
  }, [attendanceData, user?.id]);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const handleLogout = () => navigate("/");

  const monthlyHours = attendanceData
    .filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
    })
    .reduce((acc, curr) => acc + (curr.hours ?? 0), 0);

  const monthlyPercent = Math.min((monthlyHours / 160) * 100, 100);

  const selectedRecord = selectedDate ? attendanceData.find((r) => r.date === selectedDate) ?? null : null;
  const selectedLeaveType = selectedDate ? approvedLeaveMap.get(selectedDate) : undefined;

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const days = [];
    const todayStr = new Date().toLocaleDateString("en-CA");

    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 sm:h-20 md:h-24 border border-slate-100 bg-slate-50/30" />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const record = attendanceData.find((r) => r.date === dateStr);
      const isToday = todayStr === dateStr;
      const leaveType = approvedLeaveMap.get(dateStr);
      const leaveCfg = leaveType ? getLeaveConfig(leaveType) : null;
      const hasRecord = !!record?.timeIn;

      days.push(
        <motion.div
          key={day}
          whileHover={{ scale: 0.97 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setSelectedDate(dateStr)}
          className={`h-16 sm:h-20 md:h-24 border p-1.5 sm:p-2 cursor-pointer transition-all relative overflow-hidden group ${
            leaveType
              ? `${leaveCfg!.bg} ${leaveCfg!.border} hover:brightness-95`
              : isToday
              ? "bg-orange-50 border-[#F28C28]/40 hover:bg-orange-100/50"
              : hasRecord
              ? "bg-white border-slate-200 hover:border-[#1F3C68]/30 hover:bg-blue-50/20"
              : "bg-white border-slate-100 hover:bg-slate-50"
          }`}
        >
          <span className={`text-xs sm:text-sm font-bold ${
            isToday ? "text-[#F28C28]" : leaveType ? leaveCfg!.text : hasRecord ? "text-[#1F3C68]" : "text-slate-400"
          }`}>
            {day}
          </span>

          {leaveType && leaveCfg && (
            <div className={`mt-0.5 text-[8px] sm:text-[9px] font-bold ${leaveCfg.text} leading-tight`}>
              {leaveCfg.short}
            </div>
          )}

          {hasRecord && (
            <div className="mt-0.5 sm:mt-1 space-y-0.5">
              <div className="flex items-center gap-0.5">
                <div className="w-1 h-1 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold text-green-700 tabular-nums">
                  {formatTime(record!.timeIn)}
                </span>
              </div>
              {record?.timeOut && (
                <div className="flex items-center gap-0.5">
                  <div className="w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold text-red-700 tabular-nums">
                    {formatTime(record.timeOut)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-3 h-3 bg-[#1F3C68]/10 rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-[#1F3C68]/40 rounded-full" />
            </div>
          </div>
        </motion.div>
      );
    }

    return days;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <aside className="hidden md:flex w-64 bg-white shadow-lg flex-col border-r border-slate-200">
        <Usersidebar navigate={navigate} logout={handleLogout} />
      </aside>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)} className="fixed inset-0 bg-black/30 z-40 md:hidden" />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 w-64 bg-white h-full shadow-2xl z-50">
              <Usersidebar navigate={navigate} logout={handleLogout} close={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDate && (
          <DayDetailModal
            dateStr={selectedDate}
            record={selectedRecord}
            leaveType={selectedLeaveType}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </AnimatePresence>

      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="flex justify-between items-center mb-8 bg-white p-4 md:p-6 rounded-2xl shadow-md border border-slate-100">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors" onClick={() => setMenuOpen(true)}>
              <Menu className="text-[#1F3C68]" />
            </button>
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-[#1F3C68]">Attendance Records</h1>
              <p className="text-sm text-[#1E293B] mt-1 font-medium">
                {currentTime.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
          <div className="hidden md:flex lg:hidden items-center gap-2 bg-gradient-to-r from-[#F28C28] to-[#E97638] text-white px-3 py-2 rounded-lg shadow-lg md:w-[92px]">
            <Clock className="w-4 h-4" />
            <p className="font-bold text-xs tabular-nums">
              {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-3 bg-primary text-white px-6 py-3 rounded-xl shadow-lg">
            <Clock className="w-5 h-5" />
            <p className="font-bold text-lg tabular-nums">
              {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-primary text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {currentMonth.toLocaleString("default", { month: "long", year: "numeric" })}
                  </h2>
                  <p className="text-xs text-white/70 mt-0.5">Click any date to see full details</p>
                </div>
              </div>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={prevMonth}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </motion.button>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={nextMonth}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              </div>
            </div>

            <div className="p-4">
              <div className="flex flex-wrap gap-3 mb-3 text-[10px] font-semibold text-slate-500">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Time In</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Time Out</div>
              </div>

              <div className="grid grid-cols-7 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider py-2">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 rounded-xl overflow-hidden border border-slate-100">
                {renderCalendar()}
              </div>
            </div>
          </motion.div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-white rounded-3xl shadow-md border-2 border-[#F28C28]/20 overflow-hidden">
              <div className="bg-primary p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Timer className="w-6 h-6" />
                  </div>
                  <div> 
                    <p className="text-white/90 text-sm font-medium">Total Hours</p>
                    <p className="text-xs text-white/70">This Month</p>
                  </div>
                </div>
                <h3 className="text-4xl font-bold mb-4">{monthlyHours.toFixed(1)} hrs</h3>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${monthlyPercent}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                    className="h-full bg-white rounded-full" />
                </div>
                <p className="text-xs text-white/80 mt-2 font-medium">
                  {monthlyPercent.toFixed(0)}% of monthly target (160 hrs)
                </p>
              </div>
            </motion.div>

            {/* ─── Daily Logs with Skeleton Loading ─── */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
              className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden flex flex-col h-[500px]">
              <div className="p-5 border-b border-slate-100 bg-primary">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl mb-20">
                    <History className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#F2F2F2]">Daily Logs</h2>
                    <p className="text-xs text-slate-300">Click a date on calendar for details</p>
                    <div className="flex items-center justify-between mb-4 mt-6">
                      <button
                        onClick={prevMonth}
                        className="p-2 rounded-full bg-slate-100 hover:bg-gray-200 transition">
                          <ChevronLeft size={16} />
                      </button>
                      <h2 className="text-l font-semibold text-slate-200 min-w-[180px] text-center">
                        {currentMonth.toLocaleString("default", { month: "long", year: "numeric" })}
                      </h2>
                      <button
                        onClick={nextMonth}
                        className="p-2 rounded-full bg-slate-100 hover:bg-gray-200 transition">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <AnimatePresence mode="wait">
                  {logsLoading ? (
                    /* ── Skeleton state ── */
                    <motion.div
                      key="skeleton"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <LogSkeleton />
                    </motion.div>
                  ) : filteredLogs.length > 0 ? (
                    /* ── Loaded state: records ── */
                    <motion.div
                      key="logs"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-3"
                    >
                      {filteredLogs.map((record, idx) => {
                        const leaveType = approvedLeaveMap.get(record.date);
                        const leaveCfg = leaveType ? getLeaveConfig(leaveType) : null;
                        const isRecordToday = record.date === new Date().toLocaleDateString("en-CA");
                        const late = getLateMinutes(record.timeIn ?? null, isRecordToday ? currentTime : undefined);
                        
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            onClick={() => setSelectedDate(record.date)}
                            className="p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-[#F28C28]/30 hover:shadow-sm transition-all cursor-pointer"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-[#1F3C68] text-sm">
                                    {new Date(record.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                  </p>
                                  {late > 0 && (
                                    <span className="text-[9px] font-bold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                                      Late {formatMinutes(late)}
                                    </span>
                                  )}
                                  {leaveType && leaveCfg && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${leaveCfg.bg} ${leaveCfg.text} ${leaveCfg.border}`}>
                                      {leaveCfg.short}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-green-600 font-semibold">{formatTime(record.timeIn)}</span>
                                  <span className="text-slate-300 text-xs">→</span>
                                  <span className="text-xs text-red-600 font-semibold">{formatTime(record.timeOut)}</span>
                                </div>
                              </div>
                              <div className="bg-primary px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm">
                                {(record.hours ?? 0).toFixed(1)} hrs
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  ) : (
                    /* ── Loaded state: empty ── */
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
                      <p className="text-sm font-medium">No attendance records yet</p>
                      <p className="text-xs text-center max-w-[200px]">Click "Time In" on the dashboard to start tracking</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AttendanceApp;