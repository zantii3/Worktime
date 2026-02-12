import { type ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
}

export default function AdminCard({ title, children }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      {title && (
        <h2 className="text-md font-semibold text-slate-700 mb-4">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
