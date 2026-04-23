import { Navigate, Route, Routes } from "react-router-dom";

// USER PAGES

import Attendance from "./pages/user/Attendance";
import UserDashboard from "./pages/user/Dashboard";
import ForgotPassword from "./pages/user/ForgotPassword";
import Leave from "./pages/user/Leave";
import Profile from "./pages/user/Profile";
import Tasks from "./pages/user/Tasks";
import Project from "./pages/user/Project";
import Login from "./pages/user/index";

// ADMIN PAGES
import AdminProfile from "./pages/admin/AdminProfile";
import AdminDashboard from "./pages/admin/Admindashboard";
import AdminAttendance from "./pages/admin/Attendance";
import AdminForgotPassword from "./pages/admin/ForgotPassword";
import AdminLeave from "./pages/admin/Leave";
import AdminLogin from "./pages/admin/Login";
import AdminProjectManagement from "./pages/admin/ProjectManagement";
import AdminProjectList from "./pages/admin/ProjectList";
import AdminUsers from "./pages/admin/Users";
import AdminLayout from "./pages/admin/layout/AdminLayout";


// STATE + TOASTS
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AdminProvider } from "./pages/admin/context/AdminProvider";

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-md w-full">
        <h1 className="text-xl font-semibold text-slate-800">Page not found</h1>
        <p className="text-sm text-slate-500 mt-2">
          The page you’re looking for doesn’t exist.
        </p>

        <div className="mt-6 flex gap-2">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            Go to User Dashboard
          </a>
          <a
            href="/admin"
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
          >
            Go to Admin
          </a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AdminProvider>
      {/* Temporary health route for debugging: open /__health to confirm app mounts */}
      <Routes>
        <Route
          path="/__health"
          element={
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <h1 className="text-xl font-semibold text-slate-800">App mounted</h1>
            </div>
          }
        />
      </Routes>
      <Routes>
        {/* ================= USER ROUTES ================= */}
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/leave" element={<Leave />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/project" element={<Project />}/>
        <Route path="/profile" element={<Profile />} />
        

        {/* OPTIONAL: if user Tasks page exists later, add it back */}
        {/* <Route path="/tasks" element={<Tasks />} /> */}

        {/* ================= ADMIN ROUTES ================= */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
        

        <Route
          path="/admin/profile" 
          element={
          <AdminLayout>
            <AdminProfile />
          </AdminLayout>
          }
        
        />
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
          path="/admin/project-management"
          element={
            <AdminLayout>
              <AdminProjectManagement />
            </AdminLayout>
          }  
        />

        <Route
          path="/admin/project-list"
          element={
            <AdminLayout>
              <AdminProjectList />
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

        {/* Optional: redirect /admin/* unknown paths to /admin */}
        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

        {/* Global fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Global Notifications (ONLY ONCE) */}
      <ToastContainer position="top-right" autoClose={2000} />
    </AdminProvider>
  );
}