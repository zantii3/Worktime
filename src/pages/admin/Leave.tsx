import { AnimatePresence, motion } from "framer-motion";
import {
  BookText,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Filter,
  Paperclip,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { STORAGE_KEY } from "../user/types/leaveconstants";
import AdminTable from "./components/AdminTable";
import { notifyError, notifySuccess } from "./utils/toast";

type LeaveStatus = "Pending" | "Approved" | "Rejected";
type LeaveType =
  | "Vacation Leave"
  | "Sick Leave"
  | "Emergency Leave"
  | "Maternity/Paternity Leave";

type StoredLeaveRequest = {
  id: number;
  employee: string;
  type: LeaveType | string;
  reason: string;
  status: LeaveStatus;

  // current admin-side shape
  dateFrom?: string;
  dateTo?: string;
  attachmentName?: string | null;

  // current user-side shape
  startDate?: string;
  endDate?: string;
  fileName?: string;

  // shared / legacy
  appliedOn?: string;
  date?: string;
  days?: number;
};

type NormalizedLeaveRequest = {
  id: number;
  employee: string;
  type: LeaveType;
  dateFrom: string;
  dateTo: string;
  reason: string;
  status: LeaveStatus;
  attachmentName: string | null;
  appliedOn?: string;
  days: number;
};

type LeaveForm = {
  type: LeaveType;
  dateFrom: string;
  dateTo: string;
  reason: string;
  attachmentName: string | null;
};

type CurrentAdmin = {
  id: number;
  email: string;
  name: string;
};

const ALL_LEAVES_KEY = STORAGE_KEY;
const FILTERS = ["All", "Pending", "Approved", "Rejected"] as const;
type Filter = (typeof FILTERS)[number];

const LEAVE_TYPES: LeaveType[] = [
  "Vacation Leave",
  "Sick Leave",
  "Emergency Leave",
  "Maternity/Paternity Leave",
];

const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  "Vacation Leave": "Vacation Leave",
  "Sick Leave": "Sick Leave",
  "Emergency Leave": "Emergency Leave",
  "Maternity/Paternity Leave": "Maternity/Paternity Leave",
};

const createId = (): number => Date.now() + Math.floor(Math.random() * 1000);

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
  return new Date(`${d}T00:00:00`).getTime();
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
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border";
  const map: Record<LeaveStatus, string> = {
    Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Approved: "bg-green-50 text-green-700 border-green-200",
    Rejected: "bg-red-50 text-red-700 border-red-200",
  };

  return `${base} ${map[status] ?? map.Pending}`;
}

function normalizeLeaveType(type: string | undefined): LeaveType {
  switch (type) {
    case "Vacation":
    case "Vacation Leave":
      return "Vacation Leave";
    case "Sick":
    case "Sick Leave":
      return "Sick Leave";
    case "Emergency":
    case "Emergency Leave":
      return "Emergency Leave";
    case "Maternity/Paternity":
    case "Maternity/Paternity Leave":
      return "Maternity/Paternity Leave";
    default:
      return "Vacation Leave";
  }
}

function normalizeLeave(record: StoredLeaveRequest): NormalizedLeaveRequest {
  const dateFrom = record.dateFrom || record.startDate || record.date || "";
  const dateTo = record.dateTo || record.endDate || record.date || "";
  const days =
    dateFrom && dateTo
      ? diffDaysInclusive(dateFrom, dateTo)
      : typeof record.days === "number"
      ? record.days
      : 0;

  return {
    id: record.id,
    employee: record.employee || "Unknown",
    type: normalizeLeaveType(record.type),
    dateFrom,
    dateTo,
    reason: record.reason || "",
    status: record.status || "Pending",
    attachmentName: record.attachmentName ?? record.fileName ?? null,
    appliedOn: record.appliedOn ?? record.date,
    days,
  };
}

function readLeavesFromStorage(): StoredLeaveRequest[] {
  try {
    const raw = localStorage.getItem(ALL_LEAVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredLeaveRequest[]) : [];
  } catch {
    return [];
  }
}

function readCurrentAdmin(): CurrentAdmin | null {
  try {
    const raw = localStorage.getItem("currentAdmin");
    if (!raw) return null;
    return JSON.parse(raw) as CurrentAdmin;
  } catch {
    return null;
  }
}

