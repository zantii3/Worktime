import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Briefcase,
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
  Layers,
  Lock,
  LogOut,
  Mail,
  Pencil,
  Shield,
  Tag,
  Timer,
  Trash2,
  TrendingUp,
  UserCircle2,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { STORAGE_KEY as LEAVE_STORAGE_KEY } from "../user/types/leaveconstants";
import { notifyError, notifySuccess } from "./utils/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_KEY            = "worktime_account_status_v1";
const ATTENDANCE_KEY        = "worktime_attendance_v1";
const TASKS_KEY             = "worktime_tasks_v1";
const CURRENT_ADMIN_KEY     = "currentAdmin";
const ADMIN_EMAIL_KEY       = "admin_email";
const ADMIN_CREDENTIALS_KEY = "worktime_admin_credentials_v1";

// Must stay in sync with Users.tsx
const EDITS_KEY   = "worktime_account_edits_v1";
const CREATED_KEY = "worktime_created_accounts_v1";

// ─── Utilities ────────────────────────────────────────────────────────────────

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

// ── Read admin-assigned role & department for this admin account ──────────────
// Mirrors the exact merge logic in Users.tsx `rows` useMemo.
// Priority: editsMap override → created-accounts record → undefined
function readAdminAssignedFields(adminId: number): {
  roleLabel?: string;
  department?: string;
} {
  try {
    const editsMap: Record<string, { roleLabel?: string; department?: string }> =
      readJSON(EDITS_KEY, {});
    const createdList: Array<{
      id: number; kind: string; roleLabel?: string; department?: string;
    }> = readJSON(CREATED_KEY, []);

    const key  = `admin:${adminId}`;
    const edit = editsMap[key];
    if (edit?.roleLabel || edit?.department) {
      return { roleLabel: edit.roleLabel, department: edit.department };
    }

    const created = createdList.find((a) => a.kind === "admin" && a.id === adminId);
    if (created?.roleLabel || created?.department) {
      return { roleLabel: created.roleLabel, department: created.department };
    }
  } catch {
    // Silently ignore
  }
  return {};
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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToISO(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ElementType;
  tone: "primary" | "secondary" | "success" | "danger" | "slate" | "warning";
}) {
  const accent = {
    primary:   "from-primary to-primary/80",
    secondary: "from-secondary to-secondary/80",
    success:   "from-green-600 to-green-500",
    danger:    "from-rose-600 to-rose-500",
    warning:   "from-amber-500 to-amber-400",
    slate:     "from-slate-600 to-slate-500",
  }[tone];

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.15 }}
      className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-card"
    >
      <div className={cx("bg-gradient-to-br p-4 text-white", accent)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold tracking-wide opacity-90 uppercase">{label}</div>
            <div className="mt-2 text-4xl font-extrabold leading-none tabular-nums">{value}</div>
          </div>
          <span className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </span>
        </div>
      </div>
      {sub && (
        <div className="px-4 py-2.5 bg-card">
          <div className="text-xs text-text-primary/60 font-medium">{sub}</div>
        </div>
      )}
    </motion.div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "primary" | "secondary" | "success" | "slate" | "danger" | "warning";
}) {
  const base = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border";
  const map = {
    primary:   "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary/10 text-secondary border-secondary/20",
    success:   "bg-green-50 text-green-700 border-green-200",
    danger:    "bg-rose-50 text-rose-700 border-rose-200",
    warning:   "bg-amber-50 text-amber-700 border-amber-200",
    slate:     "bg-soft text-text-primary border-slate-200",
  } as const;
  return <span className={cx(base, map[tone])}>{children}</span>;
}

