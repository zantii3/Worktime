import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  Clock,
  CheckCircle2,
  XCircle,
  Clock3,
  ChevronDown,
  Paperclip,
  Send,
  FileUser,
  FileClock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  Eye,
  X,
  Image as ImageIcon,
  Users,
  Check,
  ShieldCheck,
  UserCog,
  Info,
} from "lucide-react";
import { useClock } from "./hooks/useClock";
import Usersidebar from "./components/Usersidebar.tsx";
import type {
  LeaveRequest,
  LeaveType,
  LeaveStatus,
  LeavePolicy,
} from "./types/leavetypes";
import { STORAGE_KEY, POLICY_STORAGE_KEY, defaultLeavePolicy } from "./types/leaveconstants";
import { showError, showSuccess } from "./utils/toast";

// ─── Extended types ───────────────────────────────────────────────────────────

// Extend the canonical LeaveStatus to include pre-approval states.
// These are set by project leaders / HR staff and require admin finalization.
type ExtendedLeaveStatus = LeaveStatus | "Pre-Approved" | "Pre-Rejected";

interface LeaveForm {
  type: LeaveType;
  dateFrom: string;
  dateTo: string;
  reason: string;
}

interface LeaveRequestWithAttachment extends LeaveRequest {
  attachmentBase64?: string;
  attachmentMime?: string;
  // Pre-approval metadata written by project leader / HR
  preReviewedBy?: string;
  preReviewedById?: number;
  preReviewedByRole?: string;
  preReviewedAt?: string;
  // Override the status to accept extended values
  status: ExtendedLeaveStatus;
}

// ─── Storage constants ────────────────────────────────────────────────────────

const ALL_LEAVES_KEY        = STORAGE_KEY;
const ROWS_PER_PAGE         = 5;
const PROJECTS_KEY          = "worktime_projects_v1";
const CREATED_ACCOUNTS_KEY  = "worktime_created_accounts_v1";
const DELETED_IDS_KEY       = "worktime_deleted_account_ids_v1";
const EDITS_KEY             = "worktime_account_edits_v1";

// ─── Role detection helpers ───────────────────────────────────────────────────

type StoredCreatedAccount = {
  id: number;
  kind: "user" | "admin";
  name: string;
  email: string;
  roleLabel: string;
};

type AccountEdit = {
  name?: string;
  email?: string;
  password?: string;
  roleLabel?: string;
  department?: string;
};

type EditsMap = Record<string, AccountEdit>;

function safeReadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Resolve the current roleLabel for a user account from the edit/created LS layers. */
function resolveUserRole(userId: number): string {
  const deleted = new Set<string>(safeReadLS<string[]>(DELETED_IDS_KEY, []));
  if (deleted.has(`user:${userId}`)) return "";

  const edits   = safeReadLS<EditsMap>(EDITS_KEY, {});
  const editKey = `user:${userId}`;
  if (edits[editKey]?.roleLabel) return edits[editKey].roleLabel!;

  // Check locally-created accounts
  const created = safeReadLS<StoredCreatedAccount[]>(CREATED_ACCOUNTS_KEY, []);
  const local   = created.find((a) => a.kind === "user" && a.id === userId);
  if (local?.roleLabel) return local.roleLabel;

  // Static JSON accounts don't have roleLabel by default ("Employee")
  return "Employee";
}

/** Returns true if the role is HR Manager or HR Specialist. */
function isHRRole(role: string): boolean {
  return role === "HR Manager" || role === "HR Specialist";
}

type StoredProject = {
  id: number;
  leaderId: number;
  memberIds?: number[];
};

/** Returns all project IDs where this user is the leader. */
function getLeaderProjectIds(userId: number): Set<number> {
  const projects = safeReadLS<StoredProject[]>(PROJECTS_KEY, []);
  const ids      = new Set<number>();
  for (const p of projects) {
    if (String(p.leaderId) === String(userId)) ids.add(p.id);
  }
  return ids;
}

/**
 * Returns the set of user IDs who are members of at least one project
 * where `leaderId` is the project leader.
 */
function getLeaderTeamMemberIds(leaderId: number): Set<number> {
  const projects = safeReadLS<StoredProject[]>(PROJECTS_KEY, []);
  const memberIds = new Set<number>();
  for (const p of projects) {
    if (String(p.leaderId) !== String(leaderId)) continue;
    for (const mid of p.memberIds ?? []) memberIds.add(mid);
  }
  return memberIds;
}

/**
 * Returns all known user account names mapped to their IDs.
 * Used to check whether a leave requester is in the leader's team.
 */
function buildUserNameToIdMap(): Map<string, number> {
  const map     = new Map<string, number>();
  const edits   = safeReadLS<EditsMap>(EDITS_KEY, {});
  const created = safeReadLS<StoredCreatedAccount[]>(CREATED_ACCOUNTS_KEY, []);
  const deleted = new Set<string>(safeReadLS<string[]>(DELETED_IDS_KEY, []));

  // Created accounts
  for (const a of created) {
    if (a.kind !== "user") continue;
    const key = `user:${a.id}`;
    if (deleted.has(key)) continue;
    const editedName = edits[key]?.name ?? a.name;
    map.set(editedName.trim().toLowerCase(), a.id);
  }

  return map;
}

