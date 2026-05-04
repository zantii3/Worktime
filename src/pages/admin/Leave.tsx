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
  X,
  XCircle,
  Eye,
  Download,
  Image as ImageIcon,
  User,
  UserCog,
  Info,
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

import staticAccounts from "../data/accounts.json";
import staticAdmins from "./data/adminAccounts.json";

// ─── Extended status type (admin sees all states) ─────────────────────────────
type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Pre-Approved" | "Pre-Rejected";
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
  attachmentBase64?: string;
  attachmentMime?: string;
  startDate?: string;
  endDate?: string;
  fileName?: string;
  appliedOn?: string;
  date?: string;
  days?: number;
  // Pre-approval metadata (written by HR / project leader on the user side)
  preReviewedBy?: string;
  preReviewedById?: number;
  preReviewedByRole?: string;
  preReviewedAt?: string;
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
  attachmentBase64?: string;
  attachmentMime?: string;
  appliedOn?: string;
  days: number;
  preReviewedBy?: string;
  preReviewedByRole?: string;
  preReviewedAt?: string;
};

type LeaveForm = {
  type: LeaveType;
  dateFrom: string;
  dateTo: string;
  reason: string;
  attachmentName: string | null;
  attachmentBase64?: string;
  attachmentMime?: string;
};

type CurrentAdmin = { id: number; email: string; name: string };

const ALL_LEAVES_KEY        = STORAGE_KEY;
const CREATED_ACCOUNTS_KEY  = "worktime_created_accounts_v1";
const EDITS_KEY             = "worktime_account_edits_v1";

// All statuses the admin can filter by
const STATUS_FILTERS = ["All", "Pending", "Pre-Approved", "Pre-Rejected", "Approved", "Rejected"] as const;
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

