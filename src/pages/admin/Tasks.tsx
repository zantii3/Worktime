import { useState } from "react";
import AdminTable from "./components/AdminTable";
import { useAdmin } from "./context/AdminProvider";
import type { Task, TaskPriority, TaskStatus } from "./context/AdminTypes";
import { notifyError, notifySuccess } from "./utils/toast";

type TaskForm = Omit<Task, "id">;

const createId = (): number => Date.now() + Math.floor(Math.random() * 1000);

export default function Tasks() {
  const { tasks, setTasks } = useAdmin();

  const [form, setForm] = useState<TaskForm>({
    title: "",
    description: "",
    assignedTo: "",
    priority: "Low",
    status: "Pending",
  });

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
    });
    setEditingId(null);
  };

  const save = () => {
    if (!form.title.trim()) return notifyError("Task title is required.");
    if (!form.assignedTo.trim()) return notifyError("Assigned user is required.");

    if (editingId) {
      setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...form } : t)));
      notifySuccess("Task updated.");
      reset();
      return;
    }

    const newTask: Task = { id: createId(), ...form }; // safe (inside handler)
    setTasks((prev) => [newTask, ...prev]);
    notifySuccess("Task added.");
    reset();
  };

  const edit = (t: Task) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description,
      assignedTo: t.assignedTo,
      priority: t.priority,
      status: t.status,
    });
  };

  const markCompleted = (id: number) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "Completed" } : t)));
    notifySuccess("Task marked as completed.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Task Management</h1>
        <p className="text-sm text-slate-500">Create, assign, and track tasks.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="title"
            value={form.title}
            onChange={onChange}
            placeholder="Task title"
            className="w-full border border-slate-200 rounded-lg px-3 py-2"
          />
          <input
            name="assignedTo"
            value={form.assignedTo}
            onChange={onChange}
            placeholder="Assigned to (name)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2"
          />
        </div>

        <textarea
          name="description"
          value={form.description}
          onChange={onChange}
          placeholder="Description"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[90px]"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            name="priority"
            value={form.priority}
            onChange={onChange}
            className="w-full border border-slate-200 rounded-lg px-3 py-2"
          >
            {(["Low", "Medium", "High"] as TaskPriority[]).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            name="status"
            value={form.status}
            onChange={onChange}
            className="w-full border border-slate-200 rounded-lg px-3 py-2"
          >
            {(["Pending", "In Progress", "Completed"] as TaskStatus[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            {editingId ? "Update Task" : "Add Task"}
          </button>
          {editingId && (
            <button
              onClick={reset}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <AdminTable headers={["Title", "Assigned To", "Priority", "Status", "Actions"]}>
        {tasks.map((t) => (
          <tr key={t.id}>
            <td className="px-4 py-3">
              <div className="font-medium text-slate-800">{t.title}</div>
              <div className="text-xs text-slate-500">{t.description}</div>
            </td>
            <td className="px-4 py-3">{t.assignedTo}</td>
            <td className="px-4 py-3">{t.priority}</td>
            <td className="px-4 py-3">{t.status}</td>
            <td className="px-4 py-3 space-x-3">
              <button onClick={() => edit(t)} className="text-sm text-blue-700 hover:underline">
                Edit
              </button>
              {t.status !== "Completed" && (
                <button onClick={() => markCompleted(t.id)} className="text-sm text-green-700 hover:underline">
                  Complete
                </button>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
