import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  source?: string;
  dateISO: string; // YYYY-MM-DD
  timeIn: string | null;
  lunchOut: string | null;
  lunchIn: string | null;
  timeOut: string | null;
};

type Props = {
  viewMonth: Date;
  selectedDateISO: string;
  onSelectDateISO: (dateISO: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  recordsForMonth: AttendanceRecord[];
  // ── NEW ──────────────────────────────────────────────────────────────
  leaveDatesForMonth?: Map<string, "Pending" | "Approved">;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(d: Date) {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function formatTime(iso: string | null) {
  if (!iso) return null;
  const dt = new Date(iso);
  return dt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isWeekday(d: Date) {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

function isTodayISO(iso: string) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}` === iso;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export default function AdminAttendanceCalendar({
  viewMonth,
  selectedDateISO,
  onSelectDateISO,
  onPrevMonth,
  onNextMonth,
  recordsForMonth,
  leaveDatesForMonth,
}: Props) {
  const rows = useMemo(() => {
    const first = startOfMonth(viewMonth);

    // 6 rows × 7 cols month grid
    const firstDow = first.getDay();
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - firstDow);

    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }

    const grouped: Date[][] = [];
    for (let i = 0; i < 6; i++) {
      grouped.push(cells.slice(i * 7, i * 7 + 7));
    }

    return grouped;
  }, [viewMonth]);

  const recordByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of recordsForMonth) {
      map.set(r.dateISO, r);
    }
    return map;
  }, [recordsForMonth]);

  const todayStart = startOfToday();

  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-md overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-primary text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
            <CalendarDays className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-xl font-bold">{monthLabel(viewMonth)}</h2>
            <p className="text-xs text-white/70 mt-0.5">
              Click any date to view details
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={onPrevMonth}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Previous month"
            type="button"
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={onNextMonth}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Next month"
            type="button"
          >
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      <div className="p-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-3 text-[10px] font-semibold text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Time In
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            Time Out
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            Absent (Weekday)
          </div>
          {/* ── NEW ── */}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            Leave (Pending)
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            Leave (Approved)
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 rounded-xl overflow-hidden border border-slate-100">
          {rows.flat().map((d) => {
            const iso = toISODate(d);
            const inMonth = d.getMonth() === viewMonth.getMonth();
            const isSelected = iso === selectedDateISO;
            const rec = recordByDate.get(iso);

            const absent =
              inMonth &&
              isWeekday(d) &&
              !rec &&
              d.getTime() < todayStart;

            const today = isTodayISO(iso);

            const tIn = formatTime(rec?.timeIn ?? null);
            const tOut = formatTime(rec?.timeOut ?? null);

            // ── NEW ──────────────────────────────────────────────────────
            const leaveStatus = inMonth
              ? (leaveDatesForMonth?.get(iso) ?? null)
              : null;
            const onLeavePending = leaveStatus === "Pending";
            const onLeaveApproved = leaveStatus === "Approved";
            const onLeave = onLeavePending || onLeaveApproved;
            // ─────────────────────────────────────────────────────────────

            return (
              <motion.button
                key={iso}
                whileHover={{ scale: 0.985 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onSelectDateISO(iso)}
                type="button"
                className={cx(
                  "h-16 sm:h-20 md:h-24 border p-1.5 sm:p-2 text-left transition-all relative overflow-hidden group",
                  !inMonth
                    ? "bg-slate-50/30 border-slate-100 opacity-60"
                    // ── NEW: leave states take priority over absent/no-record ──
                    : onLeaveApproved
                    ? "bg-blue-50 border-blue-300 hover:bg-blue-100/60"
                    : onLeavePending
                    ? "bg-yellow-50 border-yellow-300 hover:bg-yellow-100/60"
                    // ── existing states ──────────────────────────────────────
                    : absent
                    ? "bg-rose-50 border-rose-200 hover:bg-rose-100/60"
                    : today
                    ? "bg-orange-50 border-[#F28C28]/40 hover:bg-orange-100/50"
                    : rec
                    ? "bg-white border-slate-200 hover:border-[#1F3C68]/30 hover:bg-blue-50/20"
                    : "bg-white border-slate-100 hover:bg-slate-50",
                  isSelected ? "ring-2 ring-primary/40 z-10" : ""
                )}
                aria-current={isSelected ? "date" : undefined}
              >
                <span
                  className={cx(
                    "text-xs sm:text-sm font-bold",
                    today
                      ? "text-[#F28C28]"
                      : onLeaveApproved
                      ? "text-blue-700"
                      : onLeavePending
                      ? "text-yellow-700"
                      : absent
                      ? "text-rose-700"
                      : rec
                      ? "text-[#1F3C68]"
                      : "text-slate-400"
                  )}
                >
                  {d.getDate()}
                </span>

                {/* ── NEW: leave label ── */}
                {onLeave && (
                  <div
                    className={cx(
                      "mt-0.5 text-[8px] sm:text-[9px] font-bold leading-tight",
                      onLeaveApproved ? "text-blue-700" : "text-yellow-700"
                    )}
                  >
                    {onLeaveApproved ? "On Leave" : "Leave (Pending)"}
                  </div>
                )}

                {absent && !onLeave && (
                  <div className="mt-0.5 text-[8px] sm:text-[9px] font-bold text-rose-700 leading-tight">
                    Absent
                  </div>
                )}

                {rec && (
                  <div className="mt-0.5 sm:mt-1 space-y-0.5">
                    {tIn && (
                      <div className="flex items-center gap-0.5">
                        <div className="w-1 h-1 rounded-full bg-green-500 flex-shrink-0" />
                        <span className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold text-green-700 tabular-nums">
                          {tIn}
                        </span>
                      </div>
                    )}

                    {tOut && (
                      <div className="flex items-center gap-0.5">
                        <div className="w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                        <span className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold text-red-700 tabular-nums">
                          {tOut}
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
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}