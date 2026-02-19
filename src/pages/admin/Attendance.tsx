import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import accounts from "../data/accounts.json";
import adminAccounts from "./data/adminAccounts.json";
import AdminAttendanceCalendar, {
  type AttendanceRecord,
} from "./components/AdminAttendanceCalendar";
import { Clock, Timer, Receipt, X } from "lucide-react";

type Account = { id: number; email: string; password: string; name: string };

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

// Convert ISO string -> input[type=datetime-local] value (local time)
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

// Convert datetime-local input -> ISO string
function localInputToISO(val: string) {
  if (!val) return null;
  const d = new Date(val);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

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

function isValidISODateText(s: string) {
  // expects YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  return Number.isFinite(d.getTime()) && toISODate(d) === s;
}

export default function Attendance() {
  // ✅ Use accounts.json as employee list
  const employeeList = useMemo(() => {
  const admins = (adminAccounts as Account[]).map(a => ({
    id: String(a.id),
    name: `${a.name} (Admin)`,
  }));

  const users = (accounts as Account[]).map(u => ({
    id: String(u.id),
    name: `${u.name} (User)`,
  }));

  return [...admins, ...users];
}, []);

  const ATTENDANCE_KEY = "worktime_attendance_v1";

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

  // optional: live sync when another tab changes attendance
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ATTENDANCE_KEY) setAllRecords(readAttendance());
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

  // ✅ Date search bar state
  const [dateQuery, setDateQuery] = useState<string>(selectedDateISO);
  const [dateError, setDateError] = useState<string>("");

  // realtime clock (badge at top-right)
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Keep date search input synced when date changes (calendar click etc.)
  useEffect(() => {
    setDateQuery(selectedDateISO);
  }, [selectedDateISO]);

  // If selected day is not in the viewed month, align month view to selected date
  useEffect(() => {
    const d = new Date(selectedDateISO + "T00:00:00");
    if (!isSameMonth(d, viewMonth)) setViewMonth(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateISO]);

  // If accounts list changes (rare), ensure selected employee still exists
  useEffect(() => {
    if (!employeeList.length) return;
    const exists = employeeList.some((e) => e.id === selectedEmployeeId);
    if (!exists) setSelectedEmployeeId(employeeList[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeList.length]);

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

  // ✅ Attendance Overview (Month)
  const monthOverview = useMemo(() => {
    const byDate = new Map<string, AttendanceRecord>();
    for (const r of recordsForMonth) {
      if (!byDate.has(r.dateISO)) byDate.set(r.dateISO, r);
    }

    let presentDays = 0;
    let absentDays = 0;
    let incompleteDays = 0;

    for (const r of byDate.values()) {
      const hasAny = !!r.timeIn || !!r.timeOut || !!r.lunchIn || !!r.lunchOut;

      if (!hasAny) {
        absentDays += 1;
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
  }, [recordsForMonth, monthTotalMinutes]);

  const targetMinutes = 160 * 60;
  const progressPct = Math.min(
    100,
    Math.round((monthTotalMinutes / targetMinutes) * 100)
  );

  function prevMonth() {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  const selectedEmployee = employeeList.find((e) => e.id === selectedEmployeeId);
  const dailyMinutes = selectedDayRecord ? computeWorkMinutes(selectedDayRecord) : 0;

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
      "Source",
      "Time In",
      "Lunch Out",
      "Lunch In",
      "Time Out",
      "Work Hours",
    ];

    const rows = recordsForMonth
      .slice()
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
      .map((r) => [
        selectedEmployeeId,
        selectedEmployee?.name ?? "",
        monthLabel,
        r.dateISO,
        (r as any).source ?? "",
        r.timeIn ?? "",
        r.lunchOut ?? "",
        r.lunchIn ?? "",
        r.timeOut ?? "",
        formatHours(computeWorkMinutes(r)),
      ]);

    const csv =
      [header, ...rows].map((r) => r.map(safeTextCSV).join(",")).join("\n") +
      "\n";

    downloadCSV(
      `attendance_${selectedEmployeeId}_${toISODate(startOfMonth(viewMonth))}.csv`,
      csv
    );
  }

  function printReport() {
    window.print();
  }

  function goToDate() {
    const q = dateQuery.trim();
    if (!isValidISODateText(q)) {
      setDateError("Use YYYY-MM-DD (e.g. 2026-02-19).");
      return;
    }
    setDateError("");
    setSelectedDateISO(q);
  }

  // Admin Edit Modal
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
    if (!selectedDayRecord) return;

    setEditDraft({
      dateISO: selectedDayRecord.dateISO,
      source: (selectedDayRecord as any).source ?? "",
      timeIn: isoToLocalInput(selectedDayRecord.timeIn),
      lunchOut: isoToLocalInput(selectedDayRecord.lunchOut),
      lunchIn: isoToLocalInput(selectedDayRecord.lunchIn),
      timeOut: isoToLocalInput(selectedDayRecord.timeOut),
    });
    setEditOpen(true);
  }

  function saveEdit() {
    if (!selectedDayRecord) return;

    setAllRecords((prev) =>
      prev.map((r) => {
        if (r.employeeId !== selectedEmployeeId) return r;
        if (r.dateISO !== editDraft.dateISO) return r;

        return {
          ...r,
          timeIn: localInputToISO(editDraft.timeIn),
          lunchOut: localInputToISO(editDraft.lunchOut),
          lunchIn: localInputToISO(editDraft.lunchIn),
          timeOut: localInputToISO(editDraft.timeOut),
          ...(typeof (r as any).source !== "undefined" || editDraft.source
            ? { source: editDraft.source }
            : {}),
        } as AttendanceRecord;
      })
    );

    setEditOpen(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="p-6 space-y-6"
    >
      {/* Header card */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-text-heading">
            Attendance Records
          </div>
          <div className="text-sm text-text-primary/70">
            {formatFullDate(selectedDateISO)}
          </div>

          {/* Employee selector + Date Search + Actions */}
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

            {/* Date Search */}
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

              <ActionButton
                variant="default"
                onClick={printReport}
                type="button"
              >
                Print
              </ActionButton>
            </div>
          </div>
        </div>

        {/* Clock badge */}
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
            onSelectDateISO={setSelectedDateISO}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            recordsForMonth={recordsForMonth}
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
                  <div className="text-[10px] font-bold text-slate-500">
                    PRESENT
                  </div>
                  <div className="text-xl font-extrabold text-emerald-700">
                    {monthOverview.presentDays}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[10px] font-bold text-slate-500">
                    ABSENT
                  </div>
                  <div className="text-xl font-extrabold text-rose-700">
                    {monthOverview.absentDays}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[10px] font-bold text-slate-500">
                    INCOMPLETE
                  </div>
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
                  {formatHours(monthTotalMinutes)} hrs
                </div>

                <div className="mt-3 h-2 rounded-full bg-white/70 overflow-hidden">
                  <div
                    className="h-full bg-secondary"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="mt-2 text-xs font-semibold text-text-primary/80">
                  {progressPct}% of monthly target (160 hrs)
                </div>
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
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-soft flex items-center justify-center">
                  <Receipt className="h-4 w-4 text-text-primary/70" />
                </div>
                <div>
                  <div className="font-bold text-text-heading">Daily Logs</div>
                  <div className="text-xs text-text-primary/70">
                    Selected day attendance record
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-xs font-bold rounded-full bg-secondary/10 text-secondary px-3 py-1">
                  {selectedDayRecord
                    ? `${formatHours(dailyMinutes)} hrs`
                    : "0 hrs"}
                </div>

                <ActionButton
                  variant="dark"
                  onClick={openEditModal}
                  disabled={!selectedDayRecord}
                  className="px-3 py-1.5 text-xs"
                  title={
                    !selectedDayRecord
                      ? "No record to edit for this day"
                      : "Edit this record"
                  }
                  type="button"
                >
                  Edit
                </ActionButton>
              </div>
            </div>

            <div className="p-5">
              {!selectedDayRecord ? (
                <div className="text-sm text-text-primary/70">
                  No logs for{" "}
                  <span className="font-semibold">{selectedDateISO}</span>.
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
                        {new Date(
                          selectedDayRecord.dateISO + "T00:00:00"
                        ).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "2-digit",
                        })}
                      </div>
                      <div className="text-xs text-text-primary/70">
                        • {(selectedDayRecord as any).source ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-[10px] font-bold text-slate-500">
                        TIME IN
                      </div>
                      <div className="text-sm font-extrabold text-green-700">
                        {formatTime(selectedDayRecord.timeIn)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-[10px] font-bold text-slate-500">
                        LUNCH OUT
                      </div>
                      <div className="text-sm font-extrabold text-yellow-700">
                        {formatTime(selectedDayRecord.lunchOut)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-[10px] font-bold text-slate-500">
                        LUNCH IN
                      </div>
                      <div className="text-sm font-extrabold text-blue-700">
                        {formatTime(selectedDayRecord.lunchIn)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-[10px] font-bold text-slate-500">
                        TIME OUT
                      </div>
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

      {/* EDIT MODAL */}
      <Modal
        open={editOpen}
        title={`Admin Edit • ${
          selectedEmployee?.name ?? selectedEmployeeId
        } • ${editDraft.dateISO}`}
        onClose={() => setEditOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            Tip: Use datetime inputs to correct logs. Leave blank to set as “—”.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                Time In
              </label>
              <input
                type="datetime-local"
                value={editDraft.timeIn}
                onChange={(e) =>
                  setEditDraft((p) => ({ ...p, timeIn: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                Time Out
              </label>
              <input
                type="datetime-local"
                value={editDraft.timeOut}
                onChange={(e) =>
                  setEditDraft((p) => ({ ...p, timeOut: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                Lunch Out
              </label>
              <input
                type="datetime-local"
                value={editDraft.lunchOut}
                onChange={(e) =>
                  setEditDraft((p) => ({ ...p, lunchOut: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                Lunch In
              </label>
              <input
                type="datetime-local"
                value={editDraft.lunchIn}
                onChange={(e) =>
                  setEditDraft((p) => ({ ...p, lunchIn: e.target.value }))
                }
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
              onChange={(e) =>
                setEditDraft((p) => ({ ...p, source: e.target.value }))
              }
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
