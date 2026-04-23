import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import AdminTable from "./components/AdminTable";
import { useAdmin } from "./context/AdminProvider";
import { notifyError, notifySuccess } from "./utils/toast";

import accounts from "../data/accounts.json";
import adminAccounts from "./data/adminAccounts.json";

import {
  Ban,
  Briefcase,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Filter,
  KeyRound,
  Layers,
  Lock,
  Mail,
  Plus,
  Search,
  Shield,
  Trash2,
  User as UserIcon,
  UserCheck,
  UserCog,
  UserPlus,
  Users as UsersIcon,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type UserAccount = { id: number; email: string; password: string; name: string };
type AdminAccount = { id: number; email: string; password: string; name: string };

type AccountKind = "user" | "admin";

type AccountRow = {
  kind: AccountKind;
  id: number;
  name: string;
  email: string;
  password: string;
  roleLabel: string;
  department: string;
  status: "Active" | "Inactive";
  isLocalOnly: boolean; // created via form, not from JSON
};

type NewAccountForm = {
  kind: AccountKind;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  department: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_KEY = "worktime_account_status_v1";
const CREATED_ACCOUNTS_KEY = "worktime_created_accounts_v1";
const DELETED_ACCOUNT_IDS_KEY = "worktime_deleted_account_ids_v1";
const ACCOUNT_META_KEY = "worktime_account_meta_v1"; // stores department, etc.

const DEPARTMENTS = [
  "IT",
  "Marketing",
  "Sales",
  "Human Resources",
  "Finance",
  "Operations",
  "Legal",
  "Client Support",
];

type StatusMap = Record<string, "Active" | "Inactive">;
type MetaMap = Record<string, { department?: string }>;

type CreatedAccount = {
  id: number;
  kind: AccountKind;
  name: string;
  email: string;
  password: string;
  department: string;
  createdAt: string;
};

type DeletedIds = string[]; // e.g. ["user:1", "admin:101"]

// ─── Storage Helpers ─────────────────────────────────────────────────────────

function readStatusMap(): StatusMap {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as StatusMap) : {};
  } catch {
    return {};
  }
}

function writeStatusMap(map: StatusMap) {
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify(map));
  } catch {}
}

function readCreatedAccounts(): CreatedAccount[] {
  try {
    const raw = localStorage.getItem(CREATED_ACCOUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CreatedAccount[]) : [];
  } catch {
    return [];
  }
}

function writeCreatedAccounts(list: CreatedAccount[]) {
  try {
    localStorage.setItem(CREATED_ACCOUNTS_KEY, JSON.stringify(list));
  } catch {}
}

function readDeletedIds(): DeletedIds {
  try {
    const raw = localStorage.getItem(DELETED_ACCOUNT_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as DeletedIds) : [];
  } catch {
    return [];
  }
}

function writeDeletedIds(ids: DeletedIds) {
  try {
    localStorage.setItem(DELETED_ACCOUNT_IDS_KEY, JSON.stringify(ids));
  } catch {}
}