function formatDate(s: string) {
  if (!s) return "—";
  return new Date(`${s}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
  const dateTo   = record.dateTo   || record.endDate   || record.date || "";
  const days =
    dateFrom && dateTo
      ? diffDaysInclusive(dateFrom, dateTo)
      : typeof record.days === "number"
      ? record.days
      : 0;
  return {
    id:               record.id,
    employee:         record.employee || "Unknown",
    type:             normalizeLeaveType(record.type),
    dateFrom,
    dateTo,
    reason:           record.reason || "",
    status:           record.status || "Pending",
    attachmentName:   record.attachmentName ?? record.fileName ?? null,
    attachmentBase64: record.attachmentBase64,
    attachmentMime:   record.attachmentMime,
    appliedOn:        record.appliedOn ?? record.date,
    days,
    preReviewedBy:    record.preReviewedBy,
    preReviewedByRole: record.preReviewedByRole,
    preReviewedAt:    record.preReviewedAt,
  };
}

function readLeavesFromStorage(): StoredLeaveRequest[] {
  try {
    const raw    = localStorage.getItem(ALL_LEAVES_KEY);
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

function getAllKnownNames(): Set<string> {
  const names = new Set<string>();
  (staticAccounts as { name: string }[]).forEach((a) => names.add(a.name));
  (staticAdmins   as { name: string }[]).forEach((a) => names.add(a.name));
  try {
    const edits = JSON.parse(localStorage.getItem(EDITS_KEY) || "{}") as Record<
      string,
      { name?: string }
    >;
    Object.values(edits).forEach((e) => e.name && names.add(e.name));
  } catch {}
  try {
    const created = JSON.parse(
      localStorage.getItem(CREATED_ACCOUNTS_KEY) || "[]"
    ) as { name: string }[];
    created.forEach((a) => names.add(a.name));
  } catch {}
  return names;
}

// ─── Status pill — extended for pre-approval states ───────────────────────────

function StatusPill({ status }: { status: LeaveStatus }) {
  const map: Record<LeaveStatus, { cls: string; icon: React.ElementType; label: string }> = {
    Pending: {
      cls:   "bg-amber-50 text-amber-700 border-amber-200",
      icon:  Clock3,
      label: "Pending",
    },
    Approved: {
      cls:   "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon:  CheckCircle2,
      label: "Approved",
    },
    Rejected: {
      cls:   "bg-rose-50 text-rose-700 border-rose-200",
      icon:  XCircle,
      label: "Rejected",
    },
    "Pre-Approved": {
      cls:   "bg-teal-50 text-teal-700 border-teal-200",
      icon:  ShieldCheck,
      label: "Pre-Approved",
    },
    "Pre-Rejected": {
      cls:   "bg-orange-50 text-orange-700 border-orange-200",
      icon:  UserCog,
      label: "Pre-Rejected",
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

// ─── Pre-review info banner (shown inside review modal) ───────────────────────

function PreReviewInfoBanner({ leave }: { leave: NormalizedLeaveRequest }) {
  if (leave.status !== "Pre-Approved" && leave.status !== "Pre-Rejected") return null;
  const isPreApproved = leave.status === "Pre-Approved";
  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
      isPreApproved
        ? "bg-teal-50 border-teal-200"
        : "bg-orange-50 border-orange-200"
    }`}>
      <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
        isPreApproved ? "bg-teal-100" : "bg-orange-100"
      }`}>
        {isPreApproved
          ? <ShieldCheck className={`h-4 w-4 text-teal-700`} />
          : <UserCog className={`h-4 w-4 text-orange-700`} />
        }
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-bold ${isPreApproved ? "text-teal-800" : "text-orange-800"}`}>
          {isPreApproved ? "Pre-approved" : "Pre-rejected"} by {leave.preReviewedBy ?? "a reviewer"}
          {leave.preReviewedByRole ? ` (${leave.preReviewedByRole})` : ""}
        </p>
        {leave.preReviewedAt && (
          <p className={`text-xs mt-0.5 ${isPreApproved ? "text-teal-600" : "text-orange-600"}`}>
            {formatDate(leave.preReviewedAt.split("T")[0])}
          </p>
        )}
        <p className={`text-xs mt-1 ${isPreApproved ? "text-teal-700" : "text-orange-700"}`}>
          As admin, you have final authority. You can approve or reject regardless of the pre-review.
        </p>
      </div>
    </div>
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
  breakdown: { total: number; pending: number; approved: number; rejected: number; preApproved: number; preRejected: number };
  active?: boolean;
  onClick?: () => void;
}) {
  const meta        = LEAVE_TYPE_META[type];
  const Icon        = meta.icon;
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
      <div className="flex items-start justify-between gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} ${meta.border} border`}>
          <Icon className={`h-5 w-5 ${meta.color}`} />
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold text-text-heading tabular-nums leading-none">
            {breakdown.total}
          </div>
          <div className="text-[10px] text-text-primary/50 mt-0.5">requests</div>
        </div>
      </div>
      <div className="mt-3">
        <div className="text-xs font-bold text-text-heading leading-tight">{meta.label}</div>
      </div>
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
      <div className="mt-3 grid grid-cols-2 gap-1 text-[10px]">
        {[
          { label: "Pending",      value: breakdown.pending,     cls: "text-amber-600"   },
          { label: "Approved",     value: breakdown.approved,    cls: "text-emerald-600" },
          { label: "Pre-Approved", value: breakdown.preApproved, cls: "text-teal-600"    },
          { label: "Rejected",     value: breakdown.rejected,    cls: "text-rose-600"    },
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

// ─── File Preview Modal ───────────────────────────────────────────────────────

function FilePreviewModal({
  fileName,
  base64,
  mime,
  onClose,
}: {
  fileName: string;
  base64: string;
  mime: string;
  onClose: () => void;
}) {
  const isImage = mime.startsWith("image/");
  const isPdf   = mime === "application/pdf";

  const handleDownload = () => {
    const link    = document.createElement("a");
    link.href     = base64;
    link.download = fileName;
    link.click();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-3xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary/10 rounded-xl shrink-0">
                {isImage ? (
                  <ImageIcon className="w-5 h-5 text-primary" />
                ) : (
                  <FileText className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-text-heading text-sm truncate">{fileName}</p>
                <p className="text-xs text-slate-400 mt-0.5">Supporting Document</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 transition"
                type="button"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition" type="button">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100">
            {isImage ? (
              <img src={base64} alt={fileName} className="max-w-full max-h-[60vh] rounded-xl shadow-md object-contain" />
            ) : isPdf ? (
              <iframe src={base64} title={fileName} className="w-full h-[60vh] rounded-xl border border-slate-200 bg-white" />
            ) : (
              <div className="flex flex-col items-center gap-4 py-12 text-slate-400">
                <div className="p-5 bg-white rounded-2xl shadow border border-slate-200">
                  <FileText className="w-12 h-12 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">Preview not available for this file type</p>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition"
                  type="button"
                >
                  <Download className="w-4 h-4" />
                  Download to view
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Review Modal — admin version with final override ─────────────────────────

function ReviewModal({
  leave,
  resolvedName,
  onClose,
  onApprove,
  onReject,
}: {
  leave: NormalizedLeaveRequest;
  resolvedName: string | null;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject:  (id: number) => void;
}) {
  const [showFilePreview, setShowFilePreview] = useState(false);
  const isSelf = leave.employee === resolvedName;

  // Admin can ALWAYS finalize (approve/reject), even if pre-approved/pre-rejected.
  // The only restriction is they can't act on their own requests.
  const isAlreadyFinal = leave.status === "Approved" || leave.status === "Rejected";
  const canAct         = !isSelf && !isAlreadyFinal;

  const initials = leave.employee
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  const isImage    = leave.attachmentMime?.startsWith("image/");
  const hasPreviewed = !!(leave.attachmentBase64 && leave.attachmentMime);

  return (
    <>
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-lg max-h-[92vh] rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-card flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="bg-primary px-6 py-5 shrink-0">
              <div className="flex items-start justify-between gap-4 text-white">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-extrabold leading-tight">Review Leave Request</div>
                    <div className="text-sm text-white/70 mt-0.5">
                      {isAlreadyFinal
                        ? `Already ${leave.status.toLowerCase()} — view only`
                        : isSelf
                        ? "Cannot act on your own request"
                        : "Admin final decision — overrides any pre-review"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  type="button"
                  className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Employee info */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-extrabold text-primary">{initials}</span>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-text-heading text-base truncate">{leave.employee}</div>
                  {leave.appliedOn && (
                    <div className="text-xs text-slate-400 mt-0.5">Filed on {formatDate(leave.appliedOn)}</div>
                  )}
                  {isSelf && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Your own request
                    </span>
                  )}
                </div>
                <div className="ml-auto shrink-0">
                  <StatusPill status={leave.status} />
                </div>
              </div>

              {/* Pre-review banner — shown when HR/leader has already acted */}
              <PreReviewInfoBanner leave={leave} />

              {/* Leave type + days */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Leave Type</div>
                  <LeaveTypeBadge type={leave.type} />
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Duration</div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-extrabold text-primary tabular-nums">{leave.days}</span>
                    <span className="text-sm text-slate-500">day{leave.days !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>

              {/* Date range */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Date Range</div>
                <div className="flex items-center gap-2 text-sm font-semibold text-text-heading">
                  <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                  {formatDateRange(leave.dateFrom, leave.dateTo)}
                </div>
              </div>

              {/* Reason */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Reason</div>
                <p className="text-sm text-text-primary leading-relaxed">{leave.reason || "—"}</p>
              </div>

              {/* Attachment */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">
                  Supporting Document
                </div>
                {leave.attachmentName ? (
                  <div className="space-y-3">
                    {isImage && leave.attachmentBase64 && (
                      <div
                        className="relative w-full h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-200 cursor-pointer group"
                        onClick={() => setShowFilePreview(true)}
                      >
                        <img src={leave.attachmentBase64} alt={leave.attachmentName} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 bg-white/90 px-3 py-1.5 rounded-xl shadow">
                            <Eye className="w-4 h-4 text-primary" />
                            <span className="text-xs font-semibold text-primary">View Full</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl flex-1 min-w-0">
                        {isImage ? (
                          <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="text-sm text-text-heading font-medium truncate">{leave.attachmentName}</span>
                      </div>
                      {hasPreviewed && (
                        <button
                          type="button"
                          onClick={() => setShowFilePreview(true)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/15 transition shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </button>
                      )}
                      {leave.attachmentBase64 && (
                        <button
                          type="button"
                          onClick={() => {
                            const link    = document.createElement("a");
                            link.href     = leave.attachmentBase64!;
                            link.download = leave.attachmentName!;
                            link.click();
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      )}
                      {!leave.attachmentBase64 && (
                        <span className="text-xs text-slate-400 italic">File not stored</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Paperclip className="w-4 h-4" />
                    <span className="text-sm italic">No document attached</span>
                  </div>
                )}
              </div>

              {/* Admin override note when pre-reviewed */}
              {(leave.status === "Pre-Approved" || leave.status === "Pre-Rejected") && !isSelf && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>
                    This was {leave.status === "Pre-Approved" ? "pre-approved" : "pre-rejected"} by{" "}
                    <span className="font-semibold">{leave.preReviewedBy}</span>.
                    Your decision below is <span className="font-semibold">final</span> and overrides it.
                  </p>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-6 pb-6 pt-3 shrink-0 border-t border-slate-100">
              {canAct ? (
                <div className="flex items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { onApprove(leave.id); onClose(); }}
                    type="button"
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-700 transition"
                  >
                    <Check className="h-4 w-4" />
                    {leave.status === "Pre-Approved" ? "Confirm Approval" : "Approve"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { onReject(leave.id); onClose(); }}
                    type="button"
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-rose-500 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-rose-600 transition"
                  >
                    <X className="h-4 w-4" />
                    {leave.status === "Pre-Rejected" ? "Confirm Rejection" : "Reject"}
                  </motion.button>
                  <button
                    onClick={onClose}
                    type="button"
                    className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-text-heading hover:bg-soft transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-sm text-slate-400 italic">
                    {isSelf
                      ? "You cannot act on your own request."
                      : `This request is already ${leave.status.toLowerCase()}.`}
                  </div>
                  <button
                    onClick={onClose}
                    type="button"
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-text-heading hover:bg-soft transition"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {showFilePreview && leave.attachmentBase64 && leave.attachmentMime && (
        <FilePreviewModal
          fileName={leave.attachmentName!}
          base64={leave.attachmentBase64}
          mime={leave.attachmentMime}
          onClose={() => setShowFilePreview(false)}
        />
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Leave() {
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(() =>
    readCurrentAdmin()
  );

  const adminDisplayName = useMemo(
    () => (currentAdmin ? resolveAdminName(currentAdmin) : null),
    [currentAdmin]
  );

  const [leaves, setLeaves]           = useState<StoredLeaveRequest[]>(() => readLeavesFromStorage());
  const [now,    setNow]              = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [typeFilter,   setTypeFilter]   = useState<LeaveType | "All">("All");
  const [search,       setSearch]       = useState("");
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingId,    setEditingId]    = useState<number | null>(null);
  const [reviewLeave,  setReviewLeave]  = useState<NormalizedLeaveRequest | null>(null);
  const [form, setForm] = useState<LeaveForm>({
    type:             "Vacation Leave",
    dateFrom:         "",
    dateTo:           "",
    reason:           "",
    attachmentName:   null,
    attachmentBase64: undefined,
    attachmentMime:   undefined,
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
      if (e.key === ALL_LEAVES_KEY) setLeaves(readLeavesFromStorage());
      if (e.key === "currentAdmin")  setCurrentAdmin(readCurrentAdmin());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const normalizedLeaves = useMemo(() => leaves.map(normalizeLeave), [leaves]);

  const filteredLeaves = useMemo(() => {
    let list = normalizedLeaves;
    if (statusFilter !== "All") list = list.filter((l) => l.status === statusFilter);
    if (typeFilter   !== "All") list = list.filter((l) => l.type   === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list    = list.filter(
        (l) =>
          l.employee.toLowerCase().includes(q) ||
          l.reason.toLowerCase().includes(q)   ||
          l.type.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      // Priority: Pre-Approved → Pending → Pre-Rejected → rest
      const order: Record<LeaveStatus, number> = {
        "Pre-Approved": 0,
        Pending:        1,
        "Pre-Rejected": 2,
        Approved:       3,
        Rejected:       4,
      };
      const diff = (order[a.status] ?? 5) - (order[b.status] ?? 5);
      if (diff !== 0) return diff;
      return (b.appliedOn ?? "").localeCompare(a.appliedOn ?? "");
    });
  }, [normalizedLeaves, statusFilter, typeFilter, search]);

  const cardStats = useMemo(() => {
    const init = () => ({ total: 0, pending: 0, approved: 0, rejected: 0, preApproved: 0, preRejected: 0 });
    const byType: Record<LeaveType, ReturnType<typeof init>> = {
      "Vacation Leave":             init(),
      "Sick Leave":                 init(),
      "Emergency Leave":            init(),
      "Maternity/Paternity Leave":  init(),
    };
    for (const l of normalizedLeaves) {
      const b = byType[l.type];
      b.total++;
      if (l.status === "Pending")      b.pending++;
      if (l.status === "Approved")     b.approved++;
      if (l.status === "Rejected")     b.rejected++;
      if (l.status === "Pre-Approved") b.preApproved++;
      if (l.status === "Pre-Rejected") b.preRejected++;
    }
    return byType;
  }, [normalizedLeaves]);

  const pendingCount = useMemo(
    () => normalizedLeaves.filter((l) => l.status === "Pending" || l.status === "Pre-Approved" || l.status === "Pre-Rejected").length,
    [normalizedLeaves]
  );

  const hasFilters = statusFilter !== "All" || typeFilter !== "All" || search.trim() !== "";

  const onChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime   = file.type;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((p) => ({
        ...p,
        attachmentName:   file.name,
        attachmentBase64: reader.result as string,
        attachmentMime:   mime,
      }));
    };
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    if (fileRef.current) fileRef.current.value = "";
    setForm((p) => ({ ...p, attachmentName: null, attachmentBase64: undefined, attachmentMime: undefined }));
  };

  const resetForm = () => {
    setForm({
      type:             "Vacation Leave",
      dateFrom:         "",
      dateTo:           "",
      reason:           "",
      attachmentName:   null,
      attachmentBase64: undefined,
      attachmentMime:   undefined,
    });
    setEditingId(null);
    clearFile();
  };

  const closeModal = () => { setIsModalOpen(false); resetForm(); };

  const openCreateModal = () => {
    if (!currentAdmin) { notifyError("No logged in admin found."); return; }
    setEditingId(null);
    resetForm();
    setIsModalOpen(true);
  };

  const validate = () => {
    if (!currentAdmin)           { notifyError("No logged in admin found."); return false; }
    if (!form.dateFrom.trim())   { notifyError("Date From is required.");    return false; }
    if (!form.dateTo.trim())     { notifyError("Date To is required.");      return false; }
    if (safeISO(form.dateTo) < safeISO(form.dateFrom)) {
      notifyError("Date To must be on or after Date From.");
      return false;
    }
    if (!form.reason.trim()) { notifyError("Reason is required."); return false; }
    return true;
  };

  const save = () => {
    if (!validate() || !currentAdmin) return;
    const employeeName = adminDisplayName ?? currentAdmin.name;

    const payload: StoredLeaveRequest = {
      id:               editingId ?? createId(),
      employee:         employeeName,
      type:             form.type,
      reason:           form.reason.trim(),
      status:           "Pending",
      dateFrom:         form.dateFrom,
      dateTo:           form.dateTo,
      startDate:        form.dateFrom,
      endDate:          form.dateTo,
      days:             diffDaysInclusive(form.dateFrom, form.dateTo),
      attachmentName:   form.attachmentName,
      attachmentBase64: form.attachmentBase64,
      attachmentMime:   form.attachmentMime,
      fileName:         form.attachmentName ?? undefined,
      appliedOn:        todayISO(),
    };

    if (editingId !== null) {
      setLeaves((prev) =>
        prev.map((l) => l.id === editingId ? { ...l, ...payload, status: "Pending" } : l)
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
      type:             leave.type,
      dateFrom:         leave.dateFrom,
      dateTo:           leave.dateTo,
      reason:           leave.reason,
      attachmentName:   leave.attachmentName,
      attachmentBase64: leave.attachmentBase64,
      attachmentMime:   leave.attachmentMime,
    });
    if (fileRef.current) fileRef.current.value = "";
    setIsModalOpen(true);
  };

  /** Admin final decision — always overrides any pre-approval state. */
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
    const wasPreReviewed = target.status === "Pre-Approved" || target.status === "Pre-Rejected";
    notifySuccess(
      wasPreReviewed
        ? `Leave ${status.toLowerCase()} (overrides ${target.status.toLowerCase()}).`
        : `Leave ${status.toLowerCase()}.`
    );
  };

  const toggleTypeFilter = (type: LeaveType) => {
    setTypeFilter((prev) => (prev === type ? "All" : type));
  };

  const clearAllFilters = () => {
    setStatusFilter("All");
    setTypeFilter("All");
    setSearch("");
  };

  const resolvedName = currentAdmin ? (adminDisplayName ?? currentAdmin.name) : null;

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
                    month:   "long",
                    day:     "numeric",
                    year:    "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Admin authority badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin — Final Authority
            </span>

            {pendingCount > 0 && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => setStatusFilter("Pending")}
                type="button"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition"
              >
                <Clock3 className="h-4 w-4" />
                {pendingCount} need review
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

        {/* Admin authority notice */}
        <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            As admin, your approval or rejection is <span className="font-semibold">final and overrides</span> any
            pre-approval or pre-rejection made by project leaders or HR staff.
            Requests marked <span className="font-semibold text-teal-700">Pre-Approved</span> or{" "}
            <span className="font-semibold text-orange-700">Pre-Rejected</span> are awaiting your decision.
          </p>
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
                      typeFilter   !== "All" && LEAVE_TYPE_META[typeFilter].label,
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

            <div className="flex items-center gap-1.5 flex-wrap">
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

          <div className="flex items-center gap-3 flex-wrap">
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
                  <button onClick={() => setTypeFilter("All")} type="button" className="ml-0.5 hover:opacity-70">
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
                  "Pre-Reviewer",
                  "Attachment",
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
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-text-primary/40">
                        <div className="h-14 w-14 rounded-2xl bg-soft border border-slate-200 flex items-center justify-center">
                          <BookText className="w-7 h-7 opacity-40" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-text-heading">No leave requests found</div>
                          <div className="text-xs mt-1">
                            {hasFilters ? "Try adjusting your filters." : "No requests have been filed yet."}
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
                    const isSelf           = leave.employee === resolvedName;
                    const isAlreadyFinal   = leave.status === "Approved" || leave.status === "Rejected";
                    const canAct           = !isSelf && !isAlreadyFinal;
                    const hasAttachment    = !!(leave.attachmentName);
                    const isPreReviewed    = leave.status === "Pre-Approved" || leave.status === "Pre-Rejected";

                    return (
                      <motion.tr
                        key={leave.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, delay: idx * 0.02 }}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          isPreReviewed ? "bg-blue-50/30" : ""
                        }`}
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
                        <td className="px-4 py-3 max-w-[140px]">
                          <p className="text-sm text-text-primary/80 line-clamp-2 leading-snug">
                            {leave.reason}
                          </p>
                        </td>

                        {/* Pre-Reviewer */}
                        <td className="px-4 py-3">
                          {leave.preReviewedBy ? (
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                leave.status === "Pre-Approved"
                                  ? "bg-teal-50 text-teal-700 border-teal-200"
                                  : "bg-orange-50 text-orange-700 border-orange-200"
                              }`}>
                                {leave.status === "Pre-Approved"
                                  ? <Check className="w-2.5 h-2.5" />
                                  : <X className="w-2.5 h-2.5" />
                                }
                                {leave.preReviewedBy}
                              </span>
                              {leave.preReviewedByRole && (
                                <span className="text-[10px] text-slate-400">{leave.preReviewedByRole}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300 italic">—</span>
                          )}
                        </td>

                        {/* Attachment */}
                        <td className="px-4 py-3">
                          {hasAttachment ? (
                            <button
                              type="button"
                              onClick={() => setReviewLeave(leave)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-blue-50 border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition"
                              title="View in review modal"
                            >
                              <Paperclip className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[80px]">{leave.attachmentName}</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300 italic">None</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusPill status={leave.status} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Review button — always visible */}
                            <button
                              onClick={() => setReviewLeave(leave)}
                              type="button"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-primary px-2 py-1 rounded-lg hover:bg-primary/5 border border-slate-200 hover:border-primary/20 transition"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Review
                            </button>

                            {/* Own pending — can edit */}
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

                            {/* Quick approve/reject (non-self, non-final) */}
                            {canAct && (
                              <>
                                <button
                                  onClick={() => setStatus(leave.id, "Approved")}
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg transition"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  {isPreReviewed ? "Finalize" : "Approve"}
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

                            {!isSelf && isAlreadyFinal && (
                              <span className="text-xs text-text-primary/30 italic">{leave.status}</span>
                            )}
                            {isSelf && leave.status !== "Pending" && (
                              <span className="text-xs text-text-primary/30 italic">Your request</span>
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

      {/* ── Review Modal ── */}
      <AnimatePresence>
        {reviewLeave && (
          <ReviewModal
            leave={reviewLeave}
            resolvedName={resolvedName}
            onClose={() => setReviewLeave(null)}
            onApprove={(id) => setStatus(id, "Approved")}
            onReject={(id)  => setStatus(id, "Rejected")}
          />
        )}
      </AnimatePresence>

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
            <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden border border-primary/20 shadow-2xl bg-card flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal header */}
                <div className="bg-primary px-6 py-6 shrink-0">
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
                          <span className="font-bold text-white">{resolvedName ?? "Current Admin"}</span>
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
                        const meta     = LEAVE_TYPE_META[type];
                        const Icon     = meta.icon;
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
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                      onChange={onPickFile}
                      className="hidden"
                    />
                    {form.attachmentBase64 && form.attachmentMime?.startsWith("image/") && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                      >
                        <img
                          src={form.attachmentBase64}
                          alt={form.attachmentName ?? "Preview"}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        <span className="absolute bottom-1.5 left-2 text-white text-[10px] font-semibold">Preview</span>
                      </motion.div>
                    )}
                    {form.attachmentBase64 && !form.attachmentMime?.startsWith("image/") && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl"
                      >
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-xs text-blue-700 font-medium truncate flex-1">{form.attachmentName}</span>
                        <span className="text-[10px] text-blue-500 shrink-0">Ready</span>
                      </motion.div>
                    )}
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