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
  ImagePlus,
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
import { STORAGE_KEY as LEAVE_STORAGE_KEY } from "../user/types/leaveconstants";
import { notifyError, notifySuccess } from "./utils/toast";

type Status = "Active" | "Inactive";
type StatusMap = Record<string, Status>;

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  source?: "Desktop" | "Mobile" | string;
  dateISO: string;
  timeIn: string | null;
  lunchOut: string | null;
  lunchIn: string | null;
  timeOut: string | null;
};

type TaskStatus = "Pending" | "In Progress" | "Completed";

type TaskRecord = {
  id: number;
  title: string;
  description: string;
  assignedTo: string;
  priority: "Low" | "Medium" | "High";
  status: TaskStatus;
};

type LeaveStatus = "Pending" | "Approved" | "Rejected";

type LeaveRecord = {
  id: number;
  employee: string;
  type: string;
  reason: string;
  status: LeaveStatus;
  dateFrom?: string;
  dateTo?: string;
  startDate?: string;
  endDate?: string;
  attachmentName?: string | null;
  fileName?: string;
  appliedOn?: string;
  date?: string;
  days?: number;
};

type CurrentAdmin = {
  id: number;
  email: string;
  name: string;
};

type StoredAdminProfile = {
  displayName?: string;
  email?: string;
  initials?: string;
  photo?: string;
};

type StoredAdminCredentials = {
  email: string;
  password: string;
};

const STATUS_KEY = "worktime_account_status_v1";
const ATTENDANCE_KEY = "worktime_attendance_v1";
const TASKS_KEY = "worktime_tasks_v1";
const CURRENT_ADMIN_KEY = "currentAdmin";
const ADMIN_EMAIL_KEY = "admin_email";
const ADMIN_CREDENTIALS_KEY = "worktime_admin_credentials_v1";

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readStatusMap(): StatusMap {
  const parsed = readJSON<unknown>(STATUS_KEY, {});
  return parsed && typeof parsed === "object" ? (parsed as StatusMap) : {};
}

function readAttendance(): AttendanceRecord[] {
  const parsed = readJSON<unknown>(ATTENDANCE_KEY, []);
  return Array.isArray(parsed) ? (parsed as AttendanceRecord[]) : [];
}

function readTasks(): TaskRecord[] {
  const parsed = readJSON<unknown>(TASKS_KEY, []);
  return Array.isArray(parsed) ? (parsed as TaskRecord[]) : [];
}

function readLeaves(): LeaveRecord[] {
  const parsed = readJSON<unknown>(LEAVE_STORAGE_KEY, []);
  return Array.isArray(parsed) ? (parsed as LeaveRecord[]) : [];
}

function readCurrentAdmin(): CurrentAdmin | null {
  return readJSON<CurrentAdmin | null>(CURRENT_ADMIN_KEY, null);
}

function readStoredProfile(adminId: number | null | undefined): StoredAdminProfile | null {
  if (!adminId) return null;
  return readJSON<StoredAdminProfile | null>(`admin_profile_${adminId}`, null);
}

function readStoredCredentials(): StoredAdminCredentials | null {
  return readJSON<StoredAdminCredentials | null>(ADMIN_CREDENTIALS_KEY, null);
}

function formatTimeLocal(iso: string | null) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "--:--";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function minutesBetween(aISO: string | null, bISO: string | null) {
  if (!aISO || !bISO) return 0;
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 60000));
}

function computeWorkMinutes(record: AttendanceRecord) {
  const gross = minutesBetween(record.timeIn, record.timeOut);
  const breakMinutes = minutesBetween(record.lunchOut, record.lunchIn);
  return Math.max(0, gross - breakMinutes);
}

function formatHoursFromMinutes(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function computeOvertimeMinutes(record: AttendanceRecord) {
  const workMinutes = computeWorkMinutes(record);
  const regularLimit = 8 * 60;
  return Math.max(0, workMinutes - regularLimit);
}

function isoToLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function localInputToISO(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
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
      <div className="mt-2 text-lg font-extrabold text-text-heading break-words">{value}</div>
    </div>
  );
}

