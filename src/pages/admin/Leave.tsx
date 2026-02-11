import { useState } from "react";
import AdminTable from "./components/AdminTable";
import { type LeaveRequest } from "./AdminTypes";
import { useAdmin } from "./AdminContext";

const employees = ["Juan Dela Cruz", "Maria Santos", "Pedro Reyes"];

const AdminLeave = () => {
  const { leaves, setLeaves } = useAdmin();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [form, setForm] = useState({ employee: "", type: "Vacation" as LeaveRequest["type"], date: "", status: "Pending" as LeaveRequest["status"] });

  const handleAdd = () => {
    setForm({ employee: employees[0], type: "Vacation", date: "", status: "Pending" });
    setEditingLeave(null);
    setIsModalOpen(true);
  };

  const handleEdit = (leave: LeaveRequest) => {
    setForm({ employee: leave.employee, type: leave.type, date: leave.date, status: leave.status });
    setEditingLeave(leave);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!form.date) return alert("Leave date required");
    if (editingLeave) setLeaves(leaves.map(l=>l.id===editingLeave.id?{...l,...form}:l));
    else setLeaves([...leaves,{id:Date.now(),...form}]);
    setIsModalOpen(false);
  };

  const approveLeave = (id:number)=>setLeaves(leaves.map(l=>l.id===id?{...l,status:"Approved"}:l));
  const rejectLeave = (id:number)=>setLeaves(leaves.map(l=>l.id===id?{...l,status:"Rejected"}:l));

  return (
    <div>
      <button className="mb-4 bg-green-500 text-white px-4 py-2 rounded" onClick={handleAdd}>Add Leave</button>
      <AdminTable headers={["Employee","Type","Date","Status","Actions"]}>
        {leaves.map(l=>(
          <tr key={l.id} className="border-b">
            <td className="px-4 py-2">{l.employee}</td>
            <td className="px-4 py-2">{l.type}</td>
            <td className="px-4 py-2">{l.date}</td>
            <td className="px-4 py-2">{l.status}</td>
            <td className="px-4 py-2 space-x-2">
              <button className="bg-green-500 text-white px-2 py-1 rounded" onClick={()=>approveLeave(l.id)} disabled={l.status!=="Pending"}>Approve</button>
              <button className="bg-red-500 text-white px-2 py-1 rounded" onClick={()=>rejectLeave(l.id)} disabled={l.status!=="Pending"}>Reject</button>
              <button className="bg-yellow-500 text-white px-2 py-1 rounded" onClick={()=>handleEdit(l)}>Edit</button>
            </td>
          </tr>
        ))}
      </AdminTable>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow w-96">
            <h2 className="text-xl font-bold mb-4">{editingLeave?"Edit Leave":"Add Leave"}</h2>
            <label>Employee</label>
            <select className="w-full border px-2 py-1 mb-4 rounded" value={form.employee} onChange={e=>setForm({...form,employee:e.target.value})}>
              {employees.map(emp=><option key={emp} value={emp}>{emp}</option>)}
            </select>
            <label>Leave Type</label>
            <select className="w-full border px-2 py-1 mb-4 rounded" value={form.type} onChange={e=>setForm({...form,type:e.target.value as LeaveRequest["type"]})}>
              <option value="Vacation">Vacation</option><option value="Sick">Sick</option>
            </select>
            <label>Date</label>
            <input type="date" className="w-full border px-2 py-1 mb-4 rounded" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
            <label>Status</label>
            <select className="w-full border px-2 py-1 mb-4 rounded" value={form.status} onChange={e=>setForm({...form,status:e.target.value as LeaveRequest["status"]})}>
              <option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option>
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

export default AdminLeave;
