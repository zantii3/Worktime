import { useLocation, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
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
  tags?: string[]; // admin-assigned tags
}

const TASKS_KEY = "worktime_tasks_v1";

const priorityConfig: Record<
  TaskPriority,
  { color: string; dot: string; bg: string }
> = {
  High: {
    color: "text-[#E97638]",
    dot: "bg-[#E97638]",
    bg: "bg-[#FFF4EE]",
  },
  Medium: {
    color: "text-[#1F3C68]",
    dot: "bg-[#1F3C68]",
    bg: "bg-[#EDF2FA]",
  },
  Low: {
    color: "text-slate-500",
    dot: "bg-slate-400",
    bg: "bg-slate-100",
  },
};

const statusConfig: Record<
  TaskStatus,
  { label: string; bar: string; ring: string }
> = {
  Pending: {
    label: "Pending",
    bar: "bg-slate-300",
    ring: "ring-slate-300",
  },
  "In Progress": {
    label: "In Progress",
    bar: "bg-[#F28C28]",
    ring: "ring-[#F28C28]",
  },
  Completed: {
    label: "Completed",
    bar: "bg-[#1F3C68]",
    ring: "ring-[#1F3C68]",
  },
};

// Deterministic color palette for tags — cycles by tag string
const TAG_PALETTES = [
  { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200" },
  { bg: "bg-cyan-100",   text: "text-cyan-700",   border: "border-cyan-200"   },
  { bg: "bg-emerald-100",text: "text-emerald-700",border: "border-emerald-200"},
  { bg: "bg-pink-100",   text: "text-pink-700",   border: "border-pink-200"   },
  { bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200"  },
  { bg: "bg-sky-100",    text: "text-sky-700",    border: "border-sky-200"    },
  { bg: "bg-rose-100",   text: "text-rose-700",   border: "border-rose-200"   },
  { bg: "bg-teal-100",   text: "text-teal-700",   border: "border-teal-200"   },
];

function getTagPalette(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTES[hash % TAG_PALETTES.length];
}

function TagBadge({ tag }: { tag: string }) {
  const p = getTagPalette(tag);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border ${p.bg} ${p.text} ${p.border} whitespace-nowrap`}
    >
      <Tag className="w-2.5 h-2.5 flex-shrink-0" />
      {tag}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  delay,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
  delay: number;
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
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            {label}
          </p>
          <p className="text-4xl font-black text-[#1F3C68] tabular-nums leading-none">
            {value}
          </p>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50">
          <Icon className="w-5 h-5 text-slate-400 group-hover:text-[#1F3C68] transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}

function TaskPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user =
    location.state?.user ||
    JSON.parse(localStorage.getItem("currentUser") || "null");

  const currentTime = useClock();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStatus, setActiveStatus] = useState<"All" | TaskStatus>("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | TaskPriority>("All");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>(() => {
    const raw = localStorage.getItem(TASKS_KEY);
    const all: Task[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(all)
      ? all.filter((t) => t.assignedTo === user?.name)
      : [];
  });

  const saveTasks = (updated: Task[]) => {
    setTasks(updated);
    const raw = localStorage.getItem(TASKS_KEY);
    const all: Task[] = raw ? JSON.parse(raw) : [];
    const safeAll = Array.isArray(all) ? all : [];
    const others = safeAll.filter((t) => t?.assignedTo !== user?.name);
    localStorage.setItem(TASKS_KEY, JSON.stringify([...updated, ...others]));
  };

  // Collect all unique tags across this user's tasks
  const allTags = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => t.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((t) => {
      const matchStatus = activeStatus === "All" || t.status === activeStatus;
      const matchPriority = priorityFilter === "All" || t.priority === priorityFilter;
      const matchTag = !activeTag || (t.tags ?? []).includes(activeTag);
      return matchStatus && matchPriority && matchTag;
    });
    const statusOrder: Record<TaskStatus, number> = {
      Pending: 0,
      "In Progress": 1,
      Completed: 2,
    };
    return filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [tasks, activeStatus, priorityFilter, activeTag]);

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "Completed").length;
  const inProgress = tasks.filter((t) => t.status === "In Progress").length;
  const pending = tasks.filter((t) => t.status === "Pending").length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  const updateStatus = (id: number, status: TaskStatus) => {
    saveTasks(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const advanceStatus = (task: Task): TaskStatus => {
    if (task.status === "Pending") return "In Progress";
    if (task.status === "In Progress") return "Completed";
    return "Completed";
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white shadow-md flex-col border-r border-slate-100">
        <Usersidebar navigate={navigate} logout={handleLogout} />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-[#1F3C68]/40 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
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

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">

        {/* ── Header ── */}
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="flex justify-between items-center mb-8 bg-white px-6 py-5 rounded-2xl shadow-sm border border-slate-100"
        >
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="text-[#1F3C68]" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-[#1F3C68] truncate">
                My Tasks
              </h1>
              <p className="text-xs sm:text-sm text-[#1E293B] mt-1 font-medium truncate">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
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
              {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
        </motion.div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total"       value={total}      icon={Layers}       accent="bg-primary"   delay={0.05} />
          <StatCard label="Completed"   value={completed}  icon={CheckCircle2} accent="bg-secondary" delay={0.1}  />
          <StatCard label="In Progress" value={inProgress} icon={Zap}          accent="bg-primary"   delay={0.15} />
          <StatCard label="Pending"     value={pending}    icon={Circle}       accent="bg-secondary" delay={0.2}  />
        </div>

        {/* ── Progress Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="bg-primary text-white rounded-2xl px-6 py-5 mb-6 shadow-md relative overflow-hidden"
        >
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 right-24 w-24 h-24 rounded-full bg-[#F28C28]/20" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-soft rounded-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                  Overall Progress
                </p>
                <p className="text-3xl font-black tabular-nums leading-tight">
                  {progress}
                  <span className="text-lg font-semibold text-white/60 ml-0.5">%</span>
                </p>
              </div>
            </div>
            <div className="flex-1">
              <div className="w-full bg-white/50 h-2.5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-[#F28C28] to-[#E97638]"
                />
              </div>
              <p className="text-xs text-white/70 mt-1.5">
                {completed} of {total} tasks complete
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Task List Panel ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
        >
          {/* Panel header */}
          <div className="flex flex-wrap justify-between items-center gap-4 px-6 py-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#E0F2FE] rounded-xl">
                <ListTodo className="w-6 h-6 text-[#1F3C68]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#1F3C68] leading-tight">Task List</h2>
                <p className="text-xs text-slate-400">
                  {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""} shown
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap items-center">
              {(["All", "Pending", "In Progress", "Completed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                    activeStatus === s
                      ? "bg-[#E97638] text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {s}
                </button>
              ))}

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as "All" | TaskPriority)}
                className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#1F3C68]/30"
              >
                <option value="All">All Priority</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          {/* ── Tag Filter Strip (only when tags exist) ── */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-slate-50 bg-slate-50/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3" /> Tags
              </span>
              <button
                onClick={() => setActiveTag(null)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                  activeTag === null
                    ? "bg-[#1F3C68] text-white border-[#1F3C68]"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                All
              </button>
              {allTags.map((tag) => {
                const p = getTagPalette(tag);
                const isActive = activeTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(isActive ? null : tag)}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                      isActive
                        ? `${p.bg} ${p.text} ${p.border} ring-2 ring-offset-1 ${p.border}`
                        : `bg-white ${p.text} ${p.border} hover:${p.bg}`
                    }`}
                  >
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                    {/* count badge */}
                    <span className={`ml-0.5 font-black tabular-nums ${isActive ? p.text : "text-slate-400"}`}>
                      {tasks.filter((t) => (t.tags ?? []).includes(tag)).length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Task rows */}
          <div className="divide-y divide-slate-50 px-4 py-2">
            <AnimatePresence mode="popLayout">
              {filteredTasks.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-slate-300"
                >
                  <ListTodo className="w-10 h-10 mb-3" />
                  <p className="text-sm font-semibold">No tasks found</p>
                  <p className="text-xs mt-1">Try adjusting your filters</p>
                </motion.div>
              ) : (
                filteredTasks.map((task, index) => {
                  const pCfg = priorityConfig[task.priority];
                  const sCfg = statusConfig[task.status];
                  const hasTags = (task.tags ?? []).length > 0;
                  return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.04 }}
                      className={`group flex items-start justify-between gap-4 py-4 px-2 rounded-xl my-1 transition-all duration-200 hover:bg-slate-50 ${
                        task.status === "Completed" ? "opacity-60" : ""
                      }`}
                    >
                      {/* Left: status indicator + text + tags */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Colored status strip */}
                        <div className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${sCfg.bar}`} />

                        <div className="min-w-0 flex-1">
                          <h3
                            className={`font-bold text-[#1F3C68] text-sm truncate ${
                              task.status === "Completed" ? "line-through text-slate-400" : ""
                            }`}
                          >
                            {task.title}
                          </h3>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {task.description}
                          </p>
                          <p className="text-[10px] text-slate-300 mt-1 font-medium">
                            Due&nbsp;{task.dueDate}
                          </p>

                          {/* ── Tags row ── */}
                          {hasTags && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {(task.tags ?? []).map((tag) => (
                                <TagBadge key={tag} tag={tag} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: badges + action */}
                      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                        {/* Priority badge */}
                        <span
                          className={`hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg ${pCfg.bg} ${pCfg.color}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${pCfg.dot}`} />
                          {task.priority}
                        </span>

                        {/* Status pill */}
                        <span className="hidden md:inline-flex text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500">
                          {sCfg.label}
                        </span>

                        {/* Advance / complete button */}
                        {task.status !== "Completed" ? (
                          <button
                            onClick={() => updateStatus(task.id, advanceStatus(task))}
                            className={`p-1.5 rounded-lg transition-all ${
                              task.status === "Pending"
                                ? "bg-yellow-50 text-yellow-500 hover:bg-yellow-100"
                                : "bg-blue-50 text-blue-500 hover:bg-blue-100"
                            }`}
                          >
                            <CheckCircle2 className="w-4.5 h-4.5" />
                          </button>
                        ) : (
                          <CheckCircle2 className="w-4.5 h-4.5 text-green-400" />
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default TaskPage;