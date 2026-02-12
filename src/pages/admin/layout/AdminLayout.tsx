import { type ReactNode } from "react";
import AdminSidebar from "../components/AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
