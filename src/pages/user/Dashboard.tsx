import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Clock, LogIn, LogOut as LogOutIcon, CheckCircle2, Circle, PlayCircle, BookmarkCheck, Coffee, AlertTriangle, X, Timer } from "lucide-react";
import { useClock } from "./hooks/useClock";
import { useAttendance } from "./hooks/useAttendance";
import type { TimeRecord } from "./hooks/useAttendance";
import Usersidebar from "./components/Usersidebar.tsx";
import { STORAGE_KEY } from "./types/leaveconstants";

type TaskStatus = "Pending" | "In Progress" | "Completed";

interface Task {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: TaskStatus;
  dueDate: string;
  createdAt: string;
}

// ─── Modal Types ───────────────────────────────────────────────────────────────
type ModalType = "break-too-early" | "early-out" | null;

// ─── Reusable Modal Shell ──────────────────────────────────────────────────────
function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─── Break Too Early Modal ─────────────────────────────────────────────────────
function BreakTooEarlyModal({ onClose, currentTime }: { onClose: () => void; currentTime: Date }) {
  const hour = currentTime.getHours();
  const minute = currentTime.getMinutes();
  const minutesUntil11 = (11 * 60) - (hour * 60 + minute);

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-white/20 rounded-2xl">
            <Coffee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-white/80 text-xs font-semibold uppercase tracking-widest">Not Yet!</p>
            <h2 className="text-xl font-bold">Break Time Locked</h2>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-amber-50 rounded-full flex items-center justify-center border-4 border-amber-100">
          <Timer className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <p className="text-slate-700 font-semibold text-base">Break starts at <span className="text-amber-500 font-bold">11:00 AM</span></p>
          <p className="text-slate-400 text-sm mt-1">
            {minutesUntil11 > 0
              ? `Only ${minutesUntil11 >= 60
                  ? `${Math.floor(minutesUntil11 / 60)}h ${minutesUntil11 % 60}m`
                  : `${minutesUntil11}m`} to go!`
              : "Almost time — hang tight!"}
          </p>
        </div>

        {/* Live clock */}
        <div className="bg-slate-50 rounded-2xl px-5 py-3 border border-slate-100">
          <p className="text-xs text-slate-400 mb-1 font-medium">Current Time</p>
          <p className="text-2xl font-bold tabular-nums text-[#1F3C68]">
            {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-200 text-sm"
        >
          Got it, I'll wait!
        </motion.button>
      </div>
    </Modal>
  );
}

