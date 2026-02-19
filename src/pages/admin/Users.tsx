import { motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import AdminTable from "./components/AdminTable";
import { useAdmin } from "./context/AdminProvider";
import { notifyError, notifySuccess } from "./utils/toast";

import accounts from "../data/accounts.json";
import adminAccounts from "./data/adminAccounts.json";

import {
  Clock,
  Search,
  Shield,
  User as UserIcon,
  Copy,
  KeyRound,
  Ban,
  CheckCircle2,
  Filter,
} from "lucide-react";

type UserAccount = { id: number; email: string; password: string; name: string };
type AdminAccount = { id: number; email: string; password: string; name: string };

type AccountRow = {
  kind: "user" | "admin";
  id: number;
  name: string;
  email: string;
  roleLabel: string; // e.g. "Employee" | "Admin"
  status: "Active" | "Inactive";
};

const STATUS_KEY = "worktime_account_status_v1"; // shared for users+admins

type StatusMap = Record<string, "Active" | "Inactive">;
// key format: "user:1" or "admin:101"

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
  } catch {
    // ignore
  }
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "primary" | "secondary" | "success" | "slate" | "danger";
}) {
  const base =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border";
  const map = {
    primary: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary/10 text-secondary border-secondary/20",
    success: "bg-green-50 text-green-700 border-green-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    slate: "bg-soft text-text-primary border-slate-200",
  } as const;

  return <span className={cx(base, map[tone])}>{children}</span>;
}

function iconForKind(kind: "user" | "admin") {
  return kind === "admin" ? Shield : UserIcon;
}

