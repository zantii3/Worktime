import { Link } from "react-router-dom";

export default function AdminSidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white p-4 space-y-4">
      <h1 className="text-xl font-bold">WorkTime+ Admin</h1>

      <nav className="space-y-2">
        <Link to="/admin" className="block">Dashboard</Link>
        <Link to="/admin/attendance" className="block">Attendance</Link>
        <Link to="/admin/leave" className="block">Leave</Link>
        <Link to="/admin/tasks" className="block">Tasks</Link>
        <Link to="/admin/users" className="block">Users</Link>
      </nav>
    </aside>
  );
}
