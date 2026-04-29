import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import AdminTable from "./components/AdminTable";
import { useAdmin } from "./context/AdminProvider";
import type { Project, Task, TaskPriority, TaskStatus } from "./context/AdminTypes";
import { notifyError, notifySuccess } from "./utils/toast";

// ---------- Types ----------

type CompletionVisibility = "leader-required" | "manager-only";
type CompletionApprovalStatus = "Pending" | "Approved" | "Rejected";

interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

interface TaskCompletionRequest {
  status: CompletionApprovalStatus;
  requestedAt: string;
  requestedBy?: string;
  requestedById?: number;
  note: string;
  attachments: TaskAttachment[];
  visibility: CompletionVisibility;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedById?: number;
}

type AdminTask = Task & {
  projectId?: number;
  assignedToId?: number;
  assignedBy?: string;
  assignedById?: number;
  dueDate?: string;
  tags?: string[];
  completionRequest?: TaskCompletionRequest;
  completedAt?: string;
  completedBy?: string;
  completedById?: number;
};

type AdminProject = Project;
type TaskForm = Omit<AdminTask, "id">;
type ProjectForm = Omit<AdminProject, "id">;
type ModalMode = "project" | "task";

const createId = (): number => Date.now() + Math.floor(Math.random() * 1000);
const STATUS: TaskStatus[] = ["Pending", "In Progress", "Completed"];
const PRIORITY: TaskPriority[] = ["Low", "Medium", "High"];

type ProjectSortKey = "newest" | "oldest" | "name" | "leader" | "dueDate" | "progress";
type TaskSortKey =
  | "newest" | "oldest" | "priority" | "status" | "dueDate"
  | "title" | "assignee" | "project";
type SortDir = "asc" | "desc";

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatFullDate(now: Date) {
  return now.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "2-digit", year: "numeric",
  });
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return "—"; }
}

function formatAttachmentSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function priorityRank(p: TaskPriority) {
  return p === "High" ? 3 : p === "Medium" ? 2 : 1;
}
function statusRank(s: TaskStatus) {
  return s === "Completed" ? 3 : s === "In Progress" ? 2 : 1;
}
function safeDateValue(yyyyMMdd?: string) {
  if (!yyyyMMdd) return Number.POSITIVE_INFINITY;
  const t = new Date(yyyyMMdd).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function Pill({ children, tone }: {
  children: string;
  tone: "primary" | "secondary" | "success" | "slate" | "warning" | "danger";
}) {
  const base = "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border";
  const map = {
    primary:   "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary/10 text-secondary border-secondary/20",
    success:   "bg-green-50 text-green-700 border-green-200",
    danger:    "bg-red-50 text-red-700 border-red-200",
    warning:   "bg-amber-50 text-amber-700 border-amber-200",
    slate:     "bg-soft text-text-primary border-slate-200",
  } as const;
  return <span className={`${base} ${map[tone]}`}>{children}</span>;
}

function Modal({ open, title, children, onClose }: {
  open: boolean; title: string;
  children: React.ReactNode; onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          aria-modal="true" role="dialog"
        >
          <motion.button type="button"
            className="absolute inset-0 bg-black/30"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} aria-label="Close modal backdrop"
          />
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "relative w-full max-w-3xl",
              "bg-card border border-slate-200 rounded-2xl shadow-lg",
              "max-h-[85vh] overflow-hidden"
            )}
          >
            <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100">
              <div className="font-semibold text-text-heading">{title}</div>
              <button type="button" onClick={onClose}
                className="p-2 rounded-xl hover:bg-soft border border-transparent hover:border-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="Close modal">
                <X className="h-5 w-5 text-text-primary/70" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-72px)]">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Submission Detail Modal ----------

