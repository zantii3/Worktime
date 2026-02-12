import { type ReactNode } from "react";

interface Props {
  headers: string[];
  children: ReactNode;
}

export default function AdminTable({ headers, children }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {headers.map((header) => (
              <th
                key={header}
                className="px-4 py-3 font-medium text-slate-600"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {children}
        </tbody>
      </table>
    </div>
  );
}