// ─── Past-date Modal ──────────────────────────────────────────────────────────
function PastDateModal({ onClose }: { onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 20, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-2xl border-2 border-red-100 w-full max-w-sm mx-4 overflow-hidden"
        >
          <div className="bg-gradient-to-br from-red-500 to-rose-600 p-6 flex flex-col items-center text-white">
            <div className="p-3 bg-white/20 rounded-2xl mb-3">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold">Invalid Date Selected</h2>
          </div>
          <div className="p-6 text-center">
            <p className="text-slate-600 text-sm leading-relaxed mb-1">
              You've selected a date that has already passed.
            </p>
            <p className="text-slate-500 text-sm">
              Leave requests can only be filed for{" "}
              <span className="font-semibold text-[#1F3C68]">today or future dates</span>.
            </p>
          </div>
          <div className="px-6 pb-6">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-[#1F3C68] text-white font-semibold hover:bg-[#162d52] transition-colors shadow-md"
              type="button"
            >
              Got it, go back
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
    const link  = document.createElement("a");
    link.href   = base64;
    link.download = fileName;
    link.click();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
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
              <div className="p-2 bg-[#1F3C68]/10 rounded-xl shrink-0">
                {isImage ? (
                  <ImageIcon className="w-5 h-5 text-[#1F3C68]" />
                ) : (
                  <FileText className="w-5 h-5 text-[#1F3C68]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[#1F3C68] text-sm truncate">{fileName}</p>
                <p className="text-xs text-slate-400 mt-0.5">Supporting Document</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F3C68] text-white text-xs font-semibold hover:bg-[#162d52] transition"
                type="button"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-xl transition"
                type="button"
                aria-label="Close preview"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100">
            {isImage ? (
              <img
                src={base64}
                alt={fileName}
                className="max-w-full max-h-[60vh] rounded-xl shadow-md object-contain"
              />
            ) : isPdf ? (
              <iframe
                src={base64}
                title={fileName}
                className="w-full h-[60vh] rounded-xl border border-slate-200 bg-white"
              />
            ) : (
              <div className="flex flex-col items-center gap-4 py-12 text-slate-400">
                <div className="p-5 bg-white rounded-2xl shadow border border-slate-200">
                  <FileText className="w-12 h-12 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">
                  Preview not available for this file type
                </p>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1F3C68] text-white text-sm font-semibold hover:bg-[#162d52] transition"
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

// ─── Attachment Chip ──────────────────────────────────────────────────────────
function AttachmentChip({
  fileName,
  base64,
  mime,
}: {
  fileName: string;
  base64?: string;
  mime?: string;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const isImage = mime?.startsWith("image/");

  return (
    <>
      <button
        type="button"
        onClick={() => base64 && setShowPreview(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all
          ${base64
            ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 cursor-pointer"
            : "bg-slate-50 border-slate-200 text-slate-500 cursor-default"
          }`}
        title={base64 ? "Click to preview" : fileName}
      >
        {isImage ? (
          <ImageIcon className="w-3 h-3 shrink-0" />
        ) : (
          <Paperclip className="w-3 h-3 shrink-0" />
        )}
        <span className="truncate max-w-[120px]">{fileName}</span>
        {base64 && <Eye className="w-3 h-3 shrink-0 opacity-60" />}
      </button>

      {showPreview && base64 && mime && (
        <FilePreviewModal
          fileName={fileName}
          base64={base64}
          mime={mime}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ExtendedLeaveStatus }) {
  const map: Record<ExtendedLeaveStatus, { cls: string; icon: React.ElementType; label: string }> = {
    Approved:     { cls: "bg-green-100 text-green-700 border-green-200",   icon: CheckCircle2, label: "Approved"     },
    Rejected:     { cls: "bg-red-100 text-red-600 border-red-200",         icon: XCircle,      label: "Rejected"     },
    Pending:      { cls: "bg-amber-100 text-amber-700 border-amber-200",   icon: Clock3,       label: "Pending"      },
    "Pre-Approved": { cls: "bg-teal-100 text-teal-700 border-teal-200",    icon: ShieldCheck,  label: "Pre-Approved" },
    "Pre-Rejected": { cls: "bg-orange-100 text-orange-700 border-orange-200", icon: UserCog,   label: "Pre-Rejected" },
  };
  const { cls, icon: Icon, label } = map[status] ?? map.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

// ─── Pre-review info banner ───────────────────────────────────────────────────
function PreReviewBanner({ leave }: { leave: LeaveRequestWithAttachment }) {
  if (leave.status !== "Pre-Approved" && leave.status !== "Pre-Rejected") return null;
  const isApproved = leave.status === "Pre-Approved";
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
      isApproved
        ? "bg-teal-50 border-teal-200 text-teal-800"
        : "bg-orange-50 border-orange-200 text-orange-800"
    }`}>
      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <div>
        <span className="font-semibold">
          {isApproved ? "Pre-approved" : "Pre-rejected"}
        </span>{" "}
        by {leave.preReviewedBy ?? "reviewer"}
        {leave.preReviewedByRole ? ` (${leave.preReviewedByRole})` : ""}.{" "}
        Awaiting final admin decision.
      </div>
    </div>
  );
}

// ─── Team Review Modal ────────────────────────────────────────────────────────
function TeamReviewModal({
  leave,
  currentUser,
  onClose,
  onPreApprove,
  onPreReject,
}: {
  leave: LeaveRequestWithAttachment;
  currentUser: { id: number; name: string };
  onClose: () => void;
  onPreApprove: (id: number) => void;
  onPreReject:  (id: number) => void;
}) {
  const [showAttachment, setShowAttachment] = useState(false);
  const canAct = leave.status === "Pending";

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md max-h-[90vh] overflow-hidden rounded-3xl border border-slate-200 shadow-2xl bg-white flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1F3C68] to-[#2B4E82] px-6 py-5 text-white shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">
                    Review Leave Request
                  </p>
                  <h2 className="text-lg font-black leading-tight">
                    {leave.employee}'s Request
                  </h2>
                  <p className="text-sm text-white/70 mt-0.5">
                    {canAct
                      ? "You can pre-approve or pre-reject this request."
                      : "This request has already been reviewed."}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition shrink-0"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Status row */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Status</span>
              <StatusBadge status={leave.status} />
            </div>

            {/* Pre-review banner if already acted on */}
            <PreReviewBanner leave={leave} />

            {/* Leave type + days */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Leave Type</p>
                <p className="text-sm font-bold text-[#1F3C68]">{leave.type}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Duration</p>
                <p className="text-sm font-bold text-[#1F3C68]">{leave.days} day{leave.days !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Date range */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Date Range</p>
              <p className="text-sm font-semibold text-[#1F3C68]">
                {formatDate(leave.startDate ?? leave.dateFrom ?? "")}
                {leave.startDate !== leave.endDate && (
                  <> — {formatDate(leave.endDate ?? leave.dateTo ?? "")}</>
                )}
              </p>
            </div>

            {/* Reason */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm text-slate-600 leading-relaxed">{leave.reason || "—"}</p>
            </div>

            {/* Attachment */}
            {leave.fileName && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
                  Supporting Document
                </p>
                <AttachmentChip
                  fileName={leave.fileName}
                  base64={leave.attachmentBase64}
                  mime={leave.attachmentMime}
                />
              </div>
            )}

            {/* Info note about admin final approval */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p>
                Your decision is a <span className="font-semibold">pre-approval</span> only.
                An admin must make the final approval or rejection.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-3 border-t border-slate-100 shrink-0">
            {canAct ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { onPreApprove(leave.id); onClose(); }}
                  type="button"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-teal-700 transition shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  Pre-Approve
                </button>
                <button
                  onClick={() => { onPreReject(leave.id); onClose(); }}
                  type="button"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition shadow-sm"
                >
                  <X className="w-4 h-4" />
                  Pre-Reject
                </button>
                <button
                  onClick={onClose}
                  type="button"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={onClose}
                type="button"
                className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Close
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Leave component ─────────────────────────────────────────────────────
function Leave() {
  const location = useLocation();
  const navigate = useNavigate();
  const user =
    location.state?.user ||
    JSON.parse(localStorage.getItem("currentUser") || "null");

  const currentTime = useClock();
  const [menuOpen,           setMenuOpen]           = useState(false);
  const [isAnimating,        setIsAnimating]        = useState(false);
  const [formError,          setFormError]          = useState("");
  const [fileName,           setFileName]           = useState("");
  const [fileBase64,         setFileBase64]         = useState<string | null>(null);
  const [fileMime,           setFileMime]           = useState<string | null>(null);
  const [activeTab,          setActiveTab]          = useState<"All" | ExtendedLeaveStatus>("All");
  const [showPastDateModal,  setShowPastDateModal]  = useState(false);
  const [viewMode,           setViewMode]           = useState<"my" | "team">("my");
  const [reviewingLeave,     setReviewingLeave]     = useState<LeaveRequestWithAttachment | null>(null);

  const [currentPage,  setCurrentPage]  = useState(1);
  const [pendingPage,  setPendingPage]  = useState(1);
  const [teamPage,     setTeamPage]     = useState(1);
  const PENDING_PER_PAGE = 3;
  const TEAM_PER_PAGE    = 5;

  const [form, setForm] = useState<LeaveForm>({
    type:     "Vacation Leave",
    dateFrom: "",
    dateTo:   "",
    reason:   "",
  });

  // ── Derive reviewer role & team membership ──────────────────────────────────
  const userRole = useMemo(() => {
    if (!user?.id) return "Employee";
    return resolveUserRole(user.id);
  }, [user?.id]);

  const isHR = useMemo(() => isHRRole(userRole), [userRole]);

  const leaderProjectIds = useMemo(() => {
    if (!user?.id) return new Set<number>();
    return getLeaderProjectIds(user.id);
  }, [user?.id]);

  const isLeader = leaderProjectIds.size > 0;

  const leaderTeamMemberIds = useMemo(() => {
    if (!user?.id || !isLeader) return new Set<number>();
    return getLeaderTeamMemberIds(user.id);
  }, [user?.id, isLeader]);

  // Map of lower-cased employee name → user id for name-based matching
  const nameToIdMap = useMemo(() => buildUserNameToIdMap(), []);

  /**
   * Returns true if the current user has reviewer rights over a leave request.
   * HR: can review any non-admin request (admins don't file leaves here).
   * Leader: can review only their direct project members.
   */
  const canReviewLeave = useMemo(() => {
    return (leave: LeaveRequestWithAttachment): boolean => {
      if (!user?.id) return false;
      // Never review your own
      if (leave.employee?.trim().toLowerCase() === user?.name?.trim().toLowerCase()) return false;
      if (isHR) return true;
      if (isLeader) {
        const empId = nameToIdMap.get(leave.employee?.trim().toLowerCase() ?? "");
        if (empId !== undefined) return leaderTeamMemberIds.has(empId);
      }
      return false;
    };
  }, [user, isHR, isLeader, leaderTeamMemberIds, nameToIdMap]);

  // ── Leaves state ────────────────────────────────────────────────────────────
  const [leaves, setLeaves] = useState<LeaveRequestWithAttachment[]>(() => {
    const stored = localStorage.getItem(ALL_LEAVES_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as LeaveRequestWithAttachment[];
    } catch {
      return [];
    }
  });

  // My leaves = those filed by the current user
  const myLeaves = useMemo(
    () => leaves.filter((l) => l.employee === user?.name),
    [leaves, user?.name]
  );

  // Team leaves = all leaves the reviewer can act on (not their own)
  const teamLeaves = useMemo(() => {
    if (!isHR && !isLeader) return [];
    return leaves.filter((l) => canReviewLeave(l));
  }, [leaves, canReviewLeave, isHR, isLeader]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== ALL_LEAVES_KEY) return;
      try {
        const updated = e.newValue ? (JSON.parse(e.newValue) as LeaveRequestWithAttachment[]) : [];
        setLeaves(updated);
      } catch { /* ignore */ }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const [leavePolicy] = useState<LeavePolicy[]>(() => {
    const stored = localStorage.getItem(
      `${POLICY_STORAGE_KEY}_${user?.id || "user"}`
    );
    if (stored) return JSON.parse(stored);
    return defaultLeavePolicy;
  });

  const leaveTypes: LeaveType[] = [
    "Vacation Leave",
    "Sick Leave",
    "Emergency Leave",
    "Maternity/Paternity Leave",
  ];

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const diff =
      Math.ceil(
        (new Date(end).getTime() - new Date(start).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;
    return diff > 0 ? diff : 0;
  };

  const todayStr = new Date().toISOString().split("T")[0];

  const handleDateChange = (field: "dateFrom" | "dateTo", value: string) => {
    if (value && value < todayStr) {
      setShowPastDateModal(true);
      setForm((prev) => ({ ...prev, [field]: "" }));
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const getUsedDays = (leaveType: LeaveType) => {
    return myLeaves
      .filter((l) => l.status === "Approved" && l.type === leaveType)
      .reduce((sum, l) => sum + l.days, 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileMime(file.type);
    const reader = new FileReader();
    reader.onload = () => setFileBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Persist to LS whenever leaves change ────────────────────────────────────
  const persistLeaves = (updated: LeaveRequestWithAttachment[]) => {
    setLeaves(updated);
    localStorage.setItem(ALL_LEAVES_KEY, JSON.stringify(updated));
  };

  const handleSubmit = () => {
    if (!form.dateFrom || !form.dateTo || !form.reason.trim()) {
      showError("Please fill in all fields.");
      return;
    }
    if (new Date(form.dateTo) < new Date(form.dateFrom)) {
      showError("End date cannot be before start date.");
      return;
    }

    const days = calculateDays(form.dateFrom, form.dateTo);
    const approvedDays = getUsedDays(form.type);
    const policy = leavePolicy.find((p) => p.type === form.type);
    if (policy) {
      const remaining = policy.total - approvedDays;
      if (days > remaining) {
        showError(
          `Insufficient leave balance. You only have ${remaining} days remaining for ${form.type}.`
        );
        return;
      }
    }

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1000);

    const newLeave: LeaveRequestWithAttachment = {
      id:              Date.now(),
      employee:        user?.name ?? "Unknown",
      type:            form.type,
      startDate:       form.dateFrom,
      endDate:         form.dateTo,
      reason:          form.reason,
      status:          "Pending",
      appliedOn:       new Date().toISOString().split("T")[0],
      days,
      fileName:        fileName || undefined,
      attachmentBase64: fileBase64 || undefined,
      attachmentMime:  fileMime || undefined,
    };

    const updatedAll = [newLeave, ...leaves];
    persistLeaves(updatedAll);

    setForm({ type: "Vacation Leave", dateFrom: "", dateTo: "", reason: "" });
    setFileName("");
    setFileBase64(null);
    setFileMime(null);
    setFormError("");
    setCurrentPage(1);
    setPendingPage(1);
    showSuccess("Leave request submitted successfully!");
  };

  // ── Pre-approval / pre-rejection by HR or project leader ───────────────────
  const handlePreApprove = (id: number) => {
    const updated = leaves.map((l) => {
      if (l.id !== id) return l;
      return {
        ...l,
        status:            "Pre-Approved" as ExtendedLeaveStatus,
        preReviewedBy:     user?.name,
        preReviewedById:   user?.id,
        preReviewedByRole: isHR ? userRole : "Project Leader",
        preReviewedAt:     new Date().toISOString(),
      };
    });
    persistLeaves(updated);
    showSuccess("Leave pre-approved. Awaiting admin's final decision.");
  };

  const handlePreReject = (id: number) => {
    const updated = leaves.map((l) => {
      if (l.id !== id) return l;
      return {
        ...l,
        status:            "Pre-Rejected" as ExtendedLeaveStatus,
        preReviewedBy:     user?.name,
        preReviewedById:   user?.id,
        preReviewedByRole: isHR ? userRole : "Project Leader",
        preReviewedAt:     new Date().toISOString(),
      };
    });
    persistLeaves(updated);
    showSuccess("Leave pre-rejected. Awaiting admin's final decision.");
  };

  // ── Derived lists ───────────────────────────────────────────────────────────
  const pendingLeaves = myLeaves.filter((l) => l.status === "Pending");
  const totalPendingPages = Math.max(1, Math.ceil(pendingLeaves.length / PENDING_PER_PAGE));
  const paginatedPending = pendingLeaves.slice(
    (pendingPage - 1) * PENDING_PER_PAGE,
    pendingPage * PENDING_PER_PAGE
  );

  const handleTabChange = (tab: "All" | ExtendedLeaveStatus) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const filteredMyLeaves =
    activeTab === "All" ? myLeaves : myLeaves.filter((l) => l.status === activeTab);

  const totalPages  = Math.max(1, Math.ceil(filteredMyLeaves.length / ROWS_PER_PAGE));
  const paginatedLeaves = filteredMyLeaves.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  // Team leaves paging
  const [teamStatusFilter, setTeamStatusFilter] = useState<"All" | ExtendedLeaveStatus>("All");
  const filteredTeamLeaves = teamStatusFilter === "All"
    ? teamLeaves
    : teamLeaves.filter((l) => l.status === teamStatusFilter);
  const totalTeamPages  = Math.max(1, Math.ceil(filteredTeamLeaves.length / TEAM_PER_PAGE));
  const paginatedTeam   = filteredTeamLeaves.slice(
    (teamPage - 1) * TEAM_PER_PAGE,
    teamPage * TEAM_PER_PAGE
  );

  const getStatusStyles = (status: ExtendedLeaveStatus) => {
    if (status === "Approved")     return "bg-green-100 text-green-700 border border-green-200";
    if (status === "Rejected")     return "bg-red-100 text-red-600 border border-red-200";
    if (status === "Pre-Approved") return "bg-teal-100 text-teal-700 border border-teal-200";
    if (status === "Pre-Rejected") return "bg-orange-100 text-orange-700 border border-orange-200";
    return "bg-amber-100 text-amber-700 border border-amber-200";
  };

  const getStatusIcon = (status: ExtendedLeaveStatus) => {
    if (status === "Approved")     return <CheckCircle2 className="w-3.5 h-3.5" />;
    if (status === "Rejected")     return <XCircle className="w-3.5 h-3.5" />;
    if (status === "Pre-Approved") return <ShieldCheck className="w-3.5 h-3.5" />;
    if (status === "Pre-Rejected") return <UserCog className="w-3.5 h-3.5" />;
    return <Clock3 className="w-3.5 h-3.5" />;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day:   "numeric",
      year:  "numeric",
    });

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const canReview = isHR || isLeader;
  const teamPendingCount = teamLeaves.filter((l) => l.status === "Pending").length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {showPastDateModal && (
        <PastDateModal onClose={() => setShowPastDateModal(false)} />
      )}

      {/* Team Review Modal */}
      <AnimatePresence>
        {reviewingLeave && (
          <TeamReviewModal
            leave={reviewingLeave}
            currentUser={user}
            onClose={() => setReviewingLeave(null)}
            onPreApprove={handlePreApprove}
            onPreReject={handlePreReject}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 bg-white shadow-lg flex-col border-r border-slate-200">
        <Usersidebar navigate={navigate} logout={handleLogout} />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-black/30 z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 w-64 bg-white h-full shadow-2xl z-50"
            >
              <Usersidebar
                navigate={navigate}
                logout={handleLogout}
                close={() => setMenuOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Topbar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex justify-between items-center mb-8 bg-white p-4 md:p-6 rounded-2xl shadow-md border border-slate-100"
        >
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <Menu className="text-[#1F3C68]" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-3xl font-bold text-[#1F3C68]">
                  Leave Requests
                </h1>
                {/* Role badge */}
                {canReview && (
                  <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                    isHR
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                    {isHR ? <ShieldCheck className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    {isHR ? userRole : "Project Leader"}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#1E293B] mt-1 font-medium">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "short",
                  year:    "numeric",
                  month:   "long",
                  day:     "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="hidden md:flex lg:hidden items-center gap-2 bg-primary text-white px-3 py-2 rounded-lg shadow-lg md:w-[92px]">
            <Clock className="w-4 h-4" />
            <p className="font-bold text-xs tabular-nums">
              {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-3 bg-primary text-white px-6 py-3 rounded-xl shadow-lg">
            <Clock className="w-5 h-5" />
            <p className="font-bold text-lg tabular-nums">
              {currentTime.toLocaleTimeString("en-US", {
                hour:   "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          </div>
        </motion.div>

        {/* View toggle for users with reviewer rights */}
        {canReview && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm w-fit"
          >
            <button
              onClick={() => setViewMode("my")}
              type="button"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === "my"
                  ? "bg-[#1F3C68] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <FileUser className="w-4 h-4" />
              My Leaves
            </button>
            <button
              onClick={() => setViewMode("team")}
              type="button"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === "team"
                  ? "bg-[#1F3C68] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Users className="w-4 h-4" />
              Team Requests
              {teamPendingCount > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  viewMode === "team"
                    ? "bg-white/20 text-white"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {teamPendingCount}
                </span>
              )}
            </button>
          </motion.div>
        )}

        {/* ── MY LEAVES view ─────────────────────────────────────────────── */}
        {viewMode === "my" && (
          <>
            {/* Leave Balance Cards */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
            >
              {leavePolicy.map((policy, i) => {
                const usedDays  = getUsedDays(policy.type);
                const remaining = policy.total - usedDays;
                const pct       = (remaining / policy.total) * 100;
                return (
                  <motion.div
                    key={policy.type}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="bg-white p-5 rounded-2xl shadow-md border border-slate-100 hover:shadow-lg hover:border-[#F28C28]/30 transition-all"
                  >
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      {policy.type}
                    </p>
                    <div className="flex items-end gap-1 mb-1">
                      <span className={`text-4xl font-bold tabular-nums ${policy.textColor}`}>
                        {remaining}
                      </span>
                      <span className="text-slate-400 text-sm mb-1">/ {policy.total} days</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden my-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.4 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                        className={`h-full rounded-full ${policy.color}`}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{usedDays} used</span>
                      <span>{remaining} remaining</span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* File a Leave Request */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-3xl shadow-xl border-2 border-[#F28C28]/20 overflow-hidden mb-6"
            >
              <div className="bg-primary p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <FileUser className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">File a Leave Request</h2>
                    <p className="text-sm text-white/90">Complete the form below to submit</p>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8">
                <div className="grid md:grid-cols-2 gap-5 mb-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Leave Type
                    </label>
                    <div className="relative">
                      <select
                        value={form.type}
                        onChange={(e) =>
                          setForm({ ...form, type: e.target.value as LeaveType })
                        }
                        className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 font-medium px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28] transition-all"
                      >
                        {leaveTypes.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Supporting Document{" "}
                      <span className="text-slate-400 normal-case font-normal">(Optional)</span>
                    </label>
                    <label className="flex items-center gap-3 w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl cursor-pointer hover:border-[#E97638] hover:bg-orange-50/30 transition-all">
                      <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-500 truncate flex-1">
                        {fileName || "No file chosen"}
                      </span>
                      {fileName && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setFileName("");
                            setFileBase64(null);
                            setFileMime(null);
                          }}
                          className="shrink-0 p-0.5 hover:bg-slate-200 rounded transition"
                        >
                          <X className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                        onChange={handleFileChange}
                      />
                    </label>
                    {fileBase64 && fileMime?.startsWith("image/") && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 relative w-full h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                      >
                        <img src={fileBase64} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        <span className="absolute bottom-1.5 left-2 text-white text-[10px] font-semibold">
                          Preview
                        </span>
                      </motion.div>
                    )}
                    {fileBase64 && !fileMime?.startsWith("image/") && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl"
                      >
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-xs text-blue-700 font-medium truncate flex-1">{fileName}</span>
                        <span className="text-[10px] text-blue-500 shrink-0">Ready to submit</span>
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5 mb-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Date From
                    </label>
                    <input
                      type="date"
                      value={form.dateFrom}
                      min={todayStr}
                      onChange={(e) => handleDateChange("dateFrom", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Date To
                    </label>
                    <input
                      type="date"
                      value={form.dateTo}
                      min={form.dateFrom || todayStr}
                      onChange={(e) => handleDateChange("dateTo", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28] transition-all"
                    />
                  </div>
                </div>

                {form.dateFrom && form.dateTo && calculateDays(form.dateFrom, form.dateTo) > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-primary font-medium"
                  >
                    📅 {calculateDays(form.dateFrom, form.dateTo)} day(s) of leave
                  </motion.div>
                )}

                <div className="mb-5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Reason
                  </label>
                  <textarea
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    rows={3}
                    placeholder="Provide a reason for your leave..."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#F28C28]/40 focus:border-[#F28C28] transition-all"
                  />
                </div>

                {formError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 font-medium mb-4"
                  >
                    {formError}
                  </motion.p>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  className="relative overflow-hidden flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-white font-bold shadow-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all"
                  type="button"
                >
                  {isAnimating && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 2, opacity: 0 }}
                      transition={{ duration: 1 }}
                      className="absolute inset-0 bg-white rounded-full"
                    />
                  )}
                  <Send className="w-4 h-4 relative" />
                  <span className="relative">Submit Request</span>
                </motion.button>
              </div>
            </motion.div>

            {/* Pending Requests */}
            {pendingLeaves.length > 0 && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden mb-6"
              >
                <div className="bg-gradient-to-r from-[#1F3C68] to-[#2a4f88] p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Clock3 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Pending Requests</h2>
                      <p className="text-xs text-white/70">Awaiting approval</p>
                    </div>
                  </div>
                  <span className="bg-white text-[#1F3C68] text-sm font-bold px-3 py-1 rounded-full">
                    {pendingLeaves.length}
                  </span>
                </div>

                <div className="divide-y divide-slate-50">
                  <AnimatePresence mode="wait">
                    {paginatedPending.map((leave, index) => (
                      <motion.div
                        key={leave.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-[#1F3C68]">{leave.type}</span>
                            <span className="text-xs bg-[#1F3C68]/10 text-[#1F3C68] border border-[#1F3C68]/20 px-2 py-0.5 rounded-full font-medium">
                              {leave.days}d
                            </span>
                          </div>
                          <p className="text-sm text-slate-500">
                            {formatDate(leave.startDate ?? "")}
                            {leave.startDate !== leave.endDate && ` — ${formatDate(leave.endDate ?? "")}`}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{leave.reason}</p>
                          {leave.fileName && (
                            <div className="mt-2">
                              <AttachmentChip
                                fileName={leave.fileName}
                                base64={leave.attachmentBase64}
                                mime={leave.attachmentMime}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1F3C68]/10 text-[#1F3C68] border border-[#1F3C68]/20 text-sm font-semibold">
                            <Clock3 className="w-4 h-4" />
                            Awaiting Approval
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {pendingLeaves.length > PENDING_PER_PAGE && (
                  <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                    <p className="text-xs text-slate-400">
                      Showing{" "}
                      <span className="font-semibold text-slate-600">
                        {(pendingPage - 1) * PENDING_PER_PAGE + 1}–
                        {Math.min(pendingPage * PENDING_PER_PAGE, pendingLeaves.length)}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-slate-600">{pendingLeaves.length}</span>
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                        disabled={pendingPage === 1}
                        className="p-2 rounded-lg hover:bg-[#1F3C68]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        type="button"
                      >
                        <ChevronLeft className="w-4 h-4 text-[#1F3C68]" />
                      </button>
                      {Array.from({ length: totalPendingPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setPendingPage(page)}
                          className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                            pendingPage === page
                              ? "bg-[#1F3C68] text-white shadow"
                              : "text-slate-600 hover:bg-[#1F3C68]/10"
                          }`}
                          type="button"
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setPendingPage((p) => Math.min(totalPendingPages, p + 1))}
                        disabled={pendingPage === totalPendingPages}
                        className="p-2 rounded-lg hover:bg-[#1F3C68]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        type="button"
                      >
                        <ChevronRight className="w-4 h-4 text-[#1F3C68]" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Leave History */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-white p-6 rounded-3xl shadow-md border border-slate-100"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#E0F2FE] rounded-xl">
                    <FileClock className="w-6 h-6 text-[#1F3C68]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#1F3C68]">Leave History</h2>
                    <p className="text-sm text-slate-500">All your leave requests</p>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap justify-end">
                  {(["All", "Pending", "Pre-Approved", "Pre-Rejected", "Approved", "Rejected"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleTabChange(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activeTab === s
                          ? "bg-[#1F3C68] text-white shadow"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                      type="button"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Type", "Duration", "Days", "Reason", "Applied On", "Attachment", "Status"].map(
                        (h, i) => (
                          <th
                            key={i}
                            className={`text-left text-xs font-semibold text-slate-500 uppercase tracking-wide pb-3 pr-4 ${
                              i >= 2 && i <= 4 ? "hidden md:table-cell" : ""
                            } ${i === 5 ? "hidden md:table-cell" : ""}`}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <AnimatePresence mode="wait">
                      {paginatedLeaves.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            No leave requests found.
                          </td>
                        </tr>
                      ) : (
                        paginatedLeaves.map((leave, index) => (
                          <motion.tr
                            key={leave.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: index * 0.04 }}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="py-4 pr-4">
                              <div>
                                <span className="font-semibold text-[#1F3C68]">{leave.type}</span>
                                {/* Pre-review note inline */}
                                {(leave.status === "Pre-Approved" || leave.status === "Pre-Rejected") && (
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {leave.status === "Pre-Approved" ? "✓" : "✗"} by {leave.preReviewedBy}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="py-4 pr-4 text-slate-600 whitespace-nowrap">
                              {formatDate(leave.startDate ?? "")}
                              {leave.startDate !== leave.endDate && (
                                <span className="text-slate-400"> — {formatDate(leave.endDate ?? "")}</span>
                              )}
                            </td>
                            <td className="py-4 pr-4 hidden md:table-cell">
                              <span className="font-bold text-[#e97638]">{leave.days}d</span>
                            </td>
                            <td className="py-4 pr-4 text-slate-500 hidden md:table-cell max-w-[180px] truncate">
                              {leave.reason}
                            </td>
                            <td className="py-4 pr-4 text-slate-400 hidden md:table-cell whitespace-nowrap">
                              {leave.appliedOn ? formatDate(leave.appliedOn) : "—"}
                            </td>
                            <td className="py-4 pr-4 hidden md:table-cell">
                              {leave.fileName ? (
                                <AttachmentChip
                                  fileName={leave.fileName}
                                  base64={leave.attachmentBase64}
                                  mime={leave.attachmentMime}
                                />
                              ) : (
                                <span className="text-xs text-slate-300 italic">None</span>
                              )}
                            </td>
                            <td className="py-4 pr-4">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyles(leave.status)}`}>
                                {getStatusIcon(leave.status)}
                                {leave.status}
                              </span>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {filteredMyLeaves.length > ROWS_PER_PAGE && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    Showing{" "}
                    <span className="font-semibold text-slate-600">
                      {(currentPage - 1) * ROWS_PER_PAGE + 1}–
                      {Math.min(currentPage * ROWS_PER_PAGE, filteredMyLeaves.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-600">{filteredMyLeaves.length}</span>{" "}
                    entries
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      type="button"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                          currentPage === page
                            ? "bg-[#1F3C68] text-white shadow"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                        type="button"
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      type="button"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}

        {/* ── TEAM REQUESTS view ─────────────────────────────────────────── */}
        {viewMode === "team" && canReview && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    isHR ? "bg-purple-100 border border-purple-200" : "bg-blue-100 border border-blue-200"
                  }`}>
                    {isHR
                      ? <ShieldCheck className="w-5 h-5 text-purple-700" />
                      : <Users className="w-5 h-5 text-blue-700" />
                    }
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#1F3C68]">
                      {isHR ? "All Employee Requests" : "Your Team's Requests"}
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {isHR
                        ? "As HR, you can pre-approve or pre-reject any employee leave request."
                        : "Pre-approve or pre-reject leave requests from your project members."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {teamPendingCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold">
                      <Clock3 className="w-4 h-4" />
                      {teamPendingCount} pending
                    </span>
                  )}
                </div>
              </div>

              {/* Note about admin final approval */}
              <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  Your approvals and rejections are <span className="font-semibold">preliminary</span>.
                  The admin always has the final say and can override any decision.
                </p>
              </div>
            </div>

            {/* Team leaves table */}
            <div className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden">
              {/* Toolbar */}
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-bold text-[#1F3C68]">Leave Requests</p>
                    <p className="text-xs text-slate-400 mt-0.5">{filteredTeamLeaves.length} requests</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(["All", "Pending", "Pre-Approved", "Pre-Rejected", "Approved", "Rejected"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => { setTeamStatusFilter(s); setTeamPage(1); }}
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          teamStatusFilter === s
                            ? "bg-[#1F3C68] text-white shadow"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-50 min-h-[200px]">
                <AnimatePresence mode="popLayout">
                  {paginatedTeam.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                      <Users className="w-10 h-10 mb-3" />
                      <p className="text-sm font-semibold text-slate-400">No requests found</p>
                      <p className="text-xs mt-1">
                        {teamLeaves.length === 0
                          ? isHR
                            ? "No employee leave requests have been filed yet."
                            : "Your project members haven't filed any leave requests."
                          : "Try a different status filter."}
                      </p>
                    </div>
                  ) : (
                    paginatedTeam.map((leave, index) => {
                      const isPending    = leave.status === "Pending";
                      const alreadyActed = leave.status === "Pre-Approved" || leave.status === "Pre-Rejected";
                      const isFinal      = leave.status === "Approved" || leave.status === "Rejected";

                      return (
                        <motion.div
                          key={leave.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            {/* Employee + leave type */}
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[#1F3C68] flex items-center justify-center text-white text-[10px] font-black shrink-0">
                                  {leave.employee?.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-bold text-[#1F3C68] text-sm">{leave.employee}</span>
                              </div>
                              <span className="text-slate-300">·</span>
                              <span className="text-sm text-slate-600">{leave.type}</span>
                              <span className="text-xs font-bold text-[#e97638] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                                {leave.days}d
                              </span>
                            </div>

                            {/* Date */}
                            <p className="text-xs text-slate-500 mb-1">
                              {leave.startDate ? formatDate(leave.startDate) : "—"}
                              {leave.startDate !== leave.endDate && leave.endDate
                                ? ` — ${formatDate(leave.endDate)}`
                                : ""}
                            </p>

                            {/* Reason */}
                            <p className="text-xs text-slate-400 truncate max-w-md">{leave.reason}</p>

                            {/* Attachment */}
                            {leave.fileName && (
                              <div className="mt-2">
                                <AttachmentChip
                                  fileName={leave.fileName}
                                  base64={leave.attachmentBase64}
                                  mime={leave.attachmentMime}
                                />
                              </div>
                            )}

                            {/* Pre-review info */}
                            {alreadyActed && (
                              <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                leave.status === "Pre-Approved"
                                  ? "bg-teal-50 border-teal-200 text-teal-700"
                                  : "bg-orange-50 border-orange-200 text-orange-700"
                              }`}>
                                {leave.status === "Pre-Approved"
                                  ? <Check className="w-3 h-3" />
                                  : <X className="w-3 h-3" />
                                }
                                {leave.status === "Pre-Approved" ? "Pre-approved" : "Pre-rejected"} by you
                                · awaiting admin
                              </div>
                            )}

                            {isFinal && (
                              <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                leave.status === "Approved"
                                  ? "bg-green-50 border-green-200 text-green-700"
                                  : "bg-red-50 border-red-200 text-red-700"
                              }`}>
                                {leave.status === "Approved"
                                  ? <CheckCircle2 className="w-3 h-3" />
                                  : <XCircle className="w-3 h-3" />
                                }
                                Final decision: {leave.status} by admin
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <StatusBadge status={leave.status} />
                            <button
                              onClick={() => setReviewingLeave(leave)}
                              type="button"
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Review
                            </button>
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handlePreApprove(leave.id)}
                                  type="button"
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition shadow-sm"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Pre-Approve
                                </button>
                                <button
                                  onClick={() => handlePreReject(leave.id)}
                                  type="button"
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition shadow-sm"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Pre-Reject
                                </button>
                              </>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>

              {/* Pagination */}
              {filteredTeamLeaves.length > TEAM_PER_PAGE && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                  <p className="text-xs text-slate-400">
                    Showing{" "}
                    <span className="font-semibold text-slate-600">
                      {(teamPage - 1) * TEAM_PER_PAGE + 1}–
                      {Math.min(teamPage * TEAM_PER_PAGE, filteredTeamLeaves.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-600">{filteredTeamLeaves.length}</span>
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTeamPage((p) => Math.max(1, p - 1))}
                      disabled={teamPage === 1}
                      className="p-2 rounded-lg hover:bg-[#1F3C68]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      type="button"
                    >
                      <ChevronLeft className="w-4 h-4 text-[#1F3C68]" />
                    </button>
                    {Array.from({ length: totalTeamPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setTeamPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                          teamPage === page
                            ? "bg-[#1F3C68] text-white shadow"
                            : "text-slate-600 hover:bg-[#1F3C68]/10"
                        }`}
                        type="button"
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setTeamPage((p) => Math.min(totalTeamPages, p + 1))}
                      disabled={teamPage === totalTeamPages}
                      className="p-2 rounded-lg hover:bg-[#1F3C68]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      type="button"
                    >
                      <ChevronRight className="w-4 h-4 text-[#1F3C68]" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default Leave;