export default function AdminProfile() {
  const navigate = useNavigate();

  const [now, setNow] = useState<Date>(new Date());

  const [statusMap, setStatusMap] = useState<StatusMap>(() => readStatusMap());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => readAttendance());
  const [localLeaves, setLocalLeaves] = useState<LeaveRecord[]>(() => readLeaves());
  const [localTasks, setLocalTasks] = useState<TaskRecord[]>(() => readTasks());
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(() => readCurrentAdmin());
  const [storedProfile, setStoredProfile] = useState<StoredAdminProfile | null>(() =>
    readStoredProfile(readCurrentAdmin()?.id)
  );

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const refreshFromStorage = () => {
      const nextAdmin = readCurrentAdmin();
      setStatusMap(readStatusMap());
      setAttendance(readAttendance());
      setLocalLeaves(readLeaves());
      setLocalTasks(readTasks());
      setCurrentAdmin(nextAdmin);
      setStoredProfile(readStoredProfile(nextAdmin?.id));
    };

    const onStorage = (e: StorageEvent) => {
      if (
        e.key === STATUS_KEY ||
        e.key === ATTENDANCE_KEY ||
        e.key === LEAVE_STORAGE_KEY ||
        e.key === TASKS_KEY ||
        e.key === CURRENT_ADMIN_KEY ||
        (currentAdmin?.id && e.key === `admin_profile_${currentAdmin.id}`)
      ) {
        refreshFromStorage();
      }
    };

    const onFocus = () => refreshFromStorage();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshFromStorage();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [currentAdmin?.id]);

  useEffect(() => {
    setStoredProfile(readStoredProfile(currentAdmin?.id));
  }, [currentAdmin]);

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

  const pendingLeaves = useMemo(() => {
  return localLeaves.filter((leave) => leave.status === "Pending");
}, [localLeaves]);

