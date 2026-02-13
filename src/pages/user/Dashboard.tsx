import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Clock, LogIn, LogOut as LogOutIcon, CheckCircle2, Circle, PlayCircle, ListTodo } from "lucide-react";
import { useClock } from "./hooks/useClock";
import { useAttendance } from "./hooks/useAttendance";
import type { TimeRecord } from "./hooks/useAttendance";
import Usersidebar from "./components/Usersidebar.tsx";

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = location.state?.user || JSON.parse(localStorage.getItem("currentUser") || "null");

  const currentTime = useClock();

  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);

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
  } = useAttendance(user?.id || "user");

  // (device detection is handled inside the attendance hook)
  // Handle window resize to update device type (update record via hook)
  useEffect(() => {
    const handleResize = () => {
      setTodayRecord((prev: TimeRecord | null) => {
        if (!prev) return null;
        const ua = navigator.userAgent.toLowerCase();
        const screenWidth = window.innerWidth;
        const isMobileUA = /android|iphone|ipod|blackberry|iemobile|opera mini/.test(ua);
        const isTabletUA = /ipad|tablet|playbook|silk/.test(ua);
        const isMobileViewport = screenWidth <= 768;
        const isTabletViewport = screenWidth > 768 && screenWidth <= 1024;
        const hasTouch = () => "ontouchstart" in window || navigator.maxTouchPoints > 0;
        const newDevice = isMobileUA || (isMobileViewport && hasTouch()) ? "Mobile" : isTabletUA || isTabletViewport ? "Tablet" : "Desktop";
        if (newDevice !== prev.device) return { ...prev, device: newDevice };
        return prev;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setTodayRecord]);

  // Load pending leaves count
  useEffect(() => {
    const loadPendingLeaves = () => {
      const leaveRequests = localStorage.getItem(`leave_requests_${user?.id || "user"}`);
      if (leaveRequests) {
        try {
          const leaves = JSON.parse(leaveRequests);
          const pending = leaves.filter((l: { status: string }) => l.status === "Pending").length;
          setPendingLeavesCount(pending);
        } catch {
          // Skip invalid data
        }
      }
    };

    if (user?.id) {
      loadPendingLeaves();
      const interval = setInterval(loadPendingLeaves, 2000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  // Prepare detail items for rendering
  const detailItems = [
    { label: "Time In", value: todayRecord?.timeIn, isTime: true,  textColor: "#1F3C68", bgClass: "from-blue-50 to-blue-100/50", borderClass: "border-blue-200" },
    { label: "Lunch Out", value: todayRecord?.lunchOut, isTime: true,textColor: "#F28C28", bgClass: "from-blue-50 to-blue-100/50",borderClass: "border-blue-200"},
    { label: "Lunch In", value: todayRecord?.lunchIn, isTime: true, textColor: "#F28C28", bgClass: "from-blue-50 to-blue-100/50", borderClass: "border-blue-200" },
    { label: "Time Out", value: todayRecord?.timeOut, isTime: true, textColor: "#e91f1f", bgClass: "from-red-50 to-red-100/50", borderClass: "border-red-200" },
    { label: "Elapsed Time", value: calculateElapsedTime(), isElapsed: true, textColor: "#F28C28" , bgClass: "from-yellow-50 to-yellow-100/50", borderClass: "border-yellow-200" }, 
    { label: "Device", value: todayRecord?.device || "---", isTime: false, textColor: "#1F3C68", bgClass: "from-blue-50 to-blue-100/50", borderClass: "border-blue-200"},
  ];

  const formatTimeLocal = (date?: string | number | Date) => {
    if (!date) return "--:--";
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
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
              <Usersidebar
                navigate={navigate}
                logout={handleLogout}
                close={() => setMenuOpen(false)}
              />
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
          className="flex justify-between items-center mb-8 bg-white p-4 md:p-6 rounded-2xl shadow-md border border-slate-100"
        >
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="text-[#1F3C68]" />
            </button>

            <div>
              <h1 className="text-xl md:text-3xl font-bold text-[#1F3C68]">
                Welcome, {user?.name || "User"}!
              </h1>
              <p className="text-sm text-[#1E293B] mt-1 font-medium">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 bg-gradient-to-r from-[#F28C28] to-[#E67E22] text-white px-6 py-3 rounded-xl shadow-lg">
            <Clock className="w-5 h-5" />
            <p className="font-bold text-lg tabular-nums">
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          </div>
        </motion.div>
        {/* Widgets Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Time Tracking - Featured */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="md:col-span-2 bg-white rounded-3xl shadow-xl border-2 border-[#F28C28]/20 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-[#F28C28] to-[#E67E22] p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Time Tracking</h2>
                    <p className="text-sm text-white/90">
                      Track your daily work hours
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-white/80 mb-1">Status</p>
                  <div className={`flex items-center gap-2 font-bold ${
                    !todayRecord?.timeIn 
                      ? "text-white/60" 
                      : todayRecord.timeOut 
                        ? "text-red-200" 
                        : "text-green-200"
                  }`}>
                    <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    <span className="text-lg">{getStatus()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8">
              {/* Action Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTimeIn}
                  disabled={!!todayRecord?.timeIn}
                  className={`relative overflow-hidden p-6 rounded-2xl font-bold text-white shadow-lg transition-all ${
                    todayRecord?.timeIn
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-gradient-to-br from-green-500 to-emerald-600 hover:shadow-2xl hover:shadow-green-500/30"
                  }`}
                >
                  {isAnimating && !todayRecord?.timeOut && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 2, opacity: 0 }}
                      transition={{ duration: 1 }}
                      className="absolute inset-0 bg-white rounded-full"
                    />
                  )}
                  <div className="relative flex items-center justify-center gap-2">
                    <LogIn className="w-5 h-5" />
                    <span className="text-lg">Time In</span>
                  </div>
                </motion.button>
                <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLunchOut}
                disabled={
                  !todayRecord?.timeIn ||
                  !!todayRecord?.lunchOut ||
                  !!todayRecord?.timeOut
                }
                className={`p-6 rounded-2xl font-bold text-white shadow-lg transition-all ${
                  !todayRecord?.timeIn ||
                  todayRecord?.lunchOut ||
                  todayRecord?.timeOut
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-gradient-to-br from-yellow-500 to-orange-500"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span className="text-lg">Lunch Out</span>
                </div>
              </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLunchIn}
                  disabled={
                    !todayRecord?.lunchOut ||
                    !!todayRecord?.lunchIn ||
                    !!todayRecord?.timeOut
                  }
                  className={`p-6 rounded-2xl font-bold text-white shadow-lg transition-all ${
                    !todayRecord?.lunchOut ||
                    todayRecord?.lunchIn ||
                    todayRecord?.timeOut
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-gradient-to-br from-blue-500 to-indigo-600"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span className="text-lg">Lunch In</span>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTimeOut}
                  disabled={!todayRecord?.timeIn || !!todayRecord?.timeOut}
                  className={`relative overflow-hidden p-6 rounded-2xl font-bold text-white shadow-lg transition-all ${
                    !todayRecord?.timeIn || todayRecord?.timeOut
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-gradient-to-br from-red-500 to-rose-600 hover:shadow-2xl hover:shadow-red-500/30"
                  }`}
                >
                  {isAnimating && todayRecord?.timeOut && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 2, opacity: 0 }}
                      transition={{ duration: 1 }}
                      className="absolute inset-0 bg-white rounded-full"
                    />
                  )}
                  <div className="relative flex items-center justify-center gap-2">
                    <LogOutIcon className="w-5 h-5" />
                    <span className="text-lg">Time Out</span>
                  </div>
                </motion.button>
              </div>

              {/* Time Details */}
             <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {detailItems.map((item, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border ${item.borderClass} bg-gradient-to-br ${item.bgClass}`}
              >
                <p className="text-xs text-slate-600 mb-1 font-medium">{item.label}</p>
                <p
                  className={`text-lg font-bold tabular-nums`}
                  style={{ color: item.textColor }}
                >
                  {item.isElapsed
                    ? item.value
                    : item.isTime
                    ? formatTimeLocal(item.value ?? undefined)
                    : item.value}
                </p>
              </div>
            ))}
          </div>

            </div>
          </motion.div>

          {/* Pending Leave */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 hover:shadow-xl hover:border-[#F28C28]/30 transition-all"
          >
            <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-amber-900">Pending Leave Requests</h3>
                <p className="text-xs md:text-sm text-amber-700">You have {pendingLeavesCount} leave request(s) awaiting approval</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/leave", { state: { user } })}
              className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors text-sm"
            >
              View
            </motion.button>
            </div>
            {/* Pending Leaves Alert */}
        {pendingLeavesCount > 0 && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/leave", { state: { user } })}>
            </motion.button>
          </motion.div>
        )}  
          </motion.div>

         {/* Task Summary */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="md:col-span-2 lg:col-span-3 bg-white p-6 rounded-3xl shadow-md border border-slate-100"
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#E0F2FE] rounded-xl"> {/* subtle blue background for icon */}
              <ListTodo className="w-6 h-6 text-[#1F3C68]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1F3C68]">Task Summary</h2>
              <p className="text-sm text-slate-500">Your daily task overview</p>
            </div>
          </div>

          {/* Task Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pending */}
            <motion.div
              whileHover={{ y: -2 }}
              className="bg-white p-5 rounded-2xl border border-yellow-200 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <Circle className="w-5 h-5 text-yellow-600" />
                <span className="text-2xl font-bold text-yellow-600">3</span>
              </div>
              <p className="text-slate-700 font-semibold text-lg">Pending</p>
              <p className="text-xs text-slate-500 mt-1 mb-3">Waiting to start</p>
              <div className="border-t border-yellow-100 pt-2 space-y-1">
              </div>
            </motion.div>

            {/* In Progress */}
            <motion.div
              whileHover={{ y: -2 }}
              className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <PlayCircle className="w-5 h-5 text-[#1F3C68]" />
                <span className="text-2xl font-bold text-[#1F3C68]">2</span>
              </div>
              <p className="text-slate-700 font-semibold text-lg">In Progress</p>
              <p className="text-xs text-slate-500 mt-1 mb-3">Currently working</p>
              <div className="border-t border-blue-100 pt-2 space-y-1">
              </div>
            </motion.div>

            {/* Completed */}
            <motion.div
              whileHover={{ y: -2 }}
              className="bg-white p-5 rounded-2xl border border-green-200 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">5</span>
              </div>
              <p className="text-slate-700 font-semibold text-lg">Completed</p>
              <p className="text-xs text-slate-500 mt-1 mb-3">Successfully done</p>
              <div className="border-t border-green-100 pt-2 space-y-1">
              </div>
            </motion.div>
        </div>
      </motion.div>

        </div>
      </main>
    </div>
  );
}
export default Dashboard;