import { useLocation, useNavigate } from "react-router-dom";
import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  Clock,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  Layers,
  Zap,
  Circle,
  Tag,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  X,
  CalendarDays,
  ChevronDown,
  Plus,
  Settings2,
} from "lucide-react";
import { useClock } from "./hooks/useClock";
import Usersidebar from "./components/Usersidebar";

type TaskStatus = "Pending" | "In Progress" | "Completed";
type TaskPriority = "Low" | "Medium" | "High";

interface Task {
  id: number;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  createdAt: string;
  assignedTo: string;
  assignedToId?: number;
  assignedBy?: string;
  assignedById?: number;
  projectId?: number;
  tags?: string[];
}

interface Project {
  id: number;
  name: string;
  description: string;
  leaderId: number;
  leaderName?: string;
  dueDate?: string;
  tags?: string[];
}

interface Account {
  id: number;
  email: string;
  name: string;
  assignedProjects?: number[];
}

const TASKS_KEY = "worktime_tasks_v1";
const PROJECTS_KEY = "worktime_projects_v1";
const TASKS_PER_PAGE = 5;

const priorityConfig: Record<TaskPriority, { color: string; dot: string; bg: string }> = {
  High:   { color: "text-[#E97638]", dot: "bg-[#E97638]", bg: "bg-[#FFF4EE]" },
  Medium: { color: "text-[#1F3C68]", dot: "bg-[#1F3C68]", bg: "bg-[#EDF2FA]" },
  Low:    { color: "text-slate-500",  dot: "bg-slate-400",  bg: "bg-slate-100"  },
};

const statusConfig: Record<TaskStatus, { label: string; bar: string; ring: string }> = {
  Pending:       { label: "Pending",     bar: "bg-slate-300",  ring: "ring-slate-300"  },
  "In Progress": { label: "In Progress", bar: "bg-[#F28C28]",  ring: "ring-[#F28C28]" },
  Completed:     { label: "Completed",   bar: "bg-[#1F3C68]",  ring: "ring-[#1F3C68]" },
};

const STATUS_OPTIONS: TaskStatus[] = ["Pending", "In Progress", "Completed"];

