import { motion } from "framer-motion";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock,
  Copy,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Pencil,
  Shield,
  Trash2,
  UserCircle2,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "./context/AdminProvider";
import { notifyError, notifySuccess } from "./utils/toast";

type Status = "Active" | "Inactive";
type StatusMap = Record<string, Status>;

export type AttendanceRecord = {
  id: string;
  employeeId: string; // for admins: String(admin.id)
  source?: "Desktop" | "Mobile" | string;
  dateISO: string; // YYYY-MM-DD
  timeIn: string | null;
  lunchOut: string | null; // Start Break
  lunchIn: string | null; // End Break
  timeOut: string | null;
};

type AdminSession = { id: number; email: string; name: string; password: string };

type AdminProfileOverride = {
  name?: string;
  email?: string;
  initials?: string;
  photoDataUrl?: string; // base64 data URL
};

type AdminCredentialOverride = {
  email?: string;
  password?: string;
};

const STATUS_KEY = "worktime_account_status_v1";
const ATTENDANCE_KEY = "worktime_attendance_v1";

// profile + credential override stores
const ADMIN_PROFILE_OVERRIDES_KEY = "worktime_admin_overrides_v1";
const ADMIN_CREDENTIAL_OVERRIDES_KEY = "worktime_admin_credentials_v1";

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function readStatusMap(): StatusMap {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as StatusMap) : {};
  } catch {
    return {};
  }
}

function readAttendance(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(ATTENDANCE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AttendanceRecord[]) : [];
  } catch {
    return [];
  }
}

function readProfileOverrides(): Record<string, AdminProfileOverride> {
  try {
    const raw = localStorage.getItem(ADMIN_PROFILE_OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, AdminProfileOverride>)
      : {};
  } catch {
    return {};
  }
}

function writeProfileOverrides(next: Record<string, AdminProfileOverride>) {
  try {
    localStorage.setItem(ADMIN_PROFILE_OVERRIDES_KEY, JSON.stringify(next));
  } catch {}
}

function readCredentialOverrides(): Record<string, AdminCredentialOverride> {
  try {
    const raw = localStorage.getItem(ADMIN_CREDENTIAL_OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, AdminCredentialOverride>)
      : {};
  } catch {
    return {};
  }
}

function writeCredentialOverrides(next: Record<string, AdminCredentialOverride>) {
  try {
    localStorage.setItem(ADMIN_CREDENTIAL_OVERRIDES_KEY, JSON.stringify(next));
  } catch {}
}

function formatTimeLocal(iso: string | null) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "--:--";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function initialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

