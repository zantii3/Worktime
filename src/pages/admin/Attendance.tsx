import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import attendanceRecords from "../../data/attendanceRecords.json";
import employees from "../../data/employees.json";
import AdminAttendanceCalendar, {
  type AttendanceRecord,
} from "./components/AdminAttendanceCalendar";

type Employee = { id: string; name: string };

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

function formatFullDate(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
}

function formatTime(iso: string | null) {
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
  // (out - in) - (lunchIn - lunchOut)
  const gross = minutesBetween(r.timeIn, r.timeOut);
  const lunch = minutesBetween(r.lunchOut, r.lunchIn);
  return Math.max(0, gross - lunch);
}

function formatHours(mins: number) {
  const hrs = mins / 60;
  return hrs.toFixed(1);
}

export default function Attendance() {
  const employeeList = employees as Employee[];
  const allRecords = attendanceRecords as AttendanceRecord[];

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeList[0]?.id ?? "");
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  const [selectedDateISO, setSelectedDateISO] = useState<string>(toISODate(new Date()));

  // realtime clock (badge at top-right like screenshot)
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // If selected day is not in the viewed month, align month view to selected date
  useEffect(() => {
    const d = new Date(selectedDateISO + "T00:00:00");
    if (!isSameMonth(d, viewMonth)) setViewMonth(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateISO]);

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

  const selectedDayRecord = useMemo(() => {
    return recordsForEmployee.find((r) => r.dateISO === selectedDateISO) ?? null;
  }, [recordsForEmployee, selectedDateISO]);

  const monthTotalMinutes = useMemo(() => {
    return recordsForMonth.reduce((sum, r) => sum + computeWorkMinutes(r), 0);
  }, [recordsForMonth]);

  const targetMinutes = 160 * 60;
  const progressPct = Math.min(100, Math.round((monthTotalMinutes / targetMinutes) * 100));

  function prevMonth() {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  const selectedEmployee = employeeList.find((e) => e.id === selectedEmployeeId);

  const dailyMinutes = selectedDayRecord ? computeWorkMinutes(selectedDayRecord) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="p-6 space-y-6"
    >
      {/* Header card like screenshot */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-text-heading">Attendance Records</div>
          <div className="text-sm text-text-primary/70">
            {formatFullDate(selectedDateISO)}
          </div>

          {/* Admin filter: employee selector */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-text-primary/70">
              Employee
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-text-heading outline-none focus:ring-2 focus:ring-orange-300"
            >
              {employeeList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>

            <span className="text-xs text-text-primary/60">
              Viewing: <span className="font-semibold">{selectedEmployee?.name}</span>
            </span>
          </div>
        </div>

        {/* Clock badge */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <span>🕒</span>
          <span>
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar (left / big) */}
        <div className="lg:col-span-2">
          <AdminAttendanceCalendar
            viewMonth={viewMonth}
            selectedDateISO={selectedDateISO}
            onSelectDateISO={setSelectedDateISO}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            recordsForMonth={recordsForMonth}
          />
        </div>

        {/* Right side cards */}
        <div className="lg:col-span-1 space-y-6">
          {/* Total hours card */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl overflow-hidden border border-orange-200 shadow-sm"
          >
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold opacity-90">Total Hours</div>
                  <div className="text-xs opacity-80">This Month</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  ⏱️
                </div>
              </div>

              <div className="mt-4 text-4xl font-extrabold">{formatHours(monthTotalMinutes)} hrs</div>

              <div className="mt-4 h-2 rounded-full bg-white/25 overflow-hidden">
                <div
                  className="h-full bg-white"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-2 text-xs opacity-90">
                {progressPct}% of monthly target (160 hrs)
              </div>
            </div>
          </motion.div>

          {/* Daily logs card */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="rounded-2xl bg-card border border-slate-200 shadow-sm"
          >
            <div className="p-5 border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-orange-50 flex items-center justify-center">🧾</div>
                  <div>
                    <div className="font-bold text-text-heading">Daily Logs</div>
                    <div className="text-xs text-text-primary/70">Selected day attendance record</div>
                  </div>
                </div>
              </div>

              <div className="text-xs font-bold rounded-full bg-orange-50 text-orange-700 px-3 py-1">
                {selectedDayRecord ? `${formatHours(dailyMinutes)} hrs` : "0 hrs"}
              </div>
            </div>

            <div className="p-5">
              {!selectedDayRecord ? (
                <div className="text-sm text-text-primary/70">
                  No logs for <span className="font-semibold">{selectedDateISO}</span>.
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-text-heading">
                        {new Date(selectedDayRecord.dateISO + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "2-digit",
                        })}
                      </div>
                      <div className="text-xs text-text-primary/70">• {selectedDayRecord.source}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-[10px] font-bold text-slate-500">TIME IN</div>
                      <div className="text-sm font-extrabold text-green-700">
                        {formatTime(selectedDayRecord.timeIn)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-[10px] font-bold text-slate-500">LUNCH OUT</div>
                      <div className="text-sm font-extrabold text-yellow-700">
                        {formatTime(selectedDayRecord.lunchOut)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-[10px] font-bold text-slate-500">LUNCH IN</div>
                      <div className="text-sm font-extrabold text-blue-700">
                        {formatTime(selectedDayRecord.lunchIn)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-[10px] font-bold text-slate-500">TIME OUT</div>
                      <div className="text-sm font-extrabold text-red-700">
                        {formatTime(selectedDayRecord.timeOut)}
                      </div>
                    </div>
                  </div>

                  
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
// to add
// Export CSV / Print report (month / date range / employee)
// Edit attendance (admin correction modal: adjust IN/OUT, lunch, add remark)
// Attendance indicators on calendar (e.g., late/absent highlights)
// Filters (department, status, only incomplete logs)