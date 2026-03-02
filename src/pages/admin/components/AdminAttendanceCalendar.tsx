import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  // keep flexible: users may write "Desktop"/"Mobile", admins may write remarks
  source?: string;
  dateISO: string; // YYYY-MM-DD
  timeIn: string | null;
  lunchOut: string | null;
  lunchIn: string | null;
  timeOut: string | null;
};

type Props = {
  viewMonth: Date; // any date within the month
  selectedDateISO: string; // YYYY-MM-DD
  onSelectDateISO: (dateISO: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  recordsForMonth: AttendanceRecord[]; // already filtered for employee + month
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
  return dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
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

export default function AdminAttendanceCalendar({
  viewMonth,
  selectedDateISO,
  onSelectDateISO,
  onPrevMonth,
  onNextMonth,
  recordsForMonth,
}: Props) {
  const { rows } = useMemo(() => {
    const first = startOfMonth(viewMonth);
    // Sun-start grid, 6x7 = 42 cells
    const firstDow = first.getDay();
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - firstDow);

    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }

    const r: Date[][] = [];
    for (let i = 0; i < 6; i++) r.push(cells.slice(i * 7, i * 7 + 7));

    return { rows: r };
  }, [viewMonth]);

  const recordByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of recordsForMonth) map.set(r.dateISO, r);
    return map;
  }, [recordsForMonth]);

  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-md overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-primary text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{monthLabel(viewMonth)}</h2>
            <p className="text-xs text-white/70 mt-0.5">
              Click any date to see full details
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onPrevMonth}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Previous month"
            type="button"
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
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
        <div className="flex flex-wrap gap-3 mb-3 text-[10px] font-semibold text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" /> Time In
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" /> Time Out
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-rose-500" /> Absent (Weekday)
          </div>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider py-2"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 rounded-xl overflow-hidden border border-slate-100">
          {rows.flat().map((d) => {
            const iso = toISODate(d);
            const inMonth = d.getMonth() === viewMonth.getMonth();
            const selected = iso === selectedDateISO;
            const rec = recordByDate.get(iso);

            const absent =
              inMonth &&
              isWeekday(d) &&
              !rec &&
              d.getTime() < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
              
            const today = isTodayISO(iso);

            const tIn = formatTime(rec?.timeIn ?? null);
            const tOut = formatTime(rec?.timeOut ?? null);

            return (
              <motion.div
                key={iso}
                whileHover={{ scale: 0.97 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => onSelectDateISO(iso)}
                className={[
                  "h-16 sm:h-20 md:h-24 border p-1.5 sm:p-2 cursor-pointer transition-all relative overflow-hidden group",
                  !inMonth
                    ? "bg-slate-50/30 border-slate-100 opacity-60"
                    : absent
                    ? "bg-rose-50 border-rose-200 hover:bg-rose-100/60"
                    : today
                    ? "bg-orange-50 border-[#F28C28]/40 hover:bg-orange-100/50"
                    : rec
                    ? "bg-white border-slate-200 hover:border-[#1F3C68]/30 hover:bg-blue-50/20"
                    : "bg-white border-slate-100 hover:bg-slate-50",
                  selected ? "ring-2 ring-primary/40" : "",
                ].join(" ")}
                role="button"
                aria-current={selected ? "date" : undefined}
              >
                <span
                  className={[
                    "text-xs sm:text-sm font-bold",
                    today
                      ? "text-[#F28C28]"
                      : absent
                      ? "text-rose-700"
                      : rec
                      ? "text-[#1F3C68]"
                      : "text-slate-400",
                  ].join(" ")}
                >
                  {d.getDate()}
                </span>

                {absent ? (
                  <div className="mt-0.5 text-[8px] sm:text-[9px] font-bold text-rose-700 leading-tight">
                    Absent
                  </div>
                ) : null}

                {rec ? (
                  <div className="mt-0.5 sm:mt-1 space-y-0.5">
                    {tIn ? (
                      <div className="flex items-center gap-0.5">
                        <div className="w-1 h-1 rounded-full bg-green-500 flex-shrink-0" />
                        <span className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold text-green-700 tabular-nums">
                          {tIn}
                        </span>
                      </div>
                    ) : null}
                    {tOut ? (
                      <div className="flex items-center gap-0.5">
                        <div className="w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                        <span className="text-[8px] sm:text-[9px] md:text-[10px] font-semibold text-red-700 tabular-nums">
                          {tOut}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-3 h-3 bg-[#1F3C68]/10 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-[#1F3C68]/40 rounded-full" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}