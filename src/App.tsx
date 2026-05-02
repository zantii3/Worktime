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

// ROUTE GUARDS
import { AdminProtectedRoute, UserProtectedRoute } from "./pages/components/ProtectedRoute";

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
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6 flex gap-2">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            Go to User Login
          </a>
          <a
            href="/admin/login"
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
          >
            Go to Admin Login
          </a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AdminProvider>
      <Routes>
        {/* ── Public: User ─────────────────────────────────────────────── */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* ── Protected: User ──────────────────────────────────────────── */}
        <Route path="/dashboard" element={<UserProtectedRoute><UserDashboard /></UserProtectedRoute>} />
        <Route path="/attendance" element={<UserProtectedRoute><Attendance /></UserProtectedRoute>} />
        <Route path="/leave" element={<UserProtectedRoute><Leave /></UserProtectedRoute>} />
        <Route path="/tasks" element={<UserProtectedRoute><Tasks /></UserProtectedRoute>} />
        <Route path="/project" element={<UserProtectedRoute><Project /></UserProtectedRoute>} />
        <Route path="/profile" element={<UserProtectedRoute><Profile /></UserProtectedRoute>} />

        {/* ── Public: Admin ────────────────────────────────────────────── */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />

        {/* ── Protected: Admin ─────────────────────────────────────────── */}
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout><AdminDashboard /></AdminLayout>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/profile"
          element={
            <AdminProtectedRoute>
              <AdminLayout><AdminProfile /></AdminLayout>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/attendance"
          element={
            <AdminProtectedRoute>
              <AdminLayout><AdminAttendance /></AdminLayout>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/leave"
          element={
            <AdminProtectedRoute>
              <AdminLayout><AdminLeave /></AdminLayout>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/project-management"
          element={
            <AdminProtectedRoute>
              <AdminLayout><AdminProjectManagement /></AdminLayout>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/project-list"
          element={
            <AdminProtectedRoute>
              <AdminLayout><AdminProjectList /></AdminLayout>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminProtectedRoute>
              <AdminLayout><AdminUsers /></AdminLayout>
            </AdminProtectedRoute>
          }
        />

        {/* ── Fallbacks ────────────────────────────────────────────────── */}
        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      <ToastContainer position="top-right" autoClose={2000} />
    </AdminProvider>
  );
}