const allTasks = useMemo(() => {
  return localTasks;
}, [localTasks]);

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

  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.status === "Completed").length;
  const pendingLeavesCount = pendingLeaves.length;

  return {
    totalDays,
    completedDays,
    incompleteDays,
    pendingLeaves: pendingLeavesCount,
    totalTasks,
    completedTasks,
  };
}, [adminAttendance, allTasks, pendingLeaves]);

  const [editOpen, setEditOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    timeIn: "",
    lunchOut: "",
    lunchIn: "",
    timeOut: "",
    source: "",
  });

  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileForm, setProfileForm] = useState({
    displayName: "",
    email: "",
    initials: "",
    photo: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (!currentAdmin) return;

    const displayName = storedProfile?.displayName || currentAdmin.name || "";
    setProfileForm({
      displayName,
      email: storedProfile?.email || currentAdmin.email || "",
      initials:
        storedProfile?.initials ||
        (displayName || "A")
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 4)
          .toUpperCase(),
      photo: storedProfile?.photo || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  }, [currentAdmin, storedProfile]);

  const displayName = storedProfile?.displayName || currentAdmin?.name || "Admin";
  const displayEmail = storedProfile?.email || currentAdmin?.email || "";
  const displayInitials =
    storedProfile?.initials ||
    (displayName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 4)
      .toUpperCase() || "A");
  const displayPhoto = storedProfile?.photo || "";

  const copyEmail = async () => {
    if (!displayEmail) return;
    try {
      await navigator.clipboard.writeText(displayEmail);
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

      const headers = [
        "Date",
        "Time In",
        "Start Break",
        "End Break",
        "Time Out",
        "Device",
        "Work Hours",
        "Overtime",
      ];

      const rows = adminAttendance.map((r) => {
        const workMinutes = computeWorkMinutes(r);
        const overtimeMinutes = computeOvertimeMinutes(r);

        return [
          r.dateISO,
          formatTimeLocal(r.timeIn),
          formatTimeLocal(r.lunchOut),
          formatTimeLocal(r.lunchIn),
          formatTimeLocal(r.timeOut),
          r.source ?? "",
          formatHoursFromMinutes(workMinutes),
          formatHoursFromMinutes(overtimeMinutes),
        ];
      });

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

  const openEditModal = (record: AttendanceRecord) => {
    setEditingRecordId(record.id);
    setEditDraft({
      timeIn: isoToLocalInput(record.timeIn),
      lunchOut: isoToLocalInput(record.lunchOut),
      lunchIn: isoToLocalInput(record.lunchIn),
      timeOut: isoToLocalInput(record.timeOut),
      source: record.source ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!editingRecordId) return;

    const updated = attendance.map((record) =>
      record.id === editingRecordId
        ? {
            ...record,
            timeIn: localInputToISO(editDraft.timeIn),
            lunchOut: localInputToISO(editDraft.lunchOut),
            lunchIn: localInputToISO(editDraft.lunchIn),
            timeOut: localInputToISO(editDraft.timeOut),
            source: editDraft.source || record.source,
          }
        : record
    );

    setAttendance(updated);
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(updated));
    notifySuccess("Attendance log updated.");
    setEditOpen(false);
    setEditingRecordId(null);
  };

  const closeEditModal = () => {
    setEditOpen(false);
    setEditingRecordId(null);
  };

  const openProfileEditModal = () => {
    setProfileForm({
      displayName,
      email: displayEmail,
      initials: displayInitials,
      photo: displayPhoto,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setProfileEditOpen(true);
  };

  const closeProfileEditModal = () => {
    setProfileEditOpen(false);
  };

  const saveProfileChanges = () => {
    if (!currentAdmin) return;

    const nextDisplayName = profileForm.displayName.trim();
    const nextEmail = profileForm.email.trim();
    const nextInitials = profileForm.initials.trim().slice(0, 4).toUpperCase();

    if (!nextDisplayName) {
      notifyError("Display name is required.");
      return;
    }

    if (!nextEmail) {
      notifyError("Email is required.");
      return;
    }

    const credentials = readStoredCredentials();

    if (
      profileForm.newPassword ||
      profileForm.confirmPassword ||
      profileForm.currentPassword
    ) {
      if (!profileForm.currentPassword) {
        notifyError("Please enter your current password.");
        return;
      }

      if (credentials?.password && profileForm.currentPassword !== credentials.password) {
        notifyError("Current password is incorrect.");
        return;
      }

      if (profileForm.newPassword.length < 6) {
        notifyError("New password must be at least 6 characters.");
        return;
      }

      if (profileForm.newPassword !== profileForm.confirmPassword) {
        notifyError("New password and confirm password do not match.");
        return;
      }
    }

    const updatedAdmin: CurrentAdmin = {
      ...currentAdmin,
      name: nextDisplayName,
      email: nextEmail,
    };

    const updatedProfile: StoredAdminProfile = {
      displayName: nextDisplayName,
      email: nextEmail,
      initials: nextInitials || nextDisplayName.slice(0, 2).toUpperCase(),
      photo: profileForm.photo || "",
    };

    localStorage.setItem(CURRENT_ADMIN_KEY, JSON.stringify(updatedAdmin));
    localStorage.setItem(ADMIN_EMAIL_KEY, updatedAdmin.email);
    localStorage.setItem(`admin_profile_${currentAdmin.id}`, JSON.stringify(updatedProfile));

    if (profileForm.newPassword) {
      localStorage.setItem(
        ADMIN_CREDENTIALS_KEY,
        JSON.stringify({
          email: nextEmail,
          password: profileForm.newPassword,
        })
      );
    }

    setCurrentAdmin(updatedAdmin);
    setStoredProfile(updatedProfile);

    notifySuccess("Profile updated.");
    setProfileEditOpen(false);
  };

  const removeProfilePhoto = () => {
    setProfileForm((prev) => ({ ...prev, photo: "" }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((prev) => ({
        ...prev,
        photo: typeof reader.result === "string" ? reader.result : "",
      }));
    };
    reader.readAsDataURL(file);
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem(ADMIN_EMAIL_KEY);
    localStorage.removeItem(CURRENT_ADMIN_KEY);
    notifySuccess("Logged out successfully.");
    navigate("/admin/login", { replace: true });
  };

  if (!currentAdmin) {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
              {displayPhoto ? (
                <img
                  src={displayPhoto}
                  alt="Admin Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserCircle2 className="w-5 h-5 text-primary" />
              )}
            </span>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-text-heading truncate">Admin Profile</div>
              <div className="text-sm text-text-primary/70 truncate">
                Manage your session and view your admin activity
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-text-primary/70">
            Signed in as{" "}
            <span className="font-semibold text-text-heading">{displayName}</span> • Status:{" "}
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

        <div className="flex items-center gap-3">
          <button
            onClick={openProfileEditModal}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition"
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <InfoTile icon={Shield} label="Role" value="Admin" tone="secondary" />
        <InfoTile icon={Mail} label="Email" value={displayEmail} tone="primary" />
        <InfoTile icon={KeyRound} label="Admin ID" value={currentAdmin.id} tone="slate" />
      </div>

      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-text-heading">Quick Actions</div>
            <div className="text-xs text-text-primary/70">
              Frontend demo actions synced with local storage
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
                    <div className="text-[11px] text-text-primary/60 mt-1">
                      Work: {formatHoursFromMinutes(computeWorkMinutes(r))} hrs • Overtime:{" "}
                      {formatHoursFromMinutes(computeOvertimeMinutes(r))} hrs
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {r.timeOut ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                        <CheckCircle2 className="w-4 h-4" /> Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                        <CircleDashed className="w-4 h-4" /> Open
                      </span>
                    )}

                    <button
                      onClick={() => openEditModal(r)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-text-heading hover:bg-soft transition"
                      type="button"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
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

      {profileEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
              <div>
                <h3 className="text-2xl font-bold text-text-heading">
                  Edit Profile • Admin #{currentAdmin.id}
                </h3>
              </div>

              <button
                onClick={closeProfileEditModal}
                className="rounded-lg p-2 hover:bg-soft transition"
                type="button"
              >
                <X className="w-5 h-5 text-text-primary/70" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
                <div className="flex flex-col md:flex-row md:items-start gap-5">
                  <div className="h-16 w-16 rounded-2xl bg-slate-200 flex items-center justify-center overflow-hidden">
                    {profileForm.photo ? (
                      <img
                        src={profileForm.photo}
                        alt="Profile Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-bold text-primary">
                        {profileForm.initials || "AO"}
                      </span>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="text-xl font-bold text-text-heading">Profile Picture</div>
                    <div className="text-sm text-text-primary/60">
                      Upload an image or use initials as fallback
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition cursor-pointer">
                        <ImagePlus className="w-4 h-4" />
                        Choose Photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoChange}
                        />
                      </label>

                      <button
                        onClick={removeProfilePhoto}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-400 hover:bg-soft transition"
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-text-heading mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={profileForm.displayName}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          displayName: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-text-heading mb-1">
                      Avatar Initials
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={profileForm.initials}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          initials: e.target.value.toUpperCase(),
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <p className="mt-1 text-xs text-text-primary/60">1–4 chars. Used if no photo.</p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-semibold text-text-heading mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-slate-200 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-text-primary/70" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-text-heading">Change Password</div>
                    <div className="text-sm text-text-primary/60">
                      Optional. Fill all fields to update.
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-heading mb-1">
                      Current
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={profileForm.currentPassword}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            currentPassword: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-primary/60"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-text-heading mb-1">
                      New
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={profileForm.newPassword}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            newPassword: e.target.value,
                          }))
                        }
                        placeholder="Min 6 chars"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-primary/60"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-text-heading mb-1">
                      Confirm
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={profileForm.confirmPassword}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                        placeholder="Repeat new password"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-primary/60"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs text-text-primary/60 font-medium">
                  Note: Admin login should read
                  <span className="font-bold"> worktime_admin_credentials_v1</span> if you want
                  password updates to persist after logout.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={closeProfileEditModal}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-text-heading hover:bg-soft transition"
                  type="button"
                >
                  Cancel
                </button>

                <button
                  onClick={saveProfileChanges}
                  className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:opacity-95 transition"
                  type="button"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-text-heading">Edit Daily Log</h3>
                <p className="text-sm text-text-primary/70">
                  Update the selected attendance record
                </p>
              </div>

              <button
                onClick={closeEditModal}
                className="rounded-lg p-2 hover:bg-soft transition"
                type="button"
              >
                <X className="w-4 h-4 text-text-primary/70" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-heading mb-1">
                    Time In
                  </label>
                  <input
                    type="datetime-local"
                    value={editDraft.timeIn}
                    onChange={(e) =>
                      setEditDraft((prev) => ({ ...prev, timeIn: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-heading mb-1">
                    Start Break
                  </label>
                  <input
                    type="datetime-local"
                    value={editDraft.lunchOut}
                    onChange={(e) =>
                      setEditDraft((prev) => ({ ...prev, lunchOut: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-heading mb-1">
                    End Break
                  </label>
                  <input
                    type="datetime-local"
                    value={editDraft.lunchIn}
                    onChange={(e) =>
                      setEditDraft((prev) => ({ ...prev, lunchIn: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-heading mb-1">
                    Time Out
                  </label>
                  <input
                    type="datetime-local"
                    value={editDraft.timeOut}
                    onChange={(e) =>
                      setEditDraft((prev) => ({ ...prev, timeOut: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-heading mb-1">
                  Device / Source
                </label>
                <input
                  type="text"
                  value={editDraft.source}
                  onChange={(e) =>
                    setEditDraft((prev) => ({ ...prev, source: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Desktop / Mobile / Tablet"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={closeEditModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-text-heading hover:bg-soft transition"
                  type="button"
                >
                  Cancel
                </button>

                <button
                  onClick={saveEdit}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95 transition"
                  type="button"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}