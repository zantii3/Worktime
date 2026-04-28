import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { useAdmin } from "./context/AdminProvider";
import type { Project, ProjectFile } from "./context/AdminTypes";
import { notifyError, notifySuccess } from "./utils/toast";

import accounts from "../data/accounts.json";

import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  Eye,
  FileImage,
  FileText,
  Files,
  FolderKanban,
  FolderOpen,
  Layers,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
  UserCircle2,
  UserMinus,
  UserPlus,
  Users,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Account = {
  id: number;
  email: string;
  password: string;
  name: string;
  assignedProjects?: number[];
};

type ExtTask = {
  id: number;
  title: string;
  status: string;
  priority: string;
  assignedTo: string;
  assignedToId?: number;
  projectId?: number;
};

type EditForm = {
  name: string;
  description: string;
  leaderId: number;
  dueDate: string;
};

type FileCategory = "image" | "pdf" | "other";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function getFileCategory(file: ProjectFile): FileCategory {
  const b = file.base64 ?? "";
  if (b.startsWith("data:image/")) return "image";
  if (b.startsWith("data:application/pdf")) return "pdf";
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

function triggerDownload(file: ProjectFile) {
  const a = document.createElement("a");
  a.href = file.base64;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function formatUploadDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

const userAccounts = accounts as Account[];

// ─── File Preview Modal ────────────────────────────────────────────────────────
// Unified modal for all file types. Rendered at the root level so it is never
// trapped inside the files modal's own stacking context or AnimatePresence.

function FilePreviewModal({
  file,
  onClose,
}: {
  file: ProjectFile;
  onClose: () => void;
}) {
  const cat = getFileCategory(file);
  const [imgScale, setImgScale] = useState(1);
  const [imgRotation, setImgRotation] = useState(0);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col bg-black/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-white/10 bg-black/60 backdrop-blur-sm shrink-0">
        {/* File info */}
        <div className="flex items-center gap-3 min-w-0">
          {cat === "image" ? (
            <FileImage className="w-5 h-5 text-white/60 shrink-0" />
          ) : (
            <FileText className="w-5 h-5 text-white/60 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{file.name}</p>
            <p className="text-xs text-white/50">
              Uploaded {formatUploadDate(file.uploadedAt)} · {file.uploadedBy}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Image-specific controls */}
          {cat === "image" && (
            <>
              <button
                onClick={() => setImgScale((s) => Math.max(0.25, s - 0.25))}
                type="button"
                title="Zoom out"
                className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              >
                <ZoomOut className="w-4 h-4 text-white" />
              </button>
              <span className="text-xs text-white/60 tabular-nums w-10 text-center">
                {Math.round(imgScale * 100)}%
              </span>
              <button
                onClick={() => setImgScale((s) => Math.min(4, s + 0.25))}
                type="button"
                title="Zoom in"
                className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              >
                <ZoomIn className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setImgRotation((r) => (r + 90) % 360)}
                type="button"
                title="Rotate"
                className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              >
                <RotateCw className="w-4 h-4 text-white" />
              </button>
              <div className="w-px h-5 bg-white/20 mx-1" />
            </>
          )}

          <button
            onClick={() => triggerDownload(file)}
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

      {/* ── Content area ── */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center p-4"
        onClick={onClose} // click outside content to close
      >
        {cat === "image" && (
          <motion.img
            src={file.base64}
            alt={file.name}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              transform: `scale(${imgScale}) rotate(${imgRotation}deg)`,
              transition: "transform 0.2s ease",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              borderRadius: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {cat === "pdf" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full rounded-xl overflow-hidden border border-white/10"
            style={{ minHeight: "70vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={file.base64}
              title={file.name}
              className="w-full h-full"
              style={{ minHeight: "70vh", border: "none" }}
            />
          </motion.div>
        )}

        {cat === "other" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-5 text-center p-8 rounded-2xl border border-white/10 bg-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center">
              <FileText className="w-8 h-8 text-white/50" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">{file.name}</p>
              <p className="text-white/50 text-sm mt-1">
                This file type can't be previewed directly in the browser.
              </p>
            </div>
            <button
              onClick={() => triggerDownload(file)}
              type="button"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition"
            >
              <Download className="w-4 h-4" />
              Download to view
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FileCategoryIcon({
  cat,
  className,
}: {
  cat: FileCategory;
  className?: string;
}) {
  if (cat === "image") return <FileImage className={className} />;
  return <FileText className={className} />;
}

function MemberAvatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sz = size === "md" ? "h-9 w-9 text-xs" : "h-7 w-7 text-[10px]";
  return (
    <div
      className={cx(
        sz,
        "rounded-full bg-primary/10 border-2 border-white flex items-center justify-center font-bold text-primary shrink-0"
      )}
      title={name}
    >
      {initials}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-card">
      <div className="bg-primary p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold tracking-wide opacity-90">{title}</div>
            <div className="mt-2 text-4xl font-extrabold leading-none">{value}</div>
          </div>
          <span className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </span>
        </div>
      </div>
      <div className="p-3 bg-card">
        <div className="text-xs text-text-primary/70">{subtitle}</div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  tasks,
  leaderName,
  members,
  onClick,
  onFiles,
  onMembers,
  onEdit,
  onDelete,
}: {
  project: Project;
  tasks: ExtTask[];
  leaderName: string;
  members: Account[];
  onClick: () => void;
  onFiles: () => void;
  onMembers: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const completed = projectTasks.filter((t) => t.status === "Completed").length;
  const inProgress = projectTasks.filter((t) => t.status === "In Progress").length;
  const progress = projectTasks.length
    ? Math.round((completed / projectTasks.length) * 100)
    : 0;
  const fileCount = (project.files ?? []).length;
  const tags = project.tags ?? [];

  const stopProp = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 8px 32px rgba(31,60,104,0.12)" }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer group flex flex-col"
    >
      <div className="h-1.5 bg-gradient-to-r from-primary to-primary/60" />

      <div className="p-5 flex-1 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
            <FolderKanban className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-text-heading leading-snug line-clamp-1">{project.name}</div>
            <div className="text-xs text-text-primary/60 line-clamp-2 mt-0.5 leading-relaxed">
              {project.description || "No description."}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-secondary transition-colors shrink-0 mt-1" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
            <UserCircle2 className="w-3 h-3" />
            {leaderName}
          </span>
          {project.dueDate && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
              <Calendar className="w-3 h-3" />
              {project.dueDate}
            </span>
          )}
          {fileCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-secondary/10 text-secondary border border-secondary/20">
              <Files className="w-3 h-3" />
              {fileCount} {fileCount === 1 ? "file" : "files"}
            </span>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-soft border border-slate-200 text-text-primary/70"
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
            {tags.length > 4 && (
              <span className="text-[9px] text-text-primary/50 font-semibold self-center">
                +{tags.length - 4}
              </span>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-text-primary/60 uppercase tracking-wide">Progress</span>
            <span className="text-[10px] font-extrabold text-primary">{progress}%</span>
          </div>
          <div className="h-1.5 bg-soft rounded-full overflow-hidden border border-slate-200">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
            />
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-text-primary/50">
              {completed}/{projectTasks.length} tasks
            </span>
            {inProgress > 0 && (
              <span className="text-[10px] text-secondary font-semibold">{inProgress} in progress</span>
            )}
          </div>
        </div>

        {members.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {members.slice(0, 4).map((m) => (
                <MemberAvatar key={m.id} name={m.name} />
              ))}
              {members.length > 4 && (
                <div className="h-7 w-7 rounded-full bg-soft border-2 border-white flex items-center justify-center text-[9px] font-bold text-text-primary/70">
                  +{members.length - 4}
                </div>
              )}
            </div>
            <span className="text-[10px] text-text-primary/50">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <div
        className="px-5 pb-4 pt-1 flex items-center gap-2 flex-wrap border-t border-slate-100 bg-slate-50/60"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={stopProp(onFiles)}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-text-heading hover:bg-soft hover:border-primary/30 transition"
        >
          <FileText className="w-3.5 h-3.5 text-primary" />
          Files
        </button>
        <button
          onClick={stopProp(onMembers)}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-text-heading hover:bg-soft hover:border-primary/30 transition"
        >
          <Users className="w-3.5 h-3.5 text-primary" />
          Members
        </button>
        <button
          onClick={stopProp(onEdit)}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-text-heading hover:bg-soft transition"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={stopProp(onDelete)}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-100 bg-white text-rose-600 hover:bg-rose-50 transition ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function ProjectList() {
  const { tasks: rawTasks, projects, setProjects } = useAdmin();
  const tasks = rawTasks as ExtTask[];

  const [now, setNow] = useState<Date>(new Date());
  const [query, setQuery] = useState("");

  const [summaryId, setSummaryId] = useState<number | null>(null);
  const [filesId, setFilesId] = useState<number | null>(null);
  const [membersId, setMembersId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  // ── Unified file preview state ──────────────────────────────────────────
  // Single state drives the new FilePreviewModal. Replaces the old split
  // previewFile (lightbox) + window.open (PDF) approach.
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);

  const [memberSearch, setMemberSearch] = useState("");

  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    description: "",
    leaderId: 0,
    dueDate: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const summaryProject = useMemo(
    () => projects.find((p) => p.id === summaryId) ?? null,
    [projects, summaryId]
  );
  const filesProject = useMemo(
    () => projects.find((p) => p.id === filesId) ?? null,
    [projects, filesId]
  );
  const membersProject = useMemo(
    () => projects.find((p) => p.id === membersId) ?? null,
    [projects, membersId]
  );
  const editingProject = useMemo(
    () => projects.find((p) => p.id === editId) ?? null,
    [projects, editId]
  );

  const getLeaderName = (leaderId: number): string =>
    userAccounts.find((a) => a.id === leaderId)?.name ?? "Unknown";

  const getProjectMembers = (project: Project): Account[] => {
    const ids = new Set<number>([
      ...(project.memberIds ?? []),
      ...tasks
        .filter((t) => t.projectId === project.id && t.assignedToId != null)
        .map((t) => t.assignedToId as number),
    ]);
    return userAccounts.filter((a) => ids.has(a.id));
  };

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const totalFiles = projects.reduce((s, p) => s + (p.files?.length ?? 0), 0);
    const memberIds = new Set<number>();
    projects.forEach((p) => {
      (p.memberIds ?? []).forEach((id) => memberIds.add(id));
      tasks
        .filter((t) => t.projectId === p.id && t.assignedToId != null)
        .forEach((t) => memberIds.add(t.assignedToId!));
    });
    const totalMembers = memberIds.size;
    const totalTasks = tasks.filter((t) => projects.some((p) => p.id === t.projectId)).length;
    return { totalProjects, totalFiles, totalMembers, totalTasks };
  }, [projects, tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      `${p.name} ${p.description}`.toLowerCase().includes(q)
    );
  }, [projects, query]);

  const deleteProject = (projectId: number) => {
    if (!window.confirm("Delete this project and all its tasks?")) return;
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    notifySuccess("Project deleted.");
  };

  const openEdit = (project: Project) => {
    setEditForm({
      name: project.name,
      description: project.description,
      leaderId: project.leaderId,
      dueDate: project.dueDate ?? "",
    });
    setEditId(project.id);
  };

  const saveEdit = () => {
    if (!editId) return;
    if (!editForm.name.trim()) { notifyError("Project name is required."); return; }
    if (!editForm.leaderId) { notifyError("Please select a project leader."); return; }
    setProjects((prev) =>
      prev.map((p) => (p.id === editId ? { ...p, ...editForm } : p))
    );
    notifySuccess("Project updated.");
    setEditId(null);
  };

  const addMember = (userId: number) => {
    if (!membersId) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === membersId
          ? { ...p, memberIds: [...new Set([...(p.memberIds ?? []), userId])] }
          : p
      )
    );
  };

  const removeMember = (userId: number) => {
    if (!membersId) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === membersId
          ? { ...p, memberIds: (p.memberIds ?? []).filter((id) => id !== userId) }
          : p
      )
    );
  };

  const handleFileUpload = (file: File) => {
    if (!filesId) return;
    if (file.size > 1024 * 1024) { notifyError("File exceeds 1 MB limit."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const newFile: ProjectFile = {
        id: Date.now(),
        name: file.name,
        base64: reader.result as string,
        uploadedBy: "Admin",
        uploadedAt: new Date().toISOString(),
        projectId: filesId,
      };
      setProjects((prev) =>
        prev.map((p) =>
          p.id === filesId ? { ...p, files: [...(p.files ?? []), newFile] } : p
        )
      );
      notifySuccess("File uploaded.");
    };
    reader.readAsDataURL(file);
  };

  const deleteFile = (fileId: number) => {
    if (!filesId) return;
    // If the currently previewed file is being deleted, close the preview.
    if (previewFile?.id === fileId) setPreviewFile(null);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === filesId
          ? { ...p, files: p.files.filter((f) => f.id !== fileId) }
          : p
      )
    );
    notifySuccess("File deleted.");
  };

  const membersToAdd = useMemo(() => {
    if (!membersProject) return [];
    const current = new Set<number>([
      ...(membersProject.memberIds ?? []),
      ...tasks
        .filter((t) => t.projectId === membersProject.id && t.assignedToId != null)
        .map((t) => t.assignedToId as number),
    ]);
    const q = memberSearch.trim().toLowerCase();
    return userAccounts.filter(
      (a) =>
        !current.has(a.id) &&
        (!q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
    );
  }, [membersProject, tasks, memberSearch]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* ── File Preview Modal — rendered at root level, above everything ── */}
      <AnimatePresence>
        {previewFile && (
          <FilePreviewModal
            key={previewFile.id}
            file={previewFile}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-text-heading">Project List</div>
          <div className="text-sm text-text-primary/70">
            Manage project files, members, and progress.
          </div>
        </div>
        <div className="bg-primary text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span className="tabular-nums">
            {now.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Projects" value={stats.totalProjects} subtitle="Across all teams" icon={FolderKanban} />
        <StatCard title="Uploaded Files" value={stats.totalFiles} subtitle="Stored in projects" icon={Files} />
        <StatCard title="Active Members" value={stats.totalMembers} subtitle="Across all projects" icon={Users} />
        <StatCard title="Total Tasks" value={stats.totalTasks} subtitle="Linked to projects" icon={CheckCircle2} />
      </div>

      {/* ── Search bar ── */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects by name or description…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30 text-text-heading placeholder:text-text-primary/40"
          />
        </div>
        {query && (
          <button
            onClick={() => setQuery("")}
            type="button"
            className="text-xs font-semibold text-text-primary/60 hover:text-text-heading transition"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-text-primary/50 whitespace-nowrap">
          {filtered.length} project{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Project grid ── */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-16 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-soft border border-slate-200 flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-text-primary/30" />
          </div>
          <div className="text-lg font-bold text-text-heading">No projects found</div>
          <div className="text-sm text-text-primary/60 mt-1 max-w-xs">
            {query ? "Try a different search term." : "Create your first project in Project Management."}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
            >
              <ProjectCard
                project={project}
                tasks={tasks}
                leaderName={getLeaderName(project.leaderId)}
                members={getProjectMembers(project)}
                onClick={() => setSummaryId(project.id)}
                onFiles={() => setFilesId(project.id)}
                onMembers={() => { setMemberSearch(""); setMembersId(project.id); }}
                onEdit={() => openEdit(project)}
                onDelete={() => deleteProject(project.id)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PROJECT SUMMARY MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {summaryId !== null && summaryProject && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSummaryId(null)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 14 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden border border-primary/20 shadow-2xl bg-card flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-primary px-6 py-6 text-white shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                      <FolderKanban className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1">
                        Project Overview
                      </div>
                      <div className="text-2xl font-extrabold leading-tight">{summaryProject.name}</div>
                      {summaryProject.description && (
                        <div className="text-sm text-white/80 mt-1 line-clamp-2">
                          {summaryProject.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSummaryId(null)}
                    className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition shrink-0"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15">
                    <UserCircle2 className="w-3.5 h-3.5" />
                    {getLeaderName(summaryProject.leaderId)}
                  </span>
                  {summaryProject.dueDate && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15">
                      <Calendar className="w-3.5 h-3.5" />
                      Due {summaryProject.dueDate}
                    </span>
                  )}
                  {(summaryProject.tags ?? []).map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10">
                      <Tag className="w-3 h-3" />{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                {(() => {
                  const pt = tasks.filter((t) => t.projectId === summaryProject.id);
                  const done = pt.filter((t) => t.status === "Completed").length;
                  const wip = pt.filter((t) => t.status === "In Progress").length;
                  const pending = pt.filter((t) => t.status === "Pending").length;
                  const pct = pt.length ? Math.round((done / pt.length) * 100) : 0;
                  return (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-text-primary/50 mb-3">Task Progress</div>
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        {[
                          { label: "Total", value: pt.length, color: "text-text-heading", bg: "bg-soft border-slate-200" },
                          { label: "Pending", value: pending, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
                          { label: "In Progress", value: wip, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
                          { label: "Completed", value: done, color: "text-green-700", bg: "bg-green-50 border-green-200" },
                        ].map((s) => (
                          <div key={s.label} className={cx("rounded-xl border p-3 text-center", s.bg)}>
                            <div className={cx("text-2xl font-extrabold tabular-nums", s.color)}>{s.value}</div>
                            <div className="text-[10px] font-bold text-text-primary/60 uppercase tracking-wide mt-1">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs font-semibold text-text-primary/60 mb-1.5">
                        <span>Overall Completion</span>
                        <span className="font-extrabold text-primary">{pct}%</span>
                      </div>
                      <div className="h-2.5 bg-soft rounded-full overflow-hidden border border-slate-200">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                        />
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const members = getProjectMembers(summaryProject);
                  return members.length > 0 ? (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-text-primary/50 mb-3">
                        Members ({members.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {members.map((m) => (
                          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                            <MemberAvatar name={m.name} size="md" />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-text-heading truncate">{m.name}</div>
                              <div className="text-xs text-text-primary/60 truncate">{m.email}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                {(summaryProject.files ?? []).length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-text-primary/50 mb-3">
                      Files ({summaryProject.files.length})
                    </div>
                    <div className="space-y-1.5">
                      {summaryProject.files.slice(0, 4).map((f) => {
                        const cat = getFileCategory(f);
                        return (
                          <div key={f.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <FileCategoryIcon cat={cat} className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-sm text-text-heading truncate flex-1">{f.name}</span>
                            <span className="text-xs text-text-primary/50 shrink-0">{formatUploadDate(f.uploadedAt)}</span>
                          </div>
                        );
                      })}
                      {summaryProject.files.length > 4 && (
                        <div className="text-xs text-text-primary/50 px-3">
                          +{summaryProject.files.length - 4} more files
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 pb-5 shrink-0 flex gap-2">
                <button
                  onClick={() => { setSummaryId(null); setFilesId(summaryProject.id); }}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition"
                >
                  <FileText className="w-4 h-4" />View Files
                </button>
                <button
                  onClick={() => { setSummaryId(null); setMemberSearch(""); setMembersId(summaryProject.id); }}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition"
                >
                  <Users className="w-4 h-4" />Manage Members
                </button>
                <button
                  onClick={() => setSummaryId(null)}
                  type="button"
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 transition"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          FILES MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {filesId !== null && filesProject && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFilesId(null)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 14 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-card flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-primary px-6 py-5 text-white shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                      <Files className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-extrabold leading-tight">Project Files</div>
                      <div className="text-sm text-white/70 truncate">{filesProject.name}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setFilesId(null)}
                    className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Upload zone */}
              <div className="px-6 pt-5 shrink-0">
                <label className="flex items-center justify-center gap-2.5 border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition group">
                  <Upload className="w-5 h-5 text-text-primary/40 group-hover:text-primary transition" />
                  <span className="text-sm font-semibold text-text-primary/60 group-hover:text-primary transition">
                    Click to upload a file
                  </span>
                  <span className="text-xs text-text-primary/40">(max 1 MB)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {/* File list */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
                {(filesProject.files ?? []).length === 0 ? (
                  <div className="py-12 flex flex-col items-center text-center text-text-primary/50">
                    <FileText className="w-10 h-10 mb-3 opacity-30" />
                    <div className="text-sm font-semibold">No files yet</div>
                    <div className="text-xs mt-1">Upload a file using the zone above.</div>
                  </div>
                ) : (
                  (filesProject.files ?? []).map((file) => {
                    const cat = getFileCategory(file);
                    return (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 group/file"
                      >
                        {/* Thumbnail or icon */}
                        <div className="h-10 w-10 rounded-lg overflow-hidden border border-slate-100 bg-soft flex items-center justify-center shrink-0">
                          {cat === "image" ? (
                            <img
                              src={file.base64}
                              alt={file.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FileCategoryIcon cat={cat} className="w-5 h-5 text-text-primary/40" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-text-heading truncate">{file.name}</div>
                          <div className="text-xs text-text-primary/50 mt-0.5">
                            {formatUploadDate(file.uploadedAt)} · {file.uploadedBy}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* ── View button — now always opens FilePreviewModal ── */}
                          <button
                            onClick={() => setPreviewFile(file)}
                            type="button"
                            title={
                              cat === "image"
                                ? "Preview image"
                                : cat === "pdf"
                                ? "Preview PDF"
                                : "View file info"
                            }
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-text-primary/60 hover:text-primary hover:border-primary/30 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Download */}
                          <button
                            onClick={() => triggerDownload(file)}
                            type="button"
                            title="Download"
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-text-primary/60 hover:text-primary hover:border-primary/30 transition"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => deleteFile(file.id)}
                            type="button"
                            title="Delete"
                            className="h-8 w-8 rounded-lg border border-rose-100 bg-white flex items-center justify-center text-rose-400 hover:text-rose-600 hover:border-rose-300 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 shrink-0">
                <button
                  onClick={() => setFilesId(null)}
                  type="button"
                  className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          MEMBERS MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {membersId !== null && membersProject && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMembersId(null)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 14 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg max-h-[90vh] rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-card flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-primary px-6 py-5 text-white shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-extrabold">Project Members</div>
                      <div className="text-sm text-white/70 truncate">{membersProject.name}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setMembersId(null)}
                    className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {(() => {
                  const explicit = new Set(membersProject.memberIds ?? []);
                  const taskIds = new Set(
                    tasks
                      .filter((t) => t.projectId === membersProject.id && t.assignedToId != null)
                      .map((t) => t.assignedToId as number)
                  );
                  const allIds = new Set([...explicit, ...taskIds]);
                  const members = userAccounts.filter((a) => allIds.has(a.id));
                  return members.length > 0 ? (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-text-primary/50 mb-2">
                        Current Members ({members.length})
                      </div>
                      <div className="space-y-2">
                        {members.map((m) => {
                          const isExplicit = explicit.has(m.id);
                          const isTaskOnly = taskIds.has(m.id) && !explicit.has(m.id);
                          return (
                            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                              <MemberAvatar name={m.name} size="md" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-text-heading truncate">{m.name}</div>
                                <div className="text-xs text-text-primary/60 truncate">{m.email}</div>
                              </div>
                              {isTaskOnly && (
                                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/20 shrink-0">
                                  via task
                                </span>
                              )}
                              {isExplicit && (
                                <button
                                  onClick={() => removeMember(m.id)}
                                  type="button"
                                  title="Remove member"
                                  className="h-8 w-8 rounded-lg border border-rose-100 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:border-rose-300 bg-white transition shrink-0"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-sm text-text-primary/50">
                      No members yet. Add some below.
                    </div>
                  );
                })()}

                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-text-primary/50 mb-2">Add Members</div>
                  <div className="relative mb-3">
                    <Search className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search users by name or email…"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30 text-text-heading"
                    />
                  </div>
                  {membersToAdd.length === 0 ? (
                    <div className="py-4 text-center text-sm text-text-primary/50">
                      {memberSearch ? "No users match your search." : "All users are already members."}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                      {membersToAdd.map((user) => (
                        <div key={user.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-soft px-4 py-3">
                          <MemberAvatar name={user.name} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-text-heading truncate">{user.name}</div>
                            <div className="text-xs text-text-primary/60 truncate">{user.email}</div>
                          </div>
                          <button
                            onClick={() => addMember(user.id)}
                            type="button"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition shrink-0"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 pb-5 shrink-0">
                <button
                  onClick={() => setMembersId(null)}
                  type="button"
                  className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:opacity-95 transition"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          EDIT MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {editId !== null && editingProject && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditId(null)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 14 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-primary px-6 py-5 text-white">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-white/15 flex items-center justify-center">
                      <Pencil className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-lg font-extrabold">Edit Project</div>
                      <div className="text-sm text-white/70 truncate max-w-[280px]">
                        {editingProject.name}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditId(null)}
                    className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-text-primary/60 uppercase tracking-wide">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Project name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-text-primary/60 uppercase tracking-wide">
                    Description
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Project description"
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-text-primary/60 uppercase tracking-wide">
                      Leader
                    </label>
                    <select
                      value={editForm.leaderId}
                      onChange={(e) => setEditForm((p) => ({ ...p, leaderId: Number(e.target.value) }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value={0} disabled>Select leader…</option>
                      {userAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-text-primary/60 uppercase tracking-wide">
                      Due Date <span className="font-normal normal-case text-text-primary/40">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm((p) => ({ ...p, dueDate: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setEditId(null)}
                    type="button"
                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    type="button"
                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}