import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  source: "Desktop" | "Mobile";
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
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
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

function DayPill({
  label,
  time,
  variant,
}: {
  label: string;
  time: string;
  variant: "in" | "lo" | "li" | "out";
}) {
  const styles =
    variant === "in"
      ? "bg-green-50 text-green-700"
      : variant === "lo"
      ? "bg-yellow-50 text-yellow-700"
      : variant === "li"
      ? "bg-blue-50 text-blue-700"
      : "bg-red-50 text-red-700";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full rounded-md px-2 py-1 text-[11px] font-semibold ${styles}`}
      title={`${label} ${time}`}
    >
      {label} {time}
    </motion.div>
  );
}

export default function AdminAttendanceCalendar({
  viewMonth,
  selectedDateISO,
  onSelectDateISO,
  onPrevMonth,
  onNextMonth,
  recordsForMonth,
}: Props) {
  const { rows, monthKey } = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const last = endOfMonth(viewMonth);

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

    return {
      rows: r,
      monthKey: `${viewMonth.getFullYear()}-${viewMonth.getMonth() + 1}`,
      last,
    };
  }, [viewMonth]);

  const weekday = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const recordByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of recordsForMonth) map.set(r.dateISO, r);
    return map;
  }, [recordsForMonth]);

  return (
    <div className="rounded-2xl bg-card border border-slate-200 shadow-sm overflow-hidden">
      {/* Orange header like screenshot */}
      <div className="bg-primary 0 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-white">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-lg">
            📅
          </div>
          <div className="font-bold text-lg">{monthLabel(viewMonth)}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPrevMonth}
            className="h-9 w-9 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold"
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            onClick={onNextMonth}
            className="h-9 w-9 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {weekday.map((w) => (
            <div key={w} className="text-[11px] font-bold text-slate-500 text-center">
              {w}
            </div>
          ))}
        </div>

        <AnimatePresence mode="popLayout">
          <motion.div
            key={monthKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-7 gap-2"
          >
            {rows.flat().map((d) => {
              const iso = toISODate(d);
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const isSelected = iso === selectedDateISO;

              const rec = recordByDate.get(iso);

              const tIn = formatTime(rec?.timeIn ?? null);
              const tLO = formatTime(rec?.lunchOut ?? null);
              const tLI = formatTime(rec?.lunchIn ?? null);
              const tOut = formatTime(rec?.timeOut ?? null);

              return (
                <motion.button
                  key={iso}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onSelectDateISO(iso)}
                  className={[
                    "min-h-[92px] rounded-xl border text-left p-2 transition",
                    inMonth ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-60",
                    isSelected ? "ring-2 ring-orange-400" : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700">{d.getDate()}</div>
                    {rec ? (
                      <span className="text-[10px] font-bold text-orange-600">•</span>
                    ) : null}
                  </div>

                  {/* Pills like screenshot */}
                  <div className="mt-2 space-y-1">
                    {tIn ? <DayPill label="IN" time={tIn} variant="in" /> : null}
                    {tLO ? <DayPill label="LO" time={tLO} variant="lo" /> : null}
                    {tLI ? <DayPill label="LI" time={tLI} variant="li" /> : null}
                    {tOut ? <DayPill label="OUT" time={tOut} variant="out" /> : null}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