// ─── Early Out Modal ───────────────────────────────────────────────────────────
function EarlyOutModal({
  onClose,
  onConfirmEarlyOut,
  renderedHours,
  remainingMinutes,
}: {
  onClose: () => void;
  onConfirmEarlyOut: () => void;
  renderedHours: number;
  remainingMinutes: number;
}) {
  const remainingDisplay = remainingMinutes >= 60
    ? `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m`
    : `${remainingMinutes}m`;

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div className="bg-gradient-to-br from-red-500 to-rose-600 p-6 text-white relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-xl transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-white/20 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-white/80 text-xs font-semibold uppercase tracking-widest">Warning</p>
            <h2 className="text-xl font-bold">Early Time Out</h2>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {/* Hours rendered so far */}
        <div className="flex gap-3">
          <div className="flex-1 bg-green-50 border border-green-200 rounded-2xl p-3 text-center">
            <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-1">Hours Rendered</p>
            <p className="text-2xl font-bold text-green-700">{renderedHours.toFixed(1)}<span className="text-sm font-medium">h</span></p>
          </div>
          <div className="flex-1 bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide mb-1">Still Needed</p>
            <p className="text-2xl font-bold text-red-600">{remainingDisplay}</p>
          </div>
        </div>

        <p className="text-slate-500 text-sm text-center leading-relaxed">
          You haven't completed your <span className="font-bold text-[#1F3C68]">8-hour shift</span> yet. Are you sure you want to clock out early?
        </p>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400 font-medium">
            <span>Shift Progress</span>
            <span className="font-bold text-[#1F3C68]">{Math.round((renderedHours / 8) * 100)}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((renderedHours / 8) * 100, 100)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500"
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>0h</span>
            <span>8h required</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onClose}
            className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm transition-colors"
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onConfirmEarlyOut}
            className="py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-red-200 text-sm"
          >
            Early Out
          </motion.button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = location.state?.user || JSON.parse(localStorage.getItem("currentUser") || "null");

  const currentTime = useClock();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // ── Task counts ──
  const [taskCounts, setTaskCounts] = useState({ pending: 0, inProgress: 0, completed: 0, total: 0 });
  const TASKS_KEY = "worktime_tasks_v1";

  useEffect(() => {
    const loadTaskCounts = () => {
      const stored = localStorage.getItem(TASKS_KEY);
      if (stored) {
        try {
          const allTasks: Task[] = JSON.parse(stored);
          const userTasks = Array.isArray(allTasks)
            ? allTasks.filter((t) => t.assignedTo === user?.name)
            : [];
          setTaskCounts({
            pending: userTasks.filter((t) => t.status === "Pending").length,
            inProgress: userTasks.filter((t) => t.status === "In Progress").length,
            completed: userTasks.filter((t) => t.status === "Completed").length,
            total: userTasks.length,
          });
        } catch { }
      } else {
        setTaskCounts({ pending: 0, inProgress: 0, completed: 0, total: 0 });
      }
    };
    loadTaskCounts();
    const interval = setInterval(loadTaskCounts, 2000);
    return () => clearInterval(interval);
  }, [user?.name]);

  const completionPct = taskCounts.total ? Math.round((taskCounts.completed / taskCounts.total) * 100) : 0;

  const {
    todayRecord, setTodayRecord, isAnimating,
    handleTimeIn, handleLunchOut, handleLunchIn, handleTimeOut,
    getStatus, calculateElapsedTime, calculateWorkDetails,
  } = useAttendance(user?.id || "user");

  const workDetails = calculateWorkDetails();
  const STANDARD_SHIFT_MINUTES = 9 * 60;

  const formatMinutes = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  };

  const formatMs = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getRemainingTime = () => {
    if (!todayRecord?.timeIn) return formatMs(STANDARD_SHIFT_MINUTES * 60000);
    const start = new Date(todayRecord.timeIn).getTime();
    const target = start + STANDARD_SHIFT_MINUTES * 60000;
    const now = todayRecord.timeOut ? new Date(todayRecord.timeOut).getTime() : currentTime.getTime();
    const diff = target - now;
    return diff >= 0 ? formatMs(diff) : `+${formatMs(-diff)}`;
  };

  // ── Rendered hours (excluding break) ──────────────────────────────────────
  const getRenderedHours = (): number => {
    if (!todayRecord?.timeIn) return 0;
    const timeInMs = new Date(todayRecord.timeIn).getTime();
    const nowMs = currentTime.getTime();
    let totalMs = nowMs - timeInMs;

    // Subtract break duration if taken
    if (todayRecord.lunchOut && todayRecord.lunchIn) {
      const breakMs = new Date(todayRecord.lunchIn).getTime() - new Date(todayRecord.lunchOut).getTime();
      totalMs -= Math.max(breakMs, 0);
    }
    return Math.max(totalMs / (1000 * 60 * 60), 0);
  };

  const getRenderedMinutes = (): number => getRenderedHours() * 60;

  // ── Break button: locked before 11 AM ─────────────────────────────────────
  const handleStartBreakClick = () => {
    const hour = currentTime.getHours();
    if (hour < 11) {
      setActiveModal("break-too-early");
      return;
    }
    handleLunchOut();
  };

  // ── Time Out: show early out modal if < 8 hours rendered ──────────────────
  const handleTimeOutClick = () => {
    const rendered = getRenderedHours();
    if (rendered < 8) {
      setActiveModal("early-out");
      return;
    }
    handleTimeOut();
  };

  const handleConfirmEarlyOut = () => {
    setActiveModal(null);
    handleTimeOut();
  };

  // ── Remaining minutes to reach 8 hours ────────────────────────────────────
  const getRemainingMinutesTo8h = (): number => {
    const rendered = getRenderedMinutes();
    return Math.max(Math.round(480 - rendered), 0);
  };

  useEffect(() => {
    const handleResize = () => {
      setTodayRecord((prev: TimeRecord | null) => {
        if (!prev) return null;
        const ua = navigator.userAgent.toLowerCase();
        const screenWidth = window.innerWidth;
        const isMobileUA = /android|iphone|ipod|blackberry|iemobile|opera mini/.test(ua);
        const isTabletUA = /ipad|tablet|playbook|silk/.test(ua);
        const isMobileViewport = screenWidth <= 765;
        const isTabletViewport = screenWidth > 765 && screenWidth <= 1024;
        const hasTouch = () => "ontouchstart" in window || navigator.maxTouchPoints > 0;
        const newDevice = isMobileUA || (isMobileViewport && hasTouch()) ? "Mobile"
          : isTabletUA || isTabletViewport ? "Tablet" : "Desktop";
        if (newDevice !== prev.device) return { ...prev, device: newDevice };
        return prev;
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setTodayRecord]);

  // ── Pending Leaves ──
  const [pendingLeavesByType, setPendingLeavesByType] = useState<Record<string, number>>({
    "Vacation Leave": 0, "Sick Leave": 0, "Emergency Leave": 0, "Maternity/Paternity Leave": 0,
  });
  const totalPendingLeaves = Object.values(pendingLeavesByType).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const loadPendingLeaves = () => {
      const leaveRequests = localStorage.getItem(STORAGE_KEY);
      if (leaveRequests) {
        try {
          const allLeaves = JSON.parse(leaveRequests);
          const userLeaves = Array.isArray(allLeaves)
            ? allLeaves.filter((l: { employee: string }) => l.employee === user?.name)
            : [];
          const pending = userLeaves.filter((l: { status: string }) => l.status === "Pending");
          const byType: Record<string, number> = {
            "Vacation Leave": 0, "Sick Leave": 0, "Emergency Leave": 0, "Maternity/Paternity Leave": 0,
          };
          pending.forEach((l: { type: string }) => {
            if (Object.prototype.hasOwnProperty.call(byType, l.type)) byType[l.type]++;
          });
          setPendingLeavesByType(byType);
        } catch { }
      }
    };
    if (user?.name) {
      loadPendingLeaves();
      const interval = setInterval(loadPendingLeaves, 2000);
      return () => clearInterval(interval);
    }
  }, [user?.name]);

  const detailItems = [
    { label: "Time In",      value: todayRecord?.timeIn,    isTime: true,    textColor: "#1F3C68", bgClass: "from-blue-50 to-blue-100/50",    borderClass: "border-blue-200"   },
    { label: "Start Break",  value: todayRecord?.lunchOut,  isTime: true,    textColor: "#F28C28", bgClass: "from-blue-50 to-blue-100/50",    borderClass: "border-blue-200"   },
    { label: "End Break",    value: todayRecord?.lunchIn,   isTime: true,    textColor: "#F28C28", bgClass: "from-blue-50 to-blue-100/50",    borderClass: "border-blue-200"   },
    { label: "Time Out",     value: todayRecord?.timeOut,   isTime: true,    textColor: "#e91f1f", bgClass: "from-red-50 to-red-100/50",      borderClass: "border-red-200"    },
    { label: "Elapsed Time", value: calculateElapsedTime(), isElapsed: true, textColor: "#F28C28", bgClass: "from-yellow-50 to-yellow-100/50", borderClass: "border-yellow-200" },
    { label: "Regular Hours", value: formatMinutes(workDetails.regularMinutes), isTime: false, textColor: "#16a34a", bgClass: "from-green-50 to-green-100/50", borderClass: "border-green-200" },
    {
      label: "Overtime",
      value: formatMinutes(workDetails.overtimeMinutes),
      isTime: false,
      textColor: workDetails.overtimeMinutes > 0 ? "#e91f1f" : "#94a3b8",
      bgClass: workDetails.overtimeMinutes > 0 ? "from-red-50 to-red-100/50" : "from-slate-50 to-slate-100/50",
      borderClass: workDetails.overtimeMinutes > 0 ? "border-red-200" : "border-slate-200",
    },
    { label: "Device", value: todayRecord?.device || "---", isTime: false, textColor: "#1F3C68", bgClass: "from-blue-50 to-blue-100/50", borderClass: "border-blue-200" },
  ];

  const formatTimeLocal = (date?: string | number | Date) => {
    if (!date) return "--:--";
    return new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const handleLogout = () => { localStorage.removeItem("currentUser"); navigate("/"); };

  const leaveTypeConfig: Record<string, { short: string }> = {
    "Vacation Leave": { short: "Vacation Leave" },
    "Sick Leave": { short: "Sick Leave" },
    "Emergency Leave": { short: "Emergency Leave" },
    "Maternity/Paternity Leave": { short: "Maternity / Paternity Leave" },
  };

  // Is break button active?
  const breakButtonActive = !!todayRecord?.timeIn && !todayRecord?.lunchOut && !todayRecord?.timeOut;
  const isBeforeBreakTime = currentTime.getHours() < 11;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Modals */}
      <AnimatePresence>
        {activeModal === "break-too-early" && (
          <BreakTooEarlyModal
            key="break-modal"
            onClose={() => setActiveModal(null)}
            currentTime={currentTime}
          />
        )}
        {activeModal === "early-out" && (
          <EarlyOutModal
            key="early-out-modal"
            onClose={() => setActiveModal(null)}
            onConfirmEarlyOut={handleConfirmEarlyOut}
            renderedHours={getRenderedHours()}
            remainingMinutes={getRemainingMinutesTo8h()}
          />
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 bg-white shadow-lg flex-col border-r border-slate-200">
        <Usersidebar navigate={navigate} logout={handleLogout} />
      </aside>

      {/* Mobile Sidebar */}
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

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Topbar */}
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white p-3 sm:p-4 md:p-6 rounded-2xl shadow-md border border-slate-100">
          <div className="flex items-center gap-2 sm:gap-4 flex-1">
            <button className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors" onClick={() => setMenuOpen(true)}>
              <Menu className="text-[#1F3C68]" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-[#1F3C68] truncate">
                Welcome, {user?.name || "User"}!
              </h1>
              <p className="text-xs sm:text-sm text-[#1E293B] mt-1 font-medium truncate">
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

        {/* Widgets Grid */}
        <div className="grid gap-4 md:gap-5 lg:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-max">

          {/* ── Time Tracking ── */}
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
            className="col-span-1 lg:col-span-2 bg-white rounded-2xl md:rounded-2.5xl lg:rounded-3xl shadow-xl border-2 border-[#F28C28]/20 overflow-hidden">

            <div className="bg-primary p-3 md:p-4 lg:p-6 text-white">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-3 lg:gap-4">
                <div className="flex items-start md:items-center gap-2 md:gap-2.5 lg:gap-3 min-w-0">
                  <div className="p-1.5 md:p-2 lg:p-3 bg-white/20 backdrop-blur-sm rounded-lg md:rounded-lg lg:rounded-xl flex-shrink-0">
                    <Clock className="w-4 md:w-4.5 lg:w-6 h-4 md:h-4.5 lg:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm md:text-lg lg:text-2xl font-bold">Time Tracking</h2>
                    <p className="text-[10px] md:text-[11px] lg:text-sm text-white/90">Track your daily work hours</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[9px] md:text-[10px] lg:text-sm text-white/80 mb-0.5 md:mb-0.5 lg:mb-1">Status</p>
                  <div className={`flex items-center gap-1.5 md:gap-1.5 lg:gap-2 font-bold whitespace-nowrap ${
                    !todayRecord?.timeIn ? "text-white/60" : todayRecord.timeOut ? "text-red-200" : "text-green-200"
                  }`}>
                    <div className="w-1.5 md:w-1.5 lg:w-2 h-1.5 md:h-1.5 lg:h-2 rounded-full bg-current animate-pulse" />
                    <span className="text-[10px] md:text-xs lg:text-lg">{getStatus()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Circular Progress */}
            <div className="mb-6 flex flex-col lg:flex-row items-center justify-center gap-6">
              <div className={`relative w-36 h-36 flex items-center justify-center transition-all ${
                workDetails.overtimeMinutes > 0
                  ? "drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]"
                  : "drop-shadow-[0_0_20px_rgba(242,140,40,0.4)]"
              }`}>
                <svg className="absolute w-full h-full rotate-[-90deg]">
                  <circle cx="72" cy="72" r="60" stroke="#E2E8F0" strokeWidth="10" fill="transparent" />
                  <motion.circle cx="72" cy="72" r="60"
                    stroke={workDetails.overtimeMinutes > 0 ? "#ef4444" : "#F28C28"}
                    strokeWidth="10" fill="transparent" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 60}
                    strokeDashoffset={2 * Math.PI * 60 * (1 - workDetails.progressPct / 100)}
                    initial={{ strokeDashoffset: 2 * Math.PI * 60 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 60 * (1 - workDetails.progressPct / 100) }}
                    transition={{ duration: 0.6 }}
                  />
                </svg>
                <div className="text-center">
                  <p className="text-xs text-slate-500">Progress</p>
                  <p className={`text-xl font-bold ${workDetails.overtimeMinutes > 0 ? "text-red-500" : "text-[#1F3C68]"}`}>
                    {Math.round(workDetails.progressPct)}%
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                <p className="text-xs text-slate-500 mb-1">
                  {workDetails.overtimeMinutes > 0 ? "Overtime" : "Remaining Time"}
                </p>
                <motion.p key={getRemainingTime()} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className={`text-3xl lg:text-4xl font-bold tabular-nums tracking-wide ${
                    workDetails.overtimeMinutes > 0 ? "text-red-500" : "text-[#1F3C68]"
                  }`}>
                  {getRemainingTime()}
                </motion.p>
                <div className="flex justify-center lg:justify-start gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-slate-400 text-xs">Regular</span>
                    <p className="font-bold text-green-600">{formatMinutes(workDetails.regularMinutes)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Overtime</span>
                    <p className={`font-bold ${workDetails.overtimeMinutes > 0 ? "text-red-500" : "text-slate-400"}`}>
                      {formatMinutes(workDetails.overtimeMinutes)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 md:p-4 lg:p-8">
              {/* Action Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-6">

                {/* Time In */}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleTimeIn} disabled={!!todayRecord?.timeIn}
                  className={`relative overflow-hidden p-2 md:p-3 lg:p-6 rounded-lg md:rounded-xl lg:rounded-2xl font-bold text-white shadow-lg transition-all ${
                    todayRecord?.timeIn ? "bg-slate-300 cursor-not-allowed" : "bg-gradient-to-br from-green-500 to-emerald-600 hover:shadow-2xl hover:shadow-green-500/30"
                  }`}>
                  {isAnimating && !todayRecord?.timeOut && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 2, opacity: 0 }} transition={{ duration: 1 }}
                      className="absolute inset-0 bg-white rounded-full" />
                  )}
                  <div className="relative flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <LogIn className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5" />
                    <span className="text-[10px] md:text-xs lg:text-lg">Time In</span>
                  </div>
                </motion.button>

                {/* Start Break — locked before 11 AM */}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleStartBreakClick}
                  disabled={!todayRecord?.timeIn || !!todayRecord?.lunchOut || !!todayRecord?.timeOut}
                  className={`relative p-2 md:p-3 lg:p-6 rounded-lg md:rounded-xl lg:rounded-2xl font-bold text-white shadow-lg transition-all ${
                    !todayRecord?.timeIn || todayRecord?.lunchOut || todayRecord?.timeOut
                      ? "bg-slate-300 cursor-not-allowed"
                      : isBeforeBreakTime && breakButtonActive
                      ? "bg-gradient-to-br from-amber-400 to-orange-500 cursor-pointer"
                      : "bg-gradient-to-br from-yellow-500 to-secondary"
                  }`}>
                  {/* Lock badge shown before 11 AM */}
                  {breakButtonActive && isBeforeBreakTime && (
                    <span className="absolute -top-1 -right-1 bg-white text-amber-500 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow border border-amber-200 leading-tight">
                      11AM
                    </span>
                  )}
                  <div className="flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <Coffee className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5" />
                    <span className="text-[10px] md:text-xs lg:text-lg">Start Break</span>
                  </div>
                </motion.button>

                {/* End Break */}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleLunchIn}
                  disabled={!todayRecord?.lunchOut || !!todayRecord?.lunchIn || !!todayRecord?.timeOut}
                  className={`p-2 md:p-3 lg:p-6 rounded-lg md:rounded-xl lg:rounded-2xl font-bold text-white shadow-lg transition-all ${
                    !todayRecord?.lunchOut || todayRecord?.lunchIn || todayRecord?.timeOut
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-gradient-to-br from-blue-500 to-indigo-600"
                  }`}>
                  <div className="flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <Clock className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5" />
                    <span className="text-[10px] md:text-xs lg:text-lg">End Break</span>
                  </div>
                </motion.button>

                {/* Time Out — shows early out modal if < 8h */}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleTimeOutClick}
                  disabled={!todayRecord?.timeIn || !!todayRecord?.timeOut}
                  className={`relative overflow-hidden p-2 md:p-3 lg:p-6 rounded-lg md:rounded-xl lg:rounded-2xl font-bold text-white shadow-lg transition-all ${
                    !todayRecord?.timeIn || todayRecord?.timeOut
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-gradient-to-br from-red-500 to-rose-600 hover:shadow-2xl hover:shadow-red-500/30"
                  }`}>
                  {isAnimating && todayRecord?.timeOut && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 2, opacity: 0 }} transition={{ duration: 1 }}
                      className="absolute inset-0 bg-white rounded-full" />
                  )}
                  <div className="relative flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <LogOutIcon className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5" />
                    <span className="text-[10px] md:text-xs lg:text-lg">Time Out</span>
                  </div>
                </motion.button>
              </div>

              {/* Time Details */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-2.5 lg:gap-3">
                {detailItems.map((item, idx) => (
                  <div key={idx} className={`p-2 md:p-2.5 lg:p-4 rounded-md md:rounded-lg lg:rounded-xl border ${item.borderClass} bg-gradient-to-br ${item.bgClass}`}>
                    <p className="text-[9px] md:text-[10px] lg:text-xs text-slate-600 mb-0.5 md:mb-0.5 lg:mb-1 font-medium">{item.label}</p>
                    <p className="text-xs md:text-sm lg:text-lg font-bold tabular-nums" style={{ color: item.textColor }}>
                      {item.isElapsed ? item.value : item.isTime ? formatTimeLocal(item.value ?? undefined) : item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Pending Leave ── */}
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl md:rounded-2.5xl lg:rounded-3xl shadow-lg border border-slate-100 hover:shadow-xl hover:border-[#F28C28]/30 transition-all overflow-hidden flex flex-col">
            <div className="bg-primary p-4 md:p-4 lg:p-5 text-white flex-shrink-0">
              <div className="flex items-center gap-2 md:gap-2.5 lg:gap-3">
                <div className="p-1.5 md:p-2 bg-white/20 backdrop-blur-sm rounded-lg flex-shrink-0">
                  <Clock className="w-4 md:w-4 lg:w-5 h-4 md:h-4 lg:h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs md:text-sm lg:text-base font-bold text-white leading-tight">Pending Leave Requests</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center justify-center w-4 h-4 md:w-5 md:h-5 rounded-full bg-white/30 text-white font-bold text-[9px] md:text-[10px]">
                      {totalPendingLeaves}
                    </span>
                    <p className="text-[9px] md:text-[10px] lg:text-xs text-white/90">
                      request{totalPendingLeaves !== 1 ? "s" : ""} awaiting approval
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-3 md:p-3.5 lg:p-4 space-y-1.5 md:space-y-2">
              {Object.entries(pendingLeavesByType).map(([type, count]) => {
                const hasPending = count > 0;
                const config = leaveTypeConfig[type] ?? { short: type };
                return (
                  <motion.div key={type} initial={false} animate={hasPending ? { scale: [1, 1.02, 1] } : {}} transition={{ duration: 0.3 }}
                    className={`flex items-center justify-between px-2.5 md:px-3 py-2 md:py-2.5 rounded-lg border transition-all ${
                      hasPending ? "bg-slate-100 border-slate-300" : "bg-slate-50 border-slate-100"
                    }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] md:text-xs font-medium truncate ${hasPending ? "text-amber-800" : "text-slate-400"}`}>
                        {config.short}
                      </span>
                    </div>
                    <motion.span key={count} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className={`flex-shrink-0 min-w-[20px] md:min-w-[22px] h-[20px] md:h-[22px] flex items-center justify-center rounded-full text-[9px] md:text-[10px] font-bold ${
                        hasPending ? "bg-primary text-white shadow-sm shadow-primary" : "bg-slate-200 text-slate-400"
                      }`}>
                      {count}
                    </motion.span>
                  </motion.div>
                );
              })}
            </div>

            <div className="px-3 md:px-3.5 lg:px-4 pb-3 md:pb-3.5 lg:pb-4 flex-shrink-0">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/leave", { state: { user } })}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 md:py-2 bg-primary hover:bg-[#16305a] text-white font-semibold rounded-lg transition-colors text-[10px] md:text-xs lg:text-sm shadow-sm">
                <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                View All Leave Requests
              </motion.button>
            </div>
          </motion.div>

          {/* ── Task Summary ── */}
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }}
            className="col-span-1 md:col-span-2 lg:col-span-3 bg-white p-4 md:p-5 lg:p-6 rounded-2xl md:rounded-2.5xl lg:rounded-3xl shadow-md border border-slate-100">
            <div className="flex items-center justify-between mb-4 md:mb-5 lg:mb-6 flex-wrap gap-3">
              <div className="flex items-center gap-2 md:gap-2.5 lg:gap-3">
                <div className="p-2 md:p-2 lg:p-3 bg-[#E0F2FE] rounded-lg md:rounded-lg lg:rounded-xl flex-shrink-0">
                  <BookmarkCheck className="w-4 md:w-4.5 lg:w-6 h-4 md:h-4.5 lg:h-6 text-[#1F3C68]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm md:text-base lg:text-xl font-bold text-[#1F3C68]">Task Summary</h2>
                  <p className="text-[10px] md:text-[11px] lg:text-sm text-slate-500">Your daily task overview</p>
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/tasks", { state: { user } })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold shadow-sm hover:shadow-md transition-all">
                <BookmarkCheck className="w-3.5 h-3.5" />
                View All Tasks
              </motion.button>
            </div>

            {taskCounts.total > 0 && (
              <div className="mb-4 md:mb-5">
                <div className="flex justify-between text-xs font-medium text-slate-500 mb-1.5">
                  <span>Overall Completion</span>
                  <span className="font-bold text-[#1F3C68]">{completionPct}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${completionPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-[#F28C28] to-[#E97638]" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{taskCounts.completed} of {taskCounts.total} tasks complete</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 lg:gap-4">
              <motion.div whileHover={{ y: -2 }} onClick={() => navigate("/tasks", { state: { user } })}
                className="cursor-pointer bg-white p-2.5 md:p-3 lg:p-5 rounded-lg md:rounded-lg lg:rounded-2xl border border-yellow-200 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <Circle className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5 text-yellow-500" />
                  <motion.span key={taskCounts.pending} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="text-lg md:text-xl lg:text-2xl font-bold text-yellow-600 tabular-nums">{taskCounts.pending}</motion.span>
                </div>
                <p className="text-xs md:text-xs lg:text-lg font-semibold text-slate-700">Pending</p>
                <p className="text-[9px] md:text-[9px] lg:text-xs text-slate-500 mt-0.5">Waiting to start</p>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} onClick={() => navigate("/tasks", { state: { user } })}
                className="cursor-pointer bg-white p-2.5 md:p-3 lg:p-5 rounded-lg md:rounded-lg lg:rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <PlayCircle className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5 text-[#1F3C68]" />
                  <motion.span key={taskCounts.inProgress} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="text-lg md:text-xl lg:text-2xl font-bold text-[#1F3C68] tabular-nums">{taskCounts.inProgress}</motion.span>
                </div>
                <p className="text-xs md:text-xs lg:text-lg font-semibold text-slate-700">In Progress</p>
                <p className="text-[9px] md:text-[9px] lg:text-xs text-slate-500 mt-0.5">Currently working</p>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} onClick={() => navigate("/tasks", { state: { user } })}
                className="cursor-pointer bg-white p-2.5 md:p-3 lg:p-5 rounded-lg md:rounded-lg lg:rounded-2xl border border-green-200 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5 text-green-600" />
                  <motion.span key={taskCounts.completed} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="text-lg md:text-xl lg:text-2xl font-bold text-green-600 tabular-nums">{taskCounts.completed}</motion.span>
                </div>
                <p className="text-xs md:text-xs lg:text-lg font-semibold text-slate-700">Completed</p>
                <p className="text-[9px] md:text-[9px] lg:text-xs text-slate-500 mt-0.5">Successfully done</p>
              </motion.div>
            </div>

            {taskCounts.total === 0 && (
              <div className="text-center py-6 text-slate-300">
                <BookmarkCheck className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">No tasks yet</p>
                <p className="text-xs text-slate-300 mt-0.5">Go to Tasks to add your first task</p>
              </div>
            )}
          </motion.div>

        </div>
      </main>
    </div>
  );
}

export default Dashboard;