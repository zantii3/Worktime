import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, FolderKanban, Search, X, ChevronRight,
  Calendar, Tag, Clock, CheckCircle2,
  Circle, PlayCircle, AlertCircle, Layers, Eye,
  FileText, FileImage, Users, Download, Paperclip,
  ZoomIn, ZoomOut, RotateCw,
} from "lucide-react";
import Usersidebar from "./components/Usersidebar.tsx";
import { clearCurrentUser, getCurrentUser } from "../utils/sessionAuth";

// Static import — always available, no fetch dependency, guarantees member
// resolution even when the dev server doesn't serve /accounts.json.
import staticAccountsJson from "../data/accounts.json";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ProjectStatus   = "Not Started" | "In Progress" | "On Hold" | "Completed";
type ProjectPriority = "Low" | "Medium" | "High" | "Critical";

interface Account {
  id: number;
  email: string;
  name: string;
}

interface ProjectMember {
  id: string;
  name: string;
  email?: string;
}

interface ProjectFile {
  id: number;
  name: string;
  base64: string;
  uploadedBy: string;
  uploadedAt: string;
  projectId: number;
}

interface Project {
  id: number;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string;
  endDate: string;
  progress: number;
  members: ProjectMember[];
  tags: string[];
  tasksTotal: number;
  tasksCompleted: number;
  createdAt: string;
  rawFiles: ProjectFile[];
  taskFiles: MergedFile[];
}

const PROJECTS_KEY = "worktime_projects_v1";
const TASKS_KEY    = "worktime_tasks_v1";
const CREATED_KEY  = "worktime_created_accounts_v1";
const DELETED_KEY  = "worktime_deleted_account_ids_v1";
const EDITS_KEY    = "worktime_account_edits_v1";

type TaskStatus   = "Pending" | "In Progress" | "Completed";
type TaskPriority = "Low" | "Medium" | "High";

type TaskAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

interface Task {
  id: number;
  title: string;
  description: string;
  assignedTo: string;
  assignedToId?: number;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  projectId?: number;
  attachments?: TaskAttachment[];
  completionRequest?: {
    attachments?: TaskAttachment[];
    requestedBy?: string;
    requestedAt?: string;
  };
}

interface StoredProject {
  id: number;
  name: string;
  description: string;
  leaderId: number;
  dueDate?: string;
  tags?: string[];
  files?: ProjectFile[];
  memberIds?: number[];
}

type StoredAccount = {
  id: number;
  kind: "user" | "admin";
  name: string;
  email: string;
  password: string;
  roleLabel: string;
  department: string;
  createdAt: string;
};

type AccountEdit = { name?: string; email?: string; password?: string; roleLabel?: string; department?: string };
type EditsMap    = Record<string, AccountEdit>;

type MergedFile = {
  id: string;
  name: string;
  base64: string;
  uploadedBy: string;
  uploadedAt: string;
  projectId: number;
  source: "project" | "task-attachment" | "task-completion";
};

