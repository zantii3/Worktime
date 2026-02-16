import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import AdminTable from "./components/AdminTable";
import { useAdmin } from "./context/AdminProvider";
import type { Task, TaskPriority, TaskStatus } from "./context/AdminTypes";
import { notifyError, notifySuccess } from "./utils/toast";

type AdminTask = Task & {
  // Optional admin-side metadata (frontend-only; backward compatible)
  dueDate?: string; // YYYY-MM-DD
  tags?: string[];  // ["UI", "Bug", ...]
};

type TaskForm = Omit<AdminTask, "id">;

const createId = (): number => Date.now() + Math.floor(Math.random() * 1000);

const STATUS: TaskStatus[] = ["Pending", "In Progress", "Completed"];
const PRIORITY: TaskPriority[] = ["Low", "Medium", "High"];

type SortKey = "newest" | "oldest" | "priority" | "status";

function formatFullDate(now: Date) {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
}

function priorityRank(p: TaskPriority) {
  return p === "High" ? 3 : p === "Medium" ? 2 : 1;
}

function statusRank(s: TaskStatus) {
  return s === "Completed" ? 3 : s === "In Progress" ? 2 : 1;
}

function Pill({ children, tone }: { children: string; tone: "orange" | "blue" | "green" | "slate" }) {
  const base = "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border";
  const map = {
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  } as const;

  return <span className={`${base} ${map[tone]}`}>{children}</span>;
}

