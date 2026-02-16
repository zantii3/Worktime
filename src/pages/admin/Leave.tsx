import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminTable from "./components/AdminTable";
import { useAdmin } from "./context/AdminProvider";
import type { LeaveRequest, LeaveStatus, LeaveType } from "./context/AdminTypes";
import { notifyError, notifySuccess } from "./utils/toast";

type LeaveForm = Omit<LeaveRequest, "id">;

const createId = (): number => Date.now() + Math.floor(Math.random() * 1000);

const FILTERS = ["All", "Pending", "Approved", "Rejected"] as const;
type Filter = (typeof FILTERS)[number];

const LEAVE_TYPES: LeaveType[] = [
  "Vacation Leave",
  "Sick Leave",
  "Emergency Leave",
  "Maternity/Paternity Leave",
];

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
  const base = "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border";
  const map: Record<LeaveStatus, string> = {
    Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Approved: "bg-green-50 text-green-700 border-green-200",
    Rejected: "bg-red-50 text-red-700 border-red-200",
  };
  return `${base} ${map[status]}`;
}

export default function Leave() {
  const { leaves, setLeaves } = useAdmin();

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [filter, setFilter] = useState<Filter>("All");

  const [form, setForm] = useState<LeaveForm>({
    employee: "",
    type: "Vacation Leave",
    dateFrom: "",
    dateTo: "",
    reason: "",
    status: "Pending",
    attachmentName: null,
    appliedOn: undefined,
    date: undefined, // backward compat
  });

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // backward compat: old records that only have `date`
  const normalizedLeaves = useMemo(() => {
    return leaves.map((l) => {
      const dateFrom = l.dateFrom || l.date || "";
      const dateTo = l.dateTo || l.date || "";
      return {
        ...l,
        dateFrom,
        dateTo,
        attachmentName: l.attachmentName ?? null,
      };
    });
  }, [leaves]);

  const filteredLeaves = useMemo(() => {
    if (filter === "All") return normalizedLeaves;
    return normalizedLeaves.filter((l) => l.status === filter);
  }, [normalizedLeaves, filter]);

  const stats = useMemo(() => {
    const byType: Record<LeaveType, number> = {
      "Vacation Leave": 0,
      "Sick Leave": 0,
      "Emergency Leave": 0,
      "Maternity/Paternity Leave": 0,
    };
    for (const l of normalizedLeaves) byType[l.type] = (byType[l.type] ?? 0) + 1;
    const pending = normalizedLeaves.filter((l) => l.status === "Pending").length;
    const approved = normalizedLeaves.filter((l) => l.status === "Approved").length;
    const rejected = normalizedLeaves.filter((l) => l.status === "Rejected").length;
    return { byType, pending, approved, rejected, total: normalizedLeaves.length };
  }, [normalizedLeaves]);

  function onChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setForm((p) => ({ ...p, attachmentName: file ? file.name : null }));
  }

  function clearFile() {
    if (fileRef.current) fileRef.current.value = "";
    setForm((p) => ({ ...p, attachmentName: null }));
  }

  function reset() {
    setForm({
      employee: "",
      type: "Vacation Leave",
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
  }

  function validate() {
    if (!form.employee.trim()) return "Employee is required.";
    if (!form.dateFrom.trim()) return "Date From is required.";
    if (!form.dateTo.trim()) return "Date To is required.";
    if (safeISO(form.dateTo) < safeISO(form.dateFrom)) return "Date To must be on/after Date From.";
    if (!form.reason.trim()) return "Reason is required.";
    return null;
  }

  function save() {
    const err = validate();
    if (err) return notifyError(err);

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
  }

  function edit(l: LeaveRequest) {
    const dateFrom = l.dateFrom || l.date || "";
    const dateTo = l.dateTo || l.date || "";

    setEditingId(l.id);
    setForm({
      employee: l.employee,
      type: l.type,
      dateFrom,
      dateTo,
      reason: l.reason,
      status: l.status,
      attachmentName: l.attachmentName ?? null,
      appliedOn: l.appliedOn,
      date: l.date,
    });

    if (fileRef.current) fileRef.current.value = "";
  }

  function setStatus(id: number, status: "Approved" | "Rejected") {
    setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    notifySuccess(`Leave ${status.toLowerCase()}.`);
  }

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

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <span>🕒</span>
          <span>
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Top summary cards (optional, still admin useful) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <LeaveSummaryCard title="VACATION LEAVE" value={stats.byType["Vacation Leave"]} color="orange" />
        <LeaveSummaryCard title="SICK LEAVE" value={stats.byType["Sick Leave"]} color="green" />
        <LeaveSummaryCard title="EMERGENCY LEAVE" value={stats.byType["Emergency Leave"]} color="red" />
        <LeaveSummaryCard title="MATERNITY/PATERNITY LEAVE" value={stats.byType["Maternity/Paternity Leave"]} color="blue" />
      </div>

      {/* ✅ FORM PANEL — MATCHES THE SCREENSHOT UI */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="rounded-3xl overflow-hidden border border-orange-200 shadow-sm bg-card"
      >
        {/* orange header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-6">
          <div className="flex items-start gap-4 text-white">
            <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">
              🧾
            </div>
            <div>
              <div className="text-2xl font-extrabold leading-tight">
                {editingId ? "Update a Leave Request" : "File a Leave Request"}
              </div>
              <div className="text-sm opacity-90">Complete the form below to submit</div>
            </div>
          </div>
        </div>

        {/* form body */}
        <div className="p-6 md:p-8 space-y-6">
          {/* Row 1: Leave Type + Supporting Document */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Field label="LEAVE TYPE">
              <select
                name="type"
                value={form.type}
                onChange={onChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-orange-300"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="SUPPORTING DOCUMENT" optional>
              {/* Styled fake input bar like screenshot, but wired to real file input */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left flex items-center gap-3 outline-none focus:ring-2 focus:ring-orange-300"
              >
                <span className="text-xl">📎</span>
                <span className="text-slate-600">
                  {form.attachmentName ? form.attachmentName : "No file chosen"}
                </span>

                {form.attachmentName ? (
                  <span className="ml-auto text-xs font-semibold text-slate-500 underline" onClick={(e) => { e.stopPropagation(); clearFile(); }}>
                    Remove
                  </span>
                ) : null}
              </button>

              <input
                ref={fileRef}
                type="file"
                onChange={onPickFile}
                className="hidden"
              />
            </Field>
          </div>

          {/* Row 2: Date From + Date To */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Field label="DATE FROM">
              <input
                name="dateFrom"
                type="date"
                value={form.dateFrom}
                onChange={onChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-orange-300"
              />
            </Field>

            <Field label="DATE TO">
              <input
                name="dateTo"
                type="date"
                value={form.dateTo}
                onChange={onChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-orange-300"
              />
            </Field>
          </div>

          {/* Row 3: Reason (big textarea) */}
          <Field label="REASON">
            <textarea
              name="reason"
              value={form.reason}
              onChange={onChange}
              placeholder="Provide a reason for your leave..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base outline-none focus:ring-2 focus:ring-orange-300 min-h-[160px]"
            />
          </Field>

          {/* Admin-only: employee + status row (kept but styled to match) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Field label="EMPLOYEE">
              <input
                name="employee"
                value={form.employee}
                onChange={onChange}
                placeholder="Employee name"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-orange-300"
              />
            </Field>

            <Field label="STATUS">
              <select
                name="status"
                value={form.status}
                onChange={onChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-orange-300"
              >
                {(["Pending", "Approved", "Rejected"] as LeaveStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Submit button (orange, left) */}
          <div className="pt-2">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.99 }}
              onClick={save}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-7 py-3 rounded-2xl text-base font-extrabold shadow-sm"
            >
              <span>✈️</span>
              <span>{editingId ? "Update Request" : "Submit Request"}</span>
            </motion.button>

            {editingId && (
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={reset}
                className="ml-3 inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-7 py-3 rounded-2xl text-base font-extrabold"
              >
                Cancel
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* History table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.08 }}
        className="bg-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">📚</div>
            <div>
              <div className="font-bold text-text-heading">Leave History</div>
              <div className="text-xs text-text-primary/70">All leave requests</div>
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
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <AdminTable headers={["Employee", "Type", "Duration", "Days", "Reason", "Applied On", "Status", "Actions"]}>
          <AnimatePresence>
            {filteredLeaves.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  No leave requests found.
                </td>
              </tr>
            ) : (
              filteredLeaves.map((l) => {
                const days = l.dateFrom && l.dateTo ? diffDaysInclusive(l.dateFrom, l.dateTo) : 0;
                const duration = l.dateFrom && l.dateTo ? `${l.dateFrom} → ${l.dateTo}` : (l.date ?? "—");

                return (
                  <motion.tr
                    key={l.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <td className="px-4 py-3">{l.employee}</td>
                    <td className="px-4 py-3">{l.type}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{duration}</td>
                    <td className="px-4 py-3 font-semibold">{days || "—"}</td>
                    <td className="px-4 py-3">{l.reason}</td>
                    <td className="px-4 py-3">{l.appliedOn ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={statusPillClass(l.status)}>{l.status}</span>
                    </td>
                    <td className="px-4 py-3 space-x-3">
                      <button onClick={() => edit(l)} className="text-sm text-blue-700 hover:underline font-semibold">
                        Edit
                      </button>
                      {l.status === "Pending" && (
                        <>
                          <button onClick={() => setStatus(l.id, "Approved")} className="text-sm text-green-700 hover:underline font-semibold">
                            Approve
                          </button>
                          <button onClick={() => setStatus(l.id, "Rejected")} className="text-sm text-red-700 hover:underline font-semibold">
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
      <div className="text-[11px] font-extrabold tracking-wide text-slate-600">
        {label}{" "}
        {optional ? <span className="font-semibold text-slate-400">(Optional)</span> : null}
      </div>
      {children}
    </div>
  );
}

function LeaveSummaryCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: "orange" | "green" | "red" | "blue";
}) {
  const bar =
    color === "orange"
      ? "bg-orange-500"
      : color === "green"
      ? "bg-green-500"
      : color === "red"
      ? "bg-red-500"
      : "bg-blue-500";

  const pct = Math.max(5, Math.min(100, value * 10));

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="bg-card rounded-2xl shadow-sm border border-slate-200 p-5"
    >
      <div className="text-[10px] font-bold text-slate-500">{title}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-3xl font-extrabold text-text-heading">{value}</div>
        <div className="text-xs text-text-primary/70">requests</div>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>0 used</span>
        <span>{value} total</span>
      </div>
    </motion.div>
  );
}