// ─── Status / Priority config ──────────────────────────────────────────────────
const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  "Not Started": { label: "Not Started", color: "#64748b", bg: "bg-slate-50",  border: "border-slate-200", icon: <Circle      className="w-3.5 h-3.5" /> },
  "In Progress": { label: "In Progress", color: "#1F3C68", bg: "bg-blue-50",   border: "border-blue-200",  icon: <PlayCircle  className="w-3.5 h-3.5" /> },
  "On Hold":     { label: "On Hold",     color: "#d97706", bg: "bg-amber-50",  border: "border-amber-200", icon: <AlertCircle className="w-3.5 h-3.5" /> },
  Completed:     { label: "Completed",   color: "#16a34a", bg: "bg-green-50",  border: "border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

const PRIORITY_CONFIG: Record<ProjectPriority, { color: string; bg: string; border: string }> = {
  Low:      { color: "#16a34a", bg: "bg-green-50",  border: "border-green-200"  },
  Medium:   { color: "#d97706", bg: "bg-amber-50",  border: "border-amber-200"  },
  High:     { color: "#dc2626", bg: "bg-red-50",    border: "border-red-200"    },
  Critical: { color: "#7c3aed", bg: "bg-purple-50", border: "border-purple-200" },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
}

function getFileCategory(name: string, base64: string): "image" | "pdf" | "other" {
  if (base64.startsWith("data:image/"))         return "image";
  if (base64.startsWith("data:application/pdf")) return "pdf";
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["jpg","jpeg","png","gif","webp","svg","bmp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

function triggerDownload(name: string, base64: string) {
  const a = document.createElement("a");
  a.href = base64;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Returns the canonical list of user accounts by merging:
 *   1. staticBase — either the statically-imported JSON (always available) or a
 *      live-fetched override passed in by the caller.
 *   2. localStorage-created accounts (Users.tsx)
 *   3. Admin-applied edits (name / email overrides)
 *   Tombstoned (deleted) IDs are excluded.
 *
 * Being a pure function with no fetch() dependency means it can be called
 * synchronously on first render — no blank flash for the member list.
 */
function resolveAllUserAccounts(staticBase?: Account[]): Account[] {
  const deleted = new Set<string>(safeRead<string[]>(DELETED_KEY, []));
  const edits   = safeRead<EditsMap>(EDITS_KEY, {});
  const created = safeRead<StoredAccount[]>(CREATED_KEY, []);

  const base = staticBase ?? (staticAccountsJson as Account[]);
  const result: Account[] = [];

  for (const a of base) {
    const key = `user:${a.id}`;
    if (deleted.has(key)) continue;
    const edit = edits[key] ?? {};
    result.push({ id: a.id, name: edit.name ?? a.name, email: edit.email ?? a.email });
  }

  for (const a of created) {
    if (a.kind !== "user") continue;
    const key = `user:${a.id}`;
    if (deleted.has(key)) continue;
    const edit = edits[key] ?? {};
    result.push({ id: a.id, name: edit.name ?? a.name, email: edit.email ?? a.email });
  }

  return result;
}

// ─── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: MergedFile["source"] }) {
  if (source === "project") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
        Admin upload
      </span>
    );
  }
  if (source === "task-completion") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-200 shrink-0">
        Completion proof
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
      <Paperclip className="w-2.5 h-2.5" />
      Task file
    </span>
  );
}

// ─── File Preview Modal ────────────────────────────────────────────────────────

