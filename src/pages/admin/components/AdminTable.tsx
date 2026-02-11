import React from "react";

interface AdminTableProps {
  headers: string[];
  children: React.ReactNode;
}

const AdminTable: React.FC<AdminTableProps> = ({ headers, children }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white shadow rounded-lg overflow-hidden">
        <thead className="bg-gray-200">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">{children}</tbody>
      </table>
    </div>
  );
};

export default AdminTable;
