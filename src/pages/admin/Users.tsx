import { useAdmin } from "./AdminContext";
import AdminTable from "./components/AdminTable";

const AdminUsers = () => {
  const { users, setUsers } = useAdmin();

  const toggleStatus = (id:number) => {
    setUsers(users.map(u=>u.id===id?{...u,status:u.status==="Active"?"Inactive":"Active"}:u));
  };

  return (
    <AdminTable headers={["Name","Role","Status","Actions"]}>
      {users.map(u=>(
        <tr key={u.id} className="border-b">
          <td className="px-4 py-2">{u.name}</td>
          <td className="px-4 py-2">{u.role}</td>
          <td className="px-4 py-2">{u.status}</td>
          <td className="px-4 py-2">
            <button className="bg-yellow-500 text-white px-2 py-1 rounded" onClick={()=>toggleStatus(u.id)}>
              {u.status==="Active"?"Deactivate":"Activate"}
            </button>
          </td>
        </tr>
      ))}
    </AdminTable>
  );
};

export default AdminUsers;