function FilePreviewModal({
  file,
  onClose,
}: {
  file: MergedFile;
  onClose: () => void;
}) {
  const cat = getFileCategory(file.name, file.base64);
  const [imgScale,    setImgScale]    = useState(1);
  const [imgRotation, setImgRotation] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const sourceLabel =
    file.source === "project"          ? "Admin upload"
    : file.source === "task-completion" ? "Completion proof"
    : "Task file";

  const badgeColor =
    file.source === "project"          ? "bg-blue-500/20 text-blue-200"
    : file.source === "task-completion" ? "bg-green-500/20 text-green-200"
    : "bg-amber-500/20 text-amber-200";

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-white/10 bg-black/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {cat === "image"
            ? <FileImage className="w-5 h-5 text-white/60 shrink-0" />
            : <FileText  className="w-5 h-5 text-white/60 shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-white truncate">{file.name}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                {sourceLabel}
              </span>
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              {formatDate(file.uploadedAt)} · {file.uploadedBy}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {cat === "image" && (
            <>
              <button
                onClick={() => setImgScale((s) => Math.max(0.25, s - 0.25))}
                type="button" title="Zoom out"
                className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              >
                <ZoomOut className="w-4 h-4 text-white" />
              </button>
              <span className="text-xs text-white/60 tabular-nums w-10 text-center">
                {Math.round(imgScale * 100)}%
              </span>
              <button
                onClick={() => setImgScale((s) => Math.min(4, s + 0.25))}
                type="button" title="Zoom in"
                className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              >
                <ZoomIn className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setImgRotation((r) => (r + 90) % 360)}
                type="button" title="Rotate"
                className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              >
                <RotateCw className="w-4 h-4 text-white" />
              </button>
              <div className="w-px h-5 bg-white/20 mx-1" />
            </>
          )}

          <button
            onClick={() => triggerDownload(file.name, file.base64)}
            type="button"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>

          <button
            onClick={onClose}
            type="button"
            className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Content — click backdrop to close */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center p-6"
        onClick={onClose}
      >
        {cat === "image" && (
          <img
            src={file.base64}
            alt={file.name}
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `scale(${imgScale}) rotate(${imgRotation}deg)`,
              transition: "transform 0.2s ease",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              borderRadius: 8,
              display: "block",
            }}
          />
        )}

        {cat === "pdf" && (
          <div
            className="w-full rounded-xl overflow-hidden border border-white/10"
            style={{ height: "75vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={file.base64}
              title={file.name}
              className="w-full h-full"
              style={{ border: "none" }}
            />
          </div>
        )}

        {cat === "other" && (
          <div
            className="flex flex-col items-center gap-5 text-center p-10 rounded-2xl border border-white/10 bg-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center">
              <FileText className="w-8 h-8 text-white/50" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">{file.name}</p>
              <p className="text-white/50 text-sm mt-1">
                This file type can't be previewed in the browser.
              </p>
            </div>
            <button
              onClick={() => triggerDownload(file.name, file.base64)}
              type="button"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1F3C68] text-white text-sm font-semibold hover:opacity-90 transition"
            >
              <Download className="w-4 h-4" />
              Download to view
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Project Detail Modal ───────────────────────────────────────────────────────
type DetailTab = "overview" | "files" | "members";

function ProjectDetailModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const statusCfg   = STATUS_CONFIG[project.status];
  const priorityCfg = PRIORITY_CONFIG[project.priority];
  const [tab,         setTab]         = useState<DetailTab>("overview");
  const [previewFile, setPreviewFile] = useState<MergedFile | null>(null);

  const daysLeft = () => {
    const diff = new Date(project.endDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0)   return { label: `${Math.abs(days)}d overdue`, color: "text-red-500"  };
    if (days === 0) return { label: "Due today",                  color: "text-amber-500" };
    return           { label: `${days}d left`,                    color: "text-slate-500" };
  };
  const dl = daysLeft();

  const allFiles: MergedFile[] = useMemo(() => {
    const projectFiles: MergedFile[] = project.rawFiles.map((f) => ({
      id:         `proj-${f.id}`,
      name:       f.name,
      base64:     f.base64,
      uploadedBy: f.uploadedBy,
      uploadedAt: f.uploadedAt,
      projectId:  f.projectId,
      source:     "project" as const,
    }));
    return [...projectFiles, ...project.taskFiles];
  }, [project.rawFiles, project.taskFiles]);

  const TABS: { key: DetailTab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "files",    label: "Files",   count: allFiles.length       },
    { key: "members",  label: "Members", count: project.members.length },
  ];

  return (
    <>
      {/* File preview floats above the modal (z-[60] > modal z-50) */}
      <AnimatePresence>
        {previewFile && (
          <FilePreviewModal
            key={previewFile.id}
            file={previewFile}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-primary p-5 text-white flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 bg-white/20 rounded-xl flex-shrink-0 mt-0.5">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mb-0.5">
                    Project Details
                  </p>
                  <h2 className="text-lg font-bold leading-snug">{project.name}</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/20 rounded-xl transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-1 mt-4">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    tab === t.key
                      ? "bg-white text-primary"
                      : "bg-white/15 text-white/80 hover:bg-white/25"
                  }`}
                >
                  {t.label}
                  {t.count !== undefined && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[9px] font-bold px-1 ${
                        tab === t.key
                          ? "bg-primary/10 text-primary"
                          : "bg-white/20 text-white"
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-4">

            {/* ── Overview ── */}
            {tab === "overview" && (
              <>
                <div className="flex gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.border}`}
                    style={{ color: statusCfg.color }}
                  >
                    {statusCfg.icon}{statusCfg.label}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${priorityCfg.bg} ${priorityCfg.border}`}
                    style={{ color: priorityCfg.color }}
                  >
                    <Tag className="w-3 h-3" />{project.priority} Priority
                  </span>
                </div>

                <p className="text-slate-600 text-sm leading-relaxed">
                  {project.description || "No description provided."}
                </p>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-500 mb-1.5">
                    <span>Progress</span>
                    <span className="font-bold text-[#1F3C68]">{project.progress}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${project.progress}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className={`h-full rounded-full ${
                        project.progress === 100
                          ? "bg-gradient-to-r from-green-400 to-emerald-500"
                          : "bg-gradient-to-r from-[#F28C28] to-[#E97638]"
                      }`}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {project.tasksCompleted} of {project.tasksTotal} tasks completed
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Start Date</p>
                    <p className="text-sm font-bold text-[#1F3C68]">{formatDate(project.startDate)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">End Date</p>
                    <p className="text-sm font-bold text-[#1F3C68]">{formatDate(project.endDate)}</p>
                    <p className={`text-[10px] font-semibold mt-0.5 ${dl.color}`}>{dl.label}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-yellow-600">
                      {project.tasksTotal - project.tasksCompleted}
                    </p>
                    <p className="text-[9px] font-semibold text-yellow-700 uppercase tracking-wide">Remaining</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#1F3C68]">{project.tasksTotal}</p>
                    <p className="text-[9px] font-semibold text-blue-700 uppercase tracking-wide">Total Tasks</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-green-600">{project.tasksCompleted}</p>
                    <p className="text-[9px] font-semibold text-green-700 uppercase tracking-wide">Done</p>
                  </div>
                </div>

                {project.tags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {project.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#1F3C68]/10 text-[#1F3C68] border border-[#1F3C68]/20"
                        >
                          <Tag className="w-2.5 h-2.5" />{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Files ── */}
            {tab === "files" && (
              <div className="space-y-2">
                {allFiles.length === 0 ? (
                  <div className="py-12 flex flex-col items-center text-center text-slate-400">
                    <FileText className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm font-semibold">No files yet</p>
                    <p className="text-xs mt-1 text-slate-300">
                      Files uploaded by your manager or attached to tasks will appear here.
                    </p>
                  </div>
                ) : (
                  allFiles.map((file) => {
                    const cat = getFileCategory(file.name, file.base64);
                    return (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                      >
                        {/* Thumbnail — clickable to preview */}
                        <button
                          type="button"
                          onClick={() => setPreviewFile(file)}
                          title="Preview"
                          className="h-10 w-10 rounded-lg overflow-hidden border border-slate-200 bg-white flex items-center justify-center shrink-0 hover:border-[#1F3C68]/40 hover:ring-2 hover:ring-[#1F3C68]/10 transition group/thumb"
                        >
                          {cat === "image" ? (
                            <img
                              src={file.base64}
                              alt={file.name}
                              className="h-full w-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-400 group-hover/thumb:text-[#1F3C68] transition-colors" />
                          )}
                        </button>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* File name is itself a clickable preview trigger */}
                            <button
                              type="button"
                              onClick={() => setPreviewFile(file)}
                              className="text-xs font-semibold text-slate-700 hover:text-[#1F3C68] truncate text-left transition-colors"
                            >
                              {file.name}
                            </button>
                            <SourceBadge source={file.source} />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {formatDate(file.uploadedAt)} · {file.uploadedBy}
                          </p>
                        </div>

                        {/* Preview + Download buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setPreviewFile(file)}
                            type="button"
                            title="Preview"
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-[#1F3C68] hover:border-[#1F3C68]/30 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => triggerDownload(file.name, file.base64)}
                            type="button"
                            title="Download"
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-[#1F3C68] hover:border-[#1F3C68]/30 transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                <div className="flex items-center gap-2 pt-2 text-slate-300 text-[10px]">
                  <Eye className="w-3 h-3" />
                  <span>View & download only — contact your manager to add or remove files.</span>
                </div>
              </div>
            )}

            {/* ── Members ── */}
            {tab === "members" && (
              <div className="space-y-2">
                {project.members.length === 0 ? (
                  <div className="py-12 flex flex-col items-center text-center text-slate-400">
                    <Users className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm font-semibold">No members listed</p>
                    <p className="text-xs mt-1 text-slate-300">
                      Members will appear once your manager adds them.
                    </p>
                  </div>
                ) : (
                  project.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#1F3C68] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{m.name}</p>
                        {m.email && (
                          <p className="text-[10px] text-slate-400 truncate">{m.email}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}

                <div className="flex items-center gap-2 pt-2 text-slate-300 text-[10px]">
                  <Eye className="w-3 h-3" />
                  <span>View only — contact your manager to change project membership.</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Eye className="w-3.5 h-3.5" />
              <span>View-only — contact your manager to make changes</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

// ─── Project Card ───────────────────────────────────────────────────────────────
function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const statusCfg   = STATUS_CONFIG[project.status];
  const priorityCfg = PRIORITY_CONFIG[project.priority];

  const daysLeft = () => {
    const diff = new Date(project.endDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0)   return { label: `${Math.abs(days)}d overdue`, color: "text-red-500",   bg: "bg-red-50"   };
    if (days === 0) return { label: "Due today",                  color: "text-amber-600", bg: "bg-amber-50" };
    if (days <= 7)  return { label: `${days}d left`,              color: "text-amber-600", bg: "bg-amber-50" };
    return           { label: `${days}d left`,                    color: "text-slate-400", bg: "bg-slate-50" };
  };
  const dl = daysLeft();
  const totalFiles = project.rawFiles.length + project.taskFiles.length;

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="bg-white rounded-2xl shadow-md border border-slate-100 hover:shadow-xl hover:border-[#F28C28]/30 transition-all cursor-pointer overflow-hidden group"
    >
      <div className="h-1 w-full" style={{ background: priorityCfg.color, opacity: 0.7 }} />

      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-2 bg-[#1F3C68]/10 rounded-xl flex-shrink-0 mt-0.5 group-hover:bg-[#1F3C68]/15 transition-colors">
              <FolderKanban className="w-4 h-4 text-[#1F3C68]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#1F3C68] leading-snug line-clamp-1">{project.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                {project.description || "No description."}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#F28C28] transition-colors flex-shrink-0 mt-1" />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.bg} ${statusCfg.border}`}
            style={{ color: statusCfg.color }}
          >
            {statusCfg.icon}{statusCfg.label}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${priorityCfg.bg} ${priorityCfg.border}`}
            style={{ color: priorityCfg.color }}
          >
            {project.priority}
          </span>
          {totalFiles > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">
              <FileText className="w-2.5 h-2.5" />
              {totalFiles} {totalFiles === 1 ? "file" : "files"}
            </span>
          )}
          <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${dl.bg} ${dl.color}`}>
            <Clock className="w-2.5 h-2.5" />{dl.label}
          </span>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-[10px] font-medium text-slate-400 mb-1">
            <span>{project.tasksCompleted}/{project.tasksTotal} tasks</span>
            <span className="font-bold text-[#1F3C68]">{project.progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${project.progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={`h-full rounded-full ${
                project.progress === 100
                  ? "bg-gradient-to-r from-green-400 to-emerald-500"
                  : "bg-gradient-to-r from-[#F28C28] to-[#E97638]"
              }`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {project.members.slice(0, 4).map((m, i) => (
              <div
                key={m.id}
                title={m.name}
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] font-bold"
                style={{ zIndex: 10 - i, background: i % 2 === 0 ? "#1F3C68" : "#F28C28" }}
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {project.members.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-slate-500 text-[8px] font-bold">
                +{project.members.length - 4}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Calendar className="w-3 h-3" />
            <span>
              {new Date(project.endDate).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-300">
      <FolderKanban className="w-12 h-12 mb-3" />
      <p className="text-base font-semibold text-slate-400">
        {filtered ? "No projects match your filter" : "No projects assigned"}
      </p>
      <p className="text-xs text-slate-300 mt-1">
        {filtered ? "Try a different status or search term" : "Your manager will assign projects to you"}
      </p>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
function ProjectPage() {
  const location = useLocation();
  const navigate  = useNavigate();

  const rawUser = location.state?.user ?? getCurrentUser<any>();

  const [currentUser,     setCurrentUser]     = useState<Account | null>(null);
  // Initialise immediately from the static import — no async blank-flash on first render
  const [allUserAccounts, setAllUserAccounts] = useState<Account[]>(() => resolveAllUserAccounts());
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [storedProjects,  setStoredProjects]  = useState<StoredProject[]>([]);
  const [tasks,           setTasks]           = useState<Task[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [search,          setSearch]          = useState("");
  const [statusFilter,    setStatusFilter]    = useState<ProjectStatus | "All">("All");

  const handleLogout = () => { clearCurrentUser(); navigate("/"); };

  // ── Step 1: Identify current user (synchronous from static list) ─────────────
  useEffect(() => {
    if (!rawUser) return;

    // Resolve immediately — static import guarantees this is non-empty
    const immediate = resolveAllUserAccounts();
    const match = immediate.find(
      (a) =>
        String(a.id) === String(rawUser.id) ||
        a.email?.toLowerCase() === rawUser.email?.toLowerCase()
    );
    setCurrentUser(match ?? rawUser);
    setAllUserAccounts(immediate);

    // Optionally refresh from a live fetch (Vite serves the file at this path).
    // On success we get any edits applied since the last LS sync; failure is silent.
    fetch("/src/pages/data/accounts.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((fetched: Account[]) => {
        const enriched = resolveAllUserAccounts(fetched);
        setAllUserAccounts(enriched);
        const refreshed = enriched.find(
          (a) =>
            String(a.id) === String(rawUser.id) ||
            a.email?.toLowerCase() === rawUser.email?.toLowerCase()
        );
        if (refreshed) setCurrentUser(refreshed);
      })
      .catch(() => { /* already have the static list — nothing to do */ });
  }, [rawUser?.id, rawUser?.email]);

  // ── Step 2: Poll localStorage for projects + tasks ──────────────────────────
  useEffect(() => {
    const load = () => {
      try {
        const rawP = localStorage.getItem(PROJECTS_KEY);
        const rawT = localStorage.getItem(TASKS_KEY);
        setStoredProjects(rawP ? JSON.parse(rawP) : []);
        setTasks(rawT         ? JSON.parse(rawT) : []);
      } catch {
        setStoredProjects([]);
        setTasks([]);
      }
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  // ── Step 3: Derive visible projects ─────────────────────────────────────────
  const projects = useMemo<Project[]>(() => {
    if (!currentUser) return [];

    const currentUserId   = currentUser.id;
    const currentUserName = currentUser.name?.trim().toLowerCase();

    return storedProjects
      .filter((project) => {
        // Show project if the current user is the leader, an explicit member, or
        // assigned to at least one task in the project.
        const isLeader = String(project.leaderId) === String(currentUserId);
        const isExplicitMember = (project.memberIds ?? []).some(
          (id) => String(id) === String(currentUserId)
        );
        const isAssignedToTask = tasks.some((task) => {
          if (task.projectId !== project.id) return false;
          const byId   = task.assignedToId !== undefined && String(task.assignedToId) === String(currentUserId);
          const byName = !!task.assignedTo && task.assignedTo.trim().toLowerCase() === currentUserName;
          return byId || byName;
        });
        return isLeader || isExplicitMember || isAssignedToTask;
      })
      .map((project) => {
        const projectTasks   = tasks.filter((t) => t.projectId === project.id);
        const tasksTotal     = projectTasks.length;
        const tasksCompleted = projectTasks.filter((t) => t.status === "Completed").length;
        const hasInProgress  = projectTasks.some((t) => t.status === "In Progress");
        const hasStarted     = projectTasks.some((t) => t.status !== "Pending");
        const progress       = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

        // ── Build the COMPLETE member list for this project ──────────────────
        // Includes every user the admin added either via:
        //   a) ProjectList.tsx → Members modal  (stored in project.memberIds)
        //   b) ProjectManagement.tsx → task assignees  (task.assignedToId)
        // We resolve all IDs against allUserAccounts which always contains the
        // full static + localStorage-created account list.
        const memberIdsSet = new Set<number>([
          ...(project.memberIds ?? []),
          ...projectTasks
            .filter((t) => t.assignedToId != null)
            .map((t) => t.assignedToId as number),
        ]);

        const idMembers: ProjectMember[] = allUserAccounts
          .filter((a) => memberIdsSet.has(a.id))
          .map((a) => ({ id: String(a.id), name: a.name, email: a.email }));

        // Name-only assignees (tasks without assignedToId) shown as best-effort
        const namedOnlyMembers: ProjectMember[] = [];
        for (const task of projectTasks) {
          if (!task.assignedTo || task.assignedToId != null) continue;
          const key = task.assignedTo.trim().toLowerCase();
          if (!namedOnlyMembers.find((m) => m.id === key)) {
            namedOnlyMembers.push({ id: key, name: task.assignedTo });
          }
        }

        const members = [...idMembers, ...namedOnlyMembers];

        // Derive status from task states
        const status: ProjectStatus =
          tasksTotal === 0 || !hasStarted      ? "Not Started"
          : tasksCompleted === tasksTotal       ? "Completed"
          : hasInProgress || tasksCompleted > 0 ? "In Progress"
          : "On Hold";

        const priorityRank: Record<TaskPriority, number> = { Low: 0, Medium: 1, High: 2 };
        const highestPriority = projectTasks.reduce<TaskPriority | null>((acc, t) => {
          if (!acc || priorityRank[t.priority] > priorityRank[acc]) return t.priority;
          return acc;
        }, null);

        // Collect task-level files
        const taskFiles: MergedFile[] = [];
        for (const task of projectTasks) {
          for (const att of task.attachments ?? []) {
            taskFiles.push({
              id:         `task-att-${task.id}-${att.id}`,
              name:       att.name,
              base64:     att.dataUrl,
              uploadedBy: task.assignedTo || "Employee",
              uploadedAt: new Date().toISOString(),
              projectId:  project.id,
              source:     "task-attachment",
            });
          }
          for (const att of task.completionRequest?.attachments ?? []) {
            taskFiles.push({
              id:         `task-compl-${task.id}-${att.id}`,
              name:       att.name,
              base64:     att.dataUrl,
              uploadedBy: task.completionRequest?.requestedBy ?? task.assignedTo ?? "Employee",
              uploadedAt: task.completionRequest?.requestedAt ?? new Date().toISOString(),
              projectId:  project.id,
              source:     "task-completion",
            });
          }
        }

        return {
          id:            project.id,
          name:          project.name,
          description:   project.description,
          status,
          priority:      highestPriority === "High" ? "High" : highestPriority ?? "Medium",
          startDate:     projectTasks[0]?.dueDate ?? project.dueDate ?? new Date().toISOString(),
          endDate:       project.dueDate ?? projectTasks[0]?.dueDate ?? new Date().toISOString(),
          progress,
          members,
          tags:          project.tags ?? [],
          tasksTotal,
          tasksCompleted,
          createdAt:     new Date().toISOString(),
          rawFiles:      project.files ?? [],
          taskFiles,
        };
      });
  }, [currentUser, storedProjects, tasks, allUserAccounts]);

  const counts = {
    all:        projects.length,
    notStarted: projects.filter((p) => p.status === "Not Started").length,
    inProgress: projects.filter((p) => p.status === "In Progress").length,
    onHold:     projects.filter((p) => p.status === "On Hold").length,
    completed:  projects.filter((p) => p.status === "Completed").length,
  };

  const filtered = projects.filter((p) => {
    const matchStatus = statusFilter === "All" || p.status === statusFilter;
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const STATUS_TABS: { label: string; value: ProjectStatus | "All"; count: number }[] = [
    { label: "All",         value: "All",         count: counts.all        },
    { label: "Not Started", value: "Not Started", count: counts.notStarted },
    { label: "In Progress", value: "In Progress", count: counts.inProgress },
    { label: "On Hold",     value: "On Hold",     count: counts.onHold     },
    { label: "Completed",   value: "Completed",   count: counts.completed  },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <AnimatePresence>
        {selectedProject && (
          <ProjectDetailModal
            key="project-modal"
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
          />
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-white shadow-lg flex-col border-r border-slate-200">
        <Usersidebar navigate={navigate} logout={handleLogout} />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-black/30 z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 w-64 bg-white h-full shadow-2xl z-50"
            >
              <Usersidebar navigate={navigate} logout={handleLogout} close={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Topbar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white p-3 sm:p-4 md:p-6 rounded-2xl shadow-md border border-slate-100"
        >
          <div className="flex items-center gap-2 sm:gap-4 flex-1">
            <button
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="text-[#1F3C68]" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-[#1F3C68] truncate">My Projects</h1>
              <p className="text-xs sm:text-sm text-[#1E293B] mt-1 font-medium">
                {currentUser ? `Showing projects for ${currentUser.name}` : "View your assigned projects"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#1F3C68]/10 text-[#1F3C68] px-4 py-2 rounded-xl">
            <Layers className="w-4 h-4" />
            <span className="text-sm font-bold">
              {counts.all} Project{counts.all !== 1 ? "s" : ""}
            </span>
          </div>
        </motion.div>

        {/* Search + Filter */}
        <motion.div
          initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-md border border-slate-100 p-4 mb-6"
        >
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects by name, description, or tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/20 focus:border-[#1F3C68]/40 transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === tab.value
                    ? "bg-primary text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {tab.label}
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[9px] font-bold px-1 ${
                    statusFilter === tab.value
                      ? "bg-white/30 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Project Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <EmptyState filtered={search !== "" || statusFilter !== "All"} />
            ) : (
              filtered.map((project, i) => (
                <motion.div
                  key={project.id}
                  initial={{ scale: 0.95, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <ProjectCard project={project} onClick={() => setSelectedProject(project)} />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {projects.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>You are in view-only mode. Contact your manager to request changes.</span>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default ProjectPage;
