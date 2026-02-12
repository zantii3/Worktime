import AdminTable from "./components/AdminTable";
import { useAdmin } from "./context/AdminProvider";
import { notifySuccess } from "./utils/toast";

export default function Users() {
  const { users, setUsers } = useAdmin();

  const toggle = (id: number) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === "Active" ? "Inactive" : "Active" } : u
      )
    );
    notifySuccess("User status updated.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">User Management</h1>
        <p className="text-sm text-slate-500">Activate/deactivate accounts.</p>
      </div>

      <AdminTable headers={["Name", "Role", "Status", "Actions"]}>
        {users.map((u) => (
          <tr key={u.id}>
            <td className="px-4 py-3">{u.name}</td>
            <td className="px-4 py-3">{u.role}</td>
            <td className="px-4 py-3">{u.status}</td>
            <td className="px-4 py-3">
              <button onClick={() => toggle(u.id)} className="text-sm text-indigo-700 hover:underline">
                {u.status === "Active" ? "Deactivate" : "Activate"}
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