export default function Leave() {
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(() =>
    readCurrentAdmin()
  );

  const [leaves, setLeaves] = useState<StoredLeaveRequest[]>(() =>
    readLeavesFromStorage()
  );

  const [now, setNow] = useState<Date>(new Date());
  const [filter, setFilter] = useState<Filter>("All");
  const [typeFilter, setTypeFilter] = useState<LeaveType | "All">("All");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState<LeaveForm>({
    type: "Vacation Leave",
    dateFrom: "",
    dateTo: "",
    reason: "",
    attachmentName: null,
  });

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(ALL_LEAVES_KEY, JSON.stringify(leaves));
  }, [leaves]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ALL_LEAVES_KEY) {
        setLeaves(readLeavesFromStorage());
      }

      if (e.key === "currentAdmin") {
        setCurrentAdmin(readCurrentAdmin());
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const normalizedLeaves = useMemo(
    () => leaves.map((leave) => normalizeLeave(leave)),
    [leaves]
  );

  const filteredLeaves = useMemo(() => {
    let list = normalizedLeaves;

    if (filter !== "All") {
      list = list.filter((leave) => leave.status === filter);
    }

    if (typeFilter !== "All") {
      list = list.filter((leave) => leave.type === typeFilter);
    }

    return list;
  }, [normalizedLeaves, filter, typeFilter]);

  const cardStats = useMemo(() => {
    const init = () => ({ total: 0, pending: 0, approved: 0, rejected: 0 });

    const byType: Record<LeaveType, ReturnType<typeof init>> = {
      "Vacation Leave": init(),
      "Sick Leave": init(),
      "Emergency Leave": init(),
      "Maternity/Paternity Leave": init(),
    };

    for (const leave of normalizedLeaves) {
      const bucket = byType[leave.type];
      bucket.total += 1;
      if (leave.status === "Pending") bucket.pending += 1;
      if (leave.status === "Approved") bucket.approved += 1;
      if (leave.status === "Rejected") bucket.rejected += 1;
    }

    return byType;
  }, [normalizedLeaves]);

  const hasAnyFilter = filter !== "All" || typeFilter !== "All";

  const onChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setForm((prev) => ({
      ...prev,
      attachmentName: file ? file.name : null,
    }));
  };

  const clearFile = () => {
    if (fileRef.current) {
      fileRef.current.value = "";
    }

    setForm((prev) => ({ ...prev, attachmentName: null }));
  };

  const resetForm = () => {
    setForm({
      type: "Vacation Leave",
      dateFrom: "",
      dateTo: "",
      reason: "",
      attachmentName: null,
    });
    setEditingId(null);
    clearFile();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const openCreateModal = () => {
    if (!currentAdmin) {
      notifyError("No logged in admin found.");
      return;
    }

    setEditingId(null);
    resetForm();
    setIsModalOpen(true);
  };

  const validate = () => {
    if (!currentAdmin) {
      notifyError("No logged in admin found.");
      return false;
    }

    if (!form.dateFrom.trim()) {
      notifyError("Date From is required.");
      return false;
    }

    if (!form.dateTo.trim()) {
      notifyError("Date To is required.");
      return false;
    }

    if (safeISO(form.dateTo) < safeISO(form.dateFrom)) {
      notifyError("Date To must be on or after Date From.");
      return false;
    }

    if (!form.reason.trim()) {
      notifyError("Reason is required.");
      return false;
    }

    return true;
  };

  const save = () => {
    if (!validate() || !currentAdmin) return;

    const payload: StoredLeaveRequest = {
      id: editingId ?? createId(),
      employee: currentAdmin.name,
      type: form.type,
      reason: form.reason.trim(),
      status: "Pending",
      dateFrom: form.dateFrom,
      dateTo: form.dateTo,
      startDate: form.dateFrom,
      endDate: form.dateTo,
      days: diffDaysInclusive(form.dateFrom, form.dateTo),
      attachmentName: form.attachmentName,
      fileName: form.attachmentName ?? undefined,
      appliedOn: todayISO(),
      date: undefined,
    };

    if (editingId !== null) {
      setLeaves((prev) =>
        prev.map((leave) =>
          leave.id === editingId
            ? {
                ...leave,
                ...payload,
                // preserve existing approval decision only if you want:
                // but since admin is editing own request, reset to pending is safer
                status: "Pending",
              }
            : leave
        )
      );

      notifySuccess("Leave request updated.");
    } else {
      setLeaves((prev) => [payload, ...prev]);
      notifySuccess("Leave request submitted.");
    }

    closeModal();
  };

  const edit = (leave: NormalizedLeaveRequest) => {
    if (!currentAdmin || leave.employee !== currentAdmin.name) {
      notifyError("You can only edit your own leave requests.");
      return;
    }

    setEditingId(leave.id);
    setForm({
      type: leave.type,
      dateFrom: leave.dateFrom,
      dateTo: leave.dateTo,
      reason: leave.reason,
      attachmentName: leave.attachmentName,
    });
    if (fileRef.current) fileRef.current.value = "";
    setIsModalOpen(true);
  };

  const setStatus = (id: number, status: "Approved" | "Rejected") => {
  const targetLeave = normalizedLeaves.find((leave) => leave.id === id);

  if (!targetLeave) {
    notifyError("Leave request not found.");
    return;
  }

  if (currentAdmin && targetLeave.employee === currentAdmin.name) {
    notifyError("You cannot approve or reject your own leave request.");
    return;
  }

  setLeaves((prev) =>
    prev.map((leave) => (leave.id === id ? { ...leave, status } : leave))
  );

  notifySuccess(`Leave ${status.toLowerCase()}.`);
};

  const clearType = () => setTypeFilter("All");
  const clearAllFilters = () => {
    setFilter("All");
    setTypeFilter("All");
  };

  const openType = (type: LeaveType) => setTypeFilter(type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-text-heading">
            Leave Requests
          </div>
          <div className="text-sm text-text-primary/70">
            {formatFullDate(now)}
          </div>
        </div>

        <div className="bg-primary text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
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
          value={cardStats["Vacation Leave"].total}
          breakdown={cardStats["Vacation Leave"]}
          active={typeFilter === "Vacation Leave"}
          onClick={() => openType("Vacation Leave")}
        />
        <LeaveSummaryCard
          title="SICK LEAVE"
          value={cardStats["Sick Leave"].total}
          breakdown={cardStats["Sick Leave"]}
          active={typeFilter === "Sick Leave"}
          onClick={() => openType("Sick Leave")}
        />
        <LeaveSummaryCard
          title="EMERGENCY LEAVE"
          value={cardStats["Emergency Leave"].total}
          breakdown={cardStats["Emergency Leave"]}
          active={typeFilter === "Emergency Leave"}
          onClick={() => openType("Emergency Leave")}
        />
        <LeaveSummaryCard
          title="MATERNITY/PATERNITY LEAVE"
          value={cardStats["Maternity/Paternity Leave"].total}
          breakdown={cardStats["Maternity/Paternity Leave"]}
          active={typeFilter === "Maternity/Paternity Leave"}
          onClick={() => openType("Maternity/Paternity Leave")}
        />
      </div>

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary/70">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </div>

          <AnimatePresence>
            {typeFilter !== "All" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-soft text-text-heading text-xs font-semibold"
              >
                <span className="text-text-primary/70">Type:</span>
                <span className="font-extrabold">
                  {LEAVE_TYPE_LABEL[typeFilter]}
                </span>
                <button
                  onClick={clearType}
                  className="ml-1 h-5 w-5 rounded-full bg-card border border-primary/30 hover:bg-soft flex items-center justify-center"
                  aria-label="Clear leave type filter"
                  title="Clear type"
                  type="button"
                >
                  <X className="h-3 w-3" />
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
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {!hasAnyFilter && (
            <div className="text-xs text-text-primary/60">
              No filters applied
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={clearAllFilters}
            disabled={!hasAnyFilter}
            className={[
              "px-3 py-2 rounded-xl text-xs font-bold border transition",
              hasAnyFilter
                ? "bg-primary text-white border-primary hover:opacity-90"
                : "bg-soft text-text-primary/50 border-slate-200 cursor-not-allowed",
            ].join(" ")}
            type="button"
          >
            Clear all
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-bold shadow-sm hover:opacity-90 transition"
            type="button"
          >
            <Plus className="h-4 w-4" />
            File Leave Request
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
            <div className="h-10 w-10 rounded-xl bg-soft flex items-center justify-center text-primary">
              <BookText className="h-5 w-5" />
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

          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={[
                  "px-3 py-1.5 rounded-lg text-xs font-semibold border transition",
                  item === filter
                    ? "bg-primary text-white border-primary"
                    : "bg-card text-text-heading border-slate-200 hover:bg-soft",
                ].join(" ")}
                type="button"
              >
                {item}
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
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-text-primary/70"
                >
                  No leave requests found.
                </td>
              </tr>
            ) : (
              filteredLeaves.map((leave) => (
                <motion.tr
                  key={leave.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                >
                  <td className="px-4 py-3">{leave.employee}</td>
                  <td className="px-4 py-3">{LEAVE_TYPE_LABEL[leave.type]}</td>
                  <td className="px-4 py-3 text-xs text-text-primary/70">
                    {leave.dateFrom && leave.dateTo
                      ? `${leave.dateFrom} → ${leave.dateTo}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {leave.days || "—"}
                  </td>
                  <td className="px-4 py-3">{leave.reason}</td>
                  <td className="px-4 py-3">{leave.appliedOn ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={statusPillClass(leave.status)}>
                      {leave.status === "Pending" && (
                        <Clock3 className="h-3.5 w-3.5" />
                      )}
                      {leave.status === "Approved" && (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {leave.status === "Rejected" && (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      {leave.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {currentAdmin?.name === leave.employee && (
                        <button
                          onClick={() => edit(leave)}
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-semibold"
                          type="button"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      )}

                      {leave.status === "Pending" &&
  currentAdmin?.name !== leave.employee && (
    <>
      <button
        onClick={() => setStatus(leave.id, "Approved")}
        className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:underline font-semibold"
        type="button"
      >
        <Check className="h-3.5 w-3.5" />
        Approve
      </button>
      <button
        onClick={() => setStatus(leave.id, "Rejected")}
        className="inline-flex items-center gap-1.5 text-sm text-red-700 hover:underline font-semibold"
        type="button"
      >
        <X className="h-3.5 w-3.5" />
        Reject
      </button>
    </>
  )}
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </AnimatePresence>
        </AdminTable>
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
            />

            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden border border-primary/20 shadow-xl bg-card flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-primary px-6 py-6">
                  <div className="flex items-start justify-between gap-4 text-white">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-2xl bg-white/15 flex items-center justify-center">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-2xl font-extrabold leading-tight">
                          {editingId ? "Update Leave Request" : "File Leave Request"}
                        </div>
                        <div className="text-sm opacity-90">
                          This request will be submitted as{" "}
                          <span className="font-bold">
                            {currentAdmin?.name ?? "Current Admin"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={closeModal}
                      type="button"
                      className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                      aria-label="Close modal"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="p-5 md:p-6 space-y-5 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="ADMIN">
                      <div className="w-full rounded-2xl border border-slate-200 bg-soft px-5 py-4 text-base font-semibold text-text-heading flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <span>{currentAdmin?.name ?? "No logged in admin"}</span>
                      </div>
                    </Field>

                    <Field label="LEAVE TYPE">
                      <select
                        name="type"
                        value={form.type}
                        onChange={onChange}
                        className="w-full rounded-2xl border border-slate-200 bg-card px-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {LEAVE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {LEAVE_TYPE_LABEL[type]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Field label="DATE FROM">
                      <div className="relative">
                        <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-primary/50" />
                        <input
                          name="dateFrom"
                          type="date"
                          value={form.dateFrom}
                          onChange={onChange}
                          className="w-full rounded-2xl border border-slate-200 bg-card pl-11 pr-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </Field>

                    <Field label="DATE TO">
                      <div className="relative">
                        <CalendarRange className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-primary/50" />
                        <input
                          name="dateTo"
                          type="date"
                          value={form.dateTo}
                          onChange={onChange}
                          className="w-full rounded-2xl border border-slate-200 bg-card pl-11 pr-5 py-4 text-base font-semibold text-text-heading outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </Field>
                  </div>

                  <Field label="REASON">
                    <textarea
                      name="reason"
                      value={form.reason}
                      onChange={onChange}
                      placeholder="Provide a reason for your leave..."
                      className="w-full rounded-2xl border border-slate-200 bg-card px-5 py-4 text-base outline-none focus:ring-2 focus:ring-primary/30 min-h-[110px]"
                    />
                  </Field>

                  <Field label="SUPPORTING DOCUMENT" optional>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="w-full rounded-2xl border border-slate-200 bg-card px-5 py-4 text-left flex items-center gap-3 outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <Paperclip className="h-5 w-5 text-text-primary/70" />
                      <span className="text-text-primary/70 truncate">
                        {form.attachmentName || "No file chosen"}
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

                    <input
                      ref={fileRef}
                      type="file"
                      onChange={onPickFile}
                      className="hidden"
                    />
                  </Field>

                  <div className="pt-2 flex items-center gap-3 flex-wrap">
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={save}
                      className="inline-flex items-center gap-2 bg-primary hover:opacity-90 text-white px-7 py-3 rounded-2xl text-base font-extrabold shadow-sm"
                      type="button"
                    >
                      <Send className="h-4 w-4" />
                      <span>
                        {editingId ? "Update Request" : "Submit Request"}
                      </span>
                    </motion.button>

                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={closeModal}
                      className="inline-flex items-center gap-2 bg-soft hover:bg-background text-text-primary px-7 py-3 rounded-2xl text-base font-extrabold"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
  children: ReactNode;
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
          <span className="font-semibold text-text-heading">
            {breakdown.approved}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Rejected</span>
          <span className="font-semibold text-text-heading">
            {breakdown.rejected}
          </span>
        </div>
      </div>
    </motion.button>
  );
}