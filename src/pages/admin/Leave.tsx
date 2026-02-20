import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AdminTable from "./components/AdminTable";
import { useAdmin } from "./context/AdminProvider";
import type { LeaveRequest, LeaveStatus, LeaveType } from "./context/AdminTypes";
import { notifyError, notifySuccess } from "./utils/toast";

type LeaveForm = Omit<LeaveRequest, "id">;

const createId = (): number => Date.now() + Math.floor(Math.random() * 1000);

const FILTERS = ["All", "Pending", "Approved", "Rejected"] as const;
type Filter = (typeof FILTERS)[number];

const LEAVE_TYPES: LeaveType[] = [
  "Vacation",
  "Sick",
  "Emergency",
  "Maternity/Paternity",
];

const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  Vacation: "Vacation Leave",
  Sick: "Sick Leave",
  Emergency: "Emergency Leave",
  "Maternity/Paternity": "Maternity/Paternity Leave",
};

function formatFullDate(now: Date) {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeISO(d: string) {
  return new Date(d + "T00:00:00").getTime();
}

function diffDaysInclusive(from: string, to: string) {
  const a = safeISO(from);
  const b = safeISO(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const days = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return Math.max(0, days) + 1;
}

function statusPillClass(status: LeaveStatus) {
  const base =
    "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border";
  const map: Record<LeaveStatus, string> = {
    Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Approved: "bg-green-50 text-green-700 border-green-200",
    Rejected: "bg-red-50 text-red-700 border-red-200",
  };
  return `${base} ${map[status] ?? "bg-soft text-text-primary border-slate-200"}`;
}

export default function Leave() {
  const { leaves, setLeaves } = useAdmin();

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [filter, setFilter] = useState<Filter>("All");
  const [typeFilter, setTypeFilter] = useState<LeaveType | "All">("All");

  const [form, setForm] = useState<LeaveForm>({
    employee: "",
    type: "Vacation",
    dateFrom: "",
    dateTo: "",
    reason: "",
    status: "Pending",
    attachmentName: null,
    appliedOn: undefined,
    date: undefined,
  });

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const normalizedLeaves = useMemo(() => {
    return leaves.map((l) => ({
      ...l,
      dateFrom: l.dateFrom || l.date || "",
      dateTo: l.dateTo || l.date || "",
      attachmentName: l.attachmentName ?? null,
      appliedOn: l.appliedOn ?? l.date ?? undefined,
    }));
  }, [leaves]);

  const filteredLeaves = useMemo(() => {
    let list = normalizedLeaves;
    if (filter !== "All") list = list.filter((l) => l.status === filter);
    if (typeFilter !== "All") list = list.filter((l) => l.type === typeFilter);
    return list;
  }, [normalizedLeaves, filter, typeFilter]);

  const cardStats = useMemo(() => {
    const init = () => ({ total: 0, pending: 0, approved: 0, rejected: 0 });
    const byType: Record<LeaveType, ReturnType<typeof init>> = {
      Vacation: init(),
      Sick: init(),
      Emergency: init(),
      "Maternity/Paternity": init(),
    };

    for (const l of normalizedLeaves) {
      const bucket = byType[l.type];
      bucket.total += 1;
      if (l.status === "Pending") bucket.pending += 1;
      if (l.status === "Approved") bucket.approved += 1;
      if (l.status === "Rejected") bucket.rejected += 1;
    }

    return byType;
  }, [normalizedLeaves]);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setForm((p) => ({ ...p, attachmentName: file ? file.name : null }));
  };

  const clearFile = () => {
    if (fileRef.current) fileRef.current.value = "";
    setForm((p) => ({ ...p, attachmentName: null }));
  };

  const reset = () => {
    setForm({
      employee: "",
      type: "Vacation",
      dateFrom: "",
      dateTo: "",
      reason: "",
      status: "Pending",
      attachmentName: null,
      appliedOn: undefined,
      date: undefined,
    });
    setEditingId(null);
    clearFile();
  };

  const validate = () => {
    if (!form.employee.trim()) return notifyError("Employee is required.");
    if (!form.dateFrom.trim()) return notifyError("Date From is required.");
    if (!form.dateTo.trim()) return notifyError("Date To is required.");
    if (safeISO(form.dateTo) < safeISO(form.dateFrom))
      return notifyError("Date To must be on/after Date From.");
    if (!form.reason.trim()) return notifyError("Reason is required.");
    return null;
  };

  const save = () => {
    const err = validate();
    if (err) return;

    if (editingId) {
      setLeaves((prev) =>
        prev.map((l) =>
          l.id === editingId
            ? {
                ...l,
                ...form,
                date: undefined,
              }
            : l
        )
      );
      notifySuccess("Leave updated.");
      reset();
      return;
    }

    const newLeave: LeaveRequest = {
      id: createId(),
      ...form,
      appliedOn: form.appliedOn ?? todayISO(),
      date: undefined,
    };

    setLeaves((prev) => [newLeave, ...prev]);
    notifySuccess("Leave request created.");
    reset();
  };

  const edit = (l: LeaveRequest) => {
    setEditingId(l.id);
    setForm({
      employee: l.employee,
      type: l.type,
      dateFrom: l.dateFrom || l.date || "",
      dateTo: l.dateTo || l.date || "",
      reason: l.reason,
      status: l.status,
      attachmentName: l.attachmentName ?? null,
      appliedOn: l.appliedOn,
      date: l.date,
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const setStatus = (id: number, status: "Approved" | "Rejected") => {
    setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    notifySuccess(`Leave ${status.toLowerCase()}.`);
  };

  const openType = (t: LeaveType) => setTypeFilter(t);

  const clearType = () => setTypeFilter("All");
  const clearAllFilters = () => {
    setTypeFilter("All");
    setFilter("All");
  };

  const hasAnyFilter = filter !== "All" || typeFilter !== "All";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header card */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-text-heading">Leave Requests</div>
          <div className="text-sm text-text-primary/70">{formatFullDate(now)}</div>
        </div>

        <div className="bg-primary text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <span>🕒</span>
          <span>
            {now.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <LeaveSummaryCard
          title="VACATION LEAVE"
          value={cardStats.Vacation.total}
          breakdown={cardStats.Vacation}
          active={typeFilter === "Vacation"}
          onClick={() => openType("Vacation")}
        />
        <LeaveSummaryCard
          title="SICK LEAVE"
          value={cardStats.Sick.total}
          breakdown={cardStats.Sick}
          active={typeFilter === "Sick"}
          onClick={() => openType("Sick")}
        />
        <LeaveSummaryCard
          title="EMERGENCY LEAVE"
          value={cardStats.Emergency.total}
          breakdown={cardStats.Emergency}
          active={typeFilter === "Emergency"}
          onClick={() => openType("Emergency")}
        />
        <LeaveSummaryCard
          title="MATERNITY/PATERNITY LEAVE"
          value={cardStats["Maternity/Paternity"].total}
          breakdown={cardStats["Maternity/Paternity"]}
          active={typeFilter === "Maternity/Paternity"}
          onClick={() => openType("Maternity/Paternity")}
        />
      </div>

      {/* Filter bar */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs font-semibold text-text-primary/70">Filters</div>

          <AnimatePresence>
            {typeFilter !== "All" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-soft text-text-heading text-xs font-semibold"
              >
                <span className="text-text-primary/70">Type:</span>
                <span className="font-extrabold">{LEAVE_TYPE_LABEL[typeFilter]}</span>
                <button
                  onClick={clearType}
                  className="ml-1 h-5 w-5 rounded-full bg-card border border-primary/30 hover:bg-soft flex items-center justify-center"
                  aria-label="Clear leave type filter"
                  title="Clear type"
                  type="button"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {filter !== "All" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-card text-text-heading text-xs font-semibold"
              >
                <span className="text-text-primary/70">Status:</span>
                <span className="font-extrabold">{filter}</span>
                <button
                  onClick={() => setFilter("All")}
                  className="ml-1 h-5 w-5 rounded-full bg-soft border border-slate-200 hover:bg-background flex items-center justify-center"
                  aria-label="Clear status filter"
                  title="Clear status"
                  type="button"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {!hasAnyFilter && (
            <div className="text-xs text-text-primary/60">No filters applied</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearAllFilters}
            disabled={!hasAnyFilter}
            className={[
              "px-3 py-1.5 rounded-xl text-xs font-bold border transition",
              hasAnyFilter
                ? "bg-primary text-white border-primary hover:opacity-90"
                : "bg-soft text-text-primary/50 border-slate-200 cursor-not-allowed",
            ].join(" ")}
            type="button"
          >
            Clear all
          </button>
        </div>
      </motion.div>

      {/* Leave History */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="bg-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-soft flex items-center justify-center">
              📚
            </div>
            <div>
              <div className="font-bold text-text-heading">
                Leave History
                {typeFilter !== "All" ? ` • ${LEAVE_TYPE_LABEL[typeFilter]}` : ""}
                {filter !== "All" ? ` • ${filter}` : ""}
              </div>
              <div className="text-xs text-text-primary/70">
                {hasAnyFilter ? "Showing filtered results" : "All leave requests"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  "px-3 py-1.5 rounded-lg text-xs font-semibold border transition",
                  f === filter
                    ? "bg-primary text-white border-primary"
                    : "bg-card text-text-heading border-slate-200 hover:bg-soft",
                ].join(" ")}
                type="button"
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <AdminTable
          headers={[
            "Employee",
            "Type",
            "Duration",
            "Days",
            "Reason",
            "Applied On",
            "Status",
            "Actions",
          ]}
        >
          <AnimatePresence>
            {filteredLeaves.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-text-primary/70">
                  No leave requests found.
                </td>
              </tr>
            ) : (
              filteredLeaves.map((l) => {
                const days =
                  l.dateFrom && l.dateTo ? diffDaysInclusive(l.dateFrom, l.dateTo) : 0;

                const duration =
                  l.dateFrom && l.dateTo ? `${l.dateFrom} → ${l.dateTo}` : l.date ?? "—";

                return (
                  <motion.tr
                    key={l.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <td className="px-4 py-3">{l.employee}</td>
                    <td className="px-4 py-3">{LEAVE_TYPE_LABEL[l.type]}</td>
                    <td className="px-4 py-3 text-xs text-text-primary/70">{duration}</td>
                    <td className="px-4 py-3 font-semibold">{days || "—"}</td>
                    <td className="px-4 py-3">{l.reason}</td>
                    <td className="px-4 py-3">{l.appliedOn ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={statusPillClass(l.status)}>{l.status}</span>
                    </td>
                    <td className="px-4 py-3 space-x-3">
                      <button
                        onClick={() => edit(l)}
                        className="text-sm text-primary hover:underline font-semibold"
                        type="button"
                      >
                        Edit
                      </button>

                      {l.status === "Pending" && (
                        <>
                          <button
                            onClick={() => setStatus(l.id, "Approved")}
                            className="text-sm text-green-700 hover:underline font-semibold"
                            type="button"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setStatus(l.id, "Rejected")}
                            className="text-sm text-red-700 hover:underline font-semibold"
                            type="button"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </motion.tr>
                );
              })
            )}
          </AnimatePresence>
        </AdminTable>
      </motion.div>

      {/* File a Leave Request */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.08 }}
        className="rounded-3xl overflow-hidden border border-primary/30 shadow-sm bg-card"
      >
        <div className="bg-primary px-6 py-6">
          <div className="flex items-start gap-4 text-white">
            <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center text-2xl">
              🧾
            </div>
            <div>
              <div className="text-2xl font-extrabold leading-tight">
                {editingId ? "Update a Leave Request" : "File a Leave Request"}
              </div>
              <div className="text-sm opacity-90">
                Complete the form below to submit
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Field label="LEAVE TYPE">
              <select
                name="type"
                value={form.type}
                onChange={onChange}
                className="w-full rounded-2xl border border-slate-200 bg-card px-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-primary/30"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LEAVE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="SUPPORTING DOCUMENT" optional>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl border border-slate-200 bg-card px-5 py-4 text-left flex items-center gap-3 outline-none focus:ring-2 focus:ring-primary/30"
              >
                <span className="text-xl">📎</span>
                <span className="text-text-primary/70">
                  {form.attachmentName ? form.attachmentName : "No file chosen"}
                </span>

                {form.attachmentName ? (
                  <span
                    className="ml-auto text-xs font-semibold text-text-primary/70 underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                  >
                    Remove
                  </span>
                ) : null}
              </button>

              <input ref={fileRef} type="file" onChange={onPickFile} className="hidden" />
            </Field>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Field label="DATE FROM">
              <input
                name="dateFrom"
                type="date"
                value={form.dateFrom}
                onChange={onChange}
                className="w-full rounded-2xl border border-slate-200 bg-card px-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>

            <Field label="DATE TO">
              <input
                name="dateTo"
                type="date"
                value={form.dateTo}
                onChange={onChange}
                className="w-full rounded-2xl border border-slate-200 bg-card px-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
          </div>

          <Field label="REASON">
            <textarea
              name="reason"
              value={form.reason}
              onChange={onChange}
              placeholder="Provide a reason for your leave..."
              className="w-full rounded-2xl border border-slate-200 bg-card px-5 py-4 text-base outline-none focus:ring-2 focus:ring-primary/30 min-h-[160px]"
            />
          </Field>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Field label="EMPLOYEE">
              <input
                name="employee"
                value={form.employee}
                onChange={onChange}
                placeholder="Employee name"
                className="w-full rounded-2xl border border-slate-200 bg-card px-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>

            <Field label="STATUS">
              <select
                name="status"
                value={form.status}
                onChange={onChange}
                className="w-full rounded-2xl border border-slate-200 bg-card px-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-primary/30"
              >
                {(["Pending", "Approved", "Rejected"] as LeaveStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="pt-2">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.99 }}
              onClick={save}
              className="inline-flex items-center gap-2 bg-primary hover:opacity-90 text-white px-7 py-3 rounded-2xl text-base font-extrabold shadow-sm"
              type="button"
            >
              <span>✈️</span>
              <span>{editingId ? "Update Request" : "Submit Request"}</span>
            </motion.button>

            {editingId && (
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={reset}
                className="ml-3 inline-flex items-center gap-2 bg-soft hover:bg-background text-text-primary px-7 py-3 rounded-2xl text-base font-extrabold"
                type="button"
              >
                Cancel
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-extrabold tracking-wide text-text-primary/70">
        {label}{" "}
        {optional ? (
          <span className="font-semibold text-text-primary/60">(Optional)</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function LeaveSummaryCard({
  title,
  value,
  breakdown,
  active,
  onClick,
}: {
  title: string;
  value: number;
  breakdown: { total: number; pending: number; approved: number; rejected: number };
  active?: boolean;
  onClick?: () => void;
}) {
  const pct = breakdown.total
    ? Math.round((breakdown.approved / breakdown.total) * 100)
    : 0;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15 }}
      className={[
        "text-left bg-card rounded-2xl shadow-sm border p-5 w-full",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        active ? "border-primary/40 ring-2 ring-primary/20" : "border-slate-200",
      ].join(" ")}
    >
      <div className="text-[10px] font-bold text-text-primary/70">{title}</div>

      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-3xl font-extrabold text-text-heading">{value}</div>
        <div className="text-xs text-text-primary/70">requests</div>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-soft overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-text-primary/70">
        <div className="flex items-center justify-between">
          <span>Pending</span>
          <span className="font-semibold text-text-heading">{breakdown.pending}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Approved</span>
          <span className="font-semibold text-text-heading">{breakdown.approved}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Rejected</span>
          <span className="font-semibold text-text-heading">{breakdown.rejected}</span>
        </div>
      </div>
    </motion.button>
  );
}