function InfoTile({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone?: "slate" | "primary" | "secondary" | "success" | "danger";
}) {
  const base = "rounded-2xl border p-4 bg-white";
  const map = {
    slate: "border-slate-200",
    primary: "border-primary/20",
    secondary: "border-secondary/20",
    success: "border-green-200",
    danger: "border-rose-200",
  } as const;

  return (
    <div className={cx(base, map[tone])}>
      <div className="flex items-center gap-2 text-xs font-bold text-text-primary/70">
        <span className="h-8 w-8 rounded-xl bg-soft border border-slate-200 flex items-center justify-center">
          <Icon className="w-4 h-4 text-text-primary/70" />
        </span>
        {label}
      </div>
      <div className="mt-2 text-lg font-extrabold text-text-heading break-words">
        {value}
      </div>
    </div>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="text-sm font-bold text-text-heading">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-primary/70 hover:bg-soft"
            type="button"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function AdminProfile() {
  const navigate = useNavigate();
  const { tasks, leaves } = useAdmin();

  // clock
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [statusMap, setStatusMap] = useState<StatusMap>(() => readStatusMap());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => readAttendance());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATUS_KEY) setStatusMap(readStatusMap());
      if (e.key === ATTENDANCE_KEY) setAttendance(readAttendance());
      if (e.key === "currentAdmin") setCurrentAdminState(readCurrentAdmin());
      if (e.key === ADMIN_PROFILE_OVERRIDES_KEY) setProfileOverrides(readProfileOverrides());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // session
  function readCurrentAdmin() {
    try {
      return JSON.parse(localStorage.getItem("currentAdmin") || "null") as AdminSession | null;
    } catch {
      return null;
    }
  }

  const [currentAdminState, setCurrentAdminState] = useState<AdminSession | null>(() =>
    readCurrentAdmin()
  );

  const currentAdmin = currentAdminState;

  // overrides
  const [profileOverrides, setProfileOverrides] = useState<Record<string, AdminProfileOverride>>(
    () => readProfileOverrides()
  );

  const mergedAdmin = useMemo(() => {
    if (!currentAdmin) return null;
    const ov = profileOverrides[String(currentAdmin.id)] ?? {};
    return {
      ...currentAdmin,
      name: ov.name ?? currentAdmin.name,
      email: ov.email ?? currentAdmin.email,
      initials: ov.initials ?? initialsFromName(ov.name ?? currentAdmin.name),
      photoDataUrl: ov.photoDataUrl ?? "",
    };
  }, [currentAdmin, profileOverrides]);

  const adminStatus: Status | "—" = useMemo(() => {
    if (!currentAdmin) return "—";
    return statusMap[`admin:${currentAdmin.id}`] ?? "Active";
  }, [currentAdmin, statusMap]);

  const adminAttendance = useMemo(() => {
    if (!currentAdmin) return [];
    const id = String(currentAdmin.id);
    return attendance
      .filter((r) => r.employeeId === id)
      .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  }, [attendance, currentAdmin]);

  const todayISO = useMemo(() => {
    const d = now;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, [now]);

  const todayRecord = useMemo(() => {
    if (!currentAdmin) return null;
    return (
      adminAttendance.find((r) => r.dateISO === todayISO) ??
      attendance.find((r) => r.employeeId === String(currentAdmin.id) && r.dateISO === todayISO) ??
      null
    );
  }, [adminAttendance, attendance, currentAdmin, todayISO]);

  const quickStats = useMemo(() => {
    const totalDays = adminAttendance.filter((r) => !!r.timeIn).length;
    const completedDays = adminAttendance.filter((r) => !!r.timeIn && !!r.timeOut).length;
    const incompleteDays = totalDays - completedDays;

    const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "Completed").length;

    return { totalDays, completedDays, incompleteDays, pendingLeaves, totalTasks, completedTasks };
  }, [adminAttendance, leaves, tasks]);

  const copyEmail = async () => {
    if (!mergedAdmin?.email) return;
    try {
      await navigator.clipboard.writeText(mergedAdmin.email);
      notifySuccess("Email copied.");
    } catch {
      notifyError("Failed to copy email.");
    }
  };

  const exportMyAttendance = () => {
    if (!currentAdmin) return;

    try {
      if (!adminAttendance.length) {
        notifyError("No attendance records to export.");
        return;
      }

      const headers = ["Date", "Time In", "Start Break", "End Break", "Time Out", "Device"];
      const rows = adminAttendance.map((r) => [
        r.dateISO,
        formatTimeLocal(r.timeIn),
        formatTimeLocal(r.lunchOut),
        formatTimeLocal(r.lunchIn),
        formatTimeLocal(r.timeOut),
        r.source ?? "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((field) => `"${String(field ?? "").replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `admin_${currentAdmin.id}_attendance.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
      notifySuccess("Attendance exported (CSV).");
    } catch {
      notifyError("Failed to export attendance.");
    }
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("currentAdmin");
    notifySuccess("Logged out successfully.");
    navigate("/admin/login", { replace: true });
  };

  // ------------------- Edit Profile -------------------
  const [editOpen, setEditOpen] = useState(false);

  const [editDraft, setEditDraft] = useState<{
    name: string;
    email: string;
    initials: string;
    photoDataUrl: string;

    // password change fields
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }>({
    name: "",
    email: "",
    initials: "",
    photoDataUrl: "",
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const [showPw, setShowPw] = useState<{ cur: boolean; next: boolean; confirm: boolean }>({
    cur: false,
    next: false,
    confirm: false,
  });

  function openEditProfile() {
    if (!currentAdmin || !mergedAdmin) return;

    setEditDraft({
      name: mergedAdmin.name ?? "",
      email: mergedAdmin.email ?? "",
      initials: (mergedAdmin.initials ?? initialsFromName(mergedAdmin.name ?? "")).toUpperCase(),
      photoDataUrl: mergedAdmin.photoDataUrl ?? "",
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    });

    setShowPw({ cur: false, next: false, confirm: false });
    setEditOpen(true);
  }

  function onPickPhoto(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notifyError("Please select an image file.");
      return;
    }

    // keep it reasonably sized for localStorage
    const maxMB = 2.5;
    if (file.size > maxMB * 1024 * 1024) {
      notifyError(`Image too large. Please use an image under ${maxMB}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!result.startsWith("data:image/")) {
        notifyError("Failed to read image.");
        return;
      }
      setEditDraft((p) => ({ ...p, photoDataUrl: result }));
      notifySuccess("Profile picture selected.");
    };
    reader.onerror = () => notifyError("Failed to read image.");
    reader.readAsDataURL(file);
  }

  function saveProfile() {
    if (!currentAdmin) return;

    const name = editDraft.name.trim();
    const email = editDraft.email.trim();
    const initials = editDraft.initials.trim().toUpperCase();

    if (!name) {
      notifyError("Name is required.");
      return;
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      notifyError("Enter a valid email.");
      return;
    }

    if (initials && initials.length > 4) {
      notifyError("Initials must be 1–4 characters.");
      return;
    }

    // password change validation (optional)
    const wantsPwChange =
      editDraft.currentPassword.trim() ||
      editDraft.newPassword.trim() ||
      editDraft.confirmNewPassword.trim();

    if (wantsPwChange) {
      if (!editDraft.currentPassword.trim()) {
        notifyError("Enter your current password to change it.");
        return;
      }
      if (editDraft.currentPassword !== currentAdmin.password) {
        notifyError("Current password is incorrect.");
        return;
      }
      if (!editDraft.newPassword.trim()) {
        notifyError("New password is required.");
        return;
      }
      if (editDraft.newPassword.length < 6) {
        notifyError("New password must be at least 6 characters.");
        return;
      }
      if (editDraft.newPassword !== editDraft.confirmNewPassword) {
        notifyError("New passwords do not match.");
        return;
      }
    }

    // ---- save profile overrides ----
    const idKey = String(currentAdmin.id);
    const nextProfiles = { ...profileOverrides };
    nextProfiles[idKey] = {
      ...(nextProfiles[idKey] ?? {}),
      name,
      email,
      initials: initials || initialsFromName(name),
      photoDataUrl: editDraft.photoDataUrl || "",
    };
    writeProfileOverrides(nextProfiles);
    setProfileOverrides(nextProfiles);

    // ---- update current session admin (so UI updates immediately) ----
    const updatedSession: AdminSession = {
      ...currentAdmin,
      name,
      email,
      password: wantsPwChange ? editDraft.newPassword : currentAdmin.password,
    };
    try {
      localStorage.setItem("currentAdmin", JSON.stringify(updatedSession));
      localStorage.setItem("admin_email", updatedSession.email);
      setCurrentAdminState(updatedSession);
    } catch {
      notifyError("Failed to update session.");
      return;
    }

    // ---- save credential overrides for login (future-proof) ----
    // NOTE: AdminLogin.tsx must be updated to use this map first for it to take effect after logout.
    if (wantsPwChange || email !== currentAdmin.email) {
      const credMap = readCredentialOverrides();
      credMap[idKey] = {
        ...(credMap[idKey] ?? {}),
        email,
        ...(wantsPwChange ? { password: editDraft.newPassword } : {}),
      };
      writeCredentialOverrides(credMap);
    }

    setEditOpen(false);
    notifySuccess("Profile updated.");
  }

  if (!currentAdmin || !mergedAdmin) {
    return (
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="text-lg font-bold text-text-heading">Admin Profile</div>
        <div className="mt-1 text-sm text-text-primary/70">
          No admin session found. Please log in again.
        </div>
        <button
          onClick={() => navigate("/admin/login", { replace: true })}
          className="mt-4 px-4 py-2 rounded-xl bg-primary text-white font-semibold"
          type="button"
        >
          Go to Admin Login
        </button>
      </div>
    );
  }

  const avatar = (
    <div className="relative">
      <div className="h-11 w-11 rounded-2xl overflow-hidden border border-slate-200 bg-soft flex items-center justify-center">
        {mergedAdmin.photoDataUrl ? (
          <img
            src={mergedAdmin.photoDataUrl}
            alt="Admin profile"
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : mergedAdmin.initials ? (
          <div className="h-full w-full flex items-center justify-center bg-primary/10">
            <span className="text-primary font-extrabold">
              {mergedAdmin.initials}
            </span>
          </div>
        ) : (
          <UserCircle2 className="w-5 h-5 text-text-primary/70" />
        )}
      </div>
      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
        <Pencil className="h-3 w-3 text-text-primary/60" />
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {avatar}
            <div className="min-w-0">
              <div className="text-2xl font-bold text-text-heading truncate">
                Admin Profile
              </div>
              <div className="text-sm text-text-primary/70 truncate">
                Manage your session and view your admin activity
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-text-primary/70">
            Signed in as{" "}
            <span className="font-semibold text-text-heading">
              {mergedAdmin.name}
            </span>{" "}
            • Status:{" "}
            <span
              className={cx(
                "font-semibold",
                adminStatus === "Active" ? "text-green-700" : "text-rose-700"
              )}
            >
              {adminStatus}
            </span>
          </div>
        </div>

        {/* Right actions: Edit Profile + Clock */}
        <div className="flex items-center gap-3">
          <button
            onClick={openEditProfile}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold bg-white border border-slate-200 text-text-heading hover:bg-soft transition"
            type="button"
          >
            <Pencil className="w-4 h-4" />
            Edit Profile
          </button>

          <div className="bg-primary text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="tabular-nums">
              {now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Profile cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <InfoTile icon={Shield} label="Role" value="Admin" tone="secondary" />
        <InfoTile icon={Mail} label="Email" value={mergedAdmin.email} tone="primary" />
        <InfoTile icon={KeyRound} label="Admin ID" value={mergedAdmin.id} tone="slate" />
      </div>

      {/* Actions */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-text-heading">Quick Actions</div>
            <div className="text-xs text-text-primary/70">
              Frontend demo actions (safe for now, backend later)
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={copyEmail}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-white border border-slate-200 text-text-heading hover:bg-soft transition"
              type="button"
            >
              <Copy className="w-4 h-4" />
              Copy Email
            </button>

            <button
              onClick={exportMyAttendance}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-white border border-slate-200 text-text-heading hover:bg-soft transition"
              type="button"
            >
              <Download className="w-4 h-4" />
              Export Attendance
            </button>

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition"
              type="button"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Activity snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-text-primary/70" />
            <div className="text-sm font-semibold text-text-heading">Snapshot</div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-soft border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Attendance Days</div>
              <div className="mt-1 text-2xl font-extrabold text-text-heading tabular-nums">
                {quickStats.totalDays}
              </div>
            </div>

            <div className="rounded-xl bg-soft border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Completed Days</div>
              <div className="mt-1 text-2xl font-extrabold text-text-heading tabular-nums">
                {quickStats.completedDays}
              </div>
            </div>

            <div className="rounded-xl bg-soft border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Tasks</div>
              <div className="mt-1 text-2xl font-extrabold text-text-heading tabular-nums">
                {quickStats.completedTasks}/{quickStats.totalTasks}
              </div>
            </div>

            <div className="rounded-xl bg-soft border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Pending Leaves</div>
              <div className="mt-1 text-2xl font-extrabold text-text-heading tabular-nums">
                {quickStats.pendingLeaves}
              </div>
            </div>
          </div>
        </div>

        {/* Today's attendance */}
        <div className="bg-card rounded-2xl shadow-sm border border-slate-200 p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-text-primary/70" />
              <div>
                <div className="text-sm font-semibold text-text-heading">Today’s Attendance</div>
                <div className="text-xs text-text-primary/70">{todayISO}</div>
              </div>
            </div>

            <div
              className={cx(
                "px-3 py-1 rounded-full text-xs font-bold border",
                todayRecord?.timeIn && !todayRecord?.timeOut
                  ? "bg-green-50 text-green-700 border-green-200"
                  : todayRecord?.timeOut
                  ? "bg-soft text-text-heading border-slate-200"
                  : "bg-slate-50 text-text-primary/70 border-slate-200"
              )}
            >
              {todayRecord?.timeIn ? (todayRecord.timeOut ? "Completed" : "In Progress") : "No Record"}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Time In</div>
              <div className="mt-1 font-extrabold text-green-700 tabular-nums">
                {formatTimeLocal(todayRecord?.timeIn ?? null)}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Start Break</div>
              <div className="mt-1 font-extrabold text-amber-700 tabular-nums">
                {formatTimeLocal(todayRecord?.lunchOut ?? null)}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">End Break</div>
              <div className="mt-1 font-extrabold text-blue-700 tabular-nums">
                {formatTimeLocal(todayRecord?.lunchIn ?? null)}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <div className="text-[11px] font-bold text-text-primary/70">Time Out</div>
              <div className="mt-1 font-extrabold text-rose-700 tabular-nums">
                {formatTimeLocal(todayRecord?.timeOut ?? null)}
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="text-sm font-semibold text-text-heading">Recent Attendance</div>
            <div className="mt-2 grid gap-2">
              {adminAttendance.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text-heading">{r.dateISO}</div>
                    <div className="text-xs text-text-primary/70">
                      In {formatTimeLocal(r.timeIn)} • Out {formatTimeLocal(r.timeOut)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.timeOut ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                        <CheckCircle2 className="w-4 h-4" /> Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                        <CircleDashed className="w-4 h-4" /> Open
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {adminAttendance.length === 0 && (
                <div className="text-sm text-text-primary/70">No attendance records yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      <Modal
        open={editOpen}
        title={`Edit Profile • Admin #${mergedAdmin.id}`}
        onClose={() => setEditOpen(false)}
      >
        <div className="space-y-6">
          {/* Avatar section */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
                  {editDraft.photoDataUrl ? (
                    <img
                      src={editDraft.photoDataUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : editDraft.initials ? (
                    <div className="h-full w-full flex items-center justify-center bg-primary/10">
                      <span className="text-primary font-extrabold text-lg">
                        {editDraft.initials.toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <UserCircle2 className="w-7 h-7 text-text-primary/50" />
                  )}
                </div>

                <div>
                  <div className="text-sm font-bold text-text-heading">Profile Picture</div>
                  <div className="text-xs text-text-primary/70">
                    Upload an image or use initials as fallback
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-white border border-slate-200 text-text-heading hover:bg-soft transition cursor-pointer">
                  <ImageIcon className="w-4 h-4" />
                  Choose Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setEditDraft((p) => ({ ...p, photoDataUrl: "" }))}
                  disabled={!editDraft.photoDataUrl}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-white border border-slate-200 text-text-heading hover:bg-soft transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Display Name</label>
                <input
                  value={editDraft.name}
                  onChange={(e) =>
                    setEditDraft((p) => ({
                      ...p,
                      name: e.target.value,
                      initials: p.initials || initialsFromName(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Admin name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Avatar Initials</label>
                <input
                  value={editDraft.initials}
                  onChange={(e) =>
                    setEditDraft((p) => ({
                      ...p,
                      initials: e.target.value.toUpperCase().slice(0, 4),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. AC"
                />
                <div className="text-[11px] text-slate-500 font-semibold">
                  1–4 chars. Used if no photo.
                </div>
              </div>

              <div className="space-y-1 sm:col-span-3">
                <label className="text-xs font-semibold text-slate-600">Email</label>
                <input
                  value={editDraft.email}
                  onChange={(e) => setEditDraft((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="admin@example.com"
                />
              </div>
            </div>
          </div>

          {/* Password section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="h-9 w-9 rounded-xl bg-soft border border-slate-200 flex items-center justify-center">
                <Lock className="w-4 h-4 text-text-primary/60" />
              </span>
              <div>
                <div className="text-sm font-bold text-text-heading">Change Password</div>
                <div className="text-xs text-text-primary/70">
                  Optional. Fill all fields to update.
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {/* Current */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Current</label>
                <div className="relative">
                  <input
                    type={showPw.cur ? "text" : "password"}
                    value={editDraft.currentPassword}
                    onChange={(e) =>
                      setEditDraft((p) => ({ ...p, currentPassword: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => ({ ...p, cur: !p.cur }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    aria-label={showPw.cur ? "Hide password" : "Show password"}
                  >
                    {showPw.cur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">New</label>
                <div className="relative">
                  <input
                    type={showPw.next ? "text" : "password"}
                    value={editDraft.newPassword}
                    onChange={(e) =>
                      setEditDraft((p) => ({ ...p, newPassword: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Min 6 chars"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => ({ ...p, next: !p.next }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    aria-label={showPw.next ? "Hide password" : "Show password"}
                  >
                    {showPw.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Confirm</label>
                <div className="relative">
                  <input
                    type={showPw.confirm ? "text" : "password"}
                    value={editDraft.confirmNewPassword}
                    onChange={(e) =>
                      setEditDraft((p) => ({ ...p, confirmNewPassword: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Repeat new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => ({ ...p, confirm: !p.confirm }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    aria-label={showPw.confirm ? "Hide password" : "Show password"}
                  >
                    {showPw.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-slate-500 font-semibold">
              Note: For password changes to work after logout, update AdminLogin to read
              <span className="font-bold"> {ADMIN_CREDENTIAL_OVERRIDES_KEY}</span>.
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setEditOpen(false)}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold border border-slate-200 bg-white text-text-heading hover:bg-soft transition"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={saveProfile}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-primary text-white hover:opacity-95 transition"
              type="button"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}