export default function Tasks() {
  const { tasks, setTasks } = useAdmin();
  const typedTasks = tasks as AdminTask[]; // safe: we only read optional fields

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // --- Admin UX state ---
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "All">("All");
  const [sort, setSort] = useState<SortKey>("newest");

  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)),
    [selected]
  );

  // --- Form state ---
  const [form, setForm] = useState<TaskForm>({
    title: "",
    description: "",
    assignedTo: "",
    priority: "Low",
    status: "Pending",
    dueDate: "",
    tags: [],
  });

  const [tagInput, setTagInput] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const reset = () => {
    setForm({
      title: "",
      description: "",
      assignedTo: "",
      priority: "Low",
      status: "Pending",
      dueDate: "",
      tags: [],
    });
    setTagInput("");
    setEditingId(null);
  };

  const save = () => {
    if (!form.title.trim()) return notifyError("Task title is required.");
    if (!form.assignedTo.trim()) return notifyError("Assigned user is required.");

    if (editingId) {
      setTasks((prev) =>
        (prev as AdminTask[]).map((t) => (t.id === editingId ? { ...t, ...form } : t))
      );
      notifySuccess("Task updated.");
      reset();
      return;
    }

    const newTask: AdminTask = { id: createId(), ...form };
    setTasks((prev) => [newTask as Task, ...prev]);
    notifySuccess("Task added.");
    reset();
  };

  const edit = (t: AdminTask) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description,
      assignedTo: t.assignedTo,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate ?? "",
      tags: t.tags ?? [],
    });
    setTagInput("");
  };

  const remove = (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelected((p) => {
      const copy = { ...p };
      delete copy[id];
      return copy;
    });
    notifySuccess("Task deleted.");
  };

  const setTaskStatus = (id: number, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    notifySuccess("Task status updated.");
  };

  const bulkSetStatus = (status: TaskStatus) => {
    if (selectedIds.length === 0) return notifyError("Select tasks first.");
    setTasks((prev) =>
      prev.map((t) => (selectedIds.includes(t.id) ? { ...t, status } : t))
    );
    notifySuccess(`Updated ${selectedIds.length} task(s).`);
  };

  const bulkDelete = () => {
    if (selectedIds.length === 0) return notifyError("Select tasks first.");
    setTasks((prev) => prev.filter((t) => !selectedIds.includes(t.id)));
    setSelected({});
    notifySuccess(`Deleted ${selectedIds.length} task(s).`);
  };

  const toggleAllVisible = (ids: number[], checked: boolean) => {
    setSelected((prev) => {
      const copy = { ...prev };
      for (const id of ids) copy[id] = checked;
      return copy;
    });
  };

  const toggleOne = (id: number, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: checked }));
  };

  const addTag = () => {
    const clean = tagInput.trim();
    if (!clean) return;
    setForm((p) => ({
      ...p,
      tags: Array.from(new Set([...(p.tags ?? []), clean])),
    }));
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setForm((p) => ({ ...p, tags: (p.tags ?? []).filter((t) => t !== tag) }));
  };

  // --- Derived lists ---
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...typedTasks];

    if (q) {
      list = list.filter((t) => {
        const blob = `${t.title} ${t.description} ${t.assignedTo}`.toLowerCase();
        return blob.includes(q);
      });
    }

    if (statusFilter !== "All") list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "All") list = list.filter((t) => t.priority === priorityFilter);

    // Sort
    list.sort((a, b) => {
      if (sort === "newest") return b.id - a.id;
      if (sort === "oldest") return a.id - b.id;
      if (sort === "priority") return priorityRank(b.priority) - priorityRank(a.priority);
      if (sort === "status") return statusRank(b.status) - statusRank(a.status);
      return 0;
    });

    return list;
  }, [typedTasks, query, statusFilter, priorityFilter, sort]);

  const visibleIds = useMemo(() => filtered.map((t) => t.id), [filtered]);
  const allVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    return visibleIds.every((id) => selected[id]);
  }, [visibleIds, selected]);

  const stats = useMemo(() => {
    const total = typedTasks.length;
    const pending = typedTasks.filter((t) => t.status === "Pending").length;
    const inProgress = typedTasks.filter((t) => t.status === "In Progress").length;
    const completed = typedTasks.filter((t) => t.status === "Completed").length;
    return { total, pending, inProgress, completed };
  }, [typedTasks]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header card */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-text-heading">Task Management</div>
          <div className="text-sm text-text-primary/70">{formatFullDate(now)}</div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <span>🕒</span>
          <span>
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Stats cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        <StatCard label="Total Tasks" value={stats.total} tone="slate" />
        <StatCard label="Pending" value={stats.pending} tone="orange" />
        <StatCard label="In Progress" value={stats.inProgress} tone="blue" />
        <StatCard label="Completed" value={stats.completed} tone="green" />
      </motion.div>

      {/* Create/Edit Form (admin metadata) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-card rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-text-heading">Task Details</div>
          <div className="text-xs text-text-primary/70">
            {editingId ? `Editing #${editingId}` : "Create a new task"}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="title"
            value={form.title}
            onChange={onChange}
            placeholder="Task title"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-orange-300"
          />
          <input
            name="assignedTo"
            value={form.assignedTo}
            onChange={onChange}
            placeholder="Assigned to (name)"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <textarea
          name="description"
          value={form.description}
          onChange={onChange}
          placeholder="Description"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white min-h-[90px] outline-none focus:ring-2 focus:ring-orange-300"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            name="priority"
            value={form.priority}
            onChange={onChange}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-orange-300"
          >
            {PRIORITY.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            name="status"
            value={form.status}
            onChange={onChange}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-orange-300"
          >
            {STATUS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <input
            name="dueDate"
            type="date"
            value={form.dueDate ?? ""}
            onChange={onChange}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-text-heading">Tags (optional)</div>
          <div className="flex gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="e.g., UI, Bug, Backend"
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-orange-300"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <button
              onClick={addTag}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-xl text-sm font-semibold"
              type="button"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(form.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                {tag}
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-700"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm"
          >
            {editingId ? "Update Task" : "Add Task"}
          </button>

          {editingId && (
            <button
              onClick={reset}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </motion.div>

      {/* Table wrapper card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="bg-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        {/* Table header with admin controls */}
        <div className="p-5 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-text-heading">Tasks</div>
              <div className="text-xs text-text-primary/70">
                Search, filter, bulk update, and manage tasks
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks..."
                className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-orange-300 text-sm"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "All")}
                className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-orange-300 text-sm"
              >
                <option value="All">All Status</option>
                {STATUS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | "All")}
                className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-orange-300 text-sm"
              >
                <option value="All">All Priority</option>
                {PRIORITY.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-orange-300 text-sm"
              >
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="priority">Sort: Priority</option>
                <option value="status">Sort: Status</option>
              </select>
            </div>
          </div>

          {/* Bulk actions */}
          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-between gap-3 flex-wrap bg-orange-50 border border-orange-200 rounded-2xl p-3"
              >
                <div className="text-sm font-semibold text-orange-800">
                  {selectedIds.length} selected
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => bulkSetStatus("Pending")}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-orange-200 bg-white hover:bg-orange-100"
                  >
                    Mark Pending
                  </button>
                  <button
                    onClick={() => bulkSetStatus("In Progress")}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-orange-200 bg-white hover:bg-orange-100"
                  >
                    Mark In Progress
                  </button>
                  <button
                    onClick={() => bulkSetStatus("Completed")}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-orange-200 bg-white hover:bg-orange-100"
                  >
                    Mark Completed
                  </button>
                  <button
                    onClick={bulkDelete}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  >
                    Delete Selected
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AdminTable headers={["", "Title", "Assigned To", "Priority", "Status", "Due", "Actions"]}>
          {/* Select-all row behavior driven by header checkbox below */}
          <tr className="bg-slate-50 border-b border-slate-200">
            <td className="px-4 py-3">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(e) => toggleAllVisible(visibleIds, e.target.checked)}
              />
            </td>
            <td className="px-4 py-3 font-medium text-slate-600" colSpan={6}>
              Select all visible
            </td>
          </tr>

          {filtered.map((t) => (
            <motion.tr
              key={t.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={!!selected[t.id]}
                  onChange={(e) => toggleOne(t.id, e.target.checked)}
                />
              </td>

              <td className="px-4 py-3">
                <div className="font-semibold text-text-heading">{t.title}</div>
                <div className="text-xs text-text-primary/70">{t.description}</div>
                {(t.tags?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {t.tags!.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full border border-slate-200 bg-white text-[10px] font-semibold text-slate-700"
                      >
                        {tag}
                      </span>
                    ))}
                    {t.tags!.length > 4 && (
                      <span className="text-[10px] text-slate-500">+{t.tags!.length - 4}</span>
                    )}
                  </div>
                )}
              </td>

              <td className="px-4 py-3">{t.assignedTo}</td>

              <td className="px-4 py-3">
                <Pill tone={t.priority === "High" ? "orange" : t.priority === "Medium" ? "blue" : "slate"}>
                  {t.priority}
                </Pill>
              </td>

              <td className="px-4 py-3">
                {/* Quick status changer */}
                <select
                  value={t.status}
                  onChange={(e) => setTaskStatus(t.id, e.target.value as TaskStatus)}
                  className="border border-slate-200 rounded-xl px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-orange-300 text-sm"
                >
                  {STATUS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </td>

              <td className="px-4 py-3 text-sm text-slate-700">
                {t.dueDate ? t.dueDate : <span className="text-slate-400">—</span>}
              </td>

              <td className="px-4 py-3 space-x-3">
                <button onClick={() => edit(t)} className="text-sm text-blue-700 hover:underline font-semibold">
                  Edit
                </button>
                <button
                  onClick={() => remove(t.id)}
                  className="text-sm text-red-700 hover:underline font-semibold"
                >
                  Delete
                </button>
              </td>
            </motion.tr>
          ))}

          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                No tasks found.
              </td>
            </tr>
          )}
        </AdminTable>
      </motion.div>
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "orange" | "blue" | "green" | "slate";
}) {
  const bar =
    tone === "orange"
      ? "bg-orange-500"
      : tone === "blue"
      ? "bg-blue-500"
      : tone === "green"
      ? "bg-green-500"
      : "bg-slate-400";

  const pct = Math.max(8, Math.min(100, value * 10));

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="bg-card rounded-2xl shadow-sm border border-slate-200 p-5"
    >
      <div className="text-[10px] font-bold text-slate-500">{label.toUpperCase()}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-3xl font-extrabold text-text-heading">{value}</div>
        <div className="text-xs text-text-primary/70">items</div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>0</span>
        <span>{value}</span>
      </div>
    </motion.div>
  );
}
