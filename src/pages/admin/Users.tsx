import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
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
  Pencil,
  Plus,
  Search,
  Shield,
  Tag,
  Trash2,
  UserCheck,
  UserCog,
  User as UserIcon,
  UserPlus,
  Users as UsersIcon,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserAccount  = { id: number; email: string; password: string; name: string };
type AdminAccount = { id: number; email: string; password: string; name: string };
type AccountKind  = "user" | "admin";

type AccountRow = {
  kind: AccountKind;
  id: number;
  name: string;
  email: string;
  password: string;
  roleLabel: string;
  department: string;
  status: "Active" | "Inactive";
  isLocalOnly: boolean;
};

type NewAccountForm = {
  kind: AccountKind;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  roleLabel: string;
  department: string;
};

type EditAccountForm = {
  name: string;
  email: string;
  roleLabel: string;
  department: string;
  newPassword: string;
  confirmNewPassword: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_KEY           = "worktime_account_status_v1";
const CREATED_ACCOUNTS_KEY = "worktime_created_accounts_v1";
const DELETED_IDS_KEY      = "worktime_deleted_account_ids_v1";
const EDITS_KEY            = "worktime_account_edits_v1";

const DEPARTMENTS = [
  "Engineering", "Design", "Product", "Marketing", "Sales",
  "Human Resources", "Finance", "Operations", "Legal", "Customer Support",
] as const;

// Department → relevant roles mapping
const DEPARTMENT_ROLES: Record<string, string[]> = {
  "Engineering":      ["Developer", "DevOps Engineer", "QA Tester", "Technical Lead", "Scrum Master", "Data Analyst"],
  "Design":           ["UI/UX Designer", "Technical Lead", "Business Analyst"],
  "Product":          ["Product Manager", "Business Analyst", "Scrum Master", "Technical Lead", "Data Analyst"],
  "Marketing":        ["Marketing Specialist", "Content Strategist", "Data Analyst", "Business Analyst"],
  "Sales":            ["Sales Representative", "Account Manager", "Business Analyst", "Sales Manager"],
  "Human Resources":  ["HR Specialist", "Recruiter", "HR Manager", "Business Analyst"],
  "Finance":          ["Financial Analyst", "Accountant", "Finance Manager", "Data Analyst", "Business Analyst"],
  "Operations":       ["DevOps Engineer", "Project Manager", "QA Tester", "Scrum Master", "Business Analyst", "Technical Lead"],
  "Legal":            ["Legal Counsel", "Compliance Officer", "Paralegal", "Business Analyst"],
  "Customer Support": ["Support Specialist", "QA Tester", "Technical Lead", "Business Analyst"],
};

// Generic fallback used when no department is selected yet
const ALL_ROLES = [
  "Employee", "Developer", "Project Manager", "QA Tester",
  "UI/UX Designer", "Business Analyst", "DevOps Engineer",
  "Data Analyst", "Scrum Master", "Technical Lead",
];

/** Returns the roles relevant to the given department.
 *  Falls back to the full role list when dept is empty / unrecognised. */
function getRolesForDept(dept: string): string[] {
  return DEPARTMENT_ROLES[dept] ?? ALL_ROLES;
}

// ─── Storage types ────────────────────────────────────────────────────────────

type StatusMap = Record<string, "Active" | "Inactive">;

type CreatedAccount = {
  id: number;
  kind: AccountKind;
  name: string;
  email: string;
  password: string;
  roleLabel: string;
  department: string;
  createdAt: string;
};

type AccountEdit = {
  name?: string;
  email?: string;
  password?: string;
  roleLabel?: string;
  department?: string;
};
type EditsMap  = Record<string, AccountEdit>;
type DeletedIds = string[];

// ─── Storage helpers ──────────────────────────────────────────────────────────

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

function safeWrite(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const readStatusMap  = (): StatusMap       => safeRead<StatusMap>(STATUS_KEY, {});
const readCreated    = (): CreatedAccount[] => safeRead<CreatedAccount[]>(CREATED_ACCOUNTS_KEY, []);
const readDeletedIds = (): DeletedIds       => safeRead<DeletedIds>(DELETED_IDS_KEY, []);
const readEdits      = (): EditsMap         => safeRead<EditsMap>(EDITS_KEY, {});

// ─── Utilities ────────────────────────────────────────────────────────────────

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}
function genId() { return Date.now() + Math.floor(Math.random() * 9999); }
function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function StatCard({
  label, value, icon: Icon, tone, sub,
}: {
  label: string; value: number | string; icon: React.ElementType;
  tone: "primary" | "secondary" | "success" | "danger" | "slate"; sub?: string;
}) {
  const accent = {
    primary:   "from-primary to-primary/80",
    secondary: "from-secondary to-secondary/80",
    success:   "from-green-600 to-green-500",
    danger:    "from-rose-600 to-rose-500",
    slate:     "from-slate-600 to-slate-500",
  }[tone];
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }}
      className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-card">
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
        <div className="p-3 bg-card">
          <div className="text-xs text-text-primary/70">{sub}</div>
        </div>
      )}
    </motion.div>
  );
}

