import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  ArrowUpDown,
} from "lucide-react";

import AdminTable from "./components/AdminTable";
import { useAdmin } from "./context/AdminProvider";
import type { Task, TaskPriority, TaskStatus } from "./context/AdminTypes";
import { notifyError, notifySuccess } from "./utils/toast";

// ✅ CONNECT TO accounts.json (src/pages/data/accounts.json)
import accounts from "../data/accounts.json";

type Account = {
  id: number;
  email: string;
  password: string;
  name: string;
};

type AdminTask = Task & {
  dueDate?: string; // YYYY-MM-DD
  tags?: string[];
};

type TaskForm = Omit<AdminTask, "id">;

const createId = (): number => Date.now() + Math.floor(Math.random() * 1000);

const STATUS: TaskStatus[] = ["Pending", "In Progress", "Completed"];
const PRIORITY: TaskPriority[] = ["Low", "Medium", "High"];

type SortKey =
  | "newest"
  | "oldest"
  | "priority"
  | "status"
  | "dueDate"
  | "title"
  | "assignedTo";
type SortDir = "asc" | "desc";

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

function safeDateValue(yyyyMMdd?: string) {
  if (!yyyyMMdd) return Number.POSITIVE_INFINITY;
  const t = new Date(yyyyMMdd).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone,
}: {
  children: string;
  tone: "primary" | "secondary" | "success" | "slate";
}) {
  const base =
    "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border";
  const map = {
    primary: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary/10 text-secondary border-secondary/20",
    success: "bg-green-50 text-green-700 border-green-200",
    slate: "bg-soft text-text-primary border-slate-200",
  } as const;

  return <span className={`${base} ${map[tone]}`}>{children}</span>;
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-label="Close modal backdrop"
          />

          {/* Panel */}
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
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-soft border border-transparent hover:border-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="Close modal"
              >
                <X className="h-5 w-5 text-text-primary/70" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Tasks() {
  const { tasks, setTasks } = useAdmin();
  const typedTasks = tasks as AdminTask[];

  // ✅ assignees from accounts.json
  const assignees = useMemo(() => {
    const list = (accounts as Account[])
      .map((a) => a.name?.trim())
      .filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, []);

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Filters / sorting
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "All">(
    "All"
  );
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Selection
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)),
    [selected]
  );

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form
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

  const resetForm = () => {
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

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (t: AdminTask) => {
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
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const onChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
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

  const save = () => {
    if (!form.title.trim()) return notifyError("Task title is required.");
    if (!form.assignedTo.trim())
      return notifyError("Assigned user is required.");

    if (editingId) {
      setTasks((prev) =>
        (prev as AdminTask[]).map((t) =>
          t.id === editingId ? { ...t, ...form } : t
        )
      );
      notifySuccess("Task updated.");
      closeModal();
      return;
    }

    const newTask: AdminTask = { id: createId(), ...form };
    setTasks((prev) => [newTask as Task, ...prev]);
    notifySuccess("Task added.");
    closeModal();
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

  // Derived: filtered + sorted
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...typedTasks];

    if (q) {
      list = list.filter((t) => {
        const blob = `${t.title} ${t.description} ${t.assignedTo}`.toLowerCase();
        return blob.includes(q);
      });
    }

    if (statusFilter !== "All")
      list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "All")
      list = list.filter((t) => t.priority === priorityFilter);

    const dir = sortDir === "asc" ? 1 : -1;

    list.sort((a, b) => {
      if (sortKey === "newest") return (b.id - a.id) * dir;
      if (sortKey === "oldest") return (a.id - b.id) * dir;
      if (sortKey === "priority")
        return (priorityRank(b.priority) - priorityRank(a.priority)) * dir;
      if (sortKey === "status")
        return (statusRank(b.status) - statusRank(a.status)) * dir;
      if (sortKey === "dueDate")
        return (safeDateValue(a.dueDate) - safeDateValue(b.dueDate)) * dir;
      if (sortKey === "title") return a.title.localeCompare(b.title) * dir;
      if (sortKey === "assignedTo")
        return a.assignedTo.localeCompare(b.assignedTo) * dir;
      return 0;
    });

    return list;
  }, [typedTasks, query, statusFilter, priorityFilter, sortKey, sortDir]);

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
          <div className="text-2xl font-bold text-text-heading">
            Task Management
          </div>
          <div className="text-sm text-text-primary/70">
            {formatFullDate(now)}
          </div>
        </div>

        {/* Clock badge */}
        <div className="bg-primary text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>
            {now.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
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
        <StatCard label="Pending" value={stats.pending} tone="secondary" />
        <StatCard label="In Progress" value={stats.inProgress} tone="primary" />
        <StatCard label="Completed" value={stats.completed} tone="success" />
      </motion.div>

      {/* ✅ MODAL: Create/Edit Task */}
      <Modal
        open={modalOpen}
        title={editingId ? `Edit Task #${editingId}` : "Create New Task"}
        onClose={closeModal}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <div className="text-xs font-semibold text-text-heading">
                Task title
              </div>
              <input
                name="title"
                value={form.title}
                onChange={onChange}
                placeholder="Task title"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <label className="space-y-1">
              <div className="text-xs font-semibold text-text-heading">
                Assigned to
              </div>

              {/* ✅ CONNECTED DROPDOWN */}
              <select
                name="assignedTo"
                value={form.assignedTo}
                onChange={onChange}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="" disabled>
                  Select employee...
                </option>
                {assignees.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-1">
            <div className="text-xs font-semibold text-text-heading">
              Description
            </div>
            <textarea
              name="description"
              value={form.description}
              onChange={onChange}
              placeholder="Description"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white min-h-[100px] outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1">
              <div className="text-xs font-semibold text-text-heading">
                Priority
              </div>
              <select
                name="priority"
                value={form.priority}
                onChange={onChange}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30"
              >
                {PRIORITY.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-xs font-semibold text-text-heading">Status</div>
              <select
                name="status"
                value={form.status}
                onChange={onChange}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30"
              >
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-xs font-semibold text-text-heading">
                Due date
              </div>
              <input
                name="dueDate"
                type="date"
                value={form.dueDate ?? ""}
                onChange={onChange}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-text-heading">
              Tags (optional)
            </div>

            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="e.g., UI, Bug, Backend"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />

              <button
                onClick={addTag}
                className="bg-soft hover:bg-slate-200 text-text-primary px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200"
                type="button"
              >
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(form.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white text-xs font-semibold text-text-primary"
                >
                  {tag}
                  <button
                    type="button"
                    className="text-text-primary/50 hover:text-text-primary"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={closeModal}
              className="bg-soft hover:bg-slate-200 text-text-primary px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200"
              type="button"
            >
              Cancel
            </button>

            <button
              onClick={save}
              className="bg-primary hover:opacity-95 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm"
              type="button"
            >
              {editingId ? "Update Task" : "Create Task"}
            </button>
          </div>
        </div>
      </Modal>

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
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-3 py-2 text-sm font-semibold hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary/30"
                type="button"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </button>

              <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-primary/30">
                <Search className="h-4 w-4 text-text-primary/50" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="outline-none text-sm w-44"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as TaskStatus | "All")
                }
                className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              >
                <option value="All">All Status</option>
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as TaskPriority | "All")
                }
                className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              >
                <option value="All">All Priority</option>
                {PRIORITY.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              >
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="dueDate">Sort: Due Date</option>
                <option value="priority">Sort: Priority</option>
                <option value="status">Sort: Status</option>
                <option value="title">Sort: Title</option>
                <option value="assignedTo">Sort: Assigned To</option>
              </select>

              <button
                type="button"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-soft rounded-xl px-3 py-2 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                title="Toggle sort direction"
              >
                <ArrowUpDown className="h-4 w-4 text-text-primary/70" />
                {sortDir === "asc" ? "Asc" : "Desc"}
              </button>
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
                className="flex items-center justify-between gap-3 flex-wrap bg-soft border border-slate-200 rounded-2xl p-3"
              >
                <div className="text-sm font-semibold text-text-heading">
                  {selectedIds.length} selected
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => bulkSetStatus("Pending")}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-soft"
                    type="button"
                  >
                    Mark Pending
                  </button>

                  <button
                    onClick={() => bulkSetStatus("In Progress")}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-soft"
                    type="button"
                  >
                    Mark In Progress
                  </button>

                  <button
                    onClick={() => bulkSetStatus("Completed")}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-soft"
                    type="button"
                  >
                    Mark Completed
                  </button>

                  <button
                    onClick={bulkDelete}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    type="button"
                  >
                    Delete Selected
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-full overflow-x-auto">
          <AdminTable
            headers={[
              "",
              "Title",
              "Assigned To",
              "Priority",
              "Status",
              "Due",
              "Actions",
            ]}
          >
            {/* Select-all row */}
            <tr className="bg-soft border-b border-slate-200">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => toggleAllVisible(visibleIds, e.target.checked)}
                />
              </td>
              <td className="px-4 py-3 font-medium text-text-primary" colSpan={6}>
                Select all visible
              </td>
            </tr>

            {filtered.map((t) => (
              <motion.tr
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="align-top"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={!!selected[t.id]}
                    onChange={(e) => toggleOne(t.id, e.target.checked)}
                  />
                </td>

                <td className="px-4 py-3 min-w-[320px]">
                  <div className="font-semibold text-text-heading">{t.title}</div>
                  <div className="text-xs text-text-primary/70 line-clamp-2">
                    {t.description}
                  </div>

                  {(t.tags?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {t.tags!.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full border border-slate-200 bg-white text-[10px] font-semibold text-text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                      {t.tags!.length > 4 && (
                        <span className="text-[10px] text-text-primary/60">
                          +{t.tags!.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </td>

                <td className="px-4 py-3 min-w-[160px]">{t.assignedTo}</td>

                <td className="px-4 py-3">
                  <Pill
                    tone={
                      t.priority === "High"
                        ? "secondary"
                        : t.priority === "Medium"
                        ? "primary"
                        : "slate"
                    }
                  >
                    {t.priority}
                  </Pill>
                </td>

                <td className="px-4 py-3 min-w-[180px]">
                  <select
                    value={t.status}
                    onChange={(e) =>
                      setTaskStatus(t.id, e.target.value as TaskStatus)
                    }
                    className="border border-slate-200 rounded-xl px-2 py-1 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm w-full"
                  >
                    {STATUS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-3 text-sm text-text-primary min-w-[130px]">
                  {t.dueDate ? (
                    t.dueDate
                  ) : (
                    <span className="text-text-primary/50">—</span>
                  )}
                </td>

                <td className="px-4 py-3 min-w-[190px]">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEdit(t)}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-semibold"
                      type="button"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      className="inline-flex items-center gap-1.5 text-sm text-red-700 hover:underline font-semibold"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-text-primary/60"
                >
                  No tasks found.
                </td>
              </tr>
            )}
          </AdminTable>
        </div>
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
  tone: "secondary" | "primary" | "success" | "slate";
}) {
  const bar =
    tone === "primary"
      ? "bg-primary"
      : tone === "secondary"
      ? "bg-secondary"
      : tone === "success"
      ? "bg-green-600"
      : "bg-slate-400";

  // NOTE: keeping your original behavior (value * 10) to avoid changing other UI.
  const pct = Math.max(8, Math.min(100, value * 10));

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="bg-card rounded-2xl shadow-sm border border-slate-200 p-5"
    >
      <div className="text-[10px] font-bold text-text-primary/60">
        {label.toUpperCase()}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-3xl font-extrabold text-text-heading">{value}</div>
        <div className="text-xs text-text-primary/70">items</div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-soft overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-text-primary/60">
        <span>0%</span>
        <span>{pct}%</span>
      </div>
    </motion.div>
  );
}
