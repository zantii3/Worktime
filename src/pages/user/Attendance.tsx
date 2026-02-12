import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LayoutDashboard, CalendarDays, ClipboardList, ListTodo, LogOut, Clock, ChevronLeft, ChevronRight, Calendar, History, Timer } from "lucide-react";
import { useClock } from "../../hooks/useClock";
import picture from "/logo.png";

interface AttendanceRecord {
  date: string;
  timeIn: string;
  lunchOut?: string | null;
  lunchIn?: string | null;
  timeOut: string;
  hours: number;
  device: string;
}

function AttendanceApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = location.state?.user || JSON.parse(localStorage.getItem("currentUser") || "null");
  const currentTime = useClock();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const loadAttendanceData = () => {
      const allRecords = [];
      const userId = user?.id || "user";
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Only load records for the current user: attendance_[userId]_[date]
        if (key?.startsWith(`attendance_${userId}_`)) {
          try {
            const record = JSON.parse(localStorage.getItem(key) || "{}");
            allRecords.push(record);
          } catch {
            // Skip invalid records
          }
        }
      }
      // Remove duplicates by date (keep latest)
      const uniqueRecords = Array.from(
        new Map(allRecords.map(r => [r.date, r])).values()
      );
      setAttendanceData(uniqueRecords);
    };

    if (user?.id) {
      loadAttendanceData();
      const interval = setInterval(loadAttendanceData, 2000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleLogout = () => navigate("/");

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 md:h-32 border border-slate-100 bg-slate-50/50" />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const record = attendanceData.find((r) => r.date === dateStr);
      const isToday = new Date().toLocaleDateString("en-CA") === dateStr;

      days.push(
        <div
          key={day}
          className={`h-24 md:h-32 border border-slate-100 p-2 transition-colors hover:bg-slate-50 relative ${
            isToday ? "bg-orange-50/30 border-[#F28C28]/30" : "bg-white"
          }`}
        >
          <span className={`text-sm font-semibold ${isToday ? "text-[#F28C28]" : "text-slate-600"}`}>
            {day}
          </span>
          {record && record.timeIn && (
          <div className="mt-1 space-y-1">
            <div className="text-[10px] md:text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-green-500" />
              IN {new Date(record.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>

            {record.lunchOut && (
              <div className="text-[10px] md:text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-yellow-500" />
                LO {new Date(record.lunchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            {record.lunchIn && (
              <div className="text-[10px] md:text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-blue-500" />
                LI {new Date(record.lunchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            {record.timeOut && (
              <div className="text-[10px] md:text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-red-500" />
                OUT {new Date(record.timeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            {/* Hours */}
            {record.hours > 0 && (
              <div className="text-[10px] font-bold text-[#F28C28] mt-1">
                {record.hours} hrs
              </div>
            )}
          </div>
        )}

        </div>
      );
    }

    return days;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar Desktop */}
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
              <SidebarContent navigate={navigate} logout={handleLogout} close={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

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
              <h1 className="text-xl md:text-3xl font-bold text-[#1F3C68]">Attendance Records</h1>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-[#F28C28] to-[#E67E22] text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Calendar className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold">
                  {currentMonth.toLocaleString("default", { month: "long", year: "numeric" })}
                </h2>
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={prevMonth}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={nextMonth}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-7 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 rounded-xl overflow-hidden border border-slate-100">
                {renderCalendar()}
              </div>
            </div>
          </motion.div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Total Hours Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-3xl shadow-md border-2 border-[#F28C28]/20 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-[#F28C28] to-[#E67E22] p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Timer className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-white/90 text-sm font-medium">Total Hours</p>
                    <p className="text-xs text-white/70">This Month</p>
                  </div>
                </div>
                <h3 className="text-4xl font-bold mb-4">
                  {attendanceData
                    .filter(r => {
                      const d = new Date(r.date);
                      return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
                    })
                    .reduce((acc, curr) => acc + curr.hours, 0)
                    .toFixed(1)} hrs
                </h3>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${Math.min((attendanceData
                        .filter(r => {
                          const d = new Date(r.date);
                          return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
                        })
                        .reduce((acc, curr) => acc + curr.hours, 0) / 160) * 100, 100)}%` 
                    }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                    className="h-full bg-white rounded-full"
                  />
                </div>
                <p className="text-xs text-white/80 mt-2 font-medium">
                  {((attendanceData
                    .filter(r => {
                      const d = new Date(r.date);
                      return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
                    })
                    .reduce((acc, curr) => acc + curr.hours, 0) / 160) * 100).toFixed(0)}% of monthly target (160 hrs)
                </p>
              </div>
            </motion.div>

            {/* Daily Logs */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden flex flex-col h-[500px]"
            >
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-orange-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#F28C28]/10 rounded-xl">
                    <History className="w-5 h-5 text-[#F28C28]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#1F3C68]">Daily Logs</h2>
                    <p className="text-xs text-slate-500">Recent attendance records</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {attendanceData.length > 0 ? (
                  attendanceData
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((record, idx) => (
                      <motion.div 
                        key={idx} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-[#F28C28]/30 hover:shadow-sm transition-all"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-bold text-[#1F3C68]">
                              {new Date(record.date).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              {record.device}
                            </p>
                          </div>
                          <div className="bg-gradient-to-r from-[#F28C28] to-[#E67E22] px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm">
                            {record.hours} hrs
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                         <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Time In</p>
                          <p className="text-sm font-bold text-green-600">
                            {record.timeIn ? new Date(record.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                          </p>
                        </div>

                          <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Lunch Out</p>
                          <p className="text-sm font-bold text-yellow-600">
                            {record.lunchOut ? new Date(record.lunchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                          </p>
                        </div>
                        
                        <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Lunch In</p>
                        <p className="text-sm font-bold text-blue-600">
                          {record.lunchIn ? new Date(record.lunchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Time Out</p>
                      <p className="text-sm font-bold text-red-600">
                        {record.timeOut ? new Date(record.timeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                      </p>
                    </div>
                        </div>
                      </motion.div>
                    ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-12">
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <History className="w-12 h-12 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">No attendance records yet</p>
                    <p className="text-xs text-center max-w-[200px]">Click "Time In" on the dashboard to start tracking your attendance</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
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
      <div className="flex items-center justify-center mb-10">
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

      <nav className="flex flex-col gap-2">
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
            <span className="group-hover:text-[#F28C28] transition-colors">{item.label}</span>
          </motion.button>
        ))}
      </nav>

      <motion.button
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.95 }}
        onClick={logout}
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 font-medium hover:bg-red-50 transition-all"
      >
        <LogOut size={20} />
        <span>Logout</span>
      </motion.button>
    </div>
  );
}

export default AttendanceApp;