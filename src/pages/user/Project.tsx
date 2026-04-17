import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, FolderKanban, Search, X, ChevronRight,
  Calendar, Tag, Clock, CheckCircle2,
  Circle, PlayCircle, AlertCircle, Layers, Eye,
} from "lucide-react";
import Usersidebar from "./components/Usersidebar.tsx";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ProjectStatus = "Not Started" | "In Progress" | "On Hold" | "Completed";
type ProjectPriority = "Low" | "Medium" | "High" | "Critical";

interface Account {
  id: number;
  email: string;
  name: string;
}

interface ProjectMember {
  id: string;
  name: string;
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
}

const PROJECTS_KEY = "worktime_projects_v1";
const TASKS_KEY = "worktime_tasks_v1";

type TaskStatus = "Pending" | "In Progress" | "Completed";
type TaskPriority = "Low" | "Medium" | "High";

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
}

interface StoredProject {
  id: number;
  name: string;
  description: string;
  leaderId: number;
  dueDate?: string;
  tags?: string[];
}

// ─── Status Config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  "Not Started": { label: "Not Started", color: "#64748b", bg: "bg-slate-50",  border: "border-slate-200", icon: <Circle className="w-3.5 h-3.5" /> },
  "In Progress": { label: "In Progress", color: "#1F3C68", bg: "bg-blue-50",   border: "border-blue-200",  icon: <PlayCircle className="w-3.5 h-3.5" /> },
  "On Hold":     { label: "On Hold",     color: "#d97706", bg: "bg-amber-50",  border: "border-amber-200", icon: <AlertCircle className="w-3.5 h-3.5" /> },
  Completed:     { label: "Completed",   color: "#16a34a", bg: "bg-green-50",  border: "border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

const PRIORITY_CONFIG: Record<ProjectPriority, { color: string; bg: string; border: string }> = {
  Low:      { color: "#16a34a", bg: "bg-green-50",  border: "border-green-200"  },
  Medium:   { color: "#d97706", bg: "bg-amber-50",  border: "border-amber-200"  },
  High:     { color: "#dc2626", bg: "bg-red-50",    border: "border-red-200"    },
  Critical: { color: "#7c3aed", bg: "bg-purple-50", border: "border-purple-200" },
};

// ─── Project Detail Modal ───────────────────────────────────────────────────────
function ProjectDetailModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const statusCfg   = STATUS_CONFIG[project.status];
  const priorityCfg = PRIORITY_CONFIG[project.priority];

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const daysLeft = () => {
    const diff = new Date(project.endDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0)  return { label: `${Math.abs(days)}d overdue`, color: "text-red-500" };
    if (days === 0) return { label: "Due today",                  color: "text-amber-500" };
    return           { label: `${days}d left`,                    color: "text-slate-500" };
  };
  const dl = daysLeft();

  return (
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
                <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Project Details</p>
                <h2 className="text-lg font-bold leading-snug">{project.name}</h2>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.border}`} style={{ color: statusCfg.color }}>
              {statusCfg.icon}{statusCfg.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${priorityCfg.bg} ${priorityCfg.border}`} style={{ color: priorityCfg.color }}>
              <Tag className="w-3 h-3" />{project.priority} Priority
            </span>
          </div>

          <p className="text-slate-600 text-sm leading-relaxed">{project.description || "No description provided."}</p>

          <div>
            <div className="flex justify-between text-xs font-medium text-slate-500 mb-1.5">
              <span>Progress</span>
              <span className="font-bold text-[#1F3C68]">{project.progress}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${project.progress}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className={`h-full rounded-full ${project.progress === 100 ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-[#F28C28] to-[#E97638]"}`}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{project.tasksCompleted} of {project.tasksTotal} tasks completed</p>
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
              <p className="text-lg font-bold text-yellow-600">{project.tasksTotal - project.tasksCompleted}</p>
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

          {project.members.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Team Members</p>
              <div className="flex flex-wrap gap-2">
                {project.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-slate-700">{m.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {project.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#1F3C68]/10 text-[#1F3C68] border border-[#1F3C68]/20">
                    <Tag className="w-2.5 h-2.5" />{tag}
                  </span>
                ))}
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
    if (days === 0)  return { label: "Due today",                  color: "text-amber-600", bg: "bg-amber-50" };
    if (days <= 7)   return { label: `${days}d left`,              color: "text-amber-600", bg: "bg-amber-50" };
    return            { label: `${days}d left`,                    color: "text-slate-400", bg: "bg-slate-50" };
  };
  const dl = daysLeft();

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
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{project.description || "No description."}</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#F28C28] transition-colors flex-shrink-0 mt-1" />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.bg} ${statusCfg.border}`} style={{ color: statusCfg.color }}>
            {statusCfg.icon}{statusCfg.label}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${priorityCfg.bg} ${priorityCfg.border}`} style={{ color: priorityCfg.color }}>
            {project.priority}
          </span>
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
              className={`h-full rounded-full ${project.progress === 100 ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-[#F28C28] to-[#E97638]"}`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {project.members.slice(0, 4).map((m, i) => (
              <div
                key={m.id} title={m.name}
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
            <span>{new Date(project.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
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
function ProjectList() {
  const location = useLocation();
  const navigate  = useNavigate();

  // Resolve current user from route state → localStorage → null
  const rawUser = location.state?.user ?? JSON.parse(localStorage.getItem("currentUser") ?? "null");

  const [currentUser, setCurrentUser] = useState<Account | null>(null);
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [storedProjects,  setStoredProjects]  = useState<StoredProject[]>([]);
  const [tasks,           setTasks]           = useState<Task[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [search,          setSearch]          = useState("");
  const [statusFilter,    setStatusFilter]    = useState<ProjectStatus | "All">("All");

  const handleLogout = () => { localStorage.removeItem("currentUser"); navigate("/"); };

  // ── Step 1: Verify & enrich user against accounts.json ──────────────────────
  useEffect(() => {
    if (!rawUser) return;

    fetch("/accounts.json")
      .then((r) => r.json())
      .then((accounts: Account[]) => {
        // Match by id (coerced) OR by email as fallback
        const match = accounts.find(
          (a) =>
            String(a.id) === String(rawUser.id) ||
            a.email?.toLowerCase() === rawUser.email?.toLowerCase()
        );
        // Use canonical account data; fall back to rawUser if not found
        setCurrentUser(match ?? rawUser);
      })
      .catch(() => {
        // accounts.json unreachable — use stored user as-is
        setCurrentUser(rawUser);
      });
  }, [rawUser?.id, rawUser?.email]);

  // Keep local storage-backed project/task data in sync for the view-only page.
  useEffect(() => {
    const load = () => {
      try {
        const rawProjects = localStorage.getItem(PROJECTS_KEY);
        const rawTasks = localStorage.getItem(TASKS_KEY);

        const parsedProjects = rawProjects ? JSON.parse(rawProjects) : [];
        const parsedTasks = rawTasks ? JSON.parse(rawTasks) : [];

        setStoredProjects(Array.isArray(parsedProjects) ? parsedProjects : []);
        setTasks(Array.isArray(parsedTasks) ? parsedTasks : []);
      } catch {
        setStoredProjects([]);
        setTasks([]);
      }
    };

    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  const projects = useMemo<Project[]>(() => {
    if (!currentUser) return [];

    const currentUserName = currentUser.name?.trim().toLowerCase();

    return storedProjects
      .filter((project) => {
        const isLeader = String(project.leaderId) === String(currentUser.id);
        const isAssignedInProject = tasks.some((task) => {
          if (task.projectId !== project.id) return false;

          const assignedById = task.assignedToId !== undefined && String(task.assignedToId) === String(currentUser.id);
          const assignedByName =
            !!task.assignedTo &&
            task.assignedTo.trim().toLowerCase() === currentUserName;

          return assignedById || assignedByName;
        });

        return isLeader || isAssignedInProject;
      })
      .map((project) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id);
        const tasksTotal = projectTasks.length;
        const tasksCompleted = projectTasks.filter((task) => task.status === "Completed").length;
        const hasInProgress = projectTasks.some((task) => task.status === "In Progress");
        const hasStarted = projectTasks.some((task) => task.status !== "Pending");
        const progress = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

        const membersMap = new Map<string, ProjectMember>();
        for (const task of projectTasks) {
          if (!task.assignedTo) continue;
          const memberKey = String(task.assignedToId ?? task.assignedTo.trim().toLowerCase());
          if (!membersMap.has(memberKey)) {
            membersMap.set(memberKey, {
              id: String(task.assignedToId ?? task.assignedTo),
              name: task.assignedTo,
            });
          }
        }

        const priorityRank: Record<TaskPriority, number> = { Low: 0, Medium: 1, High: 2 };
        const highestPriorityTask = projectTasks.reduce<TaskPriority | null>((highest, task) => {
          if (!highest || priorityRank[task.priority] > priorityRank[highest]) return task.priority;
          return highest;
        }, null);

        const status: ProjectStatus =
          tasksTotal === 0 || !hasStarted
            ? "Not Started"
            : tasksCompleted === tasksTotal
              ? "Completed"
              : hasInProgress || tasksCompleted > 0
                ? "In Progress"
                : "On Hold";

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          status,
          priority: highestPriorityTask === "High" ? "High" : highestPriorityTask ?? "Medium",
          startDate: projectTasks[0]?.dueDate ?? project.dueDate ?? new Date().toISOString(),
          endDate: project.dueDate ?? projectTasks[0]?.dueDate ?? new Date().toISOString(),
          progress,
          members: Array.from(membersMap.values()),
          tags: project.tags ?? [],
          tasksTotal,
          tasksCompleted,
          createdAt: new Date().toISOString(),
        };
      });
  }, [currentUser, storedProjects, tasks]);

  // ── Counts & filtered list ──────────────────────────────────────────────────
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
    { label: "All",         value: "All",         count: counts.all         },
    { label: "Not Started", value: "Not Started", count: counts.notStarted  },
    { label: "In Progress", value: "In Progress", count: counts.inProgress  },
    { label: "On Hold",     value: "On Hold",     count: counts.onHold      },
    { label: "Completed",   value: "Completed",   count: counts.completed   },
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

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 bg-white shadow-lg flex-col border-r border-slate-200">
        <Usersidebar navigate={navigate} logout={handleLogout} />
      </aside>

      {/* Mobile Sidebar */}
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
            <button className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors" onClick={() => setMenuOpen(true)}>
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
            <span className="text-sm font-bold">{counts.all} Project{counts.all !== 1 ? "s" : ""}</span>
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
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded-full transition-colors">
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
                  statusFilter === tab.value ? "bg-primary text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {tab.label}
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[9px] font-bold px-1 ${
                  statusFilter === tab.value ? "bg-white/30 text-white" : "bg-slate-200 text-slate-500"
                }`}>
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

export default ProjectList;