function FormField({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-text-primary/70 uppercase tracking-wide">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-text-primary/50 font-medium">{hint}</p>}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  show: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div className="relative">
      <Lock className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-10 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white"
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-primary/40 hover:text-text-primary transition"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
        e.key === EDITS_KEY ||
        e.key === CREATED_KEY ||
        (currentAdmin?.id && e.key === `admin_profile_${currentAdmin.id}`)
      ) {
        refreshFromStorage();
      }
    };

    const onFocus = () => refreshFromStorage();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshFromStorage();
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

  // ── Derived display values ─────────────────────────────────────────────────

  const adminStatus: Status | "—" = useMemo(() => {
    if (!currentAdmin) return "—";
    return statusMap[`admin:${currentAdmin.id}`] ?? "Active";
  }, [currentAdmin, statusMap]);

  // Role and department assigned via Users.tsx (admin can edit other admins too)
  const adminAssigned = useMemo(
    () => (currentAdmin ? readAdminAssignedFields(currentAdmin.id) : {}),
    // Re-derive whenever currentAdmin changes (covers re-login and profile refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentAdmin?.id, statusMap] // statusMap changes on every Users.tsx save, piggyback on it
  );

  const adminRoleLabel   = adminAssigned.roleLabel  || "Administrator";
  const adminDepartment  = adminAssigned.department || "";

  const adminAttendance = useMemo(() => {
    if (!currentAdmin) return [];
    return attendance
      .filter((r) => r.employeeId === String(currentAdmin.id))
      .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  }, [attendance, currentAdmin]);

  const pendingLeaves = useMemo(
    () => localLeaves.filter((l) => l.status === "Pending"),
    [localLeaves]
  );

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
      attendance.find(
        (r) => r.employeeId === String(currentAdmin.id) && r.dateISO === todayISO
      ) ??
      null
    );
  }, [adminAttendance, attendance, currentAdmin, todayISO]);

  const quickStats = useMemo(() => {
    const totalDays = adminAttendance.filter((r) => !!r.timeIn).length;
    const completedDays = adminAttendance.filter((r) => !!r.timeIn && !!r.timeOut).length;
    const totalWorkMinutes = adminAttendance.reduce(
      (acc, r) => acc + computeWorkMinutes(r),
      0
    );
    const totalOvertimeMinutes = adminAttendance.reduce(
      (acc, r) => acc + computeOvertimeMinutes(r),
      0
    );
    const avgWorkMinutes = completedDays > 0 ? totalWorkMinutes / completedDays : 0;
    const totalTasks = localTasks.length;
    const completedTasks = localTasks.filter((t) => t.status === "Completed").length;
    const inProgressTasks = localTasks.filter((t) => t.status === "In Progress").length;
    const pendingLeavesCount = pendingLeaves.length;

    return {
      totalDays,
      completedDays,
      incompleteDays: totalDays - completedDays,
      totalWorkHours: formatHoursFromMinutes(totalWorkMinutes),
      totalOvertimeHours: formatHoursFromMinutes(totalOvertimeMinutes),
      avgWorkHours: formatHoursFromMinutes(avgWorkMinutes),
      pendingLeaves: pendingLeavesCount,
      totalTasks,
      completedTasks,
      inProgressTasks,
    };
  }, [adminAttendance, localTasks, pendingLeaves]);

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

  // ── Profile edit modal state ───────────────────────────────────────────────

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
    const dn = storedProfile?.displayName || currentAdmin.name || "";
    setProfileForm({
      displayName: dn,
      email: storedProfile?.email || currentAdmin.email || "",
      initials:
        storedProfile?.initials ||
        (dn || "A")
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 4)
          .toUpperCase(),
      photo: storedProfile?.photo || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  }, [currentAdmin, storedProfile]);

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

  const closeProfileEditModal = () => setProfileEditOpen(false);

  const saveProfileChanges = () => {
    if (!currentAdmin) return;
    const nextDisplayName = profileForm.displayName.trim();
    const nextEmail = profileForm.email.trim();
    const nextInitials = profileForm.initials.trim().slice(0, 4).toUpperCase();

    if (!nextDisplayName) { notifyError("Display name is required."); return; }
    if (!nextEmail) { notifyError("Email is required."); return; }

    const credentials = readStoredCredentials();

    if (profileForm.newPassword || profileForm.confirmPassword || profileForm.currentPassword) {
      if (!profileForm.currentPassword) { notifyError("Please enter your current password."); return; }
      if (credentials?.password && profileForm.currentPassword !== credentials.password) {
        notifyError("Current password is incorrect."); return;
      }
      if (profileForm.newPassword.length < 6) { notifyError("New password must be at least 6 characters."); return; }
      if (profileForm.newPassword !== profileForm.confirmPassword) {
        notifyError("New password and confirm password do not match."); return;
      }
    }

    const updatedAdmin: CurrentAdmin = { ...currentAdmin, name: nextDisplayName, email: nextEmail };
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
      localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify({ email: nextEmail, password: profileForm.newPassword }));
    }

    setCurrentAdmin(updatedAdmin);
    setStoredProfile(updatedProfile);
    notifySuccess("Profile updated successfully.");
    setProfileEditOpen(false);
  };

  const removeProfilePhoto = () => setProfileForm((p) => ({ ...p, photo: "" }));

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

  // ── Attendance edit modal state ────────────────────────────────────────────

  const [editOpen, setEditOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    timeIn: "", lunchOut: "", lunchIn: "", timeOut: "", source: "",
  });

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

  const closeEditModal = () => { setEditOpen(false); setEditingRecordId(null); };

  // ── Actions ────────────────────────────────────────────────────────────────

  const copyEmail = async () => {
    if (!displayEmail) return;
    try {
      await navigator.clipboard.writeText(displayEmail);
      notifySuccess("Email copied to clipboard.");
    } catch {
      notifyError("Failed to copy email.");
    }
  };

  const exportMyAttendance = () => {
    if (!currentAdmin) return;
    if (!adminAttendance.length) { notifyError("No attendance records to export."); return; }
    try {
      const headers = ["Date", "Time In", "Start Break", "End Break", "Time Out", "Device", "Work Hours", "Overtime"];
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
      notifySuccess("Attendance exported as CSV.");
    } catch {
      notifyError("Failed to export attendance.");
    }
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem(ADMIN_EMAIL_KEY);
    localStorage.removeItem(CURRENT_ADMIN_KEY);
    notifySuccess("Logged out successfully.");
    navigate("/admin/login", { replace: true });
  };

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!currentAdmin) {
    return (
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-soft border border-slate-200 flex items-center justify-center mx-auto mb-4">
          <UserCircle2 className="w-7 h-7 text-text-primary/40" />
        </div>
        <div className="text-lg font-bold text-text-heading">No session found</div>
        <div className="mt-1 text-sm text-text-primary/60">Please log in to access your admin profile.</div>
        <button
          onClick={() => navigate("/admin/login", { replace: true })}
          className="mt-5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-95 transition"
          type="button"
        >
          Go to Login
        </button>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* ── Hero Header ── */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Gradient band */}
        <div className="bg-gradient-to-br from-primary to-primary/80 px-6 py-6 text-white">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="h-16 w-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                {displayPhoto ? (
                  <img src={displayPhoto} alt="Admin" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-extrabold text-white">{displayInitials}</span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-extrabold leading-tight">{displayName}</h1>
                  <span
                    className={cx(
                      "text-[11px] font-bold px-2.5 py-1 rounded-full border",
                      adminStatus === "Active"
                        ? "bg-green-400/20 border-green-300/40 text-green-100"
                        : "bg-rose-400/20 border-rose-300/40 text-rose-100"
                    )}
                  >
                    {adminStatus}
                  </span>
                </div>

                {/* Role / department row — shows admin-assigned values from Users.tsx */}
                <div className="mt-1 flex items-center gap-3 text-white/75 text-sm flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    {adminRoleLabel}
                  </span>
                  {adminDepartment && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5" />
                        {adminDepartment}
                      </span>
                    </>
                  )}
                  <span className="opacity-40">·</span>
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    ID #{currentAdmin.id}
                  </span>
                  <span className="opacity-40">·</span>
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    {displayEmail}
                  </span>
                </div>

                {/* Role / department pills — visible at a glance */}
                {(adminRoleLabel !== "Administrator" || adminDepartment) && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/15 border border-white/20 text-white">
                      <Tag className="w-3 h-3" />
                      {adminRoleLabel}
                    </span>
                    {adminDepartment && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/15 border border-white/20 text-white">
                        <Briefcase className="w-3 h-3" />
                        {adminDepartment}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Live clock */}
            <div className="flex items-center gap-2 bg-white/15 border border-white/20 rounded-xl px-4 py-3 shrink-0">
              <Clock className="w-4 h-4 text-white/80" />
              <span className="tabular-nums font-bold text-white text-sm">
                {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-wrap border-t border-slate-100 bg-slate-50/40">
          <div className="flex items-center gap-2 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={openProfileEditModal}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 transition"
              type="button"
            >
              <Pencil className="w-4 h-4" />
              Edit Profile
            </motion.button>

            <button
              onClick={copyEmail}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition"
              type="button"
            >
              <Copy className="w-4 h-4" />
              Copy Email
            </button>

            <button
              onClick={exportMyAttendance}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition"
              type="button"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
            type="button"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Days Logged"
          value={quickStats.totalDays}
          sub={`${quickStats.completedDays} complete · ${quickStats.incompleteDays} open`}
          icon={CalendarDays}
          tone="primary"
        />
        <StatCard
          label="Avg Work Hours"
          value={quickStats.avgWorkHours}
          sub="Per completed day"
          icon={Timer}
          tone="secondary"
        />
        <StatCard
          label="Total Overtime"
          value={`${quickStats.totalOvertimeHours}h`}
          sub="Across all records"
          icon={TrendingUp}
          tone="warning"
        />
        <StatCard
          label="Tasks"
          value={`${quickStats.completedTasks}/${quickStats.totalTasks}`}
          sub={`${quickStats.inProgressTasks} in progress · ${quickStats.pendingLeaves} leave pending`}
          icon={BarChart3}
          tone="success"
        />
      </div>

      {/* ── Today + Recent Attendance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Today card */}
        <div className="bg-card rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-text-primary/60" />
              <div>
                <div className="text-sm font-bold text-text-heading">Today</div>
                <div className="text-xs text-text-primary/50">{todayISO}</div>
              </div>
            </div>
            <span
              className={cx(
                "px-2.5 py-1 rounded-full text-xs font-bold border",
                todayRecord?.timeIn && !todayRecord?.timeOut
                  ? "bg-green-50 text-green-700 border-green-200"
                  : todayRecord?.timeOut
                  ? "bg-soft text-text-heading border-slate-200"
                  : "bg-slate-50 text-text-primary/50 border-slate-200"
              )}
            >
              {todayRecord?.timeIn
                ? todayRecord.timeOut
                  ? "Completed"
                  : "In Progress"
                : "No Record"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Time In", value: formatTimeLocal(todayRecord?.timeIn ?? null), color: "text-green-700" },
              { label: "Start Break", value: formatTimeLocal(todayRecord?.lunchOut ?? null), color: "text-amber-700" },
              { label: "End Break", value: formatTimeLocal(todayRecord?.lunchIn ?? null), color: "text-blue-700" },
              { label: "Time Out", value: formatTimeLocal(todayRecord?.timeOut ?? null), color: "text-rose-700" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-white border border-slate-200 p-3">
                <div className="text-[10px] font-bold text-text-primary/50 uppercase tracking-wide">{label}</div>
                <div className={cx("mt-1 text-base font-extrabold tabular-nums", color)}>{value}</div>
              </div>
            ))}
          </div>

          {todayRecord && (
            <div className="rounded-xl bg-soft border border-slate-200 px-4 py-3 flex items-center justify-between gap-2">
              <div className="text-xs text-text-primary/60">
                <span className="font-bold text-text-heading">
                  {formatHoursFromMinutes(computeWorkMinutes(todayRecord))}h
                </span>{" "}
                worked
                {computeOvertimeMinutes(todayRecord) > 0 && (
                  <>
                    {" · "}
                    <span className="font-bold text-amber-700">
                      +{formatHoursFromMinutes(computeOvertimeMinutes(todayRecord))}h
                    </span>{" "}
                    OT
                  </>
                )}
              </div>
              {todayRecord.source && (
                <Pill tone="slate">{todayRecord.source}</Pill>
              )}
            </div>
          )}
        </div>

        {/* Recent Attendance */}
        <div className="bg-card rounded-2xl shadow-sm border border-slate-200 p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-text-primary/60" />
              <div>
                <div className="text-sm font-bold text-text-heading">Recent Attendance</div>
                <div className="text-xs text-text-primary/50">Last {Math.min(5, adminAttendance.length)} records</div>
              </div>
            </div>
            {adminAttendance.length > 0 && (
              <Pill tone="slate">{adminAttendance.length} total</Pill>
            )}
          </div>

          <div className="space-y-2">
            {adminAttendance.slice(0, 5).map((r) => {
              const workHrs = formatHoursFromMinutes(computeWorkMinutes(r));
              const otHrs = formatHoursFromMinutes(computeOvertimeMinutes(r));
              const isDone = !!r.timeOut;

              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-primary/20 hover:bg-primary/5 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cx(
                        "h-8 w-8 rounded-lg border flex items-center justify-center shrink-0",
                        isDone
                          ? "bg-green-50 border-green-200"
                          : "bg-amber-50 border-amber-200"
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <CircleDashed className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-text-heading">{r.dateISO}</div>
                      <div className="text-xs text-text-primary/60 truncate">
                        {formatTimeLocal(r.timeIn)} → {formatTimeLocal(r.timeOut)}
                        {r.source && ` · ${r.source}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs font-bold text-text-heading tabular-nums">{workHrs}h</div>
                      {parseFloat(otHrs) > 0 && (
                        <div className="text-[11px] text-amber-600 font-semibold tabular-nums">+{otHrs}h OT</div>
                      )}
                    </div>
                    <button
                      onClick={() => openEditModal(r)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-text-heading hover:bg-soft transition opacity-0 group-hover:opacity-100"
                      type="button"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {adminAttendance.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="h-12 w-12 rounded-2xl bg-soft border border-slate-200 flex items-center justify-center">
                  <CalendarDays className="w-6 h-6 text-text-primary/30" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-heading">No attendance records</div>
                  <div className="text-xs text-text-primary/50 mt-0.5">Records will appear here once you clock in.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          EDIT PROFILE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {profileEditOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeProfileEditModal}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-card flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-primary px-6 py-6 text-white shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
                      {profileForm.photo ? (
                        <img src={profileForm.photo} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg font-extrabold text-white">
                          {profileForm.initials || "AD"}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold leading-tight">Edit Profile</div>
                      <div className="text-sm text-white/75 mt-1">
                        Admin #{currentAdmin.id} · Update your info and credentials
                      </div>
                      {/* Role/dept reminder inside modal */}
                      {(adminRoleLabel !== "Administrator" || adminDepartment) && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 border border-white/20 text-white/90">
                            <Tag className="w-2.5 h-2.5" />{adminRoleLabel}
                          </span>
                          {adminDepartment && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 border border-white/20 text-white/90">
                              <Briefcase className="w-2.5 h-2.5" />{adminDepartment}
                            </span>
                          )}
                          <span className="text-[10px] text-white/50">Assigned by User Management</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={closeProfileEditModal}
                    className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition shrink-0"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                {/* Profile picture section */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <UserCircle2 className="w-4 h-4 text-text-primary/60" />
                    <span className="text-sm font-bold text-text-heading">Profile Picture</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                      {profileForm.photo ? (
                        <img src={profileForm.photo} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xl font-extrabold text-primary">
                          {profileForm.initials || "AD"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition cursor-pointer">
                        <ImagePlus className="w-4 h-4" />
                        Upload Photo
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                      </label>
                      {profileForm.photo && (
                        <button
                          onClick={removeProfilePhoto}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <FormField label="Display Name" required>
                        <input
                          type="text"
                          value={profileForm.displayName}
                          onChange={(e) => setProfileForm((p) => ({ ...p, displayName: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                          placeholder="Your full name"
                        />
                      </FormField>
                    </div>
                    <div>
                      <FormField label="Avatar Initials" hint="1–4 chars, shown when no photo">
                        <input
                          type="text"
                          maxLength={4}
                          value={profileForm.initials}
                          onChange={(e) => setProfileForm((p) => ({ ...p, initials: e.target.value.toUpperCase() }))}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                        />
                      </FormField>
                    </div>
                  </div>

                  <FormField label="Email Address" required>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                      />
                    </div>
                  </FormField>
                </div>

                {/* Password section */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-text-primary/60" />
                      <span className="text-sm font-bold text-text-heading">Change Password</span>
                    </div>
                    <span className="text-xs text-text-primary/50 font-medium">
                      Optional — leave blank to keep current
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Current Password">
                      <PasswordInput
                        value={profileForm.currentPassword}
                        onChange={(v) => setProfileForm((p) => ({ ...p, currentPassword: v }))}
                        placeholder="Enter current"
                        show={showCurrentPassword}
                        onToggleShow={() => setShowCurrentPassword((v) => !v)}
                      />
                    </FormField>
                    <FormField label="New Password">
                      <PasswordInput
                        value={profileForm.newPassword}
                        onChange={(v) => setProfileForm((p) => ({ ...p, newPassword: v }))}
                        placeholder="Min 6 chars"
                        show={showNewPassword}
                        onToggleShow={() => setShowNewPassword((v) => !v)}
                      />
                    </FormField>
                    <FormField label="Confirm Password">
                      <PasswordInput
                        value={profileForm.confirmPassword}
                        onChange={(v) => setProfileForm((p) => ({ ...p, confirmPassword: v }))}
                        placeholder="Repeat new"
                        show={showConfirmPassword}
                        onToggleShow={() => setShowConfirmPassword((v) => !v)}
                      />
                    </FormField>
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 font-medium flex items-start gap-2">
                    <Layers className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Password updates persist via{" "}
                    <span className="font-bold">worktime_admin_credentials_v1</span>. Changes take effect on next login.
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 pt-3 shrink-0 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  onClick={closeProfileEditModal}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition"
                  type="button"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={saveProfileChanges}
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 transition inline-flex items-center gap-2"
                  type="button"
                >
                  <UserCircle2 className="w-4 h-4" />
                  Save Changes
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          EDIT ATTENDANCE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {editOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeEditModal}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-card flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-primary px-6 py-6 text-white shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xl font-extrabold leading-tight">Edit Attendance Log</div>
                      <div className="text-sm text-white/75 mt-1">
                        Adjust times for this daily record
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={closeEditModal}
                    className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition shrink-0"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-text-primary/60" />
                    <span className="text-sm font-bold text-text-heading">Time Entries</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Time In", key: "timeIn" as const, color: "focus:ring-green-400/30 border-green-100" },
                      { label: "Start Break", key: "lunchOut" as const, color: "focus:ring-amber-400/30 border-amber-100" },
                      { label: "End Break", key: "lunchIn" as const, color: "focus:ring-blue-400/30 border-blue-100" },
                      { label: "Time Out", key: "timeOut" as const, color: "focus:ring-rose-400/30 border-rose-100" },
                    ].map(({ label, key, color }) => (
                      <FormField key={key} label={label}>
                        <input
                          type="datetime-local"
                          value={editDraft[key]}
                          onChange={(e) => setEditDraft((p) => ({ ...p, [key]: e.target.value }))}
                          className={cx(
                            "w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 bg-white",
                            color
                          )}
                        />
                      </FormField>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                  <FormField label="Device / Source" hint="e.g. Desktop, Mobile, Tablet">
                    <input
                      type="text"
                      value={editDraft.source}
                      onChange={(e) => setEditDraft((p) => ({ ...p, source: e.target.value }))}
                      placeholder="Desktop"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                    />
                  </FormField>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 pt-0 shrink-0 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  onClick={closeEditModal}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition"
                  type="button"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={saveEdit}
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 transition inline-flex items-center gap-2"
                  type="button"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save Log
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}