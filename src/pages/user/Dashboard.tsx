import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  ListTodo,
  LogOut,
  Clock,
  LogIn,
  LogOut as LogOutIcon,
  CheckCircle2,
  Circle,
  PlayCircle,
} from "lucide-react";
import { useClock } from "../../hooks/useClock";
import picture from "/logo.png";

interface TimeRecord {
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  device: string;
  hours: number;
}

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = location.state?.user;

  const currentTime = useClock();

  const [menuOpen, setMenuOpen] = useState(false);
  const [todayRecord, setTodayRecord] = useState<TimeRecord | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD format

  // Load today's record from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`attendance_${user?.id || "user"}_${today}`);
    if (stored) {
      setTodayRecord(JSON.parse(stored));
    } else {
      setTodayRecord({
        date: today,
        timeIn: null,
        timeOut: null,
        device: detectDevice(),
        hours: 0,
      });
    }
  }, [today, user]);

  // Save to localStorage whenever todayRecord changes
  useEffect(() => {
    if (todayRecord) {
      localStorage.setItem(
        `attendance_${user?.id || "user"}_${today}`,
        JSON.stringify(todayRecord)
      );
    }
  }, [todayRecord, today, user]);

  // Detect device
  const detectDevice = () => {
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) return "Mobile";
    if (/tablet/i.test(ua)) return "Tablet";
    return "Desktop";
  };

  const handleTimeIn = () => {
    if (todayRecord?.timeIn) return; // Already clocked in today
    
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1000);

    const now = new Date();
    setTodayRecord({
      ...todayRecord!,
      timeIn: now.toISOString(),
      device: detectDevice(),
    });
  };

  const handleTimeOut = () => {
    if (!todayRecord?.timeIn || todayRecord?.timeOut) return; // Must be clocked in first
    
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1000);

    const now = new Date();
    const timeInDate = new Date(todayRecord.timeIn);
    const hours = (now.getTime() - timeInDate.getTime()) / 1000 / 60 / 60;

    setTodayRecord({
      ...todayRecord,
      timeOut: now.toISOString(),
      hours: parseFloat(hours.toFixed(2)),
    });
  };

  const getStatus = () => {
    if (!todayRecord?.timeIn) return "Not Clocked In";
    if (todayRecord.timeOut) return "Clocked Out";
    return "Clocked In";
  };

  const getStatusColor = () => {
    if (!todayRecord?.timeIn) return "text-slate-400";
    if (todayRecord.timeOut) return "text-red-500";
    return "text-green-500";
  };

  const calculateElapsedTime = () => {
    if (!todayRecord?.timeIn) return "0h 0m";
    
    const timeInDate = new Date(todayRecord.timeIn);
    const now = todayRecord.timeOut ? new Date(todayRecord.timeOut) : new Date();
    
    const diff = now.getTime() - timeInDate.getTime();
    const hours = Math.floor(diff / 1000 / 60 / 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    
    return `${hours}h ${minutes}m`;
  };

  const handleLogout = () => navigate("/");

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 bg-white shadow-lg flex-col border-r border-slate-200">
        <SidebarContent navigate={navigate} logout={handleLogout} />
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
              <SidebarContent
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
                Welcome back, {user?.name || "User"}!
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
              <div className="grid grid-cols-2 gap-4 mb-6">
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-xl border border-blue-200">
                  <p className="text-xs text-slate-600 mb-1 font-medium">
                    Time In
                  </p>
                  <p className="text-lg font-bold text-[#1F3C68] tabular-nums">
                    {todayRecord?.timeIn
                      ? new Date(todayRecord.timeIn).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--"}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 p-4 rounded-xl border border-rose-200">
                  <p className="text-xs text-slate-600 mb-1 font-medium">
                    Time Out
                  </p>
                  <p className="text-lg font-bold text-rose-600 tabular-nums">
                    {todayRecord?.timeOut
                      ? new Date(todayRecord.timeOut).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--"}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-xl border border-[#F28C28]/30">
                  <p className="text-xs text-slate-600 mb-1 font-medium">
                    Elapsed Time
                  </p>
                  <p className="text-lg font-bold text-[#F28C28] tabular-nums">
                    {calculateElapsedTime()}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-600 mb-1 font-medium">
                    Device
                  </p>
                  <p className="text-lg font-bold text-slate-700">
                    {todayRecord?.device || "---"}
                  </p>
                </div>
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
              <div className="p-3 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl">
                <ClipboardList className="w-6 h-6 text-[#F28C28]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1F3C68]">
                  Pending Leave
                </h2>
                <p className="text-xs text-slate-500">
                  Awaiting approval
                </p>
              </div>
            </div>
            <div className="flex items-end gap-2 mb-4">
              <p className="text-5xl font-bold text-[#F28C28]">1</p>
              <p className="text-sm text-slate-500 mb-2">total request</p>
            </div>
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Vacation L</span>
                <span className="font-semibold text-[#F28C28]">1</span>
              </div>
            </div>
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
        <div className="flex justify-between text-xs text-slate-600">
          <span>💼 Work</span>
          <span className="font-medium text-yellow-600">2</span>
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span>👤 Personal</span>
          <span className="font-medium text-yellow-600">1</span>
        </div>
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
        <div className="flex justify-between text-xs text-slate-600">
          <span>💼 Work</span>
          <span className="font-medium text-[#1F3C68]">1</span>
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span>📂 Project</span>
          <span className="font-medium text-[#1F3C68]">1</span>
        </div>
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
        <div className="flex justify-between text-xs text-slate-600">
          <span>💼 Work</span>
          <span className="font-medium text-green-600">3</span>
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span>👤 Personal</span>
          <span className="font-medium text-green-600">2</span>
        </div>
      </div>
    </motion.div>
  </div>
</motion.div>

        </div>
      </main>
    </div>
  );
}

/* Sidebar Component */
function SidebarContent({
  navigate,
  logout,
  close,
}: {
  navigate: (path: string) => void;
  logout: () => void;
  close?: () => void;
}) {
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: CalendarDays, label: "Attendance", path: "/attendance" },
    { icon: ClipboardList, label: "Leave", path: "/leave" },
    { icon: ListTodo, label: "Task", path: "/task" },
  ];

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-center mb-10 ">
        <motion.img
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          src={picture}
          alt="Logo"
          className="w-20 md:w-20 lg:w-28 h-auto object-contain"
        />
        {close && (
          <motion.button
            whileHover={{ rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={close}
           className="absolute top-0 right-0 mt-2 mr-2 p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="text-slate-600" />
          </motion.button>
        )}
      </div>  

      <nav className="flex flex-col gap-2 flex-1">
        {navItems.map((item, index) => (
          <motion.button
            key={item.path}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ x: 4, backgroundColor: "rgba(242, 140, 40, 0.1)" }}
            onClick={() => {
              navigate(item.path);
              close?.();
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#1E293B] font-medium transition-all group"
          >
            <item.icon
              size={20}
              className="text-slate-500 group-hover:text-[#F28C28] transition-colors"
            />
            <span className="group-hover:text-[#F28C28] transition-colors">
              {item.label}
            </span>
          </motion.button>
        ))}
      </nav>

      <motion.button
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.95 }}
        onClick={logout}
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 font-medium hover:bg-red-50 transition-all mt-auto"
      >
        <LogOut size={20} />
        <span>Logout</span>
      </motion.button>
    </div>
  );
}

export default Dashboard;