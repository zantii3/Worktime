import AdminTable from "./components/AdminTable";
import { useAdmin } from "./context/AdminProvider";

export default function Attendance() {
  const { attendance } = useAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Attendance</h1>
        <p className="text-sm text-slate-500">View attendance records.</p>
      </div>

      <AdminTable headers={["Employee", "Date", "Time In", "Time Out", "Status"]}>
        {attendance.map((a) => (
          <tr key={a.id}>
            <td className="px-4 py-3">{a.employee}</td>
            <td className="px-4 py-3">{a.date}</td>
            <td className="px-4 py-3">{a.timeIn || "-"}</td>
            <td className="px-4 py-3">{a.timeOut || "-"}</td>
            <td className="px-4 py-3">{a.status}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
