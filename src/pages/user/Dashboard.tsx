import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Clock, LogIn, LogOut as LogOutIcon, CheckCircle2, Circle, PlayCircle, BookmarkCheck } from "lucide-react";
import { useClock } from "./hooks/useClock";
import { useAttendance } from "./hooks/useAttendance";
import type { TimeRecord } from "./hooks/useAttendance";
import Usersidebar from "./components/Usersidebar.tsx";

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

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = location.state?.user || JSON.parse(localStorage.getItem("currentUser") || "null");

  const currentTime = useClock();

  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);

  // ── Real task counts from localStorage (same key as TaskPage) ──
  const [taskCounts, setTaskCounts] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0,
    total: 0,
  });

  useEffect(() => {
    const loadTaskCounts = () => {
      const stored = localStorage.getItem(`tasks_${user?.id || "user"}`);
      if (stored) {
        try {
          const tasks: Task[] = JSON.parse(stored);
          setTaskCounts({
            pending: tasks.filter((t) => t.status === "Pending").length,
            inProgress: tasks.filter((t) => t.status === "In Progress").length,
            completed: tasks.filter((t) => t.status === "Completed").length,
            total: tasks.length,
          });
        } catch {
          // skip invalid data
        }
      } else {
        setTaskCounts({ pending: 0, inProgress: 0, completed: 0, total: 0 });
      }
    };

    loadTaskCounts();
    // Poll every 2s so changes from TaskPage reflect immediately
    const interval = setInterval(loadTaskCounts, 2000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const completionPct = taskCounts.total
    ? Math.round((taskCounts.completed / taskCounts.total) * 100)
    : 0;

  const {
  todayRecord,
  setTodayRecord,
  isAnimating,
  handleTimeIn,
  handleLunchOut,
  handleLunchIn,
  handleTimeOut,
  getStatus,
  calculateElapsedTime,
  calculateWorkDetails,
} = useAttendance(user?.id || "user");

const workDetails = calculateWorkDetails();

  const STANDARD_SHIFT_MINUTES = 9 * 60;

  const formatMinutes = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hrs).padStart(2, "0")}:
${String(mins).padStart(2, "0")}`;
  };

  const formatMs = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, "0")}:
${String(mins).padStart(2, "0")}:
${String(secs).padStart(2, "0")}`;
  };

  const getRemainingTime = () => {
    if (!todayRecord?.timeIn) return formatMs(STANDARD_SHIFT_MINUTES * 60000);
    const start = new Date(todayRecord.timeIn).getTime();
    const target = start + STANDARD_SHIFT_MINUTES * 60000;
    const now = todayRecord.timeOut
      ? new Date(todayRecord.timeOut).getTime()
      : currentTime.getTime();
    const diff = target - now;
    if (diff >= 0) {
      return formatMs(diff);
    }
    return `+${formatMs(-diff)}`;
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
        const newDevice = isMobileUA || (isMobileViewport && hasTouch())
          ? "Mobile"
          : isTabletUA || isTabletViewport
          ? "Tablet"
          : "Desktop";
        if (newDevice !== prev.device) return { ...prev, device: newDevice };
        return prev;
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setTodayRecord]);

  useEffect(() => {
    const loadPendingLeaves = () => {
      const leaveRequests = localStorage.getItem(`leave_requests_${user?.id || "user"}`);
      if (leaveRequests) {
        try {
          const leaves = JSON.parse(leaveRequests);
          const pending = leaves.filter((l: { status: string }) => l.status === "Pending").length;
          setPendingLeavesCount(pending);
        } catch {
          // skip invalid data
        }
      }
    };
    if (user?.id) {
      loadPendingLeaves();
      const interval = setInterval(loadPendingLeaves, 2000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const detailItems = [
    { label: "Time In",      value: todayRecord?.timeIn,    isTime: true,    textColor: "#1F3C68", bgClass: "from-blue-50 to-blue-100/50",    borderClass: "border-blue-200"   },
    { label: "Start Break",    value: todayRecord?.lunchOut,  isTime: true,    textColor: "#F28C28", bgClass: "from-blue-50 to-blue-100/50",    borderClass: "border-blue-200"   },
    { label: "End Break",     value: todayRecord?.lunchIn,   isTime: true,    textColor: "#F28C28", bgClass: "from-blue-50 to-blue-100/50",    borderClass: "border-blue-200"   },
    { label: "Time Out",     value: todayRecord?.timeOut,   isTime: true,    textColor: "#e91f1f", bgClass: "from-red-50 to-red-100/50",      borderClass: "border-red-200"    },
    { label: "Elapsed Time", value: calculateElapsedTime(), isElapsed: true, textColor: "#F28C28", bgClass: "from-yellow-50 to-yellow-100/50", borderClass: "border-yellow-200" },
    {
  label: "Regular Hours",
  value: formatMinutes(workDetails.regularMinutes),
  isTime: false,
  textColor: "#16a34a",
  bgClass: "from-green-50 to-green-100/50",
  borderClass: "border-green-200",
},
{
  label: "Overtime",
  value: formatMinutes(workDetails.overtimeMinutes),
  isTime: false,
  textColor:
    workDetails.overtimeMinutes > 0 ? "#e91f1f" : "#94a3b8",
  bgClass:
    workDetails.overtimeMinutes > 0
      ? "from-red-50 to-red-100/50"
      : "from-slate-50 to-slate-100/50",
  borderClass:
    workDetails.overtimeMinutes > 0
      ? "border-red-200"
      : "border-slate-200",
},
    { label: "Device",       value: todayRecord?.device || "---", isTime: false, textColor: "#1F3C68", bgClass: "from-blue-50 to-blue-100/50", borderClass: "border-blue-200" },
  ];

  const formatTimeLocal = (date?: string | number | Date) => {
    if (!date) return "--:--";
    return new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/");
  };


  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 bg-white shadow-lg flex-col border-r border-slate-200">
        <Usersidebar navigate={navigate} logout={handleLogout} />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-black/30 z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 w-64 bg-white h-full shadow-2xl z-50"
            >
              <Usersidebar navigate={navigate} logout={handleLogout} close={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Topbar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white p-3 sm:p-4 md:p-6 rounded-2xl shadow-md border border-slate-100"
        >
          <div className="flex items-center gap-2 sm:gap-4 flex-1">
            <button
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="text-[#1F3C68]" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-[#1F3C68] truncate">
                Welcome, {user?.name || "User"}!
              </h1>
              <p className="text-xs sm:text-sm text-[#1E293B] mt-1 font-medium truncate">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "short", year: "numeric", month: "long", day: "numeric",
                })}
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
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="col-span-1 lg:col-span-2 bg-white rounded-2xl md:rounded-2.5xl lg:rounded-3xl shadow-xl border-2 border-[#F28C28]/20 overflow-hidden"
          >

            {/* 9 Hour Daily Progress */}

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
            {/* ===== Enhanced 9 Hour Timer ===== */}
<div className="mb-6 flex flex-col lg:flex-row items-center justify-center gap-6">

  {/* LEFT: Circular Progress */}
  <div className={`relative w-36 h-36 flex items-center justify-center transition-all ${
  workDetails.overtimeMinutes > 0
    ? "drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]"
    : "drop-shadow-[0_0_20px_rgba(242,140,40,0.4)]"
}`}>

    <svg className="absolute w-full h-full rotate-[-90deg]">
      <circle
        cx="72"
        cy="72"
        r="60"
        stroke="#E2E8F0"
        strokeWidth="10"
        fill="transparent"
      />

      <motion.circle
        cx="72"
        cy="72"
        r="60"
        stroke={
          workDetails.overtimeMinutes > 0 ? "#ef4444" : "#F28C28"
        }
        strokeWidth="10"
        fill="transparent"
        strokeLinecap="round"
        strokeDasharray={2 * Math.PI * 60}
        strokeDashoffset={
          2 * Math.PI * 60 *
          (1 - workDetails.progressPct / 100)
        }
        initial={{ strokeDashoffset: 2 * Math.PI * 60 }}
        animate={{
          strokeDashoffset:
            2 * Math.PI * 60 *
            (1 - workDetails.progressPct / 100),
        }}
        transition={{ duration: 0.6 }}
      />
    </svg>

    {/* Center Text */}
    <div className="text-center">
      <p className="text-xs text-slate-500">Progress</p>
      <p
        className={`text-xl font-bold ${
          workDetails.overtimeMinutes > 0
            ? "text-red-500"
            : "text-[#1F3C68]"
        }`}
      >
        {Math.round(workDetails.progressPct)}%
      </p>
    </div>
  </div>

  {/* RIGHT: Big Timer Info */}
 <div className="flex flex-col items-center lg:items-start text-center lg:text-left">

    <p className="text-xs text-slate-500 mb-1">
      {workDetails.overtimeMinutes > 0
        ? "Overtime"
        : "Remaining Time"}
    </p>

    <motion.p
      key={getRemainingTime()}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`text-3xl lg:text-4xl font-bold tabular-nums tracking-wide ${
        workDetails.overtimeMinutes > 0
          ? "text-red-500"
          : "text-[#1F3C68]"
      }`}
    >
      {getRemainingTime()}
    </motion.p>

    <div className="flex justify-center lg:justify-start gap-4 mt-3 text-sm">
      <div>
        <span className="text-slate-400 text-xs">Regular</span>
        <p className="font-bold text-green-600">
          {formatMinutes(workDetails.regularMinutes)}
        </p>
      </div>
      <div>
        <span className="text-slate-400 text-xs">Overtime</span>
        <p
          className={`font-bold ${
            workDetails.overtimeMinutes > 0
              ? "text-red-500"
              : "text-slate-400"
          }`}
        >
          {formatMinutes(workDetails.overtimeMinutes)}
        </p>
      </div>
    </div>
  </div>
</div>
            <div className="p-3 md:p-4 lg:p-8">
              {/* Action Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-6">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleTimeIn} disabled={!!todayRecord?.timeIn}
                  className={`relative overflow-hidden p-2 md:p-3 lg:p-6 rounded-lg md:rounded-xl lg:rounded-2xl font-bold text-white shadow-lg transition-all ${
                    todayRecord?.timeIn ? "bg-slate-300 cursor-not-allowed" : "bg-gradient-to-br from-green-500 to-emerald-600 hover:shadow-2xl hover:shadow-green-500/30"
                  }`}>
                  {isAnimating && !todayRecord?.timeOut && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 2, opacity: 0 }} transition={{ duration: 1 }} className="absolute inset-0 bg-white rounded-full" />
                  )}
                  <div className="relative flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <LogIn className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5" />
                    <span className="text-[10px] md:text-xs lg:text-lg">Time In</span>
                  </div>
                </motion.button>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleLunchOut}
                  disabled={!todayRecord?.timeIn || !!todayRecord?.lunchOut || !!todayRecord?.timeOut}
                  className={`p-2 md:p-3 lg:p-6 rounded-lg md:rounded-xl lg:rounded-2xl font-bold text-white shadow-lg transition-all ${
                    !todayRecord?.timeIn || todayRecord?.lunchOut || todayRecord?.timeOut ? "bg-slate-300 cursor-not-allowed" : "bg-gradient-to-br from-yellow-500 to-secondary "
                  }`}>
                  <div className="flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <Clock className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5" />
                    <span className="text-[10px] md:text-xs lg:text-lg">Start Break</span>
                  </div>
                </motion.button>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleLunchIn}
                  disabled={!todayRecord?.lunchOut || !!todayRecord?.lunchIn || !!todayRecord?.timeOut}
                  className={`p-2 md:p-3 lg:p-6 rounded-lg md:rounded-xl lg:rounded-2xl font-bold text-white shadow-lg transition-all ${
                    !todayRecord?.lunchOut || todayRecord?.lunchIn || todayRecord?.timeOut ? "bg-slate-300 cursor-not-allowed" : "bg-gradient-to-br from-blue-500 to-indigo-600"
                  }`}>
                  <div className="flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <Clock className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5" />
                    <span className="text-[10px] md:text-xs lg:text-lg">End Break</span>
                  </div>
                </motion.button>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleTimeOut}
                  disabled={!todayRecord?.timeIn || !!todayRecord?.timeOut}
                  className={`relative overflow-hidden p-2 md:p-3 lg:p-6 rounded-lg md:rounded-xl lg:rounded-2xl font-bold text-white shadow-lg transition-all ${
                    !todayRecord?.timeIn || todayRecord?.timeOut ? "bg-slate-300 cursor-not-allowed" : "bg-gradient-to-br from-red-500 to-rose-600 hover:shadow-2xl hover:shadow-red-500/30"
                  }`}>
                  {isAnimating && todayRecord?.timeOut && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 2, opacity: 0 }} transition={{ duration: 1 }} className="absolute inset-0 bg-white rounded-full" />
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
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-4 md:p-5 lg:p-6 rounded-2xl md:rounded-2.5xl lg:rounded-3xl shadow-lg border border-slate-100 hover:shadow-xl hover:border-[#F28C28]/30 transition-all"
          >
            <div className="flex flex-col gap-3 md:gap-3">
              <div className="flex items-start md:items-center gap-2 md:gap-2.5 lg:gap-3">
                <div className="p-2 md:p-2 lg:p-3 bg-amber-100 rounded-lg md:rounded-lg lg:rounded-xl flex-shrink-0">
                  <Clock className="w-4 md:w-4 lg:w-5 h-4 md:h-4 lg:h-5 text-ambe r-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs md:text-sm lg:text-base font-bold text-amber-900">Pending Leave Requests</h3>
                  <p className="text-[9px] md:text-[10px] lg:text-sm text-amber-700">
                    You have {pendingLeavesCount} leave request(s) awaiting approval
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/leave", { state: { user } })}
                className="w-full md:w-auto px-3 md:px-3 lg:px-4 py-1.5 md:py-1.5 lg:py-2 bg-primary hover:bg-primary text-white font-medium rounded-lg transition-colors text-xs md:text-xs lg:text-sm"
              >
                View
              </motion.button>  
            </div>
          </motion.div>

          {/* ── Task Summary ── (wired to real localStorage tasks) */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="col-span-1 md:col-span-2 lg:col-span-3 bg-white p-4 md:p-5 lg:p-6 rounded-2xl md:rounded-2.5xl lg:rounded-3xl shadow-md border border-slate-100"
          >
            {/* Header */}
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

              {/* Go to Tasks shortcut */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/tasks", { state: { user } })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold shadow-sm hover:shadow-md transition-all"
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
                View All Tasks
              </motion.button>
            </div>

            {/* Progress bar */}
            {taskCounts.total > 0 && (
              <div className="mb-4 md:mb-5">
                <div className="flex justify-between text-xs font-medium text-slate-500 mb-1.5">
                  <span>Overall Completion</span>
                  <span className="font-bold text-[#1F3C68]">{completionPct}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-[#F28C28] to-[#E97638]"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {taskCounts.completed} of {taskCounts.total} tasks complete
                </p>
              </div>
            )}

            {/* Task Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 lg:gap-4">

              {/* Pending */}
              <motion.div
                whileHover={{ y: -2 }}
                onClick={() => navigate("/tasks", { state: { user } })}
                className="cursor-pointer bg-white p-2.5 md:p-3 lg:p-5 rounded-lg md:rounded-lg lg:rounded-2xl border border-yellow-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <Circle className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5 text-yellow-500" />
                  <motion.span
                    key={taskCounts.pending}
                    initial={{ scale: 1.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-lg md:text-xl lg:text-2xl font-bold text-yellow-600 tabular-nums"
                  >
                    {taskCounts.pending}
                  </motion.span>
                </div>
                <p className="text-xs md:text-xs lg:text-lg font-semibold text-slate-700">Pending</p>
                <p className="text-[9px] md:text-[9px] lg:text-xs text-slate-500 mt-0.5">Waiting to start</p>
              </motion.div>

              {/* In Progress */}
              <motion.div
                whileHover={{ y: -2 }}
                onClick={() => navigate("/tasks", { state: { user } })}
                className="cursor-pointer bg-white p-2.5 md:p-3 lg:p-5 rounded-lg md:rounded-lg lg:rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <PlayCircle className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5 text-[#1F3C68]" />
                  <motion.span
                    key={taskCounts.inProgress}
                    initial={{ scale: 1.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-lg md:text-xl lg:text-2xl font-bold text-[#1F3C68] tabular-nums"
                  >
                    {taskCounts.inProgress}
                  </motion.span>
                </div>
                <p className="text-xs md:text-xs lg:text-lg font-semibold text-slate-700">In Progress</p>
                <p className="text-[9px] md:text-[9px] lg:text-xs text-slate-500 mt-0.5">Currently working</p>
              </motion.div>

              {/* Completed */}
              <motion.div
                whileHover={{ y: -2 }}
                onClick={() => navigate("/tasks", { state: { user } })}
                className="cursor-pointer bg-white p-2.5 md:p-3 lg:p-5 rounded-lg md:rounded-lg lg:rounded-2xl border border-green-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-3.5 md:w-4 lg:w-5 h-3.5 md:h-4 lg:h-5 text-green-600" />
                  <motion.span
                    key={taskCounts.completed}
                    initial={{ scale: 1.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-lg md:text-xl lg:text-2xl font-bold text-green-600 tabular-nums"
                  >
                    {taskCounts.completed}
                  </motion.span>
                </div>
                <p className="text-xs md:text-xs lg:text-lg font-semibold text-slate-700">Completed</p>
                <p className="text-[9px] md:text-[9px] lg:text-xs text-slate-500 mt-0.5">Successfully done</p>
              </motion.div>

            </div>

            {/* Empty state */}
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