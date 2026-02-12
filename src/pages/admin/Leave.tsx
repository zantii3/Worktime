import { useState } from "react";
import AdminTable from "./components/AdminTable";
import { useAdmin } from "./context/AdminProvider";
import type { LeaveRequest, LeaveStatus, LeaveType } from "./context/AdminTypes";
import { notifyError, notifySuccess } from "./utils/toast";

type LeaveForm = Omit<LeaveRequest, "id">;

const createId = (): number => Date.now() + Math.floor(Math.random() * 1000);

export default function Leave() {
  const { leaves, setLeaves } = useAdmin();

  const [form, setForm] = useState<LeaveForm>({
    employee: "",
    type: "Vacation",
    date: "",
    reason: "",
    status: "Pending",
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const reset = () => {
    setForm({ employee: "", type: "Vacation", date: "", reason: "", status: "Pending" });
    setEditingId(null);
  };

  const save = () => {
    if (!form.employee.trim()) return notifyError("Employee is required.");
    if (!form.date.trim()) return notifyError("Date is required.");
    if (!form.reason.trim()) return notifyError("Reason is required.");

    if (editingId) {
      setLeaves((prev) => prev.map((l) => (l.id === editingId ? { ...l, ...form } : l)));
      notifySuccess("Leave updated.");
      reset();
      return;
    }

    const newLeave: LeaveRequest = { id: createId(), ...form };
    setLeaves((prev) => [newLeave, ...prev]);
    notifySuccess("Leave added.");
    reset();
  };

  const edit = (l: LeaveRequest) => {
    setEditingId(l.id);
    setForm({
      employee: l.employee,
      type: l.type,
      date: l.date,
      reason: l.reason,
      status: l.status,
    });
  };

  const setStatus = (id: number, status: "Approved" | "Rejected") => {
    setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    notifySuccess(`Leave ${status.toLowerCase()}.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Leave Management</h1>
        <p className="text-sm text-slate-500">Approve, reject, and track requests.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="employee"
            value={form.employee}
            onChange={onChange}
            placeholder="Employee name"
            className="w-full border border-slate-200 rounded-lg px-3 py-2"
          />

          <select
            name="type"
            value={form.type}
            onChange={onChange}
            className="w-full border border-slate-200 rounded-lg px-3 py-2"
          >
            {(["Vacation", "Sick"] as LeaveType[]).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <input
          name="date"
          type="date"
          value={form.date}
          onChange={onChange}
          className="w-full border border-slate-200 rounded-lg px-3 py-2"
        />

        <textarea
          name="reason"
          value={form.reason}
          onChange={onChange}
          placeholder="Reason"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[90px]"
        />

        <select
          name="status"
          value={form.status}
          onChange={onChange}
          className="w-full border border-slate-200 rounded-lg px-3 py-2"
        >
          {(["Pending", "Approved", "Rejected"] as LeaveStatus[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            onClick={save}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            {editingId ? "Update Leave" : "Add Leave"}
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

      <AdminTable headers={["Employee", "Type", "Date", "Reason", "Status", "Actions"]}>
        {leaves.map((l) => (
          <tr key={l.id}>
            <td className="px-4 py-3">{l.employee}</td>
            <td className="px-4 py-3">{l.type}</td>
            <td className="px-4 py-3">{l.date}</td>
            <td className="px-4 py-3">{l.reason}</td>
            <td className="px-4 py-3">{l.status}</td>
            <td className="px-4 py-3 space-x-3">
              <button onClick={() => edit(l)} className="text-sm text-blue-700 hover:underline">
                Edit
              </button>
              {l.status === "Pending" && (
                <>
                  <button onClick={() => setStatus(l.id, "Approved")} className="text-sm text-green-700 hover:underline">
                    Approve
                  </button>
                  <button onClick={() => setStatus(l.id, "Rejected")} className="text-sm text-red-700 hover:underline">
                    Reject
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
