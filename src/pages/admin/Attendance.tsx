import { useAdmin } from "./AdminContext";
import AdminTable from "./components/AdminTable";

const AdminAttendance = () => {
  const { attendance } = useAdmin();

  return (
    <AdminTable headers={["Employee", "Date", "Time In", "Time Out", "Status"]}>
      {attendance.map(a=>(
        <tr key={a.id} className="border-b">
          <td className="px-4 py-2">{a.employee}</td>
          <td className="px-4 py-2">{a.date}</td>
          <td className="px-4 py-2">{a.timeIn}</td>
          <td className="px-4 py-2">{a.timeOut}</td>
          <td className="px-4 py-2">{a.status}</td>
        </tr>
      ))}
    </AdminTable>
  );
};

export default AdminAttendance;
