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
  Search,
  Send,
  ShieldCheck,
  Stethoscope,
  Palmtree,
  Zap,
  Baby,
  User,
  X,
  XCircle,
  ChevronDown,
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
import { notifyError, notifySuccess } from "./utils/toast";

// ─── Pull all known account names from every source ──────────────────────────
import staticAccounts from "../data/accounts.json";
import staticAdmins from "./data/adminAccounts.json";

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
  dateFrom?: string;
  dateTo?: string;
  attachmentName?: string | null;
  startDate?: string;
  endDate?: string;
  fileName?: string;
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

type CurrentAdmin = { id: number; email: string; name: string };

const ALL_LEAVES_KEY = STORAGE_KEY;
const CREATED_ACCOUNTS_KEY = "worktime_created_accounts_v1";
const EDITS_KEY = "worktime_account_edits_v1";

const STATUS_FILTERS = ["All", "Pending", "Approved", "Rejected"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const LEAVE_TYPES: LeaveType[] = [
  "Vacation Leave",
  "Sick Leave",
  "Emergency Leave",
  "Maternity/Paternity Leave",
];

const LEAVE_TYPE_META: Record<
  LeaveType,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  "Vacation Leave": {
    label: "Vacation Leave",
    icon: Palmtree,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  "Sick Leave": {
    label: "Sick Leave",
    icon: Stethoscope,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  "Emergency Leave": {
    label: "Emergency Leave",
    icon: Zap,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  "Maternity/Paternity Leave": {
    label: "Maternity/Paternity",
    icon: Baby,
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function safeISO(d: string) {
  return new Date(`${d}T00:00:00`).getTime();
}

function diffDaysInclusive(from: string, to: string) {
  const a = safeISO(from);
  const b = safeISO(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000)) + 1;
}

function formatDateRange(from: string, to: string) {
  if (!from || !to) return "—";
  const fmt = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
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

/** Builds the resolved name for an admin, respecting any edits from Users.tsx */
function resolveAdminName(admin: CurrentAdmin): string {
  try {
    const edits = JSON.parse(localStorage.getItem(EDITS_KEY) || "{}") as Record<
      string,
      { name?: string }
    >;
    return edits[`admin:${admin.id}`]?.name ?? admin.name;
  } catch {
    return admin.name;
  }
}

/** Returns the full set of known employee names from all sources */
function getAllKnownNames(): Set<string> {
  const names = new Set<string>();

  // Static accounts
  (staticAccounts as { name: string }[]).forEach((a) => names.add(a.name));
  (staticAdmins as { name: string }[]).forEach((a) => names.add(a.name));

  // Edits override
  try {
    const edits = JSON.parse(localStorage.getItem(EDITS_KEY) || "{}") as Record<
      string,
      { name?: string }
    >;
    Object.values(edits).forEach((e) => e.name && names.add(e.name));
  } catch {}

  // Dynamically created accounts
  try {
    const created = JSON.parse(
      localStorage.getItem(CREATED_ACCOUNTS_KEY) || "[]"
    ) as { name: string }[];
    created.forEach((a) => names.add(a.name));
  } catch {}

  return names;
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: LeaveStatus }) {
  const map: Record<LeaveStatus, { cls: string; icon: React.ElementType; label: string }> = {
    Pending: {
      cls: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Clock3,
      label: "Pending",
    },
    Approved: {
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
      label: "Approved",
    },
    Rejected: {
      cls: "bg-rose-50 text-rose-700 border-rose-200",
      icon: XCircle,
      label: "Rejected",
    },
  };
  const { cls, icon: Icon, label } = map[status] ?? map.Pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

// ─── Leave type badge ─────────────────────────────────────────────────────────

function LeaveTypeBadge({ type }: { type: LeaveType }) {
  const meta = LEAVE_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.bg} ${meta.color} ${meta.border}`}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  type,
  breakdown,
  active,
  onClick,
}: {
  type: LeaveType;
  breakdown: { total: number; pending: number; approved: number; rejected: number };
  active?: boolean;
  onClick?: () => void;
}) {
  const meta = LEAVE_TYPE_META[type];
  const Icon = meta.icon;
  const approvedPct = breakdown.total
    ? Math.round((breakdown.approved / breakdown.total) * 100)
    : 0;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={[
        "text-left bg-card rounded-2xl border p-5 w-full transition-all",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        active
          ? "border-primary shadow-md ring-2 ring-primary/20"
          : "border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md",
      ].join(" ")}
    >
      {/* Icon + title */}
      <div className="flex items-start justify-between gap-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.border} border`}
        >
          <Icon className={`h-5 w-5 ${meta.color}`} />
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold text-text-heading tabular-nums leading-none">
            {breakdown.total}
          </div>
          <div className="text-[10px] text-text-primary/50 mt-0.5">requests</div>
        </div>
      </div>

      {/* Label */}
      <div className="mt-3">
        <div className="text-xs font-bold text-text-heading leading-tight">
          {meta.label}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${approvedPct}%` }}
          transition={{ duration: 0.6, delay: 0.1 }}
        />
      </div>
      <div className="mt-1 text-[10px] text-text-primary/50 text-right">
        {approvedPct}% approved
      </div>

      {/* Breakdown */}
      <div className="mt-3 grid grid-cols-3 gap-1 text-[10px]">
        {[
          { label: "Pending", value: breakdown.pending, cls: "text-amber-600" },
          { label: "Approved", value: breakdown.approved, cls: "text-emerald-600" },
          { label: "Rejected", value: breakdown.rejected, cls: "text-rose-600" },
        ].map(({ label, value, cls }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-0.5 bg-slate-50 rounded-lg py-1.5"
          >
            <span className={`text-base font-extrabold tabular-nums ${cls}`}>{value}</span>
            <span className="text-text-primary/50">{label}</span>
          </div>
        ))}
      </div>
    </motion.button>
  );
}

// ─── Form field wrapper ───────────────────────────────────────────────────────

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
      <div className="text-[11px] font-extrabold tracking-wide text-text-primary/60 uppercase">
        {label}{" "}
        {optional && (
          <span className="font-semibold text-text-primary/40 normal-case">(Optional)</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Employee avatar chip ─────────────────────────────────────────────────────

function EmployeeChip({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-primary">{initials}</span>
      </div>
      <span className="font-medium text-text-heading truncate text-sm">{name}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Leave() {
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(() =>
    readCurrentAdmin()
  );

  // Resolved admin name (respects edits from Users.tsx)
  const adminDisplayName = useMemo(
    () => (currentAdmin ? resolveAdminName(currentAdmin) : null),
    [currentAdmin]
  );

  const [leaves, setLeaves] = useState<StoredLeaveRequest[]>(() =>
    readLeavesFromStorage()
  );
  const [now, setNow] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [typeFilter, setTypeFilter] = useState<LeaveType | "All">("All");
  const [search, setSearch] = useState("");
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

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Persist leaves
  useEffect(() => {
    localStorage.setItem(ALL_LEAVES_KEY, JSON.stringify(leaves));
  }, [leaves]);

  // Cross-tab sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ALL_LEAVES_KEY) setLeaves(readLeavesFromStorage());
      if (e.key === "currentAdmin") setCurrentAdmin(readCurrentAdmin());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const normalizedLeaves = useMemo(
    () => leaves.map(normalizeLeave),
    [leaves]
  );

  // Filtered + searched list
  const filteredLeaves = useMemo(() => {
    let list = normalizedLeaves;
    if (statusFilter !== "All")
      list = list.filter((l) => l.status === statusFilter);
    if (typeFilter !== "All")
      list = list.filter((l) => l.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.employee.toLowerCase().includes(q) ||
          l.reason.toLowerCase().includes(q) ||
          l.type.toLowerCase().includes(q)
      );
    }
    // Sort: pending first, then by appliedOn desc
    return [...list].sort((a, b) => {
      if (a.status === "Pending" && b.status !== "Pending") return -1;
      if (b.status === "Pending" && a.status !== "Pending") return 1;
      return (b.appliedOn ?? "").localeCompare(a.appliedOn ?? "");
    });
  }, [normalizedLeaves, statusFilter, typeFilter, search]);

  // Card stats
  const cardStats = useMemo(() => {
    const init = () => ({ total: 0, pending: 0, approved: 0, rejected: 0 });
    const byType: Record<LeaveType, ReturnType<typeof init>> = {
      "Vacation Leave": init(),
      "Sick Leave": init(),
      "Emergency Leave": init(),
      "Maternity/Paternity Leave": init(),
    };
    for (const l of normalizedLeaves) {
      const b = byType[l.type];
      b.total++;
      if (l.status === "Pending") b.pending++;
      if (l.status === "Approved") b.approved++;
      if (l.status === "Rejected") b.rejected++;
    }
    return byType;
  }, [normalizedLeaves]);

  const pendingCount = useMemo(
    () => normalizedLeaves.filter((l) => l.status === "Pending").length,
    [normalizedLeaves]
  );

  const hasFilters =
    statusFilter !== "All" || typeFilter !== "All" || search.trim() !== "";

  // Form handlers
  const onChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setForm((p) => ({ ...p, attachmentName: file ? file.name : null }));
  };

  const clearFile = () => {
    if (fileRef.current) fileRef.current.value = "";
    setForm((p) => ({ ...p, attachmentName: null }));
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
    if (!currentAdmin) { notifyError("No logged in admin found."); return; }
    setEditingId(null);
    resetForm();
    setIsModalOpen(true);
  };

  const validate = () => {
    if (!currentAdmin) { notifyError("No logged in admin found."); return false; }
    if (!form.dateFrom.trim()) { notifyError("Date From is required."); return false; }
    if (!form.dateTo.trim()) { notifyError("Date To is required."); return false; }
    if (safeISO(form.dateTo) < safeISO(form.dateFrom)) {
      notifyError("Date To must be on or after Date From.");
      return false;
    }
    if (!form.reason.trim()) { notifyError("Reason is required."); return false; }
    return true;
  };

  const save = () => {
    if (!validate() || !currentAdmin) return;

    // Use the resolved display name so it matches any edits made in Users.tsx
    const employeeName = adminDisplayName ?? currentAdmin.name;

    const payload: StoredLeaveRequest = {
      id: editingId ?? createId(),
      employee: employeeName,
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
    };

    if (editingId !== null) {
      setLeaves((prev) =>
        prev.map((l) =>
          l.id === editingId ? { ...l, ...payload, status: "Pending" } : l
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
    if (!currentAdmin) return;
    const resolvedName = adminDisplayName ?? currentAdmin.name;
    if (leave.employee !== resolvedName) {
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
    const target = normalizedLeaves.find((l) => l.id === id);
    if (!target) { notifyError("Leave request not found."); return; }
    const resolvedName = currentAdmin ? (adminDisplayName ?? currentAdmin.name) : "";
    if (target.employee === resolvedName) {
      notifyError("You cannot approve or reject your own leave request.");
      return;
    }
    setLeaves((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status } : l))
    );
    notifySuccess(`Leave ${status.toLowerCase()}.`);
  };

  const toggleTypeFilter = (type: LeaveType) => {
    setTypeFilter((prev) => (prev === type ? "All" : type));
  };

  const clearAllFilters = () => {
    setStatusFilter("All");
    setTypeFilter("All");
    setSearch("");
  };

  const resolvedName = currentAdmin
    ? (adminDisplayName ?? currentAdmin.name)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* ── Header ── */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <BookText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-heading">Leave Management</h1>
                <p className="text-sm text-text-primary/60 mt-0.5">
                  {now.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {pendingCount > 0 && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => setStatusFilter("Pending")}
                type="button"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition"
              >
                <Clock3 className="h-4 w-4" />
                {pendingCount} pending
              </motion.button>
            )}
            <button
              onClick={openCreateModal}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-sm hover:opacity-90 transition"
            >
              <Plus className="h-4 w-4" />
              File Leave
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {LEAVE_TYPES.map((type) => (
          <SummaryCard
            key={type}
            type={type}
            breakdown={cardStats[type]}
            active={typeFilter === type}
            onClick={() => toggleTypeFilter(type)}
          />
        ))}
      </div>

      {/* ── Table card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="bg-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        {/* Table toolbar */}
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="font-bold text-text-heading flex items-center gap-2">
                Leave History
                {(typeFilter !== "All" || statusFilter !== "All") && (
                  <span className="text-xs font-semibold text-text-primary/50">
                    ·{" "}
                    {[
                      typeFilter !== "All" && LEAVE_TYPE_META[typeFilter].label,
                      statusFilter !== "All" && statusFilter,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </div>
              <div className="text-xs text-text-primary/60 mt-0.5">
                {filteredLeaves.length} of {normalizedLeaves.length} requests
              </div>
            </div>

            {/* Status filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  type="button"
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs font-semibold border transition",
                    statusFilter === f
                      ? "bg-primary text-white border-primary"
                      : "bg-card text-text-heading border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Search + filter chips */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee, reason…"
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-text-primary/40"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-primary/40 hover:text-text-heading"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Active filter chips */}
            <AnimatePresence>
              {typeFilter !== "All" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold"
                >
                  <Filter className="h-3 w-3" />
                  {LEAVE_TYPE_META[typeFilter].label}
                  <button
                    onClick={() => setTypeFilter("All")}
                    type="button"
                    className="ml-0.5 hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {hasFilters && (
              <button
                onClick={clearAllFilters}
                type="button"
                className="text-xs font-semibold text-rose-600 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {[
                  "Employee",
                  "Leave Type",
                  "Duration",
                  "Days",
                  "Reason",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence>
                {filteredLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-text-primary/40">
                        <div className="h-14 w-14 rounded-2xl bg-soft border border-slate-200 flex items-center justify-center">
                          <BookText className="w-7 h-7 opacity-40" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-text-heading">
                            No leave requests found
                          </div>
                          <div className="text-xs mt-1">
                            {hasFilters
                              ? "Try adjusting your filters."
                              : "No requests have been filed yet."}
                          </div>
                        </div>
                        {hasFilters && (
                          <button
                            onClick={clearAllFilters}
                            type="button"
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeaves.map((leave, idx) => {
                    const isSelf = leave.employee === resolvedName;
                    const canAct =
                      leave.status === "Pending" && !isSelf;

                    return (
                      <motion.tr
                        key={leave.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, delay: idx * 0.02 }}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Employee */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <EmployeeChip name={leave.employee} />
                            {leave.appliedOn && (
                              <span className="text-[10px] text-text-primary/40 pl-9">
                                Filed {leave.appliedOn}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Leave type */}
                        <td className="px-4 py-3">
                          <LeaveTypeBadge type={leave.type} />
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-3 text-sm text-text-primary/70">
                          {formatDateRange(leave.dateFrom, leave.dateTo)}
                        </td>

                        {/* Days */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary text-xs font-extrabold">
                            {leave.days || "—"}
                          </span>
                        </td>

                        {/* Reason */}
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="text-sm text-text-primary/80 line-clamp-2 leading-snug">
                            {leave.reason}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusPill status={leave.status} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Own pending request — can edit */}
                            {isSelf && leave.status === "Pending" && (
                              <button
                                onClick={() => edit(leave)}
                                type="button"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2 py-1 rounded-lg hover:bg-primary/5 transition"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                            )}

                            {/* Other employee pending — can approve/reject */}
                            {canAct && (
                              <>
                                <button
                                  onClick={() => setStatus(leave.id, "Approved")}
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg transition"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => setStatus(leave.id, "Rejected")}
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 px-2.5 py-1.5 rounded-lg transition"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Reject
                                </button>
                              </>
                            )}

                            {/* Already acted + not own */}
                            {!isSelf && leave.status !== "Pending" && (
                              <span className="text-xs text-text-primary/30 italic">
                                {leave.status}
                              </span>
                            )}

                            {/* Own but already resolved */}
                            {isSelf && leave.status !== "Pending" && (
                              <span className="text-xs text-text-primary/30 italic">
                                Your request
                              </span>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── File Leave Modal ── */}
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
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden border border-primary/20 shadow-2xl bg-card flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal header */}
                <div className="bg-primary px-6 py-6">
                  <div className="flex items-start justify-between gap-4 text-white">
                    <div className="flex items-start gap-4">
                      <div className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xl font-extrabold leading-tight">
                          {editingId ? "Update Leave Request" : "File Leave Request"}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-white/80">
                          <ShieldCheck className="h-4 w-4 text-white/70" />
                          Submitting as{" "}
                          <span className="font-bold text-white">
                            {resolvedName ?? "Current Admin"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={closeModal}
                      type="button"
                      className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Modal body */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                  {/* Leave type */}
                  <Field label="Leave Type">
                    <div className="grid grid-cols-2 gap-2">
                      {LEAVE_TYPES.map((type) => {
                        const meta = LEAVE_TYPE_META[type];
                        const Icon = meta.icon;
                        const selected = form.type === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, type }))}
                            className={[
                              "flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition text-left",
                              selected
                                ? `${meta.bg} ${meta.border} ${meta.color} border-2`
                                : "bg-card border-slate-200 text-text-primary hover:bg-slate-50",
                            ].join(" ")}
                          >
                            <Icon className={`h-4 w-4 shrink-0 ${selected ? meta.color : "text-text-primary/40"}`} />
                            <span className="truncate">{meta.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  {/* Date range */}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Date From">
                      <div className="relative">
                        <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-primary/40 pointer-events-none" />
                        <input
                          name="dateFrom"
                          type="date"
                          value={form.dateFrom}
                          onChange={onChange}
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </Field>
                    <Field label="Date To">
                      <div className="relative">
                        <CalendarRange className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-primary/40 pointer-events-none" />
                        <input
                          name="dateTo"
                          type="date"
                          value={form.dateTo}
                          onChange={onChange}
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </Field>
                  </div>

                  {/* Day count preview */}
                  {form.dateFrom && form.dateTo && safeISO(form.dateTo) >= safeISO(form.dateFrom) && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/15 text-sm text-primary font-semibold"
                    >
                      <CalendarDays className="h-4 w-4" />
                      {diffDaysInclusive(form.dateFrom, form.dateTo)} day
                      {diffDaysInclusive(form.dateFrom, form.dateTo) !== 1 ? "s" : ""} —{" "}
                      {formatDateRange(form.dateFrom, form.dateTo)}
                    </motion.div>
                  )}

                  {/* Reason */}
                  <Field label="Reason">
                    <textarea
                      name="reason"
                      value={form.reason}
                      onChange={onChange}
                      placeholder="Provide a reason for your leave request…"
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </Field>

                  {/* Attachment */}
                  <Field label="Supporting Document" optional>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 px-4 py-3 text-left flex items-center gap-3 transition"
                    >
                      <Paperclip className="h-4 w-4 text-text-primary/50 shrink-0" />
                      <span className="text-sm text-text-primary/60 truncate flex-1">
                        {form.attachmentName || "Click to attach a file…"}
                      </span>
                      {form.attachmentName && (
                        <span
                          onClick={(e) => { e.stopPropagation(); clearFile(); }}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-700 shrink-0"
                        >
                          Remove
                        </span>
                      )}
                    </button>
                    <input ref={fileRef} type="file" onChange={onPickFile} className="hidden" />
                  </Field>
                </div>

                {/* Modal footer */}
                <div className="px-6 pb-6 pt-3 shrink-0 flex items-center gap-3 border-t border-slate-100">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={save}
                    type="button"
                    className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:opacity-90 transition"
                  >
                    <Send className="h-4 w-4" />
                    {editingId ? "Update Request" : "Submit Request"}
                  </motion.button>
                  <button
                    onClick={closeModal}
                    type="button"
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-text-heading hover:bg-soft transition"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}