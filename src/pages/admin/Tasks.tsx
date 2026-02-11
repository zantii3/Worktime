import { useState } from "react";
import AdminTable from "./components/AdminTable";
import {type Task } from "./AdminTypes";
import { useAdmin } from "./AdminContext";

const employees = ["Juan Dela Cruz", "Maria Santos", "Pedro Reyes"];

const AdminTasks = () => {
  const { tasks, setTasks } = useAdmin();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState({ employee: "", title: "", priority: "Low" as Task["priority"], status: "Pending" as Task["status"] });

  const handleAdd = () => {
    setForm({ employee: employees[0], title: "", priority: "Low", status: "Pending" });
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleEdit = (task: Task) => {
    setForm({ employee: task.employee, title: task.title, priority: task.priority, status: task.status });
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!form.title) return alert("Task title is required");
    if (editingTask) {
      setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...form } : t));
    } else {
      setTasks([...tasks, { id: Date.now(), ...form }]);
    }
    setIsModalOpen(false);
  };

  const updateStatus = (id: number, status: Task["status"]) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status } : t));
  };

  return (
    <div>
      <button className="mb-4 bg-green-500 text-white px-4 py-2 rounded" onClick={handleAdd}>Add Task</button>

      <AdminTable headers={["Employee", "Task", "Priority", "Status", "Actions"]}>
        {tasks.map(t => (
          <tr key={t.id} className="border-b">
            <td className="px-4 py-2">{t.employee}</td>
            <td className="px-4 py-2">{t.title}</td>
            <td className="px-4 py-2">{t.priority}</td>
            <td className="px-4 py-2">{t.status}</td>
            <td className="px-4 py-2 space-x-2">
              <button className="bg-blue-500 text-white px-2 py-1 rounded" onClick={() => updateStatus(t.id, "Completed")} disabled={t.status==="Completed"}>Mark Completed</button>
              <button className="bg-yellow-500 text-white px-2 py-1 rounded" onClick={() => handleEdit(t)}>Edit</button>
            </td>
          </tr>
        ))}
      </AdminTable>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow w-96">
            <h2 className="text-xl font-bold mb-4">{editingTask ? "Edit Task" : "Add Task"}</h2>
            <label>Employee</label>
            <select className="w-full border px-2 py-1 mb-4 rounded" value={form.employee} onChange={e => setForm({...form, employee:e.target.value})}>
              {employees.map(emp=><option key={emp} value={emp}>{emp}</option>)}
            </select>
            <label>Task Title</label>
            <input type="text" className="w-full border px-2 py-1 mb-4 rounded" value={form.title} onChange={e => setForm({...form,title:e.target.value})}/>
            <label>Priority</label>
            <select className="w-full border px-2 py-1 mb-4 rounded" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Task["priority"]})}>
              <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
            </select>
            <label>Status</label>
            <select className="w-full border px-2 py-1 mb-4 rounded" value={form.status} onChange={e=>setForm({...form,status:e.target.value as Task["status"]})}>
              <option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Completed">Completed</option>
            </select>
            <div className="flex justify-end space-x-2">
              <button className="bg-gray-400 text-white px-4 py-2 rounded" onClick={()=>setIsModalOpen(false)}>Cancel</button>
              <button className="bg-green-500 text-white px-4 py-2 rounded" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTasks;
