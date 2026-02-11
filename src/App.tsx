import { Routes, Route } from "react-router-dom";

// USER PAGES
import Index from "./pages/user/index";
import Dashboard from "./pages/user/Dashboard";
import Attendance from "./pages/user/Attendance";
import Leave from "./pages/user/Leave";

// ADMIN PAGES
import AdminDashboard from "./pages/admin/Dashboard";
import AdminAttendance from "./pages/admin/Attendance";
import AdminLeave from "./pages/admin/Leave";
import AdminTasks from "./pages/admin/Tasks";
import AdminUsers from "./pages/admin/Users";

import AdminSidebar from "./pages/admin/components/AdminSidebar";
import { AdminProvider } from "./pages/admin/AdminContext";

function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <div className="min-h-screen flex">
        <AdminSidebar />
        <main className="flex-1 p-6 bg-slate-100">{children}</main>
      </div>
    </AdminProvider>
  );
}

export default function App() {
  return (
    <Routes>
      {/* USER ROUTES */}
      <Route path="/" element={<Index />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/attendance" element={<Attendance />} />
      <Route path="/leave" element={<Leave />} />

      {/* ADMIN ROUTES */}
      <Route
        path="/admin"
        element={
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/attendance"
        element={
          <AdminLayout>
            <AdminAttendance />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/leave"
        element={
          <AdminLayout>
            <AdminLeave />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/tasks"
        element={
          <AdminLayout>
            <AdminTasks />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminLayout>
            <AdminUsers />
          </AdminLayout>
        }
      />
    </Routes>
  );
}
