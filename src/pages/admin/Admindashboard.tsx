import { useMemo } from "react";
import { useAdmin } from "./AdminContext";

const AdminDashboard = () => {
  const { users, leaves, tasks, attendance } = useAdmin();

  const totalUsers = users.length;
  const pendingLeaves = useMemo(() => leaves.filter(l => l.status === "Pending").length, [leaves]);
  const tasksCompleted = useMemo(() => tasks.filter(t => t.status === "Completed").length, [tasks]);
  const tasksPending = useMemo(() => tasks.filter(t => t.status !== "Completed").length, [tasks]);
  const totalAttendance = attendance.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      <div className="bg-white p-6 rounded shadow">
        <h2 className="font-bold text-xl">Total Users</h2>
        <p className="text-3xl mt-2">{totalUsers}</p>
      </div>
      <div className="bg-white p-6 rounded shadow">
        <h2 className="font-bold text-xl">Pending Leaves</h2>
        <p className="text-3xl mt-2">{pendingLeaves}</p>
      </div>
      <div className="bg-white p-6 rounded shadow">
        <h2 className="font-bold text-xl">Tasks Completed</h2>
        <p className="text-3xl mt-2">{tasksCompleted}</p>
      </div>
      <div className="bg-white p-6 rounded shadow">
        <h2 className="font-bold text-xl">Tasks Pending</h2>
        <p className="text-3xl mt-2">{tasksPending}</p>
      </div>
      <div className="bg-white p-6 rounded shadow">
        <h2 className="font-bold text-xl">Attendance Records</h2>
        <p className="text-3xl mt-2">{totalAttendance}</p>
      </div>
    </div>
  );
};

export default AdminDashboard;