function SubmissionDetailModal({
  task,
  projectName,
  onClose,
  onApprove,
  onReturn,
  currentAdminName,
}: {
  task: AdminTask;
  projectName: string;
  onClose: () => void;
  onApprove: () => void;
  onReturn: () => void;
  currentAdminName?: string;
}) {
  const req = task.completionRequest!;
  const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visibilityLabel = req.visibility === "leader-required"
    ? "Project leader review required"
    : "Manager approval only";

  return (
    <>
      <AnimatePresence>
        {previewAttachment && (
          <motion.div
            className="fixed inset-0 z-[70] flex flex-col bg-black/95"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPreviewAttachment(null)}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-white/10 bg-black/60 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-white/60 shrink-0" />
                <p className="text-sm font-semibold text-white truncate">{previewAttachment.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={previewAttachment.dataUrl} download={previewAttachment.name}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
                  onClick={(e) => e.stopPropagation()}>
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button onClick={() => setPreviewAttachment(null)} type="button"
                  className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4"
              onClick={() => setPreviewAttachment(null)}>
              {previewAttachment.type.startsWith("image/") ? (
                <img src={previewAttachment.dataUrl} alt={previewAttachment.name}
                  className="max-w-full max-h-full rounded-xl object-contain"
                  onClick={(e) => e.stopPropagation()} />
              ) : previewAttachment.type === "application/pdf" || previewAttachment.name.toLowerCase().endsWith(".pdf") ? (
                <div className="w-full h-full rounded-xl overflow-hidden" style={{ minHeight: "70vh" }}
                  onClick={(e) => e.stopPropagation()}>
                  <iframe src={previewAttachment.dataUrl} title={previewAttachment.name}
                    className="w-full h-full" style={{ minHeight: "70vh", border: "none" }} />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-5 text-center p-8 rounded-2xl border border-white/10 bg-white/5"
                  onClick={(e) => e.stopPropagation()}>
                  <FileText className="w-12 h-12 text-white/40" />
                  <p className="text-white font-semibold">{previewAttachment.name}</p>
                  <p className="text-white/50 text-sm">Preview not available for this file type.</p>
                  <a href={previewAttachment.dataUrl} download={previewAttachment.name}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90">
                    <Download className="w-4 h-4" /> Download to view
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 16 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1F3C68] to-[#2B4E82] px-6 py-5 text-white shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-200 border border-amber-300/30">
                    <AlertCircle className="w-3 h-3" />
                    Pending Approval
                  </span>
                </div>
                <h2 className="text-xl font-black leading-snug">{task.title}</h2>
                <p className="text-sm text-white/70 mt-1">
                  Project: <span className="font-semibold text-white/90">{projectName}</span>
                </p>
              </div>
              <button onClick={onClose}
                className="rounded-xl bg-white/10 p-2 hover:bg-white/20 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Task meta */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Task Details</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Assigned To</p>
                  <p className="font-bold text-[#1F3C68]">{task.assignedTo}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Priority</p>
                  <p className="font-bold text-[#1F3C68]">{task.priority}</p>
                </div>
                {task.dueDate && (
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Due Date</p>
                    <p className="font-bold text-[#1F3C68]">{task.dueDate}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Review Type</p>
                  <p className="font-bold text-[#1F3C68] text-xs">{visibilityLabel}</p>
                </div>
              </div>
              {task.description && (
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{task.description}</p>
                </div>
              )}
            </div>

            {/* Submission info */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Completion Submission</p>
                <span className="text-[10px] text-amber-600 font-semibold">
                  {formatDate(req.requestedAt)}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-amber-700 font-semibold">Submitted by: </span>
                <span className="text-amber-900 font-bold">{req.requestedBy ?? task.assignedTo}</span>
              </div>
              {req.note ? (
                <div>
                  <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wide mb-1">Completion Note</p>
                  <p className="text-sm text-amber-900 leading-relaxed bg-white/60 rounded-xl px-3 py-2.5 border border-amber-200">
                    {req.note}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-amber-600 italic">No completion note provided.</p>
              )}
            </div>

            {/* Attachments */}
            {req.attachments?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Completion Files ({req.attachments.length})
                </p>
                <div className="space-y-2">
                  {req.attachments.map((att) => (
                    <div key={att.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        {att.type.startsWith("image/") ? (
                          <img src={att.dataUrl} alt={att.name}
                            className="h-full w-full rounded-lg object-cover" />
                        ) : (
                          <Paperclip className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#1F3C68] truncate">{att.name}</p>
                        <p className="text-[10px] text-slate-400">{formatAttachmentSize(att.size)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => setPreviewAttachment(att)}
                          className="h-7 w-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-primary hover:border-primary/30 transition">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a href={att.dataUrl} download={att.name}
                          className="h-7 w-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-primary hover:border-primary/30 transition">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review notice */}
            <div className="rounded-2xl border border-[#1F3C68]/20 bg-[#EDF2FA] px-4 py-3 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-[#1F3C68] shrink-0 mt-0.5" />
              <p className="text-xs text-[#1F3C68] leading-relaxed font-medium">
                Approving marks this task as <strong>Completed</strong>. Returning it sends it back to{" "}
                <strong>In Progress</strong> and notifies the employee to update their submission.
                {currentAdminName && (
                  <span className="block mt-1 text-[#1F3C68]/70">
                    Your name will be recorded as the reviewer: <strong>{currentAdminName}</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-6 pb-6 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            <button onClick={onClose} type="button"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition">
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button onClick={onReturn} type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 transition">
                <XCircle className="w-4 h-4" />
                Return to Employee
              </button>
              <button onClick={onApprove} type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1F3C68] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#173254] transition shadow-sm">
                <CheckCircle2 className="w-4 h-4" />
                Approve Completion
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

// ---------- Main Component ----------

export default function Tasks() {
  const { tasks, setTasks, projects, setProjects, users, admins } = useAdmin();

  const typedTasks = tasks as AdminTask[];
  const typedProjects = projects as AdminProject[];

  const assignees = useMemo(() => {
    const list = (users ?? []).map((u) => ({
      id: (u as any).id as number,
      name: (u as any).name as string,
    }));
    return list.filter((u) => Number.isFinite(u.id) && u.name);
  }, [users]);

  const leaderOptions = assignees;

  const projectById = useMemo(() => {
    const m = new Map<number, AdminProject>();
    for (const p of typedProjects) m.set(p.id, p);
    return m;
  }, [typedProjects]);

  const userNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const u of assignees) m.set(u.id, u.name);
    return m;
  }, [assignees]);

  // Current admin for reviewer attribution
  const currentAdmin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentAdmin") || "null") as
        | { id: number; email: string; name: string } | null;
    } catch { return null; }
  }, []);

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // UI state
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [showAllTasks, setShowAllTasks] = useState(false);

  // Project list controls
  const [projectQuery, setProjectQuery] = useState("");
  const [leaderFilter, setLeaderFilter] = useState<number | "All">("All");
  const [projectSortKey, setProjectSortKey] = useState<ProjectSortKey>("newest");
  const [projectSortDir, setProjectSortDir] = useState<SortDir>("desc");

  // Task list controls
  const [taskQuery, setTaskQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "All">("All");
  const [projectFilter, setProjectFilter] = useState<number | "All">("All");
  const [taskSortKey, setTaskSortKey] = useState<TaskSortKey>("newest");
  const [taskSortDir, setTaskSortDir] = useState<SortDir>("desc");

  // Selection
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)),
    [selected]
  );

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("project");
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

  const [projectForm, setProjectForm] = useState<ProjectForm>({
    name: "", description: "", leaderId: 0, dueDate: "", tags: [],
  });

  const [taskForm, setTaskForm] = useState<TaskForm>({
    title: "", description: "", assignedTo: "",
    assignedToId: undefined, assignedBy: "", assignedById: undefined,
    projectId: undefined, priority: "Low", status: "Pending",
    dueDate: "", tags: [],
  });

  const [tagInput, setTagInput] = useState("");

  // Pending approvals state
  const [pendingFilter, setPendingFilter] = useState<"all" | "leader-required" | "manager-only">("all");
  const [pendingQuery, setPendingQuery] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<AdminTask | null>(null);

  // ── Pending approvals derived data ──────────────────────────────────────
  const pendingSubmissions = useMemo(() => {
    return typedTasks.filter(
      (t) => t.completionRequest?.status === "Pending"
    );
  }, [typedTasks]);

  const filteredPendingSubmissions = useMemo(() => {
    const q = pendingQuery.trim().toLowerCase();
    return pendingSubmissions.filter((t) => {
      const matchVisibility =
        pendingFilter === "all" ||
        t.completionRequest?.visibility === pendingFilter;
      const projectName = t.projectId
        ? projectById.get(t.projectId)?.name ?? ""
        : "";
      const matchSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.assignedTo.toLowerCase().includes(q) ||
        projectName.toLowerCase().includes(q);
      return matchVisibility && matchSearch;
    });
  }, [pendingSubmissions, pendingFilter, pendingQuery, projectById]);

  // ── Review actions ────────────────────────────────────────────────────
  const reviewSubmission = (
    taskId: number,
    decision: "Approved" | "Rejected"
  ) => {
    setTasks((prev) =>
      (prev as AdminTask[]).map((t) => {
        if (t.id !== taskId || !t.completionRequest) return t;
        const reviewed: TaskCompletionRequest = {
          ...t.completionRequest,
          status: decision,
          reviewedAt: new Date().toISOString(),
          reviewedBy: currentAdmin?.name ?? "Admin",
          reviewedById: currentAdmin?.id,
        };
        if (decision === "Approved") {
          return {
            ...t,
            status: "Completed" as TaskStatus,
            completionRequest: reviewed,
            completedAt: new Date().toISOString(),
            completedBy: currentAdmin?.name ?? "Admin",
            completedById: currentAdmin?.id,
          };
        }
        return {
          ...t,
          status: "In Progress" as TaskStatus,
          completionRequest: reviewed,
          completedAt: undefined,
          completedBy: undefined,
          completedById: undefined,
        };
      })
    );

    const action = decision === "Approved" ? "approved" : "returned";
    notifySuccess(`Submission ${action} successfully.`);
    setSelectedSubmission(null);
  };

  // ── CRUD helpers ──────────────────────────────────────────────────────
  const resetModal = () => {
    setEditingProjectId(null);
    setEditingTaskId(null);
    setTagInput("");
    setProjectForm({ name: "", description: "", leaderId: 0, dueDate: "", tags: [] });
    setTaskForm({
      title: "", description: "", assignedTo: "",
      assignedToId: undefined, assignedBy: "", assignedById: undefined,
      projectId: undefined, priority: "Low", status: "Pending",
      dueDate: "", tags: [],
    });
  };

  const openCreateProject = () => { resetModal(); setModalMode("project"); setModalOpen(true); };
  const openEditProject = (p: AdminProject) => {
    resetModal(); setModalMode("project"); setEditingProjectId(p.id);
    setProjectForm({
      name: p.name, description: p.description, leaderId: p.leaderId,
      dueDate: p.dueDate ?? "", tags: p.tags ?? [],
    });
    setModalOpen(true);
  };
  const openCreateTask = (prefProjectId?: number) => {
    resetModal(); setModalMode("task");
    setTaskForm((prev) => ({ ...prev, projectId: prefProjectId }));
    setModalOpen(true);
  };
  const openEditTask = (t: AdminTask) => {
    resetModal(); setModalMode("task"); setEditingTaskId(t.id);
    setTaskForm({
      title: t.title, description: t.description,
      assignedTo: t.assignedTo, assignedToId: t.assignedToId,
      assignedBy: t.assignedBy ?? "", assignedById: t.assignedById,
      projectId: t.projectId, priority: t.priority, status: t.status,
      dueDate: t.dueDate ?? "", tags: t.tags ?? [],
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); resetModal(); };

  const addTag = () => {
    const clean = tagInput.trim();
    if (!clean) return;
    if (modalMode === "project") {
      setProjectForm((p) => ({ ...p, tags: Array.from(new Set([...(p.tags ?? []), clean])) }));
    } else {
      setTaskForm((p) => ({ ...p, tags: Array.from(new Set([...(p.tags ?? []), clean])) }));
    }
    setTagInput("");
  };
  const removeTag = (tag: string) => {
    if (modalMode === "project") {
      setProjectForm((p) => ({ ...p, tags: (p.tags ?? []).filter((t) => t !== tag) }));
    } else {
      setTaskForm((p) => ({ ...p, tags: (p.tags ?? []).filter((t) => t !== tag) }));
    }
  };

  const saveProject = () => {
    if (!projectForm.name.trim()) return notifyError("Project name is required.");
    if (!projectForm.leaderId || !userNameById.get(projectForm.leaderId))
      return notifyError("Project leader is required.");
    if (editingProjectId !== null) {
      setProjects((prev) =>
        (prev as AdminProject[]).map((p) =>
          p.id === editingProjectId ? { ...p, ...projectForm } : p
        )
      );
      notifySuccess("Project updated.");
    } else {
      const newProject: AdminProject = { id: createId(), ...projectForm };
      setProjects((prev) => [newProject as Project, ...prev]);
      notifySuccess("Project created.");
    }
    closeModal();
  };

  const saveTask = () => {
    if (!typedProjects.length) return notifyError("Create a project first.");
    if (!taskForm.projectId || !projectById.get(taskForm.projectId))
      return notifyError("Select a project for this task.");
    if (!taskForm.title.trim()) return notifyError("Task title is required.");
    if (!taskForm.assignedToId || !userNameById.get(taskForm.assignedToId))
      return notifyError("Assigned user is required.");

    const assignedToName = userNameById.get(taskForm.assignedToId) ?? taskForm.assignedTo;
    const assignedByName = taskForm.assignedById
      ? (userNameById.get(taskForm.assignedById) ?? taskForm.assignedBy)
      : undefined;

    if (editingTaskId !== null) {
      setTasks((prev) =>
        (prev as AdminTask[]).map((t) =>
          t.id === editingTaskId
            ? ({ ...t, ...taskForm, assignedTo: assignedToName, assignedBy: assignedByName } as AdminTask)
            : t
        )
      );
      notifySuccess("Task updated.");
    } else {
      const newTask: AdminTask = {
        id: createId(), ...taskForm,
        assignedTo: assignedToName, assignedBy: assignedByName,
      };
      setTasks((prev) => [newTask as Task, ...prev]);
      notifySuccess("Task created.");
    }
    closeModal();
  };

  const saveModal = () => (modalMode === "project" ? saveProject() : saveTask());

  const removeProject = (projectId: number) => {
    const affected = typedTasks.filter((t) => t.projectId === projectId).length;
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setTasks((prev) => (prev as AdminTask[]).filter((t) => t.projectId !== projectId));
    setExpandedProjects((p) => { const copy = { ...p }; delete copy[projectId]; return copy; });
    notifySuccess(affected ? `Project deleted (and ${affected} task(s) removed).` : "Project deleted.");
  };

  const removeTask = (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelected((p) => { const copy = { ...p }; delete copy[id]; return copy; });
    notifySuccess("Task deleted.");
  };

  const setTaskStatus = (id: number, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    notifySuccess("Task status updated.");
  };

  const bulkSetStatus = (status: TaskStatus) => {
    if (selectedIds.length === 0) return notifyError("Select tasks first.");
    setTasks((prev) => prev.map((t) => (selectedIds.includes(t.id) ? { ...t, status } : t)));
    notifySuccess(`Updated ${selectedIds.length} task(s).`);
  };

  const bulkDelete = () => {
    if (selectedIds.length === 0) return notifyError("Select tasks first.");
    setTasks((prev) => prev.filter((t) => !selectedIds.includes(t.id)));
    setSelected({});
    notifySuccess(`Deleted ${selectedIds.length} task(s).`);
  };

  const toggleAllVisible = (ids: number[], checked: boolean) => {
    setSelected((prev) => { const copy = { ...prev }; for (const id of ids) copy[id] = checked; return copy; });
  };
  const toggleOne = (id: number, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: checked }));
  };
  const toggleExpanded = (projectId: number) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  // Derived data
  const tasksByProject = useMemo(() => {
    const map = new Map<number, AdminTask[]>();
    for (const t of typedTasks) {
      const pid = t.projectId;
      if (!pid) continue;
      const list = map.get(pid) ?? [];
      list.push(t);
      map.set(pid, list);
    }
    return map;
  }, [typedTasks]);

  const projectStats = useMemo(() => {
    const m = new Map<number, { total: number; completed: number }>();
    for (const p of typedProjects) {
      const list = tasksByProject.get(p.id) ?? [];
      m.set(p.id, {
        total: list.length,
        completed: list.filter((t) => t.status === "Completed").length,
      });
    }
    return m;
  }, [typedProjects, tasksByProject]);

  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    let list = [...typedProjects];
    if (q) list = list.filter((p) => {
      const leaderName = userNameById.get(p.leaderId) ?? "";
      return `${p.name} ${p.description} ${leaderName}`.toLowerCase().includes(q);
    });
    if (leaderFilter !== "All") list = list.filter((p) => p.leaderId === leaderFilter);
    const dir = projectSortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (projectSortKey === "newest") return (b.id - a.id) * dir;
      if (projectSortKey === "oldest") return (a.id - b.id) * dir;
      if (projectSortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (projectSortKey === "leader") {
        return (userNameById.get(a.leaderId) ?? "").localeCompare(userNameById.get(b.leaderId) ?? "") * dir;
      }
      if (projectSortKey === "dueDate") return (safeDateValue(a.dueDate) - safeDateValue(b.dueDate)) * dir;
      if (projectSortKey === "progress") {
        const as = projectStats.get(a.id) ?? { total: 0, completed: 0 };
        const bs = projectStats.get(b.id) ?? { total: 0, completed: 0 };
        const ar = as.total ? as.completed / as.total : 0;
        const br = bs.total ? bs.completed / bs.total : 0;
        return (ar - br) * dir;
      }
      return 0;
    });
    return list;
  }, [typedProjects, projectQuery, leaderFilter, projectSortKey, projectSortDir, userNameById, projectStats]);

  const filteredTasksAll = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();
    let list = [...typedTasks];
    if (q) list = list.filter((t) => {
      const projectName = t.projectId ? projectById.get(t.projectId)?.name ?? "" : "";
      return `${t.title} ${t.description} ${t.assignedTo} ${projectName}`.toLowerCase().includes(q);
    });
    if (statusFilter !== "All") list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "All") list = list.filter((t) => t.priority === priorityFilter);
    if (projectFilter !== "All") list = list.filter((t) => t.projectId === projectFilter);
    const dir = taskSortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (taskSortKey === "newest") return (b.id - a.id) * dir;
      if (taskSortKey === "oldest") return (a.id - b.id) * dir;
      if (taskSortKey === "priority") return (priorityRank(b.priority) - priorityRank(a.priority)) * dir;
      if (taskSortKey === "status") return (statusRank(b.status) - statusRank(a.status)) * dir;
      if (taskSortKey === "dueDate") return (safeDateValue(a.dueDate) - safeDateValue(b.dueDate)) * dir;
      if (taskSortKey === "title") return a.title.localeCompare(b.title) * dir;
      if (taskSortKey === "assignee") return a.assignedTo.localeCompare(b.assignedTo) * dir;
      if (taskSortKey === "project") {
        const an = a.projectId ? projectById.get(a.projectId)?.name ?? "" : "";
        const bn = b.projectId ? projectById.get(b.projectId)?.name ?? "" : "";
        return an.localeCompare(bn) * dir;
      }
      return 0;
    });
    return list;
  }, [typedTasks, taskQuery, statusFilter, priorityFilter, projectFilter, taskSortKey, taskSortDir, projectById]);

  const visibleTaskIdsAll = useMemo(() => filteredTasksAll.map((t) => t.id), [filteredTasksAll]);
  const allVisibleSelected = useMemo(() => {
    if (visibleTaskIdsAll.length === 0) return false;
    return visibleTaskIdsAll.every((id) => selected[id]);
  }, [visibleTaskIdsAll, selected]);

  const stats = useMemo(() => ({
    totalProjects: typedProjects.length,
    totalTasks: typedTasks.length,
    completed: typedTasks.filter((t) => t.status === "Completed").length,
    inProgress: typedTasks.filter((t) => t.status === "In Progress").length,
  }), [typedProjects, typedTasks]);

  const renderProjectProgress = (projectId: number) => {
    const s = projectStats.get(projectId) ?? { total: 0, completed: 0 };
    const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;
    return (
      <div className="min-w-[180px]">
        <div className="flex items-center justify-between text-[11px] text-text-primary/70">
          <span>{s.completed}/{s.total} completed</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
      </div>
    );
  };

  const projectName = (pid?: number) => (pid ? projectById.get(pid)?.name ?? "—" : "—");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Submission Detail Modal */}
      <AnimatePresence>
        {selectedSubmission && (
          <SubmissionDetailModal
            key={selectedSubmission.id}
            task={selectedSubmission}
            projectName={
              selectedSubmission.projectId
                ? projectById.get(selectedSubmission.projectId)?.name ?? "Unknown Project"
                : "No Project"
            }
            currentAdminName={currentAdmin?.name}
            onClose={() => setSelectedSubmission(null)}
            onApprove={() => reviewSubmission(selectedSubmission.id, "Approved")}
            onReturn={() => reviewSubmission(selectedSubmission.id, "Rejected")}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-text-heading">Project Management</div>
          <div className="text-sm text-text-primary/70">{formatFullDate(now)}</div>
        </div>
        <div className="bg-primary text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Projects" value={stats.totalProjects} tone="slate" />
        <StatCard label="Total Tasks" value={stats.totalTasks} tone="primary" />
        <StatCard label="In Progress" value={stats.inProgress} tone="secondary" />
        <StatCard label="Completed" value={stats.completed} tone="success" />
      </div>

      {/* ══════════════════════════════════════════════════════════
          PENDING APPROVALS PANEL
      ══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.04 }}
        className="bg-card rounded-2xl shadow-sm border border-amber-200 overflow-hidden"
      >
        {/* Panel header */}
        <div className="p-5 border-b border-amber-100 bg-amber-50/60">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-heading">Pending Approvals</span>
                  {pendingSubmissions.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold"
                    >
                      {pendingSubmissions.length}
                    </motion.span>
                  )}
                </div>
                <div className="text-xs text-text-primary/60 mt-0.5">
                  Task completion submissions awaiting your review
                </div>
              </div>
            </div>

            {/* Filter tabs + search */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Visibility filter */}
              <div className="flex items-center gap-1 bg-white border border-amber-200 rounded-xl p-1">
                {(["all", "leader-required", "manager-only"] as const).map((f) => (
                  <button key={f} type="button"
                    onClick={() => setPendingFilter(f)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all",
                      pendingFilter === f
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-amber-700 hover:bg-amber-50"
                    )}>
                    {f === "all" ? "All" : f === "leader-required" ? "Leader Review" : "Manager Only"}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 border border-amber-200 rounded-xl px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-amber-300/50">
                <Search className="h-3.5 w-3.5 text-amber-400" />
                <input
                  value={pendingQuery}
                  onChange={(e) => setPendingQuery(e.target.value)}
                  placeholder="Search submissions…"
                  className="outline-none text-sm w-36 text-text-heading placeholder:text-slate-400"
                />
                {pendingQuery && (
                  <button type="button" onClick={() => setPendingQuery("")}
                    className="text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submissions list */}
        <div className="divide-y divide-amber-50">
          <AnimatePresence mode="popLayout">
            {filteredPendingSubmissions.length === 0 ? (
              <motion.div
                key="pending-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-amber-300" />
                </div>
                <p className="text-sm font-semibold text-slate-400">
                  {pendingQuery || pendingFilter !== "all"
                    ? "No submissions match your filter"
                    : "No pending submissions"}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {pendingQuery || pendingFilter !== "all"
                    ? "Try adjusting your search or filter"
                    : "All task completions have been reviewed"}
                </p>
              </motion.div>
            ) : (
              filteredPendingSubmissions.map((task, i) => {
                const req = task.completionRequest!;
                const pName = task.projectId
                  ? projectById.get(task.projectId)?.name ?? "—"
                  : "—";
                const isLeaderRequired = req.visibility === "leader-required";
                const hasAttachments = (req.attachments ?? []).length > 0;

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex flex-col lg:flex-row lg:items-center gap-4 px-5 py-4 hover:bg-amber-50/40 transition-colors group"
                  >
                    {/* Left: task info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Indicator dot */}
                      <div className="mt-1.5 flex-shrink-0">
                        <span className="block w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-200" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-text-heading text-sm truncate">
                            {task.title}
                          </span>
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            isLeaderRequired
                              ? "bg-violet-50 text-violet-700 border-violet-200"
                              : "bg-sky-50 text-sky-700 border-sky-200"
                          )}>
                            <ShieldCheck className="w-2.5 h-2.5" />
                            {isLeaderRequired ? "Leader Review" : "Manager Only"}
                          </span>
                          {hasAttachments && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <Paperclip className="w-2.5 h-2.5" />
                              {req.attachments.length} {req.attachments.length === 1 ? "file" : "files"}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-primary/60">
                          <span className="font-medium">
                            Project: <span className="text-[#1F3C68] font-semibold">{pName}</span>
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-medium">
                            By: <span className="text-[#1F3C68] font-semibold">{req.requestedBy ?? task.assignedTo}</span>
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(req.requestedAt)}
                          </span>
                        </div>

                        {req.note && (
                          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-100">
                            <span className="font-semibold text-amber-700">Note: </span>
                            {req.note}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 shrink-0 pl-5 lg:pl-0">
                      <button
                        type="button"
                        onClick={() => setSelectedSubmission(task)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-[#1F3C68]/30 hover:text-[#1F3C68] transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Review
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewSubmission(task.id, "Rejected")}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-100 bg-white text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Return
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewSubmission(task.id, "Approved")}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1F3C68] text-xs font-bold text-white hover:bg-[#173254] transition shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        title={
          modalMode === "project"
            ? editingProjectId !== null ? `Edit Project #${editingProjectId}` : "Create Project"
            : editingTaskId !== null ? `Edit Task #${editingTaskId}` : "Create Task"
        }
        onClose={closeModal}
      >
        <div className="space-y-4">
          {modalMode === "project" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs font-semibold text-text-heading">Project name</div>
                  <input value={projectForm.name}
                    onChange={(e) => setProjectForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Worktime+ Revamp"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs font-semibold text-text-heading">Project leader</div>
                  <select value={projectForm.leaderId || ""}
                    onChange={(e) => setProjectForm((p) => ({ ...p, leaderId: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="" disabled>Select leader...</option>
                    {leaderOptions.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="space-y-1">
                <div className="text-xs font-semibold text-text-heading">Description</div>
                <textarea value={projectForm.description}
                  onChange={(e) => setProjectForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="What is this project about?"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white min-h-[100px] outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
              <label className="space-y-1">
                <div className="text-xs font-semibold text-text-heading">Due date (optional)</div>
                <input type="date" value={projectForm.dueDate ?? ""}
                  onChange={(e) => setProjectForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs font-semibold text-text-heading">Task title</div>
                  <input value={taskForm.title}
                    onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Task title"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs font-semibold text-text-heading">Project</div>
                  <select value={taskForm.projectId ?? ""}
                    onChange={(e) => setTaskForm((p) => ({ ...p, projectId: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30"
                    disabled={typedProjects.length === 0}>
                    <option value="" disabled>
                      {typedProjects.length === 0 ? "No projects yet" : "Select project..."}
                    </option>
                    {typedProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs font-semibold text-text-heading">Assigned to</div>
                  <select value={taskForm.assignedToId ?? ""}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const name = userNameById.get(id) ?? "";
                      setTaskForm((p) => ({ ...p, assignedToId: id, assignedTo: name }));
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="" disabled>Select employee...</option>
                    {assignees.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <div className="text-xs font-semibold text-text-heading">Assigned by (Admin)</div>
                  <select value={taskForm.assignedById ?? ""}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const name = userNameById.get(id) ?? "";
                      setTaskForm((p) => ({ ...p, assignedById: id, assignedBy: name }));
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="" disabled>Select admin...</option>
                    {(admins ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="space-y-1">
                <div className="text-xs font-semibold text-text-heading">Due date (optional)</div>
                <input type="date" value={taskForm.dueDate ?? ""}
                  onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
              <label className="space-y-1">
                <div className="text-xs font-semibold text-text-heading">Description</div>
                <textarea value={taskForm.description}
                  onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Description"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white min-h-[100px] outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs font-semibold text-text-heading">Priority</div>
                  <select value={taskForm.priority}
                    onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value as TaskPriority }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30">
                    {PRIORITY.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <div className="text-xs font-semibold text-text-heading">Status</div>
                  <select value={taskForm.status}
                    onChange={(e) => setTaskForm((p) => ({ ...p, status: e.target.value as TaskStatus }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30">
                    {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
            </>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-text-heading">Tags (optional)</div>
            <div className="flex gap-2">
              <input value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="e.g., UI, Bug, Backend"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              />
              <button onClick={addTag} type="button"
                className="bg-soft hover:bg-slate-200 text-text-primary px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {((modalMode === "project" ? projectForm.tags : taskForm.tags) ?? []).map((tag) => (
                <span key={tag}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white text-xs font-semibold text-text-primary">
                  {tag}
                  <button type="button"
                    className="text-text-primary/50 hover:text-text-primary"
                    onClick={() => removeTag(tag)}>✕</button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={closeModal} type="button"
              className="bg-soft hover:bg-slate-200 text-text-primary px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200">
              Cancel
            </button>
            <button onClick={saveModal} type="button"
              className="bg-primary hover:opacity-95 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
              {modalMode === "project"
                ? editingProjectId !== null ? "Update Project" : "Create Project"
                : editingTaskId !== null ? "Update Task" : "Create Task"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Project List */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.08 }}
        className="bg-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        <div className="p-5 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-text-heading">Projects</div>
              <div className="text-xs text-text-primary/70">Create projects and manage subtasks under each project</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={openCreateProject} type="button"
                className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-3 py-2 text-sm font-semibold hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary/30">
                <Plus className="h-4 w-4" /> Create Project
              </button>
              <button onClick={() => openCreateTask()} type="button"
                className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-soft rounded-xl px-3 py-2 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30">
                <Plus className="h-4 w-4 text-text-primary/70" /> Add Task
              </button>
              <button onClick={() => setShowAllTasks((v) => !v)} type="button"
                className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-soft rounded-xl px-3 py-2 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30">
                {showAllTasks ? "Hide" : "Show"} All Tasks
              </button>
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-primary/30">
                <Search className="h-4 w-4 text-text-primary/50" />
                <input value={projectQuery}
                  onChange={(e) => setProjectQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="outline-none text-sm w-44" />
              </div>
              <select value={leaderFilter}
                onChange={(e) => setLeaderFilter(e.target.value === "All" ? "All" : Number(e.target.value))}
                className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm">
                <option value="All">All Leaders</option>
                {leaderOptions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select value={projectSortKey}
                onChange={(e) => setProjectSortKey(e.target.value as ProjectSortKey)}
                className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm">
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="name">Sort: Name</option>
                <option value="leader">Sort: Leader</option>
                <option value="dueDate">Sort: Due Date</option>
                <option value="progress">Sort: Progress</option>
              </select>
              <button type="button"
                onClick={() => setProjectSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-soft rounded-xl px-3 py-2 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30">
                <ArrowUpDown className="h-4 w-4 text-text-primary/70" />
                {projectSortDir === "asc" ? "Asc" : "Desc"}
              </button>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <AdminTable headers={["", "Project", "Leader", "Due", "Progress", "Actions"]}>
            {filteredProjects.map((p) => {
              const expanded = !!expandedProjects[p.id];
              const leaderName = userNameById.get(p.leaderId) ?? "—";
              const due = p.dueDate ? p.dueDate : "—";
              const projectTasks = tasksByProject.get(p.id) ?? [];
              const pendingCount = projectTasks.filter(
                (t) => (t as AdminTask).completionRequest?.status === "Pending"
              ).length;

              return (
                <React.Fragment key={p.id}>
                  <motion.tr
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="align-top"
                  >
                    <td className="px-4 py-3">
                      <button type="button"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                        onClick={() => toggleExpanded(p.id)}>
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        Tasks
                      </button>
                    </td>
                    <td className="px-4 py-3 min-w-[320px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-text-heading">{p.name}</div>
                        {pendingCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-2.5 h-2.5" />
                            {pendingCount} pending
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-primary/70 line-clamp-2">{p.description}</div>
                      {(p.tags?.length ?? 0) > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {p.tags!.slice(0, 4).map((tag) => (
                            <span key={tag}
                              className="px-2 py-0.5 rounded-full border border-slate-200 bg-white text-[10px] font-semibold text-text-primary">
                              {tag}
                            </span>
                          ))}
                          {p.tags!.length > 4 && (
                            <span className="text-[10px] text-text-primary/60">+{p.tags!.length - 4}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[180px]">{leaderName}</td>
                    <td className="px-4 py-3 min-w-[140px] text-sm text-text-primary">{due}</td>
                    <td className="px-4 py-3">{renderProjectProgress(p.id)}</td>
                    <td className="px-4 py-3 min-w-[260px]">
                      <div className="flex items-center gap-3 flex-wrap">
                        <button onClick={() => openCreateTask(p.id)} type="button"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-semibold">
                          <Plus className="h-4 w-4" /> Add Task
                        </button>
                        <button onClick={() => openEditProject(p)} type="button"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-semibold">
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button onClick={() => removeProject(p.id)} type="button"
                          className="inline-flex items-center gap-1.5 text-sm text-red-700 hover:underline font-semibold">
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                        <span className="text-xs text-text-primary/60">({projectTasks.length} tasks)</span>
                      </div>
                    </td>
                  </motion.tr>

                  <AnimatePresence>
                    {expanded && (
                      <motion.tr
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.15 }}
                        className="bg-soft border-t border-slate-200"
                      >
                        <td colSpan={6} className="px-4 py-4">
                          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                            <div className="p-4 flex items-center justify-between gap-3 flex-wrap border-b border-slate-100">
                              <div>
                                <div className="text-sm font-semibold text-text-heading">Tasks under {p.name}</div>
                                <div className="text-xs text-text-primary/70">Subtasks for this project</div>
                              </div>
                              <button onClick={() => openCreateTask(p.id)} type="button"
                                className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-3 py-2 text-sm font-semibold hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary/30">
                                <Plus className="h-4 w-4" /> Add Task
                              </button>
                            </div>
                            <div className="w-full overflow-x-auto">
                              <AdminTable headers={["Title", "Assigned To", "Priority", "Status", "Submission", "Due", "Actions"]}>
                                {projectTasks.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-text-primary/60">
                                      No tasks yet for this project.
                                    </td>
                                  </tr>
                                ) : (
                                  projectTasks.map((t) => {
                                    const adminT = t as AdminTask;
                                    const hasPending = adminT.completionRequest?.status === "Pending";
                                    return (
                                      <tr key={t.id} className="align-top">
                                        <td className="px-4 py-3 min-w-[280px]">
                                          <div className="font-semibold text-text-heading">{t.title}</div>
                                          <div className="text-xs text-text-primary/70 line-clamp-2">{t.description}</div>
                                        </td>
                                        <td className="px-4 py-3 min-w-[150px]">{t.assignedTo}</td>
                                        <td className="px-4 py-3">
                                          <Pill tone={t.priority === "High" ? "secondary" : t.priority === "Medium" ? "primary" : "slate"}>
                                            {t.priority}
                                          </Pill>
                                        </td>
                                        <td className="px-4 py-3 min-w-[180px]">
                                          <select value={t.status}
                                            onChange={(e) => setTaskStatus(t.id, e.target.value as TaskStatus)}
                                            className="border border-slate-200 rounded-xl px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm w-full">
                                            {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                                          </select>
                                        </td>
                                        {/* Submission status column */}
                                        <td className="px-4 py-3 min-w-[160px]">
                                          {hasPending ? (
                                            <button type="button"
                                              onClick={() => setSelectedSubmission(adminT)}
                                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition">
                                              <AlertCircle className="w-3 h-3" />
                                              Review Submission
                                            </button>
                                          ) : adminT.completionRequest?.status === "Approved" ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                                              <CheckCircle2 className="w-3 h-3" /> Approved
                                            </span>
                                          ) : adminT.completionRequest?.status === "Rejected" ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                              <XCircle className="w-3 h-3" /> Returned
                                            </span>
                                          ) : (
                                            <span className="text-xs text-text-primary/40">—</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-text-primary min-w-[120px]">
                                          {t.dueDate ? t.dueDate : <span className="text-text-primary/50">—</span>}
                                        </td>
                                        <td className="px-4 py-3 min-w-[160px]">
                                          <div className="flex items-center gap-3">
                                            <button onClick={() => openEditTask(adminT)} type="button"
                                              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-semibold">
                                              <Pencil className="h-4 w-4" /> Edit
                                            </button>
                                            <button onClick={() => removeTask(t.id)} type="button"
                                              className="inline-flex items-center gap-1.5 text-sm text-red-700 hover:underline font-semibold">
                                              <Trash2 className="h-4 w-4" /> Delete
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </AdminTable>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
            {filteredProjects.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-primary/60">
                  No projects found.
                </td>
              </tr>
            )}
          </AdminTable>
        </div>
      </motion.div>

      {/* All Tasks section */}
      <AnimatePresence>
        {showAllTasks && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="bg-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="p-5 border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-text-heading">All Tasks</div>
                  <div className="text-xs text-text-primary/70">Includes a Project column so you can see where each task belongs</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => openCreateTask()} type="button"
                    className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-3 py-2 text-sm font-semibold hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <Plus className="h-4 w-4" /> Add Task
                  </button>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-primary/30">
                    <Search className="h-4 w-4 text-text-primary/50" />
                    <input value={taskQuery} onChange={(e) => setTaskQuery(e.target.value)}
                      placeholder="Search tasks..."
                      className="outline-none text-sm w-44" />
                  </div>
                  <select value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value === "All" ? "All" : Number(e.target.value))}
                    className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm">
                    <option value="All">All Projects</option>
                    {typedProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "All")}
                    className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm">
                    <option value="All">All Status</option>
                    {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | "All")}
                    className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm">
                    <option value="All">All Priority</option>
                    {PRIORITY.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select value={taskSortKey}
                    onChange={(e) => setTaskSortKey(e.target.value as TaskSortKey)}
                    className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm">
                    <option value="newest">Sort: Newest</option>
                    <option value="oldest">Sort: Oldest</option>
                    <option value="dueDate">Sort: Due Date</option>
                    <option value="priority">Sort: Priority</option>
                    <option value="status">Sort: Status</option>
                    <option value="title">Sort: Title</option>
                    <option value="assignee">Sort: Assigned To</option>
                    <option value="project">Sort: Project</option>
                  </select>
                  <button type="button"
                    onClick={() => setTaskSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-soft rounded-xl px-3 py-2 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <ArrowUpDown className="h-4 w-4 text-text-primary/70" />
                    {taskSortDir === "asc" ? "Asc" : "Desc"}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {selectedIds.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}
                    className="flex items-center justify-between gap-3 flex-wrap bg-soft border border-slate-200 rounded-2xl p-3"
                  >
                    <div className="text-sm font-semibold text-text-heading">{selectedIds.length} selected</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => bulkSetStatus("Pending")} type="button"
                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-soft">
                        Mark Pending
                      </button>
                      <button onClick={() => bulkSetStatus("In Progress")} type="button"
                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-soft">
                        Mark In Progress
                      </button>
                      <button onClick={() => bulkSetStatus("Completed")} type="button"
                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-soft">
                        Mark Completed
                      </button>
                      <button onClick={bulkDelete} type="button"
                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100">
                        Delete Selected
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="w-full overflow-x-auto">
              <AdminTable headers={["", "Task", "Project", "Assigned To", "Priority", "Status", "Submission", "Due", "Actions"]}>
                <tr className="bg-soft border-b border-slate-200">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={allVisibleSelected}
                      onChange={(e) => toggleAllVisible(visibleTaskIdsAll, e.target.checked)} />
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary" colSpan={8}>
                    Select all visible
                  </td>
                </tr>
                {filteredTasksAll.map((t) => {
                  const adminT = t as AdminTask;
                  const hasPending = adminT.completionRequest?.status === "Pending";
                  return (
                    <motion.tr key={t.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className="align-top">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={!!selected[t.id]}
                          onChange={(e) => toggleOne(t.id, e.target.checked)} />
                      </td>
                      <td className="px-4 py-3 min-w-[280px]">
                        <div className="font-semibold text-text-heading">{t.title}</div>
                        <div className="text-xs text-text-primary/70 line-clamp-2">{t.description}</div>
                      </td>
                      <td className="px-4 py-3 min-w-[200px]">{projectName(t.projectId)}</td>
                      <td className="px-4 py-3 min-w-[160px]">{t.assignedTo}</td>
                      <td className="px-4 py-3">
                        <Pill tone={t.priority === "High" ? "secondary" : t.priority === "Medium" ? "primary" : "slate"}>
                          {t.priority}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 min-w-[160px]">
                        <select value={t.status}
                          onChange={(e) => setTaskStatus(t.id, e.target.value as TaskStatus)}
                          className="border border-slate-200 rounded-xl px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm w-full">
                          {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      {/* Submission status */}
                      <td className="px-4 py-3 min-w-[160px]">
                        {hasPending ? (
                          <button type="button"
                            onClick={() => setSelectedSubmission(adminT)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition">
                            <AlertCircle className="w-3 h-3" /> Review
                          </button>
                        ) : adminT.completionRequest?.status === "Approved" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        ) : adminT.completionRequest?.status === "Rejected" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" /> Returned
                          </span>
                        ) : (
                          <span className="text-xs text-text-primary/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary min-w-[120px]">
                        {t.dueDate ? t.dueDate : <span className="text-text-primary/50">—</span>}
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEditTask(adminT)} type="button"
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-semibold">
                            <Pencil className="h-4 w-4" /> Edit
                          </button>
                          <button onClick={() => removeTask(t.id)} type="button"
                            className="inline-flex items-center gap-1.5 text-sm text-red-700 hover:underline font-semibold">
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
                {filteredTasksAll.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-text-primary/60">
                      No tasks found.
                    </td>
                  </tr>
                )}
              </AdminTable>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ label, value, tone }: {
  label: string; value: number;
  tone: "secondary" | "primary" | "success" | "slate";
}) {
  const bar = tone === "secondary" ? "bg-secondary"
    : tone === "primary" ? "bg-primary"
    : tone === "success" ? "bg-green-500"
    : "bg-slate-400";
  const pct = Math.max(8, Math.min(100, value * 10));
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
      className="bg-card rounded-2xl shadow-sm border border-slate-200 p-5">
      <div className="text-[10px] font-bold text-slate-500">{label.toUpperCase()}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-3xl font-extrabold text-text-heading">{value}</div>
        <div className="text-xs text-text-primary/70">items</div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>0</span><span>{value}</span>
      </div>
    </motion.div>
  );
}