const TAG_PALETTES = [
  { bg: "bg-violet-100",  text: "text-violet-700",  border: "border-violet-200"  },
  { bg: "bg-cyan-100",    text: "text-cyan-700",    border: "border-cyan-200"    },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-pink-100",    text: "text-pink-700",    border: "border-pink-200"    },
  { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200"   },
  { bg: "bg-sky-100",     text: "text-sky-700",     border: "border-sky-200"     },
  { bg: "bg-rose-100",    text: "text-rose-700",    border: "border-rose-200"    },
  { bg: "bg-teal-100",    text: "text-teal-700",    border: "border-teal-200"    },
];

function getTagPalette(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTES[hash % TAG_PALETTES.length];
}

function TagBadge({ tag }: { tag: string }) {
  const p = getTagPalette(tag);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border ${p.bg} ${p.text} ${p.border} whitespace-nowrap`}>
      <Tag className="w-2.5 h-2.5 flex-shrink-0" />
      {tag}
    </span>
  );
}

// ─── Status Popover ────────────────────────────────────────────────────────────
function StatusPopover({
  task,
  onUpdate,
}: {
  task: Task;
  onUpdate: (id: number, status: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const sCfg = statusConfig[task.status];

  const dotColor: Record<TaskStatus, string> = {
    Pending: "bg-slate-300",
    "In Progress": "bg-[#F28C28]",
    Completed: "bg-[#1F3C68]",
  };

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors border border-slate-200"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor[task.status]}`} />
        {sCfg.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-[140px]"
          >
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { onUpdate(task.id, s); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-left transition-colors hover:bg-slate-50 ${
                  task.status === s ? "bg-[#EDF2FA] text-[#1F3C68]" : "text-slate-600"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${dotColor[s]}`} />
                {s}
                {task.status === s && <CheckCircle2 className="w-3 h-3 ml-auto text-[#1F3C68]" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Project Detail Modal ──────────────────────────────────────────────────────
function ProjectModal({
  project,
  tasks,
  leaderName,
  onClose,
}: {
  project: Project;
  tasks: Task[];
  leaderName?: string;
  onClose: () => void;
}) {
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const total = projectTasks.length;
  const completed = projectTasks.filter((t) => t.status === "Completed").length;
  const inProgress = projectTasks.filter((t) => t.status === "In Progress").length;
  const pending = projectTasks.filter((t) => t.status === "Pending").length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  // Unique assignees
  const members = Array.from(new Set(projectTasks.map((t) => t.assignedTo).filter(Boolean)));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#1F3C68]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-primary px-6 py-5 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5" />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Project</p>
                <h2 className="text-xl font-black text-white leading-tight">{project.name}</h2>
                {project.description && (
                  <p className="text-sm text-white/70 mt-1">{project.description}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Progress */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Progress</p>
                <span className="text-sm font-black text-[#1F3C68]">{progress}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-[#F28C28] to-[#E97638]"
                />
              </div>
            </div>

            {/* Task Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total", value: total, color: "text-[#1F3C68]", bg: "bg-[#EDF2FA]" },
                { label: "In Progress", value: inProgress, color: "text-[#F28C28]", bg: "bg-[#FFF4EE]" },
                { label: "Completed", value: completed, color: "text-emerald-600", bg: "bg-emerald-50" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                  <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Details */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-400 font-medium">
                  <Users className="w-3.5 h-3.5" /> Team leader
                </span>
                <span className="font-bold text-[#1F3C68]">{leaderName ?? project.leaderName ?? "Unassigned"}</span>
              </div>
              {project.dueDate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-400 font-medium">
                    <CalendarDays className="w-3.5 h-3.5" /> Due date
                  </span>
                  <span className="font-bold text-[#1F3C68]">{project.dueDate}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-400 font-medium">
                  <Circle className="w-3.5 h-3.5" /> Pending
                </span>
                <span className="font-bold text-slate-600">{pending}</span>
              </div>
            </div>

            {/* Tags */}
            {(project.tags ?? []).length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {(project.tags ?? []).map((tag) => <TagBadge key={tag} tag={tag} />)}
                </div>
              </div>
            )}

            {/* Members */}
            {members.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Team members ({members.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {members.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EDF2FA] text-[#1F3C68] border border-[#1F3C68]/10"
                    >
                      <User className="w-2.5 h-2.5" />
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ProjectManagementCard({
  project,
  leaderName,
  tasks,
  members,
  onOpenProject,
  onAssignTask,
}: {
  project: Project;
  leaderName?: string;
  tasks: Task[];
  members: Account[];
  onOpenProject: () => void;
  onAssignTask: () => void;
}) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === "Completed").length;
  const inProgress = tasks.filter((task) => task.status === "In Progress").length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                <Layers className="w-3 h-3" />
                Project
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#EDF2FA] text-[#1F3C68] border border-[#1F3C68]/10">
                <Users className="w-3 h-3" />
                Leader: {leaderName ?? "Unknown"}
              </span>
            </div>
            <h3 className="text-xl font-black text-[#1F3C68] leading-tight">{project.name}</h3>
            <p className="text-sm text-slate-500 mt-1">{project.description || "No project description."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onOpenProject}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              View Details
            </button>
            <button
              onClick={onAssignTask}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:opacity-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Assign Task
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Project progress</p>
            <span className="text-sm font-black text-[#1F3C68]">{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-[#F28C28] to-[#E97638]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Tasks", value: total, tone: "text-[#1F3C68] bg-[#EDF2FA]" },
            { label: "Completed", value: completed, tone: "text-emerald-600 bg-emerald-50" },
            { label: "In Progress", value: inProgress, tone: "text-[#F28C28] bg-[#FFF4EE]" },
            { label: "Members", value: members.length, tone: "text-sky-700 bg-sky-50" },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl p-3 ${item.tone}`}>
              <p className="text-2xl font-black tabular-nums">{item.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Team Members</p>
            {members.length === 0 ? (
              <p className="text-sm text-slate-400">No members assigned to this project yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {members.map((member) => (
                  <span
                    key={member.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EDF2FA] text-[#1F3C68] border border-[#1F3C68]/10"
                  >
                    <User className="w-3 h-3" />
                    {member.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Recent Tasks</p>
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-400">No tasks created for this project yet.</p>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1F3C68] truncate">{task.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{task.assignedTo}</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">{task.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AssignTaskModal({
  projects,
  membersByProject,
  onClose,
  onSave,
}: {
  projects: Project[];
  membersByProject: Map<number, Account[]>;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    description: string;
    priority: TaskPriority;
    dueDate: string;
    assignedTo: string;
    assignedToId: number;
    projectId: number;
    tags: string[];
  }) => void;
}) {
  const [projectId, setProjectId] = useState<number>(projects[0]?.id ?? 0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [dueDate, setDueDate] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const availableMembers = projectId ? membersByProject.get(projectId) ?? [] : [];
  const [assigneeId, setAssigneeId] = useState<number>(availableMembers[0]?.id ?? 0);

  useEffect(() => {
    setAssigneeId(availableMembers[0]?.id ?? 0);
  }, [projectId, availableMembers]);

  const addTag = () => {
    const clean = tagInput.trim();
    if (!clean) return;
    if (!tags.includes(clean)) setTags((prev) => [...prev, clean]);
    setTagInput("");
  };

  const submit = () => {
    const selectedMember = availableMembers.find((member) => member.id === assigneeId);
    if (!projectId || !selectedMember || !title.trim() || !dueDate) return;

    onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate,
      assignedTo: selectedMember.name,
      assignedToId: selectedMember.id,
      projectId,
      tags,
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[#1F3C68]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 16 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden"
        >
          <div className="bg-primary px-6 py-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Leader Action</p>
              <h2 className="text-xl font-black text-white leading-tight">Assign Team Task</h2>
              <p className="text-sm text-white/70 mt-1">Create a task for a member in one of your projects.</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Project</span>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/20"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Assign To</span>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/20"
                >
                  {availableMembers.length === 0 ? (
                    <option value={0}>No members available</option>
                  ) : (
                    availableMembers.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))
                  )}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Task Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/20"
                placeholder="Prepare sprint report"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/20 resize-none"
                placeholder="Add a short task summary"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Priority</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/20"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Due Date</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/20"
                />
              </label>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tags</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/20"
                  placeholder="Add tag"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors"
                >
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((item) => item !== tag))}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#EDF2FA] text-[#1F3C68] border border-[#1F3C68]/10"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/60">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!projectId || !assigneeId || !title.trim() || !dueDate}
              className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Assign Task
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function StatCard({ label, value, icon: Icon, accent, delay }: {
  label: string; value: number; icon: React.ElementType; accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 shadow-sm group hover:shadow-md transition-shadow duration-300"
    >
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${accent}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">{label}</p>
          <p className="text-4xl font-black text-[#1F3C68] tabular-nums leading-none">{value}</p>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50">
          <Icon className="w-5 h-5 text-slate-400 group-hover:text-[#1F3C68] transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}

function Pagination({
  currentPage, totalPages, onPageChange, totalItems, itemsPerPage,
}: {
  currentPage: number; totalPages: number; onPageChange: (page: number) => void;
  totalItems: number; itemsPerPage: number;
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
      <p className="text-xs text-slate-400 font-medium">
        {totalItems === 0 ? "No tasks to show" : (
          <>Showing <span className="font-bold text-[#1F3C68]">{startItem}–{endItem}</span> of <span className="font-bold text-[#1F3C68]">{totalItems}</span> tasks</>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        <motion.button
          whileHover={currentPage > 1 ? { scale: 1.05 } : {}}
          whileTap={currentPage > 1 ? { scale: 0.95 } : {}}
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            currentPage === 1
              ? "text-slate-300 cursor-not-allowed bg-white border-slate-100"
              : "text-[#1F3C68] bg-white border-slate-200 hover:border-[#1F3C68]/40 hover:bg-[#EDF2FA] shadow-sm"
          }`}
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </motion.button>
        <div className="flex items-center gap-1">
          {totalPages === 0 ? (
            <span className="w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold bg-[#1F3C68] text-white shadow-md">1</span>
          ) : (
            getPageNumbers().map((page, idx) =>
              page === "..." ? (
                <span key={`ellipsis-${idx}`} className="w-8 text-center text-xs text-slate-400 font-bold select-none">···</span>
              ) : (
                <motion.button key={page} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => onPageChange(page as number)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                    currentPage === page
                      ? "bg-[#1F3C68] text-white shadow-md shadow-[#1F3C68]/25"
                      : "bg-white text-slate-500 border border-slate-200 hover:border-[#1F3C68]/30 hover:text-[#1F3C68] hover:bg-[#EDF2FA]"
                  }`}>{page}</motion.button>
              )
            )
          )}
        </div>
        <motion.button
          whileHover={currentPage < totalPages ? { scale: 1.05 } : {}}
          whileTap={currentPage < totalPages ? { scale: 0.95 } : {}}
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            currentPage >= totalPages
              ? "text-slate-300 cursor-not-allowed bg-white border-slate-100"
              : "text-[#1F3C68] bg-white border-slate-200 hover:border-[#1F3C68]/40 hover:bg-[#EDF2FA] shadow-sm"
          }`}
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
function TaskPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = location.state?.user || JSON.parse(localStorage.getItem("currentUser") || "null");

  const currentTime = useClock();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStatus, setActiveStatus] = useState<"All" | TaskStatus>("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | TaskPriority>("All");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"my" | "team" | "manage">("my");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningProjectId, setAssigningProjectId] = useState<number | null>(null);

  // ── Project modal state ──────────────────────────────────────────────────
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const loadData = () => {
      try {
        const rawProjects = localStorage.getItem(PROJECTS_KEY);
        const rawTasks = localStorage.getItem(TASKS_KEY);
        const projectItems: Project[] = rawProjects ? JSON.parse(rawProjects) : [];
        const taskItems: Task[] = rawTasks ? JSON.parse(rawTasks) : [];
        setProjects(Array.isArray(projectItems) ? projectItems : []);
        setTasks(Array.isArray(taskItems) ? taskItems : []);
      } catch {
        setProjects([]);
        setTasks([]);
      }
    };

    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch("/accounts.json")
      .then((response) => response.json())
      .then((data: Account[]) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setAccounts([]));
  }, []);

  const userProjects = useMemo(() => {
    if (!user?.id) return [];
    return projects.filter((p) => String(p.leaderId) === String(user.id));
  }, [projects, user]);

  const userProjectIds = useMemo(() => new Set(userProjects.map((p) => p.id)), [userProjects]);
  const accountById = useMemo(() => {
    const map = new Map<number, Account>();
    accounts.forEach((account) => map.set(account.id, account));
    return map;
  }, [accounts]);

  const myTasks = useMemo(() => tasks.filter((t) => {
    const matchId = t.assignedToId !== undefined && String(t.assignedToId) === String(user?.id);
    const matchName = !!user?.name && t.assignedTo?.trim().toLowerCase() === user.name.trim().toLowerCase();
    return matchId || matchName;
  }), [tasks, user]);
  const teamTasks = useMemo(() => tasks.filter((t) => t.projectId && userProjectIds.has(t.projectId)), [tasks, userProjectIds]);
  const displayedTasks = viewMode === "team" && userProjects.length > 0 ? teamTasks : myTasks;

  const membersByProject = useMemo(() => {
    const map = new Map<number, Account[]>();

    userProjects.forEach((project) => {
      const assignedAccounts = accounts.filter((account) =>
        account.id !== user?.id && (account.assignedProjects ?? []).includes(project.id)
      );

      const inferredAccounts = tasks
        .filter((task) => task.projectId === project.id && task.assignedTo)
        .map((task) => ({
          id: task.assignedToId ?? -task.id,
          email: "",
          name: task.assignedTo,
          assignedProjects: [project.id],
        }))
        .filter((account) => account.name.trim().toLowerCase() !== user?.name?.trim().toLowerCase());

      const merged = new Map<string, Account>();
      [...assignedAccounts, ...inferredAccounts].forEach((account) => {
        const key = String(account.id);
        if (!merged.has(key)) merged.set(key, account);
      });

      map.set(project.id, Array.from(merged.values()));
    });

    return map;
  }, [accounts, tasks, userProjects, user]);

  const leaderCanAssign = useMemo(
    () => userProjects.some((project) => (membersByProject.get(project.id) ?? []).length > 0),
    [userProjects, membersByProject]
  );
  const managedProjects = useMemo(() => userProjects.map((project) => ({
    project,
    tasks: tasks.filter((task) => task.projectId === project.id),
    members: membersByProject.get(project.id) ?? [],
    leaderName: accountById.get(project.leaderId)?.name ?? project.leaderName ?? user?.name ?? "Unknown",
  })), [userProjects, tasks, membersByProject, accountById, user]);
  const manageStats = useMemo(() => {
    const totalProjects = managedProjects.length;
    const totalTasks = managedProjects.reduce((sum, item) => sum + item.tasks.length, 0);
    const completedTasks = managedProjects.reduce(
      (sum, item) => sum + item.tasks.filter((task) => task.status === "Completed").length,
      0
    );
    const inProgressTasks = managedProjects.reduce(
      (sum, item) => sum + item.tasks.filter((task) => task.status === "In Progress").length,
      0
    );
    const pendingTasks = managedProjects.reduce(
      (sum, item) => sum + item.tasks.filter((task) => task.status === "Pending").length,
      0
    );
    const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { totalProjects, totalTasks, completedTasks, inProgressTasks, pendingTasks, overallProgress };
  }, [managedProjects]);

  const saveTasks = (updated: Task[]) => {
    setTasks(updated);
    localStorage.setItem(TASKS_KEY, JSON.stringify(updated));
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    displayedTasks.forEach((t) => t.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [displayedTasks]);

  const filteredTasks = useMemo(() => {
    const filtered = displayedTasks.filter((t) => {
      const matchStatus = activeStatus === "All" || t.status === activeStatus;
      const matchPriority = priorityFilter === "All" || t.priority === priorityFilter;
      const matchTag = !activeTag || (t.tags ?? []).includes(activeTag);
      return matchStatus && matchPriority && matchTag;
    });
    const statusOrder: Record<TaskStatus, number> = { Pending: 0, "In Progress": 1, Completed: 2 };
    return filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [displayedTasks, activeStatus, priorityFilter, activeTag]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / TASKS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTasks = filteredTasks.slice((safePage - 1) * TASKS_PER_PAGE, safePage * TASKS_PER_PAGE);

  const handleFilterChange = (fn: () => void) => { fn(); setCurrentPage(1); };

  const total = displayedTasks.length;
  const completed = displayedTasks.filter((t) => t.status === "Completed").length;
  const inProgress = displayedTasks.filter((t) => t.status === "In Progress").length;
  const pending = displayedTasks.filter((t) => t.status === "Pending").length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  const projectById = useMemo(() => {
    const m = new Map<number, Project>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  // ── Status update (any direction) ─────────────────────────────────────────
  const updateStatus = (id: number, status: TaskStatus) => {
    saveTasks(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const assignTaskToMember = ({
    title,
    description,
    priority,
    dueDate,
    assignedTo,
    assignedToId,
    projectId,
    tags,
  }: {
    title: string;
    description: string;
    priority: TaskPriority;
    dueDate: string;
    assignedTo: string;
    assignedToId: number;
    projectId: number;
    tags: string[];
  }) => {
    const newTask: Task = {
      id: Date.now(),
      title,
      description,
      priority,
      status: "Pending",
      dueDate,
      createdAt: new Date().toISOString(),
      assignedTo,
      assignedToId,
      assignedBy: user?.name,
      assignedById: user?.id,
      projectId,
      tags,
    };

    saveTasks([newTask, ...tasks]);
    setShowAssignModal(false);
    setAssigningProjectId(null);
    setViewMode("team");
    setCurrentPage(1);
  };

  const handleLogout = () => { localStorage.removeItem("currentUser"); navigate("/"); };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
      <aside className="hidden md:flex w-64 bg-white shadow-md flex-col border-r border-slate-100">
        <Usersidebar navigate={navigate} logout={handleLogout} />
      </aside>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-[#1F3C68]/40 backdrop-blur-sm z-40 md:hidden" />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed left-0 top-0 w-64 bg-white h-full shadow-2xl z-50">
              <Usersidebar navigate={navigate} logout={handleLogout} close={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Project detail modal */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          tasks={tasks}
          leaderName={accountById.get(selectedProject.leaderId)?.name ?? selectedProject.leaderName}
          onClose={() => setSelectedProject(null)}
        />
      )}

      {showAssignModal && (
        <AssignTaskModal
          projects={assigningProjectId ? userProjects.filter((project) => project.id === assigningProjectId) : userProjects}
          membersByProject={membersByProject}
          onClose={() => {
            setShowAssignModal(false);
            setAssigningProjectId(null);
          }}
          onSave={assignTaskToMember}
        />
      )}

      <main className="flex-1 p-4 md:p-8 overflow-auto">

        {/* Header */}
        <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="flex justify-between items-center mb-8 bg-white px-6 py-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors" onClick={() => setMenuOpen(true)}>
              <Menu className="text-[#1F3C68]" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-[#1F3C68] truncate">
                {viewMode === "manage" && userProjects.length > 0
                  ? "Manage Projects"
                  : viewMode === "team" && userProjects.length > 0
                    ? "Team Tasks"
                    : "My Tasks"}
              </h1>
              <p className="text-xs sm:text-sm text-[#1E293B] mt-1 font-medium truncate">
                {currentTime.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userProjects.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                <button onClick={() => setViewMode("my")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "my" ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <User className="w-3.5 h-3.5 inline mr-1" /> My Tasks
                </button>
                <button onClick={() => setViewMode("team")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "team" ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <Users className="w-3.5 h-3.5 inline mr-1" /> Team
                </button>
                <button onClick={() => setViewMode("manage")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "manage" ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <Settings2 className="w-3.5 h-3.5 inline mr-1" /> Manage
                </button>
              </div>
            )}
            {viewMode !== "my" && leaderCanAssign && (
              <button
                onClick={() => {
                  setAssigningProjectId(null);
                  setShowAssignModal(true);
                }}
                className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl shadow-sm text-xs font-bold hover:opacity-95 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" />
                Assign Task
              </button>
            )}
            <div className="hidden md:flex lg:hidden items-center gap-2 bg-primary text-white px-3 py-2 rounded-lg shadow-lg md:w-[92px]">
              <Clock className="w-4 h-4" />
              <p className="font-bold text-xs tabular-nums">
                {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-3 bg-primary text-white px-6 py-3 rounded-xl shadow-lg">
              <Clock className="w-5 h-5" />
              <p className="font-bold text-lg tabular-nums">
                {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </div>
        </motion.div>

        {viewMode !== "manage" ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total"       value={total}      icon={Layers}       accent="bg-primary"   delay={0.05} />
              <StatCard label="Completed"   value={completed}  icon={CheckCircle2} accent="bg-secondary" delay={0.1}  />
              <StatCard label="In Progress" value={inProgress} icon={Zap}          accent="bg-primary"   delay={0.15} />
              <StatCard label="Pending"     value={pending}    icon={Circle}       accent="bg-secondary" delay={0.2}  />
            </div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
              className="bg-primary text-white rounded-2xl px-6 py-5 mb-6 shadow-md relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5" />
              <div className="absolute -bottom-6 right-24 w-24 h-24 rounded-full bg-[#F28C28]/20" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-soft rounded-lg">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Overall Progress</p>
                    <p className="text-3xl font-black tabular-nums leading-tight">
                      {progress}<span className="text-lg font-semibold text-white/60 ml-0.5">%</span>
                    </p>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="w-full bg-white/50 h-2.5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-[#F28C28] to-[#E97638]" />
                  </div>
                  <p className="text-xs text-white/70 mt-1.5">{completed} of {total} tasks complete</p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

          {/* Panel header + filters */}
          <div className="flex flex-wrap justify-between items-center gap-4 px-6 py-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#E0F2FE] rounded-xl">
                <ListTodo className="w-6 h-6 text-[#1F3C68]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#1F3C68] leading-tight">Task List</h2>
                <p className="text-xs text-slate-400">
                  {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""} shown
                  {totalPages > 1 && <span className="ml-1 text-slate-300">· page {safePage} of {totalPages}</span>}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {(["All", "Pending", "In Progress", "Completed"] as const).map((s) => (
                <button key={s}
                  onClick={() => handleFilterChange(() => setActiveStatus(s))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                    activeStatus === s ? "bg-primary text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}>
                  {s}
                </button>
              ))}
              <select value={priorityFilter}
                onChange={(e) => handleFilterChange(() => setPriorityFilter(e.target.value as "All" | TaskPriority))}
                className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/30">
                <option value="All">All Priority</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          {/* Tag Filter Strip */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-slate-50 bg-slate-50/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3" /> Tags
              </span>
              <button onClick={() => handleFilterChange(() => setActiveTag(null))}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                  activeTag === null ? "bg-[#1F3C68] text-white border-[#1F3C68]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}>All</button>
              {allTags.map((tag) => {
                const p = getTagPalette(tag);
                const isActive = activeTag === tag;
                return (
                  <button key={tag}
                    onClick={() => handleFilterChange(() => setActiveTag(isActive ? null : tag))}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                      isActive ? `${p.bg} ${p.text} ${p.border} ring-2 ring-offset-1 ${p.border}` : `bg-white ${p.text} ${p.border} hover:${p.bg}`
                    }`}>
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                    <span className={`ml-0.5 font-black tabular-nums ${isActive ? p.text : "text-slate-400"}`}>
                      {displayedTasks.filter((t) => (t.tags ?? []).includes(tag)).length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Task rows */}
          <div className="divide-y divide-slate-50 px-4 py-2 min-h-[200px]">
            <AnimatePresence mode="popLayout">
              {paginatedTasks.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-slate-300">
                  <ListTodo className="w-10 h-10 mb-3" />
                  <p className="text-sm font-semibold">No tasks found</p>
                  <p className="text-xs mt-1">Try adjusting your filters</p>
                </motion.div>
              ) : (
                paginatedTasks.map((task, index) => {
                  const pCfg = priorityConfig[task.priority];
                  const sCfg = statusConfig[task.status];
                  const hasTags = (task.tags ?? []).length > 0;
                  const project = task.projectId ? projectById.get(task.projectId) : null;
                  const isTeamView = viewMode === "team" && userProjects.length > 0;

                  return (
                    <motion.div key={task.id} layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.04 }}
                      className={`group flex items-start justify-between gap-4 py-4 px-2 rounded-xl my-1 transition-all duration-200 hover:bg-slate-50 ${
                        task.status === "Completed" ? "opacity-60" : ""
                      }`}>
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${sCfg.bar}`} />
                        <div className="min-w-0 flex-1">
                          <h3 className={`font-bold text-[#1F3C68] text-sm truncate ${task.status === "Completed" ? "line-through text-slate-400" : ""}`}>
                            {task.title}
                          </h3>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{task.description}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <p className="text-[10px] text-slate-300 font-medium">Due&nbsp;{task.dueDate}</p>
                            {task.assignedBy && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                <User className="w-2.5 h-2.5" /> Assigned by {task.assignedBy}
                              </span>
                            )}

                            {/* ── Clickable project badge → opens modal ── */}
                            {isTeamView && project ? (
                              <button
                                onClick={() => setSelectedProject(project)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 hover:bg-violet-200 transition-colors cursor-pointer"
                              >
                                <Layers className="w-2.5 h-2.5" />
                                {project.name}
                              </button>
                            ) : project ? (
                              <button
                                onClick={() => setSelectedProject(project)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 hover:bg-violet-200 transition-colors cursor-pointer"
                              >
                                <Layers className="w-2.5 h-2.5" />
                                {project.name}
                              </button>
                            ) : null}

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                              <User className="w-2.5 h-2.5" /> {task.assignedTo}
                            </span>
                          </div>
                          {hasTags && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {(task.tags ?? []).map((tag) => <TagBadge key={tag} tag={tag} />)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Right side: priority + status popover ── */}
                      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                        <span className={`hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg ${pCfg.bg} ${pCfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />
                          {task.priority}
                        </span>

                        {/* Status dropdown — replaces the old advance button */}
                        <StatusPopover task={task} onUpdate={updateStatus} />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredTasks.length}
            itemsPerPage={TASKS_PER_PAGE}
          />
            </motion.div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Projects"    value={manageStats.totalProjects}  icon={Layers}       accent="bg-primary"   delay={0.05} />
              <StatCard label="All Tasks"   value={manageStats.totalTasks}     icon={ListTodo}     accent="bg-secondary" delay={0.1} />
              <StatCard label="In Progress" value={manageStats.inProgressTasks} icon={Zap}         accent="bg-primary"   delay={0.15} />
              <StatCard label="Completed"   value={manageStats.completedTasks} icon={CheckCircle2} accent="bg-secondary" delay={0.2} />
            </div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
              className="bg-primary text-white rounded-2xl px-6 py-5 mb-6 shadow-md relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5" />
              <div className="absolute -bottom-6 right-24 w-24 h-24 rounded-full bg-[#F28C28]/20" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-soft rounded-lg">
                    <Settings2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Leadership Progress</p>
                    <p className="text-3xl font-black tabular-nums leading-tight">
                      {manageStats.overallProgress}<span className="text-lg font-semibold text-white/60 ml-0.5">%</span>
                    </p>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="w-full bg-white/50 h-2.5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${manageStats.overallProgress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-[#F28C28] to-[#E97638]" />
                  </div>
                  <p className="text-xs text-white/70 mt-1.5">
                    {manageStats.completedTasks} of {manageStats.totalTasks} team tasks complete, {manageStats.pendingTasks} pending
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex flex-wrap justify-between items-center gap-4 px-6 py-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#E0F2FE] rounded-xl">
                    <Settings2 className="w-6 h-6 text-[#1F3C68]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-[#1F3C68] leading-tight">Project Management</h2>
                    <p className="text-xs text-slate-400">
                      {managedProjects.length} project{managedProjects.length !== 1 ? "s" : ""} under your leadership
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-50 px-4 py-2 min-h-[220px]">
                <AnimatePresence mode="popLayout">
                  {managedProjects.length === 0 ? (
                    <motion.div
                      key="manage-empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-16 text-slate-300"
                    >
                      <Settings2 className="w-10 h-10 mb-3" />
                      <p className="text-sm font-semibold">No projects to manage yet</p>
                      <p className="text-xs mt-1">Once you lead a project, it will appear here</p>
                    </motion.div>
                  ) : (
                    managedProjects.map(({ project, tasks: projectTasks, members, leaderName }, index) => {
                      const completedTasks = projectTasks.filter((task) => task.status === "Completed").length;
                      const inProgressTasks = projectTasks.filter((task) => task.status === "In Progress").length;
                      const progress = projectTasks.length ? Math.round((completedTasks / projectTasks.length) * 100) : 0;

                      return (
                        <motion.div
                          key={project.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: index * 0.04 }}
                          className="group flex items-start justify-between gap-4 py-4 px-2 rounded-xl my-1 transition-all duration-200 hover:bg-slate-50"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#1F3C68]" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-[#1F3C68] text-sm truncate">{project.name}</h3>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                                  <Layers className="w-2.5 h-2.5" />
                                  Project
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                  <Users className="w-2.5 h-2.5" />
                                  {leaderName}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 truncate mt-0.5">{project.description || "No project description."}</p>

                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <span className="text-[10px] text-slate-300 font-medium">
                                  {project.dueDate ? `Due ${project.dueDate}` : "No due date"}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EDF2FA] text-[#1F3C68] border border-[#1F3C68]/10">
                                  <ListTodo className="w-2.5 h-2.5" />
                                  {projectTasks.length} task{projectTasks.length !== 1 ? "s" : ""}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  {completedTasks} completed
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <Zap className="w-2.5 h-2.5" />
                                  {inProgressTasks} in progress
                                </span>
                              </div>

                              <div className="mt-2.5">
                                <div className="flex justify-between items-center mb-1">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Progress</p>
                                  <span className="text-[11px] font-black text-[#1F3C68]">{progress}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.7, ease: "easeOut" }}
                                    className="h-full rounded-full bg-gradient-to-r from-[#F28C28] to-[#E97638]"
                                  />
                                </div>
                              </div>

                              {members.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2.5">
                                  {members.slice(0, 5).map((member) => (
                                    <span
                                      key={member.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                                    >
                                      <User className="w-2.5 h-2.5" />
                                      {member.name}
                                    </span>
                                  ))}
                                  {members.length > 5 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                      +{members.length - 5} more
                                    </span>
                                  )}
                                </div>
                              )}

                              {(project.tags ?? []).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {(project.tags ?? []).map((tag) => <TagBadge key={tag} tag={tag} />)}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setSelectedProject(project)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {
                                setAssigningProjectId(project.id);
                                setShowAssignModal(true);
                              }}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white shadow-sm"
                            >
                              <Plus className="w-3 h-3" />
                              Assign
                            </button>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}

export default TaskPage;