function readMetaMap(): MetaMap {
  try {
    const raw = localStorage.getItem(ACCOUNT_META_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as MetaMap) : {};
  } catch {
    return {};
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 9999);
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "primary" | "secondary" | "success" | "slate" | "danger" | "warning";
}) {
  const base =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border";
  const map = {
    primary: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary/10 text-secondary border-secondary/20",
    success: "bg-green-50 text-green-700 border-green-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-soft text-text-primary border-slate-200",
  } as const;

  return <span className={cx(base, map[tone])}>{children}</span>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  tone: "primary" | "secondary" | "success" | "danger" | "slate";
  sub?: string;
}) {
  const accent = {
    primary: "from-primary to-primary/80",
    secondary: "from-secondary to-secondary/80",
    success: "from-green-600 to-green-500",
    danger: "from-rose-600 to-rose-500",
    slate: "from-slate-600 to-slate-500",
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
            <div className="text-[11px] font-extrabold tracking-wide opacity-90 uppercase">
              {label}
            </div>
            <div className="mt-2 text-4xl font-extrabold leading-none tabular-nums">
              {value}
            </div>
          </div>
          <span className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </span>
        </div>
      </div>
      {sub && (
        <div className="p-3 bg-card">
          <div className="text-xs text-text-primary/70">{sub}</div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Field wrapper for modal ──────────────────────────────────────────────────

function FormField({
  label,
  required,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-text-primary/70 uppercase tracking-wide">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
          <X className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Users() {
  const { setUsers } = useAdmin();

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const currentAdmin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentAdmin") || "null") as
        | { id: number; email: string; name: string }
        | null;
    } catch {
      return null;
    }
  }, []);

  // ── Storage state ────────────────────────────────────────────────────────
  const [statusMap, setStatusMap] = useState<StatusMap>(() => readStatusMap());
  const [createdAccounts, setCreatedAccounts] = useState<CreatedAccount[]>(() =>
    readCreatedAccounts()
  );
  const [deletedIds, setDeletedIds] = useState<DeletedIds>(() => readDeletedIds());
  const metaMap = useMemo(() => readMetaMap(), []);

  useEffect(() => { writeStatusMap(statusMap); }, [statusMap]);
  useEffect(() => { writeCreatedAccounts(createdAccounts); }, [createdAccounts]);
  useEffect(() => { writeDeletedIds(deletedIds); }, [deletedIds]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATUS_KEY) setStatusMap(readStatusMap());
      if (e.key === CREATED_ACCOUNTS_KEY) setCreatedAccounts(readCreatedAccounts());
      if (e.key === DELETED_ACCOUNT_IDS_KEY) setDeletedIds(readDeletedIds());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Build merged rows ────────────────────────────────────────────────────
  const rows = useMemo<AccountRow[]>(() => {
    const deletedSet = new Set(deletedIds);

    const userList = (accounts as UserAccount[])
      .filter((u) => !deletedSet.has(`user:${u.id}`))
      .map((u) => {
        const key = `user:${u.id}`;
        const meta = metaMap[key] ?? {};
        return {
          kind: "user" as const,
          id: u.id,
          name: u.name,
          email: u.email,
          password: u.password,
          roleLabel: "Employee",
          department: meta.department ?? "—",
          status: (statusMap[key] ?? "Active") as "Active" | "Inactive",
          isLocalOnly: false,
        };
      });

    const adminList = (adminAccounts as AdminAccount[])
      .filter((a) => !deletedSet.has(`admin:${a.id}`))
      .map((a) => {
        const key = `admin:${a.id}`;
        const meta = metaMap[key] ?? {};
        return {
          kind: "admin" as const,
          id: a.id,
          name: a.name,
          email: a.email,
          password: a.password,
          roleLabel: "Admin",
          department: meta.department ?? "—",
          status: (statusMap[key] ?? "Active") as "Active" | "Inactive",
          isLocalOnly: false,
        };
      });

    const localList = createdAccounts
      .filter((a) => !deletedSet.has(`${a.kind}:${a.id}`))
      .map((a) => {
        const key = `${a.kind}:${a.id}`;
        return {
          kind: a.kind,
          id: a.id,
          name: a.name,
          email: a.email,
          password: a.password,
          roleLabel: a.kind === "admin" ? "Admin" : "Employee",
          department: a.department || "—",
          status: (statusMap[key] ?? "Active") as "Active" | "Inactive",
          isLocalOnly: true,
        };
      });

    return [...adminList, ...userList, ...localList];
  }, [statusMap, createdAccounts, deletedIds, metaMap]);

  // push employees into AdminProvider context
  useEffect(() => {
    setUsers(
      rows
        .filter((r) => r.kind === "user")
        .map((r) => ({
          id: r.id,
          name: r.name,
          role: r.roleLabel,
          status: r.status,
          email: r.email,
        })) as any
    );
  }, [rows, setUsers]);

  // ── Filters & search ─────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "Admins" | "Users">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [deptFilter, setDeptFilter] = useState<string>("All");
  const [sort, setSort] = useState<"name" | "type" | "status" | "dept">("name");

  const allDepartments = useMemo(() => {
    const depts = new Set(rows.map((r) => r.department).filter((d) => d !== "—"));
    return ["All", ...Array.from(depts).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...rows];

    if (typeFilter !== "All")
      list = list.filter((r) => (typeFilter === "Admins" ? r.kind === "admin" : r.kind === "user"));
    if (statusFilter !== "All")
      list = list.filter((r) => r.status === statusFilter);
    if (deptFilter !== "All")
      list = list.filter((r) => r.department === deptFilter);
    if (q)
      list = list.filter((r) =>
        `${r.name} ${r.email} ${r.roleLabel} ${r.department}`.toLowerCase().includes(q)
      );

    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "type") return a.kind.localeCompare(b.kind);
      if (sort === "status") return a.status.localeCompare(b.status);
      if (sort === "dept") return a.department.localeCompare(b.department);
      return 0;
    });

    return list;
  }, [rows, query, typeFilter, statusFilter, deptFilter, sort]);

  const stats = useMemo(() => ({
    total: rows.length,
    admins: rows.filter((r) => r.kind === "admin").length,
    usersCount: rows.filter((r) => r.kind === "user").length,
    active: rows.filter((r) => r.status === "Active").length,
    inactive: rows.filter((r) => r.status === "Inactive").length,
  }), [rows]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const canToggle = (r: AccountRow) =>
    !(r.kind === "admin" && currentAdmin?.id === r.id);

  const toggleStatus = (r: AccountRow) => {
    if (!canToggle(r)) {
      notifyError("You can't deactivate your own account.");
      return;
    }
    const key = `${r.kind}:${r.id}`;
    const next = r.status === "Active" ? "Inactive" : "Active";
    setStatusMap((prev) => ({ ...prev, [key]: next }));
    notifySuccess(`"${r.name}" is now ${next}.`);
  };

  const deleteAccount = (r: AccountRow) => {
    if (r.kind === "admin" && currentAdmin?.id === r.id) {
      notifyError("You can't delete your own account.");
      return;
    }
    if (!window.confirm(`Delete "${r.name}"? This cannot be undone.`)) return;

    const key = `${r.kind}:${r.id}`;
    setDeletedIds((prev) => [...prev, key]);

    if (r.isLocalOnly) {
      setCreatedAccounts((prev) => prev.filter((a) => a.id !== r.id));
    }

    // Clean up status entry
    setStatusMap((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    notifySuccess(`"${r.name}" has been deleted.`);
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      notifySuccess("Email copied.");
    } catch {
      notifyError("Failed to copy email.");
    }
  };

  const resetPasswordDemo = (r: AccountRow) => {
    notifySuccess(`Password reset triggered for ${r.name} (demo).`);
  };

  // ── Create Account Modal ─────────────────────────────────────────────────

  const [modalOpen, setModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewAccountForm, string>>>({});

  const defaultForm: NewAccountForm = {
    kind: "user",
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    department: "",
  };
  const [form, setForm] = useState<NewAccountForm>(defaultForm);

  const openModal = () => {
    setForm(defaultForm);
    setFormErrors({});
    setShowPassword(false);
    setShowConfirm(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormErrors({});
  };

  const updateForm = (field: keyof NewAccountForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NewAccountForm, string>> = {};

    if (!form.name.trim()) errors.name = "Name is required.";
    if (!form.email.trim()) errors.email = "Email is required.";
    else if (!validateEmail(form.email)) errors.email = "Enter a valid email address.";
    else if (rows.some((r) => r.email.toLowerCase() === form.email.trim().toLowerCase()))
      errors.email = "An account with this email already exists.";

    if (!form.password) errors.password = "Password is required.";
    else if (form.password.length < 6) errors.password = "Password must be at least 6 characters.";

    if (!form.confirmPassword) errors.confirmPassword = "Please confirm your password.";
    else if (form.password !== form.confirmPassword)
      errors.confirmPassword = "Passwords do not match.";

    if (!form.department) errors.department = "Please select a department.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = () => {
    if (!validateForm()) return;

    const newAccount: CreatedAccount = {
      id: generateId(),
      kind: form.kind,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      department: form.department,
      createdAt: new Date().toISOString(),
    };

    setCreatedAccounts((prev) => [newAccount, ...prev]);
    notifySuccess(`${form.kind === "admin" ? "Admin" : "User"} "${newAccount.name}" created successfully.`);
    closeModal();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* ── Header ── */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <UsersIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-text-heading">User Management</div>
              <div className="text-sm text-text-primary/70">
                Create, manage, and monitor employee and admin accounts.
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="slate">{stats.total} total</Pill>
            <Pill tone="primary">{stats.usersCount} users</Pill>
            <Pill tone="secondary">{stats.admins} admins</Pill>
            <Pill tone="success">{stats.active} active</Pill>
            {stats.inactive > 0 && <Pill tone="danger">{stats.inactive} inactive</Pill>}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openModal}
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 transition"
          >
            <UserPlus className="w-4 h-4" />
            Create Account
          </motion.button>

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

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Accounts" value={stats.total} icon={UsersIcon} tone="slate" sub="All roles" />
        <StatCard label="Employees" value={stats.usersCount} icon={UserIcon} tone="primary" sub="User accounts" />
        <StatCard label="Admins" value={stats.admins} icon={Shield} tone="secondary" sub="Admin accounts" />
        <StatCard label="Active" value={stats.active} icon={UserCheck} tone="success" sub="Currently active" />
        <StatCard label="Inactive" value={stats.inactive} icon={Ban} tone="danger" sub="Deactivated" />
      </div>

      {/* ── Table Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        {/* Controls */}
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-text-heading">Accounts Directory</div>
              <div className="text-xs text-text-primary/70 mt-0.5">
                {filtered.length} of {rows.length} accounts shown
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openModal}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              New Account
            </motion.button>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, department…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30 text-text-heading placeholder:text-text-primary/40"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-primary/40 hover:text-text-heading"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary/60">
              <Filter className="w-3.5 h-3.5" />
              Filters:
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm text-text-heading"
            >
              <option value="All">All Types</option>
              <option value="Users">Users</option>
              <option value="Admins">Admins</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm text-text-heading"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm text-text-heading"
            >
              {allDepartments.map((d) => (
                <option key={d} value={d}>{d === "All" ? "All Depts" : d}</option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm text-text-heading"
            >
              <option value="name">Sort: Name</option>
              <option value="type">Sort: Type</option>
              <option value="status">Sort: Status</option>
              <option value="dept">Sort: Department</option>
            </select>

            {(query || typeFilter !== "All" || statusFilter !== "All" || deptFilter !== "All") && (
              <button
                onClick={() => {
                  setQuery("");
                  setTypeFilter("All");
                  setStatusFilter("All");
                  setDeptFilter("All");
                }}
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Account", "Role", "Department", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-text-primary/50">
                        <div className="h-14 w-14 rounded-2xl bg-soft border border-slate-200 flex items-center justify-center">
                          <UsersIcon className="w-7 h-7 opacity-40" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-text-heading">No accounts found</div>
                          <div className="text-xs mt-1">Try adjusting your filters or search query.</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, idx) => {
                    const isSelfAdmin = r.kind === "admin" && currentAdmin?.id === r.id;
                    const Icon = r.kind === "admin" ? Shield : UserIcon;

                    return (
                      <motion.tr
                        key={`${r.kind}:${r.id}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15, delay: idx * 0.02 }}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Account */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cx(
                                "h-9 w-9 rounded-xl border flex items-center justify-center shrink-0",
                                r.kind === "admin"
                                  ? "bg-secondary/10 border-secondary/20"
                                  : "bg-primary/10 border-primary/20"
                              )}
                            >
                              <Icon
                                className={cx(
                                  "w-4 h-4",
                                  r.kind === "admin" ? "text-secondary" : "text-primary"
                                )}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-text-heading truncate flex items-center gap-2">
                                {r.name}
                                {isSelfAdmin && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                                    You
                                  </span>
                                )}
                                {r.isLocalOnly && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                                    New
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-text-primary/60 truncate">{r.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3">
                          <Pill tone={r.kind === "admin" ? "secondary" : "primary"}>
                            {r.kind === "admin" ? (
                              <Shield className="w-3 h-3" />
                            ) : (
                              <UserIcon className="w-3 h-3" />
                            )}
                            {r.roleLabel}
                          </Pill>
                        </td>

                        {/* Department */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-sm text-text-primary/80">
                            {r.department !== "—" ? (
                              <>
                                <Briefcase className="w-3.5 h-3.5 text-text-primary/40 shrink-0" />
                                <span className="font-medium">{r.department}</span>
                              </>
                            ) : (
                              <span className="text-text-primary/40 text-xs">—</span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <Pill tone={r.status === "Active" ? "success" : "slate"}>
                            {r.status === "Active" ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <Ban className="w-3.5 h-3.5" />
                            )}
                            {r.status}
                          </Pill>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Activate / Deactivate */}
                            <button
                              onClick={() => toggleStatus(r)}
                              disabled={!canToggle(r)}
                              type="button"
                              className={cx(
                                "text-xs font-semibold px-3 py-1.5 rounded-lg border transition",
                                !canToggle(r)
                                  ? "text-text-primary/30 border-slate-100 cursor-not-allowed bg-white"
                                  : r.status === "Active"
                                  ? "text-rose-700 border-rose-200 bg-rose-50 hover:bg-rose-100"
                                  : "text-green-700 border-green-200 bg-green-50 hover:bg-green-100"
                              )}
                            >
                              {r.status === "Active" ? "Deactivate" : "Activate"}
                            </button>

                            {/* Copy email */}
                            <button
                              onClick={() => copyEmail(r.email)}
                              type="button"
                              title="Copy email"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-text-primary/60 hover:text-text-heading px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-200 hover:bg-soft transition"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Copy
                            </button>

                            {/* Reset password */}
                            <button
                              onClick={() => resetPasswordDemo(r)}
                              type="button"
                              title="Reset password (demo)"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-text-primary/60 hover:text-text-heading px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-200 hover:bg-soft transition"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Reset
                            </button>

                            {/* Delete */}
                            {!isSelfAdmin && (
                              <button
                                onClick={() => deleteAccount(r)}
                                type="button"
                                title="Delete account"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-rose-200 hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════════
          CREATE ACCOUNT MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-card flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="bg-primary px-6 py-6 text-white shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold leading-tight">
                        Create Account
                      </div>
                      <div className="text-sm text-white/80 mt-1">
                        New accounts are saved locally and merged with existing records.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={closeModal}
                    type="button"
                    className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Account type toggle */}
                <div className="mt-5 flex gap-2">
                  {(["user", "admin"] as AccountKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => updateForm("kind", k)}
                      className={cx(
                        "flex-1 py-2.5 rounded-xl text-sm font-bold border transition",
                        form.kind === k
                          ? "bg-white text-primary border-white shadow-sm"
                          : "bg-white/10 text-white/80 border-white/20 hover:bg-white/20"
                      )}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {k === "admin" ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                        {k === "admin" ? "Admin Account" : "Employee Account"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Personal info section */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <UserCog className="w-4 h-4 text-text-primary/60" />
                    <span className="text-sm font-bold text-text-heading">Personal Information</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Full Name" required error={formErrors.name}>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => updateForm("name", e.target.value)}
                          placeholder="e.g. Juan dela Cruz"
                          className={cx(
                            "w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white",
                            formErrors.name ? "border-rose-300" : "border-slate-200"
                          )}
                        />
                      </div>
                    </FormField>

                    <FormField label="Email Address" required error={formErrors.email}>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => updateForm("email", e.target.value)}
                          placeholder="e.g. juan@company.com"
                          className={cx(
                            "w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white",
                            formErrors.email ? "border-rose-300" : "border-slate-200"
                          )}
                        />
                      </div>
                    </FormField>
                  </div>

                  <FormField label="Department" required error={formErrors.department}>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={form.department}
                        onChange={(e) => updateForm("department", e.target.value)}
                        className={cx(
                          "w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white appearance-none",
                          formErrors.department ? "border-rose-300" : "border-slate-200"
                        )}
                      >
                        <option value="" disabled>Select department…</option>
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </FormField>
                </div>

                {/* Credentials section */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-4 h-4 text-text-primary/60" />
                    <span className="text-sm font-bold text-text-heading">Credentials</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Password" required error={formErrors.password}>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          onChange={(e) => updateForm("password", e.target.value)}
                          placeholder="Min 6 characters"
                          className={cx(
                            "w-full pl-9 pr-10 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white",
                            formErrors.password ? "border-rose-300" : "border-slate-200"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-primary/40 hover:text-text-primary"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormField>

                    <FormField label="Confirm Password" required error={formErrors.confirmPassword}>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showConfirm ? "text" : "password"}
                          value={form.confirmPassword}
                          onChange={(e) => updateForm("confirmPassword", e.target.value)}
                          placeholder="Repeat password"
                          className={cx(
                            "w-full pl-9 pr-10 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white",
                            formErrors.confirmPassword ? "border-rose-300" : "border-slate-200"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-primary/40 hover:text-text-primary"
                        >
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormField>
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 font-medium flex items-start gap-2">
                    <Layers className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Passwords are stored in plain text for this demo. In production, always use hashed credentials.
                    </span>
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-xs font-bold text-primary uppercase tracking-wide mb-3">
                    Account Preview
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={cx(
                      "h-10 w-10 rounded-xl border flex items-center justify-center shrink-0",
                      form.kind === "admin"
                        ? "bg-secondary/10 border-secondary/20"
                        : "bg-primary/10 border-primary/20"
                    )}>
                      {form.kind === "admin"
                        ? <Shield className="w-4 h-4 text-secondary" />
                        : <UserIcon className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-text-heading truncate">
                        {form.name.trim() || <span className="text-text-primary/40 font-normal">Full name…</span>}
                      </div>
                      <div className="text-xs text-text-primary/60 truncate">
                        {form.email.trim() || <span className="text-text-primary/40">email@example.com</span>}
                      </div>
                    </div>
                    <div className="ml-auto flex gap-2 shrink-0">
                      <Pill tone={form.kind === "admin" ? "secondary" : "primary"}>
                        {form.kind === "admin" ? "Admin" : "Employee"}
                      </Pill>
                      {form.department && (
                        <Pill tone="slate">{form.department}</Pill>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="px-6 pb-6 pt-3 shrink-0 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  onClick={closeModal}
                  type="button"
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreate}
                  type="button"
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 transition inline-flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}