function FormField({
  label, required, children, error,
}: {
  label: string; required?: boolean; children: React.ReactNode; error?: string;
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
          <X className="w-3 h-3" />{error}
        </p>
      )}
    </div>
  );
}

function PasswordInput({
  value, onChange, placeholder, error, show, onToggleShow,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  error?: string; show: boolean; onToggleShow: () => void;
}) {
  return (
    <div className="relative">
      <Lock className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(
          "w-full pl-9 pr-10 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white",
          error ? "border-rose-300" : "border-slate-200"
        )}
      />
      <button type="button" onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-primary/40 hover:text-text-primary">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Users() {
  const { setUsers } = useAdmin();

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const currentAdmin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentAdmin") || "null") as
        | { id: number; email: string; name: string } | null;
    } catch { return null; }
  }, []);

  // ── Persisted state ───────────────────────────────────────────────────────
  const [statusMap,  setStatusMap]  = useState<StatusMap>       (readStatusMap);
  const [created,    setCreated]    = useState<CreatedAccount[]> (readCreated);
  const [deletedIds, setDeletedIds] = useState<DeletedIds>      (readDeletedIds);
  const [editsMap,   setEditsMap]   = useState<EditsMap>        (readEdits);

  useEffect(() => safeWrite(STATUS_KEY,           statusMap),  [statusMap]);
  useEffect(() => safeWrite(CREATED_ACCOUNTS_KEY, created),    [created]);
  useEffect(() => safeWrite(DELETED_IDS_KEY,      deletedIds), [deletedIds]);
  useEffect(() => safeWrite(EDITS_KEY,            editsMap),   [editsMap]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STATUS_KEY)           setStatusMap(readStatusMap());
      if (e.key === CREATED_ACCOUNTS_KEY) setCreated(readCreated());
      if (e.key === DELETED_IDS_KEY)      setDeletedIds(readDeletedIds());
      if (e.key === EDITS_KEY)            setEditsMap(readEdits());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // ── Merged rows ───────────────────────────────────────────────────────────
  const rows = useMemo<AccountRow[]>(() => {
    const deleted = new Set(deletedIds);

    const applyEdit = (
      key: string,
      base: Omit<AccountRow, "status" | "isLocalOnly">
    ): AccountRow => {
      const e = editsMap[key] ?? {};
      return {
        ...base,
        name:       e.name       ?? base.name,
        email:      e.email      ?? base.email,
        password:   e.password   ?? base.password,
        roleLabel:  e.roleLabel  ?? base.roleLabel,
        department: e.department ?? base.department,
        status:     (statusMap[key] ?? "Active") as "Active" | "Inactive",
        isLocalOnly: false,
      };
    };

    const adminRows = (adminAccounts as AdminAccount[])
      .filter((a) => !deleted.has(`admin:${a.id}`))
      .map((a) =>
        applyEdit(`admin:${a.id}`, {
          kind: "admin", id: a.id, name: a.name, email: a.email,
          password: a.password, roleLabel: "Admin", department: "—",
        })
      );

    const userRows = (accounts as UserAccount[])
      .filter((u) => !deleted.has(`user:${u.id}`))
      .map((u) =>
        applyEdit(`user:${u.id}`, {
          kind: "user", id: u.id, name: u.name, email: u.email,
          password: u.password, roleLabel: "Employee", department: "—",
        })
      );

    const localRows = created
      .filter((a) => !deleted.has(`${a.kind}:${a.id}`))
      .map((a): AccountRow => {
        const key = `${a.kind}:${a.id}`;
        const e   = editsMap[key] ?? {};
        return {
          kind:        a.kind,
          id:          a.id,
          name:        e.name       ?? a.name,
          email:       e.email      ?? a.email,
          password:    e.password   ?? a.password,
          roleLabel:   e.roleLabel  ?? a.roleLabel,
          department:  e.department ?? a.department,
          status:      (statusMap[key] ?? "Active") as "Active" | "Inactive",
          isLocalOnly: true,
        };
      });

    return [...adminRows, ...userRows, ...localRows];
  }, [statusMap, created, deletedIds, editsMap]);

  // push employees to AdminProvider
  useEffect(() => {
    setUsers(
      rows.filter((r) => r.kind === "user").map((r) => ({
        id: r.id, name: r.name, role: r.roleLabel, status: r.status, email: r.email,
      })) as any
    );
  }, [rows, setUsers]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [query,        setQuery]        = useState("");
  const [typeFilter,   setTypeFilter]   = useState<"All" | "Admins" | "Users">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [deptFilter,   setDeptFilter]   = useState("All");
  const [sort,         setSort]         = useState<"name" | "type" | "status" | "dept">("name");

  const allDepts = useMemo(() => {
    const s = new Set(rows.map((r) => r.department).filter((d) => d !== "—"));
    return ["All", ...Array.from(s).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...rows];
    if (typeFilter   !== "All") list = list.filter((r) => typeFilter === "Admins" ? r.kind === "admin" : r.kind === "user");
    if (statusFilter !== "All") list = list.filter((r) => r.status === statusFilter);
    if (deptFilter   !== "All") list = list.filter((r) => r.department === deptFilter);
    if (q) list = list.filter((r) =>
      `${r.name} ${r.email} ${r.roleLabel} ${r.department}`.toLowerCase().includes(q));
    list.sort((a, b) => {
      if (sort === "name")   return a.name.localeCompare(b.name);
      if (sort === "type")   return a.kind.localeCompare(b.kind);
      if (sort === "status") return a.status.localeCompare(b.status);
      if (sort === "dept")   return a.department.localeCompare(b.department);
      return 0;
    });
    return list;
  }, [rows, query, typeFilter, statusFilter, deptFilter, sort]);

  const stats = useMemo(() => ({
    total:    rows.length,
    admins:   rows.filter((r) => r.kind === "admin").length,
    users:    rows.filter((r) => r.kind === "user").length,
    active:   rows.filter((r) => r.status === "Active").length,
    inactive: rows.filter((r) => r.status === "Inactive").length,
  }), [rows]);

  const hasFilters = query || typeFilter !== "All" || statusFilter !== "All" || deptFilter !== "All";

  // ── Actions ───────────────────────────────────────────────────────────────
  const isSelf = (r: AccountRow) => r.kind === "admin" && currentAdmin?.id === r.id;

  const toggleStatus = (r: AccountRow) => {
    if (isSelf(r)) { notifyError("You can't deactivate your own account."); return; }
    const key  = `${r.kind}:${r.id}`;
    const next = r.status === "Active" ? "Inactive" : "Active";
    setStatusMap((p) => ({ ...p, [key]: next }));
    notifySuccess(`"${r.name}" is now ${next}.`);
  };

  const deleteAccount = (r: AccountRow) => {
    if (isSelf(r)) { notifyError("You can't delete your own account."); return; }
    if (!window.confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
    const key = `${r.kind}:${r.id}`;
    setDeletedIds((p) => [...p, key]);
    if (r.isLocalOnly) setCreated((p) => p.filter((a) => a.id !== r.id));
    setStatusMap((p) => { const c = { ...p }; delete c[key]; return c; });
    setEditsMap((p)  => { const c = { ...p }; delete c[key]; return c; });
    notifySuccess(`"${r.name}" has been deleted.`);
  };

  const copyEmail = async (email: string) => {
    try { await navigator.clipboard.writeText(email); notifySuccess("Email copied."); }
    catch { notifyError("Failed to copy."); }
  };

  // ── CREATE modal ──────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [showPw,     setShowPw]     = useState(false);
  const [showCfm,    setShowCfm]    = useState(false);
  const [createErrors, setCreateErrors] =
    useState<Partial<Record<keyof NewAccountForm, string>>>({});

  const defaultCreate: NewAccountForm = {
    kind: "user", name: "", email: "", password: "",
    confirmPassword: "", roleLabel: "", department: "",
  };
  const [createForm, setCreateForm] = useState<NewAccountForm>(defaultCreate);

  const openCreate = () => {
    setCreateForm(defaultCreate);
    setCreateErrors({});
    setShowPw(false); setShowCfm(false);
    setCreateOpen(true);
  };
  const closeCreate = () => { setCreateOpen(false); setCreateErrors({}); };

  const setCreateField = (f: keyof NewAccountForm, v: string) => {
    if (f === "kind") {
      // Switching account kind resets role; admin role is fixed
      setCreateForm((p) => ({
        ...p,
        kind: v as AccountKind,
        roleLabel: v === "admin" ? "Admin" : "",
      }));
    } else if (f === "department") {
      // When department changes, reset roleLabel if the current role is not
      // available in the newly selected department's role list
      setCreateForm((p) => {
        const availableRoles = getRolesForDept(v);
        const roleStillValid = availableRoles.includes(p.roleLabel);
        return {
          ...p,
          department: v,
          roleLabel: roleStillValid ? p.roleLabel : availableRoles[0],
        };
      });
      setCreateErrors((p) => ({ ...p, department: undefined, roleLabel: undefined }));
      return;
    } else {
      setCreateForm((p) => ({ ...p, [f]: v }));
    }
    if (createErrors[f]) setCreateErrors((p) => ({ ...p, [f]: undefined }));
  };

  const validateCreate = (): boolean => {
    const e: Partial<Record<keyof NewAccountForm, string>> = {};
    if (!createForm.name.trim())       e.name = "Name is required.";
    if (!createForm.email.trim())      e.email = "Email is required.";
    else if (!isValidEmail(createForm.email)) e.email = "Enter a valid email.";
    else if (rows.some((r) => r.email.toLowerCase() === createForm.email.trim().toLowerCase()))
      e.email = "Email already exists.";
    if (!createForm.password)          e.password = "Password is required.";
    else if (createForm.password.length < 6) e.password = "Min 6 characters.";
    if (!createForm.confirmPassword)   e.confirmPassword = "Please confirm password.";
    else if (createForm.password !== createForm.confirmPassword)
      e.confirmPassword = "Passwords do not match.";
    if (!createForm.department)        e.department = "Please select a department.";
    if (!createForm.roleLabel)         e.roleLabel = "Please select a role.";
    setCreateErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = () => {
    if (!validateCreate()) return;
    const acc: CreatedAccount = {
      id: genId(), kind: createForm.kind,
      name:       createForm.name.trim(),
      email:      createForm.email.trim().toLowerCase(),
      password:   createForm.password,
      roleLabel:  createForm.roleLabel,
      department: createForm.department,
      createdAt:  new Date().toISOString(),
    };
    setCreated((p) => [acc, ...p]);
    notifySuccess(`"${acc.name}" created successfully.`);
    closeCreate();
  };

  // ── EDIT modal ────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<AccountRow | null>(null);
  const [showNewPw,  setShowNewPw]  = useState(false);
  const [showCfmPw,  setShowCfmPw]  = useState(false);
  const [editErrors, setEditErrors] =
    useState<Partial<Record<keyof EditAccountForm, string>>>({});

  const defaultEdit: EditAccountForm = {
    name: "", email: "", roleLabel: "", department: "",
    newPassword: "", confirmNewPassword: "",
  };
  const [editForm, setEditForm] = useState<EditAccountForm>(defaultEdit);

  const openEdit = (r: AccountRow) => {
    if (isSelf(r)) { notifyError("Edit your own account from Admin Profile."); return; }
    setEditTarget(r);
    setEditForm({
      name:              r.name,
      email:             r.email,
      roleLabel:         r.roleLabel,
      department:        r.department === "—" ? "" : r.department,
      newPassword:       "",
      confirmNewPassword: "",
    });
    setEditErrors({});
    setShowNewPw(false); setShowCfmPw(false);
  };
  const closeEdit = () => { setEditTarget(null); setEditErrors({}); };

  const setEditField = (f: keyof EditAccountForm, v: string) => {
    if (f === "department") {
      // When department changes, reset roleLabel if the current role is not
      // in the newly selected department's role list
      setEditForm((p) => {
        const availableRoles = getRolesForDept(v);
        const roleStillValid = availableRoles.includes(p.roleLabel);
        return {
          ...p,
          department: v,
          roleLabel: roleStillValid ? p.roleLabel : availableRoles[0],
        };
      });
      setEditErrors((p) => ({ ...p, department: undefined, roleLabel: undefined }));
      return;
    }
    setEditForm((p) => ({ ...p, [f]: v }));
    if (editErrors[f]) setEditErrors((p) => ({ ...p, [f]: undefined }));
  };

  const validateEdit = (r: AccountRow): boolean => {
    const e: Partial<Record<keyof EditAccountForm, string>> = {};
    if (!editForm.name.trim())  e.name = "Name is required.";
    if (!editForm.email.trim()) e.email = "Email is required.";
    else if (!isValidEmail(editForm.email)) e.email = "Enter a valid email.";
    else {
      const key = `${r.kind}:${r.id}`;
      const dup = rows.find(
        (x) =>
          x.email.toLowerCase() === editForm.email.trim().toLowerCase() &&
          `${x.kind}:${x.id}` !== key
      );
      if (dup) e.email = "Email already in use by another account.";
    }
    if (r.kind === "user" && !editForm.roleLabel) e.roleLabel = "Please select a role.";

    const pwTouched = editForm.newPassword || editForm.confirmNewPassword;
    if (pwTouched) {
      if (!editForm.newPassword)              e.newPassword = "New password is required.";
      else if (editForm.newPassword.length < 6) e.newPassword = "Min 6 characters.";
      if (!editForm.confirmNewPassword)       e.confirmNewPassword = "Please confirm new password.";
      else if (editForm.newPassword !== editForm.confirmNewPassword)
        e.confirmNewPassword = "Passwords do not match.";
    }

    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleEdit = () => {
    if (!editTarget) return;
    if (!validateEdit(editTarget)) return;

    const key      = `${editTarget.kind}:${editTarget.id}`;
    const pwChange = editForm.newPassword.trim().length > 0;

    const patch: AccountEdit = {
      name:       editForm.name.trim(),
      email:      editForm.email.trim().toLowerCase(),
      roleLabel:  editTarget.kind === "user" ? editForm.roleLabel : editTarget.roleLabel,
      department: editForm.department || "—",
      ...(pwChange ? { password: editForm.newPassword } : {}),
    };

    // For locally-created accounts keep the created list in sync too
    if (editTarget.isLocalOnly) {
      setCreated((p) =>
        p.map((a) => a.id === editTarget.id ? { ...a, ...patch } : a)
      );
    }

    // Always persist to editsMap (the override layer for JSON accounts)
    setEditsMap((p) => ({ ...p, [key]: { ...(p[key] ?? {}), ...patch } }));

    notifySuccess(`"${patch.name}" updated successfully.`);
    closeEdit();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
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
                Create, edit, and manage employee and admin accounts.
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="slate">{stats.total} total</Pill>
            <Pill tone="primary">{stats.users} users</Pill>
            <Pill tone="secondary">{stats.admins} admins</Pill>
            <Pill tone="success">{stats.active} active</Pill>
            {stats.inactive > 0 && <Pill tone="danger">{stats.inactive} inactive</Pill>}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={openCreate} type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 transition">
            <UserPlus className="w-4 h-4" />
            Create Account
          </motion.button>
          <div className="bg-primary text-white rounded-xl px-4 py-3 font-bold shadow-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="tabular-nums">
              {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total"     value={stats.total}    icon={UsersIcon}  tone="slate"     sub="All accounts" />
        <StatCard label="Employees" value={stats.users}    icon={UserIcon}   tone="primary"   sub="User accounts" />
        <StatCard label="Admins"    value={stats.admins}   icon={Shield}     tone="secondary" sub="Admin accounts" />
        <StatCard label="Active"    value={stats.active}   icon={UserCheck}  tone="success"   sub="Currently active" />
        <StatCard label="Inactive"  value={stats.inactive} icon={Ban}        tone="danger"    sub="Deactivated" />
      </div>

      {/* ── Table Card ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
        className="bg-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Controls */}
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-text-heading">Accounts Directory</div>
              <div className="text-xs text-text-primary/70 mt-0.5">
                {filtered.length} of {rows.length} accounts shown
              </div>
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={openCreate} type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 transition">
              <Plus className="w-3.5 h-3.5" />New Account
            </motion.button>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, role…"
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-text-primary/40" />
              {query && (
                <button onClick={() => setQuery("")} type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-primary/40 hover:text-text-heading">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <span className="text-xs font-semibold text-text-primary/50 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />Filters:
            </span>

            {(["All", "Users", "Admins"] as const).map((opt) => (
              <button key={opt} onClick={() => setTypeFilter(opt)} type="button"
                className={cx(
                  "px-3 py-2 rounded-xl text-xs font-semibold border transition",
                  typeFilter === opt
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-text-heading border-slate-200 hover:bg-soft"
                )}>
                {opt}
              </button>
            ))}

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm text-text-heading">
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm text-text-heading">
              {allDepts.map((d) => <option key={d} value={d}>{d === "All" ? "All Depts" : d}</option>)}
            </select>

            <select value={sort} onChange={(e) => setSort(e.target.value as any)}
              className="border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm text-text-heading">
              <option value="name">Sort: Name</option>
              <option value="type">Sort: Type</option>
              <option value="status">Sort: Status</option>
              <option value="dept">Sort: Department</option>
            </select>

            {hasFilters && (
              <button
                onClick={() => { setQuery(""); setTypeFilter("All"); setStatusFilter("All"); setDeptFilter("All"); }}
                type="button" className="text-xs font-semibold text-primary hover:underline">
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
                  <th key={h} className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">{h}</th>
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
                          <div className="text-xs mt-1">Try adjusting your filters or search.</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, idx) => {
                    const self = isSelf(r);
                    const Icon = r.kind === "admin" ? Shield : UserIcon;
                    return (
                      <motion.tr key={`${r.kind}:${r.id}`}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, delay: idx * 0.02 }}
                        className="hover:bg-slate-50/60 transition-colors">

                        {/* Account */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cx(
                              "h-9 w-9 rounded-xl border flex items-center justify-center shrink-0",
                              r.kind === "admin"
                                ? "bg-secondary/10 border-secondary/20"
                                : "bg-primary/10 border-primary/20"
                            )}>
                              <Icon className={cx("w-4 h-4", r.kind === "admin" ? "text-secondary" : "text-primary")} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-text-heading truncate flex items-center gap-2 flex-wrap">
                                {r.name}
                                {self && (
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
                            {r.kind === "admin"
                              ? <Shield className="w-3 h-3" />
                              : <Tag className="w-3 h-3" />}
                            {r.roleLabel}
                          </Pill>
                        </td>

                        {/* Department */}
                        <td className="px-4 py-3">
                          {r.department !== "—" ? (
                            <div className="flex items-center gap-1.5 text-sm text-text-primary/80">
                              <Briefcase className="w-3.5 h-3.5 text-text-primary/40 shrink-0" />
                              <span className="font-medium">{r.department}</span>
                            </div>
                          ) : (
                            <span className="text-text-primary/30 text-xs">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <Pill tone={r.status === "Active" ? "success" : "slate"}>
                            {r.status === "Active"
                              ? <CheckCircle2 className="w-3.5 h-3.5" />
                              : <Ban className="w-3.5 h-3.5" />}
                            {r.status}
                          </Pill>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {!self && (
                              <button onClick={() => openEdit(r)} type="button"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-primary px-2.5 py-1.5 rounded-lg border border-transparent hover:border-primary/20 hover:bg-primary/5 transition">
                                <Pencil className="w-3.5 h-3.5" />Edit
                              </button>
                            )}
                            <button onClick={() => toggleStatus(r)} disabled={self} type="button"
                              className={cx(
                                "text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition",
                                self
                                  ? "text-text-primary/30 border-slate-100 cursor-not-allowed bg-white"
                                  : r.status === "Active"
                                  ? "text-rose-700 border-rose-200 bg-rose-50 hover:bg-rose-100"
                                  : "text-green-700 border-green-200 bg-green-50 hover:bg-green-100"
                              )}>
                              {r.status === "Active" ? "Deactivate" : "Activate"}
                            </button>
                            <button onClick={() => copyEmail(r.email)} type="button"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-text-primary/60 hover:text-text-heading px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-200 hover:bg-soft transition">
                              <Copy className="w-3.5 h-3.5" />Copy
                            </button>
                            {!self && (
                              <button onClick={() => deleteAccount(r)} type="button"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-rose-200 hover:bg-rose-50 transition">
                                <Trash2 className="w-3.5 h-3.5" />Delete
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
          CREATE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {createOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeCreate}>
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-card flex flex-col"
              onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="bg-primary px-6 py-6 text-white shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold leading-tight">Create Account</div>
                      <div className="text-sm text-white/80 mt-1">
                        New accounts are saved locally and merged with existing records.
                      </div>
                    </div>
                  </div>
                  <button onClick={closeCreate} type="button"
                    className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Kind toggle */}
                <div className="mt-5 flex gap-2">
                  {(["user", "admin"] as AccountKind[]).map((k) => (
                    <button key={k} type="button" onClick={() => setCreateField("kind", k)}
                      className={cx(
                        "flex-1 py-2.5 rounded-xl text-sm font-bold border transition",
                        createForm.kind === k
                          ? "bg-white text-primary border-white shadow-sm"
                          : "bg-white/10 text-white/80 border-white/20 hover:bg-white/20"
                      )}>
                      <span className="flex items-center justify-center gap-2">
                        {k === "admin" ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                        {k === "admin" ? "Admin Account" : "Employee Account"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Personal info */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-text-primary/60" />
                    <span className="text-sm font-bold text-text-heading">Personal Information</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Full Name" required error={createErrors.name}>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input type="text" value={createForm.name}
                          onChange={(e) => setCreateField("name", e.target.value)}
                          placeholder="e.g. Juan dela Cruz"
                          className={cx(
                            "w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white",
                            createErrors.name ? "border-rose-300" : "border-slate-200"
                          )} />
                      </div>
                    </FormField>

                    <FormField label="Email Address" required error={createErrors.email}>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input type="email" value={createForm.email}
                          onChange={(e) => setCreateField("email", e.target.value)}
                          placeholder="e.g. juan@company.com"
                          className={cx(
                            "w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white",
                            createErrors.email ? "border-rose-300" : "border-slate-200"
                          )} />
                      </div>
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Department — always first so user picks it before role */}
                    <FormField label="Department" required error={createErrors.department}>
                      <div className="relative">
                        <Briefcase className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select value={createForm.department}
                          onChange={(e) => setCreateField("department", e.target.value)}
                          className={cx(
                            "w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white appearance-none",
                            createErrors.department ? "border-rose-300" : "border-slate-200"
                          )}>
                          <option value="" disabled>Select department…</option>
                          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </FormField>

                    {/* Role — filtered by selected department */}
                    <FormField label="Role" required error={createErrors.roleLabel}>
                      <div className="relative">
                        <Tag className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        {createForm.kind === "admin" ? (
                          <input readOnly value="Admin"
                            className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50 text-text-primary/60 cursor-not-allowed" />
                        ) : (
                          <>
                            <select
                              value={createForm.roleLabel}
                              onChange={(e) => setCreateField("roleLabel", e.target.value)}
                              disabled={!createForm.department}
                              className={cx(
                                "w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white appearance-none transition",
                                !createForm.department ? "opacity-50 cursor-not-allowed bg-slate-50" : "",
                                createErrors.roleLabel ? "border-rose-300" : "border-slate-200"
                              )}>
                              {!createForm.department && (
                                <option value="" disabled>Select a department first…</option>
                              )}
                              {getRolesForDept(createForm.department).map((role) => (
                                <option key={role} value={role}>{role}</option>
                              ))}
                            </select>
                            {!createForm.department && (
                              <p className="text-[11px] text-text-primary/50 mt-1">
                                Pick a department to see available roles.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </FormField>
                  </div>
                </div>

                {/* Credentials */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-text-primary/60" />
                    <span className="text-sm font-bold text-text-heading">Credentials</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Password" required error={createErrors.password}>
                      <PasswordInput value={createForm.password}
                        onChange={(v) => setCreateField("password", v)}
                        placeholder="Min 6 characters" error={createErrors.password}
                        show={showPw} onToggleShow={() => setShowPw((v) => !v)} />
                    </FormField>

                    <FormField label="Confirm Password" required error={createErrors.confirmPassword}>
                      <PasswordInput value={createForm.confirmPassword}
                        onChange={(v) => setCreateField("confirmPassword", v)}
                        placeholder="Repeat password" error={createErrors.confirmPassword}
                        show={showCfm} onToggleShow={() => setShowCfm((v) => !v)} />
                    </FormField>
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 font-medium flex items-start gap-2">
                    <Layers className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Passwords are stored in plain text for this demo. Use hashed credentials in production.
                  </div>
                </div>

                {/* Live preview */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-xs font-bold text-primary uppercase tracking-wide mb-3">
                    Account Preview
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={cx(
                      "h-10 w-10 rounded-xl border flex items-center justify-center shrink-0",
                      createForm.kind === "admin" ? "bg-secondary/10 border-secondary/20" : "bg-primary/10 border-primary/20"
                    )}>
                      {createForm.kind === "admin"
                        ? <Shield className="w-4 h-4 text-secondary" />
                        : <UserIcon className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-text-heading truncate">
                        {createForm.name.trim() || <span className="text-text-primary/40 font-normal">Full name…</span>}
                      </div>
                      <div className="text-xs text-text-primary/60 truncate">
                        {createForm.email.trim() || <span className="text-text-primary/40">email@example.com</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                      <Pill tone={createForm.kind === "admin" ? "secondary" : "primary"}>
                        {createForm.roleLabel || (createForm.kind === "admin" ? "Admin" : "Role…")}
                      </Pill>
                      {createForm.department && <Pill tone="slate">{createForm.department}</Pill>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 pt-3 shrink-0 flex items-center justify-end gap-3 border-t border-slate-100">
                <button onClick={closeCreate} type="button"
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition">
                  Cancel
                </button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleCreate} type="button"
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 transition inline-flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />Create Account
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          EDIT MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {editTarget && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeEdit}>
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-card flex flex-col"
              onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="bg-primary px-6 py-6 text-white shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                      <UserCog className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold leading-tight">Edit Account</div>
                      <div className="text-sm text-white/80 mt-1">
                        Editing{" "}
                        <span className="font-bold">{editTarget.name}</span>
                        {" · "}
                        <span className="opacity-70">{editTarget.email}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={closeEdit} type="button"
                    className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Personal info */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-text-primary/60" />
                    <span className="text-sm font-bold text-text-heading">Personal Information</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Full Name" required error={editErrors.name}>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input type="text" value={editForm.name}
                          onChange={(e) => setEditField("name", e.target.value)}
                          className={cx(
                            "w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white",
                            editErrors.name ? "border-rose-300" : "border-slate-200"
                          )} />
                      </div>
                    </FormField>

                    <FormField label="Email Address" required error={editErrors.email}>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input type="email" value={editForm.email}
                          onChange={(e) => setEditField("email", e.target.value)}
                          className={cx(
                            "w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white",
                            editErrors.email ? "border-rose-300" : "border-slate-200"
                          )} />
                      </div>
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Department — always pick first */}
                    <FormField label="Department" error={editErrors.department}>
                      <div className="relative">
                        <Briefcase className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select value={editForm.department}
                          onChange={(e) => setEditField("department", e.target.value)}
                          className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white appearance-none">
                          <option value="">Select department…</option>
                          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </FormField>

                    {/* Role — filtered by selected department */}
                    <FormField label="Role" error={editErrors.roleLabel}>
                      <div className="relative">
                        <Tag className="w-4 h-4 text-text-primary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        {editTarget.kind === "admin" ? (
                          <>
                            <input readOnly value="Admin"
                              title="Admin role cannot be changed."
                              className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50 text-text-primary/60 cursor-not-allowed" />
                            <p className="text-[11px] text-text-primary/50 mt-1">
                              Admin role is fixed and cannot be changed.
                            </p>
                          </>
                        ) : (
                          <>
                            <select
                              value={editForm.roleLabel}
                              onChange={(e) => setEditField("roleLabel", e.target.value)}
                              disabled={!editForm.department}
                              className={cx(
                                "w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-white appearance-none transition",
                                !editForm.department ? "opacity-50 cursor-not-allowed bg-slate-50" : "",
                                editErrors.roleLabel ? "border-rose-300" : "border-slate-200"
                              )}>
                              {!editForm.department && (
                                <option value="" disabled>Select a department first…</option>
                              )}
                              {getRolesForDept(editForm.department).map((role) => (
                                <option key={role} value={role}>{role}</option>
                              ))}
                            </select>
                            {!editForm.department && (
                              <p className="text-[11px] text-text-primary/50 mt-1">
                                Pick a department to see available roles.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </FormField>
                  </div>
                </div>

                {/* Password change */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-text-primary/60" />
                      <span className="text-sm font-bold text-text-heading">Change Password</span>
                    </div>
                    <span className="text-xs text-text-primary/50 font-medium">
                      Optional — leave blank to keep current password
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="New Password" error={editErrors.newPassword}>
                      <PasswordInput value={editForm.newPassword}
                        onChange={(v) => setEditField("newPassword", v)}
                        placeholder="Min 6 characters" error={editErrors.newPassword}
                        show={showNewPw} onToggleShow={() => setShowNewPw((v) => !v)} />
                    </FormField>

                    <FormField label="Confirm New Password" error={editErrors.confirmNewPassword}>
                      <PasswordInput value={editForm.confirmNewPassword}
                        onChange={(v) => setEditField("confirmNewPassword", v)}
                        placeholder="Repeat new password" error={editErrors.confirmNewPassword}
                        show={showCfmPw} onToggleShow={() => setShowCfmPw((v) => !v)} />
                    </FormField>
                  </div>

                  <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 font-medium flex items-start gap-2">
                    <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    As an admin, you can reset any account's password directly — no current password required.
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 pt-3 shrink-0 flex items-center justify-end gap-3 border-t border-slate-100">
                <button onClick={closeEdit} type="button"
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-text-heading hover:bg-soft transition">
                  Cancel
                </button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleEdit} type="button"
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 transition inline-flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />Save Changes
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}