export default function Users() {
  // Keep AdminProvider in sync (other admin pages might read users from context)
  const { setUsers } = useAdmin();

  // clock badge
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // current admin (for self-protection)
  const currentAdmin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentAdmin") || "null") as
        | { id: number; email: string; name: string }
        | null;
    } catch {
      return null;
    }
  }, []);

  // UI state
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "Admins" | "Users">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [sort, setSort] = useState<"name" | "type" | "status">("name");

  // base rows from JSON + status map from localStorage
  const [statusMap, setStatusMap] = useState<StatusMap>(() => readStatusMap());

  // keep localStorage in sync
  useEffect(() => {
    writeStatusMap(statusMap);
  }, [statusMap]);

  // optional: live sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATUS_KEY) setStatusMap(readStatusMap());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const rows = useMemo<AccountRow[]>(() => {
    const userList = (accounts as UserAccount[]).map((u) => {
      const key = `user:${u.id}`;
      return {
        kind: "user" as const,
        id: u.id,
        name: u.name,
        email: u.email,
        roleLabel: "Employee",
        status: statusMap[key] ?? "Active",
      };
    });

    const adminList = (adminAccounts as AdminAccount[]).map((a) => {
      const key = `admin:${a.id}`;
      return {
        kind: "admin" as const,
        id: a.id,
        name: a.name,
        email: a.email,
        roleLabel: "Admin",
        status: statusMap[key] ?? "Active",
      };
    });

    return [...adminList, ...userList];
  }, [statusMap]);

  // push "users" into AdminProvider for compatibility (employees only)
  useEffect(() => {
    // Minimal “User” object shape your context expects
    // If your AdminTypes.User differs, update these fields accordingly.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = [...rows];

    if (typeFilter !== "All") {
      list = list.filter((r) => (typeFilter === "Admins" ? r.kind === "admin" : r.kind === "user"));
    }

    if (statusFilter !== "All") {
      list = list.filter((r) => r.status === statusFilter);
    }

    if (q) {
      list = list.filter((r) => {
        const blob = `${r.name} ${r.email} ${r.roleLabel} ${r.kind}`.toLowerCase();
        return blob.includes(q);
      });
    }

    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "type") return a.kind.localeCompare(b.kind);
      if (sort === "status") return a.status.localeCompare(b.status);
      return 0;
    });

    return list;
  }, [rows, query, typeFilter, statusFilter, sort]);

  const stats = useMemo(() => {
    const total = rows.length;
    const admins = rows.filter((r) => r.kind === "admin").length;
    const usersCount = rows.filter((r) => r.kind === "user").length;
    const active = rows.filter((r) => r.status === "Active").length;
    const inactive = rows.filter((r) => r.status === "Inactive").length;
    return { total, admins, usersCount, active, inactive };
  }, [rows]);

  const canToggle = (r: AccountRow) => {
    // admin cannot deactivate self
    if (r.kind === "admin" && currentAdmin?.id === r.id) return false;
    return true;
  };

  const toggleStatus = (r: AccountRow) => {
    if (!canToggle(r)) {
      notifyError("You can’t activate/deactivate your own admin account.");
      return;
    }

    const key = `${r.kind}:${r.id}`;
    const next = r.status === "Active" ? "Inactive" : "Active";

    setStatusMap((prev) => ({ ...prev, [key]: next }));

    notifySuccess(
      `${r.kind === "admin" ? "Admin" : "User"} "${r.name}" is now ${next}.`
    );

    // If you deactivated the currently logged-in admin (shouldn't happen due to guard),
    // you would also remove session, but we already prevent self-deactivate.
  };

  const resetPasswordDemo = (r: AccountRow) => {
    // Frontend-only demo action (no real password reset without backend)
    navigator.clipboard?.writeText("Password reset requested (demo)");
    notifySuccess(`Password reset triggered for ${r.name} (demo).`);
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      notifySuccess("Email copied.");
    } catch {
      notifyError("Failed to copy email.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header card */}
      <div className="bg-card border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-bold text-text-heading">User Management</div>
          <div className="text-sm text-text-primary/70">
            Manage employee and admin accounts (activation, visibility, and basic actions).
          </div>

          {/* Summary chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="slate">{stats.total} total</Pill>
            <Pill tone="primary">{stats.usersCount} users</Pill>
            <Pill tone="secondary">{stats.admins} admins</Pill>
            <Pill tone="success">{stats.active} active</Pill>
            <Pill tone="danger">{stats.inactive} inactive</Pill>
          </div>
        </div>

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

      {/* Table wrapper card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        {/* Controls header */}
        <div className="p-5 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-text-heading">Accounts</div>
              <div className="text-xs text-text-primary/70">
                Search, filter, activate/deactivate, and run quick actions
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 text-text-primary/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name/email..."
                  className="pl-9 border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-text-primary/60" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                >
                  <option value="All">All</option>
                  <option value="Users">Users</option>
                  <option value="Admins">Admins</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                >
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>

                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                  className="border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                >
                  <option value="name">Sort: Name</option>
                  <option value="type">Sort: Type</option>
                  <option value="status">Sort: Status</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <AdminTable headers={["Account", "Type", "Status", "Actions"]}>
          {filtered.map((r) => {
            const Icon = iconForKind(r.kind);
            const isSelfAdmin = r.kind === "admin" && currentAdmin?.id === r.id;
            const disabled = !canToggle(r);

            return (
              <tr key={`${r.kind}:${r.id}`} className="border-b border-slate-50">
                {/* Account */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cx(
                        "h-9 w-9 rounded-xl border flex items-center justify-center",
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
                      <div className="font-semibold text-text-heading truncate">
                        {r.name}
                        {isSelfAdmin && (
                          <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-soft border border-slate-200 text-text-primary/70">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-primary/70 truncate">{r.email}</div>
                    </div>
                  </div>
                </td>

                {/* Type */}
                <td className="px-4 py-3">
                  <Pill tone={r.kind === "admin" ? "secondary" : "primary"}>
                    {r.roleLabel}
                  </Pill>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <Pill tone={r.status === "Active" ? "success" : "slate"}>
                    {r.status === "Active" ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </>
                    ) : (
                      <>
                        <Ban className="w-3.5 h-3.5" /> Inactive
                      </>
                    )}
                  </Pill>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => toggleStatus(r)}
                      disabled={disabled}
                      className={cx(
                        "text-sm font-semibold hover:underline",
                        disabled
                          ? "text-text-primary/40 cursor-not-allowed"
                          : r.status === "Active"
                          ? "text-rose-700"
                          : "text-primary"
                      )}
                      title={
                        disabled
                          ? "You cannot activate/deactivate your own admin account."
                          : r.status === "Active"
                          ? "Deactivate account"
                          : "Activate account"
                      }
                      type="button"
                    >
                      {r.status === "Active" ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      onClick={() => copyEmail(r.email)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-text-primary/70 hover:text-text-heading"
                      type="button"
                      title="Copy email"
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </button>

                    <button
                      onClick={() => resetPasswordDemo(r)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-text-primary/70 hover:text-text-heading"
                      type="button"
                      title="Reset password (demo action)"
                    >
                      <KeyRound className="w-4 h-4" />
                      Reset
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-text-primary/60">
                No accounts found.
              </td>
            </tr>
          )}
        </AdminTable>
      </motion.div>
    </motion.div>
  );
}
